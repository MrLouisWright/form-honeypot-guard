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

// src/index.js
var index_exports = {};
__export(index_exports, {
  DEFAULTS: () => DEFAULTS,
  DEFAULT_FIELDS: () => DEFAULT_FIELDS,
  HARD_REASONS: () => HARD_REASONS,
  MemoryNonceStore: () => MemoryNonceStore,
  MemoryRateLimitStore: () => MemoryRateLimitStore,
  astroGet: () => astroGet,
  astroPost: () => astroPost,
  astroRoute: () => astroRoute,
  checkContent: () => checkContent,
  cleanFields: () => cleanFields,
  clientIp: () => clientIp,
  cloudflareKvNonceStore: () => cloudflareKvNonceStore,
  cloudflareKvRateLimitStore: () => cloudflareKvRateLimitStore,
  connectGuard: () => connectGuard,
  createFetchGuard: () => createFetchGuard,
  createGuard: () => createGuard,
  createPowChallenge: () => createPowChallenge,
  createPowChallengeWithSolution: () => createPowChallengeWithSolution,
  createRateLimiter: () => createRateLimiter,
  createToken: () => createToken,
  durableObjectNonceStore: () => durableObjectNonceStore,
  durableObjectRateLimitStore: () => durableObjectRateLimitStore,
  encodePowPayload: () => encodePowPayload,
  expressGuard: () => expressGuard,
  fastifyGuard: () => fastifyGuard,
  generateSecret: () => generateSecret,
  getSecret: () => getSecret,
  issueFields: () => issueFields,
  jsProof: () => jsProof,
  loadManifest: () => loadManifest,
  nextRoute: () => nextRoute,
  parseToken: () => parseToken,
  redisNonceStore: () => redisNonceStore,
  redisRateLimitStore: () => redisRateLimitStore,
  remixAction: () => remixAction,
  remixTokenLoader: () => remixTokenLoader,
  resolveOptions: () => resolveOptions,
  resolvePow: () => resolvePow,
  solvePowChallenge: () => solvePowChallenge,
  sveltekitAction: () => sveltekitAction,
  sveltekitHandle: () => sveltekitHandle,
  toFields: () => toFields,
  upstashNonceStore: () => upstashNonceStore,
  upstashRateLimitStore: () => upstashRateLimitStore,
  verify: () => verify,
  verifyPow: () => verifyPow,
  withFormGuard: () => withFormGuard,
  withFormGuardApi: () => withFormGuardApi
});
module.exports = __toCommonJS(index_exports);

// src/server.js
var import_node_crypto4 = require("node:crypto");
var import_node_fs = require("node:fs");

// src/stores.js
var MemoryNonceStore = class {
  constructor({ max = 1e4 } = {}) {
    this.max = max;
    this.map = /* @__PURE__ */ new Map();
  }
  async use(nonce, ttlMs) {
    const now = Date.now();
    const exp = this.map.get(nonce);
    if (exp !== void 0 && exp > now) return false;
    this.map.delete(nonce);
    this.map.set(nonce, now + ttlMs);
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
    return true;
  }
  get size() {
    return this.map.size;
  }
};
var MemoryRateLimitStore = class {
  constructor({ maxKeys = 5e4 } = {}) {
    this.maxKeys = maxKeys;
    this.map = /* @__PURE__ */ new Map();
    this.lastSweep = 0;
  }
  async hit(key, windowMs, limit, now = Date.now()) {
    if (now - this.lastSweep > windowMs) this.sweep(now, windowMs);
    const log = (this.map.get(key) || []).filter((t) => t > now - windowMs);
    log.push(now);
    this.map.delete(key);
    this.map.set(key, log);
    while (this.map.size > this.maxKeys) this.map.delete(this.map.keys().next().value);
    const count = log.length;
    const retryAfterMs = count > limit ? log[count - limit] + windowMs - now : 0;
    return { count, retryAfterMs };
  }
  sweep(now, windowMs) {
    this.lastSweep = now;
    for (const [k, log] of this.map) if (!log.length || log[log.length - 1] <= now - windowMs) this.map.delete(k);
  }
  async reset(key) {
    this.map.delete(key);
  }
};

