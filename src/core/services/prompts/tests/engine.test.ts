import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prompt, PromptFolder } from "../../../types";
import type { StorageAdapter } from "../../../storage";
import { PromptsEngine } from "../engine";
import type { PromptBundle } from "../types";

let uuidCount = 0;
function nextUuid(): `${string}-${string}-${string}-${string}-${string}` {
  uuidCount += 1;
  return `00000000-0000-0000-0000-${String(uuidCount).padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`;
}

function makeStorage(
  seed: {
    prompts?: Prompt[];
    folders?: PromptFolder[];
  } = {}
) {
  let prompts: Prompt[] = [...(seed.prompts ?? [])];
  let folders: PromptFolder[] = [...(seed.folders ?? [])];

  const storage = {
    prompts: {
      create: vi.fn(
        async (
          input: Omit<Prompt, "id" | "createdAt" | "updatedAt">
        ): Promise<Prompt> => {
          const now = Date.now();
          const p: Prompt = {
            ...input,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          };
          prompts.push(p);
          return p;
        }
      ),
      createMany: vi.fn(
        async (
          inputs: Omit<Prompt, "id" | "createdAt" | "updatedAt">[]
        ): Promise<Prompt[]> => {
          const now = Date.now();
          const persisted: Prompt[] = inputs.map((input) => ({
            ...input,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          }));
          prompts = [...prompts, ...persisted];
          return persisted;
        }
      ),
      readById: vi.fn(
        async (id: string) => prompts.find((p) => p.id === id) ?? null
      ),
      readAll: vi.fn(async () => [...prompts]),
      readByFolderId: vi.fn(async (folderId: string | null) =>
        prompts.filter((p) => (p.folderId ?? null) === folderId)
      ),
      update: vi.fn(
        async (
          id: string,
          updates: { name?: string; text?: string; folderId?: string | null }
        ) => {
          const i = prompts.findIndex((p) => p.id === id);
          if (i < 0) return;
          prompts[i] = {
            ...prompts[i],
            ...updates,
            folderId:
              updates.folderId === null
                ? undefined
                : (updates.folderId ?? prompts[i].folderId),
            updatedAt: Date.now(),
          };
        }
      ),
      delete: vi.fn(async (id: string) => {
        prompts = prompts.filter((p) => p.id !== id);
      }),
      deleteByFolder: vi.fn(async (folderId: string) => {
        prompts = prompts.filter((p) => p.folderId !== folderId);
      }),
    },
    promptFolders: {
      create: vi.fn(
        async (
          input: Omit<PromptFolder, "id" | "createdAt" | "updatedAt">
        ): Promise<PromptFolder> => {
          const now = Date.now();
          const f: PromptFolder = {
            ...input,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          };
          folders.push(f);
          return f;
        }
      ),
      createMany: vi.fn(
        async (
          inputs: Omit<PromptFolder, "id" | "createdAt" | "updatedAt">[]
        ): Promise<PromptFolder[]> => {
          const now = Date.now();
          const persisted: PromptFolder[] = inputs.map((input) => ({
            ...input,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          }));
          folders = [...folders, ...persisted];
          return persisted;
        }
      ),
      readById: vi.fn(
        async (id: string) => folders.find((f) => f.id === id) ?? null
      ),
      readAll: vi.fn(async () => [...folders]),
      update: vi.fn(async (id: string, name: string) => {
        const f = folders.find((f) => f.id === id);
        if (f) f.name = name;
      }),
      delete: vi.fn(async (id: string) => {
        folders = folders.filter((f) => f.id !== id);
        prompts = prompts.filter((p) => p.folderId !== id);
      }),
    },
  } as unknown as StorageAdapter;

  return {
    storage,
    snapshot: () => ({ prompts: [...prompts], folders: [...folders] }),
    setPrompts: (p: Prompt[]) => {
      prompts = p;
    },
  };
}

