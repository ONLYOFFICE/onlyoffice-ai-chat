---
name: code-style
description: House style for this repository beyond what ESLint and Prettier enforce — component and export shape, type-only imports, JSDoc expectations, CSS-token discipline, and comment conventions. Load before writing or reviewing any TypeScript/TSX in src/.
---

# Code style

Prettier, ESLint and `tsconfig` already enforce formatting, `eqeqeq`,
`prefer-const`, unused vars, and hook deps — don't restate those. What
follows is the house style they do *not* catch.

## Declarations and exports

- **Components are arrow functions.** 91 components use
  `const Name = (props: NameProps) => {}`; zero use `function Name()`.
  Match this.
- **Named exports at the bottom of the file**: `export { Button };` on
  the last line, not `export const Button = …` inline. 53 component
  files do it this way, 12 don't — follow the majority. Only 26 of 773
  exported symbols are default exports, so default-export nothing new
  unless the file is a lone runtime singleton (e.g. `shared/logger.ts`).
- **Props types are named `<Component>Props`** and built from React's own
  types (`React.ComponentProps<"button"> & …`) rather than hand-listing
  DOM attributes. Roughly half are exported and half stay local, and the
  split is not arbitrary: **export** the props type when the component is
  an overridable primitive re-exported through
  `ui/providers/ComponentsProvider/index.ts` (hosts need it to type their
  replacement); keep it local otherwise.

## Imports

- `verbatimModuleSyntax` is on: **every type import must be
  `import type`** (762 such lines in the tree). A value import used only
  as a type breaks the build.
- Use relative paths (`../../shared/utils`) — there are no path aliases
  in `tsconfig`.

## Comments and JSDoc

- ~83% of exported symbols (643 JSDoc blocks / 773 exports) carry a
  `/** … */` block. Add one to anything new that is exported: what it
  does, `@param`, `@returns`, and `@see` for the related type.
- **Inline comments explain *why*, never *what*.** This codebase's
  comments justify decisions — read `components/button/index.tsx` for the
  register: why the default is `type="button"`, why the loader is skipped
  for `asChild`. Write that kind, not `// set the class name`.

## Styling

- **Colors come from CSS custom properties only** — `bg-[var(--…)]`,
  `text-[var(--…)]`. There is not a single Tailwind palette utility
  (`bg-gray-200`) anywhere in `ui/components`, so don't be the first. Raw
  hex appears only in SVG paint attributes, which have no token
  equivalent, and in test fixtures.
- Every token must exist in `src/ui/styles/theme-light.css` — see the
  `add-icon-or-theme-token` skill before inventing one.
- Merge classes with `cn()` from `src/shared/utils.ts` (a `tailwind-merge`
  instance extended for this repo's custom groups). Never template-string
  class concatenation. This is how nearly every component composes
  classes.
- `class-variance-authority` is used in exactly **one** place —
  `components/button/Button.utils.tsx`. Don't reach for `cva()` by
  default; follow the local file, and only extract a variant table when a
  component genuinely has a matrix of variants like `Button` does.
- `data-slot="<name>"` is **not** a blanket convention — it appears in
  only 4 of 26 component folders (`button`, `dialog`, `dropdown-item`,
  `tooltip`), all of which wrap Radix primitives and tag each sub-part
  (`dialog-trigger`, `tooltip-content`, …) so hosts can target them. Add
  it when you wrap Radix parts; don't sprinkle it on plain components.

## Text

- No user-visible string is hardcoded. Use `const { t } = useI18n()` from
  `ui/providers/LocalesProvider` and `t("Key")` — see the
  `add-translation-key` skill for adding the key itself.

## Logging

- `logger` from `src/shared/logger.ts`, never `console.*`.

## Tests

- Every module has a colocated `tests/` directory (`foo/tests/foo.test.ts`),
  not a top-level mirror tree. Cross-cutting fixtures and
  `render-helpers.tsx` live in `src/tests/`.
- Vitest runs with `globals: true`, so `describe`/`it`/`expect` need no
  import.
- The default environment is **`node`**. A test that touches the DOM must
  opt in with a first-line pragma:
  ```ts
  // @vitest-environment jsdom
  ```
  Without it, rendering fails with no obvious explanation. Render through
  `renderWithProviders` from `src/tests/render-helpers.tsx`.
- `src/tests/setup.ts` runs for every test and globally mocks `useI18n`,
  `useTheme`, and `react-i18next`. Consequences: `t("Key")` returns the
  key itself, so assert on the key string, not on English copy; and the
  theme is always `theme-light` at scale 1 unless you override the mock.
