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

/**
 * Name of the virtual folder that mirrors the host-configured
 * `suggestions` inside the prompts dropdown. A fixed identifier by
 * contract — deliberately NOT translated.
 */
export const BUILT_IN_PROMPTS_FOLDER = "built-in-prompts";

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
  const { DialogContent, FieldContainer, Input, DialogFooter } =
    useComponents();
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
          <div className="flex flex-col gap-[12px] py-[var(--edit-prompt-dialog-body-padding-y,32px)]">
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
          <DialogFooter
            className="h-[64px] mx-[-24px] px-[24px]"
            cancelLabel={t("Cancel")}
            onCancel={onClose}
            submitLabel={t("Save")}
            onSubmit={onSave}
            submitDisabled={!name.trim()}
            buttonClassName="h-[36px]"
          />
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
  const { DialogContent, Input, DialogFooter } = useComponents();
  const { t } = useI18n();
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
          <div className="py-[var(--rename-folder-dialog-body-padding-y,32px)]">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full"
              autoFocus
            />
          </div>
          <DialogFooter
            className="h-[64px] mx-[-24px] px-[24px]"
            cancelLabel={t("Cancel")}
            onCancel={onClose}
            submitLabel={t("Save")}
            onSubmit={onSave}
            submitDisabled={!name.trim()}
            buttonClassName="h-[36px]"
          />
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
  const { DialogContent, DialogFooter } = useComponents();
  const { t } = useI18n();
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
          <p className="select-none h-[var(--delete-folder-dialog-message-height,40px)] flex items-center leading-[var(--lh-16)] text-[var(--text-normal)]">
            {t("WantDeleteFolder")}
          </p>
          <DialogFooter
            className="h-[64px] mx-[-24px] px-[24px]"
            cancelLabel={t("No")}
            onCancel={onClose}
            submitLabel={t("Yes")}
            onSubmit={onConfirm}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

type DeletePromptDialogProps = {
  promptId: string;
  onClose: VoidFunction;
};

