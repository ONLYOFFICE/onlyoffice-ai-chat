import { describe, expect, it, vi } from "vitest";
import { MiddlewareRunner } from "../runner";
import type { ChatMiddleware } from "../types";

const baseSendCtx = {
  text: "hi",
  files: [],
  images: [],
  threadId: "t",
  profile: null,
  existingMessages: [],
} as never;

describe("MiddlewareRunner.isEmpty", () => {
  it("is true when no middlewares", () => {
    expect(new MiddlewareRunner([]).isEmpty).toBe(true);
  });
  it("is false with at least one middleware", () => {
    expect(
      new MiddlewareRunner([{ beforeSend: vi.fn() } as never]).isEmpty
    ).toBe(false);
  });
});

describe("runBeforeSend", () => {
  it("merges field overrides between middlewares", async () => {
    const m1: ChatMiddleware = {
      beforeSend: vi
        .fn()
        .mockResolvedValue({ action: "continue", text: "hello" }),
    };
    const m2: ChatMiddleware = {
      beforeSend: vi.fn(
        async (ctx) =>
          ({
            action: "continue",
            files: ctx.text === "hello" ? ["a"] : [],
          }) as never
      ),
    };
    const r = new MiddlewareRunner([m1, m2]);
    const out = await r.runBeforeSend(baseSendCtx);
    expect(out).toEqual({
      action: "continue",
      text: "hello",
      files: ["a"],
      images: [],
    });
  });

  it("blocks short-circuit the chain", async () => {
    const m1: ChatMiddleware = {
      beforeSend: vi.fn().mockResolvedValue({
        action: "block",
        reason: "no",
      }),
    };
    const m2: ChatMiddleware = { beforeSend: vi.fn() };
    const out = await new MiddlewareRunner([m1, m2]).runBeforeSend(baseSendCtx);
    expect(out).toEqual({ action: "block", reason: "no" });
    expect(m2.beforeSend).not.toHaveBeenCalled();
  });

  it("skips middlewares without beforeSend", async () => {
    const m1: ChatMiddleware = {};
    const m2: ChatMiddleware = {
      beforeSend: vi.fn().mockResolvedValue({ action: "continue" }),
    };
    await new MiddlewareRunner([m1, m2]).runBeforeSend(baseSendCtx);
    expect(m2.beforeSend).toHaveBeenCalled();
  });
});

describe("runOnStreamChunk", () => {
  it("replaces chunk on continue", async () => {
    const m1: ChatMiddleware = {
      onStreamChunk: vi
        .fn()
        .mockResolvedValue({ action: "continue", chunk: { type: "delta" } }),
    };
    const r = new MiddlewareRunner([m1]);
    const out = await r.runOnStreamChunk({ chunk: { type: "start" } } as never);
    expect(out).toEqual({ action: "continue", chunk: { type: "delta" } });
  });

  it("skips short-circuit", async () => {
    const m1: ChatMiddleware = {
      onStreamChunk: vi.fn().mockResolvedValue({ action: "skip" }),
    };
    const m2: ChatMiddleware = { onStreamChunk: vi.fn() };
    const out = await new MiddlewareRunner([m1, m2]).runOnStreamChunk(
      { chunk: { type: "start" } } as never
    );
    expect(out).toEqual({ action: "skip" });
    expect(m2.onStreamChunk).not.toHaveBeenCalled();
  });
});

