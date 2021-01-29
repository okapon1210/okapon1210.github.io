const CACHE_NAME = 'pwa-camera-test-caches';
let urlToCache = ['./index.html', './js/camera.js'];

self.addEventListener('install', function (event){
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then(function (cache){
                return cache.addAll(urlToCache);
            })
    );
});

self.addEventListener('fetch', function (event){
    event.respondWith(
        caches
            .match(event.request)
            .then(function (response){
                return response ? response : fetch(event.request);
            })
    );
});