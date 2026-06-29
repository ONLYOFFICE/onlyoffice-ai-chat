import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useCallback, useRef } from "react";
import { useI18n } from "../../providers/LocalesProvider";
import { cn } from "../../../shared/utils";
import { useTheme } from "../../providers/ThemeProvider/context";
import { DropDownItem } from "../dropdown-item";
import type { DropdownMenuProps } from "./DropDown.types";

const DropdownMenuComponent = ({
  trigger,
  items,
  side,
  align,
  sideOffset,
  alignOffset,
  contentClassName,
  maxWidth,
  matchTriggerWidth,
  open,
  dropdownRef,
  onOpenChange,
  headerContent,
}: DropdownMenuProps) => {
  const { isRTL } = useI18n();
  const { portalContainer } = useTheme();

  const triggerRef = useRef<HTMLElement | null>(null);
  const autoSideRef = useRef<"top" | "bottom">("bottom");
  const autoAlignRef = useRef<"start" | "end">("start");

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const decided = spaceBelow >= spaceAbove ? "bottom" : "top";
        if (!side) {
          autoSideRef.current = decided;
        }
        if (!align) {
          const pickStartInLTR = window.innerWidth - rect.left >= rect.right;
          autoAlignRef.current = isRTL
            ? pickStartInLTR
              ? "end"
              : "start"
            : pickStartInLTR
              ? "start"
              : "end";
        }
      }

      onOpenChange?.(isOpen);
    },
    [side, align, isRTL, onOpenChange]
  );

  const effectiveSide = (side ?? autoSideRef.current) as "top" | "bottom";
  const effectiveAlign = (align ?? autoAlignRef.current) as "start" | "end";

  return (
    <DropdownMenu.Root
      open={open}
      onOpenChange={handleOpenChange}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <DropdownMenu.Trigger
        asChild
        className="text-[var(--dropdown-trigger-color)]"
        ref={triggerRef as React.RefObject<HTMLButtonElement>}
      >
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalContainer ?? undefined}>
        <DropdownMenu.Content
          ref={dropdownRef}
          side={effectiveSide}
          align={effectiveAlign}
          sideOffset={sideOffset ?? 6}
          alignOffset={alignOffset}
          avoidCollisions={false}
          collisionPadding={8}
          data-side={effectiveSide}
          data-align={effectiveAlign}
          data-orientation="vertical"
          className={cn(
            "dropdown-menu border border-[var(--drop-down-menu-border-color)] rounded-[4px] shadow-[var(--drop-down-menu-shadow)] bg-[var(--drop-down-menu-background-color)] py-[5px] max-h-56 overflow-y-auto flex flex-col",
            matchTriggerWidth
              ? "min-w-[150px] w-[var(--radix-dropdown-menu-trigger-width)]"
              : "w-fit",
            contentClassName
          )}
          style={{ zIndex: 400, ...(maxWidth ? { maxWidth } : null) }}
        >
          {headerContent}
          {items.map((item, index) => (
            <DropDownItem
              key={item.id || item.text || `item-${index}`}
              {...item}
            />
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export { DropdownMenuComponent as DropdownMenu };
