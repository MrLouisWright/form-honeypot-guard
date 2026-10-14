import { createHash, timingSafeEqual } from 'node:crypto';
import { randomBytes } from 'node:crypto';
import { getSecret, signPayload } from './secret.js';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const b64uJson = (o) => b64u(Buffer.from(JSON.stringify(o), 'utf8'));
const parseB64uJson = (s) => JSON.parse(Buffer.from(String(s || ''), 'base64url').toString('utf8'));

/** Normalise `pow: true | { maxnumber?, field?, require? }`. */
export function resolvePow(opts = {}) {
  if (!opts.pow) return null;
  const p = opts.pow === true ? {} : opts.pow;
  return {
    maxnumber: p.maxnumber ?? 100_000,
    require: p.require ?? true,
    field: p.field,
  };
}

/**
 * Altcha-style proof-of-work challenge (privacy-friendly, no third-party captcha).
 * Client finds `number` in 0..maxnumber where SHA-256(salt + number) hex equals `challenge`.
 */
export function createPowChallenge(opts = {}, now = Date.now()) {
  const pow = resolvePow(opts);
  if (!pow) return null;
  const secret = getSecret(opts);
  const salt = b64u(randomBytes(12));
  const maxnumber = pow.maxnumber;
  const algorithm = 'SHA-256';
  const number = Math.floor(Math.random() * (maxnumber + 1));
  const challenge = createHash('sha256').update(salt + number).digest('hex');
  const issuedAt = now;
  const sigPayload = `${algorithm}|${challenge}|${maxnumber}|${salt}|${issuedAt}`;
  const signature = signPayload(secret, sigPayload);
  return { algorithm, challenge, maxnumber, salt, signature, issuedAt };
}

/** Server-only: attach the known solution for tests. */
export function createPowChallengeWithSolution(opts = {}, now = Date.now()) {
  const pow = resolvePow(opts);
  if (!pow) return null;
  const secret = getSecret(opts);
  const salt = b64u(randomBytes(12));
  const maxnumber = pow.maxnumber;
  const algorithm = 'SHA-256';
  const number = Math.floor(Math.random() * (maxnumber + 1));
  const challenge = createHash('sha256').update(salt + number).digest('hex');
  const issuedAt = now;
  const sigPayload = `${algorithm}|${challenge}|${maxnumber}|${salt}|${issuedAt}`;
  const signature = signPayload(secret, sigPayload);
  return { algorithm, challenge, maxnumber, salt, signature, issuedAt, number };
}

/** Solve a challenge (browser or Node). Returns the winning number or null. */
export function solvePowChallenge(challenge, { batchSize = 5000, onProgress } = {}) {
  if (!challenge) return null;
  const { algorithm, challenge: target, maxnumber, salt } = challenge;
  if (algorithm !== 'SHA-256') return null;
  for (let start = 0; start <= maxnumber; start += batchSize) {
    const end = Math.min(start + batchSize - 1, maxnumber);
    for (let n = start; n <= end; n++) {
      const h = createHash('sha256').update(salt + n).digest('hex');
      if (h === target) return n;
    }
    onProgress?.({ done: end + 1, total: maxnumber + 1 });
  }
  return null;
}

/** Encode a solved challenge for the hidden form field (base64url JSON). */
export function encodePowPayload(challenge, number) {
  const { algorithm, challenge: ch, maxnumber, salt, signature, issuedAt } = challenge;
  return b64uJson({ algorithm, challenge: ch, maxnumber, salt, signature, issuedAt, number });
}

/** Verify a base64url JSON payload from the client. */
export function verifyPow(payload, opts = {}, now = opts.now ?? Date.now()) {
  const pow = resolvePow(opts);
  if (!pow) return { ok: true, skipped: true };
  if (!payload) {
    if (pow.require === true) return { ok: false, reason: 'pow-missing' };
    if (pow.require === 'soft') return { ok: true, reason: 'pow-missing', soft: true };
    return { ok: true, skipped: true };
  }
  let data;
  try {
    data = parseB64uJson(payload);
  } catch {
    return { ok: false, reason: 'pow-invalid' };
  }
  const { algorithm, challenge, maxnumber, salt, signature, issuedAt, number } = data;
  if (algorithm !== 'SHA-256' || typeof challenge !== 'string' || typeof salt !== 'string') {
    return { ok: false, reason: 'pow-invalid' };
  }
  if (typeof number !== 'number' || number < 0 || number > maxnumber) return { ok: false, reason: 'pow-invalid' };
  const secret = getSecret(opts);
  const sigPayload = `${algorithm}|${challenge}|${maxnumber}|${salt}|${issuedAt}`;
  const expectedSig = signPayload(secret, sigPayload);
  const got = Buffer.from(String(signature || ''));
  const exp = Buffer.from(expectedSig);
  if (exp.length !== got.length || !timingSafeEqual(exp, got)) return { ok: false, reason: 'pow-invalid' };
  const maxAge = opts.powMaxAge ?? opts.maxAge ?? 2 * 60 * 60 * 1000;
  if (typeof issuedAt !== 'number' || now - issuedAt > maxAge || now - issuedAt < 0) {
    return { ok: false, reason: 'pow-expired' };
  }
  const h = createHash('sha256').update(salt + number).digest('hex');
  if (h !== challenge) return { ok: false, reason: 'pow-invalid' };
  return { ok: true };
}
