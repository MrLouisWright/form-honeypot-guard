import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, MemoryRateLimitStore, MemoryNonceStore } from '../src/index.js';

test('sliding window allows limit then blocks with retryAfter', async () => {
  const rl = createRateLimiter({ limit: 3, windowMs: 10_000 });
  const t = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal((await rl.check('a', t + i * 1000)).ok, true);
  const blocked = await rl.check('a', t + 3000);
  assert.equal(blocked.ok, false); assert.equal(blocked.retryAfter, 8); // 2nd hit (t+1000) must leave the window
  assert.equal((await rl.check('b', t + 3000)).ok, true, 'keys are independent');
  assert.equal((await rl.check('a', t + 25_000)).ok, true, 'window slides');
});

test('memory store sweeps idle keys and caps size', async () => {
  const s = new MemoryRateLimitStore({ maxKeys: 2 });
  await s.hit('x', 1000, 5, 0); await s.hit('y', 1000, 5, 0); await s.hit('z', 1000, 5, 0);
  assert.equal(s.map.size, 2);
  await s.hit('q', 1000, 5, 5000);
  assert.deepEqual([...s.map.keys()], ['q']);
});

test('nonce store detects reuse and evicts oldest', async () => {
  const n = new MemoryNonceStore({ max: 2 });
  assert.equal(await n.use('a', 1000), true);
  assert.equal(await n.use('a', 1000), false);
  await n.use('b', 1000); await n.use('c', 1000);
  assert.equal(n.size, 2);
});
