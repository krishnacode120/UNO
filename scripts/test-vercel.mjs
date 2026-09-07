import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chromium, expect } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const client = resolve(root, 'apps/client');
const buildFrontend = (backendUrl) => {
  for (const [args, cwd] of [
    [[resolve(root, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'vercel'], client],
    [['scripts/prepare-pwa.mjs'], root]
  ]) {
    const result = spawnSync(process.execPath, args, {
      cwd, env: { ...process.env, VITE_SERVER_URL: backendUrl }, stdio: 'inherit', windowsHide: true
    });
    if (result.error || result.status !== 0) throw result.error ?? new Error('Vercel frontend build failed.');
  }
};

const app = express();
app.use(express.static(resolve(client, 'dist')));
// This host has no API, socket server, or development proxy.
const frontend = createServer(app);
await new Promise((resolve) => frontend.listen(0, '127.0.0.1', resolve));
const frontendUrl = 'http://127.0.0.1:' + frontend.address().port;
const probe = createServer();
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const backendUrl = 'http://127.0.0.1:' + port;
const backend = spawn(process.execPath, ['apps/server/dist/index.js'], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production', PORT: String(port), CLIENT_ORIGIN: frontendUrl, TRUST_PROXY_HOPS: '1', MONGODB_URI: '' },
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
});
let serverLog = '';
backend.stdout.on('data', (chunk) => { serverLog += chunk; });
backend.stderr.on('data', (chunk) => { serverLog += chunk; });
let browser;
try {
  await expect.poll(async () => {
    try { return (await fetch(backendUrl + '/api/health')).status; } catch { return 0; }
  }, { timeout: 12000 }).toBe(200);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  buildFrontend('');
  const soloContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const solo = await soloContext.newPage();
  const errors = [];
  const networkCalls = [];
  solo.on('pageerror', (error) => errors.push(error.message));
  solo.on('request', (request) => {
    if (/\/(api|socket\.io)(\/|\?)/.test(request.url())) networkCalls.push(request.url());
  });
  await solo.goto(frontendUrl);
  await expect(solo.getByRole('heading', { name: 'UNO Arena.' })).toBeVisible();
  await solo.getByRole('button', { name: /Host a table/ }).click();
  await expect(solo.getByRole('alert')).toContainText('Multiplayer is unavailable on this deployment');
  await expect(solo.getByRole('button', { name: 'Create a room' })).toBeDisabled();
  await solo.getByRole('button', { name: 'Back', exact: true }).click();
  await solo.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => solo.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await soloContext.setOffline(true);
  await solo.reload();
  await solo.getByRole('button', { name: 'Deal me in' }).click();
  await expect(solo.locator('.hand-card')).toHaveCount(7);
  await solo.screenshot({ path: 'artifacts/vercel-solo-mobile.png', fullPage: true, animations: 'disabled' });
  expect(networkCalls).toEqual([]);
  await soloContext.close();
  console.log('PASS: static Vercel solo build, offline reload, no nonexistent API/socket requests.');

  // The trailing slash exercises URL normalization used by both networking hooks.
  buildFrontend(backendUrl + '/');
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  host.on('pageerror', (error) => errors.push(error.message));
  guest.on('pageerror', (error) => errors.push(error.message));
  let save;
  host.on('response', (response) => {
    if (response.url() === backendUrl + '/api/profile' && response.request().method() === 'PUT') save = response;
  });
  await host.goto(frontendUrl);
  await expect(host.locator('.topbar-right')).toContainText('Connected');
  await expect.poll(() => save?.status(), { timeout: 10000 }).toBe(200);
  expect(save.headers()['access-control-allow-origin']).toBe(frontendUrl);
  await host.getByRole('button', { name: /Host a table/ }).click();
  await expect(host.locator('.room-code strong')).toBeVisible();
  const code = await host.locator('.room-code strong').textContent();
  await guest.goto(frontendUrl + '/?room=' + code);
  await expect(guest.getByRole('button', { name: 'Join table' })).toBeEnabled();
  await guest.getByRole('button', { name: 'Join table' }).click();
  await expect(host.locator('.lobby-list article')).toHaveCount(2);
  await host.getByRole('button', { name: 'Start the game' }).click();
  await expect(host.locator('.hand-card')).toHaveCount(7);
  await expect(guest.locator('.hand-card')).toHaveCount(7);
  const hand = await guest.locator('.hand-card button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label')));
  await guest.reload();
  await expect(guest.locator('.hand-card')).toHaveCount(7);
  expect(await guest.locator('.hand-card button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label')))).toEqual(hand);
  await host.getByRole('button', { name: 'Draw card', exact: true }).click();
  await expect(host.locator('.hand-card')).toHaveCount(8);
  await expect(guest.locator('.opponent-track .player-meta')).toContainText(['8 cards']);
  await guest.screenshot({ path: 'artifacts/vercel-multiplayer-mobile.png', fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
  expect(serverLog).not.toContain('ValidationError');
  await hostContext.close();
  await guestContext.close();
  console.log('PASS: cross-origin profile saves, room-code joins, synchronized moves, mobile hand reconnect.');
} catch (error) {
  console.error(serverLog);
  throw error;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => frontend.close(resolve));
  if (backend.exitCode === null) {
    const exited = once(backend, 'exit');
    backend.kill('SIGTERM');
    await exited;
  }
  // Do not leave a deployable bundle pointing to the test's ephemeral backend.
  buildFrontend('');
}
