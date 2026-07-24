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
    <div className="aui-root select-text flex min-h-full w-full [justify-content:var(--mcp-servers-justify)] bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[var(--mcp-servers-max-width)] min-w-0 select-none">
        {!hideHeader && (
          <h1 className="select-none font-bold text-[length:var(--mcp-servers-title-font-size)] leading-[var(--lh-28)] text-[var(--settings-header-color)] mb-[var(--mcp-servers-title-margin-bottom)]">
            {t("MCPServers")}
          </h1>
        )}
        <Servers />
      </div>
    </div>
  );
};

export default McpServersPage;
