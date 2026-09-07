import type { GameSettings, PlayColor, Statistics } from './types.js';

export const PLAY_COLORS = ['red', 'yellow', 'green', 'blue'] as const satisfies readonly PlayColor[];

export const DEFAULT_SETTINGS: GameSettings = {
  stackDrawTwo: false,
  stackDrawFour: false,
  jumpIn: false,
  sevenZero: false,
  forcePlay: false,
  turnTimerSeconds: 45,
  aiDifficulty: 'medium',
  theme: 'classic',
  musicVolume: 0.32,
  soundVolume: 0.7,
  reducedMotion: false,
  highContrast: false
};

export const DEFAULT_STATISTICS: Statistics = {
  wins: 0,
  losses: 0,
  gamesPlayed: 0,
  winRate: 0,
  unoCalls: 0,
  cardsPlayed: 0,
  favoriteColor: 'red',
  colorCounts: {
    red: 0,
    yellow: 0,
    green: 0,
    blue: 0
  }
};

export const CARD_POINTS = {
  skip: 20,
  reverse: 20,
  drawTwo: 20,
  wild: 50,
  wildDrawFour: 50
} as const;
