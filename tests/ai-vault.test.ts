import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { AiVault, aiVaultFileName, protectAiBytes } from "../src/lib/server/ai-vault";
import { defaultAiWritingSettings } from "../src/shared/ai-writing";
import { aiCredentials, VolatileAiCredentials } from "../src/client/ai/credentials";
import { sessionLifecycle } from "../src/client/auth/session-lifecycle";
import { MaintenanceStore } from "../src/lib/server/maintenance";

const directories: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-ai-vault-"));
  directories.push(root);
  const file = path.join(root, aiVaultFileName);
  return { file, vault: new AiVault(file) };
}
afterEach(async () => {
  for (const root of directories.splice(0)) await rm(root, { recursive: true, force: true });
});

it.skipIf(process.platform !== "win32")(
  "migrates verified legacy ciphertext into .local and supports encrypted backup/restore",
  async () => {
    const { file: legacyFile, vault: legacy } = await fixture();
    const settings = {
      ...defaultAiWritingSettings,
      openaiModel: "legacy-model",
      openaiModels: ["legacy-model"],
    };
    const secret = `fixture-${randomBytes(20).toString("hex")}`;
    await legacy.save({ version: null, settings, keys: { openai: secret } });
    const root = path.dirname(legacyFile);
    const file = path.join(root, "secure", aiVaultFileName);
    const migrated = new AiVault(file, protectAiBytes, legacyFile);
    const status = await migrated.status();
    expect(await readFile(file, "utf8")).toBe(await readFile(legacyFile, "utf8"));
    expect(await migrated.key("openai")).toBe(secret);
    await migrated.backup();
    await migrated.save({ version: status.version, settings, keys: { openai: "" } });
    const store = new MaintenanceStore(root);
    const inventory = await store.inventory(null);
    expect(
      inventory.items.filter((item) => item.originalPath === `secure/${aiVaultFileName}`),
    ).toHaveLength(2);
    for (const name of (await readdir(path.join(root, "backups/settings"))).filter((name) =>
      name.endsWith(".bak"),
    )) {
      const raw = await readFile(path.join(root, "backups/settings", name), "utf8");
      expect(raw).not.toContain(secret);
      expect(raw).not.toContain("legacy-model");
    }
    const preview = await store.restorePreview(inventory.items[0].id, null);
    await store.restore(preview.token, null);
    expect(await new AiVault(file).key("openai")).toBe(secret);
    expect((await new AiVault(file).status()).version).not.toBe(status.version);
    await expect(
      migrated.save({ version: status.version, settings, keys: { openai: "stale-key" } }),
    ).rejects.toThrow("其他页面");
    const publicPrefs = await readFile(path.join(root, "personal-settings.json"), "utf8");
    expect(publicPrefs).not.toContain(secret);
    expect(JSON.parse(publicPrefs).values.ai.openaiModel).toBe("legacy-model");
    // A second browser/restart must never re-import an old credential after a saved deletion.
    const restored = await migrated.status();
    await migrated.save({ version: restored.version, settings, keys: { openai: "" } });
    expect(await new AiVault(file, protectAiBytes, legacyFile).key("openai")).toBe("");
  },
  30000,
);

it.skipIf(process.platform !== "win32")(
  "encrypts configuration and both keys with actual DPAPI, restoring in a fresh store",
  async () => {
    const { file, vault } = await fixture();
    const openai = `custom-${randomBytes(32).toString("hex")}`,
      anthropic = `other-${randomBytes(32).toString("hex")}`;
    const settings = {
      ...defaultAiWritingSettings,
      openaiModel: "example-model",
      openaiModels: ["example-model"],
      systemPrompt: "这是加密配置测试",
    };
    const saved = await vault.save({ version: null, settings, keys: { openai, anthropic } });
    const raw = await readFile(file, "utf8");
    for (const text of [
      openai,
      anthropic,
      Buffer.from(openai).toString("base64"),
      settings.systemPrompt,
      settings.openaiModel,
    ])
      expect(raw).not.toContain(text);
    expect(saved.saved).toEqual({ openai: true, anthropic: true });
    await expect(
      vault.save({
        version: saved.version,
        settings: { ...settings, systemPrompt: `accidental secret: ${openai}` },
        keys: { openai: "replacement-key" },
      }),
    ).rejects.toThrow("不能填写 API Key");
    expect(await readFile(file, "utf8")).toBe(raw);
    expect(JSON.stringify(saved)).not.toContain(openai);
    const restarted = new AiVault(file);
    expect(await restarted.status()).toEqual(saved);
    expect(await restarted.key("openai")).toBe(openai);
    const replaced = await restarted.save({
      version: saved.version,
      settings,
      keys: { openai: "replacement-key" },
    });
    expect(await new AiVault(file).key("anthropic")).toBe(anthropic);
    await restarted.save({ version: replaced.version, settings, keys: { openai: "" } });
    expect((await new AiVault(file).status()).saved).toEqual({ openai: false, anthropic: true });
    expect(await new AiVault(file).key("openai")).toBe("");
  },
  20000,
);

