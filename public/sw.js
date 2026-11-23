const CACHE_NAME='study-journal-shell-v2';
const APP_ROOT=new URL('./',self.location.href);
const SHELL=[APP_ROOT.href,new URL('index.html',APP_ROOT).href,new URL('style.css',APP_ROOT).href,new URL('app.js',APP_ROOT).href,new URL('config.js',APP_ROOT).href,new URL('manifest.webmanifest',APP_ROOT).href,new URL('app-icon.jpg',APP_ROOT).href];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));return response}).catch(()=>caches.match(request).then(cached=>cached||caches.match(APP_ROOT.href))));return}
 if(SHELL.includes(request.url)){event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy))}return response})))}
});