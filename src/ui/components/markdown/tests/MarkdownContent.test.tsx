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

describe("MarkdownContent links", () => {
  it("keeps a file:// target so a host can open the file", () => {
    const md = "[report](file:///C:/Users/me/ai-tools-out/report.docx)";
    const { container } = render(<MarkdownContent>{md}</MarkdownContent>);
    const anchor = container.querySelector("a");
    expect(anchor).toBeTruthy();
    expect(anchor!.getAttribute("href")).toBe(
      "file:///C:/Users/me/ai-tools-out/report.docx"
    );
    expect(anchor!.getAttribute("target")).toBe("_blank");
  });

  it("renders a link with a blanked scheme as an inert anchor", () => {
    const md =
      "[C:\\\\Users\\\\me\\\\report.docx](sandbox:/C:/Users/me/report.docx)";
    const { container } = render(<MarkdownContent>{md}</MarkdownContent>);
    const anchor = container.querySelector("a");
    expect(anchor).toBeTruthy();
    expect(anchor!.textContent).toBe("C:\\Users\\me\\report.docx");
    expect(anchor!.hasAttribute("href")).toBe(false);
    expect(anchor!.hasAttribute("target")).toBe(false);
  });

  it("still opens an https link in a new tab", () => {
    const md = "[site](https://example.com)";
    const { container } = render(<MarkdownContent>{md}</MarkdownContent>);
    const anchor = container.querySelector("a");
    expect(anchor!.getAttribute("href")).toBe("https://example.com");
    expect(anchor!.getAttribute("target")).toBe("_blank");
  });
});

describe("MarkdownContent math", () => {
  it("keeps dollar amounts in prose as plain text", async () => {
    const md =
      "revenue rising 12.2% to $4.60 million and 9% on-time; $210,000 saved";
    const { container } = render(<MarkdownContent>{md}</MarkdownContent>);
    await waitFor(() => expect(container.querySelector("p")).toBeTruthy());
    expect(container.querySelector(".katex")).toBeNull();
    expect(container.querySelector("p")!.textContent).toBe(md);
  });

  it("still renders \\(...\\) as an inline formula", async () => {
    const md = "Euler \\(e^{i\\pi}+1=0\\) done";
    const { container } = render(<MarkdownContent>{md}</MarkdownContent>);
    await waitFor(() => expect(container.querySelector(".katex")).toBeTruthy());
    expect(container.querySelector(".katex-display")).toBeNull();
    expect(container.querySelector("p")!.textContent).toContain("Euler");
  });

  it("still renders \\[...\\] as a display formula", async () => {
    const md = "\\[\\int_0^1 x^2 dx\\]";
    const { container } = render(<MarkdownContent>{md}</MarkdownContent>);
    await waitFor(() =>
      expect(container.querySelector(".katex-display")).toBeTruthy()
    );
  });
});
