import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";
import { vditorAssets } from "./scripts/vditor-assets";

const require = createRequire(import.meta.url);
const remarkParsePath = require.resolve("remark-parse");
const fromMarkdownPath = createRequire(remarkParsePath).resolve("mdast-util-from-markdown");
const workerSafeDecoderPath = createRequire(fromMarkdownPath).resolve(
  "decode-named-character-reference",
);

export default defineConfig({
  plugins: [react(), vditorAssets()],
  // The Markdown parser also runs in a Web Worker. Only this decoder needs its
  // DOM-free entry point; changing export conditions globally breaks UI styles.
  resolve: {
    alias: [
      {
        find: /^decode-named-character-reference$/,
        replacement: workerSafeDecoderPath,
      },
    ],
  },
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
