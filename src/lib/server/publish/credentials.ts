import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { containsApiCredential } from "../../../shared/api-credentials";
import type { ProjectReport } from "../project";
import { aiVault, aiVaultFileName } from "../ai-vault";
import { PublishError } from "./errors";

const execute = promisify(execFile);
export function containsSensitiveValue(text: string, keys: string[]) {
  return (
    containsApiCredential(text) ||
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(text) ||
    /"format"\s*:\s*"mizuki-panel-ai-vault"/.test(text) ||
    keys.some(
      (key) => key && (text.includes(key) || text.includes(Buffer.from(key).toString("base64"))),
    )
  );
}
export async function savedSensitiveKeys() {
  try {
    return await aiVault().keys();
  } catch {
    throw new PublishError(
      "无法读取安全密钥存储以完成敏感数据检查，已停止 Git 操作。请先处理 AI 加密配置警告。",
    );
  }
}

/** Stream Git objects privately; never return their contents or include them in operation logs. */
async function scanGitOutput(
  report: ProjectReport,
  args: string[],
  keys: string[],
  input?: string,
) {
  return new Promise<boolean>((resolve, reject) => {
    const child = spawn("git", ["-C", report.root, ...args], {
      windowsHide: true,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "ignore"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
    });
    let pending = "",
      found = false,
      bytes = 0;
    const fail = (message: string) => {
      child.kill();
      reject(new PublishError(message));
    };
    const timer = setTimeout(() => fail("敏感数据检查超时，已停止 Git 操作。"), 60000);
    child.stdout!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 256 * 1024 * 1024) {
        fail("待检查数据超过安全检查上限，已停止 Git 操作。");
        return;
      }
      if (found) return;
      const content = pending + chunk;
      found = containsSensitiveValue(content, keys);
      pending = content.slice(-16384);
    });
    child.once("error", () => {
      clearTimeout(timer);
      reject(new PublishError("无法检查 Git 内容，已停止操作。"));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(found) : reject(new PublishError("无法检查 Git 内容，已停止操作。"));
    });
    if (input !== undefined) {
      child.stdin!.on("error", () => {});
      child.stdin!.end(input);
    }
  });
}
export async function assertNoStagedApiKeys(
  report: ProjectReport,
  files: string[],
  keys?: string[],
) {
  const sensitive = keys ?? (await savedSensitiveKeys());
  for (const file of files) {
    if (
      file.replaceAll("\\", "/").split("/").at(-1)?.toLowerCase().startsWith(aiVaultFileName) ||
      (await scanGitOutput(report, ["show", `:${file}`], sensitive))
    )
      throw new PublishError(
        "待提交内容含有疑似 API Key、私钥或密钥存储文件，已取消提交；请移除敏感数据后重新提交。",
      );
  }
}
export async function assertNoOutgoingApiKeys(report: ProjectReport, head: string, remote: string) {
  const keys = await savedSensitiveKeys();
  let objects: string;
  try {
    ({ stdout: objects } = await execute(
      "git",
      [
        "-C",
        report.root,
        "rev-list",
        "--objects",
        "--no-object-names",
        head,
        "--not",
        `--remotes=${remote}`,
      ],
      {
        windowsHide: true,
        encoding: "utf8",
        timeout: 30000,
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
      },
    ));
  } catch {
    throw new PublishError("无法列出待推送内容，已停止推送。");
  }
  const ids = [...new Set(objects.trim().split(/\r?\n/).filter(Boolean))];
  if (ids.length > 20000 || ids.some((id) => !/^[a-f0-9]{40,64}$/.test(id)))
    throw new PublishError("待推送内容超过安全检查上限或格式异常，已停止推送。");
  if (
    ids.length &&
    (await scanGitOutput(report, ["cat-file", "--batch"], keys, ids.join("\n") + "\n"))
  )
    throw new PublishError(
      "待推送历史含有疑似 API Key、私钥或密钥存储文件，已停止推送；请清理相关提交后重试。",
    );
}
