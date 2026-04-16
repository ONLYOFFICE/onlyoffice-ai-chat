"use client";

import { useState } from "react";
import {
  ChatPage,
  SettingsPage,
  AiModelsPage,
  ModelAssignmentPage,
  McpServersPage,
  WebSearchPage,
} from "@onlyoffice/ai-chat";

import Providers from "@/components/Providers";
import Sidebar, { type Page } from "@/components/Sidebar";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("chat");

  return (
    <Providers>
      <div style={{ display: "flex", height: "100vh" }}>
        <Sidebar active={currentPage} onNavigate={setCurrentPage} />
        <main style={{ flex: 1, overflow: "hidden" }}>
          {currentPage === "chat" && <ChatPage />}
          {currentPage === "all-settings" && <SettingsPage />}
          {currentPage === "ai-models" && <AiModelsPage />}
          {currentPage === "model-assignment" && <ModelAssignmentPage />}
          {currentPage === "mcp-servers" && <McpServersPage />}
          {currentPage === "web-search" && <WebSearchPage />}
        </main>
      </div>
    </Providers>
  );
}
