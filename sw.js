/* Service Worker: macht den Pfand-Rechner offline nutzbar */
var CACHE = 'pfand-rechner-v1';
var FILES = [
  './', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'img/bier.svg', 'img/buegel.svg', 'img/glas.svg', 'img/pet.svg', 'img/einweg.svg', 'img/dose.svg',
  'img/milch.svg', 'img/fass.svg', 'img/kasten-leer.svg', 'img/kasten-bier.svg', 'img/kasten-bier33.svg',
  'img/kasten-buegel.svg', 'img/kasten-glas.svg', 'img/kasten-pet.svg', 'img/kasten-saft.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Netzwerk zuerst (damit Updates ankommen), bei Offline aus dem Cache
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
    })
  );
});
