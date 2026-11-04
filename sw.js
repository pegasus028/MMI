/* Retired service worker (4 Nov 2026).
 * The MMI Triad page is a single file and does not need an offline cache.
 * The old worker served the saved copy first, so phones kept showing an old
 * version after each update. This version clears every cache, removes itself
 * and reloads any open tab from the network. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
    await self.registration.unregister();
    const tabs = await self.clients.matchAll({ type: "window" });
    tabs.forEach((tab) => tab.navigate(tab.url));
  })());
});
