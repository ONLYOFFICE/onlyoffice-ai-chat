import { describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "../../../storage";
import { PreferencesEngine } from "../engine";
import { DEFAULT_PREFERENCES } from "../types";

function makeStorage(seed: { deepMode?: boolean | null } = {}) {
  let stored: boolean | null = seed.deepMode ?? null;
  const storage = {
    preferences: {
      readDeepMode: vi.fn(async () => stored),
      upsertDeepMode: vi.fn(async (v: boolean) => {
        stored = v;
      }),
      deleteDeepMode: vi.fn(async () => {
        stored = null;
      }),
    },
  } as unknown as StorageAdapter;
  return { storage, get current() { return stored; } };
}

describe("DEFAULT_PREFERENCES", () => {
  it("has deepMode default of false", () => {
    expect(DEFAULT_PREFERENCES.deepMode).toBe(false);
  });
});

describe("PreferencesEngine.getDeepMode", () => {
  it("returns the persisted value when set", async () => {
    const { storage } = makeStorage({ deepMode: true });
    const engine = new PreferencesEngine({ storage });
    expect(await engine.getDeepMode()).toBe(true);
  });

  it("returns the default when never set", async () => {
    const { storage } = makeStorage();
    const engine = new PreferencesEngine({ storage });
    expect(await engine.getDeepMode()).toBe(false);
  });

  it("uses caller-supplied default override when never set", async () => {
    const { storage } = makeStorage();
    const engine = new PreferencesEngine({ storage }, { deepMode: true });
    expect(await engine.getDeepMode()).toBe(true);
  });
});

describe("PreferencesEngine.setDeepMode", () => {
  it("writes via upsertDeepMode and round-trips through getter", async () => {
    const { storage } = makeStorage();
    const engine = new PreferencesEngine({ storage });
    await engine.setDeepMode(true);
    expect(storage.preferences.upsertDeepMode).toHaveBeenCalledWith(true);
    expect(await engine.getDeepMode()).toBe(true);
  });
});

describe("PreferencesEngine.clearDeepMode", () => {
  it("clears the stored value", async () => {
    const { storage } = makeStorage({ deepMode: true });
    const engine = new PreferencesEngine({ storage });
    await engine.clearDeepMode();
    expect(storage.preferences.deleteDeepMode).toHaveBeenCalled();
    expect(await engine.getDeepMode()).toBe(false);
  });
});

describe("PreferencesEngine.isDeepModeSet", () => {
  it("is true when value is persisted (even false)", async () => {
    const { storage } = makeStorage({ deepMode: false });
    const engine = new PreferencesEngine({ storage });
    expect(await engine.isDeepModeSet()).toBe(true);
  });

  it("is false when never set", async () => {
    const { storage } = makeStorage();
    const engine = new PreferencesEngine({ storage });
    expect(await engine.isDeepModeSet()).toBe(false);
  });
});
