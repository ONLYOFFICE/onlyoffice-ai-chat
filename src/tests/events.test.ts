import { describe, expect, it, vi } from "vitest";
import { ChatEventBus, chatEvents } from "../ui/providers/EventsProvider";

describe("ChatEventBus", () => {
  it("calls handler when event is emitted", () => {
    const bus = new ChatEventBus();
    const handler = vi.fn();
    bus.on("test", handler);
    bus.emit("test");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("supports multiple handlers per event", () => {
    const bus = new ChatEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on("test", h1);
    bus.on("test", h2);
    bus.emit("test");
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it("removes handler with off()", () => {
    const bus = new ChatEventBus();
    const handler = vi.fn();
    bus.on("test", handler);
    bus.off("test", handler);
    bus.emit("test");
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not throw when emitting unregistered event", () => {
    const bus = new ChatEventBus();
    expect(() => bus.emit("nonexistent")).not.toThrow();
  });

  it("does not throw when off() on unregistered event", () => {
    const bus = new ChatEventBus();
    expect(() => bus.off("nonexistent", vi.fn())).not.toThrow();
  });

  it("isolates events by name", () => {
    const bus = new ChatEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on("a", h1);
    bus.on("b", h2);
    bus.emit("a");
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).not.toHaveBeenCalled();
  });
});

describe("chatEvents singleton", () => {
  it("is a ChatEventBus instance", () => {
    expect(chatEvents).toBeInstanceOf(ChatEventBus);
  });
});
