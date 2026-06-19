import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { usePlatform } from "../../../providers/PlatformProvider/context";
import { useComponents } from "../../../providers/ComponentsProvider";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";
import { useToolsContext } from "../../../tools/context";
import { getFileIconName, isSpreadsheet } from "../../../../shared/utils";
import { useStores } from "../../../store/context";
import { useWidgetConfig } from "../../../../widget-config";

// Mirrored from `ComposerActionServers.tsx`. The engine resolves these
// on the fly per-request, so they never appear in the UI's `servers`
// aggregator — the composer toggle has to flip them through
// `disabledTools["web-search"]` directly.
const WEB_SEARCH_TYPE = "web-search";
const WEB_SEARCH_TOOL_NAMES = ["web_search", "web_crawling"];

const ComposerActionAttachment = () => {
  const { DropdownMenu, IconButton, TooltipIconButton } = useComponents();
  const [isOpen, setIsOpen] = React.useState(false);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const platform = usePlatform();
  const { eventBus } = useToolsContext();
  const { useAttachmentsStore, useServersStore, useProfilesStore } =
    useStores();

  const addAttachmentFile = useAttachmentsStore((s) => s.addAttachmentFile);
  const addAttachmentImage = useAttachmentsStore((s) => s.addAttachmentImage);
  const changeToolStatus = useServersStore((s) => s.changeToolStatus);
  const webSearchEnabled = useServersStore((s) => s.webSearchEnabled);
  const disabledTools = useServersStore((s) => s.disabledTools);

  const webSearchDisabledNames = disabledTools[WEB_SEARCH_TYPE] ?? [];
  const webSearchActive =
    webSearchEnabled &&
    WEB_SEARCH_TOOL_NAMES.some((n) => !webSearchDisabledNames.includes(n));
  const extendedThinking = useProfilesStore((s) => s.extendedThinking);
  const toggleExtendedThinking = useProfilesStore(
    (s) => s.toggleExtendedThinking
  );
  const { composerActions } = useWidgetConfig();

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const selectRecentFile = React.useCallback(
    async (path: string, type: number) => {
      if (!platform.file?.convertFileToText) return;
      const isSpreadsheetFile = isSpreadsheet(type);
      const content = await platform.file.convertFileToText(
        path,
        isSpreadsheetFile ? 260 : 69
      );
      await addAttachmentFile({ path, content, type });
    },
    [platform.file, addAttachmentFile]
  );

  const selectLocalFile = async () => {
    if (!platform.file?.pickFiles) return;
    const files = await platform.file.pickFiles();
    if (!files) return;
    const fileApi = platform.file;

    // Convert every picked file in parallel, then push the whole batch to
    // the store in one call. Slicing to 5 here mirrors the store-side cap
    // and avoids paying for converts we'd just drop.
    const inputs = await Promise.all(
      files.slice(0, 5).map(async (file) => {
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
    if (inputs.length > 0) await addAttachmentFile(inputs);
  };

  const [recentFiles, setRecentFiles] = React.useState<DropDownItemProps[]>([]);

  React.useEffect(() => {
    if (!platform.file?.getRecentFiles) return;

    platform.file.getRecentFiles().then((raw) => {
      try {
        const parsed = JSON.parse(raw) as {
          files: { path: string; type: number; url: string }[];
        };
        const items = parsed?.files
          ?.filter((file) => !file.url)
          ?.map((file) => {
            const iconName = getFileIconName(file.type);
            return {
              text: file.path.includes("\\")
                ? (file.path.split("\\").pop() ?? "")
                : (file.path.split("/").pop() ?? ""),
              key: file.path,
              id: file.path,
              icon: (
                <IconButton
                  iconName={iconName}
                  size={24}
                  disableHover
                  noColor
                />
              ),
              onClick: () => selectRecentFile(file.path, file.type),
            };
          })
          .filter(Boolean);
        setRecentFiles(items ?? []);
      } catch {
        setRecentFiles([]);
      }
    });
  }, [platform.file, selectRecentFile, IconButton]);

  const { t } = useI18n();

  const trigger = (
    <TooltipIconButton tooltip={t("Attachments")} visible={!isOpen}>
      <IconButton
        iconName="btn-zoomup"
        size={20}
        isStroke
        className="cursor-pointer rounded-[4px] outline-none"
        isActive={isOpen}
        data-testid="attachment-button"
      />
    </TooltipIconButton>
  );

  const items: DropDownItemProps[] = [];

  // Gate each entry on its specific capability instead of the whole
  // `file` object, so a host can expose e.g. only image upload / export.
  if (platform.file?.pickFiles) {
    items.push({ text: t("AddLocalFile"), onClick: () => selectLocalFile() });
  }

  // "Add local image" rides on the HTML <input>, not on `platform.file`,
  // so it is always available.
  items.push({
    text: t("AddLocalImage"),
    onClick: () => imageInputRef.current?.click(),
  });

  if (platform.file?.getRecentFiles && recentFiles.length > 0) {
    items.push({
      text: t("RecentFiles"),
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

  items.push({
    text: t("ExtendedThinking"),
    icon: (
      <IconButton iconName="btn-extended-thinking" size={24} disableHover />
    ),
    onClick: () => {
      // ignore
    },
    withToggle: true,
    toggleChecked: extendedThinking,
    onToggleChange: toggleExtendedThinking,
    withAbout: true,
    aboutContent: (
      <p className="p-[16px] leading-[var(--lh-16)] text-[var(--text-secondary)]">
        {t("ExtendedThinkingDescription")}
      </p>
    ),
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = input.files;
    if (!files) return;

    const inputs = (
      await Promise.all(
        // Skip 0-byte files — they produce an empty `data:...;base64,`
        // URL that vision providers reject.
        Array.from(files)
          .filter((file) => file.size > 0)
          .map(
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
      )
    ).filter((x) => x !== null);

    input.value = "";
    if (inputs.length > 0) await addAttachmentImage(inputs);
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
      />
      <DropdownMenu
        trigger={trigger}
        items={items}
        onOpenChange={onOpenChange}
      />
    </>
  );
};

export { ComposerActionAttachment };
