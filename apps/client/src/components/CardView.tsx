import { motion } from 'framer-motion';
import { Ban, Repeat2 } from 'lucide-react';
import { getCardLabel } from '@uno/shared';
import type { Card } from '@uno/shared';

export const CardFace = ({ card }: { card: Card }) => {
  const symbol = card.type === 'number' ? card.value : card.type === 'skip' ? <Ban /> : card.type === 'reverse' ? <Repeat2 /> : card.type === 'drawTwo' ? '+2' : card.type === 'wildDrawFour' ? '+4' : <span className="wild-symbol"><i/><i/><i/><i/></span>;
  return <span className={`card-face card-${card.hidden ? 'back' : card.color}`}>
    {card.hidden ? <span className="card-back-logo">UNO<span>ARENA</span></span> : <>
      <span className="card-corner">{symbol}</span>
      <span className="card-oval"/><span className="card-center">{symbol}</span>
      <span className="card-corner bottom">{symbol}</span>
    </>}
  </span>;
};
interface Props { card: Card; playable?: boolean; compact?: boolean; disabled?: boolean; onClick?: (card: Card) => void }
export const CardView = ({ card, playable = false, disabled = false, onClick }: Props) => (
  <motion.button type="button" className={`card ${playable ? 'is-playable' : ''}`}
    disabled={disabled || !onClick} aria-label={getCardLabel(card)} title={getCardLabel(card)}
    onClick={() => onClick?.(card)}
    whileHover={onClick && !disabled ? { y: -14, scale: 1.025 } : undefined}
    whileTap={onClick && !disabled ? { scale: .95 } : undefined}>
    <CardFace card={card}/>
  </motion.button>
);
