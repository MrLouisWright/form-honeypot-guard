# Changelog

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
