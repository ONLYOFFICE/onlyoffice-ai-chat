# Built-in providers — per-provider reference

> Sources: [`src/core/providers/<name>/`](../../../src/core/providers)

The library ships with 17 built-in provider implementations,
registered import-time in
[`registry.ts`](../../../src/core/providers/registry.ts). All
satisfy the [contract](./providers.md#the-contract) defined in
[`base.ts`](../../../src/core/providers/base.ts).

## Summary table

| Type                | Display name      | Base URL                                              | Parent class           | Streams chat | One-shot text | Image gen | Tools |
| ------------------- | ----------------- | ----------------------------------------------------- | ---------------------- | :----------: | :-----------: | :-------: | :---: |
| `anthropic`         | Anthropic         | `https://api.anthropic.com`                            | `AbstractBaseProvider` | ✅           | ✅            |           | ✅    |
| `openai`            | OpenAI            | `https://api.openai.com/v1`                            | `AbstractBaseProvider` | ✅           | ✅            | ✅        | ✅    |
| `genai`             | Google AI         | `https://generativelanguage.googleapis.com`            | `AbstractBaseProvider` | ✅           | ✅            |           | ✅    |
| `mistral`           | Mistral           | `https://api.mistral.ai`                               | `AbstractBaseProvider` | ✅           | ✅            |           | ✅    |
| `stabilityai`       | Stability AI      | `https://api.stability.ai`                             | `AbstractBaseProvider` |             |               | ✅        |       |
| `onlyoffice`        | ONLYOFFICE AI     | host-supplied (transformed)                            | `OpenAIProvider`       | ✅ (custom SSE) | ✅          | ✅        | ✅    |
| `deepseek`          | DeepSeek          | `https://api.deepseek.com`                              | `OpenAIProvider`       | ✅           | ✅            | ✅        | ✅    |
| `gpt4all`           | GPT4All           | `http://localhost:4891/v1`                             | `OpenAIProvider`       | ✅           | ✅            | ✅        | ✅    |
| `groq`              | Groq              | `https://api.groq.com/openai/v1`                       | `OpenAIProvider`       | ✅           | ✅            | ✅        | ✅    |
| `lm-studio`         | LM Studio         | `http://localhost:1234/v1`                             | `OpenAIProvider`       | ✅           | ✅            | ✅        | ✅    |
| `ollama`            | Ollama            | `http://localhost:11434/v1`                            | `OpenAIProvider`       | ✅           | ✅            | ✅        | ✅    |
| `openaicompatible`  | OpenAI Compatible | host-supplied                                          | `OpenAIProvider`       | ✅           | ✅            | ✅        | ✅    |
| `openrouter`        | OpenRouter        | `https://openrouter.ai/api/v1`                          | `OpenAIProvider`       | ✅           | ✅            | ✅        | ✅    |
| `together`          | TogetherAI        | `https://api.together.xyz/v1`                          | `OpenAIProvider`       | ✅           | ✅            | ✅        | ✅    |
| `xai`               | xAI               | `https://api.x.ai/v1`                                   | `OpenAIProvider`       | ✅           | ✅            | ✅        | ✅    |
| `zhipu`             | Zhipu             | `https://open.bigmodel.cn/api/paas/v4`                  | `OpenAIProvider`       | ✅           | ✅            | ✅        | ✅    |
| `external`          | External          | host-supplied (via `PlatformAdapter.externalFetch`)     | delegated via `basedOn` | depends on `basedOn` | depends on `basedOn` | depends on `basedOn` | depends on `basedOn` |

> **Image generation** in this table refers to the optional
> `imageGeneration(args)` method. Most OpenAI-compatible providers
> inherit it from `OpenAIProvider`, which routes to
> `images.generate` on the underlying SDK client. Whether the
> provider's *backend* actually serves that endpoint is a
> different question — only the provider authors know which
> models exist on the other side.

> **Tools** means the provider implements the streaming
> tool-call protocol (i.e. surfaces `tool_use` / `tool_result`
> events from `sendMessage`). Stability AI is image-only and has
> no chat surface at all.

---

## Anthropic

> Source: [`anthropic/`](../../../src/core/providers/anthropic)

| Field                  | Value |
| ---------------------- | ----- |
| Type                   | `anthropic` |
| SDK                    | `@anthropic-ai/sdk` |
| Parent class           | `AbstractBaseProvider` |
| Streaming              | ✅ via `client.messages.create({ stream: true })` |
| Reasoning              | ✅ — toggles `thinking: { type: "enabled", budget_tokens: 10000 }` |
| Max tokens             | `16000` with reasoning, `30000` without |
| Tools                  | ✅ — `tool_choice: { disable_parallel_tool_use: true, type: "auto" }` |
| `imageGeneration`      | — |
| `checkProvider` strategy | `client.models.list()` round-trip; HTTP `401` → invalidKey, `404` / `cause` set → invalidUrl |

The streaming pipeline lives in
[`anthropic/stream.ts`](../../../src/core/providers/anthropic/stream.ts);
message conversion (assistant-ui shape ↔ Anthropic content
blocks) in [`messages.ts`](../../../src/core/providers/anthropic/messages.ts);
tool conversion in [`tools.ts`](../../../src/core/providers/anthropic/tools.ts).

`info.ts` lists `thinkingModels` so the model picker can highlight
which models support extended thinking.

---

## OpenAI

> Source: [`openai/`](../../../src/core/providers/openai)

| Field                  | Value |
| ---------------------- | ----- |
| Type                   | `openai` |
| SDK                    | `openai` |
| Parent class           | `AbstractBaseProvider` |
| Streaming              | ✅ via `chat.completions.create({ stream: true })` |
| Reasoning              | ✅ — sets `reasoning_effort: "medium"` |
| Tools                  | ✅ |
| `imageGeneration`      | ✅ — `images.generate({ size, response_format: "b64_json" })`, returns base64 |
| `checkProvider` strategy | `client.models.list()`; OpenAI error code `invalid_api_key` → invalidKey, `404` → invalidUrl |

The streaming step is encapsulated in `getStream(params)` so
subclasses can override transport (the ONLYOFFICE provider does
exactly that). `convertMessages` lives in
[`openai/messages.ts`](../../../src/core/providers/openai/messages.ts);
tools in [`tools.ts`](../../../src/core/providers/openai/tools.ts).
The system prompt is prepended to `messages` rather than passed
as a separate `system` field — that's the OpenAI chat-completions
shape.

`imageGeneration` accepts `width` / `height` and maps to
OpenAI's allow-list of sizes (`256x256`, `512x512`, `1024x1024`,
`1792x1024`, `1024x1792`); falls back to `1024x1024` if either
dimension is omitted.

