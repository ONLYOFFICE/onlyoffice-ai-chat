# Providers — system reference

> Sources: [`src/core/providers/`](../../../src/core/providers)

A **provider** is a stateless thin client that knows how to talk
to one AI service. The library's higher layers
([`actions/`](../actions/README.md), [`services/`](../services/README.md))
never reach for SDK clients directly — they call into a provider
through the abstract contract defined here.

This page covers the contract, the registry, and the error
helpers. For per-provider details (transport, capabilities,
quirks), see [`built-in.md`](./built-in.md).

---

## The contract

> Source: [`base.ts`](../../../src/core/providers/base.ts)

A provider has an **instance side** (per-call methods) and a
**static side** (identity + credential validation). TypeScript
can't mark static methods `abstract`, so the static surface lives
in a companion interface that every concrete class implements.

### Instance side — `AbstractBaseProvider`

```ts
abstract class AbstractBaseProvider {
  protected creds: ProviderCredentials;

  constructor(creds: ProviderCredentials) {
    this.creds = creds;
  }

  abstract sendMessage(args: SendMessageArgs): AsyncGenerator<SendMessageResult>;
  abstract sendMessageSync(args: SendMessageSyncArgs): Promise<string>;

  imageGeneration?(args: ImageGenerationArgs): Promise<string>;
}
```

