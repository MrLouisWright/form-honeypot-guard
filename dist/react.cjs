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

// src/react.js
var react_exports = {};
__export(react_exports, {
  GuardedForm: () => GuardedForm,
  formData: () => formData,
  guardRef: () => guardRef,
  init: () => init,
  json: () => json,
  useFormGuardInit: () => useFormGuardInit
});
module.exports = __toCommonJS(react_exports);
var import_react = require("react");

// src/runtime.js
(function(w, d) {
  if (!w || !d || w.FormGuard) return;
  var cfg = { forms: "form[data-guard]", honeypot: "website_url", token: "fg_token", js: "fg_js", signals: "fg_sig", pow: "fg_pow", tokenEndpoint: "/__form-guard/token", fetchToken: true, jsProof: true, observe: true };
  var sig = { k: 0, p: 0, f: 0, t: Date.now() }, tok, powPay, pending, powFill, tracking, obs;
  function on(t, f) {
    d.addEventListener(t, f, true);
  }
  function input(form, name, type) {
    var el = form.querySelector('input[name="' + name + '"]');
    if (!el) {
      el = d.createElement("input");
      el.type = type || "hidden";
      el.name = name;
      form.appendChild(el);
    }
    return el;
  }
  function honeypot(form) {
    if (form.querySelector('[name="' + cfg.honeypot + '"]')) return;
    var box = d.createElement("div"), label = d.createElement("label"), i = d.createElement("input");
    box.setAttribute("aria-hidden", "true");
    box.setAttribute("style", "position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden");
    label.textContent = "Leave this field empty";
    i.type = "text";
    i.name = cfg.honeypot;
    i.tabIndex = -1;
    i.value = "";
    i.setAttribute("autocomplete", "off");
    label.appendChild(i);
    box.appendChild(label);
    form.insertBefore(box, form.firstChild);
  }
  function getToken() {
    if (tok && (!powFill || powPay)) return Promise.resolve(tok);
    if (!pending) pending = cfg.fetchToken && w.fetch ? w.fetch(cfg.tokenEndpoint, { credentials: "same-origin", headers: { accept: "application/json" } }).then(function(r) {
      return r.ok ? r.json() : {};
    }).then(function(j) {
      tok = j && j.token;
      if (j && j.pow && powFill) return powFill(j.pow).then(function(p) {
        powPay = p;
        return tok;
      });
      return tok || null;
    }, function() {
      return null;
    }) : Promise.resolve(null);
    return pending;
  }
  function fill(form) {
    input(form, cfg.signals).value = [sig.k, sig.p, sig.f, Date.now() - sig.t].join(".");
    var t = input(form, cfg.token).value;
    if (t && cfg.jsProof) input(form, cfg.js).value = t.split(".")[1].split("").reverse().join("");
    if (powPay) input(form, cfg.pow).value = powPay;
  }
  function enhance(form) {
    if (form.__fg) return form.__fg;
    form.setAttribute("data-fg-enhanced", "");
    honeypot(form);
    var t = input(form, cfg.token);
    form.__fg = (t.value ? Promise.resolve(t.value) : getToken().then(function(v) {
      if (v && !t.value) t.value = v;
    })).then(function() {
      fill(form);
      return form;
    });
    fill(form);
    form.addEventListener("submit", function() {
      fill(form);
    }, true);
    return form.__fg;
  }
  function scan(root) {
    var list = (root || d).querySelectorAll(cfg.forms === "all" ? "form" : cfg.forms);
    for (var i = 0; i < list.length; i++) enhance(list[i]);
  }
  function placeCredit() {
    if (!cfg.credit || !d) return;
    if (d.querySelector("a.fg-credit")) return;
    var a = d.createElement("a");
    a.className = "fg-credit";
    a.href = "https://louiswright.co.uk";
    a.rel = "noopener";
    a.textContent = "Built with form-honeypot-guard";
    var t = cfg.creditTarget, el = typeof t === "string" ? d.querySelector(t) : t;
    if (el && el.appendChild) el.appendChild(a);
    else {
      var f = d.querySelector(cfg.forms === "all" ? "form" : cfg.forms);
      if (f) f.insertAdjacentElement("afterend", a);
      else if (d.body) d.body.appendChild(a);
    }
  }
  function init2(o) {
    for (var k in o || {}) if (o[k] != null) cfg[k] = o[k];
    if (!tracking) {
      tracking = 1;
      on("keydown", function() {
        sig.k++;
      });
      on("pointerdown", function() {
        sig.p++;
      });
      on("focusin", function() {
        sig.f++;
      });
    }
    if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", function() {
      scan();
    });
    else scan();
    if (cfg.observe && w.MutationObserver && !obs) (obs = new w.MutationObserver(function() {
      scan();
    })).observe(d.documentElement, { childList: true, subtree: true });
    placeCredit();
    return api;
  }
  function formData2(form) {
    return enhance(form).then(function() {
      fill(form);
      return new w.FormData(form);
    });
  }
  function json2(form) {
    return formData2(form).then(function(fd) {
      var o = {};
      fd.forEach(function(v, k) {
        o[k] = v;
      });
      return o;
    });
  }
  var api = {
    init: init2,
    enhance,
    scan,
    formData: formData2,
    json: json2,
    config: cfg,
    signals: sig,
    enablePow: function(fn) {
      powFill = fn;
    }
  };
  w.FormGuard = api;
  var s = d.currentScript, c = s && s.getAttribute("data-form-guard");
  if (c != null) init2(c ? JSON.parse(c) : {});
})(typeof window != "undefined" ? window : 0, typeof document != "undefined" ? document : 0);

// src/client.js
var g = () => globalThis.FormGuard;
var noDom = () => {
  throw new Error("form-honeypot-guard/client needs a browser DOM");
};
var init = (opts) => g() ? g().init(opts) : void 0;
var formData = (form) => (g() || { formData: noDom }).formData(form);
var json = (form) => (g() || { json: noDom }).json(form);
var guardRef = (el) => {
  if (el && g()) g().enhance(el);
};

// src/react.js
function useFormGuardInit(options) {
  (0, import_react.useEffect)(() => {
    init(options);
  }, [options]);
}
var GuardedForm = (0, import_react.forwardRef)(function GuardedForm2({ guardOptions, children, ...props }, ref) {
  const formRef = (0, import_react.useRef)(null);
  useFormGuardInit(guardOptions);
  (0, import_react.useImperativeHandle)(ref, () => ({
    json: () => json(formRef.current),
    formData: () => formData(formRef.current),
    get form() {
      return formRef.current;
    }
  }));
  return (0, import_react.createElement)(
    "form",
    {
      ...props,
      "data-guard": props["data-guard"] ?? "",
      ref: (el) => {
        formRef.current = el;
        guardRef(el);
      }
    },
    children
  );
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GuardedForm,
  formData,
  guardRef,
  init,
  json,
  useFormGuardInit
});
/*! form-honeypot-guard client runtime | MIT (c) Louis Wright */
