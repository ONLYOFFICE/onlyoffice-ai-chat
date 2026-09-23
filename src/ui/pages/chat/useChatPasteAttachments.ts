import React from "react";
import { useStores } from "../../store/context";
import { partitionReads, readFile } from "./attachment-reads";

/**
 * Clipboard-paste handler for attaching images to the chat.
 *
 * Mount the returned `onPaste` on the composer input. Image items on the
 * clipboard go through `readAsDataURL` → `addAttachmentImage`, mirroring
 * the drop path in `useChatDropAttachments`.
 *
 * Text is deliberately left alone: a paste that carries *both* an image
 * and text (copying a chart out of a spreadsheet yields `image/png` plus
 * a `text/plain` fallback) attaches the image and still lets the text
 * land in the textarea. Only an image-only paste cancels the default,
 * where there is nothing to insert anyway.
 */
export const useChatPasteAttachments = () => {
  const { useAttachmentsStore } = useStores();
  const addAttachmentImage = useAttachmentsStore((s) => s.addAttachmentImage);
  const beginPendingAttachments = useAttachmentsStore(
    (s) => s.beginPendingAttachments
  );
  const failPendingAttachments = useAttachmentsStore(
    (s) => s.failPendingAttachments
  );

  const onPaste = async (e: React.ClipboardEvent) => {
    const clipboard = e.clipboardData;
    if (!clipboard) return;

    // `items` describes what the clipboard *offers*; `getAsFile` is the
    // only way to reach a screenshot, which exists as a synthetic item
    // with no entry in `clipboard.files` on some browsers.
    const imageFiles = Array.from(clipboard.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      // Drop 0-byte images — an empty payload yields a data URL that
      // vision providers reject.
      .filter((file): file is File => !!file && file.size > 0);

    if (imageFiles.length === 0) return;

    // A paste carrying plain text as well is a rich copy (chart, cell
    // range, a styled snippet): attach the image and let the text insert
    // itself as usual. With no text on the clipboard the default paste
    // has nothing to do, so suppress it rather than let the browser
    // decide what a lone image means inside a textarea.
    const hasText = clipboard.getData("text/plain") !== "";
    if (!hasText) e.preventDefault();

    // Reserve loading chips before the reads — a pasted screenshot takes
    // a visible moment to base64. The reservation is also the cap check,
    // so slice the files to what it accepted to keep ids aligned.
    const pendingIds = beginPendingAttachments(
      imageFiles.map((file) => ({
        // Screenshots arrive as "image.png" or with no name at all.
        title: file.name || "image.png",
        kind: "image" as const,
      }))
    );
    const accepted = imageFiles.slice(0, pendingIds.length);
    if (accepted.length === 0) return;

    // Per-file failures collapse to `null` so one unreadable image can't
    // sink the whole paste — its lease is dropped in the aligned pass below.
    const results = await Promise.all(
      accepted.map(async (file) => {
        try {
          return {
            name: file.name || "image.png",
            base64: await readFile(file, "dataURL"),
          };
        } catch {
          return null;
        }
      })
    );

    const { inputs, liveIds } = partitionReads(
      results,
      pendingIds,
      failPendingAttachments
    );
    // On throw the store fails the leases itself before re-throwing.
    if (inputs.length > 0) {
      await addAttachmentImage(inputs, { pendingIds: liveIds });
    }
  };

  return { onPaste };
};
