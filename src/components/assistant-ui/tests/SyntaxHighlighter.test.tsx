// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let mockUseShikiHighlighterReturn: unknown = "<highlighted />";

vi.mock("react-shiki", () => ({
  default: ({
    children,
    className,
    language,
  }: {
    children: string;
    className?: string;
    language?: string;
    theme?: unknown;
    addDefaultStyles?: boolean;
    showLanguage?: boolean;
    defaultColor?: string;
  }) => (
    <div
      data-testid="shiki-highlighter"
      data-language={language}
      className={className}
    >
      {children}
    </div>
  ),
  useShikiHighlighter: () => mockUseShikiHighlighterReturn,
}));

vi.mock("../../../lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("../styles.css", () => ({}));

import { SyntaxHighlighter } from "../shiki-highlighter";

describe("SyntaxHighlighter", () => {
  it("renders ShikiHighlighter when useShikiHighlighter returns truthy", () => {
    mockUseShikiHighlighterReturn = "<highlighted />";
    render(<SyntaxHighlighter code="const x = 1;" language="typescript" />);
    expect(screen.getByTestId("shiki-highlighter")).toBeInTheDocument();
  });

  it("passes language prop to ShikiHighlighter", () => {
    mockUseShikiHighlighterReturn = "<highlighted />";
    render(<SyntaxHighlighter code="print('hi')" language="python" />);
    expect(screen.getByTestId("shiki-highlighter")).toHaveAttribute(
      "data-language",
      "python"
    );
  });

  it("trims code whitespace", () => {
    mockUseShikiHighlighterReturn = "<highlighted />";
    render(<SyntaxHighlighter code="  const x = 1;  " language="javascript" />);
    expect(screen.getByTestId("shiki-highlighter")).toHaveTextContent(
      "const x = 1;"
    );
  });

  it("applies custom className", () => {
    mockUseShikiHighlighterReturn = "<highlighted />";
    render(
      <SyntaxHighlighter code="x" language="js" className="my-custom-class" />
    );
    const el = screen.getByTestId("shiki-highlighter");
    expect(el.className).toContain("my-custom-class");
    expect(el.className).toContain("aui-shiki-base");
  });

  it("renders fallback pre when useShikiHighlighter returns falsy", () => {
    mockUseShikiHighlighterReturn = null;
    const { container } = render(
      <SyntaxHighlighter code="  fallback code  " language="text" />
    );
    const pre = container.querySelector("pre");
    expect(pre).toBeTruthy();
    expect(pre!.textContent).toBe("fallback code");
    expect(screen.queryByTestId("shiki-highlighter")).not.toBeInTheDocument();
  });

  it("applies className to fallback pre", () => {
    mockUseShikiHighlighterReturn = null;
    const { container } = render(
      <SyntaxHighlighter code="x" language="text" className="fallback-class" />
    );
    const pre = container.querySelector("pre");
    expect(pre!.className).toContain("fallback-class");
  });

  it("has correct displayName", () => {
    expect(SyntaxHighlighter.displayName).toBe("SyntaxHighlighter");
  });
});