// src/content.js
var DEFAULT_KEYWORDS = ["viagra", "cialis", "casino", "crypto investment", "bitcoin profit", "seo services", "backlinks", "payday loan", "forex signals", "escort", "replica watches", "rank your website", "guest post"];
var NAME_FIELDS = ["name", "first_name", "firstname", "last_name", "lastname", "full_name", "fullname", "fname", "lname"];
var URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+|\[url=|<a\s+href/gi;
function checkContent(fields, opts = {}) {
  const { maxLinks = 2, nameFields = NAME_FIELDS, keywords = DEFAULT_KEYWORDS, scripts = null, scriptRatio = 0.3, ignore = [] } = opts;
  const out = [];
  const entries = Object.entries(fields).filter(([k, v]) => typeof v === "string" && !ignore.includes(k));
  const text = entries.map(([, v]) => v).join("\n");
  const links = (text.match(URL_RE) || []).length;
  if (links > maxLinks) out.push({ reason: "content-links", weight: Math.min(4, links - maxLinks + 1) });
  if (entries.some(([k, v]) => nameFields.includes(k.toLowerCase()) && /https?:\/\/|www\.|\.(com|net|ru|xyz|top)\b/i.test(v))) out.push({ reason: "content-url-in-name", weight: 4 });
  const lower = text.toLowerCase();
  const hits = keywords.filter((w) => lower.includes(String(w).toLowerCase())).length;
  if (hits) out.push({ reason: "content-keywords", weight: Math.min(5, hits * 2) });
  if (scripts && scripts.length) {
    const letters = text.match(new RegExp("\\p{L}", "gu")) || [];
    if (letters.length >= 10) {
      const allowed = new RegExp(`[${scripts.map((s) => `\\p{Script=${s}}`).join("")}]`, "u");
      const foreign = letters.filter((ch) => !allowed.test(ch)).length;
      if (foreign / letters.length > scriptRatio) out.push({ reason: "content-charset", weight: 3 });
    }
  }
  return out;
}

// src/constants.js
var DEFAULT_FIELDS = Object.freeze({ honeypot: "website_url", token: "fg_token", js: "fg_js", signals: "fg_sig", pow: "fg_pow" });
var DEFAULTS = Object.freeze({
  secretEnv: "FORM_GUARD_SECRET",
  minTime: 3e3,
  maxAge: 2 * 60 * 60 * 1e3,
  requireToken: true,
  requireJs: true,
  minInteractions: 1,
  threshold: 5,
  content: {},
  tokenEndpoint: "/__form-guard/token"
});

// src/secret.js
var import_node_crypto = require("node:crypto");
var b64u = (buf) => Buffer.from(buf).toString("base64url");
function getSecret(o = {}) {
  const s = o.secret ?? process.env[o.secretEnv || DEFAULTS.secretEnv];
  if (!s || String(s).length < 16) {
    throw new Error(`form-honeypot-guard: set a secret of at least 16 chars in $${o.secretEnv || DEFAULTS.secretEnv} (generate one with: npx form-honeypot-guard secret)`);
  }
  return String(s);
}
var generateSecret = (bytes = 32) => b64u((0, import_node_crypto.randomBytes)(bytes));
var signPayload = (secret, data) => b64u((0, import_node_crypto.createHmac)("sha256", secret).update(data).digest());

// src/pow.js
var import_node_crypto2 = require("node:crypto");
var import_node_crypto3 = require("node:crypto");
var b64u2 = (buf) => Buffer.from(buf).toString("base64url");
var b64uJson = (o) => b64u2(Buffer.from(JSON.stringify(o), "utf8"));
var parseB64uJson = (s) => JSON.parse(Buffer.from(String(s || ""), "base64url").toString("utf8"));
function resolvePow(opts = {}) {
  if (!opts.pow) return null;
  const p = opts.pow === true ? {} : opts.pow;
  return {
    maxnumber: p.maxnumber ?? 1e5,
    require: p.require ?? true,
    field: p.field
  };
}
function createPowChallenge(opts = {}, now = Date.now()) {
  const pow = resolvePow(opts);
  if (!pow) return null;
  const secret = getSecret(opts);
  const salt = b64u2((0, import_node_crypto3.randomBytes)(12));
  const maxnumber = pow.maxnumber;
  const algorithm = "SHA-256";
  const number = Math.floor(Math.random() * (maxnumber + 1));
  const challenge = (0, import_node_crypto2.createHash)("sha256").update(salt + number).digest("hex");
  const issuedAt = now;
  const sigPayload = `${algorithm}|${challenge}|${maxnumber}|${salt}|${issuedAt}`;
  const signature = signPayload(secret, sigPayload);
  return { algorithm, challenge, maxnumber, salt, signature, issuedAt };
}
function createPowChallengeWithSolution(opts = {}, now = Date.now()) {
  const pow = resolvePow(opts);
  if (!pow) return null;
  const secret = getSecret(opts);
  const salt = b64u2((0, import_node_crypto3.randomBytes)(12));
  const maxnumber = pow.maxnumber;
  const algorithm = "SHA-256";
  const number = Math.floor(Math.random() * (maxnumber + 1));
  const challenge = (0, import_node_crypto2.createHash)("sha256").update(salt + number).digest("hex");
  const issuedAt = now;
  const sigPayload = `${algorithm}|${challenge}|${maxnumber}|${salt}|${issuedAt}`;
  const signature = signPayload(secret, sigPayload);
  return { algorithm, challenge, maxnumber, salt, signature, issuedAt, number };
}
function solvePowChallenge(challenge, { batchSize = 5e3, onProgress } = {}) {
  if (!challenge) return null;
  const { algorithm, challenge: target, maxnumber, salt } = challenge;
  if (algorithm !== "SHA-256") return null;
  for (let start = 0; start <= maxnumber; start += batchSize) {
    const end = Math.min(start + batchSize - 1, maxnumber);
    for (let n = start; n <= end; n++) {
      const h = (0, import_node_crypto2.createHash)("sha256").update(salt + n).digest("hex");
      if (h === target) return n;
    }
    onProgress?.({ done: end + 1, total: maxnumber + 1 });
  }
  return null;
}
function encodePowPayload(challenge, number) {
  const { algorithm, challenge: ch, maxnumber, salt, signature, issuedAt } = challenge;
  return b64uJson({ algorithm, challenge: ch, maxnumber, salt, signature, issuedAt, number });
}
function verifyPow(payload, opts = {}, now = opts.now ?? Date.now()) {
  const pow = resolvePow(opts);
  if (!pow) return { ok: true, skipped: true };
  if (!payload) {
    if (pow.require === true) return { ok: false, reason: "pow-missing" };
    if (pow.require === "soft") return { ok: true, reason: "pow-missing", soft: true };
    return { ok: true, skipped: true };
  }
  let data;
  try {
    data = parseB64uJson(payload);
  } catch {
    return { ok: false, reason: "pow-invalid" };
  }
  const { algorithm, challenge, maxnumber, salt, signature, issuedAt, number } = data;
  if (algorithm !== "SHA-256" || typeof challenge !== "string" || typeof salt !== "string") {
    return { ok: false, reason: "pow-invalid" };
  }
  if (typeof number !== "number" || number < 0 || number > maxnumber) return { ok: false, reason: "pow-invalid" };
  const secret = getSecret(opts);
  const sigPayload = `${algorithm}|${challenge}|${maxnumber}|${salt}|${issuedAt}`;
  const expectedSig = signPayload(secret, sigPayload);
  const got = Buffer.from(String(signature || ""));
  const exp = Buffer.from(expectedSig);
  if (exp.length !== got.length || !(0, import_node_crypto2.timingSafeEqual)(exp, got)) return { ok: false, reason: "pow-invalid" };
  const maxAge = opts.powMaxAge ?? opts.maxAge ?? 2 * 60 * 60 * 1e3;
  if (typeof issuedAt !== "number" || now - issuedAt > maxAge || now - issuedAt < 0) {
    return { ok: false, reason: "pow-expired" };
  }
  const h = (0, import_node_crypto2.createHash)("sha256").update(salt + number).digest("hex");
  if (h !== challenge) return { ok: false, reason: "pow-invalid" };
  return { ok: true };
}

// src/server.js
var HARD_REASONS = /* @__PURE__ */ new Set(["honeypot", "token-missing", "token-invalid", "token-expired", "token-replayed", "too-fast", "js-missing", "pow-missing", "pow-invalid", "pow-expired"]);
var WEIGHTS = { "no-interaction": 2, "signals-missing": 1, "token-missing": 10, "js-missing": 10, "pow-missing": 10 };
var b64u3 = (buf) => Buffer.from(buf).toString("base64url");
var defaultNonces = new MemoryNonceStore();
function loadManifest(fileOrObject) {
  const m = typeof fileOrObject === "string" ? JSON.parse((0, import_node_fs.readFileSync)(fileOrObject, "utf8")) : fileOrObject;
  if (!m || !m.fields) throw new Error("form-honeypot-guard: not a form-guard manifest");
  return m;
}
function resolveOptions(opts = {}) {
  const m = opts.manifest ? loadManifest(opts.manifest) : {};
  const o = { ...DEFAULTS, ...pick(m, ["minTime", "maxAge", "secretEnv", "tokenEndpoint", "requireJs", "pow"]), ...strip(opts) };
  o.fields = { ...DEFAULT_FIELDS, ...m.fields || {}, ...opts.fields || {} };
  const powCfg = resolvePow(o);
  if (powCfg?.field) o.fields.pow = powCfg.field;
  o.nonceStore = opts.nonceStore || defaultNonces;
  return o;
}
var pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== void 0).map((k) => [k, o[k]]));
var strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== void 0));
var sign = (secret, data) => b64u3((0, import_node_crypto4.createHmac)("sha256", secret).update(data).digest());
function createToken(opts = {}, now = Date.now()) {
  const secret = getSecret(opts);
  const nonce = b64u3((0, import_node_crypto4.randomBytes)(12));
  const data = `${now}.${nonce}`;
  return `${data}.${sign(secret, data)}`;
}
var jsProof = (token) => String(token).split(".")[1]?.split("").reverse().join("") ?? "";
function issueFields(opts = {}) {
  const o = resolveOptions(opts);
  const token = createToken(o);
  const esc = (s) => String(s).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
  const html = `<div aria-hidden="true" style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden"><label>Leave this field empty<input type="text" name="${esc(o.fields.honeypot)}" value="" tabindex="-1" autocomplete="off"></label></div><input type="hidden" name="${esc(o.fields.token)}" value="${esc(token)}">`;
  return { fields: { [o.fields.token]: token }, token, html };
}
function parseToken(token, opts = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || !/^\d{10,16}$/.test(parts[0])) return { valid: false };
  const expected = Buffer.from(sign(getSecret(opts), `${parts[0]}.${parts[1]}`));
  const got = Buffer.from(parts[2]);
  const valid = expected.length === got.length && (0, import_node_crypto4.timingSafeEqual)(expected, got);
  return { valid, issuedAt: Number(parts[0]), nonce: parts[1] };
}
function toFields(input) {
  if (!input) return {};
  if (typeof input.entries === "function" && !(input instanceof Array)) {
    const o = {};
    for (const [k, v] of input.entries()) if (!(k in o)) o[k] = typeof v === "string" ? v : String(v?.name ?? v);
    return o;
  }
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, Array.isArray(v) ? String(v[0] ?? "") : v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)]));
}
async function verify(input, opts = {}) {
  const o = resolveOptions(opts);
  const f = toFields(input);
  const F = o.fields;
  const reasons = [];
  let score = 0;
  const add = (r, w = WEIGHTS[r] ?? 10) => {
    reasons.push(r);
    score += w;
  };
  const now = opts.now ?? Date.now();
  if ((f[F.honeypot] ?? "") !== "") add("honeypot");
  const token = f[F.token];
  if (!token) {
    if (o.requireToken) add("token-missing");
    else add("token-missing", 2);
  } else {
    const t = parseToken(token, o);
    if (!t.valid) add("token-invalid");
    else {
      const age = now - t.issuedAt;
      if (age < o.minTime) add("too-fast");
      else if (age > o.maxAge) add("token-expired");
      if (o.requireJs !== false && f[F.js] !== jsProof(token)) {
        if (o.requireJs === true) add("js-missing");
        else add("js-missing", 2);
      }
      if (!reasons.some((r) => HARD_REASONS.has(r)) && !await o.nonceStore.use(t.nonce, o.maxAge + 6e4)) add("token-replayed");
    }
  }
  const sigRaw = f[F.signals];
  if (sigRaw && /^\d+\.\d+\.\d+\.\d+$/.test(sigRaw)) {
    const [k, p, fo] = sigRaw.split(".").map(Number);
    if (o.minInteractions > 0 && k + p + fo < o.minInteractions) add("no-interaction");
  } else if (o.requireJs !== false) add("signals-missing");
  if (o.content !== false) {
    const ignore = Object.values(F).concat(o.content?.ignore || []);
    for (const { reason, weight } of checkContent(f, { ...o.content, ignore })) add(reason, weight);
  }
  const powResult = verifyPow(f[F.pow], o, now);
  if (!powResult.skipped) {
    if (!powResult.ok) add(powResult.reason);
    else if (powResult.soft) add(powResult.reason, 2);
  }
  const ok = !reasons.some((r) => HARD_REASONS.has(r) && !(r === "token-missing" && !o.requireToken) && !(r === "js-missing" && o.requireJs !== true) && !(r === "pow-missing" && resolvePow(o)?.require !== true)) && score < o.threshold;
  return { ok, reasons, score };
}
function cleanFields(input, opts = {}) {
  const F = resolveOptions(opts).fields;
  const f = toFields(input);
  for (const k of Object.values(F)) delete f[k];
  return f;
}
function createRateLimiter({ limit = 5, windowMs = 6e4, store = new MemoryRateLimitStore() } = {}) {
  return {
    limit,
    windowMs,
    store,
    async check(key, now = Date.now()) {
      const { count, retryAfterMs } = await store.hit(String(key), windowMs, limit, now);
      const ok = count <= limit;
      return { ok, count, remaining: Math.max(0, limit - count), retryAfter: ok ? 0 : Math.max(1, Math.ceil(retryAfterMs / 1e3)) };
    }
  };
}

