import { api } from '../../lib/api';

export const FALLBACK_AVATAR_OPTIONS = [
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Ava',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Blake',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Casey',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Drew',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Eden',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Finley',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Gray',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Harper',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Indigo',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Jules',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Kai',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Lane',
];

export const AVATAR_OPTIONS = [...FALLBACK_AVATAR_OPTIONS];

export async function refreshAvatarOptions() {
  try {
    const data = await api.getAvatarOptions();
    const urls = (data.items ?? []).map((item) => item.imageUrl).filter(Boolean);
    if (urls.length > 0) {
      AVATAR_OPTIONS.splice(0, AVATAR_OPTIONS.length, ...urls);
    }
  } catch {
    AVATAR_OPTIONS.splice(0, AVATAR_OPTIONS.length, ...FALLBACK_AVATAR_OPTIONS);
  }
  return AVATAR_OPTIONS;
}
