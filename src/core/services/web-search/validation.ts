import type { TErrorData } from "../../../shared/error-data";
import { ProviderErrors } from "../../providers/errors";
import type { WebSearchConfig } from "../../storage";

const TEST_QUERY = { query: "test", numResults: 1 };

/**
 * Static validation of the config shape — runs before any network
 * call. Returns `null` on success.
 */
export function validateConfigShape(
  config: WebSearchConfig
): TErrorData | null {
  if (!config.provider || !config.provider.trim()) {
    return { field: "name", message: "Provider is required" };
  }

  // Cloud / ONLYOFFICE-style providers route by baseUrl, so it must be
  // present and parseable.
  if (config.isCloudProvider || config.provider === "ONLYOFFICE") {
    if (!config.baseUrl) {
      return { field: "url", message: "Base URL is required for cloud provider" };
    }
    try {
      new URL(config.baseUrl);
    } catch {
      return { field: "url", message: "Invalid base URL" };
    }
  }

  return null;
}

/**
 * Live validation — make a minimal search request against the
 * configured backend and translate the response status into a
 * `TErrorData`. Returns `true` when the backend accepts the request.
 *
 * Built-in branches:
 * - `isCloudProvider` or `provider === "ONLYOFFICE"`: POST to
 *   `<baseUrl>/api/2.0/ai/web-search/v1/search` with optional Bearer
 *   token.
 * - `provider === "Exa"`: POST to `https://api.exa.ai/search` with
 *   `x-api-key`.
 * - Anything else: rejected as unknown provider.
 */
export async function testWebSearchConnection(
  config: WebSearchConfig
): Promise<true | TErrorData> {
  const shapeError = validateConfigShape(config);
  if (shapeError) return shapeError;

  try {
    if (config.isCloudProvider || config.provider === "ONLYOFFICE") {
      const url = new URL(
        "/api/2.0/ai/web-search/v1/search",
        config.baseUrl
      );
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.key) headers.Authorization = `Bearer ${config.key}`;
      const response = await fetch(url.href, {
        method: "POST",
        headers,
        body: JSON.stringify(TEST_QUERY),
      });
      return mapResponse(response, !!config.key);
    }

    if (config.provider === "Exa") {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.key ?? "",
        },
        body: JSON.stringify(TEST_QUERY),
      });
      return mapResponse(response, !!config.key);
    }

    return {
      field: "name",
      message: `Unknown web-search provider: ${config.provider}`,
    };
  } catch {
    return ProviderErrors.connectionFailed();
  }
}

/**
 * Translate a non-2xx HTTP response into a `TErrorData`. `hasKey`
 * lets the predicate distinguish "key missing" from "key wrong" when
 * the backend doesn't tell us which.
 */
function mapResponse(
  response: Response,
  hasKey: boolean
): true | TErrorData {
  if (response.ok) return true;
  if (response.status === 401) return ProviderErrors.invalidKey();
  if (response.status === 404) return ProviderErrors.invalidUrl();
  if (!hasKey) return ProviderErrors.emptyKey();
  return ProviderErrors.invalidKey(
    `Request failed with status ${response.status}`
  );
}
