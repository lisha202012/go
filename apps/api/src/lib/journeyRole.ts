import type { AgeCategoryCode } from './ageCategories';
import type { JourneyRole } from '@prisma/client';

const SPROUT_CODES = new Set<AgeCategoryCode>(['S1E', 'S1G', 'S1R']);

export function isSproutAgeCategory(code: string | null | undefined): boolean {
  return Boolean(code && SPROUT_CODES.has(code as AgeCategoryCode));
}

/** Adults for whom Voyager vs Navigator journey choice applies. */
export function isAdultJourneyEligible(code: string | null | undefined): boolean {
  return code === 'V6' || code === 'D5';
}

/**
 * Derive leadership / GAP category from DOB category + journey role.
 * Adults who pick self-growth stay on the Voyager track; guidance-focused paths use Navigator.
 * Navigator (N7) is never inferred from DOB alone.
 */
export function resolveLeadershipCategory(
  dobCategory: AgeCategoryCode,
  journeyRole: JourneyRole | null | undefined,
): AgeCategoryCode {
  if (dobCategory !== 'V6' && dobCategory !== 'D5') return dobCategory;

  if (journeyRole === 'next_generation_guidance' || journeyRole === 'both') return 'N7';

  return 'V6';
}

export function journeyRoleLabel(role: JourneyRole | null | undefined): string | null {
  if (!role) return null;
  switch (role) {
    case 'self_growth':
      return 'Growing Myself';
    case 'next_generation_guidance':
      return 'Guiding the Next Generation';
    case 'both':
      return 'Both';
    default:
      return null;
  }
}
