// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";

const mockUseStores = vi.fn();

vi.mock("../../../../store/context", () => ({
  useStores: () => mockUseStores(),
}));

import { useChatDropAttachments } from "../useChatDropAttachments";

const setupStores = (overrides?: {
  addAttachmentFile?: (f: unknown) => void;
  addAttachmentImage?: (i: unknown) => void;
}) => {
  mockUseStores.mockReturnValue({
    useAttachmentsStore: () => ({
      addAttachmentFile: overrides?.addAttachmentFile ?? vi.fn(),
      addAttachmentImage: overrides?.addAttachmentImage ?? vi.fn(),
    }),
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
    const call = addAttachmentImage.mock.calls[0][0];
    expect(call.name).toBe("pic.png");
    expect(call.base64.startsWith("data:image/png")).toBe(true);
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
    expect(addAttachmentFile.mock.calls[0][0]).toEqual({
      path: "notes.md",
      content: "hello world",
      type: 0,
    });
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
    expect(addAttachmentFile.mock.calls[0][0].path).toBe("script.ts");
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
