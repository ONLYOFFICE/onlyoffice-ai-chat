import { describe, expect, it, vi } from "vitest";
import { ActionType } from "../../../../shared/action-type";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import type { Profile } from "../../../types";
import type { StorageAdapter } from "../../../storage";
import { AssignmentsEngine } from "../engine";

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "p1",
    name: "P1",
    providerType: "x",
    baseUrl: "u",
    modelId: "m",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Vision,
    ...overrides,
  };
}

function makeStorage(seed: {
  profiles?: Profile[];
  assignments?: Partial<Record<ActionType, string>>;
  /**
   * Per-entity overrides. When `readByType` is called with an `entityId`
   * matching a key here, returns the inner action-type → profileId map
   * instead of the global one. Mirrors the typical host implementation
   * where each entity persists its own chat profile.
   */
  entityAssignments?: Record<string, Partial<Record<ActionType, string>>>;
} = {}) {
  let profiles = [...(seed.profiles ?? [])];
  let assignments: Partial<Record<ActionType, string>> = {
    ...(seed.assignments ?? {}),
  };
  const entityAssignments = { ...(seed.entityAssignments ?? {}) };

  const storage = {
    profiles: {
      readById: vi.fn(async (id: string) => profiles.find((p) => p.id === id)),
      readAll: vi.fn(async () => [...profiles]),
      delete: vi.fn(async (id: string) => {
        profiles = profiles.filter((p) => p.id !== id);
      }),
    },
    assignments: {
      readByType: vi.fn(async (t: ActionType, entityId?: string) => {
        if (entityId !== undefined && entityAssignments[entityId]) {
          const scoped = entityAssignments[entityId][t];
          if (scoped !== undefined) return scoped;
        }
        return assignments[t] ?? null;
      }),
      readAll: vi.fn(async () => ({ ...assignments })),
      update: vi.fn(async (t: ActionType, id: string) => {
        assignments[t] = id;
      }),
      delete: vi.fn(async (t: ActionType) => {
        delete assignments[t];
      }),
      deleteMany: vi.fn(async (ts: ActionType[]) => {
        for (const t of ts) delete assignments[t];
      }),
      upsertMany: vi.fn(
        async (m: Partial<Record<ActionType, string>>) => {
          assignments = { ...assignments, ...m };
        }
      ),
    },
  } as unknown as StorageAdapter;

  return {
    storage,
    snapshot: () => ({ assignments: { ...assignments } }),
    setAssignments: (next: Partial<Record<ActionType, string>>) => {
      assignments = next;
    },
  };
}

describe("AssignmentsEngine.resolveForAction", () => {
  it("returns the assigned profile when slot is set", async () => {
    const profile = makeProfile();
    const { storage } = makeStorage({
      profiles: [profile],
      assignments: { [ActionType.Chat]: profile.id },
    });
    const engine = new AssignmentsEngine({ storage });
    const result = await engine.resolveForAction(ActionType.Chat);
    expect(result.profileId).toBe(profile.id);
    expect(result.profile).toBe(profile);
  });

  it("falls back to Default when slot is empty", async () => {
    const profile = makeProfile({ id: "default" });
    const { storage } = makeStorage({
      profiles: [profile],
      assignments: { [ActionType.Default]: profile.id },
    });
    const engine = new AssignmentsEngine({ storage });
    const result = await engine.resolveForAction(ActionType.Chat);
    expect(result.profileId).toBe(profile.id);
  });

  it("throws when neither slot is set", async () => {
    const { storage } = makeStorage();
    const engine = new AssignmentsEngine({ storage });
    await expect(engine.resolveForAction(ActionType.Chat)).rejects.toThrow(
      /No profile assigned to ActionType.Chat/
    );
  });

  it("throws when the assigned profile is missing", async () => {
    const { storage } = makeStorage({
      assignments: { [ActionType.Chat]: "ghost" },
    });
    const engine = new AssignmentsEngine({ storage });
    await expect(engine.resolveForAction(ActionType.Chat)).rejects.toThrow(
      "Assigned profile not found: ghost"
    );
  });

  it("tryResolveForAction returns null instead of throwing on missing slot", async () => {
    const { storage } = makeStorage();
    const engine = new AssignmentsEngine({ storage });
    expect(await engine.tryResolveForAction(ActionType.Chat)).toBeNull();
  });
});

