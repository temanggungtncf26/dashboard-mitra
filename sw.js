// ============================================================
// SERVICE WORKER — MITRA-DASH PWA
// v1.0.0 | Cache First + Background Sync + Offline Queue
// ============================================================

const CACHE_NAME = 'mitra-dash-v1.1.0'; // bumped: offline queue fix
const SYNC_TAG   = 'sync-mitra-dash-queue';

// Aset statis yang di-cache saat install
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// ──────────────────────────────────────────────
// INSTALL — Cache semua aset statis
// ──────────────────────────────────────────────
self.addEventListener('install', function(event) {
  console.log('[SW] Install:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        // Cache satu per satu agar satu kegagalan tidak blokir semua
        return Promise.allSettled(
          STATIC_ASSETS.map(function(url) {
            return cache.add(url).catch(function(err) {
              console.warn('[SW] Gagal cache:', url, err.message);
            });
          })
        );
      })
      .then(function() {
        return self.skipWaiting();
      })
  );
});

// ──────────────────────────────────────────────
// ACTIVATE — Hapus cache lama
// ──────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  console.log('[SW] Activate:', CACHE_NAME);
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(
          keys.filter(function(key) { return key !== CACHE_NAME; })
              .map(function(key) {
                console.log('[SW] Hapus cache lama:', key);
                return caches.delete(key);
              })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});

// ──────────────────────────────────────────────
// FETCH — Cache First, Network Fallback
// GAS API requests → Network First (data fresh)
// ──────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Lewati request non-GET dan chrome-extension
  if (event.request.method !== 'GET') return;
  if (url.startsWith('chrome-extension://')) return;

  // GAS API calls → Network First (agar data selalu fresh)
  if (url.includes('script.google.com/macros')) {
    event.respondWith(networkFirstWithCache(event.request));
    return;
  }

  // Font & CDN → Cache First
  event.respondWith(cacheFirstWithNetwork(event.request));
});

// Cache First: coba cache dulu, fallback network
function cacheFirstWithNetwork(request) {
  return caches.match(request).then(function(cached) {
    if (cached) return cached;
    return fetch(request)
      .then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(function() {
        // Jika offline dan tidak ada cache, kembalikan offline page
        return caches.match('./index.html');
      });
  });
}

// Network First: coba network dulu, fallback cache
function networkFirstWithCache(request) {
  return fetch(request)
    .then(function(response) {
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(request, clone);
        });
      }
      return response;
    })
    .catch(function() {
      return caches.match(request);
    });
}

// ──────────────────────────────────────────────
// BACKGROUND SYNC — Kirim antrian offline ke GAS
// ──────────────────────────────────────────────
self.addEventListener('sync', function(event) {
  console.log('[SW] Background Sync fired:', event.tag);
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushOfflineQueue());
  }
});

async function flushOfflineQueue() {
  // Baca antrian dari IndexedDB
  const queue = await idbGetQueue();
  if (!queue || queue.length === 0) {
    console.log('[SW] Antrian kosong, tidak ada yang disync.');
    return;
  }

  const GAS_URL = 'https://script.google.com/macros/s/AKfycbyJ5vIZ6ZU-VPzevgpL763kpcBldo1L9N0jlksYPkl4j90hH80AHLnWN25v-_lRJi8l/exec';
  const failed  = [];

  for (const item of queue) {
    let success = false;
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: item.action, args: item.args }),
        redirect: 'follow'
      });

      // Jika response tidak ok (mis. 5xx) → masuk failed
      if (!response.ok) {
        console.warn('[SW] Sync HTTP error:', response.status, item.action);
        failed.push(item);
        continue;
      }

      let result = null;
      try {
        const text = await response.text();
        result = JSON.parse(text);
      } catch(parseErr) {
        // GAS kadang return HTML redirect atau bukan JSON (CORS opaque)
        // Jika status 200 tapi bukan JSON, anggap berhasil (optimistic)
        // agar tidak terus retry selamanya
        console.warn('[SW] Response non-JSON tapi status 200, anggap sukses:', item.action);
        success = true;
      }

      if (result !== null) {
        success = result.success === true;
        if (!success) {
          console.warn('[SW] Sync gagal (server):', item.action, result.message);
        }
      }

      if (success) {
        console.log('[SW] Sync sukses:', item.id, item.action);
        await notifyClients({ type: 'SYNC_SUCCESS', item: item });
      } else {
        failed.push(item);
      }

    } catch (err) {
      console.warn('[SW] Sync gagal (network):', item.action, err.message);
      failed.push(item);
    }
  }

  // Simpan kembali item yang gagal
  await idbSetQueue(failed);

  if (failed.length === 0) {
    await notifyClients({ type: 'SYNC_ALL_DONE' });
  }
}

// ──────────────────────────────────────────────
// INDEXEDDB HELPERS (tanpa library tambahan)
// ──────────────────────────────────────────────
function idbOpen() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('mitra-dash-db', 1);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('offline_queue')) {
        db.createObjectStore('offline_queue', { keyPath: 'id' });
      }
    };
    req.onsuccess  = function(e) { resolve(e.target.result); };
    req.onerror    = function(e) { reject(e.target.error); };
  });
}

async function idbGetQueue() {
  const db = await idbOpen();
  return new Promise(function(resolve, reject) {
    var tx    = db.transaction('offline_queue', 'readonly');
    var store = tx.objectStore('offline_queue');
    var req   = store.getAll();
    req.onsuccess = function() { resolve(req.result); };
    req.onerror   = function() { reject(req.error); };
  });
}

async function idbSetQueue(items) {
  const db = await idbOpen();
  return new Promise(function(resolve, reject) {
    var tx    = db.transaction('offline_queue', 'readwrite');
    var store = tx.objectStore('offline_queue');
    // Bersihkan dulu, lalu isi ulang
    var clearReq = store.clear();
    clearReq.onsuccess = function() {
      if (items.length === 0) { resolve(); return; }
      var done = 0;
      items.forEach(function(item) {
        var putReq = store.put(item);
        putReq.onsuccess = function() {
          done++;
          if (done === items.length) resolve();
        };
        putReq.onerror = function() { reject(putReq.error); };
      });
    };
    clearReq.onerror = function() { reject(clearReq.error); };
  });
}

// ──────────────────────────────────────────────
// NOTIFY CLIENTS
// ──────────────────────────────────────────────
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(function(client) {
    client.postMessage(message);
  });
}
