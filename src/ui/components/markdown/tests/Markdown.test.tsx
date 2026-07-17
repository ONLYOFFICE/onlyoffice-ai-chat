// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@assistant-ui/react-markdown/styles/dot.css", () => ({}));
vi.mock("katex/dist/katex.min.css", () => ({}));

vi.mock("@assistant-ui/react-markdown", () => ({
  MarkdownTextPrimitive: ({
    className,
    remarkPlugins,
    rehypePlugins,
  }: {
    className?: string;
    remarkPlugins?: unknown[];
    rehypePlugins?: unknown[];
    components?: unknown;
  }) => (
    <div
      data-testid="markdown-text-primitive"
      className={className}
      data-remark-count={remarkPlugins?.length}
      data-rehype-count={rehypePlugins?.length}
    />
  ),
  unstable_memoizeMarkdownComponents: (components: Record<string, unknown>) =>
    components,
  useIsMarkdownCodeBlock: () => false,
}));

vi.mock("react-markdown", () => ({
  default: ({
    children,
    className,
  }: {
    children?: string;
    className?: string;
    remarkPlugins?: unknown[];
    components?: unknown;
  }) => (
    <div data-testid="react-markdown" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("remark-gfm", () => ({
  default: {},
}));

vi.mock("remark-math", () => ({
  default: {},
}));

vi.mock("rehype-katex", () => ({
  default: {},
}));

vi.mock("../Markdown.utils", () => ({
  default: {},
  plainMarkdownComponents: {},
}));

vi.mock("../../assistant-ui/shiki-highlighter", () => ({
  SyntaxHighlighter: () => <div />,
}));

vi.mock("../sub-components/CodeHeader", () => ({
  default: () => <div />,
}));

vi.mock("../../../../shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { MarkdownText, MarkdownContent } from "../index";

describe("MarkdownText", () => {
  it("renders without crashing", async () => {
    render(<MarkdownText />);
    expect(
      await screen.findByTestId("markdown-text-primitive")
    ).toBeInTheDocument();
  });

  it("passes aui-md className", async () => {
    render(<MarkdownText />);
    expect(await screen.findByTestId("markdown-text-primitive")).toHaveClass(
      "aui-md"
    );
  });

  it("wires math plugins (gfm + math remark, katex rehype)", async () => {
    render(<MarkdownText />);
    const el = await screen.findByTestId("markdown-text-primitive");
    expect(el).toHaveAttribute("data-remark-count", "2");
    expect(el).toHaveAttribute("data-rehype-count", "1");
  });
});

describe("MarkdownContent", () => {
  it("renders without crashing", async () => {
    render(<MarkdownContent>Hello world</MarkdownContent>);
    expect(await screen.findByTestId("react-markdown")).toBeInTheDocument();
  });

  it("passes children to ReactMarkdown", async () => {
    render(<MarkdownContent>Some **markdown** text</MarkdownContent>);
    expect(await screen.findByTestId("react-markdown")).toHaveTextContent(
      "Some **markdown** text"
    );
  });

  it("wraps content in div with aui-md class", async () => {
    render(<MarkdownContent>Test</MarkdownContent>);
    const reactMarkdown = await screen.findByTestId("react-markdown");
    const wrapper = reactMarkdown.parentElement as HTMLElement;
    expect(wrapper.className).toContain("aui-md");
  });
});
