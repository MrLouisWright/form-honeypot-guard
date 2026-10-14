import { verify, createToken, resolveOptions, createRateLimiter, toFields } from './server.js';
import { createPowChallenge } from './pow.js';
import { clientIp } from './ip.js';

/**
 * Shared engine used by every adapter.
 * options: everything verify() takes, plus
 *   rateLimit: { limit, windowMs, store, keys: ['ip', 'email'] | (ctx) => string[] } | false
 *   silent: boolean           fake success to rejected bots (status 200)
 *   silentResponse: { status, body, headers } | ((ctx) => …)
 *   trustProxy, ipHeader      see clientIp()
 *   emailField = 'email'      used by the 'email' rate-limit key
 *   onBlock(result, ctx)      hook for logging
 */
export function createGuard(options = {}) {
  const o = resolveOptions(options);
  const rl = o.rateLimit === false ? null : createRateLimiter({ limit: 5, windowMs: 60_000, ...(o.rateLimit || {}) });
  const keysOpt = o.rateLimit?.keys || ['ip'];
  const emailField = o.emailField || 'email';

  async function check({ fields, ip, headers }) {
    const f = toFields(fields);
    if (rl) {
      const keys = typeof keysOpt === 'function' ? keysOpt({ fields: f, ip, headers }) : keysOpt.map((k) =>
        k === 'ip' ? `ip:${ip}` : k === 'email' ? (f[emailField] ? `email:${String(f[emailField]).trim().toLowerCase()}` : null) : k === 'fingerprint' ? `fp:${ip}|${get(headers, 'user-agent')}|${get(headers, 'accept-language')}` : null);
      for (const key of keys.filter(Boolean)) {
        const r = await rl.check(key);
        if (!r.ok) return { ok: false, reasons: ['rate-limited'], score: 10, retryAfter: r.retryAfter, rateLimited: true };
      }
    }
    return verify(f, o);
  }

  function blockResponse(result, ctx) {
    if (result.rateLimited) {
      return { status: 429, headers: { 'retry-after': String(result.retryAfter), 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Too many requests', retryAfter: result.retryAfter }) };
    }
    if (o.silent) {
      const s = typeof o.silentResponse === 'function' ? o.silentResponse(ctx) : o.silentResponse;
      return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }), ...(s || {}) };
    }
    return { status: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Submission rejected', reasons: result.reasons }) };
  }

  const tokenResponse = (now = Date.now()) => {
    const body = { token: createToken(o, now) };
    const pow = createPowChallenge(o, now);
    if (pow) body.pow = pow;
    return { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) };
  };

  return { options: o, check, blockResponse, tokenResponse, rateLimiter: rl };
}
const get = (h, k) => (typeof h?.get === 'function' ? h.get(k) : h?.[k]) || '';

const shouldGuard = (o, method, path) => {
  if (o.methods ? !o.methods.includes(method) : method !== 'POST') return false;
  if (!o.paths) return true;
  return o.paths.some((p) => (p instanceof RegExp ? p.test(path) : path === p || (p.endsWith('*') && path.startsWith(p.slice(0, -1)))));
};

async function readNodeBody(req, limit = 1e6) {
  if (req.body !== undefined) return req.body;
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error('Body too large'), { status: 413 }); chunks.push(c); }
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = String(req.headers['content-type'] || '');
  let body = {};
  if (type.includes('application/json')) { try { body = JSON.parse(raw || '{}'); } catch { body = {}; } }
  else if (type.includes('application/x-www-form-urlencoded')) body = Object.fromEntries(new URLSearchParams(raw));
  req.body = body; // so your handler can still read it
  return body;
}

const send = (res, r) => { res.statusCode = r.status; for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v); res.end(r.body); };

/**
 * Express / Connect middleware. Serves GET tokenEndpoint and guards POSTs (or `paths`).
 * Works with or without body parsers (multipart needs your parser to run first).
 */
