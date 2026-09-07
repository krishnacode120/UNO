import { CARD_POINTS, DEFAULT_SETTINGS, PLAY_COLORS } from './constants.js';
import { createSeededRandom, createStandardDeck, getCardLabel, shuffleCards } from './deck.js';
import type {
  ActionResult,
  Card,
  GameAction,
  GameEvent,
  GameEventType,
  GameSettings,
  GameState,
  PlayColor,
  PlayerConfig,
  PlayerState
} from './types.js';

const now = () => new Date().toISOString();
const eventId = () => `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cloneState = (state: GameState): GameState => JSON.parse(JSON.stringify(state)) as GameState;

const appendEvent = (
  state: GameState,
  type: GameEventType,
  message: string,
  detail: Omit<GameEvent, 'id' | 'type' | 'createdAt' | 'message'> = {}
) => {
  const event: GameEvent = {
    id: eventId(),
    type,
    createdAt: now(),
    message,
    ...detail
  };
  state.actionLog.push(event);
  return event;
};

const fail = (state: GameState, error: string): ActionResult => ({
  ok: false,
  state,
  events: [],
  error
});

const succeed = (state: GameState, events: GameEvent[]): ActionResult => ({
  ok: true,
  state,
  events
});

export const getTopDiscard = (state: GameState): Card => state.discardPile[state.discardPile.length - 1];

export const getCurrentPlayer = (state: GameState): PlayerState => state.players[state.currentPlayerIndex];

export const getPlayer = (state: GameState, playerId: string): PlayerState | undefined =>
  state.players.find((player) => player.id === playerId);

export const getPlayerIndex = (state: GameState, playerId: string): number =>
  state.players.findIndex((player) => player.id === playerId);

export const getCardPoints = (card: Card): number => {
  if (card.type === 'number') {
    return card.value ?? 0;
  }

  return CARD_POINTS[card.type];
};

export const createGame = ({
  id,
  players,
  settings,
  seed = `${Date.now()}`
}: {
  id: string;
  players: PlayerConfig[];
  settings?: Partial<GameSettings>;
  seed?: string;
}): GameState => {
  if (players.length < 2 || players.length > 10) {
    throw new Error('UNO games require 2 to 10 players.');
  }

  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
  if (new Set(players.map((player) => player.id)).size !== players.length) throw new Error('Player IDs must be unique.');
  const random = createSeededRandom(seed);
  const deck = shuffleCards(createStandardDeck(), random);

  const playerStates: PlayerState[] = players.map((player) => ({
    ...player,
    aiDifficulty: player.aiDifficulty ?? mergedSettings.aiDifficulty,
    hand: deck.splice(0, 7),
    score: 0,
    isConnected: true,
    hasCalledUno: false
  }));

  const firstDiscardIndex = deck.findIndex((card) => card.type === 'number');
  const [firstDiscard] = deck.splice(firstDiscardIndex >= 0 ? firstDiscardIndex : 0, 1);
  const timestamp = now();

  const state: GameState = {
    id,
    status: 'playing',
    players: playerStates,
    deck,
    discardPile: [firstDiscard],
    currentPlayerIndex: 0,
    direction: 1,
    currentColor: firstDiscard.color as PlayColor,
    pendingDraw: 0,
    settings: mergedSettings,
    actionLog: [],
    startedAt: timestamp,
    updatedAt: timestamp,
    turnStartedAt: timestamp,
    version: 1
  };

  appendEvent(state, 'shuffle', 'Deck shuffled.');
  appendEvent(state, 'deal', 'Cards dealt.');
  return state;
};

export const cardMatchesDiscard = (card: Card, topDiscard: Card, currentColor: PlayColor): boolean => {
  if (card.hidden) {
    return false;
  }

  if (card.color === 'wild') {
    return true;
  }

  if (card.color === currentColor) {
    return true;
  }

  if (card.type === 'number' && topDiscard.type === 'number' && card.value === topDiscard.value) {
    return true;
  }

  return card.type !== 'number' && card.type === topDiscard.type;
};

export const isWildDrawFourLegal = (state: GameState, player: PlayerState): boolean =>
  !player.hand.some((card) => card.color === state.currentColor && card.type !== 'wildDrawFour');

const canStackPendingDraw = (state: GameState, card: Card): boolean => {
  if (state.pendingDraw <= 0) {
    return false;
  }

  if (state.pendingDrawType === 'drawTwo') {
    return state.settings.stackDrawTwo && card.type === 'drawTwo';
  }

  return state.settings.stackDrawFour && card.type === 'wildDrawFour';
};

export const isCardPlayableByPlayer = (
  state: GameState,
  player: PlayerState,
  card: Card,
  options: { allowJumpIn?: boolean } = {}
): boolean => {
  if (state.status !== 'playing' || card.hidden) {
    return false;
  }

  const isTurn = getCurrentPlayer(state).id === player.id;
  const topDiscard = getTopDiscard(state);

  if (!isTurn) {
    return Boolean(
      options.allowJumpIn &&
        state.settings.jumpIn &&
        state.pendingDraw === 0 &&
        card.color !== 'wild' &&
        card.color === topDiscard.color &&
        card.type === topDiscard.type &&
        card.value === topDiscard.value
    );
  }

  if (state.pendingDraw > 0) {
    return canStackPendingDraw(state, card);
  }
  if (state.turnDrawnCardId && state.turnDrawnCardId !== card.id) return false;

  if (!cardMatchesDiscard(card, topDiscard, state.currentColor)) {
    return false;
  }

  if (card.type === 'wildDrawFour') {
    return isWildDrawFourLegal(state, player);
  }

  return true;
};

export const getPlayableCards = (state: GameState, playerId: string, allowJumpIn = false): Card[] => {
  const player = getPlayer(state, playerId);

  if (!player) {
    return [];
  }

  return player.hand.filter((card) => isCardPlayableByPlayer(state, player, card, { allowJumpIn }));
};

const nextIndex = (state: GameState, steps = 1): number => {
  let index = state.currentPlayerIndex;

  for (let step = 0; step < steps; step++) {
    index = (index + state.direction + state.players.length) % state.players.length;
  }

  return index;
};

const advanceTurn = (state: GameState, steps = 1) => {
  state.currentPlayerIndex = nextIndex(state, steps);
  state.turnStartedAt = now();
  state.turnDrawnCardId = undefined;
};

const dominantColor = (cards: Card[]): PlayColor => {
  const counts = Object.fromEntries(PLAY_COLORS.map((color) => [color, 0])) as Record<PlayColor, number>;

  for (const card of cards) {
    if (card.color !== 'wild') {
      counts[card.color]++;
    }
  }

  return PLAY_COLORS.reduce((best, color) => (counts[color] > counts[best] ? color : best), 'red');
};

const recycleDiscardIntoDeck = (state: GameState) => {
  if (state.deck.length > 0 || state.discardPile.length <= 1) {
    return;
  }

  const top = state.discardPile.pop()!;
  state.deck = shuffleCards(state.discardPile);
  state.discardPile = [top];
  appendEvent(state, 'recycle', 'Discard pile recycled into the deck.');
};

const drawCards = (state: GameState, player: PlayerState, count: number): Card[] => {
  player.hasCalledUno = false;
  const drawn: Card[] = [];

  for (let draw = 0; draw < count; draw++) {
    recycleDiscardIntoDeck(state);
    const card = state.deck.shift();

    if (!card) {
      break;
    }

    player.hand.push(card);
    drawn.push(card);
  }

  return drawn;
};

const completeGameIfNeeded = (state: GameState, player: PlayerState) => {
  if (player.hand.length > 0) {
    return;
  }

  if (state.pendingDraw) {
    const target = getCurrentPlayer(state);
    const drawn = drawCards(state, target, state.pendingDraw);
    appendEvent(state, 'draw', `${target.name} drew ${drawn.length} penalty cards.`, { playerId: target.id, count: drawn.length });
    state.pendingDraw = 0;
    state.pendingDrawType = undefined;
  }
  const score = state.players
    .filter((candidate) => candidate.id !== player.id)
    .flatMap((candidate) => candidate.hand)
    .reduce((total, card) => total + getCardPoints(card), 0);

  player.score += score;
  state.status = 'finished';
  state.winnerId = player.id;
  appendEvent(state, 'victory', `${player.name} wins the match.`, {
    playerId: player.id,
    count: score
  });
};

const rotateHands = (state: GameState) => {
  const hands = state.players.map((player) => player.hand);

  state.players.forEach((player, index) => {
    const sourceIndex = (index - state.direction + state.players.length) % state.players.length;
    player.hand = hands[sourceIndex];
    player.hasCalledUno = false;
  });
};

const swapHands = (state: GameState, player: PlayerState, targetPlayerId?: string): string | undefined => {
  const target = targetPlayerId ? getPlayer(state, targetPlayerId) : undefined;

  if (!target || target.id === player.id) {
    return undefined;
  }

  [player.hand, target.hand] = [target.hand, player.hand];
  player.hasCalledUno = false;
  target.hasCalledUno = false;
  return target.id;
};

const resolveActionCard = (
  state: GameState,
  player: PlayerState,
  card: Card,
  chosenColor?: PlayColor,
  targetPlayerId?: string
) => {
  const events: GameEvent[] = [];

  if (card.color === 'wild') {
    state.currentColor = chosenColor ?? dominantColor(player.hand);
    events.push(appendEvent(state, 'wild', `${player.name} changed the color to ${state.currentColor}.`, {
      playerId: player.id,
      card,
      color: state.currentColor
    }));
  } else {
    state.currentColor = card.color;
  }

  if (player.hand.length > 0 && state.settings.sevenZero && card.type === 'number' && card.value === 0) {
    rotateHands(state);
    events.push(appendEvent(state, 'sevenZero', `${player.name} rotated all hands.`, {
      playerId: player.id,
      card
    }));
  }

  if (player.hand.length > 0 && state.settings.sevenZero && card.type === 'number' && card.value === 7) {
    const swappedWith = swapHands(state, player, targetPlayerId);

    if (swappedWith) {
      events.push(appendEvent(state, 'sevenZero', `${player.name} swapped hands.`, {
        playerId: player.id,
        targetPlayerId: swappedWith,
        card
      }));
    }
  }

  switch (card.type) {
    case 'skip':
      events.push(appendEvent(state, 'skip', `${player.name} skipped the next player.`, { playerId: player.id, card }));
      advanceTurn(state, 2);
      break;
    case 'reverse':
      state.direction = state.direction === 1 ? -1 : 1;
      events.push(appendEvent(state, 'reverse', `${player.name} reversed direction.`, { playerId: player.id, card }));
      advanceTurn(state, state.players.length === 2 ? 2 : 1);
      break;
    case 'drawTwo':
      state.pendingDraw += 2;
      state.pendingDrawType = 'drawTwo';
      events.push(appendEvent(state, 'drawTwo', `${player.name} played Draw Two.`, {
        playerId: player.id,
        card,
        count: state.pendingDraw
      }));
      advanceTurn(state);
      break;
    case 'wildDrawFour':
      state.pendingDraw += 4;
      state.pendingDrawType = 'wildDrawFour';
      events.push(appendEvent(state, 'drawFour', `${player.name} played Wild Draw Four.`, {
        playerId: player.id,
        card,
        count: state.pendingDraw,
        color: state.currentColor
      }));
      advanceTurn(state);
      break;
    default:
      advanceTurn(state);
      break;
  }

  return events;
};

const applyPlayCard = (state: GameState, action: Extract<GameAction, { type: 'PLAY_CARD' }>): ActionResult => {
  const player = getPlayer(state, action.playerId);

  if (!player) {
    return fail(state, 'Player not found.');
  }

  const cardIndex = player.hand.findIndex((card) => card.id === action.cardId);
  const card = player.hand[cardIndex];

  if (!card) {
    return fail(state, 'Card not found in player hand.');
  }

  if (!isCardPlayableByPlayer(state, player, card, { allowJumpIn: true })) {
    return fail(state, `${getCardLabel(card)} cannot be played right now.`);
  }

  if (card.color === 'wild' && !PLAY_COLORS.includes(action.chosenColor as PlayColor)) {
    return fail(state, 'Wild cards require a selected color.');
  }

  if (state.settings.sevenZero && card.type === 'number' && card.value === 7 && player.hand.length > 1 &&
      (!getPlayer(state, action.targetPlayerId ?? '') || action.targetPlayerId === player.id)) {
    return fail(state, 'Seven-zero hand swaps require a target player.');
  }

  state.unoVulnerablePlayerId = undefined;
  const activePlayerIndex = getPlayerIndex(state, action.playerId);
  if (activePlayerIndex !== state.currentPlayerIndex && state.settings.jumpIn) {
    state.currentPlayerIndex = activePlayerIndex;
  }

  player.hand.splice(cardIndex, 1);
  player.hasCalledUno = player.hand.length === 1 ? player.hasCalledUno : false;
  state.discardPile.push(card);
  state.turnDrawnCardId = undefined;

  const events = [
    appendEvent(state, 'play', `${player.name} played ${getCardLabel(card)}.`, {
      playerId: player.id,
      card
    }),
    ...resolveActionCard(state, player, card, action.chosenColor, action.targetPlayerId)
  ];

  if (player.hand.length === 1 && !player.hasCalledUno) {
    state.unoVulnerablePlayerId = player.id;
    events.push(appendEvent(state, 'penalty', `${player.name} has one card left.`, { playerId: player.id }));
  }

  completeGameIfNeeded(state, player);
  return succeed(state, events);
};

const applyDrawCard = (state: GameState, action: Extract<GameAction, { type: 'DRAW_CARD' }>): ActionResult => {
  const player = getPlayer(state, action.playerId);

  if (!player) {
    return fail(state, 'Player not found.');
  }

  if (getCurrentPlayer(state).id !== player.id) {
    return fail(state, 'It is not this player’s turn.');
  }

  if (state.pendingDraw > 0) {
    const penaltyCount = state.pendingDraw;
    state.unoVulnerablePlayerId = undefined;
    const drawn = drawCards(state, player, penaltyCount);
    state.pendingDraw = 0;
    state.pendingDrawType = undefined;
    advanceTurn(state);
    const event = appendEvent(state, 'draw', `${player.name} drew ${drawn.length} penalty cards.`, {
      playerId: player.id,
      count: drawn.length
    });
    return succeed(state, [event]);
  }

  if (state.turnDrawnCardId) {
    return fail(state, 'This player has already drawn this turn.');
  }

  state.unoVulnerablePlayerId = undefined;
  const [drawnCard] = drawCards(state, player, 1);

  if (!drawnCard) {
    advanceTurn(state);
    return succeed(state, [appendEvent(state, 'pass', `${player.name} passed: the deck is empty.`, { playerId: player.id })]);
  }

  const drawEvent = appendEvent(state, 'draw', `${player.name} drew a card.`, {
    playerId: player.id,
    count: 1
  });

  const isPlayable = isCardPlayableByPlayer(state, player, drawnCard);

  if (isPlayable && state.settings.forcePlay) {
    const chosenColor = drawnCard.color === 'wild' ? dominantColor(player.hand) : undefined;
    return applyPlayCard(state, {
      type: 'PLAY_CARD',
      playerId: player.id,
      cardId: drawnCard.id,
      chosenColor,
      targetPlayerId: state.players.filter((candidate) => candidate.id !== player.id).sort((a, b) => a.hand.length - b.hand.length)[0]?.id
    });
  }

  if (isPlayable) {
    state.turnDrawnCardId = drawnCard.id;
  } else {
    advanceTurn(state);
  }

  return succeed(state, [drawEvent]);
};

const applyPassTurn = (state: GameState, action: Extract<GameAction, { type: 'PASS_TURN' }>): ActionResult => {
  const player = getPlayer(state, action.playerId);

  if (!player) {
    return fail(state, 'Player not found.');
  }

  if (getCurrentPlayer(state).id !== player.id) {
    return fail(state, 'It is not this player’s turn.');
  }

  if (!state.turnDrawnCardId) {
    return fail(state, 'A player may pass only after drawing a playable card.');
  }

  advanceTurn(state);
  const event = appendEvent(state, 'pass', `${player.name} passed.`, { playerId: player.id });
  return succeed(state, [event]);
};

const applyCallUno = (state: GameState, action: Extract<GameAction, { type: 'CALL_UNO' }>): ActionResult => {
  const player = getPlayer(state, action.playerId);

  if (!player) {
    return fail(state, 'Player not found.');
  }

  if (player.hand.length > 2 || player.hand.length === 0 || player.hasCalledUno ||
      (player.hand.length === 2 && getCurrentPlayer(state).id !== player.id)) {
    return fail(state, 'UNO can only be called when a player has two or fewer cards.');
  }

  player.hasCalledUno = true;
  if (state.unoVulnerablePlayerId === player.id) state.unoVulnerablePlayerId = undefined;
  const event = appendEvent(state, 'uno', `${player.name} called UNO.`, { playerId: player.id });
  return succeed(state, [event]);
};

export const applyGameAction = (inputState: GameState, action: GameAction): ActionResult => {
  const state = cloneState(inputState);
  const previousEventCount = state.actionLog.length;

  if (state.status !== 'playing') {
    return fail(inputState, 'The game is not active.');
  }

  let result: ActionResult;

  switch (action.type) {
    case 'CATCH_UNO': {
      const target = getPlayer(state, action.targetPlayerId);
      if (!getPlayer(state, action.playerId) || action.playerId === action.targetPlayerId ||
          !target || target.id !== state.unoVulnerablePlayerId || target.hasCalledUno || target.hand.length !== 1) {
        return fail(inputState, 'There is no missed UNO to catch.');
      }
      drawCards(state, target, 2);
      state.unoVulnerablePlayerId = undefined;
      result = succeed(state, [appendEvent(state, 'penalty', `${target.name} missed UNO and drew two.`, { playerId: target.id, count: 2 })]);
      break;
    }
    case 'PLAY_CARD':
      result = applyPlayCard(state, action);
      break;
    case 'DRAW_CARD':
      result = applyDrawCard(state, action);
      break;
    case 'PASS_TURN':
      result = applyPassTurn(state, action);
      break;
    case 'CALL_UNO':
      result = applyCallUno(state, action);
      break;
    default:
      result = fail(inputState, 'Unsupported game action.');
      break;
  }

  if (!result.ok) {
    return fail(inputState, result.error ?? 'Invalid move.');
  }

  result.state.updatedAt = now();
  result.state.version += 1;
  result.events = result.state.actionLog.slice(previousEventCount);
  return result;
};

export const createHiddenCard = (index: number): Card => ({
  id: `hidden-${index}`,
  color: 'wild',
  type: 'wild',
  hidden: true
});

export const redactGameForPlayer = (state: GameState, viewerId: string): GameState => {
  const redacted = cloneState(state);
  redacted.deck = state.deck.map((_, index) => createHiddenCard(index));
  if (getCurrentPlayer(state).id !== viewerId) redacted.turnDrawnCardId = undefined;
  redacted.players = redacted.players.map((player) =>
    player.id === viewerId
      ? player
      : {
          ...player,
          hand: player.hand.map((_, index) => createHiddenCard(index))
        }
  );
  return redacted;
};
