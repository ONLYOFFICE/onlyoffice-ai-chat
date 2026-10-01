import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Profile } from "../../../types";
import { AbstractBaseProvider } from "../../../providers";
import {
  registerProvider,
  unregisterProvider,
  type ProviderConstructor,
} from "../../../providers";
import type { StorageAdapter } from "../../../storage";
import { AIEngine } from "../engine";

const sendMessageMock = vi.fn();
const sendMessageSyncMock = vi.fn();

class StubProvider extends AbstractBaseProvider {
  async *sendMessage(
    args: Parameters<AbstractBaseProvider["sendMessage"]>[0]
  ): ReturnType<AbstractBaseProvider["sendMessage"]> {
    yield* sendMessageMock(args);
  }
  async sendMessageSync(
    args: Parameters<AbstractBaseProvider["sendMessageSync"]>[0]
  ): Promise<string> {
    return sendMessageSyncMock(args);
  }
  static getName(): string {
    return "Stub";
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

const STUB = "engine-resume-stub";
const profile: Profile = {
  id: "p1",
  name: "P",
  providerType: STUB,
  baseUrl: "https://stub",
  modelId: "m",
  capabilities: 0xff,
};

function makeStorage() {
  let messages: ThreadMessageLike[] = [];
  let allowAlways: string[] = [];
  const update = vi.fn(async (id: string, msg: ThreadMessageLike) => {
    messages = messages.map((m) =>
      (m as { id?: string }).id === id ? { ...msg, id } : m
    );
  });
  const create = vi.fn(async (_t: string, m: ThreadMessageLike) => {
    const stored = { ...m, id: `m${messages.length + 1}` };
    messages.push(stored);
    return stored;
  });
  const storage = {
    profiles: { readById: vi.fn(async () => profile) },
    assignments: {
      readByType: vi.fn(async () => "p1"),
      readAll: vi.fn(async () => ({})),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    threads: {
      create: vi.fn(),
      readById: vi.fn(async () => null),
      readAll: vi.fn(async () => []),
      update: vi.fn(),
      touch: vi.fn(),
      delete: vi.fn(),
    },
    messages: {
      create,
      readByThread: vi.fn(async () => [...messages]),
      update,
      deleteByThread: vi.fn(),
    },
    webSearch: { read: vi.fn(async () => null) },
    toolPrefs: {
      readAllowAlways: vi.fn(async () => [...allowAlways]),
      readDisabled: vi.fn(async () => ({})),
      upsertAllowAlways: vi.fn(async (next: string[]) => {
        allowAlways = next;
      }),
    },
  } as unknown as StorageAdapter;
  return {
    storage,
    get messages() {
      return messages;
    },
    get allowAlways() {
      return allowAlways;
    },
  };
}

async function* arrayToStream(
  items: { isEnd: boolean; responseMessage: ThreadMessageLike }[]
) {
  for (const it of items) yield it;
}

beforeEach(() => {
  registerProvider(STUB, StubProvider as unknown as ProviderConstructor);
  sendMessageMock.mockReset();
  sendMessageSyncMock.mockReset();
});

afterEach(() => {
  unregisterProvider(STUB);
  vi.restoreAllMocks();
});

const toolCallMessage: ThreadMessageLike = {
  role: "assistant",
  content: [
    { type: "tool-call", toolCallId: "c1", toolName: "search", args: { q: 1 } },
  ],
} as ThreadMessageLike;

describe("AIEngine.approveToolCall", () => {
  it("persists the tool result and yields message-end after resume", async () => {
    const final: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "after-tool" }],
    };
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([{ isEnd: true, responseMessage: final }])
    );
    const { storage } = makeStorage();
    // Pre-populate storage with the assistant tool-call message so
    // approveToolCall has something to update.
    await storage.messages.create("t1", toolCallMessage);
    const engine = new AIEngine({ storage });

    const events = [];
    for await (const e of engine.approveToolCall({
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: toolCallMessage,
      result: "tool-result",
    })) {
      events.push(e);
    }
    expect(events.map((e) => e.type)).toEqual(["message-end"]);
    expect(storage.messages.update).toHaveBeenCalled();
  });

