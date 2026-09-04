import type { AgeCategoryCode } from './ageCategories';
import { isChildAgeCategory } from './ageCategories';
import { resolveLeadershipCategory } from './journeyRole';
import type { JourneyRole } from '@prisma/client';

/** Normalize to midnight UTC for stable date-only comparisons. */
export function parseDateOnly(isoDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    throw new Error('Invalid date format');
  }
  const [, y, m, d] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

export function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole years elapsed since date of birth (birthday-aware). */
export function calculateAgeInYears(dob: Date, asOf: Date = new Date()): number {
  const birthY = dob.getUTCFullYear();
  const birthM = dob.getUTCMonth();
  const birthD = dob.getUTCDate();

  const asY = asOf.getUTCFullYear();
  const asM = asOf.getMonth();
  const asD = asOf.getDate();

  let age = asY - birthY;
  if (asM < birthM || (asM === birthM && asD < birthD)) {
    age -= 1;
  }
  return age;
}

/**
 * Map DOB → GOFAM developmental / leadership category.
 * Navigator (N7) is not inferred from DOB — journey_role handles that later.
 */
export function deriveAgeCategoryFromDob(dob: Date, asOf: Date = new Date()): AgeCategoryCode {
  const age = calculateAgeInYears(dob, asOf);

  if (age < 0) {
    throw new Error('Date of birth cannot be in the future');
  }
  if (age > 120) {
    throw new Error('Please enter a valid date of birth');
  }

  if (age <= 2) return 'S1E';
  if (age <= 4) return 'S1G';
  if (age <= 6) return 'S1R';
  if (age <= 9) return 'A2';
  if (age <= 12) return 'B3';
  if (age <= 16) return 'C4';
  if (age <= 20) return 'D5';
  return 'V6';
}

export function syncAgeGroupFromDob<
  T extends { dateOfBirth: Date | null; ageGroup: string | null; journeyRole?: JourneyRole | null },
>(user: T, asOf: Date = new Date()): { ageGroup: AgeCategoryCode | null; isChildProfile: boolean } | null {
  if (!user.dateOfBirth) return null;
  const dobCategory = deriveAgeCategoryFromDob(user.dateOfBirth, asOf);
  const ageGroup = resolveLeadershipCategory(dobCategory, user.journeyRole);
  if (user.ageGroup === ageGroup) return null;
  return { ageGroup, isChildProfile: isChildAgeCategory(ageGroup) };
}
