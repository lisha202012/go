import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  acknowledgeOrgVerifiedPrompt,
  deferBelongingSetup,
  expressOrganizationInterest,
  getBelongingOverview,
  requestOrganizationMembership,
  searchOrganizationsForUser,
} from '../lib/organizationService';

const COUNTRIES_NOW_BASE = 'https://countriesnow.space/api/v0.1';
const geoCache = new Map<string, { expiresAt: number; value: unknown }>();

function getCached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = geoCache.get(key);
  if (cached && cached.expiresAt > now) {
    return Promise.resolve(cached.value as T);
  }
  return loader().then((value) => {
    geoCache.set(key, { expiresAt: Date.now() + ttlMs, value });
    return value;
  });
}

export const geoRouter = Router();

geoRouter.get('/countries', async (_req, res, next) => {
  try {
    const payload = await getCached('countries', 60 * 60 * 1000, async () => {
      const response = await fetch(`${COUNTRIES_NOW_BASE}/countries/positions`);
      const json = await response.json();
      if (json.error) throw new AppError('Failed to load countries', 502);
      return (json.data ?? [])
        .map((country: { name: string; iso2: string }) => ({
          id: country.iso2,
          code: country.iso2,
          name: country.name,
        }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
    });
    res.json({ countries: payload });
  } catch (error) {
    next(error);
  }
});

geoRouter.get('/states', async (req, res, next) => {
  try {
    const countryName = String(req.query.countryName ?? req.query.countryId ?? '');
    if (!countryName) throw new AppError('countryName is required', 400);

    const payload = await getCached(`states:${countryName}`, 60 * 60 * 1000, async () => {
      const response = await fetch(`${COUNTRIES_NOW_BASE}/countries/states`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: countryName }),
      });
      const json = await response.json();
      if (json.error) throw new AppError('Failed to load states', 502);
      return (json.data?.states ?? [])
        .map((state: { name: string; state_code?: string }) => ({
          id: state.state_code ?? state.name,
          name: state.name,
        }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
    });

    res.json({ states: payload });
  } catch (error) {
    next(error);
  }
});

geoRouter.get('/cities', async (req, res, next) => {
  try {
    const countryName = String(req.query.countryName ?? req.query.countryId ?? '');
    const stateName = String(req.query.stateName ?? req.query.stateId ?? '');
    if (!countryName || !stateName) {
      throw new AppError('countryName and stateName are required', 400);
    }

    const payload = await getCached(`cities:${countryName}:${stateName}`, 60 * 60 * 1000, async () => {
      const response = await fetch(`${COUNTRIES_NOW_BASE}/countries/state/cities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: countryName, state: stateName }),
      });
      const json = await response.json();
      if (json.error) throw new AppError('Failed to load cities', 502);
      return (json.data ?? [])
        .slice()
        .sort((a: string, b: string) => a.localeCompare(b))
        .map((name: string) => ({ id: name, name }));
    });

    res.json({ cities: payload });
  } catch (error) {
    next(error);
  }
});

export const organizationsRouter = Router();

organizationsRouter.get('/belonging/me', requireAuth, async (req, res, next) => {
  try {
    const overview = await getBelongingOverview(req.user!.id);
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

organizationsRouter.post('/belonging/defer', requireAuth, async (req, res, next) => {
  try {
    const user = await deferBelongingSetup(req.user!.id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

organizationsRouter.post('/prompts/org-verified/ack', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ organizationId: z.string().min(1) }).parse(req.body);
    const result = await acknowledgeOrgVerifiedPrompt(req.user!.id, body.organizationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

organizationsRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    const cityId = req.query.cityId ? String(req.query.cityId) : undefined;
    const organizations = await searchOrganizationsForUser(req.user!.id, q, cityId);
    res.json({ organizations, query: q });
  } catch (error) {
    next(error);
  }
});

organizationsRouter.get('/school-options', requireAuth, async (req, res, next) => {
  try {
    const countryName = String(req.query.countryName ?? '').trim();
    const stateName = String(req.query.stateName ?? '').trim();
    const cityName = String(req.query.cityName ?? '').trim();
    const standard = String(req.query.standard ?? '').trim();
    const section = String(req.query.section ?? '').trim();
    const organizations = await prisma.organization.findMany({
      where: {
      },
      include: {
        registrationLinks: {
          where: {
            isActive: true,
            ...(standard && standard !== 'Any' ? { standard } : {}),
            ...(section ? { section } : {}),
          },
          select: { standard: true, section: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    const options = organizations.flatMap((organization) => {
      const classes = organization.registrationLinks.length
        ? organization.registrationLinks
        : [{ standard: null, section: null }];
      return classes.map((schoolClass) => ({
        id: organization.id,
        name: organization.name,
        standard: schoolClass.standard,
        section: schoolClass.section,
        label: [organization.name, schoolClass.standard, schoolClass.section].filter(Boolean).join(' · '),
          locationMatch: Boolean(
            (countryName && organization.countryName?.toLowerCase() === countryName.toLowerCase()) ||
            (stateName && organization.stateName?.toLowerCase() === stateName.toLowerCase()) ||
            (cityName && organization.cityName?.toLowerCase() === cityName.toLowerCase()),
          ),
      }));
    });
      options.sort((a, b) => Number(b.locationMatch) - Number(a.locationMatch) || a.label.localeCompare(b.label));
    const uniqueOptions = [...new Map(options.map((option) => [`${option.id}|${option.standard}|${option.section}`, option])).values()];
    res.json({ options: uniqueOptions });
  } catch (error) {
    next(error);
  }
});

const interestSchema = z.object({
  organizationId: z.string().optional(),
  organizationName: z.string().trim().min(2).max(120).optional(),
});

organizationsRouter.post('/interest', requireAuth, async (req, res, next) => {
  try {
    const body = interestSchema.parse(req.body);
    const result = await expressOrganizationInterest(req.user!.id, body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

const membershipSchema = z.object({
  organizationId: z.string().min(1),
});

organizationsRouter.post('/membership/request', requireAuth, async (req, res, next) => {
  try {
    const body = membershipSchema.parse(req.body);
    const result = await requestOrganizationMembership(req.user!.id, body.organizationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export const leadershipRouter = Router();

const leadershipQuerySchema = z.object({
  who: z.enum(['category', 'all', 'specificCategory']).optional(),
  ageGroup: z.string().optional(),
  where: z.enum(['world', 'country', 'state', 'city', 'organization', 'orgGroup']).optional(),
  countryId: z.string().optional(),
  stateId: z.string().optional(),
  cityId: z.string().optional(),
  countryName: z.string().optional(),
  stateName: z.string().optional(),
  cityName: z.string().optional(),
  organizationId: z.string().optional(),
  schoolStandard: z.string().optional(),
  schoolSection: z.string().optional(),
});

geoRouter.post('/cities', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({ stateId: z.string().min(1), name: z.string().trim().min(1).max(80) });
    const { stateId, name } = schema.parse(req.body ?? {});

    const state = await prisma.geoState.findUnique({ where: { id: stateId }, select: { id: true } });
    if (!state) throw new AppError('State not found', 404);

    const trimmed = name.trim();
    const city = await prisma.geoCity.findFirst({
      where: { stateId, name: { equals: trimmed, mode: 'insensitive' } },
    });

    const result = city ?? (await prisma.geoCity.create({ data: { stateId, name: trimmed } }));
    res.json({ city: result });
  } catch (error) {
    next(error);
  }
});

leadershipRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const query = leadershipQuerySchema.parse(req.query);
    const resolvedIds = await resolveLeadershipLocationIds(query);
    const { buildFlowLeadershipOverview } = await import('../lib/flowLeadershipService');
    const overview = await buildFlowLeadershipOverview(req.user!.id, {
      who: query.who,
      ageGroup: query.ageGroup ?? null,
      where: query.where,
      countryId: resolvedIds.countryId,
      stateId: resolvedIds.stateId,
      cityId: resolvedIds.cityId,
      organizationId: query.organizationId ?? null,
      schoolStandard: query.schoolStandard ?? null,
      schoolSection: query.schoolSection ?? null,
    });
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

leadershipRouter.get('/list', requireAuth, async (req, res, next) => {
  try {
    const query = leadershipQuerySchema.parse(req.query);
    const resolvedIds = await resolveLeadershipLocationIds(query);
    const { getFlowLeadershipLeaderboard } = await import('../lib/flowLeadershipService');
    const result = await getFlowLeadershipLeaderboard({
      who: query.who,
      ageGroup: query.ageGroup ?? null,
      where: query.where,
      countryId: resolvedIds.countryId,
      stateId: resolvedIds.stateId,
      cityId: resolvedIds.cityId,
      organizationId: query.organizationId ?? null,
      schoolStandard: query.schoolStandard ?? null,
      schoolSection: query.schoolSection ?? null,
    }, 20, req.user!.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

async function resolveLeadershipLocationIds(query: z.infer<typeof leadershipQuerySchema>) {
  let countryId = query.countryId ?? null;
  let stateId = query.stateId ?? null;
  let cityId = query.cityId ?? null;

  if (query.countryName) {
    const country = await prisma.geoCountry.findFirst({
      where: { name: { equals: query.countryName, mode: 'insensitive' } },
      select: { id: true },
    });
    countryId = country?.id ?? countryId;
  }
  if (query.stateName && countryId) {
    const state = await prisma.geoState.findFirst({
      where: { countryId, name: { equals: query.stateName, mode: 'insensitive' } },
      select: { id: true },
    });
    stateId = state?.id ?? stateId;
  }
  if (query.cityName && stateId) {
    const city = await prisma.geoCity.findFirst({
      where: { stateId, name: { equals: query.cityName, mode: 'insensitive' } },
      select: { id: true },
    });
    cityId = city?.id ?? cityId;
  }
  return { countryId, stateId, cityId };
}
