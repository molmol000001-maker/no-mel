const CACHE_NAME = 'alc-pwa-v1';
const ASSETS = [
  './alcohol-demo-mobile.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE_NAME ? caches.delete(k) : Promise.resolve()))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const req = event.request; if (req.method !== 'GET') return;
  event.respondWith((async () => {
    const cached = await caches.match(req); if (cached) return cached;
    try {
      const res = await fetch(req); const resClone = res.clone();
      const url = new URL(req.url);
      if (url.origin === location.origin || url.origin.includes('unpkg.com') || url.hostname === 'cdn.tailwindcss.com') {
        const cache = await caches.open(CACHE_NAME); cache.put(req, resClone);
      }
      return res;
    } catch (err) {
      return caches.match('./alcohol-demo-mobile.html');
    }
  })());
});