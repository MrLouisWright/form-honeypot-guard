import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkHtml } from '../src/check.js';

const bin = new URL('../bin/form-honeypot-guard.js', import.meta.url).pathname;
const cli = (...a) => spawnSync(process.execPath, [bin, ...a], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
const ids = (html) => checkHtml(html).findings.map((f) => f.id).sort();

test('check rules', () => {
  assert.deepEqual(ids('<form method="post" action="/c"><input name="email"></form>'), ['fg/no-csrf', 'fg/no-honeypot']);
  assert.deepEqual(ids('<form action="/s"><input name="email" type="email"><input name="name"></form>'), ['fg/get-personal-data']);
  assert.deepEqual(ids('<form action="/s"><input name="q"></form>'), []);
  assert.deepEqual(ids('<form method="post"><input name="_csrf" type="hidden"><input name="website" style="display:none"></form>'), ['fg/honeypot-display-none', 'fg/no-action', 'fg/no-honeypot']);
  assert.deepEqual(ids('<form method="post" action="/c" data-fg-guarded><div aria-hidden="true"><input name="website_url_ab12" tabindex="-1" autocomplete="off"></div><input name="csrf_token" type="hidden"></form>'), []);
  assert.deepEqual(ids('<form method="post" action="/c" data-fg-guarded><div aria-hidden="true"><input name="website_url_ab12"></div><input name="csrf" type="hidden"></form>'), ['fg/honeypot-focusable']);
  assert.deepEqual(ids('<script data-form-guard="{}"></script><form data-guard method="post" action="/c"><input name="csrf" type="hidden"></form>'), ['fg/runtime-only']);
});

test('CLI exit codes and output style', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fg-cli-'));
  writeFileSync(join(dir, 'bad.html'), '<form method="post" action="/c"><input name="email"></form>');
  let r = cli('check', dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /✖ error No form without a honeypot|✖ error POST form without a honeypot \[fg\/no-honeypot\]/);
  assert.match(r.stdout, /⚠ warn  No CSRF token field \[fg\/no-csrf\]/);
  assert.match(r.stdout, /\n {10}fix: /);
  assert.doesNotMatch(r.stdout, /\x1b\[/, 'NO_COLOR respected');
  writeFileSync(join(dir, 'bad.html'), '<form method="post" action="/c" data-fg-guarded><div aria-hidden="true"><input name="website_url_ab12" tabindex="-1" autocomplete="off"></div><input name="csrf" type="hidden"></form>');
  assert.equal(cli('check', dir).status, 0);
  assert.equal(JSON.parse(cli('check', dir, '--json').stdout)[0].forms, 1);
  assert.equal(cli('check', join(dir, 'missing')).status, 2);
  assert.equal(cli('frobnicate').status, 2);
  assert.equal(cli().status, 2);
  assert.equal(cli('--help').status, 0);
  r = cli('secret', '--env');
  assert.equal(r.status, 0); assert.match(r.stdout, /^FORM_GUARD_SECRET=[\w-]{43}\n$/);
});
