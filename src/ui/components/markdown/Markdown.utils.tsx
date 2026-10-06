import {
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import {
  Children,
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn } from "../../../shared/utils";
import { SyntaxHighlighter } from "../assistant-ui/shiki-highlighter";
import CodeHeader from "./sub-components/CodeHeader";

// Text blocks carry `dir="auto"` so a mixed-language reply reads correctly
// paragraph by paragraph. Lists and tables resolve once for the container —
// per-item `dir` would scatter list markers and column alignment. Code is
// pinned LTR instead.
const defaultComponents = memoizeMarkdownComponents({
  SyntaxHighlighter,
  h1: ({ className, ...props }) => (
    <h1
      dir="auto"
      className={cn(
        "my-[8px] scroll-m-20 text-fs-28 leading-[var(--lh-36)] font-bold last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      dir="auto"
      className={cn(
        "my-[8px] scroll-m-20 text-fs-24 leading-[var(--lh-32)] font-bold first:mt-0 last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      dir="auto"
      className={cn(
        "my-[8px] scroll-m-20 text-fs-20 leading-[var(--lh-28)] font-bold first:mt-0 last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      dir="auto"
      className={cn(
        "my-[8px] scroll-m-20 text-fs-18 leading-[var(--lh-24)] font-bold first:mt-0 last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }) => (
    <h5
      dir="auto"
      className={cn(
        "my-[8px] text-fs-16 font-bold first:mt-0 last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  h6: ({ className, ...props }) => (
    <h6
      dir="auto"
      className={cn(
        "my-[8px] font-bold first:mt-0 last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      dir="auto"
      className={cn(
        "my-[8px] font-normal first:mt-0 last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  // A target the sanitizer blanked (`sandbox:`, a bare `C:/…` drive path,
  // …) must not become `<a href="" target="_blank">`: an empty href is the
  // page itself, and a host that routes popups to the OS then asks the
  // system to open the page's own URL (Bug 83951). Such a link stays an
  // anchor — its text may still be a path a host click handler can read —
  // but with no href and no target it does nothing on its own. It still
  // shows the pointer: a browser gives an href-less anchor the text cursor,
  // and the desktop host, which opens such a path on click, looked inert.
  a: ({ className, href, ...props }) => {
    const styles = cn(
      "cursor-pointer text-[var(--chat-link-color)] font-medium underline underline-offset-4",
      className
    );
    if (!href) {
      return <a className={styles} {...props} />;
    }
    return (
      <a
        className={styles}
        {...props}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      />
    );
  },
  blockquote: ({ className, ...props }) => (
    <blockquote
      dir="auto"
      // Logical border/padding: the bar follows the quote's own direction.
      className={cn("border-s-2 ps-6 italic", className)}
      {...props}
    />
  ),
  // Per-list, not per-item: a marker follows its item's direction, so a lone
  // Latin bullet in an Arabic list would jump to the other side.
  ul: ({ className, ...props }) => (
    <ul
      dir="auto"
      className={cn(
        "my-[8px] ms-6 list-disc [&>li]:mt-[4px] text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      dir="auto"
      className={cn(
        "my-[8px] ms-6 list-decimal [&>li]:mt-[4px] text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr
      className={cn(
        "my-[8px] border-b border-[var(--chat-message-divider-color)]",
        className
      )}
      {...props}
    />
  ),
  // Per-table, not per-cell — otherwise a mixed-language column alternates
  // alignment. A table ignores `overflow` on itself, so a wide one scrolls in
  // its own wrapper instead of widening the whole thread viewport.
  table: ({ className, ...props }) => (
    <div className="my-[8px] overflow-x-auto">
      <table
        dir="auto"
        className={cn(
          "w-full border-separate border-spacing-0 text-[var(--chat-message-color)]",
          className
        )}
        {...props}
      />
    </div>
  ),
  // `text-start`, not `text-left`, so it follows the table's direction; an
  // explicit GFM alignment still wins.
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "px-4 py-2 border-b border-[var(--chat-message-divider-color)] text-start text-[var(--chat-message-th-color)] font-bold [&[align=center]]:text-center [&[align=right]]:text-right",
        className
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "border-b border-[var(--chat-message-divider-color)] text-[var(--chat-message-td-color)] px-4 py-2 text-start [&[align=center]]:text-center [&[align=right]]:text-right",
        className
      )}
      {...props}
    />
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={cn(
        "m-0 border-b border-[var(--chat-message-divider-color)]",
        className
      )}
      {...props}
    />
  ),
  sup: ({ className, ...props }) => (
    <sup className={cn("[&>a]:[&>a]:no-underline", className)} {...props} />
  ),
  // Language-less fences only: assistant-ui routes a fence that declares one
  // to `SyntaxHighlighter`, which pins LTR on its own root instead.
  pre: ({ className, ...props }) => (
    <div
      dir="ltr"
      className="px-[12px] py-[8px] bg-[var(--chat-message-code-block-background-color)] rounded-[12px]"
    >
      <pre
        className={cn(
          "overflow-x-auto bg-[var(--chat-message-code-block-pre-background-color)] border border-[var(--chat-message-code-block-border-color)] rounded-[4px] p-[6px]",
          className
        )}
        {...props}
      />
    </div>
  ),
  // `dir` on an inline element also isolates it, so a `foo()` in an Arabic
  // sentence keeps its brackets instead of losing them to the surrounding run.
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        dir="ltr"
        className={cn(!isCodeBlock && "font-bold italic", className)}
        {...props}
      />
    );
  },
  CodeHeader,
});

// ---------------------------------------------------------------------------
// Plain react-markdown variant (MarkdownContent)
// ---------------------------------------------------------------------------

/**
 * Flatten a code element's children to raw text. Children may be an
 * array of strings and nested elements (e.g. mid-stream, or when a
 * plugin wraps parts of the code), so walk them defensively.
 */
const extractText = (node: ReactNode): string => {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
};

/** Stable pass-through components required by SyntaxHighlighter's props. */
const highlighterComponents = {
  Pre: (props: ComponentPropsWithoutRef<"pre">) => <pre {...props} />,
  Code: (props: ComponentPropsWithoutRef<"code">) => <code {...props} />,
};

type ElementProps<T extends "pre" | "code"> = ComponentPropsWithoutRef<T> & {
  node?: unknown;
};

/**
 * Components map for the plain `react-markdown` path ({@link MarkdownContent}).
 *
 * {@link defaultComponents} is written for assistant-ui's
 * `MarkdownTextPrimitive`: its `SyntaxHighlighter` / `CodeHeader` keys are
 * an `@assistant-ui/react-markdown` API that plain react-markdown silently
 * ignores, and its `code` renderer keys inline-vs-block off
 * `useIsMarkdownCodeBlock()`, whose context provider only
 * `MarkdownTextPrimitive` renders — under plain react-markdown the hook is
 * always false, so fenced blocks got the inline-code styling and no
 * highlighting. These `pre` / `code` overrides rebuild the same block UI
 * (CodeHeader + shiki) without any assistant-ui context.
 */
export const plainMarkdownComponents = {
  ...defaultComponents,
  pre: function PlainPre({
    className,
    children,
    node,
    ...props
  }: ElementProps<"pre">) {
    void node;
    // A fenced block's <pre> wraps exactly one <code> element, and the
    // whole block UI is produced by the `code` override below — keeping
    // the styled wrapper here would frame the block twice.
    const kids = Children.toArray(children);
    if (kids.length === 1 && isValidElement(kids[0])) {
      return <>{children}</>;
    }
    const StyledPre = defaultComponents.pre ?? "pre";
    return (
      <StyledPre className={className} {...props}>
        {children}
      </StyledPre>
    );
  },
  code: function PlainCode({
    className,
    children,
    node,
    ...props
  }: ElementProps<"code">) {
    void node;
    const match = /language-(\w+)/.exec(className ?? "");
    const text = extractText(children);
    // A block either declares a language or spans multiple lines — a
    // block's raw text keeps its trailing newline, so single-line fences
    // match too.
    if (match === null && !text.includes("\n")) {
      return (
        <code
          dir="ltr"
          className={cn("font-bold italic", className)}
          {...props}
        >
          {children}
        </code>
      );
    }
    const code = text.replace(/\n$/, "");
    const language = match?.[1] ?? "";
    // The highlighter pins LTR on its own root; the header stays out of it and
    // keeps the locale's direction.
    return (
      <>
        <CodeHeader language={language} code={code} />
        <SyntaxHighlighter
          language={language}
          code={code}
          components={highlighterComponents}
        />
      </>
    );
  },
};

export default defaultComponents;
