"use client";

import { lazy, Suspense, type FC } from "react";

import type { HighlighterProps } from "./shiki-highlighter";

// Load react-shiki (large grammar/theme payload) on demand. Re-exported
// from the root barrel through this wrapper so importing the library entry
// does not pull shiki into the eager chunk — it fetches only when a code
// block actually renders. The internal render path reaches the highlighter
// via the already-lazy markdown boundary, so this only affects consumers of
// the public `SyntaxHighlighter` export.
const LazySyntaxHighlighter = lazy(() =>
  import("./shiki-highlighter").then((m) => ({ default: m.SyntaxHighlighter }))
);

export const SyntaxHighlighter: FC<HighlighterProps> = (props) => (
  <Suspense fallback={null}>
    <LazySyntaxHighlighter {...props} />
  </Suspense>
);

SyntaxHighlighter.displayName = "SyntaxHighlighter";