// src/adapters.js
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

// src/ip.js
var import_node_net = require("node:net");
var clean = (ip) => {
  if (!ip) return "";
  ip = String(ip).trim().replace(/^\[|\](:\d+)?$/g, "");
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.split(":")[0];
  if (ip.startsWith("::ffff:") && (0, import_node_net.isIP)(ip.slice(7)) === 4) ip = ip.slice(7);
  return ip;
};
function clientIp({ headers = {}, remoteAddress = "" }, { trustProxy = false, ipHeader } = {}) {
  const get2 = (h) => typeof headers.get === "function" ? headers.get(h) : headers[h];
  const remote = clean(remoteAddress);
  if (!trustProxy) return remote;
  if (ipHeader) {
    const v = clean(String(get2(ipHeader) || "").split(",")[0]);
    if ((0, import_node_net.isIP)(v)) return v;
  }
  const xff = String(get2("x-forwarded-for") || "").split(",").map(clean).filter((x) => (0, import_node_net.isIP)(x));
  if (!xff.length) return remote;
  if (trustProxy === true) return xff[0];
  const chain = [...xff, remote].filter(Boolean);
  if (typeof trustProxy === "number") return chain[Math.max(0, chain.length - 1 - trustProxy)];
  if (Array.isArray(trustProxy)) {
    const trusted = new Set(trustProxy.map(clean));
    for (let i = chain.length - 1; i >= 0; i--) if (!trusted.has(chain[i])) return chain[i];
    return chain[0];
  }
  return remote;
}

