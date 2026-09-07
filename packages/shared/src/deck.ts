import { PLAY_COLORS } from './constants.js';
import type { Card, CardType } from './types.js';

let cardSequence = 0;

const nextCardId = (prefix: string) => `${prefix}-${cardSequence++}`;

export const createStandardDeck = (): Card[] => {
  cardSequence = 0;
  const deck: Card[] = [];

  for (const color of PLAY_COLORS) {
    deck.push({ id: nextCardId(`${color}-0`), color, type: 'number', value: 0 });

    for (let copy = 0; copy < 2; copy++) {
      for (let value = 1; value <= 9; value++) {
        deck.push({ id: nextCardId(`${color}-${value}`), color, type: 'number', value });
      }

      for (const type of ['skip', 'reverse', 'drawTwo'] as const satisfies CardType[]) {
        deck.push({ id: nextCardId(`${color}-${type}`), color, type });
      }
    }
  }

  for (let copy = 0; copy < 4; copy++) {
    deck.push({ id: nextCardId('wild'), color: 'wild', type: 'wild' });
    deck.push({ id: nextCardId('wildDrawFour'), color: 'wild', type: 'wildDrawFour' });
  }

  return deck;
};

export const shuffleCards = <T>(cards: T[], random: () => number = Math.random): T[] => {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
};

export const createSeededRandom = (seedText: string): (() => number) => {
  let seed = 2166136261;

  for (let index = 0; index < seedText.length; index++) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

export const getCardLabel = (card: Card): string => {
  if (card.hidden) {
    return 'Hidden card';
  }

  if (card.type === 'number') {
    return `${card.color} ${card.value}`;
  }

  return (card.color === 'wild' ? '' : card.color + ' ') + card.type.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
};
