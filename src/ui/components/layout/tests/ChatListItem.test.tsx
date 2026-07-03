// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

type MockItem = {
  text: string;
  onClick: () => void;
  isSeparator?: boolean;
  subMenu?: MockItem[];
};

vi.mock("../../dropdown", () => ({
  DropdownMenu: ({
    trigger,
    items,
    open,
  }: {
    trigger: React.ReactNode;
    items: MockItem[];
    open?: boolean;
  }) => (
    <div data-testid="dropdown-menu" data-open={open}>
      {trigger}
      <ul data-testid="dropdown-items">
        {items.map((item, i) =>
          item.isSeparator ? (
            <li key={i} data-testid="separator">
              <button data-testid="separator-btn" onClick={item.onClick} />
            </li>
          ) : (
            <li key={i}>
              <button data-testid={`menu-${item.text}`} onClick={item.onClick}>
                {item.text}
              </button>
              {item.subMenu ? (
                <ul data-testid={`submenu-${item.text}`}>
                  {item.subMenu.map((sub, j) => (
                    <li key={j}>
                      <button
                        data-testid={`submenu-item-${sub.text}`}
                        onClick={sub.onClick}
                      >
                        {sub.text}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        )}
      </ul>
    </div>
  ),
}));

vi.mock("../../icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="icon">{name}</span>,
}));

vi.mock("../../icon-button", () => ({
  IconButton: ({
    iconName,
    onClick,
  }: {
    iconName: string;
    onClick?: () => void;
  }) => (
    <button data-testid={`icon-btn-${iconName}`} onClick={onClick}>
      {iconName}
    </button>
  ),
}));

vi.mock("../../input", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactModule = require("react");
  return {
    Input: ReactModule.forwardRef(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (props: any, ref: any) => (
        <input
          data-testid="rename-input"
          ref={ref}
          value={props.value}
          onChange={props.onChange}
          onBlur={props.onBlur}
          autoFocus={props.autoFocus}
          maxLength={props.maxLength}
        />
      )
    ),
  };
});

vi.mock("../sub-components/DeleteChatDialog", () => ({
  DeleteChatDialog: ({ id, onClose }: { id: string; onClose: () => void }) => (
    <div data-testid="delete-dialog" data-id={id}>
      <button data-testid="delete-dialog-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

import { ChatListItem } from "../sub-components/ChatListItem";
import type { Thread } from "../../../../types";

const createThread = (overrides?: Partial<Thread>): Thread =>
  ({
    threadId: "thread-1",
    title: "Test Thread",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }) as Thread;

const defaultProps = {
  thread: createThread(),
  isActive: false,
  onSwitchToThread: vi.fn(),
  onRenameThread: vi.fn(),
  onDownloadThread: vi.fn(),
  onExportThread: vi.fn(),
  exportFormats: [],
  onClearThreadHistory: vi.fn(),
  setCurrentPage: vi.fn(),
};

describe("ChatListItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders thread title", () => {
    render(<ChatListItem {...defaultProps} />);
    expect(screen.getByText("Test Thread")).toBeInTheDocument();
  });

  it("applies active class when isActive is true", () => {
    const { container } = render(
      <ChatListItem {...defaultProps} isActive={true} />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("bg-[var(--chat-list-item-active");
  });

  it("applies hover class when not active", () => {
    const { container } = render(
      <ChatListItem {...defaultProps} isActive={false} />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("hover:bg-[var(--chat-list-item-hover");
  });

  it("shows dropdown menu on hover", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;

    // Hover
    fireEvent.mouseEnter(container);

    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
  });

  it("hides dropdown menu on mouse leave when not open", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;

    fireEvent.mouseEnter(container);
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();

    fireEvent.mouseLeave(container);
    expect(screen.queryByTestId("dropdown-menu")).not.toBeInTheDocument();
  });

  it("calls onSwitchToThread and setCurrentPage on click", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;

    fireEvent.click(container);

    expect(defaultProps.onSwitchToThread).toHaveBeenCalledWith("thread-1");
    expect(defaultProps.setCurrentPage).toHaveBeenCalledWith("chat");
  });

  it("shows dropdown menu items with correct texts", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);

    expect(screen.getByTestId("menu-Open")).toBeInTheDocument();
    expect(screen.getByTestId("menu-Save")).toBeInTheDocument();
    expect(screen.getByTestId("menu-Rename")).toBeInTheDocument();
    expect(screen.getByTestId("menu-Delete")).toBeInTheDocument();
    expect(screen.getByTestId("separator")).toBeInTheDocument();
  });

  it("hides ClearHistory by default", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);

    expect(screen.queryByTestId("menu-ClearHistory")).not.toBeInTheDocument();
  });

  it("shows ClearHistory when showClearHistory is true", () => {
    render(<ChatListItem {...defaultProps} showClearHistory />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);

    expect(screen.getByTestId("menu-ClearHistory")).toBeInTheDocument();
  });

  it("shows rename input when Rename is clicked", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);

    fireEvent.click(screen.getByTestId("menu-Rename"));

    expect(screen.getByTestId("rename-input")).toBeInTheDocument();
    expect(screen.getByTestId("rename-input")).toHaveValue("Test Thread");
  });

  it("renames thread on blur with non-empty title", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByTestId("menu-Rename"));

    const input = screen.getByTestId("rename-input");
    fireEvent.change(input, { target: { value: "New Title" } });
    fireEvent.blur(input);

    expect(defaultProps.onRenameThread).toHaveBeenCalledWith(
      "thread-1",
      "New Title"
    );
  });

  it("does not rename when blur with empty title", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByTestId("menu-Rename"));

    const input = screen.getByTestId("rename-input");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(defaultProps.onRenameThread).not.toHaveBeenCalled();
  });

  it("cancels rename on Escape key", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByTestId("menu-Rename"));

    expect(screen.getByTestId("rename-input")).toBeInTheDocument();

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });

    // Rename input should be hidden, title should be shown
    expect(screen.queryByTestId("rename-input")).not.toBeInTheDocument();
    expect(screen.getByText("Test Thread")).toBeInTheDocument();
  });

  it("submits rename on Enter key by blurring input", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByTestId("menu-Rename"));

    const input = screen.getByTestId("rename-input");
    fireEvent.change(input, { target: { value: "Enter Title" } });

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });

    expect(defaultProps.onRenameThread).toHaveBeenCalledWith(
      "thread-1",
      "Enter Title"
    );
  });

  it("shows delete dialog when Delete is clicked", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByTestId("menu-Delete"));

    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("delete-dialog")).toHaveAttribute(
      "data-id",
      "thread-1"
    );
  });

  it("closes delete dialog on close callback", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByTestId("menu-Delete"));

    fireEvent.click(screen.getByTestId("delete-dialog-close"));

    expect(screen.queryByTestId("delete-dialog")).not.toBeInTheDocument();
  });

  it("calls onDownloadThread when Save is clicked", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByTestId("menu-Save"));

    expect(defaultProps.onDownloadThread).toHaveBeenCalledWith(
      "thread-1",
      "Test Thread"
    );
  });

  it("shows Export submenu instead of Save when host declares multiple formats", () => {
    const props = {
      ...defaultProps,
      exportFormats: [
        { id: "docx", label: "Word (.docx)", extension: "docx" },
        { id: "pdf", label: "PDF (.pdf)", extension: "pdf" },
      ],
    };
    render(<ChatListItem {...props} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);

    expect(screen.queryByTestId("menu-Save")).not.toBeInTheDocument();
    expect(screen.getByTestId("menu-ExportTo")).toBeInTheDocument();
    expect(screen.getByTestId("submenu-item-Word (.docx)")).toBeInTheDocument();
    expect(screen.getByTestId("submenu-item-PDF (.pdf)")).toBeInTheDocument();
  });

  it("calls onExportThread with the chosen format id from the submenu", () => {
    const onExportThread = vi.fn();
    const props = {
      ...defaultProps,
      onExportThread,
      exportFormats: [
        { id: "docx", label: "Word (.docx)", extension: "docx" },
        { id: "pdf", label: "PDF (.pdf)", extension: "pdf" },
      ],
    };
    render(<ChatListItem {...props} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByTestId("submenu-item-PDF (.pdf)"));

    expect(onExportThread).toHaveBeenCalledWith("thread-1", "pdf", "Test Thread");
  });

  it("keeps a single Save item when only one format is declared", () => {
    const props = {
      ...defaultProps,
      exportFormats: [{ id: "docx", label: "Word (.docx)", extension: "docx" }],
    };
    render(<ChatListItem {...props} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);

    expect(screen.getByTestId("menu-Save")).toBeInTheDocument();
    expect(screen.queryByTestId("menu-ExportTo")).not.toBeInTheDocument();
  });

  it("calls onClearThreadHistory when ClearHistory is clicked", () => {
    render(<ChatListItem {...defaultProps} showClearHistory />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByTestId("menu-ClearHistory"));

    expect(defaultProps.onClearThreadHistory).toHaveBeenCalledWith("thread-1");
  });

  it("does not switch thread when dropdown is open", () => {
    render(<ChatListItem {...defaultProps} />);
    // When rename input is visible, clicking the container should not switch
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByTestId("menu-Rename"));

    // Now click the container (rename input is visible)
    defaultProps.onSwitchToThread.mockClear();
    fireEvent.click(container);
    expect(defaultProps.onSwitchToThread).not.toHaveBeenCalled();
  });

  it("does not switch thread when delete dialog is visible", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByTestId("menu-Delete"));

    defaultProps.onSwitchToThread.mockClear();
    defaultProps.setCurrentPage.mockClear();
    fireEvent.click(container);
    expect(defaultProps.onSwitchToThread).not.toHaveBeenCalled();
  });

  it("calls onSwitchToThread when Open menu item is clicked", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByTestId("menu-Open"));

    expect(defaultProps.onSwitchToThread).toHaveBeenCalledWith("thread-1");
  });

  it("separator onClick returns undefined", () => {
    render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    const separatorBtn = screen.getByTestId("separator-btn");
    fireEvent.click(separatorBtn);
    // The separator onClick is () => undefined, just verify it doesn't throw
    expect(separatorBtn).toBeInTheDocument();
  });

  it("keydown listener is cleaned up when rename input is hidden", () => {
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<ChatListItem {...defaultProps} />);
    const container = screen.getByText("Test Thread").closest("div")!;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByTestId("menu-Rename"));

    // Trigger Escape to hide rename input
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function)
    );
    removeEventListenerSpy.mockRestore();
  });
});
