/*
 * Bandeja · plataforma interna de Utilo sobre Supabase (T0412) · clientes/utilo/modulos/bandeja de utilo-apps
 *
 * Lo que piden los clientes desde Pedir a Utilo (vista BANDEJA: la tabla SOLICITUDES con su tarea, lo que ve el cliente y si
 * quien mira puede decidir). Sustituye a la Bandeja del kanban 4.x, que queda de solo lectura (decidido por Javi).
 * - Arriba, buscar y «Filtros» (la hoja de siempre: Ver y Cliente). Por defecto, las Nuevas.
 * - Las Nuevas, primero: las urgentes delante y, entre ellas, lo más antiguo arriba (lo que lleva más tiempo esperando). Lo
 *   demás, de lo último decidido a lo más antiguo.
 * - Cada solicitud, con las palabras del cliente: quién la pide, de qué cliente, cuándo, qué es, si es urgente y su captura.
 *   Debajo, qué se ha hecho: su tarea (con su estado, abre su ficha en Tareas), la respuesta o el motivo, y lo que ve el
 *   cliente en Pedir a Utilo.
 * - Decidir (quien encarga tareas en la iniciativa del cliente; la base es la que manda): Crear la tarea (una ventana con el
 *   alta rellena: el título propuesto, que se corrige para que empiece por un verbo, la épica CLIENTES, la prioridad según la
 *   urgencia y asignada a quien la crea), Responder (lo verá el cliente) y Descartar (solo una Nueva, con el motivo, que
 *   también ve el cliente). Responder y crear la tarea se pueden juntar, en cualquier orden.
 * - ?sol=S0001 la deja a la vista (Para mí enlaza así). En directo (Realtime). En el menú, el marco cuenta las Nuevas.
 * Los cálculos (CALC) se prueban en node (herramientas/probar-plataforma.js). Estilos: estilos/kanban.css (.bjp-*).
 */
