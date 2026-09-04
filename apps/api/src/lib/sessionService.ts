import type { Request } from 'express';
import type { RefreshToken, User } from '@prisma/client';
import { prisma } from './prisma';
import {
  createRefreshJti,
  durationToMs,
  hashToken,
  signAccessToken,
  signRefreshToken,
} from './jwt';
import { env } from '../config/env';

export type SessionContext = {
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  locationLabel?: string;
};

export type CreateSessionOptions = {
  /** Set true only after admin MFA verify (Section 87). */
  adminConsoleSession?: boolean;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
};

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]!.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function resolveLocationLabel(ip: string): string {
  if (!ip || ip === 'unknown') return 'Unknown location';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return 'This device';
  }
  if (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith('::ffff:192.168.') ||
    ip.startsWith('::ffff:10.')
  ) {
    return 'Local network';
  }
  const country = process.env.DEFAULT_SESSION_LOCATION;
  return country ?? 'Remote sign-in';
}

export function parseDeviceName(userAgent: string | undefined, override?: string): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed.slice(0, 120);

  const ua = userAgent ?? '';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android device';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh|Mac OS/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux device';
  if (/CrOS/.test(ua)) return 'Chromebook';
  return 'Web browser';
}

export function sessionContextFromRequest(req: Request, deviceName?: string): SessionContext {
  const userAgent = req.headers['user-agent'];
  const ipAddress = getClientIp(req);
  return {
    deviceName: parseDeviceName(userAgent, deviceName),
    userAgent: userAgent?.slice(0, 512),
    ipAddress,
    locationLabel: resolveLocationLabel(ipAddress),
  };
}

export async function createSession(
  user: Pick<User, 'id' | 'role' | 'username'>,
  ctx: SessionContext,
  options: CreateSessionOptions = {},
): Promise<AuthTokens> {
  const jti = createRefreshJti();
  const refreshToken = signRefreshToken({ sub: user.id, jti });
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES));
  const now = new Date();

  const session = await prisma.refreshToken.create({
    data: {
      jti,
      tokenHash,
      userId: user.id,
      expiresAt,
      lastActiveAt: now,
      deviceName: ctx.deviceName ?? 'Web browser',
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      locationLabel: ctx.locationLabel ?? 'Unknown location',
      adminConsoleSession: options.adminConsoleSession ?? false,
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    username: user.username,
  });

  return { accessToken, refreshToken, sessionId: session.id };
}

export async function rotateSession(
  stored: RefreshToken,
  user: Pick<User, 'id' | 'role' | 'username'>,
): Promise<AuthTokens> {
  const jti = createRefreshJti();
  const refreshToken = signRefreshToken({ sub: user.id, jti });
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES));
  const now = new Date();

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: {
      jti,
      tokenHash,
      expiresAt,
      lastActiveAt: now,
      revokedAt: null,
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    username: user.username,
  });

  return { accessToken, refreshToken, sessionId: stored.id };
}

export async function touchSession(sessionId: string | null | undefined) {
  if (!sessionId) return;
  const now = new Date();
  try {
    await prisma.refreshToken.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { lastActiveAt: now },
    });
  } catch (error) {
    console.warn('[session] touchSession skipped:', error instanceof Error ? error.message : error);
  }
}

export async function revokeSessionByToken(refreshToken: string, userId: string) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeSessionById(sessionId: string, userId: string) {
  await prisma.refreshToken.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeOtherSessions(userId: string, keepSessionId: string) {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      id: { not: keepSessionId },
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

export function toPublicSession(session: RefreshToken, currentSessionId?: string) {
  return {
    id: session.id,
    deviceName: session.deviceName ?? 'Web browser',
    locationLabel: session.locationLabel ?? 'Unknown location',
    lastActiveAt: session.lastActiveAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    isCurrent: currentSessionId ? session.id === currentSessionId : false,
  };
}

export async function listActiveSessions(userId: string, currentSessionId?: string) {
  const now = new Date();
  const sessions = await prisma.refreshToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { lastActiveAt: 'desc' },
  });
  return sessions.map((s) => toPublicSession(s, currentSessionId));
}

export function resolveCurrentSessionId(
  req: Request,
  refreshTokenBody?: string,
): string | undefined {
  const header = req.headers['x-session-id'];
  if (typeof header === 'string' && header.length > 0) return header;
  return undefined;
}
