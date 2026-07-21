import React, { useCallback, useMemo } from "react";
import { cn } from "../../../../shared/utils";
import { useI18n } from "../../../providers/LocalesProvider";
import { usePlatform } from "../../../providers/PlatformProvider/context";
import { useStores } from "../../../store/context";
import { useWidgetConfig } from "../../../../widget-config";
import { IconButton } from "../../icon-button";
import { Input } from "../../input";
import { ChatListItem } from "./ChatListItem";
import { groupThreadsByDate } from "./ChatList.utils";

type ChatListProps = {
  /**
   * Hide the header row (the "Chat history" title and its close button),
   * keeping the search field and thread list. When provided, this overrides
   * the `hideChatHistoryHeader` widget config — useful when rendering
   * `ChatList` directly (headless), where the widget config isn't in scope.
   */
  hideHeader?: boolean;
  /**
   * Extra class names merged onto the root container for external styling.
   * Resolved with `tailwind-merge`, so utilities here win over the built-in
   * ones (e.g. pass `"h-auto px-0"` to override the defaults).
   */
  className?: string;
  /**
   * Show each thread's actions trigger permanently instead of only on
   * hover. When provided, this overrides the `chatHistoryAlwaysShowActions`
   * widget config.
   */
  alwaysShowActions?: boolean;
};

const ChatList = ({
  hideHeader,
  className,
  alwaysShowActions,
}: ChatListProps) => {
  const { useThreadsStore, useRouter } = useStores();
  const threads = useThreadsStore((s) => s.threads);
  const threadId = useThreadsStore((s) => s.threadId);
  const onSwitchToThread = useThreadsStore((s) => s.onSwitchToThread);
  const onRenameThread = useThreadsStore((s) => s.onRenameThread);
  const onDownloadThread = useThreadsStore((s) => s.onDownloadThread);
  const onExportThread = useThreadsStore((s) => s.onExportThread);
  const onClearThreadHistory = useThreadsStore((s) => s.onClearThreadHistory);
  const setCurrentPage = useRouter((s) => s.setCurrentPage);
  const {
    showClearHistory,
    chatHistoryCloseIcon,
    hideChatHistoryHeader,
    chatHistoryAlwaysShowActions,
  } = useWidgetConfig();
  const platform = usePlatform();
  const exportFormats = useMemo(
    () => platform.file?.getExportFormats?.() ?? [],
    [platform]
  );

  const closeIconName = chatHistoryCloseIcon ?? "btn-close";
  const isHeaderHidden = hideHeader ?? hideChatHistoryHeader;
  const showActionsAlways = alwaysShowActions ?? chatHistoryAlwaysShowActions;

  const [searchValue, setSearchValue] = React.useState("");

  const { t, locale } = useI18n();

  const onChangeSearchValue = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchValue(value);
    },
    []
  );

  const showingThreads = useMemo(
    () =>
      threads.filter((thread) =>
        thread.title?.toLowerCase().includes(searchValue.toLowerCase())
      ),
    [threads, searchValue]
  );

  // Bucket the (already date-sorted) threads into Today / Yesterday /
  // Previous 7 Days / Previous 30 Days / by month. Recomputed when the
  // visible list or language changes; `Date.now()` is read here so groups
  // reflect the current day each time the list re-renders.
  const groups = useMemo(
    () =>
      groupThreadsByDate(showingThreads, Date.now(), locale, {
        today: t("Today"),
        yesterday: t("Yesterday"),
        previous7: t("Previous7Days"),
        previous30: t("Previous30Days"),
        older: t("Older"),
      }),
    [showingThreads, locale, t]
  );

  const isEmptyList = threads.length === 0;

  const onSwitchToThreadAction = (id: string) => {
    onSwitchToThread(id);
    setCurrentPage("chat");
  };

  return (
    <div
      className={cn(
        "w-full h-full max-h-full flex flex-col overflow-y-auto",
        className
      )}
    >
      <div className="sticky top-0 bg-[var(--layout-background-color)] z-10 pt-[var(--chat-list-header-padding-top)] px-[var(--chat-list-padding-x)]">
        {!isHeaderHidden && (
          <div className="flex items-center justify-between">
            <h4 className="select-none text-[length:var(--chat-list-title-font-size,var(--fs-13))] leading-[var(--lh-16)] [font-weight:var(--chat-list-title-font-weight,700)] text-[var(--chat-list-color)]">
              {t("ChatHistory")}
            </h4>
            <IconButton
              iconName={closeIconName}
              size={24}
              onClick={() => setCurrentPage("chat")}
            />
          </div>
        )}
        {!isEmptyList && (
          <div className="mt-[var(--chat-list-search-margin-top)]">
            <Input
              className="w-full"
              type="search"
              placeholder={t("Search")}
              icon="btn-menu-search"
              value={searchValue}
              onChange={onChangeSearchValue}
              onClear={() => setSearchValue("")}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col px-[var(--chat-list-padding-x)] pb-[var(--chat-list-content-padding-bottom)]">
        {isEmptyList ? (
          <p className="select-none text-[var(--chat-list-empty-color)] font-normal w-full text-center mt-[var(--chat-list-items-margin-top)]">
            {t("NoChatYet")}
          </p>
        ) : (
          <div className="flex flex-col mt-[var(--chat-list-items-margin-top)]">
            {showingThreads.length ? (
              groups.map((group) => (
                <div
                  key={group.key}
                  className="flex flex-col mb-[var(--chat-list-group-margin-bottom)]"
                >
                  <p className="select-none [font-weight:var(--chat-list-group-header-font-weight,400)] text-[length:var(--chat-list-group-header-font-size,var(--fs-11))] leading-[var(--lh-20)] text-[var(--chat-list-group-header-color)] px-[var(--chat-list-group-header-padding-x)]">
                    {group.label}
                  </p>
                  {group.threads.map((thread) => (
                    <ChatListItem
                      key={thread.threadId}
                      thread={thread}
                      isActive={thread.threadId === threadId}
                      onSwitchToThread={onSwitchToThreadAction}
                      setCurrentPage={setCurrentPage}
                      onRenameThread={onRenameThread}
                      onDownloadThread={onDownloadThread}
                      onExportThread={onExportThread}
                      exportFormats={exportFormats}
                      onClearThreadHistory={onClearThreadHistory}
                      alwaysShowActions={showActionsAlways}
                      showClearHistory={showClearHistory}
                    />
                  ))}
                </div>
              ))
            ) : (
              <p className="select-none text-[var(--chat-list-empty-color)] font-normal w-full">
                {t("NoChatsFound")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export { ChatList };
