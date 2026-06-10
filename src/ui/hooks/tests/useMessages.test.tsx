// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { readToolCallMock, patchToolCallArgsMock, patchToolCallResultMock } =
  vi.hoisted(() => ({
    readToolCallMock: vi.fn(),
    patchToolCallArgsMock: vi.fn((m) => m),
    patchToolCallResultMock: vi.fn((m) => m),
  }));

vi.mock("../../../core/services/ai/tool-call", () => ({
  readToolCall: readToolCallMock,
  patchToolCallArgs: patchToolCallArgsMock,
  patchToolCallResult: patchToolCallResultMock,
}));

const stores = {
  messageState: {
    messages: [] as unknown[],
    isStreamRunning: false,
    setIsStreamRunning: vi.fn(),
    setIsRequestRunning: vi.fn(),
    setIsToolPending: vi.fn(),
    setAbortController: vi.fn(),
    addMessage: vi.fn(),
    updateLastMessage: vi.fn(),
    truncateMessagesAfter: vi.fn(),
    fetchPrevMessages: vi.fn().mockResolvedValue(undefined),
    claimThreadId: vi.fn(),
    _currentThreadId: "",
  },
  threadsState: {
    threadId: "",
    threads: [] as unknown[],
    insertThread: vi.fn().mockResolvedValue(undefined),
    insertNewMessageToThread: vi.fn().mockResolvedValue(undefined),
  },
  serversState: {
    setManageToolData: vi.fn(),
    tools: [] as unknown[],
    manageToolData: undefined as unknown,
    getTools: vi.fn().mockResolvedValue(undefined),
  },
  attachmentsState: {
    attachmentFiles: [] as unknown[],
    clearAttachmentFiles: vi.fn(),
    attachmentImages: [] as unknown[],
    clearAttachmentImages: vi.fn(),
  },
  profilesState: {
    extendedThinking: false,
    sessionChatProfile: null as unknown,
    chatProfile: null as unknown,
    defaultProfile: null as unknown,
  },
};

const callbacksManager = { emit: vi.fn() };
const middlewareRunner = {
  isEmpty: true,
  runBeforeSend: vi.fn(),
  runOnStreamChunk: vi.fn(),
  runBeforeToolCall: vi.fn(),
  runAfterToolResult: vi.fn(),
  runBeforeDisplay: vi.fn(),
  runOnError: vi.fn(),
};

const apiAi = {
  sendWithStream: vi.fn(),
  regenerateStream: vi.fn(),
  approveToolCall: vi.fn(),
  denyToolCall: vi.fn(),
};

const apiAttachments = {
  saveFile: vi.fn(),
  saveImage: vi.fn(),
  get: vi.fn(),
  getMany: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn().mockResolvedValue(undefined),
  linkToMessage: vi.fn(),
};

const servers = {
  getServerType: vi.fn((n: string) => `type_${n}`),
  callTools: vi.fn().mockResolvedValue("tool-result"),
};

vi.mock("../../store/context", () => ({
  useStores: () => ({
    useMessageStore: Object.assign(
      ((selector?: (s: typeof stores.messageState) => unknown) =>
        selector
          ? selector(stores.messageState)
          : stores.messageState) as never,
      { getState: () => stores.messageState }
    ),
    useThreadsStore: Object.assign(
      ((selector?: (s: typeof stores.threadsState) => unknown) =>
        selector
          ? selector(stores.threadsState)
          : stores.threadsState) as never,
      { getState: () => stores.threadsState }
    ),
    useServersStore: Object.assign(
      ((selector?: (s: typeof stores.serversState) => unknown) =>
        selector
          ? selector(stores.serversState)
          : stores.serversState) as never,
      { getState: () => stores.serversState }
    ),
    useAttachmentsStore: Object.assign(
      ((selector?: (s: typeof stores.attachmentsState) => unknown) =>
        selector
          ? selector(stores.attachmentsState)
          : stores.attachmentsState) as never,
      {
        setState: (
          patch:
            | Partial<typeof stores.attachmentsState>
            | ((
                s: typeof stores.attachmentsState
              ) => Partial<typeof stores.attachmentsState>)
        ) => {
          const next =
            typeof patch === "function"
              ? patch(stores.attachmentsState)
              : patch;
          Object.assign(stores.attachmentsState, next);
        },
        getState: () => stores.attachmentsState,
      }
    ),
    useProfilesStore: (
      selector?: (s: typeof stores.profilesState) => unknown
    ) => (selector ? selector(stores.profilesState) : stores.profilesState),
    api: { ai: apiAi, attachments: apiAttachments },
    callbacksManager,
    middlewareRunner,
    selectCurrentChatProfile: (s: typeof stores.profilesState) =>
      s.sessionChatProfile ?? s.chatProfile ?? s.defaultProfile,
  }),
}));

