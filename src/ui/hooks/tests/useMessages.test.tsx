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
  cloudsState: {
    selectedContextFolder: null as {
      cloud: string;
      room: { id: string; name: string };
    } | null,
    roomSkills: [] as { id: string; name: string; description: string }[],
    disabledSkillIds: [] as string[],
  },
  messageState: {
    messages: [] as unknown[],
    isStreamRunning: false,
    hasMoreOlderMessages: false,
    _abortController: undefined as AbortController | undefined,
    setIsStreamRunning: vi.fn(),
    setIsRequestRunning: vi.fn(),
    setIsToolPending: vi.fn(),
    setAbortController: vi.fn((controller?: AbortController) => {
      stores.messageState._abortController = controller;
    }),
    addMessage: vi.fn(),
    reconcileMessage: vi.fn(),
    updateLastMessage: vi.fn(),
    truncateMessagesAfter: vi.fn(),
    fetchPrevMessages: vi.fn().mockResolvedValue(undefined),
    claimThreadId: vi.fn(),
    _currentThreadId: "" as string | null,
    _streamEpoch: 0,
  },
  threadsState: {
    threadId: "",
    threads: [] as unknown[],
    insertThread: vi.fn().mockResolvedValue(undefined),
    insertNewMessageToThread: vi.fn().mockResolvedValue(undefined),
  },
  serversState: {
    setManageToolData: vi.fn(),
    setIsApprovingTool: vi.fn(),
    tools: [] as unknown[],
    manageToolData: undefined as unknown,
    getTools: vi.fn().mockResolvedValue(undefined),
    // The send / regenerate paths read the round's tools from here, not
    // from the `tools` snapshot — mirror it so both stay in step.
    getUserTools: vi.fn(async () => stores.serversState.tools),
    toolInstructions: {} as Record<string, string>,
    getToolInstructions: vi.fn(() => stores.serversState.toolInstructions),
  },
  attachmentsState: {
    attachmentFiles: [] as unknown[],
    clearAttachmentFiles: vi.fn(),
    attachmentImages: [] as unknown[],
    clearAttachmentImages: vi.fn(),
  },
  profilesState: {
    extendedThinking: false,
    reasoningLevel: "off",
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
  toBareName: vi.fn((type: string, n: string) => n.replace(`${type}_`, "")),
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
    useCloudsStore: (selector?: (s: typeof stores.cloudsState) => unknown) =>
      selector ? selector(stores.cloudsState) : stores.cloudsState,
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

const { widgetConfig } = vi.hoisted(() => ({
  widgetConfig: {} as Record<string, unknown>,
}));
vi.mock("../../../widget-config", () => ({
  useWidgetConfig: () => widgetConfig,
}));

import useMessages from "../useMessages";

const profile = { id: "p1", name: "P", providerType: "x" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  stores.messageState.messages = [];
  stores.messageState.hasMoreOlderMessages = false;
  stores.messageState._currentThreadId = "";
  stores.cloudsState.selectedContextFolder = null;
  stores.cloudsState.roomSkills = [];
  stores.cloudsState.disabledSkillIds = [];
  stores.messageState._abortController = undefined;
  stores.threadsState.threadId = "";
  stores.threadsState.threads = [];
  stores.serversState.tools = [];
  stores.serversState.manageToolData = undefined;
  for (const key of Object.keys(widgetConfig)) delete widgetConfig[key];
  stores.attachmentsState.attachmentFiles = [];
  stores.attachmentsState.attachmentImages = [];
  stores.profilesState.sessionChatProfile = null;
  stores.profilesState.chatProfile = null;
  stores.profilesState.defaultProfile = null;
  stores.profilesState.extendedThinking = false;
  stores.profilesState.reasoningLevel = "off";
  middlewareRunner.isEmpty = true;
  stores.messageState.isStreamRunning = false;
  stores.messageState._streamEpoch = 0;
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

  it("sends an attachment-only message when content is empty (no text block)", async () => {
    stores.profilesState.chatProfile = profile;
    stores.attachmentsState.attachmentFiles = [
      { id: "f1", title: "doc.pdf", path: "/doc.pdf", type: 1 },
    ];
    apiAi.sendWithStream.mockReturnValue(arr([]));
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      // assistant-ui emits `content: []` (no text block at all) when the
      // composer text is empty, e.g. a file-only send.
      await result.current.onNew({ content: [] } as never);
    });
    expect(apiAi.sendWithStream).toHaveBeenCalled();
    const optimistic = stores.messageState.addMessage.mock.calls[0][0] as {
      content: { type: string; text?: string }[];
    };
    const textBlock = optimistic.content.find((c) => c.type === "text");
    expect(textBlock?.text).toBe("");
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

  it("sends the connected room along with the user message", async () => {
    stores.cloudsState.selectedContextFolder = {
      cloud: "nct2.onlyoffice.com",
      room: { id: "r1", name: "Vacations" },
    };
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
    expect(
      apiAi.sendWithStream.mock.calls[0][0].actionArgs.contextRoom
    ).toEqual({ cloud: "nct2.onlyoffice.com", id: "r1", skills: [] });
    expect(
      apiAi.sendWithStream.mock.calls[0][0].contextEntityId
    ).toBeUndefined();
  });

  it("renders the user message optimistically before the stream yields", async () => {
    stores.profilesState.chatProfile = profile;
    // Empty stream: nothing comes back from the engine at all. The user
    // bubble must still appear — proving it's added by `onNew`, not gated
    // behind a `user-message-stored` event or the tool refresh.
    apiAi.sendWithStream.mockReturnValue(arr([]));
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hello" }],
      } as never);
    });
    const calls = stores.messageState.addMessage.mock.calls;
    expect(calls).toHaveLength(1);
    const optimistic = calls[0][0] as { role: string; id: string };
    expect(optimistic.role).toBe("user");
    expect(optimistic.id).toBeTruthy();
    // Never a second append; reconciliation happens in place.
    expect(stores.messageState.reconcileMessage).not.toHaveBeenCalled();
  });

  it("reconciles the optimistic user message in place, keeping the client id", async () => {
    stores.profilesState.chatProfile = profile;
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "user-message-stored",
          message: {
            role: "user",
            id: "server-generated-id",
            content: [{ type: "text", text: "hello" }],
          },
          messageId: "server-generated-id",
        },
      ])
    );
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hello" }],
      } as never);
    });
    // The stored event reconciles in place — no second append.
    expect(stores.messageState.addMessage).toHaveBeenCalledTimes(1);
    const optimisticId = (
      stores.messageState.addMessage.mock.calls[0][0] as { id: string }
    ).id;
    const reconcileCalls = stores.messageState.reconcileMessage.mock.calls;
    expect(reconcileCalls).toHaveLength(1);
    const [targetId, reconciled] = reconcileCalls[0] as [
      string,
      { id: string },
    ];
    // Targets the optimistic message and forces the client id back on,
    // discarding the storage-assigned id — so assistant-ui never sees an
    // id change (which would fork a phantom branch). This is what keeps
    // the flow identical for a remote core that assigns its own ids.
    expect(targetId).toBe(optimisticId);
    expect(reconciled.id).toBe(optimisticId);
    expect(reconciled.id).not.toBe("server-generated-id");
  });

  it("stops consuming events after abort and finalizes the message as cancelled", async () => {
    stores.profilesState.chatProfile = profile;
    async function* stream() {
      yield {
        type: "message-start",
        message: { role: "assistant", content: "partial" },
        messageId: "m1",
      };
      // Simulate the user pressing Stop between events — abort the
      // controller armed by onNew and clear it like stopMessage() does.
      stores.messageState._abortController?.abort();
      stores.messageState._abortController = undefined;
      yield {
        type: "message-delta",
        message: { role: "assistant", content: "partial more" },
        messageId: "m1",
      };
      yield {
        type: "message-end",
        message: { role: "assistant", content: "full" },
        messageId: "m1",
      };
    }
    apiAi.sendWithStream.mockReturnValue(stream());
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hello" }],
      } as never);
    });
    // The start chunk rendered; everything after the abort was dropped.
    expect(stores.messageState.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: "partial" })
    );
    const rendered = [
      ...stores.messageState.addMessage.mock.calls,
      ...stores.messageState.updateLastMessage.mock.calls,
    ].map(([m]) => (m as { content?: unknown }).content);
    expect(rendered).not.toContain("partial more");
    expect(rendered).not.toContain("full");
    // The partial message is finalized as user-cancelled, not an error.
    expect(stores.messageState.updateLastMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "partial",
        status: { type: "incomplete", reason: "cancelled" },
      })
    );
    expect(callbacksManager.emit).not.toHaveBeenCalledWith(
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

  it("carries the structured error code on onStreamError", async () => {
    stores.profilesState.chatProfile = profile;
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "message-incomplete",
          message: {
            role: "assistant",
            content: "",
            status: {
              type: "incomplete",
              reason: "error",
              error: {
                code: "insufficient_funds",
                message: "402 — insufficient funds",
              },
            },
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
        error: {
          reason: "error",
          message: "402 — insufficient funds",
          code: "insufficient_funds",
        },
      })
    );
  });

  it("omits the code when the errored status carries an un-normalized payload", async () => {
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
        error: { reason: "error", message: "oops", code: undefined },
      })
    );
  });

  it("classifies a bare stream error envelope by its message text", async () => {
    stores.profilesState.chatProfile = profile;
    apiAi.sendWithStream.mockReturnValue(
      arr([
        {
          type: "error",
          message: "402 — insufficient funds to complete this request",
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
        error: expect.objectContaining({
          reason: "error",
          code: "insufficient_funds",
        }),
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
    // Stream is running while the tool executes; the resume is gated on it.
    stores.messageState.isStreamRunning = true;
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

  it("onToolCallApproveResult: keeps the dialog open, fires the callback with the result, then closes before resuming", async () => {
    const order: string[] = [];
    const onResult = vi.fn(async (result: unknown) => {
      order.push(`callback:${String(result)}`);
    });
    widgetConfig.onToolCallApproveResult = onResult;
    (stores.serversState.setIsApprovingTool as ReturnType<typeof vi.fn>) =
      vi.fn(() => order.push("approving"));
    (stores.serversState.setManageToolData as ReturnType<typeof vi.fn>) = vi.fn(
      (data) => order.push(data === undefined ? "close" : "open")
    );

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
      await result.current.approveToolCall(false);
    });

    // The dialog is NOT dismissed up front; the callback receives the tool
    // result and only afterwards is the dialog closed and the stream resumed.
    expect(onResult).toHaveBeenCalledWith("tool-result", {
      toolName: "search",
      toolArgs: { q: 1 },
      callId: undefined,
      threadId: "t1",
    });
    expect(order.indexOf("callback:tool-result")).toBeLessThan(
      order.indexOf("close")
    );
    // Pending state was entered (dialog stayed open) before the close.
    expect(order.indexOf("approving")).toBeLessThan(order.indexOf("close"));
    expect(apiAi.approveToolCall).toHaveBeenCalled();
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

  it("server-executed approve resumes with the selected profileId and skips local dispatch", async () => {
    // Regression: the server-executed (MCP/system) branch used to omit
    // `profileId`, so the server fell back to the default-model assignment and
    // the user's model choice was silently lost after approving the tool.
    stores.profilesState.chatProfile = profile; // id "p1"
    stores.serversState.manageToolData = {
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: { role: "assistant", content: [] },
      serverExecuted: true,
    };
    readToolCallMock.mockReturnValue({
      type: "tool-call",
      toolName: "sys_search",
      args: { q: 1 },
    });
    apiAi.approveToolCall.mockReturnValue(arr([]));
    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.approveToolCall(true);
    });
    // Server-executed tools are never dispatched locally — the engine runs them.
    expect(servers.callTools).not.toHaveBeenCalled();
    expect(apiAi.approveToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "p1", allowAlways: true })
    );
  });

  it("client-executed approve resumes with the selected profileId", async () => {
    stores.profilesState.chatProfile = profile; // id "p1"
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
      await result.current.approveToolCall(false);
    });
    expect(apiAi.approveToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "p1" })
    );
  });

  it("denyToolCall resumes with the selected profileId", async () => {
    stores.profilesState.chatProfile = profile; // id "p1"
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
    expect(apiAi.denyToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "p1" })
    );
  });

  it("approveToolCall resumes even when isStreamRunning is false", async () => {
    // Manual approval happens after the first stream paused on the tool
    // call and already ended (isStreamRunning=false). Approve must still
    // resume — otherwise the tool result is never persisted and later
    // requests fail with "No tool output found for function call".
    stores.messageState.isStreamRunning = false;
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
    expect(apiAi.approveToolCall).toHaveBeenCalled();
  });

  it("approveToolCall arms a fresh abort controller and passes its signal", async () => {
    // Dialog approval runs after the original stream ended and cleared its
    // controller — the continuation must arm a new one so Stop can abort it.
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
      await result.current.approveToolCall(false);
    });
    expect(stores.messageState.setAbortController).toHaveBeenCalledWith(
      expect.any(AbortController)
    );
    const input = apiAi.approveToolCall.mock.calls[0][0] as {
      actionArgs: { signal?: unknown };
    };
    expect(input.actionArgs.signal).toBeInstanceOf(AbortSignal);
    expect((input.actionArgs.signal as AbortSignal).aborted).toBe(false);
  });

  it("denyToolCall arms a fresh abort controller and passes its signal", async () => {
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
    expect(stores.messageState.setAbortController).toHaveBeenCalledWith(
      expect.any(AbortController)
    );
    const input = apiAi.denyToolCall.mock.calls[0][0] as {
      actionArgs: { signal?: unknown };
    };
    expect(input.actionArgs.signal).toBeInstanceOf(AbortSignal);
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
    // The user message is added optimistically in `onNew`. The only
    // assistant chunk was skipped by middleware, so no assistant message
    // lands — `addMessage` fires exactly once, for the user turn.
    const chunkCalls = stores.messageState.addMessage.mock.calls;
    expect(chunkCalls).toHaveLength(1);
    expect((chunkCalls[0][0] as { role: string }).role).toBe("user");
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
    // The user message is added optimistically in `onNew`; the assistant
    // message is skipped by `beforeDisplay`. So `addMessage` fires exactly
    // once, for the user turn only.
    const displayCalls = stores.messageState.addMessage.mock.calls;
    expect(displayCalls).toHaveLength(1);
    expect((displayCalls[0][0] as { role: string }).role).toBe("user");
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

  it("retrying an errored turn drops the failed reply and appends nothing", async () => {
    // What the error box's Retry button does: the failed assistant turn is
    // truncated away and the round replays from the stored user message, so
    // no second copy of it is sent.
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "t1";
    stores.messageState.messages = [
      { id: "u1", role: "user", content: [{ type: "text", text: "hi" }] },
      {
        id: "a1",
        role: "assistant",
        content: [],
        status: {
          type: "incomplete",
          reason: "error",
          error: { code: "network", message: "fetch failed" },
        },
      },
    ];
    apiAi.regenerateStream.mockReturnValue(arr([]));

    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.regenerate("u1");
    });

    // Index 0 keeps the user message and discards the errored reply.
    expect(stores.messageState.truncateMessagesAfter).toHaveBeenCalledWith(0);
    expect(apiAi.regenerateStream).toHaveBeenCalledTimes(1);
    // The composer path is what appends; retry must not go through it.
    expect(apiAi.sendWithStream).not.toHaveBeenCalled();
    expect(stores.messageState.addMessage).not.toHaveBeenCalled();
  });

  it("names the turn to re-roll so an older reply does not re-roll the newest", async () => {
    // Two complete rounds. Regenerating the FIRST one must tell the
    // engine which turn it is: the engine otherwise re-reads storage and
    // falls back to the last user message, re-rolling the wrong reply.
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "t1";
    stores.messageState.messages = [
      { id: "u1", role: "user", content: [{ type: "text", text: "one" }] },
      { id: "a1", role: "assistant", content: [{ type: "text", text: "r1" }] },
      { id: "u2", role: "user", content: [{ type: "text", text: "two" }] },
      { id: "a2", role: "assistant", content: [{ type: "text", text: "r2" }] },
    ];
    apiAi.regenerateStream.mockReturnValue(arr([]));

    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.regenerate("u1");
    });

    expect(stores.messageState.truncateMessagesAfter).toHaveBeenCalledWith(0);
    const arg = apiAi.regenerateStream.mock.calls[0][0];
    expect(arg.messageId).toBe("u1");
    // Positional fallback for ids storage never saw (optimistic sends).
    expect(arg.keepCount).toBe(1);
    // The pre-truncation thread length that count was derived from, so
    // the engine can reject the index if storage has since moved on.
    expect(arg.expectedLength).toBe(4);
  });

  it("omits keepCount while older pages are unloaded", async () => {
    // With a partial window the store index is not the thread index, so
    // the count would point at the wrong turn — only the id is sound.
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "t1";
    stores.messageState.hasMoreOlderMessages = true;
    stores.messageState.messages = [
      { id: "u1", role: "user", content: [{ type: "text", text: "hi" }] },
      { id: "a1", role: "assistant", content: [{ type: "text", text: "old" }] },
    ];
    apiAi.regenerateStream.mockReturnValue(arr([]));

    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.regenerate("u1");
    });

    const arg = apiAi.regenerateStream.mock.calls[0][0];
    expect(arg.messageId).toBe("u1");
    expect(arg.keepCount).toBeUndefined();
    expect(arg.expectedLength).toBeUndefined();
  });

  it("forwards extendedThinking, tools, and systemPrompt via actionArgs", async () => {
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "t1";
    stores.profilesState.extendedThinking = true;
    stores.profilesState.reasoningLevel = "high";
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
    expect(arg.actionArgs.reasoningLevel).toBe("high");
    expect(arg.actionArgs.tools).toEqual([{ name: "foo" }]);
    // No room connected: the field is absent, not an empty object.
    expect(arg.actionArgs.contextRoom).toBeUndefined();
  });

  it("names the connected room and ships its enabled skills in actionArgs", async () => {
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "t1";
    stores.cloudsState.selectedContextFolder = {
      cloud: "nct2.onlyoffice.com",
      room: { id: "r1", name: "Vacations" },
    };
    stores.cloudsState.roomSkills = [
      { id: "s1", name: "Summaries", description: "How to summarise." },
      { id: "s2", name: "Emails", description: "House style." },
    ];
    stores.cloudsState.disabledSkillIds = ["s2"];
    stores.messageState.messages = [
      { id: "u1", role: "user", content: [{ type: "text", text: "hi" }] },
    ];
    apiAi.regenerateStream.mockReturnValue(arr([]));

    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.regenerate("u1");
    });

    const arg = apiAi.regenerateStream.mock.calls[0][0];
    expect(arg.actionArgs.contextRoom).toEqual({
      cloud: "nct2.onlyoffice.com",
      id: "r1",
      skills: [
        { id: "s1", name: "Summaries", description: "How to summarise." },
      ],
    });
    // Without the host's opt-in the room only contributes its skills; the
    // round keeps the configured scope so local tool prefs stay reachable.
    expect(arg.contextEntityId).toBeUndefined();
  });

  it("scopes the round to the host's contextEntityId while no room is connected", async () => {
    widgetConfig.contextEntityId = "agent-ctx";
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "t1";
    stores.messageState.messages = [
      { id: "u1", role: "user", content: [{ type: "text", text: "hi" }] },
    ];
    apiAi.regenerateStream.mockReturnValue(arr([]));

    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.regenerate("u1");
    });

    expect(apiAi.regenerateStream.mock.calls[0][0].contextEntityId).toBe(
      "agent-ctx"
    );
  });

  it("with contextRoomScopesRounds but no room the configured scope stays", async () => {
    widgetConfig.contextEntityId = "agent-ctx";
    widgetConfig.contextRoomScopesRounds = true;
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "t1";
    stores.messageState.messages = [
      { id: "u1", role: "user", content: [{ type: "text", text: "hi" }] },
    ];
    apiAi.regenerateStream.mockReturnValue(arr([]));

    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.regenerate("u1");
    });

    expect(apiAi.regenerateStream.mock.calls[0][0].contextEntityId).toBe(
      "agent-ctx"
    );
  });

  it("with contextRoomScopesRounds the connected room becomes the round's scope", async () => {
    widgetConfig.contextEntityId = "agent-ctx";
    widgetConfig.contextRoomScopesRounds = true;
    stores.profilesState.chatProfile = profile;
    stores.threadsState.threadId = "t1";
    stores.cloudsState.selectedContextFolder = {
      cloud: "nct2.onlyoffice.com",
      room: { id: "r1", name: "Vacations" },
    };
    stores.messageState.messages = [
      { id: "u1", role: "user", content: [{ type: "text", text: "hi" }] },
    ];
    apiAi.regenerateStream.mockReturnValue(arr([]));

    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.regenerate("u1");
    });

    const arg = apiAi.regenerateStream.mock.calls[0][0];
    expect(arg.contextEntityId).toBe("r1");
    // The thread itself stays where the user is.
    expect(arg.entityId).toBe(widgetConfig.entityId);
  });
});

