import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { SESSION_COOKIE, validAccessToken } from "../lib/server/auth";
import { inspectProject, ProjectError, type ProjectReport } from "../lib/server/project";
import {
  clearWorkspace,
  readWorkspacePath,
  saveWorkspacePath,
  selectWorkspaceDirectory,
  WorkspacePickerError,
} from "../lib/server/workspace";
import {
  articlePreviewPath,
  createArticle,
  deleteArticle,
  listArticles,
  readArticle,
  renameArticle,
  saveArticleFrontmatter,
  saveArticleSource,
} from "../lib/server/articles";
import { ArticleValidationError, type FrontmatterEntry } from "../lib/server/article-format";
import { StorageConflict } from "../lib/server/storage";
import { PathGuardError } from "../lib/server/path-guard";
import {
  deleteMedia,
  listMedia,
  MediaError,
  readMedia,
  uploadMedia,
  type MediaScope,
} from "../lib/server/media";
import { previewStatus, startPreview, stopPreview } from "../lib/server/preview";
import {
  ConfigValidationError,
  listConfigs,
  readConfig,
  readSiteAvatar,
  readSiteIdentity,
  restoreConfig,
  saveConfig,
  SiteConfigError,
} from "../lib/server/configs";
import {
  deleteAlbum,
  deleteAnimeSeason,
  FeatureError,
  featureIndex,
  listAlbums,
  listAnimeSeasons,
  readAnimeSeason,
  readFeatureData,
  readFeatureText,
  restoreFeatureFile,
  saveAlbum,
  saveAnimeSeason,
  saveFeatureData,
  saveFeatureText,
} from "../lib/server/features";
import {
  commitSelected,
  publishDiff,
  publishOperationStatus,
  publishOverview,
  PublishError,
  pushCurrentBranch,
  revertPanelCommit,
  startPublishOperation,
} from "../lib/server/publish";
import type { ConfigValue } from "../lib/server/config-format";
import { dashboardOverview } from "../lib/server/dashboard";

class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 500,
    message: string,
  ) {
    super(message);
  }
}

