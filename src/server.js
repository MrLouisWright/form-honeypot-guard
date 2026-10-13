import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MemoryNonceStore, MemoryRateLimitStore } from './stores.js';
import { checkContent } from './content.js';

export const DEFAULT_FIELDS = Object.freeze({ honeypot: 'website_url', token: 'fg_token', js: 'fg_js', signals: 'fg_sig' });
export const DEFAULTS = Object.freeze({
  secretEnv: 'FORM_GUARD_SECRET',
  minTime: 3000,
  maxAge: 2 * 60 * 60 * 1000,
  requireToken: true,
  requireJs: true,
  minInteractions: 1,
  threshold: 5,
  content: {},
  tokenEndpoint: '/__form-guard/token',
});
/** Reasons that fail a submission outright, whatever the score. */
export const HARD_REASONS = new Set(['honeypot', 'token-missing', 'token-invalid', 'token-expired', 'token-replayed', 'too-fast', 'js-missing']);
const WEIGHTS = { 'no-interaction': 2, 'signals-missing': 1, 'token-missing': 10, 'js-missing': 10 };

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const defaultNonces = new MemoryNonceStore();

/** Read a manifest written by the webpack/Vite plugin. Accepts a path or an already-parsed object. */
export function loadManifest(fileOrObject) {
  const m = typeof fileOrObject === 'string' ? JSON.parse(readFileSync(fileOrObject, 'utf8')) : fileOrObject;
  if (!m || !m.fields) throw new Error('form-honeypot-guard: not a form-guard manifest');
  return m;
}

/** Merge user options with defaults and an optional manifest (manifest < explicit options). */
export function resolveOptions(opts = {}) {
  const m = opts.manifest ? loadManifest(opts.manifest) : {};
  const o = { ...DEFAULTS, ...pick(m, ['minTime', 'maxAge', 'secretEnv', 'tokenEndpoint', 'requireJs']), ...strip(opts) };
  o.fields = { ...DEFAULT_FIELDS, ...(m.fields || {}), ...(opts.fields || {}) };
  o.nonceStore = opts.nonceStore || defaultNonces;
  return o;
}
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export function getSecret(o = {}) {
  const s = o.secret ?? process.env[o.secretEnv || DEFAULTS.secretEnv];
  if (!s || String(s).length < 16) throw new Error(`form-honeypot-guard: set a secret of at least 16 chars in $${o.secretEnv || DEFAULTS.secretEnv} (generate one with: npx form-honeypot-guard secret)`);
  return String(s);
}

/** Generate a random HMAC secret (base64url, 32 bytes). */
export const generateSecret = (bytes = 32) => b64u(randomBytes(bytes));

const sign = (secret, data) => b64u(createHmac('sha256', secret).update(data).digest());

/** Issue a signed token "<issuedAtMs>.<nonce>.<hmac>". */
export function createToken(opts = {}, now = Date.now()) {
  const secret = getSecret(opts);
  const nonce = b64u(randomBytes(12));
  const data = `${now}.${nonce}`;
  return `${data}.${sign(secret, data)}`;
}

/** The value the client runtime writes into the JS-proof field for a token. */
export const jsProof = (token) => String(token).split('.')[1]?.split('').reverse().join('') ?? '';

/** Hidden fields for server-rendered forms (so no token fetch is needed). Returns { fields, html }. */
export function issueFields(opts = {}) {
  const o = resolveOptions(opts);
  const token = createToken(o);
  const esc = (s) => String(s).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
  const html =
    `<div aria-hidden="true" style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden">` +
    `<label>Leave this field empty<input type="text" name="${esc(o.fields.honeypot)}" value="" tabindex="-1" autocomplete="off"></label></div>` +
    `<input type="hidden" name="${esc(o.fields.token)}" value="${esc(token)}">`;
  return { fields: { [o.fields.token]: token }, token, html };
}

