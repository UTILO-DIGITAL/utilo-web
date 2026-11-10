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
 * - T0269: una sección con «enPerfil» (Pedir a Utilo, por defecto) no sale en el menú: se abre desde un botón al final de
 *   Perfil y, mientras está abierta, el menú marca Perfil.
 * - La sección va en la URL (?s=ejemplo). Cambiar de sección no recarga la página.
 * - T0275: la copia de las tablas del dispositivo es de cada persona (su correo): en un dispositivo compartido, quien entra
 *   empieza con la suya o vacía. Si entra otra persona en la misma página, se deja la copia de la anterior; al cerrar
 *   sesión (o si el motor dice que ya no tiene acceso), se borra del dispositivo la de quien sale.
 * - T0273 · Entrar como otra persona: quien administra elige a alguien de la tabla de accesos (botón en Perfil, data-n-como)
 *   y la app se pinta como la ve esa persona: su perfil, su menú y lo suyo. Cada llamada al motor lleva «como» (su correo)
 *   y el motor comprueba que quien llama administra (si no, «COMO:» y se vuelve a la cuenta propia). Arriba, siempre, la
 *   franja «Viendo como …» con «Volver a mi cuenta» (data-n-volver). Se recuerda en la pestaña (sessionStorage): al
 *   recargar sigue igual y al cerrarla se vuelve a la cuenta propia. Su copia de las tablas va aparte
 *   (<correo de quien administra>><correo de ella>) y se borra al volver.
 * - T0386 · Sin motor: con nucleo/acceso-supabase.js en lugar de kanban4/google.js, «inicio», «entrar» y lo que piden las
 *   secciones van a Supabase (UG.inicio, UG.volviendo al volver de Google); sin «entrar como otra persona» (UG.sinComo).
 * - T0283 · Versiones: «entrar» trae la versión que se ve («5.0-1.2») y las publicadas con sus novedades. Perfil enseña
 *   el bloque «Versión» (UN.htmlVersion) con «Ver las novedades» (data-n-versiones), que abre la ventana con la lista. Si
 *   hay una versión con novedades que no se ha visto en este dispositivo, la ventana se abre sola una vez al entrar.
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
  // T0273: viendo como otra persona, lo que dijo el motor de ella, solo en esta pestaña.
  var COMO = 'nucleo_como_' + (C.clave || 'negocio');
  function leerComo() { try { return JSON.parse(sessionStorage.getItem(COMO) || 'null'); } catch (e) { return null; } }
  function guardarComo(o) { try { sessionStorage.setItem(COMO, JSON.stringify(o)); } catch (e) {} }
  function borrarComo() { try { sessionStorage.removeItem(COMO); } catch (e) {} }
  function bajo(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  /** T0275/T0273 · De quién es la copia de las tablas: su correo o, viendo como otra persona, «<quien administra>><ella>». */
  function copiaDe(c) { return !c ? '' : c.como && c.como.correo ? bajo(c.como.correo) + '>' + bajo(c.correo) : bajo(c.correo); }

  /**
   * Llamada al motor con la llave de Google; pide conectar un Excel si falta (google.js · UG.seccion). T0273: viendo como
   * otra persona, lleva «como»; si el motor no lo deja (COMO:), se vuelve a la cuenta propia.
   */
  function llamar(fn, args) {
    var c = { fn: fn, args: args || [] };
    if (cred && cred.como) c.como = cred.correo;
    return window.UG.seccion(C.api, c, CLAVE).catch(function (e) {
      if (/^COMO:/.test(e.message) && c.como && cred && cred.como && cred.correo === c.como) volver(e.message.replace(/^COMO:\s*/, ''));
      throw new Error(String(e.message).replace(/^COMO:\s*/, ''));
    });
  }
  /** «entrar», con los errores tal cual (ACCESO: vuelve a la pantalla de entrada). T0273: como, el correo de otra persona. */
  function entrar(como) {
    como = typeof como === 'string' && /^[^@\s]+@[^@\s]+$/.test(como) ? como : ''; // solo un correo
    return window.UG.llamar(C.api, como ? { fn: 'entrar', como: como } : { fn: 'entrar' });
  }
  function inicio() {
    if (window.UG.inicio) return window.UG.inicio(); // T0386: sin motor (acceso-supabase.js)
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
      // T0391: con Supabase, la web puede entrar también (o solo) con un código al correo.
      var formas = window.UG.formas ? window.UG.formas() : ['google'];
      if (formas.indexOf('codigo') >= 0) { entrarConCodigo(ini, titulo, ant, aviso, formas); return; }
      pantalla('<div class="kz-caja" id="n-entrar">' + bandaDev(ini.nucleo.dev) + '<h1>' + texto(titulo) + '</h1>' +
        '<p class="kz-ayuda">' + texto(ant.persona ? 'Vuelve a entrar con tu cuenta de Google, ' + ant.persona.split(' ')[0] + '.' :
          'Entra con la cuenta de Google con la que te han dado acceso.') + '</p>' +
        '<button type="button" class="u-btn u-btn-accion">' + (ant.persona ? 'Continuar con Google' : 'Entrar con Google') + '</button>' +
        '<p class="kz-aviso" id="n-aviso-entrar">' + texto(aviso || '') + '</p></div>');
      var b = $('n-entrar').querySelector('button');
      b.onclick = function () {
        b.disabled = true; b.textContent = 'Entrando…';
        // T0273: sin pasar la llave que devuelve Google a entrar (su argumento es «como»).
        window.UG.entrar().then(function () { return entrar(); }).then(function (r) {
          window.UG.recordarCorreo(r.correo || '');
          var cred = credDe(r);
          guardar(cred); borrarComo(); marco(cred); // T0273: al entrar con Google, siempre con la cuenta propia
        }, function (e) {
          if (/^CONECTAR:/.test(e.message)) { conectarYEntrar(e); return; }
          b.disabled = false; b.textContent = ant.persona ? 'Continuar con Google' : 'Entrar con Google';
          $('n-aviso-entrar').textContent = String(e.message).replace(/^ACCESO:\s*/, '');
        });
      };
      b.focus();
    }, function (e) { falloPantalla(e.message); });
  }

  /**
   * T0391 · Entrar con un código al correo (y, si la web lo tiene también, con Google): primero el correo y «Enviarme un
   * código»; después, las 6 cifras y «Entrar». En local y DEV el correo no sale: «Ver el buzón de pruebas» lo enseña aquí.
   */
  function entrarConCodigo(ini, titulo, ant, aviso, formas) {
    var conGoogle = formas.indexOf('google') >= 0, correo = bajo(ant.correo || (window.UG.correo && window.UG.correo()) || '');
    function listo(r) {
      window.UG.recordarCorreo(r.correo || '');
      var c = credDe(r);
      guardar(c); borrarComo(); marco(c);
    }
    function paso1(msg) {
      pantalla('<div class="kz-caja" id="n-entrar">' + bandaDev(ini.nucleo.dev) + '<h1>' + texto(titulo) + '</h1>' +
        '<p class="kz-ayuda">' + texto(ant.persona ? 'Hola, ' + ant.persona.split(' ')[0] + '. Te enviamos un código a tu correo para volver a entrar.' :
          'Escribe tu correo y te enviamos un código para entrar. Sin contraseñas.') + '</p>' +
        '<form id="n-f-correo" class="kz-form" novalidate><label>Tu correo<input type="email" id="n-correo" autocomplete="email" inputmode="email" ' +
          'autocapitalize="off" spellcheck="false" value="' + texto(correo) + '" required></label>' +
        '<button type="submit" class="u-btn u-btn-accion">Enviarme un código</button></form>' +
        (conGoogle ? '<p class="kz-o">o</p><button type="button" class="u-btn" id="n-google">' + (ant.persona ? 'Continuar con Google' : 'Entrar con Google') + '</button>' : '') +
        '<p class="kz-aviso" id="n-aviso-entrar" role="alert">' + texto(msg || '') + '</p></div>');
      var f = $('n-f-correo'), b = f.querySelector('button'), i = $('n-correo');
      f.onsubmit = function (e) {
        e.preventDefault();
        b.disabled = true; b.textContent = 'Enviando…'; $('n-aviso-entrar').textContent = '';
        window.UG.pedirCodigo(i.value).then(function (c) { correo = c; paso2(''); }, function (x) {
          b.disabled = false; b.textContent = 'Enviarme un código'; $('n-aviso-entrar').textContent = x.message; i.focus();
        });
      };
      if (conGoogle) {
        var g = $('n-google');
        g.onclick = function () {
          g.disabled = true; g.textContent = 'Entrando…';
          window.UG.entrar().then(function () { return entrar(); }).then(listo, function (x) {
            g.disabled = false; g.textContent = ant.persona ? 'Continuar con Google' : 'Entrar con Google';
            $('n-aviso-entrar').textContent = String(x.message).replace(/^ACCESO:\s*/, '');
          });
        };
      }
      (i.value ? b : i).focus();
    }
    function paso2(msg) {
      var dev = !!ini.nucleo.dev;
      pantalla('<div class="kz-caja" id="n-entrar">' + bandaDev(ini.nucleo.dev) + '<h1>' + texto(titulo) + '</h1>' +
        '<p class="kz-ayuda">Te hemos enviado un código a <strong>' + texto(correo) + '</strong>. Escríbelo aquí: caduca en 10 minutos.</p>' +
        '<form id="n-f-codigo" class="kz-form" novalidate><label>Código<input type="text" id="n-codigo" class="kz-codigo" inputmode="numeric" ' +
          'autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" required></label>' +
        '<button type="submit" class="u-btn u-btn-accion">Entrar</button></form>' +
        '<p class="kz-aviso" id="n-aviso-entrar" role="alert">' + texto(msg || '') + '</p>' +
        '<p class="kz-ayuda">¿No te llega? Mira en el correo no deseado. Si tampoco está, puede que ese correo no sea el que diste al apuntarte: pídeselo a quien te dio de alta.</p>' +
        '<div class="kz-otros"><button type="button" class="u-btn" id="n-otro">Enviarme otro código</button>' +
        '<button type="button" class="u-btn" id="n-cambiar">Usar otro correo</button></div>' +
        (dev ? '<button type="button" class="u-btn" id="n-buzon">Ver el buzón de pruebas</button><div id="n-buzon-ver" class="kz-buzon" hidden></div>' : '') +
        '</div>');
      var f = $('n-f-codigo'), b = f.querySelector('button'), i = $('n-codigo');
      // Al pegar el código o al ponerlo el móvil (lo sugiere del correo), entra solo; escrito a mano, con «Entrar». Auth
      // manda 6 u 8 cifras según el proyecto: no se sabe cuántas faltan.
      var antes = 0;
      i.oninput = function () {
        i.value = i.value.replace(/\D+/g, '').slice(0, 10);
        var de_golpe = i.value.length - antes >= 6; antes = i.value.length;
        if (de_golpe && !b.disabled) { if (f.requestSubmit) f.requestSubmit(); else f.onsubmit(new Event('submit')); }
      };
      f.onsubmit = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        b.disabled = true; b.textContent = 'Entrando…'; $('n-aviso-entrar').textContent = '';
        window.UG.entrarConCodigo(correo, i.value).then(function () { return entrar(); }).then(listo, function (x) {
          b.disabled = false; b.textContent = 'Entrar';
          $('n-aviso-entrar').textContent = String(x.message).replace(/^ACCESO:\s*/, '');
          i.select(); i.focus();
        });
      };
      $('n-otro').onclick = function () {
        var o = $('n-otro');
        o.disabled = true; o.textContent = 'Enviando…';
        window.UG.pedirCodigo(correo).then(function () {
          o.textContent = 'Enviado: mira tu correo'; $('n-aviso-entrar').textContent = '';
          setTimeout(function () { if ($('n-otro')) { o.disabled = false; o.textContent = 'Enviarme otro código'; } }, 30000);
        }, function (x) { o.disabled = false; o.textContent = 'Enviarme otro código'; $('n-aviso-entrar').textContent = x.message; });
      };
      $('n-cambiar').onclick = function () { paso1(''); };
      if (dev) {
        $('n-buzon').onclick = function () {
          var v = $('n-buzon-ver');
          window.UG.buzon(correo).then(function (ms) {
            v.hidden = false;
            v.innerHTML = !ms ? '<p class="u-nota">Aquí no hay buzón de pruebas para ' + texto(correo) + ' (solo los correos de prueba, como los de @ejemplo.com).</p>' :
              !ms.length ? '<p class="u-nota">No ha llegado nada a ' + texto(correo) + '. Si el correo no está dado de alta, no se envía ningún código.</p>' :
              '<p class="u-nota">Buzón de pruebas: los correos no salen de verdad.</p><p><strong>' + texto(ms[0].asunto) + '</strong></p><p>' + texto(ms[0].texto).replace(/\n/g, '<br>') + '</p>';
          });
        };
      }
      i.focus();
    }
    paso1(aviso);
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
    var o = { persona: r.persona, correo: r.correo || '', perfil: r.perfil || '', admin: !!r.admin, negocio: r.negocio || '', dev: r.dev || '', secciones: r.secciones || [],
      version: r.version || '', versiones: Array.isArray(r.versiones) ? r.versiones : [] }; // T0283
    if (r.persona_id) o.persona_id = r.persona_id; // T0387: con Supabase, el id de la persona (acceso.personas)
    if (Array.isArray(r.roles)) o.roles = r.roles; // T0394: con Supabase, sus roles (ctx.roles); antes se perdían aquí
    if (r.perfilEnMenu === false) o.perfilEnMenu = false; // T0415: Perfil fuera del menú (se abre con el nombre de la cabecera)
    if (r.como && r.como.correo) o.como = { correo: r.como.correo, persona: r.como.persona || r.como.correo }; // T0273
    return o;
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
    registrar: function (id, def) { DEF[String(id).toUpperCase()] = def; },
    /** T0283: el bloque «Versión» de Perfil (vacío si no hay versión: DEV, local sin ejemplo). */
    htmlVersion: function () { return htmlVersion(); }
  };

  function tablas() {
    if (T) return T;
    // T0275: la copia del dispositivo es de quien ha entrado (sin correo, solo en memoria).
    T = window.UT.crear({ llamar: llamar, clave: C.clave || 'negocio', persona: copiaDe(cred), aviso: aviso });
    T.en('cambio', function (tabla, info) {
      (oyentes[actual] || []).forEach(function (f) { try { f(tabla, info); } catch (e) { if (window.console) console.error(e); } });
      contarCifras(tabla); // T0412
    });
    return T;
  }

  /** T0275 · Deja la copia de las tablas de quien estaba (otra persona entra o sale); con olvidar, la borra del dispositivo. */
  function soltarTablas(correo, olvidar) {
    if (T) { T.cerrar(); T = null; }
    if (olvidar && correo && window.UT.olvidar) window.UT.olvidar(C.clave || 'negocio', correo);
  }

  /** Las secciones que ves y, al final, Perfil (la sección PERFIL si el cliente la tiene; si no, la del marco). */
  function todas() {
    var ss = (cred.secciones || []).filter(function (s) { return s.id !== 'PERFIL'; });
    var p = (cred.secciones || []).filter(function (s) { return s.id === 'PERFIL'; })[0] || { id: 'PERFIL', titulo: 'Perfil', icono: ICONO_PERFIL, propia: true };
    return ss.concat([p]);
  }
  /** Las del menú: todas menos las que van dentro de Perfil (T0269) y, si el proyecto lo dice (perfilEnMenu: false, T0415),
   *  sin Perfil: se abre con el nombre de la cabecera, que entonces se ve también en el ordenador. */
  function sinPerfil() { return cred && cred.perfilEnMenu === false; }
  function menu() { return todas().filter(function (s) { return !s.enPerfil && !(s.id === 'PERFIL' && sinPerfil()); }); }
  function seccion(id) { return todas().filter(function (s) { return s.id === id; })[0] || null; }

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
          (s.id === 'PERFIL' ? '<span class="sx-quien">' + texto(cred.persona) + '</span>' : '') + '</span>' +
          (s.cifra ? '<span class="bj-n hay" data-cifra="' + texto(s.id) + '" hidden></span>' : '') + '</a>'; // T0412
      }).join('') + '</div></nav>';
  }

  /** Pinta el marco entero y abre la sección de la URL (o la primera). */
  function marco(c) {
    if (T && T.persona() !== copiaDe(c)) soltarTablas();  // T0275: otra persona, otra copia
    if (cerrarVersiones) cerrarVersiones(false);           // T0283: la ventana de novedades se va con el body; sin darla por vista
    cred = c;
    document.body.className = 'u u-con-barra' + (cred.como ? ' n-viendo-como' : '') + (sinPerfil() ? ' n-perfil-arriba' : '');
    document.body.innerHTML = bandaDev(cred.dev) + htmlMenu() +
      '<div id="sx-panel">' + htmlComo() + '<header class="u-cab n-cab"><h1 id="n-titulo"></h1>' +
      '<a class="n-quien" href="?s=perfil" data-sx="PERFIL"><span>' + texto(cred.persona) + '</span>' + (cred.perfil ? '<small>' + texto(cred.perfil) + '</small>' : '') + '</a></header>' +
      '<main class="u-main n-main" id="n-sec"></main></div>' +
      '<div class="u-aviso" id="n-aviso" role="status" hidden></div>';
    $('n-plegar').onclick = function () {
      var p = document.body.classList.toggle('u-menu-plegado');
      this.setAttribute('aria-label', p ? 'Desplegar el menú' : 'Plegar el menú'); this.title = this.getAttribute('aria-label');
      try { if (p) localStorage.setItem(MENU_CLAVE, '1'); else localStorage.removeItem(MENU_CLAVE); } catch (e) {}
    };
    tope();
    abrir(pedida() || menu()[0].id, false);
    avisarVersiones();
    cifras();
  }

  /* ---------- T0412 · las cifras del menú ----------
   * Una sección con «cifra» en su modulo.json (montar.js: { tabla, donde, directo, que }) lleva en el menú cuántas filas de
   * esa tabla cumplen «donde» (las Nuevas que puedes atender, en la Bandeja), estés en la sección que estés: el marco la lee
   * con la misma copia de las tablas, la cuenta cada vez que esa tabla cambia y, con Supabase, la vuelve a leer en cuanto
   * cambia algo en las tablas de «directo» (Realtime). Sin nada que contar, no se ve. */
  var cifrasDirecto = [];
  function contarCifras(tabla) {
    if (!cred || !T) return;
    menu().forEach(function (s) {
      var c = s.cifra;
      if (!c || (tabla && tabla !== c.tabla)) return;
      var n = T.filas(c.tabla).filter(function (f) { return Object.keys(c.donde || {}).every(function (k) { return f[k] === c.donde[k]; }); }).length;
      var b = document.querySelector('[data-cifra="' + s.id + '"]');
      if (!b) return;
      b.textContent = n ? String(n) : ''; b.hidden = !n;
      b.parentNode.title = s.titulo + (n ? ' · ' + n + (c.que ? ' ' + c.que : '') : '');
      b.parentNode.setAttribute('aria-label', b.parentNode.title);
    });
  }
  function cifras() {
    cifrasDirecto.forEach(function (d) { try { d.cerrar(); } catch (e) {} });
    cifrasDirecto = [];
    menu().filter(function (s) { return s.cifra; }).forEach(function (s) {
      var c = s.cifra, t = tablas(), espera = 0;
      t.leer([c.tabla]).then(function () { contarCifras(c.tabla); }, function () {});
      if (c.directo && c.directo.length && window.UG && typeof window.UG.enDirecto === 'function') {
        var d = window.UG.enDirecto(c.directo, function () {
          if (espera) return;
          espera = setTimeout(function () { espera = 0; if (T === t) t.refrescar([c.tabla], true).then(function () { contarCifras(c.tabla); }, function () {}); }, 800);
        });
        if (d) cifrasDirecto.push(d);
      }
    });
  }

  /* ---------- T0283 · versión y novedades ---------- */

  // La última versión cuyas novedades se han visto aquí. DEV (dev-rama/) comparte dirección con producción: va aparte.
  function vista() { return 'nucleo_version_vista_' + (cred && cred.dev ? 'dev_' : '') + (C.clave || 'negocio'); }
  function leerVista() { try { return localStorage.getItem(vista()); } catch (e) { return null; } }
  function marcarVista() { var v = cred && cred.versiones && cred.versiones[0]; if (v) try { localStorage.setItem(vista(), v.v); } catch (e) {} }
  var cerrarVersiones = null; // la ventana abierta: cerrarVersiones(darPorVista)

  /** Las versiones con novedades que no se han visto en este dispositivo (la primera vez, solo la actual, si trae). */
  function sinVer() {
    var vs = (cred && cred.versiones) || [], vista = leerVista(), i = -1;
    vs.forEach(function (x, k) { if (i < 0 && x.v === vista) i = k; });
    return (vista === null ? vs.slice(0, 1) : i < 0 ? vs : vs.slice(0, i)).filter(function (x) { return (x.novedades || []).length; });
  }

  /** El bloque «Versión» de Perfil: cuál es y, si hay lista, el botón para ver las novedades. */
  function htmlVersion() {
    if (!cred || !cred.version) return '';
    var vs = cred.versiones || [], ult = vs[0] && vs[0].v === cred.version ? vs[0] : null, nuevas = sinVer().length;
    return '<section class="pf-bloque n-version" aria-label="Versión"><h2 class="n-grupo">Versión</h2>' +
      '<p>Usas la versión <strong>' + texto(cred.version) + '</strong>' + (ult && ult.fecha ? ', del ' + texto(ult.fecha) : '') + '.</p>' +
      (vs.length ? '<div class="n-botones"><button type="button" class="u-btn" data-n-versiones>Ver las novedades' +
        (nuevas ? ' <span class="n-nuevo">' + (nuevas === 1 ? 'nueva' : nuevas + ' nuevas') + '</span>' : '') + '</button></div>' : '') + '</section>';
  }

  /** La ventana con las versiones publicadas y sus novedades, la más reciente arriba. Las no vistas, marcadas «Nueva». */
  function verVersiones() {
    if (!cred || !(cred.versiones || []).length || $('n-ver-velo')) return;
    var nuevas = sinVer().map(function (x) { return x.v; }), antes = document.activeElement;
    var velo = document.createElement('div');
    velo.className = 'u-velo abierto'; velo.id = 'n-ver-velo';
    velo.innerHTML = '<div class="u-ventana" role="dialog" aria-modal="true" aria-labelledby="n-ver-t"><div class="n-ventana">' +
      '<h2 id="n-ver-t">' + (nuevas.length ? 'Novedades' : 'Versiones') + '</h2>' +
      '<ol class="n-versiones">' + cred.versiones.map(function (x, k) {
        var ns = x.novedades || [], primera = k === cred.versiones.length - 1;
        return '<li><h3>Versión ' + texto(x.v) + (nuevas.indexOf(x.v) >= 0 ? ' <span class="n-nuevo">Nueva</span>' : '') +
          (x.fecha ? ' <small>' + texto(x.fecha) + '</small>' : '') + '</h3>' +
          (ns.length ? '<ul>' + ns.map(function (n) { return '<li>' + texto(n) + '</li>'; }).join('') + '</ul>'
            : '<p class="u-nota">' + (primera ? 'Primera versión.' : 'Arreglos y mejoras por dentro: nada cambia en cómo se usa.') + '</p>') + '</li>';
      }).join('') + '</ol>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="n-ver-cerrar">Entendido</button></div></div></div>';
    document.body.appendChild(velo);
    function cerrar(darPorVista) {
      cerrarVersiones = null;
      document.removeEventListener('keydown', tecla, true);
      if (velo.parentNode) velo.parentNode.removeChild(velo);
      if (darPorVista === false) return;
      marcarVista();
      var b = document.querySelector('[data-n-versiones] .n-nuevo'); if (b) b.parentNode.removeChild(b);
      if (antes && antes.focus && document.body.contains(antes)) antes.focus();
    }
    // Escape cierra solo esta ventana (va antes que las de las secciones y no sigue hacia ellas).
    function tecla(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); cerrar(); } }
    document.addEventListener('keydown', tecla, true);
    cerrarVersiones = cerrar;
    velo.addEventListener('click', function (e) { if (e.target === velo || e.target.id === 'n-ver-cerrar') cerrar(); });
    $('n-ver-cerrar').focus();
  }

  /**
   * T0415 · Con Perfil fuera del menú (perfilEnMenu: false), el nombre de la cabecera abre el Perfil del marco en una ventana
   * encima de la sección en la que estás: se cierra con ✕, con Escape o pulsando fuera, y sigues donde estabas.
   */
  function verPerfil() {
    if (!cred || $('n-perfil-velo')) return;
    var antes = document.activeElement, velo = document.createElement('div');
    velo.className = 'u-velo abierto'; velo.id = 'n-perfil-velo';
    velo.innerHTML = '<div class="u-ventana n-perfil-ventana" role="dialog" aria-modal="true" aria-labelledby="n-perfil-t"><div class="n-ventana">' +
      '<div class="n-perfil-cab"><h2 id="n-perfil-t">Tu perfil</h2><button type="button" class="n-perfil-x" id="n-perfil-cerrar" aria-label="Cerrar" title="Cerrar">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' + htmlPerfil() + '</div></div>';
    document.body.appendChild(velo);
    correosPerfil(); avisosPerfil();
    function cerrar() {
      document.removeEventListener('keydown', tecla, true);
      if (velo.parentNode) velo.parentNode.removeChild(velo);
      if (antes && antes.focus && document.body.contains(antes)) antes.focus();
    }
    // Escape cierra solo esta ventana (si encima está la de las novedades, primero esa).
    function tecla(e) { if (e.key === 'Escape' && !$('n-ver-velo')) { e.stopPropagation(); e.preventDefault(); cerrar(); } }
    document.addEventListener('keydown', tecla, true);
    velo.addEventListener('click', function (e) {
      if (e.target === velo || (e.target.closest && e.target.closest('#n-perfil-cerrar'))) { cerrar(); return; }
      // Lo que lleva a otra parte (entrar como otra persona, una sección de dentro de Perfil) cierra la ventana antes.
      if (e.target.closest && e.target.closest('[data-n-como], [data-n-volver], a[data-sx]')) cerrar();
    });
    $('n-perfil-cerrar').focus();
  }

  /** Al entrar: si hay novedades sin ver, la ventana se abre sola (una vez; viendo como otra persona, no). */
  function avisarVersiones() {
    if (cred && !cred.como && sinVer().length) verVersiones();
  }

  /* ---------- T0273 · entrar como otra persona ---------- */

  /** La franja de arriba mientras quien administra ve como otra persona. */
  function htmlComo() {
    if (!cred.como) return '';
    return '<div class="n-como" id="n-como" role="status"><p><span>Viendo como</span> <strong>' + texto(cred.persona) + '</strong>' +
      (cred.perfil ? ' · ' + texto(cred.perfil) : '') + '<small>Lo que guardes queda a tu nombre: «' + texto(cred.como.persona + ' como ' + cred.persona) + '».</small></p>' +
      '<button type="button" class="u-btn" data-n-volver>Volver a mi cuenta</button></div>';
  }
  /** Lo que ocupa la franja (--tope), para que lo que se queda fijo arriba al bajar (cabeceras de tabla…) quede debajo. */
  var obsTope = null;
  function tope() {
    if (obsTope) { obsTope.disconnect(); obsTope = null; }
    var f = $('n-como'), poner = function () { document.body.style.setProperty('--tope', (f ? f.offsetHeight : 0) + 'px'); };
    if (!f) { document.body.style.removeProperty('--tope'); return; }
    poner();
    if (window.ResizeObserver) { obsTope = new ResizeObserver(poner); obsTope.observe(f); }
  }

  /** La ventana para elegir como quién entrar: las personas de la tabla de accesos (solo quien administra; lo comprueba el motor). */
  function verComo() {
    if (!cred || !cred.admin || cred.como || window.UG.sinComo || $('n-como-velo')) return;
    var velo = document.createElement('div');
    velo.className = 'u-velo abierto'; velo.id = 'n-como-velo';
    velo.innerHTML = '<div class="u-ventana" role="dialog" aria-modal="true" aria-labelledby="n-como-t"><div class="n-ventana">' +
      '<h2 id="n-como-t">Entrar como otra persona</h2>' +
      '<p class="u-nota">Verás la app como la ve: su perfil, su menú y lo suyo. Puedes guardar cambios, y quedarán a tu nombre. ' +
      'Se usan tus permisos de Google: si no tiene compartido algún Excel, tú sí verás lo que hay en él.</p>' +
      '<label class="u-campo"><span class="u-etiqueta">Buscar</span><input type="search" id="n-como-buscar" placeholder="Nombre, correo o perfil" autocomplete="off"></label>' +
      '<div id="n-como-lista" aria-live="polite"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
      '<div class="n-botones"><button type="button" class="u-btn" id="n-como-cerrar">Cerrar sin elegir</button></div></div></div>';
    document.body.appendChild(velo);
    var lista = $('n-como-lista'), buscar = $('n-como-buscar'), ps = null, antes = document.activeElement;
    function cerrar() {
      document.removeEventListener('keydown', tecla);
      if (velo.parentNode) velo.parentNode.removeChild(velo);
      if (antes && antes.focus && document.body.contains(antes)) antes.focus();
    }
    function tecla(e) { if (e.key === 'Escape') cerrar(); }
    function pintar() {
      if (!ps) return;
      var q = bajo(buscar.value), xs = ps.filter(function (p) { return !q || bajo(p.persona + ' ' + p.correo + ' ' + p.perfil).indexOf(q) >= 0; });
      lista.innerHTML = !ps.length ? '<p class="u-vacio">No hay nadie más con acceso a la app. Se añade en la tabla de accesos del negocio.</p>' :
        !xs.length ? '<p class="u-vacio">Nadie coincide con «' + texto(buscar.value) + '». Prueba con otra parte del nombre o del correo.</p>' :
        '<ul class="n-como-lista">' + xs.map(function (p) {
          return '<li><button type="button" data-c="' + texto(p.correo) + '"><strong>' + texto(p.persona) + '</strong><span>' + texto(p.perfil) + ' · ' + texto(p.correo) + '</span></button></li>';
        }).join('') + '</ul>';
    }
    document.addEventListener('keydown', tecla);
    velo.addEventListener('click', function (e) {
      if (e.target === velo || e.target.id === 'n-como-cerrar') { cerrar(); return; }
      var b = e.target.closest && e.target.closest('button[data-c]');
      if (!b) return;
      var p = ps.filter(function (x) { return x.correo === b.getAttribute('data-c'); })[0];
      [].forEach.call(lista.querySelectorAll('button'), function (x) { x.disabled = true; });
      lista.insertAdjacentHTML('afterbegin', '<p class="u-nota" role="status">Entrando como ' + texto(p.persona) + '…</p>');
      entrarComo(p.correo).then(cerrar, function (x) {
        pintar();
        lista.insertAdjacentHTML('afterbegin', '<p class="u-error" role="alert">No se ha podido entrar como ' + texto(p.persona) + ': ' +
          texto(String(x.message).replace(/^\w+:\s*/, '')) + '</p>');
      });
    });
    buscar.addEventListener('input', pintar);
    buscar.focus();
    llamar('nucleoPersonas').then(function (r) { ps = r || []; pintar(); }, function (e) {
      lista.innerHTML = '<p class="u-error" role="alert">No se ha podido cargar la lista: ' + texto(e.message) + '</p><p class="u-nota">Cierra esta ventana y vuelve a probar.</p>';
    });
  }

  /** Entra como esa persona: el motor dice qué ve y lo comprueba; la pantalla se pinta como la suya. */
  function entrarComo(correo) {
    return entrar(correo).then(function (r) {
      var c = credDe(r);
      if (!c.como) throw new Error('El motor no ha dejado entrar como esa persona.');
      guardarComo(c);
      marco(c);
    }, function (e) { throw new Error(String(e.message).replace(/^(COMO|ACCESO):\s*/, '')); });
  }

  /** Vuelve a la cuenta de quien administra y borra del dispositivo la copia de lo que ha visto como la otra persona. */
  function volver(msg) {
    var c = cred;
    borrarComo();
    if (c && c.como) soltarTablas(copiaDe(c), true);
    var g = leer();
    if (!g || !g.persona) { acceso(msg || ''); return; }
    marco(g);
    comprobar();
    if (msg) aviso(msg);
  }

  function pedida() {
    var s = String(new URLSearchParams(location.search).get('s') || '').toUpperCase();
    return seccion(s) ? s : '';
  }

  /**
   * Abre una sección dentro del marco: título, menú, su JS (la primera vez) y su abrir(el, ctx). Con push, la apunta en la
   * URL; href, si el enlace lleva algo más para la sección (T0269: ?s=kanban&asignado=…).
   */
  function abrir(id, push, href) {
    var s = seccion(id) || menu()[0], antes = actual;
    if (abierta && abierta.def && abierta.def.cerrar) { try { abierta.def.cerrar(); } catch (e) {} }
    abierta = null;
    oyentes[actual] = [];
    actual = s.id;
    var marcada = s.enPerfil ? 'PERFIL' : s.id; // una sección de dentro de Perfil marca Perfil en el menú (T0269)
    [].forEach.call(document.querySelectorAll('.sx a[data-sx]'), function (a) {
      if (a.getAttribute('data-sx') === marcada) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('n-titulo').textContent = s.titulo;
    document.title = s.titulo + ' · ' + (C.nombreApp || cred.negocio || '');
    if (push) {
      // T0420: cuánto habías bajado donde estabas y de qué sección vienes, para que «atrás» (o «Volver a …» de la ficha de
      // una tarea abierta desde Para mí o Entregas) te deje donde estabas.
      try { history.replaceState(Object.assign({}, history.state, { y: bajado() }), ''); } catch (e) {}
      history.pushState({ s: s.id, desde: antes && antes !== s.id ? antes : '' }, '', href && /^\?s=/.test(href) ? href : '?s=' + s.id.toLowerCase());
    }
    var y = (!push && history.state && history.state.y) || 0;
    window.scrollTo(0, 0); document.body.scrollTop = 0;
    // T0292: cada sección recibe un <main> nuevo, sin los oyentes que le pusieron las de antes (si no, un clic en otra
    // sección también lo atendía la anterior, y volver a una le duplicaba los suyos).
    var viejo = $('n-sec'), el = viejo.cloneNode(false);
    viejo.parentNode.replaceChild(el, viejo);
    if (s.propia) { el.innerHTML = htmlPerfil(); correosPerfil(); avisosPerfil(); return; }
    var t = setTimeout(function () { if (actual === s.id && !el.childNodes.length) el.innerHTML = '<div class="kz-centro" role="status"><div class="u-carga"></div></div>'; }, 150);
    cargar(s).then(function (def) {
      clearTimeout(t);
      if (actual !== s.id) return;
      el.innerHTML = '';
      abierta = { id: s.id, def: def };
      def.abrir(el, ctxDe(s));
      if (y) alSitio(s.id, y);
    }, function () {
      clearTimeout(t);
      if (actual === s.id) el.innerHTML = '<p>No se ha podido cargar ' + texto(s.titulo) + '.</p><p class="u-nota">Comprueba la conexión y vuelve a abrir la sección.</p>';
    });
  }

  function bajado() { return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0; }
  /** T0420 · Vuelve a bajar hasta y en cuanto la sección es lo bastante larga (pinta con lo guardado y luego trae lo último). */
  function alSitio(id, y) {
    var n = 0;
    (function paso() {
      if (actual !== id) return;
      window.scrollTo(0, y);
      if (Math.abs(bajado() - y) > 2 && ++n < 25) setTimeout(paso, 80);
    })();
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
   * - autor (T0273): el nombre para lo que se apunta (como ctx.autor del motor).
   * - correo y secciones (T0259): la cuenta con la que ha entrado y las secciones que ve ({ id, titulo }), en orden; las de
   *   dentro de Perfil, con enPerfil e icono (T0269).
   * - tablas: las tablas al momento (UT de kanban4/tablas.js): leer, filas, fila, actualizar, crear, borrar.
   * - alCambiar(f): f(tabla, info) cada vez que cambia una tabla, solo mientras la sección está abierta.
   * - llamar(fn, args): una función de su «api» del motor (recibe ctx en el motor). Devuelve una promesa.
   * - aviso(texto): mensaje corto abajo de la pantalla. ponerTitulo(texto): cambia el título de la cabecera.
   * - abierta(): si la sección sigue abierta (para no pintar tarde en otra).
   * - enDirecto(tablas, f) (T0386, solo con Supabase; si no, null): f(tabla) en cuanto cambia algo en esas tablas de la base.
   * - personaId (T0387, solo con Supabase; si no, ''): el id de quien ha entrado, el de las columnas persona (ASIGNADO…).
   * - roles (T0417, solo con Supabase; si no, []): sus roles, [{ rol, ambito, ambito_id }], para no ofrecer lo que la base no le
   *   deja (en qué iniciativas es responsable). La que manda sigue siendo la base.
   * - desde y volver() (T0420): la sección de la que se viene con un enlace ({ id, titulo } o null) y volver a ella como estaba.
   */
  function ctxDe(s) {
    return {
      id: s.id, titulo: s.titulo, persona: cred.persona, perfil: cred.perfil, admin: cred.admin, config: s.config || {},
      // T0259: las secciones que ves, en orden; T0269: con enPerfil (y su icono) las que van dentro de Perfil.
      // T0273: como, quien administra si está viendo como esta persona ({ correo, persona }); verComo, la ventana para elegir (solo quien administra).
      como: cred.como || null, verComo: cred.admin && !cred.como && !window.UG.sinComo ? verComo : null, // T0386: con Supabase, no
      // T0273: el nombre con el que se apunta lo que hace (HISTORIAL…), como en el motor: «Javi Canela como Ana».
      autor: cred.como ? cred.como.persona + ' como ' + cred.persona : cred.persona,
      personaId: cred.persona_id || '', // T0387
      roles: cred.roles || [], // T0417
      // T0420: la sección de la que vienes ({ id, titulo }, o null si se ha entrado directo) y volver a ella como estaba.
      desde: (function () { var d = history.state && history.state.desde, x = d && seccion(d); return x ? { id: x.id, titulo: x.titulo } : null; })(),
      volver: function () { history.back(); },
      correo: cred.correo || '', secciones: todas().map(function (x) { return x.enPerfil ? { id: x.id, titulo: x.titulo, icono: x.icono || '', enPerfil: true } : { id: x.id, titulo: x.titulo }; }),
      tablas: tablas(),
      alCambiar: function (f) { (oyentes[s.id] = oyentes[s.id] || []).push(f); },
      llamar: llamar,
      aviso: aviso,
      ponerTitulo: function (t) { if (actual === s.id) $('n-titulo').textContent = t; },
      abierta: function () { return actual === s.id; },
      // T0386: con Supabase, enDirecto(tablas, f): f(tabla) en cuanto cambia algo en esas tablas de la base (null si no se puede).
      enDirecto: window.UG && typeof window.UG.enDirecto === 'function' ? function (ts, f) { return window.UG.enDirecto(ts, f); } : null
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

  /** Perfil del marco, mientras el cliente no tenga la sección PERFIL: quién eres, tu perfil, las de dentro de Perfil y cerrar sesión. */
  function htmlPerfil() {
    var ves = menu().filter(function (s) { return s.id !== 'PERFIL'; }).map(function (s) { return s.titulo; }).join(', ');
    var dentro = todas().filter(function (s) { return s.enPerfil; });
    return '<div class="u-perfil"><div class="u-perfil-quien"><strong>' + texto(cred.persona) + '</strong>' +
      '<span>' + texto(cred.admin ? (cred.perfil ? cred.perfil + ' · administras el negocio' : 'Administras el negocio') : cred.perfil) + '</span></div>' +
      '<dl><dt>Cuenta</dt><dd>' + texto(cred.correo || '') + '</dd>' +
      '<dt>Secciones</dt><dd>' + texto(ves || 'Ninguna') + '</dd>' +
      '<dt>Dispositivo</dt><dd>' + (cred.como ? 'Viendo como ' + texto(cred.persona) + ' desde la cuenta de ' + texto(cred.como.persona) : 'Sesión guardada en este dispositivo') + '</dd></dl>' +
      (cred.como ? '<button type="button" class="u-btn" data-n-volver>Volver a mi cuenta</button>' :
        '<div class="n-botones">' + (cred.admin && !window.UG.sinComo ? '<button type="button" class="u-btn" data-n-como>Entrar como otra persona</button>' : '') +
        '<a class="u-btn" href="?salir">Cerrar sesión</a></div>' +
        '<p class="u-nota">' + (conCodigo() ? 'Al cerrar la sesión tendrás que volver a entrar con un código a tu correo.' :
          'Al cerrar la sesión tendrás que volver a entrar con tu cuenta de Google.') + '</p>') +
      (window.UG.correos && !cred.como ? '<div class="n-correos" id="n-correos"></div>' : '') +
      (window.UG.avisos && !cred.como ? '<div class="n-avisos" id="n-avisos"></div>' : '') +
      (dentro.length ? '<div class="n-botones">' + dentro.map(function (s) {
        return '<a class="u-btn" href="?s=' + encodeURIComponent(s.id.toLowerCase()) + '" data-sx="' + texto(s.id) + '">' + texto(s.titulo) + '</a>';
      }).join('') + '</div>' : '') + '</div>' + htmlVersion();
  }

  function conCodigo() { return !!(window.UG.formas && window.UG.formas().indexOf('codigo') >= 0); }

  /**
   * T0391 · «Tus correos» en el Perfil del marco (con Supabase): con cualquiera de ellos entras en tu misma cuenta. Añadir
   * uno manda un código a ese correo, que se escribe aquí mismo; hasta entonces sale «por confirmar». El principal no se
   * quita. Lo pinta en #n-correos cuando contesta la base.
   */
  function correosPerfil() {
    var caja = $('n-correos'), C2 = window.UG.correos;
    if (!caja || !C2) return;
    var aviso2 = '', pidiendo = '';
    function pintar(lista) {
      if (!document.body.contains(caja)) return;
      lista = lista || [];
      var pend = lista.filter(function (x) { return x.pendiente; });
      caja.innerHTML = '<h3>Tus correos</h3><p class="u-nota">Puedes entrar con cualquiera de ellos: siempre es tu misma cuenta.</p>' +
        '<ul class="n-correos-lista">' + lista.map(function (x) {
          return '<li><span>' + texto(x.correo) + '</span><span class="u-nota">' + (x.principal ? 'principal' : x.pendiente ? 'por confirmar' : '') + '</span>' +
            (x.principal ? '' : '<button type="button" class="u-btn" data-n-quitar="' + texto(x.correo) + '">Quitar</button>') + '</li>';
        }).join('') + '</ul>' +
        pend.map(function (x) {
          return '<form class="kz-form n-correo-codigo" data-n-confirmar="' + texto(x.correo) + '"><label>Código que ha llegado a ' + texto(x.correo) +
            '<input type="text" class="kz-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="10"></label>' +
            '<div class="n-botones"><button type="submit" class="u-btn u-btn-accion">Confirmar</button>' +
            '<button type="button" class="u-btn" data-n-reenviar="' + texto(x.correo) + '">Enviar otro código</button>' +
            (window.UG.entorno !== 'prod' && window.UG.buzon ? '<button type="button" class="u-btn" data-n-buzon="' + texto(x.correo) + '">Ver el buzón de pruebas</button>' : '') +
            '</div></form>';
        }).join('') +
        '<form class="kz-form" id="n-correo-nuevo" novalidate><label>Añadir otro correo<input type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" value="' + texto(pidiendo) + '"></label>' +
        '<button type="submit" class="u-btn">Enviarme un código</button></form>' +
        '<p class="kz-aviso" role="status">' + texto(aviso2) + '</p>';
      var nuevo = $('n-correo-nuevo');
      nuevo.onsubmit = function (e) {
        e.preventDefault();
        var i = nuevo.querySelector('input'), b = nuevo.querySelector('button');
        pidiendo = i.value; b.disabled = true; b.textContent = 'Enviando…';
        C2.anadir(i.value).then(function (r) { pidiendo = ''; aviso2 = 'Te hemos enviado un código a ' + r.correo + ': escríbelo aquí arriba.'; cargar(); },
          function (x) { b.disabled = false; b.textContent = 'Enviarme un código'; aviso2 = String(x.message).replace(/^\w+:\s*/, ''); pintar(lista); });
      };
      Array.prototype.forEach.call(caja.querySelectorAll('[data-n-confirmar]'), function (f) {
        f.onsubmit = function (e) {
          e.preventDefault();
          var b = f.querySelector('button[type=submit]');
          b.disabled = true;
          C2.confirmar(f.getAttribute('data-n-confirmar'), f.querySelector('input').value).then(function (r) {
            aviso2 = r && r.ok ? 'Listo: ya puedes entrar también con ' + r.correo + '.' : (r && r.error) || 'No se ha podido confirmar.';
            cargar();
          }, function (x) { b.disabled = false; aviso2 = String(x.message).replace(/^\w+:\s*/, ''); pintar(lista); });
        };
      });
      Array.prototype.forEach.call(caja.querySelectorAll('[data-n-reenviar]'), function (b) {
        b.onclick = function () {
          b.disabled = true;
          C2.anadir(b.getAttribute('data-n-reenviar')).then(function (r) { aviso2 = 'Te hemos enviado otro código a ' + r.correo + '.'; cargar(); },
            function (x) { b.disabled = false; aviso2 = String(x.message).replace(/^\w+:\s*/, ''); pintar(lista); });
        };
      });
      // Local y DEV: el código del buzón de pruebas, como en la pantalla de entrar.
      Array.prototype.forEach.call(caja.querySelectorAll('[data-n-buzon]'), function (b) {
        b.onclick = function () {
          window.UG.buzon(b.getAttribute('data-n-buzon')).then(function (ms) {
            aviso2 = !ms ? 'Aquí no hay buzón de pruebas para ese correo.' : !ms.length ? 'No ha llegado nada a ese correo.' : 'Buzón de pruebas: ' + ms[0].asunto;
            pintar(lista);
          });
        };
      });
      Array.prototype.forEach.call(caja.querySelectorAll('[data-n-quitar]'), function (b) {
        b.onclick = function () {
          var c = b.getAttribute('data-n-quitar');
          if (b.getAttribute('data-seguro') !== '1') { b.setAttribute('data-seguro', '1'); b.textContent = '¿Seguro? Quitar'; return; }
          b.disabled = true;
          C2.quitar(c).then(function () { aviso2 = 'Quitado: con ' + c + ' ya no se entra en tu cuenta.'; cargar(); },
            function (x) { b.disabled = false; aviso2 = String(x.message).replace(/^\w+:\s*/, ''); pintar(lista); });
        };
      });
    }
    function cargar() {
      C2.mios().then(pintar, function (x) { if (document.body.contains(caja)) caja.innerHTML = '<h3>Tus correos</h3><p class="kz-aviso">' + texto(String(x.message).replace(/^\w+:\s*/, '')) + '</p>'; });
    }
    caja.innerHTML = '<h3>Tus correos</h3><p class="u-nota">Cargando…</p>';
    cargar();
  }

  /**
   * T0432 · «Avisos al móvil» en el Perfil del marco (con Supabase y la clave de los avisos en el montaje): recibirlos en este
   * dispositivo, mandarse uno de prueba, dejar de recibirlos y los últimos que te han llegado, con cuánto han tardado (lo
   * apunta el móvil al recibirlos). En el iPhone solo llegan con la app en la pantalla de inicio: si no lo está, lo dice.
   * Lo pinta en #n-avisos.
   */
  function avisosPerfil() {
    var caja = $('n-avisos'), A = window.UG.avisos;
    if (!caja || !A) return;
    var aviso2 = '', ocupado = false;
    function limpio(x) { return String((x && x.message) || x).replace(/^\w+:\s*/, ''); }
    function cuando(iso) {
      var d = new Date(iso), hoy = new Date(), ayer = new Date(Date.now() - 864e5);
      var h = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      if (d.toDateString() === hoy.toDateString()) return 'hoy, ' + h;
      if (d.toDateString() === ayer.toDateString()) return 'ayer, ' + h;
      return d.getDate() + '/' + (d.getMonth() + 1) + ', ' + h;
    }
    function tardo(a, b) {
      var s = Math.max(0, Math.round((new Date(b) - new Date(a)) / 1000));
      return s < 60 ? s + ' s' : s < 3600 ? Math.round(s / 60) + ' min' : Math.round(s / 360) / 10 + ' h';
    }
    /** Qué le ha pasado a un aviso, en palabras. */
    function como(x) {
      if (x.recibido) return 'Llegó en ' + tardo(x.enviado, x.recibido) + (x.abierto ? ' · lo abriste' : '');
      if (x.resultado === 'Enviado') return 'No ha llegado';
      if (x.resultado === 'Caducado') return 'No ha llegado: ese dispositivo ya no existe';
      if (x.resultado === 'Enviando') return 'Saliendo…';
      return 'No ha salido (' + x.resultado + ')';
    }
    function pintar(est, mios) {
      if (!document.body.contains(caja)) return;
      mios = mios || { dispositivos: [], avisos: [] };
      var h = '<h3>Avisos al móvil</h3>', botones = '';
      if (!est.soportado) {
        h += '<p class="u-nota">' + (est.ios && !est.instalada ?
          'En el iPhone, los avisos solo llegan con Utilo en la pantalla de inicio: en Safari, Compartir › Añadir a pantalla de inicio, y ábrela desde allí.' :
          'Este navegador no puede recibir avisos.') + '</p>';
      } else if (est.permiso === 'denied') {
        h += '<p class="u-nota">Has dicho que no a los avisos de Utilo en este dispositivo: se cambia en sus ajustes (Notificaciones › Utilo).</p>';
      } else if (!est.activo) {
        h += '<p class="u-nota">Activa los avisos y te llegarán aquí, aunque no tengas Utilo abierta.</p>';
        botones = '<button type="button" class="u-btn u-btn-accion" data-n-avisos="activar">Recibir avisos aquí</button>';
      } else {
        h += '<p class="u-nota">Este dispositivo recibe los avisos.</p>';
        botones = '<button type="button" class="u-btn u-btn-accion" data-n-avisos="prueba">Mandarme un aviso de prueba</button>' +
          '<button type="button" class="u-btn" data-n-avisos="desactivar">Dejar de recibirlos aquí</button>';
      }
      if (botones) h += '<div class="n-botones">' + botones + '</div>';
      h += '<p class="kz-aviso" role="status">' + texto(aviso2) + '</p>';
      var ds = (mios.dispositivos || []).filter(function (x) { return x.activa; });
      if (ds.length) h += '<p class="u-nota">Los reciben: ' + texto(ds.map(function (x) { return x.dispositivo; }).join(', ')) + '.</p>';
      var as = (mios.avisos || []).slice(0, 10);
      if (as.length) {
        h += '<h4>Los últimos</h4><ul class="n-avisos-lista">' + as.map(function (x) {
          return '<li><span>' + texto(x.titulo) + '</span><span class="u-nota">' + texto(cuando(x.enviado) + ' · ' + x.dispositivo + ' · ' + como(x)) + '</span></li>';
        }).join('') + '</ul>';
      }
      caja.innerHTML = h;
      Array.prototype.forEach.call(caja.querySelectorAll('[data-n-avisos]'), function (b) {
        b.onclick = function () {
          if (ocupado) return;
          var que = b.getAttribute('data-n-avisos');
          if (que === 'desactivar' && b.getAttribute('data-seguro') !== '1') { b.setAttribute('data-seguro', '1'); b.textContent = '¿Seguro? Dejar de recibirlos'; return; }
          ocupado = true; b.disabled = true;
          var p = que === 'activar' ? A.activar().then(function () { aviso2 = 'Listo: los avisos te llegarán aquí. Prueba a mandarte uno.'; })
            : que === 'prueba' ? A.prueba().then(function (r) {
              aviso2 = !r || !r.dispositivos ? 'No hay ningún dispositivo que reciba avisos.' :
                r.enviados ? 'Mandado' + (r.dispositivos > 1 ? ' a ' + r.enviados + ' de ' + r.dispositivos + ' dispositivos' : '') + ': tiene que llegarte en unos segundos.' :
                'No ha salido: ' + ((r.errores || [])[0] || {}).detalle;
            })
            : A.desactivar().then(function () { aviso2 = 'Este dispositivo ya no recibe avisos.'; });
          p.then(null, function (x) { aviso2 = limpio(x); }).then(function () { ocupado = false; cargar(); });
        };
      });
    }
    function cargar() {
      A.estado().then(function (est) {
        return A.mios().then(function (m) { pintar(est, m); }, function (x) { aviso2 = aviso2 || limpio(x); pintar(est, null); });
      });
    }
    caja.innerHTML = '<h3>Avisos al móvil</h3><p class="u-nota">Cargando…</p>';
    cargar();
  }

  /** Comprueba con el motor quién eres y qué ves; si ha cambiado, vuelve a pintar el marco. */
  function comprobar() {
    var antes = cred, como = antes.como ? antes.correo : '';
    entrar(como).then(function (r) {
      if (cred !== antes) return; // mientras, se ha entrado como otra persona o se ha vuelto
      var nuevo = credDe(r);
      nuevo.correo = nuevo.correo || cred.correo;
      if (como && !nuevo.como) { volver(); return; }
      if (JSON.stringify(nuevo) === JSON.stringify(cred)) return;
      if (como) guardarComo(nuevo); else guardar(nuevo);
      marco(nuevo);
    }, function (e) {
      if (cred !== antes) return;
      // T0273: el motor ya no deja ver como esa persona (ya no administras, o ella ya no puede entrar): a tu cuenta.
      if (/^COMO:/.test(e.message)) { volver(String(e.message).replace(/^COMO:\s*/, '')); return; }
      if (e.acceso) {
        var yo = antes.como ? antes.como.correo : antes.correo;
        borrar(); borrarComo(); soltarTablas(yo, true); acceso(String(e.message).replace(/^ACCESO:\s*/, '')); return;
      }
      if (/^CONECTAR:/.test(e.message)) { conectarYEntrar(e); return; }
      aviso('No se ha podido comprobar tu acceso: ' + String(e.message).replace(/^\w+:\s*/, ''));
    });
  }

  /* ---------- navegación ---------- */

  document.addEventListener('click', function (e) {
    // T0273: «Entrar como otra persona» (en Perfil) y «Volver a mi cuenta» (franja y Perfil), estén donde estén.
    var b = e.target.closest && e.target.closest('[data-n-como], [data-n-volver], [data-n-versiones]');
    if (b && cred) { e.preventDefault(); if (b.hasAttribute('data-n-volver')) volver(); else if (b.hasAttribute('data-n-versiones')) verVersiones(); else verComo(); return; }
    var a = e.target.closest && e.target.closest('a[data-sx]');
    if (!a || !cred || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    // T0415: sin Perfil en el menú, el Perfil del marco es una ventana, no una sección.
    if (a.getAttribute('data-sx') === 'PERFIL' && sinPerfil() && (seccion('PERFIL') || {}).propia) { verPerfil(); return; }
    abrir(a.getAttribute('data-sx'), true, a.getAttribute('href'));
  });
  try { history.scrollRestoration = 'manual'; } catch (e) {} // T0420: dónde estabas lo pone abrir() (alSitio)
  window.addEventListener('popstate', function () { if (cred) abrir(pedida() || menu()[0].id, false); });

  /* ---------- arranque ---------- */

  /** T0386 · Entrar sin el botón (ya hay sesión): «entrar», y el marco; si no deja, la pantalla de entrada con el motivo. */
  function entrarYa() {
    entrar().then(function (r) {
      window.UG.recordarCorreo(r.correo || '');
      var c = credDe(r);
      if (cred && copiaDe(cred) !== copiaDe(c)) soltarTablas();
      guardar(c); borrarComo(); marco(c);
    }, function (e) { borrar(); acceso(String(e.message).replace(/^ACCESO:\s*/, '')); });
  }

  function arrancar() {
    // T0386: con Supabase (acceso-supabase.js), si se vuelve de Google se espera a tener la sesión y se entra.
    if (window.UG.volviendo) {
      var v = window.UG.volviendo;
      window.UG.volviendo = null;
      cargando('Entrando…');
      v.then(function (vuelve) { if (vuelve) entrarYa(); else arrancar(); }, function (e) { acceso(String(e.message).replace(/^ACCESO:\s*/, '')); });
      return;
    }
    // T0386: con la sesión de Supabase guardada pero sin saber aún quién eres (otro dispositivo, otra persona), se entra solo.
    if (window.UG.supabase && window.UG.tieneSesion() && !(leer() || {}).persona) { cargando('Entrando…'); entrarYa(); return; }
    if (new URLSearchParams(location.search).get('salir') !== null) {
      soltarTablas((leer() || {}).correo, true);  // T0275: la copia de quien sale no se queda en el dispositivo (T0273: ni la de «como»)
      borrar(); borrarComo(); window.UG.salir(); history.replaceState(null, '', location.pathname);
    }
    var guardada = leer();
    // T0275: si la llave de Google es de otra cuenta que la sesión guardada, no se pinta lo de la guardada.
    var deLlave = String((window.UG.correo && window.UG.correo()) || '').trim().toLowerCase();
    if (guardada && deLlave && guardada.correo && deLlave !== String(guardada.correo).trim().toLowerCase()) guardada = null;
    if (guardada && guardada.persona && (window.UG.llave() || (window.UG.tieneSesion && window.UG.tieneSesion()))) {
      // T0273: si en esta pestaña estaba viendo como otra persona (y es la misma cuenta), sigue igual.
      var como = leerComo();
      if (como && (!como.como || bajo(como.como.correo) !== bajo(guardada.correo))) { borrarComo(); como = null; }
      marco(como || guardada);  // al momento, con lo guardado
      comprobar();      // y por detrás, con el motor
    } else { borrarComo(); acceso(''); }
  }
  // Con la página ya leída: así, una sección que va en la misma página (después de este archivo) ya se ha registrado.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
