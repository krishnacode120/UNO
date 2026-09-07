import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { io, type Socket } from 'socket.io-client';
import { RoomManager } from './roomManager.js';
import { registerSocketHandlers } from './socket.js';

let server: HttpServer;
let socketServer: Server;
let rooms: RoomManager;
let cleanup: () => void;
let url: string;
let clients: Socket[];
type Reply = { ok: boolean; error?: string; roomCode: string; playerId: string; reconnectToken: string };
const connect = async () => {
  const socket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  clients.push(socket);
  await new Promise<void>((resolve) => socket.on('connect', resolve));
  return socket;
};
const request = (socket: Socket, event: string, payload: unknown) => new Promise<Reply>((resolve, reject) => {
  socket.timeout(2500).emit(event, payload, (error: Error | null, response: Reply) => error ? reject(error) : resolve(response));
});
beforeEach(async () => {
  server = createServer(); socketServer = new Server(server); rooms = new RoomManager(); clients = [];
  cleanup = registerSocketHandlers(socketServer, rooms);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
});
afterEach(async () => {
  cleanup(); clients.forEach((socket) => socket.disconnect());
  await new Promise<void>((resolve) => socketServer.close(() => resolve()));
});
describe('authoritative multiplayer', () => {
  it('enforces membership, host permissions, capacity, and input validation', async () => {
    const host = await connect(); const guest = await connect(); const outsider = await connect();
    const created = await request(host, 'room:create', { name: 'Host' });
    expect(created.ok).toBe(true);
    const roomCode = created.roomCode;
    expect((await request(outsider, 'room:addBot', { roomCode, difficulty: 'easy' })).ok).toBe(false);
    expect((await request(guest, 'room:join', { roomCode, name: 'Guest' })).ok).toBe(true);
    expect((await request(guest, 'room:start', { roomCode })).ok).toBe(false);
    expect((await request(host, 'room:addBot', { roomCode, difficulty: 'impossible' })).ok).toBe(false);
    expect((await request(host, 'game:action', null)).ok).toBe(false);
    for (let i = 0; i < 8; i++) expect((await request(host, 'room:addBot', { roomCode, difficulty: 'hard' })).ok).toBe(true);
    expect((await request(outsider, 'room:join', { roomCode, name: 'Full' })).ok).toBe(false);
  });
  it('rejects stale duplicate moves and restores exactly the same private hand after reconnect', async () => {
    const host = await connect(); const guest = await connect();
    const created = await request(host, 'room:create', { name: 'Host', settings: { turnTimerSeconds: 0 } });
    const roomCode = created.roomCode;
    await request(guest, 'room:join', { roomCode, name: 'Guest' });
    await request(host, 'room:start', { roomCode });
    const version = rooms.getRoom(roomCode)!.game!.version;
    const payload = { roomCode, version, action: { type: 'DRAW_CARD', playerId: 'forged' } };
    const results = await Promise.all([request(host, 'game:action', payload), request(host, 'game:action', payload)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const before = rooms.getClientView(roomCode, created.playerId)!.game!.players[0].hand;
    host.disconnect();
    const replacement = await connect();
    expect((await request(replacement, 'room:reconnect', { roomCode, reconnectToken: 'invalid-token-that-is-long-enough' })).ok).toBe(false);
    const restored = await request(replacement, 'room:reconnect', { roomCode, reconnectToken: created.reconnectToken });
    expect(restored.playerId).toBe(created.playerId);
    expect(rooms.getClientView(roomCode, restored.playerId)!.game!.players[0].hand).toEqual(before);
    expect((await request(replacement, 'room:create', { name: 'Duplicate' })).ok).toBe(false);
  });
  it('advances timed-out human turns and hands host ownership to the next human on departure', async () => {
    const host = await connect(); const guest = await connect();
    const created = await request(host, 'room:create', { name: 'Host', settings: { turnTimerSeconds: 1 } });
    const joined = await request(guest, 'room:join', { roomCode: created.roomCode, name: 'Guest' });
    await request(host, 'room:start', { roomCode: created.roomCode });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(rooms.getRoom(created.roomCode)!.game!.currentPlayerIndex).toBe(1);
    await request(host, 'room:leave', { roomCode: created.roomCode });
    expect(rooms.getRoom(created.roomCode)!.hostId).toBe(joined.playerId);
    expect(rooms.getRoom(created.roomCode)!.game!.players[0].kind).toBe('bot');
  });
});
