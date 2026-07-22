import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";
import svgr from "vite-plugin-svgr";
import { resolve } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json") as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

// Treat every declared dep / peer-dep as external so consumers resolve them
// from their own node_modules instead of getting a duplicated bundled copy.
// Keeps `dist/` slim and lets server-only consumers install just `core` plus
// whichever provider SDK they actually use.
const externalPackages = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];
const externalPattern = new RegExp(
  `^(${externalPackages
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})(/.*)?$`
);

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
  "ui/providers/ApiProvider/index": resolve(__dirname, "src/ui/providers/ApiProvider/index.tsx"),
  "ui/pages/index": resolve(__dirname, "src/ui/pages/index.ts"),

  // Shared
  types: resolve(__dirname, "src/types.ts"),
  "ui/providers/PlatformProvider/index": resolve(__dirname, "src/ui/providers/PlatformProvider/index.ts"),
};

export default defineConfig({
  plugins: [
    // SVGR transforms `*.svg?react` imports into React components at build
    // time. Keeps the JS bundle self-contained (no separate asset files to
    // deploy) while avoiding the `data:` URL + react-svg fetch path that
    // strict host CSPs (`connect-src *` style) reject.
    svgr({ include: "**/*.svg?react" }),
    react(),
    tailwindcss(),
    dts({
      tsconfigPath: "./tsconfig.build.json",
    }),
  ],
  build: {
    lib: {
      entry: entries,
      formats: ["es"],
    },
    rollupOptions: {
      external: [externalPattern, "react/jsx-runtime"],
      output: {
        assetFileNames: "styles/index.[ext]",
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
    cssCodeSplit: false,
    // Ship neither sourcemaps (they were ~48% of the published tarball) nor
    // unminified code — consumers' bundlers re-process from their own source,
    // and the library source is public on GitHub for debugging.
    sourcemap: false,
    minify: "esbuild",
  },
});
