import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

const entries = {
  index: resolve(__dirname, "src/index.ts"),
  "providers/index": resolve(__dirname, "src/providers/index.ts"),
  "services/index": resolve(__dirname, "src/services/index.ts"),
  "store/index": resolve(__dirname, "src/store/index.ts"),
  "storage/index": resolve(__dirname, "src/storage/index.ts"),
  "settings/index": resolve(__dirname, "src/settings/index.ts"),
  "platform/index": resolve(__dirname, "src/platform/index.ts"),
  "tools/index": resolve(__dirname, "src/tools/index.ts"),
  "events/index": resolve(__dirname, "src/events/index.ts"),
  "middleware/index": resolve(__dirname, "src/middleware/index.ts"),
  "locales/index": resolve(__dirname, "src/locales/index.ts"),
  "theme/index": resolve(__dirname, "src/theme/index.ts"),
  "components-provider/index": resolve(
    __dirname,
    "src/components-provider/index.ts",
  ),
  "images-provider/index": resolve(
    __dirname,
    "src/images-provider/index.ts",
  ),
  "pages/index": resolve(__dirname, "src/pages/index.ts"),
  "hooks/index": resolve(__dirname, "src/hooks/index.ts"),
  types: resolve(__dirname, "src/types.ts"),
  "utils/index": resolve(__dirname, "src/utils/index.ts"),
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
