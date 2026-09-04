import { AGE_CATEGORIES } from './ageCategories';

/** @param {string} isoDate YYYY-MM-DD */
export function parseDateOnly(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate).trim());
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

export function calculateAgeInYears(dob, asOf = new Date()) {
  const birthY = dob.getFullYear();
  const birthM = dob.getMonth();
  const birthD = dob.getDate();
  const asY = asOf.getFullYear();
  const asM = asOf.getMonth();
  const asD = asOf.getDate();
  let age = asY - birthY;
  if (asM < birthM || (asM === birthM && asD < birthD)) age -= 1;
  return age;
}

/** @returns {string | null} category code */
export function deriveAgeCategoryFromDob(dob, asOf = new Date()) {
  const age = calculateAgeInYears(dob, asOf);
  if (age < 0 || age > 120) return null;
  if (age <= 2) return 'S1E';
  if (age <= 4) return 'S1G';
  if (age <= 6) return 'S1R';
  if (age <= 9) return 'A2';
  if (age <= 12) return 'B3';
  if (age <= 16) return 'C4';
  if (age <= 20) return 'D5';
  return 'V6';
}

export function derivedCategoryLabel(code) {
  const normalized = typeof code === 'object' && code !== null ? code.value ?? code.label ?? null : code;
  if (!normalized) return null;
  const match = AGE_CATEGORIES.find((c) => c.code === normalized);
  return match ? match.label : normalized;
}

/** @returns {{ min: string, max: string }} ISO date bounds for date input */
export function dateOfBirthInputBounds(asOf = new Date()) {
  const max = new Date(asOf);
  const min = new Date(asOf);
  min.setFullYear(min.getFullYear() - 120);
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { min: fmt(min), max: fmt(max) };
}

export function isValidDateOfBirth(isoDate, asOf = new Date()) {
  const dob = parseDateOnly(isoDate);
  if (!dob) return false;
  const age = calculateAgeInYears(dob, asOf);
  return age >= 0 && age <= 120;
}

const SPROUT_CODES = new Set(['S1E', 'S1G', 'S1R']);

export function isSproutAgeCategory(code) {
  return Boolean(code && SPROUT_CODES.has(code));
}

export function isAdultJourneyEligible(code) {
  return code === 'V6' || code === 'D5';
}
