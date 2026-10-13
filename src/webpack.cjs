'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeNames, transformHtml, clientConfig, scriptTag, esc } = require('./html.cjs');

const PLUGIN = 'FormGuardPlugin';
const VIRTUAL_IDS = new Set(['form-guard/config', 'form-honeypot-guard/config']);
let runtimeSource;
const readRuntime = () => (runtimeSource ??= fs.readFileSync(path.join(__dirname, 'runtime.js'), 'utf8'));

const DEFAULTS = {
  forms: 'form[data-guard]',   // CSS-ish selector or 'all'
  secretEnv: 'FORM_GUARD_SECRET',
  minTime: 3000,
  maxAge: 2 * 60 * 60 * 1000,
  requireJs: true,
  tokenEndpoint: '/__form-guard/token',
  inject: 'auto',              // 'auto' (pages with guarded forms) | 'always' | false
  inline: false,               // inline the runtime instead of emitting an asset
  filename: 'form-guard.[contenthash:8].js',
  manifest: 'form-guard.manifest.json',
  manifestPath: null,          // also write the manifest here (absolute or relative to webpack context)
  seed: undefined,             // fixed seed -> stable field names across builds
  html: /\.html?$/i,           // which emitted assets to scan
  warnings: true,
  verbose: undefined,          // default: true in development mode
};

