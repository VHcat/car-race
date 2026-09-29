'use strict';
// An installed version is atomic: assets stay together until all old tabs close.
const CACHE='come-on-racing-v3-1';
const ASSETS=['./','index.html','css/style.css','js/data.js','js/save.js','js/audio.js',
  'js/car.js','js/runtime.js','js/menu-scene.js','js/ui.js','js/renderer.js',
  'js/director.js','js/abilities.js','js/traffic.js','js/game.js','js/main.js','js/pwa.js',
  'manifest.webmanifest','assets/icon.svg','assets/icon-192.png','assets/icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('come-on-racing-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET' || new URL(event.request.url).origin!==self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(event.request,{ignoreSearch:true});
    if(cached) return cached;
    try{return await fetch(event.request);}
    catch(error){
      if(event.request.mode==='navigate') return cache.match('index.html');
      throw error;
    }
  }));
});
