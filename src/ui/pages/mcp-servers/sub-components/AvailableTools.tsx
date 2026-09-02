import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useToolsContext } from "../../../tools/context";
import {
  MAX_TOOL_COUNT,
  MAX_TOOL_COUNT_WITH_WEB_SEARCH,
} from "../../../../config";
import { cn } from "../../../../shared/utils";
import { useStores } from "../../../store/context";
import AvailableToolsItem from "./AvailableToolsItem";
import ToolsCounter from "./ToolsCounter";

type AvailableToolsProps = {
  withHeader?: boolean;
  /** When `false`, the outer border is omitted (e.g. when nested in a
   * container that already provides one). */
  bordered?: boolean;
};

const AvailableTools = ({
  withHeader = true,
  bordered = true,
}: AvailableToolsProps) => {
  const { t, isRTL } = useI18n();
  const { servers: serversInstance } = useToolsContext();

  const [customServers, setCustomServers] = React.useState({});

  const { useServersStore } = useStores();
  const servers = useServersStore((s) => s.servers);
  const systemTools = useServersStore((s) => s.systemTools);
  const webSearchEnabled = useServersStore((s) => s.webSearchEnabled);

  const enabledCount = React.useMemo(
    () =>
      Object.values(servers).reduce(
        (acc, items) => acc + items.filter((t) => t.enabled).length,
        0
      ),
    [servers]
  );

  React.useEffect(() => {
    setCustomServers(serversInstance.getCustomServers());

    const interval = setInterval(() => {
      setCustomServers(serversInstance.getCustomServers());
    }, 1000);

    return () => clearInterval(interval);
  }, [serversInstance]);

  const disableEnable = webSearchEnabled
    ? enabledCount >= MAX_TOOL_COUNT_WITH_WEB_SEARCH
    : enabledCount >= MAX_TOOL_COUNT;

  const hostGroupIds = serversInstance.getHostToolGroupIds();
  const hasHostTools = hostGroupIds.some(
    (id) => (servers[id] ?? []).length > 0
  );
  const hasCustomServers = Object.keys(customServers).length > 0;
  // A registered server can surface through both maps at once (the host's
  // system-tools listing echoes registered custom servers). The local card
  // already carries the live connection state and crash log, so the system
  // echo is dropped rather than rendered as a duplicate card.
  const systemTypes = Object.keys(systemTools ?? {}).filter(
    (type) => !(type in customServers)
  );
  const hasSystemTools = systemTypes.length > 0;

  if (!hasHostTools && !hasCustomServers && !hasSystemTools) return null;

  return (
    <div
      className={cn(
        "available-tools w-full flex flex-col",
        bordered &&
          "border-[length:var(--servers-available-tools-border-width)] border-[var(--servers-available-tools-border-color)] rounded-[var(--servers-available-tools-border-radius)]"
      )}
    >
      {withHeader ? (
        <div
          className={cn(
            "min-h-[var(--servers-available-tools-header-height,40px)] h-[var(--servers-available-tools-header-height,40px)] flex items-center justify-between px-[var(--servers-available-tools-header-padding-x,16px)]",
            isRTL ? "flex-row-reverse" : ""
          )}
        >
          <p className="font-bold text-[var(--servers-available-tools-header-color)]">
            {t("Permissions")}
          </p>
          <ToolsCounter />
        </div>
      ) : null}
      <div
        dir={isRTL ? "rtl" : "ltr"}
        className={cn(
          "flex flex-col gap-[var(--servers-available-tools-list-gap,8px)] pb-[var(--servers-available-tools-list-padding-bottom,8px)] px-[var(--servers-available-tools-list-padding-x,8px)]",
          withHeader
            ? "pt-[var(--servers-available-tools-list-padding-top-with-header,4px)]"
            : "pt-[var(--servers-available-tools-list-padding-top,8px)]"
        )}
      >
        {serversInstance
          .getHostToolGroupIds()
          .map((groupId) =>
            (servers[groupId] ?? []).length > 0 ? (
              <AvailableToolsItem
                key={groupId}
                name={groupId}
                displayName={serversInstance.getHostToolGroupDisplayName(
                  groupId
                )}
                mcpItems={servers[groupId] ?? []}
                isLoading={false}
                disableEnable={disableEnable}
              />
            ) : null
          )}
        {Object.keys(customServers).map((type) => (
          <AvailableToolsItem
            key={type}
            name={type}
            mcpItems={servers[type] ?? []}
            isLoading={!servers[type]?.length}
            disableEnable={disableEnable}
          />
        ))}
        {/* System servers: enumerated server-side, rendered identically. */}
        {systemTypes.map((type) => (
          <AvailableToolsItem
            key={type}
            name={type}
            mcpItems={servers[type] ?? []}
            isLoading={false}
            disableEnable={disableEnable}
          />
        ))}
      </div>
    </div>
  );
};

export default AvailableTools;
