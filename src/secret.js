import { createHmac, randomBytes } from 'node:crypto';
import { DEFAULTS } from './constants.js';

const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function getSecret(o = {}) {
  const s = o.secret ?? process.env[o.secretEnv || DEFAULTS.secretEnv];
  if (!s || String(s).length < 16) {
    throw new Error(`form-honeypot-guard: set a secret of at least 16 chars in $${o.secretEnv || DEFAULTS.secretEnv} (generate one with: npx form-honeypot-guard secret)`);
  }
  return String(s);
}

export const generateSecret = (bytes = 32) => b64u(randomBytes(bytes));

export const signPayload = (secret, data) => b64u(createHmac('sha256', secret).update(data).digest());
