import React from "react";
import { useI18n } from "../../../locales";
import { useToolsContext } from "../../../tools/context";
import { getApiKeyLink } from "../../../lib/api-key-links";
import { cn } from "../../../lib/utils";
import { useStores } from "../../../store/context";
import { useComponents } from "../../../components-provider";

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
  const { cloudProviders, externalOnlyofficeConfig } = useCloudsStore();

  const [selectedId, setSelectedId] = React.useState<string>("Exa");
  const [apiKey, setApiKey] = React.useState<string>("");
  const [baseUrl, setBaseUrl] = React.useState<string>("");
  const [baseUrlError, setBaseUrlError] = React.useState<string>("");

  const allProviders = React.useMemo<WebSearchProvider[]>(
    () => [
      ...cloudProviders.map((cp) => ({
        id: cp.url,
        label: cp.label,
        baseUrl: cp.url,
        key: cp.apiKey,
        isCloudProvider: true,
      })),
      ...WEB_SEARCH_PROVIDERS.map((p) => {
        if (p.id === "ONLYOFFICE" && externalOnlyofficeConfig) {
          return {
            ...p,
            baseUrl: externalOnlyofficeConfig.baseUrl,
            key: externalOnlyofficeConfig.apiKey,
            isCloudProvider: true,
          };
        }
        return p;
      }),
    ],
    [cloudProviders, externalOnlyofficeConfig]
  );

  const provider = allProviders.find((p) => p.id === selectedId);

  React.useEffect(() => {
    const syncFromInstance = () => {
      const data = serversInstance.getWebSearchData();
      if (data) {
        setSelectedId(data.provider);
        setApiKey(data.key);
        setBaseUrl(data.baseUrl ?? "");
      } else {
        setSelectedId("Exa");
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
        serversInstance.setWebSearchData(null);
        return;
      }
    }

    if (apiKey) {
      serversInstance.setWebSearchData({
        provider: desc.id,
        key: apiKey,
        baseUrl: resolvedUrl,
      });
    } else {
      serversInstance.setWebSearchData(null);
    }
  };

  const handleSelect = (selected: WebSearchProvider) => {
    setSelectedId(selected.id);
    setApiKey(selected.key ?? "");
    setBaseUrl("");
    setBaseUrlError("");

    if (selected.isCloudProvider) {
      serversInstance.setWebSearchData({
        provider: selected.id,
        key: selected.key ?? "",
        baseUrl: selected.baseUrl ?? "",
        isCloudProvider: true,
      });
    } else {
      serversInstance.setWebSearchData(null);
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
        <FieldContainer header={t("WebSearchEngine")} isHorizontal={fieldIsHorizontal}>
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
