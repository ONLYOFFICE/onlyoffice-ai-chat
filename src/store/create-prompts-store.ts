import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { PromptsService } from "../services/prompts";
import type { Prompt, PromptFolder } from "../types";

/**
 * Zustand state for saved prompt templates and prompt folders.
 *
 * Prompts are reusable text snippets that users can quickly insert into
 * the chat input. They can optionally be organized into folders.
 */
export interface PromptsStoreState {
  /** All saved prompt templates. */
  prompts: Prompt[];
  /** All prompt folders for organizing prompts. */
  folders: PromptFolder[];
  /** Load all prompts and folders from persistent storage. */
  initPrompts: () => Promise<void>;
  /** Create a new prompt with the given text, optionally placed in a folder. */
  addPrompt: (text: string, folderId?: string) => void;
  /** Update a prompt's name, text, or folder assignment. */
  editPrompt: (
    id: string,
    updates: { name?: string; text?: string; folderId?: string | null }
  ) => void;
  /** Delete a prompt by ID. */
  removePrompt: (id: string) => void;
  /** Create a new folder and return its generated ID. */
  addFolder: (name: string) => string;
  /** Rename an existing folder. */
  renameFolder: (id: string, name: string) => void;
  /** Delete a folder and unlink any prompts that belonged to it. */
  removeFolder: (id: string) => void;
}

export function createPromptsStore(deps: {
  promptsService: PromptsService;
}): UseBoundStore<StoreApi<PromptsStoreState>> {
  const { promptsService } = deps;

  return create<PromptsStoreState>((set, get) => ({
    prompts: [],
    folders: [],

    initPrompts: async () => {
      const { prompts, folders } = await promptsService.loadAll();
      set({ prompts, folders });
    },

    addPrompt: (text, folderId) => {
      const prompt = promptsService.createPrompt(text, folderId);
      set({ prompts: [prompt, ...get().prompts] });
    },

    editPrompt: (id, updates) => {
      const prompts = promptsService.updatePrompt(get().prompts, id, updates);
      set({ prompts });
    },

    removePrompt: (id) => {
      set({ prompts: get().prompts.filter((p) => p.id !== id) });
      promptsService.deletePrompt(id);
    },

    addFolder: (name) => {
      const folder = promptsService.createFolder(name);
      set({ folders: [folder, ...get().folders] });
      return folder.id;
    },

    renameFolder: (id, name) => {
      const folders = promptsService.renameFolder(get().folders, id, name);
      set({ folders });
    },

    removeFolder: (id) => {
      const currentPrompts = get().prompts;
      const updatedPrompts = promptsService.deleteFolder(id, currentPrompts);
      set({
        folders: get().folders.filter((f) => f.id !== id),
        prompts: updatedPrompts,
      });
    },
  }));
}
