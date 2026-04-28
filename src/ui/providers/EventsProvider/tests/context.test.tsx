// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, renderHook } from "@testing-library/react";
import { EventsProvider, useCallbacksManager } from "../context";
import { CallbacksManager } from "../callbacks";

describe("EventsProvider", () => {
  it("useCallbacksManager throws outside provider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useCallbacksManager())).toThrow(
      "useCallbacksManager must be used within EventsProvider"
    );
    errorSpy.mockRestore();
  });

  it("useCallbacksManager returns the manager", () => {
    const cm = new CallbacksManager();
    const { result } = renderHook(() => useCallbacksManager(), {
      wrapper: ({ children }) => (
        <EventsProvider callbacksManager={cm}>{children}</EventsProvider>
      ),
    });
    expect(result.current).toBe(cm);
  });

  it("EventsProvider sets callbacks on mount and reflects updates", () => {
    const cm = new CallbacksManager();
    const setCallbacks = vi.spyOn(cm, "setCallbacks");
    const cb1 = { onMessageSent: vi.fn() };
    const { rerender } = render(
      <EventsProvider callbacksManager={cm} callbacks={cb1}>
        <span />
      </EventsProvider>
    );
    expect(setCallbacks).toHaveBeenCalledWith(cb1);

    const cb2 = { onMessageSent: vi.fn() };
    rerender(
      <EventsProvider callbacksManager={cm} callbacks={cb2}>
        <span />
      </EventsProvider>
    );
    expect(setCallbacks).toHaveBeenLastCalledWith(cb2);
  });

  it("EventsProvider falls back to empty callbacks when none provided", () => {
    const cm = new CallbacksManager();
    const setCallbacks = vi.spyOn(cm, "setCallbacks");
    render(
      <EventsProvider callbacksManager={cm}>
        <span />
      </EventsProvider>
    );
    expect(setCallbacks).toHaveBeenCalledWith({});
  });
});
