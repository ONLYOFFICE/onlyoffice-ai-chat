# `ThemeProvider`

The library ships seven built-in themes implemented as scoped CSS
custom properties. Pick a theme via prop, override individual
tokens, register entirely new themes, or read the resolved
dark/light category from the active host environment.

```ts
import {
  ThemeProvider,
  useTheme,
  BUILT_IN_THEMES,
  DARK_THEMES,
} from "@onlyoffice/ai-chat";
import type {
  ThemeProviderProps,
  ThemeContextValue,
  ThemeTokens,
  ThemeType,
} from "@onlyoffice/ai-chat";
```

## Built-in themes

| Theme id | Style |
| --- | --- |
| `theme-light` | Standard light |
| `theme-dark` | Standard dark |
| `theme-white` | Minimal white |
| `theme-gray` | Neutral gray |
| `theme-classic-light` | Classic light |
| `theme-night` | Dark night |
| `theme-contrast-dark` | High-contrast dark |

`DARK_THEMES` lists which themes resolve to `"dark"`:

```ts
import { DARK_THEMES } from "@onlyoffice/ai-chat";
// ["theme-dark", "theme-night", "theme-contrast-dark"]
```

## CSS imports

Base stylesheet (Tailwind + every theme):

```ts
import "@onlyoffice/ai-chat/styles";
```

Just the theme definitions (all seven):

```ts
import "@onlyoffice/ai-chat/styles/themes";
```

Individual themes:

```ts
import "@onlyoffice/ai-chat/themes/theme-dark";
import "@onlyoffice/ai-chat/themes/theme-night";
```

## Picking a theme

```tsx
<AIChatWidget theme="theme-dark" {...rest} />;
```

Without a prop, the widget reads the theme from
`PlatformAdapter.env.theme`.

The special value `"theme-system"` resolves to `"theme-night"`
(dark) or `"theme-white"` (light) based on
`PlatformAdapter.env.systemTheme`.

## Overriding tokens (`customTheme`)

```tsx
<AIChatWidget
  theme="theme-light"
  customTheme={{
    "--background-normal":         "#fafafa",
    "--background-accent-button":  "#0066cc",
    "--text-normal":               "#1a1a1a",
  }}
/>;
```

`customTheme` is `Partial<ThemeTokens>` — TypeScript autocompletes
every token.

## Registering custom themes (`customThemes`)

```tsx
<AIChatWidget
  theme="theme-brand"
  customThemes={{
    "theme-brand": {
      "--background-normal":         "#1a0033",
      "--background-accent-button":  "#7c3aed",
      "--text-normal":               "#e8e0f0",
    },
    "theme-ocean": {
      "--background-normal":         "#001529",
      "--background-accent-button":  "#096dd9",
      "--text-normal":               "#d4e5f7",
    },
  }}
/>;
```

Custom themes are injected as `<style>` blocks scoped to the theme
class.

## Headless usage

```tsx
import { ThemeProvider, useTheme } from "@onlyoffice/ai-chat";

<ThemeProvider
  theme="theme-dark"
  customTheme={{ "--background-normal": "#1e1e2e" }}
>
  <ChatUI />
</ThemeProvider>;

function ChatUI() {
  const { themeId, themeType, setTheme } = useTheme();
  return (
    <>
      <p>{themeId} ({themeType})</p>
      <button onClick={() => setTheme("theme-light")}>Light</button>
      <button onClick={() => setTheme("theme-dark")}>Dark</button>
    </>
  );
}
```

## `useTheme` — `ThemeContextValue`

| Field | Type | Description |
| --- | --- | --- |
| `themeId` | `string` | Active theme id (e.g. `"theme-dark"`) |
| `themeType` | `"light" \| "dark"` | Resolved category |
| `setTheme` | `(id: string) => void` | Switch at runtime |
| `scale` | `number` | Current UI scale factor |

## Token categories

`ThemeTokens` is generated from the theme CSS files. The full token
list lives in
[`src/ui/providers/ThemeProvider/generated-types.ts`](../../../src/ui/providers/ThemeProvider/generated-types.ts).

Categories:

- **Background** — `--background-normal`, `--background-normal-element`,
  `--background-accent-button`, `--background-primary-button`,
  `--background-scrim`, …
- **Border** — `--border-divider`, `--border-regular-control`,
  `--border-control-focus`, `--border-error`, …
- **Highlight** — `--highlight-button-hover`,
  `--highlight-button-pressed`,
  `--highlight-accent-button-hover`, …
- **Text** — `--text-normal`, `--text-secondary`, …
- **Checkbox** — `--checkbox-check-mark-background`,
  `--checkbox-background-checked`, …
- **Scrollbar** — `--background-scroll-thumb`,
  `--highlight-scroll-thumb-hover`, …

## Platform-driven themes

`ThemeProvider` subscribes to
`PlatformAdapter.env.onEnvironmentChange`. Theme switches in the
host application are applied automatically without a re-render of
the widget.
