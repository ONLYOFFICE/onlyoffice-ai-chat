// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockSaveAsFile = vi.fn().mockResolvedValue(undefined);
let mockPlatformFile: unknown = null;
let mockIsStreamRunning = false;
let mockMessages: unknown[] = [];
let mockMessageStatus: unknown = { type: "complete" };
let mockMessageParentId = "0";
let mockMessageContent: unknown[] = [{ type: "text", text: "Hello" }];
let mockAssistantActions: unknown[] | undefined = undefined;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useMessageStore: Object.assign(
      ((
        selector?: (s: {
          isStreamRunning: boolean;
          messages: unknown[];
        }) => unknown
      ) => {
        const state = {
          isStreamRunning: mockIsStreamRunning,
          messages: mockMessages,
        };
        return typeof selector === "function" ? selector(state) : state;
      }) as never,
      {
        getState: () => ({
          isStreamRunning: mockIsStreamRunning,
          messages: mockMessages,
        }),
      }
    ),
  }),
}));

vi.mock("../../../providers/PlatformProvider/context", () => ({
  usePlatform: () => ({ file: mockPlatformFile }),
}));

vi.mock("@assistant-ui/react", () => ({
  MessagePrimitive: {
    Root: ({
      children,
      asChild,
    }: {
      children: React.ReactNode;
      asChild?: boolean;
    }) => (
      <div data-testid="message-root" data-as-child={asChild}>
        {children}
      </div>
    ),
    Content: ({
      components,
    }: {
      components?: {
        tools?: unknown;
        Reasoning?: React.ComponentType<unknown>;
        Text?: React.ComponentType<{
          text: string;
          type: string;
          parentId?: string;
        }>;
      };
    }) => {
      const TextComp = components?.Text;
      const ReasoningComp = components?.Reasoning;
      return (
        <div data-testid="message-content">
          {mockMessageContent.map((item: unknown, i: number) => {
            const c = item as { type: string; text: string };
            if (c.type === "reasoning" && ReasoningComp) {
              return (
                <ReasoningComp
                  key={i}
                  {...({
                    text: c.text,
                    type: c.type,
                    parentId: mockMessageParentId,
                  } as Record<string, unknown>)}
                />
              );
            }
            if (c.type === "text" && TextComp) {
              return (
                <TextComp
                  key={i}
                  text={c.text}
                  type={c.type}
                  parentId={mockMessageParentId}
                />
              );
            }
            return null;
          })}
        </div>
      );
    },
    Error: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="message-error-wrapper">{children}</div>
    ),
    If: ({
      children,
      copied,
    }: {
      children: React.ReactNode;
      copied?: boolean;
    }) => (
      <div
        data-testid={
          copied === true
            ? "if-copied"
            : copied === false
              ? "if-not-copied"
              : "if-unknown"
        }
      >
        {children}
      </div>
    ),
  },
  ActionBarPrimitive: {
    Root: ({
      children,
      hidden,
      className: _className,
    }: {
      children: React.ReactNode;
      hidden?: boolean;
      className?: string;
    }) => (
      <div data-testid="action-bar" data-hidden={hidden}>
        {children}
      </div>
    ),
    Copy: ({
      children,
      asChild: _asChild,
    }: {
      children: React.ReactNode;
      asChild?: boolean;
    }) => <div data-testid="action-copy">{children}</div>,
    Reload: ({
      children,
      asChild: _asChild,
    }: {
      children: React.ReactNode;
      asChild?: boolean;
    }) => <div data-testid="action-reload">{children}</div>,
  },
  ErrorPrimitive: {
    Root: ({
      children,
      className: _className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => <div data-testid="error-root">{children}</div>,
    Message: ({ className: _className }: { className?: string }) => (
      <span data-testid="error-message" />
    ),
  },
  useMessage: () => ({
    status: mockMessageStatus,
    parentId: mockMessageParentId,
    content: mockMessageContent,
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      ...props
    }: {
      children?: React.ReactNode;
      initial?: unknown;
      animate?: unknown;
      [key: string]: unknown;
    }) => (
      <div data-testid="motion-div" {...props}>
        {children}
      </div>
    ),
  },
}));

