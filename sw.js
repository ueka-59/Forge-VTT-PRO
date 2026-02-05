self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Optionnel : tu pourrais ajouter du cache ici plus tard
});