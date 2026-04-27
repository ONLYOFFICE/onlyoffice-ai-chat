import { useI18n } from "../../../providers/LocalesProvider";
import { useStores } from "../../../../store/context";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useWidgetConfig } from "../../../../widget-config";

const Navigation = () => {
  const { IconButton, TooltipIconButton } = useComponents();
  const { t } = useI18n();
  const { useRouter, useThreadsStore } = useStores();
  const { hideSettingsButton, onSettingsClick, isSettingsActive } =
    useWidgetConfig();

  const currentPage = useRouter((s) => s.currentPage);
  const setCurrentPage = useRouter((s) => s.setCurrentPage);
  const onSwitchToNewThread = useThreadsStore((s) => s.onSwitchToNewThread);

  const settingsActive = isSettingsActive ?? currentPage === "settings";
  const handleSettingsClick = onSettingsClick
    ? onSettingsClick
    : () => setCurrentPage(currentPage === "settings" ? "chat" : "settings");

  return (
    <nav className="w-full flex justify-between items-center h-[56px] min-h-[56px] box-border border-b-[1px] border-[var(--header-border-color)] bg-[var(--header-background-color)] px-[32px]">
      <div className="flex items-center gap-[12px]">
        <h3 className="text-[var(--header-color)] font-bold text-[16px] leading-[24px]">
          {t("AIAgent")}
        </h3>
        <TooltipIconButton tooltip={t("NewChat")}>
          <IconButton
            iconName="btn-zoomup"
            size={24}
            isStroke
            onClick={() => {
              setCurrentPage("chat");
              onSwitchToNewThread();
            }}
            data-testid="new-chat-button"
          />
        </TooltipIconButton>
        <TooltipIconButton tooltip={t("ChatHistory")}>
          <IconButton
            iconName="btn-list-search"
            size={24}
            isActive={currentPage === "history"}
            onClick={() =>
              setCurrentPage(currentPage === "history" ? "chat" : "history")
            }
            data-testid="chat-history-button"
          />
        </TooltipIconButton>
      </div>
      {!hideSettingsButton ? (
        <TooltipIconButton tooltip={t("Settings")}>
          <IconButton
            iconName="btn-settings"
            size={24}
            isStroke
            isActive={settingsActive}
            onClick={handleSettingsClick}
            data-testid="settings-button"
          />
        </TooltipIconButton>
      ) : null}
    </nav>
  );
};

export { Navigation };
