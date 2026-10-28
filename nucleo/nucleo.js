/*
 * Marco del núcleo · UTILO_CORE 5.0 (T0253) · la parte del navegador de motor/core/NUCLEO.js de utilo-apps
 *
 * El núcleo es solo el marco común de todas las webs: entrar con Google, la cabecera, quién ha entrado y con qué perfil,
 * y el menú de secciones (abajo en el móvil, a la izquierda en el ordenador). Las secciones (Kanban, Economía, Perfil,
 * Pedir a Utilo y las de cada cliente) se enchufan con el mismo contrato (docs/CONTRATO_SECCION.md de utilo-apps).
 *
 * - Cada negocio tiene un index.html que define window.KANBAN = { api, clave, marca, nombreApp, google, proyecto,
 *   clavePicker } y carga, por este orden, su marca.css, estilos/base.css, kanban4/google.js, kanban4/tablas.js y este archivo.
 * - Al volver a entrar, el marco se pinta al momento con lo guardado en el dispositivo (quién eres y tus secciones) y se
 *   comprueba con el motor por detrás («entrar»); si algo ha cambiado (perfil, secciones), se vuelve a pintar.
 * - El menú solo enseña las secciones que el motor dice que ves: las activas del cliente que tu perfil puede ver. El motor
 *   lo vuelve a comprobar en cada llamada, así que no basta con tocar la web.
 * - Cada sección es un JS de utilo-web (su «web» en modulo.json) que se carga la primera vez que se abre, con su versión
 *   (?v=), y se registra con UN.registrar('ID', { abrir: function (el, ctx) {…}, cerrar: function () {…} }).
 *   abrir recibe el <main> de la sección y ctx (ver ctxDe más abajo): quién eres, su personalización, las tablas al
 *   momento (kanban4/tablas.js, una copia para todas las secciones), llamar a sus funciones del motor y avisar.
 * - Perfil va siempre al final del menú: si el cliente tiene la sección PERFIL (T0259), esa; si no, la del marco
 *   (quién eres, tu perfil y cerrar sesión).
 * - La sección va en la URL (?s=ejemplo). Cambiar de sección no recarga la página.
 */
