import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { waitForApiReady } from "./dev-startup.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
process.chdir(projectRoot);

const mode = process.argv[2];
if (mode !== "dev" && mode !== "start") {
  console.error("Usage: node scripts/run.mjs dev|start");
  process.exit(1);
}

const port = Number(process.env.PANEL_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("PANEL_PORT must be an integer between 1 and 65535");
  process.exit(1);
}

const token = randomBytes(32).toString("base64url");
const origin = `http://127.0.0.1:${port}`;
const commonEnvironment = {
  ...process.env,
  PANEL_ACCESS_TOKEN: token,
  PANEL_ORIGIN: origin,
  PORT: String(port),
};

console.log(`MizukiPanel: http://127.0.0.1:${port}/login`);
console.log(`本次启动的访问令牌：${token}`);

if (mode === "start") {
  const buildEntry = fileURLToPath(new URL("../build-server/index.js", import.meta.url));
  if (!existsSync(buildEntry)) {
    console.error("请先运行 pnpm build");
    process.exit(1);
  }
  Object.assign(process.env, commonEnvironment);
  await import("../build-server/index.js");
} else {
  const apiPort = port + 1;
  if (apiPort > 65535) {
    console.error("开发模式的 PANEL_PORT 必须小于 65535，以预留 API 端口");
    process.exit(1);
  }
  const viteEntry = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
  const tsxEntry = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));
  if (!existsSync(viteEntry) || !existsSync(tsxEntry)) {
    console.error("请先运行 pnpm install");
    process.exit(1);
  }
  const environment = { ...commonEnvironment, API_PORT: String(apiPort) };
  const api = spawn(process.execPath, ["--import", "tsx", "src/server/index.ts"], {
    cwd: projectRoot,
    env: environment,
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });
  let client;
  let stopping = false;
  const startup = new AbortController();
  const stop = () => {
    if (stopping) return;
    stopping = true;
    startup.abort();
    api.kill();
    client?.kill();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  if (process.connected) process.once("disconnect", stop);
  const watch = (child) => {
    child.once("error", (error) => {
      console.error(error.message);
      process.exitCode = 1;
      stop();
    });
    child.once("exit", (code, signal) => {
      if (stopping) return;
      process.exitCode = code ?? (signal ? 1 : 0);
      stop();
    });
  };
  watch(api);
  try {
    await waitForApiReady(api, startup.signal);
    if (!stopping) {
      client = spawn(
        process.execPath,
        [viteEntry, "dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
        { cwd: projectRoot, env: environment, stdio: "inherit" },
      );
      watch(client);
    }
  } catch (error) {
    if (!stopping) {
      console.error(error.message);
      process.exitCode = 1;
      stop();
    }
  }
}
