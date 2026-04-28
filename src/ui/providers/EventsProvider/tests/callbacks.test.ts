import { describe, expect, it, vi } from "vitest";
import { CallbacksManager } from "../callbacks";
import type { ChatCallbacks } from "../types";

describe("CallbacksManager", () => {
  it("starts with empty callbacks", () => {
    const m = new CallbacksManager();
    expect(m.getCallbacks()).toEqual({});
  });

  it("setCallbacks replaces current callbacks", () => {
    const m = new CallbacksManager();
    const cb: ChatCallbacks = { onMessageSent: vi.fn() };
    m.setCallbacks(cb);
    expect(m.getCallbacks()).toBe(cb);
  });

  it("emit invokes the matching handler with the data", () => {
    const m = new CallbacksManager();
    const handler = vi.fn();
    m.setCallbacks({ onMessageSent: handler } as unknown as ChatCallbacks);
    m.emit(
      "onMessageSent" as never,
      { threadId: "t", messageUID: "m" } as never
    );
    expect(handler).toHaveBeenCalledWith({ threadId: "t", messageUID: "m" });
  });

  it("emit is a no-op when no handler is registered", () => {
    const m = new CallbacksManager();
    expect(() => m.emit("onMessageSent" as never, {} as never)).not.toThrow();
  });

  it("emit swallows handler errors", () => {
    const m = new CallbacksManager();
    const handler = vi.fn(() => {
      throw new Error("boom");
    });
    m.setCallbacks({ onMessageSent: handler } as unknown as ChatCallbacks);
    expect(() => m.emit("onMessageSent" as never, {} as never)).not.toThrow();
    expect(handler).toHaveBeenCalled();
  });
});
