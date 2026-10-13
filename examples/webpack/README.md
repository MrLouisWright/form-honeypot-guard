# webpack + Express example

```bash
npm i            # in the repo root (installs webpack, html-webpack-plugin, express as devDependencies)
cd examples/webpack
node build.cjs     # or: npx webpack --config webpack.config.cjs
FORM_GUARD_SECRET=$(npx form-honeypot-guard secret) node server/server.js
```

Open http://localhost:3000, wait three seconds, submit. Then try the bot-style `curl` requests in the main README.