vi.mock("../../tools/context", () => ({
  useToolsContext: () => ({ servers }),
}));

import useMessages from "../useMessages";

const profile = { id: "p1", name: "P", providerType: "x" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  stores.messageState.messages = [];
  stores.messageState._currentThreadId = "";
  stores.threadsState.threadId = "";
  stores.threadsState.threads = [];
  stores.serversState.tools = [];
  stores.serversState.manageToolData = undefined;
  stores.attachmentsState.attachmentFiles = [];
  stores.attachmentsState.attachmentImages = [];
  stores.profilesState.sessionChatProfile = null;
  stores.profilesState.chatProfile = null;
  stores.profilesState.defaultProfile = null;
  stores.profilesState.extendedThinking = false;
  middlewareRunner.isEmpty = true;
  stores.messageState.isStreamRunning = false;
  apiAi.sendWithStream.mockReset();
  apiAi.regenerateStream.mockReset();
  apiAi.approveToolCall.mockReset();
  apiAi.denyToolCall.mockReset();
  readToolCallMock.mockReset();
});

async function* arr(items: unknown[]) {
  for (const i of items) yield i;
}

describe("useMessages.onNew", () => {
  it("no-ops when no current profile", async () => {
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    expect(apiAi.sendWithStream).not.toHaveBeenCalled();
  });

  it("no-ops when first content part is non-text", async () => {
    stores.profilesState.chatProfile = profile;
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "image", image: "x" }],
      } as never);
    });
    expect(apiAi.sendWithStream).not.toHaveBeenCalled();
  });

  it("sends user message and drains stream into addMessage / events", async () => {
    stores.profilesState.chatProfile = profile;
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "message-start",
          message: { role: "assistant", content: "hi" },
          messageId: "m1",
        },
        {
          type: "message-end",
          message: { role: "assistant", content: "ok" },
          messageId: "m1",
        },
      ])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hello" }],
      } as never);
    });
    expect(stores.messageState.addMessage).toHaveBeenCalled();
    expect(callbacksManager.emit).toHaveBeenCalledWith(
      "onMessageSent",
      expect.any(Object)
    );
    expect(callbacksManager.emit).toHaveBeenCalledWith(
      "onStreamStart",
      expect.any(Object)
    );
    expect(callbacksManager.emit).toHaveBeenCalledWith(
      "onStreamEnd",
      expect.any(Object)
    );
  });

  it("blocks send when middleware returns block", async () => {
    stores.profilesState.chatProfile = profile;
    middlewareRunner.isEmpty = false;
    middlewareRunner.runBeforeSend.mockResolvedValue({ action: "block" });
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hello" }],
      } as never);
    });
    expect(apiAi.sendWithStream).not.toHaveBeenCalled();
  });

  it("middleware overrides text on continue", async () => {
    stores.profilesState.chatProfile = profile;
    middlewareRunner.isEmpty = false;
    middlewareRunner.runBeforeSend.mockResolvedValue({
      action: "continue",
      text: "filtered",
    });
    apiAi.sendWithStream.mockReturnValue(arr([]));
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "raw" }],
      } as never);
    });
    const sent = (
      apiAi.sendWithStream.mock.calls[0][0] as {
        userMessage: { content: { type: string; text?: string }[] };
      }
    ).userMessage;
    expect(sent.content.find((c) => c.type === "text")?.text).toBe("filtered");
  });

  it("yields message-incomplete and emits onStreamError", async () => {
    stores.profilesState.chatProfile = profile;
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "message-incomplete",
          message: {
            role: "assistant",
            content: "",
            status: { type: "incomplete", reason: "error", error: "oops" },
          },
        },
      ])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hello" }],
      } as never);
    });
    expect(callbacksManager.emit).toHaveBeenCalledWith(
      "onStreamError",
      expect.objectContaining({
        error: expect.objectContaining({ reason: "error" }),
      })
    );
  });

  it("yields tool-call-pending and surfaces dialog data when not auto-allowed", async () => {
    stores.profilesState.chatProfile = profile;
    readToolCallMock.mockReturnValue({
      type: "tool-call",
      toolName: "search",
      args: {},
    });
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "tool-call-pending",
          message: { role: "assistant", content: [] },
          idx: 0,
          messageId: "m1",
          threadId: "t1",
          autoAllow: false,
        },
      ])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    expect(stores.serversState.setManageToolData).toHaveBeenCalledWith(
      expect.objectContaining({ idx: 0, threadId: "t1" })
    );
  });

  it("auto-allowed tool dispatches and resumes via approveToolCall", async () => {
    stores.profilesState.chatProfile = profile;
    readToolCallMock.mockReturnValue({
      type: "tool-call",
      toolName: "search",
      args: { q: 1 },
    });
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "tool-call-pending",
          message: { role: "assistant", content: [] },
          idx: 0,
          messageId: "m1",
          threadId: "t1",
          autoAllow: true,
        },
      ])
    );
    apiAi.approveToolCall.mockReturnValue(arr([]));
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    expect(servers.callTools).toHaveBeenCalledWith("type_search", "search", {
      q: 1,
    });
    expect(callbacksManager.emit).toHaveBeenCalledWith(
      "onToolCallResult",
      expect.any(Object)
    );
    expect(apiAi.approveToolCall).toHaveBeenCalled();
  });
});

