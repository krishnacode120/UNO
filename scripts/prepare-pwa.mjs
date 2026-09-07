import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/client/dist');
const paths = (await readdir(root, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name !== 'sw.js' && !entry.name.endsWith('.map'))
  .map((entry) => resolve(entry.parentPath ?? entry.path, entry.name));
const assets = paths.map((path) => '/' + path.slice(root.length + 1).replaceAll('\\', '/'));
const hash = createHash('sha256');
for (const path of paths) hash.update(await readFile(path));
const worker = await readFile(resolve(root, '../public/sw.js'), 'utf8');
hash.update(worker);
const cache = 'uno-arena-' + hash.digest('hex').slice(0, 12);
await writeFile(resolve(root, 'sw.js'), worker.replace("const CACHE = 'uno-arena-v2';", 'const CACHE = ' + JSON.stringify(cache) + ';').replace("['/', '/icon.svg', '/table-grain.svg']", JSON.stringify(['/', ...assets])));
console.log('Prepared offline shell:', cache, assets.length, 'assets');
