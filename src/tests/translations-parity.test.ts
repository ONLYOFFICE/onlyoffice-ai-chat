import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Nothing at build time keeps the 41 locale files in lockstep, and
// `fallbackLng: "en"` hides a missing key at runtime behind the English
// text. This is the only mechanical check that a new key (or a rename)
// reached every locale and the generated union.
const TRANSLATIONS_DIR = join(__dirname, "..", "translations");
const GENERATED_TYPES = join(
  __dirname,
  "..",
  "ui",
  "providers",
  "LocalesProvider",
  "generated-types.ts"
);

const readLocale = (file: string): Record<string, string> =>
  JSON.parse(readFileSync(join(TRANSLATIONS_DIR, file), "utf-8")) as Record<
    string,
    string
  >;

const localeFiles = readdirSync(TRANSLATIONS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();
const en = readLocale("en.json");
const enKeys = Object.keys(en).sort();

describe("translation files", () => {
  it("cover every locale the widget ships", () => {
    expect(localeFiles).toContain("en.json");
    expect(localeFiles.length).toBeGreaterThanOrEqual(41);
  });

  it.each(localeFiles)("%s has exactly the keys of en.json", (file) => {
    const keys = Object.keys(readLocale(file)).sort();
    expect(keys).toEqual(enKeys);
  });

  it.each(localeFiles)("%s has a non-empty string for every key", (file) => {
    const locale = readLocale(file);
    for (const [key, value] of Object.entries(locale)) {
      expect(typeof value, `${file}:${key}`).toBe("string");
      expect(value.trim(), `${file}:${key}`).not.toBe("");
    }
  });

  it("generated TranslationKey union matches en.json", () => {
    const source = readFileSync(GENERATED_TYPES, "utf-8");
    const union = source.slice(
      source.indexOf("export type TranslationKey"),
      source.indexOf(";", source.indexOf("export type TranslationKey"))
    );
    const generated = [...union.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(generated).toEqual(enKeys);
  });
});
