import { AdminStaffRoleType, Role } from '@prisma/client';
import { prisma } from './prisma';
import {
  ADMIN_ROLE_CATALOG,
  modulesForRoles,
  permissionsForRoles,
} from './adminPermissions';
import {
  assertLegacyFallbackAllowed,
  LEGACY_SUPER_ADMIN_FALLBACK_REMOVAL_DATE,
} from './adminLegacyFallback';
import { AppError } from '../middleware/errorHandler';

export type StaffRoleResolution = {
  roles: AdminStaffRoleType[];
  legacySuperAdminFallback: boolean;
  legacyFallbackRemovalDate: string;
  institutionIds: string[];
};

export async function getAdminStaffAssignments(userId: string) {
  return prisma.adminStaffAssignment.findMany({
    where: { userId },
    select: { role: true, institutionId: true },
  });
}

export async function getAdminStaffRoles(userId: string): Promise<AdminStaffRoleType[]> {
  const rows = await getAdminStaffAssignments(userId);
  return rows.map((r) => r.role);
}

export async function resolveStaffRolesWithMeta(user: {
  id: string;
  role: Role;
}): Promise<StaffRoleResolution> {
  if (user.role !== Role.admin) {
    return {
      roles: [],
      legacySuperAdminFallback: false,
      legacyFallbackRemovalDate: LEGACY_SUPER_ADMIN_FALLBACK_REMOVAL_DATE,
      institutionIds: [],
    };
  }

  const assigned = await getAdminStaffAssignments(user.id);
  if (assigned.length > 0) {
    return {
      roles: assigned.map((r) => r.role),
      legacySuperAdminFallback: false,
      legacyFallbackRemovalDate: LEGACY_SUPER_ADMIN_FALLBACK_REMOVAL_DATE,
      institutionIds: [
        ...new Set(assigned.map((r) => r.institutionId).filter(Boolean) as string[]),
      ],
    };
  }

  assertLegacyFallbackAllowed();

  return {
    roles: [AdminStaffRoleType.super_admin],
    legacySuperAdminFallback: true,
    legacyFallbackRemovalDate: LEGACY_SUPER_ADMIN_FALLBACK_REMOVAL_DATE,
    institutionIds: [],
  };
}

/** @deprecated Use resolveStaffRolesWithMeta */
export async function resolveStaffRoles(user: { id: string; role: Role }) {
  const result = await resolveStaffRolesWithMeta(user);
  return result.roles;
}

export async function grantStaffRole(
  userId: string,
  role: AdminStaffRoleType,
  grantedByUserId?: string,
  institutionId?: string | null,
) {
  const existing = await prisma.adminStaffAssignment.findFirst({
    where: {
      userId,
      role,
      institutionId: institutionId ?? null,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.adminStaffAssignment.create({
    data: {
      userId,
      role,
      institutionId: institutionId ?? null,
      grantedByUserId,
    },
  });
}

export function buildAdminProfile(
  roles: AdminStaffRoleType[],
  meta?: Pick<StaffRoleResolution, 'legacySuperAdminFallback' | 'legacyFallbackRemovalDate' | 'institutionIds'>,
) {
  return {
    roles,
    roleLabels: roles.map((r) => ADMIN_ROLE_CATALOG.find((c) => c.role === r)?.label ?? r),
    permissions: permissionsForRoles(roles),
    modules: modulesForRoles(roles),
    roleCatalog: ADMIN_ROLE_CATALOG,
    legacySuperAdminFallback: meta?.legacySuperAdminFallback ?? false,
    legacyFallbackRemovalDate: meta?.legacyFallbackRemovalDate ?? LEGACY_SUPER_ADMIN_FALLBACK_REMOVAL_DATE,
    institutionIds: meta?.institutionIds ?? [],
  };
}

export async function loadAdminProfileForUser(user: { id: string; role: Role }) {
  const meta = await resolveStaffRolesWithMeta(user);
  return buildAdminProfile(meta.roles, meta);
}

export function isInstitutionAdminOnly(roles: AdminStaffRoleType[]) {
  return roles.length > 0 && roles.every((r) => r === AdminStaffRoleType.institution_admin);
}
