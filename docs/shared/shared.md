# `shared` modules — full reference

> Sources: [`src/shared/`](../../src/shared)

Everything in `shared/` is a leaf module — no internal imports
from `core/`, `services/`, `store/`, or any UI code. The folder
is the **bottom** of the import graph: anything here can be
consumed from anywhere else (including server-only code paths)
without risk of cycles or accidental DOM coupling.

The modules group naturally into six topics; this doc walks each
in turn.

---

## AI call shapes

The wire format that flows from [`core/actions/`](../core/actions/README.md)
into [`core/providers/`](../core/providers/README.md). Pure data
types — no runtime code.

### `SendMessageArgs` / `SendMessageResult`

> Source: [`send-message-args.ts`](../../src/shared/send-message-args.ts)

```ts
type SendMessageArgs = {
  messages: ThreadMessageLike[];
  model: string;
  systemPrompt: string;
  tools?: TMCPItem[];
  withReasoning?: boolean;      // legacy on/off; reasoningLevel wins when both are set
  reasoningLevel?: ReasoningLevel; // "off" | "low" | "medium" | "high" | "max"
  useResponsesApi?: boolean;
  signal?: AbortSignal;
};

type SendMessageResult =
  | ThreadMessageLike                                        // intermediate event
  | { isEnd: true; responseMessage: ThreadMessageLike };     // terminal event
```

`SendMessageArgs` is the input every streaming chat takes.
`SendMessageResult` is the union yielded by `provider.sendMessage`
on each iteration:

- An intermediate `ThreadMessageLike` carries deltas, tool calls,
  reasoning chunks — anything the model emits before it's done.
- The terminal `{ isEnd: true, responseMessage }` closes the
  stream and carries the final assistant message. Cancelled
  streams emit a terminal event with
  `responseMessage.status.reason === "stop"`; errored streams
  use `"error"` (see
  [`provider/stream.ts`](../../src/core/providers/anthropic/stream.ts)
  for the response-shape factories).

### `SendMessageSyncArgs`

> Source: [`send-message-sync-args.ts`](../../src/shared/send-message-sync-args.ts)

```ts
type SendMessageSyncArgs = {
  messages: ThreadMessageLike[];
  model: string;
  systemPrompt: string;
  useResponsesApi?: boolean;
  withReasoning?: boolean;
  reasoningLevel?: ReasoningLevel;
  signal?: AbortSignal;
};
```

The trimmed input for `provider.sendMessageSync` — no `tools`.
Used by every action except `chat` and
`custom`. Returns a plain `string`, not a result union, because
sync calls have no streaming events to surface.

### `ImageGenerationArgs`

> Source: [`image-generation-args.ts`](../../src/shared/image-generation-args.ts)

```ts
type ImageGenerationArgs = {
  model: string;
  prompt: string;
  width?: number;
  height?: number;
  signal?: AbortSignal;
};
```

Provider input for the optional
[`imageGeneration?(args)`](../core/providers/providers.md#instance-side--abstractbaseprovider)
method. Most providers don't implement it; OpenAI delegates to
`images.generate`, Stability AI calls its REST endpoints
directly. Width / height are advisory — the OpenAI provider
maps them to its allow-list of sizes, Stability AI passes them
through.

### `ProviderCredentials`

> Source: [`provider-credentials.ts`](../../src/shared/provider-credentials.ts)

```ts
type ProviderCredentials = {
  baseUrl: string;
  apiKey?: string;
  fetch?: ProviderFetch;
  basedOn?: BuiltinProviderType;
  sessionId?: string;
  entityId?: string;
  entityTitle?: string;
  source?: SourceMeta;
  headers?: Record<string, string>;
  reasoningSupport?: ReasoningSupport;
};
```

The credential shape every provider class accepts in its constructor;
only `baseUrl` is required. `sessionId`, `entityId` / `entityTitle` and
`source` are honoured by the ONLYOFFICE provider only (the session header
and the request `metadata`), so no thread or entry id reaches a third-party
endpoint. `apiKey` is optional for keyless local backends
(Ollama, LM Studio, GPT4All) — the convention there is to pass
the literal string `"none"` to satisfy SDK clients that require
*some* string.

---

### `SourceMeta`

> Source: [`source-meta.ts`](../../src/shared/source-meta.ts)

```ts
type SourceMeta = { id: string; type?: string; title?: string };
type SourceScope = { entityId?: string; threadId?: string };
type SourceResolver = (scope: SourceScope) =>
  SourceMeta | undefined | Promise<SourceMeta | undefined>;

sourceMetadataFields(source) // → { source_id, source_type?, source_title? } | undefined
```

The entry a billable request is attributed to — a DocSpace agent, room,
form, folder or file — as the ONLYOFFICE backend classifies it. Engines
obtain it through the host's `resolveSource` hook (`AIEngineDeps`,
`ThreadsEngineDeps`) and thread it into `ActionArgs.source` →
`ProviderCredentials.source` and into the built-in web-search requests.
`sourceMetadataFields` is the one place the wire keys are spelled; hosts
that build a request body themselves (a passthrough) reuse it.

