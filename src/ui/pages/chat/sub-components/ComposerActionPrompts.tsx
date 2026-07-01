import { useComposerRuntime } from "@assistant-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useComponents } from "../../../providers/ComponentsProvider";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";
import { Dialog } from "../../../components/dialog";
import { cn } from "../../../../shared/utils";
import { useStores } from "../../../store/context";
import { useWidgetConfig } from "../../../../widget-config";
import logger from "../../../../shared/logger";

export const PROMPT_DIALOG_CLASS =
  "!w-[480px] [&>div:last-child]:!px-[24px] [&>div:nth-child(2)]:!h-[52px] [&>div:nth-child(2)]:!ps-[24px] [&>div:nth-child(2)]:!pe-[8px] [&>div:nth-child(2)]:!py-[12px]";

type EditPromptDialogProps = {
  promptId: string;
  initialName: string;
  initialText: string;
  onClose: VoidFunction;
};

const EditPromptDialog = ({
  promptId,
  initialName,
  initialText,
  onClose,
}: EditPromptDialogProps) => {
  const { Button, DialogContent, FieldContainer, Input } = useComponents();
  const { t, isRTL } = useI18n();
  const { usePromptsStore } = useStores();
  const editPrompt = usePromptsStore((s) => s.editPrompt);
  const [name, setName] = useState(initialName);
  const [text, setText] = useState(initialText);

  const onSave = useCallback(() => {
    if (!name.trim()) return;
    editPrompt(promptId, { name: name.trim(), text });
    onClose();
  }, [name, text, promptId, onClose, editPrompt]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave]);

  return (
    <Dialog open={true}>
      <DialogContent
        header={t("EditAIPrompt")}
        onClose={onClose}
        className={PROMPT_DIALOG_CLASS}
      >
        <div className="flex flex-col justify-between h-full">
          <div className="flex flex-col gap-[12px] py-[24px]">
            <FieldContainer header={t("PromptName")}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
                autoFocus
              />
            </FieldContainer>
            <FieldContainer header={t("PromptText")}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                dir={isRTL ? "rtl" : "ltr"}
                className={cn(
                  "w-full min-h-[120px] rounded-[4px] box-border border border-[var(--input-border-color)]",
                  "bg-[var(--input-background-color)] resize-none",
                  "hover:bg-[var(--input-hover-background-color)] hover:border-[var(--input-hover-border-color)]",
                  "focus:bg-[var(--input-active-background-color)] focus:border focus:border-[var(--input-active-border-color)]",
                  "outline-none",
                  "placeholder:text-[var(--input-placeholder-color)] text-[var(--input-color)]",
                  "px-[12px] py-[8px] font-normal"
                )}
                spellCheck={false}
              />
            </FieldContainer>
          </div>
          <div
            className={cn(
              "flex items-center gap-[8px] h-[64px] mx-[-24px] px-[24px]",
              isRTL ? "flex-row-reverse justify-end" : "flex-row justify-end"
            )}
          >
            <Button variant="default" onClick={onClose} className="h-[36px]">
              {t("Cancel")}
            </Button>
            <Button
              onClick={onSave}
              disabled={!name.trim()}
              className="h-[36px]"
            >
              {t("Save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

type RenameFolderDialogProps = {
  folderId: string;
  initialName: string;
  onClose: VoidFunction;
};

const RenameFolderDialog = ({
  folderId,
  initialName,
  onClose,
}: RenameFolderDialogProps) => {
  const { Button, DialogContent, Input } = useComponents();
  const { t, isRTL } = useI18n();
  const { usePromptsStore } = useStores();
  const renameFolder = usePromptsStore((s) => s.renameFolder);
  const [name, setName] = useState(initialName);

  const onSave = useCallback(() => {
    if (!name.trim()) return;
    renameFolder(folderId, name.trim());
    onClose();
  }, [name, folderId, onClose, renameFolder]);

  return (
    <Dialog open={true}>
      <DialogContent
        header={t("RenameFolder")}
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
              value={name}
              onChange={(e) => setName(e.target.value)}
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
            <Button variant="default" onClick={onClose} className="h-[36px]">
              {t("Cancel")}
            </Button>
            <Button
              onClick={onSave}
              disabled={!name.trim()}
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

type DeleteFolderDialogProps = {
  folderId: string;
  onClose: VoidFunction;
};

const DeleteFolderDialog = ({ folderId, onClose }: DeleteFolderDialogProps) => {
  const { Button, DialogContent } = useComponents();
  const { t, isRTL } = useI18n();
  const { usePromptsStore } = useStores();
  const removeFolder = usePromptsStore((s) => s.removeFolder);

  const onConfirm = useCallback(() => {
    removeFolder(folderId);
    onClose();
  }, [folderId, onClose, removeFolder]);

  return (
    <Dialog open={true}>
      <DialogContent header={t("Warning")} onClose={onClose} withWarningIcon>
        <div
          className="flex flex-col justify-between h-full"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onConfirm();
            }
          }}
        >
          <p className="select-none h-[40px] flex items-center leading-[var(--lh-16)] text-[var(--text-normal)]">
            {t("WantDeleteFolder")}
          </p>
          <div
            className={cn(
              "flex items-center gap-[8px] h-[64px] mx-[-24px] px-[24px]",
              isRTL ? "flex-row-reverse justify-end" : "flex-row justify-end"
            )}
          >
            <Button variant="default" onClick={onClose}>
              {t("No")}
            </Button>
            <Button onClick={onConfirm}>{t("Yes")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ComposerActionPrompts = () => {
  const { DropdownMenu, IconButton, TooltipIconButton } = useComponents();
  const { t } = useI18n();
  const { usePromptsStore } = useStores();
  const { onEditPrompt, onRenamePromptFolder } = useWidgetConfig();
  const prompts = usePromptsStore((s) => s.prompts);
  const folders = usePromptsStore((s) => s.folders);
  const editPrompt = usePromptsStore((s) => s.editPrompt);
  const renameFolder = usePromptsStore((s) => s.renameFolder);
  const removePrompt = usePromptsStore((s) => s.removePrompt);
  const composerRuntime = useComposerRuntime();
  const [isOpen, setIsOpen] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<{
    id: string;
    name: string;
    text: string;
  } | null>(null);

  const trigger = useMemo(
    () => (
      <TooltipIconButton visible={!isOpen} tooltip={t("SavedPrompts")}>
        <IconButton
          iconName="btn-prompt"
          className="text-[var(--prompt-button-color,var(--icon-button-color))] hover:enabled:text-[var(--prompt-button-hover-color,var(--text-normal))]"
          size={20}
          isActive={isOpen}
          isStroke
        />
      </TooltipIconButton>
    ),
    [isOpen, t, IconButton, TooltipIconButton]
  );

  const applyPrompt = useCallback(
    (text: string) => {
      composerRuntime.setText(text);
    },
    [composerRuntime]
  );

  // When the host supplies `onRenamePromptFolder`, it owns the input UI
  // (its own modal) and resolves the new name; the widget renames once the
  // host returns a non-empty name. Otherwise fall back to the built-in dialog.
  const requestRenameFolder = useCallback(
    async (folder: { id: string; name: string }) => {
      if (!onRenamePromptFolder) {
        setRenamingFolder({ id: folder.id, name: folder.name });
        return;
      }
      try {
        const next = await onRenamePromptFolder(folder.name, folder.id);
        const trimmed = next?.trim();
        if (!trimmed) return;
        renameFolder(folder.id, trimmed);
      } catch (err) {
        logger.error("onRenamePromptFolder handler failed:", err);
      }
    },
    [onRenamePromptFolder, renameFolder]
  );

  // When the host supplies `onEditPrompt`, it owns the input UI (its own
  // window) and resolves the updated fields; the widget saves once the host
  // returns a non-empty name. Otherwise fall back to the built-in dialog.
  const requestEditPrompt = useCallback(
    async (prompt: {
      id: string;
      name: string;
      text: string;
      folderId?: string;
    }) => {
      if (!onEditPrompt) {
        setEditingPrompt({
          id: prompt.id,
          name: prompt.name,
          text: prompt.text,
        });
        return;
      }
      try {
        const result = await onEditPrompt({
          id: prompt.id,
          name: prompt.name,
          text: prompt.text,
          folderId: prompt.folderId ?? null,
          folders: folders.map((f) => ({ id: f.id, name: f.name })),
        });
        const name = result?.name?.trim();
        if (!name) return;
        await editPrompt(prompt.id, {
          name,
          text: result?.text ?? "",
          ...(result?.folderId !== undefined
            ? { folderId: result.folderId }
            : {}),
        });
      } catch (err) {
        logger.error("onEditPrompt handler failed:", err);
      }
    },
    [onEditPrompt, editPrompt, folders]
  );

  const buildPromptContextMenu = useCallback(
    (prompt: {
      id: string;
      name: string;
      text: string;
      folderId?: string;
    }): DropDownItemProps[] => {
      const moveToFolderItems: DropDownItemProps[] = [
        ...(prompt.folderId
          ? [
              {
                text: t("SavedPrompts"),
                onClick: () => editPrompt(prompt.id, { folderId: null }),
              },
            ]
          : []),
        ...folders
          .filter((f) => f.id !== prompt.folderId)
          .map((folder) => ({
            text: folder.name,
            onClick: () => editPrompt(prompt.id, { folderId: folder.id }),
          })),
      ];

      return [
        {
          text: t("EditAIPrompt"),
          onClick: () => {
            void requestEditPrompt(prompt);
          },
        },
        ...(moveToFolderItems.length > 0
          ? [
              {
                text: t("MoveToFolder"),
                onClick: () => undefined,
                subMenu: moveToFolderItems,
              },
            ]
          : []),
        {
          text: "",
          isSeparator: true,
          onClick: () => undefined,
        },
        {
          text: t("Delete"),
          onClick: () => removePrompt(prompt.id),
        },
      ];
    },
    [t, folders, editPrompt, removePrompt, requestEditPrompt]
  );

  const items = useMemo(() => {
    const result: DropDownItemProps[] = [];

    const rootPrompts = prompts.filter((p) => !p.folderId);
    for (const prompt of rootPrompts) {
      result.push({
        text: prompt.name,
        onClick: () => applyPrompt(prompt.text),
        subMenu: buildPromptContextMenu(prompt),
        subMenuIcon: "more",
        subMenuIconSize: 20,
      });
    }

    if (rootPrompts.length > 0 && folders.length > 0) {
      result.push({
        text: "",
        isSeparator: true,
        onClick: () => undefined,
      });
    }

    for (const folder of folders) {
      const folderPrompts = prompts.filter((p) => p.folderId === folder.id);
      result.push({
        text: folder.name,
        onClick: () => undefined,
        subMenu: [
          ...folderPrompts.map((prompt) => ({
            text: prompt.name,
            onClick: () => applyPrompt(prompt.text),
            subMenu: buildPromptContextMenu(prompt),
            subMenuIcon: "more",
            subMenuIconSize: 20,
          })),
          ...(folderPrompts.length > 0
            ? [{ text: "", isSeparator: true, onClick: () => undefined }]
            : []),
          {
            text: t("RenameFolder"),
            icon: "btn-rename",
            onClick: () => requestRenameFolder(folder),
          },
          {
            text: t("DeleteFolder"),
            icon: "btn-remove",
            onClick: () => setDeletingFolderId(folder.id),
          },
        ],
      });
    }

    return result;
  }, [
    prompts,
    folders,
    applyPrompt,
    buildPromptContextMenu,
    requestRenameFolder,
    t,
  ]);

  if (prompts.length === 0 && folders.length === 0) return null;

  return (
    <>
      <DropdownMenu
        trigger={trigger}
        items={items}
        onOpenChange={setIsOpen}
        contentClassName="w-[225px]"
      />
      {editingPrompt ? (
        <EditPromptDialog
          promptId={editingPrompt.id}
          initialName={editingPrompt.name}
          initialText={editingPrompt.text}
          onClose={() => setEditingPrompt(null)}
        />
      ) : null}
      {renamingFolder ? (
        <RenameFolderDialog
          folderId={renamingFolder.id}
          initialName={renamingFolder.name}
          onClose={() => setRenamingFolder(null)}
        />
      ) : null}
      {deletingFolderId ? (
        <DeleteFolderDialog
          folderId={deletingFolderId}
          onClose={() => setDeletingFolderId(null)}
        />
      ) : null}
    </>
  );
};

export { ComposerActionPrompts };
