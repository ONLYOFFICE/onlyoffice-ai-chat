# Provider System

The provider system abstracts AI service integrations behind a unified interface. The library ships 16 built-in providers and supports runtime registration of custom providers.

## Built-in Providers

| Type | Display Name | SDK / Protocol | Base URL |
|------|-------------|----------------|----------|
| `openai` | OpenAI | `openai` | `https://api.openai.com/v1` |
| `anthropic` | Anthropic | `@anthropic-ai/sdk` | `https://api.anthropic.com` |
| `genai` | Google AI | `@google/generative-ai` | `https://generativelanguage.googleapis.com` |
| `mistral` | Mistral | `@mistralai/mistralai` | `https://api.mistral.ai` |
| `stabilityai` | Stability AI | REST (image-only) | `https://api.stability.ai` |
| `ollama` | Ollama | OpenAI-compatible | `http://localhost:11434/v1` |
| `deepseek` | DeepSeek | OpenAI-compatible | `https://api.deepseek.com` |
| `xai` | xAI | OpenAI-compatible | `https://api.x.ai/v1` |
| `groq` | Groq | OpenAI-compatible | `https://api.groq.com/openai/v1` |
| `openrouter` | OpenRouter | OpenAI-compatible | `https://openrouter.ai/api/v1` |
| `together` | TogetherAI | OpenAI-compatible | `https://api.together.xyz/v1` |
| `zhipu` | Zhipu | OpenAI-compatible | `https://open.bigmodel.cn/api/paas/v4` |
| `lm-studio` | LM Studio | OpenAI-compatible | `http://localhost:1234/v1` |
| `gpt4all` | GPT4All | OpenAI-compatible | `http://localhost:4891/v1` |
| `openaicompatible` | OpenAI Compatible | OpenAI-compatible | (user-defined) |
| `onlyoffice` | ONLYOFFICE AI | OpenAI-compatible | (cloud- or host-defined) |

Most providers extend the OpenAI provider class since many APIs follow the OpenAI-compatible format. Anthropic, Google AI, Mistral, and Stability AI have dedicated implementations using their native SDKs.

## ONLYOFFICE AI — external / cloud configuration

The `onlyoffice` provider is designed to be configured by the host, not by the end user. It never exposes Base URL / API key inputs in the Add/Edit model forms or in the Web Search settings page — those credentials come from one of two sources:

1. **Platform clouds** — each connected cloud portal returned by `PlatformAdapter.clouds.getClouds()` (with a matching entry in `getCloudKeys()`) is surfaced as a provider option. The profile is saved with `isCloudProvider: true`, and the API key is mandatory.

2. **External `onlyofficeConfig` prop** — the widget accepts an `onlyofficeConfig?: { baseUrl: string; apiKey?: string }` prop. When set, an extra ONLYOFFICE AI entry is injected into the cloud-provider list using that URL (and optionally the key). The key is **optional** in this case: if omitted, the runtime skips the `Authorization: Bearer` header, which is useful when the ONLYOFFICE AI backend is reachable without auth (e.g. same-origin proxy, internal network).

```tsx
import { AIChatWidget } from "@onlyoffice/ai-chat";

<AIChatWidget
  onlyofficeConfig={{
    baseUrl: "https://my-docspace.example.com",
    apiKey: "optional-bearer-token",
  }}
  // ...other props
/>
```

Once the user selects this provider in **Settings → AI Models** or **Settings → Web Search**, the URL/Key fields are hidden in the form and the profile is saved with `isCloudProvider: true`. The selection is picked up by:

- `OnlyOfficeProvider` for chat/models (`POST /api/2.0/ai/openai/-1/v1/chat/completions`).
- The web-search tool (`POST /api/2.0/ai/web-search/v1/search` and `/contents`).

Both sites honour the optional key — if the stored key is empty, the `Authorization` header is omitted.

> **Note:** the `id` of the built-in ONLYOFFICE AI web-search option is still `"ONLYOFFICE"` for backward compatibility; only the display label was renamed. Existing stored `webSearchProviderData` entries continue to work.


## Provider Profiles

A `Profile` is a saved configuration that pairs a provider type with connection credentials and a selected model:

```ts
import type { Profile } from "@onlyoffice/ai-chat";

const profile: Profile = {
  id: "prof-1",
  name: "Claude Sonnet",
  providerType: "anthropic",
  baseUrl: "https://api.anthropic.com",
  key: "sk-ant-...",
  modelId: "claude-sonnet-4-20250514",
  reasoning: true,
  capabilities: 0b0001_0011,
};
```

A `TProvider` is the minimal connection config derived from a profile:

