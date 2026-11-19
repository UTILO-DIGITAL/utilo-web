/*
 * T0446 · El marco de la app «Utilo DEV» en las páginas de una rama (dev-ramas/<rama>/…): la única marca de DEV.
 *
 * - Un borde amarillo alrededor de la app que sigue las esquinas del iPhone. Abajo, encima de la franja de salir del
 *   iPhone (que queda amarilla y vacía), la línea «DEV · rama · persona», que abre «Probar en DEV» (dev-ramas/?probar).
 * - La app sube lo que tenía pegado abajo (la barra de secciones, los avisos) para que la línea no tape nada.
 * - Recuerda dónde se ha dejado la app (la app DEV vuelve ahí al abrirse) y, si se ha entrado aquí, guarda la sesión de
 *   esta persona para la próxima vez que se elija (la de la página se renueva sola y la vieja deja de valer).
 *
 * Lo carga nucleo/nucleo.js (y nucleo/publica-supabase.js) de la rama cuando la página está en dev-ramas/<rama>/, desde
 * dev-ramas/marco.js: el de main, el mismo para todas las ramas. Lo que guarda es lo de la app DEV (dev-ramas/index.html):
 * localStorage «dev_app».
 */
(function () {
  'use strict';
  if (window.DEV_MARCO) return;
  var m = /^(.*\/dev-ramas\/)([^/]+)\/(.*)$/.exec(location.pathname);
  if (!m) return;
  window.DEV_MARCO = true;
  var APP = m[1], CARPETA = decodeURIComponent(m[2]), RUTA = m[3].replace(/[^/]*$/, ''); // dev/konamigas/
  var CLAVE = 'dev_app';

  function leer() { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null') || {}; } catch (e) { return {}; } }
  function guardar(o) { try { localStorage.setItem(CLAVE, JSON.stringify(o)); } catch (e) {} }
  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  var E = leer();
  var a = E.actual && E.actual.carpeta === CARPETA && E.actual.ruta === RUTA ? E.actual : null;

  /** La sesión de esta página (la de acceso-supabase.js) → la de esa persona en la app DEV. */
  function guardarSesion() {
    if (!a || !a.clave || a.publica) return;
    var s = null;
    try { s = JSON.parse(localStorage.getItem('sb_' + a.clave + '_dev') || 'null'); } catch (e) {}
    if (!s || !s.refresh_token) return;
    var E2 = leer(), quien = a.como && a.como.tipo === 'prueba' ? a.como.correo : 'yo';
    // Si dentro se ha entrado con otra cuenta, no es la de esa persona.
    if (quien !== 'yo' && s.correo && s.correo !== quien) return;
    if (quien === 'yo' && /@ejemplo\.com$/.test(s.correo || '')) return;
    E2.sesiones = E2.sesiones || {};
    E2.sesiones[a.ini] = E2.sesiones[a.ini] || {};
    E2.sesiones[a.ini][quien] = s;
    guardar(E2);
  }

  /** Dónde está la app ahora (con su sección: ?s=…), para volver aquí al abrirla. */
  function recordar() {
    var E2 = leer();
    E2.ultima = location.pathname + location.search + location.hash;
    guardar(E2);
    guardarSesion();
  }

  function etiqueta() {
    var rama = a && a.tarea ? a.tarea + (a.titulo ? ' ' + a.titulo : '') : CARPETA;
    var quien = !a ? '' : a.publica ? 'sin entrar' : a.como && a.como.tipo === 'prueba' ? (a.como.nombre || a.como.correo) + (a.como.rol ? ' · ' + a.como.rol : '') : 'Yo';
    return ['DEV', rama, quien].filter(Boolean).join(' · ');
  }

  var AMARILLO = '#F5C518', ABAJO = '30px';
  var css = ':root{--dev-linea:' + ABAJO + ';--dev-abajo:calc(' + ABAJO + ' + env(safe-area-inset-bottom, 0px))}' +
    // La franja de la hora (app instalada) toma el COLOR de fondo del body, no sus imágenes: amarillo, como el borde, y
    // encima el fondo de la app como imagen (pintar), para que la app se vea igual.
    'html.dev-app body{background-color:' + AMARILLO + ' !important}' +
    'html.dev-app body{padding-bottom:var(--dev-abajo)}' +
    'html.dev-app body.u-con-barra{padding-bottom:calc(var(--alto-barra) + var(--e1) + var(--dev-abajo)) !important}' +
    // La barra de secciones del móvil, encima de la línea; sin su relleno de abajo (ahora lo pone la línea).
    'html.dev-app .u .sx,html.dev-app .sx.u-sx{bottom:var(--dev-abajo);padding-bottom:0}' +
    'html.dev-app .u .u-aviso,html.dev-app .u .rp-toast,html.dev-app .u .eco-fab,html.dev-app #alta-btn,html.dev-app #alta-aviso,html.dev-app #estado-aviso{translate:0 calc(-1 * var(--dev-linea))}' +
    '#dev-marco{position:fixed;inset:0;z-index:2147483000;pointer-events:none}' +
    // Una raya amarilla de 3px arriba, fija: desde iOS 26 la franja de la hora toma el color de lo que va fijo arriba (si
    // no, el de la cabecera de la app, que va pegada arriba).
    '#dev-marco .dev-hueco{position:absolute;top:3px;left:6px;right:6px;bottom:var(--dev-abajo);border-radius:14px;box-shadow:0 0 0 240px ' + AMARILLO + '}' +
    '#dev-marco a{position:absolute;left:0;right:0;bottom:env(safe-area-inset-bottom, 0px);height:var(--dev-linea);pointer-events:auto;display:flex;align-items:center;justify-content:center;gap:6px;' +
    'padding:0 16px;color:#1C1C1C;text-decoration:none;font:600 12px/1 system-ui,-apple-system,sans-serif}' +
    '#dev-marco a span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#dev-marco a:focus-visible{outline:2px solid #1C1C1C;outline-offset:-4px;border-radius:8px}';

  function pintar() {
    if (document.getElementById('dev-marco')) return;
    // El fondo de la app, como imagen encima del amarillo (si ya lleva una, como la plataforma de Utilo, se queda la suya).
    var cs = window.getComputedStyle ? window.getComputedStyle(document.body) : null;
    if (cs && cs.backgroundImage === 'none' && !document.getElementById('dev-marco-css')) {
      var vacio = function (c) { return !c || /rgba\(0, 0, 0, 0\)|transparent/.test(c); };
      var c = vacio(cs.backgroundColor) ? window.getComputedStyle(document.documentElement).backgroundColor : cs.backgroundColor;
      if (vacio(c)) c = '#FFFFFF';
      document.body.style.backgroundImage = 'linear-gradient(' + c + ', ' + c + ')';
    }
    var st = document.createElement('style');
    st.id = 'dev-marco-css';
    st.textContent = css;
    document.head.appendChild(st);
    document.documentElement.classList.add('dev-app');
    var t = document.querySelector('meta[name="theme-color"]');
    if (t) t.setAttribute('content', AMARILLO);
    var d = document.createElement('div');
    d.id = 'dev-marco';
    d.innerHTML = '<div class="dev-hueco"></div><a href="' + texto(APP) + '?probar" aria-label="' + texto(etiqueta()) + '. Abrir Probar en DEV">' +
      '<span>' + texto(etiqueta()) + '</span><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1C1C1C" ' +
      'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg></a>';
    document.body.appendChild(d);
  }

  // nucleo.js rehace el body al pintar el marco (document.body.innerHTML): se vuelve a poner si desaparece.
  function vigilar() {
    pintar();
    if (window.MutationObserver) new MutationObserver(function () { if (!document.getElementById('dev-marco')) pintar(); })
      .observe(document.body, { childList: true });
  }
  if (document.body) vigilar(); else document.addEventListener('DOMContentLoaded', vigilar);

  recordar();
  window.addEventListener('popstate', recordar);
  window.addEventListener('hashchange', recordar);
  window.addEventListener('pagehide', recordar);
  document.addEventListener('visibilitychange', function () { if (document.hidden) recordar(); });
  // La dirección cambia sin aviso al ir de sección (history.replaceState/pushState): se mira de vez en cuando.
  // También la sesión, que llega después (la vuelta de Google) y se renueva sola.
  setInterval(recordar, 3000);
})();
