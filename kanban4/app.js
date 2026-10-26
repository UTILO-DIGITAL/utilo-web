/*
 * Kanban web de Utilo · parte común para todos los negocios · UTILO_CORE 4.0 (T0190)
 * Copia de kanban/app.js para la 4.0: se entra con la cuenta de Google y no con PIN (kanban4/google.js).
 * kanban/ sigue siendo la de los negocios con la librería KANBAN_CORE (PIN) hasta que pasen a la 4.0.
 * Cada negocio tiene su carpeta con un index.html que define window.KANBAN = { api, clave, google }
 * y carga google.js y este archivo. El kanban y la ficha los genera el motor del negocio (UTILO_CORE) y
 * aquí se pintan; google.script.run se sustituye por llamadas a la API con la llave de Google de la persona.
 * T0207: las secciones con módulo propio (economia.js, gestion.js, de Konamigas) están en kanban4/ y llaman con la
 * llave de Google (google.js · UG.seccion), que pide conectar su Excel dentro de la sección si falta.
 */
(function () {
  'use strict';
  var C = window.KANBAN || {};
  var CLAVE = 'kanban_' + (C.clave || 'negocio');
  // T0133: carpeta de este archivo (…/kanban/), para cargar los módulos de las secciones (economia.js…).
  var BASE = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^/]*$/, '') : '../kanban/'; })();
  var VERSION_MODULOS = '36'; // T0207 · T0208 · T0149 · T0213 · T0218 · T0224 · T0225 · T0230 · T0231 · T0232 · T0233 · T0228 · T0234 · T0235 · T0238 (también el ?v= de las hojas del tablero)
  var VERSION_ICONO = '2'; // T0222: el ?v= de los iconos del index.html de cada negocio (sube con ellos)
  // T0150: diseño de PROTOCOLO DISEÑO UTILO. Solo para los negocios que tienen su marca.css (index.html con marca: '…').
  // Los demás (Konamigas hasta T0149) siguen exactamente como antes.
  var MARCA = String(C.marca || '').replace(/[^a-z0-9_-]/gi, '');
  var RAIZ = BASE.replace(/kanban4?\/$/, '');
  // T0224: la web se ve como una app: ocupa toda la pantalla (viewport-fit=cover, para que env(safe-area-inset-*)
  // funcione en el iPhone) y sin zoom. Es el mismo que el de los index.html de cada negocio.
  var VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  // T0224: iOS no hace caso de user-scalable=no: el pellizco se quita aquí y el doble toque con touch-action (base.css).
  function sinZoom() {
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) {
      document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
    });
  }
  sinZoom();
  function linksEstilos() {
    if (!MARCA) return '';
    return '<link rel="stylesheet" href="' + RAIZ + MARCA + '/marca.css?v=' + VERSION_MODULOS + '">' +
      '<link rel="stylesheet" href="' + RAIZ + 'estilos/base.css?v=' + VERSION_MODULOS + '">';
  }
  function boton(txt, extra, tipo) { // T0150: botón con las clases de base.css (o el de siempre sin marca)
    return '<button' + (tipo ? ' type="' + tipo + '"' : '') + (MARCA ? ' class="u-btn' + (extra ? ' ' + extra : '') + '"' : '') + '>' + texto(txt) + '</button>';
  }

  function leer() { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; } }
  function guardar(o) { try { localStorage.setItem(CLAVE, JSON.stringify(o)); } catch (e) {} }
  function borrar() { try { localStorage.removeItem(CLAVE); } catch (e) {} }

  /** Llamada al motor con la llave de Google de la persona (google.js). */
  function llamar(cuerpo) { return window.UG.llamar(C.api, cuerpo); }

  /** Llamada sin llave: solo «inicio» (nombre y colores del negocio para la pantalla de entrada). */
  function llamarSinLlave(cuerpo) {
    return fetch(C.api, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo)
    }).then(function (r) {
      if (!r.ok) throw new Error('No hay conexión con el DAILY (' + r.status + ').');
      return r.json();
    }).then(function (o) {
      if (!o.ok) { var e = new Error(String(o.error || 'Error')); e.acceso = /^ACCESO:/.test(e.message); throw e; }
      return o.r;
    });
  }

  function $(id) { return document.getElementById(id); }
  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- pantalla de carga y de acceso ---------- */

  function pantalla(html) { document.body.innerHTML = '<div class="kz">' + html + '</div>'; }

  function cargando(msg) {
    pantalla('<div class="kz-caja' + (MARCA ? ' kz-centro' : '') + '" role="status"><div class="' + (MARCA ? 'u-carga' : 'kz-giro') + '"></div><p>' + texto(msg || 'Cargando…') + '</p></div>');
  }

  /** T0190: pantalla de entrada con «Entrar con Google». */
  function acceso(aviso) {
    cargando('Conectando…');
    llamarSinLlave({ fn: 'inicio' }).then(function (ini) {
      if (window.UG.configurar) window.UG.configurar(ini); // T0209: sesión larga si el motor la tiene
      var r = document.documentElement.style;
      if (ini.color) r.setProperty('--kz-color', ini.color);
      if (ini.accion) r.setProperty('--kz-accion', ini.accion);
      if (ini.fondo) r.setProperty('--kz-fondo', ini.fondo);
      if (ini.texto) r.setProperty('--kz-texto', ini.texto);
      document.title = ini.titulo || 'Kanban';
      var ant = leer() || {};
      pantalla('<div class="kz-caja" id="kz-form">' +
        '<h1>' + texto(ini.titulo || 'Kanban') + '</h1>' +
        '<p class="kz-ayuda">' + texto(ant.persona ? 'Hola, ' + ant.persona.split(' ')[0] + '. Vuelve a entrar con tu cuenta de Google.' :
          'Entra con la cuenta de Google con la que te han dado acceso.') + '</p>' +
        boton(ant.persona ? 'Continuar con Google' : 'Entrar con Google', 'u-btn-accion', 'button') +
        '<p class="kz-aviso" id="kz-aviso">' + texto(aviso || '') + '</p></div>');
      var b = $('kz-form').querySelector('button');
      b.onclick = function () {
        b.disabled = true; b.textContent = 'Entrando…';
        window.UG.entrar().then(function () { return llamar({ fn: 'entrar' }); }).then(function (r) {
          var cred = { persona: r.persona, correo: r.correo || '' };
          if (r && r.secciones) { cred.secciones = r.secciones; cred.perfil = r.perfil || ''; } // T0132: para pintar la barra al momento
          window.UG.recordarCorreo(r.correo || '');
          guardar(cred); abrir(cred);
        }, function (e) {
          if (/^CONECTAR:/.test(e.message)) { pedirConectar(e); return; } // T0201
          if (/^CREAR:/.test(e.message)) { pedirCrear(); return; } // T0191
          b.disabled = false; b.textContent = ant.persona ? 'Continuar con Google' : 'Entrar con Google';
          $('kz-aviso').textContent = e.message.replace(/^ACCESO:\s*/, '');
        });
      };
      b.focus();
    }, function (e) {
      pantalla('<div class="kz-caja"><p>' + texto(e.message) + '</p>' + boton('Volver a intentarlo').replace('<button', '<button onclick="location.reload()"') + '</div>');
    });
  }

  /* ---------- kanban o ficha ---------- */

  function puente(cred) {
    // Sustituye a google.script.run dentro de la página que genera el motor. T0190: con la llave de Google (google.js),
    // y sin pisar window.google, que es también donde está la librería de Google.
    return '(function(){var API=' + JSON.stringify(C.api) + ',K=' + JSON.stringify(CLAVE) + ';' +
      'function llamar(fn,args){return window.UG.llamar(API,{fn:fn,args:args}).catch(function(e){' +
      'if(e.acceso||/^(CONECTAR|CREAR):/.test(e.message)){if(e.acceso){try{localStorage.removeItem(K)}catch(x){}}location.reload();}throw e;});}' +
      'function run(s,f,u){return new Proxy({},{get:function(_,k){' +
      'if(k==="withSuccessHandler")return function(h){return run(h,f,u)};' +
      'if(k==="withFailureHandler")return function(h){return run(s,h,u)};' +
      'if(k==="withUserObject")return function(o){return run(s,f,o)};' +
      'return function(){var a=[].slice.call(arguments);llamar(k,a).then(function(r){if(s)s(r,u)},function(e){if(f)f(e,u);else console.error(e)});};}});}' +
      'window.google=window.google||{};window.google.script={run:run(null,null,undefined),host:{close:function(){history.back()}}};})();';
  }

  function cabecera(cred) {
    return '<meta charset="utf-8"><meta name="viewport" content="' + VIEWPORT + '">' +
      '<script>(' + sinZoom + ')();<\/script>' + // T0224: document.open() quita los escuchadores de la página anterior
      // T0222: el icono que guarda el iPhone al «Añadir a pantalla de inicio» es el de esta cabecera (sustituye a la del index.html)
      '<link rel="manifest" href="manifest.webmanifest?v=' + VERSION_ICONO + '"><link rel="apple-touch-icon" href="icono-180.png?v=' + VERSION_ICONO + '">' +
      '<link rel="icon" href="icono-192.png?v=' + VERSION_ICONO + '"><meta name="apple-mobile-web-app-capable" content="yes">' +
      '<meta name="mobile-web-app-capable" content="yes"><meta name="theme-color" content="' + texto(C.color || '#ffffff') + '">' +
      '<meta name="apple-mobile-web-app-title" content="' + texto(C.nombreApp || 'Kanban') + '">' +
      '<script>window.KANBAN=' + JSON.stringify(C).replace(/</g, '\\u003c') + ';<\/script>' +
      '<script src="' + texto(BASE + 'google.js?v=' + VERSION_MODULOS) + '"><\/script>' + // T0190: la llave de Google
      '<script>' + puente(cred) + '<\/script>' + linksEstilos();
  }

  /* ---------- secciones (T0132) ----------
   * Cada persona ve las secciones de su perfil (KANBAN_CORE v25, CONFIG · SECCIONES_WEB).
   * La sección va en la URL: ?s=kanban, ?s=gestion… Sin ?s se abre el tablero.
   * La barra va abajo, como en una app (arriba en pantallas anchas), y siempre acaba en Perfil:
   * quién eres y cerrar sesión; ahí irán tus partidos, tus tareas y lo que tienes pendiente de cobrar.
   * Sin perfil (negocios sin SECCIONES_WEB) no sale la barra: todo como antes.
   * El KANBAN lo genera el DAILY; las demás, por ahora, enseñan que están en preparación.
   * v2: cambiar de sección NO recarga la página. El tablero se carga una vez y las secciones se
   * enseñan u ocultan dentro de la misma página. Las secciones de la persona se guardan con su
   * sesión en el dispositivo para abrir otra sección al momento; el servidor sigue comprobando
   * el perfil en cada llamada que pide datos. */

  var SECCIONES = {
    KANBAN: { t: 'Kanban', i: '📋' },
    GESTION: { t: 'Gestión', i: '🗂️', js: 'gestion.js' }, // T0139: sección con módulo propio (equipos, jugadoras y, desde T0234, camisetas)
    ECONOMIA: { t: 'Economía', i: '💶', js: 'economia.js' }, // T0133: sección con módulo propio
    LIGAS: { t: 'Ligas', i: '⚽' },
    // T0218: la Bandeja de Utilo es una sección, pero vive dentro de la página del tablero (la pinta el motor):
    // la barra solo le dice al tablero qué enseñar (window.SX_TABLERO, BANDEJA_WEB.js del motor).
    BANDEJA: { t: 'Bandeja', i: '📥', tablero: true },
    PERFIL: { t: 'Perfil', i: '👤' }
  };

  function infoSeccion(s) {
    return SECCIONES[s] || { t: s.charAt(0) + s.slice(1).toLowerCase(), i: '•' };
  }

  /* T0150: iconos de la barra en SVG (mismo trazo y tamaño), en lugar de emojis. Solo con marca. */
  var ICONOS = {
    KANBAN: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
    GESTION: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    ECONOMIA: '<path d="M17 6.5A7 7 0 1 0 17 17.5"/><path d="M4 10.5h9M4 13.5h9"/>',
    LIGAS: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M9 20h6"/>',
    BANDEJA: '<path d="M4 13l2.5-7.5A2 2 0 0 1 8.4 4h7.2a2 2 0 0 1 1.9 1.5L20 13"/><path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5h-5l-1 2h-4l-1-2z"/>',
    PERFIL: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"/>'
  };
  function icono(s) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONOS[s] || '<circle cx="12" cy="12" r="3"/>') + '</svg>';
  }

  function seccionPedida() {
    return String(new URLSearchParams(location.search).get('s') || '').trim().toUpperCase();
  }

  function urlSeccion(s) { return location.pathname + '?s=' + encodeURIComponent(s.toLowerCase()); }

  function mismas(a, b) { return (a || []).join(',') === (b || []).join(','); }

  /** Secciones de la barra: las del perfil y, al final, Perfil (la de cada persona, para todos). */
  function seccionesBarra(secs, perfil) {
    if (!perfil || !secs || !secs.length) return [];
    return secs.filter(function (s) { return s !== 'PERFIL'; }).concat(['PERFIL']);
  }

  /** Perfil: quién eres y cerrar sesión. Aquí irán tus partidos, tus tareas y lo que tienes pendiente de cobrar. */
  function htmlPerfil(cred) {
    var color = C.color || '#0E8A7A', accion = C.accion || '#FF5A3C';
    var ini = String(cred.persona || '?').split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
    var pronto = ['⚽ Tus partidos', '📋 Un resumen de tus tareas', '💶 Lo que tienes pendiente de cobrar'];
    return '<header style="background:' + texto(color) + ';color:#fff;padding:14px 18px"><h1 style="margin:0;font-size:24px;letter-spacing:.5px;color:#fff">PERFIL</h1></header>' +
      '<main style="padding:24px 18px;display:flex;justify-content:center"><div style="width:100%;max-width:420px">' +
      '<div style="display:flex;align-items:center;gap:14px">' +
      '<div aria-hidden="true" style="width:56px;height:56px;border-radius:50%;background:' + texto(color) + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">' + texto(ini) + '</div>' +
      '<div><div style="font-size:19px;font-weight:700">' + texto(cred.persona || '') + '</div>' +
      (cred.perfil ? '<div style="opacity:.75;margin-top:2px">' + texto(cred.perfil) + '</div>' : '') + '</div></div>' +
      '<div style="margin-top:22px;padding:14px 16px;border-radius:12px;background:#f4f4f8">' +
      '<div style="font-weight:700;margin-bottom:8px">Muy pronto, aquí tendrás:</div>' +
      pronto.map(function (p) { return '<div style="padding:4px 0">' + texto(p) + '</div>'; }).join('') + '</div>' +
      '<a href="' + texto(location.pathname + '?salir') + '" target="_top" style="display:block;margin-top:24px;padding:13px;border-radius:10px;' +
      'border:1.5px solid ' + texto(accion) + ';color:' + texto(accion) + ';text-align:center;font-weight:700;text-decoration:none">Cerrar sesión</a>' +
      '</div></main>';
  }

  /** T0150: Perfil con el diseño común. Sin promesas de lo que vendrá: solo quién eres y cerrar sesión. */
  function htmlPerfilU(cred) {
    return '<div class="u"><header class="u-cab"><h1>Perfil</h1></header><main class="u-main u-perfil">' +
      '<div class="u-perfil-quien"><strong>' + texto(cred.persona || '') + '</strong>' +
      (cred.perfil ? '<span>' + texto(cred.perfil) + '</span>' : '') + '</div>' +
      '<dl><dt>Aplicación</dt><dd>' + texto(C.nombreApp || 'Kanban') + '</dd>' +
      '<dt>Dispositivo</dt><dd>Sesión guardada en este dispositivo</dd></dl>' +
      '<a class="u-btn" href="' + texto(location.pathname + '?salir') + '" target="_top">Cerrar sesión</a>' +
      '<p class="u-nota">Al cerrar la sesión tendrás que volver a entrar con tu cuenta de Google.</p>' +
      '</main></div>';
  }

  /** Contenido de una sección que aún no está hecha. */
  function htmlSeccion(s, cred) {
    if (s === 'PERFIL') return MARCA ? htmlPerfilU(cred || {}) : htmlPerfil(cred || {});
    if (MARCA && !infoSeccion(s).js) {
      return '<div class="u"><header class="u-cab"><h1>' + texto(infoSeccion(s).t) + '</h1></header><main class="u-main">' +
        '<p><strong>Esta sección todavía no está lista.</strong></p>' +
        '<p class="u-nota">Mientras tanto, lo que necesites de aquí pídelo desde el tablero.</p></main></div>';
    }
    if (infoSeccion(s).js) return '<div data-sx-mod="' + texto(s) + '">' + (MARCA ? '<div class="kz-caja kz-centro" role="status" style="margin:48px auto"><div class="u-carga"></div><p>Cargando…</p></div>' : // T0149
      '<div style="padding:60px 18px;text-align:center;opacity:.7">Cargando…</div>') + '</div>';
    var f = infoSeccion(s), color = C.color || '#0E8A7A';
    return '<header style="background:' + texto(color) + ';color:#fff;padding:14px 18px"><h1 style="margin:0;font-size:24px;letter-spacing:.5px;color:#fff">' +
      texto(f.t.toUpperCase()) + '</h1></header>' +
      '<main style="padding:28px 18px;display:flex;justify-content:center"><div style="max-width:420px;text-align:center">' +
      '<div style="font-size:44px" aria-hidden="true">' + f.i + '</div>' +
      '<p style="font-size:17px;font-weight:700;margin:10px 0 6px">Esta sección está en preparación.</p>' +
      '<p style="margin:0;opacity:.75">Cuando esté lista, la tendrás aquí mismo.</p></div></main>';
  }

  function cssBarra() {
    var color = C.color || '#0E8A7A', accion = C.accion || '#FF5A3C';
    // Abajo, como en una app (móvil y tableta). En pantallas anchas, arriba y en fila.
    return '.sx{position:fixed;left:0;right:0;bottom:0;z-index:45;background:#fff;border-top:1px solid #e3e3ee;' +
      'padding-bottom:env(safe-area-inset-bottom,0px);box-shadow:0 -2px 10px rgba(0,0,0,.06);' +
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}' +
      '.sx-in{display:flex;align-items:stretch;max-width:640px;margin:0 auto}' +
      '.sx a{flex:1 1 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:58px;' +
      'padding:6px 2px 5px;text-decoration:none;color:' + color + ';opacity:.6;font-size:11.5px;font-weight:700;border-top:3px solid transparent}' +
      '.sx a[aria-current=page]{opacity:1;border-top-color:' + accion + '}' +
      '.sx a:focus-visible{outline:3px solid ' + color + ';outline-offset:-3px}' +
      '.sx .sx-i{font-size:21px;line-height:1}' +
      'body{padding-bottom:calc(62px + env(safe-area-inset-bottom,0px))!important}' +
      '#alta-btn{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}' +
      '#alta-aviso,#estado-aviso{bottom:calc(140px + env(safe-area-inset-bottom,0px))!important}' +
      '#sx-panel{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1A1A40}' +
      // T0135: las ventanas de versión y de «Pedir algo a Utilo» del kanban se pueden abrir desde cualquier sección.
      'body.sx-otra>*:not(.sx):not(#sx-panel):not(script):not(style):not(.ver-velo):not(.sol-velo):not(.picker-dialog):not(.picker-dialog-bg){display:none!important}' + // T0208: ventana de Google
      '@media(min-width:900px){.sx{position:sticky;top:0;bottom:auto;border-top:0;border-bottom:1px solid #e3e3ee;box-shadow:none;padding-bottom:0}' +
      '.sx-in{max-width:none;margin:0;padding:0 10px;gap:2px}' +
      '.sx a{flex:0 0 auto;flex-direction:row;gap:7px;min-height:46px;padding:0 14px;font-size:14px;border-top:0;border-bottom:3px solid transparent}' +
      '.sx a[aria-current=page]{border-bottom-color:' + accion + '}.sx a[data-sx=PERFIL]{margin-left:auto}.sx .sx-i{font-size:17px}' +
      'body{padding-bottom:0!important}#alta-btn{bottom:20px!important}#alta-aviso,#estado-aviso{bottom:84px!important}}';
  }

  /* T0225: menú del ordenador plegado (clase u-menu-plegado del body), guardado en el dispositivo. MENU_INICIO lo aplica al
   * pintar la página del tablero; pintarSeccion, que no ejecuta scripts, lo aplica con menuPlegado(). */
  var MENU_CLAVE = 'kanbanMenuPlegado';
  var MENU_PLEGAR = "var p=document.body.classList.toggle('u-menu-plegado');this.setAttribute('aria-label',p?'Desplegar el menú':'Plegar el menú');" +
    "this.title=this.getAttribute('aria-label');try{if(p)localStorage.setItem('" + MENU_CLAVE + "','1');else localStorage.removeItem('" + MENU_CLAVE + "');}catch(e){}";
  var MENU_INICIO = "try{if(localStorage.getItem('" + MENU_CLAVE + "')==='1'){document.body.classList.add('u-menu-plegado');var b=document.querySelector('.sx-plegar');" +
    "if(b){b.setAttribute('aria-label','Desplegar el menú');b.title='Desplegar el menú';}}}catch(e){}";
  function menuPlegado() { try { new Function(MENU_INICIO)(); } catch (e) {} }

  function barra(secs, actual, cred) {
    if (!secs || secs.length < 2) return '';
    if (MARCA) { // T0150: estilos en estilos/base.css, iconos SVG
      // T0225: en el ordenador es un menú a la izquierda, con el nombre de la app arriba y quién ha entrado en Perfil (en el móvil no salen)
      // El menú se pliega a una franja con los iconos (botón «Plegar el menú»); cada dispositivo recuerda cómo se dejó.
      var quien = cred && cred.persona ? '<span class="sx-quien">' + texto(cred.persona) + '</span>' : '';
      return '<nav class="sx u-sx" aria-label="Secciones"><div class="sx-in"><div class="sx-cab"><span class="sx-marca">' + texto(C.nombreApp || '') + '</span>' +
        '<button type="button" class="sx-plegar" onclick="' + MENU_PLEGAR + '" aria-label="Plegar el menú" title="Plegar el menú">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button></div>' + secs.map(function (s) {
        return '<a href="' + texto(urlSeccion(s)) + '" target="_top" data-sx="' + texto(s) + '" title="' + texto(infoSeccion(s).t) + '"' + (s === actual ? ' aria-current="page"' : '') + '>' +
          icono(s) + '<span>' + texto(infoSeccion(s).t) + (s === 'PERFIL' ? quien : '') + '</span></a>';
      }).join('') + '</div></nav><script>' + MENU_INICIO + '<\/script>';
    }
    var as = secs.map(function (s) {
      var f = infoSeccion(s);
      return '<a href="' + texto(urlSeccion(s)) + '" target="_top" data-sx="' + texto(s) + '"' + (s === actual ? ' aria-current="page"' : '') + '>' +
        '<span class="sx-i" aria-hidden="true">' + f.i + '</span><span>' + texto(f.t) + '</span></a>';
    }).join('');
    return '<style>' + cssBarra() + '</style><nav class="sx" aria-label="Secciones"><div class="sx-in">' + as + '</div></nav>';
  }

  /** T0133: datos que necesitan los módulos de sección (economia.js…) para llamar a la API. */
  function ctxModulos(cred) {
    return { api: C.api, persona: cred.persona, clave: CLAVE, color: C.color || '', accion: C.accion || '' }; // T0190: sin PIN · T0207: la llave la pone google.js
  }

  /** T0133: scripts de los módulos de las secciones de la persona (se cargan una vez). */
  function scriptsModulos(secs, cred) {
    var js = secs.map(function (s) { return infoSeccion(s).js; }).filter(Boolean);
    if (!js.length) return '';
    return '<script>window.SX_CTX=' + JSON.stringify(ctxModulos(cred)).replace(/</g, '\\u003c') + ';<\/script>' +
      js.map(function (f) { return '<script src="' + texto(BASE + f + '?v=' + VERSION_MODULOS) + '"><\/script>'; }).join('');
  }

  /** T0133: pinta el módulo de una sección dentro del panel, cuando su script ya está cargado. */
  function abrirModulo(panel) {
    var el = panel && panel.querySelector('[data-sx-mod]');
    if (!el) return;
    var s = el.getAttribute('data-sx-mod'), M = window.SX_MOD || {};
    if (M[s]) { M[s].abrir(el); return; }
    var f = infoSeccion(s).js;
    var sc = document.createElement('script');
    sc.src = BASE + f + '?v=' + VERSION_MODULOS;
    sc.onload = function () { if ((window.SX_MOD || {})[s] && document.body.contains(el)) window.SX_MOD[s].abrir(el); };
    sc.onerror = function () { el.innerHTML = '<p style="padding:40px 18px;text-align:center">No se ha podido cargar la sección. Comprueba la conexión y vuelve a entrar.</p>'; };
    document.head.appendChild(sc);
  }

  /** Script que va dentro de la página del tablero: cambia de sección sin recargar. */
  function scriptBarra(secs, cred) {
    var P = {}, T = {}, TB = { KANBAN: 1 };
    secs.forEach(function (s) {
      T[s] = infoSeccion(s).t;
      if (infoSeccion(s).tablero) TB[s] = 1; // T0218: sección dentro del tablero (la Bandeja)
      else if (s !== 'KANBAN') P[s] = htmlSeccion(s, cred);
    });
    return scriptsModulos(secs, cred) + '<script>(function(){var P=' + JSON.stringify(P).replace(/</g, '\\u003c') + ',T=' + JSON.stringify(T) + ',TB=' + JSON.stringify(TB) +
      ',N=' + JSON.stringify(C.nombreApp || 'App') + ',K0="";' +
      'function ir(s,push){var nav=document.querySelector(".sx"),p=document.getElementById("sx-panel");if(!nav||!p)return;' +
      'if(!document.body.classList.contains("sx-otra"))K0=document.title;' +
      '[].forEach.call(nav.querySelectorAll("a[data-sx]"),function(a){if(a.getAttribute("data-sx")===s)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});' +
      'if(!P[s]){document.body.classList.remove("sx-otra");p.innerHTML="";if(K0)document.title=K0;if(window.SX_TABLERO)window.SX_TABLERO(s);}' +
      'else{p.innerHTML=P[s];document.body.classList.add("sx-otra");document.title=T[s]+" · "+N;' +
      'var m=p.querySelector("[data-sx-mod]");if(m){var k=m.getAttribute("data-sx-mod"),X=window.SX_MOD||{};' +
      'if(X[k])X[k].abrir(m);else{var t=setInterval(function(){if((window.SX_MOD||{})[k]&&document.body.contains(m)){clearInterval(t);window.SX_MOD[k].abrir(m);}},100);setTimeout(function(){clearInterval(t);},15000);}}}' +
      'window.scrollTo(0,0);document.body.scrollTop=0;if(push)history.pushState({sx:s},"",location.pathname+"?s="+s.toLowerCase());}' +
      'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[data-sx]");' +
      'if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;e.preventDefault();ir(a.getAttribute("data-sx"),true);});' +
      'window.addEventListener("popstate",function(){var s=(new URLSearchParams(location.search).get("s")||"KANBAN").toUpperCase();ir(P[s]||TB[s]?s:"KANBAN",false);});' +
      'var s0=(new URLSearchParams(location.search).get("s")||"").toUpperCase();if(P[s0]||(TB[s0]&&s0!=="KANBAN"))ir(s0,false);' +
      '})();<\/script>';
  }

  /** Página suelta de una sección (cuando se abre directamente con ?s=…, sin pasar por el tablero). */
  function pintarSeccion(cred, secs, s) {
    document.title = infoSeccion(s).t + ' · ' + (C.nombreApp || 'App');
    if (MARCA) document.body.className = 'u u-con-barra'; // T0150
    document.body.innerHTML = barra(seccionesBarra(secs, cred.perfil), s, cred) + '<div id="sx-panel">' + htmlSeccion(s, cred) + '</div>';
    menuPlegado(); // T0225
    window.SX_CTX = ctxModulos(cred); // T0133
    abrirModulo(document.getElementById('sx-panel'));
  }

  /** T0201: la persona aún no ha conectado el Excel del negocio con la web (permiso «solo los archivos de esta web»). */
  function pedirConectar(e) {
    var m = /^CONECTAR:([^:]+):\s*(.*)$/.exec(e.message) || [];
    pantalla('<div class="kz-caja" id="kz-con"><h1>' + texto(C.nombreApp || 'Kanban') + '</h1>' +
      '<p class="kz-ayuda">' + texto('Para que la web pueda usar el Excel del negocio, elígelo una vez en la ventana de Google. Solo hace falta la primera vez.') + '</p>' +
      boton('Conectar el Excel', 'u-btn-accion', 'button') + '<p class="kz-aviso" id="kz-aviso"></p></div>');
    var b = $('kz-con').querySelector('button');
    b.onclick = function () {
      b.disabled = true;
      window.UG.conectar(m[1]).then(function () { location.reload(); }, function (x) {
        b.disabled = false; $('kz-aviso').textContent = x.message;
      });
    };
    b.focus();
  }

  /** T0191: el negocio aún no tiene su Excel y ha entrado quien administra: la web lo crea en su Drive. */
  function pedirCrear() {
    pantalla('<div class="kz-caja" id="kz-crear"><h1>' + texto(C.nombreApp || 'Kanban') + '</h1>' +
      '<p class="kz-ayuda">' + texto('Todavía no hay Excel del negocio. La web lo crea ahora en tu Google Drive, en «Mi unidad». Después puedes moverlo a la carpeta que quieras y compartirlo con tu equipo.') + '</p>' +
      boton('Crear el Excel', 'u-btn-accion', 'button') + '<p class="kz-aviso" id="kz-aviso"></p></div>');
    var b = $('kz-crear').querySelector('button');
    b.onclick = function () {
      b.disabled = true; b.textContent = 'Creando el Excel…';
      llamar({ fn: 'crearExcel' }).then(function () { location.reload(); }, function (x) {
        b.disabled = false; b.textContent = 'Crear el Excel'; $('kz-aviso').textContent = x.message.replace(/^ACCESO:\s*/, '');
      });
    };
    b.focus();
  }

  function error(e) {
    if (/^CREAR:/.test(e.message)) { pedirCrear(); return; }
    if (/^CONECTAR:/.test(e.message)) { pedirConectar(e); return; }
    if (e.acceso) { borrar(); acceso(e.message.replace(/^ACCESO:\s*/, '')); return; }
    pantalla('<div class="kz-caja"><p>' + texto(e.message.replace(/^SECCION:\s*/, '')) +
      '</p>' + boton('Volver a intentarlo').replace('<button', '<button onclick="location.reload()"') + '</div>');
  }

  /** Guarda en el dispositivo las secciones de la persona (para pintar la barra al momento). */
  function recordarSecciones(cred, secs, perfil) {
    if (!secs || (mismas(cred.secciones, secs) && (cred.perfil || '') === (perfil || ''))) return;
    cred.secciones = secs.slice();
    cred.perfil = perfil || '';
    guardar(cred);
  }

  function abrir(cred) {
    var id = new URLSearchParams(location.search).get('id') || '';
    var pedida = seccionPedida();
    // T0135: con KANBAN en el perfil, una sección abierta directamente (?s=economia) también carga el tablero por
    // debajo, para tener la versión y «Pedir algo a Utilo» en todas las secciones (el tablero abre la sección de la URL).
    var conKanban = (cred.secciones || []).indexOf('KANBAN') >= 0;
    if (!id && pedida && pedida !== 'KANBAN' && !conKanban) {
      // Otra sección abierta directamente: si ya sabemos sus secciones, se pinta al momento
      // y se comprueba con el servidor por detrás.
      var permitida = function (secs, perfil) { return seccionesBarra(secs, perfil).indexOf(pedida) >= 0; };
      var conocidas = permitida(cred.secciones, cred.perfil);
      if (conocidas) pintarSeccion(cred, cred.secciones, pedida); else cargando('Cargando…');
      llamar({ fn: 'entrar' }).then(function (r) {
        var secs = r.secciones || ['KANBAN'];
        var cambian = !mismas(cred.secciones, secs) || (cred.perfil || '') !== (r.perfil || '');
        recordarSecciones(cred, secs, r.perfil);
        if (!permitida(secs, r.perfil)) { location.replace(urlSeccion(secs[0])); return; }
        if (!conocidas || cambian) pintarSeccion(cred, secs, pedida);
      }, error);
      return;
    }
    cargando(pedida && pedida !== 'KANBAN' ? 'Cargando…' : 'Cargando el kanban…');
    llamar({ fn: 'pagina', id: id }).then(function (p) {
      recordarSecciones(cred, p.secciones, p.perfil);
      // T0224: fuera el viewport del motor, que no lleva viewport-fit=cover: manda el de la cabecera.
      var html = String(p.html || '').replace(/<meta[^>]*name=["']?viewport["']?[^>]*>/gi, '');
      // T0225: las hojas de estilos (marca.css, base.css, kanban.css) son de utilo-web: el motor las pide con su versión (?v=KC_VERSION),
      // que no cambia al cambiar los estilos, y el navegador se quedaba con las de antes. Se piden con la versión de este archivo.
      html = html.replace(/(\/(?:marca|base|kanban)\.css)\?v=[\w.-]+/g, '$1?v=' + VERSION_MODULOS);
      var cab = cabecera(cred);
      if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, function (m) { return m + cab; });
      else html = '<!DOCTYPE html><html><head>' + cab + '</head><body>' + html + '</body></html>';
      if (!/<!DOCTYPE/i.test(html)) html = '<!DOCTYPE html>' + html;
      if (!id) { // T0132: barra de secciones encima del tablero (solo si la persona tiene más de una)
        var sb = seccionesBarra(p.secciones, p.perfil);
        var nav = barra(sb, 'KANBAN', cred);
        if (nav) {
          html = html.replace(/<body[^>]*>/i, function (m) {
            if (MARCA) m = /class="/i.test(m) ? m.replace(/class="/i, 'class="u-con-barra ') : m.replace(/>$/, ' class="u-con-barra">'); // T0150
            return m + nav + '<div id="sx-panel"></div>';
          });
          var sc = scriptBarra(sb, cred);
          if (/<\/body>/i.test(html)) html = html.replace(/<\/body>(?![\s\S]*<\/body>)/i, function (m) { return sc + m; });
          else html += sc;
        }
      }
      document.open();
      document.write(html);
      document.close();
      if (p.titulo) document.title = p.titulo;
    }, function (e) {
      if (/^SECCION:/.test(e.message) && !id) {
        // Sin KANBAN en su perfil: se va a su primera sección.
        llamar({ fn: 'entrar' }).then(function (r) {
          var secs = r.secciones || [];
          recordarSecciones(cred, secs, r.perfil);
          if (secs.length && secs[0] !== 'KANBAN') location.replace(urlSeccion(secs[0])); else error(e);
        }, error);
        return;
      }
      error(e);
    });
  }

  /* ---------- arranque ---------- */
  if (new URLSearchParams(location.search).get('salir') !== null) { borrar(); window.UG.salir(); history.replaceState(null, '', location.pathname); }
  var cred = leer();
  // T0190: sin llave válida, «Continuar con Google». T0209: con sesión larga en el dispositivo, la llave se renueva sola.
  if (cred && cred.persona && window.UG.llave()) abrir(cred);
  else if (cred && cred.persona && window.UG.tieneSesion && window.UG.tieneSesion()) {
    cargando('Entrando…');
    window.UG.asegurar().then(function () { abrir(cred); }, function () { acceso(''); });
  } else acceso('');
})();
