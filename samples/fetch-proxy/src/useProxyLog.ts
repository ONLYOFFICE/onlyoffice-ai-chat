import { useCallback, useRef, useState } from "react";
import type { PlatformAdapter } from "@onlyoffice/ai-chat";

export interface ProxyLogEntry {
  id: number;
  time: string;
  method: string;
  url: string;
  status: number | "error";
  duration: number;
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

export function useProxyLog(basePlatform: PlatformAdapter) {
  const [entries, setEntries] = useState<ProxyLogEntry[]>([]);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const clear = useCallback(() => setEntries([]), []);

  const platform: PlatformAdapter = {
    ...basePlatform,
    fetchProxy: async (url: string, init?: RequestInit) => {
      const start = performance.now();
      const method = init?.method?.toUpperCase() ?? "GET";

      try {
        const response = await fetch(url, init);
        const duration = Math.round(performance.now() - start);
        const entry: ProxyLogEntry = {
          id: nextId++,
          time: now(),
          method,
          url,
          status: response.status,
          duration,
        };
        setEntries((prev) => [entry, ...prev]);
        return response;
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        const entry: ProxyLogEntry = {
          id: nextId++,
          time: now(),
          method,
          url,
          status: "error",
          duration,
        };
        setEntries((prev) => [entry, ...prev]);
        throw err;
      }
    },
  };

  return { entries, platform, clear };
}
