/* Rumus hitungan Kalkulator UMKM. Tanpa tampilan, bisa diuji terpisah. */
(function (root) {
  'use strict';

  // Angka Indonesia: "2.500" = 2500, "2,5" = 2,5, "0.8" = 0,8
  function parseNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).trim().replace(/\s/g, '').replace(/^rp/i, '');
    if (s === '') return 0;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function round(n) { return Math.round(n); }

  // Modal per pcs, bikin sendiri.
  // bahan: [{jumlah, harga}] (jumlah x harga per satuan), kemasan = per pcs, upah = total sekali bikin.
  // susut: persen tambahan bahan yang terbuang.
  function modalSendiri(o) {
    var hasil = parseNum(o.hasil);
    var bahan = 0;
    (o.bahan || []).forEach(function (b) { bahan += parseNum(b.jumlah) * parseNum(b.harga); });
    var susut = parseNum(o.susut);
    var bahanTotal = bahan * (1 + susut / 100);
    var kemasanTotal = parseNum(o.kemasan) * hasil;
    var upah = parseNum(o.upah);
    var total = bahanTotal + kemasanTotal + upah;
    return {
      bahan: bahan, bahanTotal: bahanTotal, kemasanTotal: kemasanTotal, upah: upah,
      total: total, hasil: hasil, perPcs: hasil > 0 ? total / hasil : 0
    };
  }

  // Jasa: daftar biaya + bahan dari stok untuk satu pesanan, dibagi jumlah pesanan (pcs).
  // biaya: [{jml, cara: 'pcs'|'sekali'|'harian', orang, hari}]; bstok: [{jumlah, harga, cara: 'pcs'|'semua'}].
  function biayaBaris(b, n) {
    var j = parseNum(b.jml);
    if (b.cara === 'sekali') return j;
    if (b.cara === 'harian') return j * parseNum(b.orang) * parseNum(b.hari);
    return j * n;
  }
  function bahanBaris(b, n) {
    var t = parseNum(b.jumlah) * parseNum(b.harga);
    return b.cara === 'semua' ? t : t * n;
  }
  function modalJasa(o) {
    var n = parseNum(o.pesanan);
    var biaya = 0, bahan = 0;
    (o.biaya || []).forEach(function (b) { biaya += biayaBaris(b, n); });
    (o.bstok || []).forEach(function (b) { bahan += bahanBaris(b, n); });
    if (!Array.isArray(o.biaya)) biaya += parseNum(o.modal) * n;
    var total = biaya + bahan;
    return { pesanan: n, biaya: biaya, bahan: bahan, total: total, perPcs: n > 0 ? total / n : 0 };
  }

  function modalJadi(beli, ongkos) {
    return parseNum(beli) + parseNum(ongkos);
  }

  // Harga jual: persen dihitung dari harga jual. Mengembalikan null kalau tidak mungkin.
  function hargaJual(modal, marginPct, platPct) {
    var m = parseNum(marginPct) / 100, p = parseNum(platPct) / 100;
    var pembagi = 1 - m - p;
    if (!(pembagi > 0) || !(modal > 0)) return null;
    return modal / pembagi;
  }

  function untungPerPcs(harga, modal) { return harga - modal; }
  function persenUntung(harga, modal) { return harga > 0 ? (harga - modal) / harga * 100 : 0; }

  // Target jualan aman (titik impas) dalam pcs, dibulatkan ke atas.
  function targetAman(biayaBulanan, untungPcs) {
    if (!(untungPcs > 0) || !(biayaBulanan > 0)) return null;
    return Math.ceil(biayaBulanan / untungPcs - 1e-9);
  }

  function hariDalamBulan(y, m1) { return new Date(y, m1, 0).getDate(); } // m1 = 1..12

  function biayaTotal(db) {
    var t = 0;
    (db.biaya || []).forEach(function (b) { t += parseNum(b.jumlah); });
    return t;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function ym(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function splitYmd(s) { var p = s.split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }

  // Untung dari jualan satu hari (belum dikurangi biaya harian).
  function untungJualan(entry) {
    var u = 0, pcs = 0, jual = 0;
    ((entry && entry.items) || []).forEach(function (it) {
      u += it.qty * (it.harga - it.modal); pcs += it.qty; jual += it.qty * it.harga;
    });
    return { untung: u, pcs: pcs, jual: jual };
  }

  function biayaPerHari(db, y, m1) {
    return biayaTotal(db) / hariDalamBulan(y, m1);
  }

  // Untung bersih satu hari = untung dari jualan - biaya bulanan per hari.
  function untungBersihHari(db, dateStr, items) {
    var p = splitYmd(dateStr);
    var u = untungJualan({ items: items });
    return { jual: u.jual, pcs: u.pcs, untungJualan: u.untung, biayaHari: biayaPerHari(db, p.y, p.m), bersih: u.untung - biayaPerHari(db, p.y, p.m) };
  }

  // Berapa hari biaya yang sudah berjalan di bulan itu (bulan berjalan: sampai hari ini).
  function hariBerjalan(y, m1, today) {
    var cur = today.getFullYear() * 12 + today.getMonth();
    var tgt = y * 12 + (m1 - 1);
    if (tgt < cur) return hariDalamBulan(y, m1);
    if (tgt > cur) return 0;
    return today.getDate();
  }

  function ringkasanBulan(db, y, m1, today) {
    var key = y + '-' + pad(m1);
    var pcs = 0, jual = 0, modal = 0, hariAda = 0;
    Object.keys(db.jualan || {}).forEach(function (k) {
      if (k.slice(0, 7) !== key) return;
      var e = db.jualan[k], any = false;
      (e.items || []).forEach(function (it) {
        pcs += it.qty; jual += it.qty * it.harga; modal += it.qty * it.modal; if (it.qty > 0) any = true;
      });
      if (any) hariAda++;
    });
    var dim = hariDalamBulan(y, m1);
    var hari = hariBerjalan(y, m1, today);
    var biayaBulan = biayaTotal(db);
    var biaya = biayaBulan * hari / dim;
    var kotor = jual - modal;
    var bersih = kotor - biaya;
    return {
      pcs: pcs, jual: jual, modal: modal, kotor: kotor, biayaBulan: biayaBulan, biaya: biaya,
      hari: hari, hariDalamBulan: dim, bersih: bersih, persen: jual > 0 ? bersih / jual * 100 : null,
      status: bersih > 0 ? 'Untung' : (bersih < 0 ? 'Rugi' : 'Impas'), hariAda: hariAda
    };
  }

  function pcsProdukBulan(db, pid, y, m1) {
    var key = y + '-' + pad(m1), n = 0;
    Object.keys(db.jualan || {}).forEach(function (k) {
      if (k.slice(0, 7) !== key) return;
      ((db.jualan[k] || {}).items || []).forEach(function (it) { if (it.pid === pid) n += it.qty; });
    });
    return n;
  }

  // Stok
  function stokStatus(item) {
    var s = parseNum(item.stok), b = parseNum(item.batas);
    if (s <= 0) return 'Habis';
    if (s <= b) return 'Menipis';
    return 'Aman';
  }

  // Pemakaian bahan per pcs terjual dari resep: jumlah per sekali bikin / hasil jadi.
  function pemakaianPerPcs(produk) {
    var out = [];
    if (!produk || !produk.src) return out;
    var s = produk.src;
    if (s.mode === 'sendiri') {
      var hasil = parseNum(s.hasil);
      if (hasil > 0) (s.bahan || []).forEach(function (b) {
        var j = parseNum(b.jumlah);
        if (b.nama && j > 0) out.push({ nama: b.nama, per: j / hasil });
      });
    } else if (s.mode === 'jadi') {
      if (s.nama) out.push({ nama: s.nama, per: 1 });
    } else if (s.mode === 'manual') {
      var n = parseNum(s.pesanan);
      (s.bstok || []).forEach(function (b) {
        var j = parseNum(b.jumlah);
        if (!b.nama || !(j > 0)) return;
        if (b.cara === 'semua') { if (n > 0) out.push({ nama: b.nama, per: j / n }); }
        else out.push({ nama: b.nama, per: j });
      });
    }
    return out;
  }

  function fmtNum(n, maxDec) {
    var d = maxDec == null ? 2 : maxDec;
    var v = Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
    return v.toLocaleString('id-ID', { maximumFractionDigits: d });
  }
  function rp(n) {
    var v = Math.round(n);
    return (v < 0 ? '-' : '') + 'Rp' + Math.abs(v).toLocaleString('id-ID');
  }

  var api = {
    parseNum: parseNum, round: round, modalSendiri: modalSendiri, modalJadi: modalJadi, modalJasa: modalJasa, biayaBaris: biayaBaris, bahanBaris: bahanBaris,
    hargaJual: hargaJual, untungPerPcs: untungPerPcs, persenUntung: persenUntung, targetAman: targetAman,
    hariDalamBulan: hariDalamBulan, biayaTotal: biayaTotal, biayaPerHari: biayaPerHari,
    untungJualan: untungJualan, untungBersihHari: untungBersihHari, hariBerjalan: hariBerjalan,
    ringkasanBulan: ringkasanBulan, pcsProdukBulan: pcsProdukBulan, stokStatus: stokStatus,
    pemakaianPerPcs: pemakaianPerPcs, fmtNum: fmtNum, rp: rp, ymd: ymd, ym: ym, splitYmd: splitYmd, pad: pad
  };
  root.Calc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
