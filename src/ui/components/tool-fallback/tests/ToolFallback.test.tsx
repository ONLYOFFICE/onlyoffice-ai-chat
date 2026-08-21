// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../../providers/ApiProvider", () => ({
  useApi: () => ({
    attachments: { get: () => Promise.resolve(null) },
  }),
}));

vi.mock("../../../tools/context", () => ({
  useToolsContext: () => ({
    servers: {
      getServerType: () => "custom",
    },
  }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useMessageStore: (selector: (s: { isToolPending: boolean }) => unknown) =>
      selector({ isToolPending: false }),
  }),
}));

vi.mock("../../icon", () => ({
  Icon: ({
    name,
  }: {
    name: string;
    size: number;
    color?: string;
    isStroke?: boolean;
    noColor?: boolean;
    width?: number;
    height?: number;
  }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

vi.mock("../../icon-button", () => ({
  IconButton: ({
    iconName,
    onClick,
  }: {
    iconName: string;
    onClick?: () => void;
    size?: number;
    disableHover?: boolean;
  }) => (
    <button data-testid={`icon-btn-${iconName}`} onClick={onClick}>
      {iconName}
    </button>
  ),
}));

vi.mock("../../loader", () => ({
  Loader: ({ size }: { size: number }) => (
    <div data-testid="loader" data-size={size}>
      Loading
    </div>
  ),
}));

const copySpy = vi.fn();
vi.mock("../../markdown/hooks/useCopyToClipboard", () => ({
  default: () => ({ isCopied: false, copyToClipboard: copySpy }),
}));

import { ToolFallback } from "../index";

const defaultProps = {
  toolName: "custom_my_tool",
  argsText: '{"query":"hello"}',
  result: undefined as unknown,
  type: "tool-call" as const,
  toolCallId: "tc-1",
  status: { type: "running" as const },
  args: { query: "hello" },
  addResult: vi.fn(),
  resume: vi.fn(),
};

describe("ToolFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders tool name (stripped of server type prefix)", () => {
    render(<ToolFallback {...defaultProps} />);
    expect(screen.getByText("my_tool")).toBeInTheDocument();
  });

  it("uses a running aiChatIntent as the chip label, keeping the card", () => {
    render(
      <ToolFallback
        {...defaultProps}
        argsText={'{"query":"hello","aiChatIntent":"Reading the file"}'}
      />
    );
    // The model's one-line description labels the chip instead of the raw
    // tool id; the card chrome itself is unchanged.
    expect(screen.getByText("Reading the file")).toBeInTheDocument();
    expect(screen.queryByText("my_tool")).not.toBeInTheDocument();
    expect(screen.getByTestId("icon-code")).toBeInTheDocument();
  });

  it("keeps the intent label once the call completes", () => {
    render(
      <ToolFallback
        {...defaultProps}
        argsText={'{"aiChatIntent":"Searching the web…"}'}
        result="done"
      />
    );
    // Done → the same label stays, the running dots give way to the toggle
    // chevron, and the ellipsis the model wrote is stripped.
    expect(screen.getByText("Searching the web")).toBeInTheDocument();
    expect(screen.getByTestId("icon-arrow.right")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-tool.called")).not.toBeInTheDocument();
  });

  it("renders the card for a call with no intent field", () => {
    const { container } = render(
      <ToolFallback {...defaultProps} argsText={'{"query":"x"}'} />
    );
    expect(screen.getByText("my_tool")).toBeInTheDocument();
    expect(container.querySelector("p")).toBeNull();
  });

  it("renders the card while the args are still streaming", () => {
    // Providers stream tool-call arguments fragment by fragment, so mid-call
    // `argsText` is an unparsable JSON prefix. The row shows regardless — the
    // intent label just replaces the tool name once the closing brace arrives.
    const { container } = render(
      <ToolFallback
        {...defaultProps}
        argsText='{"query":"hel'
        result={undefined}
      />
    );
    expect(screen.getByText(/my_tool/)).toBeInTheDocument();
    expect(container.textContent).toContain("...");
  });

  it("shows the image placeholder while generate_image args are streaming", () => {
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_generate_image"
        argsText='{"prompt":"a ca'
        result={undefined}
      />
    );
    // The placeholder is a decorative canvas — its label lives in
    // `aria-label`, not in visible text — and it sits below the card.
    expect(screen.getByLabelText("CreatingImage")).toBeInTheDocument();
    expect(screen.getByText("generate_image")).toBeInTheDocument();
  });

  it("shows running dots and no toggle while the call is in flight", () => {
    const { container } = render(<ToolFallback {...defaultProps} />);
    expect(container.textContent).toContain("...");
    expect(screen.queryByTestId("icon-arrow.right")).not.toBeInTheDocument();
  });

  it("swaps the dots for the toggle once the result arrives", () => {
    const { container } = render(
      <ToolFallback {...defaultProps} result="done" />
    );
    expect(screen.getByTestId("icon-arrow.right")).toBeInTheDocument();
    expect(container.textContent).not.toContain("...");
    // No success tick — the chevron is the only "finished" signal.
    expect(screen.queryByTestId("icon-tool.called")).not.toBeInTheDocument();
  });

  it("toggles collapse on click", () => {
    render(<ToolFallback {...defaultProps} result="some result" />);
    expect(screen.queryByText("ToolCallArguments")).not.toBeInTheDocument();

    const clickable = screen
      .getByText("my_tool")
      .closest("[class*='cursor-pointer']")!;
    fireEvent.click(clickable);
    expect(screen.getByText("ToolCallArguments")).toBeInTheDocument();
    expect(screen.getByText("ToolCallResult")).toBeInTheDocument();

    fireEvent.click(clickable);
    expect(screen.queryByText("ToolCallArguments")).not.toBeInTheDocument();
  });

  it("shows args text when expanded", () => {
    render(<ToolFallback {...defaultProps} result="result text" />);
    fireEvent.click(
      screen.getByText("my_tool").closest("[class*='cursor-pointer']")!
    );
    expect(screen.getByText('{"query":"hello"}')).toBeInTheDocument();
  });

  it("shows result when expanded and result is a string", () => {
    render(<ToolFallback {...defaultProps} result="result text" />);
    fireEvent.click(
      screen.getByText("my_tool").closest("[class*='cursor-pointer']")!
    );
    expect(screen.getByText("result text")).toBeInTheDocument();
  });

  it("renders arrow icon for collapsible state", () => {
    render(<ToolFallback {...defaultProps} result="done" />);
    expect(screen.getByTestId("icon-arrow.right")).toBeInTheDocument();
  });

  it("renders arrow.bottom icon when expanded", () => {
    render(<ToolFallback {...defaultProps} result="done" />);
    fireEvent.click(
      screen.getByText("my_tool").closest("[class*='cursor-pointer']")!
    );
    expect(screen.getByTestId("icon-arrow.bottom")).toBeInTheDocument();
  });

  it("renders code icon for non-web-search tools", () => {
    render(<ToolFallback {...defaultProps} />);
    expect(screen.getByTestId("icon-code")).toBeInTheDocument();
  });

  it("shows error icon when result has error", () => {
    const errorResult = JSON.stringify({
      data: { error: "Something went wrong" },
    });
    render(<ToolFallback {...defaultProps} result={errorResult} />);
    expect(screen.getByTestId("icon-status.error")).toBeInTheDocument();
  });

  it("renders web_search tool with search icon and query", () => {
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_search"
        argsText='{"query":"test query"}'
      />
    );
    expect(screen.getByTestId("icon-btn-web-search")).toBeInTheDocument();
    expect(screen.getByText("test query")).toBeInTheDocument();
  });

  it("does not show arrow for web_search when loading", () => {
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_search"
        argsText='{"query":"test query"}'
        result={undefined}
      />
    );
    expect(screen.queryByTestId("icon-arrow.right")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-arrow.bottom")).not.toBeInTheDocument();
  });

  it("renders web_crawling tool with external link icon", () => {
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_crawling"
        argsText='{"urls":["https://example.com"]}'
        result="done"
      />
    );
    expect(screen.getByTestId("icon-btn-external")).toBeInTheDocument();
  });

  it("opens URL in new tab when web_crawling is clicked", () => {
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_crawling"
        argsText='{"urls":["https://example.com"]}'
        result="done"
      />
    );
    const clickable = screen
      .getByText(/web_crawling/)
      .closest("[class*='cursor-pointer']")!;
    fireEvent.click(clickable);
    expect(windowOpen).toHaveBeenCalledWith("https://example.com", "_blank");
    windowOpen.mockRestore();
  });

  it("shows empty args as {} when argsText is empty", () => {
    render(<ToolFallback {...defaultProps} argsText="" result="result" />);
    fireEvent.click(
      screen.getByText("my_tool").closest("[class*='cursor-pointer']")!
    );
    expect(screen.getByText("{}")).toBeInTheDocument();
  });

  it("handles nested args with .args property", () => {
    render(
      <ToolFallback
        {...defaultProps}
        argsText='{"args":{"nested":"value"}}'
        result="result"
      />
    );
    fireEvent.click(
      screen.getByText("my_tool").closest("[class*='cursor-pointer']")!
    );
    expect(screen.getByText('{"nested":"value"}')).toBeInTheDocument();
  });

  it("shows web search results as clickable items", () => {
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    const searchResult = JSON.stringify({
      data: [
        {
          id: "r1",
          title: "Result One",
          url: "https://result1.com",
        },
        {
          id: "r2",
          title: "Result Two",
          url: "https://result2.com",
        },
      ],
    });
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_search"
        argsText='{"query":"test"}'
        result={searchResult}
      />
    );
    // Expand
    fireEvent.click(
      screen.getByText("test").closest("[class*='cursor-pointer']")!
    );
    expect(screen.getByText("Result One")).toBeInTheDocument();
    expect(screen.getByText("Result Two")).toBeInTheDocument();

    // Click a result to open URL
    fireEvent.click(screen.getByText("Result One"));
    expect(windowOpen).toHaveBeenCalledWith("https://result1.com", "_blank");
    windowOpen.mockRestore();
  });

  it("shows error in web search result when error is present", () => {
    const errorResult = JSON.stringify({
      data: { error: "Search failed" },
    });
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_search"
        argsText='{"query":"test"}'
        result={errorResult}
      />
    );
    fireEvent.click(
      screen.getByText("test").closest("[class*='cursor-pointer']")!
    );
    expect(screen.getByText("Search failed")).toBeInTheDocument();
  });

  it("shows raw result for web search when no data array", () => {
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_search"
        argsText='{"query":"test"}'
        result="raw string result"
      />
    );
    fireEvent.click(
      screen.getByText("test").closest("[class*='cursor-pointer']")!
    );
    expect(screen.getByText("raw string result")).toBeInTheDocument();
  });

  it("does not show args section for web_search when expanded", () => {
    const searchResult = JSON.stringify({
      data: [{ id: "r1", title: "Result", url: "https://r.com" }],
    });
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_search"
        argsText='{"query":"test"}'
        result={searchResult}
      />
    );
    fireEvent.click(
      screen.getByText("test").closest("[class*='cursor-pointer']")!
    );
    expect(screen.queryByText("ToolCallArguments")).not.toBeInTheDocument();
  });

  it("shows copy buttons for args and result when expanded", () => {
    render(<ToolFallback {...defaultProps} result="done" />);
    fireEvent.click(
      screen.getByText("my_tool").closest("[class*='cursor-pointer']")!
    );
    const copyIcons = screen.getAllByTestId("icon-btn-copy");
    expect(copyIcons).toHaveLength(2);
  });

  it("shows web search with arrow when result is loaded", () => {
    const searchResult = JSON.stringify({ data: [] });
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_search"
        argsText='{"query":"test"}'
        result={searchResult}
      />
    );
    expect(screen.getByTestId("icon-arrow.right")).toBeInTheDocument();
  });

  it("shows empty web search results as raw JSON", () => {
    const searchResult = JSON.stringify({ data: [] });
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_search"
        argsText='{"query":"test"}'
        result={searchResult}
      />
    );
    fireEvent.click(
      screen.getByText("test").closest("[class*='cursor-pointer']")!
    );
    // Empty array results should render as pre with the raw string
    expect(screen.getByText(searchResult)).toBeInTheDocument();
  });

  it("handles non-JSON result string for web search gracefully", () => {
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_search"
        argsText='{"query":"test"}'
        result="not valid json at all"
      />
    );
    fireEvent.click(
      screen.getByText("test").closest("[class*='cursor-pointer']")!
    );
    expect(screen.getByText("not valid json at all")).toBeInTheDocument();
  });

  it("handles invalid argsText gracefully", () => {
    render(
      <ToolFallback {...defaultProps} argsText="not json" result="result" />
    );
    fireEvent.click(
      screen.getByText("my_tool").closest("[class*='cursor-pointer']")!
    );
    expect(screen.getByText("not json")).toBeInTheDocument();
  });

  it("stringifies object result in non-web-search tool", () => {
    const objResult = { foo: "bar" };
    render(<ToolFallback {...defaultProps} result={objResult} />);
    fireEvent.click(
      screen.getByText("my_tool").closest("[class*='cursor-pointer']")!
    );
    // The result is JSON.stringify'd with indentation, rendered in a <pre>
    const preElements = document.querySelectorAll("pre");
    const resultPre = Array.from(preElements).find((el) =>
      el.textContent?.includes('"foo"')
    );
    expect(resultPre).toBeTruthy();
    expect(resultPre?.textContent).toContain('"bar"');
  });

  it("renders web_crawling name with pipe separator", () => {
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_crawling"
        argsText='{"urls":["https://example.com"]}'
        result="done"
      />
    );
    expect(
      screen.getByText("web_crawling | https://example.com")
    ).toBeInTheDocument();
  });

  it("clicking args copy icon copies the args text to the clipboard", () => {
    copySpy.mockClear();
    render(<ToolFallback {...defaultProps} result="done" />);
    fireEvent.click(
      screen.getByText("my_tool").closest("[class*='cursor-pointer']")!
    );
    const copySpans = document.querySelectorAll("span.cursor-pointer");
    fireEvent.click(copySpans[0]);
    expect(copySpy).toHaveBeenCalledWith('{"query":"hello"}');
  });

  it("clicking result copy icon copies the result to the clipboard", () => {
    copySpy.mockClear();
    render(<ToolFallback {...defaultProps} result="done" />);
    fireEvent.click(
      screen.getByText("my_tool").closest("[class*='cursor-pointer']")!
    );
    const copySpans = document.querySelectorAll("span.cursor-pointer");
    fireEvent.click(copySpans[1]);
    expect(copySpy).toHaveBeenCalledWith("done");
  });

  it("does not expand when web_search is still loading", () => {
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_search"
        argsText='{"query":"test"}'
        result={undefined}
      />
    );
    fireEvent.click(screen.getByText("test").parentElement!);
    // Should stay collapsed — a running call shows no toggle at all
    expect(screen.queryByText("ToolCallArguments")).not.toBeInTheDocument();
  });

  it("handles web search result that is a non-JSON string gracefully via catch block", () => {
    // This triggers the catch block in the web search rendering IIFE
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_search"
        argsText='{"query":"test"}'
        result={"not-json-at-all"}
      />
    );
    fireEvent.click(
      screen.getByText("test").closest("[class*='cursor-pointer']")!
    );
    expect(screen.getByText("not-json-at-all")).toBeInTheDocument();
  });

  it("renders web search error result with string type", () => {
    // When parsedResult?.data?.error exists but parsedResult is a string
    const errorResult = JSON.stringify({ data: { error: "API Error" } });
    render(
      <ToolFallback
        {...defaultProps}
        toolName="custom_web_search"
        argsText='{"query":"test"}'
        result={errorResult}
      />
    );
    fireEvent.click(
      screen.getByText("test").closest("[class*='cursor-pointer']")!
    );
    expect(screen.getByText("API Error")).toBeInTheDocument();
  });
});
