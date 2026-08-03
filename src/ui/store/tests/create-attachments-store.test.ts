import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Attachment } from "../../../core/storage";
import { createAttachmentsStore } from "../create-attachments-store";

// ---------------------------------------------------------------------------
// Stub AttachmentsEngine — counters + in-memory map
// ---------------------------------------------------------------------------

let nextId = 0;
const records = new Map<string, Attachment>();
const deleteCalls: string[] = [];

const makeStubEngine = () => ({
  saveFile: vi.fn(
    async (input: {
      path: string;
      content: string;
      type: number;
      title?: string;
    }) => {
      const id = `att-${++nextId}`;
      const rec: Attachment = {
        id,
        kind: "file",
        title: input.title ?? input.path,
        content: input.content,
        path: input.path,
        type: input.type,
        createdAt: Date.now(),
      };
      records.set(id, rec);
      return rec;
    }
  ),
  saveFilesMany: vi.fn(
    async (
      inputs: { path: string; content: string; type: number; title?: string }[]
    ) =>
      inputs.map((input) => {
        const id = `att-${++nextId}`;
        const rec: Attachment = {
          id,
          kind: "file",
          title: input.title ?? input.path,
          content: input.content,
          path: input.path,
          type: input.type,
          createdAt: Date.now(),
        };
        records.set(id, rec);
        return rec;
      })
  ),
  saveImage: vi.fn(
    async (input: { name: string; base64: string; title?: string }) => {
      const id = `att-${++nextId}`;
      const rec: Attachment = {
        id,
        kind: "image",
        title: input.title ?? input.name,
        base64: input.base64,
        createdAt: Date.now(),
      };
      records.set(id, rec);
      return rec;
    }
  ),
  saveImagesMany: vi.fn(
    async (inputs: { name: string; base64: string; title?: string }[]) =>
      inputs.map((input) => {
        const id = `att-${++nextId}`;
        const rec: Attachment = {
          id,
          kind: "image",
          title: input.title ?? input.name,
          base64: input.base64,
          createdAt: Date.now(),
        };
        records.set(id, rec);
        return rec;
      })
  ),
  get: vi.fn(async (id: string) => records.get(id) ?? null),
  getMany: vi.fn(async (ids: string[]) =>
    ids.map((i) => records.get(i) ?? null)
  ),
  delete: vi.fn(async (id: string) => {
    deleteCalls.push(id);
    records.delete(id);
  }),
  deleteMany: vi.fn(async (ids: string[]) => {
    for (const id of ids) {
      deleteCalls.push(id);
      records.delete(id);
    }
  }),
  linkToMessage: vi.fn(),
});

beforeEach(() => {
  nextId = 0;
  records.clear();
  deleteCalls.length = 0;
});

const createStore = () => {
  // Cast: stub satisfies the structural shape used by the store.
  const attachments = makeStubEngine() as unknown as Parameters<
    typeof createAttachmentsStore
  >[0]["attachments"];
  return {
    store: createAttachmentsStore({ attachments }),
    engine: attachments,
  };
};