const DeletePromptDialog = ({ promptId, onClose }: DeletePromptDialogProps) => {
  const { DialogContent, DialogFooter } = useComponents();
  const { t } = useI18n();
  const { usePromptsStore } = useStores();
  const removePrompt = usePromptsStore((s) => s.removePrompt);

  const onConfirm = useCallback(() => {
    removePrompt(promptId);
    onClose();
  }, [promptId, onClose, removePrompt]);

  // Named title and action label rather than the folder dialog's generic
  // "Warning" + Yes/No, so the built-in fallback reads the same as the host
  // windows the desktop and docs plugins open for this action.
  return (
    <Dialog open={true}>
      <DialogContent
        header={t("DeletePrompt")}
        onClose={onClose}
        withWarningIcon
      >
        <div
          className="flex flex-col justify-between h-full"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onConfirm();
            }
          }}
        >
          <p className="select-none h-[var(--delete-folder-dialog-message-height,40px)] flex items-center leading-[var(--lh-16)] text-[var(--text-normal)]">
            {t("WantDeletePrompt")}
          </p>
          <DialogFooter
            className="h-[64px] mx-[-24px] px-[24px]"
            cancelLabel={t("Cancel")}
            onCancel={onClose}
            submitLabel={t("DeletePromptConfirm")}
            onSubmit={onConfirm}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ComposerActionPrompts = () => {
  const { DropdownMenu, IconButton, TooltipIconButton } = useComponents();
  const { t } = useI18n();
  const { usePromptsStore } = useStores();
  const {
    onEditPrompt,
    onRenamePromptFolder,
    onDeletePromptFolder,
    onDeletePrompt,
    suggestions,
  } = useWidgetConfig();
  const prompts = usePromptsStore((s) => s.prompts);
  const folders = usePromptsStore((s) => s.folders);
  const editPrompt = usePromptsStore((s) => s.editPrompt);
  const renameFolder = usePromptsStore((s) => s.renameFolder);
  const removeFolder = usePromptsStore((s) => s.removeFolder);
  const removePrompt = usePromptsStore((s) => s.removePrompt);
  const composerRuntime = useComposerRuntime();
  const [isOpen, setIsOpen] = useState(false);
  // Closing the outer menu is driven from here (it's rendered controlled).
  // Flyout submenus are independent Radix roots, so selecting an item inside
  // one — "Edit", "Delete", a folder pick — only dismisses that inner root;
  // the outer prompts menu has to be closed explicitly, otherwise it lingers
  // (and, when a dialog opens on top of the still-open modal menu, stacked
  // modal layers block outside-click dismissal). Every leaf action calls this.
  const closeMenu = useCallback(() => setIsOpen(false), []);
  const [renamingFolder, setRenamingFolder] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [deletingPromptId, setDeletingPromptId] = useState<string | null>(null);
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
      closeMenu();
    },
    [composerRuntime, closeMenu]
  );

  // Host-configured suggestions mirrored into the dropdown as a virtual
  // read-only folder (see below). Malformed entries are skipped.
  const builtInPrompts = useMemo(
    () => (suggestions ?? []).filter((s) => !!s?.name && !!s?.prompt),
    [suggestions]
  );

  // When the host supplies `onRenamePromptFolder`, it owns the input UI
  // (its own modal) and resolves the new name; the widget renames once the
  // host returns a non-empty name. Otherwise fall back to the built-in dialog.
  const requestRenameFolder = useCallback(
    async (folder: { id: string; name: string }) => {
      closeMenu();
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
    [onRenamePromptFolder, renameFolder, closeMenu]
  );

  // When the host supplies `onDeletePromptFolder`, it owns the confirmation
  // UI (its own modal) and resolves whether to proceed; the widget deletes
  // once the host returns `true`. Otherwise fall back to the built-in dialog.
  const requestDeleteFolder = useCallback(
    async (folder: { id: string; name: string }) => {
      closeMenu();
      if (!onDeletePromptFolder) {
        setDeletingFolderId(folder.id);
        return;
      }
      try {
        const confirmed = await onDeletePromptFolder(folder.name, folder.id);
        if (confirmed !== true) return;
        removeFolder(folder.id);
      } catch (err) {
        logger.error("onDeletePromptFolder handler failed:", err);
      }
    },
    [onDeletePromptFolder, removeFolder, closeMenu]
  );

  // Same split for deleting a single prompt: with `onDeletePrompt` the host
  // owns the confirmation UI and resolves whether to proceed; without it the
  // built-in dialog asks. Either way the widget performs the deletion — it is
  // never done straight from the menu item.
  const requestDeletePrompt = useCallback(
    async (prompt: { id: string; name: string }) => {
      closeMenu();
      if (!onDeletePrompt) {
        setDeletingPromptId(prompt.id);
        return;
      }
      try {
        const confirmed = await onDeletePrompt(prompt.name, prompt.id);
        if (confirmed !== true) return;
        removePrompt(prompt.id);
      } catch (err) {
        logger.error("onDeletePrompt handler failed:", err);
      }
    },
    [onDeletePrompt, removePrompt, closeMenu]
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
      closeMenu();
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
    [onEditPrompt, editPrompt, folders, closeMenu]
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
                onClick: () => {
                  closeMenu();
                  editPrompt(prompt.id, { folderId: null });
                },
              },
            ]
          : []),
        ...folders
          .filter((f) => f.id !== prompt.folderId)
          .map((folder) => ({
            text: folder.name,
            withTruncateTooltip: true,
            onClick: () => {
              closeMenu();
              editPrompt(prompt.id, { folderId: folder.id });
            },
          })),
      ];

      return [
        {
          id: `edit:${prompt.id}`,
          text: t("EditAIPrompt"),
          onClick: () => {
            void requestEditPrompt(prompt);
          },
        },
        ...(moveToFolderItems.length > 0
          ? [
              {
                id: `move:${prompt.id}`,
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
          id: `delete:${prompt.id}`,
          text: t("Delete"),
          onClick: () => {
            void requestDeletePrompt(prompt);
          },
        },
      ];
    },
    [
      t,
      folders,
      editPrompt,
      requestEditPrompt,
      requestDeletePrompt,
      closeMenu,
    ]
  );

  const items = useMemo(() => {
    const result: DropDownItemProps[] = [];

    const rootPrompts = prompts.filter((p) => !p.folderId);
    for (const prompt of rootPrompts) {
      result.push({
        id: `prompt:${prompt.id}`,
        text: prompt.name,
        withTruncateTooltip: true,
        onClick: () => applyPrompt(prompt.text),
        subMenu: buildPromptContextMenu(prompt),
        subMenuIcon: "more",
        subMenuIconSize: 24,
      });
    }

    if (
      rootPrompts.length > 0 &&
      (folders.length > 0 || builtInPrompts.length > 0)
    ) {
      result.push({
        text: "",
        isSeparator: true,
        onClick: () => undefined,
      });
    }

    for (const folder of folders) {
      const folderPrompts = prompts.filter((p) => p.folderId === folder.id);
      result.push({
        id: `folder:${folder.id}`,
        text: folder.name,
        withTruncateTooltip: true,
        onClick: () => undefined,
        subMenu: [
          ...folderPrompts.map((prompt) => ({
            id: `prompt:${prompt.id}`,
            text: prompt.name,
            withTruncateTooltip: true,
            onClick: () => applyPrompt(prompt.text),
            subMenu: buildPromptContextMenu(prompt),
            subMenuIcon: "more",
            subMenuIconSize: 24,
          })),
          ...(folderPrompts.length > 0
            ? [{ text: "", isSeparator: true, onClick: () => undefined }]
            : []),
          {
            id: `rename-folder:${folder.id}`,
            text: t("RenameFolder"),
            icon: "btn-rename",
            onClick: () => requestRenameFolder(folder),
          },
          {
            id: `delete-folder:${folder.id}`,
            text: t("DeleteFolder"),
            icon: "btn-remove",
            onClick: () => requestDeleteFolder(folder),
          },
        ],
      });
    }

    // Host-configured suggestions surface as a virtual folder with the
    // fixed name "built-in-prompts". Everything inside is read-only by
    // construction: the rows only insert their prompt text — no per-row
    // context menu (edit / move / delete), and the folder itself has no
    // rename/delete entries. None of it exists in `storage.prompts`, so
    // regular prompts can't be moved into it either.
    if (builtInPrompts.length > 0) {
      result.push({
        id: `folder:${BUILT_IN_PROMPTS_FOLDER}`,
        text: BUILT_IN_PROMPTS_FOLDER,
        onClick: () => undefined,
        subMenu: builtInPrompts.map((s) => ({
          text: s.name,
          withTruncateTooltip: true,
          onClick: () => applyPrompt(s.prompt),
        })),
      });
    }

    return result;
  }, [
    prompts,
    folders,
    builtInPrompts,
    applyPrompt,
    buildPromptContextMenu,
    requestRenameFolder,
    requestDeleteFolder,
    t,
  ]);

  if (
    prompts.length === 0 &&
    folders.length === 0 &&
    builtInPrompts.length === 0
  )
    return null;

  return (
    <>
      <DropdownMenu
        trigger={trigger}
        items={items}
        open={isOpen}
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
      {deletingPromptId ? (
        <DeletePromptDialog
          promptId={deletingPromptId}
          onClose={() => setDeletingPromptId(null)}
        />
      ) : null}
    </>
  );
};

export { ComposerActionPrompts };
