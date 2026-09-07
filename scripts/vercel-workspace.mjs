import { spawnSync } from 'node:child_process';
import { cp, rm } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env };
// npm may inherit the selected server workspace from the hosting build command.
for (const key of Object.keys(env)) {
  if (/^npm_config_(workspace|workspaces|include_workspace_root)$/i.test(key)) delete env[key];
}
const runNpm = (args) => {
  const windows = process.platform === 'win32';
  // Windows needs npm.cmd through a shell; these arguments are fixed below.
  const result = spawnSync(windows ? ['npm', ...args].join(' ') : 'npm', windows ? [] : args, {
    cwd: root, env, stdio: 'inherit', shell: windows, windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

switch (process.argv[2]) {
  case 'install':
    runNpm(['ci', '--include=dev', '--workspaces', '--include-workspace-root']);
    break;
  case 'build': {
    runNpm(['run', 'build:vercel']);
    const output = resolve(root, 'apps/server/vercel-dist');
    const relativeOutput = relative(root, output);
    if (!relativeOutput || relativeOutput.startsWith('..') || isAbsolute(relativeOutput)) {
      throw new Error('Refusing to clean an output directory outside the repository.');
    }
    await rm(output, { recursive: true, force: true });
    await cp(resolve(root, 'apps/client/dist'), output, { recursive: true });
    console.info('[vercel] Static frontend prepared in apps/server/vercel-dist.');
    break;
  }
  default:
    throw new Error('Usage: node scripts/vercel-workspace.mjs install|build');
}
