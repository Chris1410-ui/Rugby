/* Service worker DÉDIÉ aux notifications push (Web Push).
   Volontairement minimal : il ne met RIEN en cache (pas de gestion d'assets →
   aucun risque de « chargement infini » lié à un cache périmé). Il ne sert qu'à
   recevoir les push et à ouvrir la bonne route au clic.
   NB : le kill-switch d'index.html épargne ce fichier (voir son test sur l'URL). */

self.addEventListener("install", (event) => {
  // Actif immédiatement, sans attendre la fermeture des onglets.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || "Performance";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || undefined,          // regroupe/écrase les notifs de même tag
    data: { route: data.route || null, url: data.url || "/" },
    // renotify seulement si un tag est fourni (sinon l'API lève une erreur).
    renotify: Boolean(data.tag),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = event.notification.data && event.notification.data.route;
  const base = (event.notification.data && event.notification.data.url) || "/";
  const target = route ? `${base}?route=${encodeURIComponent(route)}` : base;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Onglet déjà ouvert → on le focus (et on lui passe la route).
      for (const c of wins) {
        if ("focus" in c) {
          if (route && "postMessage" in c) c.postMessage({ type: "push-navigate", route });
          return c.focus();
        }
      }
      // Sinon on ouvre une nouvelle fenêtre.
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })
  );
});
