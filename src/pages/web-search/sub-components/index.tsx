import React from "react";
import { useI18n } from "../../../ui/providers/LocalesProvider";
import { useToolsContext } from "../../../tools/context";
import { getApiKeyLink } from "../../../shared/api-key-links";
import { cn } from "../../../shared/utils";
import { useStores } from "../../../store/context";
import { useComponents } from "../../../ui/providers/ComponentsProvider";

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

const WEB_SEARCH_PROVIDERS: WebSearchProvider[] = [
  { id: "Exa", label: "Exa", baseUrl: "https://api.exa.ai" },
  { id: "ONLYOFFICE", label: "ONLYOFFICE AI" },
];

const WebSearch = ({ variant = "tab", isHorizontal }: WebSearchProps) => {
  const { ComboBox, FieldContainer, Input, Link } = useComponents();
  const { t, isRTL } = useI18n();
  const { servers: serversInstance, eventBus } = useToolsContext();
  const { useCloudsStore } = useStores();
  const { cloudProviders, externalOnlyofficeConfig, hiddenWebSearchProviders } =
    useCloudsStore();
  const hiddenWebSearchSet = React.useMemo(
    () => new Set<string>(hiddenWebSearchProviders ?? []),
    [hiddenWebSearchProviders]
  );

  // When the host passes an `onlyofficeConfig`, default to the preconfigured
  // ONLYOFFICE entry instead of Exa — otherwise the user would land on Exa
  // with its empty credentials and have to click through to ONLYOFFICE to
  // see the preset take effect. `syncFromInstance` still overrides this
  // from storage when the user has an earlier saved choice.
  const [selectedId, setSelectedId] = React.useState<string>(() =>
    externalOnlyofficeConfig ? "ONLYOFFICE" : "Exa"
  );
  const [apiKey, setApiKey] = React.useState<string>("");
  const [baseUrl, setBaseUrl] = React.useState<string>("");
  const [baseUrlError, setBaseUrlError] = React.useState<string>("");

  // Skip the `web-search-changed` sync for events we ourselves caused —
  // otherwise saving a partially-filled form (blur with empty key, invalid
  // URL, etc.) would write null to storage, fire the event, and our own
  // listener would wipe whatever the user just typed.
  const selfInitiatedRef = React.useRef(false);
  const writeWebSearchData = React.useCallback(
    (data: Parameters<typeof serversInstance.setWebSearchData>[0]) => {
      selfInitiatedRef.current = true;
      serversInstance.setWebSearchData(data);
    },
    [serversInstance]
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
      ...WEB_SEARCH_PROVIDERS.filter((p) => !hiddenWebSearchSet.has(p.id)).map(
        (p) => {
          if (p.id === "ONLYOFFICE" && externalOnlyofficeConfig) {
            return {
              ...p,
              baseUrl: externalOnlyofficeConfig.baseUrl,
              key: externalOnlyofficeConfig.apiKey,
              isCloudProvider: true,
            };
          }
          return p;
        }
      ),
    ],
    [cloudProviders, externalOnlyofficeConfig, hiddenWebSearchSet]
  );

  const provider = allProviders.find((p) => p.id === selectedId);

  React.useEffect(() => {
    const syncFromInstance = () => {
      if (selfInitiatedRef.current) {
        selfInitiatedRef.current = false;
        return;
      }
      const data = serversInstance.getWebSearchData();
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

    syncFromInstance();
    eventBus.on("web-search-changed", syncFromInstance);
    return () => {
      eventBus.off("web-search-changed", syncFromInstance);
    };
  }, [serversInstance, eventBus]);

  const saveData = (desc: WebSearchProvider) => {
    const resolvedUrl = desc.baseUrl ?? baseUrl;

    if (!desc.baseUrl) {
      try {
        new URL(baseUrl);
      } catch {
        writeWebSearchData(null);
        return;
      }
    }

    if (apiKey) {
      writeWebSearchData({
        provider: desc.id,
        key: apiKey,
        baseUrl: resolvedUrl,
      });
    } else {
      writeWebSearchData(null);
    }
  };

  const handleSelect = (selected: WebSearchProvider) => {
    setSelectedId(selected.id);
    setApiKey(selected.key ?? "");
    setBaseUrl("");
    setBaseUrlError("");

    if (selected.isCloudProvider) {
      writeWebSearchData({
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
        isPage ? "gap-[24px]" : "gap-[16px]"
      )}
    >
      <p
        className={cn(
          "font-normal text-[14px] leading-[20px] text-[var(--servers-description-color)]",
          isRTL ? "text-end" : ""
        )}
      >
        {t("WebSearchDescription")}
      </p>
      <div className="flex flex-col gap-[16px]">
        <FieldContainer
          header={t("WebSearchEngine")}
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
    </div>
  );
};

export { WebSearch };
