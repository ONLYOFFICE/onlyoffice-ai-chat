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
import { usePlatform } from "../../../providers/PlatformProvider";
import { useStores } from "../../../store/context";
import { selectImageBase64 } from "../../../store/create-attachments-store";
import type { TAttachmentFile } from "../../../../types";
import { PROMPT_DIALOG_CLASS } from "./ComposerActionPrompts";
import { useWidgetConfig } from "../../../../widget-config";
import logger from "../../../../shared/logger";

type NewFolderDialogProps = {
  messageText: string;
  onClose: VoidFunction;
};

const NewFolderDialog = ({ messageText, onClose }: NewFolderDialogProps) => {
  const { Button, DialogContent, Input } = useComponents();
  const { t, isRTL } = useI18n();
  const { usePromptsStore } = useStores();
  const addFolder = usePromptsStore((s) => s.addFolder);
  const addPrompt = usePromptsStore((s) => s.addPrompt);
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
              className="w-full"
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
  const { copyToClipboard: platformCopy } = usePlatform();
  const { onCreatePromptFolder } = useWidgetConfig();
  const addPrompt = usePromptsStore((s) => s.addPrompt);
  const addFolder = usePromptsStore((s) => s.addFolder);
  const folders = usePromptsStore((s) => s.folders);
  const [isOpen, setIsOpen] = useState(false);
  const [isNewFolderDialogVisible, setIsNewFolderDialogVisible] =
    useState(false);

  // When the host supplies `onCreatePromptFolder`, it owns the name-input UI
  // (its own modal) and resolves the folder name; the widget creates the
  // folder and saves the prompt once the host returns a non-empty name.
  // Otherwise fall back to the built-in dialog.
  const requestNewFolder = useCallback(async () => {
    if (!onCreatePromptFolder) {
      setIsNewFolderDialogVisible(true);
      return;
    }
    try {
      const text = getMessageText();
      const name = await onCreatePromptFolder(t("NewFolder"));
      const trimmed = name?.trim();
      if (!trimmed) return;
      const folderId = await addFolder(trimmed);
      await addPrompt({
        name: text.slice(0, 15),
        text,
        folderId: folderId ?? null,
      });
    } catch (err) {
      logger.error("onCreatePromptFolder handler failed:", err);
    }
    // getMessageText reads from `message`, captured fresh each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCreatePromptFolder, addFolder, addPrompt, t]);

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
    const write = platformCopy
      ? Promise.resolve(platformCopy(text))
      : navigator.clipboard.writeText(text);
    void write.then(() => {
      setCopied(true);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopied(false), 3000);
    });
    // getMessageText reads from `message`, captured fresh each render — no
    // dependency array needed beyond the message identity below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, platformCopy]);

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
              text: t("SaveAIPromptToFolder"),
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
                    void requestNewFolder();
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

  const images: ImageItem[] = message.content
    .filter((item) => item.type === "image")
    .map((item) => parseImageBlock(item.image));

  const files: TAttachmentFile[] = message.content
    .filter((item) => item.type === "file")
    .map((item) => parseFileBlock(item.mimeType, item.data));

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
              {images.map((img, i) => (
                <ImagePreview
                  key={img.refId ?? `${img.inline}-${i}`}
                  item={img}
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
            "bg-[var(--chat-user-message-background)] text-[var(--chat-user-message-color)] col-start-2 break-words rounded-[16px] px-[12px] py-[8px] select-text",
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

// ---------------------------------------------------------------------------
// Attachment block parsing (legacy inline + new ref form)
// ---------------------------------------------------------------------------

type ImageItem = { refId?: string; inline?: string };

function parseRefMeta(value: unknown): {
  ref: string;
  title: string;
  kind: "file" | "image";
  path?: string;
  type?: number;
} | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value[0] !== "{" || !value.includes('"ref"')) return null;
  try {
    const parsed = JSON.parse(value);
    if (
      parsed &&
      typeof parsed.ref === "string" &&
      typeof parsed.title === "string" &&
      (parsed.kind === "file" || parsed.kind === "image")
    ) {
      return parsed;
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

function parseFileBlock(mimeType: string, data: string): TAttachmentFile {
  const ref = parseRefMeta(mimeType);
  if (ref) {
    return {
      // FileItem renders icon + name from `path` and `type`. Title is
      // already the leaf filename in the ref-form.
      path: ref.path ?? ref.title,
      type: ref.type ?? 0,
      content: "",
    };
  }
  // Legacy inline block.
  try {
    const meta = JSON.parse(mimeType);
    return { path: meta.path, type: meta.type, content: data };
  } catch {
    return { path: "", type: 0, content: data };
  }
}

function parseImageBlock(image: string): ImageItem {
  const ref = parseRefMeta(image);
  if (ref) return { refId: ref.ref };
  return { inline: image };
}

const ImagePreview = ({ item }: { item: ImageItem }) => {
  const { api, useAttachmentsStore } = useStores();
  const cachedBase64 = useAttachmentsStore(selectImageBase64(item.refId));
  const [fetchedSrc, setFetchedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (item.inline) return;
    if (!item.refId || cachedBase64) return;
    let cancelled = false;
    api.attachments.get(item.refId).then((rec) => {
      if (cancelled) return;
      setFetchedSrc(rec?.base64 ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [api, item.inline, item.refId, cachedBase64]);

  const src = item.inline ?? cachedBase64 ?? fetchedSrc;

  if (!src) {
    return (
      <div className="h-[72px] w-[72px] rounded-[8px] bg-[var(--background-tertiary)]" />
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-[72px] w-[72px] rounded-[8px] object-cover"
    />
  );
};
