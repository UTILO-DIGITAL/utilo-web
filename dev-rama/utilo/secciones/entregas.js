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
 *   no cuentan). Sin fecha de inicio, empieza el día que se creó su primera tarea (sin tareas, dos semanas antes de la
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
 *   vista) y se abre con Hoy cerca de la izquierda. Ver: en marcha, con las entregadas de los últimos 60 días o todas.
 * Lista (T0386, como la sección Entregas del kanban 4.x, T0399): una tarjeta por entrega con su nombre corto (U19), estado e
 * iniciativa; las tareas entregadas de su total con una barra por estados; la fecha prevista con los días que faltan (o la de
 * entrega); qué incluye, el criterio de terminado y, al desplegar, sus tareas por estado. Ver: en marcha, aplazadas,
 * entregadas o todas.
 * Las dos, con el filtro Iniciativa. Solo lee (ENTREGAS, INICIATIVAS, la vista TABLERO y DEPENDENCIAS), con la sesión de quien
 * ha entrado: lo que ve lo dicen sus roles. Se pone al día sola cuando cambia una tarea o una dependencia (Realtime; las
 * entregas, con ↻). Las cuentas y la colocación del mapa (CALC) se prueban en node (herramientas/probar-plataforma.js).
 * Estilos: estilos/kanban.css (.mp-* el mapa, .en-* la lista), con los colores de base.css.
 */