/** Parse a token without trusting it. Returns { issuedAt, nonce, valid }. */
export function parseToken(token, opts = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || !/^\d{10,16}$/.test(parts[0])) return { valid: false };
  const expected = Buffer.from(sign(getSecret(opts), `${parts[0]}.${parts[1]}`));
  const got = Buffer.from(parts[2]);
  const valid = expected.length === got.length && timingSafeEqual(expected, got);
  return { valid, issuedAt: Number(parts[0]), nonce: parts[1] };
}

/** Normalise FormData / URLSearchParams / Map / plain object into a plain object of strings. */
export function toFields(input) {
  if (!input) return {};
  if (typeof input.entries === 'function' && !(input instanceof Array)) {
    const o = {};
    for (const [k, v] of input.entries()) if (!(k in o)) o[k] = typeof v === 'string' ? v : String(v?.name ?? v);
    return o;
  }
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)]));
}

/**
 * Verify a submission. Framework-agnostic.
 * @returns Promise<{ ok: boolean, reasons: string[], score: number }>
 */
export async function verify(input, opts = {}) {
  const o = resolveOptions(opts);
  const f = toFields(input);
  const F = o.fields;
  const reasons = [];
  let score = 0;
  const add = (r, w = WEIGHTS[r] ?? 10) => { reasons.push(r); score += w; };
  const now = opts.now ?? Date.now();

  if ((f[F.honeypot] ?? '') !== '') add('honeypot');

  const token = f[F.token];
  if (!token) {
    if (o.requireToken) add('token-missing'); else add('token-missing', 2);
  } else {
    const t = parseToken(token, o);
    if (!t.valid) add('token-invalid');
    else {
      const age = now - t.issuedAt;
      if (age < o.minTime) add('too-fast');
      else if (age > o.maxAge) add('token-expired');
      if (o.requireJs !== false && f[F.js] !== jsProof(token)) {
        if (o.requireJs === true) add('js-missing'); else add('js-missing', 2);
      }
      if (!reasons.some((r) => HARD_REASONS.has(r)) && !(await o.nonceStore.use(t.nonce, o.maxAge + 60000))) add('token-replayed');
    }
  }

  const sigRaw = f[F.signals];
  if (sigRaw && /^\d+\.\d+\.\d+\.\d+$/.test(sigRaw)) {
    const [k, p, fo] = sigRaw.split('.').map(Number);
    if (o.minInteractions > 0 && k + p + fo < o.minInteractions) add('no-interaction');
  } else if (o.requireJs !== false) add('signals-missing');

  if (o.content !== false) {
    const ignore = Object.values(F).concat(o.content?.ignore || []);
    for (const { reason, weight } of checkContent(f, { ...o.content, ignore })) add(reason, weight);
  }

  const ok = !reasons.some((r) => HARD_REASONS.has(r) && !(r === 'token-missing' && !o.requireToken) && !(r === 'js-missing' && o.requireJs !== true)) && score < o.threshold;
  return { ok, reasons, score };
}

/** Strip guard fields from a submission so you can store/email the rest. */
export function cleanFields(input, opts = {}) {
  const F = resolveOptions(opts).fields;
  const f = toFields(input);
  for (const k of Object.values(F)) delete f[k];
  return f;
}

/**
 * Sliding-window rate limiter.
 * createRateLimiter({ limit = 5, windowMs = 60000, store }).check(key) -> { ok, count, remaining, retryAfter (seconds) }
 */
export function createRateLimiter({ limit = 5, windowMs = 60_000, store = new MemoryRateLimitStore() } = {}) {
  return {
    limit, windowMs, store,
    async check(key, now = Date.now()) {
      const { count, retryAfterMs } = await store.hit(String(key), windowMs, limit, now);
      const ok = count <= limit;
      return { ok, count, remaining: Math.max(0, limit - count), retryAfter: ok ? 0 : Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    },
  };
}

export { MemoryNonceStore, MemoryRateLimitStore, checkContent };
