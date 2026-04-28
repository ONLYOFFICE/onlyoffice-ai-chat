import { useEffect, useState } from "react";
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

const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const theme = isDark
  ? { id: "theme-night", bg: "#404040", border: "#6b6b6b" }
  : { id: "theme-white", bg: "#ffffff", border: "#b0b0b0" };

document.documentElement.style.backgroundColor = theme.bg;

export function App() {
  const [storage, setStorage] = useState<StorageAdapter | null>(null);
  const { width, onMouseDown } = useResize(520);

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
          color: isDark ? "#fff" : "#000",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        width,
        height: "100vh",
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
  );
}
