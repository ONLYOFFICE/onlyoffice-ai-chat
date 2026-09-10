import { afterEach, describe, expect, it } from "vitest";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import type { ProviderType } from "../../../shared/provider-type";
import { AbstractBaseProvider } from "../base";
import type { BaseProvider } from "../registry";
import {
  createProvider,
  getProviderMetadata,
  getProviderName,
  getReasoningSupport,
  getSupportedProviderTypes,
  isValidProviderType,
  loadProvider,
  registerProvider,
  unregisterProvider,
} from "../registry";

const creds: ProviderCredentials = {
  baseUrl: "https://example.com",
  apiKey: "sk",
};

const builtinTypes: ProviderType[] = [
  "anthropic",
  "ollama",
  "openai",
  "openaicompatible",
  "together",
  "openrouter",
  "genai",
  "deepseek",
  "xai",
  "lm-studio",
  "mistral",
  "groq",
  "zhipu",
  "stabilityai",
  "gpt4all",
];

describe("Provider Registry", () => {
  describe("loadProvider", () => {
    it("loads a constructor for built-in types", async () => {
      const Ctor = await loadProvider("anthropic");
      expect(Ctor).toBeDefined();
      expect(Ctor?.getName()).toBe("Anthropic");
    });

    it("loads a constructor for every built-in type", async () => {
      for (const type of builtinTypes) {
        const Ctor = await loadProvider(type);
        expect(Ctor).toBeDefined();
        expect(typeof Ctor?.getName()).toBe("string");
      }
    });

    it("resolves undefined for unknown types", async () => {
      expect(await loadProvider("unknown-provider")).toBeUndefined();
    });

    it("caches the class across calls", async () => {
      const a = await loadProvider("openai");
      const b = await loadProvider("openai");
      expect(a).toBe(b);
    });
  });

  describe("getProviderMetadata / getProviderName", () => {
    it("returns name + baseUrl synchronously without loading the SDK", () => {
      const meta = getProviderMetadata("anthropic");
      expect(meta?.name).toBe("Anthropic");
      expect(typeof meta?.baseUrl).toBe("string");
    });

    it("returns metadata for every built-in type", () => {
      for (const type of builtinTypes) {
        expect(getProviderMetadata(type)?.name).toBeTruthy();
      }
    });

    it("falls back to the raw type for unknown providers", () => {
      expect(getProviderMetadata("unknown-provider")).toBeUndefined();
      expect(getProviderName("unknown-provider")).toBe("unknown-provider");
    });
  });

  describe("isValidProviderType", () => {
    it("returns true for built-in types", () => {
      expect(isValidProviderType("anthropic")).toBe(true);
      expect(isValidProviderType("openai")).toBe(true);
      expect(isValidProviderType("lm-studio")).toBe(true);
    });

    it("returns false for unknown types", () => {
      expect(isValidProviderType("unknown-provider")).toBe(false);
      expect(isValidProviderType("")).toBe(false);
    });

    it("is case-sensitive", () => {
      expect(isValidProviderType("OpenAI")).toBe(false);
      expect(isValidProviderType("ANTHROPIC")).toBe(false);
    });
  });

  describe("getSupportedProviderTypes", () => {
    it("includes every built-in type", () => {
      const types = getSupportedProviderTypes();
      for (const t of builtinTypes) {
        expect(types).toContain(t);
      }
    });
  });

  describe("registerProvider / unregisterProvider", () => {
    class CustomProvider extends AbstractBaseProvider {
      // eslint-disable-next-line require-yield
      async *sendMessage(): AsyncGenerator<never> {
        throw new Error("not used");
      }
      async sendMessageSync(): Promise<string> {
        return "";
      }
      static getName(): string {
        return "Custom";
      }
      static getBaseUrl(): string {
        return "https://custom.ai";
      }
      static async checkProvider(): Promise<boolean> {
        return true;
      }
      static async getProviderModels(): Promise<[]> {
        return [];
      }
    }

    const customCtor: BaseProvider = CustomProvider;

    afterEach(() => {
      unregisterProvider("custom-llm");
    });

    it("registers a custom provider", async () => {
      registerProvider("custom-llm", customCtor);
      expect(await loadProvider("custom-llm")).toBe(customCtor);
      expect(getProviderMetadata("custom-llm")).toEqual({
        name: "Custom",
        baseUrl: "https://custom.ai",
      });
    });

    it("shows the custom type in getSupportedProviderTypes", () => {
      registerProvider("custom-llm", customCtor);
      expect(getSupportedProviderTypes()).toContain("custom-llm");
    });

    it("validates the custom type", () => {
      registerProvider("custom-llm", customCtor);
      expect(isValidProviderType("custom-llm")).toBe(true);
    });

    it("unregisters a custom provider", async () => {
      registerProvider("custom-llm", customCtor);
      unregisterProvider("custom-llm");
      expect(await loadProvider("custom-llm")).toBeUndefined();
      expect(isValidProviderType("custom-llm")).toBe(false);
    });

    it("leaves built-in providers intact", async () => {
      registerProvider("custom-llm", customCtor);
      expect(await loadProvider("anthropic")).toBeDefined();
      unregisterProvider("custom-llm");
      expect(await loadProvider("anthropic")).toBeDefined();
    });
  });

  describe("createProvider", () => {
    it("instantiates each built-in type with the supplied creds", async () => {
      for (const type of builtinTypes) {
        const instance = await createProvider(type, creds);
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(AbstractBaseProvider);
      }
    });

    it("resolves undefined for unknown types", async () => {
      expect(await createProvider("nonexistent", creds)).toBeUndefined();
    });

    it("creates independent instances on each call", async () => {
      const a = await createProvider("openai", creds);
      const b = await createProvider("openai", creds);
      expect(a).not.toBe(b);
    });
  });

  describe("getReasoningSupport", () => {
    class LocalProvider extends AbstractBaseProvider {
      static async checkProvider() {
        return true;
      }
      static async getProviderModels() {
        return [];
      }
      static getName() {
        return "Local";
      }
      static getBaseUrl() {
        return "https://local";
      }
      async *sendMessage() {
        yield { role: "assistant" as const, content: [] };
      }
      async sendMessageSync() {
        return "";
      }
    }
    const customCtor: BaseProvider = LocalProvider;

    it("answers synchronously from the built-in tables", () => {
      expect(getReasoningSupport("anthropic", "claude-opus-5")).toEqual({
        thinks: true,
        canDisable: true,
        depths: ["low", "medium", "high", "max"],
      });
      expect(
        getReasoningSupport("genai", "gemini-3-pro-preview").depths
      ).toEqual(["low", "high"]);
      expect(getReasoningSupport("stabilityai", "sd3").thinks).toBe(false);
    });

    it("shares OpenAI's table across the OpenAI-compatible backends", () => {
      expect(getReasoningSupport("ollama", "gpt-oss:20b")).toEqual(
        getReasoningSupport("openai", "gpt-oss:20b")
      );
    });

    it("answers ONLYOFFICE from OpenRouter's table — the route proxies it one-to-one", () => {
      expect(
        getReasoningSupport("onlyoffice", "anthropic/claude-opus-5")
      ).toEqual(getReasoningSupport("openrouter", "anthropic/claude-opus-5"));
      expect(
        getReasoningSupport("onlyoffice", "x-ai/grok-4.6").canDisable
      ).toBe(false);
    });

    it("assumes everything for unknown types and statics-less custom providers", () => {
      expect(getReasoningSupport("nonexistent", "m").depths).toHaveLength(4);
      registerProvider("custom-llm", customCtor);
      expect(getReasoningSupport("custom-llm", "m").canDisable).toBe(true);
      unregisterProvider("custom-llm");
    });

    it("asks a custom provider that declares the static", () => {
      const withSupport = Object.assign(class extends LocalProvider {}, {
        getReasoningSupport: () => ({
          thinks: true,
          canDisable: false,
          depths: ["low", "high"] as const,
        }),
      }) as unknown as BaseProvider;
      registerProvider("custom-llm", withSupport);
      expect(getReasoningSupport("custom-llm", "m").depths).toEqual([
        "low",
        "high",
      ]);
      unregisterProvider("custom-llm");
    });
  });
});
