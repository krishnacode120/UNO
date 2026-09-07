import { DEFAULT_SETTINGS, DEFAULT_STATISTICS } from '@uno/shared';
import type { MatchHistoryEntry, Profile, Statistics, GameSettings } from '@uno/shared';
import { ProfileModel } from './models.js';

const memoryProfiles = new Map<string, Profile>();

const createDefaultProfile = (profileId: string): Profile => ({
  id: profileId,
  name: 'Player',
  avatar: 'P1',
  settings: DEFAULT_SETTINGS,
  statistics: DEFAULT_STATISTICS,
  matchHistory: []
});

const normalizeProfile = (record: unknown, fallbackId: string): Profile => {
  const profileRecord = record as {
    profileId?: string;
    id?: string;
    name?: string;
    avatar?: string;
    settings?: GameSettings;
    statistics?: Statistics;
    matchHistory?: MatchHistoryEntry[];
  };

  return {
    id: profileRecord.profileId ?? profileRecord.id ?? fallbackId,
    name: profileRecord.name ?? 'Player',
    avatar: profileRecord.avatar ?? 'P1',
    settings: { ...DEFAULT_SETTINGS, ...profileRecord.settings },
    statistics: { ...DEFAULT_STATISTICS, ...profileRecord.statistics },
    matchHistory: profileRecord.matchHistory ?? []
  };
};

export const createProfileRepository = (useMongo: boolean) => {
  const getProfile = async (profileId: string): Promise<Profile> => {
    if (!useMongo) {
      const existing = memoryProfiles.get(profileId) ?? createDefaultProfile(profileId);
      memoryProfiles.set(profileId, existing);
      return existing;
    }

    const record = await ProfileModel.findOne({ profileId }).lean();
    if (record) {
      return normalizeProfile(record, profileId);
    }

    const profile = createDefaultProfile(profileId);
    await ProfileModel.create({ ...profile, profileId: profile.id });
    return profile;
  };

  const saveProfile = async (profile: Profile): Promise<Profile> => {
    if (!useMongo) {
      memoryProfiles.set(profile.id, profile);
      return profile;
    }

    await ProfileModel.findOneAndUpdate(
      { profileId: profile.id },
      { ...profile, profileId: profile.id },
      { upsert: true, new: true }
    );
    return profile;
  };

  const updateSettings = async (profileId: string, settings: GameSettings): Promise<Profile> => {
    const profile = await getProfile(profileId);
    return saveProfile({ ...profile, settings });
  };

  const updateStatistics = async (profileId: string, statistics: Statistics): Promise<Profile> => {
    const profile = await getProfile(profileId);
    return saveProfile({ ...profile, statistics });
  };

  const addMatchHistory = async (profileId: string, entry: MatchHistoryEntry): Promise<Profile> => {
    const profile = await getProfile(profileId);
    return saveProfile({
      ...profile,
      matchHistory: [entry, ...profile.matchHistory].slice(0, 30)
    });
  };

  return {
    getProfile,
    saveProfile,
    updateSettings,
    updateStatistics,
    addMatchHistory
  };
};

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
