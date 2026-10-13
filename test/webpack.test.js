import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { FormGuardPlugin as EsmPlugin } from '../src/webpack.js';

const require = createRequire(import.meta.url);
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CjsPlugin = require('../src/webpack.cjs');

function site() {
  const dir = mkdtempSync(join(tmpdir(), 'fg-wp-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/index.js'), "import manifest from 'form-guard/config';\nwindow.__fg = manifest.fields.honeypot;\n");
  writeFileSync(join(dir, 'src/index.html'), '<!doctype html><html><head><title>t</title></head><body>' +
    '<form id="contact" data-guard method="post" action="/contact"><input name="email" type="email"><button>Send</button></form>' +
    '<form id="search" action="/search"><input name="q"></form>' +
    '<form id="get" data-guard><input name="email"></form></body></html>');
  writeFileSync(join(dir, 'src/plain.html'), '<html><head></head><body><form data-guard method="post" action="/x"></form></body></html>');
  return dir;
}

const run = (config) => new Promise((resolve, reject) => webpack(config, (err, stats) => (err ? reject(err) : resolve(stats))));

test('CJS export works for require() in webpack configs', () => {
  assert.equal(typeof CjsPlugin, 'function');
  assert.equal(CjsPlugin.FormGuardPlugin, CjsPlugin);
  assert.equal(EsmPlugin, CjsPlugin);
});

test('webpack 5 + html-webpack-plugin: guarded HTML, runtime asset, manifest, virtual module, warnings', async () => {
  const dir = site();
  const out = join(dir, 'dist');
  const stats = await run({
    mode: 'production', context: dir, entry: './src/index.js', output: { path: out, clean: true },
    plugins: [
      new HtmlWebpackPlugin({ template: './src/index.html', filename: 'index.html' }),
      new CjsPlugin({ seed: 'test', manifestPath: 'server/form-guard.json' }),
    ],
  });
  assert.equal(stats.hasErrors(), false, stats.toString('errors-only'));
  const files = readdirSync(out);
  const manifest = JSON.parse(readFileSync(join(out, 'form-guard.manifest.json'), 'utf8'));
  assert.deepEqual(manifest, JSON.parse(readFileSync(join(dir, 'server/form-guard.json'), 'utf8')));
  assert.match(manifest.fields.honeypot, /^[a-z_]+_[0-9a-f]{4}$/);
  assert.equal(manifest.secretEnv, 'FORM_GUARD_SECRET');
  assert.ok(!JSON.stringify(manifest).includes(process.env.FORM_GUARD_SECRET));

  const html = readFileSync(join(out, 'index.html'), 'utf8');
  const contact = html.match(/<form id="?contact"?[\s\S]*?<\/form>/)[0];
  assert.match(contact, /data-fg-guarded/);
  assert.ok(contact.includes(`name="${manifest.fields.honeypot}"`));
  assert.match(contact, /aria-hidden="true"/); assert.match(contact, /tabindex="-1"/);
  assert.doesNotMatch(html.match(/<form id="?search"?[\s\S]*?<\/form>/)[0], /fg-guarded/);
  const runtimeFile = files.find((f) => /^form-guard\.[0-9a-f]{8}\.js$/.test(f));
  assert.ok(runtimeFile, files.join(','));
  assert.equal((html.match(/data-form-guard=/g) || []).length, 1, 'one runtime tag');
  assert.ok(html.includes(`src="${runtimeFile}"`) || html.includes(`src="/${runtimeFile}"`) || html.includes(runtimeFile));


  const bundle = files.filter((f) => f.endsWith('.js') && f !== runtimeFile).map((f) => readFileSync(join(out, f), 'utf8')).join('');
  assert.ok(bundle.includes(manifest.fields.honeypot), 'virtual module form-guard/config bundled');

  const warnings = stats.compilation.warnings.map((w) => w.message).join('\n');
  assert.match(warnings, /\[fg\/method-not-post\] index\.html/);
  assert.match(warnings, /\[fg\/no-action\]/);
});

test('plain .html assets without html-webpack-plugin + inline runtime + "all"', async () => {
  const dir = site();
  const out = join(dir, 'dist');
  class CopyHtml { apply(c) { c.hooks.thisCompilation.tap('Copy', (comp) => comp.hooks.processAssets.tap({ name: 'Copy', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL }, () => comp.emitAsset('pages/plain.html', new webpack.sources.RawSource(readFileSync(join(dir, 'src/plain.html')))))); } }
  const stats = await run({ mode: 'development', devtool: false, context: dir, entry: './src/index.js', output: { path: out }, plugins: [new CopyHtml(), new CjsPlugin({ forms: 'all', inline: true, seed: 1, verbose: false, fields: { honeypot: 'contact_fax' } })] });
  assert.equal(stats.hasErrors(), false, stats.toString('errors-only'));
  const html = readFileSync(join(out, 'pages/plain.html'), 'utf8');
  assert.match(html, /name="contact_fax"/);
  assert.match(html, /<script data-form-guard="[^"]+">\/\*! form-honeypot-guard/);
  assert.ok(!readdirSync(out).some((f) => f.startsWith('form-guard.') && f.endsWith('.js')));
});

test('rebuilds are idempotent and names stable per instance (watch/cache friendly)', async () => {
  const p = new CjsPlugin();
  const { transformHtml } = require('../src/html.cjs');
  const once = transformHtml('<head></head><form data-guard method="post" action="/a"></form>', { names: p.names, script: '<script data-form-guard="{}"></script>' }).html;
  const twice = transformHtml(once, { names: p.names, script: '<script data-form-guard="{}"></script>' });
  assert.equal(twice.html, once);
  assert.equal(twice.warnings.length, 0, 'no collision warning for our own honeypot');
  assert.deepEqual(new CjsPlugin({ seed: 'x' }).names, new CjsPlugin({ seed: 'x' }).names);
  assert.notDeepEqual(new CjsPlugin().names, new CjsPlugin().names);
});

test('warns about existing fields named like the honeypot', () => {
  const { transformHtml } = require('../src/html.cjs');
  const r = transformHtml('<form data-guard method="post" action="/a"><input name="hp"></form>', { names: { honeypot: 'hp', token: 't' } });
  assert.deepEqual(r.warnings.map((w) => w.id), ['fg/honeypot-collision']);
});

test('Vite plugin transforms index.html and serves the virtual module', async () => {
  const { formGuard } = await import('../src/vite.js');
  const p = formGuard({ seed: 'v', fields: { honeypot: 'org_site' } });
  const html = p.transformIndexHtml.handler('<html><head></head><body><form data-guard method="post" action="/c"></form></body></html>', { path: '/index.html' });
  assert.match(html, /name="org_site"/); assert.match(html, /<script data-form-guard=/);
  assert.equal(p.resolveId('form-guard/config'), '\0form-guard/config');
  assert.match(p.load('\0form-guard/config'), /org_site/);
});
