import { PLAY_COLORS } from './constants.js';
import { getCardPoints, getCurrentPlayer, getPlayableCards, getPlayer } from './engine.js';
import type { AiDifficulty, Card, GameAction, GameState, PlayColor, PlayerState } from './types.js';

const randomItem = <T>(items: T[], random: () => number): T => items[Math.floor(random() * items.length)];

export const chooseColorForHand = (hand: Card[], fallback: PlayColor = 'red'): PlayColor => {
  const counts = Object.fromEntries(PLAY_COLORS.map((color) => [color, 0])) as Record<PlayColor, number>;

  for (const card of hand) {
    if (card.color !== 'wild') {
      counts[card.color] += card.type === 'number' ? 1 : 1.35;
    }
  }

  return PLAY_COLORS.reduce((best, color) => (counts[color] > counts[best] ? color : best), fallback);
};

const getNextOpponent = (state: GameState): PlayerState => {
  const nextIndex = (state.currentPlayerIndex + state.direction + state.players.length) % state.players.length;
  return state.players[nextIndex];
};

const chooseSevenZeroTarget = (state: GameState, playerId: string): string | undefined =>
  [...state.players]
    .filter((player) => player.id !== playerId)
    .sort((left, right) => left.hand.length - right.hand.length)[0]?.id;

const buildPlayAction = (state: GameState, player: PlayerState, card: Card): GameAction => ({
  type: 'PLAY_CARD',
  playerId: player.id,
  cardId: card.id,
  chosenColor: card.color === 'wild' ? chooseColorForHand(player.hand) : undefined,
  targetPlayerId:
    state.settings.sevenZero && card.type === 'number' && card.value === 7
      ? chooseSevenZeroTarget(state, player.id)
      : undefined
});

const scoreMediumCard = (state: GameState, player: PlayerState, card: Card): number => {
  const nextOpponent = getNextOpponent(state);
  const sameColorCount = player.hand.filter((candidate) => candidate.color === card.color).length;
  let score = sameColorCount * 3 + getCardPoints(card) / 10;

  if (card.type === 'drawTwo' || card.type === 'wildDrawFour') {
    score += nextOpponent.hand.length <= 2 ? 24 : 10;
  }

  if (card.type === 'skip' || card.type === 'reverse') {
    score += nextOpponent.hand.length <= 2 ? 18 : 6;
  }

  if (card.color === 'wild') {
    score += player.hand.length <= 3 ? 16 : 3;
  }

  return score;
};

const scoreHardCard = (state: GameState, player: PlayerState, card: Card): number => {
  const nextOpponent = getNextOpponent(state);
  const remainingHand = player.hand.filter((candidate) => candidate.id !== card.id);
  const chosenColor = card.color === 'wild' ? chooseColorForHand(remainingHand) : card.color;
  const colorFollowUps = remainingHand.filter((candidate) => candidate.color === chosenColor || candidate.color === 'wild').length;
  const opponentsNearOut = state.players.some((candidate) => candidate.id !== player.id && candidate.hand.length <= 2);
  let score = colorFollowUps * 7 + getCardPoints(card) / 4;

  if (nextOpponent.hand.length <= 2) {
    if (card.type === 'drawTwo') {
      score += 44;
    }

    if (card.type === 'wildDrawFour') {
      score += 56;
    }

    if (card.type === 'skip' || card.type === 'reverse') {
      score += 38;
    }
  }

  if (card.color === 'wild' && player.hand.length > 3 && !opponentsNearOut) {
    score -= 22;
  }

  if (card.color === 'wild' && player.hand.length <= 3) {
    score += 28;
  }

  if (state.pendingDraw > 0 && (card.type === 'drawTwo' || card.type === 'wildDrawFour')) {
    score += 65;
  }

  if (remainingHand.length === 1) {
    score += 100;
  }

  return score;
};

const chooseCard = (
  state: GameState,
  player: PlayerState,
  playableCards: Card[],
  difficulty: AiDifficulty,
  random: () => number
): Card => {
  if (difficulty === 'easy') {
    return randomItem(playableCards, random);
  }

  const scorer = difficulty === 'hard' ? scoreHardCard : scoreMediumCard;
  const ranked = playableCards
    .map((card) => ({
      card,
      score: scorer(state, player, card) + random() * 0.01
    }))
    .sort((left, right) => right.score - left.score);

  return ranked[0].card;
};

export const getBotTurnActions = (
  state: GameState,
  botId: string,
  difficulty: AiDifficulty = 'medium',
  random: () => number = Math.random
): GameAction[] => {
  if (state.status !== 'playing' || getCurrentPlayer(state).id !== botId) {
    return [];
  }

  const bot = getPlayer(state, botId);

  if (!bot) {
    return [];
  }

  const playableCards = getPlayableCards(state, bot.id);

  if (playableCards.length === 0) {
    return [{ type: state.turnDrawnCardId ? 'PASS_TURN' : 'DRAW_CARD', playerId: bot.id }];
  }

  const selectedCard = chooseCard(state, bot, playableCards, bot.aiDifficulty ?? difficulty, random);
  const actions: GameAction[] = [];

  if (bot.hand.length === 2 && !bot.hasCalledUno) {
    actions.push({ type: 'CALL_UNO', playerId: bot.id });
  }

  actions.push(buildPlayAction(state, bot, selectedCard));
  return actions;
};
