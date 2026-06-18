import { useMemo, useState } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useStores } from "../../../store/context";
import { useToolsContext } from "../../../tools/context";

// Built-in web-search tool names — kept in sync with
// `getWebSearchTools` in `core/services/web-search/source.ts`. The
// engine resolves these on the fly per-request, so they never appear
// in the UI's `servers` aggregator and the composer toggle has to
// flip them through `disabledTools["web-search"]` directly.
const WEB_SEARCH_TYPE = "web-search";
const WEB_SEARCH_TOOL_NAMES = ["web_search", "web_crawling"];

const ServersSettings = () => {
  const { DropdownMenu, IconButton, TooltipIconButton } = useComponents();
  const { useServersStore, useProfilesStore } = useStores();
  const { eventBus } = useToolsContext();
  const servers = useServersStore((s) => s.servers);
  const changeToolStatus = useServersStore((s) => s.changeToolStatus);
  const webSearchEnabled = useServersStore((s) => s.webSearchEnabled);
  const disabledTools = useServersStore((s) => s.disabledTools);
  const extendedThinking = useProfilesStore((s) => s.extendedThinking);
  const toggleExtendedThinking = useProfilesStore(
    (s) => s.toggleExtendedThinking
  );

  const webSearchDisabledNames = disabledTools[WEB_SEARCH_TYPE] ?? [];
  const webSearchActive =
    webSearchEnabled &&
    WEB_SEARCH_TOOL_NAMES.some((n) => !webSearchDisabledNames.includes(n));

  const [isOpen, setIsOpen] = useState(false);

  const { t } = useI18n();

  const trigger = useMemo(
    () => (
      <TooltipIconButton visible={!isOpen} tooltip={t("MCPServers")}>
        <IconButton
          iconName="tools"
          size={24}
          width={12}
          height={16}
          isActive={isOpen}
        />
      </TooltipIconButton>
    ),
    [isOpen, t, IconButton, TooltipIconButton]
  );

  const toolsActions = useMemo(
    () => [
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
          // Flip every web-search tool at once so the composer toggle
          // matches the user's mental model of "web search on / off".
          // One atomic write — a per-tool Promise.all races and leaves one
          // tool enabled.
          await changeToolStatus(WEB_SEARCH_TYPE, WEB_SEARCH_TOOL_NAMES, next);
          eventBus.emit("tools-changed");
        },
      },
      {
        text: t("ExtendedThinking"),
        icon: (
          <IconButton iconName="btn-extended-thinking" size={24} disableHover />
        ),
        onClick: () => {
          // ignore
        },
        withToggle: true,
        toggleChecked: extendedThinking,
        onToggleChange: toggleExtendedThinking,
        withAbout: true,
        aboutContent: (
          <p className="p-[16px] leading-[16px] text-[var(--text-secondary)]">
            {t("ExtendedThinkingDescription")}
          </p>
        ),
      },
      {
        text: "",
        onClick: () => {
          // ignore
        },
        isSeparator: true,
      },
      ...Object.entries(servers)
        .map(([type, tools]) => {
          if (type === "web-search")
            return {
              text: type,
              onClick: () => {
                // ignore
              },
              subMenu: [],
            };

          const isAllEnabled = tools.some((tool) => tool.enabled);
          return {
            text: type,
            onClick: () => {
              // ignore
            },
            subMenu: [
              {
                text: "All tools",
                onClick: () => {
                  // ignore
                },
                withToggle: true,
                toggleChecked: isAllEnabled,
                onToggleChange: () => {
                  if (isAllEnabled) {
                    tools.forEach((tool) => {
                      changeToolStatus(type, tool.name, false);
                    });
                  } else {
                    tools.forEach((tool) => {
                      changeToolStatus(type, tool.name, true);
                    });
                  }
                },
              },
              {
                text: "",
                onClick: () => {
                  // ignore
                },
                isSeparator: true,
              },
              ...tools.map((tool) => {
                return {
                  text: tool.name,
                  onClick: () => {
                    // ignore
                  },
                  withToggle: true,
                  toggleChecked: tool.enabled,
                  onToggleChange: (checked: boolean) => {
                    changeToolStatus(type, tool.name, checked);
                  },
                };
              }),
            ],
          };
        })
        .filter((item) => item.subMenu.length > 2),
    ],
    [
      servers,
      changeToolStatus,
      t,
      webSearchEnabled,
      webSearchActive,
      toggleExtendedThinking,
      extendedThinking,
      eventBus,
      IconButton,
    ]
  );

  const actions = useMemo(() => [...toolsActions], [toolsActions]);

  if (!servers) return null;

  if (!toolsActions.length) return null;

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  return (
    <DropdownMenu
      trigger={trigger}
      items={actions}
      onOpenChange={onOpenChange}
    />
  );
};

export { ServersSettings };
