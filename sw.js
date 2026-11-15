/* Service worker: aplikasi bisa dibuka tanpa internet, dan diperbarui otomatis saat online. */
const VERSI = 'v3';
const CACHE = 'kalkulator-umkm-' + VERSI;
const FILE = ['./', 'index.html', 'style.css', 'calc.js', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.indexOf('kalkulator-umkm-') === 0).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Buka dari simpanan dulu (cepat, tanpa internet), sambil mengambil versi terbaru untuk pembukaan berikutnya.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(e.request, { ignoreSearch: true }).then((hit) => {
        const baru = fetch(e.request).then((r) => { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
        return hit || baru;
      })
    )
  );
});
