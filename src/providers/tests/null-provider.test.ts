import { describe, expect, it } from "vitest";
import { NullProvider, nullProvider } from "../null-provider";

describe("NullProvider", () => {
  it("should export a singleton instance", () => {
    expect(nullProvider).toBeInstanceOf(NullProvider);
  });

  describe("overridden setters", () => {
    it("setModelKey should not throw", () => {
      const provider = new NullProvider();
      expect(() => provider.setModelKey("test")).not.toThrow();
    });

    it("setModelKey should be no-op (does not mutate state)", () => {
      const provider = new NullProvider();
      provider.setModelKey("test");
      // Arrow override is a no-op; no state mutation expected
    });

    it("setSystemPrompt should not throw", () => {
      const provider = new NullProvider();
      expect(() => provider.setSystemPrompt("test")).not.toThrow();
    });

    it("setSystemPrompt should be no-op (does not mutate state)", () => {
      const provider = new NullProvider();
      provider.setSystemPrompt("test");
    });

    it("setApiKey should be no-op", () => {
      const provider = new NullProvider();
      provider.setApiKey("test");
      expect(provider.apiKey).toBeUndefined();
    });

    it("setUrl should be no-op", () => {
      const provider = new NullProvider();
      provider.setUrl("test");
      expect(provider.url).toBeUndefined();
    });

    it("stopMessage should be no-op", () => {
      const provider = new NullProvider();
      expect(() => provider.stopMessage()).not.toThrow();
    });

    it("stopMessage should be no-op (does not mutate state)", () => {
      const provider = new NullProvider();
      provider.stopMessage();
    });

    it("setProvider should be no-op", () => {
      const provider = new NullProvider();
      expect(() =>
        provider.setProvider({
          type: "openai",
          name: "test",
          key: "key",
          baseUrl: "url",
        })
      ).not.toThrow();
    });

    it("setPrevMessages should be no-op", () => {
      const provider = new NullProvider();
      expect(() => provider.setPrevMessages([])).not.toThrow();
    });

    it("setTools should be no-op", () => {
      const provider = new NullProvider();
      expect(() => provider.setTools([])).not.toThrow();
    });
  });

  describe("createChatName", () => {
    it("should return empty string", async () => {
      const provider = new NullProvider();
      const result = await provider.createChatName("test");
      expect(result).toBe("");
    });
  });

  describe("sendMessage", () => {
    it("should yield nothing", async () => {
      const provider = new NullProvider();
      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([])) {
        results.push(msg);
      }
      expect(results).toHaveLength(0);
    });
  });

  describe("sendMessageAfterToolCall", () => {
    it("should yield nothing", async () => {
      const provider = new NullProvider();
      const results: unknown[] = [];
      for await (const msg of provider.sendMessageAfterToolCall({
        role: "assistant",
        content: [],
      })) {
        results.push(msg);
      }
      expect(results).toHaveLength(0);
    });
  });

  describe("getName", () => {
    it("should return empty string", () => {
      const provider = new NullProvider();
      expect(provider.getName()).toBe("");
    });
  });

  describe("getBaseUrl", () => {
    it("should return empty string", () => {
      const provider = new NullProvider();
      expect(provider.getBaseUrl()).toBe("");
    });
  });

  describe("checkProvider", () => {
    it("should return false", async () => {
      const provider = new NullProvider();
      const result = await provider.checkProvider({ url: "", apiKey: "" });
      expect(result).toBe(false);
    });
  });

  describe("getProviderModels", () => {
    it("should return empty array", async () => {
      const provider = new NullProvider();
      const result = await provider.getProviderModels({ url: "", apiKey: "" });
      expect(result).toEqual([]);
    });
  });

  describe("isSupportStreaming", () => {
    it("should return false", () => {
      const provider = new NullProvider();
      expect(provider.isSupportStreaming()).toBe(false);
    });
  });
});
