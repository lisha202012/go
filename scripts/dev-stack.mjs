/**
 * Start the full local GOFAM GROW stack in one terminal:
 * - Prisma Postgres + API (via apps/api/scripts/dev-api.mjs)
 * - Vite web app (only after API health is OK)
 *
 * Usage: npm run dev   (or npm run dev:stack)
 * Keep this terminal open while developing.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_HEALTH = 'http://127.0.0.1:4000/api/v1/health';
const children = [];
let shuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function start(name, command, args, cwd) {
  console.log(`[dev-stack] Starting ${name}…`);
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  children.push({ name, child });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[dev-stack] ${name} stopped (${signal ?? code}). Shutting down…`);
    shutdown('SIGTERM');
    process.exit(typeof code === 'number' ? code : 1);
  });
  return child;
}

function shutdown(signal) {
  shuttingDown = true;
  for (const { name, child } of children) {
    if (!child.killed) {
      try {
        child.kill(signal);
      } catch {
        console.warn(`[dev-stack] Could not stop ${name}`);
      }
    }
  }
}

async function waitForApiReady(maxMs = 180_000) {
  const started = Date.now();
  let attempt = 0;
  while (Date.now() - started < maxMs) {
    attempt += 1;
    try {
      const res = await fetch(API_HEALTH, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        console.log('[dev-stack] API is ready.');
        return true;
      }
    } catch {
      /* keep waiting */
    }
    if (attempt === 1 || attempt % 5 === 0) {
      console.log('[dev-stack] Waiting for API health…');
    }
    await sleep(1000);
  }
  console.warn('[dev-stack] API did not become healthy in time — starting web anyway.');
  return false;
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
  process.exit(0);
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
  process.exit(0);
});

console.log('');
console.log('  GOFAM GROW — local dev stack');
console.log('  ─────────────────────────────');
console.log('  Web:  http://localhost:5173');
console.log('  API:  http://127.0.0.1:4000  (Vite proxies /api)');
console.log('');
console.log('  Keep this terminal open. Ctrl+C stops everything.');
console.log('');

start('api', 'npm', ['run', 'dev:api'], root);
await waitForApiReady();
if (!shuttingDown) {
  start('web', 'npm', ['run', 'dev:web'], root);
}
