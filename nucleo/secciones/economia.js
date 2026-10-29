/*
 * Sección Economía base del núcleo · UTILO_CORE 5.0 (T0257) · motor/modulos/economia de utilo-apps
 *
 * Igual para todos los negocios. Lee y escribe el Excel ECONOMIA con las tablas al momento (ctx.tablas): todo se pinta
 * de lo guardado en el dispositivo y cada cambio se ve al tocar «Guardar»; el Excel se escribe por detrás y, si el motor
 * dice que no, vuelve a como estaba y avisa.
 * Los totales y el IVA se calculan aquí, en el navegador (CALC, más abajo), en céntimos: no hay fórmulas en el Excel.
 * Solo el alta de una factura emitida pasa por el motor (economiaEmitir), que le pone el número correlativo, y las
 * medidas con las que se recomienda el presupuesto (economiaMedidas), que salen de tablas de otros Excel.
 *
 * T0272 (1.1.0): con el aspecto y la forma de abrir cada cosa de la Economía 4.1 publicada (kanban4/economia.js):
 *   Resumen   beneficio frente al presupuesto, ingresos y gastos, IVA; ingresos y gastos por grupo con su barra
 *             («Quedan», «Te has pasado») que se abre en sus categorías, y cada categoría, en sus movimientos;
 *             beneficio y reparto; resultado por desglose. Se puede mirar una sola parte del desglose.
 *   Movimientos  lista con filtros; cada uno abre su ficha (Editar, Borrar, Hacer la factura). «Añadir movimiento»
 *             (el botón que flota) solo sale aquí.
 *   Caja      el dinero de cada cuenta (banco, cajas, socios) y, al tocarla, sus movimientos con el saldo.
 *   Pendiente facturas por cobrar y por pagar y gastos sin factura.
 *   Facturas  de T0257, con el cliente o el proveedor de cada una y su enlace para abrirla en Drive (ARCHIVO_URL).
 *   Presupuesto  quien dice PREPARA_PRESUPUESTO toca una categoría y define lo previsto, con una recomendación sacada
 *             de lo real del periodo anterior (por MEDIDAS, si las hay) y confirmación; los demás solo lo miran.
 *
 * Personalización (config.json · nucleo.secciones.economia.config, declarada en su modulo.json):
 *   PERIODO / NOMBRE_PERIODO   columna de MOVIMIENTOS que da el periodo (p. ej. ID_TEMPORADA) y cómo se llama; vacía, el año
 *   DESGLOSE / NOMBRE_DESGLOSE columna por la que se desglosa el resultado (p. ej. ID_COMPETICION)
 *   PIDE_CONTRAPARTE           Sí: un ingreso o un gasto necesita contraparte
 *   SERIE_EMITIDAS             lo que va delante del número de las facturas emitidas (lo usa el motor)
 *   REPARTO                    GRUPO de categorías que es el reparto del beneficio (no cuenta como gasto)
 *   PREPARA_PRESUPUESTO        perfiles que preparan el presupuesto; vacío, solo quien administra
 *   MEDIDAS                    con qué se recomienda el presupuesto de cada grupo (equipos, partidos…)
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
  /**
   * T0272 · La base (céntimos) de un total con IVA: la que, con su cuota redondeada al céntimo, da justo ese total
   * (si el redondeo no lo permite, la más cercana). Para apuntar un importe tal cual lo dicen, con el IVA incluido.
   */
  function baseDeTotal(total, tipo) {
    var p = pct(tipo), b = Math.round(total * 100 / (100 + p)), c = [b, b - 1, b + 1];
    for (var k = 0; k < c.length; k++) if (c[k] + Math.round(c[k] * p / 100) === total) return c[k];
    return b;
  }
  function suma(a, b) { return { base: a.base + b.base, iva: a.iva + b.iva, total: a.total + b.total }; }
  function cero() { return { base: 0, iva: 0, total: 0 }; }
  function miles(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  /** Céntimos → «1.250,00 €» (y «−» delante si es negativo). */
  function eur(c) {
    c = Math.round(c || 0);
    var s = c < 0 ? '−' : '', a = Math.abs(c), e = Math.floor(a / 100), d = a % 100;
    return s + miles(e) + ',' + (d < 10 ? '0' : '') + d + ' €';
  }
  /** Céntimos → «1.250 €», sin decimales (cifras de resumen y barras). */
  function eur0(c) { c = Math.round((c || 0) / 100); return (c < 0 ? '−' : '') + miles(Math.abs(c)) + ' €'; }
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
  /** Los n periodos anteriores a p (el más cercano primero). lista: la de periodos(), del más reciente al más antiguo. */
  function anteriores(lista, p, n) {
    var i = p ? lista.map(function (x) { return x.id; }).indexOf(p.id) : -1;
    return i < 0 ? [] : lista.slice(i + 1, i + 1 + (n || 1));
  }
  /** ¿Es m de esa parte del desglose? des: '' todas, '-' la general (sin desglose), o el ID. */
  function deDes(d, f, des) {
    if (!des || !d.cfg.DESGLOSE) return true;
    var v = String(f[d.cfg.DESGLOSE] || '');
    return des === '-' ? !v : v === des;
  }
  function movDe(d, p, des) {
    var P = d.cfg.PERIODO;
    if (!p) return [];
    return d.mov.filter(function (m) { return (P ? String(m[P] || '') === p.id : String(m.FECHA || '').slice(0, 4) === p.id) && deDes(d, m, des); });
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
  /** ¿Va el presupuesto por desglose? Solo si hay DESGLOSE y PRESUPUESTOS tiene esa columna. */
  function presPorDes(d) { return !!d.cfg.DESGLOSE && d.colsPre.indexOf(d.cfg.DESGLOSE) >= 0; }
  function preDe(d, p, des) {
    var xs = !presPorPeriodo(d) ? d.pre : p ? d.pre.filter(function (r) { return String(r[d.cfg.PERIODO] || '') === p.id; }) : [];
    return des && presPorDes(d) ? xs.filter(function (r) { return deDes(d, r, des); }) : xs;
  }
  /** ¿Es una categoría del reparto del beneficio (config REPARTO)? */
  function esReparto(d, c) { return !!d.cfg.REPARTO && !!c && String(c.GRUPO || '') === String(d.cfg.REPARTO); }

  /**
   * Ingresos y gastos del periodo (base, IVA y total), resultado (base) e IVA a pagar (repercutido − soportado).
   * Con REPARTO, lo de esas categorías no es gasto: va en reparto (base) y tras = resultado − reparto.
   */
  function resumen(d, p, des) {
    var ing = cero(), gas = cero(), rep = 0, iva = 0, n = 0, ix = indice(d.cat);
    movDe(d, p, des).forEach(function (m) {
      var x = importe(m);
      if (m.TIPO === 'Ingreso') { ing = suma(ing, x); iva += x.iva; n++; }
      else if (m.TIPO === 'Gasto') {
        iva -= x.iva; n++;
        if (esReparto(d, ix[m.ID_CATEGORIA])) rep += x.base; else gas = suma(gas, x);
      }
    });
    return { ingresos: ing, gastos: gas, resultado: ing.base - gas.base, iva: iva, n: n, reparto: rep, tras: ing.base - gas.base - rep };
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
  /**
   * Una cuenta con todos sus movimientos: { entra, sale, saldo, filas: [{ m, imp, saldo }] }, la más reciente primero;
   * imp es lo que entra (+) o sale (−) de esa cuenta y saldo, lo que queda después de ese movimiento.
   */
  function cuenta(d, id) {
    id = String(id);
    var xs = d.mov.filter(function (m) { return String(m.ID_CUENTA) === id || (m.TIPO === 'Interno' && String(m.ID_CUENTA_DESTINO) === id); })
      .sort(function (a, b) { return String(a.FECHA) < String(b.FECHA) ? -1 : String(a.FECHA) > String(b.FECHA) ? 1 : String(a.ID) < String(b.ID) ? -1 : 1; });
    var s = 0, entra = 0, sale = 0;
    var filas = xs.map(function (m) {
      var t = importe(m).total, imp = m.TIPO === 'Ingreso' ? t : m.TIPO === 'Gasto' ? -t : String(m.ID_CUENTA) === id ? -t : t;
      s += imp; if (imp > 0) entra += imp; else sale -= imp;
      return { m: m, imp: imp, saldo: s };
    });
    return { entra: entra, sale: sale, saldo: s, filas: filas.reverse() };
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
  /** Ingresos y gastos del periodo con una categoría del otro tipo (para corregirlos en el Excel). */
  function cruzados(d, p, des) {
    var ix = indice(d.cat);
    return movDe(d, p, des).filter(function (m) { var c = ix[m.ID_CATEGORIA]; return c && (m.TIPO === 'Ingreso' || m.TIPO === 'Gasto') && c.TIPO !== m.TIPO; });
  }
  /** Gastos del periodo sin factura ni ticket (el reparto no lleva factura). */
  function sinFactura(d, p, des) {
    var ix = indice(d.cat);
    return movDe(d, p, des).filter(function (m) { return m.TIPO === 'Gasto' && !m.ID_FACTURA && !esReparto(d, ix[m.ID_CATEGORIA]); });
  }

  /**
   * Presupuesto del periodo por categoría: [{ cat, tipo, grupo, previsto, real, dif, filas }]. dif > 0 es bueno: en un
   * gasto, lo que queda; en un ingreso, lo que se ha ganado de más. En céntimos, sin IVA.
   * Un movimiento del tipo contrario a su categoría (un gasto en una categoría de ingreso: una devolución) resta de ella;
   * así ingresos menos gastos da lo mismo que el resultado del resumen.
   */
  function presupuesto(d, p, des) {
    var real = {}, prev = {}, filas = {}, ix = indice(d.cat);
    movDe(d, p, des).forEach(function (m) {
      var c = ix[m.ID_CATEGORIA];
      if (!c || (m.TIPO !== 'Ingreso' && m.TIPO !== 'Gasto')) return;
      real[c.ID] = (real[c.ID] || 0) + (m.TIPO === c.TIPO ? 1 : -1) * importe(m).base;
    });
    preDe(d, p, des).forEach(function (r) {
      var c = String(r.ID_CATEGORIA || '');
      prev[c] = (prev[c] || 0) + cts(r.IMPORTE);
      (filas[c] = filas[c] || []).push(r);
    });
    return d.cat.map(function (c) {
      var id = String(c.ID), pv = prev[id] || 0, rl = real[id] || 0;
      return { cat: c, tipo: c.TIPO, grupo: String(c.GRUPO || ''), previsto: pv, real: rl, dif: c.TIPO === 'Gasto' ? pv - rl : rl - pv, filas: filas[id] || [] };
    });
  }
  /**
   * Las filas de presupuesto() juntadas por GRUPO, sin el reparto: [{ tipo, grupo, previsto, real, dif, cats }], en el
   * orden de CATEGORIAS. Una categoría sin grupo va en uno con su nombre.
   */
  function grupos(d, ps) {
    var o = {}, orden = [];
    ps.forEach(function (x) {
      if (esReparto(d, x.cat) || (x.tipo !== 'Ingreso' && x.tipo !== 'Gasto')) return;
      var k = x.tipo + '|' + (x.grupo || x.cat.NOMBRE);
      if (!o[k]) { o[k] = { tipo: x.tipo, grupo: x.grupo || String(x.cat.NOMBRE), previsto: 0, real: 0, cats: [] }; orden.push(k); }
      o[k].previsto += x.previsto; o[k].real += x.real; o[k].cats.push(x);
    });
    return orden.map(function (k) { var g = o[k]; g.dif = g.tipo === 'Gasto' ? g.previsto - g.real : g.real - g.previsto; return g; });
  }
  /** Cómo va una partida frente a lo previsto, en palabras: { t, mal, bien } (como en la Economía 4.1). */
  function estadoLinea(tipo, previsto, real) {
    var p = previsto || 0, r = real || 0;
    if (!p && !r) return { t: '', mal: false, bien: false };
    if (tipo === 'Gasto') {
      if (!p) return { t: 'Sin presupuesto', mal: true, bien: false };
      if (r > p + 50) return { t: 'Te has pasado ' + eur0(r - p), mal: true, bien: false };
      return { t: 'Quedan ' + eur0(p - r), mal: false, bien: true };
    }
    if (!p) return { t: '+' + eur0(r) + ' sin prever', mal: false, bien: true };
    if (r + 50 < p) return { t: 'Faltan ' + eur0(p - r), mal: true, bien: false };
    return { t: r - p >= 50 ? '+' + eur0(r - p) + ' más de lo previsto' : 'Cobrado todo', mal: false, bien: true };
  }
  /** Avisos para afinar el presupuesto del periodo: gastos pasados y gastos sin presupuesto. */
  function avisos(d, ps) {
    var out = [];
    ps.forEach(function (x) {
      if (x.tipo !== 'Gasto' || esReparto(d, x.cat) || x.real <= 0) return;
      if (!x.previsto) out.push({ cat: x.cat, orden: 2, t: 'Lleva ' + eur0(x.real) + ' gastados y no tiene presupuesto.' });
      else if (x.real > x.previsto + 50) out.push({ cat: x.cat, orden: 1, t: 'Te has pasado: ' + eur0(x.real) + ' de ' + eur0(x.previsto) + ' (' + eur0(x.real - x.previsto) + ' más).' });
    });
    return out.sort(function (a, b) { return a.orden - b.orden; });
  }

  /** Resultado del periodo por DESGLOSE: [{ id, nombre, ingresos, gastos, resultado }] (base), o null sin desglose. */
  function desglose(d, p) {
    var D = d.cfg.DESGLOSE;
    if (!D) return null;
    var g = {}, orden = [], nom = indice(d.des), ix = indice(d.cat);
    movDe(d, p).forEach(function (m) {
      if (m.TIPO !== 'Ingreso' && m.TIPO !== 'Gasto') return;
      if (m.TIPO === 'Gasto' && esReparto(d, ix[m.ID_CATEGORIA])) return;
      var k = String(m[D] || '');
      if (!g[k]) { g[k] = { id: k, nombre: k ? String((nom[k] || {}).NOMBRE || k) : 'General', ingresos: 0, gastos: 0 }; orden.push(k); }
      if (m.TIPO === 'Ingreso') g[k].ingresos += importe(m).base; else g[k].gastos += importe(m).base;
    });
    return orden.map(function (k) { g[k].resultado = g[k].ingresos - g[k].gastos; return g[k]; })
      .sort(function (a, b) { return !a.id ? 1 : !b.id ? -1 : a.nombre.localeCompare(b.nombre, 'es'); });
  }

  /**
   * T0272 · Recomendación del presupuesto del periodo p para cada categoría (sin el reparto):
   * [{ cat, tipo, grupo, ant: [{ p, real }], rec, razon, medida, partes: { ID_DESGLOSE: rec } }], en céntimos, sin IVA,
   * redondeado al euro.
   * - Con una medida para su grupo (med = { Equipos: { grupos, periodo: { id: n }, desglose: { id: n } } }) y la medida del
   *   periodo anterior y de este: lo real del anterior por cada una (equipo, partido…), por las de ahora. Si la medida
   *   pasa por el desglose, también cuánto le toca a cada parte de este periodo (y rec es su suma), con sus medidas en
   *   unidades: { ID_DESGLOSE: n }, y lo que sale por cada una en porUna.
   * - Si no: lo real del periodo anterior.
   */
  function recomendar(d, p, lista, med) {
    var ant = anteriores(lista, p, 2), p1 = ant[0], P = d.cfg.PERIODO;
    var reales = ant.map(function (x) { var o = {}; presupuesto(d, x).forEach(function (r) { o[r.cat.ID] = r.real; }); return o; });
    var deGrupo = {};
    Object.keys(med || {}).forEach(function (n) { (med[n].grupos || []).forEach(function (g) { deGrupo[g] = n; }); });
    var ixDes = indice(d.des);
    function euro(c) { return Math.round(c / 100) * 100; }
    return d.cat.filter(function (c) { return !esReparto(d, c) && (c.TIPO === 'Ingreso' || c.TIPO === 'Gasto'); }).map(function (c) {
      var r = { cat: c, tipo: c.TIPO, grupo: String(c.GRUPO || ''), ant: ant.map(function (x, i) { return { p: x, real: reales[i][c.ID] || 0 }; }),
        rec: null, razon: '', medida: '', partes: null, unidades: null, porUna: 0 };
      if (!p1) { r.razon = 'No hay ' + String(d.cfg.NOMBRE_PERIODO || 'periodo').toLowerCase() + ' anterior con que comparar.'; return r; }
      var real1 = r.ant[0].real, n = deGrupo[r.grupo], M = n ? med[n] : null;
      var n1 = M && M.periodo ? M.periodo[p1.id] || 0 : 0, n0 = M && M.periodo ? M.periodo[p.id] || 0 : 0, uni = String(n || '').toLowerCase();
      if (M && n1 && n0) {
        var tasa = real1 / n1;
        r.medida = n; r.porUna = tasa;
        r.rec = euro(tasa * n0);
        r.razon = eur0(real1) + ' con ' + n1 + ' ' + uni + ' la ' + p1.nombre + ' → ' + n0 + ' ' + uni + ' ahora';
        var ks = Object.keys(M.desglose || {}).filter(function (k) { var x = ixDes[k]; return x && P && String(x[P] || '') === p.id; });
        if (ks.length && real1) {
          r.partes = {}; r.unidades = {}; var tot = 0;
          ks.forEach(function (k) { r.partes[k] = euro(tasa * M.desglose[k]); r.unidades[k] = M.desglose[k]; tot += r.partes[k]; });
          r.rec = tot;
        }
      } else {
        r.rec = euro(real1);
        r.razon = M && n1 && !n0 ? 'Aún no hay ' + uni + ' de la ' + p.nombre + ': lo real de la ' + p1.nombre : 'Lo real de la ' + p1.nombre;
      }
      return r;
    });
  }

  /**
   * Comprueba un movimiento antes de guardarlo (lo que el YAML deja como «condicional»): devuelve los problemas.
   * La validación de tipos, listas y referencias la hace además el motor (TABLAS_API.gs).
   */
  function problemasMov(v, cfg) {
    var mal = [];
    if (!v.FECHA) mal.push('Falta la fecha.');
    if (!String(v.CONCEPTO || '').trim()) mal.push('Falta el concepto.');
    if (!(cts(v.BASE) > 0)) mal.push('El importe tiene que ser mayor que 0 (el signo lo da si entra o sale dinero).');
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

  var CALC = { cts: cts, pct: pct, importe: importe, baseDeTotal: baseDeTotal, eur: eur, eur0: eur0, fecha: fecha, periodos: periodos, periodoActual: periodoActual,
    anteriores: anteriores, movDe: movDe, facDe: facDe, preDe: preDe, resumen: resumen, saldos: saldos, cuenta: cuenta, pendientes: pendientes,
    sinFactura: sinFactura, presupuesto: presupuesto, grupos: grupos, estadoLinea: estadoLinea, avisos: avisos, cruzados: cruzados,
    desglose: desglose, recomendar: recomendar, esReparto: esReparto, problemasMov: problemasMov };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  var TABLAS = ['MOVIMIENTOS', 'CATEGORIAS', 'CUENTAS', 'CONTRAPARTES', 'FACTURAS', 'PRESUPUESTOS'];
  var PESTANAS = { RESUMEN: 'Resumen', MOVIMIENTOS: 'Movimientos', CAJA: 'Caja', PENDIENTE: 'Pendiente', FACTURAS: 'Facturas', PRESUPUESTO: 'Presupuesto' };
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
  function barra(p, mal) { p = Math.max(0, Math.min(1, p || 0)) * 100; return '<div class="eco-barra-p"><i' + (mal ? ' class="eco-pasado"' : '') + ' style="width:' + p.toFixed(1) + '%"></i></div>'; }
  function clase(e) { return e.mal ? 'u-mal' : e.bien ? 'eco-bien' : ''; }

  window.UN.registrar('ECONOMIA', {
    abrir: function (el, ctx) {
      var T = ctx.tablas, cfg = ctx.config || {}, R = cfg._refs || {};
      var P = String(cfg.PERIODO || ''), DS = String(cfg.DESGLOSE || '');
      var nomPer = String(cfg.NOMBRE_PERIODO || 'Año'), nomDes = String(cfg.NOMBRE_DESGLOSE || DS);
      var tablas = TABLAS.concat(R.PERIODO ? [R.PERIODO] : [], R.DESGLOSE && R.DESGLOSE !== R.PERIODO ? [R.DESGLOSE] : []);
      var pest = String(cfg.PESTANAS || Object.keys(PESTANAS).join(',')).split(',').map(function (s) { return s.trim().toUpperCase(); })
        .filter(function (s) { return PESTANAS[s]; });
      if (!pest.length) pest = Object.keys(PESTANAS);
      var prepara = ctx.admin || String(cfg.PREPARA_PRESUPUESTO || '').split(',').map(function (s) { return s.trim(); }).indexOf(ctx.perfil) >= 0;
      var CLAVE = 'eco_' + ctx.id + '_';
      function movVacio() { return { tipo: '', cat: '', cue: '', q: '', sinFac: false, cruz: false, ver: VER, desde: '' }; }
      var S = { tab: pest.indexOf(guardado(CLAVE + 'tab')) >= 0 ? guardado(CLAVE + 'tab') : pest[0], per: guardado(CLAVE + 'per'), des: '',
        mov: movVacio(), fac: { tipo: '', estado: '' }, caja: { cue: '', ceros: false }, ab: {}, ceros: false, medidas: null, leido: false };

      el.innerHTML = (cfg.AYUDA ? '<p class="u-nota n-ayuda">' + texto(cfg.AYUDA) + '</p>' : '') +
        '<div class="eco-barra"><label class="u-campo eco-per"><span class="u-etiqueta">' + texto(nomPer) + '</span><select id="eco-per"></select></label>' +
        '<div class="u-pestanas" role="tablist">' + pest.map(function (p) {
          return '<button type="button" role="tab" data-tab="' + p + '">' + PESTANAS[p] + (p === 'PENDIENTE' ? ' <span class="u-chip" id="eco-npend" hidden></span>' : '') + '</button>';
        }).join('') + '</div></div>' +
        '<div id="eco-cont" class="eco-cont"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<button type="button" class="eco-fab" data-accion="apuntar">Añadir movimiento</button>' +
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
      function nomPeriodo() { return per ? per.nombre : ''; }
      /** Las partes del desglose de este periodo (si su tabla tiene la columna del periodo, solo las de ese periodo). */
      function desDelPeriodo() {
        return d.des.filter(function (r) { return !per || !P || !(P in r) || String(r[P]) === per.id; });
      }
      /** Movimiento con su signo: lo que entra (+) o sale (−); un interno, 0. */
      function signo(m) { var t = importe(m).total; return m.TIPO === 'Gasto' ? -t : m.TIPO === 'Ingreso' ? t : 0; }

      /* ---------- pintar ---------- */

      function pintar() {
        if (!S.leido) return;
        preparar();
        [].forEach.call(el.querySelectorAll('[data-tab]'), function (b) {
          var si = b.getAttribute('data-tab') === S.tab;
          b.setAttribute('aria-selected', si ? 'true' : 'false');
          if (si && b.parentNode.scrollWidth > b.parentNode.clientWidth) b.parentNode.scrollLeft = Math.max(0, b.offsetLeft - b.parentNode.offsetLeft - 16); // en el móvil, que se vea
        });
        el.querySelector('.eco-fab').hidden = S.tab !== 'MOVIMIENTOS'; // T0272: añadir un movimiento, solo desde Movimientos
        var np = pendientes(d).filter(function (x) { return x.falta > 0; }).length + sinFactura(d, per).length, nb = el.querySelector('#eco-npend');
        if (nb) { nb.textContent = np; nb.hidden = !np; }
        if (!d.cue.length && !d.mov.length) {
          cont.innerHTML = '<p class="u-vacio">Todavía no hay cuentas ni movimientos. Añade al menos una cuenta (banco o caja) en la tabla CUENTAS del Excel ECONOMIA y apunta aquí el primer movimiento.</p>';
          return;
        }
        // Cada tabla en su caja: si no cabe en el móvil, se desplaza ella y no la página.
        cont.innerHTML = ({ RESUMEN: htmlResumen, MOVIMIENTOS: htmlMovimientos, CAJA: htmlCaja, PENDIENTE: htmlPendiente, FACTURAS: htmlFacturas, PRESUPUESTO: htmlPresupuesto })[S.tab]()
          .replace(/<table class="u-tabla eco-tabla">/g, '<div class="u-tabla-caja"><table class="u-tabla eco-tabla">').replace(/<\/table>/g, '</table></div>');
        var q = cont.querySelector('#eco-q');
        if (q && S.foco) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
        S.foco = false;
      }
      function chip(f) { return f && (f._pendiente || f._nueva) ? ' <span class="u-chip">Guardando</span>' : ''; }

      /* ----- Resumen ----- */

      /** Ingresos o gastos por grupo, con su barra, que se abren en sus categorías (y cada categoría, en sus movimientos). */
      function htmlGrupos(gs, tipo) {
        var xs = gs.filter(function (g) { return g.tipo === tipo && (g.previsto || g.real); });
        if (!xs.length) return '';
        return '<section><h2 class="n-grupo">' + (tipo === 'Ingreso' ? 'Ingresos' : 'Gastos') + ' · real frente a lo previsto</h2><div class="eco-card">' + xs.map(function (g) {
          var id = tipo + '|' + g.grupo, ab = !!S.ab[id], e = estadoLinea(tipo, g.previsto, g.real);
          var cats = g.cats.filter(function (x) { return x.previsto || x.real; });
          return '<div class="eco-grupo"><button type="button" class="eco-gb" data-grupo="' + texto(id) + '" aria-expanded="' + ab + '">' +
            '<div class="eco-gl"><b><span class="eco-flecha" aria-hidden="true">›</span>' + texto(g.grupo) + '</b><span class="eco-num">' + eur0(g.real) + '</span></div>' +
            barra(g.previsto ? g.real / g.previsto : g.real ? 1 : 0, tipo === 'Gasto' && e.mal) +
            '<div class="eco-gs"><span>' + (g.previsto ? 'Previsto ' + eur0(g.previsto) : 'Sin previsto') + '</span><span class="' + clase(e) + '"><b>' + texto(e.t) + '</b></span></div></button>' +
            '<div class="eco-lineas"' + (ab ? '' : ' hidden') + '>' + cats.map(function (x) {
              var ec = estadoLinea(tipo, x.previsto, x.real);
              return '<button type="button" class="eco-linea" data-vercat="' + texto(x.cat.ID) + '" title="Ver sus movimientos">' +
                '<div class="eco-gl"><b>' + texto(x.cat.NOMBRE) + '</b><span class="eco-num">' + eur0(x.real) + ' <span class="eco-ir" aria-hidden="true">›</span></span></div>' +
                barra(x.previsto ? x.real / x.previsto : x.real ? 1 : 0, tipo === 'Gasto' && ec.mal) +
                '<div class="eco-gs"><span>' + (x.previsto ? 'de ' + eur0(x.previsto) : 'Sin previsto') + '</span><span class="' + clase(ec) + '"><b>' + texto(ec.t) + '</b></span></div></button>';
            }).join('') + '</div></div>';
        }).join('') + '</div></section>';
      }

      /** Desplegable «Beneficio y reparto»: beneficio → reparto (a quién) → lo que queda. */
      function htmlReparto(r) {
        if (!cfg.REPARTO) return '';
        var quien = {}, orden = [];
        movDe(d, per, S.des).forEach(function (m) {
          if (m.TIPO !== 'Gasto' || !esReparto(d, ix.cat[m.ID_CATEGORIA])) return;
          var k = m.ID_CONTRAPARTE ? nombre('ctr', m.ID_CONTRAPARTE) : String(m.CONCEPTO || '');
          if (!(k in quien)) { quien[k] = 0; orden.push(k); }
          quien[k] += importe(m).base;
        });
        return '<details class="eco-card eco-desp" id="eco-rep"' + (S.ab.rep ? ' open' : '') + '><summary><b><span class="eco-flecha" aria-hidden="true">›</span> Beneficio y reparto</b>' +
          '<span class="u-nota">' + (r.reparto ? 'repartido ' + eur0(r.reparto) : 'sin reparto') + '</span></summary>' +
          '<div class="eco-rf"><span>Beneficio<small>Ingresos menos gastos de la ' + texto(nomPeriodo()) + ', sin IVA</small></span><span>' + eur0(r.resultado) + '</span></div>' +
          '<div class="eco-rf"><span>Reparto</span><span>' + (r.reparto ? '− ' + eur0(r.reparto) : '0 €') + '</span></div>' +
          orden.map(function (k) { return '<div class="eco-rf eco-rf-sub"><span>' + texto(k) + '</span><span>' + eur0(quien[k]) + '</span></div>'; }).join('') +
          '<div class="eco-rf eco-rf-tot"><span>Resultado<small>Lo que queda tras el reparto</small></span><span class="' + (r.tras < 0 ? 'u-mal' : '') + '">' + eur0(r.tras) + '</span></div></details>';
      }

      function htmlResumen() {
        var r = resumen(d, per, S.des), ps = presupuesto(d, per, S.des), gs = grupos(d, ps);
        var pi = 0, pg = 0; gs.forEach(function (g) { if (g.tipo === 'Ingreso') pi += g.previsto; else pg += g.previsto; });
        var pb = pi - pg, desv = r.resultado - pb, ds = desglose(d, per), h = '';
        if (ds && ds.length) {
          h += '<div class="u-filtros eco-filtro-des"><label class="u-campo"><span class="u-etiqueta">' + texto(nomDes) + '</span><select id="eco-des">' +
            opciones(ds.map(function (x) { return [x.id || '-', x.nombre]; }), S.des, 'Todas') + '</select></label></div>';
        }
        h += '<div class="eco-kpis">' +
          '<div class="eco-kpi eco-grande"><b>Beneficio <span class="eco-pint">' + texto(nomPeriodo()) + '</span></b><span class="eco-val">' + eur0(r.resultado) + '</span>' +
          '<span class="eco-sub">' + (pb || pi || pg ? 'Previsto ' + eur0(pb) + ' · ' + eur0(Math.abs(desv)) + (desv >= 0 ? ' mejor' : ' peor') + ' de lo previsto' : 'Sin presupuesto') + '</span></div>' +
          '<div class="eco-kpi"><b>Ingresos</b><span class="eco-val">' + eur0(r.ingresos.base) + '</span><span class="eco-sub">' + (pi ? 'de ' + eur0(pi) + ' previstos' : 'sin IVA') + '</span></div>' +
          '<div class="eco-kpi"><b>Gastos</b><span class="eco-val">' + eur0(r.gastos.base) + '</span><span class="eco-sub">' + (pg ? 'de ' + eur0(pg) + ' previstos' : 'sin IVA') + '</span></div></div>';
        var pend = pendientes(d).filter(function (x) { return x.falta > 0; }), sf = sinFactura(d, per, S.des);
        h += '<div class="eco-mini"><button type="button" data-abrir="iva"><strong>' + eur0(Math.abs(r.iva)) + '</strong><small>IVA ' + (r.iva >= 0 ? 'a pagar' : 'a devolver') + '</small></button>' +
          '<button type="button" data-ir="PENDIENTE"><strong' + (sf.length ? ' class="u-mal"' : '') + '>' + sf.length + '</strong><small>Gastos sin factura ›</small></button>' +
          '<button type="button" data-ir="PENDIENTE"><strong>' + pend.length + '</strong><small>Facturas pendientes ›</small></button></div>';
        h += '<details class="eco-card eco-desp" id="eco-iva"' + (S.ab.iva ? ' open' : '') + '><summary><b><span class="eco-flecha" aria-hidden="true">›</span> Ingresos, gastos e IVA</b>' +
          '<span class="u-nota">' + r.n + (r.n === 1 ? ' movimiento' : ' movimientos') + '</span></summary>' +
          '<table class="u-tabla eco-tabla"><thead><tr><th></th><th class="num">Sin IVA</th><th class="num">IVA</th><th class="num u-solo-ancho">Total</th></tr></thead><tbody>' +
          '<tr><td class="u-tabla-t">Ingresos</td><td class="num">' + eur(r.ingresos.base) + '</td><td class="num">' + eur(r.ingresos.iva) + '</td><td class="num u-solo-ancho">' + eur(r.ingresos.total) + '</td></tr>' +
          '<tr><td class="u-tabla-t">Gastos</td><td class="num">' + eur(r.gastos.base) + '</td><td class="num">' + eur(r.gastos.iva) + '</td><td class="num u-solo-ancho">' + eur(r.gastos.total) + '</td></tr>' +
          '<tr class="eco-total"><td class="u-tabla-t">Beneficio</td><td class="num">' + cifra(r.resultado, true) + '</td><td class="num">' + eur(r.iva) + '</td><td class="num u-solo-ancho"></td></tr>' +
          '</tbody></table><p class="u-nota">' + (r.iva >= 0 ? 'IVA a pagar: ' + eur(r.iva) : 'IVA a devolver: ' + eur(-r.iva)) +
          ' (el de los ingresos menos el de los gastos' + (r.reparto ? ', también el del reparto' : '') + '). Los movimientos entre cuentas no cuentan.</p></details>';
        h += htmlReparto(r);
        h += '<div class="eco-bloques">' + htmlGrupos(gs, 'Ingreso') + htmlGrupos(gs, 'Gasto') + '</div>';
        if (ds && ds.length > 1 && !S.des) {
          h += '<h2 class="n-grupo">Por ' + texto(nomDes.toLowerCase()) + '</h2><table class="u-tabla eco-tabla"><thead><tr><th>' + texto(nomDes) + '</th><th class="num u-solo-ancho">Ingresos</th><th class="num u-solo-ancho">Gastos</th><th class="num">Beneficio</th></tr></thead><tbody>' +
            ds.map(function (x) { return '<tr tabindex="0" data-verdes="' + texto(x.id || '-') + '"><td class="u-tabla-t">' + texto(x.nombre) + '<div class="u-nota u-solo-movil">Ingresos ' + eur0(x.ingresos) + ' · gastos ' + eur0(x.gastos) + '</div></td><td class="num u-solo-ancho">' + eur0(x.ingresos) + '</td><td class="num u-solo-ancho">' + eur0(x.gastos) + '</td><td class="num"><span class="u-cifra' + (x.resultado < 0 ? ' u-mal' : '') + '">' + eur0(x.resultado) + '</span></td></tr>'; }).join('') +
            '</tbody></table><p class="u-nota">Sin IVA. Toca una para ver solo la suya.</p>';
        }
        var cz = cruzados(d, per, S.des);
        if (cz.length) h += '<p class="u-nota">' + cz.length + (cz.length === 1 ? ' movimiento tiene' : ' movimientos tienen') + ' una categoría del otro tipo: restan de su categoría, como una devolución. ' +
          (pest.indexOf('MOVIMIENTOS') >= 0 ? '<button type="button" class="u-btn u-btn-texto" data-accion="cruzados">Ver esos movimientos</button>' : '') + '</p>';
        if (!r.n && !ps.some(function (x) { return x.previsto; })) h += '<p class="u-vacio">Todavía no hay movimientos en la ' + texto(nomPeriodo()) + '. Los que apuntes en Movimientos salen aquí al momento.</p>';
        return h;
      }

      /* ----- Movimientos ----- */

      function movFiltrados() {
        var f = S.mov, q = norm(f.q);
        return movDe(d, per, S.des).filter(function (m) {
          if (f.tipo && m.TIPO !== f.tipo) return false;
          if (f.cat && String(m.ID_CATEGORIA) !== f.cat) return false;
          if (f.cue && String(m.ID_CUENTA) !== f.cue && String(m.ID_CUENTA_DESTINO) !== f.cue) return false;
          if (f.sinFac && (m.TIPO !== 'Gasto' || m.ID_FACTURA || esReparto(d, ix.cat[m.ID_CATEGORIA]))) return false;
          if (f.cruz && !(ix.cat[m.ID_CATEGORIA] && (m.TIPO === 'Ingreso' || m.TIPO === 'Gasto') && ix.cat[m.ID_CATEGORIA].TIPO !== m.TIPO)) return false;
          if (q && norm([m.CONCEPTO, m.NOTAS, nombre('ctr', m.ID_CONTRAPARTE), nombre('cat', m.ID_CATEGORIA), m.ID].join(' ')).indexOf(q) < 0) return false;
          return true;
        }).sort(function (a, b) { return String(a.FECHA) < String(b.FECHA) ? 1 : String(a.FECHA) > String(b.FECHA) ? -1 : String(a.ID) < String(b.ID) ? 1 : -1; });
      }
      function sinFac(m) { return m.TIPO === 'Gasto' && !m.ID_FACTURA && !esReparto(d, ix.cat[m.ID_CATEGORIA]); }
      function filaMov(m, extra) {
        var interno = m.TIPO === 'Interno', s = signo(m);
        var sub = [fecha(m.FECHA), interno ? nombre('cue', m.ID_CUENTA) + ' → ' + nombre('cue', m.ID_CUENTA_DESTINO) : nombre('cat', m.ID_CATEGORIA),
          DS && m[DS] ? nombre('des', m[DS]) : '', interno ? '' : nombre('ctr', m.ID_CONTRAPARTE)].filter(Boolean).join(' · ');
        return '<tr tabindex="0" data-mov="' + texto(m.ID) + '"><td class="u-tabla-t">' + texto(m.CONCEPTO) + chip(m) +
          (sinFac(m) ? ' <span class="u-chip">Sin factura</span>' : '') + '<div class="u-nota">' + texto(sub) + '</div></td>' +
          '<td class="num u-solo-ancho">' + texto(interno ? '' : nombre('cue', m.ID_CUENTA)) + '</td>' +
          '<td class="num">' + (interno ? '<span class="u-cifra">' + eur(importe(m).total) + '</span><div class="u-nota">Entre cuentas</div>' :
            '<span class="u-cifra ' + (s < 0 ? 'u-mal' : 'eco-bien') + '">' + (s > 0 ? '+' : '') + eur(s) + '</span>') + (extra || '') + '</td></tr>';
      }

      function htmlMovimientos() {
        var f = S.mov, ms = movFiltrados(), neto = 0;
        ms.forEach(function (m) { neto += signo(m); });
        var cats = d.cat.filter(function (c) { return !f.tipo || c.TIPO === f.tipo; }).map(function (c) { return [c.ID, c.NOMBRE]; });
        var h = (f.desde ? '<button type="button" class="u-btn u-btn-texto eco-volver" data-accion="volver">‹ Volver a ' + texto(PESTANAS[f.desde] || 'Resumen') + '</button>' : '') +
          '<div class="u-filtros">' +
          '<label class="u-campo"><span class="u-etiqueta">Buscar</span><input type="search" id="eco-q" value="' + texto(f.q) + '" placeholder="Concepto, contraparte…"></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Tipo</span><select data-filtro="tipo">' + opciones([['Ingreso', 'Entra dinero'], ['Gasto', 'Sale dinero'], ['Interno', 'Entre cuentas']], f.tipo, 'Todos') + '</select></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Categoría</span><select data-filtro="cat">' + opciones(cats, f.cat, 'Todas') + '</select></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Cuenta</span><select data-filtro="cue">' + opciones(d.cue.map(function (c) { return [c.ID, c.NOMBRE]; }), f.cue, 'Todas') + '</select></label>' +
          '<label class="u-check"><input type="checkbox" data-filtro="sinFac"' + (f.sinFac ? ' checked' : '') + '> Gastos sin factura</label>' +
          (f.cruz ? '<label class="u-check"><input type="checkbox" data-filtro="cruz" checked> Con categoría del otro tipo</label>' : '') + '</div>' +
          (S.des ? '<p class="u-nota">Solo ' + texto(S.des === '-' ? 'General' : nombre('des', S.des)) + ' · <button type="button" class="u-btn u-btn-texto" data-accion="todasdes">ver ' + texto(nomDes.toLowerCase()) + ': todas</button></p>' : '');
        if (!ms.length) return h + '<p class="u-vacio">' + (movDe(d, per, S.des).length ? 'Ningún movimiento cumple el filtro. Quita algún filtro para ver más.' :
          'Todavía no hay movimientos en la ' + texto(nomPeriodo() || 'este periodo') + '. Los que apuntes con «Añadir movimiento» salen aquí al momento.') + '</p>';
        h += '<p class="u-nota">' + ms.length + (ms.length === 1 ? ' movimiento' : ' movimientos') + ' · suman <b class="' + (neto < 0 ? 'u-mal' : 'eco-bien') + '">' + eur(neto) + '</b> (entra menos sale, con IVA)</p>' +
          '<table class="u-tabla eco-tabla"><thead><tr><th>Movimiento</th><th class="num u-solo-ancho">Cuenta</th><th class="num">Importe</th></tr></thead><tbody>' + ms.slice(0, f.ver).map(function (m) { return filaMov(m); }).join('') + '</tbody></table>';
        if (ms.length > f.ver) h += '<button type="button" class="u-btn" data-accion="vermas">Ver ' + Math.min(VER, ms.length - f.ver) + ' movimientos más</button>';
        return h;
      }

      /* ----- Caja ----- */

      function htmlCaja() {
        if (S.caja.cue && ix.cue[S.caja.cue]) return htmlCuenta(ix.cue[S.caja.cue]);
        var sal = saldos(d), tipos = [], por = {}, tot = 0, ceros = 0;
        d.cue.forEach(function (c) {
          var t = String(c.TIPO || 'Otras');
          if (!sal[c.ID]) { ceros++; if (!S.caja.ceros) return; }
          if (!por[t]) { por[t] = []; tipos.push(t); }
          por[t].push(c); tot += sal[c.ID] || 0;
        });
        var h = '<p class="u-nota">El dinero que hay en cada cuenta, con todos los movimientos (no solo los de la ' + texto(nomPeriodo()) + '). Toca una para ver lo que entra y sale.</p>';
        if (!tipos.length) return h + '<p class="u-vacio">Todas las cuentas están a cero.</p>';
        tipos.forEach(function (t) {
          var st = 0;
          h += '<h2 class="n-grupo">' + texto(t) + '</h2><table class="u-tabla eco-tabla"><tbody>' + por[t].map(function (c) {
            st += sal[c.ID] || 0;
            return '<tr tabindex="0" data-cuenta="' + texto(c.ID) + '"><td class="u-tabla-t">' + texto(c.NOMBRE) + '</td><td class="num">' + cifra(sal[c.ID] || 0, true) + ' <span class="eco-ir" aria-hidden="true">›</span></td></tr>';
          }).join('') + (por[t].length > 1 ? '<tr class="eco-total"><td class="u-tabla-t">Total ' + texto(t.toLowerCase()) + '</td><td class="num">' + cifra(st, true) + '</td></tr>' : '') + '</tbody></table>';
        });
        h += '<table class="u-tabla eco-tabla"><tbody><tr class="eco-total"><td class="u-tabla-t">Total de todas las cuentas</td><td class="num">' + cifra(tot, true) + '</td></tr></tbody></table>';
        if (ceros) h += '<button type="button" class="u-btn u-btn-texto" data-accion="ceroscaja">' + (S.caja.ceros ? 'Ocultar las cuentas a cero' : 'Ver también las ' + ceros + ' cuentas a cero') + '</button>';
        return h;
      }
      function htmlCuenta(c) {
        var x = cuenta(d, c.ID), ver = S.caja.ver || VER;
        var h = '<button type="button" class="u-btn u-btn-texto eco-volver" data-accion="todascuentas">‹ Todas las cuentas</button>' +
          '<div class="eco-kpis"><div class="eco-kpi eco-grande"><b>' + texto(c.NOMBRE) + ' · saldo</b><span class="eco-val">' + eur(x.saldo) + '</span>' +
          '<span class="eco-sub">Ha entrado ' + eur0(x.entra) + ' · ha salido ' + eur0(x.sale) + '</span></div></div>';
        if (!x.filas.length) return h + '<p class="u-vacio">Esta cuenta no tiene movimientos. Los que apuntes con ella salen aquí.</p>';
        h += '<h2 class="n-grupo">Movimientos · el más reciente arriba</h2><table class="u-tabla eco-tabla"><thead><tr><th>Movimiento</th><th class="num u-solo-ancho">Saldo</th><th class="num">Importe</th></tr></thead><tbody>' +
          x.filas.slice(0, ver).map(function (y) {
            var m = y.m, sub = [fecha(m.FECHA), m.TIPO === 'Interno' ? (y.imp > 0 ? 'desde ' + nombre('cue', m.ID_CUENTA) : 'a ' + nombre('cue', m.ID_CUENTA_DESTINO)) : nombre('cat', m.ID_CATEGORIA)].filter(Boolean).join(' · ');
            return '<tr tabindex="0" data-mov="' + texto(m.ID) + '"><td class="u-tabla-t">' + texto(m.CONCEPTO) + chip(m) + '<div class="u-nota">' + texto(sub) + '<span class="u-solo-movil"> · saldo ' + eur(y.saldo) + '</span></div></td>' +
              '<td class="num u-solo-ancho">' + eur(y.saldo) + '</td><td class="num"><span class="u-cifra ' + (y.imp < 0 ? 'u-mal' : 'eco-bien') + '">' + (y.imp > 0 ? '+' : '') + eur(y.imp) + '</span></td></tr>';
          }).join('') + '</tbody></table>';
        if (x.filas.length > ver) h += '<button type="button" class="u-btn" data-accion="vermascaja">Ver ' + Math.min(VER, x.filas.length - ver) + ' movimientos más</button>';
        return h;
      }

      /* ----- Pendiente ----- */

      function htmlPendiente() {
        var pend = pendientes(d), sf = sinFactura(d, per, S.des), h = '';
        var hay = pend.length;
        [[true, 'Por cobrar'], [false, 'Por pagar']].forEach(function (g) {
          var xs = pend.filter(function (x) { return x.cobrar === g[0]; }), tot = 0;
          if (!xs.length) return;
          xs.forEach(function (x) { tot += Math.max(x.falta, 0); });
          h += '<h2 class="n-grupo">' + g[1] + ' <span class="u-cifra">' + eur(tot) + '</span></h2>' +
            '<table class="u-tabla eco-tabla"><thead><tr><th>Factura</th><th class="num">Falta</th></tr></thead><tbody>' + xs.map(function (x) {
              return '<tr tabindex="0" data-fac="' + texto(x.f.ID) + '"><td class="u-tabla-t">' + texto(numFac(x.f)) + ' · ' + texto(nombre('ctr', x.f.ID_CONTRAPARTE)) + chip(x.f) +
                '<div class="u-nota">' + fecha(x.f.FECHA) + ' · total ' + eur(x.total) + (x.pagado ? ' · ' + (g[0] ? 'cobrado ' : 'pagado ') + eur(x.pagado) : '') + '</div></td>' +
                '<td class="num">' + (x.falta > 0 ? cifra(x.falta) : '<span class="u-nota">' + (g[0] ? 'Cobrada: márcala' : 'Pagada: márcala') + '</span>') + '</td></tr>';
            }).join('') + '</tbody></table>';
        });
        if (!hay) h += '<h2 class="n-grupo">Facturas por cobrar y por pagar</h2><p class="u-vacio">No hay ninguna factura Pendiente. Una factura emitida o recibida que marques como Pendiente sale aquí hasta que se cobre o se pague.</p>';
        var tsf = 0; sf.forEach(function (m) { tsf += importe(m).total; });
        h += '<h2 class="n-grupo">Gastos sin factura · ' + texto(nomPeriodo()) + (sf.length ? ' <span class="u-cifra">' + eur(tsf) + '</span>' : '') + '</h2>';
        if (!sf.length) return h + '<p class="u-vacio">Todos los gastos de la ' + texto(nomPeriodo()) + ' tienen su factura o ticket.</p>';
        h += '<p class="u-nota">Abre cada uno y toca «Añadir su factura» para apuntarla.</p><table class="u-tabla eco-tabla"><thead><tr><th>Gasto</th><th class="num u-solo-ancho">Cuenta</th><th class="num">Importe</th></tr></thead><tbody>' +
          sf.sort(function (a, b) { return String(a.FECHA) < String(b.FECHA) ? 1 : -1; }).slice(0, 30).map(function (m) { return filaMov(m); }).join('') + '</tbody></table>';
        if (sf.length > 30 && pest.indexOf('MOVIMIENTOS') >= 0) h += '<button type="button" class="u-btn" data-accion="sinfac">Ver los ' + sf.length + ' en Movimientos</button>';
        return h;
      }

      /* ----- Facturas ----- */

      function htmlFacturas() {
        var f = S.fac;
        var fs = facDe(d, per).filter(function (x) { return (!f.tipo || x.TIPO === f.tipo) && (!f.estado || (f.estado === '-' ? !x.ESTADO : x.ESTADO === f.estado)); })
          .sort(function (a, b) { return String(a.FECHA) < String(b.FECHA) ? 1 : -1; });
        var tot = 0; fs.forEach(function (x) { if (x.ESTADO !== 'Anulada') tot += importe(x).total; });
        var h = '<div class="eco-cab"><p class="u-nota">' + fs.length + (fs.length === 1 ? ' factura' : ' facturas') + ' · ' + eur(tot) + ' con IVA (sin las anuladas)</p>' +
          '<button type="button" class="u-btn u-btn-accion" data-accion="factura">Añadir factura</button></div>' +
          '<div class="u-filtros"><label class="u-campo"><span class="u-etiqueta">Tipo</span><select data-ffac="tipo">' + opciones([['Emitida', 'Emitidas'], ['Recibida', 'Recibidas'], ['Ticket', 'Tickets']], f.tipo, 'Todas') + '</select></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Estado</span><select data-ffac="estado">' + opciones([['Pendiente', 'Pendiente'], ['Pagada', 'Pagada'], ['Anulada', 'Anulada'], ['-', 'Sin estado']], f.estado, 'Todos') + '</select></label></div>';
        if (!fs.length) return h + '<p class="u-vacio">No hay facturas ' + (f.tipo || f.estado ? 'con este filtro' : 'en la ' + texto(nomPeriodo() || 'este periodo')) + '. Las que añadas salen aquí al momento.</p>';
        var sinPdf = fs.filter(function (x) { return !x.ARCHIVO_URL; }).length;
        return h + '<table class="u-tabla eco-tabla"><thead><tr><th>Factura</th><th>Archivo</th><th class="num">Total</th></tr></thead><tbody>' + fs.map(function (x) {
          return '<tr tabindex="0" data-fac="' + texto(x.ID) + '"><td class="u-tabla-t">' + texto(numFac(x)) + ' · ' + texto(nombre('ctr', x.ID_CONTRAPARTE)) + chip(x) +
            '<div class="u-nota">' + [fecha(x.FECHA), x.TIPO === 'Emitida' ? 'Emitida (a un cliente)' : x.TIPO === 'Ticket' ? 'Ticket' : 'Recibida (de un proveedor)', x.ESTADO].filter(Boolean).join(' · ') + '</div></td>' +
            '<td>' + enlaceDrive(x) + '</td>' +
            '<td class="num"><span class="u-cifra' + (x.ESTADO === 'Anulada' ? ' eco-anulada' : '') + '">' + eur(importe(x).total) + '</span></td></tr>';
        }).join('') + '</tbody></table>' +
          (sinPdf ? '<p class="u-nota">' + sinPdf + (sinPdf === 1 ? ' factura no tiene' : ' facturas no tienen') + ' su archivo enlazado: ábrela y pega en «Enlace en Drive» el enlace del PDF (en Drive, Compartir › Copiar enlace).</p>' : '');
      }
      /** El enlace al PDF de una factura en Drive, para abrirlo en otra pestaña (sin abrir la ficha). */
      function enlaceDrive(f) {
        return f && f.ARCHIVO_URL ? '<a class="eco-drive" href="' + texto(f.ARCHIVO_URL) + '" target="_blank" rel="noopener" data-fuera>Abrir en Drive ↗</a>' : '<span class="u-nota">Sin archivo</span>';
      }

      /* ----- Presupuesto (se mira; se prepara aparte) ----- */

      function htmlPresupuesto() {
        var ps = presupuesto(d, per, S.des), av = avisos(d, ps);
        var h = '<p class="u-nota">Lo previsto' + (presPorPeriodo(d) ? ' para la ' + texto(nomPeriodo()) : '') + ' frente a lo real, sin IVA. ' +
          (prepara ? 'Toca una categoría para definir lo previsto: te recomienda una cifra a partir de lo real de ' + (presPorPeriodo(d) ? 'la ' + texto(nomPer.toLowerCase()) + ' anterior' : 'antes') + '.' :
            'Toca una categoría para ver sus movimientos. Lo prepara ' + texto(cfg.PREPARA_PRESUPUESTO ? 'el perfil ' + cfg.PREPARA_PRESUPUESTO : 'quien administra') + '.') + '</p>';
        if (av.length) {
          h += '<h2 class="n-grupo">Para afinar · ' + av.length + '</h2>' + av.slice(0, 8).map(function (a) {
            return '<div class="eco-aviso' + (a.orden > 1 ? ' eco-amb' : '') + '"><b>' + texto(a.cat.NOMBRE) + '</b><p>' + texto(a.t) + '</p></div>';
          }).join('') + (av.length > 8 ? '<p class="u-nota">Y ' + (av.length - 8) + ' más en la tabla de abajo.</p>' : '');
        }
        ['Ingreso', 'Gasto'].forEach(function (tipo) {
          var xs = ps.filter(function (x) { return x.tipo === tipo && !esReparto(d, x.cat) && (S.ceros || x.previsto || x.real); }), tp = 0, tr = 0;
          h += '<h2 class="n-grupo">' + (tipo === 'Ingreso' ? 'Ingresos' : 'Gastos') + '</h2>';
          if (!xs.length) { h += '<p class="u-vacio">No hay nada previsto ni apuntado' + (prepara ? '. Toca «Ver todas las categorías» para prever alguna.' : '.') + '</p>'; return; }
          h += '<table class="u-tabla eco-tabla"><thead><tr><th>Categoría</th><th class="num">Previsto</th><th class="num u-solo-ancho">Real</th><th class="num">' + (tipo === 'Gasto' ? 'Queda' : 'Diferencia') + '</th></tr></thead><tbody>' +
            xs.map(function (x) {
              tp += x.previsto; tr += x.real;
              return '<tr tabindex="0" ' + (prepara ? 'data-precat' : 'data-vercat') + '="' + texto(x.cat.ID) + '"><td class="u-tabla-t">' + texto(x.cat.NOMBRE) + (x.filas.some(function (r) { return r._pendiente || r._nueva; }) ? ' <span class="u-chip">Guardando</span>' : '') +
                '<div class="u-nota">' + texto(x.grupo) + '<span class="u-solo-movil">' + (x.grupo ? ' · ' : '') + 'real ' + eur0(x.real) + '</span></div></td><td class="num">' + eur0(x.previsto) + '</td><td class="num u-solo-ancho">' + eur0(x.real) + '</td>' +
                '<td class="num">' + (x.previsto ? '<span class="u-cifra' + (x.dif < 0 ? ' u-mal' : '') + '">' + eur0(x.dif) + '</span>' : '<span class="u-nota">Sin previsto</span>') + '</td></tr>';
            }).join('') + '<tr class="eco-total"><td class="u-tabla-t">Total<div class="u-nota u-solo-movil">real ' + eur0(tr) + '</div></td><td class="num">' + eur0(tp) + '</td><td class="num u-solo-ancho">' + eur0(tr) + '</td><td class="num">' + (tp ? '<span class="u-cifra' + ((tipo === 'Gasto' ? tp - tr : tr - tp) < 0 ? ' u-mal' : '') + '">' + eur0(tipo === 'Gasto' ? tp - tr : tr - tp) + '</span>' : '<span class="u-nota">Sin previsto</span>') + '</td></tr></tbody></table>';
        });
        return h + '<button type="button" class="u-btn u-btn-texto" data-accion="ceros">' + (S.ceros ? 'Ver solo las que tienen algo' : 'Ver todas las categorías') + '</button>';
      }

      /* ---------- ventanas ---------- */

      var alCerrar = null;
      function ventana(html, alAbrir) {
        vent.innerHTML = html;
        velo.classList.add('abierto');
        if (alAbrir) alAbrir();
        var p = vent.querySelector('[data-foco]') || vent.querySelector('input:not([type=hidden]), select, textarea');
        if (p) p.focus();
      }
      function cerrar() { velo.classList.remove('abierto'); vent.innerHTML = ''; if (alCerrar) { var f = alCerrar; alCerrar = null; f(); } }
      function campo(et, html, extra) { return '<label class="u-campo' + (extra ? ' ' + extra : '') + '"><span class="u-etiqueta">' + et + '</span>' + html + '</label>'; }
      function val(id) { var e = vent.querySelector('#' + id); return e ? String(e.value).trim() : ''; }
      function verError(mal) { var e = vent.querySelector('.u-error'); e.textContent = mal.join(' '); e.hidden = !mal.length; }
      function ivas() { return ['21%', '10%', '4%', '0%']; }
      function cambios(f, v) { var c = {}; Object.keys(v).forEach(function (k) { if (String(f[k] == null ? '' : f[k]) !== String(v[k])) c[k] = v[k]; }); return c; }
      function confirmar(b, t, f) { if (b.getAttribute('data-ok')) { f(); return; } b.setAttribute('data-ok', '1'); b.textContent = t; }
      /**
       * T0272: el importe de un movimiento o una factura se puede escribir con el IVA incluido, como lo dicen muchas veces:
       * se guarda la base que le toca (baseDeTotal). La casilla se recuerda en este navegador.
       */
      function conIva() { return guardado(CLAVE + 'coniva') === '1'; }
      function verImporte(v) {
        if (v.BASE === '' || v.BASE == null) return '';
        var x = conIva() ? importe(v).total : cts(v.BASE);
        return (x / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');
      }
      function casillaIva(pre) {
        return '<label class="u-check u-ancho"><input type="checkbox" id="' + pre + '-coniva"' + (conIva() ? ' checked' : '') + '> El importe lleva el IVA incluido</label>';
      }
      /** La base escrita (en céntimos), o la que sale del total si la casilla del IVA incluido está marcada. */
      function baseEn(pre) {
        var x = cts(val(pre + '-BASE')), c = vent.querySelector('#' + pre + '-coniva');
        return c && c.checked ? baseDeTotal(x, val(pre + '-TIPO_IVA')) : x;
      }
      /** Etiqueta del importe y la línea de debajo con lo que se va a guardar. */
      function pintaImporte(pre, etBase) {
        var ci = vent.querySelector('#' + pre + '-coniva').checked, b = baseEn(pre), t = importe({ BASE: b / 100, TIPO_IVA: val(pre + '-TIPO_IVA') });
        vent.querySelector('#' + pre + '-imp-et').textContent = ci ? 'Importe con IVA' : etBase;
        vent.querySelector('#' + pre + '-total').textContent = ci ? 'Sin IVA ' + eur(t.base) + ' · IVA ' + eur(t.iva) + ' · total ' + eur(t.total) : 'IVA ' + eur(t.iva) + ' · total con IVA ' + eur(t.total);
      }
      function oirImporte(pre, refrescar) {
        vent.querySelector('#' + pre + '-coniva').addEventListener('change', function (e) { guardado(CLAVE + 'coniva', e.target.checked ? '1' : ''); refrescar(); });
      }
      function dato(et, v) { return v === '' || v == null ? '' : '<div class="eco-df"><span>' + texto(et) + '</span><span>' + v + '</span></div>'; }

      /** Ficha de un movimiento (como en la 4.1): lo que es, de un vistazo, y qué se puede hacer con él. */
      function fichaMov(m) {
        var interno = m.TIPO === 'Interno', s = signo(m), x = importe(m), f = m.ID_FACTURA ? ix.fac[m.ID_FACTURA] : null, c = ix.cat[m.ID_CATEGORIA];
        var dev = c && !interno && c.TIPO !== m.TIPO;
        var html = '<h2 id="eco-vt">' + texto(m.CONCEPTO || 'Movimiento') + '</h2>' +
          '<p class="eco-dimp ' + (interno ? '' : s < 0 ? 'u-mal' : 'eco-bien') + '">' + (interno ? eur(x.total) : (s > 0 ? '+' : '') + eur(s)) + '</p>' +
          (chip(m) || sinFac(m) || dev ? '<p>' + chip(m) + (sinFac(m) ? ' <span class="u-chip">Sin factura</span>' : '') + (dev ? ' <span class="u-chip">Categoría de ' + texto(String(c.TIPO).toLowerCase()) + ': resta de ella</span>' : '') + '</p>' : '') +
          '<div class="eco-dl">' + dato('Fecha', fecha(m.FECHA)) +
          dato('Tipo', interno ? 'Entre cuentas' : m.TIPO === 'Ingreso' ? 'Entra dinero' : 'Sale dinero') +
          (interno ? dato('De la cuenta', texto(nombre('cue', m.ID_CUENTA))) + dato('A la cuenta', texto(nombre('cue', m.ID_CUENTA_DESTINO))) :
            dato('Categoría', texto(nombre('cat', m.ID_CATEGORIA)) + (c && c.GRUPO ? ' · ' + texto(c.GRUPO) : '')) +
            dato(m.TIPO === 'Ingreso' ? 'Entra en' : 'Sale de', texto(nombre('cue', m.ID_CUENTA))) +
            dato(m.TIPO === 'Ingreso' ? 'Quién paga' : 'Quién cobra', texto(nombre('ctr', m.ID_CONTRAPARTE)))) +
          (P && m[P] ? dato(nomPer, texto(nombre('per', m[P]))) : '') + (DS && m[DS] ? dato(nomDes, texto(nombre('des', m[DS]))) : '') +
          dato('Sin IVA', eur(x.base)) + dato('IVA', texto(m.TIPO_IVA || '0%') + ' · ' + eur(x.iva)) + dato('Total', eur(x.total)) +
          (interno ? '' : dato('Factura o ticket', f ? '<button type="button" class="u-btn u-btn-texto" data-verfac="' + texto(f.ID) + '">' + texto(numFac(f)) + ' ›</button>' + (f.ARCHIVO_URL ? ' · ' + enlaceDrive(f) : '') : sinFac(m) ? '<span class="u-mal">Falta</span>' : 'No lleva')) +
          dato('Notas', texto(m.NOTAS)) + '</div>' +
          (m.LOG ? '<details class="eco-hist"><summary>Historial de cambios</summary><pre>' + texto(m.LOG) + '</pre></details>' : '') +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="d-editar" data-foco>Editar movimiento</button>' +
          (!interno && !m.ID_FACTURA && !(c && esReparto(d, c)) ? '<button type="button" class="u-btn" id="d-factura">' + (m.TIPO === 'Ingreso' ? 'Hacer la factura' : 'Añadir su factura') + '</button>' : '') +
          '<button type="button" class="u-btn" data-cerrar>Cerrar</button>' +
          '<button type="button" class="u-btn u-btn-texto" id="d-borrar">Borrar movimiento</button></div>';
        ventana(html, function () {
          vent.querySelector('#d-editar').onclick = function () { formMov(m); };
          var bf = vent.querySelector('#d-factura');
          if (bf) bf.onclick = function () {
            var emit = m.TIPO === 'Ingreso';
            formFac(null, { TIPO: emit ? 'Emitida' : 'Recibida', FECHA: emit ? hoy() : m.FECHA, ID_CONTRAPARTE: m.ID_CONTRAPARTE, BASE: x.base / 100, TIPO_IVA: m.TIPO_IVA || '21%',
              ESTADO: 'Pagada', NOTAS: (emit ? 'Del cobro ' : 'Del pago ') + m.ID + ' · ' + String(m.CONCEPTO || '') }, m.ID);
          };
          var vf = vent.querySelector('[data-verfac]');
          if (vf) vf.onclick = function () { formFac(ix.fac[vf.getAttribute('data-verfac')]); };
          var bb = vent.querySelector('#d-borrar');
          bb.onclick = function () {
            confirmar(bb, 'Sí, borrar este movimiento del Excel', function () {
              cerrar();
              T.borrar('MOVIMIENTOS', m.ID).then(function () { if (ctx.abierta()) ctx.aviso('Movimiento borrado del Excel.'); }, function () {});
            });
          };
        });
      }

      /** Categorías de un tipo, agrupadas por GRUPO (como en la 4.1), sin perder la que ya tiene. */
      function opcCategorias(tipo, sel) {
        var gs = {}, orden = [];
        d.cat.filter(function (c) { return c.TIPO === tipo || String(c.ID) === String(sel); }).forEach(function (c) {
          var g = String(c.GRUPO || 'Otras'); if (!gs[g]) { gs[g] = []; orden.push(g); } gs[g].push(c);
        });
        return '<option value="">Elige la categoría</option>' + orden.map(function (g) {
          return '<optgroup label="' + texto(g) + '">' + gs[g].map(function (c) { return '<option value="' + texto(c.ID) + '"' + (String(c.ID) === String(sel) ? ' selected' : '') + '>' + texto(c.NOMBRE) + '</option>'; }).join('') + '</optgroup>';
        }).join('');
      }

      /** Ventana de un movimiento: nuevo (m null, con lo que venga en pre) o uno que ya está. */
      function formMov(m, pre) {
        var v = m || Object.assign({ FECHA: hoy(), TIPO: 'Gasto', TIPO_IVA: '21%' }, pre || {});
        if (!m && P && !v[P] && per && d.colsMov.indexOf(P) >= 0) v[P] = per.id;
        if (!m && DS && !v[DS] && S.des && S.des !== '-' && d.colsMov.indexOf(DS) >= 0) v[DS] = S.des;
        var tienePer = P && d.colsMov.indexOf(P) >= 0, tieneDes = DS && d.colsMov.indexOf(DS) >= 0;
        var cuentas = d.cue.map(function (c) { return [c.ID, c.NOMBRE]; }), st = { tipo: v.TIPO || 'Gasto' };
        var html = '<h2 id="eco-vt">' + (m ? 'Editar movimiento' : 'Añadir movimiento') + '</h2>' +
          '<div class="eco-sw" role="group" aria-label="Qué es">' +
          '<button type="button" data-tipo="Ingreso">↓ Entra dinero</button><button type="button" data-tipo="Gasto">↑ Sale dinero</button><button type="button" data-tipo="Interno">⇄ Entre cuentas</button></div>' +
          '<div class="u-campos">' +
          campo('<span id="m-imp-et">Importe sin IVA</span>', '<input type="text" inputmode="decimal" class="eco-imp" id="m-BASE" value="' + texto(verImporte(v)) + '" placeholder="0,00" data-foco>') +
          campo('IVA', '<select id="m-TIPO_IVA">' + opciones(ivas().map(function (x) { return [x, x]; }), v.TIPO_IVA) + '</select>') +
          casillaIva('m') +
          '<p class="u-nota u-ancho" id="m-total"></p>' +
          campo('Concepto', '<input type="text" id="m-CONCEPTO" value="' + texto(v.CONCEPTO) + '" maxlength="200" placeholder="Qué es, como lo diríais entre vosotros">', 'u-ancho') +
          campo('Fecha', '<input type="date" id="m-FECHA" value="' + texto(v.FECHA) + '">') +
          (tienePer ? campo(texto(nomPer), '<select id="m-PER">' + opciones(lista.map(function (p) { return [p.id, p.nombre]; }), v[P], 'Elige') + '</select>') : '') +
          campo('Categoría', '<select id="m-ID_CATEGORIA"></select>', 'eco-no-interno') +
          (tieneDes ? campo(texto(nomDes), '<select id="m-DES"></select>', 'eco-no-interno') : '') +
          campo('<span id="m-cue-et">Cuenta</span>', '<select id="m-ID_CUENTA">' + opciones(cuentas, v.ID_CUENTA, 'Elige la cuenta') + '</select>') +
          campo('A la cuenta', '<select id="m-ID_CUENTA_DESTINO">' + opciones(cuentas, v.ID_CUENTA_DESTINO, 'Elige a dónde va') + '</select>', 'eco-interno') +
          campo('<span id="m-ctr-et">Quién paga o cobra</span>', '<select id="m-ID_CONTRAPARTE">' + opciones(d.ctr.map(function (c) { return [c.ID, c.NOMBRE]; }).sort(function (a, b) { return String(a[1]).localeCompare(String(b[1]), 'es'); }), v.ID_CONTRAPARTE, cfg.PIDE_CONTRAPARTE === 'Sí' ? 'Elige' : 'Nadie en concreto') + '</select>', 'eco-no-interno') +
          campo('Factura o ticket', '<select id="m-ID_FACTURA"></select>', 'eco-no-interno') +
          campo('Detalles <span class="eco-opc">(opcional)</span>', '<textarea id="m-NOTAS" rows="2" placeholder="Por qué se hizo, a qué corresponde, acuerdos…">' + texto(v.NOTAS) + '</textarea>', 'u-ancho') +
          '</div><p class="u-error" role="alert" hidden></p><div class="n-botones">' +
          '<button type="button" class="u-btn u-btn-accion" id="m-guardar">Guardar movimiento</button><button type="button" class="u-btn" data-cerrar>Cancelar</button></div>';
        ventana(html, function () {
          function refrescar() {
            var tipo = st.tipo, interno = tipo === 'Interno';
            [].forEach.call(vent.querySelectorAll('.eco-sw [data-tipo]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-tipo') === tipo ? 'true' : 'false'); });
            [].forEach.call(vent.querySelectorAll('.eco-interno'), function (x) { x.hidden = !interno; });
            [].forEach.call(vent.querySelectorAll('.eco-no-interno'), function (x) { x.hidden = interno; });
            vent.querySelector('#m-cue-et').textContent = interno ? 'De la cuenta' : tipo === 'Ingreso' ? 'Entra en' : 'Sale de';
            vent.querySelector('#m-ctr-et').textContent = tipo === 'Ingreso' ? 'Quién paga' : 'Quién cobra';
            var sc = vent.querySelector('#m-ID_CATEGORIA'), cat = sc.value || v.ID_CATEGORIA;
            if (ix.cat[cat] && ix.cat[cat].TIPO !== tipo && String(cat) !== String(v.ID_CATEGORIA)) cat = '';
            sc.innerHTML = opcCategorias(tipo, cat);
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
            pintaImporte('m', 'Importe sin IVA');
          }
          refrescar();
          vent.querySelector('.eco-sw').onclick = function (e) { var b = e.target.closest('[data-tipo]'); if (b) { st.tipo = b.getAttribute('data-tipo'); refrescar(); } };
          ['m-TIPO_IVA', 'm-ID_CONTRAPARTE', 'm-PER'].forEach(function (id) { var e = vent.querySelector('#' + id); if (e) e.addEventListener('change', refrescar); });
          vent.querySelector('#m-BASE').addEventListener('input', refrescar);
          oirImporte('m', refrescar);
          vent.querySelector('#m-guardar').onclick = function () {
            var tipo = st.tipo, interno = tipo === 'Interno';
            var nv = { FECHA: val('m-FECHA'), TIPO: tipo, CONCEPTO: val('m-CONCEPTO'), BASE: baseEn('m') / 100, TIPO_IVA: val('m-TIPO_IVA'),
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

      /**
       * Ventana de una factura: nueva (f null, con lo que venga en pre) o una que ya está. Una emitida nueva la numera el
       * motor. movId: el movimiento al que se enlaza al guardarla (desde «Hacer la factura» de su ficha).
       */
      function formFac(f, pre, movId) {
        var v = f || Object.assign({ TIPO: 'Recibida', FECHA: hoy(), TIPO_IVA: '21%', ESTADO: 'Pendiente' }, pre || {});
        var movs = f ? d.mov.filter(function (m) { return String(m.ID_FACTURA) === String(f.ID); }) : [];
        var pagado = 0; movs.forEach(function (m) { pagado += importe(m).total; });
        var html = '<h2 id="eco-vt">' + (f ? 'Factura ' + texto(numFac(f)) : movId ? (v.TIPO === 'Emitida' ? 'Hacer la factura' : 'Añadir su factura') : 'Añadir factura') + '</h2>' +
          (f ? '<p>' + enlaceDrive(f) + '</p>' : '') +
          (movId ? '<p class="u-nota">Con los datos del movimiento. ' + (v.TIPO === 'Emitida' ? 'La fecha es la de hoy, que es cuando se emite; el número lo pone el Excel al guardarla.' : 'Pon el número que trae la factura.') + ' Al guardarla queda enlazada al movimiento.</p>' : '') +
          '<div class="u-campos">' +
          (f ? '' : campo('Tipo', '<select id="f-TIPO">' + opciones([['Emitida', 'Emitida (la hacemos nosotros)'], ['Recibida', 'Recibida'], ['Ticket', 'Ticket']], v.TIPO) + '</select>')) +
          campo('Número', '<input type="text" id="f-NUMERO" value="' + texto(v.NUMERO) + '" maxlength="40">', 'eco-numero') +
          campo('Fecha', '<input type="date" id="f-FECHA" value="' + texto(v.FECHA) + '">') +
          campo('<span id="f-ctr-et">' + (v.TIPO === 'Emitida' ? 'Cliente (a quién se la hacemos)' : 'Proveedor (quién nos la hace)') + '</span>', '<select id="f-ID_CONTRAPARTE">' + opciones(d.ctr.map(function (c) { return [c.ID, c.NOMBRE]; }).sort(function (a, b) { return String(a[1]).localeCompare(String(b[1]), 'es'); }), v.ID_CONTRAPARTE, 'Elige') + '</select>') +
          campo('<span id="f-imp-et">Base imponible</span>', '<input type="text" inputmode="decimal" id="f-BASE" value="' + texto(verImporte(v)) + '" placeholder="0,00">') +
          campo('IVA', '<select id="f-TIPO_IVA">' + opciones(ivas().map(function (x) { return [x, x]; }), v.TIPO_IVA) + '</select>') +
          casillaIva('f') +
          '<p class="u-nota u-ancho" id="f-total"></p>' +
          campo('Estado', '<select id="f-ESTADO">' + opciones([['Pendiente', 'Pendiente'], ['Pagada', 'Pagada'], ['Anulada', 'Anulada']], v.ESTADO, 'Sin estado') + '</select>') +
          campo('Enlace en Drive', '<input type="url" id="f-ARCHIVO_URL" value="' + texto(v.ARCHIVO_URL) + '" placeholder="https://drive.google.com/…">', 'u-ancho') +
          '<p class="u-nota u-ancho">El del PDF o la foto de la factura: en Drive, Compartir › Copiar enlace.</p>' +
          campo('Notas', '<textarea id="f-NOTAS" rows="2">' + texto(v.NOTAS) + '</textarea>', 'u-ancho') + '</div>' +
          (f ? '<p class="u-nota">' + (movs.length ? movs.length + (movs.length === 1 ? ' movimiento' : ' movimientos') + ' con esta factura: ' + eur(pagado) + ' de ' + eur(importe(f).total) + '.' : 'Ningún movimiento lleva todavía esta factura.') + '</p>' : '') +
          '<p class="u-error" role="alert" hidden></p><div class="n-botones">' +
          '<button type="button" class="u-btn u-btn-accion" id="f-guardar">Guardar factura</button><button type="button" class="u-btn" data-cerrar>Cancelar</button>' +
          (f && f.ESTADO === 'Pendiente' ? '<button type="button" class="u-btn" id="f-apuntar">' + (f.TIPO === 'Emitida' ? 'Apuntar el cobro' : 'Apuntar el pago') + '</button>' : '') + '</div>';
        ventana(html, function () {
          function refrescar() {
            var tipo = f ? f.TIPO : val('f-TIPO'), em = tipo === 'Emitida' && !f;
            vent.querySelector('#f-ctr-et').textContent = tipo === 'Emitida' ? 'Cliente (a quién se la hacemos)' : 'Proveedor (quién nos la hace)';
            var n = vent.querySelector('#f-NUMERO');
            n.disabled = em; if (em) n.value = ''; n.placeholder = em ? 'Se numera sola al guardar (' + String(cfg.SERIE_EMITIDAS || '') + '…)' : '';
            pintaImporte('f', 'Base imponible');
          }
          refrescar();
          ['f-TIPO', 'f-TIPO_IVA'].forEach(function (id) { var e = vent.querySelector('#' + id); if (e) e.addEventListener('change', refrescar); });
          vent.querySelector('#f-BASE').addEventListener('input', refrescar);
          oirImporte('f', refrescar);
          vent.querySelector('#f-guardar').onclick = function () {
            var tipo = f ? f.TIPO : val('f-TIPO'), em = tipo === 'Emitida' && !f;
            var nv = { FECHA: val('f-FECHA'), ID_CONTRAPARTE: val('f-ID_CONTRAPARTE'), BASE: baseEn('f') / 100, TIPO_IVA: val('f-TIPO_IVA'),
              ESTADO: val('f-ESTADO'), ARCHIVO_URL: val('f-ARCHIVO_URL'), NOTAS: val('f-NOTAS') };
            if (!em) nv.NUMERO = val('f-NUMERO');
            var mal = [];
            if (!em && !nv.NUMERO) mal.push('Falta el número.');
            if (!nv.FECHA) mal.push('Falta la fecha.');
            if (!nv.ID_CONTRAPARTE) mal.push('Falta ' + (tipo === 'Emitida' ? 'el cliente.' : 'el proveedor.'));
            if (!(cts(val('f-BASE')) > 0)) mal.push('La base tiene que ser mayor que 0.');
            if (!em && nv.NUMERO && d.fac.some(function (x) { return x !== f && x.TIPO === tipo && String(x.NUMERO).trim() === nv.NUMERO; })) mal.push('Ya hay una ' + tipo.toLowerCase() + ' con el número ' + nv.NUMERO + '.');
            if (mal.length) { verError(mal); return; }
            cerrar();
            var p;
            if (f) p = T.actualizar('FACTURAS', f.ID, cambios(f, nv));
            else if (em) p = T.crear('FACTURAS', Object.assign({ TIPO: 'Emitida', NUMERO: '' }, nv), { fn: 'economiaEmitir' });
            else p = T.crear('FACTURAS', Object.assign({ TIPO: tipo }, nv));
            p.then(function (r) {
              var x = r && r.fila ? r.fila : null, id = (r && r.id) || (x && x.ID);
              if (ctx.abierta()) ctx.aviso(x && em ? 'Factura ' + x.NUMERO + ' guardada en el Excel.' : 'Factura guardada en el Excel.');
              if (movId && id) T.actualizar('MOVIMIENTOS', movId, { ID_FACTURA: id }).then(function () {}, function () {});
            }, function () {});
          };
          var ba = vent.querySelector('#f-apuntar');
          if (ba) ba.onclick = function () {
            var t = importe(f), falta = t.total - pagado, base = Math.round(falta * 100 / (100 + pct(f.TIPO_IVA)));
            var pre = { TIPO: f.TIPO === 'Emitida' ? 'Ingreso' : 'Gasto', CONCEPTO: (f.TIPO === 'Emitida' ? 'Cobro ' : 'Pago ') + numFac(f), ID_CONTRAPARTE: f.ID_CONTRAPARTE,
              ID_FACTURA: f.ID, TIPO_IVA: f.TIPO_IVA, BASE: base / 100 };
            formMov(null, pre);
          };
        });
      }

      /* ---------- preparar el presupuesto, categoría a categoría ---------- */

      /**
       * T0272: ventana para definir lo previsto de una categoría en el periodo: lo real de los dos anteriores, lo previsto
       * ahora y lo recomendado (con su porqué y «Usar lo recomendado»), por desglose si el presupuesto va así. Guardar pide
       * confirmar con lo que cambia (la categoría y el beneficio previsto); cada cambio queda en su LOG.
       */
      function formPresCat(idCat) {
        var M = cfg.MEDIDAS && typeof cfg.MEDIDAS === 'object' ? cfg.MEDIDAS : {};
        if (Object.keys(M).length && !S.medidas) {
          ventana('<h2 id="eco-vt">' + texto(nombre('cat', idCat)) + '</h2><div class="kz-centro" role="status"><div class="u-carga"></div><p class="u-nota">Contando ' + texto(Object.keys(M).join(' y ').toLowerCase()) + ' de cada ' + texto(nomPer.toLowerCase()) + ' para recomendarte una cifra…</p></div>' +
            '<div class="n-botones"><button type="button" class="u-btn" data-cerrar>Cancelar</button></div>');
          ctx.llamar('economiaMedidas', []).then(function (r) { S.medidas = r || {}; if (velo.classList.contains('abierto')) formPresCat(idCat); }, function (e) {
            S.medidas = { _error: String(e && e.message || e).replace(/^\w+:\s*/, '') };
            if (velo.classList.contains('abierto')) formPresCat(idCat);
          });
          return;
        }
        preparar();
        var c = ix.cat[idCat]; if (!c) return;
        var med = {};
        Object.keys(M).forEach(function (n) { var x = (S.medidas || {})[n] || {}; med[n] = { grupos: M[n].grupos || [], periodo: x.periodo || {}, desglose: x.desglose || {} }; });
        var x = recomendar(d, per, lista, med).filter(function (r) { return String(r.cat.ID) === String(idCat); })[0] ||
          { cat: c, ant: [], rec: null, razon: '', partes: null };
        var conDes = presPorDes(d), filas = preDe(d, per).filter(function (r) { return String(r.ID_CATEGORIA) === String(idCat); });
        var gen = filas.filter(function (r) { return !conDes || !r[DS]; })[0], partes = {};
        filas.forEach(function (r) { if (conDes && r[DS]) partes[r[DS]] = r; });
        if (conDes && x.partes) Object.keys(x.partes).forEach(function (k) { if (!partes[k]) partes[k] = null; });
        var ks = Object.keys(partes).sort(function (a, b) { return nombre('des', a).localeCompare(nombre('des', b), 'es'); });
        var verGen = !ks.length || gen || !x.partes, antes = 0;
        filas.forEach(function (r) { antes += cts(r.IMPORTE); });
        var real = 0; presupuesto(d, per).forEach(function (r) { if (String(r.cat.ID) === String(idCat)) real = r.real; });
        var uni = String(x.medida || '').toLowerCase();
        function entrada(et, r, k, rec, nota) {
          return campo(texto(et), '<input type="text" inputmode="decimal" data-pre="' + texto(r ? r.ID : '') + '" data-des="' + texto(k) + '" data-rec="' + (rec == null ? '' : rec) +
            '" data-antes="' + (r ? cts(r.IMPORTE) : 0) + '" value="' + texto(r ? eur(cts(r.IMPORTE)).replace(' €', '') : '') + '" placeholder="0">' +
            (nota ? '<span class="u-nota">' + nota + '</span>' : ''));
        }
        // Lo recomendado de cada parte (p. ej. cada competición), con sus equipos o partidos, debajo de su casilla.
        function notaParte(k) {
          if (!x.partes || x.partes[k] == null) return '';
          var n = x.unidades && x.unidades[k];
          return 'Recomendado ' + eur0(x.partes[k]) + (n ? ' · ' + n + ' ' + texto(uni) : '');
        }
        var h = '<h2 id="eco-vt">' + texto(c.NOMBRE) + '</h2>' +
          '<p class="u-nota">' + texto([c.GRUPO, c.TIPO === 'Ingreso' ? 'ingreso' : 'gasto', 'sin IVA'].filter(Boolean).join(' · ')) + (presPorPeriodo(d) ? ' · ' + texto(nomPeriodo()) : '') + '</p>' +
          '<div class="eco-dl">' + x.ant.map(function (a) { return dato('Real la ' + a.p.nombre, eur0(a.real)); }).join('') +
          dato('Real ahora', eur0(real)) + dato('Previsto ahora', antes ? eur0(antes) : 'Sin previsto') + '</div>' +
          (x.rec != null ? '<div class="u-bloque eco-rec"><b>Recomendado: ' + eur0(x.rec) + '</b><p class="u-nota">' + texto(x.razon) +
            (x.partes ? '. Sale a ' + eur(Math.round(x.porUna)) + ' por ' + texto(uni.replace(/s$/, '')) + ', repartido así:' : '') + '</p>' +
            (x.partes ? '<div class="eco-dl eco-rec-partes">' + Object.keys(x.partes).sort(function (a, b) { return nombre('des', a).localeCompare(nombre('des', b), 'es'); })
              .map(function (k) { return dato(nombre('des', k) + (x.unidades && x.unidades[k] ? ' · ' + x.unidades[k] + ' ' + uni : ''), eur0(x.partes[k])); }).join('') +
              (verGen ? dato('General', eur0(0)) : '') + '</div>' : '') +
            '<button type="button" class="u-btn" id="p-usar">Usar lo recomendado</button></div>' : (x.razon ? '<p class="u-nota">' + texto(x.razon) + '</p>' : '')) +
          (S.medidas && S.medidas._error ? '<p class="u-error">No se han podido contar ' + texto(Object.keys(M).join(' ni ').toLowerCase()) + ' (' + texto(S.medidas._error) + '): lo recomendado es lo real de la anterior.</p>' : '') +
          '<div class="u-campos" id="p-lista">' + ks.map(function (k) { return entrada(nombre('des', k), partes[k], k, x.partes ? x.partes[k] : null, notaParte(k)); }).join('') +
          // Con lo recomendado por partes, la general se queda a 0 al usarlo: lo recomendado ya está repartido.
          (verGen ? entrada(ks.length ? 'General' : 'Previsto', gen, '', x.partes ? 0 : x.rec, x.partes ? 'Lo que no es de ninguna ' + texto(nomDes.toLowerCase()) + '. Recomendado 0 €' : '') : '') + '</div>' +
          '<p class="u-nota" id="p-tot"></p><p class="u-error" role="alert" hidden></p><div class="n-botones">' +
          '<button type="button" class="u-btn u-btn-accion" id="p-guardar">Guardar lo previsto</button><button type="button" class="u-btn" data-cerrar>Cancelar</button>' +
          (pest.indexOf('MOVIMIENTOS') >= 0 ? '<button type="button" class="u-btn u-btn-texto" id="p-movs">Ver sus movimientos</button>' : '') + '</div>';
        ventana(h, function () {
          var bg = vent.querySelector('#p-guardar');
          function entradas() { return [].slice.call(vent.querySelectorAll('#p-lista [data-pre]')); }
          function nuevo() { var t = 0; entradas().forEach(function (i) { t += cts(i.value); }); return t; }
          function pintaTot() {
            var n = nuevo();
            vent.querySelector('#p-tot').textContent = ks.length ? 'Total previsto: ' + eur0(n) + (n !== antes ? ' (antes ' + eur0(antes) + ')' : '') : (n !== antes ? 'Antes ' + eur0(antes) : '');
            if (bg.getAttribute('data-ok')) { bg.removeAttribute('data-ok'); bg.textContent = 'Guardar lo previsto'; }
          }
          pintaTot();
          vent.querySelector('#p-lista').addEventListener('input', pintaTot);
          var bu = vent.querySelector('#p-usar');
          if (bu) bu.onclick = function () { entradas().forEach(function (i) { var r = i.getAttribute('data-rec'); if (r !== '') i.value = eur(Number(r)).replace(' €', ''); }); pintaTot(); };
          var bm = vent.querySelector('#p-movs');
          if (bm) bm.onclick = function () { cerrar(); verMovs({ cat: String(idCat) }, 'PRESUPUESTO'); };
          bg.onclick = function () {
            var cs = entradas().filter(function (i) { return cts(i.value) !== (Number(i.getAttribute('data-antes')) || 0); });
            if (!cs.length) { verError(['No has cambiado nada.']); return; }
            if (!bg.getAttribute('data-ok')) {
              // Confirmar: lo que cambia en la categoría y en el beneficio previsto del periodo.
              var pi = 0, pg = 0, n = nuevo(), dif = n - antes;
              presupuesto(d, per).forEach(function (r) { if (esReparto(d, r.cat)) return; if (r.tipo === 'Ingreso') pi += r.previsto; else if (r.tipo === 'Gasto') pg += r.previsto; });
              var b0 = pi - pg, b1 = b0 + (c.TIPO === 'Ingreso' ? dif : -dif);
              verError([]);
              vent.querySelector('#p-tot').innerHTML = '<b>' + texto(c.NOMBRE) + ': ' + eur0(antes) + ' → ' + eur0(n) + '.</b> Beneficio previsto' + (presPorPeriodo(d) ? ' de la ' + texto(nomPeriodo()) : '') + ': ' + eur0(b0) + ' → ' + eur0(b1) + '. Queda apuntado en el Excel con tu nombre.';
              bg.setAttribute('data-ok', '1'); bg.textContent = 'Sí, guardar lo previsto';
              return;
            }
            var ops = cs.map(function (i) {
              var id = i.getAttribute('data-pre'), n = cts(i.value) / 100, des = i.getAttribute('data-des');
              if (id) return function () { return T.actualizar('PRESUPUESTOS', id, { IMPORTE: n }); };
              var nv = { ID_CATEGORIA: c.ID, IMPORTE: n };
              if (presPorPeriodo(d)) nv[P] = per.id;
              if (conDes && des) nv[DS] = des;
              return function () { return T.crear('PRESUPUESTOS', nv); };
            });
            cerrar();
            Promise.all(ops.map(function (f) { return f(); })).then(function () { if (ctx.abierta()) ctx.aviso('Lo previsto de ' + c.NOMBRE + ' guardado en el Excel.'); }, function () {});
          };
        });
      }

      /* ---------- eventos ---------- */

      function irA(tab) { S.tab = tab; guardado(CLAVE + 'tab', tab); pintar(); window.scrollTo(0, 0); }
      function verMovs(f, desde) { S.mov = Object.assign(movVacio(), f, { desde: desde || '' }); irA('MOVIMIENTOS'); }
      el.addEventListener('click', function (e) {
        var t = e.target;
        var b = t.closest('[data-tab]'); if (b) { if (b.getAttribute('data-tab') === 'MOVIMIENTOS') S.mov.desde = ''; if (b.getAttribute('data-tab') === 'CAJA') S.caja.cue = ''; irA(b.getAttribute('data-tab')); return; }
        if (t.closest('[data-fuera]')) return; // un enlace a Drive se abre en otra pestaña, sin abrir la fila
        if (t.closest('[data-cerrar]')) { cerrar(); return; }
        if (velo.contains(t)) return; // lo de dentro de una ventana lo lleva su ventana
        var g = t.closest('[data-grupo]');
        if (g) { var id = g.getAttribute('data-grupo'); S.ab[id] = !S.ab[id]; g.setAttribute('aria-expanded', S.ab[id]); g.nextElementSibling.hidden = !S.ab[id]; return; }
        var vc = t.closest('[data-vercat]');
        if (vc) { if (pest.indexOf('MOVIMIENTOS') >= 0) verMovs({ cat: vc.getAttribute('data-vercat') }, S.tab); return; }
        var ab = t.closest('[data-abrir]');
        if (ab) { var dt = el.querySelector('#eco-' + ab.getAttribute('data-abrir')); if (dt) { dt.open = true; S.ab[ab.getAttribute('data-abrir')] = true; dt.scrollIntoView({ block: 'start' }); } return; }
        var ir = t.closest('button[data-ir]');
        if (ir) { if (pest.indexOf(ir.getAttribute('data-ir')) >= 0) irA(ir.getAttribute('data-ir')); return; }
        var a = t.closest('[data-accion]');
        if (a) {
          var ac = a.getAttribute('data-accion');
          if (ac === 'apuntar') formMov(null);
          else if (ac === 'factura') formFac(null);
          else if (ac === 'vermas') { S.mov.ver += VER; pintar(); }
          else if (ac === 'vermascaja') { S.caja.ver = (S.caja.ver || VER) + VER; pintar(); }
          else if (ac === 'ceros') { S.ceros = !S.ceros; pintar(); }
          else if (ac === 'ceroscaja') { S.caja.ceros = !S.caja.ceros; pintar(); }
          else if (ac === 'todascuentas') { S.caja.cue = ''; pintar(); window.scrollTo(0, 0); }
          else if (ac === 'todasdes') { S.des = ''; pintar(); }
          else if (ac === 'volver') { var dd = S.mov.desde; S.mov.desde = ''; irA(dd || 'RESUMEN'); }
          else if (ac === 'cruzados') verMovs({ cruz: true }, S.tab);
          else if (ac === 'sinfac') verMovs({ tipo: 'Gasto', sinFac: true }, S.tab);
          return;
        }
        var tr = t.closest('tr[tabindex]');
        if (!tr) return;
        if (tr.hasAttribute('data-mov')) { var m = T.fila('MOVIMIENTOS', tr.getAttribute('data-mov')); if (m && !m._nueva) fichaMov(m); }
        else if (tr.hasAttribute('data-fac')) { var f = T.fila('FACTURAS', tr.getAttribute('data-fac')); if (f && !f._nueva) formFac(f); }
        else if (tr.hasAttribute('data-precat')) formPresCat(tr.getAttribute('data-precat'));
        else if (tr.hasAttribute('data-vercat')) { if (pest.indexOf('MOVIMIENTOS') >= 0) verMovs({ cat: tr.getAttribute('data-vercat') }, S.tab); }
        else if (tr.hasAttribute('data-verdes')) { S.des = tr.getAttribute('data-verdes'); pintar(); window.scrollTo(0, 0); }
        else if (tr.hasAttribute('data-cuenta')) { S.caja.cue = tr.getAttribute('data-cuenta'); S.caja.ver = VER; pintar(); window.scrollTo(0, 0); }
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && velo.classList.contains('abierto')) { cerrar(); return; }
        var tr = e.target.closest && e.target.closest('tr[tabindex]');
        if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tr.click(); }
      });
      velo.addEventListener('click', function (e) { if (e.target === velo) cerrar(); });
      el.addEventListener('toggle', function (e) { var x = e.target; if (x.id === 'eco-iva') S.ab.iva = x.open; else if (x.id === 'eco-rep') S.ab.rep = x.open; }, true);
      el.addEventListener('change', function (e) {
        var t = e.target;
        if (velo.contains(t)) return;
        if (t === selPer) { S.per = t.value; S.des = ''; guardado(CLAVE + 'per', t.value); S.mov.ver = VER; pintar(); return; }
        if (t.id === 'eco-des') { S.des = t.value; pintar(); return; }
        if (t.hasAttribute('data-filtro')) { var k = t.getAttribute('data-filtro'); S.mov[k] = t.type === 'checkbox' ? t.checked : t.value; if (k === 'tipo') S.mov.cat = ''; S.mov.ver = VER; pintar(); return; }
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
