import { useI18n } from "../../locales";
import { ModelAssignment } from "./sub-components";

const ModelAssignmentPage = () => {
  const { t } = useI18n();

  return (
    <div className="flex h-full bg-[var(--layout-background-color)]">
      <div className="w-[560px]">
        <h1 className="select-none font-bold text-[20px] leading-[28px] text-[var(--settings-header-color)] mb-[24px]">
          {t("ModelAssignment")}
        </h1>
        <ModelAssignment />
      </div>
    </div>
  );
};

export default ModelAssignmentPage;
