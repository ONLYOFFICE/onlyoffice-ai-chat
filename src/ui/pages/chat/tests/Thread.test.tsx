// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../store/context", () => ({
  useStores: () => ({
    useMessageStore: () => ({
      messages: [],
      stopMessage: vi.fn(),
      isStreamRunning: false,
      isRequestRunning: false,
    }),
    useProfilesStore: () => ({
      profiles: [{ id: "p1", name: "Test" }],
    }),
    useAttachmentsStore: () => ({
      addAttachmentFile: vi.fn(),
      addAttachmentImage: vi.fn(),
    }),
  }),
}));

vi.mock("../../../../hooks", () => ({
  useMessages: () => ({ onNew: vi.fn() }),
}));

vi.mock("../../initial-setup", () => ({
  default: () => <div data-testid="initial-setup" />,
}));

vi.mock("@assistant-ui/react", () => ({
  AssistantRuntimeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="runtime-provider">{children}</div>
  ),
  useExternalStoreRuntime: () => ({}),
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
  },
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

vi.mock("../sub-components/Welcome", () => ({
  ThreadWelcome: () => <div data-testid="welcome" />,
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

  it("renders welcome and composer for empty state", () => {
    render(<Thread />);
    expect(screen.getByTestId("welcome")).toBeInTheDocument();
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
});
