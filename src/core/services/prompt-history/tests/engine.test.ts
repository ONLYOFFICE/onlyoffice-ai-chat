import { describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "../../../storage";
import { PromptHistoryEngine } from "../engine";

/** Adapter with a working `promptHistory` slice, backed by a per-entity map. */
function makeStorage(seed: Record<string, string[]> = {}) {
  const store: Record<string, string[]> = { ...seed };
  const bucket = (entityId?: string) => (store[entityId ?? ""] ??= []);
  const storage = {
    promptHistory: {
      append: vi.fn(async (text: string, entityId?: string) => {
        bucket(entityId).push(text);
      }),
      readAll: vi.fn(async (entityId?: string, limit?: number) => {
        const list = bucket(entityId);
        return limit === undefined ? [...list] : list.slice(-limit);
      }),
      clear: vi.fn(async (entityId?: string) => {
        delete store[entityId ?? ""];
      }),
    },
  } as unknown as StorageAdapter;
  return { storage, store };
}

/** Adapter predating the slice — exercises the in-memory fallback. */
function makeLegacyStorage() {
  return {} as unknown as StorageAdapter;
}

describe("PromptHistoryEngine", () => {
  it("returns history oldest-first", async () => {
    const { storage } = makeStorage({ "": ["first", "second"] });
    const engine = new PromptHistoryEngine({ storage });
    expect(await engine.list()).toEqual(["first", "second"]);
  });

  it("scopes history by entity", async () => {
    const { storage } = makeStorage({ docA: ["a"], docB: ["b"] });
    const engine = new PromptHistoryEngine({ storage });
    expect(await engine.list("docA")).toEqual(["a"]);
    expect(await engine.list("docB")).toEqual(["b"]);
    // The unscoped bucket is its own namespace, not a merge of the others.
    expect(await engine.list()).toEqual([]);
  });

  it("records a sent prompt", async () => {
    const { storage, store } = makeStorage();
    const engine = new PromptHistoryEngine({ storage });
    await engine.record("hello", "doc");
    expect(store.doc).toEqual(["hello"]);
  });

  it("trims whitespace and skips blank prompts", async () => {
    const { storage, store } = makeStorage();
    const engine = new PromptHistoryEngine({ storage });
    await engine.record("  spaced  ", "doc");
    await engine.record("   ", "doc");
    await engine.record("", "doc");
    expect(store.doc).toEqual(["spaced"]);
  });

  it("collapses an immediate repeat of the newest entry", async () => {
    const { storage, store } = makeStorage();
    const engine = new PromptHistoryEngine({ storage });
    await engine.record("same", "doc");
    await engine.record("same", "doc");
    expect(store.doc).toEqual(["same"]);
  });

  it("keeps a repeat that is not consecutive", async () => {
    const { storage, store } = makeStorage();
    const engine = new PromptHistoryEngine({ storage });
    await engine.record("a", "doc");
    await engine.record("b", "doc");
    await engine.record("a", "doc");
    expect(store.doc).toEqual(["a", "b", "a"]);
  });

  it("caps the returned list at the engine limit", async () => {
    const { storage } = makeStorage({ doc: ["1", "2", "3", "4"] });
    const engine = new PromptHistoryEngine({ storage }, 2);
    // The most recent entries win — those are the ones Up reaches first.
    expect(await engine.list("doc")).toEqual(["3", "4"]);
  });

  it("caps even when the adapter ignores the limit argument", async () => {
    const storage = {
      promptHistory: {
        append: vi.fn(),
        // Contract allows ignoring `limit`; the engine must still bound it.
        readAll: vi.fn(async () => ["1", "2", "3", "4"]),
        clear: vi.fn(),
      },
    } as unknown as StorageAdapter;
    const engine = new PromptHistoryEngine({ storage }, 2);
    expect(await engine.list("doc")).toEqual(["3", "4"]);
  });

  it("clears history for the scope", async () => {
    const { storage, store } = makeStorage({ doc: ["a"] });
    const engine = new PromptHistoryEngine({ storage });
    await engine.clear("doc");
    expect(store.doc).toBeUndefined();
  });

  describe("without a promptHistory adapter slice", () => {
    it("keeps history in memory for the session", async () => {
      const engine = new PromptHistoryEngine({ storage: makeLegacyStorage() });
      await engine.record("one", "doc");
      await engine.record("two", "doc");
      expect(await engine.list("doc")).toEqual(["one", "two"]);
    });

    it("still scopes by entity and still dedups", async () => {
      const engine = new PromptHistoryEngine({ storage: makeLegacyStorage() });
      await engine.record("a", "docA");
      await engine.record("a", "docA");
      await engine.record("b", "docB");
      expect(await engine.list("docA")).toEqual(["a"]);
      expect(await engine.list("docB")).toEqual(["b"]);
    });

    it("evicts the oldest entries past the limit", async () => {
      const engine = new PromptHistoryEngine(
        { storage: makeLegacyStorage() },
        2
      );
      await engine.record("1", "doc");
      await engine.record("2", "doc");
      await engine.record("3", "doc");
      expect(await engine.list("doc")).toEqual(["2", "3"]);
    });
  });

  describe("when storage fails", () => {
    const failing = () =>
      ({
        promptHistory: {
          append: vi.fn().mockRejectedValue(new Error("boom")),
          readAll: vi.fn().mockRejectedValue(new Error("boom")),
          clear: vi.fn().mockRejectedValue(new Error("boom")),
        },
      }) as unknown as StorageAdapter;

    it("degrades to an empty list rather than rejecting", async () => {
      const engine = new PromptHistoryEngine({ storage: failing() });
      await expect(engine.list("doc")).resolves.toEqual([]);
    });

    it("never rejects on record — a lost prompt must not fail the send", async () => {
      const engine = new PromptHistoryEngine({ storage: failing() });
      await expect(engine.record("hi", "doc")).resolves.toBeUndefined();
    });

    it("never rejects on clear", async () => {
      const engine = new PromptHistoryEngine({ storage: failing() });
      await expect(engine.clear("doc")).resolves.toBeUndefined();
    });
  });
});