(function () {
  'use strict';
  var TE = 'ENTREGAS', TI = 'INICIATIVAS', T = 'TABLERO', TD = 'DEPENDENCIAS';
  var VER = ['En marcha', 'Con las entregadas', 'Todas'];
  var RECIENTES = 60;          // días que se ven las entregadas en «Con las entregadas»
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
  var VER_LISTA = ['En marcha', 'Aplazadas', 'Entregadas', 'Todas'];
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

  /** La primera tarea de una entrega (su CREADA más antigua, sin las descartadas): desde cuándo hay trabajo en ella. */
  function primeraTarea(ts) {
    var p = '';
    (ts || []).forEach(function (t) { var c = dia(t.CREADA); if (c && t.ESTADO !== 'Descartada' && (!p || c < p)) p = c; });
    return p;
  }
  /** Si una entrega ya está empezada: En curso, o Planificada con alguna tarea que ya se mueve (en curso, en revisión, atascada o hecha). */
  function empezada(e, ts) {
    if (e.ESTADO === 'En curso') return true;
    return e.ESTADO === 'Planificada' && (ts || []).some(function (t) { return ['En cola', 'Esperando', 'Aplazada', 'Descartada'].indexOf(t.ESTADO) < 0; });
  }

  /**
   * De qué día a qué día va la caja de una entrega: { ini, fin, sinIni, iniDe, sinFin, retraso } o null si no tiene ninguna fecha.
   * fin es el último día (incluido). Sin FECHA_INICIO, empieza el día que se creó su primera tarea (iniDe: 'tareas') o, sin
   * tareas, dos semanas antes de la prevista (iniDe: 'prevista'). retraso: los días que lleva vencida una entrega en marcha.
   */
  function tramo(e, hoy, ts) {
    var ini = dia(e.FECHA_INICIO), fin = e.ESTADO === 'Entregada' ? (dia(e.FECHA_ENTREGA) || dia(e.FECHA_PREVISTA)) : dia(e.FECHA_PREVISTA);
    var pri = ini ? '' : primeraTarea(ts);
    if (!ini && !fin && !pri) return null;
    var r = { ini: ini, fin: fin, sinIni: !ini, iniDe: ini ? '' : pri ? 'tareas' : 'prevista', sinFin: !fin, retraso: 0 };
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
    var t = tramo(e, hoy, ts);
    return {
      preguntas: ts.filter(function (x) { return x.ESTADO === 'Necesita tu respuesta'; }).length,
      bloqueos: ts.filter(function (x) { return x.ESTADO === 'Bloqueada'; }).length,
      vencidas: ts.filter(function (x) { return !CERRADA[x.ESTADO] && x.ESTADO !== 'Aplazada' && dia(x.DEADLINE) && dia(x.DEADLINE) < hoy; }).length,
      retraso: t ? t.retraso : 0
    };
  }

  /** Si una entrega sale con ese filtro: en marcha; con las entregadas de los últimos días; o todas. */
  function seVe(e, ver, hoy) {
    if (enMarcha(e)) return true;
    if (ver === 'Todas') return true;
    if (ver === 'Con las entregadas' && e.ESTADO === 'Entregada') {
      var f = dia(e.FECHA_ENTREGA) || dia(e.FECHA_PREVISTA);
      return !f || diasEntre(f, hoy) <= RECIENTES;
    }
    return false;
  }

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
    var hoy = dia(o.hoy) || hoyIso(), ver = VER.indexOf(o.ver) >= 0 ? o.ver : VER[1];
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
    ES.forEach(function (e) { var t = tramo(e, hoy, tareasDe[e.ID]); if (t) { tr[e.ID] = t; desde = menor(desde, t.ini); hasta = mayor(hasta, t.fin); } });
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

  var CALC = { plano: plano, tramo: tramo, empezada: empezada, primeraTarea: primeraTarea, progreso: progreso, marcas: marcas, seVe: seVe, esperas: esperas, enFilas: enFilas, linea: linea,
    diasEntre: diasEntre, mas: mas, M: M, VER: VER, VER_LISTA: VER_LISTA, VISTAS: VISTAS, RECIENTES: RECIENTES };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ===================== la pantalla ===================== */
  var RAIZ = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/utilo\/secciones\/[^/]*$/, '') : '../../'; })();
  var VERSION = (function () { var s = document.currentScript && document.currentScript.src; var m = s && /[?&]v=([^&]+)/.exec(s); return m ? m[1] : '1'; })();
  var ICO_RECARGAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
  var ICO_BANDERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>';
  var ICO_CERRAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

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
  function grupoDe(e) { return e.ESTADO === 'Entregada' ? 'Entregadas' : e.ESTADO === 'Aplazada' ? 'Aplazadas' : e.ESTADO === 'Descartada' ? '' : 'En marcha'; }
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
      var F = leerLocal(CLAVE + '_f', {});   // { vista, ver (lista), verMapa, ini }
      var pedida = String(new URLSearchParams(location.search).get('v') || '').toLowerCase();
      if (pedida === 'mapa' || pedida === 'lista') F.vista = pedida === 'mapa' ? 'Mapa' : 'Lista';
      if (VISTAS.indexOf(F.vista) < 0) F.vista = VISTAS.indexOf(C.VISTA) >= 0 ? C.VISTA : 'Mapa';
      if (VER_LISTA.indexOf(F.ver) < 0) F.ver = VER_LISTA.indexOf(C.VER) >= 0 ? C.VER : 'En marcha';
      if (VER.indexOf(F.verMapa) < 0) F.verMapa = VER.indexOf(C.VER_MAPA) >= 0 ? C.VER_MAPA : VER[1];
      var leido = false, sel = '', P = null, primera = true, anchoVisto = 0;
      // Sin la clase «en»: en kanban.css es la vista de la 4.x, que solo se ve con body.ver-entregas.
      el.innerHTML = '<section class="mp en-nucleo"><div class="en-fil">' +
        '<div class="mp-vistas" role="group" aria-label="Vista">' + VISTAS.map(function (v) {
          return '<button type="button" class="sec" data-vista="' + v + '" aria-pressed="' + (v === F.vista) + '">' + v + '</button>';
        }).join('') + '</div>' +
        '<label>Ver<select id="en-ver"></select></label>' +
        '<label id="en-lini">Iniciativa<select id="en-ini"></select></label>' +
        '<span class="act"><button id="en-rec" class="sec recarga" type="button" title="Traer lo último" aria-label="Traer lo último">' + ICO_RECARGAR + '</button></span>' +
        '</div>' +
        '<div id="en-vmapa"><p id="mp-res" class="mp-res" aria-live="polite"></p>' +
        '<div class="mp-cuerpo"><div class="mp-izq"><div id="mp-marco" class="mp-marco" tabindex="0" aria-label="Mapa de las entregas en el tiempo"></div>' +
        '<ul class="mp-ley">' + GRUPOS.map(function (g) { return '<li class="' + g.cls + '">' + texto(g.varias) + '</li>'; }).join('') +
        '<li class="mp-ley-lim">fecha límite</li><li class="mp-ley-cola">vencida</li><li class="mp-ley-f">espera a</li><li class="mp-ley-sin">fecha calculada</li></ul>' +
        '<p class="mp-ayuda">Cada caja es una entrega, desde que empieza hasta su fecha límite (la bandera). Si no tiene fecha de inicio, empieza el día que se creó su primera tarea. ' +
        'Una flecha de una entrega a otra quiere decir que la segunda tiene tareas que no pueden empezar hasta que se acaben tareas de la primera; el número dice cuántas. Pulsa una caja para ver sus tareas.</p></div>' +
        '<aside id="mp-det" class="mp-det" hidden></aside></div></div>' +
        '<div id="en-lista" class="en-lista" hidden></div></section>';
      var $ = function (id) { return el.querySelector('#' + id); };
      var sec = el.querySelector('.mp'), marco = $('mp-marco'), det = $('mp-det');

      function datos() {
        return { entregas: ctx.tablas.filas(TE), iniciativas: ctx.tablas.filas(TI), tareas: ctx.tablas.filas(T), deps: ctx.tablas.filas(TD) };
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
        P = plano(datos(), { hoy: hoyIso(), ancho: ancho, ver: F.verMapa, ini: F.ini });
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
        // En medio de cada flecha, cuántas tareas esperan (al pulsarlo, la entrega que espera).
        h += P.flechas.filter(function (f) { return f.d && f.mx != null; }).map(function (f) {
          var t = nombreCorto(f.a).split(' · ')[0] + ' espera a ' + nombreCorto(f.de).split(' · ')[0] + ': ' +
            (f.abiertas === 1 ? '1 tarea espera' : f.abiertas + ' tareas esperan') + ' (' + f.pares.filter(function (q) { return !CERRADA[q.de.ESTADO]; }).map(function (q) { return q.tarea.ID + ' a ' + q.de.ID; }).join(', ') + ')';
          return '<button type="button" class="mp-fn' + (sel && (f.de === sel || f.a === sel) ? ' sel' : '') + '" data-e="' + texto(f.a) + '" style="left:' + f.mx + 'px;top:' + f.my + 'px" title="' + texto(t) + '" aria-label="' + texto(t) + '">' + f.abiertas + '</button>';
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
      function tareaTxt(t) {
        return '<a href="?s=tablero&amp;t=' + encodeURIComponent(t.ID) + '" data-sx="TABLERO"><span class="id">' + texto(t.ID) + '</span> ' + texto(t.TITULO) + '</a>' +
          ' <span class="mp-est ' + (CLS[t.ESTADO] || 's-x') + '">' + texto(t.ESTADO) + '</span>';
      }

      function pintarDetalle() {
        var c = P && P.cajas.filter(function (x) { return x.id === sel; })[0];
        if (!c) { det.hidden = true; sec.classList.remove('con-det'); return; }
        var e = c.e, p = c.prog, i = P.iniciativas[e.INICIATIVA], t = c.tramo, hoy = P.hoy;
        var h = '<div class="mp-dcab"><div class="en-top"><span class="en-corto">' + texto(c.corto) + '</span><span class="en-est">' + texto(e.ESTADO) + '</span>' +
          (i ? '<span class="en-cli">' + texto(i.NOMBRE || i.ID) + '</span>' : '') + '</div>' +
          '<button id="mp-cer" type="button" class="sec recarga" title="Cerrar" aria-label="Cerrar el detalle">' + ICO_CERRAR + '</button></div>' +
          '<h3 class="en-t">' + texto(e.NOMBRE) + '</h3>';
        // Fechas.
        var fs = [];
        if (e.ESTADO === 'Entregada') fs.push(e.FECHA_ENTREGA ? 'Entregada el ' + fechaEs(e.FECHA_ENTREGA) : 'Entregada');
        if (dia(e.FECHA_INICIO)) fs.push((dia(e.FECHA_INICIO) > hoy ? 'Empieza el ' : 'Empezó el ') + fechaEs(e.FECHA_INICIO));
        else if (e.ESTADO !== 'Entregada') fs.push(t && t.iniDe === 'tareas' ? 'Sin fecha de inicio: en el mapa empieza el ' + fechaEs(t.ini) + ', cuando se creó su primera tarea' :
          'Sin fecha de inicio' + (t ? ': en el mapa, dos semanas antes de su fecha límite' : ''));
        if (e.ESTADO === 'Planificada' && c.empezada) fs.push('Planificada, pero ya tiene tareas en marcha o hechas');
        if (e.ESTADO !== 'Entregada') {
          if (dia(e.FECHA_PREVISTA)) {
            var n = CALC.diasEntre(hoy, e.FECHA_PREVISTA);
            fs.push('Fecha límite: ' + fechaEs(e.FECHA_PREVISTA) + (enMarcha(e) ? ' · ' + (n === 0 ? 'es hoy' : n > 0 ? (n === 1 ? 'falta 1 día' : 'faltan ' + n + ' días') : 'venció hace ' + diasTxt(-n)) : ''));
          } else fs.push('Sin fecha límite');
        }
        h += '<div class="en-fecha' + (t && t.retraso ? ' vencida' : '') + '">' + fs.map(texto).join('<br>') + '</div>';
        // Avance.
        h += '<div class="en-pct">' + (p.total ? '<b>' + p.hechas + ' de ' + p.total + '</b> ' + (p.total === 1 ? 'tarea entregada' : 'tareas entregadas') + '<span class="en-num">' + p.pct + ' %</span>' : 'Sin tareas todavía') + '</div>';
        if (p.total) {
          h += '<div class="en-barra">' + GRUPOS.map(function (g) { return p.n[g.id] ? '<span class="' + g.cls + '" style="flex-grow:' + p.n[g.id] + '"></span>' : ''; }).join('') + '</div>' +
            '<ul class="en-ley">' + GRUPOS.filter(function (g) { return p.n[g.id]; }).map(function (g) { return '<li class="' + g.cls + '">' + texto(cuantas(p.n[g.id], g)) + '</li>'; }).join('') + '</ul>';
        }
        var av = avisosDe(c);
        if (av.length) h += '<p class="mp-avs mp-davs">' + av.map(function (a) { return '<span class="' + a.cls + '">' + texto(a.txt) + '</span>'; }).join('') + '</p>';
        if (e.QUE_INCLUYE) h += '<p class="en-inc">' + texto(e.QUE_INCLUYE) + '</p>';
        if (e.CRITERIO) h += '<p class="en-inc"><b>Terminada cuando:</b> ' + texto(e.CRITERIO) + '</p>';
        // Esperas.
        var espera = P.flechas.filter(function (f) { return f.a === c.id; }), esperan = P.flechas.filter(function (f) { return f.de === c.id; }), su = P.sueltas[c.id];
        function bloque(titulo, fl, otra) {
          if (!fl.length) return '';
          return '<h4 class="mp-dh">' + titulo + '</h4><ul class="mp-esp">' + fl.map(function (f) {
            return '<li><button type="button" class="mp-ir" data-e="' + texto(f[otra]) + '">' + texto(nombreCorto(f[otra])) + '</button>' +
              (f.abiertas ? '' : ' <small class="mp-nota">ya cumplida</small>') + '<ul>' + f.pares.map(function (q) {
              return '<li>' + tareaTxt(q.tarea) + ' <span class="mp-espera">espera a</span> ' + tareaTxt(q.de) + '</li>';
            }).join('') + '</ul></li>';
          }).join('') + '</ul>';
        }
        h += bloque('Espera a', espera, 'de') + bloque('La esperan', esperan, 'a');
        if (su && (su.pares.length || su.noVes)) {
          h += '<h4 class="mp-dh">Espera a otras tareas</h4><ul class="mp-esp"><li><ul>' + su.pares.map(function (q) {
            return '<li>' + tareaTxt(q.tarea) + ' <span class="mp-espera">espera a</span> ' + tareaTxt(q.de) + (q.de.ENTREGA_CORTA ? ' <small>(' + texto(q.de.ENTREGA_CORTA) + ')</small>' : ' <small>(sin entrega)</small>') + '</li>';
          }).join('') + (su.noVes ? '<li class="mp-nota">' + (su.noVes === 1 ? '1 espera a una tarea que no ves' : su.noVes + ' esperan a tareas que no ves') + '.</li>' : '') + '</ul></li></ul>';
        }
        // Tareas.
        if (c.tareas.length) {
          h += '<h4 class="mp-dh">' + (c.tareas.length === 1 ? 'Su tarea' : 'Sus ' + c.tareas.length + ' tareas') + '</h4><ul class="mp-ts">' +
            ORDEN_TAREAS.map(function (s) {
              return c.tareas.filter(function (x) { return x.ESTADO === s; }).sort(function (a, b) { return String(a.ID).localeCompare(String(b.ID)); }).map(function (x) {
                var v = !CERRADA[x.ESTADO] && x.ESTADO !== 'Aplazada' && dia(x.DEADLINE) && dia(x.DEADLINE) < hoy;
                return '<li class="' + (CLS[x.ESTADO] || 's-x') + '">' + tareaTxt(x) + (x.EN_MANOS_NOMBRE ? '<span class="en-quien">' + texto(x.EN_MANOS_NOMBRE) + '</span>' : '') +
                  (v ? '<span class="en-quien mp-rojo">Deadline ' + fechaEs(x.DEADLINE) + '</span>' : '') + '</li>';
              }).join('');
            }).join('') + '</ul>';
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

      /* ---------- las dos vistas ---------- */
      function esMapa() { return F.vista === 'Mapa'; }
      function pintar() {
        var IS = ctx.tablas.filas(TI), sl = $('en-ini');
        if (F.ini && !ctx.tablas.fila(TI, F.ini)) F.ini = '';
        sl.innerHTML = '<option value="">Todas</option>' + IS.map(function (i) { return '<option value="' + texto(i.ID) + '"' + (i.ID === F.ini ? ' selected' : '') + '>' + texto(i.NOMBRE || i.ID) + '</option>'; }).join('');
        $('en-lini').style.display = IS.length > 1 ? '' : 'none';
        var ver = esMapa() ? VER : VER_LISTA, actual = esMapa() ? F.verMapa : F.ver;
        $('en-ver').innerHTML = ver.map(function (v) { return '<option' + (v === actual ? ' selected' : '') + '>' + v + '</option>'; }).join('');
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
        var b = ev.target.closest && ev.target.closest('[data-e]');
        if (b && el.contains(b)) { ev.preventDefault(); seleccionar(b.getAttribute('data-e')); return; }
        if (ev.target.closest && ev.target.closest('#mp-cer')) cerrarDetalle();
      });
      el.addEventListener('toggle', function (e) {
        var d = e.target, s = d && d.querySelector && d.querySelector('summary[data-que]');
        if (s) s.textContent = (d.open ? 'Ocultar ' : 'Ver ') + s.getAttribute('data-que');
      }, true);
      el.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && sel) cerrarDetalle(); });
      $('en-ver').onchange = function () { if (esMapa()) F.verMapa = this.value; else F.ver = this.value; guardarLocal(CLAVE + '_f', F); pintar(); };
      $('en-ini').onchange = function () { F.ini = this.value; guardarLocal(CLAVE + '_f', F); pintar(); };
      $('en-rec').onclick = function () {
        var b = this; b.disabled = true; b.classList.add('girando');
        ctx.tablas.refrescar([TE, TI, T, TD], true).then(function () { if (ctx.abierta()) ctx.aviso('Entregas al día.'); }, function (e) {
          if (ctx.abierta()) ctx.aviso('No se ha podido actualizar: ' + String(e.message).replace(/^\w+:\s*/, ''));
        }).then(function () { b.disabled = false; b.classList.remove('girando'); });
      };
      ctx.alCambiar(function (t) { if ([TE, TI, T, TD].indexOf(t) >= 0) pintar(); });

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
      ctx.tablas.leer([TE, TI, T, TD]).then(function () { leido = true; if (ctx.abierta()) pintar(); }, function (e) {
        leido = true;
        var m = '<p class="u-error">No se han podido leer las entregas.</p><p class="u-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Pulsa ↻ o vuelve a abrir la sección.</p>';
        marco.innerHTML = m; $('en-lista').innerHTML = m;
      });

      // En directo (como Tareas): si alguien cambia una tarea o una dependencia, se vuelve a leer (las entregas no van por
      // Realtime: cambian poco y ↻ las trae).
      var directo = null, tDirecto = null;
      if (ctx.enDirecto) directo = ctx.enDirecto(['tareas', 'dependencias'], function () {
        if (tDirecto) return;
        tDirecto = setTimeout(function () { tDirecto = null; if (ctx.abierta()) ctx.tablas.refrescar([T, TD], true).catch(function () {}); }, 800);
      });
      this._cerrar = function () {
        if (obs) { obs.disconnect(); obs = null; } else window.removeEventListener('resize', alRedimensionar);
        if (tAncho) { clearTimeout(tAncho); tAncho = null; }
        if (directo) { directo.cerrar(); directo = null; }
        if (tDirecto) { clearTimeout(tDirecto); tDirecto = null; }
      };
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); }
  });
})();
