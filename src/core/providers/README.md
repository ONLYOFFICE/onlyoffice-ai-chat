# `core/providers`

Stateless thin clients that translate our internal call shape
(`SendMessageArgs`, `SendMessageSyncArgs`, `ImageGenerationArgs`)
into a concrete provider SDK call. 16 built-in providers ship out
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

## Full documentation

See [`docs/core/providers/`](../../../docs/core/providers/README.md):

- [`providers.md`](../../../docs/core/providers/providers.md) —
  base class, registry, error helpers, how to write a custom
  provider.
- [`built-in.md`](../../../docs/core/providers/built-in.md) —
  per-provider notes: identity, transport, capabilities, quirks.
