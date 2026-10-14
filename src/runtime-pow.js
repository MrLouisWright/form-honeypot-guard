/*! form-honeypot-guard optional PoW solver (load after runtime.js) | MIT */
(function (w) {
  var g = w.FormGuard;
  if (!g || !g.enablePow || !w.crypto || !w.crypto.subtle) return;
  function b64uJson(o) {
    var b = new w.TextEncoder().encode(JSON.stringify(o)), bin = '';
    for (var i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    return w.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function sha256Hex(salt, n) {
    return w.crypto.subtle.digest('SHA-256', new w.TextEncoder().encode(salt + n)).then(function (buf) {
      var a = new Uint8Array(buf), h = '';
      for (var i = 0; i < a.length; i++) h += ('0' + a[i].toString(16)).slice(-2);
      return h;
    });
  }
  g.enablePow(function (c) {
    if (!c || c.algorithm !== 'SHA-256') return Promise.resolve('');
    var max = c.maxnumber | 0, salt = c.salt, target = c.challenge, start = 0;
    return new Promise(function (resolve) {
      function batch() {
        var end = Math.min(start + 400, max);
        (function tryN(i) {
          if (i > end) { start = end + 1; return start > max ? resolve('') : batch(); }
          sha256Hex(salt, i).then(function (h) {
            if (h === target) resolve(b64uJson({ algorithm: c.algorithm, challenge: c.challenge, maxnumber: c.maxnumber, salt: c.salt, signature: c.signature, issuedAt: c.issuedAt, number: i }));
            else tryN(i + 1);
          });
        })(start);
      }
      batch();
    });
  });
})(typeof window != 'undefined' ? window : 0);
