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
        llamar({ fn: 'entrar', persona: cred.persona, pin: cred.pin }).then(function () {
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
   * La sección va en la URL: ?s=kanban, ?s=gestion… Sin ?s se abre la primera de la persona.
   * Con más de una sección sale una barra arriba para cambiar; con una sola, todo como antes.
   * El KANBAN lo genera el DAILY; las demás, por ahora, enseñan que están en preparación. */

  var SECCIONES = {
    KANBAN: { t: 'Kanban', i: '📋' },
    GESTION: { t: 'Gestión', i: '🗂️' },
    ECONOMIA: { t: 'Economía', i: '💶' },
    LIGAS: { t: 'Ligas', i: '⚽' }
  };

  function infoSeccion(s) {
    return SECCIONES[s] || { t: s.charAt(0) + s.slice(1).toLowerCase(), i: '•' };
  }

  function seccionPedida() {
    return String(new URLSearchParams(location.search).get('s') || '').trim().toUpperCase();
  }

  function urlSeccion(s) { return location.pathname + '?s=' + encodeURIComponent(s.toLowerCase()); }

  function barra(secs, actual, persona) {
    if (!secs || secs.length < 2) return '';
    var color = C.color || '#0E8A7A', accion = C.accion || '#FF5A3C';
    var css = '.sx{background:#fff;border-bottom:1px solid #e3e3ee;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}' +
      '.sx-in{display:flex;align-items:stretch;gap:2px;padding:0 10px;overflow-x:auto;-webkit-overflow-scrolling:touch}' +
      '.sx a{display:flex;align-items:center;gap:6px;min-height:46px;padding:0 12px;text-decoration:none;color:' + color + ';' +
      'font-size:14px;font-weight:700;border-bottom:3px solid transparent;white-space:nowrap}' +
      '.sx a[aria-current=page]{border-bottom-color:' + accion + '}' +
      '.sx a:focus-visible{outline:3px solid ' + color + ';outline-offset:-3px}' +
      '.sx .sx-salir{margin-left:auto;font-weight:600;font-size:13px;opacity:.75}' +
      '.sx .sx-i{font-size:17px;line-height:1}' +
      '@media(max-width:560px){.sx-in{padding:0 4px;gap:0}.sx a{flex:1 1 0;flex-direction:column;justify-content:center;gap:2px;' +
      'min-height:54px;padding:4px 6px;font-size:11.5px}.sx .sx-salir{margin-left:0;flex:0 0 auto;font-size:11px}}';
    var as = secs.map(function (s) {
      var f = infoSeccion(s);
      return '<a href="' + texto(urlSeccion(s)) + '" target="_top"' + (s === actual ? ' aria-current="page"' : '') + '>' +
        '<span class="sx-i" aria-hidden="true">' + f.i + '</span><span>' + texto(f.t) + '</span></a>';
    }).join('');
    var salir = '<a class="sx-salir" href="' + texto(location.pathname + '?salir') + '" target="_top" title="Salir (' +
      texto(persona || '') + ')"><span class="sx-i" aria-hidden="true">↩</span><span>Salir</span></a>';
    return '<style>' + css + '</style><nav class="sx" aria-label="Secciones"><div class="sx-in">' + as + salir + '</div></nav>';
  }

  /** Página de una sección que aún no está hecha (o que no es del DAILY). */
  function pintarSeccion(cred, secs, s) {
    var f = infoSeccion(s), color = C.color || '#0E8A7A';
    document.title = f.t + ' · ' + (C.nombreApp || 'App');
    document.body.innerHTML = barra(secs, s, cred.persona) +
      '<header style="background:' + texto(color) + ';color:#fff;padding:14px 18px"><h1 style="margin:0;font-size:24px;letter-spacing:.5px">' +
      texto(f.t.toUpperCase()) + '</h1></header>' +
      '<main style="padding:28px 18px;display:flex;justify-content:center"><div style="max-width:420px;text-align:center">' +
      '<div style="font-size:44px" aria-hidden="true">' + f.i + '</div>' +
      '<p style="font-size:17px;font-weight:700;margin:10px 0 6px">Esta sección está en preparación.</p>' +
      '<p style="margin:0;opacity:.75">Cuando esté lista, la tendrás aquí mismo.</p></div></main>';
  }

  function error(e) {
    if (e.acceso) { borrar(); acceso(e.message.replace(/^ACCESO:\s*/, '')); return; }
    pantalla('<div class="kz-caja"><p>' + texto(e.message.replace(/^SECCION:\s*/, '')) +
      '</p><button onclick="location.reload()">Reintentar</button></div>');
  }

  function abrir(cred) {
    var id = new URLSearchParams(location.search).get('id') || '';
    var pedida = seccionPedida();
    if (!id && pedida && pedida !== 'KANBAN') {
      // Otra sección: se comprueba el PIN y qué secciones tiene la persona.
      cargando('Cargando…');
      llamar({ fn: 'entrar', persona: cred.persona, pin: cred.pin }).then(function (r) {
        var secs = r.secciones || ['KANBAN'];
        if (secs.indexOf(pedida) < 0) { location.replace(urlSeccion(secs[0])); return; }
        pintarSeccion(cred, secs, pedida);
      }, error);
      return;
    }
    cargando('Cargando el kanban…');
    llamar({ fn: 'pagina', id: id, persona: cred.persona, pin: cred.pin }).then(function (p) {
      var html = String(p.html || '');
      var cab = cabecera(cred);
      if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, function (m) { return m + cab; });
      else html = '<!DOCTYPE html><html><head>' + cab + '</head><body>' + html + '</body></html>';
      if (!/<!DOCTYPE/i.test(html)) html = '<!DOCTYPE html>' + html;
      if (!id) { // T0132: barra de secciones encima del tablero (solo si la persona tiene más de una)
        var nav = barra(p.secciones, 'KANBAN', cred.persona);
        if (nav) html = html.replace(/<body[^>]*>/i, function (m) { return m + nav; });
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
