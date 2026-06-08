import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Capture useEffect callbacks
// ---------------------------------------------------------------------------

type EffectFn = () => undefined | (() => void);
const effectCallbacks: EffectFn[] = [];

vi.mock("react", () => ({
  useEffect: (fn: EffectFn) => {
    effectCallbacks.push(fn);
  },
  useRef: (val: unknown) => ({ current: val }),
  useContext: vi.fn(),
  createContext: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock stores
// ---------------------------------------------------------------------------

const mockInitThreads = vi.fn();
const mockInitPrompts = vi.fn();

const mockThreadsState = {
  initThreads: mockInitThreads,
};

const mockPromptsState = {
  initPrompts: mockInitPrompts,
};

const mockStores = {
  useThreadsStore: vi.fn((selector?: (s: typeof mockThreadsState) => unknown) =>
    selector ? selector(mockThreadsState) : mockThreadsState
  ),
  usePromptsStore: vi.fn((selector?: (s: typeof mockPromptsState) => unknown) =>
    selector ? selector(mockPromptsState) : mockPromptsState
  ),
};

vi.mock("../../store/context", () => ({
  useStores: () => mockStores,
}));

const mockWidgetConfig: { entityId?: string } = {};

vi.mock("../../../widget-config", () => ({
  useWidgetConfig: () => mockWidgetConfig,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import useThreads from "../useThreads";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useThreads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effectCallbacks.length = 0;
    mockWidgetConfig.entityId = undefined;
  });

  it("returns an empty object", () => {
    const result = useThreads({ isReady: true });
    expect(result).toEqual({});
  });

  it("registers a useEffect callback", () => {
    useThreads({ isReady: true });
    expect(effectCallbacks.length).toBeGreaterThanOrEqual(1);
  });

  it("calls initThreads and initPrompts when isReady is true", () => {
    useThreads({ isReady: true });

    for (const fn of effectCallbacks) {
      fn();
    }

    expect(mockInitThreads).toHaveBeenCalled();
    expect(mockInitPrompts).toHaveBeenCalled();
  });

  it("does not call init when isReady is false", () => {
    useThreads({ isReady: false });

    for (const fn of effectCallbacks) {
      fn();
    }

    expect(mockInitThreads).not.toHaveBeenCalled();
    expect(mockInitPrompts).not.toHaveBeenCalled();
  });

  it("forwards WidgetConfig.entityId to initThreads", () => {
    mockWidgetConfig.entityId = "e1";
    useThreads({ isReady: true });

    for (const fn of effectCallbacks) {
      fn();
    }

    expect(mockInitThreads).toHaveBeenCalledWith("e1");
  });

  it("calls initThreads with undefined in passthrough mode", () => {
    useThreads({ isReady: true });

    for (const fn of effectCallbacks) {
      fn();
    }

    expect(mockInitThreads).toHaveBeenCalledWith(undefined);
  });
});