describe("useMessages.approveToolCall / denyToolCall", () => {
  it("approveToolCall noops when no manageToolData", async () => {
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.approveToolCall(false);
    });
    expect(servers.callTools).not.toHaveBeenCalled();
  });

  it("approveToolCall dispatches and resumes", async () => {
    stores.serversState.manageToolData = {
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: { role: "assistant", content: [] },
    };
    readToolCallMock.mockReturnValue({
      type: "tool-call",
      toolName: "search",
      args: { q: 1 },
    });
    apiAi.approveToolCall.mockReturnValue(arr([]));
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.approveToolCall(true);
    });
    expect(servers.callTools).toHaveBeenCalled();
    expect(apiAi.approveToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ allowAlways: true })
    );
  });

  it("denyToolCall noops when no manageToolData", async () => {
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.denyToolCall();
    });
    expect(apiAi.denyToolCall).not.toHaveBeenCalled();
  });

  it("denyToolCall dispatches when there is manageToolData", async () => {
    stores.serversState.manageToolData = {
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: { role: "assistant", content: [] },
    };
    apiAi.denyToolCall.mockReturnValue(arr([]));
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.denyToolCall();
    });
    expect(apiAi.denyToolCall).toHaveBeenCalled();
  });

  it("denyToolCall updates the existing assistant message instead of re-adding it", async () => {
    stores.serversState.manageToolData = {
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: { role: "assistant", content: [] },
    };
    // The resume stream re-emits the SAME assistant message id. With
    // `hasAssistantPlaceholder: true` the runtime must update it in place,
    // never add a duplicate (which crashes assistant-ui's MessageRepository).
    apiAi.denyToolCall.mockReturnValue(
      arr([
        {
          type: "message-start",
          message: { role: "assistant", content: "ok" },
          messageId: "m1",
        },
        {
          type: "message-end",
          message: { role: "assistant", content: "ok" },
          messageId: "m1",
        },
      ])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.denyToolCall();
    });
    expect(stores.messageState.updateLastMessage).toHaveBeenCalled();
    expect(stores.messageState.addMessage).not.toHaveBeenCalled();
  });

  it("approveToolCall aborts when middleware afterToolResult returns skip", async () => {
    stores.serversState.manageToolData = {
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: { role: "assistant", content: [] },
    };
    readToolCallMock.mockReturnValue({
      type: "tool-call",
      toolName: "search",
      args: {},
    });
    middlewareRunner.isEmpty = false;
    middlewareRunner.runAfterToolResult.mockResolvedValue({ action: "skip" });
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.approveToolCall(false);
    });
    expect(apiAi.approveToolCall).not.toHaveBeenCalled();
    expect(stores.messageState.setIsStreamRunning).toHaveBeenCalledWith(false);
    expect(stores.messageState.setIsRequestRunning).toHaveBeenCalledWith(false);
  });

  it("approveToolCall replaces result when middleware returns continue", async () => {
    stores.serversState.manageToolData = {
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: { role: "assistant", content: [] },
    };
    readToolCallMock.mockReturnValue({
      type: "tool-call",
      toolName: "search",
      args: {},
    });
    middlewareRunner.isEmpty = false;
    middlewareRunner.runAfterToolResult.mockResolvedValue({
      action: "continue",
      result: "rewritten",
    });
    apiAi.approveToolCall.mockReturnValue(arr([]));
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.approveToolCall(false);
    });
    expect(apiAi.approveToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ result: "rewritten" })
    );
  });

  it("approveToolCall noops when readToolCall returns null", async () => {
    stores.serversState.manageToolData = {
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: { role: "assistant", content: [] },
    };
    readToolCallMock.mockReturnValue(null);
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.approveToolCall(false);
    });
    expect(servers.callTools).not.toHaveBeenCalled();
  });
});

