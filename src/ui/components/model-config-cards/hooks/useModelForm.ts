import { useCallback, useRef, useState } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useStores } from "../../../store/context";
import { useDebouncedCallback } from "../../../hooks/useDebouncedCallback";
import { getProvider } from "../../../../core/providers";
import type { Model, ProviderType } from "../../../../types";
import type {
  ModelFormErrors,
  ModelFormValues,
  ProviderSelection,
} from "../../model-config-cards/sub-components/ModelConfigForm";

/**
 * Resolve a provider's display name through the static
 * {@link ProviderConstructor.getName} helper. Falls back to the raw
 * type when the provider isn't registered (e.g. tests with a stub).
 */
function getProviderName(type: ProviderType): string {
  return getProvider(type)?.getName() ?? type;
}

/**
 * Fetch the list of models a provider exposes via the static
 * {@link ProviderConstructor.getProviderModels}. Returns either the
 * model list or a structured error suitable for the form's
 * `setErrors` map.
 */
async function fetchProviderModels(
  type: ProviderType,
  apiKey: string,
  baseUrl: string
): Promise<{ models: Model[] } | { error: { field: string; message: string } }> {
  const provider = getProvider(type);
  if (!provider) {
    return {
      error: { field: "name", message: `Unknown provider: ${type}` },
    };
  }
  const result = await provider.getProviderModels({ baseUrl, apiKey });
  if (Array.isArray(result)) return { models: result };
  return { models: [] };
}

const fieldToErrorKey: Partial<
  Record<keyof ModelFormValues, keyof ModelFormErrors>
> = {
  apiKey: "key",
  baseUrl: "url",
  profileName: "name",
};

