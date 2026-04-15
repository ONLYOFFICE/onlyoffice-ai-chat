# Component Overrides

`@onlyoffice/ai-chat` uses a pluggable component system that lets you replace any built-in UI primitive with your own implementation (e.g. from a design system). There are 18 overridable component slots and a separate image/icon override system.

## Quick Start

Pass a `components` prop to `AIChatWidget`:

```tsx
import { AIChatWidget } from "@onlyoffice/ai-chat";
import { MyButton } from "./my-design-system";

<AIChatWidget
  components={{ Button: MyButton }}
  storage={storage}
  settings={settings}
  platform={platform}
  storeKeys={keys}
/>
```

Every slot is optional. Unspecified slots use the built-in default.

## ComponentsProvider / useComponents

For headless usage outside of `AIChatWidget`, wrap your tree with `ComponentsProvider` and read overrides via the `useComponents` hook:

```tsx
import { ComponentsProvider, useComponents } from "@onlyoffice/ai-chat";

<ComponentsProvider overrides={{ Button: MyButton }}>
  <App />
</ComponentsProvider>

function App() {
  const { Button, Input } = useComponents();
  return <Button label="Click me" onClick={() => {}} />;
}
```

## Overridable Slots

| Slot | Props Interface | Description |
|------|----------------|-------------|
| `Button` | `ButtonProps` | Primary action button |
| `IconButton` | `IconButtonProps` | Icon-only button |
| `Input` | `InputProps` | Text input field |
| `Checkbox` | `CheckboxProps` | Checkbox toggle |
| `RadioButton` | `RadioButtonProps` | Radio button option |
| `ToggleButton` | `ToggleButtonProps` | Toggle button switch |
| `ComboBox` | `ComboBoxProps` | Combo box / select dropdown |
| `DialogContent` | `DialogContentProps` | Dialog body content area |
| `DialogOverlay` | `DialogOverlayProps` | Dialog backdrop overlay |
| `DialogFooter` | `DialogFooterProps` | Dialog footer with action buttons |
| `DropdownMenu` | `DropdownMenuProps` | Dropdown menu container |
| `DropDownItem` | `DropDownItemProps` | Individual item inside a dropdown |
| `Tabs` | `TabsProps` | Tab navigation bar |
| `TooltipContent` | `TooltipContentProps` | Tooltip popup content |
| `TooltipIconButton` | `TooltipIconButtonProps` | Icon button wrapped with a tooltip |
| `Link` | `LinkProps` | Hyperlink element |
| `Loader` | `LoaderProps` | Loading spinner / indicator |
| `FieldContainer` | `FieldContainerProps` | Labeled field wrapper with optional error |

All props interfaces are exported from the library:

```ts
import type {
  ButtonProps,
  IconButtonProps,
  InputProps,
  CheckboxProps,
  RadioButtonProps,
  ToggleButtonProps,
  ComboBoxProps,
  DialogContentProps,
  DialogOverlayProps,
  DialogFooterProps,
  DropdownMenuProps,
  DropDownItemProps,
  TabsProps,
  TooltipContentProps,
  TooltipIconButtonProps,
  LinkProps,
  LoaderProps,
  FieldContainerProps,
} from "@onlyoffice/ai-chat";
```

## Example: Replacing Button

```tsx
import type { ButtonProps } from "@onlyoffice/ai-chat";

const MyButton: React.FC<ButtonProps> = ({ label, onClick, isDisabled, size, ...rest }) => {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`my-btn my-btn--${size ?? "base"}`}
      {...rest}
    >
      {label}
    </button>
  );
};

<AIChatWidget components={{ Button: MyButton }} /* ...other props */ />
```

Your component receives the same props the built-in component expects. Match the props interface to ensure the widget functions correctly.

## Image Overrides

Icons and images use a separate override system via `ImagesProvider` and the `images` prop.

### Quick Start

```tsx
<AIChatWidget
  images={{ "settings-icon": "/my-icons/settings.svg" }}
  /* ...other props */
/>
```

### ImagesProvider / useImages

```tsx
import { ImagesProvider, useImages } from "@onlyoffice/ai-chat";

<ImagesProvider overrides={{ "settings-icon": "/custom/settings.svg" }}>
  <App />
</ImagesProvider>

function App() {
  const { getImageSrc, getIconComponent } = useImages();
  const result = getImageSrc("settings-icon", "light", 1);
  // result: { src: "/custom/settings.svg", isSvg: true }
}
```

### ImageOverride (3 Forms)

Each icon override can be one of three forms:

```ts
type ImageOverride =
  // 1. Static URL string or data-URI
  | string
  // 2. React component (e.g. inline SVG)
  | React.ComponentType<{ size?: number; className?: string }>
  // 3. Function returning a URL based on theme and scale
  | ((theme: "light" | "dark", scale: number) => string);
```

Examples:

```tsx
const images: ImageOverrides = {
  // Static URL
  "logo-icon": "/assets/logo.png",

  // React component
  "star-icon": ({ size, className }) => (
    <svg width={size} height={size} className={className}>...</svg>
  ),

  // Dynamic function
  "theme-icon": (theme, scale) =>
    `/icons/${theme}/icon@${scale}x.png`,
};
```

### Key Types

| Type | Description |
|------|-------------|
| `IconName` | Union of all built-in icon names (generated) |
| `ImageOverride` | A string, component, or function (see above) |
| `ImageOverrides` | `Partial<Record<IconName \| string, ImageOverride>>` |
| `ImageResult` | `{ src: string; isSvg: boolean }` |
| `ImagesContextValue` | Context value with `getImageSrc`, `getIconComponent`, `getProviderImageSrc` |
