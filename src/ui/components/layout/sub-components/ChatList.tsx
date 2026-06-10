import React, { useCallback, useMemo } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useStores } from "../../../store/context";
import { IconButton } from "../../icon-button";
import { Input } from "../../input";
import { ChatListItem } from "./ChatListItem";

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

  const { t } = useI18n();

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

  const isEmptyList = threads.length === 0;

  const onSwitchToThreadAction = (id: string) => {
    onSwitchToThread(id);
    setCurrentPage("chat");
  };

  return (
    <div className="w-full h-full max-h-full flex flex-col overflow-y-auto">
      <div className="sticky top-0 bg-[var(--layout-background-color)] z-10 pt-[24px] px-[24px]">
        <div className="flex items-center justify-between px-[8px]">
          <h4 className="text-[13px] leading-[16px] font-bold text-[var(--chat-list-color)]">
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
              showingThreads.map((thread) => {
                const isActive = thread.threadId === threadId;
                return (
                  <ChatListItem
                    key={thread.threadId}
                    thread={thread}
                    isActive={isActive}
                    onSwitchToThread={onSwitchToThreadAction}
                    setCurrentPage={setCurrentPage}
                    onRenameThread={onRenameThread}
                    onDownloadThread={onDownloadThread}
                    onClearThreadHistory={onClearThreadHistory}
                  />
                );
              })
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
