import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useComponents } from "../../../providers/ComponentsProvider";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";
import { useStores } from "../../../store/context";
import { useWidgetConfig } from "../../../../widget-config";
import type { ContextFolder } from "../../../../core/storage";

/**
 * The composer's context picker: one row per cloud account the host reports,
 * that account's rooms one level down — or, with `hideContextClouds`, the
 * rooms straight at the root. Attachment entries and the web-search
 * switch live in the paperclip menu next door, the reasoning "Effort" picker
 * in the model picker — this menu is only about *which room the model sees*,
 * so with no clouds to offer it is not rendered at all.
 */
const ComposerActionSettings = () => {
  const { Button, DropdownMenu, HelpButton, IconButton, TooltipIconButton } =
    useComponents();
  const { roomContextHelpUrl, hideContextClouds } = useWidgetConfig();
  const [isOpen, setIsOpen] = React.useState(false);
  const { useCloudsStore } = useStores();
  const { t } = useI18n();
  const contextFolders = useCloudsStore((s) => s.contextFolders);
  const fetchContextFolders = useCloudsStore((s) => s.fetchContextFolders);
  const selectedContextFolder = useCloudsStore((s) => s.selectedContextFolder);
  const selectContextFolder = useCloudsStore((s) => s.selectContextFolder);
  // The menu is rendered controlled so a room pick can close it: a flyout
  // submenu is its own Radix root, and selecting a row inside it dismisses
  // only that root — the outer menu would otherwise stay open.

  // Read on mount so the row is already there (or already absent) the
  // first time the menu opens, rather than popping in mid-hover.
  React.useEffect(() => {
    void fetchContextFolders();
  }, [fetchContextFolders]);

  // The glyph names the first level of the menu: a cloud where the rows are
  // accounts, a room where the rooms are listed straight away.
  const trigger = (
    <TooltipIconButton tooltip={t("Settings")} visible={!isOpen}>
      <IconButton
        iconName={hideContextClouds ? "btn-room" : "btn-cloud"}
        size={20}
        className="cursor-pointer rounded-[4px] outline-none text-[var(--composer-settings-button-color,var(--icon-button-color))] hover:enabled:text-[var(--composer-settings-button-hover-color,var(--text-normal))]"
        isActive={isOpen}
        data-testid="composer-settings-button"
      />
    </TooltipIconButton>
  );

  // Nothing to offer, nothing to open: the cog only ever lists clouds.
  if (contextFolders.length === 0) return null;

  // Room ids are only unique within their cloud, so a row's id and the
  // selected-match carry both halves.
  const roomRow = (
    cloud: string,
    room: ContextFolder["rooms"][number]
  ): DropDownItemProps => ({
    id: hideContextClouds
      ? `context-room:${cloud}:${room.id}`
      : `context-room:${room.id}`,
    text: room.name,
    "data-testid": "context-menu-room",
    icon: <IconButton iconName="btn-room" size={24} disableHover />,
    checked:
      selectedContextFolder?.cloud === cloud &&
      selectedContextFolder.room.id === room.id,
    onClick: () => {
      setIsOpen(false);
      selectContextFolder(cloud, room);
    },
  });

  // Each cloud is a root row of its own — the host's hierarchy starts at
  // the account, so the menu does too: cloud → its rooms. Only clouds with
  // rooms make it into `contextFolders`, so an empty picker never shows.
  // A host that is one cloud to the widget skips that level and lists the
  // rooms at the root.
  const items: DropDownItemProps[] = hideContextClouds
    ? contextFolders.flatMap((folder) =>
        folder.rooms.map((room) => roomRow(folder.cloud, room))
      )
    : contextFolders.map((folder) => ({
        id: `context-cloud:${folder.cloud}`,
        text: folder.cloud,
        "data-testid": "context-menu-cloud",
        icon: <IconButton iconName="onlyoffice" size={24} disableHover />,
        onClick: () => {
          // ignore — the row only opens its submenu
        },
        subMenu: folder.rooms.map((room) => roomRow(folder.cloud, room)),
      }));

  // The heading names the menu's job — rows below are accounts, not
  // settings — and the "i" explains what connecting a room does.
  const header = (
    <div
      data-testid="composer-settings-header"
      className="flex items-center gap-[var(--dropdown-item-gap,10px)] ps-[var(--dropdown-item-padding-start-text,16px)] pe-[var(--dropdown-item-padding-end-control,8px)] pb-[4px] leading-[var(--lh-16)] text-[var(--text-secondary)]"
    >
      <span dir="auto" className="min-w-0 truncate">
        {t("AddRoomContext")}
      </span>
      <HelpButton
        side="top"
        align="start"
        sideOffset={4}
        aria-label={t("AddRoomContext")}
        data-testid="composer-settings-help"
        content={
          <div className="flex flex-col items-start gap-[12px] p-[16px] max-w-[var(--composer-settings-hint-max-width,280px)] leading-[var(--lh-16)] text-[var(--text-normal)]">
            <p>{t("AddRoomContextDescription")}</p>
            {roomContextHelpUrl ? (
              <Button
                variant="default"
                data-testid="composer-settings-read-more"
                onClick={() =>
                  window.open(roomContextHelpUrl, "_blank", "noopener")
                }
              >
                {t("ReadMore")}
              </Button>
            ) : null}
          </div>
        }
      />
    </div>
  );

  return (
    <DropdownMenu
      trigger={trigger}
      items={items}
      headerContent={header}
      headerAtRootOnly
      backRowLabel
      open={isOpen}
      onOpenChange={setIsOpen}
      // Capped like the model picker, so a long room name truncates on its
      // row instead of stretching the panel to fit it.
      contentClassName="min-w-[var(--dropdown-context-menu-min-width)]"
      maxWidth="min(var(--dropdown-context-menu-max-width), var(--radix-dropdown-menu-content-available-width))"
      data-testid="composer-settings-menu"
    />
  );
};

export { ComposerActionSettings };
