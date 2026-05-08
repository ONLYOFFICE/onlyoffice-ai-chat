import type { ToolsAdapter } from "@onlyoffice/ai-chat";

/**
 * Minimal example of a server-style {@link ToolsAdapter}.
 *
 * `getTools()` returns a `serverType → tools[]` grouping — the engine
 * resolves it server-side alongside built-in web-search / image
 * generation, then dispatches `callTool(...)` automatically when the
 * model picks one of these tools (no UI approval round-trip).
 *
 * The two groups below ship with empty handlers — they're stubs for
 * the playground, swap their `callTool` branches with real logic when
 * you wire up your own backend.
 */
export const toolsAdapter: ToolsAdapter = {
  async getTools() {
    return {
      "demo-server-a": [
        {
          name: "noop_a",
          description: "Stub tool from server A — replace with real logic.",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "echo_a",
          description: "Echoes the `text` argument back. Demo only.",
          inputSchema: {
            type: "object",
            properties: {
              text: { type: "string", description: "Anything to echo back." },
            },
          },
        },
      ],
      "demo-server-b": [
        {
          name: "noop_b",
          description: "Stub tool from server B — replace with real logic.",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    };
  },

  async callTool(toolName, args) {
    if (toolName === "echo_a") {
      return JSON.stringify({ data: { echo: args.text ?? null } });
    }
    return JSON.stringify({ data: { ok: true, called: toolName, args } });
  },
};