---

## Google AI (`genai`)

> Source: [`genai/`](../../../src/core/providers/genai)

| Field                  | Value |
| ---------------------- | ----- |
| Type                   | `genai` |
| SDK                    | `@google/genai` |
| Parent class           | `AbstractBaseProvider` |
| Reasoning              | ✅ — uses Google's `ThinkingLevel` enum |
| Tools                  | ✅ |
| `imageGeneration`      | — |

Folder layout matches Anthropic / OpenAI: `client.ts` builds the
SDK client, `messages.ts` / `tools.ts` translate shapes, `stream.ts`
emits `SendMessageResult` events, `models.ts` lists models and
runs the credential check.

---

## Mistral

> Source: [`mistral/`](../../../src/core/providers/mistral)

| Field                  | Value |
| ---------------------- | ----- |
| Type                   | `mistral` |
| SDK                    | `@mistralai/mistralai` |
| Parent class           | `AbstractBaseProvider` |
| Reasoning              | ✅ — `info.reasoningModels` is a `[level, modelId][]` table; `resolveReasoningModel` swaps the model based on the user's deep-mode level |
| Tools                  | ✅ |

The reasoning-model swap is unique to Mistral: the user picks a
non-thinking model, but if deep mode is on, the engine picks the
matching `magistral-*` variant from
[`mistral/info.ts`](../../../src/core/providers/mistral/info.ts).

