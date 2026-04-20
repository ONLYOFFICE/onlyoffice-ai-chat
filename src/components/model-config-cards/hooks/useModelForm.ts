import { useCallback, useRef, useState } from "react";
import { useI18n } from "../../../locales";
import { useStores } from "../../../store/context";
import { useDebouncedCallback } from "../../../hooks/useDebouncedCallback";
import type { Model, ProviderType } from "../../../types";
import type {
  ModelFormErrors,
  ModelFormValues,
  ProviderSelection,
} from "../../model-config-cards/sub-components/ModelConfigForm";

const fieldToErrorKey: Partial<
  Record<keyof ModelFormValues, keyof ModelFormErrors>
> = {
  apiKey: "key",
  baseUrl: "url",
  profileName: "name",
};

export const useModelForm = (initialValues: ModelFormValues) => {
  const { t } = useI18n();
  const { provider } = useStores();
  const [values, setValues] = useState<ModelFormValues>(initialValues);
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ModelFormErrors>({});
  const fetchModelsRequestIdRef = useRef(0);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const isFormValid =
    !isLoading &&
    !!values.provider &&
    !!values.baseUrl &&
    !!values.model &&
    !!values.profileName &&
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
      const providerInfo = provider.getProviderInfo(providerType);
      const { models: result, errors: fetchErrors } =
        await provider.getProvidersModels([
          { type: providerType, name: providerInfo.name, key: apiKey, baseUrl },
        ]);
      if (requestId !== fetchModelsRequestIdRef.current) return;
      setIsLoading(false);
      const fetchError = fetchErrors.get(providerInfo.name);
      if (fetchError) {
        setErrors((prev) => ({
          ...prev,
          [fetchError.field]: fetchError.message,
        }));
        setModels([]);
        setValues((prev) => ({ ...prev, model: "" }));
        return;
      }
      const fetched = result.get(providerInfo.name) ?? [];
      setModels(fetched);

      const displayName = options?.isCloudProvider
        ? new URL(baseUrl).hostname
        : providerInfo.name;

      setValues((prev) => {
        if (options?.keepModelIfExists) {
          const currentExists = fetched.some((m) => m.id === prev.model);
          if (currentExists) return prev;
        }
        const firstModel = fetched[0];
        return {
          ...prev,
          model: firstModel?.id ?? "",
          ...(firstModel && {
            profileName: `${displayName} - ${firstModel.name}`,
          }),
        };
      });
    },
    [provider, t]
  );

  const debouncedFetchModels = useDebouncedCallback(fetchModels, 500);

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
      fetchModels(type, apiKey ?? valuesRef.current.apiKey, newBaseUrl, {
        isCloudProvider,
      });
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
      return;
    }
    if (field === "model") {
      const strValue = value as string;
      const modelObj = models.find((m) => m.id === strValue);
      const providerInfo = provider.getProviderInfo(
        valuesRef.current.provider as ProviderType
      );
      const displayName = values.isCloudProvider
        ? new URL(values.baseUrl).hostname
        : providerInfo.name;
      setValues((prev) => ({
        ...prev,
        model: strValue,
        ...(modelObj && {
          profileName: `${displayName} - ${modelObj.name}`,
        }),
      }));
      return;
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
  };
};
