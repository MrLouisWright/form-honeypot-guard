import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import html from './html.cjs';

const { findForms } = html;
const PERSONAL = /(e-?mail|phone|tel|mobile|password|passwd|card|cvc|cvv|iban|ssn|postcode|zip|address|dob|birth)/i;
const CSRF = /(csrf|xsrf|_token|authenticity_token|__requestverificationtoken|nonce)/i;

export const RULES = {
  'fg/no-honeypot': 'POST form without a honeypot',
  'fg/runtime-only': 'Form relies on the client runtime for its honeypot',
  'fg/get-personal-data': 'GET form sends personal data in the URL',
  'fg/no-csrf': 'No CSRF token field',
  'fg/no-action': 'Form has no action',
  'fg/honeypot-display-none': 'Honeypot hidden with display:none / type=hidden',
  'fg/honeypot-focusable': 'Honeypot is reachable by keyboard or autofill',
};

const finding = (id, severity, message, fix) => ({ id, severity, title: RULES[id], message, fix });

/** Audit the forms in one HTML string. */
export function checkHtml(text) {
  const findings = [];
  const forms = findForms(text);
  const hasRuntime = /data-form-guard=|form-guard[.\w-]*\.js/.test(text);
  for (const f of forms) {
    const where = `line ${f.line}${f.attrs.id ? ` #${f.attrs.id}` : ''}${f.attrs.action ? ` (action=${f.attrs.action})` : ''}`;
    const method = (f.attrs.method || 'get').toLowerCase();
    const fields = f.fields.filter((x) => x.tag !== 'button');
    const named = fields.filter((x) => x.attrs.name !== undefined);
    if (!named.length && method === 'get' && fields.length <= 1) continue; // search boxes etc.
    const hpInputs = [...f.inner.matchAll(/<div\b[^>]*aria-hidden=["']?true[^>]*>([\s\S]*?)<\/div>/gi)];
    const guarded = 'data-fg-guarded' in f.attrs || hpInputs.some((m) => /<input\b[^>]*tabindex=["']?-1/i.test(m[1]));
    if (method === 'post') {
      if (!guarded && ('data-guard' in f.attrs || 'data-fg' in f.attrs) && hasRuntime) findings.push(finding('fg/runtime-only', 'warn', `form at ${where} gets its honeypot only once JavaScript runs`, 'build with FormGuardPlugin / the Vite plugin so the markup is in the HTML'));
      else if (!guarded) findings.push(finding('fg/no-honeypot', 'error', `form at ${where} posts without a honeypot field`, 'add data-guard to the form and build with FormGuardPlugin\nor render issueFields().html inside the form'));
      if (!named.some((x) => CSRF.test(x.attrs.name))) findings.push(finding('fg/no-csrf', 'warn', `form at ${where} has no CSRF token field`, 'add a hidden CSRF token (or rely on SameSite=Strict cookies and check Origin)'));
    } else {
      const personal = named.filter((x) => ['password', 'email', 'tel'].includes((x.attrs.type || '').toLowerCase()) || PERSONAL.test(x.attrs.name));
      if (personal.length) findings.push(finding('fg/get-personal-data', 'error', `form at ${where} uses GET and sends ${personal.map((x) => x.attrs.name).join(', ')} in the query string`, 'add method="post"'));
    }
    if (!('action' in f.attrs) && method === 'post') findings.push(finding('fg/no-action', 'warn', `form at ${where} has no action, so it posts back to the page URL`, 'set action="/api/contact" (an endpoint that calls verify())'));
    for (const x of fields) {
      const n = x.attrs.name || '';
      if (!/(website|url|homepage|fax|honey|hp_|middle_name|confirm_email)/i.test(n)) continue;
      const hiddenByDisplay = /display\s*:\s*none|visibility\s*:\s*hidden/i.test(x.attrs.style || '') || (x.attrs.type || '').toLowerCase() === 'hidden' || 'hidden' in x.attrs;
      if (hiddenByDisplay) findings.push(finding('fg/honeypot-display-none', 'warn', `field "${n}" at ${where} looks like a honeypot hidden with display:none/type=hidden, which most bots skip`, 'move it off-screen (position:absolute;left:-10000px) inside aria-hidden="true"'));
      else if (guarded && (x.attrs.tabindex !== '-1' || (x.attrs.autocomplete || '').toLowerCase() !== 'off')) findings.push(finding('fg/honeypot-focusable', 'warn', `honeypot "${n}" at ${where} lacks tabindex="-1" or autocomplete="off"`, 'add tabindex="-1" autocomplete="off" so keyboard users and autofill skip it'));
    }
  }
  return { forms: forms.length, findings };
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.html?$/i.test(name)) out.push(p);
  }
  return out;
}

/** Audit every .html file under dir. Returns [{ file, forms, findings }]. */
export function checkDir(dir) {
  return walk(dir).map((file) => ({ file: relative(process.cwd(), file) || file, ...checkHtml(readFileSync(file, 'utf8')) }));
}
