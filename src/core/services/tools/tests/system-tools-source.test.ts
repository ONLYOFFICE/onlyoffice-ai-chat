import { describe, expect, it, vi } from "vitest";
import { SystemToolsSource } from "../system-tools-source";

const json = (obj: unknown) => new Response(JSON.stringify(obj));

describe("SystemToolsSource", () => {
  it("getTools groups by server type and caches", async () => {
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

    const second = await src.getTools();
    expect(second).toBe(first); // cached — no extra calls
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("callTool routes to the owning server", async () => {
    const tools = [{ name: "do_it", description: "", inputSchema: {} }];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ result: {} }))
      .mockResolvedValueOnce(json({ result: { tools } }))
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

  it("refresh forces a re-enumeration", async () => {
    const tools = [{ name: "t", description: "", inputSchema: {} }];
    const fetchImpl = vi.fn().mockResolvedValue(json({ result: { tools } }));

    const src = new SystemToolsSource({
      servers: { srv: { url: "http://x" } },
      fetch: fetchImpl,
    });

    await src.getTools();
    const callsAfterFirst = fetchImpl.mock.calls.length;
    src.refresh();
    await src.getTools();
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});
