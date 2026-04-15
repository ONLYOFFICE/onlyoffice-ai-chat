import { describe, expect, it } from "vitest";
import { createAttachmentsStore } from "../create-attachments-store";
import type { TAttachmentFile, TAttachmentImage } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeFile = (path: string): TAttachmentFile => ({
  path,
  content: `content-${path}`,
  type: 1,
});

const makeImage = (name: string): TAttachmentImage => ({
  name,
  base64: `base64-${name}`,
});

describe("createAttachmentsStore", () => {
  it("starts with empty arrays", () => {
    const store = createAttachmentsStore();
    const state = store.getState();
    expect(state.attachmentFiles).toEqual([]);
    expect(state.attachmentImages).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Files
  // -------------------------------------------------------------------------

  describe("addAttachmentFile", () => {
    it("adds a file", () => {
      const store = createAttachmentsStore();
      store.getState().addAttachmentFile(makeFile("a.txt"));
      expect(store.getState().attachmentFiles).toHaveLength(1);
      expect(store.getState().attachmentFiles[0].path).toBe("a.txt");
    });

    it("enforces max 5 files", () => {
      const store = createAttachmentsStore();
      for (let i = 0; i < 6; i++) {
        store.getState().addAttachmentFile(makeFile(`file-${i}`));
      }
      expect(store.getState().attachmentFiles).toHaveLength(5);
    });
  });

  describe("deleteAttachmentFile", () => {
    it("removes file by path", () => {
      const store = createAttachmentsStore();
      store.getState().addAttachmentFile(makeFile("a.txt"));
      store.getState().addAttachmentFile(makeFile("b.txt"));
      store.getState().deleteAttachmentFile("a.txt");
      expect(store.getState().attachmentFiles).toHaveLength(1);
      expect(store.getState().attachmentFiles[0].path).toBe("b.txt");
    });

    it("no-op for non-existent path", () => {
      const store = createAttachmentsStore();
      store.getState().addAttachmentFile(makeFile("a.txt"));
      store.getState().deleteAttachmentFile("nope");
      expect(store.getState().attachmentFiles).toHaveLength(1);
    });
  });

  describe("clearAttachmentFiles", () => {
    it("removes all files", () => {
      const store = createAttachmentsStore();
      store.getState().addAttachmentFile(makeFile("a.txt"));
      store.getState().addAttachmentFile(makeFile("b.txt"));
      store.getState().clearAttachmentFiles();
      expect(store.getState().attachmentFiles).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Images
  // -------------------------------------------------------------------------

  describe("addAttachmentImage", () => {
    it("adds an image", () => {
      const store = createAttachmentsStore();
      store.getState().addAttachmentImage(makeImage("img1"));
      expect(store.getState().attachmentImages).toHaveLength(1);
    });

    it("enforces max 5 images", () => {
      const store = createAttachmentsStore();
      for (let i = 0; i < 6; i++) {
        store.getState().addAttachmentImage(makeImage(`img-${i}`));
      }
      expect(store.getState().attachmentImages).toHaveLength(5);
    });
  });

  describe("deleteAttachmentImage", () => {
    it("removes image by name", () => {
      const store = createAttachmentsStore();
      store.getState().addAttachmentImage(makeImage("a"));
      store.getState().addAttachmentImage(makeImage("b"));
      store.getState().deleteAttachmentImage("a");
      expect(store.getState().attachmentImages).toHaveLength(1);
      expect(store.getState().attachmentImages[0].name).toBe("b");
    });
  });

  describe("clearAttachmentImages", () => {
    it("removes all images", () => {
      const store = createAttachmentsStore();
      store.getState().addAttachmentImage(makeImage("a"));
      store.getState().clearAttachmentImages();
      expect(store.getState().attachmentImages).toEqual([]);
    });
  });
});