(function () {
  'use strict';
  var C = window.KANBAN || {};
  var CLAVE = 'nucleo_' + (C.clave || 'negocio');
  // Raíz de utilo-web (…/utilo-web/): de aquí cuelgan nucleo/, kanban4/, estilos/ y la carpeta de cada negocio.
  var RAIZ = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/nucleo\/[^/]*$/, '') : '../'; })();
  var MENU_CLAVE = 'kanbanMenuPlegado'; // el mismo que kanban4/app.js (T0225): cada dispositivo recuerda cómo dejó el menú

  var ICONO_PERFIL = '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"/>';
  var ICONO_SECCION = '<circle cx="12" cy="12" r="3"/>';

  function $(id) { return document.getElementById(id); }
  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function leer() { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; } }
  function guardar(o) { try { localStorage.setItem(CLAVE, JSON.stringify(o)); } catch (e) {} }
  function borrar() { try { localStorage.removeItem(CLAVE); } catch (e) {} }

  /** Llamada al motor con la llave de Google; pide conectar un Excel si falta (google.js · UG.seccion). */
  function llamar(fn, args) { return window.UG.seccion(C.api, { fn: fn, args: args || [] }, CLAVE); }
  /** «entrar», con los errores tal cual (ACCESO: vuelve a la pantalla de entrada). */
  function entrar() { return window.UG.llamar(C.api, { fn: 'entrar' }); }
  function inicio() {
    return fetch(C.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: 'inicio' }) })
      .then(function (r) { if (!r.ok) throw new Error('No hay conexión con el motor del negocio (' + r.status + ').'); return r.json(); })
      .then(function (o) { if (!o.ok) throw new Error(String(o.error || 'Error')); return o.r; });
  }

  /* ---------- pantallas de carga y de entrada ---------- */

  function pantalla(html) { document.body.className = 'u'; document.body.innerHTML = '<div class="kz">' + html + '</div>'; }
  function cargando(msg) { pantalla('<div class="kz-caja kz-centro" role="status"><div class="u-carga"></div><p>' + texto(msg || 'Cargando…') + '</p></div>'); }
  function falloPantalla(msg) {
    pantalla('<div class="kz-caja"><p>' + texto(msg) + '</p><button type="button" class="u-btn" onclick="location.reload()">Volver a intentarlo</button></div>');
  }

  /** Entrar con Google: el motor dice el nombre del negocio y si tiene sesión larga (T0209); después, «entrar». */
  function acceso(aviso) {
    cargando('Conectando…');
    inicio().then(function (ini) {
      if (window.UG.configurar) window.UG.configurar(ini);
      if (!ini.nucleo) { falloPantalla('Esta web todavía no tiene el núcleo nuevo: abre la web de siempre del negocio.'); return; }
      var titulo = C.nombreApp || ini.titulo || ini.negocio || 'Entrar';
      document.title = titulo;
      var ant = leer() || {};
      pantalla('<div class="kz-caja" id="n-entrar">' + bandaDev(ini.nucleo.dev) + '<h1>' + texto(titulo) + '</h1>' +
        '<p class="kz-ayuda">' + texto(ant.persona ? 'Vuelve a entrar con tu cuenta de Google, ' + ant.persona.split(' ')[0] + '.' :
          'Entra con la cuenta de Google con la que te han dado acceso.') + '</p>' +
        '<button type="button" class="u-btn u-btn-accion">' + (ant.persona ? 'Continuar con Google' : 'Entrar con Google') + '</button>' +
        '<p class="kz-aviso" id="n-aviso-entrar">' + texto(aviso || '') + '</p></div>');
      var b = $('n-entrar').querySelector('button');
      b.onclick = function () {
        b.disabled = true; b.textContent = 'Entrando…';
        window.UG.entrar().then(entrar).then(function (r) {
          window.UG.recordarCorreo(r.correo || '');
          var cred = credDe(r);
          guardar(cred); marco(cred);
        }, function (e) {
          if (/^CONECTAR:/.test(e.message)) { conectarYEntrar(e); return; }
          b.disabled = false; b.textContent = ant.persona ? 'Continuar con Google' : 'Entrar con Google';
          $('n-aviso-entrar').textContent = String(e.message).replace(/^ACCESO:\s*/, '');
        });
      };
      b.focus();
    }, function (e) { falloPantalla(e.message); });
  }

  /** Falta conectar con la web el Excel de los accesos (permiso «solo los archivos de esta web», T0201). */
  function conectarYEntrar(e) {
    var m = /^CONECTAR:([^:]+):\s*(.*)$/.exec(e.message) || [];
    pantalla('<div class="kz-caja" id="n-con"><h1>' + texto(C.nombreApp || 'Conectar') + '</h1>' +
      '<p class="kz-ayuda">Para que la web pueda usar el Excel del negocio, elígelo una vez en la ventana de Google. Solo hace falta la primera vez.</p>' +
      '<button type="button" class="u-btn u-btn-accion">Conectar el Excel</button><p class="kz-aviso" id="n-aviso-con"></p></div>');
    var b = $('n-con').querySelector('button');
    b.onclick = function () {
      b.disabled = true;
      window.UG.conectar(m[1]).then(function () { location.reload(); }, function (x) { b.disabled = false; $('n-aviso-con').textContent = x.message; });
    };
    b.focus();
  }

  function credDe(r) {
    return { persona: r.persona, correo: r.correo || '', perfil: r.perfil || '', admin: !!r.admin, negocio: r.negocio || '', dev: r.dev || '', secciones: r.secciones || [] };
  }

  /** En DEV, la banda «DEV · rama · commit · modo» (la misma que DEV.gs del motor: colores fijos, solo en DEV). */
  function bandaDev(t) {
    return t ? '<div role="status" style="position:sticky;top:0;z-index:99999;padding:6px 12px;font:600 13px/1.35 system-ui,sans-serif;text-align:center;' +
      'color:#1C1C1C;background:#FFE08A;border-bottom:2px solid #B88A00;overflow-wrap:anywhere">' + texto(t) + '</div>' : '';
  }

  /* ---------- el marco ---------- */

  var cred = null;          // quién ha entrado y sus secciones (lo guardado y, después, lo que dice el motor)
  var actual = '';          // sección abierta
  var abierta = null;       // { id, def } de la sección abierta (para cerrarla al cambiar)
  var DEF = {};             // secciones registradas: ID → { abrir, cerrar }
  var cargas = {};          // ID → promesa de su JS
  var oyentes = {};         // ID → funciones que quieren saber cuándo cambia una tabla (solo la sección abierta)
  var T = null;             // tablas al momento (kanban4/tablas.js), una copia para todas las secciones

  window.UN = {
    /** Cada sección se registra al cargar su JS: UN.registrar('EJEMPLO', { abrir: function (el, ctx) {}, cerrar: function () {} }). */
    registrar: function (id, def) { DEF[String(id).toUpperCase()] = def; }
  };

  function tablas() {
    if (T) return T;
    T = window.UT.crear({ llamar: llamar, clave: C.clave || 'negocio', aviso: aviso });
    T.en('cambio', function (tabla, info) {
      (oyentes[actual] || []).forEach(function (f) { try { f(tabla, info); } catch (e) { if (window.console) console.error(e); } });
    });
    return T;
  }

  /** Secciones del menú: las que ves y, al final, Perfil (la sección PERFIL si el cliente la tiene; si no, la del marco). */
  function menu() {
    var ss = (cred.secciones || []).filter(function (s) { return s.id !== 'PERFIL'; });
    var p = (cred.secciones || []).filter(function (s) { return s.id === 'PERFIL'; })[0] || { id: 'PERFIL', titulo: 'Perfil', icono: ICONO_PERFIL, propia: true };
    return ss.concat([p]);
  }
  function seccion(id) { return menu().filter(function (s) { return s.id === id; })[0] || null; }

  function htmlMenu() {
    var plegado = false;
    try { plegado = localStorage.getItem(MENU_CLAVE) === '1'; } catch (e) {}
    document.body.classList.toggle('u-menu-plegado', plegado);
    var et = plegado ? 'Desplegar el menú' : 'Plegar el menú';
    return '<nav class="sx u-sx" aria-label="Secciones"><div class="sx-in"><div class="sx-cab"><span class="sx-marca">' + texto(C.nombreApp || cred.negocio || '') + '</span>' +
      '<button type="button" class="sx-plegar" id="n-plegar" aria-label="' + et + '" title="' + et + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button></div>' +
      menu().map(function (s) {
        return '<a href="?s=' + encodeURIComponent(s.id.toLowerCase()) + '" data-sx="' + texto(s.id) + '" title="' + texto(s.titulo) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' + (s.icono || ICONO_SECCION) + '</svg><span>' + texto(s.titulo) +
          (s.id === 'PERFIL' ? '<span class="sx-quien">' + texto(cred.persona) + '</span>' : '') + '</span></a>';
      }).join('') + '</div></nav>';
  }

  /** Pinta el marco entero y abre la sección de la URL (o la primera). */
  function marco(c) {
    cred = c;
    document.body.className = 'u u-con-barra';
    document.body.innerHTML = bandaDev(cred.dev) + htmlMenu() +
      '<div id="sx-panel"><header class="u-cab n-cab"><h1 id="n-titulo"></h1>' +
      '<a class="n-quien" href="?s=perfil" data-sx="PERFIL"><span>' + texto(cred.persona) + '</span>' + (cred.perfil ? '<small>' + texto(cred.perfil) + '</small>' : '') + '</a></header>' +
      '<main class="u-main n-main" id="n-sec"></main></div>' +
      '<div class="u-aviso" id="n-aviso" role="status" hidden></div>';
    $('n-plegar').onclick = function () {
      var p = document.body.classList.toggle('u-menu-plegado');
      this.setAttribute('aria-label', p ? 'Desplegar el menú' : 'Plegar el menú'); this.title = this.getAttribute('aria-label');
      try { if (p) localStorage.setItem(MENU_CLAVE, '1'); else localStorage.removeItem(MENU_CLAVE); } catch (e) {}
    };
    abrir(pedida() || menu()[0].id, false);
  }

  function pedida() {
    var s = String(new URLSearchParams(location.search).get('s') || '').toUpperCase();
    return seccion(s) ? s : '';
  }

  /** Abre una sección dentro del marco: título, menú, su JS (la primera vez) y su abrir(el, ctx). */
  function abrir(id, push) {
    var s = seccion(id) || menu()[0];
    if (abierta && abierta.def && abierta.def.cerrar) { try { abierta.def.cerrar(); } catch (e) {} }
    abierta = null;
    oyentes[actual] = [];
    actual = s.id;
    [].forEach.call(document.querySelectorAll('.sx a[data-sx]'), function (a) {
      if (a.getAttribute('data-sx') === s.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('n-titulo').textContent = s.titulo;
    document.title = s.titulo + ' · ' + (C.nombreApp || cred.negocio || '');
    if (push) history.pushState({ s: s.id }, '', '?s=' + s.id.toLowerCase());
    window.scrollTo(0, 0); document.body.scrollTop = 0;
    var el = $('n-sec');
    if (s.propia) { el.innerHTML = htmlPerfil(); return; }
    var t = setTimeout(function () { if (actual === s.id && !el.childNodes.length) el.innerHTML = '<div class="kz-centro" role="status"><div class="u-carga"></div></div>'; }, 150);
    cargar(s).then(function (def) {
      clearTimeout(t);
      if (actual !== s.id) return;
      el.innerHTML = '';
      abierta = { id: s.id, def: def };
      def.abrir(el, ctxDe(s));
    }, function () {
      clearTimeout(t);
      if (actual === s.id) el.innerHTML = '<p>No se ha podido cargar ' + texto(s.titulo) + '.</p><p class="u-nota">Comprueba la conexión y vuelve a abrir la sección.</p>';
    });
  }

  /** El JS de una sección, una vez. */
  function cargar(s) {
    if (DEF[s.id]) return Promise.resolve(DEF[s.id]);
    if (cargas[s.id]) return cargas[s.id];
    cargas[s.id] = new Promise(function (ok, ko) {
      var sc = document.createElement('script');
      sc.src = RAIZ + s.web + '?v=' + encodeURIComponent(s.version || '1');
      sc.onload = function () { if (DEF[s.id]) ok(DEF[s.id]); else ko(new Error('La sección ' + s.id + ' no se ha registrado.')); };
      sc.onerror = function () { delete cargas[s.id]; ko(new Error('No se ha podido cargar la sección.')); };
      document.head.appendChild(sc);
    });
    return cargas[s.id];
  }

  /**
   * Lo que recibe cada sección en abrir(el, ctx):
   * - id, titulo, persona, perfil, admin y config (su personalización de config.json · nucleo, con los valores por defecto).
   * - tablas: las tablas al momento (UT de kanban4/tablas.js): leer, filas, fila, actualizar, crear, borrar.
   * - alCambiar(f): f(tabla, info) cada vez que cambia una tabla, solo mientras la sección está abierta.
   * - llamar(fn, args): una función de su «api» del motor (recibe ctx en el motor). Devuelve una promesa.
   * - aviso(texto): mensaje corto abajo de la pantalla. ponerTitulo(texto): cambia el título de la cabecera.
   * - abierta(): si la sección sigue abierta (para no pintar tarde en otra).
   */
  function ctxDe(s) {
    return {
      id: s.id, titulo: s.titulo, persona: cred.persona, perfil: cred.perfil, admin: cred.admin, config: s.config || {},
      tablas: tablas(),
      alCambiar: function (f) { (oyentes[s.id] = oyentes[s.id] || []).push(f); },
      llamar: llamar,
      aviso: aviso,
      ponerTitulo: function (t) { if (actual === s.id) $('n-titulo').textContent = t; },
      abierta: function () { return actual === s.id; }
    };
  }

  var tAviso = 0;
  function aviso(t) {
    var a = $('n-aviso');
    if (!a) return;
    a.textContent = t; a.hidden = false;
    clearTimeout(tAviso);
    tAviso = setTimeout(function () { a.hidden = true; }, 5000);
  }

  /** Perfil del marco, mientras el cliente no tenga la sección PERFIL: quién eres, tu perfil y cerrar sesión. */
  function htmlPerfil() {
    var ves = (cred.secciones || []).map(function (s) { return s.titulo; }).join(', ');
    return '<div class="u-perfil"><div class="u-perfil-quien"><strong>' + texto(cred.persona) + '</strong>' +
      '<span>' + texto(cred.admin ? (cred.perfil ? cred.perfil + ' · administras el negocio' : 'Administras el negocio') : cred.perfil) + '</span></div>' +
      '<dl><dt>Cuenta</dt><dd>' + texto(cred.correo || '') + '</dd>' +
      '<dt>Secciones</dt><dd>' + texto(ves || 'Ninguna') + '</dd>' +
      '<dt>Dispositivo</dt><dd>Sesión guardada en este dispositivo</dd></dl>' +
      '<a class="u-btn" href="?salir">Cerrar sesión</a>' +
      '<p class="u-nota">Al cerrar la sesión tendrás que volver a entrar con tu cuenta de Google.</p></div>';
  }

  /** Comprueba con el motor quién eres y qué ves; si ha cambiado, vuelve a pintar el marco. */
  function comprobar() {
    entrar().then(function (r) {
      var nuevo = credDe(r);
      nuevo.correo = nuevo.correo || cred.correo;
      if (JSON.stringify(nuevo) === JSON.stringify(cred)) return;
      guardar(nuevo);
      marco(nuevo);
    }, function (e) {
      if (e.acceso) { borrar(); acceso(String(e.message).replace(/^ACCESO:\s*/, '')); return; }
      if (/^CONECTAR:/.test(e.message)) { conectarYEntrar(e); return; }
      aviso('No se ha podido comprobar tu acceso: ' + String(e.message).replace(/^\w+:\s*/, ''));
    });
  }

  /* ---------- navegación ---------- */

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-sx]');
    if (!a || !cred || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    abrir(a.getAttribute('data-sx'), true);
  });
  window.addEventListener('popstate', function () { if (cred) abrir(pedida() || menu()[0].id, false); });

  /* ---------- arranque ---------- */

  function arrancar() {
    if (new URLSearchParams(location.search).get('salir') !== null) { borrar(); window.UG.salir(); history.replaceState(null, '', location.pathname); }
    var guardada = leer();
    if (guardada && guardada.persona && (window.UG.llave() || (window.UG.tieneSesion && window.UG.tieneSesion()))) {
      marco(guardada);  // al momento, con lo guardado
      comprobar();      // y por detrás, con el motor
    } else acceso('');
  }
  // Con la página ya leída: así, una sección que va en la misma página (después de este archivo) ya se ha registrado.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
