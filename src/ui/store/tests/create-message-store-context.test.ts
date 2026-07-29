import { describe, expect, it, vi } from "vitest";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { AppContext } from "../../../app-context";
import type { ServerAPI } from "../../providers/ApiProvider";
import { createMessageStore } from "../create-message-store";

function makeStore(fetched: ThreadMessageLike[]) {
  const api = {
    threads: { readMessages: vi.fn(async () => fetched) },
  } as unknown as ServerAPI;
  const ctx = { callbacksManager: { emit: vi.fn() } } as unknown as AppContext;
  return createMessageStore({ ctx, api });
}

const user = (text: string, contextEntityId?: string): ThreadMessageLike => ({
  role: "user",
  content: [{ type: "text", text }],
  ...(contextEntityId ? { metadata: { custom: { contextEntityId } } } : {}),
});

const assistant = (text: string): ThreadMessageLike => ({
  role: "assistant",
  content: [{ type: "text", text }],
});

describe("message store threadContextEntityId", () => {
  it("is unknown until messages are fetched", () => {
    const store = makeStore([]);
    expect(store.getState().threadContextEntityId).toBeUndefined();
  });

  it("derives the stamp from the last user message", async () => {
    const store = makeStore([
      user("hi", "agent-1"),
      assistant("hello"),
      user("more", "agent-2"),
      assistant("sure"),
    ]);
    await store.getState().fetchPrevMessages("t1");
    expect(store.getState().threadContextEntityId).toBe("agent-2");
  });

  it("an unstamped last user message means no context", async () => {
    const store = makeStore([
      user("hi", "agent-1"),
      assistant("hello"),
      user("back to normal"),
    ]);
    await store.getState().fetchPrevMessages("t1");
    expect(store.getState().threadContextEntityId).toBeNull();
  });

  it("a thread without user messages has no context", async () => {
    const store = makeStore([assistant("hello")]);
    await store.getState().fetchPrevMessages("t1");
    expect(store.getState().threadContextEntityId).toBeNull();
  });

  it("claimThreadId and clearMessages reset it to unknown", async () => {
    const store = makeStore([user("hi", "agent-1")]);
    await store.getState().fetchPrevMessages("t1");
    expect(store.getState().threadContextEntityId).toBe("agent-1");

    store.getState().claimThreadId("t2");
    expect(store.getState().threadContextEntityId).toBeUndefined();

    store.getState().clearMessages();
    expect(store.getState().threadContextEntityId).toBeUndefined();
  });
});
