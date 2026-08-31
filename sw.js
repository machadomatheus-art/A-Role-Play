/* A Role Play — Service Worker
 * PWA cache + offline support + Firebase Cloud Messaging.
 */

importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyBUg7l99dLX04OrqM_Jlb6-58y1A9BB3N8",
  authDomain: "rpg-ee17e.firebaseapp.com",
  projectId: "rpg-ee17e",
  storageBucket: "rpg-ee17e.firebasestorage.app",
  messagingSenderId: "136442258825",
  appId: "1:136442258825:web:b7dadfb6c2d6d3ed5a2d58"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

const CACHE_VERSION = "a-role-play-v3";
const APP_SHELL = ["/", "/index.html"];
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Firebase background messages.
// Data-only messages are shown here manually so we control the A Role Play icon.
messaging.onBackgroundMessage((payload) => {
  console.log("[A Role Play] 🔔 FCM RECEBIDO PELO SERVICE WORKER:", payload);

  const notification = payload?.notification || {};
  const data = payload?.data || {};

  // Notification payloads are already displayed by FCM in the background.
  // Only manually display data-only messages to avoid duplicates.
  if (notification.title || notification.body) return;

  const title = data.title || "A Role Play";
  const body = data.body || data.message || "Você recebeu uma nova mensagem.";

  self.registration.showNotification(title, {
    body,
    icon: "/assets/icons/icon-192.png",
    badge: "/assets/icons/icon-192.png",
    tag: data.tableId ? `a-role-play-table-${data.tableId}` : "a-role-play-message",
    renotify: true,
    data: {
      link: data.link || "/",
      tableId: data.tableId || ""
    }
  }).catch(error => {
    console.error("[A Role Play] ❌ Falha ao exibir notificação:", error);
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = event.notification.data?.link || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            if ("navigate" in client && target) {
              return client.navigate(target).then(() => client.focus());
            }
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(target);
        }
      })
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (
    url.origin !== self.location.origin ||
    url.protocol === "chrome-extension:" ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firebasestorage.googleapis.com") ||
    url.hostname.includes("gstatic.com")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached =
            (await caches.match(request)) ||
            (await caches.match("/index.html")) ||
            (await caches.match(OFFLINE_URL));

          return cached || new Response(
            "<!doctype html><html lang='pt-BR'><meta charset='utf-8'><title>A Role Play</title><body style='background:#24140f;color:#f1dfc1;font-family:system-ui;text-align:center;padding:40px'><h1>A Role Play</h1><p>Você está offline.</p></body></html>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        })
    );
    return;
  }

  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (!response || !response.ok) return response;

          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
  }
});
