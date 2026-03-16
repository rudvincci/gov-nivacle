/**
 * Ierahkwa Platform — Service Worker v5.5.0
 * Cache-first strategy con network fallback
 * Soporta offline para 880+ plataformas + 28 NEXUS portales
 * + Offline AI model caching (ONNX Runtime Web + WASM)
 * + Enhanced offline for 14 priority platforms (IndexedDB sync)
 * + Futurehead Design System (Orbitron/Exo 2 fonts, neon-green theme)
 * + 7 AI Agents (Guardian, Pattern, Anomaly, Trust, Shield, Forensic, Evolution)
 */

const CACHE_NAME = 'ierahkwa-v5.5.0';
const STATIC_CACHE = 'ierahkwa-static-v5.5.0';
const API_CACHE = 'ierahkwa-api-v5.5.0';
const AI_CACHE = 'ierahkwa-ai-v1.0.0';
const OFFLINE_DATA_CACHE = 'ierahkwa-offline-data-v1.0.0';

const STATIC_ASSETS = [
  '/',
  '/shared/ierahkwa.css',
  '/shared/ierahkwa.js',
  '/shared/ierahkwa-api.js',
  '/shared/ierahkwa-ai.js',
  '/shared/ierahkwa-security.js',
  '/shared/ierahkwa-quantum.js',
  '/shared/ierahkwa-protocols.js',
  '/shared/ierahkwa-interconnect.js',
  '/shared/ierahkwa-agents.js',
  '/shared/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

const NEXUS_ROUTES = [
  '/nexus-orbital/', '/nexus-escudo/', '/nexus-cerebro/',
  '/nexus-tesoro/',  '/nexus-voces/',  '/nexus-consejo/',
  '/nexus-tierra/',  '/nexus-forja/',  '/nexus-urbe/',
  '/nexus-raices/',  '/nexus-salud/',  '/nexus-academia/',
  '/nexus-escolar/', '/nexus-entretenimiento/', '/nexus-amparo/',
  '/nexus-escritorio/', '/nexus-comercio/', '/nexus-cosmos/',
  '/nexus-turistico/', '/nexus-justicia/', '/nexus-fortaleza/',
  '/nexus-naciones/', '/nexus-diplomatico/', '/nexus-cadena/',
  '/nexus-energia/', '/nexus-creativo/', '/nexus-trabajo/',
  '/nexus-bienestar/'
];

// 14 Priority Offline Platforms — Enhanced caching with IndexedDB sync
const OFFLINE_PRIORITY_PLATFORMS = [
  // Tier 1: Critical for remote communities
  '/archivo-linguistico-soberano/',  // Language preservation
  '/healthcare-dashboard/',          // Medical protocols & medications
  '/agricultura-soberana/',           // Crop calendars & market prices
  '/emergencias-soberano/',           // Risk maps & evacuation routes
  '/education-dashboard/',            // Courses & curriculum offline
  // Tier 2: High value
  '/bdet-bank/',                      // Offline transactions with crypto signing
  '/docs-soberanos/',                 // Offline document editing
  '/mapa-soberano/',                  // GeoJSON territory maps
  '/comercio-soberano/',              // Product catalog & inventory
  '/mensajeria-soberana/',            // Message queue with E2E
  // Tier 3: Moderate value
  '/sabiduria-soberana/',             // Indigenous knowledge encyclopedia
  '/biblioteca-soberana/',            // eBook downloads
  '/noticia-soberana/',               // Cached news articles
  '/correo-soberano/'                 // Inbox cache & draft queue
];

// Install — Pre-cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — Clean old caches
self.addEventListener('activate', event => {
  const currentCaches = [CACHE_NAME, STATIC_CACHE, API_CACHE, AI_CACHE, OFFLINE_DATA_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => keys.filter(k => !currentCaches.includes(k)))
      .then(old => Promise.all(old.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch — Strategy router
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // AI models & WASM — Cache first (immutable by version)
  if (isAIAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, AI_CACHE));
    return;
  }

  // Priority platform API data — Network first with aggressive caching
  if (url.pathname.startsWith('/api/') && isOfflinePriorityAPI(url.pathname)) {
    event.respondWith(networkFirstWithTimeout(request, OFFLINE_DATA_CACHE, 5000));
    return;
  }

  // API requests — Network first, cache fallback (5s timeout)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithTimeout(request, API_CACHE, 5000));
    return;
  }

  // Static assets — Cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages — Stale-while-revalidate
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    return;
  }

  // Default — Cache first with network fallback
  event.respondWith(cacheFirst(request, CACHE_NAME));
});

// --- Strategies ---

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback();
  }
}

async function networkFirstWithTimeout(request, cacheName, timeout) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({
      error: 'offline',
      message: 'Sin conexión — datos en caché no disponibles',
      timestamp: new Date().toISOString()
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached || offlineFallback());

  return cached || fetchPromise;
}

// --- Helpers ---

function isStaticAsset(pathname) {
  return /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/i.test(pathname);
}

function isAIAsset(pathname) {
  return /\.(onnx|wasm)$/i.test(pathname) || pathname.startsWith('/ai/models/');
}

function isOfflinePriorityAPI(pathname) {
  const priorityAPIs = [
    '/api/culture/languages/', '/api/culture/agriculture/',
    '/api/nexus/health/', '/api/emergency/',
    '/api/nexus/education/', '/api/nexus/payments/',
    '/api/culture/docs/', '/api/culture/maps/',
    '/api/culture/commerce/', '/api/culture/messages/',
    '/api/culture/knowledge/', '/api/culture/library/',
    '/api/culture/news/', '/api/culture/email/'
  ];
  return priorityAPIs.some(api => pathname.startsWith(api));
}

