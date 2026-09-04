import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertInstitutionScope, filterByInstitution } from './institutionScope';

describe('institutionScope', () => {
  it('blocks institution admin A from accessing institution B data', () => {
    assert.throws(
      () =>
        assertInstitutionScope({
          actorInstitutionId: 'inst-a',
          resourceInstitutionId: 'inst-b',
          action: 'read',
        }),
      (err: Error) => {
        assert.match(err.message, /Cross-institution access denied/);
        return true;
      },
    );
  });

  it('allows access when institution ids match', () => {
    assert.doesNotThrow(() =>
      assertInstitutionScope({
        actorInstitutionId: 'inst-a',
        resourceInstitutionId: 'inst-a',
        action: 'write',
      }),
    );
  });

  it('filterByInstitution returns only rows for the scoped institution', () => {
    const rows = [
      { id: '1', institutionId: 'inst-a' },
      { id: '2', institutionId: 'inst-b' },
      { id: '3', institutionId: 'inst-a' },
    ];
    const filtered = filterByInstitution(rows, 'inst-a');
    assert.equal(filtered.length, 2);
    assert.ok(filtered.every((r) => r.institutionId === 'inst-a'));
  });
});
