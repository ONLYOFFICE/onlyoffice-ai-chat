---
name: add-ai-provider
description: Add a new built-in AI provider to this repository (not a runtime-registered custom one). Covers the provider folder shape, the OpenAI-compatible shortcut, and the full checklist of registration points outside core/providers that are easy to miss. Load when adding, renaming, or removing a built-in provider.
---

# Adding a built-in provider

`docs/core/providers/providers.md` covers how a *consumer* registers a
custom provider at runtime via `registerProvider()`. This skill is the
other thing: adding a provider that ships with the library.

## First: can you inherit from OpenAI?

Eleven of the built-ins (DeepSeek, Groq, xAI, Zhipu, Together,
OpenRouter, Ollama, LM Studio, GPT4All, OpenAICompatible, ONLYOFFICE)
are OpenAI-compatible and override only static identity plus the model
list. If the vendor exposes an OpenAI-shaped `/v1/chat/completions` and
`/v1/models`, copy `core/providers/deepseek/` — it is the minimal
example, three small files — and do **not** implement streaming.

Only write a full `AbstractBaseProvider<TOOL, MESSAGE, CLIENT>`
subclass when the wire format genuinely differs (see `anthropic/`,
`genai/`, `mistral/`, `stabilityai/`).

## The provider folder

```
core/providers/<type>/
  info.ts       # export const <name>Info = { name, baseUrl }
  index.ts      # the class; named export at the bottom
  models.ts     # export const listModels = (creds) => Promise<Model[]>
  tests/        # one test file per module
```

**`info.ts` must never import a vendor SDK.** The registry pulls every
`*Info` module eagerly so the UI can render provider names and base URLs
synchronously. An SDK import there bundles that SDK for every consumer
and breaks hosts that installed only the one optional peer they use.
Keep it to two plain strings.

## Registration checklist

The class alone does nothing. Every item below must be touched, and none
of them is caught by a compile error except the first two:

| File | What to add |
| --- | --- |
| `src/shared/builtin-provider-type.ts` | the type string in the union |
| `src/core/providers/registry.ts` | an entry in **both** `builtinMetadata` and `builtinLoaders`, in the same relative order (`getSupportedProviderTypes` relies on it) |
| `src/shared/images.ts` | `<type>: "<icon_key>"` mapping |
| `src/shared/api-key-links.ts` | the vendor's API-key page URL |
| `src/assets/providers/light/` + `dark/` | `<icon_key>_light.png` / `_dark.png` — **no codegen step**, see below |
| `src/core/providers/tests/test-utils.ts`, `registry.test.ts`, `branch-coverage.test.ts` | the type in the provider tables these tests iterate |

The `builtinLoaders` entry uses a dynamic `import()` so the vendor SDK
loads only on first instantiation — never convert it to a static import.

**Provider logos are not part of `IconName`.** They live in their own
namespace: `shared/images.ts` glob-imports
`assets/providers/{light,dark}/*.png` eagerly and resolves them through
the `PROVIDER_ICON_NAMES` map via `getProviderImageSrc(type, theme)`,
deliberately kept out of the general icon collections. So dropping the
two PNGs in and adding the map entry is enough — **don't run
`npm run generate:icons`** expecting your logo to appear in `IconName`;
it won't, and it doesn't need to. An unmapped provider falls back to
`custom_provider_<theme>.png`.

Add the SDK to `peerDependencies` **and** mark it `optional: true` in
`peerDependenciesMeta` (see the packaging rules in `CLAUDE.md`).

## The capability heuristic — three copies, no guard

`inferCapabilities` is duplicated **byte-for-byte in three files**:

- `src/shared/infer-capabilities.ts`
- `src/core/capabilities.ts`
- `src/capabilities.ts`

Nothing enforces parity — `src/tests/capabilities.test.ts` exercises only
the `src/capabilities.ts` copy, and the comment at the foot of that file
records that these copies have already drifted once. If your provider
needs a capability rule beyond the broad
`Chat | Vision | Tools` default, **edit all three** and diff them
afterwards:

```
for f in src/shared/infer-capabilities.ts src/core/capabilities.ts src/capabilities.ts; do
  sed -n '/function inferCapabilities/,/^}/p' "$f" | md5
done
```

Three identical hashes means you didn't miss one.

## Model capabilities

`listModels` sets `capabilities` per model with the `CapabilitiesUI`
bitmask, and `reasoning: true` for reasoning models (usually an id
substring test — DeepSeek keys off `reasoner`). Providers that can't
introspect capabilities from the API use the broad default.

## Verify

```
npm run typecheck && npm run lint && npm run test:run
```

Then check the provider appears in the add-profile dropdown. Two
built-ins are deliberately filtered *out* of it in `ModelConfigForm`
while still resolving from storage — `external` (it has no UI: every
request goes through `PlatformAdapter.externalFetch` with the real
provider named by `Profile.basedOn`) and `onlyoffice` (host-supplied
profiles, though it is re-offered when the host passes an
`externalOnlyofficeConfig`). Don't copy either exemption unless you mean
to.
