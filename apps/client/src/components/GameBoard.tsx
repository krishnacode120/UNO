import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Ban, Clock3, Flag, Hand, Repeat2, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react';
import { getCurrentPlayer, getPlayableCards, getTopDiscard, PLAY_COLORS } from '@uno/shared';
import type { Card, GameAction, GameState, PlayColor } from '@uno/shared';
import { useEffect, useState } from 'react';
import { CardFace, CardView } from './CardView.js';
import { PlayerBadge } from './PlayerBadge.js';
import { Modal } from './Modal.js';

interface Props {
  game: GameState; viewerId: string; roomCode?: string; connected?: boolean; busy?: boolean; error?: string | null;
  onAction: (action: GameAction) => void; onLeave: () => void; onRematch?: () => void;
  muted: boolean; onMute: () => void;
}
export const GameBoard = ({ game, viewerId, roomCode, connected = true, busy = false, error, onAction, onLeave, onRematch, muted, onMute }: Props) => {
  const [pending, setPending] = useState<Card | null>(null);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setTick(Date.now()), 250); return () => clearInterval(timer); }, []);
  const current = getCurrentPlayer(game);
  const viewer = game.players.find((p) => p.id === viewerId)!;
  const opponents = game.players.filter((p) => p.id !== viewerId);
  const top = getTopDiscard(game);
  const playable = new Set(getPlayableCards(game, viewerId, true).map((card) => card.id));
  const active = current.id === viewerId && game.status === 'playing';
  const locked = busy || !connected || game.status !== 'playing';
  const remaining = Math.max(0, Math.ceil((Date.parse(game.turnStartedAt) + game.settings.turnTimerSeconds * 1000 - tick) / 1000));
  const last = game.actionLog.at(-1);
  const winner = game.players.find((p) => p.id === game.winnerId);
  const play = (card: Card, color?: PlayColor, targetPlayerId?: string) => {
    if ((card.color === 'wild' && !color) || (game.settings.sevenZero && card.value === 7 && viewer.hand.length > 1 && !targetPlayerId)) {
      setPending(card); return;
    }
    onAction({ type: 'PLAY_CARD', playerId: viewerId, cardId: card.id, chosenColor: color, targetPlayerId });
    setPending(null);
  };
  useEffect(() => { setPending(null); }, [game.currentPlayerIndex, game.turnStartedAt]);
  if (!viewer) return null;
  return <main className="game-screen">
    <header className="game-header">
      <button className="icon-button" onClick={() => setLeaveConfirm(true)} title="Leave table" aria-label="Leave table"><ArrowLeft size={20}/></button>
      <div className="game-heading"><strong>{roomCode ? 'Private table' : 'Solo table'}<span className="live-tag">{roomCode || game.settings.aiDifficulty}</span></strong><span>{roomCode ? connected ? 'Everyone is at the same table' : 'Reconnecting...' : 'You + 4 opponents'}</span></div>
      <button className="icon-button" onClick={onMute} title={muted ? 'Unmute' : 'Mute'} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <VolumeX size={19}/> : <Volume2 size={19}/>}</button>
    </header>
    {(!connected || error) && <div role="alert" className="error-banner">{!connected ? 'Connection lost. Your seat is saved; reconnecting...' : error}</div>}
    <div className="table-layout"><section className="game-main">
      <div className="opponent-track" style={{ '--players': Math.min(opponents.length, 5) } as React.CSSProperties}>
        {opponents.map((player, i) => <div className="opponent-seat" key={player.id}><PlayerBadge player={player} active={current.id === player.id} index={i + 1}/><div className="mini-hand" aria-hidden="true">{Array.from({ length: Math.min(7, player.hand.length) }, (_, n) => <span key={n}/>)}</div></div>)}
      </div>
      <section className={`table-zone active-${game.currentColor}`}>
        <div className="table-felt"/><div className="table-watermark">UNO<span>ARENA</span></div>
        <div className="table-status"><span className={`color-dot ${game.currentColor}`}/>{game.currentColor}<span className="status-separator"/><motion.span animate={{ rotate: game.direction === 1 ? 0 : 180 }}><Repeat2 size={16}/></motion.span><span>{game.direction === 1 ? 'Clockwise' : 'Counterclockwise'}</span></div>
        <div className="pile-stack"><div className="pile-column"><button className="draw-pile" disabled={!active || locked || !!game.turnDrawnCardId} aria-label="Draw from deck" title="Draw from deck" onClick={() => onAction({ type: 'DRAW_CARD', playerId: viewerId })}><CardFace card={{ id: 'deck', color: 'wild', type: 'wild', hidden: true }}/></button><span>DRAW PILE <b>{game.deck.length}</b></span></div>
          <div className="pile-column"><AnimatePresence mode="popLayout" initial={false}><motion.div className="discard-pile" key={top.id} initial={{ x: 70, y: 50, rotate: 16, opacity: 0 }} animate={{ x: 0, y: 0, rotate: -7, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 24 }}><CardFace card={top}/></motion.div></AnimatePresence><span>DISCARD PILE</span></div>
        </div>
        <AnimatePresence mode="wait"><motion.div className="table-event" role="status" aria-live="polite" key={last?.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{last?.type === 'reverse' ? <Repeat2 size={16}/> : last?.type === 'skip' ? <Ban size={16}/> : null}{last?.message}</motion.div></AnimatePresence>
        {game.pendingDraw > 0 && <motion.div className="penalty-badge" initial={{ scale: .5 }} animate={{ scale: 1 }}>+{game.pendingDraw}</motion.div>}
      </section>
      <section className="player-zone">
        <div className="hand-toolbar"><PlayerBadge player={viewer} active={active} isSelf/><div className={`turn-label ${active ? 'your-turn' : ''}`}>{game.status === 'finished' ? 'Round complete' : active ? 'Your turn' : current.name + "'s turn"}{game.settings.turnTimerSeconds > 0 && game.status === 'playing' && <span className={remaining < 10 ? 'time-low' : ''}><Clock3 size={14}/>{remaining}s</span>}</div>
          <button className={`uno-button ${viewer.hasCalledUno ? 'called' : ''}`} disabled={locked || viewer.hasCalledUno || viewer.hand.length > 2 || (!active && viewer.hand.length !== 1)} onClick={() => onAction({ type: 'CALL_UNO', playerId: viewerId })}>{viewer.hasCalledUno ? 'CALLED!' : 'UNO!'}</button></div>
        <div className="hand-scroll"><div className="hand-row">{viewer.hand.map((card, i) => <motion.div className="hand-card" key={card.id} initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: game.version === 1 ? i * .06 : 0 }} layout><CardView card={card} playable={playable.has(card.id) && !locked} disabled={!playable.has(card.id) || locked} onClick={(selected) => play(selected)}/></motion.div>)}</div></div>
        <div className="hand-footer"><span>{viewer.hand.length} cards in your hand</span><div>{game.unoVulnerablePlayerId && game.unoVulnerablePlayerId !== viewerId && <button className="ghost-button catch-button" disabled={locked} onClick={() => onAction({ type: 'CATCH_UNO', playerId: viewerId, targetPlayerId: game.unoVulnerablePlayerId! })}><Flag size={15}/>Catch UNO</button>}
        <button className="ghost-button" disabled={!active || locked || !!game.turnDrawnCardId} onClick={() => onAction({ type: 'DRAW_CARD', playerId: viewerId })}><Hand size={16}/>{game.pendingDraw ? 'Draw ' + game.pendingDraw : 'Draw card'}</button>
        {game.turnDrawnCardId && active && <button className="primary-button small" disabled={locked || game.settings.forcePlay} onClick={() => onAction({ type: 'PASS_TURN', playerId: viewerId })}>Pass<ArrowRight size={16}/></button>}</div></div>
      </section>
    </section><aside className="activity-panel"><p className="eyebrow">AT THE TABLE</p><h3>Match activity</h3><ol>{game.actionLog.slice(-8).reverse().map((event) => <li key={event.id}><span className={`activity-dot ${event.card?.color || ''}`}/><p>{event.message}<small>{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></p></li>)}</ol><div className="rules-summary"><span>HOUSE RULES</span><p>{[['stackDrawTwo', 'Stack +2'], ['stackDrawFour', 'Stack +4'], ['jumpIn', 'Jump in'], ['sevenZero', '7 / 0'], ['forcePlay', 'Force play']].filter(([key]) => game.settings[key as keyof typeof game.settings]).map(([, name]) => name).join(' · ') || 'Classic rules'}</p></div></aside></div>
    {pending && <Modal title={pending.color === 'wild' ? 'Choose your color' : 'Swap hands with...'} onClose={() => setPending(null)}>{pending.color === 'wild' ? <div className="color-grid">{PLAY_COLORS.map((color) => <button className={`color-choice ${color}`} key={color} onClick={() => play(pending, color)} aria-label={'Choose ' + color}><span/>{color}</button>)}</div> : <div className="target-list">{opponents.map((p) => <button className="ghost-button" key={p.id} onClick={() => play(pending, undefined, p.id)}>{p.name}<span>{p.hand.length} cards</span></button>)}</div>}</Modal>}
    {leaveConfirm && <Modal title="Leave this table?" onClose={() => setLeaveConfirm(false)}><p>{roomCode ? 'A bot will take your seat for the rest of this round.' : 'Your current solo round will end.'}</p><div className="modal-actions"><button className="ghost-button" onClick={() => setLeaveConfirm(false)}>Keep playing</button><button className="danger-button" onClick={onLeave}>Leave table</button></div></Modal>}
    {game.status === 'finished' && !leaveConfirm && <Modal title={winner?.id === viewerId ? 'That was your hand!' : winner?.name + ' takes the round'} onClose={onLeave}><div className="victory-content"><Trophy size={60}/><span className="eyebrow">ROUND COMPLETE</span><strong>{winner?.score ?? 0}<small>POINTS</small></strong><div className="confetti" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <motion.i key={i} style={{ background: ['#ff5b64', '#e6ca5b', '#70d7ac', '#69b4fa'][i % 4], left: i * 6 + '%' }} animate={{ y: [0, 150], rotate: [0, i * 30], opacity: [1, 0] }} transition={{ duration: 2.2, delay: i * .1, repeat: Infinity }}/>)}</div></div><div className="modal-actions"><button className="ghost-button" onClick={onLeave}>Back home</button>{onRematch ? <button className="primary-button" onClick={onRematch}><RotateCcw size={16}/>Play again</button> : <span className="muted">Waiting for the host's rematch</span>}</div></Modal>}
  </main>;
};
