import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppContext } from "../../../app-context";

const mockLoggerError = vi.fn();
vi.mock("../../../shared/logger", () => ({
  default: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: () => {},
    log: () => {},
    info: () => {},
  },
}));

import {
  createCloudsStore,
  type CreateCloudsStoreConfig,
} from "../create-clouds-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(clouds: AppContext["platform"]["clouds"] = null): AppContext {
  return {
    platform: { clouds },
    // The store must never read context data from here — see the api mock.
    storage: {},
  } as unknown as AppContext;
}

type ContextApi = {
  getContextFolders: ReturnType<typeof vi.fn>;
  getRoomSkills: ReturnType<typeof vi.fn>;
};

function makeApi(context: Partial<ContextApi> = {}) {
  return {
    context: {
      getContextFolders: vi.fn().mockResolvedValue([]),
      getRoomSkills: vi.fn().mockResolvedValue([]),
      ...context,
    },
  };
}

const makeStore = (
  clouds: AppContext["platform"]["clouds"] = null,
  context: Partial<ContextApi> = {}
) =>
  createCloudsStore({
    ctx: makeCtx(clouds),
    api: makeApi(context) as unknown as CreateCloudsStoreConfig["api"],
  });

describe("createCloudsStore", () => {
  it("returns a store with initial empty cloudProviders", () => {
    const store = makeStore();
    expect(store.getState().cloudProviders).toEqual([]);
  });

  describe("fetchClouds", () => {
    it("sets empty array when ctx.platform.clouds is null", async () => {
      const store = makeStore(null);
      await store.getState().fetchClouds();
      expect(store.getState().cloudProviders).toEqual([]);
    });

    it("sets empty array when ctx.platform.clouds is undefined", async () => {
      const store = makeStore(undefined as unknown as null);
      await store.getState().fetchClouds();
      expect(store.getState().cloudProviders).toEqual([]);
    });

    it("maps clouds with matching keys correctly", async () => {
      const clouds = {
        getClouds: vi
          .fn()
          .mockResolvedValue([
            { portal: "https://cloud.example.com" },
            { portal: "https://other.example.com" },
          ]),
        getCloudKeys: vi.fn().mockReturnValue([
          {
            url: "https://cloud.example.com",
            keys: [{ id: "k1", value: "api-key-1" }],
          },
          {
            url: "https://other.example.com",
            keys: [{ id: "k2", value: "api-key-2" }],
          },
        ]),
      };

      const store = makeStore(clouds);
      await store.getState().fetchClouds();

      expect(store.getState().cloudProviders).toEqual([
        {
          url: "https://cloud.example.com",
          label: "cloud.example.com",
          apiKey: "api-key-1",
        },
        {
          url: "https://other.example.com",
          label: "other.example.com",
          apiKey: "api-key-2",
        },
      ]);
    });

    it("skips clouds with no matching key", async () => {
      const clouds = {
        getClouds: vi
          .fn()
          .mockResolvedValue([
            { portal: "https://cloud.example.com" },
            { portal: "https://unknown.example.com" },
          ]),
        getCloudKeys: vi.fn().mockReturnValue([
          {
            url: "https://cloud.example.com",
            keys: [{ id: "k1", value: "api-key-1" }],
          },
        ]),
      };

      const store = makeStore(clouds);
      await store.getState().fetchClouds();

      expect(store.getState().cloudProviders).toEqual([
        {
          url: "https://cloud.example.com",
          label: "cloud.example.com",
          apiKey: "api-key-1",
        },
      ]);
    });

    it("skips clouds where key has no value", async () => {
      const clouds = {
        getClouds: vi
          .fn()
          .mockResolvedValue([
            { portal: "https://cloud.example.com" },
            { portal: "https://nokey.example.com" },
          ]),
        getCloudKeys: vi.fn().mockReturnValue([
          {
            url: "https://cloud.example.com",
            keys: [{ id: "k1", value: "api-key-1" }],
          },
          {
            url: "https://nokey.example.com",
            keys: [],
          },
        ]),
      };

      const store = makeStore(clouds);
      await store.getState().fetchClouds();

      expect(store.getState().cloudProviders).toEqual([
        {
          url: "https://cloud.example.com",
          label: "cloud.example.com",
          apiKey: "api-key-1",
        },
      ]);
    });

    it("extracts hostname as label from cloud portal URL", async () => {
      const clouds = {
        getClouds: vi
          .fn()
          .mockResolvedValue([
            { portal: "https://my-docs.onlyoffice.io/some/path" },
          ]),
        getCloudKeys: vi.fn().mockReturnValue([
          {
            url: "https://my-docs.onlyoffice.io/some/path",
            keys: [{ id: "k1", value: "key-abc" }],
          },
        ]),
      };

      const store = makeStore(clouds);
      await store.getState().fetchClouds();

      const providers = store.getState().cloudProviders;
      expect(providers).toHaveLength(1);
      expect(providers[0].label).toBe("my-docs.onlyoffice.io");
    });
  });

  describe("fetchContextFolders", () => {
    beforeEach(() => {
      mockLoggerError.mockClear();
    });

    it("starts empty", () => {
      const store = makeStore();
      expect(store.getState().contextFolders).toEqual([]);
    });

    it("stays empty when the engine answers [] (host without the method)", async () => {
      const store = makeStore();
      await store.getState().fetchContextFolders();
      expect(store.getState().contextFolders).toEqual([]);
    });

    it("stores what the api returned", async () => {
      const folders = [
        { cloud: "a.example.com", rooms: [{ id: "r1", name: "Room 1" }] },
      ];
      const getContextFolders = vi.fn().mockResolvedValue(folders);
      const store = makeStore(null, { getContextFolders });
      await store.getState().fetchContextFolders();
      expect(getContextFolders).toHaveBeenCalledWith();
      expect(store.getState().contextFolders).toEqual(folders);
    });

    it("stays empty when the api returns no clouds", async () => {
      const storage = { getContextFolders: vi.fn().mockResolvedValue([]) };
      const store = makeStore(null, storage);
      await store.getState().fetchContextFolders();
      expect(store.getState().contextFolders).toEqual([]);
    });

    it("replaces a previous result rather than merging", async () => {
      const getContextFolders = vi
        .fn()
        .mockResolvedValueOnce([
          { cloud: "a.example.com", rooms: [{ id: "r1", name: "Room 1" }] },
        ])
        .mockResolvedValueOnce([
          { cloud: "b.example.com", rooms: [{ id: "r2", name: "Room 2" }] },
        ]);
      const store = makeStore(null, { getContextFolders });
      await store.getState().fetchContextFolders();
      await store.getState().fetchContextFolders();
      expect(store.getState().contextFolders.map((f) => f.cloud)).toEqual([
        "b.example.com",
      ]);
    });

    it("drops clouds that have no rooms", async () => {
      const storage = {
        getContextFolders: vi.fn().mockResolvedValue([
          { cloud: "empty.example.com", rooms: [] },
          { cloud: "full.example.com", rooms: [{ id: "r1", name: "Room" }] },
        ]),
      };
      const store = makeStore(null, storage);
      await store.getState().fetchContextFolders();
      expect(store.getState().contextFolders.map((f) => f.cloud)).toEqual([
        "full.example.com",
      ]);
    });

    it("resets to empty and swallows a failing read", async () => {
      const storage = {
        getContextFolders: vi.fn().mockRejectedValue(new Error("boom")),
      };
      const store = makeStore(null, storage);
      store.setState({
        contextFolders: [{ cloud: "x", rooms: [{ id: "1", name: "n" }] }],
      });
      await expect(
        store.getState().fetchContextFolders()
      ).resolves.toBeUndefined();
      expect(store.getState().contextFolders).toEqual([]);
      expect(mockLoggerError).toHaveBeenCalledWith(
        "[clouds-store] getContextFolders failed",
        expect.any(Error)
      );
    });

    it("does not log when the read succeeds", async () => {
      const storage = { getContextFolders: vi.fn().mockResolvedValue([]) };
      const store = makeStore(null, storage);
      await store.getState().fetchContextFolders();
      expect(mockLoggerError).not.toHaveBeenCalled();
    });
  });

  describe("selectContextFolder", () => {
    it("starts with nothing selected", () => {
      const store = makeStore();
      expect(store.getState().selectedContextFolder).toBeNull();
    });

    it("keeps the picked room together with its cloud", () => {
      const store = makeStore();
      store.getState().selectContextFolder("a.example.com", {
        id: "r1",
        name: "Room 1",
      });
      expect(store.getState().selectedContextFolder).toEqual({
        cloud: "a.example.com",
        room: { id: "r1", name: "Room 1" },
      });
    });

    it("replaces the previous pick — one room at a time", () => {
      const store = makeStore();
      store.getState().selectContextFolder("a.example.com", {
        id: "r1",
        name: "Room 1",
      });
      store.getState().selectContextFolder("b.example.com", {
        id: "r1",
        name: "Other room",
      });
      expect(store.getState().selectedContextFolder).toEqual({
        cloud: "b.example.com",
        room: { id: "r1", name: "Other room" },
      });
    });

    it("clearContextFolder drops the pick", () => {
      const store = makeStore();
      store.getState().selectContextFolder("a.example.com", {
        id: "r1",
        name: "Room 1",
      });
      store.getState().clearContextFolder();
      expect(store.getState().selectedContextFolder).toBeNull();
    });

    it("a fetch does not touch the selection", async () => {
      const store = makeStore();
      store.getState().selectContextFolder("a.example.com", {
        id: "r1",
        name: "Room 1",
      });
      await store.getState().fetchContextFolders();
      expect(store.getState().selectedContextFolder).not.toBeNull();
    });
  });

  describe("room skills", () => {
    const pick = (store: ReturnType<typeof createCloudsStore>) =>
      store
        .getState()
        .selectContextFolder("a.example.com", { id: "r1", name: "Room 1" });

    beforeEach(() => {
      mockLoggerError.mockClear();
    });

    it("start empty with nothing disabled", () => {
      const store = makeStore();
      expect(store.getState().roomSkills).toEqual([]);
      expect(store.getState().disabledSkillIds).toEqual([]);
    });

    it("fetch is a no-op without a connected room", async () => {
      const getRoomSkills = vi.fn().mockResolvedValue([{ id: "s", name: "S" }]);
      const store = makeStore(null, { getRoomSkills });
      await store.getState().fetchRoomSkills();
      expect(getRoomSkills).not.toHaveBeenCalled();
      expect(store.getState().roomSkills).toEqual([]);
    });

    it("stays empty when the engine answers [] for skills", async () => {
      const store = makeStore();
      pick(store);
      await store.getState().fetchRoomSkills();
      expect(store.getState().roomSkills).toEqual([]);
    });

    it("reads the connected room's skills through the api with cloud and room id", async () => {
      const skills = [
        { id: "s1", name: "Skill 1" },
        { id: "s2", name: "Skill 2" },
      ];
      const getRoomSkills = vi.fn().mockResolvedValue(skills);
      const store = makeStore(null, { getRoomSkills });
      pick(store);
      await store.getState().fetchRoomSkills();
      expect(getRoomSkills).toHaveBeenCalledWith("a.example.com", "r1");
      expect(store.getState().roomSkills).toEqual(skills);
    });

    it("ignores a late answer for a room that is no longer connected", async () => {
      let resolveFirst!: (v: unknown) => void;
      const getRoomSkills = vi
        .fn()
        .mockImplementationOnce(
          () => new Promise((resolve) => (resolveFirst = resolve))
        )
        .mockResolvedValueOnce([{ id: "s2", name: "Second room skill" }]);
      const store = makeStore(null, { getRoomSkills });
      pick(store);
      const first = store.getState().fetchRoomSkills();
      store
        .getState()
        .selectContextFolder("b.example.com", { id: "r2", name: "Room 2" });
      await store.getState().fetchRoomSkills();
      resolveFirst([{ id: "s1", name: "First room skill" }]);
      await first;
      expect(store.getState().roomSkills).toEqual([
        { id: "s2", name: "Second room skill" },
      ]);
    });

    it("resets to empty and logs a failing read", async () => {
      const store = makeStore(null, {
        getRoomSkills: vi.fn().mockRejectedValue(new Error("boom")),
      });
      pick(store);
      store.setState({ roomSkills: [{ id: "old", name: "Old" }] });
      await expect(store.getState().fetchRoomSkills()).resolves.toBeUndefined();
      expect(store.getState().roomSkills).toEqual([]);
      expect(mockLoggerError).toHaveBeenCalledWith(
        "[clouds-store] getRoomSkills failed",
        expect.any(Error)
      );
    });

    it("setSkillEnabled(false) disables, (true) re-enables, without duplicates", () => {
      const store = makeStore();
      store.getState().setSkillEnabled("s1", false);
      store.getState().setSkillEnabled("s1", false);
      store.getState().setSkillEnabled("s2", false);
      expect(store.getState().disabledSkillIds).toEqual(["s1", "s2"]);
      store.getState().setSkillEnabled("s1", true);
      expect(store.getState().disabledSkillIds).toEqual(["s2"]);
      store.getState().setSkillEnabled("never-disabled", true);
      expect(store.getState().disabledSkillIds).toEqual(["s2"]);
    });

    it("selecting a different room resets skills and switches", () => {
      const store = makeStore();
      pick(store);
      store.setState({ roomSkills: [{ id: "s1", name: "S" }] });
      store.getState().setSkillEnabled("s1", false);
      store
        .getState()
        .selectContextFolder("a.example.com", { id: "r2", name: "Room 2" });
      expect(store.getState().roomSkills).toEqual([]);
      expect(store.getState().disabledSkillIds).toEqual([]);
    });

    it("re-picking the connected room keeps its skills and switches", () => {
      const store = makeStore();
      pick(store);
      const before = store.getState().selectedContextFolder;
      store.setState({ roomSkills: [{ id: "s1", name: "S" }] });
      store.getState().setSkillEnabled("s1", false);
      pick(store);
      expect(store.getState().roomSkills).toEqual([{ id: "s1", name: "S" }]);
      expect(store.getState().disabledSkillIds).toEqual(["s1"]);
      // Same object, so subscribers keyed on it do not re-run.
      expect(store.getState().selectedContextFolder).toBe(before);
    });

    it("clearContextFolder resets skills and switches too", () => {
      const store = makeStore();
      pick(store);
      store.setState({ roomSkills: [{ id: "s1", name: "S" }] });
      store.getState().setSkillEnabled("s1", false);
      store.getState().clearContextFolder();
      expect(store.getState().roomSkills).toEqual([]);
      expect(store.getState().disabledSkillIds).toEqual([]);
    });
  });
});
