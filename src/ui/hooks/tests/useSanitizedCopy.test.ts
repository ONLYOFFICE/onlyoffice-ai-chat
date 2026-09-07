// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { ClipboardEvent } from "react";

vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
}));

import { useSanitizedCopy } from "../useSanitizedCopy";

/**
 * jsdom carries no selection serializer of its own worth relying on, so the
 * ranges are built over a real DOM tree mounted into the document.
 */
const mount = (html: string) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
};

const selectContents = (node: Node) => {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

const makeEvent = () => {
  const store = new Map<string, string>();
  const preventDefault = vi.fn();
  const event = {
    clipboardData: {
      setData: (type: string, value: string) => store.set(type, value),
      getData: (type: string) => store.get(type) ?? "",
    },
    preventDefault,
  } as unknown as ClipboardEvent<HTMLElement>;
  return { event, store, preventDefault };
};

describe("useSanitizedCopy", () => {
  it("strips presentational attributes from the copied html", () => {
    const host = mount(
      '<div class="bg-[var(--x)]" style="background-color: rgba(0,0,0,0.08)">' +
        '<p style="color: rgb(255,255,255)" class="text-[var(--y)]">hi</p>' +
        "</div>"
    );
    selectContents(host);

    const onCopy = useSanitizedCopy();
    const { event, store, preventDefault } = makeEvent();
    onCopy(event);

    const html = store.get("text/html") ?? "";
    expect(html).not.toContain("style=");
    expect(html).not.toContain("class=");
    expect(html).toContain("hi");
    expect(preventDefault).toHaveBeenCalled();

    host.remove();
  });

  it("keeps the markup structure and the plain text", () => {
    const host = mount(
      '<div style="background: #000"><ul><li><strong>a</strong></li>' +
        "<li>b</li></ul></div>"
    );
    selectContents(host);

    const onCopy = useSanitizedCopy();
    const { event, store } = makeEvent();
    onCopy(event);

    const html = store.get("text/html") ?? "";
    expect(html).toContain("<ul>");
    expect(html).toContain("<strong>a</strong>");
    expect(store.get("text/plain")).toBe(window.getSelection()?.toString());

    host.remove();
  });

  it("leaves the native copy alone when nothing is selected", () => {
    window.getSelection()?.removeAllRanges();

    const onCopy = useSanitizedCopy();
    const { event, store, preventDefault } = makeEvent();
    onCopy(event);

    expect(store.size).toBe(0);
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
