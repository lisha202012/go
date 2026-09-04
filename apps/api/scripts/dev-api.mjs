/**
 * Reliable local API dev launcher:
 * 1. Single instance (lock file) so extra terminals cannot kill a healthy API
 * 2. Ensures Prisma Postgres (gofam-grow) is reachable on gofam_grow
 * 3. Applies pending migrations (migrate deploy)
 * 4. Reuses a healthy API on port 4000 instead of killing it
 * 5. Starts tsx watch and auto-restarts on crash
 * 6. Recovers Postgres + API if either goes down
 */
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const LOCK_PATH = path.join(apiRoot, '.dev-api.lock');
/** Default Prisma Postgres instance for this project. */
const PG_PORT = process.env.PGPORT || '51214';
const PRISMA_DEV_NAME = process.env.PRISMA_DEV_NAME || 'gofam-grow-mono';
const API_PORT = String(process.env.PORT || '4000');
const DB_NAME = process.env.PGDATABASE || 'gofam_grow';
const HEALTH_URL = `http://127.0.0.1:${API_PORT}/api/v1/health`;

let shuttingDown = false;
let apiChild = null;
let dbWatchTimer = null;
let healthWatchTimer = null;
let recovering = false;
let healthFails = 0;
let holdsLock = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPidRunning(pid) {
  if (!pid || !Number.isFinite(pid)) return false;
  try {
    if (process.platform === 'win32') {
      const output = execSync(`tasklist /FI "PID eq ${pid}" /NH`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return (
        output.includes(String(pid)) &&
        /node\.exe/i.test(output) &&
        !/No tasks are running/i.test(output)
      );
    }
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLockPid() {
  try {
    const pid = Number(fs.readFileSync(LOCK_PATH, 'utf8').trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function acquireLock() {
  const existing = readLockPid();
  if (existing && existing !== process.pid && isPidRunning(existing)) {
    if (listeningPids(API_PORT).size > 0) return false;
    try {
      fs.unlinkSync(LOCK_PATH);
    } catch {
      /* steal stale lock from a node process that is not serving the API */
    }
  }
  fs.writeFileSync(LOCK_PATH, String(process.pid));
  holdsLock = true;
  return true;
}

function releaseLock() {
  if (!holdsLock) return;
  try {
    const pid = readLockPid();
    if (pid === process.pid) fs.unlinkSync(LOCK_PATH);
  } catch {
    /* ignore */
  }
  holdsLock = false;
}

async function canConnectDb(database = DB_NAME) {
  const client = new pg.Client({
    connectionString: `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/${database}?sslmode=disable`,
    connectionTimeoutMillis: 4000,
  });
  client.on('error', () => {
    /* Prisma Postgres often drops the socket mid-check — do not crash the supervisor */
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

async function canConnectPostgresServer() {
  return canConnectDb('template1');
}

async function ensureAppDatabaseExists() {
  const client = new pg.Client({
    connectionString: `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/template1?sslmode=disable`,
    connectionTimeoutMillis: 5000,
  });
  client.on('error', () => {});
  try {
    await client.connect();
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
    if (exists.rowCount === 0) {
      console.log(`[dev] Creating database ${DB_NAME}…`);
      await client.query(`CREATE DATABASE "${DB_NAME}"`);
    }
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

function runSync(command) {
  execSync(command, { cwd: apiRoot, stdio: 'inherit', shell: true });
}

function listeningPids(port) {
  const pids = new Set();
  try {
    if (process.platform === 'win32') {
      const output = execSync('netstat -ano', { encoding: 'utf8' });
      for (const line of output.split('\n')) {
        if (!/LISTENING/i.test(line)) continue;
        const parts = line.trim().split(/\s+/);
        const local = parts[1] || '';
        if (!local.endsWith(`:${port}`) && !local.endsWith(`]:${port}`)) continue;
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
      }
    } else {
      const output = execSync(`lsof -ti:${port} || true`, { encoding: 'utf8' });
      for (const pid of output.split(/\s+/)) {
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
    }
  } catch {
    /* ignore */
  }
  return pids;
}

function killPort(port) {
  const pids = listeningPids(port);
  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      } else {
        process.kill(Number(pid), 'SIGKILL');
      }
      console.log(`[dev] Freed port ${port} (PID ${pid})`);
    } catch {
      /* ignore */
    }
  }
}

async function isApiHealthy() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

function clearPrismaDevLocks() {
  try {
    const tmp = os.tmpdir();
    const files = fs.readdirSync(tmp);
    for (const f of files) {
      if (/prisma.*lock/i.test(f) || f === 'prisma-dev.lock') {
        try {
          fs.unlinkSync(path.join(tmp, f));
          console.log(`[dev] Removed stale Prisma lock ${f}`);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
}

async function startPrismaDevServer() {
  try {
    runSync(`npx prisma dev start ${PRISMA_DEV_NAME}`);
    return;
  } catch {
    /* may already be running or lock held */
  }
  try {
    runSync(`npx prisma dev --name ${PRISMA_DEV_NAME} --db-port ${PG_PORT} --detach`);
  } catch {
    /* ignore */
  }
}

async function forceRestartPrismaDev() {
  console.log('[dev] Forcing Prisma Postgres restart…');
  try {
    runSync(`npx prisma dev stop ${PRISMA_DEV_NAME}`);
  } catch {
    /* ignore */
  }
  try {
    runSync('npx prisma dev stop --all');
  } catch {
    /* ignore */
  }
  await sleep(1500);
  killPort(PG_PORT);
  clearPrismaDevLocks();
  await sleep(1000);
  await startPrismaDevServer();
}

async function waitForDatabase(label, maxAttempts, intervalMs) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (await canConnectPostgresServer()) {
      await ensureAppDatabaseExists();
      if (await canConnectDb()) {
        console.log(`[dev] Database ready${label ? ` (${label})` : ''}`);
        return true;
      }
    }
    console.log(`[dev] Waiting for database… (${attempt}/${maxAttempts})`);
    await sleep(intervalMs);
  }
  return false;
}

async function ensureDatabase() {
  if (await canConnectPostgresServer()) {
    await ensureAppDatabaseExists();
    if (await canConnectDb()) {
      console.log(`[dev] Database OK — ${DB_NAME} on port ${PG_PORT}`);
      return;
    }
  }

  console.log(`[dev] Database not reachable — starting ${PRISMA_DEV_NAME}…`);
  await startPrismaDevServer();
  if (await waitForDatabase('after start', 20, 2000)) return;

  await forceRestartPrismaDev();
  if (await waitForDatabase('after forced restart', 20, 2000)) return;

  throw new Error(
    `Database ${DB_NAME} on port ${PG_PORT} did not become ready.\n` +
      `Try manually: cd apps/api && npx prisma dev start ${PRISMA_DEV_NAME}`,
  );
}

function applyMigrations() {
  try {
    console.log('[dev] Applying migrations (prisma migrate deploy)…');
    runSync('npx prisma migrate deploy');
  } catch (err) {
    console.warn('[dev] migrate deploy failed — API may still start:', err?.message ?? err);
  }
}

async function waitForApiHealth() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    if (await isApiHealthy()) {
      console.log('[dev] API health check passed');
      return true;
    }
    await sleep(1000);
  }
  console.warn('[dev] API health check still pending — tsx may still be compiling');
  return false;
}

function startApiProcess() {
  if (shuttingDown) return;

  killPort(API_PORT);
  console.log(`[dev] Starting API on http://127.0.0.1:${API_PORT}`);

  apiChild = spawn('npx', ['tsx', 'watch', 'src/index.ts'], {
    cwd: apiRoot,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  apiChild.on('exit', (code, signal) => {
    apiChild = null;
    if (shuttingDown) return;
    console.warn(
      `[dev] API exited (code=${code ?? 'null'}, signal=${signal ?? 'null'}) — restarting in 3s…`,
    );
    setTimeout(() => startApiProcess(), 3000);
  });
}

async function ensureApiProcess() {
  if (await isApiHealthy()) {
    console.log('[dev] API already healthy — restarting it to load current source');
    killPort(API_PORT);
    await sleep(500);
  }
  startApiProcess();
}

function restartApiProcess() {
  if (shuttingDown) return;
  console.log('[dev] Restarting API…');
  if (apiChild && !apiChild.killed) {
    try {
      apiChild.kill();
    } catch {
      /* startApiProcess frees the port */
    }
    return;
  }
  startApiProcess();
}

async function recoverDatabase() {
  if (recovering || shuttingDown) return false;
  recovering = true;
  try {
    console.warn('[dev] Database connection lost — attempting recovery…');
    await startPrismaDevServer();
    let ready = await waitForDatabase('watchdog start', 15, 2000);
    if (!ready) {
      await forceRestartPrismaDev();
      ready = await waitForDatabase('watchdog forced restart', 15, 2000);
    }
    return ready;
  } catch (err) {
    console.error('[dev] DB recovery failed:', err?.message ?? err);
    return false;
  } finally {
    recovering = false;
  }
}

async function dbWatchdog() {
  if (shuttingDown || recovering) return;
  if (await canConnectDb()) return;
  const ready = await recoverDatabase();
  if (ready) restartApiProcess();
}

async function apiHealthWatchdog() {
  if (shuttingDown || recovering) return;
  if (await isApiHealthy()) {
    healthFails = 0;
    return;
  }
  healthFails += 1;
  console.warn(`[dev] API health failed (${healthFails}/3)`);
  if (healthFails < 3) return;
  healthFails = 0;
  if (!(await canConnectDb())) {
    const ready = await recoverDatabase();
    if (!ready) return;
  }
  restartApiProcess();
}

async function attachToExisting() {
  const owner = readLockPid();
  console.log(
    `[dev] Another API supervisor is already running (PID ${owner}). Staying attached — not starting a second copy.`,
  );
  while (!shuttingDown) {
    const ownerNow = readLockPid();
    const ownerAlive = ownerNow && isPidRunning(ownerNow);
    if (!ownerAlive) {
      console.log('[dev] Previous supervisor exited — taking over.');
      return 'takeover';
    }
    await sleep(5000);
  }
  return 'shutdown';
}

async function supervise() {
  await ensureDatabase();
  applyMigrations();
  await ensureApiProcess();
  await waitForApiHealth();

  dbWatchTimer = setInterval(() => {
    void dbWatchdog();
  }, 20_000);
  dbWatchTimer.unref?.();

  healthWatchTimer = setInterval(() => {
    void apiHealthWatchdog();
  }, 8_000);
  healthWatchTimer.unref?.();
}

async function main() {
  if (!acquireLock()) {
    const result = await attachToExisting();
    if (result !== 'takeover' || shuttingDown) return;
    if (!acquireLock()) {
      console.error('[dev] Could not take over API supervisor lock.');
      process.exit(1);
    }
  }

  await supervise();
}

function shutdown(signal) {
  shuttingDown = true;
  if (dbWatchTimer) clearInterval(dbWatchTimer);
  if (healthWatchTimer) clearInterval(healthWatchTimer);
  if (apiChild && !apiChild.killed) {
    try {
      apiChild.kill(signal);
    } catch {
      /* ignore */
    }
  }
  releaseLock();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', () => releaseLock());

main().catch((err) => {
  console.error('[dev] Failed:', err.message);
  releaseLock();
  process.exit(1);
});
