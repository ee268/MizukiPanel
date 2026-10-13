import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { emptyDocument, patchSettings } from "../../shared/panel-settings";
import type { AiProvider, AiWritingSettings } from "../../shared/ai-writing";
import type { AiVaultStatus } from "../../shared/ai-vault";
import { defaultStateDir } from "./workspace";
import { contentVersion, writeManagedFile } from "./storage";
import { recordArchive } from "./archive-metadata";

const format = "mizuki-panel-ai-vault";
export const aiVaultFileName = "ai-credentials.dpapi.json";
export class AiVaultError extends Error {
  constructor(
    message: string,
    public status: 400 | 409 | 503 = 503,
  ) {
    super(message);
  }
}

export async function protectAiBytes(input: Buffer, decrypt = false): Promise<Buffer> {
  if (process.platform !== "win32")
    throw new AiVaultError("当前系统尚不支持安全密钥存储；不会使用明文保存。可临时填写密钥使用。");
  // The secret travels through stdin only, never arguments, environment variables or temporary scripts.
  const script = `$ErrorActionPreference='Stop'; try { Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $entropy=[Text.Encoding]::UTF8.GetBytes('MizukiPanel.AiVault.v1'); $result=[Security.Cryptography.ProtectedData]::${decrypt ? "Unprotect" : "Protect"}($bytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result)); } catch { exit 1 }`;
  const executable = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32/WindowsPowerShell/v1.0/powershell.exe",
  );
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "ignore"],
    });
    let output = "";
    const fail = () =>
      reject(
        new AiVaultError(
          decrypt
            ? "无法解密 AI 配置，请使用保存时的 Windows 账户，或重新填写配置。"
            : "无法加密 AI 配置，未保存任何明文密钥。",
        ),
      );
    const timer = setTimeout(() => {
      child.kill();
      fail();
    }, 15000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      if (output.length > 1024 * 1024) {
        child.kill();
        fail();
      }
    });
    child.stdin.on("error", () => {});
    child.once("error", () => {
      clearTimeout(timer);
      fail();
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 || !output || !/^[A-Za-z0-9+/]+={0,2}$/.test(output)) return fail();
      resolve(Buffer.from(output, "base64"));
    });
    child.stdin.end(input.toString("base64"));
  });
}

function vaultPath(stateDir = defaultStateDir()) {
  return path.join(stateDir, "secure", aiVaultFileName);
}
function legacyVaultPath() {
  if (process.env.VITEST) return undefined;
  return path.join(
    process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData/Local"),
    "MizukiPanel",
    "secure",
    aiVaultFileName,
  );
}
interface Payload {
  settings: AiWritingSettings;
  keys: Record<AiProvider, string>;
}
function cleanSettings(value: unknown): AiWritingSettings {
  try {
    return patchSettings(emptyDocument("browser"), "browser", "ai", value, "vault").values
      .ai as unknown as AiWritingSettings;
  } catch {
    throw new AiVaultError("AI 配置无效，不能包含密钥或未知字段。", 400);
  }
}
function validKey(value: unknown): value is string {
  return typeof value === "string" && value.length <= 4096 && !/[\s\x00-\x1f\x7f]/.test(value);
}

