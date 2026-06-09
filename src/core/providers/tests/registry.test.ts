import { afterEach, describe, expect, it } from "vitest";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import type { ProviderType } from "../../../shared/provider-type";
import { AbstractBaseProvider } from "../base";
import type { BaseProvider } from "../registry";
import {
  createProvider,
  getProvider,
  getSupportedProviderTypes,
  isValidProviderType,
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
  describe("getProvider", () => {
    it("returns a constructor for built-in types", () => {
      const Ctor = getProvider("anthropic");
      expect(Ctor).toBeDefined();
      expect(Ctor?.getName()).toBe("Anthropic");
    });

    it("returns a constructor for every built-in type", () => {
      for (const type of builtinTypes) {
        const Ctor = getProvider(type);
        expect(Ctor).toBeDefined();
        expect(typeof Ctor?.getName()).toBe("string");
      }
    });

    it("returns undefined for unknown types", () => {
      expect(getProvider("unknown-provider")).toBeUndefined();
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

    it("registers a custom provider", () => {
      registerProvider("custom-llm", customCtor);
      expect(getProvider("custom-llm")).toBe(customCtor);
    });

    it("shows the custom type in getSupportedProviderTypes", () => {
      registerProvider("custom-llm", customCtor);
      expect(getSupportedProviderTypes()).toContain("custom-llm");
    });

    it("validates the custom type", () => {
      registerProvider("custom-llm", customCtor);
      expect(isValidProviderType("custom-llm")).toBe(true);
    });

    it("unregisters a custom provider", () => {
      registerProvider("custom-llm", customCtor);
      unregisterProvider("custom-llm");
      expect(getProvider("custom-llm")).toBeUndefined();
      expect(isValidProviderType("custom-llm")).toBe(false);
    });

    it("leaves built-in providers intact", () => {
      registerProvider("custom-llm", customCtor);
      expect(getProvider("anthropic")).toBeDefined();
      unregisterProvider("custom-llm");
      expect(getProvider("anthropic")).toBeDefined();
    });
  });

  describe("createProvider", () => {
    it("instantiates each built-in type with the supplied creds", () => {
      for (const type of builtinTypes) {
        const instance = createProvider(type, creds);
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(AbstractBaseProvider);
      }
    });

    it("returns undefined for unknown types", () => {
      expect(createProvider("nonexistent", creds)).toBeUndefined();
    });

    it("creates independent instances on each call", () => {
      const a = createProvider("openai", creds);
      const b = createProvider("openai", creds);
      expect(a).not.toBe(b);
    });
  });
});
