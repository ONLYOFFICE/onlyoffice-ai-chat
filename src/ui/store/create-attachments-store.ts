import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { TAttachmentFile, TAttachmentImage } from "../../types";

/**
 * Zustand state for file and image attachments on the current message draft.
 *
 * Tracks two separate lists (files and images), each capped at 5 items,
 * and provides add / delete / clear operations for both.
 */
export interface AttachmentsStoreState {
  /** Files currently attached to the message draft (max 5). */
  attachmentFiles: TAttachmentFile[];
  /** Images currently attached to the message draft (max 5). */
  attachmentImages: TAttachmentImage[];
  /** Append a file attachment (no-op if the limit of 5 is reached). */
  addAttachmentFile: (file: TAttachmentFile) => void;
  /** Remove a file attachment by its path. */
  deleteAttachmentFile: (path: string) => void;
  /** Remove all file attachments. */
  clearAttachmentFiles: () => void;
  /** Append an image attachment (no-op if the limit of 5 is reached). */
  addAttachmentImage: (image: TAttachmentImage) => void;
  /** Remove an image attachment by its name. */
  deleteAttachmentImage: (name: string) => void;
  /** Remove all image attachments. */
  clearAttachmentImages: () => void;
}

export function createAttachmentsStore(): UseBoundStore<
  StoreApi<AttachmentsStoreState>
> {
  return create<AttachmentsStoreState>((set, get) => ({
    attachmentFiles: [],
    attachmentImages: [],

    addAttachmentFile: (file) => {
      if (get().attachmentFiles.length >= 5) return;
      set({
        attachmentFiles: [...get().attachmentFiles, file],
      });
    },

    deleteAttachmentFile: (path) => {
      set({
        attachmentFiles: get().attachmentFiles.filter((f) => f.path !== path),
      });
    },

    clearAttachmentFiles: () => set({ attachmentFiles: [] }),

    addAttachmentImage: (image) => {
      if (get().attachmentImages.length >= 5) return;
      set({
        attachmentImages: [...get().attachmentImages, image],
      });
    },

    deleteAttachmentImage: (name) => {
      set({
        attachmentImages: get().attachmentImages.filter((i) => i.name !== name),
      });
    },

    clearAttachmentImages: () => set({ attachmentImages: [] }),
  }));
}
