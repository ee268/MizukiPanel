import type { Hono } from "hono";
import { previewStatus, startPreview, stopPreview } from "../../lib/server/preview";
import { mapError } from "../errors";
import { currentProject } from "../project";

export function registerPreviewRoutes(app: Hono, stateDir?: string) {
  app.get("/api/preview/status", async (context) =>
    context.json(await previewStatus(await currentProject(), stateDir)),
  );
  app.post("/api/preview/start", async (context) => {
    try {
      return context.json(await startPreview(await currentProject(), stateDir));
    } catch (error) {
      mapError(error);
    }
  });
  app.post("/api/preview/stop", async (context) => {
    try {
      return context.json(await stopPreview(await currentProject(), stateDir));
    } catch (error) {
      mapError(error);
    }
  });
}