// src/middleware.js
function createGuard(options = {}) {
  const o = resolveOptions(options);
  const rl = o.rateLimit === false ? null : createRateLimiter({ limit: 5, windowMs: 6e4, ...o.rateLimit || {} });
  const keysOpt = o.rateLimit?.keys || ["ip"];
  const emailField = o.emailField || "email";
  async function check({ fields, ip, headers }) {
    const f = toFields(fields);
    if (rl) {
      const keys = typeof keysOpt === "function" ? keysOpt({ fields: f, ip, headers }) : keysOpt.map((k) => k === "ip" ? `ip:${ip}` : k === "email" ? f[emailField] ? `email:${String(f[emailField]).trim().toLowerCase()}` : null : k === "fingerprint" ? `fp:${ip}|${get(headers, "user-agent")}|${get(headers, "accept-language")}` : null);
      for (const key of keys.filter(Boolean)) {
        const r = await rl.check(key);
        if (!r.ok) return { ok: false, reasons: ["rate-limited"], score: 10, retryAfter: r.retryAfter, rateLimited: true };
      }
    }
    return verify(f, o);
  }
  function blockResponse(result, ctx) {
    if (result.rateLimited) {
      return { status: 429, headers: { "retry-after": String(result.retryAfter), "content-type": "application/json" }, body: JSON.stringify({ ok: false, error: "Too many requests", retryAfter: result.retryAfter }) };
    }
    if (o.silent) {
      const s = typeof o.silentResponse === "function" ? o.silentResponse(ctx) : o.silentResponse;
      return { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: true }), ...s || {} };
    }
    return { status: 400, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: false, error: "Submission rejected", reasons: result.reasons }) };
  }
  const tokenResponse = (now = Date.now()) => {
    const body = { token: createToken(o, now) };
    const pow = createPowChallenge(o, now);
    if (pow) body.pow = pow;
    return { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) };
  };
  return { options: o, check, blockResponse, tokenResponse, rateLimiter: rl };
}
var get = (h, k) => (typeof h?.get === "function" ? h.get(k) : h?.[k]) || "";
var shouldGuard = (o, method, path) => {
  if (o.methods ? !o.methods.includes(method) : method !== "POST") return false;
  if (!o.paths) return true;
  return o.paths.some((p) => p instanceof RegExp ? p.test(path) : path === p || p.endsWith("*") && path.startsWith(p.slice(0, -1)));
};
async function readNodeBody(req, limit = 1e6) {
  if (req.body !== void 0) return req.body;
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error("Body too large"), { status: 413 });
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const type = String(req.headers["content-type"] || "");
  let body = {};
  if (type.includes("application/json")) {
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      body = {};
    }
  } else if (type.includes("application/x-www-form-urlencoded")) body = Object.fromEntries(new URLSearchParams(raw));
  req.body = body;
  return body;
}
var send = (res, r) => {
  res.statusCode = r.status;
  for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
  res.end(r.body);
};
function expressGuard(options = {}) {
  const g = createGuard(options);
  const o = g.options;
  return async function formGuard(req, res, next) {
    try {
      const path = (req.originalUrl || req.url || "").split("?")[0];
      if (req.method === "GET" && o.tokenEndpoint && path === o.tokenEndpoint) return send(res, g.tokenResponse());
      if (!shouldGuard(o, req.method, path)) return next();
      const fields = await readNodeBody(req);
      const ip = clientIp({ headers: req.headers, remoteAddress: req.socket?.remoteAddress }, o);
      const result = await g.check({ fields, ip, headers: req.headers });
      req.formGuard = result;
      if (result.ok) return next();
      await o.onBlock?.(result, { req, ip });
      return send(res, g.blockResponse(result, { req, ip }));
    } catch (err) {
      next(err);
    }
  };
}
var connectGuard = expressGuard;
function fastifyGuard(fastify, options, done) {
  const g = createGuard(options);
  const o = g.options;
  if (o.tokenEndpoint) fastify.get(o.tokenEndpoint, async (req, reply) => {
    const r = g.tokenResponse();
    reply.code(r.status).headers(r.headers).send(r.body);
    return reply;
  });
  fastify.addHook("preHandler", async (req, reply) => {
    const path = req.url.split("?")[0];
    if (!shouldGuard(o, req.method, path)) return;
    const ip = clientIp({ headers: req.headers, remoteAddress: req.raw.socket?.remoteAddress }, o);
    const result = await g.check({ fields: req.body || {}, ip, headers: req.headers });
    req.formGuard = result;
    if (result.ok) return;
    await o.onBlock?.(result, { req, ip });
    const r = g.blockResponse(result, { req, ip });
    reply.code(r.status).headers(r.headers).send(r.body);
    return reply;
  });
  done();
}
fastifyGuard[Symbol.for("skip-override")] = true;
fastifyGuard[Symbol.for("fastify.display-name")] = "form-honeypot-guard";
var toResponse = (r) => new Response(r.body, { status: r.status, headers: r.headers });
async function readRequestFields(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return request.json().catch(() => ({}));
  if (type.includes("form")) return toFields(await request.formData());
  return {};
}
function createFetchGuard(options = {}) {
  const g = createGuard({ trustProxy: true, ...options });
  const o = g.options;
  return async function guardRequest(request, ctx = {}) {
    const url = new URL(request.url);
    if (request.method === "GET" && o.tokenEndpoint && url.pathname === o.tokenEndpoint) return { ok: false, response: toResponse(g.tokenResponse()) };
    if (!shouldGuard(o, request.method, url.pathname)) return { ok: true, skipped: true };
    const fields = await readRequestFields(request.clone());
    const ip = o.getIp ? await o.getIp(request, ctx) : clientIp({ headers: request.headers, remoteAddress: ctx.ip || "" }, { ipHeader: "cf-connecting-ip", ...o });
    const result = await g.check({ fields, ip, headers: request.headers });
    if (result.ok) return { ok: true, result, fields };
    await o.onBlock?.(result, { request, ip });
    return { ok: false, result, fields, response: toResponse(g.blockResponse(result, { request, ip })) };
  };
}
function withFormGuard(handler, options = {}) {
  const guard = createFetchGuard(options);
  return async (request, ctx) => {
    const g = await guard(request, ctx);
    if (g.response) return g.response;
    return handler(request, ctx, g);
  };
}
function nextRoute(handler, options = {}) {
  const wrapped = withFormGuard(handler, options);
  return { POST: wrapped, GET: wrapped };
}
function withFormGuardApi(handler, options = {}) {
  const mw = expressGuard({ ...options, methods: options.methods || ["POST"], paths: void 0 });
  return (req, res) => new Promise((resolve, reject) => {
    res.once?.("finish", resolve);
    mw(req, res, (err) => err ? reject(err) : resolve(handler(req, res)));
  }).then(() => void 0);
}

