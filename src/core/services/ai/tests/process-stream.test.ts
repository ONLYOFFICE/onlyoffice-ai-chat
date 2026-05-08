import { describe, expect, it, vi } from "vitest";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { SendMessageResult } from "../../../../shared/send-message-args";
import { processStream } from "../stream";
import type { StorageAdapter } from "../../../storage";

function makeStorage(opts?: { allowList?: string[] }) {
  let nextId = 0;
  const create = vi.fn(async (_threadId: string, message: ThreadMessageLike) => ({
    ...message,
    id: `m${++nextId}`,
  }));
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
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("emits message-incomplete and stops on incomplete final", async () => {
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
    // Errors are not persisted, but the payload still carries a stable
    // id so the UI runtime can track it.
    expect(create).not.toHaveBeenCalled();
    expect((events[0] as { message: { id?: string } }).message.id).toBeTruthy();
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
    // First delta updates `existing`; terminal updates again
    expect(update).toHaveBeenCalledTimes(2);
    expect(events.map((e) => e.type)).toEqual([
      "message-delta",
      "message-end",
    ]);
  });

  it("merges resumeBaseMessage content into deltas and final message", async () => {
    const { storage } = makeStorage();
    const base: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "tool-call", toolCallId: "c", toolName: "x", args: {} }],
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
});
