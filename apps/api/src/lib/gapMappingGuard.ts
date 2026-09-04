import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { isGapContentGuardEnforced } from './gapContentGuard';

export class GapMissionMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GapMissionMappingError';
  }
}

/** Run the mapping audit script (shared with CI). */
export function runGapMappingAudit(): { ok: boolean; output: string } {
  const scriptPath = join(__dirname, '../../scripts/audit-gap-mission-mapping.mjs');
  const result = spawnSync(process.execPath, [scriptPath, '--ci'], {
    encoding: 'utf8',
    cwd: join(__dirname, '../..'),
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  return { ok: result.status === 0, output };
}

/** Fail loudly before serving or seeding GAP when mapping is wrong in client-visible environments. */
export function assertGapMappingValid(): void {
  if (!isGapContentGuardEnforced()) {
    return;
  }

  const { ok, output } = runGapMappingAudit();
  if (ok) {
    return;
  }

  const deployHint = process.env.GOFAM_DEPLOY_ENV
    ? `GOFAM_DEPLOY_ENV=${process.env.GOFAM_DEPLOY_ENV}`
    : `NODE_ENV=${process.env.NODE_ENV ?? 'development'}`;

  throw new GapMissionMappingError(
    [
      '',
      '══════════════════════════════════════════════════════════════════════',
      ' FATAL: GAP question ↔ mission-group mapping audit failed.',
      ` Environment: ${deployHint}`,
      '',
      ' Active GAP questions (order 1–5) must align with missions-945.json',
      ' mission groups 1–5 per hill. Regenerate gap-945.json from mission data,',
      ' then run: node scripts/audit-gap-mission-mapping.mjs --ci',
      '',
      output ? ' Audit output (truncated):' : '',
      output ? output.split('\n').slice(0, 20).join('\n') : '',
      '══════════════════════════════════════════════════════════════════════',
      '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

export function exitOnGapMappingInvalid(): void {
  try {
    assertGapMappingValid();
  } catch (error) {
    if (error instanceof GapMissionMappingError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
