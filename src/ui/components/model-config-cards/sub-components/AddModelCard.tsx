import type { MouseEvent } from "react";
import { useState } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useStores } from "../../../store/context";
import type { ProviderType } from "../../../../types";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useWidgetConfig } from "../../../../widget-config";
import { Tooltip, TooltipTrigger } from "../../tooltip";
import { useModelForm } from "../hooks/useModelForm";
import { ModelCardShell } from "./ModelCardShell";
import { ModelConfigForm, type ModelFormValues } from "./ModelConfigForm";

const INITIAL_VALUES: ModelFormValues = {
  provider: "",
  apiKey: "",
  baseUrl: "",
  model: "",
  profileName: "",
};

interface AddModelCardProps {
  variant?: "card" | "standalone";
  onClose?: () => void;
  onSuccess?: () => void;
  isHorizontal?: boolean;
}

export const AddModelCard = ({
  variant = "card",
  onClose,
  onSuccess,
  isHorizontal,
}: AddModelCardProps) => {
  const { Button, IconButton, Link, TooltipContent } = useComponents();
  const { t } = useI18n();
  const { useProfilesStore } = useStores();
  const addProfile = useProfilesStore((s) => s.addProfile);
  const {
    onProfileImportClick,
    onDownloadTemplate,
    aboutButtonSize = 20,
  } = useWidgetConfig();
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    values,
    setValues,
    models,
    setModels,
    setIsLoading,
    errors,
    setErrors,
    isFormValid,
    fetchModels,
    handleChange,
    isOnlyofficeAISetupIncomplete,
  } = useModelForm(INITIAL_VALUES);

  const handleImportClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (!onProfileImportClick) return;
    const result = await onProfileImportClick();
    if (!result) return;
    const merged = { ...values, ...result };
    setValues(merged);
    setErrors({});
    if (merged.provider && merged.baseUrl) {
      fetchModels(
        merged.provider as ProviderType,
        merged.apiKey,
        merged.baseUrl,
        {
          keepModelIfExists: true,
          isCloudProvider: merged.isCloudProvider,
        }
      );
    }
  };

  const handleAdd = async () => {
    setIsLoading(true);
    setIsSubmitting(true);
    setErrors({});

    const selectedModel = models.find((m) => m.id === values.model);

    // The store normalizes failures to TErrorData, but keep a hard
    // guarantee here regardless: whatever happens inside the await, the
    // spinner must never be left running.
    let result: Awaited<ReturnType<typeof addProfile>>;
    try {
      result = await addProfile({
        name: values.profileName,
        providerType: values.provider as ProviderType,
        baseUrl: values.baseUrl,
        key: values.apiKey || undefined,
        modelId: values.model,
        capabilities: selectedModel?.capabilities,
        isCloudProvider: values.isCloudProvider,
      });
    } catch (e) {
      setErrors({ name: e instanceof Error ? e.message : String(e) });
      return;
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }

    if (result === true) {
      setValues(INITIAL_VALUES);
      setModels([]);
      onSuccess?.();
      onClose?.();
    } else if (result && typeof result === "object") {
      setErrors({ [result.field]: result.message });
    }
  };

  // The import link + hint tooltip used to sit in the footer; they now live
  // in the Provider field's action slot (mirroring "Get API key"), threaded
  // into ModelConfigForm. Rendered only when the host supplies an import
  // handler; inside the form the ONLYOFFICE AI Settings link takes
  // precedence over it. Behaviour is unchanged.
  const importAction = onProfileImportClick ? (
    <div className="flex flex-row items-center gap-[var(--add-model-card-import-gap,4px)]">
      <Link
        href="#"
        onClick={handleImportClick}
        className="!text-[var(--link-secondary-color)] no-underline"
      >
        {t("Import")}
      </Link>
      <Tooltip open={isTooltipOpen}>
        <TooltipTrigger asChild>
          <IconButton
            className="cursor-pointer"
            iconName="btn-menu-about"
            size={aboutButtonSize}
            disableHover
            noColor
            onClick={() => setIsTooltipOpen((val) => !val)}
          />
        </TooltipTrigger>
        <TooltipContent
          className="p-[var(--add-model-card-tooltip-padding,12px)]"
          side="bottom"
          isAbout
          align="start"
        >
          <div className="flex flex-col gap-[var(--add-model-card-tooltip-gap,6px)] max-w-[var(--add-model-card-tooltip-max-width,221px)]">
            <p className="leading-[var(--lh-16)] select-none">
              {t("EnterModelConfigTooltip")}
            </p>
            <Link
              variant="primary"
              href="#"
              className="leading-[var(--lh-16)]"
              onClick={
                onDownloadTemplate
                  ? (e) => {
                      e.preventDefault();
                      onDownloadTemplate();
                    }
                  : undefined
              }
            >
              {t("DownloadTemplate")}
            </Link>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  ) : undefined;

  const footer = (
    <div className="flex flex-row justify-end items-center gap-[var(--add-model-card-footer-gap,12px)] mt-[var(--add-model-card-footer-margin-top,0px)]">
      {variant === "card" && (
        <Button variant="default" onClick={onClose}>
          {t("Cancel")}
        </Button>
      )}
      <Button
        disabled={!isFormValid}
        isLoading={isSubmitting}
        onClick={handleAdd}
      >
        {t("AddModel")}
      </Button>
    </div>
  );

  if (variant === "standalone") {
    return (
      <div className="flex flex-col gap-[var(--add-model-card-gap,8px)]">
        <h3 className="select-none text-[length:var(--add-model-card-title-font-size-standalone,var(--fs-13,13px))] font-bold leading-[var(--lh-16)] text-[var(--text-normal)] [text-align:var(--add-model-card-title-align-standalone,start)]">
          {t("ConnectAIModelToEnableChat")}
        </h3>

        <ModelConfigForm
          values={values}
          onChange={handleChange}
          models={models}
          errors={errors}
          isHorizontal={isHorizontal}
          isOnlyofficeAISetupIncomplete={isOnlyofficeAISetupIncomplete}
          importAction={importAction}
        />

        {footer}
      </div>
    );
  }

  return (
    <ModelCardShell>
      <h3 className="select-none font-bold text-[length:var(--add-model-card-title-font-size-card,var(--fs-12,12px))] text-[var(--text-normal)] mb-[var(--add-model-card-title-margin-bottom,8px)] [text-align:var(--add-model-card-title-align-card,start)]">
        {t("ConnectNewAIModel")}
      </h3>

      <ModelConfigForm
        values={values}
        onChange={handleChange}
        models={models}
        errors={errors}
        isHorizontal={isHorizontal}
        isOnlyofficeAISetupIncomplete={isOnlyofficeAISetupIncomplete}
        importAction={importAction}
      />

      {footer}
    </ModelCardShell>
  );
};
