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

  /* ======================= pantalla ======================= */

  var BASE = ['TEMPORADAS', 'COMPETICIONES', 'LIGAS', 'EQUIPOS', 'INSCRIPCIONES_EQUIPOS', 'JUGADORAS', 'STAFF', 'COLORES', 'FOTOS', 'REVISIONES'];
  var ECO = ['TARIFAS', 'DESCUENTOS', 'MOVIMIENTOS'];
  var IJ = 'INSCRIPCIONES_JUGADORAS';
  var PESTANAS = { RESUMEN: 'Resumen', EQUIPOS: 'Equipos', JUGADORAS: 'Jugadoras', FOTOS: 'Fotos', REVISIONES: 'Revisiones' };
  var VER = 150;

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function opciones(lista, sel, vacio) {
    return (vacio !== undefined ? '<option value="">' + texto(vacio) + '</option>' : '') + lista.map(function (o) {
      return '<option value="' + texto(o[0]) + '"' + (String(o[0]) === String(sel == null ? '' : sel) ? ' selected' : '') + '>' + texto(o[1]) + '</option>';
    }).join('');
  }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) {} return ''; }
  function chips(av) { return av.map(function (a) { return ' <span class="u-chip">' + texto(a.t) + '</span>'; }).join(''); }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

  window.UN.registrar('GESTION', {
    abrir: function (el, ctx) {
      var T = ctx.tablas, cfg = ctx.config || {};
      var PAGOS = cfg.PAGOS !== 'No';
      var tablas = BASE.concat(PAGOS ? ECO : []);
      var pest = String(cfg.PESTANAS || Object.keys(PESTANAS).join(',')).split(',').map(function (s) { return s.trim().toUpperCase(); })
        .filter(function (s) { return PESTANAS[s]; });
      if (!pest.length) pest = Object.keys(PESTANAS);
      var CLAVE = 'ges_' + ctx.id + '_';
      var S = { tab: pest.indexOf(guardado(CLAVE + 'tab')) >= 0 ? guardado(CLAVE + 'tab') : pest[0], tem: guardado(CLAVE + 'tem'), comp: '', liga: '',
        eq: { q: '', ver: '', estado: '' }, ju: { q: '', ver: '', equipo: '', n: VER }, fo: { estado: 'Sin vincular' }, rv: { todas: false },
        leido: false, ijTem: '' };

      el.innerHTML = (cfg.AYUDA ? '<p class="u-nota n-ayuda">' + texto(cfg.AYUDA) + '</p>' : '') +
        '<div class="eco-barra"><label class="u-campo eco-per"><span class="u-etiqueta">Temporada</span><select id="ges-tem"></select></label>' +
        '<div class="u-pestanas" role="tablist">' + pest.map(function (p) {
          return '<button type="button" role="tab" data-tab="' + p + '">' + PESTANAS[p] + '</button>';
        }).join('') + '</div></div>' +
        '<div id="ges-cont"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<div class="u-velo" id="ges-velo"><div class="u-ventana" role="dialog" aria-modal="true" aria-labelledby="ges-vt"><div class="n-ventana" id="ges-vent"></div></div></div>';
      var cont = el.querySelector('#ges-cont'), velo = el.querySelector('#ges-velo'), vent = el.querySelector('#ges-vent'), selTem = el.querySelector('#ges-tem');

      /* ---------- datos ---------- */

      function datos() {
        return {
          tem: T.filas('TEMPORADAS'), com: T.filas('COMPETICIONES'), lig: T.filas('LIGAS'), eqs: T.filas('EQUIPOS'), ie: T.filas('INSCRIPCIONES_EQUIPOS'),
          ij: T.filas(IJ), jug: T.filas('JUGADORAS'), stf: T.filas('STAFF'), col: T.filas('COLORES'), fot: T.filas('FOTOS'), rev: T.filas('REVISIONES'),
          tar: PAGOS ? T.filas('TARIFAS') : [], des: PAGOS ? T.filas('DESCUENTOS') : [], mov: PAGOS ? T.filas('MOVIMIENTOS') : []
        };
      }
      var d, tem, ix, ies, cx;
      function preparar() {
        d = datos();
        var ts = temporadas(d);
        tem = ts.filter(function (t) { return String(t.ID) === S.tem; })[0] || temporadaActual(d);
        ix = { tem: indice(d.tem), com: indice(d.com), lig: indice(d.lig), eqs: indice(d.eqs), ie: indice(d.ie), jug: indice(d.jug), stf: indice(d.stf), col: indice(d.col), ij: indice(d.ij) };
        ies = tem ? iesDe(d, tem.ID) : [];
        cx = contexto(d, tem ? tem.ID : '', { pagos: PAGOS, ijLeidas: !!tem && S.ijTem === tem.ID });
        selTem.innerHTML = opciones(ts.map(function (t) { return [t.ID, t.NOMBRE || t.ID]; }), tem ? tem.ID : '');
      }
      function nom(t, id) { var f = ix[t][String(id || '')]; return f ? txt(f.NOMBRE || f.APODO || f.ID) : txt(id); }
      function nomComp(id) { var c = ix.com[String(id || '')]; return c ? txt(c.NOMBRE_COMERCIAL || c.NOMBRE) : txt(id); }
      function nomIe(id) { var i = ix.ie[String(id || '')]; return i ? txt(i.NOMBRE_EQUIPO) || nom('eqs', i.ID_EQUIPO) : txt(id); }
      function punto(idColor) {
        var c = ix.col[String(idColor || '')];
        var hex = c && /^#?[0-9a-f]{3,8}$/i.test(txt(c.COLOR_HEX)) ? (txt(c.COLOR_HEX)[0] === '#' ? '' : '#') + txt(c.COLOR_HEX) : '';
        return hex ? '<span class="ges-punto" style="background:' + texto(hex) + '" title="' + texto(c.NOMBRE) + '"></span>' : '';
      }
      function chip(f) { return f && (f._pendiente || f._nueva) ? ' <span class="u-chip">Guardando</span>' : ''; }

      /** INSCRIPCIONES_JUGADORAS de la temporada: la parte de sus equipos inscritos. Al momento si ya se vio. */
      function parteTem(t) { return { clave: 'T:' + t, col: 'ID_INSCRIPCION_EQUIPO', valores: iesDe(datos(), t).map(function (i) { return i.ID; }) }; }
      function leerTem() {
        if (!tem) return;
        var t = tem.ID, p = parteTem(t), o = {}; o[IJ] = p;
        var ya = T.tiene && T.tiene(IJ, p);
        if (ya) S.ijTem = t;
        T.leer([IJ], { partes: o }).then(function () { S.ijTem = t; if (ctx.abierta()) pintar(); }, function (e) {
          if (ctx.abierta()) ctx.aviso('No se han podido leer las jugadoras: ' + String(e.message).replace(/^\w+:\s*/, ''));
        });
      }

      /* ---------- pintar ---------- */

      function pintar() {
        if (!S.leido) return;
        preparar();
        [].forEach.call(el.querySelectorAll('[data-tab]'), function (b) {
          var si = b.getAttribute('data-tab') === S.tab;
          b.setAttribute('aria-selected', si ? 'true' : 'false');
          if (si && b.parentNode.scrollWidth > b.parentNode.clientWidth) b.parentNode.scrollLeft = Math.max(0, b.offsetLeft - b.parentNode.offsetLeft - 16);
        });
        if (!tem) { cont.innerHTML = '<p class="u-vacio">Todavía no hay temporadas. Añade la primera en la tabla TEMPORADAS del Excel COMPETICION.</p>'; return; }
        if (tem.ID !== S.ijTem && !S.leyendo) { S.leyendo = tem.ID; leerTem(); }
        cont.innerHTML = ({ RESUMEN: htmlResumen, EQUIPOS: htmlEquipos, JUGADORAS: htmlJugadoras, FOTOS: htmlFotos, REVISIONES: htmlRevisiones })[S.tab]()
          .replace(/<table class="u-tabla([^"]*)">/g, '<div class="u-tabla-caja"><table class="u-tabla$1">').replace(/<\/table>/g, '</table></div>');
        var q = cont.querySelector('[data-q]');
        if (q && S.foco) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
        S.foco = false;
      }
      function cargandoJug() { return S.ijTem !== tem.ID ? '<p class="u-nota" role="status">Cargando las jugadoras de ' + texto(tem.NOMBRE) + '…</p>' : ''; }

      /** Filtros de competición y liga de la temporada (comunes a Resumen, Equipos y Jugadoras). */
      function filtrosComp() {
        var cs = compsDe(d, tem.ID).map(function (c) { return [c.ID, txt(c.NOMBRE_COMERCIAL || c.NOMBRE)]; });
        if (S.comp && !cs.some(function (c) { return c[0] === S.comp; })) S.comp = '';
        var ls = d.lig.filter(function (l) { return S.comp ? String(l.ID_COMPETICION) === S.comp : cs.some(function (c) { return c[0] === String(l.ID_COMPETICION); }); })
          .map(function (l) { return [l.ID, txt(l.NOMBRE) + (S.comp ? '' : ' · ' + nomComp(l.ID_COMPETICION))]; });
        return '<label class="u-campo"><span class="u-etiqueta">Competición</span><select data-f="comp">' + opciones(cs, S.comp, 'Todas') + '</select></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Liga</span><select data-f="liga">' + opciones([['-', 'Sin liga']].concat(ls), S.liga, 'Todas') + '</select></label>';
      }
      function enFiltro(ie) {
        if (S.comp && String(ie.ID_COMPETICION) !== S.comp) return false;
        if (S.liga === '-' ? !!ie.ID_LIGA : S.liga && String(ie.ID_LIGA) !== S.liga) return false;
        return true;
      }

      function htmlResumen() {
        var vis = ies.filter(enFiltro), eqs = vis.filter(cuenta), conf = eqs.filter(function (i) { return i.ESTADO === 'Confirmada'; });
        var activas = 0, falta = 0, nFalta = 0, grupos = {};
        var visIx = indice(vis);
        d.ij.forEach(function (j) { var ie = visIx[j.ID_INSCRIPCION_EQUIPO]; if (ie && cuenta(ie) && j.ESTADO === 'Activa') activas++; });
        vis.forEach(function (ie) {
          avisosEquipo(d, ie, cx).forEach(function (a) { (grupos[a.k] = grupos[a.k] || []).push({ ie: ie, a: a }); });
          if (PAGOS && cuenta(ie) && ie.ESTADO === 'Confirmada') { var p = pago(d, ie); if (p && p.falta > 0 && !p.incluida && !p.sinTarifa) { falta += p.falta; nFalta++; } }
        });
        var jav = {};
        if (S.ijTem === tem.ID) d.ij.forEach(function (j) { if (!visIx[j.ID_INSCRIPCION_EQUIPO]) return; avisosJugadora(d, j, cx).forEach(function (a) { (jav[a.k] = jav[a.k] || []).push({ ij: j, a: a }); }); });
        var revs = d.rev.filter(function (r) { return r.RESUELTO !== true; }).length;
        var sinV = d.fot.filter(function (f) { return String(f.ID_TEMPORADA) === String(tem.ID) && f.ESTADO === 'Sin vincular'; }).length;
        var h = '<div class="u-filtros">' + filtrosComp() + '</div>' +
          '<table class="u-tabla eco-tabla"><tbody>' +
          fila('Equipos', plural(conf.length, 'confirmado', 'confirmados') + ' · ' + plural(eqs.length - conf.length, 'sin confirmar', 'sin confirmar'), String(eqs.length), 'EQUIPOS') +
          fila('Jugadoras', S.ijTem === tem.ID ? 'Activas en esos equipos' : 'Cargando…', S.ijTem === tem.ID ? String(activas) : '…', 'JUGADORAS') +
          (PAGOS ? fila('Por pagar', plural(nFalta, 'equipo confirmado', 'equipos confirmados') + ' con la inscripción sin pagar del todo', eur(falta), 'EQUIPOS', 'pago') : '') +
          (pest.indexOf('REVISIONES') >= 0 ? fila('Revisiones', 'Casos dudosos sin resolver', String(revs), 'REVISIONES') : '') +
          (pest.indexOf('FOTOS') >= 0 ? fila('Fotos sin vincular', 'De ' + texto(tem.NOMBRE), String(sinV), 'FOTOS') : '') +
          '</tbody></table>';
        function fila(t, nota, cifra, ir, ver) {
          return '<tr tabindex="0" data-ir="' + ir + '"' + (ver ? ' data-ver="' + ver + '"' : '') + '><td class="u-tabla-t">' + t + '<div class="u-nota">' + nota + '</div></td><td class="num"><span class="u-cifra">' + cifra + '</span></td></tr>';
        }
        var nombresEq = { pago: 'Pagos pendientes', liga: 'Equipos confirmados sin liga', capitana: 'Capitana', solicitada: 'Inscripciones sin confirmar', seguimiento: 'Seguimiento (mensaje inicial, grupo)', color: 'Color repetido en la liga', nombre: 'Nombre repetido en la competición' };
        var nombresJu = { dorsal: 'Dorsales (sin dorsal o repetido)', doble: 'Jugadoras en dos equipos de la misma competición', acepta: 'Sin aceptar normas, datos o responsabilidad' };
        var ks = Object.keys(nombresEq).filter(function (k) { return grupos[k]; }), kj = Object.keys(nombresJu).filter(function (k) { return jav[k]; });
        h += '<h2 class="n-grupo">Avisos de <span class="ges-destacar">' + texto(tem.NOMBRE) + '</span></h2>';
        if (!ks.length && !kj.length) h += '<p class="u-vacio">' + (S.ijTem === tem.ID ? 'Nada pendiente con estos filtros.' : 'Sin avisos de equipos. Los de las jugadoras salen al cargarlas.') + '</p>';
        ks.forEach(function (k) {
          var xs = grupos[k];
          h += '<details class="ges-grupo"><summary>' + nombresEq[k] + ' <span class="u-chip">' + xs.length + '</span></summary><table class="u-tabla eco-tabla"><tbody>' +
            xs.slice(0, 40).map(function (x) { return '<tr tabindex="0" data-ie="' + texto(x.ie.ID) + '"><td class="u-tabla-t">' + punto(x.ie.ID_COLOR) + texto(nomIe(x.ie.ID)) + '<div class="u-nota">' + texto([nomComp(x.ie.ID_COMPETICION), nom('lig', x.ie.ID_LIGA)].filter(Boolean).join(' · ')) + '</div></td><td>' + texto(x.a.t) + '</td></tr>'; }).join('') +
            '</tbody></table>' + (xs.length > 40 ? '<p class="u-nota">Y ' + (xs.length - 40) + ' más.</p>' : '') + '</details>';
        });
        kj.forEach(function (k) {
          var xs = jav[k];
          h += '<details class="ges-grupo"><summary>' + nombresJu[k] + ' <span class="u-chip">' + xs.length + '</span></summary><table class="u-tabla eco-tabla"><tbody>' +
            xs.slice(0, 40).map(function (x) { return '<tr tabindex="0" data-ij="' + texto(x.ij.ID) + '"><td class="u-tabla-t">' + texto(nombreJug(ix.jug[x.ij.ID_JUGADORA]) || x.ij.ID_JUGADORA) + '<div class="u-nota">' + texto(nomIe(x.ij.ID_INSCRIPCION_EQUIPO)) + '</div></td><td>' + texto(x.a.t) + '</td></tr>'; }).join('') +
            '</tbody></table>' + (xs.length > 40 ? '<p class="u-nota">Y ' + (xs.length - 40) + ' más.</p>' : '') + '</details>';
        });
        // Por liga: cada liga con sus equipos, del nivel más alto al más bajo.
        var porLiga = {};
        eqs.forEach(function (i) { var k = String(i.ID_LIGA || ''); (porLiga[k] = porLiga[k] || []).push(i); });
        var ligas = Object.keys(porLiga).sort(function (a, b) {
          if (!a) return 1; if (!b) return -1;
          var la = ix.lig[a] || {}, lb = ix.lig[b] || {}, dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
          return (dias.indexOf(la.DIA_SEMANA) - dias.indexOf(lb.DIA_SEMANA)) || String(la.NOMBRE).localeCompare(String(lb.NOMBRE), 'es');
        });
        h += '<h2 class="n-grupo">Por liga</h2>';
        if (!ligas.length) h += '<p class="u-vacio">No hay equipos inscritos en ' + texto(tem.NOMBRE) + (S.comp || S.liga ? ' con estos filtros' : '') + '. Inscribe el primero en Equipos.</p>';
        ligas.forEach(function (k) {
          var l = ix.lig[k], xs = porLiga[k].sort(function (a, b) { return (Number(b.NIVEL) || 0) - (Number(a.NIVEL) || 0) || nomIe(a.ID).localeCompare(nomIe(b.ID), 'es'); });
          var g = l && l.ID_GESTOR ? nom('stf', l.ID_GESTOR) : '';
          h += '<details class="ges-grupo"' + (S.abiertas && S.abiertas[k] ? ' open' : '') + ' data-liga="' + texto(k) + '"><summary>' + (l ? texto(l.NOMBRE) + ' · ' + texto(nomComp(l.ID_COMPETICION)) : 'Sin liga') +
            ' <span class="u-chip">' + plural(xs.length, 'equipo', 'equipos') + '</span>' + (l ? '<span class="u-nota"> ' + texto([l.DIA_SEMANA, g].filter(Boolean).join(' · ')) + '</span>' : '') + '</summary>' +
            '<table class="u-tabla eco-tabla n-lista"><thead><tr><th>Equipo</th><th>Nivel</th><th>Jugadoras</th>' + (PAGOS ? '<th class="num">Falta</th>' : '') + '</tr></thead><tbody>' +
            xs.map(function (i) {
              var p = PAGOS ? pago(d, i) : null, n = plantilla(d, i.ID).filter(function (j) { return j.ESTADO === 'Activa'; }).length;
              return '<tr tabindex="0" data-ie="' + texto(i.ID) + '"><td class="u-tabla-t">' + punto(i.ID_COLOR) + texto(nomIe(i.ID)) + chip(i) + (i.ESTADO !== 'Confirmada' ? ' <span class="u-chip">' + texto(i.ESTADO) + '</span>' : '') + '</td>' +
                '<td data-t="Nivel">' + texto(i.NIVEL ? 'Nivel ' + i.NIVEL : '') + '</td><td>' + (S.ijTem === tem.ID ? plural(n, 'jugadora', 'jugadoras') : '') + '</td>' +
                (PAGOS ? '<td class="num">' + (i.ESTADO !== 'Confirmada' ? '' : p && p.falta > 0 && !p.sinTarifa ? '<span class="u-mal">' + eur(p.falta) + '</span>' : p && p.sinTarifa ? '<span class="u-nota">Sin tarifa</span>' : '<span class="u-nota">Al día</span>') + '</td>' : '') + '</tr>';
            }).join('') + '</tbody></table></details>';
        });
        return cargandoJug() + h;
      }

      var VER_EQ = { '': 'Todos', confirmados: 'Confirmados', solicitados: 'Sin confirmar', avisos: 'Con avisos', pago: 'Por pagar', bajas: 'Bajas', copas: 'Copas y supercopas' };
      function equiposFiltrados() {
        var q = norm(S.eq.q), v = S.eq.ver;
        return ies.filter(function (i) {
          if (!enFiltro(i)) return false;
          if (v === 'bajas') { if (i.ESTADO !== 'Baja') return false; }
          else if (v === 'copas') { if (i.ORIGEN !== 'Clasificación') return false; }
          else if (!q && (i.ESTADO === 'Baja')) return false;
          if (v === 'confirmados' && i.ESTADO !== 'Confirmada') return false;
          if (v === 'solicitados' && i.ESTADO !== 'Solicitada') return false;
          if (v === 'avisos' && !avisosEquipo(d, i, cx).length) return false;
          if (v === 'pago') { var p = pago(d, i); if (i.ESTADO !== 'Confirmada' || !p || p.incluida || p.sinTarifa || p.falta <= 0) return false; }
          if (q) {
            var cap = ix.jug[i.ID_CAPITANA];
            if (norm([i.ID, i.NOMBRE_EQUIPO, nom('eqs', i.ID_EQUIPO), nom('lig', i.ID_LIGA), nom('stf', i.ID_RESPONSABLE), nombreJug(cap), cap && cap.TELEFONO].join(' ')).indexOf(q) < 0) return false;
          }
          return true;
        }).sort(function (a, b) { return nomIe(a.ID).localeCompare(nomIe(b.ID), 'es'); });
      }
      function htmlEquipos() {
        var xs = equiposFiltrados();
        var h = '<div class="eco-cab"><p class="u-nota">' + plural(xs.length, 'inscripción', 'inscripciones') + ' de equipo</p>' +
          '<button type="button" class="u-btn u-btn-accion" data-accion="inscribirEquipo">Inscribir equipo</button></div>' +
          '<div class="u-filtros"><label class="u-campo"><span class="u-etiqueta">Buscar</span><input type="search" data-q="eq" value="' + texto(S.eq.q) + '" placeholder="Equipo, capitana, liga…"></label>' + filtrosComp() +
          '<label class="u-campo"><span class="u-etiqueta">Ver</span><select data-f="eqver">' + opciones(Object.keys(VER_EQ).filter(function (k) { return k && (PAGOS || k !== 'pago'); }).map(function (k) { return [k, VER_EQ[k]]; }), S.eq.ver, 'Todos') + '</select></label></div>';
        if (!xs.length) return h + '<p class="u-vacio">' + (ies.length ? 'Ningún equipo cumple el filtro. Quita algún filtro para ver más.' : 'Todavía no hay equipos inscritos en ' + texto(tem.NOMBRE) + '. Los que inscribas salen aquí al momento.') + '</p>';
        return h + '<table class="u-tabla eco-tabla n-lista"><thead><tr><th>Equipo</th><th>Liga</th><th>Capitana</th><th>Jugadoras</th><th>Avisos</th></tr></thead><tbody>' + xs.map(function (i) {
          var n = plantilla(d, i.ID).filter(function (j) { return j.ESTADO === 'Activa'; }).length, av = avisosEquipo(d, i, cx);
          return '<tr tabindex="0" data-ie="' + texto(i.ID) + '"><td class="u-tabla-t">' + punto(i.ID_COLOR) + texto(nomIe(i.ID)) + chip(i) +
            (i.ESTADO !== 'Confirmada' ? ' <span class="u-chip">' + texto(i.ESTADO) + '</span>' : '') + (i.ORIGEN === 'Clasificación' ? ' <span class="u-chip">Copa</span>' : '') +
            '<div class="u-nota">' + texto([S.comp ? '' : nomComp(i.ID_COMPETICION), i.NIVEL ? 'Nivel ' + i.NIVEL : ''].filter(Boolean).join(' · ')) + '</div></td>' +
            '<td>' + texto(nom('lig', i.ID_LIGA)) + '</td><td>' + texto(nombreJug(ix.jug[i.ID_CAPITANA])) + '</td>' +
            '<td>' + (S.ijTem === tem.ID ? plural(n, 'jugadora', 'jugadoras') : '…') + '</td><td>' + chips(av) + '</td></tr>';
        }).join('') + '</tbody></table>';
      }

      var VER_JU = { '': 'Activas', avisos: 'Con avisos', dorsal: 'Sin dorsal', xporty: 'Sin Xporty', contactos: 'Sin contactos', bajas: 'Bajas' };
      function htmlJugadoras() {
        var vis = indice(ies.filter(enFiltro)), q = norm(S.ju.q), v = S.ju.ver;
        if (S.ju.equipo && !vis[S.ju.equipo]) S.ju.equipo = '';
        var xs = d.ij.filter(function (j) {
          var ie = vis[j.ID_INSCRIPCION_EQUIPO];
          if (!ie) return false;
          if (S.ju.equipo && String(j.ID_INSCRIPCION_EQUIPO) !== S.ju.equipo) return false;
          if (v === 'bajas' ? j.ESTADO !== 'Baja' : j.ESTADO === 'Baja') return false;
          if (v === 'avisos' && !avisosJugadora(d, j, cx).length) return false;
          if (v === 'dorsal' && txt(j.DORSAL)) return false;
          if (v === 'xporty' && j.EN_XPORTY === true) return false;
          if (v === 'contactos' && j.EN_CONTACTOS_GOOGLE === true) return false;
          if (q) {
            var p = ix.jug[j.ID_JUGADORA] || {};
            if (norm([j.ID_JUGADORA, nombreJug(p), p.TELEFONO, p.EMAIL, p.NUM_DOCUMENTO, p.INSTAGRAM, nomIe(j.ID_INSCRIPCION_EQUIPO), 'dorsal ' + txt(j.DORSAL)].join(' ')).indexOf(q) < 0 &&
              !(telefono(q).length >= 6 && telefono(p.TELEFONO).indexOf(telefono(q)) >= 0)) return false;
          }
          return true;
        }).sort(function (a, b) { return nomIe(a.ID_INSCRIPCION_EQUIPO).localeCompare(nomIe(b.ID_INSCRIPCION_EQUIPO), 'es') || nombreJug(ix.jug[a.ID_JUGADORA]).localeCompare(nombreJug(ix.jug[b.ID_JUGADORA]), 'es'); });
        var eqs = Object.keys(vis).map(function (k) { return vis[k]; }).filter(function (i) { return i.ESTADO !== 'Baja'; }).sort(function (a, b) { return nomIe(a.ID).localeCompare(nomIe(b.ID), 'es'); })
          .map(function (i) { return [i.ID, nomIe(i.ID) + (S.comp ? '' : ' · ' + nomComp(i.ID_COMPETICION))]; });
        var h = '<div class="eco-cab"><p class="u-nota">' + (S.ijTem === tem.ID ? plural(xs.length, 'inscripción', 'inscripciones') + ' de jugadora' : 'Cargando…') + '</p>' +
          '<button type="button" class="u-btn u-btn-accion" data-accion="inscribirJugadora">Inscribir jugadora</button></div>' +
          '<div class="u-filtros"><label class="u-campo"><span class="u-etiqueta">Buscar</span><input type="search" data-q="ju" value="' + texto(S.ju.q) + '" placeholder="Nombre, teléfono, DNI, dorsal…"></label>' + filtrosComp() +
          '<label class="u-campo"><span class="u-etiqueta">Equipo</span><select data-f="juequipo">' + opciones(eqs, S.ju.equipo, 'Todos') + '</select></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Ver</span><select data-f="juver">' + opciones(Object.keys(VER_JU).filter(Boolean).map(function (k) { return [k, VER_JU[k]]; }), v, 'Activas') + '</select></label></div>';
        if (S.ijTem !== tem.ID) return h + cargandoJug();
        if (xs.length) {
          h += '<table class="u-tabla eco-tabla n-lista"><thead><tr><th>Jugadora</th><th>Equipo</th><th>Dorsal</th><th>Edad</th><th>Avisos</th></tr></thead><tbody>' + xs.slice(0, S.ju.n).map(function (j) {
            var p = ix.jug[j.ID_JUGADORA] || {}, e = edad(p.FECHA_NACIMIENTO);
            return '<tr tabindex="0" data-ij="' + texto(j.ID) + '"><td class="u-tabla-t">' + texto(nombreJug(p) || j.ID_JUGADORA) + chip(j) + (j.ESTADO === 'Baja' ? ' <span class="u-chip">Baja</span>' : '') + '</td>' +
              '<td>' + punto((ix.ie[j.ID_INSCRIPCION_EQUIPO] || {}).ID_COLOR) + texto(nomIe(j.ID_INSCRIPCION_EQUIPO)) + '</td><td data-t="Dorsal">' + texto(txt(j.DORSAL) ? 'Dorsal ' + txt(j.DORSAL) : '') + '</td>' +
              '<td>' + (e === '' ? '' : e + ' años') + '</td><td>' + chips(avisosJugadora(d, j, cx)) + '</td></tr>';
          }).join('') + '</tbody></table>';
          if (xs.length > S.ju.n) h += '<button type="button" class="u-btn" data-accion="vermas">Ver ' + Math.min(VER, xs.length - S.ju.n) + ' más</button>';
        } else h += '<p class="u-vacio">' + (q ? 'Ninguna jugadora inscrita esta temporada encaja con la búsqueda.' : 'Ninguna jugadora cumple el filtro.') + '</p>';
        // Al buscar, también las que no están inscritas esta temporada (de otros años), para abrir su ficha o inscribirlas.
        if (q.length >= 3) {
          var ya = {}; xs.forEach(function (j) { ya[j.ID_JUGADORA] = 1; });
          var otras = buscarJugadoras(d.jug, S.ju.q, 30).filter(function (p) { return !ya[p.ID]; });
          if (otras.length) h += '<h2 class="n-grupo">Otras jugadoras</h2><p class="u-nota">Sin inscripción en este filtro de ' + texto(tem.NOMBRE) + '.</p><table class="u-tabla eco-tabla n-lista"><tbody>' + otras.map(function (p) {
            return '<tr tabindex="0" data-jug="' + texto(p.ID) + '"><td class="u-tabla-t">' + texto(nombreJug(p)) + '</td><td>' + texto(p.ID) + '</td><td>' + texto(p.TELEFONO) + '</td></tr>';
          }).join('') + '</tbody></table>';
        }
        return h;
      }

      function htmlFotos() {
        var fs = d.fot.filter(function (f) { return String(f.ID_TEMPORADA) === String(tem.ID) && (!S.fo.estado || f.ESTADO === S.fo.estado); })
          .sort(function (a, b) { return String(b.FECHA) < String(a.FECHA) ? -1 : String(b.FECHA) > String(a.FECHA) ? 1 : String(a.NOMBRE_ORIGINAL).localeCompare(String(b.NOMBRE_ORIGINAL), 'es'); });
        var h = '<div class="u-filtros"><label class="u-campo"><span class="u-etiqueta">Ver</span><select data-f="foestado">' + opciones([['Sin vincular', 'Sin vincular'], ['Vinculada', 'Vinculadas']], S.fo.estado, 'Todas') + '</select></label></div>' +
          '<p class="u-nota">' + plural(fs.length, 'foto', 'fotos') + ' de ' + texto(tem.NOMBRE) + '. Toca una para verla y decir de quién es.</p>';
        if (!fs.length) return h + '<p class="u-vacio">' + (S.fo.estado === 'Sin vincular' ? 'Todas las fotos de la temporada tienen su jugadora.' : 'No hay fotos con este filtro.') + '</p>';
        return h + '<table class="u-tabla eco-tabla n-lista"><thead><tr><th>Foto</th><th>Jugadora</th><th>Fecha</th><th>Publicable</th></tr></thead><tbody>' + fs.slice(0, 300).map(function (f) {
          return '<tr tabindex="0" data-foto="' + texto(f.ID) + '"><td class="u-tabla-t">' + texto(f.NOMBRE_ORIGINAL || f.ID) + chip(f) + (f.ESTADO === 'Sin vincular' ? ' <span class="u-chip">Sin vincular</span>' : '') + '</td>' +
            '<td>' + texto(nombreJug(ix.jug[f.ID_JUGADORA])) + '</td><td>' + fecha(f.FECHA) + '</td><td>' + (f.PUBLICABLE === true ? 'Sí' : 'No') + '</td></tr>';
        }).join('') + '</tbody></table>' + (fs.length > 300 ? '<p class="u-nota">Y ' + (fs.length - 300) + ' más.</p>' : '');
      }

      function htmlRevisiones() {
        var rs = d.rev.filter(function (r) { return S.rv.todas || r.RESUELTO !== true; }).sort(function (a, b) {
          if ((a.RESUELTO === true) !== (b.RESUELTO === true)) return a.RESUELTO === true ? 1 : -1;
          return String(b.FECHA) < String(a.FECHA) ? -1 : 1;
        });
        var h = '<div class="eco-cab"><p class="u-nota">' + plural(d.rev.filter(function (r) { return r.RESUELTO !== true; }).length, 'revisión sin resolver', 'revisiones sin resolver') + ' · casos dudosos al unir una inscripción o una foto con su jugadora o equipo.</p>' +
          '<button type="button" class="u-btn" data-accion="todasRev">' + (S.rv.todas ? 'Ver solo las pendientes' : 'Ver también las resueltas') + '</button></div>';
        if (!rs.length) return h + '<p class="u-vacio">No hay revisiones pendientes.</p>';
        return h + '<table class="u-tabla eco-tabla n-lista"><thead><tr><th>Caso</th><th>Motivo</th><th></th></tr></thead><tbody>' + rs.map(function (r) {
          return '<tr tabindex="0" data-rev="' + texto(r.ID) + '"><td class="u-tabla-t">' + texto(r.TIPO) + ' · ' + texto(r.ID_REGISTRO) + chip(r) + '<div class="u-nota">' + fecha(r.FECHA) + (r.CANDIDATOS ? ' · ' + texto(r.CANDIDATOS) : '') + '</div></td>' +
            '<td>' + texto(r.MOTIVO) + '</td><td>' + (r.RESUELTO === true ? '<span class="u-chip">Resuelta</span>' : '') + '</td></tr>';
        }).join('') + '</tbody></table>';
      }

      /* ---------- ventanas ---------- */

      var alCerrar = null;
      function ventana(html, alAbrir) {
        vent.innerHTML = html;
        velo.classList.add('abierto');
        velo.scrollTop = 0;
        if (alAbrir) alAbrir();
        var p = vent.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea');
        if (p && window.matchMedia && window.matchMedia('(hover: hover)').matches) p.focus();
      }
      function cerrar() { velo.classList.remove('abierto'); vent.innerHTML = ''; if (alCerrar) { var f = alCerrar; alCerrar = null; f(); } }
      function campo(et, html, extra) { return '<label class="u-campo' + (extra ? ' ' + extra : '') + '"><span class="u-etiqueta">' + et + '</span>' + html + '</label>'; }
      function casilla(id, et, si) { return '<label class="u-check"><input type="checkbox" id="' + id + '"' + (si === true ? ' checked' : '') + '> ' + et + '</label>'; }
      function val(id) { var e = vent.querySelector('#' + id); return !e ? undefined : e.type === 'checkbox' ? e.checked : String(e.value).trim(); }
      function verError(mal) { var e = vent.querySelector('.u-error'); e.textContent = mal.join(' '); e.hidden = !mal.length; }
      function cambios(f, v) {
        var c = {};
        Object.keys(v).forEach(function (k) {
          if (v[k] === undefined) return;
          // Una casilla vacía en el Excel es «no»: no se escribe false encima si no se ha tocado.
          if (typeof v[k] === 'boolean' ? (f[k] === true) !== v[k] : String(f[k] == null ? '' : f[k]) !== String(v[k])) c[k] = v[k];
        });
        return c;
      }
      function dato(et, v) { return v === '' || v == null ? '' : '<div><dt>' + et + '</dt><dd>' + v + '</dd></div>'; }
      function guardar(tabla, f, c, que) {
        if (!Object.keys(c).length) return;
        T.actualizar(tabla, f.ID, c).then(function () { if (ctx.abierta()) ctx.aviso((que || 'Cambios') + ' guardados en el Excel.'); }, function () {});
      }
      function ligasDe(idComp) { return d.lig.filter(function (l) { return String(l.ID_COMPETICION) === String(idComp); }).map(function (l) { return [l.ID, txt(l.NOMBRE) + (l.DIA_SEMANA ? ' · ' + l.DIA_SEMANA : '')]; }); }
      function gestores() {
        return d.stf.filter(function (s) { return s.ES_GESTOR === true && s.ACTIVO !== false; }).map(function (s) { return [s.ID, txt(s.APODO || s.NOMBRE)]; })
          .sort(function (a, b) { return a[1].localeCompare(b[1], 'es'); });
      }

      /** Ficha de la inscripción de un equipo: lo de este año (editable), el equipo, sus pagos y su plantilla. */
      function fichaEquipo(ie) {
        var e = ix.eqs[ie.ID_EQUIPO] || {}, pl = plantilla(d, ie.ID), av = avisosEquipo(d, ie, cx), p = PAGOS ? pago(d, ie) : null;
        var otras = d.ie.filter(function (x) { return String(x.ID_EQUIPO) === String(ie.ID_EQUIPO) && x !== ie; })
          .sort(function (a, b) { return String(b.FECHA_INSCRIPCION) < String(a.FECHA_INSCRIPCION) ? -1 : 1; });
        var capis = pl.filter(function (j) { return j.ESTADO !== 'Baja'; }).map(function (j) { return [j.ID_JUGADORA, nombreJug(ix.jug[j.ID_JUGADORA]) || j.ID_JUGADORA]; });
        if (ie.ID_CAPITANA && !capis.some(function (c) { return c[0] === String(ie.ID_CAPITANA); })) capis.unshift([ie.ID_CAPITANA, (nombreJug(ix.jug[ie.ID_CAPITANA]) || ie.ID_CAPITANA) + ' (no está en la plantilla)']);
        var cols = d.col.map(function (c) { return [c.ID, txt(c.NOMBRE || c.CODIGO || c.ID)]; });
        var html = '<h2 id="ges-vt">' + punto(ie.ID_COLOR) + texto(nomIe(ie.ID)) + '</h2>' +
          '<p class="u-nota">' + texto([nomComp(ie.ID_COMPETICION), nom('lig', ie.ID_LIGA), ie.ID].filter(Boolean).join(' · ')) + chips(av) + '</p>' +
          '<h3 class="n-grupo">Esta temporada</h3><div class="u-campos">' +
          campo('Nombre este año', '<input type="text" id="e-NOMBRE_EQUIPO" value="' + texto(ie.NOMBRE_EQUIPO) + '" maxlength="80">') +
          campo('Estado', '<select id="e-ESTADO">' + opciones([['Solicitada', 'Solicitada'], ['Confirmada', 'Confirmada'], ['Baja', 'Baja']], ie.ESTADO) + '</select>') +
          campo('Liga', '<select id="e-ID_LIGA">' + opciones(ligasDe(ie.ID_COMPETICION), ie.ID_LIGA, 'Sin liga todavía') + '</select>') +
          campo('Nivel', '<select id="e-NIVEL">' + opciones(['1', '2', '3', '4', '5'].map(function (n) { return [n, n + (n === '1' ? ' (el más bajo)' : n === '5' ? ' (el más alto)' : '')]; }), ie.NIVEL, '—') + '</select>') +
          campo('Color de camiseta', '<select id="e-ID_COLOR">' + opciones(cols, ie.ID_COLOR, 'Sin color') + '</select>') +
          campo('Responsable (cobra la señal)', '<select id="e-ID_RESPONSABLE">' + opciones(gestores(), ie.ID_RESPONSABLE, 'Nadie') + '</select>') +
          campo('Capitana', '<select id="e-ID_CAPITANA">' + opciones(capis, ie.ID_CAPITANA, capis.length ? 'Sin capitana' : 'Inscribe primero a sus jugadoras') + '</select>', 'u-ancho') +
          '<div class="u-ancho ges-checks">' + casilla('e-MENSAJE_INICIAL_ENVIADO', 'Mensaje inicial enviado', ie.MENSAJE_INICIAL_ENVIADO) + casilla('e-GRUPO_CREADO', 'Grupo de WhatsApp creado', ie.GRUPO_CREADO) +
          casilla('e-EN_XPORTY', 'En Xporty', ie.EN_XPORTY) + '</div>' +
          campo('Notas internas', '<textarea id="e-NOTAS" rows="2">' + texto(ie.NOTAS) + '</textarea>', 'u-ancho') +
          '</div><p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="e-guardar">Guardar</button><button type="button" class="u-btn" data-cerrar>Cerrar</button></div>';
        if (p) {
          html += '<h3 class="n-grupo">Pago de la inscripción</h3>' + (p.incluida ? '<p class="u-nota">Incluida en otra inscripción: no se cobra.</p>' :
            '<dl class="ges-datos">' + (p.sinTarifa ? dato('Precio', 'Sin tarifa en TARIFAS para esta competición') : dato('Precio', eur(p.precio)) + (p.descuento ? dato('Descuento', eur(p.descuento)) : '')) +
            dato('Cobrado', eur(p.cobrado) + (p.cobros ? ' (' + plural(p.cobros, 'movimiento', 'movimientos') + ')' : '')) +
            (p.sinTarifa ? '' : dato('Falta', p.falta > 0 ? '<span class="u-mal">' + eur(p.falta) + '</span>' : p.falta < 0 ? 'Ha pagado ' + eur(-p.falta) + ' de más' : 'Al día')) + '</dl>' +
            '<p class="u-nota">Los cobros se apuntan en Economía, con «Inscripción» y esta inscripción (' + texto(ie.ID) + ') de referencia.</p>');
        }
        html += '<h3 class="n-grupo">Plantilla <span class="u-chip">' + pl.filter(function (j) { return j.ESTADO === 'Activa'; }).length + '</span></h3>' +
          (S.ijTem !== tem.ID && String((ix.com[ie.ID_COMPETICION] || {}).ID_TEMPORADA) === String(tem.ID) ? '<p class="u-nota">Cargando…</p>' : '') +
          (pl.length ? '<table class="u-tabla eco-tabla"><tbody>' + pl.map(function (j) {
            return '<tr tabindex="0" data-ij="' + texto(j.ID) + '"><td class="u-tabla-t">' + texto(nombreJug(ix.jug[j.ID_JUGADORA]) || j.ID_JUGADORA) + chip(j) +
              (String(j.ID_JUGADORA) === String(ie.ID_CAPITANA) ? ' <span class="u-chip">Capitana</span>' : '') + (j.ESTADO === 'Baja' ? ' <span class="u-chip">Baja</span>' : '') + '</td><td class="num">' + texto(txt(j.DORSAL) ? 'Dorsal ' + txt(j.DORSAL) : 'Sin dorsal') + '</td></tr>';
          }).join('') + '</tbody></table>' : '<p class="u-vacio">Sin jugadoras inscritas.</p>') +
          (ie.ESTADO !== 'Baja' ? '<button type="button" class="u-btn" data-accion="inscribirAqui" data-id="' + texto(ie.ID) + '">Inscribir jugadora en este equipo</button>' : '');
        html += '<h3 class="n-grupo">El equipo</h3><div class="u-campos">' +
          campo('Nombre actual (todas las temporadas)', '<input type="text" id="q-NOMBRE" value="' + texto(e.NOMBRE) + '" maxlength="80">') +
          campo('Tipo', '<select id="q-TIPO">' + opciones([['Liga', 'Liga'], ['Kopa di Mondo', 'Kopa di Mondo']], e.TIPO) + '</select>') +
          campo('Notas del equipo', '<textarea id="q-NOTAS" rows="2">' + texto(e.NOTAS) + '</textarea>', 'u-ancho') +
          '</div><div class="n-botones"><button type="button" class="u-btn" id="q-guardar">Guardar el equipo</button></div>' +
          '<dl class="ges-datos">' + dato('Alta', fecha(e.FECHA_ALTA)) + dato('ID', texto(e.ID)) + '</dl>';
        if (otras.length) html += '<p class="u-nota">Otras inscripciones:</p><table class="u-tabla eco-tabla"><tbody>' + otras.map(function (x) {
          var c = ix.com[x.ID_COMPETICION] || {};
          return '<tr tabindex="0" data-ie="' + texto(x.ID) + '"><td class="u-tabla-t">' + texto(x.NOMBRE_EQUIPO) + '<div class="u-nota">' + texto([nom('tem', c.ID_TEMPORADA) || c.ID_TEMPORADA, nomComp(x.ID_COMPETICION), x.ESTADO].filter(Boolean).join(' · ')) + '</div></td></tr>';
        }).join('') + '</tbody></table>';
        html += '<h3 class="n-grupo">Inscripción</h3><dl class="ges-datos">' + dato('Fecha', fecha(ie.FECHA_INSCRIPCION)) + dato('Origen', texto(ie.ORIGEN)) +
          (ie.ID_INSCRIPCION_ORIGEN ? dato('Viene de', texto(nomIe(ie.ID_INSCRIPCION_ORIGEN)) + ' (' + texto(ie.ID_INSCRIPCION_ORIGEN) + ')') : '') +
          dato('Experiencia', texto(ie.EXPERIENCIA)) + dato('Disponibilidad', texto(ie.DISPONIBILIDAD)) + dato('Horario preferido', texto(ie.PREFERENCIA_HORARIA)) + dato('Comentarios', texto(ie.COMENTARIOS)) + '</dl>';
        ventana(html, function () {
          vent.querySelector('#e-guardar').onclick = function () {
            var nv = { NOMBRE_EQUIPO: val('e-NOMBRE_EQUIPO'), ESTADO: val('e-ESTADO'), ID_LIGA: val('e-ID_LIGA'), NIVEL: val('e-NIVEL'), ID_COLOR: val('e-ID_COLOR'),
              ID_RESPONSABLE: val('e-ID_RESPONSABLE'), ID_CAPITANA: val('e-ID_CAPITANA'), MENSAJE_INICIAL_ENVIADO: val('e-MENSAJE_INICIAL_ENVIADO'),
              GRUPO_CREADO: val('e-GRUPO_CREADO'), EN_XPORTY: val('e-EN_XPORTY'), NOTAS: val('e-NOTAS') };
            var mal = [];
            if (!nv.NOMBRE_EQUIPO) mal.push('Falta el nombre de este año.');
            if (mal.length) { verError(mal); return; }
            var c = cambios(ie, nv);
            cerrar();
            guardar('INSCRIPCIONES_EQUIPOS', ie, c, 'Cambios del equipo');
          };
          vent.querySelector('#q-guardar').onclick = function () {
            if (!e.ID) return;
            var nv = { NOMBRE: val('q-NOMBRE'), TIPO: val('q-TIPO'), NOTAS: val('q-NOTAS') };
            if (!nv.NOMBRE) { verError(['Falta el nombre del equipo.']); return; }
            var c = cambios(e, nv);
            cerrar();
            guardar('EQUIPOS', e, c, 'Datos del equipo');
          };
        });
      }

      /** Ficha de una jugadora: su inscripción de ahora (si se abre desde una), sus datos personales y todas sus temporadas. */
      function fichaJugadora(idJug, ij) {
        var p = ix.jug[String(idJug)];
        if (!p) { ctx.aviso('No tengo la jugadora ' + idJug + ': actualiza la página.'); return; }
        // Todas sus inscripciones: la parte de esta jugadora (al momento si ya se vio; si no, llega y se vuelve a pintar).
        var o = {}; o[IJ] = { clave: 'J:' + p.ID, col: 'ID_JUGADORA', valores: [p.ID] };
        var pintada = false;
        T.leer([IJ], { partes: o }).then(function () { if (pintada && velo.classList.contains('abierto') && vent.getAttribute('data-jug') === String(p.ID)) historial(); }, function () {});
        var ie = ij ? ix.ie[ij.ID_INSCRIPCION_EQUIPO] || {} : null, av = ij ? avisosJugadora(d, ij, cx) : [];
        var html = '<h2 id="ges-vt">' + texto(nombreJug(p)) + '</h2><p class="u-nota">' + texto(p.ID) + (edad(p.FECHA_NACIMIENTO) !== '' ? ' · ' + edad(p.FECHA_NACIMIENTO) + ' años' : '') + chips(av) + '</p>';
        if (ij) {
          html += '<h3 class="n-grupo">' + punto(ie.ID_COLOR) + texto(nomIe(ij.ID_INSCRIPCION_EQUIPO)) + ' · ' + texto(nomComp(ie.ID_COMPETICION)) + '</h3><div class="u-campos">' +
            campo('Dorsal', '<input type="text" id="i-DORSAL" value="' + texto(ij.DORSAL) + '" maxlength="4" inputmode="numeric">') +
            campo('Estado', '<select id="i-ESTADO">' + opciones([['Activa', 'Activa'], ['Baja', 'Baja']], ij.ESTADO) + '</select>') +
            '<div class="u-ancho ges-checks">' + casilla('i-EN_XPORTY', 'En Xporty', ij.EN_XPORTY) + casilla('i-EN_CONTACTOS_GOOGLE', 'En Contactos de Google', ij.EN_CONTACTOS_GOOGLE) + '</div>' +
            '</div><p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="i-guardar">Guardar</button><button type="button" class="u-btn" data-cerrar>Cerrar</button>' +
            (ie.ID ? '<button type="button" class="u-btn u-btn-texto" data-ie="' + texto(ie.ID) + '">Ver el equipo</button>' : '') + '</div>' +
            '<dl class="ges-datos">' + dato('Inscrita', fecha(ij.FECHA_INSCRIPCION)) + dato('Origen', texto(ij.ORIGEN)) +
            dato('Acepta', ['ACEPTA_NORMAS', 'ACEPTA_DERECHOS_IMAGEN', 'ACEPTA_DATOS', 'ACEPTA_RESPONSABILIDAD'].map(function (c) {
              return { ACEPTA_NORMAS: 'normas', ACEPTA_DERECHOS_IMAGEN: 'fotos', ACEPTA_DATOS: 'datos', ACEPTA_RESPONSABILIDAD: 'responsabilidad' }[c] + (ij[c] === true ? ' sí' : ' no');
            }).join(' · ')) + dato('Cómo nos conoció', texto(ij.COMO_NOS_CONOCIO)) + '</dl>';
        }
        html += '<h3 class="n-grupo">Datos personales</h3><div class="u-campos">' +
          campo('Nombre', '<input type="text" id="p-NOMBRE" value="' + texto(p.NOMBRE) + '" maxlength="60">') +
          campo('Primer apellido', '<input type="text" id="p-APELLIDO_1" value="' + texto(p.APELLIDO_1) + '" maxlength="60">') +
          campo('Segundo apellido', '<input type="text" id="p-APELLIDO_2" value="' + texto(p.APELLIDO_2) + '" maxlength="60">') +
          campo('Fecha de nacimiento', '<input type="date" id="p-FECHA_NACIMIENTO" value="' + texto(p.FECHA_NACIMIENTO) + '">') +
          campo('Teléfono', '<input type="tel" id="p-TELEFONO" value="' + texto(p.TELEFONO) + '" maxlength="20">') +
          campo('Correo', '<input type="email" id="p-EMAIL" value="' + texto(p.EMAIL) + '" maxlength="100">') +
          campo('Documento', '<select id="p-TIPO_DOCUMENTO">' + opciones([['DNI', 'DNI'], ['NIE', 'NIE'], ['Pasaporte', 'Pasaporte'], ['Otro', 'Otro']], p.TIPO_DOCUMENTO, '—') + '</select>') +
          campo('Número', '<input type="text" id="p-NUM_DOCUMENTO" value="' + texto(p.NUM_DOCUMENTO) + '" maxlength="20">') +
          campo('Instagram', '<input type="text" id="p-INSTAGRAM" value="' + texto(p.INSTAGRAM) + '" maxlength="40" placeholder="usuario, sin @">') +
          campo('Notas', '<textarea id="p-NOTAS" rows="2">' + texto(p.NOTAS) + '</textarea>', 'u-ancho') +
          '</div><p class="u-error ges-err-p" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn' + (ij ? '' : ' u-btn-accion') + '" id="p-guardar">Guardar sus datos</button>' +
          (ij ? '' : '<button type="button" class="u-btn" data-cerrar>Cerrar</button>') + '</div>' +
          '<p class="u-nota">Datos personales: solo para gestionar la liga. Alta: ' + fecha(p.FECHA_ALTA) + '.</p>' +
          '<h3 class="n-grupo">Sus temporadas</h3><div id="ges-hist"></div>' +
          '<button type="button" class="u-btn" data-accion="inscribirJug" data-id="' + texto(p.ID) + '">Inscribirla en un equipo</button>';
        var fts = d.fot.filter(function (f) { return String(f.ID_JUGADORA) === String(p.ID); });
        if (fts.length) html += '<h3 class="n-grupo">Fotos <span class="u-chip">' + fts.length + '</span></h3><table class="u-tabla eco-tabla"><tbody>' + fts.map(function (f) {
          return '<tr tabindex="0" data-foto="' + texto(f.ID) + '"><td class="u-tabla-t">' + texto(f.NOMBRE_ORIGINAL || f.ID) + '<div class="u-nota">' + fecha(f.FECHA) + ' · ' + (f.PUBLICABLE === true ? 'publicable' : 'no publicable') + '</div></td></tr>';
        }).join('') + '</tbody></table>';
        function historial() {
          var h = vent.querySelector('#ges-hist'); if (!h) return;
          var xs = T.filas(IJ).filter(function (x) { return String(x.ID_JUGADORA) === String(p.ID); }).map(function (x) {
            var e = ix.ie[x.ID_INSCRIPCION_EQUIPO] || {}, c = ix.com[e.ID_COMPETICION] || {};
            return { x: x, e: e, c: c, t: ix.tem[c.ID_TEMPORADA] || {} };
          }).sort(function (a, b) { return String(b.x.FECHA_INSCRIPCION) < String(a.x.FECHA_INSCRIPCION) ? -1 : 1; });
          var tiene = T.tiene ? T.tiene(IJ, o[IJ]) : true;
          h.innerHTML = xs.length ? '<table class="u-tabla eco-tabla"><tbody>' + xs.map(function (y) {
            return '<tr tabindex="0" data-ij="' + texto(y.x.ID) + '"><td class="u-tabla-t">' + punto(y.e.ID_COLOR) + texto(y.e.NOMBRE_EQUIPO || y.x.ID_INSCRIPCION_EQUIPO) + (y.x.ESTADO === 'Baja' ? ' <span class="u-chip">Baja</span>' : '') +
              '<div class="u-nota">' + texto([y.t.NOMBRE, txt(y.c.NOMBRE_COMERCIAL || y.c.NOMBRE), txt(y.x.DORSAL) ? 'dorsal ' + txt(y.x.DORSAL) : ''].filter(Boolean).join(' · ')) + '</div></td></tr>';
          }).join('') + '</tbody></table>' + (tiene ? '' : '<p class="u-nota">Cargando el resto…</p>') : '<p class="u-vacio">' + (tiene ? 'Sin inscripciones.' : 'Cargando…') + '</p>';
        }
        ventana(html, function () {
          vent.setAttribute('data-jug', String(p.ID));
          pintada = true;
          historial();
          var gi = vent.querySelector('#i-guardar');
          if (gi) gi.onclick = function () {
            var nv = { DORSAL: val('i-DORSAL'), ESTADO: val('i-ESTADO'), EN_XPORTY: val('i-EN_XPORTY'), EN_CONTACTOS_GOOGLE: val('i-EN_CONTACTOS_GOOGLE') };
            var mal = [];
            if (nv.DORSAL && !/^\d{1,3}$/.test(nv.DORSAL)) mal.push('El dorsal es un número.');
            var otra = nv.DORSAL && nv.ESTADO !== 'Baja' && d.ij.filter(function (x) { return x !== ij && String(x.ID_INSCRIPCION_EQUIPO) === String(ij.ID_INSCRIPCION_EQUIPO) && x.ESTADO !== 'Baja' && txt(x.DORSAL) === nv.DORSAL; })[0];
            if (otra) mal.push('El ' + nv.DORSAL + ' ya lo lleva ' + (nombreJug(ix.jug[otra.ID_JUGADORA]) || otra.ID_JUGADORA) + ' en este equipo.');
            if (mal.length) { verError(mal); return; }
            var c = cambios(ij, nv);
            cerrar();
            if (!Object.keys(c).length) return;
            // El dorsal va por su función, que mira dentro del motor que nadie lo lleve ya; lo demás, directo.
            var dorsal = 'DORSAL' in c ? { DORSAL: c.DORSAL } : null;
            delete c.DORSAL;
            var ps = [];
            if (dorsal) ps.push(T.actualizar(IJ, ij.ID, dorsal, { fn: 'gestion5Dorsal', args: [ij.ID, dorsal.DORSAL] }));
            if (Object.keys(c).length) ps.push(T.actualizar(IJ, ij.ID, c));
            Promise.all(ps).then(function () { if (ctx.abierta()) ctx.aviso('Inscripción guardada en el Excel.'); }, function () {});
          };
          vent.querySelector('#p-guardar').onclick = function () {
            var nv = {};
            ['NOMBRE', 'APELLIDO_1', 'APELLIDO_2', 'FECHA_NACIMIENTO', 'TELEFONO', 'EMAIL', 'TIPO_DOCUMENTO', 'NUM_DOCUMENTO', 'INSTAGRAM', 'NOTAS'].forEach(function (k) { nv[k] = val('p-' + k); });
            nv.NUM_DOCUMENTO = nv.NUM_DOCUMENTO.toUpperCase().replace(/[\s-]/g, '');
            var mal = problemasJugadora(nv, d.jug, p.ID);
            if (mal.length) { var e = vent.querySelector('.ges-err-p'); e.textContent = mal.join(' '); e.hidden = false; return; }
            var c = cambios(p, nv);
            cerrar();
            guardar('JUGADORAS', p, c, 'Datos de la jugadora');
          };
        });
      }

      /** Inscribir un equipo en una competición de la temporada: uno que ya existe (de otros años) o uno nuevo. */
      function formInscribirEquipo() {
        var cs = compsDe(d, tem.ID).map(function (c) { return [c.ID, txt(c.NOMBRE_COMERCIAL || c.NOMBRE)]; });
        if (!cs.length) { ctx.aviso('Esta temporada no tiene competiciones: añádelas en el Excel COMPETICION.'); return; }
        var eqs = d.eqs.slice().sort(function (a, b) { return txt(a.NOMBRE).localeCompare(txt(b.NOMBRE), 'es'); }).map(function (e) { return [e.ID, txt(e.NOMBRE) + ' · ' + e.ID]; });
        var html = '<h2 id="ges-vt">Inscribir equipo · ' + texto(tem.NOMBRE) + '</h2><div class="u-campos">' +
          campo('Competición', '<select id="n-ID_COMPETICION">' + opciones(cs, S.comp || cs[0][0]) + '</select>', 'u-ancho') +
          campo('Equipo', '<input type="search" id="n-buscar" placeholder="Busca por nombre…"><select id="n-ID_EQUIPO">' + opciones([['+', '+ Equipo nuevo']].concat(eqs), '', 'Elige el equipo') + '</select>', 'u-ancho') +
          campo('Nombre del equipo nuevo', '<input type="text" id="n-NOMBRE" maxlength="80">', 'ges-nuevo') +
          campo('Tipo', '<select id="n-TIPO">' + opciones([['Liga', 'Liga'], ['Kopa di Mondo', 'Kopa di Mondo']], 'Liga') + '</select>', 'ges-nuevo') +
          campo('Nombre este año', '<input type="text" id="n-NOMBRE_EQUIPO" maxlength="80" placeholder="El del equipo, si no se dice otro">') +
          campo('Estado', '<select id="n-ESTADO">' + opciones([['Solicitada', 'Solicitada'], ['Confirmada', 'Confirmada']], 'Solicitada') + '</select>') +
          campo('Liga', '<select id="n-ID_LIGA"></select>') +
          campo('Nivel', '<select id="n-NIVEL">' + opciones(['1', '2', '3', '4', '5'].map(function (n) { return [n, n]; }), '', '—') + '</select>') +
          '</div><p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="n-guardar">Inscribir</button><button type="button" class="u-btn" data-cerrar>Cancelar</button></div>';
        ventana(html, function () {
          var sel = vent.querySelector('#n-ID_EQUIPO');
          function refrescar() {
            var nuevo = sel.value === '+';
            [].forEach.call(vent.querySelectorAll('.ges-nuevo'), function (x) { x.hidden = !nuevo; });
            var sl = vent.querySelector('#n-ID_LIGA'), l = sl.value;
            sl.innerHTML = opciones(ligasDe(val('n-ID_COMPETICION')), l, 'Sin liga todavía');
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
        var html = '<h2 id="ges-vt">Inscribir jugadora · ' + texto(tem.NOMBRE) + '</h2><div class="u-campos">' +
          campo('Equipo', '<select id="j-ID_INSCRIPCION_EQUIPO">' + opciones(eqs, idIe || S.ju.equipo || '', 'Elige el equipo') + '</select>', 'u-ancho') +
          campo('Jugadora', '<input type="search" id="j-buscar" placeholder="Nombre, teléfono o DNI" value="' + texto(elegida ? nombreJug(elegida) : '') + '">', 'u-ancho') +
          '<div class="u-ancho" id="j-lista"></div>' +
          campo('Nombre', '<input type="text" id="j-NOMBRE" maxlength="60">', 'ges-nueva') +
          campo('Primer apellido', '<input type="text" id="j-APELLIDO_1" maxlength="60">', 'ges-nueva') +
          campo('Segundo apellido', '<input type="text" id="j-APELLIDO_2" maxlength="60">', 'ges-nueva') +
          campo('Teléfono', '<input type="tel" id="j-TELEFONO" maxlength="20">', 'ges-nueva') +
          campo('Fecha de nacimiento', '<input type="date" id="j-FECHA_NACIMIENTO">', 'ges-nueva') +
          campo('Correo', '<input type="email" id="j-EMAIL" maxlength="100">', 'ges-nueva') +
          campo('Dorsal', '<input type="text" id="j-DORSAL" maxlength="4" inputmode="numeric">') +
          '</div><p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="j-guardar">Inscribir</button><button type="button" class="u-btn" data-cerrar>Cancelar</button></div>';
        var sel = elegida ? elegida.ID : '', nueva = false;
        ventana(html, function () {
          var lista = vent.querySelector('#j-lista');
          function pintarLista() {
            [].forEach.call(vent.querySelectorAll('.ges-nueva'), function (x) { x.hidden = !nueva; });
            if (nueva) { lista.innerHTML = '<p class="u-nota">Jugadora nueva. <button type="button" class="u-btn u-btn-texto" data-j="">Buscar entre las que ya hay</button></p>'; return; }
            if (sel) { lista.innerHTML = '<p class="u-nota">Elegida: <b>' + texto(nombreJug(ix.jug[sel])) + '</b> (' + texto(sel) + ', ' + texto((ix.jug[sel] || {}).TELEFONO) + '). <button type="button" class="u-btn u-btn-texto" data-j="">Cambiar</button></p>'; return; }
            var q = val('j-buscar'), xs = q.length >= 2 ? buscarJugadoras(d.jug, q, 8) : [];
            lista.innerHTML = (xs.length ? '<table class="u-tabla eco-tabla"><tbody>' + xs.map(function (p) {
              return '<tr tabindex="0" data-j="' + texto(p.ID) + '"><td class="u-tabla-t">' + texto(nombreJug(p)) + '<div class="u-nota">' + texto([p.ID, p.TELEFONO, edad(p.FECHA_NACIMIENTO) !== '' ? edad(p.FECHA_NACIMIENTO) + ' años' : ''].filter(Boolean).join(' · ')) + '</div></td></tr>';
            }).join('') + '</tbody></table>' : (q.length >= 2 ? '<p class="u-nota">Ninguna jugadora encaja.</p>' : '')) +
              '<button type="button" class="u-btn" data-j="+">+ Jugadora nueva</button>';
          }
          pintarLista();
          vent.querySelector('#j-buscar').addEventListener('input', function () { sel = ''; nueva = false; pintarLista(); });
          lista.addEventListener('click', function (e) {
            var b = e.target.closest('[data-j]'); if (!b) return;
            var j = b.getAttribute('data-j');
            if (j === '+') { nueva = true; sel = ''; var q = val('j-buscar').split(/\s+/); if (!/\d/.test(q[0] || '')) { vent.querySelector('#j-NOMBRE').value = q[0] || ''; vent.querySelector('#j-APELLIDO_1').value = q[1] || ''; vent.querySelector('#j-APELLIDO_2').value = q.slice(2).join(' '); } }
            else { nueva = false; sel = j; }
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
        var html = '<h2 id="ges-vt">' + texto(f.NOMBRE_ORIGINAL || f.ID) + '</h2><p class="u-nota">' + fecha(f.FECHA) + ' · ' + texto(f.ESTADO) + '</p>' +
          '<div class="ges-foto" id="f-vista"><div class="u-carga"></div></div>' +
          '<div class="u-campos"><label class="u-campo u-ancho"><span class="u-etiqueta">Jugadora</span><input type="search" id="f-buscar" placeholder="Busca por nombre o teléfono" value="' + texto(nombreJug(pj)) + '"></label>' +
          '<div class="u-ancho" id="f-lista"></div>' +
          campo('Equipo con el que salió', '<select id="f-ID_INSCRIPCION_EQUIPO"></select>', 'u-ancho') +
          '<div class="u-ancho">' + casilla('f-PUBLICABLE', 'Se puede publicar', f.PUBLICABLE) + '<p class="u-nota" id="f-nota"></p></div>' +
          '</div><p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="f-guardar">Guardar</button><button type="button" class="u-btn" data-cerrar>Cerrar</button>' +
          (f.ARCHIVO_URL ? '<a class="u-btn u-btn-texto" href="' + texto(f.ARCHIVO_URL) + '" target="_blank" rel="noopener">Abrir en Drive</a>' : '') + '</div>';
        var sel = f.ID_JUGADORA ? String(f.ID_JUGADORA) : '';
        ventana(html, function () {
          var lista = vent.querySelector('#f-lista'), pub = vent.querySelector('#f-PUBLICABLE');
          function pintarLista() {
            if (sel) lista.innerHTML = '<p class="u-nota">Vinculada a <b>' + texto(nombreJug(ix.jug[sel])) + '</b> (' + texto(sel) + '). <button type="button" class="u-btn u-btn-texto" data-j="">Quitar</button></p>';
            else {
              var q = val('f-buscar'), xs = q.length >= 2 ? buscarJugadoras(d.jug, q, 8) : [];
              lista.innerHTML = xs.length ? '<table class="u-tabla eco-tabla"><tbody>' + xs.map(function (p) { return '<tr tabindex="0" data-j="' + texto(p.ID) + '"><td class="u-tabla-t">' + texto(nombreJug(p)) + '<div class="u-nota">' + texto([p.ID, p.TELEFONO].filter(Boolean).join(' · ')) + '</div></td></tr>'; }).join('') + '</tbody></table>' :
                '<p class="u-nota">' + (q.length >= 2 ? 'Ninguna jugadora encaja.' : 'Sin vincular: busca a la jugadora de la foto.') + '</p>';
            }
            var se = vent.querySelector('#f-ID_INSCRIPCION_EQUIPO'), ev = se.value || f.ID_INSCRIPCION_EQUIPO;
            se.innerHTML = opciones(sel ? eqsJug(sel) : [], ev, sel ? 'Sin equipo' : 'Elige antes la jugadora');
            var ok = sel && acepta(sel);
            pub.disabled = !ok; if (!ok) pub.checked = false;
            vent.querySelector('#f-nota').textContent = !sel ? 'Solo se publica una foto vinculada.' : ok ? 'Ha aceptado que se publiquen sus fotos.' : 'No consta que acepte que se publiquen sus fotos: no se puede marcar.';
          }
          pintarLista();
          vent.querySelector('#f-buscar').addEventListener('input', function () { sel = ''; pintarLista(); });
          lista.addEventListener('click', function (e) { var b = e.target.closest('[data-j]'); if (!b) return; sel = b.getAttribute('data-j'); if (!sel) vent.querySelector('#f-buscar').value = ''; pintarLista(); });
          if (f.ARCHIVO_URL) ctx.llamar('gestion5Archivo', [f.ARCHIVO_URL]).then(function (r) {
            var v = vent.querySelector('#f-vista'); if (!v) return;
            v.innerHTML = r && r.img ? '<img src="' + texto(r.img) + '" alt="' + texto(f.NOMBRE_ORIGINAL) + '">' : '<p class="u-nota">No se puede ver aquí: ábrela en Drive.</p>';
          }, function () { var v = vent.querySelector('#f-vista'); if (v) v.innerHTML = '<p class="u-nota">No se ha podido cargar: ábrela en Drive.</p>'; });
          else vent.querySelector('#f-vista').innerHTML = '';
          vent.querySelector('#f-guardar').onclick = function () {
            var nv = { ID_JUGADORA: sel, ID_INSCRIPCION_EQUIPO: sel ? val('f-ID_INSCRIPCION_EQUIPO') : '', ESTADO: sel ? 'Vinculada' : 'Sin vincular', PUBLICABLE: !!(sel && pub.checked) };
            var c = cambios(f, nv);
            cerrar();
            guardar('FOTOS', f, c, 'Cambios de la foto');
          };
        });
      }

      /** Una revisión: el caso, sus candidatos (se abren) y marcarla resuelta o volver a abrirla. */
      function fichaRevision(r) {
        var cand = ids(r.ID_REGISTRO + ' ' + r.CANDIDATOS);
        var html = '<h2 id="ges-vt">' + texto(r.TIPO) + ' · ' + texto(r.ID) + '</h2><dl class="ges-datos">' + dato('Registro', texto(r.ID_REGISTRO)) + dato('Candidatos', texto(r.CANDIDATOS)) +
          dato('Motivo', texto(r.MOTIVO)) + dato('Detectado', fecha(r.FECHA)) + '</dl>' +
          (cand.length ? '<p class="u-nota">Ver:</p><div class="n-botones">' + cand.map(function (c) {
            var t = ix.jug[c] ? nombreJug(ix.jug[c]) : ix.ie[c] ? nomIe(c) : ix.eqs[c] ? nom('eqs', c) : '';
            return t ? '<button type="button" class="u-btn" data-abrir="' + texto(c) + '">' + texto(t) + ' · ' + texto(c) + '</button>' : '';
          }).join('') + '</div>' : '') +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="r-ok">' + (r.RESUELTO === true ? 'Volver a abrirla' : 'Marcar resuelta') + '</button><button type="button" class="u-btn" data-cerrar>Cerrar</button></div>';
        ventana(html, function () {
          vent.querySelector('#r-ok').onclick = function () { cerrar(); guardar('REVISIONES', r, { RESUELTO: r.RESUELTO !== true }, 'Revisión'); };
          [].forEach.call(vent.querySelectorAll('[data-abrir]'), function (b) {
            b.onclick = function () { var c = b.getAttribute('data-abrir'); cerrar(); if (ix.jug[c]) fichaJugadora(c); else if (ix.ie[c]) fichaEquipo(ix.ie[c]); };
          });
        });
      }

      /* ---------- eventos ---------- */

      function irA(tab) { S.tab = tab; guardado(CLAVE + 'tab', tab); pintar(); window.scrollTo(0, 0); }
      function abrirFila(t) {
        var tr = t.closest('[data-ie], [data-ij], [data-jug], [data-foto], [data-rev]');
        if (!tr) return false;
        if (tr.hasAttribute('data-ie')) { var ie = ix.ie[tr.getAttribute('data-ie')]; if (ie && !ie._nueva) { cerrar(); fichaEquipo(ie); } }
        else if (tr.hasAttribute('data-ij')) { var ij = T.fila(IJ, tr.getAttribute('data-ij')); if (ij && !ij._nueva) { cerrar(); fichaJugadora(ij.ID_JUGADORA, ij); } }
        else if (tr.hasAttribute('data-jug')) { cerrar(); fichaJugadora(tr.getAttribute('data-jug')); }
        else if (tr.hasAttribute('data-foto')) { var f = T.fila('FOTOS', tr.getAttribute('data-foto')); if (f && !f._nueva) { cerrar(); fichaFoto(f); } }
        else if (tr.hasAttribute('data-rev')) { var r = T.fila('REVISIONES', tr.getAttribute('data-rev')); if (r) { cerrar(); fichaRevision(r); } }
        return true;
      }
      el.addEventListener('click', function (e) {
        var t = e.target;
        var b = t.closest('[data-tab]'); if (b) { irA(b.getAttribute('data-tab')); return; }
        if (t.closest('[data-cerrar]')) { cerrar(); return; }
        var a = t.closest('[data-accion]');
        if (a) {
          var ac = a.getAttribute('data-accion');
          if (ac === 'inscribirEquipo') formInscribirEquipo();
          else if (ac === 'inscribirJugadora') formInscribirJugadora('');
          else if (ac === 'inscribirAqui') { var id = a.getAttribute('data-id'); cerrar(); formInscribirJugadora(id); }
          else if (ac === 'inscribirJug') { var j = a.getAttribute('data-id'); cerrar(); formInscribirJugadora('', j); }
          else if (ac === 'vermas') { S.ju.n += VER; pintar(); }
          else if (ac === 'todasRev') { S.rv.todas = !S.rv.todas; pintar(); }
          return;
        }
        if (vent.contains(t) && t.closest('#j-lista, #f-lista')) return;
        if (abrirFila(t)) return;
        var tr = t.closest('tr[data-ir]');
        if (tr && pest.indexOf(tr.getAttribute('data-ir')) >= 0) { if (tr.getAttribute('data-ver') === 'pago') S.eq.ver = 'pago'; irA(tr.getAttribute('data-ir')); }
      });
      el.addEventListener('toggle', function (e) {
        var x = e.target; if (!x.hasAttribute || !x.hasAttribute('data-liga')) return;
        S.abiertas = S.abiertas || {}; S.abiertas[x.getAttribute('data-liga')] = x.open;
      }, true);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && velo.classList.contains('abierto')) { cerrar(); return; }
        var tr = e.target.closest && e.target.closest('tr[tabindex]');
        if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tr.click(); }
      });
      velo.addEventListener('click', function (e) { if (e.target === velo) cerrar(); });
      el.addEventListener('change', function (e) {
        var t = e.target;
        if (t === selTem) { S.tem = t.value; guardado(CLAVE + 'tem', t.value); S.comp = ''; S.liga = ''; S.ju.equipo = ''; S.ju.n = VER; S.leyendo = ''; pintar(); return; }
        var f = t.getAttribute && t.getAttribute('data-f');
        if (!f) return;
        if (f === 'comp') { S.comp = t.value; S.liga = ''; }
        else if (f === 'liga') S.liga = t.value;
        else if (f === 'eqver') S.eq.ver = t.value;
        else if (f === 'juequipo') S.ju.equipo = t.value;
        else if (f === 'juver') S.ju.ver = t.value;
        else if (f === 'foestado') S.fo.estado = t.value;
        S.ju.n = VER;
        pintar();
      });
      var tq = 0;
      el.addEventListener('input', function (e) {
        var k = e.target.getAttribute && e.target.getAttribute('data-q');
        if (!k) return;
        S[k].q = e.target.value; clearTimeout(tq);
        tq = setTimeout(function () { S.ju.n = VER; S.foco = true; pintar(); }, 200);
      });

      ctx.alCambiar(function (t) { if (tablas.indexOf(t) >= 0 || t === IJ) { if (t === 'INSCRIPCIONES_EQUIPOS') S.leyendo = ''; pintar(); } });
      ctx.tablas.leer(tablas).then(function () { S.leido = true; pintar(); }, function (e) {
        cont.innerHTML = '<p class="u-error">No se han podido leer los equipos.</p><p class="u-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Vuelve a abrir la sección para probar otra vez.</p>';
      });
      this._cerrar = cerrar;
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); }
  });
})();
