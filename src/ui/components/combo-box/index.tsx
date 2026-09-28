import React from "react";
import { cn } from "../../../shared/utils";
import { useWidgetConfig } from "../../../widget-config";
import { DropdownMenu } from "../dropdown";
import type { DropDownItemProps } from "../dropdown-item/DropDownItem.types";
import { Icon } from "../icon";

export type ComboBoxProps = {
  placeholder?: string;
  value?: string;
  className?: string;
  isError?: boolean;
  withoutBg?: boolean;
  disabled?: boolean;
  items: DropDownItemProps[];
  /**
   * Rows pinned below the scrolling list; never filtered by the search.
   * See `DropdownMenuProps.footerItems`.
   */
  footerItems?: DropDownItemProps[];
  searchable?: boolean;
  searchPlaceholder?: string;
  /**
   * When true (default) the dropdown matches the trigger width (min 150px).
   * Set to false to size the panel to its content (`w-fit`).
   */
  matchTriggerWidth?: boolean;
  /** Extra classes applied to the dropdown panel (e.g. min width). */
  contentClassName?: string;
  /** Caps the dropdown panel width (px number or CSS length). */
  maxWidth?: number | string;
  /**
   * Icon name for the trigger's chevron/arrow. When omitted, falls back to the
   * `comboBoxArrowIcon` widget config and then to the bundled `"arrow"`.
   */
  arrowIcon?: string;
  "data-testid"?: string;
};

const ComboBox = ({
  placeholder,
  value,
  className,
  isError,
  withoutBg,
  disabled,
  items,
  footerItems,
  searchable,
  searchPlaceholder,
  matchTriggerWidth = true,
  contentClassName,
  maxWidth,
  arrowIcon,
  "data-testid": dataTestId,
}: ComboBoxProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const { comboBoxArrowIcon } = useWidgetConfig();
  // Explicit prop wins (e.g. the model selector passes its own icon), then
  // the host's combobox-wide config, then the bundled default.
  const resolvedArrowIcon = arrowIcon ?? comboBoxArrowIcon ?? "arrow";

  const handleOpenChange = (next: boolean) => {
    if (!next) setSearchQuery("");
    setIsOpen(next);
  };

  const visibleItems =
    searchable && searchQuery
      ? items.filter((item) =>
          item.text.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : items;

  const searchHeader = searchable ? (
    <div className="px-[var(--combo-box-search-padding-x,8px)] pb-[var(--combo-box-search-padding-bottom,4px)]">
      <input
        autoFocus
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder={searchPlaceholder}
        className={cn(
          "w-full h-[var(--combo-box-search-input-height,24px)] px-[var(--combo-box-search-input-padding-x,4px)] rounded-[4px]",
          "leading-[var(--lh-16)] text-[var(--input-color)]",
          "bg-[var(--input-background-color)] border border-[var(--input-border-color)]",
          "placeholder:text-[var(--input-placeholder-color)]",
          "focus:outline-none focus:border-[var(--input-active-border-color)]"
        )}
      />
    </div>
  ) : undefined;

  return (
    <DropdownMenu
      onOpenChange={handleOpenChange}
      trigger={
        <div
          data-testid={dataTestId}
          className={cn(
            "h-[var(--combo-box-height,24px)] rounded-[var(--input-border-radius)] ps-[var(--combo-box-padding-start,4px)] pe-[var(--combo-box-padding-end,0px)] box-border",
            "cursor-pointer flex items-center justify-between",
            "text-[var(--input-color)] leading-[var(--lh-16)]",
            withoutBg
              ? ""
              : isOpen
                ? "border bg-[var(--input-background-color)] border-[var(--input-active-border-color)]"
                : "border bg-[var(--input-background-color)] border-[var(--input-border-color)] hover:bg-[var(--input-hover-background-color)] hover:border-[var(--input-hover-border-color)]",
            className,
            disabled || items.length + (footerItems?.length ?? 0) === 0
              ? "cursor-not-allowed pointer-events-none opacity-50"
              : ""
          )}
          style={{
            borderColor: isError ? "var(--border-error)" : undefined,
          }}
        >
          <span
            dir="auto"
            className={cn(
              "min-w-0 truncate",
              disabled
                ? "text-[var(--input-placeholder-color)]"
                : "text-[var(--input-color)]"
            )}
          >
            {value || placeholder}
          </span>
          <div className="flex items-center justify-center h-[var(--combo-box-height,24px)] w-[var(--combo-box-arrow-container-width,16px)] shrink-0">
            <Icon
              name={resolvedArrowIcon}
              color="var(--icon-normal)"
              width={7}
              height={4}
              isStroke
              className={cn("transition-transform", {
                "rotate-180": isOpen,
              })}
            />
          </div>
        </div>
      }
      matchTriggerWidth={matchTriggerWidth}
      contentClassName={contentClassName}
      maxWidth={maxWidth}
      headerContent={searchHeader}
      items={visibleItems}
      footerItems={footerItems}
      variant="combobox"
      // Radix menus are modal by default, which parks `pointer-events: none`
      // on the body while the panel is open. Comboboxes sit side by side (the
      // model assignment rows, the model config form), and there a click on
      // the next trigger is swallowed: the first click only dismisses this
      // panel, so opening the next one takes two. A combobox has nothing to
      // guard against outside interaction, so it opts out of modality.
      modal={false}
    />
  );
};

export { ComboBox };
