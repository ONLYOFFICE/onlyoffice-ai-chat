// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const initServers = vi.fn();
const getTools = vi.fn();
const setGroups = vi.fn();
const on = vi.fn();
const off = vi.fn();
const hostToolGroups: unknown[] = [];

vi.mock("../../store/context", () => ({
  useStores: () => ({
    useServersStore: (
      selector?: (s: { initServers: typeof initServers; getTools: typeof getTools }) => unknown
    ) => {
      const state = { initServers, getTools };
      return typeof selector === "function" ? selector(state) : state;
    },
  }),
}));

vi.mock("../../tools/context", () => ({
  useToolsContext: () => ({
    servers: { hostToolSource: { setGroups } },
    hostToolGroups,
    eventBus: { on, off },
  }),
}));

import useServers from "../useServers";

describe("useServers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    initServers.mockClear();
    getTools.mockClear();
    setGroups.mockClear();
    on.mockClear();
    off.mockClear();
  });

  it("syncs host tool groups on mount", () => {
    renderHook(() => useServers({ isReady: false }));
    expect(setGroups).toHaveBeenCalledWith(hostToolGroups);
  });

  it("does not fetch tools while not ready", () => {
    renderHook(() => useServers({ isReady: false }));
    expect(getTools).not.toHaveBeenCalled();
  });

  it("initializes servers when ready", () => {
    renderHook(() => useServers({ isReady: true }));
    expect(initServers).toHaveBeenCalled();
  });

  it("calls getTools exactly once on initial ready mount", () => {
    // Refactor target: dedupe the initial fetch — the host-groups effect
    // and the ready effect must not both fire getTools at startup.
    renderHook(() => useServers({ isReady: true }));
    expect(getTools).toHaveBeenCalledTimes(1);
  });

  it("does not poll periodically", () => {
    // Refactor target: rely on `tools-changed` events instead of polling.
    renderHook(() => useServers({ isReady: true }));
    getTools.mockClear();
    vi.advanceTimersByTime(1000 * 60 * 30);
    expect(getTools).not.toHaveBeenCalled();
  });

  it("does not init servers when not ready", () => {
    renderHook(() => useServers({ isReady: false }));
    expect(initServers).not.toHaveBeenCalled();
  });

  it("subscribes to tools-changed and re-fetches on event", () => {
    renderHook(() => useServers({ isReady: false }));
    expect(on).toHaveBeenCalledWith("tools-changed", expect.any(Function));
    const handler = on.mock.calls.find((c) => c[0] === "tools-changed")![1] as () => void;
    getTools.mockClear();
    handler();
    expect(getTools).toHaveBeenCalled();
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useServers({ isReady: false }));
    unmount();
    expect(off).toHaveBeenCalledWith("tools-changed", expect.any(Function));
  });
});
