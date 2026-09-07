import type { GameEventType } from '@uno/shared';
import type { SoundName } from '../hooks/useAudio.js';

export const soundForEvent = (eventType: GameEventType): SoundName | undefined => {
  const sounds: Partial<Record<GameEventType, SoundName>> = {
    shuffle: 'shuffle',
    deal: 'shuffle',
    play: 'cardPlay',
    draw: 'cardDraw',
    skip: 'skip',
    reverse: 'reverse',
    drawTwo: 'drawTwo',
    drawFour: 'drawFour',
    wild: 'wild',
    uno: 'uno',
    victory: 'victory'
  };

  return sounds[eventType];
};
