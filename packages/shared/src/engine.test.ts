import { describe, expect, it } from 'vitest';
import { getBotTurnActions } from './ai.js';
import { createStandardDeck } from './deck.js';
import { applyGameAction, createGame, getPlayableCards } from './engine.js';
import type { Card, GameState, PlayerConfig } from './types.js';

const players: PlayerConfig[] = [
  { id: 'p1', name: 'Player 1', kind: 'human' },
  { id: 'p2', name: 'Player 2', kind: 'human' },
  { id: 'p3', name: 'Player 3', kind: 'bot', aiDifficulty: 'hard' }
];

const createControlledGame = (): GameState => {
  const state = createGame({ id: 'test-game', players, seed: 'rules-test' });
  state.currentPlayerIndex = 0;
  state.currentColor = 'red';
  state.discardPile = [{ id: 'discard-red-5', color: 'red', type: 'number', value: 5 }];
  state.players[0].hand = [
    { id: 'red-9', color: 'red', type: 'number', value: 9 },
    { id: 'blue-5', color: 'blue', type: 'number', value: 5 },
    { id: 'green-skip', color: 'green', type: 'skip' },
    { id: 'wild', color: 'wild', type: 'wild' }
  ];
  state.players[1].hand = [{ id: 'yellow-2', color: 'yellow', type: 'number', value: 2 }];
  return state;
};

describe('UNO deck', () => {
  it('creates a standard 108-card deck', () => {
    const deck = createStandardDeck();
    expect(deck).toHaveLength(108);
    expect(deck.filter((card) => card.type === 'wild')).toHaveLength(4);
    expect(deck.filter((card) => card.type === 'wildDrawFour')).toHaveLength(4);
  });
});

describe('UNO game engine', () => {
  it('deals seven cards to every player', () => {
    const state = createGame({ id: 'deal-test', players, seed: 'deal-test' });
    expect(state.players.every((player) => player.hand.length === 7)).toBe(true);
    expect(state.discardPile).toHaveLength(1);
  });

  it('allows matching by color, value, and wild card', () => {
    const state = createControlledGame();
    const playableIds = getPlayableCards(state, 'p1').map((card) => card.id);

    expect(playableIds).toContain('red-9');
    expect(playableIds).toContain('blue-5');
    expect(playableIds).toContain('wild');
    expect(playableIds).not.toContain('green-skip');
  });

  it('applies draw-two penalties and advances after the draw', () => {
    const state = createControlledGame();
    state.players[0].hand = [
      { id: 'red-draw-two', color: 'red', type: 'drawTwo' },
      { id: 'green-4', color: 'green', type: 'number', value: 4 }
    ];

    const playResult = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: 'red-draw-two'
    });

    expect(playResult.ok).toBe(true);
    expect(playResult.state.pendingDraw).toBe(2);
    expect(playResult.state.players[playResult.state.currentPlayerIndex].id).toBe('p2');

    const handBeforePenalty = playResult.state.players[1].hand.length;
    const drawResult = applyGameAction(playResult.state, { type: 'DRAW_CARD', playerId: 'p2' });

    expect(drawResult.ok).toBe(true);
    expect(drawResult.state.pendingDraw).toBe(0);
    expect(drawResult.state.players[1].hand.length).toBe(handBeforePenalty + 2);
    expect(drawResult.state.players[drawResult.state.currentPlayerIndex].id).toBe('p3');
  });

  it('requires a color for wild cards', () => {
    const state = createControlledGame();
    const result = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'wild' });
    expect(result.ok).toBe(false);
  });

  it('finishes when a player empties their hand', () => {
    const winningCard: Card = { id: 'red-9', color: 'red', type: 'number', value: 9 };
    const state = createControlledGame();
    state.players[0].hand = [winningCard];

    const result = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: winningCard.id });

    expect(result.ok).toBe(true);
    expect(result.state.status).toBe('finished');
    expect(result.state.winnerId).toBe('p1');
  });
});

describe('UNO bots', () => {
  it('returns legal bot actions', () => {
    const state = createControlledGame();
    state.currentPlayerIndex = 2;
    state.players[2].hand = [
      { id: 'red-skip', color: 'red', type: 'skip' },
      { id: 'blue-7', color: 'blue', type: 'number', value: 7 }
    ];

    const actions = getBotTurnActions(state, 'p3', 'hard', () => 0.5);
    expect(actions.some((action) => action.type === 'PLAY_CARD')).toBe(true);
  });
});