describe("useMessages stream branches", () => {
  it("handles thread-title by claiming and inserting the thread", async () => {
    stores.profilesState.chatProfile = profile;
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "thread-title",
          threadId: "newT",
          title: "Generated",
          profileId: "p2",
        },
      ])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    expect(stores.messageState.claimThreadId).toHaveBeenCalledWith("newT");
    expect(stores.threadsState.insertThread).toHaveBeenCalledWith(
      "newT",
      "Generated",
      expect.objectContaining({ profileId: "p2" })
    );
  });

  it("falls back to current profile when thread-title omits profileId", async () => {
    stores.profilesState.chatProfile = profile;
    apiAi.sendWithStream.mockReturnValue(
      arr([{ type: "thread-title", threadId: "t", title: "T" }])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    expect(stores.threadsState.insertThread).toHaveBeenCalledWith(
      "t",
      "T",
      expect.objectContaining({ profileId: "p1" })
    );
  });

  it("calls insertNewMessageToThread when thread already exists", async () => {
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "tExist";
    stores.threadsState.threads = [{ threadId: "tExist" }] as never;
    apiAi.sendWithStream.mockReturnValue(arr([]));
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    expect(stores.threadsState.insertNewMessageToThread).toHaveBeenCalledWith({
      profileId: "p1",
    });
    expect(apiAi.sendWithStream).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: "tExist" })
    );
  });

  it("skips chunk when middleware runOnStreamChunk returns skip", async () => {
    stores.profilesState.chatProfile = profile;
    middlewareRunner.isEmpty = false;
    middlewareRunner.runOnStreamChunk.mockResolvedValue({ action: "skip" });
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "message-start",
          message: { role: "assistant", content: "x" },
          messageId: "m1",
        },
      ])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    // No assistant message lands because the only chunk was skipped.
    // The user message is added by the engine's `user-message-stored`
    // event, which this test does not emit — so addMessage is never
    // called.
    expect(stores.messageState.addMessage).not.toHaveBeenCalled();
    expect(callbacksManager.emit).not.toHaveBeenCalledWith(
      "onStreamStart",
      expect.any(Object)
    );
  });

  it("replaces chunk when middleware runOnStreamChunk returns continue with chunk", async () => {
    stores.profilesState.chatProfile = profile;
    middlewareRunner.isEmpty = false;
    middlewareRunner.runOnStreamChunk.mockResolvedValue({
      action: "continue",
      chunk: { role: "assistant", content: "rewritten" },
    });
    middlewareRunner.runBeforeDisplay.mockResolvedValue({ action: "continue" });
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "message-start",
          message: { role: "assistant", content: "raw" },
          messageId: "m1",
        },
      ])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    const calls = stores.messageState.addMessage.mock.calls;
    const assistantCall = calls[calls.length - 1][0] as {
      content: string;
    };
    expect(assistantCall.content).toBe("rewritten");
  });

  it("skips display when beforeDisplay middleware returns skip", async () => {
    stores.profilesState.chatProfile = profile;
    middlewareRunner.isEmpty = false;
    middlewareRunner.runOnStreamChunk.mockResolvedValue({ action: "continue" });
    middlewareRunner.runBeforeDisplay.mockResolvedValue({ action: "skip" });
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "message-start",
          message: { role: "assistant", content: "x" },
          messageId: "m1",
        },
      ])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    // No message goes through addMessage: the assistant message is
    // skipped by middleware, and the user message would land via the
    // engine's `user-message-stored` event which this test does not
    // emit.
    expect(stores.messageState.addMessage).not.toHaveBeenCalled();
  });

  it("rewrites display when beforeDisplay middleware returns continue with message", async () => {
    stores.profilesState.chatProfile = profile;
    middlewareRunner.isEmpty = false;
    middlewareRunner.runOnStreamChunk.mockResolvedValue({ action: "continue" });
    middlewareRunner.runBeforeDisplay.mockResolvedValue({
      action: "continue",
      message: { role: "assistant", content: "patched" },
    });
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "message-start",
          message: { role: "assistant", content: "raw" },
          messageId: "m1",
        },
      ])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    const calls = stores.messageState.addMessage.mock.calls;
    const assistantCall = calls[calls.length - 1][0] as { content: string };
    expect(assistantCall.content).toBe("patched");
  });

  it("middleware deny on tool-call-pending triggers denyToolCall and not callTools", async () => {
    stores.profilesState.chatProfile = profile;
    middlewareRunner.isEmpty = false;
    middlewareRunner.runBeforeToolCall.mockResolvedValue({ action: "deny" });
    readToolCallMock.mockReturnValue({
      type: "tool-call",
      toolName: "search",
      args: {},
    });
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "tool-call-pending",
          message: { role: "assistant", content: [] },
          idx: 0,
          messageId: "m1",
          threadId: "t1",
          autoAllow: false,
        },
      ])
    );
    apiAi.denyToolCall.mockReturnValue(arr([]));
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    expect(apiAi.denyToolCall).toHaveBeenCalled();
    expect(servers.callTools).not.toHaveBeenCalled();
  });

  it("middleware approve on tool-call-pending dispatches without dialog", async () => {
    stores.profilesState.chatProfile = profile;
    middlewareRunner.isEmpty = false;
    middlewareRunner.runBeforeToolCall.mockResolvedValue({ action: "approve" });
    readToolCallMock.mockReturnValue({
      type: "tool-call",
      toolName: "search",
      args: { q: 1 },
    });
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "tool-call-pending",
          message: { role: "assistant", content: [] },
          idx: 0,
          messageId: "m1",
          threadId: "t1",
          autoAllow: false,
        },
      ])
    );
    apiAi.approveToolCall.mockReturnValue(arr([]));
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    expect(servers.callTools).toHaveBeenCalled();
    expect(stores.serversState.setManageToolData).not.toHaveBeenCalledWith(
      expect.objectContaining({ idx: 0, threadId: "t1" })
    );
  });

  it("middleware continue with rewritten args patches the dialog message", async () => {
    stores.profilesState.chatProfile = profile;
    middlewareRunner.isEmpty = false;
    middlewareRunner.runBeforeToolCall.mockResolvedValue({
      action: "continue",
      args: { q: "patched" },
    });
    readToolCallMock.mockReturnValue({
      type: "tool-call",
      toolName: "search",
      args: { q: "raw" },
    });
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "tool-call-pending",
          message: { role: "assistant", content: [] },
          idx: 0,
          messageId: "m1",
          threadId: "t1",
          autoAllow: false,
        },
      ])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    expect(patchToolCallArgsMock).toHaveBeenCalled();
    expect(stores.serversState.setManageToolData).toHaveBeenCalled();
  });

  it("auto-allowed tool-call aborts when afterToolResult middleware returns skip", async () => {
    stores.profilesState.chatProfile = profile;
    middlewareRunner.isEmpty = false;
    middlewareRunner.runBeforeToolCall.mockResolvedValue({
      action: "continue",
    });
    middlewareRunner.runAfterToolResult.mockResolvedValue({ action: "skip" });
    readToolCallMock.mockReturnValue({
      type: "tool-call",
      toolName: "search",
      args: {},
    });
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "tool-call-pending",
          message: { role: "assistant", content: [] },
          idx: 0,
          messageId: "m1",
          threadId: "t1",
          autoAllow: true,
        },
      ])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    expect(apiAi.approveToolCall).not.toHaveBeenCalled();
  });

  it("emits onStreamError on terminal incomplete status", async () => {
    stores.profilesState.chatProfile = profile;
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "message-end",
          message: {
            role: "assistant",
            content: "x",
            status: { type: "incomplete", reason: "length", error: "trunc" },
          },
          messageId: "m1",
        },
      ])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hi" }],
      } as never);
    });
    expect(callbacksManager.emit).toHaveBeenCalledWith(
      "onStreamError",
      expect.objectContaining({
        error: expect.objectContaining({ reason: "length" }),
      })
    );
  });
});

