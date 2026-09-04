/**
 * Revert one category's active GAP questions (orders 1–5) to match S1E placeholder copy.
 * Use before a full rewrite so no category sits half-updated.
 *
 *   node scripts/revert-gap-category-placeholder.mjs --category V6
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const gapPath = join(__dirname, '../data/gap-945.json');

const args = process.argv.slice(2);
const idx = args.indexOf('--category');
const category = idx >= 0 ? args[idx + 1] : null;

if (!category) {
  console.error('Usage: node scripts/revert-gap-category-placeholder.mjs --category V6');
  process.exit(1);
}

const gap = JSON.parse(readFileSync(gapPath, 'utf8'));
const reference = gap.questions.filter((q) => q.categoryCode === 'S1E' && q.order <= 5);
const refBySlot = new Map(reference.map((q) => [`${q.hillCode}|${q.order}`, q]));

let reverted = 0;
for (const q of gap.questions) {
  if (q.categoryCode !== category || q.order > 5) continue;
  const ref = refBySlot.get(`${q.hillCode}|${q.order}`);
  if (!ref) {
    console.error(`Missing S1E reference for ${q.hillCode} Q${q.order}`);
    process.exit(1);
  }
  q.text = ref.text;
  q.isReverseScored = ref.isReverseScored;
  reverted += 1;
}

if (reverted !== 35) {
  console.error(`Expected 35 reverted rows, got ${reverted}`);
  process.exit(1);
}

gap.meta.contentNote =
  'Question text is authored in scripts/gen-gap105.mjs (not from the 945-mission doc). The same 35 strings are duplicated for all 9 category codes until final age-appropriate copy is supplied.';
delete gap.meta.generatedAt;
delete gap.meta.generator;

writeFileSync(gapPath, `${JSON.stringify(gap, null, 2)}\n`, 'utf8');
console.log(`Reverted ${category} active questions (${reverted}) to S1E placeholder copy.`);
