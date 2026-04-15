type EventHandler = () => void;

/**
 * Lightweight internal publish/subscribe event bus.
 *
 * Used for fire-and-forget signaling between decoupled parts of the widget
 * (e.g. notifying the UI that a background operation completed). Handlers
 * receive no payload — the event name alone carries the semantic meaning.
 */
export class ChatEventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  /**
   * Registers a handler for the given event name.
   *
   * @param event   - A string identifying the event (e.g. `"threads:updated"`).
   * @param handler - The function to call when the event is emitted.
   */
  on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(handler);
  }

  /**
   * Removes a previously registered handler for the given event name.
   *
   * @param event   - The event name the handler was registered under.
   * @param handler - The exact function reference passed to {@link on}.
   */
  off(event: string, handler: EventHandler) {
    this.listeners.get(event)?.delete(handler);
  }

  /**
   * Emits an event, synchronously invoking all registered handlers.
   *
   * @param event - The event name to fire.
   */
  emit(event: string) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler();
      }
    }
  }
}

/** Shared singleton event bus used across the widget. */
export const chatEvents = new ChatEventBus();
