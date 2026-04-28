// AUTO-GENERATION SCRIPT — generates TranslationKey and Translations types from en.json
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const enPath = resolve(__dirname, "../src/translations/en.json");
const outPath = resolve(
  __dirname,
  "../src/ui/providers/LocalesProvider/generated-types.ts"
);

const en = JSON.parse(readFileSync(enPath, "utf-8"));
const keys = Object.keys(en).sort();

const lines = [
  "// AUTO-GENERATED — do not edit manually.",
  `// Run \`npm run generate:i18n\` to regenerate from en.json.`,
  "",
  "export type TranslationKey =",
  keys.map((k) => `  | ${JSON.stringify(k)}`).join("\n") + ";",
  "",
  "export type Translations = Record<TranslationKey, string>;",
  "",
];

writeFileSync(outPath, lines.join("\n"), "utf-8");
console.log(`Generated ${outPath} with ${keys.length} keys.`);
