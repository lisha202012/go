import { z } from 'zod';
import { ageCategorySchema } from './ageCategories';

export const FAMILY_MEMBER_ROLES = [
  'Mom',
  'Dad',
  'Sister',
  'Brother',
  'Son',
  'Daughter',
  'Grandma',
  'Grandpa',
  'Aunt',
  'Uncle',
  'Cousin',
  'Other',
] as const;

export type FamilyMemberRole = (typeof FAMILY_MEMBER_ROLES)[number];

export const familyMemberRoleSchema = z.enum(FAMILY_MEMBER_ROLES);

export const pendingMemberSchema = z.object({
  role: familyMemberRoleSchema,
  displayName: z.string().trim().max(40).optional().nullable(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  ageCategory: ageCategorySchema.optional().nullable(),
  inviteEmail: z.string().email().optional().nullable(),
  inviteUsername: z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,20}$/)
    .optional()
    .nullable(),
});

export function generateInviteToken() {
  return crypto.randomUUID().replace(/-/g, '');
}
