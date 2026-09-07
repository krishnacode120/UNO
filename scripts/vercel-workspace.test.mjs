import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

test('server-root deployment builds static Vite output, not an Express function', async () => {
  const config = await json('apps/server/vercel.json');
  assert.equal(config.framework, 'vite');
  assert.equal(config.installCommand, 'node ../../scripts/vercel-workspace.mjs install');
  assert.equal(config.buildCommand, 'npm run build:vercel');
  assert.equal(config.outputDirectory, 'vercel-dist');
  assert.equal((await json('apps/server/package.json')).scripts['build:vercel'], 'node ../../scripts/vercel-workspace.mjs build');
});

test('both deployment roots preserve the same offline and security headers', async () => {
  assert.deepEqual((await json('vercel.json')).headers, (await json('apps/server/vercel.json')).headers);
});

test('the server-root output contains exactly the complete frontend build', async () => {
  const source = resolve(root, 'apps/client/dist');
  const output = resolve(root, 'apps/server/vercel-dist');
  const files = (await readdir(source, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath ?? entry.path, entry.name).slice(source.length + 1))
    .sort();
  const published = (await readdir(output, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath ?? entry.path, entry.name).slice(output.length + 1))
    .sort();
  assert.deepEqual(published, files);
  for (const path of files) assert.deepEqual(await readFile(resolve(output, path)), await readFile(resolve(source, path)), path);
  assert.ok(files.includes('index.html'));
  assert.ok(files.includes('manifest.webmanifest'));
  assert.ok(files.some((path) => path.endsWith('.js') && path !== 'sw.js'));
  assert.match(await readFile(resolve(output, 'sw.js'), 'utf8'), /uno-arena-[a-f0-9]{12}/);
});
