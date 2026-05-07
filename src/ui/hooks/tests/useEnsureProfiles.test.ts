import { beforeEach, describe, expect, it, vi } from "vitest";

type EffectFn = () => undefined | (() => void);
const effectCallbacks: EffectFn[] = [];

vi.mock("react", () => ({
  useEffect: (fn: EffectFn) => {
    effectCallbacks.push(fn);
  },
}));

const mockInit = vi.fn();

const mockStores = {
  useProfilesStore: (selector: (s: { init: typeof mockInit }) => unknown) =>
    selector({ init: mockInit }),
};

vi.mock("../../store/context", () => ({
  useStores: () => mockStores,
}));

import useEnsureProfiles from "../useEnsureProfiles";

describe("useEnsureProfiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effectCallbacks.length = 0;
  });

  it("calls profiles store init on mount", () => {
    useEnsureProfiles();
    for (const fn of effectCallbacks) fn();
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it("registers exactly one effect callback", () => {
    useEnsureProfiles();
    expect(effectCallbacks.length).toBe(1);
  });
});
