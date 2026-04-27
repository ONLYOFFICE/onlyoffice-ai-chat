# `shared`

Small, mostly type-only modules that the rest of the codebase
depends on. Nothing in `shared/` reaches into `core/`, `services/`,
`store/` or any UI layer — that means anything here can be imported
from anywhere without creating a cycle, and code in any layer
(server or client) can rely on it.

| File                                                 | Exports                                  | Topic |
| ---------------------------------------------------- | ---------------------------------------- | ----- |
| [`abort.ts`](./abort.ts)                             | `isAbortError`                           | Cross-SDK cancellation detection |
| [`action-type.ts`](./action-type.ts)                 | `ActionType` (object + type)             | Enum of supported AI actions |
| [`builtin-provider-type.ts`](./builtin-provider-type.ts) | `BuiltinProviderType`                | Union of 16 built-in provider strings |
| [`capabilities-ui.ts`](./capabilities-ui.ts)         | `CapabilitiesUI`                         | Capability bitmask constants |
| [`capabilities.ts`](./capabilities.ts)               | `Capabilities`                           | `number` alias for the bitmask |
| [`error-data.ts`](./error-data.ts)                   | `TErrorData`                             | Field-scoped form-error shape |
| [`image-generation-args.ts`](./image-generation-args.ts) | `ImageGenerationArgs`                | Provider input for `imageGeneration` |
| [`infer-capabilities.ts`](./infer-capabilities.ts)   | `inferCapabilities`                      | Heuristic mapping `(providerType, modelId) → bitmask` |
| [`logger.ts`](./logger.ts)                           | `logger` (default)                       | `console.*` wrapper that bypasses the `no-console` lint rule |
| [`mcp-item.ts`](./mcp-item.ts)                       | `TMCPItem`                               | Descriptor for one MCP tool |
| [`model.ts`](./model.ts)                             | `Model`                                  | AI model metadata |
| [`provider-credentials.ts`](./provider-credentials.ts) | `ProviderCredentials`                  | `{ baseUrl, apiKey? }` provider creds |
| [`provider-type.ts`](./provider-type.ts)             | `ProviderType`                           | `BuiltinProviderType \| (string & {})` |
| [`provider.ts`](./provider.ts)                       | `TProvider`                              | User-defined provider connection config |
| [`send-message-args.ts`](./send-message-args.ts)     | `SendMessageArgs`, `SendMessageResult`   | Streaming chat call shape |
| [`send-message-sync-args.ts`](./send-message-sync-args.ts) | `SendMessageSyncArgs`              | One-shot text call shape |

## Full documentation

See [`docs/shared/`](../../docs/shared/README.md):

- [`shared.md`](../../docs/shared/shared.md) — every file's exports,
  semantics, and how the rest of the codebase consumes them,
  grouped by topic.
