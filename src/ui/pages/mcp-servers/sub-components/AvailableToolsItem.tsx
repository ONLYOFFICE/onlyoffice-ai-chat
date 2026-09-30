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
  /**
   * Enumeration failure message for a server-executed MCP server the
   * backend could not connect to (from the system-tools listing). Renders
   * the same error icon as a stopped local server; clicking the row opens
   * this message in place of a crash log.
   */
  failedText?: string;
};

const AvailableToolsItem = ({
  name,
  displayName,
  mcpItems,
  isLoading,
  failedText,
}: AvailableToolsItemProps) => {
  const { IconButton, Loader, ToggleButton } = useComponents();
  const { isRTL } = useI18n();
  const { servers: serversInstance } = useToolsContext();

  const [opened, setOpened] = React.useState(false);
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

  // The server-level toggle reflects whether the server contributes any
  // tools at all: partial enablement still reads as ON, switching it flips
  // every tool at once (replaces the old Enable/Disable all tools menu).
  const someToolEnabled = useMemo(
    () => mcpItems.some((tool) => tool.enabled),
    [mcpItems]
  );

  const onToggleAllTools = useCallback(
    (checked: boolean) => {
      changeAllToolStatus(name, checked);
    },
    [name, changeAllToolStatus]
  );

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

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="flex flex-col"
      data-testid="mcp-server"
      data-server-name={name}
    >
      <div
        data-testid="mcp-server-header"
        className={cn(
          "h-[var(--servers-available-tools-item-height,32px)] px-[var(--servers-available-tools-item-padding-x,8px)] rounded-[var(--servers-available-tools-item-border-radius)] flex items-center justify-between",
          isLoadingAction ? "" : "cursor-pointer",
          "bg-[var(--servers-available-tools-item-background-color)]",
          "active:bg-[var(--servers-available-tools-item-active-background-color)]",
          !isLoadingAction
            ? "hover:bg-[var(--servers-available-tools-item-hover-background-color)]"
            : ""
        )}
        onClick={() => {
          if (isLoadingAction) return;
          // A stopped server opens its crash log even with no tools, and a
          // server-executed one with an enumeration failure opens its error
          // message; a healthy server only opens when it has tools to show.
          if (!isStoped && !failedText && mcpItems.length === 0) return;
          setOpened((val) => !val);
        }}
      >
        <div className="flex items-center gap-[var(--servers-available-tools-item-content-gap,8px)]">
          <div
            className="flex items-center justify-center w-[var(--servers-available-tools-item-chevron-width,12px)] h-full"
            style={{
              transform: isRTL
                ? `rotate(${opened ? 0 : 90}deg)`
                : `rotate(${opened ? 0 : -90}deg)`,
            }}
          >
            <Icon name="chevron" width={6} height={3} isStroke />
          </div>
          <p
            data-testid="mcp-server-name"
            className="text-[var(--servers-available-tools-item-name-color)] font-bold"
          >
            {displayName ?? name}
          </p>
          {!isLoadingAction && (isStoped || !!failedText) ? (
            <IconButton
              iconName="status.error"
              size={16}
              disableHover
              noColor
              data-testid="mcp-server-error-icon"
            />
          ) : null}
        </div>
        <div>
          {isLoadingAction ? (
            <Loader data-testid="mcp-server-loader" />
          ) : mcpItems.length > 0 ? (
            // The toggle sits inside the clickable row header — swallow the
            // click so flipping it does not also expand/collapse the row.
            <div
              className="flex items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <ToggleButton
                checked={someToolEnabled}
                onCheckedChange={onToggleAllTools}
                data-testid="mcp-server-toggle"
              />
            </div>
          ) : null}
        </div>
      </div>
      {opened && (isStoped || failedText) ? (
        <div
          className={cn(
            "mt-[var(--servers-available-tools-logs-margin-top,4px)]",
            "max-h-[var(--servers-available-tools-logs-max-height,300px)]",
            "overflow-y-auto select-text",
            "rounded-[var(--servers-available-tools-item-border-radius)]",
            "bg-[var(--servers-available-tools-item-background-color)]",
            "p-[var(--servers-available-tools-logs-padding,8px)]"
          )}
        >
          <pre
            data-testid="mcp-server-logs"
            className={cn(
              "m-[var(--servers-available-tools-logs-text-margin,0)]",
              "whitespace-pre-wrap break-words font-mono",
              "text-[length:var(--fs-12,12px)] leading-[var(--lh-16,16px)]",
              "text-[var(--servers-available-tools-item-name-color)]"
            )}
          >
            {isStoped ? logs.join("") : failedText}
          </pre>
        </div>
      ) : null}
      {opened && !isStoped && !failedText ? (
        <div
          data-testid="mcp-server-tools"
          className="flex flex-col gap-[var(--servers-available-tools-sublist-gap,8px)] mt-[var(--servers-available-tools-sublist-margin-top,4px)]"
        >
          {mcpItems.map((tool) => {
            return (
              <div
                key={tool.name}
                data-testid="mcp-tool"
                data-tool-name={tool.name}
                className={cn(
                  "rounded-[var(--servers-available-tools-item-border-radius)] cursor-pointer flex flex-col hover:bg-[var(--servers-available-tools-item-hover-background-color)] ps-[var(--servers-available-tools-tool-padding-start,28px)] pe-[var(--servers-available-tools-tool-padding-end,8px)] h-[var(--servers-available-tools-tool-height,26px)]"
                )}
                onClick={() => {
                  changeToolStatus(name, tool.name, !tool.enabled);
                }}
              >
                <div className="flex items-center justify-between w-full h-full">
                  <p
                    data-testid="mcp-tool-name"
                    className="text-[var(--servers-available-tools-item-name-color)]"
                  >
                    {tool.displayName ?? tool.name}
                  </p>
                  <ToggleButton
                    checked={tool.enabled ?? false}
                    data-testid="mcp-tool-toggle"
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
