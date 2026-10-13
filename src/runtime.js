/*! form-honeypot-guard client runtime | MIT (c) Louis Wright */
(function (w, d) {
  if (!w || !d || w.FormGuard) return;
  var cfg = { forms: 'form[data-guard]', honeypot: 'website_url', token: 'fg_token', js: 'fg_js', signals: 'fg_sig', tokenEndpoint: '/__form-guard/token', fetchToken: true, jsProof: true, observe: true };
  var sig = { k: 0, p: 0, f: 0, t: Date.now() }, tok, pending, tracking, obs;
  function on(t, f) { d.addEventListener(t, f, true); }
  function input(form, name, type) {
    var el = form.querySelector('input[name="' + name + '"]');
    if (!el) { el = d.createElement('input'); el.type = type || 'hidden'; el.name = name; form.appendChild(el); }
    return el;
  }
  function honeypot(form) {
    if (form.querySelector('[name="' + cfg.honeypot + '"]')) return;
    var box = d.createElement('div'), label = d.createElement('label'), i = d.createElement('input');
    box.setAttribute('aria-hidden', 'true');
    box.setAttribute('style', 'position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden');
    label.textContent = 'Leave this field empty';
    i.type = 'text'; i.name = cfg.honeypot; i.tabIndex = -1; i.value = '';
    i.setAttribute('autocomplete', 'off');
    label.appendChild(i); box.appendChild(label); form.insertBefore(box, form.firstChild);
  }
  function getToken() {
    if (tok) return Promise.resolve(tok);
    if (!pending) pending = cfg.fetchToken && w.fetch
      ? w.fetch(cfg.tokenEndpoint, { credentials: 'same-origin', headers: { accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (j) { return (tok = j && j.token) || null; }, function () { return null; })
      : Promise.resolve(null);
    return pending;
  }
  function fill(form) {
    input(form, cfg.signals).value = [sig.k, sig.p, sig.f, Date.now() - sig.t].join('.');
    var t = input(form, cfg.token).value;
    if (t && cfg.jsProof) input(form, cfg.js).value = t.split('.')[1].split('').reverse().join('');
  }
  function enhance(form) {
    if (form.__fg) return form.__fg;
    form.setAttribute('data-fg-enhanced', '');
    honeypot(form);
    var t = input(form, cfg.token);
    form.__fg = (t.value ? Promise.resolve(t.value) : getToken().then(function (v) { if (v && !t.value) t.value = v; }))
      .then(function () { fill(form); return form; });
    fill(form);
    form.addEventListener('submit', function () { fill(form); }, true);
    return form.__fg;
  }
  function scan(root) {
    var list = (root || d).querySelectorAll(cfg.forms === 'all' ? 'form' : cfg.forms);
    for (var i = 0; i < list.length; i++) enhance(list[i]);
  }
  function init(o) {
    for (var k in o || {}) if (o[k] != null) cfg[k] = o[k];
    if (!tracking) {
      tracking = 1;
      on('keydown', function () { sig.k++; }); on('pointerdown', function () { sig.p++; }); on('focusin', function () { sig.f++; });
    }
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { scan(); });
    else scan();
    if (cfg.observe && w.MutationObserver && !obs) (obs = new w.MutationObserver(function () { scan(); })).observe(d.documentElement, { childList: true, subtree: true });
    return api;
  }
  function formData(form) { return enhance(form).then(function () { fill(form); return new w.FormData(form); }); }
  function json(form) { return formData(form).then(function (fd) { var o = {}; fd.forEach(function (v, k) { o[k] = v; }); return o; }); }
  var api = { init: init, enhance: enhance, scan: scan, formData: formData, json: json, config: cfg, signals: sig };
  w.FormGuard = api;
  var s = d.currentScript, c = s && s.getAttribute('data-form-guard');
  if (c != null) init(c ? JSON.parse(c) : {});
})(typeof window != 'undefined' ? window : 0, typeof document != 'undefined' ? document : 0);
