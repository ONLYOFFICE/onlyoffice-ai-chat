# Architecture

High-level overview of how `@onlyoffice/ai-chat` is structured internally.

---

## Adapter Pattern (DI via React Context)

The library never imports a concrete storage engine, settings backend, or
platform capability directly. Instead, three adapter interfaces are injected
via React context:

```
┌──────────────────────────────────────────┐
│           AIChatWidget (props)           │
│  storage ─► StorageAdapter (IndexedDB)   │
│  settings ─► SettingsAdapter (localStorage)│
│  platform ─► PlatformAdapter (host env)  │
└──────────────────────────────────────────┘
          │
          ▼
   React Context Providers
   (SettingsProvider, StorageProvider, PlatformProvider)
          │
          ▼
   Components / Services read via useSettings(), useStorage(), usePlatform()
```

This allows the same library to run in a browser, an Electron desktop app,
or a React Native host -- just swap the adapters.

---

## AppContext as Dependency Injection Container

`AppContext` is a plain object that bundles all runtime dependencies for a
single widget instance. It replaces global singletons, enabling multiple
independent widget instances on the same page.

```ts
interface AppContext {
  settings: SettingsAdapter;
  storage: StorageAdapter;
  platform: PlatformAdapter;
  provider: Provider;            // AI provider facade
  servers: Servers;              // unified tool system
  eventBus: ChatEventBus;        // internal pub/sub
  callbacksManager: CallbacksManager; // consumer callbacks
  middlewareRunner: MiddlewareRunner;  // middleware pipeline
}
```

`AppContext` is created once in `AIChatWidget` (or manually in headless
mode) and threaded through to `createStores`, services, and the
`ChatEngine`.

---

## Provider System

### AbstractBaseProvider

All AI providers extend a single abstract base class parameterized by
three type variables:

```ts
abstract class AbstractBaseProvider<TOOL, MESSAGE, CLIENT> {
  // State
  protected client: CLIENT;
  protected url: string;
  protected apiKey: string;
  protected tools: TOOL[];
  protected prevMessages: MESSAGE[];
  modelKey: string;
  isReasoning: boolean;

  // Abstract — must be implemented by each provider
  abstract setProvider(provider: TProvider): void;
  abstract setPrevMessages(prevMessages: ThreadMessageLike[]): void;
  abstract setTools(tools: TMCPItem[]): void;
  abstract getName(): string;
  abstract getBaseUrl(): string;
  abstract createChatName(message: string): Promise<string>;
  abstract sendMessage(messages: ThreadMessageLike[]): SendMessageReturnType;
  abstract sendMessageAfterToolCall(message: ThreadMessageLike): SendMessageReturnType;
  abstract checkProvider(data: TData): Promise<boolean | TErrorData>;
  abstract getProviderModels(data: TData): Promise<Model[]>;
}
```

Type parameters:
- `TOOL` -- provider-specific tool format (e.g., `ChatCompletionTool` for
  OpenAI, `ToolUnion` for Anthropic)
- `MESSAGE` -- provider-specific message format
- `CLIENT` -- SDK client instance type

### Built-in Providers (16)

| Type | Provider |
|------|----------|
| `anthropic` | Anthropic (Claude) |
| `openai` | OpenAI |
| `openaicompatible` | OpenAI-compatible APIs |
| `ollama` | Ollama (local) |
| `together` | Together AI |
| `openrouter` | OpenRouter |
| `genai` | Google GenAI |
| `deepseek` | DeepSeek |
| `xai` | xAI (Grok) |
| `lm-studio` | LM Studio (local) |
| `mistral` | Mistral AI |
| `groq` | Groq |
| `zhipu` | Zhipu AI |
| `stabilityai` | Stability AI |
| `gpt4all` | GPT4All (local) |
| `onlyoffice` | ONLYOFFICE |

### Provider Registry

Providers are looked up by type string from a combined registry:

```ts
// Built-in providers: compile-time singleton map
const builtinProviders: Record<ProviderType, BuiltinProvider> = { ... };

// Custom providers: runtime Map
const customProviders: Map<string, BaseProvider> = new Map();

// Register a custom provider at runtime
registerProvider("my-llm", new MyLLMProvider());

// Look up any provider by type
const p = getProvider("openai");       // built-in
const q = getProvider("my-llm");       // custom

// Unregister
unregisterProvider("my-llm");
```

### Provider Facade

The `Provider` class is a facade that delegates to whatever `BaseProvider`
is currently active. It manages provider switching, model selection, and
message routing:

```
User selects profile → Provider.setCurrentProvider({ type, baseUrl, key })
                      → Registry lookup → BaseProvider.setProvider()
                      → Ready to send messages
```

---

## Services Layer

Services contain all business logic with zero UI dependencies. They receive
`AppContext` and operate on adapters/stores:

| Service | Responsibility |
|---------|---------------|
| `ChatEngine` | Message lifecycle: send, stream, tool approval, persist |
| `ProfilesService` | CRUD for provider profiles, default profile selection |
| `ThreadsService` | CRUD for threads, cascading deletes |
| `PromptsService` | CRUD for prompts and prompt folders |
| `ServersService` | MCP server configuration, tool enable/disable |

### ChatEngine

The central orchestrator. All public methods are **async generators** that
yield `ChatEvent` instances:

