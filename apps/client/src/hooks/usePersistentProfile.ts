import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, DEFAULT_STATISTICS, updateStatisticsFromFinishedGame } from '@uno/shared';
import type { GameSettings, GameState, Profile } from '@uno/shared';
import { createDefaultProfile, PROFILE_STORAGE_KEY } from '../lib/defaults.js';

const readProfile = (): Profile => {
  const fallback = createDefaultProfile();
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) ?? 'null');
    if (!saved || typeof saved.id !== 'string') return fallback;
    return {
      ...fallback, ...saved,
      settings: { ...DEFAULT_SETTINGS, ...saved.settings },
      statistics: { ...DEFAULT_STATISTICS, ...saved.statistics, colorCounts: { ...DEFAULT_STATISTICS.colorCounts, ...saved.statistics?.colorCounts } },
      matchHistory: Array.isArray(saved.matchHistory) ? saved.matchHistory : []
    };
  } catch { return fallback; }
};
export const usePersistentProfile = () => {
  const [profile, setProfile] = useState<Profile>(readProfile);
  const [saveError, setSaveError] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'local'>('local');
  useEffect(() => {
    try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile)); setSaveError(false); }
    catch { setSaveError(true); }
  }, [profile]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        let token = localStorage.getItem('uno-arena:device-secret');
        if (!token) {
          token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
          localStorage.setItem('uno-arena:device-secret', token);
        }
        const response = await fetch((import.meta.env.VITE_SERVER_URL || '') + '/api/profile', {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(profile), signal: controller.signal
        });
        setSyncStatus(response.ok ? 'saved' : 'local');
      } catch { if (!controller.signal.aborted) setSyncStatus('local'); }
    }, 1500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [profile]);
  const recordGame = useCallback((game: GameState, viewerId: string) => {
    if (game.status !== 'finished') return;
    setProfile((current) => {
      if (current.matchHistory.some((entry) => entry.id === game.id)) return current;
      const result = updateStatisticsFromFinishedGame(current.statistics, game, viewerId);
      return { ...current, statistics: result.statistics, matchHistory: result.historyEntry ? [result.historyEntry, ...current.matchHistory].slice(0, 100) : current.matchHistory };
    });
  }, []);
  return {
    profile, saveError, syncStatus, recordGame,
    updateSettings: (settings: GameSettings) => setProfile((current) => ({ ...current, settings })),
    renameProfile: (name: string) => setProfile((current) => ({ ...current, name: name.slice(0, 24) })),
    setProfile
  };
};
