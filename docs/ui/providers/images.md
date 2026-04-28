# `ImagesProvider`

Override icons and other images. A single override can be a static
URL, a React component, or a function that returns a URL keyed on
theme + DPR. Unset overrides fall back to the bundled defaults.

```ts
import {
  ImagesProvider,
  useImages,
} from "@onlyoffice/ai-chat";
import type {
  IconName,
  ImageOverride,
  ImageOverrides,
  ImageResult,
  ImagesContextValue,
} from "@onlyoffice/ai-chat";
```

## Quick start

```tsx
<AIChatWidget
  images={{ "settings-icon": "/my-icons/settings.svg" }}
  {...rest}
/>;
```

Or wrap a subtree directly:

```tsx
<ImagesProvider overrides={{ "settings-icon": "/custom.svg" }}>
  <App />
</ImagesProvider>;
```

## `ImageOverride` — three forms

```ts
type ImageOverride =
  // 1. Static URL or data URI
  | string
  // 2. React component (typically inline SVG)
  | React.ComponentType<{ size?: number; className?: string }>
  // 3. Function keyed on theme and DPR
  | ((theme: "light" | "dark", scale: number) => string);
```

```tsx
const images: ImageOverrides = {
  "logo-icon": "/assets/logo.png",

  "star-icon": ({ size, className }) => (
    <svg width={size} height={size} className={className}>
      {/* … */}
    </svg>
  ),

  "theme-icon": (theme, scale) => `/icons/${theme}/icon@${scale}x.png`,
};
```

## `useImages`

```ts
const { getImageSrc, getIconComponent, getProviderImageSrc } = useImages();

const result: ImageResult = getImageSrc("settings-icon", "light", 1);
// { src: "/custom.svg", isSvg: true }
```

| Method | Returns |
| --- | --- |
| `getImageSrc(name, theme, scale)` | `{ src, isSvg }` for the resolved override or built-in |
| `getIconComponent(name)` | The override component if any (for inline-SVG cases) |
| `getProviderImageSrc(providerType, …)` | Provider-icon helper (`anthropic`, `openai`, …) |

## Built-in icon names

`IconName` is a generated union of every bundled icon. You can also
register arbitrary string keys — `ImageOverrides` is
`Partial<Record<IconName | string, ImageOverride>>`.

The full list lives in
[`src/ui/providers/ImagesProvider/generated-types.ts`](../../../src/ui/providers/ImagesProvider/generated-types.ts).