vi.mock("../../../components/markdown", () => ({
  MarkdownContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="markdown-content">{children}</div>
  ),
  // Streaming assistant text renders through the block-memoized primitive.
  MarkdownText: (props: { text?: string; children?: React.ReactNode }) => (
    <div data-testid="markdown-text">{props.text ?? props.children}</div>
  ),
}));

vi.mock("../../../components/icon", () => ({
  Icon: (props: Record<string, unknown>) => (
    <span
      data-testid="icon"
      data-name={props.name as string}
      className={props.className as string}
    />
  ),
}));

vi.mock("../../../components/icon-button", () => ({
  IconButton: (props: Record<string, unknown>) => (
    <button
      data-testid={`icon-btn-${props.iconName}`}
      onClick={props.onClick as (() => void) | undefined}
    />
  ),
}));

vi.mock("../../../components/loader", () => ({
  Loader: ({ size }: { size?: number }) => (
    <div data-testid="loader" data-size={size} />
  ),
}));

vi.mock("../../../components/tooltip-icon-button", () => ({
  TooltipIconButton: ({
    children,
    tooltip,
  }: {
    children: React.ReactNode;
    tooltip?: string;
  }) => (
    <div data-testid="tooltip-btn" data-tooltip={tooltip}>
      {children}
    </div>
  ),
}));

vi.mock("../../../components/tool-fallback", () => ({
  ToolFallback: () => <div data-testid="tool-fallback" />,
}));

vi.mock("../../../../shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  convertMessagesToMd: vi.fn(() => "# Title\nContent"),
  getMessageTitleFromMd: vi.fn(() => "Title"),
}));

vi.mock("../../../../utils", () => ({
  getMessageText: vi.fn((m: { content: unknown }) => {
    if (typeof m.content === "string") return m.content;
    if (!Array.isArray(m.content)) return "";
    return (m.content as { type: string; text?: string }[])
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("\n\n");
  }),
}));

vi.mock("../../../../widget-config", () => ({
  useWidgetConfig: () => ({ assistantActions: mockAssistantActions }),
}));

import { AssistantMessage } from "../sub-components/AssistantMessage";

