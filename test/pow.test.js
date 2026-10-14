import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPowChallengeWithSolution,
  encodePowPayload,
  solvePowChallenge,
  verifyPow,
  verify,
  jsProof,
  createToken,
  MemoryNonceStore,
} from '../src/index.js';

const now = Date.now();
const baseFields = (extra = {}) => {
  const t = createToken({}, now - 5000);
  return {
    name: 'Ada',
    email: 'ada@example.com',
    message: 'Hello',
    website_url: '',
    fg_token: t,
    fg_js: jsProof(t),
    fg_sig: '2.1.1.5000',
    ...extra,
  };
};

test('pow challenge solves and verifies', () => {
  const ch = createPowChallengeWithSolution({ pow: { maxnumber: 5000 } }, now);
  const num = solvePowChallenge(ch);
  assert.equal(typeof num, 'number');
  const payload = encodePowPayload(ch, num);
  assert.equal(verifyPow(payload, { pow: true, now }).ok, true);
});

test('pow missing fails when required', async () => {
  const r = await verify(baseFields(), { pow: true, nonceStore: new MemoryNonceStore(), now });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes('pow-missing'));
});

test('pow soft when missing adds score but may still pass', async () => {
  const r = await verify(baseFields(), { pow: { require: 'soft' }, nonceStore: new MemoryNonceStore(), now });
  assert.equal(r.ok, true);
  assert.ok(r.reasons.includes('pow-missing'));
});

test('valid pow passes full verify', async () => {
  const ch = createPowChallengeWithSolution({ pow: { maxnumber: 2000 } }, now);
  const payload = encodePowPayload(ch, solvePowChallenge(ch));
  const r = await verify(baseFields({ fg_pow: payload }), { pow: true, nonceStore: new MemoryNonceStore(), now });
  assert.equal(r.ok, true);
});

test('tampered pow payload fails', () => {
  const ch = createPowChallengeWithSolution({ pow: true }, now);
  const payload = encodePowPayload(ch, solvePowChallenge(ch)).replace(/.$/, 'x');
  assert.equal(verifyPow(payload, { pow: true, now }).ok, false);
});
