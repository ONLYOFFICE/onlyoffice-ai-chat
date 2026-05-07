import { beforeEach, describe, expect, it, vi } from "vitest";

type EffectFn = () => undefined | (() => void);
const effectEntries: { fn: EffectFn; deps: unknown[] }[] = [];

vi.mock("react", () => ({
  useEffect: (fn: EffectFn, deps: unknown[]) => {
    effectEntries.push({ fn, deps });
  },
}));

const mockInitServers = vi.fn();
const mockGetTools = vi.fn();

const mockStores = {
  useServersStore: (
    selector: (s: {
      initServers: typeof mockInitServers;
      getTools: typeof mockGetTools;
    }) => unknown
  ) => selector({ initServers: mockInitServers, getTools: mockGetTools }),
};

vi.mock("../../store/context", () => ({
  useStores: () => mockStores,
}));

const mockSetGroups = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();
const hostToolGroups = [{ id: "g1", tools: [] }];
const servers = { hostToolSource: { setGroups: mockSetGroups } };
const eventBus = { on: mockOn, off: mockOff };

vi.mock("../../tools/context", () => ({
  useToolsContext: () => ({ servers, hostToolGroups, eventBus }),
}));

import useEnsureTools from "../useEnsureTools";

describe("useEnsureTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effectEntries.length = 0;
  });

  it("syncs host tool groups into the servers' host tool source", () => {
    useEnsureTools();
    effectEntries[0].fn();
    expect(mockSetGroups).toHaveBeenCalledWith(hostToolGroups);
  });

  it("initialises servers and fetches tools on mount", () => {
    useEnsureTools();
    effectEntries[1].fn();
    expect(mockInitServers).toHaveBeenCalledTimes(1);
    expect(mockGetTools).toHaveBeenCalledTimes(1);
  });

  it("subscribes to tools-changed and refetches on event", () => {
    useEnsureTools();
    const cleanup = effectEntries[2].fn();
    expect(mockOn).toHaveBeenCalledWith("tools-changed", expect.any(Function));

    // The handler ignores its arguments and just refetches.
    const handler = mockOn.mock.calls[0][1] as () => void;
    mockGetTools.mockClear();
    handler();
    expect(mockGetTools).toHaveBeenCalledTimes(1);

    // Cleanup must unsubscribe from the bus.
    expect(typeof cleanup).toBe("function");
    cleanup?.();
    expect(mockOff).toHaveBeenCalledWith("tools-changed", handler);
  });

  it("registers exactly three effect callbacks", () => {
    useEnsureTools();
    expect(effectEntries).toHaveLength(3);
  });
});
