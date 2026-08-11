import type { ThreadMessageLike } from "@assistant-ui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SendMessageResult } from "../../../shared/send-message-args";
import { augmentToolsWithIntent } from "../../../shared/tool-intent";
import { AbstractBaseProvider } from "../../providers";
import { registerProvider, unregisterProvider } from "../../providers";
import { chat } from "../chat";
import { systemPrompt as chatSystemPrompt } from "../chat/prompt";
import { custom, customSync } from "../custom";
import { generateImage } from "../image-generation";
import { systemPrompt as imageSystemPrompt } from "../image-generation/prompt";
import { recognizeText } from "../ocr";
import { systemPrompt as ocrSystemPrompt } from "../ocr/prompt";
import { summarize } from "../summarization";
import { systemPrompt as summarizationSystemPrompt } from "../summarization/prompt";
import { analyzeText } from "../text-analyze";
import { systemPrompt as textAnalyzeSystemPrompt } from "../text-analyze/prompt";
import { generateTitle } from "../title";
import { systemPrompt as titleSystemPrompt } from "../title/prompt";
import { translate } from "../translation";
import { systemPrompt as translationSystemPrompt } from "../translation/prompt";
import type { ActionArgs } from "../types";
import { describeImage } from "../vision";
import { systemPrompt as visionSystemPrompt } from "../vision/prompt";

const sendMessageMock = vi.fn();
const sendMessageSyncMock = vi.fn();

class StubProvider extends AbstractBaseProvider {
  async *sendMessage(args: unknown): AsyncGenerator<SendMessageResult> {
    yield* sendMessageMock(args);
  }
  async sendMessageSync(args: unknown): Promise<string> {
    return sendMessageSyncMock(args);
  }
  static getName(): string {
    return "ActionStub";
  }
  static getBaseUrl(): string {
    return "https://stub";
  }
  static async checkProvider(): Promise<boolean> {
    return true;
  }
  static async getProviderModels(): Promise<[]> {
    return [];
  }
}

const profile = {
  providerType: "action-stub",
  baseUrl: "https://stub",
  key: "k",
  modelId: "m1",
};

const message: ThreadMessageLike = {
  role: "user",
  content: [{ type: "text", text: "hi" }],
};

const baseArgs: ActionArgs = {
  profile,
  messages: [message],
};

beforeEach(() => {
  sendMessageMock.mockReset();
  sendMessageSyncMock.mockReset();
  registerProvider("action-stub", StubProvider);
});

afterEach(() => {
  unregisterProvider("action-stub");
});

async function* asyncFromArray(items: SendMessageResult[]) {
  for (const it of items) yield it;
}

describe("chat action", () => {
  it("forwards messages, model, prompt and tools to the provider", async () => {
    sendMessageMock.mockReturnValueOnce(asyncFromArray([message]));
    const tools = [
      { name: "t", description: "", inputSchema: {}, enabled: true },
    ];
    const signal = new AbortController().signal;
    const args: ActionArgs = {
      ...baseArgs,
      tools,
      isReasoning: true,
      signal,
    };

    const stream = chat(args);
    for await (const _ of stream) {
      // drain
    }

    // The chat action injects the synthetic `aiChatIntent` argument into every
    // tool schema before handing tools to the provider.
    expect(sendMessageMock).toHaveBeenCalledWith({
      messages: args.messages,
      model: profile.modelId,
      systemPrompt: chatSystemPrompt,
      tools: augmentToolsWithIntent(tools),
      withReasoning: true,
      useResponsesApi: false,
      signal,
    });
    expect(
      sendMessageMock.mock.calls[0][0].tools[0].inputSchema.required
    ).toContain("aiChatIntent");
  });

  it("respects the system-prompt 'replace' override", async () => {
    sendMessageMock.mockReturnValueOnce(asyncFromArray([]));
    const stream = chat({
      ...baseArgs,
      prompt: { mode: "replace", text: "REPLACED" },
    });
    for await (const _ of stream) {
      // drain
    }
    expect(sendMessageMock.mock.calls[0][0].systemPrompt).toBe("REPLACED");
  });

  it("respects the system-prompt 'append' override", async () => {
    sendMessageMock.mockReturnValueOnce(asyncFromArray([]));
    const stream = chat({
      ...baseArgs,
      prompt: { mode: "append", text: "EXTRA" },
    });
    for await (const _ of stream) {
      // drain
    }
    expect(sendMessageMock.mock.calls[0][0].systemPrompt).toBe(
      `${chatSystemPrompt}\n\nEXTRA`
    );
  });
});

