import { useI18n } from "../../providers/LocalesProvider";
import useEnsureProfiles from "../../hooks/useEnsureProfiles";
import { ModelAssignment } from "./sub-components";

interface ModelAssignmentPageProps {
  hideHeader?: boolean;
  noPadding?: boolean;
}

const ModelAssignmentPage = ({
  hideHeader,
  noPadding,
}: ModelAssignmentPageProps) => {
  void noPadding;
  const { t } = useI18n();
  useEnsureProfiles();

  return (
    <div className="aui-root select-text flex h-full w-full bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[560px] min-w-0">
        {!hideHeader && (
          <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)] mb-[24px]">
            {t("ModelAssignment")}
          </h1>
        )}
        <ModelAssignment />
      </div>
    </div>
  );
};

export default ModelAssignmentPage;
