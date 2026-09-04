/**
 * CLI: audits GAP Q1–5 (missionGroup 1–5) against missions-945.json group themes.
 *
 * Usage:
 *   node scripts/audit-gap-mission-mapping.mjs [--ci] [--json] [--category V6]
 *
 * Exit 1 in --ci mode when mapping is not fully verified (match or partial only).
 */
import {
  ALL_GAP_CATEGORIES,
  auditGapMissionMapping,
} from './lib/gapMissionMappingAudit.mjs';

const args = process.argv.slice(2);
const ciMode = args.includes('--ci');
const jsonMode = args.includes('--json');
const categoryIdx = args.indexOf('--category');
const categories =
  categoryIdx >= 0 && args[categoryIdx + 1]
    ? [args[categoryIdx + 1]]
    : ALL_GAP_CATEGORIES;

const audit = auditGapMissionMapping({
  categories: categories.length === ALL_GAP_CATEGORIES.length ? 'all' : categories,
  requireDistinctCategories: categories.length === ALL_GAP_CATEGORIES.length,
});

if (jsonMode) {
  console.log(JSON.stringify(audit, null, 2));
  if (ciMode && !audit.ok) process.exit(1);
  process.exit(0);
}

const pct = (n) => `${((n / audit.total) * 100).toFixed(1)}%`;

console.log('GAP ↔ Mission Group Mapping Audit');
console.log(`Categories: ${audit.categories.join(', ')} (${audit.total} question slots)`);
console.log('');
console.log('Summary:');
console.log(`  Match:         ${audit.counts.match} (${pct(audit.counts.match)})`);
console.log(`  Partial:       ${audit.counts.partial} (${pct(audit.counts.partial)})`);
console.log(`  Mismatch:      ${audit.counts.mismatch} (${pct(audit.counts.mismatch)})`);
console.log(`  Unclassified:  ${audit.counts.unclassified} (${pct(audit.counts.unclassified)})`);
console.log(`  Verified (match+partial): ${audit.passCount} (${pct(audit.passCount)})`);

if (audit.structuralIssues.length > 0) {
  console.log('');
  console.log(`Structural issues (order !== missionGroup): ${audit.structuralIssues.length}`);
  for (const issue of audit.structuralIssues.slice(0, 10)) {
    console.log(`  ${issue.categoryCode} ${issue.hillCode} Q${issue.order}: missionGroup=${issue.missionGroup}`);
  }
}

if (!audit.distinctCategoriesOk) {
  console.log('');
  console.log('Cross-category note: identical question text across all audited categories for slots:');
  console.log(`  ${audit.distinctViolations.join(', ')}`);
}

if (audit.counts.mismatch + audit.counts.unclassified > 0) {
  console.log('');
  console.log('Failures (first 15):');
  const failures = audit.results.filter((r) => r.status === 'mismatch' || r.status === 'unclassified');
  for (const r of failures.slice(0, 15)) {
    const flag = r.status === 'unclassified' ? '❓' : '❌';
    console.log(`${flag} ${r.categoryCode} ${r.hillCode} Q${r.order} → expected G${r.order}: ${r.expectedTheme}`);
    console.log(`   GAP: "${r.text}"`);
    console.log(`   Detected: ${r.detectedTheme}`);
    console.log(`   Missions: ${r.missionTitles.join(' | ')}`);
    console.log('');
  }
}

console.log('');
console.log(audit.ok ? '✅ Mapping audit PASSED' : '❌ Mapping audit FAILED');

if (ciMode && !audit.ok) {
  process.exit(1);
}