function offlineFallback() {
  return new Response(`<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ierahkwa — Sin Conexión</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#09090d;color:#e8e4df;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}
.offline{text-align:center;max-width:480px}
.offline h1{font-size:2rem;color:#00FF41;margin-bottom:1rem}
.offline p{color:#8a8694;line-height:1.6;margin-bottom:1.5rem}
.offline button{background:#00FF41;color:#09090d;border:none;padding:.75rem 2rem;border-radius:10px;font-size:1rem;cursor:pointer;font-weight:600}
.offline button:hover{background:#c49a48}
</style>
</head><body>
<div class="offline">
<h1>⚡ Sin Conexión</h1>
<p>La plataforma Ierahkwa está funcionando en modo offline. Algunas funciones pueden no estar disponibles hasta que se restablezca la conexión.</p>
<button onclick="location.reload()">Reintentar Conexión</button>
</div>
</body></html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

// --- Background Sync for API calls + Offline Platform Sync ---
self.addEventListener('sync', event => {
  if (event.tag === 'ierahkwa-sync') {
    event.waitUntil(syncPendingRequests());
  }
  // Platform-specific sync tags
  if (event.tag === 'ierahkwa-salud-sync') {
    event.waitUntil(notifyClientsToSync('healthcare-dashboard'));
  }
  if (event.tag === 'ierahkwa-emergencias-sync') {
    event.waitUntil(notifyClientsToSync('emergencias-soberano'));
  }
  if (event.tag === 'ierahkwa-bdet-sync') {
    event.waitUntil(notifyClientsToSync('bdet-bank'));
  }
  if (event.tag === 'ierahkwa-docs-sync') {
    event.waitUntil(notifyClientsToSync('docs-soberanos'));
  }
  if (event.tag === 'ierahkwa-mensajeria-sync') {
    event.waitUntil(notifyClientsToSync('mensajeria-soberana'));
  }
  if (event.tag === 'ierahkwa-correo-sync') {
    event.waitUntil(notifyClientsToSync('correo-soberano'));
  }
  if (event.tag === 'ierahkwa-educacion-sync') {
    event.waitUntil(notifyClientsToSync('education-dashboard'));
  }
  if (event.tag === 'ierahkwa-comercio-sync') {
    event.waitUntil(notifyClientsToSync('comercio-soberano'));
  }
});

async function notifyClientsToSync(platform) {
  const allClients = await self.clients.matchAll();
  allClients.forEach(client => {
    client.postMessage({ type: 'PLATFORM_SYNC', platform });
  });
}

async function syncPendingRequests() {
  // Placeholder for queued offline API calls
  const db = await openSyncDB();
  const pending = await db.getAll('pending-requests');

  for (const req of pending) {
    try {
      await fetch(req.url, req.options);
      await db.delete('pending-requests', req.id);
    } catch {
      break; // Still offline, stop trying
    }
  }
}

function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ierahkwa-sync', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('pending-requests', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => {
      const db = req.result;
      resolve({
        getAll: store => new Promise(r => {
          const tx = db.transaction(store, 'readonly');
          const s = tx.objectStore(store);
          s.getAll().onsuccess = e => r(e.target.result);
        }),
        delete: (store, id) => new Promise(r => {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).delete(id).onsuccess = () => r();
        }),
        add: (store, data) => new Promise(r => {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).add(data).onsuccess = () => r();
        })
      });
    };
    req.onerror = () => reject(req.error);
  });
}

// --- Push Notifications ---
self.addEventListener('push', event => {
  const data = event.data?.json() || {
    title: 'Ierahkwa',
    body: 'Nueva notificación de la plataforma',
    icon: '/icons/icon-192.png'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.svg',
      badge: '/icons/icon-72.svg',
      tag: data.tag || 'ierahkwa-notification',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// --- Message Handler: AI Model Prefetch + Platform Offline Data ---
self.addEventListener('message', event => {
  // AI Model Prefetch (from ierahkwa-ai.js)
  if (event.data?.type === 'PREFETCH_AI_MODEL' && event.data.url) {
    event.waitUntil(
      caches.open(AI_CACHE).then(cache =>
        cache.match(event.data.url).then(cached => {
          if (!cached) {
            return fetch(event.data.url)
              .then(response => {
                if (response.ok) cache.put(event.data.url, response);
              })
              .catch(() => {}); // Silently fail if offline
          }
        })
      )
    );
  }

  // Platform Offline Data Prefetch (from platform offline modules)
  if (event.data?.type === 'PREFETCH_PLATFORM_DATA' && event.data.urls) {
    event.waitUntil(
      caches.open(OFFLINE_DATA_CACHE).then(async cache => {
        for (const url of event.data.urls) {
          try {
            const cached = await cache.match(url);
            if (!cached) {
              const response = await fetch(url);
              if (response.ok) await cache.put(url, response);
            }
          } catch { /* Silently skip if offline */ }
        }
      })
    );
  }

  // Register Background Sync (from platform offline modules)
  if (event.data?.type === 'REGISTER_SYNC' && event.data.tag) {
    event.waitUntil(
      self.registration.sync.register(event.data.tag).catch(() => {})
    );
  }
});
