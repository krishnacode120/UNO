import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5173/icon.svg');
for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.locator('svg').evaluate((svg, size) => { svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size)); }, size);
  await page.locator('svg').screenshot({ path: resolve('apps/client/public/icon-' + size + '.png'), omitBackground: true });
}
await browser.close();
console.log('Generated 192px and 512px mobile icons.');
