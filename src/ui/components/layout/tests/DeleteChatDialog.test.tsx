// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, act } from "@testing-library/react";

const mockOnDeleteThread = vi.fn().mockResolvedValue(undefined);
const mockOnClose = vi.fn();

let mockIsRTL = false;

vi.mock("../../../providers/LocalesProvider", () => ({
  useI18n: () => ({
    t: (k: string) => k,
    locale: "en",
    changeLocale: vi.fn(),
    isRTL: mockIsRTL,
    direction: mockIsRTL ? ("rtl" as const) : ("ltr" as const),
  }),
}));

vi.mock("../../../../store/context", () => ({
  useStores: () => ({
    useThreadsStore: (selector?: (s: unknown) => unknown) => {
      const state = { onDeleteThread: mockOnDeleteThread };
      return selector ? selector(state) : state;
    },
  }),
}));

vi.mock("../../dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({
    children,
    header,
    onClose,
  }: {
    children: React.ReactNode;
    header: string;
    onClose: () => void;
    withWarningIcon?: boolean;
  }) => (
    <div data-testid="dialog-content">
      <h2>{header}</h2>
      <button data-testid="dialog-close" onClick={onClose}>
        close
      </button>
      {children}
    </div>
  ),
  DialogOverlay: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-overlay" {...props}>
      {children}
    </div>
  ),
  DialogFooter: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-footer" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("../../button", () => ({
  Button: ({
    children,
    onClick,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
  }) => (
    <button data-testid={`btn-${variant || "primary"}`} onClick={onClick}>
      {children}
    </button>
  ),
}));

import { DeleteChatDialog } from "../sub-components/DeleteChatDialog";

describe("DeleteChatDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRTL = false;
  });

  it("renders warning header and body text", () => {
    render(<DeleteChatDialog id="thread-1" onClose={mockOnClose} />);
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("WantDeleteChat")).toBeInTheDocument();
  });

  it("renders No and Yes buttons", () => {
    render(<DeleteChatDialog id="thread-1" onClose={mockOnClose} />);
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("clicking No calls onClose without deleting", () => {
    render(<DeleteChatDialog id="thread-1" onClose={mockOnClose} />);
    fireEvent.click(screen.getByText("No"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnDeleteThread).not.toHaveBeenCalled();
  });

  it("clicking Yes calls onDeleteThread then onClose", async () => {
    render(<DeleteChatDialog id="thread-1" onClose={mockOnClose} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Yes"));
    });
    expect(mockOnDeleteThread).toHaveBeenCalledWith("thread-1");
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("pressing Enter key confirms deletion", async () => {
    render(<DeleteChatDialog id="thread-1" onClose={mockOnClose} />);
    await act(async () => {
      fireEvent.keyDown(document, { key: "Enter" });
    });
    expect(mockOnDeleteThread).toHaveBeenCalledWith("thread-1");
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("pressing other keys does not trigger deletion", () => {
    render(<DeleteChatDialog id="thread-1" onClose={mockOnClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnDeleteThread).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("cleans up keydown listener on unmount", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = render(
      <DeleteChatDialog id="thread-1" onClose={mockOnClose} />
    );

    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("applies RTL styling when isRTL is true", () => {
    mockIsRTL = true;

    const { container } = render(
      <DeleteChatDialog id="thread-1" onClose={mockOnClose} />
    );

    const buttonRow = container.querySelector(".flex-row-reverse");
    expect(buttonRow).toBeInTheDocument();
  });
});
