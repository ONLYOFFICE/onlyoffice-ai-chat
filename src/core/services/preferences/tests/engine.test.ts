import { describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "../../../storage";
import { PreferencesEngine } from "../engine";
import { DEFAULT_PREFERENCES } from "../types";

function makeStorage(
  seed: {
    deepMode?: boolean | null;
    /** Per-entity override map. */
    entityDeepMode?: Record<string, boolean | null>;
  } = {}
) {
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
    expect(storage.preferences.upsertDeepMode).toHaveBeenCalledWith(true, "e1");
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

describe("PreferencesEngine reasoning level", () => {
  function makeLevelStorage(seed: {
    deepMode?: boolean | null;
    level?: string | null;
    withLevelMethods?: boolean;
  }) {
    let deep: boolean | null = seed.deepMode ?? null;
    let level: string | null = seed.level ?? null;
    const preferences: Record<string, unknown> = {
      readDeepMode: vi.fn(async () => deep),
      upsertDeepMode: vi.fn(async (v: boolean) => {
        deep = v;
      }),
    };
    if (seed.withLevelMethods !== false) {
      preferences.readReasoningLevel = vi.fn(async () => level);
      preferences.upsertReasoningLevel = vi.fn(async (v: string) => {
        level = v;
      });
    }
    return {
      storage: { preferences } as unknown as StorageAdapter,
      get deep() {
        return deep;
      },
      get level() {
        return level;
      },
    };
  }

  it("is off whenever deep mode is off, whatever depth was stored", async () => {
    const s = makeLevelStorage({ deepMode: false, level: "high" });
    expect(
      await new PreferencesEngine({ storage: s.storage }).getReasoningLevel()
    ).toBe("off");
  });

  it("returns the stored depth while deep mode is on", async () => {
    const s = makeLevelStorage({ deepMode: true, level: "high" });
    expect(
      await new PreferencesEngine({ storage: s.storage }).getReasoningLevel()
    ).toBe("high");
  });

  it("falls back to the default depth when none is stored or the adapter has no depth methods", async () => {
    const a = makeLevelStorage({ deepMode: true });
    expect(
      await new PreferencesEngine({ storage: a.storage }).getReasoningLevel()
    ).toBe(DEFAULT_PREFERENCES.reasoningLevel);
    const b = makeLevelStorage({ deepMode: true, withLevelMethods: false });
    expect(
      await new PreferencesEngine(
        { storage: b.storage },
        {
          reasoningLevel: "low",
        }
      ).getReasoningLevel()
    ).toBe("low");
  });

  it("setReasoningLevel keeps the toggle and the depth in sync", async () => {
    const s = makeLevelStorage({});
    const engine = new PreferencesEngine({ storage: s.storage });
    await engine.setReasoningLevel("max", "room-1");
    expect(s.storage.preferences.upsertDeepMode).toHaveBeenCalledWith(
      true,
      "room-1"
    );
    expect(s.storage.preferences.upsertReasoningLevel).toHaveBeenCalledWith(
      "max",
      "room-1"
    );
    expect(await engine.getReasoningLevel("room-1")).toBe("max");
  });

  it("off clears the toggle but remembers the depth for the next on", async () => {
    const s = makeLevelStorage({});
    const engine = new PreferencesEngine({ storage: s.storage });
    await engine.setReasoningLevel("high");
    await engine.setReasoningLevel("off");
    expect(s.deep).toBe(false);
    expect(s.level).toBe("high");
    await engine.setDeepMode(true);
    expect(await engine.getReasoningLevel()).toBe("high");
  });

  it("setReasoningLevel still lands the toggle on adapters without depth methods", async () => {
    const s = makeLevelStorage({ withLevelMethods: false });
    await new PreferencesEngine({ storage: s.storage }).setReasoningLevel(
      "low"
    );
    expect(s.deep).toBe(true);
  });
});

describe("PreferencesEngine tool permission mode", () => {
  function makeModeStorage(seed: {
    mode?: string | null;
    withModeMethods?: boolean;
  }) {
    let mode: string | null = seed.mode ?? null;
    const preferences: Record<string, unknown> = {
      readDeepMode: vi.fn(async () => null),
      upsertDeepMode: vi.fn(async () => undefined),
    };
    if (seed.withModeMethods !== false) {
      preferences.readToolPermissionMode = vi.fn(async () => mode);
      preferences.upsertToolPermissionMode = vi.fn(async (v: string) => {
        mode = v;
      });
    }
    return {
      storage: { preferences } as unknown as StorageAdapter,
      preferences,
      get mode() {
        return mode;
      },
    };
  }

  it("defaults to auto approve", () => {
    expect(DEFAULT_PREFERENCES.toolPermissionMode).toBe("auto");
  });

  it("returns the stored mode", async () => {
    const s = makeModeStorage({ mode: "allow" });
    const engine = new PreferencesEngine({ storage: s.storage });
    expect(await engine.getToolPermissionMode()).toBe("allow");
  });

  it("falls back to the default when none is stored or the adapter has no mode methods", async () => {
    const none = new PreferencesEngine({
      storage: makeModeStorage({ mode: null }).storage,
    });
    expect(await none.getToolPermissionMode()).toBe("auto");
    const legacy = new PreferencesEngine(
      { storage: makeModeStorage({ withModeMethods: false }).storage },
      { toolPermissionMode: "ask" }
    );
    expect(await legacy.getToolPermissionMode()).toBe("ask");
  });

  it("setToolPermissionMode round-trips and forwards the entity", async () => {
    const s = makeModeStorage({});
    const engine = new PreferencesEngine({ storage: s.storage });
    await engine.setToolPermissionMode("auto", "room-1");
    expect(s.preferences.upsertToolPermissionMode).toHaveBeenCalledWith(
      "auto",
      "room-1"
    );
    expect(await engine.getToolPermissionMode("room-1")).toBe("auto");
    expect(s.preferences.readToolPermissionMode).toHaveBeenCalledWith("room-1");
  });

  it("setToolPermissionMode is a no-op on adapters without mode methods", async () => {
    const s = makeModeStorage({ withModeMethods: false });
    const engine = new PreferencesEngine({ storage: s.storage });
    await expect(
      engine.setToolPermissionMode("allow")
    ).resolves.toBeUndefined();
  });
});
