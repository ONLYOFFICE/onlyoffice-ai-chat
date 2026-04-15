# Theming

The library ships 7 built-in themes implemented as CSS custom property scopes. Themes can be selected via props, overridden with custom tokens, or extended with entirely new themes.

## Built-in Themes

| Theme ID | Style |
|----------|-------|
| `theme-light` | Standard light theme |
| `theme-dark` | Standard dark theme |
| `theme-white` | Minimal white background |
| `theme-gray` | Neutral gray tones |
| `theme-classic-light` | Classic light style |
| `theme-night` | Dark night mode |
| `theme-contrast-dark` | High-contrast dark mode |

### Dark Themes

The `DARK_THEMES` constant identifies which themes are classified as dark:

```ts
import { DARK_THEMES } from "@onlyoffice/ai-chat";
// ["theme-dark", "theme-night", "theme-contrast-dark"]
```

This is used internally by `getThemeType()` to resolve a theme ID to `"light"` or `"dark"`.

## CSS Imports

Import the base stylesheet (includes Tailwind + all themes):

```ts
import "@onlyoffice/ai-chat/styles";
```

Import only the theme definitions (all 7 themes):

```ts
import "@onlyoffice/ai-chat/styles/themes";
```

Import individual themes:

```ts
import "@onlyoffice/ai-chat/themes/theme-dark";
import "@onlyoffice/ai-chat/themes/theme-night";
```

Each theme file defines CSS custom properties scoped to a class name (e.g., `.theme-dark { --background-normal: #333; ... }`).

## Theme Props on AIChatWidget

### `theme`

Set the active theme by ID:

```tsx
<AIChatWidget theme="theme-dark" /* ...other props */ />
```

If not provided, the widget reads the theme from the platform adapter's environment.

### `customTheme`

Override individual CSS custom properties on top of the active theme:

```tsx
<AIChatWidget
  theme="theme-light"
  customTheme={{
    "--background-normal": "#fafafa",
    "--background-accent-button": "#0066cc",
    "--text-normal": "#1a1a1a",
  }}
/>
```

The `customTheme` type is `Partial<ThemeTokens>`, which is generated from the theme CSS files. TypeScript provides autocomplete for all available tokens.

### `customThemes`

Register new named themes as collections of CSS custom property overrides:

```tsx
<AIChatWidget
  customThemes={{
    "theme-brand": {
      "--background-normal": "#1a0033",
      "--background-accent-button": "#7c3aed",
      "--text-normal": "#e8e0f0",
    },
    "theme-ocean": {
      "--background-normal": "#001529",
      "--background-accent-button": "#096dd9",
      "--text-normal": "#d4e5f7",
    },
  }}
  theme="theme-brand"
/>
```

Custom themes are injected as `<style>` blocks with the theme name as the CSS class selector.

## ThemeProvider (Headless Usage)

For headless or custom layouts, use `ThemeProvider` directly:

```tsx
import { ThemeProvider, useTheme } from "@onlyoffice/ai-chat";

function App() {
  return (
    <ThemeProvider
      theme="theme-dark"
      customTheme={{ "--background-normal": "#1e1e2e" }}
      customThemes={{
        "theme-custom": { "--background-normal": "#2d2d3f" },
      }}
    >
      <ChatUI />
    </ThemeProvider>
  );
}

function ChatUI() {
  const { themeId, themeType, setTheme, scale } = useTheme();

  return (
    <div>
      <p>Current theme: {themeId} ({themeType})</p>
      <p>UI scale: {scale}</p>
      <button onClick={() => setTheme("theme-light")}>Light</button>
      <button onClick={() => setTheme("theme-dark")}>Dark</button>
    </div>
  );
}
```

### `useTheme()` Return Value

| Property | Type | Description |
|----------|------|-------------|
| `themeId` | `string` | Active theme ID (e.g., `"theme-dark"`) |
| `themeType` | `"light" \| "dark"` | Resolved theme category |
| `setTheme` | `(id: string) => void` | Switch theme at runtime |
| `scale` | `number` | Current UI scale factor (e.g., `1`, `1.25`) |

## Theme Tokens

Each theme defines CSS custom properties organized into categories:

- **Background:** `--background-normal`, `--background-normal-element`, `--background-accent-button`, `--background-primary-button`, `--background-scrim`, etc.
- **Border:** `--border-divider`, `--border-regular-control`, `--border-control-focus`, `--border-error`, etc.
- **Highlight:** `--highlight-button-hover`, `--highlight-button-pressed`, `--highlight-accent-button-hover`, etc.
- **Text:** `--text-normal`, `--text-secondary`, etc.
- **Checkbox:** `--checkbox-check-mark-background`, `--checkbox-background-checked`, etc.
- **Scrollbar:** `--background-scroll-thumb`, `--highlight-scroll-thumb-hover`, etc.

Import the `ThemeTokens` type for full autocomplete:

```ts
import type { ThemeTokens } from "@onlyoffice/ai-chat";

const overrides: Partial<ThemeTokens> = {
  "--background-normal": "#fff",
  "--text-normal": "#000",
};
```

## Platform-Driven Themes

When running inside a host application (e.g., ONLYOFFICE Desktop Editors), the `ThemeProvider` listens for platform environment changes via `PlatformAdapter.env.onEnvironmentChange`. Theme switches from the host application are automatically applied.

The special value `"theme-system"` resolves to `"theme-night"` (dark) or `"theme-white"` (light) based on the platform's system theme preference.
