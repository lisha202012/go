import type { HillCode } from '@prisma/client';

/** Life area (what users grow) ↔ Hill code (GOFAM hill name). */
export const HILL_DOMAINS: Record<
  HillCode,
  { domain: string; hill: string; description: string; colorTheme: string }
> = {
  HOPE: {
    domain: 'Framily',
    hill: 'Hope',
    description: 'Relationships, connection, and growing together with the people you care about.',
    colorTheme: '#F4A261',
  },
  HONE: {
    domain: 'Health',
    hill: 'Hone',
    description: 'Body, energy, nutrition, sleep, and physical wellbeing.',
    colorTheme: '#2A9D8F',
  },
  HOLD: {
    domain: 'Money',
    hill: 'Hold',
    description: 'Saving, spending wisely, and managing money with care.',
    colorTheme: '#457B9D',
  },
  HOOD: {
    domain: 'Self-Care',
    hill: 'Hood',
    description: 'Rest, boundaries, and caring for yourself so you can show up well.',
    colorTheme: '#E76F51',
  },
  HOST: {
    domain: 'Home-Care',
    hill: 'Host',
    description: 'Spaces, routines, and keeping the home running with care.',
    colorTheme: '#E9C46A',
  },
  HORN: {
    domain: 'Goals',
    hill: 'Horn',
    description: 'Direction, ambition, and moving toward what matters most.',
    colorTheme: '#264653',
  },
  HOOK: {
    domain: 'Time',
    hill: 'Hook',
    description: 'Schedules, priorities, and making time for what you value.',
    colorTheme: '#6D597A',
  },
};

export const HILL_CODE_ORDER: HillCode[] = [
  'HOPE',
  'HONE',
  'HOLD',
  'HOOD',
  'HOST',
  'HORN',
  'HOOK',
];
