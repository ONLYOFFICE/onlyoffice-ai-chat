import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The lib is linked via `file:../..`, which keeps its own copy of
    // React in `<repo>/node_modules`. Dedupe so the sample and the lib
    // share a single React instance — otherwise hooks called inside
    // the lib see a different runtime and crash with "Invalid hook
    // call".
    dedupe: ["react", "react-dom"],
  },
});
