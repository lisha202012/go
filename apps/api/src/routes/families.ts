import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  familyMemberRoleSchema,
  generateInviteToken,
  pendingMemberSchema,
} from '../lib/familyRoles';
import { z } from 'zod';
import { avatarsByInviteUsername } from '../lib/familyInvites';

export const familiesRouter = Router();

function toPublicMember(
  member: {
    id: string;
    role: string;
    displayName: string | null;
    status: string;
    inviteEmail: string | null;
    inviteUsername: string | null;
    acceptedAt: Date | null;
    createdAt: Date;
    user: { id: string; username: string; avatarUrl: string | null; ageGroup: string | null } | null;
    invitedBy: { id: string; username: string } | null;
  },
  inviteeAvatar?: string | null,
) {
  return {
    id: member.id,
    role: member.role,
    displayName: member.displayName,
    status: member.status,
    inviteEmail: member.inviteEmail,
    inviteUsername: member.inviteUsername,
    acceptedAt: member.acceptedAt,
    createdAt: member.createdAt,
    avatarUrl: member.user?.avatarUrl ?? inviteeAvatar ?? null,
    user: member.user
      ? {
          id: member.user.id,
          username: member.user.username,
          avatarUrl: member.user.avatarUrl,
          ageGroup: member.user.ageGroup,
        }
      : null,
    invitedBy: member.invitedBy
      ? { id: member.invitedBy.id, username: member.invitedBy.username }
      : null,
  };
}

const memberInclude = {
  user: {
    select: { id: true, username: true, avatarUrl: true, ageGroup: true },
  },
  invitedBy: {
    select: { id: true, username: true },
  },
} as const;

familiesRouter.get('/me/members', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.familyId) {
      res.json({ members: [] });
      return;
    }

    const members = await prisma.familyMember.findMany({
      where: { familyId: user.familyId },
      include: memberInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });

    const avatars = await avatarsByInviteUsername(
      members
        .filter((m) => !m.user?.avatarUrl && m.inviteUsername)
        .map((m) => m.inviteUsername as string),
    );

    res.json({
      members: members.map((member) =>
        toPublicMember(
          member,
          member.inviteUsername
            ? avatars.get(member.inviteUsername.toLowerCase()) ?? null
            : null,
        ),
      ),
    });
  } catch (error) {
    next(error);
  }
});

familiesRouter.get('/me/invites', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const invites = await prisma.familyMember.findMany({
      where: {
        status: 'pending',
        OR: [
          { inviteEmail: { equals: user.email, mode: 'insensitive' } },
          { inviteUsername: { equals: user.username, mode: 'insensitive' } },
        ],
      },
      include: {
        family: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      invites: invites.map((invite) => ({
        id: invite.id,
        role: invite.role,
        displayName: invite.displayName,
        family: invite.family,
        invitedBy: invite.invitedBy,
        createdAt: invite.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

const inviteSchema = z.object({
  role: familyMemberRoleSchema,
  displayName: z.string().trim().max(40).optional().nullable(),
  inviteEmail: z.string().email().optional().nullable(),
  inviteUsername: z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,20}$/)
    .optional()
    .nullable(),
});

familiesRouter.post('/me/invites', requireAuth, async (req, res, next) => {
  try {
    const body = inviteSchema.parse(req.body);
    const email = body.inviteEmail?.trim().toLowerCase() || null;
    const username = body.inviteUsername?.trim() || null;

    if (!email && !username) {
      throw new AppError('Provide inviteEmail or inviteUsername', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.familyId) {
      throw new AppError('Create a family first', 400);
    }

    if (email && email === user.email.toLowerCase()) {
      throw new AppError('You cannot invite yourself', 400);
    }
    if (username && username.toLowerCase() === user.username.toLowerCase()) {
      throw new AppError('You cannot invite yourself', 400);
    }

    const member = await prisma.familyMember.create({
      data: {
        familyId: user.familyId,
        role: body.role,
        displayName: body.displayName || null,
        inviteEmail: email,
        inviteUsername: username,
        invitedByUserId: user.id,
        inviteToken: generateInviteToken(),
        status: 'pending',
      },
      include: memberInclude,
    });

    res.status(201).json({ member: toPublicMember(member) });
  } catch (error) {
    next(error);
  }
});

familiesRouter.post('/invites/:inviteId/accept', requireAuth, async (req, res, next) => {
  try {
    const inviteId = req.params.inviteId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const invite = await prisma.familyMember.findUnique({
      where: { id: inviteId },
      include: { family: true },
    });

    if (!invite || invite.status !== 'pending') {
      throw new AppError('Invite not found or already handled', 404);
    }

    const matchesEmail =
      invite.inviteEmail &&
      invite.inviteEmail.toLowerCase() === user.email.toLowerCase();
    const matchesUsername =
      invite.inviteUsername &&
      invite.inviteUsername.toLowerCase() === user.username.toLowerCase();

    if (!matchesEmail && !matchesUsername) {
      throw new AppError('This invite is not for your account', 403);
    }

    const existingActive = await prisma.familyMember.findFirst({
      where: { familyId: invite.familyId, userId: user.id, status: 'active' },
    });
    if (existingActive) {
      throw new AppError('You are already in this family', 409);
    }

    const [member] = await prisma.$transaction([
      prisma.familyMember.update({
        where: { id: invite.id },
        data: {
          userId: user.id,
          status: 'active',
          acceptedAt: new Date(),
          inviteEmail: null,
          inviteUsername: null,
        },
        include: memberInclude,
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { familyId: invite.familyId },
      }),
      prisma.familyMember.deleteMany({
        where: {
          familyId: invite.familyId,
          status: 'pending',
          id: { not: invite.id },
          OR: [
            { inviteUsername: { equals: user.username, mode: 'insensitive' } },
            { inviteEmail: { equals: user.email, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    res.json({
      member: toPublicMember(member),
      family: invite.family,
      role: invite.role,
    });
  } catch (error) {
    next(error);
  }
});

export { pendingMemberSchema };