beforeEach(() => {
  uuidCount = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(nextUuid);
  vi.spyOn(Date, "now").mockReturnValue(1000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PromptsEngine.create", () => {
  it("rejects bad folder reference", async () => {
    const { storage } = makeStorage();
    const engine = new PromptsEngine({ storage });
    const result = await engine.create({
      name: "X",
      text: "T",
      folderId: "missing",
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate name in same folder scope", async () => {
    const existing: Prompt = {
      id: "p1",
      name: "X",
      text: "",
      createdAt: 1,
      updatedAt: 1,
    };
    const { storage } = makeStorage({ prompts: [existing] });
    const engine = new PromptsEngine({ storage });
    const result = await engine.create({ name: "X", text: "T" });
    expect(result.success).toBe(false);
  });

  it("persists the prompt with generated id and timestamps", async () => {
    const { storage, snapshot } = makeStorage();
    const engine = new PromptsEngine({ storage });
    const result = await engine.create({ name: "X", text: "T" });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error();
    expect(result.prompt.id).toBeDefined();
    expect(result.prompt.createdAt).toBe(1000);
    expect(snapshot().prompts).toHaveLength(1);
  });

  it("treats null folderId as root", async () => {
    const { storage, snapshot } = makeStorage();
    const engine = new PromptsEngine({ storage });
    const r = await engine.create({ name: "X", text: "T", folderId: null });
    expect(r.success).toBe(true);
    expect(snapshot().prompts[0].folderId).toBeUndefined();
  });
});

describe("PromptsEngine.update", () => {
  const existing: Prompt = {
    id: "p1",
    name: "Old",
    text: "T",
    createdAt: 1,
    updatedAt: 1,
  };

  it("returns 'Prompt not found' when id missing", async () => {
    const { storage } = makeStorage();
    const engine = new PromptsEngine({ storage });
    const r = await engine.update("missing", { name: "X" });
    expect(r.success).toBe(false);
  });

  it("validates folder reference when changing folderId to non-null", async () => {
    const { storage } = makeStorage({ prompts: [existing] });
    const engine = new PromptsEngine({ storage });
    const r = await engine.update("p1", { folderId: "missing" });
    expect(r.success).toBe(false);
  });

  it("allows clearing folder via null", async () => {
    const { storage } = makeStorage({
      prompts: [{ ...existing, folderId: "f1" }],
      folders: [{ id: "f1", name: "F", createdAt: 1, updatedAt: 1 }],
    });
    const engine = new PromptsEngine({ storage });
    const r = await engine.update("p1", { folderId: null });
    expect(r.success).toBe(true);
  });

  it("rejects new name colliding within target folder", async () => {
    const a: Prompt = {
      id: "a",
      name: "X",
      text: "",
      folderId: "f1",
      createdAt: 1,
      updatedAt: 1,
    };
    const b: Prompt = {
      id: "b",
      name: "Y",
      text: "",
      folderId: "f1",
      createdAt: 1,
      updatedAt: 1,
    };
    const { storage } = makeStorage({
      prompts: [a, b],
      folders: [{ id: "f1", name: "F", createdAt: 1, updatedAt: 1 }],
    });
    const engine = new PromptsEngine({ storage });
    const r = await engine.update("b", { name: "X" });
    expect(r.success).toBe(false);
  });

  it("returns the updated prompt on success", async () => {
    const { storage } = makeStorage({ prompts: [existing] });
    const engine = new PromptsEngine({ storage });
    const r = await engine.update("p1", { name: "New", text: "Updated" });
    expect(r.success).toBe(true);
    if (!r.success) throw new Error();
    expect(r.prompt.name).toBe("New");
    expect(r.prompt.text).toBe("Updated");
  });

  it("throws when prompt disappears mid-update", async () => {
    const seedStorage = makeStorage({ prompts: [existing] });
    const { storage } = seedStorage;
    storage.prompts.update = vi.fn(async () => {
      seedStorage.setPrompts([]);
    });
    const engine = new PromptsEngine({ storage });
    await expect(engine.update("p1", { name: "Whatever" })).rejects.toThrow(
      /disappeared/
    );
  });
});

describe("PromptsEngine.move", () => {
  it("delegates to update with the new folderId", async () => {
    const existing: Prompt = {
      id: "p1",
      name: "X",
      text: "",
      createdAt: 1,
      updatedAt: 1,
    };
    const { storage } = makeStorage({
      prompts: [existing],
      folders: [{ id: "f1", name: "F", createdAt: 1, updatedAt: 1 }],
    });
    const engine = new PromptsEngine({ storage });
    const r = await engine.move("p1", "f1");
    expect(r.success).toBe(true);
  });
});

describe("PromptsEngine.delete + list", () => {
  it("deletes by id", async () => {
    const { storage } = makeStorage({
      prompts: [{ id: "p1", name: "X", text: "", createdAt: 1, updatedAt: 1 }],
    });
    const engine = new PromptsEngine({ storage });
    await engine.delete("p1");
    expect(storage.prompts.delete).toHaveBeenCalledWith("p1");
  });

  it("list() with no arg returns all", async () => {
    const { storage } = makeStorage({
      prompts: [{ id: "a", name: "A", text: "", createdAt: 1, updatedAt: 1 }],
    });
    const engine = new PromptsEngine({ storage });
    expect(await engine.list()).toHaveLength(1);
  });

  it("list(folderId) scopes the read", async () => {
    const { storage } = makeStorage({
      prompts: [
        { id: "a", name: "A", text: "", createdAt: 1, updatedAt: 1 },
        {
          id: "b",
          name: "B",
          text: "",
          folderId: "f1",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const engine = new PromptsEngine({ storage });
    expect(await engine.list(null)).toHaveLength(1);
    expect(await engine.list("f1")).toHaveLength(1);
  });
});

describe("PromptsEngine folder CRUD", () => {
  it("createFolder validates name and persists", async () => {
    const { storage, snapshot } = makeStorage();
    const engine = new PromptsEngine({ storage });
    const bad = await engine.createFolder("");
    expect(bad.success).toBe(false);
    const ok = await engine.createFolder("F");
    expect(ok.success).toBe(true);
    expect(snapshot().folders).toHaveLength(1);
  });

  it("renameFolder rejects missing ids", async () => {
    const { storage } = makeStorage();
    const engine = new PromptsEngine({ storage });
    const r = await engine.renameFolder("missing", "X");
    expect(r.success).toBe(false);
  });

  it("renameFolder rejects duplicate names", async () => {
    const { storage } = makeStorage({
      folders: [
        { id: "a", name: "A", createdAt: 1, updatedAt: 1 },
        { id: "b", name: "B", createdAt: 1, updatedAt: 1 },
      ],
    });
    const engine = new PromptsEngine({ storage });
    const r = await engine.renameFolder("b", "A");
    expect(r.success).toBe(false);
  });

  it("renameFolder persists when valid and returns the updated folder", async () => {
    const { storage } = makeStorage({
      folders: [{ id: "a", name: "A", createdAt: 1, updatedAt: 1 }],
    });
    const engine = new PromptsEngine({ storage });
    const r = await engine.renameFolder("a", "Renamed");
    expect(r.success).toBe(true);
    if (!r.success) throw new Error();
    expect(r.folder.name).toBe("Renamed");
  });

  it("renameFolder throws when folder disappears mid-rename", async () => {
    const { storage } = makeStorage({
      folders: [{ id: "a", name: "A", createdAt: 1, updatedAt: 1 }],
    });
    storage.promptFolders.readById = vi.fn(async () => null);
    const engine = new PromptsEngine({ storage });
    await expect(engine.renameFolder("a", "X")).rejects.toThrow(/disappeared/);
  });

  it("deleteFolder + listFolders pass through", async () => {
    const { storage } = makeStorage({
      folders: [{ id: "a", name: "A", createdAt: 1, updatedAt: 1 }],
    });
    const engine = new PromptsEngine({ storage });
    expect(await engine.listFolders()).toHaveLength(1);
    await engine.deleteFolder("a");
    expect(storage.promptFolders.delete).toHaveBeenCalledWith("a");
  });
});

describe("PromptsEngine import / export", () => {
  it("exports both folders and prompts", async () => {
    const { storage } = makeStorage({
      prompts: [{ id: "p1", name: "X", text: "T", createdAt: 1, updatedAt: 1 }],
      folders: [{ id: "f1", name: "F", createdAt: 1, updatedAt: 1 }],
    });
    const engine = new PromptsEngine({ storage });
    const bundle = await engine.export();
    expect(bundle.version).toBe(1);
    expect(bundle.folders).toHaveLength(1);
    expect(bundle.prompts).toHaveLength(1);
  });

  it("rejects unsupported bundle version", async () => {
    const { storage } = makeStorage();
    const engine = new PromptsEngine({ storage });
    const result = await engine.importBundle({
      version: 2 as unknown as 1,
      folders: [],
      prompts: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects bundle with dangling prompt.folderId references", async () => {
    const bundle: PromptBundle = {
      version: 1,
      folders: [],
      prompts: [
        {
          id: "p1",
          name: "X",
          text: "",
          folderId: "missing",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    };
    const { storage } = makeStorage();
    const engine = new PromptsEngine({ storage });
    const result = await engine.importBundle(bundle);
    expect(result.success).toBe(false);
    if (result.success) throw new Error();
    expect(result.errors[0].kind).toBe("prompt");
  });

  it("replace mode wipes existing data and writes the bundle", async () => {
    const { storage, snapshot } = makeStorage({
      prompts: [
        { id: "p-old", name: "Old", text: "", createdAt: 1, updatedAt: 1 },
      ],
      folders: [{ id: "f-old", name: "OldF", createdAt: 1, updatedAt: 1 }],
    });
    const engine = new PromptsEngine({ storage });
    const result = await engine.importBundle({
      version: 1,
      folders: [{ id: "f-new", name: "NewF", createdAt: 1, updatedAt: 1 }],
      prompts: [
        {
          id: "p-new",
          name: "New",
          text: "",
          folderId: "f-new",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error();
    expect(result.imported).toEqual({ folders: 1, prompts: 1 });
    const snap = snapshot();
    expect(snap.folders.map((f) => f.name)).toEqual(["NewF"]);
    expect(snap.prompts.map((p) => p.name)).toEqual(["New"]);
    // Old entries gone
    expect(snap.folders.some((f) => f.name === "OldF")).toBe(false);
    expect(snap.prompts.some((p) => p.name === "Old")).toBe(false);
  });

  it("replace mode remaps prompt.folderId to storage-assigned folder ids", async () => {
    const { storage, snapshot } = makeStorage();
    const engine = new PromptsEngine({ storage });
    const result = await engine.importBundle({
      version: 1,
      folders: [
        { id: "bundle-f1", name: "F1", createdAt: 1, updatedAt: 1 },
        { id: "bundle-f2", name: "F2", createdAt: 1, updatedAt: 1 },
      ],
      prompts: [
        {
          id: "bundle-p1",
          name: "P1",
          text: "T1",
          folderId: "bundle-f1",
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "bundle-p2",
          name: "P2",
          text: "T2",
          folderId: "bundle-f2",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    expect(result.success).toBe(true);
    const snap = snapshot();
    const f1 = snap.folders.find((f) => f.name === "F1");
    const f2 = snap.folders.find((f) => f.name === "F2");
    const p1 = snap.prompts.find((p) => p.name === "P1");
    const p2 = snap.prompts.find((p) => p.name === "P2");
    expect(f1).toBeDefined();
    expect(f2).toBeDefined();
    // Prompt folderId points at the freshly-minted folder ids, not the
    // bundle ones.
    expect(p1?.folderId).toBe(f1!.id);
    expect(p2?.folderId).toBe(f2!.id);
    expect(p1?.folderId).not.toBe("bundle-f1");
  });

  it("replace mode handles empty bundle without calling createMany", async () => {
    const { storage } = makeStorage({
      prompts: [
        { id: "p-old", name: "Old", text: "", createdAt: 1, updatedAt: 1 },
      ],
    });
    const engine = new PromptsEngine({ storage });
    const result = await engine.importBundle({
      version: 1,
      folders: [],
      prompts: [],
    });
    expect(result.success).toBe(true);
    expect(storage.prompts.createMany).not.toHaveBeenCalled();
  });

  it("merge mode matches folders by name and prompts by (name, folderId)", async () => {
    const existingFolder: PromptFolder = {
      id: "f1",
      name: "Existing",
      createdAt: 1,
      updatedAt: 1,
    };
    const existingPrompt: Prompt = {
      id: "p1",
      name: "Same",
      text: "old",
      createdAt: 1,
      updatedAt: 1,
    };
    const { storage, snapshot } = makeStorage({
      prompts: [existingPrompt],
      folders: [existingFolder],
    });
    const engine = new PromptsEngine({ storage });
    const result = await engine.importBundle(
      {
        version: 1,
        folders: [
          // Same name → matches existing folder, no insert
          { id: "bundle-f1", name: "Existing", createdAt: 1, updatedAt: 1 },
          // New name → fresh folder
          { id: "bundle-f2", name: "Brand New", createdAt: 1, updatedAt: 1 },
        ],
        prompts: [
          // (name=Same, folderId=null) → updates existingPrompt.text
          {
            id: "bundle-p1",
            name: "Same",
            text: "fresh",
            createdAt: 1,
            updatedAt: 1,
          },
          // New prompt under the brand-new folder
          {
            id: "bundle-p2",
            name: "Other",
            text: "T",
            folderId: "bundle-f2",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
      { mode: "merge" }
    );
    expect(result.success).toBe(true);

    const snap = snapshot();
    // Folder "Existing" not duplicated.
    expect(snap.folders.filter((f) => f.name === "Existing")).toHaveLength(1);
    // "Brand New" created.
    const brandNew = snap.folders.find((f) => f.name === "Brand New");
    expect(brandNew).toBeDefined();

    // Existing prompt updated in place (id preserved, text replaced).
    const same = snap.prompts.find((p) => p.name === "Same");
    expect(same?.id).toBe("p1");
    expect(same?.text).toBe("fresh");

    // New prompt created under the freshly-minted folder id.
    const other = snap.prompts.find((p) => p.name === "Other");
    expect(other?.folderId).toBe(brandNew!.id);
  });

  it("merge mode without new entries skips createMany calls", async () => {
    const existing: Prompt = {
      id: "p1",
      name: "X",
      text: "",
      createdAt: 1,
      updatedAt: 1,
    };
    const { storage } = makeStorage({ prompts: [existing] });
    const engine = new PromptsEngine({ storage });
    const result = await engine.importBundle(
      {
        version: 1,
        folders: [],
        // Bundle id differs from existing.id but (name, folderId)
        // matches → update path, no createMany.
        prompts: [{ ...existing, id: "different-id", text: "updated" }],
      },
      { mode: "merge" }
    );
    expect(result.success).toBe(true);
    expect(storage.prompts.createMany).not.toHaveBeenCalled();
    expect(storage.prompts.update).toHaveBeenCalledWith("p1", {
      text: "updated",
      folderId: null,
    });
  });
});
