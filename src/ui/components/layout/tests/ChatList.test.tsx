// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mockSetCurrentPage = vi.fn();
const mockOnSwitchToThread = vi.fn();
const mockOnRenameThread = vi.fn();
const mockOnDownloadThread = vi.fn();
const mockOnExportThread = vi.fn();
const mockOnClearThreadHistory = vi.fn();
const mockLoadMoreThreads = vi.fn().mockResolvedValue(undefined);
const mockEnsureAllThreads = vi.fn().mockResolvedValue(undefined);
let mockHasMoreThreads = false;

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
        hasMoreThreads: mockHasMoreThreads,
        isLoadingMoreThreads: false,
        loadMoreThreads: mockLoadMoreThreads,
        ensureAllThreads: mockEnsureAllThreads,
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
  hideChatHistoryHeader?: boolean;
  chatHistoryAlwaysShowActions?: boolean;
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
    alwaysShowActions,
  }: {
    thread: { threadId: string; title: string };
    isActive: boolean;
    onSwitchToThread: (id: string) => void;
    alwaysShowActions?: boolean;
  }) => (
    <div
      data-testid={`chat-item-${thread.threadId}`}
      data-active={isActive}
      data-always-actions={alwaysShowActions ? "true" : "false"}
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

  it("hides the header (title + close button) when hideChatHistoryHeader is true", () => {
    mockWidgetConfig = { hideChatHistoryHeader: true };
    render(<ChatList />);
    expect(screen.queryByText("ChatHistory")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-btn-btn-close")).not.toBeInTheDocument();
    // Search and thread list stay visible.
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(screen.getByTestId("chat-item-t1")).toBeInTheDocument();
  });

  it("hides the header when the hideHeader prop is true (no config needed)", () => {
    render(<ChatList hideHeader />);
    expect(screen.queryByText("ChatHistory")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-btn-btn-close")).not.toBeInTheDocument();
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("hideHeader prop overrides the hideChatHistoryHeader config", () => {
    mockWidgetConfig = { hideChatHistoryHeader: true };
    render(<ChatList hideHeader={false} />);
    // Prop wins: header is shown even though config asks to hide it.
    expect(screen.getByText("ChatHistory")).toBeInTheDocument();
    expect(screen.getByTestId("icon-btn-btn-close")).toBeInTheDocument();
  });

  it("merges the className prop onto the root container", () => {
    const { container } = render(<ChatList className="custom-list-xyz" />);
    expect(container.firstChild).toHaveClass("custom-list-xyz");
    // Built-in layout classes are kept.
    expect(container.firstChild).toHaveClass("flex");
  });

  it("passes chatHistoryAlwaysShowActions config down to items", () => {
    mockWidgetConfig = { chatHistoryAlwaysShowActions: true };
    render(<ChatList />);
    expect(screen.getByTestId("chat-item-t1")).toHaveAttribute(
      "data-always-actions",
      "true"
    );
  });

  it("alwaysShowActions prop overrides the config", () => {
    mockWidgetConfig = { chatHistoryAlwaysShowActions: true };
    render(<ChatList alwaysShowActions={false} />);
    expect(screen.getByTestId("chat-item-t1")).toHaveAttribute(
      "data-always-actions",
      "false"
    );
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

  it("shows NoChatsFound when search matches nothing", () => {
    render(<ChatList />);
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "zzzzzzz" } });
    expect(screen.getByText("NoChatsFound")).toBeInTheDocument();
  });

  it("search is case-insensitive", () => {
    render(<ChatList />);
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "first" } });
    expect(screen.getByTestId("chat-item-t1")).toBeInTheDocument();
  });
});

describe("ChatList pagination", () => {
  class ObserverStub {
    static instances: ObserverStub[] = [];
    callback: IntersectionObserverCallback;
    observed: Element[] = [];
    disconnect = vi.fn();
    constructor(cb: IntersectionObserverCallback) {
      this.callback = cb;
      ObserverStub.instances.push(this);
    }
    observe(el: Element) {
      this.observed.push(el);
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockWidgetConfig = {};
    currentThreads = mockThreads;
    mockHasMoreThreads = true;
    ObserverStub.instances = [];
    vi.stubGlobal("IntersectionObserver", ObserverStub as never);
  });

  afterEach(() => {
    mockHasMoreThreads = false;
    vi.unstubAllGlobals();
  });

  it("renders the sentinel while more pages exist", () => {
    render(<ChatList />);
    expect(screen.getByTestId("chat-list-sentinel")).toBeInTheDocument();
  });

  it("does not render the sentinel when everything is loaded", () => {
    mockHasMoreThreads = false;
    render(<ChatList />);
    expect(screen.queryByTestId("chat-list-sentinel")).not.toBeInTheDocument();
  });

  it("loads the next page when the sentinel intersects", () => {
    render(<ChatList />);
    const observer = ObserverStub.instances[0];
    expect(observer).toBeDefined();
    observer.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver
    );
    expect(mockLoadMoreThreads).toHaveBeenCalledTimes(1);
  });

  it("hides the sentinel and drains all pages while searching", () => {
    render(<ChatList />);
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "First" } });
    expect(screen.queryByTestId("chat-list-sentinel")).not.toBeInTheDocument();
    expect(mockEnsureAllThreads).toHaveBeenCalled();
  });

  it("shows a loader instead of NoChatsFound while the search drain runs", () => {
    render(<ChatList />);
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "zzzzzzz" } });
    // No matches among loaded threads, but pages are still coming — the
    // verdict is inconclusive, so no premature "nothing found".
    expect(screen.getByTestId("chat-list-search-loading")).toBeInTheDocument();
    expect(screen.queryByText("NoChatsFound")).not.toBeInTheDocument();
  });

  it("shows NoChatsFound for an empty match once everything is loaded", () => {
    mockHasMoreThreads = false;
    render(<ChatList />);
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "zzzzzzz" } });
    expect(
      screen.queryByTestId("chat-list-search-loading")
    ).not.toBeInTheDocument();
    expect(screen.getByText("NoChatsFound")).toBeInTheDocument();
  });
});
