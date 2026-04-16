import { useCallback, useState } from "react";
import type { ChatMiddleware } from "@onlyoffice/ai-chat";

export interface LogEntry {
  id: number;
  time: string;
  hook: string;
  action: string;
  detail?: string;
}

let nextId = 0;

function now(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function useMiddlewareLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const push = useCallback((hook: string, action: string, detail?: string) => {
    const entry: LogEntry = { id: nextId++, time: now(), hook, action, detail };
    setEntries((prev) => [entry, ...prev]);
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const middleware: ChatMiddleware[] = [
    {
      beforeSend: (ctx) => {
        const text = ctx.text ?? "";
        if (text.toLowerCase().includes("block")) {
          push("beforeSend", "block", `Blocked: "${text}"`);
          return { action: "block", reason: "Message contains 'block'" };
        }
        push("beforeSend", "continue", `"${text.slice(0, 50)}"`);
        return { action: "continue" };
      },
      onStreamChunk: (ctx) => {
        push(
          "onStreamChunk",
          "continue",
          `chunk: ${JSON.stringify(ctx.chunk).slice(0, 50)}`
        );
        return { action: "continue" };
      },
      beforeToolCall: (ctx) => {
        push("beforeToolCall", "continue", ctx.toolName);
        return { action: "continue" };
      },
      afterToolResult: (ctx) => {
        push("afterToolResult", "continue", ctx.toolName);
        return { action: "continue" };
      },
      beforeDisplay: () => {
        push("beforeDisplay", "continue");
        return { action: "continue" };
      },
      onError: (ctx) => {
        push("onError", "default", ctx.error?.toString());
        return { action: "default" };
      },
    },
  ];

  return { entries, middleware, clear };
}
