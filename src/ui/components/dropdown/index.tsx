import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  maxHeight?: number | string;
  matchTriggerWidth?: boolean;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  onContentKeyDown?: (e: React.KeyboardEvent) => void;
  modal?: boolean;
  /**
   * The children own the scrolling (a scroll area plus pinned rows), so the
   * content itself must clip rather than scroll — otherwise the pinned rows
   * would scroll away with everything else.
   */
  scrollInside?: boolean;
  contentTestId?: string;
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
  maxHeight,
  matchTriggerWidth,
  dropdownRef,
  onContentKeyDown,
  modal,
  scrollInside,
  contentTestId,
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
      modal={modal}
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
          data-testid={contentTestId}
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
            "dropdown-menu border border-[var(--drop-down-menu-border-color)] rounded-[4px] shadow-[var(--drop-down-menu-shadow)] bg-[var(--drop-down-menu-background-color)] py-[var(--dropdown-menu-padding-y,5px)] max-h-56 flex flex-col",
            scrollInside ? "overflow-hidden" : "overflow-y-auto",
            matchTriggerWidth
              ? "min-w-[var(--dropdown-menu-min-width,150px)] w-[var(--radix-dropdown-menu-trigger-width)]"
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
              maxHeight ??
              "min(14rem, var(--radix-dropdown-menu-content-available-height))",
          }}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

// A navigation step addresses one row of the current level. Rows that carry an
// `id` are addressed by it, so the step survives the level being rebuilt with
// rows added, removed or reordered around it (moving a prompt into a folder
// drops it from the root level and may drop the separator too). Rows without an
// `id` fall back to their position — the old behaviour, which only holds while
// the level's composition is unchanged. The two forms are tagged apart so an
// `id` that looks like a position can't be mistaken for one.
const stepOf = (item: DropDownItemProps, index: number) =>
  item.id !== undefined ? `id:${item.id}` : `at:${index}`;

const findStep = (level: DropDownItemProps[], step: string) => {
  const value = step.slice(3);
  return step.startsWith("at:")
    ? level[Number(value)]
    : level.find((item) => item.id === value);
};

// Resolve the visible level by walking `path` (a list of steps) from the live
// `items` tree. Re-derived every render so an external `items` rebuild (e.g.
// flipping a tool toggle inside a submenu rebuilds the whole tree) keeps the
// user at the same depth with fresh data instead of snapshotting a stale level.
// Any step that no longer points at a submenu truncates the path, so a
// structurally changed tree falls back to the deepest still-valid level.
function resolveLevel(root: DropDownItemProps[], path: string[]) {
  let level = root;
  let parent: DropDownItemProps | undefined;
  const validPath: string[] = [];
  for (const step of path) {
    const item = findStep(level, step);
    if (!item?.subMenu?.length) break;
    level = item.subMenu;
    parent = item;
    validPath.push(step);
  }
  return { level, parent, validPath };
}

// Drill-down "back" row: the whole row is the target. By default it shows
// only a chevron (no label, no hover background of its own) at a token-driven
// height; with `label` it reads "‹ parent" at a regular row's height.
const BackRow = ({ onBack, label }: { onBack: () => void; label?: string }) => {
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
        label
          ? "gap-[var(--dropdown-item-gap,10px)] min-h-[var(--dropdown-item-height,26px)] h-[var(--dropdown-item-height,26px)]"
          : "h-[var(--dropdown-back-row-height,20px)] min-h-[var(--dropdown-back-row-height,20px)]",
        "outline-none focus:outline-none ring-0 border-0",
        "bg-transparent hover:bg-transparent data-[highlighted]:bg-transparent"
      )}
      dir={isRTL ? "rtl" : "ltr"}
      data-testid="dropdown-back-button"
    >
      <IconButton
        iconName="arrow.right"
        size={12}
        insideElement
        isStroke
        disableHover
        className={isRTL ? "" : "rotate-180"}
      />
      {label ? (
        <span
          dir="auto"
          className="min-w-0 truncate text-[var(--drop-down-menu-item-color)]"
        >
          {label}
        </span>
      ) : null}
    </DropdownMenu.Item>
  );
};

