import type { ThreadMessageLike } from "@assistant-ui/react";
import type { SendMessageResult } from "../../../shared/send-message-args";
import type { StorageAdapter } from "../../storage";

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
