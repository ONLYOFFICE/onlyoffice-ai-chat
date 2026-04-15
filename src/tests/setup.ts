import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Global mock for the i18n locales module — components now use useI18n()
// instead of react-i18next's useTranslation().
vi.mock("../locales", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en",
    changeLocale: vi.fn(),
    isRTL: false,
    direction: "ltr" as const,
  }),
  I18nProvider: ({ children }: { children: unknown }) => children,
  bundledLocaleKeys: ["en"],
  initAIChatI18n: vi.fn().mockResolvedValue(undefined),
  loadLocale: vi.fn().mockResolvedValue(undefined),
}));

// Keep react-i18next mock for any remaining direct usages and internal bridge
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: "en",
      changeLanguage: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      isInitialized: true,
      hasResourceBundle: vi.fn().mockReturnValue(false),
      addResourceBundle: vi.fn(),
    },
  }),
  initReactI18next: { type: "3rdParty" },
}));
