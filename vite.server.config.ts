import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/server/index.ts",
    outDir: "build-server",
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: "index.js" },
    },
  },
});
