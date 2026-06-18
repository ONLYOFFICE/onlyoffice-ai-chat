import type { TMCPItem } from "../../../shared/mcp-item";
import type { StorageAdapter } from "../../storage";
import type { ToolsAdapter } from "../../tools-adapter";
import type { Profile } from "../../types";
import {
  callWebSearchTool,
  getWebSearchTools,
  WEB_SEARCH_TYPE,
} from "../web-search";
import {
  callImageGenerationTool,
  getImageGenerationTools,
  IMAGE_GENERATION_TYPE,
} from "./sources/image-generation";
import { readToolCall, readToolCallArgs, resumeChat } from "./tool-call";
import type { ChatEvent } from "./types";

/**
 * Where a tool came from on the way into the request:
 * - `"user"` — supplied by the caller via `actionArgs.tools`,
 * - `"adapter"` — contributed by the configured {@link ToolsAdapter} or
 *   by a built-in source assembled engine-side (web-search, image
 *   generation),
 * - `"unknown"` — the model produced a name that was not in either list
 *    (typically a provider-built-in such as cited search results).
 */
export type ToolSource = "user" | "adapter" | "unknown";

/**
 * Aggregated tool context built once at the start of a chat request and
 * reused for the duration of the stream (including any resume rounds).
 */
export type ToolContext = {
  /** Tools supplied by the caller. */
  userTools: TMCPItem[];
  /** Adapter + built-in (web-search, image-generation) tools. */
  adapterTools: TMCPItem[];
  /** `userTools` overlaid on top of `adapterTools` — what the model sees. */
  mergedTools: TMCPItem[];
  /** Lookup set used by {@link resolveToolSource}. */
  userToolNames: Set<string>;
  /** Lookup set used by {@link resolveToolSource}. */
  adapterToolNames: Set<string>;
  /**
   * Subset of {@link adapterToolNames} contributed by server-side system
   * sources. These pause for UI approval (unless always-allowed) yet
   * still execute in-engine — see `AIEngineDeps.systemServerTypes`.
   */
  systemToolNames: Set<string>;
};

/**
 * Build the tool context for one chat request. Fetches every server-
 * side source in parallel — pluggable {@link ToolsAdapter}, built-in
 * web-search, built-in image-generation, and the persisted disabled
 * map — then merges with the caller-supplied list (`userTools` win on
 * `name` collision) and drops anything the user has turned off in
 * `storage.toolPrefs.readDisabled()`.
 *
 * Disabled-filter only applies to the server-side groups (built-ins +
 * adapter), where each tool's `serverType` is known from the grouping.
 * `userTools` arrive flat from the caller and pass through as-is —
 * the caller is expected to have already filtered them.
 */
export async function buildToolContext(
  storage: StorageAdapter,
  adapter: ToolsAdapter | undefined,
  userTools: TMCPItem[],
  entityId?: string,
  config?: { attachmentId: string[] },
  systemServerTypes: string[] = []
): Promise<ToolContext> {
  const [adapterCustom, webSearchTools, imageGenerationTools, disabled] =
    await Promise.all([
      adapter?.getTools(entityId, config) ??
        Promise.resolve<Record<string, TMCPItem[]>>({}),
      getWebSearchTools(storage, entityId),
      getImageGenerationTools(storage),
      storage.toolPrefs.readDisabled(entityId),
    ]);

  const grouped: Record<string, TMCPItem[]> = {
    ...adapterCustom,
    [WEB_SEARCH_TYPE]: webSearchTools,
    [IMAGE_GENERATION_TYPE]: imageGenerationTools,
  };
  const adapterTools = flattenAndFilter(grouped, disabled);
  const mergedTools = mergeToolsByName(adapterTools, userTools);

  const systemToolNames = new Set<string>();
  for (const type of systemServerTypes) {
    for (const tool of adapterCustom[type] ?? [])
      systemToolNames.add(tool.name);
  }

  return {
    userTools,
    adapterTools,
    mergedTools,
    userToolNames: new Set(userTools.map((t) => t.name)),
    adapterToolNames: new Set(adapterTools.map((t) => t.name)),
    systemToolNames,
  };
}

/**
 * Flatten a `serverType → tools` grouping into a single list, dropping
 * any tool the user has turned off via `storage.toolPrefs.disabled`.
 * Each group's `serverType` is the disabled-map key; the filter checks
 * the bare tool name against the group's disabled list.
 */
function flattenAndFilter(
  grouped: Record<string, TMCPItem[]>,
  disabled: Record<string, string[]>
): TMCPItem[] {
  const out: TMCPItem[] = [];
  for (const [serverType, tools] of Object.entries(grouped)) {
    const disabledForType = disabled[serverType];
    if (!disabledForType?.length) {
      out.push(...tools);
      continue;
    }
    for (const tool of tools) {
      if (!disabledForType.includes(tool.name)) out.push(tool);
    }
  }
  return out;
}

