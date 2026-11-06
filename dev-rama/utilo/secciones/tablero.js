/*
 * Tablero de la gestión de Utilo · plataforma interna sobre Supabase (T0386) · clientes/utilo/modulos/tablero de utilo-apps
 *
 * Las tareas de todas las iniciativas que ve quien ha entrado, en una columna por estado (los del plan de la plataforma),
 * con «en manos de» (quién tiene que mover ficha) y la entrega (U19) en cada tarjeta, y su ficha. Sigue el contrato de una
 * sección (docs/CONTRATO_SECCION.md) y el diseño del Kanban de siempre (estilos/kanban.css sobre base.css y marca.css).
 * - Lee la vista TABLERO (public.tablero: cada tarea con su entrega corta y en manos de quién está) con la capa de tablas,
 *   que va a Supabase con la sesión de quien ha entrado: lo que se ve lo dicen sus roles (reglas por fila).
 * - Vista (arriba): «8 columnas» (todas menos Aplazada y Descartada), «Todas» (los diez estados) o «Agrupadas» (Necesita tu
 *   respuesta con Bloqueada y Para revisar con Aprobada; el estado exacto, en la tarjeta). La primera vez, la de
 *   config.VISTA; después, la última de este dispositivo. Entregadas y Descartadas, solo las de los últimos días (Filtros).
 * - Filtros: iniciativa, entrega, persona (en manos de, asignada, pide o revisa), épica y prioridad; y buscar.
 * - Las personas son su id en la base: el nombre sale de personas_gestion().
 * - Se pinta al momento con lo guardado en el dispositivo y se refresca por detrás.
 */