describe("createAttachmentsStore", () => {
  it("starts with empty arrays", () => {
    const { store } = createStore();
    const state = store.getState();
    expect(state.attachmentFiles).toEqual([]);
    expect(state.attachmentImages).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Files
  // -------------------------------------------------------------------------

  describe("addAttachmentFile", () => {
    it("persists payload and appends a ref", async () => {
      const { store } = createStore();
      await store.getState().addAttachmentFile({
        path: "a.txt",
        content: "hello",
        type: 1,
      });
      const list = store.getState().attachmentFiles;
      expect(list).toHaveLength(1);
      expect(list[0].kind).toBe("file");
      expect(list[0].path).toBe("a.txt");
      expect(list[0].title).toBe("a.txt");
      expect(records.get(list[0].id)?.content).toBe("hello");
    });

    it("enforces max 5 files (does not persist past limit)", async () => {
      const { store } = createStore();
      for (let i = 0; i < 6; i++) {
        await store
          .getState()
          .addAttachmentFile({ path: `file-${i}`, content: "", type: 1 });
      }
      expect(store.getState().attachmentFiles).toHaveLength(5);
      // Only 5 storage records should exist — the 6th call is short-circuited.
      expect(records.size).toBe(5);
    });

    it("array input hits saveFilesMany exactly once (single round trip)", async () => {
      const { store, engine } = createStore();
      await store.getState().addAttachmentFile([
        { path: "a.txt", content: "1", type: 1 },
        { path: "b.txt", content: "2", type: 1 },
        { path: "c.txt", content: "3", type: 1 },
      ]);
      // The whole batch lands on the engine via one call.
      expect(
        (engine as unknown as { saveFilesMany: { mock: { calls: unknown[] } } })
          .saveFilesMany.mock.calls
      ).toHaveLength(1);
      expect(
        (engine as unknown as { saveFile: { mock: { calls: unknown[] } } })
          .saveFile.mock.calls
      ).toHaveLength(0);
      expect(store.getState().attachmentFiles).toHaveLength(3);
    });

    it("array input truncated to remaining slots in one batch call", async () => {
      const { store, engine } = createStore();
      // seed 3 → only 2 slots remain
      await store.getState().addAttachmentFile([
        { path: "a", content: "", type: 1 },
        { path: "b", content: "", type: 1 },
        { path: "c", content: "", type: 1 },
      ]);
      await store.getState().addAttachmentFile([
        { path: "d", content: "", type: 1 },
        { path: "e", content: "", type: 1 },
        { path: "f", content: "", type: 1 },
      ]);
      expect(store.getState().attachmentFiles).toHaveLength(5);
      const calls = (
        engine as unknown as {
          saveFilesMany: { mock: { calls: unknown[][] } };
        }
      ).saveFilesMany.mock.calls;
      // Second call passes 2 inputs (truncated to remaining 2 slots), not 3.
      expect((calls[1][0] as unknown[]).length).toBe(2);
    });
  });

  describe("deleteAttachmentFile", () => {
    it("removes ref by id and cascades storage delete", async () => {
      const { store } = createStore();
      await store
        .getState()
        .addAttachmentFile({ path: "a.txt", content: "", type: 1 });
      await store
        .getState()
        .addAttachmentFile({ path: "b.txt", content: "", type: 1 });
      const [first, second] = store.getState().attachmentFiles;
      await store.getState().deleteAttachmentFile(first.id);
      expect(store.getState().attachmentFiles).toHaveLength(1);
      expect(store.getState().attachmentFiles[0].id).toBe(second.id);
      expect(deleteCalls).toContain(first.id);
    });

    it("no-op for non-existent id", async () => {
      const { store } = createStore();
      await store
        .getState()
        .addAttachmentFile({ path: "a.txt", content: "", type: 1 });
      await store.getState().deleteAttachmentFile("nope");
      expect(store.getState().attachmentFiles).toHaveLength(1);
    });
  });

  describe("clearAttachmentFiles", () => {
    it("removes all refs and cascades storage deletes", async () => {
      const { store } = createStore();
      await store
        .getState()
        .addAttachmentFile({ path: "a.txt", content: "", type: 1 });
      await store
        .getState()
        .addAttachmentFile({ path: "b.txt", content: "", type: 1 });
      await store.getState().clearAttachmentFiles();
      expect(store.getState().attachmentFiles).toEqual([]);
      expect(deleteCalls).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Images
  // -------------------------------------------------------------------------

  describe("addAttachmentImage", () => {
    it("persists base64 and appends a ref", async () => {
      const { store } = createStore();
      await store
        .getState()
        .addAttachmentImage({ name: "img1", base64: "data:..." });
      const list = store.getState().attachmentImages;
      expect(list).toHaveLength(1);
      expect(list[0].kind).toBe("image");
      expect(list[0].title).toBe("img1");
      expect(records.get(list[0].id)?.base64).toBe("data:...");
    });

    it("enforces max 5 images", async () => {
      const { store } = createStore();
      for (let i = 0; i < 6; i++) {
        await store
          .getState()
          .addAttachmentImage({ name: `img-${i}`, base64: "x" });
      }
      expect(store.getState().attachmentImages).toHaveLength(5);
    });
  });

  describe("deleteAttachmentImage", () => {
    it("removes image by id", async () => {
      const { store } = createStore();
      await store.getState().addAttachmentImage({ name: "a", base64: "x" });
      await store.getState().addAttachmentImage({ name: "b", base64: "y" });
      const [first, second] = store.getState().attachmentImages;
      await store.getState().deleteAttachmentImage(first.id);
      expect(store.getState().attachmentImages).toHaveLength(1);
      expect(store.getState().attachmentImages[0].id).toBe(second.id);
    });
  });

  describe("clearAttachmentImages", () => {
    it("removes all images", async () => {
      const { store } = createStore();
      await store.getState().addAttachmentImage({ name: "a", base64: "x" });
      await store.getState().clearAttachmentImages();
      expect(store.getState().attachmentImages).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Pending attachments (loading chips)
  // -------------------------------------------------------------------------

  describe("beginPendingAttachments", () => {
    it("reserves placeholders synchronously and returns their ids", () => {
      const { store } = createStore();
      const ids = store.getState().beginPendingAttachments([
        { title: "a.docx", kind: "file", type: 1 },
        { title: "b.png", kind: "image" },
      ]);
      expect(ids).toHaveLength(2);
      const pending = store.getState().pendingAttachments;
      expect(pending.map((p) => p.id)).toEqual(ids);
      expect(pending[0]).toMatchObject({ title: "a.docx", kind: "file" });
      expect(pending[1]).toMatchObject({ title: "b.png", kind: "image" });
    });

    it("truncates to the free slots of each bucket independently", async () => {
      const { store } = createStore();
      await store.getState().addAttachmentFile([
        { path: "a", content: "", type: 1 },
        { path: "b", content: "", type: 1 },
        { path: "c", content: "", type: 1 },
        { path: "d", content: "", type: 1 },
      ]);
      // 1 file slot free, 5 image slots free — the full image gets in even
      // though the second file is refused.
      const ids = store.getState().beginPendingAttachments([
        { title: "e", kind: "file" },
        { title: "f", kind: "file" },
        { title: "g.png", kind: "image" },
      ]);
      const pending = store.getState().pendingAttachments;
      expect(ids).toHaveLength(2);
      expect(pending.map((p) => p.title)).toEqual(["e", "g.png"]);
    });

    it("counts standing placeholders toward the cap (no 6th chip)", () => {
      const { store } = createStore();
      const first = store.getState().beginPendingAttachments(
        Array.from({ length: 5 }, (_, i) => ({
          title: `f${i}`,
          kind: "file" as const,
        }))
      );
      expect(first).toHaveLength(5);
      const second = store
        .getState()
        .beginPendingAttachments([{ title: "extra", kind: "file" }]);
      expect(second).toEqual([]);
    });
  });

  describe("failPendingAttachments / cancelPendingAttachment", () => {
    it("drops the named leases and ignores unknown ids", () => {
      const { store } = createStore();
      const [a, b] = store.getState().beginPendingAttachments([
        { title: "a", kind: "file" },
        { title: "b", kind: "file" },
      ]);
      store.getState().failPendingAttachments([a, "nope"]);
      expect(store.getState().pendingAttachments.map((p) => p.id)).toEqual([
        b,
      ]);
      store.getState().cancelPendingAttachment(b);
      expect(store.getState().pendingAttachments).toEqual([]);
    });

    it("a freed slot is reusable by the next reservation", () => {
      const { store } = createStore();
      const ids = store.getState().beginPendingAttachments(
        Array.from({ length: 5 }, (_, i) => ({
          title: `f${i}`,
          kind: "file" as const,
        }))
      );
      store.getState().cancelPendingAttachment(ids[0]);
      const next = store
        .getState()
        .beginPendingAttachments([{ title: "again", kind: "file" }]);
      expect(next).toHaveLength(1);
    });
  });

  describe("add* with leases", () => {
    it("consumes handed-in leases without double-counting the cap", async () => {
      const { store, engine } = createStore();
      const pendingIds = store.getState().beginPendingAttachments(
        Array.from({ length: 5 }, (_, i) => ({
          title: `f${i}`,
          kind: "file" as const,
        }))
      );
      await store.getState().addAttachmentFile(
        Array.from({ length: 5 }, (_, i) => ({
          path: `f${i}`,
          content: "",
          type: 1,
        })),
        { pendingIds }
      );
      expect(store.getState().attachmentFiles).toHaveLength(5);
      expect(store.getState().pendingAttachments).toEqual([]);
      const calls = (
        engine as unknown as {
          saveFilesMany: { mock: { calls: unknown[][] } };
        }
      ).saveFilesMany.mock.calls;
      expect(calls).toHaveLength(1);
      expect((calls[0][0] as unknown[]).length).toBe(5);
    });

    it("never shows a placeholder and its ref at the same time", async () => {
      const { store } = createStore();
      const frames: { pending: number; files: number }[] = [];
      const unsubscribe = store.subscribe((s) => {
        frames.push({
          pending: s.pendingAttachments.length,
          files: s.attachmentFiles.length,
        });
      });
      const [pendingId] = store
        .getState()
        .beginPendingAttachments([{ title: "a", kind: "file" }]);
      await store
        .getState()
        .addAttachmentFile({ path: "a", content: "", type: 1 }, {
          pendingIds: [pendingId],
        });
      unsubscribe();
      // Every observed frame holds at most one of the two representations.
      for (const frame of frames) {
        expect(frame.pending + frame.files).toBeLessThanOrEqual(1);
      }
      expect(store.getState().attachmentFiles).toHaveLength(1);
    });

    it("self-reserves a placeholder for the storage round trip", async () => {
      const { store } = createStore();
      let sawPending = 0;
      const unsubscribe = store.subscribe((s) => {
        sawPending = Math.max(sawPending, s.pendingAttachments.length);
      });
      await store
        .getState()
        .addAttachmentFile({ path: "dir/a.txt", content: "", type: 1 });
      unsubscribe();
      expect(sawPending).toBe(1);
      const state = store.getState();
      expect(state.pendingAttachments).toEqual([]);
      expect(state.attachmentFiles).toHaveLength(1);
    });

    it("a lease revoked before the queued body runs skips its upload", async () => {
      const { store, engine } = createStore();
      const [keepId, dropId] = store.getState().beginPendingAttachments([
        { title: "keep", kind: "file" },
        { title: "drop", kind: "file" },
      ]);
      const settling = store.getState().addAttachmentFile(
        [
          { path: "keep", content: "", type: 1 },
          { path: "drop", content: "", type: 1 },
        ],
        { pendingIds: [keepId, dropId] }
      );
      // Cancel synchronously — the queued body has not run yet, so the
      // dropped input never reaches storage at all.
      store.getState().cancelPendingAttachment(dropId);
      await settling;
      const files = store.getState().attachmentFiles;
      expect(files.map((f) => f.path)).toEqual(["keep"]);
      expect(store.getState().pendingAttachments).toEqual([]);
      const calls = (
        engine as unknown as {
          saveFilesMany: { mock: { calls: unknown[][] } };
        }
      ).saveFilesMany.mock.calls;
      expect((calls[0][0] as unknown[]).length).toBe(1);
      expect(deleteCalls).toHaveLength(0);
    });

    it("a lease revoked while storage is in flight discards the ref and deletes the record", async () => {
      const { store, engine } = createStore();
      // Gate the storage call so the cancel provably lands mid-flight.
      let release: (() => void) | undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const engineMock = engine as unknown as {
        saveFilesMany: {
          getMockImplementation: () => (
            inputs: { path: string; content: string; type: number }[]
          ) => Promise<Attachment[]>;
          mockImplementationOnce: (
            fn: (
              inputs: { path: string; content: string; type: number }[]
            ) => Promise<Attachment[]>
          ) => void;
        };
      };
      const original = engineMock.saveFilesMany.getMockImplementation();
      engineMock.saveFilesMany.mockImplementationOnce(async (inputs) => {
        await gate;
        return original(inputs);
      });

      const [keepId, dropId] = store.getState().beginPendingAttachments([
        { title: "keep", kind: "file" },
        { title: "drop", kind: "file" },
      ]);
      const settling = store.getState().addAttachmentFile(
        [
          { path: "keep", content: "", type: 1 },
          { path: "drop", content: "", type: 1 },
        ],
        { pendingIds: [keepId, dropId] }
      );
      // Let the queued body start and block on the gate, then revoke.
      await Promise.resolve();
      store.getState().cancelPendingAttachment(dropId);
      release?.();
      await settling;

      const files = store.getState().attachmentFiles;
      expect(files.map((f) => f.path)).toEqual(["keep"]);
      expect(store.getState().pendingAttachments).toEqual([]);
      // The already-persisted record of the dropped file was cleaned up.
      expect(deleteCalls).toHaveLength(1);
    });

    it("storage failure removes the placeholders and rejects", async () => {
      const { store, engine } = createStore();
      (
        engine as unknown as {
          saveFilesMany: { mockRejectedValueOnce: (e: Error) => void };
        }
      ).saveFilesMany.mockRejectedValueOnce(new Error("offline"));
      await expect(
        store.getState().addAttachmentFile({ path: "a", content: "", type: 1 })
      ).rejects.toThrow("offline");
      expect(store.getState().pendingAttachments).toEqual([]);
      expect(store.getState().attachmentFiles).toEqual([]);
    });

    it("image leases settle into attachmentImages and the cache", async () => {
      const { store } = createStore();
      const pendingIds = store
        .getState()
        .beginPendingAttachments([{ title: "img.png", kind: "image" }]);
      await store
        .getState()
        .addAttachmentImage({ name: "img.png", base64: "data:x" }, {
          pendingIds,
        });
      const state = store.getState();
      expect(state.pendingAttachments).toEqual([]);
      expect(state.attachmentImages).toHaveLength(1);
      expect(state._imageCache[state.attachmentImages[0].id]).toBe("data:x");
    });
  });

  describe("clearAttachment* lease revocation", () => {
    it("clearAttachmentFiles revokes file leases but not image leases", () => {
      const { store } = createStore();
      store.getState().beginPendingAttachments([
        { title: "f", kind: "file" },
        { title: "i.png", kind: "image" },
      ]);
      store.getState().clearAttachmentFiles();
      const pending = store.getState().pendingAttachments;
      expect(pending).toHaveLength(1);
      expect(pending[0].kind).toBe("image");
    });

    it("a thread switch mid-upload keeps the chip out of the next draft", async () => {
      const { store } = createStore();
      const pendingIds = store
        .getState()
        .beginPendingAttachments([{ title: "a", kind: "file" }]);
      const settling = store
        .getState()
        .addAttachmentFile({ path: "a", content: "", type: 1 }, { pendingIds });
      // Thread switch runs the clears while the upload is in flight.
      store.getState().clearAttachmentFiles();
      await settling;
      expect(store.getState().attachmentFiles).toEqual([]);
      expect(store.getState().pendingAttachments).toEqual([]);
    });
  });
});
