import { motion } from 'framer-motion';
import { ArrowRight, Bot, DoorOpen, Plus, Trophy, Users, Zap } from 'lucide-react';
import type { Card, Statistics } from '@uno/shared';
import { CardFace } from './CardView.js';

const showcase: Card[] = [
  { id: 'a', type: 'number', color: 'blue', value: 8 },
  { id: 'b', type: 'number', color: 'green', value: 2 },
  { id: 'c', type: 'number', color: 'yellow', value: 7 },
  { id: 'd', type: 'number', color: 'red', value: 4 },
  { id: 'e', type: 'wildDrawFour', color: 'wild' }
];
interface Props {
  playerName: string; statistics: Statistics; hasSavedGame: boolean;
  onPlay: () => void; onCreate: () => void; onJoin: () => void;
}
export const HomeScreen = ({ playerName, statistics, hasSavedGame, onPlay, onCreate, onJoin }: Props) => (
  <main className="home-screen">
    <header className="section-heading"><div><p className="eyebrow">YOUR DAILY DOSE OF FRIENDLY RIVALRY</p><h2>Welcome to the table, {playerName || 'Player'}.</h2></div><span className="small-label"><span className="status-dot"/> Ready to play</span></header>
    <section className="home-stage">
      <div className="stage-copy"><span className="edition-tag"><span/> THE CLASSIC. A FRESH HAND.</span><h1>UNO<span>Arena.</span></h1><p>Good cards.<br/>Even better company.</p><button className="primary-button" onClick={onPlay}><Zap size={18}/>{hasSavedGame ? 'Resume your game' : 'Deal me in'}<ArrowRight size={18}/></button><span className="stage-caption">YOU + 4 BOTS <span> / </span> ONE WINNER</span></div>
      <div className="showcase" aria-label="Colorful UNO cards" role="img"><div className="showcase-table"/>{showcase.map((card, i) => <motion.div key={card.id} className="showcase-card" style={{ '--i': i } as React.CSSProperties} animate={{ y: [0, -7, 0] }} transition={{ duration: 4.5, delay: i * .3, repeat: Infinity, ease: 'easeInOut' }}><CardFace card={card}/></motion.div>)}<span className="table-stamp">ONE CARD.<br/>ENDLESS POSSIBILITIES.</span></div>
      <div className="stage-bottom"><span>01 / PLAY YOUR WAY</span><div className="four-colors"><i/><i/><i/><i/></div><span>LET THE GOOD HANDS ROLL</span></div>
    </section>
    <div className="section-heading mode-heading"><h2>A seat for everyone.</h2><span className="muted">Pick your game</span></div>
    <section className="mode-grid">
      <button className="mode-card solo-mode" onClick={onPlay}><span className="mode-icon"><Bot/></span><span className="mode-text"><strong>Fly solo</strong><small>{hasSavedGame ? 'Your table is waiting' : 'You vs. four clever opponents'}</small></span><ArrowRight size={20}/></button>
      <button className="mode-card" onClick={onCreate}><span className="mode-icon"><Plus/></span><span className="mode-text"><strong>Host a table</strong><small>Bring your favorite people</small></span><ArrowRight size={20}/></button>
      <button className="mode-card" onClick={onJoin}><span className="mode-icon"><DoorOpen/></span><span className="mode-text"><strong>Join your friends</strong><small>One room code. You're in.</small></span><ArrowRight size={20}/></button>
    </section>
    <section className="home-bottom"><div><Trophy size={20}/><span><strong>{statistics.wins}</strong> wins</span><span className="divider"/><span><strong>{statistics.gamesPlayed}</strong> games played</span></div><span><Users size={16}/> Better together. Anywhere.</span></section>
  </main>
);
