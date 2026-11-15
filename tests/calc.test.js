// Uji rumus dengan angka contoh yang sama dengan mockup. Jalankan: node tests/calc.test.js
const C = require('../calc.js');
let gagal = 0, lulus = 0;
function sama(nama, hasil, harapan) {
  const ok = typeof harapan === 'number' ? Math.abs(hasil - harapan) < 1e-6 : hasil === harapan;
  if (ok) lulus++; else { gagal++; console.log('GAGAL', nama, '=>', hasil, 'seharusnya', harapan); }
}

// Angka Indonesia
sama('2.500', C.parseNum('2.500'), 2500);
sama('2,5', C.parseNum('2,5'), 2.5);
sama('0.8', C.parseNum('0.8'), 0.8);
sama('1.250.000', C.parseNum('1.250.000'), 1250000);
sama('Rp15.000', C.parseNum('Rp15.000'), 15000);
sama('kosong', C.parseNum(''), 0);
sama('1.234,5', C.parseNum('1.234,5'), 1234.5);

// Modal per pcs, brownies kukus
const m = C.modalSendiri({
  hasil: 20, kemasan: 1000, upah: 20000, susut: 0,
  bahan: [{ jumlah: 2, harga: 13000 }, { jumlah: 20, harga: 2000 }, { jumlah: 0.8, harga: 70000 }, { jumlah: 1, harga: 18000 }]
});
sama('bahan', m.bahan, 140000);
sama('total', m.total, 180000);
sama('modal per pcs', m.perPcs, 9000);
// Bahan terbuang 10%: bahan 140.000 -> 154.000, total 194.000
sama('susut 10%', C.modalSendiri({ hasil: 20, kemasan: 1000, upah: 20000, susut: 10, bahan: [{ jumlah: 1, harga: 140000 }] }).total, 194000);
sama('hasil 0 aman', C.modalSendiri({ hasil: 0, bahan: [] }).perPcs, 0);

// Beli jadi
sama('beli jadi', C.modalJadi('2.500', '500'), 3000);

// Harga jual
sama('harga 40%', C.hargaJual(9000, 40, 0), 15000);
sama('harga jual air', C.hargaJual(3000, 40, 0), 5000);
sama('harga dengan QRIS 0,7%', Math.round(C.hargaJual(9000, 40, 0.7) * 100) / 100, Math.round(9000 / (1 - 0.4 - 0.007) * 100) / 100);
sama('margin+plat >= 100', C.hargaJual(9000, 60, 40), null);
sama('untung per pcs', C.untungPerPcs(15000, 9000), 6000);
sama('persen untung', C.persenUntung(15000, 9000), 40);
sama('markup 1,4 -> margin sebenarnya', Math.round(C.persenUntung(12600, 9000) * 10) / 10, 28.6);

// Target aman
sama('target 250', C.targetAman(1500000, 6000), 250);
sama('target bulat ke atas', C.targetAman(1500000, 7000), 215);
sama('target tanpa untung', C.targetAman(1500000, 0), null);

// Biaya per hari
const db = { biaya: [{ jumlah: '800.000' }, { jumlah: '300.000' }, { jumlah: '400.000' }], jualan: {} };
sama('biaya total', C.biayaTotal(db), 1500000);
sama('biaya per hari (30 hari)', C.biayaPerHari(db, 2026, 11), 50000);
sama('hari Nov', C.hariDalamBulan(2026, 11), 30);
sama('hari Feb 2028', C.hariDalamBulan(2028, 2), 29);

// Untung bersih harian: 12 pcs x (15.000-9.000) - 50.000 = 22.000
const hr = (q) => [{ pid: 1, qty: q, harga: 15000, modal: 9000 }];
sama('untung hari 12 pcs', C.untungBersihHari(db, '2026-11-14', hr(12)).bersih, 22000);
sama('untung hari 9 pcs', C.untungBersihHari(db, '2026-11-13', hr(9)).bersih, 4000);
sama('untung hari 15 pcs', C.untungBersihHari(db, '2026-11-12', hr(15)).bersih, 40000);
sama('hari tanpa jualan', C.untungBersihHari(db, '2026-11-11', hr(0)).bersih, -50000);

