import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { aiVault, AiVaultError, type AiVault } from "../../lib/server/ai-vault";
import { readPanelSettings, savePanelSettingsGroups } from "../../lib/server/panel-settings";
import {
  emptyDocument,
  groupFingerprint,
  patchSettings,
  record,
  SettingsValidationError,
} from "../../shared/panel-settings";
import { writeManagedFile } from "../../lib/server/storage";
import path from "node:path";
import { validatePreferenceGroups } from "../../shared/preferences-transfer";
import { ApiError } from "../errors";

// `browser` remains the bundle schema name for compatibility. The authoritative file is local.
export function registerPersonalSettingsRoutes(app: Hono, stateDir: string, injected?: AiVault) {
  const store = () => injected ?? aiVault(stateDir);
  const protect = async (groups: unknown) => {
    const serialized = JSON.stringify(groups);
    if ((await store().keys()).some((key) => serialized.includes(key)))
      throw new ApiError(400, "普通设置中不能填写 API Key。密钥只能加密保存。");
  };
  app.use("/api/settings/personal*", async (context, next) => {
    context.header("cache-control", "no-store");
    try {
      await next();
    } catch (error) {
      if (error instanceof AiVaultError)
        return context.json({ message: error.message }, error.status);
      throw error;
    }
  });
  app.get("/api/settings/personal", async (context) =>
    context.json(await readPanelSettings("browser", undefined, stateDir)),
  );
  app.post("/api/settings/personal/recover", async (context) => {
    const body: unknown = await context.req.json();
    const current = await readPanelSettings("browser", undefined, stateDir);
    if (!record(body) || body.version !== current.version)
      throw new ApiError(409, "设置已改变，请重新载入后恢复。");
    if (current.document.schemaVersion > 1) throw new ApiError(400, "不能重置更新版本的设置。");
    const document = emptyDocument("browser");
    const vault = await store().status();
    if (vault.supported || vault.version)
      await store().save({ version: vault.version, settings: document.values.ai, keys: {} });
    await writeManagedFile(
      stateDir,
      "personal-settings.json",
      JSON.stringify(document, null, 2) + "\n",
      current.version,
      path.join(stateDir, "backups", "settings"),
      { domain: "settings" },
    );
    return context.json(await readPanelSettings("browser", undefined, stateDir));
  });
  app.post(
    "/api/settings/personal/initialize",
    bodyLimit({ maxSize: 256 * 1024 }),
    async (context) => {
      const current = await readPanelSettings("browser", undefined, stateDir);
      if (current.version !== null) return context.json(current);
      const body: unknown = await context.req.json();
      if (!record(body)) throw new ApiError(400, "设置迁移参数无效。");
      const groups = validatePreferenceGroups("browser", body.groups ?? current.document.values);
      const vault = await store().status();
      if (vault.settings) groups.ai = { ...vault.settings };
      await protect(groups);
      return context.json(
        await savePanelSettingsGroups({ scope: "browser", groups, version: null }, stateDir),
      );
    },
  );
  app.put("/api/settings/personal", bodyLimit({ maxSize: 256 * 1024 }), async (context) => {
    const body: unknown = await context.req.json();
    if (!record(body) || !record(body.patches) || !Object.keys(body.patches).length)
      throw new ApiError(400, "请选择设置分组。");
    const current = await readPanelSettings("browser", undefined, stateDir);
    if (current.readOnly) throw new SettingsValidationError(current.warnings[0]);
    const groups: Record<string, unknown> = {};
    for (const [group, patch] of Object.entries(body.patches)) {
      if (!record(patch) || !record(patch.fields)) throw new ApiError(400, "设置参数无效。");
      if (
        patch.base !== undefined &&
        groupFingerprint(patch.base) !== groupFingerprint(current.document.values[group])
      )
        throw new ApiError(409, "本组设置已在其他位置修改，请重新载入后保存。");
      groups[group] = patch.fields;
    }
    validatePreferenceGroups("browser", groups);
    if (groups.ai)
      groups.ai = patchSettings(
        current.document,
        "browser",
        "ai",
        groups.ai,
        "normalize",
      ).values.ai;
    await protect(groups);
    // Imports and resets must keep the encrypted AI configuration in sync too.
    if (groups.ai) {
      const vault = await store().status();
      if (
        (vault.supported || vault.version) &&
        groupFingerprint(groups.ai) !== groupFingerprint(vault.settings)
      )
        await store().save({ version: vault.version, settings: groups.ai, keys: {} });
    }
    return context.json(
      await savePanelSettingsGroups(
        { scope: "browser", groups, version: current.version },
        stateDir,
      ),
    );
  });
}
