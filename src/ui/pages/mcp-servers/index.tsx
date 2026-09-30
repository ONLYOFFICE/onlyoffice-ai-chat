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
    <div
      data-testid="mcp-servers-page"
      className="mcp-servers-page aui-root select-text flex min-h-full w-full px-[var(--mcp-servers-padding-x,0px)] py-[var(--mcp-servers-padding-y,0px)] [justify-content:var(--mcp-servers-justify,flex-start)] bg-[var(--layout-background-color)]"
    >
      <div className="w-full max-w-[var(--mcp-servers-max-width,560px)] min-w-0 select-none">
        {!hideHeader && (
          <h1 className="select-none font-bold text-[length:var(--mcp-servers-title-font-size,var(--fs-20,20px))] leading-[var(--mcp-servers-title-line-height,var(--lh-28,28px))] text-[var(--settings-header-color)] mb-[var(--mcp-servers-title-margin-bottom,24px)]">
            {t("MCPServers")}
          </h1>
        )}
        <Servers />
      </div>
    </div>
  );
};

export default McpServersPage;
