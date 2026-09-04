/**
 * CI gate — fails if GAP question text does not map to the correct mission group.
 * Always strict (unlike the content guard, local dev is not exempt when this script runs).
 */
import { runGapMappingAudit } from '../src/lib/gapMappingGuard';

const { ok, output } = runGapMappingAudit();

if (!ok) {
  console.error(output || 'GAP mapping audit failed');
  process.exit(1);
}

console.log('GAP mapping audit: OK (all active questions verified against mission groups)');
