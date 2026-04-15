import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppContext } from "../../app-context";
import type { StoreKeys } from "../../config";
import type { ProfilesService } from "../../services/profiles";
import type { Profile } from "../../types";
import { createProfilesStore } from "../create-profiles-store";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../services/action-holders", () => ({
  initActionHolders: vi.fn(),
  applyProfileToAction: vi.fn(),
}));

vi.mock("../../capabilities", () => ({
  ActionType: {
    Chat: "Chat",
    Summarization: "Summarization",
    Translation: "Translation",
    TextAnalyze: "TextAnalyze",
    ImageGeneration: "ImageGeneration",
    OCR: "OCR",
    Vision: "Vision",
  },
  inferCapabilities: vi.fn().mockReturnValue(0x01),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(id: string, overrides?: Partial<Profile>): Profile {
  return {
    id,
    name: `Profile ${id}`,
    providerType: "openai",
    baseUrl: "https://api.openai.com",
    key: "key-" + id,
    modelId: "gpt-4",
    ...overrides,
  };
}

function makeKeys(): StoreKeys {
  return {
    defaultProfile: "default",
    chatProfile: "chat",
    summarizationProfile: "summarization",
    translationProfile: "translation",
    textAnalysisProfile: "textAnalysis",
    imageGenerationProfile: "imageGeneration",
    ocrProfile: "ocr",
    visionProfile: "vision",
    deepMode: "deepMode",
    mcpServers: "mcpServers",
    disabledTools: "disabledTools",
  };
}

function makeCtx(): AppContext {
  return {
    settings: {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
    },
    callbacksManager: {
      emit: vi.fn(),
      setCallbacks: vi.fn(),
      getCallbacks: vi.fn().mockReturnValue({}),
    },
  } as unknown as AppContext;
}

function makeService(overrides?: Partial<ProfilesService>): ProfilesService {
  return {
    init: vi.fn().mockResolvedValue({
      profiles: [],
      defaultProfile: null,
      taskProfiles: {},
    }),
    addProfile: vi.fn().mockResolvedValue({
      success: true,
      profile: makeProfile("new"),
    }),
    editProfile: vi.fn().mockResolvedValue({ success: true }),
    deleteProfile: vi.fn().mockResolvedValue(undefined),
    setTaskProfile: vi.fn(),
    clearTaskProfileIfMatch: vi
      .fn()
      .mockImplementation((p: Profile | null, id: string) =>
        p?.id === id ? null : p
      ),
    reassignDefault: vi
      .fn()
      .mockImplementation((profiles: Profile[]) => profiles[0] ?? null),
    applyCurrentChatProvider: vi.fn(),
    ...overrides,
  } as unknown as ProfilesService;
}

describe("createProfilesStore", () => {
  let keys: StoreKeys;
  let ctx: AppContext;
  let service: ProfilesService;

  beforeEach(() => {
    vi.clearAllMocks();
    keys = makeKeys();
    ctx = makeCtx();
    service = makeService();
  });

  function createStore() {
    return createProfilesStore({
      keys,
      profilesService: service,
      ctx,
    });
  }

  it("starts with empty profiles and null defaults", () => {
    const store = createStore();
    const state = store.getState();
    expect(state.profiles).toEqual([]);
    expect(state.defaultProfile).toBeNull();
    expect(state.chatProfile).toBeNull();
    expect(state.extendedThinking).toBe(false);
  });

  describe("init", () => {
    it("loads profiles from service", async () => {
      const profiles = [makeProfile("1"), makeProfile("2")];
      service = makeService({
        init: vi.fn().mockResolvedValue({
          profiles,
          defaultProfile: profiles[0],
          taskProfiles: { chat: profiles[1] },
        }),
      } as unknown as Partial<ProfilesService>);
      const store = createStore();

      await store.getState().init();

      expect(store.getState().profiles).toHaveLength(2);
      expect(store.getState().defaultProfile).toEqual(profiles[0]);
    });
  });

  describe("addProfile", () => {
    it("adds profile and returns true", async () => {
      const store = createStore();
      const result = await store.getState().addProfile({
        name: "New",
        providerType: "openai",
        baseUrl: "https://api.openai.com",
        key: "k",
        modelId: "gpt-4",
      });
      expect(result).toBe(true);
      expect(store.getState().profiles).toHaveLength(1);
    });

    it("sets first profile as default", async () => {
      const store = createStore();
      await store.getState().addProfile({
        name: "First",
        providerType: "openai",
        baseUrl: "https://api.openai.com",
        key: "k",
        modelId: "gpt-4",
      });
      expect(service.setTaskProfile).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({ id: "new" })
      );
    });

    it("returns error on failure", async () => {
      const errorData = { code: "DUPLICATE" };
      service = makeService({
        addProfile: vi
          .fn()
          .mockResolvedValue({ success: false, error: errorData }),
      } as unknown as Partial<ProfilesService>);
      const store = createStore();
      const result = await store.getState().addProfile({
        name: "Dup",
        providerType: "openai",
        baseUrl: "",
        key: "",
        modelId: "",
      });
      expect(result).toEqual(errorData);
    });
  });

  describe("editProfile", () => {
    it("updates profile in state", async () => {
      const store = createStore();
      store.setState({ profiles: [makeProfile("1")] });
      const edited = makeProfile("1", { name: "Updated" });
      const result = await store.getState().editProfile(edited);
      expect(result).toBe(true);
      expect(store.getState().profiles[0].name).toBe("Updated");
    });
  });

  describe("deleteProfile", () => {
    it("removes profile from state", async () => {
      const store = createStore();
      store.setState({
        profiles: [makeProfile("1"), makeProfile("2")],
        defaultProfile: makeProfile("1"),
      });
      await store.getState().deleteProfile("1");
      expect(store.getState().profiles).toHaveLength(1);
      expect(service.deleteProfile).toHaveBeenCalledWith("1");
    });
  });

  describe("getProfileById", () => {
    it("finds profile by id", () => {
      const store = createStore();
      store.setState({ profiles: [makeProfile("1"), makeProfile("2")] });
      expect(store.getState().getProfileById("2")).toEqual(makeProfile("2"));
    });

    it("returns null for unknown id", () => {
      const store = createStore();
      expect(store.getState().getProfileById("nope")).toBeNull();
    });
  });

  describe("getProfileByName", () => {
    it("finds profile by exact name", () => {
      const store = createStore();
      store.setState({ profiles: [makeProfile("1")] });
      expect(store.getState().getProfileByName("Profile 1")).toEqual(
        makeProfile("1")
      );
    });

    it("finds profile by name case-insensitive", () => {
      const store = createStore();
      store.setState({ profiles: [makeProfile("1")] });
      expect(store.getState().getProfileByName("profile 1", true)).toEqual(
        makeProfile("1")
      );
    });

    it("returns null for unknown name", () => {
      const store = createStore();
      expect(store.getState().getProfileByName("nope")).toBeNull();
    });
  });

  describe("setSessionChatProfile", () => {
    it("sets session profile and calls applyCurrentChatProvider", () => {
      const store = createStore();
      const profile = makeProfile("1");
      store.getState().setSessionChatProfile(profile);
      expect(store.getState().sessionChatProfile).toEqual(profile);
      expect(service.applyCurrentChatProvider).toHaveBeenCalled();
    });
  });

  describe("toggleExtendedThinking", () => {
    it("toggles extended thinking and persists", () => {
      const store = createStore();
      expect(store.getState().extendedThinking).toBe(false);
      store.getState().toggleExtendedThinking();
      expect(store.getState().extendedThinking).toBe(true);
      expect(
        (ctx.settings as { set: ReturnType<typeof vi.fn> }).set
      ).toHaveBeenCalledWith("deepMode", "true");
    });
  });
});
