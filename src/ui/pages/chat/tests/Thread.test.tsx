// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const messageState = {
  messages: [],
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
}));

vi.mock("../../../components/manage-tool-dialog", () => ({
  ManageToolDialog: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="manage-tool-dialog">
      <button data-testid="manage-tool-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

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
});
