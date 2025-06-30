const CACHE_NAME = "nutribalance-cache-v2";
const ASSETS = [
  "/",
  "/static/css/style.css",
  "/static/js/app.js",
  "/static/assets/chicken.png",
  "/static/assets/banana.png",
  "/manifest.json"
];

self.addEventListener("install", event =>
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  )
);

self.addEventListener("activate", event =>
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => key !== CACHE_NAME && caches.delete(key))
      )
    )
  )
);

self.addEventListener("fetch", event =>
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  )
);