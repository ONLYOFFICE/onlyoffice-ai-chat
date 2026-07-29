import { describe, expect, it, vi } from "vitest";
import { createStores } from "../create-stores";
import type { AppContext } from "../../../app-context";
import type { ServerAPI } from "../../providers/ApiProvider";
import type { StoreKeys } from "../../../config";

vi.mock("../../../capabilities", () => ({
  inferCapabilities: vi.fn(() => 0xff),
}));

function makeConfig() {
  const ctx = {
    platform: {
      env: { theme: "light", devicePixelRatio: 1 },
      file: null,
      process: null,
      hostTools: null,
      clouds: null,
    },
    callbacksManager: { emit: vi.fn() },
    middlewareRunner: {},
    onlyofficeConfig: undefined,
    hiddenProviders: undefined,
    hiddenWebSearchProviders: undefined,
    servers: {
      getTools: vi.fn().mockResolvedValue({}),
      getServerType: vi.fn(),
      callTools: vi.fn(),
      startCustomServers: vi.fn(),
      setCustomServers: vi.fn(),
      deleteCustomServer: vi.fn(),
      getCustomServersLogs: vi.fn(() => ({})),
    },
  } as unknown as AppContext;

  const api = {
    threads: { list: vi.fn().mockResolvedValue([]) },
    profiles: { list: vi.fn().mockResolvedValue([]) },
    assignments: {
      getAllAssignments: vi.fn().mockResolvedValue({}),
    },
    attachments: {
      saveFile: vi.fn(),
      saveImage: vi.fn(),
      get: vi.fn(),
      getMany: vi.fn(),
      delete: vi.fn(),
      linkToMessage: vi.fn(),
    },
    preferences: { getDeepMode: vi.fn().mockResolvedValue(false) },
    tools: {
      getDisabled: vi.fn().mockResolvedValue({}),
      listCustomServers: vi.fn().mockResolvedValue({}),
    },
    webSearch: { isConfigured: vi.fn().mockResolvedValue(false) },
  } as unknown as ServerAPI;

  return {
    keys: {} as StoreKeys,
    ctx,
    api,
  };
}

describe("createStores", () => {
  it("returns the full Stores bundle", () => {
    const stores = createStores(makeConfig());
    expect(typeof stores.useMessageStore).toBe("function");
    expect(typeof stores.useProfilesStore).toBe("function");
    expect(typeof stores.useThreadsStore).toBe("function");
    expect(typeof stores.useServersStore).toBe("function");
    expect(typeof stores.usePromptsStore).toBe("function");
    expect(typeof stores.useAttachmentsStore).toBe("function");
    expect(typeof stores.useThemeStore).toBe("function");
    expect(typeof stores.useRouter).toBe("function");
    expect(typeof stores.useCloudsStore).toBe("function");
    expect(stores.callbacksManager).toBeDefined();
    expect(stores.api).toBeDefined();
    expect(typeof stores.selectCurrentChatProfile).toBe("function");
  });

  it("each call produces independent stores", () => {
    const a = createStores(makeConfig());
    const b = createStores(makeConfig());
    expect(a.useMessageStore).not.toBe(b.useMessageStore);
  });

  it("selectCurrentChatProfile prefers session > chat > default", () => {
    const stores = createStores(makeConfig());
    const session = { id: "s" } as never;
    const chat = { id: "c" } as never;
    const def = { id: "d" } as never;

    expect(
      stores.selectCurrentChatProfile({
        sessionChatProfile: session,
        chatProfile: chat,
        defaultProfile: def,
      } as never)
    ).toEqual(session);
    expect(
      stores.selectCurrentChatProfile({
        sessionChatProfile: null,
        chatProfile: chat,
        defaultProfile: def,
      } as never)
    ).toEqual(chat);
    expect(
      stores.selectCurrentChatProfile({
        sessionChatProfile: null,
        chatProfile: null,
        defaultProfile: def,
      } as never)
    ).toEqual(def);
    expect(
      stores.selectCurrentChatProfile({
        sessionChatProfile: null,
        chatProfile: null,
        defaultProfile: null,
      } as never)
    ).toBeNull();
  });

  it("threads paginate when enablePagination is set", async () => {
    const config = makeConfig();
    const stores = createStores({ ...config, enablePagination: true });
    await stores.useThreadsStore.getState().initThreads("e1");
    expect(config.api.threads.list).toHaveBeenCalledWith("e1", 100);
  });

  it("threads load unbounded without the flag", async () => {
    const config = makeConfig();
    const stores = createStores(config);
    await stores.useThreadsStore.getState().initThreads("e1");
    expect(config.api.threads.list).toHaveBeenCalledWith("e1");
  });
});
