import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { ProfileRepository } from './repositories.js';
import { settingsSchema } from './validation.js';
const count = z.number().int().min(0).max(1_000_000_000);
const colors = z.enum(['red', 'yellow', 'green', 'blue']);
const profileSchema = z.object({
  name: z.string().max(24), avatar: z.string().max(10), settings: settingsSchema,
  statistics: z.object({ wins: count, losses: count, gamesPlayed: count, winRate: z.number().min(0).max(100), unoCalls: count, cardsPlayed: count, favoriteColor: colors,
    colorCounts: z.object({ red: count, yellow: count, green: count, blue: count }) }),
  matchHistory: z.array(z.object({ id: z.string().max(100), finishedAt: z.iso.datetime(), winnerName: z.string().max(50), didWin: z.boolean(), players: z.array(z.string().max(50)).max(10), turns: count, score: count })).max(100)
});
/** A private device secret authenticates guest saves; profile IDs are not credentials. */
export const createApiRouter = (profiles: ProfileRepository) => {
  const router = Router();
  router.get('/health', (_req, res) => res.json({ ok: true, service: 'uno-server' }));
  router.use('/profile', (req, res, next) => {
    const secret = req.headers.authorization?.replace(/^Bearer /, '');
    if (!secret || !/^[a-f0-9]{64}$/.test(secret)) { res.status(401).json({ error: 'A guest session is required.' }); return; }
    res.locals.profileId = createHash('sha256').update(secret).digest('hex');
    next();
  });
  router.get('/profile', async (_req, res, next) => {
    try { res.json(await profiles.getProfile(res.locals.profileId as string)); } catch (error) { next(error); }
  });
  router.put('/profile', async (req, res, next) => {
    try {
      const data = profileSchema.parse(req.body);
      res.json(await profiles.saveProfile({ ...data, id: res.locals.profileId as string }));
    } catch (error) { next(error); }
  });
  return router;
};
