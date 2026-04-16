import { useI18n } from "../../locales";
import { WebSearch } from "./sub-components";

const WebSearchPage = () => {
  const { t } = useI18n();

  return (
    <div className="flex h-full bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[560px]">
        <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)] mb-[24px]">
          {t("WebSearch")}
        </h1>
        <WebSearch variant="page" />
      </div>
    </div>
  );
};

export default WebSearchPage;
