import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PromptsService } from "../../services/prompts";
import { createPromptsStore } from "../create-prompts-store";
import type { Prompt, PromptFolder } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrompt(id: string, text = "text"): Prompt {
  return {
    id,
    name: `Prompt ${id}`,
    text,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeFolder(id: string, name = "Folder"): PromptFolder {
  return { id, name, createdAt: Date.now(), updatedAt: Date.now() };
}

function makeService(overrides?: Partial<PromptsService>): PromptsService {
  return {
    loadAll: vi.fn().mockResolvedValue({ prompts: [], folders: [] }),
    createPrompt: vi.fn((text: string) => makePrompt("new-id", text)),
    updatePrompt: vi.fn(
      (prompts: Prompt[], id: string, updates: Record<string, unknown>) =>
        prompts.map((p) => (p.id === id ? { ...p, ...updates } : p))
    ),
    deletePrompt: vi.fn(),
    createFolder: vi.fn((name: string) => makeFolder("folder-new", name)),
    renameFolder: vi.fn((folders: PromptFolder[], id: string, name: string) =>
      folders.map((f) => (f.id === id ? { ...f, name } : f))
    ),
    deleteFolder: vi.fn((id: string, prompts: Prompt[]) =>
      prompts.map((p) =>
        p.folderId === id ? { ...p, folderId: undefined } : p
      )
    ),
    ...overrides,
  } as unknown as PromptsService;
}

describe("createPromptsStore", () => {
  let service: PromptsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeService();
  });

  it("starts with empty prompts and folders", () => {
    const store = createPromptsStore({ promptsService: service });
    expect(store.getState().prompts).toEqual([]);
    expect(store.getState().folders).toEqual([]);
  });

  describe("initPrompts", () => {
    it("loads prompts and folders from service", async () => {
      const prompts = [makePrompt("1")];
      const folders = [makeFolder("f1")];
      service = makeService({
        loadAll: vi.fn().mockResolvedValue({ prompts, folders }),
      } as unknown as Partial<PromptsService>);
      const store = createPromptsStore({ promptsService: service });

      await store.getState().initPrompts();

      expect(store.getState().prompts).toEqual(prompts);
      expect(store.getState().folders).toEqual(folders);
    });
  });

  describe("addPrompt", () => {
    it("prepends new prompt", () => {
      const store = createPromptsStore({ promptsService: service });
      store.getState().addPrompt("hello world");
      expect(store.getState().prompts).toHaveLength(1);
      expect(service.createPrompt).toHaveBeenCalledWith(
        "hello world",
        undefined
      );
    });

    it("passes folderId to service", () => {
      const store = createPromptsStore({ promptsService: service });
      store.getState().addPrompt("text", "folder-1");
      expect(service.createPrompt).toHaveBeenCalledWith("text", "folder-1");
    });
  });

  describe("editPrompt", () => {
    it("updates prompt via service", () => {
      service = makeService({
        loadAll: vi
          .fn()
          .mockResolvedValue({ prompts: [makePrompt("1")], folders: [] }),
      } as unknown as Partial<PromptsService>);
      const store = createPromptsStore({ promptsService: service });
      // Manually set prompts since initPrompts is async
      store.setState({ prompts: [makePrompt("1")] });

      store.getState().editPrompt("1", { name: "Updated" });
      expect(service.updatePrompt).toHaveBeenCalled();
    });
  });

  describe("removePrompt", () => {
    it("removes prompt from state and calls service", () => {
      const store = createPromptsStore({ promptsService: service });
      store.setState({ prompts: [makePrompt("1"), makePrompt("2")] });

      store.getState().removePrompt("1");
      expect(store.getState().prompts).toHaveLength(1);
      expect(store.getState().prompts[0].id).toBe("2");
      expect(service.deletePrompt).toHaveBeenCalledWith("1");
    });
  });

  describe("addFolder", () => {
    it("prepends folder and returns id", () => {
      const store = createPromptsStore({ promptsService: service });
      const id = store.getState().addFolder("My Folder");
      expect(id).toBe("folder-new");
      expect(store.getState().folders).toHaveLength(1);
    });
  });

  describe("renameFolder", () => {
    it("renames folder via service", () => {
      const store = createPromptsStore({ promptsService: service });
      store.setState({ folders: [makeFolder("f1", "Old")] });

      store.getState().renameFolder("f1", "New");
      expect(service.renameFolder).toHaveBeenCalled();
      expect(store.getState().folders[0].name).toBe("New");
    });
  });

  describe("removeFolder", () => {
    it("removes folder and unassigns prompts", () => {
      const store = createPromptsStore({ promptsService: service });
      const prompt = { ...makePrompt("p1"), folderId: "f1" };
      store.setState({
        folders: [makeFolder("f1")],
        prompts: [prompt],
      });

      store.getState().removeFolder("f1");
      expect(store.getState().folders).toHaveLength(0);
      expect(service.deleteFolder).toHaveBeenCalledWith("f1", [prompt]);
    });
  });
});
