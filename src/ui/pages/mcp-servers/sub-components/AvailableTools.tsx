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
};

const AvailableTools = ({ withHeader = true }: AvailableToolsProps) => {
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
  const systemTypes = Object.keys(systemTools ?? {});
  const hasSystemTools = systemTypes.length > 0;

  if (!hasHostTools && !hasCustomServers && !hasSystemTools) return null;

  return (
    <div className="w-full max-h-[560px] border-[length:var(--servers-available-tools-border-width)] border-[var(--servers-available-tools-border-color)] rounded-[var(--servers-available-tools-border-radius)] flex flex-col">
      {withHeader ? (
        <div
          className={cn(
            "min-h-[40px] h-[40px] flex items-center justify-between px-[16px]",
            isRTL ? "flex-row-reverse" : ""
          )}
        >
          <p className="font-bold leading-[20px] text-[var(--servers-available-tools-header-color)]">
            {t("Permissions")}
          </p>
          <ToolsCounter />
        </div>
      ) : null}
      <div
        dir={isRTL ? "rtl" : "ltr"}
        className={cn(
          "flex flex-col gap-[8px] pb-[8px] px-[8px] overflow-y-auto",
          withHeader ? "pt-[4px]" : "pt-[8px]"
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
