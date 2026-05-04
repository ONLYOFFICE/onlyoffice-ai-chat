import {
  ActionBarPrimitive,
  MessagePrimitive,
  useMessage,
} from "@assistant-ui/react";
import { motion } from "framer-motion";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useComponents } from "../../../providers/ComponentsProvider";
import { Dialog } from "../../../components/dialog";
import { FileItem } from "../../../components/file-item";
import { MarkdownText } from "../../../components/markdown";
import { cn } from "../../../../shared/utils";
import { useStores } from "../../../store/context";
import type { TAttachmentFile } from "../../../../types";
import { PROMPT_DIALOG_CLASS } from "./ComposerActionPrompts";

type NewFolderDialogProps = {
  messageText: string;
  onClose: VoidFunction;
};

const NewFolderDialog = ({ messageText, onClose }: NewFolderDialogProps) => {
  const { Button, DialogContent, Input } = useComponents();
  const { t, isRTL } = useI18n();
  const { usePromptsStore } = useStores();
  const { addFolder, addPrompt } = usePromptsStore();
  const [folderName, setFolderName] = useState(t("NewFolder"));

  const onSave = useCallback(async () => {
    if (!folderName.trim()) return;
    const folderId = await addFolder(folderName.trim());
    await addPrompt({
      name: messageText.slice(0, 15),
      text: messageText,
      folderId: folderId ?? null,
    });
    onClose();
  }, [folderName, onClose, addFolder, addPrompt, messageText]);

  return (
    <Dialog open={true}>
      <DialogContent
        header={t("NewAIPromptFolder")}
        onClose={onClose}
        className={PROMPT_DIALOG_CLASS}
      >
        <form
          className="flex flex-col justify-between h-full"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <div className="py-[32px]">
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full h-[36px]"
              autoFocus
            />
          </div>
          <div
            className={cn(
              "flex items-center gap-[8px] h-[64px] mx-[-24px] px-[24px]",
              isRTL ? "flex-row-reverse justify-end" : "flex-row justify-end"
            )}
          >
            <Button
              type="button"
              variant="default"
              onClick={onClose}
              className="h-[36px]"
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!folderName.trim()}
              className="h-[36px]"
            >
              {t("Save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const UserActionBar = () => {
  const { DropdownMenu, IconButton, TooltipIconButton } = useComponents();
  const { t } = useI18n();
  const message = useMessage();
  const { usePromptsStore } = useStores();
  const { addPrompt, folders } = usePromptsStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isNewFolderDialogVisible, setIsNewFolderDialogVisible] =
    useState(false);

  const getMessageText = () =>
    message.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");

  const [copied, setCopied] = useState(false);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    },
    []
  );

  const onCopy = useCallback(() => {
    const text = getMessageText();
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopied(false), 3000);
    });
    // getMessageText reads from `message`, captured fresh each render — no
    // dependency array needed beyond the message identity below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  return (
    <>
      <ActionBarPrimitive.Root className="col-start-2 mt-1 flex justify-end gap-[8px]">
        <TooltipIconButton tooltip={t("CopyToClipboard")} onClick={onCopy}>
          {copied ? (
            <IconButton iconName="checked" size={24} isStroke disabled />
          ) : (
            <IconButton iconName="btn-copy" size={24} />
          )}
        </TooltipIconButton>
        <DropdownMenu
          open={isOpen}
          onOpenChange={setIsOpen}
          trigger={
            <IconButton
              iconName="more"
              size={20}
              isActive={isOpen}
              insideElement
            />
          }
          items={[
            {
              text: t("SaveAIPrompt"),
              onClick: () => {
                const text = getMessageText();
                void addPrompt({ name: text.slice(0, 15), text });
              },
            },
            {
              text: t("SaveAIPromptToTable"),
              onClick: () => {
                // TODO
              },
              subMenuClassName: "w-[225px]",
              subMenu: [
                ...folders.map((folder) => ({
                  text: folder.name,
                  onClick: () => {
                    const text = getMessageText();
                    void addPrompt({
                      name: text.slice(0, 15),
                      text,
                      folderId: folder.id,
                    });
                  },
                })),
                ...(folders.length > 0
                  ? [{ text: "", isSeparator: true, onClick: () => undefined }]
                  : []),
                {
                  text: t("NewFolder"),
                  trailingIcon: "btn-zoomup",
                  trailingIconSize: 16,
                  onClick: () => {
                    setIsNewFolderDialogVisible(true);
                  },
                },
              ],
            },
          ]}
          side="bottom"
          align="end"
        />
      </ActionBarPrimitive.Root>
      {isNewFolderDialogVisible ? (
        <NewFolderDialog
          messageText={getMessageText()}
          onClose={() => setIsNewFolderDialogVisible(false)}
        />
      ) : null}
    </>
  );
};

export const UserMessage = memo(() => {
  const message = useMessage();
  const { isRTL } = useI18n();

  const images = message.content
    .filter((item) => item.type === "image")
    .map((item) => item.image);

  const files: TAttachmentFile[] = message.content
    .filter((item) => item.type === "file")
    .map((item) => {
      return {
        type: JSON.parse(item.mimeType).type,
        content: item.data,
        path: JSON.parse(item.mimeType).path,
      };
    });

  return (
    <MessagePrimitive.Root asChild>
      <motion.div
        dir={isRTL ? "rtl" : "ltr"}
        className="mx-auto grid w-full max-w-[var(--thread-max-width)] auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-1 px-[var(--thread-padding-x)] py-4 [&:where(>*)]:col-start-2"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role="user"
      >
        {images.length > 0 || files.length > 0 ? (
          <div className="col-span-full col-start-1 row-start-1 mb-[8px] overflow-x-auto">
            <div className="flex flex-row gap-[8px] w-max justify-end ms-auto">
              {images.map((src) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="h-[72px] w-[72px] rounded-[8px] object-cover"
                />
              ))}
              {files.map((file) => (
                <FileItem key={file.path} file={file} withoutClose />
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "bg-[var(--chat-user-message-background)] text-[var(--chat-user-message-color)] col-start-2 break-words rounded-[16px] px-[12px] py-[8px]",
            isRTL ? "rounded-bl-[0px]" : "rounded-br-[0px]"
          )}
        >
          <MessagePrimitive.Content
            components={{ Text: MarkdownText, Image: () => null }}
          />
        </div>

        <UserActionBar />
      </motion.div>
    </MessagePrimitive.Root>
  );
});
