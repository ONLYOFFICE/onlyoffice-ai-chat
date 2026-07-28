import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "../../../../shared/utils";
import { useI18n } from "../../../providers/LocalesProvider";
import { usePlatform } from "../../../providers/PlatformProvider/context";
import { useStores } from "../../../store/context";
import { useWidgetConfig } from "../../../../widget-config";
import { IconButton } from "../../icon-button";
import { Input } from "../../input";
import { Loader } from "../../loader";
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
  const hasMoreThreads = useThreadsStore((s) => s.hasMoreThreads);
  const isLoadingMoreThreads = useThreadsStore((s) => s.isLoadingMoreThreads);
  const loadMoreThreads = useThreadsStore((s) => s.loadMoreThreads);
  const ensureAllThreads = useThreadsStore((s) => s.ensureAllThreads);
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

  // The search filter is client-side over the LOADED threads. With
  // pagination on and pages still remaining, drain the rest in the
  // background as soon as the user starts searching, so the filter
  // covers the whole collection — not just the loaded pages.
  useEffect(() => {
    if (!searchValue) return;
    // A drain failure (network) just leaves the search scoped to the
    // loaded pages — never an unhandled rejection.
    void ensureAllThreads().catch(() => undefined);
  }, [searchValue, ensureAllThreads]);

  // While the background drain is still running, an empty match list is
  // inconclusive — show a loader instead of a premature "no chats found".
  const isSearchDraining =
    !!searchValue && (hasMoreThreads || isLoadingMoreThreads);

  // Infinite scroll: when the sentinel below the list enters the scroll
  // viewport, pull the next page. The observer is rooted in the list's
  // own overflow container so it works regardless of the host layout.
  // `threads.length` in the deps reconnects the observer after every
  // appended page: `observe` fires the initial intersection state, so if
  // the sentinel is STILL visible (a page shorter than the viewport) the
  // next page loads without requiring another scroll gesture.
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const showSentinel = hasMoreThreads && !searchValue;
  const threadsCount = threads.length;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!showSentinel || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMoreThreads().catch(() => undefined);
        }
      },
      { root: scrollRootRef.current, rootMargin: "120px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [showSentinel, loadMoreThreads, threadsCount]);

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
      ref={scrollRootRef}
      className={cn(
        "w-full h-full max-h-full flex flex-col overflow-y-auto",
        className
      )}
    >
      <div className="sticky top-0 bg-[var(--layout-background-color)] z-10 pt-[8px] px-[12px]">
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
          <div className="mt-[8px]">
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
      <div className="flex flex-col px-[12px] pb-[8px]">
        {isEmptyList ? (
          <p className="select-none text-[var(--chat-list-empty-color)] font-normal w-full text-center mt-[8px]">
            {t("NoChatYet")}
          </p>
        ) : (
          <div className="flex flex-col mt-[8px]">
            {showingThreads.length ? (
              groups.map((group) => (
                <div key={group.key} className="flex flex-col mb-[8px]">
                  <p className="select-none [font-weight:var(--chat-list-group-header-font-weight,400)] text-[length:var(--chat-list-group-header-font-size,var(--fs-11))] leading-[var(--lh-20)] text-[var(--chat-list-group-header-color)] px-[8px]">
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
            ) : isSearchDraining ? (
              <div
                data-testid="chat-list-search-loading"
                className="flex items-center justify-center py-[8px]"
              >
                <Loader size={16} />
              </div>
            ) : (
              <p className="select-none text-[var(--chat-list-empty-color)] font-normal w-full">
                {t("NoChatsFound")}
              </p>
            )}
            {showSentinel ? (
              <div
                ref={sentinelRef}
                data-testid="chat-list-sentinel"
                className="flex items-center justify-center py-[8px]"
              >
                {isLoadingMoreThreads ? <Loader size={16} /> : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export { ChatList };
