self.addEventListener('install', (e)=>{
  self.skipWaiting();
  e.waitUntil(caches.open('alc-pwa-v1').then(c=>c.addAll([
    './',
    './alcohol-demo-mobile.html',
    './manifest.webmanifest'
  ])));
});
self.addEventListener('activate', (e)=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
