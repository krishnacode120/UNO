import { describe, expect, it } from 'vitest';
import { applyGameAction, createGame, getCurrentPlayer, getPlayableCards, redactGameForPlayer } from './engine.js';
import { getBotTurnActions } from './ai.js';
import { createSeededRandom } from './deck.js';
import { updateStatisticsFromFinishedGame } from './stats.js';
import { DEFAULT_STATISTICS } from './constants.js';
import type { Card, GameAction, GameSettings } from './types.js';
const number = (id: string, color: Card['color'] = 'red', value = 5): Card => ({ id, color, value, type: 'number' });
const setup = (settings: Partial<GameSettings> = {}) => {
  const game = createGame({ id: 'test', players: ['a', 'b', 'c'].map((id) => ({ id, name: id, kind: 'human' })), seed: 'regression', settings });
  game.discardPile = [number('top')]; game.currentColor = 'red';
  game.players[0].hand = [number('r'), number('b', 'blue', 8)];
  return game;
};
describe('rules regressions', () => {
  it('allows only the newly drawn card and keeps failed actions immutable', () => {
    const game = setup(); game.deck.unshift(number('drawn'));
    const drawn = applyGameAction(game, { type: 'DRAW_CARD', playerId: 'a' }).state;
    expect(getPlayableCards(drawn, 'a').map((card) => card.id)).toEqual(['drawn']);
    const invalid = applyGameAction(drawn, { type: 'PLAY_CARD', playerId: 'a', cardId: 'r' });
    expect(invalid.ok).toBe(false); expect(invalid.state).toBe(drawn); expect(game.players[0].hand).toHaveLength(2);
  });
  it('rejects +4 when a matching color is present', () => {
    const game = setup(); game.players[0].hand.push({ id: 'wild', color: 'wild', type: 'wildDrawFour' });
    expect(applyGameAction(game, { type: 'PLAY_CARD', playerId: 'a', cardId: 'wild', chosenColor: 'blue' }).ok).toBe(false);
  });
  it('rejects invalid colors and self swaps', () => {
    const game = setup({ sevenZero: true }); game.players[0].hand = [number('seven', 'red', 7), { id: 'w', color: 'wild', type: 'wild' }];
    expect(applyGameAction(game, { type: 'PLAY_CARD', playerId: 'a', cardId: 'seven', targetPlayerId: 'a' }).ok).toBe(false);
    expect(applyGameAction(game, { type: 'PLAY_CARD', playerId: 'a', cardId: 'w', chosenColor: 'pink' } as unknown as GameAction).ok).toBe(false);
  });
  it('applies final draw penalties before calculating the winner score', () => {
    const game = setup(); game.players[0].hand = [{ id: 'd', color: 'red', type: 'drawTwo' }];
    const before = game.players[1].hand.length;
    const result = applyGameAction(game, { type: 'PLAY_CARD', playerId: 'a', cardId: 'd' });
    expect(result.state.status).toBe('finished'); expect(result.state.pendingDraw).toBe(0);
    expect(result.state.players[1].hand).toHaveLength(before + 2); expect(result.state.players[0].score).toBeGreaterThan(0);
  });
  it('allows catching missed UNO only before the next play or draw', () => {
    const game = applyGameAction(setup(), { type: 'PLAY_CARD', playerId: 'a', cardId: 'r' }).state;
    expect(game.unoVulnerablePlayerId).toBe('a');
    const caught = applyGameAction(game, { type: 'CATCH_UNO', playerId: 'b', targetPlayerId: 'a' });
    expect(caught.state.players[0].hand).toHaveLength(3);
    expect(applyGameAction(caught.state, { type: 'CATCH_UNO', playerId: 'b', targetPlayerId: 'a' }).ok).toBe(false);
    const late = applyGameAction(game, { type: 'DRAW_CARD', playerId: 'b' }).state;
    expect(applyGameAction(late, { type: 'CATCH_UNO', playerId: 'c', targetPlayerId: 'a' }).ok).toBe(false);
  });
  it('does not count repeated UNO calls', () => {
    const called = applyGameAction(setup(), { type: 'CALL_UNO', playerId: 'a' });
    expect(called.ok).toBe(true);
    expect(applyGameAction(called.state, { type: 'CALL_UNO', playerId: 'a' }).ok).toBe(false);
    const played = applyGameAction(called.state, { type: 'PLAY_CARD', playerId: 'a', cardId: 'r' });
    expect(played.state.unoVulnerablePlayerId).toBeUndefined();
  });
  it('makes reverse a skip with two players', () => {
    const game = setup(); game.players.pop(); game.players[0].hand[0] = { id: 'rev', color: 'red', type: 'reverse' };
    const result = applyGameAction(game, { type: 'PLAY_CARD', playerId: 'a', cardId: 'rev' });
    expect(getCurrentPlayer(result.state).id).toBe('a'); expect(result.state.direction).toBe(-1);
  });
  it('lets a last seven win without swapping away the empty hand', () => {
    const game = setup({ sevenZero: true }); game.players[0].hand = [number('seven', 'red', 7)];
    expect(applyGameAction(game, { type: 'PLAY_CARD', playerId: 'a', cardId: 'seven' }).state.winnerId).toBe('a');
  });
  it('force-plays a drawn seven with a valid swap target', () => {
    const game = setup({ forcePlay: true, sevenZero: true }); game.deck.unshift(number('seven', 'red', 7));
    const result = applyGameAction(game, { type: 'DRAW_CARD', playerId: 'a' });
    expect(result.ok).toBe(true); expect(result.events.some((event) => event.type === 'sevenZero')).toBe(true);
  });
  it('supports same-type stacking and rejects cross-type stacking', () => {
    const game = setup({ stackDrawTwo: true }); game.pendingDraw = 2; game.pendingDrawType = 'drawTwo';
    game.players[0].hand = [{ id: 'two', type: 'drawTwo', color: 'blue' }, { id: 'four', type: 'wildDrawFour', color: 'wild' }];
    expect(getPlayableCards(game, 'a').map((card) => card.id)).toEqual(['two']);
    const next = applyGameAction(game, { type: 'PLAY_CARD', playerId: 'a', cardId: 'two' }).state;
    expect(next.pendingDraw).toBe(4);
  });
  it('redacts the deck, other hands, and another player drawn-card ID', () => {
    const game = setup(); game.turnDrawnCardId = 'r';
    const redacted = redactGameForPlayer(game, 'b');
    expect(redacted.turnDrawnCardId).toBeUndefined();
    expect(redacted.players[0].hand.every((card) => card.hidden)).toBe(true);
    expect(redacted.players[1].hand).toEqual(game.players[1].hand);
    expect(redacted.deck.every((card) => card.hidden && !card.value)).toBe(true);
  });
  it('counts wild cards in statistics', () => {
    const game = setup(); game.players[0].hand = [{ id: 'w', type: 'wild', color: 'wild' }];
    const won = applyGameAction(game, { type: 'PLAY_CARD', playerId: 'a', cardId: 'w', chosenColor: 'red' }).state;
    const stats = updateStatisticsFromFinishedGame(DEFAULT_STATISTICS, won, 'a').statistics;
    expect(stats.cardsPlayed).toBe(1); expect(stats.wins).toBe(1);
  });
});
describe('whole-match simulations', () => {
  it.each(['easy', 'medium', 'hard'] as const)('%s bots finish games and preserve all 108 unique cards', (difficulty) => {
    for (let seed = 0; seed < 6; seed++) {
      const optional = seed % 2 === 1;
      let state = createGame({ id: 'sim-' + seed, seed: difficulty + seed, players: Array.from({ length: 5 }, (_, i) => ({ id: 'p' + i, name: 'Bot ' + i, kind: 'bot', aiDifficulty: difficulty })), settings: { stackDrawTwo: optional, stackDrawFour: optional, jumpIn: optional, sevenZero: optional, forcePlay: optional } });
      const random = createSeededRandom('bot-' + seed);
      let turns = 0;
      while (state.status === 'playing' && turns++ < 2500) {
        const actions = getBotTurnActions(state, getCurrentPlayer(state).id, difficulty, random);
        expect(actions.length).toBeGreaterThan(0);
        for (const action of actions) {
          const result = applyGameAction(state, action);
          expect(result.ok, result.error).toBe(true);
          state = result.state;
        }
        const cards = [...state.deck, ...state.discardPile, ...state.players.flatMap((p) => p.hand)];
        expect(cards).toHaveLength(108); expect(new Set(cards.map((card) => card.id)).size).toBe(108);
      }
      expect(state.status).toBe('finished');
    }
  });
});
