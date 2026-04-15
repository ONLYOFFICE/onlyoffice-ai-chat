import { useEffect, useMemo, useState } from "react";
import { AIChatWidget } from "@onlyoffice/ai-chat";
import type { StorageAdapter, ThemeTokens } from "@onlyoffice/ai-chat";

import "@onlyoffice/ai-chat/styles";
import "./styles.css";

import { settings } from "./adapters/settings";
import { createStorage } from "./adapters/storage";
import { platform } from "./adapters/platform";
import { storeKeys } from "./store-keys";
import { themes, CUSTOM_THEME_ID, customThemeTokens } from "./themes";
import { useResize } from "./useResize";

const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const shell = isDark
  ? {
      bg: "#404040",
      text: "#e0e0e0",
      border: "#6b6b6b",
      sidebarBg: "#333333",
      itemBg: "transparent",
      itemActiveBg: "#4a4a4a",
      itemHoverBg: "#3d3d3d",
      tabBorder: "#555",
      tabActiveBorder: "#8ab4f8",
      labelText: "#aaa",
      valueBg: "#3a3a3a",
      swatchBorder: "#555",
    }
  : {
      bg: "#ffffff",
      text: "#333333",
      border: "#b0b0b0",
      sidebarBg: "#f5f5f5",
      itemBg: "transparent",
      itemActiveBg: "#e0e0e0",
      itemHoverBg: "#eaeaea",
      tabBorder: "#ddd",
      tabActiveBorder: "#1a73e8",
      labelText: "#666",
      valueBg: "#e8e8e8",
      swatchBorder: "#ccc",
    };

document.documentElement.style.backgroundColor = shell.bg;
document.documentElement.style.color = shell.text;

type Tab = "themes" | "tokens";

function isColor(value: string): boolean {
  return /^#[0-9a-f]/i.test(value) || /^rgb/i.test(value);
}

const tokenKeys = Object.keys(customThemeTokens) as (keyof ThemeTokens)[];

export function App() {
  const [storage, setStorage] = useState<StorageAdapter | null>(null);
  const [activeTheme, setActiveTheme] = useState(CUSTOM_THEME_ID);
  const [activeTab, setActiveTab] = useState<Tab>("themes");
  const { width: widgetWidth, onMouseDown } = useResize(520);

  const isCustom = activeTheme === CUSTOM_THEME_ID;

  useEffect(() => {
    createStorage().then(setStorage);
  }, []);

  useEffect(() => {
    if (!isCustom && activeTab === "tokens") {
      setActiveTab("themes");
    }
  }, [isCustom, activeTab]);

  const widgetTheme = isCustom ? "theme-dark" : activeTheme;
  const widgetCustomTheme = useMemo<Partial<ThemeTokens> | undefined>(
    () => (isCustom ? customThemeTokens : undefined),
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
      <div className="sidebar" style={{ backgroundColor: shell.sidebarBg }}>
        {isCustom && (
          <div
            className="sidebar-tabs"
            style={{ borderColor: shell.tabBorder }}
          >
            <button
              className={`sidebar-tab ${activeTab === "themes" ? "active" : ""}`}
              style={{
                backgroundColor: shell.sidebarBg,
                color: shell.text,
                borderBottomColor:
                  activeTab === "themes"
                    ? shell.tabActiveBorder
                    : "transparent",
              }}
              onClick={() => setActiveTab("themes")}
            >
              Themes ({themes.length})
            </button>
            <button
              className={`sidebar-tab ${activeTab === "tokens" ? "active" : ""}`}
              style={{
                backgroundColor: shell.sidebarBg,
                color: shell.text,
                borderBottomColor:
                  activeTab === "tokens"
                    ? shell.tabActiveBorder
                    : "transparent",
              }}
              onClick={() => setActiveTab("tokens")}
            >
              Tokens ({tokenKeys.length})
            </button>
          </div>
        )}

        {activeTab === "themes" || !isCustom ? (
          <div className="locale-list">
            {themes.map((th) => (
              <button
                key={th.id}
                className={`locale-item ${activeTheme === th.id ? "active" : ""}`}
                style={{
                  backgroundColor:
                    activeTheme === th.id ? shell.itemActiveBg : shell.itemBg,
                  color: shell.text,
                }}
                onMouseEnter={(e) => {
                  if (activeTheme !== th.id)
                    e.currentTarget.style.backgroundColor = shell.itemHoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    activeTheme === th.id ? shell.itemActiveBg : shell.itemBg;
                }}
                onClick={() => setActiveTheme(th.id)}
              >
                {th.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="key-editor">
            {tokenKeys.map((key) => {
              const value = customThemeTokens[key] ?? "";
              return (
                <div className="key-row" key={key}>
                  <div className="key-label" style={{ color: shell.labelText }}>
                    {key}
                  </div>
                  <div className="key-input-row">
                    {isColor(value) && (
                      <div
                        className="key-swatch"
                        style={{
                          backgroundColor: value,
                          borderColor: shell.swatchBorder,
                        }}
                      />
                    )}
                    <span
                      className="key-value"
                      style={{
                        backgroundColor: shell.valueBg,
                        color: shell.text,
                      }}
                    >
                      {value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="widget-area"
        style={{ width: widgetWidth, borderColor: shell.border }}
      >
        <AIChatWidget
          storage={storage}
          settings={settings}
          platform={platform}
          storeKeys={storeKeys}
          locale={navigator.language.split("-")[0] || "en"}
          theme={widgetTheme}
          customTheme={widgetCustomTheme}
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
