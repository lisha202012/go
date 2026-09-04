import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { toPublicUser } from '../lib/publicUser';
import { withEffectiveOnboardingStatus } from '../lib/onboardingStatus';
import { tryBootstrapFlowWeekForUser } from '../lib/flowWeek/flowWeekService';
import {
  ageCategorySchema,
  isChildAgeCategory,
} from '../lib/ageCategories';
import {
  deriveAgeCategoryFromDob,
  parseDateOnly,
  syncAgeGroupFromDob,
} from '../lib/deriveAgeFromDob';
import { resolveLeadershipCategory } from '../lib/journeyRole';
import { verifyAccessToken } from '../lib/jwt';
import {
  familyMemberRoleSchema,
  generateInviteToken,
  pendingMemberSchema,
} from '../lib/familyRoles';
import { computeFlowLeadershipFromInputs } from '../lib/flowLeadershipService';

export const usersRouter = Router();

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

usersRouter.get('/check-username', async (req, res, next) => {
  try {
    const username = String(req.query.username ?? '').trim();
    if (!USERNAME_REGEX.test(username)) {
      res.json({ available: false, reason: 'invalid' });
      return;
    }

    let currentUserId: string | undefined;
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
        currentUserId = payload.sub;
      } catch {
        /* anonymous availability check */
      }
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    const available = !existing || (currentUserId != null && existing.id === currentUserId);
    res.json({ available });
  } catch (error) {
    next(error);
  }
});

const avatarSchema = z.object({
  avatarUrl: z.union([z.string().url(), z.string().startsWith('/')]),
});

const usernameSchema = z.object({
  username: z
    .string()
    .regex(USERNAME_REGEX, 'Username must be 3–20 characters: letters, numbers, underscore'),
});

usersRouter.patch('/me/username', requireAuth, async (req, res, next) => {
  try {
    const { username } = usernameSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== req.user!.id) {
      throw new AppError('Username already in use', 409);
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { username },
    });
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    const { avatarUrl } = avatarSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl },
    });
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

const ageCategoryBodySchema = z.object({
  ageCategory: ageCategorySchema,
});

const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    try {
      const dob = parseDateOnly(value);
      deriveAgeCategoryFromDob(dob);
      return true;
    } catch {
      return false;
    }
  }, 'Enter a valid date of birth');

const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required').max(80),
  username: z
    .string()
    .regex(USERNAME_REGEX, 'Username must be 3–20 characters: letters, numbers, underscore'),
  dateOfBirth: dateOfBirthSchema,
});

const updateMeSchema = z.object({
  standard: z.string().trim().max(20).optional(),
});

usersRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const body = updateMeSchema.parse(req.body ?? {});
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        standard: body.standard !== undefined ? (body.standard || null) : undefined,
      },
    });
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

const devLeadershipTestSchema = z.object({
  flowIndex: z.number().int().min(0).max(100).optional(),
  treeStars: z.number().int().min(0).max(490).optional(),
  totalSteps: z.number().int().min(0).max(343).optional(),
  ageGroup: z.string().trim().min(1).max(10).optional(),
  onboardingCompleted: z.boolean().optional(),
});

usersRouter.post('/me/dev/leadership-test', requireAuth, async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Not available', 404);
    }

    const body = devLeadershipTestSchema.parse(req.body ?? {});
    const current = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });

    const flowIndex = body.flowIndex ?? current.flowIndex ?? 0;
    const treeStars = body.treeStars ?? current.treeStars ?? 0;
    const totalSteps = body.totalSteps ?? 0;
    const ageGroup = body.ageGroup ?? current.ageGroup ?? 'V6';
    const onboardingCompleted = body.onboardingCompleted ?? true;

    const computed = computeFlowLeadershipFromInputs({
      flowIndex,
      treeStars,
      totalSteps,
    });

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ageGroup,
        flowIndex,
        treeStars,
        currentStep: totalSteps,
        onboardingCompleted,
        flowLeadershipInternal: computed.internal,
        flowLeadershipScore: computed.display,
      },
    });

    res.json({
      user: toPublicUser(user),
      debug: {
        flowIndex,
        treeStars,
        totalSteps,
        ageGroup,
        internal: computed.internal,
        display: computed.display,
      },
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me/profile', requireAuth, async (req, res, next) => {
  try {
    const { displayName, username, dateOfBirth } = profileSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== req.user!.id) {
      throw new AppError('Username already in use', 409);
    }

    const dob = parseDateOnly(dateOfBirth);
    const ageCategory = deriveAgeCategoryFromDob(dob);

    const current = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const leadershipCategory = resolveLeadershipCategory(ageCategory, current.journeyRole);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        displayName,
        username,
        dateOfBirth: dob,
        ageGroup: leadershipCategory,
        isChildProfile: isChildAgeCategory(leadershipCategory),
      },
    });
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