describe("useMessages thread sync effect", () => {
  it("does not refetch or clear attachments on remount with the same empty thread", () => {
    // Fresh store: the sentinel `null` claim means "nothing synced yet",
    // so the first mount fetches the empty "new chat" thread and clears.
    stores.messageState._currentThreadId = null;
    const first = renderHook(() => useMessages({ isReady: true }));
    expect(stores.messageState.fetchPrevMessages).toHaveBeenCalledWith("");
    expect(stores.attachmentsState.clearAttachmentFiles).toHaveBeenCalledTimes(
      1
    );

    // The real fetchPrevMessages records the claim, including for "".
    stores.messageState._currentThreadId = "";
    first.unmount();
    (
      stores.messageState.fetchPrevMessages as ReturnType<typeof vi.fn>
    ).mockClear();
    stores.attachmentsState.clearAttachmentFiles.mockClear();
    stores.attachmentsState.clearAttachmentImages.mockClear();

    // Remount with the same (empty) thread: composer attachments survive.
    renderHook(() => useMessages({ isReady: true }));
    expect(stores.messageState.fetchPrevMessages).not.toHaveBeenCalled();
    expect(stores.attachmentsState.clearAttachmentFiles).not.toHaveBeenCalled();
    expect(
      stores.attachmentsState.clearAttachmentImages
    ).not.toHaveBeenCalled();
  });

  it("refetches and clears attachments on an actual thread switch", () => {
    stores.messageState._currentThreadId = "";
    stores.threadsState.threadId = "t2";
    renderHook(() => useMessages({ isReady: true }));
    expect(stores.messageState.fetchPrevMessages).toHaveBeenCalledWith("t2");
    expect(stores.attachmentsState.clearAttachmentFiles).toHaveBeenCalledTimes(
      1
    );
  });
});

