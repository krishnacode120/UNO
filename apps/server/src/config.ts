import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

const envPath = resolve(process.cwd(), 'apps/server/.env');
dotenv.config(existsSync(envPath) ? { path: envPath } : undefined);

export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mongodbUri: process.env.MONGODB_URI?.trim() || undefined
};
