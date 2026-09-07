import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { AiDifficulty, ClientRoomView, GameAction, GameSettings } from '@uno/shared';
import { RECONNECT_STORAGE_KEY } from '../lib/defaults.js';

type Ack = { ok: boolean; error?: string; roomCode?: string; playerId?: string; reconnectToken?: string };
const readSession = (): { roomCode: string; reconnectToken: string } | null => {
  try { return JSON.parse(sessionStorage.getItem(RECONNECT_STORAGE_KEY) ?? 'null'); } catch { return null; }
};
export const useMultiplayer = (name: string, settings: GameSettings) => {
  const socketRef = useRef<Socket | null>(null);
  const [room, setRoom] = useState<ClientRoomView | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const request = useCallback(async (event: string, payload: object): Promise<Ack> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, error: 'Connection lost. Reconnecting to the table...' };
    return new Promise((resolve) => {
      socket.timeout(6000).emit(event, payload, (err: Error | null, response: Ack) => {
        resolve(err ? { ok: false, error: 'The server did not respond. Please try again.' } : response);
      });
    });
  }, []);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SERVER_URL || undefined, { reconnection: true });
    socketRef.current = socket;
    socket.on('connect', async () => {
      const session = readSession();
      if (session) {
        setBusy(true);
        const response = await request('room:reconnect', session);
        if (response.ok) setPlayerId(response.playerId!);
        else {
          sessionStorage.removeItem(RECONNECT_STORAGE_KEY);
          setRoom(null);
          setPlayerId(null);
          setError(response.error ?? 'Room expired. Create a new room.');
        }
        setBusy(false);
      }
      setConnected(true);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('room:update', (next: ClientRoomView) => setRoom(next));
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [request]);

  const run = useCallback(async (event: string, payload: object) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await request(event, payload);
      if (!response.ok) { setError(response.error ?? 'Request failed.'); return false; }
      if (response.reconnectToken && response.roomCode) {
        sessionStorage.setItem(RECONNECT_STORAGE_KEY, JSON.stringify({ roomCode: response.roomCode, reconnectToken: response.reconnectToken }));
        setPlayerId(response.playerId!);
      }
      return true;
    } finally { inFlight.current = false; setBusy(false); }
  }, [request]);

  return {
    room, playerId, connected, busy, error,
    isHost: Boolean(room && playerId === room.hostId),
    clearError: () => setError(null),
    createRoom: () => run('room:create', { name: name.trim() || 'Player', settings }),
    joinRoom: (code: string) => run('room:join', { name: name.trim() || 'Player', roomCode: code.trim().toUpperCase() }),
    addBot: (difficulty: AiDifficulty) => run('room:addBot', { roomCode: room?.code, difficulty }),
    removeBot: (botId: string) => run('room:removeBot', { roomCode: room?.code, botId }),
    startGame: () => run('room:start', { roomCode: room?.code }),
    sendAction: (action: GameAction) => run('game:action', { roomCode: room?.code, action, version: room?.game?.version }),
    leave: async () => {
      if (room && connected && !(await run('room:leave', { roomCode: room.code }))) return false;
      sessionStorage.removeItem(RECONNECT_STORAGE_KEY);
      setRoom(null); setPlayerId(null); setError(null);
      return true;
    }
  };
};
