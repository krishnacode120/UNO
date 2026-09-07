import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { chromium, expect } from '@playwright/test';
const probe = createServer();
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const url = 'http://127.0.0.1:' + port;
const child = spawn(process.execPath, ['apps/server/dist/index.js'], { env: { ...process.env, PORT: String(port), NODE_ENV: 'production', MONGODB_URI: '' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let log = '';
child.stdout.on('data', (chunk) => { log += chunk; });
child.stderr.on('data', (chunk) => { log += chunk; });
let browser;
let page;
try {
  await expect.poll(async () => { try { return (await fetch(url + '/api/health')).status; } catch { return 0; } }, { timeout: 12000 }).toBe(200);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => { errors.push(error.message); console.error('PAGE:', error.message); });
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'UNO Arena.' })).toBeVisible();
  await expect(page.locator('.topbar-right')).toContainText('Connected');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const assets = await page.evaluate(async () => { const names = await caches.keys(); return (await (await caches.open(names.find((key) => key.startsWith('uno-arena-')))).keys()).map((request) => request.url); });
  expect(assets.some((asset) => asset.includes('/assets/') && asset.endsWith('.js'))).toBe(true);
  const cachedScripts = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names.find((key) => key.startsWith('uno-arena-')));
    const requests = await cache.keys();
    return Promise.all(requests.filter((request) => request.url.endsWith('.js')).map(async (request) => {
      const withOrigin = new Request(request.url, { headers: { Origin: location.origin } });
      return { vary: (await cache.match(request)).headers.get('vary'), originMatch: !!await cache.match(withOrigin) };
    }));
  });
  expect(cachedScripts.every((script) => script.vary === null && script.originMatch)).toBe(true);
  expect((await context.request.get(url + '/api/profile')).status()).toBe(401);
  const authorization = 'Bearer ' + 'a'.repeat(64);
  const profile = await (await context.request.get(url + '/api/profile', { headers: { authorization } })).json();
  expect((await context.request.put(url + '/api/profile', { headers: { authorization }, data: { ...profile, name: 'Production tester' } })).status()).toBe(200);
  expect((await context.request.put(url + '/api/profile', { headers: { authorization }, data: { ...profile, settings: { ...profile.settings, turnTimerSeconds: -1 } } })).status()).toBe(400);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'UNO Arena.' })).toBeVisible();
  await page.getByRole('button', { name: 'Deal me in' }).click();
  await expect(page.locator('.hand-card')).toHaveCount(7);
  await page.screenshot({ path: 'artifacts/offline-mobile.png', animations: 'disabled', fullPage: true });
  expect(errors).toEqual([]);
  console.log('Production smoke passed: static bundle, sockets, authenticated saves, input validation, complete offline shell, offline solo.');
} catch (error) {
  if (page) {
    console.error('URL:', page.url(), 'DOM:', await page.locator('body').innerText());
    await page.screenshot({ path: 'artifacts/production-failure.png', fullPage: true });
  }
  console.error(log); throw error;
} finally {
  if (browser) await browser.close();
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await exited;
}
