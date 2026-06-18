import { describe, expect, it, vi } from "vitest";
import {
  buildToolContext,
  executeAdapterTool,
  mergeToolsByName,
  resolveToolSource,
} from "../tools";
import type { ToolsAdapter } from "../../../tools-adapter";

const {
  callWebSearchToolMock,
  callImageGenerationToolMock,
  getWebSearchToolsMock,
  getImageGenerationToolsMock,
  resumeChatMock,
} = vi.hoisted(() => ({
  callWebSearchToolMock: vi.fn(),
  callImageGenerationToolMock: vi.fn(),
  getWebSearchToolsMock: vi.fn().mockResolvedValue([]),
  getImageGenerationToolsMock: vi.fn().mockResolvedValue([]),
  resumeChatMock: vi.fn(),
}));

vi.mock("../../web-search", () => ({
  callWebSearchTool: callWebSearchToolMock,
  getWebSearchTools: getWebSearchToolsMock,
  WEB_SEARCH_TYPE: "web-search",
}));

vi.mock("../sources/image-generation", () => ({
  callImageGenerationTool: callImageGenerationToolMock,
  getImageGenerationTools: getImageGenerationToolsMock,
  IMAGE_GENERATION_TYPE: "image-generation",
}));

vi.mock("../tool-call", () => ({
  readToolCall: (m: { content?: unknown[] }, idx: number) => {
    const part = (m.content as unknown[])?.[idx] as
      | { type?: string }
      | undefined;
    if (!part || part.type !== "tool-call") return null;
    return part as never;
  },
  readToolCallArgs: (m: { content?: unknown[] }, idx: number) => {
    const part = (m.content as unknown[])?.[idx] as
      | { args?: Record<string, unknown> }
      | undefined;
    return part?.args ?? {};
  },
  resumeChat: resumeChatMock,
}));

const tool = (name: string, description = "d") => ({
  name,
  description,
  inputSchema: { type: "object" },
});

function makeStorage(disabled: Record<string, string[]> = {}) {
  return {
    toolPrefs: { readDisabled: vi.fn().mockResolvedValue(disabled) },
  } as never;
}

describe("mergeToolsByName", () => {
  it("dedupes by name with override winning", () => {
    const base = [tool("a", "base"), tool("b")];
    const override = [tool("a", "override"), tool("c")];
    const merged = mergeToolsByName(base, override);
    expect(merged.map((t) => t.name)).toEqual(["a", "b", "c"]);
    expect(merged[0].description).toBe("override");
  });
});

describe("resolveToolSource", () => {
  const userSet = new Set(["u1"]);
  const adapterSet = new Set(["a1"]);
  it("returns 'unknown' for null name", () => {
    expect(resolveToolSource(null, userSet, adapterSet)).toBe("unknown");
  });
  it("classifies as 'user' when in userToolNames", () => {
    expect(resolveToolSource("u1", userSet, adapterSet)).toBe("user");
  });
  it("classifies as 'adapter' when only in adapter set", () => {
    expect(resolveToolSource("a1", userSet, adapterSet)).toBe("adapter");
  });
  it("classifies as 'unknown' when in neither", () => {
    expect(resolveToolSource("missing", userSet, adapterSet)).toBe("unknown");
  });
});

