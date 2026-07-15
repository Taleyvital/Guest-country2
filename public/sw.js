/* Service Worker — notifications push (app fermée / arrière-plan).
 *
 * Système INDÉPENDANT du son. Volontairement minimal : il ne met RIEN en cache et
 * n'intercepte aucune requête réseau, pour ne jamais servir de HTML périmé (un
 * ancien bug de cette app venait d'un service worker fantôme d'un autre projet).
 * Il ne gère que 'push' et le clic sur notification.
 */

self.addEventListener("install", () => {
  // Activer immédiatement la nouvelle version plutôt que d'attendre la fermeture
  // de tous les onglets.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Country Guess", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Country Guess";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Regroupe les notifs d'une même partie : une nouvelle remplace la précédente
    // plutôt que d'empiler.
    tag: data.tag || "country-guess",
    renotify: true,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Si une fenêtre de l'app est déjà ouverte, on la ramène au premier plan
      // plutôt que d'en ouvrir une seconde.
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
