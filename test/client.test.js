import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { JSDOM } from 'jsdom';
import { verify, createToken, MemoryNonceStore } from '../src/index.js';

const runtime = readFileSync(new URL('../src/runtime.js', import.meta.url), 'utf8');

function dom(body, config, token = createToken({}, Date.now() - 5000)) {
  const d = new JSDOM(`<!doctype html><body>${body}</body>`, { runScripts: 'outside-only', url: 'https://site.test/' });
  const w = d.window;
  w.fetch = async (url) => ({ ok: true, json: async () => ({ token, url }) });
  w.eval(runtime);
  if (config !== undefined) w.FormGuard.init(config);
  return { w, doc: w.document, token, ready: new Promise((r) => setTimeout(r, 20)) };
}

test('runtime is tiny (< 2 kB gzipped, unminified)', () => {
  const size = gzipSync(runtime, { level: 9 }).length;
  assert.ok(size < 2048, `${size} bytes`);
});

test('enhances only opted-in forms with an accessible honeypot', async () => {
  const { w, doc, ready } = dom('<form id="a" data-guard method="post"><input name="email"></form><form id="b"></form>', {});
  await ready;
  const a = doc.getElementById('a');
  const hp = a.querySelector('input[name="website_url"]');
  assert.ok(hp);
  assert.equal(hp.tabIndex, -1); assert.equal(hp.getAttribute('autocomplete'), 'off');
  const box = hp.closest('div');
  assert.equal(box.getAttribute('aria-hidden'), 'true');
  assert.match(box.getAttribute('style'), /left:-10000px/); assert.doesNotMatch(box.getAttribute('style'), /display:\s*none/);
  assert.equal(doc.getElementById('b').querySelector('input'), null);
  await w.FormGuard.enhance(a);
});

test('fields from formData()/json() verify on the server', async () => {
  const { w, doc, token } = dom('<form data-guard><input name="name" value="Ada"></form>', {});
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { bubbles: true }));
  const o = await w.FormGuard.json(doc.querySelector('form'));
  assert.equal(o.fg_token, token);
  assert.equal(o.name, 'Ada');
  assert.match(o.fg_sig, /^1\.0\.\d+\.\d+$/);
  assert.deepEqual(await verify(o, { nonceStore: new MemoryNonceStore() }), { ok: true, reasons: [], score: 0 });
});

test('forms: "all", custom names, prefilled (SSR) token and dynamically added forms', async () => {
  const pre = createToken({}, Date.now() - 4000);
  const { w, doc } = dom(`<form><input type="hidden" name="t1" value="${pre}"></form>`, { forms: 'all', honeypot: 'company_fax_1', token: 't1', js: 'j1', signals: 's1' });
  const f = doc.querySelector('form');
  await w.FormGuard.enhance(f);
  assert.ok(f.querySelector('[name=company_fax_1]'));
  assert.equal(f.querySelector('[name=j1]').value, pre.split('.')[1].split('').reverse().join(''));
  const g = doc.createElement('form'); doc.body.appendChild(g);
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(g.hasAttribute('data-fg-enhanced'), 'MutationObserver picks up new forms');
});

test('auto-init from <script data-form-guard> config', async () => {
  const d = new JSDOM(`<!doctype html><body><form class="c"></form><script data-form-guard='{"forms":"form.c","fetchToken":false}'>${runtime}</script></body>`, { runScripts: 'dangerously' });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(d.window.document.querySelector('form.c [name=website_url]'));
});

test('ESM client wrapper is SSR-safe', async () => {
  const c = await import('../src/client.js');
  assert.equal(c.init(), undefined);
  assert.doesNotThrow(() => c.guardRef(null));
  assert.throws(() => c.enhance({}), /browser DOM/);
});

test('credit defaults off; when on mounts a fixed link into creditTarget', async () => {
  const { w, doc, ready } = dom(
    '<form data-guard method="post"><input name="email"></form><div id="c"></div>',
    {},
  );
  await ready;
  assert.equal(doc.querySelector('.fg-credit'), null);
  w.FormGuard.init({ credit: true, creditTarget: '#c' });
  const a = doc.querySelector('#c a.fg-credit');
  assert.ok(a);
  assert.equal(a.getAttribute('href'), 'https://louiswright.co.uk');
  assert.equal(a.getAttribute('rel'), 'noopener');
  assert.equal(a.textContent, 'Built with form-honeypot-guard');
  assert.equal(a.getAttribute('style'), null);
});
