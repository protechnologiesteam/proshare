// ProShare servis çalışanı: uygulama kurulabilsin ve sayfalar (Next To, Far Away) internetsiz de açılsın.
// Dosya ve mesajlar buradan geçmez; yalnızca sayfalar, simgeler ve QR okuyucu önbelleğe alınır.
const CACHE = 'ps-v3';
const SHELL = ['./', 'faraway/', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'jsqr.js'];
self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
    const r = e.request, u = new URL(r.url);
    if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('/ws')) return;
    if (/\.(png|webmanifest)$/.test(u.pathname) || u.pathname.endsWith('/jsqr.js')) {
        e.respondWith(caches.match(r).then(m => m || fetch(r)));
        return;
    }
    // Sayfa: önce ağ (her zaman güncel sürüm), ağ yoksa önbellek. Sayfalar adreslerine göre (sorgu olmadan) saklanır.
    const key = u.origin + u.pathname;
    e.respondWith(fetch(r).then(res => {
        if (res.ok && r.mode === 'navigate') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(key, cp)); }
        return res;
    }).catch(() => caches.match(r.mode === 'navigate' ? key : r).then(m => m || (r.mode === 'navigate' ? caches.match('./') : undefined))));
});
