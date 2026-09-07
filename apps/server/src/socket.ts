import type { Server } from 'socket.io';
import { z } from 'zod';
import { getCurrentPlayer } from '@uno/shared';
import { RoomManager } from './roomManager.js';
import { actionSchema, settingsSchema } from './validation.js';

const codeSchema = z.string().trim().toUpperCase().regex(/^[A-F0-9]{6}$/, 'Enter a six-character room code.');
const nameSchema = z.string().trim().min(1).max(24);
const roomPayload = z.object({ roomCode: codeSchema });
type Reply = (result: object) => void;

/** One scheduled task per room; all state mutations are synchronous and authoritative. */
export const registerSocketHandlers = (io: Server, rooms: RoomManager) => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const broadcast = (code: string) => {
    if (!rooms.getRoom(code)) return;
    for (const target of rooms.getHumanSocketTargets(code)) io.to(target.socketId).emit('room:update', rooms.getClientView(code, target.playerId));
  };
  const schedule = (code: string) => {
    clearTimeout(timers.get(code));
    timers.delete(code);
    const room = rooms.getRoom(code);
    if (!room?.game || room.game.status !== 'playing') return;
    const current = getCurrentPlayer(room.game);
    const bot = current.kind === 'bot';
    const seconds = room.settings.turnTimerSeconds;
    if (!bot && current.isConnected && seconds === 0) return;
    const deadline = Date.parse(room.game.turnStartedAt) + (seconds || 45) * 1000;
    const delay = bot ? 850 : Math.max(100, deadline - Date.now());
    timers.set(code, setTimeout(() => {
      timers.delete(code);
      const latest = rooms.getRoom(code)?.game;
      if (!latest || latest.status !== 'playing') return;
      try {
        if (getCurrentPlayer(latest).kind === 'bot') {
          if (latest.unoVulnerablePlayerId && latest.unoVulnerablePlayerId !== getCurrentPlayer(latest).id) {
            rooms.applyAction(code, { type: 'CATCH_UNO', playerId: getCurrentPlayer(latest).id, targetPlayerId: latest.unoVulnerablePlayerId });
          }
          for (const action of rooms.getBotActions(code)) rooms.applyAction(code, action);
        } else {
          const playerId = getCurrentPlayer(latest).id;
          rooms.applyAction(code, { type: latest.turnDrawnCardId ? 'PASS_TURN' : 'DRAW_CARD', playerId });
          const after = rooms.getRoom(code)?.game;
          if (after?.status === 'playing' && getCurrentPlayer(after).id === playerId && after.turnDrawnCardId) rooms.applyAction(code, { type: 'PASS_TURN', playerId });
        }
        broadcast(code);
      } catch (error) { console.error('[turn]', error); }
      schedule(code);
    }, delay));
  };
  const cleanup = setInterval(() => rooms.cleanup(), 60_000);
  cleanup.unref();

  io.on('connection', (socket) => {
    let quota = 0;
    let windowStart = Date.now();
    const handle = <T>(event: string, schema: z.ZodType<T>, run: (data: T) => object) => {
      socket.on(event, (input: unknown, ack: unknown) => {
        const reply: Reply = typeof ack === 'function' ? ack as Reply : () => {};
        try {
          if (Date.now() - windowStart > 10_000) { quota = 0; windowStart = Date.now(); }
          if (++quota > 40) throw new Error('Too many requests. Wait a moment.');
          reply({ ok: true, ...run(schema.parse(input)) });
        } catch (error) {
          reply({ ok: false, error: error instanceof z.ZodError ? error.issues[0].message : error instanceof Error ? error.message : 'Request failed.' });
        }
      });
    };
    const member = (code: string, hostOnly = false) => {
      const player = rooms.getPlayerForSocket(code, socket.id);
      if (!player) throw new Error('You are not in this room.');
      if (hostOnly && rooms.getRoom(code)?.hostId !== player.id) throw new Error('Only the host can do that.');
      return player;
    };
    const publish = (code: string) => { broadcast(code); schedule(code); };
    handle('room:create', z.object({ name: nameSchema, settings: settingsSchema.partial().optional() }), (data) => {
      const result = rooms.createRoom(socket.id, data.name, data.settings);
      socket.emit('room:update', result.room);
      return { roomCode: result.room.code, playerId: result.playerId, reconnectToken: result.reconnectToken };
    });
    handle('room:join', roomPayload.extend({ name: nameSchema }), (data) => {
      const result = rooms.joinRoom(data.roomCode, socket.id, data.name);
      publish(data.roomCode);
      return { roomCode: data.roomCode, playerId: result.playerId, reconnectToken: result.reconnectToken };
    });
    handle('room:reconnect', roomPayload.extend({ reconnectToken: z.string().min(20).max(100) }), (data) => {
      const result = rooms.reconnectRoom(data.roomCode, socket.id, data.reconnectToken);
      publish(data.roomCode);
      return { roomCode: data.roomCode, playerId: result.playerId, reconnectToken: result.reconnectToken };
    });
    handle('room:addBot', roomPayload.extend({ difficulty: z.enum(['easy', 'medium', 'hard']) }), (data) => {
      member(data.roomCode, true);
      rooms.addBot(data.roomCode, data.difficulty);
      publish(data.roomCode);
      return {};
    });
    handle('room:removeBot', roomPayload.extend({ botId: z.string() }), (data) => {
      member(data.roomCode, true);
      rooms.removeBot(data.roomCode, data.botId);
      publish(data.roomCode);
      return {};
    });
    handle('room:start', roomPayload, (data) => {
      rooms.startGame(data.roomCode, member(data.roomCode, true).id);
      publish(data.roomCode);
      return {};
    });
    handle('room:leave', roomPayload, (data) => {
      rooms.leaveRoom(data.roomCode, socket.id);
      publish(data.roomCode);
      return {};
    });
    handle('game:action', roomPayload.extend({ action: actionSchema, version: z.number().int().positive() }), (data) => {
      const player = member(data.roomCode);
      if (rooms.getRoom(data.roomCode)?.game?.version !== data.version) {
        broadcast(data.roomCode);
        throw new Error('The table changed. Please choose your move again.');
      }
      rooms.applyAction(data.roomCode, { ...data.action, playerId: player.id });
      publish(data.roomCode);
      return {};
    });
    socket.on('disconnect', () => rooms.markDisconnected(socket.id).forEach(publish));
  });
  return () => { clearInterval(cleanup); for (const timer of timers.values()) clearTimeout(timer); };
};