export function expressGuard(options = {}) {
  const g = createGuard(options);
  const o = g.options;
  return async function formGuard(req, res, next) {
    try {
      const path = (req.originalUrl || req.url || '').split('?')[0];
      if (req.method === 'GET' && o.tokenEndpoint && path === o.tokenEndpoint) return send(res, g.tokenResponse());
      if (!shouldGuard(o, req.method, path)) return next();
      const fields = await readNodeBody(req);
      const ip = clientIp({ headers: req.headers, remoteAddress: req.socket?.remoteAddress }, o);
      const result = await g.check({ fields, ip, headers: req.headers });
      req.formGuard = result;
      if (result.ok) return next();
      await o.onBlock?.(result, { req, ip });
      return send(res, g.blockResponse(result, { req, ip }));
    } catch (err) { next(err); }
  };
}
export const connectGuard = expressGuard;

/** Fastify plugin: fastify.register(fastifyGuard, opts). Needs @fastify/formbody for urlencoded forms. */
export function fastifyGuard(fastify, options, done) {
  const g = createGuard(options);
  const o = g.options;
  if (o.tokenEndpoint) fastify.get(o.tokenEndpoint, async (req, reply) => { const r = g.tokenResponse(); reply.code(r.status).headers(r.headers).send(r.body); return reply; });
  fastify.addHook('preHandler', async (req, reply) => {
    const path = req.url.split('?')[0];
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
fastifyGuard[Symbol.for('skip-override')] = true;
fastifyGuard[Symbol.for('fastify.display-name')] = 'form-honeypot-guard';

const toResponse = (r) => new Response(r.body, { status: r.status, headers: r.headers });

async function readRequestFields(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return request.json().catch(() => ({}));
  if (type.includes('form')) return toFields(await request.formData());
  return {};
}

/**
 * Web Fetch API guard (Next.js app router, Netlify/Vercel/Cloudflare functions, Deno, Bun).
 * Returns { ok, result, fields, response? }. response is set when the request should be answered without your handler.
 * Fetch platforms terminate TLS in front of you, so trustProxy defaults to true here.
 */
export function createFetchGuard(options = {}) {
  const g = createGuard({ trustProxy: true, ...options });
  const o = g.options;
  return async function guardRequest(request, ctx = {}) {
    const url = new URL(request.url);
    if (request.method === 'GET' && o.tokenEndpoint && url.pathname === o.tokenEndpoint) return { ok: false, response: toResponse(g.tokenResponse()) };
    if (!shouldGuard(o, request.method, url.pathname)) return { ok: true, skipped: true };
    const fields = await readRequestFields(request.clone());
    const ip = o.getIp ? await o.getIp(request, ctx) : clientIp({ headers: request.headers, remoteAddress: ctx.ip || '' }, { ipHeader: 'cf-connecting-ip', ...o });
    const result = await g.check({ fields, ip, headers: request.headers });
    if (result.ok) return { ok: true, result, fields };
    await o.onBlock?.(result, { request, ip });
    return { ok: false, result, fields, response: toResponse(g.blockResponse(result, { request, ip })) };
  };
}

/** Wrap a (request, ctx) => Response handler. Use for Next.js route handlers, Netlify/Vercel/Cloudflare. */
export function withFormGuard(handler, options = {}) {
  const guard = createFetchGuard(options);
  return async (request, ctx) => {
    const g = await guard(request, ctx);
    if (g.response) return g.response;
    return handler(request, ctx, g);
  };
}

/** Next.js app router: export const { GET, POST } = nextRoute(async (req, ctx, guard) => Response.json(...)) */
export function nextRoute(handler, options = {}) {
  const wrapped = withFormGuard(handler, options);
  return { POST: wrapped, GET: wrapped };
}

/** Next.js pages router API route: export default withFormGuardApi((req, res) => …) */
export function withFormGuardApi(handler, options = {}) {
  const mw = expressGuard({ ...options, methods: options.methods || ['POST'], paths: undefined });
  return (req, res) => new Promise((resolve, reject) => {
    res.once?.('finish', resolve);
    mw(req, res, (err) => (err ? reject(err) : resolve(handler(req, res))));
  }).then(() => undefined);
}
