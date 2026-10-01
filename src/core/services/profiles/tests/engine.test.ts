import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionType } from "../../../../shared/action-type";
import { ProfilesEngine } from "../engine";
import {
  checkProviderMock,
  dummyModel,
  getProviderModelsMock,
  makeProfile,
  makeStorage,
  probeCredsLog,
  PROFILE_STUB_TYPE,
  registerStubProvider,
  sendMessageProbeMock,
  unregisterStubProvider,
} from "./test-utils";

beforeEach(() => {
  registerStubProvider();
  checkProviderMock.mockReset();
  getProviderModelsMock.mockReset();
  sendMessageProbeMock.mockReset();
  sendMessageProbeMock.mockReturnValue(false);
  probeCredsLog.length = 0;
  vi.spyOn(crypto, "randomUUID").mockReturnValue(
    "00000000-0000-0000-0000-000000000001"
  );
  vi.spyOn(Date, "now").mockReturnValue(123456);
});

afterEach(() => {
  unregisterStubProvider();
  vi.restoreAllMocks();
});

describe("ProfilesEngine.create", () => {
  it("persists a new profile and assigns Default when storage is empty", async () => {
    checkProviderMock.mockResolvedValueOnce(true);
    const { storage, snapshot } = makeStorage();
    const engine = new ProfilesEngine({ storage });

    const result = await engine.create({
      name: "First",
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
      key: "k",
      modelId: "m",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.profile.name).toBe("First");
    expect(result.profile.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(result.profile.createdAt).toBe(123456);
    const snap = snapshot();
    expect(snap.profiles).toHaveLength(1);
    expect(snap.assignments[ActionType.Default]).toBe(result.profile.id);
  });

  it("does NOT auto-assign Default when other profiles exist", async () => {
    checkProviderMock.mockResolvedValueOnce(true);
    const { storage, snapshot } = makeStorage({
      profiles: [makeProfile({ name: "A" })],
    });
    const engine = new ProfilesEngine({ storage });

    const result = await engine.create({
      name: "Second",
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
      key: "k",
      modelId: "m",
    });

    expect(result.success).toBe(true);
    expect(snapshot().assignments[ActionType.Default]).toBeUndefined();
  });

  it("returns validation error and writes nothing on duplicate name", async () => {
    const { storage, snapshot } = makeStorage({
      profiles: [makeProfile({ name: "Same" })],
    });
    const engine = new ProfilesEngine({ storage });
    const result = await engine.create({
      name: "Same",
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
      modelId: "m",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error();
    expect(result.error.field).toBe("name");
    expect(snapshot().profiles).toHaveLength(1);
  });

  it("propagates a credential error from the provider", async () => {
    checkProviderMock.mockResolvedValueOnce({ field: "key", message: "bad" });
    const { storage } = makeStorage();
    const engine = new ProfilesEngine({ storage });
    const result = await engine.create({
      name: "X",
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
      modelId: "m",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error();
    expect(result.error).toEqual({ field: "key", message: "bad" });
  });
});

describe("ProfilesEngine.update", () => {
  it("returns 'Profile not found' when the id is missing", async () => {
    const { storage } = makeStorage();
    const engine = new ProfilesEngine({ storage });
    const result = await engine.update(makeProfile({ id: "missing" }));
    expect(result.success).toBe(false);
    if (result.success) throw new Error();
    expect(result.error.message).toBe("Profile not found");
  });

  it("updates and persists when validation passes", async () => {
    checkProviderMock.mockResolvedValueOnce(true);
    const { storage } = makeStorage({
      profiles: [makeProfile({ name: "Old" })],
    });
    const engine = new ProfilesEngine({ storage });
    const result = await engine.update(
      makeProfile({ name: "New", id: "p-existing" })
    );
    expect(result.success).toBe(true);
    expect(storage.profiles.update).toHaveBeenCalled();
  });

  it("propagates name-collision error", async () => {
    const { storage } = makeStorage({
      profiles: [
        makeProfile({ id: "a", name: "A" }),
        makeProfile({ id: "b", name: "B" }),
      ],
    });
    const engine = new ProfilesEngine({ storage });
    const result = await engine.update(makeProfile({ id: "b", name: "A" }));
    expect(result.success).toBe(false);
    if (result.success) throw new Error();
    expect(result.error.message).toBe("Duplicate name");
  });
});

describe("ProfilesEngine.delete", () => {
  it("cascades through the assignments engine and deletes the profile", async () => {
    const { storage, snapshot } = makeStorage({
      profiles: [makeProfile({ id: "del" })],
    });
    storage.assignments.readAll = vi.fn(async () => ({
      [ActionType.Default]: "del",
    }));
    const engine = new ProfilesEngine({ storage });
    await engine.delete("del");
    expect(storage.profiles.delete).toHaveBeenCalledWith("del");
    expect(snapshot().profiles).toHaveLength(0);
  });
});

describe("ProfilesEngine.listModels", () => {
  it("loads the profile and forwards creds to the provider", async () => {
    getProviderModelsMock.mockResolvedValueOnce([dummyModel("m")]);
    const { storage } = makeStorage({ profiles: [makeProfile({ key: "K" })] });
    const engine = new ProfilesEngine({ storage });
    const models = await engine.listModels("p-existing");
    expect(models).toHaveLength(1);
    expect(getProviderModelsMock).toHaveBeenCalledWith({
      baseUrl: "https://stub",
      apiKey: "K",
    });
  });
});

describe("ProfilesEngine probes (canUseTool + useResponsesApi)", () => {
  it("probes through fetchProxy for a useProxy profile and bare otherwise", async () => {
    checkProviderMock.mockResolvedValue(true);
    const fetchProxy = vi.fn();
    const { storage } = makeStorage();
    const engine = new ProfilesEngine({ storage, fetchProxy });

    await engine.create({
      name: "proxied",
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
      key: "k",
      modelId: "m",
      useProxy: true,
    });
    expect(probeCredsLog.length).toBeGreaterThan(0);
    for (const creds of probeCredsLog) expect(creds.fetch).toBe(fetchProxy);

    probeCredsLog.length = 0;
    await engine.create({
      name: "direct",
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
      key: "k",
      modelId: "m",
    });
    for (const creds of probeCredsLog) expect(creds.fetch).toBeUndefined();
  });

  it("probes through fetchProxy for every profile when forceProxy is on", async () => {
    checkProviderMock.mockResolvedValue(true);
    const fetchProxy = vi.fn();
    const { storage } = makeStorage();
    const engine = new ProfilesEngine({
      storage,
      fetchProxy,
      forceProxy: true,
    });

    await engine.create({
      name: "p",
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
      key: "k",
      modelId: "m",
    });
    expect(probeCredsLog.length).toBeGreaterThan(0);
    for (const creds of probeCredsLog) expect(creds.fetch).toBe(fetchProxy);
  });

  it("persists canUseTool + useResponsesApi from the probe on create", async () => {
    checkProviderMock.mockResolvedValueOnce(true);
    // Model only calls tools through the Responses API — the gpt-5.5 case.
    sendMessageProbeMock.mockImplementation(
      (args) => args.useResponsesApi === true
    );
    const { storage, snapshot } = makeStorage();
    const engine = new ProfilesEngine({ storage });

    const result = await engine.create({
      name: "p",
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://api.openai.com/v1",
      key: "k",
      modelId: "gpt-5.5",
    });

    expect(result.success).toBe(true);
    const saved = snapshot().profiles[0];
    expect(saved.canUseTool).toBe(true);
    expect(saved.useResponsesApi).toBe(true);
    // The chat-completions probe is skipped once Responses succeeded — for
    // a model that cannot stop thinking it is a guaranteed, logged 400.
    expect(sendMessageProbeMock).toHaveBeenCalledTimes(1);
    expect(sendMessageProbeMock.mock.calls[0]?.[0]?.useResponsesApi).toBe(true);
  });

  it("sets canUseTool true / useResponsesApi false when tools work on chat completions", async () => {
    checkProviderMock.mockResolvedValueOnce(true);
    sendMessageProbeMock.mockImplementation(
      (args) => args.useResponsesApi !== true
    );
    const { storage, snapshot } = makeStorage();
    const engine = new ProfilesEngine({ storage });

    const result = await engine.create({
      name: "p",
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
      key: "k",
      modelId: "m",
    });

    expect(result.success).toBe(true);
    const saved = snapshot().profiles[0];
    expect(saved.canUseTool).toBe(true);
    expect(saved.useResponsesApi).toBe(false);
  });

  it("sets both false when the model calls no tools on either transport", async () => {
    checkProviderMock.mockResolvedValueOnce(true);
    sendMessageProbeMock.mockReturnValue(false);
    const { storage, snapshot } = makeStorage();
    const engine = new ProfilesEngine({ storage });

    const result = await engine.create({
      name: "p",
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
      key: "k",
      modelId: "m",
    });

    expect(result.success).toBe(true);
    const saved = snapshot().profiles[0];
    expect(saved.canUseTool).toBe(false);
    expect(saved.useResponsesApi).toBe(false);
  });

  it("reuses cached useResponsesApi on update when model/provider/baseUrl unchanged", async () => {
    checkProviderMock.mockResolvedValueOnce(true);
    const seed = makeProfile({
      id: "p1",
      name: "Old",
      modelId: "m1",
      canUseTool: true,
      useResponsesApi: true,
    });
    const { storage } = makeStorage({ profiles: [seed] });
    const engine = new ProfilesEngine({ storage });

    const result = await engine.update(
      makeProfile({
        id: "p1",
        name: "New",
        modelId: "m1",
        canUseTool: true,
        useResponsesApi: true,
      })
    );
    expect(result.success).toBe(true);
    expect(sendMessageProbeMock).not.toHaveBeenCalled();
    if (!result.success) throw new Error("unreachable");
    expect(result.profile.useResponsesApi).toBe(true);
  });

  it("re-probes canUseTool + useResponsesApi when modelId changes", async () => {
    checkProviderMock.mockResolvedValueOnce(true);
    sendMessageProbeMock.mockImplementation(
      (args) => args.useResponsesApi === true
    );
    const seed = makeProfile({
      id: "p1",
      modelId: "m1",
      canUseTool: false,
      useResponsesApi: false,
    });
    const { storage } = makeStorage({ profiles: [seed] });
    const engine = new ProfilesEngine({ storage });

    const result = await engine.update(
      makeProfile({ id: "p1", modelId: "gpt-5.5" })
    );
    expect(result.success).toBe(true);
    expect(sendMessageProbeMock).toHaveBeenCalled();
    if (!result.success) throw new Error("unreachable");
    expect(result.profile.canUseTool).toBe(true);
    expect(result.profile.useResponsesApi).toBe(true);
  });
});

describe("ProfilesEngine.testConnection", () => {
  it("checks credentials for a saved profile", async () => {
    checkProviderMock.mockResolvedValueOnce(true);
    const { storage } = makeStorage({ profiles: [makeProfile()] });
    const engine = new ProfilesEngine({ storage });
    const result = await engine.testConnection("p-existing");
    expect(result).toBe(true);
  });

  it("forwards credential errors", async () => {
    checkProviderMock.mockResolvedValueOnce({ field: "key", message: "bad" });
    const { storage } = makeStorage({ profiles: [makeProfile()] });
    const engine = new ProfilesEngine({ storage });
    const result = await engine.testConnection("p-existing");
    expect(result).toEqual({ field: "key", message: "bad" });
  });
});
