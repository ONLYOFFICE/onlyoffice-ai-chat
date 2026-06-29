import React from "react";
import { cn } from "../../../shared/utils";
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
  searchable?: boolean;
  searchPlaceholder?: string;
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
  searchable,
  searchPlaceholder,
  "data-testid": dataTestId,
}: ComboBoxProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

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
    <div className="px-[8px] pb-[4px]">
      <input
        autoFocus
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder={searchPlaceholder}
        className={cn(
          "w-full h-[24px] px-[4px] rounded-[4px]",
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
            "h-[var(--combo-box-height,24px)] rounded-[var(--input-border-radius)] ps-[4px] box-border",
            "cursor-pointer flex items-center justify-between",
            "text-[var(--input-color)] leading-[var(--lh-16)]",
            withoutBg
              ? ""
              : isOpen
                ? "border bg-[var(--input-background-color)] border-[var(--input-active-border-color)]"
                : "border bg-[var(--input-background-color)] border-[var(--input-border-color)] hover:bg-[var(--input-hover-background-color)] hover:border-[var(--input-hover-border-color)]",
            className,
            disabled || items.length === 0
              ? "cursor-not-allowed pointer-events-none opacity-50"
              : ""
          )}
          style={{
            borderColor: isError ? "var(--border-error)" : undefined,
          }}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              disabled
                ? "text-[var(--input-placeholder-color)]"
                : "text-[var(--input-color)]"
            )}
          >
            {value || placeholder}
          </span>
          <div className="flex items-center justify-center h-[var(--combo-box-height,24px)] w-[16px] shrink-0">
            <Icon
              name="arrow"
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
      matchTriggerWidth={true}
      headerContent={searchHeader}
      items={visibleItems}
    />
  );
};

export { ComboBox };
