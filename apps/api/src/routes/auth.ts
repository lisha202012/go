import { randomBytes } from 'crypto';
import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import type { User } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { hashToken, verifyRefreshToken } from '../lib/jwt';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { withEffectiveOnboardingStatus } from '../lib/onboardingStatus';
import {
  createSession,
  listActiveSessions,
  revokeOtherSessions,
  revokeSessionById,
  revokeSessionByToken,
  rotateSession,
  sessionContextFromRequest,
  touchSession,
} from '../lib/sessionService';
import { claimGlowShareToken } from '../lib/glowSeedService';
import { onUserAccountCreated } from '../lib/coachBalaService';
import { claimSchoolRegistrationLink } from '../lib/schoolRegistrationLinkService';

import { adminAuthRouter } from './adminAuth';

export const authRouter = Router();

async function toAuthUser(user: User) {
  return withEffectiveOnboardingStatus(user);
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

const deviceNameSchema = z.string().trim().min(1).max(120).optional();

const registerSchema = z.object({
  username: z
    .string()
    .regex(USERNAME_REGEX, 'Username must be 3–20 characters: letters, numbers, underscore')
    .optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  deviceName: deviceNameSchema,
  glowToken: z.string().min(8).max(80).optional(),
  schoolLinkToken: z.string().min(4).max(40).optional(),
});

async function generateUniqueTempUsername() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `u_${randomBytes(6).toString('hex')}`;
    const existing = await prisma.user.findUnique({ where: { username: candidate } });
    if (!existing) return candidate;
  }
  throw new AppError('Could not allocate username', 500);
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceName: deviceNameSchema,
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const googleSchema = z.object({
  credential: z.string().min(1),
  deviceName: deviceNameSchema,
});

const schoolLinkClaimSchema = z.object({
  schoolLinkToken: z.string().min(4).max(40),
});

const googleCodeSchema = z.object({
  code: z.string().min(1),
  deviceName: deviceNameSchema,
});

function getGoogleOAuthClient() {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(
      'Google sign-in is not configured. Set GOOGLE_CLIENT_ID in apps/api/.env',
      503,
    );
  }
  return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
}

async function loginOrCreateGoogleUser(payload: {
  email?: string | null;
  picture?: string | null;
}) {
  if (!payload.email) {
    throw new AppError('Google account did not provide an email address', 400);
  }

  const email = payload.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const username = await generateUniqueTempUsername();
    const passwordHash = await hashPassword(randomBytes(32).toString('hex'));
    user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        avatarUrl: payload.picture ?? null,
      },
    });
    await onUserAccountCreated(user.id);
  } else if (!user.avatarUrl && payload.picture) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: payload.picture },
    });
  }

  return user;
}

function currentSessionHeader(req: { headers: Record<string, unknown> }) {
  const raw = req.headers['x-session-id'];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    const email = body.email.toLowerCase();
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new AppError('Email already in use', 409);
    }

    let username = body.username;
    if (username) {
      const existingUsername = await prisma.user.findUnique({ where: { username } });
      if (existingUsername) {
        throw new AppError('Username already in use', 409);
      }
    } else {
      username = await generateUniqueTempUsername();
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
      },
    });

    await onUserAccountCreated(user.id);

    const tokens = await createSession(user, sessionContextFromRequest(req, body.deviceName));
    let glowClaim = null;
    if (body.glowToken) {
      try {
        glowClaim = await claimGlowShareToken(user.id, body.glowToken);
      } catch {
        glowClaim = null;
      }
    }

    let schoolLinkClaim = null;
    if (body.schoolLinkToken) {
      try {
        schoolLinkClaim = await claimSchoolRegistrationLink(user.id, body.schoolLinkToken);
      } catch {
        schoolLinkClaim = null;
      }
    }

    res.status(201).json({ user: await toAuthUser(user), ...tokens, glowClaim, schoolLinkClaim });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/school-link/claim', requireAuth, async (req, res, next) => {
  try {
    const { schoolLinkToken } = schoolLinkClaimSchema.parse(req.body);
    const schoolLinkClaim = await claimSchoolRegistrationLink(req.user!.id, schoolLinkToken);
    res.json({ schoolLinkClaim });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/google', async (req, res, next) => {
  try {
    const { credential, deviceName } = googleSchema.parse(req.body);
    const client = getGoogleOAuthClient();
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const user = await loginOrCreateGoogleUser(payload ?? {});
    const tokens = await createSession(user, sessionContextFromRequest(req, deviceName));
    res.json({ user: await toAuthUser(user), ...tokens });
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      const message = String(error.message);
      if (message.includes('Token used too late') || message.includes('Invalid token')) {
        next(new AppError('Google sign-in expired. Please try again.', 401));
        return;
      }
    }
    next(error);
  }
});

authRouter.post('/google/code', async (req, res, next) => {
  try {
    if (!env.GOOGLE_CLIENT_SECRET) {
      throw new AppError(
        'Google code sign-in needs GOOGLE_CLIENT_SECRET in apps/api/.env',
        503,
      );
    }

    const { code, deviceName } = googleCodeSchema.parse(req.body);
    const client = getGoogleOAuthClient();
    const { tokens } = await client.getToken({ code, redirect_uri: 'postmessage' });

    if (!tokens.id_token) {
      throw new AppError('Google did not return an ID token', 400);
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const user = await loginOrCreateGoogleUser(payload ?? {});
    const authTokens = await createSession(user, sessionContextFromRequest(req, deviceName));
    res.json({ user: await toAuthUser(user), ...authTokens });
  } catch (error) {
    if (error && typeof error === 'object' && 'response' in error) {
      const gaxiosError = error as { response?: { data?: { error_description?: string } } };
      const description = gaxiosError.response?.data?.error_description;
      if (description) {
        next(new AppError(`Google sign-in failed: ${description}`, 401));
        return;
      }
    }
    next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new AppError('Invalid email or password', 401);
    }

    const tokens = await createSession(user, sessionContextFromRequest(req, body.deviceName));
    res.json({ user: await toAuthUser(user), ...tokens });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    let payload;

    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new AppError('User not found', 401);
    }

    const tokens = await rotateSession(stored, user);
    res.json(tokens);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const body = refreshSchema.safeParse(req.body);
    if (body.success) {
      await revokeSessionByToken(body.data.refreshToken, req.user!.id);
    } else {
      const sessionId = currentSessionHeader(req);
      if (sessionId) {
        await revokeSessionById(sessionId, req.user!.id);
      }
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    const currentSessionId = currentSessionHeader(req);
    const sessions = await listActiveSessions(req.user!.id, currentSessionId);
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

authRouter.delete('/sessions/:sessionId', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    await revokeSessionById(sessionId, req.user!.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.delete('/sessions', requireAuth, async (req, res, next) => {
  try {
    const keepSessionId = currentSessionHeader(req);
    if (!keepSessionId) {
      throw new AppError('Current session could not be identified', 400);
    }
    await revokeOtherSessions(req.user!.id, keepSessionId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const sessionId = currentSessionHeader(req);
    void touchSession(sessionId).catch(() => undefined);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      throw new AppError('User not found', 401);
    }
    const publicUser = await withEffectiveOnboardingStatus(user);
    res.json({ user: publicUser });
  } catch (error) {
    next(error);
  }
});

authRouter.use('/admin', adminAuthRouter);
