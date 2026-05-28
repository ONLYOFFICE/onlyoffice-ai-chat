# `core/providers` — full reference

Stateless thin clients that translate the library's internal call
shape into a concrete provider SDK call. 17 built-in providers
plus a runtime registry for custom ones.

| Document                                  | Topic |
| ----------------------------------------- | ----- |
| [`providers.md`](./providers.md)          | Base class, registry, error helpers, custom providers |
| [`built-in.md`](./built-in.md)            | All 17 built-in providers — identity, transport, capabilities, quirks |

## Quick map

```
core/providers
├── base.ts            AbstractBaseProvider + ProviderConstructor (the contract)
├── registry.ts        createProvider / getProvider / register / unregister
├── errors.ts          ProviderErrors, mapFetchError, extractors
│
├── openai/            OpenAIProvider    ◄─ used as base by 11 OpenAI-compatible providers
├── anthropic/         AnthropicProvider ◄─ direct AbstractBaseProvider subclass
├── genai/             GenAIProvider     ◄─ direct AbstractBaseProvider subclass
├── mistral/           MistralProvider   ◄─ direct AbstractBaseProvider subclass
├── stabilityai/       StabilityAIProvider ◄─ image-only
│
├── deepseek/          extends OpenAIProvider
├── gpt4all/           extends OpenAIProvider
├── groq/              extends OpenAIProvider
├── lm-studio/         extends OpenAIProvider
├── ollama/            extends OpenAIProvider
├── onlyoffice/        extends OpenAIProvider (overrides streaming)
├── openaicompatible/  extends OpenAIProvider
├── openrouter/        extends OpenAIProvider
├── together/          extends OpenAIProvider
├── xai/               extends OpenAIProvider
└── zhipu/             extends OpenAIProvider
```

Each provider folder typically contains:

| File           | Role |
| -------------- | ---- |
| `index.ts`     | The provider class itself |
| `info.ts`      | `name` + `baseUrl` for the static side |
| `client.ts`    | SDK client construction (when not inherited) |
| `messages.ts`  | Message converter (assistant-ui ↔ SDK shape) |
| `models.ts`    | Model listing + credential check |
| `stream.ts`    | Stream → `SendMessageResult` translation |
| `tools.ts`     | Tool converter (MCP shape ↔ SDK shape) |
| `tests/`       | Provider-specific Vitest specs |

OpenAI-compatible providers can be much smaller — most inherit
the full pipeline from `OpenAIProvider` and only override static
identity (`getName`, `getBaseUrl`, `getProviderModels`).
