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

import defaultComponents, { plainMarkdownComponents } from "../Markdown.utils";

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

  it("renders a link without an href as an inert anchor", () => {
    const A = defaultComponents.a as React.FC<
      React.AnchorHTMLAttributes<HTMLAnchorElement>
    >;
    const { container } = render(<A href="">C:\\Users\\me\\report.docx</A>);
    const anchor = container.querySelector("a");
    expect(anchor).toBeTruthy();
    expect(anchor!.hasAttribute("href")).toBe(false);
    expect(anchor!.hasAttribute("target")).toBe(false);
    expect(anchor!.hasAttribute("rel")).toBe(false);
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

describe("plainMarkdownComponents", () => {
  type CodeProps = React.HTMLAttributes<HTMLElement> & {
    children?: React.ReactNode;
  };
  const PlainCode = plainMarkdownComponents.code as React.FC<CodeProps>;
  const PlainPre = plainMarkdownComponents.pre as React.FC<CodeProps>;

  it("overrides only pre and code, sharing every other renderer", () => {
    // The object-spread type keeps only the overridden keys statically —
    // read the inherited ones through a plain record view.
    const plain = plainMarkdownComponents as unknown as Record<string, unknown>;
    expect(plainMarkdownComponents.pre).not.toBe(defaultComponents.pre);
    expect(plainMarkdownComponents.code).not.toBe(defaultComponents.code);
    expect(plain.h1).toBe(defaultComponents.h1);
    expect(plain.a).toBe(defaultComponents.a);
    expect(plain.table).toBe(defaultComponents.table);
  });

  it("renders a language-classed code as CodeHeader + SyntaxHighlighter", () => {
    const { container } = render(
      <PlainCode className="language-js">{"const a = 1;\n"}</PlainCode>
    );
    expect(container.querySelector("[data-testid='code-header']")).toBeTruthy();
    expect(
      container.querySelector("[data-testid='syntax-highlighter']")
    ).toBeTruthy();
    expect(container.querySelector("code")).toBeNull();
  });

  it("renders multiline content as a block even without a language class", () => {
    const { container } = render(<PlainCode>{"foo\nbar\n"}</PlainCode>);
    expect(
      container.querySelector("[data-testid='syntax-highlighter']")
    ).toBeTruthy();
  });

  it("joins array children (streaming) when extracting block text", () => {
    const { container } = render(
      <PlainCode className="language-py">{["print(", "'hi')\n"]}</PlainCode>
    );
    expect(
      container.querySelector("[data-testid='syntax-highlighter']")
    ).toBeTruthy();
  });

  it("keeps inline code inline with font-bold italic", () => {
    const { container } = render(<PlainCode>{"x"}</PlainCode>);
    const code = container.querySelector("code");
    expect(code).toBeTruthy();
    expect(code!.className).toContain("font-bold italic");
  });

  it("pre unwraps a single element child (the block UI owns the markup)", () => {
    const { container } = render(
      <PlainPre>
        <code>x</code>
      </PlainPre>
    );
    expect(container.querySelector("pre")).toBeNull();
    expect(container.querySelector("code")).toBeTruthy();
  });

  it("pre keeps the styled wrapper for plain-text children", () => {
    const { container } = render(<PlainPre>{"raw text"}</PlainPre>);
    expect(container.querySelector("pre")).toBeTruthy();
  });
});
