// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@assistant-ui/react-markdown/styles/dot.css", () => ({}));

vi.mock("@assistant-ui/react-markdown", () => ({
  MarkdownTextPrimitive: ({
    className,
  }: {
    className?: string;
    remarkPlugins?: unknown[];
    components?: unknown;
  }) => <div data-testid="markdown-text-primitive" className={className} />,
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

vi.mock("../Markdown.utils", () => ({
  default: {},
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
  it("renders without crashing", () => {
    render(<MarkdownText />);
    expect(screen.getByTestId("markdown-text-primitive")).toBeInTheDocument();
  });

  it("passes aui-md className", () => {
    render(<MarkdownText />);
    expect(screen.getByTestId("markdown-text-primitive")).toHaveClass("aui-md");
  });
});

describe("MarkdownContent", () => {
  it("renders without crashing", () => {
    render(<MarkdownContent>Hello world</MarkdownContent>);
    expect(screen.getByTestId("react-markdown")).toBeInTheDocument();
  });

  it("passes children to ReactMarkdown", () => {
    render(<MarkdownContent>Some **markdown** text</MarkdownContent>);
    expect(screen.getByTestId("react-markdown")).toHaveTextContent(
      "Some **markdown** text"
    );
  });

  it("wraps content in div with aui-md class", () => {
    const { container } = render(<MarkdownContent>Test</MarkdownContent>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("aui-md");
  });
});
