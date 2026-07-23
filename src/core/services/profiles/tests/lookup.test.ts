import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { credsOf, loadProfile, providerFor } from "../lookup";
import {
  makeProfile,
  makeStorage,
  PROFILE_STUB_TYPE,
  registerStubProvider,
  StubProfileProvider,
  unregisterStubProvider,
} from "./test-utils";

beforeEach(() => {
  registerStubProvider();
});

afterEach(() => {
  unregisterStubProvider();
});

describe("loadProfile", () => {
  it("returns the profile when present", async () => {
    const { storage } = makeStorage({ profiles: [makeProfile()] });
    const profile = await loadProfile(storage, "p-existing");
    expect(profile.id).toBe("p-existing");
  });

  it("throws when missing", async () => {
    const { storage } = makeStorage();
    await expect(loadProfile(storage, "missing")).rejects.toThrow(
      "Profile not found: missing"
    );
  });
});

describe("providerFor", () => {
  it("returns the registered provider class", async () => {
    expect(await providerFor(PROFILE_STUB_TYPE)).toBe(StubProfileProvider);
  });

  it("throws on unknown type", async () => {
    await expect(providerFor("nope")).rejects.toThrow(
      "Unknown provider type: nope"
    );
  });
});

describe("credsOf", () => {
  it("maps key→apiKey and forwards baseUrl", () => {
    expect(credsOf({ baseUrl: "https://x", key: "K" })).toEqual({
      baseUrl: "https://x",
      apiKey: "K",
    });
  });

  it("propagates undefined key as undefined apiKey", () => {
    expect(credsOf({ baseUrl: "https://x" })).toEqual({
      baseUrl: "https://x",
      apiKey: undefined,
    });
  });
});
