// Models frequently emit LaTeX using the `\(...\)` (inline) and `\[...\]`
// (display) delimiters instead of the `$$...$$` form that `remark-math`
// understands, so their formulas render as raw text. This normalizes the
// former into the latter. Inline math becomes `$$...$$` too, not `$...$`:
// single-dollar math is disabled in the markdown renderers (dollar amounts in
// prose would otherwise be parsed as formulas), and `remark-math` treats a
// `$$...$$` span that shares a line with other text as inline.
//
// It must run on the *raw* string before the markdown parser: CommonMark
// treats `\(`, `\)`, `\[`, `\]` as escaped punctuation and strips the
// backslash during parsing (`\(x\)` becomes the text `(x)`), so a remark
// transformer running on the parsed tree could never recover the delimiters —
// and bare `(...)` / `[...]` are far too common to rewrite safely.
//
// Fenced (```` ``` ````) and inline (`` ` ``) code spans are left untouched so
// code samples that legitimately contain these sequences are not mangled.

const CODE_SPAN = /(```[\s\S]*?```|`[^`\n]*`)/g;
const DISPLAY = /\\\[([\s\S]+?)\\\]/g;
const INLINE = /\\\(([\s\S]+?)\\\)/g;

export function normalizeMathDelimiters(text: string): string {
  // Fast path: nothing to do for the overwhelmingly common case. Keeps this
  // cheap on every streaming re-render.
  if (!text || (!text.includes("\\(") && !text.includes("\\["))) return text;

  // split() with a capturing group keeps the code spans in the result at odd
  // indices; only the even (non-code) segments are rewritten.
  return text
    .split(CODE_SPAN)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      return (
        segment
          // Display math is block-level: wrap in blank lines so `remark-math`
          // renders it as a centered block even when the model kept it inline.
          .replace(DISPLAY, (_match, body) => `\n\n$$\n${body.trim()}\n$$\n\n`)
          .replace(INLINE, (_match, body) => `$$${body.trim()}$$`)
      );
    })
    .join("");
}
