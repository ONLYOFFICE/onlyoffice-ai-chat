import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useComponents } from "../../../providers/ComponentsProvider";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";
import { cn } from "../../../../shared/utils";
import { useStores } from "../../../store/context";
import { useWidgetConfig } from "../../../../widget-config";

/**
 * The connected context room, shown in the composer's bottom row next to the
 * settings cog. Its menu lists the room's skills — one switch each — and the
 * way out ("Disconnect room") unless the host hid it with
 * `hideContextRoomDisconnect`. Renders nothing while no room is connected,
 * and — with the way out hidden — nothing for a room without skills: an
 * empty `.ai` folder is not worth a button.
 */
const ComposerActionRoom = () => {
  const { DropdownMenu, IconButton } = useComponents();
  const { t } = useI18n();
  const { hideContextRoomDisconnect } = useWidgetConfig();
  const { useCloudsStore } = useStores();
  const [isOpen, setIsOpen] = React.useState(false);

  const selected = useCloudsStore((s) => s.selectedContextFolder);
  const roomSkills = useCloudsStore((s) => s.roomSkills);
  const disabledSkillIds = useCloudsStore((s) => s.disabledSkillIds);
  const setSkillEnabled = useCloudsStore((s) => s.setSkillEnabled);
  const clearContextFolder = useCloudsStore((s) => s.clearContextFolder);

  // The store reads the skills when the room is picked and resets the list
  // on a switch, so the menu never shows the previous room's skills.
  if (!selected) return null;

  const items: DropDownItemProps[] = roomSkills.map((skill) => ({
    id: `room-skill:${skill.id}`,
    text: skill.name,
    icon: <IconButton iconName="code.small" size={24} disableHover />,
    onClick: () => {
      // ignore — the switch is the control
    },
    withToggle: true,
    toggleChecked: !disabledSkillIds.includes(skill.id),
    onToggleChange: (checked: boolean) => {
      setSkillEnabled(skill.id, checked);
    },
  }));

  if (!hideContextRoomDisconnect) {
    if (items.length > 0) {
      items.push({
        text: "",
        onClick: () => {
          // ignore
        },
        isSeparator: true,
      });
    }

    items.push({
      id: "disconnect-room",
      text: t("DisconnectRoom"),
      onClick: () => {
        setIsOpen(false);
        clearContextFolder();
      },
    });
  }

  // Nothing to switch and no way out: the room has nothing to show.
  if (items.length === 0) return null;

  // A bordered chip in the composer box, above the input: room icon, name,
  // chevron — the same metrics as a combobox trigger, so it reads as a
  // control rather than a tag.
  const trigger = (
    <div
      data-testid="composer-room-button"
      title={selected.room.name}
      className={cn(
        "inline-flex items-center gap-[4px] min-w-0 box-border cursor-pointer select-none",
        "h-[var(--chat-composer-room-height,26px)] max-w-[var(--chat-composer-room-max-width,220px)] ps-[2px] pe-[4px]",
        "rounded-[var(--input-border-radius,4px)] border",
        "text-[var(--input-color)] text-[length:var(--chat-model-selector-font-size,var(--fs-12,12px))] leading-[var(--lh-16)]",
        // A block on the composer surface, like the attachment chips: the
        // input tokens are a different grey from the composer in the dark
        // themes of hosts that give both their own surface.
        isOpen
          ? "bg-[var(--chat-composer-room-hover-background-color)] border-[var(--input-active-border-color)]"
          : "bg-[var(--chat-composer-room-background-color)] border-[var(--chat-composer-room-border-color)] hover:bg-[var(--chat-composer-room-hover-background-color)]"
      )}
    >
      {/* Both glyphs take the same paint as the model picker's chevron:
          `--icon-button-color` is a dimmer grey in the dark themes and left
          them washed out next to the white room name. */}
      <IconButton
        iconName="btn-room"
        size={24}
        color="var(--chat-composer-room-icon-color,var(--icon-normal))"
        insideElement
        disableHover
        className="shrink-0"
      />
      <span dir="auto" className="min-w-0 truncate">
        {selected.room.name}
      </span>
      <IconButton
        iconName="arrow"
        size={16}
        width={7}
        height={4}
        color="var(--chat-composer-room-icon-color,var(--icon-normal))"
        isStroke
        insideElement
        disableHover
        className={cn("shrink-0 transition-transform", {
          "rotate-180": isOpen,
        })}
      />
    </div>
  );

  // The box is a column of stretched children; the chip must keep its own
  // width, so it gets a row of its own.
  return (
    <div className="flex flex-row min-w-0">
      <DropdownMenu
        trigger={trigger}
        items={items}
        open={isOpen}
        onOpenChange={setIsOpen}
        side="bottom"
        align="start"
        contentClassName="min-w-[var(--chat-composer-room-menu-min-width,240px)]"
      />
    </div>
  );
};

export { ComposerActionRoom };
