import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@samples/basic": resolve(__dirname, "../basic/src"),
      "@samples/custom-locales": resolve(__dirname, "../custom-locales/src"),
      "@samples/custom-themes": resolve(__dirname, "../custom-themes/src"),
      "@samples/custom-components": resolve(
        __dirname,
        "../custom-components/src"
      ),
      "@samples/events-log": resolve(__dirname, "../events-log/src"),
    },
  },
  server: {
    fs: {
      allow: [resolve(__dirname, "../..")],
    },
  },
});
