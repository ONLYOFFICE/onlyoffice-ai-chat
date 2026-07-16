import React from "react";
import { useStores } from "../../store/context";

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

const readFile = (file: File, as: "dataURL" | "text"): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    if (as === "dataURL") reader.readAsDataURL(file);
    else reader.readAsText(file);
  });

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

  const [isDragOver, setIsDragOver] = React.useState(false);
  // dragenter/dragleave fire for every nested element, so track depth and
  // only clear the highlight once we leave the outermost zone.
  const dragDepthRef = React.useRef(0);

  const hasDraggedFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes("Files");

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

    // Drop 0-byte files — an empty image yields a payload-less data URL
    // that vision providers reject, and an empty text file adds nothing.
    const files = Array.from(e.dataTransfer.files).filter((f) => f.size > 0);
    // Read every dropped file in parallel, then hand each batch to the
    // store in one call. Per-file failures collapse to `null` so a single
    // unreadable file can't sink the whole drop.
    // Unsupported binary formats (e.g. .docx, .pdf) are ignored here —
    // the attach-button flow handles those via the platform adapter.
    const imageReads = files
      .filter((f) => f.type.startsWith("image/"))
      .map(async (f) => {
        try {
          return { name: f.name, base64: await readFile(f, "dataURL") };
        } catch {
          return null;
        }
      });
    const textReads = files
      .filter((f) => !f.type.startsWith("image/") && isTextFile(f))
      .map(async (f) => {
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

    const [imageInputs, fileInputs] = await Promise.all([
      Promise.all(imageReads).then((r) => r.filter((x) => x !== null)),
      Promise.all(textReads).then((r) => r.filter((x) => x !== null)),
    ]);

    const work: Promise<unknown>[] = [];
    if (imageInputs.length > 0) work.push(addAttachmentImage(imageInputs));
    if (fileInputs.length > 0) work.push(addAttachmentFile(fileInputs));
    await Promise.all(work);
  };

  return {
    isDragOver,
    handlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
};
