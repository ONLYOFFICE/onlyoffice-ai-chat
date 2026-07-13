// Copy the theme CSS files into dist/styles/ after the Vite build.
// Cross-platform replacement for the previous `cp` shell commands (which fail
// on Windows). Copies themes.css and every theme-*.css from src/ui/styles.

import { readdirSync, copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const srcDir = join(root, "src", "ui", "styles");
const destDir = join(root, "dist", "styles");

mkdirSync(destDir, { recursive: true });

const files = readdirSync(srcDir).filter(
  (name) => name === "themes.css" || /^theme-.*\.css$/.test(name)
);

for (const name of files) {
  copyFileSync(join(srcDir, name), join(destDir, name));
}

console.log(`Copied ${files.length} theme file(s) to dist/styles/`);
