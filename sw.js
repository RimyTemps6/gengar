// Service worker: deixa o app abrir offline. Dados ficam no cache do Firestore.
// Ao atualizar os arquivos do site, aumente o número da versão abaixo.
const CACHE = 'ftc-organizador-v1';
const SHELL = ['./', './index.html', './style.css', './app.js', './firebase-config.js',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mine = url.origin === self.location.origin;
  const sdk = url.hostname === 'www.gstatic.com';
  if (!mine && !sdk) return; // Firestore (googleapis) passa direto

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req);
      const net = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
