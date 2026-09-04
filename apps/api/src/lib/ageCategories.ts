import { z } from 'zod';

/** GOFAM GROW age / GAP routing categories (client master spec). */
export const AGE_CATEGORIES = [
  { code: 'S1E', label: 'Sprouts — Early', ageRange: '0–2 years' },
  { code: 'S1G', label: 'Sprouts — Growing', ageRange: '3–4 years' },
  { code: 'S1R', label: 'Sprouts — Ready', ageRange: '5–6 years' },
  { code: 'A2', label: 'Adorables', ageRange: '6–10 years' },
  { code: 'B3', label: 'Bravehearts', ageRange: '10–13 years' },
  { code: 'C4', label: 'Challengers', ageRange: '13–18 years' },
  { code: 'D5', label: 'Discoverers', ageRange: '17–22 years' },
  { code: 'V6', label: 'Voyagers', ageRange: '21+ years' },
  { code: 'N7', label: 'Navigators', ageRange: 'Parents / Grandparents' },
] as const;

export type AgeCategoryCode = (typeof AGE_CATEGORIES)[number]['code'];

export const AGE_CATEGORY_CODES = AGE_CATEGORIES.map((c) => c.code) as [
  AgeCategoryCode,
  ...AgeCategoryCode[],
];

export const ageCategorySchema = z.enum(AGE_CATEGORY_CODES);

const CHILD_CODES = new Set<AgeCategoryCode>(['S1E', 'S1G', 'S1R', 'A2', 'B3', 'C4']);

export function isChildAgeCategory(code: string | null | undefined): boolean {
  return Boolean(code && CHILD_CODES.has(code as AgeCategoryCode));
}

export function ageCategoryLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const match = AGE_CATEGORIES.find((c) => c.code === code);
  return match ? match.ageRange.replace(/ years$/, '') : code;
}
