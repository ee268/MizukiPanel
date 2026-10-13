import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "../src/server/app";
import { saveWorkspacePath } from "../src/lib/server/workspace";
import { defaultAiWritingSettings } from "../src/shared/ai-writing";
import { loginCookie } from "./auth-fixture";
import { AiVault, aiVaultFileName } from "../src/lib/server/ai-vault";
import { createWritingSession } from "../src/client/ai/conversations";
import { storeConversations } from "../src/shared/ai-conversations";

const directories: string[] = [];
const originalToken = process.env.PANEL_ACCESS_TOKEN;
const origin = "http://127.0.0.1:4173";
const key = "sk-" + "synthetic".repeat(8);
afterEach(async () => {
  vi.unstubAllGlobals();
  if (originalToken === undefined) delete process.env.PANEL_ACCESS_TOKEN;
  else process.env.PANEL_ACCESS_TOKEN = originalToken;
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function fixture(secure = false) {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-ai-route-"));
  directories.push(root);
  const project = path.join(root, "project"),
    stateDir = path.join(root, "state");
  await mkdir(path.join(project, "src/config"), { recursive: true });
  await mkdir(path.join(project, "src/content/posts"), { recursive: true });
  await mkdir(path.join(project, "scripts"));
  await writeFile(
    path.join(project, "package.json"),
    JSON.stringify({ name: "mizuki", dependencies: { astro: "7" } }),
  );
  for (const file of ["src/content.config.ts", "src/config/index.ts", "scripts/sync-content.js"])
    await writeFile(path.join(project, file), "");
  await writeFile(path.join(project, ".env"), "ENABLE_CONTENT_SYNC=false\n");
  const articlePath = path.join(project, "src/content/posts/one.md");
  const source = "---\ntitle: 测试\npublished: 2026-10-12\ndraft: true\n---\n\nOriginal\n";
  await writeFile(articlePath, source);
  await saveWorkspacePath(project, stateDir);
  process.env.PANEL_ACCESS_TOKEN = "ai-test";
  const vault = secure ? new AiVault(path.join(root, "secure", aiVaultFileName)) : undefined;
  const app = createApp({ expectedOrigin: origin, stateDir, aiVault: vault });
  const headers = {
    cookie: await loginCookie(app, "ai-test"),
    origin,
    "content-type": "application/json",
  };
  const workspace = await (await app.request(origin + "/api/workspace", { headers })).json();
  const input = {
    settings: { ...defaultAiWritingSettings, openaiModel: "test-model" },
    apiKey: key,
    action: "continue",
    instruction: "",
    title: "测试",
    context: "Original",
    selection: "",
  };
  const post = (body: unknown = input, overrides: Record<string, string> = {}) =>
    app.request(origin + "/api/article/ai-writing", {
      method: "POST",
      headers: { ...headers, "x-mizuki-workspace": workspace.version, ...overrides },
      body: JSON.stringify(body),
    });
  return { app, headers, workspace, input, post, articlePath, source, stateDir, vault };
}
it("persists article sessions behind login, origin and workspace guards, without keys or upstream calls", async () => {
  const { app, headers, workspace, input } = await fixture();
  const url = origin + "/api/ai/conversations?article=one.md";
  const session = createWritingSession(input.settings, 1),
    document = storeConversations([session], session.id);
  const save = (body: unknown, changes: Record<string, string> = {}) =>
    app.request(url, {
      method: "PUT",
      headers: { ...headers, "x-mizuki-workspace": workspace.version, ...changes },
      body: JSON.stringify(body),
    });
  expect((await app.request(url)).status).toBe(401);
  expect((await save({ version: null, document }, { origin: "http://wrong.invalid" })).status).toBe(
    403,
  );
  expect((await save({ version: null, document }, { "x-mizuki-workspace": "old" })).status).toBe(
    409,
  );
  const saved = await save({ version: null, document });
  expect(saved.status).toBe(200);
  expect(saved.headers.get("cache-control")).toBe("no-store");
  const data = await saved.json();
  expect((await (await app.request(url, { headers })).json()).document).toEqual(document);
  expect((await save({ version: null, document })).status).toBe(409);
  expect((await save({ version: data.version })).status).toBe(400);
  expect(
    (
      await save({
        version: data.version,
        document: {
          ...document,
          sessions: [
            {
              ...document.sessions[0],
              settings: { ...document.sessions[0].settings, apiKey: key },
            },
          ],
        },
      })
    ).status,
  ).toBe(400);
});
it.skipIf(process.platform !== "win32")(
  "protects vault endpoints, returns only status, and uses saved keys for model and writing requests",
  async () => {
    const { app, headers, input, post, vault, workspace } = await fixture(true);
    const save = (body: unknown, changes: Record<string, string> = {}) =>
      app.request(origin + "/api/ai/credentials", {
        method: "PUT",
        headers: { ...headers, ...changes },
        body: JSON.stringify(body),
      });
    expect((await app.request(origin + "/api/ai/credentials")).status).toBe(401);
    const body = { version: null, settings: input.settings, keys: { openai: key } };
    expect((await save(body, { origin: "http://wrong.invalid" })).status).toBe(403);
    expect((await save(body, { cookie: "" })).status).toBe(401);
    const response = await save(body);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const saved = await response.json();
    expect(saved.saved.openai).toBe(true);
    expect(JSON.stringify(saved)).not.toContain(key);
    const get = await app.request(origin + "/api/ai/credentials", { headers });
    expect(get.headers.get("cache-control")).toBe("no-store");
    expect(await get.text()).not.toContain(key);
    expect(await readFile(vault!.file, "utf8")).not.toContain(key);
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "安全建议" }, finish_reason: "stop" }],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const writing = await post({ ...input, apiKey: "", useSavedKey: true });
    expect(writing.status).toBe(200);
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${key}`);
    fetcher.mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "test-model" }] })));
    const models = await app.request(origin + "/api/ai/models", {
      method: "POST",
      headers: { ...headers, "x-mizuki-workspace": workspace.version },
      body: JSON.stringify({ settings: input.settings, apiKey: "", useSavedKey: true }),
    });
    expect(models.status).toBe(200);
    expect(await models.text()).not.toContain(key);
    const cleared = await save({
      version: saved.version,
      settings: input.settings,
      keys: { openai: "" },
    });
    expect((await cleared.json()).saved.openai).toBe(false);
    fetcher.mockClear();
    expect((await post({ ...input, apiKey: "", useSavedKey: true })).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  },
  20000,
);
it("requires a session, matching origin and current workspace before sending credentials", async () => {
  const { post } = await fixture();
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect((await post(undefined, { cookie: "" })).status).toBe(401);
  expect((await post(undefined, { origin: "http://wrong.invalid" })).status).toBe(403);
  expect((await post(undefined, { "x-mizuki-workspace": "stale" })).status).toBe(409);
  expect(fetcher).not.toHaveBeenCalled();
});
it("returns uncached suggestions without writing article content or credentials to project state", async () => {
  const { post, articlePath, source, stateDir } = await fixture();
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "建议正文" } }] })),
    );
  vi.stubGlobal("fetch", fetcher);
  const response = await post();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ text: "建议正文", truncated: false });
  expect(await readFile(articlePath, "utf8")).toBe(source);
  expect(await readFile(path.join(stateDir, "workspace.json"), "utf8")).not.toContain(key);
  expect(fetcher).toHaveBeenCalledOnce();
});
it("blocks read-only requests and lets preference saves finish while generation is pending", async () => {
  const { app, headers, workspace, post } = await fixture();
  let resolve!: (response: Response) => void;
  let started!: () => void;
  const entered = new Promise<void>((done) => {
    started = done;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      started();
      return new Promise<Response>((done) => {
        resolve = done;
      });
    }),
  );
  const generating = post();
  await entered;
  const settings = await (await app.request(origin + "/api/settings", { headers })).json();
  const saved = await app.request(origin + "/api/settings", {
    method: "PATCH",
    headers: { ...headers, "x-mizuki-workspace": workspace.version },
    body: JSON.stringify({
      scope: "project",
      group: "access",
      fields: { readOnly: true },
      projectKey: settings.project.key,
      version: settings.project.settings.version,
    }),
  });
  expect(saved.status).toBe(200);
  resolve(new Response(JSON.stringify({ choices: [{ message: { content: "建议" } }] })));
  expect((await generating).status).toBe(200);
  expect((await post()).status).toBe(403);
});
it("authorizes model discovery and never exposes credentials in the response", async () => {
  const { app, headers, workspace, input } = await fixture();
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "model" }] })));
  vi.stubGlobal("fetch", fetcher);
  const query = (overrides: Record<string, string> = {}) =>
    app.request(origin + "/api/ai/models", {
      method: "POST",
      headers: { ...headers, "x-mizuki-workspace": workspace.version, ...overrides },
      body: JSON.stringify({ settings: input.settings, apiKey: key }),
    });
  expect((await query({ cookie: "" })).status).toBe(401);
  expect((await query({ origin: "http://wrong.invalid" })).status).toBe(403);
  expect((await query({ "x-mizuki-workspace": "stale" })).status).toBe(409);
  expect(fetcher).not.toHaveBeenCalled();
  const response = await query();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).not.toContain(key);
});
