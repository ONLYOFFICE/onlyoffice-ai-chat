import type { PlatformAdapter } from "@onlyoffice/ai-chat";

const darkMq =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export const platform: PlatformAdapter = {
  file: null,
  process: null,
  hostTools: null,
  clouds: null,
  env: {
    theme: darkMq?.matches ? "dark" : "light",
    systemTheme: darkMq?.matches ? "dark" : "light",
    locale:
      typeof navigator !== "undefined"
        ? navigator.language.split("-")[0] || "en"
        : "en",
    devicePixelRatio:
      typeof window !== "undefined" ? window.devicePixelRatio : 1,
    onEnvironmentChange(callback) {
      if (!darkMq) return () => {};
      const handler = (e: MediaQueryListEvent) => {
        callback({ theme: e.matches ? "dark" : "light" });
      };
      darkMq.addEventListener("change", handler);
      return () => darkMq.removeEventListener("change", handler);
    },
  },
};
