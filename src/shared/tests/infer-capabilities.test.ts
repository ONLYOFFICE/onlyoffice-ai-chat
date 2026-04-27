import { describe, expect, it } from "vitest";
import { CapabilitiesUI } from "../capabilities-ui";
import { inferCapabilities } from "../infer-capabilities";

describe("inferCapabilities", () => {
  describe("openai", () => {
    it("classifies whisper models as Audio", () => {
      expect(inferCapabilities("openai", "whisper-1")).toBe(
        CapabilitiesUI.Audio
      );
    });

    it("classifies tts models as Audio", () => {
      expect(inferCapabilities("openai", "tts-1")).toBe(CapabilitiesUI.Audio);
    });

    it("classifies embedding models as Embeddings", () => {
      expect(inferCapabilities("openai", "text-embedding-3-small")).toBe(
        CapabilitiesUI.Embeddings
      );
    });

    it("classifies dall-e-2 as Image", () => {
      expect(inferCapabilities("openai", "dall-e-2")).toBe(
        CapabilitiesUI.Image
      );
    });

    it("classifies dall-e-3 as Image", () => {
      expect(inferCapabilities("openai", "dall-e-3")).toBe(
        CapabilitiesUI.Image
      );
    });

    it("classifies models containing -image- as Image", () => {
      expect(inferCapabilities("openai", "gpt-4o-image-preview")).toBe(
        CapabilitiesUI.Image
      );
    });

    it("classifies gpt-3.5-turbo-instruct as Chat only", () => {
      expect(inferCapabilities("openai", "gpt-3.5-turbo-instruct")).toBe(
        CapabilitiesUI.Chat
      );
    });

    it("returns Chat | Vision for ordinary models", () => {
      expect(inferCapabilities("openai", "gpt-4o")).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Vision
      );
    });
  });

  describe("anthropic", () => {
    it("classifies claude-2 as Chat only", () => {
      expect(inferCapabilities("anthropic", "claude-2.1")).toBe(
        CapabilitiesUI.Chat
      );
    });

    it("classifies claude-3-5-haiku as Chat only", () => {
      expect(
        inferCapabilities("anthropic", "claude-3-5-haiku-20241022")
      ).toBe(CapabilitiesUI.Chat);
    });

    it("returns Chat | Vision for newer claude models", () => {
      expect(
        inferCapabilities("anthropic", "claude-sonnet-4-20250514")
      ).toBe(CapabilitiesUI.Chat | CapabilitiesUI.Vision);
    });
  });

  describe("mistral", () => {
    it("classifies mistral-embed as Embeddings", () => {
      expect(inferCapabilities("mistral", "mistral-embed")).toBe(
        CapabilitiesUI.Embeddings
      );
    });

    it("classifies pixtral as Chat | Vision", () => {
      expect(inferCapabilities("mistral", "pixtral-12b")).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Vision
      );
    });

    it("classifies mistral-small as Chat", () => {
      expect(inferCapabilities("mistral", "mistral-small-2402")).toBe(
        CapabilitiesUI.Chat
      );
    });

    it("classifies mistral-medium as Chat", () => {
      expect(inferCapabilities("mistral", "mistral-medium-latest")).toBe(
        CapabilitiesUI.Chat
      );
    });

    it("classifies codestral as Chat", () => {
      expect(inferCapabilities("mistral", "codestral-latest")).toBe(
        CapabilitiesUI.Chat
      );
    });

    it("returns Chat for unknown mistral models", () => {
      expect(inferCapabilities("mistral", "mistral-nemo")).toBe(
        CapabilitiesUI.Chat
      );
    });
  });

  describe("xai", () => {
    it("classifies vision models as Chat | Vision", () => {
      expect(inferCapabilities("xai", "grok-vision-beta")).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Vision
      );
    });

    it("classifies image models as Image", () => {
      expect(inferCapabilities("xai", "grok-image-2")).toBe(
        CapabilitiesUI.Image
      );
    });

    it("returns Chat for ordinary xai models", () => {
      expect(inferCapabilities("xai", "grok-4")).toBe(CapabilitiesUI.Chat);
    });
  });

  describe("groq", () => {
    it("classifies vision models as Chat | Vision", () => {
      expect(inferCapabilities("groq", "llama-3.2-90b-vision")).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Vision
      );
    });

    it("returns Chat | Tools for ordinary groq models", () => {
      expect(inferCapabilities("groq", "llama-3.3-70b-versatile")).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Tools
      );
    });
  });

  describe("zhipu", () => {
    it("classifies cogview models as Image", () => {
      expect(inferCapabilities("zhipu", "cogview-3")).toBe(
        CapabilitiesUI.Image
      );
    });

    it("classifies image models as Image", () => {
      expect(inferCapabilities("zhipu", "glm-image-1")).toBe(
        CapabilitiesUI.Image
      );
    });

    it("returns Chat | Tools for ordinary zhipu models", () => {
      expect(inferCapabilities("zhipu", "glm-4-plus")).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Tools
      );
    });
  });

  describe("stabilityai", () => {
    it("returns Image for any stabilityai model", () => {
      expect(inferCapabilities("stabilityai", "stable-diffusion")).toBe(
        CapabilitiesUI.Image
      );
    });
  });

  describe("default fallback", () => {
    it("returns Chat | Vision | Tools for unknown providers", () => {
      const expected =
        CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools;
      expect(inferCapabilities("together", "anything")).toBe(expected);
      expect(inferCapabilities("openrouter", "anything")).toBe(expected);
      expect(inferCapabilities("deepseek", "deepseek-chat")).toBe(expected);
      expect(inferCapabilities("ollama", "llama3.1")).toBe(expected);
      expect(inferCapabilities("lm-studio", "anything")).toBe(expected);
      expect(inferCapabilities("openaicompatible", "anything")).toBe(expected);
      expect(inferCapabilities("genai", "gemini-1.5-pro")).toBe(expected);
      expect(inferCapabilities("gpt4all", "anything")).toBe(expected);
      expect(inferCapabilities("custom-provider", "model")).toBe(expected);
    });
  });

  it("normalises modelId to lowercase before matching", () => {
    expect(inferCapabilities("openai", "DALL-E-3")).toBe(CapabilitiesUI.Image);
    expect(inferCapabilities("openai", "WHISPER-1")).toBe(CapabilitiesUI.Audio);
  });
});
