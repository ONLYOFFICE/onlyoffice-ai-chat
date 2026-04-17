import { useI18n } from "../../locales";
import { useComponents } from "../../components-provider";
import { useStores } from "../../store/context";
import AiModelsPage from "../ai-models";
import ModelAssignmentPage from "../model-assignment";
import McpServersPage from "../mcp-servers";
import WebSearchPage from "../web-search";

interface SettingsProps {
  hideHeader?: boolean;
  noPadding?: boolean;
  isAddModelCardHorizontal?: boolean;
}

const Settings = ({
  hideHeader,
  noPadding,
  isAddModelCardHorizontal,
}: SettingsProps) => {
  const { Tabs } = useComponents();
  const { t } = useI18n();
  const { useProfilesStore } = useStores();

  const profiles = useProfilesStore((s) => s.profiles);

  return (
    <div className="flex justify-center h-full bg-[var(--layout-background-color)]">
      <div
        className={`flex flex-col gap-[16px] box-border max-w-[640px] w-[640px] overflow-hidden${noPadding ? "" : " mx-[32px] mt-[32px]"}`}
      >
        {!hideHeader && (
          <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)]">
            {t("Settings")}
          </h1>
        )}
        <Tabs
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
                <McpServersPage
                  hideHeader={hideHeader}
                  noPadding={noPadding}
                />
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
