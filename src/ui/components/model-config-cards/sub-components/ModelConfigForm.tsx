import { useState, type ReactNode } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { getApiKeyLink } from "../../../../shared/api-key-links";
import { useStores } from "../../../store/context";
import {
  getProviderMetadata,
  getSupportedProviderTypes,
} from "../../../../core/providers";
import type { Model, ProviderType } from "../../../../types";
import { useComponents } from "../../../providers/ComponentsProvider";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../tooltip";
import { CapabilitiesUI } from "../../../../capabilities";
import { Icon } from "../../icon";

const MODEL_CAPABILITY_ICONS: Array<{ flag: number; name: string }> = [
  { flag: CapabilitiesUI.Image, name: "image-generation" },
  { flag: CapabilitiesUI.Vision, name: "vision-ai" },
  { flag: CapabilitiesUI.Tools, name: "tools" },
];

const ModelCapabilityIcons = ({ model }: { model: Model }) => {
  const caps = model.capabilities ?? 0;
  const icons = MODEL_CAPABILITY_ICONS.filter(
    ({ flag }) => (caps & flag) !== 0
  ).map(({ name }) => name);
  if (model.reasoning) icons.push("btn-extended-thinking");
  if (!icons.length) return null;
  return (
    <div className="flex items-center gap-[var(--model-config-form-capability-gap,2px)] shrink-0 opacity-60">
      {icons.map((name) => (
        <Icon key={name} name={name} size={14} />
      ))}
    </div>
  );
};

export interface ModelFormValues {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  profileName: string;
  isCloudProvider?: boolean;
}

export type ModelFormErrors = Partial<Record<"key" | "url" | "name", string>>;

export type ProviderSelection = {
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
  isCloudProvider?: boolean;
};

interface ModelConfigFormProps {
  values: ModelFormValues;
  onChange: (
    field: keyof ModelFormValues,
    value: string | ProviderSelection
  ) => void;
  models: Model[];
  errors?: ModelFormErrors;
  isHorizontal?: boolean;
  /**
   * `true` once the wallet-service probe has completed for the current
   * baseUrl (apiKey is optional — the portal endpoint also answers
   * anonymously) and reported that the `aitools` feature is not active.
   * Gates the "AI setup is incomplete" hint and the settings link in the
   * Provider field — both stay hidden until the probe has actually run.
   */
  isOnlyofficeAISetupIncomplete?: boolean;
  /**
   * Optional element rendered in the Provider field's action slot (the
   * import link + hint icon supplied by the Add flow). The ONLYOFFICE AI
   * Settings link takes precedence: when it is shown, `importAction` is not.
   */
  importAction?: ReactNode;
}

