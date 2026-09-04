import type { Mission } from '@prisma/client';
import { prisma } from './prisma';

export type SurfacingSource = 'recommendation' | 'swap_picker';

/** Latest surfacedAt per mission for a user (null = never surfaced). */
export async function getLatestSurfacingMap(
  userId: string,
  missionIds: string[],
): Promise<Map<string, Date | null>> {
  const map = new Map<string, Date | null>(missionIds.map((id) => [id, null]));
  if (missionIds.length === 0) return map;

  const rows = await prisma.missionSurfacing.findMany({
    where: { userId, missionId: { in: missionIds } },
    orderBy: { surfacedAt: 'desc' },
    select: { missionId: true, surfacedAt: true },
  });

  for (const row of rows) {
    if (!map.has(row.missionId)) continue;
    if (map.get(row.missionId) === null) {
      map.set(row.missionId, row.surfacedAt);
    }
  }

  return map;
}

/**
 * Section 4 — never-offered-before preferred, then least-recently-surfaced first.
 */
export function rankMissionsByFreshness(
  missions: Mission[],
  surfacingMap: Map<string, Date | null>,
): Mission[] {
  return [...missions].sort((a, b) => {
    const aAt = surfacingMap.get(a.id);
    const bAt = surfacingMap.get(b.id);
    const aNever = aAt == null;
    const bNever = bAt == null;
    if (aNever !== bNever) return aNever ? -1 : 1;
    if (aNever && bNever) return a.order - b.order;
    return aAt!.getTime() - bAt!.getTime();
  });
}

export async function recordMissionSurfacing(
  userId: string,
  missionIds: string[],
  source: SurfacingSource,
) {
  if (missionIds.length === 0) return;

  await prisma.missionSurfacing.createMany({
    data: missionIds.map((missionId) => ({
      userId,
      missionId,
      source,
    })),
  });
}

export async function nextSwapCount(userId: string, cycleKey: string): Promise<number> {
  const last = await prisma.missionSwap.findFirst({
    where: { userId, cycleKey },
    orderBy: { swapCount: 'desc' },
    select: { swapCount: true },
  });
  return (last?.swapCount ?? 0) + 1;
}