it.skipIf(process.platform !== "win32")(
  "rejects stale saves and corrupted ciphertext without overwriting the existing file",
  async () => {
    const { file, vault } = await fixture();
    const saved = await vault.save({
      version: null,
      settings: defaultAiWritingSettings,
      keys: { openai: "fixture-key" },
    });
    const raw = await readFile(file, "utf8");
    await expect(
      vault.save({
        version: null,
        settings: defaultAiWritingSettings,
        keys: { openai: "changed" },
      }),
    ).rejects.toThrow("其他页面");
    expect(await readFile(file, "utf8")).toBe(raw);
    const envelope = JSON.parse(raw);
    envelope.ciphertext = Buffer.from("corrupt-ciphertext").toString("base64");
    await writeFile(file, JSON.stringify(envelope));
    await expect(new AiVault(file).status()).rejects.toThrow("解密");
    expect(JSON.parse(await readFile(file, "utf8")).version).toBe(saved.version);
  },
  20000,
);

it("never falls back to plaintext when encryption fails, and validates before invoking encryption", async () => {
  const { file } = await fixture();
  const crypt = vi.fn().mockRejectedValue(new Error("unavailable"));
  const vault = new AiVault(file, crypt);
  await expect(
    vault.save({
      version: null,
      settings: defaultAiWritingSettings,
      keys: { openai: "invalid key" },
    }),
  ).rejects.toThrow("格式无效");
  expect(crypt).not.toHaveBeenCalled();
  await expect(
    vault.save({
      version: null,
      settings: { ...defaultAiWritingSettings, apiKey: "bad" },
      keys: {},
    }),
  ).rejects.toThrow("配置无效");
  expect(crypt).not.toHaveBeenCalled();
  await expect(
    vault.save({
      version: null,
      settings: defaultAiWritingSettings,
      keys: { openai: "fixture-key" },
    }),
  ).rejects.toThrow();
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
});

it("restores saved-state metadata after cancelled logout while leaving plaintext input cleared", async () => {
  const status = {
    version: "one",
    settings: defaultAiWritingSettings,
    saved: { openai: true, anthropic: false },
    supported: true,
  };
  aiCredentials.adopt(status);
  aiCredentials.set("openai", "unsaved-fixture-key");
  let finish!: () => void;
  const pending = new Promise<string[]>((resolve) => {
    finish = () => resolve([]);
  });
  const recovery = vi.spyOn(sessionLifecycle.recovery, "save").mockReturnValue(pending);
  try {
    const exit = sessionLifecycle.end("logout", "test logout");
    expect(aiCredentials.available("openai")).toBe(false);
    sessionLifecycle.cancel();
    expect(aiCredentials.available("openai")).toBe(true);
    expect(aiCredentials.get("openai")).toBe("");
    expect(aiCredentials.dirty()).toBe(false);
    finish();
    await exit;
  } finally {
    finish();
    recovery.mockRestore();
    aiCredentials.clear();
  }
});

it("tracks encrypted saved keys without putting their values in browser memory or serialization", () => {
  const vault = new VolatileAiCredentials();
  const status = {
    version: "one",
    settings: defaultAiWritingSettings,
    saved: { openai: true, anthropic: false },
    supported: true,
  };
  vault.adopt(status);
  expect(vault.get("openai")).toBe("");
  expect(vault.available("openai")).toBe(true);
  vault.set("openai", "new-fixture-key");
  expect(vault.dirty()).toBe(true);
  expect(JSON.stringify(vault)).not.toContain("new-fixture-key");
  vault.acknowledge(status, vault.pending());
  expect(vault.get("openai")).toBe("");
  expect(vault.dirty()).toBe(false);
  vault.set("openai", "");
  expect(vault.available("openai")).toBe(false);
  vault.resetDraft();
  expect(vault.available("openai")).toBe(true);
  vault.clear();
  expect(vault.available("openai")).toBe(false);
});

it.skipIf(process.platform === "win32")(
  "refuses persistent secrets on unsupported platforms",
  async () => {
    await expect(protectAiBytes(Buffer.from("test"))).rejects.toThrow("不会使用明文");
  },
);
