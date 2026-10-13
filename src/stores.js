/**
 * In-memory stores. Both implement small async interfaces so you can swap in Redis etc.
 *
 * NonceStore:     use(nonce, ttlMs) -> Promise<boolean>  (true the first time, false on replay)
 * RateLimitStore: hit(key, windowMs, limit, now) -> Promise<{ count, retryAfterMs }>
 */
export class MemoryNonceStore {
  constructor({ max = 10000 } = {}) { this.max = max; this.map = new Map(); }
  async use(nonce, ttlMs) {
    const now = Date.now();
    const exp = this.map.get(nonce);
    if (exp !== undefined && exp > now) return false;
    this.map.delete(nonce);
    this.map.set(nonce, now + ttlMs);
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value); // LRU-ish: oldest insert first
    return true;
  }
  get size() { return this.map.size; }
}

export class MemoryRateLimitStore {
  constructor({ maxKeys = 50000 } = {}) { this.maxKeys = maxKeys; this.map = new Map(); this.lastSweep = 0; }
  async hit(key, windowMs, limit, now = Date.now()) {
    if (now - this.lastSweep > windowMs) this.sweep(now, windowMs);
    const log = (this.map.get(key) || []).filter((t) => t > now - windowMs);
    log.push(now);
    this.map.delete(key);
    this.map.set(key, log);
    while (this.map.size > this.maxKeys) this.map.delete(this.map.keys().next().value);
    const count = log.length;
    // When over the limit, the client can retry once enough old hits have slid out of the window.
    const retryAfterMs = count > limit ? log[count - limit] + windowMs - now : 0;
    return { count, retryAfterMs };
  }
  sweep(now, windowMs) {
    this.lastSweep = now;
    for (const [k, log] of this.map) if (!log.length || log[log.length - 1] <= now - windowMs) this.map.delete(k);
  }
  async reset(key) { this.map.delete(key); }
}
