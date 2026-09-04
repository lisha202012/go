import { AdminStaffRoleType } from '@prisma/client';

/** Admin domain modules mapped to spec sections. */
export type AdminModule = 'mission_engine' | 'journey' | 'glow' | 'trust_safety' | 'organizations' | 'audit';

export type AdminPermission =
  | 'mission_engine.read'
  | 'mission_engine.write'
  | 'mission_engine.analytics'
  | 'journey.read'
  | 'journey.write'
  | 'journey.analytics'
  | 'glow.read'
  | 'glow.write'
  | 'glow.analytics'
  | 'trust_safety.read'
  | 'trust_safety.write'
  | 'organizations.read'
  | 'organizations.write'
  | 'audit.read'
  | 'admin.roles.manage';

/** Client-facing role catalog — confirm with client before changing keys. */
export const ADMIN_ROLE_CATALOG: Array<{
  role: AdminStaffRoleType;
  label: string;
  modules: AdminModule[];
  description: string;
}> = [
  {
    role: AdminStaffRoleType.super_admin,
    label: 'Super Admin',
    modules: ['mission_engine', 'journey', 'glow', 'trust_safety', 'organizations', 'audit'],
    description: 'Full access; assign roles; all modules and audit log.',
  },
  {
    role: AdminStaffRoleType.mission_content_admin,
    label: 'Mission Content Admin',
    modules: ['mission_engine'],
    description: 'Mission CRUD, weekly sets, translations, disable missions (§42).',
  },
  {
    role: AdminStaffRoleType.mission_analytics_viewer,
    label: 'Mission Analytics Viewer',
    modules: ['mission_engine'],
    description: 'Read-only Mission Engine analytics (§43).',
  },
  {
    role: AdminStaffRoleType.journey_admin,
    label: 'Journey Admin',
    modules: ['journey'],
    description: 'Camps, steps, progress corrections with audit (§50).',
  },
  {
    role: AdminStaffRoleType.journey_analytics_viewer,
    label: 'Journey Analytics Viewer',
    modules: ['journey'],
    description: 'Read-only journey analytics (§51).',
  },
  {
    role: AdminStaffRoleType.glow_admin,
    label: 'GLOW Admin',
    modules: ['glow'],
    description: 'Seed/referral rules, abuse review, manual reward adjustments (§47).',
  },
  {
    role: AdminStaffRoleType.glow_analytics_viewer,
    label: 'GLOW Analytics Viewer',
    modules: ['glow'],
    description: 'Read-only GLOW analytics (§48).',
  },
  {
    role: AdminStaffRoleType.trust_safety_admin,
    label: 'Trust & Safety Admin',
    modules: ['trust_safety', 'organizations'],
    description: 'Accounts, subscriptions, child-safety escalation, org demand dashboard (§84).',
  },
  {
    role: AdminStaffRoleType.institution_admin,
    label: 'Institution Admin',
    modules: ['journey', 'mission_engine', 'glow'],
    description: 'Org-scoped read-only until institutionId scoping is live (no write yet).',
  },
  {
    role: AdminStaffRoleType.auditor,
    label: 'Auditor',
    modules: ['audit', 'mission_engine', 'journey', 'glow', 'trust_safety', 'organizations'],
    description: 'Read-only cross-cutting audit log access (§85).',
  },
];

const ROLE_PERMISSIONS: Record<AdminStaffRoleType, AdminPermission[]> = {
  super_admin: [
    'mission_engine.read',
    'mission_engine.write',
    'mission_engine.analytics',
    'journey.read',
    'journey.write',
    'journey.analytics',
    'glow.read',
    'glow.write',
    'glow.analytics',
    'trust_safety.read',
    'trust_safety.write',
    'organizations.read',
    'organizations.write',
    'audit.read',
    'admin.roles.manage',
  ],
  mission_content_admin: [
    'mission_engine.read',
    'mission_engine.write',
    'mission_engine.analytics',
  ],
  mission_analytics_viewer: ['mission_engine.read', 'mission_engine.analytics'],
  journey_admin: ['journey.read', 'journey.write', 'journey.analytics'],
  journey_analytics_viewer: ['journey.read', 'journey.analytics'],
  glow_admin: ['glow.read', 'glow.write', 'glow.analytics'],
  glow_analytics_viewer: ['glow.read', 'glow.analytics'],
  trust_safety_admin: ['trust_safety.read', 'trust_safety.write', 'organizations.read', 'organizations.write', 'audit.read'],
  institution_admin: [
    'mission_engine.read',
    'journey.read',
    'glow.read',
    // Write permissions withheld until institutionId scoping is implemented + tested.
  ],
  auditor: [
    'audit.read',
    'mission_engine.read',
    'mission_engine.analytics',
    'journey.read',
    'journey.analytics',
    'glow.read',
    'glow.analytics',
    'trust_safety.read',
    'organizations.read',
  ],
};

const MODULE_PERMISSION_PREFIX: Record<AdminModule, string> = {
  mission_engine: 'mission_engine',
  journey: 'journey',
  glow: 'glow',
  trust_safety: 'trust_safety',
  organizations: 'organizations',
  audit: 'audit',
};

export function permissionsForRoles(roles: AdminStaffRoleType[]): AdminPermission[] {
  const set = new Set<AdminPermission>();
  for (const role of roles) {
    for (const perm of ROLE_PERMISSIONS[role] ?? []) {
      set.add(perm);
    }
  }
  return [...set];
}

export function modulesForRoles(roles: AdminStaffRoleType[]): AdminModule[] {
  const set = new Set<AdminModule>();
  for (const entry of ADMIN_ROLE_CATALOG) {
    if (roles.includes(entry.role)) {
      for (const mod of entry.modules) set.add(mod);
    }
  }
  return [...set];
}

export function roleCanAccessModule(roles: AdminStaffRoleType[], module: AdminModule): boolean {
  return modulesForRoles(roles).includes(module);
}

export function roleHasPermission(
  roles: AdminStaffRoleType[],
  permission: AdminPermission,
): boolean {
  return permissionsForRoles(roles).includes(permission);
}

export function moduleFromPath(path: string): AdminModule | null {
  if (path.includes('/mission-engine')) return 'mission_engine';
  if (path.includes('/journey')) return 'journey';
  if (path.includes('/glow')) return 'glow';
  if (path.includes('/trust-safety')) return 'trust_safety';
  if (path.includes('/organizations')) return 'organizations';
  if (path.includes('/audit')) return 'audit';
  if (path.endsWith('/admin/overview') || path === '/admin') return null;
  return null;
}

export function readPermissionForModule(module: AdminModule): AdminPermission {
  const prefix = MODULE_PERMISSION_PREFIX[module];
  return `${prefix}.read` as AdminPermission;
}

export function isWriteMethod(method: string) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

export function writePermissionForModule(module: AdminModule): AdminPermission | null {
  if (module === 'audit') return null;
  const prefix = MODULE_PERMISSION_PREFIX[module];
  return `${prefix}.write` as AdminPermission;
}
