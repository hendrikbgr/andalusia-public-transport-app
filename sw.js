// CTAN Bus Tracker — Service Worker (offline shell cache)
const CACHE = 'ctan-shell-v2';
const SHELL = [
  './home.html',
  './index.html',
  './station.html',
  './route.html',
  './planner.html',
  './map.html',
  './timetable.html',
  './src/style.css',
  './src/js/i18n.js',
  './src/js/home.js',
  './src/js/app.js',
  './src/js/station.js',
  './src/js/route.js',
  './src/js/planner.js',
  './src/js/map.js',
  './src/js/timetable.js',
];

self.addEventListener('install', e =>
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL))
  )
);

self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
);

self.addEventListener('fetch', e => {
  // Always go to network for API calls
  if (e.request.url.includes('api.ctan.es')) return;
  // Cache-first for shell assets
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
