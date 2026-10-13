import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verify, createToken, jsProof, parseToken, MemoryNonceStore, issueFields, cleanFields, generateSecret, clientIp, loadManifest } from '../src/index.js';

const now = Date.now();
const good = (extra = {}, t = createToken({}, now - 5000)) => ({ name: 'Ada', email: 'ada@example.com', message: 'Hello there', website_url: '', fg_token: t, fg_js: jsProof(t), fg_sig: '12.1.3.9000', ...extra });
const opts = () => ({ nonceStore: new MemoryNonceStore(), now });

test('valid human submission passes', async () => {
  const r = await verify(good(), opts());
  assert.deepEqual(r, { ok: true, reasons: [], score: 0 });
});

test('honeypot filled fails', async () => {
  const r = await verify(good({ website_url: 'http://spam.example' }), opts());
  assert.equal(r.ok, false); assert.ok(r.reasons.includes('honeypot'));
});

test('too fast, expired, tampered, missing', async () => {
  assert.ok((await verify(good({}, createToken({}, now - 500)), opts())).reasons.includes('too-fast'));
  assert.ok((await verify(good({}, createToken({}, now - 3 * 3600e3)), opts())).reasons.includes('token-expired'));
  const t = createToken({}, now - 5000);
  const tampered = t.replace(/^\d+/, String(now - 60000));
  assert.ok((await verify(good({ fg_token: tampered, fg_js: jsProof(tampered) }), opts())).reasons.includes('token-invalid'));
  assert.ok((await verify(good({ fg_token: '' }), opts())).reasons.includes('token-missing'));
  assert.equal(parseToken('nope').valid, false);
  assert.equal(parseToken(t, { secret: 'another-secret-0123456789' }).valid, false);
});

test('replayed token is rejected', async () => {
  const o = opts(); const f = good();
  assert.equal((await verify(f, o)).ok, true);
  const r = await verify(f, o);
  assert.equal(r.ok, false); assert.deepEqual(r.reasons, ['token-replayed']);
});

test('JS proof: hard by default, soft or off for progressive enhancement', async () => {
  assert.ok((await verify(good({ fg_js: '' }), opts())).reasons.includes('js-missing'));
  const soft = await verify(good({ fg_js: '', fg_sig: '' }), { ...opts(), requireJs: 'soft' });
  assert.equal(soft.ok, true); assert.deepEqual(soft.reasons, ['js-missing', 'signals-missing']);
  const off = await verify(good({ fg_js: '', fg_sig: '' }), { ...opts(), requireJs: false });
  assert.deepEqual(off, { ok: true, reasons: [], score: 0 });
  const noTok = await verify(good({ fg_token: '' }), { ...opts(), requireToken: false, requireJs: false });
  assert.equal(noTok.ok, true);
});

test('interaction signals and content heuristics add score', async () => {
  const r = await verify(good({ fg_sig: '0.0.0.100', message: 'Cheap viagra casino http://a.ru http://b.ru http://c.ru', name: 'www.spam.xyz' }), opts());
  assert.equal(r.ok, false);
  for (const x of ['no-interaction', 'content-links', 'content-url-in-name', 'content-keywords']) assert.ok(r.reasons.includes(x), x);
  const cs = await verify(good({ message: 'Привет как дела это сообщение на русском языке' }), { ...opts(), content: { scripts: ['Latin'] } });
  assert.ok(cs.reasons.includes('content-charset'));
  const off = await verify(good({ message: 'viagra' }), { ...opts(), content: false });
  assert.equal(off.ok, true);
});

test('accepts FormData and URLSearchParams; manifest field names', async () => {
  const fd = new FormData(); for (const [k, v] of Object.entries(good())) fd.append(k, v);
  assert.equal((await verify(fd, opts())).ok, true);
  const manifest = { fields: { honeypot: 'hp_x', token: 't_x', js: 'j_x', signals: 's_x' }, minTime: 1000 };
  const t = createToken({}, now - 2000);
  const f = new URLSearchParams({ hp_x: '', t_x: t, j_x: jsProof(t), s_x: '1.0.0.1' });
  assert.equal((await verify(f, { ...opts(), manifest })).ok, true);
  assert.equal(loadManifest(manifest).fields.token, 't_x');
});

test('issueFields, cleanFields, generateSecret', () => {
  const { html, token } = issueFields();
  assert.match(html, /aria-hidden="true"/); assert.match(html, /tabindex="-1"/); assert.match(html, /autocomplete="off"/);
  assert.ok(parseToken(token).valid);
  assert.deepEqual(cleanFields(good()), { name: 'Ada', email: 'ada@example.com', message: 'Hello there' });
  assert.match(generateSecret(), /^[\w-]{43}$/);
});

test('missing secret throws a helpful error', () => {
  assert.throws(() => createToken({ secretEnv: 'NOPE_NOT_SET' }), /npx form-honeypot-guard secret/);
});

test('clientIp honours trustProxy', () => {
  const h = { 'x-forwarded-for': '203.0.113.9, 10.0.0.2', 'cf-connecting-ip': '198.51.100.7' };
  assert.equal(clientIp({ headers: h, remoteAddress: '::ffff:10.0.0.1' }), '10.0.0.1');
  assert.equal(clientIp({ headers: h, remoteAddress: '10.0.0.1' }, { trustProxy: true }), '203.0.113.9');
  assert.equal(clientIp({ headers: h, remoteAddress: '10.0.0.1' }, { trustProxy: 1 }), '10.0.0.2');
  assert.equal(clientIp({ headers: h, remoteAddress: '10.0.0.1' }, { trustProxy: ['10.0.0.1', '10.0.0.2'] }), '203.0.113.9');
  assert.equal(clientIp({ headers: h, remoteAddress: '10.0.0.1' }, { trustProxy: true, ipHeader: 'cf-connecting-ip' }), '198.51.100.7');
});
