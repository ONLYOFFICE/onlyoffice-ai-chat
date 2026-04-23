import { useEffect } from "react";
import { useI18n } from "../../../locales";
import { useStores } from "../../../store/context";
import type { Profile, ProviderType, TOnlyOfficeConfig } from "../../../types";
import { useComponents } from "../../../components-provider";
import { Icon } from "../../icon";
import { ProviderLogo } from "../../provider-logo";
import { useModelForm } from "../hooks/useModelForm";
import { ModelCardShell } from "./ModelCardShell";
import { ModelConfigForm, type ModelFormValues } from "./ModelConfigForm";

interface EditModelCardProps {
  profile: Profile;
  onClose: () => void;
  onDelete: () => void;
  isHorizontal?: boolean;
}

const profileToFormValues = (
  p: Profile,
  externalOnlyofficeConfig?: TOnlyOfficeConfig
): ModelFormValues => {
  const isExternal =
    p.providerType === "onlyoffice" && !!externalOnlyofficeConfig;
  return {
    provider: p.providerType,
    apiKey: isExternal
      ? (externalOnlyofficeConfig!.apiKey ?? "")
      : (p.key ?? ""),
    baseUrl: isExternal ? externalOnlyofficeConfig!.baseUrl : p.baseUrl,
    model: p.modelId,
    profileName: p.name,
    isCloudProvider: p.isCloudProvider,
  };
};

export const EditModelCard = ({
  profile,
  onClose,
  onDelete,
  isHorizontal,
}: EditModelCardProps) => {
  const { Button } = useComponents();
  const { t } = useI18n();
  const { useProfilesStore, useCloudsStore } = useStores();
  const { editProfile } = useProfilesStore();
  const { externalOnlyofficeConfig } = useCloudsStore();
  const initialValues = profileToFormValues(profile, externalOnlyofficeConfig);

  const {
    values,
    setIsLoading,
    errors,
    setErrors,
    isFormValid,
    fetchModels,
    handleChange,
    models,
    isOnlyofficeAISetupIncomplete,
    checkOnlyofficeAISetup,
  } = useModelForm(initialValues);

  useEffect(() => {
    fetchModels(
      initialValues.provider as ProviderType,
      initialValues.apiKey,
      initialValues.baseUrl,
      {
        keepModelIfExists: true,
        isCloudProvider: profile.isCloudProvider,
      }
    );
    if (initialValues.provider === "onlyoffice" || profile.isCloudProvider) {
      checkOnlyofficeAISetup(initialValues.baseUrl, initialValues.apiKey);
    }
  }, [
    fetchModels,
    checkOnlyofficeAISetup,
    initialValues.baseUrl,
    initialValues.apiKey,
    initialValues.provider,
    profile.isCloudProvider,
  ]);

  const handleSave = async () => {
    const hasChanges = (
      Object.keys(initialValues) as (keyof ModelFormValues)[]
    ).some((key) => values[key] !== initialValues[key]);

    if (!hasChanges) {
      onClose();
      return;
    }

    setIsLoading(true);
    setErrors({});

    const selectedModel = models.find((m) => m.id === values.model);

    const result = await editProfile({
      ...profile,
      name: values.profileName,
      providerType: values.provider as ProviderType,
      baseUrl: values.baseUrl,
      key: values.apiKey || undefined,
      modelId: values.model,
      capabilities: selectedModel?.capabilities ?? profile.capabilities,
      isCloudProvider: values.isCloudProvider,
    });

    setIsLoading(false);

    if (result === true) {
      onClose();
    } else if (result && typeof result === "object") {
      setErrors({ [result.field]: result.message });
    }
  };

  return (
    <ModelCardShell>
      <h3 className="select-none text-[15px] font-bold leading-[20px] text-[var(--text-normal)] mb-[12px]">
        {t("EditAIModel")}
      </h3>

      <div className="flex flex-row items-center gap-[12px] mb-[16px]">
        <ProviderLogo providerType={values.provider as ProviderType} />
        <p className="text-[14px] leading-[20px] text-[var(--text-normal)] truncate">
          {values.profileName}
        </p>
      </div>

      <ModelConfigForm
        values={values}
        onChange={handleChange}
        models={models}
        errors={errors}
        isHorizontal={isHorizontal}
        isOnlyofficeAISetupIncomplete={isOnlyofficeAISetupIncomplete}
      />

      <div className="flex flex-row justify-between items-center">
        <Button variant="default" onClick={onDelete}>
          <Icon name="btn-remove" size={24} />
          {t("Delete")}
        </Button>
        <div className="flex flex-row gap-[12px]">
          <Button variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button disabled={!isFormValid} onClick={handleSave}>
            {t("SaveChanges")}
          </Button>
        </div>
      </div>
    </ModelCardShell>
  );
};
