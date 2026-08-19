import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ReadonlyJSONObject } from "assistant-stream/utils";
import logger from "../../../shared/logger";
import { resolveAttachmentRefs } from "../../actions/attachment-resolution";
import {
  drainPages,
  isPaginationEnabled,
  messagesCursorOf,
} from "../../storage";
import { chat } from "../../actions/chat";
import type { ActionArgs } from "../../actions/types";
import type { StorageAdapter } from "../../storage";
import type { Profile } from "../../types";
import {
  hasSendableContent,
  processStream,
  stripUnresolvedToolCalls,
} from "./stream";
import type { ChatEvent } from "./types";

/**
 * Shared context threaded through the tool-call helpers — bundled so
 * each helper signature stays short. The engine owns one instance and
 * passes it to every helper.
 */
export type ToolCallContext = {
  storage: StorageAdapter;
  /** Mirrors {@link AIEngineDeps.pagination} for the resume-history read. */
  pagination?: boolean | (() => boolean);
};

/**
 * Tool-call variant of {@link ThreadMessageLike} content parts. Mirrors
 * the inline shape from `@assistant-ui/react` so DTOs that read from or
 * write into `message.content` stay aligned with the runtime type
 * instead of duplicating a looser local definition.
 */
export type ToolCallPart = Extract<
  Exclude<ThreadMessageLike["content"], string>[number],
  { type: "tool-call" }
>;

/**
 * Locate the tool-call content part inside `message` at the given
 * `idx`, narrowing the type. Returns `null` if the index does not
 * point at a tool-call entry — used to reject malformed
 * `approve` / `deny` requests without throwing.
 */
export function readToolCall(
  message: ThreadMessageLike,
  idx: number
): ToolCallPart | null {
  if (!Array.isArray(message.content)) return null;
  const part = message.content[idx] as unknown;
  if (
    !part ||
    typeof part !== "object" ||
    !("type" in part) ||
    (part as { type?: string }).type !== "tool-call"
  ) {
    return null;
  }
  return part as ToolCallPart;
}

/** Read the `args` payload from a tool-call part, defaulting to `{}`. */
export function readToolCallArgs(
  message: ThreadMessageLike,
  idx: number
): ReadonlyJSONObject {
  return readToolCall(message, idx)?.args ?? ({} as ReadonlyJSONObject);
}

/** Replace the content entry at `idx` with `next`, returning a fresh message. */
export function replaceContentPart(
  message: ThreadMessageLike,
  idx: number,
  next: ToolCallPart
): ThreadMessageLike {
  const content = Array.isArray(message.content)
    ? message.content.map((item, i) => (i === idx ? next : item))
    : message.content;
  return { ...message, content } as ThreadMessageLike;
}

/**
 * Patch only the `args` field of the tool-call at `idx`, leaving every
 * other field untouched. No-op if the part at `idx` is not a tool-call.
 */
export function patchToolCallArgs(
  message: ThreadMessageLike,
  idx: number,
  args: ReadonlyJSONObject
): ThreadMessageLike {
  const original = readToolCall(message, idx);
  if (!original) return message;
  return replaceContentPart(message, idx, { ...original, args });
}

/**
 * Patch only the `result` field of the tool-call at `idx`. No-op if the
 * part at `idx` is not a tool-call.
 */
export function patchToolCallResult(
  message: ThreadMessageLike,
  idx: number,
  result: unknown
): ThreadMessageLike {
  const original = readToolCall(message, idx);
  if (!original) return message;
  return replaceContentPart(message, idx, { ...original, result });
}

/**
 * If `result` is an image-tool payload carrying inline base64, persist
 * the image to `storage.attachments` — linked to the owning
 * message/thread so the existing cascade deletes reclaim it — and swap
 * the inline body for a lightweight `{ data: { ref } }` marker.
 *
 * Detection is by RESULT SHAPE (`{ data: { base64 } }`, the library's
 * canonical image-result format) rather than by tool name. That keeps it
 * working for the built-in `generate_image`, for an integrator's own
 * image tool exposed via `HostToolSource` (whose name is group-prefixed,
 * e.g. `"<group>_generate_image"`), and for any MCP tool that follows
 * the same shape — no per-integrator wiring required.
 *
 * Keeps the megabyte-scale base64 out of `storage.messages` and out of
 * every subsequent provider request: the model only ever sees the tiny
 * marker, while the UI hydrates the ref through `api.attachments`.
 *
 * Any non-matching result — web-search payloads, error envelopes, plain
 * strings, an already-swapped ref marker — or a storage write that
 * throws falls through with the original result untouched, so tools
 * never break just because persistence hiccuped.
 */
