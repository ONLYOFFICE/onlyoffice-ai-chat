import type { ThreadMessageLike } from "@assistant-ui/react";
import { ActionType } from "../../../shared/action-type";
import type { SendMessageResult } from "../../../shared/send-message-args";
import { generateImage } from "../../actions/image-generation";
import { recognizeText } from "../../actions/ocr";
import { summarize } from "../../actions/summarization";
import { analyzeText } from "../../actions/text-analyze";
import { translate } from "../../actions/translation";
import type { ActionArgs } from "../../actions/types";
import { describeImage } from "../../actions/vision";

type SyncFn = (args: ActionArgs) => Promise<ThreadMessageLike>;

/**
 * Sync (one-shot) actions keyed by {@link ActionType}. The streaming
 * `chat` action is used directly by the engine — it's the reason
 * `sendWithStream` exists as a separate entry point.
 */
const SYNC_ACTIONS: Partial<Record<ActionType, SyncFn>> = {
  [ActionType.Summarization]: summarize,
  [ActionType.Translation]: translate,
  [ActionType.TextAnalyze]: analyzeText,
  [ActionType.ImageGeneration]: generateImage,
  [ActionType.OCR]: recognizeText,
  [ActionType.Vision]: describeImage,
};

/**
 * Look up and invoke the sync action registered for the given action
 * type. Throws on unknown / unregistered types.
 */
export function runSync(
  actionType: ActionType,
  args: ActionArgs
): Promise<ThreadMessageLike> {
  const fn = SYNC_ACTIONS[actionType];
  if (!fn) {
    throw new Error(`No action registered for ActionType.${actionType}`);
  }
  return fn(args);
}

/**
 * Drain a streaming action to its terminal `isEnd` event and return the
 * final assistant message. Throws if the stream ends without one.
 */
export async function drainToFinal(
  stream: AsyncGenerator<SendMessageResult>
): Promise<ThreadMessageLike> {
  let last: ThreadMessageLike | undefined;
  for await (const result of stream) {
    if ("isEnd" in result) {
      last = result.responseMessage;
    }
  }
  if (!last) {
    throw new Error("Streaming action produced no terminal result");
  }
  return last;
}
