import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AdminStaffRoleType } from '@prisma/client';
import {
  modulesForRoles,
  permissionsForRoles,
  roleCanAccessModule,
  roleHasPermission,
} from './adminPermissions';

describe('adminPermissions', () => {
  it('mission content admin cannot access trust_safety', () => {
    const roles = [AdminStaffRoleType.mission_content_admin];
    assert.equal(roleCanAccessModule(roles, 'mission_engine'), true);
    assert.equal(roleCanAccessModule(roles, 'trust_safety'), false);
    assert.equal(roleHasPermission(roles, 'trust_safety.read'), false);
  });

  it('trust_safety admin cannot write missions', () => {
    const roles = [AdminStaffRoleType.trust_safety_admin];
    assert.equal(roleHasPermission(roles, 'trust_safety.write'), true);
    assert.equal(roleHasPermission(roles, 'mission_engine.write'), false);
  });

  it('super_admin has all module permissions', () => {
    const roles = [AdminStaffRoleType.super_admin];
    const perms = permissionsForRoles(roles);
    assert.ok(perms.includes('admin.roles.manage'));
    assert.ok(modulesForRoles(roles).includes('trust_safety'));
  });

  it('institution_admin has read-only access until scoping is live', () => {
    const roles = [AdminStaffRoleType.institution_admin];
    assert.equal(roleHasPermission(roles, 'mission_engine.read'), true);
    assert.equal(roleHasPermission(roles, 'journey.read'), true);
    assert.equal(roleHasPermission(roles, 'glow.read'), true);
    assert.equal(roleHasPermission(roles, 'mission_engine.write'), false);
    assert.equal(roleHasPermission(roles, 'journey.write'), false);
    assert.equal(roleHasPermission(roles, 'glow.write'), false);
  });

  it('analytics viewers require MFA but cannot write', () => {
    const missionViewer = [AdminStaffRoleType.mission_analytics_viewer];
    assert.equal(roleHasPermission(missionViewer, 'mission_engine.analytics'), true);
    assert.equal(roleHasPermission(missionViewer, 'mission_engine.write'), false);

    const journeyViewer = [AdminStaffRoleType.journey_analytics_viewer];
    assert.equal(roleHasPermission(journeyViewer, 'journey.analytics'), true);
    assert.equal(roleHasPermission(journeyViewer, 'journey.write'), false);

    const glowViewer = [AdminStaffRoleType.glow_analytics_viewer];
    assert.equal(roleHasPermission(glowViewer, 'glow.analytics'), true);
    assert.equal(roleHasPermission(glowViewer, 'glow.write'), false);
  });
});
