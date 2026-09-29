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
import { useToast } from "../../../components/toast";
import { useWidgetConfig } from "../../../../widget-config";
import logger from "../../../../shared/logger";

/**
 * Upper bound for a prompt name derived from the message text. The menu
 * ellipsizes long names and shows the full one in a tooltip, so this only
 * keeps a pasted wall of text from being stored twice (name + text).
 */
const PROMPT_NAME_MAX_LENGTH = 100;

/**
 * Default name for a prompt saved from a message: the text on one line
 * (newlines and runs of whitespace collapsed), capped at
 * `PROMPT_NAME_MAX_LENGTH`.
 */
const derivePromptName = (text: string) =>
  text.replace(/\s+/g, " ").trim().slice(0, PROMPT_NAME_MAX_LENGTH);

/**
 * The confirmation shown after a prompt is saved, in the two wordings the
 * design calls for: a bare "Prompt saved", or one naming the folder it landed
 * in. Shared by every save path (no folder / existing folder / a folder created
 * on the spot) so they can't drift apart.
 */
const useSavedPromptToast = () => {
  const { showToast } = useToast();
  const { t } = useI18n();

  return useCallback(
    (folderName?: string | null) => {
      const folder = folderName?.trim();
      if (!folder) {
        showToast(t("PromptSaved"));
        return;
      }
      // The library's `t` takes a key and nothing else — it drops i18next's
      // options argument — so the folder name is substituted here rather than
      // through interpolation. The replacer function keeps `$`-sequences in a
      // user-typed folder name from being read as replacement patterns.
      showToast(t("PromptSavedToFolder").replace("{{folder}}", () => folder));
    },
    [showToast, t]
  );
};

type NewFolderDialogProps = {
  messageText: string;
  onClose: VoidFunction;
};

