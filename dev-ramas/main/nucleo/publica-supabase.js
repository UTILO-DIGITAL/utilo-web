/*
 * Una página pública sobre Supabase · UTILO_CORE 5.0 (T0395) · una sección solo para ver, sin entrar
 *
 * La consulta pública de Ligas de Konamigas (web/konamigas/competiciones/) y lo que venga después: una sección del núcleo
 * (la misma que en la plataforma) que se ve sin entrar, sin el marco, sin Apps Script y sin el robot de la web pública.
 * - Lee con la capa de tablas (nucleo/supabase.js) y la clave publishable, sin sesión: la base contesta como a cualquiera que
 *   no ha entrado (anon) y solo da lo que sus reglas dejan ver sin entrar. Aquí no se decide nada que importe.
 * - Qué lee lo dice montaje.js (montar.js, con «publica»: true en su config.json): cada tabla de la sección, con su nombre,
 *   de la tabla o la vista pública que dice su «publica» (PARTIDOS, de partidos_publicos). Las demás tablas de la sección le
 *   llegan vacías (sin pedirlas) y no tiene funciones: no hay nada que pueda hacer, solo mirar.
 * - Sin roles, sin persona y sin funciones: la sección enseña lo que enseña a quien no puede hacer nada.
 * - Lo leído se guarda en este dispositivo (la copia «publico» de tablas.js): al volver se pinta al momento y se pone al día
 *   por detrás. Al volver a la pestaña se refresca solo y, mientras se mira, cada dos minutos (sin entrar no hay Realtime).
 * - El entorno, como en nucleo/acceso-supabase.js: el Supabase local (npm run local), DEV (utilo-web/dev-rama/ o, T0441, dev-ramas/<rama>/, y la banda dice la rama) o producción.
 *
 * window.KANBAN = { clave, marca, nombreApp } y window.NUCLEO_MONTAJE (montaje.js) van antes; después, kanban4/tablas.js,
 * nucleo/supabase.js y este archivo. La página tiene un <main id="pub"> donde se pinta.
 */