const sproutGuardianSchema = z.object({
  guardianSupported: z.boolean(),
});

usersRouter.patch('/me/sprout-guardian', requireAuth, async (req, res, next) => {
  try {
    const { guardianSupported } = sproutGuardianSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { guardianSupported },
    });
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

const journeyRoleBodySchema = z.object({
  journeyRole: z.enum(['self_growth', 'next_generation_guidance', 'both']),
});

usersRouter.patch('/me/journey-role', requireAuth, async (req, res, next) => {
  try {
    const { journeyRole } = journeyRoleBodySchema.parse(req.body);
    const current = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!current.dateOfBirth) {
      throw new AppError('Add your date of birth before choosing a journey', 400);
    }

    const dobCategory = deriveAgeCategoryFromDob(current.dateOfBirth);
    const ageGroup = resolveLeadershipCategory(dobCategory, journeyRole);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        journeyRole,
        ageGroup,
        isChildProfile: isChildAgeCategory(ageGroup),
      },
    });
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

const locationSchema = z.object({
  countryId: z.string().min(1),
  stateId: z.string().min(1),
  cityId: z.string().min(1),
  countryName: z.string().trim().min(1).optional(),
  stateName: z.string().trim().min(1).optional(),
  cityName: z.string().trim().min(1).optional(),
});

usersRouter.patch('/me/location', requireAuth, async (req, res, next) => {
  try {
    const body = locationSchema.parse(req.body);
    let countryId = body.countryId;
    let stateId = body.stateId;
    let cityId = body.cityId;
    let city = await prisma.geoCity.findUnique({ where: { id: cityId }, include: { state: true } });

    if (!city && body.countryName && body.stateName && body.cityName) {
      const country = await prisma.geoCountry.upsert({
        where: { code: body.countryId.toUpperCase() },
        update: { name: body.countryName },
        create: { code: body.countryId.toUpperCase(), name: body.countryName },
      });
      const state = await prisma.geoState.upsert({
        where: { countryId_name: { countryId: country.id, name: body.stateName } },
        update: {},
        create: { countryId: country.id, name: body.stateName },
      });
      city = await prisma.geoCity.upsert({
        where: { stateId_name: { stateId: state.id, name: body.cityName } },
        update: {},
        create: { stateId: state.id, name: body.cityName },
        include: { state: true },
      });
      countryId = country.id;
      stateId = state.id;
      cityId = city.id;
    }

    if (!city || city.stateId !== stateId || city.state.countryId !== countryId) {
      throw new AppError('Invalid location selection', 400);
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        countryId,
        stateId,
        cityId,
        locationUpdatedAt: new Date(),
        locationSetupDeferred: false,
      },
    });
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/me/location/defer', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { locationSetupDeferred: true },
    });
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me/age-category', requireAuth, async (req, res, next) => {
  try {
    const current = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (current.dateOfBirth) {
      throw new AppError(
        'Your leadership category is calculated from your date of birth and cannot be set manually.',
        409,
      );
    }

    const { ageCategory } = ageCategoryBodySchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ageGroup: ageCategory,
        isChildProfile: isChildAgeCategory(ageCategory),
      },
    });
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

const familySchema = z.object({
  familyName: z.string().trim().max(80).optional().nullable(),
  myRole: familyMemberRoleSchema.optional().nullable(),
  pendingMembers: z.array(pendingMemberSchema).max(12).optional(),
});

function defaultFamilyName(username: string) {
  return `${username}'s Family`;
}

