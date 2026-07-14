import { useCallback, useState, type CSSProperties } from "react";
import { useI18n } from "../../providers/LocalesProvider";
import { useComponents } from "../../providers/ComponentsProvider";
import { useStores } from "../../store/context";
import { useWidgetConfig } from "../../../widget-config";
import logger from "../../../shared/logger";
import useEnsureProfiles from "../../hooks/useEnsureProfiles";
import AiModelsPage from "../ai-models";
import ModelAssignmentPage from "../model-assignment";
import McpServersPage from "../mcp-servers";
import WebSearchPage from "../web-search";

interface SettingsProps {
  hideHeader?: boolean;
  noPadding?: boolean;
  /**
   * Overrides {@link WidgetConfig.isAddModelCardHorizontal} for hosts
   * that render `<Settings />` directly (outside `<AIChatWidget />`).
   * When omitted, the context value is used.
   */
  isAddModelCardHorizontal?: boolean;
  isWebSearchHorizontal?: boolean;
  /**
   * Overrides {@link WidgetConfig.webSearchSaveMode}. When omitted, the
   * context value is used (defaulting to `"blur"`).
   */
  webSearchSaveMode?: "blur" | "button";
}

const Settings = ({
  hideHeader,
  noPadding,
  isAddModelCardHorizontal: isAddModelCardHorizontalProp,
  isWebSearchHorizontal,
  webSearchSaveMode,
}: SettingsProps) => {
  const { Tabs } = useComponents();
  const { t } = useI18n();
  const { useProfilesStore, useServersStore } = useStores();
  const widgetConfig = useWidgetConfig();
  const { onDiscardMcpChanges } = widgetConfig;
  const isAddModelCardHorizontal =
    isAddModelCardHorizontalProp ?? widgetConfig.isAddModelCardHorizontal;
  useEnsureProfiles();

  const profiles = useProfilesStore((s) => s.profiles);
  const mcpConfigDirty = useServersStore((s) => s.mcpConfigDirty);
  const setMcpConfigDirty = useServersStore((s) => s.setMcpConfigDirty);

  const [activeTab, setActiveTab] = useState("ai-settings");

  const frameStyle = {
    marginInline: noPadding ? "0px" : "var(--ai-settings-margin-x)",
    marginTop: noPadding ? "0px" : "var(--ai-settings-margin-y)",
  } as CSSProperties;

  const handleTabChange = useCallback(
    async (next: string) => {
      const leavingMcp = activeTab === "mcp-servers" && next !== "mcp-servers";
      // Offer the host a chance to confirm discarding unsaved MCP edits.
      if (leavingMcp && mcpConfigDirty && onDiscardMcpChanges) {
        try {
          const discard = await onDiscardMcpChanges();
          if (!discard) return; // host cancelled — stay on the MCP tab
        } catch (err) {
          logger.error("onDiscardMcpChanges handler failed:", err);
          return; // keep the edits on error rather than dropping them
        }
        setMcpConfigDirty(false);
      }
      setActiveTab(next);
    },
    [activeTab, mcpConfigDirty, onDiscardMcpChanges, setMcpConfigDirty]
  );

  return (
    <div className="aui-root select-text flex justify-center h-full bg-[var(--layout-background-color)]">
      <div
        className="flex flex-col gap-[16px] box-border w-full max-w-[var(--ai-settings-max-width)] min-w-0 overflow-hidden"
        style={frameStyle}
      >
        {!hideHeader && (
          <h1 className="select-none font-bold text-fs-20 leading-[var(--lh-28)] text-[var(--settings-header-color)]">
            {t("Settings")}
          </h1>
        )}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          listClassName="[padding-inline:var(--ai-settings-tabs-list-padding)]"
          contentClassName="[padding-inline:var(--ai-settings-tabs-content-padding)] [padding-bottom:var(--ai-settings-tabs-content-padding)]"
          items={[
            {
              value: "ai-settings",
              label: t("AIModels"),
              content: (
                <AiModelsPage
                  hideHeader={hideHeader}
                  noPadding={noPadding}
                  isAddModelCardHorizontal={isAddModelCardHorizontal}
                />
              ),
            },
            {
              value: "model-assignment",
              label: t("ModelAssignment"),
              content: (
                <ModelAssignmentPage
                  hideHeader={hideHeader}
                  noPadding={noPadding}
                />
              ),
              disabled: !profiles.length,
            },
            {
              value: "mcp-servers",
              label: t("MCPServers"),
              content: (
                <McpServersPage hideHeader={hideHeader} noPadding={noPadding} />
              ),
              disabled: !profiles.length,
            },
            {
              value: "web-search",
              label: t("WebSearch"),
              content: (
                <WebSearchPage
                  hideHeader={hideHeader}
                  noPadding={noPadding}
                  isHorizontal={isWebSearchHorizontal}
                  saveMode={webSearchSaveMode}
                />
              ),
              disabled: !profiles.length,
            },
          ]}
        />
      </div>
    </div>
  );
};

export default Settings;
