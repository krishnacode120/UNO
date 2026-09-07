import { DEFAULT_SETTINGS, DEFAULT_STATISTICS } from '@uno/shared';
import type { Profile } from '@uno/shared';

export const PROFILE_STORAGE_KEY = 'uno-arena:profile';
export const RECONNECT_STORAGE_KEY = 'uno-arena:reconnect';

export const createDefaultProfile = (): Profile => ({
  id: globalThis.crypto?.randomUUID?.() ?? `profile-${Date.now()}`,
  name: 'Player',
  avatar: 'P1',
  settings: DEFAULT_SETTINGS,
  statistics: DEFAULT_STATISTICS,
  matchHistory: []
});
