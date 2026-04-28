import type { ChatCallbacks } from "./types";

/**
 * Manages callback subscriptions for the chat widget.
 *
 * Holds the current set of {@link ChatCallbacks} and exposes a type-safe
 * {@link emit} method that invokes the matching handler. Consumer callback
 * errors are silently swallowed so they never break the internal message flow.
 */
export class CallbacksManager {
  private callbacks: ChatCallbacks = {};

  /**
   * Replaces the current callback set with a new one.
   *
   * @param callbacks - The new callbacks to register. Passing an empty object
   *   effectively removes all handlers.
   */
  setCallbacks(callbacks: ChatCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Invokes the handler registered for the given event name, if any.
   *
   * The call is wrapped in a try/catch so that a throwing consumer callback
   * does not propagate into the widget internals.
   *
   * @param event - The callback key to fire (e.g. `"onMessageSent"`).
   * @param data  - The event payload, inferred from the callback signature.
   */
  emit<K extends keyof ChatCallbacks>(
    event: K,
    data: Parameters<NonNullable<ChatCallbacks[K]>>[0]
  ) {
    const handler = this.callbacks[event];
    if (handler) {
      try {
        (handler as (data: unknown) => void)(data);
      } catch {
        // Swallow consumer callback errors to avoid breaking internal flow
      }
    }
  }

  /**
   * Returns the current set of registered callbacks.
   *
   * @returns The active {@link ChatCallbacks} object.
   */
  getCallbacks(): ChatCallbacks {
    return this.callbacks;
  }
}
