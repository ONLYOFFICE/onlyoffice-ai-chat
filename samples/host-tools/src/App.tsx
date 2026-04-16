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
import { hostToolGroups } from "./tools";

const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const shell = isDark
  ? {
      bg: "#404040",
      text: "#e0e0e0",
      border: "#6b6b6b",
      sidebarBg: "#333333",
      headerBorder: "#555",
      entryBorder: "#3a3a3a",
      nameBg: "#4a4a4a",
    }
  : {
      bg: "#ffffff",
      text: "#333333",
      border: "#b0b0b0",
      sidebarBg: "#f5f5f5",
      headerBorder: "#ddd",
      entryBorder: "#eee",
      nameBg: "#e0e0e0",
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
        <div
          className="sidebar-header"
          style={{ borderColor: shell.headerBorder }}
        >
          <span>Host Tools</span>
        </div>
        <div className="log-list">
          {hostToolGroups.map((group) => (
            <div key={group.id}>
              <div
                style={{
                  padding: "12px 16px 4px",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  opacity: 0.5,
                }}
              >
                {group.name}
              </div>
              {group.tools.map((tool) => (
                <div
                  className="log-entry"
                  key={tool.name}
                  style={{ borderColor: shell.entryBorder }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontWeight: 600,
                        fontSize: 13,
                        backgroundColor: shell.nameBg,
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {tool.name}
                    </span>
                  </div>
                  <div className="log-data" style={{ marginTop: 4 }}>
                    {tool.description}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div
            style={{
              padding: "16px",
              fontSize: 11,
              opacity: 0.5,
              lineHeight: 1.5,
            }}
          >
            Connect an AI model, then ask it to use these tools. For example:
            "What time is it?" or "Calculate 123 * 456"
          </div>
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
          hostToolGroups={hostToolGroups}
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
