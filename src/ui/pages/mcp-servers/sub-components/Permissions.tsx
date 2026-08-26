import { useI18n } from "../../../providers/LocalesProvider";
import { cn } from "../../../../shared/utils";
import AvailableTools from "./AvailableTools";
import ToolsCounter from "./ToolsCounter";

type PermissionsProps = {
  /** When `true`, the block is dimmed and made non-interactive (e.g. while
   * the config editor is open). */
  dimmed?: boolean;
};

/**
 * Bordered panel — visually matching the ConfigEditor box — holding the
 * "Permissions" header and the list of available tools.
 */
const Permissions = ({ dimmed }: PermissionsProps) => {
  const { t, isRTL } = useI18n();

  return (
    <div
      className={cn(
        "servers-permissions flex flex-col w-full mt-[var(--servers-permissions-margin-top,8px)] py-[var(--servers-permissions-padding-y,8px)] rounded-[8px] border border-[var(--servers-edit-config-buttons-border-color)] bg-[var(--modal-dialog-background-color)]",
        dimmed && "opacity-40 pointer-events-none"
      )}
      aria-hidden={dimmed}
    >
      <div
        className={cn(
          "flex items-center justify-between px-[var(--servers-permissions-header-padding-x,16px)] mb-[var(--servers-permissions-header-margin-bottom,8px)]",
          isRTL ? "flex-row-reverse" : ""
        )}
      >
        <p className="font-bold leading-[var(--lh-16)] text-[var(--servers-available-tools-header-color)]">
          {t("Permissions")}
        </p>
        <ToolsCounter />
      </div>
      <AvailableTools withHeader={false} bordered={false} />
    </div>
  );
};

export default Permissions;
