import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useComponents } from "../../../providers/ComponentsProvider";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";
import { useToolsContext } from "../../../tools/context";
import { useStores } from "../../../store/context";
import { useEffortMenuItem } from "./effort-menu";

// The engine resolves the web-search tools on the fly per-request, so they
// never appear in the UI's `servers` aggregator — the composer toggle has
// to flip them through `disabledTools["web-search"]` directly.
const WEB_SEARCH_TYPE = "web-search";
const WEB_SEARCH_TOOL_NAMES = ["web_search", "web_crawling"];

/**
 * The composer's per-request settings: the web-search switch and the
 * reasoning "Effort" picker. Attachment entries live in the paperclip menu
 * next door, so this menu is only about *how* the model answers.
 */
const ComposerActionSettings = () => {
  const { DropdownMenu, IconButton, TooltipIconButton } = useComponents();
  const [isOpen, setIsOpen] = React.useState(false);
  const { eventBus } = useToolsContext();
  const { useServersStore } = useStores();
  const { t } = useI18n();

  const changeToolStatus = useServersStore((s) => s.changeToolStatus);
  const webSearchEnabled = useServersStore((s) => s.webSearchEnabled);
  const disabledTools = useServersStore((s) => s.disabledTools);
  const effortItem = useEffortMenuItem();

  const webSearchDisabledNames = disabledTools[WEB_SEARCH_TYPE] ?? [];
  const webSearchActive =
    webSearchEnabled &&
    WEB_SEARCH_TOOL_NAMES.some((n) => !webSearchDisabledNames.includes(n));

  const trigger = (
    <TooltipIconButton tooltip={t("Settings")} visible={!isOpen}>
      <IconButton
        iconName="btn-settings"
        size={20}
        isStroke
        className="cursor-pointer rounded-[4px] outline-none rotate-90 text-[var(--composer-settings-button-color,var(--icon-button-color))] hover:enabled:text-[var(--composer-settings-button-hover-color,var(--text-normal))]"
        isActive={isOpen}
        data-testid="composer-settings-button"
      />
    </TooltipIconButton>
  );

  const items: DropDownItemProps[] = [
    {
      text: t("WebSearch"),
      onClick: () => {
        // ignore
      },
      icon: <IconButton iconName="btn-web-search" size={24} disableHover />,
      withToggle: true,
      toggleChecked: webSearchActive,
      toggleDisabled: !webSearchEnabled,
      tooltipText: webSearchEnabled ? "" : t("EnableWebSearch"),
      onToggleChange: async () => {
        if (!webSearchEnabled) return;
        const next = !webSearchActive;
        // Flip both web-search tools in one atomic write — a per-tool
        // Promise.all races and leaves one tool enabled.
        await changeToolStatus(WEB_SEARCH_TYPE, WEB_SEARCH_TOOL_NAMES, next);
        eventBus.emit("tools-changed");
      },
    },
  ];

  if (effortItem) items.push(effortItem);

  return (
    <DropdownMenu trigger={trigger} items={items} onOpenChange={setIsOpen} />
  );
};

export { ComposerActionSettings };
