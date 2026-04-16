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
import { PROVIDER_TYPE } from "./echo-provider";

const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const shell = isDark
  ? {
      bg: "#404040",
      text: "#e0e0e0",
      border: "#6b6b6b",
      sidebarBg: "#333333",
      headerBorder: "#555",
      entryBorder: "#3a3a3a",
      codeBg: "#4a4a4a",
    }
  : {
      bg: "#ffffff",
      text: "#333333",
      border: "#b0b0b0",
      sidebarBg: "#f5f5f5",
      headerBorder: "#ddd",
      entryBorder: "#eee",
      codeBg: "#e8e8e8",
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
          <span>Custom Provider</span>
        </div>
        <div className="log-list">
          <div className="log-entry" style={{ borderColor: shell.entryBorder }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Echo Provider
            </div>
            <div className="log-data" style={{ lineHeight: 1.5 }}>
              A demo provider registered via{" "}
              <code
                style={{
                  backgroundColor: shell.codeBg,
                  padding: "1px 4px",
                  borderRadius: 3,
                }}
              >
                registerProvider()
              </code>
              . It echoes back your messages with character-by-character
              streaming.
            </div>
          </div>
          <div className="log-entry" style={{ borderColor: shell.entryBorder }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Provider type
            </div>
            <div>
              <code
                style={{
                  backgroundColor: shell.codeBg,
                  padding: "2px 6px",
                  borderRadius: 3,
                  fontFamily: "monospace",
                }}
              >
                {PROVIDER_TYPE}
              </code>
            </div>
          </div>
          <div className="log-entry" style={{ borderColor: shell.entryBorder }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Models</div>
            <div className="log-data" style={{ lineHeight: 1.8 }}>
              <div>
                <strong>echo-v1</strong> — echoes message as-is
              </div>
              <div>
                <strong>echo-reverse</strong> — echoes message reversed
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "16px",
              fontSize: 11,
              opacity: 0.5,
              lineHeight: 1.5,
            }}
          >
            Select "echo" as provider when creating a profile. No API key needed
            — leave it empty or type anything.
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
