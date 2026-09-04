/**
 * Audits reverse-scored GAP items (order 5 / mission group 5).
 * Ensures Q5 text matches the hill's repair/prevention theme — not the group-1 theme
 * (e.g. HOPE Q5 must read as repair/reconnection, not connection).
 */
import {
  ALL_GAP_CATEGORIES,
  GROUP_THEMES,
  auditGapMissionMapping,
  classifyQuestion,
  themeForText,
} from './lib/gapMissionMappingAudit.mjs';

export function auditGapReverseItems(options = {}) {
  let categories =
    options.categories === 'all' || options.categories == null
      ? ALL_GAP_CATEGORIES
      : options.categories;

  if (typeof categories === 'string') {
    categories = [categories];
  }

  const audit = auditGapMissionMapping({ categories, requireDistinctCategories: false });
  const q5Results = audit.results.filter((r) => r.order === 5);
  const issues = [];

  for (const r of q5Results) {
    if (!r.isReverseScored) {
      issues.push({
        ...r,
        issue: 'order 5 question is not marked isReverseScored: true',
      });
      continue;
    }

    const expectedG5 = GROUP_THEMES[r.hillCode][5];
    const expectedG1 = GROUP_THEMES[r.hillCode][1];
    const detected = themeForText(r.text);
    const { status } = classifyQuestion(r.hillCode, 5, r.text);

    if (status !== 'match' && status !== 'partial') {
      issues.push({
        ...r,
        issue: `Q5 theme mismatch: expected "${expectedG5}", detected "${detected}"`,
      });
    }

    // HOPE-style collision: group-5 stem must not classify as group-1 theme
    if (detected === expectedG1 && expectedG1 !== expectedG5) {
      issues.push({
        ...r,
        issue: `Q5 reads as group-1 theme ("${expectedG1}") instead of group-5 ("${expectedG5}")`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    categories,
    total: q5Results.length,
    issues,
    q5Results,
  };
}

const args = process.argv.slice(2);
const ciMode = args.includes('--ci');
const jsonMode = args.includes('--json');
const categoryIdx = args.indexOf('--category');
const categories =
  categoryIdx >= 0 && args[categoryIdx + 1]
    ? [args[categoryIdx + 1]]
    : ALL_GAP_CATEGORIES;

const result = auditGapReverseItems({
  categories: categories.length === ALL_GAP_CATEGORIES.length ? 'all' : categories,
});

if (jsonMode) {
  console.log(JSON.stringify(result, null, 2));
  if (ciMode && !result.ok) process.exit(1);
  process.exit(0);
}

console.log('GAP Reverse-Item Theme Audit (order 5 / mission group 5)');
console.log(`Categories: ${result.categories.join(', ')} (${result.total} reverse items)`);
console.log('');

if (result.ok) {
  console.log('✅ All reverse items match group-5 themes (no group-1 collision)');
} else {
  console.log(`❌ ${result.issues.length} issue(s):`);
  for (const issue of result.issues.slice(0, 20)) {
    console.log(`  ${issue.categoryCode} ${issue.hillCode} Q5: ${issue.issue}`);
    console.log(`    Text: "${issue.text}"`);
    console.log(`    Missions: ${issue.missionTitles?.join(' | ') ?? 'n/a'}`);
  }
}

if (ciMode && !result.ok) {
  process.exit(1);
}
