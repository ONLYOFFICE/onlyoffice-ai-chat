import type { TMCPItem } from "./mcp-item";

/**
 * Synthetic argument injected into every tool's input schema so the model
 * states, in one sentence, what each tool call is about to do. The engine
 * strips it before executing the tool (the real tool never sees it); the UI
 * reads it to render the call with a human-readable label.
 *
 * Namespaced camelCase identifier: valid across every provider's schema
 * (Gemini / OpenAI restrict property names to `^[A-Za-z_][A-Za-z0-9_]*$`) and
 * distinctive enough never to collide with a real tool parameter.
 */
export const TOOL_INTENT_FIELD = "aiChatIntent";

const INTENT_PROPERTY: Record<string, unknown> = {
  type: "string",
  description:
    'One short sentence, in the same language as the conversation, describing what this tool call is about to do (e.g. "Searching the web for the latest news…"). Shown to the user while the call runs.',
};

/**
 * Return a copy of `tool` whose input schema declares the `aiChatIntent`
 * argument as required. Non-mutating: source tool definitions are shared and
 * cached, so the original schema is never touched.
 */
export function augmentToolWithIntent(tool: TMCPItem): TMCPItem {
  const schema: Record<string, unknown> =
    tool.inputSchema && typeof tool.inputSchema === "object"
      ? tool.inputSchema
      : {};

  const properties =
    schema.properties && typeof schema.properties === "object"
      ? (schema.properties as Record<string, unknown>)
      : {};

  const required = Array.isArray(schema.required)
    ? (schema.required as unknown[]).filter(
        (item): item is string => typeof item === "string"
      )
    : [];

  return {
    ...tool,
    inputSchema: {
      ...schema,
      properties: { ...properties, [TOOL_INTENT_FIELD]: INTENT_PROPERTY },
      required: required.includes(TOOL_INTENT_FIELD)
        ? required
        : [...required, TOOL_INTENT_FIELD],
    },
  };
}

/** Map {@link augmentToolWithIntent} over a tool list. */
export const augmentToolsWithIntent = (tools: TMCPItem[]): TMCPItem[] =>
  tools.map(augmentToolWithIntent);

/**
 * Read the intent sentence out of a tool call's arguments, if the model
 * provided a non-empty one.
 */
export function readToolIntent(
  args: Record<string, unknown> | null | undefined
): string | undefined {
  const value = args?.[TOOL_INTENT_FIELD];
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

/**
 * Return a shallow copy of `args` without the synthetic `aiChatIntent` field
 * so the real tool never receives it. Non-mutating and idempotent — safe to
 * call at every execution boundary (core-side and UI-side alike).
 */
export function stripToolIntent(
  args: Record<string, unknown>
): Record<string, unknown> {
  if (!args || typeof args !== "object" || !(TOOL_INTENT_FIELD in args)) {
    return args;
  }
  const rest = { ...args };
  delete rest[TOOL_INTENT_FIELD];
  return rest;
}
