import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Lazy locale loader map — dynamic imports, not eager
const localeLoaders: Record<string, () => Promise<{ default: object }>> = {
  "ar-SA": () => import("../../../translations/ar-SA.json"),
  be: () => import("../../../translations/be.json"),
  bg: () => import("../../../translations/bg.json"),
  ca: () => import("../../../translations/ca.json"),
  "cs-CZ": () => import("../../../translations/cs.json"),
  da: () => import("../../../translations/da.json"),
  de: () => import("../../../translations/de.json"),
  el: () => import("../../../translations/el.json"),
  en: () => import("../../../translations/en.json"),
  es: () => import("../../../translations/es.json"),
  fi: () => import("../../../translations/fi.json"),
  fr: () => import("../../../translations/fr.json"),
  gl: () => import("../../../translations/gl.json"),
  he: () => import("../../../translations/he.json"),
  hr: () => import("../../../translations/hr.json"),
  hu: () => import("../../../translations/hu.json"),
  hy: () => import("../../../translations/hy.json"),
  id: () => import("../../../translations/id.json"),
  it: () => import("../../../translations/it.json"),
  "ja-JP": () => import("../../../translations/ja.json"),
  ko: () => import("../../../translations/ko.json"),
  lv: () => import("../../../translations/lv.json"),
  nl: () => import("../../../translations/nl.json"),
  no: () => import("../../../translations/no.json"),
  pl: () => import("../../../translations/pl.json"),
  "pt-BR": () => import("../../../translations/pt-BR.json"),
  "pt-PT": () => import("../../../translations/pt-PT.json"),
  ro: () => import("../../../translations/ro.json"),
  ru: () => import("../../../translations/ru.json"),
  "sk-SK": () => import("../../../translations/sk.json"),
  sl: () => import("../../../translations/sl.json"),
  "sq-AL": () => import("../../../translations/sq-AL.json"),
  "sr-Cyrl-RS": () => import("../../../translations/sr-Cyrl.json"),
  "sr-Latn-RS": () => import("../../../translations/sr-Latn.json"),
  sv: () => import("../../../translations/sv.json"),
  tr: () => import("../../../translations/tr.json"),
  uk: () => import("../../../translations/uk.json"),
  ur: () => import("../../../translations/ur.json"),
  vi: () => import("../../../translations/vi.json"),
  "zh-CN": () => import("../../../translations/zh.json"),
  "zh-TW": () => import("../../../translations/zh-TW.json"),
};

export interface InitAIChatI18nOptions {
  locale?: string;
  resources?: Record<string, { translation: object }>;
}

let initPromise: Promise<typeof i18n> | null = null;

export const initAIChatI18n = (
  options?: InitAIChatI18nOptions
): Promise<typeof i18n> => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Load only requested locale + English fallback
    const locale = options?.locale ?? "en";
    const resources: Record<string, { translation: object }> = {};

    // Always load English as fallback
    const enModule = await localeLoaders.en();
    resources.en = { translation: enModule.default };

    // Load requested locale if different from English
    if (locale !== "en" && localeLoaders[locale]) {
      const localeModule = await localeLoaders[locale]();
      resources[locale] = { translation: localeModule.default };
    }

    // Merge with custom resources
    if (options?.resources) {
      Object.assign(resources, options.resources);
    }

    await i18n.use(initReactI18next).init({
      resources,
      lng: locale,
      fallbackLng: "en",
      interpolation: {
        escapeValue: false,
      },
      // Suppress i18next's Locize promo console.info shown on init in
      // v25.8.0–v25.10.x (removed upstream in v26). We embed the library, so
      // the notice is just noise in the host's console.
      showSupportNotice: false,
    });

    return i18n;
  })();

  return initPromise;
};

/**
 * Load a locale bundle into the already-initialized i18next instance.
 * Used by I18nProvider when the language changes at runtime.
 */
export const loadLocale = async (locale: string): Promise<void> => {
  if (!i18n.isInitialized) return;
  // Skip if already loaded
  if (i18n.hasResourceBundle(locale, "translation")) {
    await i18n.changeLanguage(locale);
    return;
  }
  const loader = localeLoaders[locale];
  if (loader) {
    const mod = await loader();
    i18n.addResourceBundle(locale, "translation", mod.default, true, true);
  }
  await i18n.changeLanguage(locale);
};

/** Reset the init promise — used in tests only. */
export const resetI18n = (): void => {
  initPromise = null;
};

// Export for hosts that want to preload all locales
export const bundledLocaleKeys = Object.keys(localeLoaders);
