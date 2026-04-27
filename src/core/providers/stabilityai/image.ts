import type { ImageGenerationArgs } from "../../../shared/image-generation-args";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { stabilityaiInfo } from "./info";

/**
 * Call Stability AI's image-generation REST endpoint.
 *
 * Stability AI has no official Node SDK — we hit the REST endpoint
 * directly with multipart form-data (the format the service requires
 * for these routes). The specific endpoint path comes from
 * {@link stabilityaiInfo.models}; requesting a missing model falls back
 * to `models[1]` (a safe default chat-ready generator).
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
  const { model, prompt, signal } = args;
  const modelId = model || "core";
  const modelInfo =
    stabilityaiInfo.models.find((m) => m.id === modelId) ??
    stabilityaiInfo.models[1];

  const url = (creds.baseUrl || stabilityaiInfo.baseUrl) + modelInfo.endpoint;

  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("output_format", "png");

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
