import { useI18n } from "../../locales";
import { WebSearch } from "./sub-components";

interface WebSearchPageProps {
  hideHeader?: boolean;
  noPadding?: boolean;
}

const WebSearchPage = ({ hideHeader, noPadding }: WebSearchPageProps) => {
  void noPadding;
  const { t } = useI18n();

  return (
    <div className="flex h-full bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[560px]">
        {!hideHeader && (
          <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)] mb-[24px]">
            {t("WebSearch")}
          </h1>
        )}
        <WebSearch variant="page" />
      </div>
    </div>
  );
};

export default WebSearchPage;
