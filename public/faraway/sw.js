// Far Away artık ana ProShare uygulamasının parçası: eski ayrı servis çalışanı kendini ve önbelleğini kaldırır.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ps-far')).map(k => caches.delete(k))))
        .then(() => self.registration.unregister()));
});
