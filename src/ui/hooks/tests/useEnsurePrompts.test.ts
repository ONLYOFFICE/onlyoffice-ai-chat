import { beforeEach, describe, expect, it, vi } from "vitest";

type EffectFn = () => undefined | (() => void);
const effectCallbacks: EffectFn[] = [];

vi.mock("react", () => ({
  useEffect: (fn: EffectFn) => {
    effectCallbacks.push(fn);
  },
}));

const mockInitPrompts = vi.fn();

const mockStores = {
  usePromptsStore: (
    selector: (s: { initPrompts: typeof mockInitPrompts }) => unknown
  ) => selector({ initPrompts: mockInitPrompts }),
};

vi.mock("../../store/context", () => ({
  useStores: () => mockStores,
}));

import useEnsurePrompts from "../useEnsurePrompts";

describe("useEnsurePrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effectCallbacks.length = 0;
  });

  it("calls initPrompts on mount", () => {
    useEnsurePrompts();
    for (const fn of effectCallbacks) fn();
    expect(mockInitPrompts).toHaveBeenCalledTimes(1);
  });

  it("registers exactly one effect callback", () => {
    useEnsurePrompts();
    expect(effectCallbacks.length).toBe(1);
  });
});
