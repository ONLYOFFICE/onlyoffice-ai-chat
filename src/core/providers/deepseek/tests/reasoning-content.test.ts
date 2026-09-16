import type { ThreadMessageLike } from "@assistant-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFinishChunk, createMockStream } from "../../tests/test-utils";
import { DeepSeekProvider } from "../index";

const { chatCreateMock } = vi.hoisted(() => ({ chatCreateMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: chatCreateMock } };
  },
}));

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

describe("DeepSeekProvider — reasoning_content replay", () => {
  beforeEach(() => chatCreateMock.mockReset());

  it("sends reasoning_content on every assistant message, empty when the round had none", async () => {
    chatCreateMock.mockResolvedValueOnce(
      createMockStream([createFinishChunk()])
    );
    const p = new DeepSeekProvider({
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk",
    });

    const history: ThreadMessageLike[] = [
      { role: "user", content: "read the sheet" },
      // A turn produced with thinking off — no reasoning part at all.
      { role: "assistant", content: "Sure." },
      { role: "user", content: "now analyse" },
      {
        role: "assistant",
        content: [
          {
            type: "reasoning",
            text: "need the cells",
            parentId: "reasoning-1",
          },
          {
            type: "tool-call",
            toolCallId: "c1",
            toolName: "read_sheet",
            argsText: "{}",
            args: {},
            result: "{}",
          },
          // Second round: the model went straight to a tool call.
          {
            type: "tool-call",
            toolCallId: "c2",
            toolName: "get_formulas",
            argsText: "{}",
            args: {},
            result: "{}",
          },
        ],
      } as ThreadMessageLike,
    ];

    await drain(
      p.sendMessage({
        messages: history,
        model: "deepseek-v4-flash",
        systemPrompt: "s",
        tools: [],
      })
    );

    const sent = chatCreateMock.mock.calls[0]?.[0]?.messages as Array<{
      role: string;
      reasoning_content?: string;
    }>;
    const assistants = sent.filter((m) => m.role === "assistant");
    expect(assistants).toHaveLength(2);
    expect(assistants.every((m) => "reasoning_content" in m)).toBe(true);
    expect(assistants[0].reasoning_content).toBe("");
    expect(assistants[1].reasoning_content).toBe("need the cells");
  });
});
