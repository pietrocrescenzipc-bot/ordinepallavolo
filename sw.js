// Sport & Galleon - Service Worker
// IMPORTANTE: quando pubblichi una nuova versione di index.html non serve cambiare nulla,
// la pagina viene sempre scaricata fresca da internet (e salvata per l'uso offline).
const CACHE_NAME = 'sport-galleon-v4';

const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon.png'
];

const CDN_FILES = [
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js'
];

// Installazione: salva i file principali (se uno fallisce non blocca l'installazione)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            Promise.all(
                [...APP_SHELL, ...CDN_FILES].map((url) =>
                    cache.add(url).catch((err) => console.warn('Non salvato in cache:', url, err))
                )
            )
        )
    );
    self.skipWaiting();
});

// Attivazione: elimina le cache delle versioni precedenti
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Database Firebase: mai in cache, sempre in tempo reale
    if (url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('firebasedatabase.app')) return;

    const isPage = req.mode === 'navigate' ||
        (url.origin === self.location.origin &&
            (url.pathname.endsWith('/') || url.pathname.endsWith('.html') || url.pathname.endsWith('manifest.json')));

    // Pagina dell'app: prima internet (così tutti vedono subito l'ultima versione),
    // se manca la connessione usa la copia salvata
    if (isPage) {
        // cache: 'no-cache' = chiede sempre al server se c'è una versione nuova
        // (GitHub Pages altrimenti fa usare al browser la copia vecchia per 10 minuti)
        event.respondWith(
            fetch(req, { cache: 'no-cache' })
                .then((res) => {
                    if (res && res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
                    }
                    return res;
                })
                .catch(() =>
                    caches.match(req, { ignoreSearch: true })
                        .then((r) => r || caches.match('./index.html'))
                )
        );
        return;
    }

    // Librerie, font e icone: prima la cache (caricamento veloce), poi internet
    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                if (res && (res.ok || res.type === 'opaque')) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(req, copy));
                }
                return res;
            });
        })
    );
});