describe("buildToolContext", () => {
  it("merges adapter, web-search, image-gen and user tools", async () => {
    getWebSearchToolsMock.mockResolvedValue([tool("web_search")]);
    getImageGenerationToolsMock.mockResolvedValue([tool("generate_image")]);
    const adapter: ToolsAdapter = {
      getTools: vi.fn().mockResolvedValue({ custom: [tool("ad_tool")] }),
      callTool: vi.fn(),
    };
    const userTools = [tool("user_tool"), tool("ad_tool", "user-override")];

    const ctx = await buildToolContext(makeStorage(), adapter, userTools);
    const names = ctx.mergedTools.map((t) => t.name);
    expect(names).toContain("user_tool");
    expect(names).toContain("web_search");
    expect(names).toContain("generate_image");
    expect(names).toContain("ad_tool");
    expect(ctx.mergedTools.find((t) => t.name === "ad_tool")?.description).toBe(
      "user-override"
    );
    expect(ctx.userToolNames.has("user_tool")).toBe(true);
    expect(ctx.adapterToolNames.has("web_search")).toBe(true);
  });

  it("marks tools from systemServerTypes groups as systemToolNames", async () => {
    getWebSearchToolsMock.mockResolvedValue([tool("web_search")]);
    getImageGenerationToolsMock.mockResolvedValue([]);
    const adapter: ToolsAdapter = {
      getTools: vi.fn().mockResolvedValue({
        sysA: [tool("sys_one")],
        hostB: [tool("host_one")],
      }),
      callTool: vi.fn(),
    };

    const ctx = await buildToolContext(
      makeStorage(),
      adapter,
      [],
      undefined,
      undefined,
      ["sysA"]
    );

    expect(ctx.systemToolNames.has("sys_one")).toBe(true);
    // Other adapter groups and built-ins are NOT system tools.
    expect(ctx.systemToolNames.has("host_one")).toBe(false);
    expect(ctx.systemToolNames.has("web_search")).toBe(false);
    // System tools are still adapter tools.
    expect(ctx.adapterToolNames.has("sys_one")).toBe(true);
  });

  it("filters out tools disabled in storage.toolPrefs", async () => {
    getWebSearchToolsMock.mockResolvedValue([
      tool("web_search"),
      tool("web_crawling"),
    ]);
    getImageGenerationToolsMock.mockResolvedValue([]);
    const adapter: ToolsAdapter = {
      getTools: vi.fn().mockResolvedValue({}),
      callTool: vi.fn(),
    };
    const ctx = await buildToolContext(
      makeStorage({ "web-search": ["web_crawling"] }),
      adapter,
      []
    );
    expect(ctx.adapterTools.map((t) => t.name)).toEqual(["web_search"]);
  });

  it("forwards entityId to adapter.getTools", async () => {
    getWebSearchToolsMock.mockResolvedValue([]);
    getImageGenerationToolsMock.mockResolvedValue([]);
    const getTools = vi.fn().mockResolvedValue({});
    const adapter: ToolsAdapter = {
      getTools,
      callTool: vi.fn(),
    };
    await buildToolContext(makeStorage(), adapter, [], "room-1");
    expect(getTools).toHaveBeenCalledWith("room-1", undefined);
  });

  it("forwards attachment ids to adapter.getTools", async () => {
    getWebSearchToolsMock.mockResolvedValue([]);
    getImageGenerationToolsMock.mockResolvedValue([]);
    const getTools = vi.fn().mockResolvedValue({});
    const adapter: ToolsAdapter = {
      getTools,
      callTool: vi.fn(),
    };
    await buildToolContext(makeStorage(), adapter, [], "room-1", {
      attachmentId: ["a1", "a2"],
    });
    expect(getTools).toHaveBeenCalledWith("room-1", {
      attachmentId: ["a1", "a2"],
    });
  });

  it("works without an adapter", async () => {
    getWebSearchToolsMock.mockResolvedValue([]);
    getImageGenerationToolsMock.mockResolvedValue([]);
    const ctx = await buildToolContext(makeStorage(), undefined, []);
    expect(ctx.adapterTools).toEqual([]);
    expect(ctx.mergedTools).toEqual([]);
  });
});

