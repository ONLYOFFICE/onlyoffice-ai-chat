import { afterEach, describe, expect, it, vi } from "vitest";
import { AbstractBaseProvider } from "../../providers";
import { registerProvider, unregisterProvider } from "../../providers";
import { providerFor } from "../provider";
import type { ActionArgs } from "../types";

class StubProvider extends AbstractBaseProvider {
  // eslint-disable-next-line require-yield
  async *sendMessage(): AsyncGenerator<never> {
    throw new Error("not used");
  }
  async sendMessageSync(): Promise<string> {
    return "";
  }
  static getName(): string {
    return "Stub";
  }
  static getBaseUrl(): string {
    return "https://stub";
  }
  static checkProvider = vi.fn().mockResolvedValue(true);
  static getProviderModels = vi.fn().mockResolvedValue([]);
}

const baseArgs: ActionArgs = {
  profile: {
    providerType: "stub-provider",
    baseUrl: "https://stub",
    key: "k",
    modelId: "m",
  },
  messages: [],
};

describe("providerFor", () => {
  afterEach(() => {
    unregisterProvider("stub-provider");
  });

  it("constructs the provider for the action profile", async () => {
    registerProvider("stub-provider", StubProvider);
    const instance = await providerFor(baseArgs);
    expect(instance).toBeInstanceOf(StubProvider);
  });

  it("works with built-in providers", async () => {
    const instance = await providerFor({
      ...baseArgs,
      profile: { ...baseArgs.profile, providerType: "openai" },
    });
    expect(instance).toBeInstanceOf(AbstractBaseProvider);
  });

  it("throws when the provider type is unknown", async () => {
    await expect(
      providerFor({
        ...baseArgs,
        profile: { ...baseArgs.profile, providerType: "unknown-type-xyz" },
      })
    ).rejects.toThrow("Unknown provider type: unknown-type-xyz");
  });
});
