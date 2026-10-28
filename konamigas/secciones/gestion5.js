/*
 * Sección Gestión de Konamigas · núcleo 5.0 (T0256) · clientes/konamigas/modulos/gestion5 de utilo-apps
 *
 * Equipos y jugadoras sobre el Excel JUGADORAS Y EQUIPOS nuevo, por temporada:
 * - Resumen: cuántos equipos y jugadoras hay, lo que falta por pagar, los avisos de la temporada y los equipos de cada liga.
 * - Equipos: la inscripción de cada equipo en su competición (NOMBRE_EQUIPO es su nombre de ese año), con su liga, nivel,
 *   color, responsable, capitana, seguimiento, pagos y plantilla. Inscribir un equipo (nuevo o de otros años).
 * - Jugadoras: sus inscripciones de la temporada (dorsal, estado, Xporty, contactos) y su ficha con los datos personales y
 *   todas sus temporadas. Inscribir una jugadora (nueva o de otros años) en un equipo.
 * - Fotos: las de la temporada; vincular una foto a su jugadora y marcarla publicable (solo si acepta los derechos de imagen).
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
  /** Plantilla de una inscripción de equipo: sus inscripciones de jugadora (Activas primero, por dorsal). */
  function plantilla(d, idIe) {
    return d.ij.filter(function (j) { return String(j.ID_INSCRIPCION_EQUIPO) === String(idIe); }).sort(function (a, b) {
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
   */
  function pago(d, ie) {
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
   * Avisos de un equipo inscrito (las reglas del YAML): [{ k, t }]. k agrupa en el resumen.
   * ctxT: lo que comparten todos los equipos de la temporada (ver contexto()).
   */
  function avisosEquipo(d, ie, ctxT) {
    var out = [];
    if (ie.ESTADO === 'Baja') return out;
    var conf = ie.ESTADO === 'Confirmada';
    if (ie.ESTADO === 'Solicitada') out.push({ k: 'solicitada', t: 'Sin confirmar' });
    if (conf && !ie.ID_LIGA) out.push({ k: 'liga', t: 'Sin liga' });
    if (conf && ie.MENSAJE_INICIAL_ENVIADO !== true) out.push({ k: 'seguimiento', t: 'Sin mensaje inicial' });
    if (conf && ie.GRUPO_CREADO !== true) out.push({ k: 'seguimiento', t: 'Sin grupo de WhatsApp' });
    if (ie.ID_COLOR && ie.ID_LIGA && (ctxT.colorLiga[ie.ID_LIGA + '|' + ie.ID_COLOR] || 0) > 1) out.push({ k: 'color', t: 'Color repetido en su liga' });
    var nom = norm(ie.NOMBRE_EQUIPO);
    if (nom && (ctxT.nombre[ie.ID_COMPETICION + '|' + nom] || 0) > 1) out.push({ k: 'nombre', t: 'Nombre repetido' });
    if (ie.ID_CAPITANA && ctxT.ijLeidas && !d.ij.some(function (j) { return String(j.ID_INSCRIPCION_EQUIPO) === String(ie.ID) && String(j.ID_JUGADORA) === String(ie.ID_CAPITANA) && j.ESTADO !== 'Baja'; }))
      out.push({ k: 'capitana', t: 'La capitana no está en la plantilla' });
    if (!ie.ID_CAPITANA && conf) out.push({ k: 'capitana', t: 'Sin capitana' });
    if (ctxT.pagos && conf) {
      var p = pago(d, ie);
      if (p && !p.incluida && !p.sinTarifa && p.falta > 0) out.push({ k: 'pago', t: 'Faltan ' + eur(p.falta) });
    }
    return out;
  }
  /** Avisos de una inscripción de jugadora: [{ k, t }]. */
  function avisosJugadora(d, ij, ctxT) {
    var out = [];
    if (ij.ESTADO !== 'Activa') return out;
    var ie = ctxT.ie[ij.ID_INSCRIPCION_EQUIPO];
    var d0 = txt(ij.DORSAL);
    if (!d0) out.push({ k: 'dorsal', t: 'Sin dorsal' });
    else if ((ctxT.dorsal[ij.ID_INSCRIPCION_EQUIPO + '|' + d0] || 0) > 1) out.push({ k: 'dorsal', t: 'Dorsal ' + d0 + ' repetido' });
    if (ie && (ctxT.enComp[ij.ID_JUGADORA + '|' + ie.ID_COMPETICION] || 0) > 1) out.push({ k: 'doble', t: 'En dos equipos de la competición' });
    var falta = ['ACEPTA_NORMAS', 'ACEPTA_DATOS', 'ACEPTA_RESPONSABILIDAD'].filter(function (c) { return ij[c] !== true; });
    if (falta.length) out.push({ k: 'acepta', t: 'Sin aceptar ' + falta.map(function (c) { return { ACEPTA_NORMAS: 'normas', ACEPTA_DATOS: 'datos', ACEPTA_RESPONSABILIDAD: 'responsabilidad' }[c]; }).join(', ') });
    return out;
  }
  /** Lo que comparten los avisos de una temporada: cuántos hay de cada color por liga, nombres, dorsales… */
  function contexto(d, tem, o) {
    o = o || {};
    var ies = iesDe(d, tem), ix = indice(ies), c = { ie: ix, colorLiga: {}, nombre: {}, dorsal: {}, enComp: {}, pagos: !!o.pagos, ijLeidas: o.ijLeidas !== false };
    ies.forEach(function (i) {
      if (i.ESTADO === 'Baja') return;
      if (i.ID_LIGA && i.ID_COLOR) c.colorLiga[i.ID_LIGA + '|' + i.ID_COLOR] = (c.colorLiga[i.ID_LIGA + '|' + i.ID_COLOR] || 0) + 1;
      var n = norm(i.NOMBRE_EQUIPO); if (n) c.nombre[i.ID_COMPETICION + '|' + n] = (c.nombre[i.ID_COMPETICION + '|' + n] || 0) + 1;
    });
    d.ij.forEach(function (j) {
      var ie = ix[j.ID_INSCRIPCION_EQUIPO];
      if (!ie || j.ESTADO !== 'Activa' || ie.ESTADO === 'Baja') return;
      var dd = txt(j.DORSAL);
      if (dd) c.dorsal[j.ID_INSCRIPCION_EQUIPO + '|' + dd] = (c.dorsal[j.ID_INSCRIPCION_EQUIPO + '|' + dd] || 0) + 1;
      var k = j.ID_JUGADORA + '|' + ie.ID_COMPETICION;
      c.enComp[k] = (c.enComp[k] || 0) + 1;
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
    avisosJugadora: avisosJugadora, buscarJugadoras: buscarJugadoras, problemasJugadora: problemasJugadora, nombreJug: nombreJug };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }


  /* ======================= pantalla =======================
   * Se ve como la Gestión publicada (kanban4/gestion.js, 4.1): cabecera con la temporada pintada, la hora de los datos y ↻;
   * pestañas; filtros comunes (temporada, competición, liga), plegados en el móvil tras «Filtros (n)»; botones de filtro con
   * su contador; tabla en el ordenador (desde 900 px) y lista en el móvil; fichas en ventana con «Guardar N cambios».
   * Los estilos son los gs- de estilos/base.css (bloque «Gestión de Konamigas»). */

  var BASE = ['TEMPORADAS', 'COMPETICIONES', 'LIGAS', 'EQUIPOS', 'INSCRIPCIONES_EQUIPOS', 'JUGADORAS', 'STAFF', 'COLORES', 'FOTOS', 'REVISIONES'];
  var ECO = ['TARIFAS', 'DESCUENTOS', 'MOVIMIENTOS'];
  var IJ = 'INSCRIPCIONES_JUGADORAS';
  var PESTANAS = { RESUMEN: 'Resumen', EQUIPOS: 'Equipos', JUGADORAS: 'Jugadoras', FOTOS: 'Fotos', REVISIONES: 'Revisiones' };
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
  function wa(tel) {
    var n = String(tel || '').replace(/\D/g, '');
    if (n.length === 9) n = '34' + n;
    if (n.length < 9) return '';
    return (esMovil() ? 'whatsapp://send?phone=' : 'https://web.whatsapp.com/send?phone=') + n;
  }
  function aWa(tel, et, clase) {
    var u = wa(tel);
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
        filAb: false, eq: { filtro: 'inscritos', q: '' }, ju: { filtro: 'activas', q: '', equipo: '', n: VER }, fo: { filtro: 'Sin vincular' }, rv: { todas: false },
        leido: false, ijTem: '', leyendo: '', hora: '' };

      el.innerHTML = '<div class="gs gs5">' +
        '<header class="gs-cab"><p><span class="gs-pint" id="gs-pint" hidden></span><span id="gs-hora">Datos guardados en este dispositivo</span>' +
        '<button type="button" class="gs-re" id="gs-re" aria-label="Volver a leer el Excel" title="Volver a leer el Excel">↻</button></p>' +
        '<nav class="gs-tabs" role="tablist">' + pest.map(function (p) {
          return '<button type="button" role="tab" data-tab="' + p + '" aria-selected="' + (p === S.tab) + '">' + PESTANAS[p] + '</button>';
        }).join('') + '</nav></header>' +
        '<div class="gs-main" id="gs-main"><div class="gs-cargando" role="status"><div class="u-carga"></div>Cargando la temporada…</div></div>' +
        '<button type="button" class="gs-fab" id="gs-fab" hidden></button></div>';
      var raiz = el.querySelector('.gs'), main = el.querySelector('#gs-main'), fab = el.querySelector('#gs-fab');
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
      function activas(idIe) { return (porIe[idIe] || []).filter(function (j) { return j.ESTADO === 'Activa'; }); }
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
        var fb = { EQUIPOS: ['inscribirEquipo', '+ Inscribir equipo'], JUGADORAS: ['inscribirJugadora', '+ Inscribir jugadora'] }[S.tab];
        fab.hidden = !fb || !tem;
        if (fb) { fab.setAttribute('data-accion', fb[0]); fab.textContent = fb[1]; }
        if (!tem) { main.innerHTML = '<div class="gs-vacio">Todavía no hay temporadas. Añade la primera en la tabla TEMPORADAS del Excel COMPETICION.</div>'; return; }
        if (tem.ID !== S.ijTem && !S.leyendo) { S.leyendo = tem.ID; leerTem(); }
        main.innerHTML = (cfg.AYUDA ? '<p class="gs-nota gs-ayuda">' + texto(cfg.AYUDA) + '</p>' : '') +
          ({ RESUMEN: htmlResumen, EQUIPOS: htmlEquipos, JUGADORAS: htmlJugadoras, FOTOS: htmlFotos, REVISIONES: htmlRevisiones })[S.tab]();
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

      /** Un grupo de Alertas: se despliega con su lista (hasta 40); cada línea abre su ficha; al final, ir a la pestaña ya filtrada. */
      function htmlAlerta(titulo, items, ir) {
        if (!items.length) return '<details class="gs-alt" data-vacio><summary><span>' + texto(titulo) + '</span><em class="gs-pos">0</em></summary></details>';
        return '<details class="gs-alt"><summary><span>' + texto(titulo) + '</span><em class="gs-neg">' + items.length + '</em></summary>' +
          items.slice(0, 40).map(function (x) {
            return '<button type="button" class="gs-alt-i" ' + x.attr + '><b>' + x.nombre + '</b>' + (x.detalle || '') + (x.sub ? '<small>' + texto(x.sub) + '</small>' : '') + '</button>';
          }).join('') + (items.length > 40 ? '<div class="gs-mas-n">Y ' + (items.length - 40) + ' más.</div>' : '') +
          (ir && pest.indexOf(ir[0]) >= 0 ? '<p class="gs-ir"><button type="button" class="gs-chip" data-ir="' + ir[0] + '" data-irf="' + ir[1] + '">Ver en ' + PESTANAS[ir[0]] + ' ›</button></p>' : '') + '</details>';
      }
      function lineas(av) { return '<span class="gs-pag gs-amb">' + av.map(function (a) { return '<span>' + texto(a.t) + '</span>'; }).join('') + '</span>'; }
      function itemEq(i, detalle) {
        var cap = ix.jug[i.ID_CAPITANA];
        return { attr: 'data-ie="' + texto(i.ID) + '"', nombre: punto(i.ID_COLOR) + '<span>' + texto(nomIe(i.ID)) + '</span>', detalle: detalle,
          sub: [nombreJug(cap), i.ID_LIGA ? nom('lig', i.ID_LIGA) : nomComp(i.ID_COMPETICION)].filter(Boolean).join(' · ') };
      }

      function htmlResumen() {
        var vis = ies.filter(enFiltro), eqs = vis.filter(inscrito), leidas = jugLeidas();
        var nJug = 0;
        eqs.forEach(function (i) { nJug += activas(i.ID).length; });
        var porPagar = eqs.filter(function (i) { return falta(i) > 0; });
        var sinConf = vis.filter(function (i) { return cuenta(i) && i.ESTADO === 'Solicitada'; });
        var sinLiga = eqs.filter(function (i) { return !i.ID_LIGA; });
        var problemas = eqs.filter(function (i) { return avE(i).some(function (a) { return a.k !== 'pago' && a.k !== 'liga'; }); });
        var jAl = [];
        if (leidas) eqs.forEach(function (i) { activas(i.ID).forEach(function (j) { if (avJ(j).length) jAl.push(j); }); });
        var fotos = pest.indexOf('FOTOS') >= 0 ? d.fot.filter(function (f) { return String(f.ID_TEMPORADA) === String(tem.ID) && f.ESTADO === 'Sin vincular'; }) : [];
        var revs = pest.indexOf('REVISIONES') >= 0 ? d.rev.filter(function (r) { return r.RESUELTO !== true; }) : [];
        var nAl = porPagar.length + sinConf.length + problemas.length + sinLiga.length + jAl.length + fotos.length + revs.length;

        var h = '<div class="gs-filtrar">' + filtrosPlegables() + '</div><div class="gs-res-top">' +
          '<div class="gs-mini gs-mini-' + (PAGOS ? 4 : 3) + '">' +
          '<button type="button" data-ir="EQUIPOS" data-irf="inscritos"><b>' + eqs.length + '</b><small>Equipos</small></button>' +
          '<button type="button" data-ir="JUGADORAS" data-irf="activas"><b>' + (leidas ? nJug : '…') + '</b><small>Jugadoras</small></button>' +
          (PAGOS ? '<button type="button" data-ir="EQUIPOS" data-irf="pagar" class="' + (porPagar.length ? 'gs-alerta' : '') + '"><b>' + porPagar.length + '</b><small>Por pagar</small></button>' : '') +
          '<button type="button" data-kpi="alertas" class="' + (nAl ? 'gs-alerta' : '') + '"><b>' + nAl + '</b><small>Alertas</small></button></div>' +
          '<div class="gs-card gs-alts" id="gs-alts"><div class="gs-alts-t">Alertas</div>' +
          (PAGOS ? htmlAlerta('Pagos pendientes', porPagar.map(function (i) { return itemEq(i, estadoPago(i)); }), ['EQUIPOS', 'pagar']) : '') +
          htmlAlerta('Sin confirmar', sinConf.map(function (i) { return itemEq(i, '<span class="gs-pag gs-amb">Inscripción sin confirmar</span>'); }), ['EQUIPOS', 'solicitadas']) +
          htmlAlerta('Problemas en la inscripción', problemas.map(function (i) { return itemEq(i, lineas(avE(i).filter(function (a) { return a.k !== 'pago' && a.k !== 'liga'; }))); }), ['EQUIPOS', 'avisos']) +
          htmlAlerta('Equipos sin liga', sinLiga.map(function (i) { return itemEq(i, ''); }), ['EQUIPOS', 'sinliga']) +
          (leidas ? htmlAlerta('Jugadoras con alerta', jAl.map(function (j) {
            return { attr: 'data-ij="' + texto(j.ID) + '"', nombre: '<span>' + texto(nombreJug(ix.jug[j.ID_JUGADORA]) || j.ID_JUGADORA) + '</span>', detalle: lineas(avJ(j)),
              sub: [nomIe(j.ID_INSCRIPCION_EQUIPO), nom('lig', (ix.ie[j.ID_INSCRIPCION_EQUIPO] || {}).ID_LIGA)].filter(Boolean).join(' · ') };
          }), ['JUGADORAS', 'avisos']) : '<details class="gs-alt"><summary><span>Jugadoras con alerta</span><em>…</em></summary><p class="gs-nota">Cargando las jugadoras…</p></details>') +
          (pest.indexOf('FOTOS') >= 0 ? htmlAlerta('Fotos sin vincular', fotos.map(function (f) {
            return { attr: 'data-foto="' + texto(f.ID) + '"', nombre: '<span>' + texto(f.NOMBRE_ORIGINAL || f.ID) + '</span>', sub: fecha(f.FECHA) };
          }), ['FOTOS', 'Sin vincular']) : '') +
          (pest.indexOf('REVISIONES') >= 0 ? htmlAlerta('Revisiones sin resolver', revs.map(function (r) {
            return { attr: 'data-rev="' + texto(r.ID) + '"', nombre: '<span>' + texto(r.TIPO + ' · ' + r.ID_REGISTRO) + '</span>', sub: txt(r.MOTIVO) };
          }), ['REVISIONES', '']) : '') + '</div></div>';

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
              (g ? '<div class="gs-liga-g"><span>Gestor: <b>' + texto(g.APODO || g.NOMBRE) + '</b></span>' + aWa(g.TELEFONO, 'WhatsApp', 'gs-wa') + '</div>' : '') +
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
        if (!orden.length) h += '<div class="gs-vacio">' + (ies.length ? 'No hay equipos con estos filtros.' : 'Todavía no hay equipos inscritos en ' + texto(tem.NOMBRE) + '. Inscribe el primero en Equipos.') + '</div>';
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
        if (!xs.length) return h + '<div class="gs-card"><div class="gs-vacio">' + (ies.length ? 'No hay inscripciones con este filtro.' : 'Todavía no hay equipos inscritos en ' + texto(tem.NOMBRE) + '. Los que inscribas salen aquí al momento.') + '</div></div>';
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
        // Al buscar, también las que no están inscritas esta temporada (de otros años), para abrir su ficha o inscribirlas.
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

      /* ---------- FOTOS y REVISIONES ---------- */

      function htmlFotos() {
        var deTem = d.fot.filter(function (f) { return String(f.ID_TEMPORADA) === String(tem.ID); });
        var n = function (e) { return deTem.filter(function (f) { return !e || f.ESTADO === e; }).length; };
        var fs = deTem.filter(function (f) { return !S.fo.filtro || f.ESTADO === S.fo.filtro; })
          .sort(function (a, b) { return String(b.FECHA) < String(a.FECHA) ? -1 : String(b.FECHA) > String(a.FECHA) ? 1 : String(a.NOMBRE_ORIGINAL).localeCompare(String(b.NOMBRE_ORIGINAL), 'es'); });
        var h = '<div class="gs-filtrar">' + filtrosPlegables('', true) + chips([['Sin vincular', 'Sin vincular', n('Sin vincular')], ['Vinculada', 'Vinculadas', n('Vinculada')], ['', 'Todas', n('')]], S.fo.filtro, 'fo') + '</div>' +
          '<p class="gs-cuenta">' + plural(fs.length, 'foto', 'fotos') + ' de ' + texto(tem.NOMBRE) + '. Toca una para verla y decir de quién es.</p>';
        if (!fs.length) return h + '<div class="gs-card"><div class="gs-vacio">' + (S.fo.filtro === 'Sin vincular' ? 'Todas las fotos de la temporada tienen su jugadora.' : 'No hay fotos con este filtro.') + '</div></div>';
        h += '<div id="gs-lista">';
        var ver = fs.slice(0, 300), mas = fs.length > 300 ? '<div class="gs-mas-n">Y ' + (fs.length - 300) + ' más.</div>' : '';
        if (ancho()) return h + caja('<table class="u-tabla gs-tabla"><thead><tr><th>Fecha</th><th>Foto</th><th>Jugadora</th><th>Publicable</th></tr></thead><tbody>' + ver.map(function (f) {
          return '<tr tabindex="0" data-foto="' + texto(f.ID) + '"><td class="gs-alta">' + fecha(f.FECHA) + '</td><td class="u-tabla-t">' + texto(f.NOMBRE_ORIGINAL || f.ID) + '</td>' +
            '<td>' + (f.ID_JUGADORA ? texto(nombreJug(ix.jug[f.ID_JUGADORA]) || f.ID_JUGADORA) : tag('Sin vincular', 'gs-tag-a')) + '</td><td>' + (f.PUBLICABLE === true ? 'Sí' : 'No') + guardando(f) + '</td></tr>';
        }).join('') + '</tbody></table>') + mas + '</div>';
        return h + '<div class="gs-card"><div class="gs-lista">' + ver.map(function (f) {
          return '<button type="button" class="gs-item" data-foto="' + texto(f.ID) + '"><div class="gs-min"><div class="gs-t">' + texto(f.NOMBRE_ORIGINAL || f.ID) + '</div>' +
            '<div class="gs-s">' + texto([fecha(f.FECHA), f.ID_JUGADORA ? nombreJug(ix.jug[f.ID_JUGADORA]) || f.ID_JUGADORA : ''].filter(Boolean).join(' · ')) + '</div>' +
            '<div class="gs-tags">' + (f.ID_JUGADORA ? '' : tag('Sin vincular', 'gs-tag-a')) + (f.PUBLICABLE === true ? tag('Publicable', 'gs-tag-v') : '') + guardando(f) + '</div></div></button>';
        }).join('') + mas + '</div></div></div>';
      }
      function htmlRevisiones() {
        var pend = d.rev.filter(function (r) { return r.RESUELTO !== true; }).length;
        var rs = d.rev.filter(function (r) { return S.rv.todas || r.RESUELTO !== true; }).sort(function (a, b) {
          if ((a.RESUELTO === true) !== (b.RESUELTO === true)) return a.RESUELTO === true ? 1 : -1;
          return String(b.FECHA) < String(a.FECHA) ? -1 : 1;
        });
        var h = '<div class="gs-filtrar">' + chips([['', 'Sin resolver', pend], ['todas', 'Todas', d.rev.length]], S.rv.todas ? 'todas' : '', 'rv') + '</div>' +
          '<p class="gs-cuenta">Casos dudosos al unir una inscripción o una foto con su jugadora o equipo.</p>';
        if (!rs.length) return h + '<div class="gs-card"><div class="gs-vacio">No hay revisiones pendientes.</div></div>';
        h += '<div id="gs-lista">';
        if (ancho()) return h + caja('<table class="u-tabla gs-tabla"><thead><tr><th>Fecha</th><th>Caso</th><th>Motivo</th><th></th></tr></thead><tbody>' + rs.map(function (r) {
          return '<tr tabindex="0" data-rev="' + texto(r.ID) + '"><td class="gs-alta">' + fecha(r.FECHA) + '</td><td class="u-tabla-t">' + texto(r.TIPO) + ' · ' + texto(r.ID_REGISTRO) +
            (r.CANDIDATOS ? '<div class="gs-opc">' + texto(r.CANDIDATOS) + '</div>' : '') + '</td><td>' + texto(r.MOTIVO) + '</td>' +
            '<td>' + (r.RESUELTO === true ? tag('Resuelta', 'gs-tag-v') : '') + guardando(r) + '</td></tr>';
        }).join('') + '</tbody></table>') + '</div>';
        return h + '<div class="gs-card"><div class="gs-lista">' + rs.map(function (r) {
          return '<button type="button" class="gs-item" data-rev="' + texto(r.ID) + '"><div class="gs-min"><div class="gs-t">' + texto(r.TIPO) + ' · ' + texto(r.ID_REGISTRO) + '</div>' +
            '<div class="gs-s">' + texto([fecha(r.FECHA), r.MOTIVO].filter(Boolean).join(' · ')) + '</div>' +
            '<div class="gs-tags">' + (r.RESUELTO === true ? tag('Resuelta', 'gs-tag-v') : '') + guardando(r) + '</div></div></button>';
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
        if (velo) { velo.remove(); velo = null; vent = null; }
        document.documentElement.classList.remove('gs-sin-scroll');
        if (alCerrar) { var f = alCerrar; alCerrar = null; f(); }
      }
      function tecla(e) { if (e.key === 'Escape' && velo) cerrar(); }
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
        av.forEach(function (a) { t.push(tag(a.t, a.k === 'solicitada' ? 'gs-tag-g' : a.k === 'nombre' || a.k === 'color' ? 'gs-tag-r' : 'gs-tag-a')); });
        var nAct = pl.filter(function (j) { return j.ESTADO === 'Activa'; }).length, cargandoPl = !jugLeidas() && esTem;
        var html = '<p class="gs-nota gs-sub">' + texto([nomComp(ie.ID_COMPETICION), nom('lig', ie.ID_LIGA), ie.ID].filter(Boolean).join(' · ')) + '</p>' +
          (t.length ? '<div class="gs-tags gs-sub2">' + t.join('') + '</div>' : '') +
          '<div class="gs-btns">' + (cap ? aWa(cap.TELEFONO, 'Escribir a la capitana') : '') +
          (ie.ESTADO !== 'Baja' ? '<button type="button" class="gs-b2" id="gs-verjug" data-id="' + texto(ie.ID) + '">Ver jugadoras</button>' : '') + '</div>' +
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
        if (p) {
          html += '<div class="gs-sec">Pagos</div>' + (p.incluida ? '<p class="gs-nota">Incluida en otra inscripción: no se cobra.</p>' : '<div class="gs-dl">' +
            fila('Precio', p.sinTarifa ? '<span class="gs-amb">Sin tarifa en TARIFAS para esta competición</span>' : eurC(p.precio)) +
            (p.descuento ? fila('Descuento', eurC(p.descuento)) : '') +
            fila('Cobrado', eurC(p.cobrado) + (p.cobros ? ' (' + plural(p.cobros, 'movimiento', 'movimientos') + ')' : '')) +
            (p.sinTarifa ? '' : fila('Pendiente', p.falta > 0 ? '<b class="gs-neg">Faltan ' + eurC(p.falta) + '</b>' : p.falta < 0 ? '<b class="gs-pos">Ha pagado ' + eurC(-p.falta) + ' de más</b>' : '<span class="gs-pos">Al día</span>')) + '</div>' +
            '<p class="gs-nota">Los cobros se apuntan en Economía con la referencia «Inscripción» · ' + texto(ie.ID) + '.</p>');
        }
        html += '<div class="gs-sec">Plantilla (' + (cargandoPl ? '…' : nAct) + ')</div>' +
          campo({ id: 'e-ID_CAPITANA', t: 'select', et: 'Capitana', v: ie.ID_CAPITANA, opts: capis, vacio: capis.length ? '— Sin capitana —' : 'Inscribe primero a sus jugadoras' }) +
          (cargandoPl ? '<p class="gs-nota">Cargando las jugadoras…</p>' : '') +
          (pl.length ? '<div class="gs-lista gs-plantilla">' + pl.map(function (j) {
            var q = ix.jug[j.ID_JUGADORA] || {}, baja = j.ESTADO === 'Baja';
            return '<button type="button" class="gs-item' + (baja ? ' gs-err' : '') + '" data-ij="' + texto(j.ID) + '"><div class="gs-min"><div class="gs-t">' + texto(nombreJug(q) || j.ID_JUGADORA) + '</div>' +
              '<div class="gs-tags">' + (String(j.ID_JUGADORA) === String(ie.ID_CAPITANA) ? tag('Capitana', 'gs-tag-v') : '') + (baja ? tag('Baja', 'gs-tag-err') : '') + guardando(j) + '</div></div>' +
              '<div class="gs-d">' + (txt(j.DORSAL) ? texto(txt(j.DORSAL)) : '<span class="gs-opc">Sin dorsal</span>') + '</div></button>';
          }).join('') + '</div>' : (cargandoPl ? '' : '<p class="gs-nota">Sin jugadoras inscritas.</p>')) +
          (ie.ESTADO !== 'Baja' && esTem ? '<p class="gs-ir"><button type="button" class="gs-b2" data-accion="inscribirAqui" data-id="' + texto(ie.ID) + '">Inscribir jugadora en este equipo</button></p>' : '');
        html += '<div class="gs-sec">El equipo</div>' + (e.ID ? '<div class="gs-dos">' +
          campo({ id: 'q-NOMBRE', t: 'texto', et: 'Nombre actual (todas las temporadas)', v: e.NOMBRE, attrs: ' maxlength="80"' }) +
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
              return [Object.keys(cs[0]).length ? T.actualizar('INSCRIPCIONES_EQUIPOS', ie.ID, cs[0]) : null,
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
        av.forEach(function (a) { t.push(tag(a.t, a.k === 'doble' ? 'gs-tag-r' : 'gs-tag-a')); });
        var html = '<p class="gs-nota gs-sub">' + texto([ij ? nomIe(ij.ID_INSCRIPCION_EQUIPO) : '', ij ? nomComp(ie.ID_COMPETICION) : '', p.ID, e !== '' ? e + ' años' : ''].filter(Boolean).join(' · ')) + '</p>' +
          (t.length ? '<div class="gs-tags gs-sub2">' + t.join('') + '</div>' : '') +
          '<div class="gs-btns">' + aWa(p.TELEFONO, 'WhatsApp') +
          (ie && ie.ID ? '<button type="button" class="gs-b2" data-ie="' + texto(ie.ID) + '">Ver el equipo</button>' : '') +
          '<button type="button" class="gs-b2" data-accion="inscribirJug" data-id="' + texto(p.ID) + '">Inscribir en otro equipo</button></div>';
        if (ij) {
          html += '<div class="gs-sec">Inscripción · ' + punto(ie.ID_COLOR) + texto(nomIe(ij.ID_INSCRIPCION_EQUIPO)) + '</div><div class="gs-dos">' +
            campo({ id: 'i-DORSAL', t: 'texto', et: 'Dorsal', v: ij.DORSAL, attrs: ' maxlength="3" inputmode="numeric"' }) +
            campo({ id: 'i-ESTADO', t: 'select', et: 'Estado', v: ij.ESTADO, opts: [['Activa', 'Activa'], ['Baja', 'Baja (no cuenta)']], nota: 'Para cambiarla de equipo, dale de baja aquí e «Inscribir en otro equipo».' }) + '</div>' +
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
        var fts = d.fot.filter(function (f) { return String(f.ID_JUGADORA) === String(p.ID); });
        if (fts.length) html += '<div class="gs-sec">Fotos (' + fts.length + ')</div><div class="gs-lista">' + fts.map(function (f) {
          return '<button type="button" class="gs-item" data-foto="' + texto(f.ID) + '"><div class="gs-min"><div class="gs-t">' + texto(f.NOMBRE_ORIGINAL || f.ID) + '</div>' +
            '<div class="gs-s">' + texto(fecha(f.FECHA) + ' · ' + (f.PUBLICABLE === true ? 'publicable' : 'no publicable')) + '</div></div></button>';
        }).join('') + '</div>';
        html += '<div class="gs-sec">Sus temporadas</div><div id="gs-hist"></div>' + pie('i-guardar');
        function historial() {
          var h = vent && vent.querySelector('#gs-hist'); if (!h) return;
          var xs = T.filas(IJ).filter(function (x) { return String(x.ID_JUGADORA) === String(p.ID); }).map(function (x) {
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

      /** Inscribir un equipo en una competición de la temporada: uno que ya existe (de otros años) o uno nuevo. */
      function formInscribirEquipo() {
        var cs = compsDe(d, tem.ID).map(function (c) { return [c.ID, txt(c.NOMBRE_COMERCIAL || c.NOMBRE)]; });
        if (!cs.length) { ctx.aviso('Esta temporada no tiene competiciones: añádelas en el Excel COMPETICION.'); return; }
        var eqs = d.eqs.slice().sort(function (a, b) { return txt(a.NOMBRE).localeCompare(txt(b.NOMBRE), 'es'); }).map(function (e) { return [e.ID, txt(e.NOMBRE) + ' · ' + e.ID]; });
        var html = '<p class="gs-nota gs-sub">Un equipo de otros años o uno nuevo, en una competición de ' + texto(tem.NOMBRE) + '.</p>' +
          campo({ id: 'n-ID_COMPETICION', t: 'select', et: 'Competición', v: S.comp || cs[0][0], opts: cs }) +
          '<label class="gs-campo" for="n-buscar">Equipo<input type="search" id="n-buscar" placeholder="Busca por nombre…" autocomplete="off">' +
          '<select id="n-ID_EQUIPO">' + opciones([['+', '+ Equipo nuevo']].concat(eqs), '', 'Elige el equipo') + '</select></label>' +
          '<div class="gs-dos">' + campo({ id: 'n-NOMBRE', t: 'texto', et: 'Nombre del equipo nuevo', attrs: ' maxlength="80"', cls: 'gs-nuevo' }) +
          campo({ id: 'n-TIPO', t: 'select', et: 'Tipo', v: 'Liga', opts: [['Liga', 'Liga'], ['Kopa di Mondo', 'Kopa di Mondo']], cls: 'gs-nuevo' }) +
          campo({ id: 'n-NOMBRE_EQUIPO', t: 'texto', et: 'Nombre este año', attrs: ' maxlength="80" placeholder="El del equipo, si no se dice otro"' }) +
          campo({ id: 'n-ESTADO', t: 'select', et: 'Estado', v: 'Solicitada', opts: [['Solicitada', 'Solicitada (sin confirmar)'], ['Confirmada', 'Confirmada']] }) +
          campo({ id: 'n-ID_LIGA', t: 'select', et: 'Liga', opts: [] }) +
          campo({ id: 'n-NIVEL', t: 'select', et: 'Nivel', opts: NIVELES, vacio: '—' }) + '</div>' +
          '<div class="gs-error" id="gs-err" role="alert" hidden></div><div class="gs-acc gs-pie"><button type="button" class="gs-b2" data-cerrar>Cancelar</button><button type="button" class="gs-b1" id="n-guardar">Inscribir</button></div>';
        ventana('Inscribir equipo', html, function () {
          var sel = vent.querySelector('#n-ID_EQUIPO');
          function refrescar() {
            var nuevo = sel.value === '+';
            [].forEach.call(vent.querySelectorAll('.gs-nuevo'), function (x) { x.hidden = !nuevo; });
            var sl = vent.querySelector('#n-ID_LIGA'), l = sl.value;
            sl.innerHTML = opciones(ligasDe(val('n-ID_COMPETICION')), l, '— Sin liga todavía —');
          }
          refrescar();
          sel.addEventListener('change', refrescar);
          vent.querySelector('#n-ID_COMPETICION').addEventListener('change', refrescar);
          vent.querySelector('#n-buscar').addEventListener('input', function () {
            var q = norm(this.value), v = sel.value;
            sel.innerHTML = opciones([['+', '+ Equipo nuevo']].concat(eqs.filter(function (e) { return !q || norm(e[1]).indexOf(q) >= 0; })), v, q ? 'Elige entre los que encajan' : 'Elige el equipo');
            refrescar();
          });
          vent.querySelector('#n-guardar').onclick = function () {
            var nuevo = sel.value === '+', comp = val('n-ID_COMPETICION');
            var v = { ID_COMPETICION: comp, NOMBRE_EQUIPO: val('n-NOMBRE_EQUIPO'), ESTADO: val('n-ESTADO'), ID_LIGA: val('n-ID_LIGA'), NIVEL: val('n-NIVEL') };
            var mal = [];
            if (nuevo) {
              v.EQUIPO_NUEVO = { NOMBRE: val('n-NOMBRE'), TIPO: val('n-TIPO') };
              if (!v.EQUIPO_NUEVO.NOMBRE) mal.push('Falta el nombre del equipo nuevo.');
              else if (d.eqs.some(function (e) { return norm(e.NOMBRE) === norm(v.EQUIPO_NUEVO.NOMBRE); })) mal.push('Ya hay un equipo que se llama así: búscalo en la lista.');
              if (!v.NOMBRE_EQUIPO) v.NOMBRE_EQUIPO = v.EQUIPO_NUEVO.NOMBRE;
            } else {
              v.ID_EQUIPO = sel.value;
              if (!v.ID_EQUIPO) mal.push('Elige el equipo o «Equipo nuevo».');
              else if (d.ie.some(function (i) { return String(i.ID_EQUIPO) === v.ID_EQUIPO && String(i.ID_COMPETICION) === comp; })) mal.push('Ese equipo ya está inscrito en esa competición.');
              if (!v.NOMBRE_EQUIPO) v.NOMBRE_EQUIPO = nom('eqs', v.ID_EQUIPO);
            }
            if (mal.length) { verError(mal); return; }
            cerrar();
            T.crear('INSCRIPCIONES_EQUIPOS', v, { fn: 'gestion5InscribirEquipo' }).then(function (r) {
              if (ctx.abierta()) ctx.aviso(v.NOMBRE_EQUIPO + ' inscrito (' + r.id + ').');
            }, function () {});
          };
        });
      }

      /** Inscribir una jugadora en un equipo de la temporada: una que ya existe (búscala) o una nueva. */
      function formInscribirJugadora(idIe, idJug) {
        var eqs = ies.filter(function (i) { return i.ESTADO !== 'Baja'; }).sort(function (a, b) { return nomIe(a.ID).localeCompare(nomIe(b.ID), 'es'); })
          .map(function (i) { return [i.ID, nomIe(i.ID) + ' · ' + nomComp(i.ID_COMPETICION)]; });
        if (!eqs.length) { ctx.aviso('Inscribe antes algún equipo en ' + tem.NOMBRE + '.'); return; }
        var elegida = idJug ? ix.jug[idJug] : null;
        var html = '<p class="gs-nota gs-sub">Una jugadora que ya está (de otros años) o una nueva, en un equipo de ' + texto(tem.NOMBRE) + '.</p>' +
          campo({ id: 'j-ID_INSCRIPCION_EQUIPO', t: 'select', et: 'Equipo', v: idIe || S.ju.equipo || '', opts: eqs, vacio: 'Elige el equipo' }) +
          campo({ id: 'j-buscar', t: 'buscar', et: 'Jugadora', v: elegida ? nombreJug(elegida) : '', attrs: ' placeholder="Nombre, teléfono o DNI"' }) +
          '<div id="j-lista"></div><div class="gs-dos">' +
          campo({ id: 'j-NOMBRE', t: 'texto', et: 'Nombre', attrs: ' maxlength="60"', cls: 'gs-nueva' }) +
          campo({ id: 'j-APELLIDO_1', t: 'texto', et: 'Primer apellido', attrs: ' maxlength="60"', cls: 'gs-nueva' }) +
          campo({ id: 'j-APELLIDO_2', t: 'texto', et: 'Segundo apellido', attrs: ' maxlength="60"', cls: 'gs-nueva' }) +
          campo({ id: 'j-TELEFONO', t: 'tel', et: 'Teléfono', attrs: ' maxlength="20"', cls: 'gs-nueva' }) +
          campo({ id: 'j-FECHA_NACIMIENTO', t: 'fecha', et: 'Fecha de nacimiento', cls: 'gs-nueva' }) +
          campo({ id: 'j-EMAIL', t: 'email', et: 'Correo', attrs: ' maxlength="100"', cls: 'gs-nueva' }) +
          campo({ id: 'j-DORSAL', t: 'texto', et: 'Dorsal', attrs: ' maxlength="3" inputmode="numeric"' }) + '</div>' +
          '<div class="gs-error" id="gs-err" role="alert" hidden></div><div class="gs-acc gs-pie"><button type="button" class="gs-b2" data-cerrar>Cancelar</button><button type="button" class="gs-b1" id="j-guardar">Inscribir</button></div>';
        var sel = elegida ? elegida.ID : '', nueva = false;
        ventana('Inscribir jugadora', html, function () {
          var lista = vent.querySelector('#j-lista');
          function pintarLista() {
            [].forEach.call(vent.querySelectorAll('.gs-nueva'), function (x) { x.hidden = !nueva; });
            if (nueva) { lista.innerHTML = '<p class="gs-nota">Jugadora nueva. <button type="button" class="gs-enl" data-j="">Buscar entre las que ya hay</button></p>'; return; }
            if (sel) { lista.innerHTML = '<p class="gs-nota">Elegida: <b>' + texto(nombreJug(ix.jug[sel])) + '</b> (' + texto(sel) + ', ' + texto((ix.jug[sel] || {}).TELEFONO) + '). <button type="button" class="gs-enl" data-j="">Cambiar</button></p>'; return; }
            var q = val('j-buscar'), xs = q.length >= 2 ? buscarJugadoras(d.jug, q, 8) : [];
            lista.innerHTML = (xs.length ? '<div class="gs-lista gs-elegir">' + xs.map(function (p) {
              return '<button type="button" class="gs-item" data-j="' + texto(p.ID) + '"><div class="gs-min"><div class="gs-t">' + texto(nombreJug(p)) + '</div>' +
                '<div class="gs-s">' + texto([p.ID, p.TELEFONO, edad(p.FECHA_NACIMIENTO) !== '' ? edad(p.FECHA_NACIMIENTO) + ' años' : ''].filter(Boolean).join(' · ')) + '</div></div></button>';
            }).join('') + '</div>' : (q.length >= 2 ? '<p class="gs-nota">Ninguna jugadora encaja.</p>' : '')) +
              '<p class="gs-ir"><button type="button" class="gs-b2" data-j="+">+ Jugadora nueva</button></p>';
          }
          pintarLista();
          vent.querySelector('#j-buscar').addEventListener('input', function () { sel = ''; nueva = false; pintarLista(); });
          lista.addEventListener('click', function (e) {
            var b = e.target.closest('[data-j]'); if (!b) return;
            var j = b.getAttribute('data-j');
            if (j === '+') {
              nueva = true; sel = '';
              var q = val('j-buscar').split(/\s+/);
              if (!/\d/.test(q[0] || '')) { vent.querySelector('#j-NOMBRE').value = q[0] || ''; vent.querySelector('#j-APELLIDO_1').value = q[1] || ''; vent.querySelector('#j-APELLIDO_2').value = q.slice(2).join(' '); }
            } else { nueva = false; sel = j; }
            pintarLista();
          });
          vent.querySelector('#j-guardar').onclick = function () {
            var v = { ID_INSCRIPCION_EQUIPO: val('j-ID_INSCRIPCION_EQUIPO'), DORSAL: val('j-DORSAL') }, mal = [];
            if (!v.ID_INSCRIPCION_EQUIPO) mal.push('Elige el equipo.');
            if (v.DORSAL && !/^\d{1,3}$/.test(v.DORSAL)) mal.push('El dorsal es un número.');
            if (nueva) {
              v.JUGADORA_NUEVA = { NOMBRE: val('j-NOMBRE'), APELLIDO_1: val('j-APELLIDO_1'), APELLIDO_2: val('j-APELLIDO_2'), TELEFONO: val('j-TELEFONO'), FECHA_NACIMIENTO: val('j-FECHA_NACIMIENTO'), EMAIL: val('j-EMAIL') };
              mal = mal.concat(problemasJugadora(v.JUGADORA_NUEVA, d.jug, ''));
            } else if (!sel) mal.push('Busca y elige la jugadora, o «Jugadora nueva».');
            else {
              v.ID_JUGADORA = sel;
              if (d.ij.some(function (x) { return String(x.ID_JUGADORA) === sel && String(x.ID_INSCRIPCION_EQUIPO) === v.ID_INSCRIPCION_EQUIPO; })) mal.push('Ya está inscrita en ese equipo.');
            }
            if (v.DORSAL && d.ij.some(function (x) { return String(x.ID_INSCRIPCION_EQUIPO) === v.ID_INSCRIPCION_EQUIPO && x.ESTADO !== 'Baja' && txt(x.DORSAL) === v.DORSAL; })) mal.push('El dorsal ' + v.DORSAL + ' ya lo lleva otra jugadora de ese equipo.');
            if (mal.length) { verError(mal); return; }
            var quien = nueva ? nombreJug(v.JUGADORA_NUEVA) : nombreJug(ix.jug[sel]);
            cerrar();
            T.crear(IJ, v, { fn: 'gestion5InscribirJugadora' }).then(function () {
              if (ctx.abierta()) ctx.aviso(quien + ' inscrita en ' + nomIe(v.ID_INSCRIPCION_EQUIPO) + '.');
            }, function () {});
          };
        });
      }

      /** Ficha de una foto: se ve (desde Drive), se vincula a su jugadora y se marca publicable. */
      function fichaFoto(f) {
        var pj = ix.jug[f.ID_JUGADORA];
        var acepta = function (idJug) { return T.filas(IJ).some(function (x) { return String(x.ID_JUGADORA) === String(idJug) && x.ACEPTA_DERECHOS_IMAGEN === true; }); };
        var eqsJug = function (idJug) {
          return ies.filter(function (i) { return d.ij.some(function (x) { return String(x.ID_JUGADORA) === String(idJug) && String(x.ID_INSCRIPCION_EQUIPO) === String(i.ID); }); })
            .map(function (i) { return [i.ID, nomIe(i.ID) + ' · ' + nomComp(i.ID_COMPETICION)]; });
        };
        var html = '<p class="gs-nota gs-sub">' + texto([fecha(f.FECHA), f.ESTADO, f.ID].filter(Boolean).join(' · ')) + '</p>' +
          (f.ARCHIVO_URL ? '<div class="gs-btns"><a class="gs-b2" href="' + texto(f.ARCHIVO_URL) + '" target="_blank" rel="noopener">Abrir en Drive ↗</a></div>' : '') +
          '<div class="gs-visor" id="f-vista"><div class="u-carga"></div></div>' +
          '<div class="gs-sec">De quién es</div>' +
          campo({ id: 'f-buscar', t: 'buscar', et: 'Jugadora', v: nombreJug(pj), attrs: ' placeholder="Busca por nombre o teléfono"' }) +
          '<div id="f-lista"></div>' +
          campo({ id: 'f-ID_INSCRIPCION_EQUIPO', t: 'select', et: 'Equipo con el que salió', opts: [] }) +
          '<div class="gs-checks">' + campo({ id: 'f-PUBLICABLE', t: 'si', et: 'Se puede publicar', v: f.PUBLICABLE }) + '</div><p class="gs-nota" id="f-nota"></p>' +
          pie('f-guardar');
        var sel = f.ID_JUGADORA ? String(f.ID_JUGADORA) : '';
        ventana(texto(f.NOMBRE_ORIGINAL || f.ID), html, function () {
          var lista = vent.querySelector('#f-lista'), pub = vent.querySelector('#f-PUBLICABLE'), se = vent.querySelector('#f-ID_INSCRIPCION_EQUIPO');
          var primera = true;
          function pintarLista() {
            if (sel) lista.innerHTML = '<p class="gs-nota">Vinculada a <b>' + texto(nombreJug(ix.jug[sel])) + '</b> (' + texto(sel) + '). <button type="button" class="gs-enl" data-j="">Quitar</button></p>';
            else {
              var q = val('f-buscar'), xs = q.length >= 2 ? buscarJugadoras(d.jug, q, 8) : [];
              lista.innerHTML = xs.length ? '<div class="gs-lista gs-elegir">' + xs.map(function (p) {
                return '<button type="button" class="gs-item" data-j="' + texto(p.ID) + '"><div class="gs-min"><div class="gs-t">' + texto(nombreJug(p)) + '</div><div class="gs-s">' + texto([p.ID, p.TELEFONO].filter(Boolean).join(' · ')) + '</div></div></button>';
              }).join('') + '</div>' : '<p class="gs-nota">' + (q.length >= 2 ? 'Ninguna jugadora encaja.' : 'Sin vincular: busca a la jugadora de la foto.') + '</p>';
            }
            var ev = primera ? f.ID_INSCRIPCION_EQUIPO : se.value;
            primera = false;
            se.innerHTML = opciones(sel ? eqsJug(sel) : [], ev, sel ? 'Sin equipo' : 'Elige antes la jugadora');
            var ok = sel && acepta(sel);
            pub.disabled = !ok; if (!ok) pub.checked = false;
            vent.querySelector('#f-nota').textContent = !sel ? 'Solo se publica una foto vinculada.' : ok ? 'Ha aceptado que se publiquen sus fotos.' : 'No consta que acepte que se publiquen sus fotos: no se puede marcar.';
          }
          var g = { f: f, pre: 'f-', ks: ['ID_JUGADORA', 'ID_INSCRIPCION_EQUIPO', 'ESTADO', 'PUBLICABLE'] };
          g.ajustar = function (v) { v.ID_JUGADORA = sel; v.ESTADO = sel ? 'Vinculada' : 'Sin vincular'; v.PUBLICABLE = !!(sel && pub.checked); if (!sel) v.ID_INSCRIPCION_EQUIPO = ''; };
          pintarLista();
          vent.querySelector('#f-buscar').addEventListener('input', function () { sel = ''; pintarLista(); });
          lista.addEventListener('click', function (e) {
            var b = e.target.closest('[data-j]'); if (!b) return;
            sel = b.getAttribute('data-j'); if (!sel) vent.querySelector('#f-buscar').value = '';
            pintarLista(); vent.dispatchEvent(new Event('change'));
          });
          if (f.ARCHIVO_URL) ctx.llamar('gestion5Archivo', [f.ARCHIVO_URL]).then(function (r) {
            var v = vent && vent.querySelector('#f-vista'); if (!v) return;
            v.innerHTML = r && r.img ? '<img src="' + texto(r.img) + '" alt="' + texto(f.NOMBRE_ORIGINAL) + '">' : '<p class="gs-nota">No se puede ver aquí: ábrela en Drive.</p>';
          }, function () { var v = vent && vent.querySelector('#f-vista'); if (v) v.innerHTML = '<p class="gs-nota">No se ha podido cargar: ábrela en Drive.</p>'; });
          else vent.querySelector('#f-vista').innerHTML = '';
          guardable('f-guardar', [g], { escribir: function (cs) { return [T.actualizar('FOTOS', f.ID, cs[0])]; } });
        });
      }

      /** Una revisión: el caso, sus candidatos (se abren) y marcarla resuelta o volver a abrirla. */
      function fichaRevision(r) {
        var cand = ids(r.ID_REGISTRO + ' ' + r.CANDIDATOS);
        var html = '<p class="gs-nota gs-sub">' + texto([fecha(r.FECHA), r.RESUELTO === true ? 'Resuelta' : 'Sin resolver'].join(' · ')) + '</p>' +
          '<div class="gs-dl">' + fila('Registro', texto(r.ID_REGISTRO)) + fila('Candidatos', texto(r.CANDIDATOS)) + '</div>' +
          (txt(r.MOTIVO) ? '<div class="gs-dtx"><b>Motivo</b><p>' + texto(r.MOTIVO) + '</p></div>' : '') +
          (cand.length ? '<div class="gs-sec">Ver</div><div class="gs-btns">' + cand.map(function (c) {
            var t = ix.jug[c] ? nombreJug(ix.jug[c]) : ix.ie[c] ? nomIe(c) : ix.eqs[c] ? nom('eqs', c) : '';
            return t ? '<button type="button" class="gs-b2" data-abrir="' + texto(c) + '">' + texto(t) + ' · ' + texto(c) + '</button>' : '';
          }).join('') + '</div>' : '') +
          '<div class="gs-acc gs-pie"><button type="button" class="gs-b2" data-cerrar>Cerrar</button><button type="button" class="gs-b1" id="r-ok">' + (r.RESUELTO === true ? 'Volver a abrirla' : 'Marcar resuelta') + '</button></div>';
        ventana(texto(r.TIPO + ' · ' + r.ID), html, function () {
          vent.querySelector('#r-ok').onclick = function () {
            cerrar();
            T.actualizar('REVISIONES', r.ID, { RESUELTO: r.RESUELTO !== true }).then(function () { if (ctx.abierta()) ctx.aviso('Revisión guardada en el Excel.'); }, function () {});
          };
          [].forEach.call(vent.querySelectorAll('[data-abrir]'), function (b) {
            b.onclick = function () { var c = b.getAttribute('data-abrir'); if (ix.jug[c]) fichaJugadora(c); else if (ix.ie[c]) fichaEquipo(ix.ie[c]); };
          });
        });
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
        var x = t.closest('[data-ie], [data-ij], [data-jug], [data-foto], [data-rev]');
        if (!x) return false;
        if (x.hasAttribute('data-ie')) { var ie = ix.ie[x.getAttribute('data-ie')]; if (ie && !ie._nueva) fichaEquipo(ie); }
        else if (x.hasAttribute('data-ij')) { var ij = T.fila(IJ, x.getAttribute('data-ij')); if (ij && !ij._nueva) fichaJugadora(ij.ID_JUGADORA, ij); }
        else if (x.hasAttribute('data-jug')) fichaJugadora(x.getAttribute('data-jug'));
        else if (x.hasAttribute('data-foto')) { var f = T.fila('FOTOS', x.getAttribute('data-foto')); if (f && !f._nueva) fichaFoto(f); }
        else if (x.hasAttribute('data-rev')) { var r = T.fila('REVISIONES', x.getAttribute('data-rev')); if (r) fichaRevision(r); }
        return true;
      }
      el.addEventListener('click', function (e) {
        var t = e.target, b;
        if (t.closest('[data-cerrar]')) { cerrar(); return; }
        if (vent && vent.contains(t) && t.closest('#j-lista, #f-lista')) return;
        if ((b = t.closest('.gs-tabs [data-tab]'))) { irA(b.getAttribute('data-tab')); return; }
        if ((b = t.closest('[data-accion]'))) {
          var ac = b.getAttribute('data-accion');
          if (ac === 'inscribirEquipo') formInscribirEquipo();
          else if (ac === 'inscribirJugadora') formInscribirJugadora('');
          else if (ac === 'inscribirAqui') formInscribirJugadora(b.getAttribute('data-id'));
          else if (ac === 'inscribirJug') formInscribirJugadora('', b.getAttribute('data-id'));
          else if (ac === 'vermas') { S.ju.n += VER; repintarLista(); }
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
          else if (g === 'fo') S.fo.filtro = v;
          else if (g === 'rv') S.rv.todas = v === 'todas';
          pintar(); return;
        }
        if ((b = t.closest('[data-dia]'))) { S.dia = b.getAttribute('data-dia'); pintar(); return; }
        if ((b = t.closest('[data-ir]'))) {
          // Las cifras y «Ver en …» llevan a la pestaña ya filtrada, con los mismos filtros.
          var ir = b.getAttribute('data-ir'), f = b.getAttribute('data-irf') || '';
          if (ir === 'EQUIPOS') { S.eq.filtro = f || 'inscritos'; S.eq.q = ''; }
          else if (ir === 'JUGADORAS') { S.ju.filtro = f || 'activas'; S.ju.q = ''; S.ju.equipo = ''; S.ju.n = VER; }
          else if (ir === 'FOTOS') S.fo.filtro = f;
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
        var x = e.target; if (!x.hasAttribute || !x.hasAttribute('data-liga')) return;
        abiertas[x.getAttribute('data-liga')] = x.open;
        guardado(CLAVE + 'abiertas', JSON.stringify(abiertas));
        var b = main.querySelector('#gs-todas');
        if (b) b.textContent = [].some.call(main.querySelectorAll('details.gs-liga'), function (y) { return y.open; }) ? 'Cerrar todas' : 'Abrir todas';
      }, true);
      el.addEventListener('keydown', function (e) {
        var tr = e.target.closest && e.target.closest('tr[tabindex]');
        if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tr.click(); }
      });
      el.addEventListener('change', function (e) {
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