---

## Stability AI

> Source: [`stabilityai/`](../../../src/core/providers/stabilityai)

| Field                  | Value |
| ---------------------- | ----- |
| Type                   | `stabilityai` |
| Parent class           | `AbstractBaseProvider` |
| `sendMessage`          | ❌ throws `"Stability AI does not support chat"` |
| `sendMessageSync`      | ❌ throws `"Stability AI does not support chat"` |
| `imageGeneration`      | ✅ via raw fetch against the `/v2beta/stable-image/generate/...` endpoints |
| Models                 | Hard-coded in `info.ts` (`sd3`, `core`, `ultra`) — no remote model list call |

The only image-only built-in. Use it through the
[`ImageGeneration`](../../../src/tools/sources/ImageGeneration.ts)
tool source rather than chat actions; profiles using this provider
should not be assigned to chat slots.

---

## ONLYOFFICE AI

> Source: [`onlyoffice/`](../../../src/core/providers/onlyoffice)

| Field                  | Value |
| ---------------------- | ----- |
| Type                   | `onlyoffice` |
| Parent class           | `OpenAIProvider` |
| Base URL transform     | `<host>` → `<host>/api/2.0/ai/openai/-1/v1` (see `transformBaseUrl` in `index.ts`) |
| Streaming              | Custom — overrides `getStream(params)` to use raw fetch + manual SSE reader (`openSSEStream`) instead of the OpenAI SDK |
| `sendMessageSync`      | Custom override — direct `chat.completions.create({ stream: false })` call against the transformed URL |

The custom SSE reader exists because the ONLYOFFICE host emits
non-standard error frames inside the SSE stream that the OpenAI
SDK does not surface cleanly. Everything else is inherited from
`OpenAIProvider`.

---

## OpenAI-compatible thin subclasses

Eleven providers expose an OpenAI-compatible API and ride on
`OpenAIProvider` with minimal overrides — typically just static
identity (`getName`, `getBaseUrl`) and a `getProviderModels` that
points at the provider's model list endpoint.

| Type                | Display name      | Base URL                                              | Folder |
| ------------------- | ----------------- | ----------------------------------------------------- | ------ |
| `deepseek`          | DeepSeek          | `https://api.deepseek.com`                              | [`deepseek/`](../../../src/core/providers/deepseek) |
| `gpt4all`           | GPT4All           | `http://localhost:4891/v1`                             | [`gpt4all/`](../../../src/core/providers/gpt4all) |
| `groq`              | Groq              | `https://api.groq.com/openai/v1`                       | [`groq/`](../../../src/core/providers/groq) |
| `lm-studio`         | LM Studio         | `http://localhost:1234/v1`                             | [`lm-studio/`](../../../src/core/providers/lm-studio) |
| `ollama`            | Ollama            | `http://localhost:11434/v1`                            | [`ollama/`](../../../src/core/providers/ollama) |
| `openaicompatible`  | OpenAI Compatible | (host-supplied — no default)                           | [`openaicompatible/`](../../../src/core/providers/openaicompatible) |
| `openrouter`        | OpenRouter        | `https://openrouter.ai/api/v1`                          | [`openrouter/`](../../../src/core/providers/openrouter) |
| `together`          | TogetherAI        | `https://api.together.xyz/v1`                          | [`together/`](../../../src/core/providers/together) |
| `xai`               | xAI               | `https://api.x.ai/v1`                                   | [`xai/`](../../../src/core/providers/xai) |
| `zhipu`             | Zhipu             | `https://open.bigmodel.cn/api/paas/v4`                  | [`zhipu/`](../../../src/core/providers/zhipu) |

