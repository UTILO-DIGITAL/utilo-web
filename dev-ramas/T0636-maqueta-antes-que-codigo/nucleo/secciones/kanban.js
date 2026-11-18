/*
 * Kanban base del núcleo · UTILO_CORE 5.0 (T0254) · motor/modulos/kanban de utilo-apps
 *
 * El tablero de tareas y su ficha, igual para todos los negocios, sobre el formato estándar del DAILY (TAREAS y EPICAS,
 * columnas con guion bajo y estado «Eliminada»). Sigue el contrato de una sección (docs/CONTRATO_SECCION.md de utilo-apps).
 * - Estados (columnas), épicas, campos de la tarjeta, filtros, campos del alta y de editar, etiquetas y textos salen de
 *   ctx.config (config.json · nucleo.secciones.kanban.config, con los valores por defecto de su modulo.json). Los valores
 *   de cada desplegable y lo obligatorio, del YAML de TAREAS (kanbanOpciones, guardado en el dispositivo).
 * - Se pinta al momento con lo guardado en el dispositivo (ctx.tablas) y se refresca por detrás.
 * - Cambiar de estado (arrastrando la tarjeta en el ordenador, con su desplegable en el móvil o en la ficha), editar,
 *   eliminar, recuperar y crear cambian la pantalla al momento; el motor lo escribe por detrás con su función
 *   (kanbanEstado, kanbanEditar, kanbanCrear: HISTORIAL, REGISTRO_ESTADOS y dependencias). Si dice que no, se deshace solo y avisa.
 * - Estilos: estilos/kanban.css (tablero y ficha, los de la 4.x) sobre base.css; lo nuevo, en su apartado «Kanban del núcleo».
 */
