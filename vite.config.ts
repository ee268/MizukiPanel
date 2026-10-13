import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { vditorAssets } from "./scripts/vditor-assets";

export default defineConfig({
  plugins: [react(), vditorAssets()],
  publicDir: "static",
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": `http://127.0.0.1:${process.env.API_PORT ?? 4174}`,
    },
  },
  test: {
    setupFiles: ["tests/setup-state.ts"],
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
