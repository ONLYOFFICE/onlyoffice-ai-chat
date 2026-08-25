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

  it("getTools re-enumerates on every call (no caching)", async () => {
    // Nothing may be cached: the instance is shared across users/portals,
    // so a stored listing would leak one caller's view into another's.
    const tools = [{ name: "sys_a", description: "", inputSchema: {} }];
    // A fresh Response per call — a Response body is single-use.
    const fetchImpl = vi.fn(() =>
      Promise.resolve(json({ result: { tools } }))
    );

    const src = new SystemToolsSource({
      servers: { sysA: { url: "http://x" } },
      fetch: fetchImpl,
    });

    const first = await src.getTools();
    const callsAfterFirst = fetchImpl.mock.calls.length;
    const second = await src.getTools();
    expect(fetchImpl.mock.calls.length).toBe(callsAfterFirst * 2);
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

    // getTools: one session for the listing; callTool: one session for its
    // own routing enumeration, then another for the call itself — each
    // opened fresh and terminated right after.
    expect(calls).toEqual([
      { method: "initialize", session: undefined },
      { method: "notifications/initialized", session: "sess-1" },
      { method: "tools/list", session: "sess-1" },
      { method: "DELETE", session: "sess-1" },
      { method: "initialize", session: undefined },
      { method: "notifications/initialized", session: "sess-2" },
      { method: "tools/list", session: "sess-2" },
      { method: "DELETE", session: "sess-2" },
      { method: "initialize", session: undefined },
      { method: "notifications/initialized", session: "sess-3" },
      { method: "tools/call", session: "sess-3" },
      { method: "DELETE", session: "sess-3" },
    ]);
  });

  it("routes callTool to the owning server via a fresh enumeration", async () => {
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

    const res = await src.callTool("toolB", {});

    // Routing re-enumerates live (both servers listed), but the call itself
    // lands only on the owning server.
    const callBodies = fetchImpl.mock.calls.filter(
      ([, init]) =>
        JSON.parse(((init as RequestInit)?.body as string) ?? "{}").method ===
        "tools/call"
    );
    expect(callBodies).toHaveLength(1);
    expect(callBodies[0][0]).toBe("http://b");
    expect(JSON.parse(res as string)).toEqual({ ran: "http://b" });
  });

  it("getServerTypes lists configured servers", () => {
    const src = new SystemToolsSource({
      servers: { a: { url: "u" }, b: { url: "v" } },
    });
    expect(src.getServerTypes().sort()).toEqual(["a", "b"]);
  });

  it("resolves servers per call through an async resolver", async () => {
    // Registry-backed shape: the map is a function of the active entityId,
    // fetched live on every operation — never cached (shared instance).
    const tools = [{ name: "custom_a", description: "", inputSchema: {} }];
    const fetchImpl = vi.fn(() => Promise.resolve(json({ result: { tools } })));
    const resolver = vi.fn(
      async (entityId?: string): Promise<Record<string, { url: string }>> =>
        entityId === "agent-1" ? { reg: { url: "http://reg" } } : {}
    );

    const src = new SystemToolsSource({ servers: resolver, fetch: fetchImpl });

    expect(await src.getTools("agent-1")).toEqual({ reg: tools });
    expect(resolver).toHaveBeenLastCalledWith("agent-1");
    expect(await src.getTools()).toEqual({});
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it("callTool threads entityId into the resolver", async () => {
    const tools = [{ name: "custom_a", description: "", inputSchema: {} }];
    const fetchImpl = vi.fn((_url: unknown, init?: unknown) => {
      const body = JSON.parse(((init as RequestInit)?.body as string) ?? "{}");
      if (body.method === "tools/call") {
        return Promise.resolve(json({ result: { ok: true } }));
      }
      if (body.method === "tools/list") {
        return Promise.resolve(json({ result: { tools } }));
      }
      return Promise.resolve(json({ result: {} }));
    });
    const resolver = vi.fn(async () => ({ reg: { url: "http://reg" } }));

    const src = new SystemToolsSource({ servers: resolver, fetch: fetchImpl });

    const res = await src.callTool("custom_a", {}, "agent-1");
    expect(resolver).toHaveBeenCalledWith("agent-1");
    expect(JSON.parse(res as string)).toEqual({ ok: true });
  });

  it("getServerTypes is empty for a resolver-backed source", () => {
    const src = new SystemToolsSource({ servers: async () => ({}) });
    expect(src.getServerTypes()).toEqual([]);
  });
});
