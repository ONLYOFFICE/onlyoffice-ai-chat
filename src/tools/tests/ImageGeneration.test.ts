import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEventBus } from "../../events";

const mockGetActionProvider = vi.fn();

vi.mock("../../services/action-holders", () => ({
  getActionProvider: (...args: unknown[]) => mockGetActionProvider(...args),
}));

import { ImageGeneration } from "../sources/ImageGeneration";

const makeEventBus = (): ChatEventBus =>
  ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  }) as unknown as ChatEventBus;

describe("ImageGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes no tools when disabled", () => {
    const ig = new ImageGeneration(makeEventBus());
    expect(ig.getEnabled()).toBe(false);
    expect(ig.getTools()).toEqual([]);
  });

  it("exposes the generate_image tool when enabled", () => {
    const ig = new ImageGeneration(makeEventBus());
    ig.setEnabled(true);
    expect(ig.getEnabled()).toBe(true);
    const tools = ig.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("generate_image");
  });

  it("emits tools-changed on state transitions", () => {
    const bus = makeEventBus();
    const ig = new ImageGeneration(bus);
    expect(bus.emit).toHaveBeenCalledWith("tools-changed");

    (bus.emit as ReturnType<typeof vi.fn>).mockClear();
    ig.setEnabled(true);
    expect(bus.emit).toHaveBeenCalledWith("tools-changed");

    (bus.emit as ReturnType<typeof vi.fn>).mockClear();
    ig.setEnabled(true);
    expect(bus.emit).not.toHaveBeenCalled();
  });

  it("returns error JSON when provider is not configured", async () => {
    mockGetActionProvider.mockReturnValue(undefined);
    const ig = new ImageGeneration(makeEventBus());
    ig.setEnabled(true);
    const raw = await ig.callTools("generate_image", { prompt: "cat" });
    expect(typeof raw).toBe("string");
    expect(JSON.parse(raw as string)).toEqual({
      error: "Image generation provider is not configured.",
    });
  });

  it("routes prompt to the assigned provider and returns base64", async () => {
    const imageGeneration = vi.fn().mockResolvedValue("BASE64DATA");
    mockGetActionProvider.mockReturnValue({ imageGeneration });
    const ig = new ImageGeneration(makeEventBus());
    ig.setEnabled(true);
    const raw = await ig.callTools("generate_image", { prompt: "cat" });
    expect(imageGeneration).toHaveBeenCalledWith({ prompt: "cat" });
    expect(JSON.parse(raw as string)).toEqual({
      data: { base64: "BASE64DATA" },
    });
  });

  it("returns error JSON when prompt is missing", async () => {
    const imageGeneration = vi.fn();
    mockGetActionProvider.mockReturnValue({ imageGeneration });
    const ig = new ImageGeneration(makeEventBus());
    ig.setEnabled(true);
    const raw = await ig.callTools("generate_image", {});
    expect(imageGeneration).not.toHaveBeenCalled();
    expect(JSON.parse(raw as string)).toEqual({ error: "Missing prompt." });
  });

  it("rejects unknown tool names", async () => {
    const ig = new ImageGeneration(makeEventBus());
    ig.setEnabled(true);
    const raw = await ig.callTools("other", { prompt: "cat" });
    expect(JSON.parse(raw as string)).toEqual({ error: "Unknown tool: other" });
  });
});
