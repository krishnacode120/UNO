import { randomBytes } from 'node:crypto';
import {
  DEFAULT_SETTINGS,
  applyGameAction,
  createGame,
  getBotTurnActions,
  getCurrentPlayer,
  redactGameForPlayer
} from '@uno/shared';
import type {
  AiDifficulty,
  ClientRoomView,
  GameAction,
  GameSettings,
  GameState,
  PlayerConfig,
  RoomParticipant
} from '@uno/shared';

interface RoomPlayer extends RoomParticipant {
  socketId?: string;
  reconnectToken?: string;
}

interface GameRoom {
  code: string;
  hostId: string;
  status: ClientRoomView['status'];
  players: RoomPlayer[];
  settings: GameSettings;
  game?: GameState;
  createdAt: string;
  updatedAt: string;
}

export interface RoomJoinResult {
  room: ClientRoomView;
  playerId: string;
  reconnectToken: string;
}

const avatars = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
const roomCode = () => randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
const token = () => randomBytes(18).toString('base64url');
const playerId = () => `player-${randomBytes(6).toString('hex')}`;
const timestamp = () => new Date().toISOString();

export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();

  createRoom(socketId: string, name: string, settings: Partial<GameSettings> = {}): RoomJoinResult {
    this.ensureUnseated(socketId);
    let code = roomCode();

    while (this.rooms.has(code)) {
      code = roomCode();
    }

    const host: RoomPlayer = {
      id: playerId(),
      socketId,
      reconnectToken: token(),
      name: name.trim() || 'Host',
      kind: 'human',
      avatar: avatars[0],
      isConnected: true
    };

    const room: GameRoom = {
      code,
      hostId: host.id,
      status: 'lobby',
      players: [host],
      settings: { ...DEFAULT_SETTINGS, ...settings },
      createdAt: timestamp(),
      updatedAt: timestamp()
    };

    this.rooms.set(code, room);

    return {
      room: this.getClientView(code, host.id)!,
      playerId: host.id,
      reconnectToken: host.reconnectToken!
    };
  }

  joinRoom(codeInput: string, socketId: string, name: string): RoomJoinResult {
    this.ensureUnseated(socketId);
    const room = this.requireRoom(codeInput);

    if (room.status !== 'lobby') {
      throw new Error('This room has already started. Use reconnect to rejoin an active game.');
    }

    if (room.players.length >= 10) {
      throw new Error('This room is full.');
    }

    const participant: RoomPlayer = {
      id: playerId(),
      socketId,
      reconnectToken: token(),
      name: name.trim() || `Player ${room.players.length + 1}`,
      kind: 'human',
      avatar: avatars[room.players.length % avatars.length],
      isConnected: true
    };

    room.players.push(participant);
    room.updatedAt = timestamp();

    return {
      room: this.getClientView(room.code, participant.id)!,
      playerId: participant.id,
      reconnectToken: participant.reconnectToken!
    };
  }

  reconnectRoom(codeInput: string, socketId: string, reconnectToken: string): RoomJoinResult {
    const room = this.requireRoom(codeInput);
    const participant = room.players.find((player) => player.reconnectToken === reconnectToken && player.kind === 'human');

    if (!participant) {
      throw new Error('Reconnect token is invalid for this room.');
    }
    const otherRoom = [...this.rooms.values()].find((candidate) => candidate.players.some((p) => p.socketId === socketId) && candidate.code !== room.code);
    if (otherRoom) throw new Error('Leave your current room first.');

    participant.socketId = socketId;
    participant.isConnected = true;
    const gamePlayer = room.game?.players.find((player) => player.id === participant.id);

    if (gamePlayer) {
      gamePlayer.isConnected = true;
    }

    room.updatedAt = timestamp();

    return {
      room: this.getClientView(room.code, participant.id)!,
      playerId: participant.id,
      reconnectToken
    };
  }

  addBot(codeInput: string, difficulty: AiDifficulty = 'medium') {
    const room = this.requireRoom(codeInput);

    if (room.status !== 'lobby') {
      throw new Error('Bots can only be added before the game starts.');
    }

    if (room.players.length >= 10) {
      throw new Error('This room is full.');
    }

    room.players.push({
      id: playerId(),
      name: `${difficulty[0].toUpperCase()}${difficulty.slice(1)} Bot`,
      kind: 'bot',
      aiDifficulty: difficulty,
      avatar: avatars[room.players.length % avatars.length],
      isConnected: true
    });
    room.updatedAt = timestamp();
  }

  startGame(codeInput: string, requesterId: string) {
    const room = this.requireRoom(codeInput);

    if (room.hostId !== requesterId) {
      throw new Error('Only the room host can start the game.');
    }

    if (room.status === 'playing') {
      throw new Error('This game is already active.');
    }

    if (room.players.length < 2) {
      throw new Error('Add at least one more player or bot before starting.');
    }

    const playerConfigs: PlayerConfig[] = room.players.map((participant) => ({
      id: participant.id,
      name: participant.name,
      kind: participant.kind,
      avatar: participant.avatar,
      aiDifficulty: participant.aiDifficulty
    }));

    room.game = createGame({
      id: `game-${room.code}-${Date.now()}`,
      players: playerConfigs,
      settings: room.settings,
      seed: randomBytes(24).toString('hex')
    });
    room.status = 'playing';
    room.updatedAt = timestamp();
  }

  applyAction(codeInput: string, action: GameAction) {
    const room = this.requireRoom(codeInput);

    if (!room.game) {
      throw new Error('Game has not started.');
    }

    const result = applyGameAction(room.game, action);

    if (!result.ok) {
      throw new Error(result.error ?? 'Invalid move.');
    }

    room.game = result.state;
    room.status = result.state.status === 'finished' ? 'finished' : 'playing';
    room.updatedAt = timestamp();
    return result;
  }

  getCurrentBot(codeInput: string): RoomPlayer | undefined {
    const room = this.requireRoom(codeInput);

    if (!room.game || room.game.status !== 'playing') {
      return undefined;
    }

    const currentPlayer = getCurrentPlayer(room.game);
    return room.players.find((participant) => participant.id === currentPlayer.id && participant.kind === 'bot');
  }

  getBotActions(codeInput: string): GameAction[] {
    const room = this.requireRoom(codeInput);
    const bot = this.getCurrentBot(codeInput);

    if (!room.game || !bot) {
      return [];
    }

    return getBotTurnActions(room.game, bot.id, bot.aiDifficulty ?? room.settings.aiDifficulty);
  }

  markDisconnected(socketId: string): string[] {
    const affectedRooms: string[] = [];

    for (const room of this.rooms.values()) {
      const participant = room.players.find((player) => player.socketId === socketId);

      if (!participant) {
        continue;
      }

      participant.isConnected = false;
      participant.socketId = undefined;
      const gamePlayer = room.game?.players.find((player) => player.id === participant.id);

      if (gamePlayer) {
        gamePlayer.isConnected = false;
      }

      room.updatedAt = timestamp();
      affectedRooms.push(room.code);
    }

    return affectedRooms;
  }

  getPlayerForSocket(codeInput: string, socketId: string): RoomPlayer | undefined {
    const room = this.requireRoom(codeInput);
    return room.players.find((participant) => participant.socketId === socketId);
  }

  getHumanSocketTargets(codeInput: string): Array<{ socketId: string; playerId: string }> {
    const room = this.requireRoom(codeInput);
    return room.players
      .filter((player) => player.kind === 'human' && player.socketId)
      .map((player) => ({ socketId: player.socketId!, playerId: player.id }));
  }

  getClientView(codeInput: string, viewerId: string): ClientRoomView | undefined {
    const room = this.rooms.get(codeInput.toUpperCase());

    if (!room) {
      return undefined;
    }

    return {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      players: room.players.map(({ reconnectToken: _reconnectToken, socketId: _socketId, ...participant }) => participant),
      settings: room.settings,
      game: room.game ? redactGameForPlayer(room.game, viewerId) : undefined
    };
  }

  getRoom(codeInput: string): GameRoom | undefined {
    return this.rooms.get(codeInput.toUpperCase());
  }

  removeBot(codeInput: string, botId: string) {
    const room = this.requireRoom(codeInput);
    if (room.status !== 'lobby') throw new Error('The match has already started.');
    room.players = room.players.filter((p) => p.kind !== 'bot' || p.id !== botId);
  }

  leaveRoom(codeInput: string, socketId: string) {
    const room = this.requireRoom(codeInput);
    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) throw new Error('You are not in this room.');
    if (room.status === 'playing') {
      player.kind = 'bot';
      player.name = `${player.name} (AI)`;
      player.aiDifficulty = room.settings.aiDifficulty;
      player.socketId = undefined;
      player.reconnectToken = undefined;
      const seated = room.game!.players.find((p) => p.id === player.id)!;
      seated.kind = 'bot';
      seated.name = player.name;
    } else room.players = room.players.filter((p) => p.id !== player.id);
    if (room.hostId === player.id) room.hostId = room.players.find((p) => p.kind === 'human' && p.isConnected)?.id ?? room.players.find((p) => p.kind === 'human')?.id ?? '';
    room.updatedAt = timestamp();
    if (!room.players.some((p) => p.kind === 'human')) this.rooms.delete(room.code);
  }

  cleanup() {
    for (const room of this.rooms.values()) {
      if (!room.players.some((p) => p.kind === 'human' && p.isConnected) && Date.now() - Date.parse(room.updatedAt) > 60 * 60 * 1000) this.rooms.delete(room.code);
    }
  }

  private ensureUnseated(socketId: string) {
    if (this.rooms.size >= 1000) throw new Error('Room capacity reached. Please try again later.');
    if ([...this.rooms.values()].some((room) => room.players.some((p) => p.socketId === socketId))) throw new Error('Leave your current room first.');
  }

  private requireRoom(codeInput: string): GameRoom {
    const room = this.rooms.get(codeInput.toUpperCase());

    if (!room) {
      throw new Error('Room not found.');
    }

    return room;
  }
}
