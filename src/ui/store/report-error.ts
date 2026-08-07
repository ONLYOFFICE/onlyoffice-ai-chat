import logger from "../../shared/logger";
import type { CallbacksManager } from "../providers/EventsProvider";
import type { ChatErrorEvent } from "../providers/EventsProvider";

/**
 * Reports a failure that nobody can `await`.
 *
 * The hydration paths (profiles, threads, prompts, servers, tools, message
 * history) are all fired from mount effects that call them without awaiting,
 * so a rejection escaping one of them would land as an unhandled rejection
 * while the UI shows an empty list — indistinguishable from a host that
 * genuinely has nothing configured. Every such path logs through here and
 * hands the failure to the host on {@link ChatCallbacks.onError}, then keeps
 * its state unhydrated so the next mount / navigation retries.
 *
 * @param callbacksManager - Manager holding the host's callbacks.
 * @param context - Which step failed, e.g. `"threads:init"`. Passed through
 *   as {@link ChatErrorEvent.context}.
 * @param error - The caught value.
 * @param type - Failing subsystem; defaults to `"storage"`, since these reads
 *   all go through the storage/API contract.
 */
export const reportStoreError = (
  callbacksManager: CallbacksManager,
  context: string,
  error: unknown,
  type: ChatErrorEvent["type"] = "storage"
): void => {
  logger.error(`${context} failed:`, error);
  callbacksManager.emit("onError", { type, error, context });
};
