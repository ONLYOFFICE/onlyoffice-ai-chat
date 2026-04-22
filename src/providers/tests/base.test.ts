import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import { AbstractBaseProvider } from "../base";
import type { Model } from "../types";

// Concrete implementation for testing
class TestProvider extends AbstractBaseProvider<
  unknown,
  ThreadMessageLike,
  { apiKey?: string; baseURL?: string }
> {
  setProvider(): void {
    // Intentionally empty for testing
  }
  setPrevMessages(): void {
    // Intentionally empty for testing
  }
  setTools(): void {
    // Intentionally empty for testing
  }
  async createChatName(): Promise<string> {
    return "";
  }
  async *sendMessage(): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    // Intentionally empty for testing
  }
  async *sendMessageAfterToolCall(): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    // Intentionally empty for testing
  }
  async sendMessageSync(): Promise<string> {
    return "";
  }
  getName(): string {
    return "Test Provider";
  }
  getBaseUrl(): string {
    return "https://test.com";
  }
  async checkProvider(): Promise<boolean> {
    return true;
  }
  async getProviderModels(): Promise<Model[]> {
    return [];
  }
}

describe("AbstractBaseProvider", () => {
  describe("setModelKey", () => {
    it("should set model key", () => {
      const provider = new TestProvider();
      provider.setModelKey("test-model");

      expect(provider.modelKey).toBe("test-model");
    });
  });

  describe("setSystemPrompt", () => {
    it("should set system prompt", () => {
      const provider = new TestProvider();
      provider.setSystemPrompt("You are a helpful assistant");

      expect(provider.systemPrompt).toBe("You are a helpful assistant");
    });
  });

  describe("stopMessage", () => {
    it("should set stop flag to true", () => {
      const provider = new TestProvider();
      provider.stopMessage();

      expect(provider.stopFlag).toBe(true);
    });
  });

  describe("setApiKey", () => {
    it("should set api key", () => {
      const provider = new TestProvider();
      provider.setApiKey("test-key");

      expect(provider.apiKey).toBe("test-key");
    });

    it("should update client apiKey if client exists", () => {
      const provider = new TestProvider();
      provider.client = { apiKey: "old-key", baseURL: "url" };

      provider.setApiKey("new-key");

      expect(provider.apiKey).toBe("new-key");
      expect(provider.client.apiKey).toBe("new-key");
    });

    it("should not throw if client does not have apiKey property", () => {
      const provider = new TestProvider();
      provider.client = { baseURL: "url" };

      expect(() => provider.setApiKey("new-key")).not.toThrow();
      expect(provider.apiKey).toBe("new-key");
    });

    it("should not throw if client is undefined", () => {
      const provider = new TestProvider();
      provider.client = undefined;

      expect(() => provider.setApiKey("new-key")).not.toThrow();
      expect(provider.apiKey).toBe("new-key");
    });
  });

  describe("setUrl", () => {
    it("should set url", () => {
      const provider = new TestProvider();
      provider.setUrl("https://new-url.com");

      expect(provider.url).toBe("https://new-url.com");
    });

    it("should update client baseURL if client exists", () => {
      const provider = new TestProvider();
      provider.client = { apiKey: "key", baseURL: "old-url" };

      provider.setUrl("https://new-url.com");

      expect(provider.url).toBe("https://new-url.com");
      expect(provider.client.baseURL).toBe("https://new-url.com");
    });

    it("should not throw if client does not have baseURL property", () => {
      const provider = new TestProvider();
      provider.client = { apiKey: "key" };

      expect(() => provider.setUrl("https://new-url.com")).not.toThrow();
      expect(provider.url).toBe("https://new-url.com");
    });

    it("should not throw if client is undefined", () => {
      const provider = new TestProvider();
      provider.client = undefined;

      expect(() => provider.setUrl("https://new-url.com")).not.toThrow();
      expect(provider.url).toBe("https://new-url.com");
    });
  });

  describe("initial state", () => {
    it("should have default values", () => {
      const provider = new TestProvider();

      expect(provider.modelKey).toBe("");
      expect(provider.systemPrompt).toBe("");
      expect(provider.apiKey).toBeUndefined();
      expect(provider.url).toBeUndefined();
      expect(provider.provider).toBeUndefined();
      expect(provider.client).toBeUndefined();
      expect(provider.tools).toEqual([]);
      expect(provider.prevMessages).toEqual([]);
      expect(provider.stopFlag).toBe(false);
    });
  });

  describe("concrete methods", () => {
    it("should call getName", () => {
      const provider = new TestProvider();
      expect(provider.getName()).toBe("Test Provider");
    });

    it("should call getBaseUrl", () => {
      const provider = new TestProvider();
      expect(provider.getBaseUrl()).toBe("https://test.com");
    });

    it("should call checkProvider", async () => {
      const provider = new TestProvider();
      const result = await provider.checkProvider({
        url: "url",
        apiKey: "key",
      });
      expect(result).toBe(true);
    });

    it("should call getProviderModels", async () => {
      const provider = new TestProvider();
      const result = await provider.getProviderModels({
        url: "url",
        apiKey: "key",
      });
      expect(result).toEqual([]);
    });
  });

  describe("isSupportStreaming", () => {
    it("should return true by default", () => {
      const provider = new TestProvider();
      expect(provider.isSupportStreaming()).toBe(true);
    });
  });

  describe("isReasoning", () => {
    it("should default to false", () => {
      const provider = new TestProvider();
      expect(provider.isReasoning).toBe(false);
    });

    it("should be settable", () => {
      const provider = new TestProvider();
      provider.isReasoning = true;
      expect(provider.isReasoning).toBe(true);
    });
  });

  describe("sendMessageSync", () => {
    // `sendMessageSync` is now an abstract method — each provider implements
    // its own one-shot, non-streaming call. These tests cover the contract
    // that concrete providers must respect.

    it("is invoked with the passed messages and optional system prompt", async () => {
      const spy: {
        messages?: ThreadMessageLike[];
        systemPrompt?: string;
      } = {};
      class SyncTestProvider extends TestProvider {
        override async sendMessageSync(
          messages: ThreadMessageLike[],
          systemPrompt?: string
        ): Promise<string> {
          spy.messages = messages;
          spy.systemPrompt = systemPrompt;
          return "ok";
        }
      }

      const provider = new SyncTestProvider();
      const result = await provider.sendMessageSync(
        [{ role: "user", content: "Hi" }],
        "You are terse."
      );

      expect(result).toBe("ok");
      expect(spy.messages).toEqual([{ role: "user", content: "Hi" }]);
      expect(spy.systemPrompt).toBe("You are terse.");
    });

    it("must not mutate prevMessages when implemented per the contract", async () => {
      class SyncTestProvider extends TestProvider {
        override async sendMessageSync(): Promise<string> {
          // A faithful implementation returns a reply without touching
          // `this.prevMessages` — no history retention.
          return "reply";
        }
      }

      const provider = new SyncTestProvider();
      provider.prevMessages = [{ role: "user", content: "earlier" }];
      await provider.sendMessageSync([{ role: "user", content: "Hi" }]);

      expect(provider.prevMessages).toEqual([
        { role: "user", content: "earlier" },
      ]);
    });
  });

  describe("imageVision", () => {
    it("should call sendMessageSync with image and prompt", async () => {
      const spy: { messages?: ThreadMessageLike[] } = {};
      class VisionTestProvider extends TestProvider {
        override async sendMessageSync(
          messages: ThreadMessageLike[]
        ): Promise<string> {
          spy.messages = messages;
          return "A cat sitting on a mat";
        }
      }

      const provider = new VisionTestProvider();
      const result = await provider.imageVision({
        image: "base64imagedata",
        prompt: "Describe this image",
      });

      expect(result).toBe("A cat sitting on a mat");
      expect(spy.messages).toEqual([
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image" },
            { type: "image", image: "base64imagedata" },
          ],
        },
      ]);
    });
  });

  describe("imageOCR", () => {
    it("should call imageVision with OCR prompt", async () => {
      class OCRTestProvider extends TestProvider {
        override async sendMessageSync(): Promise<string> {
          return "Extracted text from image";
        }
      }

      const provider = new OCRTestProvider();
      const result = await provider.imageOCR({
        image: "base64imagedata",
      });

      expect(result).toBe("Extracted text from image");
    });
  });
});
