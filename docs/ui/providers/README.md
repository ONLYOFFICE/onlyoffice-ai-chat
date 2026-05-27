# `ui/providers/` — pluggable React providers

The widget's customization points live as React context providers.
Each can be used inside `AIChatWidget` (via props) or standalone
(wrap your tree directly). `ImperativeProvider` is consumed via
`React.forwardRef` rather than a context.

| Provider | Doc | Customizes |
| --- | --- | --- |
| `ApiProvider` | [`api.md`](./api.md) | In-process or remote engine routing |
| `ComponentsProvider` | [`components.md`](./components.md) | UI primitive overrides (buttons, inputs, dialogs, …) |
| `EventsProvider` | [`events.md`](./events.md) | Host-facing `ChatCallbacks`, internal `ChatEventBus` |
| `ImagesProvider` | [`images.md`](./images.md) | Icon / image overrides |
| `ImperativeProvider` | [`imperative.md`](./imperative.md) | `AIChatWidgetRef` — programmatic widget control |
| `LocalesProvider` (`I18nProvider`) | [`locales.md`](./locales.md) | i18n: 41 bundled locales, custom strings |
| `PlatformProvider` | — (see [`adapters.md`](../../adapters.md#platformadapter)) | Host-supplied `PlatformAdapter` (file/process/clouds/env) |
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
