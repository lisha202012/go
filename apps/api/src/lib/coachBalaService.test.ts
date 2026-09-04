import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isCoachBalaGiftSeed } from './coachBalaService';

describe('isCoachBalaGiftSeed', () => {
  it('recognizes welcome and monthly system gifts', () => {
    assert.equal(isCoachBalaGiftSeed({ isSystemSeed: true, seedKind: 'welcome_coach' }), true);
    assert.equal(isCoachBalaGiftSeed({ isSystemSeed: true, seedKind: 'monthly_coach' }), true);
  });

  it('does not classify ordinary or non-system seeds as Coach Bala gifts', () => {
    assert.equal(isCoachBalaGiftSeed({ isSystemSeed: false, seedKind: 'welcome_coach' }), false);
    assert.equal(isCoachBalaGiftSeed({ isSystemSeed: true, seedKind: 'friend' }), false);
    assert.equal(isCoachBalaGiftSeed({ isSystemSeed: false, sender: { officialAccount: true } }), false);
  });

  it('recognizes other system seeds from an official account', () => {
    assert.equal(
      isCoachBalaGiftSeed({ isSystemSeed: true, seedKind: 'other', sender: { officialAccount: true } }),
      true,
    );
  });
});
