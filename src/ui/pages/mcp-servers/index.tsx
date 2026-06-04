import { useI18n } from "../../providers/LocalesProvider";
import useEnsureTools from "../../hooks/useEnsureTools";
import { Servers } from "./sub-components";

interface McpServersPageProps {
  hideHeader?: boolean;
  noPadding?: boolean;
}

const McpServersPage = ({ hideHeader, noPadding }: McpServersPageProps) => {
  void noPadding;
  const { t } = useI18n();
  useEnsureTools();

  return (
    <div className="aui-root flex h-full w-full bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[560px] min-w-0">
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
