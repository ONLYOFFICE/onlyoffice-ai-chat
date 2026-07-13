import { Item } from "@radix-ui/react-dropdown-menu";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../providers/LocalesProvider";
import { cn } from "../../../shared/utils";
import { useTheme } from "../../providers/ThemeProvider/context";
import { DropdownMenu } from "../dropdown";
import { IconButton } from "../icon-button";
import { ToggleButton } from "../toggle-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import type { DropDownItemProps } from "./DropDownItem.types";

const SUBMENU_WIDTH = 300;
const SUBMENU_MARGIN = 8;

// Horizontal padding per row layout, as overridable CSS tokens (see
// styles/index.css for the defaults). The start and end edges are resolved
// independently from the row's "kind"; combobox keeps its own symmetric pair.
const START_PADDING = {
  combobox: "ps-[var(--dropdown-item-padding-start-combobox,8px)]",
  icon: "ps-[var(--dropdown-item-padding-start-icon,4px)]",
  text: "ps-[var(--dropdown-item-padding-start-text,16px)]",
} as const;

const END_PADDING = {
  combobox: "pe-[var(--dropdown-item-padding-end-combobox,8px)]",
  control: "pe-[var(--dropdown-item-padding-end-control,8px)]",
  icon: "pe-[var(--dropdown-item-padding-end-icon,20px)]",
  text: "pe-[var(--dropdown-item-padding-end-text,16px)]",
} as const;

