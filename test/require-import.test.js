import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));

test('ESM import main and subpaths', async () => {
  const mod = await import('form-honeypot-guard');
  assert.equal(typeof mod.verify, 'function');
  assert.equal(typeof mod.redisNonceStore, 'function');
  const client = await import('form-honeypot-guard/client');
  assert.equal(typeof client.init, 'function');
});

test('CJS require main and subpaths', () => {
  const mod = require('form-honeypot-guard');
  assert.equal(typeof mod.verify, 'function');
  assert.equal(typeof mod.createPowChallenge, 'function');
  assert.equal(typeof mod.sveltekitHandle, 'function');
  const adapters = require('form-honeypot-guard/adapters');
  assert.equal(typeof adapters.cloudflareKvNonceStore, 'function');
  const check = require('form-honeypot-guard/check');
  assert.equal(typeof check.checkHtml, 'function');
});
