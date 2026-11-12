/*
 * Tablero de la gestión de Utilo · plataforma interna sobre Supabase (T0386) · clientes/utilo/modulos/tablero de utilo-apps
 *
 * Las tareas de todas las iniciativas que ve quien ha entrado, en una columna por estado (los del plan de la plataforma),
 * con «en manos de» (quién tiene que mover ficha) y la entrega (U19) en cada tarjeta, y su ficha. Sigue el contrato de una
 * sección (docs/CONTRATO_SECCION.md) y el diseño del Kanban de siempre (estilos/kanban.css sobre base.css y marca.css).
 * - Lee la vista TABLERO (public.tablero: cada tarea con su entrega corta y en manos de quién está) con la capa de tablas,
 *   que va a Supabase con la sesión de quien ha entrado: lo que se ve lo dicen sus roles (reglas por fila).
 * - Vista (arriba): «8 columnas» (todas menos Aplazada y Descartada), «Todas» (los diez estados) o «Agrupadas» (Necesita tu
 *   respuesta con Bloqueada; el estado exacto, en la tarjeta). T0440: Aprobada se llama «Por publicar», en su columna. La primera vez, la de
 *   config.VISTA; después, la última de este dispositivo. Entregadas y Descartadas, solo las de los últimos días (Filtros).
 * - En directo: con Supabase, lo que cambie otra persona (o el agente) sale solo en un segundo (Realtime); sin ↻ (T0422).
 * - Ordenar a mano: arrastrada dentro de su columna, la tarjeta se queda donde se suelta (el mismo orden para todos; las que no
 *   se han tocado, debajo, con el de siempre). Al cambiar de estado, vuelve al de siempre. Las cerradas, por fecha.
 * - Filtros: iniciativa, entrega, persona (en manos de, asignada, pide o revisa), épica y prioridad, y las columnas, en una hoja
 *   con botones (T0422, como en Entregas); buscar, al lado. Crear, con el + flotante.
 * - Las personas son su id en la base: el nombre sale de personas_gestion().
 * - Se pinta al momento con lo guardado en el dispositivo y se refresca por detrás.
 * - Mover (arrastrando en el ordenador, con el desplegable en el móvil o desde la ficha): solo a los estados a los que se
 *   puede pasar, y pide lo que exige cada uno (Bloqueada, el motivo; Necesita tu respuesta, la pregunta; Aplazada, la fecha;
 *   Descartada, el motivo). La tarjeta cambia al momento y lo escribe mover_tarea(); si la base dice que no, vuelve.
 * - T0440 · Aprobar: en la ficha de una tarea Para revisar (o llevándola a Por publicar), quien la revisa (o lleva la
 *   iniciativa) la aprueba: la función del servidor aprobar mira su PR en GitHub («Pruebas» ✅ y sin conflictos), la fusiona
 *   y la deja en Aprobada, que aquí se llama «Por publicar» y tiene su columna (Entregada si no lleva nada que publicar).
 * - T0449 · Pedir cambios (sustituye a «rechazar»): en la ficha de una tarea Para revisar o Aprobada, o llevándola a En cola,
 *   quien la revisa (o lleva la iniciativa) escribe qué hay que cambiar y pedir_cambios() la devuelve a la cola con la marca
 *   (la tarjeta lo dice), el bloque «Cambios pedidos» en Qué hay que hacer y su línea en la bitácora. Si es autónoma, el aviso
 *   lleva a «Que lo haga Claude».
 * - En el móvil, mantener pulsada una tarjeta la coge para llevarla con el dedo a otra columna o a otro sitio de la suya.
 * - Ficha: cada dato (título, etiquetas, fechas, personas, «espera a», textos) se cambia pulsándolo; lo que no tiene valor, con
 *   «Añadir». «Editar tarea» sigue para cambiar varios a la vez.
 * - Crear y editar escriben TAREAS (y sus DEPENDENCIAS) con la capa de tablas; la tarjeta sale al momento con «Guardando».
 *   Una nota va a la bitácora con anotar(). Después se trae el tablero (en manos de, lo que la base mueve sola).
 * - T0466 · Por publicar: la ficha dice qué falta para llegar a producción (qué botón: «Publicar» de qué proyecto, «Supabase»
 *   de qué iniciativa en producción, o a mano) y qué ya está; y la columna las agrupa por los botones que les faltan. Lo
 *   calcula herramientas/entregar.js al fusionar y al publicar (TAREAS.POR_PUBLICAR); aquí solo se lee.
 * - T0387 · Una tarea en Necesita tu respuesta se responde en su ficha (responder() de la base, como en Para mí): quien la
 *   pidió o quien lleva la iniciativa. Lo escrito se guarda aunque la ficha se repinte.
 */
