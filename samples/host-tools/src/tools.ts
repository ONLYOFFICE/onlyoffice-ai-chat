import type { HostToolGroup } from "@onlyoffice/ai-chat";

export const hostToolGroups: HostToolGroup[] = [
  {
    id: "demo_tools",
    name: "Demo Tools",
    tools: [
      {
        name: "get_current_time",
        description: "Returns the current date and time",
        inputSchema: {
          type: "object",
          properties: {
            timezone: {
              type: "string",
              description:
                "IANA timezone (e.g. America/New_York). Defaults to local.",
            },
          },
        },
        handler: async (args) => {
          const tz =
            (args.timezone as string) ||
            Intl.DateTimeFormat().resolvedOptions().timeZone;
          return new Date().toLocaleString("en-US", { timeZone: tz });
        },
      },
      {
        name: "calculate",
        description:
          "Evaluate a math expression and return the result (e.g. '2 + 2 * 3')",
        inputSchema: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "Math expression to evaluate",
            },
          },
          required: ["expression"],
        },
        handler: async (args) => {
          const expr = args.expression as string;
          const result = Function(`"use strict"; return (${expr})`)();
          return `${expr} = ${result}`;
        },
      },
      {
        name: "generate_uuid",
        description: "Generate a random UUID v4",
        inputSchema: { type: "object", properties: {} },
        handler: async () => {
          return crypto.randomUUID();
        },
      },
      {
        name: "get_browser_info",
        description: "Returns browser name, platform, language and screen size",
        inputSchema: { type: "object", properties: {} },
        handler: async () => {
          return JSON.stringify({
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: `${screen.width}x${screen.height}`,
          });
        },
      },
    ],
  },
];
