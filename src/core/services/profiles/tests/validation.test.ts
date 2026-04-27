import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkCredentials, validateProfile } from "../validation";
import {
  checkProviderMock,
  makeProfile,
  PROFILE_STUB_TYPE,
  registerStubProvider,
  unregisterStubProvider,
} from "./test-utils";

beforeEach(() => {
  registerStubProvider();
  checkProviderMock.mockReset();
});

afterEach(() => {
  unregisterStubProvider();
});

describe("validateProfile", () => {
  it("returns null when name is unique and credentials are valid", async () => {
    checkProviderMock.mockResolvedValueOnce(true);
    const result = await validateProfile([], {
      name: "Fresh",
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
      key: "k",
    });
    expect(result).toBeNull();
  });

  it("flags name collision (case-insensitive)", async () => {
    const existing = makeProfile({ name: "Foo" });
    const result = await validateProfile([existing], {
      name: "FOO",
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
    });
    expect(result).toEqual({ field: "name", message: "Duplicate name" });
  });

  it("excludes the supplied id from the collision check", async () => {
    checkProviderMock.mockResolvedValueOnce(true);
    const existing = makeProfile({ name: "Foo" });
    const result = await validateProfile(
      [existing],
      {
        name: "Foo",
        providerType: PROFILE_STUB_TYPE,
        baseUrl: "https://x",
      },
      existing.id
    );
    expect(result).toBeNull();
  });

  it("propagates the credential error from the provider", async () => {
    checkProviderMock.mockResolvedValueOnce({
      field: "key",
      message: "bad",
    });
    const result = await validateProfile([], {
      name: "Fresh",
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
    });
    expect(result).toEqual({ field: "key", message: "bad" });
  });
});

describe("checkCredentials", () => {
  it("rejects unknown provider type", async () => {
    const result = await checkCredentials({
      providerType: "non-existent-xyz",
      baseUrl: "",
    });
    expect(result).toEqual({
      field: "name",
      message: "Unknown provider type: non-existent-xyz",
    });
  });

  it("returns true when the provider says ok", async () => {
    checkProviderMock.mockResolvedValueOnce(true);
    const result = await checkCredentials({
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
    });
    expect(result).toBe(true);
  });

  it("forwards a structured error from the provider", async () => {
    checkProviderMock.mockResolvedValueOnce({ field: "url", message: "u" });
    const result = await checkCredentials({
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
    });
    expect(result).toEqual({ field: "url", message: "u" });
  });

  it("returns the catch-all error when the provider returns false-ish non-objects", async () => {
    checkProviderMock.mockResolvedValueOnce(false);
    const result = await checkCredentials({
      providerType: PROFILE_STUB_TYPE,
      baseUrl: "https://x",
    });
    expect(result).toEqual({
      field: "key",
      message: "Provider validation failed",
    });
  });
});
