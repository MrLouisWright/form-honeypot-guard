import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });

/** Copy hand-authored declarations; validate they parse with TypeScript. */
for (const f of readdirSync(join(root, 'src')).filter((n) => n.endsWith('.d.ts'))) {
  cpSync(join(root, 'src', f), join(dist, f));
}

try {
  execSync('npx tsc -p tsconfig.types.json --pretty false', { cwd: root, stdio: 'pipe' });
} catch (e) {
  console.error(String(e.stdout || e.stderr || e.message));
  process.exit(1);
}

writeFileSync(join(dist, '.generated'), `${new Date().toISOString()}\n`);
console.log('Types synced to dist/');
