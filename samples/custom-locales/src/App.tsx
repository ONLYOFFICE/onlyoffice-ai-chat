import { useCallback, useEffect, useMemo, useState } from "react";
import { AIChatWidget } from "@onlyoffice/ai-chat";
import type { StorageAdapter, Translations } from "@onlyoffice/ai-chat";

import "@onlyoffice/ai-chat/styles";

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
      inputBg: "#3a3a3a",
      inputBorder: "#555",
      inputText: "#e0e0e0",
      labelText: "#aaa",
    }
  : {
      sidebarBg: "#f5f5f5",
      itemBg: "transparent",
      itemActiveBg: "#e0e0e0",
      itemHoverBg: "#eaeaea",
      tabBorder: "#ddd",
      tabActiveBorder: "#1a73e8",
      inputBg: "#fff",
      inputBorder: "#ccc",
      inputText: "#333",
      labelText: "#666",
    };

document.documentElement.style.backgroundColor = theme.bg;
document.documentElement.style.color = theme.text;

type Tab = "locales" | "keys";

export function App() {
  const [storage, setStorage] = useState<StorageAdapter | null>(null);
  const [activeLocale, setActiveLocale] = useState(CUSTOM_LOCALE_ID);
  const [draft, setDraft] = useState<Translations>(customEn);
  const [applied, setApplied] = useState<Translations>(customEn);
  const { width: widgetWidth, onMouseDown } = useResize(520);
  const [activeTab, setActiveTab] = useState<Tab>("keys");

  const isCustom = activeLocale === CUSTOM_LOCALE_ID;
  const hasChanges = draft !== applied;

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
    () => (isCustom ? applied : undefined),
    [isCustom, applied]
  );

  const widget = useMemo(
    () =>
      storage ? (
        <AIChatWidget
          storage={storage}
          settings={settings}
          platform={platform}
          storeKeys={storeKeys}
          locale={widgetLocale}
          translations={widgetTranslations}
          theme={theme.id}
        />
      ) : null,
    [storage, widgetLocale, widgetTranslations]
  );

  const handleKeyChange = useCallback((key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleApply = useCallback(() => {
    setApplied(draft);
  }, [draft]);

  const translationKeys = useMemo(
    () => Object.keys(draft) as (keyof Translations)[],
    [draft]
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
                {loc.code === CUSTOM_LOCALE_ID && " ✎"}
              </button>
            ))}
          </div>
        ) : (
          <div className="key-editor">
            {hasChanges && (
              <button
                className="apply-btn"
                style={{
                  backgroundColor: colors.tabActiveBorder,
                  color: "#fff",
                }}
                onClick={handleApply}
              >
                Apply changes
              </button>
            )}
            {translationKeys.map((key) => (
              <div className="key-row" key={key}>
                <div className="key-label" style={{ color: colors.labelText }}>
                  {key}
                </div>
                <input
                  className="key-input"
                  style={{
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.inputText,
                  }}
                  value={draft[key]}
                  onChange={(e) => handleKeyChange(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="widget-area"
        style={{ width: widgetWidth, borderColor: theme.border }}
      >
        {widget}
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
