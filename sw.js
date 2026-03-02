// ── Plural Space — Service Worker ──
// Stratégie : Cache First pour les assets statiques,
//             Network First pour les requêtes réseau (API PK, imgbb)

const VERSION   = 'plural-space-v10';
const CACHE_STATIC = `${VERSION}-static`;

// Assets à précacher — toute l'app shell
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './db.js',
  './utils.js',
  './tags.js',
  './prenoms.js',
  './proxys.js',
  './images.js',
  './profils.js',
  './config.js',
  './app.js',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

// ── INSTALL : précacher tous les assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()) // Activer immédiatement
  );
});

// ── ACTIVATE : supprimer les anciens caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_STATIC)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // Prendre le contrôle immédiatement
  );
});

// ── FETCH : stratégie selon la requête ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Requêtes externes (API PK, imgbb, Google Fonts) → Network Only
  if (url.hostname !== self.location.hostname && url.protocol !== 'chrome-extension:') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Offline fallback pour les fonts : retourner vide silencieusement
        return new Response('', { status: 503 });
      })
    );
    return;
  }

  // Assets statiques de l'app → Cache First, puis réseau si absent
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Pas en cache → fetch + mise en cache
      return fetch(event.request).then(response => {
        // Ne cacher que les réponses valides
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_STATIC).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Complètement offline et pas en cache : renvoyer index.html (SPA fallback)
        return caches.match('./index.html');
      });
    })
  );
});

// ── MESSAGE : forcer la mise à jour depuis l'app ──
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