A typical thin subclass:

```ts
class DeepSeekProvider extends OpenAIProvider {
  static override getName() { return deepseekInfo.name; }
  static override getBaseUrl() { return deepseekInfo.baseUrl; }
  static override async getProviderModels(creds) { return listModels(creds); }
}
```

Two things to watch for when extending:

- **`checkProvider` is inherited.** OpenAI-compatible backends
  should respond correctly to `client.models.list()`. If yours
  doesn't (e.g. requires a custom auth header), override
  `checkProvider` and reach for the
  [`ProviderErrors`](./providers.md#providererrors) helpers.
- **Local providers might want `apiKey` left empty.** OpenAI's
  SDK requires *some* string; the convention in this codebase is
  to pass the literal string `"none"` for keyless local backends.
  Folder-level `client.ts` (when present) handles that.

The thin subclasses also inherit `imageGeneration` from
`OpenAIProvider` — meaning the method *exists* on the instance,
but whether the backend serves OpenAI's `/v1/images/generations`
shape is up to that backend. Most don't; for those, either
override `imageGeneration` to throw or use a different provider
(typically `stabilityai`) for image flows.

---

## External

> Source: [`external/`](../../../src/core/providers/external)

| Field                  | Value |
| ---------------------- | ----- |
| Type                   | `external` |
| SDK                    | — (delegated to `basedOn`) |
| Parent class           | `AbstractBaseProvider` |
| Transport              | host-supplied via [`PlatformAdapter.externalFetch`](../../adapters.md#externalfetch) |
| Streaming / sync       | delegated to the inner provider class chosen by `Profile.basedOn` |
| `checkProvider` strategy | delegated to the inner provider |

`ExternalProvider` is a thin delegate: in its constructor it
resolves an inner provider class from `creds.basedOn` (`"openai"`,
`"anthropic"`, `"mistral"` and `"openrouter"` are implemented) and
forwards every call to it. The inner SDK receives
`creds.fetch = PlatformAdapter.externalFetch`, so the host owns every
HTTP request while the library reuses the inner provider's existing
stream / sync / image / models parsers.

The remaining `BuiltinProviderType` values (`genai`, `stabilityai`,
…) are reserved and not yet wired up.

Configuration shape:

```ts
await api.profiles.add({
  name: "Hosted GPT",
  providerType: "external",
  basedOn: "openai",
  baseUrl: "https://api.openai.com/v1",
  modelId: "gpt-4o-mini",
  key: "sk-...",
});
```

Behavioral notes:

- `Profile.useProxy` is ignored for external profiles; the
  external transport is always `externalFetch`.
- `Profile.basedOn` is required at request time. Reserved values
  other than `"openai"` (e.g. `"anthropic"`, `"mistral"`, `"genai"`)
  throw a clear `ExternalProvider: basedOn "<name>" is not supported yet`
  error.
- `imageGeneration` is forwarded only when the inner provider
  implements it; otherwise it throws.

---

## A note on `info.ts` extras

Each `info.ts` exports the `name` + `baseUrl` for the static
side, but several also carry per-provider hints used elsewhere
in the codebase:

| Provider     | Extra field            | Purpose |
| ------------ | ---------------------- | ------- |
| `anthropic`  | `thinkingModels`       | Highlight reasoning-capable models in the picker |
| `openai`     | `reasoningModels`      | Same idea, GPT-5.x family |
| `mistral`    | `reasoningModels`      | `[level, modelId][]` mapping for deep-mode model swap |
| `openrouter` | `reasoningModels`      | Reasoning models accessible through OpenRouter routing |
| `stabilityai`| `models`               | Hard-coded model list with per-model `endpoint` paths |

These fields are not part of `ProviderConstructor` — they're
internal hints consumed by sibling files (model picker,
deep-mode resolver, image-generation router) and are safe to
extend per-provider without touching the abstract contract.
