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
  saveFile: vi.fn(async (input: { path: string; content: string; type: number; title?: string }) => {
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
  }),
  saveImage: vi.fn(async (input: { name: string; base64: string; title?: string }) => {
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
  }),
  get: vi.fn(async (id: string) => records.get(id) ?? null),
  getMany: vi.fn(async (ids: string[]) => ids.map((i) => records.get(i) ?? null)),
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
  return { store: createAttachmentsStore({ attachments }), engine: attachments };
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
});
