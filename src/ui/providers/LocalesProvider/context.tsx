import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import type { TranslationKey, Translations } from "./generated-types";
import { initAIChatI18n, loadLocale } from "./i18n";
import { usePlatform } from "../PlatformProvider/context";
import logger from "../../../shared/logger";

const RTL_LANGUAGES = ["ar-SA"];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Props for the {@link I18nProvider} component that bootstraps i18next
 * and exposes translation utilities to the widget tree.
 */
export interface I18nProviderProps {
  /** Active locale code (e.g. "en", "ru", "ar-SA"). */
  locale?: string;
  /** Override individual keys for the current language. */
  translations?: Partial<Translations>;
  /** Register entirely new languages: `{ "my-lang": { AIAgent: "..." } }`. */
  customLanguages?: Record<string, Partial<Translations>>;
  children: React.ReactNode;
}

/**
 * Value exposed by the i18n React context. Consumers access this via
 * the {@link useI18n} hook.
 */
export interface I18nContextValue {
  /** Typesafe translation function. Accepts any string for forward-compat. */
  t: (key: TranslationKey | (string & {})) => string;
  /** Current locale code. */
  locale: string;
  /** Switch locale at runtime (loads bundle lazily). */
  changeLocale: (locale: string) => void;
  /** Whether the current locale is RTL. */
  isRTL: boolean;
  /** "ltr" | "rtl" — convenience for the `dir` attribute. */
  direction: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Locale switches are fired from effects (and from platform environment
 * callbacks) that cannot await them, and `loadLocale` dynamically imports the
 * locale chunk — a request that fails when the host is offline or serves a
 * stale build. Log those failures instead of letting them escape as unhandled
 * rejections; the widget keeps rendering in the language it already has.
 *
 * The host is not notified through `ChatCallbacks.onError` here: this provider
 * is mounted independently of `EventsProvider`, so the callbacks manager isn't
 * guaranteed to exist at this point in the tree.
 */
const reportLocaleFailure = (loading: Promise<unknown> | undefined): void => {
  // `Promise.resolve` wrapping on purpose: `i18n.changeLanguage` is typed as
  // returning a promise, but a stubbed/patched i18next instance may hand back
  // nothing at all.
  void Promise.resolve(loading).catch((err) => {
    logger.error("locale:load failed:", err);
  });
};

const applyLocale = (locale: string): void =>
  reportLocaleFailure(loadLocale(locale));

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Bootstraps i18next and provides translation utilities to the component
 * tree. Handles lazy locale loading, translation overrides, and custom
 * language registration. Renders `null` until initialization completes.
 *
 * @example
 * ```tsx
 * <I18nProvider locale="ru" translations={{ AIAgent: "ИИ-агент" }}>
 *   <App />
 * </I18nProvider>
 * ```
 */
export const I18nProvider = ({
  locale = "en",
  translations,
  customLanguages,
  children,
}: I18nProviderProps) => {
  const [ready, setReady] = useState(false);

  // 1. Bootstrap i18next (singleton — safe to call many times)
  const initialLocaleRef = useRef(locale);
  const initialTranslationsRef = useRef(translations);

  useEffect(() => {
    const initLocale = initialLocaleRef.current;
    const initTranslations = initialTranslationsRef.current;

    const resources: Record<string, { translation: object }> | undefined =
      initTranslations
        ? { [initLocale]: { translation: initTranslations as object } }
        : undefined;

    initAIChatI18n({ locale: initLocale, resources })
      .then(() => setReady(true))
      .catch((err) => {
        logger.error("i18n init failed:", err);
      });
  }, []); // init once — locale/translations changes handled below

  // 2. React to locale prop changes after init
  useEffect(() => {
    if (!ready) return;
    applyLocale(locale);
  }, [ready, locale]);

  // 3. Inject translations overrides
  useEffect(() => {
    if (!ready || !translations) return;
    i18n.addResourceBundle(
      i18n.language,
      "translation",
      translations,
      true,
      true
    );
    // Force react-i18next to pick up the new resources
    reportLocaleFailure(i18n.changeLanguage(i18n.language));
  }, [ready, translations]);

  // 4. Inject custom languages
  useEffect(() => {
    if (!ready || !customLanguages) return;
    for (const [lang, bundle] of Object.entries(customLanguages)) {
      i18n.addResourceBundle(lang, "translation", bundle, true, true);
    }
  }, [ready, customLanguages]);

  if (!ready) return null;

  return <I18nBridge locale={locale}>{children}</I18nBridge>;
};

// ---------------------------------------------------------------------------
// Inner bridge — subscribes to react-i18next so we re-render on lang change
// ---------------------------------------------------------------------------

const I18nBridge = ({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) => {
  // Bind to the instance this provider initialised, explicitly. Left to
  // resolve on its own, `useTranslation` takes whatever the host put in
  // React context — or, with no provider at all, react-i18next's global
  // default. Either one is the HOST's instance, which knows nothing about
  // the `translation` namespace these strings live in, so every key comes
  // back as its own name. A host that also sets `react.useSuspense: false`
  // (the default in DocSpace) doesn't even get an error out of it: the UI
  // renders, quietly labelled with raw keys.
  const { t: rawT, i18n: i18nInstance } = useTranslation(undefined, { i18n });
  const platform = usePlatform();

  const changeLocale = useCallback((newLocale: string) => {
    applyLocale(newLocale);
  }, []);

  // Track current language via i18next events
  const [currentLang, setCurrentLang] = useState(i18nInstance.language);

  useEffect(() => {
    const onLangChanged = (lng: string) => setCurrentLang(lng);
    i18nInstance.on("languageChanged", onLangChanged);
    return () => {
      i18nInstance.off("languageChanged", onLangChanged);
    };
  }, [i18nInstance]);

  // Keep i18next in sync with the `locale` prop
  useEffect(() => {
    if (locale !== i18nInstance.language) {
      applyLocale(locale);
    }
  }, [locale, i18nInstance]);

  // Subscribe to platform environment changes for language switching
  useLayoutEffect(() => {
    if (platform?.env?.locale) {
      applyLocale(platform.env.locale);
    }

    const unsubscribe = platform?.env?.onEnvironmentChange?.((info) => {
      if (info.lang) {
        applyLocale(info.lang);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [platform]);

  const isRTL = RTL_LANGUAGES.includes(currentLang);
  const direction = isRTL ? "rtl" : "ltr";

  const t = useCallback(
    (key: TranslationKey | (string & {})): string => rawT(key),
    [rawT]
  );

  const value: I18nContextValue = useMemo(
    () => ({ t, locale: currentLang, changeLocale, isRTL, direction }),
    [t, currentLang, changeLocale, isRTL, direction]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current i18n context value including the `t` function,
 * active locale, and RTL information. Must be used within an
 * {@link I18nProvider}.
 *
 * @throws If called outside of an `I18nProvider`.
 */
export const useI18n = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
};
