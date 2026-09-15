import { describe, expect, it, vi } from "vitest";
import { callTool, listTools, requestTools } from "../mcp-http-client";

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status });

describe("mcp-http-client", () => {
  it("listTools sends initialize then tools/list and merges headers", async () => {
    const tools = [{ name: "t1", description: "d", inputSchema: {} }];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: "init-s", result: {} }))
      .mockResolvedValueOnce(
        json({ jsonrpc: "2.0", id: "tools-s", result: { tools } })
      );

    const result = await listTools(fetchImpl, "s", {
      url: "http://x",
      headers: { Authorization: "Bearer t" },
    });

    expect(result).toEqual(tools);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json"
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer t"
    );
    // R1: Accept negotiation header is always present.
    expect((init.headers as Record<string, string>).Accept).toBe(
      "application/json, text/event-stream"
    );
  });

  it("listTools parses SSE-framed responses", async () => {
    const tools = [{ name: "t", description: "", inputSchema: {} }];
    const sse = `event: message\ndata: ${JSON.stringify({
      jsonrpc: "2.0",
      id: "tools-s",
      result: { tools },
    })}\n\n`;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response(sse));

    expect(await listTools(fetchImpl, "s", { url: "http://x" })).toEqual(tools);
  });

  it("listTools returns [] on HTTP error (never throws)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 500 }));
    expect(await listTools(fetchImpl, "s", { url: "http://x" })).toEqual([]);
  });

  it("requestTools carries the status text and response body in the error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("Bad credentials", {
        status: 401,
        statusText: "Unauthorized",
      })
    );
    await expect(
      requestTools(fetchImpl, "s", { url: "http://x" })
    ).rejects.toThrow("tools/list: HTTP 401 Unauthorized: Bad credentials");
  });

  it("callTool returns the serialised result", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: "init-s", result: {} }))
      .mockResolvedValueOnce(
        json({ jsonrpc: "2.0", id: "c", result: { ok: true } })
      );
    expect(await callTool(fetchImpl, "s", { url: "http://x" }, "t", {})).toBe(
      JSON.stringify({ ok: true })
    );
  });

  it("callTool drops structuredContent from the serialised result", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: "init-s", result: {} }))
      .mockResolvedValueOnce(
        json({
          jsonrpc: "2.0",
          id: "c",
          result: {
            content: [{ type: "text", text: '{"a":1}' }],
            structuredContent: { a: 1 },
            isError: false,
          },
        })
      );
    expect(await callTool(fetchImpl, "s", { url: "http://x" }, "t", {})).toBe(
      JSON.stringify({
        content: [{ type: "text", text: '{"a":1}' }],
        isError: false,
      })
    );
  });

  it("callTool throws on a JSON-RPC error", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: "init-s", result: {} }))
      .mockResolvedValueOnce(
        json({ jsonrpc: "2.0", id: "c", error: { code: -1, message: "boom" } })
      );
    await expect(
      callTool(fetchImpl, "s", { url: "http://x" }, "t", {})
    ).rejects.toThrow(/boom/);
  });

  it("listTools does a stateful handshake when the server returns Mcp-Session-Id", async () => {
    const tools = [{ name: "t", description: "", inputSchema: {} }];
    const withSession = (obj: unknown, sessionId: string) =>
      new Response(JSON.stringify(obj), {
        headers: { "Mcp-Session-Id": sessionId },
      });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        withSession({ jsonrpc: "2.0", id: "init-s", result: {} }, "sess-1")
      )
      .mockResolvedValueOnce(new Response("", { status: 202 })) // notifications/initialized
      .mockResolvedValueOnce(
        json({ jsonrpc: "2.0", id: "tools-s", result: { tools } })
      );

    expect(await listTools(fetchImpl, "s", { url: "http://x" })).toEqual(tools);
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    // Second call is the handshake notification, carrying the session id.
    const notif = fetchImpl.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(notif.body as string).method).toBe(
      "notifications/initialized"
    );
    expect((notif.headers as Record<string, string>)["Mcp-Session-Id"]).toBe(
      "sess-1"
    );

    // tools/list echoes the session id.
    const list = fetchImpl.mock.calls[2][1] as RequestInit;
    expect((list.headers as Record<string, string>)["Mcp-Session-Id"]).toBe(
      "sess-1"
    );
  });

  it("callTool opens a session then calls with the session id", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jsonrpc: "2.0", id: "init-s", result: {} }), {
          headers: { "Mcp-Session-Id": "sess-2" },
        })
      )
      .mockResolvedValueOnce(new Response("", { status: 202 }))
      .mockResolvedValueOnce(
        json({ jsonrpc: "2.0", id: "c", result: { done: true } })
      );

    expect(await callTool(fetchImpl, "s", { url: "http://x" }, "t", {})).toBe(
      JSON.stringify({ done: true })
    );
    const call = fetchImpl.mock.calls[2][1] as RequestInit;
    expect(JSON.parse(call.body as string).method).toBe("tools/call");
    expect((call.headers as Record<string, string>)["Mcp-Session-Id"]).toBe(
      "sess-2"
    );
  });

  it("omits Mcp-Session-Id for stateless servers (R6)", async () => {
    const tools = [{ name: "t", description: "", inputSchema: {} }];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: "init-s", result: {} }))
      .mockResolvedValueOnce(
        json({ jsonrpc: "2.0", id: "tools-s", result: { tools } })
      );

    expect(await listTools(fetchImpl, "s", { url: "http://x" })).toEqual(tools);
    // No session id returned → no notification, no session header anywhere.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchImpl.mock.calls) {
      expect(
        (init.headers as Record<string, string>)["Mcp-Session-Id"]
      ).toBeUndefined();
    }
  });
});
