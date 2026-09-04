import type { Server } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { exitOnGapPlaceholderContent } from './lib/gapContentGuard';
import { exitOnGapMappingInvalid } from './lib/gapMappingGuard';
import { startScheduledJobs } from './jobs';

exitOnGapPlaceholderContent();
exitOnGapMappingInvalid();

const app = createApp();
startScheduledJobs();

let server: Server;

function shutdown(signal: string) {
  console.log(`\n[api] ${signal} — closing server…`);
  if (!server) {
    process.exit(0);
    return;
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}

function listenWithRetry(attempt = 1) {
  server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`GOFAM GROW API listening on http://127.0.0.1:${env.PORT}`);
    console.log(`Health: http://127.0.0.1:${env.PORT}/api/v1/health`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && attempt < 8) {
      console.warn(`[api] Port ${env.PORT} busy — retry listen (${attempt}/8)…`);
      setTimeout(() => listenWithRetry(attempt + 1), 1500);
      return;
    }
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[api] Port ${env.PORT} is already in use. Another API process is serving it — this watcher will stay idle.`,
      );
      return;
    }
    console.error('[api] Server error:', err);
  });
}

listenWithRetry();

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[api] unhandledRejection (kept running):', reason);
});
