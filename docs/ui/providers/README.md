# `ui/providers/` — pluggable React providers

Six React context providers expose the widget's customization
points. Each can be used inside `AIChatWidget` (via props) or
standalone (wrap your tree directly).

| Provider | Doc | Customizes |
| --- | --- | --- |
| `ApiProvider` | [`api.md`](./api.md) | In-process or remote engine routing |
| `ComponentsProvider` | [`components.md`](./components.md) | UI primitive overrides (buttons, inputs, dialogs, …) |
| `EventsProvider` | [`events.md`](./events.md) | Host-facing `ChatCallbacks`, internal `ChatEventBus` |
| `ImagesProvider` | [`images.md`](./images.md) | Icon / image overrides |
| `LocalesProvider` (`I18nProvider`) | [`locales.md`](./locales.md) | i18n: 43 bundled locales, custom strings |
| `ThemeProvider` | [`theme.md`](./theme.md) | Themes, CSS-variable tokens, dark/light resolution |

All are also re-exported from the package root:

```ts
import {
  ApiProvider,
  ComponentsProvider,
  EventsProvider,
  ImagesProvider,
  I18nProvider,
  ThemeProvider,
} from "@onlyoffice/ai-chat";
```

The accessor hooks live on the same modules
(`useComponents`, `useImages`, `useI18n`, `useTheme`, `useApi`,
`useCallbacksManager`) and are exported alongside the providers.