```
sendMessage() → AsyncGenerator<ChatEvent>
  ├── "message-start"        first chunk
  ├── "message-delta"        subsequent chunks
  ├── "tool-call-pending"    tool needs approval
  ├── "message-end"          complete
  ├── "message-incomplete"   error / incomplete
  └── "thread-title"         auto-generated title
```

Middleware hooks fire at each stage: `beforeSend`, `onStreamChunk`,
`beforeToolCall`, `afterToolResult`, `beforeDisplay`, `onError`.

---

## Tool System

Three tool sources are unified by the `Servers` class:

```
Servers
├── HostToolSource     — tools from the host app (PlatformHostTools)
├── WebSearch          — Exa API web search
└── CustomServers      — MCP servers (JSON-RPC 2.0 over HTTP or STDIO)
```

### Unified API

```ts
class Servers {
  // Get all tools from all sources, keyed by source name
  getTools(): Promise<Record<string, TMCPItem[]>>;

  // Call a tool by source type and name
  callTools(type: string, name: string, args: Record<string, unknown>): Promise<string>;

  // Determine which source owns a tool
  getServerType(name: string): string;

  // Auto-approval management
  checkAllowAlways(type: string, name: string): boolean;
  setAllowAlways(value: boolean, type: string, name: string): void;
}
```

### Tool Call Flow

```
Model requests tool_call
  → ChatEngine detects tool-call in response
  → Servers.getServerType(toolName) → identifies source
  → Servers.checkAllowAlways(type, name)
    ├── true  → execute immediately
    └── false → yield "tool-call-pending" → wait for user approval
  → Servers.callTools(type, name, args) → result
  → Result appended to conversation
  → Provider.sendMessageAfterToolCall() → continue generation
```

---

## Capabilities Bitmask

Models declare capabilities as a bitmask. Profiles are filtered per
`ActionType` (Chat, Summarization, Translation, OCR, Vision, Image
Generation, etc.) by checking capability flags:

```ts
const model: Model = {
  id: "claude-sonnet-4-20250514",
  name: "Claude Sonnet 4",
  provider: "anthropic",
  capabilities: 0b0001_0011,  // Chat | Vision
};
```

The `CapabilitiesUI` system uses these flags to show only eligible profiles
for each action type in the UI.

---

## Zustand Stores with Global Holders

Each widget instance gets its own set of Zustand stores via `createStores`:

```ts
const stores = createStores({ keys: storeKeys, ctx });
// → { useMessageStore, useProfilesStore, useThreadsStore, ... }
```

Stores are distributed through `StoresProvider` (React context). Components
access them via `useStores()`.

For backward compatibility, global holders are also set synchronously during
the `useMemo` that creates `AppContext` (not in `useEffect`, to avoid
timing issues):

```ts
// Inside AIChatWidget render (useMemo):
setProviderInstance(provider);
setSettingsInstance(settings);
setStorageInstance(storage);
setServersInstance(servers);
```

This ensures services can access instances immediately, without waiting for
an effect to fire.

---

## Data Flow

Complete path of a user message through the system:

```
1. User types message
     │
2. useMessages hook → onNew callback
     │
3. MiddlewareRunner.beforeSend(ctx)
     │ ← can block or modify
4. Provider.setCurrentProviderTools(enabledTools)
   Provider.setCurrentProviderPrevMessages(history)
     │
5. ChatEngine.sendMessage(messages)
     │
6. AbstractBaseProvider.sendMessage(messages)
     │ → SDK call to AI service
     │
7. Streaming response (AsyncGenerator)
     │
8. For each chunk:
     ├── MiddlewareRunner.onStreamChunk(ctx)
     ├── yield ChatEvent("message-delta")
     └── Store update → UI re-render
     │
9. If tool call detected:
     ├── MiddlewareRunner.beforeToolCall(ctx)
     ├── Servers.checkAllowAlways(type, name)
     │   ├── auto-approve → Servers.callTools()
     │   └── pending → yield "tool-call-pending" → user approves/denies
     ├── MiddlewareRunner.afterToolResult(ctx)
     └── Provider.sendMessageAfterToolCall() → back to step 7
     │
10. Stream complete → yield "message-end"
      │
11. MiddlewareRunner.beforeDisplay(ctx)
      │
12. StorageAdapter.messages.create() — persist
      │
13. CallbacksManager.emit("onMessageSent") — notify consumer
      │
14. Async: ChatEngine generates thread title
      └── yield "thread-title"
```

---

## Event System

Two complementary event mechanisms:

### ChatEventBus (Internal)

Lightweight pub/sub for fire-and-forget signals between decoupled parts of
the widget. Handlers receive no payload.

```ts
eventBus.on("threads:updated", () => { /* refresh list */ });
eventBus.emit("threads:updated");
```

### CallbacksManager (Consumer-facing)

Type-safe callbacks registered by the host application. Consumer errors are
silently swallowed to protect internal flow.

```ts
<AIChatWidget
  callbacks={{
    onMessageSent: (event) => analytics.track("message", event),
    onThreadCreated: (event) => console.log("New thread:", event.threadId),
    onStreamStart: (event) => showTypingIndicator(),
    onStreamEnd: (event) => hideTypingIndicator(),
    onToolCallPending: (event) => logToolCall(event),
  }}
/>
```
