/*
 * La pantalla de dentro del simulador de la maqueta de Konamigas · T0364 · web/maquetas/konamigas/sim.js de utilo-apps
 *
 * Va en las tres páginas de la maqueta (konamigas.com, la inscripción y la plataforma) y solo hace algo cuando la página
 * está dentro del simulador (simulador.html, o la copia del móvil): konamigas.com a un lado y la plataforma al otro.
 * - Cada vez que esta pantalla cambia algo en el motor (inscribe un equipo, guarda una incidencia, aplaza un partido…),
 *   se lo dice al simulador ({ mq: 'cambio', lado, fn, args }), que avisa a la otra pantalla y le pide que se refresque.
 * - { mq: 'refrescar' }: konamigas.com vuelve a leer lo público (MQW.recargar); la plataforma, sus tablas (como al volver
 *   a la pestaña) y lo compartido de la maqueta (mq-refrescar).
 * - { mq: 'ir', a }: la plataforma abre una sección o un portal de «Futuro» (Incidencias, Gestión, Ligas…).
 * - { mq: 'llamar', id, fn, args } (T0366): la plataforma llama a una función del motor (los equipos de ejemplo de la Kopa,
 *   desde el guion) y contesta { mq: 'llamado', id, ok, r | error }; como cualquier cambio, se avisa a la otra pantalla.
 */
(function () {
  'use strict';
  if (window.parent === window) return;
  var C = window.KANBAN || {};
  var lado = function () { return C.lado || (window.MQW ? 'web' : document.getElementById('ins') ? 'web' : 'app'); };
  // Lo que solo lee: no cambia nada que la otra pantalla tenga que ver.
  var LEE = /^(entrar|nucleoPersonas|tablasLeer|kanbanOpciones|maqueta(Web|Personas|Entrar|Ligas|Comun)|inscripciones(Datos|Dorsales|Banco))$|^ligas(Staff|Jugadoras|Nombres|Colores|Perfil\w*|Senales|Historial|CalendarioLigas)$|Perfil/;

  var antes = window.fetch.bind(window);
  window.fetch = function (url, o) {
    var p = antes(url, o);
    if (String(url) !== C.api) return p;
    var b = {};
    try { b = JSON.parse((o && o.body) || '{}'); } catch (e) { b = {}; }
    if (!b.fn || LEE.test(b.fn)) return p;
    return p.then(function (r) {
      r.clone().json().then(function (j) {
        if (j && j.ok) window.parent.postMessage({ mq: 'cambio', lado: lado(), fn: b.fn, args: b.args || [] }, '*');
      }, function () {});
      return r;
    });
  };

  /** Abre una sección de la plataforma por su nombre en el menú (o su id). */
  function abrirSeccion(nombre, q) {
    var a = [].filter.call(document.querySelectorAll('a[data-sx]'), function (x) {
      return x.getAttribute('data-sx') === String(nombre).toUpperCase() || x.textContent.trim().toLowerCase().indexOf(String(nombre).toLowerCase()) === 0;
    })[0];
    if (!a) return false;
    var id = a.getAttribute('data-sx');
    history.pushState({ s: id }, '', '?s=' + id.toLowerCase() + (q ? '&' + q : ''));
    window.dispatchEvent(new PopStateEvent('popstate', { state: { s: id } }));
    return true;
  }

  // T0366: en la plataforma, qué sección se abre ({ mq: 'seccion', s }) y si se ven los pagos de un equipo (Gestión, su
  // ficha → Pagos: el paso «Mira lo que debe cada equipo»), para que el guion los marque solos.
  (function () {
    var antesS = '', pagos = false;
    new MutationObserver(function () {
      if (lado() !== 'app') return; // konamigas.com sabe que es «web» cuando ya ha cargado web.js
      var s = (new URLSearchParams(location.search).get('s') || '').toLowerCase();
      if (s && s !== antesS) { antesS = s; window.parent.postMessage({ mq: 'seccion', s: s }, '*'); }
      if (!pagos && [].some.call(document.querySelectorAll('.gs-sec'), function (x) { return x.textContent.trim() === 'Pagos' && x.offsetParent; })) {
        pagos = true; window.parent.postMessage({ mq: 'paso', id: 'debe' }, '*');
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  })();

  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.mq === 'refrescar') {
      if (window.MQW && window.MQW.recargar) return window.MQW.recargar();
      document.dispatchEvent(new Event('visibilitychange')); // las tablas del núcleo se ponen al día, como al volver
      window.dispatchEvent(new CustomEvent('mq-refrescar'));
    }
    if (d.mq === 'llamar') {
      window.fetch(C.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: d.fn, args: d.args || [] }) })
        .then(function (r) { return r.json(); })
        .then(function (j) { window.parent.postMessage({ mq: 'llamado', id: d.id, ok: !!(j && j.ok), r: j && j.r, error: j && !j.ok ? String(j.error || '').replace(/^\w+:\s*/, '') : '' }, '*'); },
          function (er) { window.parent.postMessage({ mq: 'llamado', id: d.id, ok: false, error: String(er && er.message || er) }, '*'); });
    }
    if (d.mq === 'ir') {
      if (d.a === 'incidencias' || d.a === 'redes' || d.a === 'arbitro') { window.MQ_IR = d.a; abrirSeccion('MAQUETA'); }
      else abrirSeccion(d.a, d.q || '');
    }
  });
})();
