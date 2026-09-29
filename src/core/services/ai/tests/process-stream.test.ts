import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { SendMessageResult } from "../../../../shared/send-message-args";
import {
  DEFAULT_PERSIST_INTERVAL_MS,
  MIN_PERSIST_INTERVAL_MS,
  processStream,
} from "../stream";
import type { StorageAdapter } from "../../../storage";

function makeStorage(opts?: { allowList?: string[] }) {
  let nextId = 0;
  const create = vi.fn(
    async (_threadId: string, message: ThreadMessageLike) => ({
      ...message,
      id: `m${++nextId}`,
    })
  );
  const update = vi.fn().mockResolvedValue(undefined);
  const readAllowAlways = vi.fn().mockResolvedValue(opts?.allowList ?? []);
  return {
    storage: {
      messages: { create, update },
      toolPrefs: { readAllowAlways },
    } as unknown as StorageAdapter,
    create,
    update,
    readAllowAlways,
  };
}

async function* feed(items: SendMessageResult[]) {
  for (const item of items) yield item;
}

describe("processStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits message-start, message-delta and message-end with persistence", async () => {
    const { storage, create, update } = makeStorage();
    const final: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "final" }],
    };
    const stream = feed([
      { role: "assistant", content: [{ type: "text", text: "" }] },
      { role: "assistant", content: [{ type: "text", text: "fi" }] },
      { isEnd: true, responseMessage: final },
    ]);
    const events = [];
    for await (const e of processStream(stream, { storage, threadId: "t" })) {
      events.push(e);
    }
    expect(events.map((e) => e.type)).toEqual([
      "message-start",
      "message-delta",
      "message-end",
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    // No timer tick fired during the synchronous feed, so the only update
    // is the terminal one.
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith("m1", final);
  });

  it("persists the error and emits message-incomplete on incomplete final", async () => {
    const { storage, create } = makeStorage();
    const incomplete = {
      role: "assistant",
      content: "",
      status: { type: "incomplete", reason: "error", error: "boom" },
    } as ThreadMessageLike;
    const stream = feed([{ isEnd: true, responseMessage: incomplete }]);
    const events = [];
    for await (const e of processStream(stream, { storage, threadId: "t" })) {
      events.push(e);
    }
    expect(events.map((e) => e.type)).toEqual(["message-incomplete"]);
    // With no prior delta the empty shell + status is persisted, and the
    // payload carries the storage-assigned id so the UI can track it.
    expect(create).toHaveBeenCalledWith(
      "t",
      expect.objectContaining({
        status: { type: "incomplete", reason: "error", error: "boom" },
      })
    );
    expect((events[0] as { message: { id?: string } }).message.id).toBe("m1");
  });

  it("preserves partial stream content when an error ends the stream", async () => {
    const { storage, update } = makeStorage();
    const stream = feed([
      { role: "assistant", content: [{ type: "text", text: "par" }] },
      { role: "assistant", content: [{ type: "text", text: "partial" }] },
      {
        isEnd: true,
        responseMessage: {
          role: "assistant",
          content: "",
          status: { type: "incomplete", reason: "error", error: "boom" },
        } as ThreadMessageLike,
      },
    ]);
    const events = [];
    for await (const e of processStream(stream, { storage, threadId: "t" })) {
      events.push(e);
    }
    // Terminal update keeps the accumulated partial text and attaches the
    // error status (no overwrite with the provider's empty shell).
    expect(update).toHaveBeenLastCalledWith(
      "m1",
      expect.objectContaining({
        content: [{ type: "text", text: "partial" }],
        status: { type: "incomplete", reason: "error", error: "boom" },
      })
    );
    const last = events[events.length - 1] as {
      type: string;
      message: ThreadMessageLike;
    };
    expect(last.type).toBe("message-incomplete");
    expect(last.message.content).toEqual([{ type: "text", text: "partial" }]);
  });

  it("emits tool-call-pending and persists when assistant has unresolved tool-call", async () => {
    const { storage, create } = makeStorage();
    const message: ThreadMessageLike = {
      role: "assistant",
      content: [
        { type: "text", text: "thinking" },
        { type: "tool-call", toolCallId: "c1", toolName: "search", args: {} },
      ],
    } as ThreadMessageLike;
    const stream = feed([{ isEnd: true, responseMessage: message }]);
    const events = [];
    for await (const e of processStream(stream, { storage, threadId: "t" })) {
      events.push(e);
    }
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "tool-call-pending",
      idx: 1,
      autoAllow: false,
      messageId: "m1",
    });
    expect(create).toHaveBeenCalled();
  });

  it("auto-allows tool-call when toolName is in allow list", async () => {
    const { storage } = makeStorage({ allowList: ["search"] });
    const message: ThreadMessageLike = {
      role: "assistant",
      content: [
        { type: "tool-call", toolCallId: "c1", toolName: "search", args: {} },
      ],
    } as ThreadMessageLike;
    const stream = feed([{ isEnd: true, responseMessage: message }]);
    let event;
    for await (const e of processStream(stream, { storage, threadId: "t" })) {
      event = e;
    }
    expect((event as { autoAllow: boolean }).autoAllow).toBe(true);
  });

  it("auto-allows an MCP tool pinned under its server's token (bug 84009)", async () => {
    // The dialog and the settings routes store `${serverType}_${toolName}`;
    // the model calls the tool by its bare name and the flat tool list
    // carries the group — the check must compose the same token.
    const { storage } = makeStorage({ allowList: ["calculator_get_time"] });
    const message: ThreadMessageLike = {
      role: "assistant",
      content: [
        { type: "tool-call", toolCallId: "c1", toolName: "get_time", args: {} },
      ],
    } as ThreadMessageLike;
    const stream = feed([{ isEnd: true, responseMessage: message }]);
    let event;
    for await (const e of processStream(stream, {
      storage,
      threadId: "t",
      tools: [
        {
          name: "get_time",
          description: "",
          inputSchema: {},
          serverType: "calculator",
        },
      ],
    })) {
      event = e;
    }
    expect((event as { autoAllow: boolean }).autoAllow).toBe(true);
  });

  it("does not let one server's pin auto-allow a same-named tool of another (bug 83161)", async () => {
    const { storage } = makeStorage({ allowList: ["calculator_get_time"] });
    const message: ThreadMessageLike = {
      role: "assistant",
      content: [
        { type: "tool-call", toolCallId: "c1", toolName: "get_time", args: {} },
      ],
    } as ThreadMessageLike;
    const stream = feed([{ isEnd: true, responseMessage: message }]);
    let event;
    for await (const e of processStream(stream, {
      storage,
      threadId: "t",
      tools: [
        {
          name: "get_time",
          description: "",
          inputSchema: {},
          serverType: "clock",
        },
      ],
    })) {
      event = e;
    }
    expect((event as { autoAllow: boolean }).autoAllow).toBe(false);
  });

  it("auto-allows tool-call when the tool opts in via requireApproval: false", async () => {
    const { storage } = makeStorage();
    const message: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "c1",
          toolName: "host_edit",
          args: {},
        },
      ],
    } as ThreadMessageLike;
    const stream = feed([{ isEnd: true, responseMessage: message }]);
    let event;
    for await (const e of processStream(stream, {
      storage,
      threadId: "t",
      tools: [
        {
          name: "host_edit",
          description: "",
          inputSchema: {},
          requireApproval: false,
        },
      ],
    })) {
      event = e;
    }
    expect((event as { autoAllow: boolean }).autoAllow).toBe(true);
  });

  it("keeps prompting when the tool sets requireApproval: true", async () => {
    const { storage } = makeStorage();
    const message: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "c1",
          toolName: "host_edit",
          args: {},
        },
      ],
    } as ThreadMessageLike;
    const stream = feed([{ isEnd: true, responseMessage: message }]);
    let event;
    for await (const e of processStream(stream, {
      storage,
      threadId: "t",
      tools: [
        {
          name: "host_edit",
          description: "",
          inputSchema: {},
          requireApproval: true,
        },
      ],
    })) {
      event = e;
    }
    expect((event as { autoAllow: boolean }).autoAllow).toBe(false);
  });

  it("keeps prompting for a tool that never sets requireApproval (MCP)", async () => {
    const { storage } = makeStorage();
    const message: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "c1",
          toolName: "mcp_query",
          args: {},
        },
      ],
    } as ThreadMessageLike;
    const stream = feed([{ isEnd: true, responseMessage: message }]);
    let event;
    for await (const e of processStream(stream, {
      storage,
      threadId: "t",
      tools: [{ name: "mcp_query", description: "", inputSchema: {} }],
    })) {
      event = e;
    }
    expect((event as { autoAllow: boolean }).autoAllow).toBe(false);
  });

  it("uses isResume + resumeMessageId to update existing message", async () => {
    const { storage, create, update } = makeStorage();
    const final: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "follow up" }],
    };
    const stream = feed([
      { role: "assistant", content: [{ type: "text", text: "follow" }] },
      { isEnd: true, responseMessage: final },
    ]);
    const events = [];
    for await (const e of processStream(stream, {
      storage,
      threadId: "t",
      isResume: true,
      resumeMessageId: "existing",
    })) {
      events.push(e);
    }
    expect(create).not.toHaveBeenCalled();
    // The resumed delta is only staged; the terminal write updates `existing`.
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith("existing", final);
    expect(events.map((e) => e.type)).toEqual(["message-delta", "message-end"]);
  });

  it("merges resumeBaseMessage content into deltas and final message", async () => {
    const { storage } = makeStorage();
    const base: ThreadMessageLike = {
      role: "assistant",
      content: [
        { type: "tool-call", toolCallId: "c", toolName: "x", args: {} },
      ],
    } as ThreadMessageLike;
    const stream = feed([
      { role: "assistant", content: [{ type: "text", text: "after" }] },
      {
        isEnd: true,
        responseMessage: {
          role: "assistant",
          content: [{ type: "text", text: "after-final" }],
        },
      },
    ]);
    const events = [];
    for await (const e of processStream(stream, {
      storage,
      threadId: "t",
      isResume: true,
      resumeMessageId: "existing",
      resumeBaseMessage: base,
    })) {
      events.push(e);
    }
    const last = events[events.length - 1] as {
      type: string;
      message: ThreadMessageLike;
    };
    expect(Array.isArray(last.message.content)).toBe(true);
    const content = last.message.content as unknown as { type: string }[];
    expect(content[0].type).toBe("tool-call");
    expect(content[content.length - 1]).toMatchObject({ type: "text" });
  });

  describe("periodic persistence", () => {
    // A stream that hands out deltas on demand so the test controls the
    // timer between them.
    function gate() {
      const queue: SendMessageResult[] = [];
      let wake: (() => void) | null = null;
      let closed = false;
      const push = (item: SendMessageResult) => {
        queue.push(item);
        wake?.();
      };
      const close = () => {
        closed = true;
        wake?.();
      };
      async function* stream(): AsyncGenerator<SendMessageResult> {
        for (;;) {
          if (queue.length) {
            yield queue.shift() as SendMessageResult;
            continue;
          }
          if (closed) return;
          await new Promise<void>((r) => {
            wake = r;
          });
          wake = null;
        }
      }
      return { push, close, stream: stream() };
    }

    const delta = (text: string): SendMessageResult => ({
      role: "assistant",
      content: [{ type: "text", text }],
    });
    const end = (text: string): SendMessageResult => ({
      isEnd: true,
      responseMessage: { role: "assistant", content: [{ type: "text", text }] },
    });

    async function drive(
      events: unknown[],
      gen: AsyncGenerator<unknown>,
      count: number
    ) {
      for (let i = 0; i < count; i++) {
        const next = await gen.next();
        if (next.done) return;
        events.push(next.value);
      }
    }

    it("does not write on deltas until the interval elapses", async () => {
      const { storage, update } = makeStorage();
      const g = gate();
      const gen = processStream(g.stream, {
        storage,
        threadId: "t",
        persistIntervalMs: 1000,
      });
      const events: unknown[] = [];
      g.push(delta("a"));
      g.push(delta("ab"));
      g.push(delta("abc"));
      await drive(events, gen, 3);
      expect(update).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(999);
      expect(update).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenLastCalledWith(
        "m1",
        expect.objectContaining({ content: [{ type: "text", text: "abc" }] })
      );

      g.push(end("abcd"));
      await drive(events, gen, 1);
      expect(update).toHaveBeenCalledTimes(2);
      expect(update).toHaveBeenLastCalledWith(
        "m1",
        expect.objectContaining({ content: [{ type: "text", text: "abcd" }] })
      );
    });

    it("skips a tick when nothing changed since the last write", async () => {
      const { storage, update } = makeStorage();
      const g = gate();
      const gen = processStream(g.stream, {
        storage,
        threadId: "t",
        persistIntervalMs: 1000,
      });
      g.push(delta("a"));
      g.push(delta("ab"));
      await drive([], gen, 2);
      await vi.advanceTimersByTimeAsync(1000);
      expect(update).toHaveBeenCalledTimes(1);
      // Two more ticks with no new delta: still one write.
      await vi.advanceTimersByTimeAsync(2000);
      expect(update).toHaveBeenCalledTimes(1);
      g.push(end("ab"));
      await drive([], gen, 1);
    });

    it("never overlaps writes and settles the in-flight one before the final write", async () => {
      const { storage, update } = makeStorage();
      let release: (() => void) | null = null;
      update.mockImplementationOnce(
        () =>
          new Promise<void>((r) => {
            release = r;
          })
      );
      const g = gate();
      const gen = processStream(g.stream, {
        storage,
        threadId: "t",
        persistIntervalMs: 1000,
      });
      g.push(delta("a"));
      g.push(delta("ab"));
      await drive([], gen, 2);
      await vi.advanceTimersByTimeAsync(1000);
      expect(update).toHaveBeenCalledTimes(1);

      // New content arrives while the write hangs; the next ticks are skipped.
      g.push(delta("abc"));
      await drive([], gen, 1);
      await vi.advanceTimersByTimeAsync(3000);
      expect(update).toHaveBeenCalledTimes(1);

      // The terminal write waits for the hung one.
      g.push(end("abcd"));
      const finalStep = gen.next();
      await vi.advanceTimersByTimeAsync(0);
      expect(update).toHaveBeenCalledTimes(1);
      (release as unknown as () => void)();
      const next = await finalStep;
      expect((next.value as { type: string }).type).toBe("message-end");
      expect(update).toHaveBeenCalledTimes(2);
      expect(update).toHaveBeenLastCalledWith(
        "m1",
        expect.objectContaining({ content: [{ type: "text", text: "abcd" }] })
      );
    });

    it("survives a failed periodic write and retries via the terminal write", async () => {
      const { storage, update } = makeStorage();
      update.mockRejectedValueOnce(new Error("db down"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const g = gate();
      const gen = processStream(g.stream, {
        storage,
        threadId: "t",
        persistIntervalMs: 1000,
      });
      g.push(delta("a"));
      g.push(delta("ab"));
      await drive([], gen, 2);
      await vi.advanceTimersByTimeAsync(1000);
      expect(update).toHaveBeenCalledTimes(1);
      // Content is marked dirty again, so the next tick retries.
      await vi.advanceTimersByTimeAsync(1000);
      expect(update).toHaveBeenCalledTimes(2);
      g.push(end("ab"));
      const events: unknown[] = [];
      await drive(events, gen, 1);
      expect((events[0] as { type: string }).type).toBe("message-end");
      expect(update).toHaveBeenCalledTimes(3);
      warn.mockRestore();
    });

    it("salvages the staged snapshot and stops the timer when the consumer stops iterating", async () => {
      const { storage, update } = makeStorage();
      const g = gate();
      const gen = processStream(g.stream, {
        storage,
        threadId: "t",
        persistIntervalMs: 1000,
      });
      g.push(delta("a"));
      g.push(delta("ab"));
      await drive([], gen, 2);
      await gen.return(undefined);
      // The text already shown is written once on the way out ...
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenLastCalledWith(
        "m1",
        expect.objectContaining({ content: [{ type: "text", text: "ab" }] })
      );
      // ... and the timer is gone.
      await vi.advanceTimersByTimeAsync(10_000);
      expect(update).toHaveBeenCalledTimes(1);
    });

    it("does not write on the way out when nothing is staged", async () => {
      const { storage, update } = makeStorage();
      const g = gate();
      const gen = processStream(g.stream, {
        storage,
        threadId: "t",
        persistIntervalMs: 1000,
      });
      g.push(delta("a"));
      await drive([], gen, 1);
      await gen.return(undefined);
      expect(update).not.toHaveBeenCalled();
    });

    it("salvages the staged snapshot when the provider throws, keeping the error", async () => {
      const { storage, update } = makeStorage();
      async function* boom(): AsyncGenerator<SendMessageResult> {
        yield delta("a");
        yield delta("ab");
        throw new Error("provider down");
      }
      const gen = processStream(boom(), {
        storage,
        threadId: "t",
        persistIntervalMs: 1000,
      });
      await drive([], gen, 2);
      await expect(gen.next()).rejects.toThrow("provider down");
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenLastCalledWith(
        "m1",
        expect.objectContaining({ content: [{ type: "text", text: "ab" }] })
      );
    });

    it("a failing salvage write does not mask the stream error", async () => {
      const { storage, update } = makeStorage();
      update.mockRejectedValueOnce(new Error("db down"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      async function* boom(): AsyncGenerator<SendMessageResult> {
        yield delta("a");
        yield delta("ab");
        throw new Error("provider down");
      }
      const gen = processStream(boom(), {
        storage,
        threadId: "t",
        persistIntervalMs: 1000,
      });
      await drive([], gen, 2);
      await expect(gen.next()).rejects.toThrow("provider down");
      expect(update).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it("clamps a tiny interval to the lower bound", async () => {
      const { storage, update } = makeStorage();
      const g = gate();
      const gen = processStream(g.stream, {
        storage,
        threadId: "t",
        persistIntervalMs: 1,
      });
      g.push(delta("a"));
      g.push(delta("ab"));
      await drive([], gen, 2);
      await vi.advanceTimersByTimeAsync(MIN_PERSIST_INTERVAL_MS - 1);
      expect(update).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(update).toHaveBeenCalledTimes(1);
      g.push(end("ab"));
      await drive([], gen, 1);
    });

    it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
      "falls back to the default interval for %p",
      async (value) => {
        const { storage, update } = makeStorage();
        const g = gate();
        const gen = processStream(g.stream, {
          storage,
          threadId: "t",
          persistIntervalMs: value,
        });
        g.push(delta("a"));
        g.push(delta("ab"));
        await drive([], gen, 2);
        await vi.advanceTimersByTimeAsync(DEFAULT_PERSIST_INTERVAL_MS - 1);
        expect(update).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(update).toHaveBeenCalledTimes(1);
        g.push(end("ab"));
        await drive([], gen, 1);
      }
    );

    it("salvages the last delta when the stream ends without isEnd", async () => {
      const { storage, update } = makeStorage();
      const g = gate();
      const gen = processStream(g.stream, {
        storage,
        threadId: "t",
        persistIntervalMs: 1000,
      });
      g.push(delta("a"));
      g.push(delta("ab"));
      await drive([], gen, 2);
      g.close();
      await gen.next();
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenLastCalledWith(
        "m1",
        expect.objectContaining({ content: [{ type: "text", text: "ab" }] })
      );
    });

    it("uses the default interval when none is configured", async () => {
      const { storage, update } = makeStorage();
      const g = gate();
      const gen = processStream(g.stream, { storage, threadId: "t" });
      g.push(delta("a"));
      g.push(delta("ab"));
      await drive([], gen, 2);
      await vi.advanceTimersByTimeAsync(DEFAULT_PERSIST_INTERVAL_MS - 1);
      expect(update).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(update).toHaveBeenCalledTimes(1);
      g.push(end("ab"));
      await drive([], gen, 1);
    });
  });
});
