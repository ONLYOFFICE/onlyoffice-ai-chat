"use client";

import { lazy, memo, Suspense } from "react";

// Markdown / KaTeX stylesheets are imported *statically* here, not inside the
// lazy Promise.all blocks below, on purpose. As peer dependencies their CSS is
// external, so a dynamic `import(".../dot.css")` ships to consumers as a
// code-split chunk that the consumer's bundler (Vite) guards with
// `__vitePreload`. That helper injects a <link> and rejects if it fails to
// load — a single 404 on the CSS asset then propagates through this lazy
// markdown Suspense boundary and crashes rendering (observed on send /
// open-from-history). A static import is bundled into the consumer's main
// stylesheet and loaded via a plain <link>, which can't tear down rendering.
// This module is imported statically by the chat message components, so the
// CSS loads eagerly with the chat UI; only the heavy JS below stays lazy.
import "@assistant-ui/react-markdown/styles/dot.css";
import "katex/dist/katex.min.css";

import { normalizeMathDelimiters } from "./normalize-math";
import { markdownUrlTransform } from "./url-transform";

// Single-dollar inline math is off: model prose is full of money ("$4.60
// million to $5.1 million") and `remark-math` would hand the span between two
// amounts to KaTeX, which renders it in italic math font, collapses spaces and
// drops everything after a `%` as a TeX comment. Inline formulas still work:
// `normalizeMathDelimiters` rewrites `\(...\)` to `$$...$$`, which stays
// inline when it does not sit on its own line.
const remarkMathOptions = { singleDollarTextMath: false };

const LazyMarkdownText = lazy(async () => {
  const [
    { MarkdownTextPrimitive },
    { default: remarkGfm },
    { default: remarkMath },
    { default: rehypeKatex },
    defaultComponents,
  ] = await Promise.all([
    import("@assistant-ui/react-markdown"),
    import("remark-gfm"),
    import("remark-math"),
    import("rehype-katex"),
    import("./Markdown.utils").then((m) => m.default),
  ]);
  return {
    default: () => (
      <MarkdownTextPrimitive
        preprocess={normalizeMathDelimiters}
        remarkPlugins={[remarkGfm, [remarkMath, remarkMathOptions]]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={markdownUrlTransform}
        className="aui-md"
        components={defaultComponents}
      />
    ),
  };
});

const LazyMarkdownContent = lazy(async () => {
  const [
    { default: ReactMarkdown },
    { default: remarkGfm },
    { default: remarkMath },
    { default: rehypeKatex },
    // Not `defaultComponents`: that map relies on assistant-ui context
    // (PreContext / special SyntaxHighlighter and CodeHeader keys) that
    // plain react-markdown never provides — code blocks would render as
    // unhighlighted inline code.
    plainComponents,
  ] = await Promise.all([
    import("react-markdown"),
    import("remark-gfm"),
    import("remark-math"),
    import("rehype-katex"),
    import("./Markdown.utils").then((m) => m.plainMarkdownComponents),
  ]);
  return {
    default: ({ children }: { children: string }) => (
      <div className="aui-md">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, [remarkMath, remarkMathOptions]]}
          rehypePlugins={[rehypeKatex]}
          urlTransform={markdownUrlTransform}
          components={plainComponents}
        >
          {normalizeMathDelimiters(children)}
        </ReactMarkdown>
      </div>
    ),
  };
});

const MarkdownTextImpl = () => {
  if (typeof document === "undefined") return null;
  return (
    <Suspense fallback={null}>
      <LazyMarkdownText />
    </Suspense>
  );
};

const MarkdownContentImpl = ({ children }: { children: string }) => {
  if (typeof document === "undefined") return null;
  return (
    <Suspense fallback={null}>
      <LazyMarkdownContent>{children}</LazyMarkdownContent>
    </Suspense>
  );
};

export const MarkdownText = memo(MarkdownTextImpl);
export const MarkdownContent = memo(MarkdownContentImpl);
