import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateAgeInYears,
  deriveAgeCategoryFromDob,
  parseDateOnly,
} from './deriveAgeFromDob.js';

describe('deriveAgeFromDob', () => {
  const asOf = new Date(2026, 7, 29); // Aug 29, 2026 local

  it('maps sprout and youth categories from DOB', () => {
    assert.equal(deriveAgeCategoryFromDob(parseDateOnly('2025-06-01'), asOf), 'S1E');
    assert.equal(deriveAgeCategoryFromDob(parseDateOnly('2022-01-15'), asOf), 'S1G');
    assert.equal(deriveAgeCategoryFromDob(parseDateOnly('2020-03-10'), asOf), 'S1R');
    assert.equal(deriveAgeCategoryFromDob(parseDateOnly('2017-08-01'), asOf), 'A2');
    assert.equal(deriveAgeCategoryFromDob(parseDateOnly('2014-01-01'), asOf), 'B3');
    assert.equal(deriveAgeCategoryFromDob(parseDateOnly('2010-05-20'), asOf), 'C4');
    assert.equal(deriveAgeCategoryFromDob(parseDateOnly('2006-12-01'), asOf), 'D5');
    assert.equal(deriveAgeCategoryFromDob(parseDateOnly('1990-01-01'), asOf), 'V6');
  });

  it('uses birthday-aware age', () => {
    const dob = parseDateOnly('2010-12-31');
    assert.equal(calculateAgeInYears(dob, new Date(2026, 7, 29)), 15);
    assert.equal(calculateAgeInYears(dob, new Date(2026, 11, 31)), 16);
  });

  it('graduates category when user ages (B3 at 12 → C4 at 14)', () => {
    const dob = parseDateOnly('2014-06-15');
    assert.equal(deriveAgeCategoryFromDob(dob, new Date(2026, 5, 15)), 'B3');
    assert.equal(deriveAgeCategoryFromDob(dob, new Date(2028, 5, 15)), 'C4');
  });
});