(function () {
  'use strict';
  var T = 'BANDEJA', TI = 'INICIATIVAS';
  var VER = ['Nuevas', 'Con tarea', 'Respondidas', 'Descartadas'];
  var VER_DEF = ['Nuevas'];
  var TITULO_MAX = 50;
  var HERRAMIENTAS = ['Chat', 'Cowork', 'Claude Code'];

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function leerLocal(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function guardarLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  /* ---------- T0423 · LA HOJA DE FILTROS: igual en tablero.js y entregas.js (probar-plataforma.js comprueba que no se separan) ----------
   * Cada filtro es un grupo de botones. Los de «varias» (iniciativa, entrega, persona…) dejan elegir más de uno: «Todas» quita
   * lo elegido. Un grupo con más de HOJA_MAX opciones enseña las primeras (y las elegidas), «Ver las otras N» y un buscador; las
   * opciones «al buscar» (p. ej. las entregas ya cerradas) solo salen buscándolas. */
  var HOJA_MAX = 8;
  function sinTildes(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  /** Lo elegido en un filtro, siempre en lista (antes de T0423 se guardaba un texto: '' era «Todas»). */
  function lista(v) { return (Array.isArray(v) ? v : v === '' || v == null ? [] : [v]).filter(function (x) { return x !== '' && x != null; }).map(String); }
  /** Lo elegido tras pulsar «v»: con varias, se añade o se quita («» quita todo); si no, solo ese. */
  function elegirEn(actual, v, varias) {
    if (!varias) return v;
    if (v === '') return [];
    var l = lista(actual), i = l.indexOf(String(v));
    if (i >= 0) l.splice(i, 1); else l.push(String(v));
    return l;
  }
  /** Un grupo de la hoja. o: { k, t, vs: [[valor, texto, alBuscar]], sel, varias, abierto, buscar }. */
  function grupoHoja(o) {
    var sel = o.varias ? lista(o.sel) : [String(o.sel)];
    var larga = o.vs.filter(function (x) { return !x[2]; }).length > HOJA_MAX, mas = 0, k = 0;
    var vs = !larga ? o.vs : o.vs.slice().sort(function (a, b) { return (sel.indexOf(String(b[0])) >= 0) - (sel.indexOf(String(a[0])) >= 0); }); // larga: las elegidas, primero
    var bs = vs.map(function (x) {
      var p = sel.indexOf(String(x[0])) >= 0, oculta = false;
      if (!p && x[2]) oculta = true;
      else if (!x[2] && k++ >= HOJA_MAX && larga && !o.abierto && !p) { oculta = true; mas++; }
      return '<button type="button" class="en-chip" data-g="' + texto(o.k) + '" data-v="' + texto(x[0]) + '" data-txt="' + texto(sinTildes(x[1])) + '"' +
        ' aria-pressed="' + p + '"' + (oculta ? ' data-oculta hidden' : '') + '>' + texto(x[1]) + '</button>';
    });
    if (o.varias) bs.unshift('<button type="button" class="en-chip" data-g="' + texto(o.k) + '" data-v="" aria-pressed="' + !sel.length + '">Todas</button>');
    var buscador = larga || vs.some(function (x) { return x[2]; });
    return '<div class="en-grupo" data-grupo="' + texto(o.k) + '"><h3 class="en-hoja-h">' + texto(o.t) +
        (o.varias && sel.length ? ' <span class="en-hoja-cu">' + (sel.length === 1 ? '1 elegida' : sel.length + ' elegidas') + '</span>' : '') + '</h3>' +
      (buscador ? '<input type="search" class="en-hoja-busca" data-gbusca="' + texto(o.k) + '" placeholder="' + texto(o.buscar || 'Buscar') + '" aria-label="' + texto(o.buscar || 'Buscar') + '" autocomplete="off">' : '') +
      '<div class="en-chips' + (o.varias ? ' varias' : '') + '" role="group" aria-label="' + texto(o.t) + '">' + bs.join('') + '</div>' +
      (mas ? '<button type="button" class="en-hoja-mas" data-gmas="' + texto(o.k) + '">' + (mas === 1 ? 'Ver otra' : 'Ver las otras ' + mas) + '</button>' : '') +
      '<p class="en-hoja-nada" hidden>Ninguna con ese nombre.</p></div>';
  }
  /** Buscar dentro de un grupo: salen las que coinciden (también las «al buscar») y las elegidas. */
  function buscarEnGrupo(input) {
    var q = sinTildes(input.value.trim()), g = input.closest('.en-grupo'), n = 0;
    [].forEach.call(g.querySelectorAll('.en-chip[data-txt]'), function (b) {
      var ve = q ? b.getAttribute('aria-pressed') === 'true' || q.split(/\s+/).every(function (p) { return b.getAttribute('data-txt').indexOf(p) >= 0; }) : !b.hasAttribute('data-oculta');
      b.hidden = !ve; if (ve) n++;
    });
    var m = g.querySelector('.en-hoja-mas'); if (m) m.hidden = !!q;
    g.querySelector('.en-hoja-nada').hidden = !q || n > 0;
  }
  /** Vuelve a pintar la hoja sin perder lo buscado, por dónde iba ni el foco. */
  function repintarHoja(form, pintar, foco) {
    var bs = {}, y = form.scrollTop;
    [].forEach.call(form.querySelectorAll('[data-gbusca]'), function (i) { if (i.value) bs[i.getAttribute('data-gbusca')] = i.value; });
    pintar();
    form.scrollTop = y;
    Object.keys(bs).forEach(function (k) { var i = form.querySelector('[data-gbusca="' + k + '"]'); if (i) { i.value = bs[k]; buscarEnGrupo(i); } });
    var x = foco && form.querySelector(foco); if (x) try { x.focus({ preventScroll: true }); } catch (e) { x.focus(); }
  }
  /** Los botones de la hoja: elegir(k, v) cambia el filtro; «Ver las otras» abre el grupo; el buscador filtra sin volver a pintar. */
  function atenderHoja(form, velo, o) {
    form.addEventListener('click', function (ev) {
      if (!velo.classList.contains('en-hoja')) return;
      var m = ev.target.closest('[data-gmas]');
      if (m) { var g = m.getAttribute('data-gmas'); o.abiertos[g] = 1; repintarHoja(form, o.pintar, ''); return; }
      var b = ev.target.closest('.en-chip[data-g]');
      if (b) {
        var k = b.getAttribute('data-g'), v = b.getAttribute('data-v');
        o.elegir(k, v);
        repintarHoja(form, o.pintar, '[data-g="' + k + '"][data-v="' + (window.CSS && CSS.escape ? CSS.escape(v) : v) + '"]');
      } else if (ev.target.closest('[data-quitar-filtros]')) { o.quitar(); repintarHoja(form, o.pintar, '.pri'); }
    });
    form.addEventListener('input', function (ev) { if (ev.target.hasAttribute('data-gbusca')) buscarEnGrupo(ev.target); });
    form.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target.hasAttribute && ev.target.hasAttribute('data-gbusca')) ev.preventDefault(); });
  }
  /* ---------- FIN DE LA HOJA DE FILTROS ---------- */

  function ms(s) { var t = s ? Date.parse(s) : NaN; return isNaN(t) ? 0 : t; }

  /** En qué grupo de «Ver» está una solicitud. */
  function grupo(s) {
    return s.ESTADO === 'Nueva' ? 'Nuevas' : s.ESTADO === 'Convertida en tarea' ? 'Con tarea' : s.ESTADO === 'Respondida' ? 'Respondidas' : 'Descartadas';
  }

  /** ¿Sale con estos filtros? F: { ver: [], ini: [], busca } (ver vacío: todas). */
  function seVe(s, F) {
    var v = lista(F.ver), i = lista(F.ini);
    if (v.length && v.indexOf(grupo(s)) < 0) return false;
    if (i.length && i.indexOf(String(s.INICIATIVA)) < 0) return false;
    var q = sinTildes(String(F.busca || '').trim());
    if (!q) return true;
    var en = sinTildes([s.ID, s.PERSONA, s.TEXTO, s.RESPUESTA, s.TAREA, s.TAREA_TITULO, s.TIPO, s.INICIATIVA].join(' '));
    return q.split(/\s+/).every(function (p) { return en.indexOf(p) >= 0; });
  }

  /** El orden: las Nuevas primero (urgentes delante y, a igualdad, la más antigua arriba); lo demás, lo último decidido arriba. */
  function ordenar(filas) {
    return (filas || []).slice().sort(function (a, b) {
      var na = a.ESTADO === 'Nueva', nb = b.ESTADO === 'Nueva';
      if (na !== nb) return na ? -1 : 1;
      if (na) return ((b.URGENTE ? 1 : 0) - (a.URGENTE ? 1 : 0)) || (ms(a.FECHA) - ms(b.FECHA)) || String(a.ID).localeCompare(String(b.ID));
      return (ms(b.FECHA_DECISION || b.FECHA) - ms(a.FECHA_DECISION || a.FECHA)) || String(b.ID).localeCompare(String(a.ID));
    });
  }

  /** Lo que se puede hacer con ella: crear la tarea, responder, descartar (si quien mira puede decidir). */
  function acciones(s) {
    if (!s || !s.PUEDO_DECIDIR || s.ESTADO === 'Descartada') return [];
    var a = [];
    if (!s.TAREA) a.push('tarea');
    if (!String(s.RESPUESTA || '').trim()) a.push('responder');
    if (s.ESTADO === 'Nueva') a.push('descartar');
    return a;
  }

  /** Las Nuevas que puede atender quien mira (las del menú y las de Para mí). */
  function pendientes(filas) { return (filas || []).filter(function (s) { return s.ESTADO === 'Nueva' && s.PUEDO_DECIDIR; }); }

  /** El título que se propone: su primera frase, hasta 50 caracteres, sin punto final (como gestion.titulo_de de la base). */
  function tituloDe(t) {
    t = String(t || '').split('\n')[0].replace(/[.!?]\s.*$/, '').replace(/\s+/g, ' ').trim().replace(/[.:;,]+$/, '');
    if (t.length > TITULO_MAX) t = t.slice(0, TITULO_MAX - 1).replace(/\s+\S*$/, '') + '…';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  /** ¿Empieza por un verbo en infinitivo? (la regla de la base para el TITULO de una tarea, aproximada) */
  function infinitivo(t) { return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+(ar|er|ir|ír)(se|lo|la|los|las|le|les)?([^a-záéíóúñü]|$)/.test(String(t || '')); }

  /** La frase de lo que ve el cliente, en sus palabras. */
  var VE = { 'Recibida': 'la ve Recibida', 'En marcha': 'la ve En marcha', 'Hecha': 'la ve Hecha', 'Respondida': 've la respuesta', 'No la haremos': 've «No la haremos» y el motivo' };

  var CALC = { grupo: grupo, seVe: seVe, ordenar: ordenar, acciones: acciones, pendientes: pendientes, tituloDe: tituloDe, infinitivo: infinitivo,
    grupoHoja: grupoHoja, lista: lista, elegirEn: elegirEn, VER: VER };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  var RAIZ = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/utilo\/secciones\/[^/]*$/, '') : '../../'; })();
  var VERSION = (function () { var s = document.currentScript && document.currentScript.src; var m = s && /[?&]v=([^&]+)/.exec(s); return m ? m[1] : '1'; })();
  var ICO_FILTROS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
  var ICO_CERRAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICO_FUERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  var ICO_BIEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>';

  /** Cuánto hace: «hace un momento», «hace 3 horas», «ayer», «hace 5 días» y, pasada una semana, la fecha. */
  function hace(s, ahora) {
    var t = ms(s);
    if (!t) return '';
    var min = Math.floor((ahora - t) / 6e4);
    if (min < 60) return min <= 1 ? 'hace un momento' : 'hace ' + min + ' minutos';
    var h = Math.floor(min / 60);
    if (h < 24) return h === 1 ? 'hace 1 hora' : 'hace ' + h + ' horas';
    var d = Math.floor(h / 24);
    if (d === 1) return 'ayer';
    if (d < 7) return 'hace ' + d + ' días';
    var x = new Date(t);
    return 'el ' + ('0' + x.getDate()).slice(-2) + '/' + ('0' + (x.getMonth() + 1)).slice(-2) + '/' + x.getFullYear();
  }

  /** La hoja del tablero (kanban.css), una vez por página; mientras llega, la sección no se ve (como Para mí). */
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

  window.UN.registrar('BANDEJA', {
    abrir: function (el, ctx) {
      estilos(el);
      var CLAVE = 'bj_' + String(ctx.correo || ctx.persona || '').toLowerCase().replace(/\W+/g, '');
      var F = leerLocal(CLAVE + '_f', {});
      F.ver = Array.isArray(F.ver) ? F.ver.filter(function (v) { return VER.indexOf(v) >= 0; }) : VER_DEF.slice();
      F.ini = lista(F.ini);
      F.busca = '';
      var GENTE = leerLocal(CLAVE + '_gente', {});
      var pedida = String(new URLSearchParams(location.search).get('sol') || '').toUpperCase();
      var leido = false;
      var abierto = { id: '', que: '' };   // la respuesta o el descarte que se está escribiendo
      var borrador = {}, enviando = {};
      var recientes = {}; // lo que se acaba de atender: sigue a la vista (para responder después de crear la tarea) hasta salir

      el.classList.add('kb', 'tb');
      el.innerHTML = '<div class="filtros tb-fil">' +
          '<label class="busca"><span class="u-oculto">Buscar en la Bandeja</span><input type="search" id="bjp-busca" placeholder="Buscar en la Bandeja" autocomplete="off"></label>' +
          '<button id="bjp-fil" class="sec en-filtros" type="button" aria-haspopup="dialog">' + ICO_FILTROS + '<span>Filtros</span><span id="bjp-fil-n" class="k-fil-n" hidden></span></button>' +
        '</div><section class="pm bjp"><p id="bjp-res" class="bjp-res" aria-live="polite"></p><div id="bjp-cont"></div></section>' +
        '<div id="alta-velo"><form id="alta-form" novalidate></form></div>';
      var $ = function (id) { return el.querySelector('#' + id); };
      var cont = $('bjp-cont'), altaVelo = $('alta-velo'), altaForm = $('alta-form');

      function nombre(id) { return id ? GENTE[id] || '' : ''; }
      function cliente(id) { var i = ctx.tablas.fila(TI, id); return (i && i.NOMBRE) || id; }
      function solicitudes() { return ctx.tablas.filas(T); }

      /* ---------- una solicitud ---------- */

      function tarjeta(s, ahora) {
        var acc = acciones(s), id = s.ID;
        var cls = s.ESTADO === 'Nueva' ? (s.URGENTE ? 's-bl' : 's-pr') : s.ESTADO === 'Descartada' ? 's-ni' : s.TAREA ? 's-ec' : 's-co';
        var h = '<li class="pm-c bjp-c ' + cls + (id === pedida ? ' bjp-pedida' : '') + '" id="bjp-' + texto(id) + '"><div class="pm-t bjp-t">' +
          '<span class="pm-top"><span class="pm-id">' + texto(id) + '</span>' + '<span class="pm-ini">' + texto(cliente(s.INICIATIVA)) + '</span>' +
            (s.URGENTE ? '<span class="u-chip bjp-urg">Urgente</span>' : '') + '<span class="u-chip">' + texto(s.TIPO) + '</span></span>' +
          '<span class="pm-meta"><span><b>' + texto(s.PERSONA) + '</b></span><span>' + texto(hace(s.FECHA, ahora)) + '</span>' +
            (s.VERSION ? '<span title="Versión de su web">v' + texto(String(s.VERSION).replace(/^v/i, '')) + '</span>' : '') + '</span>' +
          '<p class="bjp-texto">' + texto(s.TEXTO) + '</p>' +
          (s.ENLACE ? '<a class="bjp-enlace" href="' + texto(s.ENLACE) + '" target="_blank" rel="noopener">' + ICO_FUERA + 'Ver la captura</a>' : '');
        // Lo que se ha hecho, en palabras.
        var hecho = [];
        if (s.TAREA) hecho.push('<a class="bjp-tarea" href="?s=tablero&amp;t=' + encodeURIComponent(s.TAREA) + '" data-sx="TABLERO"><b>' + texto(s.TAREA) + '</b> ' +
          texto(s.TAREA_TITULO || '') + (s.TAREA_ESTADO ? ' <span class="bjp-est">' + texto(s.TAREA_ESTADO) + '</span>' : '') + '</a>');
        if (String(s.RESPUESTA || '').trim()) hecho.push('<p class="bjp-resp"><span>' + (s.ESTADO === 'Descartada' ? 'Descartada' : 'Respondida') +
          (s.DECIDIDO_POR && nombre(s.DECIDIDO_POR) ? ' por ' + texto(nombre(s.DECIDIDO_POR)) : '') + ':</span> «' + texto(s.RESPUESTA) + '»</p>');
        if (s.ESTADO !== 'Nueva') hecho.push('<p class="bjp-ve">El cliente ' + texto(VE[s.ESTADO_CLIENTE] || 'la ve ' + (s.ESTADO_CLIENTE || '')) + '.</p>');
        else hecho.push('<p class="bjp-ve">' + (s.PUEDO_DECIDIR ? 'Nadie la ha atendido todavía: el cliente la ve Recibida.' : 'La atiende quien encarga tareas en ' + texto(cliente(s.INICIATIVA)) + '.') + '</p>');
        h += '<div class="bjp-hecho">' + hecho.join('') + '</div></div>';
        // Responder o descartar: la caja, debajo; si no, los botones.
        if (abierto.id === id && acc.indexOf(abierto.que) >= 0) {
          var desc = abierto.que === 'descartar', k = id + ':' + abierto.que;
          h += '<form class="pm-resp bjp-form" data-enviar="' + texto(abierto.que) + '" data-id="' + texto(id) + '">' +
            '<label class="u-oculto" for="bjp-r-' + texto(id) + '">' + (desc ? 'Por qué no se hará' : 'Tu respuesta') + '</label>' +
            '<textarea id="bjp-r-' + texto(id) + '" rows="3" placeholder="' + (desc ? 'Por qué no la haremos (lo verá el cliente)…' : 'Tu respuesta (la verá el cliente)…') + '"' + (enviando[id] ? ' disabled' : '') + '>' + texto(borrador[k] || '') + '</textarea>' +
            '<div class="bjp-bs"><button type="button" class="u-btn u-btn-texto" data-cerrar>Cancelar</button>' +
            '<button class="u-btn" type="submit"' + (enviando[id] ? ' disabled' : '') + '>' + (enviando[id] ? 'Enviando…' : desc ? 'Descartar' : 'Responder') + '</button></div></form>';
        } else if (acc.length) {
          h += '<div class="pm-acc bjp-acc">' +
            (acc.indexOf('tarea') >= 0 ? '<button type="button" class="u-btn" data-hacer="tarea" data-id="' + texto(id) + '"' + (enviando[id] ? ' disabled' : '') + '>Crear la tarea</button>' : '') +
            (acc.indexOf('responder') >= 0 ? '<button type="button" class="u-btn" data-hacer="responder" data-id="' + texto(id) + '">Responder</button>' : '') +
            (acc.indexOf('descartar') >= 0 ? '<button type="button" class="u-btn u-btn-texto" data-hacer="descartar" data-id="' + texto(id) + '">Descartar</button>' : '') + '</div>';
        }
        return h + '</li>';
      }

      /* ---------- pintar ---------- */

      function mismos(a, b) { return a.slice().sort().join('|') === b.slice().sort().join('|'); }
      function filtrosPuestos() { return (mismos(F.ver, VER_DEF) ? 0 : 1) + (F.ini.length ? 1 : 0); }
      function iniciativasConSolicitudes() {
        var vs = {};
        solicitudes().forEach(function (s) { vs[s.INICIATIVA] = 1; });
        return Object.keys(vs).map(function (i) { return [i, cliente(i)]; }).sort(function (a, b) { return a[1].localeCompare(b[1], 'es'); });
      }

      function pintar() {
        var fs = solicitudes(), ahora = Date.now();
        F.ini = F.ini.filter(function (i) { return fs.some(function (s) { return s.INICIATIVA === i; }); });
        var k = filtrosPuestos(), fn = $('bjp-fil-n');
        fn.textContent = k ? String(k) : ''; fn.hidden = !k;
        if (!fs.length && !leido) { cont.innerHTML = '<p class="pm-vacio">Cargando la Bandeja…</p>'; $('bjp-res').textContent = ''; return; }
        var ves = ordenar(fs.filter(function (s) { return seVe(s, F) || (recientes[s.ID] && seVe(s, { ver: [], ini: F.ini, busca: F.busca })); }));
        var nuevas = pendientes(fs), urg = nuevas.filter(function (s) { return s.URGENTE; }).length;
        $('bjp-res').innerHTML = nuevas.length
          ? '<b>' + (nuevas.length === 1 ? '1 nueva' : nuevas.length + ' nuevas') + '</b> por atender' + (urg ? ' · <span class="pm-mal">' + (urg === 1 ? '1 urgente' : urg + ' urgentes') + '</span>' : '')
          : 'Nada nuevo por atender.';
        var h;
        if (ves.length) h = '<ul class="pm-l bjp-l">' + ves.map(function (s) { return tarjeta(s, ahora); }).join('') + '</ul>';
        else if (!fs.length) h = '<div class="pm-libre">' + ICO_BIEN + '<p><b>La Bandeja está vacía.</b> Lo que pidan los clientes desde Pedir a Utilo llegará aquí.</p></div>';
        else if (mismos(F.ver, VER_DEF) && !F.ini.length && !F.busca) h = '<div class="pm-libre">' + ICO_BIEN + '<p><b>Todo atendido.</b> No hay ninguna solicitud nueva.</p>' +
          '<button type="button" class="u-btn u-btn-texto" data-ver-todas>Ver todas</button></div>';
        else h = '<p class="pm-vacio">Ninguna solicitud con estos filtros.</p><button type="button" class="u-btn u-btn-texto" data-quitar>Quitar filtros</button>';
        // Repintar no quita lo que se estaba escribiendo: vuelve el foco a la misma caja, al final.
        var foco = document.activeElement && cont.contains(document.activeElement) && document.activeElement.id;
        cont.innerHTML = h;
        var a = foco && cont.querySelector('#' + foco);
        if (a && a.tagName === 'TEXTAREA') { a.focus(); a.selectionStart = a.selectionEnd = a.value.length; }
      }

      /** La primera vez que se ve la pedida (?sol=), a la vista. */
      function irAPedida() {
        if (!pedida) return;
        var s = ctx.tablas.fila(T, pedida);
        if (!s) return;
        if (!seVe(s, { ver: F.ver, ini: F.ini })) { F.ver = []; F.ini = []; pintar(); }
        var li = cont.querySelector('#bjp-' + pedida);
        if (li && li.scrollIntoView) li.scrollIntoView({ block: 'center' });
      }

      /* ---------- responder y descartar ---------- */

      cont.addEventListener('click', function (e) {
        if (e.target.closest('[data-ver-todas]')) { F.ver = []; guardarLocal(CLAVE + '_f', F); pintar(); return; }
        if (e.target.closest('[data-quitar]')) { F.ver = VER_DEF.slice(); F.ini = []; F.busca = ''; $('bjp-busca').value = ''; guardarLocal(CLAVE + '_f', F); pintar(); return; }
        if (e.target.closest('[data-cerrar]')) { abierto = { id: '', que: '' }; pintar(); return; }
        var b = e.target.closest('[data-hacer]');
        if (!b) return;
        var id = b.getAttribute('data-id'), que = b.getAttribute('data-hacer');
        if (que === 'tarea') { abrirTarea(id); return; }
        abierto = { id: id, que: que }; pintar();
        var t = cont.querySelector('#bjp-r-' + id); if (t) t.focus();
      });
      cont.addEventListener('input', function (e) {
        var f = e.target.closest('form[data-enviar]');
        if (f && e.target.tagName === 'TEXTAREA') borrador[f.getAttribute('data-id') + ':' + f.getAttribute('data-enviar')] = e.target.value;
      });
      cont.addEventListener('submit', function (e) {
        var f = e.target.closest('form[data-enviar]');
        if (!f) return;
        e.preventDefault();
        var id = f.getAttribute('data-id'), que = f.getAttribute('data-enviar'), a = f.querySelector('textarea'), txt = a ? a.value.trim() : '';
        if (!txt) { if (a) a.focus(); ctx.aviso(que === 'descartar' ? 'Escribe el motivo: lo verá el cliente.' : 'Escribe la respuesta antes de enviarla.'); return; }
        if (enviando[id]) return;
        enviando[id] = true; pintar();
        var p = que === 'descartar' ? ctx.llamar('descartar_solicitud', [{ solicitud: id, motivo: txt }]) : ctx.llamar('responder_solicitud', [{ solicitud: id, texto: txt }]);
        p.then(function () {
          delete borrador[id + ':' + que]; abierto = { id: '', que: '' }; recientes[id] = 1;
          if (ctx.abierta()) ctx.aviso(que === 'descartar' ? id + ' descartada: el cliente verá el motivo.' : 'Respondida: el cliente ya ve tu respuesta a ' + id + '.');
          return ctx.tablas.refrescar([T], true);
        }, function (er) {
          if (ctx.abierta()) ctx.aviso('No se ha guardado: ' + String(er.message).replace(/^\w+:\s*/, ''));
        }).then(function () { delete enviando[id]; if (ctx.abierta()) pintar(); }, function () { delete enviando[id]; if (ctx.abierta()) pintar(); });
      });

      /* ---------- crear la tarea: una ventana con el alta rellena ---------- */

      function abrirVelo() {
        altaVelo.classList.add('abierto');
        document.documentElement.classList.add('fv-abierta');
        var p = altaForm.querySelector('input,textarea,select'); if (p) p.focus();
      }
      function cerrarVelo() { altaVelo.classList.remove('abierto', 'en-hoja'); document.documentElement.classList.remove('fv-abierta'); altaForm.onsubmit = null; }
      altaVelo.addEventListener('click', function (ev) { if (ev.target === altaVelo || ev.target.closest('[data-cancelar-alta]')) cerrarVelo(); });
      altaVelo.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); cerrarVelo(); } });

      function opciones(vs, sel) { return vs.map(function (v) { var x = Array.isArray(v) ? v : [v, v]; return '<option value="' + texto(x[0]) + '"' + (x[0] === sel ? ' selected' : '') + '>' + texto(x[1]) + '</option>'; }).join(''); }

      function abrirTarea(id) {
        var s = ctx.tablas.fila(T, id);
        if (!s) return;
        var tit = tituloDe(s.TEXTO), yo = ctx.personaId || '';
        var gente = Object.keys(GENTE).map(function (k) { return [k, GENTE[k]]; }).sort(function (a, b) { return a[1].localeCompare(b[1], 'es'); });
        if (yo && !GENTE[yo]) gente.unshift([yo, ctx.persona || 'Yo']);
        altaForm.innerHTML = '<h2>Crear la tarea de ' + texto(id) + '</h2>' +
          '<p class="bjp-cita">«' + texto(s.TEXTO) + '» <span>— ' + texto(s.PERSONA) + ', ' + texto(cliente(s.INICIATIVA)) + '</span></p><div class="edit">' +
          '<div class="campo"><label class="lab" for="bjp-t-tit">Título</label><input type="text" id="bjp-t-tit" autocomplete="off" required value="' + texto(tit) + '">' +
            '<div class="ayuda"><span class="contador" data-cuenta>' + tit.length + ' / ' + TITULO_MAX + '</span> · <span id="bjp-t-verbo">Qué se entrega, empezando por un verbo: «Arreglar…», «Añadir…».</span></div></div>' +
          '<div class="campo"><label class="lab" for="bjp-t-epi">Épica</label><input type="text" id="bjp-t-epi" autocomplete="off" value="CLIENTES"></div>' +
          '<div class="bjp-dos"><div class="campo"><label class="lab" for="bjp-t-p">Prioridad</label><select id="bjp-t-p">' + opciones(['!', '!!', '!!!', '!!!!'], s.URGENTE ? '!!!' : '!!') + '</select></div>' +
          '<div class="campo"><label class="lab" for="bjp-t-t">Tamaño</label><select id="bjp-t-t">' + opciones(['XS', 'S', 'M', 'L', 'XL'], 'S') + '</select></div></div>' +
          '<div class="bjp-dos"><div class="campo"><label class="lab" for="bjp-t-a">La lleva</label><select id="bjp-t-a">' + opciones(gente, yo) + '</select></div>' +
          '<div class="campo"><label class="lab" for="bjp-t-h">Herramienta <span class="opc">(opcional)</span></label><select id="bjp-t-h"><option value="">Sin decir</option>' + opciones(HERRAMIENTAS, '') + '</select></div></div>' +
          '<p class="ayuda">En ' + texto(cliente(s.INICIATIVA)) + '. Lo que pide el cliente va tal cual en «Qué hay que hacer»' + (s.ENLACE ? ', con su captura' : '') + (s.URGENTE ? '; urgente, como lo pidió' : '') + '.</p>' +
          '</div><div id="alta-error" role="alert"></div>' +
          '<div class="botones"><button type="button" class="sec" data-cancelar-alta>Cancelar</button><button type="submit" class="pri">Crear la tarea</button></div>';
        abrirVelo();
        var inp = altaForm.querySelector('#bjp-t-tit');
        var revisar = function () {
          var v = inp.value.trim(), c = altaForm.querySelector('[data-cuenta]'), vb = altaForm.querySelector('#bjp-t-verbo');
          c.textContent = v.length + ' / ' + TITULO_MAX; c.classList.toggle('mal', v.length > TITULO_MAX);
          vb.classList.toggle('mal', !!v && !infinitivo(v));
        };
        inp.oninput = revisar; revisar();
        inp.select();
        altaForm.onsubmit = function (ev) {
          ev.preventDefault();
          var v = function (i) { return altaForm.querySelector('#' + i).value.trim(); };
          var campos = { titulo: v('bjp-t-tit'), epica: v('bjp-t-epi').toUpperCase(), p: v('bjp-t-p'), t: v('bjp-t-t'), asignado: v('bjp-t-a') };
          if (v('bjp-t-h')) campos.herramienta = v('bjp-t-h');
          if (!campos.epica) delete campos.epica;
          var mal = !campos.titulo ? 'Falta el título.' : campos.titulo.length > TITULO_MAX ? 'El título pasa de ' + TITULO_MAX + ' caracteres.' :
            !infinitivo(campos.titulo) ? 'El título empieza por un verbo en infinitivo: «Arreglar…», «Añadir…».' : /\.$/.test(campos.titulo) ? 'El título va sin punto final.' : '';
          if (mal) { altaForm.querySelector('#alta-error').textContent = mal; return; }
          var bt = altaForm.querySelector('button[type=submit]'); bt.disabled = true; bt.textContent = 'Creando…';
          enviando[id] = true;
          ctx.llamar('solicitud_a_tarea', [{ solicitud: id, campos: campos }]).then(function (nueva) {
            cerrarVelo(); recientes[id] = 1;
            if (ctx.abierta()) ctx.aviso('Creada ' + (nueva || 'la tarea') + ' para ' + id + '. Si quieres, contesta al cliente.');
            return ctx.tablas.refrescar([T], true);
          }, function (er) {
            bt.disabled = false; bt.textContent = 'Crear la tarea';
            altaForm.querySelector('#alta-error').textContent = String(er.message).replace(/^\w+:\s*/, '');
          }).then(function () { delete enviando[id]; if (ctx.abierta()) pintar(); }, function () { delete enviando[id]; if (ctx.abierta()) pintar(); });
        };
      }

      /* ---------- filtros: la hoja de siempre ---------- */

      var ABIERTOS = {};
      function pintarHoja() {
        var IS = iniciativasConSolicitudes(), n = solicitudes().filter(function (s) { return seVe(s, F); }).length;
        altaForm.innerHTML = '<div class="en-hoja-cab"><h2>Filtros</h2><button type="button" class="en-hoja-x" data-cancelar-alta aria-label="Cerrar" title="Cerrar">' + ICO_CERRAR + '</button></div>' +
          grupoHoja({ k: 'ver', t: 'Ver', vs: VER.map(function (v) { return [v, v]; }), sel: F.ver, varias: true }) +
          (IS.length > 1 ? grupoHoja({ k: 'ini', t: 'Cliente', vs: IS, sel: F.ini, varias: true, abierto: ABIERTOS.ini, buscar: 'Buscar cliente' }) : '') +
          '<div class="botones"><button type="button" class="sec" data-quitar-filtros' + (filtrosPuestos() ? '' : ' disabled') + '>Quitar filtros</button>' +
          '<button type="submit" class="pri">' + (n === 1 ? 'Ver 1 solicitud' : 'Ver ' + n + ' solicitudes') + '</button></div>';
      }
      function abrirFiltros() {
        Object.keys(ABIERTOS).forEach(function (k) { delete ABIERTOS[k]; });
        pintarHoja();
        altaForm.onsubmit = function (ev) { ev.preventDefault(); cerrarVelo(); };
        altaVelo.classList.add('en-hoja');
        abrirVelo();
        var b = altaForm.querySelector('.en-chip[aria-pressed=true]'); if (b) b.focus();
      }
      atenderHoja(altaForm, altaVelo, {
        abiertos: ABIERTOS, pintar: pintarHoja,
        elegir: function (k, v) {
          if (k === 'ver') F.ver = elegirEn(F.ver, v, true);
          else if (k === 'ini') F.ini = elegirEn(F.ini, v, true);
          guardarLocal(CLAVE + '_f', F); pintar();
        },
        quitar: function () { F.ver = VER_DEF.slice(); F.ini = []; guardarLocal(CLAVE + '_f', F); pintar(); }
      });
      var tBusca = 0;
      $('bjp-busca').addEventListener('input', function () { var v = this.value; clearTimeout(tBusca); tBusca = setTimeout(function () { F.busca = v.trim(); pintar(); }, 120); });
      $('bjp-fil').onclick = abrirFiltros;

      /* ---------- datos ---------- */

      function gente() {
        return ctx.llamar('personas_gestion', [{}]).then(function (r) {
          var g = {};
          (Array.isArray(r) ? r : []).forEach(function (p) { if (p && p.id) g[p.id] = p.nombre; });
          if (JSON.stringify(g) !== JSON.stringify(GENTE)) { GENTE = g; guardarLocal(CLAVE + '_gente', g); if (ctx.abierta()) pintar(); }
        });
      }

      ctx.alCambiar(function (t) { if (t === T || t === TI) pintar(); });
      pintar();
      ctx.tablas.leer([T, TI]).then(function () { leido = true; if (ctx.abierta()) { pintar(); irAPedida(); } }, function (e) {
        leido = true;
        cont.innerHTML = '<p class="u-error">No se ha podido leer la Bandeja.</p><p class="u-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Vuelve a abrir la sección.</p>';
      });
      gente().catch(function () {});

      // En directo: llega una petición, o alguien responde o crea su tarea (y la tarea cambia de estado).
      var directo = null, tDirecto = null;
      if (ctx.enDirecto) directo = ctx.enDirecto(['solicitudes', 'tareas'], function () {
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
