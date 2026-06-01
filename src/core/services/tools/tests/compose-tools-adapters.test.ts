import { describe, expect, it, vi } from "vitest";
import { composeToolsAdapters } from "../compose-tools-adapters";
import type { ToolsAdapter } from "../../../tools-adapter";

const tool = (name: string) => ({ name, description: "", inputSchema: {} });

const mkAdapter = (
  grouped: Record<string, ReturnType<typeof tool>[]>,
  callImpl: () => Promise<unknown> = async () => ""
): ToolsAdapter => ({
  getTools: vi.fn().mockResolvedValue(grouped),
  callTool: vi.fn(callImpl),
});

describe("composeToolsAdapters", () => {
  it("merges getTools from all adapters", async () => {
    const a = mkAdapter({ x: [tool("x1")] });
    const b = mkAdapter({ y: [tool("y1")] });
    expect(await composeToolsAdapters(a, b).getTools()).toEqual({
      x: [tool("x1")],
      y: [tool("y1")],
    });
  });

  it("routes callTool to the owning adapter", async () => {
    const a = mkAdapter({ x: [tool("x1")] }, async () => "A");
    const b = mkAdapter({ y: [tool("y1")] }, async () => "B");
    expect(await composeToolsAdapters(a, b).callTool("y1", {})).toBe("B");
    expect(a.callTool).not.toHaveBeenCalled();
  });

  it("falls back to the last adapter for unknown tools", async () => {
    const a = mkAdapter({ x: [] }, async () => "A");
    const b = mkAdapter({ y: [] }, async () => "B");
    expect(await composeToolsAdapters(a, b).callTool("zzz", {})).toBe("B");
  });

  it("ignores undefined adapters", async () => {
    const a = mkAdapter({ x: [tool("x1")] });
    expect(
      await composeToolsAdapters(undefined, a, undefined).getTools()
    ).toEqual({ x: [tool("x1")] });
  });
});
