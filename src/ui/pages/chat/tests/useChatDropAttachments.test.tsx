// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";

const mockUseStores = vi.fn();

vi.mock("../../../store/context", () => ({
  useStores: () => mockUseStores(),
}));

import { useChatDropAttachments } from "../useChatDropAttachments";
import { WidgetConfigProvider } from "../../../../widget-config";

const setupStores = (overrides?: {
  addAttachmentFile?: (f: unknown) => void;
  addAttachmentImage?: (i: unknown) => void;
}) => {
  mockUseStores.mockReturnValue({
    useAttachmentsStore: (selector?: (s: unknown) => unknown) => {
      const state = {
        addAttachmentFile: overrides?.addAttachmentFile ?? vi.fn(),
        addAttachmentImage: overrides?.addAttachmentImage ?? vi.fn(),
        // Reserve one pending id per input, aligned with the input order —
        // the hook slices its reads to `ids.length`, so a stub returning
        // fewer would silently drop files.
        beginPendingAttachments: (inputs: unknown[]) =>
          inputs.map((_, i) => `pending-${i}`),
        failPendingAttachments: vi.fn(),
      };
      return typeof selector === "function" ? selector(state) : state;
    },
  });
};

const makeFile = (name: string, type: string, body: string): File =>
  new File([body], name, { type });

const makeDataTransfer = (files: File[]): DataTransfer =>
  ({
    files,
    types: ["Files"],
    dropEffect: "none",
  }) as unknown as DataTransfer;

// Minimal harness wiring the hook to a test container.
const Harness = () => {
  const { isDragOver, handlers } = useChatDropAttachments();
  return (
    <div data-testid="drop-zone" data-drag-over={isDragOver} {...handlers}>
      zone
    </div>
  );
};

describe("useChatDropAttachments", () => {
  it("reads dropped images as base64 and adds them", async () => {
    const addAttachmentImage = vi.fn();
    setupStores({ addAttachmentImage });
    const { getByTestId } = render(<Harness />);

    const img = makeFile("pic.png", "image/png", "pngdata");
    await act(async () => {
      fireEvent.drop(getByTestId("drop-zone"), {
        dataTransfer: makeDataTransfer([img]),
      });
    });

    await waitFor(() => {
      expect(addAttachmentImage).toHaveBeenCalledTimes(1);
    });
    const batch = addAttachmentImage.mock.calls[0][0];
    expect(batch).toHaveLength(1);
    expect(batch[0].name).toBe("pic.png");
    expect(batch[0].base64.startsWith("data:image/png")).toBe(true);
  });

  it("reads dropped text files and adds them with type 0", async () => {
    const addAttachmentFile = vi.fn();
    setupStores({ addAttachmentFile });
    const { getByTestId } = render(<Harness />);

    const txt = makeFile("notes.md", "text/markdown", "hello world");
    await act(async () => {
      fireEvent.drop(getByTestId("drop-zone"), {
        dataTransfer: makeDataTransfer([txt]),
      });
    });

    await waitFor(() => {
      expect(addAttachmentFile).toHaveBeenCalledTimes(1);
    });
    expect(addAttachmentFile.mock.calls[0][0]).toEqual([
      { path: "", content: "hello world", type: 0, title: "notes.md" },
    ]);
  });

  it("recognises known text extensions even without a MIME type", async () => {
    const addAttachmentFile = vi.fn();
    setupStores({ addAttachmentFile });
    const { getByTestId } = render(<Harness />);

    const code = makeFile("script.ts", "", "export const x = 1;");
    await act(async () => {
      fireEvent.drop(getByTestId("drop-zone"), {
        dataTransfer: makeDataTransfer([code]),
      });
    });

    await waitFor(() => {
      expect(addAttachmentFile).toHaveBeenCalledTimes(1);
    });
    expect(addAttachmentFile.mock.calls[0][0]).toHaveLength(1);
    expect(addAttachmentFile.mock.calls[0][0][0].title).toBe("script.ts");
  });

  it("ignores unsupported binary formats", async () => {
    const addAttachmentFile = vi.fn();
    const addAttachmentImage = vi.fn();
    setupStores({ addAttachmentFile, addAttachmentImage });
    const { getByTestId } = render(<Harness />);

    const docx = makeFile(
      "report.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "binary"
    );
    await act(async () => {
      fireEvent.drop(getByTestId("drop-zone"), {
        dataTransfer: makeDataTransfer([docx]),
      });
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(addAttachmentFile).not.toHaveBeenCalled();
    expect(addAttachmentImage).not.toHaveBeenCalled();
  });

  it("delegates the raw file list to onDropFiles and skips built-in handling", async () => {
    const addAttachmentFile = vi.fn();
    const addAttachmentImage = vi.fn();
    const onDropFiles = vi.fn().mockResolvedValue(undefined);
    setupStores({ addAttachmentFile, addAttachmentImage });
    const { getByTestId } = render(
      <WidgetConfigProvider config={{ onDropFiles }}>
        <Harness />
      </WidgetConfigProvider>
    );

    // A binary format the built-in path would ignore — the override must
    // still receive it.
    const docx = makeFile(
      "report.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "binary"
    );
    const img = makeFile("pic.png", "image/png", "pngdata");
    await act(async () => {
      fireEvent.drop(getByTestId("drop-zone"), {
        dataTransfer: makeDataTransfer([docx, img]),
      });
    });

    await waitFor(() => {
      expect(onDropFiles).toHaveBeenCalledTimes(1);
    });
    expect(onDropFiles.mock.calls[0][0]).toEqual([docx, img]);
    // Built-in read-and-attach is fully bypassed.
    expect(addAttachmentFile).not.toHaveBeenCalled();
    expect(addAttachmentImage).not.toHaveBeenCalled();
  });

  it("ignores drags that do not carry files", () => {
    const addAttachmentFile = vi.fn();
    const addAttachmentImage = vi.fn();
    setupStores({ addAttachmentFile, addAttachmentImage });
    const { getByTestId } = render(<Harness />);

    fireEvent.drop(getByTestId("drop-zone"), {
      dataTransfer: { files: [], types: ["text/plain"] },
    });
    expect(addAttachmentFile).not.toHaveBeenCalled();
    expect(addAttachmentImage).not.toHaveBeenCalled();
  });

  it("toggles isDragOver on enter and leave", () => {
    setupStores();
    const { getByTestId } = render(<Harness />);
    const zone = getByTestId("drop-zone");

    expect(zone.getAttribute("data-drag-over")).toBe("false");
    fireEvent.dragEnter(zone, { dataTransfer: makeDataTransfer([]) });
    expect(zone.getAttribute("data-drag-over")).toBe("true");
    fireEvent.dragLeave(zone, { dataTransfer: makeDataTransfer([]) });
    expect(zone.getAttribute("data-drag-over")).toBe("false");
  });
});
