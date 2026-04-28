import type { HostToolGroup } from "@onlyoffice/ai-chat";

/**
 * A small playground of host-side tools the LLM can call from the chat.
 *
 * They run in the browser, are auto-allowed, and exist mostly to make it
 * easy to verify that tool-calling round-trips work in the basic sample.
 */
export const hostToolGroups: HostToolGroup[] = [
  {
    id: "demo",
    name: "Demo Tools",
    tools: [
      {
        name: "current_time",
        description:
          "Returns the current local time as an ISO 8601 string. Use when " +
          "the user asks what time it is or for a timestamp.",
        inputSchema: { type: "object", properties: {} },
        handler: async () => {
          const now = new Date();
          return {
            iso: now.toISOString(),
            local: now.toString(),
            timezone:
              Intl.DateTimeFormat().resolvedOptions().timeZone ?? "unknown",
          };
        },
      },
      {
        name: "user_agent",
        description:
          "Returns the browser's user-agent string and basic platform info. " +
          "Useful when the user asks what browser or OS they're on.",
        inputSchema: { type: "object", properties: {} },
        handler: async () => ({
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: (navigator as { platform?: string }).platform ?? "unknown",
        }),
      },
      {
        name: "random_number",
        description:
          "Returns a random integer in the inclusive range [min, max]. " +
          "Defaults: min=1, max=100.",
        inputSchema: {
          type: "object",
          properties: {
            min: { type: "number", description: "Lower bound (inclusive)" },
            max: { type: "number", description: "Upper bound (inclusive)" },
          },
        },
        // Surface the approval dialog so the basic sample also exercises
        // the manual-allow path (the other two tools auto-allow).
        requireApproval: true,
        handler: async (args) => {
          const min = Number(args.min ?? 1);
          const max = Number(args.max ?? 100);
          if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
            return { error: "Invalid range" };
          }
          const value =
            Math.floor(Math.random() * (max - min + 1)) + min;
          return { value, min, max };
        },
      },
    ],
  },
];
