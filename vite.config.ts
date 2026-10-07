import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { defaultClientConditions } from "vite";

export default defineConfig({
  plugins: [react()],
  // The Markdown parser also runs in a Web Worker. Prefer worker-safe package exports.
  resolve: { conditions: ["worker", ...defaultClientConditions] },
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
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