const NewFolderDialog = ({ messageText, onClose }: NewFolderDialogProps) => {
  const { DialogContent, Input, DialogFooter } = useComponents();
  const { t } = useI18n();
  const { usePromptsStore } = useStores();
  const addFolder = usePromptsStore((s) => s.addFolder);
  const addPrompt = usePromptsStore((s) => s.addPrompt);
  const [folderName, setFolderName] = useState(t("NewFolder"));
  const notifySaved = useSavedPromptToast();

  const onSave = useCallback(async () => {
    const name = folderName.trim();
    if (!name) return;
    const folderId = await addFolder(name);
    await addPrompt({
      name: derivePromptName(messageText),
      text: messageText,
      folderId: folderId ?? null,
    });
    // `addFolder` returning nothing means the folder wasn't created, so the
    // prompt went to the root — report where it actually landed.
    notifySaved(folderId ? name : null);
    onClose();
  }, [folderName, onClose, addFolder, addPrompt, messageText, notifySaved]);

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
          <div className="py-[var(--new-folder-dialog-body-padding-y,32px)]">
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full"
              autoFocus
            />
          </div>
          <DialogFooter
            className="h-[64px] mx-[-24px] px-[24px]"
            cancelLabel={t("Cancel")}
            onCancel={onClose}
            submitLabel={t("Save")}
            submitType="submit"
            submitDisabled={!folderName.trim()}
            buttonClassName="h-[36px]"
          />
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
  const {
    onCreatePromptFolder,
    onCreatePrompt,
    chatMessageActionsIconSize = 24,
  } = useWidgetConfig();
  const addPrompt = usePromptsStore((s) => s.addPrompt);
  const addFolder = usePromptsStore((s) => s.addFolder);
  const folders = usePromptsStore((s) => s.folders);
  const [isOpen, setIsOpen] = useState(false);
  const [isNewFolderDialogVisible, setIsNewFolderDialogVisible] =
    useState(false);
  const notifySaved = useSavedPromptToast();

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
        name: derivePromptName(text),
        text,
        folderId: folderId ?? null,
      });
      notifySaved(folderId ? trimmed : null);
    } catch (err) {
      logger.error("onCreatePromptFolder handler failed:", err);
    }
    // getMessageText reads from `message`, captured fresh each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCreatePromptFolder, addFolder, addPrompt, t, notifySaved]);

  // When the host supplies `onCreatePrompt`, it owns the name/text input UI
  // (its own window) and resolves the prompt fields; the widget creates it
  // once the host returns a non-empty name. Otherwise the prompt is saved
  // directly with a name derived from the message text.
  const folderNameById = useCallback(
    (id: string | null) =>
      id ? (folders.find((f) => f.id === id)?.name ?? null) : null,
    [folders]
  );

  const requestCreatePrompt = useCallback(
    async (folderId: string | null) => {
      const text = getMessageText();
      const draft = { name: derivePromptName(text), text };
      if (!onCreatePrompt) {
        await addPrompt({ ...draft, folderId });
        notifySaved(folderNameById(folderId));
        return;
      }
      try {
        const result = await onCreatePrompt({
          ...draft,
          folderId,
          folders: folders.map((f) => ({ id: f.id, name: f.name })),
        });
        const name = result?.name?.trim();
        if (!name) {
          return;
        }
        // The host window may have moved the prompt to another folder, so the
        // toast names the folder it was saved to, not the one it started in.
        const savedFolderId =
          result?.folderId !== undefined ? result.folderId : folderId;
        await addPrompt({
          name,
          text: result?.text ?? "",
          folderId: savedFolderId,
        });
        notifySaved(folderNameById(savedFolderId));
      } catch (err) {
        logger.error("onCreatePrompt handler failed:", err);
      }
    },
    // getMessageText reads from `message`, captured fresh each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onCreatePrompt, addPrompt, folders, notifySaved, folderNameById]
  );

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
      ? Promise.resolve(platformCopy(text, { format: "markdown" }))
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
      <ActionBarPrimitive.Root className="col-start-2 mt-[4px] flex justify-end gap-[var(--chat-user-message-actions-gap,2px)]">
        <TooltipIconButton
          tooltip={copied ? t("Copied") : t("CopyToClipboard")}
          onClick={onCopy}
        >
          {copied ? (
            // `disableHover`, not `disabled`: the latter paints a not-allowed
            // cursor over a button the user just used successfully. The
            // tooltip reports the result instead.
            <IconButton
              iconName="checked"
              size={chatMessageActionsIconSize}
              isStroke
              color="var(--icon-gray-secondary)"
              disableHover
            />
          ) : (
            <IconButton
              iconName="btn-copy"
              size={chatMessageActionsIconSize}
              isStroke
              color="var(--icon-gray-secondary)"
            />
          )}
        </TooltipIconButton>
        <DropdownMenu
          open={isOpen}
          onOpenChange={setIsOpen}
          trigger={
            <IconButton
              iconName="btn-more.small"
              size={chatMessageActionsIconSize}
              isActive={isOpen}
              insideElement
              color="var(--icon-gray-secondary)"
            />
          }
          items={[
            {
              text: t("SaveAIPrompt"),
              onClick: () => {
                void requestCreatePrompt(null);
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
                    void requestCreatePrompt(folder.id);
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

  // Attachment-only sends carry a text block with an empty string (see
  // `onNew`) — skip the bubble entirely rather than rendering an empty,
  // still-visible rounded/padded/background box under the file chips.
  const hasText = message.content.some(
    (item) => item.type === "text" && item.text.trim().length > 0
  );

  return (
    <MessagePrimitive.Root asChild>
      <motion.div
        dir={isRTL ? "rtl" : "ltr"}
        className="mx-auto grid w-full max-w-[var(--thread-max-width)] auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-1 px-[var(--thread-padding-x)] py-[8px] first:pt-[12px] [&:where(>*)]:col-start-2"
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
              {files.map((file, i) => (
                <FileItem key={`${file.path}-${i}`} file={file} withoutClose />
              ))}
            </div>
          </div>
        ) : null}

        {hasText ? (
          <div
            className={cn(
              "bg-[var(--chat-user-message-background)] text-[var(--chat-user-message-color)] col-start-2 wrap-anywhere rounded-[var(--chat-user-message-border-radius,16px)] px-[12px] py-[8px] select-text",
              isRTL ? "rounded-bl-[0px]" : "rounded-br-[0px]"
            )}
          >
            <MessagePrimitive.Content
              components={{ Text: MarkdownText, Image: () => null }}
            />
          </div>
        ) : null}

        {/* Copy / save-as-prompt act on the message text — nothing to
            copy or save when the send was attachment-only. */}
        {hasText ? <UserActionBar /> : null}
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
      // already the leaf filename in the ref-form. Dropped files have no
      // local path at all and carry `path: ""` — an empty string is "no
      // path" here, so it must fall back to the title like a missing one
      // does, or the chip renders a bare ".".
      path: ref.path || ref.title,
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
