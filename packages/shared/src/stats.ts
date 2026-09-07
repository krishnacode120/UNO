import { DEFAULT_STATISTICS } from './constants.js';
import type { GameState, MatchHistoryEntry, PlayColor, Statistics } from './types.js';

export const mergeStatistics = (base: Statistics, patch: Partial<Statistics>): Statistics => ({
  ...base,
  ...patch,
  colorCounts: {
    ...base.colorCounts,
    ...patch.colorCounts
  }
});

export const getFavoriteColor = (colorCounts: Record<PlayColor, number>): PlayColor =>
  (Object.entries(colorCounts) as Array<[PlayColor, number]>).reduce<PlayColor>(
    (favorite, [color, count]) => (count > colorCounts[favorite] ? color : favorite),
    'red'
  );

export const updateStatisticsFromFinishedGame = (
  current: Statistics = DEFAULT_STATISTICS,
  game: GameState,
  viewerId: string
): { statistics: Statistics; historyEntry?: MatchHistoryEntry } => {
  if (game.status !== 'finished' || !game.winnerId) {
    return { statistics: current };
  }

  const didWin = game.winnerId === viewerId;
  const colorCounts = { ...current.colorCounts };
  let cardsPlayed = current.cardsPlayed;
  let unoCalls = current.unoCalls;

  for (const event of game.actionLog) {
    if (event.playerId !== viewerId) {
      continue;
    }

    if (event.type === 'play' && event.card) {
      if (event.card.color !== 'wild') colorCounts[event.card.color]++;
      cardsPlayed++;
    }

    if (event.type === 'uno') {
      unoCalls++;
    }
  }

  const gamesPlayed = current.gamesPlayed + 1;
  const wins = current.wins + (didWin ? 1 : 0);
  const losses = current.losses + (didWin ? 0 : 1);
  const winner = game.players.find((player) => player.id === game.winnerId);
  const viewer = game.players.find((player) => player.id === viewerId);

  const statistics: Statistics = {
    wins,
    losses,
    gamesPlayed,
    winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
    unoCalls,
    cardsPlayed,
    favoriteColor: getFavoriteColor(colorCounts),
    colorCounts
  };

  const historyEntry: MatchHistoryEntry = {
    id: game.id,
    finishedAt: game.updatedAt,
    winnerName: winner?.name ?? 'Unknown',
    didWin,
    players: game.players.map((player) => player.name),
    turns: game.actionLog.filter((event) => event.type === 'play').length,
    score: viewer?.score ?? 0
  };

  return { statistics, historyEntry };
};
