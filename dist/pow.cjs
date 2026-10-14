var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/pow.js
var pow_exports = {};
__export(pow_exports, {
  createPowChallenge: () => createPowChallenge,
  createPowChallengeWithSolution: () => createPowChallengeWithSolution,
  encodePowPayload: () => encodePowPayload,
  resolvePow: () => resolvePow,
  solvePowChallenge: () => solvePowChallenge,
  verifyPow: () => verifyPow
});
module.exports = __toCommonJS(pow_exports);
var import_node_crypto2 = require("node:crypto");
var import_node_crypto3 = require("node:crypto");

// src/secret.js
var import_node_crypto = require("node:crypto");

// src/constants.js
var DEFAULT_FIELDS = Object.freeze({ honeypot: "website_url", token: "fg_token", js: "fg_js", signals: "fg_sig", pow: "fg_pow" });
var DEFAULTS = Object.freeze({
  secretEnv: "FORM_GUARD_SECRET",
  minTime: 3e3,
  maxAge: 2 * 60 * 60 * 1e3,
  requireToken: true,
  requireJs: true,
  minInteractions: 1,
  threshold: 5,
  content: {},
  tokenEndpoint: "/__form-guard/token"
});

// src/secret.js
var b64u = (buf) => Buffer.from(buf).toString("base64url");
function getSecret(o = {}) {
  const s = o.secret ?? process.env[o.secretEnv || DEFAULTS.secretEnv];
  if (!s || String(s).length < 16) {
    throw new Error(`form-honeypot-guard: set a secret of at least 16 chars in $${o.secretEnv || DEFAULTS.secretEnv} (generate one with: npx form-honeypot-guard secret)`);
  }
  return String(s);
}
var signPayload = (secret, data) => b64u((0, import_node_crypto.createHmac)("sha256", secret).update(data).digest());

// src/pow.js
var b64u2 = (buf) => Buffer.from(buf).toString("base64url");
var b64uJson = (o) => b64u2(Buffer.from(JSON.stringify(o), "utf8"));
var parseB64uJson = (s) => JSON.parse(Buffer.from(String(s || ""), "base64url").toString("utf8"));
function resolvePow(opts = {}) {
  if (!opts.pow) return null;
  const p = opts.pow === true ? {} : opts.pow;
  return {
    maxnumber: p.maxnumber ?? 1e5,
    require: p.require ?? true,
    field: p.field
  };
}
function createPowChallenge(opts = {}, now = Date.now()) {
  const pow = resolvePow(opts);
  if (!pow) return null;
  const secret = getSecret(opts);
  const salt = b64u2((0, import_node_crypto3.randomBytes)(12));
  const maxnumber = pow.maxnumber;
  const algorithm = "SHA-256";
  const number = Math.floor(Math.random() * (maxnumber + 1));
  const challenge = (0, import_node_crypto2.createHash)("sha256").update(salt + number).digest("hex");
  const issuedAt = now;
  const sigPayload = `${algorithm}|${challenge}|${maxnumber}|${salt}|${issuedAt}`;
  const signature = signPayload(secret, sigPayload);
  return { algorithm, challenge, maxnumber, salt, signature, issuedAt };
}
function createPowChallengeWithSolution(opts = {}, now = Date.now()) {
  const pow = resolvePow(opts);
  if (!pow) return null;
  const secret = getSecret(opts);
  const salt = b64u2((0, import_node_crypto3.randomBytes)(12));
  const maxnumber = pow.maxnumber;
  const algorithm = "SHA-256";
  const number = Math.floor(Math.random() * (maxnumber + 1));
  const challenge = (0, import_node_crypto2.createHash)("sha256").update(salt + number).digest("hex");
  const issuedAt = now;
  const sigPayload = `${algorithm}|${challenge}|${maxnumber}|${salt}|${issuedAt}`;
  const signature = signPayload(secret, sigPayload);
  return { algorithm, challenge, maxnumber, salt, signature, issuedAt, number };
}
function solvePowChallenge(challenge, { batchSize = 5e3, onProgress } = {}) {
  if (!challenge) return null;
  const { algorithm, challenge: target, maxnumber, salt } = challenge;
  if (algorithm !== "SHA-256") return null;
  for (let start = 0; start <= maxnumber; start += batchSize) {
    const end = Math.min(start + batchSize - 1, maxnumber);
    for (let n = start; n <= end; n++) {
      const h = (0, import_node_crypto2.createHash)("sha256").update(salt + n).digest("hex");
      if (h === target) return n;
    }
    onProgress?.({ done: end + 1, total: maxnumber + 1 });
  }
  return null;
}
function encodePowPayload(challenge, number) {
  const { algorithm, challenge: ch, maxnumber, salt, signature, issuedAt } = challenge;
  return b64uJson({ algorithm, challenge: ch, maxnumber, salt, signature, issuedAt, number });
}
function verifyPow(payload, opts = {}, now = opts.now ?? Date.now()) {
  const pow = resolvePow(opts);
  if (!pow) return { ok: true, skipped: true };
  if (!payload) {
    if (pow.require === true) return { ok: false, reason: "pow-missing" };
    if (pow.require === "soft") return { ok: true, reason: "pow-missing", soft: true };
    return { ok: true, skipped: true };
  }
  let data;
  try {
    data = parseB64uJson(payload);
  } catch {
    return { ok: false, reason: "pow-invalid" };
  }
  const { algorithm, challenge, maxnumber, salt, signature, issuedAt, number } = data;
  if (algorithm !== "SHA-256" || typeof challenge !== "string" || typeof salt !== "string") {
    return { ok: false, reason: "pow-invalid" };
  }
  if (typeof number !== "number" || number < 0 || number > maxnumber) return { ok: false, reason: "pow-invalid" };
  const secret = getSecret(opts);
  const sigPayload = `${algorithm}|${challenge}|${maxnumber}|${salt}|${issuedAt}`;
  const expectedSig = signPayload(secret, sigPayload);
  const got = Buffer.from(String(signature || ""));
  const exp = Buffer.from(expectedSig);
  if (exp.length !== got.length || !(0, import_node_crypto2.timingSafeEqual)(exp, got)) return { ok: false, reason: "pow-invalid" };
  const maxAge = opts.powMaxAge ?? opts.maxAge ?? 2 * 60 * 60 * 1e3;
  if (typeof issuedAt !== "number" || now - issuedAt > maxAge || now - issuedAt < 0) {
    return { ok: false, reason: "pow-expired" };
  }
  const h = (0, import_node_crypto2.createHash)("sha256").update(salt + number).digest("hex");
  if (h !== challenge) return { ok: false, reason: "pow-invalid" };
  return { ok: true };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createPowChallenge,
  createPowChallengeWithSolution,
  encodePowPayload,
  resolvePow,
  solvePowChallenge,
  verifyPow
});
