import type { ThreadMessageLike } from "@assistant-ui/react";
import type { SendMessageResult } from "../../../shared/send-message-args";
import type { ActionArgs } from "../../actions/types";
import type { StorageAdapter } from "../../storage";
import type { Profile } from "../../types";
import { handleToolCall } from "./tool-call";
import type { ChatEvent, ToolDispatcher } from "./types";

/**
 * Persist the assistant's response message when a stream reaches its
 * terminal event. No-op for non-terminal events and for messages that
 * ended in `status.reason === "error"`. Cancelled messages still get
 * saved — they carry the partial text the user has already seen.
 */
export async function persistTerminal(
  storage: StorageAdapter,
  threadId: string,
  result: SendMessageResult
): Promise<void> {
  if (!("isEnd" in result)) return;
  if (isErrored(result.responseMessage)) return;
  await storage.messages.create(threadId, result.responseMessage);
}

function isErrored(message: ThreadMessageLike): boolean {
  const reason = (message as { status?: { reason?: string } }).status?.reason;
  return reason === "error";
}

/**
 * Find the first incomplete tool-call (no `result`) in an assistant
 * message's content, or `-1` if none exists. Mirrors the legacy
 * `ChatEngine` behaviour — the model can request several tool calls
 * but the engine resolves them one at a time.
 */
function findPendingToolCall(message: ThreadMessageLike): number {
  if (!Array.isArray(message.content)) return -1;
  return message.content.findIndex(
    (c) =>
      c &&
      typeof c === "object" &&
      (c as { type?: string }).type === "tool-call" &&
      !(c as { result?: unknown }).result
  );
}

/**
 * Context passed to {@link processStream}. The engine resolves the
 * thread coordinates and supplies an optional {@link ToolDispatcher};
 * everything else (middleware, user callbacks, UI side-effects) is
 * applied by the consumer of the resulting `AsyncGenerator<ChatEvent>`.
 *
 * `isResume` distinguishes the first stream after a user message
 * (creates a new assistant message in storage) from a stream resumed
 * after a tool result (updates the existing assistant message in
 * place — that's the message that previously held the tool call).
 */
export type ProcessStreamContext = {
  storage: StorageAdapter;
  threadId: string;
  profile?: Profile;
  profileId?: string;
  dispatcher?: ToolDispatcher;
  /** Forwarded to {@link handleToolCall} when the model issues a tool call. */
  tools?: ActionArgs["tools"];
  isReasoning?: boolean;
  signal?: AbortSignal;
  isResume?: boolean;
  /** Existing assistant messageId to update when `isResume` is true. */
  resumeMessageId?: string;
  /**
   * Existing assistant message content (e.g. the tool-call + result that
   * triggered the resume). When set, every delta from the new round
   * is *merged* into this content rather than replacing it, so the same
   * assistant bubble keeps its tool-call and gains the follow-up text.
   */
  resumeBaseMessage?: ThreadMessageLike;
};

/**
 * Merge the freshly-streamed assistant snapshot into the resume base
 * message. Preserves the base content (typically the tool-call + result
 * the model is responding to) and appends the new content from `fresh`.
 */
function mergeResume(
  base: ThreadMessageLike,
  fresh: ThreadMessageLike
): ThreadMessageLike {
  const baseContent = Array.isArray(base.content) ? base.content : [];
  const freshContent = Array.isArray(fresh.content) ? fresh.content : [];
  return {
    ...fresh,
    role: fresh.role ?? base.role,
    content: [...baseContent, ...freshContent],
  } as ThreadMessageLike;
}

/**
 * Drive a `SendMessageResult` stream end-to-end:
 *
 * - On the first delta, persist the assistant message
 *   (`storage.messages.create`) and emit `message-start`. Subsequent
 *   deltas patch storage + emit `message-delta`.
 * - On terminal `isEnd` events:
 *   - `incomplete` → emit `message-incomplete` and stop.
 *   - assistant message contains an unresolved tool-call → forward to
 *     {@link handleToolCall}, which decides between auto-resolve
 *     (continues with `tool-call-executed`) and surfacing
 *     `tool-call-pending` to the caller.
 *   - otherwise → emit `message-end`.
 *
 * When `isResume` is true the first delta updates `resumeMessageId`
 * instead of creating a new message — used by the post-tool-call
 * resume path.
 *
 * No middleware or user callbacks are invoked; the consumer is free
 * to wrap this stream and apply them.
 */
export async function* processStream(
  stream: AsyncGenerator<SendMessageResult>,
  ctx: ProcessStreamContext
): AsyncGenerator<ChatEvent> {
  const { storage, threadId } = ctx;
  let messageId = ctx.resumeMessageId ?? "";
  let inited = !!ctx.isResume;
  const base = ctx.resumeBaseMessage;
  const merge = (m: ThreadMessageLike) => (base ? mergeResume(base, m) : m);

  for await (const result of stream) {
    if ("isEnd" in result) {
      const final = merge(result.responseMessage);

      if (final.status?.type === "incomplete") {
        yield { type: "message-incomplete", message: final };
        return;
      }

      if (final?.role === "assistant" && Array.isArray(final.content)) {
        const toolIdx = findPendingToolCall(final);
        if (toolIdx !== -1) {
          if (!messageId) {
            const stored = await storage.messages.create(threadId, final);
            messageId = stored.id ?? "";
          } else {
            await storage.messages.update(messageId, final);
          }

          if (ctx.profile && ctx.profileId) {
            yield* handleToolCall(
              { storage, dispatcher: ctx.dispatcher },
              {
                threadId,
                messageId,
                idx: toolIdx,
                message: final,
              }
            );
            return;
          }

          // No profile in scope (e.g. server-reuse path) — surface
          // pending tool-call to the caller without auto-approval.
          yield {
            type: "tool-call-pending",
            message: final,
            idx: toolIdx,
            messageId,
            threadId,
          };
          return;
        }
      }

      if (!messageId) {
        const stored = await storage.messages.create(threadId, final);
        messageId = stored.id ?? "";
      } else {
        await storage.messages.update(messageId, final);
      }

      yield { type: "message-end", message: final, messageId };
      return;
    }

    const merged = merge(result);
    if (!inited) {
      const stored = await storage.messages.create(threadId, merged);
      messageId = stored.id ?? "";
      inited = true;
      yield { type: "message-start", message: merged, messageId };
    } else {
      if (messageId) await storage.messages.update(messageId, merged);
      yield { type: "message-delta", message: merged, messageId };
    }
  }
}
