/*
 * Entregas · plataforma interna de Utilo sobre Supabase (T0386; Mapa, T0415) · clientes/utilo/modulos/entregas de utilo-apps
 *
 * Las entregas de las iniciativas que ve quien ha entrado, en dos vistas a elegir arriba (cada dispositivo recuerda la última;
 * ?v=mapa o ?v=lista en la dirección la elige al entrar, como el botón «Ver el mapa» de Para mí):
 *
 * Mapa (T0415; sustituye al mapa a mano de T0359), todo de un vistazo:
 * - Un carril por iniciativa (las activas primero y, entre ellas, la que tiene más entregas en marcha); de izquierda a derecha,
 *   el tiempo (meses arriba) y una línea Hoy.
 * - Cada entrega, una caja de su FECHA_INICIO a su FECHA_PREVISTA (su fecha límite, con una bandera encima mientras está en
 *   marcha; la Entregada, hasta su FECHA_ENTREGA), con qué incluye y su barra de avance por grupos de estados (las Descartadas
 *   no cuentan). Sin fecha de inicio, empieza cuando se empezó a trabajar en ella: la primera vez que una de sus tareas
 *   pasó a En curso o más allá (las líneas de la bitácora que lo dicen; si no hay, el cierre de una entregada) o, si aún no
 *   se ha empezado, dos semanas antes de la
 *   prevista) y lleva el borde izquierdo de puntos; sin prevista, el derecho; sin ninguna, va junto al nombre del carril.
 *   Una Planificada con tareas que ya se mueven se ve como empezada.
 * - Lo vencido: una entrega en marcha cuya prevista ya pasó lleva una cola roja hasta Hoy y «Vencida hace N días»; las tareas
 *   abiertas con el DEADLINE pasado se cuentan en la caja. Lo atascado: sus preguntas (Necesita tu respuesta) y bloqueos.
 * - Flechas entre entregas cuando una tarea de una espera a otra de otra que aún no se ha acabado (DEPENDENCIAS: TAREA espera
 *   a DE; la flecha va de la entrega de DE a la de TAREA), con cuántas esperan en medio. Las esperas ya cumplidas no se
 *   dibujan: salen en el detalle. Debajo, una frase explica qué es cada cosa.
 * - Al pulsar una caja, su detalle (fechas, avance, qué incluye, qué espera y quién la espera) y sus tareas, que abren su
 *   ficha en Tareas. En una pantalla grande, al lado del mapa; si no, debajo.
 * - En una pantalla muy ancha ocupa todo el ancho; en el móvil se desliza de lado (los nombres de los carriles se quedan a la
 *   vista) y se abre con Hoy cerca de la izquierda.
 * Lista (T0386, como la sección Entregas del kanban 4.x, T0399): una tarjeta por entrega con su nombre corto (U19), estado e
 * iniciativa; las tareas entregadas de su total con una barra por estados; la fecha prevista con los días que faltan (o la de
 * entrega); qué incluye, el criterio de terminado y, al desplegar, sus tareas por estado.
 * Los filtros valen para las dos vistas: Ver (en marcha, aplazadas, entregadas o todas) e Iniciativa. Lee ENTREGAS, INICIATIVAS,
 * la vista TABLERO y DEPENDENCIAS con la sesión de quien ha entrado: lo que ve lo dicen sus roles. Se pone al día sola cuando
 * cambia una tarea o una dependencia (Realtime; las entregas, con ↻).
 * Crear, cambiar y mover (T0417), quien lleva la iniciativa (responsable o admin): «Nueva entrega» arriba (iniciativa, nombre,
 * fecha límite, qué incluye y cuándo estará terminada) y la ficha de cada entrega («Cambiar o mover» en el detalle del mapa y
 * en la lista; ?e=E0023 la abre), donde cada dato se cambia pulsándolo y el estado, arriba; y sus tareas: «+ Añadir tareas»
 * (las de su iniciativa sin entrega y sin cerrar) y × para sacar una, con cambiar_tarea() (cada tarea lo apunta en su bitácora). Escriben crear_entrega(),
 * cambiar_entrega() y mover_entrega() de la base, las mismas que usan los chats; la base pone el número, pide el criterio,
 * deja 2 En curso por iniciativa, pide el resumen al entregar y solo deja corregir una entregada o descartada a admin.
 * Las cuentas y la colocación del mapa y las reglas de la ficha (CALC) se prueban en node (herramientas/probar-plataforma.js).
 * Estilos: estilos/kanban.css (.mp-* el mapa, .en-* la lista), con los colores de base.css.
 */
