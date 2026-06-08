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

  it("getTools re-enumerates on every call", async () => {
    const tools = [{ name: "sys_a", description: "", inputSchema: {} }];
    const fetchImpl = vi.fn().mockResolvedValue(json({ result: { tools } }));

    const src = new SystemToolsSource({
      servers: { sysA: { url: "http://x" } },
      fetch: fetchImpl,
    });

    await src.getTools();
    const callsAfterFirst = fetchImpl.mock.calls.length;
    await src.getTools();
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(callsAfterFirst);
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

  it("getServerTypes lists configured servers", () => {
    const src = new SystemToolsSource({
      servers: { a: { url: "u" }, b: { url: "v" } },
    });
    expect(src.getServerTypes().sort()).toEqual(["a", "b"]);
  });
});