describe("executeAdapterTool", () => {
  it("returns immediately when message has no tool-call at idx", async () => {
    const gen = executeAdapterTool(
      makeStorage(),
      undefined,
      {
        type: "tool-call-pending",
        threadId: "t",
        messageId: "m",
        idx: 0,
        message: { role: "assistant", content: [{ type: "text" }] } as never,
      } as never,
      { profile: {} as never, profileId: "p", tools: [] }
    );
    expect((await gen.next()).done).toBe(true);
  });

  it("dispatches web_search through callWebSearchTool", async () => {
    callWebSearchToolMock.mockResolvedValue("web-result");
    resumeChatMock.mockImplementation(async function* () {
      yield { type: "message-end" };
    });
    const gen = executeAdapterTool(
      makeStorage(),
      undefined,
      {
        type: "tool-call-pending",
        threadId: "t",
        messageId: "m",
        idx: 0,
        message: {
          role: "assistant",
          content: [
            { type: "tool-call", toolName: "web_search", args: { q: 1 } },
          ],
        } as never,
      } as never,
      { profile: {} as never, profileId: "p", tools: [] }
    );
    const events = [];
    for await (const e of gen) events.push(e);
    expect(callWebSearchToolMock).toHaveBeenCalledWith(
      expect.anything(),
      "web_search",
      { q: 1 },
      undefined,
      undefined
    );
    expect(resumeChatMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ result: "web-result" })
    );
    expect(events).toEqual([{ type: "message-end" }]);
  });

  it("dispatches generate_image through callImageGenerationTool", async () => {
    callImageGenerationToolMock.mockResolvedValue("image-result");
    resumeChatMock.mockImplementation(async function* () {});
    const gen = executeAdapterTool(
      makeStorage(),
      undefined,
      {
        type: "tool-call-pending",
        threadId: "t",
        messageId: "m",
        idx: 0,
        message: {
          role: "assistant",
          content: [
            { type: "tool-call", toolName: "generate_image", args: {} },
          ],
        } as never,
      } as never,
      { profile: {} as never, profileId: "p", tools: [] }
    );
    for await (const _ of gen) {
      void _;
    }
    expect(callImageGenerationToolMock).toHaveBeenCalled();
    // The base64 → attachment-ref swap is centralized in `resumeChat`
    // (covered by tool-call.test.ts), so `executeAdapterTool` forwards the
    // raw tool result through unchanged.
    expect(resumeChatMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ result: "image-result" })
    );
  });

  it("dispatches custom tool via the adapter when provided", async () => {
    const adapter: ToolsAdapter = {
      callTool: vi.fn().mockResolvedValue("adapter-result"),
      getTools: vi.fn(),
    };
    resumeChatMock.mockImplementation(async function* () {});
    const gen = executeAdapterTool(
      makeStorage(),
      adapter,
      {
        type: "tool-call-pending",
        threadId: "t",
        messageId: "m",
        idx: 0,
        message: {
          role: "assistant",
          content: [{ type: "tool-call", toolName: "custom_tool", args: {} }],
        } as never,
      } as never,
      { profile: {} as never, profileId: "p", tools: [] }
    );
    for await (const _ of gen) {
      void _;
    }
    expect(adapter.callTool).toHaveBeenCalledWith("custom_tool", {}, undefined);
  });

  it("forwards entityId to adapter.callTool", async () => {
    const adapter: ToolsAdapter = {
      callTool: vi.fn().mockResolvedValue("adapter-result"),
      getTools: vi.fn(),
    };
    resumeChatMock.mockImplementation(async function* () {});
    const gen = executeAdapterTool(
      makeStorage(),
      adapter,
      {
        type: "tool-call-pending",
        threadId: "t",
        messageId: "m",
        idx: 0,
        message: {
          role: "assistant",
          content: [{ type: "tool-call", toolName: "custom_tool", args: {} }],
        } as never,
      } as never,
      {
        profile: {} as never,
        profileId: "p",
        tools: [],
        entityId: "room-1",
      }
    );
    for await (const _ of gen) {
      void _;
    }
    expect(adapter.callTool).toHaveBeenCalledWith("custom_tool", {}, "room-1");
  });

  it("returns sentinel error when no dispatcher can handle the tool", async () => {
    resumeChatMock.mockImplementation(async function* () {});
    const gen = executeAdapterTool(
      makeStorage(),
      undefined,
      {
        type: "tool-call-pending",
        threadId: "t",
        messageId: "m",
        idx: 0,
        message: {
          role: "assistant",
          content: [{ type: "tool-call", toolName: "weird", args: {} }],
        } as never,
      } as never,
      { profile: {} as never, profileId: "p", tools: [] }
    );
    for await (const _ of gen) {
      void _;
    }
    const passed = resumeChatMock.mock.calls.at(-1)![1] as { result: unknown };
    expect(JSON.parse(passed.result as string)).toEqual({
      error: "No dispatcher for tool: weird",
    });
  });
});
