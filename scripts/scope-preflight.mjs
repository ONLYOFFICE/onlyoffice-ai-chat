// Post-process dist/styles/index.css so Tailwind's preflight
// (everything inside `@layer base { ... }`) applies only under the
// widget's `.aui-root` containers — never globally to the host page.
//
// Strategy:
//   - For `html` / `:host` rules (text-size-adjust, line-height, etc.)
//     rewrite the selector to `:where(.aui-root)` so the same styles
//     cascade from the widget root down.
//   - For every other selector inside `@layer base`, prepend
//     `:where(.aui-root) ` with `:where()` keeping specificity at 0
//     so host stylesheets always win.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(__dirname, "../dist/styles/index.css");

const SCOPE = ".aui-root";

const scopePreflight = () => ({
  postcssPlugin: "scope-preflight",
  AtRule: {
    layer(atRule) {
      if (atRule.params.trim() !== "base") return;

      atRule.walkRules((rule) => {
        rule.selectors = rule.selectors.map((sel) => {
          const trimmed = sel.trim();
          if (!trimmed) return sel;

          // `html` / `:host` cascade into descendants — rewrite to the
          // widget root itself so the same defaults apply inside.
          if (trimmed === "html" || trimmed === ":host") {
            return `:where(${SCOPE})`;
          }

          // Already scoped — leave alone.
          if (trimmed.includes(SCOPE)) return sel;

          return `:where(${SCOPE}) ${trimmed}`;
        });
      });
    },
  },
});
scopePreflight.postcss = true;

const input = readFileSync(cssPath, "utf8");
const result = await postcss([scopePreflight()]).process(input, {
  from: cssPath,
  to: cssPath,
});

writeFileSync(cssPath, result.css);
process.stdout.write(`scoped preflight in ${cssPath}\n`);
