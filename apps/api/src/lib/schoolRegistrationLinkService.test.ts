import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  claimSchoolRegistrationLink,
  createSchoolRegistrationLink,
  listSchoolRegistrationLinks,
} from './schoolRegistrationLinkService';

describe('school registration link service', () => {
  it('creates a school link with standard and section from admin input', async () => {
    const result = await createSchoolRegistrationLink({
      schoolName: 'Green Valley High',
      cityId: 'city-1',
      standard: '8',
      section: 'A',
      createdByAdminId: 'admin-1',
    });

    assert.ok(result.link.token.length > 0);
    assert.equal(result.organization.name, 'Green Valley High');
    assert.equal(result.link.standard, '8');
    assert.equal(result.link.section, 'A');
  });

  it('silently returns null when a link is inactive or already claimed', async () => {
    const linked = await claimSchoolRegistrationLink('user-1', 'missing-token');
    const claimed = await claimSchoolRegistrationLink('user-1', 'inactive-token');

    assert.equal(linked, null);
    assert.equal(claimed, null);
  });

  it('lists links newest first', async () => {
    const links = await listSchoolRegistrationLinks();
    assert.ok(Array.isArray(links));
  });
});
