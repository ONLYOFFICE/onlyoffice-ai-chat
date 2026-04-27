import type { ThreadMessageLike } from "@assistant-ui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SendMessageResult } from "../../../../shared/send-message-args";
import type { StorageAdapter } from "../../../storage";
import { persistTerminal } from "../stream";

function makeStorage() {
  const create = vi.fn(async () => undefined);
  const storage = {
    messages: { create },
  } as unknown as StorageAdapter;
  return { storage, create };
}

beforeEach(() => {
  vi.spyOn(crypto, "randomUUID").mockReturnValue(
    "00000000-0000-0000-0000-000000000001"
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("persistTerminal", () => {
  it("does nothing for non-terminal events", async () => {
    const { storage, create } = makeStorage();
    const result: SendMessageResult = {
      role: "assistant",
      content: [{ type: "text", text: "delta" }],
    };
    await persistTerminal(storage, "t1", result);
    expect(create).not.toHaveBeenCalled();
  });

  it("does nothing for messages with status.reason === 'error'", async () => {
    const { storage, create } = makeStorage();
    const responseMessage = {
      role: "assistant",
      content: [{ type: "text", text: "" }],
      status: { reason: "error" },
    } as unknown as ThreadMessageLike;
    await persistTerminal(storage, "t1", { isEnd: true, responseMessage });
    expect(create).not.toHaveBeenCalled();
  });

  it("persists the assistant message on terminal events", async () => {
    const { storage, create } = makeStorage();
    const responseMessage: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "ok" }],
    };
    await persistTerminal(storage, "t1", { isEnd: true, responseMessage });
    expect(create).toHaveBeenCalledWith("t1", responseMessage);
  });

  it("persists when status.reason exists but is not 'error'", async () => {
    const { storage, create } = makeStorage();
    const responseMessage = {
      role: "assistant",
      content: [{ type: "text", text: "ok" }],
      status: { reason: "cancelled" },
    } as unknown as ThreadMessageLike;
    await persistTerminal(storage, "t1", { isEnd: true, responseMessage });
    expect(create).toHaveBeenCalled();
  });
});
