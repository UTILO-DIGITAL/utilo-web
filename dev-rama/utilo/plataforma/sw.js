/*
 * Avisos al móvil de la plataforma de Utilo · T0432 · el service worker (Web Push)
 *
 * Lo registra nucleo/acceso-supabase.js (UG.avisos.activar) al dar permiso en el Perfil, con el Supabase de esta página y
 * su icono en la dirección (sw.js?sb=<url>&k=<clave publishable>&i=<icono>). Va en la carpeta de la plataforma porque solo
 * atiende lo que hay debajo de donde está (su «scope»); la de DEV (dev/plataforma/sw.js) es una copia igual, y
 * probar-avisos.js comprueba que no se separan. No guarda nada ni toca las peticiones de la página: solo avisos.
 * - push: enseña el aviso (en iOS, un aviso que llega sin enseñarse acaba quitando el permiso) y apunta en la base que ha
 *   llegado (aviso_recibido, sin sesión: el id del envío no se adivina). Así se ve el retraso sin apuntarlo a mano.
 * - Al tocarlo: apunta que se ha abierto y abre la plataforma donde dice el aviso (o la pone delante si ya estaba abierta).
 * - T0437 · El iPhone no siempre lleva la app adonde dice el aviso (abierta, no la mueve; cerrada, puede abrirla en su
 *   inicio). Por eso no se fía de navigate ni de openWindow: a la ventana que pone delante le dice qué abrir (mensaje
 *   «utilo-abrir», que atiende acceso-supabase.js) y, si abre una nueva, se lo guarda un minuto para cuando la página
 *   pregunte al arrancar («utilo-pendiente»).
 */
'use strict';

var Q = new URL(self.location.href).searchParams;
var SB = String(Q.get('sb') || '').replace(/\/+$/, ''), CLAVE = Q.get('k') || '', ICONO = Q.get('i') || '';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

/** Apunta en la base que el aviso ha llegado (y, con abierto, que se ha tocado). Si falla, no pasa nada. */
function apuntar(id, abierto) {
  if (!id || !SB || !CLAVE) return Promise.resolve();
  return fetch(SB + '/rest/v1/rpc/aviso_recibido', {
    method: 'POST', headers: { apikey: CLAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ envio: id, abierto: !!abierto })
  }).catch(function () {});
}

/** Dónde lleva el aviso: su url si es de esta misma plataforma; si no, la plataforma. */
function destino(url) {
  var scope = self.registration.scope;
  try { var u = new URL(url || '', scope); if (u.href.indexOf(scope) === 0) return u.href; } catch (e) {}
  return scope;
}

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { titulo: e.data ? e.data.text() : '' }; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.titulo || 'Utilo', {
      body: d.texto || '', icon: ICONO || undefined,
      tag: d.id || undefined, data: { id: d.id || '', url: destino(d.url) }
    }),
    apuntar(d.id, false)
  ]));
});

var PENDIENTE = null; // T0437 · { url, hasta }: lo que ha pedido el último aviso tocado, para la página que se abra

self.addEventListener('notificationclick', function (e) {
  var d = (e.notification && e.notification.data) || {};
  e.notification.close();
  var url = d.url || self.registration.scope;
  PENDIENTE = null;
  e.waitUntil(Promise.all([
    apuntar(d.id, true),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (vs) {
      for (var i = 0; i < vs.length; i++) {
        if (vs[i].url.indexOf(self.registration.scope) === 0 && 'focus' in vs[i]) {
          var v = vs[i];
          return v.focus().catch(function () { return v; }).then(function (w) {
            if (url !== self.registration.scope) (w || v).postMessage({ tipo: 'utilo-abrir', url: url });
            return w || v;
          });
        }
      }
      if (url !== self.registration.scope) PENDIENTE = { url: url, hasta: Date.now() + 60000 };
      return self.clients.openWindow(url);
    })
  ]));
});

/** T0437 · La página, al arrancar, pregunta si viene de tocar un aviso: se le dice adónde ir (una vez, y solo un minuto). */
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.tipo !== 'utilo-pendiente' || !PENDIENTE || !e.source) return;
  var p = PENDIENTE;
  PENDIENTE = null;
  if (p.hasta > Date.now()) e.source.postMessage({ tipo: 'utilo-abrir', url: p.url });
});
