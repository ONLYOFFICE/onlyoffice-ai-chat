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

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useMessageStore: () => ({
      isStreamRunning: mockIsStreamRunning,
      messages: mockMessages,
    }),
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

  it("renders message error wrapper", () => {
    render(<AssistantMessage />);
    expect(screen.getByTestId("message-error-wrapper")).toBeInTheDocument();
  });

  it("renders error root and error message", () => {
    render(<AssistantMessage />);
    expect(screen.getByTestId("error-root")).toBeInTheDocument();
    expect(screen.getByTestId("error-message")).toBeInTheDocument();
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

  it("renders save button with tooltip", () => {
    render(<AssistantMessage />);
    const tooltips = screen.getAllByTestId("tooltip-btn");
    const saveTooltip = tooltips.find(
      (el) => el.getAttribute("data-tooltip") === "Save"
    );
    expect(saveTooltip).toBeInTheDocument();
  });

  it("renders copied and not-copied icon states", () => {
    render(<AssistantMessage />);
    expect(screen.getByTestId("icon-btn-checked")).toBeInTheDocument();
    expect(screen.getByTestId("icon-btn-btn-copy")).toBeInTheDocument();
  });

  it("renders save icon button", () => {
    render(<AssistantMessage />);
    expect(screen.getByTestId("icon-btn-btn-save")).toBeInTheDocument();
  });

  describe("onDownload", () => {
    it("does nothing when platform.file is null", () => {
      mockPlatformFile = null;
      render(<AssistantMessage />);
      const saveBtn = screen.getByTestId("icon-btn-btn-save");
      fireEvent.click(saveBtn);
      expect(mockSaveAsFile).not.toHaveBeenCalled();
    });

    it("calls saveAsFile when platform.file exists", async () => {
      mockPlatformFile = { saveAsFile: mockSaveAsFile };
      mockMessages = [{ content: [{ type: "text", text: "User question" }] }];
      mockMessageParentId = "0";
      render(<AssistantMessage />);
      const saveBtn = screen.getByTestId("icon-btn-btn-save");
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
    it("renders text type content as MarkdownContent directly", () => {
      mockMessageContent = [{ type: "text", text: "Regular text" }];
      render(<AssistantMessage />);
      const mdContents = screen.getAllByTestId("markdown-content");
      expect(mdContents.length).toBeGreaterThanOrEqual(1);
      expect(mdContents[0].textContent).toBe("Regular text");
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
});