(function () {
  'use strict';
  var T = 'TABLERO', TI = 'INICIATIVAS', TE = 'ENTREGAS', TD = 'DEPENDENCIAS', TB = 'BITACORA';
  var RAIZ = (function () { var s = typeof document !== 'undefined' && document.currentScript && document.currentScript.src; return s ? s.replace(/utilo\/secciones\/[^/]*$/, '') : '../../'; })();
  var VERSION = (function () { var s = typeof document !== 'undefined' && document.currentScript && document.currentScript.src; var m = s && /[?&]v=([^&]+)/.exec(s); return m ? m[1] : '1'; })();
  var ICO_VOLVER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  var ICO_FILTROS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
  var ICO_CERRAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  /** T0319 · Una tarea autónoma, en la tarjeta: un robot junto al ID, sin texto (decidido por Javi: etiquetas, las justas). */
  var ICO_AUTO = '<svg class="tb-auto" viewBox="0 0 24 24" role="img" aria-label="Autónoma"><title>La puede hacer el agente autónomo</title>' +
    '<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5M3 12v3M21 12v3"/></svg>';

  /** Los estados, en el orden del flujo, con su color de estilos/base.css y quién mueve ficha. */
  var ESTADOS = ['Esperando', 'En cola', 'En curso', 'Necesita tu respuesta', 'Bloqueada', 'Para revisar', 'Aprobada', 'Entregada', 'Aplazada', 'Descartada'];
  var COLOR = { 'Esperando': 'x', 'En cola': 'ni', 'En curso': 'ec', 'Necesita tu respuesta': 'pr', 'Bloqueada': 'bl', 'Para revisar': 'pr', 'Aprobada': 'co',
    'Entregada': 'co', 'Aplazada': 'x', 'Descartada': 'x' };
  var CERRADOS = ['Entregada', 'Descartada'];
  /** T0440 · Cómo se llama cada estado en la pantalla: Aprobada es «Por publicar» (fusionada, falta llevarla a producción). */
  var NOMBRE = { 'Aprobada': 'Por publicar' };
  function nom(e) { return NOMBRE[e] || e; }
  /** A qué estados se puede pasar desde cada uno (los de gestion.pasos() de la base, que es la que manda). */
  var PASOS = {
    'Esperando': ['En cola', 'Aplazada', 'Descartada'],
    'En cola': ['En curso', 'Esperando', 'Aplazada', 'Descartada'],
    'En curso': ['Para revisar', 'Necesita tu respuesta', 'Bloqueada', 'En cola', 'Aplazada', 'Descartada'],
    'Necesita tu respuesta': ['En cola', 'Aplazada', 'Descartada'],
    'Bloqueada': ['En cola', 'Aplazada', 'Descartada'],
    'Para revisar': ['Aprobada', 'En cola', 'Descartada'],   // T0449: a En cola, pidiendo cambios (rechazar a En curso, ya no)
    'Aprobada': ['Entregada', 'En cola'],
    'Aplazada': ['En cola', 'Esperando', 'Descartada']
  };
  /** Qué abarca cada estado: sale al pasar el ratón por la cabecera de su columna. */
  var QUE_ES = {
    'Esperando': 'Espera a otra tarea de la que depende: todavía no se puede empezar.',
    'En cola': 'No espera nada: lista para empezar cuando alguien la coja.',
    'En curso': 'Alguien está trabajando en ella ahora.',
    'Necesita tu respuesta': 'Parada hasta que quien la pidió conteste una pregunta concreta.',
    'Bloqueada': 'Parada por algo de fuera: material del cliente, un acceso, un problema técnico o un tercero.',
    'Para revisar': 'Hecha: falta que quien la revisa la mire y la apruebe (Aprobar fusiona su PR) o pida cambios.',
    'Aprobada': 'Aprobada y fusionada: falta publicarla o enviarla. Si no lleva nada que publicar, pasa sola a Entregada.',
    'Entregada': 'Hecha y funcionando. Se cierra con su fecha.',
    'Aplazada': 'Se deja para más adelante: se vuelve a mirar en la fecha que diga.',
    'Descartada': 'No se va a hacer.'
  };
  /** El texto de la cabecera de una columna: el de su estado o, si junta varios, el de cada uno. */
  function queEs(c) {
    return c.estados.length === 1 ? QUE_ES[c.estados[0]] || '' : c.estados.map(function (e) { return nom(e) + ': ' + (QUE_ES[e] || ''); }).join('\n');
  }
  var MOTIVOS_BLOQUEO = ['Falta material del cliente', 'Falta un acceso', 'Problema técnico', 'Un tercero'];
  /** T0449 · Lo que pasa al pedir cambios (la ventanita del tablero). */
  var AYUDA_CAMBIOS = 'Vuelve a la cola con lo que escribas, tal cual: queda en Qué hay que hacer y en la bitácora, y quien la coja lo ve lo primero.';
  var HERRAMIENTAS = ['Chat', 'Cowork', 'Claude Code'];
  /** Las columnas de cada vista: [{ id, titulo, estados }]. */
  var VISTAS = {
    ocho: { titulo: '8 columnas', cols: ESTADOS.filter(function (e) { return e !== 'Aplazada' && e !== 'Descartada'; }).map(function (e) { return { id: e, titulo: nom(e), estados: [e] }; }) },
    todas: { titulo: 'Todas', cols: ESTADOS.map(function (e) { return { id: e, titulo: nom(e), estados: [e] }; }) },
    agrupadas: { titulo: 'Agrupadas', cols: [
      { id: 'Esperando', titulo: 'Esperando', estados: ['Esperando'] },
      { id: 'En cola', titulo: 'En cola', estados: ['En cola'] },
      { id: 'En curso', titulo: 'En curso', estados: ['En curso'] },
      { id: 'Atascadas', titulo: 'Atascadas', estados: ['Necesita tu respuesta', 'Bloqueada'], color: 'bl' },
      { id: 'Para revisar', titulo: 'Para revisar', estados: ['Para revisar'] },
      { id: 'Aprobada', titulo: 'Por publicar', estados: ['Aprobada'] },   // T0440: en su propia columna
      { id: 'Entregada', titulo: 'Entregada', estados: ['Entregada'] }
    ] }
  };
  var ETIQUETA = { ASIGNADO: 'Asignada a', PIDE: 'La pide', REVISA: 'La revisa', EPICA: 'Épica', P: 'Prioridad', T: 'Tamaño', INICIATIVA: 'Iniciativa',
    ENTREGA: 'Entrega', DEADLINE: 'Fecha límite', DISPONIBLE_DESDE: 'No empezar antes del', FECHA_CIERRE: 'Cerrada el', REVISAR_EL: 'Se vuelve a mirar el',
    DESCRIPCION: 'Qué hay que hacer', DOCUMENTOS_RELEVANTES: 'Documentos', CONCLUSIONES: 'Conclusiones', PREGUNTA: 'Pregunta', MOTIVO: 'Motivo',
    MOTIVO_BLOQUEO: 'Motivo del bloqueo', HERRAMIENTA: 'Herramienta', EMPLEADO: 'Empleado IA', TITULO: 'Título', DEPENDE: 'Espera a',
    AUTONOMA: 'Autónoma', QUE_MIRAR: 'Qué mirar' };
  var OBLIGA = { TITULO: 'Título', DESCRIPCION: 'Qué hay que hacer', INICIATIVA: 'Iniciativa', ASIGNADO: 'Asignada a', P: 'Prioridad', T: 'Tamaño' };
  /** T0074: la épica que se sugiere a una tarea nueva de la entrega e: la que más llevan sus tareas (sin las descartadas); a
   *  igualdad, la de la tarea más reciente. '' sin entrega o si ninguna de sus tareas tiene épica. */
  function epicaSugerida(ts, e) {
    if (!e) return '';
    var n = {}, ult = {};
    ts.forEach(function (t) {
      if (t.ENTREGA !== e || !t.EPICA || t.ESTADO === 'Descartada' || t._nueva) return;
      n[t.EPICA] = (n[t.EPICA] || 0) + 1;
      if (!ult[t.EPICA] || String(t.ID) > ult[t.EPICA]) ult[t.EPICA] = String(t.ID);
    });
    return Object.keys(n).sort(function (a, b) { return n[b] - n[a] || ult[b].localeCompare(ult[a]); })[0] || '';
  }
  /** T0386: lo que se guarda al cambiar el dato k de la tarea t desde la ficha: { cambios, antes }, { mal } si no vale, o null si no
   *  cambia nada. entregasDe(ini) da los id de las entregas de una iniciativa: al cambiar de iniciativa, la entrega que no es suya se quita. */
  function cambioDe(t, k, v, entregasDe) {
    v = typeof v === 'boolean' ? v : String(v == null ? '' : v).trim();
    if (k === 'AUTONOMA' && typeof v !== 'boolean') v = v === 'si'; // T0319: de la lista llega «si» o «no»
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

  /* ---------- T0420 · los textos largos de la ficha, ordenados para leerlos de un vistazo ---------- */

  // Los apartados que escriben /empezar y /cerrar («DECISIONES:» en una línea sola) y su título en la ficha. SOLICITUD, sin título.
  var APARTADOS = { SOLICITUD: '', DECISIONES: 'Decisiones', ABIERTO: 'Queda abierto', PENDIENTE: 'Pendiente', PASOS: 'Pasos', NOTAS: 'Notas', CRITERIO: 'Está bien hecho cuando' };
  var HECHO = /^Est(?:á|a|ará) (?:bien )?hech[oa] cuando\s+/i;
  /** Un párrafo, una frase por línea: corta tras . ! ? … si sigue una mayúscula (no un número: «1) …»). */
  function frases(s) {
    return String(s || '').replace(/([.!?…])\s+(?=[«¿¡("]?[A-ZÁÉÍÓÚÜÑ])/g, '$1\n').split('\n').map(function (x) { return x.trim(); }).filter(String);
  }
  /** «Pasos: 1) uno; 2) dos.» → { intro: 'Pasos:', pasos: ['uno', 'dos.'] }; null si la frase no numera al menos dos. */
  function numerada(f) {
    if (!/(^|\s)1\)\s/.test(f) || !/\s2\)\s/.test(f)) return null;
    var partes = f.split(/(?:^|\s)(?=\d{1,2}\)\s)/), intro = /^\d{1,2}\)\s/.test(partes[0]) ? '' : partes.shift().trim();
    return { intro: intro, pasos: partes.map(function (p) { return p.replace(/^\d{1,2}\)\s+/, '').replace(/[;,]\s*$/, '').trim(); }) };
  }
  /**
   * Un texto largo de la ficha (Qué hay que hacer, Conclusiones) en partes, sin tocar lo guardado:
   * [{ tit, fecha?, anadido?, cosas: [{ p } | { hecho } | { li, quien } | { intro, pasos }] }]
   * - «SOLICITUD:», «DECISIONES:», «ABIERTO:»… (APARTADOS), solos o al empezar la línea: un apartado con su título.
   * - «Añadido después (fecha, quién): …»: un apartado aparte, con lo de los paréntesis como fecha.
   * - T0449 · «Cambios pedidos (fecha, quién): …»: lo mismo, marcado como cambios pedidos (cambios: true).
   * - Un párrafo, una frase por línea; «Está bien hecho cuando …», aparte; «1) … 2) …», numerada.
   * - «- …»: lista; «(Javi)» al final, a quién le toca.
   */
  function partesTexto(s) {
    var out = [], cur = null;
    var may = function (x) { return x.charAt(0).toUpperCase() + x.slice(1); };
    function nuevo(tit, extra) { cur = { tit: tit, cosas: [] }; if (extra) Object.keys(extra).forEach(function (k) { cur[k] = extra[k]; }); out.push(cur); }
    function parrafo(txt) {
      if (!cur) nuevo('');
      frases(txt).forEach(function (f) {
        if (HECHO.test(f)) { cur.cosas.push({ hecho: may(f.replace(HECHO, '')) }); return; }
        var n = numerada(f);
        if (n) { n.intro = may(n.intro); n.pasos = n.pasos.map(may); }
        cur.cosas.push(n || { p: may(f) });
      });
    }
    lineas(s).forEach(function (l) {
      var m;
      if ((m = /^\s*[-•*]\s+(.*)$/.exec(l))) {
        if (!cur) nuevo('');
        var q = /\s*\(([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñü ]{0,30})\)\.?$/.exec(m[1]);
        cur.cosas.push(q ? { li: may(m[1].slice(0, q.index).replace(/[.:;,]$/, '')), quien: q[1] } : { li: may(m[1]) });
        return;
      }
      if ((m = /^Añadido después\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/i.exec(l))) { nuevo('Añadido después', { anadido: true, fecha: m[1] || '' }); if (m[2]) parrafo(m[2]); return; }
      if ((m = /^Cambios pedidos\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/i.exec(l))) { nuevo('Cambios pedidos', { anadido: true, cambios: true, fecha: m[1] || '' }); if (m[2]) parrafo(m[2]); return; }
      if ((m = /^([A-ZÁÉÍÓÚÑ_]+):\s*(.*)$/.exec(l)) && m[1] in APARTADOS) { nuevo(APARTADOS[m[1]]); if (m[2]) parrafo(m[2]); return; }
      parrafo(l);
    });
    return out.filter(function (x) { return x.cosas.length; });
  }
  /** El texto con sus enlaces: cada https://… se puede pulsar y se lee corto. */
  function conEnlaces(s) {
    return texto(s).replace(/https?:\/\/[^\s<]+/g, function (u) {
      var fin = /[.,;:)»]+$/.exec(u), resto = fin ? fin[0] : '';
      if (resto) u = u.slice(0, -resto.length);
      var corto = u.replace(/^https?:\/\/(www\.)?/, '');
      var pr = /^github\.com\/[^/]+\/([^/]+)\/pull\/(\d+)/.exec(corto);
      corto = pr ? pr[1] + ' #' + pr[2] : corto.length > 42 ? corto.slice(0, 40) + '…' : corto;
      return '<a href="' + u + '" target="_blank" rel="noopener">' + corto + '</a>' + resto;
    });
  }
  /** Las partes de partesTexto en HTML. */
  function htmlTexto(s) {
    return partesTexto(s).map(function (x) {
      var h = '', lista = false;
      x.cosas.forEach(function (c) {
        if (c.li != null) {
          if (!lista) { h += '<ul class="fx-lista">'; lista = true; }
          h += '<li>' + conEnlaces(c.li) + (c.quien ? ' <span class="fx-quien">' + texto(c.quien) + '</span>' : '') + '</li>';
          return;
        }
        if (lista) { h += '</ul>'; lista = false; }
        if (c.hecho != null) h += '<div class="fx-hecho"><small>Está bien hecho cuando</small><p>' + conEnlaces(c.hecho) + '</p></div>';
        else if (c.pasos) h += (c.intro ? '<p>' + conEnlaces(c.intro) + '</p>' : '') + '<ol class="fx-pasos">' + c.pasos.map(function (p) { return '<li>' + conEnlaces(p) + '</li>'; }).join('') + '</ol>';
        else h += '<p>' + conEnlaces(c.p) + '</p>';
      });
      if (lista) h += '</ul>';
      var tit = x.tit ? '<h4>' + texto(x.tit) + (x.fecha ? ' <span>' + texto(x.fecha) + '</span>' : '') + '</h4>' : '';
      return '<div class="fx-parte' + (x.anadido ? ' fx-anadido' : '') + (x.cambios ? ' fx-cambios' : '') + '">' + tit + h + '</div>';
    }).join('');
  }
  /**
   * T0439 · «Que lo haga Claude»: por qué el agente autónomo no puede coger esta tarea, con las palabras de la base
   * (preparar_autonomo, que es la que manda y además mira la fase y el tope de 3 por revisar). [] si, por lo que se ve aquí,
   * puede. o: { yo (persona), deps: [{ id, estado }] (las que espera, las que se sepan), hoy (aaaa-mm-dd), nombre(persona) }.
   * El tamaño M lo deja pasar: depende de la fase, que sabe la función del servidor.
   */
  function motivoClaude(t, o) {
    o = o || {};
    var m = [], est = t.ESTADO, desde = String(t.DISPONIBLE_DESDE || '').slice(0, 10);
    var faltan = (o.deps || []).filter(function (d) { return CERRADOS.indexOf(d.estado) < 0; }).map(function (d) { return d.id; });
    if (est !== 'En cola') {
      m.push(est === 'Esperando' && faltan.length ? 'espera a ' + faltan.join(', ')
        : est === 'Esperando' && desde && o.hoy && desde > o.hoy ? 'no se puede empezar hasta el ' + desde.split('-').reverse().join('/')
        : CERRADOS.indexOf(est) >= 0 ? 'está cerrada (' + est + ')'
        : 'está ' + est + ': el agente solo coge las que están En cola');
    }
    if (!t.HERRAMIENTA) m.push('no tiene herramienta: el agente solo hace las de Claude Code');
    else if (t.HERRAMIENTA !== 'Claude Code') m.push('se hace con ' + t.HERRAMIENTA + ': el agente solo hace las de Claude Code');
    if (!t.T) m.push('no tiene tamaño');
    else if (['XS', 'S', 'M'].indexOf(t.T) < 0) m.push('es ' + t.T + ': el agente solo hace XS y S (y M desde la fase 3)');
    if (o.yo && t.ASIGNADO && t.ASIGNADO !== o.yo) m.push('está asignada a ' + ((o.nombre && o.nombre(t.ASIGNADO)) || 'otra persona') + ': el agente solo hace las tuyas');
    return m;
  }
  /** Con qué estados sale «Que lo haga Claude» en la ficha: los de antes de empezar (en los demás ya la lleva alguien o está hecha). */
  var ANTES_DE_EMPEZAR = ['Esperando', 'En cola', 'Necesita tu respuesta', 'Bloqueada', 'Aplazada'];

  /* ---------- T0450 · Dónde se comprueba y «Verlo en DEV» ---------- */
  var APP_DEV = 'https://utilo-digital.github.io/utilo-web/dev-ramas/';
  /** Dónde lo miras, dicho para quien revisa (T0450, Javi: se lee, no se elige; lo decide Claude con las reglas). */
  var COMPROBAR = { Nada: 'no hace falta: basta la PR en verde', DEV: 'en DEV, antes de aprobar', 'Producción': 'tras publicar' };
  /** Con qué estados sale el bloque «Qué mirar» (T0450, Javi: en curso aún no hay nada que mirar): en revisión y, tras
   *  aprobarla, para lo que se mira al publicar. «Verlo en DEV», solo Para revisar: al aprobar se fusiona y sale de DEV. */
  var EN_REVISION = ['Para revisar', 'Aprobada'];
  var VER_EN_DEV = ['Para revisar'];
  /** T0462 · Las tareas sin código también tienen algo que mirar: el bloque sale en revisión aunque esté vacío (con
   *  «+ Qué mirar»), sin «Dónde lo miras» (no tienen COMPROBAR) ni «Verlo en DEV». */
  var SIN_CODIGO = ['Chat', 'Cowork'];
  /** El enlace de «Verlo en DEV»: la app «Utilo DEV» ya en la rama de la tarea, su web y su persona (VER_EN_DEV,
   *  «dev/plataforma/ como gestora@ejemplo.com»). Igual que enlaceDev de herramientas/revision.js (probar-plataforma.js
   *  comprueba que dan lo mismo). */
  function enlaceDev(id, verEnDev) {
    var s = String(verEnDev || ''), m = /^\s*(\S+?)\/?(?:\s+como\s+(\S+))?\s*$/i.exec(s);
    var v = m && s.trim() ? { ruta: m[1].replace(/^\/+/, '') + '/', como: (m[2] || '').toLowerCase() } : null;
    return APP_DEV + '?probar&tarea=' + encodeURIComponent(id) + (v ? '&web=' + encodeURIComponent(v.ruta) + (v.como ? '&como=' + encodeURIComponent(v.como) : '') : '');
  }

  /* ---------- T0466 · Qué falta por publicar ---------- */
  var PR_GITHUB = /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/;
  /**
   * Lo que le falta a una tarea Por publicar, de POR_PUBLICAR (el JSON que apunta entregar.js):
   *   { que: 'calculado', faltan: [{ donde, con: [botón] }], ya: [versión], dudas: [texto], el }
   *   { que: 'sin-pr' }        sin PR en DOCUMENTOS_RELEVANTES: se envía o se publica a mano
   *   { que: 'sin-calcular' }  aún no lo ha calculado nadie (se acaba de aprobar) o no se entiende
   */
  function porPublicar(t) {
    if (!t || !PR_GITHUB.test(String(t.DOCUMENTOS_RELEVANTES || ''))) return { que: 'sin-pr' };
    var v = null;
    try { v = t.POR_PUBLICAR ? (typeof t.POR_PUBLICAR === 'string' ? JSON.parse(t.POR_PUBLICAR) : t.POR_PUBLICAR) : null; } catch (e) { v = null; }
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { que: 'sin-calcular' };
    var l = function (x) { return Array.isArray(x) ? x : []; };
    return { que: 'calculado', el: v.el || '', ya: l(v.ya).map(String), dudas: l(v.dudas).map(String),
      faltan: l(v.faltan).filter(function (f) { return f && l(f.con).length; }).map(function (f) { return { donde: String(f.donde || ''), con: l(f.con).map(String) }; }) };
  }
  /** Un instante ISO, como dd/mm/aaaa hh:mm en la hora de quien mira ('' si no se entiende). */
  function horaLocal(iso) {
    var d = new Date(iso), z = function (n) { return ('0' + n).slice(-2); };
    return iso && !isNaN(d.getTime()) ? z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) : '';
  }
  /** La acción de GitHub de un botón, con las opciones ya puestas (boton-*.yml): solo hay que pulsar «Run workflow». '' para
   *  los de «A mano». Igual que accionDe de herramientas/entregar.js (probar-plataforma.js comprueba que dan lo mismo). */
  function enlaceBoton(b) {
    var m = /^Publicar · ([a-z0-9_-]+)\/([a-z0-9_-]+)$/.exec(b), a = m ? 'boton-publicar-' + m[1] + '-' + m[2] + '.yml' : '';
    if (!a && (m = /^Supabase · ([a-z0-9_-]+) · Producción$/.exec(b))) a = 'boton-supabase-' + m[1] + '.yml';
    return a ? 'https://github.com/UTILO-DIGITAL/utilo-apps/actions/workflows/' + a : '';
  }
  /** Un sitio que falta, como se lee: «Publicar · konamigas/nucleo», o «… o …» si vale cualquiera de sus botones. */
  function botonTexto(f) { return f.con.join(' o '); }
  /**
   * La columna «Por publicar», agrupada por lo que les falta (T0466, Javi: de un vistazo, qué saldría con cada botón):
   * [{ clave, titulo, nota, ts }], primero las que salen con un solo botón; cada tarea, en un grupo. ts en el orden recibido.
   */
  function gruposPorPublicar(ts) {
    var g = {}, orden = [];
    (ts || []).forEach(function (t) {
      var p = porPublicar(t), k, tit, nota, peso;
      if (p.que === 'sin-pr') { k = '~sin-pr'; tit = 'Sin PR: se envía o se publica a mano'; nota = 'Cuando esté, pásala a Entregada.'; peso = 90; }
      else if (p.que === 'sin-calcular') { k = '~sin-calcular'; tit = 'Calculando qué les falta'; nota = 'Sale en un minuto, al fusionar su PR.'; peso = 80; }
      else if (!p.faltan.length && p.dudas.length) { k = '~dudas'; tit = 'Algo no cuadra con su PR'; nota = 'Lo dice su ficha.'; peso = 70; }
      else if (!p.faltan.length) { k = '~ya'; tit = 'Ya están en su sitio'; nota = 'Pasan solas a Entregada con la próxima publicación.'; peso = 60; }
      else {
        var bs = p.faltan.map(botonTexto).sort();
        k = bs.join(' + '); tit = 'Con ' + bs.join(' y '); peso = bs.length;
        nota = bs.length > 1 ? 'Hacen falta las ' + (bs.length === 2 ? 'dos' : bs.length) + '; con la última, pasan a Entregada.' : 'Al acabar, pasan solas a Entregada.';
        if (bs.some(function (b) { return /^A mano/.test(b); })) { nota = 'Lo de «A mano» se le pide a Claude.'; peso += 10; } // después de las de botón
      }
      if (!g[k]) { g[k] = { clave: k, titulo: tit, nota: nota, peso: peso, ts: [] }; orden.push(g[k]); }
      g[k].ts.push(t);
    });
    return orden.sort(function (a, b) { return a.peso - b.peso || a.clave.localeCompare(b.clave); });
  }

  var CALC = { frases: frases, numerada: numerada, partesTexto: partesTexto, htmlTexto: htmlTexto, conEnlaces: conEnlaces, motivoClaude: motivoClaude, ANTES_DE_EMPEZAR: ANTES_DE_EMPEZAR,
    enlaceDev: enlaceDev, COMPROBAR: COMPROBAR, EN_REVISION: EN_REVISION, VER_EN_DEV: VER_EN_DEV, SIN_CODIGO: SIN_CODIGO,
    porPublicar: porPublicar, gruposPorPublicar: gruposPorPublicar, enlaceBoton: enlaceBoton };
  // En las pruebas (node, sin navegador), solo las cuentas.
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

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
        // T0422 (decidido por Javi, como en Entregas): buscar y «Filtros» en una línea; las columnas y los filtros, en una hoja
        // con botones; sin ↻ (el tablero va en directo); crear, con el + flotante.
        '<div class="filtros tb-fil">' +
          '<label class="busca"><span class="u-oculto">Buscar tareas</span><input type="search" id="kb-busca" placeholder="Buscar tareas" autocomplete="off"></label>' +
          '<button id="kb-fil" class="sec en-filtros" type="button" aria-haspopup="dialog">' + ICO_FILTROS + '<span>Filtros</span><span id="kb-fil-n" class="k-fil-n" hidden></span></button>' +
        '</div>' +
        '<div id="kb-tab" class="tablero"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        (SOLO_LEE ? '' : '<button id="alta-btn" class="en-mas" type="button" aria-label="Nueva tarea" title="Nueva tarea"><span class="en-mas-mas" aria-hidden="true">+</span><span class="en-mas-t">Nueva tarea</span></button>') +
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

      // T0423: en los de «varias» se eligen varias opciones (una lista; sin ninguna, todas).
      var FILTROS = [
        { k: 'INICIATIVA', t: 'Iniciativa', buscar: 'Buscar iniciativa', vs: function () { return ctx.tablas.filas(TI).map(function (i) { return [i.ID, i.NOMBRE || i.ID]; }); } },
        { k: 'ENTREGA', t: 'Entrega', buscar: 'Buscar entrega', vs: function () {
          // Con iniciativas elegidas, solo sus entregas. Las entregadas y descartadas no salen a la vista: se buscan.
          var ini = lista(F.INICIATIVA), usadas = {};
          tareas().forEach(function (t) { if (t.ENTREGA && (!ini.length || ini.indexOf(t.INICIATIVA) >= 0)) usadas[t.ENTREGA] = t.ENTREGA_CORTA || t.ENTREGA; });
          var es = ctx.tablas.filas(TE).filter(function (e) { return usadas[e.ID]; }).sort(function (a, b) {
            return (CERRADOS.indexOf(a.ESTADO) >= 0) - (CERRADOS.indexOf(b.ESTADO) >= 0) || String(a.INICIATIVA).localeCompare(String(b.INICIATIVA)) || Number(b.NUMERO) - Number(a.NUMERO);
          });
          return [['-', 'Sin entrega']].concat(es.map(function (e) { return [e.ID, usadas[e.ID] + ' · ' + (e.NOMBRE || ''), CERRADOS.indexOf(e.ESTADO) >= 0]; }));
        } },
        { k: 'PERSONA', t: 'Persona', buscar: 'Buscar persona', vs: function () {
          return Object.keys(GENTE).map(function (id) { return [id, GENTE[id]]; }).sort(function (a, b) { return a[1].localeCompare(b[1]); });
        } },
        { k: 'EPICA', t: 'Épica', buscar: 'Buscar épica', vs: function () {
          var vs = []; tareas().forEach(function (t) { if (t.EPICA && vs.indexOf(t.EPICA) < 0) vs.push(t.EPICA); });
          return vs.sort().map(function (v) { return [v, v]; });
        } },
        { k: 'P', t: 'Prioridad', vs: function () { return ['!!!!', '!!!', '!!', '!'].map(function (v) { return [v, v]; }); } },
        // T0319: las que puede hacer el agente autónomo (en la tarjeta, el robot junto al ID).
        { k: 'AUTONOMA', t: 'Agente autónomo', vs: function () { return [['si', 'Autónomas'], ['no', 'No autónomas']]; } }
      ];
      FILTROS.forEach(function (f) { F[f.k] = lista(F[f.k]); }); // lo guardado antes de T0423, un texto
      /** T0422 · Los filtros, en una hoja que sube desde abajo (como en Entregas): las columnas, cada filtro y las cerradas, en
       *  botones. Cambian el tablero al momento; «Ver N tareas» cierra. T0423: la hoja, con atenderHoja (igual en Entregas). */
      var DIAS_OP = [7, 30, 90], ABIERTOS = {};
      function pintarFiltros() { cuenta(); if (altaVelo.classList.contains('en-hoja')) repintarHoja(altaForm, pintarHoja, ''); }
      function cuenta() {
        var k = FILTROS.filter(function (f) { return lista(F[f.k]).length; }).length + (F.dias !== DIAS ? 1 : 0);
        var s = $('kb-fil-n'); s.textContent = k ? String(k) : ''; s.hidden = !k;
        $('kb-fil').title = k ? k + (k === 1 ? ' filtro puesto' : ' filtros puestos') : 'Sin filtros';
        return k;
      }
      function pintarHoja() {
        var n = tareas().filter(pasa).length, dias = DIAS_OP.indexOf(DIAS) < 0 ? DIAS_OP.concat([DIAS]).sort(function (a, b) { return a - b; }) : DIAS_OP;
        if (dias.indexOf(F.dias) < 0) dias = dias.concat([F.dias]).sort(function (a, b) { return a - b; });
        altaForm.innerHTML = '<div class="en-hoja-cab"><h2>Filtros</h2><button type="button" class="en-hoja-x" data-cancelar-alta aria-label="Cerrar" title="Cerrar">' + ICO_CERRAR + '</button></div>' +
          grupoHoja({ k: 'vista', t: 'Columnas', vs: Object.keys(VISTAS).map(function (k) { return [k, VISTAS[k].titulo]; }), sel: F.vista }) +
          FILTROS.map(function (f) {
            var vs = f.vs();
            return vs.length ? grupoHoja({ k: f.k, t: f.t, vs: vs, sel: F[f.k], varias: true, abierto: ABIERTOS[f.k], buscar: f.buscar }) : '';
          }).join('') +
          grupoHoja({ k: 'dias', t: 'Entregadas y descartadas', vs: dias.map(function (d) { return [d, 'Últimos ' + d + ' días']; }), sel: F.dias }) +
          '<div class="botones"><button type="button" class="sec" data-quitar-filtros' + (cuenta() ? '' : ' disabled') + '>Quitar filtros</button>' +
          '<button type="submit" class="pri">' + (n === 1 ? 'Ver 1 tarea' : 'Ver ' + n + ' tareas') + '</button></div>';
      }
      function abrirHoja() {
        Object.keys(ABIERTOS).forEach(function (k) { delete ABIERTOS[k]; });
        pintarHoja();
        altaForm.onsubmit = function (ev) { ev.preventDefault(); cerrarVelo(); };
        altaVelo.classList.add('en-hoja');
        abrirVelo();
        var b = altaForm.querySelector('.en-chip[aria-pressed=true]'); if (b) b.focus();
      }
      $('kb-fil').onclick = abrirHoja;
      atenderHoja(altaForm, altaVelo, {
        abiertos: ABIERTOS, pintar: pintarHoja,
        elegir: function (k, v) {
          if (k === 'vista') F.vista = v;
          else if (k === 'dias') F.dias = Number(v);
          else {
            F[k] = elegirEn(F[k], v, true);
            // Otras iniciativas: fuera las entregas elegidas que no son suyas.
            if (k === 'INICIATIVA' && F.INICIATIVA.length) F.ENTREGA = F.ENTREGA.filter(function (id) { var e = id === '-' ? null : ctx.tablas.fila(TE, id); return !e || F.INICIATIVA.indexOf(e.INICIATIVA) >= 0; });
          }
          guardarLocal(CLAVE + '_f', F); pintarTablero(); cuenta();
        },
        quitar: function () { FILTROS.forEach(function (f) { F[f.k] = []; }); F.dias = DIAS; guardarLocal(CLAVE + '_f', F); pintarTablero(); cuenta(); }
      });
      var tBusca = 0;
      $('kb-busca').addEventListener('input', function () { var v = this.value; clearTimeout(tBusca); tBusca = setTimeout(function () { F.busca = v.trim().toLowerCase(); pintarTablero(); }, 120); });

      function pasa(t) {
        if (F.busca) {
          var hay = [t.ID, t.TITULO, t.DESCRIPCION, t.EPICA, t.ENTREGA_CORTA, enManos(t), nombre(t.ASIGNADO)].join(' ').toLowerCase();
          return F.busca.split(/\s+/).every(function (p) { return hay.indexOf(p) >= 0; });
        }
        var en = function (k, v) { return !F[k].length || F[k].indexOf(String(v)) >= 0; }; // T0423: cualquiera de las elegidas
        if (!en('INICIATIVA', t.INICIATIVA) || !en('ENTREGA', t.ENTREGA || '-') || !en('EPICA', t.EPICA) || !en('P', t.P) || !en('AUTONOMA', t.AUTONOMA ? 'si' : 'no')) return false;
        if (F.PERSONA.length && ![t.EN_MANOS_TIPO === 'persona' ? t.EN_MANOS_DE : '', t.ASIGNADO, t.PIDE, t.REVISA].some(function (p) { return p && F.PERSONA.indexOf(String(p)) >= 0; })) return false;
        if (CERRADOS.indexOf(t.ESTADO) >= 0) { var d = dias(t.FECHA_CIERRE); return d === null || -d <= F.dias; }
        return true;
      }

      /* ---------- tablero ---------- */

      /** Primero lo urgente (!!!!) y lo que vence en 7 días, después la prioridad, la fecha límite y la más antigua (como la 4.x).
       *  T0319 (decidido por Javi): lo urgente es la prioridad !!!!; la casilla Urgente ya no existe. */
      function ordenar(ts, cerradas) {
        if (cerradas) return ts.sort(function (a, b) { return String(b.FECHA_CIERRE || '').localeCompare(String(a.FECHA_CIERRE || '')) || String(b.ID).localeCompare(String(a.ID)); });
        var dl = function (t) { var d = dias(t.DEADLINE); return d === null ? 1e9 : d; };
        var ur = function (t) { return t.P === '!!!!' || dl(t) <= 7 ? 1 : 0; };
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
        if (col.estados.length > 1) x.push('<div class="x"><b>' + texto(nom(t.ESTADO)) + '</b></div>');
        if (t.ESTADO === 'Necesita tu respuesta' && t.PREGUNTA) x.push('<div class="x">Pregunta: ' + texto(t.PREGUNTA) + '</div>');
        if (t.ESTADO === 'Aplazada' && t.REVISAR_EL) x.push('<div class="x">Se vuelve a mirar el ' + fechaEs(t.REVISAR_EL) + '</div>');
        // T0449: con cambios pedidos que nadie ha cogido todavía.
        if (t.CAMBIOS_PEDIDOS && (t.ESTADO === 'En cola' || t.ESTADO === 'Esperando')) x.push('<div class="x tb-cambios">Cambios pedidos</div>');
        if (CERRADOS.indexOf(t.ESTADO) >= 0) { if (t.FECHA_CIERRE) x.push('<div class="x">Cerrada el ' + fechaEs(t.FECHA_CIERRE) + '</div>'); }
        else {
          var d = dias(t.DEADLINE);
          if (d !== null) x.push('<div class="x' + (d < 0 ? ' venc' : '') + '">' + (d < 0 ? 'Vencida: ' : d === 0 ? 'Vence hoy: ' : 'Vence el ') + fechaEs(t.DEADLINE) + '</div>');
        }
        if (t._nueva) id = '';
        var pasos = PASOS[t.ESTADO] || [], puede = id && !SOLO_LEE && !t._pendiente && pasos.length;
        var mover = TACTIL && puede ? '<div class="mover"><span>Estado</span><select data-mover="' + texto(id) + '" aria-label="Estado de ' + texto(id) + '">' +
          [t.ESTADO].concat(pasos).map(function (e) { return '<option value="' + texto(e) + '"' + (e === t.ESTADO ? ' selected' : '') + '>' + texto(nom(e)) + '</option>'; }).join('') + '</select></div>' : '';
        return '<div class="card ' + cls(t.ESTADO) + '-b' + (t._pendiente ? ' guardando' : '') + '"' + (puede && !TACTIL ? ' draggable="true"' : '') + ' data-id="' + texto(id) + '">' +
          '<a class="card-link" href="?s=' + texto(ctx.id.toLowerCase()) + '&amp;t=' + encodeURIComponent(id) + '" data-abrir="' + texto(id) + '">' +
          '<div class="top"><span class="id">' + (id ? texto(id) : 'Creando…') + (t.AUTONOMA ? ICO_AUTO : '') /* también en las cerradas: si no, con el filtro de autónomas no se ve en ninguna (Javi) */ + '</span>' +
          (t.ENTREGA_CORTA ? '<span class="u-chip" title="Entrega">' + texto(t.ENTREGA_CORTA) + '</span>' : '') + (t._pendiente ? '<span class="u-chip">Guardando</span>' : '') + '</div>' +
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
            '<div class="lista">' + (!ts.length ? '<div class="vacio">Ninguna tarea con estos filtros.</div>'
              // T0466: Por publicar, agrupadas por los botones que les faltan.
              : c.estados.length === 1 && c.estados[0] === 'Aprobada' ? gruposPorPublicar(ts).map(function (g) {
                return '<div class="tb-pp" title="' + texto(g.nota) + '"><b>' + texto(g.titulo) + '</b><span>' + texto(g.nota) + '</span></div>' +
                  g.ts.map(function (t) { return tarjeta(t, c); }).join('');
              }).join('')
              : ts.map(function (t) { return tarjeta(t, c); }).join('')) + '</div></section>';
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
          (de === 'Para revisar' || de === 'Aprobada') && a === 'En cola' ? 'cambios' : '';
      }
      function mover(id, nuevo) {
        var t = tarea(id);
        if (!t || t.ESTADO === nuevo) return;
        if ((PASOS[t.ESTADO] || []).indexOf(nuevo) < 0) {
          ctx.aviso(CERRADOS.indexOf(t.ESTADO) >= 0 ? id + ' está ' + t.ESTADO.toLowerCase() + ': no se reabre. Si hace falta más, crea otra que espere a esta.' :
            'De ' + nom(t.ESTADO) + ' no se pasa a ' + nom(nuevo) + (PASOS[t.ESTADO] ? ': puede ir a ' + PASOS[t.ESTADO].map(nom).join(', ') + '.' : '.'));
          pintarTablero(); if (abiertaId) pintarFicha(); return;
        }
        // T0440: a Por publicar se llega con Aprobar (mira y fusiona su PR): se abre la ficha y se mira la PR.
        if (t.ESTADO === 'Para revisar' && nuevo === 'Aprobada') {
          pintarTablero();
          if (abiertaId !== id) abrirFicha(id); else pintarFicha();
          pedirAprobar(id, true);
          return;
        }
        // T0462: una de Chat o Cowork sin qué mirar lo pide al pasar a Para revisar (la base no la deja pasar sin él).
        var q = faltaQueMirar(t, nuevo) ? 'quemirar' : pide(t.ESTADO, nuevo);
        if (q) { pedirDatos(t, nuevo, q); pintarTablero(); if (abiertaId) pintarFicha(); return; }
        enviar(t, nuevo, {});
      }
      /** T0462 · Las de Chat y Cowork no pasan a Para revisar sin QUE_MIRAR: se pide en la ventanita, como el motivo. */
      function faltaQueMirar(t, nuevo) {
        return nuevo === 'Para revisar' && SIN_CODIGO.indexOf(t.HERRAMIENTA) >= 0 && !String(t.QUE_MIRAR || '').trim();
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
        var tit = { bloqueo: 'Bloquear ' + id, pregunta: 'Preguntar a quien la pidió', aplazar: 'Aplazar ' + id, descartar: 'Descartar ' + id, cambios: 'Pedir cambios en ' + id, quemirar: 'Qué mirar en ' + id }[q];
        var ayuda = { bloqueo: 'Pasa a Bloqueada: la mueve alguien de fuera o algo técnico.', pregunta: 'Pasa a Necesita tu respuesta, en manos de ' + (nombre(t.PIDE) || 'quien la pidió') + '.',
          aplazar: 'Nadie la mueve hasta esa fecha; entonces se decide.', descartar: 'Se cierra y no se reabre. Las que la esperan dejan de esperarla.',
          cambios: AYUDA_CAMBIOS, quemirar: 'Pasa a Para revisar. Di qué tiene que mirar quien la revisa: qué partes son nuevas, qué decisión espera.' }[q];
        if (q === 'bloqueo') h = '<div class="campo"><label class="lab" for="tb-d-mb">Por qué</label><select id="tb-d-mb" required><option value="">Elige…</option>' +
          MOTIVOS_BLOQUEO.map(function (m) { return '<option>' + texto(m) + '</option>'; }).join('') + '</select></div>' +
          '<div class="campo"><label class="lab" for="tb-d-mo">Qué pasa <span class="opc">(opcional)</span></label><textarea id="tb-d-mo" rows="2"></textarea></div>';
        if (q === 'pregunta') h = '<div class="campo"><label class="lab" for="tb-d-pr">La pregunta, concreta</label><textarea id="tb-d-pr" rows="3" required></textarea></div>';
        if (q === 'aplazar') h = '<div class="campo"><label class="lab" for="tb-d-re">Se vuelve a mirar el</label><input type="date" id="tb-d-re" min="' + hoyISO() + '" required></div>' +
          '<div class="campo"><label class="lab" for="tb-d-mo">Por qué <span class="opc">(opcional)</span></label><textarea id="tb-d-mo" rows="2"></textarea></div>';
        if (q === 'descartar') h = '<div class="campo"><label class="lab" for="tb-d-mo">Por qué se descarta</label><textarea id="tb-d-mo" rows="3" required></textarea></div>';
        if (q === 'quemirar') h = '<div class="campo"><label class="lab" for="tb-d-qm">Qué mirar</label><textarea id="tb-d-qm" rows="4" required ' +
          'placeholder="1) El apartado 3 es nuevo.&#10;2) Decide si va el precio."></textarea></div>';
        if (q === 'cambios') h = '<div class="campo"><label class="lab" for="tb-d-ca">Qué hay que cambiar</label><textarea id="tb-d-ca" rows="4" required></textarea></div>';
        altaForm.innerHTML = '<h2>' + texto(tit) + '</h2><p class="u-nota">' + texto(ayuda) + '</p><div class="edit">' + h + '</div><div id="alta-error" role="alert"></div>' +
          '<div class="botones"><button type="button" class="sec" data-cancelar-alta>Cancelar</button><button type="submit" class="pri">' + texto(q === 'cambios' ? 'Pedir cambios' : 'Pasar a ' + nuevo) + '</button></div>';
        abrirVelo();
        altaForm.onsubmit = function (e) {
          e.preventDefault();
          var v = function (i) { var x = altaForm.querySelector('#' + i); return x ? x.value.trim() : ''; };
          var x = { motivo_bloqueo: v('tb-d-mb'), pregunta: v('tb-d-pr'), revisar_el: v('tb-d-re'), motivo: v('tb-d-mo') };
          var mal = q === 'bloqueo' && !x.motivo_bloqueo ? 'Elige por qué está bloqueada.' : q === 'pregunta' && !x.pregunta ? 'Escribe la pregunta.' :
            q === 'aplazar' && !x.revisar_el ? 'Pon la fecha en que se vuelve a mirar.' : q === 'aplazar' && x.revisar_el < hoyISO() ? 'La fecha ya ha pasado.' :
            q === 'descartar' && !x.motivo ? 'Di por qué se descarta.' : q === 'cambios' && !v('tb-d-ca') ? 'Di qué hay que cambiar.' : q === 'quemirar' && !v('tb-d-qm') ? 'Di qué tiene que mirar quien la revisa.' : '';
          if (mal) { var er = altaForm.querySelector('#alta-error'); er.textContent = mal; er.style.display = 'block'; return; }
          cerrarVelo();
          if (q === 'cambios') pedirCambios(String(t.ID), v('tb-d-ca'));
          else if (q === 'quemirar') guardarYEnviar(t, nuevo, { QUE_MIRAR: v('tb-d-qm') });
          else enviar(t, nuevo, x);
        };
      }
      /** T0462 · Primero el qué mirar y, guardado, el estado (si no se guarda, no se mueve). */
      function guardarYEnviar(t, nuevo, cambios) {
        var id = String(t.ID), antes = {};
        Object.keys(cambios).forEach(function (k) { antes[k] = t[k] == null ? '' : t[k]; });
        ctx.tablas.actualizar(T, id, cambios, { fn: 'tablasActualizar', args: ['TAREAS', id, cambios, { antes: antes }] })
          .then(function () { enviar(tarea(id) || t, nuevo, {}); }, function () {});
      }
      function abrirVelo() {
        altaVelo.classList.add('abierto');
        document.documentElement.classList.add('fv-abierta');
        var p = altaForm.querySelector('input,textarea,select'); if (p) p.focus();
      }
      function cerrarVelo() { altaVelo.classList.remove('abierto', 'en-hoja'); if (!abiertaId) document.documentElement.classList.remove('fv-abierta'); altaForm.onsubmit = null; }
      altaVelo.addEventListener('click', function (e) { if (e.target === altaVelo || e.target.closest('[data-cancelar-alta]')) cerrarVelo(); });
      altaVelo.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); cerrarVelo(); } });

      /* ---------- formulario: crear y editar ---------- */

      function opciones(vs, v, vacio) {
        return (vacio !== false ? '<option value="">' + texto(vacio || 'Elige…') + '</option>' : '') +
          vs.map(function (x) { return '<option value="' + texto(x[0]) + '"' + (x[0] === v ? ' selected' : '') + '>' + texto(x[1]) + '</option>'; }).join('');
      }
      /** T0420: las épicas que ya tienen las tareas (y v, si es otra), por orden, para un desplegable. */
      var OTRA = '__otra';
      function epicasCon(v) {
        var ep = []; tareas().forEach(function (x) { if (x.EPICA && ep.indexOf(x.EPICA) < 0) ep.push(x.EPICA); });
        if (v && v !== OTRA && ep.indexOf(v) < 0) ep.push(v);
        return ep.sort().map(function (e) { return [e, e]; });
      }
      function gentes() { return Object.keys(GENTE).map(function (k) { return [k, GENTE[k]]; }).sort(function (a, b) { return a[1].localeCompare(b[1]); }); }
      function entregasDe(ini) {
        // T0417: a una entrega Entregada o Descartada no se le añaden tareas (lo dice la base).
        return ctx.tablas.filas(TE).filter(function (e) { return e.INICIATIVA === ini && e.ESTADO !== 'Entregada' && e.ESTADO !== 'Descartada'; })
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
        var ini = t.INICIATIVA;
        var deps = nueva ? (t._deps || []) : esperaA(String(t.ID));
        var cand = tareas().filter(function (x) { return CERRADOS.indexOf(x.ESTADO) < 0 && !x._nueva && String(x.ID) !== String(t.ID || ''); })
          .sort(function (a, b) { return String(b.ID).localeCompare(String(a.ID)); });
        var val = function (k) { return t[k] == null ? '' : String(t[k]); };
        return campo('TITULO', 'Título', '<input type="text" id="tb-f-TITULO" value="' + texto(val('TITULO')) + '" required autocomplete="off" data-limite="60">', false,
            '<span class="contador" data-cuenta="tb-f-TITULO">' + val('TITULO').length + ' / 60</span> · Empieza por un verbo y di qué se entrega.') +
          campo('DESCRIPCION', 'Qué hay que hacer', '<textarea id="tb-f-DESCRIPCION" rows="4" required>' + texto(val('DESCRIPCION')) + '</textarea>', false, 'Tal cual lo pide quien lo pide.') +
          campo('INICIATIVA', 'Iniciativa', '<select id="tb-f-INICIATIVA" required>' + opciones(ctx.tablas.filas(TI).map(function (i) { return [i.ID, i.NOMBRE || i.ID]; }), ini) + '</select>') +
          campo('ENTREGA', 'Entrega', '<select id="tb-f-ENTREGA">' + opciones(entregasDe(ini), val('ENTREGA'), 'Sin entrega') + '</select>', true) +
          campo('EPICA', 'Épica', '<select id="tb-f-EPICA">' + opciones(epicasCon(val('EPICA')), val('EPICA'), 'Sin épica') + '<option value="' + OTRA + '">Otra épica…</option></select>' +
            '<input type="text" id="tb-f-EPICA-nueva" autocomplete="off" placeholder="Nombre de la épica nueva" aria-label="Épica nueva" hidden>' +
            (nueva ? '<div class="ayuda" id="tb-f-EPICA-sug" hidden>La que más llevan las tareas de esta entrega. Puedes cambiarla.</div>' : ''), true) +
          campo('ASIGNADO', 'Asignada a', '<select id="tb-f-ASIGNADO" required>' + opciones(gentes(), val('ASIGNADO')) + '</select>') +
          campo('REVISA', 'La revisa', '<select id="tb-f-REVISA">' + opciones(gentes(), val('REVISA'), nueva ? 'La misma persona' : 'Elige…') + '</select>', nueva) +
          campo('P', 'Prioridad', '<select id="tb-f-P" required>' + opciones(['!!!!', '!!!', '!!', '!'].map(function (x) { return [x, x]; }), val('P'), nueva ? 'Elige…' : false) + '</select>') +
          campo('T', 'Tamaño', '<select id="tb-f-T" required>' + opciones(['XS', 'S', 'M', 'L', 'XL'].map(function (x) { return [x, x]; }), val('T'), nueva ? 'Elige…' : false) + '</select>') +
          campo('DEADLINE', 'Fecha límite', '<input type="date" id="tb-f-DEADLINE" value="' + texto(val('DEADLINE')) + '">', true) +
          campo('DISPONIBLE_DESDE', 'No empezar antes del', '<input type="date" id="tb-f-DISPONIBLE_DESDE" value="' + texto(val('DISPONIBLE_DESDE')) + '">', true, 'Hasta ese día espera, y luego pasa sola a la cola.') +
          campo('DEPENDE', 'Espera a', '<div class="deps" data-deps="' + texto(deps.join(',')) + '">' + deps.map(chipDep).join('') + '</div>' +
            '<select id="tb-f-DEPENDE" data-anadir-dep><option value="">Añadir una tarea…</option>' + cand.map(function (x) { return '<option value="' + texto(x.ID) + '">' + texto(x.ID + ' · ' + x.TITULO) + '</option>'; }).join('') + '</select>', true,
            'Mientras alguna no esté entregada o descartada, esta espera.') +
          campo('HERRAMIENTA', 'Herramienta', '<select id="tb-f-HERRAMIENTA">' + opciones(HERRAMIENTAS.map(function (x) { return [x, x]; }), val('HERRAMIENTA'), 'Sin decidir') + '</select>', true) +
          '<div class="campo"><label><input type="checkbox" id="tb-f-AUTONOMA"' + (t.AUTONOMA ? ' checked' : '') + '> La puede hacer sola el agente autónomo</label>' +
          '<div class="ayuda">La coge la acción «Autónomo» cuando está En cola.</div></div>' +
          campo('DOCUMENTOS_RELEVANTES', 'Documentos', '<textarea id="tb-f-DOCUMENTOS_RELEVANTES" rows="3">' + texto(val('DOCUMENTOS_RELEVANTES')) + '</textarea>', true, 'Uno por línea: «Nombre: enlace».') +
          (nueva ? '' : campo('CONCLUSIONES', 'Conclusiones', '<textarea id="tb-f-CONCLUSIONES" rows="3">' + texto(val('CONCLUSIONES')) + '</textarea>', true)) +
          '<div class="campo"><label><input type="checkbox" id="tb-f-PUBLICAR"' + (t.PUBLICAR ? ' checked' : '') + '> Al aprobarla, hay que publicarla o enviarla</label>' +
          '<div class="ayuda">Si no, al aprobarla pasa sola a Entregada.</div></div>';
      }
      /** T0074: en Nueva tarea, la épica de la entrega elegida, si quien crea la tarea no ha elegido otra. */
      function sugerirEpica(f) {
        var s = f.querySelector('#tb-f-EPICA'), a = f.querySelector('#tb-f-EPICA-sug');
        if (!s || !a) return;
        var antes = s.getAttribute('data-sugerida') || '';
        if (s.value && s.value !== antes) return; // la ha elegido quien la crea (o viene del filtro): no se toca
        var v = epicaSugerida(tareas(), f.querySelector('#tb-f-ENTREGA').value); // está en el desplegable: sale de las mismas tareas
        s.value = v;
        s.setAttribute('data-sugerida', v);
        a.hidden = !v;
      }
      /** Contador del título, entregas según la iniciativa, la épica sugerida y «espera a». */
      function vivo(f) {
        f.addEventListener('input', function (e) {
          var l = e.target.getAttribute && e.target.getAttribute('data-limite');
          if (!l) return;
          var k = f.querySelector('[data-cuenta="' + e.target.id + '"]'), n = e.target.value.trim().replace(/\.+$/, '').length;
          k.textContent = n + ' / ' + l; k.classList.toggle('mal', n > Number(l));
        });
        f.addEventListener('change', function (e) {
          if (e.target.id === 'tb-f-INICIATIVA') { f.querySelector('#tb-f-ENTREGA').innerHTML = opciones(entregasDe(e.target.value), '', 'Sin entrega'); sugerirEpica(f); return; }
          if (e.target.id === 'tb-f-ENTREGA') { sugerirEpica(f); return; }
          if (e.target.id === 'tb-f-EPICA') { var sg = f.querySelector('#tb-f-EPICA-sug'); if (sg) sg.hidden = true; var en = f.querySelector('#tb-f-EPICA-nueva'); en.hidden = e.target.value !== OTRA; if (!en.hidden) en.focus(); return; }
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
        if (o.EPICA === OTRA) { var en = f.querySelector('#tb-f-EPICA-nueva'); o.EPICA = en ? en.value.trim().toUpperCase() : ''; }
        o.PUBLICAR = f.querySelector('#tb-f-PUBLICAR').checked;
        o.AUTONOMA = f.querySelector('#tb-f-AUTONOMA').checked;
        var d = f.querySelector('[data-deps]'), deps = d && d.getAttribute('data-deps') ? d.getAttribute('data-deps').split(',').filter(String) : [];
        if (!o.TITULO) mal.push('Título: falta.');
        else if (o.TITULO.length > 60) mal.push('Título: pasa de 60 caracteres.');
        if (!o.DESCRIPCION) mal.push('Qué hay que hacer: falta.');
        if (!o.INICIATIVA) mal.push('Iniciativa: falta.');
        if (!o.ASIGNADO) mal.push('Asignada a: falta.');
        if (!o.P) mal.push('Prioridad: falta.');
        if (!o.T) mal.push('Tamaño: falta.');
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
        // T0423: con una sola opción elegida en un filtro, la tarea nueva la lleva. T0074: prioridad, tamaño y asignada no vienen
        // puestas (se eligen, para que nadie deje un !! o una S sin pensarlo); la épica, la de la entrega si no hay filtro.
        var una = function (k) { return F[k].length === 1 && F[k][0] !== '-' ? F[k][0] : ''; };
        var dflt = { INICIATIVA: una('INICIATIVA') || (ctx.tablas.fila(TI, 'UTILO') ? 'UTILO' : ((ctx.tablas.filas(TI)[0] || {}).ID || '')), ENTREGA: una('ENTREGA'),
          EPICA: una('EPICA'), P: una('P'), PUBLICAR: false };
        altaForm.innerHTML = '<h2>Nueva tarea</h2><div class="edit">' + htmlCampos(dflt, true) + '</div><div id="alta-error" role="alert"></div>' +
          '<div class="botones"><button type="button" class="sec" data-cancelar-alta>Cancelar</button><button type="submit" class="pri">Crear tarea</button></div>';
        sugerirEpica(altaForm);
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

      var LARGO = { DESCRIPCION: 6, DOCUMENTOS_RELEVANTES: 4, CONCLUSIONES: 4, QUE_MIRAR: 3 }; // textos de varias líneas: se guardan con «Guardar»
      var epicaNueva = false; // T0420: en la ficha, se está escribiendo una épica que aún no existe
      function ocupado() { return editando || !!cambiando; }
      function puedeCambiar(t) { return !SOLO_LEE && !t._nueva && CERRADOS.indexOf(t.ESTADO) < 0; }
      /** Los atributos de un dato que se cambia pulsándolo (nada si no se puede). */
      function pulsa(t, k, tit) { return puedeCambiar(t) ? ' data-ed="' + k + '" tabindex="0" title="' + texto((tit ? tit + ': ' : '') + 'pulsa para cambiar') + '"' : (tit ? ' title="' + texto(tit) + '"' : ''); }
      /** El control con el que se cambia k. */
      function control(t, k) {
        var v = t[k] == null ? '' : String(t[k]), lab = ' aria-label="' + texto(ETIQUETA[k] || k) + '"', vs, vacio = false;
        if (k === 'TITULO') return '<input type="text" id="fed" autocomplete="off" value="' + texto(v) + '"' + lab + '>';
        // T0420: la épica, con desplegable como las demás etiquetas; «Otra épica…» deja escribir una nueva.
        if (k === 'EPICA' && epicaNueva) return '<input type="text" id="fed" autocomplete="off" value="" placeholder="Nombre de la épica nueva" aria-label="Épica nueva">';
        if (k === 'DEADLINE' || k === 'DISPONIBLE_DESDE') return '<input type="date" id="fed" value="' + texto(v) + '"' + lab + '>';
        if (LARGO[k]) return '<textarea id="fed" rows="' + LARGO[k] + '"' + lab + '>' + texto(v) + '</textarea>' +
          '<div class="pie"><button type="button" class="sec" data-fed-no>Cancelar</button><button type="button" class="accion" data-fed-ok>Guardar</button></div>';
        var o = opcionesDe(t, k);
        if (k === 'DEPENDE') return '<select id="fed" aria-label="Añadir una tarea a la que espera">' + opciones(o.vs, '', o.vacio) + '</select>';
        return '<select id="fed"' + lab + '>' + opciones(o.vs, o.v, o.vacio) + '</select>';
      }
      /** Los datos que se eligen de una lista (en el ordenador, un desplegable; en el móvil, la ventanita de elegir). */
      var DE_LISTA = { INICIATIVA: 1, ENTREGA: 1, EPICA: 1, ASIGNADO: 1, REVISA: 1, P: 1, T: 1, DEPENDE: 1, AUTONOMA: 1 };
      /** Las opciones de un dato de lista: { vs: [[valor, texto]], v: el de ahora, vacio: el texto de la opción vacía o false }. */
      function opcionesDe(t, k) {
        var v = t[k] == null ? '' : String(t[k]), vs = [], vacio = false;
        if (k === 'DEPENDE') {
          var ya = esperaA(String(t.ID));
          vs = tareas().filter(function (x) { return CERRADOS.indexOf(x.ESTADO) < 0 && !x._nueva && String(x.ID) !== String(t.ID) && ya.indexOf(String(x.ID)) < 0; })
            .sort(function (a, b) { return String(b.ID).localeCompare(String(a.ID)); }).map(function (x) { return [String(x.ID), x.ID + ' · ' + x.TITULO]; });
          return { vs: vs, v: '', vacio: 'Elige la tarea…' };
        }
        if (k === 'INICIATIVA') vs = ctx.tablas.filas(TI).map(function (i) { return [i.ID, i.NOMBRE || i.ID]; });
        else if (k === 'ENTREGA') { vs = entregasDe(t.INICIATIVA); if (v && !vs.some(function (x) { return x[0] === v; })) vs.unshift([v, t.ENTREGA_CORTA || v]); vacio = 'Sin entrega'; }
        // T0420: la épica, de la lista de las que ya hay; la última opción, «Otra épica…», deja escribir una nueva.
        else if (k === 'EPICA') { vs = epicasCon(v).concat([[OTRA, 'Otra épica…']]); vacio = 'Sin épica'; }
        else if (k === 'ASIGNADO') vs = gentes();
        else if (k === 'REVISA') { vs = gentes(); vacio = 'Nadie'; }
        else if (k === 'P') vs = ['!!!!', '!!!', '!!', '!'].map(function (x) { return [x, x]; });
        else if (k === 'T') vs = ['XS', 'S', 'M', 'L', 'XL'].map(function (x) { return [x, x]; });
        // T0319: autónoma, sí o no (en la base es verdadero o falso).
        else if (k === 'AUTONOMA') { vs = [['si', 'Sí, la puede hacer sola'], ['no', 'No']]; v = t.AUTONOMA ? 'si' : 'no'; }
        if (!vacio && !v) vacio = 'Elige…';
        return { vs: vs, v: v, vacio: vacio };
      }
      /**
       * T0417 · En el móvil, un dato de lista se elige en una ventanita con una opción por botón, no con el desplegable del
       * navegador: en algunos móviles no se abría o no dejaba elegir, y además salía arriba del todo, lejos de donde se tocó.
       */
      function elegir(k) {
        var t = tarea(abiertaId);
        if (!t) return;
        var o = opcionesDe(t, k), dep = k === 'DEPENDE';
        var vs = (o.vacio && !dep && o.vacio !== 'Elige…' ? [['', o.vacio]] : []).concat(o.vs);
        altaForm.innerHTML = '<h2 data-k="' + texto(k) + '">' + texto(dep ? 'Espera a…' : ETIQUETA[k] || k) + '</h2>' +
          (vs.length ? '<div class="tb-elegir" role="listbox" aria-label="' + texto(ETIQUETA[k] || k) + '">' + vs.map(function (x) {
            var es = !dep && x[0] === o.v;
            return '<button type="button" role="option" class="tb-op' + (es ? ' es' : '') + '" aria-selected="' + es + '" data-elegir="' + texto(x[0]) + '">' + texto(x[1]) + '</button>';
          }).join('') + '</div>' : '<p class="u-nota">' + (k === 'ENTREGA' ? 'Su iniciativa no tiene entregas abiertas.' : 'No hay nada que elegir.') + '</p>') +
          '<div class="botones"><button type="button" class="sec" data-cancelar-alta>Cancelar</button></div>';
        altaForm.onsubmit = function (e) { e.preventDefault(); };
        abrirVelo();
        var b = altaForm.querySelector('.tb-op.es') || altaForm.querySelector('.tb-op'); if (b) b.focus();
      }
      altaForm.addEventListener('click', function (e) {
        var b = e.target.closest('[data-elegir]');
        if (!b || !altaForm.querySelector('.tb-elegir')) return;
        var k = altaForm.querySelector('h2').getAttribute('data-k');
        cerrarVelo();
        guardarCampo(k, b.getAttribute('data-elegir'));
      });
      function abrirCampo(k) {
        epicaNueva = false;
        if (TACTIL && DE_LISTA[k]) { elegir(k); return; }
        cambiando = k; pintarFicha();
        var x = caja.querySelector('#fed');
        if (!x) return;
        x.focus();
        if (x.type === 'text') x.select();
        // Con ratón, la lista se abre sola; en el móvil, se toca el desplegable (abrirla desde aquí no siempre deja elegir).
        if (x.tagName === 'SELECT' && x.showPicker && !TACTIL) { try { x.showPicker(); } catch (e) {} }
      }
      function cerrarCampo() {
        var k = cambiando; cambiando = ''; epicaNueva = false; pintarFicha();
        var x = caja.querySelector('[data-ed="' + k + '"]'); if (x) x.focus();
      }
      function guardarCampo(k, v) {
        var t = tarea(abiertaId);
        if (!t || !k) return;
        var id = String(t.ID);
        if (k === 'DEPENDE') { cerrarCampo(); if (v) cambiarDeps(id, esperaA(id).concat([v])); return; }
        if (k === 'EPICA' && v === OTRA) { cambiando = 'EPICA'; epicaNueva = true; pintarFicha(); var n = caja.querySelector('#fed'); if (n) n.focus(); return; }
        if (k === 'EPICA' && epicaNueva) { v = String(v || '').trim().toUpperCase(); epicaNueva = false; if (!v) { cerrarCampo(); return; } }
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
            (auto && estado === 'En cola' ? ' Es autónoma: pulsa «Que lo haga Claude» para que siga.' : ''));
          return Promise.all([ctx.tablas.refrescar([T], true), abiertaId === id ? bitacora(id, true) : null]);
        }, function (e) {
          if (ctx.abierta()) ctx.aviso('No se ha enviado la respuesta: ' + String(e.message).replace(/^\w+:\s*/, ''));
          b.disabled = false; b.textContent = 'Responder';
        }).then(function () { if (ctx.abierta() && abiertaId === id && !ocupado()) pintarFicha(); });
      }

      /**
       * T0449 · Pedir cambios en una tarea Para revisar o Aprobada: pedir_cambios() de la base, el mismo camino que DEV, daily.js
       * y los chats. Lo pide quien la revisa o quien lleva la iniciativa; el texto va tal cual. La tarjeta pasa a En cola al
       * momento y, si la base dice que no, vuelve.
       */
      var cambiosTxt = {};   // lo escrito en «Pedir cambios» de cada tarea, para que repintar la ficha no lo borre
      function puedePedirCambios(t) {
        return (t.ESTADO === 'Para revisar' || t.ESTADO === 'Aprobada') && !SOLO_LEE && !t._nueva && !t._pendiente &&
          (ctx.admin || (ctx.personaId && t.REVISA === ctx.personaId) || /^responsable/.test(ctx.perfil || ''));
      }
      function pedirCambios(id, txt, b) {
        var t = tarea(id), auto = !!(t || {}).AUTONOMA;
        if (b) { b.disabled = true; b.textContent = 'Enviando…'; }
        return ctx.tablas.actualizar(T, id, { ESTADO: 'En cola', CAMBIOS_PEDIDOS: new Date().toISOString() }, { fn: 'pedir_cambios', args: [{ tarea: id, texto: txt }] }).then(function (estado) {
          delete cambiosTxt[id];
          if (ctx.abierta()) ctx.aviso('Cambios pedidos: ' + id + ' vuelve a ' + (typeof estado === 'string' && estado ? estado : 'la cola') + '.' +
            (auto ? ' Es autónoma: pulsa «Que lo haga Claude» para que la rehaga.' : ' Quien la coja verá lo pedido lo primero.'));
          return alDia(id);
        }, function () {
          // El aviso de lo que dice la base ya lo da la capa de tablas; lo escrito se queda para volver a enviarlo.
          if (b) { b.disabled = false; b.textContent = 'Pedir cambios'; }
        }).then(function () { if (ctx.abierta() && abiertaId === id && !ocupado()) pintarFicha(); });
      }

      /**
       * T0440 · Aprobar una tarea Para revisar: la función del servidor aprobar (la misma que la línea de DEV) mira sus PR en
       * GitHub («Pruebas» ✅ y sin conflictos con main), las fusiona y la pasa a Aprobada, «Por publicar» (Entregada, si no
       * lleva nada que publicar). En dos pasos, como «Que lo haga Claude»: primero mira (probar) y enseña cada PR; después,
       * «Aprobar y fusionar». Si no se puede, dice por qué. Lo mismo al llevar la tarjeta a Por publicar. Quien la revisa o
       * quien lleva la iniciativa (la base lo vuelve a mirar).
       */
      var aprob = {};   // por tarea: { paso: 'mirando' | 'confirmar' | 'aprobando' | 'no', r: lo que ha dicho la función }
      function puedeAprobar(t) {
        return t.ESTADO === 'Para revisar' && !SOLO_LEE && !t._nueva && !t._pendiente &&
          (ctx.admin || (ctx.personaId && t.REVISA === ctx.personaId) || /^responsable/.test(ctx.perfil || ''));
      }
      function lineaPr(p) {
        var como = p.estado === 'fusionada' ? 'ya fusionada' : p.estado === 'cerrada' ? 'cerrada sin fusionar' :
          (p.pruebas === 'bien' ? '«Pruebas» ✅' : p.pruebas === 'mal' ? '«Pruebas» ❌' : p.pruebas === 'en marcha' ? '«Pruebas» sin acabar' : 'sin «Pruebas»') +
          ' · ' + (p.conflictos === false ? 'sin conflictos' : p.conflictos ? 'con conflictos' : 'conflictos sin mirar');
        return '<li><a href="' + texto(p.url) + '" target="_blank" rel="noopener">PR ' + texto(p.repo + ' #' + p.numero) + '</a> · ' + texto(como) + '</li>';
      }
      function htmlAprobar(t) {
        var id = String(t.ID), a = aprob[id] || {}, r = a.r || {}, prs = r.prs || [];
        var bot = function (txt, attr, c) { return '<button type="button" class="u-btn ' + (c || '') + '" ' + attr + '>' + texto(txt) + '</button>'; };
        var abiertas = prs.filter(function (p) { return p.estado === 'abierta'; }).length;
        var lista = prs.length ? '<ul class="fap-prs">' + prs.map(lineaPr).join('') + '</ul>' : '';
        var h;
        if (a.paso === 'no') {
          h = '<p class="fcl-no"><b>Aún no se puede aprobar:</b> ' + texto((r.motivos || []).join('; ')) + '.</p>' + lista +
            '<div class="fcl-b">' + bot('Volver a mirar', 'data-aprobar') + '</div>';
        } else if (a.paso === 'confirmar' || a.paso === 'aprobando') {
          var entrega = r.publicar === false || (r.publicar == null && !t.PUBLICAR);
          h = lista + '<p>' + (abiertas ? (abiertas === 1 ? 'Se fusiona la PR' : 'Se fusionan las ' + abiertas + ' PR') + ' y ' + id : (prs.length ? '' : 'No tiene PR: ') + id) +
            (entrega ? ' pasa a Entregada: no lleva nada que publicar.' : ' pasa a Por publicar.') + '</p>' +
            '<div class="fcl-b">' + bot(a.paso === 'aprobando' ? (abiertas ? 'Fusionando…' : 'Aprobando…') : (abiertas ? 'Aprobar y fusionar' : 'Aprobar'),
              'data-aprobar-si' + (a.paso === 'aprobando' ? ' disabled' : ''), 'u-btn-accion') +
            (a.paso === 'aprobando' ? '' : bot('Ahora no', 'data-aprobar-no', 'u-btn-texto')) + '</div>';
        } else {
          h = '<div class="fcl-b">' + bot(a.paso === 'mirando' ? 'Mirando la PR…' : 'Aprobar', 'data-aprobar' + (a.paso === 'mirando' ? ' disabled' : ''), 'u-btn-accion') + '</div>';
        }
        return '<div class="bloque fcl fap' + (a.paso === 'no' ? ' fcl-off' : '') + '">' + h + '</div>';
      }
      function pedirAprobar(id, probar) {
        var a = aprob[id] = { paso: probar ? 'mirando' : 'aprobando', r: (aprob[id] || {}).r };
        if (abiertaId === id) pintarFicha();
        return ctx.llamar('aprobar', [{ tarea: id, probar: !!probar }]).then(function (r) {
          if (aprob[id] !== a) return;
          r = r || {};
          if (probar) { aprob[id] = { paso: r.puede ? 'confirmar' : 'no', r: r }; return; }
          delete aprob[id];
          var n = r.fusionadas || 0;
          if (ctx.abierta()) ctx.aviso(id + ' aprobada' + (n ? ' y ' + (n === 1 ? 'su PR, fusionada' : 'sus ' + n + ' PR, fusionadas') : '') +
            (r.estado === 'Entregada' ? ': no lleva nada que publicar, queda Entregada.' : ': queda Por publicar.') + (r.simulada ? ' (En local no sale nada hacia GitHub.)' : ''));
          return alDia(id);
        }, function (e) {
          if (aprob[id] !== a) return;
          var m = sinPrefijo(e), por = /^No se puede aprobar T\d+: (.*?)\.?$/.exec(m);
          if (por) { aprob[id] = { paso: 'no', r: { prs: (a.r || {}).prs || [], motivos: por[1].split('; ') } }; return; }
          delete aprob[id];
          if (ctx.abierta()) ctx.aviso((probar ? 'No se ha podido mirar la PR: ' : 'No se ha aprobado: ') + m);
          if (!probar) return alDia(id);
        }).then(function () { if (ctx.abierta() && abiertaId === id && !ocupado()) pintarFicha(); });
      }

      /**
       * T0439 · «Que lo haga Claude»: la marca autónoma y lanza «Autónomo» con ella (la función del servidor lanzar_autonomo,
       * con la llave de GitHub). Lo lanza quien administra Utilo. En dos pasos: el primero pregunta a la base si el agente la
       * puede coger (fase, tope y todo lo demás: probar) y el segundo, tras «Lanzar», la lanza. Si no puede, dice por qué.
       */
      var claude = {};   // por tarea: { paso: 'comprobando' | 'confirmar' | 'lanzando' | 'lanzada' | 'no', texto, ver, simulada }
      function puedeClaude(t) { return ctx.admin && !SOLO_LEE && !t._nueva && ANTES_DE_EMPEZAR.indexOf(t.ESTADO) >= 0; }
      function motivoAqui(t) {
        var deps = esperaA(String(t.ID)).filter(function (x) { return tarea(x); }).map(function (x) { return { id: x, estado: tarea(x).ESTADO }; });
        return motivoClaude(t, { yo: ctx.personaId, deps: deps, hoy: hoyISO(), nombre: nombre });
      }
      function sinPrefijo(e) { return String((e && e.message) || e).replace(/^\w+:\s*/, ''); }
      function htmlClaude(t) {
        var id = String(t.ID), c = claude[id] || {}, no = motivoAqui(t);
        var bot = function (txt, attr, cls) { return '<button type="button" class="u-btn ' + (cls || '') + '" ' + attr + '>' + txt + '</button>'; };
        var h = '';
        if (c.paso === 'lanzada') {
          h = '<p><b>Lanzada.</b> El agente la coge en un par de minutos, la hace en su rama y te avisa cuando esté para revisar o si tiene una duda.' +
            (c.simulada ? ' <i>(En local no sale nada hacia GitHub.)</i>' : '') + '</p>' +
            '<div class="fcl-b"><a class="u-btn u-btn-claro" href="' + texto(c.ver) + '" target="_blank" rel="noopener">Ver en GitHub</a></div>';
        } else if (no.length || c.paso === 'no') {
          h = '<p class="fcl-no"><b>Claude no puede hacerla:</b> ' + texto(no.length ? no.join('; ') : c.texto) + '.</p>';
        } else if (c.paso === 'confirmar' || c.paso === 'lanzando') {
          h = '<p>' + (t.AUTONOMA ? '' : 'Pasa a autónoma y ') + (t.AUTONOMA ? 'E' : 'e') + 'l agente la hace solo en su rama: la deja en Para revisar con su PR, o te pregunta. ' +
            'Si cambia algo que se ve, de momento te pregunta antes.</p>' +
            '<div class="fcl-b">' + bot(c.paso === 'lanzando' ? 'Lanzando…' : 'Lanzar', 'data-claude-si' + (c.paso === 'lanzando' ? ' disabled' : ''), 'u-btn-accion') +
            (c.paso === 'lanzando' ? '' : bot('Ahora no', 'data-claude-no', 'u-btn-texto')) + '</div>';
        } else {
          h = '<div class="fcl-b">' + bot(ICO_AUTO.replace(' role="img" aria-label="Autónoma"', ' aria-hidden="true"').replace(/<title>.*?<\/title>/, '') + (c.paso === 'comprobando' ? 'Comprobando…' : 'Que lo haga Claude'), 'data-claude' + (c.paso === 'comprobando' ? ' disabled' : '')) + '</div>';
        }
        return '<div class="bloque fcl' + (no.length || c.paso === 'no' ? ' fcl-off' : '') + '">' + h + '</div>';
      }
      function pedirClaude(id, probar) {
        var c = claude[id] = { paso: probar ? 'comprobando' : 'lanzando' };
        pintarFicha();
        return ctx.llamar('lanzar_autonomo', [{ tarea: id, probar: !!probar }]).then(function (r) {
          if (claude[id] !== c) return;
          claude[id] = probar ? { paso: 'confirmar' } : { paso: 'lanzada', ver: (r && r.ver) || '', simulada: !!(r && r.simulada) };
          if (!probar && ctx.abierta()) ctx.aviso(id + ': lanzado el agente autónomo.');
          if (!probar) return Promise.all([ctx.tablas.refrescar([T], true), abiertaId === id ? bitacora(id, true) : null]);
        }, function (e) {
          if (claude[id] !== c) return;
          var m = sinPrefijo(e), por = /^Claude no puede hacer T\d+: (.*?)\.?$/.exec(m);
          if (por) { claude[id] = { paso: 'no', texto: por[1] }; return; }
          delete claude[id];
          if (ctx.abierta()) ctx.aviso((probar ? 'No se ha podido comprobar: ' : 'No se ha lanzado: ') + m);
          if (!probar && abiertaId === id) return bitacora(id, true);
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
        if (claude[id] && claude[id].paso !== 'lanzando') delete claude[id]; // T0439: al volver a abrirla, se comprueba otra vez
        if (aprob[id] && aprob[id].paso !== 'aprobando' && aprob[id].paso !== 'mirando') delete aprob[id]; // T0440: igual
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
      /**
       * T0420 · Quien pulsa Volver (o Escape, o fuera): si la ficha se abrió al llegar desde otra sección (una tarea de Para mí o
       * de Entregas), vuelve a ella tal como estaba (atrás); si no, al tablero.
       */
      var vieneDe = null;
      function salirFicha() {
        if (!abiertaId) return;
        if (vieneDe && ctx.volver) { vieneDe = null; ctx.volver(); return; }
        cerrarFicha();
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
        if (e.target === fv || e.target.closest('[data-cerrar]')) { salirFicha(); return; }
        // Un desplegable abierto se cierra al tocar fuera de él (si el toque no abre otra cosa, no hace nada más).
        var abierto = cambiando && caja.querySelector('select#fed' + (TACTIL ? ', input[type=date]#fed' : ''));
        if (abierto && !e.target.closest('.fed-abierto')) { cerrarCampo(); if (!e.target.closest('[data-ed],[data-rel],button,a,select,input,textarea')) return; }
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
        if (e.target.closest('[data-claude]')) { pedirClaude(abiertaId, true); return; }
        if (e.target.closest('[data-claude-si]')) { pedirClaude(abiertaId, false); return; }
        if (e.target.closest('[data-claude-no]')) { delete claude[abiertaId]; pintarFicha(); return; }
        if (e.target.closest('[data-aprobar]')) { pedirAprobar(abiertaId, true); return; }
        if (e.target.closest('[data-aprobar-si]')) { pedirAprobar(abiertaId, false); return; }
        if (e.target.closest('[data-aprobar-no]')) { delete aprob[abiertaId]; pintarFicha(); return; }
        var pc0 = e.target.closest('[data-pedir-cambios]');
        if (pc0) { var pa = caja.querySelector('#tb-cambios'), pt = pa ? pa.value.trim() : ''; if (pt) pedirCambios(abiertaId, pt, pc0); else if (pa) { pa.focus(); ctx.aviso('Di qué hay que cambiar.'); } return; }
        var rb = e.target.closest('[data-responder]');
        if (rb) { var ra = caja.querySelector('#tb-resp'), rt = ra ? ra.value.trim() : ''; if (rt) responder(abiertaId, rt, rb); else if (ra) { ra.focus(); ctx.aviso('Escribe la respuesta antes de enviarla.'); } return; }
        var b = e.target.closest('[data-anotar]');
        if (b) { var a = caja.querySelector('#tb-nota'), txt = a ? a.value.trim() : ''; if (txt) anotar(abiertaId, txt, b); else if (a) a.focus(); }
      });
      fv.addEventListener('input', function (e) {
        if (e.target.id === 'tb-resp' && abiertaId) respuestas[abiertaId] = e.target.value;
        if (e.target.id === 'tb-cambios' && abiertaId) cambiosTxt[abiertaId] = e.target.value;
      });
      fv.addEventListener('change', function (e) {
        if (e.target.id === 'kb-f-est') { mover(abiertaId, e.target.value); return; }
        if (e.target.id === 'fed' && cambiando && (e.target.tagName === 'SELECT' || (TACTIL && e.target.type === 'date'))) guardarCampo(cambiando, e.target.value);
      });
      // Un dato de una línea se guarda al salir de él (o con Intro). Un desplegable que se deja sin cambiar se cierra al tocar
      // fuera de él (abajo, en el clic) o con Escape, no al perder el foco: en el móvil, abrir su lista de opciones le quita el
      // foco, y cerrarlo entonces dejaba la lista sin nada detrás (T0417: no se podía elegir la entrega en el móvil).
      fv.addEventListener('focusout', function (e) {
        var x = e.target;
        if (x.id !== 'fed' || !cambiando || !x.isConnected) return;
        // En el móvil, una fecha se guarda al elegirla (change, abajo): su calendario también le quita el foco.
        if (x.tagName === 'INPUT' && !(TACTIL && x.type === 'date')) guardarCampo(cambiando, x.value);
      });
      fv.addEventListener('keydown', function (e) {
        if (cambiando && e.target.id === 'fed') {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarCampo(); return; }
          if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey)) { e.preventDefault(); guardarCampo(cambiando, e.target.value); }
          return;
        }
        var d = e.target.getAttribute && e.target.getAttribute('data-ed');
        if (d && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirCampo(d); return; }
        if (e.key === 'Escape') { if (cambiando) cerrarCampo(); else if (editando) { editando = false; pintarFicha(); } else salirFicha(); }
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
          '<span class="fpill ' + cls(st) + '">' + texto(nom(st)) + '</span><span class="frid">' + texto(id) + '</span><span class="frtit">' + texto(x ? x.TITULO : '') + '</span></a>';
      }
      function fechaCaja(lab, val, pista, c, attrs) {
        return '<div class="ffecha ' + (c || '') + '"' + (attrs || '') + '><small>' + texto(lab) + '</small><strong>' + texto(val || '—') + '</strong>' + (pista ? '<span class="fpista">' + texto(pista) + '</span>' : '') + '</div>';
      }
      function quien(b) { return b.QUIEN || nombre(b.PERSONA) || (b.EMPLEADO ? b.EMPLEADO : 'Sistema'); }

      /** T0466 · El bloque «Para entregarla» de una tarea Por publicar. */
      function htmlPorPublicar(t) {
        var p = porPublicar(t), h = '';
        if (p.que === 'sin-pr') h = '<p>No tiene PR: falta enviarla o publicarla a mano. Cuando esté, pásala a Entregada.</p>';
        else if (p.que === 'sin-calcular') h = '<p>Calculando qué le falta: sale en un minuto, al fusionar su PR.</p>';
        else {
          if (p.faltan.length) h += '<p>Falta:</p><ul class="fpp-lista">' + p.faltan.map(function (f) {
            var bs = f.con.map(function (b) {
              var u = enlaceBoton(b);
              return u ? '<a href="' + texto(u) + '" target="_blank" rel="noopener" title="Abre la acción en GitHub con todo puesto: pulsa «Run workflow»"><b>' + texto(b) + '</b></a>' : '<b>' + texto(b) + '</b>';
            }).join(' o ');
            return '<li>' + bs + (f.donde && botonTexto(f).indexOf(f.donde) < 0 ? ' <span>(' + texto(f.donde) + ')</span>' : '') + '</li>';
          }).join('') + '</ul>';
          if (p.ya.length) h += '<p><b>Ya está:</b> ' + texto(p.ya.join(', ')) + '</p>';
          if (p.dudas.length) h += p.dudas.map(function (d) { return '<p class="fpp-duda"><b>Ojo:</b> ' + texto(d) + '</p>'; }).join('');
          if (!p.faltan.length && !p.dudas.length) h += '<p>Ya está en todos sus sitios: pasa sola a Entregada con la próxima publicación.</p>';
          else if (p.faltan.length) h += '<p class="u-nota">' + (p.faltan.some(function (f) { return /^A mano/.test(f.con[0]); })
            ? 'Lo de «A mano» se le pide a Claude. ' : '') + (p.faltan.some(function (f) { return f.con.some(enlaceBoton); })
            ? 'Cada botón abre su acción en GitHub con todo puesto: pulsa «Run workflow». ' : '') + 'Cuando esté todo, pasa sola a Entregada.' + (horaLocal(p.el) ? ' Mirado el ' + texto(horaLocal(p.el)) + '.' : '') + '</p>';
        }
        return '<div class="bloque fpp"><h3>Para entregarla</h3>' + h + '</div>';
      }
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
        // T0420: Qué hay que hacer y Conclusiones, por partes (apartados, frases, listas, «está bien hecho cuando»).
        var largoFx = function (k) { var h = htmlTexto(t[k]); return largo(k, h ? '<div class="fx">' + h + '</div>' : ''); };
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
        // T0319: si la puede hacer el agente autónomo (el modelo no sale: manda la regla; decidido por Javi).
        if (t.AUTONOMA || ab('AUTONOMA')) tags.push(tag('AUTONOMA', 'Autónoma'));
        var manos = enManos(t);
        var pasos = PASOS[t.ESTADO] || [], mueve = !SOLO_LEE && pasos.length && !t._nueva;
        var estado = '<div class="est ' + cls(t.ESTADO) + '">' + (mueve ? '<label for="kb-f-est">Estado</label><select id="kb-f-est"' + (t._pendiente ? ' disabled' : '') + '>' +
            [t.ESTADO].concat(pasos).map(function (e) { return '<option value="' + texto(e) + '"' + (e === t.ESTADO ? ' selected' : '') + '>' + texto(nom(e)) + '</option>'; }).join('') + '</select>'
            : '<span class="fpill">' + texto(nom(t.ESTADO)) + '</span>') +
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
          ['AUTONOMA', !t.AUTONOMA], ['DISPONIBLE_DESDE', !t.DISPONIBLE_DESDE], ['DEPENDE', !deps.length], ['DOCUMENTOS_RELEVANTES', !docs.length], ['CONCLUSIONES', !lineas(t.CONCLUSIONES).length]]
          .filter(function (x) { return x[1] && cambiando !== x[0]; });
        var anadir = faltan.length ? '<div class="fanadir"><span>Añadir</span>' + faltan.map(function (x) {
          return '<button type="button" class="fmas" data-ed="' + x[0] + '">+ ' + texto(ETIQUETA[x[0]]) + '</button>'; }).join('') + '</div>' : '';
        var motivo = [];
        if (t.PREGUNTA) motivo.push('<p><b>Pregunta:</b> ' + texto(t.PREGUNTA) + '</p>');
        if (puedeResponder(t)) motivo.push('<div class="fresp"><label class="u-oculto" for="tb-resp">Tu respuesta</label>' +
          '<textarea id="tb-resp" rows="3" placeholder="Tu respuesta…">' + texto(respuestas[id] || '') + '</textarea>' +
          '<div class="pie"><button type="button" class="u-btn" data-responder>Responder</button></div></div>');
        // T0449: los cambios pedidos que nadie ha cogido (lo pedido, en Qué hay que hacer) y pedirlos.
        if (t.CAMBIOS_PEDIDOS && (t.ESTADO === 'En cola' || t.ESTADO === 'Esperando'))
          motivo.push('<p class="fcambios"><b>Cambios pedidos</b> el ' + texto(fechaEs(String(t.CAMBIOS_PEDIDOS).slice(0, 10))) + ': están en Qué hay que hacer y esperan a que alguien la coja.</p>');
        if (puedePedirCambios(t)) motivo.push('<div class="fresp fpedir"><label class="lab" for="tb-cambios">¿Hay que cambiar algo?</label>' +
          '<textarea id="tb-cambios" rows="3" placeholder="Qué hay que cambiar, tal cual…">' + texto(cambiosTxt[id] || '') + '</textarea>' +
          '<div class="pie"><button type="button" class="u-btn" data-pedir-cambios>Pedir cambios</button></div></div>');
        if (t.MOTIVO_BLOQUEO) motivo.push('<p><b>Bloqueada:</b> ' + texto(t.MOTIVO_BLOQUEO) + '</p>');
        // T0450: cómo se revisa: qué mirar, dónde se comprueba y «Verlo en DEV» (la app DEV ya en su rama, web y persona).
        // Solo en revisión (EN_REVISION) y si lo tiene (o es de Chat o Cowork, T0462): dónde lo miras (se lee) y qué mirar.
        var revision = '';
        if (EN_REVISION.indexOf(t.ESTADO) >= 0 && (t.COMPROBAR || t.QUE_MIRAR || SIN_CODIGO.indexOf(t.HERRAMIENTA) >= 0)) {
          var qm = ab('QUE_MIRAR') ? '<div class="fed-abierto"><div class="edit">' + control(t, 'QUE_MIRAR') + '</div></div>'
            : t.QUE_MIRAR ? '<div class="fx"' + pulsa(t, 'QUE_MIRAR') + '>' + htmlTexto(t.QUE_MIRAR) + '</div>'
            : pc ? '<button type="button" class="fmas" data-ed="QUE_MIRAR">+ Qué mirar</button>' : '';
          var cmp = t.COMPROBAR ? '<p class="fcomprobar"><b>Dónde lo miras:</b> ' + texto(COMPROBAR[t.COMPROBAR] || t.COMPROBAR) + '</p>' : '';
          // Ya dentro de la app DEV (una rama en dev-ramas/), el botón volvería a abrirla: no sale (Javi).
          var ver = t.COMPROBAR === 'DEV' && VER_EN_DEV.indexOf(t.ESTADO) >= 0 && !/\/dev-ramas\//.test(location.pathname)
            ? '<div class="pie"><a class="u-btn fver-dev" href="' + texto(enlaceDev(id, t.VER_EN_DEV)) + '" target="_blank" rel="noopener">Verlo en DEV</a></div>' : '';
          if (cmp || qm || ver) revision = '<div class="bloque frevision"><h3>Qué mirar</h3>' + cmp + qm + ver + '</div>';
        }
        if (t.MOTIVO) motivo.push('<p><b>Motivo:</b> ' + texto(t.MOTIVO) + '</p>');
        // T0466: qué le falta para llegar a producción y con qué botón (lo calcula entregar.js al fusionar y al publicar).
        var publicar = t.ESTADO === 'Aprobada' ? htmlPorPublicar(t) : '';
        caja.innerHTML =
          '<div class="barra"><button type="button" class="volver" data-cerrar>' + ICO_VOLVER + texto(vieneDe ? 'Volver a ' + vieneDe.titulo : 'Volver al tablero') + '</button></div>' +
          '<div class="cab"><div class="id"><span class="n">' + texto(id) + '</span></div>' +
            (ab('TITULO') ? '<h1 id="kb-f-tit" class="fed-abierto">' + control(t, 'TITULO') + '</h1>' : '<h1 id="kb-f-tit"' + pulsa(t, 'TITULO') + '>' + texto(t.TITULO) + '</h1>') + '</div>' +
          '<div class="fmeta">' + tags.join('') + '</div>' + estado +
          publicar + (motivo.length ? '<div class="bloque">' + motivo.join('') + '</div>' : '') + revision +
          (puedeAprobar(t) || aprob[id] ? htmlAprobar(t) : '') +
          (puedeClaude(t) ? htmlClaude(t) : '') +
          '<div class="datos"><div class="fila"><b>Fechas</b><div class="ffechas">' + fs.join('') + '</div></div></div>' +
          largoFx('DESCRIPCION') +
          (personas.length ? '<div class="bloque"><h3>Personas</h3>' + personas.join('') + '</div>' : '') +
          (deps.length || ab('DEPENDE') ? '<div class="bloque"><h3>Espera a</h3>' + espera + '</div>' : '') +
          (bloquea.length ? '<div class="bloque"><h3>La esperan</h3>' + bloquea.map(rel).join('') + '</div>' : '') +
          largo('DOCUMENTOS_RELEVANTES', docs.join('')) +
          largoFx('CONCLUSIONES') + anadir +
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
      delete F._ab; // T0422: los filtros ya no se quedan abiertos
      pintarFiltros(); pintarTablero();
      ctx.tablas.leer([T, TI, TE, TD]).then(function () {
        leido = true;
        if (!ctx.abierta()) return;
        pintarFiltros(); pintarTablero();
        var pedida = new URLSearchParams(location.search).get('t');
        if (pedida && tarea(pedida)) { vieneDe = ctx.desde || null; abrirFicha(pedida, true); }
      }, function (e) {
        leido = true;
        tab.innerHTML = '<p class="u-error kb-vacio">No se han podido leer las tareas.</p><p class="u-nota kb-vacio">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Vuelve a abrir la sección.</p>';
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
