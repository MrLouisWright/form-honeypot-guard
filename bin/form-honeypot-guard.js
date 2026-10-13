#!/usr/bin/env node
import { existsSync, statSync, readFileSync } from 'node:fs';
import { checkDir } from '../src/check.js';
import { pretty } from '../src/format.js';
import { generateSecret } from '../src/server.js';

const HELP = `form-honeypot-guard: captcha-free form spam protection

Usage
  form-honeypot-guard check [dir]     audit built HTML forms (default dir: dist)
  form-honeypot-guard secret          print a new HMAC secret for FORM_GUARD_SECRET

Options
  --json             machine-readable output (check)
  --strict           treat warnings as errors (check)
  --env              print as FORM_GUARD_SECRET=... (secret)
  -h, --help         show this help
  -v, --version      show the version

Exit codes: 0 ok, 1 problems found, 2 usage or runtime error`;

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const pos = args.filter((a) => !a.startsWith('-'));
const err = (m) => { process.stderr.write(`form-honeypot-guard: ${m}\n`); process.exit(2); };

try {
  if (flag('-v') || flag('--version')) { console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version); process.exit(0); }
  if (flag('-h') || flag('--help') || !pos.length) { console.log(HELP); process.exit(pos.length || flag('-h') || flag('--help') ? 0 : 2); }
  const [cmd, dir = 'dist'] = pos;
  if (cmd === 'secret') {
    const s = generateSecret();
    console.log(flag('--env') ? `FORM_GUARD_SECRET=${s}` : s);
    process.exit(0);
  }
  if (cmd !== 'check') err(`unknown command "${cmd}" (try --help)`);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) err(`directory not found: ${dir}`);
  const results = checkDir(dir);
  if (!results.length) err(`no .html files found in ${dir}`);
  if (flag('--json')) console.log(JSON.stringify(results, null, 2));
  else console.log(pretty(results));
  const bad = results.some((r) => r.findings.some((f) => f.severity === 'error' || (flag('--strict') && f.severity === 'warn')));
  process.exit(bad ? 1 : 0);
} catch (e) {
  err(e.message);
}
