const CACHE='rentinorbit-v192-shell';
const CORE=[
  '/',
  '/index.html',
  '/styles.css?v=192',
  '/light-premium-v161.css?v=192',
  '/modules/brand-migration-v186.js?v=192',
  '/modules/i18n-v161.js?v=192',
  '/app.js?v=192',
  '/modules/renter-response-deadline-v189.js?v=192',
  '/modules/renter-booking-status-v190.js?v=192',
  '/modules/renter-alternatives-v191.js?v=192',
  '/manifest.webmanifest?v=192',
  '/assets/brand/rentinorbit-logo-horizontal-dark-web.png?v=192',
  '/assets/brand/rentinorbit-logo-horizontal.svg',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;

  // Never cache API/authenticated data. Offline shell is static assets only.
  if(url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')){
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith(
    fetch(req)
      .then(res=>{
        if(res.ok && res.type==='basic'){
          const copy=res.clone();
          caches.open(CACHE).then(cache=>cache.put(req,copy));
        }
        return res;
      })
      .catch(async()=>{
        const hit=await caches.match(req);
        if(hit) return hit;
        if(req.mode==='navigate') return caches.match('/index.html') || caches.match('/');
        return Response.error();
      })
  );
});
