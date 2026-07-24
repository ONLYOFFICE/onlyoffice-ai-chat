import { describe, expect, it } from "vitest";

import { normalizeMathDelimiters } from "../normalize-math";

describe("normalizeMathDelimiters", () => {
  it("converts inline \\(...\\) to $...$", () => {
    expect(normalizeMathDelimiters("Euler \\(e^{i\\pi}+1=0\\) done")).toBe(
      "Euler $e^{i\\pi}+1=0$ done"
    );
  });

  it("trims inline whitespace inside the delimiters", () => {
    expect(normalizeMathDelimiters("val \\( x^2 \\) end")).toBe(
      "val $x^2$ end"
    );
  });

  it("converts display \\[...\\] to a block $$...$$", () => {
    expect(normalizeMathDelimiters("\\[\\int_0^1 x^2 dx\\]")).toBe(
      "\n\n$$\n\\int_0^1 x^2 dx\n$$\n\n"
    );
  });

  it("handles multiple math spans in one string", () => {
    expect(normalizeMathDelimiters("\\(a\\) and \\(b\\)")).toBe("$a$ and $b$");
  });

  it("leaves fenced code blocks untouched", () => {
    const src = "```js\nconst a = f\\(x\\);\n```";
    expect(normalizeMathDelimiters(src)).toBe(src);
  });

  it("leaves inline code spans untouched", () => {
    const src = "use `\\(x\\)` literally";
    expect(normalizeMathDelimiters(src)).toBe(src);
  });

  it("rewrites math outside a code span but not inside it", () => {
    expect(normalizeMathDelimiters("\\(a\\) `\\(b\\)` \\(c\\)")).toBe(
      "$a$ `\\(b\\)` $c$"
    );
  });

  it("leaves $...$ / $$...$$ and plain text unchanged", () => {
    expect(normalizeMathDelimiters("keep $a+b$ and $$c$$ working")).toBe(
      "keep $a+b$ and $$c$$ working"
    );
    expect(normalizeMathDelimiters("no math here (just parens)")).toBe(
      "no math here (just parens)"
    );
  });

  it("does not convert an unterminated delimiter (mid-stream)", () => {
    expect(normalizeMathDelimiters("partial \\(e^{i")).toBe("partial \\(e^{i");
  });

  it("returns falsy/empty input as-is", () => {
    expect(normalizeMathDelimiters("")).toBe("");
  });
});