// November berjalan sampai tgl 14: 180 pcs -> 1.080.000 - 700.000 = 380.000
db.jualan = {};
const qtys = [12, 9, 15, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 44]; // jumlah 180
sama('jumlah qty contoh', qtys.reduce((a, b) => a + b, 0), 180);
qtys.forEach((q, i) => { db.jualan['2026-11-' + C.pad(i + 1)] = { items: hr(q) }; });
const nov = C.ringkasanBulan(db, 2026, 11, new Date(2026, 10, 14));
sama('nov pcs', nov.pcs, 180);
sama('nov untung bersih berjalan', nov.bersih, 380000);
sama('nov hari berjalan', nov.hari, 14);

// Oktober penuh: 300 pcs -> jual 4.500.000, modal 2.700.000, kotor 1.800.000, bersih 300.000, 6,7%
db.jualan = {};
for (let d = 1; d <= 10; d++) db.jualan['2026-10-' + C.pad(d)] = { items: hr(30) };
const okt = C.ringkasanBulan(db, 2026, 10, new Date(2026, 10, 14));
sama('okt pcs', okt.pcs, 300);
sama('okt jual', okt.jual, 4500000);
sama('okt modal', okt.modal, 2700000);
sama('okt kotor', okt.kotor, 1800000);
sama('okt biaya', okt.biaya, 1500000);
sama('okt bersih', okt.bersih, 300000);
sama('okt persen', Math.round(okt.persen * 10) / 10, 6.7);
sama('okt status', okt.status, 'Untung');

// Jumlah untung bersih harian sebulan penuh = laba bersih bulanan
let tot = 0;
for (let d = 1; d <= 31; d++) {
  const k = '2026-10-' + C.pad(d);
  tot += C.untungBersihHari(db, k, (db.jualan[k] || { items: [] }).items).bersih;
}
sama('jumlah harian = bulanan', tot, 300000);

// Stok
sama('aman', C.stokStatus({ stok: 3, batas: 1 }), 'Aman');
sama('menipis', C.stokStatus({ stok: 0.3, batas: 0.5 }), 'Menipis');
sama('habis', C.stokStatus({ stok: 0, batas: 10 }), 'Habis');
sama('menipis tepat di batas', C.stokStatus({ stok: 1, batas: 1 }), 'Menipis');
sama('habis negatif', C.stokStatus({ stok: -2, batas: 1 }), 'Habis');

// Pemakaian per pcs: tepung 2 kg untuk 20 pcs = 0,1 kg per pcs; 12 pcs = 1,2 kg
const pr = { src: { mode: 'sendiri', hasil: 20, bahan: [{ nama: 'Tepung terigu', jumlah: 2 }] } };
sama('tepung per pcs', C.pemakaianPerPcs(pr)[0].per, 0.1);
sama('tepung 12 pcs', C.pemakaianPerPcs(pr)[0].per * 12, 1.2);
sama('beli jadi 1:1', C.pemakaianPerPcs({ src: { mode: 'jadi', nama: 'Air mineral' } })[0].per, 1);

// Jasa: jahit 1000 pcs (contoh mockup)
const jas = {
  pesanan: 1000,
  biaya: [
    { jml: 3000, cara: 'pcs' },
    { jml: 500000, cara: 'sekali' },
    { jml: 100000, cara: 'harian', orang: 5, hari: 6 }
  ],
  bstok: [{ nama: 'Benang', jumlah: 20, harga: 8000, cara: 'semua' }]
};
const mj = C.modalJasa(jas);
sama('jasa biaya', mj.biaya, 6500000);
sama('jasa bahan stok', mj.bahan, 160000);
sama('jasa total', mj.total, 6660000);
sama('jasa modal per pcs', mj.perPcs, 6660);
sama('jasa harian baris', C.biayaBaris(jas.biaya[2], 1000), 3000000);
sama('jasa harga jual 40%', Math.round(C.hargaJual(6660, 40, 0)), 11100);
sama('jasa pemakaian benang per pcs', C.pemakaianPerPcs({ src: Object.assign({ mode: 'manual' }, jas) })[0].per, 0.02);
sama('jasa pemakaian per pcs langsung', C.pemakaianPerPcs({ src: { mode: 'manual', pesanan: 1, bstok: [{ nama: 'Sabun', jumlah: 0.05, cara: 'pcs' }] } })[0].per, 0.05);
sama('jasa tanpa isi', C.modalJasa({ pesanan: 1, biaya: [], bstok: [] }).perPcs, 0);
sama('jasa lama (modal manual) tetap terbaca', C.modalJasa({ pesanan: 1, modal: '3.000' }).perPcs, 3000);

// Tampilan rupiah
sama('rp', C.rp(15000), 'Rp15.000');
sama('rp negatif', C.rp(-50000), '-Rp50.000');

console.log(lulus + ' lulus, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
