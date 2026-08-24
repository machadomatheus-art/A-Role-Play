// Identificador único para evitar conflitos com outros PWAs no mesmo domínio do GitHub Pages
const CACHE_NAME = 'aroleplay-pwa-v1.0.0';

// Arquivos essenciais pré-cacheados (usando ./ para funcionar em subpastas)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/router.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

// Instalação: Pré-carrega recursos vitais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Ativação: Limpa APENAS os caches antigos deste app específico
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache.startsWith('aroleplay-') && cache !== CACHE_NAME) {
            console.log('[Service Worker] Deletando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptador de Requisições
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Não intercepta chamadas para apis externas (Firebase Auth, Firestore) nem métodos que não sejam GET
  if (req.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }

  // 1. Roteamento de Navegação SPA (ex: /home, /game/123)
  // Retorna a index.html pré-cacheada do repositório
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => {
        return cached || fetch(req).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // 2. Arquivos Estáticos e Views Dinâmicas (Stale-While-Revalidate)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