---

## Provider identity

Names and metadata used to select and describe a provider.
Pure types — no runtime code.

### `TProvider`

> Source: [`provider.ts`](../../src/shared/provider.ts)

```ts
type TProvider = {
  type: ProviderType;
  name: string;       // user-defined display name
  key?: string;
  baseUrl: string;
};
```

A provider connection config as the user enters it in the
profile editor. Almost a `Profile` minus `id`/`createdAt`/
`modelId`/`capabilities` — `Profile` is the persisted form;
`TProvider` is the form-stage shape and is also used by some
host integrations to pass connection info into the widget.

### `ProviderType`

> Source: [`provider-type.ts`](../../src/shared/provider-type.ts)

```ts
type ProviderType = BuiltinProviderType | (string & {});
```

The `(string & {})` trick keeps autocomplete on the 17 built-in
strings while still permitting custom values for runtime-registered
providers. A plain `BuiltinProviderType | string` would collapse
to `string` and lose the autocomplete; the empty-object intersection
preserves both.

### `BuiltinProviderType`

> Source: [`builtin-provider-type.ts`](../../src/shared/builtin-provider-type.ts)

```ts
type BuiltinProviderType =
  | "anthropic" | "ollama" | "openai" | "openaicompatible"
  | "together" | "openrouter" | "genai" | "deepseek"
  | "xai" | "lm-studio" | "mistral" | "groq"
  | "zhipu" | "stabilityai" | "gpt4all" | "onlyoffice";
```

Source of truth for the built-in registry. Adding a new built-in
provider means: add the string here, register the class in
[`core/providers/registry.ts`](../../src/core/providers/registry.ts),
and add the folder under `core/providers/`.

### `Model`

> Source: [`model.ts`](../../src/shared/model.ts)

```ts
type Model = {
  id: string;                  // provider-side identifier (e.g. "gpt-4o")
  name: string;                // human-readable name
  provider: ProviderType;
  reasoning?: boolean;         // supports extended thinking
  capabilities?: number;       // CapabilitiesUI bitmask
};
```

