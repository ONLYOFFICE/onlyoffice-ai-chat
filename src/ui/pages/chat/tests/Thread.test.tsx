// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const messageState = {
  messages: [] as unknown[],
  stopMessage: vi.fn(),
  isStreamRunning: false,
  isRequestRunning: false,
  isToolPending: false,
};
const profilesState = {
  profiles: [{ id: "p1", name: "Test" }],
  initialized: true,
};
const routerState = {
  currentPage: "chat" as const,
  setCurrentPage: vi.fn(),
};
const attachmentsState = {
  addAttachmentFile: vi.fn(),
  addAttachmentImage: vi.fn(),
};
const serversState = {
  manageToolData: undefined as unknown,
  setManageToolData: vi.fn(),
};

const makeStore = <T,>(state: T) => {
  const hook = (selector?: (s: T) => unknown) =>
    selector ? selector(state) : state;
  return hook;
};

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useMessageStore: makeStore(messageState),
    useProfilesStore: makeStore(profilesState),
    useRouter: makeStore(routerState),
    useAttachmentsStore: makeStore(attachmentsState),
    useServersStore: makeStore(serversState),
  }),
}));

vi.mock("../../../hooks", () => ({
  useMessages: () => ({
    onNew: vi.fn(),
    regenerate: vi.fn(),
    approveToolCall: vi.fn(),
    denyToolCall: vi.fn(),
  }),
  useThread: vi.fn(),
  useSanitizedCopy: () => vi.fn(),
}));

vi.mock("../../../components/manage-tool-dialog", async () => {
  const { useState } = await import("react");
  return {
    ManageToolDialog: ({ onClose }: { onClose: () => void }) => {
      // Stands in for the real dialog's local "Always allow" state.
      const [checked, setChecked] = useState(false);
      return (
        <div data-testid="manage-tool-dialog">
          <button data-testid="manage-tool-close" onClick={onClose}>
            close
          </button>
          <input
            type="checkbox"
            data-testid="manage-tool-allow-always"
            checked={checked}
            onChange={() => setChecked((v) => !v)}
          />
        </div>
      );
    },
  };
});

vi.mock("../../../hooks/useEnsureProfiles", () => ({
  default: () => {},
}));
vi.mock("../../../hooks/useEnsureThreads", () => ({
  default: () => {},
}));
vi.mock("../../../hooks/useEnsurePrompts", () => ({
  default: () => {},
}));
vi.mock("../../../hooks/useEnsureTools", () => ({
  default: () => {},
}));

vi.mock("../../initial-setup", () => ({
  default: () => <div data-testid="initial-setup" />,
}));

vi.mock("@assistant-ui/react", () => ({
  AssistantRuntimeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="runtime-provider">{children}</div>
  ),
  useExternalStoreRuntime: () => ({}),
  useComposerRuntime: () => ({ setText: vi.fn() }),
  CompositeAttachmentAdapter: class {},
  SimpleImageAttachmentAdapter: class {},
  SimpleTextAttachmentAdapter: class {},
  ThreadPrimitive: {
    Root: ({ children, ...props }: { children: React.ReactNode }) => (
      <div data-testid="thread-root" {...props}>
        {children}
      </div>
    ),
    Viewport: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="viewport">{children}</div>
    ),
    If: ({
      children,
      empty,
    }: {
      children: React.ReactNode;
      empty?: boolean;
    }) => <div data-testid={`if-empty-${empty}`}>{children}</div>,
    Messages: () => <div data-testid="messages" />,
    ScrollToBottom: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="scroll-to-bottom">{children}</div>
    ),
  },
}));

vi.mock("../../../components/icon", () => ({
  Icon: () => <span data-testid="icon" />,
}));

vi.mock("../../../components/loader", () => ({
  Loader: () => <div data-testid="loader" />,
}));

vi.mock("../sub-components/Composer", () => ({
  Composer: () => <div data-testid="composer" />,
}));

vi.mock("../sub-components/UserMessage", () => ({
  UserMessage: () => <div />,
}));

vi.mock("../sub-components/AssistantMessage", () => ({
  AssistantMessage: () => <div />,
}));