const DropdownMenuComponent = ({
  trigger,
  items,
  footerItems,
  side,
  align,
  sideOffset,
  alignOffset,
  contentClassName,
  maxWidth,
  maxHeight,
  matchTriggerWidth,
  open,
  dropdownRef,
  onOpenChange,
  headerContent,
  headerAtRootOnly = false,
  backRowLabel = false,
  variant = "menu",
  navigation,
  modal,
  "data-testid": dataTestId,
}: DropdownMenuProps) => {
  const { isRTL } = useI18n();
  const config = useWidgetConfig();
  const mode = navigation ?? config.dropdownNavigation ?? "flyout";
  const isDrill = mode === "drilldown";

  // Navigation stack of steps (see `stepOf`); only meaningful in drill-down mode.
  const [path, setPath] = useState<string[]>([]);

  // Footer rows are part of the tree for navigation (a footer row may drill),
  // but the root level renders them apart from the scrolling list.
  const tree = useMemo(
    () => (footerItems?.length ? [...items, ...footerItems] : items),
    [items, footerItems]
  );
  const { level, parent, validPath } = useMemo(
    () => resolveLevel(tree, isDrill ? path : []),
    [tree, path, isDrill]
  );
  const canGoBack = isDrill && validPath.length > 0;
  const atRoot = validPath.length === 0;
  const pinned = atRoot && footerItems?.length ? footerItems : null;

  // Reserve the icon column on icon-less rows when their group has any
  // leading icon, so labels line up. Evaluated per visible level (in flyout
  // mode the level is just `items`), and at a root with a pinned footer the
  // list and the footer are judged apart: an Effort row's icon must not
  // indent every profile above it. A per-item `withSpace` still wins.
  const hasIcon = (rows: DropDownItemProps[]) =>
    rows.some((item) => item.icon && !item.isSeparator);
  const listHasIcon = hasIcon(pinned ? items : level);
  const footerHasIcon = pinned ? hasIcon(pinned) : false;
  const withSpaceOf = (item: DropDownItemProps, inFooter = false) =>
    item.withSpace ??
    ((inFooter ? footerHasIcon : listHasIcon) &&
      !item.icon &&
      !item.isSeparator);

  const handleOpenChange = (isOpen: boolean) => {
    // Reset navigation on close so reopening starts at the root. Only fires
    // when Radix itself closes the menu (outside click, Escape); a controlled
    // close is caught by the effect below.
    if (!isOpen) setPath([]);
    onOpenChange?.(isOpen);
  };

  // A controlled `open` flipped to false by the host never reaches
  // `onOpenChange` (Radix only calls it for changes it initiates), so reset the
  // stack on the actual close too — otherwise the next open resumes at whatever
  // level the menu was dismissed from.
  useEffect(() => {
    if (open === false) setPath([]);
  }, [open]);

  // Navigation always moves relative to `validPath`, never the raw `path`: when
  // a rebuild has invalidated the tail, the two differ and stepping from the
  // raw path would leave the visible level unchanged ("back" appearing dead) or
  // build a step onto a dead branch ("drill" appearing dead).
  const goBack = useCallback(
    () => setPath(validPath.slice(0, -1)),
    [validPath]
  );

  // Index-based fallback, never `text`: menus can hold duplicate names
  // (e.g. a folder literally named "New folder" alongside a built-in
  // action of the same name) that would collide as keys and swap handlers.
  // `index` is the row's position in the visible level — for a pinned
  // footer row that is its position in the joined tree, so `stepOf` finds it.
  const renderRow = (
    item: DropDownItemProps,
    index: number,
    inFooter = false
  ) => (
    <DropDownItem
      key={item.id ?? `item-${index}`}
      {...item}
      variant={variant}
      navigation={mode}
      withSpace={withSpaceOf(item, inFooter)}
      onDrill={
        isDrill ? () => setPath([...validPath, stepOf(item, index)]) : undefined
      }
    />
  );

  const onContentKeyDown = isDrill
    ? (e: React.KeyboardEvent) => {
        const backKey = isRTL ? "ArrowRight" : "ArrowLeft";
        if (canGoBack && e.key === backKey) {
          e.preventDefault();
          goBack();
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
      // Drill-down reuses this one Content for every level, so a submenu of
      // long labels (recent file names) would stretch the whole menu to the
      // available width. Cap it like the flyout submenu does; rows truncate.
      maxWidth={
        maxWidth ??
        (isDrill
          ? "min(300px, var(--radix-dropdown-menu-content-available-width))"
          : undefined)
      }
      // A drilled-in level reuses this Content too, so a row that wants a
      // taller submenu (`subMenuMaxHeight`) has to raise the cap here; every
      // other level keeps the default.
      maxHeight={maxHeight ?? parent?.subMenuMaxHeight}
      matchTriggerWidth={matchTriggerWidth}
      dropdownRef={dropdownRef}
      onContentKeyDown={onContentKeyDown}
      modal={modal}
      scrollInside={pinned !== null}
      contentTestId={dataTestId}
    >
      {canGoBack ? (
        backRowLabel && parent ? (
          <BackRow onBack={goBack} label={parent.text} />
        ) : (
          <>
            <BackRow onBack={goBack} />
            <div
              className="w-full border-t border-[var(--drop-down-menu-separator-color)] my-[var(--dropdown-separator-margin-y,4px)] shrink-0"
              data-testid="dropdown-back-separator"
            />
          </>
        )
      ) : null}
      {headerAtRootOnly && !atRoot ? null : headerContent}
      {pinned ? (
        <>
          <div
            className="min-h-0 overflow-y-auto flex flex-col"
            data-testid="dropdown-scroll-area"
          >
            {items.map((item, index) => renderRow(item, index))}
          </div>
          <div className="shrink-0 flex flex-col" data-testid="dropdown-footer">
            {pinned.map((item, index) =>
              renderRow(item, items.length + index, true)
            )}
          </div>
        </>
      ) : (
        level.map((item, index) => renderRow(item, index))
      )}
    </Shell>
  );
};

export { DropdownMenuComponent as DropdownMenu };
