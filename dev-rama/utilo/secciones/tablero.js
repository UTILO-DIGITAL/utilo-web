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
 * - En directo: con Supabase, lo que cambie otra persona (o el agente) sale solo en un segundo (Realtime); ↻ sigue para forzarlo.
 * - Ordenar a mano: arrastrada dentro de su columna, la tarjeta se queda donde se suelta (el mismo orden para todos; las que no
 *   se han tocado, debajo, con el de siempre). Al cambiar de estado, vuelve al de siempre. Las cerradas, por fecha.
 * - Filtros: iniciativa, entrega, persona (en manos de, asignada, pide o revisa), épica y prioridad; y buscar.
 * - Las personas son su id en la base: el nombre sale de personas_gestion().
 * - Se pinta al momento con lo guardado en el dispositivo y se refresca por detrás.
 * - Mover (arrastrando en el ordenador, con el desplegable en el móvil o desde la ficha): solo a los estados a los que se
 *   puede pasar, y pide lo que exige cada uno (Bloqueada, el motivo; Necesita tu respuesta, la pregunta; Aplazada, la fecha;
 *   Descartada y rechazar, el motivo). La tarjeta cambia al momento y lo escribe mover_tarea(); si la base dice que no, vuelve.
 * - En el móvil, mantener pulsada una tarjeta la coge para llevarla con el dedo a otra columna o a otro sitio de la suya.
 * - Ficha: cada dato (título, etiquetas, fechas, personas, «espera a», textos) se cambia pulsándolo; lo que no tiene valor, con
 *   «Añadir». «Editar tarea» sigue para cambiar varios a la vez.
 * - Crear y editar escriben TAREAS (y sus DEPENDENCIAS) con la capa de tablas; la tarjeta sale al momento con «Guardando».
 *   Una nota va a la bitácora con anotar(). Después se trae el tablero (en manos de, lo que la base mueve sola).
 * - T0387 · Una tarea en Necesita tu respuesta se responde en su ficha (responder() de la base, como en Para mí): quien la
 *   pidió o quien lleva la iniciativa. Lo escrito se guarda aunque la ficha se repinte.
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
  /** A qué estados se puede pasar desde cada uno (los de gestion.pasos() de la base, que es la que manda). */
  var PASOS = {
    'Esperando': ['En cola', 'Aplazada', 'Descartada'],
    'En cola': ['En curso', 'Esperando', 'Aplazada', 'Descartada'],
    'En curso': ['Para revisar', 'Necesita tu respuesta', 'Bloqueada', 'En cola', 'Aplazada', 'Descartada'],
    'Necesita tu respuesta': ['En cola', 'Aplazada', 'Descartada'],
    'Bloqueada': ['En cola', 'Aplazada', 'Descartada'],
    'Para revisar': ['Aprobada', 'En curso', 'Descartada'],
    'Aprobada': ['Entregada'],
    'Aplazada': ['En cola', 'Esperando', 'Descartada']
  };
  /** Qué abarca cada estado: sale al pasar el ratón por la cabecera de su columna. */
  var QUE_ES = {
    'Esperando': 'Espera a otra tarea de la que depende: todavía no se puede empezar.',
    'En cola': 'No espera nada: lista para empezar cuando alguien la coja.',
    'En curso': 'Alguien está trabajando en ella ahora.',
    'Necesita tu respuesta': 'Parada hasta que quien la pidió conteste una pregunta concreta.',
    'Bloqueada': 'Parada por algo de fuera: material del cliente, un acceso, un problema técnico o un tercero.',
    'Para revisar': 'Hecha: falta que quien la revisa la mire.',
    'Aprobada': 'Revisada y bien: falta publicarla o entregarla.',
    'Entregada': 'Hecha y funcionando. Se cierra con su fecha.',
    'Aplazada': 'Se deja para más adelante: se vuelve a mirar en la fecha que diga.',
    'Descartada': 'No se va a hacer.'
  };
  /** El texto de la cabecera de una columna: el de su estado o, si junta varios, el de cada uno. */
  function queEs(c) {
    return c.estados.length === 1 ? QUE_ES[c.estados[0]] || '' : c.estados.map(function (e) { return e + ': ' + (QUE_ES[e] || ''); }).join('\n');
  }
  var MOTIVOS_BLOQUEO = ['Falta material del cliente', 'Falta un acceso', 'Problema técnico', 'Un tercero'];
  var HERRAMIENTAS = ['Chat', 'Cowork', 'Claude Code'];
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
    MOTIVO_BLOQUEO: 'Motivo del bloqueo', HERRAMIENTA: 'Herramienta', EMPLEADO: 'Empleado IA', TITULO: 'Título', DEPENDE: 'Espera a' };
  var OBLIGA = { TITULO: 'Título', DESCRIPCION: 'Qué hay que hacer', INICIATIVA: 'Iniciativa', ASIGNADO: 'Asignada a' };
  /** T0386: lo que se guarda al cambiar el dato k de la tarea t desde la ficha: { cambios, antes }, { mal } si no vale, o null si no
   *  cambia nada. entregasDe(ini) da los id de las entregas de una iniciativa: al cambiar de iniciativa, la entrega que no es suya se quita. */
  function cambioDe(t, k, v, entregasDe) {
    v = typeof v === 'boolean' ? v : String(v == null ? '' : v).trim();
    if (k === 'TITULO') v = v.replace(/\.+$/, '');
    if (OBLIGA[k] && !v) return { mal: OBLIGA[k] + ': falta.' };
    if (k === 'TITULO' && v.length > 60) return { mal: 'Título: pasa de 60 caracteres.' };
    var cambios = {}, antes = {};
    var pon = function (c, x) { var a = t[c] == null ? '' : t[c]; if (typeof x === 'boolean' ? !!a !== x : String(a) !== x) { cambios[c] = x; antes[c] = a; } };
    pon(k, v);
    if (k === 'INICIATIVA' && 'INICIATIVA' in cambios && t.ENTREGA && (entregasDe ? entregasDe(v) : []).indexOf(t.ENTREGA) < 0) pon('ENTREGA', '');
    return Object.keys(cambios).length ? { cambios: cambios, antes: antes } : null;
  }

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
  function hoyISO() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function lineas(s) { return String(s || '').split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).filter(function (l) { return l.trim(); }); }

  /** La hoja del tablero, una vez por página. Mientras llega, la sección no se ve (sin ella se pintaría sin estilos un momento). */
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
    setTimeout(ver, 3000); // si tarda mucho, mejor sin estilos que en blanco
  }

  window.UN.registrar('TABLERO', {
    abrir: function (el, ctx) {
      estilos(el);
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
      var abiertaId = '', leido = false, editando = false, cambiando = ''; // cambiando: el dato de la ficha que se está cambiando
      var TACTIL = window.matchMedia && matchMedia('(hover: none)').matches;
      // Solo lee: lector en todo (las reglas de la base lo dicen igual; aquí, para no ofrecer lo que no puede).
      var SOLO_LEE = !ctx.admin && /^Lector/.test(ctx.perfil || '');
      var ORDENA = !SOLO_LEE; // T0386: ordenar a mano en su columna (la base dice quién puede: ordenar_tareas)

      el.classList.add('kb', 'tb'); // tb: lo propio de la plataforma en estilos/kanban.css
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
        (SOLO_LEE ? '' : '<button id="alta-btn" type="button">Añadir tarea</button>') +
        '<div class="fv-velo" id="kb-fv"><div class="fv-caja kb-ficha" role="dialog" aria-modal="true" aria-labelledby="kb-f-tit" id="kb-ficha"></div></div>' +
        '<div id="alta-velo"><form id="alta-form" novalidate></form></div>';
      var $ = function (id) { return el.querySelector('#' + id); };
      var tab = $('kb-tab'), fv = $('kb-fv'), caja = $('kb-ficha'), altaVelo = $('alta-velo'), altaForm = $('alta-form');

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
          // Con una iniciativa elegida, solo sus entregas.
          var usadas = {}; tareas().forEach(function (t) { if (t.ENTREGA && (!F.INICIATIVA || t.INICIATIVA === F.INICIATIVA)) usadas[t.ENTREGA] = t.ENTREGA_CORTA || t.ENTREGA; });
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
        // Otra iniciativa: la entrega elegida puede no ser suya; y el desplegable de entregas cambia.
        if (s && s.getAttribute('data-f') === 'INICIATIVA') {
          var en = F.ENTREGA && F.ENTREGA !== '-' ? ctx.tablas.fila(TE, F.ENTREGA) : null;
          if (en && F.INICIATIVA && en.INICIATIVA !== F.INICIATIVA) F.ENTREGA = '';
          guardarLocal(CLAVE + '_f', F); pintarFiltros(); pintarTablero(); return;
        }
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
        // T0386: las ordenadas a mano (ORDEN), antes y en su orden; las demás, debajo, con el de siempre.
        var om = function (t) { var o = ordenDe(t); return o === null ? Infinity : o; };
        return ts.sort(function (a, b) {
          return (om(a) - om(b) || 0) || (ur(b) - ur(a)) || (ur(a) ? dl(a) - dl(b) : 0) || (pn(b) - pn(a)) || (dl(a) - dl(b)) || String(a.ID).localeCompare(String(b.ID));
        });
      }
      /** El orden a mano de una tarea (null si no tiene): el que se acaba de poner aquí, hasta que llega el de la base. */
      var ORDEN_AQUI = {};
      function ordenDe(t) {
        var o = Object.prototype.hasOwnProperty.call(ORDEN_AQUI, t.ID) ? ORDEN_AQUI[t.ID] : t.ORDEN;
        return o === null || o === undefined || o === '' || isNaN(Number(o)) ? null : Number(o);
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
        if (t._nueva) id = '';
        var pasos = PASOS[t.ESTADO] || [], puede = id && !SOLO_LEE && !t._pendiente && pasos.length;
        var mover = TACTIL && puede ? '<div class="mover"><span>Estado</span><select data-mover="' + texto(id) + '" aria-label="Estado de ' + texto(id) + '">' +
          [t.ESTADO].concat(pasos).map(function (e) { return '<option' + (e === t.ESTADO ? ' selected' : '') + '>' + texto(e) + '</option>'; }).join('') + '</select></div>' : '';
        return '<div class="card ' + cls(t.ESTADO) + '-b' + (t._pendiente ? ' guardando' : '') + '"' + (puede && !TACTIL ? ' draggable="true"' : '') + ' data-id="' + texto(id) + '">' +
          '<a class="card-link" href="?s=' + texto(ctx.id.toLowerCase()) + '&amp;t=' + encodeURIComponent(id) + '" data-abrir="' + texto(id) + '">' +
          '<div class="top"><span class="id">' + (id ? texto(id) : 'Creando…') + '</span>' + (t.ENTREGA_CORTA ? '<span class="u-chip" title="Entrega">' + texto(t.ENTREGA_CORTA) + '</span>' : '') +
          (t.URGENTE ? '<span class="u-chip">Urgente</span>' : '') + (t._pendiente ? '<span class="u-chip">Guardando</span>' : '') + '</div>' +
          '<div class="t">' + texto(t.TITULO) + '</div>' +
          (m.length ? '<div class="m">' + texto(m.join(' · ')) + '</div>' : '') + x.join('') + '</a>' + mover + '</div>';
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
            '<h2 class="' + cls(c.estados[0], c) + ' ch" title="' + texto(queEs(c)) + '" role="button" tabindex="0" aria-expanded="' + (pl ? 'false' : 'true') + '" data-plegar="' + texto(c.id) + '">' + texto(c.titulo) +
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
      tab.addEventListener('change', function (e) {
        var s = e.target.closest('[data-mover]');
        if (s) mover(s.getAttribute('data-mover'), s.value);
      });
      // Arrastrar en el ordenador: la tarjeta a otra columna (en una columna con dos estados, al primero al que puede pasar)
      // o dentro de la suya, para ordenarla. En el móvil, lo mismo manteniéndola pulsada (abajo).
      var arr = '';
      /** Coge la tarjeta id: las columnas a las que puede pasar se marcan enteras, de arriba abajo; las demás se apagan. */
      function marcar(id) {
        arr = id;
        var t = tarea(id), pasos = (t && PASOS[t.ESTADO]) || [];
        tab.classList.add('kb-arrastre');
        [].forEach.call(tab.querySelectorAll('.col'), function (x) {
          var col = columna(x.getAttribute('data-est'));
          var suya = col && t && col.estados.indexOf(t.ESTADO) >= 0, puede = col && !suya && col.estados.some(function (e) { return pasos.indexOf(e) >= 0; });
          x.classList.add(suya ? 'kb-suya' : puede ? 'kb-puede' : 'kb-no');
          if (suya && ORDENA && CERRADOS.indexOf(col.estados[0]) < 0) x.classList.add('kb-ordena');
        });
      }
      function desmarcar() {
        arr = ''; tab.classList.remove('kb-arrastre'); hueco(null);
        [].forEach.call(tab.querySelectorAll('.arrastrando,.kb-cogida,.destino,.kb-suya,.kb-puede,.kb-no,.kb-ordena'), function (x) {
          x.classList.remove('arrastrando', 'kb-cogida', 'destino', 'kb-suya', 'kb-puede', 'kb-no', 'kb-ordena'); });
      }
      /** Dónde caería la tarjeta cogida si se suelta sobre elem a la altura y, y lo marca: { o: su columna, antes } para ordenarla,
       *  { c: columna } para pasarla a otro estado, o null si ahí no se puede. */
      function apuntar(elem, y) {
        var o = arr && elem && elem.closest && elem.closest('.col.kb-ordena');
        var c = !o && arr && elem && elem.closest && elem.closest('.col.kb-puede');
        [].forEach.call(tab.querySelectorAll('.destino'), function (x) { if (x !== c) x.classList.remove('destino'); });
        if (o) { var ab = debajo(o, y); hueco(o, ab); return { o: o, antes: ab }; }
        hueco(null);
        if (c) { c.classList.add('destino'); return { c: c }; }
        return null;
      }
      function soltar(id, d) {
        if (!d) return;
        if (d.o) { colocar(id, columna(d.o.getAttribute('data-est')), d.antes ? d.antes.getAttribute('data-id') : null); return; }
        var t = tarea(id), col = columna(d.c.getAttribute('data-est'));
        if (!t || !col || col.estados.indexOf(t.ESTADO) >= 0) return;
        var a = col.estados.filter(function (x) { return (PASOS[t.ESTADO] || []).indexOf(x) >= 0; })[0];
        mover(id, a || col.estados[0]);
      }
      tab.addEventListener('dragstart', function (e) {
        var c = e.target.closest && e.target.closest('.card[draggable]');
        if (!c) return;
        marcar(c.getAttribute('data-id')); c.classList.add('arrastrando');
        try { e.dataTransfer.setData('text/plain', arr); e.dataTransfer.effectAllowed = 'move'; } catch (x) {}
      });
      tab.addEventListener('dragend', desmarcar);
      function columna(id) { return VISTAS[F.vista].cols.filter(function (x) { return x.id === id; })[0]; }
      /** Dónde caería al soltarla en su columna: la tarjeta de debajo (null, al final). Se marca con una raya. */
      function debajo(c, y) {
        var cs = [].filter.call(c.querySelectorAll('.card[data-id]'), function (x) { return x.getAttribute('data-id') !== arr; });
        for (var i = 0; i < cs.length; i++) { var r = cs[i].getBoundingClientRect(); if (y < r.top + r.height / 2) return cs[i]; }
        return null;
      }
      function hueco(c, antes) {
        [].forEach.call(tab.querySelectorAll('.kb-antes,.kb-al-final'), function (x) { x.classList.remove('kb-antes', 'kb-al-final'); });
        if (!c) return;
        if (antes) antes.classList.add('kb-antes'); else c.querySelector('.lista').classList.add('kb-al-final');
      }
      tab.addEventListener('dragover', function (e) { if (arr && apuntar(e.target, e.clientY)) e.preventDefault(); });
      tab.addEventListener('drop', function (e) {
        var d = arr && apuntar(e.target, e.clientY);
        if (!d) return;
        e.preventDefault();
        var id = arr; desmarcar();
        soltar(id, d);
      });

      // T0386: en el móvil (el navegador no arrastra con el dedo), mantener pulsada una tarjeta medio segundo la coge: con el dedo
      // se lleva dentro de su columna, para ordenarla, o a otra a la que pueda pasar, como en el ordenador. Cerca del borde de
      // arriba o de abajo, la página se desplaza sola. Si el dedo se mueve antes de cogerla, es desplazarse, como siempre.
      var toque = null;
      function desplazable(x) {
        for (; x && x !== document.documentElement; x = x.parentElement) { // en el móvil, el body
          var o = getComputedStyle(x).overflowY;
          if ((o === 'auto' || o === 'scroll') && x.scrollHeight > x.clientHeight) return x;
        }
        return document.scrollingElement || document.documentElement;
      }
      function rodar() {
        if (!toque || !toque.cogida) return;
        var h = window.innerHeight, v = toque.y < 80 ? -(80 - toque.y) / 4 : toque.y > h - 80 ? (toque.y - (h - 80)) / 4 : 0;
        if (v) { toque.rueda.scrollTop += v; apuntar(document.elementFromPoint(toque.x, toque.y), toque.y); }
        toque.raf = requestAnimationFrame(rodar);
      }
      function coger() {
        if (!toque) return;
        toque.cogida = true;
        marcar(toque.id);
        toque.card.classList.add('arrastrando', 'kb-cogida');
        try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
        toque.rueda = desplazable(tab);
        toque.raf = requestAnimationFrame(rodar);
      }
      function soltarToque(e) {
        if (!toque) return;
        var tq = toque; toque = null;
        clearTimeout(tq.tm); if (tq.raf) cancelAnimationFrame(tq.raf);
        if (!tq.cogida) return;
        if (e.cancelable) e.preventDefault(); // que al soltarla no se abra la ficha
        var d = e.type === 'touchend' ? apuntar(document.elementFromPoint(tq.x, tq.y), tq.y) : null, id = arr;
        desmarcar();
        soltar(id, d);
      }
      if (TACTIL && !SOLO_LEE) {
        tab.addEventListener('touchstart', function (e) {
          var c = e.target.closest && e.target.closest('.card[data-id]');
          if (!c || e.touches.length !== 1 || e.target.closest('select')) return;
          var id = c.getAttribute('data-id'), t = id && tarea(id);
          if (!t || t._pendiente || !(PASOS[t.ESTADO] || []).length) return;
          var p = e.touches[0];
          toque = { id: id, card: c, x: p.clientX, y: p.clientY, x0: p.clientX, y0: p.clientY, cogida: false };
          toque.tm = setTimeout(coger, 450);
        }, { passive: true });
        tab.addEventListener('touchmove', function (e) {
          if (!toque) return;
          var p = e.touches[0];
          if (!toque.cogida) { if (Math.abs(p.clientX - toque.x0) > 8 || Math.abs(p.clientY - toque.y0) > 8) { clearTimeout(toque.tm); toque = null; } return; }
          e.preventDefault();
          toque.x = p.clientX; toque.y = p.clientY;
          apuntar(document.elementFromPoint(p.clientX, p.clientY), p.clientY);
        }, { passive: false });
        tab.addEventListener('touchend', soltarToque);
        tab.addEventListener('touchcancel', soltarToque);
        tab.addEventListener('contextmenu', function (e) { if (toque) e.preventDefault(); }); // el menú de mantener pulsado un enlace
      }

      /* ---------- ordenar a mano en su columna (al momento en la pantalla; ordenar_tareas, por detrás) ---------- */

      /** Pone la tarea id justo encima de la tarea «antes» de su columna (null: al final de las que se ven). Numera de arriba abajo
       *  las que hace falta (hasta ella y las ya ordenadas a mano), contando también las que ocultan los filtros; las de debajo, como siempre. */
      function colocar(id, col, antes) {
        var t = tarea(id);
        if (!t || !col || id === antes) return;
        var todas = ordenar(tareas().filter(function (x) { return col.estados.indexOf(x.ESTADO) >= 0 && String(x.ID) !== id; }), false);
        var vistas = todas.filter(pasa), i;
        if (antes) i = todas.map(function (x) { return String(x.ID); }).indexOf(antes);
        else i = vistas.length ? todas.indexOf(vistas[vistas.length - 1]) + 1 : 0;
        if (i < 0) return;
        todas.splice(i, 0, t);
        var hasta = i;
        todas.forEach(function (x, k) { if (ordenDe(x) !== null) hasta = Math.max(hasta, k); });
        var cambios = [];
        for (var k = 0; k <= hasta; k++) {
          if (ordenDe(todas[k]) !== k + 1) cambios.push({ tarea: String(todas[k].ID), orden: k + 1 });
        }
        if (!cambios.length) return;
        cambios.forEach(function (c) { ORDEN_AQUI[c.tarea] = c.orden; });
        pintarTablero();
        ctx.llamar('ordenar_tareas', [{ orden: cambios }]).then(function () {
          return ctx.tablas.refrescar([T], true);
        }, function (e) {
          if (ctx.abierta()) ctx.aviso('No se ha podido guardar el orden: ' + String(e.message).replace(/^\w+:\s*/, ''));
          return ctx.tablas.refrescar([T], true);
        }).catch(function () {}).then(function () {
          cambios.forEach(function (c) { if (ORDEN_AQUI[c.tarea] === c.orden) delete ORDEN_AQUI[c.tarea]; });
          if (ctx.abierta()) pintarTablero();
        });
      }

      /* ---------- mover (al momento en la pantalla; mover_tarea, por detrás) ---------- */

      /** Lo que pide la base para pasar a ese estado: '' si nada. */
      function pide(de, a) {
        return a === 'Bloqueada' ? 'bloqueo' : a === 'Necesita tu respuesta' ? 'pregunta' : a === 'Aplazada' ? 'aplazar' : a === 'Descartada' ? 'descartar' :
          de === 'Para revisar' && a === 'En curso' ? 'rechazar' : '';
      }
      function mover(id, nuevo) {
        var t = tarea(id);
        if (!t || t.ESTADO === nuevo) return;
        if ((PASOS[t.ESTADO] || []).indexOf(nuevo) < 0) {
          ctx.aviso(CERRADOS.indexOf(t.ESTADO) >= 0 ? id + ' está ' + t.ESTADO.toLowerCase() + ': no se reabre. Si hace falta más, crea otra que espere a esta.' :
            'De ' + t.ESTADO + ' no se pasa a ' + nuevo + (PASOS[t.ESTADO] ? ': puede ir a ' + PASOS[t.ESTADO].join(', ') + '.' : '.'));
          pintarTablero(); if (abiertaId) pintarFicha(); return;
        }
        var q = pide(t.ESTADO, nuevo);
        if (q) { pedirDatos(t, nuevo, q); pintarTablero(); if (abiertaId) pintarFicha(); return; }
        enviar(t, nuevo, {});
      }
      function enviar(t, nuevo, x) {
        var id = String(t.ID), args = { tarea: id, estado: nuevo }, local = { ESTADO: nuevo };
        ['motivo', 'motivo_bloqueo', 'pregunta', 'revisar_el'].forEach(function (k) { if (x[k]) { args[k] = x[k]; local[k.toUpperCase()] = x[k]; } });
        ctx.tablas.actualizar(T, id, local, { fn: 'mover_tarea', args: [args] }).then(function (r) {
          if (ctx.abierta() && typeof r === 'string' && r !== nuevo) ctx.aviso(id + ' ha pasado a ' + r + (r === 'Entregada' ? ': no había nada que publicar.' : '.'));
          return alDia(id);
        }, function () {});
      }
      /** Tras escribir: el tablero (en manos de, lo que la base mueve sola) y, si está abierta, la bitácora de esa tarea. */
      function alDia(id) {
        var ps = [ctx.tablas.refrescar([T, TD], true)];
        if (id && abiertaId === id) ps.push(bitacora(id, true));
        return Promise.all(ps).catch(function () {});
      }

      /** La ventanita con lo que pide el estado: motivo del bloqueo, pregunta, fecha, motivo. */
      function pedirDatos(t, nuevo, q) {
        var id = String(t.ID), h = '';
        var tit = { bloqueo: 'Bloquear ' + id, pregunta: 'Preguntar a quien la pidió', aplazar: 'Aplazar ' + id, descartar: 'Descartar ' + id, rechazar: 'Rechazar ' + id }[q];
        var ayuda = { bloqueo: 'Pasa a Bloqueada: la mueve alguien de fuera o algo técnico.', pregunta: 'Pasa a Necesita tu respuesta, en manos de ' + (nombre(t.PIDE) || 'quien la pidió') + '.',
          aplazar: 'Nadie la mueve hasta esa fecha; entonces se decide.', descartar: 'Se cierra y no se reabre. Las que la esperan dejan de esperarla.',
          rechazar: 'Vuelve a En curso con lo que hay que cambiar.' }[q];
        if (q === 'bloqueo') h = '<div class="campo"><label class="lab" for="tb-d-mb">Por qué</label><select id="tb-d-mb" required><option value="">Elige…</option>' +
          MOTIVOS_BLOQUEO.map(function (m) { return '<option>' + texto(m) + '</option>'; }).join('') + '</select></div>' +
          '<div class="campo"><label class="lab" for="tb-d-mo">Qué pasa <span class="opc">(opcional)</span></label><textarea id="tb-d-mo" rows="2"></textarea></div>';
        if (q === 'pregunta') h = '<div class="campo"><label class="lab" for="tb-d-pr">La pregunta, concreta</label><textarea id="tb-d-pr" rows="3" required></textarea></div>';
        if (q === 'aplazar') h = '<div class="campo"><label class="lab" for="tb-d-re">Se vuelve a mirar el</label><input type="date" id="tb-d-re" min="' + hoyISO() + '" required></div>' +
          '<div class="campo"><label class="lab" for="tb-d-mo">Por qué <span class="opc">(opcional)</span></label><textarea id="tb-d-mo" rows="2"></textarea></div>';
        if (q === 'descartar' || q === 'rechazar') h = '<div class="campo"><label class="lab" for="tb-d-mo">' + (q === 'rechazar' ? 'Qué hay que cambiar' : 'Por qué se descarta') + '</label><textarea id="tb-d-mo" rows="3" required></textarea></div>';
        altaForm.innerHTML = '<h2>' + texto(tit) + '</h2><p class="u-nota">' + texto(ayuda) + '</p><div class="edit">' + h + '</div><div id="alta-error" role="alert"></div>' +
          '<div class="botones"><button type="button" class="sec" data-cancelar-alta>Cancelar</button><button type="submit" class="pri">' + texto(q === 'rechazar' ? 'Rechazar' : 'Pasar a ' + nuevo) + '</button></div>';
        abrirVelo();
        altaForm.onsubmit = function (e) {
          e.preventDefault();
          var v = function (i) { var x = altaForm.querySelector('#' + i); return x ? x.value.trim() : ''; };
          var x = { motivo_bloqueo: v('tb-d-mb'), pregunta: v('tb-d-pr'), revisar_el: v('tb-d-re'), motivo: v('tb-d-mo') };
          var mal = q === 'bloqueo' && !x.motivo_bloqueo ? 'Elige por qué está bloqueada.' : q === 'pregunta' && !x.pregunta ? 'Escribe la pregunta.' :
            q === 'aplazar' && !x.revisar_el ? 'Pon la fecha en que se vuelve a mirar.' : q === 'aplazar' && x.revisar_el < hoyISO() ? 'La fecha ya ha pasado.' :
            (q === 'descartar' || q === 'rechazar') && !x.motivo ? (q === 'rechazar' ? 'Di qué hay que cambiar.' : 'Di por qué se descarta.') : '';
          if (mal) { var er = altaForm.querySelector('#alta-error'); er.textContent = mal; er.style.display = 'block'; return; }
          cerrarVelo();
          enviar(t, nuevo, x);
        };
      }
      function abrirVelo() {
        altaVelo.classList.add('abierto');
        document.documentElement.classList.add('fv-abierta');
        var p = altaForm.querySelector('input,textarea,select'); if (p) p.focus();
      }
      function cerrarVelo() { altaVelo.classList.remove('abierto'); if (!abiertaId) document.documentElement.classList.remove('fv-abierta'); altaForm.onsubmit = null; }
      altaVelo.addEventListener('click', function (e) { if (e.target === altaVelo || e.target.closest('[data-cancelar-alta]')) cerrarVelo(); });
      altaVelo.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); cerrarVelo(); } });

      /* ---------- formulario: crear y editar ---------- */

      /** Mi id de persona (por el nombre con el que he entrado). */
      function yo() { for (var k in GENTE) if (GENTE[k] === ctx.persona) return k; return ''; }
      function opciones(vs, v, vacio) {
        return (vacio !== false ? '<option value="">' + texto(vacio || 'Elige…') + '</option>' : '') +
          vs.map(function (x) { return '<option value="' + texto(x[0]) + '"' + (x[0] === v ? ' selected' : '') + '>' + texto(x[1]) + '</option>'; }).join('');
      }
      function gentes() { return Object.keys(GENTE).map(function (k) { return [k, GENTE[k]]; }).sort(function (a, b) { return a[1].localeCompare(b[1]); }); }
      function entregasDe(ini) {
        return ctx.tablas.filas(TE).filter(function (e) { return e.INICIATIVA === ini && e.ESTADO !== 'Entregada'; })
          .map(function (e) { var i = ctx.tablas.fila(TI, ini); return [e.ID, ((i && i.INICIAL) || '') + e.NUMERO + ' · ' + (e.NOMBRE || '')]; });
      }
      function chipDep(x) {
        var t = tarea(x);
        return '<span class="chip" data-dep="' + texto(x) + '"><span>' + texto(x + (t ? ' · ' + t.TITULO : '')) + '</span><button type="button" class="quitar" aria-label="Quitar ' + texto(x) + '" data-quitar-dep="' + texto(x) + '">×</button></span>';
      }
      function campo(n, lab, h, opc, ayuda) {
        return '<div class="campo" data-cambiando="' + n + '"><label class="lab" for="tb-f-' + n + '">' + texto(lab) + (opc ? ' <span class="opc">(opcional)</span>' : '') + '</label>' + h +
          (ayuda ? '<div class="ayuda">' + ayuda + '</div>' : '') + '</div>';
      }
      /** Los campos de la tarea t (o de una nueva, con t = valores por defecto). */
      function htmlCampos(t, nueva) {
        var ini = t.INICIATIVA, epicas = [];
        tareas().forEach(function (x) { if (x.EPICA && epicas.indexOf(x.EPICA) < 0) epicas.push(x.EPICA); });
        var deps = nueva ? (t._deps || []) : esperaA(String(t.ID));
        var cand = tareas().filter(function (x) { return CERRADOS.indexOf(x.ESTADO) < 0 && !x._nueva && String(x.ID) !== String(t.ID || ''); })
          .sort(function (a, b) { return String(b.ID).localeCompare(String(a.ID)); });
        var val = function (k) { return t[k] == null ? '' : String(t[k]); };
        return campo('TITULO', 'Título', '<input type="text" id="tb-f-TITULO" value="' + texto(val('TITULO')) + '" required autocomplete="off" data-limite="60">', false,
            '<span class="contador" data-cuenta="tb-f-TITULO">' + val('TITULO').length + ' / 60</span> · Empieza por un verbo y di qué se entrega.') +
          campo('DESCRIPCION', 'Qué hay que hacer', '<textarea id="tb-f-DESCRIPCION" rows="4" required>' + texto(val('DESCRIPCION')) + '</textarea>', false, 'Tal cual lo pide quien lo pide.') +
          campo('INICIATIVA', 'Iniciativa', '<select id="tb-f-INICIATIVA" required>' + opciones(ctx.tablas.filas(TI).map(function (i) { return [i.ID, i.NOMBRE || i.ID]; }), ini) + '</select>') +
          campo('ENTREGA', 'Entrega', '<select id="tb-f-ENTREGA">' + opciones(entregasDe(ini), val('ENTREGA'), 'Sin entrega') + '</select>', true) +
          campo('EPICA', 'Épica', '<input type="text" id="tb-f-EPICA" value="' + texto(val('EPICA')) + '" list="tb-epicas" autocomplete="off"><datalist id="tb-epicas">' +
            epicas.sort().map(function (e) { return '<option value="' + texto(e) + '">'; }).join('') + '</datalist>', true) +
          campo('ASIGNADO', 'Asignada a', '<select id="tb-f-ASIGNADO" required>' + opciones(gentes(), val('ASIGNADO')) + '</select>') +
          campo('REVISA', 'La revisa', '<select id="tb-f-REVISA">' + opciones(gentes(), val('REVISA'), nueva ? 'La misma persona' : 'Elige…') + '</select>', nueva) +
          campo('P', 'Prioridad', '<select id="tb-f-P" required>' + opciones(['!!!!', '!!!', '!!', '!'].map(function (x) { return [x, x]; }), val('P'), false) + '</select>') +
          campo('T', 'Tamaño', '<select id="tb-f-T" required>' + opciones(['XS', 'S', 'M', 'L', 'XL'].map(function (x) { return [x, x]; }), val('T'), false) + '</select>') +
          campo('DEADLINE', 'Fecha límite', '<input type="date" id="tb-f-DEADLINE" value="' + texto(val('DEADLINE')) + '">', true) +
          campo('DISPONIBLE_DESDE', 'No empezar antes del', '<input type="date" id="tb-f-DISPONIBLE_DESDE" value="' + texto(val('DISPONIBLE_DESDE')) + '">', true, 'Hasta ese día espera, y luego pasa sola a la cola.') +
          campo('DEPENDE', 'Espera a', '<div class="deps" data-deps="' + texto(deps.join(',')) + '">' + deps.map(chipDep).join('') + '</div>' +
            '<select id="tb-f-DEPENDE" data-anadir-dep><option value="">Añadir una tarea…</option>' + cand.map(function (x) { return '<option value="' + texto(x.ID) + '">' + texto(x.ID + ' · ' + x.TITULO) + '</option>'; }).join('') + '</select>', true,
            'Mientras alguna no esté entregada o descartada, esta espera.') +
          campo('HERRAMIENTA', 'Herramienta', '<select id="tb-f-HERRAMIENTA">' + opciones(HERRAMIENTAS.map(function (x) { return [x, x]; }), val('HERRAMIENTA'), 'Sin decidir') + '</select>', true) +
          campo('DOCUMENTOS_RELEVANTES', 'Documentos', '<textarea id="tb-f-DOCUMENTOS_RELEVANTES" rows="3">' + texto(val('DOCUMENTOS_RELEVANTES')) + '</textarea>', true, 'Uno por línea: «Nombre: enlace».') +
          (nueva ? '' : campo('CONCLUSIONES', 'Conclusiones', '<textarea id="tb-f-CONCLUSIONES" rows="3">' + texto(val('CONCLUSIONES')) + '</textarea>', true)) +
          '<div class="campo"><label><input type="checkbox" id="tb-f-URGENTE"' + (t.URGENTE ? ' checked' : '') + '> Urgente</label></div>' +
          '<div class="campo"><label><input type="checkbox" id="tb-f-PUBLICAR"' + (t.PUBLICAR ? ' checked' : '') + '> Al aprobarla, hay que publicarla o enviarla</label>' +
          '<div class="ayuda">Si no, al aprobarla pasa sola a Entregada.</div></div>';
      }
      /** Contador del título, entregas según la iniciativa y «espera a». */
      function vivo(f) {
        f.addEventListener('input', function (e) {
          var l = e.target.getAttribute && e.target.getAttribute('data-limite');
          if (!l) return;
          var k = f.querySelector('[data-cuenta="' + e.target.id + '"]'), n = e.target.value.trim().replace(/\.+$/, '').length;
          k.textContent = n + ' / ' + l; k.classList.toggle('mal', n > Number(l));
        });
        f.addEventListener('change', function (e) {
          if (e.target.id === 'tb-f-INICIATIVA') { f.querySelector('#tb-f-ENTREGA').innerHTML = opciones(entregasDe(e.target.value), '', 'Sin entrega'); return; }
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
      var COLS = ['TITULO', 'DESCRIPCION', 'INICIATIVA', 'ENTREGA', 'EPICA', 'ASIGNADO', 'REVISA', 'P', 'T', 'DEADLINE', 'DISPONIBLE_DESDE', 'HERRAMIENTA', 'DOCUMENTOS_RELEVANTES', 'CONCLUSIONES'];
      /** Lo que hay en el formulario: { valores: { COLUMNA: valor }, deps: [IDs] , mal: [avisos] }. */
      function leerForm(f) {
        var o = {}, mal = [];
        COLS.forEach(function (n) { var x = f.querySelector('#tb-f-' + n); if (x) o[n] = n === 'TITULO' ? x.value.trim().replace(/\.+$/, '') : x.value.trim(); });
        o.URGENTE = f.querySelector('#tb-f-URGENTE').checked;
        o.PUBLICAR = f.querySelector('#tb-f-PUBLICAR').checked;
        var d = f.querySelector('[data-deps]'), deps = d && d.getAttribute('data-deps') ? d.getAttribute('data-deps').split(',').filter(String) : [];
        if (!o.TITULO) mal.push('Título: falta.');
        else if (o.TITULO.length > 60) mal.push('Título: pasa de 60 caracteres.');
        if (!o.DESCRIPCION) mal.push('Qué hay que hacer: falta.');
        if (!o.INICIATIVA) mal.push('Iniciativa: falta.');
        if (!o.ASIGNADO) mal.push('Asignada a: falta.');
        return { valores: o, deps: deps, mal: mal };
      }
      /** Las dependencias de id: las que faltan se crean y las que sobran se quitan. */
      function guardarDeps(id, deps) {
        var ya = ctx.tablas.filas(TD).filter(function (d) { return d.TAREA === id; });
        var ps = deps.filter(function (x) { return !ya.some(function (d) { return d.DE === x; }); }).map(function (x) { return ctx.tablas.crear(TD, { TAREA: id, DE: x }); })
          .concat(ya.filter(function (d) { return deps.indexOf(d.DE) < 0; }).map(function (d) { return ctx.tablas.borrar(TD, d.ID); }));
        return Promise.all(ps.map(function (p) { return p.catch(function () {}); }));
      }

      function abrirAlta() {
        var dflt = { INICIATIVA: F.INICIATIVA || (ctx.tablas.fila(TI, 'UTILO') ? 'UTILO' : ((ctx.tablas.filas(TI)[0] || {}).ID || '')), ENTREGA: F.ENTREGA && F.ENTREGA !== '-' ? F.ENTREGA : '',
          EPICA: F.EPICA || '', ASIGNADO: yo(), P: '!!', T: 'S', PUBLICAR: false };
        altaForm.innerHTML = '<h2>Añadir tarea</h2><div class="edit">' + htmlCampos(dflt, true) + '</div><div id="alta-error" role="alert"></div>' +
          '<div class="botones"><button type="button" class="sec" data-cancelar-alta>Cancelar</button><button type="submit" class="pri">Crear tarea</button></div>';
        abrirVelo();
        altaForm.onsubmit = function (e) {
          e.preventDefault();
          var r = leerForm(altaForm), er = altaForm.querySelector('#alta-error');
          if (r.mal.length) { er.textContent = r.mal.join(' '); er.style.display = 'block'; return; }
          var v = {};
          Object.keys(r.valores).forEach(function (k) { if (r.valores[k] !== '' && k !== 'CONCLUSIONES') v[k] = r.valores[k]; });
          cerrarVelo();
          var local = Object.assign({}, v, { ESTADO: r.deps.length || (v.DISPONIBLE_DESDE && v.DISPONIBLE_DESDE > hoyISO()) ? 'Esperando' : 'En cola' });
          ctx.tablas.crear(T, local, { fn: 'tablasCrear', args: ['TAREAS', v] }).then(function (x) {
            if (ctx.abierta()) ctx.aviso('Creada ' + x.id + ': ' + v.TITULO);
            return guardarDeps(String(x.id), r.deps).then(function () { return alDia(); });
          }, function () {});
        };
      }
      vivo(altaForm); // una vez: los oyentes van en el formulario, que se rellena cada vez que se abre
      if ($('alta-btn')) $('alta-btn').onclick = abrirAlta;

      function pintarEditar(t) {
        caja.innerHTML =
          '<div class="barra"><button type="button" class="volver" data-cancelar>' + ICO_VOLVER + 'Volver a la ficha</button></div>' +
          '<div class="cab"><div class="id">' + texto(t.ID) + '</div><h1 id="kb-f-tit">Editar tarea</h1></div>' +
          '<form class="edit" id="kb-edit" novalidate>' + htmlCampos(t, false) +
          '<p class="msg mal" id="kb-e-err" role="alert"></p>' +
          '<div class="pie"><button type="button" class="sec" data-cancelar>Cancelar</button><button type="submit" class="accion">Guardar cambios</button></div></form>';
        var f = caja.querySelector('#kb-edit');
        vivo(f);
        f.onsubmit = function (e) {
          e.preventDefault();
          var r = leerForm(f);
          if (r.mal.length) { caja.querySelector('#kb-e-err').textContent = r.mal.join(' '); return; }
          var id = String(t.ID), cambios = {}, antes = {};
          Object.keys(r.valores).forEach(function (k) {
            var a = t[k] == null ? '' : t[k];
            if (typeof r.valores[k] === 'boolean' ? !!a !== r.valores[k] : String(a) !== r.valores[k]) { cambios[k] = r.valores[k]; antes[k] = a; }
          });
          var deps = esperaA(id), cambianDeps = deps.slice().sort().join(',') !== r.deps.slice().sort().join(',');
          editando = false;
          if (!Object.keys(cambios).length && !cambianDeps) { pintarFicha(); return; }
          var hecho = Object.keys(cambios).length ? ctx.tablas.actualizar(T, id, cambios, { fn: 'tablasActualizar', args: ['TAREAS', id, cambios, { antes: antes }] }) : Promise.resolve();
          hecho.then(function () {
            return (cambianDeps ? guardarDeps(id, r.deps) : Promise.resolve()).then(function () {
              if (ctx.abierta()) ctx.aviso(id + ' guardada.');
              return alDia(id);
            });
          }, function () {});
          pintarFicha();
        };
        if (!TACTIL) { var p = f.querySelector('input'); if (p) p.focus(); }
      }

      /* ---------- cambiar un dato pulsándolo en la ficha (T0386) ---------- */

      var LARGO = { DESCRIPCION: 6, DOCUMENTOS_RELEVANTES: 4, CONCLUSIONES: 4 }; // textos de varias líneas: se guardan con «Guardar»
      function ocupado() { return editando || !!cambiando; }
      function puedeCambiar(t) { return !SOLO_LEE && !t._nueva && CERRADOS.indexOf(t.ESTADO) < 0; }
      /** Los atributos de un dato que se cambia pulsándolo (nada si no se puede). */
      function pulsa(t, k, tit) { return puedeCambiar(t) ? ' data-ed="' + k + '" tabindex="0" title="' + texto((tit ? tit + ': ' : '') + 'pulsa para cambiar') + '"' : (tit ? ' title="' + texto(tit) + '"' : ''); }
      /** El control con el que se cambia k. */
      function control(t, k) {
        var v = t[k] == null ? '' : String(t[k]), lab = ' aria-label="' + texto(ETIQUETA[k] || k) + '"', vs, vacio = false;
        if (k === 'TITULO') return '<input type="text" id="fed" autocomplete="off" value="' + texto(v) + '"' + lab + '>';
        if (k === 'EPICA') {
          var ep = []; tareas().forEach(function (x) { if (x.EPICA && ep.indexOf(x.EPICA) < 0) ep.push(x.EPICA); });
          return '<input type="text" id="fed" list="fed-epicas" autocomplete="off" value="' + texto(v) + '"' + lab + '><datalist id="fed-epicas">' +
            ep.sort().map(function (e) { return '<option value="' + texto(e) + '">'; }).join('') + '</datalist>';
        }
        if (k === 'DEADLINE' || k === 'DISPONIBLE_DESDE') return '<input type="date" id="fed" value="' + texto(v) + '"' + lab + '>';
        if (LARGO[k]) return '<textarea id="fed" rows="' + LARGO[k] + '"' + lab + '>' + texto(v) + '</textarea>' +
          '<div class="pie"><button type="button" class="sec" data-fed-no>Cancelar</button><button type="button" class="accion" data-fed-ok>Guardar</button></div>';
        if (k === 'DEPENDE') {
          var ya = esperaA(String(t.ID));
          vs = tareas().filter(function (x) { return CERRADOS.indexOf(x.ESTADO) < 0 && !x._nueva && String(x.ID) !== String(t.ID) && ya.indexOf(String(x.ID)) < 0; })
            .sort(function (a, b) { return String(b.ID).localeCompare(String(a.ID)); }).map(function (x) { return [String(x.ID), x.ID + ' · ' + x.TITULO]; });
          return '<select id="fed" aria-label="Añadir una tarea a la que espera">' + opciones(vs, '', 'Elige la tarea…') + '</select>';
        }
        if (k === 'INICIATIVA') vs = ctx.tablas.filas(TI).map(function (i) { return [i.ID, i.NOMBRE || i.ID]; });
        else if (k === 'ENTREGA') { vs = entregasDe(t.INICIATIVA); if (v && !vs.some(function (x) { return x[0] === v; })) vs.unshift([v, t.ENTREGA_CORTA || v]); vacio = 'Sin entrega'; }
        else if (k === 'ASIGNADO') vs = gentes();
        else if (k === 'REVISA') { vs = gentes(); vacio = 'Nadie'; }
        else if (k === 'P') vs = ['!!!!', '!!!', '!!', '!'].map(function (x) { return [x, x]; });
        else if (k === 'T') vs = ['XS', 'S', 'M', 'L', 'XL'].map(function (x) { return [x, x]; });
        if (!vacio && !v) vacio = 'Elige…';
        return '<select id="fed"' + lab + '>' + opciones(vs || [], v, vacio) + '</select>';
      }
      function abrirCampo(k) {
        cambiando = k; pintarFicha();
        var x = caja.querySelector('#fed');
        if (!x) return;
        x.focus();
        if (x.type === 'text') x.select();
        if (x.tagName === 'SELECT' && x.showPicker) { try { x.showPicker(); } catch (e) {} }
      }
      function cerrarCampo() {
        var k = cambiando; cambiando = ''; pintarFicha();
        var x = caja.querySelector('[data-ed="' + k + '"]'); if (x) x.focus();
      }
      function guardarCampo(k, v) {
        var t = tarea(abiertaId);
        if (!t || !k) return;
        var id = String(t.ID);
        if (k === 'DEPENDE') { cerrarCampo(); if (v) cambiarDeps(id, esperaA(id).concat([v])); return; }
        var r = cambioDe(t, k, v, function (ini) { return entregasDe(ini).map(function (x) { return x[0]; }); });
        if (r && r.mal) { ctx.aviso(r.mal); var x = caja.querySelector('#fed'); if (x) x.focus(); return; }
        if (r) ctx.tablas.actualizar(T, id, r.cambios, { fn: 'tablasActualizar', args: ['TAREAS', id, r.cambios, { antes: r.antes }] }).then(function () {
          if (ctx.abierta()) ctx.aviso(id + ' guardada.');
          return alDia(id);
        }, function () {});
        cerrarCampo();
      }
      function cambiarDeps(id, deps) {
        guardarDeps(id, deps).then(function () { if (ctx.abierta()) ctx.aviso(id + ' guardada.'); return alDia(id); });
      }

      /** T0387 · Responder la pregunta de la tarea abierta: a la DESCRIPCION y a la bitácora, y vuelve a la cola. */
      var respuestas = {};   // lo escrito en la respuesta de cada tarea, para que repintar la ficha no lo borre
      function puedeResponder(t) {
        return t.ESTADO === 'Necesita tu respuesta' && !SOLO_LEE && !t._nueva &&
          (ctx.admin || (ctx.personaId && t.PIDE === ctx.personaId) || /^responsable/.test(ctx.perfil || ''));
      }
      function responder(id, txt, b) {
        b.disabled = true; b.textContent = 'Enviando…';
        var auto = !!(tarea(id) || {}).AUTONOMA;
        ctx.llamar('responder', [{ tarea: id, texto: txt }]).then(function (estado) {
          delete respuestas[id];
          if (ctx.abierta()) ctx.aviso('Respondida: ' + id + ' vuelve a ' + (typeof estado === 'string' && estado ? estado : 'la cola') + '.' +
            (auto && estado === 'En cola' ? ' Es autónoma: lanza «Autónomo» en GitHub para que siga.' : ''));
          return Promise.all([ctx.tablas.refrescar([T], true), abiertaId === id ? bitacora(id, true) : null]);
        }, function (e) {
          if (ctx.abierta()) ctx.aviso('No se ha enviado la respuesta: ' + String(e.message).replace(/^\w+:\s*/, ''));
          b.disabled = false; b.textContent = 'Responder';
        }).then(function () { if (ctx.abierta() && abiertaId === id && !ocupado()) pintarFicha(); });
      }

      /** Una nota en la bitácora de la tarea abierta. */
      function anotar(id, txt, b) {
        b.disabled = true;
        ctx.llamar('anotar', [{ tarea: id, texto: txt }]).then(function () {
          if (!ctx.abierta()) return;
          var a = caja.querySelector('#tb-nota'); if (a) a.value = '';
          return bitacora(id, true);
        }, function (e) { if (ctx.abierta()) ctx.aviso('No se ha apuntado: ' + String(e.message).replace(/^\w+:\s*/, '')); })
          .then(function () { b.disabled = false; });
      }

      /* ---------- ficha ---------- */

      function abrirFicha(id, sinUrl) {
        if (!tarea(id)) return;
        abiertaId = id; editando = false; cambiando = '';
        pintarFicha();
        fv.classList.add('abierto');
        document.documentElement.classList.add('fv-abierta');
        if (!sinUrl) urlFicha(id);
        var b = caja.querySelector('.volver'); if (b) b.focus();
        bitacora(id);
      }
      /** La bitácora de esta tarea, solo la suya (tiene miles de líneas entre todas). fresco: aunque ya esté. */
      function bitacora(id, fresco) {
        var p = { BITACORA: { clave: 'T:' + id, col: 'TAREA', valores: [id] } };
        return (fresco ? ctx.tablas.leer([TB], { partes: p, fresco: true }) : ctx.tablas.leer([TB], { partes: p })).then(function () {
          if (ctx.abierta() && abiertaId === id && !ocupado()) pintarFicha();
        }, function (e) { if (ctx.abierta() && abiertaId === id) ctx.aviso('No se ha podido leer la bitácora: ' + String(e.message).replace(/^\w+:\s*/, '')); });
      }
      function cerrarFicha() {
        if (!abiertaId) return;
        abiertaId = ''; editando = false; cambiando = '';
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
        if (r && !(e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); if (tarea(r.getAttribute('data-rel'))) abrirFicha(r.getAttribute('data-rel')); return; }
        if (e.target.closest('[data-fed-ok]')) { var a0 = caja.querySelector('#fed'); if (a0) guardarCampo(cambiando, a0.value); return; }
        if (e.target.closest('[data-fed-no]')) { cerrarCampo(); return; }
        var q = e.target.closest('[data-quitar-dep]');
        if (q) { var qx = q.getAttribute('data-quitar-dep'); cambiarDeps(abiertaId, esperaA(abiertaId).filter(function (y) { return y !== qx; })); return; }
        var d = e.target.closest('[data-ed]');
        if (d && !e.target.closest('a')) { abrirCampo(d.getAttribute('data-ed')); return; }
        if (e.target.closest('[data-editar]')) { editando = true; cambiando = ''; pintarFicha(); return; }
        if (e.target.closest('[data-cancelar]')) { editando = false; pintarFicha(); return; }
        var rb = e.target.closest('[data-responder]');
        if (rb) { var ra = caja.querySelector('#tb-resp'), rt = ra ? ra.value.trim() : ''; if (rt) responder(abiertaId, rt, rb); else if (ra) { ra.focus(); ctx.aviso('Escribe la respuesta antes de enviarla.'); } return; }
        var b = e.target.closest('[data-anotar]');
        if (b) { var a = caja.querySelector('#tb-nota'), txt = a ? a.value.trim() : ''; if (txt) anotar(abiertaId, txt, b); else if (a) a.focus(); }
      });
      fv.addEventListener('input', function (e) { if (e.target.id === 'tb-resp' && abiertaId) respuestas[abiertaId] = e.target.value; });
      fv.addEventListener('change', function (e) {
        if (e.target.id === 'kb-f-est') { mover(abiertaId, e.target.value); return; }
        if (e.target.id === 'fed' && e.target.tagName === 'SELECT' && cambiando) guardarCampo(cambiando, e.target.value);
      });
      // Un dato de una línea se guarda al salir de él (o con Intro); un desplegable que se deja sin cambiar, se cierra.
      fv.addEventListener('focusout', function (e) {
        var x = e.target;
        if (x.id !== 'fed' || !cambiando || !x.isConnected) return;
        if (x.tagName === 'INPUT') guardarCampo(cambiando, x.value);
        else if (x.tagName === 'SELECT') setTimeout(function () { if (cambiando && x.isConnected && document.activeElement !== x) cerrarCampo(); }, 0);
      });
      fv.addEventListener('keydown', function (e) {
        if (cambiando && e.target.id === 'fed') {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarCampo(); return; }
          if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey)) { e.preventDefault(); guardarCampo(cambiando, e.target.value); }
          return;
        }
        var d = e.target.getAttribute && e.target.getAttribute('data-ed');
        if (d && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirCampo(d); return; }
        if (e.key === 'Escape') { if (cambiando) cerrarCampo(); else if (editando) { editando = false; pintarFicha(); } else cerrarFicha(); }
      });

      function bloque(tit, ls, attrs) {
        if (!ls.length) return '';
        var html = '', enLista = false;
        ls.forEach(function (l) {
          if (/^\s*-\s+/.test(l)) { if (!enLista) { html += '<ul>'; enLista = true; } html += '<li>' + texto(l.replace(/^\s*-\s+/, '')) + '</li>'; }
          else { if (enLista) { html += '</ul>'; enLista = false; } html += '<p>' + texto(l) + '</p>'; }
        });
        if (enLista) html += '</ul>';
        return '<div class="bloque"' + (attrs || '') + '><h3>' + texto(tit) + '</h3>' + html + '</div>';
      }
      function rel(id) {
        var x = tarea(id), st = x ? x.ESTADO : 'No la ves';
        return '<a class="frel" href="?s=' + texto(ctx.id.toLowerCase()) + '&amp;t=' + encodeURIComponent(id) + '" data-rel="' + texto(id) + '">' +
          '<span class="fpill ' + cls(st) + '">' + texto(st) + '</span><span class="frid">' + texto(id) + '</span><span class="frtit">' + texto(x ? x.TITULO : '') + '</span></a>';
      }
      function fechaCaja(lab, val, pista, c, attrs) {
        return '<div class="ffecha ' + (c || '') + '"' + (attrs || '') + '><small>' + texto(lab) + '</small><strong>' + texto(val || '—') + '</strong>' + (pista ? '<span class="fpista">' + texto(pista) + '</span>' : '') + '</div>';
      }
      function quien(b) { return b.QUIEN || nombre(b.PERSONA) || (b.EMPLEADO ? b.EMPLEADO : 'Sistema'); }

      function pintarFicha() {
        var t = tarea(abiertaId);
        if (!t) { cerrarFicha(); return; }
        if (editando) { pintarEditar(t); return; }
        var id = String(t.ID), cerrada = CERRADOS.indexOf(t.ESTADO) >= 0, e = entrega(t.ENTREGA);
        var pc = puedeCambiar(t), ab = function (k) { return pc && cambiando === k; };
        if (cambiando && !pc) cambiando = '';
        var fcaja = function (k, val, pista, c) {
          return ab(k) ? '<div class="ffecha fed-abierto"><small>' + texto(ETIQUETA[k]) + '</small>' + control(t, k) + '</div>' : fechaCaja(ETIQUETA[k], val, pista, c, pulsa(t, k));
        };
        var tag = function (k, html, extra) {
          return ab(k) ? '<span class="ftag fed-abierto">' + control(t, k) + '</span>' : '<span class="ftag' + (extra || '') + '"' + pulsa(t, k, ETIQUETA[k]) + '>' + html + '</span>';
        };
        var largo = function (k, html) {
          if (ab(k)) return '<div class="bloque fed-abierto"><h3>' + texto(ETIQUETA[k]) + '</h3><div class="edit">' + control(t, k) + '</div></div>';
          return html != null ? (html ? '<div class="bloque"' + pulsa(t, k) + '><h3>' + texto(ETIQUETA[k]) + '</h3>' + html + '</div>' : '') : bloque(ETIQUETA[k], lineas(t[k]), pulsa(t, k));
        };
        var fs = [];
        var n = dias(t.DEADLINE), p = '', c = '';
        if (!t.DEADLINE) { p = 'sin fecha límite'; c = 'nada'; }
        else if (cerrada) c = 'ok';
        else if (n < 0) { p = 'vencida hace ' + (-n) + (n === -1 ? ' día' : ' días'); c = 'venc'; }
        else if (n === 0) { p = 'vence hoy'; c = 'venc'; }
        else if (n === 1) { p = 'vence mañana'; c = 'pronto'; }
        else { p = 'faltan ' + n + ' días'; c = n <= 3 ? 'pronto' : ''; }
        fs.push(fcaja('DEADLINE', fechaEs(t.DEADLINE), p, c));
        if (t.DISPONIBLE_DESDE || ab('DISPONIBLE_DESDE')) fs.push(fcaja('DISPONIBLE_DESDE', fechaEs(t.DISPONIBLE_DESDE), '', dias(t.DISPONIBLE_DESDE) > 0 ? 'pronto' : 'ok'));
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
        tags.push(tag('INICIATIVA', texto(iniciativa(t.INICIATIVA))));
        if (t.ENTREGA || ab('ENTREGA')) tags.push(tag('ENTREGA', texto((t.ENTREGA_CORTA || t.ENTREGA) + (e && e.NOMBRE ? ' · ' + e.NOMBRE : ''))));
        if (t.EPICA || ab('EPICA')) tags.push(tag('EPICA', texto(t.EPICA)));
        if (t.P || ab('P')) tags.push(tag('P', 'Prioridad ' + texto(t.P), ' p' + String(t.P || '').length));
        if (t.T || ab('T')) tags.push(tag('T', 'Tamaño ' + texto(t.T)));
        var manos = enManos(t);
        var pasos = PASOS[t.ESTADO] || [], mueve = !SOLO_LEE && pasos.length && !t._nueva;
        var estado = '<div class="est ' + cls(t.ESTADO) + '">' + (mueve ? '<label for="kb-f-est">Estado</label><select id="kb-f-est"' + (t._pendiente ? ' disabled' : '') + '>' +
            [t.ESTADO].concat(pasos).map(function (e) { return '<option' + (e === t.ESTADO ? ' selected' : '') + '>' + texto(e) + '</option>'; }).join('') + '</select>'
            : '<span class="fpill">' + texto(t.ESTADO) + '</span>') +
          (t._pendiente ? '<span class="msg">Guardando…</span>' : manos ? '<span class="msg">' + texto(t.EN_MANOS_TIPO === 'espera' ? manos : t.EN_MANOS_TIPO === 'fuera' ? 'Depende de fuera: ' + manos : 'En manos de ' + manos) + '</span>' : '') + '</div>';
        var personas = ['ASIGNADO', 'PIDE', 'REVISA'].map(function (k) {
          if (ab(k)) return '<p class="fed-abierto"><b>' + texto(ETIQUETA[k]) + ':</b> ' + control(t, k) + '</p>';
          return t[k] ? '<p' + (k === 'PIDE' ? '' : pulsa(t, k)) + '><b>' + texto(ETIQUETA[k]) + ':</b> ' + texto(nombre(t[k])) + '</p>' : '';
        }).filter(String);
        if (t.EMPLEADO) personas.push('<p><b>' + ETIQUETA.EMPLEADO + ':</b> ' + texto(t.EMPLEADO) + '</p>');
        var espera = deps.map(function (x) {
          return pc ? '<div class="frel-fila">' + rel(x) + '<button type="button" class="fquitar" data-quitar-dep="' + texto(x) + '" aria-label="Ya no espera a ' + texto(x) +
            '" title="Ya no espera a ' + texto(x) + '">×</button></div>' : rel(x);
        }).join('') + (ab('DEPENDE') ? '<div class="fed-abierto">' + control(t, 'DEPENDE') + '</div>' : pc && deps.length ? '<button type="button" class="fmas" data-ed="DEPENDE">+ Otra tarea</button>' : '');
        // Lo que no tiene valor no sale en la ficha: se añade desde aquí.
        var faltan = !pc ? [] : [['ASIGNADO', !t.ASIGNADO], ['REVISA', !t.REVISA], ['ENTREGA', !t.ENTREGA], ['EPICA', !t.EPICA], ['P', !t.P], ['T', !t.T],
          ['DISPONIBLE_DESDE', !t.DISPONIBLE_DESDE], ['DEPENDE', !deps.length], ['DOCUMENTOS_RELEVANTES', !docs.length], ['CONCLUSIONES', !lineas(t.CONCLUSIONES).length]]
          .filter(function (x) { return x[1] && cambiando !== x[0]; });
        var anadir = faltan.length ? '<div class="fanadir"><span>Añadir</span>' + faltan.map(function (x) {
          return '<button type="button" class="fmas" data-ed="' + x[0] + '">+ ' + texto(ETIQUETA[x[0]]) + '</button>'; }).join('') + '</div>' : '';
        var motivo = [];
        if (t.PREGUNTA) motivo.push('<p><b>Pregunta:</b> ' + texto(t.PREGUNTA) + '</p>');
        if (puedeResponder(t)) motivo.push('<div class="fresp"><label class="u-oculto" for="tb-resp">Tu respuesta</label>' +
          '<textarea id="tb-resp" rows="3" placeholder="Tu respuesta…">' + texto(respuestas[id] || '') + '</textarea>' +
          '<div class="pie"><button type="button" class="u-btn" data-responder>Responder</button></div></div>');
        if (t.MOTIVO_BLOQUEO) motivo.push('<p><b>Bloqueada:</b> ' + texto(t.MOTIVO_BLOQUEO) + '</p>');
        if (t.MOTIVO) motivo.push('<p><b>Motivo:</b> ' + texto(t.MOTIVO) + '</p>');
        caja.innerHTML =
          '<div class="barra"><button type="button" class="volver" data-cerrar>' + ICO_VOLVER + 'Volver al tablero</button></div>' +
          '<div class="cab"><div class="id"><span class="n">' + texto(id) + '</span></div>' +
            (ab('TITULO') ? '<h1 id="kb-f-tit" class="fed-abierto">' + control(t, 'TITULO') + '</h1>' : '<h1 id="kb-f-tit"' + pulsa(t, 'TITULO') + '>' + texto(t.TITULO) + '</h1>') + '</div>' +
          '<div class="fmeta">' + tags.join('') + '</div>' + estado +
          (motivo.length ? '<div class="bloque">' + motivo.join('') + '</div>' : '') +
          '<div class="datos"><div class="fila"><b>Fechas</b><div class="ffechas">' + fs.join('') + '</div></div></div>' +
          largo('DESCRIPCION') +
          (personas.length ? '<div class="bloque"><h3>Personas</h3>' + personas.join('') + '</div>' : '') +
          (deps.length || ab('DEPENDE') ? '<div class="bloque"><h3>Espera a</h3>' + espera + '</div>' : '') +
          (bloquea.length ? '<div class="bloque"><h3>La esperan</h3>' + bloquea.map(rel).join('') + '</div>' : '') +
          largo('DOCUMENTOS_RELEVANTES', docs.join('')) +
          largo('CONCLUSIONES') + anadir +
          '<div class="bloque hist"><h3>Bitácora (lo más reciente arriba)</h3>' +
            (SOLO_LEE || t._nueva ? '' : '<div class="edit"><div class="campo"><label class="u-oculto" for="tb-nota">Apuntar una nota</label><textarea id="tb-nota" rows="2" placeholder="Apuntar una nota…"></textarea></div>' +
              '<div class="pie"><button type="button" class="sec" data-anotar>Apuntar</button></div></div>') +
            (bit.length ? bit.join('') : '<p class="u-nota">' + (ctx.tablas.tiene && ctx.tablas.tiene(TB, { clave: 'T:' + id }) ? 'Todavía no hay nada apuntado.' : 'Cargando…') + '</p>') + '</div>' +
          (SOLO_LEE || t._nueva || cerrada ? '' : '<div class="pie"><button type="button" class="sec" data-editar>Editar tarea</button></div>');
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
        if (abiertaId && !ocupado() && [T, TE, TD, TB].indexOf(t) >= 0) pintarFicha();
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

      // T0386: en directo. Cuando alguien (otra persona, el agente, Telegram) cambia una tarea, sus dependencias o la bitácora,
      // la base avisa (Realtime) y el tablero se pone al día solo, en un segundo; si es la de la ficha abierta, también su bitácora.
      // Los avisos de un momento se juntan en una lectura; mientras se arrastra una tarjeta, espera a que se suelte.
      var directo = null, tDirecto = null, pendiente = {};
      function alDirecto() {
        tDirecto = null;
        if (!ctx.abierta()) { pendiente = {}; return; }
        if (arr) { tDirecto = setTimeout(alDirecto, 1000); return; }
        var p = pendiente; pendiente = {};
        var todo = p['*'], ts = [];
        if (todo || p.tareas || p.dependencias) ts.push(T, TD);
        if (ts.length) ctx.tablas.refrescar(ts, true).catch(function () {});
        if (abiertaId && (todo || p.bitacora || p.tareas)) bitacora(abiertaId, true).catch(function () {});
      }
      if (ctx.enDirecto) {
        directo = ctx.enDirecto(['tareas', 'dependencias', 'bitacora'], function (tabla) {
          pendiente[tabla] = 1;
          if (!tDirecto) tDirecto = setTimeout(alDirecto, 800);
        });
      }
      this._cerrar = function () {
        if (directo) { directo.cerrar(); directo = null; }
        if (tDirecto) { clearTimeout(tDirecto); tDirecto = null; }
        el.classList.remove('kb', 'tb'); document.documentElement.classList.remove('fv-abierta'); urlFicha(''); };
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); }
  });
})();