vi.mock("../sub-components/SuggestionsHeader", () => ({
  SuggestionsHeader: () => <div data-testid="suggestions-header" />,
}));

vi.mock("../Thread.css", () => ({}));

vi.mock("framer-motion", () => ({
  motion: {
    div: (props: Record<string, unknown>) => <div {...props} />,
  },
}));

import Thread from "../index";

describe("ChatPage (Thread)", () => {
  it("renders without crashing", () => {
    render(<Thread />);
    expect(screen.getByTestId("thread-root")).toBeInTheDocument();
  });

  it("renders suggestions header and composer for empty state", () => {
    render(<Thread />);
    expect(screen.getByTestId("suggestions-header")).toBeInTheDocument();
    expect(screen.getAllByTestId("composer").length).toBeGreaterThanOrEqual(1);
  });

  it("renders messages component", () => {
    render(<Thread />);
    expect(screen.getByTestId("messages")).toBeInTheDocument();
  });

  it("does not show loader when not streaming", () => {
    render(<Thread />);
    expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
  });

  it("does not show the tool-approval dialog when manageToolData is unset", () => {
    serversState.manageToolData = undefined;
    render(<Thread />);
    expect(screen.queryByTestId("manage-tool-dialog")).not.toBeInTheDocument();
  });

  it("shows the tool-approval dialog when manageToolData is set", () => {
    serversState.manageToolData = { toolName: "get_my_folder" };
    render(<Thread />);
    expect(screen.getByTestId("manage-tool-dialog")).toBeInTheDocument();
    serversState.manageToolData = undefined;
  });

  it("clears manageToolData when the dialog closes", () => {
    serversState.manageToolData = { toolName: "get_my_folder" };
    render(<Thread />);
    fireEvent.click(screen.getByTestId("manage-tool-close"));
    expect(serversState.setManageToolData).toHaveBeenCalledWith(undefined);
    serversState.manageToolData = undefined;
  });

  it("resets the dialog's local state when the next tool call replaces it", () => {
    serversState.manageToolData = { messageId: "m1", idx: 0 };
    const { rerender } = render(<Thread />);
    fireEvent.click(screen.getByTestId("manage-tool-allow-always"));
    expect(screen.getByTestId("manage-tool-allow-always")).toBeChecked();

    serversState.manageToolData = { messageId: "m1", idx: 1 };
    rerender(<Thread />);
    expect(screen.getByTestId("manage-tool-allow-always")).not.toBeChecked();
    serversState.manageToolData = undefined;
  });
  describe("Analyzing indicator", () => {
    const streamIdle = (messages: unknown[]) => {
      messageState.messages = messages;
      messageState.isStreamRunning = true;
      messageState.isRequestRunning = false;
    };

    afterEach(() => {
      vi.useRealTimers();
      messageState.messages = [];
      messageState.isStreamRunning = false;
    });

    it("surfaces when the stream goes idle", () => {
      vi.useFakeTimers();
      streamIdle([
        { role: "assistant", content: [{ type: "text", text: "Hi" }] },
      ]);
      render(<Thread />);
      act(() => vi.advanceTimersByTime(400));
      expect(
        screen.getByTestId("chat-analyzing-indicator")
      ).toBeInTheDocument();
    });

    it("stays hidden while a trailing reasoning block is still open", () => {
      vi.useFakeTimers();
      streamIdle([
        {
          role: "assistant",
          content: [{ type: "reasoning", text: "Let me think" }],
        },
      ]);
      render(<Thread />);
      act(() => vi.advanceTimersByTime(400));
      expect(
        screen.queryByTestId("chat-analyzing-indicator")
      ).not.toBeInTheDocument();
    });

    it("surfaces again once the reasoning block is finalized", () => {
      vi.useFakeTimers();
      streamIdle([
        {
          role: "assistant",
          content: [{ type: "reasoning", text: "Done", parentId: "sig" }],
        },
      ]);
      render(<Thread />);
      act(() => vi.advanceTimersByTime(400));
      expect(
        screen.getByTestId("chat-analyzing-indicator")
      ).toBeInTheDocument();
    });
  });
});