// src/sveltekit.js
function sveltekitHandle(options = {}) {
  const guard = createFetchGuard({ trustProxy: true, ...options });
  return async ({ event, resolve }) => {
    const ip = event.getClientAddress?.() ?? "";
    const g = await guard(event.request, { ip });
    if (g.response) return g.response;
    event.locals.formGuard = g;
    return resolve(event);
  };
}
function sveltekitAction(handler, options = {}) {
  const guard = createFetchGuard({ trustProxy: true, ...options });
  return async (event) => {
    const ip = event.getClientAddress?.() ?? "";
    const g = await guard(event.request, { ip });
    if (g.response) return g.response;
    return handler(event, g);
  };
}

// src/remix.js
function remixAction(handler, options = {}) {
  const guard = createFetchGuard({ trustProxy: true, ...options });
  return async ({ request, context }) => {
    const g = await guard(request, { ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "" });
    if (g.response) return g.response;
    return handler({ request, guard: g, context });
  };
}
function remixTokenLoader(options = {}) {
  const guard = createFetchGuard({ trustProxy: true, ...options });
  return async ({ request }) => {
    const g = await guard(request);
    if (g.response) return g.response;
    return new Response("Not found", { status: 404 });
  };
}

// src/astro.js
function astroPost(handler, options = {}) {
  return withFormGuard(async (request, ctx, guard) => handler({ request, guard, params: ctx?.params || {} }), { trustProxy: true, ...options });
}
function astroGet(options = {}) {
  return withFormGuard(() => new Response("Not found", { status: 404 }), { trustProxy: true, ...options });
}
function astroRoute(handler, options = {}) {
  return {
    GET: astroGet(options),
    POST: astroPost(handler, options)
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULTS,
  DEFAULT_FIELDS,
  HARD_REASONS,
  MemoryNonceStore,
  MemoryRateLimitStore,
  astroGet,
  astroPost,
  astroRoute,
  checkContent,
  cleanFields,
  clientIp,
  cloudflareKvNonceStore,
  cloudflareKvRateLimitStore,
  connectGuard,
  createFetchGuard,
  createGuard,
  createPowChallenge,
  createPowChallengeWithSolution,
  createRateLimiter,
  createToken,
  durableObjectNonceStore,
  durableObjectRateLimitStore,
  encodePowPayload,
  expressGuard,
  fastifyGuard,
  generateSecret,
  getSecret,
  issueFields,
  jsProof,
  loadManifest,
  nextRoute,
  parseToken,
  redisNonceStore,
  redisRateLimitStore,
  remixAction,
  remixTokenLoader,
  resolveOptions,
  resolvePow,
  solvePowChallenge,
  sveltekitAction,
  sveltekitHandle,
  toFields,
  upstashNonceStore,
  upstashRateLimitStore,
  verify,
  verifyPow,
  withFormGuard,
  withFormGuardApi
});