describe("AssignmentsEngine entity scope", () => {
  it("forwards entityId to storage.assignments.readByType", async () => {
    const profile = makeProfile();
    const { storage } = makeStorage({
      profiles: [profile],
      assignments: { [ActionType.Chat]: profile.id },
    });
    const engine = new AssignmentsEngine({ storage });
    await engine.resolveForAction(ActionType.Chat, "e1");
    expect(storage.assignments.readByType).toHaveBeenCalledWith(
      ActionType.Chat,
      "e1"
    );
  });

  it("returns the entity-specific profile when storage scopes by entityId", async () => {
    const global = makeProfile({ id: "global" });
    const room = makeProfile({ id: "room" });
    const { storage } = makeStorage({
      profiles: [global, room],
      assignments: { [ActionType.Chat]: global.id },
      entityAssignments: { e1: { [ActionType.Chat]: room.id } },
    });
    const engine = new AssignmentsEngine({ storage });

    const unscoped = await engine.resolveForAction(ActionType.Chat);
    expect(unscoped.profileId).toBe(global.id);

    const scoped = await engine.resolveForAction(ActionType.Chat, "e1");
    expect(scoped.profileId).toBe(room.id);
  });

  it("throws when entity-specific profile id points at a missing profile", async () => {
    const global = makeProfile({ id: "global" });
    const { storage } = makeStorage({
      profiles: [global],
      assignments: { [ActionType.Chat]: global.id },
      entityAssignments: { e1: { [ActionType.Chat]: "ghost" } },
    });
    const engine = new AssignmentsEngine({ storage });
    await expect(
      engine.resolveForAction(ActionType.Chat, "e1")
    ).rejects.toThrow("Assigned profile not found: ghost");
  });

  it("tryResolveForAction returns the entity-specific profile when storage scopes", async () => {
    const room = makeProfile({ id: "room" });
    const { storage } = makeStorage({
      profiles: [room],
      entityAssignments: { e1: { [ActionType.Chat]: room.id } },
    });
    const engine = new AssignmentsEngine({ storage });
    const result = await engine.tryResolveForAction(ActionType.Chat, "e1");
    expect(result?.profileId).toBe(room.id);
  });

  it("falls back to the unscoped Default lookup when the entity has no specific binding", async () => {
    const fallback = makeProfile({ id: "fallback" });
    const { storage } = makeStorage({
      profiles: [fallback],
      assignments: { [ActionType.Default]: fallback.id },
    });
    const engine = new AssignmentsEngine({ storage });
    const result = await engine.resolveForAction(ActionType.Chat, "e1");
    expect(result.profileId).toBe(fallback.id);
  });
});

describe("AssignmentsEngine.assign", () => {
  it("returns Profile not found when id is missing", async () => {
    const { storage } = makeStorage();
    const engine = new AssignmentsEngine({ storage });
    const result = await engine.assign(ActionType.Chat, "ghost");
    expect(result.success).toBe(false);
  });

  it("rejects assignment when capability bits are missing", async () => {
    const profile = makeProfile({ capabilities: CapabilitiesUI.Chat });
    const { storage } = makeStorage({ profiles: [profile] });
    const engine = new AssignmentsEngine({ storage });
    const result = await engine.assign(ActionType.Vision, profile.id);
    expect(result.success).toBe(false);
    if (result.success) throw new Error();
    expect(result.error.message).toMatch(/lacks capabilities/);
  });

  it("persists when validation passes", async () => {
    const profile = makeProfile();
    const { storage, snapshot } = makeStorage({ profiles: [profile] });
    const engine = new AssignmentsEngine({ storage });
    const result = await engine.assign(ActionType.Vision, profile.id);
    expect(result.success).toBe(true);
    expect(snapshot().assignments[ActionType.Vision]).toBe(profile.id);
  });

  it("Default slot bypasses capability checks", async () => {
    const profile = makeProfile({ capabilities: 0 });
    const { storage } = makeStorage({ profiles: [profile] });
    const engine = new AssignmentsEngine({ storage });
    const result = await engine.assign(ActionType.Default, profile.id);
    expect(result.success).toBe(true);
  });
});

describe("AssignmentsEngine.unassign", () => {
  it("delegates to storage.assignments.delete", async () => {
    const { storage } = makeStorage();
    const engine = new AssignmentsEngine({ storage });
    await engine.unassign(ActionType.Chat);
    expect(storage.assignments.delete).toHaveBeenCalledWith(ActionType.Chat);
  });
});

