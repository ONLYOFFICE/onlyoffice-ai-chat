import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it, vi } from "vitest";
import { ActionType } from "../../../../shared/action-type";
import type { SendMessageResult } from "../../../../shared/send-message-args";
import { drainToFinal, runSync } from "../actions";

vi.mock("../../../actions/summarization", () => ({
  summarize: vi.fn(async () => ({
    role: "assistant",
    content: [{ type: "text", text: "summary" }],
  })),
}));
vi.mock("../../../actions/translation", () => ({
  translate: vi.fn(async () => ({
    role: "assistant",
    content: [{ type: "text", text: "translation" }],
  })),
}));
vi.mock("../../../actions/text-analyze", () => ({
  analyzeText: vi.fn(async () => ({
    role: "assistant",
    content: [{ type: "text", text: "analysis" }],
  })),
}));
vi.mock("../../../actions/image-generation", () => ({
  generateImage: vi.fn(async () => ({
    role: "assistant",
    content: [{ type: "text", text: "image" }],
  })),
}));
vi.mock("../../../actions/ocr", () => ({
  recognizeText: vi.fn(async () => ({
    role: "assistant",
    content: [{ type: "text", text: "ocr" }],
  })),
}));
vi.mock("../../../actions/vision", () => ({
  describeImage: vi.fn(async () => ({
    role: "assistant",
    content: [{ type: "text", text: "vision" }],
  })),
}));

const dummyArgs = {
  profile: {
    providerType: "x",
    baseUrl: "u",
    key: "k",
    modelId: "m",
  },
  messages: [],
};

describe("runSync", () => {
  it.each([
    [ActionType.Summarization, "summary"],
    [ActionType.Translation, "translation"],
    [ActionType.TextAnalyze, "analysis"],
    [ActionType.ImageGeneration, "image"],
    [ActionType.OCR, "ocr"],
    [ActionType.Vision, "vision"],
  ])("dispatches %s to its action", async (type, text) => {
    const result = await runSync(type, dummyArgs);
    expect(result).toEqual({
      role: "assistant",
      content: [{ type: "text", text }],
    });
  });

  it("throws on unregistered action types", () => {
    expect(() => runSync(ActionType.Chat, dummyArgs)).toThrow(
      /No action registered for ActionType.Chat/
    );
  });
});

async function* arrayToStream(items: SendMessageResult[]) {
  for (const it of items) yield it;
}

describe("drainToFinal", () => {
  it("returns the responseMessage from the last terminal event", async () => {
    const final: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "final" }],
    };
    const stream = arrayToStream([
      { role: "assistant", content: [{ type: "text", text: "delta" }] },
      { isEnd: true, responseMessage: final },
    ]);
    const result = await drainToFinal(stream);
    expect(result).toEqual(final);
  });

  it("throws when the stream never produces an isEnd event", async () => {
    const stream = arrayToStream([
      { role: "assistant", content: [{ type: "text", text: "no end" }] },
    ]);
    await expect(drainToFinal(stream)).rejects.toThrow(
      /Streaming action produced no terminal result/
    );
  });
});
