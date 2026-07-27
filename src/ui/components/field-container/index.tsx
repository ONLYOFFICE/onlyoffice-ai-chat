import { cn } from "../../../shared/utils";
import { Icon } from "../icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";

export type FieldContainerProps = {
  children: React.ReactNode;
  header: string;
  icon?: string;
  iconIsStroke?: boolean;
  error?: string;
  isHorizontal?: boolean;
  reserveErrorSpace?: boolean;
  action?: React.ReactNode;
  /**
   * Horizontal layout only: always reserve a fixed-height action zone above
   * the field (even when there's no `action`), so a group of fields keeps
   * uniform spacing and a toggling action doesn't shift the layout. Off by
   * default — the action row is rendered only when an `action` is present.
   */
  reserveActionSpace?: boolean;
  className?: string;
  headerClassName?: string;
};

const ErrorBlock = ({ error }: { error: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <p className="text-[var(--field-container-error-color)] truncate">
        {error}
      </p>
    </TooltipTrigger>
    <TooltipContent
      className="max-w-[var(--field-container-error-max-width)] break-words"
      side="bottom"
      align="start"
    >
      {error}
    </TooltipContent>
  </Tooltip>
);

const FieldContainer = ({
  children,
  header,
  icon,
  iconIsStroke,
  error,
  isHorizontal,
  reserveErrorSpace,
  action,
  reserveActionSpace,
  className,
  headerClassName,
}: FieldContainerProps) => {
  return (
    <div
      className={cn(
        className,
        "flex flex-col w-full min-w-0 gap-[var(--field-container-row-gap)]"
      )}
    >
      {/* Horizontal layout has no header row to hold the action. With
          `reserveActionSpace` a fixed-height zone above the field is always
          reserved — the action toggles inside it without shifting the field,
          so a group of fields keeps uniform spacing. Otherwise (default) the
          action row is rendered only when an `action` is actually present. */}
      {isHorizontal &&
        (reserveActionSpace ? (
          <div className="flex justify-end w-full h-[var(--field-container-action-height)]">
            {action}
          </div>
        ) : (
          action && <div className="flex justify-end w-full">{action}</div>
        ))}
      <div
        className={cn(
          "flex w-full",
          isHorizontal
            ? "flex-row items-center gap-[var(--field-container-control-gap-horizontal)]"
            : "flex-col gap-[var(--field-container-control-gap-vertical)]"
        )}
      >
        {!isHorizontal ? (
          <div className="flex justify-between items-center w-full mb-[var(--field-container-header-margin-bottom)]">
            <div className="flex items-center gap-[var(--field-container-header-gap)]">
              {icon && (
                <Icon
                  name={icon}
                  size="var(--field-container-icon-size, 20px)"
                  isStroke={iconIsStroke}
                />
              )}
              <p
                className={cn(
                  "select-none text-[var(--field-container-header-color)]",
                  headerClassName
                )}
              >
                {header}
              </p>
            </div>
            {action}
          </div>
        ) : (
          <div className="flex items-center gap-[var(--field-container-header-gap)] w-full max-w-[var(--field-container-label-width)] shrink-0">
            {icon && (
              <Icon
                name={icon}
                size="var(--field-container-icon-size, 20px)"
                isStroke={iconIsStroke}
              />
            )}
            <p
              className={cn(
                "select-none text-[var(--field-container-header-color)]",
                headerClassName
              )}
            >
              {header}
            </p>
          </div>
        )}

        <div
          className={cn("overflow-hidden", isHorizontal ? "grow" : "w-full")}
        >
          {children}
        </div>
      </div>
      {(reserveErrorSpace || error) && (
        <div
          className={cn(
            "w-full min-w-0 overflow-hidden",
            reserveErrorSpace && "h-[var(--field-container-error-height)]",
            isHorizontal &&
              "ps-[calc(var(--field-container-label-width)+var(--field-container-control-gap-horizontal))]"
          )}
        >
          {error && <ErrorBlock error={error} />}
        </div>
      )}
    </div>
  );
};

export { FieldContainer };
