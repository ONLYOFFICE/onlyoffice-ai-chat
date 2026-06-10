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

const WebSearch = ({ variant = "tab", isHorizontal }: WebSearchProps) => {
  const { ComboBox, FieldContainer, Input, Link } = useComponents();
  const { t, isRTL } = useI18n();
  const { eventBus } = useToolsContext();
  const { useCloudsStore, api, callbacksManager } = useStores();
  const { entityId } = useWidgetConfig();
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

  // Track the last-persisted shape so the `web-search-changed` listener can
  // skip its sync-from-storage when the change originates from this same
  // form (and detect what actually changed for the host callback).
  const lastPersistedRef = React.useRef<WebSearchData | null>(null);
  const selfInitiatedRef = React.useRef(false);

  const persist = React.useCallback(
    async (data: WebSearchData | null) => {
      const previous = lastPersistedRef.current;
      const changed = JSON.stringify(previous) !== JSON.stringify(data);
      lastPersistedRef.current = data;
      selfInitiatedRef.current = true;
      if (data) {
        await api.webSearch.setActiveConfig(data, entityId);
      } else {
        await api.webSearch.clear(entityId);
      }
      eventBus.emit("web-search-changed");
      if (changed) {
        callbacksManager.emit("onWebSearchUpdated", {
          enabled: !!data,
          provider: data?.provider ?? null,
          isCloudProvider: data?.isCloudProvider,
        });
      }
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

  const saveData = (desc: WebSearchProvider) => {
    const resolvedUrl = desc.baseUrl ?? baseUrl;

    if (!desc.baseUrl) {
      try {
        new URL(baseUrl);
      } catch {
        void persist(null);
        return;
      }
    }

    if (apiKey) {
      void persist({
        provider: desc.id,
        key: apiKey,
        baseUrl: resolvedUrl,
      });
    } else {
      void persist(null);
    }
  };

  const handleSelect = (selected: WebSearchProvider) => {
    setSelectedId(selected.id);
    setApiKey(selected.key ?? "");
    setBaseUrl("");
    setBaseUrlError("");

    if (selected.isCloudProvider) {
      void persist({
        provider: selected.id,
        key: selected.key ?? "",
        baseUrl: selected.baseUrl ?? "",
        isCloudProvider: true,
      });
    }
  };

  const handleBaseUrlBlur = () => {
    if (!provider) return;
    try {
      new URL(baseUrl);
      setBaseUrlError("");
    } catch {
      setBaseUrlError(t("InvalidUrl"));
    }
    saveData(provider);
  };

  const handleApiKeyBlur = () => {
    if (!provider) return;
    saveData(provider);
  };

  const isPage = variant === "page";
  const fieldIsHorizontal = isHorizontal ?? isPage;

  const comboItems = allProviders.map((p) => ({
    text: p.label,
    id: p.id,
    onClick: () => handleSelect(p),
  }));

  return (
    <div
      className={cn(
        "flex flex-col w-full",
        isPage ? "gap-[8px]" : "gap-[16px]"
      )}
    >
      <p
        className={cn(
          "font-normal leading-[16px] text-[var(--settings-description-color)]",
          isRTL ? "text-end" : ""
        )}
      >
        {t("WebSearchDescription")}
      </p>
      <div className="flex flex-col gap-[8px]">
        <FieldContainer
          header={t("WebSearchEngine")}
          isHorizontal={fieldIsHorizontal}
        >
          <ComboBox
            className="w-full h-[24px]"
            value={provider?.label ?? t("SelectEngine")}
            items={comboItems}
          />
        </FieldContainer>
        {!provider?.baseUrl && (
          <FieldContainer
            header={t("BaseURL")}
            isHorizontal={fieldIsHorizontal}
            error={baseUrlError}
          >
            <Input
              className="w-full h-[24px]"
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
            isHorizontal={fieldIsHorizontal}
            action={
              getApiKeyLink(selectedId) ? (
                <Link href={getApiKeyLink(selectedId)} target="_blank">
                  {t("GetAPIKey")}
                </Link>
              ) : undefined
            }
          >
            <Input
              className="w-full h-[24px]"
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
    </div>
  );
};

export { WebSearch };
