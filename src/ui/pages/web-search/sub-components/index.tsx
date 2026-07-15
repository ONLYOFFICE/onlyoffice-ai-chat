import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useToolsContext } from "../../../tools/context";
import { getApiKeyLink } from "../../../../shared/api-key-links";
import { cn } from "../../../../shared/utils";
import { useStores } from "../../../store/context";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useWidgetConfig } from "../../../../widget-config";

type WebSearchProps = {
  variant?: "tab" | "page";
  isHorizontal?: boolean;
  saveMode?: "blur" | "button";
};

type WebSearchProvider = {
  id: string;
  label: string;
  baseUrl?: string;
  key?: string;
  isCloudProvider?: boolean;
};

type WebSearchData = {
  provider: string;
  key: string;
  baseUrl?: string;
  isCloudProvider?: boolean;
};

const WEB_SEARCH_PROVIDERS: WebSearchProvider[] = [
  { id: "Exa", label: "Exa", baseUrl: "https://api.exa.ai" },
];

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const configsEqual = (a: WebSearchData | null, b: WebSearchData | null) =>
  JSON.stringify(a) === JSON.stringify(b);

const WebSearch = ({
  variant = "tab",
  isHorizontal,
  saveMode: saveModeProp,
}: WebSearchProps) => {
  const { ComboBox, FieldContainer, Input, Link, Button } = useComponents();
  const { t } = useI18n();
  const { eventBus } = useToolsContext();
  const { useCloudsStore, api, callbacksManager } = useStores();
  const { entityId, webSearchSaveMode } = useWidgetConfig();

  const saveMode = saveModeProp ?? webSearchSaveMode ?? "blur";
  const isButtonMode = saveMode === "button";
  const cloudProviders = useCloudsStore((s) => s.cloudProviders);
  const hiddenWebSearchProviders = useCloudsStore(
    (s) => s.hiddenWebSearchProviders
  );
  const hiddenWebSearchSet = React.useMemo(
    () => new Set<string>(hiddenWebSearchProviders ?? []),
    [hiddenWebSearchProviders]
  );

  // `syncFromStorage` still overrides this from storage when the user has an
  // earlier saved choice.
  const [selectedId, setSelectedId] = React.useState<string>("Exa");
  const [apiKey, setApiKey] = React.useState<string>("");
  const [baseUrl, setBaseUrl] = React.useState<string>("");
  const [baseUrlError, setBaseUrlError] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);

  // Track the last-persisted shape so the `web-search-changed` listener can
  // skip its sync-from-storage when the change originates from this same
  // form (and detect what actually changed for the host callback).
  const lastPersistedRef = React.useRef<WebSearchData | null>(null);
  const selfInitiatedRef = React.useRef(false);

  const persist = React.useCallback(
    async (data: WebSearchData | null) => {
      const changed = !configsEqual(lastPersistedRef.current, data);
      lastPersistedRef.current = data;
      selfInitiatedRef.current = true;
      if (data) {
        await api.webSearch.setActiveConfig(data, entityId);
      } else {
        await api.webSearch.clear(entityId);
      }
      eventBus.emit("web-search-changed");
      const event = {
        enabled: !!data,
        provider: data?.provider ?? null,
        isCloudProvider: data?.isCloudProvider,
      };
      if (changed) callbacksManager.emit("onWebSearchUpdated", event);
      callbacksManager.emit("onWebSearchSaved", event);
    },
    [api, callbacksManager, eventBus, entityId]
  );

  const allProviders = React.useMemo<WebSearchProvider[]>(
    () => [
      ...cloudProviders.map((cp) => ({
        id: cp.url,
        label: cp.label,
        baseUrl: cp.url,
        key: cp.apiKey,
        isCloudProvider: true,
      })),
      ...WEB_SEARCH_PROVIDERS.filter((p) => !hiddenWebSearchSet.has(p.id)),
    ],
    [cloudProviders, hiddenWebSearchSet]
  );

  const provider = allProviders.find((p) => p.id === selectedId);

  React.useEffect(() => {
    let cancelled = false;
    const syncFromStorage = async () => {
      if (selfInitiatedRef.current) {
        selfInitiatedRef.current = false;
        return;
      }
      const data = (await api.webSearch.getActiveConfig(
        entityId
      )) as WebSearchData | null;
      if (cancelled) return;
      lastPersistedRef.current = data;
      if (data) {
        setSelectedId(data.provider);
        setApiKey(data.key);
        setBaseUrl(data.baseUrl ?? "");
      } else {
        // External clear (e.g. host sync) — drop credentials so the input
        // reflects reality, but keep the dropdown selection intact.
        setApiKey("");
        setBaseUrl("");
      }
      setBaseUrlError("");
    };

    syncFromStorage();
    eventBus.on("web-search-changed", syncFromStorage);
    return () => {
      cancelled = true;
      eventBus.off("web-search-changed", syncFromStorage);
    };
  }, [api, eventBus, entityId]);

  // The config the current form state would persist, or `null` when there is
  // nothing valid to save (missing API key, or an invalid manual base URL).
  const buildConfig = (desc: WebSearchProvider): WebSearchData | null => {
    if (!desc.baseUrl && !isValidUrl(baseUrl)) return null;
    if (!apiKey) return null;
    return {
      provider: desc.id,
      key: apiKey,
      baseUrl: desc.baseUrl ?? baseUrl,
      isCloudProvider: desc.isCloudProvider,
    };
  };

  const saveData = (desc: WebSearchProvider) => persist(buildConfig(desc));

  const handleSelect = (selected: WebSearchProvider) => {
    setSelectedId(selected.id);
    setApiKey(selected.key ?? "");
    setBaseUrl("");
    setBaseUrlError("");

    // In button mode selecting a provider only updates local state; the
    // explicit Save button performs the write (even for cloud providers).
    if (selected.isCloudProvider && !isButtonMode) {
      void persist({
        provider: selected.id,
        key: selected.key ?? "",
        baseUrl: selected.baseUrl ?? "",
        isCloudProvider: true,
      });
    }
  };

  // Validate the manual base URL and surface the error message. Returns
  // whether it is currently valid.
  const validateBaseUrl = () => {
    const valid = isValidUrl(baseUrl);
    setBaseUrlError(valid ? "" : t("InvalidUrl"));
    return valid;
  };

  const saveProvider = () => {
    if (provider) void saveData(provider);
  };

  // Blur-driven autosave persists in blur mode only; in button mode the Save
  // button owns persistence (blur then just validates the base URL).
  const handleApiKeyBlur = () => {
    if (!isButtonMode) saveProvider();
  };

  const handleBaseUrlBlur = () => {
    if (!validateBaseUrl() || isButtonMode) return;
    saveProvider();
  };

  const handleSave = async () => {
    // Only providers with a manually entered base URL need URL validation.
    if (!provider || (!provider.baseUrl && !validateBaseUrl())) return;
    setIsSaving(true);
    try {
      await saveData(provider);
    } finally {
      setIsSaving(false);
    }
  };

  // Clears the persisted web-search config and restores the form to its
  // defaults (provider back to the first built-in engine, empty credentials).
  const handleReset = async () => {
    setIsResetting(true);
    try {
      await persist(null);
    } finally {
      setIsResetting(false);
    }
    setSelectedId("Exa");
    setApiKey("");
    setBaseUrl("");
    setBaseUrlError("");
  };

  const isPage = variant === "page";
  const fieldIsHorizontal = isHorizontal ?? isPage;

  const comboItems = allProviders.map((p) => ({
    text: p.label,
    id: p.id,
    onClick: () => handleSelect(p),
  }));

  const candidateData = provider ? buildConfig(provider) : null;
  const isDirty = !configsEqual(candidateData, lastPersistedRef.current);
  // There is something to reset when a config is already saved or the form
  // currently holds any credentials.
  const canReset = !!lastPersistedRef.current || !!apiKey || !!baseUrl;

  return (
    <div
      className={cn(
        "web-search-root flex flex-col w-full",
        isPage ? "gap-[8px]" : "gap-[16px]"
      )}
    >
      <p
        className={cn(
          "font-normal leading-[var(--lh-16)] text-[var(--settings-description-color)]"
        )}
      >
        {t("WebSearchDescription")}
      </p>
      <div className="web-search-fields flex flex-col gap-[8px]">
        <FieldContainer
          header={t("WebSearchEngine")}
          headerClassName="web-search-field-header"
          isHorizontal={fieldIsHorizontal}
        >
          <ComboBox
            className="w-full"
            value={provider?.label ?? t("SelectEngine")}
            items={comboItems}
          />
        </FieldContainer>
        {!provider?.baseUrl && (
          <FieldContainer
            header={t("BaseURL")}
            headerClassName="web-search-field-header"
            isHorizontal={fieldIsHorizontal}
            error={baseUrlError}
          >
            <Input
              className="w-full"
              placeholder={t("EnterURL")}
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setBaseUrlError("");
              }}
              onBlur={handleBaseUrlBlur}
            />
          </FieldContainer>
        )}
        {!provider?.isCloudProvider && (
          <FieldContainer
            header={t("APIKey")}
            headerClassName="web-search-field-header"
            isHorizontal={fieldIsHorizontal}
            action={
              getApiKeyLink(selectedId) ? (
                <Link
                  href={getApiKeyLink(selectedId)}
                  target="_blank"
                  className="!text-[var(--link-secondary-color)]"
                >
                  {t("GetAPIKey")}
                </Link>
              ) : undefined
            }
          >
            <Input
              className="w-full"
              type="password"
              placeholder={t("EnterKey")}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onBlur={handleApiKeyBlur}
              disabled={!selectedId}
            />
          </FieldContainer>
        )}
      </div>
      {isButtonMode && (
        <div className="web-search-actions flex gap-[8px]">
          <Button
            className="web-search-save-button"
            onClick={() => void handleSave()}
            isLoading={isSaving}
            disabled={!provider || !isDirty || isResetting}
          >
            {t("Save")}
          </Button>
          <Button
            className="web-search-reset-button"
            variant="default"
            onClick={() => void handleReset()}
            isLoading={isResetting}
            disabled={isSaving || !canReset}
          >
            {t("ResetSettings")}
          </Button>
        </div>
      )}
    </div>
  );
};

export { WebSearch };
