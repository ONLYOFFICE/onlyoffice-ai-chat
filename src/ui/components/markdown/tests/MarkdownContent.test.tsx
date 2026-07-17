// @vitest-environment jsdom
// Integration tests for the plain react-markdown path (MarkdownContent):
// real react-markdown, real plainMarkdownComponents, real shiki — only the
// UI chrome around CodeHeader is stubbed.
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@assistant-ui/react-markdown/styles/dot.css", () => ({}));
vi.mock("katex/dist/katex.min.css", () => ({}));

vi.mock("../hooks/useCopyToClipboard", () => ({
  default: () => ({ isCopied: false, copyToClipboard: vi.fn() }),
}));

vi.mock("../../../providers/ComponentsProvider", () => ({
  useComponents: () => ({
    IconButton: ({ iconName }: { iconName: string }) => (
      <span data-testid={`icon-${iconName}`}>{iconName}</span>
    ),
    TooltipIconButton: ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => (
      <button data-testid="copy-button" onClick={onClick}>
        {children}
      </button>
    ),
  }),
}));

import { MarkdownContent } from "../index";

describe("MarkdownContent code blocks", () => {
  it("renders a fenced block with a language header, copy button, and shiki output", async () => {
    const md = "```python\nprint('hi')\n```";
    const { container } = render(<MarkdownContent>{md}</MarkdownContent>);

    // CodeHeader: language label + copy button.
    expect(await screen.findByText("python")).toBeInTheDocument();
    expect(screen.getByTestId("copy-button")).toBeInTheDocument();

    // Shiki output resolves asynchronously — token spans appear once the
    // grammar/theme load finishes.
    await waitFor(
      () => {
        expect(container.querySelectorAll(".line span").length).toBeGreaterThan(
          0
        );
      },
      { timeout: 10_000 }
    );

    // A fenced block must NOT carry the inline-code styling.
    for (const code of Array.from(container.querySelectorAll("code"))) {
      expect(code.className).not.toContain("font-bold");
      expect(code.className).not.toContain("italic");
    }
  }, 15_000);

  it("renders a language-less fence as a block, not inline code", async () => {
    const md = "```\nfoo\nbar\n```";
    const { container } = render(<MarkdownContent>{md}</MarkdownContent>);

    // Still gets the block chrome (copy button; the header just shows no
    // language), and the content is present.
    expect(await screen.findByTestId("copy-button")).toBeInTheDocument();
    await waitFor(() => {
      expect(container.textContent).toContain("foo");
    });

    for (const code of Array.from(container.querySelectorAll("code"))) {
      expect(code.className).not.toContain("font-bold");
      expect(code.className).not.toContain("italic");
    }
  }, 15_000);

  it("keeps the inline-code styling for `inline code`", async () => {
    const { container } = render(
      <MarkdownContent>{"Use `foo` here"}</MarkdownContent>
    );

    const code = await waitFor(() => {
      const el = container.querySelector("code");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(code.className).toContain("font-bold");
    expect(code.className).toContain("italic");
    expect(screen.queryByTestId("copy-button")).not.toBeInTheDocument();
  });
});