export const useModelForm = (initialValues: ModelFormValues) => {
  const { t } = useI18n();
  const { useCloudsStore } = useStores();
  const { externalOnlyofficeConfig } = useCloudsStore();
  const [values, setValues] = useState<ModelFormValues>(initialValues);
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ModelFormErrors>({});
  // True when the ONLYOFFICE wallet-service check has run and reported that
  // the `aitools` feature is not active. Surfaces the "AI setup is incomplete"
  // hint + the settings link in the Provider field. Starts `false` so nothing
  // is shown until the check has actually completed.
  const [isOnlyofficeAISetupIncomplete, setIsOnlyofficeAISetupIncomplete] =
    useState(false);
  const fetchModelsRequestIdRef = useRef(0);
  const walletCheckRequestIdRef = useRef(0);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  // Once the user edits the profile name manually, stop auto-generating it
  // from provider/model selection. Initialised to true in edit mode (name
  // already has a saved value), false when creating a new profile.
  const nameTouchedRef = useRef(initialValues.profileName !== "");

  // Mirrors the credentials-visibility logic in ModelConfigForm: when the
  // API Key field is shown to the user, a non-empty key is required.
  const isExternalOnlyoffice =
    values.provider === "onlyoffice" && !!externalOnlyofficeConfig;
  const apiKeyRequired = !values.isCloudProvider && !isExternalOnlyoffice;

  const isFormValid =
    !isLoading &&
    !!values.provider &&
    !!values.baseUrl &&
    !!values.model &&
    !!values.profileName &&
    (!apiKeyRequired || !!values.apiKey) &&
    !isOnlyofficeAISetupIncomplete &&
    Object.values(errors).every((v) => !v);

  const fetchModels = useCallback(
    async (
      providerType: ProviderType,
      apiKey: string,
      baseUrl: string,
      options?: { keepModelIfExists?: boolean; isCloudProvider?: boolean }
    ) => {
      if (!baseUrl) return;
      try {
        new URL(baseUrl);
      } catch {
        setErrors((prev) => ({ ...prev, url: t("InvalidUrl") }));
        setModels([]);
        setValues((prev) => ({ ...prev, model: "" }));
        return;
      }
      setErrors((prev) => {
        const next = { ...prev };
        delete next.url;
        delete next.key;
        return next;
      });
      setIsLoading(true);
      const requestId = ++fetchModelsRequestIdRef.current;
      const providerName = getProviderName(providerType);
      const result = await fetchProviderModels(providerType, apiKey, baseUrl);
      if (requestId !== fetchModelsRequestIdRef.current) return;
      setIsLoading(false);
      if ("error" in result) {
        setErrors((prev) => ({
          ...prev,
          [result.error.field]: result.error.message,
        }));
        setModels([]);
        setValues((prev) => ({ ...prev, model: "" }));
        return;
      }
      const fetched = result.models;
      setModels(fetched);

      const displayName = options?.isCloudProvider
        ? new URL(baseUrl).hostname
        : providerName;

      setValues((prev) => {
        if (options?.keepModelIfExists) {
          const currentExists = fetched.some((m) => m.id === prev.model);
          if (currentExists) return prev;
        }
        const firstModel = fetched[0];
        return {
          ...prev,
          model: firstModel?.id ?? "",
          ...(firstModel &&
            !nameTouchedRef.current && {
              profileName: `${displayName} - ${firstModel.name}`,
            }),
        };
      });
    },
    [t]
  );

  const debouncedFetchModels = useDebouncedCallback(fetchModels, 500);

  // Probes the ONLYOFFICE portal's wallet service to see whether the
  // `aitools` feature is active for the tenant. Called only for the
  // ONLYOFFICE provider / cloud providers; the result gates the
  // "AI setup is incomplete" hint and the settings link in the Provider
  // field. Anything other than `features[].value === true` — including
  // network/HTTP failures or malformed payloads — is treated as incomplete
  // ("в остальных случаях показывай").
  const checkOnlyofficeAISetup = useCallback(
    async (baseUrl: string, apiKey: string) => {
      if (!baseUrl) {
        setIsOnlyofficeAISetupIncomplete(false);
        return;
      }
      try {
        new URL(baseUrl);
      } catch {
        setIsOnlyofficeAISetupIncomplete(false);
        return;
      }
      const requestId = ++walletCheckRequestIdRef.current;
      try {
        const normalized = baseUrl.replace(/\/+$/, "");
        // The portal accepts this request anonymously as well, so only attach
        // the Authorization header when an API key is actually available —
        // otherwise the missing-key case (valid scenario per the product
        // spec) wouldn't reach the server and we'd never learn whether
        // `aitools` is enabled.
        const headers: HeadersInit = apiKey
          ? { Authorization: `Bearer ${apiKey}` }
          : {};
        const res = await fetch(
          `${normalized}/api/2.0/portal/payment/walletservice?service=aitools`,
          { headers }
        );
        if (requestId !== walletCheckRequestIdRef.current) return;
        if (!res.ok) {
          setIsOnlyofficeAISetupIncomplete(true);
          return;
        }
        const json = (await res.json()) as {
          response?: { features?: { id?: string; value?: boolean }[] };
          features?: { id?: string; value?: boolean }[];
        };
        if (requestId !== walletCheckRequestIdRef.current) return;
        const features = json?.response?.features ?? json?.features ?? [];
        const aiTools = features.find((f) => f?.id === "aitools");
        setIsOnlyofficeAISetupIncomplete(aiTools?.value !== true);
      } catch {
        if (requestId !== walletCheckRequestIdRef.current) return;
        setIsOnlyofficeAISetupIncomplete(true);
      }
    },
    []
  );

  const debouncedCheckOnlyofficeAISetup = useDebouncedCallback(
    checkOnlyofficeAISetup,
    500
  );

  const handleChange = (
    field: keyof ModelFormValues,
    value: string | ProviderSelection
  ) => {
    const errorKey = fieldToErrorKey[field];
    if (errorKey) setErrors((prev) => ({ ...prev, [errorKey]: undefined }));

    if (field === "provider") {
      const {
        type,
        baseUrl: newBaseUrl,
        apiKey,
        isCloudProvider,
      } = value as ProviderSelection;
      setValues((prev) => ({
        ...prev,
        provider: type,
        baseUrl: newBaseUrl,
        model: "",
        isCloudProvider: isCloudProvider ?? false,
        ...(apiKey !== undefined && { apiKey }),
      }));
      setModels([]);
      // Any in-flight wallet check is stale after a provider switch; drop
      // its result and clear the hint until the new provider re-checks.
      walletCheckRequestIdRef.current++;
      setIsOnlyofficeAISetupIncomplete(false);
      fetchModels(type, apiKey ?? valuesRef.current.apiKey, newBaseUrl, {
        isCloudProvider,
      });
      if (type === "onlyoffice" || isCloudProvider) {
        checkOnlyofficeAISetup(newBaseUrl, apiKey ?? valuesRef.current.apiKey);
      }
      return;
    }
    if (field === "apiKey") {
      const strValue = value as string;
      setValues((prev) => ({ ...prev, apiKey: strValue }));
      debouncedFetchModels(
        valuesRef.current.provider as ProviderType,
        strValue,
        valuesRef.current.baseUrl,
        {
          isCloudProvider: values.isCloudProvider,
        }
      );
      if (
        valuesRef.current.provider === "onlyoffice" ||
        valuesRef.current.isCloudProvider
      ) {
        // Hide the stale hint while the user is still typing; the debounced
        // check will re-set it once the fresh response comes back.
        setIsOnlyofficeAISetupIncomplete(false);
        debouncedCheckOnlyofficeAISetup(valuesRef.current.baseUrl, strValue);
      }
      return;
    }
    if (field === "baseUrl") {
      const strValue = value as string;
      setValues((prev) => ({ ...prev, baseUrl: strValue }));
      debouncedFetchModels(
        valuesRef.current.provider as ProviderType,
        valuesRef.current.apiKey,
        strValue,
        {
          isCloudProvider: values.isCloudProvider,
        }
      );
      if (
        valuesRef.current.provider === "onlyoffice" ||
        valuesRef.current.isCloudProvider
      ) {
        setIsOnlyofficeAISetupIncomplete(false);
        debouncedCheckOnlyofficeAISetup(strValue, valuesRef.current.apiKey);
      }
      return;
    }
    if (field === "model") {
      const strValue = value as string;
      const modelObj = models.find((m) => m.id === strValue);
      const providerName = getProviderName(
        valuesRef.current.provider as ProviderType
      );
      const displayName = values.isCloudProvider
        ? new URL(values.baseUrl).hostname
        : providerName;
      setValues((prev) => ({
        ...prev,
        model: strValue,
        ...(modelObj &&
          !nameTouchedRef.current && {
            profileName: `${displayName} - ${modelObj.name}`,
          }),
      }));
      return;
    }
    if (field === "profileName") {
      nameTouchedRef.current = true;
    }
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  return {
    values,
    setValues,
    models,
    setModels,
    isLoading,
    setIsLoading,
    errors,
    setErrors,
    isFormValid,
    fetchModels,
    handleChange,
    isOnlyofficeAISetupIncomplete,
    checkOnlyofficeAISetup,
  };
};
