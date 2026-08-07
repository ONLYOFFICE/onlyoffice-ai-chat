import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerAPI } from "../../providers/ApiProvider";
import type { CallbacksManager } from "../../providers/EventsProvider";
import { createPromptsStore } from "../create-prompts-store";
import type { Prompt, PromptFolder } from "../../../types";

const prompt = (id: string, overrides: Partial<Prompt> = {}): Prompt =>
  ({
    id,
    name: `n${id}`,
    text: `t${id}`,
    folderId: null,
    ...overrides,
  }) as Prompt;

const folder = (id: string, name = `f${id}`): PromptFolder =>
  ({ id, name }) as PromptFolder;

function makeApi(overrides: Partial<ServerAPI["prompts"]> = {}) {
  const prompts = {
    list: vi.fn().mockResolvedValue([]),
    listFolders: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    createFolder: vi.fn(),
    renameFolder: vi.fn(),
    deleteFolder: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { prompts } as unknown as ServerAPI;
}

const emit = vi.fn();
const callbacksManager = { emit } as unknown as CallbacksManager;

const makeStore = (api: ServerAPI) =>
  createPromptsStore({ api, callbacksManager });

describe("createPromptsStore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("initPrompts loads prompts and folders", async () => {
    const api = makeApi({
      list: vi.fn().mockResolvedValue([prompt("1")]),
      listFolders: vi.fn().mockResolvedValue([folder("a")]),
    });
    const s = makeStore(api);
    await s.getState().initPrompts();
    expect(s.getState().prompts).toEqual([prompt("1")]);
    expect(s.getState().folders).toEqual([folder("a")]);
  });

  it("initPrompts reports a failed load on onError instead of rejecting", async () => {
    const failure = new Error("offline");
    const api = makeApi({ list: vi.fn().mockRejectedValue(failure) });
    const s = makeStore(api);

    await expect(s.getState().initPrompts()).resolves.toBeUndefined();

    expect(emit).toHaveBeenCalledWith("onError", {
      type: "storage",
      error: failure,
      context: "prompts:init",
    });
    expect(s.getState().prompts).toEqual([]);
  });

  it("addPrompt prepends on success", async () => {
    const api = makeApi({
      create: vi.fn().mockResolvedValue({ success: true, prompt: prompt("1") }),
    });
    const s = makeStore(api);
    await s.getState().addPrompt({ name: "n", text: "t" });
    expect(s.getState().prompts).toEqual([prompt("1")]);
  });

  it("addPrompt does nothing on failure", async () => {
    const api = makeApi({
      create: vi.fn().mockResolvedValue({ success: false }),
    });
    const s = makeStore(api);
    await s.getState().addPrompt({ name: "n", text: "t" });
    expect(s.getState().prompts).toEqual([]);
  });

  it("editPrompt updates matching prompt", async () => {
    const updated = prompt("1", { name: "new" });
    const api = makeApi({
      create: vi.fn().mockResolvedValue({ success: true, prompt: prompt("1") }),
      update: vi.fn().mockResolvedValue({ success: true, prompt: updated }),
    });
    const s = makeStore(api);
    await s.getState().addPrompt({ name: "n", text: "t" });
    await s.getState().editPrompt("1", { name: "new" });
    expect(s.getState().prompts[0].name).toBe("new");
  });

  it("editPrompt skips on failure", async () => {
    const api = makeApi({
      create: vi.fn().mockResolvedValue({ success: true, prompt: prompt("1") }),
      update: vi.fn().mockResolvedValue({ success: false }),
    });
    const s = makeStore(api);
    await s.getState().addPrompt({ name: "n", text: "t" });
    await s.getState().editPrompt("1", { name: "x" });
    expect(s.getState().prompts[0].name).toBe("n1");
  });

  it("removePrompt filters out", async () => {
    const api = makeApi({
      create: vi.fn().mockResolvedValue({ success: true, prompt: prompt("1") }),
    });
    const s = makeStore(api);
    await s.getState().addPrompt({ name: "n", text: "t" });
    await s.getState().removePrompt("1");
    expect(s.getState().prompts).toEqual([]);
    expect(api.prompts.delete).toHaveBeenCalledWith("1");
  });

  it("addFolder prepends and returns id", async () => {
    const api = makeApi({
      createFolder: vi
        .fn()
        .mockResolvedValue({ success: true, folder: folder("a") }),
    });
    const s = makeStore(api);
    const id = await s.getState().addFolder("a");
    expect(id).toBe("a");
    expect(s.getState().folders).toEqual([folder("a")]);
  });

  it("addFolder returns null on failure", async () => {
    const api = makeApi({
      createFolder: vi.fn().mockResolvedValue({ success: false }),
    });
    const s = makeStore(api);
    const id = await s.getState().addFolder("a");
    expect(id).toBeNull();
    expect(s.getState().folders).toEqual([]);
  });

  it("renameFolder updates matching folder", async () => {
    const api = makeApi({
      createFolder: vi
        .fn()
        .mockResolvedValue({ success: true, folder: folder("a") }),
      renameFolder: vi.fn().mockResolvedValue({
        success: true,
        folder: folder("a", "renamed"),
      }),
    });
    const s = makeStore(api);
    await s.getState().addFolder("a");
    await s.getState().renameFolder("a", "renamed");
    expect(s.getState().folders[0].name).toBe("renamed");
  });

  it("renameFolder skips on failure", async () => {
    const api = makeApi({
      createFolder: vi
        .fn()
        .mockResolvedValue({ success: true, folder: folder("a") }),
      renameFolder: vi.fn().mockResolvedValue({ success: false }),
    });
    const s = makeStore(api);
    await s.getState().addFolder("a");
    await s.getState().renameFolder("a", "x");
    expect(s.getState().folders[0].name).toBe("fa");
  });

  it("removeFolder deletes and refreshes prompts+folders", async () => {
    const api = makeApi({
      list: vi.fn().mockResolvedValue([prompt("z")]),
      listFolders: vi.fn().mockResolvedValue([folder("kept")]),
    });
    const s = makeStore(api);
    await s.getState().removeFolder("a");
    expect(api.prompts.deleteFolder).toHaveBeenCalledWith("a");
    expect(s.getState().prompts).toEqual([prompt("z")]);
    expect(s.getState().folders).toEqual([folder("kept")]);
  });
});
