import { randomBytes } from "node:crypto";
import { serve } from "@hono/node-server";
import { createApp } from "./app";

if (!process.env.PANEL_ACCESS_TOKEN) {
  process.env.PANEL_ACCESS_TOKEN = randomBytes(32).toString("base64url");
}

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4173);
const app = createApp();

serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, () => {
  console.log(`MizukiPanel API: http://127.0.0.1:${port}`);
});
