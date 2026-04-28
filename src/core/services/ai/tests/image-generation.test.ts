import { describe, expect, it, vi } from "vitest";
import {
  IMAGE_GENERATION_TYPE,
  callImageGenerationTool,
  getImageGenerationTools,
} from "../sources/image-generation";

const { providerForMock } = vi.hoisted(() => ({
  providerForMock: vi.fn(),
}));

vi.mock("../../../actions/provider", () => ({
  providerFor: providerForMock,
}));

vi.mock("../../../../shared/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function makeStorage(opts: {
  profileId?: string | null;
  profile?: unknown;
}) {
  return {
    assignments: { readByType: vi.fn().mockResolvedValue(opts.profileId) },
    profiles: { readById: vi.fn().mockResolvedValue(opts.profile) },
  } as never;
}

describe("image-generation source", () => {
  it("IMAGE_GENERATION_TYPE constant", () => {
    expect(IMAGE_GENERATION_TYPE).toBe("image-generation");
  });

  describe("getImageGenerationTools", () => {
    it("returns empty when no profile assigned", async () => {
      expect(await getImageGenerationTools(makeStorage({ profileId: null }))).toEqual(
        []
      );
    });

    it("returns the generate_image tool when assigned", async () => {
      const tools = await getImageGenerationTools(
        makeStorage({ profileId: "p1" })
      );
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("generate_image");
    });
  });

  describe("callImageGenerationTool", () => {
    it("returns unknown tool error for non-matching name", async () => {
      const out = await callImageGenerationTool(
        makeStorage({ profileId: "p1" }),
        "weird",
        {}
      );
      expect(JSON.parse(out)).toEqual({ error: "Unknown tool: weird" });
    });

    it("returns missing prompt error when prompt is empty/non-string", async () => {
      const storage = makeStorage({ profileId: "p1" });
      expect(
        JSON.parse(
          await callImageGenerationTool(storage, "generate_image", {})
        )
      ).toEqual({ error: "Missing prompt." });
      expect(
        JSON.parse(
          await callImageGenerationTool(storage, "generate_image", {
            prompt: 123,
          })
        )
      ).toEqual({ error: "Missing prompt." });
    });

    it("returns config error when no profile assigned", async () => {
      expect(
        JSON.parse(
          await callImageGenerationTool(
            makeStorage({ profileId: null }),
            "generate_image",
            { prompt: "p" }
          )
        )
      ).toEqual({ error: "Image generation provider is not configured." });
    });

    it("returns config error when profile cannot be read", async () => {
      expect(
        JSON.parse(
          await callImageGenerationTool(
            makeStorage({ profileId: "p1", profile: null }),
            "generate_image",
            { prompt: "p" }
          )
        )
      ).toEqual({ error: "Image generation provider is not configured." });
    });

    it("returns config error when provider has no imageGeneration method", async () => {
      providerForMock.mockReturnValue({});
      const storage = makeStorage({
        profileId: "p1",
        profile: { id: "p1", modelId: "m" },
      });
      expect(
        JSON.parse(
          await callImageGenerationTool(storage, "generate_image", {
            prompt: "cat",
          })
        )
      ).toEqual({ error: "Image generation provider is not configured." });
    });

    it("invokes provider.imageGeneration and wraps result", async () => {
      const imageGeneration = vi.fn().mockResolvedValue("base64-data");
      providerForMock.mockReturnValue({ imageGeneration });
      const storage = makeStorage({
        profileId: "p1",
        profile: { id: "p1", modelId: "dall-e-3" },
      });
      const out = await callImageGenerationTool(storage, "generate_image", {
        prompt: "cat",
      });
      expect(JSON.parse(out)).toEqual({ data: { base64: "base64-data" } });
      expect(imageGeneration).toHaveBeenCalledWith({
        model: "dall-e-3",
        prompt: "cat",
      });
    });

    it("captures Error from provider", async () => {
      const imageGeneration = vi.fn().mockRejectedValue(new Error("boom"));
      providerForMock.mockReturnValue({ imageGeneration });
      const storage = makeStorage({
        profileId: "p1",
        profile: { id: "p1", modelId: "m" },
      });
      const out = await callImageGenerationTool(storage, "generate_image", {
        prompt: "cat",
      });
      expect(JSON.parse(out)).toEqual({ error: "boom" });
    });

    it("captures non-Error from provider", async () => {
      const imageGeneration = vi.fn().mockRejectedValue("offline");
      providerForMock.mockReturnValue({ imageGeneration });
      const storage = makeStorage({
        profileId: "p1",
        profile: { id: "p1", modelId: "m" },
      });
      const out = await callImageGenerationTool(storage, "generate_image", {
        prompt: "cat",
      });
      expect(JSON.parse(out)).toEqual({ error: "offline" });
    });
  });
});
