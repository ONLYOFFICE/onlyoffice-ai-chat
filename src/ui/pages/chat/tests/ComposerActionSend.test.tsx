// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseStores = vi.fn();

vi.mock("../../../store/context", () => ({
  useStores: () => mockUseStores(),
}));

vi.mock("@assistant-ui/react", () => ({
  ComposerPrimitive: {
    Cancel: ({
      children,
      asChild,
    }: {
      children: React.ReactNode;
      asChild?: boolean;
    }) => (
      <div data-testid="composer-cancel" data-as-child={asChild}>
        {children}
      </div>
    ),
    Send: ({
      children,
      asChild,
      disabled,
    }: {
      children: React.ReactNode;
      asChild?: boolean;
      disabled?: boolean;
    }) => (
      <button
        data-testid="composer-send"
        data-as-child={asChild}
        disabled={disabled ?? false}
      >
        {children}
      </button>
    ),
  },
  ThreadPrimitive: {
    If: ({ children }: { children: React.ReactNode; running?: boolean }) => (
      <div data-testid="thread-if">{children}</div>
    ),
  },
}));

vi.mock("../../../components/icon-button", () => ({
  IconButton: (props: Record<string, unknown>) => (
    <button
      data-testid={props["data-testid"] as string}
      data-icon={props.iconName as string}
    >
      {props.iconName as string}
    </button>
  ),
}));

import { ComposerActionSend } from "../sub-components/ComposerActionSend";

function setupStores(overrides: {
  isStreamRunning?: boolean;
  currentProfile?: { id: string; name: string } | null;
  pendingAttachments?: unknown[];
}) {
  mockUseStores.mockReturnValue({
    useMessageStore: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        isStreamRunning: overrides.isStreamRunning ?? false,
      };
      return selector ? selector(state) : state;
    },
    useAttachmentsStore: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        pendingAttachments: overrides.pendingAttachments ?? [],
      };
      return selector ? selector(state) : state;
    },
    useProfilesStore: (selector?: unknown) => {
      if (typeof selector === "function") {
        return (selector as (s: unknown) => unknown)({});
      }
      return {};
    },
    selectCurrentChatProfile: (_state: unknown) =>
      overrides.currentProfile ?? null,
  });
}

describe("ComposerActionSend", () => {
  it("renders send button when not streaming", () => {
    setupStores({
      isStreamRunning: false,
      currentProfile: { id: "1", name: "GPT" },
    });
    render(<ComposerActionSend />);
    expect(screen.getByTestId("send-button")).toBeInTheDocument();
    expect(screen.queryByTestId("stop-button")).not.toBeInTheDocument();
  });

  it("renders stop/cancel button when streaming", () => {
    setupStores({
      isStreamRunning: true,
      currentProfile: { id: "1", name: "GPT" },
    });
    render(<ComposerActionSend />);
    expect(screen.getByTestId("stop-button")).toBeInTheDocument();
    expect(screen.queryByTestId("send-button")).not.toBeInTheDocument();
  });

  it("disables send button when no profile is selected", () => {
    setupStores({ isStreamRunning: false, currentProfile: null });
    render(<ComposerActionSend />);
    const sendWrapper = screen.getByTestId("composer-send");
    expect(sendWrapper).toBeDisabled();
  });

  it("enables send button when a profile is selected", () => {
    setupStores({
      isStreamRunning: false,
      currentProfile: { id: "1", name: "GPT" },
    });
    render(<ComposerActionSend />);
    const sendWrapper = screen.getByTestId("composer-send");
    expect(sendWrapper).not.toBeDisabled();
  });

  it("disables send button while an attachment is still pending", () => {
    setupStores({
      isStreamRunning: false,
      currentProfile: { id: "1", name: "GPT" },
      pendingAttachments: [{ id: "p1" }],
    });
    render(<ComposerActionSend />);
    const sendWrapper = screen.getByTestId("composer-send");
    expect(sendWrapper).toBeDisabled();
  });
});
