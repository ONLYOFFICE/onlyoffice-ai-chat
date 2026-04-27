import { useI18n } from "../../ui/providers/LocalesProvider";
import { Servers } from "./sub-components";

interface McpServersPageProps {
  hideHeader?: boolean;
  noPadding?: boolean;
}

const McpServersPage = ({ hideHeader, noPadding }: McpServersPageProps) => {
  void noPadding;
  const { t } = useI18n();

  return (
    <div className="flex h-full w-full bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[560px]">
        {!hideHeader && (
          <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)] mb-[24px]">
            {t("MCPServers")}
          </h1>
        )}
        <Servers variant="page" />
      </div>
    </div>
  );
};

export default McpServersPage;
