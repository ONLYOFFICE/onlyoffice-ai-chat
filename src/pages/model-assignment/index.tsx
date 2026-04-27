import { useI18n } from "../../ui/providers/LocalesProvider";
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

  return (
    <div className="flex h-full w-full bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[560px]">
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
