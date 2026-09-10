const CACHE = "eyeclinic-v2";
const ASSETS = ["/", "/static/manifest.json", "/static/img/logo.jpg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(()=>{}));
});

self.addEventListener("fetch", (e) => {
  if (e.request.url.includes("/api/")) return; // never cache API
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      const clone = resp.clone();
      caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(()=>{});
      return resp;
    }).catch(()=> r))
  );
});
