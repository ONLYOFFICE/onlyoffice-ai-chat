// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mockSetCurrentPage = vi.fn();
const mockOnSwitchToThread = vi.fn();
const mockOnRenameThread = vi.fn();
const mockOnDownloadThread = vi.fn();
const mockOnExportThread = vi.fn();
const mockOnClearThreadHistory = vi.fn();

let mockExportFormats: { id: string; label: string; extension: string }[] = [];

const mockThreads = [
  { threadId: "t1", title: "First Chat" },
  { threadId: "t2", title: "Second Chat" },
  { threadId: "t3", title: "Another Topic" },
];

let currentThreads = mockThreads;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useThreadsStore: (selector?: (s: unknown) => unknown) => {
      const state = {
        threads: currentThreads,
        threadId: "t1",
        onSwitchToThread: mockOnSwitchToThread,
        onRenameThread: mockOnRenameThread,
        onDownloadThread: mockOnDownloadThread,
        onExportThread: mockOnExportThread,
        onClearThreadHistory: mockOnClearThreadHistory,
      };
      return selector ? selector(state) : state;
    },
    useRouter: (selector?: (s: unknown) => unknown) => {
      const state = { setCurrentPage: mockSetCurrentPage };
      return selector ? selector(state) : state;
    },
  }),
}));

vi.mock("../../../providers/PlatformProvider/context", () => ({
  usePlatform: () => ({
    file: { getExportFormats: () => mockExportFormats },
  }),
}));

let mockWidgetConfig: {
  chatHistoryCloseIcon?: "btn-close" | "btn-arrow-up";
} = {};

vi.mock("../../../../widget-config", () => ({
  useWidgetConfig: () => mockWidgetConfig,
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

vi.mock("../../input", () => ({
  Input: ({
    placeholder,
    value,
    onChange,
  }: {
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClear?: () => void;
  }) => (
    <input
      data-testid="search-input"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  ),
}));

vi.mock("../sub-components/ChatListItem", () => ({
  ChatListItem: ({
    thread,
    isActive,
    onSwitchToThread,
  }: {
    thread: { threadId: string; title: string };
    isActive: boolean;
    onSwitchToThread: (id: string) => void;
  }) => (
    <div
      data-testid={`chat-item-${thread.threadId}`}
      data-active={isActive}
      onClick={() => onSwitchToThread(thread.threadId)}
    >
      {thread.title}
    </div>
  ),
}));

import { ChatList } from "../sub-components/ChatList";

describe("ChatList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentThreads = mockThreads;
    mockWidgetConfig = {};
    mockExportFormats = [];
  });

  it("renders the ChatHistory heading", () => {
    render(<ChatList />);
    expect(screen.getByText("ChatHistory")).toBeInTheDocument();
  });

  it("renders a search input", () => {
    render(<ChatList />);
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("renders all thread items", () => {
    render(<ChatList />);
    expect(screen.getByTestId("chat-item-t1")).toBeInTheDocument();
    expect(screen.getByTestId("chat-item-t2")).toBeInTheDocument();
    expect(screen.getByTestId("chat-item-t3")).toBeInTheDocument();
  });

  it("marks active thread correctly", () => {
    render(<ChatList />);
    expect(screen.getByTestId("chat-item-t1")).toHaveAttribute(
      "data-active",
      "true"
    );
    expect(screen.getByTestId("chat-item-t2")).toHaveAttribute(
      "data-active",
      "false"
    );
  });

  it("clicking close button navigates to chat", () => {
    render(<ChatList />);
    fireEvent.click(screen.getByTestId("icon-btn-btn-close"));
    expect(mockSetCurrentPage).toHaveBeenCalledWith("chat");
  });

  it("uses the close icon for the dismiss button by default", () => {
    render(<ChatList />);
    expect(screen.getByTestId("icon-btn-btn-close")).toBeInTheDocument();
    expect(
      screen.queryByTestId("icon-btn-btn-arrow-up")
    ).not.toBeInTheDocument();
  });

  it("uses the arrow-up icon when chatHistoryCloseIcon is 'btn-arrow-up'", () => {
    mockWidgetConfig = { chatHistoryCloseIcon: "btn-arrow-up" };
    render(<ChatList />);
    const dismiss = screen.getByTestId("icon-btn-btn-arrow-up");
    expect(dismiss).toBeInTheDocument();
    expect(screen.queryByTestId("icon-btn-btn-close")).not.toBeInTheDocument();
    fireEvent.click(dismiss);
    expect(mockSetCurrentPage).toHaveBeenCalledWith("chat");
  });

  it("clicking a thread item switches to thread and navigates to chat", () => {
    render(<ChatList />);
    fireEvent.click(screen.getByTestId("chat-item-t2"));
    expect(mockOnSwitchToThread).toHaveBeenCalledWith("t2");
    expect(mockSetCurrentPage).toHaveBeenCalledWith("chat");
  });

  it("shows empty state message when no threads exist", () => {
    currentThreads = [];
    render(<ChatList />);
    expect(screen.getByText("NoChatYet")).toBeInTheDocument();
    // Search input should not be rendered when empty
    expect(screen.queryByTestId("search-input")).not.toBeInTheDocument();
  });

  it("filters threads based on search input", () => {
    render(<ChatList />);
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "First" } });
    expect(screen.getByTestId("chat-item-t1")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-item-t2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-item-t3")).not.toBeInTheDocument();
  });

  it("shows NoChatYet when search matches nothing", () => {
    render(<ChatList />);
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "zzzzzzz" } });
    expect(screen.getByText("NoChatYet")).toBeInTheDocument();
  });

  it("search is case-insensitive", () => {
    render(<ChatList />);
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "first" } });
    expect(screen.getByTestId("chat-item-t1")).toBeInTheDocument();
  });
});
