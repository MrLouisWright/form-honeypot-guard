export interface NonceStore { use(nonce: string, ttlMs: number): Promise<boolean> | boolean }
export interface RateLimitStore { hit(key: string, windowMs: number, limit: number, now?: number): Promise<{ count: number; retryAfterMs: number }>; reset?(key: string): Promise<void> }

export function redisNonceStore(redis: { set(key: string, value: string, opts?: { NX?: boolean; PX?: number }): Promise<string | null> }, opts?: { prefix?: string }): NonceStore;
export function redisRateLimitStore(redis: {
  multi(): {
    zRemRangeByScore(k: string, min: number, max: number): unknown;
    zAdd(k: string, item: { score: number; value: string }): unknown;
    zCard(k: string): unknown;
    zRangeWithScores(k: string, start: number, stop: number): unknown;
    exec(): Promise<[unknown, unknown, number, Array<{ score: number }>]>;
  };
  pExpire(k: string, ms: number): Promise<unknown>;
  del?(key: string): Promise<unknown>;
}, opts?: { prefix?: string }): RateLimitStore;

export function upstashNonceStore(client: { set(key: string, value: string, opts?: { nx?: boolean; px?: number }): Promise<string | null> }, opts?: { prefix?: string }): NonceStore;
export function upstashRateLimitStore(client: { incr(key: string): Promise<number>; pexpire(key: string, ms: number): Promise<unknown> }, opts?: { prefix?: string }): RateLimitStore;

export function cloudflareKvNonceStore(kv: { get(key: string): Promise<string | null>; put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> }, opts?: { prefix?: string }): NonceStore;
export function cloudflareKvRateLimitStore(kv: { get(key: string): Promise<string | null>; put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> }, opts?: { prefix?: string }): RateLimitStore;

export function durableObjectNonceStore(storage: { get(key: string): Promise<string | undefined>; put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> }, opts?: { prefix?: string }): NonceStore;
export function durableObjectRateLimitStore(storage: { put(key: string, value: string): Promise<void> }, opts?: { prefix?: string }): RateLimitStore;
