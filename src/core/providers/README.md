# `core/providers`

Stateless thin clients that translate our internal call shape
(`SendMessageArgs`, `SendMessageSyncArgs`, `ImageGenerationArgs`)
into a concrete provider SDK call. 17 built-in providers ship out
of the box, plus a runtime registry for adding your own.

| Layer                                    | File                          | Purpose |
| ---------------------------------------- | ----------------------------- | ------- |
| Base contract                            | [`base.ts`](./base.ts)        | `AbstractBaseProvider` (instance) + `ProviderConstructor` (static) |
| Built-in registry                        | [`registry.ts`](./registry.ts) | `createProvider` / `getProvider` / `registerProvider` / `unregisterProvider` |
| Error normalization                      | [`errors.ts`](./errors.ts)    | `ProviderErrors`, `mapFetchError`, `extractErrorMessage`, `getErrorStatus`, `getErrorCode` |
| Built-in implementations                 | one folder per provider       | 16 implementations (Anthropic, OpenAI, Ollama, …) |

Each provider exposes `sendMessage` (streaming), `sendMessageSync`
(one-shot text), and optionally `imageGeneration`. The static
side adds `getName`, `getBaseUrl`, `checkProvider`, and
`getProviderModels` for credential validation and model discovery.

OpenAI-compatible providers (DeepSeek, GPT4All, Groq, LM Studio,
Ollama, OpenRouter, Together, xAI, Zhipu, OpenAICompatible,
ONLYOFFICE) inherit the full pipeline from `OpenAIProvider` and
override only static identity / model lookup.

## Extended thinking depth

Every provider gets the same `ReasoningLevel` (`off` … `max`) via
`SendMessageArgs.reasoningLevel` and maps it onto its own knob,
clamping to what the model accepts. The per-model table lives in the
folder's SDK-free `reasoning.ts` (`get<Provider>ReasoningSupport`),
which the registry serves synchronously to the composer as
`getReasoningSupport(type, model)` and the request builders clamp to. The OpenAI family does it in
`reasoningRequestFields` / `reasoningResponsesFields` (overridden by
OpenRouter, Groq, DeepSeek, xAI, Zhipu); Anthropic and Google in their
`thinking.ts`. The full per-provider table lives in
[`docs/core/providers/built-in.md`](../../../docs/core/providers/built-in.md#extended-thinking-depth).

## Full documentation

See [`docs/core/providers/`](../../../docs/core/providers/README.md):

- [`providers.md`](../../../docs/core/providers/providers.md) —
  base class, registry, error helpers, how to write a custom
  provider.
- [`built-in.md`](../../../docs/core/providers/built-in.md) —
  per-provider notes: identity, transport, capabilities, quirks.
