import { cn } from "../../../shared/utils";
import { useI18n } from "../../providers/LocalesProvider";
import { WebSearch } from "./sub-components";

interface WebSearchPageProps {
  hideHeader?: boolean;
  noPadding?: boolean;
  isHorizontal?: boolean;
  saveMode?: "blur" | "button";
  className?: string;
}

const WebSearchPage = ({
  hideHeader,
  noPadding,
  isHorizontal,
  saveMode,
  className,
}: WebSearchPageProps) => {
  void noPadding;
  const { t } = useI18n();

  return (
    <div
      className={cn(
        "aui-root select-text flex min-h-full w-full px-[var(--web-search-padding-x,0px)] py-[var(--web-search-padding-y,0px)] [justify-content:var(--web-search-justify,flex-start)] bg-[var(--layout-background-color)]",
        className
      )}
    >
      <div className="w-full max-w-[var(--web-search-max-width,560px)] min-w-0 select-none">
        {!hideHeader && (
          <h1 className="select-none font-bold text-[length:var(--web-search-title-font-size,var(--fs-20,20px))] leading-[var(--web-search-title-line-height,var(--lh-28,28px))] text-[var(--settings-header-color)] mb-[var(--web-search-title-margin-bottom,24px)]">
            {t("WebSearch")}
          </h1>
        )}
        <WebSearch
          variant="page"
          isHorizontal={isHorizontal}
          saveMode={saveMode}
        />
      </div>
    </div>
  );
};

export default WebSearchPage;
