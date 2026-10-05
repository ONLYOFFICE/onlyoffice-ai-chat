// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createPortal } from "react-dom";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockUseStores = vi.fn();
const mockSend = vi.fn();

vi.mock("../../../store/context", () => ({
  useStores: () => mockUseStores(),
}));

const mockUseWidgetConfig = vi.fn();

vi.mock("../../../../widget-config", () => ({
  useWidgetConfig: () => mockUseWidgetConfig(),
}));

vi.mock("@assistant-ui/react", () => ({
  ComposerPrimitive: {
    Root: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      className?: string;
    }) => (
      <form data-testid="composer-root" {...props}>
        {children}
      </form>
    ),
    Input: (props: Record<string, unknown>) => (
      <textarea
        data-testid={props["data-testid"] as string}
        placeholder={props.placeholder as string}
        disabled={props.disabled as boolean}
        aria-label={props["aria-label"] as string}
      />
    ),
  },
  useComposerRuntime: () => ({ setText: vi.fn(), send: mockSend }),
}));

vi.mock("../sub-components/ComposerActionRoom", () => ({
  ComposerActionRoom: () => null,
}));

// The real actions open menus and dialogs through portals; React still
// bubbles their events through the composer.
vi.mock("../sub-components/ComposerAction", () => ({
  ComposerAction: () => (
    <div data-testid="composer-action">
      {createPortal(
        <div>
          <div role="menuitem" data-testid="portaled-menu-item">
            Delete
          </div>
          <form data-testid="portaled-form" />
        </div>,
        document.body
      )}
    </div>
  ),
}));

vi.mock("../../../components/file-item", () => ({
  FileItem: ({ file }: { file: { path?: string; name?: string } }) => (
    <div data-testid="file-item" data-path={file.path ?? file.name} />
  ),
}));

function setupStores(overrides?: {
  attachmentFiles?: { path: string; content: string; type: number }[];
  attachmentImages?: { name: string; base64: string }[];
  pendingAttachments?: unknown[];
  currentProfile?: { id: string; name: string } | null;
  hideProfilePicker?: boolean;
  entityId?: string;
  isStreamRunning?: boolean;
}) {
  const attachmentsState = {
    attachmentFiles: overrides?.attachmentFiles ?? [],
    attachmentImages: overrides?.attachmentImages ?? [],
    pendingAttachments: overrides?.pendingAttachments ?? [],
    cancelPendingAttachment: vi.fn(),
  };
  const messageState = {
    isStreamRunning: overrides?.isStreamRunning ?? false,
  };
  mockUseStores.mockReturnValue({
    useAttachmentsStore: (
      selector?: (s: typeof attachmentsState) => unknown
    ) =>
      typeof selector === "function"
        ? selector(attachmentsState)
        : attachmentsState,
    useProfilesStore: (selector?: unknown) => {
      if (typeof selector === "function") {
        return overrides?.currentProfile ?? null;
      }
      return {};
    },
    useMessageStore: (selector?: (s: typeof messageState) => unknown) =>
      typeof selector === "function" ? selector(messageState) : messageState,
    selectCurrentChatProfile: () => overrides?.currentProfile ?? null,
  });
  mockUseWidgetConfig.mockReturnValue({
    hideProfilePicker: overrides?.hideProfilePicker ?? false,
    entityId: overrides?.entityId,
  });
}

import { Composer } from "../sub-components/Composer";

describe("Composer", () => {
  it("renders without crash", () => {
    setupStores();
    render(<Composer />);
    expect(screen.getByTestId("composer-root")).toBeInTheDocument();
  });

  it("renders disclaimer text", () => {
    setupStores();
    render(<Composer />);
    expect(screen.getByText("CheckInfo")).toBeInTheDocument();
  });

  it("renders composer input with placeholder", () => {
    setupStores({ currentProfile: { id: "1", name: "GPT" } });
    render(<Composer />);
    const input = screen.getByTestId("composer-input");
    expect(input).toBeInTheDocument();
    expect(input.getAttribute("placeholder")).toBe("AskAnything");
  });

  it("disables input when no profile selected", () => {
    setupStores({ currentProfile: null });
    render(<Composer />);
    const input = screen.getByTestId("composer-input");
    expect(input).toBeDisabled();
  });

  it("renders file items when attachments exist", () => {
    setupStores({
      attachmentFiles: [{ path: "/doc.pdf", content: "content", type: 1 }],
      attachmentImages: [
        { name: "img.png", base64: "data:image/png;base64,abc" },
      ],
      currentProfile: { id: "1", name: "GPT" },
    });
    render(<Composer />);
    const fileItems = screen.getAllByTestId("file-item");
    expect(fileItems).toHaveLength(2);
  });

  it("does not render file items when no attachments", () => {
    setupStores({ attachmentFiles: [], attachmentImages: [] });
    render(<Composer />);
    expect(screen.queryByTestId("file-item")).not.toBeInTheDocument();
  });

  it("renders composer action buttons", () => {
    setupStores();
    render(<Composer />);
    expect(screen.getByTestId("composer-action")).toBeInTheDocument();
  });

  it("sends via the runtime on submit when only attachments are present", () => {
    setupStores({
      attachmentFiles: [{ path: "/doc.pdf", content: "content", type: 1 }],
      currentProfile: { id: "1", name: "GPT" },
    });
    render(<Composer />);
    mockSend.mockClear();
    screen
      .getByTestId("composer-root")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("does not send via the runtime on submit when there are no attachments", () => {
    setupStores({ currentProfile: { id: "1", name: "GPT" } });
    render(<Composer />);
    mockSend.mockClear();
    screen
      .getByTestId("composer-root")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("focuses the input on a click in the composer's own gaps", () => {
    setupStores({ currentProfile: { id: "1", name: "GPT" } });
    render(<Composer />);
    fireEvent.click(screen.getByTestId("composer-root"));
    expect(document.activeElement).toBe(screen.getByTestId("composer-input"));
  });

  it("leaves focus alone on a click inside a portaled menu or dialog", () => {
    setupStores({ currentProfile: { id: "1", name: "GPT" } });
    render(<Composer />);
    fireEvent.click(screen.getByTestId("portaled-menu-item"));
    expect(document.activeElement).not.toBe(
      screen.getByTestId("composer-input")
    );
  });

  it("does not send when a form in a portaled dialog is submitted", () => {
    setupStores({
      attachmentFiles: [{ path: "/doc.pdf", content: "content", type: 1 }],
      currentProfile: { id: "1", name: "GPT" },
    });
    render(<Composer />);
    mockSend.mockClear();
    fireEvent.submit(screen.getByTestId("portaled-form"));
    expect(mockSend).not.toHaveBeenCalled();
  });
});
