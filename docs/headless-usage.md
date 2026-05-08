# Headless Usage

Drive `core/services` engines without rendering `AIChatWidget`. Use
this when you want chat, summarization, OCR, or web-search routed
through the library's profile / assignment / thread machinery from
non-React code (a CLI bot, a server worker, an admin script).

For reference on what each engine does, read
[`core/services/README.md`](./core/services/README.md). For the
storage contract you must implement, read
[`adapters.md`](./adapters.md).

## When to go headless

| Scenario | Use |
| --- | --- |
| Drop-in chat sidebar | `AIChatWidget` |
| Custom shell with library pages | `AIChatWidget` providers + the page exports |
| Bot / cron / admin script | `core/services` engines directly |
| Embed only the settings page | The page export inside your own provider stack |

If you only need programmatic control while keeping the UI, prefer
the [imperative ref](./ui/providers/imperative.md) instead.

## Constructing engines

All eight engines take a `{ storage, … }` deps object. They hold no
per-call state — re-use is safe.

```ts
import {
  AIEngine,
  AssignmentsEngine,
  PreferencesEngine,
  ProfilesEngine,
  PromptsEngine,
  ThreadsEngine,
  ToolsEngine,
  WebSearchEngine,
} from "@onlyoffice/ai-chat/services";
import type { StorageAdapter } from "@onlyoffice/ai-chat/storage";

const storage: StorageAdapter = /* host-supplied */;

const assignments = new AssignmentsEngine({ storage });
const threads     = new ThreadsEngine({ storage });
const profiles    = new ProfilesEngine({ storage, assignments });
const tools       = new ToolsEngine({ storage });
const prompts     = new PromptsEngine({ storage });
const webSearch   = new WebSearchEngine({ storage });
const preferences = new PreferencesEngine({ storage });

const ai = new AIEngine({
  storage,
  assignments,
  threads,
  // toolsAdapter: optional — pluggable runtime tool source
});
```

Sub-services are optional. If you don't pass them, the parent
constructs its own:

```ts
const ai = new AIEngine({ storage });        // builds its own assignments + threads
const profiles = new ProfilesEngine({ storage }); // builds its own assignments
```

## Streaming a chat reply

`AIEngine.sendWithStream` returns an `AsyncGenerator<ChatEvent>`.
Drive it directly:

```ts
import type { ChatEvent } from "@onlyoffice/ai-chat/services";

await storage.init();

const stream = ai.sendWithStream({
  threadId: "thread-1",
  userMessage: {
    role: "user",
    content: [{ type: "text", text: "Summarize the attached doc." }],
  },
  actionArgs: { isReasoning: true /* signal, tools, … */ },
});

for await (const event of stream) {
  switch (event.type) {
    case "message-start":
    case "message-delta":
    case "message-end":
      // event.message is a ThreadMessageLike
      break;
    case "tool-call-pending":
      // event.autoAllow tells you whether the user already opted into
      // auto-approve. In headless mode you typically dispatch the tool
      // yourself, then call ai.approveToolCall({ ..., result }).
      break;
    case "thread-title":
      console.log("Auto-titled:", event.title);
      break;
  }
}
```

See [`core/services/ai-engine.md`](./core/services/ai-engine.md)
for the full input/output schema.

## One-shot actions

For non-conversational calls (summarize, translate, OCR, vision,
analyze, image generation, custom prompt) bypass thread machinery
and call the action directly via `AIEngine.send`:

```ts
import { ActionType } from "@onlyoffice/ai-chat";

const result = await ai.send({
  action: ActionType.Summarization,
  text: "...long article...",
  profileId: profile.id,
});
console.log(result.message);
```

The engine resolves the action's `CapabilitiesUI` mask, picks the
assigned profile (falling back to `Default`), runs the action, and
returns the terminal message.

## Tool calls (optional)

Pass a `toolsAdapter` to `AIEngine` if your bot should expose
tools to the model. The engine resolves `getTools()` server-side
alongside built-in web-search / image-generation, then dispatches
`callTool(...)` automatically when the model picks one — no UI
round-trip. See [`adapters.md`](./adapters.md#toolsadapter) for
the contract.

```ts
import type { ToolsAdapter } from "@onlyoffice/ai-chat";

const adapter: ToolsAdapter = {
  async getTools() {
    return {
      "my-tools": [
        {
          name: "echo",
          description: "Echo input back.",
          inputSchema: {
            type: "object",
            properties: { text: { type: "string" } },
          },
        },
      ],
    };
  },
  async callTool(name, args) {
    if (name === "echo") return JSON.stringify({ data: args });
    return JSON.stringify({ error: `Unknown: ${name}` });
  },
};

const ai = new AIEngine({ storage, toolsAdapter: adapter });
```

For tools you'd rather pause and approve manually (e.g. file
writes), pass them through `actionArgs.tools` — those surface as
`tool-call-pending` events for you to handle, and resume via
`ai.approveToolCall({ ..., result })` / `ai.denyToolCall(...)`.

## Middleware

Construct a `MiddlewareRunner` and pass it to whichever surface
respects it. In headless mode, you call middleware hooks yourself
around the engine call (or wrap `AIEngine` in your own facade).

```ts
import { MiddlewareRunner, type ChatMiddleware } from "@onlyoffice/ai-chat/middleware";

const logger: ChatMiddleware = {
  beforeSend: async (ctx) => {
    console.log("send:", ctx.text.slice(0, 80));
    return { action: "continue" };
  },
};

const runner = new MiddlewareRunner([logger]);
```

See [`core/middleware/README.md`](./core/middleware/README.md) for
the six hooks and their result shapes.

## Mounting the React shell with custom layout

If you need React UI but not the default `AIChatWidget` shell —
e.g. settings on a dedicated route — pages are exported and can be
mounted inside the same provider stack the widget uses internally.
Build the same `AppContext`, pass it to `createStores`, then render
the page inside the providers chain.

The full provider chain is:

```
EventsProvider
  PlatformProvider
    I18nProvider
      ComponentsProvider
        WidgetConfigProvider
          ApiProvider
            StoresProvider
              ThemeProvider
                ImagesProvider
                  ToolsProvider
                    <Page />
```

See [`ui/pages.md`](./ui/pages.md) for a runnable example and
[`ui/providers/README.md`](./ui/providers/README.md) for what each
provider injects.
