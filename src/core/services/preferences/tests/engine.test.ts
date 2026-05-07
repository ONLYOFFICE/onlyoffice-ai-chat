import { describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "../../../storage";
import { PreferencesEngine } from "../engine";
import { DEFAULT_PREFERENCES } from "../types";

function makeStorage(seed: {
  deepMode?: boolean | null;
  /** Per-entity override map. */
  entityDeepMode?: Record<string, boolean | null>;
} = {}) {
  let stored: boolean | null = seed.deepMode ?? null;
  const entityStored: Record<string, boolean | null> = {
    ...(seed.entityDeepMode ?? {}),
  };
  const storage = {
    preferences: {
      readDeepMode: vi.fn(async (entityId?: string) =>
        entityId !== undefined ? (entityStored[entityId] ?? null) : stored
      ),
      upsertDeepMode: vi.fn(async (v: boolean, entityId?: string) => {
        if (entityId !== undefined) entityStored[entityId] = v;
        else stored = v;
      }),
      deleteDeepMode: vi.fn(async (entityId?: string) => {
        if (entityId !== undefined) delete entityStored[entityId];
        else stored = null;
      }),
    },
  } as unknown as StorageAdapter;
  return {
    storage,
    get current() {
      return stored;
    },
    entityStored,
  };
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
    expect(storage.preferences.upsertDeepMode).toHaveBeenCalledWith(
      true,
      undefined
    );
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

describe("PreferencesEngine entity scope", () => {
  it("forwards entityId to readDeepMode", async () => {
    const { storage } = makeStorage();
    const engine = new PreferencesEngine({ storage });
    await engine.getDeepMode("e1");
    expect(storage.preferences.readDeepMode).toHaveBeenCalledWith("e1");
  });

  it("forwards entityId to upsertDeepMode", async () => {
    const { storage } = makeStorage();
    const engine = new PreferencesEngine({ storage });
    await engine.setDeepMode(true, "e1");
    expect(storage.preferences.upsertDeepMode).toHaveBeenCalledWith(
      true,
      "e1"
    );
  });

  it("forwards entityId to deleteDeepMode", async () => {
    const { storage } = makeStorage({
      entityDeepMode: { e1: true },
    });
    const engine = new PreferencesEngine({ storage });
    await engine.clearDeepMode("e1");
    expect(storage.preferences.deleteDeepMode).toHaveBeenCalledWith("e1");
  });

  it("returns the entity-specific value when storage scopes by entityId", async () => {
    const { storage } = makeStorage({
      deepMode: false,
      entityDeepMode: { e1: true },
    });
    const engine = new PreferencesEngine({ storage });
    expect(await engine.getDeepMode()).toBe(false);
    expect(await engine.getDeepMode("e1")).toBe(true);
  });

  it("isDeepModeSet honors entity scope", async () => {
    const { storage } = makeStorage({
      entityDeepMode: { e1: false },
    });
    const engine = new PreferencesEngine({ storage });
    expect(await engine.isDeepModeSet()).toBe(false);
    expect(await engine.isDeepModeSet("e1")).toBe(true);
    expect(await engine.isDeepModeSet("e2")).toBe(false);
  });
});
