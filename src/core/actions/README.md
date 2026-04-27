# `core/actions`

The smallest building block of an AI call: a function that takes
`{ profile, messages, … }` and either streams `SendMessageResult`
events back or resolves to a single `ThreadMessageLike`. Every
action delegates to a [provider](../providers/) instance built from
its `profile` arg via [`providerFor`](./provider.ts) and applies a
baked-in system prompt from the action's neighbour `prompt.ts`.

| Action            | Module                                      | Mode      | System prompt                  |
| ----------------- | ------------------------------------------- | --------- | ------------------------------ |
| `chat`            | [`chat/`](./chat)                           | streaming | [`chat/prompt.ts`](./chat/prompt.ts) |
| `custom`/`customSync` | [`custom/`](./custom)                   | both      | caller-supplied                |
| `summarize`       | [`summarization/`](./summarization)         | one-shot  | [`summarization/prompt.ts`](./summarization/prompt.ts) |
| `translate`       | [`translation/`](./translation)             | one-shot  | [`translation/prompt.ts`](./translation/prompt.ts) |
| `analyzeText`     | [`text-analyze/`](./text-analyze)           | one-shot  | [`text-analyze/prompt.ts`](./text-analyze/prompt.ts) |
| `generateImage`   | [`image-generation/`](./image-generation)   | one-shot  | [`image-generation/prompt.ts`](./image-generation/prompt.ts) |
| `recognizeText`   | [`ocr/`](./ocr)                             | one-shot  | [`ocr/prompt.ts`](./ocr/prompt.ts) |
| `describeImage`   | [`vision/`](./vision)                       | one-shot  | [`vision/prompt.ts`](./vision/prompt.ts) |
| `generateTitle`   | [`title/`](./title)                         | one-shot  | [`title/prompt.ts`](./title/prompt.ts) |

Actions are stateless and unaware of threads, storage, or stores —
that bookkeeping belongs to the [`services/`](../services/) layer.
Each baked-prompt action also accepts an optional
[`SystemPromptOverride`](./types.ts) so callers can replace or
append to the default prompt without forking the action.

## Full documentation

See [`docs/core/actions/`](../../../docs/core/actions/README.md):

- [`actions.md`](../../../docs/core/actions/actions.md) — every
  action's signature, behavior, error path and example, plus how
  the provider lookup and prompt-override helpers work.