export async function persistGeneratedImage(
  storage: StorageAdapter,
  toolName: string,
  result: unknown,
  scope: { messageId: string; threadId: string; entityId?: string }
): Promise<unknown> {
  if (typeof result !== "string") return result;

  let base64: string | undefined;
  try {
    const parsed = JSON.parse(result) as { data?: { base64?: unknown } };
    if (typeof parsed?.data?.base64 === "string") base64 = parsed.data.base64;
  } catch {
    return result;
  }
  if (!base64) return result;

  try {
    const record = await storage.attachments.create({
      kind: "image",
      source: "tool",
      title: toolName || "generated-image",
      base64,
      messageId: scope.messageId,
      threadId: scope.threadId,
      entityId: scope.entityId,
    });
    return JSON.stringify({ data: { ref: record.id } });
  } catch (e) {
    logger.error("[image] failed to persist generated image attachment", e);
    return result;
  }
}

/**
 * Coerce a tool result to the string form the provider requires: a tool
 * result becomes the `content` of an OpenAI `tool` message, which must be a
 * string. Library tools already return JSON strings, but a consumer that
 * approves a structured (object) result via `approveToolCall` would persist a
 * raw object that the provider gateway rejects with a deserialization error
 * (Bug 82862). Strings pass through unchanged; everything else is
 * JSON-serialized.
 */
function normalizeToolResult(result: unknown): unknown {
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

/**
 * Persist `result` onto the assistant message and resume the chat
 * stream with the augmented history.
 *
 * Called by both {@link AIEngine.approveToolCall} (with the consumer-
 * supplied tool result) and {@link AIEngine.denyToolCall} (with
 * `"User deny tool call"`).
 */
export async function* resumeChat(
  ctx: ToolCallContext,
  input: {
    threadId: string;
    messageId: string;
    idx: number;
    message: ThreadMessageLike;
    result: unknown;
    profile: Profile;
    profileId: string;
    isReasoning?: boolean;
    signal?: AbortSignal;
    tools?: ActionArgs["tools"];
    /** System-prompt override; threaded so it survives the tool-call resume. */
    prompt?: ActionArgs["prompt"];
    /** Opaque scope token forwarded to scoped storage reads. */
    entityId?: string;
    /** Proxy fetch — mirrors {@link ActionArgs.fetch}. */
    fetch?: ActionArgs["fetch"];
  }
): AsyncGenerator<ChatEvent> {
  const toolCall = readToolCall(input.message, input.idx);
  if (!toolCall) return;

  // Tool-generated images: persist the base64 to `storage.attachments`
  // and swap it for a lightweight `{ data: { ref } }` marker before the
  // result touches `storage.messages`. This is the single chokepoint for
  // every tool-result path — engine auto-exec (`executeAdapterTool`),
  // UI approve, and deny all funnel through here — so the megabyte-scale
  // base64 never lands in the message and is never re-sent to the model.
  const persisted = await persistGeneratedImage(
    ctx.storage,
    toolCall.toolName,
    input.result,
    {
      messageId: input.messageId,
      threadId: input.threadId,
      entityId: input.entityId,
    }
  );

  // A tool result must reach the provider as a string; a raw object is
  // rejected by the gateway when it deserializes messages.content (Bug
  // 82862). Serialize any non-string result before it is persisted and
  // replayed into the resumed history.
  const result = normalizeToolResult(persisted);

  // Persist the tool result onto the assistant message that issued the
  // call. The UI has already displayed it locally — see the post-
  // `tool-call-executed` handling in `useMessages` — so we don't yield a
  // synthetic `message-delta` here (that previously double-added the
  // message in the runtime list).
  const updatedMessage = replaceContentPart(input.message, input.idx, {
    ...toolCall,
    result,
  });
  await ctx.storage.messages.update(input.messageId, updatedMessage);

  const history = stripUnresolvedToolCalls(
    isPaginationEnabled(ctx.pagination)
      ? await drainPages(
          (count, cursor) =>
            ctx.storage.messages.readByThread(input.threadId, count, cursor),
          messagesCursorOf,
          (m) => m.id ?? ""
        )
      : await ctx.storage.messages.readByThread(input.threadId)
  ).filter(hasSendableContent);

  const actionArgs: ActionArgs = {
    profile: input.profile,
    threadId: input.threadId,
    messages: await resolveAttachmentRefs(history, ctx.storage.attachments),
    tools: input.tools,
    prompt: input.prompt,
    isReasoning: input.isReasoning,
    signal: input.signal,
    fetch: input.fetch,
  };

  // Resume into the SAME assistant message: the new round's snapshots
  // are merged onto `updatedMessage` (which carries the tool-call +
  // result) so the UI keeps a single bubble that gains the follow-up
  // text. Without `resumeBaseMessage` the merge would overwrite the
  // tool-call content because the provider stream starts from a fresh
  // empty assistant message.
  yield* processStream(chat(actionArgs), {
    storage: ctx.storage,
    threadId: input.threadId,
    profile: input.profile,
    profileId: input.profileId,
    tools: input.tools,
    isReasoning: input.isReasoning,
    signal: input.signal,
    entityId: input.entityId,
    isResume: true,
    resumeMessageId: input.messageId,
    resumeBaseMessage: updatedMessage,
  });
}
