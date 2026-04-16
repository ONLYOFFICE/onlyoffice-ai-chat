import type { PlatformAdapter } from "@onlyoffice/ai-chat";

const darkMq = window.matchMedia("(prefers-color-scheme: dark)");

export const platform: PlatformAdapter = {
  file: null,
  process: null,
  hostTools: null,
  clouds: null,
  env: {
    theme: darkMq.matches ? "dark" : "light",
    systemTheme: darkMq.matches ? "dark" : "light",
    locale: navigator.language.split("-")[0] || "en",
    devicePixelRatio: window.devicePixelRatio,
    onEnvironmentChange(callback) {
      const handler = (e: MediaQueryListEvent) => {
        callback({ theme: e.matches ? "dark" : "light" });
      };
      darkMq.addEventListener("change", handler);
      return () => darkMq.removeEventListener("change", handler);
    },
  },
};
