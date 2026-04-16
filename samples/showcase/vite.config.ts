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
      "@samples/imperative-api": resolve(__dirname, "../imperative-api/src"),
      "@samples/middleware": resolve(__dirname, "../middleware/src"),
      "@samples/host-tools": resolve(__dirname, "../host-tools/src"),
      "@samples/image-overrides": resolve(__dirname, "../image-overrides/src"),
      "@samples/custom-provider": resolve(
        __dirname,
        "../custom-provider/src"
      ),
      "@samples/fetch-proxy": resolve(__dirname, "../fetch-proxy/src"),
    },
  },
  server: {
    fs: {
      allow: [resolve(__dirname, "../..")],
    },
  },
});
