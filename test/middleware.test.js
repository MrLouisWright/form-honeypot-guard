import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import Fastify from 'fastify';
import { expressGuard, fastifyGuard, withFormGuard, nextRoute, withFormGuardApi, jsProof, MemoryNonceStore } from '../src/index.js';

const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${srv.address().port}`)));
const human = (token) => new URLSearchParams({ name: 'Ada', message: 'hi', website_url: '', fg_token: token, fg_js: jsProof(token), fg_sig: '5.1.2.8000' });
const getToken = async (base) => (await (await fetch(base + '/__form-guard/token')).json()).token;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('plain node http server + middleware: token, pass, block, 429, silent', async () => {
  const mw = expressGuard({ minTime: 200, nonceStore: new MemoryNonceStore(), rateLimit: { limit: 3, windowMs: 60_000 } });
  const srv = http.createServer((req, res) => mw(req, res, (err) => { res.statusCode = err ? 500 : 200; res.end(JSON.stringify({ handled: true, body: req.body })); }));
  const base = await listen(srv);
  try {
    const t = await getToken(base);
    assert.match(t, /^\d+\.[\w-]+\.[\w-]+$/);
    let r = await fetch(base + '/contact', { method: 'POST', body: human(t) });
    assert.equal(r.status, 400, 'too fast');
    assert.deepEqual((await r.json()).reasons.includes('too-fast'), true);
    const t2 = await getToken(base); await wait(250);
    r = await fetch(base + '/contact', { method: 'POST', body: human(t2) });
    assert.equal(r.status, 200); assert.equal((await r.json()).body.name, 'Ada');
    r = await fetch(base + '/contact', { method: 'POST', body: human(t2) });
    assert.equal(r.status, 400, 'replay'); assert.deepEqual((await r.json()).reasons, ['token-replayed']);
    r = await fetch(base + '/contact', { method: 'POST', body: human(t2) });
    assert.equal(r.status, 429); assert.ok(Number(r.headers.get('retry-after')) > 0);
    assert.equal((await fetch(base + '/page')).status, 200, 'GET untouched');
  } finally { srv.close(); }
});

test('express: JSON body, silent mode fakes success', async () => {
  const app = express();
  app.use(express.json());
  app.use(expressGuard({ silent: true, rateLimit: false, paths: ['/api/*'] }));
  app.post('/api/contact', (req, res) => res.json({ ok: true, real: true }));
  const srv = app.listen(0, '127.0.0.1');
  await new Promise((r) => srv.once('listening', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const r = await fetch(base + '/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ website_url: 'spam' }) });
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true });
  } finally { srv.close(); }
});

test('fastify plugin', async () => {
  const app = Fastify();
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (req, body, done) => done(null, Object.fromEntries(new URLSearchParams(body))));
  app.register(fastifyGuard, { minTime: 0, rateLimit: false });
  app.post('/contact', async (req) => ({ ok: true, score: req.formGuard.score }));
  const t = JSON.parse((await app.inject({ url: '/__form-guard/token' })).body).token;
  let r = await app.inject({ method: 'POST', url: '/contact', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: human(t).toString() });
  assert.equal(r.statusCode, 200);
  r = await app.inject({ method: 'POST', url: '/contact', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: 'website_url=x' });
  assert.equal(r.statusCode, 400);
  await app.close();
});

test('fetch handler (Next.js app route / Netlify / Vercel / Cloudflare)', async () => {
  const { POST, GET } = nextRoute(async (req, ctx, guard) => Response.json({ ok: true, name: guard.fields.name }), { minTime: 0, rateLimit: { limit: 1, windowMs: 1000 } });
  const t = (await (await GET(new Request('https://x.test/__form-guard/token'))).json()).token;
  const mk = (body, ip) => new Request('https://x.test/api/contact', { method: 'POST', body, headers: { 'x-forwarded-for': ip } });
  let r = await POST(mk(human(t), '203.0.113.1'));
  assert.equal(r.status, 200); assert.equal((await r.json()).name, 'Ada');
  r = await POST(mk(human(t), '203.0.113.1'));
  assert.equal(r.status, 429); assert.equal(r.headers.get('retry-after'), '1');
  r = await withFormGuard(() => new Response('nope'), { rateLimit: false })(mk(new URLSearchParams({ website_url: 'x' }), '1.1.1.1'));
  assert.equal(r.status, 400);
});

test('Next.js pages API helper', async () => {
  const handler = withFormGuardApi((req, res) => { res.statusCode = 201; res.end('ok'); }, { rateLimit: false });
  const srv = http.createServer((req, res) => handler(req, res));
  const base = await listen(srv);
  try {
    const r = await fetch(base, { method: 'POST', body: new URLSearchParams({ website_url: 'x' }) });
    assert.equal(r.status, 400);
  } finally { srv.close(); }
});
