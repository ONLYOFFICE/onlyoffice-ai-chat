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
        "aui-root select-text flex min-h-full w-full bg-[var(--layout-background-color)]",
        className
      )}
    >
      <div className="w-full max-w-[560px] min-w-0 select-none">
        {!hideHeader && (
          <h1 className="select-none font-bold text-fs-20 leading-[var(--lh-28)] text-[var(--settings-header-color)] mb-[24px]">
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
