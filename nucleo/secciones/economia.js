/*
 * Sección Economía base del núcleo · UTILO_CORE 5.0 (T0257) · motor/modulos/economia de utilo-apps
 *
 * Igual para todos los negocios: lo que falta por cobrar y pagar, el resultado y el IVA del periodo, el saldo de cada
 * cuenta, los movimientos, las facturas y el presupuesto por categoría. Lee y escribe el Excel ECONOMIA con las tablas
 * al momento (ctx.tablas): todo se pinta de lo guardado en el dispositivo y cada cambio se ve al tocar «Guardar»; el
 * Excel se escribe por detrás y, si el motor dice que no, vuelve a como estaba y avisa.
 * Los totales y el IVA se calculan aquí, en el navegador (CALC, más abajo), en céntimos: no hay fórmulas en el Excel.
 * Solo el alta de una factura emitida pasa por el motor (economiaEmitir), que le pone el número correlativo.
 *
 * Personalización (config.json · nucleo.secciones.economia.config, declarada en su modulo.json):
 *   PERIODO / NOMBRE_PERIODO   columna de MOVIMIENTOS que da el periodo (p. ej. ID_TEMPORADA) y cómo se llama; vacía, el año
 *   DESGLOSE / NOMBRE_DESGLOSE columna por la que se desglosa el resultado (p. ej. ID_COMPETICION)
 *   PIDE_CONTRAPARTE           Sí: un ingreso o un gasto necesita contraparte
 *   SERIE_EMITIDAS             lo que va delante del número de las facturas emitidas (lo usa el motor)
 *   PESTANAS, AYUDA            pestañas que se ven y texto de ayuda
 *   _refs                      (lo pone montar.js) la tabla a la que apunta PERIODO y DESGLOSE, para sus nombres
 * Las cuentas, categorías y contrapartes son filas del Excel de cada negocio.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  /** Importe → céntimos (acepta número, «1.234,56», «1234.56» o «12 €»). */
  function cts(v) {
    var n = typeof v === 'number' ? v : Number(String(v == null ? '' : v).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return isFinite(n) ? Math.round(n * 100) : 0;
  }
  /** «21%» → 21. */
  function pct(t) { var n = parseFloat(String(t == null ? '' : t).replace(',', '.')); return isFinite(n) ? n : 0; }
  /** Base, cuota de IVA y total de una fila (BASE, TIPO_IVA), en céntimos. La cuota se redondea al céntimo. */
  function importe(f) { var b = cts(f.BASE), i = Math.round(b * pct(f.TIPO_IVA) / 100); return { base: b, iva: i, total: b + i }; }
  function suma(a, b) { return { base: a.base + b.base, iva: a.iva + b.iva, total: a.total + b.total }; }
  function cero() { return { base: 0, iva: 0, total: 0 }; }
  /** Céntimos → «1.250,00 €» (y «−» delante si es negativo). */
  function eur(c) {
    c = Math.round(c || 0);
    var s = c < 0 ? '−' : '', a = Math.abs(c), e = Math.floor(a / 100), d = a % 100;
    return s + String(e).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + (d < 10 ? '0' : '') + d + ' €';
  }
  /** 'aaaa-mm-dd' → 'dd/mm/aaaa'. */
  function fecha(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(s || ''); }
  function hoy() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function indice(filas) { var o = {}; (filas || []).forEach(function (f) { o[String(f.ID)] = f; }); return o; }

  /**
   * Los periodos que se pueden elegir, del más reciente al más antiguo: [{ id, nombre, desde, hasta }].
   * Con PERIODO, las filas de su tabla (NOMBRE y, si las tiene, FECHA_INICIO y FECHA_FIN); sin él, los años con movimientos.
   */
  function periodos(d) {
    var P = d.cfg.PERIODO;
    if (P) {
      return d.per.map(function (r) {
        return { id: String(r.ID), nombre: String(r.NOMBRE || r.ID), desde: String(r.FECHA_INICIO || ''), hasta: String(r.FECHA_FIN || '') };
      }).sort(function (a, b) { return (b.desde || b.id) < (a.desde || a.id) ? -1 : (b.desde || b.id) > (a.desde || a.id) ? 1 : 0; });
    }
    var anos = {}; anos[hoy().slice(0, 4)] = 1;
    d.mov.forEach(function (m) { var y = String(m.FECHA || '').slice(0, 4); if (/^\d{4}$/.test(y)) anos[y] = 1; });
    return Object.keys(anos).sort().reverse().map(function (y) { return { id: y, nombre: y, desde: y + '-01-01', hasta: y + '-12-31' }; });
  }
  /** El periodo de hoy; si ninguno lo es, el del último movimiento; si no, el primero. */
  function periodoActual(d, lista) {
    var h = hoy(), P = d.cfg.PERIODO;
    var de = lista.filter(function (p) { return p.desde && p.hasta && p.desde <= h && h <= p.hasta; })[0];
    if (de) return de;
    if (P) {
      var ult = d.mov.reduce(function (a, m) { return String(m.FECHA || '') > String(a.FECHA || '') ? m : a; }, {});
      var p = lista.filter(function (x) { return x.id === String(ult[P] || ''); })[0];
      if (p) return p;
    }
    return lista[0] || null;
  }
  function movDe(d, p) {
    var P = d.cfg.PERIODO;
    if (!p) return [];
    return d.mov.filter(function (m) { return P ? String(m[P] || '') === p.id : String(m.FECHA || '').slice(0, 4) === p.id; });
  }
  /** Facturas del periodo: por su fecha si el periodo tiene fechas; si no, las de sus movimientos. */
  function facDe(d, p) {
    if (!p) return [];
    if (p.desde && p.hasta) return d.fac.filter(function (f) { var x = String(f.FECHA || ''); return x >= p.desde && x <= p.hasta; });
    var ids = {}; movDe(d, p).forEach(function (m) { if (m.ID_FACTURA) ids[m.ID_FACTURA] = 1; });
    return d.fac.filter(function (f) { return ids[f.ID]; });
  }
  /** ¿Va el presupuesto por periodo? Solo si hay PERIODO y PRESUPUESTOS tiene esa columna. */
  function presPorPeriodo(d) { return !!d.cfg.PERIODO && d.colsPre.indexOf(d.cfg.PERIODO) >= 0; }
  function preDe(d, p) {
    if (!presPorPeriodo(d)) return d.pre;
    return p ? d.pre.filter(function (r) { return String(r[d.cfg.PERIODO] || '') === p.id; }) : [];
  }

  /** Ingresos y gastos del periodo (base, IVA y total), resultado (base) e IVA a pagar (repercutido − soportado). */
  function resumen(d, p) {
    var ing = cero(), gas = cero(), n = 0;
    movDe(d, p).forEach(function (m) {
      if (m.TIPO === 'Ingreso') { ing = suma(ing, importe(m)); n++; } else if (m.TIPO === 'Gasto') { gas = suma(gas, importe(m)); n++; }
    });
    return { ingresos: ing, gastos: gas, resultado: ing.base - gas.base, iva: ing.iva - gas.iva, n: n };
  }

  /** Saldo de cada cuenta con todos los movimientos (el dinero que hay, con IVA): { ID_CUENTA: céntimos }. */
  function saldos(d) {
    var s = {};
    function mas(c, x) { if (c) s[c] = (s[c] || 0) + x; }
    d.mov.forEach(function (m) {
      var t = importe(m).total;
      if (m.TIPO === 'Ingreso') mas(m.ID_CUENTA, t);
      else if (m.TIPO === 'Gasto') mas(m.ID_CUENTA, -t);
      else if (m.TIPO === 'Interno') { mas(m.ID_CUENTA, -t); mas(m.ID_CUENTA_DESTINO, t); }
    });
    return s;
  }

  /** Lo pagado o cobrado de cada factura: la suma (con IVA) de los movimientos que la llevan. */
  function pagadoPorFactura(d) {
    var o = {};
    d.mov.forEach(function (m) { if (m.ID_FACTURA && m.TIPO !== 'Interno') o[m.ID_FACTURA] = (o[m.ID_FACTURA] || 0) + importe(m).total; });
    return o;
  }
  /**
   * Facturas Pendientes (de cualquier periodo), con lo que falta: [{ f, total, pagado, falta, cobrar }].
   * cobrar: es una emitida (falta cobrarla); si no, falta pagarla. La que tiene ESTADO vacío no cuenta.
   */
  function pendientes(d) {
    var pg = pagadoPorFactura(d);
    return d.fac.filter(function (f) { return f.ESTADO === 'Pendiente'; }).map(function (f) {
      var t = importe(f).total, p = pg[f.ID] || 0;
      return { f: f, total: t, pagado: p, falta: t - p, cobrar: f.TIPO === 'Emitida' };
    }).sort(function (a, b) { return String(a.f.FECHA) < String(b.f.FECHA) ? -1 : 1; });
  }
  /** Gastos del periodo sin factura ni ticket. */
  function sinFactura(d, p) { return movDe(d, p).filter(function (m) { return m.TIPO === 'Gasto' && !m.ID_FACTURA; }); }

  /**
   * Presupuesto del periodo por categoría: [{ cat, tipo, grupo, previsto, real, dif, filas }]. dif > 0 es bueno: en un
   * gasto, lo que queda; en un ingreso, lo que se ha ganado de más. En céntimos, sin IVA.
   */
  function presupuesto(d, p) {
    var real = {}, prev = {}, filas = {};
    movDe(d, p).forEach(function (m) { if (m.ID_CATEGORIA && m.TIPO !== 'Interno') real[m.ID_CATEGORIA] = (real[m.ID_CATEGORIA] || 0) + importe(m).base; });
    preDe(d, p).forEach(function (r) {
      var c = String(r.ID_CATEGORIA || '');
      prev[c] = (prev[c] || 0) + cts(r.IMPORTE);
      (filas[c] = filas[c] || []).push(r);
    });
    return d.cat.map(function (c) {
      var id = String(c.ID), pv = prev[id] || 0, rl = real[id] || 0;
      return { cat: c, tipo: c.TIPO, grupo: String(c.GRUPO || ''), previsto: pv, real: rl, dif: c.TIPO === 'Gasto' ? pv - rl : rl - pv, filas: filas[id] || [] };
    });
  }

  /** Resultado del periodo por DESGLOSE: [{ id, nombre, ingresos, gastos, resultado }] (base), o null sin desglose. */
  function desglose(d, p) {
    var D = d.cfg.DESGLOSE;
    if (!D) return null;
    var g = {}, orden = [], nom = indice(d.des);
    movDe(d, p).forEach(function (m) {
      if (m.TIPO !== 'Ingreso' && m.TIPO !== 'Gasto') return;
      var k = String(m[D] || '');
      if (!g[k]) { g[k] = { id: k, nombre: k ? String((nom[k] || {}).NOMBRE || k) : 'General', ingresos: 0, gastos: 0 }; orden.push(k); }
      if (m.TIPO === 'Ingreso') g[k].ingresos += importe(m).base; else g[k].gastos += importe(m).base;
    });
    return orden.map(function (k) { g[k].resultado = g[k].ingresos - g[k].gastos; return g[k]; })
      .sort(function (a, b) { return !a.id ? 1 : !b.id ? -1 : a.nombre.localeCompare(b.nombre, 'es'); });
  }

  /**
   * Comprueba un movimiento antes de guardarlo (lo que el YAML deja como «condicional»): devuelve los problemas.
   * La validación de tipos, listas y referencias la hace además el motor (TABLAS_API.gs).
   */
  function problemasMov(v, cfg) {
    var mal = [];
    if (!v.FECHA) mal.push('Falta la fecha.');
    if (!String(v.CONCEPTO || '').trim()) mal.push('Falta el concepto.');
    if (!(cts(v.BASE) > 0)) mal.push('El importe tiene que ser mayor que 0 (el signo lo da si es ingreso o gasto).');
    if (!v.ID_CUENTA) mal.push('Falta la cuenta.');
    if (v.TIPO === 'Interno') {
      if (!v.ID_CUENTA_DESTINO) mal.push('Falta a qué cuenta va el dinero.');
      else if (v.ID_CUENTA_DESTINO === v.ID_CUENTA) mal.push('La cuenta de destino tiene que ser otra.');
    } else {
      if (!v.ID_CATEGORIA) mal.push('Falta la categoría.');
      if (cfg.PIDE_CONTRAPARTE === 'Sí' && !v.ID_CONTRAPARTE) mal.push('Falta quién paga o cobra.');
    }
    if (cfg.PERIODO && v[cfg.PERIODO] === '') mal.push('Falta ' + String(cfg.NOMBRE_PERIODO || 'el periodo').toLowerCase() + '.');
    return mal;
  }

  var CALC = { cts: cts, pct: pct, importe: importe, eur: eur, fecha: fecha, periodos: periodos, periodoActual: periodoActual,
    movDe: movDe, facDe: facDe, preDe: preDe, resumen: resumen, saldos: saldos, pendientes: pendientes, sinFactura: sinFactura,
    presupuesto: presupuesto, desglose: desglose, problemasMov: problemasMov };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  var TABLAS = ['MOVIMIENTOS', 'CATEGORIAS', 'CUENTAS', 'CONTRAPARTES', 'FACTURAS', 'PRESUPUESTOS'];
  var PESTANAS = { RESUMEN: 'Resumen', MOVIMIENTOS: 'Movimientos', PENDIENTE: 'Pendiente', FACTURAS: 'Facturas', PRESUPUESTO: 'Presupuesto' };
  var VER = 150; // filas de una lista larga antes de «Ver más»

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function opciones(lista, sel, vacio) {
    return (vacio !== undefined ? '<option value="">' + texto(vacio) + '</option>' : '') + lista.map(function (o) {
      return '<option value="' + texto(o[0]) + '"' + (String(o[0]) === String(sel == null ? '' : sel) ? ' selected' : '') + '>' + texto(o[1]) + '</option>';
    }).join('');
  }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) {} return ''; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function cifra(c, bien) { return '<span class="u-cifra' + (c < 0 && bien ? ' u-mal' : '') + '">' + eur(c) + '</span>'; }

  window.UN.registrar('ECONOMIA', {
    abrir: function (el, ctx) {
      var T = ctx.tablas, cfg = ctx.config || {}, R = cfg._refs || {};
      var P = String(cfg.PERIODO || ''), DS = String(cfg.DESGLOSE || '');
      var nomPer = String(cfg.NOMBRE_PERIODO || 'Año'), nomDes = String(cfg.NOMBRE_DESGLOSE || DS);
      var tablas = TABLAS.concat(R.PERIODO ? [R.PERIODO] : [], R.DESGLOSE && R.DESGLOSE !== R.PERIODO ? [R.DESGLOSE] : []);
      var pest = String(cfg.PESTANAS || Object.keys(PESTANAS).join(',')).split(',').map(function (s) { return s.trim().toUpperCase(); })
        .filter(function (s) { return PESTANAS[s]; });
      if (!pest.length) pest = Object.keys(PESTANAS);
      var CLAVE = 'eco_' + ctx.id + '_';
      var S = { tab: pest.indexOf(guardado(CLAVE + 'tab')) >= 0 ? guardado(CLAVE + 'tab') : pest[0], per: guardado(CLAVE + 'per'),
        mov: { tipo: '', cat: '', cue: '', q: '', sinFac: false, ver: VER }, fac: { tipo: '', estado: '' }, ceros: false, leido: false };

      el.innerHTML = (cfg.AYUDA ? '<p class="u-nota n-ayuda">' + texto(cfg.AYUDA) + '</p>' : '') +
        '<div class="eco-barra"><label class="u-campo eco-per"><span class="u-etiqueta">' + texto(nomPer) + '</span><select id="eco-per"></select></label>' +
        '<div class="u-pestanas" role="tablist">' + pest.map(function (p) {
          return '<button type="button" role="tab" data-tab="' + p + '">' + PESTANAS[p] + '</button>';
        }).join('') + '</div></div>' +
        '<div id="eco-cont"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<div class="u-velo" id="eco-velo"><div class="u-ventana" role="dialog" aria-modal="true" aria-labelledby="eco-vt"><div class="n-ventana" id="eco-vent"></div></div></div>';
      var cont = el.querySelector('#eco-cont'), velo = el.querySelector('#eco-velo'), vent = el.querySelector('#eco-vent'), selPer = el.querySelector('#eco-per');

      /* ---------- datos ---------- */

      function datos() {
        return {
          cfg: cfg, mov: T.filas('MOVIMIENTOS'), cat: T.filas('CATEGORIAS'), cue: T.filas('CUENTAS'), ctr: T.filas('CONTRAPARTES'),
          fac: T.filas('FACTURAS'), pre: T.filas('PRESUPUESTOS'), per: R.PERIODO ? T.filas(R.PERIODO) : [], des: R.DESGLOSE ? T.filas(R.DESGLOSE) : [],
          colsPre: T.columnas ? T.columnas('PRESUPUESTOS') : [], colsMov: T.columnas ? T.columnas('MOVIMIENTOS') : []
        };
      }
      var d, lista, per, ix;
      function preparar() {
        d = datos();
        lista = periodos(d);
        per = lista.filter(function (p) { return p.id === S.per; })[0] || periodoActual(d, lista);
        ix = { cat: indice(d.cat), cue: indice(d.cue), ctr: indice(d.ctr), fac: indice(d.fac), per: indice(d.per), des: indice(d.des) };
        selPer.innerHTML = opciones(lista.map(function (p) { return [p.id, p.nombre]; }), per ? per.id : '');
      }
      function nombre(t, id) { var f = ix[t][String(id || '')]; return f ? String(f.NOMBRE || f.ID) : String(id || ''); }
      function numFac(f) { return f.NUMERO ? String(f.NUMERO) : (f._nueva ? 'Se numera al guardar' : String(f.ID)); }

      /* ---------- pintar ---------- */

      function pintar() {
        if (!S.leido) return;
        preparar();
        [].forEach.call(el.querySelectorAll('[data-tab]'), function (b) {
          var si = b.getAttribute('data-tab') === S.tab;
          b.setAttribute('aria-selected', si ? 'true' : 'false');
          if (si && b.parentNode.scrollWidth > b.parentNode.clientWidth) b.parentNode.scrollLeft = Math.max(0, b.offsetLeft - b.parentNode.offsetLeft - 16); // en el móvil, que se vea
        });
        if (!d.cue.length && !d.mov.length) {
          cont.innerHTML = '<p class="u-vacio">Todavía no hay cuentas ni movimientos. Añade al menos una cuenta (banco o caja) en la tabla CUENTAS del Excel ECONOMIA y apunta aquí el primer movimiento.</p>';
          return;
        }
        // Cada tabla en su caja: si no cabe en el móvil, se desplaza ella y no la página.
        cont.innerHTML = ({ RESUMEN: htmlResumen, MOVIMIENTOS: htmlMovimientos, PENDIENTE: htmlPendiente, FACTURAS: htmlFacturas, PRESUPUESTO: htmlPresupuesto })[S.tab]()
          .replace(/<table class="u-tabla eco-tabla">/g, '<div class="u-tabla-caja"><table class="u-tabla eco-tabla">').replace(/<\/table>/g, '</table></div>');
        var q = cont.querySelector('#eco-q');
        if (q && S.foco) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
        S.foco = false;
      }
      function chip(f) { return f && (f._pendiente || f._nueva) ? ' <span class="u-chip">Guardando</span>' : ''; }

      function htmlResumen() {
        var r = resumen(d, per), pend = pendientes(d), sal = saldos(d), cob = 0, pag = 0, nc = 0, np = 0;
        pend.forEach(function (x) { if (x.falta <= 0) return; if (x.cobrar) { cob += x.falta; nc++; } else { pag += x.falta; np++; } });
        var h = '<div class="eco-cab"><h2 class="n-grupo">Pendiente</h2><button type="button" class="u-btn u-btn-accion" data-accion="apuntar">Apuntar movimiento</button></div>' +
          '<table class="u-tabla eco-tabla"><tbody>' +
          '<tr tabindex="0" data-ir="PENDIENTE"><td class="u-tabla-t">Por cobrar<div class="u-nota">' + nc + (nc === 1 ? ' factura' : ' facturas') + '</div></td><td class="num">' + cifra(cob) + '</td></tr>' +
          '<tr tabindex="0" data-ir="PENDIENTE"><td class="u-tabla-t">Por pagar<div class="u-nota">' + np + (np === 1 ? ' factura' : ' facturas') + '</div></td><td class="num">' + cifra(pag) + '</td></tr>' +
          '</tbody></table>';
        h += '<h2 class="n-grupo">Resultado · ' + texto(per ? per.nombre : '') + '</h2>' +
          '<table class="u-tabla eco-tabla"><thead><tr><th></th><th class="num">Sin IVA</th><th class="num u-solo-ancho">IVA</th><th class="num">Total</th></tr></thead><tbody>' +
          '<tr><td class="u-tabla-t">Ingresos</td><td class="num">' + eur(r.ingresos.base) + '</td><td class="num u-solo-ancho">' + eur(r.ingresos.iva) + '</td><td class="num">' + eur(r.ingresos.total) + '</td></tr>' +
          '<tr><td class="u-tabla-t">Gastos</td><td class="num">' + eur(r.gastos.base) + '</td><td class="num u-solo-ancho">' + eur(r.gastos.iva) + '</td><td class="num">' + eur(r.gastos.total) + '</td></tr>' +
          '<tr class="eco-total"><td class="u-tabla-t">Resultado</td><td class="num">' + cifra(r.resultado, true) + '</td><td class="num u-solo-ancho">' + eur(r.iva) + '</td><td class="num"></td></tr>' +
          '</tbody></table><p class="u-nota">' + (r.iva >= 0 ? 'IVA a pagar del periodo: ' + eur(r.iva) : 'IVA a devolver del periodo: ' + eur(-r.iva)) +
          ' (el de los ingresos menos el de los gastos). ' + r.n + (r.n === 1 ? ' movimiento.' : ' movimientos.') + '</p>';
        var ds = desglose(d, per);
        if (ds && ds.length) {
          h += '<h2 class="n-grupo">Por ' + texto(nomDes.toLowerCase()) + '</h2><table class="u-tabla eco-tabla"><thead><tr><th>' + texto(nomDes) + '</th><th class="num u-solo-ancho">Ingresos</th><th class="num u-solo-ancho">Gastos</th><th class="num">Resultado</th></tr></thead><tbody>' +
            ds.map(function (x) { return '<tr><td class="u-tabla-t">' + texto(x.nombre) + '<div class="u-nota u-solo-movil">Ingresos ' + eur(x.ingresos) + ' · gastos ' + eur(x.gastos) + '</div></td><td class="num u-solo-ancho">' + eur(x.ingresos) + '</td><td class="num u-solo-ancho">' + eur(x.gastos) + '</td><td class="num">' + cifra(x.resultado, true) + '</td></tr>'; }).join('') +
            '</tbody></table><p class="u-nota">Sin IVA.</p>';
        }
        var cuentas = d.cue.filter(function (c) { return sal[c.ID]; }), tot = 0;
        h += '<h2 class="n-grupo">Saldo de cada cuenta</h2>';
        if (!cuentas.length) h += '<p class="u-vacio">Todas las cuentas están a cero.</p>';
        else {
          h += '<table class="u-tabla eco-tabla"><tbody>' + cuentas.map(function (c) {
            tot += sal[c.ID];
            return '<tr tabindex="0" data-cuenta="' + texto(c.ID) + '"><td class="u-tabla-t">' + texto(c.NOMBRE) + '<div class="u-nota">' + texto(c.TIPO) + '</div></td><td class="num">' + cifra(sal[c.ID], true) + '</td></tr>';
          }).join('') + '<tr class="eco-total"><td class="u-tabla-t">Total</td><td class="num">' + cifra(tot, true) + '</td></tr></tbody></table>' +
            '<p class="u-nota">Con todos los movimientos, no solo los de este periodo. ' + (d.cue.length - cuentas.length ? (d.cue.length - cuentas.length) + ' cuentas a cero no salen.' : '') + '</p>';
        }
        return h;
      }

      function movFiltrados() {
        var f = S.mov, q = norm(f.q);
        return movDe(d, per).filter(function (m) {
          if (f.tipo && m.TIPO !== f.tipo) return false;
          if (f.cat && String(m.ID_CATEGORIA) !== f.cat) return false;
          if (f.cue && String(m.ID_CUENTA) !== f.cue && String(m.ID_CUENTA_DESTINO) !== f.cue) return false;
          if (f.sinFac && (m.TIPO !== 'Gasto' || m.ID_FACTURA)) return false;
          if (q && norm([m.CONCEPTO, m.NOTAS, nombre('ctr', m.ID_CONTRAPARTE), nombre('cat', m.ID_CATEGORIA), m.ID].join(' ')).indexOf(q) < 0) return false;
          return true;
        }).sort(function (a, b) { return String(a.FECHA) < String(b.FECHA) ? 1 : String(a.FECHA) > String(b.FECHA) ? -1 : String(a.ID) < String(b.ID) ? 1 : -1; });
      }
      function signo(m) { var t = importe(m).total; return m.TIPO === 'Gasto' ? -t : m.TIPO === 'Ingreso' ? t : 0; }

      function htmlMovimientos() {
        var f = S.mov, ms = movFiltrados(), neto = 0;
        ms.forEach(function (m) { neto += signo(m); });
        var cats = d.cat.filter(function (c) { return !f.tipo || c.TIPO === f.tipo; }).map(function (c) { return [c.ID, c.NOMBRE]; });
        var h = '<div class="eco-cab"><p class="u-nota">' + ms.length + (ms.length === 1 ? ' movimiento' : ' movimientos') + ' · ingresos menos gastos: ' + eur(neto) + '</p>' +
          '<button type="button" class="u-btn u-btn-accion" data-accion="apuntar">Apuntar movimiento</button></div>' +
          '<div class="u-filtros">' +
          '<label class="u-campo"><span class="u-etiqueta">Buscar</span><input type="search" id="eco-q" value="' + texto(f.q) + '" placeholder="Concepto, contraparte…"></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Tipo</span><select data-filtro="tipo">' + opciones([['Ingreso', 'Ingresos'], ['Gasto', 'Gastos'], ['Interno', 'Internos']], f.tipo, 'Todos') + '</select></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Categoría</span><select data-filtro="cat">' + opciones(cats, f.cat, 'Todas') + '</select></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Cuenta</span><select data-filtro="cue">' + opciones(d.cue.map(function (c) { return [c.ID, c.NOMBRE]; }), f.cue, 'Todas') + '</select></label>' +
          '<label class="u-check"><input type="checkbox" data-filtro="sinFac"' + (f.sinFac ? ' checked' : '') + '> Gastos sin factura</label></div>';
        if (!ms.length) return h + '<p class="u-vacio">' + (movDe(d, per).length ? 'Ningún movimiento cumple el filtro. Quita algún filtro para ver más.' :
          'Todavía no hay movimientos en ' + texto(per ? per.nombre : 'este periodo') + '. Los que apuntes aparecen aquí al momento.') + '</p>';
        h += '<table class="u-tabla eco-tabla"><thead><tr><th>Movimiento</th><th class="num">Importe</th></tr></thead><tbody>' + ms.slice(0, f.ver).map(function (m) {
          var sub = [fecha(m.FECHA), m.TIPO === 'Interno' ? nombre('cue', m.ID_CUENTA) + ' → ' + nombre('cue', m.ID_CUENTA_DESTINO) : nombre('cat', m.ID_CATEGORIA),
            m.TIPO === 'Interno' ? '' : nombre('ctr', m.ID_CONTRAPARTE), m.TIPO === 'Interno' ? '' : nombre('cue', m.ID_CUENTA)].filter(Boolean).join(' · ');
          var s = signo(m);
          return '<tr tabindex="0" data-mov="' + texto(m.ID) + '"><td class="u-tabla-t">' + texto(m.CONCEPTO) + chip(m) +
            (m.TIPO === 'Gasto' && !m.ID_FACTURA ? ' <span class="u-chip">Sin factura</span>' : '') + '<div class="u-nota">' + texto(sub) + '</div></td>' +
            '<td class="num">' + (m.TIPO === 'Interno' ? '<span class="u-cifra">' + eur(importe(m).total) + '</span><div class="u-nota">Interno</div>' : '<span class="u-cifra">' + (s > 0 ? '+' : '') + eur(s) + '</span>') + '</td></tr>';
        }).join('') + '</tbody></table>';
        if (ms.length > f.ver) h += '<button type="button" class="u-btn" data-accion="vermas">Ver ' + Math.min(VER, ms.length - f.ver) + ' movimientos más</button>';
        return h;
      }

      function htmlPendiente() {
        var pend = pendientes(d), sf = sinFactura(d, per), h = '';
        [[true, 'Por cobrar', 'No hay facturas emitidas por cobrar. Cuando des de alta una factura emitida, sale aquí hasta que la cobres.'],
          [false, 'Por pagar', 'No hay facturas por pagar. Las facturas recibidas que marques como Pendiente salen aquí hasta que las pagues.']].forEach(function (g) {
          var xs = pend.filter(function (x) { return x.cobrar === g[0]; }), tot = 0;
          xs.forEach(function (x) { tot += Math.max(x.falta, 0); });
          h += '<h2 class="n-grupo">' + g[1] + (xs.length ? ' <span class="u-cifra">' + eur(tot) + '</span>' : '') + '</h2>';
          if (!xs.length) { h += '<p class="u-vacio">' + g[2] + '</p>'; return; }
          h += '<table class="u-tabla eco-tabla"><thead><tr><th>Factura</th><th class="num">Falta</th></tr></thead><tbody>' + xs.map(function (x) {
            return '<tr tabindex="0" data-fac="' + texto(x.f.ID) + '"><td class="u-tabla-t">' + texto(numFac(x.f)) + ' · ' + texto(nombre('ctr', x.f.ID_CONTRAPARTE)) + chip(x.f) +
              '<div class="u-nota">' + fecha(x.f.FECHA) + ' · total ' + eur(x.total) + (x.pagado ? ' · ' + (g[0] ? 'cobrado ' : 'pagado ') + eur(x.pagado) : '') + '</div></td>' +
              '<td class="num">' + (x.falta > 0 ? cifra(x.falta) : '<span class="u-nota">' + (g[0] ? 'Cobrada: márcala' : 'Pagada: márcala') + '</span>') + '</td></tr>';
          }).join('') + '</tbody></table>';
        });
        var tsf = 0; sf.forEach(function (m) { tsf += importe(m).total; });
        h += '<h2 class="n-grupo">Gastos sin factura · ' + texto(per ? per.nombre : '') + '</h2>' + (sf.length ?
          '<table class="u-tabla eco-tabla"><tbody><tr tabindex="0" data-accion="sinfac"><td class="u-tabla-t">' + sf.length + (sf.length === 1 ? ' gasto' : ' gastos') + ' sin factura ni ticket<div class="u-nota">Toca para verlos en Movimientos y añadir su factura.</div></td><td class="num">' + cifra(tsf) + '</td></tr></tbody></table>' :
          '<p class="u-vacio">Todos los gastos del periodo tienen su factura o ticket.</p>');
        return h;
      }

      function htmlFacturas() {
        var f = S.fac, pg = null;
        var fs = facDe(d, per).filter(function (x) { return (!f.tipo || x.TIPO === f.tipo) && (!f.estado || (f.estado === '-' ? !x.ESTADO : x.ESTADO === f.estado)); })
          .sort(function (a, b) { return String(a.FECHA) < String(b.FECHA) ? 1 : -1; });
        var tot = 0; fs.forEach(function (x) { if (x.ESTADO !== 'Anulada') tot += importe(x).total; });
        var h = '<div class="eco-cab"><p class="u-nota">' + fs.length + (fs.length === 1 ? ' factura' : ' facturas') + ' · ' + eur(tot) + ' con IVA (sin las anuladas)</p>' +
          '<button type="button" class="u-btn u-btn-accion" data-accion="factura">Añadir factura</button></div>' +
          '<div class="u-filtros"><label class="u-campo"><span class="u-etiqueta">Tipo</span><select data-ffac="tipo">' + opciones([['Emitida', 'Emitidas'], ['Recibida', 'Recibidas'], ['Ticket', 'Tickets']], f.tipo, 'Todas') + '</select></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Estado</span><select data-ffac="estado">' + opciones([['Pendiente', 'Pendiente'], ['Pagada', 'Pagada'], ['Anulada', 'Anulada'], ['-', 'Sin estado']], f.estado, 'Todos') + '</select></label></div>';
        if (!fs.length) return h + '<p class="u-vacio">No hay facturas ' + (f.tipo || f.estado ? 'con este filtro' : 'en ' + texto(per ? per.nombre : 'este periodo')) + '. Las que añadas salen aquí al momento.</p>';
        return h + '<table class="u-tabla eco-tabla"><thead><tr><th>Factura</th><th class="num">Total</th></tr></thead><tbody>' + fs.map(function (x) {
          return '<tr tabindex="0" data-fac="' + texto(x.ID) + '"><td class="u-tabla-t">' + texto(numFac(x)) + ' · ' + texto(nombre('ctr', x.ID_CONTRAPARTE)) + chip(x) +
            '<div class="u-nota">' + [fecha(x.FECHA), x.TIPO, x.ESTADO].filter(Boolean).join(' · ') + '</div></td>' +
            '<td class="num"><span class="u-cifra' + (x.ESTADO === 'Anulada' ? ' eco-anulada' : '') + '">' + eur(importe(x).total) + '</span></td></tr>';
        }).join('') + '</tbody></table>';
      }

      function htmlPresupuesto() {
        var ps = presupuesto(d, per), h = '<p class="u-nota">Sin IVA. Toca una categoría para cambiar lo previsto' + (presPorPeriodo(d) ? ' en ' + texto(per ? per.nombre : 'este periodo') : '') + '.</p>';
        ['Ingreso', 'Gasto'].forEach(function (tipo) {
          var xs = ps.filter(function (x) { return x.tipo === tipo && (S.ceros || x.previsto || x.real); }), tp = 0, tr = 0;
          h += '<h2 class="n-grupo">' + (tipo === 'Ingreso' ? 'Ingresos' : 'Gastos') + '</h2>';
          if (!xs.length) { h += '<p class="u-vacio">No hay nada previsto ni apuntado. Toca «Ver todas las categorías» para prever algo.</p>'; return; }
          h += '<table class="u-tabla eco-tabla"><thead><tr><th>Categoría</th><th class="num">Previsto</th><th class="num u-solo-ancho">Real</th><th class="num">' + (tipo === 'Gasto' ? 'Queda' : 'Diferencia') + '</th></tr></thead><tbody>' +
            xs.map(function (x) {
              tp += x.previsto; tr += x.real;
              return '<tr tabindex="0" data-pre="' + texto(x.cat.ID) + '"><td class="u-tabla-t">' + texto(x.cat.NOMBRE) + (x.filas.some(function (r) { return r._pendiente || r._nueva; }) ? ' <span class="u-chip">Guardando</span>' : '') +
                '<div class="u-nota">' + [x.grupo, '<span class="u-solo-movil">real ' + eur(x.real) + '</span>'].filter(Boolean).join(' · ') + '</div></td><td class="num">' + eur(x.previsto) + '</td><td class="num u-solo-ancho">' + eur(x.real) + '</td>' +
                '<td class="num">' + (x.previsto ? cifra(x.dif, true) : '<span class="u-nota">Sin prever</span>') + '</td></tr>';
            }).join('') + '<tr class="eco-total"><td class="u-tabla-t">Total<div class="u-nota u-solo-movil">real ' + eur(tr) + '</div></td><td class="num">' + eur(tp) + '</td><td class="num u-solo-ancho">' + eur(tr) + '</td><td class="num">' + cifra(tipo === 'Gasto' ? tp - tr : tr - tp, true) + '</td></tr></tbody></table>';
        });
        return h + '<button type="button" class="u-btn" data-accion="ceros">' + (S.ceros ? 'Ver solo las que tienen algo' : 'Ver todas las categorías') + '</button>';
      }

      /* ---------- ventanas ---------- */

      var alCerrar = null;
      function ventana(html, alAbrir) {
        vent.innerHTML = html;
        velo.classList.add('abierto');
        if (alAbrir) alAbrir();
        var p = vent.querySelector('input:not([type=hidden]), select, textarea');
        if (p) p.focus();
      }
      function cerrar() { velo.classList.remove('abierto'); vent.innerHTML = ''; if (alCerrar) { var f = alCerrar; alCerrar = null; f(); } }
      function campo(et, html, extra) { return '<label class="u-campo' + (extra ? ' ' + extra : '') + '"><span class="u-etiqueta">' + et + '</span>' + html + '</label>'; }
      function val(id) { var e = vent.querySelector('#' + id); return e ? String(e.value).trim() : ''; }
      function verError(mal) { var e = vent.querySelector('.u-error'); e.textContent = mal.join(' '); e.hidden = !mal.length; }
      function ivas() { return ['21%', '10%', '4%', '0%']; }
      function cambios(f, v) { var c = {}; Object.keys(v).forEach(function (k) { if (String(f[k] == null ? '' : f[k]) !== String(v[k])) c[k] = v[k]; }); return c; }
      function confirmar(b, t, f) { if (b.getAttribute('data-ok')) { f(); return; } b.setAttribute('data-ok', '1'); b.textContent = t; }

      /** Ventana de un movimiento: nuevo (m null, con lo que venga en pre) o uno que ya está. */
      function formMov(m, pre) {
        var v = m || Object.assign({ FECHA: hoy(), TIPO: 'Gasto', TIPO_IVA: '21%' }, pre || {});
        if (!m && P && !v[P] && per && P !== '' && d.colsMov.indexOf(P) >= 0) v[P] = per.id;
        var tienePer = P && d.colsMov.indexOf(P) >= 0, tieneDes = DS && d.colsMov.indexOf(DS) >= 0;
        var cuentas = d.cue.map(function (c) { return [c.ID, c.NOMBRE]; });
        var html = '<h2 id="eco-vt">' + (m ? texto(m.CONCEPTO) : 'Apuntar movimiento') + '</h2><div class="u-campos">' +
          campo('Tipo', '<select id="m-TIPO">' + opciones([['Ingreso', 'Ingreso'], ['Gasto', 'Gasto'], ['Interno', 'Interno (de una cuenta a otra)']], v.TIPO) + '</select>') +
          campo('Fecha', '<input type="date" id="m-FECHA" value="' + texto(v.FECHA) + '">') +
          campo('Concepto', '<input type="text" id="m-CONCEPTO" value="' + texto(v.CONCEPTO) + '" maxlength="200">', 'u-ancho') +
          campo('Importe sin IVA', '<input type="text" inputmode="decimal" id="m-BASE" value="' + texto(v.BASE === '' || v.BASE == null ? '' : String(v.BASE).replace('.', ',')) + '" placeholder="0,00">') +
          campo('IVA', '<select id="m-TIPO_IVA">' + opciones(ivas().map(function (x) { return [x, x]; }), v.TIPO_IVA) + '</select>') +
          '<p class="u-nota u-ancho" id="m-total"></p>' +
          campo('Categoría', '<select id="m-ID_CATEGORIA"></select>', 'eco-no-interno') +
          campo('Cuenta', '<select id="m-ID_CUENTA">' + opciones(cuentas, v.ID_CUENTA, 'Elige la cuenta') + '</select>') +
          campo('A la cuenta', '<select id="m-ID_CUENTA_DESTINO">' + opciones(cuentas, v.ID_CUENTA_DESTINO, 'Elige a dónde va') + '</select>', 'eco-interno') +
          campo('Quién paga o cobra', '<select id="m-ID_CONTRAPARTE">' + opciones(d.ctr.map(function (c) { return [c.ID, c.NOMBRE]; }).sort(function (a, b) { return String(a[1]).localeCompare(String(b[1]), 'es'); }), v.ID_CONTRAPARTE, cfg.PIDE_CONTRAPARTE === 'Sí' ? 'Elige' : 'Nadie en concreto') + '</select>', 'eco-no-interno') +
          (tienePer ? campo(texto(nomPer), '<select id="m-PER">' + opciones(lista.map(function (p) { return [p.id, p.nombre]; }), v[P], 'Elige') + '</select>') : '') +
          (tieneDes ? campo(texto(nomDes), '<select id="m-DES"></select>', 'eco-no-interno') : '') +
          campo('Factura o ticket', '<select id="m-ID_FACTURA"></select>', 'eco-no-interno') +
          campo('Notas', '<textarea id="m-NOTAS" rows="2">' + texto(v.NOTAS) + '</textarea>', 'u-ancho') +
          '</div><p class="u-error" role="alert" hidden></p><div class="n-botones">' +
          '<button type="button" class="u-btn u-btn-accion" id="m-guardar">Guardar movimiento</button><button type="button" class="u-btn" data-cerrar>Cancelar</button>' +
          (m ? '<button type="button" class="u-btn u-btn-texto" id="m-borrar">Borrar movimiento</button>' : '') + '</div>';
        ventana(html, function () {
          function refrescar() {
            var tipo = val('m-TIPO'), interno = tipo === 'Interno';
            [].forEach.call(vent.querySelectorAll('.eco-interno'), function (x) { x.hidden = !interno; });
            [].forEach.call(vent.querySelectorAll('.eco-no-interno'), function (x) { x.hidden = interno; });
            var sc = vent.querySelector('#m-ID_CATEGORIA'), cat = sc.value || v.ID_CATEGORIA;
            sc.innerHTML = opciones(d.cat.filter(function (c) { return c.TIPO === tipo; }).map(function (c) { return [c.ID, c.NOMBRE + (c.GRUPO ? ' · ' + c.GRUPO : '')]; }), cat, 'Elige la categoría');
            var sd = vent.querySelector('#m-DES');
            if (sd) {
              var pv = tienePer ? val('m-PER') : '', des = sd.value || v[DS];
              // Si las filas del desglose tienen también la columna del periodo (una competición es de una temporada), solo las de ese periodo.
              var filas = d.des.filter(function (r) { return !pv || !(P in r) || String(r[P]) === pv || String(r.ID) === String(des); });
              sd.innerHTML = opciones((R.DESGLOSE ? filas.map(function (r) { return [r.ID, r.NOMBRE || r.ID]; }) : []), des, 'General');
            }
            var sf = vent.querySelector('#m-ID_FACTURA'), fa = sf.value || v.ID_FACTURA, ctr = val('m-ID_CONTRAPARTE');
            var fs = d.fac.filter(function (f) { return String(f.ID) === String(fa) || (f.ESTADO !== 'Anulada' && (!ctr || String(f.ID_CONTRAPARTE) === ctr) && (tipo === 'Ingreso' ? f.TIPO === 'Emitida' : f.TIPO !== 'Emitida')); })
              .sort(function (a, b) { return String(a.FECHA) < String(b.FECHA) ? 1 : -1; }).slice(0, 60);
            sf.innerHTML = opciones(fs.map(function (f) { return [f.ID, numFac(f) + ' · ' + fecha(f.FECHA) + ' · ' + eur(importe(f).total)]; }), fa, 'Sin factura');
            var t = importe({ BASE: val('m-BASE'), TIPO_IVA: val('m-TIPO_IVA') });
            vent.querySelector('#m-total').textContent = 'IVA ' + eur(t.iva) + ' · total ' + eur(t.total);
          }
          refrescar();
          ['m-TIPO', 'm-TIPO_IVA', 'm-ID_CONTRAPARTE', 'm-PER'].forEach(function (id) { var e = vent.querySelector('#' + id); if (e) e.addEventListener('change', refrescar); });
          vent.querySelector('#m-BASE').addEventListener('input', refrescar);
          vent.querySelector('#m-guardar').onclick = function () {
            var tipo = val('m-TIPO'), interno = tipo === 'Interno';
            var nv = { FECHA: val('m-FECHA'), TIPO: tipo, CONCEPTO: val('m-CONCEPTO'), BASE: cts(val('m-BASE')) / 100, TIPO_IVA: val('m-TIPO_IVA'),
              ID_CATEGORIA: interno ? '' : val('m-ID_CATEGORIA'), ID_CUENTA: val('m-ID_CUENTA'), ID_CUENTA_DESTINO: interno ? val('m-ID_CUENTA_DESTINO') : '',
              ID_CONTRAPARTE: interno ? '' : val('m-ID_CONTRAPARTE'), ID_FACTURA: interno ? '' : val('m-ID_FACTURA'), NOTAS: val('m-NOTAS') };
            if (tienePer) nv[P] = val('m-PER');
            if (tieneDes) nv[DS] = interno ? '' : val('m-DES');
            var mal = problemasMov(Object.assign({}, nv, { BASE: val('m-BASE') }), Object.assign({}, cfg, { PERIODO: tienePer ? P : '' }));
            if (mal.length) { verError(mal); return; }
            cerrar();
            var p = m ? T.actualizar('MOVIMIENTOS', m.ID, cambios(m, nv)) : T.crear('MOVIMIENTOS', nv);
            p.then(function () { if (ctx.abierta()) ctx.aviso('Movimiento guardado en el Excel.'); revisarFactura(nv.ID_FACTURA); }, function () {});
          };
          var bb = vent.querySelector('#m-borrar');
          if (bb) bb.onclick = function () {
            confirmar(bb, 'Sí, borrar este movimiento', function () {
              cerrar();
              T.borrar('MOVIMIENTOS', m.ID).then(function () { if (ctx.abierta()) ctx.aviso('Movimiento borrado del Excel.'); }, function () {});
            });
          };
        });
      }

      /** Si una factura Pendiente ya está cobrada o pagada del todo con sus movimientos, se marca Pagada. */
      function revisarFactura(id) {
        if (!id) return;
        var x = pendientes(datos()).filter(function (p) { return String(p.f.ID) === String(id); })[0];
        if (!x || x.falta > 0) return;
        T.actualizar('FACTURAS', id, { ESTADO: 'Pagada' }).then(function () {
          if (ctx.abierta()) ctx.aviso('La factura ' + numFac(x.f) + ' ya está ' + (x.cobrar ? 'cobrada' : 'pagada') + ': marcada como Pagada.');
        }, function () {});
      }

      /** Ventana de una factura: nueva (f null) o una que ya está. Una emitida nueva la numera el motor. */
      function formFac(f) {
        var v = f || { TIPO: 'Recibida', FECHA: hoy(), TIPO_IVA: '21%', ESTADO: 'Pendiente' };
        var movs = f ? d.mov.filter(function (m) { return String(m.ID_FACTURA) === String(f.ID); }) : [];
        var pagado = 0; movs.forEach(function (m) { pagado += importe(m).total; });
        var html = '<h2 id="eco-vt">' + (f ? 'Factura ' + texto(numFac(f)) : 'Añadir factura') + '</h2><div class="u-campos">' +
          (f ? '' : campo('Tipo', '<select id="f-TIPO">' + opciones([['Emitida', 'Emitida (la hacemos nosotros)'], ['Recibida', 'Recibida'], ['Ticket', 'Ticket']], v.TIPO) + '</select>')) +
          campo('Número', '<input type="text" id="f-NUMERO" value="' + texto(v.NUMERO) + '" maxlength="40">', 'eco-numero') +
          campo('Fecha', '<input type="date" id="f-FECHA" value="' + texto(v.FECHA) + '">') +
          campo(v.TIPO === 'Emitida' ? 'Cliente' : 'Contraparte', '<select id="f-ID_CONTRAPARTE">' + opciones(d.ctr.map(function (c) { return [c.ID, c.NOMBRE]; }).sort(function (a, b) { return String(a[1]).localeCompare(String(b[1]), 'es'); }), v.ID_CONTRAPARTE, 'Elige') + '</select>') +
          campo('Base imponible', '<input type="text" inputmode="decimal" id="f-BASE" value="' + texto(v.BASE === '' || v.BASE == null ? '' : String(v.BASE).replace('.', ',')) + '" placeholder="0,00">') +
          campo('IVA', '<select id="f-TIPO_IVA">' + opciones(ivas().map(function (x) { return [x, x]; }), v.TIPO_IVA) + '</select>') +
          '<p class="u-nota u-ancho" id="f-total"></p>' +
          campo('Estado', '<select id="f-ESTADO">' + opciones([['Pendiente', 'Pendiente'], ['Pagada', 'Pagada'], ['Anulada', 'Anulada']], v.ESTADO, 'Sin estado') + '</select>') +
          campo('Enlace al PDF', '<input type="url" id="f-ARCHIVO_URL" value="' + texto(v.ARCHIVO_URL) + '" placeholder="https://…">', 'u-ancho') +
          campo('Notas', '<textarea id="f-NOTAS" rows="2">' + texto(v.NOTAS) + '</textarea>', 'u-ancho') + '</div>' +
          (f ? '<p class="u-nota">' + (movs.length ? movs.length + (movs.length === 1 ? ' movimiento' : ' movimientos') + ' con esta factura: ' + eur(pagado) + ' de ' + eur(importe(f).total) + '.' : 'Ningún movimiento lleva todavía esta factura.') +
            (f.ARCHIVO_URL ? ' <a href="' + texto(f.ARCHIVO_URL) + '" target="_blank" rel="noopener">Abrir el PDF</a>' : '') + '</p>' : '') +
          '<p class="u-error" role="alert" hidden></p><div class="n-botones">' +
          '<button type="button" class="u-btn u-btn-accion" id="f-guardar">Guardar factura</button><button type="button" class="u-btn" data-cerrar>Cancelar</button>' +
          (f && f.ESTADO === 'Pendiente' ? '<button type="button" class="u-btn" id="f-apuntar">' + (f.TIPO === 'Emitida' ? 'Apuntar el cobro' : 'Apuntar el pago') + '</button>' : '') + '</div>';
        ventana(html, function () {
          function refrescar() {
            var tipo = f ? f.TIPO : val('f-TIPO'), em = tipo === 'Emitida' && !f;
            var n = vent.querySelector('#f-NUMERO');
            n.disabled = em; if (em) n.value = ''; n.placeholder = em ? 'Se numera sola al guardar (' + String(cfg.SERIE_EMITIDAS || '') + '…)' : '';
            var t = importe({ BASE: val('f-BASE'), TIPO_IVA: val('f-TIPO_IVA') });
            vent.querySelector('#f-total').textContent = 'IVA ' + eur(t.iva) + ' · total ' + eur(t.total);
          }
          refrescar();
          ['f-TIPO', 'f-TIPO_IVA'].forEach(function (id) { var e = vent.querySelector('#' + id); if (e) e.addEventListener('change', refrescar); });
          vent.querySelector('#f-BASE').addEventListener('input', refrescar);
          vent.querySelector('#f-guardar').onclick = function () {
            var tipo = f ? f.TIPO : val('f-TIPO'), em = tipo === 'Emitida' && !f;
            var nv = { FECHA: val('f-FECHA'), ID_CONTRAPARTE: val('f-ID_CONTRAPARTE'), BASE: cts(val('f-BASE')) / 100, TIPO_IVA: val('f-TIPO_IVA'),
              ESTADO: val('f-ESTADO'), ARCHIVO_URL: val('f-ARCHIVO_URL'), NOTAS: val('f-NOTAS') };
            if (!em) nv.NUMERO = val('f-NUMERO');
            var mal = [];
            if (!em && !nv.NUMERO) mal.push('Falta el número.');
            if (!nv.FECHA) mal.push('Falta la fecha.');
            if (!nv.ID_CONTRAPARTE) mal.push('Falta ' + (tipo === 'Emitida' ? 'el cliente.' : 'la contraparte.'));
            if (!(cts(val('f-BASE')) > 0)) mal.push('La base tiene que ser mayor que 0.');
            if (!em && nv.NUMERO && d.fac.some(function (x) { return x !== f && x.TIPO === tipo && String(x.NUMERO).trim() === nv.NUMERO; })) mal.push('Ya hay una ' + tipo.toLowerCase() + ' con el número ' + nv.NUMERO + '.');
            if (mal.length) { verError(mal); return; }
            cerrar();
            var p;
            if (f) p = T.actualizar('FACTURAS', f.ID, cambios(f, nv));
            else if (em) p = T.crear('FACTURAS', Object.assign({ TIPO: 'Emitida', NUMERO: '' }, nv), { fn: 'economiaEmitir' });
            else p = T.crear('FACTURAS', Object.assign({ TIPO: tipo }, nv));
            p.then(function (r) {
              var x = r && r.fila ? r.fila : null;
              if (ctx.abierta()) ctx.aviso(x && em ? 'Factura ' + x.NUMERO + ' guardada en el Excel.' : 'Factura guardada en el Excel.');
            }, function () {});
          };
          var ba = vent.querySelector('#f-apuntar');
          if (ba) ba.onclick = function () {
            var t = importe(f), falta = t.total - pagado, base = Math.round(falta * 100 / (100 + pct(f.TIPO_IVA)));
            cerrar();
            var pre = { TIPO: f.TIPO === 'Emitida' ? 'Ingreso' : 'Gasto', CONCEPTO: (f.TIPO === 'Emitida' ? 'Cobro ' : 'Pago ') + numFac(f), ID_CONTRAPARTE: f.ID_CONTRAPARTE,
              ID_FACTURA: f.ID, TIPO_IVA: f.TIPO_IVA, BASE: base / 100 };
            formMov(null, pre);
          };
        });
      }

      /** Ventana del presupuesto de una categoría: una fila por cada parte prevista (por desglose, si lo tiene) y la general. */
      function formPre(idCat) {
        var c = ix.cat[idCat]; if (!c) return;
        var filas = preDe(d, per).filter(function (r) { return String(r.ID_CATEGORIA) === String(idCat); });
        var conDes = DS && d.colsPre.indexOf(DS) >= 0;
        var general = filas.filter(function (r) { return !conDes || !r[DS]; })[0];
        var partes = filas.filter(function (r) { return r !== general; });
        var html = '<h2 id="eco-vt">' + texto(c.NOMBRE) + '</h2><p class="u-nota">Lo previsto sin IVA' + (presPorPeriodo(d) ? ' en ' + texto(per.nombre) : '') + '.</p><div class="u-campos">' +
          partes.map(function (r) { return campo(texto(conDes ? nombre('des', r[DS]) : (r.NOTAS || r.ID)), '<input type="text" inputmode="decimal" data-pre="' + texto(r.ID) + '" value="' + texto(String(r.IMPORTE).replace('.', ',')) + '">'); }).join('') +
          campo(partes.length ? 'General' : 'Previsto', '<input type="text" inputmode="decimal" data-pre="' + texto(general ? general.ID : '') + '" value="' + texto(general ? String(general.IMPORTE).replace('.', ',') : '') + '" placeholder="0,00">') +
          '</div><p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="p-guardar">Guardar lo previsto</button><button type="button" class="u-btn" data-cerrar>Cancelar</button></div>';
        ventana(html, function () {
          vent.querySelector('#p-guardar').onclick = function () {
            var ops = [];
            [].forEach.call(vent.querySelectorAll('[data-pre]'), function (i) {
              var id = i.getAttribute('data-pre'), txt = String(i.value).trim(), n = txt ? cts(txt) / 100 : 0;
              if (id) { var r = T.fila('PRESUPUESTOS', id); if (r && cts(r.IMPORTE) !== Math.round(n * 100)) ops.push(function () { return T.actualizar('PRESUPUESTOS', id, { IMPORTE: n }); }); }
              else if (n > 0) {
                var nv = { ID_CATEGORIA: c.ID, IMPORTE: n };
                if (presPorPeriodo(d)) nv[P] = per.id;
                ops.push(function () { return T.crear('PRESUPUESTOS', nv); });
              }
            });
            cerrar();
            Promise.all(ops.map(function (f) { return f(); })).then(function () { if (ops.length && ctx.abierta()) ctx.aviso('Presupuesto guardado en el Excel.'); }, function () {});
          };
        });
      }

      /* ---------- eventos ---------- */

      function irA(tab) { S.tab = tab; guardado(CLAVE + 'tab', tab); pintar(); window.scrollTo(0, 0); }
      el.addEventListener('click', function (e) {
        var t = e.target;
        var b = t.closest('[data-tab]'); if (b) { irA(b.getAttribute('data-tab')); return; }
        if (t.closest('[data-cerrar]')) { cerrar(); return; }
        var a = t.closest('[data-accion]');
        if (a) {
          var ac = a.getAttribute('data-accion');
          if (ac === 'apuntar') formMov(null);
          else if (ac === 'factura') formFac(null);
          else if (ac === 'vermas') { S.mov.ver += VER; pintar(); }
          else if (ac === 'ceros') { S.ceros = !S.ceros; pintar(); }
          else if (ac === 'sinfac') { S.mov = { tipo: 'Gasto', cat: '', cue: '', q: '', sinFac: true, ver: VER }; if (pest.indexOf('MOVIMIENTOS') >= 0) irA('MOVIMIENTOS'); }
          return;
        }
        var tr = t.closest('tr[tabindex]');
        if (!tr) return;
        if (tr.hasAttribute('data-ir') && pest.indexOf(tr.getAttribute('data-ir')) >= 0) irA(tr.getAttribute('data-ir'));
        else if (tr.hasAttribute('data-mov')) { var m = T.fila('MOVIMIENTOS', tr.getAttribute('data-mov')); if (m && !m._nueva) formMov(m); }
        else if (tr.hasAttribute('data-fac')) { var f = T.fila('FACTURAS', tr.getAttribute('data-fac')); if (f && !f._nueva) formFac(f); }
        else if (tr.hasAttribute('data-pre')) formPre(tr.getAttribute('data-pre'));
        else if (tr.hasAttribute('data-cuenta') && pest.indexOf('MOVIMIENTOS') >= 0) { S.mov = { tipo: '', cat: '', cue: tr.getAttribute('data-cuenta'), q: '', sinFac: false, ver: VER }; irA('MOVIMIENTOS'); }
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && velo.classList.contains('abierto')) { cerrar(); return; }
        var tr = e.target.closest && e.target.closest('tr[tabindex]');
        if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tr.click(); }
      });
      velo.addEventListener('click', function (e) { if (e.target === velo) cerrar(); });
      el.addEventListener('change', function (e) {
        var t = e.target;
        if (t === selPer) { S.per = t.value; guardado(CLAVE + 'per', t.value); S.mov.ver = VER; pintar(); return; }
        if (t.hasAttribute('data-filtro')) { var k = t.getAttribute('data-filtro'); S.mov[k] = t.type === 'checkbox' ? t.checked : t.value; if (k === 'tipo') S.mov.cat = ''; S.mov.ver = VER; pintar(); }
        if (t.hasAttribute('data-ffac')) { S.fac[t.getAttribute('data-ffac')] = t.value; pintar(); }
      });
      var tq = 0;
      el.addEventListener('input', function (e) {
        if (e.target.id !== 'eco-q') return;
        S.mov.q = e.target.value; clearTimeout(tq);
        tq = setTimeout(function () { S.mov.ver = VER; S.foco = true; pintar(); }, 200);
      });

      ctx.alCambiar(function (t) { if (tablas.indexOf(t) >= 0) pintar(); });
      ctx.tablas.leer(tablas).then(function () { S.leido = true; pintar(); }, function (e) {
        cont.innerHTML = '<p class="u-error">No se han podido leer las cuentas.</p><p class="u-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Vuelve a abrir la sección para probar otra vez.</p>';
      });
      this._cerrar = cerrar;
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); }
  });
})();
