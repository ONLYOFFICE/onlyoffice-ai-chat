import type { GoogleGenAI } from "@google/genai";
import type { ImageGenerationArgs } from "../../../shared/image-generation-args";

/**
 * Aspect ratios accepted by Imagen's `generateImages` config. Any other
 * value is rejected by the service, so an unrecognized width/height pair
 * is snapped to the closest of these rather than passed through.
 */
const IMAGEN_ASPECT_RATIOS: [string, number][] = [
  ["1:1", 1],
  ["3:4", 3 / 4],
  ["4:3", 4 / 3],
  ["9:16", 9 / 16],
  ["16:9", 16 / 9],
];

/**
 * Pick the Imagen aspect ratio closest to the requested pixel size.
 *
 * `ImageGenerationArgs` speaks in width/height because DALL·E does, but
 * Imagen only takes a ratio string — so the caller's intent is mapped to
 * the nearest supported option instead of being dropped.
 *
 * @param width - Requested width in pixels, if any.
 * @param height - Requested height in pixels, if any.
 * @returns One of {@link IMAGEN_ASPECT_RATIOS}; `1:1` when unspecified.
 */
export const toAspectRatio = (width?: number, height?: number): string => {
  if (!width || !height) return "1:1";
  const ratio = width / height;
  let best = IMAGEN_ASPECT_RATIOS[0];
  let bestDiff = Math.abs(ratio - best[1]);
  for (const candidate of IMAGEN_ASPECT_RATIOS) {
    const diff = Math.abs(ratio - candidate[1]);
    if (diff < bestDiff) {
      best = candidate;
      bestDiff = diff;
    }
  }
  return best[0];
};

/**
 * Whether `model` generates images through the Imagen `generateImages`
 * endpoint rather than through `generateContent`.
 *
 * Google splits image generation across two incompatible APIs. Dedicated
 * Imagen models (`imagen-3.0-*`, `imagen-4.0-*`) answer on
 * `generateImages`; the Gemini-native image models marketed as Nano
 * Banana (`gemini-2.5-flash-image`, `gemini-3-pro-image-preview`, …)
 * return inline images from ordinary `generateContent` calls and reject
 * `generateImages` outright.
 *
 * @param model - Model id, with or without the `models/` prefix.
 * @returns `true` for Imagen models, `false` for Gemini image models.
 */
export const isImagenModel = (model: string): boolean =>
  model.toLowerCase().includes("imagen");

/**
 * Generate an image with a dedicated Imagen model.
 *
 * @param client - Configured GenAI client.
 * @param args - Per-call parameters (model, prompt, size, abort signal).
 * @returns Base64-encoded image payload, or `""` when the service
 *   returned no image (e.g. the prompt was filtered).
 * @see isImagenModel
 */
export const generateImagenImage = async (
  client: GoogleGenAI,
  args: ImageGenerationArgs
): Promise<string> => {
  const { model, prompt, width, height, signal } = args;

  const response = await client.models.generateImages({
    model,
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: toAspectRatio(width, height),
      outputMimeType: "image/png",
      abortSignal: signal,
    },
  });

  return response.generatedImages?.[0]?.image?.imageBytes ?? "";
};

/**
 * Generate an image with a Gemini-native image model (Nano Banana).
 *
 * These models have no separate image endpoint — the image comes back as
 * an `inlineData` part of a normal `generateContent` response, and only
 * when `responseModalities` asks for it. `TEXT` is requested alongside
 * `IMAGE` because several of these models reject an image-only modality
 * list; the text part is simply ignored here.
 *
 * Parts flagged `thought: true` are skipped. The thinking models in this
 * family (Gemini 3 Pro Image) emit their reasoning as leading parts of
 * the same response, and a thought part can itself carry `inlineData` —
 * returning that would hand back a sketch from the model's scratchpad
 * instead of the finished image.
 *
 * @param client - Configured GenAI client.
 * @param args - Per-call parameters (model, prompt, abort signal). Size
 *   is not honoured: these models expose no size or aspect-ratio control.
 * @returns Base64-encoded image payload, or `""` when the response
 *   carried no image part.
 */
export const generateGeminiImage = async (
  client: GoogleGenAI,
  args: ImageGenerationArgs
): Promise<string> => {
  const { model, prompt, signal } = args;

  const response = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      abortSignal: signal,
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.thought) continue;
    const data = part.inlineData?.data;
    if (data) return data;
  }
  return "";
};

/**
 * Generate an image with whichever Gemini image API the model belongs to.
 *
 * @param client - Configured GenAI client.
 * @param args - Per-call parameters.
 * @returns Base64-encoded image payload, or `""` when none was produced.
 * @see isImagenModel
 */
export const generateImage = async (
  client: GoogleGenAI,
  args: ImageGenerationArgs
): Promise<string> =>
  isImagenModel(args.model)
    ? generateImagenImage(client, args)
    : generateGeminiImage(client, args);
