import type { TMCPItem } from "../../../shared/mcp-item";
import { stripToolIntent } from "../../../shared/tool-intent";
import type { ActionArgs } from "../../actions/types";
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
  type ProfileFetchResolver,
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
 * The persisted disabled-map applies to every tool whose group is known:
 * the server-side ones (built-ins + adapter), where `serverType` comes
 * from the grouping, and any caller-supplied one carrying its own
 * {@link TMCPItem.serverType}. The engine is therefore the single
 * authority on the disabled map — a caller need not (and should not)
 * pre-filter, so a toggle flipped elsewhere takes effect on the next
 * round in both directions. Caller-supplied tools with no `serverType`
 * (clients older than the field) stay unfiltered here and rely on the
 * caller's own pre-filtering, as before.
 *
 * On top of that, every tool — caller-supplied and server-side alike —
 * carrying its own `enabled: false` is dropped before the model ever sees
 * it, per the `TMCPItem.enabled` contract: a tool the caller explicitly
 * disabled must not be callable, produce a stored tool call, or pause the
 * stream on approval.
 */
export async function buildToolContext(
  storage: StorageAdapter,
  adapter: ToolsAdapter | undefined,
  userTools: TMCPItem[],
  entityId?: string,
  config?: { attachmentId: string[] },
  systemServerTypes: string[] = [],
  disableBuiltinImageTool = false
): Promise<ToolContext> {
  const [adapterCustom, webSearchTools, imageGenerationTools, disabled] =
    await Promise.all([
      adapter?.getTools(entityId, config) ??
        Promise.resolve<Record<string, TMCPItem[]>>({}),
      getWebSearchTools(storage, entityId),
      // Host opt-out: skip the built-in `generate_image` tool entirely
      // (no assignment read either) so it's never offered to the model.
      disableBuiltinImageTool
        ? Promise.resolve<TMCPItem[]>([])
        : getImageGenerationTools(storage),
      storage.toolPrefs.readDisabled(entityId),
    ]);

  const grouped: Record<string, TMCPItem[]> = {
    ...adapterCustom,
    [WEB_SEARCH_TYPE]: webSearchTools,
    [IMAGE_GENERATION_TYPE]: imageGenerationTools,
  };
  // Filter at the entry point so every derived field (mergedTools,
  // userToolNames) agrees: a disabled tool must not linger in the lookup
  // sets either, or a call to it would still resolve as a user tool and
  // pause the stream on `tool-call-pending`.
  const enabledUserTools = userTools.filter(
    (t) => t.enabled !== false && !isDisabledByPrefs(t, disabled)
  );
  const adapterTools = flattenAndFilter(grouped, disabled);
  const mergedTools = mergeToolsByName(adapterTools, enabledUserTools);

  const systemToolNames = new Set<string>();
  for (const type of systemServerTypes) {
    for (const tool of adapterCustom[type] ?? [])
      systemToolNames.add(tool.name);
  }

  return {
    userTools: enabledUserTools,
    adapterTools,
    mergedTools,
    userToolNames: new Set(enabledUserTools.map((t) => t.name)),
    adapterToolNames: new Set(adapterTools.map((t) => t.name)),
    systemToolNames,
  };
}

/**
 * Whether the persisted disabled map turns `tool` off. Decidable only for
 * a tool that carries its own {@link TMCPItem.serverType} — the map is
 * keyed by server type, so a caller-supplied tool without one cannot be
 * attributed to a group and is left to the caller's own filtering.
 */
function isDisabledByPrefs(
  tool: TMCPItem,
  disabled: Record<string, string[]>
): boolean {
  if (!tool.serverType) return false;
  return disabled[tool.serverType]?.includes(tool.name) ?? false;
}

/**
 * Flatten a `serverType → tools` grouping into a single list, dropping
 * any tool the user has turned off via `storage.toolPrefs.disabled` and
 * any tool carrying its own `enabled: false`. Each group's `serverType`
 * is the disabled-map key; the filter checks the bare tool name against
 * the group's disabled list.
 */
function flattenAndFilter(
  grouped: Record<string, TMCPItem[]>,
  disabled: Record<string, string[]>
): TMCPItem[] {
  const out: TMCPItem[] = [];
  for (const [serverType, tools] of Object.entries(grouped)) {
    const disabledForType = disabled[serverType];
    for (const tool of tools) {
      if (tool.enabled === false) continue;
      if (disabledForType?.includes(tool.name)) continue;
      out.push(tool);
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
  /** System-prompt override; threaded so resume rounds keep it. */
  prompt?: ActionArgs["prompt"];
  isReasoning?: boolean;
  signal?: AbortSignal;
  /** Opaque scope token forwarded to scoped storage reads in resume rounds. */
  entityId?: string;
  /**
   * Host entity pair (id + title) the round was started for. Threaded so
   * resume rounds keep describing the same entity to the provider —
   * see {@link ActionArgs.entityId}.
   */
  entityMeta?: Pick<ActionArgs, "entityId" | "entityTitle">;
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
  /**
   * Engine `pickFetch`, forwarded to built-in image-generation so it can
   * resolve `externalFetch` / `fetchProxy` for its OWN profile. Without
   * it, `generate_image` on an `external` profile loses its transport.
   */
  pickFetch?: ProfileFetchResolver;

  /** Mirrors {@link AIEngineDeps.pagination} for resume-history reads. */
  pagination?: boolean | (() => boolean);
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
    ctx.webSearchFetch,
    ctx.pickFetch,
    ctx.signal
  );

  // Note: `generate_image` base64 → attachment-ref swap happens centrally
  // in `resumeChat`, which every tool-result path funnels through.
  yield* resumeChat(
    { storage, pagination: ctx.pagination },
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
      prompt: ctx.prompt,
      entityId: ctx.entityId,
      entityMeta: ctx.entityMeta,
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
  webSearchFetch?: import("../../../shared/provider-credentials").ProviderFetch,
  pickFetch?: ProfileFetchResolver,
  signal?: AbortSignal
): Promise<unknown> {
  // Drop the synthetic `aiChatIntent` arg (injected into every tool schema
  // for the UI label) before the real tool ever sees it. Idempotent — the
  // UI-side dispatcher strips it too, covering the separate-server deployment
  // where host tools execute in the browser instead of here.
  const cleanArgs = stripToolIntent(args);
  if (toolName === "web_search" || toolName === "web_crawling") {
    return callWebSearchTool(
      storage,
      toolName,
      cleanArgs,
      entityId,
      webSearchFetch
    );
  }
  if (toolName === "generate_image") {
    return callImageGenerationTool(storage, toolName, cleanArgs, pickFetch, signal);
  }
  if (adapter) {
    return adapter.callTool(toolName, cleanArgs, entityId);
  }
  return JSON.stringify({ error: `No dispatcher for tool: ${toolName}` });
}
