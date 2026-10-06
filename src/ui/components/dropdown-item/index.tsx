import { Item } from "@radix-ui/react-dropdown-menu";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../providers/LocalesProvider";
import { cn } from "../../../shared/utils";
import { useTheme } from "../../providers/ThemeProvider/context";
import { DropdownMenu } from "../dropdown";
import { HelpButton } from "../help-button";
import { IconButton } from "../icon-button";
import { ToggleButton } from "../toggle-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import { useIsTruncated } from "../../hooks/useIsTruncated";
import { useWidgetConfig } from "../../../widget-config";
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
  trailingText,
  subMenu,
  subMenuClassName,
  subMenuMaxHeight,
  subMenuIcon,
  subMenuIconSize,
  checked,
  tooltipText,
  withTruncateTooltip,
  withSpace,
  withAbout,
  aboutContent,
  variant = "menu",
  navigation = "flyout",
  onDrill,
  "data-testid": dataTestId = "dropdown-item",
}: DropDownItemProps) => {
  const { isRTL } = useI18n();
  const { portalContainer } = useTheme();
  const { aboutButtonSize = 20 } = useWidgetConfig();

  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  const [submenuSide, setSubmenuSide] = useState<"left" | "right" | "top">(
    isRTL ? "left" : "right"
  );
  const [submenuAlign, setSubmenuAlign] = useState<"start" | "end">("start");

  const itemRef = useRef<HTMLDivElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const mouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);

  // Only offer the label tooltip when `truncate` actually clips the text.
  const { ref: labelRef, isTruncated: isLabelTruncated } =
    useIsTruncated<HTMLSpanElement>();

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
      <div className="w-full border-t border-[var(--drop-down-menu-separator-color)] my-[var(--dropdown-separator-margin-y,4px)] shrink-0" />
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

  // Use `Element` (not `HTMLElement`): clicking the about/help button hits
  // its inner `<svg>` icon, which is an `SVGElement` — `instanceof
  // HTMLElement` would be false and the guard would be skipped. `Element`
  // covers both and still exposes `.closest`.
  const isAboutClick = (e: React.MouseEvent) =>
    e.target instanceof Element &&
    Boolean(
      e.target.closest("[data-slot='tooltip-trigger']") ||
      e.target.closest("[data-slot='tooltip-content']")
    );

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isAboutClick(e)) return;

    if (toggleDisabled) return;

    onToggleChange?.(!toggleChecked);
  };

  // A click on the row's about/help button bubbles up to the Radix item,
  // whose own click handler would select the row: run the leaf action, drill
  // into the submenu, or close the menu — and the hint popover with it.
  // Radix composes this handler before its own and skips selection once the
  // event is default-prevented, so the hint opens and the row stays put.
  const handleRowClick = (e: React.MouseEvent) => {
    if (!withAbout || !isAboutClick(e)) return;
    e.stopPropagation();
    e.preventDefault();
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
    trailingText ||
    subMenu ||
    checked ||
    (withToggle && onToggleChange) ||
    withAbout
  );
  const hasLeadingIcon = Boolean(icon) || Boolean(withSpace);
  const isCombobox = variant === "combobox";

  // A string icon maps to an always-rendering IconButton, but an element icon
  // can itself render to null — and there's no way to know that before React
  // renders it. So for element icons we let CSS correct the row: when the
  // leading slot ends up empty the row falls back to text-row indentation
  // (see the `:has(.dd-leading:empty)` variants below). `withSpace`
  // deliberately reserves the icon column with no icon, so it must keep the
  // icon indentation — hence gating on an element icon, not on the empty slot.
  const isElementIcon = Boolean(icon) && typeof icon !== "string";

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

  const labelText = (
    <span
      ref={withTruncateTooltip ? labelRef : undefined}
      dir="auto"
      className={cn(
        "truncate font-normal text-[var(--drop-down-menu-item-color)]",
        withSpace ? "ms-[var(--dropdown-item-label-space,28px)]" : "",
        isElementIcon
          ? "[.dd-leading:empty+&]:ms-[var(--dropdown-item-label-space,28px)]"
          : "",
        trailingIcon ? "flex-1" : ""
      )}
    >
      {text}
    </span>
  );

  // The label only gains a tooltip once `truncate` actually clips it. The
  // trigger's `data-slot` is overridden so `isAboutClick` doesn't mistake a
  // click on the label for a click on the row's about/help button.
  const label =
    withTruncateTooltip && !tooltipText && isLabelTruncated ? (
      <Tooltip>
        <TooltipTrigger asChild data-slot="dropdown-item-label">
          {labelText}
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={4}
          className="max-w-[272px] whitespace-normal break-words"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    ) : (
      labelText
    );

  const itemContent = (
    <Item
      className={cn(
        "dropdown-menu-item group",
        "flex items-center justify-between gap-[var(--dropdown-item-gap,10px)] min-w-0 w-full max-w-full min-h-[var(--dropdown-item-height,26px)] h-[var(--dropdown-item-height,26px)] select-none cursor-pointer",
        paddingClass,
        "outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 border-0",
        "hover:bg-[var(--drop-down-menu-item-hover-color)] hover:text-[var(--drop-down-menu-item-hover-color)]",
        "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
        isActive || (subMenu && isSubMenuOpen)
          ? "bg-[var(--drop-down-menu-item-active-color)] text-[var(--drop-down-menu-item-active-color)]"
          : ""
      )}
      onSelect={withToggle ? (e) => e.preventDefault() : onSelect}
      onClick={withToggle ? handleToggleClick : handleRowClick}
      onMouseEnter={!isDrill && !subMenuIcon ? handleMouseEnter : undefined}
      ref={itemRef}
      dir={isRTL ? "rtl" : "ltr"}
      data-testid={dataTestId}
    >
      <div
        className={cn(
          "flex items-center gap-[var(--dropdown-item-content-gap,4px)] min-w-0 flex-1"
        )}
      >
        {/* `display: contents` so the icon stays a direct flex child (gap
            intact); when the icon renders null the wrapper has no children,
            so it produces no box (no stray gap) and matches `:empty`. */}
        <span className="dd-leading contents">
          {icon && typeof icon === "string" ? (
            <IconButton iconName={icon} size={iconSize} disableHover />
          ) : (
            (icon ?? null)
          )}
        </span>
        {label}
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
          <HelpButton
            size={aboutButtonSize}
            side="top"
            align="center"
            sideOffset={4}
            content={aboutContent}
            data-testid={`${dataTestId}-help-button`}
          />
        ) : null}
        {trailingText ? (
          <span
            dir="auto"
            className="ms-auto shrink-0 truncate ps-[var(--dropdown-item-gap,10px)] text-[var(--text-secondary)]"
          >
            {trailingText}
          </span>
        ) : null}
      </div>

      {subMenu && isDrill ? (
        subMenuIcon ? (
          // "More"-style row: reveal on row hover/focus, click drills in.
          // stopPropagation so the row's own onSelect (leaf action) doesn't
          // also fire.
          <div
            className="pointer-coarse:opacity-100 opacity-0 group-hover:opacity-100 focus-within:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDrill?.();
            }}
          >
            <IconButton
              iconName={subMenuIcon}
              size={subMenuIconSize ?? 12}
              insideElement
              data-testid={`${dataTestId}-submenu-button`}
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
          // On touch devices there is no hover, so it stays visible there too —
          // otherwise the submenu would be unreachable.
          className={
            subMenuIcon
              ? "pointer-coarse:opacity-100 opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100"
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
                data-testid={`${dataTestId}-submenu-button`}
              />
            }
            items={subMenu}
            side={submenuSide}
            align={submenuAlign}
            sideOffset={8}
            alignOffset={isHorizontalSide ? -8 : 0}
            open={subMenuIcon ? undefined : isSubMenuOpen}
            // The hover flyout is its own Radix root nested in the parent
            // menu. As a modal it would lock pointer events on everything
            // outside itself — the parent's rows included — for as long as
            // it is open, and it opens the moment the pointer enters this
            // row: a click on the row's about button never reached it. A
            // click-opened "more" menu keeps the modal default.
            modal={subMenuIcon ? undefined : false}
            contentClassName={subMenuClassName}
            maxHeight={subMenuMaxHeight}
            dropdownRef={submenuRef}
            data-testid={`${dataTestId}-submenu`}
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
            data-testid={`${dataTestId}-toggle`}
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
