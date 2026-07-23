import { describe, expect, it, vi } from "vitest";
import { SystemToolsSource } from "../system-tools-source";

const json = (obj: unknown) => new Response(JSON.stringify(obj));

describe("SystemToolsSource", () => {
  it("getTools groups by server type", async () => {
    const tools = [{ name: "sys_a", description: "", inputSchema: {} }];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ result: {} }))
      .mockResolvedValueOnce(json({ result: { tools } }));

    const src = new SystemToolsSource({
      servers: { sysA: { url: "http://x" } },
      fetch: fetchImpl,
    });

    const first = await src.getTools();
    expect(first).toEqual({ sysA: tools });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("getTools serves a cached list within its TTL (no re-enumeration)", async () => {
    const tools = [{ name: "sys_a", description: "", inputSchema: {} }];
    const fetchImpl = vi.fn().mockResolvedValue(json({ result: { tools } }));

    const src = new SystemToolsSource({
      servers: { sysA: { url: "http://x" } },
      fetch: fetchImpl,
    });

    const first = await src.getTools();
    const callsAfterFirst = fetchImpl.mock.calls.length;
    const second = await src.getTools();
    // Second call within the TTL is served from cache — no extra requests.
    expect(fetchImpl.mock.calls.length).toBe(callsAfterFirst);
    expect(second).toEqual(first);
  });

  it("callTool routes to the owning server", async () => {
    const tools = [{ name: "do_it", description: "", inputSchema: {} }];
    const fetchImpl = vi
      .fn()
      // getTools(): initialize + tools/list
      .mockResolvedValueOnce(json({ result: {} }))
      .mockResolvedValueOnce(json({ result: { tools } }))
      // rpc callTool(): initialize + tools/call
      .mockResolvedValueOnce(json({ result: {} }))
      .mockResolvedValueOnce(json({ result: { done: true } }));

    const src = new SystemToolsSource({
      servers: { srv: { url: "http://x" } },
      fetch: fetchImpl,
    });

    expect(await src.callTool("do_it", { x: 1 })).toBe(
      JSON.stringify({ done: true })
    );
  });

  it("callTool returns an error payload for an unknown tool", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ result: {} }))
      .mockResolvedValueOnce(json({ result: { tools: [] } }));

    const src = new SystemToolsSource({
      servers: { srv: { url: "http://x" } },
      fetch: fetchImpl,
    });

    expect(await src.callTool("nope", {})).toContain("Unknown system tool");
  });

  it("reuses the Mcp-Session-Id across list and call (one initialize)", async () => {
    const tools = [{ name: "t", description: "", inputSchema: {} }];
    const withSession = (obj: unknown) =>
      new Response(JSON.stringify(obj), {
        headers: { "Mcp-Session-Id": "sess-1" },
      });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(withSession({ result: {} })) // initialize → session
      .mockResolvedValueOnce(new Response("", { status: 202 })) // initialized
      .mockResolvedValueOnce(json({ result: { tools } })) // tools/list
      .mockResolvedValueOnce(json({ result: { done: true } })); // tools/call

    const src = new SystemToolsSource({
      servers: { s: { url: "http://x" } },
      fetch: fetchImpl,
    });

    await src.getTools();
    expect(await src.callTool("t", {})).toBe(JSON.stringify({ done: true }));

    // No second handshake: initialize ran exactly once, tools/call reused it.
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    const initCalls = fetchImpl.mock.calls.filter(
      ([, init]) =>
        JSON.parse((init as RequestInit).body as string).method === "initialize"
    );
    expect(initCalls).toHaveLength(1);
    const callInit = fetchImpl.mock.calls[3][1] as RequestInit;
    expect(JSON.parse(callInit.body as string).method).toBe("tools/call");
    expect((callInit.headers as Record<string, string>)["Mcp-Session-Id"]).toBe(
      "sess-1"
    );
  });

  it("routes callTool via the cached index without re-listing other servers", async () => {
    const fetchImpl = vi.fn((url: string, init?: RequestInit) => {
      const method = JSON.parse((init?.body as string) ?? "{}").method;
      if (method === "tools/list") {
        const tools =
          url === "http://a"
            ? [{ name: "toolA", description: "", inputSchema: {} }]
            : [{ name: "toolB", description: "", inputSchema: {} }];
        return Promise.resolve(json({ result: { tools } }));
      }
      if (method === "tools/call") {
        return Promise.resolve(json({ result: { ran: url } }));
      }
      return Promise.resolve(json({ result: {} })); // initialize (stateless)
    });

    const src = new SystemToolsSource({
      servers: { a: { url: "http://a" }, b: { url: "http://b" } },
      fetch: fetchImpl,
    });

    await src.getTools();
    const callsBefore = fetchImpl.mock.calls.length;
    const res = await src.callTool("toolB", {});
    const afterCalls = fetchImpl.mock.calls.slice(callsBefore);

    // callTool touched only server b — server a is not re-enumerated.
    expect(afterCalls.length).toBeGreaterThan(0);
    expect(afterCalls.every(([url]) => url === "http://b")).toBe(true);
    expect(JSON.parse(res as string)).toEqual({ ran: "http://b" });
  });

  it("getServerTypes lists configured servers", () => {
    const src = new SystemToolsSource({
      servers: { a: { url: "u" }, b: { url: "v" } },
    });
    expect(src.getServerTypes().sort()).toEqual(["a", "b"]);
  });
});
