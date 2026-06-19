import React, { useCallback, useMemo } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useStores } from "../../../store/context";
import { IconButton } from "../../icon-button";
import { Input } from "../../input";
import { ChatListItem } from "./ChatListItem";
import { groupThreadsByDate } from "./ChatList.utils";

const ChatList = () => {
  const { useThreadsStore, useRouter } = useStores();
  const threads = useThreadsStore((s) => s.threads);
  const threadId = useThreadsStore((s) => s.threadId);
  const onSwitchToThread = useThreadsStore((s) => s.onSwitchToThread);
  const onRenameThread = useThreadsStore((s) => s.onRenameThread);
  const onDownloadThread = useThreadsStore((s) => s.onDownloadThread);
  const onClearThreadHistory = useThreadsStore((s) => s.onClearThreadHistory);
  const setCurrentPage = useRouter((s) => s.setCurrentPage);

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
    <div className="w-full h-full max-h-full flex flex-col overflow-y-auto">
      <div className="sticky top-0 bg-[var(--layout-background-color)] z-10 pt-[24px] px-[24px]">
        <div className="flex items-center justify-between px-[8px]">
          <h4 className="text-[var(--fs-13)] leading-[var(--lh-16)] font-bold text-[var(--chat-list-color)]">
            {t("ChatHistory")}
          </h4>
          <IconButton
            iconName="btn-close"
            size={24}
            onClick={() => setCurrentPage("chat")}
          />
        </div>
        {!isEmptyList && (
          <div className="mt-[16px]">
            <Input
              className="w-full"
              type="search"
              placeholder={t("Search")}
              icon="search"
              value={searchValue}
              onChange={onChangeSearchValue}
              onClear={() => setSearchValue("")}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col px-[24px] pb-[24px]">
        {isEmptyList ? (
          <p className="text-[var(--chat-list-empty-color)] font-normal w-full text-center mt-[24px]">
            {t("NoChatYet")}
          </p>
        ) : (
          <div className="flex flex-col mt-[16px]">
            {showingThreads.length ? (
              groups.map((group) => (
                <div key={group.key} className="flex flex-col">
                  <p className="select-none font-normal text-[var(--fs-11)] leading-[var(--lh-20)] text-[var(--chat-list-group-header-color)] mt-[16px] mb-[8px] first:mt-0">
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
                      onClearThreadHistory={onClearThreadHistory}
                    />
                  ))}
                </div>
              ))
            ) : (
              <p className="text-[var(--chat-list-empty-color)] font-normal w-full">
                {t("NoChatYet")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export { ChatList };
