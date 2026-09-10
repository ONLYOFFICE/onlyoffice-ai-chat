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
| Reasoning              | ✅ — adaptive thinking + `output_config.effort` on 4.6+, a per-level `budget_tokens` before; see [Extended thinking depth](#extended-thinking-depth) |
| Max tokens             | `32000` with reasoning, `30000` without |
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
| Reasoning              | ✅ — `reasoning_effort` from the level (`none` … `xhigh`); see [Extended thinking depth](#extended-thinking-depth) |
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
| Reasoning              | ✅ — `thinkingLevel` from the level on every thinking model (2.5 and 3.x); off is `thinkingBudget: 0` on 2.5 Flash, the only Gemini with an off switch; see [Extended thinking depth](#extended-thinking-depth) |
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
| Reasoning              | ✅ — on/off only: `info.reasoningModels` is a `[sizeHint, modelId][]` table and `resolveReasoningModel` swaps to the Magistral variant for any level above off |
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
| Reasoning              | ✅ — the route proxies OpenRouter one-to-one, so it uses OpenRouter's unified `reasoning` object and per-route table (`openrouter/reasoning.ts`) and, like OpenRouter, stays on `/chat/completions` (no Responses probe); see [Extended thinking depth](#extended-thinking-depth) |

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

## Extended thinking depth

Every provider receives the same provider-neutral
`ReasoningLevel` (`off` / `low` / `medium` / `high` / `max`) through
`SendMessageArgs.reasoningLevel` — the legacy `withReasoning` boolean
still works and means `medium`. Each provider maps it onto its own knob
and **clamps to the nearest level the model accepts** rather than
sending a value the API would reject:

| Provider | Knob | off | low | medium | high | max |
| --- | --- | --- | --- | --- | --- | --- |
| Anthropic 4.6+ / 5 / Fable | `thinking: adaptive` + `output_config.effort` | `disabled` (`effort: medium` on Fable / Mythos, which cannot stop) | `low` | `medium` | `high` | `max` |
| Anthropic ≤ 4.5 | `thinking: enabled` + `budget_tokens` | omitted | 4000 | 10000 | 20000 | 28000 |
| OpenAI gpt-5.1+ | `reasoning_effort` | `none` | `low` | `medium` | `high` | `max` (5.5+), `xhigh` (5.2+, codex-max), else `high` |
| OpenAI gpt-6 | `reasoning_effort` | `minimal` (no `none`) | `low` | `medium` | `high` | `max` |
| OpenAI gpt-5.0 | `reasoning_effort` | `medium` (no `none`) | `low` | `medium` | `high` | `high` |
| OpenAI o-series | `reasoning_effort` | `medium` (no `none`) | `low` | `medium` | `high` | `high` |
| OpenAI `*-pro` | `reasoning_effort` | `medium` (never lower) | `medium` | `medium` | `high` | `max` / `xhigh` / `high` per family |
| OpenAI-compatible backends, unknown ids | `reasoning_effort` | omitted | `low` | `medium` | `high` | `high` |
| Google Gemini 3.x | `thinkingLevel` | `MEDIUM` (cannot stop; `HIGH` on 3 Pro preview) | `LOW` | `MEDIUM` (`HIGH` on 3 Pro preview, which has no medium) | `HIGH` | `HIGH` |
| Google Gemini 2.5 | `thinkingLevel` | `thinkingBudget: 0` (Flash) / `MEDIUM` (Pro, cannot stop) | `LOW` | `MEDIUM` | `HIGH` | `HIGH` |
| OpenRouter | `reasoning.effort` | `none` (`medium` on `x-ai/*` and Claude Fable / Mythos, which cannot stop) | `low` | `medium` | `high` | `xhigh` (`high` on `google/*`) |
| DeepSeek V4 | `thinking.type` + `reasoning_effort` | `disabled` | `low` | enabled, default depth | `high` | `max` |
| DeepSeek `deepseek-reasoner` | — | omitted (thinks always) | — | — | — | — |
| Groq Qwen 3.8+ | `reasoning_effort` | `none` | `low` | `default` | `high` | `high` |
| Groq other Qwen (qwen3-32b, 3.6) | `reasoning_effort` | `none` | `default` | `default` | `default` | `default` |
| Groq GPT-OSS | `reasoning_effort` | `medium` (cannot stop) | `low` | `medium` | `high` | `high` |
| xAI grok-4.5+ | `reasoning_effort` | `medium` (cannot stop) | `low` | `medium` | `high` | `xhigh` (4.6+) else `high` |
| xAI grok-3-mini | `reasoning_effort` | `high` (cannot stop, no medium) | `low` | `high` | `high` | `high` |
| xAI grok-4 / 4.1 / code-fast | — | omitted (reject the parameter) | — | — | — | — |
| Zhipu GLM-4.5+ | `thinking.type` | `disabled` | `enabled` | `enabled` | `enabled` | `enabled` |
| Mistral | model swap | original model | Magistral | Magistral | Magistral | Magistral |

Ollama, LM Studio, GPT4All, Together and the generic OpenAI-compatible
provider inherit the OpenAI row; ONLYOFFICE, a one-to-one proxy in front
of OpenRouter, inherits the OpenRouter row. Models without thinking
receive no field at all, as before.

OpenRouter's `/models` catalogue (and the ONLYOFFICE route, which proxies
it one-to-one) reports a per-model `reasoning` object —
`{ mandatory, default_enabled, supported_efforts, default_effort }` —
which `reasoningSupportFromCatalog` turns into a `ReasoningSupport`
stored on the model and copied onto the profile at save time
(`Model.reasoningSupport` / `Profile.reasoningSupport`). Where present it
overrides the id-based table: `mandatory` is the off switch (a request with
`effort: "none"` on a mandatory model is a 400), `supported_efforts` the
depths, `default_effort` what a stored off means on a mandatory model.

The same table drives the composer. Each provider folder has an SDK-free
`reasoning.ts` exporting `get<Provider>ReasoningSupport(model)` — a
`ReasoningSupport` record (`thinks`, `canDisable`, `depths`) — which the
registry serves synchronously through `getReasoningSupport(type, model)`
and the request builders clamp to (`clampReasoningLevel`: nearest listed
depth, ties upward). The composer's Effort row hides for a model that cannot
think, lists no Off where thinking cannot be switched off (the "i" note
says so; a stored off then means the standard depth, `medium` clamped to
the model, on the wire and in the row alike — `effectiveReasoningLevel`), lists Off / On where
there is a switch but no depth, and otherwise exactly the depths the
model distinguishes; its value is the depth the model actually runs. A custom provider
joins in by declaring the optional static `getReasoningSupport`.

## A note on `info.ts` extras

Each `info.ts` exports the `name` + `baseUrl` for the static
side, but several also carry per-provider hints used elsewhere
in the codebase:

| Provider     | Extra field            | Purpose |
| ------------ | ---------------------- | ------- |
| `anthropic`  | `thinkingModels`       | Highlight reasoning-capable models in the picker |
| `openai`     | `reasoningModels`      | Same idea, GPT-5.x family |
| `mistral`    | `reasoningModels`      | `[level, modelId][]` mapping for deep-mode model swap |
| `openrouter` | `reasoningModels`      | Fallback reasoning flag for catalogues that predate the per-model `reasoning` object |
| `stabilityai`| `models`               | Hard-coded model list with per-model `endpoint` paths |

These fields are not part of `ProviderConstructor` — they're
internal hints consumed by sibling files (model picker,
deep-mode resolver, image-generation router) and are safe to
extend per-provider without touching the abstract contract.
