import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(projectRoot);

const mode = process.argv[2];
if (mode !== 'dev' && mode !== 'start') {
  console.error('Usage: node scripts/run.mjs dev|start');
  process.exit(1);
}

const port = Number(process.env.PANEL_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PANEL_PORT must be an integer between 1 and 65535');
  process.exit(1);
}

const token = randomBytes(32).toString('base64url');
const origin = `http://127.0.0.1:${port}`;
const commonEnvironment = {
  ...process.env,
  PANEL_ACCESS_TOKEN: token,
  PANEL_ORIGIN: origin,
  PORT: String(port)
};

console.log(`MizukiPanel: http://127.0.0.1:${port}/login`);
console.log(`本次启动的访问令牌：${token}`);

if (mode === 'start') {
  const buildEntry = fileURLToPath(new URL('../build-server/index.js', import.meta.url));
  if (!existsSync(buildEntry)) {
    console.error('请先运行 pnpm build');
    process.exit(1);
  }
  Object.assign(process.env, commonEnvironment);
  await import('../build-server/index.js');
} else {
  const apiPort = port + 1;
  const viteEntry = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
  const tsxEntry = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url));
  if (!existsSync(viteEntry) || !existsSync(tsxEntry)) {
    console.error('请先运行 pnpm install');
    process.exit(1);
  }
  const environment = { ...commonEnvironment, API_PORT: String(apiPort) };
  const api = spawn(process.execPath, [tsxEntry, 'src/server/index.ts'], {
    cwd: projectRoot,
    env: environment,
    stdio: 'inherit'
  });
  const client = spawn(process.execPath, [viteEntry, 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: projectRoot,
    env: environment,
    stdio: 'inherit'
  });
  const stop = () => {
    api.kill();
    client.kill();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  for (const child of [api, client]) child.on('exit', (code, signal) => {
    if (!api.killed || !client.killed) stop();
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}
