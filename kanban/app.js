/*
 * Kanban web de Utilo · parte común para todos los negocios.
 * Cada negocio tiene su carpeta con un index.html que define window.KANBAN = { api, clave }
 * y carga este archivo. El kanban y la ficha los genera su DAILY (librería KANBAN_CORE) y
 * aquí se pintan; google.script.run se sustituye por llamadas a la API con persona + PIN.
 */
(function () {
  'use strict';
  var C = window.KANBAN || {};
  var CLAVE = 'kanban_' + (C.clave || 'negocio');
  // T0133: carpeta de este archivo (…/kanban/), para cargar los módulos de las secciones (economia.js…).
  var BASE = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^/]*$/, '') : '../kanban/'; })();
  var VERSION_MODULOS = '12';

  function leer() { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; } }
  function guardar(o) { try { localStorage.setItem(CLAVE, JSON.stringify(o)); } catch (e) {} }
  function borrar() { try { localStorage.removeItem(CLAVE); } catch (e) {} }

  function llamar(cuerpo) {
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

  function cargando(msg) { pantalla('<div class="kz-caja"><div class="kz-giro"></div><p>' + texto(msg || 'Cargando…') + '</p></div>'); }

  function acceso(aviso) {
    cargando('Conectando…');
    llamar({ fn: 'inicio' }).then(function (ini) {
      var r = document.documentElement.style;
      if (ini.color) r.setProperty('--kz-color', ini.color);
      if (ini.accion) r.setProperty('--kz-accion', ini.accion);
      if (ini.fondo) r.setProperty('--kz-fondo', ini.fondo);
      if (ini.texto) r.setProperty('--kz-texto', ini.texto);
      document.title = ini.titulo || 'Kanban';
      var ant = leer() || {};
      var ops = (ini.personas || []).map(function (p) {
        return '<option' + (p === ant.persona ? ' selected' : '') + '>' + texto(p) + '</option>';
      }).join('');
      pantalla('<form class="kz-caja" id="kz-form" autocomplete="off">' +
        '<h1>' + texto(ini.titulo || 'Kanban') + '</h1>' +
        (ops ? '<label>¿Quién eres?<select id="kz-persona">' + ops + '</select></label>' +
          '<label>PIN<input id="kz-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password"></label>' +
          '<button type="submit">Entrar</button>' +
          '<p class="kz-ayuda">' + texto('¿Has olvidado el PIN? Habla con un administrador para que te ponga uno nuevo.') + '</p>'
          : '<p>Todavía nadie tiene PIN. Ponlo en la pestaña ACCESOS del DAILY.</p>') +
        '<p class="kz-aviso" id="kz-aviso">' + texto(aviso || '') + '</p></form>');
      var f = $('kz-form');
      if (!ops) return;
      $('kz-pin').focus();
      f.onsubmit = function (ev) {
        ev.preventDefault();
        var cred = { persona: $('kz-persona').value, pin: $('kz-pin').value.trim() };
        var b = f.querySelector('button'); b.disabled = true; b.textContent = 'Entrando…';
        llamar({ fn: 'entrar', persona: cred.persona, pin: cred.pin }).then(function (r) {
          if (r && r.secciones) { cred.secciones = r.secciones; cred.perfil = r.perfil || ''; } // T0132: para pintar la barra al momento
          guardar(cred); abrir(cred);
        }, function (e) {
          b.disabled = false; b.textContent = 'Entrar';
          $('kz-aviso').textContent = e.message.replace(/^ACCESO:\s*/, '');
          $('kz-pin').value = ''; $('kz-pin').focus();
        });
      };
    }, function (e) {
      pantalla('<div class="kz-caja"><p>' + texto(e.message) + '</p><button onclick="location.reload()">Reintentar</button></div>');
    });
  }

  /* ---------- kanban o ficha ---------- */

  function puente(cred) {
    // Sustituye a google.script.run dentro de la página que genera el DAILY.
    return '(function(){var API=' + JSON.stringify(C.api) + ',P=' + JSON.stringify(cred.persona) +
      ',N=' + JSON.stringify(cred.pin) + ',K=' + JSON.stringify(CLAVE) + ';' +
      'function llamar(fn,args){return fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},' +
      'body:JSON.stringify({fn:fn,args:args,persona:P,pin:N})}).then(function(r){if(!r.ok)throw new Error("No hay conexión con el DAILY ("+r.status+").");return r.json();})' +
      '.then(function(o){if(!o.ok){if(/^ACCESO:/.test(o.error)){try{localStorage.removeItem(K)}catch(e){}location.reload();}throw new Error(o.error);}return o.r;});}' +
      'function run(s,f,u){return new Proxy({},{get:function(_,k){' +
      'if(k==="withSuccessHandler")return function(h){return run(h,f,u)};' +
      'if(k==="withFailureHandler")return function(h){return run(s,h,u)};' +
      'if(k==="withUserObject")return function(o){return run(s,f,o)};' +
      'return function(){var a=[].slice.call(arguments);llamar(k,a).then(function(r){if(s)s(r,u)},function(e){if(f)f(e,u);else console.error(e)});};}});}' +
      'window.google={script:{run:run(null,null,undefined),host:{close:function(){history.back()}}}};})();';
  }

  function cabecera(cred) {
    return '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icono-180.png">' +
      '<link rel="icon" href="icono-192.png"><meta name="apple-mobile-web-app-capable" content="yes">' +
      '<meta name="mobile-web-app-capable" content="yes"><meta name="theme-color" content="' + texto(C.color || '#ffffff') + '">' +
      '<meta name="apple-mobile-web-app-title" content="' + texto(C.nombreApp || 'Kanban') + '">' +
      '<script>' + puente(cred) + '<\/script>';
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
    GESTION: { t: 'Gestión', i: '🗂️', js: 'gestion.js' }, // T0139: sección con módulo propio (equipos y jugadoras)
    ECONOMIA: { t: 'Economía', i: '💶', js: 'economia.js' }, // T0133: sección con módulo propio
    LIGAS: { t: 'Ligas', i: '⚽' },
    PERFIL: { t: 'Perfil', i: '👤' }
  };

  function infoSeccion(s) {
    return SECCIONES[s] || { t: s.charAt(0) + s.slice(1).toLowerCase(), i: '•' };
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

  /** Contenido de una sección que aún no está hecha. */
  function htmlSeccion(s, cred) {
    if (s === 'PERFIL') return htmlPerfil(cred || {});
    if (infoSeccion(s).js) return '<div data-sx-mod="' + texto(s) + '"><div style="padding:60px 18px;text-align:center;opacity:.7">Cargando…</div></div>';
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
      'body.sx-otra>*:not(.sx):not(#sx-panel):not(script):not(style):not(.ver-velo):not(.sol-velo){display:none!important}' +
      '@media(min-width:900px){.sx{position:sticky;top:0;bottom:auto;border-top:0;border-bottom:1px solid #e3e3ee;box-shadow:none;padding-bottom:0}' +
      '.sx-in{max-width:none;margin:0;padding:0 10px;gap:2px}' +
      '.sx a{flex:0 0 auto;flex-direction:row;gap:7px;min-height:46px;padding:0 14px;font-size:14px;border-top:0;border-bottom:3px solid transparent}' +
      '.sx a[aria-current=page]{border-bottom-color:' + accion + '}.sx a[data-sx=PERFIL]{margin-left:auto}.sx .sx-i{font-size:17px}' +
      'body{padding-bottom:0!important}#alta-btn{bottom:20px!important}#alta-aviso,#estado-aviso{bottom:84px!important}}';
  }

  function barra(secs, actual) {
    if (!secs || secs.length < 2) return '';
    var as = secs.map(function (s) {
      var f = infoSeccion(s);
      return '<a href="' + texto(urlSeccion(s)) + '" target="_top" data-sx="' + texto(s) + '"' + (s === actual ? ' aria-current="page"' : '') + '>' +
        '<span class="sx-i" aria-hidden="true">' + f.i + '</span><span>' + texto(f.t) + '</span></a>';
    }).join('');
    return '<style>' + cssBarra() + '</style><nav class="sx" aria-label="Secciones"><div class="sx-in">' + as + '</div></nav>';
  }

  /** T0133: datos que necesitan los módulos de sección (economia.js…) para llamar a la API. */
  function ctxModulos(cred) {
    return { api: C.api, persona: cred.persona, pin: cred.pin, clave: CLAVE, color: C.color || '', accion: C.accion || '' };
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
    var P = {}, T = {};
    secs.forEach(function (s) { T[s] = infoSeccion(s).t; if (s !== 'KANBAN') P[s] = htmlSeccion(s, cred); });
    return scriptsModulos(secs, cred) + '<script>(function(){var P=' + JSON.stringify(P).replace(/</g, '\\u003c') + ',T=' + JSON.stringify(T) +
      ',N=' + JSON.stringify(C.nombreApp || 'App') + ',K0="";' +
      'function ir(s,push){var nav=document.querySelector(".sx"),p=document.getElementById("sx-panel");if(!nav||!p)return;' +
      'if(!document.body.classList.contains("sx-otra"))K0=document.title;' +
      '[].forEach.call(nav.querySelectorAll("a[data-sx]"),function(a){if(a.getAttribute("data-sx")===s)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});' +
      'if(!P[s]){document.body.classList.remove("sx-otra");p.innerHTML="";if(K0)document.title=K0;}' +
      'else{p.innerHTML=P[s];document.body.classList.add("sx-otra");document.title=T[s]+" · "+N;' +
      'var m=p.querySelector("[data-sx-mod]");if(m){var k=m.getAttribute("data-sx-mod"),X=window.SX_MOD||{};' +
      'if(X[k])X[k].abrir(m);else{var t=setInterval(function(){if((window.SX_MOD||{})[k]&&document.body.contains(m)){clearInterval(t);window.SX_MOD[k].abrir(m);}},100);setTimeout(function(){clearInterval(t);},15000);}}}' +
      'window.scrollTo(0,0);if(push)history.pushState({sx:s},"",location.pathname+"?s="+s.toLowerCase());}' +
      'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[data-sx]");' +
      'if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;e.preventDefault();ir(a.getAttribute("data-sx"),true);});' +
      'window.addEventListener("popstate",function(){var s=(new URLSearchParams(location.search).get("s")||"KANBAN").toUpperCase();ir(P[s]?s:"KANBAN",false);});' +
      'var s0=(new URLSearchParams(location.search).get("s")||"").toUpperCase();if(P[s0])ir(s0,false);' +
      '})();<\/script>';
  }

  /** Página suelta de una sección (cuando se abre directamente con ?s=…, sin pasar por el tablero). */
  function pintarSeccion(cred, secs, s) {
    document.title = infoSeccion(s).t + ' · ' + (C.nombreApp || 'App');
    document.body.innerHTML = barra(seccionesBarra(secs, cred.perfil), s) + '<div id="sx-panel">' + htmlSeccion(s, cred) + '</div>';
    window.SX_CTX = ctxModulos(cred); // T0133
    abrirModulo(document.getElementById('sx-panel'));
  }

  function error(e) {
    if (e.acceso) { borrar(); acceso(e.message.replace(/^ACCESO:\s*/, '')); return; }
    pantalla('<div class="kz-caja"><p>' + texto(e.message.replace(/^SECCION:\s*/, '')) +
      '</p><button onclick="location.reload()">Reintentar</button></div>');
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
      llamar({ fn: 'entrar', persona: cred.persona, pin: cred.pin }).then(function (r) {
        var secs = r.secciones || ['KANBAN'];
        var cambian = !mismas(cred.secciones, secs) || (cred.perfil || '') !== (r.perfil || '');
        recordarSecciones(cred, secs, r.perfil);
        if (!permitida(secs, r.perfil)) { location.replace(urlSeccion(secs[0])); return; }
        if (!conocidas || cambian) pintarSeccion(cred, secs, pedida);
      }, error);
      return;
    }
    cargando(pedida && pedida !== 'KANBAN' ? 'Cargando…' : 'Cargando el kanban…');
    llamar({ fn: 'pagina', id: id, persona: cred.persona, pin: cred.pin }).then(function (p) {
      recordarSecciones(cred, p.secciones, p.perfil);
      var html = String(p.html || '');
      var cab = cabecera(cred);
      if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, function (m) { return m + cab; });
      else html = '<!DOCTYPE html><html><head>' + cab + '</head><body>' + html + '</body></html>';
      if (!/<!DOCTYPE/i.test(html)) html = '<!DOCTYPE html>' + html;
      if (!id) { // T0132: barra de secciones encima del tablero (solo si la persona tiene más de una)
        var sb = seccionesBarra(p.secciones, p.perfil);
        var nav = barra(sb, 'KANBAN');
        if (nav) {
          html = html.replace(/<body[^>]*>/i, function (m) { return m + nav + '<div id="sx-panel"></div>'; });
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
        llamar({ fn: 'entrar', persona: cred.persona, pin: cred.pin }).then(function (r) {
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
  if (new URLSearchParams(location.search).get('salir') !== null) { borrar(); history.replaceState(null, '', location.pathname); }
  var cred = leer();
  if (cred && cred.persona && cred.pin) abrir(cred); else acceso('');
})();
