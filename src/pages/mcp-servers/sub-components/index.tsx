import React from "react";
import { useI18n } from "../../../locales";
import { cn } from "../../../lib/utils";
import { useComponents } from "../../../components-provider";
import AvailableTools from "./AvailableTools";
import ConfigDialog from "./ConfigDialog";
import ToolsCounter from "./ToolsCounter";

type ServersProps = {
  variant?: "tab" | "page";
};

const Servers = ({ variant = "tab" }: ServersProps) => {
  const { Button } = useComponents();
  const { t, isRTL } = useI18n();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <div className="flex flex-col pb-[32px] w-full">
        <p
          className={cn(
            "font-normal leading-[20px] text-[var(--servers-description-color)] mb-[16px]",
            isRTL ? "text-end" : ""
          )}
        >
          {t("MCPServersDescription")}
        </p>
        <div
          className={cn(
            "flex",
            isRTL ? "justify-end" : "justify-start",
            variant === "page" ? "mb-[28px]" : "mb-[16px]"
          )}
        >
          <Button className="w-fit" onClick={() => setIsOpen(true)}>
            {t("EditConfiguration")}
          </Button>
        </div>
        {variant === "page" ? (
          <div
            className={cn(
              "flex items-center justify-between mb-[12px]",
              isRTL ? "flex-row-reverse" : ""
            )}
          >
            <p className="font-bold leading-[16px] text-[var(--servers-available-tools-header-color)]">
              {t("Permissions")}
            </p>
            <ToolsCounter />
          </div>
        ) : null}
        <AvailableTools withHeader={variant === "tab"} />
      </div>
      {<ConfigDialog open={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  );
};

export { Servers };