describe("custom action", () => {
  it("custom() streams via provider.sendMessage with caller's systemPrompt", async () => {
    sendMessageMock.mockReturnValueOnce(asyncFromArray([message]));
    const stream = custom({
      ...baseArgs,
      systemPrompt: "MY PROMPT",
      isReasoning: false,
    });
    for await (const _ of stream) {
      // drain
    }
    expect(sendMessageMock).toHaveBeenCalledWith({
      messages: baseArgs.messages,
      model: profile.modelId,
      systemPrompt: "MY PROMPT",
      tools: undefined,
      withReasoning: false,
      useResponsesApi: false,
      signal: undefined,
    });
  });

  it("customSync() returns a wrapped assistant message", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("hello");
    const result = await customSync({
      ...baseArgs,
      systemPrompt: "MY PROMPT",
    });
    expect(result).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
    });
    expect(sendMessageSyncMock).toHaveBeenCalledWith({
      messages: baseArgs.messages,
      model: profile.modelId,
      systemPrompt: "MY PROMPT",
      useResponsesApi: false,
      signal: undefined,
    });
  });
});

describe.each([
  ["summarize", summarize, summarizationSystemPrompt],
  ["translate", translate, translationSystemPrompt],
  ["analyzeText", analyzeText, textAnalyzeSystemPrompt],
  ["generateImage", generateImage, imageSystemPrompt],
  ["recognizeText", recognizeText, ocrSystemPrompt],
  ["describeImage", describeImage, visionSystemPrompt],
])("sync action %s", (name, action, prompt) => {
  it(`${name} delegates to provider.sendMessageSync with the baked-in prompt`, async () => {
    sendMessageSyncMock.mockResolvedValueOnce("OK");
    const result = await action(baseArgs);
    expect(result).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "OK" }],
    });
    expect(sendMessageSyncMock).toHaveBeenCalledWith({
      messages: baseArgs.messages,
      model: profile.modelId,
      systemPrompt: prompt,
      useResponsesApi: false,
      signal: undefined,
    });
  });

  it(`${name} honours system-prompt override`, async () => {
    sendMessageSyncMock.mockResolvedValueOnce("");
    await action({
      ...baseArgs,
      prompt: { mode: "replace", text: "P" },
    });
    expect(sendMessageSyncMock.mock.calls[0][0].systemPrompt).toBe("P");
  });
});

describe("generateTitle action", () => {
  it("trims the result", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("  My Title  ");
    const title = await generateTitle(baseArgs);
    expect(title).toBe("My Title");
    expect(sendMessageSyncMock).toHaveBeenCalledWith({
      messages: baseArgs.messages,
      model: profile.modelId,
      systemPrompt: titleSystemPrompt,
      useResponsesApi: false,
      signal: undefined,
    });
  });

  it("returns empty string when the model says nothing", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("   ");
    const title = await generateTitle(baseArgs);
    expect(title).toBe("");
  });

  it("respects the system-prompt override", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("X");
    await generateTitle({
      ...baseArgs,
      prompt: { mode: "append", text: "MORE" },
    });
    expect(sendMessageSyncMock.mock.calls[0][0].systemPrompt).toBe(
      `${titleSystemPrompt}\n\nMORE`
    );
  });

  // The prompt asks for a short single-line title; a weak model ignores it
  // and the result still has to fit a bounded, one-line-rendered field.
  it("collapses a multi-line answer into one line", async () => {
    sendMessageSyncMock.mockResolvedValueOnce(
      "Here is a title:\n\n  Workspace   capabilities\toverview\n"
    );
    expect(await generateTitle(baseArgs)).toBe(
      "Here is a title: Workspace capabilities overview"
    );
  });

  it("keeps a title that only slightly overshoots the prompted 60 chars", async () => {
    const long = "a".repeat(119);
    sendMessageSyncMock.mockResolvedValueOnce(long);
    expect(await generateTitle(baseArgs)).toBe(long);
  });

  it("truncates prose on a word boundary and marks it with an ellipsis", async () => {
    sendMessageSyncMock.mockResolvedValueOnce(`${"word ".repeat(80)}tail`);
    const title = await generateTitle(baseArgs);
    expect(title.length).toBeLessThanOrEqual(120);
    // Cut landed on the last space that fits, so no partial word survives.
    expect(title).toBe(`${"word ".repeat(22)}word…`);
  });

  it("cuts on the last space even when it sits early in the title", async () => {
    sendMessageSyncMock.mockResolvedValueOnce(`Hi ${"z".repeat(400)}`);
    expect(await generateTitle(baseArgs)).toBe("Hi…");
  });

  it("truncates mid-token when the title has no space at all", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("b".repeat(400));
    const title = await generateTitle(baseArgs);
    expect(title).toBe(`${"b".repeat(119)}…`);
  });

  // Spaceless text is cut by code unit, and an emoji occupies two of them —
  // a cut between the halves leaves a lone surrogate, which is not valid
  // UTF-8 and is rejected or mangled on its way into storage.
  it("never cuts a surrogate pair in half", async () => {
    // 59 emoji = 118 code units, so the 119-unit cut would land mid-pair.
    sendMessageSyncMock.mockResolvedValueOnce("🙂".repeat(80));
    const title = await generateTitle(baseArgs);
    expect(title).toBe(`${"🙂".repeat(59)}…`);
    // No lone surrogate survived: re-encoding is lossless.
    expect(Array.from(title)).toHaveLength(60);
  });
});
