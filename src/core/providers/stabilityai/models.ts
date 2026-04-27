import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { mapFetchError } from "../errors";
import { stabilityaiInfo } from "./info";

/**
 * Return the curated Stability AI model list.
 *
 * Stability AI doesn't expose a `/models` endpoint, so the list is
 * hard-coded in {@link stabilityaiInfo.models}. All entries are marked
 * {@link CapabilitiesUI.Image}.
 *
 * @returns Array of image-capable {@link Model}.
 */
export const listModels = async (): Promise<Model[]> =>
  stabilityaiInfo.models.map((m) => ({
    id: m.id,
    name: m.name,
    provider: "stabilityai" as const,
    capabilities: CapabilitiesUI.Image,
  }));

/**
 * Validate Stability AI credentials by issuing a tiny probe request
 * against the `/generate/core` endpoint.
 *
 * The service has no "validate key" endpoint, so we submit a throw-away
 * prompt and classify by HTTP status. 401 → invalid key; anything else
 * reachable → credentials accepted.
 *
 * @param creds - Credentials to check.
 * @returns `true` on success, or a {@link TErrorData} describing the
 *   offending field.
 */
export const checkCredentials = async (
  creds: ProviderCredentials
): Promise<boolean | TErrorData> => {
  try {
    const url =
      (creds.baseUrl || stabilityaiInfo.baseUrl) +
      "/v2beta/stable-image/generate/core";

    const formData = new FormData();
    formData.append("prompt", "test");
    formData.append("output_format", "png");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${creds.apiKey}`,
      },
      body: formData,
    });

    if (response.status === 401) {
      return { field: "key", message: "Invalid API key" };
    }
    return true;
  } catch (error) {
    return mapFetchError(error, !!creds.apiKey);
  }
};