| Method                | Required | Used by |
| --------------------- | -------- | ------- |
| `sendMessage`         | ✅       | streaming chat — `chat`, `custom` actions |
| `sendMessageSync`     | ✅       | one-shot — `summarize`, `translate`, `analyzeText`, `recognizeText`, `describeImage`, `generateImage`, `generateTitle`, `customSync` actions |
| `imageGeneration`     |          | optional — direct image-API providers (Stability AI, OpenAI's `images.generate`) |

The only piece of instance state is `creds`. The SDK client (when
the provider needs one) is created in the constructor and stored
in a subclass field — see how `AnthropicProvider.client` and
`OpenAIProvider.client` work.

### Static side — `ProviderConstructor`

```ts
interface ProviderConstructor {
  new (creds: ProviderCredentials): AbstractBaseProvider;

  checkProvider(creds: ProviderCredentials): Promise<boolean | TErrorData>;
  getProviderModels(creds: ProviderCredentials): Promise<Model[]>;
  getName(): string;
  getBaseUrl(): string;
}
```

| Method                | Used by |
| --------------------- | ------- |
| `checkProvider`       | [`ProfilesEngine`](../services/profiles-engine.md) for credential validation on `create` / `update` / `testConnection` |
| `getProviderModels`   | [`ProfilesEngine.listModels`](../services/profiles-engine.md#listmodels) for the model picker |
| `getName`             | UI labels |
| `getBaseUrl`          | Form defaults in the profile editor |

Returning `true` from `checkProvider` means "credentials are
valid". Returning a `TErrorData` (`{ field, message }`) tells the
profile editor which field to flag and what to say. Anything else
is normalised by [`ProfilesEngine`](../services/profiles-engine.md)
into `{ field: "key", message: "Provider validation failed" }`.

### Call shapes

```ts
type ProviderCredentials = {
  baseUrl: string;
  apiKey?: string;     // optional for keyless local providers
};

type SendMessageArgs = {
  messages: ThreadMessageLike[];
  model: string;
  systemPrompt: string;
  tools?: TMCPItem[];
  withReasoning?: boolean;
  signal?: AbortSignal;
};

type SendMessageSyncArgs = {
  messages: ThreadMessageLike[];
  model: string;
  systemPrompt: string;
  signal?: AbortSignal;
};

type SendMessageResult =
  | ThreadMessageLike                                    // intermediate: deltas, tool calls, reasoning
  | { isEnd: true; responseMessage: ThreadMessageLike }; // terminal

type ImageGenerationArgs = {
  model: string;
  prompt: string;
  width?: number;
  height?: number;
  signal?: AbortSignal;
};
```

`sendMessage` is an `AsyncGenerator` — each iteration yields one
event. The terminal `isEnd` event closes the stream and carries
the final assistant message. Cancelled streams yield a terminal
event with `responseMessage.status.reason === "stop"`; errored
streams use `"error"`. The provider folder's `stream.ts` (e.g.
[`anthropic/stream.ts`](../../../src/core/providers/anthropic/stream.ts))
owns those response-shape factories.

---

## Registry

> Source: [`registry.ts`](../../../src/core/providers/registry.ts)

A flat, in-memory registry keyed by provider type string. Built-in
providers are checked first; custom ones are layered on top.

### Public API

```ts
function createProvider(
  type: string,
  creds: { baseUrl: string; apiKey?: string }
): AbstractBaseProvider | undefined;

function getProvider(type: string): ProviderConstructor | undefined;
function isValidProviderType(type: string): boolean;
function getSupportedProviderTypes(): string[];

function registerProvider(type: string, ctor: ProviderConstructor): void;
function unregisterProvider(type: string): void;
```

| Function                       | Use it when |
| ------------------------------ | ----------- |
| `createProvider`               | You have credentials and want a usable instance — actions call this via `providerFor` |
| `getProvider`                  | You need the static side (`checkProvider`, `getProviderModels`) — `ProfilesEngine` calls this |
| `isValidProviderType`          | Validating user-typed provider strings before persisting |
| `getSupportedProviderTypes`    | Populating the provider dropdown in the profile editor |
| `registerProvider`             | Adding a custom provider before the widget mounts |
| `unregisterProvider`           | Tearing down a custom provider in tests / hot-reload paths |

### Built-in providers

```ts
const builtinProviders: Record<ProviderType, ProviderConstructor> = {
  onlyoffice: OnlyOfficeProvider,
  anthropic: AnthropicProvider,
  ollama: OllamaProvider,
  openai: OpenAIProvider,
  openaicompatible: OpenAICompatibleProvider,
  together: TogetherProvider,
  openrouter: OpenRouterProvider,
  genai: GenAIProvider,
  deepseek: DeepSeekProvider,
  xai: XAIProvider,
  "lm-studio": LMStudioProvider,
  mistral: MistralProvider,
  groq: GroqProvider,
  zhipu: ZhipuProvider,
  stabilityai: StabilityAIProvider,
  gpt4all: GPT4AllProvider,
};
```

Built-ins are import-time registrations — they're always
available, you don't call `registerProvider` for them. Custom
providers go into a separate `Map<string, ProviderConstructor>`
that `getProvider` checks as a fallback.

### Type aliases

[`BaseProvider`](../../../src/core/providers/registry.ts) is an
alias for `ProviderConstructor`. It exists because the public SDK
re-exports the type and we want a stable public name; structurally
both refer to the same shape.

---

## Custom providers

Implement the contract, register at runtime:

```ts
import {
  AbstractBaseProvider,
  registerProvider,
  type ProviderConstructor,
} from "@onlyoffice/ai-chat";

class MyProvider extends AbstractBaseProvider {
  async *sendMessage(args) { /* yield SendMessageResult events */ }
  async sendMessageSync(args) { /* return string */ }

  static getName() { return "My Custom Provider"; }
  static getBaseUrl() { return "https://api.example.com"; }
  static async checkProvider(creds) {
    // returns true | TErrorData
  }
  static async getProviderModels(creds) { /* return Model[] */ }
}

// `satisfies` lets TS verify the static contract without losing the class type
const Ctor: ProviderConstructor = MyProvider;
registerProvider("my-custom", Ctor);
```

Once registered, the type string `"my-custom"` is treated like any
built-in: `createProvider("my-custom", creds)` returns an
instance, profiles can persist it, the registry's
`getSupportedProviderTypes` includes it.

For complete examples and lifecycle guidance see
[`docs/providers.md`](../../providers.md).

---

## Error helpers

> Source: [`errors.ts`](../../../src/core/providers/errors.ts)

Provider classes ultimately need to return `boolean | TErrorData`
from `checkProvider` and well-formed terminal events from streams.
The error helpers in this module collapse the long tail of SDK /
HTTP error shapes into the small set of `TErrorData` values the
profile editor knows how to render.

### `ProviderErrors`

Factory functions for the four canonical failure modes:

```ts
ProviderErrors.invalidKey(message?: string): TErrorData;     // { field: "key", message }
ProviderErrors.emptyKey(): TErrorData;                       // { field: "key", message: "Empty key" }
ProviderErrors.invalidUrl(message?: string): TErrorData;    // { field: "url", message }
ProviderErrors.connectionFailed(message?: string): TErrorData; // { field: "url", message: "Failed to connect" }
```

Use these instead of inlining `TErrorData` literals — they keep
field assignment and default messaging consistent across
providers.

### Extractors

```ts
extractErrorMessage(error: unknown): string | undefined;
getErrorStatus(error: unknown): number | undefined;
getErrorCode(error: unknown): string | number | undefined;
```

- `extractErrorMessage` understands two shapes: Anthropic's
  nested `error.error.error.message` and the standard
  `error.message`. Returns the deepest message it can find.
- `getErrorStatus` reads `status` if present and numeric — useful
  for branching on `401` (auth) vs `404` (URL).
- `getErrorCode` reads OpenAI-style `code`, plus a special case
  that maps `"Connection error."` to `404` so the URL field gets
  flagged.

### `mapFetchError`

End-to-end translation from a caught SDK / fetch error to a
`TErrorData`:

```ts
mapFetchError(error: unknown, hasApiKey?: boolean): TErrorData;
```

Decision tree:

```
status === 0 OR error.cause exists  →  connectionFailed()      // network died
status === 401                       →  invalidKey(message)     // auth
status === 404                       →  invalidUrl()            // URL wrong
!hasApiKey                           →  emptyKey()              // no key supplied
extractErrorMessage(error)           →  invalidKey(message)
status (any)                         →  invalidKey("Request failed with status N")
fallback                             →  invalidKey()
```

Most providers don't call `mapFetchError` directly — they have
custom branches in `checkProvider` for the specific HTTP / SDK
errors their backend emits. Use `mapFetchError` when you're
adding a new provider and don't yet know the full failure
landscape; tighten with explicit branches as real failures show
up.

---

## Why providers are stateless

The instance only holds `creds` (and an SDK client built from
them). Every call takes its data as arguments — `messages`,
`model`, `systemPrompt`, `tools`, etc. The benefit is operational:

- **Concurrency is free.** Two calls on the same provider
  instance don't share mutable state; they just share an SDK
  client.
- **Cancellation is per-call.** Pass `signal` and abort it; no
  per-instance "current request" field to clean up.
- **Hot-swap credentials = build a new instance.** Cheap, and
  it leaves any in-flight call on the old instance alone.

The `imageGeneration?` opt-in is the only differentiation: image-only
providers (Stability AI) implement just that, and chat providers
(every other built-in) usually skip it. OpenAI is the exception
— it implements `imageGeneration` because the SDK exposes
`images.generate` on the same client.

---

## Layering

```
core/services      ◄── high-level orchestration (storage + actions + persistence)
   │
   ▼
core/actions      ◄── one function per "kind of call" (chat, summarize, …)
   │  providerFor(args) → createProvider(profile.providerType, creds)
   ▼
core/providers    ◄── stateless thin clients per AI service
   │
   ▼
provider SDKs     ◄── @anthropic-ai/sdk, openai, @google/genai, …
```

Engines decide *which* profile to use and *what* to persist;
actions decide *what kind* of call it is and *which prompt* to
attach; providers know *how* to make the call against a specific
SDK. New SDK arrivals plug into the bottom of the stack without
disturbing anything above.