  it("keeps the MCP server instructions in the resumed round", async () => {
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([
        {
          isEnd: true,
          responseMessage: {
            role: "assistant",
            content: [{ type: "text", text: "x" }],
          },
        },
      ])
    );
    const { storage } = makeStorage();
    await storage.messages.create("t1", toolCallMessage);
    const engine = new AIEngine({ storage });

    for await (const _ of engine.approveToolCall({
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: toolCallMessage,
      result: "ok",
      actionArgs: {
        toolInstructions: { docspace: "SERVER NOTE" },
        // Notes are kept only for servers represented in the round, and every
        // tool in the merged list now carries its group.
        tools: [
          {
            name: "search",
            description: "",
            inputSchema: {},
            serverType: "docspace",
          },
        ],
      },
    })) {
      void _;
    }

    // A resume round is a fresh provider request: the notes have to be
    // re-assembled into its system prompt or the model forgets them the
    // moment the first tool runs.
    expect(sendMessageMock.mock.calls[0][0].systemPrompt).toContain(
      "SERVER NOTE"
    );
  });

  it("records the tool name in allowAlways when allowAlways is set", async () => {
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([
        {
          isEnd: true,
          responseMessage: {
            role: "assistant",
            content: [{ type: "text", text: "x" }],
          },
        },
      ])
    );
    const { storage } = makeStorage();
    await storage.messages.create("t1", toolCallMessage);
    const engine = new AIEngine({ storage });
    for await (const _ of engine.approveToolCall({
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: toolCallMessage,
      result: "ok",
      allowAlways: true,
    })) {
      void _;
    }
    expect(storage.toolPrefs.upsertAllowAlways).toHaveBeenCalledWith(
      ["search"],
      undefined
    );
  });

  it("pins an MCP tool under its server's token, not its bare name (bug 84009)", async () => {
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([
        {
          isEnd: true,
          responseMessage: {
            role: "assistant",
            content: [{ type: "text", text: "x" }],
          },
        },
      ])
    );
    const { storage } = makeStorage();
    await storage.messages.create("t1", toolCallMessage);
    const engine = new AIEngine({ storage });
    for await (const _ of engine.approveToolCall({
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: toolCallMessage,
      result: "ok",
      allowAlways: true,
      actionArgs: {
        tools: [
          {
            name: "search",
            description: "",
            inputSchema: {},
            serverType: "calculator",
          },
        ],
      },
    })) {
      void _;
    }
    expect(storage.toolPrefs.upsertAllowAlways).toHaveBeenCalledWith(
      ["calculator_search"],
      undefined
    );
  });

  it("does not duplicate already-allowed tool", async () => {
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    storage.toolPrefs.readAllowAlways = vi.fn(async () => ["search"]);
    await storage.messages.create("t1", toolCallMessage);
    const engine = new AIEngine({ storage });
    for await (const _ of engine.approveToolCall({
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: toolCallMessage,
      result: "ok",
      allowAlways: true,
    })) {
      void _;
    }
    expect(storage.toolPrefs.upsertAllowAlways).not.toHaveBeenCalled();
  });

  it("executes a system tool server-side on approve, ignoring the client result", async () => {
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([
        {
          isEnd: true,
          responseMessage: {
            role: "assistant",
            content: [{ type: "text", text: "done" }],
          },
        },
      ])
    );
    const sysToolCallMessage: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "c1",
          toolName: "sys_search",
          args: { q: 1 },
        },
      ],
    } as ThreadMessageLike;

    const callTool = vi.fn().mockResolvedValue(JSON.stringify({ ok: true }));
    const toolsAdapter = {
      getTools: vi.fn().mockResolvedValue({
        sysSrv: [{ name: "sys_search", description: "", inputSchema: {} }],
      }),
      callTool,
    };

    const { storage } = makeStorage();
    await storage.messages.create("t1", sysToolCallMessage);
    const engine = new AIEngine({
      storage,
      toolsAdapter,
      systemServerTypes: ["sysSrv"],
    });

    const events = [];
    for await (const e of engine.approveToolCall({
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: sysToolCallMessage,
      result: "IGNORED-client-result",
    })) {
      events.push(e);
    }

    // Engine executed the tool server-side rather than trusting the client.
    expect(callTool).toHaveBeenCalledWith("sys_search", { q: 1 }, undefined);
    expect(events.map((e) => e.type)).toContain("message-end");
  });

  it("uses the client result for non-system tools (no server-side exec)", async () => {
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([
        {
          isEnd: true,
          responseMessage: {
            role: "assistant",
            content: [{ type: "text", text: "done" }],
          },
        },
      ])
    );
    const callTool = vi.fn();
    const toolsAdapter = {
      getTools: vi.fn().mockResolvedValue({}),
      callTool,
    };
    const { storage } = makeStorage();
    await storage.messages.create("t1", toolCallMessage);
    const engine = new AIEngine({
      storage,
      toolsAdapter,
      systemServerTypes: ["sysSrv"],
    });
    for await (const _ of engine.approveToolCall({
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: toolCallMessage,
      result: "client-result",
    })) {
      void _;
    }
    expect(callTool).not.toHaveBeenCalled();
  });

  it("resumes on the thread's own profile when the caller omits profileId", async () => {
    // Core-side guard for the "model resets after tool approve" bug: a resume
    // without an explicit profileId must recover the profile the thread is
    // bound to (persisted by sendWithStream) instead of dropping to the global
    // default assignment. Holds for ANY client of the engine — the UI sending
    // profileId is defense-in-depth, not the sole guard.
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([
        {
          isEnd: true,
          responseMessage: {
            role: "assistant",
            content: [{ type: "text", text: "x" }],
          },
        },
      ])
    );
    const threadProfile: Profile = { ...profile, id: "p2", modelId: "m2" };
    const { storage } = makeStorage();
    // Thread is bound to p2; the global Chat assignment still resolves p1.
    storage.threads.readById = vi.fn(async () => ({
      threadId: "t1",
      title: "T",
      profileId: "p2",
    }));
    storage.profiles.readById = vi.fn(async (id: string) =>
      id === "p2" ? threadProfile : profile
    );
    await storage.messages.create("t1", toolCallMessage);
    const engine = new AIEngine({ storage });
    for await (const _ of engine.approveToolCall({
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: toolCallMessage,
      result: "ok",
      // no profileId — the bug scenario
    })) {
      void _;
    }
    // Resolved the thread's profile (p2 / m2), not the default assignment (p1).
    expect(storage.profiles.readById).toHaveBeenCalledWith("p2");
    expect(sendMessageMock.mock.calls[0][0].model).toBe("m2");
  });
});

describe("AIEngine.denyToolCall", () => {
  it("resumes the chat with a deny payload", async () => {
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([
        {
          isEnd: true,
          responseMessage: {
            role: "assistant",
            content: [{ type: "text", text: "ok" }],
          },
        },
      ])
    );
    const { storage } = makeStorage();
    await storage.messages.create("t1", toolCallMessage);
    const engine = new AIEngine({ storage });
    const events = [];
    for await (const e of engine.denyToolCall({
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: toolCallMessage,
    })) {
      events.push(e);
    }
    expect(events.map((e) => e.type)).toEqual(["message-end"]);
  });
});
