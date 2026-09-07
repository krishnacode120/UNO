import { useCallback, useEffect, useRef, useState } from 'react';
import { applyGameAction, createGame, getBotTurnActions, getCurrentPlayer } from '@uno/shared';
import type { GameAction, GameSettings, GameState } from '@uno/shared';

const SAVE_KEY = 'uno-arena:solo:v2';
export const useSinglePlayerGame = (settings: GameSettings, profile: { id: string; name: string; avatar: string }, enabled = true) => {
  const [game, setGame] = useState<GameState | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as GameState | null;
      return saved?.status === 'playing' && saved.players[0].id === profile.id ? saved : null;
    } catch { return null; }
  });
  const gameRef = useRef(game);
  const [error, setError] = useState<string | null>(null);
  const commit = useCallback((next: GameState | null) => {
    gameRef.current = next;
    setGame(next);
    try {
      if (next?.status === 'playing') localStorage.setItem(SAVE_KEY, JSON.stringify(next));
      else localStorage.removeItem(SAVE_KEY);
    } catch { /* A full local store must not interrupt an active match. */ }
  }, []);
  const dispatch = useCallback((action: GameAction) => {
    if (!gameRef.current) return;
    const result = applyGameAction(gameRef.current, action);
    if (result.ok) { setError(null); commit(result.state); }
    else setError(result.error ?? 'Invalid move.');
  }, [commit]);
  const start = useCallback(() => {
    setError(null);
    commit(createGame({
      id: 'solo-' + Date.now(), settings,
      players: [
        { id: profile.id, name: profile.name || 'Player', avatar: profile.avatar, kind: 'human' },
        ...['Nova', 'Atlas', 'Cleo', 'Rio'].map((name, i) => ({ id: 'bot-' + i, name, avatar: 'B' + i, kind: 'bot' as const, aiDifficulty: settings.aiDifficulty }))
      ]
    }));
  }, [commit, profile.id, profile.name, profile.avatar, settings]);

  useEffect(() => {
    if (!enabled || !game || game.status !== 'playing') return;
    const player = getCurrentPlayer(game);
    const isBot = player.kind === 'bot';
    if (!isBot && game.settings.turnTimerSeconds === 0) return;
    const wait = isBot ? 950 : Math.max(100, Date.parse(game.turnStartedAt) + game.settings.turnTimerSeconds * 1000 - Date.now());
    const timer = window.setTimeout(() => {
      const current = gameRef.current;
      if (!current || current.status !== 'playing') return;
      const active = getCurrentPlayer(current);
      if (active.kind === 'bot') {
        if (current.unoVulnerablePlayerId && current.unoVulnerablePlayerId !== active.id) {
          dispatch({ type: 'CATCH_UNO', playerId: active.id, targetPlayerId: current.unoVulnerablePlayerId });
        }
        for (const action of getBotTurnActions(gameRef.current!, active.id)) dispatch(action);
      } else {
        dispatch({ type: current.turnDrawnCardId ? 'PASS_TURN' : 'DRAW_CARD', playerId: active.id });
        const next = gameRef.current!;
        if (next.status === 'playing' && getCurrentPlayer(next).id === active.id && next.turnDrawnCardId) dispatch({ type: 'PASS_TURN', playerId: active.id });
      }
    }, wait);
    return () => window.clearTimeout(timer);
  }, [game, dispatch, enabled]);
  return { game, error, start, dispatch, leave: () => commit(null), resume: () => { if (gameRef.current) commit({ ...gameRef.current, turnStartedAt: new Date().toISOString() }); } };
};
