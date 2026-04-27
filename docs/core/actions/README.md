# `core/actions` — full reference

Actions are the **smallest unit of work** in the AI pipeline:
"send these messages to the provider configured by this profile,
under this system prompt, and give me the response (or a stream
of events)". Each action is a free function; no class, no
instance state, no thread bookkeeping.

| Document                          | Topic |
| --------------------------------- | ----- |
| [`actions.md`](./actions.md)      | Every action's signature, system prompt, behavior, error path, examples; the provider lookup helper; the `SystemPromptOverride` mechanism |

## Quick map

```
core/actions
├── chat/             streaming (only one)
├── custom/           streaming OR sync, caller-supplied prompt
├── summarization/    sync, baked prompt
├── translation/      sync, baked prompt
├── text-analyze/     sync, baked prompt
├── image-generation/ sync, baked prompt
├── ocr/              sync, baked prompt
├── vision/           sync, baked prompt
├── title/            sync, baked prompt (used by AIEngine for new threads)
├── provider.ts       providerFor(args) — instantiate the SDK client
├── system-prompt.ts  resolveSystemPrompt(default, override)
└── types.ts          ActionArgs + SystemPromptOverride
```

Actions know nothing about threads, storage, or UI. That layering
is owned by [`core/services/`](../services/README.md): `AIEngine`
calls into actions, applies persistence semantics, and exposes a
higher-level API to services and the widget.
