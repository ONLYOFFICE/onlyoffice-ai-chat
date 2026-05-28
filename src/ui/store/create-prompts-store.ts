import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { ServerAPI } from "../providers/ApiProvider";
import type { Prompt, PromptFolder } from "../../types";

/**
 * Zustand state for saved prompt templates and prompt folders.
 *
 * Prompts are reusable text snippets that users can quickly insert into
 * the chat input. They can optionally be organized into folders.
 */
export interface PromptsStoreState {
  prompts: Prompt[];
  folders: PromptFolder[];
  initPrompts: () => Promise<void>;
  addPrompt: (input: {
    name: string;
    text: string;
    folderId?: string | null;
  }) => Promise<void>;
  editPrompt: (
    id: string,
    updates: { name?: string; text?: string; folderId?: string | null }
  ) => Promise<void>;
  removePrompt: (id: string) => Promise<void>;
  addFolder: (name: string) => Promise<string | null>;
  renameFolder: (id: string, name: string) => Promise<void>;
  removeFolder: (id: string) => Promise<void>;
}

export function createPromptsStore(deps: {
  api: ServerAPI;
}): UseBoundStore<StoreApi<PromptsStoreState>> {
  const { api } = deps;

  return create<PromptsStoreState>((set, get) => ({
    prompts: [],
    folders: [],

    initPrompts: async () => {
      const [prompts, folders] = await Promise.all([
        api.prompts.list(undefined),
        api.prompts.listFolders(),
      ]);
      set({ prompts, folders });
    },

    addPrompt: async (input) => {
      const result = await api.prompts.create(input);
      if (result.success) {
        set({ prompts: [result.prompt, ...get().prompts] });
      }
    },

    editPrompt: async (id, updates) => {
      const result = await api.prompts.update(id, updates);
      if (result.success) {
        set({
          prompts: get().prompts.map((p) => (p.id === id ? result.prompt : p)),
        });
      }
    },

    removePrompt: async (id) => {
      await api.prompts.delete(id);
      set({ prompts: get().prompts.filter((p) => p.id !== id) });
    },

    addFolder: async (name) => {
      const result = await api.prompts.createFolder(name);
      if (!result.success) return null;
      set({ folders: [result.folder, ...get().folders] });
      return result.folder.id;
    },

    renameFolder: async (id, name) => {
      const result = await api.prompts.renameFolder(id, name);
      if (result.success) {
        set({
          folders: get().folders.map((f) => (f.id === id ? result.folder : f)),
        });
      }
    },

    removeFolder: async (id) => {
      await api.prompts.deleteFolder(id);
      const [prompts, folders] = await Promise.all([
        api.prompts.list(undefined),
        api.prompts.listFolders(),
      ]);
      set({ prompts, folders });
    },
  }));
}
