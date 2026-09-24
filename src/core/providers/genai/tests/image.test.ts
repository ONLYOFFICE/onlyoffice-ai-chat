import { describe, expect, it, vi } from "vitest";
import type { GoogleGenAI } from "@google/genai";
import {
  generateGeminiImage,
  generateImage,
  generateImagenImage,
  isImagenModel,
  toAspectRatio,
} from "../image";

/** Minimal stand-in for the parts of the SDK client the module touches. */
const makeClient = (models: Record<string, unknown>) =>
  ({ models }) as unknown as GoogleGenAI;

describe("genai/image/toAspectRatio", () => {
  it("defaults to 1:1 when size is unspecified", () => {
    expect(toAspectRatio()).toBe("1:1");
    expect(toAspectRatio(1024, undefined)).toBe("1:1");
    expect(toAspectRatio(undefined, 1024)).toBe("1:1");
  });

  it("maps exact ratios", () => {
    expect(toAspectRatio(1024, 1024)).toBe("1:1");
    expect(toAspectRatio(1920, 1080)).toBe("16:9");
    expect(toAspectRatio(1080, 1920)).toBe("9:16");
    expect(toAspectRatio(1024, 768)).toBe("4:3");
    expect(toAspectRatio(768, 1024)).toBe("3:4");
  });

  it("snaps an unsupported ratio to the closest supported one", () => {
    expect(toAspectRatio(2000, 1000)).toBe("16:9");
  });
});

describe("genai/image/isImagenModel", () => {
  it("recognises Imagen models regardless of case", () => {
    expect(isImagenModel("imagen-4.0-generate-001")).toBe(true);
    expect(isImagenModel("IMAGEN-3.0")).toBe(true);
  });

  it("rejects Gemini-native image models", () => {
    expect(isImagenModel("gemini-2.5-flash-image")).toBe(false);
    expect(isImagenModel("gemini-3-pro-image-preview")).toBe(false);
  });
});

describe("genai/image/generateImagenImage", () => {
  it("requests one PNG at the mapped aspect ratio and returns its bytes", async () => {
    const generateImages = vi.fn().mockResolvedValue({
      generatedImages: [{ image: { imageBytes: "aW1n" } }],
    });
    const signal = new AbortController().signal;

    const out = await generateImagenImage(makeClient({ generateImages }), {
      model: "imagen-4.0-generate-001",
      prompt: "carrot",
      width: 1920,
      height: 1080,
      signal,
    });

    expect(out).toBe("aW1n");
    expect(generateImages).toHaveBeenCalledWith({
      model: "imagen-4.0-generate-001",
      prompt: "carrot",
      config: {
        numberOfImages: 1,
        aspectRatio: "16:9",
        outputMimeType: "image/png",
        abortSignal: signal,
      },
    });
  });

  it("returns an empty string when the service produced no image", async () => {
    const generateImages = vi.fn().mockResolvedValue({ generatedImages: [] });
    const out = await generateImagenImage(makeClient({ generateImages }), {
      model: "imagen-4.0-generate-001",
      prompt: "p",
    });
    expect(out).toBe("");
  });
});

describe("genai/image/generateGeminiImage", () => {
  it("asks for both modalities and returns the inline image data", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              { text: "here you go" },
              { inlineData: { mimeType: "image/png", data: "Ym9keQ==" } },
            ],
          },
        },
      ],
    });
    const signal = new AbortController().signal;

    const out = await generateGeminiImage(makeClient({ generateContent }), {
      model: "gemini-2.5-flash-image",
      prompt: "carrot",
      signal,
    });

    expect(out).toBe("Ym9keQ==");
    expect(generateContent).toHaveBeenCalledWith({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts: [{ text: "carrot" }] }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        abortSignal: signal,
      },
    });
  });

  it("skips thought parts and returns the finished image", async () => {
    // Gemini 3 Pro Image reasons first: the thinking parts arrive ahead of
    // the real image, and a thought part can carry inlineData of its own.
    const generateContent = vi.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: "planning a carrot" },
              { thought: true, inlineData: { data: "c2tldGNo" } },
              { inlineData: { data: "ZmluYWw=" } },
            ],
          },
        },
      ],
    });

    const out = await generateGeminiImage(makeClient({ generateContent }), {
      model: "gemini-3-pro-image-preview",
      prompt: "carrot",
    });

    expect(out).toBe("ZmluYWw=");
  });

  it("returns an empty string when the response is reasoning only", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ thought: true, inlineData: { data: "c2tldGNo" } }],
          },
        },
      ],
    });

    const out = await generateGeminiImage(makeClient({ generateContent }), {
      model: "gemini-3-pro-image-preview",
      prompt: "carrot",
    });

    expect(out).toBe("");
  });

  it("returns an empty string for a text-only response", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "refused" }] } }],
    });
    const out = await generateGeminiImage(makeClient({ generateContent }), {
      model: "gemini-2.5-flash-image",
      prompt: "p",
    });
    expect(out).toBe("");
  });

  it("tolerates a response with no candidates", async () => {
    const generateContent = vi.fn().mockResolvedValue({});
    const out = await generateGeminiImage(makeClient({ generateContent }), {
      model: "gemini-2.5-flash-image",
      prompt: "p",
    });
    expect(out).toBe("");
  });
});

describe("genai/image/generateImage", () => {
  it("routes Imagen models to generateImages", async () => {
    const generateImages = vi.fn().mockResolvedValue({
      generatedImages: [{ image: { imageBytes: "a" } }],
    });
    const generateContent = vi.fn();

    const out = await generateImage(
      makeClient({ generateImages, generateContent }),
      { model: "imagen-4.0-generate-001", prompt: "p" }
    );

    expect(out).toBe("a");
    expect(generateImages).toHaveBeenCalled();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("routes Gemini image models to generateContent", async () => {
    const generateImages = vi.fn();
    const generateContent = vi.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ inlineData: { data: "b" } }] } }],
    });

    const out = await generateImage(
      makeClient({ generateImages, generateContent }),
      { model: "gemini-3-pro-image-preview", prompt: "p" }
    );

    expect(out).toBe("b");
    expect(generateContent).toHaveBeenCalled();
    expect(generateImages).not.toHaveBeenCalled();
  });
});