describe("runBeforeToolCall", () => {
  it("merges args overrides", async () => {
    const m1: ChatMiddleware = {
      beforeToolCall: vi
        .fn()
        .mockResolvedValue({ action: "continue", args: { x: 1 } }),
    };
    const m2: ChatMiddleware = {
      beforeToolCall: vi.fn(async (ctx: { toolArgs: unknown }) => ({
        action: "continue" as const,
        args: { ...(ctx.toolArgs as object), y: 2 },
      })),
    };
    const r = new MiddlewareRunner([m1, m2]);
    const out = await r.runBeforeToolCall({ toolArgs: {} } as never);
    expect(out).toEqual({ action: "continue", args: { x: 1, y: 2 } });
  });

  it("approve and deny short-circuit", async () => {
    const m1: ChatMiddleware = {
      beforeToolCall: vi.fn().mockResolvedValue({ action: "deny" }),
    };
    const m2: ChatMiddleware = { beforeToolCall: vi.fn() };
    const out = await new MiddlewareRunner([m1, m2]).runBeforeToolCall(
      { toolArgs: {} } as never
    );
    expect(out).toEqual({ action: "deny" });
    expect(m2.beforeToolCall).not.toHaveBeenCalled();

    const m3: ChatMiddleware = {
      beforeToolCall: vi.fn().mockResolvedValue({ action: "approve" }),
    };
    expect(
      await new MiddlewareRunner([m3]).runBeforeToolCall(
        { toolArgs: {} } as never
      )
    ).toEqual({ action: "approve" });
  });
});

describe("runAfterToolResult", () => {
  it("transforms result", async () => {
    const m1: ChatMiddleware = {
      afterToolResult: vi
        .fn()
        .mockResolvedValue({ action: "continue", result: "redacted" }),
    };
    const out = await new MiddlewareRunner([m1]).runAfterToolResult(
      { result: "secret" } as never
    );
    expect(out).toEqual({ action: "continue", result: "redacted" });
  });

  it("ignores undefined override result", async () => {
    const m1: ChatMiddleware = {
      afterToolResult: vi
        .fn()
        .mockResolvedValue({ action: "continue", result: undefined }),
    };
    const out = await new MiddlewareRunner([m1]).runAfterToolResult(
      { result: "kept" } as never
    );
    expect(out).toEqual({ action: "continue", result: "kept" });
  });

  it("skip short-circuits", async () => {
    const m1: ChatMiddleware = {
      afterToolResult: vi.fn().mockResolvedValue({ action: "skip" }),
    };
    const m2: ChatMiddleware = { afterToolResult: vi.fn() };
    const out = await new MiddlewareRunner([m1, m2]).runAfterToolResult(
      { result: "x" } as never
    );
    expect(out).toEqual({ action: "skip" });
    expect(m2.afterToolResult).not.toHaveBeenCalled();
  });
});

describe("runBeforeDisplay", () => {
  it("replaces message", async () => {
    const m1: ChatMiddleware = {
      beforeDisplay: vi
        .fn()
        .mockResolvedValue({ action: "continue", message: { role: "user" } }),
    };
    const out = await new MiddlewareRunner([m1]).runBeforeDisplay(
      { message: { role: "assistant" } } as never
    );
    expect(out).toEqual({
      action: "continue",
      message: { role: "user" },
    });
  });

  it("skip suppresses display", async () => {
    const m1: ChatMiddleware = {
      beforeDisplay: vi.fn().mockResolvedValue({ action: "skip" }),
    };
    const out = await new MiddlewareRunner([m1]).runBeforeDisplay(
      { message: {} } as never
    );
    expect(out).toEqual({ action: "skip" });
  });
});

describe("runOnError", () => {
  it("uses first non-default action", async () => {
    const m1: ChatMiddleware = {
      onError: vi.fn().mockResolvedValue({ action: "default" }),
    };
    const m2: ChatMiddleware = {
      onError: vi.fn().mockResolvedValue({ action: "retry" }),
    };
    const m3: ChatMiddleware = { onError: vi.fn() };
    const out = await new MiddlewareRunner([m1, m2, m3]).runOnError(
      { error: new Error("e") } as never
    );
    expect(out).toEqual({ action: "retry" });
    expect(m3.onError).not.toHaveBeenCalled();
  });

  it("returns default when every middleware returns default", async () => {
    const m1: ChatMiddleware = {
      onError: vi.fn().mockResolvedValue({ action: "default" }),
    };
    expect(
      await new MiddlewareRunner([m1, {}]).runOnError(
        { error: new Error("e") } as never
      )
    ).toEqual({ action: "default" });
  });
});
