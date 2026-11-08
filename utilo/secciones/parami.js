/*
 * Para mí · plataforma interna de Utilo sobre Supabase (T0387) · clientes/utilo/modulos/parami de utilo-apps
 *
 * Lo primero que abre cada persona (plan de la plataforma, «Vista Para mí»), igual en el móvil que en el ordenador:
 * - Te espera: las tareas que esperan su respuesta (Necesita tu respuesta, si la pidió) o su revisión (Para revisar, si la
 *   revisa), lo más antiguo arriba: desde que entraron en ese estado (ESTADO_DESDE del tablero).
 * - Lo siguiente: sus tres primeras tareas En cola (ASIGNADO), por prioridad, después por deadline y, a igualdad, por cuántas
 *   tareas desbloquean (DESBLOQUEA); lo urgente, delante, como en la cola. Cada una con su herramienta.
 * - Avisos: sus tareas En curso con el deadline pasado (solo si hay).
 * Las preguntas se responden ahí mismo (responder() de la base, como por Telegram: la respuesta va a la DESCRIPCION y a la
 * bitácora y la tarea vuelve a la cola); lo escrito se guarda mientras la vista se pone al día.
 * Si la respondida es AUTÓNOMA y vuelve a En cola, un recuadro (hasta cerrarlo) lleva a lanzar «Autónomo» en GitHub: con el
 * agente en la fase 1 nadie la coge sola. En Lo siguiente, las autónomas llevan su etiqueta.
 * - En curso: lo demás que tiene entre manos (sin las vencidas), con su fase y quién la lleva.
 * Arriba, el saludo, un enlace al mapa de Entregas (T0415, si se ve) y tres cifras (te esperan, en curso, tu cola). Debajo, en una pantalla grande tres columnas (Te espera |
 * Lo siguiente | Avisos y En curso), en una mediana dos (Te espera | lo demás) y en el móvil una. Cada tarjeta dice de quién viene (quién la hace o
 * pregunta), su iniciativa si se ven varias y, en una revisión, su PR. Los nombres, de personas_gestion() (guardados).
 * Cada tarea abre su ficha en Tareas. Lee la vista TABLERO, con la sesión de quien ha entrado (lo que ve lo dicen sus
 * roles) y se pone al día sola cuando alguien cambia una tarea (Realtime). Los cálculos (CALC) se prueban en node
 * (herramientas/probar-plataforma.js). Estilos: estilos/kanban.css (.pm-*), con los colores de base.css.
 */
