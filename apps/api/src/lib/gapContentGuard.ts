import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Matches gap-945.json meta.contentStatus while copy is still dev placeholder. */
export const GAP_PLACEHOLDER_CONTENT_STATUS = 'dev-placeholder';

type Gap945Meta = {
  contentStatus?: string;
  contentNote?: string;
};

/**
 * When true, placeholder GAP copy must not be present (production / staging / demo).
 * Local development and test runs are exempt unless GOFAM_DEPLOY_ENV targets a client-visible tier.
 */
export function isGapContentGuardEnforced(): boolean {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'test') {
    return false;
  }

  const deployEnv = (process.env.GOFAM_DEPLOY_ENV ?? '').trim().toLowerCase();
  if (deployEnv === 'staging' || deployEnv === 'demo' || deployEnv === 'production') {
    return true;
  }

  return nodeEnv === 'production';
}

export function readGapContentMeta(): Gap945Meta {
  const filePath = join(__dirname, '../../data/gap-945.json');
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { meta?: Gap945Meta };
  return parsed.meta ?? {};
}

export class GapPlaceholderContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GapPlaceholderContentError';
  }
}

/** Fail loudly before serving or seeding GAP in client-visible environments. */
export function assertGapContentReadyForClient(): void {
  if (!isGapContentGuardEnforced()) {
    return;
  }

  const meta = readGapContentMeta();
  if (meta.contentStatus !== GAP_PLACEHOLDER_CONTENT_STATUS) {
    return;
  }

  const deployHint = process.env.GOFAM_DEPLOY_ENV
    ? `GOFAM_DEPLOY_ENV=${process.env.GOFAM_DEPLOY_ENV}`
    : `NODE_ENV=${process.env.NODE_ENV ?? 'development'}`;

  throw new GapPlaceholderContentError(
    [
      '',
      '══════════════════════════════════════════════════════════════════════',
      ' FATAL: GAP assessment still uses dev-placeholder question copy.',
      ` Environment: ${deployHint}`,
      '',
      ' Placeholder text must not ship to staging, demo, or production.',
      ' Replace apps/api/data/gap-945.json with final age-appropriate copy,',
      ' set meta.contentStatus to "approved" (or remove contentStatus), then:',
      '   cd apps/api && npx tsx scripts/seed-gap-questions.ts',
      '',
      meta.contentNote ? ` Note: ${meta.contentNote}` : '',
      '══════════════════════════════════════════════════════════════════════',
      '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

export function exitOnGapPlaceholderContent(): void {
  try {
    assertGapContentReadyForClient();
  } catch (error) {
    if (error instanceof GapPlaceholderContentError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
