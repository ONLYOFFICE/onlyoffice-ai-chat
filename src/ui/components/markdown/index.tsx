"use client";

import { lazy, memo, Suspense } from "react";

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
    import("@assistant-ui/react-markdown/styles/dot.css"),
    import("katex/dist/katex.min.css"),
  ]);
  return {
    default: () => (
      <MarkdownTextPrimitive
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
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
    import("@assistant-ui/react-markdown/styles/dot.css"),
    import("katex/dist/katex.min.css"),
  ]);
  return {
    default: ({ children }: { children: string }) => (
      <div className="aui-md">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={plainComponents}
        >
          {children}
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