describe("AssignmentsEngine.bulkAssign", () => {
  it("writes nothing when any entry fails", async () => {
    const ok = makeProfile({ id: "ok" });
    const noVision = makeProfile({ id: "nv", capabilities: CapabilitiesUI.Chat });
    const { storage, snapshot } = makeStorage({ profiles: [ok, noVision] });
    const engine = new AssignmentsEngine({ storage });
    const result = await engine.bulkAssign({
      [ActionType.Chat]: "ok",
      [ActionType.Vision]: "nv",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error();
    expect(result.errors[0].actionType).toBe(ActionType.Vision);
    expect(snapshot().assignments).toEqual({});
  });

  it("reports missing-profile error when an id is unknown", async () => {
    const { storage } = makeStorage();
    const engine = new AssignmentsEngine({ storage });
    const result = await engine.bulkAssign({
      [ActionType.Chat]: "ghost",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error();
    expect(result.errors[0].error.message).toMatch(/not found: ghost/);
  });

  it("persists every entry when all are valid", async () => {
    const a = makeProfile({ id: "a" });
    const b = makeProfile({ id: "b" });
    const { storage, snapshot } = makeStorage({ profiles: [a, b] });
    const engine = new AssignmentsEngine({ storage });
    const result = await engine.bulkAssign({
      [ActionType.Chat]: "a",
      [ActionType.Vision]: "b",
    });
    expect(result.success).toBe(true);
    expect(snapshot().assignments).toEqual({
      [ActionType.Chat]: "a",
      [ActionType.Vision]: "b",
    });
  });
});

describe("AssignmentsEngine getters", () => {
  it("getAssignment proxies to storage.readByType", async () => {
    const { storage } = makeStorage({
      assignments: { [ActionType.Chat]: "x" },
    });
    const engine = new AssignmentsEngine({ storage });
    expect(await engine.getAssignment(ActionType.Chat)).toBe("x");
    expect(await engine.getAssignment(ActionType.Vision)).toBeNull();
  });

  it("getAllAssignments proxies to storage.readAll", async () => {
    const { storage } = makeStorage({
      assignments: { [ActionType.Chat]: "x", [ActionType.Default]: "y" },
    });
    const engine = new AssignmentsEngine({ storage });
    expect(await engine.getAllAssignments()).toEqual({
      [ActionType.Chat]: "x",
      [ActionType.Default]: "y",
    });
  });
});

describe("AssignmentsEngine.cascadeProfileDelete", () => {
  it("promotes the next profile to Default when deleting the current default", async () => {
    const a = makeProfile({ id: "a" });
    const b = makeProfile({ id: "b" });
    const { storage, snapshot } = makeStorage({
      profiles: [a, b],
      assignments: { [ActionType.Default]: "a" },
    });
    const engine = new AssignmentsEngine({ storage });
    await engine.cascadeProfileDelete("a");
    expect(snapshot().assignments[ActionType.Default]).toBe("b");
  });

  it("clears Default when no other profile remains", async () => {
    const a = makeProfile({ id: "a" });
    const { storage, snapshot } = makeStorage({
      profiles: [a],
      assignments: { [ActionType.Default]: "a" },
    });
    const engine = new AssignmentsEngine({ storage });
    await engine.cascadeProfileDelete("a");
    expect(snapshot().assignments[ActionType.Default]).toBeUndefined();
  });

  it("removes orphaned per-action slots without auto-fallback", async () => {
    const a = makeProfile({ id: "a" });
    const { storage, snapshot } = makeStorage({
      profiles: [a],
      assignments: {
        [ActionType.Chat]: "a",
        [ActionType.Vision]: "a",
      },
    });
    const engine = new AssignmentsEngine({ storage });
    await engine.cascadeProfileDelete("a");
    expect(snapshot().assignments).toEqual({});
  });

  it("does nothing when the profile is not assigned anywhere", async () => {
    const a = makeProfile({ id: "a" });
    const b = makeProfile({ id: "b" });
    const { storage } = makeStorage({
      profiles: [a, b],
      assignments: { [ActionType.Default]: "b" },
    });
    const engine = new AssignmentsEngine({ storage });
    await engine.cascadeProfileDelete("a");
    expect(storage.assignments.update).not.toHaveBeenCalled();
    expect(storage.assignments.delete).not.toHaveBeenCalled();
    expect(storage.assignments.deleteMany).not.toHaveBeenCalled();
  });
});
