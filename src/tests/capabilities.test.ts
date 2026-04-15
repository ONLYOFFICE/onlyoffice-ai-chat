import { describe, expect, it } from "vitest";
import { CapabilitiesUI, inferCapabilities, ActionType } from "../capabilities";

describe("CapabilitiesUI", () => {
  it("has expected bitmask values", () => {
    expect(CapabilitiesUI.None).toBe(0);
    expect(CapabilitiesUI.Chat).toBe(0x01);
    expect(CapabilitiesUI.Image).toBe(0x02);
    expect(CapabilitiesUI.Embeddings).toBe(0x04);
    expect(CapabilitiesUI.Audio).toBe(0x08);
    expect(CapabilitiesUI.Vision).toBe(0x80);
    expect(CapabilitiesUI.Tools).toBe(0x100);
  });
});

describe("ActionType", () => {
  it("has all expected action types", () => {
    expect(ActionType.Chat).toBe("Chat");
    expect(ActionType.Summarization).toBe("Summarization");
    expect(ActionType.Translation).toBe("Translation");
    expect(ActionType.TextAnalyze).toBe("TextAnalyze");
    expect(ActionType.ImageGeneration).toBe("ImageGeneration");
    expect(ActionType.OCR).toBe("OCR");
    expect(ActionType.Vision).toBe("Vision");
  });
});

describe("inferCapabilities", () => {
  // OpenAI
  describe("openai", () => {
    it("returns Audio for whisper", () => {
      expect(inferCapabilities("openai", "whisper-1")).toBe(
        CapabilitiesUI.Audio
      );
    });

    it("returns Audio for tts-1", () => {
      expect(inferCapabilities("openai", "tts-1-hd")).toBe(
        CapabilitiesUI.Audio
      );
    });

    it("returns Embeddings for embedding models", () => {
      expect(inferCapabilities("openai", "text-embedding-ada-002")).toBe(
        CapabilitiesUI.Embeddings
      );
    });

    it("returns Image for DALL-E models", () => {
      expect(inferCapabilities("openai", "dall-e-2")).toBe(
        CapabilitiesUI.Image
      );
      expect(inferCapabilities("openai", "dall-e-3")).toBe(
        CapabilitiesUI.Image
      );
    });

    it("returns Image for -image- models", () => {
      expect(inferCapabilities("openai", "gpt-image-1")).toBe(
        CapabilitiesUI.Image
      );
    });

    it("returns Chat only for gpt-3.5-turbo-instruct", () => {
      expect(inferCapabilities("openai", "gpt-3.5-turbo-instruct")).toBe(
        CapabilitiesUI.Chat
      );
    });

    it("returns Chat|Vision for general openai models", () => {
      expect(inferCapabilities("openai", "gpt-4o")).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Vision
      );
    });
  });

  // Anthropic
  describe("anthropic", () => {
    it("returns Chat only for claude-2", () => {
      expect(inferCapabilities("anthropic", "claude-2.1")).toBe(
        CapabilitiesUI.Chat
      );
    });

    it("returns Chat only for claude-3-5-haiku", () => {
      expect(inferCapabilities("anthropic", "claude-3-5-haiku-20241022")).toBe(
        CapabilitiesUI.Chat
      );
    });

    it("returns Chat|Vision for claude-3 sonnet/opus", () => {
      expect(inferCapabilities("anthropic", "claude-3-opus-20240229")).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Vision
      );
    });
  });

  // Mistral
  describe("mistral", () => {
    it("returns Embeddings for mistral-embed", () => {
      expect(inferCapabilities("mistral", "mistral-embed")).toBe(
        CapabilitiesUI.Embeddings
      );
    });

    it("returns Chat|Vision for pixtral", () => {
      expect(inferCapabilities("mistral", "pixtral-large-latest")).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Vision
      );
    });

    it("returns Chat for mistral-small", () => {
      expect(inferCapabilities("mistral", "mistral-small-latest")).toBe(
        CapabilitiesUI.Chat
      );
    });

    it("returns Chat for mistral-medium", () => {
      expect(inferCapabilities("mistral", "mistral-medium-latest")).toBe(
        CapabilitiesUI.Chat
      );
    });

    it("returns Chat for codestral", () => {
      expect(inferCapabilities("mistral", "codestral-latest")).toBe(
        CapabilitiesUI.Chat
      );
    });

    it("returns Chat for other mistral models", () => {
      expect(inferCapabilities("mistral", "mistral-large-latest")).toBe(
        CapabilitiesUI.Chat
      );
    });
  });

  // xAI
  describe("xai", () => {
    it("returns Chat|Vision for vision models", () => {
      expect(inferCapabilities("xai", "grok-vision-beta")).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Vision
      );
    });

    it("returns Image for image models", () => {
      expect(inferCapabilities("xai", "grok-image")).toBe(CapabilitiesUI.Image);
    });

    it("returns Chat for default xai", () => {
      expect(inferCapabilities("xai", "grok-beta")).toBe(CapabilitiesUI.Chat);
    });
  });

  // Groq
  describe("groq", () => {
    it("returns Chat|Vision for vision models", () => {
      expect(
        inferCapabilities("groq", "llava-v1.5-7b-4096-preview-vision")
      ).toBe(CapabilitiesUI.Chat | CapabilitiesUI.Vision);
    });

    it("returns Chat|Tools for default groq", () => {
      expect(inferCapabilities("groq", "llama3-8b-8192")).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Tools
      );
    });
  });

  // ZhiPu
  describe("zhipu", () => {
    it("returns Image for cogview", () => {
      expect(inferCapabilities("zhipu", "cogview-3")).toBe(
        CapabilitiesUI.Image
      );
    });

    it("returns Image for image models", () => {
      expect(inferCapabilities("zhipu", "image-generation")).toBe(
        CapabilitiesUI.Image
      );
    });

    it("returns Chat|Tools for default zhipu", () => {
      expect(inferCapabilities("zhipu", "glm-4")).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Tools
      );
    });
  });

  // StabilityAI
  describe("stabilityai", () => {
    it("always returns Image", () => {
      expect(inferCapabilities("stabilityai", "stable-diffusion-xl")).toBe(
        CapabilitiesUI.Image
      );
    });
  });

  // Default
  describe("default providers", () => {
    it("returns Chat|Vision|Tools for unknown providers", () => {
      const expected =
        CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools;
      expect(inferCapabilities("together", "any-model")).toBe(expected);
      expect(inferCapabilities("openrouter", "any-model")).toBe(expected);
      expect(inferCapabilities("deepseek", "deepseek-chat")).toBe(expected);
      expect(inferCapabilities("ollama", "llama3")).toBe(expected);
      expect(inferCapabilities("lm-studio", "local")).toBe(expected);
      expect(inferCapabilities("genai", "gemini-pro")).toBe(expected);
      expect(inferCapabilities("gpt4all", "gpt4all")).toBe(expected);
    });
  });
});
