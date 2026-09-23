// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";

const mockUseStores = vi.fn();

vi.mock("../../../store/context", () => ({
  useStores: () => mockUseStores(),
}));

import { useChatPasteAttachments } from "../useChatPasteAttachments";

const setupStores = (overrides?: {
  addAttachmentImage?: (i: unknown) => void;
  beginPendingAttachments?: (inputs: unknown[]) => string[];
  failPendingAttachments?: (ids: string[]) => void;
}) => {
  mockUseStores.mockReturnValue({
    useAttachmentsStore: (selector?: (s: unknown) => unknown) => {
      const state = {
        addAttachmentImage: overrides?.addAttachmentImage ?? vi.fn(),
        // Reserve one pending id per input, aligned with the input order —
        // the hook slices its reads to `ids.length`, so a stub returning
        // fewer would silently drop images.
        beginPendingAttachments:
          overrides?.beginPendingAttachments ??
          ((inputs: unknown[]) => inputs.map((_, i) => `pending-${i}`)),
        failPendingAttachments: overrides?.failPendingAttachments ?? vi.fn(),
      };
      return typeof selector === "function" ? selector(state) : state;
    },
  });
};

const makeFile = (name: string, type: string, body: string): File =>
  new File([body], name, { type });

/**
 * A clipboard payload. `items` is what the hook reads images from; `text`
 * is what `getData("text/plain")` returns.
 */
const makeClipboard = (files: File[], text = ""): DataTransfer =>
  ({
    items: files.map((file) => ({
      kind: "file",
      type: file.type,
      getAsFile: () => file,
    })),
    files,
    getData: (format: string) => (format === "text/plain" ? text : ""),
  }) as unknown as DataTransfer;

const Harness = () => {
  const { onPaste } = useChatPasteAttachments();
  return (
    <textarea
      data-testid="input"
      onPaste={(e) => {
        void onPaste(e);
      }}
    />
  );
};

