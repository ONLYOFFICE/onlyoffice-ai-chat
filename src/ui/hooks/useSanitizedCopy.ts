import { useCallback } from "react";
import type { ClipboardEvent } from "react";

/**
 * Presentational attributes that carry the widget's own look.
 *
 * Blink builds the clipboard's `text/html` by inlining the *computed* style of
 * every copied element — our Tailwind classes mean nothing outside the widget,
 * so the serializer annotates the markup instead. A message bubble therefore
 * reaches the paste target as `background-color: rgba(0, 0, 0, 0.08); color:
 * rgb(51, 51, 51)`, and the target applies it: the user copied text and pasted
 * text plus the chat's chrome. Re-serializing the selection ourselves without
 * these attributes keeps the markup (lists, emphasis, code) and drops the look.
 */
const PRESENTATION_ATTRIBUTES = [
  "style",
  "class",
  "bgcolor",
  "background",
  "color",
];

/** Nodes that are noise once the fragment leaves the widget. */
const DROPPED_SELECTORS = "style, script, link, template";

function stripPresentation(root: HTMLElement): void {
  root.querySelectorAll(DROPPED_SELECTORS).forEach((node) => {
    node.remove();
  });
  root.querySelectorAll("*").forEach((node) => {
    for (const attr of PRESENTATION_ATTRIBUTES) node.removeAttribute(attr);
  });
}

/**
 * `onCopy` handler for a native Ctrl+C over chat content: `text/plain` stays
 * the selected text, while `text/html` is rebuilt from the selection with every
 * presentational attribute removed.
 *
 * Attach it to the chat root so it covers user messages, assistant replies and
 * tool cards alike — the assistant message has no fill of its own, but its text
 * colour is inlined the same way and pastes white-on-white out of a dark theme.
 * The in-widget copy buttons don't need it: they already write plain text.
 */
export function useSanitizedCopy() {
  return useCallback((event: ClipboardEvent<HTMLElement>) => {
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const text = selection.toString();
    if (!text) return;

    const container = document.createElement("div");
    // Firefox is the only engine that reports more than one range; appending
    // them all costs nothing and matches what `toString()` returned above.
    for (let i = 0; i < selection.rangeCount; i += 1) {
      container.appendChild(selection.getRangeAt(i).cloneContents());
    }
    stripPresentation(container);

    clipboard.setData("text/plain", text);
    clipboard.setData("text/html", container.innerHTML);
    event.preventDefault();
  }, []);
}

export default useSanitizedCopy;
