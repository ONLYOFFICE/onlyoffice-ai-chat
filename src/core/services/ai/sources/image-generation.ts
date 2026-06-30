import { ActionType } from "../../../../shared/action-type";
import logger from "../../../../shared/logger";
import type { TMCPItem } from "../../../../shared/mcp-item";
import type { ProviderFetch } from "../../../../shared/provider-credentials";
import { providerFor } from "../../../actions/provider";
import type { StorageAdapter } from "../../../storage";

/** Stable serverType prefix used in `storage.toolPrefs` and runtime routing. */
export const IMAGE_GENERATION_TYPE = "image-generation";

/**
 * Resolve the proxy / external fetch for a profile — the engine's
 * `pickFetch`. The image-generation tool resolves its OWN profile
 * (distinct from the chat profile that issued the tool call), so it must
 * run that profile through the same resolver to wire
 * `PlatformAdapter.externalFetch` (required for `providerType: "external"`)
 * or `fetchProxy` into the image request. Without it, an `external`
 * profile would fall back to the global `fetch` and the inner SDK would
 * have no transport.
 */
export type ProfileFetchResolver = (profile: {
  providerType?: string;
  useProxy?: boolean;
}) => ProviderFetch | undefined;

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
        "Generate an image from a textual description. Use this tool when the user asks to create, draw, render, or illustrate an image. The generated image is rendered inline in the chat automatically.",
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
  args: Record<string, unknown>,
  pickFetch?: ProfileFetchResolver
): Promise<string> {
  logger.info("[generate_image] tool called", { bareName, args });

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

  try {
    // Resolve the fetch for THIS profile (not the chat profile that
    // issued the call): `providerType: "external"` requires the host's
    // `externalFetch`, and any provider opts into `fetchProxy` via
    // `useProxy`/`forceProxy`. Done inside the try so a misconfigured
    // `external` profile surfaces as a tool-result error string instead
    // of throwing into the chat stream.
    const fetch = pickFetch?.(profile);
    const provider = providerFor({
      profile,
      messages: [],
      ...(fetch ? { fetch } : {}),
    });
    if (typeof provider.imageGeneration !== "function") {
      return JSON.stringify({
        error: "Image generation provider is not configured.",
      });
    }
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