describe("useMessages orphaned rounds", () => {
  // The active thread changing mid-stream (host re-scope on navigation,
  // sidebar thread switch, explicit new chat) bumps `_streamEpoch` via
  // `orphanStreams`. From that point the round must go silent: keep
  // draining so the engine finishes and persists, but never write into
  // the message list the new thread now owns. Regression: starting an
  // image generation, navigating away and back left the generated
  // assistant message alone inside the fresh empty chat.
  it("stops display writes once the epoch moves, but keeps draining", async () => {
    stores.profilesState.chatProfile = profile;
    let drainedToEnd = false;
    async function* stream() {
      yield {
        type: "message-start",
        message: { role: "assistant", content: "generating…" },
        messageId: "m1",
      };
      // Host re-scopes (e.g. Files → Agents): onSwitchToNewThread runs
      // orphanStreams + claim("") + clearMessages.
      stores.messageState._streamEpoch += 1;
      stores.messageState.isStreamRunning = false;
      stores.messageState.messages = [];
      yield {
        type: "message-delta",
        message: { role: "assistant", content: "the image" },
        messageId: "m1",
      };
      yield {
        type: "message-end",
        message: { role: "assistant", content: "the image, done" },
        messageId: "m1",
      };
      yield {
        type: "thread-title",
        threadId: "t-new",
        title: "Generated image",
      };
      drainedToEnd = true;
    }
    apiAi.sendWithStream.mockReturnValue(stream());

    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "draw a cat" }],
      } as never);
    });

    // Only the optimistic user bubble and the pre-switch assistant start
    // ever reached the store — nothing after the epoch moved.
    expect(stores.messageState.addMessage).toHaveBeenCalledTimes(2);
    expect(stores.messageState.updateLastMessage).not.toHaveBeenCalled();
    // The late thread-title must not hijack the new scope's thread list.
    expect(stores.messageState.claimThreadId).not.toHaveBeenCalledWith("t-new");
    expect(stores.threadsState.insertThread).not.toHaveBeenCalled();
    // The stream was still consumed to completion (persistence path).
    expect(drainedToEnd).toBe(true);
  });

  it("does not clobber the busy flags a newer round owns", async () => {
    stores.profilesState.chatProfile = profile;
    async function* stream() {
      yield {
        type: "message-start",
        message: { role: "assistant", content: "old round" },
        messageId: "m1",
      };
      // Orphaned…
      stores.messageState._streamEpoch += 1;
      stores.messageState.isStreamRunning = false;
      // …and a newer round starts and arms its own state.
      stores.messageState.isStreamRunning = true;
      stores.messageState._abortController = new AbortController();
      stores.messageState.setIsStreamRunning.mockClear();
      stores.messageState.setIsRequestRunning.mockClear();
      stores.messageState.setAbortController.mockClear();
      yield {
        type: "message-end",
        message: { role: "assistant", content: "old round done" },
        messageId: "m1",
      };
    }
    apiAi.sendWithStream.mockReturnValue(stream());

    const { result } = renderHook(() => useMessages({ isReady: true }));
    await act(async () => {
      await result.current.onNew({
        content: [{ type: "text", text: "hello" }],
      } as never);
    });

    // The orphaned round's release must not reset the newer round's
    // flags, nor clear a controller it does not own.
    expect(stores.messageState.setIsStreamRunning).not.toHaveBeenCalledWith(
      false
    );
    expect(stores.messageState.setAbortController).not.toHaveBeenCalledWith(
      undefined
    );
    expect(stores.messageState._abortController).toBeDefined();
  });
});
