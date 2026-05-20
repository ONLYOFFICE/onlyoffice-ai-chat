import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ReadonlyJSONObject } from "assistant-stream/utils";
import { resolveAttachmentRefs } from "../../actions/attachment-resolution";
import { chat } from "../../actions/chat";
import type { ActionArgs } from "../../actions/types";
import type { StorageAdapter } from "../../storage";
import type { Profile } from "../../types";
import { processStream } from "./stream";
import type { ChatEvent } from "./types";

/**
 * Shared context threaded through the tool-call helpers — bundled so
 * each helper signature stays short. The engine owns one instance and
 * passes it to every helper.
 */
export type ToolCallContext = {
  storage: StorageAdapter;
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
    /** Opaque scope token forwarded to scoped storage reads. */
    entityId?: string;
    /** Proxy fetch — mirrors {@link ActionArgs.fetch}. */
    fetch?: ActionArgs["fetch"];
  }
): AsyncGenerator<ChatEvent> {
  const toolCall = readToolCall(input.message, input.idx);
  if (!toolCall) return;

  // Persist the tool result onto the assistant message that issued the
  // call. The UI has already displayed it locally — see the post-
  // `tool-call-executed` handling in `useMessages` — so we don't yield a
  // synthetic `message-delta` here (that previously double-added the
  // message in the runtime list).
  const updatedMessage = replaceContentPart(input.message, input.idx, {
    ...toolCall,
    result: input.result,
  });
  await ctx.storage.messages.update(input.messageId, updatedMessage);

  const history = await ctx.storage.messages.readByThread(input.threadId);

  const actionArgs: ActionArgs = {
    profile: input.profile,
    messages: await resolveAttachmentRefs(history, ctx.storage.attachments),
    tools: input.tools,
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
