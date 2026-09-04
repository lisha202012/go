/**
 * Captures Step/Camp UI screenshots for merge approval.
 * Uses live API data (stepdemo@gofam.test) with Playwright route stubs so CORS/port mismatches do not block captures.
 *
 * Output: apps/api/screenshots/*.png
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PrismaClient, MissionStatus } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'screenshots');
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const EMAIL = 'stepdemo@gofam.test';
const PASSWORD = 'StepDemo123!';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `${process.env.DATABASE_URL}${process.env.DATABASE_URL?.includes('?') ? '&' : '?'}pgbouncer=true`,
    },
  },
});

async function findDemoCurrentMission(userId) {
  const row = await prisma.userMissionProgress.findFirst({
    where: { userId, status: MissionStatus.current },
    include: { mission: { include: { hill: true } } },
  });
  return row;
}

async function apiLogin() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return res.json();
}

async function apiGet(token, pathSuffix) {
  const res = await fetch(`${API}${pathSuffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${pathSuffix} failed: ${res.status}`);
  return res.json();
}

async function seedAuth(page, auth) {
  await page.goto(`${WEB}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((payload) => {
    localStorage.setItem(
      'gofam-auth',
      JSON.stringify({
        user: payload.user,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      }),
    );
  }, auth);
  await page.reload({ waitUntil: 'domcontentloaded' });
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const auth = await apiLogin();
  const token = auth.accessToken;
  const [dashboard, journeyRaw, rewards] = await Promise.all([
    apiGet(token, '/dashboard/home'),
    apiGet(token, '/journey/me'),
    apiGet(token, '/config/mission-rewards').catch(() => ({
      perMission: 5,
      growthSetBonus: 15,
      hillStepOnCycleComplete: 1,
    })),
  ]);

  // Journey page auto-redirects to block-pick when needsBlockSelection is true;
  // force main climb view so "Steps per hill" is visible for merge screenshots.
  const journey = {
    ...journeyRaw,
    summary: {
      ...journeyRaw.summary,
      needsBlockSelection: false,
      pendingBlockSelection: null,
    },
  };

  const currentMission = journeyRaw.weeks?.find((w) => w.status === 'current' && w.mission);
  const demoProgress = auth.user?.id
    ? await findDemoCurrentMission(auth.user.id).catch(() => null)
    : null;

  let campDemoWeek = currentMission ?? null;
  if (!campDemoWeek && demoProgress?.mission) {
    const m = demoProgress.mission;
    campDemoWeek = {
      status: 'current',
      startedAt: demoProgress.startedAt?.toISOString() ?? new Date().toISOString(),
      hill: {
        id: m.hill.id,
        code: m.hill.code,
        name: m.hill.name,
        virtueName: m.hill.virtueName,
        colorTheme: m.hill.colorTheme,
      },
      mission: {
        id: m.id,
        title: m.title,
        description: m.description,
        order: m.order,
        coinReward: m.coinReward,
        requiresReflection: m.requiresReflection,
        requiresEvidence: m.requiresEvidence,
      },
    };
    journey.weeks = [
      ...(journey.weeks ?? []),
      {
        weekNumber: (journey.weeks?.length ?? 0) + 1,
        hillBlock: 99,
        hillStepNumber: 3,
        taskNumber: 3,
        ...campDemoWeek,
        isFocusHill: true,
        pendingSelection: false,
      },
    ];
  }

  const completePayload =
    campDemoWeek?.mission &&
    (currentMission
      ? await fetch(`${API}/journey/me/missions/${campDemoWeek.mission.id}/complete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : null))
      : {
          campReached: {
            number: 2,
            name: 'Camp 2',
            stepThreshold: 3,
          },
          journey,
          needsBlockSelection: false,
        });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });

  const json = (body) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.route('**/api/v1/dashboard/home**', (route) => route.fulfill(json(dashboard)));
  await page.route('**/api/v1/journey/me**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill(json({ ...journey, rewards }));
      return;
    }
    route.continue();
  });
  await page.route('**/api/v1/auth/me**', (route) =>
    route.fulfill(json({ user: auth.user })),
  );

  await seedAuth(page, auth);

  await page.goto(`${WEB}/home`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=This step', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '01-home-this-step.png'), fullPage: true });

  await page.goto(`${WEB}/journey`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=/Steps per hill|Your hill climb/i', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '02-journey-steps-per-hill.png'), fullPage: true });

  if (completePayload?.campReached && campDemoWeek?.mission) {
    const missionId = campDemoWeek.mission.id;
    await page.route(`**/api/v1/journey/me/missions/${missionId}/complete**`, (route) =>
      route.fulfill(json(completePayload)),
    );
    await page.route(`**/api/v1/journey/me/missions/${missionId}/start**`, (route) =>
      route.fulfill(json({ journey })),
    );

    await seedAuth(page, auth);
    await page.goto(`${WEB}/missions?missionId=${missionId}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(1000);

    const card = page.locator('[class*="rounded-2xl"]').filter({ hasText: campDemoWeek.mission.title }).first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
    }
    const completeBtn = page.getByRole('button', { name: /complete mission/i }).first();
    await completeBtn.waitFor({ timeout: 10000 });
    await completeBtn.click();
    await page.waitForSelector('text=Nice work!', { timeout: 10000 });
    await page.getByRole('button', { name: /keep going/i }).click();
    await page.waitForSelector('text=Camp milestone', { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, '03-camp-celebration-modal.png'), fullPage: true });
  } else {
    throw new Error('Could not resolve a demo mission for Camp celebration screenshot');
  }

  await browser.close();
  await prisma.$disconnect();
  console.log(`Screenshots saved to ${OUT}`);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
