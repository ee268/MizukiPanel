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
process.env.PANEL_ACCESS_TOKEN = token;
process.env.HOST = '127.0.0.1';
process.env.PORT = String(port);
process.env.ORIGIN = `http://127.0.0.1:${port}`;

console.log(`MizukiPanel: http://127.0.0.1:${port}/login`);
console.log(`本次启动的访问令牌：${token}`);

if (mode === 'start') {
  const buildEntry = fileURLToPath(new URL('../build/index.js', import.meta.url));
  if (!existsSync(buildEntry)) {
    console.error('请先运行 pnpm build');
    process.exit(1);
  }
  await import('../build/index.js');
} else {
  const viteEntry = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
  if (!existsSync(viteEntry)) {
    console.error('请先运行 pnpm install');
    process.exit(1);
  }
  const child = spawn(process.execPath, [viteEntry, 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit'
  });
  child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}
