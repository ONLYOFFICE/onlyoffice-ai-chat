import { describe, expect, it, vi } from "vitest";
import type { ThreadMessageLike } from "@assistant-ui/react";
import {
  readToolCall,
  readToolCallArgs,
  patchToolCallArgs,
  patchToolCallResult,
  replaceContentPart,
  resumeChat,
  type ToolCallPart,
} from "../tool-call";

const { chatMock, processStreamMock } = vi.hoisted(() => ({
  chatMock: vi.fn(() => "chat-stream"),
  processStreamMock: vi.fn(),
}));

vi.mock("../../../actions/chat", () => ({
  chat: chatMock,
}));

vi.mock("../stream", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../stream")>()),
  processStream: processStreamMock,
}));

const toolCallPart = (overrides: Partial<ToolCallPart> = {}): ToolCallPart =>
  ({
    type: "tool-call",
    toolCallId: "c1",
    toolName: "echo",
    args: { x: 1 },
    ...overrides,
  }) as ToolCallPart;

const message = (parts: unknown[]): ThreadMessageLike =>
  ({ role: "assistant", content: parts }) as ThreadMessageLike;

describe("tool-call helpers", () => {
  describe("readToolCall", () => {
    it("returns the tool-call part at idx", () => {
      const part = toolCallPart();
      expect(readToolCall(message([part]), 0)).toBe(part);
    });

    it("returns null when content is a string", () => {
      const m = { role: "assistant", content: "hi" } as ThreadMessageLike;
      expect(readToolCall(m, 0)).toBeNull();
    });

    it("returns null when idx is out of bounds", () => {
      expect(readToolCall(message([]), 5)).toBeNull();
    });

    it("returns null when part is not a tool-call", () => {
      const m = message([{ type: "text", text: "hi" }]);
      expect(readToolCall(m, 0)).toBeNull();
    });

    it("returns null when part has no type", () => {
      const m = message([{}]);
      expect(readToolCall(m, 0)).toBeNull();
    });
  });

  describe("readToolCallArgs", () => {
    it("returns args from the tool-call", () => {
      const m = message([toolCallPart({ args: { foo: "bar" } })]);
      expect(readToolCallArgs(m, 0)).toEqual({ foo: "bar" });
    });

    it("defaults to {} when no tool-call at idx", () => {
      expect(readToolCallArgs(message([]), 0)).toEqual({});
    });

    it("defaults to {} when args is missing", () => {
      const m = message([toolCallPart({ args: undefined as never })]);
      expect(readToolCallArgs(m, 0)).toEqual({});
    });
  });

  describe("replaceContentPart", () => {
    it("replaces the entry at idx", () => {
      const original = toolCallPart();
      const next = toolCallPart({ args: { foo: "bar" } });
      const m = message([original, { type: "text", text: "hi" }]);
      const out = replaceContentPart(m, 0, next);
      expect((out.content as unknown[])[0]).toBe(next);
      expect((out.content as unknown[])[1]).toEqual({
        type: "text",
        text: "hi",
      });
    });

    it("leaves string content untouched", () => {
      const m = { role: "assistant", content: "hi" } as ThreadMessageLike;
      const out = replaceContentPart(m, 0, toolCallPart());
      expect(out.content).toBe("hi");
    });
  });

  describe("patchToolCallArgs", () => {
    it("updates args while preserving other fields", () => {
      const m = message([toolCallPart({ args: { a: 1 } })]);
      const out = patchToolCallArgs(m, 0, { a: 2, b: 3 });
      expect((out.content as ToolCallPart[])[0].args).toEqual({ a: 2, b: 3 });
      expect((out.content as ToolCallPart[])[0].toolName).toBe("echo");
    });

    it("returns the same message when there is no tool-call at idx", () => {
      const m = message([{ type: "text", text: "x" }]);
      expect(patchToolCallArgs(m, 0, {})).toBe(m);
    });
  });

  describe("patchToolCallResult", () => {
    it("updates result while preserving other fields", () => {
      const m = message([toolCallPart()]);
      const out = patchToolCallResult(m, 0, { ok: true });
      expect((out.content as ToolCallPart[])[0].result).toEqual({ ok: true });
    });

    it("returns the same message when no tool-call at idx", () => {
      const m = message([{ type: "text", text: "x" }]);
      expect(patchToolCallResult(m, 0, "x")).toBe(m);
    });
  });

  describe("resumeChat", () => {
    it("returns immediately when message has no tool-call at idx", async () => {
      const ctx = {
        storage: {
          messages: { update: vi.fn(), readByThread: vi.fn() },
        },
      } as never;
      const gen = resumeChat(ctx, {
        threadId: "t",
        messageId: "m",
        idx: 0,
        message: message([{ type: "text", text: "x" }]),
        result: "ok",
        profile: { id: "p" } as never,
        profileId: "p",
      });
      const next = await gen.next();
      expect(next.done).toBe(true);
    });

    it("persists result and yields stream events", async () => {
      processStreamMock.mockImplementation(async function* () {
        yield { type: "message-end" };
      });

      const update = vi.fn().mockResolvedValue(undefined);
      const readByThread = vi
        .fn()
        .mockResolvedValue([
          { role: "user", content: [{ type: "text", text: "hi" }] },
        ]);
      const ctx = {
        storage: { messages: { update, readByThread } },
      } as never;

      const gen = resumeChat(ctx, {
        threadId: "t",
        messageId: "m",
        idx: 0,
        message: message([toolCallPart()]),
        result: "tool-result",
        profile: { id: "p" } as never,
        profileId: "p",
        signal: undefined,
        tools: { foo: [] } as never,
      });

      const events = [];
      for await (const e of gen) events.push(e);
      expect(events).toEqual([{ type: "message-end" }]);
      expect(update).toHaveBeenCalledWith(
        "m",
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({ result: "tool-result" }),
          ]),
        })
      );
      expect(chatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: { id: "p" },
          messages: expect.any(Array),
          tools: { foo: [] },
        })
      );
    });
  });
});
