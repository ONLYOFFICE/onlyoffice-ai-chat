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
    <div className="aui-root select-text flex min-h-full w-full bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[560px] min-w-0 select-none">
        {!hideHeader && (
          <h1 className="select-none font-bold text-fs-20 leading-[var(--lh-28)] text-[var(--settings-header-color)] mb-[24px]">
            {t("MCPServers")}
          </h1>
        )}
        <Servers />
      </div>
    </div>
  );
};

export default McpServersPage;
