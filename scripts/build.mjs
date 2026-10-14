import esbuild from 'esbuild';
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');

mkdirSync(dist, { recursive: true });

const entries = [
  'index.js',
  'check.js',
  'client.js',
  'adapters.js',
  'pow.js',
  'middleware.js',
  'sveltekit.js',
  'remix.js',
  'astro.js',
  'react.js',
];

await esbuild.build({
  entryPoints: entries.map((e) => join(root, 'src', e)),
  outdir: dist,
  outExtension: { '.js': '.cjs' },
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  bundle: true,
  external: ['react', 'vite', 'webpack', 'node:*'],
  logLevel: 'info',
});

for (const f of readdirSync(join(root, 'src')).filter((n) => n.endsWith('.d.ts'))) {
  cpSync(join(root, 'src', f), join(dist, f));
}

console.log('CJS build → dist/*.cjs, types → dist/*.d.ts');
