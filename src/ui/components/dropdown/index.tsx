import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useCallback, useMemo, useRef, useState } from "react";
import { useI18n } from "../../providers/LocalesProvider";
import { cn } from "../../../shared/utils";
import { useTheme } from "../../providers/ThemeProvider/context";
import { useWidgetConfig } from "../../../widget-config";
import { DropDownItem } from "../dropdown-item";
import { IconButton } from "../icon-button";
import type { DropDownItemProps } from "../dropdown-item/DropDownItem.types";
import type { DropdownMenuProps } from "./DropDown.types";

// Shared shell for both navigation modes: Radix Root/Trigger/Portal/Content,
// collision-aware side/align inference, and the menu container classes. The
// flyout and drill-down branches differ only in what they render as children.
type ShellProps = {
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "bottom" | "top" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
  contentClassName?: string;
  maxWidth?: number | string;
  matchTriggerWidth?: boolean;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  onContentKeyDown?: (e: React.KeyboardEvent) => void;
  children: React.ReactNode;
};

const Shell = ({
  trigger,
  open,
  onOpenChange,
  side,
  align,
  sideOffset,
  alignOffset,
  contentClassName,
  maxWidth,
  matchTriggerWidth,
  dropdownRef,
  onContentKeyDown,
  children,
}: ShellProps) => {
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
        className="text-[var(--dropdown-trigger-color,var(--icon-button-color))] hover:enabled:text-[var(--dropdown-trigger-hover-color,var(--text-normal))]"
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
          onKeyDown={onContentKeyDown}
          className={cn(
            "dropdown-menu border border-[var(--drop-down-menu-border-color)] rounded-[4px] shadow-[var(--drop-down-menu-shadow)] bg-[var(--drop-down-menu-background-color)] py-[var(--dropdown-menu-padding-y)] max-h-56 overflow-y-auto flex flex-col",
            matchTriggerWidth
              ? "min-w-[var(--dropdown-menu-min-width)] w-[var(--radix-dropdown-menu-trigger-width)]"
              : "w-fit",
            contentClassName
          )}
          // Cap to the space Radix measured inside the boundary so a menu
          // wider/taller than the host shrinks and scrolls instead of
          // overflowing. (These vars are populated only with collision
          // avoidance on, which is the default now that `avoidCollisions` is
          // no longer disabled.)
          style={{
            zIndex: 400,
            maxWidth:
              maxWidth ?? "var(--radix-dropdown-menu-content-available-width)",
            maxHeight:
              "min(14rem, var(--radix-dropdown-menu-content-available-height))",
          }}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

// Resolve the visible level by walking `path` (a list of child indices) from
// the live `items` tree. Re-derived every render so an external `items` rebuild
// (e.g. flipping a tool toggle inside a submenu rebuilds the whole tree) keeps
// the user at the same depth with fresh data instead of snapshotting a stale
// level. Any index that no longer points at a submenu truncates the path, so a
// structurally changed tree falls back to the deepest still-valid level.
function resolveLevel(root: DropDownItemProps[], path: number[]) {
  let level = root;
  const validPath: number[] = [];
  for (const index of path) {
    const item = level[index];
    if (!item?.subMenu?.length) break;
    level = item.subMenu;
    validPath.push(index);
  }
  return { level, validPath };
}

// Drill-down "back" row: the whole row is the target and shows only a chevron
// (no label, no hover background of its own). Height is token-driven.
const BackRow = ({ onBack }: { onBack: () => void }) => {
  const { isRTL } = useI18n();
  return (
    <DropdownMenu.Item
      onSelect={(e) => {
        e.preventDefault();
        onBack();
      }}
      className={cn(
        "flex items-center select-none cursor-pointer",
        "px-[var(--dropdown-back-row-padding,8px)]",
        "h-[var(--dropdown-back-row-height,20px)] min-h-[var(--dropdown-back-row-height,20px)]",
        "outline-none focus:outline-none ring-0 border-0",
        "bg-transparent hover:bg-transparent data-[highlighted]:bg-transparent"
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <IconButton
        iconName="arrow.right"
        size={12}
        insideElement
        isStroke
        disableHover
        className={isRTL ? "" : "rotate-180"}
      />
    </DropdownMenu.Item>
  );
};

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
  variant = "menu",
  navigation,
}: DropdownMenuProps) => {
  const { isRTL } = useI18n();
  const config = useWidgetConfig();
  const mode = navigation ?? config.dropdownNavigation ?? "flyout";
  const isDrill = mode === "drilldown";

  // Navigation stack of child indices; only meaningful in drill-down mode.
  const [path, setPath] = useState<number[]>([]);

  const { level, validPath } = useMemo(
    () => resolveLevel(items, isDrill ? path : []),
    [items, path, isDrill]
  );
  const canGoBack = isDrill && validPath.length > 0;

  // Reserve the icon column on icon-less rows when the visible level has any
  // leading icon, so labels line up. Evaluated per visible level (in flyout
  // mode the level is just `items`); a per-item `withSpace` still wins.
  const hasLeadingIcon = level.some((item) => item.icon && !item.isSeparator);
  const withSpaceOf = (item: DropDownItemProps) =>
    item.withSpace ?? (hasLeadingIcon && !item.icon && !item.isSeparator);

  const handleOpenChange = (isOpen: boolean) => {
    // Reset navigation on close so reopening starts at the root.
    if (!isOpen) setPath([]);
    onOpenChange?.(isOpen);
  };

  const onContentKeyDown = isDrill
    ? (e: React.KeyboardEvent) => {
        const backKey = isRTL ? "ArrowRight" : "ArrowLeft";
        if (canGoBack && e.key === backKey) {
          e.preventDefault();
          setPath((p) => p.slice(0, -1));
        }
      }
    : undefined;

  return (
    <Shell
      trigger={trigger}
      open={open}
      onOpenChange={handleOpenChange}
      side={side}
      align={align}
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      contentClassName={contentClassName}
      maxWidth={maxWidth}
      matchTriggerWidth={matchTriggerWidth}
      dropdownRef={dropdownRef}
      onContentKeyDown={onContentKeyDown}
    >
      {canGoBack ? (
        <>
          <BackRow onBack={() => setPath((p) => p.slice(0, -1))} />
          <div className="w-full border-t border-[var(--drop-down-menu-separator-color)] my-[var(--dropdown-separator-margin-y)] shrink-0" />
        </>
      ) : null}
      {headerContent}
      {level.map((item, index) => (
        // Index-based fallback, never `text`: menus can hold duplicate names
        // (e.g. a folder literally named "New folder" alongside a built-in
        // action of the same name) that would collide as keys and swap handlers.
        <DropDownItem
          key={item.id ?? `item-${index}`}
          {...item}
          variant={variant}
          navigation={mode}
          withSpace={withSpaceOf(item)}
          onDrill={isDrill ? () => setPath((p) => [...p, index]) : undefined}
        />
      ))}
    </Shell>
  );
};

export { DropdownMenuComponent as DropdownMenu };
