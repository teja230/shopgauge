// ShopGauge Service Worker
// Provides PWA functionality, caching strategies, and offline support

const CACHE_NAME = 'shopgauge-v1';
const STATIC_CACHE_NAME = 'shopgauge-static-v1';
const DYNAMIC_CACHE_NAME = 'shopgauge-dynamic-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
  // Add other critical static assets
];

// API endpoints that should be cached
const CACHEABLE_API_ROUTES = [
  '/api/health',
  '/api/shop/current',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests with appropriate strategies
  if (request.url.includes('/api/')) {
    // API requests - Network first, cache fallback
    event.respondWith(networkFirstStrategy(request));
  } else if (request.destination === 'document') {
    // HTML documents - Network first for SPA routing
    event.respondWith(networkFirstForDocuments(request));
  } else if (request.destination === 'image' || request.destination === 'font') {
    // Static assets - Cache first
    event.respondWith(cacheFirstStrategy(request));
  } else {
    // Other requests - Stale while revalidate
    event.respondWith(staleWhileRevalidateStrategy(request));
  }
});

// Network first strategy for API calls
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Handle authentication errors specifically
    if (networkResponse.status === 401) {
      console.log('Service Worker: Authentication error detected for', request.url);
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required',
          authenticationError: true,
          message: 'Please log in to access this resource.',
          redirectToLogin: true
        }),
        {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      );
    }
    
    // Cache successful API responses
    if (networkResponse.ok && CACHEABLE_API_ROUTES.some(route => request.url.includes(route))) {
      // Clone the response immediately to avoid the body being locked later
      const responseClone = networkResponse.clone();
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      await cache.put(request, responseClone);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache', error);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return a custom offline response for API calls
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'You are currently offline. Please check your connection.' 
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Network first strategy for HTML documents (SPA routing)
async function networkFirstForDocuments(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      return networkResponse;
    }
    // Non-OK document fetch, serve index.html fallback for SPA routing
    let fallbackResponse = await caches.match('/index.html');
    if (!fallbackResponse) {
      try {
        fallbackResponse = await fetch('/index.html');
      } catch (err) {
        console.warn('Service Worker: Failed to fetch index.html as fallback', err);
      }
    }
    return fallbackResponse || networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed for document, serving cached index.html');
    
    // For SPA routing, always serve index.html when offline
    const cachedResponse = await caches.match('/index.html');
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback offline page
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head><title>Offline - ShopGauge</title></head>
      <body>
        <h1>You're Offline</h1>
        <p>Please check your internet connection and try again.</p>
      </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Cache first strategy for static assets
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    // Clone immediately so body is still readable when we later put it in the cache
    const responseClone = networkResponse.clone();
    const cache = await caches.open(STATIC_CACHE_NAME);
    await cache.put(request, responseClone);
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Failed to fetch static asset', error);
    throw error;
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidateStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  const networkResponsePromise = fetch(request)
    .then((networkResponse) => {
      const responseClone = networkResponse.clone();
      const cache = caches.open(DYNAMIC_CACHE_NAME);
      cache.then((c) => c.put(request, responseClone));
      return networkResponse;
    })
    .catch(() => cachedResponse);
  
  return cachedResponse || networkResponsePromise;
}

// Background sync for offline actions (if needed in the future)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  // Implement background sync logic here if needed
  // For example, sync offline analytics data when connection is restored
  console.log('Service Worker: Handling background sync');
}

// Handle push notifications (if needed in the future)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    console.log('Service Worker: Push notification received', data);
    
    const options = {
      body: data.body,
      icon: '/vite.svg',
      badge: '/vite.svg',
      data: data.data || {},
      actions: data.actions || []
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'ShopGauge', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
}); 