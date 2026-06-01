import { describe, expect, it, vi } from "vitest";
import { callTool, listTools } from "../mcp-http-client";

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

  it("callTool returns the serialised result", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        json({ jsonrpc: "2.0", id: "c", result: { ok: true } })
      );
    expect(await callTool(fetchImpl, "s", { url: "http://x" }, "t", {})).toBe(
      JSON.stringify({ ok: true })
    );
  });

  it("callTool throws on a JSON-RPC error", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        json({ jsonrpc: "2.0", id: "c", error: { code: -1, message: "boom" } })
      );
    await expect(
      callTool(fetchImpl, "s", { url: "http://x" }, "t", {})
    ).rejects.toThrow(/boom/);
  });
});
