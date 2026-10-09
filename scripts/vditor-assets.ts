import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Plugin } from "vite";
import { patchVditorLute } from "./vditor-lute-patch";

const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve("vditor/package.json"));
const prefix = "/assets/vditor/";

function assets(directory: string, base = directory): Map<string, string> {
  const files = new Map<string, string>();
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isDirectory()) {
      for (const [key, value] of assets(filename, base)) files.set(key, value);
    } else if (!/\.(?:map|ts)$/.test(item.name)) {
      files.set(path.relative(base, filename).replaceAll("\\", "/"), filename);
    }
  }
  return files;
}

/** Serve Vditor's lazy dependencies locally in development and emit them at build time. */
export function vditorAssets(): Plugin {
  const files = new Map<string, string>();
  for (const directory of ["js", "css", "images"]) {
    for (const [key, filename] of assets(path.join(root, "dist", directory))) {
      files.set(`dist/${directory}/${key}`, filename);
    }
  }
  files.set("LICENSE", path.join(root, "LICENSE"));
  const lutePath = "dist/js/lute/lute.min.js";
  const lute = patchVditorLute(readFileSync(files.get(lutePath)!, "utf8"));
  const content = (key: string, filename: string) =>
    key === lutePath ? lute : readFileSync(filename);
  return {
    name: "local-vditor-assets",
    configureServer(server) {
      server.middlewares.use(prefix, (request, response, next) => {
        const key = (request.url ?? "").split("?", 1)[0].replace(/^\//, "");
        const filename = files.get(key);
        if (!filename) return next();
        const contentTypes: Record<string, string> = {
          ".js": "application/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".gif": "image/gif",
          ".woff2": "font/woff2",
          ".woff": "font/woff",
          ".wasm": "application/wasm",
        };
        response.setHeader(
          "Content-Type",
          contentTypes[path.extname(filename)] ?? "application/octet-stream",
        );
        response.end(content(key, filename));
      });
    },
    generateBundle() {
      for (const [key, filename] of files) {
        this.emitFile({
          type: "asset",
          fileName: prefix.slice(1) + key,
          source: content(key, filename),
        });
      }
    },
  };
}
