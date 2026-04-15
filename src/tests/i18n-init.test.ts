import { describe, expect, it, vi, beforeEach } from "vitest";

let initAIChatI18n: typeof import("../locales/i18n").initAIChatI18n;
let bundledLocaleKeys: typeof import("../locales/i18n").bundledLocaleKeys;

const mockInit = vi.fn().mockResolvedValue(undefined);
const mockUse = vi.fn().mockReturnThis();

vi.mock("i18next", () => ({
  default: {
    use: mockUse,
    init: mockInit,
  },
}));

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty" },
}));

describe("initAIChatI18n", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import("../locales/i18n");
    initAIChatI18n = mod.initAIChatI18n;
    bundledLocaleKeys = mod.bundledLocaleKeys;
  });

  it("initializes i18n with English by default", async () => {
    await initAIChatI18n();
    expect(mockUse).toHaveBeenCalled();
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        lng: "en",
        fallbackLng: "en",
        interpolation: { escapeValue: false },
      })
    );
  });

  it("loads English resources by default", async () => {
    await initAIChatI18n();
    const callArgs = mockInit.mock.calls[0][0];
    expect(callArgs.resources.en).toBeDefined();
    expect(callArgs.resources.en.translation).toBeDefined();
  });

  it("returns same promise on second call (singleton)", async () => {
    const p1 = initAIChatI18n();
    const p2 = initAIChatI18n();
    expect(p1).toBe(p2);
    await p1;
  });

  it("loads requested locale in addition to English", async () => {
    await initAIChatI18n({ locale: "de" });
    const callArgs = mockInit.mock.calls[0][0];
    expect(callArgs.lng).toBe("de");
    expect(callArgs.resources.en).toBeDefined();
    expect(callArgs.resources.de).toBeDefined();
  });

  it("handles locale not in the loaders gracefully", async () => {
    await initAIChatI18n({ locale: "xx-UNKNOWN" });
    const callArgs = mockInit.mock.calls[0][0];
    expect(callArgs.lng).toBe("xx-UNKNOWN");
    expect(callArgs.resources.en).toBeDefined();
    // Should not have xx-UNKNOWN key since it has no loader
    expect(callArgs.resources["xx-UNKNOWN"]).toBeUndefined();
  });

  it("merges custom resources", async () => {
    await initAIChatI18n({
      resources: { custom: { translation: { Foo: "Bar" } } },
    });
    const callArgs = mockInit.mock.calls[0][0];
    expect(callArgs.resources.en).toBeDefined();
    expect(callArgs.resources.custom).toEqual({
      translation: { Foo: "Bar" },
    });
  });

  it("custom resources can override built-in locale", async () => {
    await initAIChatI18n({
      resources: { en: { translation: { Custom: "Value" } } },
    });
    const callArgs = mockInit.mock.calls[0][0];
    // Object.assign puts custom last, so custom overrides
    expect(callArgs.resources.en).toEqual({
      translation: { Custom: "Value" },
    });
  });

  it("does not load locale module for en when locale is en", async () => {
    await initAIChatI18n({ locale: "en" });
    const callArgs = mockInit.mock.calls[0][0];
    // Only en should be present
    const localeKeys = Object.keys(callArgs.resources);
    expect(localeKeys).toContain("en");
    // No duplicate loading - still just en
    expect(localeKeys.filter((k: string) => k === "en").length).toBe(1);
  });

  it("returns i18n instance", async () => {
    const result = await initAIChatI18n();
    expect(result).toBeDefined();
  });

  it("bundledLocaleKeys contains en", () => {
    expect(bundledLocaleKeys).toContain("en");
  });

  it("bundledLocaleKeys contains expected locales", () => {
    expect(bundledLocaleKeys).toContain("ru");
    expect(bundledLocaleKeys).toContain("ar-SA");
    expect(bundledLocaleKeys).toContain("zh-CN");
    expect(bundledLocaleKeys).toContain("de");
    expect(bundledLocaleKeys).toContain("fr");
    expect(bundledLocaleKeys).toContain("ja-JP");
  });

  it("bundledLocaleKeys has all locale entries", () => {
    expect(bundledLocaleKeys.length).toBeGreaterThanOrEqual(40);
  });

  it("loads a non-English locale (ru) successfully", async () => {
    await initAIChatI18n({ locale: "ru" });
    const callArgs = mockInit.mock.calls[0][0];
    expect(callArgs.lng).toBe("ru");
    expect(callArgs.resources.en).toBeDefined();
    expect(callArgs.resources.ru).toBeDefined();
  });

  it("loads zh-CN locale successfully", async () => {
    await initAIChatI18n({ locale: "zh-CN" });
    const callArgs = mockInit.mock.calls[0][0];
    expect(callArgs.lng).toBe("zh-CN");
    expect(callArgs.resources["zh-CN"]).toBeDefined();
  });

  it("loads ar-SA locale successfully", async () => {
    await initAIChatI18n({ locale: "ar-SA" });
    const callArgs = mockInit.mock.calls[0][0];
    expect(callArgs.resources["ar-SA"]).toBeDefined();
  });

  it("calls i18n.use with initReactI18next", async () => {
    await initAIChatI18n();
    expect(mockUse).toHaveBeenCalledWith({ type: "3rdParty" });
  });

  it("passes escapeValue false in interpolation", async () => {
    await initAIChatI18n();
    const callArgs = mockInit.mock.calls[0][0];
    expect(callArgs.interpolation.escapeValue).toBe(false);
  });

  it("without options uses en as default locale", async () => {
    await initAIChatI18n(undefined);
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({ lng: "en" })
    );
  });

  // Exercise all remaining locale loaders to cover each arrow function
  const additionalLocales = [
    "fr",
    "it",
    "pl",
    "ko",
    "sv",
    "tr",
    "uk",
    "vi",
    "bg",
    "ca",
    "da",
    "el",
    "es",
    "fi",
    "gl",
    "he",
    "hr",
    "hu",
    "hy",
    "id",
    "lv",
    "nl",
    "no",
    "ro",
    "be",
    "cs-CZ",
    "sk-SK",
    "sl",
    "sq-AL",
    "sr-Cyrl-RS",
    "sr-Latn-RS",
    "ur",
    "zh-TW",
    "pt-BR",
    "pt-PT",
    "ja-JP",
  ];

  for (const locale of additionalLocales) {
    it(`loads locale "${locale}" successfully`, async () => {
      await initAIChatI18n({ locale });
      const callArgs = mockInit.mock.calls[0][0];
      expect(callArgs.lng).toBe(locale);
      expect(callArgs.resources.en).toBeDefined();
      expect(callArgs.resources[locale]).toBeDefined();
      expect(callArgs.resources[locale].translation).toBeDefined();
    });
  }
});
