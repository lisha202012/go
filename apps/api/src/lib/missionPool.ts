import type { HillCode } from '@prisma/client';
import { HILL_DOMAINS } from './hillDomains';

export {
  MISSION_POOL_SIZE,
  MISSION_GROUP_COUNT,
  missionGroupForOrder,
} from './missionEngine';

/**
 * @deprecated Dev-stub pool removed — real content lives in data/missions-945.json.
 */
export const MISSION_POOL: Record<HillCode, never[]> = {
  HOPE: [],
  HONE: [],
  HOLD: [],
  HOOD: [],
  HOST: [],
  HORN: [],
  HOOK: [],
};

export function getHillDomainLabel(code: HillCode): string {
  return HILL_DOMAINS[code].domain;
}
