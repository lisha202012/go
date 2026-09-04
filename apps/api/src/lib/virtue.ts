import { Virtue, type HillCode } from '@prisma/client';
import { prisma } from './prisma';
import { awardVirtueTreeStar } from './treeStarService';

export const VIRTUES: Virtue[] = [
  Virtue.Kindness,
  Virtue.Responsibility,
  Virtue.Discipline,
  Virtue.Integrity,
  Virtue.HardWork,
  Virtue.Courage,
  Virtue.Patience,
];

/** Spec: each Virtue belongs to its corresponding Hill. */
export const VIRTUE_HILL_CODE: Record<Virtue, HillCode> = {
  Kindness: 'HOPE',
  Responsibility: 'HONE',
  Discipline: 'HOLD',
  Integrity: 'HOOD',
  HardWork: 'HOST',
  Courage: 'HORN',
  Patience: 'HOOK',
};

export const VIRTUE_LABELS: Record<Virtue, string> = {
  Kindness: 'Kindness',
  Responsibility: 'Responsibility',
  Discipline: 'Discipline',
  Integrity: 'Integrity',
  HardWork: 'Hard Work',
  Courage: 'Courage',
  Patience: 'Patience',
};

export function pickRandomVirtue(): Virtue {
  return VIRTUES[Math.floor(Math.random() * VIRTUES.length)];
}

export function endOfCurrentMonth(from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999);
}

export async function findHillIdForVirtue(virtue: Virtue): Promise<string | null> {
  const hill = await prisma.hill.findUnique({
    where: { code: VIRTUE_HILL_CODE[virtue] },
    select: { id: true },
  });
  return hill?.id ?? null;
}

export async function userHasCollectedVirtue(userId: string, virtue: Virtue): Promise<boolean> {
  const row = await prisma.activeVirtue.findFirst({
    where: { userId, virtue },
    select: { id: true },
  });
  return Boolean(row);
}

/** True if this hill already has a live monthly ×2 boost (does not stack). */
export async function userHasActiveHillBoost(
  userId: string,
  hillId: string,
  at = new Date(),
): Promise<boolean> {
  const row = await prisma.activeVirtue.findFirst({
    where: { userId, hillId, expiresAt: { gt: at } },
    select: { id: true },
  });
  return Boolean(row);
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Activate (or refresh) a virtue's monthly hill boost.
 * Returns false if this hill is already boosted this month (no stack).
 */
export async function activateOrRefreshVirtueBoost(
  tx: Tx,
  args: {
    userId: string;
    virtue: Virtue;
    hillId: string;
    expiresAt: Date;
    sourceSeedId: string;
  },
): Promise<boolean> {
  const { userId, virtue, hillId, expiresAt, sourceSeedId } = args;
  const alreadyBoosted = await tx.activeVirtue.findFirst({
    where: { userId, hillId, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (alreadyBoosted) return false;

  const existingVirtue = await tx.activeVirtue.findFirst({
    where: { userId, virtue },
    orderBy: { activatedAt: 'desc' },
  });
  if (existingVirtue) {
    await tx.activeVirtue.update({
      where: { id: existingVirtue.id },
      data: { expiresAt, hillId, sourceSeedId },
    });
    await awardVirtueTreeStar(tx, userId, virtue);
    return true;
  }

  await tx.activeVirtue.create({
    data: { userId, virtue, hillId, expiresAt, sourceSeedId },
  });
  await awardVirtueTreeStar(tx, userId, virtue);
  return true;
}

/**
 * Add a virtue to the user's collection without enabling the monthly ×2 hill boost.
 * Kept for future collection-only seed types; Coach Bala no longer uses this helper.
 */
export async function collectVirtueOnly(
  tx: Tx,
  args: {
    userId: string;
    virtue: Virtue;
    hillId: string;
    sourceSeedId: string;
  },
): Promise<boolean> {
  const { userId, virtue, hillId, sourceSeedId } = args;
  const existingVirtue = await tx.activeVirtue.findFirst({
    where: { userId, virtue },
    orderBy: { activatedAt: 'desc' },
  });
  if (existingVirtue) return false;

  const now = new Date();
  await tx.activeVirtue.create({
    data: { userId, virtue, hillId, expiresAt: now, sourceSeedId },
  });
  await awardVirtueTreeStar(tx, userId, virtue);
  return true;
}

/** Monthly ×2 for this hill only. Never stacks above 2. */
export async function virtueCoinMultiplierForHill(
  tx: Tx,
  userId: string,
  hillId: string,
): Promise<1 | 2> {
  const now = new Date();
  const active = await tx.activeVirtue.findFirst({
    where: { userId, hillId, expiresAt: { gt: now } },
    select: { id: true },
  });
  return active ? 2 : 1;
}

export async function countCollectedVirtues(userId: string): Promise<number> {
  const rows = await prisma.activeVirtue.findMany({
    where: { userId },
    distinct: ['virtue'],
    select: { virtue: true },
  });
  return rows.length;
}
