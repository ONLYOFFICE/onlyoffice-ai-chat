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
import { overrides, overrideSlots } from "./overrides";

const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const shell = isDark
  ? {
      bg: "#404040",
      text: "#e0e0e0",
      border: "#6b6b6b",
      sidebarBg: "#333333",
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
      badgeActiveBg: "#7c5cfc",
      badgeActiveText: "#fff",
      badgeDefaultBg: "#e0e0e0",
      badgeDefaultText: "#999",
    };

document.documentElement.style.backgroundColor = shell.bg;
document.documentElement.style.color = shell.text;

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
        <div className="sidebar-header">
          Component Slots ({overrideSlots.length})
        </div>
        <div className="slot-list">
          {overrideSlots.map((slot) => (
            <div className="slot-item" key={slot.name}>
              <span
                className="slot-badge"
                style={{
                  backgroundColor: slot.overridden
                    ? shell.badgeActiveBg
                    : shell.badgeDefaultBg,
                  color: slot.overridden
                    ? shell.badgeActiveText
                    : shell.badgeDefaultText,
                }}
              >
                {slot.overridden ? "custom" : "default"}
              </span>
              {slot.name}
            </div>
          ))}
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
          components={overrides}
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
