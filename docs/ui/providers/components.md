# `ComponentsProvider`

Override the widget's built-in UI primitives with your own
implementations (e.g. from a design system). Eighteen overridable
slots; every one is optional. Unset slots fall back to the bundled
default.

```ts
import {
  ComponentsProvider,
  useComponents,
} from "@onlyoffice/ai-chat";
import type {
  ComponentOverrides,
  ButtonProps,
  // …per-slot prop types as needed
} from "@onlyoffice/ai-chat";
```

## Quick start

Pass via `components` prop:

```tsx
<AIChatWidget
  components={{ Button: MyButton }}
  {...rest}
/>;
```

Or wrap a subtree directly:

```tsx
<ComponentsProvider overrides={{ Button: MyButton }}>
  <App />
</ComponentsProvider>;

function App() {
  const { Button, Input } = useComponents();
  return <Button label="Click" onClick={() => {}} />;
}
```

## Overridable slots

| Slot | Props | Description |
| --- | --- | --- |
| `Button` | `ButtonProps` | Primary action button |
| `IconButton` | `IconButtonProps` | Icon-only button |
| `Input` | `InputProps` | Text input field |
| `Checkbox` | `CheckboxProps` | Checkbox |
| `RadioButton` | `RadioButtonProps` | Radio button |
| `ToggleButton` | `ToggleButtonProps` | Toggle switch |
| `ComboBox` | `ComboBoxProps` | Combo box / select |
| `DialogContent` | `DialogContentProps` | Dialog body |
| `DialogOverlay` | `DialogOverlayProps` | Dialog backdrop |
| `DialogFooter` | `DialogFooterProps` | Dialog footer |
| `DropdownMenu` | `DropdownMenuProps` | Dropdown menu container |
| `DropDownItem` | `DropDownItemProps` | Dropdown menu item |
| `Tabs` | `TabsProps` | Tab navigation bar |
| `TooltipContent` | `TooltipContentProps` | Tooltip popup |
| `TooltipIconButton` | `TooltipIconButtonProps` | Icon button + tooltip |
| `Link` | `LinkProps` | Hyperlink |
| `Loader` | `LoaderProps` | Spinner |
| `FieldContainer` | `FieldContainerProps` | Labeled field wrapper with optional error |

All prop types are exported from the package root. The full list
matches `ComponentOverrides` —
see [`src/ui/providers/ComponentsProvider/types.ts`](../../../src/ui/providers/ComponentsProvider/types.ts).

## Example: replacing `Button`

```tsx
import type { ButtonProps } from "@onlyoffice/ai-chat";

const MyButton: React.FC<ButtonProps> = ({
  label, onClick, isDisabled, size, ...rest
}) => (
  <button
    onClick={onClick}
    disabled={isDisabled}
    className={`my-btn my-btn--${size ?? "base"}`}
    {...rest}
  >
    {label}
  </button>
);

<AIChatWidget components={{ Button: MyButton }} {...rest} />;
```

Match the prop interface — the widget passes the same shape as the
built-in component expects.
