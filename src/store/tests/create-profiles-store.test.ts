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
  refreshActionHolderSystemPrompts: vi.fn(),
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
    systemPromptAppendix: "systemPromptAppendix",
  };
}

function makeCtx(): AppContext {
  return {
    settings: {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      remove: vi.fn(),
    },
    callbacksManager: {
      emit: vi.fn(),
      setCallbacks: vi.fn(),
      getCallbacks: vi.fn().mockReturnValue({}),
    },
    servers: {
      setImageGenerationEnabled: vi.fn(),
      getImageGenerationEnabled: vi.fn().mockReturnValue(false),
    },
    provider: {
      refreshSystemPrompt: vi.fn(),
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
    loadProfileById: vi.fn().mockReturnValue(null),
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

    it("toggleExtendedThinking emits onExtendedThinkingUpdated", () => {
      const store = createStore();
      const emit = ctx.callbacksManager.emit as unknown as ReturnType<
        typeof vi.fn
      >;
      store.getState().toggleExtendedThinking();
      expect(emit).toHaveBeenCalledWith("onExtendedThinkingUpdated", {
        enabled: true,
      });
    });
  });

  describe("reloadExtendedThinking", () => {
    it("re-reads the flag from settings and emits when it changes", () => {
      const store = createStore();
      expect(store.getState().extendedThinking).toBe(false);

      const settings = ctx.settings as unknown as {
        get: ReturnType<typeof vi.fn>;
      };
      settings.get.mockReturnValueOnce("true");

      store.getState().reloadExtendedThinking();

      expect(store.getState().extendedThinking).toBe(true);
      const emit = ctx.callbacksManager.emit as unknown as ReturnType<
        typeof vi.fn
      >;
      expect(emit).toHaveBeenCalledWith("onExtendedThinkingUpdated", {
        enabled: true,
      });
    });

    it("does not emit when the flag is unchanged", () => {
      const store = createStore();
      const settings = ctx.settings as unknown as {
        get: ReturnType<typeof vi.fn>;
      };
      settings.get.mockReturnValueOnce("false");

      store.getState().reloadExtendedThinking();

      const emit = ctx.callbacksManager.emit as unknown as ReturnType<
        typeof vi.fn
      >;
      expect(emit).not.toHaveBeenCalledWith(
        "onExtendedThinkingUpdated",
        expect.anything()
      );
    });

    it("treats invalid JSON in settings as disabled", () => {
      const store = createStore();
      store.setState({ extendedThinking: true });

      const settings = ctx.settings as unknown as {
        get: ReturnType<typeof vi.fn>;
      };
      settings.get.mockReturnValueOnce("not-json{{");

      store.getState().reloadExtendedThinking();

      expect(store.getState().extendedThinking).toBe(false);
    });
  });

  describe("systemPromptAppendix", () => {
    const getSettings = () =>
      ctx.settings as unknown as {
        get: ReturnType<typeof vi.fn>;
        set: ReturnType<typeof vi.fn>;
        remove: ReturnType<typeof vi.fn>;
      };
    const getEmit = () =>
      ctx.callbacksManager.emit as unknown as ReturnType<typeof vi.fn>;

    it("defaults to empty string when settings has no value", () => {
      const store = createStore();
      expect(store.getState().systemPromptAppendix).toBe("");
    });

    it("reads the persisted value as JSON string on init", () => {
      getSettings().get.mockImplementation((k: string) =>
        k === "systemPromptAppendix" ? JSON.stringify("Be concise.") : null
      );
      const store = createStore();
      expect(store.getState().systemPromptAppendix).toBe("Be concise.");
    });

    it("setSystemPromptAppendix persists as JSON, refreshes prompts, emits event", () => {
      const store = createStore();
      store.getState().setSystemPromptAppendix("Be formal.");
      expect(store.getState().systemPromptAppendix).toBe("Be formal.");
      expect(getSettings().set).toHaveBeenCalledWith(
        "systemPromptAppendix",
        JSON.stringify("Be formal.")
      );
      const provider = ctx.provider as unknown as {
        refreshSystemPrompt: ReturnType<typeof vi.fn>;
      };
      expect(provider.refreshSystemPrompt).toHaveBeenCalled();
      expect(getEmit()).toHaveBeenCalledWith("onSystemPromptAppendixUpdated", {
        appendix: "Be formal.",
      });
    });

    it("setSystemPromptAppendix does not emit when unchanged", () => {
      const store = createStore();
      store.getState().setSystemPromptAppendix("Be formal.");
      getEmit().mockClear();
      store.getState().setSystemPromptAppendix("Be formal.");
      expect(getEmit()).not.toHaveBeenCalledWith(
        "onSystemPromptAppendixUpdated",
        expect.anything()
      );
    });

    it("clearSystemPromptAppendix removes the key and emits empty value", () => {
      const store = createStore();
      store.getState().setSystemPromptAppendix("Be formal.");
      getEmit().mockClear();

      store.getState().clearSystemPromptAppendix();
      expect(store.getState().systemPromptAppendix).toBe("");
      expect(getSettings().remove).toHaveBeenCalledWith("systemPromptAppendix");
      expect(getEmit()).toHaveBeenCalledWith("onSystemPromptAppendixUpdated", {
        appendix: "",
      });
    });

    it("reloadSystemPromptAppendix re-reads from settings and emits on change", () => {
      const store = createStore();
      getSettings().get.mockImplementation((k: string) =>
        k === "systemPromptAppendix"
          ? JSON.stringify("Respond in French.")
          : null
      );

      store.getState().reloadSystemPromptAppendix();
      expect(store.getState().systemPromptAppendix).toBe("Respond in French.");
      expect(getEmit()).toHaveBeenCalledWith("onSystemPromptAppendixUpdated", {
        appendix: "Respond in French.",
      });
    });

    it("reloadSystemPromptAppendix falls back to empty on malformed JSON", () => {
      const store = createStore();
      store.setState({ systemPromptAppendix: "something" });
      getSettings().get.mockImplementation((k: string) =>
        k === "systemPromptAppendix" ? "not-json{{" : null
      );

      store.getState().reloadSystemPromptAppendix();
      expect(store.getState().systemPromptAppendix).toBe("");
    });
  });

  describe("callbacks", () => {
    const getEmit = () =>
      ctx.callbacksManager.emit as unknown as ReturnType<typeof vi.fn>;

    it("addProfile emits onProfileCreated + onProfilesUpdated", async () => {
      const store = createStore();
      await store.getState().addProfile({
        name: "New",
        providerType: "openai",
        baseUrl: "https://api.openai.com",
        key: "k",
        modelId: "gpt-4",
      });
      expect(getEmit()).toHaveBeenCalledWith(
        "onProfileCreated",
        expect.objectContaining({
          profile: expect.objectContaining({ id: "new" }),
        })
      );
      expect(getEmit()).toHaveBeenCalledWith("onProfilesUpdated", {
        kind: "created",
        profileId: "new",
      });
    });

    it("editProfile emits onProfileUpdated + onProfilesUpdated", async () => {
      const store = createStore();
      store.setState({ profiles: [makeProfile("1")] });
      const edited = makeProfile("1", { name: "Updated" });
      await store.getState().editProfile(edited);
      expect(getEmit()).toHaveBeenCalledWith("onProfileUpdated", {
        profile: edited,
      });
      expect(getEmit()).toHaveBeenCalledWith("onProfilesUpdated", {
        kind: "updated",
        profileId: "1",
      });
    });

    it("editProfile emits onCurrentChatProfileUpdated when editing the default profile while chat slot is unset", async () => {
      const store = createStore();
      const def = makeProfile("1");
      store.setState({
        profiles: [def],
        defaultProfile: def,
        chatProfile: null,
        sessionChatProfile: null,
      });
      const edited = makeProfile("1", { modelId: "gpt-4o" });
      await store.getState().editProfile(edited);
      expect(getEmit()).toHaveBeenCalledWith("onCurrentChatProfileUpdated", {
        profileId: "1",
        scope: "persisted",
        providerType: "openai",
        modelId: "gpt-4o",
      });
    });

    it("editProfile emits onCurrentChatProfileUpdated with scope=session when editing the active session profile", async () => {
      const store = createStore();
      const p = makeProfile("s");
      store.setState({
        profiles: [p],
        defaultProfile: makeProfile("d"),
        chatProfile: null,
        sessionChatProfile: p,
      });
      const edited = makeProfile("s", { modelId: "gpt-4o" });
      await store.getState().editProfile(edited);
      expect(getEmit()).toHaveBeenCalledWith("onCurrentChatProfileUpdated", {
        profileId: "s",
        scope: "session",
        providerType: "openai",
        modelId: "gpt-4o",
      });
    });

    it("editProfile does not emit onCurrentChatProfileUpdated for an unrelated profile", async () => {
      const store = createStore();
      store.setState({
        profiles: [makeProfile("1"), makeProfile("2")],
        defaultProfile: makeProfile("1"),
        chatProfile: null,
        sessionChatProfile: null,
      });
      await store.getState().editProfile(makeProfile("2", { name: "X" }));
      expect(getEmit()).not.toHaveBeenCalledWith(
        "onCurrentChatProfileUpdated",
        expect.anything()
      );
    });

    it("deleteProfile emits onProfileDeleted + onProfilesUpdated", async () => {
      const store = createStore();
      store.setState({ profiles: [makeProfile("1")] });
      await store.getState().deleteProfile("1");
      expect(getEmit()).toHaveBeenCalledWith("onProfileDeleted", {
        profileId: "1",
      });
      expect(getEmit()).toHaveBeenCalledWith("onProfilesUpdated", {
        kind: "deleted",
        profileId: "1",
      });
    });

    it("setDefaultProfile emits onModelAssignmentUpdated", () => {
      const store = createStore();
      const profile = makeProfile("d");
      store.getState().setDefaultProfile(profile);
      expect(getEmit()).toHaveBeenCalledWith("onModelAssignmentUpdated", {
        task: "default",
        profileId: "d",
      });
    });

    it("setChatProfile emits onProfileChanged + onModelAssignmentUpdated + onCurrentChatProfileUpdated", () => {
      const store = createStore();
      const profile = makeProfile("c");
      store.getState().setChatProfile(profile);
      expect(getEmit()).toHaveBeenCalledWith("onProfileChanged", {
        profileId: "c",
        providerType: "openai",
        modelId: "gpt-4",
      });
      expect(getEmit()).toHaveBeenCalledWith("onModelAssignmentUpdated", {
        task: "chat",
        profileId: "c",
      });
      expect(getEmit()).toHaveBeenCalledWith("onCurrentChatProfileUpdated", {
        profileId: "c",
        scope: "persisted",
        providerType: "openai",
        modelId: "gpt-4",
      });
    });

    it("setChatProfile(null) still emits assignment + current chat events", () => {
      const store = createStore();
      store.getState().setChatProfile(null);
      expect(getEmit()).toHaveBeenCalledWith("onModelAssignmentUpdated", {
        task: "chat",
        profileId: null,
      });
      expect(getEmit()).toHaveBeenCalledWith("onCurrentChatProfileUpdated", {
        profileId: null,
        scope: "persisted",
        providerType: undefined,
        modelId: undefined,
      });
      // onProfileChanged is only emitted when profile is non-null
      expect(getEmit()).not.toHaveBeenCalledWith(
        "onProfileChanged",
        expect.anything()
      );
    });

    it.each([
      ["setSummarizationProfile", "summarization"],
      ["setTranslationProfile", "translation"],
      ["setTextAnalysisProfile", "textAnalysis"],
      ["setImageGenerationProfile", "imageGeneration"],
      ["setOcrProfile", "ocr"],
      ["setVisionProfile", "vision"],
    ] as const)(
      "%s emits onModelAssignmentUpdated with task=%s",
      (setter, task) => {
        const store = createStore();
        const profile = makeProfile("p");
        (
          store.getState() as unknown as Record<
            string,
            (p: Profile | null) => void
          >
        )[setter](profile);
        expect(getEmit()).toHaveBeenCalledWith("onModelAssignmentUpdated", {
          task,
          profileId: "p",
        });
      }
    );

    it("setSessionChatProfile emits onCurrentChatProfileUpdated with scope=session", () => {
      const store = createStore();
      const profile = makeProfile("s");
      store.getState().setSessionChatProfile(profile);
      expect(getEmit()).toHaveBeenCalledWith("onCurrentChatProfileUpdated", {
        profileId: "s",
        scope: "session",
        providerType: "openai",
        modelId: "gpt-4",
      });
    });
  });

  describe("external reload methods", () => {
    it("reloadProfiles re-reads the profile list only", async () => {
      const fresh = [makeProfile("x"), makeProfile("y")];
      service = makeService({
        init: vi.fn().mockResolvedValue({
          profiles: fresh,
          defaultProfile: null,
          taskProfiles: {},
        }),
      } as unknown as Partial<ProfilesService>);
      const store = createStore();
      store.setState({
        profiles: [makeProfile("old")],
        chatProfile: makeProfile("chat"),
      });

      await store.getState().reloadProfiles();

      expect(store.getState().profiles).toEqual(fresh);
      // chatProfile must stay intact — reloadProfiles only touches the list
      expect(store.getState().chatProfile?.id).toBe("chat");
    });

    it("reloadCurrentChat re-reads chatProfile via loadProfileById and re-applies it", () => {
      const chat = makeProfile("c");
      service = makeService({
        loadProfileById: vi
          .fn()
          .mockImplementation((_p, key) => (key === "chat" ? chat : null)),
      } as unknown as Partial<ProfilesService>);
      const store = createStore();
      store.setState({ profiles: [chat], chatProfile: null });

      store.getState().reloadCurrentChat();

      expect(service.loadProfileById).toHaveBeenCalledWith([chat], "chat");
      expect(store.getState().chatProfile).toEqual(chat);
      expect(service.applyCurrentChatProvider).toHaveBeenCalled();
    });

    it("reloadCurrentChat also re-reads defaultProfile so fallback chat picks up external default changes", () => {
      const oldDef = makeProfile("old");
      const newDef = makeProfile("new");
      service = makeService({
        loadProfileById: vi.fn().mockImplementation((_p, key) => {
          if (key === "default") return newDef;
          return null;
        }),
      } as unknown as Partial<ProfilesService>);
      const store = createStore();
      store.setState({
        profiles: [oldDef, newDef],
        defaultProfile: oldDef,
        chatProfile: null,
      });

      store.getState().reloadCurrentChat();

      expect(service.loadProfileById).toHaveBeenCalledWith(
        [oldDef, newDef],
        "default"
      );
      expect(store.getState().defaultProfile).toEqual(newDef);
      expect(store.getState().chatProfile).toBeNull();
    });

    it("reloadModelAssignment re-reads default + 7 task profiles from settings", () => {
      const def = makeProfile("d");
      const summ = makeProfile("s");
      const keyToProfile: Record<string, Profile> = {
        default: def,
        summarization: summ,
      };
      service = makeService({
        loadProfileById: vi
          .fn()
          .mockImplementation((_p, key) => keyToProfile[key] ?? null),
      } as unknown as Partial<ProfilesService>);
      const store = createStore();
      store.setState({ profiles: [def, summ] });

      store.getState().reloadModelAssignment();

      expect(store.getState().defaultProfile).toEqual(def);
      expect(store.getState().summarizationProfile).toEqual(summ);
      expect(store.getState().translationProfile).toBeNull();
      expect(service.loadProfileById).toHaveBeenCalledWith(
        [def, summ],
        "default"
      );
      expect(service.loadProfileById).toHaveBeenCalledWith(
        [def, summ],
        "summarization"
      );
      expect(service.applyCurrentChatProvider).toHaveBeenCalled();
    });
  });
});