class FormGuardPlugin {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    if (!['auto', 'always', false].includes(this.options.inject)) throw new Error(`${PLUGIN}: inject must be 'auto', 'always' or false`);
    // Generated once per plugin instance, so watch-mode rebuilds keep the same names (and the cache stays warm).
    this.names = { ...makeNames(this.options.seed), ...(this.options.fields || {}) };
    this.buildId = crypto.createHash('sha256').update(JSON.stringify(this.names)).digest('hex').slice(0, 12);
  }

  /** The manifest the server reads (never contains the secret, only the env var name). */
  manifest() {
    const o = this.options;
    return { name: 'form-honeypot-guard', version: 1, buildId: this.buildId, forms: o.forms, fields: this.names, minTime: o.minTime, maxAge: o.maxAge, requireJs: o.requireJs, secretEnv: o.secretEnv, tokenEndpoint: o.tokenEndpoint };
  }

  configModule() {
    return `export const manifest = ${JSON.stringify(this.manifest())};\nexport const fields = manifest.fields;\nexport default manifest;\n`;
  }

  apply(compiler) {
    const { webpack } = compiler;
    if (!webpack || !webpack.Compilation || !webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE) throw new Error(`${PLUGIN} needs webpack 5`);
    const { Compilation, sources, WebpackError } = webpack;
    const o = this.options;
    const logger = compiler.getInfrastructureLogger(PLUGIN);
    const verbose = o.verbose ?? compiler.options.mode !== 'production';
    const runtime = readRuntime();
    const runtimeHash = crypto.createHash('sha256').update(runtime).digest('hex');
    const config = clientConfig(o, this.names);
    const manifestJson = JSON.stringify(this.manifest(), null, 2) + '\n';
    const virtual = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(this.configModule());

    // Virtual module: import manifest from 'form-guard/config'
    compiler.hooks.normalModuleFactory.tap(PLUGIN, (nmf) => {
      nmf.hooks.beforeResolve.tap(PLUGIN, (data) => { if (data && VIRTUAL_IDS.has(data.request)) data.request = virtual; });
    });

    let HtmlWebpackPlugin = null;
    try { HtmlWebpackPlugin = require(require.resolve('html-webpack-plugin', { paths: [compiler.context, process.cwd(), __dirname] })); } catch { /* optional */ }

    compiler.hooks.thisCompilation.tap(PLUGIN, (compilation) => {
      const runtimeFile = o.inline ? null : compilation.getPath(o.filename, { contentHash: runtimeHash.slice(0, 20), chunk: { contentHash: { javascript: runtimeHash.slice(0, 20) } } }).replace(/\[contenthash(?::(\d+))?\]/g, (_, n) => runtimeHash.slice(0, n ? +n : 20));
      const publicPath = compilation.outputOptions.publicPath;
      const srcFor = (htmlFile) => {
        if (typeof publicPath === 'string' && publicPath !== 'auto' && publicPath !== '') return publicPath.replace(/\/?$/, '/') + runtimeFile;
        return path.posix.relative(path.posix.dirname(htmlFile), runtimeFile) || runtimeFile;
      };
      const tagFor = (htmlFile) => scriptTag({ src: o.inline ? null : srcFor(htmlFile), inline: o.inline ? runtime : null, config });

      // Preferred path when html-webpack-plugin is used: add the <script> through its own tag pipeline.
      let hwpUsed = false;
      const hwpHooks = HtmlWebpackPlugin && typeof HtmlWebpackPlugin.getHooks === 'function' ? HtmlWebpackPlugin.getHooks(compilation) : null;
      if (hwpHooks && o.inject) {
        hwpHooks.alterAssetTagGroups.tap(PLUGIN, (data) => {
          hwpUsed = true;
          const file = data.outputName || 'index.html';
          // html-webpack-plugin does not escape attribute values, so do it here.
          const attributes = { 'data-form-guard': esc(JSON.stringify(config)) };
          if (!o.inline) Object.assign(attributes, { defer: true, src: esc(srcFor(file)) });
          data.headTags.push({ tagName: 'script', voidTag: false, meta: { plugin: PLUGIN }, attributes, innerHTML: o.inline ? runtime.replace(/<\/script/gi, '<\\/script') : undefined });
          return data;
        });
      }

      compilation.hooks.processAssets.tap({ name: PLUGIN, stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE + 1 }, (assets) => {
        let guarded = 0;
        let pages = 0;
        for (const file of Object.keys(assets)) {
          if (!o.html.test(file)) continue;
          const src = compilation.getAsset(file).source.source().toString();
          const r = transformHtml(src, { forms: o.forms, names: this.names, script: o.inject ? tagFor(file) : null, always: o.inject === 'always', warn: o.warnings });
          for (const w of r.warnings) {
            const err = new WebpackError(`${PLUGIN} [${w.id}] ${file}:${w.line} ${w.message}\n  fix: ${w.fix}`);
            err.file = file;
            compilation.warnings.push(err);
          }
          const n = r.forms.filter((f) => f.guarded).length;
          if (n) { guarded += n; pages++; }
          if (r.changed) compilation.updateAsset(file, new sources.RawSource(r.html));
          if (verbose && n) logger.info(`${file}: guarded ${n} form(s)`);
        }
        if (!o.inline && o.inject && (pages || hwpUsed || o.inject === 'always') && !compilation.getAsset(runtimeFile)) {
          compilation.emitAsset(runtimeFile, new sources.RawSource(runtime), { immutable: /\[contenthash/.test(o.filename), minimized: false, javascriptModule: false, development: false });
        }
        if (o.manifest) compilation.emitAsset(o.manifest, new sources.RawSource(manifestJson));
        if (verbose) logger.info(`honeypot field "${this.names.honeypot}", ${guarded} form(s) on ${pages} page(s)${o.manifest ? `, manifest ${o.manifest}` : ''}`);
        if (verbose && !guarded) logger.warn(`no forms matched "${o.forms}" in emitted HTML (the runtime still guards forms added later if inject: 'always')`);
      });
    });

    if (o.manifestPath) {
      compiler.hooks.afterEmit.tap(PLUGIN, () => {
        const p = path.resolve(compiler.context, o.manifestPath);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== manifestJson) fs.writeFileSync(p, manifestJson);
      });
    }
  }
}

module.exports = FormGuardPlugin;
module.exports.FormGuardPlugin = FormGuardPlugin;
module.exports.default = FormGuardPlugin;
