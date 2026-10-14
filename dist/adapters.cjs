var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/adapters.js
var adapters_exports = {};
__export(adapters_exports, {
  cloudflareKvNonceStore: () => cloudflareKvNonceStore,
  cloudflareKvRateLimitStore: () => cloudflareKvRateLimitStore,
  durableObjectNonceStore: () => durableObjectNonceStore,
  durableObjectRateLimitStore: () => durableObjectRateLimitStore,
  redisNonceStore: () => redisNonceStore,
  redisRateLimitStore: () => redisRateLimitStore,
  upstashNonceStore: () => upstashNonceStore,
  upstashRateLimitStore: () => upstashRateLimitStore
});
module.exports = __toCommonJS(adapters_exports);
function redisNonceStore(redis, { prefix = "fg:n:" } = {}) {
  return {
    async use(nonce, ttlMs) {
      return await redis.set(`${prefix}${nonce}`, "1", { NX: true, PX: ttlMs }) === "OK";
    }
  };
}
function redisRateLimitStore(redis, { prefix = "fg:rl:" } = {}) {
  return {
    async hit(key, windowMs, limit, now = Date.now()) {
      const k = `${prefix}${key}`;
      const [, , count, oldest] = await redis.multi().zRemRangeByScore(k, 0, now - windowMs).zAdd(k, { score: now, value: `${now}:${Math.random()}` }).zCard(k).zRangeWithScores(k, -(limit + 1), -(limit + 1)).exec();
      await redis.pExpire(k, windowMs);
      const retryAfterMs = count > limit && oldest?.[0] ? oldest[0].score + windowMs - now : 0;
      return { count, retryAfterMs };
    },
    async reset(key) {
      await redis.del?.(`${prefix}${key}`);
    }
  };
}
function upstashNonceStore(client, { prefix = "fg:n:" } = {}) {
  return {
    async use(nonce, ttlMs) {
      return await client.set(`${prefix}${nonce}`, "1", { nx: true, px: ttlMs }) === "OK";
    }
  };
}
function upstashRateLimitStore(client, { prefix = "fg:rl:" } = {}) {
  return {
    async hit(key, windowMs, limit, now = Date.now()) {
      const k = `${prefix}${key}:${Math.floor(now / windowMs)}`;
      const count = Number(await client.incr(k));
      if (count === 1) await client.pexpire(k, windowMs);
      const retryAfterMs = count > limit ? windowMs - now % windowMs : 0;
      return { count, retryAfterMs };
    }
  };
}
function cloudflareKvNonceStore(kv, { prefix = "fg:n:" } = {}) {
  return {
    async use(nonce, ttlMs) {
      const key = `${prefix}${nonce}`;
      if (await kv.get(key)) return false;
      await kv.put(key, "1", { expirationTtl: Math.max(1, Math.ceil(ttlMs / 1e3)) });
      return true;
    }
  };
}
function cloudflareKvRateLimitStore(kv, { prefix = "fg:rl:" } = {}) {
  return {
    async hit(key, windowMs, limit, now = Date.now()) {
      const k = `${prefix}${key}:${Math.floor(now / windowMs)}`;
      const raw = await kv.get(k);
      const count = (raw ? Number(raw) : 0) + 1;
      await kv.put(k, String(count), { expirationTtl: Math.max(1, Math.ceil(windowMs / 1e3)) });
      const retryAfterMs = count > limit ? windowMs - now % windowMs : 0;
      return { count, retryAfterMs };
    }
  };
}
function durableObjectNonceStore(storage, { prefix = "fg:n:" } = {}) {
  return cloudflareKvNonceStore(storage, { prefix });
}
function durableObjectRateLimitStore(storage, { prefix = "fg:rl:" } = {}) {
  const mem = /* @__PURE__ */ new Map();
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
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cloudflareKvNonceStore,
  cloudflareKvRateLimitStore,
  durableObjectNonceStore,
  durableObjectRateLimitStore,
  redisNonceStore,
  redisRateLimitStore,
  upstashNonceStore,
  upstashRateLimitStore
});
