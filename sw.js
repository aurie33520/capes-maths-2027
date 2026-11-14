const CACHE_NAME = 'capes-maths-v1';

// Liste des fichiers essentiels de l'application à mettre en cache
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/layout.css',
  './css/components.css',
  './data/programme.json',
  './data/exercices.json',
  './js/app.js',
  './js/store.js',
  './js/views/dashboard.js',
  './js/views/syllabus.js',
  './js/views/exercises.js',
  './js/views/settings.js'
];

// Installation : mise en cache initiale
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches si on change de version
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Interception des requêtes : Réseau d'abord, puis Cache en secours (hors-ligne)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Met à jour le cache avec la version fraîche
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});