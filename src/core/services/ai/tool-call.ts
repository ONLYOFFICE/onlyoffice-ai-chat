import type { ThreadMessageLike } from "@assistant-ui/react";
import { chat } from "../../actions/chat";
import type { ActionArgs } from "../../actions/types";
import type { StorageAdapter } from "../../storage";
import type { Profile } from "../../types";
import { processStream } from "./stream";
import type { ChatEvent, ToolDispatcher } from "./types";

/**
 * Shared context threaded through the tool-call helpers — bundled so
 * each helper signature stays short. The engine owns one instance and
 * passes it to every helper.
 *
 * Only `storage` is mandatory. `dispatcher` is required for actually
 * executing tool calls; without it the helpers can still run the deny
 * path.
 */
export type ToolCallContext = {
  storage: StorageAdapter;
  dispatcher?: ToolDispatcher;
};

/**
 * Locate the tool-call content part inside `message` at the given
 * `idx`, narrowing the type. Returns `null` if the index does not
 * point at a tool-call entry — used to reject malformed
 * `approve` / `deny` requests without throwing.
 */
function readToolCall(
  message: ThreadMessageLike,
  idx: number
):
  | {
      type: "tool-call";
      toolName: string;
      args?: Record<string, unknown>;
      result?: unknown;
    }
  | null {
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
  return part as {
    type: "tool-call";
    toolName: string;
    args?: Record<string, unknown>;
    result?: unknown;
  };
}

/** Replace the content entry at `idx` with `next`, returning a fresh message. */
export function replaceContentPart(
  message: ThreadMessageLike,
  idx: number,
  next: unknown
): ThreadMessageLike {
  const content = Array.isArray(message.content)
    ? message.content.map((item, i) => (i === idx ? next : item))
    : message.content;
  return { ...message, content } as ThreadMessageLike;
}

/**
 * Execute a tool call through {@link ToolDispatcher.callTool} and
 * surface the raw result via a `tool-call-executed` event.
 *
 * The engine persists nothing yet — the consumer is expected to apply
 * its `afterToolResult` middleware to the surfaced result and call
 * {@link AIEngine.continueAfterToolCall} with the final value, which
 * is the point where storage and the chat stream pick up.
 *
 * If `dispatcher` is unavailable (typical on a server-only setup that
 * proxies tool dispatch elsewhere) the helper yields nothing — the
 * caller is responsible for handling that branch.
 */
export async function* executeToolCall(
  ctx: ToolCallContext,
  input: {
    threadId: string;
    messageId: string;
    idx: number;
    message: ThreadMessageLike;
  }
): AsyncGenerator<ChatEvent> {
  const toolCall = readToolCall(input.message, input.idx);
  if (!toolCall) return;

  const { dispatcher } = ctx;
  if (!dispatcher) {
    yield {
      type: "tool-call-executed",
      threadId: input.threadId,
      messageId: input.messageId,
      idx: input.idx,
      message: input.message,
      toolName: toolCall.toolName,
      result: "Tool dispatcher unavailable",
    };
    return;
  }

  const serverType = dispatcher.getServerType(toolCall.toolName);
  const bareName = toolCall.toolName.replace(`${serverType}_`, "");
  const result = await dispatcher.callTool(
    serverType,
    bareName,
    (toolCall.args ?? {}) as Record<string, unknown>
  );

  yield {
    type: "tool-call-executed",
    threadId: input.threadId,
    messageId: input.messageId,
    idx: input.idx,
    message: input.message,
    toolName: toolCall.toolName,
    result,
  };
}

/**
 * Decide what to do with a tool-call surfaced mid-stream:
 *
 * - If the dispatcher reports the tool as auto-approved, jump straight
 *   to {@link executeToolCall} so the UI never sees the dialog.
 * - Otherwise emit `tool-call-pending` and stop — the UI will run
 *   `beforeToolCall` middleware and resume via
 *   `approveToolCall` / `denyToolCall`.
 *
 * Used internally by {@link processStream} when it spots an incomplete
 * tool-call in the terminal assistant message.
 */
export async function* handleToolCall(
  ctx: ToolCallContext,
  input: {
    threadId: string;
    messageId: string;
    idx: number;
    message: ThreadMessageLike;
  }
): AsyncGenerator<ChatEvent> {
  const toolCall = readToolCall(input.message, input.idx);
  if (!toolCall) return;

  if (ctx.dispatcher) {
    const serverType = ctx.dispatcher.getServerType(toolCall.toolName);
    const bareName = toolCall.toolName.replace(`${serverType}_`, "");
    if (ctx.dispatcher.isAutoApproved(serverType, bareName)) {
      yield* executeToolCall(ctx, input);
      return;
    }
  }

  yield {
    type: "tool-call-pending",
    threadId: input.threadId,
    messageId: input.messageId,
    idx: input.idx,
    message: input.message,
  };
}

/**
 * Persist `result` onto the assistant message and resume the chat
 * stream with the augmented history.
 *
 * Called by both {@link AIEngine.continueAfterToolCall} (after the
 * UI's `afterToolResult` middleware) and {@link AIEngine.denyToolCall}
 * (with `result === "User deny tool call"`).
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
    messages: history,
    tools: input.tools,
    isReasoning: input.isReasoning,
    signal: input.signal,
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
    dispatcher: ctx.dispatcher,
    tools: input.tools,
    isReasoning: input.isReasoning,
    signal: input.signal,
    isResume: true,
    resumeMessageId: input.messageId,
    resumeBaseMessage: updatedMessage,
  });
}
