import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRef, useState } from "react";
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
}: DropdownMenuProps) => {
  const { isRTL } = useI18n();
  const { portalContainer } = useTheme();

  const triggerRef = useRef<HTMLElement | null>(null);
  const [computedSide, setComputedSide] = useState<typeof side>(side);
  const [computedAlign, setComputedAlign] = useState<typeof align>(align);

  const handleOpenChange = (next: boolean) => {
    if (next && triggerRef.current && (!side || !align)) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Measure against the viewport: portalContainer is a dedicated empty
      // node used only for scoping preflight, so its rect is 0×0 and unusable.
      const viewportWidth =
        window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight;

      if (!side) {
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        setComputedSide(spaceBelow >= spaceAbove ? "bottom" : "top");
      }

      if (!align) {
        const spaceForStart = viewportWidth - rect.left;
        const spaceForEnd = rect.right;
        const pickStartInLTR = spaceForStart >= spaceForEnd;
        setComputedAlign(
          isRTL
            ? pickStartInLTR
              ? "end"
              : "start"
            : pickStartInLTR
              ? "start"
              : "end"
        );
      }
    }

    onOpenChange?.(next);
  };

  const effectiveSide = side ?? computedSide ?? "bottom";
  const effectiveAlign = align ?? computedAlign ?? "start";

  return (
    <DropdownMenu.Root
      open={open}
      onOpenChange={handleOpenChange}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <DropdownMenu.Trigger
        asChild
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
        collisionPadding={8}
        data-side={effectiveSide}
        data-align={effectiveAlign}
        data-orientation="vertical"
        className={cn(
          "dropdown-menu z-50 border border-[var(--drop-down-menu-border-color)] rounded-[8px] shadow-[var(--drop-down-menu-shadow)] bg-[var(--drop-down-menu-background-color)] py-[8px] max-h-56 overflow-y-auto flex flex-col gap-[4px]",
          matchTriggerWidth
            ? "min-w-[150px] w-[var(--radix-dropdown-menu-trigger-width)]"
            : "w-fit",
          contentClassName
        )}
        style={maxWidth ? { maxWidth } : undefined}
      >
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
