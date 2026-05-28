import { beforeEach, describe, expect, it, vi } from "vitest";

type EffectFn = () => undefined | (() => void);
const effectCallbacks: EffectFn[] = [];

vi.mock("react", () => ({
  useEffect: (fn: EffectFn) => {
    effectCallbacks.push(fn);
  },
}));

const mockInitThreads = vi.fn();

const mockStores = {
  useThreadsStore: (
    selector: (s: { initThreads: typeof mockInitThreads }) => unknown
  ) => selector({ initThreads: mockInitThreads }),
};

vi.mock("../../store/context", () => ({
  useStores: () => mockStores,
}));

const mockWidgetConfig: { entityId?: string } = {};

vi.mock("../../../widget-config", () => ({
  useWidgetConfig: () => mockWidgetConfig,
}));

import useEnsureThreads from "../useEnsureThreads";

describe("useEnsureThreads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effectCallbacks.length = 0;
    mockWidgetConfig.entityId = undefined;
  });

  it("calls initThreads on mount", () => {
    useEnsureThreads();
    for (const fn of effectCallbacks) fn();
    expect(mockInitThreads).toHaveBeenCalledTimes(1);
  });

  it("forwards WidgetConfig.entityId to initThreads", () => {
    mockWidgetConfig.entityId = "e1";
    useEnsureThreads();
    for (const fn of effectCallbacks) fn();
    expect(mockInitThreads).toHaveBeenCalledWith("e1");
  });

  it("calls initThreads with undefined in passthrough mode", () => {
    useEnsureThreads();
    for (const fn of effectCallbacks) fn();
    expect(mockInitThreads).toHaveBeenCalledWith(undefined);
  });
});
