// AUTO-GENERATION SCRIPT — generates IconName type from src/assets/
import { readdirSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, "../src/assets");
const outPath = resolve(__dirname, "../src/images-provider/generated-types.ts");

const IMAGE_NAME_REGEX = /^([^@]+?)(?:@[\d.]+x)?\.(png|svg)$/;

/** Extract unique icon names from a directory */
const extractNames = (dir) => {
  const names = new Set();
  let files;
  try {
    files = readdirSync(dir);
  } catch {
    return names;
  }
  for (const file of files) {
    const match = file.match(IMAGE_NAME_REGEX);
    if (match) {
      names.add(match[1]);
    }
  }
  return names;
};

// Collect from all asset directories
const rootSvgs = extractNames(assetsDir);
const lightPngs = extractNames(resolve(assetsDir, "light"));
const darkPngs = extractNames(resolve(assetsDir, "dark"));
const formatIcons = extractNames(resolve(assetsDir, "formats"));
const providerIcons = extractNames(resolve(assetsDir, "providers"));

// Merge all names
const allNames = new Set([
  ...rootSvgs,
  ...lightPngs,
  ...darkPngs,
  ...formatIcons,
  ...providerIcons,
]);

const sorted = [...allNames].sort();

const lines = [
  "// AUTO-GENERATED — do not edit manually.",
  "// Run `npm run generate:icons` to regenerate from src/assets/.",
  "",
  "export type IconName =",
  ...sorted.map(
    (name, i) => `  | "${name}"${i === sorted.length - 1 ? ";" : ""}`
  ),
  "",
];

writeFileSync(outPath, lines.join("\n"), "utf-8");
console.log(`Generated ${outPath} with ${sorted.length} icon names.`);
