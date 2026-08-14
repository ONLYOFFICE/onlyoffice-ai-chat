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

  it("opens a fresh session per operation and terminates it after", async () => {
    // Sessions must never be shared across operations: a stateful MCP
    // server binds the caller's credentials and target portal to the
    // session at initialize, so reuse would run every caller's tools under
    // whoever initialized first. Expect: one initialize per operation, a
    // DELETE termination after each, and every in-session request echoing
    // that operation's own session id.
    const tools = [{ name: "t", description: "", inputSchema: {} }];
    let sessionSeq = 0;
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      if ((init?.method ?? "POST").toUpperCase() === "DELETE") {
        return Promise.resolve(new Response("", { status: 200 }));
      }
      const body = JSON.parse((init?.body as string) ?? "{}");
      if (body.method === "initialize") {
        sessionSeq += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ result: {} }), {
            headers: { "Mcp-Session-Id": `sess-${sessionSeq}` },
          })
        );
      }
      if (body.method === "notifications/initialized") {
        return Promise.resolve(new Response("", { status: 202 }));
      }
      if (body.method === "tools/list") {
        return Promise.resolve(json({ result: { tools } }));
      }
      return Promise.resolve(json({ result: { done: true } }));
    });

    const src = new SystemToolsSource({
      servers: { s: { url: "http://x" } },
      fetch: fetchImpl,
    });

    await src.getTools();
    expect(await src.callTool("t", {})).toBe(JSON.stringify({ done: true }));

    const calls = fetchImpl.mock.calls.map(([, init]) => {
      const req = init as RequestInit;
      if ((req.method ?? "POST").toUpperCase() === "DELETE") {
        return {
          method: "DELETE",
          session: (req.headers as Record<string, string>)["Mcp-Session-Id"],
        };
      }
      return {
        method: JSON.parse(req.body as string).method as string,
        session: (req.headers as Record<string, string>)["Mcp-Session-Id"],
      };
    });

    // getTools: initialize → initialized → tools/list → DELETE (sess-1);
    // callTool: initialize → initialized → tools/call → DELETE (sess-2).
    expect(calls).toEqual([
      { method: "initialize", session: undefined },
      { method: "notifications/initialized", session: "sess-1" },
      { method: "tools/list", session: "sess-1" },
      { method: "DELETE", session: "sess-1" },
      { method: "initialize", session: undefined },
      { method: "notifications/initialized", session: "sess-2" },
      { method: "tools/call", session: "sess-2" },
      { method: "DELETE", session: "sess-2" },
    ]);
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
