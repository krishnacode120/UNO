import { z } from 'zod';

export const settingsSchema = z.object({
  stackDrawTwo: z.boolean(), stackDrawFour: z.boolean(), jumpIn: z.boolean(), sevenZero: z.boolean(), forcePlay: z.boolean(),
  turnTimerSeconds: z.number().int().min(0).max(120), aiDifficulty: z.enum(['easy', 'medium', 'hard']),
  theme: z.enum(['classic', 'midnight', 'neon', 'paper']), musicVolume: z.number().min(0).max(1),
  soundVolume: z.number().min(0).max(1), reducedMotion: z.boolean(), highContrast: z.boolean()
});
const playerId = z.string().max(100);
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PLAY_CARD'), playerId, cardId: z.string().max(100), chosenColor: z.enum(['red', 'yellow', 'green', 'blue']).optional(), targetPlayerId: playerId.optional() }),
  z.object({ type: z.literal('DRAW_CARD'), playerId }),
  z.object({ type: z.literal('PASS_TURN'), playerId }),
  z.object({ type: z.literal('CALL_UNO'), playerId }),
  z.object({ type: z.literal('CATCH_UNO'), playerId, targetPlayerId: playerId })
]);
