import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { usePlatform } from "../../../providers/PlatformProvider/context";
import { useComponents } from "../../../providers/ComponentsProvider";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";
import { useToolsContext } from "../../../tools/context";
import { getFileIconName, isSpreadsheet } from "../../../../shared/utils";
import {
  ATTACHMENT_PICK_FILTERS,
  isSupportedAttachmentPath,
} from "../../../../shared/attachment-formats";
import { useStores } from "../../../store/context";
import { useWidgetConfig } from "../../../../widget-config";
import logger from "../../../../shared/logger";

// The engine resolves the web-search tools on the fly per-request, so they
// never appear in the UI's `servers` aggregator — the composer toggle has
// to flip them through `disabledTools["web-search"]` directly.
const WEB_SEARCH_TYPE = "web-search";
const WEB_SEARCH_TOOL_NAMES = ["web_search", "web_crawling"];

// The host payload is only as trustworthy as the host: the desktop
// `recent_files_reader` omits `url` entirely, and an entry without a usable
// `path` would render as a nameless item that attaches nothing.
type TRecentEntry = { path?: string; type?: number; url?: string };

const hasPath = (
  entry: TRecentEntry
): entry is TRecentEntry & { path: string } =>
  typeof entry.path === "string" && entry.path !== "";

const ComposerActionAttachment = () => {
  const { DropdownMenu, IconButton, TooltipIconButton } = useComponents();
  const [isOpen, setIsOpen] = React.useState(false);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const platform = usePlatform();
  const { eventBus } = useToolsContext();
  const { useAttachmentsStore, useServersStore } = useStores();

  const addAttachmentFile = useAttachmentsStore((s) => s.addAttachmentFile);
  const addAttachmentImage = useAttachmentsStore((s) => s.addAttachmentImage);
  const beginPendingAttachments = useAttachmentsStore(
    (s) => s.beginPendingAttachments
  );
  const failPendingAttachments = useAttachmentsStore(
    (s) => s.failPendingAttachments
  );
  const changeToolStatus = useServersStore((s) => s.changeToolStatus);
  const webSearchEnabled = useServersStore((s) => s.webSearchEnabled);
  const disabledTools = useServersStore((s) => s.disabledTools);

  const webSearchDisabledNames = disabledTools[WEB_SEARCH_TYPE] ?? [];
  const webSearchActive =
    webSearchEnabled &&
    WEB_SEARCH_TOOL_NAMES.some((n) => !webSearchDisabledNames.includes(n));
  const { composerActions, addLocalImageEnabled, attachFilesByPath } =
    useWidgetConfig();

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const selectRecentFile = React.useCallback(
    async (path: string, type: number) => {
      // Path only: reading the file is left to the model, through a tool
      // the host registers (see `WidgetConfig.attachFilesByPath`).
      if (attachFilesByPath) {
        try {
          await addAttachmentFile({ path, type });
        } catch (err) {
          logger.error("[ComposerActionAttachment] attach failed", err);
        }
        return;
      }
      if (!platform.file?.convertFileToText) return;
      // Reserve the loading chip before the conversion — on desktop the
      // convert is the slow part, and the whole point is instant feedback.
      const [pendingId] = beginPendingAttachments([
        { title: path.split(/[\\/]/).pop() ?? path, kind: "file", type },
      ]);
      if (!pendingId) return; // cap reached
      try {
        const isSpreadsheetFile = isSpreadsheet(type);
        const content = await platform.file.convertFileToText(
          path,
          isSpreadsheetFile ? 260 : 69
        );
        await addAttachmentFile(
          { path, content, type },
          { pendingIds: [pendingId] }
        );
      } catch (err) {
        failPendingAttachments([pendingId]);
        throw err;
      }
    },
    [
      attachFilesByPath,
      platform.file,
      addAttachmentFile,
      beginPendingAttachments,
      failPendingAttachments,
    ]
  );

  const selectLocalFile = async () => {
    if (!platform.file?.pickFiles) return;
    const picked = await platform.file.pickFiles(ATTACHMENT_PICK_FILTERS);
    if (!picked) return;
    const fileApi = platform.file;

    // The filter argument is a hint: a host predating it ignores it, and even
    // a host that honours it lets the user type a name by hand. Drop anything
    // we can't convert here, before a chip is reserved — attaching it would
    // produce an empty-content attachment that looks like it worked.
    const files = picked.filter((file) => {
      if (isSupportedAttachmentPath(file.path)) return true;
      logger.warn(
        "[ComposerActionAttachment] skipping unsupported file",
        file.path
      );
      return false;
    });
    if (files.length === 0) return;

    // Path only — see selectRecentFile. The store reserves the loading
    // chips and applies the 5-item cap itself.
    if (attachFilesByPath) {
      try {
        await addAttachmentFile(
          files.map((file) => ({
            path: file.path,
            type: fileApi.getFileType?.(file.path) ?? 0,
          }))
        );
      } catch (err) {
        logger.error("[ComposerActionAttachment] attach failed", err);
      }
      return;
    }

    // Reserve loading chips first: the reservation is the cap check
    // (replacing the old hardcoded slice-to-5), so we never pay for a
    // convert the store would drop, and the chips appear before the
    // conversion — the slow part on desktop. Ids and files stay aligned
    // by building both from the same accepted slice.
    const pendingIds = beginPendingAttachments(
      files.map((file) => ({
        title: file.path.split(/[\\/]/).pop() ?? file.path,
        kind: "file" as const,
        type: fileApi.getFileType?.(file.path) ?? 0,
      }))
    );
    const accepted = files.slice(0, pendingIds.length);
    if (accepted.length === 0) return;

    try {
      // Convert every picked file in parallel, then push the whole batch
      // to the store in one call.
      const inputs = await Promise.all(
        accepted.map(async (file) => {
          const type = fileApi.getFileType?.(file.path) ?? 0;
          const isSpreadsheetFile = isSpreadsheet(type);
          const content =
            (await fileApi.convertFileToText?.(
              file.path,
              isSpreadsheetFile ? 260 : 69
            )) ?? "";
          return { path: file.path, content: content || "", type };
        })
      );
      await addAttachmentFile(inputs, { pendingIds });
    } catch (err) {
      failPendingAttachments(pendingIds);
      throw err;
    }
  };

  const [recentFiles, setRecentFiles] = React.useState<DropDownItemProps[]>([]);
  // Ticket for the in-flight read. Hosts signal in bursts, so reads overlap;
  // only the newest one may write, or a slow earlier answer would land on top
  // of a fresher list.
  const readTicketRef = React.useRef(0);

  const loadRecentFiles = React.useCallback(() => {
    if (!platform.file?.getRecentFiles) return;
    const ticket = ++readTicketRef.current;

    platform.file
      .getRecentFiles()
      .then((raw) => {
        if (ticket !== readTicketRef.current) return;
        try {
          const parsed = JSON.parse(raw) as { files?: TRecentEntry[] };
          const items = (parsed?.files ?? [])
            .filter((file) => !file.url)
            .filter(hasPath)
            .map((file) => {
              const type = file.type ?? 0;
              const iconName = getFileIconName(type);
              return {
                text: file.path.includes("\\")
                  ? (file.path.split("\\").pop() ?? "")
                  : (file.path.split("/").pop() ?? ""),
                key: file.path,
                id: file.path,
                "data-testid": "attachment-menu-recent-file",
                icon: (
                  <IconButton
                    iconName={iconName}
                    size={24}
                    disableHover
                    noColor
                  />
                ),
                onClick: () => selectRecentFile(file.path, type),
              };
            });
          setRecentFiles(items);
        } catch {
          setRecentFiles([]);
        }
      })
      .catch((err: unknown) => {
        // A failed call says nothing about the list, so keep the one we have
        // instead of blanking the submenu.
        logger.error("[ComposerActionAttachment] getRecentFiles failed", err);
      });
  }, [platform.file, selectRecentFile, IconButton]);

  React.useEffect(() => {
    loadRecentFiles();
  }, [loadRecentFiles]);

  // Without a host signal the mount read is the only one: in a desktop plugin
  // the composer stays mounted for the whole app session, so the submenu would
  // show the startup snapshot forever.
  React.useLayoutEffect(() => {
    const unsubscribe = platform.file?.onRecentFilesChange?.(loadRecentFiles);

    return () => {
      // The host owns the return value — don't assume it handed back a function.
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [platform.file, loadRecentFiles]);

  const { t } = useI18n();

  const trigger = (
    <TooltipIconButton tooltip={t("Attachments")} visible={!isOpen}>
      <IconButton
        iconName="btn-attach.small"
        size={20}
        isStroke
        className="cursor-pointer rounded-[4px] outline-none text-[var(--attachment-button-color,var(--icon-button-color))] hover:enabled:text-[var(--attachment-button-hover-color,var(--text-normal))]"
        isActive={isOpen}
        data-testid="attachment-button"
      />
    </TooltipIconButton>
  );

  const items: DropDownItemProps[] = [];

  // Gate each entry on its specific capability instead of the whole
  // `file` object, so a host can expose e.g. only image upload / export.
  if (platform.file?.pickFiles) {
    items.push({
      text: t("AddLocalFile"),
      "data-testid": "attachment-menu-add-local-file",
      onClick: () => selectLocalFile(),
    });
  }

  if (addLocalImageEnabled) {
    items.push({
      text: t("AddLocalImage"),
      "data-testid": "attachment-menu-add-local-image",
      onClick: () => imageInputRef.current?.click(),
    });
  }

  if (platform.file?.getRecentFiles && recentFiles.length > 0) {
    items.push({
      text: t("RecentFiles"),
      "data-testid": "attachment-menu-recent-files",
      onClick: () => {
        // ignore
      },
      subMenu: recentFiles,
    });
  }

  if (composerActions && composerActions.length > 0) {
    for (const action of composerActions) {
      items.push({
        id: action.id,
        "data-testid": `attachment-menu-action-${action.id}`,
        text: action.text,
        icon:
          typeof action.icon === "string" ? (
            <IconButton iconName={action.icon} size={24} disableHover />
          ) : (
            action.icon
          ),
        onClick: () => {
          void action.onClick();
        },
      });
    }
  }

  if (items.length > 0) {
    items.push({
      text: "",
      onClick: () => {
        // ignore
      },
      isSeparator: true,
    });
  }

  items.push({
    text: t("WebSearch"),
    "data-testid": "attachment-menu-web-search",
    onClick: () => {
      // ignore
    },
    icon: <IconButton iconName="btn-web-search" size={24} disableHover />,
    withToggle: true,
    toggleChecked: webSearchActive,
    toggleDisabled: !webSearchEnabled,
    tooltipText: webSearchEnabled ? "" : t("EnableWebSearch"),
    onToggleChange: async () => {
      if (!webSearchEnabled) return;
      const next = !webSearchActive;
      // Flip both web-search tools in one atomic write — a per-tool
      // Promise.all races and leaves one tool enabled.
      await changeToolStatus(WEB_SEARCH_TYPE, WEB_SEARCH_TOOL_NAMES, next);
      eventBus.emit("tools-changed");
    },
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = input.files;
    if (!files) return;

    // Skip 0-byte files — they produce an empty `data:...;base64,` URL
    // that vision providers reject — *before* reserving, so they never
    // flash a loading chip.
    const candidates = Array.from(files).filter((file) => file.size > 0);
    const pendingIds = beginPendingAttachments(
      candidates.map((file) => ({ title: file.name, kind: "image" as const }))
    );
    const accepted = candidates.slice(0, pendingIds.length);
    input.value = "";
    if (accepted.length === 0) return;

    const results = await Promise.all(
      accepted.map(
        (file) =>
          new Promise<{ name: string; base64: string } | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) =>
              resolve({
                name: file.name,
                base64: event.target?.result as string,
              });
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          })
      )
    );

    // Failed reads drop their lease; survivors keep id/input alignment by
    // being filtered in the same pass.
    const inputs: { name: string; base64: string }[] = [];
    const liveIds: string[] = [];
    const failedIds: string[] = [];
    results.forEach((result, i) => {
      if (result === null) {
        failedIds.push(pendingIds[i]);
      } else {
        inputs.push(result);
        liveIds.push(pendingIds[i]);
      }
    });
    if (failedIds.length > 0) failPendingAttachments(failedIds);
    if (inputs.length > 0) {
      // On throw the store fails the leases itself before re-throwing.
      await addAttachmentImage(inputs, { pendingIds: liveIds });
    }
  };

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageSelect}
        className="hidden"
        data-testid="attachment-image-input"
      />
      <DropdownMenu
        trigger={trigger}
        items={items}
        onOpenChange={onOpenChange}
        data-testid="attachment-menu"
      />
    </>
  );
};

export { ComposerActionAttachment };
