/*
 * Aplikasi pelanggan (PWA) — service worker, scope /pesan (owner 2026-10-11).
 * Tujuan: aplikasi yang dipasang di layar utama tetap terbuka saat sinyal
 * hilang (beranda dari cache) dan aset statis cepat dimuat. Pesanan, menu,
 * harga & pembayaran SELALU dari jaringan — tidak pernah di-cache.
 *  - /_next/static/**, /app-icons, /products, /logos → cache-first
 *  - navigasi /pesan/**                             → network-first, fallback cache
 *  - selain itu (API, POST)                          → tidak disentuh
 */
const VERSION = 'bcd-app-v1';
const CACHE_STATIC = `${VERSION}-static`;
const CACHE_PAGES = `${VERSION}-pages`;
const STATIC_PATH = /^\/(_next\/static|app-icons|products|logos)\//;
const APP_PAGE = /^\/pesan(\/|$)/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_PAGES).then((cache) => cache.add('/pesan').catch(() => undefined)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith('bcd-app-') && !key.startsWith(VERSION)).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function cacheable(response) {
  return response && response.ok && response.type === 'basic' && !response.redirected;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (STATIC_PATH.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (cacheable(response)) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  if (request.mode === 'navigate' && APP_PAGE.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_PAGES);
        try {
          const response = await fetch(request);
          if (cacheable(response)) cache.put(url.pathname, response.clone());
          return response;
        } catch {
          return (await cache.match(url.pathname)) || (await cache.match('/pesan')) || Response.error();
        }
      })()
    );
  }
});
