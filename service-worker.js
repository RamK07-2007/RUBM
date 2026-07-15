/**
 * RUBM v3.0 — Service Worker
 * service-worker.js
 *
 * Estrategia: Cache-First para assets estáticos.
 * Los datos empresariales (cajitas, reportes) NO se cachean —
 * siempre se obtienen de Supabase en tiempo real.
 *
 * IMPORTANTE: El SW no intercepta requests a Supabase (*.supabase.co)
 * ni a esm.sh (CDN de Supabase JS SDK). Solo cachea los archivos
 * estáticos del proyecto.
 */

const CACHE_NAME    = 'rubm-cache-v4';
const CACHE_TIMEOUT = 5000; // ms antes de caer al network en fetch

/** Archivos estáticos que se cachean en install */
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './db.js',
  './realtime.js',
  './bg.js',
  './manifest.json',
  './img/Box.png',
  './img/favicon.png',
];

/** Hosts externos que NUNCA se cachean (datos en tiempo real) */
const BYPASS_HOSTS = [
  'supabase.co',
  'esm.sh',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

/* ── Install: pre-cachear assets estáticos ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ── Activate: eliminar caches viejos ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch: Cache-First para assets propios, Network-Only para el resto ── */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-Only para hosts externos (Supabase, CDN, fuentes)
  if (BYPASS_HOSTS.some((host) => url.hostname.includes(host))) {
    return; // dejar que el browser maneje la request normalmente
  }

  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  // Cache-First para assets propios
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      // No en caché → red
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        // Guardar en caché para próxima vez
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});