import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { getErrorCode, ProviderErrors } from "../errors";

/** Internal ONLYOFFICE backend provider id for "use OpenAI-compatible route". */
export const ONLYOFFICE_PROVIDER_ID = -1;

/** Shape of a model row returned by `/api/2.0/ai/chats/models`. */
type OnlyOfficeModel = {
  modelId: string;
  providerId: number;
  providerTitle: string;
};

/**
 * Fetch the ONLYOFFICE-curated model list from the host's REST endpoint.
 *
 * ONLYOFFICE exposes its model catalogue on a separate non-OpenAI URL
 * (`/api/2.0/ai/chats/models`), so we bypass the SDK and hit the REST
 * route directly. The caller passes the *original* base URL — the
 * provider constructor's URL transformation isn't applied here.
 *
 * @param creds - Original ONLYOFFICE base URL + optional API key.
 * @returns Array of {@link Model}.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  const baseUrl = creds.baseUrl.replace(/\/+$/, "");
  const headers: HeadersInit = creds.apiKey
    ? { Authorization: `Bearer ${creds.apiKey}` }
    : {};

  const response = await fetch(
    `${baseUrl}/api/2.0/ai/chats/models?provider=${ONLYOFFICE_PROVIDER_ID}`,
    { headers }
  );

  const json = await response.json();
  const models: OnlyOfficeModel[] = json.response ?? json;

  return models.map((m) => ({
    id: m.modelId,
    name: m.modelId,
    provider: "onlyoffice" as const,
  }));
};

/**
 * Validate ONLYOFFICE credentials by probing the model-list endpoint.
 *
 * Error classification mirrors the OpenAI provider's behaviour but
 * uses the ONLYOFFICE-specific endpoint, so that "endpoint reachable
 * but list returns 404/401" is mapped to the right user-facing field.
 *
 * @param creds - Credentials to check.
 * @returns `true` on success, or a {@link TErrorData} describing the
 *   offending field.
 */
export const checkCredentials = async (
  creds: ProviderCredentials
): Promise<boolean | TErrorData> => {
  try {
    await listModels(creds);
    return true;
  } catch (error) {
    const errorCode = getErrorCode(error);
    if (errorCode === "invalid_api_key") return ProviderErrors.invalidKey();
    if (errorCode === 404) return ProviderErrors.invalidUrl();
    return creds.apiKey
      ? ProviderErrors.invalidKey()
      : ProviderErrors.emptyKey();
  }
};
