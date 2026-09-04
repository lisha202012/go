import { PrismaClient, MissionStatus } from '@prisma/client';

const API = process.env.API_URL || 'http://localhost:4000/api/v1';
const prisma = new PrismaClient();

async function json(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${data.error || ''}`);
  return data;
}

const suffix = Date.now().toString(36);
const username = `grow_${suffix}`;

const check = await json(`/users/check-username?username=${username}`);
if (!check.available) throw new Error('username should be available');

const reg = await json('/auth/register', {
  method: 'POST',
  body: {
    username,
    email: `${username}@gofam.test`,
    password: 'password123',
  },
});
const token = reg.accessToken;

await json('/users/me/avatar', {
  method: 'PATCH',
  token,
  body: { avatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Test' },
});

await json('/users/me/family', {
  method: 'PATCH',
  token,
  body: { familyName: 'Test Family', ageGroup: 'Adult', isChildProfile: false },
});

const { hills } = await json('/hills', { token });
if (hills.length !== 7) throw new Error(`expected 7 hills, got ${hills.length}`);

// Make HOOD strongest (100) and HOPE weakest (20)
const scores = hills.map((h, i) => ({
  hillId: h.id,
  score: h.code === 'HOPE' ? 20 : h.code === 'HOOD' ? 100 : 40 + i,
}));

const gap = await json('/gap-assessment', {
  method: 'POST',
  token,
  body: { scores },
});

const focusCode = gap.assessment.focusHill.code;
const strongestCode = gap.assessment.strongestHill.code;
if (growthCode !== 'HOPE') throw new Error(`expected growth HOPE, got ${growthCode}`);
if (strongestCode !== 'HOOD') throw new Error(`expected strongest HOOD, got ${strongestCode}`);
if (!gap.user.onboardingCompleted) throw new Error('onboardingCompleted should be true');
if (!gap.unlockedMission || gap.unlockedMission.order !== 1) {
  throw new Error('expected unlocked mission order 1');
}

const progress = await prisma.userMissionProgress.findMany({
  where: { userId: reg.user.id },
  include: { mission: true },
});
const current = progress.filter((p) => p.status === MissionStatus.current);
if (current.length !== 1) throw new Error(`expected exactly 1 current mission, got ${current.length}`);
if (current[0].mission.hillId !== gap.assessment.growthHillId) {
  throw new Error('current mission not on growth hill');
}
if (current[0].mission.order !== 1) throw new Error('current mission order != 1');

console.log(
  JSON.stringify(
    {
      ok: true,
      flowIndex: gap.assessment.flowIndexResult,
      strongest: strongestCode,
      growth: growthCode,
      unlockedMission: gap.unlockedMission.title,
      welcomeBonusGranted: gap.welcomeBonusGranted,
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
