import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redisNonceStore, redisRateLimitStore, upstashRateLimitStore, cloudflareKvRateLimitStore } from '../src/adapters.js';

test('redisNonceStore uses SET NX', async () => {
  const mem = new Map();
  const redis = {
    async set(key, val, opts) {
      if (opts?.NX && mem.has(key)) return null;
      mem.set(key, val);
      return 'OK';
    },
  };
  const store = redisNonceStore(redis);
  assert.equal(await store.use('n1', 1000), true);
  assert.equal(await store.use('n1', 1000), false);
});

test('redisRateLimitStore sliding window', async () => {
  const z = new Map();
  const redis = {
    multi() {
      const ops = [];
      return {
        zRemRangeByScore(k, a, b) { ops.push(['zrem', k, a, b]); return this; },
        zAdd(k, item) {
          const log = z.get(k) || [];
          log.push(item.score);
          z.set(k, log);
          ops.push(['zadd', k]);
          return this;
        },
        zCard(k) { ops.push(['card', k]); return this; },
        zRangeWithScores(k, s, e) { ops.push(['range', k]); return this; },
        async exec() {
          const k = 'fg:rl:a';
          const log = (z.get(k) || []).filter((t) => t > 0);
          log.push(1000);
          z.set(k, log);
          return [null, null, log.length, [{ score: log[0] || 0 }]];
        },
      };
    },
    async pExpire() {},
  };
  const store = redisRateLimitStore(redis);
  const r = await store.hit('a', 10_000, 5, 1000);
  assert.ok(r.count >= 1);
  assert.ok(typeof r.retryAfterMs === 'number');
});

test('upstash and KV fixed-window counters increment', async () => {
  const counts = new Map();
  const upstash = {
    async incr(k) {
      counts.set(k, (counts.get(k) || 0) + 1);
      return counts.get(k);
    },
    async pexpire() {},
  };
  const u = upstashRateLimitStore(upstash);
  assert.equal((await u.hit('x', 60_000, 3, 1_000_000)).count, 1);
  assert.equal((await u.hit('x', 60_000, 3, 1_000_000)).count, 2);

  const kvStore = new Map();
  const kv = {
    async get(k) { return kvStore.get(k) ?? null; },
    async put(k, v) { kvStore.set(k, v); },
  };
  const kvRl = cloudflareKvRateLimitStore(kv);
  assert.equal((await kvRl.hit('y', 60_000, 2, 2_000_000)).count, 1);
});