(function () {
  'use strict';
  var T = 'TAREAS', TE = 'EPICAS';
  var RAIZ = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/nucleo\/secciones\/[^/]*$/, '') : '../../'; })();
  var VERSION = (function () { var s = document.currentScript && document.currentScript.src; var m = s && /[?&]v=([^&]+)/.exec(s); return m ? m[1] : '1'; })();
  var ICO_RECARGAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
  var ICO_VOLVER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function leerLocal(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function guardarLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function hoyISO() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function ahora() { var d = new Date(); return dos(d.getDate()) + '/' + dos(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + dos(d.getHours()) + ':' + dos(d.getMinutes()); }
  /** 'aaaa-mm-dd' → 'dd/mm/aaaa' */
  function fechaEs(s) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(s || ''); }
  /** Días de hoy a esa fecha ('aaaa-mm-dd'); null si no hay. */
  function dias(s) {
    var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || ''));
    if (!m) return null;
    var f = new Date(+m[1], +m[2] - 1, +m[3]), h = new Date(); h.setHours(0, 0, 0, 0);
    return Math.round((f - h) / 864e5);
  }
  function lineas(s) { return String(s || '').split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).filter(function (l) { return l.trim(); }); }

  /** Una vez por página: la hoja del tablero y la ficha. */
  function estilos() {
    if (document.getElementById('kb-css')) return;
    var l = document.createElement('link');
    l.id = 'kb-css'; l.rel = 'stylesheet'; l.href = RAIZ + 'estilos/kanban.css?v=' + encodeURIComponent(VERSION);
    document.head.appendChild(l);
  }

  window.UN.registrar('KANBAN', {
    abrir: function (el, ctx) {
      estilos();
      var C = ctx.config || {};
      var TX = C.TEXTOS || {}, ET = C.ETIQUETAS || {};
      var ESTADOS = Array.isArray(C.ESTADOS) && C.ESTADOS.length ? C.ESTADOS : ['Bloqueada', 'No iniciada', 'En curso', 'Pendiente de revisión', 'Completada'];
      var NUEVA = C.ESTADO_NUEVA || 'No iniciada', CERRADA = C.ESTADO_CERRADA || 'Completada';
      var BLOQ = C.ESTADO_BLOQUEADA || 'Bloqueada', ELIM = C.ESTADO_ELIMINADA || 'Eliminada';
      var COLORES = C.COLORES || {};
      var CLAVE = 'kb_' + ctx.id + '_' + String(ctx.persona || '').toLowerCase().replace(/\W+/g, '');
      var TACTIL = window.matchMedia && matchMedia('(hover: none)').matches;
      var O = leerLocal(CLAVE + '_op', null);   // kanbanOpciones: personas, columnas del YAML, prefijo
      var F = leerLocal(CLAVE + '_f', {});      // filtros de este dispositivo
      if (typeof F.dias !== 'number') F.dias = Number(C.DIAS_CERRADAS) || 30;
      F.busca = '';
      // T0269: desde Perfil («Ver todas en Tareas ›», ?s=kanban&asignado=…), el tablero se abre con las tareas de esa persona.
      try {
        var u = new URL(location.href), asig = u.searchParams.get('asignado');
        if (asig !== null) {
          F.ASIGNADO = asig.trim(); guardarLocal(CLAVE + '_f', F);
          u.searchParams.delete('asignado'); history.replaceState(history.state, '', u.pathname + u.search);
        }
      } catch (e) {}
      var PL = leerLocal(CLAVE + '_pl', null);  // columnas plegadas; la primera vez, en el móvil, todas menos En curso
      if (!PL) { PL = {}; if (window.matchMedia && matchMedia('(max-width:640px)').matches) ESTADOS.forEach(function (e, i) { if (i !== ESTADOS.indexOf('En curso')) PL[e] = 1; }); }
      var abiertaId = '', editando = false, leido = false; // leido: ya hay tareas guardadas o del motor (antes, «cargando», no «no hay»)

      el.classList.add('kb');
      el.innerHTML =
        '<div class="filtros">' +
          '<label class="busca"><span class="u-oculto">' + texto(TX.buscar || 'Buscar') + '</span><input type="search" id="kb-busca" placeholder="' + texto(TX.buscar || 'Buscar') + '" autocomplete="off"></label>' +
          '<button id="kb-fil" class="sec k-fil" type="button" aria-controls="kb-mas" aria-expanded="false">Filtros<span id="kb-fil-n" class="k-fil-n" hidden></span></button>' +
          '<div id="kb-mas" class="k-mas" hidden></div>' +
          '<span class="act"><button id="kb-rec" class="sec recarga" type="button" title="Traer lo último del Excel" aria-label="Traer lo último del Excel">' + ICO_RECARGAR + '</button></span>' +
        '</div>' +
        '<div id="kb-tab" class="tablero"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<button id="alta-btn" type="button">' + texto(TX.nueva || 'Añadir tarea') + '</button>' +
        '<div class="fv-velo" id="kb-fv"><div class="fv-caja kb-ficha" role="dialog" aria-modal="true" aria-labelledby="kb-f-tit" id="kb-ficha"></div></div>' +
        '<div id="alta-velo"><form id="alta-form" novalidate></form></div>';
      var $ = function (id) { return el.querySelector('#' + id); };
      var tab = $('kb-tab'), fv = $('kb-fv'), caja = $('kb-ficha'), altaVelo = $('alta-velo'), altaForm = $('alta-form');

      /* ---------- datos ---------- */

      function tareas() { return ctx.tablas.filas(T); }
      function tarea(id) { return ctx.tablas.fila(T, id); }
      function col(n) { return O && O.columnas ? O.columnas.filter(function (c) { return c.nombre === n; })[0] || null : null; }
      function tieneCol(n) { if (O && O.columnas) return !!col(n); var f = tareas()[0]; return !!f && n in f; }
      function etiqueta(n) { return ET[n] || n.charAt(0) + n.slice(1).toLowerCase().replace(/_/g, ' '); }
      function cls(estado) { return 's-' + (COLORES[estado] || 'x'); }
      var reId = null;
      function ids(v) {
        if (!reId) reId = new RegExp((O && O.prefijo ? O.prefijo : '[A-Z]+') + '\\d' + (O && O.digitos ? '{' + O.digitos + '}' : '+') + '(?!\\d)', 'g');
        var out = [];
        (String(Array.isArray(v) ? v.join(', ') : v || '').match(reId) || []).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
        return out;
      }
      /** Épicas: las de la tabla EPICAS (en su orden) o las de config.EPICAS. → [{ ID, EPICA }] */
      function epicas() {
        var filas = ctx.tablas.filas(TE).filter(function (e) { return e.EPICA; });
        if (Array.isArray(C.EPICAS) && C.EPICAS.length) return C.EPICAS.map(function (n) { return filas.filter(function (e) { return e.EPICA === n; })[0] || { ID: '', EPICA: n }; });
        if (filas.length) return filas;
        var c = col('EPICA');
        return (c && c.valores ? c.valores : []).map(function (n) { return { ID: '', EPICA: n }; });
      }
      function personas() {
        var out = (O && O.personas ? O.personas : []).slice();
        tareas().forEach(function (t) { var p = String(t.ASIGNADO || '').trim(); if (p && out.indexOf(p) < 0) out.push(p); });
        return out;
      }
      /** Valores que se ofrecen para una columna: épicas, personas o los del desplegable del YAML. */
      function valores(n) {
        if (n === 'EPICA') return epicas().map(function (e) { return e.EPICA; });
        if (n === 'ASIGNADO') return personas();
        var c = col(n);
        if (c && c.valores) return c.valores;
        var vs = [];
        tareas().forEach(function (t) { var v = String(t[n] || '').trim(); if (v && vs.indexOf(v) < 0) vs.push(v); });
        return vs.sort();
      }
      function estadosFicha() { var c = col('ESTADO'); return (c && c.valores ? c.valores : ESTADOS).filter(function (e) { return e !== ELIM; }); }

      /* ---------- filtros ---------- */

      var FILTROS = (Array.isArray(C.FILTROS) ? C.FILTROS : ['ASIGNADO', 'EPICA', 'P']).filter(function (n) { return n !== 'ESTADO'; });
      function pintarFiltros() {
        var m = $('kb-mas');
        m.innerHTML = FILTROS.map(function (n) {
          var vs = valores(n), v = F[n] || '';
          var extra = n === 'ASIGNADO' ? '<option value="-"' + (v === '-' ? ' selected' : '') + '>Sin asignar</option>' : '';
          return '<label>' + texto(etiqueta(n)) + '<select data-f="' + texto(n) + '"><option value="">' + (n === 'ASIGNADO' ? 'Todas las personas' : 'Todas') + '</option>' +
            vs.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + texto(x) + '</option>'; }).join('') + extra + '</select></label>';
        }).join('') +
          '<label>' + texto(TX.dias || 'Cerradas en los últimos (días)') + '<input type="number" min="0" id="kb-dias" value="' + F.dias + '"></label>';
        cuenta();
      }
      function cuenta() {
        var k = FILTROS.filter(function (n) { return F[n]; }).length + (F.dias !== (Number(C.DIAS_CERRADAS) || 30) ? 1 : 0);
        var s = $('kb-fil-n'); s.textContent = k ? String(k) : ''; s.hidden = !k;
        $('kb-fil').title = k ? k + (k === 1 ? ' filtro puesto' : ' filtros puestos') : 'Sin filtros';
      }
      function abrirFiltros(ab) { $('kb-mas').hidden = !ab; $('kb-fil').setAttribute('aria-expanded', ab ? 'true' : 'false'); F._ab = ab; guardarLocal(CLAVE + '_f', F); }
      $('kb-fil').onclick = function () { abrirFiltros($('kb-mas').hidden); };
      $('kb-mas').addEventListener('change', function (e) {
        var s = e.target.closest('[data-f]');
        if (s) F[s.getAttribute('data-f')] = s.value;
        if (e.target.id === 'kb-dias') { var n = parseInt(e.target.value, 10); F.dias = isNaN(n) || n < 0 ? (Number(C.DIAS_CERRADAS) || 30) : n; e.target.value = F.dias; }
        guardarLocal(CLAVE + '_f', F); cuenta(); pintarTablero();
      });
      var tBusca = 0;
      $('kb-busca').addEventListener('input', function () { var v = this.value; clearTimeout(tBusca); tBusca = setTimeout(function () { F.busca = v.trim().toLowerCase(); pintarTablero(); }, 120); });
      $('kb-rec').onclick = function () {
        var b = this; b.disabled = true; b.classList.add('girando');
        Promise.all([ctx.tablas.refrescar([T, TE], true), opciones()]).then(function () { if (ctx.abierta()) ctx.aviso('Tablero al día con el Excel.'); }, function (e) {
          if (ctx.abierta()) ctx.aviso('No se ha podido actualizar: ' + String(e.message).replace(/^\w+:\s*/, ''));
        }).then(function () { b.disabled = false; b.classList.remove('girando'); });
      };

      function pasa(t) {
        if (t.ESTADO === ELIM) return false;
        if (F.busca) {
          var hay = [t.ID, t.TITULO, t.DESCRIPCION, t.ASIGNADO, t.EPICA].join(' ').toLowerCase();
          return F.busca.split(/\s+/).every(function (p) { return hay.indexOf(p) >= 0; });
        }
        for (var i = 0; i < FILTROS.length; i++) {
          var n = FILTROS[i], v = F[n];
          if (!v) continue;
          if (n === 'ASIGNADO' && v === '-') { if (String(t.ASIGNADO || '').trim()) return false; }
          // Una tarea de varias personas («Ana, Bruno») sale en el filtro de cada una, como en Perfil (T0269).
          else if (n === 'ASIGNADO') { if (String(t.ASIGNADO || '').split(/[,\/]/).map(function (x) { return x.trim().toLowerCase(); }).indexOf(v.toLowerCase()) < 0) return false; }
          else if (String(t[n] || '') !== v) return false;
        }
        if (t.ESTADO === CERRADA) { var d = dias(t.FECHA_CIERRE); return d === null || -d <= F.dias; }
        return true;
      }

      /* ---------- tablero ---------- */

      /** Orden «recomendado» de la 4.x: primero lo que vence en 7 días, después la prioridad, la fecha límite y la más antigua. */
      function ordenar(ts, est) {
        if (est === CERRADA) return ts.sort(function (a, b) { return String(b.FECHA_CIERRE || '').localeCompare(String(a.FECHA_CIERRE || '')) || String(b.ID).localeCompare(String(a.ID)); });
        var dl = function (t) { var d = dias(t.DEADLINE); return d === null ? 1e9 : d; };
        var ur = function (t) { return dl(t) <= 7 ? 1 : 0; };
        var pn = function (t) { return String(t.P || '').length; };
        return ts.sort(function (a, b) {
          return (ur(b) - ur(a)) || (ur(a) ? dl(a) - dl(b) : 0) || (pn(b) - pn(a)) || (dl(a) - dl(b)) || String(a.ID).localeCompare(String(b.ID));
        });
      }
      function espera(t) {
        return ids(t.DEPENDE_DE).filter(function (d) { var x = tarea(d); return x && x.ESTADO !== CERRADA && x.ESTADO !== ELIM; });
      }
      function tarjeta(t) {
        var campos = (Array.isArray(C.CAMPOS_TARJETA) ? C.CAMPOS_TARJETA : ['ASIGNADO', 'EPICA', 'P']).map(function (n) {
          return n === 'ASIGNADO' ? (String(t.ASIGNADO || '').trim() || 'Sin asignar') : String(t[n] == null ? '' : t[n]).trim();
        }).filter(String);
        var x = [];
        if (t.ESTADO === CERRADA) { if (t.FECHA_CIERRE) x.push('<div class="x">' + texto(etiqueta('FECHA_CIERRE')) + ' ' + fechaEs(t.FECHA_CIERRE) + '</div>'); }
        else {
          var d = dias(t.DEADLINE);
          if (d !== null) x.push('<div class="x' + (d < 0 ? ' venc' : '') + '">' + (d < 0 ? 'Vencida: ' : d === 0 ? 'Vence hoy: ' : 'Vence el ') + fechaEs(t.DEADLINE) + '</div>');
          var dd = dias(t.DISPONIBLE_DESDE);
          if (dd !== null && dd > 0) x.push('<div class="x">No se empieza antes del ' + fechaEs(t.DISPONIBLE_DESDE) + '</div>');
          var es = espera(t);
          if (es.length) x.push('<div class="x">Espera a: <b>' + texto(es.join(', ')) + '</b></div>');
        }
        var id = t._nueva ? '' : String(t.ID);
        var mover = TACTIL && id ? '<div class="mover"><span>Estado</span><select data-mover="' + texto(id) + '" aria-label="Estado de ' + texto(id) + '">' +
          estadosFicha().map(function (e) { return '<option' + (e === t.ESTADO ? ' selected' : '') + '>' + texto(e) + '</option>'; }).join('') + '</select></div>' : '';
        return '<div class="card ' + cls(t.ESTADO) + '-b' + (t._pendiente ? ' guardando' : '') + '"' + (id && !TACTIL ? ' draggable="true"' : '') + ' data-id="' + texto(id) + '">' +
          '<a class="card-link" href="?s=' + texto(ctx.id.toLowerCase()) + '&amp;t=' + encodeURIComponent(id) + '" data-abrir="' + texto(id) + '">' +
          '<div class="top"><span class="id">' + (id ? texto(id) : 'Creando…') + '</span>' + (t._pendiente ? '<span class="u-chip">Guardando</span>' : '') + '</div>' +
          '<div class="t">' + texto(t.TITULO) + '</div>' +
          (campos.length ? '<div class="m">' + texto(campos.join(' · ')) + '</div>' : '') + x.join('') + '</a>' + mover + '</div>';
      }
      function pintarTablero() {
        var todas = tareas();
        if (!todas.length && !leido) { tab.innerHTML = '<div class="kz-centro kb-vacio" role="status"><div class="u-carga"></div><p>Cargando las tareas…</p></div>'; return; }
        if (!todas.length) { tab.innerHTML = '<p class="u-vacio kb-vacio">' + texto(TX.sinTareas || 'Todavía no hay tareas.') + '</p>'; return; }
        var lista = todas.filter(pasa);
        tab.innerHTML = ESTADOS.map(function (est) {
          var ts = ordenar(lista.filter(function (t) { return t.ESTADO === est; }), est);
          var pl = !!PL[est] && !F.busca;
          return '<section class="col' + (pl ? ' plegada' : '') + '" data-est="' + texto(est) + '">' +
            '<h2 class="' + cls(est) + ' ch" role="button" tabindex="0" aria-expanded="' + (pl ? 'false' : 'true') + '" data-plegar="' + texto(est) + '">' + texto(est) +
            '<span class="n">' + ts.length + '</span><span class="fl"></span></h2>' +
            '<div class="lista">' + (ts.length ? ts.map(tarjeta).join('') : '<div class="vacio">' + texto(TX.vacio || 'Ninguna tarea con estos filtros.') + '</div>') + '</div></section>';
        }).join('');
      }

      function plegar(est) { if (PL[est]) delete PL[est]; else PL[est] = 1; guardarLocal(CLAVE + '_pl', PL); pintarTablero(); }
      tab.addEventListener('click', function (e) {
        var h = e.target.closest('[data-plegar]');
        if (h) { plegar(h.getAttribute('data-plegar')); return; }
        var a = e.target.closest('[data-abrir]');
        if (a && !(e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); if (a.getAttribute('data-abrir')) abrirFicha(a.getAttribute('data-abrir')); }
      });
      tab.addEventListener('keydown', function (e) {
        var h = e.target.closest('[data-plegar]');
        if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); plegar(h.getAttribute('data-plegar')); }
      });
      tab.addEventListener('change', function (e) {
        var s = e.target.closest('[data-mover]');
        if (s) cambiarEstado(s.getAttribute('data-mover'), s.value);
      });
      // Arrastrar en el ordenador: la tarjeta a otra columna.
      var arr = '';
      tab.addEventListener('dragstart', function (e) {
        var c = e.target.closest && e.target.closest('.card[draggable]');
        if (!c) return;
        arr = c.getAttribute('data-id'); c.classList.add('arrastrando');
        try { e.dataTransfer.setData('text/plain', arr); e.dataTransfer.effectAllowed = 'move'; } catch (x) {}
      });
      tab.addEventListener('dragend', function () { arr = ''; [].forEach.call(tab.querySelectorAll('.arrastrando,.destino'), function (x) { x.classList.remove('arrastrando', 'destino'); }); });
      tab.addEventListener('dragover', function (e) {
        var c = arr && e.target.closest('.col');
        if (!c) return;
        e.preventDefault();
        [].forEach.call(tab.querySelectorAll('.destino'), function (x) { if (x !== c) x.classList.remove('destino'); });
        c.classList.add('destino');
      });
      tab.addEventListener('drop', function (e) {
        var c = arr && e.target.closest('.col');
        if (!c) return;
        e.preventDefault();
        var id = arr; arr = '';
        cambiarEstado(id, c.getAttribute('data-est'));
      });

      /* ---------- escribir (al momento; el motor, por detrás) ---------- */

      // T0273: con el nombre de quien lo hace de verdad («Javi Canela como Ana»), igual que lo escribe el motor.
      function lineaHist(que) { return ahora() + ' (' + (ctx.autor || ctx.persona || '') + '): ' + que; }
      function conLinea(h, l) { h = String(h || '').replace(/\s+$/, ''); return h ? h + '\n' + l : l; }

      function cambiarEstado(id, nuevo) {
        var t = tarea(id);
        if (!t || t.ESTADO === nuevo) return;
        var visto = t.ESTADO, cambios = { ESTADO: nuevo };
        if (tieneCol('FECHA_CIERRE')) cambios.FECHA_CIERRE = nuevo === CERRADA ? hoyISO() : '';
        if (C.HISTORIAL !== 'No' && tieneCol('HISTORIAL')) cambios.HISTORIAL = conLinea(t.HISTORIAL, lineaHist('cambiado el estado a ' + nuevo + ' (antes ' + visto + ') desde el kanban web.'));
        ctx.tablas.actualizar(T, id, cambios, { fn: 'kanbanEstado', args: [id, nuevo, visto] }).then(function (r) {
          if (!ctx.abierta()) return;
          if (r && r.aviso) ctx.aviso(r.aviso);
          else if (nuevo === ELIM) ctx.aviso(id + ' eliminada. Se puede recuperar desde su ficha.');
        }, function () {});
      }

      /* ---------- ficha ---------- */

      function abrirFicha(id, sinUrl) {
        if (!tarea(id)) return;
        abiertaId = id; editando = false;
        pintarFicha();
        fv.classList.add('abierto');
        document.documentElement.classList.add('fv-abierta');
        if (!sinUrl) urlFicha(id);
        var b = caja.querySelector('.volver'); if (b) b.focus();
      }
      function cerrarFicha() {
        if (!abiertaId) return;
        abiertaId = ''; editando = false;
        fv.classList.remove('abierto');
        document.documentElement.classList.remove('fv-abierta');
        urlFicha('');
      }
      function urlFicha(id) {
        try {
          var u = new URL(location.href);
          if (id) u.searchParams.set('t', id); else u.searchParams.delete('t');
          history.replaceState(history.state, '', u.pathname + u.search);
        } catch (e) {}
      }
      fv.addEventListener('click', function (e) { if (e.target === fv) cerrarFicha(); });
      fv.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (editando) { editando = false; pintarFicha(); } else cerrarFicha(); } });

      function bloque(tit, ls, k) {
        if (!ls.length) return '';
        var html = '', enLista = false;
        ls.forEach(function (l) {
          if (/^\s*-\s+/.test(l)) { if (!enLista) { html += '<ul>'; enLista = true; } html += '<li>' + texto(l.replace(/^\s*-\s+/, '')) + '</li>'; }
          else { if (enLista) { html += '</ul>'; enLista = false; } html += '<p>' + texto(l) + '</p>'; }
        });
        if (enLista) html += '</ul>';
        return '<div class="bloque"' + (k ? ' data-k="' + k + '"' : '') + '><h3>' + texto(tit) + '</h3>' + html + '</div>';
      }
      /** DESCRIPCION → { SOLICITUD: [líneas], DECISIONES: [...], ABIERTO: [...], OTRO: [...] } */
      function partes(d) {
        var out = { SOLICITUD: [], DECISIONES: [], ABIERTO: [] }, k = 'SOLICITUD';
        String(d || '').split('\n').forEach(function (l) {
          var m = /^\s*(SOLICITUD|DECISIONES|ABIERTO)\s*:\s*(.*)$/.exec(l);
          if (m) { k = m[1]; l = m[2]; }
          if (l.trim()) out[k].push(l.replace(/\s+$/, ''));
        });
        return out;
      }
      function solicitudDe(d) {
        d = String(d || '');
        var m = /\n\s*(DECISIONES|ABIERTO)\s*:/.exec(d), i = m ? m.index : d.length;
        return { solicitud: d.slice(0, i).replace(/^\s*SOLICITUD\s*:\s*/, '').trim(), resto: d.slice(i) };
      }
      /**
       * T0267: título de una tarea de «Espera a» de la tarea abierta que no está en la copia. Si es de otro perfil, el motor
       * no la manda y en DEPENDE_DE viene como «T0001 · Tarea de otro perfil» (TEXTOS.otroPerfil).
       */
      function tituloDep(id) {
        var t = abiertaId ? tarea(abiertaId) : null, s = t ? String(t.DEPENDE_DE || '') : '', i = s.indexOf(id + ' · ');
        if (i < 0) return '';
        var r = s.slice(i + id.length + 3), j = -1;
        ids(r).forEach(function (o) { var k = r.indexOf(', ' + o); if (k >= 0 && (j < 0 || k < j)) j = k; });
        return (j < 0 ? r : r.slice(0, j)).trim();
      }
      function otroPerfil(id) { return !tarea(id) && tituloDep(id) === (TX.otroPerfil || 'Tarea de otro perfil'); }
      function rel(id) {
        var x = tarea(id);
        if (otroPerfil(id)) return '<span class="frel"><span class="frid">' + texto(id) + '</span><span class="frtit">' + texto(tituloDep(id)) + '</span></span>';
        var st = x ? x.ESTADO : 'No existe';
        return '<a class="frel" href="?s=' + texto(ctx.id.toLowerCase()) + '&amp;t=' + encodeURIComponent(id) + '" data-rel="' + texto(id) + '">' +
          '<span class="fpill ' + cls(st) + '">' + texto(st) + '</span><span class="frid">' + texto(id) + '</span><span class="frtit">' + texto(x ? x.TITULO : '') + '</span></a>';
      }
      function fechaCaja(lab, val, pista, c) {
        return '<div class="ffecha ' + (c || '') + '"><small>' + texto(lab) + '</small><strong>' + texto(val || '—') + '</strong>' + (pista ? '<span class="fpista">' + texto(pista) + '</span>' : '') + '</div>';
      }
      function codigoEpica(n) { var e = epicas().filter(function (x) { return x.EPICA === n; })[0]; return e && e.ID ? e.ID : ''; }

      function pintarFicha() {
        var t = tarea(abiertaId);
        if (!t) { cerrarFicha(); return; }
        if (editando) { pintarEditar(t); return; }
        var id = String(t.ID), elim = t.ESTADO === ELIM, cerrada = t.ESTADO === CERRADA;
        // Fechas
        var fs = [];
        if (tieneCol('DEADLINE')) {
          var n = dias(t.DEADLINE), p = '', c = '';
          if (!t.DEADLINE) { p = 'sin fecha límite'; c = 'nada'; }
          else if (cerrada || elim) c = 'ok';
          else if (n < 0) { p = 'vencida hace ' + (-n) + (n === -1 ? ' día' : ' días'); c = 'venc'; }
          else if (n === 0) { p = 'vence hoy'; c = 'venc'; }
          else if (n === 1) { p = 'vence mañana'; c = 'pronto'; }
          else { p = 'faltan ' + n + ' días'; c = n <= 3 ? 'pronto' : ''; }
          fs.push(fechaCaja(etiqueta('DEADLINE'), fechaEs(t.DEADLINE), p, c));
        }
        if (t.DISPONIBLE_DESDE) fs.push(fechaCaja(etiqueta('DISPONIBLE_DESDE'), fechaEs(t.DISPONIBLE_DESDE), '', dias(t.DISPONIBLE_DESDE) > 0 ? 'pronto' : 'ok'));
        if (cerrada && t.FECHA_CIERRE) fs.push(fechaCaja(etiqueta('FECHA_CIERRE'), fechaEs(t.FECHA_CIERRE), '', 'ok'));
        // Relaciones
        var deps = ids(t.DEPENDE_DE);
        var bloquea = tareas().filter(function (x) { return x.ESTADO !== ELIM && ids(x.DEPENDE_DE).indexOf(id) >= 0; }).map(function (x) { return String(x.ID); });
        var ps = partes(t.DESCRIPCION);
        var docs = lineas(t.DOCUMENTOS_RELEVANTES).map(function (l) {
          var m = /(https?:\/\/\S+)/.exec(l);
          if (!m) return '<p>' + texto(l) + '</p>';
          var nom = l.slice(0, m.index).replace(/[:\s]+$/, '') || m[1];
          return '<p><a href="' + texto(m[1]) + '" target="_blank" rel="noopener">' + texto(nom) + '</a></p>';
        });
        var hist = lineas(t.HISTORIAL).reverse().map(function (l) {
          var m = /^(\d{2}\/\d{2}\/\d{4}[^(]*\([^)]*\):?)\s*([\s\S]*)$/.exec(l);
          return '<p class="hito">' + (m ? '<span class="hito-cuando">' + texto(m[1]) + '</span> ' + texto(m[2]) : texto(l)) + '</p>';
        });
        var cod = codigoEpica(t.EPICA), chat = (cod ? cod + ' · ' : '') + id + ' ' + String(t.TITULO || '');
        var tags = [];
        if (t.EPICA) tags.push('<span class="ftag" title="' + texto(etiqueta('EPICA')) + '">' + texto(t.EPICA) + '</span>');
        tags.push('<span class="ftag" title="' + texto(etiqueta('ASIGNADO')) + '">' + texto(String(t.ASIGNADO || '').trim() || 'Sin asignar') + '</span>');
        if (t.P) tags.push('<span class="ftag p' + String(t.P).length + '" title="' + texto(etiqueta('P')) + '">' + texto(etiqueta('P')) + ' ' + texto(t.P) + '</span>');
        if (t.T) tags.push('<span class="ftag" title="' + texto(etiqueta('T')) + '">' + texto(etiqueta('T')) + ' ' + texto(t.T) + '</span>');
        caja.innerHTML =
          '<div class="barra"><button type="button" class="volver" data-cerrar>' + ICO_VOLVER + 'Volver al tablero</button></div>' +
          '<div class="cab"><div class="id"><span class="n">' + texto(t._nueva ? 'Creando…' : id) + '</span>' + (t._pendiente ? '<span class="chip">Guardando</span>' : '') + '</div><h1 id="kb-f-tit">' + texto(t.TITULO) + '</h1></div>' +
          '<div class="fmeta">' + tags.join('') + '</div>' +
          (elim
            ? '<div class="est ' + cls(ELIM) + '"><span class="fpill">' + texto(ELIM) + '</span><span class="msg">No sale en el tablero.</span>' +
              '<button type="button" class="sec" data-recuperar>' + texto(TX.recuperar || 'Recuperar tarea') + '</button></div>'
            : '<div class="est ' + cls(t.ESTADO) + '"><label for="kb-f-est">' + texto(etiqueta('ESTADO')) + '</label><select id="kb-f-est"' + (t._nueva ? ' disabled' : '') + '>' +
              estadosFicha().map(function (e) { return '<option' + (e === t.ESTADO ? ' selected' : '') + '>' + texto(e) + '</option>'; }).join('') + '</select>' +
              (t._pendiente ? '<span class="msg">Guardando…</span>' : '') + '</div>') +
          (fs.length || deps.length || bloquea.length ? '<div class="datos">' +
            (fs.length ? '<div class="fila"><b>Fechas</b><div class="ffechas">' + fs.join('') + '</div></div>' : '') +
            (deps.length ? '<div class="fila"><b>' + texto(etiqueta('DEPENDE_DE')) + '</b><div class="frels">' + deps.map(rel).join('') + '</div></div>' : '') +
            (bloquea.length ? '<div class="fila"><b>La esperan</b><div class="frels">' + bloquea.map(rel).join('') + '</div></div>' : '') + '</div>' : '') +
          bloque(etiqueta('SOLICITUD'), ps.SOLICITUD, 'Solicitud') + bloque('Decisiones', ps.DECISIONES) + bloque('Abierto', ps.ABIERTO) +
          (docs.length ? '<div class="bloque"><h3>' + texto(etiqueta('DOCUMENTOS_RELEVANTES')) + '</h3>' + docs.join('') + '</div>' : '') +
          (C.CHAT !== 'No' && !t._nueva ? '<div class="claude"><h3>Nombre del chat</h3><div class="claude-fila"><span class="claude-texto">' + texto(chat) + '</span>' +
            '<button type="button" class="sec" data-copiar="' + texto(chat) + '">Copiar nombre</button></div></div>' : '') +
          (hist.length ? '<div class="bloque hist"><h3>' + texto(etiqueta('HISTORIAL')) + ' (lo más reciente arriba)</h3>' + hist.join('') + '</div>' : '') +
          bloque(etiqueta('CONCLUSIONES'), lineas(t.CONCLUSIONES)) +
          (t._nueva ? '' : '<div class="pie">' + (elim ? '' : '<button type="button" class="sec" data-editar>' + texto(TX.editar || 'Editar tarea') + '</button>') + '</div>' +
            (elim ? '' : '<div class="elim"><button type="button" class="elim-btn" data-eliminar>' + texto(TX.eliminar || 'Eliminar tarea') + '</button></div>'));
        var s = caja.querySelector('#kb-f-est');
        if (s) s.onchange = function () { cambiarEstado(id, this.value); };
      }

      caja.addEventListener('click', function (e) {
        var x;
        if (e.target.closest('[data-cerrar]')) { cerrarFicha(); return; }
        if ((x = e.target.closest('[data-rel]'))) { e.preventDefault(); var r = x.getAttribute('data-rel'); if (tarea(r)) abrirFicha(r); return; }
        if ((x = e.target.closest('[data-copiar]'))) { copiar(x.getAttribute('data-copiar'), x); return; }
        if (e.target.closest('[data-editar]')) { editando = true; pintarFicha(); var p = caja.querySelector('input,select,textarea'); if (p) p.focus(); return; }
        if (e.target.closest('[data-recuperar]')) { cambiarEstado(abiertaId, NUEVA); return; }
        if ((x = e.target.closest('[data-eliminar]'))) { confirmarEliminar(x); return; }
        if (e.target.closest('[data-elim-si]')) { cambiarEstado(abiertaId, ELIM); return; }
        if (e.target.closest('[data-elim-no]')) { pintarFicha(); return; }
        if (e.target.closest('[data-cancelar]')) { editando = false; pintarFicha(); return; }
      });
      function copiar(txt, b) {
        var hecho = function () { b.textContent = 'Copiado'; setTimeout(function () { b.textContent = 'Copiar nombre'; }, 2000); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(hecho, function () {});
      }
      function confirmarEliminar(b) {
        var t = tarea(abiertaId), cont = b.parentNode;
        var esperan = tareas().filter(function (x) { return x.ESTADO !== ELIM && ids(x.DEPENDE_DE).indexOf(abiertaId) >= 0; }).length;
        cont.classList.add('abierta');
        cont.innerHTML = '<h3>' + texto(TX.eliminar || 'Eliminar tarea') + ' ' + texto(abiertaId) + '</h3>' +
          '<p>Sale del tablero y queda como ' + texto(ELIM) + ' en el Excel, con su historial. Se puede recuperar desde esta ficha.</p>' +
          (esperan ? '<p class="elim-dep">' + esperan + (esperan === 1 ? ' tarea espera' : ' tareas esperan') + ' a esta: dejarán de esperarla.</p>' : '') +
          '<div class="elim-pie"><button type="button" class="sec" data-elim-no>Cancelar</button>' +
          '<button type="button" class="sec peligro" data-elim-si>' + texto(TX.eliminar || 'Eliminar tarea') + ' ' + texto(t ? t.ID : '') + '</button></div>';
        cont.querySelector('[data-elim-no]').focus();
      }

      /* ---------- formulario (alta y editar) ---------- */

      /** Un campo del formulario según su columna: desplegable, fecha, texto largo, título con contador o «espera a». */
      function campo(n, v, pre) {
        var c = col(n), lab = etiqueta(n), idc = pre + n, ob = n === 'SOLICITUD' || (c && c.obligatoria);
        var opc = ob ? '' : ' <span class="opc">(opcional)</span>';
        var ayuda = n === 'SOLICITUD' ? TX.ayudaSolicitud : '';
        var h;
        if (n === 'DEPENDE_DE') {
          var sel = ids(v);
          var cand = tareas().filter(function (x) { return x.ESTADO !== ELIM && x.ESTADO !== CERRADA && !x._nueva && String(x.ID) !== abiertaId; })
            .sort(function (a, b) { return String(b.ID).localeCompare(String(a.ID)); });
          h = '<div class="deps" data-deps="' + texto(sel.join(',')) + '">' + sel.map(chipDep).join('') + '</div>' +
            '<select id="' + idc + '" data-anadir-dep><option value="">Añadir una tarea…</option>' +
            cand.map(function (x) { return '<option value="' + texto(x.ID) + '">' + texto(x.ID + ' · ' + x.TITULO) + '</option>'; }).join('') + '</select>';
        } else if (n === 'SOLICITUD' || n === 'DOCUMENTOS_RELEVANTES') {
          h = '<textarea id="' + idc + '" rows="' + (n === 'SOLICITUD' ? 4 : 3) + '"' + (ob ? ' required' : '') + '>' + texto(v) + '</textarea>';
          if (n === 'DOCUMENTOS_RELEVANTES') ayuda = 'Uno por línea: «Nombre: enlace».';
        } else if (c && (c.tipo === 'fecha')) {
          h = '<input type="date" id="' + idc + '" value="' + texto(v) + '">';
        } else if (n === 'EPICA' || n === 'ASIGNADO' || (c && c.valores)) {
          var vs = valores(n);
          if (v && vs.indexOf(v) < 0) vs = [v].concat(vs);
          h = '<select id="' + idc + '"' + (ob ? ' required' : '') + '><option value="">Elige…</option>' +
            vs.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + texto(x) + '</option>'; }).join('') + '</select>';
        } else {
          var lim = n === 'TITULO' ? Number(C.LIMITE_TITULO) || 0 : 0;
          h = '<input type="text" id="' + idc + '" value="' + texto(v) + '"' + (ob ? ' required' : '') + (lim ? ' data-limite="' + lim + '"' : '') + ' autocomplete="off">';
          if (lim) ayuda = '<span class="contador" data-cuenta="' + idc + '">' + String(v || '').length + ' / ' + lim + '</span> · Empieza por un verbo y di qué se entrega.';
        }
        return '<div class="campo" data-campo="' + texto(n) + '"><label class="lab" for="' + idc + '">' + texto(lab) + opc + '</label>' + h +
          (ayuda ? '<div class="ayuda">' + (n === 'TITULO' ? ayuda : texto(ayuda)) + '</div>' : '') + '</div>';
      }
      function chipDep(x) {
        var t = tarea(x), tt = t ? t.TITULO : otroPerfil(x) ? tituloDep(x) : ''; // T0267
        return '<span class="chip" data-dep="' + texto(x) + '"><span>' + texto(x + (tt ? ' · ' + tt : '')) + '</span><button type="button" class="quitar" aria-label="Quitar ' + texto(x) + '" data-quitar-dep="' + texto(x) + '">×</button></span>';
      }
      /** Engancha contador, «espera a» y quitar en un formulario. */
      function vivo(f) {
        f.addEventListener('input', function (e) {
          var l = e.target.getAttribute && e.target.getAttribute('data-limite');
          if (!l) return;
          var k = f.querySelector('[data-cuenta="' + e.target.id + '"]'), n = e.target.value.trim().replace(/\.+$/, '').length;
          k.textContent = n + ' / ' + l; k.classList.toggle('mal', n > Number(l));
        });
        f.addEventListener('change', function (e) {
          if (!e.target.hasAttribute('data-anadir-dep') || !e.target.value) return;
          var d = f.querySelector('[data-deps]'), ya = d.getAttribute('data-deps') ? d.getAttribute('data-deps').split(',') : [];
          if (ya.indexOf(e.target.value) < 0) { ya.push(e.target.value); d.setAttribute('data-deps', ya.join(',')); d.insertAdjacentHTML('beforeend', chipDep(e.target.value)); }
          e.target.value = '';
        });
        f.addEventListener('click', function (e) {
          var q = e.target.closest('[data-quitar-dep]');
          if (!q) return;
          var d = f.querySelector('[data-deps]'), x = q.getAttribute('data-quitar-dep');
          d.setAttribute('data-deps', d.getAttribute('data-deps').split(',').filter(function (y) { return y && y !== x; }).join(','));
          q.closest('[data-dep]').remove();
        });
      }
      /** Lo que hay en el formulario: { CAMPO: valor } (DEPENDE_DE como lista de IDs). */
      function leerForm(f, ns, pre) {
        var o = {};
        ns.forEach(function (n) {
          if (n === 'DEPENDE_DE') { var d = f.querySelector('[data-deps]'); o[n] = d && d.getAttribute('data-deps') ? d.getAttribute('data-deps').split(',').filter(String) : []; return; }
          var x = f.querySelector('#' + pre + n);
          if (x) o[n] = n === 'TITULO' ? x.value.trim().replace(/\.+$/, '') : x.value.trim();
        });
        return o;
      }
      function errores(o, ns) {
        var mal = [];
        ns.forEach(function (n) {
          var c = col(n), ob = n === 'SOLICITUD' || (c && c.obligatoria);
          if (ob && n !== 'DEPENDE_DE' && !String(o[n] || '').trim()) mal.push(etiqueta(n) + ': falta.');
        });
        var lim = Number(C.LIMITE_TITULO) || 0;
        if (lim && String(o.TITULO || '').length > lim) mal.push(etiqueta('TITULO') + ': pasa de ' + lim + ' caracteres.');
        return mal;
      }
      function dependeTexto(xs) { return xs.map(function (x) { var t = tarea(x); return x + (t ? ' · ' + t.TITULO : ''); }).join(', '); }

      /* ---------- editar ---------- */

      /** Campos del formulario que existen en TAREAS (se mira al abrirlo: al entrar puede que aún no estén los datos). */
      function camposEditar() { return (Array.isArray(C.CAMPOS_EDITAR) ? C.CAMPOS_EDITAR : []).filter(function (n) { return n === 'SOLICITUD' || tieneCol(n); }); }
      function valorDe(t, n) { return n === 'SOLICITUD' ? solicitudDe(t.DESCRIPCION).solicitud : n === 'DEPENDE_DE' ? ids(t.DEPENDE_DE).join(',') : String(t[n] == null ? '' : t[n]); }
      function pintarEditar(t) {
        var CAMPOS_EDITAR = camposEditar();
        caja.innerHTML =
          '<div class="barra"><button type="button" class="volver" data-cancelar>' + ICO_VOLVER + 'Volver a la ficha</button></div>' +
          '<div class="cab"><div class="id">' + texto(t.ID) + '</div><h1 id="kb-f-tit">' + texto(TX.editar || 'Editar tarea') + '</h1></div>' +
          '<form class="edit" id="kb-edit" novalidate>' + CAMPOS_EDITAR.map(function (n) { return campo(n, valorDe(t, n), 'kb-e-'); }).join('') +
          '<p class="msg mal" id="kb-e-err" role="alert"></p>' +
          '<div class="pie"><button type="button" class="sec" data-cancelar>Cancelar</button><button type="submit" class="accion">' + texto(TX.guardar || 'Guardar cambios') + '</button></div></form>';
        var f = caja.querySelector('#kb-edit');
        vivo(f);
        f.onsubmit = function (e) {
          e.preventDefault();
          var o = leerForm(f, CAMPOS_EDITAR, 'kb-e-'), mal = errores(o, CAMPOS_EDITAR);
          if (mal.length) { caja.querySelector('#kb-e-err').textContent = mal.join(' '); return; }
          guardarEdicion(t, o, CAMPOS_EDITAR);
        };
      }
      function guardarEdicion(t, o, CAMPOS_EDITAR) {
        var id = String(t.ID), srv = {}, local = {}, antes = {}, que = [];
        CAMPOS_EDITAR.forEach(function (n) {
          var v = o[n];
          if (n === 'DEPENDE_DE') { if (ids(v).join(',') === ids(t.DEPENDE_DE).join(',')) return; srv[n] = v; local[n] = dependeTexto(v); antes[n] = t[n]; }
          else if (n === 'SOLICITUD') { var s = solicitudDe(t.DESCRIPCION); if (v === s.solicitud) return; srv[n] = v; local.DESCRIPCION = 'SOLICITUD: ' + v + s.resto; antes.DESCRIPCION = t.DESCRIPCION; }
          else { if (String(t[n] == null ? '' : t[n]) === v) return; srv[n] = v; local[n] = v; antes[n] = t[n]; }
          que.push(etiqueta(n).toLowerCase());
        });
        editando = false;
        if (!que.length) { pintarFicha(); return; }
        if (C.HISTORIAL !== 'No' && tieneCol('HISTORIAL')) local.HISTORIAL = conLinea(t.HISTORIAL, lineaHist('editada desde el kanban web: ' + que.join(', ') + '.'));
        ctx.tablas.actualizar(T, id, local, { fn: 'kanbanEditar', args: [id, srv, antes] }).then(function (r) {
          if (ctx.abierta()) ctx.aviso(r && r.aviso ? r.aviso : id + ' guardada.');
        }, function () {});
        pintarFicha();
      }

      /* ---------- alta ---------- */

      function camposAlta() { return (Array.isArray(C.CAMPOS_ALTA) ? C.CAMPOS_ALTA : ['TITULO', 'SOLICITUD', 'EPICA', 'ASIGNADO', 'P', 'T']).filter(function (n) { return n === 'SOLICITUD' || tieneCol(n); }); }
      function abrirAlta() {
        abiertaId = '';
        var CAMPOS_ALTA = camposAlta();
        var dflt = { ASIGNADO: personas().indexOf(ctx.persona) >= 0 ? ctx.persona : '', EPICA: F.EPICA || '' };
        altaForm.innerHTML = '<h2>' + texto(TX.nueva || 'Añadir tarea') + '</h2>' +
          '<div class="edit">' + CAMPOS_ALTA.map(function (n) { return campo(n, dflt[n] || '', 'kb-a-'); }).join('') + '</div>' +
          '<div id="alta-error" role="alert"></div>' +
          '<div class="botones"><button type="button" class="sec" data-cancelar-alta>Cancelar</button><button type="submit" class="pri">' + texto(TX.crear || 'Crear tarea') + '</button></div>';
        altaVelo.classList.add('abierto');
        document.documentElement.classList.add('fv-abierta');
        var p = altaForm.querySelector('input,textarea,select'); if (p) p.focus();
      }
      function cerrarAlta() { altaVelo.classList.remove('abierto'); document.documentElement.classList.remove('fv-abierta'); }
      vivo(altaForm);
      $('alta-btn').onclick = abrirAlta;
      altaVelo.addEventListener('click', function (e) { if (e.target === altaVelo || e.target.closest('[data-cancelar-alta]')) cerrarAlta(); });
      altaVelo.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarAlta(); });
      altaForm.onsubmit = function (e) {
        e.preventDefault();
        var CAMPOS_ALTA = camposAlta();
        var o = leerForm(altaForm, CAMPOS_ALTA, 'kb-a-'), mal = errores(o, CAMPOS_ALTA), er = altaForm.querySelector('#alta-error');
        if (mal.length) { er.textContent = mal.join(' '); er.style.display = 'block'; return; }
        var deps = o.DEPENDE_DE || [];
        var abiertas = C.DEPENDENCIAS !== 'No' ? deps.filter(function (d) { var x = tarea(d); return x && x.ESTADO !== CERRADA && x.ESTADO !== ELIM; }) : [];
        var local = {};
        CAMPOS_ALTA.forEach(function (n) { if (n !== 'SOLICITUD' && n !== 'DEPENDE_DE') local[n] = o[n]; });
        if ('SOLICITUD' in o) local.DESCRIPCION = 'SOLICITUD: ' + o.SOLICITUD;
        if (tieneCol('DEPENDE_DE')) local.DEPENDE_DE = dependeTexto(deps);
        local.ESTADO = abiertas.length ? BLOQ : NUEVA;
        if (tieneCol('HISTORIAL')) local.HISTORIAL = lineaHist('creada desde el kanban web en ' + NUEVA + '.');
        cerrarAlta();
        ctx.tablas.crear(T, local, { fn: 'kanbanCrear', args: [o] }).then(function (r) {
          if (ctx.abierta()) ctx.aviso(r.aviso ? 'Creada ' + r.id + '. ' + r.aviso : 'Creada ' + r.id + ': ' + (local.TITULO || ''));
        }, function () {});
      };

      /* ---------- arranque ---------- */

      function opciones() {
        return ctx.llamar('kanbanOpciones').then(function (r) {
          var cambia = JSON.stringify(r) !== JSON.stringify(O);
          O = r; reId = null; guardarLocal(CLAVE + '_op', r);
          if (cambia && ctx.abierta()) { pintarFiltros(); pintarTablero(); if (abiertaId) pintarFicha(); }
        });
      }
      function todo() {
        pintarFiltros(); pintarTablero();
        if (abiertaId) pintarFicha();
      }
      ctx.alCambiar(function (t) {
        if (t !== T && t !== TE) return;
        pintarTablero();
        if (t === TE) pintarFiltros();
        if (abiertaId && !editando) pintarFicha();
      });
      abrirFiltros(!!F._ab);
      ctx.tablas.leer([T, TE]).then(function () {
        leido = true;
        if (!ctx.abierta()) return;
        todo();
        var pedida = new URLSearchParams(location.search).get('t');
        if (pedida && tarea(pedida)) abrirFicha(pedida, true);
      }, function (e) {
        leido = true;
        tab.innerHTML = '<p class="u-error kb-vacio">No se han podido leer las tareas.</p><p class="u-nota kb-vacio">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Pulsa ↻ o vuelve a abrir la sección.</p>';
      });
      opciones().catch(function () {});
      this._cerrar = function () { el.classList.remove('kb'); document.documentElement.classList.remove('fv-abierta'); urlFicha(''); };
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); }
  });
})();
