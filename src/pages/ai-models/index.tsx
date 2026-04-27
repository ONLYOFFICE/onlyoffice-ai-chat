import { useI18n } from "../../ui/providers/LocalesProvider";
import { Models } from "./sub-components";

interface AiModelsPageProps {
  hideHeader?: boolean;
  noPadding?: boolean;
  isAddModelCardHorizontal?: boolean;
}

const AiModelsPage = ({
  hideHeader,
  noPadding,
  isAddModelCardHorizontal,
}: AiModelsPageProps) => {
  void noPadding;
  const { t } = useI18n();

  return (
    <div className="flex h-full w-full bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[560px]">
        <>
          {!hideHeader && (
            <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)] mb-[8px]">
              {t("AIModels")}
            </h1>
          )}
          <p className="select-none font-normal leading-[20px] text-[var(--settings-description-color)] mb-[24px]">
            {t("AIModelsDescription")}
          </p>
        </>

        <Models isAddModelCardHorizontal={isAddModelCardHorizontal} />
      </div>
    </div>
  );
};

export default AiModelsPage;
