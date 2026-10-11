import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
// The target is passed through the child environment, never interpolated into shell code.
const script = [
  "$ErrorActionPreference = 'Stop'",
  "$targetUri = [Uri]$env:MIZUKIPANEL_PROXY_TARGET",
  "$proxy = [System.Net.WebRequest]::GetSystemWebProxy()",
  "if (-not $proxy.IsBypassed($targetUri)) { [Console]::Out.WriteLine($proxy.GetProxy($targetUri).AbsoluteUri) }",
].join("; ");

export async function windowsSystemProxy(
  target: URL,
  signal?: AbortSignal,
): Promise<string | null> {
  const { stdout } = await run(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(script, "utf16le").toString("base64"),
    ],
    {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 8192,
      signal,
      env: { ...process.env, MIZUKIPANEL_PROXY_TARGET: target.href },
    },
  );
  return stdout.trim() || null;
}
