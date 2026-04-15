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
import { useEventLog } from "./useEventLog";

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
      eventColor: "#8ab4f8",
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
      eventColor: "#1a73e8",
    };

document.documentElement.style.backgroundColor = shell.bg;
document.documentElement.style.color = shell.text;

export function App() {
  const [storage, setStorage] = useState<StorageAdapter | null>(null);
  const { width: widgetWidth, onMouseDown } = useResize(520);
  const { entries, callbacks, clear } = useEventLog();

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
          <span>Events ({entries.length})</span>
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
              Interact with the widget to see events here
            </div>
          ) : (
            entries.map((entry) => (
              <div
                className="log-entry"
                key={entry.id}
                style={{ borderColor: shell.entryBorder }}
              >
                <div>
                  <span className="log-time">{entry.time}</span>
                  <span
                    className="log-event"
                    style={{ color: shell.eventColor }}
                  >
                    {entry.event}
                  </span>
                </div>
                {Object.keys(entry.data).length > 0 && (
                  <div className="log-data">{JSON.stringify(entry.data)}</div>
                )}
              </div>
            ))
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
          callbacks={callbacks}
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
