import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

const entries = {
  index: resolve(__dirname, "src/index.ts"),

  // Core (transport-agnostic, runs in browser or Node)
  "core/index": resolve(__dirname, "src/core/index.ts"),
  "core/providers/index": resolve(__dirname, "src/core/providers/index.ts"),
  "core/services/index": resolve(__dirname, "src/core/services/index.ts"),
  "core/storage/index": resolve(__dirname, "src/core/storage/index.ts"),
  "core/middleware/index": resolve(__dirname, "src/core/middleware/index.ts"),

  // UI (browser / React)
  "ui/store/index": resolve(__dirname, "src/ui/store/index.ts"),
  "ui/tools/index": resolve(__dirname, "src/ui/tools/index.ts"),
  "ui/providers/EventsProvider/index": resolve(__dirname, "src/ui/providers/EventsProvider/index.ts"),
  "ui/hooks/index": resolve(__dirname, "src/ui/hooks/index.ts"),
  "ui/providers/ImperativeProvider/index": resolve(__dirname, "src/ui/providers/ImperativeProvider/index.ts"),
  "ui/pages/index": resolve(__dirname, "src/ui/pages/index.ts"),

  // Shared
  types: resolve(__dirname, "src/types.ts"),
  "ui/platform/index": resolve(__dirname, "src/ui/platform/index.ts"),
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      tsconfigPath: "./tsconfig.build.json",
      rollupTypes: false,
    }),
  ],
  build: {
    lib: {
      entry: entries,
      formats: ["es"],
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", /^react-dom\//],
      output: {
        assetFileNames: "styles/index.[ext]",
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    minify: false,
  },
});
