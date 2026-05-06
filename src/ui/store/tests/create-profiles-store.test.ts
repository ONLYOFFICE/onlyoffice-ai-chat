import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppContext } from "../../../app-context";
import type { ServerAPI } from "../../providers/ApiProvider";
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
    },
  } as unknown as ServerAPI;

  const keys = {} as StoreKeys;
  return { ctx, api, keys, emit };
}

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

  it("init loads profiles, deepMode and assignments", async () => {
    const p1 = profile("1");
    const deps = makeDeps([p1]);
    deps.api.assignments.getAllAssignments = vi.fn().mockResolvedValue({
      Default: "1",
      Chat: "1",
    });
    deps.api.preferences.getDeepMode = vi.fn().mockResolvedValue(true);
    const s = createProfilesStore(deps);
    await s.getState().init();
    expect(s.getState().profiles).toEqual([p1]);
    expect(s.getState().extendedThinking).toBe(true);
    expect(s.getState().chatProfile?.id).toBe("1");
    expect(s.getState().defaultProfile?.id).toBe("1");
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
    deps.api.preferences.getDeepMode = vi.fn(async () => {
      callOrder.push("deepMode");
      return false;
    });
    deps.api.assignments.getAllAssignments = vi.fn(async () => {
      callOrder.push("assignments");
      return {};
    });
    const s = createProfilesStore(deps);
    await s.getState().init();

    expect(deps.api.profiles.list).toHaveBeenCalledTimes(1);
    expect(deps.api.assignments.getAllAssignments).toHaveBeenCalledTimes(1);
    expect(deps.api.preferences.getDeepMode).toHaveBeenCalledTimes(1);
    // All three calls were initiated before any of them resolved.
    expect(callOrder).toEqual(["profiles", "deepMode", "assignments"]);
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
    expect(s.getState().summarizationProfile).toEqual(p);
    expect(s.getState().translationProfile).toBeNull();
    expect(s.getState().textAnalysisProfile).toEqual(p);
    expect(s.getState().imageGenerationProfile).toEqual(p);
    expect(s.getState().ocrProfile).toEqual(p);
    expect(s.getState().visionProfile).toEqual(p);
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

  it("toggleExtendedThinking flips and persists", async () => {
    const deps = makeDeps();
    const s = createProfilesStore(deps);
    await s.getState().toggleExtendedThinking();
    expect(s.getState().extendedThinking).toBe(true);
    expect(deps.api.preferences.setDeepMode).toHaveBeenCalledWith(true);
    expect(deps.emit).toHaveBeenCalledWith("onExtendedThinkingUpdated", {
      enabled: true,
    });
  });

  it("reloadExtendedThinking only emits on change", async () => {
    const deps = makeDeps();
    deps.api.preferences.getDeepMode = vi.fn().mockResolvedValue(true);
    const s = createProfilesStore(deps);
    await s.getState().reloadExtendedThinking();
    expect(s.getState().extendedThinking).toBe(true);
    deps.emit.mockClear();
    await s.getState().reloadExtendedThinking();
    expect(deps.emit).not.toHaveBeenCalled();
  });
});
