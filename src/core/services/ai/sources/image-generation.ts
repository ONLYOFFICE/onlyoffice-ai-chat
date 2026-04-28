import { ActionType } from "../../../../shared/action-type";
import logger from "../../../../shared/logger";
import type { TMCPItem } from "../../../../shared/mcp-item";
import { providerFor } from "../../../actions/provider";
import type { StorageAdapter } from "../../../storage";

/** Stable serverType prefix used in `storage.toolPrefs` and runtime routing. */
export const IMAGE_GENERATION_TYPE = "image-generation";

/**
 * Built-in image-generation tool.
 *
 * Available when the user has an explicit assignment for
 * {@link ActionType.ImageGeneration} — falls back to checking the raw
 * assignment row instead of going through `tryResolveForAction`, which
 * would inherit any `Default` profile and accidentally enable the tool
 * for every chat.
 *
 * Mirrors `src/ui/tools/sources/ImageGeneration.ts` but lives on the
 * engine side so the tool list is assembled in {@link buildToolContext}
 * without a round-trip to the UI's `Servers` aggregator.
 */
export async function getImageGenerationTools(
  storage: StorageAdapter
): Promise<TMCPItem[]> {
  const profileId = await storage.assignments.readByType(
    ActionType.ImageGeneration
  );
  if (!profileId) return [];

  return [
    {
      name: "generate_image",
      description:
        "Generate an image from a textual description. Use this tool when the user asks to create, draw, render, or illustrate an image. Returns a base64-encoded PNG that is rendered inline in the chat.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Detailed description of the image to generate.",
          },
        },
        required: ["prompt"],
      },
    },
  ];
}

/**
 * Execute the image-generation tool. Resolves the profile assigned to
 * {@link ActionType.ImageGeneration}, instantiates the matching
 * provider via {@link providerFor}, and invokes its `imageGeneration`
 * method. Returns a JSON-stringified payload — same shape the UI's
 * `ImageGeneration.callTools` returns, so the client display path is
 * unchanged.
 */
export async function callImageGenerationTool(
  storage: StorageAdapter,
  bareName: string,
  args: Record<string, unknown>
): Promise<string> {
  if (bareName !== "generate_image") {
    return JSON.stringify({ error: `Unknown tool: ${bareName}` });
  }

  const prompt = typeof args.prompt === "string" ? args.prompt : "";
  if (!prompt) {
    return JSON.stringify({ error: "Missing prompt." });
  }

  const profileId = await storage.assignments.readByType(
    ActionType.ImageGeneration
  );
  if (!profileId) {
    return JSON.stringify({
      error: "Image generation provider is not configured.",
    });
  }
  const profile = await storage.profiles.readById(profileId);
  if (!profile) {
    return JSON.stringify({
      error: "Image generation provider is not configured.",
    });
  }

  const provider = providerFor({ profile, messages: [] });
  if (typeof provider.imageGeneration !== "function") {
    return JSON.stringify({
      error: "Image generation provider is not configured.",
    });
  }

  try {
    const base64 = await provider.imageGeneration({
      model: profile.modelId,
      prompt,
    });
    return JSON.stringify({ data: { base64 } });
  } catch (e) {
    logger.error("ImageGeneration error:", e);
    return JSON.stringify({
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
