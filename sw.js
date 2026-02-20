// CTAN Bus Tracker — Service Worker (offline shell cache)
const CACHE = 'ctan-shell-v7';
const SHELL = [
  './home.html',
  './index.html',
  './station.html',
  './route.html',
  './planner.html',
  './map.html',
  './timetable.html',
  './settings.html',
  './linetimetable.html',
  './src/style.css',
  './src/js/i18n.js',
  './src/js/home.js',
  './src/js/app.js',
  './src/js/station.js',
  './src/js/route.js',
  './src/js/planner.js',
  './src/js/map.js',
  './src/js/timetable.js',
  './src/js/settings.js',
  './src/js/linetimetable.js',
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
  const url = e.request.url;

  // Always go to network for API calls
  if (url.includes('api.ctan.es')) return;

  // Network-first for HTML pages: ensures the latest page shell is always
  // fetched when online, so updates are visible immediately after SW activates.
  // Falls back to cache when offline.
  if (e.request.destination === 'document' || url.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Update the cache with the fresh response
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for JS/CSS assets (versioned via query strings)
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// Allow pages to trigger immediate activation of a waiting SW
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
