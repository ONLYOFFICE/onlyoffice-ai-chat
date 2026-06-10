import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { cn } from "../../../../shared/utils";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useToolsContext } from "../../../tools/context";
import { useStores } from "../../../store/context";
import ConfigEditor from "./ConfigEditor";
import Permissions from "./Permissions";

const Servers = () => {
  const { Button } = useComponents();
  const { t, isRTL } = useI18n();
  const [isOpen, setIsOpen] = React.useState(false);
  const { servers: serversInstance } = useToolsContext();
  const { useServersStore } = useStores();
  const servers = useServersStore((s) => s.servers);
  const systemTools = useServersStore((s) => s.systemTools);
  const [customServers, setCustomServers] = React.useState({});

  React.useEffect(() => {
    setCustomServers(serversInstance.getCustomServers());
    const interval = setInterval(() => {
      setCustomServers(serversInstance.getCustomServers());
    }, 1000);
    return () => clearInterval(interval);
  }, [serversInstance]);

  const hasTools =
    serversInstance
      .getHostToolGroupIds()
      .some((id) => (servers[id] ?? []).length > 0) ||
    Object.keys(customServers).length > 0 ||
    Object.keys(systemTools ?? {}).length > 0;

  return (
    <div className="flex flex-col pb-[32px] w-full">
      <p
        className={cn(
          "font-normal leading-[16px] text-[var(--settings-description-color)] mb-[8px]",
          isRTL ? "text-end" : ""
        )}
      >
        {t("MCPServersDescription")}
      </p>
      {isOpen ? null : (
        <div
          className={cn(
            "flex mb-[8px]",
            isRTL ? "justify-end" : "justify-start"
          )}
        >
          <Button className="w-fit" onClick={() => setIsOpen(true)}>
            {t("EditConfiguration")}
          </Button>
        </div>
      )}
      {/* Modal content, now shown inline within the page. */}
      <ConfigEditor open={isOpen} onClose={() => setIsOpen(false)} />
      {/* While the editor is open, the permissions block is dimmed and
          made non-interactive. */}
      {hasTools && <Permissions dimmed={isOpen} />}
    </div>
  );
};

export { Servers };
