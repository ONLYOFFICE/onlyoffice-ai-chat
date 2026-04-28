import type { ImageGenerationArgs } from "../../../shared/image-generation-args";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { stabilityaiInfo } from "./info";

/** Default model used when the requested id is unknown. */
const DEFAULT_MODEL_ID = "core";

/**
 * Stability AI v2beta accepts an `aspect_ratio` string instead of an
 * explicit pixel size. Map common width/height pairs to the closest
 * supported ratio; unknown values fall back to `1:1`.
 */
const toAspectRatio = (width?: number, height?: number): string => {
  if (!width || !height) return "1:1";
  const ratio = width / height;
  const candidates: [string, number][] = [
    ["1:1", 1],
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
    ["3:2", 3 / 2],
    ["2:3", 2 / 3],
    ["4:5", 4 / 5],
    ["5:4", 5 / 4],
    ["21:9", 21 / 9],
    ["9:21", 9 / 21],
  ];
  let best = candidates[0];
  let bestDiff = Math.abs(ratio - best[1]);
  for (const c of candidates) {
    const diff = Math.abs(ratio - c[1]);
    if (diff < bestDiff) {
      best = c;
      bestDiff = diff;
    }
  }
  return best[0];
};

/**
 * Call Stability AI's image-generation REST endpoint.
 *
 * Stability AI has no official Node SDK — we hit the REST endpoint
 * directly with multipart form-data (the format the service requires
 * for these routes). The specific endpoint path comes from
 * {@link stabilityaiInfo.models}; an unknown model id falls back to the
 * `core` model.
 *
 * @param creds - Stability AI credentials.
 * @param args  - Per-call parameters (model, prompt, size, abort signal).
 * @returns Base64-encoded PNG payload (possibly empty on soft failure).
 * @throws When the HTTP response is not 2xx.
 */
export const generateImage = async (
  creds: ProviderCredentials,
  args: ImageGenerationArgs
): Promise<string> => {
  const { model, prompt, width, height, signal } = args;
  const modelId = model || DEFAULT_MODEL_ID;
  const fallback =
    stabilityaiInfo.models.find((m) => m.id === DEFAULT_MODEL_ID) ??
    stabilityaiInfo.models[0];
  const modelInfo =
    stabilityaiInfo.models.find((m) => m.id === modelId) ?? fallback;

  const url = (creds.baseUrl || stabilityaiInfo.baseUrl) + modelInfo.endpoint;

  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("output_format", "png");
  formData.append("aspect_ratio", toAspectRatio(width, height));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${creds.apiKey}`,
    },
    body: formData,
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Stability AI error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (data.artifacts?.[0]?.base64) return data.artifacts[0].base64;
  if (data.image) return data.image;
  return "";
};
