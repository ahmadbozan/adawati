// Service worker: يخلّي الموقع قابل للتثبيت ويشتغل بدون إنترنت (الأدوات تعمل محلياً).
// استراتيجية: الشبكة أولاً (حتى تصلك التحديثات فوراً)، والكاش عند انقطاع الإنترنت.
// طلبات Supabase والإعلانات لا تُخزَّن أبداً.
const V = "adawati-v2";
const CORE = ["./", "index.html", "css/style.css", "js/app.js", "js/config.js", "manifest.json", "icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  const same = u.origin === self.location.origin;
  const cdn = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"].includes(u.hostname);
  if (!same && !cdn) return;
  e.respondWith(
    fetch(r).then((res) => {
      if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); }
      return res;
    }).catch(() => caches.match(r).then((m) => m || caches.match("index.html")))
  );
});