export class AiVault {
  #cached: { raw: string; version: string; payload: Payload } | null = null;
  #queue: Promise<unknown> = Promise.resolve();
  constructor(
    readonly file = vaultPath(),
    readonly crypt = protectAiBytes,
    readonly legacyFile?: string,
  ) {}
  async #read(): Promise<{ raw: string; version: string; payload: Payload } | null> {
    try {
      const info = await lstat(this.file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 512 * 1024) throw new Error();
      const raw = await readFile(this.file, "utf8");
      if (this.#cached?.raw === raw) return this.#cached;
      const envelope = JSON.parse(raw);
      if (
        envelope.format !== format ||
        envelope.algorithm !== "windows-dpapi-current-user" ||
        typeof envelope.version !== "string" ||
        typeof envelope.ciphertext !== "string" ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.ciphertext)
      )
        throw new Error();
      const decrypted = await this.crypt(Buffer.from(envelope.ciphertext, "base64"), true);
      let payload: Payload;
      try {
        const value = JSON.parse(decrypted.toString("utf8"));
        if (!value.keys || !validKey(value.keys.openai) || !validKey(value.keys.anthropic))
          throw new Error();
        payload = {
          settings: cleanSettings(value.settings),
          keys: { openai: value.keys.openai, anthropic: value.keys.anthropic },
        };
      } finally {
        decrypted.fill(0);
      }
      return (this.#cached = { raw, version: envelope.version, payload });
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
        if (this.legacyFile) {
          const legacy = await new AiVault(this.legacyFile, this.crypt).#read();
          if (legacy) {
            // Copy verified ciphertext only. Keep the old encrypted file as a migration fallback.
            await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
            await writeManagedFile(
              path.dirname(this.file),
              path.basename(this.file),
              legacy.raw,
              null,
              null,
            );
            return this.#read();
          }
        }
        this.#cached = null;
        return null;
      }
      if (cause instanceof AiVaultError) throw cause;
      throw new AiVaultError(
        "AI 加密配置不可读取，原文件已保留；请检查文件权限或加密文件是否损坏。",
      );
    }
  }
  async status(): Promise<AiVaultStatus> {
    const data = await this.#read();
    return {
      version: data?.version ?? null,
      settings: data?.payload.settings ?? null,
      saved: { openai: !!data?.payload.keys.openai, anthropic: !!data?.payload.keys.anthropic },
      supported: process.platform === "win32",
    };
  }
  async key(provider: AiProvider) {
    return (await this.#read())?.payload.keys[provider] ?? "";
  }
  async keys() {
    return Object.values((await this.#read())?.payload.keys ?? {}).filter(Boolean);
  }
  async recoverySource() {
    const data = await this.#read();
    if (!data) throw new AiVaultError("AI 加密备份为空，未恢复。", 400);
    // Restore verified ciphertext with a new revision so previously open clients remain stale.
    return {
      source: JSON.stringify({ ...JSON.parse(data.raw), version: randomUUID() }),
      settings: data.payload.settings,
    };
  }
  async backup() {
    const current = await this.#read();
    if (!current) throw new AiVaultError("请先保存 AI 配置，再创建加密备份。", 400);
    if (path.basename(path.dirname(this.file)) !== "secure")
      throw new AiVaultError("安全存储不在面板 .local 目录中，不能创建备份。", 400);
    const root = path.dirname(path.dirname(this.file));
    const directory = path.join(root, "backups", "settings");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const payload = path.join(directory, `${randomUUID()}.bak`);
    try {
      await writeFile(payload, current.raw, { flag: "wx", mode: 0o600 });
      await recordArchive(payload, "backup", root, `secure/${aiVaultFileName}`, {
        domain: "settings",
      });
    } catch {
      await rm(payload, { force: true }).catch(() => {});
      throw new AiVaultError("无法创建 AI 加密备份，请检查 .local 目录权限。");
    }
  }
  save(input: unknown): Promise<AiVaultStatus> {
    const work = async () => {
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new AiVaultError("AI 保存参数无效。", 400);
      const value = input as Record<string, unknown>;
      if (
        Object.keys(value).some((key) => !["settings", "keys", "version"].includes(key)) ||
        !(value.version === null || typeof value.version === "string")
      )
        throw new AiVaultError("AI 保存参数无效。", 400);
      const settings = cleanSettings(value.settings);
      if (!value.keys || typeof value.keys !== "object" || Array.isArray(value.keys))
        throw new AiVaultError("密钥保存参数无效。", 400);
      const changes = value.keys as Record<string, unknown>;
      if (
        Object.entries(changes).some(
          ([provider, key]) => !["openai", "anthropic"].includes(provider) || !validKey(key),
        )
      )
        throw new AiVaultError("密钥格式无效，请检查长度和空白字符。", 400);
      const current = await this.#read();
      if (value.version !== (current?.version ?? null))
        throw new AiVaultError("AI 配置已在其他页面保存，请重新加载后再修改。", 409);
      const keys = { openai: "", anthropic: "", ...current?.payload.keys, ...changes } as Record<
        AiProvider,
        string
      >;
      const serialized = JSON.stringify(settings);
      if (
        [...Object.values(current?.payload.keys ?? {}), ...Object.values(keys)].some(
          (key) => key && serialized.includes(key),
        )
      )
        throw new AiVaultError("普通 AI 配置中不能填写 API Key。", 400);
      const plaintext = Buffer.from(JSON.stringify({ settings, keys }), "utf8");
      let encrypted: Buffer;
      try {
        encrypted = await this.crypt(plaintext);
      } finally {
        plaintext.fill(0);
      }
      const version = randomUUID();
      const raw = JSON.stringify({
        format,
        algorithm: "windows-dpapi-current-user",
        version,
        ciphertext: encrypted.toString("base64"),
      });
      try {
        const stateDir = path.dirname(path.dirname(this.file));
        const managed = path.basename(path.dirname(this.file)) === "secure";
        await mkdir(managed ? stateDir : path.dirname(this.file), { recursive: true, mode: 0o700 });
        await writeManagedFile(
          managed ? stateDir : path.dirname(this.file),
          managed ? `secure/${aiVaultFileName}` : path.basename(this.file),
          raw,
          current ? contentVersion(current.raw) : null,
          managed ? path.join(stateDir, "backups", "settings") : null,
          managed ? { domain: "settings" } : undefined,
        );
        this.#cached = { raw, version, payload: { settings, keys } };
      } catch {
        throw new AiVaultError("无法写入 AI 加密配置，原配置仍保留。请检查本机存储权限。");
      }
      return this.status();
    };
    const result = this.#queue.then(work);
    this.#queue = result.catch(() => {});
    return result;
  }
}
const vaults = new Map<string, AiVault>();
export function aiVault(stateDir = defaultStateDir()) {
  const file = vaultPath(stateDir);
  let vault = vaults.get(file);
  if (!vault) {
    vault = new AiVault(file, protectAiBytes, legacyVaultPath());
    vaults.set(file, vault);
  }
  return vault;
}
