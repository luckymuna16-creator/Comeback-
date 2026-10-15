// Bump this version string whenever you change any app file, so phones pick up the update.
const V = 'comeback-v1';
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'assets/seed-panther.jpg', 'assets/seed-comeback.jpg', 'assets/seed-collage.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(V).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('index.html')))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => list.length ? list[0].focus() : clients.openWindow('./'))
  );
});
