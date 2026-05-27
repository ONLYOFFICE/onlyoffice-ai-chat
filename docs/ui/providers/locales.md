# `I18nProvider` (locales)

The library ships 41 bundled locales powered by **i18next**. Locale
bundles are lazy-loaded — only the active locale and English (the
fallback) are fetched at runtime. Custom strings, custom languages,
and live locale switching are all supported.

```ts
import {
  I18nProvider,
  useI18n,
  bundledLocaleKeys,
} from "@onlyoffice/ai-chat";
import type {
  I18nProviderProps,
  I18nContextValue,
  TranslationKey,
  Translations,
} from "@onlyoffice/ai-chat";
```

> Source folder is `src/ui/providers/LocalesProvider/`; the export
> name is `I18nProvider` for backward compatibility.

## Bundled locales

The full list is available at runtime:

```ts
import { bundledLocaleKeys } from "@onlyoffice/ai-chat";
console.log(bundledLocaleKeys);
// ["ar-SA", "be", "bg", "ca", "cs-CZ", "da", "de", …]
```

The translation JSONs live in
[`src/translations/`](../../../src/translations/).

## Setting the active locale

```tsx
<AIChatWidget locale="fr" {...rest} />;
```

When the `locale` prop changes, the new bundle is fetched lazily
and the UI re-renders.

## RTL

`ar-SA` is detected as RTL automatically — the widget sets
`dir="rtl"` on its root and applies RTL-aware classes throughout.
Hebrew (`he`) and Urdu (`ur`) are RTL scripts by convention; to
enable RTL layout for them, treat them as RTL in your shell or
contribute upstream.

```ts
const { isRTL, direction } = useI18n();
// isRTL: boolean
// direction: "ltr" | "rtl"
```

## Custom translations (partial overrides)

Override individual keys for the active locale:

```tsx
<AIChatWidget
  locale="en"
  translations={{ AIAgent: "AI Assistant", Send: "Submit" }}
  {...rest}
/>;
```

Overrides are merged on top of the bundled locale via
`i18n.addResourceBundle(..., true, true)` — only the keys you
provide are replaced.

## Custom languages

Register entirely new locales via `customLanguages` on
`I18nProvider`:

```tsx
<I18nProvider
  locale="my-lang"
  customLanguages={{
    "my-lang": {
      AIAgent: "Custom Agent",
      Send: "Go",
      // …partial or full translation map
    },
  }}
>
  <App />
</I18nProvider>;
```

## Headless usage

Wrap your tree with `I18nProvider` directly when not using
`AIChatWidget`:

```tsx
import { I18nProvider, useI18n } from "@onlyoffice/ai-chat";

<I18nProvider locale="de">
  <CustomUI />
</I18nProvider>;

function CustomUI() {
  const { t, locale, changeLocale, isRTL, direction } = useI18n();
  return (
    <div dir={direction}>
      <h1>{t("AIAgent")}</h1>
      <button onClick={() => changeLocale("fr")}>Français</button>
    </div>
  );
}
```

## `I18nProviderProps`

| Prop | Type | Description |
| --- | --- | --- |
| `locale` | `string` | Active locale code (default `"en"`) |
| `translations` | `Partial<Translations>` | Override keys for the current locale |
| `customLanguages` | `Record<string, Partial<Translations>>` | Register additional languages |
| `children` | `React.ReactNode` | — |

## `useI18n` — `I18nContextValue`

| Field | Type | Description |
| --- | --- | --- |
| `t` | `(key: TranslationKey) => string` | Type-safe translation function |
| `locale` | `string` | Current locale |
| `changeLocale` | `(locale: string) => void` | Switch at runtime |
| `isRTL` | `boolean` | Whether the active locale is RTL |
| `direction` | `"ltr" \| "rtl"` | Convenience for the `dir` attribute |

## Lazy loading

Locale bundles use dynamic `import()` and are not in the main
bundle. On boot, only English plus the requested locale are loaded.
On `changeLocale` the new bundle is fetched on demand and cached
by i18next; already-loaded bundles are not re-fetched.
