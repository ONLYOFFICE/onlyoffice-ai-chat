import { useMemo } from "react";
import {
  DEFAULT_REASONING_LEVEL,
  effectiveReasoningLevel,
  type ReasoningDepth,
  type ReasoningLevel,
} from "../../../../shared/reasoning-level";
import type { TranslationKey } from "../../../providers/LocalesProvider/generated-types";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useI18n } from "../../../providers/LocalesProvider";
import { useReasoningSupport } from "../../../hooks/useReasoningSupport";
import { useStores } from "../../../store/context";

/** Translation key for each depth's menu label. */
export const THINKING_LEVEL_LABELS: Record<ReasoningDepth, TranslationKey> = {
  low: "ThinkingLevelLow",
  medium: "ThinkingLevelMedium",
  high: "ThinkingLevelHigh",
  max: "ThinkingLevelMax",
};

/**
 * The composer's "Effort" row: one entry whose trailing value is the depth
 * the current model actually runs at, and whose submenu lists exactly the
 * choices that change the request for that model.
 *
 * - "Off" appears only where the model can really stop thinking.
 * - A model with a depth knob lists its own depths; one without lists a
 *   single "On" (Zhipu, Mistral), so the row is still a switch.
 * - Nothing to choose — the model cannot think, or thinks always with no
 *   knob (grok-4, `deepseek-reasoner`) — means no row at all.
 *
 * The stored pick survives model switches untouched; when it is not among
 * the model's choices (a depth the model lacks, or off on a model that
 * thinks always) the row shows the depth that actually goes on the wire.
 */
export function useEffortMenuItem(): DropDownItemProps | null {
  const { t } = useI18n();
  const { IconButton } = useComponents();
  const { useProfilesStore } = useStores();
  const reasoningLevel = useProfilesStore((s) => s.reasoningLevel);
  const setReasoningLevel = useProfilesStore((s) => s.setReasoningLevel);
  const support = useReasoningSupport();

  return useMemo(() => {
    if (!support.thinks) return null;
    if (!support.canDisable && support.depths.length <= 1) return null;

    const options: { level: ReasoningLevel; label: string }[] = [
      ...(support.canDisable
        ? [{ level: "off" as const, label: t("Off") }]
        : []),
      ...(support.depths.length > 0
        ? support.depths.map((depth) => ({
            level: depth,
            label: t(THINKING_LEVEL_LABELS[depth]),
          }))
        : [{ level: DEFAULT_REASONING_LEVEL, label: t("On") }]),
    ];

    // Off on a model that cannot be switched off means the standard depth —
    // that is what the request carries, so that is what the row shows.
    const effective = effectiveReasoningLevel(reasoningLevel, support);
    // With no depth knob every "on" level is the same "On" entry.
    const current =
      effective !== "off" && support.depths.length === 0
        ? DEFAULT_REASONING_LEVEL
        : effective;

    return {
      text: t("Effort"),
      icon: (
        <IconButton iconName="btn-extended-thinking" size={24} disableHover />
      ),
      onClick: () => {
        // ignore
      },
      withAbout: true,
      aboutContent: (
        <p className="p-[16px] leading-[var(--lh-16)] text-[var(--text-secondary)]">
          {t("ExtendedThinkingDescription")}
          {support.canDisable ? null : ` ${t("ExtendedThinkingAlwaysOn")}`}
        </p>
      ),
      trailingText: options.find((o) => o.level === current)?.label,
      // Six short rows at most; the menu's default 14rem cap was made for the
      // widget's own row height and forces a scrollbar in hosts with taller
      // rows. Let this one list grow to whatever the viewport allows.
      subMenuMaxHeight: "var(--radix-dropdown-menu-content-available-height)",
      subMenu: options.map((o) => ({
        text: o.label,
        checked: o.level === current,
        onClick: () => {
          void setReasoningLevel(o.level);
        },
      })),
    };
  }, [IconButton, reasoningLevel, setReasoningLevel, support, t]);
}
