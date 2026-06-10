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
    return (
      <div className="h-px min-h-[1px] w-full bg-[var(--drop-down-menu-separator-color)] my-[4px] flex-shrink-0" />
    );

  const onSelect = (e: Event) => {
    if (withToggle) {
      e.stopPropagation();
      e.preventDefault();
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

  const itemContent = (
    <Item
      className={cn(
        "dropdown-menu-item",
        "flex items-center justify-between gap-[32px] min-w-0 w-full max-w-full min-h-[32px] h-[32px] px-[12px] select-none cursor-pointer",
        "outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 border-0",
        "hover:bg-[var(--drop-down-menu-item-hover-color)] hover:text-[var(--drop-down-menu-item-hover-color)]",
        "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
        isActive || (subMenu && isSubMenuOpen)
          ? "bg-[var(--drop-down-menu-item-active-color)] text-[var(--drop-down-menu-item-active-color)]"
          : ""
      )}
      onSelect={withToggle ? (e) => e.preventDefault() : onSelect}
      onClick={withToggle ? handleToggleClick : undefined}
      onMouseEnter={subMenuIcon ? undefined : handleMouseEnter}
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
                size={24}
                disableHover
                isStroke
                onClick={() => setIsAboutOpen((val) => !val)}
              />
            </TooltipTrigger>
            <TooltipContent side={undefined} sideOffset={4} isAbout>
              {aboutContent}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {subMenu ? (
        <div onClick={subMenuIcon ? (e) => e.stopPropagation() : undefined}>
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
