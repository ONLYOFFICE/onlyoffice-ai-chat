import { useI18n } from "../../locales";
import { useComponents } from "../../components-provider";
import { useStores } from "../../store/context";
import AiModelsPage from "../ai-models";
import ModelAssignmentPage from "../model-assignment";
import McpServersPage from "../mcp-servers";
import WebSearchPage from "../web-search";

const Settings = () => {
  const { Tabs } = useComponents();
  const { t } = useI18n();
  const { useProfilesStore } = useStores();

  const profiles = useProfilesStore((s) => s.profiles);

  return (
    <div className="flex justify-center h-full bg-[var(--layout-background-color)]">
      <div className="flex flex-col gap-[16px] box-border max-w-[640px] w-[640px] mx-[32px] mt-[32px] overflow-hidden">
        <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)]">
          {t("Settings")}
        </h1>
        <Tabs
          items={[
            {
              value: "ai-settings",
              label: t("AIModels"),
              content: <AiModelsPage />,
            },
            {
              value: "model-assignment",
              label: t("ModelAssignment"),
              content: <ModelAssignmentPage />,
              disabled: !profiles.length,
            },
            {
              value: "mcp-servers",
              label: t("MCPServers"),
              content: <McpServersPage />,
              disabled: !profiles.length,
            },
            {
              value: "web-search",
              label: t("WebSearch"),
              content: <WebSearchPage />,
              disabled: !profiles.length,
            },
          ]}
        />
      </div>
    </div>
  );
};

export default Settings;
