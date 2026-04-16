"use client";

export type Page =
  | "chat"
  | "all-settings"
  | "ai-models"
  | "model-assignment"
  | "mcp-servers"
  | "web-search";

const navItems: { id: Page; label: string; section?: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "all-settings", label: "All Settings", section: "Settings" },
  { id: "ai-models", label: "AI Models", section: "Settings" },
  { id: "model-assignment", label: "Model Assignment", section: "Settings" },
  { id: "mcp-servers", label: "MCP Servers", section: "Settings" },
  { id: "web-search", label: "Web Search", section: "Settings" },
];

interface SidebarProps {
  active: Page;
  onNavigate: (page: Page) => void;
}

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  let lastSection = "";

  return (
    <nav
      style={{
        width: 300,
        minWidth: 300,
        height: "100vh",
        borderRight: "1px solid var(--border-divider, #ddd)",
        backgroundColor: "var(--background-normal-element, #f5f5f5)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "20px 16px 12px",
          fontSize: 16,
          fontWeight: 700,
          color: "var(--text-normal, #333)",
        }}
      >
        AI Chat
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
        {navItems.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          const isActive = active === item.id;

          return (
            <div key={item.id}>
              {showSection && (
                <div
                  style={{
                    padding: "16px 12px 4px",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--text-tertiary, #999)",
                  }}
                >
                  {item.section}
                </div>
              )}
              <button
                onClick={() => onNavigate(item.id)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  textAlign: "left",
                  color: "var(--text-normal, #333)",
                  backgroundColor: isActive
                    ? "var(--highlight-button-pressed, #ddd)"
                    : "transparent",
                }}
              >
                {item.label}
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
