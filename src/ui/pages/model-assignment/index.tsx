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
        "aui-root select-text flex min-h-full w-full px-[var(--model-assignment-padding-x,0px)] py-[var(--model-assignment-padding-y,0px)] [justify-content:var(--model-assignment-justify,flex-start)] bg-[var(--layout-background-color)]",
        className
      )}
    >
      <div className="w-full max-w-[var(--model-assignment-max-width,560px)] min-w-0 select-none">
        {!hideHeader && (
          <h1 className="select-none font-bold text-[length:var(--model-assignment-title-font-size,var(--fs-20,20px))] leading-[var(--model-assignment-title-line-height,var(--lh-28,28px))] text-[var(--settings-header-color)] mb-[var(--model-assignment-title-margin-bottom,24px)]">
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