export const ModelConfigForm = ({
  values,
  onChange,
  models,
  errors,
  isHorizontal,
  isOnlyofficeAISetupIncomplete,
  importAction,
}: ModelConfigFormProps) => {
  const { Button, ComboBox, FieldContainer, Input, Link } = useComponents();
  const [isSetupTooltipOpen, setIsSetupTooltipOpen] = useState(false);
  const { t } = useI18n();
  const { useCloudsStore } = useStores();
  const cloudProviders = useCloudsStore((s) => s.cloudProviders);
  const externalOnlyofficeConfig = useCloudsStore(
    (s) => s.externalOnlyofficeConfig
  );
  const hiddenProviders = useCloudsStore((s) => s.hiddenProviders);
  const hiddenSet = new Set<ProviderType>(hiddenProviders ?? []);
  const providersInfo = getSupportedProviderTypes()
    .map((type) => {
      const meta = getProviderMetadata(type);
      if (!meta) return null;
      return {
        type,
        name: meta.name,
        baseUrl: meta.baseUrl,
      };
    })
    .filter(
      (p): p is { type: string; name: string; baseUrl: string } => p !== null
    )
    .filter((p) => !hiddenSet.has(p.type as ProviderType))
    // External profiles are host-managed (the transport lives in
    // PlatformAdapter.externalFetch and `basedOn` has no UI). Hide the
    // entry from the manual add-profile dropdown — hosts create these
    // profiles programmatically via `addProfile()`.
    .filter((p) => p.type !== "external")
    // ONLYOFFICE profiles are host-supplied via storage; they must resolve
    // and run when loaded, but users may not create one by hand.
    .filter((p) => p.type !== "onlyoffice");
  const isFieldsDisabled = !values.provider;

  const providerItems = [
    ...cloudProviders.map((cp) => ({
      text: cp.label,
      id: cp.url,
      onClick: () =>
        onChange("provider", {
          type: "onlyoffice" as ProviderType,
          baseUrl: cp.url,
          apiKey: cp.apiKey,
          isCloudProvider: true,
        }),
    })),
    ...providersInfo.map((p) => ({
      text: p.name,
      id: p.type,
      onClick: () => {
        if (p.type === "onlyoffice" && externalOnlyofficeConfig) {
          onChange("provider", {
            type: p.type as ProviderType,
            baseUrl: externalOnlyofficeConfig.baseUrl,
            apiKey: externalOnlyofficeConfig.apiKey ?? "",
          });
          return;
        }
        onChange("provider", {
          type: p.type as ProviderType,
          baseUrl: p.baseUrl,
        });
      },
    })),
  ];

  const selectedProviderText =
    (values.isCloudProvider && values.baseUrl
      ? new URL(values.baseUrl).hostname
      : undefined) ??
    providersInfo.find((p) => p.type === values.provider)?.name;

  const modelItems = [...models]
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    )
    .map((m) => ({
      text: m.name,
      id: m.id,
      onClick: () => onChange("model", m.id),
      trailingIcon: <ModelCapabilityIcons model={m} />,
    }));

  const isExternalOnlyoffice =
    values.provider === "onlyoffice" && !!externalOnlyofficeConfig;
  const hideCredentials = !!values.isCloudProvider || isExternalOnlyoffice;

  // The "AI setup is incomplete" hint and the companion settings link are
  // both gated on the ONLYOFFICE wallet-service probe: they only surface
  // after the probe has actually run (baseUrl is enough, apiKey optional —
  // the endpoint answers anonymously too) and reported the `aitools`
  // feature as not active. Until then — and when the feature returns
  // active — both stay hidden.
  const showOnlyofficeAISetupHint = !!isOnlyofficeAISetupIncomplete;

  const onlyofficeAISettingsHref = (() => {
    if (!showOnlyofficeAISetupHint || !values.baseUrl) return undefined;
    try {
      return `${new URL(values.baseUrl).origin}/portal-settings/payments/services/ai-services`;
    } catch {
      return undefined;
    }
  })();

  // Suppress the "AI setup is incomplete" text only while the API-Key field
  // is actually rendered AND already showing its own error ("Empty key"
  // etc.) — the two would stack and say essentially the same thing.
  // When credentials are hidden (cloud / external ONLYOFFICE config), the
  // API-Key error has nowhere to surface, so fall back to showing the
  // setup hint here. The settings link stays rendered either way.
  const providerError =
    showOnlyofficeAISetupHint && (hideCredentials || !errors?.key)
      ? t("AISetupIncomplete")
      : undefined;

  return (
    <div className="flex flex-col gap-[var(--model-config-form-gap,8px)]">
      <FieldContainer
        header={t("Provider")}
        isHorizontal={isHorizontal}
        reserveActionSpace
        className={
          isHorizontal
            ? "mb-[var(--model-config-form-field-margin-bottom,10px)]"
            : ""
        }
        error={providerError}
        action={
          onlyofficeAISettingsHref ? (
            <Tooltip open={isSetupTooltipOpen}>
              <TooltipTrigger asChild>
                <Link
                  // preventDefault + manual toggle: clicking opens the
                  // "Finish AI setup" popover instead of navigating. The
                  // href stays populated so right-click → "Open in new tab"
                  // still reaches the portal settings page.
                  href={onlyofficeAISettingsHref}
                  target="_blank"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsSetupTooltipOpen((v) => !v);
                  }}
                >
                  {t("OnlyofficeAISettings")}
                </Link>
              </TooltipTrigger>
              <TooltipContent
                className="p-[var(--model-config-form-tooltip-padding,16px)]"
                side="bottom"
                align="end"
                isAbout
              >
                <div className="flex flex-col gap-[var(--model-config-form-tooltip-gap,8px)] max-w-[var(--model-config-form-tooltip-max-width,280px)]">
                  <p className="font-bold text-[var(--text-normal)] select-none">
                    {t("FinishAISetup")}
                  </p>
                  <p className="text-[var(--text-normal)] select-none">
                    {t("FinishAISetupDescription")}
                  </p>
                  <Button
                    className="self-start"
                    onClick={() => {
                      setIsSetupTooltipOpen(false);
                      window.open(
                        onlyofficeAISettingsHref,
                        "_blank",
                        "noopener"
                      );
                    }}
                  >
                    {t("GoToAISettings")}
                  </Button>
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            importAction
          )
        }
      >
        <ComboBox
          className="w-full"
          placeholder={t("SelectProvider")}
          value={selectedProviderText}
          items={providerItems}
        />
      </FieldContainer>

      {!hideCredentials && (
        <FieldContainer
          className={
            isHorizontal
              ? "mb-[var(--model-config-form-field-margin-bottom,10px)]"
              : ""
          }
          header={t("APIKey")}
          isHorizontal={isHorizontal}
          reserveActionSpace
          action={
            getApiKeyLink(values.provider) ? (
              <Link
                href={getApiKeyLink(values.provider)}
                target="_blank"
                className="!text-[var(--link-secondary-color)]"
              >
                {t("GetAPIKey")}
              </Link>
            ) : undefined
          }
          error={errors?.key}
        >
          <Input
            name="key"
            placeholder={t("EnterKey")}
            className="w-full"
            type="password"
            disabled={isFieldsDisabled}
            onChange={(e) => onChange("apiKey", e.target.value)}
            value={values.apiKey}
          />
        </FieldContainer>
      )}

      {!hideCredentials && (
        <FieldContainer
          className={
            isHorizontal
              ? "mb-[var(--model-config-form-field-margin-bottom,10px)]"
              : ""
          }
          header={t("BaseURL")}
          isHorizontal={isHorizontal}
          reserveActionSpace
          error={errors?.url}
        >
          <Input
            name="url"
            placeholder={t("EnterURL")}
            className="w-full"
            disabled={isFieldsDisabled}
            onChange={(e) => onChange("baseUrl", e.target.value)}
            value={values.baseUrl}
          />
        </FieldContainer>
      )}

      <FieldContainer
        className={isHorizontal ? "mb-[10px]" : ""}
        header={t("Model")}
        isHorizontal={isHorizontal}
        reserveActionSpace
      >
        <ComboBox
          className="w-full"
          placeholder={t("SelectModel")}
          value={models.find((m) => m.id === values.model)?.name}
          // Locked (but still showing the current selection) while the
          // ONLYOFFICE wallet-service probe reports the `aitools` feature
          // as inactive — the user must finish the portal-side setup
          // before picking a different model.
          disabled={
            !values.provider || models.length === 0 || showOnlyofficeAISetupHint
          }
          searchable={models.length > 50}
          searchPlaceholder={t("Search")}
          items={modelItems}
        />
      </FieldContainer>

      <FieldContainer
        className={
          isHorizontal
            ? undefined
            : "mb-[var(--model-config-form-last-field-margin-bottom,8px)]"
        }
        header={t("ProfileName")}
        isHorizontal={isHorizontal}
        reserveActionSpace
        error={errors?.name}
      >
        <Input
          name="name"
          placeholder={t("EnterName")}
          className="w-full"
          disabled={isFieldsDisabled}
          onChange={(e) => onChange("profileName", e.target.value)}
          value={values.profileName}
        />
      </FieldContainer>
    </div>
  );
};
