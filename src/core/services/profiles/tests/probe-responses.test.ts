import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AbstractBaseProvider } from "../../../providers";
import {
  registerProvider,
  unregisterProvider,
} from "../../../providers";
import { probeResponsesSupport } from "../probe-responses";

// ---------------------------------------------------------------------------
// Stub providers — register / unregister around each test so probe-responses
// resolves them by `providerType`.
// ---------------------------------------------------------------------------

const PROBE_TYPE = "probe-responses-stub";
const checkResponsesApiMock = vi.fn();

class StubProvider extends AbstractBaseProvider {
  // eslint-disable-next-line require-yield
  async *sendMessage(): AsyncGenerator<never> {
    throw new Error("not used");
  }
  async sendMessageSync(): Promise<string> {
    return "";
  }
  async checkResponsesApi(
    modelId: string,
    signal?: AbortSignal
  ): Promise<boolean> {
    return checkResponsesApiMock(modelId, signal);
  }
  static getName(): string {
    return "Stub";
  }
  static getBaseUrl(): string {
    return "https://stub";
  }
  static async checkProvider(): Promise<boolean> {
    return true;
  }
  static async getProviderModels(): Promise<never[]> {
    return [];
  }
}

// A second stub that does NOT override checkResponsesApi — exercises the
// base-class default which must return `false` without any network call.
const DEFAULT_TYPE = "probe-responses-default";

class DefaultStubProvider extends AbstractBaseProvider {
  // eslint-disable-next-line require-yield
  async *sendMessage(): AsyncGenerator<never> {
    throw new Error("not used");
  }
  async sendMessageSync(): Promise<string> {
    return "";
  }
  static getName(): string {
    return "Default";
  }
  static getBaseUrl(): string {
    return "https://default";
  }
  static async checkProvider(): Promise<boolean> {
    return true;
  }
  static async getProviderModels(): Promise<never[]> {
    return [];
  }
}

beforeEach(() => {
  registerProvider(PROBE_TYPE, StubProvider);
  registerProvider(DEFAULT_TYPE, DefaultStubProvider);
  checkResponsesApiMock.mockReset();
});

afterEach(() => {
  unregisterProvider(PROBE_TYPE);
  unregisterProvider(DEFAULT_TYPE);
});

const baseProfile = {
  providerType: PROBE_TYPE,
  modelId: "gpt-5.5",
  baseUrl: "https://api.openai.com/v1",
  key: "k",
};

describe("probeResponsesSupport", () => {
  it("returns true when provider.checkResponsesApi resolves true", async () => {
    checkResponsesApiMock.mockResolvedValueOnce(true);
    await expect(probeResponsesSupport(baseProfile)).resolves.toBe(true);
    expect(checkResponsesApiMock).toHaveBeenCalledWith(
      "gpt-5.5",
      expect.any(AbortSignal)
    );
  });

  it("returns false when provider.checkResponsesApi resolves false", async () => {
    checkResponsesApiMock.mockResolvedValueOnce(false);
    await expect(probeResponsesSupport(baseProfile)).resolves.toBe(false);
  });

  it("collapses provider errors to false", async () => {
    checkResponsesApiMock.mockRejectedValueOnce(new Error("network down"));
    await expect(probeResponsesSupport(baseProfile)).resolves.toBe(false);
  });

  it("returns false on probe timeout without throwing", async () => {
    vi.useFakeTimers();
    try {
      checkResponsesApiMock.mockImplementationOnce(
        (_id, signal: AbortSignal) =>
          new Promise<boolean>((_, reject) => {
            signal.addEventListener("abort", () =>
              reject(new Error("aborted"))
            );
            // never resolves on its own
          })
      );

      const probe = probeResponsesSupport(baseProfile);
      await vi.advanceTimersByTimeAsync(16_000);
      await expect(probe).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns false for a provider without checkResponsesApi override (base default)", async () => {
    await expect(
      probeResponsesSupport({ ...baseProfile, providerType: DEFAULT_TYPE })
    ).resolves.toBe(false);
  });

  it("propagates external abort signal — probe collapses to false", async () => {
    const ctrl = new AbortController();
    checkResponsesApiMock.mockImplementationOnce(
      (_id, signal: AbortSignal) =>
        new Promise<boolean>((_, reject) => {
          signal.addEventListener("abort", () =>
            reject(new Error("aborted"))
          );
        })
    );

    const probe = probeResponsesSupport(baseProfile, ctrl.signal);
    ctrl.abort();
    await expect(probe).resolves.toBe(false);
  });
});
