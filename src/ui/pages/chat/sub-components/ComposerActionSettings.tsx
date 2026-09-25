import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useComponents } from "../../../providers/ComponentsProvider";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";
import type { ContextRoom } from "../../../../core/storage";
import { useToolsContext } from "../../../tools/context";
import { useStores } from "../../../store/context";
import { useEffortMenuItem } from "./effort-menu";
import { ConnectRoomDialog } from "./ConnectRoomDialog";

// The engine resolves the web-search tools on the fly per-request, so they
// never appear in the UI's `servers` aggregator — the composer toggle has
// to flip them through `disabledTools["web-search"]` directly.
const WEB_SEARCH_TYPE = "web-search";
const WEB_SEARCH_TOOL_NAMES = ["web_search", "web_crawling"];

/**
 * The composer's per-request settings: the context-room picker (one row per
 * cloud account, rooms inside), the web-search switch and the reasoning
 * "Effort" picker. Attachment entries live in the paperclip menu next door,
 * so this menu is only about *what the model sees* and *how* it answers.
 */
const ComposerActionSettings = () => {
  const { DropdownMenu, IconButton, TooltipIconButton } = useComponents();
  const [isOpen, setIsOpen] = React.useState(false);
  const { eventBus } = useToolsContext();
  const { useServersStore, useCloudsStore } = useStores();
  const { t } = useI18n();
  const contextFolders = useCloudsStore((s) => s.contextFolders);
  const fetchContextFolders = useCloudsStore((s) => s.fetchContextFolders);
  const selectedContextFolder = useCloudsStore((s) => s.selectedContextFolder);
  const selectContextFolder = useCloudsStore((s) => s.selectContextFolder);
  // The room awaiting confirmation. The menu is rendered controlled so it
  // can be closed here: a flyout submenu is its own Radix root, and picking
  // a row inside it dismisses only that root — the outer menu would stay
  // open under the dialog and block outside-click dismissal.
  const [pendingRoom, setPendingRoom] = React.useState<{
    cloud: string;
    room: ContextRoom;
  } | null>(null);

  // Read on mount so the row is already there (or already absent) the
  // first time the menu opens, rather than popping in mid-hover.
  React.useEffect(() => {
    void fetchContextFolders();
  }, [fetchContextFolders]);

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

  const items: DropDownItemProps[] = [];

  // Each cloud is a root row of its own — the host's hierarchy starts at
  // the account, so the menu does too: cloud → its rooms. Only clouds with
  // rooms make it into `contextFolders`, so an empty picker never shows;
  // without any cloud the switches below stand alone, separator included.
  if (contextFolders.length > 0) {
    for (const folder of contextFolders) {
      items.push({
        id: `context-cloud:${folder.cloud}`,
        text: folder.cloud,
        icon: <IconButton iconName="onlyoffice" size={24} disableHover />,
        onClick: () => {
          // ignore — the row only opens its submenu
        },
        subMenu: folder.rooms.map((room) => ({
          id: `context-room:${room.id}`,
          text: room.name,
          // Room ids are only unique within their cloud, so the match
          // needs both halves.
          checked:
            selectedContextFolder?.cloud === folder.cloud &&
            selectedContextFolder.room.id === room.id,
          onClick: () => {
            setIsOpen(false);
            setPendingRoom({ cloud: folder.cloud, room });
          },
        })),
      });
    }
    items.push({
      text: "",
      onClick: () => {
        // ignore
      },
      isSeparator: true,
    });
  }

  items.push({
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
  });

  if (effortItem) items.push(effortItem);

  return (
    <>
      <DropdownMenu
        trigger={trigger}
        items={items}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
      {pendingRoom ? (
        <ConnectRoomDialog
          cloud={pendingRoom.cloud}
          room={pendingRoom.room}
          onConfirm={() =>
            selectContextFolder(pendingRoom.cloud, pendingRoom.room)
          }
          onClose={() => setPendingRoom(null)}
        />
      ) : null}
    </>
  );
};

export { ComposerActionSettings };
