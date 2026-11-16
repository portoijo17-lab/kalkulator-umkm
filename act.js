/* Aktivasi: kode dibuat penjual dengan kunci rahasia, aplikasi hanya memeriksa dengan kunci pembuka (tanpa internet). */
(function (root) {
  'use strict';
  var PUB = { kty: 'EC', crv: 'P-256', x: 'gmKQGCcEOu90mlh4ijZZAEzIM-9-Y5jK5sMSDGI3Nk8', y: 'eSqQKTOJ_uPn0xN-f5EF6MokILMfmN6wMk3CaG8cU3g' };
  var KEY_DEV = 'kalkulator_umkm_dev', KEY_ACT = 'kalkulator_umkm_act';
  var ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function normDev(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function fmtDev(s) { s = normDev(s); return s.slice(0, 4) + '-' + s.slice(4); }
  function pesan(dev, exp) { return 'umkm1|' + normDev(dev) + '|' + exp; }
  function b64uToBytes(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64u(b) {
    var s = ''; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function ymd(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function fmtExp(exp) {
    if (exp === '00000000') return 'selamanya';
    var bln = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return parseInt(exp.slice(6, 8), 10) + ' ' + bln[parseInt(exp.slice(4, 6), 10) - 1] + ' ' + exp.slice(0, 4);
  }

  function getDeviceId() {
    var d = '';
    try { d = localStorage.getItem(KEY_DEV) || ''; } catch (e) { }
    if (normDev(d).length === 8) return fmtDev(d);
    var a = new Uint8Array(8); (root.crypto || {}).getRandomValues(a);
    var s = ''; for (var i = 0; i < 8; i++) s += ABC.charAt(a[i] % 32);
    d = fmtDev(s);
    try { localStorage.setItem(KEY_DEV, d); } catch (e) { }
    return d;
  }

  // Hasil: { ok, alasan: 'format'|'salah'|'habis'|'nocrypto', exp }
  function verify(code, dev, today, subtle, pub) {
    code = String(code || '').replace(/\s+/g, '');
    var m = /^(\d{8})\.([A-Za-z0-9_-]+)$/.exec(code);
    if (!m) return Promise.resolve({ ok: false, alasan: 'format' });
    if (!subtle) return Promise.resolve({ ok: false, alasan: 'nocrypto' });
    var exp = m[1], sig;
    try { sig = b64uToBytes(m[2]); } catch (e) { return Promise.resolve({ ok: false, alasan: 'format' }); }
    if (sig.length !== 64) return Promise.resolve({ ok: false, alasan: 'format' });
    return subtle.importKey('jwk', pub || PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
      .then(function (k) { return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, sig, new TextEncoder().encode(pesan(dev, exp))); })
      .then(function (ok) {
        if (!ok) return { ok: false, alasan: 'salah' };
        if (exp !== '00000000' && parseInt(exp, 10) < today) return { ok: false, alasan: 'habis', exp: exp };
        return { ok: true, exp: exp };
      })
      .catch(function () { return { ok: false, alasan: 'nocrypto' }; });
  }

  function saved() { try { return localStorage.getItem(KEY_ACT) || ''; } catch (e) { return ''; } }
  function save(code) { try { localStorage.setItem(KEY_ACT, String(code).replace(/\s+/g, '')); } catch (e) { } }
  function check() {
    var c = saved();
    if (!c) return Promise.resolve({ ok: false, alasan: 'kosong' });
    return verify(c, getDeviceId(), ymd(new Date()), (root.crypto || {}).subtle);
  }
  function activate(code) {
    return verify(code, getDeviceId(), ymd(new Date()), (root.crypto || {}).subtle).then(function (r) { if (r.ok) save(code); return r; });
  }

  var api = { verify: verify, check: check, activate: activate, getDeviceId: getDeviceId, normDev: normDev, fmtExp: fmtExp, pesan: pesan, bytesToB64u: bytesToB64u, ymd: ymd };
  root.Act = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
