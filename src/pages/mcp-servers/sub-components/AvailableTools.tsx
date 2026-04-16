import React from "react";
import { useI18n } from "../../../locales";
import { useToolsContext } from "../../../tools/context";
import {
  MAX_TOOL_COUNT,
  MAX_TOOL_COUNT_WITH_WEB_SEARCH,
} from "../../../config";
import { cn } from "../../../lib/utils";
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
  const { servers, tools, webSearchEnabled } = useServersStore();

  React.useEffect(() => {
    setCustomServers(serversInstance.getCustomServers());

    const interval = setInterval(() => {
      setCustomServers(serversInstance.getCustomServers());
    }, 1000);

    return () => clearInterval(interval);
  }, [serversInstance]);

  const disableEnable = webSearchEnabled
    ? tools.length >= MAX_TOOL_COUNT_WITH_WEB_SEARCH
    : tools.length >= MAX_TOOL_COUNT;

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
        {serversInstance.getHostToolGroupIds().map((groupId) =>
          (servers[groupId] ?? []).length > 0 ? (
            <AvailableToolsItem
              key={groupId}
              name={groupId}
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
      </div>
    </div>
  );
};

export default AvailableTools;
