import {runtimeKey, runtimeFiles} from './python-runtime/cache-config.js';

const cachePrefix = `lab-code-python:${self.registration.scope}:`;
const cacheName = cachePrefix + runtimeKey;
const files = new Set(runtimeFiles.map(file => new URL(`./python-runtime/${file}`, self.location.href).href));

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(names.filter(name => name.startsWith(cachePrefix) && name !== cacheName)
        .map(name => caches.delete(name)));
    } catch {
      // The runtime can still load through the browser's network cache.
    }
    await self.clients.claim();
  })());
});

async function loadRuntimeFile(request) {
  let cache;
  try {
    cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return {response: cached};
  } catch {
    // Storage may be unavailable in some browser sessions.
  }
  const response = await fetch(request);
  const stored = cache && response.status === 200 && !response.redirected
    ? cache.put(request, response.clone()).catch(() => {})
    : undefined;
  return {response, stored};
}

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET' || request.headers.has('Range') || !files.has(request.url)) return;
  const result = loadRuntimeFile(request);
  event.respondWith(result.then(({response}) => response));
  event.waitUntil(result.then(({stored}) => stored).catch(() => {}));
});
