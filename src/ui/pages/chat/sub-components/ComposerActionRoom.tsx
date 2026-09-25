import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useComponents } from "../../../providers/ComponentsProvider";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";
import { cn } from "../../../../shared/utils";
import { useStores } from "../../../store/context";

/**
 * The connected context room, shown in the composer's bottom row next to the
 * settings cog. Its menu lists the room's skills — one switch each — and the
 * way out ("Disconnect room"). Renders nothing while no room is connected.
 */
const ComposerActionRoom = () => {
  const { DropdownMenu, IconButton } = useComponents();
  const { t } = useI18n();
  const { useCloudsStore } = useStores();
  const [isOpen, setIsOpen] = React.useState(false);

  const selected = useCloudsStore((s) => s.selectedContextFolder);
  const roomSkills = useCloudsStore((s) => s.roomSkills);
  const disabledSkillIds = useCloudsStore((s) => s.disabledSkillIds);
  const fetchRoomSkills = useCloudsStore((s) => s.fetchRoomSkills);
  const setSkillEnabled = useCloudsStore((s) => s.setSkillEnabled);
  const clearContextFolder = useCloudsStore((s) => s.clearContextFolder);

  // Re-read whenever the connected room changes; the store resets the list
  // on selection, so the menu never shows the previous room's skills.
  const cloud = selected?.cloud;
  const roomId = selected?.room.id;
  React.useEffect(() => {
    if (!cloud || !roomId) return;
    void fetchRoomSkills();
  }, [cloud, roomId, fetchRoomSkills]);

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

  const trigger = (
    <div
      data-testid="composer-room-button"
      title={selected.room.name}
      className={cn(
        "h-[var(--combo-box-height,24px)] max-w-[var(--chat-composer-room-max-width,160px)] rounded-[4px] ps-[6px] pe-[4px] box-border",
        "cursor-pointer flex items-center gap-[4px] min-w-0",
        "text-[var(--input-color)] text-[length:var(--chat-model-selector-font-size,var(--fs-12,12px))] leading-[var(--lh-16)]",
        isOpen
          ? "bg-[var(--icon-button-active-background-color,var(--input-hover-background-color))]"
          : "hover:bg-[var(--input-hover-background-color)]"
      )}
    >
      <span dir="auto" className="min-w-0 truncate">
        {selected.room.name}
      </span>
      <IconButton
        iconName="arrow"
        size={16}
        width={7}
        height={4}
        isStroke
        insideElement
        disableHover
        className={cn("shrink-0 transition-transform", {
          "rotate-180": isOpen,
        })}
      />
    </div>
  );

  return (
    <DropdownMenu
      trigger={trigger}
      items={items}
      open={isOpen}
      onOpenChange={setIsOpen}
      contentClassName="min-w-[var(--chat-composer-room-menu-min-width,240px)]"
    />
  );
};

export { ComposerActionRoom };