Returned by every provider's static
[`getProviderModels(creds)`](../core/providers/providers.md#static-side--providerconstructor).
Drives the model picker in the profile editor. The `capabilities`
bitmask flows into `Profile.capabilities` and is used by
[`AssignmentsEngine`](../core/services/assignments-engine.md) to
validate that a profile is eligible for a given action slot.

---

## Action and capability metadata

What the system can do and which model can do what.

### `ActionType`

> Source: [`action-type.ts`](../../src/shared/action-type.ts)

```ts
const ActionType = {
  Default: "Default",
  Chat: "Chat",
  Code: "Code",
  Summarization: "Summarization",
  Translation: "Translation",
  TextAnalyze: "TextAnalyze",
  ImageGeneration: "ImageGeneration",
  OCR: "OCR",
  Vision: "Vision",
} as const;

type ActionType = (typeof ActionType)[keyof typeof ActionType];
```

The nine slots
[`AssignmentsStorage`](../core/storage/storage.md#assignmentsstorage)
keys on. Used in three places:

- **Assignment table** — each `ActionType` maps to one
  `profileId` (or none — `Default` then takes over).
- **Action dispatch** — `AIEngine.send({ actionType })` picks
  the right action function from
  [`SYNC_ACTIONS`](../../src/core/services/ai/actions.ts).
- **Capability requirements** —
  [`ACTION_REQUIREMENTS`](../core/services/assignments-engine.md#capability-requirements)
  declares the minimum `CapabilitiesUI` bits a profile must
  support per action.

The `as const` object pattern is used instead of `enum` to keep
output free of TypeScript's enum runtime helpers and to expose
the values as plain strings everywhere.

### `CapabilitiesUI`

> Source: [`capabilities-ui.ts`](../../src/shared/capabilities-ui.ts)

```ts
const CapabilitiesUI = {
  None:        0x000,
  Chat:        0x001,
  Image:       0x002,
  Embeddings:  0x004,
  Audio:       0x008,
  Vision:      0x080,
  Tools:       0x100,
} as const;
```

Bitmask constants describing what a model can do. Stored on
`Profile.capabilities` and `Model.capabilities`. The `0x080` /
`0x100` jumps leave room for additional bits between
`Audio` and `Vision` — that's intentional, future bits slot in
without renumbering.

### `Capabilities`

> Source: [`capabilities.ts`](../../src/shared/capabilities.ts)

```ts
type Capabilities = number;
```

A bare alias. Re-exported separately so call sites can write
`Capabilities` instead of an inline `number` and stay
self-documenting. The actual values are bitmasks built from
`CapabilitiesUI`.

### `inferCapabilities`

> Source: [`infer-capabilities.ts`](../../src/shared/infer-capabilities.ts)

```ts
function inferCapabilities(providerType: string, modelId: string): number;
```

Heuristic that maps a `(providerType, modelId)` pair to a
`CapabilitiesUI` bitmask. Used to **backfill** profiles that were
created before capabilities were tracked: at load time, profiles
whose `capabilities` field is missing or `0` get a guess based
on the provider and model ID.

The function is a long `if`/`return` cascade keyed by
`providerType`. Branches:

- **Whitelist matches** for OpenAI (Whisper / TTS → Audio,
  embeddings → Embeddings, DALL-E → Image, GPT-3.5-instruct →
  Chat, fallback → Chat | Vision).
- **Family prefixes** for Anthropic (`claude-2`, `claude-3-5-haiku`
  → Chat, fallback → Chat | Vision).
- **Substring rules** for Mistral, xAI, Groq, Zhipu (`vision` →
  Vision, `image` / `cogview` → Image, etc.).
- **Hard codes** for Stability AI (Image only).
- **Broad default** (`Chat | Vision | Tools`) for providers
  whose API doesn't expose enough metadata to infer narrowly:
  Together, OpenRouter, DeepSeek, Ollama, LM Studio, OpenAICompatible,
  GenAI, GPT4All.

The function is intentionally a one-pass heuristic — providers
that *do* have model metadata (e.g. OpenRouter, Together) compute
capabilities directly in their `models.ts` rather than relying
on `inferCapabilities`.

---

## Tools

### `TMCPItem`

> Source: [`mcp-item.ts`](../../src/shared/mcp-item.ts)

```ts
type TMCPItem = {
  name: string;                          // tool name (e.g. "web_search")
  description: string;                   // shown to the model + UI
  inputSchema: Record<string, unknown>;  // JSON Schema
  enabled?: boolean;                     // disabled tools are hidden from the model
};
```

The single tool descriptor. Used in three flows:

- **Streaming chat** — `SendMessageArgs.tools?: TMCPItem[]` is
  passed into `provider.sendMessage` and translated to the
  provider-specific tool shape inside each provider's
  `tools.ts`.
- **Tool sources** — host tools, web search, custom MCP servers
  all yield `TMCPItem` arrays through the
  [`Servers`](../../src/tools/Servers.ts) facade.
- **UI listings** — the tools panel filters / disables /
  auto-approves by `name`.

`enabled` is opt-out: a tool is enabled unless the field is
explicitly `false` (or appears in `ToolPrefsStorage.readDisabled()`).

---

## Runtime helpers

### `isAbortError`

> Source: [`abort.ts`](../../src/shared/abort.ts)

```ts
function isAbortError(error: unknown, signal?: AbortSignal): boolean;
```

Predicate for "did the caller cancel?" — checks both the explicit
`signal.aborted` flag *and* the `AbortError` shape that `fetch`
and most SDKs throw when a signal fires mid-request. Used by
every provider's `sendMessage` catch block to decide whether to
emit a `"stop"` terminal event or an `"error"` one.

```ts
try {
  yield* processStream(stream);
} catch (error) {
  if (isAbortError(error, signal)) {
    yield { isEnd: true, responseMessage: createStopResponse() };
    return;
  }
  yield { isEnd: true, responseMessage: createErrorResponse(error) };
}
```

The `signal` argument is optional because some SDK errors carry
the abort signal natively (`error.name === "AbortError"`); the
predicate covers both paths.

### `TErrorData`

> Source: [`error-data.ts`](../../src/shared/error-data.ts)

```ts
type TErrorData = {
  field: "key" | "url" | "name";
  message: string;
};
```

Field-scoped form-error shape. Returned from:

- [`Provider.checkProvider`](../core/providers/providers.md#static-side--providerconstructor)
  — credential validation.
- [`ProfilesEngine`](../core/services/profiles-engine.md) — name
  uniqueness, profile-not-found.
- [`AssignmentsEngine`](../core/services/assignments-engine.md) —
  capability mismatch.

The `field` discriminator drives form-error rendering: the
profile editor knows that `field: "key"` should highlight the
API-key input, `field: "url"` the base-URL input, and `field:
"name"` the name input (or the "Profile not found" toast for
operations that don't have a name field).

`ProviderErrors` in
[`core/providers/errors.ts`](../core/providers/errors.md) is the
recommended factory for these — use it instead of constructing
literals so field assignment and default messaging stay
consistent across providers.

---

## Logging

### `logger`

> Source: [`logger.ts`](../../src/shared/logger.ts)

```ts
import logger from "./logger";

logger.log(...);
logger.warn(...);
logger.error(...);
logger.info(...);
```

Thin wrapper around `console.*` that delegates through an
indirect reference so the project-wide ESLint `no-console` rule
doesn't fire at every call site.

```ts
// Indirect reference hides `console` from ESLint's static check.
const c: Console = globalThis["console" as keyof typeof globalThis] as Console;

const logger = {
  log: (...args: unknown[]) => c.log(...args),
  warn: (...args: unknown[]) => c.warn(...args),
  error: (...args: unknown[]) => c.error(...args),
  info: (...args: unknown[]) => c.info(...args),
};
```

Use it everywhere you would otherwise write `console.*` — the
codebase's ESLint config flags direct `console` usage. The
default `Console` shape is preserved so the API matches what
you already know.

`logger` has no levels, no transports, no structured output —
it's deliberately a one-line abstraction. If you need real
logging plumbing on the host side, layer it on by replacing
`globalThis.console` before the widget mounts.

---

## A note on dependencies

`shared/` is intentionally allergic to upstream dependencies:

- **No imports from `core/`, `services/`, `store/`, or any
  UI layer.** Modules in those layers freely import from
  `shared/`; the reverse would create cycles.
- **No DOM / browser APIs** in any module here. Everything in
  `shared/` runs in any JavaScript runtime that supports modern
  ECMAScript — server, worker, edge, browser.
- **No third-party SDKs.** `@assistant-ui/react` types
  (`ThreadMessageLike`) are imported from a few places, but
  it's a peer dependency of the library and a type-only import.
  Keep this folder boring on purpose.

When you need a new shared symbol, prefer a **new file** with a
narrow export over expanding an existing one — it keeps the
module graph flat and lets callers import only what they use.

### `ReasoningLevel`

> Source: [`reasoning-level.ts`](../../src/shared/reasoning-level.ts)

```ts
type ReasoningLevel = "off" | "low" | "medium" | "high" | "max";

const REASONING_LEVELS: readonly ReasoningLevel[];      // lowest first
const DEFAULT_REASONING_LEVEL = "medium";               // what the boolean toggle alone means
function isReasoningLevel(value: unknown): value is ReasoningLevel;
function resolveReasoningLevel(args: { reasoningLevel?; withReasoning? }): ReasoningLevel;

type ReasoningDepth = Exclude<ReasoningLevel, "off">;
type ReasoningSupport = {
  thinks: boolean;                    // false → no thinking controls at all
  canDisable: boolean;                // false → "off" only drops to the model's floor
  depths: readonly ReasoningDepth[];  // the depths the model distinguishes; [] = on/off only
  defaultDepth?: ReasoningDepth;      // what a stored "off" runs at where off is impossible (from the catalogue)
};
const FULL_REASONING_SUPPORT: ReasoningSupport;  // every depth, off works
const NO_REASONING_SUPPORT: ReasoningSupport;    // does not think
function reasoningSupport(depths, { canDisable, thinks? }): ReasoningSupport;
function clampReasoningLevel(level, support): ReasoningLevel;     // nearest listed depth, ties upward
function effectiveReasoningLevel(level, support): ReasoningLevel; // clamp, and off → standard depth (medium) where off is impossible
```

The provider-neutral depth of extended thinking. Providers call
`resolveReasoningLevel(args)` first so both the level and the legacy
`withReasoning` boolean are honoured (`true` → `"medium"`), then map
the level onto their own knob and clamp to what the model accepts —
see [Extended thinking depth](../core/providers/built-in.md#extended-thinking-depth).