describe("useChatPasteAttachments", () => {
  it("reads a pasted image as base64 and adds it", async () => {
    const addAttachmentImage = vi.fn();
    setupStores({ addAttachmentImage });
    const { getByTestId } = render(<Harness />);

    await act(async () => {
      fireEvent.paste(getByTestId("input"), {
        clipboardData: makeClipboard([
          makeFile("shot.png", "image/png", "pngdata"),
        ]),
      });
    });

    await waitFor(() => {
      expect(addAttachmentImage).toHaveBeenCalledTimes(1);
    });
    const batch = addAttachmentImage.mock.calls[0][0];
    expect(batch).toHaveLength(1);
    expect(batch[0].name).toBe("shot.png");
    expect(batch[0].base64.startsWith("data:image/png")).toBe(true);
  });

  it("adds every image of a multi-image paste in one batch", async () => {
    const addAttachmentImage = vi.fn();
    setupStores({ addAttachmentImage });
    const { getByTestId } = render(<Harness />);

    await act(async () => {
      fireEvent.paste(getByTestId("input"), {
        clipboardData: makeClipboard([
          makeFile("a.png", "image/png", "a"),
          makeFile("b.jpg", "image/jpeg", "b"),
        ]),
      });
    });

    await waitFor(() => {
      expect(addAttachmentImage).toHaveBeenCalledTimes(1);
    });
    expect(addAttachmentImage.mock.calls[0][0]).toHaveLength(2);
  });

  it("ignores a text-only paste", async () => {
    const addAttachmentImage = vi.fn();
    const beginPendingAttachments = vi.fn(() => []);
    setupStores({ addAttachmentImage, beginPendingAttachments });
    const { getByTestId } = render(<Harness />);

    await act(async () => {
      fireEvent.paste(getByTestId("input"), {
        clipboardData: makeClipboard([], "hello"),
      });
    });

    expect(addAttachmentImage).not.toHaveBeenCalled();
    // No chip is reserved either — a plain text paste must not flash one.
    expect(beginPendingAttachments).not.toHaveBeenCalled();
  });

  it("ignores non-image files on the clipboard", async () => {
    const addAttachmentImage = vi.fn();
    setupStores({ addAttachmentImage });
    const { getByTestId } = render(<Harness />);

    await act(async () => {
      fireEvent.paste(getByTestId("input"), {
        clipboardData: makeClipboard([
          makeFile("notes.txt", "text/plain", "hi"),
        ]),
      });
    });

    expect(addAttachmentImage).not.toHaveBeenCalled();
  });

  it("skips 0-byte images", async () => {
    const addAttachmentImage = vi.fn();
    setupStores({ addAttachmentImage });
    const { getByTestId } = render(<Harness />);

    await act(async () => {
      fireEvent.paste(getByTestId("input"), {
        clipboardData: makeClipboard([makeFile("empty.png", "image/png", "")]),
      });
    });

    expect(addAttachmentImage).not.toHaveBeenCalled();
  });

  it("keeps the default paste when the clipboard also carries text", async () => {
    const addAttachmentImage = vi.fn();
    setupStores({ addAttachmentImage });
    const { getByTestId } = render(<Harness />);

    // A rich copy (e.g. a spreadsheet chart) offers both an image and a
    // text fallback: attach the image, and still let the text land.
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: makeClipboard(
        [makeFile("chart.png", "image/png", "pngdata")],
        "A1\tB1"
      ),
    });

    await act(async () => {
      fireEvent(getByTestId("input"), event);
    });

    await waitFor(() => {
      expect(addAttachmentImage).toHaveBeenCalledTimes(1);
    });
    expect(event.defaultPrevented).toBe(false);
  });

  it("cancels the default paste when the clipboard is image-only", async () => {
    setupStores();
    const { getByTestId } = render(<Harness />);

    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: makeClipboard([makeFile("shot.png", "image/png", "pngdata")]),
    });

    await act(async () => {
      fireEvent(getByTestId("input"), event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it("releases the lease of an image that fails to read", async () => {
    const addAttachmentImage = vi.fn();
    const failPendingAttachments = vi.fn();
    setupStores({ addAttachmentImage, failPendingAttachments });

    // Fail the first read, let the second through, so the surviving
    // image must still line up with its own lease id.
    const realFileReader = globalThis.FileReader;
    let call = 0;
    class FailingFirstReader extends realFileReader {
      override readAsDataURL(blob: Blob) {
        if (call++ === 0) {
          setTimeout(() =>
            this.onerror?.(
              new ProgressEvent("error") as ProgressEvent<FileReader>
            )
          );
          return;
        }
        super.readAsDataURL(blob);
      }
    }
    globalThis.FileReader = FailingFirstReader as typeof FileReader;

    try {
      const { getByTestId } = render(<Harness />);
      await act(async () => {
        fireEvent.paste(getByTestId("input"), {
          clipboardData: makeClipboard([
            makeFile("bad.png", "image/png", "x"),
            makeFile("good.png", "image/png", "y"),
          ]),
        });
      });

      await waitFor(() => {
        expect(addAttachmentImage).toHaveBeenCalledTimes(1);
      });
      expect(failPendingAttachments).toHaveBeenCalledWith(["pending-0"]);
      const [batch, options] = addAttachmentImage.mock.calls[0];
      expect(batch).toHaveLength(1);
      expect(batch[0].name).toBe("good.png");
      expect(options.pendingIds).toEqual(["pending-1"]);
    } finally {
      globalThis.FileReader = realFileReader;
    }
  });

  it("attaches only as many images as the store's cap accepts", async () => {
    const addAttachmentImage = vi.fn();
    // Cap of one: the reservation returns a single id for two images.
    setupStores({
      addAttachmentImage,
      beginPendingAttachments: () => ["pending-0"],
    });
    const { getByTestId } = render(<Harness />);

    await act(async () => {
      fireEvent.paste(getByTestId("input"), {
        clipboardData: makeClipboard([
          makeFile("a.png", "image/png", "a"),
          makeFile("b.png", "image/png", "b"),
        ]),
      });
    });

    await waitFor(() => {
      expect(addAttachmentImage).toHaveBeenCalledTimes(1);
    });
    const [batch] = addAttachmentImage.mock.calls[0];
    expect(batch).toHaveLength(1);
    expect(batch[0].name).toBe("a.png");
  });
});
