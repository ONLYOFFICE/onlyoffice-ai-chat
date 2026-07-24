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
        "aui-root select-text flex min-h-full w-full [justify-content:var(--model-assignment-justify)] bg-[var(--layout-background-color)]",
        className
      )}
    >
      <div className="w-full max-w-[var(--model-assignment-max-width)] min-w-0 select-none">
        {!hideHeader && (
          <h1 className="select-none font-bold text-[length:var(--model-assignment-title-font-size)] leading-[var(--lh-28)] text-[var(--settings-header-color)] mb-[var(--model-assignment-title-margin-bottom)]">
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
