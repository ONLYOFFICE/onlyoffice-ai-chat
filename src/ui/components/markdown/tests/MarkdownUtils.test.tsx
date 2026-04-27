// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

vi.mock("@assistant-ui/react-markdown/styles/dot.css", () => ({}));

vi.mock("@assistant-ui/react-markdown", () => ({
  unstable_memoizeMarkdownComponents: (components: Record<string, unknown>) =>
    components,
  useIsMarkdownCodeBlock: () => false,
}));

vi.mock("../../assistant-ui/shiki-highlighter", () => ({
  SyntaxHighlighter: () => <div data-testid="syntax-highlighter" />,
}));

vi.mock("../sub-components/CodeHeader", () => ({
  default: () => <div data-testid="code-header" />,
}));

vi.mock("../../../../shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import defaultComponents from "../Markdown.utils";

describe("defaultComponents", () => {
  const expectedKeys = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "a",
    "blockquote",
    "ul",
    "ol",
    "hr",
    "table",
    "th",
    "td",
    "tr",
    "sup",
    "pre",
    "code",
    "CodeHeader",
    "SyntaxHighlighter",
  ];

  it("exports all expected component keys", () => {
    for (const key of expectedKeys) {
      expect(defaultComponents).toHaveProperty(key);
    }
  });

  it("renders h1 with correct tag", () => {
    const H1 = defaultComponents.h1 as React.FC<
      React.HTMLAttributes<HTMLHeadingElement>
    >;
    const { container } = render(<H1>Title</H1>);
    const el = container.querySelector("h1");
    expect(el).toBeTruthy();
    expect(el!.textContent).toBe("Title");
  });

  it("renders h2 with correct tag", () => {
    const H2 = defaultComponents.h2 as React.FC<
      React.HTMLAttributes<HTMLHeadingElement>
    >;
    const { container } = render(<H2>Subtitle</H2>);
    expect(container.querySelector("h2")).toBeTruthy();
  });

  it("renders h3 with correct tag", () => {
    const H3 = defaultComponents.h3 as React.FC<
      React.HTMLAttributes<HTMLHeadingElement>
    >;
    const { container } = render(<H3>Heading 3</H3>);
    expect(container.querySelector("h3")).toBeTruthy();
  });

  it("renders h4 with correct tag", () => {
    const H4 = defaultComponents.h4 as React.FC<
      React.HTMLAttributes<HTMLHeadingElement>
    >;
    const { container } = render(<H4>Heading 4</H4>);
    expect(container.querySelector("h4")).toBeTruthy();
  });

  it("renders h5 with correct tag", () => {
    const H5 = defaultComponents.h5 as React.FC<
      React.HTMLAttributes<HTMLHeadingElement>
    >;
    const { container } = render(<H5>Heading 5</H5>);
    expect(container.querySelector("h5")).toBeTruthy();
  });

  it("renders h6 with correct tag", () => {
    const H6 = defaultComponents.h6 as React.FC<
      React.HTMLAttributes<HTMLHeadingElement>
    >;
    const { container } = render(<H6>Heading 6</H6>);
    expect(container.querySelector("h6")).toBeTruthy();
  });

  it("renders a link with target=_blank", () => {
    const A = defaultComponents.a as React.FC<
      React.AnchorHTMLAttributes<HTMLAnchorElement>
    >;
    const { container } = render(<A href="https://example.com">Link</A>);
    const anchor = container.querySelector("a");
    expect(anchor).toBeTruthy();
    expect(anchor!.getAttribute("target")).toBe("_blank");
    expect(anchor!.getAttribute("href")).toBe("https://example.com");
  });

  it("renders ul as unordered list", () => {
    const UL = defaultComponents.ul as React.FC<
      React.HTMLAttributes<HTMLUListElement>
    >;
    const { container } = render(<UL />);
    expect(container.querySelector("ul")).toBeTruthy();
  });

  it("renders ol as ordered list", () => {
    const OL = defaultComponents.ol as React.FC<
      React.HTMLAttributes<HTMLOListElement>
    >;
    const { container } = render(<OL />);
    expect(container.querySelector("ol")).toBeTruthy();
  });

  it("renders blockquote element", () => {
    const BQ = defaultComponents.blockquote as React.FC<
      React.HTMLAttributes<HTMLQuoteElement>
    >;
    const { container } = render(<BQ>Quote</BQ>);
    expect(container.querySelector("blockquote")).toBeTruthy();
  });

  it("renders table element", () => {
    const Table = defaultComponents.table as React.FC<
      React.HTMLAttributes<HTMLTableElement>
    >;
    const { container } = render(<Table />);
    expect(container.querySelector("table")).toBeTruthy();
  });

  it("renders th element", () => {
    const TH = defaultComponents.th as React.FC<
      React.HTMLAttributes<HTMLTableCellElement>
    >;
    const { container } = render(
      <table>
        <thead>
          <tr>
            <TH>Header</TH>
          </tr>
        </thead>
      </table>
    );
    expect(container.querySelector("th")).toBeTruthy();
  });

  it("renders td element", () => {
    const TD = defaultComponents.td as React.FC<
      React.HTMLAttributes<HTMLTableCellElement>
    >;
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <TD>Cell</TD>
          </tr>
        </tbody>
      </table>
    );
    expect(container.querySelector("td")).toBeTruthy();
  });

  it("renders tr element", () => {
    const TR = defaultComponents.tr as React.FC<
      React.HTMLAttributes<HTMLTableRowElement>
    >;
    const { container } = render(
      <table>
        <tbody>
          <TR>
            <td>Cell</td>
          </TR>
        </tbody>
      </table>
    );
    expect(container.querySelector("tr")).toBeTruthy();
  });

  it("renders pre inside wrapper div", () => {
    const Pre = defaultComponents.pre as React.FC<
      React.HTMLAttributes<HTMLPreElement>
    >;
    const { container } = render(<Pre>code content</Pre>);
    expect(container.querySelector("pre")).toBeTruthy();
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("renders code element", () => {
    const Code = defaultComponents.code as React.FC<
      React.HTMLAttributes<HTMLElement>
    >;
    const { container } = render(<Code>inline code</Code>);
    expect(container.querySelector("code")).toBeTruthy();
  });

  it("renders p element", () => {
    const P = defaultComponents.p as React.FC<
      React.HTMLAttributes<HTMLParagraphElement>
    >;
    const { container } = render(<P>paragraph</P>);
    expect(container.querySelector("p")).toBeTruthy();
  });

  it("applies custom className to h1", () => {
    const H1 = defaultComponents.h1 as React.FC<
      React.HTMLAttributes<HTMLHeadingElement>
    >;
    const { container } = render(<H1 className="custom">Title</H1>);
    const el = container.querySelector("h1");
    expect(el!.className).toContain("custom");
  });

  it("renders hr element", () => {
    const HR = defaultComponents.hr as React.FC<
      React.HTMLAttributes<HTMLHRElement>
    >;
    const { container } = render(<HR />);
    expect(container.querySelector("hr")).toBeTruthy();
  });

  it("renders sup element", () => {
    const Sup = defaultComponents.sup as React.FC<
      React.HTMLAttributes<HTMLElement>
    >;
    const { container } = render(<Sup>1</Sup>);
    expect(container.querySelector("sup")).toBeTruthy();
  });
});
