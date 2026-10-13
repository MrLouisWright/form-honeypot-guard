import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import html from './html.cjs';

const { makeNames, transformHtml, clientConfig, scriptTag } = html;
const VIRTUAL = new Set(['form-guard/config', 'form-honeypot-guard/config']);
const RESOLVED = '\0form-guard/config';

/** Vite plugin: guards forms in index.html (and any HTML Vite processes) via transformIndexHtml. */
export function formGuard(options = {}) {
  const o = { forms: 'form[data-guard]', secretEnv: 'FORM_GUARD_SECRET', minTime: 3000, maxAge: 7200000, requireJs: true, tokenEndpoint: '/__form-guard/token', inject: 'auto', manifest: 'form-guard.manifest.json', warnings: true, ...options };
  const names = { ...makeNames(o.seed), ...(o.fields || {}) };
  const manifest = { name: 'form-honeypot-guard', version: 1, forms: o.forms, fields: names, minTime: o.minTime, maxAge: o.maxAge, requireJs: o.requireJs, secretEnv: o.secretEnv, tokenEndpoint: o.tokenEndpoint };
  const runtime = readFileSync(fileURLToPath(new URL('./runtime.js', import.meta.url)), 'utf8');
  const script = scriptTag({ inline: runtime, config: clientConfig(o, names) });
  return {
    name: 'form-honeypot-guard',
    resolveId: (id) => (VIRTUAL.has(id) ? RESOLVED : null),
    load: (id) => (id === RESOLVED ? `export const manifest = ${JSON.stringify(manifest)};\nexport const fields = manifest.fields;\nexport default manifest;` : null),
    transformIndexHtml: {
      order: 'post',
      handler(htmlText, ctx) {
        const r = transformHtml(htmlText, { forms: o.forms, names, script: o.inject ? script : null, always: o.inject === 'always', warn: o.warnings });
        for (const w of r.warnings) this?.warn ? this.warn(`[${w.id}] ${ctx?.path || ''}:${w.line} ${w.message}`) : console.warn(`form-honeypot-guard ⚠ [${w.id}] ${ctx?.path || ''}:${w.line} ${w.message}\n  fix: ${w.fix}`);
        return r.html;
      },
    },
    generateBundle() { if (o.manifest) this.emitFile({ type: 'asset', fileName: o.manifest, source: JSON.stringify(manifest, null, 2) + '\n' }); },
    api: { manifest },
  };
}
export default formGuard;