(function () {
  'use strict';
  var T = 'TABLERO';
  var SIGUIENTES = 3;
  var P = { '!!!!': 4, '!!!': 3, '!!': 2, '!': 1 };

  function hoyIso(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dia(s) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || '')); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; }
  function ms(s) { var t = s ? Date.parse(s) : NaN; return isNaN(t) ? Infinity : t; }
  /** Días enteros de la fecha a a la b ('aaaa-mm-dd'). */
  function diasEntre(a, b) {
    var x = /^(\d{4})-(\d\d)-(\d\d)/.exec(a), y = /^(\d{4})-(\d\d)-(\d\d)/.exec(b);
    if (!x || !y) return null;
    return Math.round((Date.UTC(+y[1], +y[2] - 1, +y[3]) - Date.UTC(+x[1], +x[2] - 1, +x[3])) / 864e5);
  }

  /** Lo que espera a esa persona (su id): su respuesta o su revisión, lo más antiguo arriba (y, a igualdad, por ID). */
  function esperan(filas, yo) {
    if (!yo) return [];
    return (filas || []).filter(function (t) {
      return t.EN_MANOS_TIPO === 'persona' && t.EN_MANOS_DE === yo && (t.ESTADO === 'Necesita tu respuesta' || t.ESTADO === 'Para revisar');
    }).sort(function (a, b) { return (ms(a.ESTADO_DESDE) - ms(b.ESTADO_DESDE)) || String(a.ID).localeCompare(String(b.ID)); });
  }

  /** Sus primeras n tareas En cola: urgentes delante, prioridad, deadline (sin él, detrás), cuántas desbloquea y por ID. */
  function siguientes(filas, yo, n) {
    if (!yo) return [];
    return (filas || []).filter(function (t) { return t.ESTADO === 'En cola' && t.ASIGNADO === yo; }).sort(function (a, b) {
      return ((b.URGENTE ? 1 : 0) - (a.URGENTE ? 1 : 0)) || ((P[b.P] || 0) - (P[a.P] || 0)) ||
        (dia(a.DEADLINE) || '9999').localeCompare(dia(b.DEADLINE) || '9999') ||
        ((Number(b.DESBLOQUEA) || 0) - (Number(a.DESBLOQUEA) || 0)) || String(a.ID).localeCompare(String(b.ID));
    }).slice(0, n == null ? SIGUIENTES : n);
  }

  /** Sus tareas En curso con el deadline pasado (antes de hoy), la más vencida arriba. */
  function avisos(filas, yo, hoy) {
    if (!yo) return [];
    hoy = hoy || hoyIso();
    return (filas || []).filter(function (t) { var d = dia(t.DEADLINE); return t.ESTADO === 'En curso' && t.ASIGNADO === yo && d && d < hoy; })
      .sort(function (a, b) { return dia(a.DEADLINE).localeCompare(dia(b.DEADLINE)) || String(a.ID).localeCompare(String(b.ID)); });
  }

  /** Lo demás que tiene En curso (sin las vencidas, que van en Avisos): primero las de deadline más cercano, después por ID. */
  function enCurso(filas, yo, hoy) {
    if (!yo) return [];
    hoy = hoy || hoyIso();
    return (filas || []).filter(function (t) { var d = dia(t.DEADLINE); return t.ESTADO === 'En curso' && t.ASIGNADO === yo && !(d && d < hoy); })
      .sort(function (a, b) { return (dia(a.DEADLINE) || '9999').localeCompare(dia(b.DEADLINE) || '9999') || String(a.ID).localeCompare(String(b.ID)); });
  }

  /** Cuánto hace de esa fecha y hora: «hace un momento», «hace 3 horas», «desde ayer», «hace 5 días». */
  function hace(desde, ahora) {
    var t = ms(desde);
    if (t === Infinity) return '';
    ahora = ahora == null ? Date.now() : ahora;
    var min = Math.floor((ahora - t) / 6e4);
    if (min < 60) return min <= 1 ? 'hace un momento' : 'hace ' + min + ' minutos';
    var d = diasEntre(hoyIso(new Date(t)), hoyIso(new Date(ahora)));
    if (d === 0) { var h = Math.floor(min / 60); return h === 1 ? 'hace 1 hora' : 'hace ' + h + ' horas'; }
    return d === 1 ? 'desde ayer' : 'hace ' + d + ' días';
  }

  /** ¿Hay que lanzar «Autónomo» para que siga? Si es AUTÓNOMA y, al responderla, ha vuelto a En cola (no a Esperando). */
  function lanzar(t, estado) { return !!(t && t.AUTONOMA) && estado === 'En cola'; }

  /** Las cifras de arriba: lo que te espera (respuestas y revisiones), lo tuyo En curso (y cuántas vencidas) y tu cola. */
  function resumen(filas, yo, hoy) {
    var es = esperan(filas, yo), mias = yo ? (filas || []).filter(function (t) { return t.ASIGNADO === yo; }) : [];
    var cola = mias.filter(function (t) { return t.ESTADO === 'En cola'; });
    return {
      esperan: es.length,
      respuestas: es.filter(function (t) { return t.ESTADO === 'Necesita tu respuesta'; }).length,
      revisiones: es.filter(function (t) { return t.ESTADO === 'Para revisar'; }).length,
      enCurso: mias.filter(function (t) { return t.ESTADO === 'En curso'; }).length,
      vencidas: avisos(filas, yo, hoy).length,
      enCola: cola.length,
      autonomas: cola.filter(function (t) { return t.AUTONOMA; }).length
    };
  }

  /** La última PR de DOCUMENTOS_RELEVANTES («PR utilo-apps #235: https://…»): { numero, url } o null. */
  function prDe(docs) {
    var r = null;
    String(docs || '').split('\n').forEach(function (l) {
      var m = /^\s*PR\b[^#\n]*#(\d+)\s*:?\s*(https?:\/\/\S+)/.exec(l);
      if (m) r = { numero: Number(m[1]), url: m[2] };
    });
    return r;
  }

  var CALC = { lanzar: lanzar, esperan: esperan, siguientes: siguientes, avisos: avisos, enCurso: enCurso, resumen: resumen, prDe: prDe, hace: hace, diasEntre: diasEntre, hoyIso: hoyIso };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  var RAIZ = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/utilo\/secciones\/[^/]*$/, '') : '../../'; })();
  var VERSION = (function () { var s = document.currentScript && document.currentScript.src; var m = s && /[?&]v=([^&]+)/.exec(s); return m ? m[1] : '1'; })();
  var ICO_MAPA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14"/><path d="M15 6v14"/></svg>';
  var ICO_BIEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>';
  var ICO_FUERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  var TI = 'INICIATIVAS';
  /** Días que una tarea puede esperar sin que se marque: el plan avisa si nadie revisa en 3 días. */
  var DIAS_ANTIGUA = 3;
  /** La acción «Autónomo» en GitHub (Run workflow, con la tarea). En el móvil, en el navegador con la versión de escritorio. */
  var AUTONOMO = 'https://github.com/UTILO-DIGITAL/utilo-apps/actions/workflows/autonomo.yml';

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fechaEs(s) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function leerLocal(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function guardarLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function saludo(d) { var h = d.getHours(); return h >= 6 && h < 14 ? 'Buenos días' : h >= 14 && h < 21 ? 'Buenas tardes' : 'Buenas noches'; }
  function hoyLargo(d) {
    var s = '';
    try { s = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { s = fechaEs(hoyIso(d)); }
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function uno(n, una, varias) { return n + ' ' + (n === 1 ? una : varias); }

  /** La hoja del tablero (kanban.css), una vez por página; mientras llega, la sección no se ve (como Entregas). */
  function estilos(el) {
    var l = document.getElementById('kb-css');
    if (l && l.getAttribute('data-lista')) return;
    if (!l) {
      l = document.createElement('link');
      l.id = 'kb-css'; l.rel = 'stylesheet'; l.href = RAIZ + 'estilos/kanban.css?v=' + encodeURIComponent(VERSION);
      l.addEventListener('load', function () { l.setAttribute('data-lista', '1'); });
      document.head.appendChild(l);
    }
    el.style.visibility = 'hidden';
    var ver = function () { el.style.visibility = ''; };
    l.addEventListener('load', ver); l.addEventListener('error', ver);
    setTimeout(ver, 3000);
  }

  window.UN.registrar('PARAMI', {
    abrir: function (el, ctx) {
      estilos(el);
      var yo = ctx.personaId || '';
      // T0415 · Un enlace al mapa de Entregas, si quien ha entrado tiene Entregas en su menú.
      var MAPA = (ctx.secciones || []).some(function (s) { return s && s.id === 'ENTREGAS'; });
      var CLAVE = 'pm_' + String(ctx.correo || ctx.persona || '').toLowerCase().replace(/\W+/g, '');
      var GENTE = leerLocal(CLAVE + '_gente', {});   // id de persona → nombre (personas_gestion), guardado en el dispositivo
      var leido = false;
      var lanzarId = '';                 // la autónoma recién respondida, para lanzar «Autónomo»
      var borrador = {}, enviando = {};   // lo escrito en cada respuesta (por tarea) y las que se están mandando
      el.innerHTML = '<section class="pm"><div id="pm-cont"></div></section>';
      var cont = el.querySelector('#pm-cont');

      function nombre(id) { return id ? GENTE[id] || '' : ''; }
      function deQuien(t) { return t.EMPLEADO ? String(t.EMPLEADO).charAt(0).toUpperCase() + String(t.EMPLEADO).slice(1).replace(/_/g, ' ') : nombre(t.ASIGNADO); }
      function ficha(t) { return '?s=tablero&amp;t=' + encodeURIComponent(t.ID); }

      /** Una tarea: su enlace a la ficha (cabecera, título y lo de dentro) y, debajo y fuera del enlace, lo de después. */
      function tarjeta(t, clase, dentro, despues, varias) {
        var ini = varias ? ctx.tablas.fila(TI, t.INICIATIVA) : null;
        return '<li class="pm-c ' + clase + '"><a class="pm-t" href="' + ficha(t) + '" data-sx="TABLERO">' +
          '<span class="pm-top"><span class="pm-id">' + texto(t.ID) + '</span>' +
            (t.ENTREGA_CORTA ? '<span class="pm-ent">' + texto(t.ENTREGA_CORTA) + '</span>' : '') +
            (varias ? '<span class="pm-ini">' + texto((ini && ini.NOMBRE) || t.INICIATIVA) + '</span>' : '') + '</span>' +
          '<span class="pm-tit">' + texto(t.TITULO) + '</span>' + dentro + '</a>' + (despues || '') + '</li>';
      }

      function bloque(id, titulo, n, cuerpo, extra) {
        return '<section class="pm-b' + (extra || '') + '" id="' + id + '"><h2 class="pm-h">' + texto(titulo) + (n ? ' <span class="pm-n">' + n + '</span>' : '') + '</h2>' + cuerpo + '</section>';
      }

      function cifra(ir, n, que, nota, clase) {
        return '<button type="button" class="pm-cifra' + (clase || '') + '" data-ir="' + ir + '"><b>' + n + '</b><span>' + texto(que) + '</span>' +
          (nota ? '<small>' + nota + '</small>' : '<small>&nbsp;</small>') + '</button>';
      }

      function pintar() {
        var fs = ctx.tablas.filas(T), d = new Date(), hoy = hoyIso(d), ahora = d.getTime();
        if (!fs.length && !leido) { cont.innerHTML = '<p class="pm-vacio">Cargando lo tuyo…</p>'; return; }
        if (!yo) { cont.innerHTML = '<p class="pm-vacio">No sabemos quién eres en la base todavía. Vuelve a entrar.</p>'; return; }
        var es = esperan(fs, yo), si = siguientes(fs, yo), av = avisos(fs, yo, hoy), ec = enCurso(fs, yo, hoy), r = resumen(fs, yo, hoy);
        var varias = fs.reduce(function (o, t) { o[t.INICIATIVA] = 1; return o; }, {});
        varias = Object.keys(varias).length > 1;

        var h = '<header class="pm-cab"><div><p class="pm-hola">' + texto(saludo(d) + ', ' + String(ctx.persona || '').split(' ')[0]) + '</p>' +
          '<p class="pm-fecha">' + texto(hoyLargo(d)) + '</p></div>' +
          '<span class="pm-acc">' + (MAPA ? '<a class="sec pm-mapa" href="?s=entregas&amp;v=mapa" data-sx="ENTREGAS">' + ICO_MAPA + 'Ver el mapa</a>' : '') +
          '</span></header>'; // T0422: sin ↻ (va en directo), como Tareas y Entregas
        h += '<div class="pm-res">' +
          cifra('pm-espera', r.esperan, r.esperan === 1 ? 'te espera' : 'te esperan',
            [r.respuestas ? uno(r.respuestas, 'respuesta', 'respuestas') : '', r.revisiones ? uno(r.revisiones, 'revisión', 'revisiones') : ''].filter(String).join(' · '), r.esperan ? ' pm-cifra-pr' : '') +
          cifra(r.vencidas ? 'pm-avisos' : 'pm-sig', r.enCurso, 'en curso', r.vencidas ? '<span class="pm-mal">' + uno(r.vencidas, 'vencida', 'vencidas') + '</span>' : '', r.vencidas ? ' pm-cifra-bl' : '') +
          cifra('pm-sig', r.enCola, 'en tu cola', r.autonomas ? uno(r.autonomas, 'autónoma', 'autónomas') : '') + '</div>';
        if (lanzarId) h += '<div class="pm-lanzar" role="status"><p><b>' + texto(lanzarId) + '</b> vuelve a la cola y es autónoma. Para que el agente la haga ya, ' +
          'lanza «Autónomo» en GitHub («Run workflow», con ' + texto(lanzarId) + '); si no, espera a que alguien la empiece.</p>' +
          '<div class="pm-lanzar-b"><a class="u-btn" href="' + AUTONOMO + '" target="_blank" rel="noopener">Lanzar Autónomo</a>' +
          '<button type="button" class="u-btn u-btn-texto" data-lanzar-no>Ahora no</button></div></div>';

        var izq = bloque('pm-espera', 'Te espera', es.length, es.length ? '<ul class="pm-l">' + es.map(function (t) {
          var resp = t.ESTADO === 'Necesita tu respuesta', cuanto = hace(t.ESTADO_DESDE, ahora);
          var quien = t.EMPLEADO || t.ASIGNADO !== yo ? deQuien(t) : '';   // si la lleva quien mira, no se dice
          var vieja = diasEntre(hoyIso(new Date(Date.parse(t.ESTADO_DESDE) || ahora)), hoy) >= DIAS_ANTIGUA;
          var pr = resp ? null : prDe(t.DOCUMENTOS_RELEVANTES);
          var dentro = '<span class="pm-meta"><span class="n-estado n-e-pr">' + (resp ? 'Contestar' : 'Revisar') + '</span>' +
            (quien ? '<span>' + texto((resp ? 'pregunta ' : 'la ha hecho ') + quien) + '</span>' : '') +
            (cuanto ? '<span class="pm-hace' + (vieja ? ' vieja' : '') + '">' + texto(cuanto) + '</span>' : '') + '</span>' +
            (resp && t.PREGUNTA ? '<span class="pm-q">' + texto(t.PREGUNTA) + '</span>' : '');
          var despues = resp
            ? '<form class="pm-resp" data-resp="' + texto(t.ID) + '"><label class="u-oculto" for="pm-r-' + texto(t.ID) + '">Tu respuesta a ' + texto(t.ID) + '</label>' +
              '<textarea id="pm-r-' + texto(t.ID) + '" rows="2" placeholder="Tu respuesta…"' + (enviando[t.ID] ? ' disabled' : '') + '>' + texto(borrador[t.ID] || '') + '</textarea>' +
              '<button class="u-btn" type="submit"' + (enviando[t.ID] ? ' disabled' : '') + '>' + (enviando[t.ID] ? 'Enviando…' : 'Responder') + '</button></form>'
            : '<div class="pm-acc">' + (pr ? '<a class="u-btn" href="' + texto(pr.url) + '" target="_blank" rel="noopener">' + ICO_FUERA + 'Ver la PR #' + pr.numero + '</a>' : '') +
              '<a class="u-btn' + (pr ? ' u-btn-texto' : '') + '" href="' + ficha(t) + '" data-sx="TABLERO">Abrir la ficha para revisarla</a></div>';
          return tarjeta(t, 's-pr', dentro, despues, varias);
        }).join('') + '</ul>' : '<div class="pm-libre">' + ICO_BIEN + '<p><b>Nada te espera.</b> Ninguna pregunta ni revisión pendiente.</p></div>');

        var cen = bloque('pm-sig', 'Lo siguiente', 0, si.length ? '<ol class="pm-l">' + si.map(function (t) {
          var dl = dia(t.DEADLINE), q = dl ? diasEntre(hoy, dl) : null;
          return tarjeta(t, 's-ni', '<span class="pm-meta">' +
            (t.URGENTE ? '<span class="u-chip">Urgente</span>' : '') + (t.AUTONOMA ? '<span class="u-chip" title="La puede hacer el agente autónomo">Autónoma</span>' : '') +
            '<span class="u-chip" title="Prioridad">' + texto(t.P) + '</span>' + (t.T ? '<span class="u-chip" title="Tamaño">' + texto(t.T) + '</span>' : '') +
            (t.HERRAMIENTA ? '<span class="u-chip pm-herr">' + texto(t.HERRAMIENTA) + '</span>' : '<span class="u-chip pm-sin">Sin herramienta</span>') +
            (dl ? '<span class="pm-dl' + (q < 0 ? ' vencida' : q <= 7 ? ' pronto' : '') + '">para el ' + fechaEs(dl) + '</span>' : '') +
            (Number(t.DESBLOQUEA) > 0 ? '<span class="pm-des">desbloquea ' + t.DESBLOQUEA + '</span>' : '') + '</span>', '', varias);
        }).join('') + '</ol>' + (r.enCola > si.length ? '<a class="pm-mas" href="?s=tablero" data-sx="TABLERO">Ver toda tu cola en Tareas (' + r.enCola + ')</a>' : '')
          : '<p class="pm-vacio">No tienes nada en cola.</p>');
        var der = '';
        if (av.length) der += bloque('pm-avisos', 'Avisos', av.length, '<ul class="pm-l">' + av.map(function (t) {
          var n = diasEntre(dia(t.DEADLINE), hoy);
          return tarjeta(t, 's-bl', '<span class="pm-meta"><span class="pm-dl vencida">Deadline el ' + fechaEs(t.DEADLINE) + ' · ' +
            (n === 1 ? 'venció ayer' : 'venció hace ' + n + ' días') + '</span></span>', '', varias);
        }).join('') + '</ul>', ' pm-avisos');
        der += bloque('pm-curso', 'En curso', ec.length, ec.length ? '<ul class="pm-l">' + ec.map(function (t) {
          var dl = dia(t.DEADLINE), q = dl ? diasEntre(hoy, dl) : null;
          return tarjeta(t, 's-ec', '<span class="pm-meta">' + (t.FASE ? '<span class="n-estado n-e-ec">' + texto(t.FASE) + '</span>' : '') +
            (t.EMPLEADO ? '<span>la lleva ' + texto(deQuien(t)) + '</span>' : '') +
            (dl ? '<span class="pm-dl' + (q <= 7 ? ' pronto' : '') + '">para el ' + fechaEs(dl) + '</span>' : '') +
            (t.ESTADO_DESDE ? '<span>empezada ' + texto(hace(t.ESTADO_DESDE, ahora)) + '</span>' : '') + '</span>', '', varias);
        }).join('') + '</ul>' : '<p class="pm-vacio">' + (av.length ? 'Nada más en curso.' : 'No tienes nada en curso.') + '</p>');
        // Tres columnas en una pantalla grande; en una mediana, la segunda y la tercera van juntas (CSS: .pm-cols).
        h += '<div class="pm-cols"><div class="pm-col pm-col-a">' + izq + '</div><div class="pm-col pm-col-b">' + cen + '</div><div class="pm-col pm-col-c">' + der + '</div></div>';

        // Repintar no quita lo que se estaba escribiendo: vuelve el foco a la misma caja, al final.
        var foco = document.activeElement && cont.contains(document.activeElement) && document.activeElement.id;
        cont.innerHTML = h;
        var a = foco && cont.querySelector('#' + foco);
        if (a && a.tagName === 'TEXTAREA') { a.focus(); a.selectionStart = a.selectionEnd = a.value.length; }
      }

      cont.addEventListener('click', function (e) {
        if (e.target.closest('[data-lanzar-no]')) { lanzarId = ''; pintar(); return; }
        var ir = e.target.closest('[data-ir]'), dst = ir && cont.querySelector('#' + ir.getAttribute('data-ir'));
        if (dst) dst.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      cont.addEventListener('input', function (e) {
        var f = e.target.closest('form[data-resp]');
        if (f && e.target.tagName === 'TEXTAREA') borrador[f.getAttribute('data-resp')] = e.target.value;
      });
      cont.addEventListener('submit', function (e) {
        var f = e.target.closest('form[data-resp]');
        if (!f) return;
        e.preventDefault();
        var id = f.getAttribute('data-resp'), a = f.querySelector('textarea'), txt = a ? a.value.trim() : '';
        if (!txt) { if (a) a.focus(); ctx.aviso('Escribe la respuesta antes de enviarla.'); return; }
        if (enviando[id]) return;
        enviando[id] = true; borrador[id] = a.value; pintar();
        var antes = ctx.tablas.fila(T, id);
        ctx.llamar('responder', [{ tarea: id, texto: txt }]).then(function (estado) {
          delete borrador[id];
          if (lanzar(antes, estado)) lanzarId = id;
          if (ctx.abierta()) ctx.aviso('Respondida: ' + id + ' vuelve a ' + (typeof estado === 'string' && estado ? estado : 'la cola') + '.');
          return ctx.tablas.refrescar([T], true);
        }, function (e) {
          if (ctx.abierta()) ctx.aviso('No se ha enviado la respuesta: ' + String(e.message).replace(/^\w+:\s*/, ''));
        }).then(function () { delete enviando[id]; if (ctx.abierta()) pintar(); }, function () { delete enviando[id]; if (ctx.abierta()) pintar(); });
      });

      /** Los nombres de las personas (personas_gestion), guardados en el dispositivo; si cambian, se vuelve a pintar. */
      function gente() {
        return ctx.llamar('personas_gestion', [{}]).then(function (r) {
          var g = {};
          (Array.isArray(r) ? r : []).forEach(function (p) { if (p && p.id) g[p.id] = p.nombre; });
          if (JSON.stringify(g) !== JSON.stringify(GENTE)) { GENTE = g; guardarLocal(CLAVE + '_gente', g); if (ctx.abierta()) pintar(); }
        });
      }

      ctx.alCambiar(function (t) { if (t === T || t === TI) pintar(); });
      pintar();
      ctx.tablas.leer([T, TI]).then(function () { leido = true; if (ctx.abierta()) pintar(); }, function (e) {
        leido = true;
        cont.innerHTML = '<p class="u-error">No se han podido leer tus tareas.</p><p class="u-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Vuelve a abrir la sección.</p>';
      });
      gente().catch(function () {});

      // En directo (como Tareas): si alguien cambia una tarea, sus dependencias o su bitácora, se vuelve a leer el tablero.
      var directo = null, tDirecto = null;
      if (ctx.enDirecto) directo = ctx.enDirecto(['tareas', 'dependencias', 'bitacora'], function () {
        if (tDirecto) return;
        tDirecto = setTimeout(function () { tDirecto = null; if (ctx.abierta()) ctx.tablas.refrescar([T], true).catch(function () {}); }, 800);
      });
      this._cerrar = function () {
        if (directo) { directo.cerrar(); directo = null; }
        if (tDirecto) { clearTimeout(tDirecto); tDirecto = null; }
      };
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); }
  });
})();
