// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
      <input
        data-testid={props["data-testid"] as string}
        placeholder={props.placeholder as string}
        disabled={props.disabled as boolean}
        aria-label={props["aria-label"] as string}
      />
    ),
  },
  useComposerRuntime: () => ({
    setText: vi.fn(),
    send: mockSend,
    getState: () => ({ text: "" }),
  }),
}));

vi.mock("../sub-components/ComposerAction", () => ({
  ComposerAction: () => <div data-testid="composer-action" />,
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
    messages: [],
  };
  const threadsState = { threadId: overrides?.entityId ?? "thread-1" };
  mockUseStores.mockReturnValue({
    useThreadsStore: Object.assign(
      (selector?: (s: typeof threadsState) => unknown) =>
        typeof selector === "function" ? selector(threadsState) : threadsState,
      { subscribe: () => () => {} }
    ),
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
    useMessageStore: Object.assign(
      (selector?: (s: typeof messageState) => unknown) =>
        typeof selector === "function" ? selector(messageState) : messageState,
      { getState: () => messageState }
    ),
    selectCurrentChatProfile: () => overrides?.currentProfile ?? null,
    api: {
      promptHistory: {
        list: vi.fn().mockResolvedValue([]),
        record: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      },
    },
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
    screen.getByTestId("composer-root").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("does not send via the runtime on submit when there are no attachments", () => {
    setupStores({ currentProfile: { id: "1", name: "GPT" } });
    render(<Composer />);
    mockSend.mockClear();
    screen.getByTestId("composer-root").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    expect(mockSend).not.toHaveBeenCalled();
  });
});
