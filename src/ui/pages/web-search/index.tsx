import { useI18n } from "../../providers/LocalesProvider";
import { WebSearch } from "./sub-components";

interface WebSearchPageProps {
  hideHeader?: boolean;
  noPadding?: boolean;
  isHorizontal?: boolean;
}

const WebSearchPage = ({
  hideHeader,
  noPadding,
  isHorizontal,
}: WebSearchPageProps) => {
  void noPadding;
  const { t } = useI18n();

  return (
    <div className="aui-root select-text flex h-full w-full bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[560px] min-w-0">
        {!hideHeader && (
          <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)] mb-[24px]">
            {t("WebSearch")}
          </h1>
        )}
        <WebSearch variant="page" isHorizontal={isHorizontal} />
      </div>
    </div>
  );
};

export default WebSearchPage;
