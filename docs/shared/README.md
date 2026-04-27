# `shared` — full reference

The `src/shared/` folder holds small, mostly type-only modules
that every other layer depends on. By convention `shared/` does
not import from `core/`, `services/`, `store/`, or any UI layer
— so anything here can be reused from any layer without creating
a cycle, on the server as well as on the client.

| Document                          | Topic |
| --------------------------------- | ----- |
| [`shared.md`](./shared.md)        | Every module's exports, semantics, error cases, examples — grouped by topic |

## Quick map

```
src/shared
├── AI call shapes — wire format between actions and providers
│   ├── send-message-args.ts        SendMessageArgs / SendMessageResult
│   ├── send-message-sync-args.ts   SendMessageSyncArgs
│   ├── image-generation-args.ts    ImageGenerationArgs
│   └── provider-credentials.ts     ProviderCredentials
│
├── Provider identity — naming and selecting providers
│   ├── provider.ts                 TProvider (user-defined connection)
│   ├── provider-type.ts            ProviderType (BuiltinProviderType | string)
│   ├── builtin-provider-type.ts    BuiltinProviderType (16-string union)
│   └── model.ts                    Model (AI model metadata)
│
├── Action / capability metadata
│   ├── action-type.ts              ActionType (8-action enum)
│   ├── capabilities-ui.ts          CapabilitiesUI (bitmask constants)
│   ├── capabilities.ts             Capabilities (number alias)
│   └── infer-capabilities.ts       inferCapabilities(providerType, modelId)
│
├── Tools
│   └── mcp-item.ts                 TMCPItem (single MCP tool descriptor)
│
├── Runtime helpers
│   ├── abort.ts                    isAbortError(error, signal?)
│   └── error-data.ts               TErrorData (field-scoped form-error)
│
└── Logging
    └── logger.ts                   default logger
```
