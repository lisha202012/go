/**
 * FULL REWRITE generator — builds new GAP question copy from missions-945.json
 * mission-group themes (one question per group 1–5 per hill × category).
 *
 * This is NOT a reorder of gen-gap105.mjs placeholder strings. Mapping/order fixes
 * and content rewrites are separate change types — use this script only for rewrites.
 *
 * Usage:
 *   node scripts/generate-gap-from-missions.mjs              # dry-run summary
 *   node scripts/generate-gap-from-missions.mjs --write       # all 315 active questions
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  ALL_GAP_CATEGORIES,
  auditGapMissionMapping,
} from './lib/gapMissionMappingAudit.mjs';
import { buildGapStem } from './lib/gapStemFromMissions.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');

const HILLS = ['HOPE', 'HONE', 'HOLD', 'HOOD', 'HOST', 'HORN', 'HOOK'];

const REVERSE_SCORED_GROUPS = new Set(['HOPE:5', 'HONE:5', 'HOLD:5', 'HOOD:5', 'HOST:5', 'HORN:5', 'HOOK:5']);

function loadExistingGap945() {
  return JSON.parse(readFileSync(join(DATA_DIR, 'gap-945.json'), 'utf8'));
}

function generateQuestions(categoryFilter) {
  const missions = JSON.parse(readFileSync(join(DATA_DIR, 'missions-945.json'), 'utf8')).missions;
  const categories = categoryFilter ? [categoryFilter] : ALL_GAP_CATEGORIES;
  const questions = [];

  for (const categoryCode of categories) {
    for (const hillCode of HILLS) {
      for (let group = 1; group <= 5; group++) {
        const groupMissions = missions.filter(
          (m) => m.categoryCode === categoryCode && m.hillCode === hillCode && m.missionGroup === group,
        );
        if (groupMissions.length !== 3) {
          throw new Error(
            `Expected 3 missions for ${categoryCode} ${hillCode} G${group}, found ${groupMissions.length}`,
          );
        }

        questions.push({
          categoryCode,
          hillCode,
          order: group,
          missionGroup: group,
          text: buildGapStem(categoryCode, hillCode, group, groupMissions),
          isReverseScored: REVERSE_SCORED_GROUPS.has(`${hillCode}:${group}`),
          _sourceMissions: groupMissions.map((m) => m.title),
        });
      }
    }
  }

  return questions;
}

function mergeIntoGap945(generatedActive, categoryFilter) {
  const existing = loadExistingGap945();
  const generatedByKey = new Map(
    generatedActive.map((q) => [`${q.categoryCode}|${q.hillCode}|${q.order}`, q]),
  );

  const merged = existing.questions.map((q) => {
    if (q.order > 5) return q;
    if (categoryFilter && q.categoryCode !== categoryFilter) return q;
    const key = `${q.categoryCode}|${q.hillCode}|${q.order}`;
    const gen = generatedByKey.get(key);
    if (!gen) return q;
    const { _sourceMissions, missionGroup, ...rest } = gen;
    return rest;
  });

  return {
    meta: {
      ...existing.meta,
      contentStatus: 'dev-placeholder',
      contentNote:
        'Full rewrite from missions-945.json mission-group themes (scripts/generate-gap-from-missions.mjs). Not a reorder of gen-gap105.mjs. Pending client copy review before contentStatus is approved.',
      generatedAt: new Date().toISOString(),
      generator: 'scripts/generate-gap-from-missions.mjs',
    },
    questions: merged,
  };
}

const args = process.argv.slice(2);
const write = args.includes('--write');
const categoryIdx = args.indexOf('--category');
const categoryFilter = categoryIdx >= 0 ? args[categoryIdx + 1] : null;

if (categoryFilter && !ALL_GAP_CATEGORIES.includes(categoryFilter)) {
  console.error(`Unknown category: ${categoryFilter}`);
  process.exit(1);
}

const generated = generateQuestions(categoryFilter);
console.log(`Generated ${generated.length} active questions${categoryFilter ? ` for ${categoryFilter}` : ''}.`);

const sample = generated.filter((q) => q.categoryCode === (categoryFilter ?? 'V6') && q.hillCode === 'HOPE');
console.log('\nSample (HOPE):');
for (const q of sample) {
  console.log(`  Q${q.order}: ${q.text}`);
  console.log(`       ← missions: ${q._sourceMissions.join(' | ')}`);
}

if (!write) {
  console.log('\nDry run — pass --write to update gap-945.json');
  process.exit(0);
}

const output = mergeIntoGap945(generated, categoryFilter);
const outPath = join(DATA_DIR, 'gap-945.json');
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`\nWrote ${outPath}`);

const audit = auditGapMissionMapping({
  categories: categoryFilter ?? 'all',
  requireDistinctCategories: !categoryFilter,
});
console.log(`\nSelf-audit (mapping): ${audit.ok ? 'PASSED' : 'FAILED'} (${audit.passCount}/${audit.total} verified)`);
if (!audit.ok) {
  process.exit(1);
}

const auditScript = join(__dirname, 'audit-gap-mission-mapping.mjs');
const reverseScript = join(__dirname, 'audit-gap-reverse-items.mjs');
const auditArgs = categoryFilter ? ['--category', categoryFilter] : [];

const mappingCi = spawnSync(process.execPath, [auditScript, '--ci', ...auditArgs], {
  stdio: 'inherit',
});
if (mappingCi.status !== 0) process.exit(mappingCi.status ?? 1);

const reverseCi = spawnSync(process.execPath, [reverseScript, '--ci', ...auditArgs], {
  stdio: 'inherit',
});
process.exit(reverseCi.status ?? 1);
