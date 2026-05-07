import { describe, expect, it } from "vitest";
import { CapabilitiesUI, inferCapabilities, ActionType } from "../capabilities";

const C = CapabilitiesUI;

describe("inferCapabilities", () => {
  it.each([
    ["openai", "whisper-1", C.Audio],
    ["openai", "tts-1", C.Audio],
    ["openai", "text-embedding-3-small", C.Embeddings],
    ["openai", "dall-e-2", C.Image],
    ["openai", "dall-e-3", C.Image],
    ["openai", "gpt-image-1", C.Image],
    ["openai", "gpt-3.5-turbo-instruct", C.Chat],
    ["openai", "gpt-4o", C.Chat | C.Vision],
    ["anthropic", "claude-2.1", C.Chat],
    ["anthropic", "claude-3-5-haiku", C.Chat],
    ["anthropic", "claude-sonnet-4", C.Chat | C.Vision],
    ["mistral", "mistral-embed", C.Embeddings],
    ["mistral", "pixtral-12b", C.Chat | C.Vision],
    ["mistral", "mistral-small", C.Chat],
    ["mistral", "mistral-medium", C.Chat],
    ["mistral", "codestral-latest", C.Chat],
    ["mistral", "open-mistral-7b", C.Chat],
    ["xai", "grok-vision", C.Chat | C.Vision],
    ["xai", "grok-image", C.Image],
    ["xai", "grok-2", C.Chat],
    ["groq", "llama-vision", C.Chat | C.Vision],
    ["groq", "llama-3.1-70b", C.Chat | C.Tools],
    ["zhipu", "cogview-3", C.Image],
    ["zhipu", "image-x", C.Image],
    ["zhipu", "glm-4", C.Chat | C.Tools],
    ["stabilityai", "stable-diffusion-3", C.Image],
    ["openrouter", "mystery", C.Chat | C.Vision | C.Tools],
  ])("infers %s/%s", (provider, model, expected) => {
    expect(inferCapabilities(provider, model)).toBe(expected);
  });
});

describe("ActionType", () => {
  it("exports the correct keys", () => {
    expect(Object.keys(ActionType)).toEqual([
      "Default",
      "Chat",
      "Code",
      "Summarization",
      "Translation",
      "TextAnalyze",
      "ImageGeneration",
      "OCR",
      "Vision",
    ]);
  });
});
