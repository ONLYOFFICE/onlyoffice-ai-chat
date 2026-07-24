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
    <div className="aui-root select-text flex min-h-full w-full [justify-content:var(--ai-models-justify)] bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[var(--ai-models-max-width)] min-w-0">
        <>
          {!hideHeader && (
            <h1 className="select-none font-bold text-[length:var(--ai-models-title-font-size)] leading-[var(--lh-28)] text-[var(--settings-header-color)] mb-[var(--ai-models-title-margin-bottom)]">
              {t("AIModels")}
            </h1>
          )}
          <p className="select-none font-normal leading-[var(--lh-16)] text-[var(--settings-description-color)] mb-[var(--ai-models-description-margin-bottom)]">
            {t("AIModelsDescription")}
          </p>
        </>

        <Models isAddModelCardHorizontal={isAddModelCardHorizontal} />
      </div>
    </div>
  );
};

export default AiModelsPage;
