import { useEffect, useState } from "react";
import { AIChatWidget } from "@onlyoffice/ai-chat";
import type { StorageAdapter } from "@onlyoffice/ai-chat";

import "@onlyoffice/ai-chat/styles";
import "./styles.css";

import { settings } from "./adapters/settings";
import { createStorage } from "./adapters/storage";
import { platform as basePlatform } from "./adapters/platform";
import { storeKeys } from "./store-keys";
import { useResize } from "./useResize";
import { useProxyLog } from "./useProxyLog";

const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const shell = isDark
  ? {
      bg: "#404040",
      text: "#e0e0e0",
      border: "#6b6b6b",
      sidebarBg: "#333333",
      headerBorder: "#555",
      entryBorder: "#3a3a3a",
      btnBg: "#4a4a4a",
      btnBorder: "#666",
      methodColor: "#c792ea",
      statusOk: "#4ade80",
      statusErr: "#ff6b6b",
    }
  : {
      bg: "#ffffff",
      text: "#333333",
      border: "#b0b0b0",
      sidebarBg: "#f5f5f5",
      headerBorder: "#ddd",
      entryBorder: "#eee",
      btnBg: "#fff",
      btnBorder: "#ccc",
      methodColor: "#7c3aed",
      statusOk: "#16a34a",
      statusErr: "#dc2626",
    };

document.documentElement.style.backgroundColor = shell.bg;
document.documentElement.style.color = shell.text;

export function App() {
  const [storage, setStorage] = useState<StorageAdapter | null>(null);
  const { width: widgetWidth, onMouseDown } = useResize(520);
  const { entries, platform, clear } = useProxyLog(basePlatform);

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
          <span>Fetch Proxy ({entries.length})</span>
          <button
            className="clear-btn"
            style={{
              backgroundColor: shell.btnBg,
              borderColor: shell.btnBorder,
              color: shell.text,
            }}
            onClick={clear}
          >
            Clear
          </button>
        </div>
        <div className="log-list">
          {entries.length === 0 ? (
            <div className="log-empty">
              Connect a provider and send a message to see proxied requests
            </div>
          ) : (
            entries.map((e) => {
              const isOk =
                typeof e.status === "number" &&
                e.status >= 200 &&
                e.status < 400;
              return (
                <div
                  className="log-entry"
                  key={e.id}
                  style={{ borderColor: shell.entryBorder }}
                >
                  <div>
                    <span className="log-time">{e.time}</span>
                    <span
                      style={{
                        color: shell.methodColor,
                        fontWeight: 600,
                        fontFamily: "monospace",
                        marginRight: 6,
                      }}
                    >
                      {e.method}
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        fontFamily: "monospace",
                        color: isOk ? shell.statusOk : shell.statusErr,
                      }}
                    >
                      {e.status}
                    </span>
                    <span style={{ opacity: 0.4, marginLeft: 6, fontSize: 11 }}>
                      {e.duration}ms
                    </span>
                  </div>
                  <div className="log-data">
                    {e.url.length > 80 ? e.url.slice(0, 80) + "..." : e.url}
                  </div>
                </div>
              );
            })
          )}
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
