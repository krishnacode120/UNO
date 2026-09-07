import { useState } from 'react';
import { ArrowLeft, ArrowRight, Bot, Check, Copy, Crown, Plus, Share2, Trash2, Users, Wifi } from 'lucide-react';
import type { AiDifficulty, ClientRoomView } from '@uno/shared';
import { Avatar } from './PlayerBadge.js';

interface Props {
  room: ClientRoomView | null; playerId: string | null; connected: boolean; busy: boolean; error: string | null; isHost: boolean;
  initialCode: string; onCreate: () => void; onJoin: (code: string) => void; onAddBot: (difficulty: AiDifficulty) => void;
  onRemoveBot: (id: string) => void; onStart: () => void; onBack: () => void;
}
export const LobbyView = ({ room, playerId, connected, busy, error, isHost, initialCode, onCreate, onJoin, onAddBot, onRemoveBot, onStart, onBack }: Props) => {
  const [code, setCode] = useState(initialCode);
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState('');
  const share = async (codeOnly = false) => {
    if (!room) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', room.code);
    try {
      if (!codeOnly && navigator.share) await navigator.share({ title: 'Your seat at UNO Arena', text: 'Join my table: ' + room.code, url: url.toString() });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(codeOnly ? room.code : url.toString()); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
      else setShareError('Room code: ' + room.code);
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setShareError('Share this room code: ' + room.code); }
  };
  return <main className="lobby-screen"><header className="section-heading"><div><p className="eyebrow">GOOD COMPANY. GREAT GAMES.</p><h2>{room ? 'Your table is coming together.' : 'Make room for your friends.'}</h2></div><button className="ghost-button" onClick={onBack}><ArrowLeft size={16}/>{room ? 'Leave room' : 'Back'}</button></header>
    {(error || shareError) && <div className="error-banner" role="alert">{error || shareError}</div>}
    {!room ? <div className="room-options"><section><span className="large-mode-icon"><Plus size={30}/></span><h3>Be the host.</h3><p>A private table for you and up to nine friends.</p><button className="primary-button" onClick={onCreate} disabled={!connected || busy}>Create a room<ArrowRight size={18}/></button></section><section><span className="large-mode-icon"><Users size={30}/></span><h3>Your seat is waiting.</h3><form onSubmit={(event) => { event.preventDefault(); onJoin(code); }}><label htmlFor="room-code">Enter room code</label><input id="room-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-F0-9]/g, ''))} placeholder="A1B2C3" maxLength={6} autoComplete="off" autoCapitalize="characters"/><button className="primary-button" disabled={!connected || busy || code.length !== 6}>Join table<ArrowRight size={18}/></button></form></section></div> :
    <div className="lobby-layout"><section className="lobby-roster"><div className="section-heading"><h3>At your table <span className="count-tag">{room.players.length}/10</span></h3><span className="small-label"><span className="status-dot"/> Waiting room</span></div><div className="lobby-list">{room.players.map((player, i) => <article key={player.id}><Avatar name={player.name} index={i} bot={player.kind === 'bot'}/><div><strong>{player.name}{player.id === playerId && <small> (you)</small>}</strong><span>{player.kind === 'bot' ? player.aiDifficulty + ' bot' : player.isConnected ? 'Connected' : 'Reconnecting'}</span></div>{player.id === room.hostId ? <Crown className="host-crown" size={18}/> : player.kind === 'bot' && isHost ? <button className="icon-button" title="Remove bot" aria-label={'Remove ' + player.name} onClick={() => onRemoveBot(player.id)} disabled={busy}><Trash2 size={16}/></button> : <Check size={18}/>}</article>)}</div>{isHost && <div className="add-bot-row"><Bot size={20}/><select value={difficulty} aria-label="Bot difficulty" onChange={(event) => setDifficulty(event.target.value as AiDifficulty)}><option value="easy">Easy bot</option><option value="medium">Medium bot</option><option value="hard">Hard bot</option></select><button className="ghost-button" onClick={() => onAddBot(difficulty)} disabled={busy || room.players.length >= 10}><Plus size={16}/>Add bot</button></div>}</section>
      <aside className="invite-panel"><span className="eyebrow">YOUR PRIVATE ROOM</span><h3>A code. A crew.<br/>A little competition.</h3><div className="room-code"><strong>{room.code}</strong><button className="icon-button" onClick={() => void share(true)} aria-label="Copy room code" title="Copy room code">{copied ? <Check size={19}/> : <Copy size={19}/>}</button></div><button className="ghost-button" onClick={() => void share()}><Share2 size={17}/>{copied ? 'Copied!' : 'Share invite'}</button><div className="invite-divider"/><span className="small-label">{room.players.length} players at the table</span>{isHost ? <button className="primary-button" disabled={busy || !connected || room.players.length < 2} onClick={onStart}>Start the game<ArrowRight size={18}/></button> : <p className="muted">Waiting for the host to deal.</p>}</aside></div>}
    <footer className="connection-footer"><Wifi size={17}/><span>{connected ? 'Connected' : 'Connecting to server...'}<small>Same Wi-Fi or online. One shared table.</small></span></footer>
  </main>;
};
