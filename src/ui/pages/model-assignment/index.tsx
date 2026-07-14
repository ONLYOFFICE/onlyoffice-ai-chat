import { cn } from "../../../shared/utils";
import { useI18n } from "../../providers/LocalesProvider";
import useEnsureProfiles from "../../hooks/useEnsureProfiles";
import { ModelAssignment } from "./sub-components";

interface ModelAssignmentPageProps {
  hideHeader?: boolean;
  noPadding?: boolean;
  className?: string;

  defaultSetupHeader?: React.ReactNode;
  defaultModelLabel?: string;
}

const ModelAssignmentPage = ({
  hideHeader,
  noPadding,
  className,
  defaultSetupHeader,
  defaultModelLabel,
}: ModelAssignmentPageProps) => {
  void noPadding;
  const { t } = useI18n();
  useEnsureProfiles();

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
            {t("ModelAssignment")}
          </h1>
        )}
        <ModelAssignment
          defaultSetupHeader={defaultSetupHeader}
          defaultModelLabel={defaultModelLabel}
        />
      </div>
    </div>
  );
};

export default ModelAssignmentPage;
