import { useEffect, useState } from "react";
import { usePlatform } from "../../providers/PlatformProvider/context";
import { useI18n } from "../../providers/LocalesProvider";
import { cn, getFileIconName } from "../../../shared/utils";
import { chipClassName } from "./chip";
import { useStores } from "../../store/context";
import { selectImageBase64 } from "../../store/create-attachments-store";
import type { TAttachmentFile, TAttachmentRef } from "../../../types";
import { Icon } from "../icon";
import { IconButton } from "../icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";

/**
 * `FileItem` accepts either a {@link TAttachmentRef} (composer draft —
 * id-only, image base64 fetched lazily from `attachments` service) or
 * the legacy {@link TAttachmentFile} (used by historical message
 * bubbles where the inline `{path, type, content}` form persists).
 */
type FileItemProps = {
  file: TAttachmentRef | TAttachmentFile;
  withoutClose?: boolean;
};

const isRef = (
  file: TAttachmentRef | TAttachmentFile
): file is TAttachmentRef => "id" in file && "kind" in file;

const FileItem = ({ file, withoutClose }: FileItemProps) => {
  const { isRTL } = useI18n();
  const platform = usePlatform();
  const { useAttachmentsStore, api } = useStores();
  const deleteAttachmentFile = useAttachmentsStore(
    (s) => s.deleteAttachmentFile
  );
  const deleteAttachmentImage = useAttachmentsStore(
    (s) => s.deleteAttachmentImage
  );

  const ref = isRef(file) ? file : null;
  const legacy = ref ? null : (file as TAttachmentFile);
  const isImage = ref ? ref.kind === "image" : false;
  const filePath: string = ref ? (ref.path ?? "") : (legacy?.path ?? "");
  const fileType: number = ref ? (ref.type ?? 0) : (legacy?.type ?? 0);
  const title = ref
    ? ref.title
    : filePath.includes("\\")
      ? (filePath.split("\\").pop() ?? "")
      : (filePath.split("/").pop() ?? "");
  const extension = title.split(".").pop() ?? "";
  const nameWithoutExtension = title.replace(`.${extension}`, "");
  const iconName = getFileIconName(fileType);

  // Composer draft holds only the ref; base64 either lives in the
  // session cache (just-uploaded — no round trip needed) or in
  // `storage.attachments` (history reload). Subscribe to the cache so
  // newly added images render synchronously.
  const cachedBase64 = useAttachmentsStore(
    selectImageBase64(ref?.kind === "image" ? ref.id : undefined)
  );
  const [fetchedSrc, setFetchedSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!ref || ref.kind !== "image") return;
    if (cachedBase64) return; // cache hit — skip fetch
    let cancelled = false;
    api.attachments.get(ref.id).then((rec) => {
      if (cancelled) return;
      setFetchedSrc(rec?.base64 ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [api, ref, cachedBase64]);
  const imageSrc = cachedBase64 ?? fetchedSrc;

  const handleDelete = () => {
    if (ref) {
      if (ref.kind === "file") deleteAttachmentFile(ref.id);
      else deleteAttachmentImage(ref.id);
      return;
    }
    // Legacy inline shape — historical messages don't render in places
    // that show a close button, so this branch is effectively unused.
  };

  const chip = (
    <div
      className={chipClassName({ isImage, withoutClose, isRTL })}
      onClick={() => {
        if (!withoutClose) return;
        if (!filePath) return;
        platform.file?.openFile?.(filePath, title);
      }}
    >
      {isImage ? (
        imageSrc ? (
          <img
            className={cn(
              "w-[36px] h-[36px] shrink-0",
              isRTL ? "rounded-r-[8px]" : "rounded-l-[8px]"
            )}
            src={imageSrc}
            alt=""
          />
        ) : (
          <div
            className={cn(
              "w-[36px] h-[36px] shrink-0 bg-[var(--background-tertiary)]",
              isRTL ? "rounded-r-[8px]" : "rounded-l-[8px]"
            )}
          />
        )
      ) : (
        <div className="flex flex-row items-center h-[24px] gap-[4px] min-w-0">
          <Icon name={iconName} size={24} noColor className="shrink-0" />
          <p className="text-[var(--file-items-color)] font-normal whitespace-nowrap overflow-hidden text-ellipsis">
            {nameWithoutExtension}
            <span className="text-[var(--file-items-ext-color)]">
              .{extension}
            </span>
          </p>
        </div>
      )}

      {!withoutClose ? (
        <IconButton
          iconName="btn-close.small"
          size={16}
          onClick={handleDelete}
        />
      ) : null}
    </div>
  );

  // The chip truncates its name to fit the row (and an image chip shows no
  // name at all), so the full title is only ever available on hover.
  // `asChild` keeps the chip itself as the trigger — an extra wrapper node
  // would become the row's flex item and undo the chip's own sizing.
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent
        className="max-w-[var(--file-item-tooltip-max-width,280px)] break-words"
        side="top"
        align="start"
      >
        {title}
      </TooltipContent>
    </Tooltip>
  );
};

export { FileItem };
