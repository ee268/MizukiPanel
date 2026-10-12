import { spawn } from "node:child_process";
import { containsApiCredential } from "../../../shared/api-credentials";
import type { ProjectReport } from "../project";
import { PublishError } from "./errors";

/** Inspect staged blobs, never return their contents or include them in operation logs. */
export async function assertNoStagedApiKeys(report: ProjectReport, files: string[]) {
  for (const file of files) {
    const credential = await new Promise<boolean>((resolve, reject) => {
      const child = spawn("git", ["-C", report.root, "show", `:${file}`], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
      });
      let pending = "",
        found = false,
        binary = false;
      const timer = setTimeout(() => {
        child.kill();
        reject(new PublishError("密钥检查超时，已取消提交。"));
      }, 30000);
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        if (found || binary) return;
        if (chunk.includes("\0")) {
          binary = true;
          pending = "";
          return;
        }
        const content = pending + chunk;
        found = containsApiCredential(content);
        pending = content.slice(-8192);
      });
      child.once("error", () => {
        clearTimeout(timer);
        reject(new PublishError("无法检查暂存内容，已取消提交。"));
      });
      child.once("close", (code) => {
        clearTimeout(timer);
        code === 0 ? resolve(found) : reject(new PublishError("无法检查暂存内容，已取消提交。"));
      });
    });
    if (credential)
      throw new PublishError("待提交内容含有疑似 API Key，已取消提交；请移除密钥后重新提交。");
  }
}
