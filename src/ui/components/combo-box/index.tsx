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
          "w-full h-[32px] px-[8px] rounded-[4px]",
          "text-[14px] leading-[16px] text-[var(--input-color)]",
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
          onClick={undefined}
          className={cn(
            "h-[36px] rounded-[var(--input-border-radius)] ps-[12px] box-border",
            "cursor-pointer flex items-center justify-between",
            "text-[var(--input-color)] text-[14px] leading-[16px]",
            isOpen
              ? "border bg-[var(--input-background-color)] border-[var(--input-active-border-color)]"
              : withoutBg
                ? "hover:bg-[var(--input-hover-background-color)) hover:border-[var(--input-hover-border-color)]"
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
              value
                ? "text-[var(--input-color)]"
                : "text-[var(--input-placeholder-color)]"
            )}
          >
            {value || placeholder}
          </span>
          <div className="flex items-center h-full w-[25px] shrink-0">
            <Icon
              name="arrow.bottom.big"
              color="var(--input-color)"
              width={9}
              height={4.5}
              isStroke
              className={cn("transition-transform ms-[4px]", {
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
