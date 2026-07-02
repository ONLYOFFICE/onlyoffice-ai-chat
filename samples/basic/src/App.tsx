import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { AIChatWidget } from "@onlyoffice/ai-chat";
import type { StorageAdapter } from "@onlyoffice/ai-chat";

import "@onlyoffice/ai-chat/styles";
import "./styles.css";

import { settings } from "./adapters/settings";
import { createStorage } from "./adapters/storage";
import { platform } from "./adapters/platform";
import { hostToolGroups } from "./adapters/hostTools";
import { toolsAdapter } from "./adapters/toolsAdapter";
import { storeKeys } from "./store-keys";
import { useResize } from "./useResize";

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const themes = {
  dark: { id: "theme-night", bg: "#404040", border: "#6b6b6b" },
  light: { id: "theme-white", bg: "#ffffff", border: "#b0b0b0" },
} as const;

export function App() {
  const [storage, setStorage] = useState<StorageAdapter | null>(null);
  const [isDark, setIsDark] = useState(prefersDark);
  const { width, onMouseDown } = useResize(400, 213);

  const theme = isDark ? themes.dark : themes.light;

  const buttonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 6,
    border: `1px solid ${theme.border}`,
    background: theme.bg,
    color: isDark ? "#e0e0e0" : "#333333",
    cursor: "pointer",
    font: "inherit",
  };

  useEffect(() => {
    createStorage().then(setStorage);
  }, []);

  useEffect(() => {
    document.documentElement.style.backgroundColor = theme.bg;
  }, [theme.bg]);

  if (!storage) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: isDark ? "#fff" : "#000",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div
        style={{
          width,
          height: "100%",
          position: "relative",
          borderRight: `1px solid ${theme.border}`,
        }}
      >
        <AIChatWidget
          storage={storage}
          settings={settings}
          platform={platform}
          storeKeys={storeKeys}
          locale={navigator.language.split("-")[0] || "en"}
          theme={theme.id}
          hostToolGroups={hostToolGroups}
          toolsAdapter={toolsAdapter}
          iconFormat="png"
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setIsDark((prev) => !prev)}
          style={buttonStyle}
        >
          {isDark ? "☀️ Light theme" : "🌙 Dark theme"}
        </button>
      </div>
    </div>
  );
}