/**
 * Merge two tool lists, deduping by `name`. Entries from `override`
 * replace entries from `base` on collision.
 */
export function mergeToolsByName(
  base: TMCPItem[],
  override: TMCPItem[]
): TMCPItem[] {
  const byName = new Map<string, TMCPItem>();
  for (const tool of base) byName.set(tool.name, tool);
  for (const tool of override) byName.set(tool.name, tool);
  return Array.from(byName.values());
}

/** Classify a `toolName` against the user / adapter sets. */
export function resolveToolSource(
  toolName: string | null,
  userToolNames: Set<string>,
  adapterToolNames: Set<string>
): ToolSource {
  if (!toolName) return "unknown";
  if (userToolNames.has(toolName)) return "user";
  if (adapterToolNames.has(toolName)) return "adapter";
  return "unknown";
}

/**
 * Context that the adapter auto-execution path needs to resume a chat
 * round. Mirrors the subset of {@link SendStreamInput} that `resumeChat`
 * cares about — no `actionArgs` indirection because at this point the
 * engine has already merged adapter + user tools.
 */
export type AdapterRunContext = {
  profile: Profile;
  profileId: string;
  tools: TMCPItem[];
  isReasoning?: boolean;
  signal?: AbortSignal;
  /** Opaque scope token forwarded to scoped storage reads in resume rounds. */
  entityId?: string;
  /**
   * Proxy fetch wired into resume rounds when the profile opts into
   * `useProxy`. Mirrors {@link ActionArgs.fetch}.
   */
  fetch?: import("../../../shared/provider-credentials").ProviderFetch;
  /**
   * Proxy fetch for built-in web-search HTTP calls. Set to the host's
   * `PlatformAdapter.fetchProxy` whenever it is configured — unlike
   * {@link AdapterRunContext.fetch}, it is not gated by the profile's
   * `useProxy` flag.
   */
  webSearchFetch?: import("../../../shared/provider-credentials").ProviderFetch;
};

/**
 * Execute an adapter-served tool (built-in web-search / image-gen, or
 * a {@link ToolsAdapter}-contributed one) in-engine and resume the
 * chat with its result. Yields whatever the resumed `processStream`
 * yields. The caller is responsible for the recursion that re-enters
 * this helper if the resumed round produces another adapter tool call.
 */
export async function* executeAdapterTool(
  storage: StorageAdapter,
  adapter: ToolsAdapter | undefined,
  event: Extract<ChatEvent, { type: "tool-call-pending" }>,
  ctx: AdapterRunContext
): AsyncGenerator<ChatEvent> {
  const toolCall = readToolCall(event.message, event.idx);
  if (!toolCall) return;

  const args = readToolCallArgs(event.message, event.idx) as Record<
    string,
    unknown
  >;
  const result = await dispatchAdapterTool(
    storage,
    adapter,
    toolCall.toolName,
    args,
    ctx.entityId,
    ctx.webSearchFetch
  );

  // Note: `generate_image` base64 → attachment-ref swap happens centrally
  // in `resumeChat`, which every tool-result path funnels through.
  yield* resumeChat(
    { storage },
    {
      threadId: event.threadId,
      messageId: event.messageId,
      idx: event.idx,
      message: event.message,
      result,
      profile: ctx.profile,
      profileId: ctx.profileId,
      isReasoning: ctx.isReasoning,
      signal: ctx.signal,
      tools: ctx.tools,
      entityId: ctx.entityId,
      fetch: ctx.fetch,
    }
  );
}

/**
 * Route a tool name to the right server-side dispatcher. Built-in
 * web-search and image-generation are handled directly; anything else
 * falls through to the user-supplied {@link ToolsAdapter}. Returns a
 * sentinel error string when no dispatcher can handle the call —
 * keeps the chat alive instead of throwing into the stream.
 */
async function dispatchAdapterTool(
  storage: StorageAdapter,
  adapter: ToolsAdapter | undefined,
  toolName: string,
  args: Record<string, unknown>,
  entityId?: string,
  webSearchFetch?: import("../../../shared/provider-credentials").ProviderFetch
): Promise<unknown> {
  if (toolName === "web_search" || toolName === "web_crawling") {
    return callWebSearchTool(storage, toolName, args, entityId, webSearchFetch);
  }
  if (toolName === "generate_image") {
    return callImageGenerationTool(storage, toolName, args);
  }
  if (adapter) {
    return adapter.callTool(toolName, args, entityId);
  }
  return JSON.stringify({ error: `No dispatcher for tool: ${toolName}` });
}