describe("useMessages.regenerate", () => {
  it("no-ops when no current profile", async () => {
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.regenerate("u1");
    });
    expect(apiAi.regenerateStream).not.toHaveBeenCalled();
    expect(stores.messageState.truncateMessagesAfter).not.toHaveBeenCalled();
  });

  it("no-ops when there is no active threadId", async () => {
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "";
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.regenerate("u1");
    });
    expect(apiAi.regenerateStream).not.toHaveBeenCalled();
  });

  it("no-ops when stream is already running", async () => {
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "t1";
    stores.messageState.isStreamRunning = true;
    stores.messageState.messages = [
      { id: "u1", role: "user", content: [{ type: "text", text: "hi" }] },
    ];
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.regenerate("u1");
    });
    expect(apiAi.regenerateStream).not.toHaveBeenCalled();
  });

  it("no-ops when parent id is not a user message", async () => {
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "t1";
    stores.messageState.messages = [
      { id: "u1", role: "user", content: [{ type: "text", text: "hi" }] },
      { id: "a1", role: "assistant", content: [{ type: "text", text: "ok" }] },
    ];
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      // "a1" points to the assistant reply, not a user message
      await result.current.regenerate("a1");
    });
    expect(apiAi.regenerateStream).not.toHaveBeenCalled();
  });

  it("no-ops when parent id is not found", async () => {
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "t1";
    stores.messageState.messages = [
      { id: "u1", role: "user", content: [{ type: "text", text: "hi" }] },
    ];
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.regenerate("does-not-exist");
    });
    expect(apiAi.regenerateStream).not.toHaveBeenCalled();
    expect(stores.messageState.truncateMessagesAfter).not.toHaveBeenCalled();
  });

  it("truncates after parent and calls api.ai.regenerateStream", async () => {
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "t1";
    stores.messageState.messages = [
      { id: "u1", role: "user", content: [{ type: "text", text: "hi" }] },
      { id: "a1", role: "assistant", content: [{ type: "text", text: "old" }] },
    ];
    apiAi.regenerateStream.mockReturnValue(arr([]));

    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.regenerate("u1");
    });

    expect(stores.messageState.truncateMessagesAfter).toHaveBeenCalledWith(0);
    expect(apiAi.regenerateStream).toHaveBeenCalledTimes(1);
    const arg = apiAi.regenerateStream.mock.calls[0][0];
    expect(arg).toMatchObject({ threadId: "t1" });
    expect(arg.actionArgs).toBeDefined();
    expect(arg.actionArgs.signal).toBeInstanceOf(AbortSignal);
  });

  it("forwards extendedThinking, tools, and systemPrompt via actionArgs", async () => {
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "t1";
    stores.profilesState.extendedThinking = true;
    stores.serversState.tools = [{ name: "foo" }];
    stores.messageState.messages = [
      { id: "u1", role: "user", content: [{ type: "text", text: "hi" }] },
    ];
    apiAi.regenerateStream.mockReturnValue(arr([]));

    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.regenerate("u1");
    });

    const arg = apiAi.regenerateStream.mock.calls[0][0];
    expect(arg.actionArgs.isReasoning).toBe(true);
    expect(arg.actionArgs.tools).toEqual([{ name: "foo" }]);
  });
});
