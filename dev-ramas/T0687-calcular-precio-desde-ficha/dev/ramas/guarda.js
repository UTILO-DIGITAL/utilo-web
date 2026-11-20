/*
 * T0655 · La guarda de la página de un proyecto suelto en la app «Utilo DEV» (dev-ramas/<repositorio>.<rama>/).
 *
 * herramientas/dev-ramas.js la pone en línea, lo primero de su <head>, antes que su servidor de mentira y que la web:
 *   - La página no llama fuera de su sitio (fetch, XMLHttpRequest, sendBeacon, WebSocket, EventSource): una rama a medias
 *     nunca toca lo de producción (la API de Apps Script de Casa Abuela), aunque su servidor de mentira falte o falle.
 *   - Ni instala un service worker (se quedaría en el móvil).
 *   - Su localStorage va aparte, con el prefijo de su carpeta: el sitio es el mismo que el de la web de verdad
 *     (utilo-digital.github.io), y si no, DEV vería y pisaría lo que la web de verdad guarda en el móvil. Lo de la app
 *     DEV (claves «dev_…», que lee marco.js) no lleva prefijo.
 * __PREFIJO__ lo cambia dev-ramas.js por «dev:<carpeta>:».
 */
(function () {
  'use strict';
  if (window.DEV_GUARDA) return;
  window.DEV_GUARDA = true;
  var PREFIJO = '__PREFIJO__';
  var aqui = location.origin;

  function propia(u) { try { return new URL(String(u), location.href).origin === aqui; } catch (e) { return false; } }
  function fuera(u) { var m = 'DEV: esta página no llama fuera de su sitio (' + String(u).slice(0, 120) + ').'; try { console.warn('[DEV] ' + m); } catch (e) {} return m; }

  var f = window.fetch;
  if (f) {
    window.fetch = function (r, o) {
      var u = r && typeof r === 'object' && 'url' in r ? r.url : r;
      if (!propia(u)) return Promise.reject(new TypeError(fuera(u)));
      return f.apply(this, arguments);
    };
  }
  if (window.XMLHttpRequest) {
    var abrir = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (metodo, u) {
      if (!propia(u)) throw new TypeError(fuera(u));
      return abrir.apply(this, arguments);
    };
  }
  if (navigator.sendBeacon) {
    var baliza = navigator.sendBeacon;
    try { navigator.sendBeacon = function (u) { if (!propia(u)) { fuera(u); return false; } return baliza.apply(navigator, arguments); }; } catch (e) {}
  }
  ['WebSocket', 'EventSource'].forEach(function (n) {
    if (window[n]) window[n] = function (u) { throw new TypeError(fuera(u)); };
  });
  if (navigator.serviceWorker && navigator.serviceWorker.register) {
    try { navigator.serviceWorker.register = function () { return Promise.reject(new Error('DEV: sin service worker.')); }; } catch (e) {}
  }

  // localStorage aparte (sessionStorage ya es de cada pestaña).
  var S = window.Storage && Storage.prototype;
  if (!S) return;
  var get = S.getItem, set = S.setItem, quitar = S.removeItem, clave = S.key, vaciar = S.clear;
  function local(t) { try { return t === window.localStorage; } catch (e) { return false; } }
  function k(x) { x = String(x); return /^dev_/.test(x) ? x : PREFIJO + x; }
  S.getItem = function (x) { return get.call(this, local(this) ? k(x) : x); };
  S.setItem = function (x, v) { return set.call(this, local(this) ? k(x) : x, v); };
  S.removeItem = function (x) { return quitar.call(this, local(this) ? k(x) : x); };
  S.clear = function () {
    if (!local(this)) return vaciar.call(this);
    var mias = [];
    for (var i = 0; i < this.length; i++) { var c = clave.call(this, i); if (c && c.indexOf(PREFIJO) === 0) mias.push(c); }
    for (var j = 0; j < mias.length; j++) quitar.call(this, mias[j]);
  };
})();
