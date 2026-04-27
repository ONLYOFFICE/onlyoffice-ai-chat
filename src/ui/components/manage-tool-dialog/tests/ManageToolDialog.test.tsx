// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockManageToolData = {
  message: {
    content: [
      {
        type: "tool-call",
        toolCallId: "tc-1",
        toolName: "my_tool",
        args: { query: "test" },
        argsText: '{"query":"test"}',
        result: undefined,
      },
    ],
  },
  idx: 0,
};

vi.mock("../../../../store/context", () => ({
  useStores: () => ({
    useServersStore: () => ({
      manageToolData: mockManageToolData,
    }),
  }),
}));

vi.mock("../../tool-fallback", () => ({
  ToolFallback: () => <div data-testid="tool-fallback" />,
}));

vi.mock("../../dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog">{children}</div>
  ),
  DialogContent: ({
    children,
    header,
  }: {
    children: React.ReactNode;
    header: string;
    onClose?: () => void;
    isHuge?: boolean;
  }) => (
    <div data-testid="dialog-content">
      <h2>{header}</h2>
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
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock("../../checkbox", () => ({
  Checkbox: ({ checked, id }: { checked: boolean; id: string }) => (
    <input type="checkbox" readOnly checked={checked} data-testid={id} />
  ),
}));

import { ManageToolDialog } from "../index";

describe("ManageToolDialog", () => {
  const onAllow = vi.fn();
  const onDeny = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore the valid tool data
    mockManageToolData.message = {
      content: [
        {
          type: "tool-call",
          toolCallId: "tc-1",
          toolName: "my_tool",
          args: { query: "test" },
          argsText: '{"query":"test"}',
          result: undefined,
        },
      ],
    };
    mockManageToolData.idx = 0;
  });

  it("renders dialog with confirmation header", () => {
    render(
      <ManageToolDialog onAllow={onAllow} onDeny={onDeny} onClose={onClose} />
    );
    expect(screen.getByText("Confirmation")).toBeInTheDocument();
  });

  it("renders tool fallback component", () => {
    render(
      <ManageToolDialog onAllow={onAllow} onDeny={onDeny} onClose={onClose} />
    );
    expect(screen.getByTestId("tool-fallback")).toBeInTheDocument();
  });

  it("renders descriptive text", () => {
    render(
      <ManageToolDialog onAllow={onAllow} onDeny={onDeny} onClose={onClose} />
    );
    expect(screen.getByText("AIWouldLikeUseThisTool")).toBeInTheDocument();
    expect(screen.getByText("ReviewEachAction")).toBeInTheDocument();
  });

  it("renders Allow and Deny buttons", () => {
    render(
      <ManageToolDialog onAllow={onAllow} onDeny={onDeny} onClose={onClose} />
    );
    expect(screen.getByText("Allow")).toBeInTheDocument();
    expect(screen.getByText("Deny")).toBeInTheDocument();
  });

  it("calls onAllow and onClose when Allow is clicked", () => {
    render(
      <ManageToolDialog onAllow={onAllow} onDeny={onDeny} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("Allow"));
    expect(onAllow).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onDeny and onClose when Deny is clicked", () => {
    render(
      <ManageToolDialog onAllow={onAllow} onDeny={onDeny} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("Deny"));
    expect(onDeny).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders AlwaysAllow checkbox", () => {
    render(
      <ManageToolDialog onAllow={onAllow} onDeny={onDeny} onClose={onClose} />
    );
    expect(screen.getByText("AlwaysAllow")).toBeInTheDocument();
    expect(screen.getByTestId("allow-always-checkbox")).not.toBeChecked();
  });

  it("toggles checkbox when AlwaysAllow text is clicked", () => {
    render(
      <ManageToolDialog onAllow={onAllow} onDeny={onDeny} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("AlwaysAllow"));
    expect(screen.getByTestId("allow-always-checkbox")).toBeChecked();
  });

  it("passes allowAlways=true to onAllow when checkbox is toggled", () => {
    render(
      <ManageToolDialog onAllow={onAllow} onDeny={onDeny} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("AlwaysAllow"));
    fireEvent.click(screen.getByText("Allow"));
    expect(onAllow).toHaveBeenCalledWith(true);
  });

  it("allows via Enter key", () => {
    render(
      <ManageToolDialog onAllow={onAllow} onDeny={onDeny} onClose={onClose} />
    );
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onAllow).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("returns null when toolCall is not a tool-call type", () => {
    mockManageToolData.message = {
      content: [{ type: "text", text: "hello" }],
    } as never;
    const { container } = render(
      <ManageToolDialog onAllow={onAllow} onDeny={onDeny} onClose={onClose} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when toolCall is undefined", () => {
    mockManageToolData.message = { content: [] } as never;
    mockManageToolData.idx = 5;
    const { container } = render(
      <ManageToolDialog onAllow={onAllow} onDeny={onDeny} onClose={onClose} />
    );
    expect(container.innerHTML).toBe("");
  });
});