(function () {
  'use strict';
  var C = window.KANBAN || {};
  var M = window.NUCLEO_MONTAJE || {};
  var ENTORNO = C.supabaseLocal ? 'local' : /\/dev-ramas?\//.test(location.pathname) ? 'dev' : 'prod';
  var RAMA = (/\/dev-ramas\/([^/]+)\//.exec(location.pathname) || [])[1] || '';     // T0441: la rama de dev-ramas/<rama>/
  // T0446: en la app «Utilo DEV», su marco (dev-ramas/marco.js) en lugar de la banda.
  var APP_DEV = (/^(.*\/dev-ramas\/)[^/]+\//.exec(location.pathname) || [])[1] || '';
  if (APP_DEV) {
    var mDev = document.createElement('script');
    mDev.src = APP_DEV + 'marco.js?v=' + Math.floor(Date.now() / 600000); // GitHub Pages lo guarda 10 minutos
    document.head.appendChild(mDev);
  }
  var P = C.supabaseLocal || (M.supabase || {})[ENTORNO] || {};
  var RAIZ = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/nucleo\/[^/]*$/, '') : '../../'; })();
  var CADA = 2 * 60 * 1000; // cada cuánto se pone al día mientras se mira
  var S = (M.secciones || [])[0] || null;
  var DEF = null;

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }

  /** Lo que no sale sin entrar: las tablas de la sección que no están en su «publica» llegan vacías, sin preguntar a nadie. */
  function vacias(nombres) {
    var out = {};
    [].concat(nombres || []).forEach(function (n) { out[n] = { cols: ['ID'], filas: [], v: 'vacia', leido: Date.now() }; });
    return { tablas: out };
  }
  function otro(fn, args) {
    if (fn === 'tablasLeer') return Promise.resolve(vacias(args && args[0]));
    return Promise.reject(new Error('SECCION: sin entrar solo se puede mirar.'));
  }

  var tAviso = null;
  function aviso(t) {
    var a = $('pub-aviso');
    if (!a) return;
    a.textContent = t; a.hidden = false;
    clearTimeout(tAviso);
    tAviso = setTimeout(function () { a.hidden = true; }, 5000);
  }

  function error(m) {
    var el = $('pub');
    if (el) el.innerHTML = '<div class="kz-centro"><p class="u-error">' + texto(m) + '</p></div>';
  }

  function abrir() {
    if (!S) return error('Esta página no tiene ninguna sección (montaje.js).');
    if (!P.url || !P.clave) return error('Falta el Supabase de ' + (ENTORNO === 'prod' ? 'producción' : ENTORNO) + ' en montaje.js.');
    var sb = window.US.crear({ url: P.url, clave: P.clave, esquema: M.esquema, otro: otro, fetch: function (u, x) { return fetch(u, x); } });
    var T = window.UT.crear({ llamar: sb.llamar, clave: C.clave || 'publica', persona: 'publico', aviso: aviso });
    var oyentes = [];
    T.en('cambio', function (tabla, info) { oyentes.forEach(function (f) { try { f(tabla, info); } catch (e) { if (window.console) console.error(e); } }); });
    var titulo = S.titulo || C.nombreApp || M.nombreApp || '';
    var dev = ENTORNO === 'prod' ? '' : (ENTORNO === 'dev' ? 'DEV' : 'Local') + (RAMA ? ' · ' + decodeURIComponent(RAMA) : '') + ' · Supabase ' + (P.nombre || 'de pruebas') + ' · sin entrar';
    document.body.innerHTML = (dev && !APP_DEV ? '<div role="status" class="pub-dev">' + texto(dev) + '</div>' : '') +
      '<header class="u-cab n-cab pub-cab"><h1 id="pub-titulo">' + texto(titulo) + '</h1>' +
      (C.nombreApp || M.nombreApp ? '<span class="pub-marca">' + texto(C.nombreApp || M.nombreApp) + '</span>' : '') + '</header>' +
      '<main class="u-main n-main" id="pub"></main><div class="u-aviso" id="pub-aviso" role="status" hidden></div>';
    document.title = titulo + (C.nombreApp && C.nombreApp !== titulo ? ' · ' + C.nombreApp : '');
    var ctx = {
      id: S.id, titulo: titulo, persona: '', perfil: '', admin: false, config: S.config || {}, autor: '', como: null, verComo: null,
      personaId: '', roles: [], desde: null, volver: function () { history.back(); }, correo: '', secciones: [{ id: S.id, titulo: titulo }],
      publica: true,
      tablas: T,
      alCambiar: function (f) { oyentes.push(f); },
      llamar: function () { return Promise.reject(new Error('SECCION: sin entrar solo se puede mirar.')); },
      aviso: aviso,
      ponerTitulo: function (t) { var h = $('pub-titulo'); if (h) h.textContent = t; },
      abierta: function () { return true; },
      enDirecto: null
    };
    DEF.abrir($('pub'), ctx);
    // Sin entrar no hay Realtime: mientras se mira, se pone al día cada poco (tablas.js solo repinta si algo ha cambiado).
    setInterval(function () {
      if (document.visibilityState !== 'visible') return;
      T.refrescar(Object.keys((M.esquema || {}).tablas || {}), true).catch(function () {});
    }, CADA);
  }

  // La sección se registra en window.UN, como en el marco; aquí no hay marco: se abre en esta página.
  window.UN = window.UN || {};
  window.UN.registrar = function (id, def) { if (S && id === S.id && !DEF) { DEF = def; abrir(); } };
  if (!S) { error('Esta página no tiene ninguna sección (montaje.js).'); return; }
  var sc = document.createElement('script');
  sc.src = RAIZ + S.web + '?v=' + encodeURIComponent(S.version || '1');
  sc.onerror = function () { error('No se ha podido cargar la página. Revisa la conexión y vuelve a probar.'); };
  document.head.appendChild(sc);
  // Para las pruebas.
  window.UPUB = { entorno: ENTORNO, otro: otro };
})();
