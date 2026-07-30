import React, { useCallback, useMemo } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useToolsContext } from "../../../tools/context";
import { cn } from "../../../../shared/utils";
import { useStores } from "../../../store/context";
import type { TMCPItem } from "../../../../types";
import { useComponents } from "../../../providers/ComponentsProvider";
import { Icon } from "../../../components/icon";

type AvailableToolsItemProps = {
  name: string;
  displayName?: string;
  mcpItems: TMCPItem[];
  isLoading: boolean;
  disableEnable: boolean;
};

const AvailableToolsItem = ({
  name,
  displayName,
  mcpItems,
  isLoading,
  disableEnable,
}: AvailableToolsItemProps) => {
  const { IconButton, DropdownMenu, Loader, ToggleButton } = useComponents();
  const { t, isRTL } = useI18n();
  const { servers: serversInstance } = useToolsContext();

  const [opened, setOpened] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  // Seed from the servers instance synchronously so a server that is
  // already stopped when the page mounts shows its error icon and opens
  // its log on the very first click — without waiting for the 1s poll.
  const [isStoped, setIsStoped] = React.useState(() =>
    serversInstance.getCustomServersStoped().includes(name)
  );
  const [logs, setLogs] = React.useState<string[]>(() =>
    serversInstance.getCustomServersStoped().includes(name)
      ? (serversInstance.getCustomServersLogs()[name] ?? [])
      : []
  );

  const { useServersStore } = useStores();
  const changeToolStatus = useServersStore((s) => s.changeToolStatus);
  const changeAllToolStatus = useServersStore((s) => s.changeAllToolStatus);

  const onEnableAllTools = useCallback(() => {
    changeAllToolStatus(name, true);
  }, [name, changeAllToolStatus]);

  const onDisableAllTools = useCallback(() => {
    changeAllToolStatus(name, false);
  }, [name, changeAllToolStatus]);

  // Collapse a loading server, but never a stopped one — its expanded
  // panel shows the crash log, which must stay open even though a
  // crashed custom server reports `isLoading` (it has no tools).
  React.useEffect(() => {
    if (isLoading && !isStoped) setOpened(false);
  }, [isLoading, isStoped]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      const stopped = serversInstance.getCustomServersStoped().includes(name);
      setIsStoped(stopped);
      // Snapshot the crash log while stopped. Logs are mutated in place,
      // so only replace state when the line count changed — otherwise the
      // same reference would either churn re-renders or go stale.
      if (stopped) {
        setLogs((prev) => {
          const next = serversInstance.getCustomServersLogs()[name] ?? [];
          return prev.length === next.length ? prev : next.slice();
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [name, serversInstance]);

  const isLoadingAction = isStoped ? false : isLoading;

  const dropdownItems = useMemo(() => {
    const items = [];

    if (mcpItems.length > 0) {
      items.push(
        {
          text: t("EnableAllTools"),
          onClick: onEnableAllTools,
        },
        {
          text: t("DisableAllTools"),
          onClick: onDisableAllTools,
        }
      );
    }

    return items;
  }, [mcpItems.length, t, onEnableAllTools, onDisableAllTools]);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="flex flex-col">
      <div
        className={cn(
          "h-[var(--servers-available-tools-item-height)] px-[var(--servers-available-tools-item-padding-x)] rounded-[var(--servers-available-tools-item-border-radius)] flex items-center justify-between",
          isLoadingAction ? "" : "cursor-pointer",
          "bg-[var(--servers-available-tools-item-background-color)]",
          "active:bg-[var(--servers-available-tools-item-active-background-color)]",
          !isLoadingAction
            ? "hover:bg-[var(--servers-available-tools-item-hover-background-color)]"
            : ""
        )}
        onClick={() => {
          if (isLoadingAction || dropdownOpen) return;
          // A stopped server opens its crash log even with no tools;
          // a healthy server only opens when it has tools to show.
          if (!isStoped && mcpItems.length === 0) return;
          setOpened((val) => !val);
        }}
      >
        <div className="flex items-center gap-[var(--servers-available-tools-item-content-gap)]">
          <div
            className="flex items-center justify-center w-[var(--servers-available-tools-item-chevron-width)] h-full"
            style={{
              transform: isRTL
                ? `rotate(${opened ? 0 : 90}deg)`
                : `rotate(${opened ? 0 : -90}deg)`,
            }}
          >
            <Icon name="chevron" width={6} height={3} isStroke />
          </div>
          <p className="text-[var(--servers-available-tools-item-name-color)] font-bold">
            {displayName ?? name}
          </p>
          {!isLoadingAction && isStoped ? (
            <IconButton
              iconName="status.error"
              size={16}
              disableHover
              noColor
            />
          ) : null}
        </div>
        <div>
          {isLoadingAction ? (
            <Loader />
          ) : dropdownItems.length > 0 ? (
            <DropdownMenu
              onOpenChange={setDropdownOpen}
              trigger={
                <IconButton
                  iconName="more"
                  size={24}
                  isActive={dropdownOpen}
                  insideElement
                />
              }
              items={dropdownItems}
              side="left"
              align="start"
              sideOffset={0}
            />
          ) : null}
        </div>
      </div>
      {opened && isStoped ? (
        <div
          className={cn(
            "mt-[var(--servers-available-tools-logs-margin-top)]",
            "max-h-[var(--servers-available-tools-logs-max-height)]",
            "overflow-y-auto select-text",
            "rounded-[var(--servers-available-tools-item-border-radius)]",
            "bg-[var(--servers-available-tools-item-background-color)]",
            "p-[var(--servers-available-tools-logs-padding)]"
          )}
        >
          <pre
            className={cn(
              "m-[var(--servers-available-tools-logs-text-margin)]",
              "whitespace-pre-wrap break-words font-mono",
              "text-[length:var(--fs-12)] leading-[var(--lh-16)]",
              "text-[var(--servers-available-tools-item-name-color)]"
            )}
          >
            {logs.join("")}
          </pre>
        </div>
      ) : null}
      {opened && !isStoped ? (
        <div className="flex flex-col gap-[var(--servers-available-tools-sublist-gap)] mt-[var(--servers-available-tools-sublist-margin-top)]">
          {mcpItems.map((tool) => {
            return (
              <div
                key={tool.name}
                className={cn(
                  "rounded-[var(--servers-available-tools-item-border-radius)] cursor-pointer flex flex-col hover:bg-[var(--servers-available-tools-item-hover-background-color)] ps-[var(--servers-available-tools-tool-padding-start)] pe-[var(--servers-available-tools-tool-padding-end)] h-[var(--servers-available-tools-tool-height)]"
                )}
                onClick={() => {
                  changeToolStatus(name, tool.name, !tool.enabled);
                }}
              >
                <div className="flex items-center justify-between w-full h-full">
                  <p className="text-[var(--servers-available-tools-item-name-color)]">
                    {tool.displayName ?? tool.name}
                  </p>
                  <ToggleButton
                    checked={tool.enabled ?? false}
                    disabled={disableEnable && !tool.enabled}
                    onCheckedChange={() => {
                      // empty change because change will be applied in onClick at div element
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default AvailableToolsItem;
