export type PlayColor = 'red' | 'yellow' | 'green' | 'blue';
export type CardColor = PlayColor | 'wild';
export type CardType = 'number' | 'skip' | 'reverse' | 'drawTwo' | 'wild' | 'wildDrawFour';
export type Direction = 1 | -1;
export type PlayerKind = 'human' | 'bot';
export type GameStatus = 'lobby' | 'playing' | 'finished';
export type AiDifficulty = 'easy' | 'medium' | 'hard';
export type ThemeName = 'classic' | 'midnight' | 'neon' | 'paper';

export interface Card {
  id: string;
  color: CardColor;
  type: CardType;
  value?: number;
  hidden?: boolean;
}

export interface PlayerConfig {
  id: string;
  name: string;
  kind: PlayerKind;
  avatar?: string;
  aiDifficulty?: AiDifficulty;
}

export interface PlayerState extends PlayerConfig {
  hand: Card[];
  score: number;
  isConnected: boolean;
  hasCalledUno: boolean;
}

export interface GameSettings {
  stackDrawTwo: boolean;
  stackDrawFour: boolean;
  jumpIn: boolean;
  sevenZero: boolean;
  forcePlay: boolean;
  turnTimerSeconds: number;
  aiDifficulty: AiDifficulty;
  theme: ThemeName;
  musicVolume: number;
  soundVolume: number;
  reducedMotion: boolean;
  highContrast: boolean;
}

export type GameEventType =
  | 'shuffle'
  | 'deal'
  | 'play'
  | 'draw'
  | 'pass'
  | 'skip'
  | 'reverse'
  | 'drawTwo'
  | 'drawFour'
  | 'wild'
  | 'uno'
  | 'penalty'
  | 'sevenZero'
  | 'recycle'
  | 'victory';

export interface GameEvent {
  id: string;
  type: GameEventType;
  createdAt: string;
  playerId?: string;
  targetPlayerId?: string;
  card?: Card;
  count?: number;
  color?: PlayColor;
  message: string;
}

export interface GameState {
  id: string;
  status: GameStatus;
  players: PlayerState[];
  deck: Card[];
  discardPile: Card[];
  currentPlayerIndex: number;
  direction: Direction;
  currentColor: PlayColor;
  pendingDraw: number;
  pendingDrawType?: Extract<CardType, 'drawTwo' | 'wildDrawFour'>;
  turnDrawnCardId?: string;
  unoVulnerablePlayerId?: string;
  winnerId?: string;
  settings: GameSettings;
  actionLog: GameEvent[];
  startedAt: string;
  updatedAt: string;
  turnStartedAt: string;
  version: number;
}

export type GameAction =
  | { type: 'CATCH_UNO'; playerId: string; targetPlayerId: string }
  | {
      type: 'PLAY_CARD';
      playerId: string;
      cardId: string;
      chosenColor?: PlayColor;
      targetPlayerId?: string;
    }
  | {
      type: 'DRAW_CARD';
      playerId: string;
    }
  | {
      type: 'PASS_TURN';
      playerId: string;
    }
  | {
      type: 'CALL_UNO';
      playerId: string;
    };

export interface ActionResult {
  ok: boolean;
  state: GameState;
  events: GameEvent[];
  error?: string;
}

export interface Statistics {
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  unoCalls: number;
  cardsPlayed: number;
  favoriteColor: PlayColor;
  colorCounts: Record<PlayColor, number>;
}

export interface MatchHistoryEntry {
  id: string;
  finishedAt: string;
  winnerName: string;
  didWin: boolean;
  players: string[];
  turns: number;
  score: number;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  settings: GameSettings;
  statistics: Statistics;
  matchHistory: MatchHistoryEntry[];
}

export interface RoomParticipant {
  id: string;
  name: string;
  kind: PlayerKind;
  avatar?: string;
  aiDifficulty?: AiDifficulty;
  isConnected: boolean;
}

export interface ClientRoomView {
  code: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'finished';
  players: RoomParticipant[];
  settings: GameSettings;
  game?: GameState;
}
