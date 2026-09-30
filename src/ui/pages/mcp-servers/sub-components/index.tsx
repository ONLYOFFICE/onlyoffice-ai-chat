import React, { Suspense } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { cn } from "../../../../shared/utils";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useToolsContext } from "../../../tools/context";
import { useStores } from "../../../store/context";
import Permissions from "./Permissions";

// CodeMirror (+ @codemirror/*) is only needed inside the MCP-config editor.
// Load it lazily so it stays out of the eager widget chunk and is fetched
// only when the user actually opens the editor.
const ConfigEditor = React.lazy(() => import("./ConfigEditor"));

const Servers = () => {
  const { Button } = useComponents();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = React.useState(false);
  const { servers: serversInstance } = useToolsContext();
  const { useServersStore } = useStores();
  const servers = useServersStore((s) => s.servers);
  const systemTools = useServersStore((s) => s.systemTools);
  const registeredServers =
    useServersStore((s) => s.registeredServers) ?? [];
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
    Object.keys(systemTools ?? {}).length > 0 ||
    // Registered but not yet enumerated (host-executed servers while the
    // system listing is in flight) — the section shows their loading cards.
    registeredServers.length > 0;

  return (
    <div className="mcp-servers-content flex flex-col pb-[var(--mcp-servers-content-padding-bottom,32px)] w-full">
      <p
        className={cn(
          "font-normal leading-[var(--lh-16)] text-[var(--settings-description-color)] mb-[var(--mcp-servers-description-margin-bottom,8px)]"
        )}
      >
        {t("MCPServersDescription")}
      </p>
      {isOpen ? null : (
        <div
          className={cn(
            "flex mb-[var(--mcp-servers-actions-margin-bottom,8px)]"
          )}
        >
          <Button
            className="w-fit"
            data-testid="mcp-edit-configuration-button"
            onClick={() => setIsOpen(true)}
          >
            {t("EditConfiguration")}
          </Button>
        </div>
      )}
      {/* Modal content, now shown inline within the page. Mounted only when
          open so the lazy CodeMirror chunk loads on demand. */}
      {isOpen && (
        <Suspense fallback={null}>
          <ConfigEditor open={isOpen} onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
      {/* While the editor is open, the permissions block is dimmed and
          made non-interactive. */}
      {hasTools && <Permissions dimmed={isOpen} />}
    </div>
  );
};

export { Servers };
