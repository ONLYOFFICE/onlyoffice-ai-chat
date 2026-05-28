import { describe, expect, it, vi } from "vitest";
import type { ThreadMessageLike } from "@assistant-ui/react";
import { generateImage } from "../index";
import type { ActionArgs } from "../../types";

const { providerFor } = vi.hoisted(() => ({
  providerFor: vi.fn(),
}));

vi.mock("../../provider", () => ({
  providerFor,
}));

vi.mock("../../system-prompt", () => ({
  resolveSystemPrompt: (def: string, prompt?: { text: string }) =>
    prompt ? `${def}::${prompt.text}` : def,
}));

vi.mock("../prompt", () => ({
  systemPrompt: "default-image-prompt",
}));

const profile = {
  id: "p",
  modelId: "m",
} as unknown as ActionArgs["profile"];

describe("generateImage", () => {
  it("uses provider.imageGeneration with extracted user prompt", async () => {
    const imageGeneration = vi.fn().mockResolvedValue("base64");
    providerFor.mockReturnValue({ imageGeneration });
    const out = await generateImage({
      profile,
      messages: [{ role: "user", content: "draw a cat" } as ThreadMessageLike],
    });
    expect(imageGeneration).toHaveBeenCalledWith({
      model: "m",
      prompt: "draw a cat",
      signal: undefined,
    });
    expect(out).toEqual({
      role: "assistant",
      content: [{ type: "image", image: "data:image/png;base64,base64" }],
    });
  });

  it("extracts prompt from array content", async () => {
    const imageGeneration = vi.fn().mockResolvedValue("b64");
    providerFor.mockReturnValue({ imageGeneration });
    await generateImage({
      profile,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "line 1" },
            { type: "image", image: "x" },
            { type: "text", text: "line 2" },
          ],
        } as ThreadMessageLike,
      ],
    });
    expect(imageGeneration.mock.calls[0][0].prompt).toBe("line 1\nline 2");
  });

  it("walks back to find the most recent user message", async () => {
    const imageGeneration = vi.fn().mockResolvedValue("b64");
    providerFor.mockReturnValue({ imageGeneration });
    await generateImage({
      profile,
      messages: [
        { role: "user", content: "ignored" },
        { role: "assistant", content: "in between" },
        { role: "user", content: "latest" },
      ] as ThreadMessageLike[],
    });
    expect(imageGeneration.mock.calls[0][0].prompt).toBe("latest");
  });

  it("returns empty prompt when no user message found", async () => {
    const imageGeneration = vi.fn().mockResolvedValue("b64");
    providerFor.mockReturnValue({ imageGeneration });
    await generateImage({
      profile,
      messages: [
        { role: "assistant", content: "only assistant" },
      ] as ThreadMessageLike[],
    });
    expect(imageGeneration.mock.calls[0][0].prompt).toBe("");
  });

  it("uses prompt override in replace mode", async () => {
    const imageGeneration = vi.fn().mockResolvedValue("b64");
    providerFor.mockReturnValue({ imageGeneration });
    await generateImage({
      profile,
      messages: [{ role: "user", content: "user" } as ThreadMessageLike],
      prompt: { mode: "replace", text: "custom-prompt" },
    });
    expect(imageGeneration.mock.calls[0][0].prompt).toBe("custom-prompt");
  });

  it("uses prompt override in append mode", async () => {
    const imageGeneration = vi.fn().mockResolvedValue("b64");
    providerFor.mockReturnValue({ imageGeneration });
    await generateImage({
      profile,
      messages: [{ role: "user", content: "user-prompt" } as ThreadMessageLike],
      prompt: { mode: "append", text: "extra" },
    });
    expect(imageGeneration.mock.calls[0][0].prompt).toBe(
      "user-prompt\n\nextra"
    );
  });

  it("falls back to sendMessageSync when provider has no imageGeneration", async () => {
    const sendMessageSync = vi.fn().mockResolvedValue("rendered text");
    providerFor.mockReturnValue({ sendMessageSync });
    const out = await generateImage({
      profile,
      messages: [{ role: "user", content: "draw" } as ThreadMessageLike],
    });
    expect(sendMessageSync).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "m",
        systemPrompt: "default-image-prompt",
      })
    );
    expect(out).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "rendered text" }],
    });
  });
});
