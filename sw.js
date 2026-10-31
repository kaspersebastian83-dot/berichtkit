/* BerichtKit – Service Worker (wie Projektzentrale): „Netz zuerst“ – online immer die neueste Fassung von GitHub Pages,
   offline oder bei langsamem Netz (> 4 s) die zuletzt gespeicherte. Nur die eigenen App-Dateien; Projektordner und
   Dateien laufen nie hierüber. Berührt nur Caches mit eigenem Präfix (andere Apps teilen sich den Cache-Speicher). */
const SCOPE = self.registration.scope;
const PREFIX = 'berichtkit:' + SCOPE + ':';
const CACHE = PREFIX + 'v15';
const ASSETS = ['./', './index.html', './app.js', './anlagen.js', './bericht-vorgaben.js', './bericht-gemeinsam.js', './bericht-asbest.js', './bericht-bewertung.js', './bericht-brand.js', './bericht-text.js', './bericht-docx.js', './bericht-luecken.js', './spektron-ordner.js', './mosaik-leiste.js',
  './vendor/docx.iife.js', './fonts.css', './assets/logo-schiffers.svg', './assets/logo-schiffers.png',
  './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'].map(f => new URL(f, SCOPE).href);
const INDEX = new URL('index.html', SCOPE).href;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(SCOPE)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const fromNet = fetch(req, { cache: 'no-store' }).then(res => {
      if (res.ok && res.type === 'basic') cache.put(req.mode === 'navigate' ? INDEX : req, res.clone());
      return res;
    });
    const timeout = new Promise(res => setTimeout(() => res(null), 4000));
    try { const res = await Promise.race([fromNet, timeout]); if (res) return res; } catch (err) { /* offline */ }
    const cached = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' && await cache.match(INDEX));
    return cached || fromNet;
  })());
});