(function () {
  'use strict';
  var TE = 'ENTREGAS', TI = 'INICIATIVAS', T = 'TABLERO', TD = 'DEPENDENCIAS', TB = 'BITACORA';
  /** Los estados que dicen que ya se trabaja en una tarea: de la bitácora se leen solo las líneas que la pasan a uno de ellos. */
  var TRABAJO = ['En curso', 'Para revisar', 'Aprobada', 'Entregada'];
  var PARTE_TRABAJO = { clave: 'trabajo', col: 'ESTADO_DESPUES', valores: TRABAJO };
  /** El filtro Ver, el mismo en las dos vistas: en marcha (planificadas y en curso), aplazadas, entregadas o todas (también las descartadas). */
  var VER = ['En marcha', 'Aplazadas', 'Entregadas', 'Todas'];
  var SIN_FECHA = 14;          // días que se dibujan hacia atrás (sin inicio) o hacia delante (sin prevista)
  // Medidas del dibujo, en px.
  // fila deja encima de cada caja sitio para la bandera de su fecha límite.
  var M = { pad: 16, cab: 34, tit: 30, fila: 124, caja: 98, bandera: 20, min: 168, hueco: 12, pxMin: 5 };
  /** Los grupos de estados de las tareas, como en Entregas: en la barra (de lo hecho a lo que falta) y al desplegar. */
  var GRUPOS = [
    { id: 'hecho', estados: ['Entregada'], cls: 's-co', una: 'entregada', varias: 'entregadas' },
    { id: 'revision', estados: ['Para revisar', 'Aprobada'], cls: 's-pr', una: 'en revisión', varias: 'en revisión' },
    { id: 'curso', estados: ['En curso'], cls: 's-ec', una: 'en curso', varias: 'en curso' },
    { id: 'atascada', estados: ['Necesita tu respuesta', 'Bloqueada'], cls: 's-bl', una: 'atascada', varias: 'atascadas' },
    { id: 'falta', estados: ['En cola', 'Esperando', 'Aplazada'], cls: 's-ni', una: 'por hacer', varias: 'por hacer' }
  ];
  var ORDEN_TAREAS = ['Necesita tu respuesta', 'Bloqueada', 'En curso', 'Para revisar', 'Aprobada', 'En cola', 'Esperando', 'Aplazada', 'Entregada', 'Descartada'];
  var CLS = { 'Esperando': 's-x', 'En cola': 's-ni', 'En curso': 's-ec', 'Necesita tu respuesta': 's-pr', 'Bloqueada': 's-bl', 'Para revisar': 's-pr',
    'Aprobada': 's-co', 'Entregada': 's-co', 'Aplazada': 's-x', 'Descartada': 's-x' };
  var CERRADA = { 'Entregada': 1, 'Descartada': 1 };
  var VISTAS = ['Mapa', 'Lista'];
  var DESPLEGAR = ['En curso', 'Necesita tu respuesta', 'Bloqueada', 'Para revisar', 'Aprobada', 'En cola', 'Esperando', 'Aplazada', 'Entregada', 'Descartada'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  /* ---------- fechas ('aaaa-mm-dd', también con la hora detrás, como llegan de la base) ---------- */
  function hoyIso(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dia(s) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || '')); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; }
  function utc(s) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s); return Date.UTC(+m[1], +m[2] - 1, +m[3]); }
  /** Días enteros de la fecha a a la b. */
  function diasEntre(a, b) { a = dia(a); b = dia(b); return a && b ? Math.round((utc(b) - utc(a)) / 864e5) : null; }
  function mas(s, n) { var d = new Date(utc(dia(s)) + n * 864e5); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function menor(a, b) { return a < b ? a : b; }
  function mayor(a, b) { return a > b ? a : b; }
  function fechaEs(s) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function diasTxt(n) { return n === 1 ? '1 día' : n + ' días'; }

  function enMarcha(e) { return e.ESTADO === 'Planificada' || e.ESTADO === 'En curso'; }

  /** El primer día que se trabajó en cada tarea, de las líneas de la bitácora que la pasan a En curso o más allá: { T0001: 'aaaa-mm-dd' }. */
  function trabajoPorTarea(lineas) {
    var o = {};
    (lineas || []).forEach(function (l) {
      var c = dia(l.CUANDO);
      if (c && l.TAREA && TRABAJO.indexOf(l.ESTADO_DESPUES) >= 0 && (!o[l.TAREA] || c < o[l.TAREA])) o[l.TAREA] = c;
    });
    return o;
  }
  /**
   * Desde cuándo se trabaja en una entrega: el primer día que una de sus tareas pasó a En curso (o más allá), según la
   * bitácora; sin esa línea, el día que se cerró una entregada o, si está en marcha (en curso, en revisión o atascada), desde
   * cuándo está en ese estado (ESTADO_DESDE). '' si todavía no se ha empezado (no cuenta cuándo se creó).
   */
  function inicioTrabajo(ts, porTarea) {
    var p = '';
    (ts || []).forEach(function (t) {
      if (t.ESTADO === 'Descartada') return;
      var c = (porTarea || {})[t.ID] || (t.ESTADO === 'Entregada' ? dia(t.FECHA_CIERRE) :
        ['En cola', 'Esperando', 'Aplazada'].indexOf(t.ESTADO) < 0 ? dia(t.ESTADO_DESDE) : '');
      if (c && (!p || c < p)) p = c;
    });
    return p;
  }
  /** Si una entrega ya está empezada: En curso, o Planificada con alguna tarea que ya se mueve (en curso, en revisión, atascada o hecha). */
  function empezada(e, ts) {
    if (e.ESTADO === 'En curso') return true;
    return e.ESTADO === 'Planificada' && (ts || []).some(function (t) { return ['En cola', 'Esperando', 'Aplazada', 'Descartada'].indexOf(t.ESTADO) < 0; });
  }

  /**
   * De qué día a qué día va la caja de una entrega: { ini, fin, sinIni, iniDe, sinFin, retraso } o null si no tiene ninguna fecha.
   * fin es el último día (incluido). Sin FECHA_INICIO, empieza cuando se empezó a trabajar en ella (empezo, de inicioTrabajo;
   * iniDe: 'trabajo') o, si aún no, dos semanas antes de la prevista (iniDe: 'prevista'). retraso: los días que lleva vencida
   * una entrega en marcha.
   */
  function tramo(e, hoy, empezo) {
    var ini = dia(e.FECHA_INICIO), fin = e.ESTADO === 'Entregada' ? (dia(e.FECHA_ENTREGA) || dia(e.FECHA_PREVISTA)) : dia(e.FECHA_PREVISTA);
    var pri = ini ? '' : dia(empezo);
    if (!ini && !fin && !pri) return null;
    var r = { ini: ini, fin: fin, sinIni: !ini, iniDe: ini ? '' : pri ? 'trabajo' : 'prevista', sinFin: !fin, retraso: 0 };
    if (!ini) r.ini = pri || mas(fin, -SIN_FECHA);
    if (!fin) r.fin = mas(mayor(ini, hoy), SIN_FECHA);
    if (r.fin < r.ini) r.fin = r.ini; // prevista antes del inicio: una caja de un día (la fecha se lee en el detalle)
    if (enMarcha(e) && dia(e.FECHA_PREVISTA) && dia(e.FECHA_PREVISTA) < hoy) r.retraso = diasEntre(e.FECHA_PREVISTA, hoy);
    return r;
  }

  /** El avance de unas tareas: { total, hechas, pct, n: { grupo: cuántas } }, sin las Descartadas. */
  function progreso(ts) {
    var cuentan = (ts || []).filter(function (t) { return t.ESTADO !== 'Descartada'; }), n = {};
    GRUPOS.forEach(function (g) { n[g.id] = cuentan.filter(function (t) { return g.estados.indexOf(t.ESTADO) >= 0; }).length; });
    return { total: cuentan.length, hechas: n.hecho, pct: cuentan.length ? Math.round(100 * n.hecho / cuentan.length) : 0, n: n };
  }

  /** Lo atascado y lo vencido de una entrega: preguntas, bloqueos, tareas abiertas con el DEADLINE pasado y su retraso. */
  function marcas(e, ts, hoy) {
    ts = ts || [];
    var t = tramo(e, hoy);
    return {
      preguntas: ts.filter(function (x) { return x.ESTADO === 'Necesita tu respuesta'; }).length,
      bloqueos: ts.filter(function (x) { return x.ESTADO === 'Bloqueada'; }).length,
      vencidas: ts.filter(function (x) { return !CERRADA[x.ESTADO] && x.ESTADO !== 'Aplazada' && dia(x.DEADLINE) && dia(x.DEADLINE) < hoy; }).length,
      retraso: t ? t.retraso : 0
    };
  }

  /** Si una entrega sale con ese filtro: en marcha; con las entregadas de los últimos días; o todas. */
  function grupoDe(e) { return e.ESTADO === 'Entregada' ? 'Entregadas' : e.ESTADO === 'Aplazada' ? 'Aplazadas' : e.ESTADO === 'Descartada' ? '' : 'En marcha'; }
  function seVe(e, ver) { return ver === 'Todas' || grupoDe(e) === ver; }

  /**
   * Las esperas entre entregas: [{ de, a, n, abiertas, pares: [{ tarea, de }] }] (de y a, IDs de entrega; la flecha va de
   * la entrega a la que se espera a la que espera), solo entre las entregas de «ids» y sin las de una entrega consigo misma.
   * sueltas: por entrega, lo que espera a tareas sin entrega (o de una entrega que no sale) y cuántas espera que no se ven.
   */
  function esperas(deps, tareas, ids) {
    var porId = {}, ve = {}, grupos = {}, sueltas = {};
    (tareas || []).forEach(function (t) { porId[t.ID] = t; });
    (ids || []).forEach(function (id) { ve[id] = 1; });
    (deps || []).forEach(function (d) {
      var t = porId[d.TAREA], o = porId[d.DE];
      if (!t || !t.ENTREGA || !ve[t.ENTREGA]) return;
      var abierta = !o || !CERRADA[o.ESTADO];
      if (!o || !o.ENTREGA || !ve[o.ENTREGA]) {
        var s = sueltas[t.ENTREGA] || (sueltas[t.ENTREGA] = { pares: [], noVes: 0 });
        if (!o) s.noVes++; else s.pares.push({ tarea: t, de: o });
        return;
      }
      if (o.ENTREGA === t.ENTREGA) return;
      var k = o.ENTREGA + '>' + t.ENTREGA, g = grupos[k] || (grupos[k] = { de: o.ENTREGA, a: t.ENTREGA, n: 0, abiertas: 0, pares: [] });
      g.n++; if (abierta) g.abiertas++;
      g.pares.push({ tarea: t, de: o });
    });
    var out = Object.keys(grupos).sort().map(function (k) {
      var g = grupos[k];
      g.pares.sort(function (a, b) { return String(a.tarea.ID).localeCompare(String(b.tarea.ID)) || String(a.de.ID).localeCompare(String(b.de.ID)); });
      return g;
    });
    return { flechas: out, sueltas: sueltas };
  }

  /** Coloca las cajas de un carril en filas sin que se pisen (cada una en la primera fila donde cabe). */
  function enFilas(items, hueco) {
    var fin = [];
    items.slice().sort(function (a, b) { return a.x - b.x || String(a.id).localeCompare(String(b.id)); }).forEach(function (it) {
      var f = 0;
      while (f < fin.length && fin[f] + hueco > it.x) f++;
      fin[f] = it.x + it.ancho;
      it.fila = f;
    });
    return fin.length;
  }

  /** Una curva de p0 a p3 con sus dos puntos de control: { d (el trazo del SVG), mx, my (su punto medio, para el número) }. */
  function curva(p) {
    return { d: 'M' + p[0] + ',' + p[1] + ' C' + p[2] + ',' + p[3] + ' ' + p[4] + ',' + p[5] + ' ' + p[6] + ',' + p[7],
      mx: Math.round((p[0] + 3 * p[2] + 3 * p[4] + p[6]) / 8), my: Math.round((p[1] + 3 * p[3] + 3 * p[5] + p[7]) / 8),
      largo: Math.round(Math.sqrt((p[6] - p[0]) * (p[6] - p[0]) + (p[7] - p[1]) * (p[7] - p[1]))) };
  }
  /** La línea de una flecha entre dos cajas: de la derecha de una a la izquierda de la otra o, si se solapan en el tiempo, de arriba abajo. */
  function linea(a, b) {
    var x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
    if (x2 - x1 >= 24) {
      var dx = Math.max(24, (x2 - x1) / 2);
      return curva([x1, y1, x1 + dx, y1, x2 - dx, y2, x2, y2]);
    }
    // Se solapan: por el centro de lo que comparten (o del borde más cercano), de la cara de abajo a la de arriba.
    var izq = Math.max(a.x, b.x), der = Math.min(a.x + a.w, b.x + b.w), cx = izq < der ? (izq + der) / 2 : (x1 + x2) / 2;
    var ax = Math.min(Math.max(cx, a.x + 12), a.x + a.w - 12), bx = Math.min(Math.max(cx, b.x + 12), b.x + b.w - 12);
    var baja = b.y > a.y, ya = baja ? a.y + a.h : a.y, yb = baja ? b.y : b.y + b.h, d = baja ? 28 : -28;
    return curva([ax, ya, ax, ya + d, bx, yb - d, bx, yb]);
  }

  /**
   * Todo el dibujo, sin tocar la página: { desde, hasta, pxDia, ancho, alto, hoyX, meses, carriles, cajas, flechas, sueltas, resumen }.
   * d: { entregas, iniciativas, tareas, deps }; o: { hoy, ancho, ver, ini }.
   */
  function plano(d, o) {
    o = o || {};
    var hoy = dia(o.hoy) || hoyIso(), ver = VER.indexOf(o.ver) >= 0 ? o.ver : VER[0];
    var ES = (d.entregas || []).filter(function (e) { return seVe(e, ver, hoy) && (!o.ini || e.INICIATIVA === o.ini); });
    // Los carriles: las iniciativas activas primero; entre ellas, la que tiene más entregas en marcha arriba; a igualdad, en su orden.
    var IS = (d.iniciativas || []).slice(), orden = {}, vivas = {};
    IS.forEach(function (i, k) { orden[i.ID] = k; });
    ES.forEach(function (e) { if (enMarcha(e)) vivas[e.INICIATIVA] = (vivas[e.INICIATIVA] || 0) + 1; });
    IS.sort(function (a, b) {
      return (a.ESTADO === 'Activa' ? 0 : 1) - (b.ESTADO === 'Activa' ? 0 : 1) || (vivas[b.ID] || 0) - (vivas[a.ID] || 0) || orden[a.ID] - orden[b.ID];
    });
    var tareasDe = {};
    (d.tareas || []).forEach(function (t) { if (t.ENTREGA) (tareasDe[t.ENTREGA] = tareasDe[t.ENTREGA] || []).push(t); });
    var iniDe = {};
    IS.forEach(function (i) { iniDe[i.ID] = i; });

    // El tiempo: del mes de lo primero al de lo último, con Hoy dentro y al menos tres meses.
    var tr = {}, desde = hoy, hasta = hoy;
    var porTarea = trabajoPorTarea(d.bitacora), empiezo = {};
    ES.forEach(function (e) { empiezo[e.ID] = inicioTrabajo(tareasDe[e.ID], porTarea); var t = tramo(e, hoy, empiezo[e.ID]); if (t) { tr[e.ID] = t; desde = menor(desde, t.ini); hasta = mayor(hasta, t.fin); } });
    desde = mas(desde, -7).slice(0, 8) + '01';
    hasta = mas(hasta, 7);
    if (diasEntre(desde, hasta) < 90) hasta = mas(desde, 90);
    hasta = mas(mas(hasta, 31).slice(0, 8) + '01', -1); // el último día de su mes
    var dias = diasEntre(desde, hasta) + 1;
    var util = Math.max(0, (o.ancho || 0) - 2 * M.pad), pxDia = Math.max(M.pxMin, util / dias);
    var ancho = Math.round(dias * pxDia + 2 * M.pad);
    function x(s) { return M.pad + diasEntre(desde, s) * pxDia; }

    var meses = [];
    for (var m = desde; m <= hasta; m = mas(m, 32).slice(0, 8) + '01') {
      var finMes = mas(mas(m, 32).slice(0, 8) + '01', -1), mm = +m.slice(5, 7) - 1;
      meses.push({ desde: m, x: x(m), w: (diasEntre(m, finMes) + 1) * pxDia, txt: MESES[mm] + (mm === 0 || m === desde ? ' ' + m.slice(0, 4) : '') });
    }

    // Las cajas, por carril (iniciativa) y en filas.
    var cajas = [], carriles = [], y = M.cab;
    IS.forEach(function (i) {
      var suyas = ES.filter(function (e) { return e.INICIATIVA === i.ID; });
      if (!suyas.length) return;
      var items = [], sin = [];
      suyas.forEach(function (e) {
        var t = tr[e.ID], ts = tareasDe[e.ID] || [];
        var c = { id: e.ID, e: e, corto: (i.INICIAL || '') + e.NUMERO, tramo: t, prog: progreso(ts), marcas: marcas(e, ts, hoy), tareas: ts, empezada: empezada(e, ts) };
        if (!t) { sin.push(c); return; }
        var x0 = x(t.ini), x1 = x(t.fin) + pxDia, w = Math.max(x1 - x0, M.min);
        if (x0 + w > ancho - M.pad) x0 = Math.max(M.pad, ancho - M.pad - w);
        c.x = Math.round(x0); c.w = Math.round(w); c.h = M.caja; c.ancho = c.w;
        // La bandera de la fecha límite (la prevista) de una entrega en marcha, en su día aunque la caja sea más ancha.
        if (enMarcha(e) && dia(e.FECHA_PREVISTA)) c.limite = { x: Math.round(Math.min(Math.max(x1, c.x + 2), ancho - M.pad)), fecha: dia(e.FECHA_PREVISTA) };
        if (t.retraso) {
          var cx = Math.max(c.x + c.w, x1), cw = x(hoy) + pxDia - cx;
          if (cw > 2) { c.cola = { x: Math.round(cx), w: Math.round(cw) }; c.ancho = c.cola.x + c.cola.w - c.x; }
        }
        items.push(c);
      });
      sin.sort(function (a, b) { return Number(a.e.NUMERO) - Number(b.e.NUMERO); });
      var filas = enFilas(items, M.hueco);
      var alto = M.tit + filas * M.fila + (filas ? 0 : 4);
      items.forEach(function (c) { c.y = y + M.tit + M.bandera + c.fila * M.fila; cajas.push(c); });
      carriles.push({ id: i.ID, nombre: i.NOMBRE || i.ID, estado: i.ESTADO, y: y, alto: alto, sinFecha: sin });
      sin.forEach(function (c) { cajas.push(c); });
      y += alto;
    });

    var dibujadas = {};
    cajas.forEach(function (c) { if (c.x != null) dibujadas[c.id] = c; });
    var es = esperas(d.deps, d.tareas, cajas.map(function (c) { return c.id; }));
    // Se dibujan solo las esperas abiertas: las ya cumplidas se cuentan en el detalle de cada entrega.
    var flechas = es.flechas.map(function (f) {
      var a = dibujadas[f.de], b = dibujadas[f.a], l = a && b && f.abiertas ? linea(a, b) : null;
      // El número va en medio de la flecha si cabe (en una muy corta taparía la bandera de la caja).
      return Object.assign({ d: l ? l.d : '', mx: l && l.largo >= 48 ? l.mx : null, my: l && l.largo >= 48 ? l.my : null }, f);
    });

    var hoyX = Math.round(x(hoy) + pxDia / 2);
    var vistas = cajas.map(function (c) { return c; });
    return {
      hoy: hoy, ver: ver, desde: desde, hasta: hasta, pxDia: pxDia, ancho: ancho, alto: y + 8, hoyX: hoyX,
      meses: meses, carriles: carriles, cajas: cajas, flechas: flechas, sueltas: es.sueltas,
      resumen: {
        entregas: vistas.length,
        enMarcha: vistas.filter(function (c) { return enMarcha(c.e); }).length,
        empezadas: vistas.filter(function (c) { return c.empezada; }).length,
        vencidas: vistas.filter(function (c) { return c.marcas.retraso > 0; }).length,
        atascadas: vistas.filter(function (c) { return c.marcas.preguntas + c.marcas.bloqueos > 0; }).length,
        esperas: flechas.filter(function (f) { return f.abiertas > 0; }).length
      },
      iniciativas: iniDe
    };
  }

  /* ---------- crear, cambiar y mover (T0417): lo que dice la base (gestion.pasos_entrega, antes_entrega), para no ofrecer
   * lo que no dejará; la que manda sigue siendo ella ---------- */
  var PASOS_E = {
    'Planificada': ['En curso', 'Aplazada', 'Descartada'],
    'En curso': ['Entregada', 'Planificada', 'Aplazada', 'Descartada'],
    'Aplazada': ['Planificada', 'En curso', 'Descartada']
  };
  /** Entregada y Descartada solo vuelven atrás para corregir un error, y solo admin. */
  var CORRIGE = { 'Entregada': 'En curso', 'Descartada': 'Planificada' };
  var MAX_EN_CURSO = 2;
  /** A qué estados puede pasar una entrega: [{ estado, corrige }]. */
  function pasosEntrega(estado, admin) {
    if (CORRIGE[estado]) return admin ? [{ estado: CORRIGE[estado], corrige: true }] : [];
    return (PASOS_E[estado] || []).map(function (s) { return { estado: s, corrige: false }; });
  }
  /** Qué pide pasar de un estado a otro: 'corregir' (el motivo), 'resumen' (Entregada), 'motivo' (Aplazada, Descartada) o ''. */
  function pideEntrega(de, a) {
    return CORRIGE[de] ? 'corregir' : a === 'Entregada' ? 'resumen' : a === 'Aplazada' || a === 'Descartada' ? 'motivo' : '';
  }
  /** Las entregas En curso de una iniciativa, sin contar «menos» (la que se va a mover). */
  function enCursoDe(entregas, ini, menos) {
    return (entregas || []).filter(function (e) { return e.INICIATIVA === ini && e.ESTADO === 'En curso' && e.ID !== menos; });
  }
  /** El número que tendrá la próxima entrega de una iniciativa (lo pone la base: el siguiente al más alto). */
  function siguienteNumero(entregas, ini) {
    return (entregas || []).reduce(function (n, e) { return e.INICIATIVA === ini ? Math.max(n, Number(e.NUMERO) || 0) : n; }, 0) + 1;
  }
  var NOMBRE_E = { NOMBRE: 'Nombre', CRITERIO: 'Terminada cuando', FECHA_INICIO: 'Empieza', FECHA_PREVISTA: 'Fecha límite', FECHA_ENTREGA: 'Entregada el',
    QUE_INCLUYE: 'Qué incluye', RESUMEN: 'Cómo fue', INICIATIVA: 'Iniciativa' };
  var LARGO_MAX = 60;
  /**
   * Lo que se guarda al cambiar el dato k de la entrega e desde su ficha: { cambios: { COLUMNA: v }, campos: { columna: v } }
   * (los de cambiar_entrega), { mal } si no vale, o null si no cambia nada. Fechas 'aaaa-mm-dd'; vacío, ''.
   */
  function cambioEntrega(e, k, v) {
    v = String(v == null ? '' : v).trim();
    var fecha = /^FECHA_/.test(k);
    if (fecha) v = dia(v);
    if ((k === 'NOMBRE' || k === 'CRITERIO') && !v) return { mal: NOMBRE_E[k] + ': no se queda vacío.' };
    if (k === 'NOMBRE' && v.length > LARGO_MAX) return { mal: 'Nombre: pasa de ' + LARGO_MAX + ' caracteres.' };
    if (k === 'RESUMEN' && !v && e.ESTADO === 'Entregada') return { mal: 'Una entrega entregada lleva su resumen: cómo fue.' };
    if (k === 'FECHA_ENTREGA' && !v) return { mal: 'Una entrega entregada lleva su fecha de entrega.' };
    var antes = e[k] == null ? '' : fecha ? dia(e[k]) : String(e[k]);
    if (antes === v) return null;
    if (k === 'FECHA_INICIO' || k === 'FECHA_PREVISTA') {
      var ini = k === 'FECHA_INICIO' ? v : dia(e.FECHA_INICIO), fin = k === 'FECHA_PREVISTA' ? v : dia(e.FECHA_PREVISTA);
      if (ini && fin && fin < ini) return { mal: 'La fecha límite (' + fechaEs(fin) + ') es antes de la de inicio (' + fechaEs(ini) + ').' };
    }
    var c = {}, cs = {};
    c[k] = v; cs[k.toLowerCase()] = v;
    return { cambios: c, campos: cs };
  }
  /** Lo del formulario de una entrega nueva ({ INICIATIVA, NOMBRE, FECHA_PREVISTA, QUE_INCLUYE, CRITERIO }): { campos, mal: [] }. */
  function nuevaEntrega(v) {
    var o = {}, mal = [];
    ['INICIATIVA', 'NOMBRE', 'FECHA_PREVISTA', 'QUE_INCLUYE', 'CRITERIO'].forEach(function (k) { o[k] = String(v[k] == null ? '' : v[k]).trim(); });
    if (!o.INICIATIVA) mal.push('Elige la iniciativa.');
    if (!o.NOMBRE) mal.push('Ponle nombre.');
    else if (o.NOMBRE.length > LARGO_MAX) mal.push('El nombre pasa de ' + LARGO_MAX + ' caracteres.');
    if (!o.CRITERIO) mal.push('Di cuándo estará terminada: algo que se pueda comprobar.');
    if (o.FECHA_PREVISTA && !dia(o.FECHA_PREVISTA)) mal.push('La fecha límite no es una fecha.');
    var campos = {};
    Object.keys(o).forEach(function (k) { if (o[k]) campos[k.toLowerCase()] = k === 'FECHA_PREVISTA' ? dia(o[k]) : o[k]; });
    return { campos: campos, mal: mal };
  }

  /** Las tareas que se pueden añadir a una entrega de la iniciativa ini: de esa iniciativa, sin entrega y sin cerrar, la más
   *  nueva arriba; con busca, solo las que lo tienen en el ID o el título (sin mayúsculas ni tildes). */
  function candidatas(tareas, ini, busca) {
    var plano = function (x) { return String(x == null ? '' : x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
    var ps = plano(busca).split(/\s+/).filter(Boolean);
    return (tareas || []).filter(function (t) {
      if (t.INICIATIVA !== ini || t.ENTREGA || CERRADA[t.ESTADO] || t._nueva) return false;
      var hay = plano(t.ID + ' ' + t.TITULO);
      return ps.every(function (p) { return hay.indexOf(p) >= 0; });
    }).sort(function (a, b) { return String(b.ID).localeCompare(String(a.ID)); });
  }

  var CALC = { plano: plano, tramo: tramo, empezada: empezada, trabajoPorTarea: trabajoPorTarea, inicioTrabajo: inicioTrabajo, TRABAJO: TRABAJO, progreso: progreso, marcas: marcas, seVe: seVe, esperas: esperas, enFilas: enFilas, linea: linea,
    diasEntre: diasEntre, mas: mas, M: M, VER: VER, VISTAS: VISTAS, grupoDe: grupoDe,
    pasosEntrega: pasosEntrega, pideEntrega: pideEntrega, enCursoDe: enCursoDe, siguienteNumero: siguienteNumero, cambioEntrega: cambioEntrega, nuevaEntrega: nuevaEntrega, candidatas: candidatas, MAX_EN_CURSO: MAX_EN_CURSO };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ===================== la pantalla ===================== */
  var RAIZ = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/utilo\/secciones\/[^/]*$/, '') : '../../'; })();
  var VERSION = (function () { var s = document.currentScript && document.currentScript.src; var m = s && /[?&]v=([^&]+)/.exec(s); return m ? m[1] : '1'; })();
  var ICO_RECARGAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
  var ICO_BANDERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>';
  var ICO_CERRAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICO_VOLVER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function leerLocal(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function guardarLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function cuantas(k, g) { return k + ' ' + (k === 1 ? g.una : g.varias); }

  /** La hoja del tablero, una vez por página (como Entregas). */
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

  /** Las marcas de una entrega, en palabras: [{ txt, cls }]. */
  function avisosDe(c) {
    var m = c.marcas, out = [];
    if (m.retraso) out.push({ txt: 'Vencida hace ' + diasTxt(m.retraso), cls: 'mp-rojo' });
    if (m.bloqueos) out.push({ txt: m.bloqueos === 1 ? '1 bloqueada' : m.bloqueos + ' bloqueadas', cls: 'mp-rojo' });
    if (m.preguntas) out.push({ txt: m.preguntas === 1 ? '1 pregunta' : m.preguntas + ' preguntas', cls: 'mp-ambar' });
    if (m.vencidas) out.push({ txt: m.vencidas === 1 ? '1 tarea vencida' : m.vencidas + ' tareas vencidas', cls: 'mp-rojo' });
    return out;
  }
  function barra(p) {
    return '<span class="mp-barra" aria-hidden="true">' + GRUPOS.map(function (g) {
      return p.n[g.id] ? '<span class="' + g.cls + '" style="flex-grow:' + p.n[g.id] + '"></span>' : '';
    }).join('') + '</span>';
  }

  /** Lista: en qué grupo del filtro Ver va una entrega. */
  /** Días de hoy a esa fecha: «faltan 9 días», «es hoy», «venció hace 2 días». */
  function cuanto(s) {
    var n = diasEntre(hoyIso(), s);
    if (n == null) return null;
    return { n: n, txt: n === 0 ? 'es hoy' : n === 1 ? 'falta 1 día' : n > 1 ? 'faltan ' + n + ' días' : n === -1 ? 'venció ayer' : 'venció hace ' + (-n) + ' días' };
  }

  window.UN.registrar('ENTREGAS', {
    abrir: function (el, ctx) {
      estilos(el);
      var C = ctx.config || {};
      var CLAVE = 'en_' + String(ctx.correo || ctx.persona || '').toLowerCase().replace(/\W+/g, '');
      var F = leerLocal(CLAVE + '_f', {});   // { vista, ver, ini }: los filtros valen para las dos vistas
      var pedida = String(new URLSearchParams(location.search).get('v') || '').toLowerCase();
      if (pedida === 'mapa' || pedida === 'lista') F.vista = pedida === 'mapa' ? 'Mapa' : 'Lista';
      if (VISTAS.indexOf(F.vista) < 0) F.vista = VISTAS.indexOf(C.VISTA) >= 0 ? C.VISTA : 'Mapa';
      if (VER.indexOf(F.ver) < 0) F.ver = VER.indexOf(C.VER) >= 0 ? C.VER : 'En marcha';
      delete F.verMapa;
      var leido = false, sel = '', P = null, primera = true, anchoVisto = 0;
      // Sin la clase «en»: en kanban.css es la vista de la 4.x, que solo se ve con body.ver-entregas.
      el.innerHTML = '<section class="mp en-nucleo"><div class="en-fil">' +
        '<div class="mp-vistas" role="group" aria-label="Vista">' + VISTAS.map(function (v) {
          return '<button type="button" class="sec" data-vista="' + v + '" aria-pressed="' + (v === F.vista) + '">' + v + '</button>';
        }).join('') + '</div>' +
        '<label>Ver<select id="en-ver"></select></label>' +
        '<label id="en-lini">Iniciativa<select id="en-ini"></select></label>' +
        '<span class="act"><button id="en-nueva" class="u-btn u-btn-accion" type="button" hidden>Nueva entrega</button>' +
        '<button id="en-rec" class="sec recarga" type="button" title="Traer lo último" aria-label="Traer lo último">' + ICO_RECARGAR + '</button></span>' +
        '</div>' +
        '<div id="en-vmapa"><p id="mp-res" class="mp-res" aria-live="polite"></p>' +
        '<div class="mp-cuerpo"><div class="mp-izq"><div id="mp-marco" class="mp-marco" tabindex="0" aria-label="Mapa de las entregas en el tiempo"></div>' +
        '<ul class="mp-ley">' + GRUPOS.map(function (g) { return '<li class="' + g.cls + '">' + texto(g.varias) + '</li>'; }).join('') +
        '<li class="mp-ley-lim">fecha límite</li><li class="mp-ley-cola">vencida</li><li class="mp-ley-f">espera a</li><li class="mp-ley-sin">fecha calculada</li></ul>' +
        '<details class="mp-ayuda"><summary>Cómo se lee el mapa</summary><ul>' +
        '<li>Cada caja es una entrega: empieza en su fecha de inicio y acaba en su fecha límite (la bandera).</li>' +
        '<li>Si no tiene fecha de inicio, empieza cuando se empezó a trabajar en ella (borde de puntos).</li>' +
        '<li>«K5 espera a U19»: K5 tiene tareas que no pueden empezar hasta que se acaben tareas de U19.</li>' +
        '<li>Pulsa una caja para ver sus tareas y qué espera.</li></ul></details></div>' +
        '<aside id="mp-det" class="mp-det" hidden></aside></div></div>' +
        '<div id="en-lista" class="en-lista" hidden></div>' +
        // T0417: la ficha de una entrega (como la de una tarea) y la ventanita para crearla o para lo que pide un estado.
        '<div class="fv-velo" id="en-fv"><div class="fv-caja kb-ficha" role="dialog" aria-modal="true" aria-labelledby="en-f-tit" id="en-ficha"></div></div>' +
        '<div id="alta-velo"><form id="alta-form" novalidate></form></div></section>';
      var $ = function (id) { return el.querySelector('#' + id); };
      var sec = el.querySelector('.mp'), marco = $('mp-marco'), det = $('mp-det');
      var fv = $('en-fv'), fcaja = $('en-ficha'), altaVelo = $('alta-velo'), altaForm = $('alta-form');

      function datos() {
        return { entregas: ctx.tablas.filas(TE), iniciativas: ctx.tablas.filas(TI), tareas: ctx.tablas.filas(T), deps: ctx.tablas.filas(TD), bitacora: ctx.tablas.filas(TB) };
      }

      function caja(c) {
        var e = c.e, cls = 'mp-caja' + (e.ESTADO === 'Entregada' ? ' mp-entregada' : e.ESTADO === 'Aplazada' || e.ESTADO === 'Descartada' ? ' mp-aplazada' : c.empezada ? ' mp-encurso' : '') +
          (c.marcas.retraso ? ' mp-vencida' : '') + (c.tramo.sinIni ? ' mp-sin-ini' : '') + (c.tramo.sinFin ? ' mp-sin-fin' : '') + (c.id === sel ? ' sel' : '');
        var p = c.prog, av = avisosDe(c);
        var fecha = e.ESTADO === 'Entregada' ? 'Entregada' + (e.FECHA_ENTREGA ? ' el ' + fechaEs(e.FECHA_ENTREGA).slice(0, 5) : '') :
          e.FECHA_PREVISTA ? 'Límite ' + fechaEs(e.FECHA_PREVISTA).slice(0, 5) : 'Sin fecha límite';
        var estado = e.ESTADO === 'Planificada' && c.empezada ? 'Empezada' : e.ESTADO;
        var aria = c.corto + ' · ' + e.NOMBRE + ' · ' + e.ESTADO + '. ' + (p.total ? p.hechas + ' de ' + p.total + ' tareas entregadas' : 'Sin tareas') + '. ' + fecha +
          (av.length ? '. ' + av.map(function (a) { return a.txt; }).join(', ') : '');
        var lim = c.limite ? '<span class="mp-lim' + (c.marcas.retraso ? ' vencida' : '') + '" style="left:' + c.limite.x + 'px;top:' + (c.y - M.bandera) + 'px;height:' + (c.h + M.bandera) + 'px" aria-hidden="true">' +
          '<span>' + ICO_BANDERA + fechaEs(c.limite.fecha).slice(0, 5) + '</span></span>' : '';
        return lim + (c.cola ? '<span class="mp-cola" style="left:' + c.cola.x + 'px;top:' + (c.y + 8) + 'px;width:' + c.cola.w + 'px;height:' + (c.h - 16) + 'px" aria-hidden="true"></span>' : '') +
          '<button type="button" class="' + cls + '" data-e="' + texto(c.id) + '" style="left:' + c.x + 'px;top:' + c.y + 'px;width:' + c.w + 'px;height:' + c.h + 'px" aria-label="' + texto(aria) + '" aria-pressed="' + (c.id === sel) + '">' +
          '<span class="mp-cn"><b>' + texto(c.corto) + '</b> ' + texto(e.NOMBRE) + '</span>' +
          '<span class="mp-sub">' + texto(e.QUE_INCLUYE || '') + '</span>' + barra(p) +
          '<span class="mp-pie"><span class="mp-num">' + (p.total ? p.hechas + ' de ' + p.total + ' hechas · ' + p.pct + ' %' : 'Sin tareas') + '</span><span class="mp-fe">' + texto(estado) + '</span></span>' +
          (av.length ? '<span class="mp-avs">' + av.map(function (a) { return '<span class="' + a.cls + '">' + texto(a.txt) + '</span>'; }).join('') + '</span>' : '') +
          '</button>';
      }

      function pintarMapa() {
        var ancho = marco.clientWidth || 0;
        anchoVisto = ancho;
        P = plano(datos(), { hoy: hoyIso(), ancho: ancho, ver: F.ver, ini: F.ini });
        if (sel && !P.cajas.some(function (c) { return c.id === sel; })) cerrarDetalle(true);
        var r = P.resumen, partes = [];
        if (r.entregas) {
          partes.push(r.enMarcha === 1 ? '1 entrega en marcha' : r.enMarcha + ' entregas en marcha');
          if (r.vencidas) partes.push('<b class="mp-rojo">' + (r.vencidas === 1 ? '1 vencida' : r.vencidas + ' vencidas') + '</b>');
          if (r.atascadas) partes.push('<b class="mp-ambar">' + (r.atascadas === 1 ? '1 con atascos' : r.atascadas + ' con atascos') + '</b>');
          if (r.esperas) partes.push(r.esperas === 1 ? '1 espera entre entregas' : r.esperas + ' esperas entre entregas');
        }
        $('mp-res').innerHTML = partes.join(' · ');
        if (!P.cajas.length) {
          marco.innerHTML = '<div class="en-msg">' + (!ctx.tablas.filas(TE).length ? (leido ? 'No ves ninguna entrega todavía.' : 'Cargando el mapa…') : 'Ninguna entrega con estos filtros.') + '</div>';
          return;
        }
        var scroll = marco.scrollLeft;
        var rel = {};
        if (sel) { rel[sel] = 1; P.flechas.forEach(function (f) { if (f.de === sel) rel[f.a] = 1; if (f.a === sel) rel[f.de] = 1; }); }
        var h = '<div class="mp-lienzo' + (sel ? ' con-sel' : '') + '" style="width:' + P.ancho + 'px;height:' + P.alto + 'px">';
        // Los nombres de los carriles se quedan a la vista al deslizar (sticky dentro del lienzo).
        h += '<div class="mp-titulos" style="height:' + P.alto + 'px">' + P.carriles.map(function (k) {
          return '<div class="mp-ct" style="top:' + (k.y + 4) + 'px"><b>' + texto(k.nombre) + '</b>' + (k.estado && k.estado !== 'Activa' ? ' <small>' + texto(k.estado) + '</small>' : '') +
            (k.sinFecha.length ? '<span class="mp-sinf">Sin fechas: ' + k.sinFecha.map(function (c) {
              return '<button type="button" class="mp-chip' + (c.id === sel ? ' sel' : '') + '" data-e="' + texto(c.id) + '">' + texto(c.corto + ' ' + c.e.NOMBRE) + '</button>';
            }).join('') + '</span>' : '') + '</div>';
        }).join('') + '</div>';
        h += P.meses.map(function (m, k) {
          return '<div class="mp-mes' + (k % 2 ? ' par' : '') + '" style="left:' + Math.round(m.x) + 'px;width:' + Math.round(m.w) + 'px;height:' + P.alto + 'px"><span>' + texto(m.txt) + '</span></div>';
        }).join('');
        h += P.carriles.map(function (k, n) { return n ? '<div class="mp-sep" style="top:' + k.y + 'px"></div>' : ''; }).join('');
        h += '<div class="mp-hoy" style="left:' + P.hoyX + 'px;height:' + (P.alto - M.cab + 18) + 'px"><span>Hoy ' + fechaEs(P.hoy).slice(0, 5) + '</span></div>';
        h += P.cajas.filter(function (c) { return c.x != null; }).map(caja).join('');
        h += '<svg class="mp-flechas" width="' + P.ancho + '" height="' + P.alto + '" aria-hidden="true"><defs>' +
          '<marker id="mp-punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z"/></marker></defs>' +
          P.flechas.filter(function (f) { return f.d; }).map(function (f) {
            var c = 'mp-f' + (f.abiertas ? '' : ' hecha') + (sel && (f.de === sel || f.a === sel) ? ' sel' : '');
            return '<path class="' + c + '" d="' + f.d + '" marker-end="url(#mp-punta)"></path>';
          }).join('') + '</svg>';
        // En medio de cada flecha, quién espera a quién («K5 espera a U19»); cuántas tareas y cuáles, al pasar por encima y en el detalle.
        h += P.flechas.filter(function (f) { return f.d && f.mx != null; }).map(function (f) {
          var t = nombreCorto(f.a).split(' · ')[0] + ' espera a ' + nombreCorto(f.de).split(' · ')[0] + ': ' +
            (f.abiertas === 1 ? '1 tarea espera' : f.abiertas + ' tareas esperan') + ' (' + f.pares.filter(function (q) { return !CERRADA[q.de.ESTADO]; }).map(function (q) { return q.tarea.ID + ' a ' + q.de.ID; }).join(', ') + ')';
          return '<button type="button" class="mp-fn' + (sel && (f.de === sel || f.a === sel) ? ' sel' : '') + '" data-e="' + texto(f.a) + '" style="left:' + f.mx + 'px;top:' + f.my + 'px" title="' + texto(t) + '" aria-label="' + texto(t) + '">' +
            texto(nombreCorto(f.a).split(' · ')[0] + ' espera a ' + nombreCorto(f.de).split(' · ')[0]) + '</button>';
        }).join('');
        h += '</div>';
        marco.innerHTML = h;
        [].forEach.call(marco.querySelectorAll('.mp-caja'), function (b) { if (sel && !rel[b.getAttribute('data-e')]) b.classList.add('lejos'); });
        if (primera && marco.clientWidth) { primera = false; marco.scrollLeft = Math.max(0, P.hoyX - marco.clientWidth * 0.25); }
        else marco.scrollLeft = scroll;
      }

      function nombreCorto(id) {
        var c = P && P.cajas.filter(function (x) { return x.id === id; })[0];
        return c ? c.corto + ' · ' + c.e.NOMBRE : id;
      }
      /** Una tarea en el detalle: su ID y su título, que abren su ficha; quién la tiene y, si venció, su deadline, debajo y en pequeño. */
      function tareaLi(x, hoy) {
        var v = !CERRADA[x.ESTADO] && x.ESTADO !== 'Aplazada' && dia(x.DEADLINE) && dia(x.DEADLINE) < hoy;
        var bajo = [x.EN_MANOS_NOMBRE || '', v ? 'venció el ' + fechaEs(x.DEADLINE).slice(0, 5) : ''].filter(Boolean);
        return '<li><a href="?s=tablero&amp;t=' + encodeURIComponent(x.ID) + '" data-sx="TABLERO"><span class="id">' + texto(x.ID) + '</span> ' + texto(x.TITULO) + '</a>' +
          (bajo.length ? '<small' + (v ? ' class="mp-rojo"' : '') + '>' + texto(bajo.join(' · ')) + '</small>' : '') + '</li>';
      }

      /**
       * El detalle de una entrega, para leerlo de un vistazo: arriba el avance, la fecha límite y desde cuándo se trabaja;
       * sus avisos, qué incluye, a qué entregas espera y cuáles la esperan (solo lo abierto, sin el detalle de cada tarea) y
       * sus tareas por estado, una por línea (las entregadas y descartadas, plegadas).
       */
      function pintarDetalle() {
        var c = P && P.cajas.filter(function (x) { return x.id === sel; })[0];
        if (!c) { det.hidden = true; sec.classList.remove('con-det'); return; }
        var e = c.e, p = c.prog, t = c.tramo, hoy = P.hoy;
        var estado = e.ESTADO === 'Planificada' && c.empezada ? 'Empezada' : e.ESTADO;
        var h = '<div class="mp-dcab"><div class="en-top"><span class="en-corto">' + texto(c.corto) + '</span><span class="en-est">' + texto(estado) + '</span></div>' +
          '<button id="mp-cer" type="button" class="sec recarga" title="Cerrar" aria-label="Cerrar el detalle">' + ICO_CERRAR + '</button></div>' +
          '<h3 class="en-t">' + texto(e.NOMBRE) + '</h3>' +
          '<p class="mp-dficha"><button type="button" class="u-btn" data-ficha="' + texto(c.id) + '">' + (lleva(e.INICIATIVA) ? 'Cambiar o mover' : 'Abrir la ficha') + '</button></p>';
        // Las tres cifras: avance, fecha límite y desde cuándo.
        var limite = '', inicio = '';
        if (e.ESTADO === 'Entregada') limite = e.FECHA_ENTREGA ? 'Entregada el ' + fechaEs(e.FECHA_ENTREGA) : 'Entregada';
        else if (dia(e.FECHA_PREVISTA)) {
          var n = diasEntre(hoy, e.FECHA_PREVISTA);
          limite = fechaEs(e.FECHA_PREVISTA) + (enMarcha(e) ? ' · ' + (n === 0 ? 'es hoy' : n > 0 ? (n === 1 ? 'falta 1 día' : 'faltan ' + n + ' días') : 'venció hace ' + diasTxt(-n)) : '');
        } else limite = 'Sin fecha';
        if (dia(e.FECHA_INICIO)) inicio = fechaEs(e.FECHA_INICIO);
        else if (t && t.iniDe === 'trabajo') inicio = fechaEs(t.ini) + ' (primera tarea en marcha)';
        else inicio = 'Aún no';
        h += '<dl class="mp-dcifras">' +
          '<div><dt>Avance</dt><dd>' + (p.total ? '<b>' + p.hechas + ' de ' + p.total + '</b> hechas · ' + p.pct + ' %' : 'Sin tareas') + '</dd></div>' +
          '<div' + (t && t.retraso ? ' class="mp-rojo"' : '') + '><dt>Fecha límite</dt><dd>' + texto(limite) + '</dd></div>' +
          '<div><dt>Empezó</dt><dd>' + texto(inicio) + '</dd></div></dl>';
        if (p.total) h += '<div class="en-barra">' + GRUPOS.map(function (g) { return p.n[g.id] ? '<span class="' + g.cls + '" style="flex-grow:' + p.n[g.id] + '"></span>' : ''; }).join('') + '</div>';
        var av = avisosDe(c);
        if (av.length) h += '<p class="mp-avs mp-davs">' + av.map(function (a) { return '<span class="' + a.cls + '">' + texto(a.txt) + '</span>'; }).join('') + '</p>';
        if (e.QUE_INCLUYE) h += '<p class="mp-dinc">' + texto(e.QUE_INCLUYE) + '</p>';
        // Esperas: solo las abiertas y solo las entregas (qué tareas, en la ficha de cada una).
        function esperas(titulo, fl, otra) {
          fl = fl.filter(function (f) { return f.abiertas; });
          if (!fl.length) return '';
          return '<h4 class="mp-dh">' + titulo + '</h4><ul class="mp-desp">' + fl.map(function (f) {
            return '<li><button type="button" class="mp-ir" data-e="' + texto(f[otra]) + '">' + texto(nombreCorto(f[otra])) + '</button> <small>' +
              (f.abiertas === 1 ? '1 tarea' : f.abiertas + ' tareas') + '</small></li>';
          }).join('') + '</ul>';
        }
        h += esperas('Espera a', P.flechas.filter(function (f) { return f.a === c.id; }), 'de') + esperas('La esperan', P.flechas.filter(function (f) { return f.de === c.id; }), 'a');
        // Tareas, por estado (como en la lista): lo abierto a la vista, lo cerrado plegado.
        if (c.tareas.length) {
          var abiertas = ORDEN_TAREAS.filter(function (s) { return !CERRADA[s]; }), cerradas = ORDEN_TAREAS.filter(function (s) { return CERRADA[s]; });
          var grupo = function (s) {
            var de = c.tareas.filter(function (x) { return x.ESTADO === s; }).sort(function (a, b) { return String(a.ID).localeCompare(String(b.ID)); });
            return de.length ? '<h5 class="' + (CLS[s] || 's-x') + '">' + texto(s) + ' · ' + de.length + '</h5><ul class="mp-ts">' + de.map(function (x) { return tareaLi(x, hoy); }).join('') + '</ul>' : '';
          };
          var nc = c.tareas.filter(function (x) { return CERRADA[x.ESTADO]; }).length;
          h += '<h4 class="mp-dh">Tareas</h4>' + abiertas.map(grupo).join('') +
            (nc ? '<details class="mp-dcerr"><summary>' + (nc === 1 ? 'Ver la cerrada' : 'Ver las ' + nc + ' cerradas') + '</summary>' + cerradas.map(grupo).join('') + '</details>' : '');
        }
        det.innerHTML = h;
        det.hidden = false;
        sec.classList.add('con-det');
      }

      function seleccionar(id) {
        var antes = sel;
        sel = sel === id ? '' : id;
        pintarDetalle();
        pintarMapa(); // con el detalle al lado, el mapa tiene otro ancho
        if (sel) {
          pintarDetalle();
          if (!antes && window.matchMedia && !window.matchMedia('(min-width: 1200px)').matches && det.scrollIntoView) det.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      }
      function cerrarDetalle(sinPintar) {
        sel = ''; det.hidden = true; det.innerHTML = ''; sec.classList.remove('con-det');
        if (!sinPintar) pintarMapa();
      }

      /* ---------- Lista: una tarjeta por entrega ---------- */
      function tarjeta(e) {
        var ts = ctx.tablas.filas(T).filter(function (t) { return t.ENTREGA === e.ID; });
        var i = ctx.tablas.fila(TI, e.INICIATIVA), corto = ((i && i.INICIAL) || '') + e.NUMERO, p = progreso(ts), n = p.n, total = p.total, hechas = p.hechas, pct = p.pct;
        var h = '<article class="en-c' + (e.ESTADO === 'Aplazada' || e.ESTADO === 'Descartada' ? ' en-aplazada' : e.ESTADO === 'Entregada' ? ' en-entregada' : '') + '">' +
          '<div class="en-top"><span class="en-corto">' + texto(corto) + '</span><span class="en-est">' + texto(e.ESTADO) + '</span>' +
          (i && ctx.tablas.filas(TI).length > 1 ? '<span class="en-cli">' + texto(i.NOMBRE || i.ID) + '</span>' : '') + '</div>' +
          '<h3 class="en-t">' + texto(e.NOMBRE) + '</h3>' +
          '<div class="en-pct">' + (total ? '<b>' + hechas + ' de ' + total + '</b> ' + (total === 1 ? 'tarea entregada' : 'tareas entregadas') + '<span class="en-num">' + pct + ' %</span>' : 'Sin tareas todavía') + '</div>' +
          '<div class="en-barra" role="img" aria-label="' + texto(total ? pct + ' % entregado: ' + GRUPOS.filter(function (g) { return n[g.id]; }).map(function (g) { return cuantas(n[g.id], g); }).join(', ') : 'Sin tareas') + '">' +
            GRUPOS.map(function (g) { return n[g.id] ? '<span class="' + g.cls + '" style="flex-grow:' + n[g.id] + '" title="' + texto(cuantas(n[g.id], g)) + '"></span>' : ''; }).join('') + '</div>' +
          (total ? '<ul class="en-ley">' + GRUPOS.filter(function (g) { return n[g.id]; }).map(function (g) { return '<li class="' + g.cls + '">' + texto(cuantas(n[g.id], g)) + '</li>'; }).join('') + '</ul>' : '');
        var f = '', cf = '', q = cuanto(e.FECHA_PREVISTA);
        if (e.ESTADO === 'Entregada') f = e.FECHA_ENTREGA ? 'Entregada el ' + fechaEs(e.FECHA_ENTREGA) : 'Entregada';
        else if (e.ESTADO === 'Descartada') f = 'Descartada';
        else if (q) {
          f = (e.ESTADO === 'Aplazada' ? 'Aplazada; prevista el ' : 'Prevista el ') + fechaEs(e.FECHA_PREVISTA) + ' · ' + q.txt;
          if (e.ESTADO !== 'Aplazada') cf = q.n < 0 ? ' vencida' : q.n <= 7 ? ' pronto' : '';
        } else f = 'Sin fecha prevista';
        h += '<div class="en-fecha' + cf + '">' + texto(f) + '</div>';
        if (e.QUE_INCLUYE) h += '<p class="en-inc">' + texto(e.QUE_INCLUYE) + '</p>';
        if (e.CRITERIO) h += '<p class="en-inc"><b>Terminada cuando:</b> ' + texto(e.CRITERIO) + '</p>';
        if (e.RESUMEN) h += '<p class="en-inc en-res">' + texto(e.RESUMEN) + '</p>';
        h += '<p class="en-acc"><button type="button" class="sec" data-ficha="' + texto(e.ID) + '">' + (lleva(e.INICIATIVA) ? 'Cambiar o mover' : 'Abrir la ficha') + '</button></p>';
        if (ts.length) {
          var que = ts.length === 1 ? 'la tarea' : 'las ' + ts.length + ' tareas';
          h += '<details class="en-tareas"><summary data-que="' + texto(que) + '">Ver ' + texto(que) + '</summary>' +
            DESPLEGAR.map(function (s) {
              var de = ts.filter(function (t) { return t.ESTADO === s; });
              if (!de.length) return '';
              de.sort(function (a, b) { return s === 'Entregada' ? String(b.FECHA_CIERRE || '').localeCompare(String(a.FECHA_CIERRE || '')) : String(a.ID).localeCompare(String(b.ID)); });
              return '<h4 class="' + CLS[s] + '">' + texto(s) + ' · ' + de.length + '</h4><ul>' + de.map(function (t) {
                return '<li><a href="?s=tablero&amp;t=' + encodeURIComponent(t.ID) + '" data-sx="TABLERO"><span class="id">' + texto(t.ID) + '</span> ' + texto(t.TITULO) + '</a>' +
                  (t.EN_MANOS_NOMBRE ? '<span class="en-quien">' + texto(t.EN_MANOS_NOMBRE) + '</span>' : '') + '</li>';
              }).join('') + '</ul>';
            }).join('') + '</details>';
        }
        return h + '</article>';
      }
      function pintarLista() {
        var EL = ctx.tablas.filas(TE).slice();
        var ls = EL.filter(function (e) { return (F.ver === 'Todas' || grupoDe(e) === F.ver) && (!F.ini || e.INICIATIVA === F.ini); });
        // Primero las que están en marcha, después las aplazadas, las entregadas y las descartadas. Las que aún se hacen, por
        // fecha prevista (la más cercana arriba); las cerradas, por número, de la última a la primera.
        var orden = { 'En marcha': 0, 'Aplazadas': 1, 'Entregadas': 2, '': 3 };
        ls.sort(function (a, b) {
          var ga = orden[grupoDe(a)], gb = orden[grupoDe(b)];
          if (ga !== gb) return ga - gb;
          if (ga >= 2) return String(a.INICIATIVA).localeCompare(String(b.INICIATIVA)) || Number(b.NUMERO) - Number(a.NUMERO);
          return String(a.FECHA_PREVISTA || '9999').localeCompare(String(b.FECHA_PREVISTA || '9999')) || Number(a.NUMERO) - Number(b.NUMERO);
        });
        var l = $('en-lista');
        if (!EL.length) l.innerHTML = '<div class="en-msg">' + (leido ? 'No ves ninguna entrega todavía.' : 'Cargando las entregas…') + '</div>';
        else if (!ls.length) l.innerHTML = '<div class="en-msg">Ninguna entrega con estos filtros.</div>';
        else l.innerHTML = ls.map(tarjeta).join('');
      }

      /* ---------- T0417 · crear, cambiar y mover: la ficha de una entrega ----------
       * Como la ficha de una tarea: cada dato se cambia pulsándolo (cambiar_entrega), el estado desde arriba (mover_entrega, que
       * pide el resumen al entregar y el motivo al aplazar, descartar o corregir) y su bitácora debajo. Crea, cambia y mueve
       * quien lleva la iniciativa (responsable o admin); corregir una entregada o descartada, solo admin. La base es la que
       * dice que no: aquí solo se evita ofrecer lo que no dejará. */
      var ROLES = ctx.roles || [];
      function lleva(ini) {
        return !!ctx.admin || ROLES.some(function (r) {
          return (r.rol === 'admin' || r.rol === 'responsable') && (r.ambito === 'todo' || (r.ambito === 'iniciativa' && r.ambito_id === ini));
        });
      }
      function iniciativasQueLlevo() { return ctx.tablas.filas(TI).filter(function (i) { return lleva(i.ID) && i.ESTADO !== 'Cerrada'; }); }
      function cortoDe(e) { var i = ctx.tablas.fila(TI, e.INICIATIVA); return ((i && i.INICIAL) || '') + (e.NUMERO == null ? '' : e.NUMERO); }
      function sinPrefijo(m) { return String(m || '').replace(/^\w+:\s*/, ''); }
      var fichaId = '', cambiando = '';
      var CLS_E = { 'Planificada': 's-ni', 'En curso': 's-ec', 'Entregada': 's-co', 'Aplazada': 's-x', 'Descartada': 's-x' };
      var LARGOS = { QUE_INCLUYE: 3, CRITERIO: 3, RESUMEN: 4 };

      function abrirFicha(id, sinUrl) {
        if (!ctx.tablas.fila(TE, id)) return;
        fichaId = id; cambiando = '';
        pintarFicha();
        fv.classList.add('abierto');
        document.documentElement.classList.add('fv-abierta');
        if (!sinUrl) urlFicha(id);
        var b = fcaja.querySelector('.volver'); if (b) b.focus();
        bitacoraE(id);
      }
      function cerrarFicha() {
        if (!fichaId) return;
        fichaId = ''; cambiando = '';
        fv.classList.remove('abierto');
        if (!altaVelo.classList.contains('abierto')) document.documentElement.classList.remove('fv-abierta');
        urlFicha('');
      }
      function urlFicha(id) {
        try {
          var u = new URL(location.href);
          if (id) u.searchParams.set('e', id); else u.searchParams.delete('e');
          history.replaceState(history.state, '', u.pathname + u.search);
        } catch (x) {}
      }
      /** La bitácora de esta entrega, solo la suya. */
      function bitacoraE(id, fresco) {
        var p = { BITACORA: { clave: 'E:' + id, col: 'ENTREGA', valores: [id] } };
        return (fresco ? ctx.tablas.leer([TB], { partes: p, fresco: true }) : ctx.tablas.leer([TB], { partes: p })).then(function () {
          if (ctx.abierta() && fichaId === id && !cambiando) pintarFicha();
        }, function (e) { if (ctx.abierta() && fichaId === id) ctx.aviso('No se ha podido leer la bitácora: ' + sinPrefijo(e.message)); });
      }
      /** Tras escribir: las entregas y, si está abierta, su bitácora. */
      function alDia(id) {
        return Promise.all([ctx.tablas.refrescar([TE], true), fichaId === id ? bitacoraE(id, true) : null]).catch(function () {});
      }

      /** El control con el que se cambia el dato k. */
      function control(e, k) {
        var lab = ' aria-label="' + texto(NOMBRE_E[k] || k) + '"';
        if (/^FECHA_/.test(k)) return '<input type="date" id="fed" value="' + texto(dia(e[k])) + '"' + lab + '>';
        if (LARGOS[k]) return '<textarea id="fed" rows="' + LARGOS[k] + '"' + lab + '>' + texto(e[k] || '') + '</textarea>' +
          '<div class="pie"><button type="button" class="sec" data-fed-no>Cancelar</button><button type="button" class="accion" data-fed-ok>Guardar</button></div>';
        return '<input type="text" id="fed" autocomplete="off" maxlength="' + (LARGO_MAX + 20) + '" value="' + texto(e[k] || '') + '"' + lab + '>';
      }
      function abrirCampo(k) {
        cambiando = k; pintarFicha();
        var x = fcaja.querySelector('#fed');
        if (!x) return;
        x.focus();
        if (x.type === 'text') x.select();
      }
      function cerrarCampo() {
        var k = cambiando; cambiando = ''; pintarFicha();
        var x = fcaja.querySelector('[data-ed="' + k + '"]'); if (x) x.focus();
      }
      function guardarCampo(k, v) {
        var e = ctx.tablas.fila(TE, fichaId);
        if (!e || !k) return;
        var r = cambioEntrega(e, k, v);
        if (r && r.mal) { ctx.aviso(r.mal); var x = fcaja.querySelector('#fed'); if (x) x.focus(); return; }
        var id = e.ID, corto = cortoDe(e);
        if (r) ctx.tablas.actualizar(TE, id, r.cambios, { fn: 'cambiar_entrega', args: [{ entrega: id, campos: r.campos }] }).then(function () {
          if (ctx.abierta()) ctx.aviso(corto + ' guardada.');
          return alDia(id);
        }, function () {});
        cerrarCampo();
      }
      function anotarE(id, txt, b) {
        b.disabled = true;
        ctx.llamar('cambiar_entrega', [{ entrega: id, nota: txt }]).then(function () {
          if (!ctx.abierta()) return;
          var a = fcaja.querySelector('#en-nota'); if (a) a.value = '';
          return bitacoraE(id, true);
        }, function (e) { if (ctx.abierta()) ctx.aviso('No se ha apuntado: ' + sinPrefijo(e.message)); })
          .then(function () { b.disabled = false; });
      }

      /** Mover: lo que no dejará la base se dice aquí; lo que pide el estado, en la ventanita; lo demás, al momento. */
      function moverE(id, nuevo) {
        var e = ctx.tablas.fila(TE, id);
        if (!e || e.ESTADO === nuevo) return;
        if (nuevo === 'En curso') {
          var ya = enCursoDe(ctx.tablas.filas(TE), e.INICIATIVA, id);
          if (ya.length >= MAX_EN_CURSO) {
            ctx.aviso('Como mucho ' + MAX_EN_CURSO + ' entregas En curso por iniciativa, y ya lo están ' + ya.map(function (x) { return cortoDe(x) + ' · ' + x.NOMBRE; }).join(' y ') +
              '. Pasa antes una de ellas a Entregada, Planificada o Aplazada.');
            pintarFicha(); return;
          }
        }
        var q = pideEntrega(e.ESTADO, nuevo);
        if (q) { pedir(e, nuevo, q); pintarFicha(); return; }
        enviar(e, nuevo, {});
      }
      function enviar(e, nuevo, x) {
        var id = e.ID, corto = cortoDe(e), args = { entrega: id, estado: nuevo }, local = { ESTADO: nuevo, FECHA_ENTREGA: nuevo === 'Entregada' ? hoyIso() : '' };
        if (x.texto) args.texto = x.texto;
        if (x.resumen) { args.resumen = x.resumen; local.RESUMEN = x.resumen; }
        ctx.tablas.actualizar(TE, id, local, { fn: 'mover_entrega', args: [args] }).then(function () {
          if (ctx.abierta()) ctx.aviso(corto + ' pasa a ' + nuevo + '.');
          return alDia(id);
        }, function () {});
      }
      /** La ventanita con lo que pide el estado: el resumen al entregar, el motivo al aplazar, descartar o corregir. */
      function pedir(e, nuevo, q) {
        var corto = cortoDe(e), ts = ctx.tablas.filas(T).filter(function (t) { return t.ENTREGA === e.ID && !CERRADA[t.ESTADO]; });
        var tit = q === 'resumen' ? 'Entregar ' + corto : q === 'corregir' ? 'Corregir ' + corto : (nuevo === 'Aplazada' ? 'Aplazar ' : 'Descartar ') + corto;
        var ayuda = q === 'resumen' ? 'Pasa a Entregada cuando se cumple su criterio, no al acabar sus tareas. No vuelve atrás.' :
          q === 'corregir' ? 'Solo si se marcó como ' + e.ESTADO.toLowerCase() + ' por error: vuelve a ' + nuevo + ' y queda en la bitácora.' :
          nuevo === 'Aplazada' ? 'Se deja para más adelante; sus tareas siguen como están.' : 'No se va a hacer. Solo se corrige si fue un error.';
        var h = '';
        if (q === 'resumen') {
          if (e.CRITERIO) h += '<div class="campo"><span class="lab">Terminada cuando</span><p class="u-nota">' + texto(e.CRITERIO) + '</p></div>';
          if (ts.length) h += '<p class="u-nota"><b>' + (ts.length === 1 ? 'Le queda 1 tarea sin cerrar' : 'Le quedan ' + ts.length + ' tareas sin cerrar') + '</b>: siguen como están.</p>';
          h += '<div class="campo"><label class="lab" for="en-d-res">Cómo fue</label><textarea id="en-d-res" rows="4" required>' + texto(e.RESUMEN || '') + '</textarea>' +
            '<div class="ayuda">Lo que se entregó y lo que quedó fuera, en dos o tres líneas.</div></div>';
        } else {
          h = '<div class="campo"><label class="lab" for="en-d-mo">' + (q === 'corregir' ? 'Qué se marcó por error' : 'Por qué') + '</label><textarea id="en-d-mo" rows="3" required></textarea></div>';
        }
        altaForm.innerHTML = '<h2>' + texto(tit) + '</h2><p class="u-nota">' + texto(ayuda) + '</p><div class="edit">' + h + '</div><div id="alta-error" role="alert"></div>' +
          '<div class="botones"><button type="button" class="sec" data-cancelar-alta>Cancelar</button><button type="submit" class="pri">' +
          texto(q === 'corregir' ? 'Volver a ' + nuevo : 'Pasar a ' + nuevo) + '</button></div>';
        abrirVelo();
        altaForm.onsubmit = function (ev) {
          ev.preventDefault();
          var v = function (i) { var x = altaForm.querySelector('#' + i); return x ? x.value.trim() : ''; };
          var x = { resumen: v('en-d-res'), texto: v('en-d-mo') };
          var mal = q === 'resumen' && !x.resumen ? 'Escribe cómo fue.' : q !== 'resumen' && !x.texto ? (q === 'corregir' ? 'Di qué se marcó por error.' : 'Di por qué.') : '';
          if (mal) { altaForm.querySelector('#alta-error').textContent = mal; return; }
          cerrarVelo();
          enviar(e, nuevo, x);
        };
      }
      function abrirVelo() {
        altaVelo.classList.add('abierto');
        document.documentElement.classList.add('fv-abierta');
        var p = altaForm.querySelector('input,textarea,select'); if (p) p.focus();
      }
      function cerrarVelo() { altaVelo.classList.remove('abierto'); if (!fichaId) document.documentElement.classList.remove('fv-abierta'); altaForm.onsubmit = null; }
      altaVelo.addEventListener('click', function (ev) { if (ev.target === altaVelo || ev.target.closest('[data-cancelar-alta]')) cerrarVelo(); });
      altaVelo.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); cerrarVelo(); } });

      /** «Nueva entrega»: iniciativa (las que llevas), nombre, fecha límite, qué incluye y cuándo estará terminada. */
      function abrirNueva() {
        var IS = iniciativasQueLlevo();
        if (!IS.length) { ctx.aviso('Crea entregas quien lleva la iniciativa (responsable o admin).'); return; }
        var ini = IS.some(function (i) { return i.ID === F.ini; }) ? F.ini : IS.some(function (i) { return i.ID === 'UTILO'; }) ? 'UTILO' : IS[0].ID;
        var numero = function (x) { var i = ctx.tablas.fila(TI, x); return ((i && i.INICIAL) || '') + siguienteNumero(ctx.tablas.filas(TE), x); };
        altaForm.innerHTML = '<h2>Nueva entrega</h2><div class="edit">' +
          '<div class="campo"><label class="lab" for="en-n-ini">Iniciativa</label><select id="en-n-ini">' + IS.map(function (i) {
            return '<option value="' + texto(i.ID) + '"' + (i.ID === ini ? ' selected' : '') + '>' + texto(i.NOMBRE || i.ID) + '</option>'; }).join('') + '</select>' +
            '<div class="ayuda" id="en-n-num">Será la ' + texto(numero(ini)) + ' (el número lo pone la base).</div></div>' +
          '<div class="campo"><label class="lab" for="en-n-nom">Nombre</label><input type="text" id="en-n-nom" autocomplete="off" required data-limite="' + LARGO_MAX + '">' +
            '<div class="ayuda"><span class="contador" data-cuenta="en-n-nom">0 / ' + LARGO_MAX + '</span> · Corto: «Base nueva», «Temporada 2027».</div></div>' +
          '<div class="campo"><label class="lab" for="en-n-pre">Fecha límite <span class="opc">(opcional)</span></label><input type="date" id="en-n-pre"></div>' +
          '<div class="campo"><label class="lab" for="en-n-inc">Qué incluye <span class="opc">(opcional)</span></label><textarea id="en-n-inc" rows="2"></textarea></div>' +
          '<div class="campo"><label class="lab" for="en-n-cri">Terminada cuando</label><textarea id="en-n-cri" rows="3" required></textarea>' +
            '<div class="ayuda">Algo que se pueda comprobar: «Javi crea una entrega desde la plataforma sin tocar la tabla».</div></div>' +
          '</div><div id="alta-error" role="alert"></div>' +
          '<div class="botones"><button type="button" class="sec" data-cancelar-alta>Cancelar</button><button type="submit" class="pri">Crear entrega</button></div>';
        abrirVelo();
        altaForm.querySelector('#en-n-ini').onchange = function () { altaForm.querySelector('#en-n-num').textContent = 'Será la ' + numero(this.value) + ' (el número lo pone la base).'; };
        altaForm.querySelector('#en-n-nom').oninput = function () {
          var k = altaForm.querySelector('[data-cuenta="en-n-nom"]'), n = this.value.trim().length;
          k.textContent = n + ' / ' + LARGO_MAX; k.classList.toggle('mal', n > LARGO_MAX);
        };
        altaForm.onsubmit = function (ev) {
          ev.preventDefault();
          var v = function (i) { return altaForm.querySelector('#' + i).value; };
          var r = nuevaEntrega({ INICIATIVA: v('en-n-ini'), NOMBRE: v('en-n-nom'), FECHA_PREVISTA: v('en-n-pre'), QUE_INCLUYE: v('en-n-inc'), CRITERIO: v('en-n-cri') });
          var er = altaForm.querySelector('#alta-error'), b = altaForm.querySelector('.pri');
          if (r.mal.length) { er.textContent = r.mal.join(' '); return; }
          b.disabled = true; b.textContent = 'Creando…'; er.textContent = '';
          ctx.llamar('crear_entrega', [{ campos: r.campos }]).then(function (id) {
            return ctx.tablas.refrescar([TE], true).then(function () {
              if (!ctx.abierta()) return;
              cerrarVelo();
              var e = ctx.tablas.fila(TE, id);
              ctx.aviso('Creada ' + (e ? cortoDe(e) + ' · ' + e.NOMBRE : id) + '.');
              if (e && F.ver !== 'En marcha' && F.ver !== 'Todas') { F.ver = 'En marcha'; guardarLocal(CLAVE + '_f', F); }
              pintar();
              abrirFicha(id);
            });
          }, function (e) {
            er.textContent = 'No se ha creado: ' + sinPrefijo(e.message);
            b.disabled = false; b.textContent = 'Crear entrega';
          });
        };
      }
      $('en-nueva').onclick = abrirNueva;

      /** Pone (o quita, con entrega '') la entrega de unas tareas con cambiar_tarea() de la base, la de los chats: cada tarea
       *  lo apunta en su bitácora. Al momento en la pantalla; si la base dice que no, vuelve. de: la entrega de la ficha. */
      function ponerEntrega(ids, entrega, de) {
        var e = ctx.tablas.fila(TE, de), corto = e ? cortoDe(e) : de;
        return Promise.all(ids.map(function (id) {
          return ctx.tablas.actualizar(T, id, { ENTREGA: entrega, ENTREGA_CORTA: entrega ? corto : '' },
            { fn: 'cambiar_tarea', args: [{ tarea: id, campos: { entrega: entrega || null } }] }).then(function () { return null; }, function (x) { return id + ': ' + sinPrefijo(x.message); });
        })).then(function (mal) {
          mal = mal.filter(Boolean);
          var bien = ids.length - mal.length;
          if (ctx.abierta() && bien) ctx.aviso(entrega ? (bien === 1 ? 'Añadida 1 tarea a ' : 'Añadidas ' + bien + ' tareas a ') + corto + '.' :
            (bien === 1 ? ids[0] + ' ya no está en ' : bien + ' tareas ya no están en ') + corto + '.');
          return ctx.tablas.refrescar([T], true).catch(function () {});
        });
      }
      /** La ventanita para añadir tareas: las de su iniciativa sin entrega y sin cerrar, con un buscador y una casilla cada una. */
      function abrirAnadir(id) {
        var e = ctx.tablas.fila(TE, id);
        if (!e) return;
        var corto = cortoDe(e), marcadas = {};
        altaForm.innerHTML = '<h2>Añadir tareas a ' + texto(corto) + '</h2><p class="u-nota">Las de ' + texto((ctx.tablas.fila(TI, e.INICIATIVA) || {}).NOMBRE || e.INICIATIVA) +
          ' que aún no están en ninguna entrega y no se han cerrado.</p><div class="edit">' +
          '<div class="campo"><label class="u-oculto" for="en-a-busca">Buscar</label><input type="search" id="en-a-busca" placeholder="Buscar por título o ID" autocomplete="off"></div>' +
          '<div id="en-a-lista" class="en-a-lista"></div></div><div id="alta-error" role="alert"></div>' +
          '<div class="botones"><button type="button" class="sec" data-cancelar-alta>Cancelar</button><button type="submit" class="pri" disabled>Añadir</button></div>';
        var lista = altaForm.querySelector('#en-a-lista'), b = altaForm.querySelector('.pri');
        function cuenta() { var n = Object.keys(marcadas).length; b.disabled = !n; b.textContent = n ? (n === 1 ? 'Añadir 1 tarea' : 'Añadir ' + n + ' tareas') : 'Añadir'; }
        function pintarLista() {
          var cs = candidatas(ctx.tablas.filas(T), e.INICIATIVA, altaForm.querySelector('#en-a-busca').value);
          lista.innerHTML = cs.length ? cs.map(function (t) {
            return '<label class="en-a-t"><input type="checkbox" value="' + texto(t.ID) + '"' + (marcadas[t.ID] ? ' checked' : '') + '>' +
              '<span><span class="id">' + texto(t.ID) + '</span> ' + texto(t.TITULO) + '<small class="' + (CLS[t.ESTADO] || 's-x') + '">' + texto(t.ESTADO) +
              (t.EN_MANOS_NOMBRE ? ' · ' + texto(t.EN_MANOS_NOMBRE) : '') + '</small></span></label>';
          }).join('') : '<p class="u-nota">' + (altaForm.querySelector('#en-a-busca').value.trim() ? 'Ninguna con eso.' : 'No hay tareas sin entrega en esta iniciativa.') + '</p>';
        }
        altaForm.querySelector('#en-a-busca').oninput = pintarLista;
        lista.onchange = function (ev) { var x = ev.target; if (x.type !== 'checkbox') return; if (x.checked) marcadas[x.value] = 1; else delete marcadas[x.value]; cuenta(); };
        pintarLista();
        abrirVelo();
        altaForm.onsubmit = function (ev) {
          ev.preventDefault();
          var ids = Object.keys(marcadas).sort();
          if (!ids.length) return;
          cerrarVelo();
          ponerEntrega(ids, id, id);
        };
      }

      function pintarFicha() {
        var e = ctx.tablas.fila(TE, fichaId);
        if (!e) { cerrarFicha(); return; }
        var id = e.ID, corto = cortoDe(e), pc = lleva(e.INICIATIVA) && !e._pendiente, hoy = hoyIso();
        if (cambiando && !pc) cambiando = '';
        var ab = function (k) { return pc && cambiando === k; };
        var pulsa = function (k) { return pc ? ' data-ed="' + k + '" tabindex="0" title="' + texto(NOMBRE_E[k] + ': pulsa para cambiar') + '"' : ''; };
        var ts = ctx.tablas.filas(T).filter(function (t) { return t.ENTREGA === id; }), p = progreso(ts);
        var i = ctx.tablas.fila(TI, e.INICIATIVA);

        // Estado: a los que puede pasar (corregir, solo admin).
        var pasos = pc ? pasosEntrega(e.ESTADO, !!ctx.admin) : [];
        var estado = '<div class="est ' + (CLS_E[e.ESTADO] || 's-x') + '">' + (pasos.length ? '<label for="en-f-est">Estado</label><select id="en-f-est">' +
            '<option value="" selected>' + texto(e.ESTADO) + '</option>' + pasos.map(function (x) {
              return '<option value="' + texto(x.estado) + '">' + texto(x.corrige ? 'Volver a ' + x.estado + ' (se marcó por error)' : x.estado) + '</option>'; }).join('') + '</select>'
            : '<span class="fpill">' + texto(e.ESTADO) + '</span>') +
          '<span class="msg">' + (e._pendiente ? 'Guardando…' : texto(p.total ? p.hechas + ' de ' + p.total + (p.total === 1 ? ' tarea hecha' : ' tareas hechas') + ' · ' + p.pct + ' %' : 'Sin tareas todavía')) + '</span></div>';

        // Fechas: empieza, fecha límite y, si está entregada, cuándo.
        var fecha = function (k, val, pista, c) {
          if (ab(k)) return '<div class="ffecha fed-abierto"><small>' + texto(NOMBRE_E[k]) + '</small>' + control(e, k) + '</div>';
          return '<div class="ffecha ' + (c || '') + '"' + pulsa(k) + '><small>' + texto(NOMBRE_E[k]) + '</small><strong>' + texto(val || '—') + '</strong>' +
            (pista ? '<span class="fpista">' + texto(pista) + '</span>' : '') + '</div>';
        };
        var fs = [], n = diasEntre(hoy, e.FECHA_PREVISTA), pista = '', c = '';
        fs.push(fecha('FECHA_INICIO', fechaEs(e.FECHA_INICIO), e.FECHA_INICIO ? '' : 'cuando se empiece a trabajar', e.FECHA_INICIO ? '' : 'nada'));
        if (!dia(e.FECHA_PREVISTA)) { pista = 'sin fecha límite'; c = 'nada'; }
        else if (!enMarcha(e)) c = e.ESTADO === 'Entregada' ? 'ok' : '';
        else if (n < 0) { pista = 'venció hace ' + diasTxt(-n); c = 'venc'; }
        else if (n === 0) { pista = 'es hoy'; c = 'venc'; }
        else { pista = n === 1 ? 'falta 1 día' : 'faltan ' + n + ' días'; c = n <= 7 ? 'pronto' : ''; }
        fs.push(fecha('FECHA_PREVISTA', fechaEs(e.FECHA_PREVISTA), pista, c));
        if (e.ESTADO === 'Entregada') fs.push(fecha('FECHA_ENTREGA', fechaEs(e.FECHA_ENTREGA), '', 'ok'));

        var largo = function (k, vacio) {
          if (ab(k)) return '<div class="bloque fed-abierto"><h3>' + texto(NOMBRE_E[k]) + '</h3><div class="edit">' + control(e, k) + '</div></div>';
          if (!e[k]) return vacio ? '<div class="bloque"' + pulsa(k) + '><h3>' + texto(NOMBRE_E[k]) + '</h3><p class="u-nota">' + texto(vacio) + '</p></div>' : '';
          return '<div class="bloque"' + pulsa(k) + '><h3>' + texto(NOMBRE_E[k]) + '</h3>' + String(e[k]).split('\n').filter(function (l) { return l.trim(); }).map(function (l) { return '<p>' + texto(l) + '</p>'; }).join('') + '</div>';
        };

        // Tareas: las abiertas a la vista, por estado; las cerradas, plegadas.
        var tareasH = '';
        if (ts.length) {
          // Una abierta se puede sacar de la entrega (×): vuelve a no tener entrega. Las cerradas se quedan donde se cerraron.
          var li = function (x) {
            var h = tareaLi(x, hoy);
            return pc && !CERRADA[x.ESTADO] && !x._pendiente ? h.replace(/<\/li>$/, '<button type="button" class="fquitar" data-sacar="' + texto(x.ID) + '" aria-label="Sacar ' +
              texto(x.ID) + ' de la entrega" title="Sacar ' + texto(x.ID) + ' de la entrega">×</button></li>') : h;
          };
          var grupo = function (s) {
            var de = ts.filter(function (x) { return x.ESTADO === s; }).sort(function (a, b) { return String(a.ID).localeCompare(String(b.ID)); });
            return de.length ? '<h5 class="' + (CLS[s] || 's-x') + '">' + texto(s) + ' · ' + de.length + '</h5><ul class="mp-ts">' + de.map(li).join('') + '</ul>' : '';
          };
          var nc = ts.filter(function (x) { return CERRADA[x.ESTADO]; }).length;
          tareasH = ORDEN_TAREAS.filter(function (s) { return !CERRADA[s]; }).map(grupo).join('') +
            (nc ? '<details class="mp-dcerr"><summary>' + (nc === 1 ? 'Ver la cerrada' : 'Ver las ' + nc + ' cerradas') + '</summary>' + ORDEN_TAREAS.filter(function (s) { return CERRADA[s]; }).map(grupo).join('') + '</details>' : '');
        } else tareasH = '<p class="u-nota">Ninguna todavía.' + (pc && !CERRADA[e.ESTADO] ? '' : ' Una tarea se pone en una entrega desde su ficha, en Tareas.') + '</p>';
        // T0417: añadir tareas sin entrega de su iniciativa (no a una entregada o descartada: lo dice la base).
        if (pc && !CERRADA[e.ESTADO]) tareasH += '<button type="button" class="fmas" data-anadir-tareas>+ Añadir tareas</button>';

        var faltan = !pc ? [] : [['FECHA_PREVISTA', !dia(e.FECHA_PREVISTA)], ['QUE_INCLUYE', !e.QUE_INCLUYE], ['RESUMEN', !e.RESUMEN && e.ESTADO !== 'Entregada']]
          .filter(function (x) { return x[1] && cambiando !== x[0]; });
        var anadir = faltan.length ? '<div class="fanadir"><span>Añadir</span>' + faltan.map(function (x) {
          return '<button type="button" class="fmas" data-ed="' + x[0] + '">+ ' + texto(NOMBRE_E[x[0]]) + '</button>'; }).join('') + '</div>' : '';

        var bit = ctx.tablas.filas(TB).filter(function (b) { return b.ENTREGA === id; }).sort(function (a, b) {
          return String(b.CUANDO || '').localeCompare(String(a.CUANDO || '')) || String(b.ID).localeCompare(String(a.ID));
        }).map(function (b) {
          return '<p class="hito"><span class="hito-cuando">' + texto(fechaEs(b.CUANDO) + ' · ' + (b.QUIEN || 'Sistema')) + '</span> ' + texto(b.TEXTO) + '</p>';
        });

        fcaja.innerHTML =
          '<div class="barra"><button type="button" class="volver" data-cerrar>' + ICO_VOLVER + 'Volver a Entregas</button></div>' +
          '<div class="cab"><div class="id"><span class="n">' + texto(corto) + '</span><span class="n">' + texto(id) + '</span></div>' +
            (ab('NOMBRE') ? '<h1 id="en-f-tit" class="fed-abierto">' + control(e, 'NOMBRE') + '</h1>' : '<h1 id="en-f-tit"' + pulsa('NOMBRE') + '>' + texto(e.NOMBRE) + '</h1>') + '</div>' +
          '<div class="fmeta"><span class="ftag">' + texto((i && i.NOMBRE) || e.INICIATIVA) + '</span></div>' + estado +
          '<div class="datos"><div class="fila"><b>Fechas</b><div class="ffechas">' + fs.join('') + '</div></div></div>' +
          largo('CRITERIO', 'Sin criterio: di cuándo estará terminada.') + largo('QUE_INCLUYE') + largo('RESUMEN', e.ESTADO === 'Entregada' ? 'Falta cómo fue.' : '') + anadir +
          '<div class="bloque"><h3>Tareas</h3>' + tareasH + '</div>' +
          '<div class="bloque hist"><h3>Bitácora (lo más reciente arriba)</h3>' +
            (pc ? '<div class="edit"><div class="campo"><label class="u-oculto" for="en-nota">Apuntar una nota</label><textarea id="en-nota" rows="2" placeholder="Apuntar una nota…"></textarea></div>' +
              '<div class="pie"><button type="button" class="sec" data-anotar>Apuntar</button></div></div>' : '') +
            (bit.length ? bit.join('') : '<p class="u-nota">' + (ctx.tablas.tiene && ctx.tablas.tiene(TB, { clave: 'E:' + id }) ? 'Todavía no hay nada apuntado.' : 'Cargando…') + '</p>') + '</div>';
      }

      fv.addEventListener('click', function (ev) {
        if (ev.target === fv || ev.target.closest('[data-cerrar]')) { cerrarFicha(); return; }
        if (TACTIL && cambiando && fcaja.querySelector('input[type=date]#fed') && !ev.target.closest('.fed-abierto')) {
          cerrarCampo(); if (!ev.target.closest('[data-ed],button,a,select,input,textarea')) return;
        }
        if (ev.target.closest('[data-fed-ok]')) { var a0 = fcaja.querySelector('#fed'); if (a0) guardarCampo(cambiando, a0.value); return; }
        if (ev.target.closest('[data-fed-no]')) { cerrarCampo(); return; }
        var d = ev.target.closest('[data-ed]');
        if (d && !ev.target.closest('a')) { abrirCampo(d.getAttribute('data-ed')); return; }
        var b = ev.target.closest('[data-anotar]');
        if (b) { var a = fcaja.querySelector('#en-nota'), txt = a ? a.value.trim() : ''; if (txt) anotarE(fichaId, txt, b); else if (a) a.focus(); return; }
        if (ev.target.closest('[data-anadir-tareas]')) { abrirAnadir(fichaId); return; }
        var sq = ev.target.closest('[data-sacar]');
        if (sq) { ev.preventDefault(); ponerEntrega([sq.getAttribute('data-sacar')], '', fichaId); return; }
        // Una tarea abre su ficha en Tareas: se cierra esta antes de irse.
        if (ev.target.closest('a[data-sx]')) cerrarFicha();
      });
      // En el móvil (sin ratón), una fecha se guarda al elegirla: su calendario le quita el foco, y guardarla al salir la
      // cerraba antes de elegir el día. Se cierra sin cambiarla tocando fuera.
      var TACTIL = !!(window.matchMedia && matchMedia('(hover: none)').matches);
      fv.addEventListener('change', function (ev) {
        if (ev.target.id === 'en-f-est' && ev.target.value) moverE(fichaId, ev.target.value);
        if (TACTIL && ev.target.id === 'fed' && ev.target.type === 'date' && cambiando) guardarCampo(cambiando, ev.target.value);
      });
      // Una fecha o el nombre se guardan al salir (o con Intro); un texto largo, con «Guardar».
      fv.addEventListener('focusout', function (ev) {
        var x = ev.target;
        if (x.id === 'fed' && cambiando && x.isConnected && x.tagName === 'INPUT' && !(TACTIL && x.type === 'date')) guardarCampo(cambiando, x.value);
      });
      fv.addEventListener('keydown', function (ev) {
        if (cambiando && ev.target.id === 'fed') {
          if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); cerrarCampo(); return; }
          if (ev.key === 'Enter' && (ev.target.tagName === 'INPUT' || ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); guardarCampo(cambiando, ev.target.value); }
          return;
        }
        var d = ev.target.getAttribute && ev.target.getAttribute('data-ed');
        if (d && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); abrirCampo(d); return; }
        if (ev.key === 'Escape') { ev.stopPropagation(); if (cambiando) cerrarCampo(); else cerrarFicha(); }
      });

      /* ---------- las dos vistas ---------- */
      function esMapa() { return F.vista === 'Mapa'; }
      function pintar() {
        var IS = ctx.tablas.filas(TI), sl = $('en-ini');
        if (F.ini && !ctx.tablas.fila(TI, F.ini)) F.ini = '';
        sl.innerHTML = '<option value="">Todas</option>' + IS.map(function (i) { return '<option value="' + texto(i.ID) + '"' + (i.ID === F.ini ? ' selected' : '') + '>' + texto(i.NOMBRE || i.ID) + '</option>'; }).join('');
        $('en-lini').style.display = IS.length > 1 ? '' : 'none';
        $('en-nueva').hidden = !iniciativasQueLlevo().length; // T0417: solo quien lleva alguna iniciativa
        $('en-ver').innerHTML = VER.map(function (v) { return '<option' + (v === F.ver ? ' selected' : '') + '>' + v + '</option>'; }).join('');
        [].forEach.call(el.querySelectorAll('[data-vista]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-vista') === F.vista)); });
        $('en-vmapa').hidden = !esMapa();
        $('en-lista').hidden = esMapa();
        if (esMapa()) { pintarMapa(); if (sel) pintarDetalle(); }
        else pintarLista();
      }

      el.addEventListener('click', function (ev) {
        var v = ev.target.closest && ev.target.closest('[data-vista]');
        if (v && el.contains(v)) {
          if (F.vista !== v.getAttribute('data-vista')) { F.vista = v.getAttribute('data-vista'); guardarLocal(CLAVE + '_f', F); pintar(); }
          return;
        }
        var fi = ev.target.closest && ev.target.closest('[data-ficha]');
        if (fi && el.contains(fi)) { ev.preventDefault(); abrirFicha(fi.getAttribute('data-ficha')); return; }
        var b = ev.target.closest && ev.target.closest('[data-e]');
        if (b && el.contains(b) && !fv.contains(b)) { ev.preventDefault(); seleccionar(b.getAttribute('data-e')); return; }
        if (ev.target.closest && ev.target.closest('#mp-cer')) cerrarDetalle();
      });
      el.addEventListener('toggle', function (e) {
        var d = e.target, s = d && d.querySelector && d.querySelector('summary[data-que]');
        if (s) s.textContent = (d.open ? 'Ocultar ' : 'Ver ') + s.getAttribute('data-que');
      }, true);
      el.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && sel && !fichaId && !altaVelo.classList.contains('abierto')) cerrarDetalle(); });
      $('en-ver').onchange = function () { F.ver = this.value; guardarLocal(CLAVE + '_f', F); pintar(); };
      $('en-ini').onchange = function () { F.ini = this.value; guardarLocal(CLAVE + '_f', F); pintar(); };
      $('en-rec').onclick = function () {
        var b = this; b.disabled = true; b.classList.add('girando');
        ctx.tablas.refrescar([TE, TI, T, TD, TB], true).then(function () { if (ctx.abierta()) ctx.aviso('Entregas al día.'); }, function (e) {
          if (ctx.abierta()) ctx.aviso('No se ha podido actualizar: ' + String(e.message).replace(/^\w+:\s*/, ''));
        }).then(function () { b.disabled = false; b.classList.remove('girando'); });
      };
      ctx.alCambiar(function (t) {
        if ([TE, TI, T, TD, TB].indexOf(t) >= 0) pintar();
        if (fichaId && !cambiando && [TE, TI, T, TB].indexOf(t) >= 0) pintarFicha();
      });

      // Si cambia el ancho del marco (llega la hoja de estilos, se gira el móvil, se pliega el menú, se abre el detalle), se
      // vuelve a colocar. Sin ResizeObserver, al cambiar la ventana.
      var tAncho = null, obs = null;
      function alRedimensionar() {
        if (tAncho) clearTimeout(tAncho);
        tAncho = setTimeout(function () { tAncho = null; if (ctx.abierta() && esMapa() && marco.clientWidth && marco.clientWidth !== anchoVisto) pintarMapa(); }, 120);
      }
      if (window.ResizeObserver) { obs = new ResizeObserver(alRedimensionar); obs.observe(marco); }
      else window.addEventListener('resize', alRedimensionar);

      pintar();
      // De la bitácora, solo las líneas que pasan una tarea a En curso o más allá: de ahí sale cuándo empezó cada entrega.
      ctx.tablas.leer([TE, TI, T, TD, TB], { partes: { BITACORA: PARTE_TRABAJO } }).then(function () {
        leido = true;
        if (!ctx.abierta()) return;
        pintar();
        var pedidaE = new URLSearchParams(location.search).get('e'); // T0417: ?e=E0023 abre su ficha
        if (pedidaE && ctx.tablas.fila(TE, pedidaE)) abrirFicha(pedidaE, true);
      }, function (e) {
        leido = true;
        var m = '<p class="u-error">No se han podido leer las entregas.</p><p class="u-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Pulsa ↻ o vuelve a abrir la sección.</p>';
        marco.innerHTML = m; $('en-lista').innerHTML = m;
      });

      // En directo (como Tareas): si alguien cambia una tarea o una dependencia, se vuelve a leer (las entregas no van por
      // Realtime: cambian poco y ↻ las trae).
      var directo = null, tDirecto = null;
      if (ctx.enDirecto) directo = ctx.enDirecto(['tareas', 'dependencias', 'bitacora'], function () {
        if (tDirecto) return;
        tDirecto = setTimeout(function () { tDirecto = null; if (ctx.abierta()) ctx.tablas.refrescar([T, TD, TB], true).catch(function () {}); }, 800);
      });
      this._cerrar = function () {
        if (obs) { obs.disconnect(); obs = null; } else window.removeEventListener('resize', alRedimensionar);
        if (tAncho) { clearTimeout(tAncho); tAncho = null; }
        if (directo) { directo.cerrar(); directo = null; }
        if (tDirecto) { clearTimeout(tDirecto); tDirecto = null; }
        if (fichaId) urlFicha('');
        document.documentElement.classList.remove('fv-abierta');
      };
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); }
  });
})();