const DropDownItem = ({
  text,
  icon,
  iconSize = 24,
  onClick,
  isActive,
  isSeparator,
  withToggle,
  toggleChecked,
  onToggleChange,
  toggleDisabled,
  trailingIcon,
  trailingIconSize = 16,
  subMenu,
  subMenuClassName,
  subMenuIcon,
  subMenuIconSize,
  checked,
  tooltipText,
  withSpace,
  withAbout,
  aboutContent,
  variant = "menu",
  navigation = "flyout",
  onDrill,
}: DropDownItemProps) => {
  const { isRTL } = useI18n();
  const { portalContainer } = useTheme();

  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  const [submenuSide, setSubmenuSide] = useState<"left" | "right" | "top">(
    isRTL ? "left" : "right"
  );
  const [submenuAlign, setSubmenuAlign] = useState<"start" | "end">("start");
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const itemRef = useRef<HTMLDivElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const mouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (mouseMoveRef.current) {
        window.removeEventListener("mousemove", mouseMoveRef.current);
        mouseMoveRef.current = null;
      }
    };
  }, []);

  if (isSeparator)
    // A 1px-tall background bar rounds away at fractional zoom levels; a top
    // border is snapped to the device pixel grid by the browser and stays
    // visible across scales.
    return (
      <div className="w-full border-t border-[var(--drop-down-menu-separator-color)] my-[4px] shrink-0" />
    );

  const isDrill = navigation === "drilldown";

  const onSelect = (e: Event) => {
    if (withToggle) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    // Drill-down: a folder row (has subMenu, no explicit "more" icon) descends
    // in place instead of running a leaf action; keep the menu open. A
    // subMenuIcon row keeps its own leaf onClick and drills via the icon only.
    if (isDrill && subMenu && !subMenuIcon) {
      e.preventDefault();
      onDrill?.();
      return;
    }
    onClick(e);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Use `Element` (not `HTMLElement`): clicking the about/help button hits
    // its inner `<svg>` icon, which is an `SVGElement` — `instanceof
    // HTMLElement` would be false and the guard would be skipped, toggling
    // the row. `Element` covers both and still exposes `.closest`.
    if (
      e.target instanceof Element &&
      (e.target.closest("[data-slot='tooltip-trigger']") ||
        e.target.closest("[data-slot='tooltip-content']"))
    )
      return;

    if (toggleDisabled) return;

    onToggleChange?.(!toggleChecked);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!itemRef.current || !submenuRef.current) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const itemRect = itemRef.current.getBoundingClientRect();
    const submenuRect = submenuRef.current?.getBoundingClientRect();

    const isInsideItem =
      mouseX >= itemRect.left &&
      mouseX <= itemRect.right &&
      mouseY >= itemRect.top &&
      mouseY <= itemRect.bottom;

    const isInsideSubmenu =
      submenuRect &&
      mouseX >= submenuRect.left &&
      mouseX <= submenuRect.right &&
      mouseY >= submenuRect.top &&
      mouseY <= submenuRect.bottom;

    const nestedDropdowns = document.querySelectorAll(".dropdown-menu");
    const isInsideNestedDropdown = Array.from(nestedDropdowns).some((el) => {
      if (el === submenuRef.current) return false;
      if (el.contains(itemRef.current)) return false;
      const rect = el.getBoundingClientRect();
      return (
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom
      );
    });

    if (!isInsideItem && !isInsideSubmenu && !isInsideNestedDropdown) {
      setIsSubMenuOpen(false);
      window.removeEventListener("mousemove", handleMouseMove);
      mouseMoveRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    if (isSubMenuOpen || !subMenu) return;
    if (!itemRef.current) return;

    const rect = itemRef.current.getBoundingClientRect();
    const container = portalContainer ?? document.documentElement;
    const cRect = container.getBoundingClientRect();

    const spaceRight = cRect.right - rect.right;
    const spaceLeft = rect.left - cRect.left;

    const preferred = isRTL ? "left" : "right";
    const opposite = isRTL ? "right" : "left";
    const preferSpace = isRTL ? spaceLeft : spaceRight;
    const oppositeSpace = isRTL ? spaceRight : spaceLeft;

    let side: "left" | "right" | "top";
    let align: "start" | "end" = "start";

    if (preferSpace >= SUBMENU_WIDTH + SUBMENU_MARGIN) {
      side = preferred;
    } else if (oppositeSpace >= SUBMENU_WIDTH + SUBMENU_MARGIN) {
      side = opposite;
    } else {
      side = "top";
      if (rect.left + SUBMENU_WIDTH > cRect.right - SUBMENU_MARGIN) {
        align = "end";
      }
    }

    setSubmenuSide(side);
    setSubmenuAlign(align);
    setIsSubMenuOpen(true);
    mouseMoveRef.current = handleMouseMove;
    window.addEventListener("mousemove", handleMouseMove);
  };

  const isHorizontalSide = submenuSide === "left" || submenuSide === "right";

  // Whether the row ends with an interactive control (these sit on the end
  // edge and supply their own visual weight, so the row's end padding tightens).
  const hasTrailingControl = Boolean(
    trailingIcon ||
    subMenu ||
    checked ||
    (withToggle && onToggleChange) ||
    withAbout
  );
  const hasLeadingIcon = Boolean(icon) || Boolean(withSpace);
  const isCombobox = variant === "combobox";

  // Classify each edge into a row "kind", then look up its padding class.
  // Start: icon rows indent less than plain text rows. End: a trailing control
  // tightens the edge; otherwise it mirrors the start (icon vs text). Combobox
  // overrides both with its own symmetric padding.
  const startKind = isCombobox ? "combobox" : hasLeadingIcon ? "icon" : "text";
  const endKind = isCombobox
    ? "combobox"
    : hasTrailingControl
      ? "control"
      : hasLeadingIcon
        ? "icon"
        : "text";

  const paddingClass = cn(START_PADDING[startKind], END_PADDING[endKind]);

  const itemContent = (
    <Item
      className={cn(
        "dropdown-menu-item group",
        "flex items-center justify-between gap-[10px] min-w-0 w-full max-w-full min-h-[26px] h-[26px] select-none cursor-pointer",
        paddingClass,
        "outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 border-0",
        "hover:bg-[var(--drop-down-menu-item-hover-color)] hover:text-[var(--drop-down-menu-item-hover-color)]",
        "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
        isActive || (subMenu && isSubMenuOpen)
          ? "bg-[var(--drop-down-menu-item-active-color)] text-[var(--drop-down-menu-item-active-color)]"
          : ""
      )}
      onSelect={withToggle ? (e) => e.preventDefault() : onSelect}
      onClick={withToggle ? handleToggleClick : undefined}
      onMouseEnter={!isDrill && !subMenuIcon ? handleMouseEnter : undefined}
      ref={itemRef}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className={cn("flex items-center gap-[4px] min-w-0 flex-1")}>
        {icon && typeof icon === "string" ? (
          <IconButton iconName={icon} size={iconSize} disableHover />
        ) : (
          (icon ?? null)
        )}
        <span
          dir="auto"
          className={cn(
            "truncate font-normal text-[var(--drop-down-menu-item-color)]",
            withSpace ? "ms-[28px]" : "",
            trailingIcon ? "flex-1" : ""
          )}
        >
          {text}
        </span>
        {trailingIcon && typeof trailingIcon === "string" ? (
          <IconButton
            iconName={trailingIcon}
            size={trailingIconSize}
            disableHover
            isStroke
          />
        ) : (
          (trailingIcon ?? null)
        )}
        {withAbout ? (
          <Tooltip open={isAboutOpen}>
            <TooltipTrigger asChild>
              <IconButton
                iconName="btn-menu-about"
                size={20}
                disableHover
                noColor
                onClick={() => setIsAboutOpen((val) => !val)}
              />
            </TooltipTrigger>
            <TooltipContent side={undefined} sideOffset={4} isAbout>
              {aboutContent}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {subMenu && isDrill ? (
        subMenuIcon ? (
          // "More"-style row: reveal on row hover/focus, click drills in.
          // stopPropagation so the row's own onSelect (leaf action) doesn't
          // also fire.
          <div
            className="opacity-0 group-hover:opacity-100 focus-within:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDrill?.();
            }}
          >
            <IconButton
              iconName={subMenuIcon}
              size={subMenuIconSize ?? 12}
              insideElement
            />
          </div>
        ) : (
          // Folder-style row: a plain chevron indicator with no hover of its
          // own — the whole row is the drill target (via onSelect).
          <IconButton
            iconName="arrow.right"
            size={12}
            insideElement
            isStroke
            disableHover
            className={isRTL ? "rotate-180" : ""}
          />
        )
      ) : null}

      {subMenu && !isDrill ? (
        <div
          onClick={subMenuIcon ? (e) => e.stopPropagation() : undefined}
          // The "more" trigger only reveals on row hover/focus (or while its
          // menu is open), kept in layout via opacity so the row doesn't shift.
          // The plain submenu chevron (no subMenuIcon) stays always visible.
          className={
            subMenuIcon
              ? "opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100"
              : undefined
          }
        >
          <DropdownMenu
            trigger={
              <IconButton
                iconName={subMenuIcon ?? "arrow.right"}
                size={subMenuIconSize ?? 12}
                insideElement
                isStroke={!subMenuIcon}
                className={!subMenuIcon && isRTL ? "rotate-180" : ""}
              />
            }
            items={subMenu}
            side={submenuSide}
            align={submenuAlign}
            sideOffset={8}
            alignOffset={isHorizontalSide ? -8 : 0}
            open={subMenuIcon ? undefined : isSubMenuOpen}
            contentClassName={cn("max-w-[300px]", subMenuClassName)}
            dropdownRef={submenuRef}
          />
        </div>
      ) : null}
      {checked ? (
        <IconButton iconName="checked" size={16} disableHover isStroke />
      ) : null}
      {withToggle && onToggleChange ? (
        <div onClick={(e) => e.stopPropagation()}>
          <ToggleButton
            checked={toggleChecked ?? false}
            onCheckedChange={onToggleChange}
            disabled={toggleDisabled}
          />
        </div>
      ) : null}
    </Item>
  );

  if (tooltipText) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{itemContent}</TooltipTrigger>
        <TooltipContent side={undefined} sideOffset={4}>
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    );
  }

  return itemContent;
};

export { DropDownItem };
