import React from "react";
import { useStores } from "../../store/context";
import { useWidgetConfig } from "../../../widget-config";
import { partitionReads, readFile } from "./attachment-reads";

// Extensions we treat as plain-text when dropped via DND (no host converter).
// Binary Office documents / PDFs are intentionally excluded — those require
// platform.file.convertFileToText and should go through the attach button.
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "log",
  "xml",
  "html",
  "htm",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "env",
  "sh",
  "bash",
  "zsh",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "c",
  "h",
  "cpp",
  "hpp",
  "cc",
  "cs",
  "php",
  "css",
  "scss",
  "sass",
  "less",
  "sql",
]);

const isTextFile = (file: File): boolean => {
  if (file.type.startsWith("text/")) return true;
  if (file.type === "application/json" || file.type === "application/xml") {
    return true;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(ext);
};

const hasDraggedFiles = (e: React.DragEvent) =>
  Array.from(e.dataTransfer.types).includes("Files");

/**
 * Drag-and-drop handlers for attaching files and images to the chat.
 *
 * Mount these on whichever wrapper should act as the drop zone (typically
 * the full chat page) and render the `isDragOver` overlay for visual
 * feedback. Images go through `readAsDataURL` → `addAttachmentImage`,
 * text-based files through `readAsText` → `addAttachmentFile` with
 * `type: 0` (unknown host format). Binary Office/PDF drops are ignored —
 * those still require the platform's `convertFileToText` and should be
 * attached via the composer button.
 */
export const useChatDropAttachments = () => {
  const { useAttachmentsStore } = useStores();
  const addAttachmentFile = useAttachmentsStore((s) => s.addAttachmentFile);
  const addAttachmentImage = useAttachmentsStore((s) => s.addAttachmentImage);
  const beginPendingAttachments = useAttachmentsStore(
    (s) => s.beginPendingAttachments
  );
  const failPendingAttachments = useAttachmentsStore(
    (s) => s.failPendingAttachments
  );
  const { onDropFiles } = useWidgetConfig();

  const [isDragOver, setIsDragOver] = React.useState(false);
  // dragenter/dragleave fire for every nested element, so track depth and
  // only clear the highlight once we leave the outermost zone.
  const dragDepthRef = React.useRef(0);

  const onDragEnter = (e: React.DragEvent) => {
    if (!hasDraggedFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!hasDraggedFiles(e)) return;
    // preventDefault on dragover is required to enable drop.
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (e: React.DragEvent) => {
    if (!hasDraggedFiles(e)) return;
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragOver(false);
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    if (!hasDraggedFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragOver(false);

    // Host override: hand the raw dropped files to the host and skip the
    // built-in read-and-attach path entirely (the host may upload them to
    // its own storage, support binary formats, etc.).
    if (onDropFiles) {
      await onDropFiles(Array.from(e.dataTransfer.files));
      return;
    }

    // Drop 0-byte files — an empty image yields a payload-less data URL
    // that vision providers reject, and an empty text file adds nothing.
    // Unsupported binary formats (e.g. .docx, .pdf) are ignored here —
    // the attach-button flow handles those via the platform adapter.
    const files = Array.from(e.dataTransfer.files).filter((f) => f.size > 0);
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    const textFiles = files.filter(
      (f) => !f.type.startsWith("image/") && isTextFile(f)
    );

    // Reserve loading chips per bucket before the reads — a big dropped
    // image takes a visible moment to base64. Each batch keeps its ids
    // aligned with its files by slicing to what the reservation accepted.
    const imageIds = beginPendingAttachments(
      imageFiles.map((f) => ({ title: f.name, kind: "image" as const }))
    );
    const textIds = beginPendingAttachments(
      textFiles.map((f) => ({ title: f.name, kind: "file" as const, type: 0 }))
    );

    // Read every dropped file in parallel, then hand each batch to the
    // store in one call. Per-file failures collapse to `null` so a single
    // unreadable file can't sink the whole drop — its lease is dropped in
    // the same aligned pass.
    const imageReads = imageFiles.slice(0, imageIds.length).map(async (f) => {
      try {
        return { name: f.name, base64: await readFile(f, "dataURL") };
      } catch {
        return null;
      }
    });
    const textReads = textFiles.slice(0, textIds.length).map(async (f) => {
      try {
        return {
          path: "",
          content: await readFile(f, "text"),
          type: 0,
          title: f.name,
        };
      } catch {
        return null;
      }
    });

    const [imageResults, textResults] = await Promise.all([
      Promise.all(imageReads),
      Promise.all(textReads),
    ]);

    const images = partitionReads(
      imageResults,
      imageIds,
      failPendingAttachments
    );
    const texts = partitionReads(textResults, textIds, failPendingAttachments);

    // On throw the store fails the leases itself before re-throwing.
    const work: Promise<unknown>[] = [];
    if (images.inputs.length > 0) {
      work.push(
        addAttachmentImage(images.inputs, { pendingIds: images.liveIds })
      );
    }
    if (texts.inputs.length > 0) {
      work.push(addAttachmentFile(texts.inputs, { pendingIds: texts.liveIds }));
    }
    await Promise.all(work);
  };

  return {
    isDragOver,
    handlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
};
