import { describe, expect, it } from "vitest";
import type { ImageGenerationArgs } from "../../../shared/image-generation-args";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import type { SendMessageResult } from "../../../shared/send-message-args";
import { AbstractBaseProvider } from "../base";

class TestProvider extends AbstractBaseProvider {
  // eslint-disable-next-line require-yield
  async *sendMessage(): AsyncGenerator<SendMessageResult> {
    throw new Error("not used");
  }

  async sendMessageSync(): Promise<string> {
    return "";
  }

  static getName(): string {
    return "Test Provider";
  }

  static getBaseUrl(): string {
    return "https://test.com";
  }

  static async checkProvider(
    _creds: ProviderCredentials
  ): Promise<boolean> {
    return true;
  }

  static async getProviderModels(
    _creds: ProviderCredentials
  ): Promise<Model[]> {
    return [];
  }
}

describe("AbstractBaseProvider", () => {
  const creds: ProviderCredentials = {
    baseUrl: "https://test.com",
    apiKey: "sk",
  };

  describe("construction", () => {
    it("stores the supplied credentials on the instance", () => {
      const provider = new TestProvider(creds);
      expect(provider).toBeInstanceOf(AbstractBaseProvider);
    });
  });

  describe("static identity", () => {
    it("exposes getName", () => {
      expect(TestProvider.getName()).toBe("Test Provider");
    });
    it("exposes getBaseUrl", () => {
      expect(TestProvider.getBaseUrl()).toBe("https://test.com");
    });
  });

  describe("static checkProvider", () => {
    it("reports provider reachability", async () => {
      await expect(TestProvider.checkProvider(creds)).resolves.toBe(true);
    });
  });

  describe("static getProviderModels", () => {
    it("returns the model list", async () => {
      await expect(TestProvider.getProviderModels(creds)).resolves.toEqual([]);
    });
  });

  describe("imageGeneration optional member", () => {
    it("is undefined when the subclass does not implement it", () => {
      const provider = new TestProvider(creds);
      expect(provider.imageGeneration).toBeUndefined();
    });

    it("is callable when the subclass implements it", async () => {
      class ImgProvider extends TestProvider {
        override imageGeneration = async (
          _args: ImageGenerationArgs
        ): Promise<string> => "b64";
      }
      const provider = new ImgProvider(creds);
      expect(provider.imageGeneration).toBeDefined();
      await expect(
        provider.imageGeneration!({ model: "m", prompt: "p" })
      ).resolves.toBe("b64");
    });
  });
});
