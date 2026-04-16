import { useI18n } from "../../locales";
import { Servers } from "./sub-components";

const McpServersPage = () => {
  const { t } = useI18n();

  return (
    <div className="flex h-full bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[560px]">
        <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)] mb-[24px]">
          {t("MCPServers")}
        </h1>
        <Servers variant="page" />
      </div>
    </div>
  );
};

export default McpServersPage;
