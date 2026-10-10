import type { Hono } from "hono";
import { PanelSessions } from "../lib/server/panel-sessions";
const managers = new WeakMap<Hono, PanelSessions>();
export function panelSessions(app: Hono, manager?: PanelSessions) {
  if (manager) managers.set(app, manager);
  let current = managers.get(app);
  if (!current) {
    current = new PanelSessions();
    managers.set(app, current);
  }
  return current;
}
