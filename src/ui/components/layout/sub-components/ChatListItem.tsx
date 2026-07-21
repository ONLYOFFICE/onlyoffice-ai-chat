import React, { memo } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import type { Page } from "../../../store/create-stores";
import type { Thread } from "../../../../types";
import type { ExportFormat } from "../../../providers/PlatformProvider/types";
import type { DropDownItemProps } from "../../dropdown-item/DropDownItem.types";
import { DropdownMenu } from "../../dropdown";
import { Icon } from "../../icon";
import { IconButton } from "../../icon-button";
import { Input } from "../../input";
import { DeleteChatDialog } from "./DeleteChatDialog";

type ChatListItemProps = {
  thread: Thread;
  isActive: boolean;
  onSwitchToThread: (threadId: string) => void;
  onRenameThread: (threadId: string, newTitle: string) => void;
  onDownloadThread: (threadId: string, title?: string) => void;
  onExportThread: (threadId: string, formatId: string, title?: string) => void;
  exportFormats: ExportFormat[];
  onClearThreadHistory: (threadId: string) => void;
  showClearHistory?: boolean;
  setCurrentPage: (page: Page) => void;
  /**
   * Show the actions trigger permanently instead of only on hover.
   * Useful on touch devices or hosts that want the menu always discoverable.
   */
  alwaysShowActions?: boolean;
};

const DownloadIcon = () => <Icon name="btn-save" size={24} isStroke />;
const RenameIcon = () => <Icon name="btn-rename" size={24} />;
const RemoveIcon = () => <Icon name="btn-remove" size={24} />;
const OpenIcon = () => <Icon name="btn-open" size={24} />;
const ClearHistoryIcon = () => <Icon name="btn-clear" size={24} />;

const activeThreadMarker =
  "relative before:content-[''] before:absolute before:start-0 before:w-[2px] before:h-full before:bg-[var(--chat-list-item-active-marker-bg)] hover:before:hidden";

const ChatListItemComponent = ({
  thread,
  isActive,
  onSwitchToThread,
  onRenameThread,
  onDownloadThread,
  onExportThread,
  exportFormats,
  onClearThreadHistory,
  showClearHistory = false,
  setCurrentPage,
  alwaysShowActions,
}: ChatListItemProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isRenameInputVisible, setIsRenameInputVisible] = React.useState(false);
  const [isDeleteDialogVisible, setIsDeleteDialogVisible] =
    React.useState(false);

  const [newTitle, setNewTitle] = React.useState(thread.title);

  const inputRef = React.useRef<HTMLInputElement>(null);

  const { t } = useI18n();

  // Handle keyboard events for rename input
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isRenameInputVisible) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setIsRenameInputVisible(false);
        setNewTitle(thread.title); // Reset to original title
      } else if (event.key === "Enter") {
        event.preventDefault();
        inputRef.current?.blur(); // This will trigger the onBlur event
      }
    };

    if (isRenameInputVisible) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRenameInputVisible, thread.title]);

  const onSwitchToThreadAction = () => {
    if (isOpen || isRenameInputVisible || isDeleteDialogVisible) return;

    onSwitchToThread(thread.threadId);
    setCurrentPage("chat");
  };

  const onOpenClick = () => {
    setIsOpen(false);
    onSwitchToThread(thread.threadId);
    setCurrentPage("chat");
  };

  const onDeleteClick = () => {
    setIsDeleteDialogVisible(true);
    setIsOpen(false);
  };

  const onRenameClick = () => {
    setIsRenameInputVisible(true);
    setIsOpen(false);
  };

  const onClearHistoryClick = () => {
    onClearThreadHistory(thread.threadId);
    setIsOpen(false);
  };

  const onDownloadClick = () => {
    onDownloadThread(thread.threadId, thread.title);
    setIsOpen(false);
  };

  // When the host declares more than one export format, the single "Save"
  // item becomes an "Export" submenu listing every format. Otherwise the
  // default "Save" action is kept (current behavior).
  const exportMenuItem: DropDownItemProps =
    exportFormats.length > 1
      ? {
          text: t("ExportTo"),
          onClick: () => undefined,
          subMenu: exportFormats.map((format) => ({
            text: format.label,
            onClick: () => {
              onExportThread(thread.threadId, format.id, thread.title);
              setIsOpen(false);
            },
          })),
        }
      : {
          icon: <DownloadIcon />,
          text: t("Save"),
          onClick: onDownloadClick,
        };

  const separatorItem: DropDownItemProps = {
    text: "",
    isSeparator: true,
    onClick: () => undefined,
  };

  const deleteItem: DropDownItemProps = {
    icon: <RemoveIcon />,
    text: t("Delete"),
    onClick: onDeleteClick,
  };

  // "Clear history" is opt-in (WidgetConfig.showClearHistory). When shown, it
  // trails a separator below "Delete" (current layout). When hidden, the
  // separator instead precedes "Delete" so the destructive action stays set
  // apart from the neutral Open/Export/Rename group.
  const menuItems: DropDownItemProps[] = [
    {
      icon: <OpenIcon />,
      text: t("Open"),
      onClick: onOpenClick,
    },
    exportMenuItem,
    {
      icon: <RenameIcon />,
      text: t("Rename"),
      onClick: onRenameClick,
    },
    ...(showClearHistory
      ? [
          deleteItem,
          separatorItem,
          {
            icon: <ClearHistoryIcon />,
            text: t("ClearHistory"),
            onClick: onClearHistoryClick,
          },
        ]
      : [separatorItem, deleteItem]),
  ];

  return (
    <div
      key={thread.threadId}
      className={`cursor-pointer rounded-[4px] h-[var(--chat-list-item-height)] min-h-[var(--chat-list-item-height)] px-[var(--chat-list-item-padding-x)] flex items-center justify-between hover:bg-[var(--chat-list-item-hover-background-color)] ${
        isRenameInputVisible
          ? "px-[0px]"
          : isOpen
            ? "bg-[var(--chat-list-item-hover-background-color)]"
            : isActive
              ? activeThreadMarker
              : "active:bg-[var(--chat-list-item-active-background-color)]"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        if (!isOpen) {
          setIsHovered(false);
        }
      }}
      onClick={onSwitchToThreadAction}
    >
      {isRenameInputVisible ? (
        <Input
          ref={inputRef}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onBlur={() => {
            setIsRenameInputVisible(false);

            if (newTitle) {
              onRenameThread(thread.threadId, newTitle);
            }
          }}
          autoFocus
          className="w-full"
          maxLength={128}
        />
      ) : (
        <>
          <p className="select-none text-[length:var(--chat-list-item-font-size,var(--fs-12))] text-[var(--chat-list-item-color)] [font-weight:var(--chat-list-item-font-weight,400)] truncate">
            {thread.title}
          </p>
          {(alwaysShowActions || isHovered) && !isRenameInputVisible ? (
            <DropdownMenu
              open={isOpen}
              onOpenChange={setIsOpen}
              trigger={
                <IconButton
                  iconName="more"
                  size={24}
                  isActive={isOpen}
                  insideElement
                />
              }
              items={menuItems}
              sideOffset={0}
            />
          ) : null}
        </>
      )}

      {isDeleteDialogVisible ? (
        <DeleteChatDialog
          id={thread.threadId}
          onClose={() => setIsDeleteDialogVisible(false)}
        />
      ) : null}
    </div>
  );
};

const ChatListItem = memo(ChatListItemComponent);
export { ChatListItem };
