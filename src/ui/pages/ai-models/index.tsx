import { useI18n } from "../../providers/LocalesProvider";
import useEnsureProfiles from "../../hooks/useEnsureProfiles";
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
  useEnsureProfiles();

  return (
    <div
      data-testid="ai-models-page"
      className="aui-root select-text flex min-h-full w-full px-[var(--ai-models-padding-x,0px)] py-[var(--ai-models-padding-y,0px)] [justify-content:var(--ai-models-justify,flex-start)] bg-[var(--layout-background-color)]"
    >
      <div className="w-full max-w-[var(--ai-models-max-width,560px)] min-w-0">
        <>
          {!hideHeader && (
            <h1 className="select-none font-bold text-[length:var(--ai-models-title-font-size,var(--fs-20,20px))] leading-[var(--ai-models-title-line-height,var(--lh-28,28px))] text-[var(--settings-header-color)] mb-[var(--ai-models-title-margin-bottom,8px)]">
              {t("AIModels")}
            </h1>
          )}
          <p className="select-none font-normal leading-[var(--lh-16)] text-[var(--settings-description-color)] mb-[var(--ai-models-description-margin-bottom,8px)]">
            {t("AIModelsDescription")}
          </p>
        </>

        <Models isAddModelCardHorizontal={isAddModelCardHorizontal} />
      </div>
    </div>
  );
};

export default AiModelsPage;
