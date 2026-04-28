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
    useServersStore: () => ({ initServers, getTools }),
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

  it("syncs host tool groups and fetches tools on mount", () => {
    renderHook(() => useServers({ isReady: false }));
    expect(setGroups).toHaveBeenCalledWith(hostToolGroups);
    expect(getTools).toHaveBeenCalled();
  });

  it("initializes servers and starts polling when ready", () => {
    renderHook(() => useServers({ isReady: true }));
    expect(initServers).toHaveBeenCalled();
    getTools.mockClear();
    vi.advanceTimersByTime(1000 * 60 * 5);
    expect(getTools).toHaveBeenCalled();
  });

  it("does not init servers when not ready", () => {
    renderHook(() => useServers({ isReady: false }));
    expect(initServers).not.toHaveBeenCalled();
  });

  it("clears interval on unmount", () => {
    const { unmount } = renderHook(() => useServers({ isReady: true }));
    getTools.mockClear();
    unmount();
    vi.advanceTimersByTime(1000 * 60 * 10);
    expect(getTools).not.toHaveBeenCalled();
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
