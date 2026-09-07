# Actions — full reference

> Sources: [`src/core/actions/`](../../../src/core/actions)

An **action** is a function with the rough shape

```ts
(args: ActionArgs) => Promise<ThreadMessageLike>            // sync
(args: ActionArgs) => AsyncGenerator<SendMessageResult>     // streaming
```

It instantiates a provider class from `args.profile`, applies a
system prompt, and dispatches `sendMessage` (streaming) or
`sendMessageSync` (one-shot) on the provider. Actions are the
glue between [`core/providers/`](../providers/README.md) and the
higher-level [`core/services/`](../services/README.md) — they
encapsulate "how to make this kind of call" without owning any
thread or persistence state.

---

## `ActionArgs`

> Source: [`types.ts`](../../../src/core/actions/types.ts)

```ts
type ActionArgs = {
  profile: Pick<
    Profile,
    "providerType" | "baseUrl" | "key" | "modelId" | "canUseTool"
  >;
  messages: ThreadMessageLike[];
  tools?: TMCPItem[];
  isReasoning?: boolean;
  signal?: AbortSignal;
  prompt?: SystemPromptOverride;
  toolInstructions?: Record<string, string>;
};
```

| Field          | Required | Used by                         |
| -------------- | -------- | ------------------------------- |
| `profile`      | ✅        | [`providerFor`](#providerfor) — picks the provider class and supplies credentials + model. `canUseTool` toggles the [text-protocol fallback](#text-protocol-fallback-canusetool--false) |
| `messages`     | ✅        | Forwarded to provider as the conversation history |
| `tools`        |          | Forwarded to streaming actions only (`chat`, `custom`); ignored by sync actions |
| `isReasoning`  |          | Forwarded as `withReasoning` to providers that opt in |
| `signal`       |          | `AbortSignal` for caller-driven cancellation |
| `prompt`       |          | [`SystemPromptOverride`](#system-prompt-override) — replaces or appends to the action's baked-in prompt |
| `toolInstructions` |      | [MCP server notes](#mcp-server-instructions) keyed by `serverType` — folded into the `chat` system prompt |

`ActionArgs` is intentionally narrow on the profile: only the four
fields a provider actually needs. Engines pre-resolve the full
`Profile` and pass the slice — actions never read storage.

---

## `providerFor`

> Source: [`provider.ts`](../../../src/core/actions/provider.ts)

Every action's first line. Builds a fresh `AbstractBaseProvider`
instance from `args.profile` and throws on unknown provider type.

```ts
function providerFor(args: ActionArgs): AbstractBaseProvider;
```

```ts
const provider = createProvider(args.profile.providerType, {
  baseUrl: args.profile.baseUrl,
  apiKey: args.profile.key,
});
if (!provider) throw new Error(`Unknown provider type: ${args.profile.providerType}`);
return provider;
```

`createProvider` is the registry entry point in
[`core/providers/registry.ts`](../../../src/core/providers/registry.ts).
The registry is shared across the whole library, so any
`registerProvider(...)` call you've made before invoking an
action is reflected here.

---

## System prompt override

> Source: [`types.ts`](../../../src/core/actions/types.ts), [`system-prompt.ts`](../../../src/core/actions/system-prompt.ts)

Each baked-prompt action ships with a default system prompt in
its neighbour `prompt.ts`. Callers can override that prompt at
call time without forking the action:

```ts
type SystemPromptOverride =
  | { mode: "replace"; text: string }
  | { mode: "append"; text: string };
```

| Mode      | Effect                                                     |
| --------- | ---------------------------------------------------------- |
| omitted   | Use the action's baked-in prompt verbatim                  |
| `replace` | Drop the default, use `text` instead                       |
| `append`  | Keep the default, append `text` after a blank line         |

The resolution helper:

```ts
function resolveSystemPrompt(
  defaultPrompt: string,
  override: SystemPromptOverride | undefined
): string {
  if (!override) return defaultPrompt;
  if (override.mode === "replace") return override.text;
  return `${defaultPrompt}\n\n${override.text}`;
}
```

Wired into every baked-prompt action: `chat`, `summarize`,
`translate`, `analyzeText`, `generateImage`, `recognizeText`,
`describeImage`, `generateTitle`. The `custom` action ignores it
— it already takes a raw `systemPrompt: string`.

---

## MCP server instructions

> Source: [`chat/server-instructions.ts`](../../../src/core/actions/chat/server-instructions.ts)

An MCP server may return an `instructions` string from the
`initialize` handshake — its own hint on how its tools are meant
to be used. Whoever holds the connection (the UI aggregator for
browser-run servers, the host for its own) passes them to the
engine as `actionArgs.toolInstructions`, keyed by `serverType`:

```ts
actionArgs: {
  tools: freshTools,
  toolInstructions: { docspace: "Prefer room templates over…" },
}
```

The `chat` action folds them into the system prompt, **after** the
resolved prompt (default + override), inside a framed block:

```
## Tool provider notes
…framing that subordinates the notes to everything above…

<server name="docspace">
Prefer room templates over…
</server>
```

Rules the assembly follows:

- **Only represented servers.** A server whose tools were all
  filtered out this round (disabled by the user, `enabled: false`)
  contributes nothing. Attribution is by `TMCPItem.serverType`; if
  no tool carries one, every entry is kept rather than all being
  dropped.
- **Guarded at `MAX_CHARS_PER_SERVER` (100 000 characters)**,
  marked `[…truncated]` past it. Deliberately high: the notes are
  documentation the server author wrote on purpose, so truncation
  would corrupt them. It is a runaway guard against a server
  echoing an entire API reference, not a budget — lower the
  constant if a tighter limit is ever wanted.
- **Framed, not merged.** The block header states that the notes
  are third-party advice which cannot override the instructions
  above. They come from whatever server the user registered, so
  they are never spliced in as if they were ours.
- **Attribution is forgery-proof.** A note cannot pass itself off
  as another server's: `<server` and `</server` are both
  neutralised inside the text, and a server name is reduced to
  `[\w.:-]` before it goes in the `name` attribute. Otherwise a
  hostile server could close its own block early, or open a
  forged one under a trusted name, and have its advice read as
  that server's.
- **Kept across resume rounds.** Threaded through
  `AdapterRunContext` and `resumeChat`, so a tool call doesn't
  wipe them from the follow-up request.

Note that a `replace` override does **not** drop them: it
overrides the library's prompt, not documentation the host never
wrote.

---

## `chat` (streaming)

> Source: [`chat/`](../../../src/core/actions/chat) — [`prompt.ts`](../../../src/core/actions/chat/prompt.ts)

The only **streaming** action. Yields every delta produced by the
provider, plus the terminal `{ isEnd: true, responseMessage }`
event.

```ts
chat(args: ActionArgs): AsyncGenerator<SendMessageResult>;
```

Forwards `tools`, `isReasoning` (as `withReasoning`), and `signal`
to the provider. Used by `AIEngine.sendWithStream` for full chat
sessions and indirectly by `AIEngine.send({ actionType: "Chat" })`
which drains the stream to its terminal message.

The default system prompt steers the model toward a "tool-aware
assistant that doesn't push tools unnecessarily" stance.

```ts
for await (const ev of chat({
  profile, messages, tools, signal,
  prompt: { mode: "append", text: "Always respond in formal Polish." },
})) {
  if ("isEnd" in ev) return ev.responseMessage;
  renderDelta(ev);
}
```

---

## `custom` and `customSync` (caller-supplied prompt)

> Source: [`custom/`](../../../src/core/actions/custom)

A pair of one-turn actions where the **prompt is provided by the
caller**, not baked in. Useful for power-user features ("rewrite
in formal tone", end-user prompt boxes) where the prompt is
runtime data.

```ts
type CustomArgs = ActionArgs & { systemPrompt: string };

custom(args: CustomArgs): AsyncGenerator<SendMessageResult>;     // streaming
customSync(args: CustomArgs): Promise<ThreadMessageLike>;        // one-shot
```

The streaming variant forwards `tools`, `isReasoning` and `signal`
the same way `chat` does. The sync variant trims the same surface
to the `sendMessageSync` shape: no tools, no reasoning, just a
plain string round-trip.

Both ignore `args.prompt` (the override field) — the explicit
`systemPrompt` *is* the prompt.

```ts
const reply = await customSync({
  profile, messages: [userMessage],
  systemPrompt: "Rewrite in formal Russian. Output only the result.",
});
```

---

## `summarize`

> Source: [`summarization/`](../../../src/core/actions/summarization) — [`prompt.ts`](../../../src/core/actions/summarization/prompt.ts)

```ts
summarize(args: ActionArgs): Promise<ThreadMessageLike>;
```

Default prompt instructs the model to produce a faithful summary
that preserves the key points and keeps proportional length. No
extras — no preamble, no meta-commentary.

```ts
await summarize({
  profile,
  messages: [{ role: "user", content: [{ type: "text", text: longArticle }] }],
});
```

---

## `translate`

> Source: [`translation/`](../../../src/core/actions/translation) — [`prompt.ts`](../../../src/core/actions/translation/prompt.ts)

```ts
translate(args: ActionArgs): Promise<ThreadMessageLike>;
```

Default prompt: translate verbatim, preserve formatting (line
breaks, lists, code blocks), no explanations or transliterations.
Defaults to English when the user doesn't specify a target
language.

Pass the target language inside the user message itself, or
override the prompt via `args.prompt`:

```ts
await translate({
  profile,
  messages: userMessage,
  prompt: { mode: "append", text: "Target language: Polish." },
});
```

---

## `analyzeText`

> Source: [`text-analyze/`](../../../src/core/actions/text-analyze) — [`prompt.ts`](../../../src/core/actions/text-analyze/prompt.ts)

```ts
analyzeText(args: ActionArgs): Promise<ThreadMessageLike>;
```

Open-ended text analysis: sentiment, topics, entities, structure,
tone, readability — whatever the user asks. Default prompt
instructs the model to base every claim strictly on the supplied
text and to ask a clarifying question if the request is ambiguous.

---

## `generateImage`

> Source: [`image-generation/`](../../../src/core/actions/image-generation) — [`prompt.ts`](../../../src/core/actions/image-generation/prompt.ts)

```ts
generateImage(args: ActionArgs): Promise<ThreadMessageLike>;
```

Text-channel action: dispatches via the provider's
`sendMessageSync`. Used when the model itself has image-generation
behind a chat completion (e.g. some OpenAI-compatible setups). For
direct image-API providers (Stability AI, DALL-E via OpenAI's
`images.generate`), reach for the provider's
`imageGeneration(args)` method directly via the
`ImageGeneration` tool source instead.

---

## `recognizeText` (OCR)

> Source: [`ocr/`](../../../src/core/actions/ocr) — [`prompt.ts`](../../../src/core/actions/ocr/prompt.ts)

```ts
recognizeText(args: ActionArgs): Promise<ThreadMessageLike>;
```

Default prompt: extract all readable text verbatim, preserve
reading order, line breaks, and basic layout. No translation, no
summarization, no spell-correction. Mark unreadable regions as
`[illegible]` rather than guessing.

Profile must have a model that supports vision input
(`Vision` capability bit). Pass the image inside `messages` as a
content part — the provider's message converter encodes it for
the SDK.

---

## `describeImage` (Vision)

> Source: [`vision/`](../../../src/core/actions/vision) — [`prompt.ts`](../../../src/core/actions/vision/prompt.ts)

```ts
describeImage(args: ActionArgs): Promise<ThreadMessageLike>;
```

Default prompt: describe the main subject, setting, composition,
colors, and notable details. Strictly visible content — no
speculation about off-frame context or person identity unless the
user explicitly asks.

Same input shape as `recognizeText`: messages carry the image
content part.

---

## `generateTitle`

> Source: [`title/`](../../../src/core/actions/title) — [`prompt.ts`](../../../src/core/actions/title/prompt.ts)

```ts
generateTitle(args: ActionArgs): Promise<string>;
```

The odd one out: returns a `string` instead of a
`ThreadMessageLike`. Used by
[`AIEngine.sendWithStream`](../services/ai-engine.md#sendwithstream)
when starting a new thread — given the user's first message, ask
the resolved profile for a short title, fall back to `"New chat"`
on empty.

Default prompt caps length at 60 characters, forbids quotes /
trailing punctuation / preambles, and tells the model to base the
title on the main subject when the message is ambiguous.

---

## How an action runs end-to-end

Take `summarize` as the simplest example:

```ts
export const summarize = async (
  args: ActionArgs
): Promise<ThreadMessageLike> => {
  const text = await providerFor(args).sendMessageSync({
    messages: args.messages,
    model: args.profile.modelId,
    systemPrompt: resolveSystemPrompt(systemPrompt, args.prompt),
    signal: args.signal,
  });
  return { role: "assistant", content: [{ type: "text", text }] };
};
```

1. **`providerFor(args)`** — `createProvider("anthropic", { baseUrl, apiKey })`,
   instantiating `AnthropicProvider`.
2. **`resolveSystemPrompt(systemPrompt, args.prompt)`** — apply
   `replace` / `append` if the caller passed an override,
   otherwise use the baked-in default verbatim.
3. **`sendMessageSync({ messages, model, systemPrompt, signal })`**
   — provider does the SDK call.
4. **Wrap the resulting string** in a minimal `ThreadMessageLike`
   (`role: "assistant"`, single `text` content part).

Streaming actions (`chat`, `custom`) follow the same skeleton but
return / yield from `sendMessage` instead, and forward `tools` /
`withReasoning` to the provider.

---

## Text-protocol fallback (`canUseTool === false`)

> Source: [`chat/fallback-tools.ts`](../../../src/core/actions/chat/fallback-tools.ts)

`Profile.canUseTool` is set by [`ProfilesEngine`](../services/profiles-engine.md)
at create / update time via a live probe. When the resolved
profile carries `canUseTool === false`, every action switches into
a text-only protocol so models without native function-calling
(many local Ollama / LM Studio builds, older OpenAI-compatible
servers) still participate in the same approval / resume loop as
native tool-calling models.

The fallback has two layers, gated by what the action does:

| Layer                 | Applies to                                              | What it does                                                                 |
| --------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| History sanitisation  | every action                                            | Walks `args.messages` and rewrites `tool-call` / `tool-result` content parts as `<TOOL_CALL>{...}</TOOL_CALL>` text in the assistant turn, plus a synthetic user turn carrying `<TOOL_RESULT>...</TOOL_RESULT>`. The provider therefore never sees `role:"tool"` wire messages. |
| Streaming intercept   | `chat`, `custom` (when `tools.length > 0`)              | Appends a tools listing + format rules to `systemPrompt`, drops the `tools` field from the API call, and pipes the upstream stream through a state machine that turns the model's `<TOOL_CALL>{"name","arguments"}</TOOL_CALL>` block into a synthetic `tool-call` content part. Broken JSON, an unclosed tag, or a missing `name` degrade gracefully into plain text. |

The synthetic `tool-call` part is shape-compatible with the native
provider streams, so `AIEngine`, `ManageToolDialog`, and the
resume path don't need to know the difference.

```ts
// One round-trip in fallback mode:
//
//   user           → "Search the web for X"
//   systemPrompt   → "<baked prompt>\n\n<tools listing + format rules>"
//   model output   → "thinking <TOOL_CALL>{\"name\":\"web_search\",
//                                          \"arguments\":{\"q\":\"X\"}}</TOOL_CALL>"
//   stream wrapper → emits a synthetic tool-call part to the engine
//   approval flow  → ManageToolDialog → execute → result captured
//   next turn      → history rewritten as
//                    assistant: "<TOOL_CALL>{...}</TOOL_CALL>"
//                    user:      "<TOOL_RESULT>...</TOOL_RESULT>"
```

The exported helpers, all reusable from custom actions:

| Export                                      | Used by                                              |
| ------------------------------------------- | ---------------------------------------------------- |
| `isFallbackProfile(profile)`                | `chat`, `custom`, every sync action                  |
| `transformHistoryToText(messages)`          | every action that hits `sendMessageSync`             |
| `streamWithTextProtocol(args, baseSystem)`  | `chat`, `custom` streaming branches                  |
| `chatViaTextProtocol(args)`                 | thin wrapper that supplies the chat default prompt   |
| `wrapStream(upstream)`                      | exported for testing                                 |
| `buildToolsBlock(tools)`                    | exported for testing                                 |

Limitations (intentional for v1):

- One tool call per assistant turn. The format rules instruct the
  model to emit at most one `<TOOL_CALL>` block.
- No auto-retry on broken syntax — the raw text falls through to
  the user, who can retry the prompt.
- No streaming of partial tool-call arguments. The `<TOOL_CALL>`
  block surfaces atomically once `</TOOL_CALL>` is seen.
- The 10-character buffer in front of every emitted text chunk
  prevents partial `<TOOL_…` prefixes from flickering in the UI;
  the unsent tail flushes on `isEnd`.

---

## Designing on top of `core/actions`

- **For an app-defined task** with a stable prompt (a new
  "outline" feature, etc.) → add a folder under `core/actions/`
  with `prompt.ts` + `index.ts`, mirror the existing one-shot
  pattern, register it under a new `ActionType` in
  [`core/services/ai/actions.ts`](../../../src/core/services/ai/actions.ts).
- **For a feature that takes the prompt at runtime** → use
  `custom` / `customSync`. Don't reach for it for app-owned
  prompts — keeping those baked is what gives the rest of the
  system a stable contract.
- **For app-wide tone, language, or domain constraints** →
  `actionArgs.prompt: { mode: "append", text: ... }` so the
  action's default behavior (response shape, structure rules)
  stays in effect.
- **For full thread / persistence flow** → don't call actions
  directly; use [`AIEngine`](../services/ai-engine.md). It
  resolves profiles from `AssignmentsStorage`, handles the
  thread / message persistence, and drains streams when callers
  want a single answer.
