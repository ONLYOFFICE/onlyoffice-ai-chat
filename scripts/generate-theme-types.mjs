// AUTO-GENERATION SCRIPT — generates ThemeTokens type from theme-light.css
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(__dirname, "../src/ui/styles/theme-light.css");
const outPath = resolve(
  __dirname,
  "../src/ui/providers/ThemeProvider/generated-types.ts"
);

const css = readFileSync(cssPath, "utf-8");

// Extract all CSS custom properties (--*)
const propRegex = /^\s*(--[\w-]+)\s*:/gm;
const tokens = [];
let match;

while ((match = propRegex.exec(css)) !== null) {
  tokens.push(match[1]);
}

// Deduplicate and sort
const unique = [...new Set(tokens)].sort();

const lines = [
  "// AUTO-GENERATED — do not edit manually.",
  "// Run `npm run generate:theme` to regenerate from theme-light.css.",
  "",
  "export interface ThemeTokens {",
  ...unique.map((t) => `  "${t}"?: string;`),
  "}",
  "",
];

writeFileSync(outPath, lines.join("\n"), "utf-8");
console.log(`Generated ${outPath} with ${unique.length} tokens.`);
