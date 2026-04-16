import { useEffect, useState } from "react";
import { AIChatWidget } from "@onlyoffice/ai-chat";
import type { StorageAdapter } from "@onlyoffice/ai-chat";

import "@onlyoffice/ai-chat/styles";
import "./styles.css";

import { settings } from "./adapters/settings";
import { createStorage } from "./adapters/storage";
import { platform } from "./adapters/platform";
import { storeKeys } from "./store-keys";
import { useResize } from "./useResize";
import { imageOverrides, overriddenIcons, allIcons } from "./images";

const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const shell = isDark
  ? {
      bg: "#404040",
      text: "#e0e0e0",
      border: "#6b6b6b",
      sidebarBg: "#333333",
      headerBorder: "#555",
      entryBorder: "#3a3a3a",
      badgeActiveBg: "#7c5cfc",
      badgeActiveText: "#fff",
      badgeDefaultBg: "#4a4a4a",
      badgeDefaultText: "#999",
    }
  : {
      bg: "#ffffff",
      text: "#333333",
      border: "#b0b0b0",
      sidebarBg: "#f5f5f5",
      headerBorder: "#ddd",
      entryBorder: "#eee",
      badgeActiveBg: "#7c5cfc",
      badgeActiveText: "#fff",
      badgeDefaultBg: "#e0e0e0",
      badgeDefaultText: "#999",
    };

document.documentElement.style.backgroundColor = shell.bg;
document.documentElement.style.color = shell.text;

const overriddenSet = new Set(overriddenIcons.map((i) => i.name));

export function App() {
  const [storage, setStorage] = useState<StorageAdapter | null>(null);
  const { width: widgetWidth, onMouseDown } = useResize(520);

  useEffect(() => {
    createStorage().then(setStorage);
  }, []);

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
        <div
          className="sidebar-header"
          style={{ borderColor: shell.headerBorder }}
        >
          <span>Icons ({allIcons.length})</span>
        </div>
        <div className="log-list">
          {allIcons.map((name) => {
            const isOverridden = overriddenSet.has(name);
            return (
              <div
                className="log-entry"
                key={name}
                style={{
                  borderColor: shell.entryBorder,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 4,
                    textTransform: "uppercase",
                    backgroundColor: isOverridden
                      ? shell.badgeActiveBg
                      : shell.badgeDefaultBg,
                    color: isOverridden
                      ? shell.badgeActiveText
                      : shell.badgeDefaultText,
                  }}
                >
                  {isOverridden ? "custom" : "default"}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                  {name}
                </span>
              </div>
            );
          })}
        </div>
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
          theme={isDark ? "theme-night" : "theme-white"}
          images={imageOverrides}
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