(function () {
  'use strict';
  var T = 'TABLERO', TI = 'INICIATIVAS', TE = 'ENTREGAS', TD = 'DEPENDENCIAS', TB = 'BITACORA';
  var RAIZ = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/utilo\/secciones\/[^/]*$/, '') : '../../'; })();
  var VERSION = (function () { var s = document.currentScript && document.currentScript.src; var m = s && /[?&]v=([^&]+)/.exec(s); return m ? m[1] : '1'; })();
  var ICO_RECARGAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
  var ICO_VOLVER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';

  /** Los estados, en el orden del flujo, con su color de estilos/base.css y quién mueve ficha. */
  var ESTADOS = ['Esperando', 'En cola', 'En curso', 'Necesita tu respuesta', 'Bloqueada', 'Para revisar', 'Aprobada', 'Entregada', 'Aplazada', 'Descartada'];
  var COLOR = { 'Esperando': 'x', 'En cola': 'ni', 'En curso': 'ec', 'Necesita tu respuesta': 'pr', 'Bloqueada': 'bl', 'Para revisar': 'pr', 'Aprobada': 'co',
    'Entregada': 'co', 'Aplazada': 'x', 'Descartada': 'x' };
  var CERRADOS = ['Entregada', 'Descartada'];
  /** Las columnas de cada vista: [{ id, titulo, estados }]. */
  var VISTAS = {
    ocho: { titulo: '8 columnas', cols: ESTADOS.filter(function (e) { return e !== 'Aplazada' && e !== 'Descartada'; }).map(function (e) { return { id: e, titulo: e, estados: [e] }; }) },
    todas: { titulo: 'Todas', cols: ESTADOS.map(function (e) { return { id: e, titulo: e, estados: [e] }; }) },
    agrupadas: { titulo: 'Agrupadas', cols: [
      { id: 'Esperando', titulo: 'Esperando', estados: ['Esperando'] },
      { id: 'En cola', titulo: 'En cola', estados: ['En cola'] },
      { id: 'En curso', titulo: 'En curso', estados: ['En curso'] },
      { id: 'Atascadas', titulo: 'Atascadas', estados: ['Necesita tu respuesta', 'Bloqueada'], color: 'bl' },
      { id: 'En revisión', titulo: 'En revisión', estados: ['Para revisar', 'Aprobada'], color: 'pr' },
      { id: 'Entregada', titulo: 'Entregada', estados: ['Entregada'] }
    ] }
  };
  var ETIQUETA = { ASIGNADO: 'Asignada a', PIDE: 'La pide', REVISA: 'La revisa', EPICA: 'Épica', P: 'Prioridad', T: 'Tamaño', INICIATIVA: 'Iniciativa',
    ENTREGA: 'Entrega', DEADLINE: 'Fecha límite', DISPONIBLE_DESDE: 'No empezar antes del', FECHA_CIERRE: 'Cerrada el', REVISAR_EL: 'Se vuelve a mirar el',
    DESCRIPCION: 'Qué hay que hacer', DOCUMENTOS_RELEVANTES: 'Documentos', CONCLUSIONES: 'Conclusiones', PREGUNTA: 'Pregunta', MOTIVO: 'Motivo',
    MOTIVO_BLOQUEO: 'Motivo del bloqueo', HERRAMIENTA: 'Herramienta', EMPLEADO: 'Empleado IA' };

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function leerLocal(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function guardarLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  /** 'aaaa-mm-dd' (o con hora) → 'dd/mm/aaaa' */
  function fechaEs(s) { var m = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d:\d\d))?/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] + (m[4] ? ' ' + m[4] : '') : String(s || ''); }
  /** Días de hoy a esa fecha ('aaaa-mm-dd'); null si no hay. */
  function dias(s) {
    var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || ''));
    if (!m) return null;
    var f = new Date(+m[1], +m[2] - 1, +m[3]), h = new Date(); h.setHours(0, 0, 0, 0);
    return Math.round((f - h) / 864e5);
  }
  function lineas(s) { return String(s || '').split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).filter(function (l) { return l.trim(); }); }

  /** Una vez por página: la hoja del tablero y la ficha (la del Kanban). */
  function estilos() {
    if (document.getElementById('kb-css')) return;
    var l = document.createElement('link');
    l.id = 'kb-css'; l.rel = 'stylesheet'; l.href = RAIZ + 'estilos/kanban.css?v=' + encodeURIComponent(VERSION);
    document.head.appendChild(l);
  }

  window.UN.registrar('TABLERO', {
    abrir: function (el, ctx) {
      estilos();
      var C = ctx.config || {};
      var DIAS = Number(C.DIAS_CERRADAS) || 30;
      var CLAVE = 'tb_' + ctx.id + '_' + String(ctx.correo || ctx.persona || '').toLowerCase().replace(/\W+/g, '');
      var F = leerLocal(CLAVE + '_f', {});           // filtros y vista de este dispositivo
      if (!VISTAS[F.vista]) F.vista = VISTAS[C.VISTA] ? C.VISTA : 'ocho';
      if (typeof F.dias !== 'number') F.dias = DIAS;
      F.busca = '';
      var GENTE = leerLocal(CLAVE + '_gente', {});   // id de persona → nombre (personas_gestion)
      var PL = leerLocal(CLAVE + '_pl', null);       // columnas plegadas; la primera vez, en el móvil, todas menos En curso
      if (!PL) { PL = {}; if (window.matchMedia && matchMedia('(max-width:640px)').matches) ESTADOS.concat(['Atascadas', 'En revisión']).forEach(function (e) { if (e !== 'En curso') PL[e] = 1; }); }
      var abiertaId = '', leido = false;

      el.classList.add('kb');
      el.innerHTML =
        '<div class="filtros">' +
          '<label class="busca"><span class="u-oculto">Buscar tareas</span><input type="search" id="kb-busca" placeholder="Buscar tareas" autocomplete="off"></label>' +
          '<label class="tb-vista"><span class="u-oculto">Vista</span><select id="kb-vista" aria-label="Vista del tablero">' +
            Object.keys(VISTAS).map(function (k) { return '<option value="' + k + '"' + (k === F.vista ? ' selected' : '') + '>' + texto(VISTAS[k].titulo) + '</option>'; }).join('') +
          '</select></label>' +
          '<button id="kb-fil" class="sec k-fil" type="button" aria-controls="kb-mas" aria-expanded="false">Filtros<span id="kb-fil-n" class="k-fil-n" hidden></span></button>' +
          '<div id="kb-mas" class="k-mas" hidden></div>' +
          '<span class="act"><button id="kb-rec" class="sec recarga" type="button" title="Traer lo último" aria-label="Traer lo último">' + ICO_RECARGAR + '</button></span>' +
        '</div>' +
        '<div id="kb-tab" class="tablero"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<div class="fv-velo" id="kb-fv"><div class="fv-caja kb-ficha" role="dialog" aria-modal="true" aria-labelledby="kb-f-tit" id="kb-ficha"></div></div>';
      var $ = function (id) { return el.querySelector('#' + id); };
      var tab = $('kb-tab'), fv = $('kb-fv'), caja = $('kb-ficha');

      /* ---------- datos ---------- */

      function tareas() { return ctx.tablas.filas(T); }
      function tarea(id) { return ctx.tablas.fila(T, id); }
      /** El nombre de una persona (su id); si aún no está en la lista de personas_gestion, «Sin nombre». */
      function nombre(id) { return id ? GENTE[id] || 'Sin nombre' : ''; }
      function iniciativa(id) { var i = ctx.tablas.fila(TI, id); return i ? i.NOMBRE || id : id; }
      function entrega(id) { return id ? ctx.tablas.fila(TE, id) : null; }
      function variasIniciativas() { var vs = {}; tareas().forEach(function (t) { vs[t.INICIATIVA] = 1; }); return Object.keys(vs).length > 1; }
      function cls(estado, col) { return 's-' + ((col && col.color) || COLOR[estado] || 'x'); }
      /** En manos de quién está, como se lee en la tarjeta (la vista lo da; una persona, con su nombre de aquí). */
      function enManos(t) {
        if (t.EN_MANOS_TIPO === 'persona') return GENTE[t.EN_MANOS_DE] || t.EN_MANOS_NOMBRE || '';
        return t.EN_MANOS_NOMBRE || '';
      }
      /** Las tareas que esperan a esta y a las que espera esta (DEPENDENCIAS: TAREA espera a DE). */
      function esperaA(id) { return ctx.tablas.filas(TD).filter(function (d) { return d.TAREA === id; }).map(function (d) { return d.DE; }); }
      function laEsperan(id) { return ctx.tablas.filas(TD).filter(function (d) { return d.DE === id; }).map(function (d) { return d.TAREA; }); }

      /* ---------- filtros ---------- */

      var FILTROS = [
        { k: 'INICIATIVA', t: 'Iniciativa', vs: function () { return ctx.tablas.filas(TI).map(function (i) { return [i.ID, i.NOMBRE || i.ID]; }); } },
        { k: 'ENTREGA', t: 'Entrega', vs: function () {
          var usadas = {}; tareas().forEach(function (t) { if (t.ENTREGA) usadas[t.ENTREGA] = t.ENTREGA_CORTA || t.ENTREGA; });
          return ctx.tablas.filas(TE).filter(function (e) { return usadas[e.ID]; }).map(function (e) { return [e.ID, usadas[e.ID] + ' · ' + (e.NOMBRE || '')]; }).concat([['-', 'Sin entrega']]);
        } },
        { k: 'PERSONA', t: 'Persona', vs: function () {
          return Object.keys(GENTE).map(function (id) { return [id, GENTE[id]]; }).sort(function (a, b) { return a[1].localeCompare(b[1]); });
        } },
        { k: 'EPICA', t: 'Épica', vs: function () {
          var vs = []; tareas().forEach(function (t) { if (t.EPICA && vs.indexOf(t.EPICA) < 0) vs.push(t.EPICA); });
          return vs.sort().map(function (v) { return [v, v]; });
        } },
        { k: 'P', t: 'Prioridad', vs: function () { return ['!!!!', '!!!', '!!', '!'].map(function (v) { return [v, v]; }); } }
      ];
      function pintarFiltros() {
        $('kb-mas').innerHTML = FILTROS.map(function (f) {
          var v = F[f.k] || '';
          return '<label>' + texto(f.t) + '<select data-f="' + f.k + '"><option value="">' + (f.k === 'PERSONA' ? 'Todas las personas' : 'Todas') + '</option>' +
            f.vs().map(function (x) { return '<option value="' + texto(x[0]) + '"' + (x[0] === v ? ' selected' : '') + '>' + texto(x[1]) + '</option>'; }).join('') + '</select></label>';
        }).join('') +
          '<label>Entregadas y descartadas en los últimos (días)<input type="number" min="0" id="kb-dias" value="' + F.dias + '"></label>';
        cuenta();
      }
      function cuenta() {
        var k = FILTROS.filter(function (f) { return F[f.k]; }).length + (F.dias !== DIAS ? 1 : 0);
        var s = $('kb-fil-n'); s.textContent = k ? String(k) : ''; s.hidden = !k;
        $('kb-fil').title = k ? k + (k === 1 ? ' filtro puesto' : ' filtros puestos') : 'Sin filtros';
      }
      function abrirFiltros(ab) { $('kb-mas').hidden = !ab; $('kb-fil').setAttribute('aria-expanded', ab ? 'true' : 'false'); F._ab = ab; guardarLocal(CLAVE + '_f', F); }
      $('kb-fil').onclick = function () { abrirFiltros($('kb-mas').hidden); };
      $('kb-mas').addEventListener('change', function (e) {
        var s = e.target.closest('[data-f]');
        if (s) F[s.getAttribute('data-f')] = s.value;
        if (e.target.id === 'kb-dias') { var n = parseInt(e.target.value, 10); F.dias = isNaN(n) || n < 0 ? DIAS : n; e.target.value = F.dias; }
        guardarLocal(CLAVE + '_f', F); cuenta(); pintarTablero();
      });
      $('kb-vista').onchange = function () { F.vista = this.value; guardarLocal(CLAVE + '_f', F); pintarTablero(); };
      var tBusca = 0;
      $('kb-busca').addEventListener('input', function () { var v = this.value; clearTimeout(tBusca); tBusca = setTimeout(function () { F.busca = v.trim().toLowerCase(); pintarTablero(); }, 120); });
      $('kb-rec').onclick = function () {
        var b = this; b.disabled = true; b.classList.add('girando');
        Promise.all([ctx.tablas.refrescar([T, TI, TE, TD], true), gente()]).then(function () { if (ctx.abierta()) ctx.aviso('Tablero al día.'); }, function (e) {
          if (ctx.abierta()) ctx.aviso('No se ha podido actualizar: ' + String(e.message).replace(/^\w+:\s*/, ''));
        }).then(function () { b.disabled = false; b.classList.remove('girando'); });
      };

      function pasa(t) {
        if (F.busca) {
          var hay = [t.ID, t.TITULO, t.DESCRIPCION, t.EPICA, t.ENTREGA_CORTA, enManos(t), nombre(t.ASIGNADO)].join(' ').toLowerCase();
          return F.busca.split(/\s+/).every(function (p) { return hay.indexOf(p) >= 0; });
        }
        if (F.INICIATIVA && t.INICIATIVA !== F.INICIATIVA) return false;
        if (F.ENTREGA && (F.ENTREGA === '-' ? !!t.ENTREGA : t.ENTREGA !== F.ENTREGA)) return false;
        if (F.PERSONA && [t.EN_MANOS_TIPO === 'persona' ? t.EN_MANOS_DE : '', t.ASIGNADO, t.PIDE, t.REVISA].indexOf(F.PERSONA) < 0) return false;
        if (F.EPICA && t.EPICA !== F.EPICA) return false;
        if (F.P && t.P !== F.P) return false;
        if (CERRADOS.indexOf(t.ESTADO) >= 0) { var d = dias(t.FECHA_CIERRE); return d === null || -d <= F.dias; }
        return true;
      }

      /* ---------- tablero ---------- */

      /** Primero lo urgente y lo que vence en 7 días, después la prioridad, la fecha límite y la más antigua (como la 4.x). */
      function ordenar(ts, cerradas) {
        if (cerradas) return ts.sort(function (a, b) { return String(b.FECHA_CIERRE || '').localeCompare(String(a.FECHA_CIERRE || '')) || String(b.ID).localeCompare(String(a.ID)); });
        var dl = function (t) { var d = dias(t.DEADLINE); return d === null ? 1e9 : d; };
        var ur = function (t) { return t.URGENTE || dl(t) <= 7 ? 1 : 0; };
        var pn = function (t) { return String(t.P || '').length; };
        return ts.sort(function (a, b) {
          return (ur(b) - ur(a)) || (ur(a) ? dl(a) - dl(b) : 0) || (pn(b) - pn(a)) || (dl(a) - dl(b)) || String(a.ID).localeCompare(String(b.ID));
        });
      }
      function tarjeta(t, col) {
        var id = String(t.ID), m = [], x = [], varias = variasIniciativas();
        var manos = enManos(t);
        if (manos) m.push(manos);
        if (t.EPICA) m.push(t.EPICA);
        if (t.P) m.push(t.P);
        if (varias) m.push(iniciativa(t.INICIATIVA));
        if (col.estados.length > 1) x.push('<div class="x"><b>' + texto(t.ESTADO) + '</b></div>');
        if (t.ESTADO === 'Necesita tu respuesta' && t.PREGUNTA) x.push('<div class="x">Pregunta: ' + texto(t.PREGUNTA) + '</div>');
        if (t.ESTADO === 'Aplazada' && t.REVISAR_EL) x.push('<div class="x">Se vuelve a mirar el ' + fechaEs(t.REVISAR_EL) + '</div>');
        if (CERRADOS.indexOf(t.ESTADO) >= 0) { if (t.FECHA_CIERRE) x.push('<div class="x">Cerrada el ' + fechaEs(t.FECHA_CIERRE) + '</div>'); }
        else {
          var d = dias(t.DEADLINE);
          if (d !== null) x.push('<div class="x' + (d < 0 ? ' venc' : '') + '">' + (d < 0 ? 'Vencida: ' : d === 0 ? 'Vence hoy: ' : 'Vence el ') + fechaEs(t.DEADLINE) + '</div>');
        }
        return '<div class="card ' + cls(t.ESTADO) + '-b" data-id="' + texto(id) + '">' +
          '<a class="card-link" href="?s=' + texto(ctx.id.toLowerCase()) + '&amp;t=' + encodeURIComponent(id) + '" data-abrir="' + texto(id) + '">' +
          '<div class="top"><span class="id">' + texto(id) + '</span>' + (t.ENTREGA_CORTA ? '<span class="u-chip" title="Entrega">' + texto(t.ENTREGA_CORTA) + '</span>' : '') +
          (t.URGENTE ? '<span class="u-chip">Urgente</span>' : '') + '</div>' +
          '<div class="t">' + texto(t.TITULO) + '</div>' +
          (m.length ? '<div class="m">' + texto(m.join(' · ')) + '</div>' : '') + x.join('') + '</a></div>';
      }
      function pintarTablero() {
        var todas = tareas();
        if (!todas.length && !leido) { tab.innerHTML = '<div class="kz-centro kb-vacio" role="status"><div class="u-carga"></div><p>Cargando las tareas…</p></div>'; return; }
        if (!todas.length) { tab.innerHTML = '<p class="u-vacio kb-vacio">No ves ninguna tarea todavía. Si esperabas ver alguna, pide que te den un rol en su iniciativa.</p>'; return; }
        var lista = todas.filter(pasa);
        tab.innerHTML = VISTAS[F.vista].cols.map(function (c) {
          var ts = ordenar(lista.filter(function (t) { return c.estados.indexOf(t.ESTADO) >= 0; }), CERRADOS.indexOf(c.id) >= 0);
          var pl = !!PL[c.id] && !F.busca;
          return '<section class="col' + (pl ? ' plegada' : '') + '" data-est="' + texto(c.id) + '">' +
            '<h2 class="' + cls(c.estados[0], c) + ' ch" role="button" tabindex="0" aria-expanded="' + (pl ? 'false' : 'true') + '" data-plegar="' + texto(c.id) + '">' + texto(c.titulo) +
            '<span class="n">' + ts.length + '</span><span class="fl"></span></h2>' +
            '<div class="lista">' + (ts.length ? ts.map(function (t) { return tarjeta(t, c); }).join('') : '<div class="vacio">Ninguna tarea con estos filtros.</div>') + '</div></section>';
        }).join('');
      }

      function plegar(c) { if (PL[c]) delete PL[c]; else PL[c] = 1; guardarLocal(CLAVE + '_pl', PL); pintarTablero(); }
      tab.addEventListener('click', function (e) {
        var h = e.target.closest('[data-plegar]');
        if (h) { plegar(h.getAttribute('data-plegar')); return; }
        var a = e.target.closest('[data-abrir]');
        if (a && !(e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); abrirFicha(a.getAttribute('data-abrir')); }
      });
      tab.addEventListener('keydown', function (e) {
        var h = e.target.closest('[data-plegar]');
        if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); plegar(h.getAttribute('data-plegar')); }
      });

      /* ---------- ficha ---------- */

      function abrirFicha(id, sinUrl) {
        if (!tarea(id)) return;
        abiertaId = id;
        pintarFicha();
        fv.classList.add('abierto');
        document.documentElement.classList.add('fv-abierta');
        if (!sinUrl) urlFicha(id);
        var b = caja.querySelector('.volver'); if (b) b.focus();
        // La bitácora de esta tarea, solo la suya (tiene miles de líneas entre todas).
        ctx.tablas.leer([TB], { partes: { BITACORA: { clave: 'T:' + id, col: 'TAREA', valores: [id] } } }).then(function () {
          if (ctx.abierta() && abiertaId === id) pintarFicha();
        }, function (e) { if (ctx.abierta() && abiertaId === id) ctx.aviso('No se ha podido leer la bitácora: ' + String(e.message).replace(/^\w+:\s*/, '')); });
      }
      function cerrarFicha() {
        if (!abiertaId) return;
        abiertaId = '';
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
      fv.addEventListener('click', function (e) {
        if (e.target === fv || e.target.closest('[data-cerrar]')) { cerrarFicha(); return; }
        var r = e.target.closest('[data-rel]');
        if (r && !(e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); if (tarea(r.getAttribute('data-rel'))) abrirFicha(r.getAttribute('data-rel')); }
      });
      fv.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarFicha(); });

      function bloque(tit, ls) {
        if (!ls.length) return '';
        var html = '', enLista = false;
        ls.forEach(function (l) {
          if (/^\s*-\s+/.test(l)) { if (!enLista) { html += '<ul>'; enLista = true; } html += '<li>' + texto(l.replace(/^\s*-\s+/, '')) + '</li>'; }
          else { if (enLista) { html += '</ul>'; enLista = false; } html += '<p>' + texto(l) + '</p>'; }
        });
        if (enLista) html += '</ul>';
        return '<div class="bloque"><h3>' + texto(tit) + '</h3>' + html + '</div>';
      }
      function rel(id) {
        var x = tarea(id), st = x ? x.ESTADO : 'No la ves';
        return '<a class="frel" href="?s=' + texto(ctx.id.toLowerCase()) + '&amp;t=' + encodeURIComponent(id) + '" data-rel="' + texto(id) + '">' +
          '<span class="fpill ' + cls(st) + '">' + texto(st) + '</span><span class="frid">' + texto(id) + '</span><span class="frtit">' + texto(x ? x.TITULO : '') + '</span></a>';
      }
      function fechaCaja(lab, val, pista, c) {
        return '<div class="ffecha ' + (c || '') + '"><small>' + texto(lab) + '</small><strong>' + texto(val || '—') + '</strong>' + (pista ? '<span class="fpista">' + texto(pista) + '</span>' : '') + '</div>';
      }
      function quien(b) { return b.QUIEN || nombre(b.PERSONA) || (b.EMPLEADO ? b.EMPLEADO : 'Sistema'); }

      function pintarFicha() {
        var t = tarea(abiertaId);
        if (!t) { cerrarFicha(); return; }
        var id = String(t.ID), cerrada = CERRADOS.indexOf(t.ESTADO) >= 0, e = entrega(t.ENTREGA);
        var fs = [];
        var n = dias(t.DEADLINE), p = '', c = '';
        if (!t.DEADLINE) { p = 'sin fecha límite'; c = 'nada'; }
        else if (cerrada) c = 'ok';
        else if (n < 0) { p = 'vencida hace ' + (-n) + (n === -1 ? ' día' : ' días'); c = 'venc'; }
        else if (n === 0) { p = 'vence hoy'; c = 'venc'; }
        else if (n === 1) { p = 'vence mañana'; c = 'pronto'; }
        else { p = 'faltan ' + n + ' días'; c = n <= 3 ? 'pronto' : ''; }
        fs.push(fechaCaja(ETIQUETA.DEADLINE, fechaEs(t.DEADLINE), p, c));
        if (t.DISPONIBLE_DESDE) fs.push(fechaCaja(ETIQUETA.DISPONIBLE_DESDE, fechaEs(t.DISPONIBLE_DESDE), '', dias(t.DISPONIBLE_DESDE) > 0 ? 'pronto' : 'ok'));
        if (t.REVISAR_EL) fs.push(fechaCaja(ETIQUETA.REVISAR_EL, fechaEs(t.REVISAR_EL), '', 'pronto'));
        if (cerrada && t.FECHA_CIERRE) fs.push(fechaCaja(ETIQUETA.FECHA_CIERRE, fechaEs(t.FECHA_CIERRE), '', 'ok'));
        var deps = esperaA(id), bloquea = laEsperan(id);
        var docs = lineas(t.DOCUMENTOS_RELEVANTES).map(function (l) {
          var m = /(https?:\/\/\S+)/.exec(l);
          if (!m) return '<p>' + texto(l) + '</p>';
          var nom = l.slice(0, m.index).replace(/[:\s]+$/, '') || m[1];
          return '<p><a href="' + texto(m[1]) + '" target="_blank" rel="noopener">' + texto(nom) + '</a></p>';
        });
        var bit = ctx.tablas.filas(TB).filter(function (b) { return b.TAREA === id; }).sort(function (a, b) {
          return String(b.CUANDO || '').localeCompare(String(a.CUANDO || '')) || String(b.ID).localeCompare(String(a.ID));
        }).map(function (b) {
          return '<p class="hito"><span class="hito-cuando">' + texto(fechaEs(b.CUANDO) + ' · ' + quien(b)) + '</span> ' + texto(b.TEXTO) + '</p>';
        });
        var tags = [];
        tags.push('<span class="ftag" title="Iniciativa">' + texto(iniciativa(t.INICIATIVA)) + '</span>');
        if (t.ENTREGA) tags.push('<span class="ftag" title="Entrega">' + texto((t.ENTREGA_CORTA || t.ENTREGA) + (e && e.NOMBRE ? ' · ' + e.NOMBRE : '')) + '</span>');
        if (t.EPICA) tags.push('<span class="ftag" title="Épica">' + texto(t.EPICA) + '</span>');
        if (t.P) tags.push('<span class="ftag p' + String(t.P).length + '" title="Prioridad">Prioridad ' + texto(t.P) + '</span>');
        if (t.T) tags.push('<span class="ftag" title="Tamaño">Tamaño ' + texto(t.T) + '</span>');
        var manos = enManos(t);
        var estado = '<div class="est ' + cls(t.ESTADO) + '"><span class="fpill">' + texto(t.ESTADO) + '</span>' +
          (manos ? '<span class="msg">' + texto(t.EN_MANOS_TIPO === 'espera' ? manos : 'En manos de ' + manos) + '</span>' : '') + '</div>';
        var personas = [['ASIGNADO', t.ASIGNADO], ['PIDE', t.PIDE], ['REVISA', t.REVISA]].filter(function (x) { return x[1]; })
          .map(function (x) { return '<p><b>' + texto(ETIQUETA[x[0]]) + ':</b> ' + texto(nombre(x[1])) + '</p>'; });
        if (t.EMPLEADO) personas.push('<p><b>' + ETIQUETA.EMPLEADO + ':</b> ' + texto(t.EMPLEADO) + '</p>');
        var motivo = [];
        if (t.PREGUNTA) motivo.push('<p><b>Pregunta:</b> ' + texto(t.PREGUNTA) + '</p>');
        if (t.MOTIVO_BLOQUEO) motivo.push('<p><b>Bloqueada:</b> ' + texto(t.MOTIVO_BLOQUEO) + '</p>');
        if (t.MOTIVO) motivo.push('<p><b>Motivo:</b> ' + texto(t.MOTIVO) + '</p>');
        caja.innerHTML =
          '<div class="barra"><button type="button" class="volver" data-cerrar>' + ICO_VOLVER + 'Volver al tablero</button></div>' +
          '<div class="cab"><div class="id"><span class="n">' + texto(id) + '</span></div><h1 id="kb-f-tit">' + texto(t.TITULO) + '</h1></div>' +
          '<div class="fmeta">' + tags.join('') + '</div>' + estado +
          (motivo.length ? '<div class="bloque">' + motivo.join('') + '</div>' : '') +
          '<div class="ffechas">' + fs.join('') + '</div>' +
          bloque(ETIQUETA.DESCRIPCION, lineas(t.DESCRIPCION)) +
          (personas.length ? '<div class="bloque"><h3>Personas</h3>' + personas.join('') + '</div>' : '') +
          (deps.length ? '<div class="bloque"><h3>Espera a</h3>' + deps.map(rel).join('') + '</div>' : '') +
          (bloquea.length ? '<div class="bloque"><h3>La esperan</h3>' + bloquea.map(rel).join('') + '</div>' : '') +
          (docs.length ? '<div class="bloque"><h3>' + ETIQUETA.DOCUMENTOS_RELEVANTES + '</h3>' + docs.join('') + '</div>' : '') +
          bloque(ETIQUETA.CONCLUSIONES, lineas(t.CONCLUSIONES)) +
          '<div class="bloque"><h3>Bitácora</h3>' + (bit.length ? bit.join('') : '<p class="u-nota">' + (ctx.tablas.tiene && ctx.tablas.tiene(TB, { clave: 'T:' + id }) ? 'Todavía no hay nada apuntado.' : 'Cargando…') + '</p>') + '</div>';
      }

      /* ---------- arranque ---------- */

      /** Los nombres de las personas (en la base, cada una es su id). */
      function gente() {
        return ctx.llamar('personas_gestion', [{}]).then(function (r) {
          var g = {};
          (r || []).forEach(function (p) { g[p.id] = p.nombre; });
          var cambia = JSON.stringify(g) !== JSON.stringify(GENTE);
          GENTE = g; guardarLocal(CLAVE + '_gente', g);
          if (cambia && ctx.abierta()) { pintarFiltros(); pintarTablero(); if (abiertaId) pintarFicha(); }
        });
      }
      ctx.alCambiar(function (t) {
        if ([T, TI, TE, TD].indexOf(t) >= 0) { pintarTablero(); if (t !== T && t !== TD) pintarFiltros(); }
        if (abiertaId && [T, TE, TD, TB].indexOf(t) >= 0) pintarFicha();
      });
      abrirFiltros(!!F._ab);
      pintarFiltros(); pintarTablero();
      ctx.tablas.leer([T, TI, TE, TD]).then(function () {
        leido = true;
        if (!ctx.abierta()) return;
        pintarFiltros(); pintarTablero();
        var pedida = new URLSearchParams(location.search).get('t');
        if (pedida && tarea(pedida)) abrirFicha(pedida, true);
      }, function (e) {
        leido = true;
        tab.innerHTML = '<p class="u-error kb-vacio">No se han podido leer las tareas.</p><p class="u-nota kb-vacio">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Pulsa ↻ o vuelve a abrir la sección.</p>';
      });
      gente().catch(function () {});
      this._cerrar = function () { el.classList.remove('kb'); document.documentElement.classList.remove('fv-abierta'); urlFicha(''); };
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); }
  });
})();
