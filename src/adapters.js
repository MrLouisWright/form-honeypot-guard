/**
 * Distributed store adapters — pass your own Redis / Upstash / Cloudflare clients (zero bundled deps).
 *
 * @typedef {import('./stores.js').NonceStore} NonceStore
 * @typedef {import('./stores.js').RateLimitStore} RateLimitStore
 */

/** @param {{ set(key: string, value: string, opts?: { NX?: boolean, PX?: number }): Promise<string|null> }} redis */
export function redisNonceStore(redis, { prefix = 'fg:n:' } = {}) {
  return {
    async use(nonce, ttlMs) {
      return (await redis.set(`${prefix}${nonce}`, '1', { NX: true, PX: ttlMs })) === 'OK';
    },
  };
}

/** @param {{ multi(): { zRemRangeByScore(k: string, min: number, max: number): unknown, zAdd(k: string, item: { score: number, value: string }): unknown, zCard(k: string): unknown, zRangeWithScores(k: string, start: number, stop: number): unknown, exec(): Promise<[unknown, unknown, number, Array<{ score: number }>]> }, pExpire(k: string, ms: number): Promise<unknown> }} redis */
export function redisRateLimitStore(redis, { prefix = 'fg:rl:' } = {}) {
  return {
    async hit(key, windowMs, limit, now = Date.now()) {
      const k = `${prefix}${key}`;
      const [, , count, oldest] = await redis.multi()
        .zRemRangeByScore(k, 0, now - windowMs)
        .zAdd(k, { score: now, value: `${now}:${Math.random()}` })
        .zCard(k)
        .zRangeWithScores(k, -(limit + 1), -(limit + 1))
        .exec();
      await redis.pExpire(k, windowMs);
      const retryAfterMs = count > limit && oldest?.[0] ? oldest[0].score + windowMs - now : 0;
      return { count, retryAfterMs };
    },
    async reset(key) {
      await redis.del?.(`${prefix}${key}`);
    },
  };
}

/**
 * @param {{ set(key: string, value: string, opts?: { nx?: boolean, px?: number }): Promise<string|null> }} client Upstash Redis REST client
 */
export function upstashNonceStore(client, { prefix = 'fg:n:' } = {}) {
  return {
    async use(nonce, ttlMs) {
      return (await client.set(`${prefix}${nonce}`, '1', { nx: true, px: ttlMs })) === 'OK';
    },
  };
}

/** Fixed-window counter (Upstash `@upstash/redis` REST client with `incr` / `pexpire`). */
export function upstashRateLimitStore(client, { prefix = 'fg:rl:' } = {}) {
  return {
    async hit(key, windowMs, limit, now = Date.now()) {
      const k = `${prefix}${key}:${Math.floor(now / windowMs)}`;
      const count = Number(await client.incr(k));
      if (count === 1) await client.pexpire(k, windowMs);
      const retryAfterMs = count > limit ? windowMs - (now % windowMs) : 0;
      return { count, retryAfterMs };
    },
  };
}

/**
 * Cloudflare Workers KV (best-effort replay protection; use Durable Objects for strict atomicity).
 * @param {{ get(key: string): Promise<string|null>, put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> }} kv
 */
export function cloudflareKvNonceStore(kv, { prefix = 'fg:n:' } = {}) {
  return {
    async use(nonce, ttlMs) {
      const key = `${prefix}${nonce}`;
      if (await kv.get(key)) return false;
      await kv.put(key, '1', { expirationTtl: Math.max(1, Math.ceil(ttlMs / 1000)) });
      return true;
    },
  };
}

/** KV rate limit: increment a counter key with TTL (fixed window; lighter than a true sliding window). */
export function cloudflareKvRateLimitStore(kv, { prefix = 'fg:rl:' } = {}) {
  return {
    async hit(key, windowMs, limit, now = Date.now()) {
      const k = `${prefix}${key}:${Math.floor(now / windowMs)}`;
      const raw = await kv.get(k);
      const count = (raw ? Number(raw) : 0) + 1;
      await kv.put(k, String(count), { expirationTtl: Math.max(1, Math.ceil(windowMs / 1000)) });
      const retryAfterMs = count > limit ? windowMs - (now % windowMs) : 0;
      return { count, retryAfterMs };
    },
  };
}

/**
 * Durable Object storage (or any async key/value with optional TTL seconds).
 * @param {{ get(key: string): Promise<string|undefined>, put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> }} storage
 */
export function durableObjectNonceStore(storage, { prefix = 'fg:n:' } = {}) {
  return cloudflareKvNonceStore(storage, { prefix });
}

/** In-memory sliding window inside a Durable Object (single-threaded, no races). */
export function durableObjectRateLimitStore(storage, { prefix = 'fg:rl:' } = {}) {
  const mem = new Map();
  return {
    async hit(key, windowMs, limit, now = Date.now()) {
      const k = `${prefix}${key}`;
      const log = (mem.get(k) || []).filter((t) => t > now - windowMs);
      log.push(now);
      mem.set(k, log);
      await storage.put(k, JSON.stringify(log));
      const count = log.length;
      const retryAfterMs = count > limit ? log[count - limit] + windowMs - now : 0;
      return { count, retryAfterMs };
    },
  };
}
