import { useEffect, useRef, useState } from "react";
import { AIChatWidget } from "@onlyoffice/ai-chat";
import type { StorageAdapter, AIChatWidgetRef } from "@onlyoffice/ai-chat";

import "@onlyoffice/ai-chat/styles";
import "./styles.css";

import { settings } from "./adapters/settings";
import { createStorage } from "./adapters/storage";
import { platform } from "./adapters/platform";
import { storeKeys } from "./store-keys";
import { useResize } from "./useResize";

const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const shell = isDark
  ? {
      bg: "#404040",
      text: "#e0e0e0",
      border: "#6b6b6b",
      sidebarBg: "#333333",
      headerBorder: "#555",
      btnBg: "#4a4a4a",
      btnHoverBg: "#555",
      accentBg: "#3483db",
      accentText: "#fff",
      inputBg: "#3a3a3a",
      inputBorder: "#555",
      statusBorder: "#555",
    }
  : {
      bg: "#ffffff",
      text: "#333333",
      border: "#b0b0b0",
      sidebarBg: "#f5f5f5",
      headerBorder: "#ddd",
      btnBg: "#e8e8e8",
      btnHoverBg: "#ddd",
      accentBg: "#3483db",
      accentText: "#fff",
      inputBg: "#fff",
      inputBorder: "#ccc",
      statusBorder: "#ddd",
    };

document.documentElement.style.backgroundColor = shell.bg;
document.documentElement.style.color = shell.text;

export function App() {
  const [storage, setStorage] = useState<StorageAdapter | null>(null);
  const widgetRef = useRef<AIChatWidgetRef>(null);
  const { width: widgetWidth, onMouseDown } = useResize(520);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Ready");

  useEffect(() => {
    createStorage().then(setStorage);
  }, []);

  const updateStatus = (text: string) => setStatus(text);

  const handleSend = () => {
    if (!message.trim()) return;
    widgetRef.current?.sendMessage(message);
    updateStatus(`Sent: "${message}"`);
    setMessage("");
  };

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
          Imperative API
        </div>

        <div className="send-row" style={{ paddingTop: 12 }}>
          <input
            className="send-input"
            style={{
              backgroundColor: shell.inputBg,
              borderColor: shell.inputBorder,
              color: shell.text,
            }}
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            className="send-btn"
            style={{
              backgroundColor: shell.accentBg,
              color: shell.accentText,
            }}
            onClick={handleSend}
          >
            Send
          </button>
        </div>

        <div className="controls">
          <div className="section">Messages</div>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              const streaming = widgetRef.current?.isStreaming();
              updateStatus(`Streaming: ${streaming}`);
            }}
          >
            isStreaming()
          </button>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              widgetRef.current?.stopStreaming();
              updateStatus("Stopped streaming");
            }}
          >
            stopStreaming()
          </button>

          <div className="section">Threads</div>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              const id = widgetRef.current?.createThread();
              updateStatus(`Created thread: ${id}`);
            }}
          >
            createThread()
          </button>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              const id = widgetRef.current?.getCurrentThreadId();
              updateStatus(`Current thread: ${id}`);
            }}
          >
            getCurrentThreadId()
          </button>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              const threads = widgetRef.current?.getThreads() ?? [];
              updateStatus(`Threads: ${threads.length}`);
            }}
          >
            getThreads()
          </button>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              const id = widgetRef.current?.getCurrentThreadId();
              if (id) {
                widgetRef.current?.renameThread(id, "Renamed by API");
                updateStatus(`Renamed thread ${id}`);
              }
            }}
          >
            renameThread(current, "Renamed by API")
          </button>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={async () => {
              const id = widgetRef.current?.getCurrentThreadId();
              if (id) {
                await widgetRef.current?.clearHistory(id);
                updateStatus(`Cleared thread ${id}`);
              }
            }}
          >
            clearHistory(current)
          </button>

          <div className="section">Navigation</div>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              widgetRef.current?.openChat();
              updateStatus("Opened chat");
            }}
          >
            openChat()
          </button>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              widgetRef.current?.openSettings();
              updateStatus("Opened settings");
            }}
          >
            openSettings()
          </button>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              widgetRef.current?.openHistory();
              updateStatus("Opened history");
            }}
          >
            openHistory()
          </button>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              const page = widgetRef.current?.getCurrentPage();
              updateStatus(`Current page: ${page}`);
            }}
          >
            getCurrentPage()
          </button>

          <div className="section">Profiles</div>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              const profiles = widgetRef.current?.getProfiles() ?? [];
              updateStatus(
                `Profiles: ${profiles.map((p) => p.name || p.id).join(", ") || "none"}`
              );
            }}
          >
            getProfiles()
          </button>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              const p = widgetRef.current?.getCurrentProfile();
              updateStatus(`Current profile: ${p ? p.name || p.id : "none"}`);
            }}
          >
            getCurrentProfile()
          </button>

          <div className="section">Tool Calls</div>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              widgetRef.current?.approveToolCall();
              updateStatus("Approved tool call");
            }}
          >
            approveToolCall()
          </button>
          <button
            className="action-btn"
            style={{ backgroundColor: shell.btnBg, color: shell.text }}
            onClick={() => {
              widgetRef.current?.denyToolCall();
              updateStatus("Denied tool call");
            }}
          >
            denyToolCall()
          </button>
        </div>

        <div className="status-bar" style={{ borderColor: shell.statusBorder }}>
          {status}
        </div>
      </div>

      <div
        className="widget-area"
        style={{ width: widgetWidth, borderColor: shell.border }}
      >
        <AIChatWidget
          ref={widgetRef}
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
