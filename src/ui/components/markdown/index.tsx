"use client";

import { lazy, memo, Suspense } from "react";

const LazyMarkdownText = lazy(async () => {
  const [{ MarkdownTextPrimitive }, { default: remarkGfm }, defaultComponents] =
    await Promise.all([
      import("@assistant-ui/react-markdown"),
      import("remark-gfm"),
      import("./Markdown.utils").then((m) => m.default),
      import("@assistant-ui/react-markdown/styles/dot.css"),
    ]);
  return {
    default: () => (
      <MarkdownTextPrimitive
        remarkPlugins={[remarkGfm]}
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
    defaultComponents,
  ] = await Promise.all([
    import("react-markdown"),
    import("remark-gfm"),
    import("./Markdown.utils").then((m) => m.default),
    import("@assistant-ui/react-markdown/styles/dot.css"),
  ]);
  return {
    default: ({ children }: { children: string }) => (
      <div className="aui-md">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={defaultComponents}
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
