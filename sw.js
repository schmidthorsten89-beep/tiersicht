'use strict';

// Bei jeder Änderung an den App-Dateien erhöhen, damit die Handys die neue Version laden.
const CACHE = 'tiersicht-v1';
const DATEIEN = [
  './',
  'index.html',
  'styles.css',
  'tiere.js',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' umgeht den Browser-Cache (GitHub Pages erlaubt 10 Minuten), sonst landet die alte Version im neuen Cache.
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(DATEIEN.map((datei) => new Request(datei, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Erst Netz, damit Änderungen sofort ankommen; ohne Verbindung aus dem Cache.
  // no-cache: beim Server nachfragen statt bis zu 10 Minuten die alte Datei aus dem Browser-Cache zu nehmen.
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((antwort) => {
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(CACHE).then((c) => c.put(e.request, kopie));
        }
        return antwort;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then((treffer) => treffer || caches.match('./')))
  );
});
