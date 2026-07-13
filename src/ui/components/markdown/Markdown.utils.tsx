import "@assistant-ui/react-markdown/styles/dot.css";

import {
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import { cn } from "../../../shared/utils";
import { SyntaxHighlighter } from "../assistant-ui/shiki-highlighter";
import CodeHeader from "./sub-components/CodeHeader";

const defaultComponents = memoizeMarkdownComponents({
  SyntaxHighlighter,
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        "my-[8px] scroll-m-20 text-fs-28 leading-[var(--lh-36)] font-bold last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "my-[8px] scroll-m-20 text-fs-24 leading-[var(--lh-32)] font-bold first:mt-0 last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn(
        "my-[8px] scroll-m-20 text-fs-20 leading-[var(--lh-28)] font-bold first:mt-0 last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={cn(
        "my-[8px] scroll-m-20 text-fs-18 leading-[var(--lh-24)] font-bold first:mt-0 last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }) => (
    <h5
      className={cn(
        "my-[8px] text-fs-16 font-bold first:mt-0 last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  h6: ({ className, ...props }) => (
    <h6
      className={cn(
        "my-[8px] font-bold first:mt-0 last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn(
        "my-[8px] font-normal first:mt-0 last:mb-0 text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "text-[var(--chat-link-color)] font-medium underline underline-offset-4",
        className
      )}
      {...props}
      target="_blank"
      rel="noopener noreferrer"
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn("border-l-2 pl-6 italic", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "my-[8px] ms-6 list-disc [&>li]:mt-[4px] text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
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
  table: ({ className, ...props }) => (
    <table
      className={cn(
        "my-[8px] w-full border-separate border-spacing-0 overflow-y-auto text-[var(--chat-message-color)]",
        className
      )}
      {...props}
    />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "px-4 py-2 border-b border-[var(--chat-message-divider-color)] text-left text-[var(--chat-message-th-color)] font-bold [&[align=center]]:text-center [&[align=right]]:text-right",
        className
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "border-b border-[var(--chat-message-divider-color)] text-[var(--chat-message-td-color)] px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right",
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
  pre: ({ className, ...props }) => (
    <div className="px-[12px] py-[8px] bg-[var(--chat-message-code-block-background-color)] rounded-[12px]">
      <pre
        className={cn(
          "overflow-x-auto bg-[var(--chat-message-code-block-pre-background-color)] border border-[var(--chat-message-code-block-border-color)] rounded-[4px] p-[6px]",
          className
        )}
        {...props}
      />
    </div>
  ),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        className={cn(!isCodeBlock && "font-bold italic", className)}
        {...props}
      />
    );
  },
  CodeHeader,
});

export default defaultComponents;
