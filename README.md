# form-honeypot-guard

[![npm](https://img.shields.io/npm/v/form-honeypot-guard.svg)](https://www.npmjs.com/package/form-honeypot-guard)
[![CI](https://github.com/MrLouisWright/form-honeypot-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/MrLouisWright/form-honeypot-guard/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![zero deps](https://img.shields.io/badge/dependencies-0-success)
![client <2 kB gz](https://img.shields.io/badge/client-%3C2%20kB%20gz-success)

Block form spam bots **without a captcha**. It layers cheap checks that most bots fail and real people never notice:

- an off-screen, accessible **honeypot** field with a randomised, realistic name
- an **HMAC-signed timestamp token**, so submissions can't come too fast, too late, tampered with or replayed
- a **JS proof** field that only a real browser fills in (configurable for progressive enhancement)
- light **interaction signals**: keypress, pointer and focus counts
- optional **content heuristics** (link spam, URLs in name fields, spam keywords, unexpected scripts)
- **sliding-window rate limiting** per IP (and optionally per email or fingerprint), with a correct `429` and `Retry-After`
- optional **proof-of-work** (Altcha-style, privacy-friendly — no captcha vendor) for stronger bot resistance

The **webpack plugin** is the main way in. It adds the honeypot markup to your built HTML at build time, injects the tiny client runtime, randomises field names on every build and writes a manifest so client and server use the same names. There's also a Vite plugin, plus server helpers for Express/Connect, Fastify, Next.js, SvelteKit, Remix, Astro and any Web Fetch runtime (Netlify, Vercel, Cloudflare, Deno, Bun), plus an optional React wrapper. Zero runtime dependencies, Node ≥ 18, **dual ESM + CommonJS** (`import` / `require`), TypeScript types in `dist/*.d.ts` (generated in CI via `npm run build`). Tests live under [`test/`](test/) and run in [GitHub Actions CI](.github/workflows/ci.yml).

## Install

```bash
npm i form-honeypot-guard
npx form-honeypot-guard secret     # generate FORM_GUARD_SECRET
```

## Quick start: webpack (recommended)

Mark the forms you want to protect with `data-guard` (or use `forms: 'all'`):

```html
<form data-guard method="post" action="/contact">
  <input name="email" type="email" required>
  <textarea name="message" required></textarea>
  <button>Send</button>
</form>
```

```js
// webpack.config.js (CommonJS works: the plugin ships a CJS build)
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { FormGuardPlugin } = require('form-honeypot-guard/webpack');

module.exports = {
  plugins: [
    new HtmlWebpackPlugin({ template: './src/index.html' }),
    new FormGuardPlugin({
      forms: 'form[data-guard]',          // or 'all'
      secretEnv: 'FORM_GUARD_SECRET',     // the server reads the secret from this env var
      minTime: 3000,
      manifestPath: 'server/form-guard.manifest.json',
    }),
  ],
};
```

```js
// ESM config
import { FormGuardPlugin } from 'form-honeypot-guard/webpack';
```

What happens on each build:

1. Every emitted HTML file is scanned, whether it came from html-webpack-plugin or is a plain `.html` asset (copy-webpack-plugin, custom loaders). Matching forms get the honeypot markup, an empty token field and `data-fg-guarded` **in the HTML**, so the trap is there before any JavaScript loads.
2. The client runtime (about 1.3 kB gzipped) is emitted as `form-guard.[contenthash:8].js` and added as a `<script defer>`. When html-webpack-plugin is installed it goes through HWP's own tag pipeline (`alterAssetTagGroups`). HWP isn't required. Pass `inline: true` to inline the runtime instead.
3. Field names are randomised per build (`middle_name_28e1`, `fg_t_5b57f4`, …) and written to `form-guard.manifest.json` (plus `manifestPath` if you set it). The manifest holds names and timings only, never the secret.
4. The virtual module `form-guard/config` exposes the same manifest to your bundle: `import { fields } from 'form-guard/config'`.
5. Warnings appear in `compilation.warnings` for guarded forms that don't use `method="post"`, have no `action`, or already contain a field with the honeypot's name.

It hooks `compilation.hooks.processAssets` at `PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE + 1`, so it runs right after html-webpack-plugin. Names are generated once per plugin instance, which keeps watch-mode rebuilds and the persistent cache stable. Pass `seed` for reproducible names across builds. In development mode it logs what it guarded through webpack's infrastructure logger.

Then the server:

```js
import express from 'express';
import { expressGuard, cleanFields } from 'form-honeypot-guard';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(expressGuard({ manifest: 'server/form-guard.manifest.json', paths: ['/contact'] }));
app.post('/contact', (req, res) => {
  sendEmail(cleanFields(req.body, { manifest: 'server/form-guard.manifest.json' }));
  res.redirect('/thanks');
});
app.use(express.static('dist'));
```

`expressGuard` also serves `GET /__form-guard/token`. The runtime fetches a fresh signed token from it when the page loads.

## Vite

```js
// vite.config.js
import { formGuard } from 'form-honeypot-guard/vite';
export default { plugins: [formGuard({ forms: 'form[data-guard]' })] };
```

Uses `transformIndexHtml` to add the honeypot markup and the inlined runtime, serves `form-guard/config` as a virtual module and emits `form-guard.manifest.json` in the build.

## Express / Connect

```js
app.use(expressGuard({
  manifest: 'dist/form-guard.manifest.json',
  paths: ['/contact', '/api/*'],            // default: every POST
  rateLimit: { limit: 5, windowMs: 60_000, keys: ['ip', 'email'] },
  trustProxy: 1,                            // behind one reverse proxy
  silent: false,                            // true: bots get a fake 200 { ok: true }
  onBlock: (result, { ip }) => log.info({ ip, ...result }),
}));
```

It works with or without body parsers: it reads urlencoded and JSON bodies itself if `req.body` is unset. For multipart, run your parser first. The result is on `req.formGuard` (`{ ok, reasons, score }`).

## Next.js

App router (`app/api/contact/route.js`):

```js
import { nextRoute } from 'form-honeypot-guard';

export const { GET, POST } = nextRoute(async (request, ctx, guard) => {
  await sendEmail(guard.fields);
  return Response.json({ ok: true });
}, { tokenEndpoint: '/api/contact', rateLimit: { limit: 5, windowMs: 60_000 } });
```

Pages router (`pages/api/contact.js`):

```js
import { withFormGuardApi } from 'form-honeypot-guard';
export default withFormGuardApi((req, res) => res.status(200).json({ ok: true }));
```

React client:

```jsx
import { init, guardRef, json } from 'form-honeypot-guard/client';
useEffect(() => { init({ forms: 'form[data-guard]', tokenEndpoint: '/api/contact' }); }, []);

<form data-guard ref={guardRef} onSubmit={async (e) => {
  e.preventDefault();
  await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await json(e.currentTarget)) });
}}>
```

For Vue, use `onMounted(() => init())` and `ref` on the form, or `:ref="guardRef"`.

### React component

```jsx
import { useRef } from 'react';
import { GuardedForm } from 'form-honeypot-guard/react';

const formRef = useRef(null);
<GuardedForm ref={formRef} guardOptions={{ tokenEndpoint: '/api/contact' }} onSubmit={async (e) => {
  e.preventDefault();
  await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await formRef.current.json()) });
}}>
  …
</GuardedForm>
```

Or keep using `init()` + `guardRef` from `form-honeypot-guard/client` (no React peer required).

## SvelteKit

`hooks.server.js`:

```js
import { sveltekitHandle } from 'form-honeypot-guard/sveltekit';
export const handle = sveltekitHandle({ manifest: 'build/form-guard.manifest.json', paths: ['/contact'] });
```

Form action:

```js
import { sveltekitAction } from 'form-honeypot-guard/sveltekit';
export const actions = {
  default: sveltekitAction(async (event, guard) => { /* guard.fields */ }),
};
```

## Remix

```js
import { remixAction } from 'form-honeypot-guard/remix';
export const action = remixAction(async ({ request, guard }) => json({ ok: true }));
```

## Astro

```js
import { astroRoute } from 'form-honeypot-guard/astro';
export const { GET, POST } = astroRoute(async ({ request, guard }) => new Response('Thanks'));
```

## Fastify

```js
import formbody from '@fastify/formbody';
import { fastifyGuard } from 'form-honeypot-guard';

await app.register(formbody);
await app.register(fastifyGuard, { manifest: 'dist/form-guard.manifest.json', paths: ['/contact'] });
app.post('/contact', async (req) => ({ ok: true, score: req.formGuard.score }));
```

## Netlify / Vercel / Cloudflare (Web Fetch API)

```js
import { withFormGuard } from 'form-honeypot-guard';

export default withFormGuard(async (request, ctx, guard) => new Response('Thanks!'), {
  secret: env.FORM_GUARD_SECRET,
  ipHeader: 'cf-connecting-ip',     // or 'x-nf-client-connection-ip', 'x-real-ip'
});
```

`createFetchGuard(opts)` returns `guard(request) → { ok, result, fields, response? }` if you want to handle the response yourself. On these platforms `trustProxy` defaults to `true`.

## Plain HTML / server-rendered forms

Without a bundler, add the runtime and opt forms in:

```html
<form data-guard method="post" action="/contact">…</form>
<script defer src="/node_modules/form-honeypot-guard/src/runtime.js" data-form-guard='{"forms":"form[data-guard]"}'></script>
```

When the server renders the page, put a token in directly so no fetch is needed:

```js
import { issueFields } from 'form-honeypot-guard';
const guard = issueFields();          // { html, token, fields }
res.send(`<form data-guard method="post" action="/contact">${guard.html} …</form>`);
```

Using it framework-agnostically:

```js
import { verify } from 'form-honeypot-guard';
const { ok, reasons, score } = await verify(fields /* object | FormData | URLSearchParams */, { manifest });
```

## How it works

| Check | Bot it stops | Reason code |
|---|---|---|
| Honeypot field filled | Form-fillers that complete every input | `honeypot` |
| Token missing / bad HMAC | Bots posting straight to the endpoint, forged tokens | `token-missing`, `token-invalid` |
| Token younger than `minTime` | Scripts that submit instantly | `too-fast` |
| Token older than `maxAge` | Harvested tokens reused later | `token-expired` |
| Nonce already used | Replays (in-memory LRU, pluggable `nonceStore`) | `token-replayed` |
| JS proof missing | HTTP-only bots that scrape the token from HTML | `js-missing` |
| No keypress/pointer/focus | Headless scripts that set values directly (scored) | `no-interaction`, `signals-missing` |
| Content heuristics | Link spam, SEO spam (scored) | `content-*` |
| Sliding-window rate limit | Floods | `rate-limited` (429) |
| Proof-of-work (opt-in) | Headless farms without CPU work | `pow-missing`, `pow-invalid`, `pow-expired` |

Token format: `<issuedAtMs>.<nonce>.<HMAC-SHA256(secret, issuedAtMs.nonce)>`, signed with `node:crypto` and compared in constant time. The JS proof is a value derived from the token that the runtime writes in the browser.

Hard failures (`honeypot`, token problems, `too-fast`, `js-missing`) reject outright. Soft signals add to `score`, and a submission fails once `score >= threshold` (default 5).

## Accessibility

- The honeypot sits inside `<div aria-hidden="true">`, so screen readers skip it. It's moved off-screen with `position:absolute;left:-10000px`. It is **not** hidden with `display:none`, which many bots check for.
- The input has `tabindex="-1"`, so keyboard users never land on it, and `autocomplete="off"`, so password managers and autofill don't fill it.
- Its label reads "Leave this field empty" in case an assistive technology ever exposes it.
- There's no captcha, no puzzle and no timer UI. `minTime` (3 s) is far below how long a person takes to fill in a form. Lower it for one-field forms such as newsletter signups.

## Config

### Webpack plugin (`new FormGuardPlugin(options)`)

| Option | Default | |
|---|---|---|
| `forms` | `'form[data-guard]'` | Selector (`form`, `.cls`, `#id`, `[attr]`, `[attr=v]`, comma lists) or `'all'` |
| `secretEnv` | `'FORM_GUARD_SECRET'` | Env var the server reads the secret from (recorded in the manifest) |
| `minTime` / `maxAge` | `3000` / `7200000` | ms |
| `requireJs` | `true` | `true`, `'soft'` (adds score only) or `false` |
| `tokenEndpoint` | `'/__form-guard/token'` | Where the runtime fetches tokens |
| `inject` | `'auto'` | `'auto'` (pages with guarded forms), `'always'` (SPA forms rendered later), `false` |
| `inline` | `false` | Inline the runtime instead of emitting an asset |
| `filename` | `'form-guard.[contenthash:8].js'` | Runtime asset name |
| `manifest` | `'form-guard.manifest.json'` | Asset name, or `false` |
| `manifestPath` | `null` | Also write the manifest here (relative to webpack `context`) |
| `seed` | random | Fixed seed for stable field names |
| `fields` | generated | Override any of `{ honeypot, token, js, signals }` |
| `html` | `/\.html?$/i` | Which assets to scan |
| `warnings` | `true` | Push warnings to `compilation.warnings` |
| `verbose` | dev mode | Log through the infrastructure logger |

The Vite plugin (`formGuard(options)`) takes the same options apart from `inline`, `filename`, `manifestPath`, `html` and `verbose`.

### Server (`verify`, `expressGuard`, `fastifyGuard`, `withFormGuard`, …)

| Option | Default | |
|---|---|---|
| `secret` | `process.env[secretEnv]` | At least 16 chars. `npx form-honeypot-guard secret` |
| `manifest` | none | Path or object from the plugin. Supplies field names, timings and `secretEnv` |
| `fields` | `website_url`, `fg_token`, `fg_js`, `fg_sig` | Field names when you don't use a manifest |
| `minTime` / `maxAge` | `3000` / `7200000` | ms |
| `requireToken` | `true` | `false` turns a missing token into a soft signal |
| `requireJs` | `true` | `true`, `'soft'`, `false` |
| `minInteractions` | `1` | Minimum keypress + pointer + focus events |
| `threshold` | `5` | Score at which a submission fails |
| `content` | `{}` | `{ maxLinks: 2, nameFields, keywords, scripts: ['Latin'], scriptRatio: 0.3, ignore }` or `false` |
| `nonceStore` | in-memory LRU (10k) | `{ use(nonce, ttlMs) → Promise<boolean> }` |
| `rateLimit` | `{ limit: 5, windowMs: 60000, keys: ['ip'] }` | Keys `'ip'`, `'email'`, `'fingerprint'` or a function. `false` turns it off |
| `silent` | `false` | Fake success (`200 {"ok":true}`) for rejected bots. Rate limits still return 429 |
| `silentResponse` | `{ status: 200, body: '{"ok":true}' }` | Or a function, e.g. a redirect |
| `trustProxy` | `false` (`true` for fetch) | `true`, a number of hops or a list of proxy IPs |
| `ipHeader` | none | e.g. `'cf-connecting-ip'`. Only read when `trustProxy` is set |
| `paths` / `methods` | all / `['POST']` | What to guard |
| `onBlock` | none | `(result, ctx) => {}` |
| `pow` | `false` | `true` or `{ maxnumber, require: true \| 'soft', field }` — Altcha-style PoW on the token endpoint |
| `powMaxAge` | `maxAge` | Challenge TTL for PoW payloads |

### Client (`init(options)` or `data-form-guard='{…}'`)

`forms`, `honeypot`, `token`, `js`, `signals`, `pow`, `tokenEndpoint`, `fetchToken` (`true`), `jsProof` (`true`), `observe` (`true`, enhances forms added later via MutationObserver). Helpers: `enhance(form)`, `formData(form)`, `json(form)`, `guardRef(el)`.

When `pow` is enabled on the server, load the optional solver after the main runtime:

```html
<script defer src="/form-guard.js"></script>
<script defer src="/node_modules/form-honeypot-guard/src/runtime-pow.js"></script>
```

### Distributed stores (`form-honeypot-guard/adapters`)

Pass your own Redis, Upstash, Cloudflare KV or Durable Object client — nothing is bundled.

```js
import { createClient } from 'redis';
import { expressGuard } from 'form-honeypot-guard';
import { redisNonceStore, redisRateLimitStore } from 'form-honeypot-guard/adapters';

const redis = createClient(); await redis.connect();
app.use(expressGuard({
  nonceStore: redisNonceStore(redis),
  rateLimit: { store: redisRateLimitStore(redis), limit: 5, windowMs: 60_000 },
}));
```

Also: `upstashNonceStore`, `upstashRateLimitStore`, `cloudflareKvNonceStore`, `cloudflareKvRateLimitStore`, `durableObjectNonceStore`, `durableObjectRateLimitStore`.

Use shared stores whenever you run more than one server instance.

## CLI

```
npx form-honeypot-guard check [dir]     audit built HTML forms (default: dist)
npx form-honeypot-guard secret [--env]  print a new HMAC secret
```

`check` options: `--json` and `--strict` (warnings count as errors). Exit codes: **0** ok, **1** problems found, **2** usage or runtime error. Output respects `NO_COLOR`.

```
dist/contact.html (2 forms)
  ✖ error POST form without a honeypot [fg/no-honeypot]
          form at line 1 (action=/c) posts without a honeypot field
          fix: add data-guard to the form and build with FormGuardPlugin
  ✖ error GET form sends personal data in the URL [fg/get-personal-data]
          form at line 1 (action=/news) uses GET and sends email in the query string
          fix: add method="post"
```

| Rule | Severity |
|---|---|
| `fg/no-honeypot`: POST form without a honeypot | error |
| `fg/get-personal-data`: GET form with email/password/phone/… fields | error |
| `fg/runtime-only`: honeypot only added by JS | warn |
| `fg/no-csrf`: POST form without a CSRF field | warn |
| `fg/no-action`: POST form without `action` | warn |
| `fg/honeypot-display-none`: honeypot hidden with `display:none`/`type=hidden` | warn |
| `fg/honeypot-focusable`: honeypot missing `tabindex="-1"`/`autocomplete="off"` | warn |

## Example

`examples/webpack` contains a real webpack 5 + html-webpack-plugin build (with a CommonJS config) and an Express server. Results from `curl`:

```
1. human (token, waited 3.2 s, JS proof, interactions)   200 {"ok":true}
1b. replay of the same token                              400 ["token-replayed"]
2. dumb bot filling every field                           400 ["honeypot","token-missing","signals-missing"]
3. scripted bot submitting instantly                      400 ["too-fast","no-interaction"]
4. no-JS bot with a scraped token                         400 ["js-missing","signals-missing"]
5. tampered token                                         400 ["token-invalid"]
6. SEO spam with a valid token                            400 ["content-links","content-url-in-name","content-keywords"]
7. flood from one IP                                      429 Retry-After: 54
8. honeypot bot with SILENT=1                             200 {"ok":true}  (fake)
```

## API

Main export: `verify`, guards, PoW helpers (`createPowChallenge`, `verifyPow`, …), stores, and framework adapters listed above. Subpaths: `form-honeypot-guard/client`, `/runtime`, `/runtime-pow`, `/adapters`, `/pow`, `/react`, `/sveltekit`, `/remix`, `/astro`, `/webpack` (ESM + CJS), `/vite`, `/check`. All Node entry points support **`require()`** via `dist/*.cjs` after `npm run build` (CI runs this automatically).

## Limitations

- This stops automated, untargeted spam. A **determined, targeted bot** (a real headless browser driven for your site, or people paid to fill in forms) can wait out `minTime`, run the JS and fake interaction events. For high-value targets, add server-side moderation, email verification or a captcha fallback when `score` is borderline.
- The in-memory nonce and rate-limit stores are per process. With several instances or serverless, use a shared store (see Redis above). Without one, a replay on another instance isn't caught.
- Pages served from a CDN need the token endpoint (or `issueFields()`) on a server you control. The token is never baked into static HTML at build time.
- With `requireJs: true`, visitors with JavaScript turned off can't submit. Use `'soft'` or `false` to let them through on the remaining checks.
- Build-time HTML handling uses a careful regex tokenizer rather than a full HTML5 parser, and its selector support is a small subset of CSS. The runtime uses the browser's real `querySelectorAll`.
- Content heuristics are deliberately simple and English-leaning. Tune `keywords`/`scripts` or set `content: false`.

## Releasing

```bash
npm version patch   # or minor / major — bumps package.json, commits and tags
git push --follow-tags
```

Then create a GitHub release from the new tag. `.github/workflows/release.yml` runs the tests on Node 22 and publishes to npmjs (`npm publish --provenance`, needs the `NPM_TOKEN` secret) and to GitHub Packages as `@mrlouiswright/form-honeypot-guard`. Versions that already exist are skipped.

## Part of a set

- [header-sentinel](https://www.npmjs.com/package/header-sentinel): fail CI on missing or misconfigured HTTP security headers.
- [csp-forge](https://www.npmjs.com/package/csp-forge): generate a Content-Security-Policy.
- [bundle-secret-guard](https://www.npmjs.com/package/bundle-secret-guard): fail the build when secrets ship to the browser.
- **form-honeypot-guard**: block form spam without a captcha.

## Support

If this project is useful to you, you can support its development with a donation: [Buy me a coffee](https://donate.stripe.com/aFa00lek3cvX4Ds2Fk9EI0b). It helps keep these tools maintained, documented and free for everyone.

## Credit (optional)

Free to use under MIT, no attribution required. If form-honeypot-guard helps you, a link back is appreciated:

```html
<a href="https://louiswright.co.uk">Built with form-honeypot-guard by Louis Wright</a>
```

```markdown
[![Built with form-honeypot-guard by Louis Wright](https://img.shields.io/badge/built%20with-form--honeypot--guard-blue)](https://louiswright.co.uk)
```

## License

MIT © Louis Wright ([Louis Wright](https://github.com/MrLouisWright))
