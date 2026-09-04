/** Life area (what users grow) ↔ Hill code (GOFAM hill name). */
export const HILL_DOMAINS = {
  HOPE: {
    domain: 'Framily',
    hill: 'Hope',
    virtue: 'Kindness',
    description: 'Relationships, connection, and growing together with the people you care about.',
  },
  HONE: {
    domain: 'Health',
    hill: 'Hone',
    virtue: 'Responsibility',
    description: 'Body, energy, nutrition, sleep, and physical wellbeing.',
  },
  HOLD: {
    domain: 'Money',
    hill: 'Hold',
    virtue: 'Discipline',
    description: 'Saving, spending wisely, and managing money with care.',
  },
  HOOD: {
    domain: 'Self-Care',
    hill: 'Hood',
    virtue: 'Integrity',
    description: 'Rest, boundaries, and caring for yourself so you can show up well.',
  },
  HOST: {
    domain: 'Home-Care',
    hill: 'Host',
    virtue: 'Hard Work',
    description: 'Spaces, routines, and keeping the home running with care.',
  },
  HORN: {
    domain: 'Goals',
    hill: 'Horn',
    virtue: 'Courage',
    description: 'Direction, ambition, and moving toward what matters most.',
  },
  HOOK: {
    domain: 'Time',
    hill: 'Hook',
    virtue: 'Patience',
    description: 'Schedules, priorities, and making time for what you value.',
  },
};

/** Code + domain, e.g. "HOLD – Money". */
export function formatHillCodeDomain(hill) {
  if (!hill?.code) return formatHillTitle(hill);
  const domain = HILL_DOMAINS[hill.code]?.domain ?? formatHillTitle(hill);
  return `${hill.code} – ${domain}`;
}

export function hillVirtueLabel(hill) {
  if (!hill) return '';
  return hill.virtueName ?? HILL_DOMAINS[hill.code]?.virtue ?? '';
}

export function hillDomainLabel(code) {
  return HILL_DOMAINS[code]?.domain ?? code;
}

export function hillCodeLabel(code) {
  return HILL_DOMAINS[code]?.hill ?? code;
}

export function formatHillTitle(hill) {
  if (!hill) return 'Hill';
  const mapped = HILL_DOMAINS[hill.code];
  if (mapped) return mapped.domain;
  return hill.name?.replace('Hill of ', '') ?? hill.name ?? 'Hill';
}

export function formatHillSubtitle(hill) {
  if (!hill) return '';
  const mapped = HILL_DOMAINS[hill.code];
  if (mapped) return `${mapped.hill} hill`;
  return hill.virtueName ?? '';
}
