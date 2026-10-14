const CACHE='boothbook-offline-__ASSET_HASH__';
self.addEventListener('install',event=>{event.waitUntil((async()=>{const response=await fetch('/offline/asset-list.json',{cache:'no-store'});if(!response.ok)throw Error('Offline assets unavailable.');const assets=await response.json();const cache=await caches.open(CACHE);await cache.addAll(assets);await self.skipWaiting()})())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('boothbook-offline-')&&name!==CACHE)await caches.delete(name);await self.clients.claim()})())});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=='GET'||url.pathname.startsWith('/api/')||/signin|signout|callback/.test(url.pathname))return;
 if(url.pathname.startsWith('/offline/')){event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(event.request)||fetch(event.request)})());return}
 if(event.request.mode==='navigate'&&url.pathname==='/'){event.respondWith((async()=>{try{return await fetch(event.request)}catch{const cache=await caches.open(CACHE);return await cache.match('/offline/index.html')||Response.error()}})())}
});
