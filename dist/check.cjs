var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/html.cjs
var require_html = __commonJS({
  "src/html.cjs"(exports2, module2) {
    "use strict";
    var crypto = require("node:crypto");
    var HONEYPOT_BASES = ["website_url", "company_website", "contact_fax", "middle_name", "homepage", "business_url", "alt_email", "phone_ext", "org_site", "secondary_address"];
    function makeNames(seed) {
      const bytes = seed != null ? crypto.createHash("sha256").update(String(seed)).digest() : crypto.randomBytes(32);
      const hex = bytes.toString("hex");
      return {
        honeypot: `${HONEYPOT_BASES[bytes[0] % HONEYPOT_BASES.length]}_${hex.slice(2, 6)}`,
        token: `fg_t_${hex.slice(6, 12)}`,
        js: `fg_j_${hex.slice(12, 18)}`,
        signals: `fg_s_${hex.slice(18, 24)}`
      };
    }
    var ATTR_RE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
    function parseAttrs(s) {
      const out = {};
      for (const m of String(s).matchAll(ATTR_RE)) {
        const k = m[1].toLowerCase();
        if (!(k in out)) out[k] = m[2] ?? m[3] ?? m[4] ?? "";
      }
      return out;
    }
    function matches(attrs, selector) {
      if (!selector || selector === "all") return true;
      return String(selector).split(",").some((sel) => {
        sel = sel.trim();
        if (!sel) return false;
        const m = sel.match(/^(form)?((?:[.#][\w-]+|\[[^\]]+\])*)$/i);
        if (!m) return false;
        for (const part of m[2].match(/[.#][\w-]+|\[[^\]]+\]/g) || []) {
          if (part[0] === ".") {
            if (!(attrs.class || "").split(/\s+/).includes(part.slice(1))) return false;
          } else if (part[0] === "#") {
            if (attrs.id !== part.slice(1)) return false;
          } else {
            const am = part.match(/^\[\s*([\w-:]+)\s*(?:([~^$*|]?=)\s*["']?([^"'\]]*)["']?)?\s*\]$/);
            if (!am) return false;
            const v = attrs[am[1].toLowerCase()];
            if (v === void 0) return false;
            if (am[2] === "=" && v !== am[3]) return false;
            if (am[2] === "~=" && !v.split(/\s+/).includes(am[3])) return false;
            if (am[2] === "^=" && !v.startsWith(am[3])) return false;
            if (am[2] === "$=" && !v.endsWith(am[3])) return false;
            if (am[2] === "*=" && !v.includes(am[3])) return false;
          }
        }
        return true;
      });
    }
    var FORM_RE = /<form\b([^>]*)>([\s\S]*?)<\/form\s*>/gi;
    var INPUT_RE = /<(input|textarea|select|button)\b([^>]*)>/gi;
    function findForms2(html2) {
      const forms = [];
      for (const m of html2.matchAll(FORM_RE)) {
        const attrs = parseAttrs(m[1]);
        const fields = [...m[2].matchAll(INPUT_RE)].map((x) => ({ tag: x[1].toLowerCase(), attrs: parseAttrs(x[2]) }));
        const line = html2.slice(0, m.index).split("\n").length;
        forms.push({ index: m.index, length: m[0].length, open: m[1], inner: m[2], attrs, fields, line });
      }
      return forms;
    }
    var esc = (s) => String(s).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
    var HIDE = "position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden";
    var honeypotMarkup = (names) => `<div aria-hidden="true" style="${HIDE}"><label>Leave this field empty<input type="text" name="${esc(names.honeypot)}" value="" tabindex="-1" autocomplete="off"></label></div><input type="hidden" name="${esc(names.token)}" value="">`;
    function clientConfig(o, names) {
      return { forms: o.forms, honeypot: names.honeypot, token: names.token, js: names.js, signals: names.signals, tokenEndpoint: o.tokenEndpoint, jsProof: o.requireJs !== false };
    }
    function scriptTag({ src, inline, config }) {
      const attr = ` data-form-guard="${esc(JSON.stringify(config))}"`;
      return inline ? `<script${attr}>${String(inline).replace(/<\/script/gi, "<\\/script")}</script>` : `<script defer src="${esc(src)}"${attr}></script>`;
    }
    function transformHtml(html2, { forms: selector = "form[data-guard]", names, script, always = false, warn = true } = {}) {
      const report = [];
      const warnings = [];
      let out = "";
      let last = 0;
      for (const f of findForms2(html2)) {
        const isMatch = matches(f.attrs, selector);
        report.push({ line: f.line, attrs: f.attrs, guarded: isMatch });
        if (!isMatch) continue;
        const label = f.attrs.id ? `#${f.attrs.id}` : f.attrs.name ? `[name=${f.attrs.name}]` : f.attrs.action ? `action=${f.attrs.action}` : `line ${f.line}`;
        if (warn) {
          if ((f.attrs.method || "get").toLowerCase() !== "post") warnings.push({ id: "fg/method-not-post", line: f.line, form: label, message: `form ${label} uses method="${f.attrs.method || "get (default)"}"; guarded fields would end up in URLs and logs`, fix: 'add method="post" to the form' });
          if (!("action" in f.attrs)) warnings.push({ id: "fg/no-action", line: f.line, form: label, message: `form ${label} has no action attribute, so it posts to the page URL`, fix: 'set action="/your/endpoint" that runs verify()' });
          if (!("data-fg-guarded" in f.attrs) && f.fields.some((x) => x.attrs.name === names.honeypot)) warnings.push({ id: "fg/honeypot-collision", line: f.line, form: label, message: `form ${label} already has a field named "${names.honeypot}"`, fix: "rename that field or pass a different seed to the plugin" });
        }
        if ("data-fg-guarded" in f.attrs) continue;
        const openTag = `<form${f.open.replace(/\s*\/?$/, "")} data-fg-guarded>`;
        const inner = f.fields.some((x) => x.attrs.name === names.honeypot) ? "" : honeypotMarkup(names);
        out += html2.slice(last, f.index) + openTag + inner + f.inner + "</form>";
        last = f.index + f.length;
      }
      out += html2.slice(last);
      if (script && (always || report.some((r) => r.guarded)) && !/data-form-guard=/.test(out)) {
        out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${script}</head>`) : /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${script}</body>`) : out + script;
      }
      return { html: out, changed: out !== html2, forms: report, warnings };
    }
    module2.exports = { esc, makeNames, parseAttrs, matches, findForms: findForms2, transformHtml, honeypotMarkup, clientConfig, scriptTag, HONEYPOT_BASES };
  }
});

// src/check.js
var check_exports = {};
__export(check_exports, {
  RULES: () => RULES,
  checkDir: () => checkDir,
  checkHtml: () => checkHtml
});
module.exports = __toCommonJS(check_exports);
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_html = __toESM(require_html(), 1);
var { findForms } = import_html.default;
var PERSONAL = /(e-?mail|phone|tel|mobile|password|passwd|card|cvc|cvv|iban|ssn|postcode|zip|address|dob|birth)/i;
var CSRF = /(csrf|xsrf|_token|authenticity_token|__requestverificationtoken|nonce)/i;
var RULES = {
  "fg/no-honeypot": "POST form without a honeypot",
  "fg/runtime-only": "Form relies on the client runtime for its honeypot",
  "fg/get-personal-data": "GET form sends personal data in the URL",
  "fg/no-csrf": "No CSRF token field",
  "fg/no-action": "Form has no action",
  "fg/honeypot-display-none": "Honeypot hidden with display:none / type=hidden",
  "fg/honeypot-focusable": "Honeypot is reachable by keyboard or autofill"
};
var finding = (id, severity, message, fix) => ({ id, severity, title: RULES[id], message, fix });
function checkHtml(text) {
  const findings = [];
  const forms = findForms(text);
  const hasRuntime = /data-form-guard=|form-guard[.\w-]*\.js/.test(text);
  for (const f of forms) {
    const where = `line ${f.line}${f.attrs.id ? ` #${f.attrs.id}` : ""}${f.attrs.action ? ` (action=${f.attrs.action})` : ""}`;
    const method = (f.attrs.method || "get").toLowerCase();
    const fields = f.fields.filter((x) => x.tag !== "button");
    const named = fields.filter((x) => x.attrs.name !== void 0);
    if (!named.length && method === "get" && fields.length <= 1) continue;
    const hpInputs = [...f.inner.matchAll(/<div\b[^>]*aria-hidden=["']?true[^>]*>([\s\S]*?)<\/div>/gi)];
    const guarded = "data-fg-guarded" in f.attrs || hpInputs.some((m) => /<input\b[^>]*tabindex=["']?-1/i.test(m[1]));
    if (method === "post") {
      if (!guarded && ("data-guard" in f.attrs || "data-fg" in f.attrs) && hasRuntime) findings.push(finding("fg/runtime-only", "warn", `form at ${where} gets its honeypot only once JavaScript runs`, "build with FormGuardPlugin / the Vite plugin so the markup is in the HTML"));
      else if (!guarded) findings.push(finding("fg/no-honeypot", "error", `form at ${where} posts without a honeypot field`, "add data-guard to the form and build with FormGuardPlugin\nor render issueFields().html inside the form"));
      if (!named.some((x) => CSRF.test(x.attrs.name))) findings.push(finding("fg/no-csrf", "warn", `form at ${where} has no CSRF token field`, "add a hidden CSRF token (or rely on SameSite=Strict cookies and check Origin)"));
    } else {
      const personal = named.filter((x) => ["password", "email", "tel"].includes((x.attrs.type || "").toLowerCase()) || PERSONAL.test(x.attrs.name));
      if (personal.length) findings.push(finding("fg/get-personal-data", "error", `form at ${where} uses GET and sends ${personal.map((x) => x.attrs.name).join(", ")} in the query string`, 'add method="post"'));
    }
    if (!("action" in f.attrs) && method === "post") findings.push(finding("fg/no-action", "warn", `form at ${where} has no action, so it posts back to the page URL`, 'set action="/api/contact" (an endpoint that calls verify())'));
    for (const x of fields) {
      const n = x.attrs.name || "";
      if (!/(website|url|homepage|fax|honey|hp_|middle_name|confirm_email)/i.test(n)) continue;
      const hiddenByDisplay = /display\s*:\s*none|visibility\s*:\s*hidden/i.test(x.attrs.style || "") || (x.attrs.type || "").toLowerCase() === "hidden" || "hidden" in x.attrs;
      if (hiddenByDisplay) findings.push(finding("fg/honeypot-display-none", "warn", `field "${n}" at ${where} looks like a honeypot hidden with display:none/type=hidden, which most bots skip`, 'move it off-screen (position:absolute;left:-10000px) inside aria-hidden="true"'));
      else if (guarded && (x.attrs.tabindex !== "-1" || (x.attrs.autocomplete || "").toLowerCase() !== "off")) findings.push(finding("fg/honeypot-focusable", "warn", `honeypot "${n}" at ${where} lacks tabindex="-1" or autocomplete="off"`, 'add tabindex="-1" autocomplete="off" so keyboard users and autofill skip it'));
    }
  }
  return { forms: forms.length, findings };
}
function walk(dir, out = []) {
  for (const name of (0, import_node_fs.readdirSync)(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = (0, import_node_path.join)(dir, name);
    const s = (0, import_node_fs.statSync)(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.html?$/i.test(name)) out.push(p);
  }
  return out;
}
function checkDir(dir) {
  return walk(dir).map((file) => ({ file: (0, import_node_path.relative)(process.cwd(), file) || file, ...checkHtml((0, import_node_fs.readFileSync)(file, "utf8")) }));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RULES,
  checkDir,
  checkHtml
});