```ts
import type { TProvider } from "@onlyoffice/ai-chat";

const provider: TProvider = {
  type: "openai",
  name: "My OpenAI",
  baseUrl: "https://api.openai.com/v1",
  key: "sk-...",
};
```

When the user selects a profile, the widget extracts a `TProvider` and calls `Provider.setCurrentProvider()` to configure the active provider instance.

## Provider Facade (`Provider` class)

The `Provider` class is a high-level facade that manages the currently active provider. It delegates to the concrete `BaseProvider` instance returned by the registry:

```ts
import Provider from "@onlyoffice/ai-chat/providers";

const facade = new Provider();
facade.setCurrentProvider({ type: "openai", name: "GPT", baseUrl: "...", key: "..." });
facade.setCurrentProviderModel("gpt-4o");

// Stream a response
for await (const chunk of facade.sendMessage(messages)) {
  // handle chunk
}

// Get all provider metadata
const infos = facade.getProvidersInfo();
// => [{ type: "openai", name: "OpenAI", baseUrl: "..." }, ...]
```

## Registry Functions

### `getProvider(type: string): BaseProvider | undefined`

Look up a provider by its type string. Checks built-in providers first, then custom providers.

```ts
import { getProvider } from "@onlyoffice/ai-chat";

const openai = getProvider("openai");
const models = await openai?.getProviderModels({ url: "https://api.openai.com/v1", apiKey: "sk-..." });
```

### `createProvider(type: string): BaseProvider | undefined`

Create a fresh, isolated provider instance (not the shared singleton). Only works for built-in types.

```ts
import { createProvider } from "@onlyoffice/ai-chat";

const isolated = createProvider("anthropic");
isolated?.setApiKey("sk-ant-...");
```

### `getSupportedProviderTypes(): string[]`

Returns all registered provider type strings (built-in + custom).

### `isValidProviderType(type: string): boolean`

Checks whether a type string maps to a known provider.

### `registerProvider(type: string, provider: BaseProvider): void`

Register a custom provider at runtime.

### `unregisterProvider(type: string): void`

Remove a previously registered custom provider.

## Custom Provider Tutorial

To add a custom provider, extend `AbstractBaseProvider` and implement all abstract methods:

```ts
import {
  AbstractBaseProvider,
  registerProvider,
} from "@onlyoffice/ai-chat";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Model, TMCPItem, TProvider } from "@onlyoffice/ai-chat";

type MyTool = { name: string; description: string };
type MyMessage = { role: string; content: string };
type MyClient = { chat(msgs: MyMessage[]): AsyncIterable<string> };

class MyProvider extends AbstractBaseProvider<MyTool, MyMessage, MyClient> {
  constructor() {
    super();
    this.client = createMyClient();
  }

  // Required: configure from a saved profile
  setProvider(provider: TProvider): void {
    this.url = provider.baseUrl;
    this.apiKey = provider.key;
  }

  // Required: convert thread history to native format
  setPrevMessages(prevMessages: ThreadMessageLike[]): void {
    this.prevMessages = prevMessages.map(convertToMyFormat);
  }

  // Required: convert MCP tools to native format
  setTools(tools: TMCPItem[]): void {
    this.tools = tools.map(convertToolToMyFormat);
  }

  getName(): string { return "My LLM"; }
  getBaseUrl(): string { return "https://api.my-llm.com"; }

  async createChatName(message: string): Promise<string> {
    return message.slice(0, 50);
  }

  async *sendMessage(
    messages: ThreadMessageLike[],
  ): AsyncGenerator<ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }> {
    this.stopFlag = false;
    const nativeMessages = messages.map(convertToMyFormat);
    const stream = this.client!.chat(nativeMessages);

    let fullText = "";
    for await (const chunk of stream) {
      if (this.stopFlag) break;
      fullText += chunk;
      yield { role: "assistant", content: [{ type: "text", text: fullText }] };
    }

    const final: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: fullText }],
    };
    yield { isEnd: true, responseMessage: final };
  }

  async *sendMessageAfterToolCall(
    message: ThreadMessageLike,
  ): AsyncGenerator<ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }> {
    yield* this.sendMessage([...this.prevMessages as unknown as ThreadMessageLike[], message]);
  }

  async checkProvider(data: { url: string; apiKey?: string }) {
    // Validate credentials; return true or { field, message }
    return true;
  }

  async getProviderModels(data: { url: string; apiKey?: string }): Promise<Model[]> {
    return [{ id: "my-model-v1", name: "My Model v1", provider: "my-llm" }];
  }
}

// Register at app startup
registerProvider("my-llm", new MyProvider());
```

After registration, the type `"my-llm"` works everywhere: profiles, threads, model selection, and the `Provider` facade.