const app = new Hono();
const root = process.cwd();
const clientRoot = path.join(root, "dist");
const expectedOrigin = process.env.PANEL_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 4173}`;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败";
}

function mapError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (error instanceof StorageConflict) throw new ApiError(409, error.message);
  if (
    error instanceof ArticleValidationError ||
    error instanceof ConfigValidationError ||
    error instanceof SiteConfigError ||
    error instanceof FeatureError ||
    error instanceof MediaError ||
    error instanceof PathGuardError ||
    error instanceof ProjectError ||
    error instanceof PublishError ||
    error instanceof WorkspacePickerError
  )
    throw new ApiError(400, error.message);
  if ((error as NodeJS.ErrnoException)?.code === "ENOENT")
    throw new ApiError(404, "目标文件不存在或已被移动");
  throw error;
}

async function project(): Promise<ProjectReport> {
  const workspace = await readWorkspacePath();
  if (!workspace) throw new ApiError(400, "请先连接 Mizuki 工作区");
  return inspectProject(workspace);
}

app.use("*", async (context, next) => {
  const hostname = new URL(context.req.url).hostname;
  if (!["127.0.0.1", "localhost", "[::1]"].includes(hostname))
    return context.json({ message: "仅接受本机回环请求" }, 403);
  if (!process.env.PANEL_ACCESS_TOKEN)
    return context.json({ message: "请通过 pnpm dev 或 pnpm start 启动面板" }, 503);
  if (!["GET", "HEAD"].includes(context.req.method) && context.req.path !== "/api/auth/login") {
    if (context.req.header("origin") !== expectedOrigin)
      return context.json({ message: "请求来源无效" }, 403);
  }
  if (context.req.path.startsWith("/api/") && context.req.path !== "/api/auth/login") {
    if (!validAccessToken(getCookie(context, SESSION_COOKIE)))
      return context.json({ message: "登录已失效" }, 401);
  }
  await next();
});

app.post("/api/auth/login", async (context) => {
  const body: { token?: string } = await context.req.json<{ token?: string }>().catch(() => ({}));
  const token = body.token?.trim();
  if (!validAccessToken(token))
    throw new ApiError(401, "访问令牌无效，请使用本次启动时终端显示的令牌");
  setCookie(context, SESSION_COOKIE, token!, {
    path: "/",
    httpOnly: true,
    sameSite: "Strict",
    secure: false,
  });
  return context.json({ ok: true });
});

app.post("/api/auth/logout", (context) => {
  deleteCookie(context, SESSION_COOKIE, { path: "/" });
  return context.json({ ok: true });
});

app.get("/api/session", (context) => context.json({ authenticated: true }));

app.get("/api/workspace", async (context) => {
  const connectedPath = await readWorkspacePath();
  if (!connectedPath)
    return context.json({ connectedPath: null, report: null, connectionError: null });
  try {
    return context.json({
      connectedPath,
      report: await inspectProject(connectedPath),
      connectionError: null,
    });
  } catch (error) {
    return context.json({ connectedPath, report: null, connectionError: message(error) });
  }
});

app.post("/api/workspace/select-directory", async (context) => {
  const body: { initialPath?: string } = await context.req
    .json<{ initialPath?: string }>()
    .catch(() => ({}));
  try {
    return context.json({ path: await selectWorkspaceDirectory(body.initialPath) });
  } catch (error) {
    mapError(error);
  }
});
app.post("/api/workspace/connect", async (context) => {
  const { projectPath } = await context.req.json<{ projectPath?: string }>();
  if (!projectPath) throw new ApiError(400, "请输入 Mizuki 项目目录");
  try {
    const report = await inspectProject(projectPath);
    await saveWorkspacePath(report.root);
    return context.json({ report });
  } catch (error) {
    mapError(error);
  }
});

app.post("/api/workspace/disconnect", async (context) => {
  await clearWorkspace();
  return context.json({ ok: true });
});

app.get("/api/dashboard", async (context) =>
  context.json(await dashboardOverview(await project())),
);

app.get("/api/articles", async (context) => {
  const report = await project();
  return context.json({ report, articles: await listArticles(report) });
});

app.get("/api/article", async (context) => {
  const id = context.req.query("id");
  if (!id) throw new ApiError(400, "缺少文章路径");
  try {
    const report = await project();
    const article = await readArticle(report, id);
    return context.json({
      report,
      article,
      previewPath: article.error ? null : articlePreviewPath(article),
    });
  } catch (error) {
    mapError(error);
  }
});

app.post("/api/articles", async (context) => {
  const body = await context.req.json<{
    id?: string;
    title?: string;
    published?: string;
    draft?: boolean;
    body?: string;
  }>();
  if (!body.id || !body.title || !body.published)
    throw new ApiError(400, "文章路径、标题和发布日期不能为空");
  try {
    const report = await project();
    await createArticle(
      report,
      body.id,
      { title: body.title, published: body.published, draft: body.draft !== false },
      body.body ?? "",
    );
    return context.json({ article: await readArticle(report, body.id) }, 201);
  } catch (error) {
    mapError(error);
  }
});

app.put("/api/article/frontmatter", async (context) => {
  const body = await context.req.json<{
    id?: string;
    version?: string;
    entries?: FrontmatterEntry[];
  }>();
  if (!body.id || !body.version || !Array.isArray(body.entries))
    throw new ApiError(400, "Frontmatter 保存参数不完整");
  try {
    const report = await project();
    await saveArticleFrontmatter(report, body.id, body.entries, body.version);
    const article = await readArticle(report, body.id);
    return context.json({
      article,
      previewPath: article.error ? null : articlePreviewPath(article),
    });
  } catch (error) {
    mapError(error);
  }
});

app.put("/api/article/source", async (context) => {
  const body = await context.req.json<{ id?: string; version?: string; source?: string }>();
  if (!body.id || !body.version || typeof body.source !== "string")
    throw new ApiError(400, "源码保存参数不完整");
  try {
    const report = await project();
    await saveArticleSource(report, body.id, body.source, body.version);
    const article = await readArticle(report, body.id);
    return context.json({
      article,
      previewPath: article.error ? null : articlePreviewPath(article),
    });
  } catch (error) {
    mapError(error);
  }
});

app.post("/api/article/rename", async (context) => {
  const body = await context.req.json<{ id?: string; nextId?: string; version?: string }>();
  if (!body.id || !body.nextId || !body.version) throw new ApiError(400, "重命名参数不完整");
  try {
    const report = await project();
    await renameArticle(report, body.id, body.nextId, body.version);
    return context.json({ article: await readArticle(report, body.nextId) });
  } catch (error) {
    mapError(error);
  }
});

app.delete("/api/article", async (context) => {
  const body = await context.req.json<{ id?: string; version?: string }>();
  if (!body.id || !body.version) throw new ApiError(400, "删除参数不完整");
  try {
    await deleteArticle(await project(), body.id, body.version);
    return context.json({ ok: true });
  } catch (error) {
    mapError(error);
  }
});

app.get("/api/site-identity", async (context) => {
  try {
    return context.json(await readSiteIdentity(await project()));
  } catch (error) {
    mapError(error);
  }
});
app.get("/api/site-identity/avatar", async (context) => {
  try {
    const avatar = await readSiteAvatar(await project());
    return context.body(Uint8Array.from(avatar.bytes), 200, {
      "content-type": avatar.type,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    });
  } catch (error) {
    mapError(error);
  }
});
app.get("/api/configs", async (context) => context.json(await listConfigs(await project())));

app.get("/api/config", async (context) => {
  const key = context.req.query("key");
  if (!key) throw new ApiError(400, "缺少配置名称");
  try {
    return context.json(await readConfig(await project(), key));
  } catch (error) {
    mapError(error);
  }
});

app.put("/api/config", async (context) => {
  const body = await context.req.json<{ key?: string; initializer?: string; version?: string }>();
  if (!body.key || typeof body.initializer !== "string" || typeof body.version !== "string")
    throw new ApiError(400, "配置保存参数不完整");
  try {
    return context.json(
      await saveConfig(await project(), body.key, body.initializer, body.version),
    );
  } catch (error) {
    mapError(error);
  }
});

app.post("/api/config/restore", async (context) => {
  const body = await context.req.json<{ key?: string; backupPath?: string; version?: string }>();
  if (!body.key || !body.backupPath || !body.version) throw new ApiError(400, "配置恢复参数不完整");
  try {
    return context.json(
      await restoreConfig(await project(), body.key, body.backupPath, body.version),
    );
  } catch (error) {
    mapError(error);
  }
});

app.get("/api/features", async (context) => context.json(await featureIndex(await project())));

app.get("/api/feature/data", async (context) => {
  const key = context.req.query("key");
  if (!key) throw new ApiError(400, "缺少数据源名称");
  try {
    return context.json(await readFeatureData(await project(), key));
  } catch (error) {
    mapError(error);
  }
});
app.put("/api/feature/data", async (context) => {
  const body = await context.req.json<{ key?: string; value?: ConfigValue; version?: string }>();
  if (!body.key || body.value === undefined || typeof body.version !== "string")
    throw new ApiError(400, "特色页数据保存参数不完整");
  try {
    return context.json(await saveFeatureData(await project(), body.key, body.value, body.version));
  } catch (error) {
    mapError(error);
  }
});
app.get("/api/feature/text", async (context) => {
  const key = context.req.query("key");
  if (!key) throw new ApiError(400, "缺少正文名称");
  try {
    return context.json(await readFeatureText(await project(), key));
  } catch (error) {
    mapError(error);
  }
});
app.put("/api/feature/text", async (context) => {
  const body = await context.req.json<{ key?: string; content?: string; version?: string }>();
  if (!body.key || typeof body.content !== "string" || typeof body.version !== "string")
    throw new ApiError(400, "正文保存参数不完整");
  try {
    return context.json(
      await saveFeatureText(await project(), body.key, body.content, body.version),
    );
  } catch (error) {
    mapError(error);
  }
});
app.post("/api/feature/restore", async (context) => {
  const body = await context.req.json<{
    kind?: "data" | "text";
    key?: string;
    backupPath?: string;
    version?: string;
  }>();
  if (!body.kind || !body.key || !body.backupPath || !body.version)
    throw new ApiError(400, "恢复参数不完整");
  try {
    return context.json(
      await restoreFeatureFile(await project(), body.kind, body.key, body.backupPath, body.version),
    );
  } catch (error) {
    mapError(error);
  }
});
app.get("/api/feature/anime-seasons", async (context) =>
  context.json(await listAnimeSeasons(await project())),
);
app.get("/api/feature/anime-season", async (context) => {
  const id = context.req.query("id");
  if (!id) throw new ApiError(400, "缺少季度路径");
  try {
    return context.json(await readAnimeSeason(await project(), id));
  } catch (error) {
    mapError(error);
  }
});
app.put("/api/feature/anime-season", async (context) => {
  const body = await context.req.json<{ id?: string; content?: string; version?: string }>();
  if (!body.id || typeof body.content !== "string" || typeof body.version !== "string")
    throw new ApiError(400, "季度保存参数不完整");
  try {
    return context.json(
      await saveAnimeSeason(await project(), body.id, body.content, body.version),
    );
  } catch (error) {
    mapError(error);
  }
});
app.delete("/api/feature/anime-season", async (context) => {
  const body = await context.req.json<{ id?: string; version?: string }>();
  if (!body.id || !body.version) throw new ApiError(400, "季度删除参数不完整");
  try {
    return context.json({ trash: await deleteAnimeSeason(await project(), body.id, body.version) });
  } catch (error) {
    mapError(error);
  }
});
app.get("/api/feature/albums", async (context) => context.json(await listAlbums(await project())));
app.put("/api/feature/album", async (context) => {
  const body = await context.req.json<{
    id?: string;
    info?: Record<string, unknown>;
    version?: string;
  }>();
  if (!body.id || !body.info || typeof body.version !== "string")
    throw new ApiError(400, "相册保存参数不完整");
  try {
    return context.json(await saveAlbum(await project(), body.id, body.info, body.version));
  } catch (error) {
    mapError(error);
  }
});
app.delete("/api/feature/album", async (context) => {
  const body = await context.req.json<{ id?: string; version?: string }>();
  if (!body.id || !body.version) throw new ApiError(400, "相册删除参数不完整");
  try {
    return context.json({ trash: await deleteAlbum(await project(), body.id, body.version) });
  } catch (error) {
    mapError(error);
  }
});

app.get("/api/media", async (context) => {
  const report = await project();
  const [media, articles] = await Promise.all([listMedia(report), listArticles(report)]);
  return context.json({
    report,
    media,
    articles: articles.filter((item) => !item.error).map(({ id, title }) => ({ id, title })),
  });
});

app.post("/api/media", async (context) => {
  try {
    const form = await context.req.formData();
    const scope = form.get("scope");
    const file = form.get("file");
    if (scope !== "public" && scope !== "article") throw new MediaError("媒体范围无效");
    if (!(file instanceof File) || !file.name) throw new MediaError("请选择图片文件");
    const folder = String(form.get("folder") ?? "")
      .trim()
      .replace(/^\/+|\/+$/g, "");
    const mediaPath = folder ? `${folder}/${file.name}` : file.name;
    const reference = await uploadMedia(
      await project(),
      scope,
      mediaPath,
      Buffer.from(await file.arrayBuffer()),
      scope === "article" ? String(form.get("articleId") ?? "") : undefined,
    );
    return context.json({ reference }, 201);
  } catch (error) {
    mapError(error);
  }
});

app.delete("/api/media", async (context) => {
  const body = await context.req.json<{ scope?: MediaScope; path?: string }>();
  if ((body.scope !== "public" && body.scope !== "article") || !body.path)
    throw new ApiError(400, "媒体删除参数无效");
  try {
    return context.json({ trash: await deleteMedia(await project(), body.scope, body.path) });
  } catch (error) {
    mapError(error);
  }
});

app.get("/api/media/file", async (context) => {
  const scope = context.req.query("scope");
  const mediaPath = context.req.query("path");
  if ((scope !== "public" && scope !== "article") || !mediaPath)
    throw new ApiError(400, "媒体参数无效");
  try {
    const media = await readMedia(await project(), scope, mediaPath);
    return context.body(Uint8Array.from(media.bytes), 200, {
      "content-type": media.type,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    });
  } catch (error) {
    mapError(error);
  }
});

app.get("/api/preview/status", async (context) =>
  context.json(await previewStatus(await project())),
);
app.post("/api/preview/start", async (context) => {
  try {
    return context.json(await startPreview(await project()));
  } catch (error) {
    mapError(error);
  }
});
app.post("/api/preview/stop", async (context) => {
  try {
    return context.json(await stopPreview(await project()));
  } catch (error) {
    mapError(error);
  }
});

app.get("/api/publish", async (context) => {
  try {
    return context.json(await publishOverview(await project()));
  } catch (error) {
    mapError(error);
  }
});
app.get("/api/publish/diff", async (context) => {
  const filePath = context.req.query("path");
  if (!filePath) throw new ApiError(400, "缺少待预览的文件路径");
  try {
    return context.json({ diff: await publishDiff(await project(), filePath) });
  } catch (error) {
    mapError(error);
  }
});
app.post("/api/publish/commit", async (context) => {
  const body = await context.req.json<{ paths?: string[]; message?: string }>();
  if (!Array.isArray(body.paths) || typeof body.message !== "string")
    throw new ApiError(400, "提交参数不完整");
  try {
    return context.json(await commitSelected(await project(), body.paths, body.message));
  } catch (error) {
    mapError(error);
  }
});
app.post("/api/publish/push", async (context) => {
  try {
    return context.json(await pushCurrentBranch(await project()));
  } catch (error) {
    mapError(error);
  }
});
app.post("/api/publish/revert", async (context) => {
  try {
    return context.json(await revertPanelCommit(await project()));
  } catch (error) {
    mapError(error);
  }
});
app.get("/api/publish/operation", async (context) =>
  context.json(publishOperationStatus(await project())),
);
app.post("/api/publish/operation", async (context) => {
  const body = await context.req.json<{ kind?: "validate" | "sync" | "build" }>();
  if (!body.kind || !["validate", "sync", "build"].includes(body.kind))
    throw new ApiError(400, "发布操作无效");
  try {
    return context.json(await startPublishOperation(await project(), body.kind));
  } catch (error) {
    mapError(error);
  }
});

app.onError((error, context) => {
  const status = error instanceof ApiError ? error.status : 500;
  if (status === 500) console.error(error);
  return context.json({ message: status === 500 ? "服务器内部错误" : error.message }, status);
});

app.use("/assets/*", serveStatic({ root: "./dist" }));
app.get("/favicon.ico", serveStatic({ path: "./dist/favicon.ico" }));
app.get("*", async (context) =>
  context.html(await readFile(path.join(clientRoot, "index.html"), "utf8")),
);

if (!process.env.PANEL_ACCESS_TOKEN)
  process.env.PANEL_ACCESS_TOKEN = randomBytes(32).toString("base64url");
const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4173);
serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, () => {
  console.log(`MizukiPanel API: http://127.0.0.1:${port}`);
});
