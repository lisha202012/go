/**
 * Seeds GAP questions (35 active per category × 9 categories = 315 rows).
 * Run: npx tsx scripts/seed-gap-questions.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedGapQuestions } from '../src/lib/gapService';
import { GAP_TOTAL_QUESTIONS } from '../src/services/gapScoring';
import { AGE_CATEGORY_CODES } from '../src/lib/ageCategories';

const prisma = new PrismaClient();

async function main() {
  const seeded = await seedGapQuestions();
  const count = await prisma.gapQuestion.count();
  const expected = AGE_CATEGORY_CODES.length * GAP_TOTAL_QUESTIONS;

  console.log(`GAP questions seeded: ${seeded} upserts, ${count} rows in database (expected ${expected})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
