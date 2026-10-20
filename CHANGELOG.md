# Changelog

## 1.2.1 - 2026-10-20

- Release workflow installs dependencies before publishing (the GitHub Packages publish previously failed).
- No changes to the package code.

## 1.2.0 — 2026-10-15

- Optional client `credit` / `creditTarget` on `init()` (and `data-form-guard`): when `credit: true`, appends a small CSP-safe link (`class="fg-credit"`, no inline styles). Off by default; no network or tracking.


## 1.1.0 — 2026-10-14

- **Proof-of-work (Altcha-style, opt-in):** `pow: true | { maxnumber, require, field }` on server helpers; token endpoint returns a signed challenge; optional `form-honeypot-guard/runtime-pow` client add-on (privacy-friendly, no captcha vendor).
- **Distributed stores:** `form-honeypot-guard/adapters` — Redis, Upstash, Cloudflare KV and Durable Object helpers that accept user-provided clients (zero hard runtime deps).
- **Framework helpers:** SvelteKit (`sveltekitHandle`, `sveltekitAction`), Remix (`remixAction`, `remixTokenLoader`), Astro (`astroPost`, `astroRoute`), React (`GuardedForm`, `useFormGuardInit`) under `form-honeypot-guard/react` (optional `react` peer).
- **Dual package build:** CommonJS `dist/*.cjs` for `require()` alongside ESM `src/*.js`; types synced to `dist/*.d.ts` via `npm run build`.
- **CI:** import + require smoke tests; release job runs `npm run build` before publish with provenance.

## 1.0.2 — 2026-10-13

- CI: harden workflows (actions pinned to SHAs, least-privilege permissions, persist-credentials: false)

## 1.0.0 — 2026-10-13

- Initial release.
- Webpack 5 plugin (`form-honeypot-guard/webpack`, ESM + CJS): build-time honeypot markup in emitted HTML (html-webpack-plugin output and plain `.html` assets), runtime injection (asset or inline, via HWP's tag hooks when present), per-build randomised field names, `form-guard.manifest.json` + `manifestPath`, virtual module `form-guard/config`, `compilation.warnings` for non-POST forms, missing `action` and honeypot name collisions, dev-mode logging.
- Vite plugin (`transformIndexHtml`, virtual module, manifest).
- Client runtime under 2 kB gzipped with no dependencies: accessible off-screen honeypot, token fetch, JS proof, interaction signals, `formData()`/`json()` helpers for fetch/XHR, `guardRef` for React/Vue, MutationObserver for forms added later.
- Server: `verify()` with HMAC-signed timestamp tokens, min/max time, tamper and replay detection (pluggable nonce store), interaction score, content heuristics; sliding-window rate limiting (pluggable store); trusted-proxy aware IP detection.
- Adapters: Express/Connect, Fastify, Next.js (app and pages routers), Web Fetch API (Netlify/Vercel/Cloudflare); 429 + `Retry-After`; silent mode.
- CLI: `check <dir>` form audit (header-sentinel style output, exit codes 0/1/2) and `secret`.
