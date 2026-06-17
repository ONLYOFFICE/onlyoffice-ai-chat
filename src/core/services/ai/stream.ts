import type { ThreadMessageLike } from "@assistant-ui/react";
import type { SendMessageResult } from "../../../shared/send-message-args";
import type { ActionArgs } from "../../actions/types";
import type { StorageAdapter } from "../../storage";
import type { Profile } from "../../types";
import { readToolCall } from "./tool-call";
import type { ChatEvent } from "./types";

/**
 * Whether a stored message carries content worth sending to the provider.
 *
 * Persisted terminal turns can be empty shells: an error or cancellation
 * that arrived before any delta is saved as `content: ""` plus a status,
 * so the UI can render "Error" / "Stopped" after a reload. Such a turn
 * must be kept out of the *request* history — most providers reject an
 * empty assistant turn (e.g. Anthropic 400). Callers filter prior
 * messages through this helper before handing them to the provider.
 */
export function hasSendableContent(message: ThreadMessageLike): boolean {
  const content = message.content;
  if (typeof content === "string") return content.trim().length > 0;
  return Array.isArray(content) && content.length > 0;
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
  tools?: ActionArgs["tools"];
  isReasoning?: boolean;
  signal?: AbortSignal;
  isResume?: boolean;
  /**
   * Opaque scope token forwarded to scoped storage reads (e.g.
   * `toolPrefs.readAllowAlways`). Engine never inspects it.
   */
  entityId?: string;
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
  // Last streamed snapshot — the accumulated assistant content the user
  // has already seen. Reused when a terminal `incomplete` event arrives so
  // a mid-stream error / cancellation keeps its partial text instead of
  // being overwritten by the provider's empty error/stop shell.
  let lastSnapshot: ThreadMessageLike | undefined = ctx.resumeBaseMessage;
  const base = ctx.resumeBaseMessage;
  const merge = (m: ThreadMessageLike) => (base ? mergeResume(base, m) : m);
  // Stamp the storage-assigned id onto the in-flight message so the UI
  // runtime tracks it by a stable id across deltas instead of falling
  // back to an array-index id (which churns on every append).
  const withId = (m: ThreadMessageLike): ThreadMessageLike =>
    messageId ? { ...m, id: messageId } : m;

  for await (const result of stream) {
    if ("isEnd" in result) {
      const final = merge(result.responseMessage);

      if (final.status?.type === "incomplete") {
        // Persist the terminal state (error / cancelled) so it survives a
        // reload. The provider's error/stop response carries an empty
        // body, so we keep the last streamed snapshot's content (the
        // partial text already shown) and attach only the status. With no
        // prior delta there is nothing to preserve — save the empty shell
        // plus status; `hasSendableContent` keeps it out of future
        // request history.
        const persisted = {
          ...(lastSnapshot ?? final),
          status: final.status,
        } as ThreadMessageLike;
        if (!messageId) {
          const stored = await storage.messages.create(threadId, persisted);
          messageId = stored.id ?? "";
        } else {
          await storage.messages.update(messageId, persisted);
        }
        yield {
          type: "message-incomplete",
          message: withId(persisted),
        };
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

          const toolName = readToolCall(final, toolIdx)?.toolName ?? null;
          const allowList = await storage.toolPrefs.readAllowAlways(
            ctx.entityId
          );
          // A tool auto-allows when the user pinned it to the persisted
          // "always-allow" list OR the tool itself opts in via
          // `requireApproval === false` (host tools default to this). A tool
          // that never sets the flag (MCP / custom servers) keeps prompting.
          const tool = ctx.tools?.find((t) => t.name === toolName);
          const autoAllow =
            !!toolName &&
            (allowList.includes(toolName) || tool?.requireApproval === false);

          yield {
            type: "tool-call-pending",
            message: withId(final),
            idx: toolIdx,
            messageId,
            threadId,
            autoAllow,
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

      yield { type: "message-end", message: withId(final), messageId };
      return;
    }

    const merged = merge(result);
    lastSnapshot = merged;
    if (!inited) {
      const stored = await storage.messages.create(threadId, merged);
      messageId = stored.id ?? "";
      inited = true;
      yield { type: "message-start", message: withId(merged), messageId };
    } else {
      if (messageId) await storage.messages.update(messageId, merged);
      yield { type: "message-delta", message: withId(merged), messageId };
    }
  }
}
