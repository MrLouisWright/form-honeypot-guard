'use strict';
// Shared build-time HTML helpers (used by the webpack plugin, the Vite plugin and the CLI). CommonJS so webpack configs can require it.
const crypto = require('node:crypto');

const HONEYPOT_BASES = ['website_url', 'company_website', 'contact_fax', 'middle_name', 'homepage', 'business_url', 'alt_email', 'phone_ext', 'org_site', 'secondary_address'];

/** Realistic, per-build randomised field names. Pass a seed for reproducible builds. */
function makeNames(seed) {
  const bytes = seed != null ? crypto.createHash('sha256').update(String(seed)).digest() : crypto.randomBytes(32);
  const hex = bytes.toString('hex');
  return {
    honeypot: `${HONEYPOT_BASES[bytes[0] % HONEYPOT_BASES.length]}_${hex.slice(2, 6)}`,
    token: `fg_t_${hex.slice(6, 12)}`,
    js: `fg_j_${hex.slice(12, 18)}`,
    signals: `fg_s_${hex.slice(18, 24)}`,
  };
}

const ATTR_RE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
function parseAttrs(s) {
  const out = {};
  for (const m of String(s).matchAll(ATTR_RE)) { const k = m[1].toLowerCase(); if (!(k in out)) out[k] = m[2] ?? m[3] ?? m[4] ?? ''; }
  return out;
}

/** Minimal selector matcher for build time: 'all', 'form', 'form[data-x]', '[data-x="y"]', '.cls', '#id', 'form.cls', comma lists. */
function matches(attrs, selector) {
  if (!selector || selector === 'all') return true;
  return String(selector).split(',').some((sel) => {
    sel = sel.trim();
    if (!sel) return false;
    const m = sel.match(/^(form)?((?:[.#][\w-]+|\[[^\]]+\])*)$/i);
    if (!m) return false;
    for (const part of m[2].match(/[.#][\w-]+|\[[^\]]+\]/g) || []) {
      if (part[0] === '.') { if (!(attrs.class || '').split(/\s+/).includes(part.slice(1))) return false; }
      else if (part[0] === '#') { if (attrs.id !== part.slice(1)) return false; }
      else {
        const am = part.match(/^\[\s*([\w-:]+)\s*(?:([~^$*|]?=)\s*["']?([^"'\]]*)["']?)?\s*\]$/);
        if (!am) return false;
        const v = attrs[am[1].toLowerCase()];
        if (v === undefined) return false;
        if (am[2] === '=' && v !== am[3]) return false;
        if (am[2] === '~=' && !v.split(/\s+/).includes(am[3])) return false;
        if (am[2] === '^=' && !v.startsWith(am[3])) return false;
        if (am[2] === '$=' && !v.endsWith(am[3])) return false;
        if (am[2] === '*=' && !v.includes(am[3])) return false;
      }
    }
    return true;
  });
}

const FORM_RE = /<form\b([^>]*)>([\s\S]*?)<\/form\s*>/gi;
const INPUT_RE = /<(input|textarea|select|button)\b([^>]*)>/gi;

/** Find forms with their attributes and fields. */
function findForms(html) {
  const forms = [];
  for (const m of html.matchAll(FORM_RE)) {
    const attrs = parseAttrs(m[1]);
    const fields = [...m[2].matchAll(INPUT_RE)].map((x) => ({ tag: x[1].toLowerCase(), attrs: parseAttrs(x[2]) }));
    const line = html.slice(0, m.index).split('\n').length;
    forms.push({ index: m.index, length: m[0].length, open: m[1], inner: m[2], attrs, fields, line });
  }
  return forms;
}

const esc = (s) => String(s).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
const HIDE = 'position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden';
const honeypotMarkup = (names) =>
  `<div aria-hidden="true" style="${HIDE}"><label>Leave this field empty<input type="text" name="${esc(names.honeypot)}" value="" tabindex="-1" autocomplete="off"></label></div>` +
  `<input type="hidden" name="${esc(names.token)}" value="">`;

/** Client config passed to the runtime via data-form-guard on its <script> tag. */
function clientConfig(o, names) {
  return { forms: o.forms, honeypot: names.honeypot, token: names.token, js: names.js, signals: names.signals, tokenEndpoint: o.tokenEndpoint, jsProof: o.requireJs !== false };
}
function scriptTag({ src, inline, config }) {
  const attr = ` data-form-guard="${esc(JSON.stringify(config))}"`;
  return inline ? `<script${attr}>${String(inline).replace(/<\/script/gi, '<\\/script')}</script>` : `<script defer src="${esc(src)}"${attr}></script>`;
}

/**
 * Add honeypot markup + data attributes to matching forms and (optionally) the runtime <script>.
 * Returns { html, changed, forms: [{ line, attrs, guarded }], warnings: [{ id, message, line }] }.
 */
function transformHtml(html, { forms: selector = 'form[data-guard]', names, script, always = false, warn = true } = {}) {
  const report = [];
  const warnings = [];
  let out = '';
  let last = 0;
  for (const f of findForms(html)) {
    const isMatch = matches(f.attrs, selector);
    report.push({ line: f.line, attrs: f.attrs, guarded: isMatch });
    if (!isMatch) continue;
    const label = f.attrs.id ? `#${f.attrs.id}` : f.attrs.name ? `[name=${f.attrs.name}]` : f.attrs.action ? `action=${f.attrs.action}` : `line ${f.line}`;
    if (warn) {
      if ((f.attrs.method || 'get').toLowerCase() !== 'post') warnings.push({ id: 'fg/method-not-post', line: f.line, form: label, message: `form ${label} uses method="${f.attrs.method || 'get (default)'}"; guarded fields would end up in URLs and logs`, fix: 'add method="post" to the form' });
      if (!('action' in f.attrs)) warnings.push({ id: 'fg/no-action', line: f.line, form: label, message: `form ${label} has no action attribute, so it posts to the page URL`, fix: 'set action="/your/endpoint" that runs verify()' });
      if (!('data-fg-guarded' in f.attrs) && f.fields.some((x) => x.attrs.name === names.honeypot)) warnings.push({ id: 'fg/honeypot-collision', line: f.line, form: label, message: `form ${label} already has a field named "${names.honeypot}"`, fix: 'rename that field or pass a different seed to the plugin' });
    }
    if ('data-fg-guarded' in f.attrs) continue; // idempotent: already processed
    const openTag = `<form${f.open.replace(/\s*\/?$/, '')} data-fg-guarded>`;
    const inner = f.fields.some((x) => x.attrs.name === names.honeypot) ? '' : honeypotMarkup(names);
    out += html.slice(last, f.index) + openTag + inner + f.inner + '</form>';
    last = f.index + f.length;
  }
  out += html.slice(last);
  if (script && (always || report.some((r) => r.guarded)) && !/data-form-guard=/.test(out)) {
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${script}</head>`) : /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${script}</body>`) : out + script;
  }
  return { html: out, changed: out !== html, forms: report, warnings };
}

module.exports = { esc, makeNames, parseAttrs, matches, findForms, transformHtml, honeypotMarkup, clientConfig, scriptTag, HONEYPOT_BASES };
