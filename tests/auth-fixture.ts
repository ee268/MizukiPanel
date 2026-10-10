import type { Hono } from "hono";
export async function loginCookie(app: Hono, token: string, origin = "http://127.0.0.1:4173") {
  const response = await app.request(origin + "/api/auth/login", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (response.status !== 200)
    throw new Error(`Test login failed: ${response.status} ${await response.text()}`);
  return response.headers.get("set-cookie")!.split(";")[0];
}
