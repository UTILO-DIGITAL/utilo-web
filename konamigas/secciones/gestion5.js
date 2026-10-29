/*
 * Sección Gestión de Konamigas · núcleo 5.0 (T0256) · clientes/konamigas/modulos/gestion5 de utilo-apps
 *
 * Equipos y jugadoras sobre el Excel JUGADORAS Y EQUIPOS nuevo, por temporada:
 * - Resumen: cuántos equipos y jugadoras hay, lo que falta por pagar, los avisos de la temporada y los equipos de cada liga.
 * - Equipos: la inscripción de cada equipo en su competición (NOMBRE_EQUIPO es su nombre de ese año), con su liga, nivel,
 *   color, responsable, capitana, seguimiento, pagos y plantilla. Las altas (inscribir equipos y jugadoras) no se hacen aquí.
 * - Jugadoras: sus inscripciones de la temporada (dorsal, estado, Xporty, contactos) y su ficha con los datos personales y
 *   todas sus temporadas.
 * - Avisos: cada uno se puede «dar por bueno» (queda en REVISIONES con TIPO «Aviso: <clave>» y RESUELTO) y deja de avisar.
 * - Fotos: no tienen pestaña. Las de cada jugadora salen en su ficha (miniaturas, verla grande, «No es ella»); las sin vincular
 *   se asignan una a una desde Resumen › Alertas (buscando por equipo, color o nombre). Si se puede publicar sale de su inscripción.
 * - Revisiones: los casos dudosos de la migración y de los formularios, para marcarlos resueltos.
 * Todo con las tablas al momento (ctx.tablas): se pinta de lo guardado en el dispositivo y cada cambio se ve al tocar
 * «Guardar»; el Excel se escribe por detrás y, si el motor dice que no, vuelve a como estaba y avisa.
 * INSCRIPCIONES_JUGADORAS es muy grande (16.000 filas): se lee solo la parte de la temporada que se ve (por los equipos
 * inscritos) y, al abrir una jugadora, la de esa jugadora (partes de kanban4/tablas.js, T0256).
 * Los avisos y lo que falta por pagar se calculan aquí (CALC, más abajo), sin fórmulas en el Excel.
 *
 * Personalización (config.json · nucleo.secciones.gestion5.config, declarada en su modulo.json): PESTANAS, PAGOS, AYUDA.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  function txt(v) { return String(v == null ? '' : v).trim(); }
  function indice(filas) { var o = {}; (filas || []).forEach(function (f) { o[String(f.ID)] = f; }); return o; }
  function hoy() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  /** 'aaaa-mm-dd' → 'dd/mm/aaaa'. */
  function fecha(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(s || ''); }
  /** Importe → céntimos (número, «1.234,56», «12 €»). */
  function cts(v) {
    var n = typeof v === 'number' ? v : Number(String(v == null ? '' : v).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return isFinite(n) ? Math.round(n * 100) : 0;
  }
  function pct(t) { var n = parseFloat(String(t == null ? '' : t).replace(',', '.')); return isFinite(n) ? n : 0; }
  function conIva(c, iva) { return c + Math.round(c * pct(iva) / 100); }
  function eur(c) {
    c = Math.round(c || 0);
    var s = c < 0 ? '−' : '', a = Math.abs(c), e = Math.floor(a / 100), d = a % 100;
    return s + String(e).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + (d < 10 ? '0' : '') + d + ' €';
  }
  /** Edad en años a una fecha ('aaaa-mm-dd'), o '' si no hay fecha de nacimiento. */
  function edad(nac, a) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(nac || '')), h = /^(\d{4})-(\d{2})-(\d{2})/.exec(a || hoy());
    if (!m || !h) return '';
    var e = Number(h[1]) - Number(m[1]);
    if (h[2] + h[3] < m[2] + m[3]) e--;
    return e >= 0 && e < 120 ? e : '';
  }
  function nombreJug(j) { return j ? [j.NOMBRE, j.APELLIDO_1, j.APELLIDO_2].map(txt).filter(Boolean).join(' ') : ''; }
  /** Para buscar sin tildes ni mayúsculas. */
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function telefono(v) { var s = txt(v).replace(/\D/g, ''); return s.length === 11 && s.slice(0, 2) === '34' ? s.slice(2) : s; }
  /** IDs que salen en un texto («J01322 Ana Hernández / J01885 …» → ['J01322', 'J01885']). */
  function ids(t) { return (String(t || '').match(/\b[A-Z]{1,3}-?\d{3,6}\b/g) || []).filter(function (x, i, a) { return a.indexOf(x) === i; }); }

  /** Temporadas de la más reciente a la más antigua. */
  function temporadas(d) {
    return d.tem.slice().sort(function (a, b) { return String(b.FECHA_INICIO || b.ID) < String(a.FECHA_INICIO || a.ID) ? -1 : 1; });
  }
  /** La temporada de hoy; si ninguna lo es, la más reciente que ya ha empezado; si no, la primera. */
  function temporadaActual(d) {
    var h = hoy(), ts = temporadas(d);
    return ts.filter(function (t) { return t.FECHA_INICIO && t.FECHA_FIN && t.FECHA_INICIO <= h && h <= t.FECHA_FIN; })[0] ||
      ts.filter(function (t) { return t.FECHA_INICIO && t.FECHA_INICIO <= h; })[0] || ts[0] || null;
  }
  function compsDe(d, tem) { return d.com.filter(function (c) { return String(c.ID_TEMPORADA) === String(tem); }); }
  /** Inscripciones de equipo de la temporada (de sus competiciones). */
  function iesDe(d, tem) {
    var cs = {}; compsDe(d, tem).forEach(function (c) { cs[c.ID] = 1; });
    return d.ie.filter(function (i) { return cs[i.ID_COMPETICION]; });
  }
  /** Cuenta como equipo de la temporada: no es Baja ni una fila de Clasificación (copas y supercopas). */
  function cuenta(ie) { return ie.ESTADO !== 'Baja' && ie.ORIGEN !== 'Clasificación'; }
  /**
   * Las inscripciones de jugadora que valen: si una jugadora tiene varias en el mismo equipo inscrito (volvió a rellenar el
   * formulario), solo la más reciente (FECHA_INSCRIPCION y, si empatan, el ID mayor). Las anteriores no salen, no cuentan
   * ni dan avisos, y no son un problema a revisar.
   */
  function ijsValidas(lista) {
    var ult = {}, k = function (j) { return j.ID_JUGADORA + '|' + j.ID_INSCRIPCION_EQUIPO; };
    (lista || []).forEach(function (j) {
      var u = ult[k(j)], x = String(j.FECHA_INSCRIPCION || ''), y = u ? String(u.FECHA_INSCRIPCION || '') : '';
      if (!u || x > y || (x === y && String(j.ID) > String(u.ID))) ult[k(j)] = j;
    });
    return (lista || []).filter(function (j) { return ult[k(j)] === j; });
  }
  /** Plantilla de una inscripción de equipo: sus inscripciones de jugadora que valen (Activas primero, por dorsal). */
  function plantilla(d, idIe) {
    return ijsValidas(d.ij).filter(function (j) { return String(j.ID_INSCRIPCION_EQUIPO) === String(idIe); }).sort(function (a, b) {
      if ((a.ESTADO === 'Baja') !== (b.ESTADO === 'Baja')) return a.ESTADO === 'Baja' ? 1 : -1;
      var x = parseInt(a.DORSAL, 10), y = parseInt(b.DORSAL, 10);
      if (isFinite(x) !== isFinite(y)) return isFinite(x) ? -1 : 1;
      if (isFinite(x) && x !== y) return x - y;
      return String(a.ID) < String(b.ID) ? -1 : String(a.ID) > String(b.ID) ? 1 : 0;
    });
  }

  /**
   * Lo que cuesta, lo cobrado y lo que falta de la inscripción de un equipo, en céntimos con IVA, o null si no se sabe:
   * precio = la TARIFA «Inscripción equipo» de su competición (REF_ID) vigente el día que se inscribió; menos sus
   * DESCUENTOS (sin IVA, se les pone el de la tarifa); cobrado = los MOVIMIENTOS con REF_TIPO «Inscripción» y REF_ID esa
   * inscripción (un ingreso suma, un gasto, una devolución, resta). Una competición INCLUIDA no se cobra.
   * Un equipo de Baja no debe nada: lo cobrado es su señal, que se queda como ingreso (decisión de Javi, T0256), con
   * baja: true y senal (lo cobrado, o 0 si se le devolvió).
   */
  function pago(d, ie) {
    var p = pago0(d, ie);
    if (p && ie.ESTADO === 'Baja') { p.baja = true; p.falta = 0; p.senal = Math.max(0, p.cobrado || 0); }
    return p;
  }
  function pago0(d, ie) {
    var c = indice(d.com)[ie.ID_COMPETICION];
    if (!c) return null;
    if (c.INCLUIDA === true || ie.ORIGEN === 'Clasificación') return { incluida: true, precio: 0, descuento: 0, cobrado: 0, falta: 0 };
    var f = String(ie.FECHA_INSCRIPCION || hoy());
    var t = d.tar.filter(function (x) {
      return x.CONCEPTO === 'Inscripción equipo' && String(x.REF_ID) === String(c.ID) && (!x.FECHA_DESDE || x.FECHA_DESDE <= f) && (!x.FECHA_HASTA || f <= x.FECHA_HASTA);
    }).sort(function (a, b) { return String(b.FECHA_DESDE) < String(a.FECHA_DESDE) ? -1 : 1; })[0] ||
      d.tar.filter(function (x) { return x.CONCEPTO === 'Inscripción equipo' && String(x.REF_ID) === String(c.ID); })[0];
    var cobrado = 0, n = 0;
    d.mov.forEach(function (m) {
      if (!/^inscripci[oó]n/i.test(txt(m.REF_TIPO)) || String(m.REF_ID) !== String(ie.ID)) return;
      var tot = conIva(cts(m.BASE), m.TIPO_IVA);
      if (m.TIPO === 'Ingreso') { cobrado += tot; n++; } else if (m.TIPO === 'Gasto') { cobrado -= tot; n++; }
    });
    if (!t) return { sinTarifa: true, precio: 0, descuento: 0, cobrado: cobrado, cobros: n, falta: 0 };
    var desc = 0;
    d.des.forEach(function (x) { if (String(x.ID_INSCRIPCION_EQUIPO) === String(ie.ID)) desc += cts(x.IMPORTE); });
    var precio = conIva(cts(t.PRECIO), t.TIPO_IVA), descuento = conIva(desc, t.TIPO_IVA);
    return { precio: precio, descuento: descuento, cobrado: cobrado, cobros: n, falta: precio - descuento - cobrado };
  }

  /**
   * Avisos de un equipo inscrito (las reglas del YAML): [{ id, k, t }]. id es la clave estable del aviso (para darlo por bueno); k agrupa en el resumen. No salen los dados por buenos.
   * ctxT: lo que comparten todos los equipos de la temporada (ver contexto()).
   */
  function avisosEquipo(d, ie, ctxT) {
    var out = [];
    if (ie.ESTADO === 'Baja') return out;
    var conf = ie.ESTADO === 'Confirmada';
    if (ie.ESTADO === 'Solicitada') out.push({ id: 'solicitada', k: 'solicitada', t: 'Sin confirmar' });
    if (conf && !ie.ID_LIGA) out.push({ id: 'liga', k: 'liga', t: 'Sin liga' });
    if (conf && ie.MENSAJE_INICIAL_ENVIADO !== true) out.push({ id: 'mensaje', k: 'seguimiento', t: 'Sin mensaje inicial' });
    if (conf && ie.GRUPO_CREADO !== true) out.push({ id: 'grupo', k: 'seguimiento', t: 'Sin grupo de WhatsApp' });
    if (ie.ID_COLOR && ie.ID_LIGA && (ctxT.colorLiga[ie.ID_LIGA + '|' + ie.ID_COLOR] || 0) > 1) out.push({ id: 'color', k: 'color', t: 'Color repetido en su liga' });
    var nom = norm(ie.NOMBRE_EQUIPO);
    if (nom && (ctxT.nombre[ie.ID_COMPETICION + '|' + nom] || 0) > 1) out.push({ id: 'nombre', k: 'nombre', t: 'Nombre repetido' });
    if (ie.ID_CAPITANA && ctxT.ijLeidas && !d.ij.some(function (j) { return String(j.ID_INSCRIPCION_EQUIPO) === String(ie.ID) && String(j.ID_JUGADORA) === String(ie.ID_CAPITANA) && j.ESTADO !== 'Baja'; }))
      out.push({ id: 'capitana-fuera', k: 'capitana', t: 'La capitana no está en la plantilla' });
    if (!ie.ID_CAPITANA && conf) out.push({ id: 'capitana-sin', k: 'capitana', t: 'Sin capitana' });
    if (ctxT.pagos && conf) {
      var p = pago(d, ie);
      if (p && !p.incluida && !p.sinTarifa && p.falta > 0) out.push({ id: 'pago', k: 'pago', t: 'Faltan ' + eur(p.falta) });
    }
    return sinResueltos(out, ie.ID, ctxT);
  }
  /**
   * Quita los avisos que se han dado por buenos (REVISIONES con TIPO «Aviso: <id>» y RESUELTO) y los pospuestos que siguen
   * activos (TIPO «Pospuesto: <id>», sin RESUELTO y con FECHA posterior a hoy).
   */
  function sinResueltos(out, idRegistro, ctxT) {
    var r = (ctxT && ctxT.resueltos) || {}, p = (ctxT && ctxT.pospuestos) || {};
    return out.filter(function (a) { return !r[idRegistro + '|' + a.id] && !p[idRegistro + '|' + a.id]; });
  }
  /** ¿Es una fila de REVISIONES de un aviso pospuesto? */
  function esPospuesto(r) { return /^Pospuesto: /.test(txt(r && r.TIPO)); }
  /** Un pospuesto sigue activo si no se ha vuelto a avisar (RESUELTO) y su fecha es posterior a hoy ('aaaa-mm-dd'). */
  function pospuestoActivo(r, h) { return esPospuesto(r) && r.RESUELTO !== true && String(r.FECHA || '').slice(0, 10) > (h || hoy()); }
  /**
   * Los avisos pospuestos activos de una inscripción: [{ id, fila, hasta, motivo, filas }]. Si se pospuso varias veces,
   * vale la fecha más lejana (filas: todas las activas de ese aviso).
   */
  function avisosPospuestos(d, idRegistro, h) {
    var por = {};
    (d.rev || []).forEach(function (r) {
      if (String(r.ID_REGISTRO) !== String(idRegistro) || !pospuestoActivo(r, h)) return;
      var id = txt(r.TIPO).slice(11), x = por[id] = por[id] || { id: id, filas: [] };
      x.filas.push(r);
      if (!x.fila || String(r.FECHA) > String(x.fila.FECHA)) { x.fila = r; x.hasta = String(r.FECHA).slice(0, 10); x.motivo = txt(r.MOTIVO); }
    });
    return Object.keys(por).map(function (k) { return por[k]; });
  }
  /** Los avisos dados por buenos de una inscripción (de equipo IE… o de jugadora IJ…): [{ id, fila, motivo }]. */
  function avisosResueltos(d, idRegistro) {
    return (d.rev || []).filter(function (r) { return r.RESUELTO === true && String(r.ID_REGISTRO) === String(idRegistro) && /^Aviso: /.test(txt(r.TIPO)); })
      .map(function (r) { return { id: txt(r.TIPO).slice(7), fila: r, motivo: txt(r.MOTIVO) }; });
  }
  /** ¿Es una fila de REVISIONES de un aviso dado por bueno (no un caso dudoso)? */
  function esAviso(r) { return /^Aviso: /.test(txt(r && r.TIPO)); }
  /** Avisos de una inscripción de jugadora: [{ id, k, t }], sin los dados por buenos. */
  function avisosJugadora(d, ij, ctxT) {
    var out = [];
    var ie = ctxT.ie[ij.ID_INSCRIPCION_EQUIPO];
    // Las de un equipo de Baja cuentan como de baja (el motor las da de baja con él; las migradas pueden seguir Activas).
    if (ij.ESTADO !== 'Activa' || (ie && ie.ESTADO === 'Baja')) return out;
    var d0 = txt(ij.DORSAL);
    if (!d0) out.push({ id: 'dorsal-sin', k: 'dorsal', t: 'Sin dorsal' });
    else if ((ctxT.dorsal[ij.ID_INSCRIPCION_EQUIPO + '|' + d0] || 0) > 1) out.push({ id: 'dorsal-rep', k: 'dorsal', t: 'Dorsal ' + d0 + ' repetido' });
    if (ctxT.superada && ctxT.superada[ij.ID]) return [];
    // Puede jugar en dos equipos de la misma competición, pero no en dos de la misma liga.
    if (ie && ie.ID_LIGA && (ctxT.enLiga[ij.ID_JUGADORA + '|' + ie.ID_LIGA] || 0) > 1) out.push({ id: 'doble', k: 'doble', t: 'En dos equipos de la misma liga' });
    var falta = ['ACEPTA_NORMAS', 'ACEPTA_DATOS', 'ACEPTA_RESPONSABILIDAD'].filter(function (c) { return ij[c] !== true; });
    if (falta.length) out.push({ id: 'acepta', k: 'acepta', t: 'Sin aceptar ' + falta.map(function (c) { return { ACEPTA_NORMAS: 'normas', ACEPTA_DATOS: 'datos', ACEPTA_RESPONSABILIDAD: 'responsabilidad' }[c]; }).join(', ') });
    return sinResueltos(out, ij.ID, ctxT);
  }
  /** Lo que comparten los avisos de una temporada: cuántos hay de cada color por liga, nombres, dorsales… */
  function contexto(d, tem, o) {
    o = o || {};
    var ies = iesDe(d, tem), ix = indice(ies), c = { ie: ix, colorLiga: {}, nombre: {}, dorsal: {}, enLiga: {}, superada: {}, pagos: !!o.pagos, ijLeidas: o.ijLeidas !== false, resueltos: {}, pospuestos: {} };
    // Avisos pospuestos activos a la fecha de hoy (o la de o.hoy, 'aaaa-mm-dd', para probar).
    var h = o.hoy || hoy();
    (d.rev || []).forEach(function (r) { if (pospuestoActivo(r, h)) c.pospuestos[r.ID_REGISTRO + '|' + txt(r.TIPO).slice(11)] = String(r.FECHA).slice(0, 10); });
    // Avisos dados por buenos: REVISIONES con TIPO «Aviso: <id>» y RESUELTO, por «inscripción|id».
    (d.rev || []).forEach(function (r) { if (r.RESUELTO === true && esAviso(r)) c.resueltos[r.ID_REGISTRO + '|' + txt(r.TIPO).slice(7)] = true; });
    ies.forEach(function (i) {
      if (i.ESTADO === 'Baja') return;
      if (i.ID_LIGA && i.ID_COLOR) c.colorLiga[i.ID_LIGA + '|' + i.ID_COLOR] = (c.colorLiga[i.ID_LIGA + '|' + i.ID_COLOR] || 0) + 1;
      var n = norm(i.NOMBRE_EQUIPO); if (n) c.nombre[i.ID_COMPETICION + '|' + n] = (c.nombre[i.ID_COMPETICION + '|' + n] || 0) + 1;
    });
    var validas = ijsValidas(d.ij), vale = {};
    validas.forEach(function (j) { vale[j.ID] = true; });
    d.ij.forEach(function (j) { if (!vale[j.ID]) c.superada[j.ID] = true; });
    validas.forEach(function (j) {
      var ie = ix[j.ID_INSCRIPCION_EQUIPO];
      if (!ie || j.ESTADO !== 'Activa' || ie.ESTADO === 'Baja') return;
      var dd = txt(j.DORSAL);
      if (dd) c.dorsal[j.ID_INSCRIPCION_EQUIPO + '|' + dd] = (c.dorsal[j.ID_INSCRIPCION_EQUIPO + '|' + dd] || 0) + 1;
      if (ie.ID_LIGA) { var k = j.ID_JUGADORA + '|' + ie.ID_LIGA; c.enLiga[k] = (c.enLiga[k] || 0) + 1; }
    });
    return c;
  }

  /** Busca jugadoras por nombre, teléfono, correo, documento o Instagram: las que encajan con todas las palabras. */
  function buscarJugadoras(js, q, max) {
    var ps = norm(q).split(/\s+/).filter(Boolean), tel = telefono(q);
    if (!ps.length) return [];
    var out = [];
    for (var i = 0; i < js.length && out.length < (max || 50); i++) {
      var j = js[i];
      var t = norm([j.ID, j.NOMBRE, j.APELLIDO_1, j.APELLIDO_2, j.EMAIL, j.NUM_DOCUMENTO, j.INSTAGRAM].join(' '));
      if (ps.every(function (p) { return t.indexOf(p) >= 0; }) || (tel.length >= 6 && telefono(j.TELEFONO).indexOf(tel) >= 0)) out.push(j);
    }
    return out;
  }

  /** Comprueba una jugadora nueva o editada (lo que el YAML deja como regla): devuelve los problemas. */
  function problemasJugadora(j, todas, id) {
    var mal = [];
    if (!txt(j.NOMBRE)) mal.push('Falta el nombre.');
    if (!txt(j.APELLIDO_1)) mal.push('Falta el primer apellido.');
    if (!txt(j.TELEFONO)) mal.push('Falta el teléfono.');
    else if (telefono(j.TELEFONO).length < 9) mal.push('El teléfono tiene que tener al menos 9 cifras.');
    if (txt(j.NUM_DOCUMENTO) && !txt(j.TIPO_DOCUMENTO)) mal.push('Di qué documento es (DNI, NIE…).');
    var doc = txt(j.NUM_DOCUMENTO).toUpperCase().replace(/[\s-]/g, '');
    if (doc && j.TIPO_DOCUMENTO === 'DNI' && !/^\d{8}[A-Z]$/.test(doc)) mal.push('El DNI son 8 cifras y una letra.');
    if (doc && j.TIPO_DOCUMENTO === 'NIE' && !/^[XYZ]\d{7}[A-Z]$/.test(doc)) mal.push('El NIE es X, Y o Z, 7 cifras y una letra.');
    if (txt(j.EMAIL) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(txt(j.EMAIL))) mal.push('El correo no parece válido.');
    if (/[@/]/.test(txt(j.INSTAGRAM))) mal.push('Instagram: solo el usuario, sin @ ni enlace.');
    var tel = telefono(j.TELEFONO);
    var otra = tel && (todas || []).filter(function (x) { return String(x.ID) !== String(id || '') && telefono(x.TELEFONO) === tel; })[0];
    if (otra) mal.push('Ya hay una jugadora con ese teléfono: ' + nombreJug(otra) + ' (' + otra.ID + ').');
    return mal;
  }

  var CALC = { cts: cts, eur: eur, edad: edad, fecha: fecha, ids: ids, norm: norm, temporadas: temporadas, temporadaActual: temporadaActual,
    compsDe: compsDe, iesDe: iesDe, cuenta: cuenta, plantilla: plantilla, pago: pago, contexto: contexto, avisosEquipo: avisosEquipo,
    avisosJugadora: avisosJugadora, buscarJugadoras: buscarJugadoras, problemasJugadora: problemasJugadora, nombreJug: nombreJug,
    avisosResueltos: avisosResueltos, esAviso: esAviso, ijsValidas: ijsValidas,
    avisosPospuestos: avisosPospuestos, esPospuesto: esPospuesto };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }


  /* ======================= pantalla =======================
   * Se ve como la Gestión publicada (kanban4/gestion.js, 4.1): cabecera con la temporada pintada, la hora de los datos y ↻;
   * pestañas; filtros comunes (temporada, competición, liga), plegados en el móvil tras «Filtros (n)»; botones de filtro con
   * su contador; tabla en el ordenador (desde 900 px) y lista en el móvil; fichas en ventana con «Guardar N cambios».
   * Los estilos son los gs- de estilos/base.css (bloque «Gestión de Konamigas»). */

  var BASE = ['TEMPORADAS', 'COMPETICIONES', 'LIGAS', 'EQUIPOS', 'INSCRIPCIONES_EQUIPOS', 'JUGADORAS', 'STAFF', 'COLORES', 'FOTOS', 'REVISIONES'];
  var ECO = ['TARIFAS', 'DESCUENTOS', 'MOVIMIENTOS'];
  var IJ = 'INSCRIPCIONES_JUGADORAS';
  // Las fotos van en la ficha de cada jugadora y las sin vincular se asignan desde el Resumen: FOTOS en PESTANAS se ignora.
  var PESTANAS = { RESUMEN: 'Resumen', EQUIPOS: 'Equipos', JUGADORAS: 'Jugadoras', REVISIONES: 'Revisiones' };
  var VER = 250;
  var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var ACEPTA = { ACEPTA_NORMAS: 'Normas', ACEPTA_DERECHOS_IMAGEN: 'Fotos', ACEPTA_DATOS: 'Datos', ACEPTA_RESPONSABILIDAD: 'Responsabilidad' };

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function opciones(lista, sel, vacio) {
    return (vacio !== undefined ? '<option value="">' + texto(vacio) + '</option>' : '') + lista.map(function (o) {
      return '<option value="' + texto(o[0]) + '"' + (String(o[0]) === String(sel == null ? '' : sel) ? ' selected' : '') + '>' + texto(o[1]) + '</option>';
    }).join('');
  }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) {} return ''; }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
  /** Euros sin «,00» (como la publicada). */
  function eurC(c) { return eur(c).replace(/,00 €$/, ' €'); }
  function edad1(n) { return isFinite(n) && n > 0 ? (Math.round(n * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '') : ''; }
  function tag(t, c) { return '<span class="gs-tag ' + (c || '') + '">' + texto(t) + '</span>'; }
  function fila(et, v) { return v === '' || v == null ? '' : '<div class="gs-df"><span>' + texto(et) + '</span><span>' + v + '</span></div>'; }
  /** Fecha de inscripción corta, «26/10/26» (y la hora, si la tiene). */
  function alta(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(s || ''));
    return m ? m[3] + '/' + m[2] + '/' + m[1].slice(2) + (m[4] && (m[4] + m[5]) !== '0000' ? ' ' + m[4] + ':' + m[5] : '') : '';
  }
  function esMovil() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.matchMedia && matchMedia('(pointer:coarse)').matches); }
  /** WhatsApp a un teléfono (a uno de 9 cifras se le pone el 34): en el móvil, la app; en el ordenador, WhatsApp Web. */
  /** msg (opcional): el mensaje ya escrito. */
  function wa(tel, msg) {
    var n = String(tel || '').replace(/\D/g, '');
    if (n.length === 9) n = '34' + n;
    if (n.length < 9) return '';
    return (esMovil() ? 'whatsapp://send?phone=' : 'https://web.whatsapp.com/send?phone=') + n + (msg ? '&text=' + encodeURIComponent(msg) : '');
  }
  function aWa(tel, et, clase, msg) {
    var u = wa(tel, msg);
    return u ? '<a class="' + (clase || 'gs-b2') + '" href="' + texto(u) + '"' + (/^whatsapp:/.test(u) ? '' : ' target="_blank" rel="noopener"') + '>' + texto(et) + '</a>' : '';
  }
  function porAlta(a, b) {
    var x = String(a.FECHA_INSCRIPCION || ''), y = String(b.FECHA_INSCRIPCION || '');
    return x < y ? -1 : x > y ? 1 : String(a.ID) < String(b.ID) ? -1 : String(a.ID) > String(b.ID) ? 1 : 0;
  }
  /** Lo que ha cambiado en una ficha respecto a la fila. Una casilla vacía en el Excel es «no»; una fecha con hora, igual a su día. */
  function cambios(f, v) {
    var c = {};
    Object.keys(v).forEach(function (k) {
      if (v[k] === undefined) return;
      if (typeof v[k] === 'boolean') { if ((f[k] === true) !== v[k]) c[k] = v[k]; return; }
      var a = String(f[k] == null ? '' : f[k]);
      if (/^\d{4}-\d{2}-\d{2}$/.test(v[k]) && a.slice(0, 10) === v[k]) return;
      if (a.trim() !== String(v[k])) c[k] = v[k];
    });
    return c;
  }

  window.UN.registrar('GESTION', {
    abrir: function (el, ctx) {
      var T = ctx.tablas, cfg = ctx.config || {};
      var PAGOS = cfg.PAGOS !== 'No';
      var tablas = BASE.concat(PAGOS ? ECO : []);
      var pest = String(cfg.PESTANAS || Object.keys(PESTANAS).join(',')).split(',').map(function (s) { return s.trim().toUpperCase(); })
        .filter(function (s) { return PESTANAS[s]; });
      if (!pest.length) pest = Object.keys(PESTANAS);
      var CLAVE = 'ges_' + ctx.id + '_';
      var abiertas = {};
      try { abiertas = JSON.parse(guardado(CLAVE + 'abiertas') || '{}') || {}; } catch (e) {}
      var S = { tab: pest.indexOf(guardado(CLAVE + 'tab')) >= 0 ? guardado(CLAVE + 'tab') : pest[0], tem: guardado(CLAVE + 'tem'), comp: '', liga: '', dia: '',
        filAb: false, eq: { filtro: 'inscritos', q: '' }, ju: { filtro: 'activas', q: '', equipo: '', n: VER }, rv: { todas: false },
        leido: false, ijTem: '', leyendo: '', hora: '' };

      el.innerHTML = '<div class="gs gs5">' +
        '<header class="gs-cab"><p><span class="gs-pint" id="gs-pint" hidden></span><span id="gs-hora">Datos guardados en este dispositivo</span>' +
        '<button type="button" class="gs-re" id="gs-re" aria-label="Volver a leer el Excel" title="Volver a leer el Excel">↻</button></p>' +
        '<nav class="gs-tabs" role="tablist">' + pest.map(function (p) {
          return '<button type="button" role="tab" data-tab="' + p + '" aria-selected="' + (p === S.tab) + '">' + PESTANAS[p] + '</button>';
        }).join('') + '</nav></header>' +
        '<div class="gs-main" id="gs-main"><div class="gs-cargando" role="status"><div class="u-carga"></div>Cargando la temporada…</div></div>' +
        '</div>';
      var raiz = el.querySelector('.gs'), main = el.querySelector('#gs-main');
      var velo = null, vent = null;
      var MQ = window.matchMedia ? window.matchMedia('(min-width:900px)') : { matches: false };
      function ancho() { return MQ.matches; }

      /* ---------- datos ---------- */

      function datos() {
        return {
          tem: T.filas('TEMPORADAS'), com: T.filas('COMPETICIONES'), lig: T.filas('LIGAS'), eqs: T.filas('EQUIPOS'), ie: T.filas('INSCRIPCIONES_EQUIPOS'),
          ij: T.filas(IJ), jug: T.filas('JUGADORAS'), stf: T.filas('STAFF'), col: T.filas('COLORES'), fot: T.filas('FOTOS'), rev: T.filas('REVISIONES'),
          tar: PAGOS ? T.filas('TARIFAS') : [], des: PAGOS ? T.filas('DESCUENTOS') : [], mov: PAGOS ? T.filas('MOVIMIENTOS') : []
        };
      }
      var d, tem, ix, ies, cx, memo, porIe;
      function preparar() {
        d = datos();
        d.ij = ijsValidas(d.ij); // una jugadora que se inscribió dos veces en el mismo equipo: solo la última
        tem = temporadas(d).filter(function (t) { return String(t.ID) === S.tem; })[0] || temporadaActual(d);
        ix = { tem: indice(d.tem), com: indice(d.com), lig: indice(d.lig), eqs: indice(d.eqs), ie: indice(d.ie), jug: indice(d.jug), stf: indice(d.stf), col: indice(d.col), ij: indice(d.ij) };
        ies = tem ? iesDe(d, tem.ID) : [];
        cx = contexto(d, tem ? tem.ID : '', { pagos: PAGOS, ijLeidas: jugLeidas() });
        memo = { pago: {}, avE: {}, avJ: {} };
        porIe = {};
        d.ij.forEach(function (j) { (porIe[j.ID_INSCRIPCION_EQUIPO] = porIe[j.ID_INSCRIPCION_EQUIPO] || []).push(j); });
      }
      function jugLeidas() { return !!tem && S.ijTem === tem.ID; }
      function nom(t, id) { var f = ix[t][String(id || '')]; return f ? txt(f.NOMBRE || f.APODO || f.ID) : txt(id); }
      function nomComp(id) { var c = ix.com[String(id || '')]; return c ? txt(c.NOMBRE_COMERCIAL || c.NOMBRE) : txt(id); }
      function nomIe(id) { var i = ix.ie[String(id || '')]; return i ? txt(i.NOMBRE_EQUIPO) || nom('eqs', i.ID_EQUIPO) : txt(id); }
      function hexDe(idColor) {
        var c = ix.col[String(idColor || '')], h = c ? txt(c.COLOR_HEX) : '';
        return /^#?[0-9a-f]{3,8}$/i.test(h) ? (h[0] === '#' ? '' : '#') + h : '';
      }
      /** El color de camiseta del equipo como un punto: es un dato (COLORES.COLOR_HEX), no un adorno. */
      function punto(idColor) {
        var h = hexDe(idColor);
        return h ? '<i class="gs-color" style="background:' + texto(h) + '" title="' + texto(nom('col', idColor)) + '"></i>' : '';
      }
      function guardando(f) { return f && (f._pendiente || f._nueva) ? tag('Guardando', 'gs-tag-g') : ''; }
      function pagoDe(i) { if (!PAGOS) return null; var k = String(i.ID); if (!(k in memo.pago)) memo.pago[k] = pago(d, i); return memo.pago[k]; }
      function falta(i) { var p = pagoDe(i); return p && !p.incluida && !p.sinTarifa && p.falta > 0 ? p.falta : 0; }
      function avE(i) { var k = String(i.ID); if (!memo.avE[k]) memo.avE[k] = avisosEquipo(d, i, cx); return memo.avE[k]; }
      function avJ(j) { var k = String(j.ID); if (!memo.avJ[k]) memo.avJ[k] = avisosJugadora(d, j, cx); return memo.avJ[k]; }
      function activas(idIe) { var i = ix.ie[idIe]; if (i && i.ESTADO === 'Baja') return []; return (porIe[idIe] || []).filter(function (j) { return j.ESTADO === 'Activa'; }); }
      /** Cuenta como inscrito (como en la publicada): ni Baja, ni sin confirmar, ni copa. */
      function inscrito(i) { return cuenta(i) && i.ESTADO !== 'Solicitada'; }
      function staff(id) { return ix.stf[String(id || '')] || null; }

      /** INSCRIPCIONES_JUGADORAS de la temporada: la parte de sus equipos inscritos. Al momento si ya se vio. */
      function parteTem(t) { return { clave: 'T:' + t, col: 'ID_INSCRIPCION_EQUIPO', valores: iesDe(datos(), t).map(function (i) { return i.ID; }) }; }
      function leerTem(fresco) {
        if (!tem) return Promise.resolve();
        var t = tem.ID, p = parteTem(t), o = {}; o[IJ] = p;
        if (T.tiene && T.tiene(IJ, p)) S.ijTem = t;
        return T.leer([IJ], { partes: o, fresco: !!fresco }).then(function () { S.ijTem = t; if (ctx.abierta()) pintar(); }, function (e) {
          if (ctx.abierta()) ctx.aviso('No se han podido leer las jugadoras: ' + String(e.message).replace(/^\w+:\s*/, ''));
        });
      }
      function ponerHora() {
        var x = el.querySelector('#gs-hora'); if (!x) return;
        x.textContent = S.hora ? 'Datos de las ' + S.hora : 'Datos guardados en este dispositivo';
      }
      function ahora() { var f = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return p(f.getHours()) + ':' + p(f.getMinutes()); }
      /** ↻: vuelve a leer del Excel las tablas y la parte de la temporada. */
      function releer() {
        var b = el.querySelector('#gs-re'); if (b) b.disabled = true;
        Promise.all([T.refrescar(tablas, true), leerTem(true)]).then(function () {
          S.hora = ahora(); ponerHora(); if (b) b.disabled = false; if (ctx.abierta()) pintar();
        }, function (e) {
          if (b) b.disabled = false;
          if (ctx.abierta()) ctx.aviso('No se ha podido leer el Excel: ' + String(e.message).replace(/^\w+:\s*/, ''));
        });
      }

      /* ---------- pintar ---------- */

      function pintar() {
        if (!S.leido) return;
        var act = document.activeElement, qFoco = act && raiz.contains(act) && act.getAttribute('data-q');
        preparar();
        [].forEach.call(el.querySelectorAll('.gs-tabs [data-tab]'), function (b) {
          var si = b.getAttribute('data-tab') === S.tab;
          b.setAttribute('aria-selected', si ? 'true' : 'false');
          if (si && b.parentNode.scrollWidth > b.parentNode.clientWidth) b.parentNode.scrollLeft = Math.max(0, b.offsetLeft - b.parentNode.offsetLeft - 16);
        });
        var pint = el.querySelector('#gs-pint');
        pint.textContent = tem ? txt(tem.NOMBRE || tem.ID) : ''; pint.hidden = !tem;
        if (!tem) { main.innerHTML = '<div class="gs-vacio">Todavía no hay temporadas. Añade la primera en la tabla TEMPORADAS del Excel COMPETICION.</div>'; return; }
        if (tem.ID !== S.ijTem && !S.leyendo) { S.leyendo = tem.ID; leerTem(); }
        main.innerHTML = (cfg.AYUDA ? '<p class="gs-nota gs-ayuda">' + texto(cfg.AYUDA) + '</p>' : '') +
          ({ RESUMEN: htmlResumen, EQUIPOS: htmlEquipos, JUGADORAS: htmlJugadoras, REVISIONES: htmlRevisiones })[S.tab]();
        // Las fotos de las tarjetas que se ven (grupos de Alertas abiertos y la pestaña Revisiones).
        [].forEach.call(main.querySelectorAll('details[open]'), function (x) { pintarFotos(x); });
        if (S.tab === 'REVISIONES') pintarFotos(main);
        if (qFoco) { var q = main.querySelector('[data-q="' + qFoco + '"]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
      }
      function cargandoJug(msg) { return '<div class="gs-cargando" role="status"><div class="u-carga"></div>' + texto(msg || 'Cargando las jugadoras de ' + tem.NOMBRE + '…') + '</div>'; }
      function caja(t) { return '<div class="u-tabla-caja">' + t + '</div>'; }

      /* ---------- filtros comunes: temporada, competición y liga (en el móvil, plegados tras «Filtros») ---------- */

      function htmlFiltros(soloTem) {
        var ts = temporadas(d).map(function (t) { return [t.ID, txt(t.NOMBRE || t.ID)]; });
        var h = '<div class="gs-filtros' + (soloTem ? ' gs-filtros-1' : '') + '"><select class="gs-sel" id="gs-temp" data-f="temp" aria-label="Temporada">' + opciones(ts, tem.ID) + '</select>';
        if (soloTem) return h + '</div>';
        var cs = compsDe(d, tem.ID).map(function (c) { return [c.ID, txt(c.NOMBRE_COMERCIAL || c.NOMBRE)]; });
        if (S.comp && !cs.some(function (c) { return c[0] === S.comp; })) S.comp = '';
        var ls = d.lig.filter(function (l) { return S.comp ? String(l.ID_COMPETICION) === S.comp : cs.some(function (c) { return c[0] === String(l.ID_COMPETICION); }); })
          .sort(function (a, b) { return (DIAS.indexOf(diaNorm(a.DIA_SEMANA)) - DIAS.indexOf(diaNorm(b.DIA_SEMANA))) || txt(a.NOMBRE).localeCompare(txt(b.NOMBRE), 'es'); })
          .map(function (l) { return [l.ID, txt(l.NOMBRE) + (S.comp ? '' : ' · ' + nomComp(l.ID_COMPETICION))]; });
        if (S.liga && S.liga !== '-' && !ls.some(function (l) { return l[0] === S.liga; })) S.liga = '';
        return h + '<select class="gs-sel" id="gs-fcomp" data-f="comp" aria-label="Competición">' + opciones(cs, S.comp, 'Todas las competiciones') + '</select>' +
          '<select class="gs-sel" id="gs-fliga" data-f="liga" aria-label="Liga">' + opciones(ls.concat([['-', 'Sin liga']]), S.liga, 'Todas las ligas') + '</select></div>';
      }
      function puestos(soloTem) {
        var p = [], act = temporadaActual(d);
        if (act && tem.ID !== act.ID) p.push(['temp', 'Temporada ' + txt(tem.NOMBRE)]);
        if (soloTem) return p;
        if (S.comp) p.push(['comp', nomComp(S.comp)]);
        if (S.liga) p.push(['liga', S.liga === '-' ? 'Sin liga' : nom('lig', S.liga)]);
        if (S.tab === 'JUGADORAS' && S.ju.equipo) p.push(['equipo', nomIe(S.ju.equipo)]);
        return p;
      }
      function filtrosPlegables(extra, soloTem) {
        var p = puestos(soloTem);
        return '<button type="button" class="gs-chip gs-fbtn" id="gs-fbtn" aria-expanded="' + !!S.filAb + '" aria-controls="gs-mas">Filtros' +
          (p.length ? '<span class="gs-fn">' + p.length + '</span>' : '') + '</button>' +
          (p.length && !S.filAb ? '<div class="gs-puestos">' + p.map(function (x) {
            return '<button type="button" class="gs-puesto" data-quitar="' + x[0] + '" aria-label="Quitar ' + texto(x[1]) + '"><span>' + texto(x[1]) + '</span><i aria-hidden="true">✕</i></button>';
          }).join('') + '</div>' : '') +
          '<div class="gs-mas' + (S.filAb ? '' : ' gs-cerr') + '" id="gs-mas">' + htmlFiltros(soloTem) + (extra || '') + '</div>';
      }
      function enFiltro(ie) {
        if (S.comp && String(ie.ID_COMPETICION) !== S.comp) return false;
        if (S.liga === '-' ? !!ie.ID_LIGA : S.liga && String(ie.ID_LIGA) !== S.liga) return false;
        return true;
      }
      /** Botones de filtro con su contador: [[valor, texto, cuántos]]. */
      function chips(lista, actual, grupo) {
        return '<div class="gs-chips" data-chips="' + grupo + '">' + lista.map(function (c) {
          return '<button type="button" class="gs-chip" data-chip="' + grupo + '" data-v="' + texto(c[0]) + '" aria-pressed="' + (c[0] === actual) + '">' + texto(c[1]) + (c[2] != null ? ' · ' + c[2] : '') + '</button>';
        }).join('') + '</div>';
      }
      function buscador(k, valor, largo) {
        return '<div class="gs-fila gs-busca"><input type="search" class="gs-sel" data-q="' + k + '" id="gs-q-' + k + '" placeholder="' + texto(ancho() ? largo : 'Buscar…') + '" value="' + texto(valor) + '" aria-label="Buscar"></div>';
      }
      function diaNorm(x) { var n = norm(x); return DIAS.filter(function (dd) { return norm(dd) === n; })[0] || txt(x); }

      /* ---------- RESUMEN: cifras, alertas y, por día, cada liga con sus equipos ---------- */

      function estadoPago(i) {
        if (!PAGOS || i.ESTADO !== 'Confirmada') return '';
        var p = pagoDe(i);
        if (!p) return '';
        if (p.incluida) return '<span class="gs-pag gs-pos">Incluida</span>';
        if (p.sinTarifa) return '<span class="gs-pag gs-amb">Sin tarifa</span>';
        if (p.falta > 0) return '<span class="gs-pag gs-neg">' + (p.cobrado <= 0 ? 'Sin pagar · ' : 'Faltan ') + eurC(p.falta) + '</span>';
        return '<span class="gs-pag gs-pos">Pagado</span>';
      }
      function edadMedia(idIe) {
        var es = activas(idIe).map(function (j) { var p = ix.jug[j.ID_JUGADORA]; return p ? edad(p.FECHA_NACIMIENTO) : ''; }).filter(function (x) { return x !== ''; });
        return es.length ? es.reduce(function (a, b) { return a + b; }, 0) / es.length : 0;
      }
      function diaDe(k) { if (!k) return 'Sin liga'; var l = ix.lig[k]; return l ? diaNorm(l.DIA_SEMANA) || 'Otro día' : 'Otro día'; }

      /* ---------- tarjetas: cada cosa que revisar explica el problema con sus datos y propone soluciones ahí mismo ----------
       * Las usan Alertas (Resumen), el bloque «Avisos» de las fichas y la pestaña Revisiones. Al resolver, la tarjeta se va al
       * momento (la acción va por la capa de tablas). «Dar por bueno» queda siempre como última opción. */

      /** Un grupo de Alertas: se despliega con sus tarjetas (hasta 40) y al final, ir a la pestaña ya filtrada. */
      function htmlAlerta(titulo, cards, ir) {
        if (!cards.length) return '<details class="gs-alt" data-vacio><summary><span>' + texto(titulo) + '</span><em class="gs-pos">0</em></summary></details>';
        return '<details class="gs-alt" data-alt="' + texto(titulo) + '"' + (altAb[titulo] ? ' open' : '') + '><summary><span>' + texto(titulo) + '</span><em class="gs-neg">' + cards.length + '</em></summary>' +
          '<div class="gs-tjs">' + cards.slice(0, 40).join('') + '</div>' + (cards.length > 40 ? '<div class="gs-mas-n">Y ' + (cards.length - 40) + ' más.</div>' : '') +
          (ir && pest.indexOf(ir[0]) >= 0 ? '<p class="gs-ir"><button type="button" class="gs-chip" data-ir="' + ir[0] + '" data-irf="' + ir[1] + '">Ver en ' + PESTANAS[ir[0]] + ' ›</button></p>' : '') + '</details>';
      }
      var altAb = {};
      function btnSol(sol, et, extra) { return '<button type="button" class="gs-b2" data-sol="' + sol + '"' + (extra || '') + '>' + texto(et) + '</button>'; }
      function selCampo(k, ops, vacio, et) {
        return '<label class="gs-campo gs-tj-c">' + texto(et) + '<select data-campo="' + k + '">' + opciones(ops, '', vacio) + '</select></label>';
      }
      function inpCampo(k, v, et, attrs) {
        return '<label class="gs-campo gs-tj-c">' + texto(et) + '<input type="text" data-campo="' + k + '" value="' + texto(v) + '"' + (attrs || '') + ' autocomplete="off"></label>';
      }
      /**
       * Una tarjeta: { titulo, texto, datos, sol, bueno } para el aviso a de la inscripción reg (IE… de equipo o IJ… de jugadora).
       * bueno: 'principal' cuando dar por bueno es la solución («Ya lo sabemos»).
       */
      function tarjeta(c, attrs, enFicha, ver) {
        return '<div class="gs-tarjeta' + (c.clase ? ' ' + c.clase : '') + '" ' + attrs + '>' +
          '<div class="gs-tj-t">' + c.titulo + '</div>' + (c.texto ? '<p class="gs-tj-p">' + c.texto + '</p>' : '') +
          (c.datos ? '<div class="gs-tj-d">' + c.datos + '</div>' : '') +
          (c.sol ? '<div class="gs-tj-s">' + c.sol + '</div>' : '') + '<p class="gs-tj-err" role="alert" hidden></p>' +
          '<div class="gs-tj-pie">' + (!enFicha && ver ? '<button type="button" class="gs-enl" ' + ver + '>Ver la ficha</button>' : '') +
          (c.posponer ? '<button type="button" class="gs-b2 gs-tj-pos" data-posponer>Posponer</button>' : '') +
          (c.bueno === 'no' ? '' : '<button type="button" class="gs-enl gs-ult" data-bueno>' + texto(c.buenoEt || 'No avisar más: lo dejamos así') + '</button>') +
          (c.posponer ? htmlPosponer(c.posponerNota) : '') +
          (c.bueno === 'no' ? '' : '<div class="gs-bueno" hidden><input type="text" maxlength="200" placeholder="Por qué (opcional)" aria-label="Por qué (opcional)">' +
            '<button type="button" class="gs-b2" data-confirmar>Confirmar</button></div>') + (c.pie || '') + '</div></div>';
      }
      /** El panel de «Posponer»: 1 semana, 2 semanas, 1 mes o hasta una fecha, y por qué. */
      function htmlPosponer(nota) {
        return '<div class="gs-posp" hidden><div class="gs-chips">' + [['7', '1 semana'], ['14', '2 semanas'], ['30', '1 mes'], ['fecha', 'Hasta…']].map(function (x) {
          return '<button type="button" class="gs-chip" data-plazo="' + x[0] + '" aria-pressed="' + (x[0] === '7') + '">' + x[1] + '</button>';
        }).join('') + '</div><input type="date" data-hasta hidden aria-label="Hasta">' +
          '<input type="text" data-porque maxlength="200" placeholder="Por qué (opcional)" aria-label="Por qué (opcional)">' +
          '<button type="button" class="gs-b2" data-pospone>Posponer hasta el ' + fechaCorta(masDias(7)) + '</button>' +
          (nota ? '<p class="gs-nota gs-ancho">' + nota + '</p>' : '<p class="gs-nota gs-ancho">Mientras esté pospuesto no sale en Alertas. Ese día vuelve a avisar solo.</p>') + '</div>';
      }
      function masDias(n) { var f = new Date(); f.setDate(f.getDate() + n); var p = function (x) { return (x < 10 ? '0' : '') + x; }; return f.getFullYear() + '-' + p(f.getMonth() + 1) + '-' + p(f.getDate()); }
      function fechaCorta(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] : ''; }
      function hastaDe(panel) {
        var b = panel.querySelector('[data-plazo][aria-pressed=true]'), v = b ? b.getAttribute('data-plazo') : '7';
        return v === 'fecha' ? String(panel.querySelector('[data-hasta]').value || '') : masDias(Number(v));
      }
      function posponer(reg, id, t, hasta, por) {
        return T.crear('REVISIONES', { TIPO: 'Pospuesto: ' + id, ID_REGISTRO: reg, FECHA: hasta, MOTIVO: t + (por ? ' · ' + por : ''), RESUELTO: false });
      }
      /** «Volver a avisar ya»: cierra todas las filas activas de ese aviso pospuesto. */
      function avisarYa(reg, id) {
        var h = hoy();
        return Promise.all(avisosPospuestos(d, reg, h).filter(function (x) { return x.id === id; }).reduce(function (a, x) { return a.concat(x.filas); }, []).filter(function (r) { return !r._nueva; })
          .map(function (r) { return T.actualizar('REVISIONES', r.ID, { RESUELTO: true, MOTIVO: txt(r.MOTIVO) + ' · Vuelve a avisar el ' + fecha(h) }); }));
      }
      function dorsalesOcupados(idIe, menos) {
        var ds = (porIe[idIe] || []).filter(function (x) { return x.ESTADO === 'Activa' && menos.indexOf(String(x.ID)) < 0 && txt(x.DORSAL); })
          .map(function (x) { return parseInt(x.DORSAL, 10); }).filter(isFinite).sort(function (a, b) { return a - b; });
        return ds.length ? 'Dorsales ocupados en el equipo: ' + ds.join(', ') + '.' : '';
      }
      /** Dorsales libres del 1 al 99 en un equipo (sin los de sus activas), ordenados; como mucho los 20 primeros. */
      function dorsalesLibres(idIe) {
        var oc = {}; (porIe[idIe] || []).forEach(function (x) { if (x.ESTADO === 'Activa' && txt(x.DORSAL)) oc[parseInt(x.DORSAL, 10)] = true; });
        var o = []; for (var i = 1; i <= 99 && o.length < 20; i++) if (!oc[i]) o.push(i);
        return o;
      }
      function plantillaOps(ie) { return activas(ie.ID).map(function (j) { return [j.ID_JUGADORA, (nombreJug(ix.jug[j.ID_JUGADORA]) || j.ID_JUGADORA) + (txt(j.DORSAL) ? ' · ' + txt(j.DORSAL) : '')]; }); }
      /** La tarjeta de un aviso (de equipo o de jugadora). */
      /** Qué pasa al dar por bueno cada aviso (el botón lo dice). */
      var NO_AVISAR = { solicitada: 'se queda sin confirmar', liga: 'va sin liga', mensaje: 'no hace falta el mensaje', grupo: 'no hace falta el grupo',
        color: 'el color se queda así', nombre: 'el nombre se queda así', 'capitana-fuera': 'la capitana se queda así', 'capitana-sin': 'va sin capitana',
        'dorsal-sin': 'juega sin dorsal', 'dorsal-rep': 'el dorsal se queda repetido', doble: 'puede jugar en los dos', acepta: 'ya lo ha aceptado de otra forma',
        pago: 'este pago no se va a cobrar' };
      function tarjetaAviso(a, reg, enFicha) {
        var ie = ix.ie[reg], ij = ie ? null : T.fila(IJ, reg), c = { bueno: '', posponer: true, buenoEt: NO_AVISAR[a.id] ? 'No avisar más: ' + NO_AVISAR[a.id] : '' };
        var attrs = 'data-reg="' + texto(reg) + '" data-av="' + texto(a.id) + '" data-t="' + texto(a.t) + '"';
        if (ie) {
          var n = '<b>' + punto(ie.ID_COLOR) + texto(nomIe(ie.ID)) + '</b>', cap = ix.jug[ie.ID_CAPITANA], waCap = cap ? aWa(cap.TELEFONO, 'Escribir a la capitana') : '';
          var lig = ix.lig[String(ie.ID_LIGA || '')];
          if (a.id === 'solicitada') {
            c.titulo = n + ' · Inscripción sin confirmar';
            c.texto = texto(nomIe(ie.ID)) + ' pidió inscribirse el ' + texto(fecha(ie.FECHA_INSCRIPCION)) + ' y aún no está confirmado. Mientras no se confirme, no cuenta como equipo de la temporada.';
            c.datos = texto([nomComp(ie.ID_COMPETICION), cap ? 'capitana ' + nombreJug(cap) + (cap.TELEFONO ? ' (' + cap.TELEFONO + ')' : '') : 'sin capitana'].join(' · '));
            c.sol = btnSol('confirmar', 'Confirmar inscripción') + btnSol('baja-eq', 'Dar de baja', ' data-pide') + waCap;
          } else if (a.id === 'liga') {
            c.titulo = n + ' · Sin liga';
            c.texto = 'Está confirmado pero no tiene liga: sin liga no entra en el calendario.';
            c.datos = texto([nomComp(ie.ID_COMPETICION), ie.NIVEL ? 'nivel ' + ie.NIVEL : '', ie.DISPONIBILIDAD ? 'quiere: ' + txt(ie.DISPONIBILIDAD) : ''].filter(Boolean).join(' · '));
            c.sol = selCampo('liga', ligasDe(ie.ID_COMPETICION), 'Elige la liga', 'Liga (día · gestor)') + btnSol('liga', 'Asignar');
          } else if (a.id === 'mensaje' || a.id === 'grupo') {
            c.titulo = n + (a.id === 'mensaje' ? ' · Sin mensaje inicial' : ' · Sin grupo de WhatsApp');
            c.texto = a.id === 'mensaje' ? 'No consta que se le haya enviado el mensaje inicial a la capitana (la bienvenida con lo que tiene que hacer).'
              : 'No consta que se haya creado su grupo de WhatsApp (capitanas o Team Search).';
            c.datos = cap ? 'Capitana: ' + texto(nombreJug(cap)) + (cap.TELEFONO ? ' · ' + texto(cap.TELEFONO) : '') : 'Sin capitana apuntada.';
            c.sol = waCap + (a.id === 'mensaje' ? btnSol('mensaje', 'Ya se lo hemos enviado') : btnSol('grupo', 'Grupo creado'));
          } else if (a.id === 'color') {
            var otros = ies.filter(function (x) { return x !== ie && x.ESTADO !== 'Baja' && String(x.ID_LIGA) === String(ie.ID_LIGA); });
            var mismos = otros.filter(function (x) { return String(x.ID_COLOR) === String(ie.ID_COLOR); });
            var usados = {}; otros.forEach(function (x) { if (x.ID_COLOR) (usados[x.ID_COLOR] = usados[x.ID_COLOR] || []).push(nomIe(x.ID)); });
            c.titulo = n + ' · Color repetido en su liga';
            c.texto = 'Lleva el mismo color (' + punto(ie.ID_COLOR) + texto(nom('col', ie.ID_COLOR)) + ') que ' + texto(mismos.map(function (x) { return nomIe(x.ID); }).join(' y ')) +
              ' en ' + texto(lig ? lig.NOMBRE : 'su liga') + ': en el campo no se distinguirán.';
            c.sol = '<div class="gs-campo gs-tj-c gs-ancho">Color nuevo<div class="gs-chips gs-tj-cols">' + d.col.filter(function (x) { return String(x.ID) !== String(ie.ID_COLOR); }).map(function (x) {
              var u = usados[x.ID];
              return '<button type="button" class="gs-chip" data-elige="' + texto(x.ID) + '" aria-pressed="false">' + punto(x.ID) + texto(txt(x.NOMBRE)) +
                ' <span class="gs-opc">' + (u ? '· lo lleva ' + texto(u.join(', ')) : '· libre') + '</span></button>';
            }).join('') + '</div></div>' + btnSol('color', 'Cambiar color');
          } else if (a.id === 'nombre') {
            var nn = norm(ie.NOMBRE_EQUIPO), dup = ies.filter(function (x) { return x !== ie && x.ESTADO !== 'Baja' && String(x.ID_COMPETICION) === String(ie.ID_COMPETICION) && norm(x.NOMBRE_EQUIPO) === nn; });
            c.titulo = n + ' · Nombre repetido';
            c.texto = 'Hay otro equipo con el mismo nombre en ' + texto(nomComp(ie.ID_COMPETICION)) + ': ' + texto(dup.map(function (x) { return nomIe(x.ID) + ' (' + x.ID + ', ' + x.ESTADO + ')'; }).join(', ')) +
              '. En el calendario y en la clasificación no se sabrá cuál es cuál.';
            c.sol = inpCampo('nombre', ie.NOMBRE_EQUIPO, 'Nombre este año', ' maxlength="80"') + btnSol('nombre', 'Cambiar nombre');
          } else if (a.id === 'capitana-fuera' || a.id === 'capitana-sin') {
            var ops = plantillaOps(ie);
            c.titulo = n + (a.id === 'capitana-sin' ? ' · Sin capitana' : ' · La capitana no está en la plantilla');
            c.texto = a.id === 'capitana-sin' ? 'No tiene capitana: es a quien escribimos para todo lo del equipo (pagos, horarios, avisos).'
              : 'La capitana apuntada (' + texto(nombreJug(cap) || ie.ID_CAPITANA) + ') no está en la plantilla de este año.';
            c.sol = (ops.length ? selCampo('capitana', ops, 'Elige de la plantilla', 'Capitana') + btnSol('capitana', 'Poner de capitana') : '<p class="gs-nota">Todavía no tiene jugadoras inscritas.</p>') +
              (a.id === 'capitana-fuera' ? btnSol('quitar-cap', 'Quitar capitana') : '');
          } else if (a.id === 'pago') {
            var p = pagoDe(ie) || {}, r = staff(ie.ID_RESPONSABLE);
            c.titulo = n + ' · Faltan ' + eurC(p.falta || 0);
            c.texto = 'Faltan ' + eurC(p.falta || 0) + ' de la inscripción: precio ' + eurC(p.precio || 0) + ' − descuento ' + eurC(p.descuento || 0) + ' − cobrado ' + eurC(p.cobrado || 0) + '.';
            c.datos = 'Los cobros se apuntan en Economía con la referencia «Inscripción» · ' + texto(ie.ID) + ': cuando se apunte lo que falta, el aviso se va solo.';
            c.sol = waCap + (r ? (wa(r.TELEFONO) ? aWa(r.TELEFONO, 'Escribir al responsable (' + txt(r.APODO || r.NOMBRE) + ')') : '<span class="gs-sintel">Responsable ' + texto(r.APODO || r.NOMBRE) + ': sin teléfono en STAFF</span>') : '');
            c.posponerNota = 'Úsalo si ya estáis en ello con el equipo (p. ej. pagará más tarde). El dinero sigue contando en Por pagar hasta que se apunte el cobro en Economía; ese día vuelve a avisar solo.';
          } else { c.titulo = n + ' · ' + texto(a.t); }
          return tarjeta(c, attrs, enFicha, 'data-ie="' + texto(ie.ID) + '"');
        }
        if (!ij) return '';
        var pj = ix.jug[ij.ID_JUGADORA] || {}, nj = texto(nombreJug(pj) || ij.ID_JUGADORA), eq = texto(nomIe(ij.ID_INSCRIPCION_EQUIPO)), iej = ix.ie[ij.ID_INSCRIPCION_EQUIPO] || {};
        var nb = '<b>' + nj + '</b> <span class="gs-opc">· ' + punto(iej.ID_COLOR) + eq + '</span>';
        if (a.id === 'dorsal-sin') {
          c.titulo = nb + ' · Sin dorsal';
          c.texto = nj + ' (' + eq + ') no tiene dorsal: el árbitro la identifica por él.';
          c.datos = texto(dorsalesOcupados(ij.ID_INSCRIPCION_EQUIPO, [String(ij.ID)]));
          c.sol = inpCampo('dorsal', '', 'Dorsal', ' maxlength="3" inputmode="numeric"') + btnSol('dorsal', 'Guardar dorsal');
        } else if (a.id === 'dorsal-rep') {
          var otra = (porIe[ij.ID_INSCRIPCION_EQUIPO] || []).filter(function (x) { return x !== ij && x.ESTADO === 'Activa' && txt(x.DORSAL) === txt(ij.DORSAL); })[0];
          var no = otra ? texto(nombreJug(ix.jug[otra.ID_JUGADORA]) || otra.ID_JUGADORA) : 'otra jugadora';
          c.titulo = nb + ' · Dorsal ' + texto(txt(ij.DORSAL)) + ' repetido';
          c.texto = nj + ' y ' + no + ' llevan el mismo dorsal (' + texto(txt(ij.DORSAL)) + ') en ' + eq + '. Cambia el de una de las dos.';
          c.datos = texto(dorsalesOcupados(ij.ID_INSCRIPCION_EQUIPO, [String(ij.ID)].concat(otra ? [String(otra.ID)] : [])));
          var libres = dorsalesLibres(ij.ID_INSCRIPCION_EQUIPO), escribir = function (x) {
            var p2 = ix.jug[x.ID_JUGADORA] || {}, nom2 = txt(p2.NOMBRE) || nombreJug(p2);
            var msg = 'Hola ' + nom2 + ', en ' + nomIe(ij.ID_INSCRIPCION_EQUIPO) + ' hay dos jugadoras con el dorsal ' + txt(ij.DORSAL) + '. Los dorsales que quedan libres en tu equipo son: ' +
              libres.join(', ') + '. ¿Cuál te quedas?';
            return aWa(p2.TELEFONO, 'Escribir a ' + (nombreJug(p2) || x.ID_JUGADORA), 'gs-b2', msg) || '<span class="gs-sintel">' + texto(nombreJug(p2)) + ': sin teléfono</span>';
          };
          c.sol = '<div class="gs-tj-was">' + escribir(ij) + (otra ? escribir(otra) : '') + '</div>' +
            inpCampo('dorsal', txt(ij.DORSAL), 'Dorsal de ' + (nombreJug(pj) || ij.ID_JUGADORA), ' maxlength="3" inputmode="numeric"') +
            (otra ? inpCampo('dorsal2', txt(otra.DORSAL), 'Dorsal de ' + (nombreJug(ix.jug[otra.ID_JUGADORA]) || otra.ID_JUGADORA), ' maxlength="3" inputmode="numeric" data-otra="' + texto(otra.ID) + '"') : '') +
            btnSol('dorsales', 'Guardar');
        } else if (a.id === 'doble') {
          var dobles = d.ij.filter(function (x) { var e2 = ix.ie[x.ID_INSCRIPCION_EQUIPO]; return String(x.ID_JUGADORA) === String(ij.ID_JUGADORA) && x.ESTADO === 'Activa' && e2 && e2.ESTADO !== 'Baja' && e2.ID_LIGA && String(e2.ID_LIGA) === String(iej.ID_LIGA); });
          c.titulo = nb + ' · En dos equipos de la misma liga';
          c.texto = 'Está activa en dos equipos de la misma liga (' + texto(nom('lig', iej.ID_LIGA)) + '): ' + texto(dobles.map(function (x) { return nomIe(x.ID_INSCRIPCION_EQUIPO); }).join(' y ')) +
            '. En dos ligas distintas sí puede jugar, pero en la misma liga se enfrentarían sus dos equipos: tiene que quedarse en uno.';
          c.datos = texto(dobles.map(function (x) { return nomIe(x.ID_INSCRIPCION_EQUIPO) + ': inscrita el ' + fecha(x.FECHA_INSCRIPCION) + (txt(x.DORSAL) ? ', dorsal ' + txt(x.DORSAL) : ''); }).join(' · '));
          c.sol = dobles.map(function (x) { return btnSol('baja-ij', 'Dar de baja en ' + nomIe(x.ID_INSCRIPCION_EQUIPO), ' data-pide data-ijb="' + texto(x.ID) + '"'); }).join('');
        } else if (a.id === 'acepta') {
          c.titulo = nb + ' · Sin aceptar las condiciones';
          c.texto = 'No consta que haya aceptado ' + texto(a.t.replace(/^Sin aceptar /, '')) + ' al inscribirse. Se acepta en el formulario de inscripción: pídele que lo haga.';
          c.sol = aWa(pj.TELEFONO, 'Escribirle por WhatsApp') || '<span class="gs-sintel">Sin teléfono en su ficha</span>';
        } else c.titulo = nb + ' · ' + texto(a.t);
        return tarjeta(c, attrs, enFicha, 'data-ij="' + texto(ij.ID) + '"');
      }
      /** En una ficha: sus avisos en tarjetas y los ya dados por buenos. */
      function bloqueAvisos(av, reg) {
        return (av.length ? '<div class="gs-sec">Avisos</div><div class="gs-tjs">' + av.map(function (a) { return tarjetaAviso(a, reg, true); }).join('') + '</div>' : '') +
          '<div data-resueltos="' + texto(reg) + '">' + htmlResueltos(reg) + '</div>';
      }
      function tarjetaFotos(n) {
        return tarjeta({ titulo: '<b>' + plural(n, 'foto', 'fotos') + ' sin vincular</b>', texto: 'Son fotos de esta temporada de las que aún no se sabe quién sale. Hasta que se diga, no salen en la ficha de la jugadora ni se sabe si se pueden publicar.',
          sol: '<button type="button" class="gs-b2" data-asignar>Asignar fotos</button>', bueno: 'no' }, 'data-tj="fotos"', true);
      }

      /** Las revisiones (dudas de la migración y de los formularios), en tarjetas que se deciden ahí mismo. */
      function revIds(r) { return ids(txt(r.ID_REGISTRO) + ' ' + txt(r.CANDIDATOS)); }
      function insDeTem(idJug, idTem) {
        var dt = indice(iesDe(d, idTem));
        return ijsValidas(T.filas(IJ)).filter(function (x) { return String(x.ID_JUGADORA) === String(idJug) && dt[x.ID_INSCRIPCION_EQUIPO]; })
          .sort(function (a, b) { return (a.ESTADO === 'Activa' ? 0 : 1) - (b.ESTADO === 'Activa' ? 0 : 1); })[0] || null;
      }
      function parteRev(r, js) { return { clave: 'R:' + r.ID, col: 'ID_JUGADORA', valores: js }; }
      var pedidasRev = {};
      /** Las inscripciones de las jugadoras de una revisión: se piden una vez y se repinta al llegar. */
      function leerRev(r, js) {
        if (!js.length || pedidasRev[r.ID]) return;
        pedidasRev[r.ID] = true;
        var o = {}; o[IJ] = parteRev(r, js);
        if (T.tiene && T.tiene(IJ, o[IJ])) return;
        T.leer([IJ], { partes: o }).then(function () { if (ctx.abierta()) pintar(); }, function () {});
      }
      function tarjetaRev(r) {
        var tipo = txt(r.TIPO), resuelta = r.RESUELTO === true, todos = revIds(r), c = { bueno: 'no' };
        var attrs = 'data-rev="' + texto(r.ID) + '" data-revt="' + texto(tipo) + '"';
        var hecha = resuelta ? '<p class="gs-tj-dec">' + tag('Resuelta', 'gs-tag-v') + ' ' + texto(r.MOTIVO) + '</p>' : '';
        var reabrir = resuelta ? '<button type="button" class="gs-enl" data-sol="reabrir">Volver a abrirla</button>' : '';
        if (tipo === 'Foto') {
          var fid = todos.filter(function (x) { return /^FOT/.test(x); })[0], f = fid && T.fila('FOTOS', fid);
          var js = todos.filter(function (x) { return ix.jug[x]; });
          leerRev(r, js);
          c.titulo = '<b>Foto: ¿quién sale?</b> <span class="gs-opc">· ' + texto(r.ID) + '</span>';
          c.texto = 'Al cargar las fotos, el nombre del archivo ' + (f ? '«' + texto(f.NOMBRE_ORIGINAL) + '»' : texto(fid || r.ID_REGISTRO)) +
            ' encajaba con varias jugadoras y no se supo cuál es. Mira la foto y elige quién sale.';
          if (resuelta) { c.datos = hecha; c.pie = reabrir; }
          else if (!f) { c.datos = 'No encuentro la foto ' + texto(fid || r.ID_REGISTRO) + ' en FOTOS.'; c.sol = btnSol('resolver', 'Marcar resuelta'); }
          else {
            var temF = String(f.ID_TEMPORADA || tem.ID);
            c.datos = '<div class="gs-grande gs-tj-foto">' + hueco(f, 480, 'gs-foto-g') + '</div>' + (f.ID_JUGADORA ? '<p class="gs-nota">Ahora está vinculada a ' + texto(nombreJug(ix.jug[f.ID_JUGADORA]) || f.ID_JUGADORA) + '.</p>' : '');
            c.sol = '<div class="gs-cands">' + js.map(function (id) {
              var x = insDeTem(id, temF), fs = fotosDe(id).filter(function (y) { return y !== f; });
              return '<div class="gs-cand"><div class="gs-min"><div class="gs-t">' + texto(nombreJug(ix.jug[id])) + ' <span class="gs-opc">' + texto(id) + '</span></div>' +
                '<div class="gs-s">' + (x ? punto((ix.ie[x.ID_INSCRIPCION_EQUIPO] || {}).ID_COLOR) + texto([nomIe(x.ID_INSCRIPCION_EQUIPO), txt(x.DORSAL) ? 'dorsal ' + txt(x.DORSAL) : 'sin dorsal'].join(' · ')) : 'Sin inscripción en esta temporada') + '</div>' +
                '<div class="gs-minis">' + (fs.length ? fs.slice(0, 3).map(function (y) { return hueco(y, 120, 'gs-foto-p'); }).join('') + (fs.length > 3 ? '<span class="gs-mas-f">+' + (fs.length - 3) + '</span>' : '') : '<span class="gs-opc">Sin fotos todavía</span>') + '</div></div>' +
                btnSol('es-ella', 'Es ella', ' data-jug="' + texto(id) + '"' + (x ? ' data-insc="' + texto(x.ID) + '"' : '')) + '</div>';
            }).join('') + '</div>' + btnSol('ninguna', 'No es ninguna');
          }
          return tarjeta(c, attrs, true);
        }
        if (tipo === 'Jugadora') {
          var jj = todos.filter(function (x) { return ix.jug[x]; });
          leerRev(r, jj);
          c.titulo = '<b>¿La misma jugadora?</b> <span class="gs-opc">· ' + texto(r.ID) + '</span>';
          c.texto = 'Al pasar los datos, estas fichas parecían la misma persona. Compara y decide.' + (txt(r.MOTIVO) && !resuelta ? ' <span class="gs-opc">(' + texto(r.MOTIVO) + ')</span>' : '');
          c.datos = '<div class="gs-comp">' + jj.map(function (id) {
            var p = ix.jug[id], doc = txt(p.NUM_DOCUMENTO).replace(/\s/g, '');
            var temps = ijsValidas(T.filas(IJ)).filter(function (x) { return String(x.ID_JUGADORA) === id; }).map(function (x) {
              var e2 = ix.ie[x.ID_INSCRIPCION_EQUIPO] || {}, cc = ix.com[e2.ID_COMPETICION] || {};
              return (nom('tem', cc.ID_TEMPORADA) || '') + ' ' + nomIe(x.ID_INSCRIPCION_EQUIPO) + (x.ESTADO === 'Baja' ? ' (baja)' : '');
            });
            return '<div class="gs-comp-i"><div class="gs-t">' + texto(nombreJug(p)) + '</div><div class="gs-dl">' + fila('ID', texto(id)) + fila('Nacimiento', texto(fecha(p.FECHA_NACIMIENTO))) +
              fila('Teléfono', texto(p.TELEFONO)) + fila('Correo', texto(p.EMAIL)) + fila('Documento', doc ? texto((p.TIPO_DOCUMENTO ? p.TIPO_DOCUMENTO + ' ' : '') + '···' + doc.slice(-4)) : '') +
              fila('Temporadas', temps.length ? texto(temps.join(' · ')) : (pedidasRev[r.ID] && !T.tiene(IJ, parteRev(r, jj)) ? 'Cargando…' : 'Ninguna')) + '</div>' +
              '<button type="button" class="gs-enl" data-jug="' + texto(id) + '">Ver la ficha</button></div>';
          }).join('') + '</div>' + hecha;
          if (resuelta) c.pie = reabrir;
          else c.sol = btnSol('distintas', 'Son distintas') + btnSol('misma', 'Son la misma') + '<p class="gs-nota gs-ancho">Unirlas se hace fuera de Gestión: queda apuntado para hacerlo.</p>';
          return tarjeta(c, attrs, true);
        }
        if (tipo === 'Equipo') {
          var es = equiposRev(r), ieIds = [];
          es.forEach(function (e) { d.ie.forEach(function (x) { if (String(x.ID_EQUIPO) === e) ieIds.push(String(x.ID)); }); });
          if (es.length) {
            // Las inscripciones de jugadora de sus equipos (de todas las temporadas), para contar las que comparten.
            if (ieIds.length && !pedidasRev['E' + r.ID]) {
              pedidasRev['E' + r.ID] = true;
              var oe = {}; oe[IJ] = { clave: 'RE:' + r.ID, col: 'ID_INSCRIPCION_EQUIPO', valores: ieIds };
              if (!(T.tiene && T.tiene(IJ, oe[IJ]))) T.leer([IJ], { partes: oe }).then(function () { if (ctx.abierta()) pintar(); }, function () {});
            }
            var jugsDe = function (e) {
              var mios = {}; d.ie.forEach(function (x) { if (String(x.ID_EQUIPO) === e) mios[x.ID] = 1; });
              var o = {}; ijsValidas(T.filas(IJ)).forEach(function (x) { if (mios[x.ID_INSCRIPCION_EQUIPO]) o[x.ID_JUGADORA] = 1; });
              return o;
            };
            var js2 = {}; es.forEach(function (e) { js2[e] = jugsDe(e); });
            c.titulo = '<b>¿El mismo equipo?</b> <span class="gs-opc">· ' + texto(r.ID) + '</span>';
            c.texto = 'Al pasar los datos, estos equipos parecían el mismo con otro nombre. Compara y decide.' + (txt(r.MOTIVO) && !resuelta ? ' <span class="gs-opc">(' + texto(r.MOTIVO) + ')</span>' : '');
            c.datos = '<div class="gs-comp">' + es.map(function (e) {
              var eq = ix.eqs[e] || {}, insc = d.ie.filter(function (x) { return String(x.ID_EQUIPO) === e; }).map(function (x) { var cc = ix.com[x.ID_COMPETICION] || {}; return { x: x, t: nom('tem', cc.ID_TEMPORADA) || '' }; })
                .sort(function (a, b) { return a.t < b.t ? 1 : -1; });
              var ult = insc[0] && insc[0].x, cap = ult && ix.jug[ult.ID_CAPITANA];
              var comparten = es.filter(function (o) { return o !== e; }).map(function (o) {
                var n2 = Object.keys(js2[e]).filter(function (j) { return js2[o][j]; }).length;
                return n2 + ' con ' + (txt((ix.eqs[o] || {}).NOMBRE) || o);
              }).join(' · ');
              return '<div class="gs-comp-i"><div class="gs-t">' + texto(eq.NOMBRE || e) + '</div><div class="gs-dl">' + fila('ID', texto(e)) +
                fila('Temporadas', insc.length ? insc.map(function (y) { return texto(y.t + ': ' + (txt(y.x.NOMBRE_EQUIPO) || eq.NOMBRE)) + (y.x.ESTADO === 'Baja' ? ' <span class="gs-opc">(baja)</span>' : ''); }).join('<br>') : 'Ninguna') +
                fila('Capitana', cap ? texto(nombreJug(cap) + (cap.TELEFONO ? ' · ' + cap.TELEFONO : '')) : '') +
                fila('Jugadoras en común', comparten ? texto(comparten) : '') + '</div>' +
                (ult && !resuelta ? '<button type="button" class="gs-enl" data-ie="' + texto(ult.ID) + '">Ver la ficha</button>' : '') + '</div>';
            }).join('') + '</div>' + hecha;
            if (resuelta) c.pie = reabrir;
            else c.sol = btnSol('distintos', 'Son distintos') + btnSol('mismo', 'Son el mismo') + '<p class="gs-nota gs-ancho">Unirlos se hace fuera de Gestión: queda apuntado para hacerlo.</p>';
            return tarjeta(c, attrs, true);
          }
        }
        c.titulo = '<b>' + texto(tipo || 'Revisión') + '</b> <span class="gs-opc">· ' + texto(r.ID) + '</span>';
        c.texto = texto(r.MOTIVO);
        var quien = function (id) { return ix.jug[id] ? nombreJug(ix.jug[id]) : ix.ie[id] ? nomIe(id) : ix.eqs[id] ? nom('eqs', id) : ''; };
        c.datos = fila('Registro', texto(r.ID_REGISTRO)) + fila('Candidatos', texto(todos.map(function (id) { return quien(id) ? quien(id) + ' (' + id + ')' : id; }).join(' · ') || r.CANDIDATOS)) + hecha;
        c.sol = resuelta ? '' : todos.map(function (id) {
          // Se abre la ficha de una jugadora o de una inscripción de equipo; un equipo sin más no tiene ficha propia.
          return ix.jug[id] || ix.ie[id] ? '<button type="button" class="gs-b2" ' + (ix.jug[id] ? 'data-jug' : 'data-ie') + '="' + texto(id) + '">Ver ' + texto(quien(id)) + '</button>' : '';
        }).join('') + btnSol('resolver', 'Marcar resuelta');
        if (resuelta) c.pie = reabrir;
        return tarjeta(c, attrs, true);
      }

      /**
       * Los equipos (EQUIPOS.ID) de una revisión de TIPO Equipo: por su ID, o por el nombre si viene sin él («LAS CHICAS
       * PICANTONAS»): primero EQUIPOS.NOMBRE y si no, el NOMBRE_EQUIPO de alguna inscripción.
       */
      function equiposRev(r) {
        var o = [];
        [txt(r.ID_REGISTRO)].concat(txt(r.CANDIDATOS).split(/\s*[\/,;|]\s*/)).forEach(function (parte) {
          parte = txt(parte); if (!parte) return;
          var porId = ids(parte).filter(function (x) { return ix.eqs[x]; });
          if (porId.length) { porId.forEach(function (x) { if (o.indexOf(x) < 0) o.push(x); }); return; }
          var n = norm(parte.replace(/\b[A-Z]{1,3}-?\d{3,6}\b/g, '')).trim();
          if (!n) return;
          var e = d.eqs.filter(function (x) { return norm(x.NOMBRE).trim() === n; })[0];
          var id = e ? String(e.ID) : ((d.ie.filter(function (x) { return norm(x.NOMBRE_EQUIPO).trim() === n; })[0] || {}).ID_EQUIPO || '');
          if (id && ix.eqs[id] && o.indexOf(String(id)) < 0) o.push(String(id));
        });
        return o;
      }

      /**
       * Guarda cambios de la inscripción de un equipo. Si cambia el ESTADO va por gestion5Equipo: al darlo de baja, el motor da
       * de baja a sus jugadoras (y al reactivarlo vuelven las que se fueron con él), y las devuelve en otras.
       */
      function escribirIe(ie, c) {
        if (!('ESTADO' in c) || c.ESTADO === ie.ESTADO) return T.actualizar('INSCRIPCIONES_EQUIPOS', ie.ID, c);
        var antes = {}; Object.keys(c).forEach(function (k) { antes[k] = ie[k] === undefined ? '' : ie[k]; });
        return T.actualizar('INSCRIPCIONES_EQUIPOS', ie.ID, c, { fn: 'gestion5Equipo', args: [ie.ID, c, { antes: antes }] });
      }
      /** Lo que hace cada botón de solución de una tarjeta. Devuelve el texto del aviso, o un error. */
      function resolver(btn) {
        var card = btn.closest('.gs-tarjeta'), sol = btn.getAttribute('data-sol'), reg = card.getAttribute('data-reg');
        var err = function (m) { var e = card.querySelector('.gs-tj-err'); e.textContent = m; e.hidden = false; };
        if (btn.hasAttribute('data-pide') && !btn.hasAttribute('data-seguro')) { btn.setAttribute('data-seguro', ''); btn.textContent = '¿Seguro? Pulsa otra vez'; return; }
        var campo = function (k) { var e = card.querySelector('[data-campo="' + k + '"]'); return e ? String(e.value).trim() : ''; };
        var ie = reg && ix.ie[reg], ij = reg && !ie ? T.fila(IJ, reg) : null, hecho = '', cam = {}, ps = [];
        var ponIe = function (c) { cam = c; ps.push(escribirIe(ie, c)); };
        var dorsalMal = function (v, idIe, menos) {
          if (!/^\d{1,3}$/.test(v)) return 'El dorsal es un número.';
          var o = (porIe[idIe] || []).filter(function (x) { return x.ESTADO === 'Activa' && menos.indexOf(String(x.ID)) < 0 && txt(x.DORSAL) === v; })[0];
          return o ? 'El ' + v + ' ya lo lleva ' + (nombreJug(ix.jug[o.ID_JUGADORA]) || o.ID_JUGADORA) + '.' : '';
        };
        var rev = card.hasAttribute('data-rev') ? T.fila('REVISIONES', card.getAttribute('data-rev')) : null;
        var cerrarRev = function (dec) { ps.push(T.actualizar('REVISIONES', rev.ID, { RESUELTO: true, MOTIVO: txt(rev.MOTIVO) + (dec ? ' · Decisión: ' + dec : '') })); };
        if (sol === 'confirmar') { ponIe({ ESTADO: 'Confirmada' }); hecho = 'Inscripción confirmada.'; }
        else if (sol === 'baja-eq') { ponIe({ ESTADO: 'Baja' }); hecho = 'Equipo dado de baja, con sus jugadoras.'; }
        else if (sol === 'liga') { var l = campo('liga'); if (!l) return err('Elige la liga.'); ponIe({ ID_LIGA: l }); hecho = 'Liga asignada: ' + nom('lig', l) + '.'; }
        else if (sol === 'mensaje') { ponIe({ MENSAJE_INICIAL_ENVIADO: true }); hecho = 'Apuntado: mensaje inicial enviado.'; }
        else if (sol === 'grupo') { ponIe({ GRUPO_CREADO: true }); hecho = 'Apuntado: grupo creado.'; }
        else if (sol === 'color') { var cb = card.querySelector('[data-elige][aria-pressed=true]'); if (!cb) return err('Elige el color nuevo.'); ponIe({ ID_COLOR: cb.getAttribute('data-elige') }); hecho = 'Color cambiado a ' + nom('col', cb.getAttribute('data-elige')) + '.'; }
        else if (sol === 'nombre') { var nm = campo('nombre'); if (!nm) return err('Escribe el nombre.'); if (norm(nm) === norm(ie.NOMBRE_EQUIPO)) return err('Es el mismo nombre: cámbialo.'); ponIe({ NOMBRE_EQUIPO: nm }); hecho = 'Nombre cambiado.'; }
        else if (sol === 'capitana') { var cp = campo('capitana'); if (!cp) return err('Elige a la capitana.'); ponIe({ ID_CAPITANA: cp }); hecho = 'Capitana: ' + nombreJug(ix.jug[cp]) + '.'; }
        else if (sol === 'quitar-cap') { ponIe({ ID_CAPITANA: '' }); hecho = 'Capitana quitada.'; }
        else if (sol === 'dorsal') {
          var v = campo('dorsal'), m = dorsalMal(v, ij.ID_INSCRIPCION_EQUIPO, [String(ij.ID)]); if (m) return err(m);
          cam = { DORSAL: v }; ps.push(T.actualizar(IJ, ij.ID, cam, { fn: 'gestion5Dorsal', args: [ij.ID, v] })); hecho = 'Dorsal ' + v + ' guardado.';
        } else if (sol === 'dorsales') {
          var e2 = card.querySelector('[data-campo=dorsal2]'), otra = e2 && T.fila(IJ, e2.getAttribute('data-otra'));
          var v1 = campo('dorsal'), v2 = campo('dorsal2'), menos = [String(ij.ID)].concat(otra ? [String(otra.ID)] : []);
          if (otra && v1 === v2) return err('Siguen llevando el mismo dorsal: cambia uno de los dos.');
          var m1 = dorsalMal(v1, ij.ID_INSCRIPCION_EQUIPO, menos) || (otra ? dorsalMal(v2, ij.ID_INSCRIPCION_EQUIPO, menos) : ''); if (m1) return err(m1);
          if (v1 !== txt(ij.DORSAL)) { cam = { DORSAL: v1 }; ps.push(T.actualizar(IJ, ij.ID, cam, { fn: 'gestion5Dorsal', args: [ij.ID, v1] })); }
          if (otra && v2 !== txt(otra.DORSAL)) ps.push(T.actualizar(IJ, otra.ID, { DORSAL: v2 }, { fn: 'gestion5Dorsal', args: [otra.ID, v2] }));
          hecho = 'Dorsales guardados.';
        } else if (sol === 'baja-ij') {
          var xb = T.fila(IJ, btn.getAttribute('data-ijb')); if (!xb) return;
          if (String(xb.ID) === String(ij.ID)) cam = { ESTADO: 'Baja' };
          ps.push(T.actualizar(IJ, xb.ID, { ESTADO: 'Baja' })); hecho = 'Dada de baja en ' + nomIe(xb.ID_INSCRIPCION_EQUIPO) + '.';
        } else if (sol === 'es-ella') {
          var fid = revIds(rev).filter(function (x) { return /^FOT/.test(x); })[0], f = T.fila('FOTOS', fid), id = btn.getAttribute('data-jug'), xi = T.fila(IJ, btn.getAttribute('data-insc'));
          if (!f) return;
          ps.push(xi ? vincular(f, xi) : T.actualizar('FOTOS', f.ID, { ID_JUGADORA: id, ID_INSCRIPCION_EQUIPO: '', ESTADO: 'Vinculada', PUBLICABLE: false }));
          cerrarRev('es ' + nombreJug(ix.jug[id]) + ' (' + id + ')'); hecho = 'Foto vinculada a ' + nombreJug(ix.jug[id]) + '.';
        } else if (sol === 'ninguna') {
          var fn = T.fila('FOTOS', revIds(rev).filter(function (x) { return /^FOT/.test(x); })[0]);
          if (fn && fn.ESTADO !== 'Sin vincular') ps.push(desvincular(fn));
          cerrarRev('ninguna; queda para asignar'); hecho = 'Queda para asignar desde el Resumen.';
        } else if (sol === 'distintas') { cerrarRev('son distintas'); hecho = 'Apuntado: son distintas.'; }
        else if (sol === 'distintos') { cerrarRev('son distintos'); hecho = 'Apuntado: son distintos.'; }
        else if (sol === 'mismo') { cerrarRev('son el mismo; unir ' + equiposRev(rev).join(' y ')); hecho = 'Apuntado: son el mismo (unirlos se hace fuera de Gestión).'; }
        else if (sol === 'misma') { var jj = revIds(rev).filter(function (x) { return ix.jug[x]; }); cerrarRev('son la misma; unir ' + jj.join(' y ')); hecho = 'Apuntado: son la misma (unirlas se hace fuera de Gestión).'; }
        else if (sol === 'resolver') { cerrarRev(''); hecho = 'Revisión resuelta.'; }
        else if (sol === 'reabrir') { ps.push(T.actualizar('REVISIONES', rev.ID, { RESUELTO: false })); hecho = 'Revisión abierta otra vez.'; }
        if (!ps.length) return;
        Promise.all(ps).then(function () {}, function () {});
        ctx.aviso(hecho);
        // En una ficha: la tarjeta se va y el campo de la ficha se pone igual, para que «Guardar» no lo deshaga.
        if (vent && vent.contains(card)) {
          var pre = ie ? 'e-' : 'i-';
          Object.keys(cam).forEach(function (k) { var x = vent.querySelector('#' + pre + k); if (!x) return; if (x.type === 'checkbox') x.checked = cam[k] === true; else x.value = cam[k]; });
          var cp2 = vent.querySelector('#gs-colpre'); if (cp2 && cam.ID_COLOR) cp2.style.background = hexDe(cam.ID_COLOR) || 'transparent';
          var cont = card.parentNode; card.remove();
          if (cont && !cont.children.length) { var sec = cont.previousElementSibling; if (sec && sec.classList.contains('gs-sec')) sec.remove(); cont.remove(); }
          vent.dispatchEvent(new Event('change'));
        } else card.remove();
      }
      /** Los avisos dados por buenos de una inscripción, con su motivo y «Volver a avisar». */
      function htmlResueltos(reg) {
        var rs = avisosResueltos(d, reg), ps = avisosPospuestos(d, reg);
        return (ps.length ? '<div class="gs-sec">Avisos pospuestos</div><div class="gs-resu">' + ps.map(function (x) {
          return '<div class="gs-resu-i"><span><b>Pospuesto hasta el ' + texto(fechaCorta(x.hasta)) + '</b> · ' + texto(x.motivo || x.id) + '</span>' +
            (x.fila._nueva ? '<span class="gs-opc">Guardando</span>' : '<button type="button" class="gs-enl" data-ya="' + texto(x.id) + '" data-reg="' + texto(reg) + '">Volver a avisar ya</button>') + '</div>';
        }).join('') + '</div>' : '') + (rs.length ? '<div class="gs-sec">Avisos dados por buenos</div><div class="gs-resu">' + rs.map(function (r) {
          return '<div class="gs-resu-i"><span>' + texto(r.motivo || r.id) + (r.fila.FECHA ? ' <span class="gs-opc">· ' + texto(fecha(r.fila.FECHA)) + '</span>' : '') + '</span>' +
            (r.fila._nueva ? '<span class="gs-opc">Guardando</span>' : '<button type="button" class="gs-enl" data-volver="' + texto(r.fila.ID) + '">Volver a avisar</button>') + '</div>';
        }).join('') + '</div>' : '');
      }
      function darPorBueno(reg, id, t, por) {
        var ya = d.rev.filter(function (r) { return esAviso(r) && txt(r.TIPO) === 'Aviso: ' + id && String(r.ID_REGISTRO) === String(reg); })[0];
        var p = ya ? T.actualizar('REVISIONES', ya.ID, { RESUELTO: true })
          : T.crear('REVISIONES', { TIPO: 'Aviso: ' + id, ID_REGISTRO: reg, MOTIVO: t + (por ? ' · ' + por : ''), RESUELTO: true, FECHA: hoy() });
        p.then(function () { if (ctx.abierta()) ctx.aviso('Aviso dado por bueno: ya no avisa.'); }, function () {});
      }
      /** La categoría de Economía de las señales (config SENALES): el motor pasa a ella los cobros al dar de baja un equipo. */
      var SENAL = PAGOS ? txt(cfg.SENALES) : '';
      /** Señales de los equipos de baja de la temporada: lo que pagaron y se queda como ingreso. No es una alerta. */
      function htmlSenales(vis) {
        var xs = vis.filter(function (i) { if (i.ESTADO !== 'Baja' || i.ORIGEN === 'Clasificación') return false; var p = pagoDe(i); return p && p.senal > 0; });
        if (!xs.length) return '';
        var tot = xs.reduce(function (n, i) { return n + pagoDe(i).senal; }, 0);
        return '<details class="gs-alt gs-senales"' + (altAb.senales ? ' open' : '') + ' data-alt="senales"><summary><span>Señales de equipos de baja · ' + plural(xs.length, 'equipo', 'equipos') + '</span><em class="gs-pos">' + eurC(tot) + '</em></summary>' +
          '<p class="gs-nota">Se dieron de baja después de pagar: no deben nada y lo pagado se queda como ingreso' + (SENAL ? ', en Economía en la categoría «' + texto(SENAL) + '»' : '') + '.</p>' +
          '<div class="gs-lista">' + xs.map(function (i) {
            return '<button type="button" class="gs-item" data-ie="' + texto(i.ID) + '"><div class="gs-min"><div class="gs-t">' + punto(i.ID_COLOR) + texto(nomIe(i.ID)) + '</div>' +
              '<div class="gs-s">' + texto([nomComp(i.ID_COMPETICION), nom('lig', i.ID_LIGA)].filter(Boolean).join(' · ')) + '</div></div><div class="gs-d">' + eurC(pagoDe(i).senal) + '</div></button>';
          }).join('') + '</div></details>';
      }
      function htmlResumen() {
        var vis = ies.filter(enFiltro), eqs = vis.filter(inscrito), leidas = jugLeidas();
        var nJug = 0;
        eqs.forEach(function (i) { nJug += activas(i.ID).length; });
        var porPagar = eqs.filter(function (i) { return falta(i) > 0; });
        // Los grupos de Alertas salen de los avisos: uno dado por bueno ya no sale.
        // Cada aviso, una tarjeta.
        var cartas = function (xs) { var o = []; xs.forEach(function (x) { x.avs.forEach(function (a) { o.push(tarjetaAviso(a, x.i.ID, false)); }); }); return o; };
        var deAv = function (xs, f) { return xs.map(function (i) { return { i: i, avs: avE(i).filter(f) }; }).filter(function (x) { return x.avs.length; }); };
        var alPago = deAv(eqs, function (a) { return a.id === 'pago'; });
        var sinConf = deAv(vis.filter(cuenta), function (a) { return a.id === 'solicitada'; });
        var sinLiga = deAv(eqs, function (a) { return a.id === 'liga'; });
        var problemas = deAv(eqs, function (a) { return a.k !== 'pago' && a.k !== 'liga'; });
        var jAl = [];
        if (leidas) eqs.forEach(function (i) { activas(i.ID).forEach(function (j) { if (avJ(j).length) jAl.push(j); }); });
        var fotos = sinVincular();
        var revs = pest.indexOf('REVISIONES') >= 0 ? d.rev.filter(function (r) { return r.RESUELTO !== true && !esAviso(r) && !esPospuesto(r); }) : [];
        var nAl = alPago.length + sinConf.length + problemas.length + sinLiga.length + jAl.length + fotos.length + revs.length;

        var h = '<div class="gs-filtrar">' + filtrosPlegables() + '</div><div class="gs-res-top">' +
          '<div class="gs-mini gs-mini-' + (PAGOS ? 4 : 3) + '">' +
          '<button type="button" data-ir="EQUIPOS" data-irf="inscritos"><b>' + eqs.length + '</b><small>Equipos</small></button>' +
          '<button type="button" data-ir="JUGADORAS" data-irf="activas"><b>' + (leidas ? nJug : '…') + '</b><small>Jugadoras</small></button>' +
          (PAGOS ? '<button type="button" data-ir="EQUIPOS" data-irf="pagar" class="' + (porPagar.length ? 'gs-alerta' : '') + '"><b>' + porPagar.length + '</b><small>Por pagar</small></button>' : '') +
          '<button type="button" data-kpi="alertas" class="' + (nAl ? 'gs-alerta' : '') + '"><b>' + nAl + '</b><small>Alertas</small></button></div>' +
          '<div class="gs-card gs-alts" id="gs-alts"><div class="gs-alts-t">Alertas</div>' +
          (PAGOS ? htmlAlerta('Pagos pendientes', cartas(alPago), ['EQUIPOS', 'pagar']) : '') +
          htmlAlerta('Sin confirmar', cartas(sinConf), ['EQUIPOS', 'solicitadas']) +
          htmlAlerta('Problemas en la inscripción', cartas(problemas), ['EQUIPOS', 'avisos']) +
          htmlAlerta('Equipos sin liga', cartas(sinLiga), ['EQUIPOS', 'sinliga']) +
          (leidas ? htmlAlerta('Jugadoras con alerta', cartas(jAl.map(function (j) { return { i: j, avs: avJ(j) }; })), ['JUGADORAS', 'avisos'])
            : '<details class="gs-alt"><summary><span>Jugadoras con alerta</span><em>…</em></summary><p class="gs-nota">Cargando las jugadoras…</p></details>') +
          htmlAlerta('Fotos sin vincular', fotos.length ? [tarjetaFotos(fotos.length)] : []) +
          (pest.indexOf('REVISIONES') >= 0 ? htmlAlerta('Revisiones sin resolver', revs.map(tarjetaRev), ['REVISIONES', '']) : '') +
          (PAGOS ? htmlSenales(vis) : '') + '</div></div>';

        // Días con ligas (por el día de juego de LIGAS), en orden de la semana; al final, los equipos sin liga.
        var grupos = {};
        eqs.forEach(function (i) { var k = String(i.ID_LIGA || ''); (grupos[k] = grupos[k] || []).push(i); });
        var dias = {};
        Object.keys(grupos).forEach(function (k) { var dd = diaDe(k); (dias[dd] = dias[dd] || []).push(k); });
        var orden = DIAS.filter(function (x) { return dias[x]; }).concat(Object.keys(dias).filter(function (x) { return DIAS.indexOf(x) < 0 && x !== 'Sin liga'; }))
          .concat(dias['Sin liga'] ? ['Sin liga'] : []);
        if (S.dia && !dias[S.dia]) S.dia = '';
        var verDias = orden.filter(function (x) { return !S.dia || x === S.dia; });
        var visibles = [];
        verDias.forEach(function (x) { visibles = visibles.concat(dias[x]); });
        var algunaAbierta = visibles.some(function (k) { return abiertas[k || 'SIN']; });
        h += '<div class="gs-dias">' + [''].concat(orden).map(function (x) {
          return '<button type="button" class="gs-chip" data-dia="' + texto(x) + '" aria-pressed="' + (x === S.dia) + '">' + texto(x || 'Todos los días') + '</button>';
        }).join('') + (orden.length ? '<button type="button" class="gs-chip" id="gs-todas">' + (algunaAbierta ? 'Cerrar todas' : 'Abrir todas') + '</button>' : '') + '</div><div class="gs-semana">';
        verDias.forEach(function (x) {
          h += '<section class="gs-dia"><div class="gs-dia-h">' + texto(x) + '</div><div class="gs-ligas">';
          dias[x].sort(function (a, b) {
            if (!a) return 1; if (!b) return -1;
            var la = ix.lig[a] || {}, lb = ix.lig[b] || {};
            return nomComp(la.ID_COMPETICION).localeCompare(nomComp(lb.ID_COMPETICION), 'es') || txt(la.NOMBRE).localeCompare(txt(lb.NOMBRE), 'es');
          }).forEach(function (k) {
            var l = ix.lig[k], kk = k || 'SIN';
            var lista = grupos[k].slice().sort(function (a, b) { return (Number(b.NIVEL) || 0) - (Number(a.NIVEL) || 0) || nomIe(a.ID).localeCompare(nomIe(b.ID), 'es'); });
            var jug = 0; lista.forEach(function (i) { jug += activas(i.ID).length; });
            var pend = lista.filter(function (i) { return falta(i) > 0; }).length;
            var g = l ? staff(l.ID_GESTOR) : null;
            h += '<details class="gs-card gs-liga" data-liga="' + texto(kk) + '"' + (abiertas[kk] ? ' open' : '') + '><summary>' +
              '<div class="gs-liga-n">' + (l ? '<small>' + texto(nomComp(l.ID_COMPETICION)) + '</small>' + texto(l.NOMBRE) : 'Sin liga') + '</div>' +
              (g ? '<div class="gs-liga-g"><span>Gestor: <b>' + texto(g.APODO || g.NOMBRE) + '</b></span>' + (wa(g.TELEFONO) ? aWa(g.TELEFONO, 'WhatsApp', 'gs-wa') : '<span class="gs-opc">sin teléfono en STAFF</span>') + '</div>' :
                l ? '<div class="gs-liga-g"><span class="gs-opc">Sin gestor en LIGAS</span></div>' : '') +
              '<div class="gs-liga-s">' + plural(lista.length, 'equipo', 'equipos') + ' · ' + (leidas ? plural(jug, 'jugadora', 'jugadoras') : '… jugadoras') +
              (PAGOS ? (pend ? ' · <b class="gs-neg">' + pend + ' por pagar</b>' : ' · todo pagado') : '') + '</div></summary>' +
              lista.map(function (i) {
                var n = activas(i.ID).length, em = edad1(edadMedia(i.ID));
                return '<button type="button" class="gs-eqr" data-ie="' + texto(i.ID) + '"><span class="gs-n">' + texto(i.NIVEL || '–') + '</span>' +
                  '<b>' + punto(i.ID_COLOR) + '<span>' + texto(nomIe(i.ID)) + '</span></b>' + (estadoPago(i) || '<span></span>') +
                  '<small>' + texto([nombreJug(ix.jug[i.ID_CAPITANA]), leidas ? (n ? plural(n, 'jugadora', 'jugadoras') : 'sin jugadoras') : '', em ? em + ' años' : ''].filter(Boolean).join(' · ')) +
                  guardando(i) + '</small></button>';
              }).join('') + '</details>';
          });
          h += '</div></section>';
        });
        h += '</div>';
        if (!orden.length) h += '<div class="gs-vacio">' + (ies.length ? 'No hay equipos con estos filtros.' : 'Todavía no hay equipos inscritos en ' + texto(tem.NOMBRE) + '.') + '</div>';
        return h;
      }

      /* ---------- EQUIPOS ---------- */

      var FILTROS_EQ = {
        inscritos: inscrito,
        sinliga: function (i) { return inscrito(i) && !i.ID_LIGA; },
        pagar: function (i) { return inscrito(i) && falta(i) > 0; },
        avisos: function (i) { return inscrito(i) && avE(i).length > 0; },
        solicitadas: function (i) { return i.ESTADO === 'Solicitada' && i.ORIGEN !== 'Clasificación'; },
        bajas: function (i) { return i.ESTADO === 'Baja'; },
        copas: function (i) { return i.ORIGEN === 'Clasificación' && i.ESTADO !== 'Baja'; }
      };
      function tagsEquipo(i) {
        var t = [];
        if (i.ESTADO === 'Baja') t.push(tag('Baja · no cuenta', 'gs-tag-err'));
        if (i.ORIGEN === 'Clasificación') t.push(tag('Copa', 'gs-tag-g'));
        avE(i).forEach(function (a) {
          t.push(tag(a.t, a.k === 'solicitada' ? 'gs-tag-g' : a.k === 'liga' ? '' : a.k === 'nombre' || a.k === 'color' ? 'gs-tag-r' : 'gs-tag-a'));
        });
        if (inscrito(i) && i.EN_XPORTY !== true) t.push(tag('Sin Xporty', 'gs-tag-g'));
        t.push(guardando(i));
        return t.filter(Boolean);
      }
      function htmlEquipos() {
        var base = ies.filter(enFiltro), n = function (k) { return base.filter(FILTROS_EQ[k]).length; };
        var ls = [['inscritos', 'Inscritos', n('inscritos')], ['sinliga', 'Sin liga', n('sinliga')]];
        if (PAGOS) ls.push(['pagar', 'Por pagar', n('pagar')]);
        ls.push(['avisos', 'Avisos', n('avisos')], ['solicitadas', 'Sin confirmar', n('solicitadas')], ['bajas', 'Bajas', n('bajas')]);
        if (n('copas')) ls.push(['copas', 'Copas', n('copas')]);
        if (!FILTROS_EQ[S.eq.filtro] || (S.eq.filtro === 'pagar' && !PAGOS)) S.eq.filtro = 'inscritos';
        return '<div class="gs-filtrar">' + filtrosPlegables() + chips(ls, S.eq.filtro, 'eq') + buscador('eq', S.eq.q, 'Buscar: equipo, capitana, teléfono, liga, responsable…') + '</div>' +
          '<div id="gs-lista">' + listaEquipos() + '</div>';
      }
      function listaEquipos() {
        var q = norm(S.eq.q).trim();
        // Buscando, se mira en toda la temporada, también en las bajas.
        var xs = (q ? ies.filter(function (i) {
          var cap = ix.jug[i.ID_CAPITANA];
          return norm([i.ID, i.NOMBRE_EQUIPO, nom('eqs', i.ID_EQUIPO), nom('lig', i.ID_LIGA), nom('stf', i.ID_RESPONSABLE), nombreJug(cap), cap && cap.TELEFONO, cap && cap.EMAIL].join(' ')).indexOf(q) >= 0;
        }) : ies.filter(enFiltro).filter(FILTROS_EQ[S.eq.filtro])).sort(porAlta);
        var h = (q ? '<p class="gs-aviso-b">Buscando en toda la temporada ' + texto(tem.NOMBRE) + ', también en las bajas.</p>' : '') +
          '<p class="gs-cuenta">' + plural(xs.length, 'inscripción', 'inscripciones') + '</p>';
        if (!xs.length) return h + '<div class="gs-card"><div class="gs-vacio">' + (ies.length ? 'No hay inscripciones con este filtro.' : 'Todavía no hay equipos inscritos en ' + texto(tem.NOMBRE) + '.') + '</div></div>';
        var leidas = jugLeidas();
        if (ancho()) return h + caja('<table class="u-tabla gs-tabla"><thead><tr><th>Inscripción</th><th>Equipo</th>' + (S.comp ? '' : '<th>Competición</th>') +
          '<th>Liga</th><th>Capitana</th><th class="num">Jugadoras</th><th class="num">Nivel</th><th>Avisos</th></tr></thead><tbody>' + xs.map(function (i) {
            return '<tr tabindex="0"' + (i.ESTADO === 'Baja' ? ' class="gs-err"' : '') + ' data-ie="' + texto(i.ID) + '"><td class="gs-alta">' + alta(i.FECHA_INSCRIPCION) + '</td>' +
              '<td class="u-tabla-t">' + punto(i.ID_COLOR) + texto(nomIe(i.ID)) + '</td>' + (S.comp ? '' : '<td>' + texto(nomComp(i.ID_COMPETICION)) + '</td>') +
              '<td>' + texto(nom('lig', i.ID_LIGA)) + '</td><td>' + texto(nombreJug(ix.jug[i.ID_CAPITANA])) + '</td>' +
              '<td class="num">' + (leidas ? activas(i.ID).length || '' : '…') + '</td><td class="num">' + texto(i.NIVEL || '') + '</td>' +
              '<td><div class="gs-tags">' + tagsEquipo(i).join('') + '</div></td></tr>';
          }).join('') + '</tbody></table>');
        return h + '<div class="gs-card"><div class="gs-lista">' + xs.map(function (i) {
          var t = tagsEquipo(i), n = leidas ? activas(i.ID).length : 0;
          return '<button type="button" class="gs-item' + (i.ESTADO === 'Baja' ? ' gs-err' : '') + '" data-ie="' + texto(i.ID) + '"><div class="gs-min">' +
            '<div class="gs-t">' + punto(i.ID_COLOR) + texto(nomIe(i.ID) || '(sin nombre)') + '</div>' +
            '<div class="gs-s">' + texto([S.comp ? '' : nomComp(i.ID_COMPETICION), i.ID_LIGA ? nom('lig', i.ID_LIGA) : '', nombreJug(ix.jug[i.ID_CAPITANA]), n ? plural(n, 'jugadora', 'jugadoras') : ''].filter(Boolean).join(' · ')) +
            (q ? ' <span class="gs-alta">· ' + alta(i.FECHA_INSCRIPCION) + '</span>' : '') + '</div>' +
            (t.length ? '<div class="gs-tags">' + t.join('') + '</div>' : '') + '</div><div class="gs-d">' + (i.NIVEL ? 'Nivel ' + texto(i.NIVEL) : '') + '</div></button>';
        }).join('') + '</div></div>';
      }

      /* ---------- JUGADORAS ---------- */

      function ijCuenta(j) { var ie = ix.ie[j.ID_INSCRIPCION_EQUIPO]; return j.ESTADO !== 'Baja' && !!ie && ie.ESTADO !== 'Baja'; }
      var FILTROS_JUG = {
        activas: ijCuenta,
        avisos: function (j) { return ijCuenta(j) && avJ(j).length > 0; },
        xporty: function (j) { return ijCuenta(j) && j.EN_XPORTY !== true; },
        contactos: function (j) { return ijCuenta(j) && j.EN_CONTACTOS_GOOGLE !== true; },
        dorsal: function (j) { return ijCuenta(j) && !txt(j.DORSAL); },
        bajas: function (j) { return !ijCuenta(j); }
      };
      function tagsJugadora(j) {
        var t = [];
        if (!ijCuenta(j)) t.push(tag('Baja · no cuenta', 'gs-tag-err'));
        avJ(j).forEach(function (a) { t.push(tag(a.t, a.k === 'doble' ? 'gs-tag-r' : 'gs-tag-a')); });
        if (ijCuenta(j) && j.EN_XPORTY !== true) t.push(tag('Sin Xporty', 'gs-tag-g'));
        if (ijCuenta(j) && j.EN_CONTACTOS_GOOGLE !== true) t.push(tag('Sin contacto', 'gs-tag-g'));
        t.push(guardando(j));
        return t.filter(Boolean);
      }
      function visJug() { return indice(ies.filter(enFiltro)); }
      function htmlJugadoras() {
        var vis = visJug();
        if (S.ju.equipo && !vis[S.ju.equipo]) S.ju.equipo = '';
        var eqs = Object.keys(vis).map(function (k) { return vis[k]; }).filter(function (i) { return i.ESTADO !== 'Baja'; })
          .sort(function (a, b) { return nomIe(a.ID).localeCompare(nomIe(b.ID), 'es'); })
          .map(function (i) { return [i.ID, nomIe(i.ID) + (S.comp ? '' : ' · ' + nomComp(i.ID_COMPETICION))]; });
        var leidas = jugLeidas();
        var base = leidas ? d.ij.filter(function (j) { return vis[j.ID_INSCRIPCION_EQUIPO] && (!S.ju.equipo || String(j.ID_INSCRIPCION_EQUIPO) === S.ju.equipo); }) : [];
        var n = function (k) { return leidas ? base.filter(FILTROS_JUG[k]).length : null; };
        if (!FILTROS_JUG[S.ju.filtro]) S.ju.filtro = 'activas';
        return '<div class="gs-filtrar">' + filtrosPlegables('<div class="gs-fila gs-fila-eq"><select class="gs-sel" id="gs-jeq" data-f="juequipo" aria-label="Equipo">' +
            opciones(eqs, S.ju.equipo, 'Todos los equipos (' + eqs.length + ')') + '</select></div>') +
          chips([['activas', 'Inscritas', n('activas')], ['avisos', 'Con aviso', n('avisos')], ['xporty', 'Sin Xporty', n('xporty')], ['contactos', 'Sin contacto', n('contactos')],
            ['dorsal', 'Sin dorsal', n('dorsal')], ['bajas', 'Bajas', n('bajas')]], S.ju.filtro, 'ju') +
          buscador('ju', S.ju.q, 'Buscar: nombre, correo, DNI, teléfono, dorsal…') + '</div>' +
          '<div id="gs-lista">' + listaJugadoras() + '</div>';
      }
      function listaJugadoras() {
        if (!jugLeidas()) return cargandoJug();
        var vis = visJug(), q = norm(S.ju.q).trim(), tq = telefono(S.ju.q), todas = indice(ies);
        // Buscando, se mira en toda la temporada, también en las bajas; si no, el filtro de arriba.
        var xs = d.ij.filter(function (j) {
          if (q) {
            if (!todas[j.ID_INSCRIPCION_EQUIPO]) return false;
            var p = ix.jug[j.ID_JUGADORA] || {};
            return norm([j.ID_JUGADORA, nombreJug(p), p.TELEFONO, p.EMAIL, p.NUM_DOCUMENTO, p.INSTAGRAM, nomIe(j.ID_INSCRIPCION_EQUIPO), 'dorsal ' + txt(j.DORSAL)].join(' ')).indexOf(q) >= 0 ||
              (tq.length >= 6 && telefono(p.TELEFONO).indexOf(tq) >= 0);
          }
          return vis[j.ID_INSCRIPCION_EQUIPO] && (!S.ju.equipo || String(j.ID_INSCRIPCION_EQUIPO) === S.ju.equipo) && FILTROS_JUG[S.ju.filtro](j);
        }).sort(porAlta);
        var conEq = !!q || !S.ju.equipo;
        var h = (q ? '<p class="gs-aviso-b">Buscando en toda la temporada ' + texto(tem.NOMBRE) + ', también en las bajas.</p>' : '') +
          '<p class="gs-cuenta">' + plural(xs.length, 'inscripción', 'inscripciones') + '</p>';
        var ver = xs.slice(0, S.ju.n);
        if (!xs.length) h += '<div class="gs-card"><div class="gs-vacio">' + (q ? 'Ninguna jugadora inscrita esta temporada encaja con la búsqueda.' : 'No hay jugadoras con este filtro.') + '</div></div>';
        else if (ancho()) h += caja('<table class="u-tabla gs-tabla"><thead><tr><th>Inscripción</th><th>Jugadora</th>' + (conEq ? '<th>Equipo</th>' : '') +
          '<th class="num">Dorsal</th><th class="num">Edad</th><th>Avisos</th></tr></thead><tbody>' + ver.map(function (j) {
            var p = ix.jug[j.ID_JUGADORA] || {}, ie = ix.ie[j.ID_INSCRIPCION_EQUIPO] || {};
            return '<tr tabindex="0"' + (ijCuenta(j) ? '' : ' class="gs-err"') + ' data-ij="' + texto(j.ID) + '"><td class="gs-alta">' + alta(j.FECHA_INSCRIPCION) + '</td>' +
              '<td class="u-tabla-t">' + texto(nombreJug(p) || j.ID_JUGADORA) + '</td>' +
              (conEq ? '<td>' + punto(ie.ID_COLOR) + texto(nomIe(j.ID_INSCRIPCION_EQUIPO)) + (S.comp ? '' : ' <span class="gs-opc">· ' + texto(nomComp(ie.ID_COMPETICION)) + '</span>') + '</td>' : '') +
              '<td class="num">' + texto(txt(j.DORSAL)) + '</td><td class="num">' + texto(edad(p.FECHA_NACIMIENTO)) + '</td>' +
              '<td><div class="gs-tags">' + tagsJugadora(j).join('') + '</div></td></tr>';
          }).join('') + '</tbody></table>');
        else h += '<div class="gs-card"><div class="gs-lista">' + ver.map(function (j) { return itemJugadora(j, conEq, !!q); }).join('') + '</div></div>';
        if (xs.length > S.ju.n) h += '<p class="gs-ir"><button type="button" class="gs-chip" data-accion="vermas">Ver ' + Math.min(VER, xs.length - S.ju.n) + ' más</button></p>';
        // Al buscar, también las que no están inscritas esta temporada (de otros años), para abrir su ficha.
        if (q.length >= 3) {
          var ya = {}; xs.forEach(function (j) { ya[j.ID_JUGADORA] = 1; });
          var otras = buscarJugadoras(d.jug, S.ju.q, 30).filter(function (p) { return !ya[p.ID]; });
          if (otras.length) h += '<div class="gs-sec">Otras jugadoras</div><p class="gs-nota">Sin inscripción en ' + texto(tem.NOMBRE) + ': de otros años o sin equipo.</p>' +
            '<div class="gs-card"><div class="gs-lista">' + otras.map(function (p) {
              return '<button type="button" class="gs-item" data-jug="' + texto(p.ID) + '"><div class="gs-min"><div class="gs-t">' + texto(nombreJug(p)) + '</div>' +
                '<div class="gs-s">' + texto([p.ID, p.TELEFONO, p.EMAIL].filter(Boolean).join(' · ')) + '</div></div></button>';
            }).join('') + '</div></div>';
        }
        return h;
      }
      function itemJugadora(j, conEq, conAlta) {
        var p = ix.jug[j.ID_JUGADORA] || {}, ie = ix.ie[j.ID_INSCRIPCION_EQUIPO] || {}, t = tagsJugadora(j), e = edad(p.FECHA_NACIMIENTO);
        return '<button type="button" class="gs-item' + (ijCuenta(j) ? '' : ' gs-err') + '" data-ij="' + texto(j.ID) + '"><div class="gs-min">' +
          '<div class="gs-t">' + texto(nombreJug(p) || j.ID_JUGADORA) + '</div>' +
          '<div class="gs-s">' + (conEq ? punto(ie.ID_COLOR) : '') + texto([conEq ? nomIe(j.ID_INSCRIPCION_EQUIPO) : '', e !== '' ? e + ' años' : ''].filter(Boolean).join(' · ')) +
          (conAlta ? ' <span class="gs-alta">· ' + alta(j.FECHA_INSCRIPCION) + '</span>' : '') + '</div>' +
          (t.length ? '<div class="gs-tags">' + t.join('') + '</div>' : '') + '</div><div class="gs-d">' + (txt(j.DORSAL) ? texto(txt(j.DORSAL)) : '') + '</div></button>';
      }

      /* ---------- REVISIONES ---------- */

      function htmlRevisiones() {
        // Las filas «Aviso: …» son avisos dados por buenos, no casos dudosos: van aparte.
        var casos = d.rev.filter(function (r) { return !esAviso(r) && !esPospuesto(r); });
        var pend = casos.filter(function (r) { return r.RESUELTO !== true; }).length;
        var rs = casos.filter(function (r) { return S.rv.todas || r.RESUELTO !== true; }).sort(function (a, b) {
          if ((a.RESUELTO === true) !== (b.RESUELTO === true)) return a.RESUELTO === true ? 1 : -1;
          return String(b.FECHA) < String(a.FECHA) ? -1 : 1;
        });
        var h = '<div class="gs-filtrar">' + chips([['', 'Sin resolver', pend], ['todas', 'Todas', casos.length]], S.rv.todas ? 'todas' : '', 'rv') + '</div>' +
          '<p class="gs-cuenta">Dudas de la migración y de los formularios: cada tarjeta explica el caso y se decide ahí mismo.</p><div id="gs-lista">';
        h += rs.length ? '<div class="gs-tjs">' + rs.map(tarjetaRev).join('') + '</div>' : '<div class="gs-card"><div class="gs-vacio">No hay revisiones pendientes.</div></div>';
        // Avisos pospuestos (los activos; si un aviso se pospuso varias veces, la fecha más lejana).
        var hh = hoy(), regs = {};
        d.rev.forEach(function (r) { if (pospuestoActivo(r, hh)) regs[r.ID_REGISTRO] = 1; });
        var pps = []; Object.keys(regs).forEach(function (reg) { avisosPospuestos(d, reg, hh).forEach(function (x) { x.reg = reg; pps.push(x); }); });
        pps.sort(function (a, b) { return a.hasta < b.hasta ? -1 : 1; });
        h += '<div class="gs-sec" id="gs-pospuestos">Avisos pospuestos (' + pps.length + ')</div>' +
          '<p class="gs-nota">No salen en Alertas hasta la fecha; ese día vuelven a avisar solos.</p>' +
          (pps.length ? '<div class="gs-card"><div class="gs-resu gs-resu-p">' + pps.map(function (x) {
            var ie = ix.ie[x.reg], ij = !ie && T.fila(IJ, x.reg);
            var quien = ie ? punto(ie.ID_COLOR) + texto(nomIe(x.reg)) : ij ? texto(nombreJug(ix.jug[ij.ID_JUGADORA]) || ij.ID_JUGADORA) + ' <span class="gs-opc">· ' + texto(nomIe(ij.ID_INSCRIPCION_EQUIPO)) + '</span>' : texto(x.reg);
            return '<div class="gs-resu-i"><span><b>Hasta el ' + texto(fechaCorta(x.hasta)) + '</b> · ' + quien + '<br><span class="gs-opc">' + texto(x.motivo) + '</span></span>' +
              '<span class="gs-resu-b">' + (ie || ij ? '<button type="button" class="gs-enl" ' + (ie ? 'data-ie' : 'data-ij') + '="' + texto(x.reg) + '">Ver la ficha</button>' : '') +
              (x.fila._nueva ? '<span class="gs-opc">Guardando</span>' : '<button type="button" class="gs-enl" data-ya="' + texto(x.id) + '" data-reg="' + texto(x.reg) + '">Volver a avisar ya</button>') + '</span></div>';
          }).join('') + '</div></div>' : '<div class="gs-card"><div class="gs-vacio">Ningún aviso pospuesto.</div></div>');
        // Avisos dados por buenos: cada uno abre la ficha de su equipo o de su jugadora, donde se puede volver a avisar.
        var avs = d.rev.filter(function (r) { return esAviso(r) && r.RESUELTO === true; }).sort(function (a, b) { return String(b.FECHA) < String(a.FECHA) ? -1 : 1; });
        h += '<div class="gs-sec">Avisos dados por buenos (' + avs.length + ')</div>' +
          '<p class="gs-nota">Avisos que se quedan así a propósito: ya no avisan. Ábrelos para volver a avisar.</p>';
        if (!avs.length) return h + '<div class="gs-card"><div class="gs-vacio">Ningún aviso dado por bueno.</div></div></div>';
        var de = function (r) {
          var reg = String(r.ID_REGISTRO), ie = ix.ie[reg], ij = !ie && T.fila(IJ, reg);
          return { attr: ie ? 'data-ie="' + texto(reg) + '"' : 'data-ij="' + texto(reg) + '"',
            quien: ie ? punto(ie.ID_COLOR) + texto(nomIe(reg)) : ij ? texto(nombreJug(ix.jug[ij.ID_JUGADORA]) || ij.ID_JUGADORA) : texto(reg),
            sub: ie ? nomComp(ie.ID_COMPETICION) : ij ? nomIe(ij.ID_INSCRIPCION_EQUIPO) : '' };
        };
        if (ancho()) return h + caja('<table class="u-tabla gs-tabla"><thead><tr><th>Fecha</th><th>Equipo o jugadora</th><th>Aviso y por qué</th></tr></thead><tbody>' + avs.map(function (r) {
          var x = de(r);
          return '<tr tabindex="0" ' + x.attr + '><td class="gs-alta">' + fecha(r.FECHA) + '</td><td class="u-tabla-t">' + x.quien + (x.sub ? '<div class="gs-opc">' + texto(x.sub) + '</div>' : '') + '</td>' +
            '<td>' + texto(r.MOTIVO) + guardando(r) + '</td></tr>';
        }).join('') + '</tbody></table>') + '</div>';
        return h + '<div class="gs-card"><div class="gs-lista">' + avs.map(function (r) {
          var x = de(r);
          return '<button type="button" class="gs-item" ' + x.attr + '><div class="gs-min"><div class="gs-t">' + x.quien + '</div>' +
            '<div class="gs-s">' + texto([fecha(r.FECHA), x.sub, r.MOTIVO].filter(Boolean).join(' · ')) + '</div>' + guardando(r) + '</div></button>';
        }).join('') + '</div></div></div>';
      }

      /* ---------- ventanas (como las de la publicada: velo, hoja, ✕, Esc, pie fijo) ---------- */

      var alCerrar = null;
      function ventana(titulo, html, alAbrir) {
        cerrar();
        velo = document.createElement('div');
        velo.className = 'gs-velo';
        velo.innerHTML = '<div class="gs-hoja" role="dialog" aria-modal="true" aria-labelledby="gs-vt"><h2><span id="gs-vt">' + titulo + '</span>' +
          '<button type="button" class="gs-x" aria-label="Cerrar" data-cerrar>×</button></h2>' + html + '</div>';
        raiz.appendChild(velo);
        vent = velo.querySelector('.gs-hoja');
        document.documentElement.classList.add('gs-sin-scroll');
        velo.addEventListener('click', function (e) { if (e.target === velo) cerrar(); });
        if (alAbrir) alAbrir();
        var p = vent.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea');
        if (p && window.matchMedia && window.matchMedia('(hover: hover)').matches) p.focus();
      }
      function cerrar() {
        cerrarVisor();
        if (velo) { velo.remove(); velo = null; vent = null; }
        document.documentElement.classList.remove('gs-sin-scroll');
        if (alCerrar) { var f = alCerrar; alCerrar = null; f(); }
      }
      function tecla(e) { if (e.key !== 'Escape') return; if (visorEl) cerrarVisor(); else if (velo) cerrar(); }
      document.addEventListener('keydown', tecla);

      /** Un campo de ficha: c = { id, et, t: 'texto'|'select'|'si'|'area'|'fecha'|'tel'|'email'|'buscar', v, opts, vacio, nota, pre, ancho, cls, attrs }. */
      function campo(c) {
        var v = c.v == null ? '' : c.v, inp;
        if (c.t === 'si') return '<label class="gs-check' + (c.cls ? ' ' + c.cls : '') + '"><input type="checkbox" id="' + c.id + '"' + (v === true ? ' checked' : '') + (c.attrs || '') + '> ' + texto(c.et) + '</label>';
        if (c.t === 'select') {
          var os = (c.vacio !== undefined ? [['', c.vacio]] : []).concat(c.opts || []);
          // Un valor que no está en la lista se ve tal cual, avisado.
          if (String(v) !== '' && !os.some(function (o) { return String(o[0]) === String(v); })) os.splice(c.vacio !== undefined ? 1 : 0, 0, [v, v + ' (no está en la lista)']);
          inp = '<select id="' + c.id + '"' + (c.attrs || '') + '>' + opciones(os, v) + '</select>';
        } else if (c.t === 'area') inp = '<textarea id="' + c.id + '" rows="2"' + (c.attrs || '') + '>' + texto(v) + '</textarea>';
        else {
          if (c.t === 'fecha') v = String(v).slice(0, 10);
          inp = '<input type="' + ({ fecha: 'date', tel: 'tel', email: 'email', buscar: 'search' }[c.t] || 'text') + '" id="' + c.id + '" value="' + texto(v) + '"' + (c.attrs || '') + ' autocomplete="off">';
        }
        return '<label class="gs-campo' + (c.ancho ? ' gs-ancho' : '') + (c.cls ? ' ' + c.cls : '') + '" for="' + c.id + '">' + (c.pre || '') + texto(c.et) + inp +
          (c.nota ? '<div class="gs-nota">' + c.nota + '</div>' : '') + '</label>';
      }
      function val(id) { var e = vent && vent.querySelector('#' + id); return !e ? undefined : e.type === 'checkbox' ? e.checked : String(e.value).trim(); }
      function verError(mal) { var e = vent.querySelector('#gs-err'); e.textContent = mal.join(' '); e.hidden = !mal.length; }
      function pie(idOk, texto0) {
        return '<div class="gs-error" id="gs-err" role="alert" hidden></div><div class="gs-acc gs-pie"><button type="button" class="gs-b2" data-cerrar>' + (texto0 || 'Cerrar') + '</button>' +
          '<button type="button" class="gs-b1" id="' + idOk + '">Guardar</button></div>';
      }
      /** Lo que hay escrito en una ficha para un grupo { pre, ks }. */
      function valores(g) { var o = {}; g.ks.forEach(function (k) { o[k] = val(g.pre + k); }); if (g.ajustar) g.ajustar(o); return o; }
      /** «Guardar N cambios» (desactivado «Sin cambios» si no hay), contando los de todos los grupos de la ficha. */
      function guardable(idOk, grupos, guardar) {
        var ok = vent.querySelector('#' + idOk);
        function cuenta0() { return grupos.reduce(function (n, g) { return n + Object.keys(cambios(g.f, valores(g))).length; }, 0); }
        function mira() { var n = cuenta0(); ok.disabled = !n; ok.textContent = n ? 'Guardar ' + plural(n, 'cambio', 'cambios') : 'Sin cambios'; }
        vent.addEventListener('input', mira); vent.addEventListener('change', mira); mira();
        ok.onclick = function () {
          var cs = grupos.map(function (g) { return cambios(g.f, valores(g)); });
          if (!cs.some(function (c) { return Object.keys(c).length; })) return;
          var mal = guardar.validar ? guardar.validar(cs) : [];
          if (mal.length) { verError(mal); return; }
          verError([]); ok.disabled = true; ok.textContent = 'Guardando…';
          // Al momento: la pantalla cambia ya (con «Guardando» en la fila) y el Excel se escribe por detrás.
          cerrar();
          var ps = guardar.escribir(cs).filter(Boolean);
          Promise.all(ps).then(function () { if (ctx.abierta()) ctx.aviso('Guardado en el Excel.'); }, function () {});
        };
      }
      function ligasDe(idComp) {
        return d.lig.filter(function (l) { return String(l.ID_COMPETICION) === String(idComp); }).map(function (l) {
          var g = staff(l.ID_GESTOR);
          return [l.ID, [txt(l.NOMBRE), diaNorm(l.DIA_SEMANA), g ? txt(g.APODO || g.NOMBRE) : ''].filter(Boolean).join(' · ')];
        });
      }
      function gestores() {
        return d.stf.filter(function (s) { return s.ES_GESTOR === true && s.ACTIVO !== false; }).map(function (s) { return [s.ID, txt(s.APODO || s.NOMBRE)]; })
          .sort(function (a, b) { return a[1].localeCompare(b[1], 'es'); });
      }
      var NIVELES = ['1', '2', '3', '4', '5'].map(function (n) { return [n, n + (n === '1' ? ' (el más bajo)' : n === '5' ? ' (el más alto)' : '')]; });

      /** Ficha de la inscripción de un equipo: liga y organización, seguimiento, pagos, plantilla, el equipo y la inscripción. */
      function fichaEquipo(ie) {
        var e = ix.eqs[ie.ID_EQUIPO] || {}, pl = plantilla(d, ie.ID), av = avisosEquipo(d, ie, cx), p = PAGOS ? pago(d, ie) : null;
        var cap = ix.jug[ie.ID_CAPITANA], c = ix.com[ie.ID_COMPETICION] || {}, esTem = String(c.ID_TEMPORADA) === String(tem.ID);
        var otras = d.ie.filter(function (x) { return String(x.ID_EQUIPO) === String(ie.ID_EQUIPO) && x !== ie; })
          .sort(function (a, b) { return String(b.FECHA_INSCRIPCION) < String(a.FECHA_INSCRIPCION) ? -1 : 1; });
        var capis = pl.filter(function (j) { return j.ESTADO !== 'Baja'; }).map(function (j) { return [j.ID_JUGADORA, nombreJug(ix.jug[j.ID_JUGADORA]) || j.ID_JUGADORA]; });
        if (ie.ID_CAPITANA && !capis.some(function (x) { return x[0] === String(ie.ID_CAPITANA); })) capis.unshift([ie.ID_CAPITANA, (nombreJug(cap) || ie.ID_CAPITANA) + ' (no está en la plantilla)']);
        var cols = d.col.map(function (x) { return [x.ID, txt(x.NOMBRE || x.CODIGO || x.ID)]; });
        var t = [];
        if (ie.ESTADO === 'Baja') t.push(tag('Baja · no cuenta', 'gs-tag-r'));
        if (ie.ORIGEN === 'Clasificación') t.push(tag('Copa', 'gs-tag-g'));
        var lig = ix.lig[String(ie.ID_LIGA || '')], ges = lig ? staff(lig.ID_GESTOR) : null, apodo = ges ? txt(ges.APODO || ges.NOMBRE) : '';
        var nAct = activas(ie.ID).length, cargandoPl = !jugLeidas() && esTem;
        var html = '<p class="gs-nota gs-sub">' + texto([nomComp(ie.ID_COMPETICION), nom('lig', ie.ID_LIGA), ie.ID].filter(Boolean).join(' · ')) + '</p>' +
          (t.length ? '<div class="gs-tags gs-sub2">' + t.join('') + '</div>' : '') +
          '<div class="gs-btns">' + (cap ? aWa(cap.TELEFONO, 'Escribir a la capitana') : '') +
          (ges ? (wa(ges.TELEFONO) ? aWa(ges.TELEFONO, 'Escribir al gestor (' + apodo + ')') : '<span class="gs-sintel">Gestor ' + texto(apodo) + ': sin teléfono en STAFF</span>') : '') +
          (ie.ESTADO !== 'Baja' ? '<button type="button" class="gs-b2" id="gs-verjug" data-id="' + texto(ie.ID) + '">Ver jugadoras</button>' : '') + '</div>' +
          bloqueAvisos(av, ie.ID) +
          '<div class="gs-sec">Liga y organización</div><div class="gs-dos">' +
          campo({ id: 'e-ID_LIGA', t: 'select', et: 'Liga', v: ie.ID_LIGA, opts: ligasDe(ie.ID_COMPETICION), vacio: '— Sin liga —' }) +
          campo({ id: 'e-NIVEL', t: 'select', et: 'Nivel', v: ie.NIVEL == null ? '' : String(ie.NIVEL), opts: NIVELES, vacio: '—' }) +
          campo({ id: 'e-ID_RESPONSABLE', t: 'select', et: 'Responsable (cobra la señal)', v: ie.ID_RESPONSABLE, opts: gestores(), vacio: '—' }) +
          campo({ id: 'e-ID_COLOR', t: 'select', et: 'Color de camiseta', v: ie.ID_COLOR, opts: cols, vacio: '—', pre: '<i class="gs-color" id="gs-colpre" style="background:' + texto(hexDe(ie.ID_COLOR) || 'transparent') + '"></i>' }) +
          campo({ id: 'e-NOMBRE_EQUIPO', t: 'texto', et: 'Nombre este año', v: ie.NOMBRE_EQUIPO, attrs: ' maxlength="80"' }) +
          campo({ id: 'e-ESTADO', t: 'select', et: 'Estado', v: ie.ESTADO, opts: [['Solicitada', 'Solicitada (sin confirmar)'], ['Confirmada', 'Confirmada'], ['Baja', 'Baja (no cuenta)']] }) +
          '</div>' +
          '<div class="gs-sec">Seguimiento</div><div class="gs-checks">' +
          campo({ id: 'e-MENSAJE_INICIAL_ENVIADO', t: 'si', et: 'Mensaje inicial enviado (M.I)', v: ie.MENSAJE_INICIAL_ENVIADO }) +
          campo({ id: 'e-GRUPO_CREADO', t: 'si', et: 'Grupo de WhatsApp creado (Gr C/TS)', v: ie.GRUPO_CREADO }) +
          campo({ id: 'e-EN_XPORTY', t: 'si', et: 'Dado de alta en Xporty', v: ie.EN_XPORTY }) + '</div>' +
          campo({ id: 'e-NOTAS', t: 'area', et: 'Notas internas', v: ie.NOTAS });
        if (p && p.baja && !p.incluida) {
          html += '<div class="gs-sec">Pagos</div><div class="gs-dl">' +
            fila('Cobrado', eurC(p.cobrado) + (p.cobros ? ' (' + plural(p.cobros, 'movimiento', 'movimientos') + ')' : '')) +
            fila('Señal', p.senal > 0 ? '<b>' + eurC(p.senal) + ' · se queda</b>' : p.cobros ? '<span class="gs-opc">Devuelta</span>' : '<span class="gs-opc">No pagó nada</span>') + '</div>' +
            '<p class="gs-nota">Equipo de baja: no debe nada y lo que pagó se queda como ingreso (no se devuelve)' +
            (SENAL && p.senal > 0 ? ', en Economía en la categoría «' + texto(SENAL) + '»' : '') +
            '. Si se le devuelve, se apunta en Economía como gasto con la referencia «Inscripción» · ' + texto(ie.ID) + '.</p>';
        } else if (p) {
          html += '<div class="gs-sec">Pagos</div>' + (p.incluida ? '<p class="gs-nota">Incluida en otra inscripción: no se cobra.</p>' : '<div class="gs-dl">' +
            fila('Precio', p.sinTarifa ? '<span class="gs-amb">Sin tarifa en TARIFAS para esta competición</span>' : eurC(p.precio)) +
            (p.descuento ? fila('Descuento', eurC(p.descuento)) : '') +
            fila('Cobrado', eurC(p.cobrado) + (p.cobros ? ' (' + plural(p.cobros, 'movimiento', 'movimientos') + ')' : '')) +
            (p.sinTarifa ? '' : fila('Pendiente', p.falta > 0 ? '<b class="gs-neg">Faltan ' + eurC(p.falta) + '</b>' : p.falta < 0 ? '<b class="gs-pos">Ha pagado ' + eurC(-p.falta) + ' de más</b>' : '<span class="gs-pos">Al día</span>')) + '</div>' +
            '<p class="gs-nota">Los cobros se apuntan en Economía con la referencia «Inscripción» · ' + texto(ie.ID) + '.</p>');
        }
        html += '<div class="gs-sec">Plantilla (' + (cargandoPl ? '…' : nAct) + ')</div>' +
          campo({ id: 'e-ID_CAPITANA', t: 'select', et: 'Capitana', v: ie.ID_CAPITANA, opts: capis, vacio: capis.length ? '— Sin capitana —' : 'Todavía no tiene jugadoras' }) +
          (cargandoPl ? '<p class="gs-nota">Cargando las jugadoras…</p>' : '') +
          (pl.length ? '<div class="gs-lista gs-plantilla">' + pl.map(function (j) {
            var q = ix.jug[j.ID_JUGADORA] || {}, baja = j.ESTADO === 'Baja' || ie.ESTADO === 'Baja';
            return '<button type="button" class="gs-item' + (baja ? ' gs-err' : '') + '" data-ij="' + texto(j.ID) + '"><div class="gs-min"><div class="gs-t">' + texto(nombreJug(q) || j.ID_JUGADORA) + '</div>' +
              '<div class="gs-tags">' + (String(j.ID_JUGADORA) === String(ie.ID_CAPITANA) ? tag('Capitana', 'gs-tag-v') : '') + (baja ? tag('Baja', 'gs-tag-err') : '') + guardando(j) + '</div></div>' +
              '<div class="gs-d">' + (txt(j.DORSAL) ? texto(txt(j.DORSAL)) : '<span class="gs-opc">Sin dorsal</span>') + '</div></button>';
          }).join('') + '</div>' : (cargandoPl ? '' : '<p class="gs-nota">Sin jugadoras inscritas.</p>')) +
''; 
        html += '<div class="gs-sec">El equipo</div>' + (e.ID ? '<div class="gs-dos">' +
          campo({ id: 'q-NOMBRE', t: 'texto', et: 'Nombre (todos los años)', v: e.NOMBRE, attrs: ' maxlength="80"' }) +
          campo({ id: 'q-TIPO', t: 'select', et: 'Tipo', v: e.TIPO, opts: [['Liga', 'Liga'], ['Kopa di Mondo', 'Kopa di Mondo']] }) + '</div>' +
          campo({ id: 'q-NOTAS', t: 'area', et: 'Notas del equipo', v: e.NOTAS }) +
          '<div class="gs-dl">' + fila('Alta', texto(fecha(e.FECHA_ALTA))) + fila('ID', texto(e.ID)) + '</div>' : '<p class="gs-nota">No encuentro el equipo ' + texto(ie.ID_EQUIPO) + ' en EQUIPOS.</p>');
        if (otras.length) html += '<p class="gs-nota">Otras temporadas:</p><div class="gs-lista">' + otras.map(function (x) {
          var cc = ix.com[x.ID_COMPETICION] || {};
          return '<button type="button" class="gs-item' + (x.ESTADO === 'Baja' ? ' gs-err' : '') + '" data-ie="' + texto(x.ID) + '"><div class="gs-min"><div class="gs-t">' + punto(x.ID_COLOR) + texto(x.NOMBRE_EQUIPO || x.ID) + '</div>' +
            '<div class="gs-s">' + texto([nom('tem', cc.ID_TEMPORADA) || cc.ID_TEMPORADA, nomComp(x.ID_COMPETICION), nom('lig', x.ID_LIGA), x.ESTADO].filter(Boolean).join(' · ')) + '</div></div></button>';
        }).join('') + '</div>';
        html += '<div class="gs-sec">Inscripción</div><div class="gs-dl">' + fila('Fecha', texto(fecha(ie.FECHA_INSCRIPCION))) + fila('Origen', texto(ie.ORIGEN)) +
          (ie.ID_INSCRIPCION_ORIGEN ? fila('Viene de', texto(nomIe(ie.ID_INSCRIPCION_ORIGEN)) + ' (' + texto(ie.ID_INSCRIPCION_ORIGEN) + ')') : '') +
          fila('Capitana', texto(nombreJug(cap))) + fila('Teléfono', texto(cap && cap.TELEFONO)) + fila('Correo', texto(cap && cap.EMAIL)) +
          fila('Experiencia', texto(ie.EXPERIENCIA)) + fila('Disponibilidad', texto(ie.DISPONIBILIDAD)) + fila('Horario preferido', texto(ie.PREFERENCIA_HORARIA)) +
          (jugLeidas() || !esTem ? fila('Edad media', edad1(edadMedia(ie.ID)) ? texto(edad1(edadMedia(ie.ID)) + ' años') : '') : '') + '</div>' +
          (txt(ie.COMENTARIOS) ? '<div class="gs-dtx"><b>Comentarios</b><p>' + texto(ie.COMENTARIOS) + '</p></div>' : '') +
          pie('e-guardar');
        var gIe = { f: ie, pre: 'e-', ks: ['ID_LIGA', 'NIVEL', 'ID_RESPONSABLE', 'ID_COLOR', 'NOMBRE_EQUIPO', 'ESTADO', 'MENSAJE_INICIAL_ENVIADO', 'GRUPO_CREADO', 'EN_XPORTY', 'NOTAS', 'ID_CAPITANA'] };
        var gEq = { f: e, pre: 'q-', ks: e.ID ? ['NOMBRE', 'TIPO', 'NOTAS'] : [] };
        ventana(punto(ie.ID_COLOR) + texto(nomIe(ie.ID)), html, function () {
          var sc = vent.querySelector('#e-ID_COLOR'), pre = vent.querySelector('#gs-colpre');
          sc.addEventListener('change', function () { pre.style.background = hexDe(sc.value) || 'transparent'; });
          guardable('e-guardar', [gIe, gEq], {
            validar: function (cs) {
              var mal = [];
              if ('NOMBRE_EQUIPO' in cs[0] && !cs[0].NOMBRE_EQUIPO) mal.push('Falta el nombre de este año.');
              if ('NOMBRE' in cs[1] && !cs[1].NOMBRE) mal.push('Falta el nombre del equipo.');
              return mal;
            },
            escribir: function (cs) {
              return [Object.keys(cs[0]).length ? escribirIe(ie, cs[0]) : null,
                Object.keys(cs[1]).length ? T.actualizar('EQUIPOS', e.ID, cs[1]) : null];
            }
          });
        });
      }

      /** Ficha de una jugadora: su inscripción (si se abre desde una), sus datos personales, más datos, fotos y sus temporadas. */
      function fichaJugadora(idJug, ij) {
        var p = ix.jug[String(idJug)];
        if (!p) { ctx.aviso('No tengo la jugadora ' + idJug + ': pulsa ↻.'); return; }
        // Todas sus inscripciones: la parte de esta jugadora (al momento si ya se vio; si no, llega y se vuelve a pintar).
        var o = {}; o[IJ] = { clave: 'J:' + p.ID, col: 'ID_JUGADORA', valores: [p.ID] };
        var pintada = false;
        T.leer([IJ], { partes: o }).then(function () { if (pintada && vent && vent.getAttribute('data-jug') === String(p.ID)) historial(); }, function () {});
        var ie = ij ? ix.ie[ij.ID_INSCRIPCION_EQUIPO] || {} : null, av = ij ? avisosJugadora(d, ij, cx) : [], e = edad(p.FECHA_NACIMIENTO);
        var t = [];
        if (ij && !ijCuenta(ij)) t.push(tag('Baja: esta inscripción no cuenta', 'gs-tag-r'));
        var html = '<p class="gs-nota gs-sub">' + texto([ij ? nomIe(ij.ID_INSCRIPCION_EQUIPO) : '', ij ? nomComp(ie.ID_COMPETICION) : '', p.ID, e !== '' ? e + ' años' : ''].filter(Boolean).join(' · ')) + '</p>' +
          (t.length ? '<div class="gs-tags gs-sub2">' + t.join('') + '</div>' : '') +
          '<div class="gs-btns">' + aWa(p.TELEFONO, 'WhatsApp') +
          (ie && ie.ID ? '<button type="button" class="gs-b2" data-ie="' + texto(ie.ID) + '">Ver el equipo</button>' : '') + '</div>' +
          (ij ? bloqueAvisos(av, ij.ID) : '');
        if (ij) {
          html += '<div class="gs-sec">Inscripción · ' + punto(ie.ID_COLOR) + texto(nomIe(ij.ID_INSCRIPCION_EQUIPO)) + '</div><div class="gs-dos">' +
            campo({ id: 'i-DORSAL', t: 'texto', et: 'Dorsal', v: ij.DORSAL, attrs: ' maxlength="3" inputmode="numeric"' }) +
            campo({ id: 'i-ESTADO', t: 'select', et: 'Estado', v: ij.ESTADO, opts: [['Activa', 'Activa'], ['Baja', 'Baja (no cuenta)']] }) + '</div>' +
            '<p class="gs-nota">Para cambiarla de equipo, dale de baja aquí; la inscripción en el otro equipo se hace fuera de Gestión.</p>' +
            '<div class="gs-checks">' + campo({ id: 'i-EN_XPORTY', t: 'si', et: 'Dada de alta en Xporty', v: ij.EN_XPORTY }) +
            campo({ id: 'i-EN_CONTACTOS_GOOGLE', t: 'si', et: 'Guardada en Contactos de Google', v: ij.EN_CONTACTOS_GOOGLE }) + '</div>';
        }
        html += '<div class="gs-sec">Datos personales</div><div class="gs-dos">' +
          campo({ id: 'p-NOMBRE', t: 'texto', et: 'Nombre', v: p.NOMBRE, attrs: ' maxlength="60"' }) +
          campo({ id: 'p-APELLIDO_1', t: 'texto', et: 'Primer apellido', v: p.APELLIDO_1, attrs: ' maxlength="60"' }) +
          campo({ id: 'p-APELLIDO_2', t: 'texto', et: 'Segundo apellido', v: p.APELLIDO_2, attrs: ' maxlength="60"' }) +
          campo({ id: 'p-FECHA_NACIMIENTO', t: 'fecha', et: 'Fecha de nacimiento', v: p.FECHA_NACIMIENTO }) +
          campo({ id: 'p-TELEFONO', t: 'tel', et: 'Teléfono', v: p.TELEFONO, attrs: ' maxlength="20"' }) +
          campo({ id: 'p-EMAIL', t: 'email', et: 'Correo', v: p.EMAIL, attrs: ' maxlength="100"' }) +
          campo({ id: 'p-TIPO_DOCUMENTO', t: 'select', et: 'Documento', v: p.TIPO_DOCUMENTO, opts: [['DNI', 'DNI'], ['NIE', 'NIE'], ['Pasaporte', 'Pasaporte'], ['Otro', 'Otro']], vacio: '—' }) +
          campo({ id: 'p-NUM_DOCUMENTO', t: 'texto', et: 'Número', v: p.NUM_DOCUMENTO, attrs: ' maxlength="20"' }) +
          campo({ id: 'p-INSTAGRAM', t: 'texto', et: 'Instagram', v: p.INSTAGRAM, attrs: ' maxlength="40" placeholder="usuario, sin @"' }) + '</div>' +
          campo({ id: 'p-NOTAS', t: 'area', et: 'Notas', v: p.NOTAS }) +
          '<p class="gs-nota">Datos personales: solo para gestionar la liga.</p>' +
          '<div class="gs-sec">Más datos</div><div class="gs-dl">' + fila('Alta', texto(fecha(p.FECHA_ALTA))) + fila('Edad', e !== '' ? texto(e + ' años') : '') +
          (ij ? fila('Inscrita', texto(fecha(ij.FECHA_INSCRIPCION))) + fila('Origen', texto(ij.ORIGEN)) +
            fila('Acepta', texto(Object.keys(ACEPTA).map(function (k) { return ACEPTA[k] + (ij[k] === true ? ' sí' : ' no'); }).join(' · '))) +
            fila('Cómo nos conoció', texto(ij.COMO_NOS_CONOCIO)) : '') + '</div>';
        html += '<div id="gs-fotosj">' + bloqueFotos(p.ID) + '</div>';
        html += '<div class="gs-sec">Sus temporadas</div><div id="gs-hist"></div>' + pie('i-guardar');
        function historial() {
          var h = vent && vent.querySelector('#gs-hist'); if (!h) return;
          var xs = ijsValidas(T.filas(IJ)).filter(function (x) { return String(x.ID_JUGADORA) === String(p.ID); }).map(function (x) {
            var ee = ix.ie[x.ID_INSCRIPCION_EQUIPO] || T.fila('INSCRIPCIONES_EQUIPOS', x.ID_INSCRIPCION_EQUIPO) || {}, cc = ix.com[ee.ID_COMPETICION] || {};
            return { x: x, e: ee, c: cc, t: ix.tem[cc.ID_TEMPORADA] || {} };
          }).sort(function (a, b) { return String(b.x.FECHA_INSCRIPCION) < String(a.x.FECHA_INSCRIPCION) ? -1 : 1; });
          var tiene = T.tiene ? T.tiene(IJ, o[IJ]) : true;
          h.innerHTML = xs.length ? '<div class="gs-lista">' + xs.map(function (y) {
            var baja = y.x.ESTADO === 'Baja' || y.e.ESTADO === 'Baja';
            return '<button type="button" class="gs-item' + (baja ? ' gs-err' : '') + '" data-ij="' + texto(y.x.ID) + '"><div class="gs-min"><div class="gs-t">' + punto(y.e.ID_COLOR) + texto(y.e.NOMBRE_EQUIPO || y.x.ID_INSCRIPCION_EQUIPO) + '</div>' +
              '<div class="gs-s">' + texto([y.t.NOMBRE, txt(y.c.NOMBRE_COMERCIAL || y.c.NOMBRE), baja ? 'Baja' : ''].filter(Boolean).join(' · ')) + '</div></div>' +
              '<div class="gs-d">' + texto(txt(y.x.DORSAL)) + '</div></button>';
          }).join('') + '</div>' + (tiene ? '' : '<p class="gs-nota">Cargando el resto…</p>') : '<p class="gs-nota">' + (tiene ? 'Sin inscripciones.' : 'Cargando…') + '</p>';
        }
        var grupos = [{ f: ij || {}, pre: 'i-', ks: ij ? ['DORSAL', 'ESTADO', 'EN_XPORTY', 'EN_CONTACTOS_GOOGLE'] : [] },
          { f: p, pre: 'p-', ks: ['NOMBRE', 'APELLIDO_1', 'APELLIDO_2', 'FECHA_NACIMIENTO', 'TELEFONO', 'EMAIL', 'TIPO_DOCUMENTO', 'NUM_DOCUMENTO', 'INSTAGRAM', 'NOTAS'],
            ajustar: function (v) { if (v.NUM_DOCUMENTO !== undefined) v.NUM_DOCUMENTO = v.NUM_DOCUMENTO.toUpperCase().replace(/[\s-]/g, ''); } }];
        ventana(texto(nombreJug(p)), html, function () {
          vent.setAttribute('data-jug', String(p.ID));
          pintarFotos(vent);
          pintada = true;
          historial();
          guardable('i-guardar', grupos, {
            validar: function (cs) {
              var mal = [];
              if (ij && ('DORSAL' in cs[0] || 'ESTADO' in cs[0])) {
                var dor = val('i-DORSAL'), est = val('i-ESTADO');
                if (dor && !/^\d{1,3}$/.test(dor)) mal.push('El dorsal es un número.');
                var otra = dor && est !== 'Baja' && d.ij.filter(function (x) { return x !== ij && String(x.ID_INSCRIPCION_EQUIPO) === String(ij.ID_INSCRIPCION_EQUIPO) && x.ESTADO !== 'Baja' && txt(x.DORSAL) === dor; })[0];
                if (otra) mal.push('El ' + dor + ' ya lo lleva ' + (nombreJug(ix.jug[otra.ID_JUGADORA]) || otra.ID_JUGADORA) + ' en este equipo.');
              }
              if (Object.keys(cs[1]).length) mal = mal.concat(problemasJugadora(valores(grupos[1]), d.jug, p.ID));
              return mal;
            },
            escribir: function (cs) {
              var ci = cs[0], ps = [];
              // El dorsal va por su función, que mira dentro del motor que nadie lo lleve ya; lo demás, directo.
              if (ij && 'DORSAL' in ci) { ps.push(T.actualizar(IJ, ij.ID, { DORSAL: ci.DORSAL }, { fn: 'gestion5Dorsal', args: [ij.ID, ci.DORSAL] })); delete ci.DORSAL; }
              if (ij && Object.keys(ci).length) ps.push(T.actualizar(IJ, ij.ID, ci));
              if (Object.keys(cs[1]).length) ps.push(T.actualizar('JUGADORAS', p.ID, cs[1]));
              return ps;
            }
          });
        });
      }

      /* ---------- fotos: miniaturas, visor, las de una jugadora y el asignador de las sin vincular ---------- */

      /** La inscripción de jugadora de una foto (por su jugadora y su inscripción de equipo), o null. */
      function ijDeFoto(f) {
        if (!f.ID_JUGADORA) return null;
        var suyas = ijsValidas(T.filas(IJ)).filter(function (x) { return String(x.ID_JUGADORA) === String(f.ID_JUGADORA); });
        if (f.ID_INSCRIPCION_EQUIPO) return suyas.filter(function (x) { return String(x.ID_INSCRIPCION_EQUIPO) === String(f.ID_INSCRIPCION_EQUIPO); })[0] || null;
        // Las migradas tienen jugadora y no equipo: su inscripción de la temporada de la foto, si solo hay una.
        var deTem = indice(iesDe(d, String(f.ID_TEMPORADA || tem.ID)));
        suyas = suyas.filter(function (x) { return deTem[x.ID_INSCRIPCION_EQUIPO]; });
        return suyas.length === 1 ? suyas[0] : null;
      }
      /** «Se puede publicar: Sí/No (según su inscripción en <equipo>)», de ACEPTA_DERECHOS_IMAGEN de esa inscripción. */
      function textoPublicar(x) {
        if (!x) return '<span class="gs-opc">Se puede publicar: no se sabe (no encuentro su inscripción)</span>';
        var si = x.ACEPTA_DERECHOS_IMAGEN === true;
        return 'Se puede publicar: <b class="' + (si ? 'gs-pos' : 'gs-neg') + '">' + (si ? 'Sí' : 'No') + '</b> <span class="gs-opc">(según su inscripción en ' + texto(nomIe(x.ID_INSCRIPCION_EQUIPO)) + ')</span>';
      }
      function fotosDe(idJug) { return d.fot.filter(function (f) { return String(f.ID_JUGADORA) === String(idJug) && f.ESTADO !== 'Sin vincular'; }); }

      /** Miniaturas: gestion5Archivo(url, tam), de pocas en pocas y guardadas en memoria por URL y tamaño. */
      var MINIS = {}, cola = [], enCurso = 0;
      function archivo(url, tam) {
        var k = url + '|' + (tam || '');
        if (!MINIS[k]) MINIS[k] = new Promise(function (ok, ko) { cola.push({ url: url, tam: tam, ok: ok, ko: ko }); siguiente(); });
        MINIS[k].catch(function () { delete MINIS[k]; });
        return MINIS[k];
      }
      function siguiente() {
        while (enCurso < 3 && cola.length) {
          var x = cola.shift(); enCurso++;
          ctx.llamar('gestion5Archivo', x.tam ? [x.url, x.tam] : [x.url]).then(x.ok, x.ko).then(fin, fin);
        }
        function fin() { enCurso--; siguiente(); }
      }
      /** Un hueco para una foto (se llena con pintarFotos): data-url y data-tam. */
      function hueco(f, tam, clase) {
        return '<span class="gs-foto ' + (clase || '') + '" data-mini="' + texto(f.ARCHIVO_URL || '') + '" data-tam="' + (tam || '') + '"><span class="u-carga"></span></span>';
      }
      /** Llena los huecos de fotos que haya dentro de un elemento. */
      function pintarFotos(cont) {
        [].forEach.call(cont.querySelectorAll('[data-mini]'), function (h) {
          var url = h.getAttribute('data-mini'), tam = Number(h.getAttribute('data-tam')) || 0;
          h.removeAttribute('data-mini');
          var drive = function () { h.innerHTML = url ? '<a class="gs-enl" href="' + texto(url) + '" target="_blank" rel="noopener">Ábrela en Drive</a>' : '<span class="gs-opc">Sin archivo</span>'; h.classList.add('gs-foto-no'); };
          if (!url) { drive(); return; }
          archivo(url, tam).then(function (r) { if (r && r.img) h.innerHTML = '<img src="' + texto(r.img) + '" alt="">'; else drive(); }, drive);
        });
      }
      /** La foto grande, encima de lo que haya abierto (Esc o «Cerrar» vuelve). */
      var visorEl = null;
      function verFoto(f) {
        cerrarVisor();
        visorEl = document.createElement('div');
        visorEl.className = 'gs-velo gs-velo-foto';
        visorEl.innerHTML = '<div class="gs-hoja gs-hoja-foto" role="dialog" aria-modal="true" aria-label="Foto"><div class="gs-grande">' + hueco(f, 0, 'gs-foto-g') + '</div>' +
          '<div class="gs-acc">' + (f.ARCHIVO_URL ? '<a class="gs-b2" href="' + texto(f.ARCHIVO_URL) + '" target="_blank" rel="noopener">Abrir en Drive ↗</a>' : '') +
          '<button type="button" class="gs-b2" data-cerrar-foto>Cerrar</button></div></div>';
        raiz.appendChild(visorEl);
        visorEl.addEventListener('click', function (e) { if (e.target === visorEl || e.target.closest('[data-cerrar-foto]')) cerrarVisor(); });
        pintarFotos(visorEl);
      }
      function cerrarVisor() { if (visorEl) { visorEl.remove(); visorEl = null; } }
      function desvincular(f) {
        return T.actualizar('FOTOS', f.ID, { ID_JUGADORA: '', ID_INSCRIPCION_EQUIPO: '', ESTADO: 'Sin vincular', PUBLICABLE: false });
      }
      function vincular(f, x) {
        return T.actualizar('FOTOS', f.ID, { ID_JUGADORA: String(x.ID_JUGADORA), ID_INSCRIPCION_EQUIPO: String(x.ID_INSCRIPCION_EQUIPO), ESTADO: 'Vinculada', PUBLICABLE: x.ACEPTA_DERECHOS_IMAGEN === true });
      }
      /** El bloque «Fotos (n)» de la ficha de una jugadora: miniaturas que se ven grandes al tocarlas y «No es ella». */
      function bloqueFotos(idJug) {
        var fs = fotosDe(idJug);
        if (!fs.length) return '<div class="gs-sec">Fotos (0)</div><p class="gs-nota">Sin fotos todavía. Las sin vincular se asignan desde Resumen › Alertas › Fotos sin vincular.</p>';
        return '<div class="gs-sec">Fotos (' + fs.length + ')</div><div class="gs-fotos">' + fs.map(function (f) {
          return '<figure class="gs-fig" data-fig="' + texto(f.ID) + '"><button type="button" class="gs-fbtn-ver" data-ver-foto="' + texto(f.ID) + '" aria-label="Ver la foto grande">' + hueco(f, 240) + '</button>' +
            '<figcaption><span class="gs-opc">' + texto(fecha(f.FECHA)) + '</span><span class="gs-pubf">' + textoPublicar(ijDeFoto(f)) + '</span>' +
            '<button type="button" class="gs-enl" data-noella="' + texto(f.ID) + '">No es ella</button></figcaption></figure>';
        }).join('') + '</div>';
      }

      /**
       * Asignador: recorre una a una las fotos Sin vincular de la temporada; se dice quién sale buscando por equipo, color o
       * nombre (se combinan) entre las inscripciones activas, con sus fotos al lado para comparar. Al elegir, pasa a la siguiente.
       */
      var A = null;
      function sinVincular() { return d.fot.filter(function (f) { return String(f.ID_TEMPORADA) === String(tem.ID) && f.ESTADO === 'Sin vincular' && !f._nueva; }); }
      function asignador() {
        var ids = sinVincular().map(function (f) { return String(f.ID); });
        A = { ids: ids, i: 0, eq: A ? A.eq : '', col: A ? A.col : '', q: '', n: 10 };
        var eqs = ies.filter(inscrito).sort(function (a, b) { return nomIe(a.ID).localeCompare(nomIe(b.ID), 'es'); });
        var cols = {}; eqs.forEach(function (i) { if (i.ID_COLOR) cols[i.ID_COLOR] = 1; });
        var html = '<p class="gs-nota gs-sub">¿Quién sale en la foto? Busca por equipo, color o nombre y elige a la jugadora.</p>' +
          '<div id="as-foto"></div>' +
          '<div class="gs-sec">Quién es</div><div class="gs-dos">' +
          campo({ id: 'as-eq', t: 'select', et: 'Equipo', v: A.eq, opts: eqs.map(function (i) { return [i.ID, nomIe(i.ID) + (i.ID_COLOR ? ' · ' + nom('col', i.ID_COLOR) : '')]; }), vacio: 'Todos los equipos' }) +
          campo({ id: 'as-q', t: 'buscar', et: 'Nombre o dorsal', attrs: ' placeholder="Nombre, apellido o dorsal"' }) + '</div>' +
          '<div class="gs-campo">Color de la camiseta</div><div class="gs-chips gs-cols">' +
          '<button type="button" class="gs-chip" data-as-col="" aria-pressed="' + !A.col + '">Todos</button>' +
          Object.keys(cols).map(function (c) { return '<button type="button" class="gs-chip" data-as-col="' + texto(c) + '" aria-pressed="' + (A.col === c) + '">' + punto(c) + texto(nom('col', c)) + '</button>'; }).join('') + '</div>' +
          '<div id="as-res"></div><div class="gs-acc gs-pie"><button type="button" class="gs-b2" data-cerrar>Cerrar</button></div>';
        ventana('Fotos sin vincular', html, function () {
          vent.classList.add('gs-hoja-ancha');
          pintarAsFoto(); pintarAsRes();
          vent.querySelector('#as-eq').addEventListener('change', function () { A.eq = this.value; A.n = 10; pintarAsRes(); });
          var tq0 = 0;
          vent.querySelector('#as-q').addEventListener('input', function () { var v = this.value; clearTimeout(tq0); tq0 = setTimeout(function () { A.q = v; A.n = 10; pintarAsRes(); }, 150); });
          vent.addEventListener('click', function (e) {
            var b = e.target.closest('[data-as-col], [data-as-ir], [data-as-ij], [data-as-mas]'); if (!b || !A) return;
            if (b.hasAttribute('data-as-col')) {
              A.col = b.getAttribute('data-as-col'); A.n = 10;
              [].forEach.call(vent.querySelectorAll('[data-as-col]'), function (x) { x.setAttribute('aria-pressed', x === b); });
              pintarAsRes();
            } else if (b.hasAttribute('data-as-ir')) { A.i = Math.max(0, Math.min(A.ids.length - 1, A.i + Number(b.getAttribute('data-as-ir')))); pintarAsFoto(); }
            else if (b.hasAttribute('data-as-mas')) { A.n += 10; pintarAsRes(); }
            else elegir(b.getAttribute('data-as-ij'));
          });
        });
        vent.querySelector('#as-q').blur();
      }
      function fotoActual() { return A && A.ids.length ? T.fila('FOTOS', A.ids[A.i]) : null; }
      function pintarAsFoto() {
        var c = vent && vent.querySelector('#as-foto'); if (!c) return;
        var f = fotoActual();
        if (!f) { c.innerHTML = '<div class="gs-card gs-vacio">Ya no quedan fotos sin vincular.</div>'; var r = vent.querySelector('#as-res'); if (r) r.innerHTML = ''; return; }
        c.innerHTML = '<div class="gs-as-cab"><b>Foto ' + (A.i + 1) + ' de ' + A.ids.length + '</b><span class="gs-opc">' + texto([f.NOMBRE_ORIGINAL, fecha(f.FECHA)].filter(Boolean).join(' · ')) + '</span></div>' +
          '<div class="gs-grande">' + hueco(f, 0, 'gs-foto-g') + '</div>' +
          '<div class="gs-btns gs-as-nav"><button type="button" class="gs-b2" data-as-ir="-1"' + (A.i ? '' : ' disabled') + '>‹ Anterior</button>' +
          '<button type="button" class="gs-b2" data-as-ir="1"' + (A.i < A.ids.length - 1 ? '' : ' disabled') + '>Saltar ›</button>' +
          (f.ARCHIVO_URL ? '<a class="gs-b2" href="' + texto(f.ARCHIVO_URL) + '" target="_blank" rel="noopener">Abrir en Drive ↗</a>' : '') + '</div>';
        pintarFotos(c);
      }
      function pintarAsRes() {
        var c = vent && vent.querySelector('#as-res'); if (!c) return;
        if (!fotoActual()) { c.innerHTML = ''; return; }
        if (!jugLeidas()) { c.innerHTML = cargandoJug(); return; }
        var ps = norm(A.q).split(/\s+/).filter(Boolean);
        var xs = d.ij.filter(function (j) {
          var ie = ix.ie[j.ID_INSCRIPCION_EQUIPO];
          if (!ie || String(ix.com[ie.ID_COMPETICION] && ix.com[ie.ID_COMPETICION].ID_TEMPORADA) !== String(tem.ID) || !ijCuenta(j)) return false;
          if (A.eq && String(j.ID_INSCRIPCION_EQUIPO) !== A.eq) return false;
          if (A.col && String(ie.ID_COLOR) !== A.col) return false;
          if (ps.length) { var t = norm(nombreJug(ix.jug[j.ID_JUGADORA]) + ' ' + txt(j.DORSAL) + ' dorsal ' + txt(j.DORSAL)); if (!ps.every(function (w) { return t.indexOf(w) >= 0; })) return false; }
          return true;
        }).sort(function (a, b) { return nomIe(a.ID_INSCRIPCION_EQUIPO).localeCompare(nomIe(b.ID_INSCRIPCION_EQUIPO), 'es') || (parseInt(a.DORSAL, 10) || 999) - (parseInt(b.DORSAL, 10) || 999); });
        var ver = xs.slice(0, A.n);
        c.innerHTML = '<p class="gs-cuenta">' + plural(xs.length, 'jugadora', 'jugadoras') + (A.eq || A.col || ps.length ? ' con estos filtros' : ' en ' + texto(tem.NOMBRE)) + '</p>' +
          (xs.length ? '<div class="gs-lista gs-elegir">' + ver.map(function (j) {
            var ie = ix.ie[j.ID_INSCRIPCION_EQUIPO] || {}, fs = fotosDe(j.ID_JUGADORA);
            return '<button type="button" class="gs-item gs-as-j" data-as-ij="' + texto(j.ID) + '"><div class="gs-min"><div class="gs-t">' + texto(nombreJug(ix.jug[j.ID_JUGADORA]) || j.ID_JUGADORA) + '</div>' +
              '<div class="gs-s">' + punto(ie.ID_COLOR) + texto([nomIe(j.ID_INSCRIPCION_EQUIPO), txt(j.DORSAL) ? 'dorsal ' + txt(j.DORSAL) : 'sin dorsal'].join(' · ')) + '</div></div>' +
              '<div class="gs-minis">' + (fs.length ? fs.slice(0, 3).map(function (f) { return hueco(f, 120, 'gs-foto-p'); }).join('') + (fs.length > 3 ? '<span class="gs-mas-f">+' + (fs.length - 3) + '</span>' : '')
                : '<span class="gs-opc">Sin fotos todavía</span>') + '</div></button>';
          }).join('') + '</div>' +
          (xs.length > A.n ? '<p class="gs-ir"><button type="button" class="gs-chip" data-as-mas>Ver más (' + (xs.length - A.n) + ')</button></p>' : '')
            : '<div class="gs-card gs-vacio">Ninguna jugadora con estos filtros.</div>');
        pintarFotos(c);
      }
      function elegir(idIj) {
        var f = fotoActual(), x = T.fila(IJ, idIj);
        if (!f || !x) return;
        vincular(f, x).then(function () {}, function () {});
        ctx.aviso('Vinculada a ' + (nombreJug(ix.jug[x.ID_JUGADORA]) || x.ID_JUGADORA) + '.');
        // A la siguiente sin vincular, con los mismos filtros (suelen ser fotos del mismo equipo).
        A.ids.splice(A.i, 1);
        if (A.i >= A.ids.length) A.i = Math.max(0, A.ids.length - 1);
        pintarAsFoto(); pintarAsRes();
        var c = vent && vent.querySelector('#as-foto'); if (c && velo) velo.scrollTop = 0;
      }

      /* ---------- eventos ---------- */

      function irA(tab) {
        if (pest.indexOf(tab) < 0) return;
        S.tab = tab; guardado(CLAVE + 'tab', tab); S.filAb = false;
        pintar(); window.scrollTo(0, 0); document.body.scrollTop = 0;
      }
      function ponerTem(id) { S.tem = id; guardado(CLAVE + 'tem', id); S.comp = ''; S.liga = ''; S.ju.equipo = ''; S.ju.n = VER; S.leyendo = ''; S.dia = ''; }
      function repintarLista() {
        var l = main.querySelector('#gs-lista'); if (!l) return;
        l.innerHTML = S.tab === 'EQUIPOS' ? listaEquipos() : listaJugadoras();
      }
      function abrirFila(t) {
        var x = t.closest('[data-ie], [data-ij], [data-jug]');
        if (!x) return false;
        if (x.hasAttribute('data-ie')) { var ie = ix.ie[x.getAttribute('data-ie')]; if (ie && !ie._nueva) fichaEquipo(ie); }
        else if (x.hasAttribute('data-ij')) {
          var ij = T.fila(IJ, x.getAttribute('data-ij'));
          if (ij && !ij._nueva) fichaJugadora(ij.ID_JUGADORA, ij);
          else if (!ij) ctx.aviso('La inscripción ' + x.getAttribute('data-ij') + ' no está cargada: elige su temporada y vuelve a probar.');
        }
        else if (x.hasAttribute('data-jug')) fichaJugadora(x.getAttribute('data-jug'));
        return true;
      }
      el.addEventListener('click', function (e) {
        var t = e.target, b;
        if (t.closest('[data-cerrar]')) { cerrar(); return; }
        if (t.closest('[data-asignar]')) { asignador(); return; }
        if ((b = t.closest('[data-ver-foto]'))) { var fv = T.fila('FOTOS', b.getAttribute('data-ver-foto')); if (fv) verFoto(fv); return; }
        if ((b = t.closest('[data-noella]'))) {
          var fn = T.fila('FOTOS', b.getAttribute('data-noella'));
          if (fn) desvincular(fn).then(function () { if (ctx.abierta()) ctx.aviso('Foto sin vincular: se asigna desde el Resumen.'); }, function () {});
          // La ficha se repinta en su sitio (las miniaturas salen de la memoria).
          var cj = b.closest('#gs-fotosj');
          if (cj && vent) { cj.innerHTML = bloqueFotos(vent.getAttribute('data-jug')); pintarFotos(cj); }
          return;
        }
        if (vent && vent.contains(t) && t.closest('#as-res, #as-foto, .gs-cols')) return;
        if ((b = t.closest('[data-elige]'))) {
          [].forEach.call(b.parentNode.querySelectorAll('[data-elige]'), function (x) { x.setAttribute('aria-pressed', x === b); });
          return;
        }
        if ((b = t.closest('[data-sol]'))) { resolver(b); return; }
        if ((b = t.closest('[data-posponer]'))) {
          var pp = b.parentNode.querySelector('.gs-posp'); pp.hidden = !pp.hidden; b.setAttribute('aria-expanded', !pp.hidden);
          var bq = b.parentNode.querySelector('.gs-bueno'); if (bq) bq.hidden = true;
          return;
        }
        if ((b = t.closest('[data-plazo]'))) {
          var pn = b.closest('.gs-posp');
          [].forEach.call(pn.querySelectorAll('[data-plazo]'), function (x) { x.setAttribute('aria-pressed', x === b); });
          var fe = pn.querySelector('[data-hasta]'); fe.hidden = b.getAttribute('data-plazo') !== 'fecha';
          if (!fe.hidden) { fe.min = masDias(1); if (!fe.value) fe.value = masDias(60); fe.focus(); }
          pn.querySelector('[data-pospone]').textContent = 'Posponer hasta el ' + fechaCorta(hastaDe(pn));
          return;
        }
        if ((b = t.closest('[data-pospone]'))) {
          var pc = b.closest('.gs-tarjeta'), pn2 = b.closest('.gs-posp'), hs = hastaDe(pn2), rg = pc.getAttribute('data-reg');
          if (!/^\d{4}-\d{2}-\d{2}$/.test(hs) || hs <= hoy()) { var er = pc.querySelector('.gs-tj-err'); er.textContent = 'Elige una fecha a partir de mañana.'; er.hidden = false; return; }
          posponer(rg, pc.getAttribute('data-av'), pc.getAttribute('data-t'), hs, pn2.querySelector('[data-porque]').value.trim()).then(function () {}, function () {});
          ctx.aviso('Pospuesto hasta el ' + fechaCorta(hs) + '.');
          if (vent && vent.contains(pc)) {
            var cn = pc.parentNode; pc.remove();
            if (cn && !cn.children.length) { var sc = cn.previousElementSibling; if (sc && sc.classList.contains('gs-sec')) sc.remove(); cn.remove(); }
            var rz2 = vent.querySelector('[data-resueltos="' + rg + '"]'); if (rz2) rz2.innerHTML = htmlResueltos(rg);
          }
          return;
        }
        if ((b = t.closest('[data-ya]'))) {
          var rg2 = b.getAttribute('data-reg'), it2 = b.closest('.gs-resu-i');
          if (it2) it2.innerHTML = '<span>' + texto(it2.textContent.replace(/Volver a avisar ya$/, '')) + '</span><span class="gs-opc">Vuelve a avisar</span>';
          avisarYa(rg2, b.getAttribute('data-ya')).then(function () { if (ctx.abierta()) ctx.aviso('Vuelve a avisar.'); }, function () {});
          return;
        }
        if ((b = t.closest('[data-bueno]'))) {
          var fm = b.parentNode.querySelector('.gs-bueno'); fm.hidden = !fm.hidden; b.hidden = !fm.hidden;
          var pq = b.parentNode.querySelector('.gs-posp'); if (pq) pq.hidden = true;
          if (!fm.hidden) fm.querySelector('input').focus();
          return;
        }
        if ((b = t.closest('[data-confirmar]'))) {
          var row = b.closest('.gs-tarjeta'), reg = row.getAttribute('data-reg'), cont = row.parentNode;
          darPorBueno(reg, row.getAttribute('data-av'), row.getAttribute('data-t'), row.querySelector('input').value.trim());
          // En una ficha se cambia en su sitio (sin perder lo que se está editando); en Alertas ya se ha repintado.
          if (vent && vent.contains(cont)) {
            row.remove();
            if (!cont.children.length) { var sec = cont.previousElementSibling; if (sec && sec.classList.contains('gs-sec')) sec.remove(); cont.remove(); }
            var rz = vent.querySelector('[data-resueltos="' + reg + '"]'); if (rz) rz.innerHTML = htmlResueltos(reg);
          }
          return;
        }
        if ((b = t.closest('[data-volver]'))) {
          var rv = T.fila('REVISIONES', b.getAttribute('data-volver')), it = b.closest('.gs-resu-i');
          if (rv) T.actualizar('REVISIONES', rv.ID, { RESUELTO: false }).then(function () { if (ctx.abierta()) ctx.aviso('Vuelve a avisar.'); }, function () {});
          if (it) it.innerHTML = '<span>' + texto(rv ? rv.MOTIVO : '') + '</span><span class="gs-opc">Vuelve a avisar</span>';
          return;
        }
        if ((b = t.closest('.gs-tabs [data-tab]'))) { irA(b.getAttribute('data-tab')); return; }
        if ((b = t.closest('[data-accion]'))) {
          var ac = b.getAttribute('data-accion');
          if (ac === 'vermas') { S.ju.n += VER; repintarLista(); }
          return;
        }
        if (t.closest('#gs-re')) { releer(); return; }
        if (t.closest('#gs-fbtn')) { S.filAb = !S.filAb; pintar(); return; }
        if (t.closest('#gs-todas')) {
          var ls = main.querySelectorAll('details.gs-liga'), abrir = ![].some.call(ls, function (x) { return x.open; });
          [].forEach.call(ls, function (x) { abiertas[x.getAttribute('data-liga')] = abrir; });
          guardado(CLAVE + 'abiertas', JSON.stringify(abiertas)); pintar(); return;
        }
        if ((b = t.closest('#gs-verjug'))) {
          // Ver jugadoras: Jugadoras filtrada por este equipo (en su temporada y competición).
          var ie = ix.ie[b.getAttribute('data-id')], c = ie && ix.com[ie.ID_COMPETICION];
          if (!ie) return;
          cerrar();
          if (c && String(c.ID_TEMPORADA) !== String(tem.ID)) ponerTem(String(c.ID_TEMPORADA));
          S.comp = String(ie.ID_COMPETICION); S.liga = ''; S.ju.equipo = String(ie.ID); S.ju.filtro = 'activas'; S.ju.q = '';
          irA('JUGADORAS'); return;
        }
        if ((b = t.closest('[data-quitar]'))) {
          var k = b.getAttribute('data-quitar');
          if (k === 'temp') { var act = temporadaActual(d); ponerTem(act ? String(act.ID) : ''); }
          if (k === 'comp') S.comp = '';
          if (k === 'comp' || k === 'liga') S.liga = '';
          if (k !== 'temp') S.ju.equipo = '';
          pintar(); return;
        }
        if ((b = t.closest('[data-chip]'))) {
          var g = b.getAttribute('data-chip'), v = b.getAttribute('data-v');
          if (g === 'eq') { S.eq.filtro = v; S.eq.q = ''; }
          else if (g === 'ju') { S.ju.filtro = v; S.ju.q = ''; S.ju.n = VER; }
          else if (g === 'rv') S.rv.todas = v === 'todas';
          pintar(); return;
        }
        if ((b = t.closest('[data-dia]'))) { S.dia = b.getAttribute('data-dia'); pintar(); return; }
        if ((b = t.closest('[data-ir]'))) {
          // Las cifras y «Ver en …» llevan a la pestaña ya filtrada, con los mismos filtros.
          var ir = b.getAttribute('data-ir'), f = b.getAttribute('data-irf') || '';
          if (ir === 'EQUIPOS') { S.eq.filtro = f || 'inscritos'; S.eq.q = ''; }
          else if (ir === 'JUGADORAS') { S.ju.filtro = f || 'activas'; S.ju.q = ''; S.ju.equipo = ''; S.ju.n = VER; }
          else if (ir === 'REVISIONES') S.rv.todas = false;
          irA(ir); return;
        }
        if (t.closest('[data-kpi="alertas"]')) {
          var a = main.querySelector('#gs-alts'); if (!a) return;
          [].forEach.call(a.querySelectorAll('details'), function (x) { if (x.querySelector('.gs-alt-i')) x.open = true; });
          a.scrollIntoView({ behavior: 'smooth', block: 'start' }); return;
        }
        if (t.closest('a')) return;
        abrirFila(t);
      });
      el.addEventListener('toggle', function (e) {
        var x = e.target; if (!x.hasAttribute) return;
        if (x.hasAttribute('data-alt')) { altAb[x.getAttribute('data-alt')] = x.open; if (x.open) pintarFotos(x); return; }
        if (!x.hasAttribute('data-liga')) return;
        abiertas[x.getAttribute('data-liga')] = x.open;
        guardado(CLAVE + 'abiertas', JSON.stringify(abiertas));
        var b = main.querySelector('#gs-todas');
        if (b) b.textContent = [].some.call(main.querySelectorAll('details.gs-liga'), function (y) { return y.open; }) ? 'Cerrar todas' : 'Abrir todas';
      }, true);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.closest && e.target.closest('.gs-posp') && e.target.matches('input')) { e.preventDefault(); e.target.closest('.gs-posp').querySelector('[data-pospone]').click(); return; }
        if (e.key === 'Enter' && e.target.closest && e.target.closest('.gs-bueno')) { e.preventDefault(); e.target.closest('.gs-bueno').querySelector('[data-confirmar]').click(); return; }
        var tr = e.target.closest && e.target.closest('tr[tabindex]');
        if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tr.click(); }
      });
      el.addEventListener('change', function (e) {
        if (e.target.matches && e.target.matches('[data-hasta]')) { var pn = e.target.closest('.gs-posp'); pn.querySelector('[data-pospone]').textContent = 'Posponer hasta el ' + fechaCorta(hastaDe(pn)); return; }
        var t = e.target, f = t.getAttribute && t.getAttribute('data-f');
        if (!f) return;
        if (f === 'temp') ponerTem(t.value);
        else if (f === 'comp') { S.comp = t.value; S.liga = ''; S.ju.equipo = ''; }
        else if (f === 'liga') { S.liga = t.value; S.ju.equipo = ''; }
        else if (f === 'juequipo') S.ju.equipo = t.value;
        S.ju.n = VER;
        pintar();
      });
      var tq = 0;
      el.addEventListener('input', function (e) {
        var k = e.target.getAttribute && e.target.getAttribute('data-q');
        if (!k) return;
        var v = e.target.value;
        clearTimeout(tq);
        tq = setTimeout(function () { S[k].q = v; S.ju.n = VER; repintarLista(); }, 150);
      });
      // Al pasar de móvil a ordenador (o al revés) cambia lista por tabla.
      function alAncho() { if (ctx.abierta()) pintar(); }
      if (MQ.addEventListener) MQ.addEventListener('change', alAncho); else if (MQ.addListener) MQ.addListener(alAncho);

      ctx.alCambiar(function (t) { if (tablas.indexOf(t) >= 0 || t === IJ) { if (t === 'INSCRIPCIONES_EQUIPOS') S.leyendo = ''; pintar(); } });
      // Lo guardado en el dispositivo se pinta al momento (sin pantalla de carga) y se refresca por detrás.
      // local: lo que falta se pide al motor, pero lo que ya está no se refresca solo: lo refresca refrescar, para saber la hora.
      T.leer(tablas, { local: true }).then(function () {
        S.leido = true; pintar();
        T.refrescar(tablas).then(function () { S.hora = ahora(); ponerHora(); }, function () {});
      }, function (e) {
        main.innerHTML = '<div class="gs-error" role="alert">No se han podido leer los equipos.</div><p class="gs-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Pulsa ↻ o vuelve a abrir la sección.</p>';
      });
      this._cerrar = function () {
        cerrar();
        document.removeEventListener('keydown', tecla);
        if (MQ.removeEventListener) MQ.removeEventListener('change', alAncho); else if (MQ.removeListener) MQ.removeListener(alAncho);
      };
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); }
  });
})();
