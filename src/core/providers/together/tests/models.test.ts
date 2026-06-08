import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { inferCapabilities, listModels } from "../models";

describe("together/models/inferCapabilities", () => {
  it("maps chat → Chat (+ Vision when id contains vision)", () => {
    expect(inferCapabilities({ id: "llama-vision", type: "chat" })).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Vision
    );
    expect(inferCapabilities({ id: "llama", type: "chat" })).toBe(
      CapabilitiesUI.Chat
    );
  });
  it("maps image → Image", () => {
    expect(inferCapabilities({ id: "x", type: "image" })).toBe(
      CapabilitiesUI.Image
    );
  });
  it("maps embedding → Embeddings", () => {
    expect(inferCapabilities({ id: "x", type: "embedding" })).toBe(
      CapabilitiesUI.Embeddings
    );
  });
  it("maps code → Chat", () => {
    expect(inferCapabilities({ id: "x", type: "code" })).toBe(
      CapabilitiesUI.Chat
    );
  });
  it("maps rerank → None", () => {
    expect(inferCapabilities({ id: "x", type: "rerank" })).toBe(
      CapabilitiesUI.None
    );
  });
  it("defaults to Chat", () => {
    expect(inferCapabilities({ id: "x" })).toBe(CapabilitiesUI.Chat);
  });
});

describe("together/models/listModels", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("maps REST response to Model[]", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { id: "m1", type: "chat" },
          { id: "m2", type: "image" },
        ]),
    } as unknown as Response);
    const out = await listModels({
      baseUrl: "https://api.together.xyz/v1",
      apiKey: "sk",
    });
    expect(out.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(out[1].capabilities).toBe(CapabilitiesUI.Image);
  });
});
