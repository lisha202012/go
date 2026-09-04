import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { HillCode } from '@prisma/client';
import type { AgeCategoryCode } from './ageCategories';

export type MissionCatalogRecord = {
  externalId: string;
  categoryCode: AgeCategoryCode;
  hillCode: HillCode;
  order: number;
  missionGroup: number;
  title: string;
  instruction: string;
  /** Spec WHY? coaching line from the Mission Engine doc. */
  why?: string;
};

type MissionCatalogFile = {
  version: string;
  source: string;
  extractedAt: string;
  missionCount: number;
  missions: MissionCatalogRecord[];
};

const catalogPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/missions-945.json',
);

let cachedCatalog: MissionCatalogFile | null = null;
const byKey = new Map<string, MissionCatalogRecord>();

function catalogKey(categoryCode: string, hillCode: string, order: number) {
  return `${categoryCode}:${hillCode}:${order}`;
}

function loadCatalogFile(): MissionCatalogFile {
  if (cachedCatalog) return cachedCatalog;

  if (!fs.existsSync(catalogPath)) {
    throw new Error(
      `Mission catalog missing at ${catalogPath}. Run: npm run missions:extract`,
    );
  }

  const raw = fs.readFileSync(catalogPath, 'utf8');
  cachedCatalog = JSON.parse(raw) as MissionCatalogFile;

  for (const mission of cachedCatalog.missions) {
    byKey.set(catalogKey(mission.categoryCode, mission.hillCode, mission.order), mission);
  }

  return cachedCatalog;
}

export function getMissionCatalogPath(): string {
  return catalogPath;
}

export function getMissionCatalogMeta() {
  const catalog = loadCatalogFile();
  return {
    version: catalog.version,
    source: catalog.source,
    extractedAt: catalog.extractedAt,
    missionCount: catalog.missionCount,
  };
}

export function getAllMissionCatalogRecords(): MissionCatalogRecord[] {
  return [...loadCatalogFile().missions];
}

export function getMissionCatalogRecord(
  categoryCode: AgeCategoryCode,
  hillCode: HillCode,
  order: number,
): MissionCatalogRecord | undefined {
  loadCatalogFile();
  return byKey.get(catalogKey(categoryCode, hillCode, order));
}

export type MissionCatalogFilter = {
  categoryCodes?: AgeCategoryCode[];
  hillCodes?: HillCode[];
};

export function listMissionCatalogRecords(filter: MissionCatalogFilter = {}): MissionCatalogRecord[] {
  const { categoryCodes, hillCodes } = filter;
  return getAllMissionCatalogRecords().filter((mission) => {
    if (categoryCodes?.length && !categoryCodes.includes(mission.categoryCode)) return false;
    if (hillCodes?.length && !hillCodes.includes(mission.hillCode)) return false;
    return true;
  });
}
