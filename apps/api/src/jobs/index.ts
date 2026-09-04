import cron from 'node-cron';
import { expirePendingSeeds } from './seedExpiry';
import { resetExpiredVirtues } from './virtueReset';

export function startScheduledJobs(): void {
  // Every hour: expire pending Glow Seeds past expiresAt
  cron.schedule('0 * * * *', () => {
    void expirePendingSeeds().catch((error) => {
      console.error('[cron] seed expiry failed', error);
    });
  });

  // Daily at 00:05: clear ActiveVirtues past month-end expiresAt
  cron.schedule('5 0 * * *', () => {
    void resetExpiredVirtues().catch((error) => {
      console.error('[cron] virtue reset failed', error);
    });
  });

  console.log('[cron] Scheduled jobs registered (seed expiry hourly, virtue reset daily)');
}