usersRouter.patch('/me/family', requireAuth, async (req, res, next) => {
  try {
    const body = familySchema.parse(req.body);

    const current = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!current) {
      throw new AppError('User not found', 404);
    }

    if (!current.dateOfBirth && !current.ageGroup) {
      throw new AppError('Add your date of birth before family details', 400);
    }

    let familyId = current.familyId;
    const pendingMembers = body.pendingMembers ?? [];
    const needsFamily =
      Boolean(body.familyName?.length) ||
      Boolean(body.myRole) ||
      pendingMembers.length > 0;

    if (needsFamily) {
      const familyName =
        body.familyName && body.familyName.length > 0
          ? body.familyName
          : defaultFamilyName(current.username);

      if (familyId) {
        if (body.familyName && body.familyName.length > 0) {
          await prisma.family.update({
            where: { id: familyId },
            data: { name: body.familyName },
          });
        }
      } else {
        const family = await prisma.family.create({
          data: {
            name: familyName,
            planType: 'starter',
          },
        });
        familyId = family.id;
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        familyId,
        familyOnboardingComplete: true,
        familySetupDeferred: false,
      },
      include: { family: true },
    });

    if (familyId) {
      const existingSelf = await prisma.familyMember.findFirst({
        where: { familyId, userId: user.id },
      });

      if (existingSelf) {
        if (body.myRole) {
          await prisma.familyMember.update({
            where: { id: existingSelf.id },
            data: {
              role: body.myRole,
              status: 'active',
              acceptedAt: existingSelf.acceptedAt ?? new Date(),
            },
          });
        }
      } else {
        await prisma.familyMember.create({
          data: {
            familyId,
            userId: user.id,
            role: body.myRole || 'Other',
            status: 'active',
            acceptedAt: new Date(),
          },
        });
      }
    }

    if (familyId && pendingMembers.length > 0) {
      const rosterNow = await prisma.familyMember.findMany({
        where: { familyId },
        include: { user: { select: { username: true, email: true, officialAccount: true } } },
      });
      const takenUsernames = new Set(
        rosterNow
          .filter((row) => !row.user?.officialAccount)
          .map((row) => (row.user?.username || row.inviteUsername || '').toLowerCase())
          .filter(Boolean),
      );
      const takenEmails = new Set(
        rosterNow
          .map((row) => (row.user?.email || row.inviteEmail || '').toLowerCase())
          .filter(Boolean),
      );

      for (const member of pendingMembers) {
        const email = member.inviteEmail?.trim().toLowerCase() || null;
        const username = member.inviteUsername?.trim() || null;
        const dateOfBirth = member.dateOfBirth ? new Date(`${member.dateOfBirth}T00:00:00Z`) : null;
        if (!email && !username && !member.displayName) continue;
        if (username && takenUsernames.has(username.toLowerCase())) continue;
        if (email && takenEmails.has(email)) continue;

        await prisma.familyMember.create({
          data: {
            familyId,
            role: member.role,
            displayName: member.displayName || null,
            inviteEmail: email,
            inviteUsername: username,
            dateOfBirth,
            ageCategory: member.ageCategory || null,
            invitedByUserId: user.id,
            inviteToken: generateInviteToken(),
            status: 'pending',
          },
        });
        if (username) takenUsernames.add(username.toLowerCase());
        if (email) takenEmails.add(email);
      }
    }

    const roster = familyId
      ? await prisma.familyMember.findMany({
          where: { familyId },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                ageGroup: true,
                officialAccount: true,
              },
            },
            invitedBy: { select: { id: true, username: true } },
          },
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        })
      : [];

    res.json({
      user: toPublicUser(user),
      family: user.family,
      members: roster.map((m) => ({
        id: m.id,
        role: m.role,
        displayName: m.displayName,
        status: m.status,
        inviteEmail: m.inviteEmail,
        inviteUsername: m.inviteUsername,
        dateOfBirth: m.dateOfBirth,
        ageCategory: m.ageCategory,
        user: m.user
          ? {
              id: m.user.id,
              username: m.user.username,
              avatarUrl: m.user.avatarUrl,
              ageGroup: m.user.ageGroup,
            }
          : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

const familySkipSchema = z.object({
  defer: z.boolean().optional(),
});

usersRouter.post('/me/family/skip', requireAuth, async (req, res, next) => {
  try {
    const { defer } = familySkipSchema.parse(req.body ?? {});

    const current = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!current) {
      throw new AppError('User not found', 404);
    }

    if (!current.dateOfBirth && !current.ageGroup) {
      throw new AppError('Add your date of birth before continuing', 400);
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        familyOnboardingComplete: true,
        familySetupDeferred: Boolean(defer),
      },
    });

    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me/gofam-week-start', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      gofamWeekStartDay: z.number().int().min(0).max(6),
    });
    const { gofamWeekStartDay } = schema.parse(req.body);

    const current = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (current.gofamWeekStartDay != null) {
      throw new AppError('GOFAM week start day is permanent and cannot be changed', 409);
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { gofamWeekStartDay },
    });

    await tryBootstrapFlowWeekForUser(req.user!.id);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const publicUser = await withEffectiveOnboardingStatus(user);
    res.json({ user: publicUser });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me/onboarding-complete', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });

    if (user.journeyModelVersion < 2) {
      const progressCount = await prisma.userMissionProgress.count({
        where: { userId: req.user!.id },
      });
      if (progressCount === 0) {
        throw new AppError('Pick your 3 focus-hill missions before finishing onboarding', 400);
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { onboardingCompleted: true },
    });
    const publicUser = await withEffectiveOnboardingStatus(updated);
    res.json({ user: publicUser, challengeAccepted: true });
  } catch (error) {
    next(error);
  }
});
