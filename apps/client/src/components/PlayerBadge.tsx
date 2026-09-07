import { Bot, WifiOff } from 'lucide-react';
import type { PlayerState } from '@uno/shared';

export const Avatar = ({ name, index = 0, bot = false }: { name: string; index?: number; bot?: boolean }) => (
  <span className={`avatar avatar-${index % 5}`}>{bot ? <Bot size={23}/> : name.slice(0, 2).toUpperCase() || 'YOU'}</span>
);
export const PlayerBadge = ({ player, active = false, isSelf = false, index = 0 }: { player: PlayerState; active?: boolean; isSelf?: boolean; index?: number }) => (
  <div className={`player-badge ${active ? 'is-active' : ''}`}>
    <Avatar name={player.name} index={index} bot={player.kind === 'bot'}/>
    <div className="player-meta"><strong>{isSelf ? 'You' : player.name}</strong><span>{!player.isConnected && <WifiOff size={12}/>} {player.hand.length === 1 ? 'UNO!' : player.hand.length + ' cards'}</span></div>
    {active && <span className="active-dot"/>}
  </div>
);
