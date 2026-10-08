import { useMemo } from "react";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";
import type { TranslationKey } from "../../../providers/LocalesProvider/generated-types";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useI18n } from "../../../providers/LocalesProvider";
import { useStores } from "../../../store/context";
import {
  TOOL_PERMISSION_MODES,
  type ToolPermissionMode,
} from "../../../../shared/tool-permission-mode";

/** Translation key for each mode's menu label. */
export const TOOL_PERMISSION_MODE_LABELS: Record<
  ToolPermissionMode,
  TranslationKey
> = {
  ask: "PermissionsAskEveryTime",
  auto: "PermissionsAutoApprove",
  allow: "PermissionsAllowWithoutAsking",
};

/**
 * The composer's "Permissions" row, pinned at the foot of the model picker
 * right after Effort: its trailing value is the mode tool calls are
 * approved under, and its submenu lists the three modes. The pick is
 * persisted through the servers store.
 */
export function usePermissionsMenuItem(): DropDownItemProps {
  const { t } = useI18n();
  const { IconButton } = useComponents();
  const { useServersStore } = useStores();
  const mode = useServersStore((s) => s.toolPermissionMode);
  const setMode = useServersStore((s) => s.setToolPermissionMode);

  return useMemo(
    () => ({
      text: t("Permissions"),
      "data-testid": "permissions-menu-item",
      icon: <IconButton iconName="btn-permission" size={24} disableHover />,
      onClick: () => {
        // ignore — the row only opens its submenu
      },
      trailingText: t(TOOL_PERMISSION_MODE_LABELS[mode]),
      subMenu: TOOL_PERMISSION_MODES.map((m) => ({
        text: t(TOOL_PERMISSION_MODE_LABELS[m]),
        "data-testid": `permissions-menu-option-${m}`,
        checked: m === mode,
        onClick: () => {
          void setMode(m);
        },
      })),
    }),
    [IconButton, mode, setMode, t]
  );
}
