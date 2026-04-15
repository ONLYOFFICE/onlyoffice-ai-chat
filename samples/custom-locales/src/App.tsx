import { useEffect, useMemo, useState } from "react";
import { AIChatWidget } from "@onlyoffice/ai-chat";
import type { StorageAdapter, Translations } from "@onlyoffice/ai-chat";

import "@onlyoffice/ai-chat/styles";
import "./styles.css";

import { settings } from "./adapters/settings";
import { createStorage } from "./adapters/storage";
import { platform } from "./adapters/platform";
import { storeKeys } from "./store-keys";
import { customEn } from "./custom-en";
import { locales, CUSTOM_LOCALE_ID } from "./locales";
import { useResize } from "./useResize";

const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const theme = isDark
  ? { id: "theme-night", bg: "#404040", border: "#6b6b6b", text: "#e0e0e0" }
  : { id: "theme-white", bg: "#ffffff", border: "#b0b0b0", text: "#333333" };

const colors = isDark
  ? {
      sidebarBg: "#333333",
      itemBg: "transparent",
      itemActiveBg: "#4a4a4a",
      itemHoverBg: "#3d3d3d",
      tabBorder: "#555",
      tabActiveBorder: "#8ab4f8",
      valueBg: "#3a3a3a",
      labelText: "#aaa",
    }
  : {
      sidebarBg: "#f5f5f5",
      itemBg: "transparent",
      itemActiveBg: "#e0e0e0",
      itemHoverBg: "#eaeaea",
      tabBorder: "#ddd",
      tabActiveBorder: "#1a73e8",
      valueBg: "#e8e8e8",
      labelText: "#666",
    };

document.documentElement.style.backgroundColor = theme.bg;
document.documentElement.style.color = theme.text;

type Tab = "locales" | "keys";

const translationKeys = Object.keys(customEn) as (keyof Translations)[];

export function App() {
  const [storage, setStorage] = useState<StorageAdapter | null>(null);
  const [activeLocale, setActiveLocale] = useState(CUSTOM_LOCALE_ID);
  const { width: widgetWidth, onMouseDown } = useResize(520);
  const [activeTab, setActiveTab] = useState<Tab>("keys");

  const isCustom = activeLocale === CUSTOM_LOCALE_ID;

  useEffect(() => {
    createStorage().then(setStorage);
  }, []);

  useEffect(() => {
    if (!isCustom && activeTab === "keys") {
      setActiveTab("locales");
    }
  }, [isCustom, activeTab]);

  const widgetLocale = isCustom ? "en" : activeLocale;
  const widgetTranslations = useMemo<Partial<Translations> | undefined>(
    () => (isCustom ? customEn : undefined),
    [isCustom]
  );

  if (!storage) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div className="app">
      <div className="sidebar" style={{ backgroundColor: colors.sidebarBg }}>
        {isCustom && (
          <div
            className="sidebar-tabs"
            style={{ borderColor: colors.tabBorder }}
          >
            <button
              className={`sidebar-tab ${activeTab === "locales" ? "active" : ""}`}
              style={{
                backgroundColor: colors.sidebarBg,
                color: theme.text,
                borderBottomColor:
                  activeTab === "locales"
                    ? colors.tabActiveBorder
                    : "transparent",
              }}
              onClick={() => setActiveTab("locales")}
            >
              Locales ({locales.length})
            </button>
            <button
              className={`sidebar-tab ${activeTab === "keys" ? "active" : ""}`}
              style={{
                backgroundColor: colors.sidebarBg,
                color: theme.text,
                borderBottomColor:
                  activeTab === "keys" ? colors.tabActiveBorder : "transparent",
              }}
              onClick={() => setActiveTab("keys")}
            >
              Keys ({translationKeys.length})
            </button>
          </div>
        )}

        {activeTab === "locales" || !isCustom ? (
          <div className="locale-list">
            {locales.map((loc) => (
              <button
                key={loc.code}
                className={`locale-item ${activeLocale === loc.code ? "active" : ""}`}
                style={{
                  backgroundColor:
                    activeLocale === loc.code
                      ? colors.itemActiveBg
                      : colors.itemBg,
                  color: theme.text,
                }}
                onMouseEnter={(e) => {
                  if (activeLocale !== loc.code)
                    e.currentTarget.style.backgroundColor = colors.itemHoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    activeLocale === loc.code
                      ? colors.itemActiveBg
                      : colors.itemBg;
                }}
                onClick={() => setActiveLocale(loc.code)}
              >
                {loc.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="key-editor">
            {translationKeys.map((key) => (
              <div className="key-row" key={key}>
                <div className="key-label" style={{ color: colors.labelText }}>
                  {key}
                </div>
                <span
                  className="key-value"
                  style={{
                    backgroundColor: colors.valueBg,
                    color: theme.text,
                  }}
                >
                  {customEn[key]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="widget-area"
        style={{ width: widgetWidth, borderColor: theme.border }}
      >
        <AIChatWidget
          storage={storage}
          settings={settings}
          platform={platform}
          storeKeys={storeKeys}
          locale={widgetLocale}
          translations={widgetTranslations}
          theme={theme.id}
        />
        <div
          onMouseDown={onMouseDown}
          style={{
            position: "absolute",
            top: 0,
            right: -3,
            width: 6,
            height: "100%",
            cursor: "col-resize",
          }}
        />
      </div>
    </div>
  );
}
