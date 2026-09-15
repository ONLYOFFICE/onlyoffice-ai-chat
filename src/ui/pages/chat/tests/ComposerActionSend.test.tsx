// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseStores = vi.fn();
const mockSend = vi.fn();
const mockUseComposer = vi.fn();

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
  },
  ThreadPrimitive: {
    If: ({ children }: { children: React.ReactNode; running?: boolean }) => (
      <div data-testid="thread-if">{children}</div>
    ),
  },
  useComposerRuntime: () => ({ send: mockSend }),
  useComposer: (selector: (s: { text: string }) => unknown) =>
    mockUseComposer(selector),
}));

vi.mock("../../../components/icon-button", () => ({
  IconButton: (props: Record<string, unknown>) => (
    <button
      data-testid={props["data-testid"] as string}
      data-icon={props.iconName as string}
      disabled={props.disabled as boolean | undefined}
      // The real IconButton hardcodes `type="button"` — the reason Send
      // has to submit the form explicitly rather than rely on the click
      // bubbling to it.
      type="button"
      onClick={
        props.onClick as
          | ((e: React.MouseEvent<HTMLButtonElement>) => void)
          | undefined
      }
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
  attachmentFiles?: unknown[];
  attachmentImages?: unknown[];
  text?: string;
}) {
  mockUseComposer.mockImplementation(
    (selector: (s: { text: string }) => unknown) =>
      selector({ text: overrides.text ?? "" })
  );
  mockUseStores.mockReturnValue({
    useMessageStore: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        isStreamRunning: overrides.isStreamRunning ?? false,
      };
      return selector ? selector(state) : state;
    },
    useAttachmentsStore: (
      selector?: (s: Record<string, unknown>) => unknown
    ) => {
      const state = {
        pendingAttachments: overrides.pendingAttachments ?? [],
        attachmentFiles: overrides.attachmentFiles ?? [],
        attachmentImages: overrides.attachmentImages ?? [],
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
      text: "hello",
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
    setupStores({
      isStreamRunning: false,
      currentProfile: null,
      text: "hello",
    });
    render(<ComposerActionSend />);
    expect(screen.getByTestId("send-button")).toBeDisabled();
  });

  it("enables send button when there is text", () => {
    setupStores({
      isStreamRunning: false,
      currentProfile: { id: "1", name: "GPT" },
      text: "hello",
    });
    render(<ComposerActionSend />);
    expect(screen.getByTestId("send-button")).not.toBeDisabled();
  });

  it("disables send button while an attachment is still pending", () => {
    setupStores({
      isStreamRunning: false,
      currentProfile: { id: "1", name: "GPT" },
      pendingAttachments: [{ id: "p1" }],
      text: "hello",
    });
    render(<ComposerActionSend />);
    expect(screen.getByTestId("send-button")).toBeDisabled();
  });

  it("disables send button when there is no text and no attachments", () => {
    setupStores({
      isStreamRunning: false,
      currentProfile: { id: "1", name: "GPT" },
    });
    render(<ComposerActionSend />);
    expect(screen.getByTestId("send-button")).toBeDisabled();
  });

  it("enables send button when a file is attached, even with no text", () => {
    setupStores({
      isStreamRunning: false,
      currentProfile: { id: "1", name: "GPT" },
      attachmentFiles: [{ id: "f1" }],
    });
    render(<ComposerActionSend />);
    expect(screen.getByTestId("send-button")).not.toBeDisabled();
  });

  it("enables send button when an image is attached, even with no text", () => {
    setupStores({
      isStreamRunning: false,
      currentProfile: { id: "1", name: "GPT" },
      attachmentImages: [{ id: "i1" }],
    });
    render(<ComposerActionSend />);
    expect(screen.getByTestId("send-button")).not.toBeDisabled();
  });

  it("submits the composer form when clicked, rather than sending around it", () => {
    // The form's `onSubmit` is where a sent prompt is recorded into ↑/↓
    // history, and `IconButton` is a `type="button"` that never reaches
    // it on its own — so a click that called `send()` directly would drop
    // every mouse send from the history list.
    setupStores({
      isStreamRunning: false,
      currentProfile: { id: "1", name: "GPT" },
      attachmentFiles: [{ id: "f1" }],
    });
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <ComposerActionSend />
      </form>
    );
    mockSend.mockClear();
    screen.getByTestId("send-button").click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("falls back to composerRuntime.send() when rendered outside a form", () => {
    setupStores({
      isStreamRunning: false,
      currentProfile: { id: "1", name: "GPT" },
      attachmentFiles: [{ id: "f1" }],
    });
    render(<ComposerActionSend />);
    mockSend.mockClear();
    screen.getByTestId("send-button").click();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
