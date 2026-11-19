/* Casa Abuela · v5.37 (T0623): recibe los avisos al móvil (Firebase Cloud Messaging) aunque la app esté cerrada.
 * Los manda el Apps Script (revisarAvisos) como mensajes solo de datos: { titulo, texto, enlace }; aquí se enseñan.
 * Sin el SDK de Firebase: FCM entrega un push normal, con el JSON { data: {…} }. No guarda nada en caché. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (err) { p = { data: { texto: e.data ? e.data.text() : '' } }; }
  const d = p.data || {}, n = p.notification || {};
  const titulo = d.titulo || n.title || 'Casa Abuela';
  const texto = d.texto || n.body || 'Hay cambios en el calendario.';
  e.waitUntil(self.registration.showNotification(titulo, {
    body: texto,
    icon: 'icono-192.png',
    badge: 'icono-192.png',
    tag: 'casa-abuela-cambios',  // uno nuevo sustituye al anterior: no se amontonan
    renotify: true,
    data: { enlace: d.enlace || self.registration.scope },
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const enlace = (e.notification.data && e.notification.data.enlace) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ventanas) {
    for (let i = 0; i < ventanas.length; i++) {
      if (ventanas[i].url.indexOf(self.registration.scope) === 0 && 'focus' in ventanas[i]) {
        ventanas[i].postMessage({ tipo: 'avisos-recargar' });
        return ventanas[i].focus();
      }
    }
    return self.clients.openWindow(enlace);
  }));
});
