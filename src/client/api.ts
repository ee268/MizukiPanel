import { sessionLifecycle } from "./auth/session-lifecycle";
import type { PanelSessionStatus, SessionEndReason } from "../shared/session";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
let workspaceVersion: string | null = null;
export const setWorkspaceVersion = (value: string | null) => {
  workspaceVersion = value;
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const epoch = sessionLifecycle.getEpoch();
  const headers = new Headers(options.headers);
  if (workspaceVersion) headers.set("x-mizuki-workspace", workspaceVersion);
  if (options.body && !(options.body instanceof FormData) && !headers.has("content-type"))
    headers.set("content-type", "application/json");
  const response = await fetch(path, { ...options, headers });
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    reason?: SessionEndReason;
    key?: string;
    session?: PanelSessionStatus;
  };
  if (!response.ok) {
    if (response.status === 401 && location.pathname !== "/login")
      void sessionLifecycle.end(
        payload.reason ?? "invalid",
        payload.message ?? "登录已失效",
        epoch,
      );
    throw new ApiError(
      response.status,
      payload.message ?? `请求失败（${response.status}）`,
      payload,
    );
  }
  if (path === "/api/auth/login" && payload.session) sessionLifecycle.adopt(payload.session);
  else if (
    (path === "/api/session" || path === "/api/auth/activity") &&
    payload.key &&
    epoch === sessionLifecycle.getEpoch()
  )
    sessionLifecycle.adopt(payload as PanelSessionStatus);
  return payload as T;
}

export function json(method: string, body?: unknown): RequestInit {
  return { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
}
