/* Kalkulator UMKM: layar dan penyimpanan data (di HP, lewat localStorage). */
(function () {
  'use strict';
  var C = window.Calc, num = C.parseNum, rp = C.rp, fmt = C.fmtNum;
  var KEY = 'kalkulator_umkm_v1';
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var HR = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  // ---------- data ----------
  function fresh() { return { v: 1, seq: 1, produk: [], biaya: [], lain: [], stok: [], belanja: [], jualan: {} }; }
  function load() {
    try {
      var s = localStorage.getItem(KEY);
      if (!s) return fresh();
      var d = JSON.parse(s);
      var f = fresh();
      Object.keys(f).forEach(function (k) { if (d[k] == null) d[k] = f[k]; });
      return d;
    } catch (e) { return fresh(); }
  }
  var db = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { toast('Data gagal disimpan. Ruang penyimpanan HP penuh?'); return false; }
  }
  function nid() { return db.seq++; }

  // ---------- util ----------
  var app = document.getElementById('app');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var toastT;
  function toast(m) {
    var t = $('toast'); t.textContent = m; t.className = 'show';
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = ''; }, 2600);
  }
  function todayStr() { return C.ymd(new Date()); }
  function dLabel(s) { var p = C.splitYmd(s), d = new Date(p.y, p.m - 1, p.d); return HR[d.getDay()] + ', ' + p.d + ' ' + BLN[p.m - 1]; }
  function dLong(s) { var p = C.splitYmd(s), d = new Date(p.y, p.m - 1, p.d); return HARI[d.getDay()] + ', ' + p.d + ' ' + BLN[p.m - 1] + ' ' + p.y; }
  function r6(n) { return Math.round(n * 1e6) / 1e6; }
  function cls(n) { return n < 0 ? 'neg' : 'pos'; }

  // ---------- potongan tampilan ----------
  function head(step, title, sub) {
    return '<header class="top">' + (step ? '<div class="step">' + step + '</div>' : '') + '<h1>' + title + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</header>';
  }
  function F(label, key, val, o) {
    o = o || {};
    return '<div class="field"' + (o.style ? ' style="' + o.style + '"' : '') + '><label>' + label + '</label><input type="text" data-k="' + key + '" ' + (o.id ? 'id="' + o.id + '" ' : '') +
      'value="' + esc(val) + '" inputmode="' + (o.mode || 'decimal') + '" placeholder="' + esc(o.ph || '') + '" autocomplete="off"></div>';
  }
  function res(id, title, big, sub, extra, rugi) {
    return '<section class="result' + (rugi ? ' rugi' : '') + '" id="' + id + '"><div class="t" data-p="t">' + title + '</div><div class="b" data-p="b">' + big + '</div><div class="s" data-p="s">' + (sub || '') + '</div>' +
      (extra ? '<div class="x"><span data-p="xl">' + extra[0] + '</span><b data-p="xv">' + extra[1] + '</b></div>' : '') + '</section>';
  }
  function setRes(id, o) {
    var el = $(id); if (!el) return;
    Object.keys(o).forEach(function (k) {
      if (k === 'rugi') { el.classList.toggle('rugi', !!o[k]); return; }
      var n = el.querySelector('[data-p="' + k + '"]'); if (n) n.textContent = o[k];
    });
  }
  function row(l, s, r, rc, href) {
    var inner = '<div><div class="l">' + l + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div><div class="r ' + (rc || '') + '">' + r + '</div>';
    return href ? '<a class="row" href="' + href + '">' + inner + '</a>' : '<div class="row">' + inner + '</div>';
  }
  function card(inner, pad) { return '<section class="card' + (pad ? ' pad' : '') + '">' + inner + '</section>'; }
  function hl(a, b) { return '<div class="hl"><span>' + a + '</span><span>' + (b || '') + '</span></div>'; }
  function btn(text, action, extra) { return '<button class="btn ' + (extra || '') + '" data-a="' + action + '">' + text + '</button>'; }
  function link(text, href) { return '<a class="btn" href="' + href + '">' + text + '</a>'; }
  function pill(st) { return '<span class="pill ' + st.toLowerCase() + '">' + st + '</span>'; }
  function set(id, t) { var e = $(id); if (e) e.textContent = t; }

  // ---------- keadaan layar ----------
  var draft = null;
  var ui = { pstep: 1, ptype: 'sendiri', why: false, allDays: false, allBel: false, jd: null, jq: null, jqDate: null, bel: null, kor: null, baru: null, lain: { untuk: '', jml: '' }, um: null, back: null };
  var cur = { name: '', arg: '', route: null };

  function newDraft(mode) {
    return { id: null, mode: mode || 'sendiri', nama: '', hasil: '', bahan: [{ nama: '', jumlah: '', satuan: '', harga: '' }], kemasan: '', upah: '', susut: '0', beli: '', ongkos: '', modal: '', margin: '40', plat: '0', harga: '' };
  }
  function produkById(id) { return db.produk.filter(function (p) { return String(p.id) === String(id); })[0]; }
  function stokById(id) { return db.stok.filter(function (s) { return String(s.id) === String(id); })[0]; }
  function stokByName(n) { n = String(n || '').trim().toLowerCase(); return db.stok.filter(function (s) { return s.nama.trim().toLowerCase() === n; })[0]; }
  function perluBeli() {
    return db.stok.filter(function (s) { return C.stokStatus(s) !== 'Aman'; }).sort(function (a, b) { return C.stokStatus(a) === 'Habis' ? -1 : (C.stokStatus(b) === 'Habis' ? 1 : 0); });
  }
  function perluBeliText() {
    return perluBeli().map(function (s) { return esc(s.nama) + ' (' + C.stokStatus(s).toLowerCase() + ')'; }).join(', ');
  }
  function applyStok(p, deltaQty) {
    C.pemakaianPerPcs(p).forEach(function (u) {
      var s = stokByName(u.nama); if (!s) return;
      s.stok = r6(num(s.stok) - u.per * deltaQty);
    });
  }

  // ---------- Modal per pcs ----------
  function modalNow(d) {
    if (d.mode === 'sendiri') {
      var m = C.modalSendiri(d);
      return { perPcs: m.perPcs, sub: m.hasil > 0 ? 'Total ' + rp(m.total) + ' ÷ ' + fmt(m.hasil) + ' pcs' : 'Isi dulu hasil jadi (pcs)' };
    }
    if (d.mode === 'jadi') return { perPcs: C.modalJadi(d.beli, d.ongkos), sub: rp(num(d.beli)) + ' + ' + rp(num(d.ongkos)) };
    return { perPcs: num(d.modal), sub: 'Diisi sendiri, hitungan otomatis tidak dipakai' };
  }

  function bahanRow(b, i) {
    return '<div class="bahan"><div class="top">' + F('Nama bahan', 'd.bahan.' + i + '.nama', b.nama, { mode: 'text', ph: 'Contoh: tepung terigu' }) +
      '<button class="xbtn" data-a="delBahan" data-i="' + i + '" aria-label="Hapus bahan">×</button></div>' +
      '<div class="rowf">' + F('Jumlah', 'd.bahan.' + i + '.jumlah', b.jumlah, { ph: '2' }) + F('Satuan', 'd.bahan.' + i + '.satuan', b.satuan, { mode: 'text', ph: 'kg' }) +
      F('Harga per satuan (Rp)', 'd.bahan.' + i + '.harga', b.harga, { ph: '13.000' }) + '</div>' +
      '<div class="sub-line" id="sub' + i + '">= ' + rp(num(b.jumlah) * num(b.harga)) + '</div></div>';
  }

  var R = {};

  R.modal = {
    render: function () {
      if (!draft) draft = newDraft('sendiri');
      var d = draft, m = modalNow(d), h = '';
      h += head('HITUNG HARGA JUAL · LANGKAH 1', 'Modal per pcs', 'Pilih cara menghitung modal.');
      h += '<main>';
      h += '<div class="sg">' + [['sendiri', 'Bikin sendiri'], ['jadi', 'Beli jadi'], ['manual', 'Isi sendiri']].map(function (x) {
        return '<button class="' + (d.mode === x[0] ? 'on' : '') + '" data-a="mode" data-v="' + x[0] + '">' + x[1] + '</button>';
      }).join('') + '</div>';
      h += res('res', 'Modal per pcs', rp(m.perPcs), m.sub);
      if (d.mode === 'sendiri') {
        h += '<div class="rowf">' + F('Nama produk', 'd.nama', d.nama, { mode: 'text', ph: 'Contoh: brownies kukus', style: 'flex:2' }) + F('Hasil jadi (pcs)', 'd.hasil', d.hasil, { ph: '20' }) + '</div>';
        h += card(hl('BAHAN (jumlah × harga beli)') + d.bahan.map(bahanRow).join('') + '<div style="padding:6px 0 12px">' + btn('+ Tambah bahan', 'addBahan', 'dash') + '</div>');
        h += card(
          '<div style="padding:12px 0;display:flex;flex-direction:column;gap:12px">' +
          F('Kemasan per pcs (Rp)', 'd.kemasan', d.kemasan, { ph: '1.000' }) +
          F('Upah kerja untuk 1 kali bikin (Rp)', 'd.upah', d.upah, { ph: '20.000' }) +
          '<details><summary style="font-size:17px;font-weight:600;cursor:pointer;padding:6px 0">Pengaturan tambahan</summary><div style="margin-top:8px">' +
          F('Bahan terbuang (%)', 'd.susut', d.susut, { ph: '0' }) +
          '<div class="hint" style="margin-top:6px">Isi kalau ada bahan yang biasa tumpah atau terbuang. Harga bahan ditambah sebesar persen ini.</div></div></details></div>');
      } else if (d.mode === 'jadi') {
        h += F('Nama barang', 'd.nama', d.nama, { mode: 'text', ph: 'Contoh: air mineral botol' });
        h += F('Harga beli per pcs (Rp)', 'd.beli', d.beli, { ph: '2.500' });
        h += F('Ongkos tambahan per pcs (Rp)', 'd.ongkos', d.ongkos, { ph: '500' });
        h += '<div class="hint">Ongkos tambahan: ongkos kirim, plastik, es, dan sejenisnya. Isi 0 kalau tidak ada.</div>';
      } else {
        h += F('Nama produk', 'd.nama', d.nama, { mode: 'text', ph: 'Contoh: brownies kukus' });
        h += F('Modal per pcs (Rp)', 'd.modal', d.modal, { ph: '8.500' });
        h += '<div class="hint">Pilih ini kalau Anda sudah tahu modalnya. Angka ini langsung dipakai untuk menghitung harga jual dan untung.</div>';
      }
      h += btn('Lanjut: tentukan harga jual', 'toHarga');
      h += '</main>';
      return h;
    },
    update: function () {
      var d = draft, m = modalNow(d);
      setRes('res', { b: rp(m.perPcs), s: m.sub });
      if (d.mode === 'sendiri') d.bahan.forEach(function (b, i) { set('sub' + i, '= ' + rp(num(b.jumlah) * num(b.harga))); });
    }
  };

  // ---------- Harga jual ----------
  function hargaNow(d) {
    var modal = Math.round(modalNow(d).perPcs);
    var saran = C.hargaJual(modal, d.margin, d.plat);
    var pakai = String(d.harga).trim() !== '' ? num(d.harga) : (saran == null ? 0 : Math.round(saran));
    return { modal: modal, saran: saran, pakai: pakai };
  }
  R.harga = {
    render: function () {
      if (!draft) { location.hash = '#/modal'; return ''; }
      var d = draft, x = hargaNow(d);
      var h = head('HITUNG HARGA JUAL · LANGKAH 2', 'Harga jual', 'Persen untung dihitung dari harga jual.') + '<main>';
      h += card(row('Barang', 'dari layar Modal per pcs', esc(d.nama || '-')) + row('Modal per pcs', '', '<span id="hmodal">' + rp(x.modal) + '</span>'));
      h += '<div class="rowf">' + F('Untung yang diinginkan (%)', 'd.margin', d.margin, { ph: '40' }) + F('Potongan QRIS/aplikasi (%)', 'd.plat', d.plat, { ph: '0' }) + '</div>';
      h += '<div class="hint">Potongan: isi 0 kalau jual langsung dengan tunai.</div>';
      h += res('res', 'Harga jual yang disarankan', '', '', ['Untung per pcs', '']);
      h += '<button class="lnk" data-a="why">Kenapa bukan modal × 1,4?</button>';
      h += '<div class="note" id="why" style="display:' + (ui.why ? 'block' : 'none') + '"></div>';
      h += card('<div style="display:flex;flex-direction:column;gap:10px">' + F('Harga jual yang dipakai (Rp)', 'd.harga', d.harga, { ph: 'Kosong = pakai harga saran' }) +
        '<div class="hint">Kosongkan untuk memakai harga saran. Atau isi harga Anda sendiri, untungnya dihitung ulang otomatis.</div>' +
        '<div style="display:flex;justify-content:space-between;font-size:16px"><span style="color:var(--mut)">Untung per pcs</span><b id="hu" class="pos"></b></div></div>', true);
      h += btn('Simpan, lihat target jualan aman', 'saveProduk');
      h += '</main>';
      return h;
    },
    update: function () {
      var d = draft, x = hargaNow(d), m = num(d.margin), p = num(d.plat);
      if (x.saran == null) setRes('res', { b: '-', s: x.modal > 0 ? 'Untung + potongan harus di bawah 100%.' : 'Modal belum diisi.', xv: '-' });
      else setRes('res', { b: rp(Math.round(x.saran)), s: rp(x.modal) + ' ÷ (1 − ' + (m / 100).toFixed(2).replace('.', ',') + ' − ' + (p / 100).toFixed(2).replace('.', ',') + ')', xv: rp(Math.round(x.saran) - x.modal) });
      var u = x.pakai - x.modal;
      set('hu', rp(u) + ' (' + fmt(C.persenUntung(x.pakai, x.modal), 1) + '% dari harga jual)');
      var hu = $('hu'); if (hu) hu.className = u < 0 ? 'neg' : 'pos';
      var w = $('why');
      if (w) {
        var mk = x.modal * (1 + m / 100);
        w.innerHTML = 'Modal ' + rp(x.modal) + ' × ' + (1 + m / 100).toFixed(2).replace('.', ',') + ' = ' + rp(mk) + '. Tapi untungnya hanya ' + fmt(C.persenUntung(mk, x.modal), 1) + '% dari harga jual, bukan ' + fmt(m, 0) + '%. Rumus di sini sudah dihitung dari harga jual, jadi persen untungnya pas.';
      }
    }
  };

  // ---------- Produk ----------
  R.produk = {
    render: function () {
      var h = head(null, 'Produk saya', 'Yang Anda jual.') + '<main>';
      if (!db.produk.length) h += '<div class="empty">Belum ada produk.</div>';
      db.produk.forEach(function (p) {
        h += card('<div style="padding:12px 0"><div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:18px">' + esc(p.nama) + '</b><b>' + rp(p.harga) + '</b></div>' +
          '<div class="hint">Modal ' + rp(p.modal) + ' · untung ' + rp(p.harga - p.modal) + ' per pcs</div>' +
          '<div class="btns" style="margin-top:10px"><button class="btn out" data-a="editProduk" data-id="' + p.id + '">Ubah</button><a class="btn out" href="#/target/' + p.id + '">Target</a><button class="btn red" data-a="delProduk" data-id="' + p.id + '">Hapus</button></div></div>');
      });
      h += btn('+ Produk baru', 'newProduk', 'dash') + '</main>';
      return h;
    }
  };

  // ---------- Target ----------
  R.target = {
    render: function (arg) {
      var h = head('HITUNG HARGA JUAL · LANGKAH 3', 'Target jualan aman', 'Jualan minimal tiap bulan agar tidak rugi.') + '<main>';
      if (!db.produk.length) {
        return h + '<div class="note">Belum ada produk. Hitung modal dan harga jual dulu.</div>' + btn('Hitung harga jual', 'newProduk') + '</main>';
      }
      var p = produkById(arg) || db.produk[0];
      if (db.produk.length > 1) {
        h += '<div class="field"><label>Produk</label><select data-ch="pilihTarget">' + db.produk.map(function (q) { return '<option value="' + q.id + '"' + (q.id === p.id ? ' selected' : '') + '>' + esc(q.nama) + '</option>'; }).join('') + '</select></div>';
      } else h += '<div class="hint">Produk: <b>' + esc(p.nama) + '</b></div>';
      var biaya = C.biayaTotal(db), u = p.harga - p.modal, t = C.targetAman(biaya, u), now = new Date();
      h += card(row('Biaya bulanan tetap', 'ubah di menu Biaya', rp(biaya), '', '#/biaya') + row('Harga jual per pcs', '', rp(p.harga)) + row('Modal per pcs', '', rp(p.modal)) + row('Untung per pcs', '', rp(u), cls(u)));
      if (biaya <= 0) {
        h += '<div class="note">Biaya bulanan belum diisi. Isi dulu di menu <a href="#/biaya">Biaya</a> supaya target bisa dihitung.</div>';
      } else if (t == null) {
        h += '<div class="warn"><div class="t">Harga jual belum di atas modal</div><div class="v">Naikkan harga jual atau turunkan modal, supaya ada untung per pcs.</div></div>';
      } else {
        h += res('res', 'Biaya bulanan tertutup di', fmt(t, 0) + ' pcs', rp(biaya) + ' ÷ ' + rp(u) + ' per pcs', ['Dalam rupiah jualan', rp(t * p.harga)]);
        var jual = C.pcsProdukBulan(db, p.id, now.getFullYear(), now.getMonth() + 1);
        var pct = Math.min(100, Math.round(jual / t * 100));
        h += card('<div style="padding:12px 0"><div style="display:flex;justify-content:space-between;font-size:16px"><b>Jualan ' + BULAN[now.getMonth()] + '</b><span style="color:var(--mut)">' + fmt(jual, 0) + ' dari ' + fmt(t, 0) + ' pcs</span></div>' +
          '<div class="bar" style="margin-top:8px"><i style="width:' + pct + '%"></i></div><div class="hint" style="margin-top:8px">' +
          (jual >= t ? 'Biaya bulanan sudah tertutup. Selebihnya jadi untung.' : 'Kurang ' + fmt(t - jual, 0) + ' pcs lagi sampai biaya bulanan penuh (' + rp(biaya) + ') tertutup.') + '</div></div>');
      }
      return h + '</main>';
    }
  };

  // ---------- Jualan ----------
  function loadJq(date) {
    ui.jqDate = date; ui.jq = {};
    db.produk.forEach(function (p) { ui.jq[p.id] = 0; });
    var e = db.jualan[date];
    if (e) e.items.forEach(function (it) { if (ui.jq[it.pid] != null) ui.jq[it.pid] = it.qty; });
  }
  function buildItems(date) {
    var old = (db.jualan[date] || { items: [] }).items, items = [];
    db.produk.forEach(function (p) {
      var q = Math.max(0, Math.floor(num(ui.jq[p.id])));
      if (q > 0) {
        var o = old.filter(function (x) { return x.pid === p.id; })[0];
        items.push(o && o.qty === q ? o : { pid: p.id, nama: p.nama, qty: q, harga: p.harga, modal: p.modal });
      }
    });
    return items;
  }
  R.jualan = {
    render: function () {
      var date = ui.jd || (ui.jd = todayStr());
      if (!ui.jq || ui.jqDate !== date) loadJq(date);
      var h = head(null, 'Catat jualan', 'Isi berapa yang laku hari ini.') + '<main style="padding-bottom:170px">';
      h += '<div class="field"><label>Tanggal</label><input type="date" value="' + date + '" max="' + todayStr() + '" data-ch="setTgl"></div>';
      if (!db.produk.length) {
        h += '<div class="note">Belum ada produk. Hitung modal dan harga jual dulu, lalu produknya muncul di sini.</div>' + btn('Hitung harga jual', 'newProduk') + '</main>';
        return h;
      }
      h += card(hl('YANG LAKU HARI INI') + db.produk.map(function (p) {
        return '<div class="ctr"><div><div class="l" style="font-size:17px;font-weight:600">' + esc(p.nama) + '</div><div class="sub-line">' + rp(p.harga) + ' per pcs</div></div>' +
          '<div class="c"><button class="btnc" data-a="ctr" data-id="' + p.id + '" data-d="-1" aria-label="Kurangi">−</button>' +
          '<input class="qn" style="width:64px;text-align:center;font-size:22px;font-weight:700;padding:0" inputmode="numeric" id="q' + p.id + '" data-k="u.jq.' + p.id + '" value="' + (ui.jq[p.id] || 0) + '">' +
          '<button class="btnc plus" data-a="ctr" data-id="' + p.id + '" data-d="1" aria-label="Tambah">+</button></div></div>';
      }).join(''));
      h += '<a class="lnk" href="#/produk">Tambah atau ubah produk</a>';
      h += res('res', 'Untung bersih hari ini', '', '');
      h += '<div class="note" style="font-size:14px">Stok bahan ikut berkurang otomatis saat jualan disimpan.</div>';
      h += '<div id="riwayat"></div><div id="total"></div></main>';
      h += '<div class="sticky">' + btn('Simpan jualan', 'saveJual') + '</div>';
      return h;
    },
    update: function () {
      if (!db.produk.length) return;
      var date = ui.jd, items = buildItems(date), r = C.untungBersihHari(db, date, items);
      setRes('res', { b: rp(r.bersih), s: 'Jualan ' + rp(r.jual) + ' · untung ' + rp(r.untungJualan) + ' − biaya harian ' + rp(r.biayaHari), rugi: r.bersih < 0 });
      var p = C.splitYmd(date), pre = p.y + '-' + C.pad(p.m), rows = [];
      Object.keys(db.jualan).sort().reverse().forEach(function (k) {
        if (k.slice(0, 7) === pre && db.jualan[k].items.length) rows.push(k);
      });
      var shown = ui.allDays ? rows : rows.slice(0, 3);
      var h = '<section class="card">' + hl('RIWAYAT ' + BULAN[p.m - 1].toUpperCase() + ' ' + p.y, 'UNTUNG BERSIH');
      if (!rows.length) h += '<div class="empty">Belum ada catatan bulan ini.</div>';
      shown.forEach(function (k) {
        var e = db.jualan[k], b = C.untungBersihHari(db, k, e.items);
        h += '<div class="row" data-a="bukaTgl" data-d="' + k + '" style="cursor:pointer"><div><div class="l">' + dLabel(k) + '</div><div class="s">' + fmt(b.pcs, 0) + ' pcs</div></div><div class="r ' + cls(b.bersih) + '">' + rp(b.bersih) + '</div></div>';
      });
      if (rows.length > 3) h += '<div class="row"><button class="lnk" data-a="allDays" style="text-decoration:none">' + (ui.allDays ? 'Sembunyikan' : 'Lihat semua hari') + '</button></div>';
      $('riwayat').innerHTML = h + '</section>';
      var s = C.ringkasanBulan(db, p.y, p.m, new Date());
      $('total').innerHTML = '<section class="card pad"><div style="display:flex;justify-content:space-between;align-items:baseline"><b>Laku ' + BULAN[p.m - 1] + '</b><b style="font-size:20px">' + fmt(s.pcs, 0) + ' pcs</b></div>' +
        '<div style="margin-top:8px;display:flex;justify-content:space-between;align-items:baseline"><b>Untung bersih</b><b style="font-size:20px" class="' + cls(s.bersih) + '">' + rp(s.bersih) + '</b></div>' +
        '<div class="sub-line" style="margin-top:6px">' + (s.hari >= s.hariDalamBulan ? 'Satu bulan penuh. ' : 'Sampai tanggal ' + s.hari + '. ') + 'Biaya bulanan dihitung ' + rp(C.biayaPerHari(db, p.y, p.m)) + ' per hari.</div></section>';
    }
  };

  // ---------- Bahan ----------
  R.bahan = {
    render: function () {
      var h = head(null, 'Bahan', 'Sisa stok dan belanja bahan.') + '<main>';
      h += link('Catat belanja', '#/belanja');
      var pb = perluBeliText();
      if (pb) h += '<div class="warn"><div class="t">Perlu dibeli</div><div class="v">' + pb + '</div></div>';
      var order = { Habis: 0, Menipis: 1, Aman: 2 };
      var st = db.stok.slice().sort(function (a, b) { return order[C.stokStatus(a)] - order[C.stokStatus(b)]; });
      if (!st.length) h += '<div class="note">Belum ada bahan. Ketuk "Catat belanja" atau tambah bahan di bawah.</div>';
      else {
        h += card(hl('STOK SEKARANG', 'SISA') + st.map(function (s) {
          return '<a class="stokrow" href="#/koreksi/' + s.id + '"><div><div class="l" style="font-size:17px;font-weight:600">' + esc(s.nama) + '</div><div class="sub-line">Batas menipis: ' + fmt(num(s.batas)) + ' ' + esc(s.satuan) + '</div></div>' +
            '<div class="r"><b>' + fmt(Math.max(0, num(s.stok))) + ' ' + esc(s.satuan) + '</b>' + pill(C.stokStatus(s)) + '</div></a>';
        }).join(''));
        h += '<div class="hint" style="text-align:center">Ketuk satu bahan untuk koreksi stok.</div>';
      }
      h += '<a class="btn dash" href="#/bahan-baru">+ Bahan baru</a>';
      var bl = db.belanja.slice().sort(function (a, b) { return a.tgl < b.tgl ? 1 : (a.tgl > b.tgl ? -1 : b.id - a.id); });
      var sh = ui.allBel ? bl : bl.slice(0, 3);
      h += card(hl('BELANJA TERAKHIR', 'JUMLAH') + (sh.length ? sh.map(function (b) {
        return row(dLabel(b.tgl), esc(b.nama) + ' ' + fmt(b.jml) + ' ' + esc(b.satuan), rp(b.total));
      }).join('') : '<div class="empty">Belum ada belanja dicatat.</div>') + (bl.length > 3 ? '<div class="row"><button class="lnk" data-a="allBel" style="text-decoration:none">' + (ui.allBel ? 'Sembunyikan' : 'Lihat semua belanja') + '</button></div>' : ''));
      var n = new Date(), pre = C.ym(n), tot = 0;
      db.belanja.forEach(function (b) { if (b.tgl.slice(0, 7) === pre) tot += num(b.total); });
      h += card('<div style="display:flex;justify-content:space-between;align-items:baseline"><b>Belanja ' + BULAN[n.getMonth()] + '</b><b style="font-size:20px">' + rp(tot) + '</b></div>' +
        '<div class="sub-line" style="margin-top:6px">Hanya catatan data. Tidak mengurangi untung, karena bahan sudah dihitung di Modal per pcs.</div>', true);
      return h + '</main>';
    }
  };

  // ---------- Catat belanja ----------
  R.belanja = {
    render: function () {
      if (!ui.bel) ui.bel = { tgl: todayStr(), id: db.stok[0] ? String(db.stok[0].id) : '', jml: '', total: '' };
      var b = ui.bel, s = stokById(b.id);
      var h = head(null, 'Catat belanja', 'Isi tiap kali beli bahan.') + '<main>';
      h += '<div class="field"><label>Tanggal</label><input type="date" data-k="u.bel.tgl" value="' + b.tgl + '" max="' + todayStr() + '"></div>';
      if (!db.stok.length) {
        return h + '<div class="note">Belum ada bahan di daftar. Tambah bahan dulu, lalu catat belanjanya.</div>' + link('+ Bahan baru', '#/bahan-baru') + '</main>';
      }
      h += '<div class="field"><label>Bahan</label><select data-ch="pilihBahan">' + db.stok.map(function (x) { return '<option value="' + x.id + '"' + (String(x.id) === String(b.id) ? ' selected' : '') + '>' + esc(x.nama) + '</option>'; }).join('') + '</select></div>';
      h += '<div class="rowf">' + F('Jumlah beli', 'u.bel.jml', b.jml, { ph: '1' }) + '<div class="field" style="flex:1"><label>Satuan</label><input type="text" readonly value="' + esc(s ? s.satuan : '') + '"></div></div>';
      h += F('Harga total (Rp)', 'u.bel.total', b.total, { ph: '70.000' });
      h += res('res', 'Stok jadi', '', '');
      h += btn('Simpan belanja', 'saveBelanja');
      h += '<a class="btn dash" href="#/bahan-baru">+ Bahan belum ada di daftar</a>';
      h += '<div class="note"><b>Belanja tidak masuk Pengeluaran</b> dan tidak mengurangi untung. Hanya jadi catatan belanja dan menambah stok.</div>';
      return h + '</main>';
    },
    update: function () {
      var b = ui.bel, s = stokById(b.id); if (!s) return;
      var j = num(b.jml), t = num(b.total);
      setRes('res', { t: 'Stok ' + s.nama + ' jadi', b: fmt(num(s.stok) + j) + ' ' + s.satuan, s: fmt(num(s.stok)) + ' ' + s.satuan + ' + ' + fmt(j) + ' ' + s.satuan + (j > 0 ? ' · harga ' + rp(t / j) + ' per ' + s.satuan : '') });
    }
  };

  // ---------- Koreksi stok ----------
  R.koreksi = {
    render: function (arg) {
      var s = stokById(arg);
      if (!s) { location.hash = '#/bahan'; return ''; }
      if (!ui.kor || ui.kor.id !== s.id) ui.kor = { id: s.id, nama: s.nama, satuan: s.satuan, sisa: String(r6(Math.max(0, num(s.stok)))).replace('.', ','), batas: String(s.batas).replace('.', ',') };
      var k = ui.kor;
      var h = head(null, 'Ubah bahan', 'Koreksi stok, atau ubah nama dan satuan.') + '<main>';
      h += res('res', 'Sisa stok ' + esc(s.nama), '', '', ['Selisih dari catatan aplikasi', '']);
      h += card(row('Stok menurut aplikasi', 'dihitung dari belanja dan jualan', fmt(num(s.stok)) + ' ' + esc(s.satuan)));
      h += F('Sisa sebenarnya', 'u.kor.sisa', k.sisa);
      h += F('Batas menipis', 'u.kor.batas', k.batas);
      h += '<div class="hint" style="margin-top:-6px">Tanda Menipis muncul kalau sisa sama dengan atau di bawah angka ini. Isi sesuai kebutuhan usaha Anda.</div>';
      h += '<div class="rowf">' + F('Nama bahan', 'u.kor.nama', k.nama, { mode: 'text', style: 'flex:2' }) + F('Satuan', 'u.kor.satuan', k.satuan, { mode: 'text' }) + '</div>';
      h += '<div class="hint" style="margin-top:-6px">Mengubah satuan tidak mengubah angka stok. Kalau nama diubah, nama bahan di resep produk ikut disesuaikan.</div>';
      h += btn('Simpan', 'saveKoreksi');
      h += '<a class="lnk" href="#/bahan">Kembali ke daftar bahan</a>';
      h += '<button class="btn red" data-a="delStok" data-id="' + s.id + '">Hapus bahan ini</button>';
      return h + '</main>';
    },
    update: function () {
      var k = ui.kor, s = stokById(k.id); if (!s) return;
      var sisa = num(k.sisa), st = C.stokStatus({ stok: sisa, batas: k.batas }), sel = sisa - num(s.stok), sat = k.satuan;
      setRes('res', { t: 'Sisa stok ' + k.nama, b: fmt(sisa) + ' ' + sat, s: st + ' · batas ' + fmt(num(k.batas)) + ' ' + sat, xv: (sel > 0 ? '+ ' : (sel < 0 ? '− ' : '')) + fmt(Math.abs(sel)) + ' ' + sat });
    }
  };

  // ---------- Bahan baru ----------
  R['bahan-baru'] = {
    render: function () {
      if (!ui.baru) ui.baru = { nama: '', satuan: 'kg', stok: '', batas: '' };
      var b = ui.baru;
      var h = head(null, 'Bahan baru', 'Tambah bahan ke daftar stok.') + '<main>';
      h += F('Nama bahan', 'u.baru.nama', b.nama, { mode: 'text', ph: 'Contoh: tepung terigu' });
      h += '<div class="hint" style="margin-top:-6px">Tulis nama yang sama dengan di daftar bahan resep, supaya stok berkurang otomatis.</div>';
      h += '<div class="rowf">' + F('Satuan', 'u.baru.satuan', b.satuan, { mode: 'text', ph: 'kg' }) + F('Stok sekarang', 'u.baru.stok', b.stok, { ph: '0' }) + '</div>';
      h += F('Batas menipis', 'u.baru.batas', b.batas, { ph: 'Contoh: 1' });
      h += '<div class="hint">Tanda Menipis muncul kalau sisa sama dengan atau di bawah angka ini.</div>';
      h += btn('Simpan bahan', 'saveBahan');
      h += btn('Simpan dan tambah lagi', 'saveBahanLagi', 'out');
      h += '<a class="lnk" href="#/bahan">Batal</a>';
      return h + '</main>';
    }
  };

  // ---------- Biaya ----------
  R.biaya = {
    render: function () {
      var n = new Date(), pre = C.ym(n);
      var h = head(null, 'Biaya', 'Pengeluaran di luar bahan.') + '<main>';
      var lain = db.lain.filter(function (x) { return x.tgl.slice(0, 7) === pre; });
      h += card('<div style="padding:12px 0;display:flex;flex-direction:column;gap:12px">' + hl('PENGELUARAN LAIN (SEKALI-SEKALI)') +
        F('Untuk keperluan apa', 'u.lain.untuk', ui.lain.untuk, { mode: 'text', ph: 'Contoh: servis kompor' }) + F('Jumlah (Rp)', 'u.lain.jml', ui.lain.jml, { ph: '0' }) +
        btn('Simpan pengeluaran', 'saveLain') +
        (lain.length ? lain.map(function (x) {
          return '<div class="row first" style="padding:8px 0"><div><div class="l" style="font-size:16px">' + esc(x.untuk) + '</div><div class="s">' + dLabel(x.tgl) + '</div></div><div class="r">' + rp(x.jml) + ' <button class="xbtn" style="height:40px;width:40px;margin-left:6px" data-a="delLain" data-id="' + x.id + '" aria-label="Hapus">×</button></div></div>';
        }).join('') : '<div class="empty">Belum ada pengeluaran lain bulan ini.</div>') + '</div>');
      h += '<div class="note"><b>Belanja bahan tidak perlu dicatat di sini.</b> Bahan sudah dihitung di Modal per pcs. Pengeluaran lain dicatat sendiri dan tidak mengurangi untung bersih.</div>';
      h += card(hl('BIAYA BULANAN TETAP (DIISI SEKALI)', 'JUMLAH') + db.biaya.map(function (b, i) {
        return '<div class="bahan"><div class="top">' + F('Nama biaya', 'db.biaya.' + i + '.nama', b.nama, { mode: 'text', ph: 'Contoh: sewa tempat' }) + F('Rp per bulan', 'db.biaya.' + i + '.jumlah', b.jumlah, { ph: '800.000' }) +
          '<button class="xbtn" data-a="delBiaya" data-i="' + i + '" aria-label="Hapus">×</button></div></div>';
      }).join('') + '<div class="row"><div><div class="l">Total per bulan</div><div class="s" id="bhari"></div></div><div class="r" id="btotal"></div></div>' +
        '<div style="padding:6px 0 12px">' + btn('+ Tambah biaya bulanan', 'addBiaya', 'dash') + '</div>');
      return h + '</main>';
    },
    update: function () {
      var n = new Date();
      set('btotal', rp(C.biayaTotal(db)));
      set('bhari', rp(C.biayaPerHari(db, n.getFullYear(), n.getMonth() + 1)) + ' per hari');
    }
  };

  // ---------- Untung bulanan ----------
  function monthKeys() {
    var set = {}; set[C.ym(new Date())] = 1;
    Object.keys(db.jualan).forEach(function (k) { set[k.slice(0, 7)] = 1; });
    return Object.keys(set).sort().reverse();
  }
  R.untung = {
    render: function () {
      var keys = monthKeys();
      if (!ui.um || keys.indexOf(ui.um) < 0) ui.um = keys[0];
      var p = C.splitYmd(ui.um + '-01'), s = C.ringkasanBulan(db, p.y, p.m, new Date());
      var h = head(null, 'Untung bulan ini', 'Ringkasan satu bulan dari catatan jualan harian.') + '<main>';
      h += '<div class="field"><label>Bulan</label><select data-ch="pilihBulan">' + keys.map(function (k) { var q = C.splitYmd(k + '-01'); return '<option value="' + k + '"' + (k === ui.um ? ' selected' : '') + '>' + BULAN[q.m - 1] + ' ' + q.y + '</option>'; }).join('') + '</select></div>';
      h += res('res', s.bersih < 0 ? 'Rugi bersih' : 'Untung bersih', rp(s.bersih), rp(s.kotor) + ' − ' + rp(s.biaya), ['Persen untung bersih', s.persen == null ? '-' : fmt(s.persen, 1) + '%'], s.bersih < 0);
      var t = db.produk[0] ? C.targetAman(C.biayaTotal(db), db.produk[0].harga - db.produk[0].modal) : null;
      h += card('<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0"><div><div style="font-size:17px;font-weight:600">Status bulan ini</div><div class="sub-line">' + fmt(s.pcs, 0) + ' pcs laku' + (t ? ', target aman ' + fmt(t, 0) + ' pcs' : '') + '</div></div>' +
        '<span class="pill ' + (s.bersih < 0 ? 'habis' : 'aman') + '" style="font-size:16px;padding:8px 16px">' + s.status + '</span></div>');
      var berjalan = s.hari < s.hariDalamBulan;
      h += card(hl('RINCIANNYA') + row('Jualan', fmt(s.pcs, 0) + ' pcs terjual', rp(s.jual)) + row('Modal barang yang laku', '', '− ' + rp(s.modal), 'neg') + row('Untung dari jualan', '', rp(s.kotor)) +
        row(berjalan ? 'Biaya bulanan (' + s.hari + ' dari ' + s.hariDalamBulan + ' hari)' : 'Biaya bulanan tetap', 'dari menu Biaya', '− ' + rp(s.biaya), 'neg', '#/biaya'));
      var lain = 0; db.lain.forEach(function (x) { if (x.tgl.slice(0, 7) === ui.um) lain += num(x.jml); });
      if (lain > 0) h += '<div class="hint">Pengeluaran lain bulan ini: ' + rp(lain) + '. Dicatat sendiri, tidak mengurangi untung bersih di atas.</div>';
      h += '<div class="btns">' + '<button class="btn out" data-a="backup">Cadangkan data</button><button class="btn out" data-a="share">Bagikan ringkasan</button></div>';
      h += card(hl('DATA') + '<div style="padding:6px 0 12px;display:flex;flex-direction:column;gap:10px">' +
        '<label class="btn out" style="cursor:pointer">Pulihkan dari cadangan<input type="file" accept=".json,application/json" data-ch="restore" style="display:none"></label>' +
        '<button class="btn out" data-a="sample">Coba dengan data contoh</button><button class="btn red" data-a="wipe">Hapus semua data</button>' +
        '<div class="hint">Data tersimpan di HP ini saja. Cadangkan sesekali supaya aman kalau HP ganti atau hilang.</div></div>');
      return h + '</main>';
    }
  };

  // ---------- Panduan ----------
  R.panduan = {
    nonav: true,
    render: function () {
      var st = ui.pstep, h = '';
      var t = ['Apa yang Anda jual?', 'Hitung modal per pcs', 'Isi biaya bulanan', 'Siap dipakai'][st - 1];
      h += head('LANGKAH ' + st + ' DARI 4', t, st === 1 ? 'Pilih yang paling mirip. Nanti bisa diganti.' : '') + '<main>';
      if (st === 1) {
        [['sendiri', 'Bikin sendiri', 'Pakai bahan: kue, makanan, minuman, kerajinan.'], ['jadi', 'Beli jadi, jual lagi', 'Warung, reseller, toko. Cukup tahu harga belinya.'], ['jasa', 'Jasa', 'Cuci, potong rambut, servis. Modalnya bahan habis pakai (boleh kosong).']].forEach(function (o) {
          h += '<button class="opt' + (ui.ptype === o[0] ? ' on' : '') + '" data-a="ptype" data-v="' + o[0] + '"><div class="t">' + o[1] + '</div><div class="s">' + o[2] + '</div></button>';
        });
      } else if (st === 2) {
        h += '<div class="note">Modal per pcs adalah biaya untuk menghasilkan 1 barang. Dari sini juga dihitung harga jual yang pas.</div>' + btn('Hitung modal sekarang', 'pgo', '') .replace('data-a="pgo"', 'data-a="pgo" data-v="modal"');
      } else if (st === 3) {
        h += '<div class="note">Biaya bulanan tetap: sewa, listrik, iklan, dan sejenisnya. Diisi sekali, dipakai untuk target jualan dan untung harian.</div>' + btn('Isi biaya bulanan', 'pgo').replace('data-a="pgo"', 'data-a="pgo" data-v="biaya"');
      } else {
        h += card(row('Beranda', 'untung hari ini dan jalan pintas', '') + row('Jualan', 'catat yang laku tiap hari', '') + row('Bahan', 'sisa stok dan belanja', '') + row('Biaya', 'biaya bulanan dan pengeluaran lain', '') + row('Untung', 'ringkasan bulanan', ''));
        h += btn('Mulai pakai', 'pgo').replace('data-a="pgo"', 'data-a="pgo" data-v="mulai"');
      }
      h += '<div class="dots">' + [1, 2, 3, 4].map(function (i) { return '<i class="' + (i === st ? 'on' : '') + '"></i>'; }).join('') + '</div>';
      if (st < 4) h += '<button class="btn out" data-a="pnext">' + (st === 1 ? 'Lanjut' : 'Lewati, lanjut langkah berikutnya') + '</button>';
      if (st > 1) h += '<button class="lnk" data-a="pback">Kembali</button>';
      h += '<a class="lnk" href="#/">Tutup panduan</a>';
      return h + '</main>';
    }
  };

  // ---------- Beranda ----------
  R[''] = {
    render: function () {
      var t = todayStr(), e = db.jualan[t], n = new Date();
      var h = head(null, 'Beranda', 'Catat jualan, hitung harga, lihat untung.') + '<main>';
      if (e && e.items.length) {
        var r = C.untungBersihHari(db, t, e.items);
        h += res('', 'Untung hari ini', rp(r.bersih), fmt(r.pcs, 0) + ' pcs terjual · ' + dLong(t), null, r.bersih < 0);
      } else h += res('', 'Untung hari ini', '-', 'Belum ada jualan dicatat hari ini · ' + dLong(t));
      h += '<a class="big p" href="#/jualan"><div class="t">Catat jualan hari ini</div><div class="s">Isi berapa yang laku</div></a>';
      h += '<a class="big" href="#/modal" data-a="newProduk"><div class="t">Hitung harga jual</div><div class="s">Tahu modal dan harga yang pas</div></a>';
      h += '<a class="big" href="#/untung"><div class="t">Untung bulan ini</div><div class="s">Lihat untung atau rugi</div></a>';
      var pb = perluBeliText();
      if (pb) h += '<a class="warn" href="#/bahan"><div class="t">Bahan perlu dibeli</div><div class="v">' + pb + '</div><div style="margin-top:6px;font-size:15px;font-weight:600;color:var(--acc)">Lihat semua bahan</div></a>';
      var p = db.produk[0];
      if (p) {
        var tg = C.targetAman(C.biayaTotal(db), p.harga - p.modal);
        if (tg) {
          var jual = C.pcsProdukBulan(db, p.id, n.getFullYear(), n.getMonth() + 1), pct = Math.min(100, Math.round(jual / tg * 100));
          h += card('<div style="padding:12px 0"><div style="display:flex;justify-content:space-between;font-size:16px"><b>Target jualan aman</b><span style="color:var(--mut)">' + fmt(jual, 0) + ' dari ' + fmt(tg, 0) + ' pcs</span></div><div class="bar" style="margin-top:8px"><i style="width:' + pct + '%"></i></div><a href="#/target/' + p.id + '" style="display:inline-block;margin-top:10px;font-size:15px;font-weight:600">Lihat target</a></div>');
        }
      }
      h += '<a class="lnk" style="text-align:center;text-decoration:none" href="#/panduan">Pertama kali pakai? Lihat panduan</a>';
      return h + '</main>';
    }
  };

  // ---------- Aksi ----------
  function go(h) { if (location.hash === '#/' + h) render(); else location.hash = '#/' + h; }

  function tambahBahan() {
    var b = ui.baru;
    if (!b.nama.trim()) { toast('Isi nama bahan.'); return null; }
    if (stokByName(b.nama)) { toast('Bahan itu sudah ada di daftar.'); return null; }
    if (!b.satuan.trim()) { toast('Isi satuannya, misalnya kg atau butir.'); return null; }
    var it = { id: nid(), nama: b.nama.trim(), satuan: b.satuan.trim(), stok: num(b.stok), batas: num(b.batas) };
    db.stok.push(it); ui.bel = null;
    return save() ? it : null;
  }

  var A = {
    mode: function (el) { draft.mode = el.dataset.v; render(true); },
    addBahan: function () { draft.bahan.push({ nama: '', jumlah: '', satuan: '', harga: '' }); render(true); },
    delBahan: function (el) { draft.bahan.splice(+el.dataset.i, 1); if (!draft.bahan.length) draft.bahan.push({ nama: '', jumlah: '', satuan: '', harga: '' }); render(true); },
    toHarga: function () {
      var d = draft, m = modalNow(d);
      if (!d.nama.trim()) return toast('Isi nama produk dulu.');
      if (d.mode === 'sendiri' && !(num(d.hasil) > 0)) return toast('Isi hasil jadi (pcs) dulu.');
      if (!(m.perPcs > 0)) return toast('Modal per pcs belum terhitung. Isi dulu angkanya.');
      go('harga');
    },
    why: function () { ui.why = !ui.why; var w = $('why'); if (w) w.style.display = ui.why ? 'block' : 'none'; },
    saveProduk: function () {
      var d = draft, x = hargaNow(d);
      if (!(x.pakai > 0)) return toast('Harga jual belum terhitung. Cek persen untung atau isi harga sendiri.');
      var p = { id: d.id || nid(), nama: d.nama.trim(), modal: x.modal, harga: Math.round(x.pakai), mode: d.mode, src: clone(d) };
      p.src.id = p.id;
      if (d.id) { var i = db.produk.indexOf(produkById(d.id)); if (i >= 0) db.produk[i] = p; else db.produk.push(p); }
      else db.produk.push(p);
      d.id = p.id;
      if (!save()) return;
      toast('Produk tersimpan');
      go('target/' + p.id);
    },
    newProduk: function () { draft = newDraft(ui.ptype === 'jadi' ? 'jadi' : (ui.ptype === 'jasa' ? 'manual' : 'sendiri')); go('modal'); },
    editProduk: function (el) { var p = produkById(el.dataset.id); if (!p) return; draft = clone(p.src); draft.id = p.id; go('modal'); },
    delProduk: function (el) {
      var p = produkById(el.dataset.id); if (!p) return;
      if (!confirm('Hapus produk "' + p.nama + '"? Riwayat jualan yang sudah tercatat tetap ada.')) return;
      db.produk = db.produk.filter(function (x) { return x.id !== p.id; });
      ui.jq = null; save(); render(true);
    },
    ctr: function (el) {
      var id = el.dataset.id, q = Math.max(0, Math.floor(num(ui.jq[id])) + (+el.dataset.d));
      ui.jq[id] = q; var i = $('q' + id); if (i) i.value = q; R.jualan.update();
    },
    bukaTgl: function (el) { ui.jd = el.dataset.d; ui.jq = null; render(true); window.scrollTo(0, 0); },
    allDays: function () { ui.allDays = !ui.allDays; R.jualan.update(); },
    saveJual: function () {
      var date = ui.jd, old = (db.jualan[date] || { items: [] }).items, items = buildItems(date);
      db.produk.forEach(function (p) {
        var o = old.filter(function (x) { return x.pid === p.id; })[0], oq = o ? o.qty : 0;
        var n = items.filter(function (x) { return x.pid === p.id; })[0], nq = n ? n.qty : 0;
        if (nq !== oq) applyStok(p, nq - oq);
      });
      if (items.length) db.jualan[date] = { items: items }; else delete db.jualan[date];
      if (!save()) return;
      toast(items.length ? 'Jualan tersimpan' : 'Catatan hari itu dikosongkan');
      render(true);
    },
    allBel: function () { ui.allBel = !ui.allBel; render(true); },
    saveBelanja: function () {
      var b = ui.bel, s = stokById(b.id);
      if (!s) return toast('Pilih bahannya dulu.');
      if (!(num(b.jml) > 0)) return toast('Isi jumlah yang dibeli.');
      s.stok = r6(num(s.stok) + num(b.jml));
      db.belanja.push({ id: nid(), tgl: b.tgl, itemId: s.id, nama: s.nama, jml: num(b.jml), satuan: s.satuan, total: num(b.total) });
      if (!save()) return;
      toast('Belanja tersimpan, stok ' + s.nama + ' jadi ' + fmt(s.stok) + ' ' + s.satuan);
      ui.bel = null; go('bahan');
    },
    saveKoreksi: function () {
      var k = ui.kor, s = stokById(k.id); if (!s) return;
      var nama = k.nama.trim(), satuan = k.satuan.trim(), dup = stokByName(nama);
      if (!nama) return toast('Nama bahan tidak boleh kosong.');
      if (dup && dup.id !== s.id) return toast('Sudah ada bahan dengan nama itu.');
      if (!satuan) return toast('Isi satuannya, misalnya kg atau butir.');
      if (nama.toLowerCase() !== s.nama.trim().toLowerCase()) {
        db.produk.forEach(function (p) {
          if (p.src && p.src.bahan) p.src.bahan.forEach(function (b) { if (String(b.nama).trim().toLowerCase() === s.nama.trim().toLowerCase()) b.nama = nama; });
        });
      }
      s.nama = nama; s.satuan = satuan; s.stok = r6(num(k.sisa)); s.batas = num(k.batas);
      if (!save()) return;
      toast('Bahan ' + s.nama + ' disimpan'); ui.kor = null; ui.bel = null; go('bahan');
    },
    delStok: function (el) {
      var s = stokById(el.dataset.id); if (!s) return;
      if (!confirm('Hapus bahan "' + s.nama + '" dari daftar?')) return;
      db.stok = db.stok.filter(function (x) { return x.id !== s.id; }); ui.kor = null; ui.bel = null; save(); go('bahan');
    },
    saveBahan: function () {
      var it = tambahBahan(); if (!it) return;
      ui.baru = null; toast('Bahan ditambahkan'); go('bahan');
    },
    saveBahanLagi: function () {
      var sat = ui.baru.satuan, it = tambahBahan(); if (!it) return;
      ui.baru = { nama: '', satuan: sat, stok: '', batas: '' };
      toast(it.nama + ' ditambahkan. Isi bahan berikutnya.');
      render();
      var i = document.querySelector('[data-k="u.baru.nama"]'); if (i) i.focus();
    },
    saveLain: function () {
      var l = ui.lain;
      if (!l.untuk.trim()) return toast('Isi untuk keperluan apa.');
      if (!(num(l.jml) > 0)) return toast('Isi jumlahnya.');
      db.lain.push({ id: nid(), tgl: todayStr(), untuk: l.untuk.trim(), jml: num(l.jml) });
      ui.lain = { untuk: '', jml: '' }; save(); toast('Pengeluaran tersimpan'); render(true);
    },
    delLain: function (el) { db.lain = db.lain.filter(function (x) { return String(x.id) !== el.dataset.id; }); save(); render(true); },
    addBiaya: function () { db.biaya.push({ nama: '', jumlah: '' }); save(); render(true); },
    delBiaya: function (el) { db.biaya.splice(+el.dataset.i, 1); save(); render(true); },
    ptype: function (el) { ui.ptype = el.dataset.v; render(true); },
    pnext: function () { ui.pstep = Math.min(4, ui.pstep + 1); render(true); },
    pback: function () { ui.pstep = Math.max(1, ui.pstep - 1); render(true); },
    pgo: function (el) {
      var v = el.dataset.v;
      if (v === 'modal') { draft = newDraft(ui.ptype === 'jadi' ? 'jadi' : (ui.ptype === 'jasa' ? 'manual' : 'sendiri')); go('modal'); }
      else if (v === 'biaya') go('biaya'); else go('');
    },
    backup: function () {
      var blob = new Blob([JSON.stringify(db)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'cadangan-kalkulator-umkm-' + todayStr() + '.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      toast('Cadangan diunduh');
    },
    share: function () {
      var p = C.splitYmd(ui.um + '-01'), s = C.ringkasanBulan(db, p.y, p.m, new Date());
      var txt = 'Ringkasan ' + BULAN[p.m - 1] + ' ' + p.y + '\nJualan: ' + rp(s.jual) + ' (' + fmt(s.pcs, 0) + ' pcs)\nUntung dari jualan: ' + rp(s.kotor) + '\nBiaya bulanan: ' + rp(s.biaya) + '\nUntung bersih: ' + rp(s.bersih) + '\n(Kalkulator UMKM)';
      if (navigator.share) navigator.share({ text: txt }).catch(function () { });
      else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('Ringkasan disalin'); });
      else toast('Tidak bisa membagikan di perangkat ini.');
    },
    sample: function () {
      if ((db.produk.length || Object.keys(db.jualan).length) && !confirm('Data contoh akan MENGGANTI semua data yang ada sekarang. Lanjut?')) return;
      loadSample(); toast('Data contoh dimuat'); go('');
    },
    wipe: function () {
      if (!confirm('Hapus SEMUA data di HP ini? Ini tidak bisa dibatalkan. Sudah cadangkan?')) return;
      db = fresh(); draft = null; ui.jq = null; ui.bel = null; ui.kor = null; save(); toast('Semua data dihapus'); go('');
    }
  };

  var CH = {
    setTgl: function (v) { if (!v) return; ui.jd = v; ui.jq = null; render(true); },
    pilihTarget: function (v) { go('target/' + v); },
    pilihBahan: function (v) { ui.bel.id = v; render(true); },
    pilihBulan: function (v) { ui.um = v; render(true); },
    restore: function (v, el) {
      var f = el.files && el.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var d = JSON.parse(r.result);
          if (!d || !Array.isArray(d.produk) || typeof d.jualan !== 'object') throw 0;
          if (!confirm('Pulihkan data dari file ini? Data yang ada sekarang akan diganti.')) return;
          var f0 = fresh(); Object.keys(f0).forEach(function (k) { if (d[k] == null) d[k] = f0[k]; });
          db = d; ui.jq = null; ui.bel = null; ui.kor = null; save(); toast('Data dipulihkan'); go('');
        } catch (e) { toast('File cadangan tidak dikenali.'); }
      };
      r.readAsText(f);
    }
  };

  function loadSample() {
    var t = new Date(), d1 = new Date(t.getTime() - 864e5), d2 = new Date(t.getTime() - 2 * 864e5);
    var f = fresh(); f.seq = 100;
    var brow = { mode: 'sendiri', nama: 'Brownies kukus', hasil: '20', bahan: [
      { nama: 'Tepung terigu', jumlah: '2', satuan: 'kg', harga: '13.000' }, { nama: 'Telur', jumlah: '20', satuan: 'butir', harga: '2.000' },
      { nama: 'Cokelat', jumlah: '0,8', satuan: 'kg', harga: '70.000' }, { nama: 'Gula', jumlah: '1', satuan: 'kg', harga: '18.000' }],
      kemasan: '1.000', upah: '20.000', susut: '0', beli: '', ongkos: '', modal: '', margin: '40', plat: '0', harga: '' };
    var air = { mode: 'jadi', nama: 'Air mineral botol', hasil: '', bahan: [{ nama: '', jumlah: '', satuan: '', harga: '' }], kemasan: '', upah: '', susut: '0', beli: '2.500', ongkos: '500', modal: '', margin: '40', plat: '0', harga: '' };
    brow.id = 1; air.id = 2;
    f.produk = [{ id: 1, nama: 'Brownies kukus', modal: 9000, harga: 15000, mode: 'sendiri', src: brow }, { id: 2, nama: 'Air mineral botol', modal: 3000, harga: 5000, mode: 'jadi', src: air }];
    f.biaya = [{ nama: 'Sewa tempat', jumlah: '800.000' }, { nama: 'Listrik dan gas', jumlah: '300.000' }, { nama: 'Iklan', jumlah: '400.000' }];
    f.stok = [{ id: 10, nama: 'Tepung terigu', satuan: 'kg', stok: 3, batas: 1 }, { id: 11, nama: 'Telur', satuan: 'butir', stok: 0, batas: 10 }, { id: 12, nama: 'Cokelat', satuan: 'kg', stok: 0.3, batas: 0.5 },
      { id: 13, nama: 'Gula', satuan: 'kg', stok: 4, batas: 1 }, { id: 14, nama: 'Air mineral botol', satuan: 'pcs', stok: 48, batas: 12 }];
    f.belanja = [{ id: 20, tgl: C.ymd(t), itemId: 10, nama: 'Tepung terigu', jml: 2, satuan: 'kg', total: 26000 }, { id: 21, tgl: C.ymd(d1), itemId: 11, nama: 'Telur', jml: 20, satuan: 'butir', total: 40000 },
      { id: 22, tgl: C.ymd(d2), itemId: 12, nama: 'Cokelat', jml: 0.8, satuan: 'kg', total: 56000 }];
    function it(q) { return { items: [{ pid: 1, nama: 'Brownies kukus', qty: q, harga: 15000, modal: 9000 }] }; }
    f.jualan[C.ymd(t)] = it(12); f.jualan[C.ymd(d1)] = it(9); f.jualan[C.ymd(d2)] = it(15);
    var pm = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    for (var i = 1; i <= 10; i++) f.jualan[pm.getFullYear() + '-' + C.pad(pm.getMonth() + 1) + '-' + C.pad(i)] = it(30);
    db = f; draft = null; ui.jq = null; ui.bel = null; ui.kor = null; ui.um = null; save();
  }

  // ---------- router ----------
  var TAB = [['', 'Beranda', '#/'], ['jualan', 'Jualan', '#/jualan'], ['bahan', 'Bahan', '#/bahan'], ['biaya', 'Biaya', '#/biaya'], ['untung', 'Untung', '#/untung']];
  var GROUP = { modal: '', harga: '', target: '', produk: '', panduan: '', belanja: 'bahan', koreksi: 'bahan', 'bahan-baru': 'bahan' };
  function render(keep) {
    var h = (location.hash || '#/').replace(/^#\/?/, ''), parts = h.split('/'), name = parts[0], arg = parts[1];
    var r = R[name] || R['']; if (!R[name]) name = '';
    cur = { name: name, arg: arg, route: r };
    var y = window.scrollY, html = r.render(arg);
    var active = GROUP.hasOwnProperty(name) ? GROUP[name] : name;
    var nav = r.nonav ? '' : '<nav class="tabs">' + TAB.map(function (t) { return '<a href="' + t[2] + '"' + (t[0] === active ? ' class="on"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav>';
    app.innerHTML = html + nav;
    if (r.update) r.update();
    window.scrollTo(0, keep === true ? y : 0);
  }

  function setPath(path, val) {
    var seg = path.split('.'), root = seg.shift(), o = root === 'd' ? draft : (root === 'u' ? ui : db);
    for (var i = 0; i < seg.length - 1; i++) { o = o[seg[i]]; if (o == null) return; }
    o[seg[seg.length - 1]] = val;
  }

  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]'); if (!el || !app.contains(el)) return;
    var f = A[el.dataset.a]; if (f) { e.preventDefault(); f(el); }
  });
  app.addEventListener('input', function (e) {
    var k = e.target.dataset && e.target.dataset.k; if (!k) return;
    setPath(k, e.target.value);
    if (k.indexOf('db.') === 0) save();
    if (cur.route && cur.route.update) cur.route.update();
  });
  app.addEventListener('change', function (e) {
    var k = e.target.dataset && e.target.dataset.k;
    if (k && e.target.type === 'date') { setPath(k, e.target.value); if (cur.route && cur.route.update) cur.route.update(); }
    var c = e.target.dataset && e.target.dataset.ch; if (c && CH[c]) CH[c](e.target.value, e.target);
  });
  window.addEventListener('hashchange', function () { render(); });

  // Uji dan pemeriksaan dari luar
  window.__app = { get db() { return db; }, A: A, CH: CH, go: go, render: render, loadSample: loadSample, ui: ui, get draft() { return draft; } };

  render();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    var had = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.register('sw.js').catch(function () { });
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (had && !reloaded) { reloaded = true; location.reload(); } });
  }
})();
