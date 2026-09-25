import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppContext } from "../../../app-context";
import type { ServerAPI } from "../../providers/ApiProvider";
import { RouteError } from "../../providers/ApiProvider/fetcher";
import { createProfilesStore } from "../create-profiles-store";
import type { Profile } from "../../../types";
import type { StoreKeys } from "../../../config";

vi.mock("../../../capabilities", () => ({
  inferCapabilities: vi.fn(() => 0xff),
}));

const profile = (id: string, overrides: Partial<Profile> = {}): Profile =>
  ({
    id,
    name: `n-${id}`,
    providerType: "openai",
    baseUrl: "https://x",
    modelId: "m",
    capabilities: 0xff,
    ...overrides,
  }) as Profile;

function makeDeps(initialProfiles: Profile[] = []) {
  const emit = vi.fn();
  const ctx = {
    callbacksManager: { emit },
  } as unknown as AppContext;

  const api = {
    profiles: {
      list: vi.fn().mockResolvedValue(initialProfiles),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    assignments: {
      getAllAssignments: vi.fn().mockResolvedValue({}),
      assign: vi.fn().mockResolvedValue(undefined),
      unassign: vi.fn().mockResolvedValue(undefined),
    },
    preferences: {
      getDeepMode: vi.fn().mockResolvedValue(false),
      setDeepMode: vi.fn().mockResolvedValue(undefined),
      getReasoningLevel: vi.fn().mockResolvedValue("off"),
      setReasoningLevel: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as ServerAPI;

  const keys = {} as StoreKeys;
  return { ctx, api, keys, emit };
}

/** Drain the fire-and-forget persistence chain inside setSessionChatProfile. */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("createProfilesStore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts with empty state", () => {
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    const st = s.getState();
    expect(st.profiles).toEqual([]);
    expect(st.defaultProfile).toBeNull();
    expect(st.chatProfile).toBeNull();
    expect(st.extendedThinking).toBe(false);
  });

  it("init loads profiles, reasoning level and assignments", async () => {
    const p1 = profile("1");
    const deps = makeDeps([p1]);
    deps.api.assignments.getAllAssignments = vi.fn().mockResolvedValue({
      Default: "1",
      Chat: "1",
    });
    deps.api.preferences.getReasoningLevel = vi.fn().mockResolvedValue("high");
    const s = createProfilesStore(deps);
    await s.getState().init();
    expect(s.getState().profiles).toEqual([p1]);
    expect(s.getState().extendedThinking).toBe(true);
    expect(s.getState().reasoningLevel).toBe("high");
    expect(s.getState().chatProfile?.id).toBe("1");
    expect(s.getState().defaultProfile?.id).toBe("1");
  });

  it("init forwards entityId to getAllAssignments", async () => {
    const deps = makeDeps([profile("1")]);
    const getAll = vi.fn().mockResolvedValue({ Chat: "1" });
    deps.api.assignments.getAllAssignments = getAll;
    const s = createProfilesStore({ ...deps, getEntityId: () => "agent-7" });
    await s.getState().init();
    expect(getAll).toHaveBeenCalledWith("agent-7");
    expect(s.getState().chatProfile?.id).toBe("1");
  });

  it("init fans out profiles/deepMode/assignments in parallel", async () => {
    const deps = makeDeps([profile("1")]);
    // Capture call timing: each mock records when it was invoked relative
    // to the others. If init parallelizes them, all three should start
    // before any await resolves (i.e. record the same tick).
    const callOrder: string[] = [];
    deps.api.profiles.list = vi.fn(async () => {
      callOrder.push("profiles");
      return [profile("1")];
    });
    deps.api.preferences.getReasoningLevel = vi.fn(async () => {
      callOrder.push("deepMode");
      return "off" as const;
    });
    deps.api.assignments.getAllAssignments = vi.fn(async () => {
      callOrder.push("assignments");
      return {};
    });
    const s = createProfilesStore(deps);
    await s.getState().init();

    expect(deps.api.profiles.list).toHaveBeenCalledTimes(1);
    expect(deps.api.assignments.getAllAssignments).toHaveBeenCalledTimes(1);
    expect(deps.api.preferences.getReasoningLevel).toHaveBeenCalledTimes(1);
    // All three calls were initiated before any of them resolved.
    expect(callOrder).toEqual(["profiles", "deepMode", "assignments"]);
  });

  it("init reports a failed load on onError instead of rejecting", async () => {
    const deps = makeDeps();
    const failure = new Error("offline");
    deps.api.profiles.list = vi.fn().mockRejectedValue(failure);
    const s = createProfilesStore(deps);

    await expect(s.getState().init()).resolves.toBeUndefined();

    expect(deps.emit).toHaveBeenCalledWith("onError", {
      type: "storage",
      error: failure,
      context: "profiles:init",
    });
    // Left unhydrated on purpose, so the next mount retries the load.
    expect(s.getState().initialized).toBe(false);
    expect(s.getState().profiles).toEqual([]);
  });

  it("init retries after a failed load", async () => {
    const deps = makeDeps();
    const list = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([profile("1")]);
    deps.api.profiles.list = list;
    const s = createProfilesStore(deps);

    await s.getState().init();
    await s.getState().init();

    expect(list).toHaveBeenCalledTimes(2);
    expect(s.getState().initialized).toBe(true);
    expect(s.getState().profiles).toEqual([profile("1")]);
  });

  it("init backfills missing capabilities", async () => {
    const broken = profile("1");
    (broken as unknown as { capabilities: unknown }).capabilities = undefined;
    const deps = makeDeps([broken]);
    const s = createProfilesStore(deps);
    await s.getState().init();
    expect(s.getState().profiles[0].capabilities).toBe(0xff);
  });

  it("reloadProfiles refreshes profiles only", async () => {
    const deps = makeDeps([profile("1")]);
    const s = createProfilesStore(deps);
    await s.getState().reloadProfiles();
    expect(s.getState().profiles).toEqual([profile("1")]);
  });

  it("reloadCurrentChat updates chat and default profiles", async () => {
    const deps = makeDeps();
    deps.api.assignments.getAllAssignments = vi.fn().mockResolvedValue({
      Chat: "1",
      Default: "2",
    });
    const s = createProfilesStore(deps);
    s.setState({ profiles: [profile("1"), profile("2")] });
    await s.getState().reloadCurrentChat();
    expect(s.getState().chatProfile?.id).toBe("1");
    expect(s.getState().defaultProfile?.id).toBe("2");
  });

  it("reloadCurrentChat sets nulls for missing profiles", async () => {
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    s.setState({ profiles: [profile("1")] });
    await s.getState().reloadCurrentChat();
    expect(s.getState().chatProfile).toBeNull();
    expect(s.getState().defaultProfile).toBeNull();
  });

  it("reloadModelAssignment refreshes all task assignments", async () => {
    const deps = makeDeps();
    deps.api.assignments.getAllAssignments = vi.fn().mockResolvedValue({
      Summarization: "1",
      Translation: "2",
    });
    const s = createProfilesStore(deps);
    s.setState({ profiles: [profile("1"), profile("2")] });
    await s.getState().reloadModelAssignment();
    expect(s.getState().summarizationProfile?.id).toBe("1");
    expect(s.getState().translationProfile?.id).toBe("2");
  });

  it("addProfile prepends and sets defaultProfile when first", async () => {
    const p1 = profile("1");
    const deps = makeDeps();
    deps.api.profiles.create = vi
      .fn()
      .mockResolvedValue({ success: true, profile: p1 });
    const s = createProfilesStore(deps);
    const result = await s.getState().addProfile(p1);
    expect(result).toBe(true);
    expect(s.getState().profiles).toEqual([p1]);
    expect(s.getState().defaultProfile).toEqual(p1);
    expect(deps.emit).toHaveBeenCalledWith("onProfilesUpdated", {
      kind: "created",
      profile: p1,
    });
  });

  it("addProfile does not overwrite default when not first", async () => {
    const existing = profile("e");
    const p1 = profile("1");
    const deps = makeDeps();
    deps.api.profiles.create = vi
      .fn()
      .mockResolvedValue({ success: true, profile: p1 });
    const s = createProfilesStore(deps);
    s.setState({ profiles: [existing], defaultProfile: existing });
    await s.getState().addProfile(p1);
    expect(s.getState().defaultProfile).toEqual(existing);
  });

  it("addProfile returns error from api.profiles.create on failure", async () => {
    const deps = makeDeps();
    const error = { code: "X", message: "bad" };
    deps.api.profiles.create = vi
      .fn()
      .mockResolvedValue({ success: false, error });
    const s = createProfilesStore(deps);
    const result = await s.getState().addProfile(profile("1"));
    expect(result).toEqual(error);
    expect(s.getState().profiles).toEqual([]);
  });

  it("addProfile returns TErrorData instead of throwing when the transport rejects", async () => {
    const deps = makeDeps();
    deps.api.profiles.create = vi
      .fn()
      .mockRejectedValue(new Error("HTTP 502: Bad Gateway"));
    const s = createProfilesStore(deps);
    const result = await s.getState().addProfile(profile("1"));
    expect(result).toEqual({
      field: "name",
      message: "HTTP 502: Bad Gateway",
    });
  });

  it("addProfile returns TErrorData on a malformed response", async () => {
    const deps = makeDeps();
    // A host route that answers with a bare object instead of the
    // { success, profile } envelope.
    deps.api.profiles.create = vi.fn().mockResolvedValue({ id: "1" });
    const s = createProfilesStore(deps);
    const result = await s.getState().addProfile(profile("1"));
    expect(result).toMatchObject({ field: "name" });
    expect(s.getState().profiles).toEqual([]);
  });

  it("addProfile resyncs from storage when success carries no profile body", async () => {
    const p1 = profile("1");
    const deps = makeDeps([p1]);
    deps.api.profiles.create = vi.fn().mockResolvedValue({ success: true });
    const s = createProfilesStore(deps);
    const result = await s.getState().addProfile(p1);
    expect(result).toBe(true);
    // The persisted profile was recovered via reloadProfiles.
    expect(deps.api.profiles.list).toHaveBeenCalled();
    expect(s.getState().profiles).toEqual([p1]);
  });

  it("editProfile returns TErrorData instead of throwing when the transport rejects", async () => {
    const orig = profile("1");
    const deps = makeDeps();
    deps.api.profiles.update = vi.fn().mockRejectedValue(new Error("boom"));
    const s = createProfilesStore(deps);
    s.setState({ profiles: [orig] });
    const result = await s.getState().editProfile(orig);
    expect(result).toEqual({ field: "name", message: "boom" });
  });

  it("editProfile updates list and refs across all role slots", async () => {
    const orig = profile("1", { name: "old" });
    const updated = profile("1", { name: "new" });
    const deps = makeDeps();
    deps.api.profiles.update = vi
      .fn()
      .mockResolvedValue({ success: true, profile: updated });
    const s = createProfilesStore(deps);
    s.setState({
      profiles: [orig],
      chatProfile: orig,
      defaultProfile: orig,
      summarizationProfile: orig,
      sessionChatProfile: orig,
    });
    const result = await s.getState().editProfile(updated);
    expect(result).toBe(true);
    expect(s.getState().profiles[0].name).toBe("new");
    expect(s.getState().chatProfile?.name).toBe("new");
    expect(s.getState().defaultProfile?.name).toBe("new");
    expect(s.getState().summarizationProfile?.name).toBe("new");
    expect(s.getState().sessionChatProfile?.name).toBe("new");
    expect(deps.emit).toHaveBeenCalledWith(
      "onCurrentChatProfileUpdated",
      expect.objectContaining({ profileId: "1", scope: "session" })
    );
  });

  it("editProfile emits persisted scope when only chat profile matches", async () => {
    const orig = profile("1");
    const updated = profile("1", { name: "new" });
    const deps = makeDeps();
    deps.api.profiles.update = vi
      .fn()
      .mockResolvedValue({ success: true, profile: updated });
    const s = createProfilesStore(deps);
    s.setState({ profiles: [orig], chatProfile: orig });
    await s.getState().editProfile(updated);
    const calls = deps.emit.mock.calls.filter(
      ([name]) => name === "onCurrentChatProfileUpdated"
    );
    expect(calls[0][1]).toMatchObject({ scope: "persisted" });
  });

  it("editProfile returns error on failure", async () => {
    const deps = makeDeps();
    const error = { code: "X" };
    deps.api.profiles.update = vi
      .fn()
      .mockResolvedValue({ success: false, error });
    const s = createProfilesStore(deps);
    const result = await s.getState().editProfile(profile("1"));
    expect(result).toEqual(error);
  });

  it("deleteProfile removes profile and reloads assignments", async () => {
    const p1 = profile("1");
    const p2 = profile("2");
    const deps = makeDeps();
    deps.api.assignments.getAllAssignments = vi
      .fn()
      .mockResolvedValue({ Default: "2" });
    const s = createProfilesStore(deps);
    s.setState({ profiles: [p1, p2], sessionChatProfile: p1 });
    await s.getState().deleteProfile("1");
    expect(s.getState().profiles).toEqual([p2]);
    expect(s.getState().sessionChatProfile).toBeNull();
    expect(s.getState().defaultProfile?.id).toBe("2");
  });

  it("getProfileById returns null when not found", () => {
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    s.setState({ profiles: [profile("1")] });
    expect(s.getState().getProfileById("missing")).toBeNull();
    expect(s.getState().getProfileById("1")?.id).toBe("1");
  });

  it("getProfileByName matches case-sensitively or case-insensitively", () => {
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    s.setState({ profiles: [profile("1", { name: "Foo" })] });
    expect(s.getState().getProfileByName("Foo")?.id).toBe("1");
    expect(s.getState().getProfileByName("foo")).toBeNull();
    expect(s.getState().getProfileByName("foo", true)?.id).toBe("1");
  });

  it("setDefaultProfile assigns and emits", async () => {
    const p1 = profile("1");
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    await s.getState().setDefaultProfile(p1);
    expect(deps.api.assignments.assign).toHaveBeenCalledWith("Default", "1");
    expect(s.getState().defaultProfile).toEqual(p1);
    expect(deps.emit).toHaveBeenCalledWith("onModelAssignmentUpdated", {
      task: "default",
      profileId: "1",
    });
  });

  it("setChatProfile assigns and emits chat profile updated", async () => {
    const p1 = profile("1");
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    await s.getState().setChatProfile(p1);
    expect(deps.api.assignments.assign).toHaveBeenCalledWith("Chat", "1");
    expect(s.getState().chatProfile).toEqual(p1);
    expect(deps.emit).toHaveBeenCalledWith(
      "onCurrentChatProfileUpdated",
      expect.objectContaining({ profileId: "1", scope: "persisted" })
    );
  });

  it("setChatProfile unassigns when given null", async () => {
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    await s.getState().setChatProfile(null);
    expect(deps.api.assignments.unassign).toHaveBeenCalledWith("Chat");
    expect(s.getState().chatProfile).toBeNull();
  });

  it("task setters route through assignments and emit", async () => {
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    const p = profile("1");
    await s.getState().setSummarizationProfile(p);
    expect(deps.api.assignments.assign).toHaveBeenCalledWith(
      "Summarization",
      "1"
    );
    await s.getState().setTranslationProfile(null);
    expect(deps.api.assignments.unassign).toHaveBeenCalledWith("Translation");
    await s.getState().setTextAnalysisProfile(p);
    await s.getState().setImageGenerationProfile(p);
    await s.getState().setOcrProfile(p);
    await s.getState().setVisionProfile(p);
    await s.getState().setFormAnalysisProfile(p);
    expect(deps.api.assignments.assign).toHaveBeenCalledWith(
      "FormAnalysis",
      "1"
    );
    expect(s.getState().summarizationProfile).toEqual(p);
    expect(s.getState().translationProfile).toBeNull();
    expect(s.getState().textAnalysisProfile).toEqual(p);
    expect(s.getState().imageGenerationProfile).toEqual(p);
    expect(s.getState().ocrProfile).toEqual(p);
    expect(s.getState().visionProfile).toEqual(p);
    expect(s.getState().formAnalysisProfile).toEqual(p);
  });

  it("setSessionChatProfile updates state and emits session scope", () => {
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    const p = profile("1");
    s.getState().setSessionChatProfile(p);
    expect(s.getState().sessionChatProfile).toEqual(p);
    expect(deps.emit).toHaveBeenCalledWith(
      "onCurrentChatProfileUpdated",
      expect.objectContaining({ scope: "session", profileId: "1" })
    );
  });

  it("setSessionChatProfile does not touch the Chat assignment by default", async () => {
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    s.getState().setSessionChatProfile(profile("1"));
    await flush();
    expect(deps.api.assignments.assign).not.toHaveBeenCalled();
    expect(s.getState().chatProfile).toBeNull();
  });

  it("setSessionChatProfile persists the Chat assignment on explicit pick without entityId", async () => {
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    const p = profile("1");
    s.getState().setSessionChatProfile(p, { persistAssignment: true });
    await flush();
    expect(deps.api.assignments.assign).toHaveBeenCalledWith("Chat", "1");
    expect(s.getState().chatProfile).toEqual(p);
    expect(deps.emit).toHaveBeenCalledWith(
      "onModelAssignmentUpdated",
      expect.objectContaining({ task: "chat", profileId: "1" })
    );
    expect(deps.emit).toHaveBeenCalledWith(
      "onCurrentChatProfileUpdated",
      expect.objectContaining({ scope: "persisted", profileId: "1" })
    );
  });

  it("setSessionChatProfile keeps the pick session-local when entityId is set", async () => {
    const deps = makeDeps();
    const s = createProfilesStore({ ...deps, getEntityId: () => "agent-7" });
    const p = profile("1");
    s.getState().setSessionChatProfile(p, { persistAssignment: true });
    await flush();
    expect(deps.api.assignments.assign).not.toHaveBeenCalled();
    expect(s.getState().chatProfile).toBeNull();
    expect(s.getState().sessionChatProfile).toEqual(p);
  });

  describe("a new chat model starts at its default depth", () => {
    const sonnet = profile("sonnet", {
      providerType: "openrouter",
      modelId: "anthropic/claude-sonnet-5",
      reasoningSupport: {
        thinks: true,
        canDisable: true,
        depths: ["low", "medium", "high", "max"],
        defaultDepth: "high",
      },
    });
    const grok = profile("grok", {
      providerType: "xai",
      modelId: "grok-4.6",
    });

    it("adopts the catalogue's default depth on a session pick", async () => {
      const deps = makeDeps();
      const s = createProfilesStore(deps);
      await s.getState().setReasoningLevel("max");
      s.getState().setSessionChatProfile(sonnet);
      await flush();
      expect(s.getState().reasoningLevel).toBe("high");
      expect(deps.api.preferences.setReasoningLevel).toHaveBeenLastCalledWith(
        "high",
        undefined
      );
      expect(deps.emit).toHaveBeenCalledWith("onExtendedThinkingUpdated", {
        enabled: true,
        level: "high",
      });
    });

    it("falls back to the standard depth, clamped to the model", async () => {
      const deps = makeDeps();
      const s = createProfilesStore(deps);
      await s.getState().setReasoningLevel("max");
      // grok-3-mini has low / high only: medium clamps up to high.
      s.getState().setSessionChatProfile(
        profile("mini", { providerType: "xai", modelId: "grok-3-mini" })
      );
      await flush();
      expect(s.getState().reasoningLevel).toBe("high");
    });

    it("keeps the user's Off on a model that can be switched off", async () => {
      const deps = makeDeps();
      const s = createProfilesStore(deps);
      s.getState().setSessionChatProfile(sonnet);
      await flush();
      expect(s.getState().reasoningLevel).toBe("off");
      expect(deps.api.preferences.setReasoningLevel).not.toHaveBeenCalled();
    });

    it("turns thinking on at the default depth where the model cannot stop", async () => {
      const deps = makeDeps();
      const s = createProfilesStore(deps);
      s.getState().setSessionChatProfile(grok);
      await flush();
      expect(s.getState().reasoningLevel).toBe("medium");
      expect(s.getState().extendedThinking).toBe(true);
    });

    it("leaves the level alone for a model that does not think", async () => {
      const deps = makeDeps();
      const s = createProfilesStore(deps);
      await s.getState().setReasoningLevel("high");
      deps.api.preferences.setReasoningLevel = vi.fn();
      s.getState().setSessionChatProfile(
        profile("4o", { providerType: "openai", modelId: "gpt-4o" })
      );
      await flush();
      expect(s.getState().reasoningLevel).toBe("high");
      expect(deps.api.preferences.setReasoningLevel).not.toHaveBeenCalled();
    });

    it("does nothing when the same profile and model are picked again", async () => {
      const deps = makeDeps();
      const s = createProfilesStore(deps);
      s.getState().setSessionChatProfile(sonnet);
      await flush();
      await s.getState().setReasoningLevel("low");
      deps.api.preferences.setReasoningLevel = vi.fn();
      s.getState().setSessionChatProfile({ ...sonnet });
      await flush();
      expect(s.getState().reasoningLevel).toBe("low");
      expect(deps.api.preferences.setReasoningLevel).not.toHaveBeenCalled();
    });

    it("follows a persisted Chat assignment when no session pick shadows it", async () => {
      const deps = makeDeps();
      const s = createProfilesStore(deps);
      await s.getState().setReasoningLevel("low");
      await s.getState().setChatProfile(sonnet);
      await flush();
      expect(s.getState().reasoningLevel).toBe("high");
    });

    it("re-adopts when the current profile is edited onto another model", async () => {
      const deps = makeDeps([sonnet]);
      deps.api.profiles.update = vi
        .fn()
        .mockImplementation(async (p: Profile) => ({
          success: true,
          profile: p,
        }));
      const s = createProfilesStore(deps);
      await s.getState().init();
      s.getState().setSessionChatProfile(sonnet);
      await flush();
      await s.getState().setReasoningLevel("low");
      await s.getState().editProfile({
        ...sonnet,
        modelId: "x-ai/grok-4.6",
        reasoningSupport: {
          thinks: true,
          canDisable: false,
          depths: ["low", "medium", "high"],
          defaultDepth: "medium",
        },
      });
      await flush();
      expect(s.getState().reasoningLevel).toBe("medium");
    });
  });

  it("toggleExtendedThinking flips and persists through the level route", async () => {
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    await s.getState().toggleExtendedThinking();
    expect(s.getState().extendedThinking).toBe(true);
    expect(s.getState().reasoningLevel).toBe("medium");
    expect(deps.api.preferences.setReasoningLevel).toHaveBeenCalledWith(
      "medium",
      undefined
    );
    expect(deps.api.preferences.setDeepMode).not.toHaveBeenCalled();
    expect(deps.emit).toHaveBeenCalledWith("onExtendedThinkingUpdated", {
      enabled: true,
      level: "medium",
    });
  });

  it("setReasoningLevel picks a depth and off/on restores it", async () => {
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    await s.getState().setReasoningLevel("high");
    expect(s.getState().reasoningLevel).toBe("high");
    expect(s.getState().extendedThinking).toBe(true);

    await s.getState().toggleExtendedThinking();
    expect(s.getState().reasoningLevel).toBe("off");
    expect(s.getState().extendedThinking).toBe(false);
    expect(deps.emit).toHaveBeenLastCalledWith("onExtendedThinkingUpdated", {
      enabled: false,
      level: "off",
    });

    // Back on: the depth the user chose, not the default.
    await s.getState().toggleExtendedThinking();
    expect(s.getState().reasoningLevel).toBe("high");
  });

  it("init seeds the depth restored by the next toggle", async () => {
    const deps = makeDeps();
    deps.api.preferences.getReasoningLevel = vi.fn().mockResolvedValue("max");
    const s = createProfilesStore(deps);
    await s.getState().init();
    await s.getState().toggleExtendedThinking(); // off
    await s.getState().toggleExtendedThinking(); // on again
    expect(s.getState().reasoningLevel).toBe("max");
  });

  it("falls back to the deep-mode routes when the host lacks the level route", async () => {
    const deps = makeDeps();
    deps.api.preferences.getReasoningLevel = vi
      .fn()
      .mockRejectedValue(new RouteError(404, "Not Found"));
    deps.api.preferences.setReasoningLevel = vi
      .fn()
      .mockRejectedValue(new RouteError(404, "Not Found"));
    deps.api.preferences.getDeepMode = vi.fn().mockResolvedValue(true);
    const s = createProfilesStore(deps);
    await s.getState().init();
    // The boolean alone means the default depth.
    expect(s.getState().reasoningLevel).toBe("medium");

    await s.getState().setReasoningLevel("high");
    expect(deps.api.preferences.setDeepMode).toHaveBeenCalledWith(
      true,
      undefined
    );
    // Remembered in memory for the session even though the host cannot keep it.
    expect(s.getState().reasoningLevel).toBe("high");
    await s.getState().toggleExtendedThinking();
    expect(deps.api.preferences.setDeepMode).toHaveBeenLastCalledWith(
      false,
      undefined
    );
    // The missing route is not retried on every call — one failed read is
    // enough to stop asking for the rest of the store's life.
    expect(deps.api.preferences.getReasoningLevel).toHaveBeenCalledTimes(1);
    expect(deps.api.preferences.setReasoningLevel).not.toHaveBeenCalled();
  });

  it("does not downgrade to deep mode on a transient failure", async () => {
    const deps = makeDeps();
    deps.api.preferences.getReasoningLevel = vi
      .fn()
      .mockRejectedValue(new RouteError(500, "Internal Server Error"));
    const s = createProfilesStore(deps);
    await expect(s.getState().reloadExtendedThinking()).rejects.toThrow(
      "HTTP 500"
    );
    expect(deps.api.preferences.getDeepMode).not.toHaveBeenCalled();
  });

  it("reloadExtendedThinking only emits on change", async () => {
    const deps = makeDeps();
    deps.api.preferences.getReasoningLevel = vi.fn().mockResolvedValue("low");
    const s = createProfilesStore(deps);
    await s.getState().reloadExtendedThinking();
    expect(s.getState().extendedThinking).toBe(true);
    expect(s.getState().reasoningLevel).toBe("low");
    deps.emit.mockClear();
    await s.getState().reloadExtendedThinking();
    expect(deps.emit).not.toHaveBeenCalled();
  });
});