describe("AssistantMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatformFile = null;
    mockIsStreamRunning = false;
    mockMessages = [];
    mockMessageStatus = { type: "complete" };
    mockMessageParentId = "0";
    mockMessageContent = [{ type: "text", text: "Hello" }];
    mockAssistantActions = undefined;
  });

  it("renders without crash", () => {
    render(<AssistantMessage />);
    expect(screen.getByTestId("message-root")).toBeInTheDocument();
  });

  it("renders with data-role assistant", () => {
    render(<AssistantMessage />);
    const motionDiv = screen.getByTestId("motion-div");
    expect(motionDiv.getAttribute("data-role")).toBe("assistant");
  });

  it("renders message content area", () => {
    render(<AssistantMessage />);
    expect(screen.getByTestId("message-content")).toBeInTheDocument();
  });

  it("does not render error banner for complete messages", () => {
    render(<AssistantMessage />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders nothing for a cancelled (stop) turn with no content", () => {
    mockMessageStatus = { type: "incomplete", reason: "stop" };
    mockMessageContent = [];
    render(<AssistantMessage />);
    expect(screen.queryByTestId("message-root")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-bar")).not.toBeInTheDocument();
  });

  it("still renders a cancelled turn that has partial content", () => {
    mockMessageStatus = { type: "incomplete", reason: "stop" };
    mockMessageContent = [{ type: "text", text: "partial" }];
    render(<AssistantMessage />);
    expect(screen.getByTestId("message-root")).toBeInTheDocument();
  });

  it("still renders an error turn even with no content (for its banner)", () => {
    mockMessageStatus = {
      type: "incomplete",
      reason: "error",
      error: { code: "auth", message: "401" },
    };
    mockMessageContent = [];
    render(<AssistantMessage />);
    expect(screen.getByTestId("message-root")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders typed error banner with localized text for known code", () => {
    mockMessageStatus = {
      type: "incomplete",
      reason: "error",
      error: { code: "auth", message: "401 Unauthorized" },
    };
    render(<AssistantMessage />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    // Localized text for known code, code chip below.
    expect(alert.textContent).toContain("ChatError.auth");
    expect(alert.textContent).toContain("auth");
    expect(alert.textContent).not.toContain("[object Object]");
  });

  it("falls back to payload message for unknown error code", () => {
    mockMessageStatus = {
      type: "incomplete",
      reason: "error",
      error: { code: "weirdo", message: "Something went sideways" },
    };
    render(<AssistantMessage />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Something went sideways");
    expect(alert.textContent).not.toContain("[object Object]");
  });

  it("survives legacy plain-object errors without rendering [object Object]", () => {
    mockMessageStatus = {
      type: "incomplete",
      reason: "error",
      error: { message: "legacy message, no code" },
    };
    render(<AssistantMessage />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("legacy message, no code");
    expect(alert.textContent).not.toContain("[object Object]");
  });

  it("renders action bar when status is complete", () => {
    render(<AssistantMessage />);
    expect(screen.getByTestId("action-bar")).toBeInTheDocument();
  });

  it("hides action bar when stream is running", () => {
    mockIsStreamRunning = true;
    render(<AssistantMessage />);
    const actionBar = screen.getByTestId("action-bar");
    expect(actionBar.getAttribute("data-hidden")).toBe("true");
  });

  it("does not hide action bar when stream is not running", () => {
    mockIsStreamRunning = false;
    render(<AssistantMessage />);
    const actionBar = screen.getByTestId("action-bar");
    expect(actionBar.getAttribute("data-hidden")).toBe("false");
  });

  it("does not render action bar when status is incomplete with error", () => {
    mockMessageStatus = { type: "incomplete", error: "some error" };
    render(<AssistantMessage />);
    // The action bar early-returns when incomplete+error
    expect(screen.queryByTestId("action-bar")).not.toBeInTheDocument();
  });

  it("renders copy button with tooltip", () => {
    render(<AssistantMessage />);
    const tooltips = screen.getAllByTestId("tooltip-btn");
    const copyTooltip = tooltips.find(
      (el) => el.getAttribute("data-tooltip") === "CopyToClipboard"
    );
    expect(copyTooltip).toBeInTheDocument();
  });

  it("renders save button with tooltip when saveAsFile is available", () => {
    mockPlatformFile = { saveAsFile: mockSaveAsFile };
    render(<AssistantMessage />);
    const tooltips = screen.getAllByTestId("tooltip-btn");
    const saveTooltip = tooltips.find(
      (el) => el.getAttribute("data-tooltip") === "Save"
    );
    expect(saveTooltip).toBeInTheDocument();
  });

  it("hides save button when saveAsFile is not available", () => {
    mockPlatformFile = null;
    render(<AssistantMessage />);
    expect(screen.queryByTestId("icon-btn-btn-save.small")).not.toBeInTheDocument();
  });

  it("renders copied and not-copied icon states", () => {
    render(<AssistantMessage />);
    expect(screen.getByTestId("icon-btn-checked")).toBeInTheDocument();
    expect(screen.getByTestId("icon-btn-btn-copy")).toBeInTheDocument();
  });

  it("renders save icon button when saveAsFile is available", () => {
    mockPlatformFile = { saveAsFile: mockSaveAsFile };
    render(<AssistantMessage />);
    expect(screen.getByTestId("icon-btn-btn-save.small")).toBeInTheDocument();
  });

  it("renders the Regenerate (Reload) button", () => {
    render(<AssistantMessage />);
    expect(screen.getByTestId("action-reload")).toBeInTheDocument();
    const tooltips = screen.getAllByTestId("tooltip-btn");
    const regenTooltip = tooltips.find(
      (el) => el.getAttribute("data-tooltip") === "Regenerate"
    );
    expect(regenTooltip).toBeInTheDocument();
    expect(screen.getByTestId("icon-btn-btn-reset")).toBeInTheDocument();
  });

  describe("onDownload", () => {
    it("does not render the save button when platform.file is null", () => {
      mockPlatformFile = null;
      render(<AssistantMessage />);
      expect(screen.queryByTestId("icon-btn-btn-save.small")).not.toBeInTheDocument();
      expect(mockSaveAsFile).not.toHaveBeenCalled();
    });

    it("calls saveAsFile when platform.file exists", async () => {
      mockPlatformFile = { saveAsFile: mockSaveAsFile };
      mockMessages = [{ content: [{ type: "text", text: "User question" }] }];
      mockMessageParentId = "0";
      render(<AssistantMessage />);
      const saveBtn = screen.getByTestId("icon-btn-btn-save.small");
      fireEvent.click(saveBtn);
      // Wait for async
      await vi.waitFor(() => {
        expect(mockSaveAsFile).toHaveBeenCalledWith(
          "# Title\nContent",
          "Title.docx"
        );
      });
    });
  });

  describe("ThinkingMarkdownText", () => {
    it("renders text type content via the block-memoized MarkdownText", () => {
      mockMessageContent = [{ type: "text", text: "Regular text" }];
      render(<AssistantMessage />);
      const mdText = screen.getAllByTestId("markdown-text");
      expect(mdText.length).toBeGreaterThanOrEqual(1);
      expect(mdText[0].textContent).toBe("Regular text");
    });

    it("renders reasoning type content with collapsed thinking block", () => {
      mockMessageContent = [
        { type: "reasoning", text: "Thinking about stuff..." },
      ];
      render(<AssistantMessage />);
      expect(screen.getByText("Thinking")).toBeInTheDocument();
      expect(screen.getAllByTestId("icon").length).toBeGreaterThan(0);
      // Collapsed by default, no markdown content for reasoning
      expect(
        screen.queryByText("Thinking about stuff...")
      ).not.toBeInTheDocument();
    });

    it("expands reasoning block on click", () => {
      mockMessageContent = [
        { type: "reasoning", text: "Thinking about stuff..." },
      ];
      render(<AssistantMessage />);
      const thinkingLabel = screen.getByText("Thinking");
      const clickTarget = thinkingLabel.closest("[class*='cursor-pointer']")!;
      fireEvent.click(clickTarget);
      // After expanding, markdown content should show
      const mdContents = screen.getAllByTestId("markdown-content");
      const reasoningMd = mdContents.find(
        (el) => el.textContent === "Thinking about stuff..."
      );
      expect(reasoningMd).toBeInTheDocument();
    });

    it("collapses reasoning block on second click", () => {
      mockMessageContent = [
        { type: "reasoning", text: "Thinking about stuff..." },
      ];
      render(<AssistantMessage />);
      const thinkingLabel = screen.getByText("Thinking");
      const clickTarget = thinkingLabel.closest("[class*='cursor-pointer']")!;
      fireEvent.click(clickTarget);
      fireEvent.click(clickTarget);
      expect(
        screen.queryByText("Thinking about stuff...")
      ).not.toBeInTheDocument();
    });

    it("shows Loader when parentId is not set (streaming)", () => {
      mockMessageParentId = undefined as unknown as string;
      mockMessageContent = [{ type: "reasoning", text: "Thinking..." }];
      render(<AssistantMessage />);
      expect(screen.getByTestId("loader")).toBeInTheDocument();
    });

    it("shows tool.called icon when parentId is set", () => {
      mockMessageParentId = "0";
      mockMessageContent = [{ type: "reasoning", text: "Thinking..." }];
      render(<AssistantMessage />);
      const icons = screen.getAllByTestId("icon");
      const toolCalledIcon = icons.find(
        (el) => el.getAttribute("data-name") === "tool.called"
      );
      expect(toolCalledIcon).toBeInTheDocument();
    });

    it("shows arrow icon for collapsing", () => {
      mockMessageContent = [{ type: "reasoning", text: "Thinking..." }];
      render(<AssistantMessage />);
      const icons = screen.getAllByTestId("icon");
      const arrowIcon = icons.find(
        (el) => el.getAttribute("data-name") === "arrow.right"
      );
      expect(arrowIcon).toBeInTheDocument();
    });

    it("rotates arrow icon when expanded", () => {
      mockMessageContent = [{ type: "reasoning", text: "Thinking..." }];
      render(<AssistantMessage />);
      const thinkingLabel = screen.getByText("Thinking");
      const clickTarget = thinkingLabel.closest("[class*='cursor-pointer']")!;
      fireEvent.click(clickTarget);
      const icons = screen.getAllByTestId("icon");
      const arrowIcon = icons.find(
        (el) => el.getAttribute("data-name") === "arrow.right"
      );
      expect(arrowIcon?.className).toContain("rotate-90");
    });
  });

  describe("custom assistantActions", () => {
    it("renders nothing extra when assistantActions is undefined", () => {
      mockAssistantActions = undefined;
      render(<AssistantMessage />);
      // Only built-in icons: btn-copy, checked, btn-save.small
      expect(screen.queryByTestId("icon-btn-my-icon")).not.toBeInTheDocument();
    });

    it("renders a custom action button after Save", () => {
      mockAssistantActions = [
        {
          id: "translate",
          tooltip: "Translate it",
          icon: "my-icon",
          onClick: vi.fn(),
        },
      ];
      render(<AssistantMessage />);
      expect(screen.getByTestId("icon-btn-my-icon")).toBeInTheDocument();
      const tooltips = screen.getAllByTestId("tooltip-btn");
      const customTooltip = tooltips.find(
        (el) => el.getAttribute("data-tooltip") === "Translate it"
      );
      expect(customTooltip).toBeInTheDocument();
    });

    it("calls onClick with text + markdown + raw message", () => {
      const onClick = vi.fn();
      mockMessageContent = [
        { type: "text", text: "Line one" },
        { type: "text", text: "Line two" },
      ];
      mockAssistantActions = [
        { id: "a", tooltip: "T", icon: "my-icon", onClick },
      ];
      render(<AssistantMessage />);
      fireEvent.click(screen.getByTestId("icon-btn-my-icon"));
      expect(onClick).toHaveBeenCalledTimes(1);
      const arg = onClick.mock.calls[0][0];
      expect(arg.text).toBe("Line one\n\nLine two");
      expect(arg.markdown).toBe("# Title\nContent");
      expect(arg.message.content).toBe(mockMessageContent);
    });

    it("respects isVisible() — hides when it returns false", () => {
      mockAssistantActions = [
        {
          id: "a",
          tooltip: "T",
          icon: "my-icon",
          onClick: vi.fn(),
          isVisible: () => false,
        },
      ];
      render(<AssistantMessage />);
      expect(screen.queryByTestId("icon-btn-my-icon")).not.toBeInTheDocument();
    });

    it("renders multiple actions in given order", () => {
      mockAssistantActions = [
        { id: "a", tooltip: "A", icon: "icon-a", onClick: vi.fn() },
        { id: "b", tooltip: "B", icon: "icon-b", onClick: vi.fn() },
      ];
      render(<AssistantMessage />);
      expect(screen.getByTestId("icon-btn-icon-a")).toBeInTheDocument();
      expect(screen.getByTestId("icon-btn-icon-b")).toBeInTheDocument();
    });

    it("hides custom actions during streaming (via action-bar hidden)", () => {
      mockIsStreamRunning = true;
      mockAssistantActions = [
        { id: "a", tooltip: "T", icon: "my-icon", onClick: vi.fn() },
      ];
      render(<AssistantMessage />);
      const actionBar = screen.getByTestId("action-bar");
      expect(actionBar.getAttribute("data-hidden")).toBe("true");
    });

    it("does not render action bar (incl. custom actions) on incomplete+error", () => {
      mockMessageStatus = { type: "incomplete", error: "boom" };
      mockAssistantActions = [
        { id: "a", tooltip: "T", icon: "my-icon", onClick: vi.fn() },
      ];
      render(<AssistantMessage />);
      expect(screen.queryByTestId("action-bar")).not.toBeInTheDocument();
      expect(screen.queryByTestId("icon-btn-my-icon")).not.toBeInTheDocument();
    });

    it("swallows synchronous errors thrown by onClick", () => {
      const onClick = vi.fn(() => {
        throw new Error("boom");
      });
      mockAssistantActions = [
        { id: "a", tooltip: "T", icon: "my-icon", onClick },
      ];
      render(<AssistantMessage />);
      expect(() =>
        fireEvent.click(screen.getByTestId("icon-btn-my-icon"))
      ).not.toThrow();
      expect(onClick).toHaveBeenCalled();
    });

    it("does not throw when onClick returns a rejected promise", async () => {
      const onClick = vi.fn(() => Promise.reject(new Error("async boom")));
      mockAssistantActions = [
        { id: "a", tooltip: "T", icon: "my-icon", onClick },
      ];
      render(<AssistantMessage />);
      expect(() =>
        fireEvent.click(screen.getByTestId("icon-btn-my-icon"))
      ).not.toThrow();
      // Let the rejection propagate through the .catch handler
      await Promise.resolve();
      await Promise.resolve();
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("supports a React node as icon (renders custom button)", () => {
      const onClick = vi.fn();
      mockAssistantActions = [
        {
          id: "a",
          tooltip: "Custom node",
          icon: <span data-testid="custom-icon-node">★</span>,
          onClick,
        },
      ];
      render(<AssistantMessage />);
      const node = screen.getByTestId("custom-icon-node");
      expect(node).toBeInTheDocument();
      // The wrapping <button> uses tooltip as aria-label
      const btn = node.closest("button")!;
      expect(btn.getAttribute("aria-label")).toBe("Custom node");
      fireEvent.click(btn);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("renders nothing when icon is neither string nor a React element", () => {
      mockAssistantActions = [
        { id: "bad", tooltip: "T", icon: 42, onClick: vi.fn() },
      ];
      render(<AssistantMessage />);
      // Tooltip wrapper still renders, but no icon-button / no clickable child
      const tooltips = screen.getAllByTestId("tooltip-btn");
      const badTooltip = tooltips.find(
        (el) => el.getAttribute("data-tooltip") === "T"
      );
      expect(badTooltip).toBeInTheDocument();
      expect(badTooltip!.querySelector("button")).toBeNull();
    });

    it("passes the same content array reference as message.content", () => {
      const onClick = vi.fn();
      mockMessageContent = [{ type: "text", text: "ref-test" }];
      mockAssistantActions = [
        { id: "a", tooltip: "T", icon: "my-icon", onClick },
      ];
      render(<AssistantMessage />);
      fireEvent.click(screen.getByTestId("icon-btn-my-icon"));
      const arg = onClick.mock.calls[0][0];
      // identity check — consumer can mutate / inspect parts directly
      expect(arg.message.content).toBe(mockMessageContent);
    });

    it("passes empty text when content is empty array", () => {
      const onClick = vi.fn();
      mockMessageContent = [];
      mockAssistantActions = [
        { id: "a", tooltip: "T", icon: "my-icon", onClick },
      ];
      render(<AssistantMessage />);
      fireEvent.click(screen.getByTestId("icon-btn-my-icon"));
      expect(onClick.mock.calls[0][0].text).toBe("");
    });

    it("re-evaluates isVisible with current message text", () => {
      const isVisible = vi.fn(({ text }: { text: string }) =>
        text.includes("show")
      );
      mockMessageContent = [{ type: "text", text: "please show me" }];
      mockAssistantActions = [
        {
          id: "a",
          tooltip: "T",
          icon: "my-icon",
          onClick: vi.fn(),
          isVisible,
        },
      ];
      render(<AssistantMessage />);
      expect(screen.getByTestId("icon-btn-my-icon")).toBeInTheDocument();
      expect(isVisible).toHaveBeenCalled();
      const callArg = isVisible.mock.calls[0][0];
      expect(callArg.text).toBe("please show me");
    });
  });
});
