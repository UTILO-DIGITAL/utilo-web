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
 *   Movimientos  buscar y «Filtrar» (tipo, categoría, cuenta y sin factura, en su ventana; T0644); cada uno abre su ficha (Editar, Borrar, Hacer la factura). «Añadir movimiento»
 *             (el botón que flota) solo sale aquí.
 *   Caja      el dinero de cada cuenta (banco, cajas, socios) y, al tocarla, sus movimientos con el saldo.
 *   Pendiente facturas por cobrar y por pagar y gastos sin factura.
 *   Facturas  de T0257, con el cliente o el proveedor de cada una y su enlace para abrirla en Drive (ARCHIVO_URL).
 *             T0627 · Con FACTURA_LINEAS = Sí, una emitida se hace por líneas (FACTURA_LINEAS: qué, cantidad, unidad,
 *             precio; la base es su suma), con el CIF y la dirección del cliente (economiaClienteDatos), y se ve como
 *             documento («Ver la factura», economiaFacturaVer) o, con FACTURA_CARPETA, se guarda su PDF en Drive y se
 *             enlaza («Guardar y sacar el PDF», economiaFacturaPdf). Los datos de la empresa, en la tabla EMPRESA («Datos de
 *             tu empresa», en Facturas). El documento, en motor/modulos/economia/ECONOMIA_FACTURA.js.
 *   Presupuesto  quien dice PREPARA_PRESUPUESTO toca una categoría y define lo previsto, con una recomendación sacada
 *             de lo real del periodo anterior (por MEDIDAS, si las hay) y confirmación; los demás solo lo miran.
 *   Ventas    T0628 · con VENTAS (la tabla del desglose): cada venta, de que la marca la pide a que la paga, con sus
 *             movimientos (los que la eligen). Arriba, lo que tiene en juego (pagado y sin cobrar), lo ganado en las cobradas
 *             (en euros; con MARGEN_MINIMO, también el % y el aviso de la que queda por debajo) y lo que falta por recuperar de lo invertido (los gastos sin venta);
 *             cada cifra se toca y dice de dónde sale. Cada venta abre sus pasos, sus cuentas y sus movimientos, y se da de
 *             alta y se cambia aquí. Desde el principio, no por periodo; sin IVA.
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
 *   VENTAS, MARGEN_MINIMO      T0628 · tabla de las ventas (la del DESGLOSE) y el margen mínimo (un número o una fila de otra tabla)
 *   CUENTAS_PERSONALES         T0646 · tipos de CUENTAS que son lo que pone una persona: en Caja, aparte («Lo que te debe la empresa»)
 *   CUENTAS_CAPITAL            T0673 · tipos de CUENTAS que son el capital de la empresa: Caja no las enseña (no es deuda ni dinero de la empresa)
 *   CLIENTES                   T0646 · de dónde salen los clientes de una factura emitida (las MARCAS), con su dirección
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
  /** «21%» → 21. T0725 (R03): también el número que guarda el Excel (0,21 o 21) y «0». */
  function pct(t) { var n = parseFloat(tipoIva(t)); return isFinite(n) ? n : 0; }
  /**
   * T0725 (R03) · El tipo de IVA como lo enseña la web («21%», «0%»), venga como venga del Excel: un número con formato de
   * porcentaje (0,21 → «21%»; 0 → «0%»), un número suelto (21 → «21%») o un texto («21 %», «0»). Vacío, vacío. Sin esto,
   * un 0 guardado como número no estaba en la lista y, al editar el gasto, se elegía el 21 %.
   */
  function tipoIva(t) {
    if (t === '' || t == null) return '';
    var s = String(t).trim(), conPct = /%$/.test(s), n = parseFloat(s.replace('%', '').replace(',', '.'));
    if (!isFinite(n)) return s;
    if (!conPct && n > 0 && n < 1) n = Math.round(n * 10000) / 100;
    return String(n).replace('.', ',') + '%';
  }
  /** Base, cuota de IVA y total de una fila (BASE, TIPO_IVA), en céntimos. La cuota se redondea al céntimo. */
  /** T0689 · Un importe en céntimos sin redondear (82,6446 € → 8264,46): la base de un total con IVA que no sale justa. */
  function ctsExactos(v) {
    var n = typeof v === 'number' ? v : Number(String(v == null ? '' : v).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return isFinite(n) ? Math.round(n * 1000000) / 10000 : 0;
  }
  /** Base, cuota de IVA y total de una fila (BASE, TIPO_IVA), en céntimos. La cuota se redondea al céntimo; T0689: sobre la base
   *  tal cual (con 4 decimales si los lleva), para que «100 € con IVA» dé 82,64 + 17,36 = 100,00. Con 2 decimales, como siempre. */
  /*  T0733 (R101) · Con la retención de IRPF (RETENCION: «15%», en la factura de un profesional) y el IVA de importación del
   *  DUA (IVA_IMPORTACION: un importe aparte de la base, que se recupera), si la fila los tiene: { base, cuota (la del
   *  TIPO_IVA), dua, iva (cuota + dua: todo el IVA), ret, total (lo que se paga: base + iva − ret) }. Sin ellas, como siempre. */
  function importe(f) {
    var x = ctsExactos(f.BASE), b = Math.round(x), i = Math.round(x * pct(f.TIPO_IVA) / 100);
    var dua = cts(f.IVA_IMPORTACION), r = Math.round(x * pct(f.RETENCION) / 100);
    return { base: b, iva: i + dua, cuota: i, dua: dua, ret: r, total: b + i + dua - r };
  }
  /**
   * T0272 · La base (céntimos) de un total con IVA: la que, con su cuota redondeada al céntimo, da justo ese total
   * (si el redondeo no lo permite, T0689: con dos decimales más). Para apuntar un importe tal cual lo dicen, con el IVA incluido.
   * T0733: con una retención (ret, «15%»), el total es lo que se paga: base + IVA − retención.
   */
  function baseDeTotal(total, tipo, ret) {
    var p = pct(tipo), q = pct(ret), div = 100 + p - q;
    function da(x) { return Math.round(x) + Math.round(x * p / 100) - Math.round(x * q / 100); }
    if (div <= 0) return 0;
    var b = Math.round(total * 100 / div), c = [b, b - 1, b + 1];
    for (var k = 0; k < c.length; k++) if (da(c[k]) === total) return c[k];
    // T0689 · Si ninguna base en céntimos da justo ese total (100 € al 21 %), la base con dos decimales más de céntimo:
    // importe() calcula la cuota sobre ella y el total sale el escrito.
    // Si cae justo en medio céntimo (0,49 €: 40,50), la de al lado (40,49).
    var r = Math.round(total * 100 / div * 100) / 100, d = [0, -0.01, 0.01, -0.02, 0.02];
    for (var j = 0; j < d.length; j++) { var x = Math.round((r + d[j]) * 100) / 100; if (da(x) === total) return x; }
    return r;
  }
  /** T0627 · Una cantidad escrita («12,5», «30», vacía = 1) → número. */
  function cantidad(v) {
    if (v === '' || v == null) return 1;
    var n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  /** T0627 · Un precio escrito («22,5», «18,595») → euros, sin redondear (el de sin IVA puede llevar hasta 4 decimales). */
  /**
   * T0681 · Un IBAN tal como se escribe → { ok, texto }: sin espacios ni guiones, en mayúsculas, con sus dígitos de control
   * comprobados (ISO 13616, módulo 97) y agrupado de 4 en 4 («ES91 2100 0418 4502 0005 1332»). Vacío: ok, ''.
   */
  function iban(v) {
    var x = String(v === undefined || v === null ? '' : v).toUpperCase().replace(/[\s.-]+/g, '');
    if (!x) return { ok: true, texto: '' };
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(x)) return { ok: false, texto: x };
    var num = (x.slice(4) + x.slice(0, 4)).replace(/[A-Z]/g, function (c) { return String(c.charCodeAt(0) - 55); }), r = 0;
    for (var i = 0; i < num.length; i++) r = (r * 10 + Number(num[i])) % 97;
    return { ok: r === 1, texto: x.replace(/(.{4})(?=.)/g, '$1 ') };
  }
  function precio(v) {
    if (v === '' || v == null) return 0;
    var n = typeof v === 'number' ? v : Number(String(v).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  /**
   * T0627 · El precio sin IVA de uno con el IVA incluido (como lo sabe Marta), con 4 decimales: así cantidad × precio, con
   * su IVA, da lo que ella cuenta (20 m a 22,50 € con IVA → 18,595 € sin IVA → 371,90 € + 78,10 € = 450,00 €).
   */
  function sinIva(conIva, tipo) { return Math.round(precio(conIva) * 1000000 / (100 + pct(tipo))) / 10000; }
  /** T0627 · El precio con IVA (2 decimales) de uno sin IVA: para enseñarlo cuando se escriben con IVA. */
  function conIvaPrecio(sin, tipo) { return Math.round(precio(sin) * (100 + pct(tipo))) / 100; }
  /** T0627 · El importe (céntimos) de una línea de factura: cantidad × precio, redondeado al céntimo (como el documento). */
  function importeLinea(l) { return Math.round(cantidad(l.CANTIDAD) * precio(l.PRECIO) * 100); }
  /** T0627 · La base (céntimos) de unas líneas: la suma de sus importes; las vacías (sin concepto ni precio) no cuentan. */
  function baseLineas(ls) {
    var b = 0;
    (ls || []).forEach(function (l) { if (l && (String(l.CONCEPTO || '').trim() || precio(l.PRECIO))) b += importeLinea(l); });
    return b;
  }
  /** T0627 · Las líneas de una factura, en su orden (por ID: se crean una tras otra). */
  function lineasDe(lin, idFac) {
    return (lin || []).filter(function (l) { return String(l.ID_FACTURA) === String(idFac); })
      .sort(function (a, b) { return String(a.ID).localeCompare(String(b.ID), 'es', { numeric: true }); });
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
    // T0628: mirando una sola parte del desglose (una venta) sin presupuesto por desglose, no hay previsto que comparar.
    if (des && !presPorDes(d)) return [];
    return des ? xs.filter(function (r) { return deDes(d, r, des); }) : xs;
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
      // T0726 (R56): sin previsto no es «mal» (ni barra en teja): falta ponerlo.
      if (!p) return { t: 'Pon tu presupuesto', mal: false, bien: false, sinPrevisto: true };
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
    // T0726 (R61): un importe que no se entiende («4.000 rupias») se dice; nunca se guarda como 0.
    if (typeof v.BASE !== 'number' && String(v.BASE == null ? '' : v.BASE).trim() && isNaN(numeroEscrito(v.BASE))) mal.push('No entiendo el importe «' + String(v.BASE).trim() + '»: escribe solo el número (por ejemplo, 36,36) y elige la moneda al lado.');
    else if (!(cts(numeroEscrito(v.BASE) || 0) > 0)) mal.push('El importe tiene que ser mayor que 0 (el signo lo da si entra o sale dinero).');
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

  /* ---------- T0726 · cómo se dice: la palabra de la sección, las listas y el periodo ---------- */

  /**
   * T0726 (R26) · Cómo llama la sección a una venta: NOMBRE_VENTA («pedido» en Telas; vacío, «venta»), o { uno, varios,
   * genero: 'f' | 'm' }. Sin género, femenina si acaba en «a». → { uno, varios, f }.
   */
  function palabraVenta(x) {
    var o = x && typeof x === 'object' ? x : { uno: x };
    var uno = String(o.uno || '').trim().toLowerCase() || 'venta';
    var varios = String(o.varios || '').trim().toLowerCase() || (/[aeiouáéó]$/.test(uno) ? uno + 's' : uno + 'es');
    return { uno: uno, varios: varios, f: o.genero ? /^f/i.test(String(o.genero)) : /a$/.test(uno) };
  }
  /**
   * Un texto con la palabra de la sección: {venta}, {ventas}, {Venta}, {Ventas}; y lo que concuerda con ella: {la}, {los},
   * {del}, {lo} (créa{lo}), {una}, {esta}, {esa}, {ninguna} (ninguna/ningún), {alguna} y {a} (la letra final: cobrad{a},
   * Nuev{a}, Ningun{a}). Con mayúscula, la primera letra ({La}, {Los}).
   */
  function decir(p, s) {
    var f = p.f, may = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
    var w = { venta: p.uno, ventas: p.varios, la: f ? 'la' : 'el', los: f ? 'las' : 'los', del: f ? 'de la' : 'del', lo: f ? 'la' : 'lo', una: f ? 'una' : 'un', esta: f ? 'esta' : 'este',
      esa: f ? 'esa' : 'ese', ninguna: f ? 'ninguna' : 'ningún', alguna: f ? 'alguna' : 'algún', a: f ? 'a' : 'o' };
    return String(s).replace(/\{(\w+)\}/g, function (m, k) {
      var b = k.toLowerCase();
      if (!(b in w)) return m;
      return k === b ? w[b] : may(w[b]);
    });
  }
  /** T0726 (R26) · El paso de una venta (Pedida, Cobrada…) concordando con la palabra: «Pedido», «Cobrado por adelantado». */
  function pasoDicho(paso, p) {
    return p && !p.f ? String(paso || '').replace(/^(Pedid|Cobrad|Entregad|Pagad|Facturad)a\b/, '$1o') : String(paso || '');
  }
  /** T0726 (R27) · ['a', 'b', 'c'] → «a, b y c». */
  function listaY(xs) { xs = (xs || []).filter(Boolean); return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]; }
  /**
   * T0726 (R27) · «en 2026» con un año (o un periodo que empieza por número, 2025-26), nunca «en la 2026»; «en la Temporada
   * …» si no; sin periodo, «en este periodo». pre: 'en' (de entrada), 'de' o 'para'.
   */
  function enPeriodo(nombre, pre) {
    var n = String(nombre || '').trim(); pre = pre || 'en';
    if (!n) return pre + ' este periodo';
    return /^\d/.test(n) ? pre + ' ' + n : pre + ' la ' + n;
  }

  /* ---------- T0726 (R61) · los gastos en otra moneda ---------- */

  /** Un importe escrito → número, o NaN si no se entiende: «4.000», «4.000 ₹», «1.234,56 €», «$12», «12 USD». Vacío, NaN. */
  function numeroEscrito(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v == null ? '' : v).replace(/\s|€|₹|\$|\b(EUR|USD|INR|Rs)\b\.?/gi, '');
    if (!s || !/^-?[\d.,]+$/.test(s)) return NaN;
    var n = Number(s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return isFinite(n) ? n : NaN;
  }
  /** Un número como se escribe: 4000 → «4.000», 36.364 → «36,36», 110.5 → «110,5». */
  function numTxt(n) {
    var r = Math.round(Math.abs(n) * 100) / 100, p = String(r).split('.');
    return (n < 0 ? '−' : '') + miles(p[0]) + (p[1] ? ',' + p[1] : '');
  }
  /**
   * Las monedas en que se apunta un gasto: el euro y las de MONEDAS ({ "₹": { "nombre": "rupias", "tabla": "AJUSTES",
   * "fila": "AJUSTES", "columna": "RUPIAS_POR_EURO" }, "$": { "nombre": "dólares" } }), cada una con su cambio (cuántas
   * hay en un euro: de su fila de la tabla, o «cambio»: 110), o null si no se sabe (se pide al apuntar). filasDe(t): las
   * filas de una tabla. → [{ sim, nombre, cambio }], el euro primero.
   */
  function monedas(cfgM, filasDe) {
    var out = [{ sim: '€', nombre: 'euros', cambio: 1 }];
    if (!cfgM || typeof cfgM !== 'object' || Array.isArray(cfgM)) return out;
    Object.keys(cfgM).forEach(function (s) {
      var m = cfgM[s], c = null;
      if (s === '€' || !String(s).trim()) return;
      if (typeof m === 'number' || typeof m === 'string') m = { cambio: m };
      m = m || {};
      if (m.tabla && m.columna) {
        var fs = (filasDe && filasDe(m.tabla)) || [];
        var f = fs.filter(function (x) { return String(x.ID) === String(m.fila); })[0] || (m.fila ? null : fs[0]);
        c = f ? numeroEscrito(f[m.columna]) : NaN;
      } else if (m.cambio !== undefined && m.cambio !== '') c = numeroEscrito(m.cambio);
      out.push({ sim: String(s), nombre: String(m.nombre || s), cambio: c > 0 ? c : null });
    });
    return out;
  }
  /**
   * Un importe (n, en la moneda m) → { cts: en euros, cuenta: «4.000 ₹ ÷ 110 = 36,36 €» } (en euros, sin cuenta), o null si
   * no se entiende el importe o no se sabe el cambio.
   */
  function aEuros(n, m) {
    if (typeof n !== 'number') n = numeroEscrito(n);
    if (isNaN(n)) return null;
    if (!m || m.sim === '€') return { cts: Math.round(n * 100), cuenta: '' };
    if (!(m.cambio > 0)) return null;
    var c = Math.round(n / m.cambio * 100);
    return { cts: c, cuenta: numTxt(n) + ' ' + m.sim + ' ÷ ' + numTxt(m.cambio) + ' = ' + eur(c) };
  }
  /** Las notas de un gasto con la cuenta del cambio en una línea «Cambio: …»: la de antes (al editarlo) se cambia por la nueva. */
  function notasConCambio(notas, cuenta) {
    var s = String(notas || '').split('\n').filter(function (l) { return !/^Cambio: /.test(l.trim()); }).join('\n').trim();
    return cuenta ? (s ? s + '\n' : '') + 'Cambio: ' + cuenta : s;
  }

  /**
   * T0726 (R63) · Lo que le falta a una factura emitida antes de hacerla (como economiaFacturaFaltan_ del motor, sin el
   * número, que lo pone el motor): la empresa, el cliente y lo que se vende. doc: { empresa, cliente, lineas, base, factura }.
   * → { empresa: [lo que falta de la empresa], resto: [lo demás] }. Así se avisa sin ir al motor; el motor lo vuelve a mirar.
   */
  function faltanFactura(doc) {
    var e = (doc && doc.empresa) || {}, c = (doc && doc.cliente) || {}, f = (doc && doc.factura) || {}, emp = [], resto = [];
    var vacio = function (x) { return !String(x == null ? '' : x).trim(); };
    if (vacio(e.NOMBRE)) emp.push('el nombre');
    if (vacio(e.NIF)) emp.push('el CIF');
    if (vacio(e.DIRECCION)) emp.push('la dirección');
    if (vacio(c.NOMBRE)) resto.push('el nombre del cliente');
    if (vacio(c.NIF)) resto.push('el CIF o NIF del cliente');
    if (vacio(c.DIRECCION)) resto.push('la dirección del cliente');
    if (!f.FECHA) resto.push('la fecha');
    var hay = ((doc && doc.lineas) || []).some(function (l) { return l && (String(l.CONCEPTO || '').trim() || Number(l.PRECIO)); }) || Number(doc && doc.base) > 0;
    if (!hay) resto.push('lo que se vende');
    return { empresa: emp, resto: resto };
  }
  /** Lo que falta de una factura, dicho entero: «faltan el nombre y el CIF de tu empresa y el CIF o NIF del cliente» ('' si nada). */
  function faltanTexto(x) {
    var partes = (x.empresa.length ? [listaY(x.empresa) + ' de tu empresa'] : []).concat(x.resto);
    if (!partes.length) return '';
    return (x.empresa.length + x.resto.length > 1 ? 'faltan ' : 'falta ') + listaY(partes);
  }

  /* ---------- T0635 · lo que se vende (ARTICULOS, p. ej. Mis telas) ----------
   * art: la configuración ARTICULOS ya montada (con _refs de los YAML y, si sale de una sección Listado, _precio y _valores).
   * D: { filas(t), fila(t, id) }, las tablas al momento. */
  function aNum(v) {
    if (typeof v === 'number') return v;
    var s = String(v == null ? '' : v).trim(); if (!s) return NaN;
    var pc = /%$/.test(s); s = s.replace(/[€₹%\s]/g, '');
    if (/^-?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ''); // T0645: «1,020» es mil veinte, como en el listado
    else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    var n = /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
    return pc ? n / 100 : n;
  }
  function nombreFila(D, t, id) {
    var f = id === '' || id == null ? null : D.fila(t, id);
    if (!f) return id == null ? '' : String(id);
    var n = ['NOMBRE', 'TITULO', 'DETALLE'].filter(function (k) { return f[k] !== '' && f[k] != null; })[0];
    return n ? String(f[n]) : String(id);
  }
  /** El valor de una ruta («ID_DISENO.ANCHO») desde una fila de t, siguiendo las referencias; al final, el nombre si es una ref (crudo: el código). */
  function seguirRuta(art, D, t, f, ruta, crudo) {
    var ps = String(ruta).split('.'), rs = art._refs || {}, fila = f, tt = t;
    for (var i = 0; i < ps.length - 1; i++) {
      var r = (rs[tt] || {})[ps[i]];
      if (!r || !fila || fila[ps[i]] === '' || fila[ps[i]] == null) return '';
      fila = D.fila(r, fila[ps[i]]); tt = r;
    }
    if (!fila) return '';
    var ult = ps[ps.length - 1], rr = (rs[tt] || {})[ult];
    return rr && !crudo ? nombreFila(D, rr, fila[ult]) : fila[ult];
  }
  /** El mismo cálculo que la sección Listado (el precio de Mis telas): números, columnas o rutas, «$VALOR» y [op, …]. Un hueco da NaN. */
  function calcArt(art, D, e, f, val) {
    if (typeof e === 'number') return e;
    if (typeof e === 'string') return aNum(e.charAt(0) === '$' ? val[e.slice(1)] : seguirRuta(art, D, art.tabla, f, e, true));
    if (!Array.isArray(e) || !e.length) return NaN;
    var op = e[0], a = e.slice(1);
    if (op === 'o') { for (var i = 0; i < a.length; i++) { var x = calcArt(art, D, a[i], f, val); if (!isNaN(x)) return x; } return NaN; }
    if (op === 'redondear') { var r = calcArt(art, D, a[0], f, val), p = Math.pow(10, a[1] || 0); return Math.round(r * p) / p; }
    var ns = a.map(function (y) { return calcArt(art, D, y, f, val); });
    if (ns.some(isNaN)) return NaN;
    if (op === '+') return ns.reduce(function (s, n) { return s + n; }, 0);
    if (op === '*') return ns.reduce(function (s, n) { return s * n; }, 1);
    if (op === '-') return ns.length === 1 ? -ns[0] : ns.slice(1).reduce(function (s, n) { return s - n; }, ns[0]);
    if (op === '/') return ns[1] === 0 ? NaN : ns[0] / ns[1];
    return NaN;
  }
  /** Una parte del detalle: un campo o ruta (con su unidad) o, con «tabla», las filas de otra tabla que le tocan, con su parte («52 % Viscosa · 48 % Algodón»). */
  function detalleDe(art, D, f, o) {
    if (typeof o === 'string') o = { campo: o };
    if (o.tabla) {
      var de = String(seguirRuta(art, D, art.tabla, f, o.con || art.codigo || 'ID', true));
      if (!de) return '';
      var xs = (D.filas(o.tabla) || []).filter(function (x) { return String(x[o.campo]) === de; }).map(function (x) {
        var n = aNum(x[o.porcentaje]); if (n > 1) n = n / 100;
        var nom = (((art._refs || {})[o.tabla] || {})[o.nombre]) ? nombreFila(D, art._refs[o.tabla][o.nombre], x[o.nombre]) : String(x[o.nombre] == null ? '' : x[o.nombre]);
        return { n: n, t: (isNaN(n) ? '' : Math.round(n * 100) + ' % ') + nom };
      }).filter(function (x) { return x.t.trim(); });
      xs.sort(function (a, b) { return (isNaN(b.n) ? -1 : b.n) - (isNaN(a.n) ? -1 : a.n); });
      return xs.map(function (x) { return x.t; }).join(' · ');
    }
    var v = String(seguirRuta(art, D, art.tabla, f, o.campo) == null ? '' : seguirRuta(art, D, art.tabla, f, o.campo)).trim();
    return v ? v + (o.unidad ? ' ' + o.unidad : '') : '';
  }
  /** ¿Pasa la fila los filtros? ({ campo, no: […] } o { campo, es: […] }, con los nombres como se ven). */
  function pasaArt(art, D, f) {
    return (art.filtro || []).every(function (c) {
      var v = String(seguirRuta(art, D, art.tabla, f, c.campo));
      if (c.no) return [].concat(c.no).indexOf(v) < 0;
      if (c.es) return [].concat(c.es).indexOf(v) >= 0;
      return true;
    });
  }
  /** T0736 · Sin tildes ni mayúsculas: la del núcleo (UN.plano; en Node, las pruebas, la de nucleo.js). */
  var UNT = null;
  function plano(s) { return (UNT || (UNT = typeof module !== 'undefined' && module.exports ? require('../nucleo.js') : window.UN)).plano(s); }
  function normArt(s) { return plano(s); }
  /** Lo que se puede vender, por código: [{ codigo, nombre, detalle, unidad, precio (sin IVA; NaN si falta algo para calcularlo) }]. */
  function articulos(art, D) {
    if (!art || !art.tabla) return [];
    var val = {};
    Object.keys(art._valores || {}).forEach(function (k) {
      var v = art._valores[k];
      if (v && typeof v === 'object') { var f = D.fila(v.tabla, v.fila); val[k] = f ? f[v.columna || 'VALOR'] : ''; } else val[k] = v;
    });
    return (D.filas(art.tabla) || []).filter(function (f) { return pasaArt(art, D, f); }).map(function (f) {
      var cod = String(f[art.codigo || 'ID'] == null ? '' : f[art.codigo || 'ID']).trim();
      var nom = [].concat(art.nombre || []).map(function (c) { return String(seguirRuta(art, D, art.tabla, f, c) || '').trim(); }).filter(Boolean).join(' · ') || cod;
      var det = [].concat(art.detalle || []).map(function (o) { return detalleDe(art, D, f, o); }).filter(Boolean).join(' · ');
      var pr = art._precio ? calcArt(art, D, art._precio, f, val) : art.precio ? aNum(f[art.precio]) : NaN;
      // T0653: lo que cuesta (Mis telas: puesta en España), para enseñarlo junto al precio y avisar si se vende por debajo.
      var co = art._coste ? calcArt(art, D, art._coste, f, val) : art.coste ? aNum(f[art.coste]) : NaN;
      if (!isNaN(co)) co = Math.round(co * 100) / 100;
      // T0645: un envío a 0 no es un envío: sin precio recomendado, como «Falta el envío» en Mis telas.
      var sinEnvio = function (env) { return env && ![].concat(env).some(function (e) { return calcArt(art, D, e, f, val) > 0; }); };
      if (sinEnvio(art._envio)) pr = NaN;
      // T0678: lo que cuesta, tampoco sin el envío (con 0 en Ajustes saldría el coste sin él y una venta parecería ganar más).
      var faltaEnvio = sinEnvio(art._envioCoste);
      if (faltaEnvio) co = NaN;
      if (!isNaN(pr)) pr = Math.round(pr * 100) / 100;
      return { codigo: cod, nombre: nom, detalle: det, unidad: String(art.unidad || ''), precio: isNaN(pr) || pr < 0 ? NaN : pr,
        coste: isNaN(co) || co < 0 ? NaN : co, faltaEnvio: !!faltaEnvio, _b: normArt(nom + ' ' + cod + ' ' + det),
        // T0739: quién lo hace (el ID de su taller), para proponerlo en una línea de venta.
        taller: art.taller ? String(seguirRuta(art, D, art.tabla, f, art.taller, true) || '') : '' };
    }).filter(function (a) { return a.codigo; }).sort(function (a, b) { return a.codigo.localeCompare(b.codigo, 'es'); });
  }
  /** T0673 · Lo que dice cada tela al elegirla en una factura: el recomendado si lo hay; si no, lo que te cuesta; si no, nada (nunca «sin precio»). */
  function precioOpcion(a) {
    var u = a && a.unidad ? '/' + a.unidad : '';
    function eurPrecio(n) { return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'; } // como el de la factura
    if (!a) return '';
    if (!isNaN(a.precio)) return eurPrecio(a.precio) + u;
    return isNaN(a.coste) ? '' : 'Te cuesta ' + eurPrecio(a.coste) + u;
  }
  /**
   * T0673 · Con quién es un movimiento, una sola vez: la venta sin su marca cuando la marca es la misma contraparte
   * («Celosía · 40 m», no «Tapizados Ejemplo · Celosía · 40 m»), y la contraparte fuera si ya la dicen el concepto o la venta.
   * ctr y des: sus nombres como se ven; venta: la fila de VENTAS (o null). → { des, ctr }
   */
  function conQuien(m, ctr, des, venta) {
    ctr = String(ctr || ''); des = String(des || '');
    if (des && venta && venta.NOMBRE && m.ID_CONTRAPARTE && String(venta.ID_CONTRAPARTE || '') === String(m.ID_CONTRAPARTE)) des = String(venta.NOMBRE);
    var n = normArt(ctr).trim();
    if (n && (normArt(m.CONCEPTO).indexOf(n) >= 0 || normArt(des).indexOf(n) >= 0)) ctr = '';
    return { des: des, ctr: ctr };
  }
  /** Los que tienen todas las palabras de q (en el nombre, el código o el detalle), como mucho max. Sin palabras, ninguno. */
  function buscarArt(arts, q, max) {
    var ws = normArt(q).split(/\s+/).filter(Boolean);
    return ws.length ? arts.filter(function (a) { return ws.every(function (w) { return a._b.indexOf(w) >= 0; }); }).slice(0, max || 6) : [];
  }
  /** El artículo de una línea guardada: el código al final de su concepto («… · BOR-004-01»). */
  function artDe(arts, concepto) {
    var m = String(concepto || '').match(/·\s*([^·]+)$/), c = m ? m[1].trim() : '';
    return c ? arts.filter(function (a) { return a.codigo === c; })[0] || null : null;
  }

  /**
   * T0653 · El último precio de un artículo a un cliente: el de su línea en la factura emitida más reciente a esa contraparte
   * (sin las anuladas ni la factura que se está haciendo, sinFac). Las líneas se reconocen por el código al final del concepto,
   * como artDe. → { precio (sin IVA), numero, fecha } o null.
   */
  function ultimoPrecio(lineas, facturas, idCtr, codigo, sinFac) {
    if (!idCtr || !codigo) return null;
    var fs = {};
    (facturas || []).forEach(function (f) {
      if (f.TIPO === 'Emitida' && f.ESTADO !== 'Anulada' && String(f.ID_CONTRAPARTE) === String(idCtr) && String(f.ID) !== String(sinFac == null ? '' : sinFac)) fs[f.ID] = f;
    });
    // La más reciente: por fecha y, el mismo día, por su número (FE.10 después de FE.9); dentro de una factura, la última línea.
    var orden = function (f, l) { var n = /(\d+)\s*$/.exec(String(f.NUMERO || '')); return String(f.FECHA || '') + '|' + ('0000000000' + (n ? n[1] : '')).slice(-10) + '|' + String(l.ID || ''); };
    var mejor = null, k = '';
    (lineas || []).forEach(function (l) {
      var f = fs[l.ID_FACTURA], m = String(l.CONCEPTO || '').match(/·\s*([^·]+)$/);
      if (!f || !m || m[1].trim() !== String(codigo)) return;
      var p = aNum(l.PRECIO), o = orden(f, l);
      if (isNaN(p) || (mejor && o <= k)) return;
      mejor = { precio: Math.round(p * 100) / 100, numero: String(f.NUMERO || ''), fecha: String(f.FECHA || '') }; k = o;
    });
    return mejor;
  }

  /* ---------- T0628 · ventas: lo que se juega, lo que gana y lo que le falta por recuperar ----------
   * Cada venta (una fila de la tabla VENTAS) junta los movimientos que la eligen (columna DS, la del DESGLOSE). Todo sin IVA
   * (la base): lo que ha pagado (gastos: taller, envío, aduanas) y lo que le ha pagado la marca (ingresos: anticipo, cobro).
   *   enJuego  lo pagado que aún no ha recuperado (pagado − cobrado, nunca menos de 0); en una venta cobrada, 0
   *   debe     lo que le falta por pagar a la marca (IMPORTE − cobrado); sin IMPORTE, no se sabe (null)
   *   cobrada  la marca ha pagado todo el IMPORTE y ella ya ha pagado algo (T0673: hasta pagar al taller no se sabe lo ganado)
   *   adelantado  la marca lo ha pagado todo y ella aún no ha pagado nada (paso «Cobrada por adelantado»): ni ganado ni en juego
   *   ganado   en una cobrada, cobrado − pagado; margen = ganado / pagado (sobre lo que cuesta, como la calculadora)
   *   bajo     cobrada y por debajo del mínimo (minimo, fracción: 0,2 = 20 %; 0, sin aviso)
   *   paso     Cobrada, Cobrada por adelantado, Entregada (FECHA_ENTREGA), En camino (FECHA_ENVIO), Pagada al taller (algún gasto) o Pedida
   *   dias     de su primer pago al cobro que completa el IMPORTE (0 si cobró antes de pagar)
   * Lo invertido: los gastos que no son de ninguna venta (sin el REPARTO); se recupera con lo ganado en las cobradas. */
  function fraccion(v) {
    var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace('%', '').replace(',', '.'));
    if (!isFinite(n) || n <= 0) return 0;
    return n > 1 ? n / 100 : n; // «20» o «20 %» es un 20 %
  }
  function diasEntre(a, b) {
    var x = Date.parse(String(a || '').slice(0, 10)), y = Date.parse(String(b || '').slice(0, 10));
    return isFinite(x) && isFinite(y) ? Math.round((y - x) / 86400000) : null;
  }
  function venta(d, v, DS, minimo) {
    var ix = indice(d.cat);
    var ms = d.mov.filter(function (m) { return DS && String(m[DS] || '') === String(v.ID) && (m.TIPO === 'Gasto' || m.TIPO === 'Ingreso'); })
      .sort(function (a, b) { return String(a.FECHA) < String(b.FECHA) ? -1 : String(a.FECHA) > String(b.FECHA) ? 1 : String(a.ID) < String(b.ID) ? -1 : 1; });
    var pagado = 0, cobrado = 0, costes = {}, ordenC = [], primerPago = '', primerCobro = '', cobro = '';
    var imp = v.IMPORTE === '' || v.IMPORTE == null ? null : cts(v.IMPORTE);
    if (imp !== null && imp <= 0) imp = null;
    ms.forEach(function (m) {
      var b = importe(m).base;
      if (m.TIPO === 'Gasto') {
        pagado += b;
        if (!primerPago) primerPago = String(m.FECHA || '');
        var c = ix[m.ID_CATEGORIA], k = c ? String(c.NOMBRE) : 'Otros gastos';
        if (!(k in costes)) { costes[k] = 0; ordenC.push(k); }
        costes[k] += b;
      } else {
        cobrado += b;
        if (!primerCobro) primerCobro = String(m.FECHA || '');
        if (!cobro && imp !== null && cobrado >= imp) cobro = String(m.FECHA || '');
      }
    });
    // T0673 · Pagada entera antes de pagar al taller: aún no es ganado (Javi, 19/11/2026); se da por cobrada al pagar algo.
    var entera = imp !== null && cobrado >= imp, cobrada = entera && pagado > 0, adelantado = entera && !cobrada;
    var ganado = cobrada ? cobrado - pagado : null;
    var margen = cobrada && pagado > 0 ? ganado / pagado : null;
    var paso = cobrada ? 'Cobrada' : adelantado ? 'Cobrada por adelantado' : v.FECHA_ENTREGA ? 'Entregada' : v.FECHA_ENVIO ? 'En camino' : pagado > 0 ? 'Pagada al taller' : 'Pedida';
    var fechaPaso = { Cobrada: cobro, 'Cobrada por adelantado': cobro, Entregada: v.FECHA_ENTREGA, 'En camino': v.FECHA_ENVIO, 'Pagada al taller': primerPago, Pedida: v.FECHA }[paso] || '';
    return {
      v: v, movs: ms, importe: imp, pagado: pagado, cobrado: cobrado, cobrada: cobrada, adelantado: adelantado, anticipo: fraccion(v.ANTICIPO),
      enJuego: cobrada ? 0 : Math.max(0, pagado - cobrado), debe: imp === null ? null : Math.max(0, imp - cobrado),
      ganado: ganado, margen: margen, bajo: !!(minimo && margen !== null && margen < minimo - 1e-9),
      // Lo que tendría que haber cobrado para llegar al mínimo, redondeado al céntimo.
      paraMinimo: minimo && cobrada && pagado > 0 ? Math.round(pagado * (1 + minimo)) : null,
      // Lo que ganará si cobra lo que falta y no hay más gastos.
      previsto: imp === null ? null : imp - pagado,
      costes: ordenC.map(function (k) { return { nombre: k, base: costes[k] }; }),
      paso: paso, fechaPaso: fechaPaso, primerPago: primerPago, primerCobro: primerCobro, cobro: cobro,
      dias: cobrada && primerPago && cobro ? Math.max(0, diasEntre(primerPago, cobro)) : null
    };
  }
  function ventas(d, filas, DS, minimo) {
    var xs = (filas || []).map(function (v) { return venta(d, v, DS, minimo); });
    var abiertas = xs.filter(function (x) { return !x.cobrada; }).sort(function (a, b) { return String(a.v.FECHA) < String(b.v.FECHA) ? -1 : 1; });
    var cobradas = xs.filter(function (x) { return x.cobrada; }).sort(function (a, b) { return a.cobro > b.cobro ? -1 : a.cobro < b.cobro ? 1 : 0; });
    var ixc = indice(d.cat), inv = {}, ordenI = [], invertido = 0;
    d.mov.forEach(function (m) {
      if (m.TIPO !== 'Gasto' || (DS && String(m[DS] || ''))) return;
      var c = ixc[m.ID_CATEGORIA];
      if (c && d.cfg && d.cfg.REPARTO && String(c.GRUPO || '') === String(d.cfg.REPARTO)) return;
      var k = c ? String(c.NOMBRE) : 'Sin categoría', b = importe(m).base;
      if (!(k in inv)) { inv[k] = 0; ordenI.push(k); }
      inv[k] += b; invertido += b;
    });
    var ganado = cobradas.reduce(function (s, x) { return s + x.ganado; }, 0);
    var ds = cobradas.filter(function (x) { return x.dias !== null; });
    return {
      todas: xs, abiertas: abiertas, cobradas: cobradas, minimo: minimo || 0,
      enJuego: abiertas.reduce(function (s, x) { return s + x.enJuego; }, 0),
      conJuego: abiertas.filter(function (x) { return x.enJuego > 0; }).length,
      deben: abiertas.reduce(function (s, x) { return s + (x.debe || 0); }, 0),
      sinImporte: abiertas.filter(function (x) { return x.importe === null; }).length,
      ganado: ganado, bajos: cobradas.filter(function (x) { return x.bajo; }).length,
      invertido: invertido, porCategoria: ordenI.map(function (k) { return { nombre: k, base: inv[k] }; }).sort(function (a, b) { return b.base - a.base; }),
      falta: Math.max(0, invertido - ganado), recuperado: invertido > 0 ? Math.min(1, Math.max(0, ganado) / invertido) : (ganado > 0 ? 1 : 0),
      dias: ds.length ? Math.round(ds.reduce(function (s, x) { return s + x.dias; }, 0) / ds.length) : null
    };
  }
  /** El mínimo de MARGEN_MINIMO: un número o { tabla, fila, columna } (filas: la tabla ya leída). */
  function minimoDe(cfgMin, filas) {
    if (cfgMin === '' || cfgMin == null) return 0;
    if (typeof cfgMin !== 'object') return fraccion(cfgMin);
    var f = (filas || []).filter(function (x) { return String(x.ID) === String(cfgMin.fila); })[0] || (cfgMin.fila ? null : (filas || [])[0]);
    return f ? fraccion(f[cfgMin.columna]) : 0;
  }
  /**
   * T0692 · Las ventas de cada uno con quien se trata (las de una marca, para su ficha de Clientes): su contraparte lleva en
   * «campo» la clave de su ficha (CONTRAPARTES.ID_MARCA). { clave: { ventas, ultima, anio, enAnio, debe, sinPrecio } }:
   *   ventas     cada venta (la de venta()), de la más reciente a la más antigua por FECHA
   *   ultima     la FECHA de la más reciente
   *   anio       lo que suman las de este año (IMPORTE, sin IVA; las sin precio cerrado no suman) y enAnio, cuántas son
   *   debe       lo que le falta por pagar de las que no ha pagado enteras; sinPrecio, cuántas de esas no tienen IMPORTE
   * Una venta sin contraparte, o con una que no tiene «campo», no es de nadie. hoy: 'AAAA-MM-DD' (para el año).
   */
  function ventasPorQuien(d, filas, DS, minimo, ctr, campo, hoy) {
    var de = {}, o = {}, anio = String(hoy || '').slice(0, 4);
    (ctr || []).forEach(function (c) { var k = c[campo]; if (k !== '' && k != null) de[String(c.ID)] = String(k); });
    (filas || []).forEach(function (v) {
      var k = de[String(v.ID_CONTRAPARTE || '')];
      if (!k) return;
      var x = venta(d, v, DS, minimo), q = o[k] || (o[k] = { ventas: [], ultima: '', anio: 0, enAnio: 0, debe: 0, sinPrecio: 0 });
      q.ventas.push(x);
      var f = String(v.FECHA || '').slice(0, 10);
      if (f > q.ultima) q.ultima = f;
      if (anio && f.slice(0, 4) === anio) { q.enAnio++; if (x.importe !== null) q.anio += x.importe; }
      if (!x.cobrada && !x.adelantado) { if (x.debe === null) q.sinPrecio++; else q.debe += x.debe; }
    });
    Object.keys(o).forEach(function (k) {
      o[k].ventas.sort(function (a, b) { var x = String(a.v.FECHA || ''), y = String(b.v.FECHA || ''); return x < y ? 1 : x > y ? -1 : String(a.v.ID) < String(b.v.ID) ? 1 : -1; });
    });
    return o;
  }


  /* ---------- T0646 · caja y clientes de una factura ---------- */

  /** La caja partida: lo de la empresa (las cuentas que no son de los tipos de «personales») y lo que la empresa debe a
   *  cada persona (sus cuentas, en positivo: su saldo es negativo con lo que ha puesto). Sin las cuentas a cero, si no se piden. */
  function cajaPartes(cue, sal, personales, ceros, capital) {
    var r = { empresa: [], total: 0, personas: [], debe: 0, capital: [], puesto: 0, ceros: 0 };
    (cue || []).forEach(function (c) {
      var v = sal[c.ID] || 0;
      // T0673 · El capital (tipos de CUENTAS_CAPITAL): lo que puso para crear la empresa, en positivo. No es una deuda ni dinero
      // de la empresa, y es una cifra que no se mueve: Caja no lo enseña (ni entre las cuentas a cero), solo lo aparta.
      if ((capital || []).indexOf(String(c.TIPO || '')) >= 0) { r.capital.push({ c: c, v: -v }); r.puesto -= v; return; }
      if (!v) { r.ceros++; if (!ceros) return; }
      if ((personales || []).indexOf(String(c.TIPO || '')) >= 0) { r.personas.push({ c: c, v: -v }); r.debe -= v; }
      else { r.empresa.push({ c: c, v: v }); r.total += v; }
    });
    return r;
  }
  /** A quién se le puede hacer una factura emitida con CLIENTES: las contrapartes Cliente (y la ya elegida) y las fichas que
   *  aún no son contraparte («marca:» + su ID), las de su lista en «clientes» y las demás en «otros»; por nombre. */
  function clientesFactura(ctr, fichas, cli, sel) {
    var col = String(cli.campo || 'ID_MARCA'), con = {};
    function orden(a, b) { return String(a[1]).localeCompare(String(b[1]), 'es'); }
    var xs = (ctr || []).filter(function (c) { if (c[col]) con[String(c[col])] = 1; return c.TIPO === 'Cliente' || (sel && String(c.ID) === String(sel)); })
      .map(function (c) { return [String(c.ID), c.NOMBRE]; });
    var lista = cli.lista ? String(cli.lista.campo || '') : '', es = cli.lista ? String(cli.lista.valor || '') : '';
    var nuevos = (fichas || []).filter(function (m) { return !con[String(m.ID)] && String(m.NOMBRE || '').trim(); });
    var deLista = function (m) { return !lista || String(m[lista] || '') === es; };
    return {
      clientes: xs.concat(nuevos.filter(deLista).map(function (m) { return ['marca:' + m.ID, m.NOMBRE]; })).sort(orden),
      otros: nuevos.filter(function (m) { return !deLista(m); }).map(function (m) { return ['marca:' + m.ID, m.NOMBRE]; }).sort(orden)
    };
  }
  /** La dirección de un cliente para su factura: la suya o, si no tiene, la de su ficha, con el código postal en otra línea. */
  function direccionCliente(c, ficha, col) {
    if (c && String(c.DIRECCION || '').trim()) return String(c.DIRECCION);
    return ficha && col ? String(ficha[col] || '').trim().replace(/,\s*(\d{5})/, '\n$1') : '';
  }
  /** La categoría de un tipo si solo hay una (sin las del reparto): la que trae puesta un movimiento nuevo. */
  function categoriaUnica(d, tipo) {
    var xs = (d.cat || []).filter(function (c) { return c.TIPO === tipo && !esReparto(d, c); });
    return xs.length === 1 ? String(xs[0].ID) : '';
  }

  /** T0644 · Los filtros puestos en Movimientos, en palabras («gastos», «Telas», «sin factura»), para la línea «Solo …» y para
   *  contar cuántos hay en «Filtrar». La búsqueda no cuenta: se ve en su caja. nombres: { cat(id), cue(id) }. */
  function filtrosMovPuestos(f, nombres) {
    var r = [], n = nombres || {};
    if (f.tipo) r.push({ Ingreso: 'lo que entra', Gasto: 'gastos', Interno: 'entre cuentas' }[f.tipo] || String(f.tipo).toLowerCase());
    if (f.cat) r.push(n.cat ? n.cat(f.cat) : f.cat);
    if (f.cue) r.push((n.cue ? n.cue(f.cue) : f.cue));
    if (f.sinFac) r.push('sin factura');
    if (f.cruz) r.push('con categoría del otro tipo');
    return r;
  }

  /* ---------- T0689 · la factura de un pedido y el ticket de un gasto ---------- */

  /** La factura emitida de una venta (FACTURAS con la columna del desglose, DS, en esa venta), sin las anuladas; la más reciente, o null. */
  function facturaDeVenta(fac, DS, idVenta) {
    if (!DS || !idVenta) return null;
    return (fac || []).filter(function (f) { return f.TIPO === 'Emitida' && f.ESTADO !== 'Anulada' && String(f[DS] || '') === String(idVenta); })
      .sort(function (a, b) { return String(a.FECHA || '') < String(b.FECHA || '') ? 1 : String(a.FECHA || '') > String(b.FECHA || '') ? -1 : 0; })[0] || null;
  }
  /** Las ventas de una contraparte que aún no tienen factura, de la más reciente a la más antigua. */
  function ventasSinFactura(vts, fac, DS, idCtr) {
    if (!idCtr) return [];
    return (vts || []).filter(function (v) { return String(v.ID_CONTRAPARTE || '') === String(idCtr) && !facturaDeVenta(fac, DS, v.ID); })
      .sort(function (a, b) { return String(a.FECHA || '') < String(b.FECHA || '') ? 1 : String(a.FECHA || '') > String(b.FECHA || '') ? -1 : 0; });
  }
  /**
   * La primera línea de la factura de una venta, sacada de lo que dice: el artículo cuyo código aparece en su nombre
   * («Azul noche JAC-107 · 17 m»: el más largo, para no tomar BOR-004 por BOR-004-01), los metros («17 m») y el precio por
   * metro (lo que paga, sin IVA, entre los metros; con 4 decimales, para que la línea dé justo lo que paga). Sin metros, una
   * línea de 1 con todo el importe; sin importe, sin precio. → { articulo, concepto, cantidad, unidad, precio (NaN: sin) }
   */
  function lineaDeVenta(v, arts) {
    var nom = String((v && v.NOMBRE) || ''), up = nom.toUpperCase(), art = null;
    (arts || []).forEach(function (a) { var c = String(a.codigo || '').toUpperCase(); if (c && up.indexOf(c) >= 0 && (!art || c.length > String(art.codigo).length)) art = a; });
    var mm = nom.match(/(\d+(?:[.,]\d+)?)\s*(m|metros)\b/i), metros = mm ? cantidad(mm[1]) : 0;
    var imp = v && v.IMPORTE !== '' && v.IMPORTE != null ? cts(v.IMPORTE) : 0;
    var r = { articulo: art ? art.codigo : '', concepto: art ? '' : nom, cantidad: metros > 0 ? metros : 1, unidad: metros > 0 ? 'm' : '', precio: NaN };
    if (imp > 0) r.precio = Math.round(imp / r.cantidad * 100) / 10000;
    return r;
  }
  /** T0739 · Las líneas de una venta (VENTA_LINEAS), en el orden en que se apuntaron. */
  function lineasVenta(lineas, idVenta) {
    return (lineas || []).filter(function (l) { return idVenta !== '' && idVenta != null && String(l.ID_VENTA) === String(idVenta); })
      .sort(function (a, b) { return String(a.ID) < String(b.ID) ? -1 : String(a.ID) > String(b.ID) ? 1 : 0; });
  }
  /** T0739 · Cómo va el envío de una línea: «DHL · 1Z999AA1» o, sin transportista ni seguimiento, «Por salir». */
  function envioLinea(l) {
    var t = String((l && l.TRANSPORTISTA) || '').trim(), s = String((l && l.SEGUIMIENTO) || '').trim();
    return t || s ? [t, s].filter(Boolean).join(' · ') : 'Por salir';
  }
  /**
   * T0739 · Las líneas de la factura de una venta: con sus líneas (VENTA_LINEAS), una por tela con sus metros (el precio,
   * el recomendado de cada tela; con una sola línea con metros y lo que paga la marca, lo que sale por metro, como
   * lineaDeVenta). Sin líneas, la que sale de su nombre (lineaDeVenta). → [{ articulo, concepto, cantidad, unidad, precio }]
   */
  function lineasFacturaVenta(v, lineas, arts) {
    var ls = lineasVenta(lineas, v && v.ID);
    if (!ls.length) return [lineaDeVenta(v, arts)];
    var imp = v && v.IMPORTE !== '' && v.IMPORTE != null ? cts(v.IMPORTE) : 0;
    return ls.map(function (l) {
      var cod = String(l.ARTICULO || '').trim(), a = (arts || []).filter(function (x) { return x.codigo === cod; })[0] || null;
      var n = l.CANTIDAD === '' || l.CANTIDAD == null ? 0 : cantidad(l.CANTIDAD), r = { articulo: a ? cod : '', concepto: a ? '' : cod, cantidad: n > 0 ? n : '', unidad: a ? a.unidad : 'm', precio: NaN };
      if (ls.length === 1 && imp > 0 && n > 0) r.precio = Math.round(imp / n * 100) / 10000;
      return r;
    });
  }
  /**
   * T0739 · El anticipo que propone la ficha de una marca (ANTICIPO_MARCA), como fracción (0,5 = 50 %), o 0. fila: su fila
   * de ant.tabla; nombreSi(tabla, id): el nombre de esa fila, cuando «si» apunta a otra tabla (SI_NO).
   */
  function anticipoMarca(ant, fila, nombreSi) {
    if (!ant || !fila) return 0;
    var v = fila[ant.columna], si = ant.si === undefined ? 'Sí' : ant.si;
    if (v === '' || v == null) return 0;
    var ok = si && typeof si === 'object' ? String(nombreSi(si.tabla, v) || '') === String(si.nombre) : String(v) === String(si);
    var p = Number(ant.porcentaje);
    return ok && p > 0 && p <= 100 ? p / 100 : 0;
  }
  /** La factura que lleva un cobro de una venta, si no lleva ninguna: la emitida de esa venta (o ''). */
  function facturaDelCobro(m, fac, DS) {
    if (!m || m.TIPO !== 'Ingreso' || m.ID_FACTURA || !DS || !m[DS]) return '';
    var f = facturaDeVenta(fac, DS, m[DS]);
    return f ? String(f.ID) : '';
  }
  /**
   * T0725 (R12) · Una emitida que ya no se cambia: tiene su PDF (ya se ha podido mandar) o no está Pendiente (cobrada o
   * anulada). Solo se cambian su estado y sus notas; corregirla es cosa de una rectificativa, no de reescribirla.
   */
  function facturaCerrada(f) {
    return !!(f && f.TIPO === 'Emitida' && (String(f.ARCHIVO_URL || '').trim() || String(f.ESTADO || '') !== 'Pendiente'));
  }
  /** T0741 · ¿Puede sacar ya su PDF? Una emitida guardada sin PDF que no está anulada: también cobrada (sacarlo no la
   * cambia, solo la guarda en Drive con lo que ya tiene). Con PDF, anulada, recibida o sin guardar, no. */
  function puedeSacarPdf(f) {
    return !!(f && f.TIPO === 'Emitida' && !String(f.ARCHIVO_URL || '').trim() && String(f.ESTADO || '') !== 'Anulada');
  }
  /** T0725 (R62) · Lo que le falta a una línea con unidad y sin cantidad («Faltan los metros.»), o ''. Sin unidad (el envío), nada. */
  function faltaCantidad(l) {
    if (!l || !String(l.CONCEPTO || '').trim() || !String(l.UNIDAD || '').trim()) return '';
    if (String(l.CANTIDAD == null ? '' : l.CANTIDAD).trim() !== '') return '';
    return /^m(etros?)?$/i.test(String(l.UNIDAD).trim()) ? 'Faltan los metros.' : 'Falta la cantidad.';
  }
  /** T0725 (R14) · La emitida de la serie con el número más alto (o null), como la mira el motor (economiaUltima_). */
  function ultimaEmitida(fac, serie) {
    var max = 0, n = String(serie || '').length, u = null;
    (fac || []).forEach(function (f) {
      if (!f || f.TIPO !== 'Emitida') return;
      var s = String(f.NUMERO || '').trim();
      if (s.slice(0, n) !== String(serie || '') || !/^\d+$/.test(s.slice(n))) return;
      if (Number(s.slice(n)) > max) { max = Number(s.slice(n)); u = f; }
    });
    return u;
  }
  /** T0725 (R14) · Lo que falla en la fecha de una emitida nueva: no puede ser anterior a la de la última de su serie. */
  function fechaEmitidaMal(fac, serie, fe) {
    var u = ultimaEmitida(fac, serie);
    if (!u || !fe || String(fe).slice(0, 10) >= String(u.FECHA || '').slice(0, 10)) return '';
    return 'La fecha no puede ser anterior a la de la ' + String(u.NUMERO).trim() + ' (' + fecha(String(u.FECHA).slice(0, 10)) + '): las facturas van numeradas por orden de fecha.';
  }
  /** El número de un ticket que se apunta con su foto: «Ticket · el concepto» (o su fecha), corto. */
  function numeroTicket(concepto, fechaIso) {
    var c = String(concepto || '').replace(/\s+/g, ' ').trim();
    return ('Ticket · ' + (c || fecha(fechaIso))).slice(0, 40).trim();
  }

  /* ----- T0733 · Para tu gestoría: el IVA y las facturas de cada trimestre (modelos 303 y 111) ----- */

  /** El trimestre de una fecha: '2026-11-21' → { ano: '2026', t: 4 } (o null). */
  function trimestreDe(iso) {
    var m = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
    return m ? { ano: m[1], t: Math.ceil(Number(m[2]) / 3) } : null;
  }
  /** { ano, t } → '4T 2026'. */
  function trimestreNombre(q) { return q ? q.t + 'T ' + q.ano : ''; }
  /** Las fechas de un trimestre: { desde: '2026-10-01', hasta: '2026-12-31' }. */
  function trimestreFechas(q) {
    var m0 = (q.t - 1) * 3 + 1, m1 = m0 + 2, p = function (n) { return (n < 10 ? '0' : '') + n; };
    var ult = new Date(Date.UTC(Number(q.ano), m1, 0)).getUTCDate();
    return { desde: q.ano + '-' + p(m0) + '-01', hasta: q.ano + '-' + p(m1) + '-' + p(ult) };
  }
  /**
   * El trimestre que se mira de entrada: el de hoy; en los primeros 20 días de un trimestre (30 en enero), el anterior, que
   * es el que se presenta entonces (modelo 303: del 1 al 20 de abril, julio y octubre, y hasta el 30 de enero).
   */
  function trimestrePorDefecto(hoyIso) {
    var q = trimestreDe(hoyIso); if (!q) return null;
    var mes = Number(String(hoyIso).slice(5, 7)), dia = Number(String(hoyIso).slice(8, 10));
    if ((mes - 1) % 3 === 0 && dia <= (mes === 1 ? 30 : 20)) return q.t === 1 ? { ano: String(Number(q.ano) - 1), t: 4 } : { ano: q.ano, t: q.t - 1 };
    return q;
  }
  /** Los cuatro trimestres de un año, para elegir: [{ ano, t }]. */
  function trimestresDe(ano) { return [1, 2, 3, 4].map(function (t) { return { ano: String(ano), t: t }; }); }
  /**
   * El libro de facturas de un trimestre, por la fecha de la factura: { q, desde, hasta, filas: [{ f, imp, nif, nombre, anulada }]
   * (las emitidas primero, por número; después las recibidas y los tickets, por fecha), baseE, repercutido (IVA de las
   * emitidas), baseR, soportado (el de las recibidas y los tickets), dua (el IVA de importación, que también se descuenta),
   * ret (las retenciones de IRPF, que se pagan con el modelo 111), resultado (repercutido − soportado − dua: > 0, a pagar),
   * sinNif (emitidas sin el NIF del cliente), sinFacGasto y sinFacCobro (movimientos del trimestre sin factura: su IVA no
   * cuenta) }. Las anuladas salen en la lista (la serie no tiene huecos) pero no suman.
   */
  function libroTrimestre(d, q) {
    var r = { q: q, filas: [], baseE: 0, repercutido: 0, baseR: 0, soportado: 0, dua: 0, ret: 0, resultado: 0, sinNif: [], sinFacGasto: [], sinFacCobro: [] };
    if (!q) return r;
    var fs = trimestreFechas(q), ctr = indice(d.ctr), cat = indice(d.cat);
    r.desde = fs.desde; r.hasta = fs.hasta;
    function dentro(x) { var s = String(x.FECHA || '').slice(0, 10); return s >= fs.desde && s <= fs.hasta; }
    function numero(x) { var m = /(\d+)\s*$/.exec(String(x.NUMERO || '')); return m ? Number(m[1]) : 0; }
    d.fac.filter(dentro).sort(function (a, b) {
      var ea = a.TIPO === 'Emitida' ? 0 : 1, eb = b.TIPO === 'Emitida' ? 0 : 1;
      if (ea !== eb) return ea - eb;
      if (!ea) return numero(a) - numero(b) || (String(a.NUMERO) < String(b.NUMERO) ? -1 : 1);
      return String(a.FECHA) < String(b.FECHA) ? -1 : String(a.FECHA) > String(b.FECHA) ? 1 : 0;
    }).forEach(function (x) {
      var i = importe(x), c = ctr[x.ID_CONTRAPARTE] || {}, anul = x.ESTADO === 'Anulada';
      r.filas.push({ f: x, imp: i, nif: String(c.NIF || '').trim(), nombre: String(c.NOMBRE || ''), anulada: anul });
      if (anul) return;
      if (x.TIPO === 'Emitida') { r.baseE += i.base; r.repercutido += i.cuota; if (!String(c.NIF || '').trim()) r.sinNif.push(x); }
      else { r.baseR += i.base; r.soportado += i.cuota; r.dua += i.dua; r.ret += i.ret; }
    });
    r.resultado = r.repercutido - r.soportado - r.dua;
    d.mov.filter(dentro).forEach(function (m) {
      if (m.ID_FACTURA || esReparto(d, cat[m.ID_CATEGORIA])) return;
      if (m.TIPO === 'Gasto') r.sinFacGasto.push(m);
      else if (m.TIPO === 'Ingreso' && importe(m).iva) r.sinFacCobro.push(m);
    });
    return r;
  }
  /**
   * El libro de un trimestre como texto para la gestoría: CSV (sep «;», el que abre bien Excel en español) o, con sep «\t»,
   * para pegar en una hoja. Una fila por factura (también las anuladas), con importes «1234,56» sin separador de miles.
   * Un texto que empieza por = + - @ va con un apóstrofo delante: no es una fórmula al abrirlo.
   */
  function csvLibro(lib, sep) {
    sep = sep || ';';
    var cab = ['Tipo', 'Fecha', 'Número', 'NIF', 'Nombre', 'Base', '% IVA', 'Cuota IVA', 'IVA importación (DUA)', '% retención', 'Retención', 'Total', 'Estado', 'PDF'];
    function num(c) { return (c < 0 ? '-' : '') + (Math.abs(c) / 100).toFixed(2).replace('.', ','); }
    function txt(v) {
      v = String(v == null ? '' : v).replace(/\r?\n/g, ' ');
      if (/^[=+\-@]/.test(v)) v = "'" + v;
      return v.indexOf(sep) >= 0 || /["\t]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    var filas = (lib.filas || []).map(function (x) {
      var f = x.f, i = x.imp, ret = pct(f.RETENCION);
      return [txt(f.TIPO), fecha(String(f.FECHA || '').slice(0, 10)), txt(f.NUMERO), txt(x.nif), txt(x.nombre), num(i.base), txt(tipoIva(f.TIPO_IVA) || '0%'), num(i.cuota),
        i.dua ? num(i.dua) : '', ret ? txt(tipoIva(f.RETENCION)) : '', i.ret ? num(i.ret) : '', num(i.total), txt(f.ESTADO), txt(f.ARCHIVO_URL)].join(sep);
    });
    return [cab.join(sep)].concat(filas).join('\r\n') + '\r\n';
  }
  /**
   * T0733 (R94) · Las fechas que la factura de un pedido lleva además de la suya (Reglamento de facturación, art. 6.1.f):
   * FECHA_OPERACION, la de la entrega del pedido si es otra; VENCIMIENTO, si la forma de pago dice «a 30 días», la fecha
   * de la factura más esos días. → { FECHA_OPERACION?, VENCIMIENTO? }
   */
  function fechasFactura(fechaFac, venta, formaPago) {
    var o = {}, fe = String(fechaFac || '').slice(0, 10), en = String((venta && venta.FECHA_ENTREGA) || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(en) && en !== fe) o.FECHA_OPERACION = en;
    var m = /(\d{1,3})\s*d[ií]as/i.exec(String(formaPago || ''));
    if (m && Number(m[1]) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(fe)) {
      var t = new Date(fe + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + Number(m[1]));
      o.VENCIMIENTO = t.toISOString().slice(0, 10);
    }
    return o;
  }

  var CALC = { facturaDeVenta: facturaDeVenta, ventasSinFactura: ventasSinFactura, lineaDeVenta: lineaDeVenta, lineasVenta: lineasVenta, envioLinea: envioLinea, lineasFacturaVenta: lineasFacturaVenta, anticipoMarca: anticipoMarca, facturaDelCobro: facturaDelCobro, numeroTicket: numeroTicket, facturaCerrada: facturaCerrada, puedeSacarPdf: puedeSacarPdf, faltaCantidad: faltaCantidad, ultimaEmitida: ultimaEmitida, fechaEmitidaMal: fechaEmitidaMal,
    filtrosMovPuestos: filtrosMovPuestos, cajaPartes: cajaPartes, clientesFactura: clientesFactura, direccionCliente: direccionCliente, categoriaUnica: categoriaUnica, cts: cts, pct: pct, tipoIva: tipoIva, opciones: opciones, opcionesConValor: opcionesConValor, importe: importe, baseDeTotal: baseDeTotal, eur: eur, eur0: eur0, fecha: fecha, periodos: periodos, periodoActual: periodoActual,
    anteriores: anteriores, movDe: movDe, facDe: facDe, preDe: preDe, resumen: resumen, saldos: saldos, cuenta: cuenta, pendientes: pendientes,
    sinFactura: sinFactura, presupuesto: presupuesto, grupos: grupos, estadoLinea: estadoLinea, avisos: avisos, cruzados: cruzados,
    desglose: desglose, recomendar: recomendar, esReparto: esReparto, problemasMov: problemasMov,
    cantidad: cantidad, precio: precio, iban: iban, sinIva: sinIva, conIvaPrecio: conIvaPrecio, importeLinea: importeLinea, baseLineas: baseLineas, lineasDe: lineasDe,
    articulos: articulos, buscarArt: buscarArt, artDe: artDe, ultimoPrecio: ultimoPrecio, precioOpcion: precioOpcion, conQuien: conQuien,
    fraccion: fraccion, diasEntre: diasEntre, venta: venta, ventas: ventas, minimoDe: minimoDe, ventasPorQuien: ventasPorQuien,
    palabraVenta: palabraVenta, decir: decir, pasoDicho: pasoDicho, listaY: listaY, enPeriodo: enPeriodo, numeroEscrito: numeroEscrito, numTxt: numTxt, monedas: monedas,
    aEuros: aEuros, notasConCambio: notasConCambio, faltanFactura: faltanFactura, faltanTexto: faltanTexto,
    trimestreDe: trimestreDe, trimestreNombre: trimestreNombre, trimestreFechas: trimestreFechas, trimestrePorDefecto: trimestrePorDefecto, trimestresDe: trimestresDe,
    libroTrimestre: libroTrimestre, csvLibro: csvLibro, fechasFactura: fechasFactura };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  var TABLAS = ['MOVIMIENTOS', 'CATEGORIAS', 'CUENTAS', 'CONTRAPARTES', 'FACTURAS', 'PRESUPUESTOS'];
  // T0726 (R56): el del PDF de una factura (una hoja con la esquina doblada), como los enlaces del Listado.
  var ICONO_PDF = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 15.5h5"/></svg>';
  var ICONO_FILTRO = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4 1.5v-8L4 5z"/></svg>';
  var PESTANAS = { RESUMEN: 'Resumen', VENTAS: 'Ventas', MOVIMIENTOS: 'Movimientos', CAJA: 'Caja', PENDIENTE: 'Pendiente', FACTURAS: 'Facturas', PRESUPUESTO: 'Presupuesto', GESTORIA: 'Para tu gestoría' }; // T0733: GESTORIA
  var VER = 150; // filas de una lista larga antes de «Ver más»
  // T0689 · La foto de un ticket: como mucho 20 MB al elegirla; se manda reducida (1.600 px, JPEG), que basta para leerla.
  var MAX_FOTO = 20 * 1024 * 1024, LADO_FOTO = 1600;
  var ICONO_FOTO = '<svg class="eco-foto-ic" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  /** T0689 · Un archivo elegido → promesa con { tipo, datos (base64) }: una foto, reducida a LADO_FOTO en JPEG (si el navegador
   *  no puede abrirla, como HEIC en Chrome, tal cual); un PDF, tal cual. */
  function prepararArchivo(fl) {
    return new Promise(function (ok, mal) {
      var r = new FileReader();
      r.onerror = function () { mal(new Error('No se ha podido leer el archivo.')); };
      r.onload = function () {
        var url = String(r.result), tipo = fl.type || 'application/octet-stream', tal = { tipo: tipo, datos: url.split(',')[1] || '' };
        if (!/^image\/(jpeg|png|webp)$/.test(tipo)) { ok(tal); return; }
        var img = new Image();
        img.onerror = function () { ok(tal); };
        img.onload = function () {
          var k = Math.min(1, LADO_FOTO / Math.max(img.width || 1, img.height || 1)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          try { c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ok({ tipo: 'image/jpeg', datos: c.toDataURL('image/jpeg', 0.82).split(',')[1] }); } catch (e) { ok(tal); }
        };
        img.src = url;
      };
      r.readAsDataURL(fl);
    });
  }

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function opciones(lista, sel, vacio) {
    return (vacio !== undefined ? '<option value="">' + texto(vacio) + '</option>' : '') + lista.map(function (o) {
      return '<option value="' + texto(o[0]) + '"' + (String(o[0]) === String(sel == null ? '' : sel) ? ' selected' : '') + '>' + texto(o[1]) + '</option>';
    }).join('');
  }
  /** T0725 (R03) · Las <option> de un desplegable entero (el IVA): un valor guardado que no está en la lista sale también,
   *  elegido (al guardar sin tocarlo, se queda como estaba en vez de cambiar a la primera opción). */
  function opcionesConValor(lista, sel) {
    var s = String(sel == null ? '' : sel), esta = !s || lista.some(function (o) { return String(o[0]) === s; });
    return opciones(lista, s) + (esta ? '' : '<option value="' + texto(s) + '" selected>' + texto(s) + '</option>');
  }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) {} return ''; }
  function norm(s) { return plano(s); }
  function cifra(c, bien) { return '<span class="u-cifra' + (c < 0 && bien ? ' u-mal' : '') + '">' + eur(c) + '</span>'; }
  /** La barra de lo gastado o cobrado: en teja si se ha pasado; T0726 (R56): en gris si no tiene previsto (no hay con qué compararla). */
  function barra(p, mal, gris) { p = Math.max(0, Math.min(1, p || 0)) * 100; return '<div class="eco-barra-p"><i' + (mal ? ' class="eco-pasado"' : gris ? ' class="eco-sinprev"' : '') + ' style="width:' + p.toFixed(1) + '%"></i></div>'; }
  function clase(e) { return e.mal ? 'u-mal' : e.bien ? 'eco-bien' : ''; }

  window.UN.registrar('ECONOMIA', {
    abrir: function (el, ctx) {
      var T = ctx.tablas, cfg = ctx.config || {}, R = cfg._refs || {};
      var P = String(cfg.PERIODO || ''), DS = String(cfg.DESGLOSE || '');
      var nomPer = String(cfg.NOMBRE_PERIODO || 'Año'), nomDes = String(cfg.NOMBRE_DESGLOSE || DS);
      // T0726 (R26): cómo se llama aquí una venta (NOMBRE_VENTA: «pedido» en Telas), siempre la misma palabra.
      var PV = palabraVenta(cfg.NOMBRE_VENTA);
      function V(t) { return decir(PV, t); }
      function paso(t) { return pasoDicho(t, PV); }
      // T0627: con FACTURA_LINEAS, una factura emitida se hace por líneas (tabla FACTURA_LINEAS) y se ve como documento.
      var LINEAS = cfg.FACTURA_LINEAS === 'Sí';
      // y los datos de la empresa para el documento salen de la tabla EMPRESA, que se cambia desde aquí (Datos de tu empresa).
      var tablas = TABLAS.concat(LINEAS ? ['FACTURA_LINEAS', 'EMPRESA'] : [], R.PERIODO ? [R.PERIODO] : [], R.DESGLOSE && R.DESGLOSE !== R.PERIODO ? [R.DESGLOSE] : []);
      // T0635: con ARTICULOS (Mis telas), en cada línea se elige lo que se vende y sale su precio recomendado.
      var ART = LINEAS && cfg.ARTICULOS && cfg.ARTICULOS.tabla ? cfg.ARTICULOS : null;
      if (ART) [ART.tabla].concat(Object.keys(ART._refs || {}), Object.keys(ART._valores || {}).map(function (k) { var v = ART._valores[k]; return v && v.tabla; }))
        .forEach(function (t) { if (t && tablas.indexOf(t) < 0) tablas.push(t); });
      // T0646 · Con CLIENTES (p. ej. las MARCAS de GESTION), la factura emitida solo ofrece clientes: las contrapartes de tipo
      // Cliente y las marcas que aún no lo son (se dan de alta al guardar), con la dirección de su ficha.
      var CLI = LINEAS && cfg.CLIENTES && cfg.CLIENTES.tabla ? cfg.CLIENTES : null;
      // T0725 (R04): las ventas (Pedidos) eligen la marca igual que una factura emitida, también sin FACTURA_LINEAS.
      var CLIV = cfg.CLIENTES && cfg.CLIENTES.tabla ? cfg.CLIENTES : null;
      if (CLI && tablas.indexOf(CLI.tabla) < 0) tablas.push(CLI.tabla);
      // T0628: la pestaña Ventas, con la tabla VENTAS, que es la del desglose (sus movimientos la eligen); el mínimo, de
      // MARGEN_MINIMO (un número o una fila de otra tabla, como AJUSTES).
      var VEN = cfg.VENTAS && DS && R.DESGLOSE === cfg.VENTAS ? String(cfg.VENTAS) : '';
      var MIN = cfg.MARGEN_MINIMO && typeof cfg.MARGEN_MINIMO === 'object' && cfg.MARGEN_MINIMO.tabla ? cfg.MARGEN_MINIMO : null;
      if (VEN && MIN && tablas.indexOf(MIN.tabla) < 0) tablas.push(MIN.tabla);
      // T0739 · Con LINEAS_VENTA, cada venta lleva sus líneas (VENTA_LINEAS): qué se vende (de ARTICULOS), cuánto, quién lo
      // hace (el «taller» del artículo) y cómo va su envío. Con ANTICIPO_MARCA, el anticipo de una venta nueva sale de la ficha.
      var LV = !!VEN && cfg.LINEAS_VENTA === 'Sí';
      var ARTV = LV && cfg.ARTICULOS && cfg.ARTICULOS.tabla ? cfg.ARTICULOS : null;
      var ANT = VEN && CLIV && cfg.ANTICIPO_MARCA && cfg.ANTICIPO_MARCA.tabla ? cfg.ANTICIPO_MARCA : null;
      [LV ? 'VENTA_LINEAS' : '', VEN && CLIV ? CLIV.tabla : '', ANT ? ANT.tabla : '', ANT && ANT.si && ANT.si.tabla ? ANT.si.tabla : '']
        .concat(ARTV ? [ARTV.tabla].concat(Object.keys(ARTV._refs || {})) : [])
        .forEach(function (t) { if (t && tablas.indexOf(t) < 0) tablas.push(t); });
      function hayPest(s) { return PESTANAS[s] && (s !== 'VENTAS' || VEN); }
      var pest = String(cfg.PESTANAS || 'RESUMEN, MOVIMIENTOS, CAJA, PENDIENTE, FACTURAS, PRESUPUESTO').split(',').map(function (s) { return s.trim().toUpperCase(); })
        .filter(hayPest);
      if (!pest.length) pest = Object.keys(PESTANAS).filter(hayPest);
      var prepara = ctx.admin || String(cfg.PREPARA_PRESUPUESTO || '').split(',').map(function (s) { return s.trim(); }).indexOf(ctx.perfil) >= 0;
      var CLAVE = 'eco_' + ctx.id + '_';
      // T0689 · Una venta lleva su factura si FACTURAS tiene la columna del desglose (ID_VENTA). Se hace aquí si esta sección
      // hace facturas por líneas; si no (Pedidos), en la sección FACTURAR (Economía), con ?factura=nueva&pedido=<venta>.
      var FACTURAR = String(cfg.FACTURAR || '').trim().toLowerCase();
      function facPorVenta() { return !!(VEN && DS && d && d.colsFac.indexOf(DS) >= 0); }
      function hrefFacturaVenta(v) { return '?s=' + encodeURIComponent(FACTURAR) + '&factura=nueva&pedido=' + encodeURIComponent(v.ID); }
      // T0689 · Los tickets (la foto de un gasto) van a Drive si el negocio tiene dónde: TICKETS_CARPETA o, si no, una carpeta
      // «Tickets» junto a la de las facturas (FACTURA_CARPETA), que el motor crea la primera vez.
      var TICKETS = !!String(cfg.TICKETS_CARPETA || cfg.FACTURA_CARPETA || '').trim();
      var volverTras = null; // T0689 · la sección de la que se viene con un enlace para hacer una factura ({ id, titulo })
      function movVacio() { return { tipo: '', cat: '', cue: '', q: '', sinFac: false, cruz: false, ver: VER, desde: '' }; }
      var S = { tab: pest.indexOf(guardado(CLAVE + 'tab')) >= 0 ? guardado(CLAVE + 'tab') : pest[0], per: guardado(CLAVE + 'per'), des: '',
        mov: movVacio(), fac: { tipo: '', estado: '' }, gest: { q: null }, caja: { cue: '', ceros: false }, ven: { id: '', des: '', volver: null }, ab: {}, ceros: false, medidas: null, leido: false };
      // T0692 · ?venta=VEN0001 (desde la ficha de una marca en Clientes): abre esa venta, con «‹ Volver a …» a la ficha de la que
      // se viene. Se quita de la dirección: el atrás del navegador ya vuelve a la ficha.
      (function () {
        var u; try { u = new URL(location.href); } catch (e) { return; }
        var id = u.searchParams.get('venta');
        if (id === null) return;
        u.searchParams.delete('venta');
        try { history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) {}
        if (!id || pest.indexOf('VENTAS') < 0) return;
        S.tab = 'VENTAS'; S.ven.id = String(id); S.ven.volver = ctx.desde || null;
      })();

      el.innerHTML = (cfg.AYUDA ? '<p class="u-nota n-ayuda">' + texto(cfg.AYUDA) + '</p>' : '') +
        '<div class="eco-barra"><label class="u-campo eco-per"><span class="u-etiqueta">' + texto(nomPer) + '</span><select id="eco-per"></select></label>' +
        '<div class="u-pestanas" role="tablist"' + (pest.length < 2 ? ' hidden' : '') + '>' + pest.map(function (p) {
          return '<button type="button" role="tab" data-tab="' + p + '">' + (p === 'VENTAS' ? V('{Ventas}') : PESTANAS[p]) + (p === 'PENDIENTE' ? ' <span class="u-chip" id="eco-npend" hidden></span>' : '') + '</button>';
        }).join('') + '</div></div>' +
        '<div id="eco-cont" class="eco-cont"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<button type="button" class="eco-fab" data-accion="apuntar" hidden>Añadir movimiento</button>' + // T0726 (R28): hasta que carga, no
        '<div class="u-velo" id="eco-velo"><div class="u-ventana" role="dialog" aria-modal="true" aria-labelledby="eco-vt"><div class="n-ventana" id="eco-vent"></div></div></div>';
      var cont = el.querySelector('#eco-cont'), velo = el.querySelector('#eco-velo'), vent = el.querySelector('#eco-vent'), selPer = el.querySelector('#eco-per');

      /**
       * T0726 (R63) · Lo que devuelve una función de la sección con las filas que ha escrito ({ otras: { TABLA: [filas] } }) → a
       * la copia, sin volver a leer el Excel. Si la capa de tablas no sabe (Supabase), se vuelven a leer esas tablas.
       */
      function anotar(ts) {
        return function (r) {
          if (r && r.otras && typeof T.anotar === 'function') { T.anotar(r); return r; }
          return Promise.resolve(T.refrescar ? T.refrescar(ts, true) : null).then(function () { return r; });
        };
      }
      function filaDe(t, id) {
        if (id === '' || id == null) return null;
        if (T.fila) return T.fila(t, id);
        return (T.filas(t) || []).filter(function (x) { return String(x.ID) === String(id); })[0] || null;
      }

      /* ---------- datos ---------- */

      /** T0725 (R03): TIPO_IVA, como lo enseña la web («0%»), aunque el Excel lo guarde como número. */
      function ivaLeido(xs) {
        (xs || []).forEach(function (x) {
          if (x && 'TIPO_IVA' in x) { var t = tipoIva(x.TIPO_IVA); if (t !== x.TIPO_IVA) x.TIPO_IVA = t; }
          if (x && x.RETENCION !== '' && x.RETENCION != null) { var r = tipoIva(x.RETENCION); if (r !== x.RETENCION) x.RETENCION = r; } // T0733: 0,15 → «15%»
        });
        return xs;
      }
      function datos() {
        return {
          cfg: cfg, mov: ivaLeido(T.filas('MOVIMIENTOS')), cat: T.filas('CATEGORIAS'), cue: T.filas('CUENTAS'), ctr: T.filas('CONTRAPARTES'),
          fac: ivaLeido(T.filas('FACTURAS')), pre: T.filas('PRESUPUESTOS'), per: R.PERIODO ? T.filas(R.PERIODO) : [], des: R.DESGLOSE ? T.filas(R.DESGLOSE) : [],
          colsPre: T.columnas ? T.columnas('PRESUPUESTOS') : [], colsMov: T.columnas ? T.columnas('MOVIMIENTOS') : [],
          lin: LINEAS ? T.filas('FACTURA_LINEAS') : [], emp: LINEAS ? T.filas('EMPRESA')[0] || null : null, colsEmp: LINEAS && T.columnas ? T.columnas('EMPRESA') || [] : [], colsCtr: T.columnas ? T.columnas('CONTRAPARTES') : [],
          colsFac: T.columnas ? T.columnas('FACTURAS') || [] : [],
          lv: LV ? T.filas('VENTA_LINEAS') || [] : [] // T0739
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
      function nombre(t, id) {
        var f = ix[t][String(id || '')];
        if (f && t === 'des' && VEN) return nombreVenta(f);
        return f ? String(f.NOMBRE || f.ID) : String(id || '');
      }
      /** T0628 · Una venta, como se dice: «Marca · lo que es». */
      function nombreVenta(v) {
        var c = v.ID_CONTRAPARTE ? ix.ctr[String(v.ID_CONTRAPARTE)] : null;
        return [c ? String(c.NOMBRE) : '', String(v.NOMBRE || v.ID)].filter(Boolean).join(' · ');
      }
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
        el.querySelector('.eco-per').style.display = S.tab === 'VENTAS' || S.tab === 'CAJA' || S.tab === 'GESTORIA' ? 'none' : ''; // T0733: la gestoría elige su trimestre; // T0628: las ventas, desde el principio (no por periodo). T0679: Caja tampoco (sus saldos son de siempre): el año sale solo donde cuenta
        cont.classList.toggle('eco-con-fab', S.tab === 'MOVIMIENTOS'); // T0644: con sitio abajo para el botón
        var np = pendientes(d).filter(function (x) { return x.falta > 0; }).length + sinFactura(d, per).length, nb = el.querySelector('#eco-npend');
        if (nb) { nb.textContent = np; nb.hidden = !np; }
        if (!d.cue.length && !d.mov.length) {
          cont.innerHTML = '<p class="u-vacio">Todavía no hay cuentas ni movimientos. Añade al menos una cuenta (banco o caja) en la tabla CUENTAS del Excel ECONOMIA y apunta aquí el primer movimiento.</p>';
          return;
        }
        // Cada tabla en su caja: si no cabe en el móvil, se desplaza ella y no la página.
        cont.innerHTML = ({ RESUMEN: htmlResumen, VENTAS: htmlVentas, MOVIMIENTOS: htmlMovimientos, CAJA: htmlCaja, PENDIENTE: htmlPendiente, FACTURAS: htmlFacturas, PRESUPUESTO: htmlPresupuesto, GESTORIA: htmlGestoria })[S.tab]()
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
            barra(g.previsto ? g.real / g.previsto : g.real ? 1 : 0, tipo === 'Gasto' && e.mal, e.sinPrevisto) +
            '<div class="eco-gs"><span>' + (g.previsto ? 'Previsto ' + eur0(g.previsto) : 'Sin previsto') + '</span><span class="' + clase(e) + '"><b>' + texto(e.t) + '</b></span></div></button>' +
            '<div class="eco-lineas"' + (ab ? '' : ' hidden') + '>' + cats.map(function (x) {
              var ec = estadoLinea(tipo, x.previsto, x.real);
              return '<button type="button" class="eco-linea" data-vercat="' + texto(x.cat.ID) + '" title="Ver sus movimientos">' +
                '<div class="eco-gl"><b>' + texto(x.cat.NOMBRE) + '</b><span class="eco-num">' + eur0(x.real) + ' <span class="eco-ir" aria-hidden="true">›</span></span></div>' +
                barra(x.previsto ? x.real / x.previsto : x.real ? 1 : 0, tipo === 'Gasto' && ec.mal, ec.sinPrevisto) +
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
          '<div class="eco-rf"><span>Beneficio<small>Ingresos menos gastos ' + texto(enPeriodo(nomPeriodo(), 'de')) + ', sin IVA</small></span><span>' + eur0(r.resultado) + '</span></div>' +
          '<div class="eco-rf"><span>Reparto</span><span>' + (r.reparto ? '− ' + eur0(r.reparto) : '0 €') + '</span></div>' +
          orden.map(function (k) { return '<div class="eco-rf eco-rf-sub"><span>' + texto(k) + '</span><span>' + eur0(quien[k]) + '</span></div>'; }).join('') +
          '<div class="eco-rf eco-rf-tot"><span>Resultado<small>Lo que queda tras el reparto</small></span><span class="' + (r.tras < 0 ? 'u-mal' : '') + '">' + eur0(r.tras) + '</span></div></details>';
      }

      function htmlResumen() {
        var r = resumen(d, per, S.des), ps = presupuesto(d, per, S.des), gs = grupos(d, ps);
        var pi = 0, pg = 0; gs.forEach(function (g) { if (g.tipo === 'Ingreso') pi += g.previsto; else pg += g.previsto; });
        var pb = pi - pg, desv = r.resultado - pb, ds = desglose(d, per), h = '';
        // T0628: cada venta, con su marca, como en Ventas.
        if (VEN && ds) ds.forEach(function (x) { var f = x.id ? ix.des[String(x.id)] : null; if (f) x.nombre = nombreVenta(f); });
        // T0726 (R56): el filtro, solo si hay alguna parte de verdad (sin ventas, solo saldría «General»).
        if (ds && ds.some(function (x) { return x.id; })) {
          h += '<div class="u-filtros eco-filtro-des"><label class="u-campo"><span class="u-etiqueta">' + texto(nomDes) + '</span><select id="eco-des">' +
            opciones(ds.map(function (x) { return [x.id || '-', x.nombre]; }), S.des, 'Todas') + '</select></label></div>';
        }
        // T0270: las cifras grandes y las pequeñas, juntas: en una pantalla ancha van en la misma fila.
        h += '<div class="eco-arriba"><div class="eco-kpis">' +
          '<div class="eco-kpi eco-grande"><b>Beneficio <span class="eco-pint">' + texto(nomPeriodo()) + '</span></b><span class="eco-val">' + eur0(r.resultado) + '</span>' +
          '<span class="eco-sub">' + (pb || pi || pg ? 'Previsto: ' + eur0(pb) + '. Vas ' + eur0(Math.abs(desv)) + (desv >= 0 ? ' mejor' : ' peor') : 'Sin presupuesto') + '</span></div>' +
          '<div class="eco-kpi"><b>Ingresos</b><span class="eco-val">' + eur0(r.ingresos.base) + '</span><span class="eco-sub">' + (pi ? 'de ' + eur0(pi) + ' previstos' : 'sin IVA') + '</span></div>' +
          '<div class="eco-kpi"><b>Gastos</b><span class="eco-val">' + eur0(r.gastos.base) + '</span><span class="eco-sub">' + (pg ? 'de ' + eur0(pg) + ' previstos' : 'sin IVA') + '</span></div></div>';
        var pend = pendientes(d).filter(function (x) { return x.falta > 0; }), sf = sinFactura(d, per, S.des);
        // T0733 (R57): con «Para tu gestoría», el IVA es el del trimestre, de las facturas (el que se declara), y lleva allí.
        var qR = pest.indexOf('GESTORIA') >= 0 ? trimestreResumen() : null, LR = qR ? libroTrimestre(d, qR) : null;
        h += '<div class="eco-mini">' + (LR ? '<button type="button" data-ir="GESTORIA" data-trim-ir="' + qR.ano + '-' + qR.t + '"><strong>' + eur0(Math.abs(LR.resultado)) + '</strong><small>IVA del ' + texto(trimestreNombre(qR)) + (LR.resultado >= 0 ? '' : ' a tu favor') + ' ›</small></button>'
          : '<button type="button" data-abrir="iva"><strong>' + eur0(Math.abs(r.iva)) + '</strong><small>IVA ' + (r.iva >= 0 ? 'a pagar' : 'a devolver') + '</small></button>') +
          '<button type="button" data-ir="PENDIENTE"><strong' + (sf.length ? ' class="u-mal"' : '') + '>' + sf.length + '</strong><small>Gastos sin factura ›</small></button>' +
          '<button type="button" data-ir="PENDIENTE"><strong>' + pend.length + '</strong><small>Facturas pendientes ›</small></button></div></div>';
        h += '<details class="eco-card eco-desp" id="eco-iva"' + (S.ab.iva ? ' open' : '') + '><summary><b><span class="eco-flecha" aria-hidden="true">›</span> Ingresos, gastos e IVA</b>' +
          '<span class="u-nota">' + r.n + (r.n === 1 ? ' movimiento' : ' movimientos') + '</span></summary>' +
          '<table class="u-tabla eco-tabla"><thead><tr><th></th><th class="num">Sin IVA</th><th class="num">IVA</th><th class="num u-solo-ancho">Total</th></tr></thead><tbody>' +
          '<tr><td class="u-tabla-t">Ingresos</td><td class="num">' + eur(r.ingresos.base) + '</td><td class="num">' + eur(r.ingresos.iva) + '</td><td class="num u-solo-ancho">' + eur(r.ingresos.total) + '</td></tr>' +
          '<tr><td class="u-tabla-t">Gastos</td><td class="num">' + eur(r.gastos.base) + '</td><td class="num">' + eur(r.gastos.iva) + '</td><td class="num u-solo-ancho">' + eur(r.gastos.total) + '</td></tr>' +
          '<tr class="eco-total"><td class="u-tabla-t">Beneficio</td><td class="num">' + cifra(r.resultado, true) + '</td><td class="num">' + eur(r.iva) + '</td><td class="num u-solo-ancho"></td></tr>' +
          '</tbody></table><p class="u-nota">' + (LR ? 'IVA cobrado menos pagado: ' + eur(r.iva) : r.iva >= 0 ? 'IVA a pagar: ' + eur(r.iva) : 'IVA a devolver: ' + eur(-r.iva)) +
          ' (el de los ingresos menos el de los gastos' + (r.reparto ? ', también el del reparto' : '') + '). Los movimientos entre cuentas no cuentan.' +
          (LR ? ' El que declaras sale de las facturas, por trimestre: <button type="button" class="u-btn u-btn-texto" data-ir="GESTORIA">Para tu gestoría</button>.' : '') + '</p></details>';
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
        if (!r.n && !ps.some(function (x) { return x.previsto; })) h += '<p class="u-vacio">Todavía no hay movimientos ' + texto(enPeriodo(nomPeriodo())) + '. Los que apuntes en Movimientos salen aquí al momento.</p>';
        return h;
      }

      /* ----- Movimientos ----- */

      function movFiltrados(f) {
        f = f || S.mov; var q = norm(f.q);
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
        // T0673 · Con quién, una sola vez: la venta sin su marca si es la misma contraparte, y la contraparte no se repite si ya la dice el concepto.
        var conDes = DS && m[DS] && S.tab !== 'VENTAS'; // T0628: dentro de una venta, ya se sabe cuál
        var cq = conQuien(m, interno ? '' : nombre('ctr', m.ID_CONTRAPARTE), conDes ? nombre('des', m[DS]) : '', conDes && VEN ? ix.des[String(m[DS])] : null);
        var sub = [fecha(m.FECHA), interno ? nombre('cue', m.ID_CUENTA) + ' → ' + nombre('cue', m.ID_CUENTA_DESTINO) : nombre('cat', m.ID_CATEGORIA), cq.des, cq.ctr].filter(Boolean).join(' · ');
        return '<tr tabindex="0" data-mov="' + texto(m.ID) + '"><td class="u-tabla-t">' + texto(m.CONCEPTO) + chip(m) +
          (sinFac(m) ? ' <span class="u-chip">Sin factura</span>' : '') + '<div class="u-nota">' + texto(sub) + '</div></td>' +
          '<td class="num u-solo-ancho">' + texto(interno ? '' : nombre('cue', m.ID_CUENTA)) + '</td>' +
          '<td class="num">' + (interno ? '<span class="u-cifra">' + eur(importe(m).total) + '</span><div class="u-nota">Entre cuentas</div>' :
            '<span class="u-cifra ' + (s < 0 ? 'u-mal' : 'eco-bien') + '">' + (s > 0 ? '+' : '') + eur(s) + '</span>') + (extra || '') + '</td></tr>';
      }

      function htmlMovimientos() {
        var f = S.mov, ms = movFiltrados(), neto = 0;
        ms.forEach(function (m) { neto += signo(m); });
        // T0644 · Como Facturas y las demás secciones: buscar, «Filtrar» (abre sus filtros, con cuántos hay puestos) y lo puesto,
        // en una línea que se quita. Así, en el móvil, el primer movimiento sale arriba (antes, a unos 650 px, tras 6 filtros).
        var puestos = filtrosMovPuestos(f, { cat: function (id) { return nombre('cat', id); }, cue: function (id) { return nombre('cue', id); } }), nf = puestos.length;
        var h = (f.desde ? '<button type="button" class="u-btn u-btn-texto eco-volver" data-accion="volver">‹ Volver a ' + texto(PESTANAS[f.desde] || 'Resumen') + '</button>' : '') +
          '<div class="li-barra eco-fbarra eco-fmov"><div class="li-buscar"><label class="u-oculto" for="eco-q">Buscar</label><input type="search" id="eco-q" value="' + texto(f.q) + '" placeholder="Buscar en movimientos" autocomplete="off"></div>' +
          '<button type="button" class="u-btn li-filtrar" data-accion="filtrarmov" aria-haspopup="dialog"' + (nf ? ' aria-pressed="true"' : '') + '>' + ICONO_FILTRO + 'Filtrar' +
          (nf ? ' <span class="li-nf" aria-label="' + nf + (nf === 1 ? ' puesto' : ' puestos') + '">' + nf + '</span>' : '') + '</button></div>' +
          (nf ? '<p class="u-nota">Solo ' + texto(puestos.join(', ')) + ' · <button type="button" class="u-btn u-btn-texto" data-accion="quitarfmov">Quitar filtros</button></p>' : '') +
          (S.des ? '<p class="u-nota">Solo ' + texto(S.des === '-' ? 'General' : nombre('des', S.des)) + ' · <button type="button" class="u-btn u-btn-texto" data-accion="todasdes">ver ' + texto(nomDes.toLowerCase()) + ': todas</button></p>' : '');
        if (!ms.length) return h + '<p class="u-vacio">' + (movDe(d, per, S.des).length ? 'Ningún movimiento cumple el filtro. Quita algún filtro para ver más.' :
          'Todavía no hay movimientos ' + texto(enPeriodo(nomPeriodo())) + '. Los que apuntes con «Añadir movimiento» salen aquí al momento.') + '</p>';
        h += '<p class="u-nota">' + ms.length + (ms.length === 1 ? ' movimiento' : ' movimientos') + ' · suman <b class="' + (neto < 0 ? 'u-mal' : 'eco-bien') + '">' + eur(neto) + '</b> (entra menos sale, con IVA)</p>' +
          '<table class="u-tabla eco-tabla"><thead><tr><th>Movimiento</th><th class="num u-solo-ancho">Cuenta</th><th class="num">Importe</th></tr></thead><tbody>' + ms.slice(0, f.ver).map(function (m) { return filaMov(m); }).join('') + '</tbody></table>';
        if (ms.length > f.ver) h += '<button type="button" class="u-btn" data-accion="vermas">Ver ' + Math.min(VER, ms.length - f.ver) + ' movimientos más</button>';
        return h;
      }

      /* ----- Caja ----- */

      // T0646 · Con CUENTAS_PERSONALES (tipos de CUENTAS que son lo que pone una persona, p. ej. «Personal»), la caja no las
      // suma al dinero de la empresa: van aparte, en positivo, como lo que la empresa le debe a esa persona.
      // T0707 · Un gasto pagado desde una de ellas es gasto de la empresa (Resumen, resultado y lo invertido) y, a la vez, lo que se
      // le debe: no se cuenta dos veces (Javi, 20/11/2026). El capital no es ni lo uno ni lo otro.
      var PERSONALES = String(cfg.CUENTAS_PERSONALES || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      function esPersonal(c) { return PERSONALES.indexOf(String(c.TIPO || '')) >= 0; }
      // T0673 · Con CUENTAS_CAPITAL (p. ej. «Capital»), el capital no sale en Caja: ni dinero de la empresa ni lo que te debe.
      var CAPITAL = String(cfg.CUENTAS_CAPITAL || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      function htmlCaja() {
        if (S.caja.cue && ix.cue[S.caja.cue]) return htmlCuenta(ix.cue[S.caja.cue]);
        var sal = saldos(d), x = cajaPartes(d.cue, sal, PERSONALES, S.caja.ceros, CAPITAL), tipos = [], por = {}, tot = x.total, ceros = x.ceros, pers = x.personas, debe = x.debe;
        x.empresa.forEach(function (y) { var t = String(y.c.TIPO || 'Otras'); if (!por[t]) { por[t] = []; tipos.push(t); } por[t].push(y.c); });
        function fila(c, v, nota) {
          return '<tr tabindex="0" data-cuenta="' + texto(c.ID) + '"><td class="u-tabla-t">' + texto(c.NOMBRE) + (nota ? '<div class="u-nota">' + texto(nota) + '</div>' : '') +
            '</td><td class="num">' + cifra(v, true) + ' <span class="eco-ir" aria-hidden="true">›</span></td></tr>';
        }
        var h = '<p class="u-nota">El dinero que hay en cada cuenta, con todos los movimientos (no solo los de ' + texto(nomPeriodo()) + '). Toca una para ver lo que entra y sale.</p>';
        if (!tipos.length && !pers.length) return h + '<p class="u-vacio">Todas las cuentas están a cero.</p>';
        if (PERSONALES.length) {
          var cs = []; tipos.forEach(function (t) { cs = cs.concat(por[t]); });
          h += '<h2 class="n-grupo">Dinero de la empresa</h2>' + (cs.length ? '<table class="u-tabla eco-tabla"><tbody>' + cs.map(function (c) { return fila(c, sal[c.ID] || 0); }).join('') +
            (cs.length > 1 ? '<tr class="eco-total"><td class="u-tabla-t">Total de la empresa</td><td class="num">' + cifra(tot, true) + '</td></tr>' : '') + '</tbody></table>'
            : '<p class="u-vacio">La empresa no tiene dinero en ninguna cuenta.</p>');
          if (pers.length) {
            h += '<h2 class="n-grupo">Lo que te debe la empresa</h2><p class="u-nota">Lo que has pagado tú por la empresa (o le has prestado) y todavía no te ha devuelto. Lo que pagaste por ella ya cuenta como gasto de la empresa en el Resumen.</p>' +
              '<table class="u-tabla eco-tabla"><tbody>' + pers.map(function (y) {
                return fila(y.c, y.v, y.v < 0 ? 'Te ha devuelto más de lo que pusiste' : '');
              }).join('') + (pers.length > 1 ? '<tr class="eco-total"><td class="u-tabla-t">Total</td><td class="num">' + cifra(debe, true) + '</td></tr>' : '') + '</tbody></table>';
          }
        } else {
          tipos.forEach(function (t) {
            var st = 0;
            h += '<h2 class="n-grupo">' + texto(t) + '</h2><table class="u-tabla eco-tabla"><tbody>' + por[t].map(function (c) { st += sal[c.ID] || 0; return fila(c, sal[c.ID] || 0); }).join('') +
              (por[t].length > 1 ? '<tr class="eco-total"><td class="u-tabla-t">Total ' + texto(t.toLowerCase()) + '</td><td class="num">' + cifra(st, true) + '</td></tr>' : '') + '</tbody></table>';
          });
          h += '<table class="u-tabla eco-tabla"><tbody><tr class="eco-total"><td class="u-tabla-t">Total de todas las cuentas</td><td class="num">' + cifra(tot, true) + '</td></tr></tbody></table>';
        }
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
        if (!hay) h += '<h2 class="n-grupo">Facturas por cobrar y por pagar</h2><p class="u-vacio">No hay ninguna factura pendiente. Una factura emitida o recibida que marques como pendiente sale aquí hasta que se cobre o se pague.</p>';
        var tsf = 0; sf.forEach(function (m) { tsf += importe(m).total; });
        h += '<h2 class="n-grupo">Gastos sin factura · ' + texto(nomPeriodo()) + (sf.length ? ' <span class="u-cifra">' + eur(tsf) + '</span>' : '') + '</h2>';
        if (!sf.length) return h + '<p class="u-vacio">Todos los gastos ' + texto(enPeriodo(nomPeriodo(), 'de')) + ' tienen su factura o ticket.</p>';
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
        // T0726 (R59): lo que suman, por tipo: lo que facturas tú y lo que te facturan no se suma en una sola cifra.
        var totE = 0, totR = 0, hayE = false, hayR = false;
        fs.forEach(function (x) { if (x.TIPO === 'Emitida') hayE = true; else hayR = true; if (x.ESTADO === 'Anulada') return; if (x.TIPO === 'Emitida') totE += importe(x).total; else totR += importe(x).total; });
        // T0646 · Como las demás secciones: «Filtrar» (abre sus filtros, con cuántos hay puestos) y «Añadir».
        var nf = (f.tipo ? 1 : 0) + (f.estado ? 1 : 0);
        // T0673 · En el móvil, Filtrar y Añadir en una línea (como Movimientos); lo que suman, debajo, y «Datos de tu empresa», al final.
        var h = '<div class="li-barra eco-fbarra eco-fmov"><button type="button" class="u-btn li-filtrar" data-accion="filtrarfac" aria-haspopup="dialog"' + (nf ? ' aria-pressed="true"' : '') + '>' + ICONO_FILTRO + 'Filtrar' +
          (nf ? ' <span class="li-nf" aria-label="' + nf + (nf === 1 ? ' puesto' : ' puestos') + '">' + nf + '</span>' : '') + '</button>' +
          '<button type="button" class="u-btn u-btn-accion li-nueva" data-accion="factura">Añadir</button></div>' +
          (fs.length ? '<p class="eco-fac-tot">' + (hayE ? '<span>Emitidas: <b class="u-cifra">' + eur(totE) + '</b></span>' : '') + (hayR ? '<span>Recibidas y tickets: <b class="u-cifra">' + eur(totR) + '</b></span>' : '') +
            '<span class="u-nota">' + fs.length + (fs.length === 1 ? ' factura' : ' facturas') + ', con IVA y sin las anuladas</span></p>' : '') +
          (nf ? '<p class="u-nota">Solo ' + [f.tipo ? { Emitida: 'emitidas', Recibida: 'recibidas', Ticket: 'tickets' }[f.tipo] : '', f.estado ? (f.estado === '-' ? 'sin estado' : f.estado.toLowerCase()) : ''].filter(Boolean).join(', ') +
            ' · <button type="button" class="u-btn u-btn-texto" data-accion="quitarffac">Quitar filtros</button></p>' : '') +
          (LINEAS && empresaFaltan().length ? '<p class="u-nota eco-falta">' + avisoEmpresa('Para que tus facturas estén completas') + '</p>' : '');
        var emp = LINEAS ? '<p><button type="button" class="u-btn u-btn-texto" data-accion="empresa">Datos de tu empresa</button> <span class="u-nota">(lo que sale en cada factura: nombre, CIF, dirección y forma de pago)</span></p>' : '';
        if (!fs.length) return h + '<p class="u-vacio">No hay facturas ' + (f.tipo || f.estado ? 'con este filtro' : texto(enPeriodo(nomPeriodo()))) + '. Las que añadas salen aquí al momento.</p>' + emp;
        var sinPdf = fs.filter(function (x) { return !x.ARCHIVO_URL; }).length;
        // T0673 · En el móvil, una tarjeta como Movimientos: sin la columna del PDF (el enlace, si lo hay, va debajo; los que no tienen, los cuenta la nota del final).
        // T0726 (R56): el estado, en su píldora, y el PDF, como un enlace del Listado («Ver el PDF»); sin archivo, la celda vacía.
        // T0733 (R58): en el ordenador, también la base y el IVA de cada una (lo que mira la gestoría).
        return h + '<table class="u-tabla eco-tabla"><thead><tr><th>Factura</th><th class="u-solo-ancho">PDF</th><th class="num u-solo-ancho">Base</th><th class="num u-solo-ancho">IVA</th><th class="num">Total</th></tr></thead><tbody>' + fs.map(function (x) {
          var im = importe(x), an = x.ESTADO === 'Anulada' ? ' eco-anulada' : '';
          return '<tr tabindex="0" data-fac="' + texto(x.ID) + '"><td class="u-tabla-t">' + texto(numFac(x)) + (x.ID_CONTRAPARTE ? ' · ' + texto(nombre('ctr', x.ID_CONTRAPARTE)) : '') + chip(x) + // T0689: un ticket sin a quién, sin «·» de más
            '<div class="u-nota eco-fac-l">' + [texto(fecha(x.FECHA)), x.TIPO === 'Emitida' ? 'Emitida<span class="u-solo-ancho"> (a un cliente)</span>' : x.TIPO === 'Ticket' ? 'Ticket' : 'Recibida<span class="u-solo-ancho"> (de un proveedor)</span>'].join(' · ') + pildoraFac(x) + '</div>' +
            (x.ARCHIVO_URL ? '<div class="u-nota u-solo-movil">' + enlaceDrive(x) + '</div>' : '') + '</td>' +
            '<td class="u-solo-ancho">' + enlaceDrive(x) + '</td>' +
            '<td class="num u-solo-ancho"><span class="u-cifra' + an + '">' + eur(im.base) + '</span></td>' +
            '<td class="num u-solo-ancho"><span class="u-cifra' + an + '">' + eur(im.iva) + '</span></td>' +
            '<td class="num"><span class="u-cifra' + an + '">' + eur(im.total) + '</span></td></tr>';
        }).join('') + '</tbody></table>' +
          (sinPdf ? '<p class="u-nota">' + sinPdf + (sinPdf === 1 ? ' factura no tiene' : ' facturas no tienen') + ' su archivo enlazado: ábrela y pega en «Enlace en Drive» el enlace del PDF (en Drive, Compartir › Copiar enlace).</p>' : '') + emp;
      }

      /* ----- T0733 · Para tu gestoría: el IVA del trimestre de las facturas (modelo 303), las retenciones (111) y la descarga ----- */

      function trimestreVisto() { return S.gest.q || trimestrePorDefecto(hoy()); }
      /** El trimestre del Resumen: el de entrada si el año mirado es el de hoy (o no es un año); si es otro año, su 4T. */
      function trimestreResumen() {
        var q = trimestrePorDefecto(hoy()), y = per && /^\d{4}$/.test(per.id) ? per.id : '';
        return y && y !== q.ano ? { ano: y, t: 4 } : q;
      }
      function libroAhora() { return libroTrimestre(d, trimestreVisto()); }
      /** Los años que se pueden mirar: el de hoy y los que tienen facturas, el más reciente primero. */
      function anosGestoria() {
        var o = {}; o[hoy().slice(0, 4)] = 1; o[trimestreVisto().ano] = 1;
        d.fac.forEach(function (f) { var y = String(f.FECHA || '').slice(0, 4); if (/^\d{4}$/.test(y)) o[y] = 1; });
        return Object.keys(o).sort().reverse();
      }
      function htmlGestoria() {
        var q = trimestreVisto(), L = libroAhora(), nq = trimestreNombre(q), aPagar = L.resultado >= 0;
        var h = '<div class="eco-trim-barra"><div class="eco-sw eco-trim" role="group" aria-label="Trimestre">' + trimestresDe(q.ano).map(function (x) {
          return '<button type="button" data-trim="' + x.t + '" aria-pressed="' + (x.t === q.t ? 'true' : 'false') + '">' + x.t + 'T</button>';
        }).join('') + '</div><label class="u-campo eco-trim-ano"><span class="u-etiqueta">Año</span><select id="eco-gano">' +
          opciones(anosGestoria().map(function (y) { return [y, y]; }), q.ano) + '</select></label></div>';
        h += '<div class="eco-kpis eco-gest-kpis"><div class="eco-kpi eco-grande"><b>IVA del ' + texto(nq) + '</b><span class="eco-val">' + eur(Math.abs(L.resultado)) + '</span>' +
          '<span class="eco-sub">' + (L.resultado === 0 ? 'Ni a pagar ni a devolver' : aPagar ? 'A pagar' : 'A tu favor: se compensa o se devuelve') + '. Sale de las facturas, no de los cobros.</span></div>' +
          '<div class="eco-kpi"><b>De tus facturas</b><span class="eco-val">' + eur(L.repercutido) + '</span><span class="eco-sub">IVA de ' + eur(L.baseE) + ' facturados</span></div>' +
          '<div class="eco-kpi"><b>De lo que te facturan</b><span class="eco-val">' + eur(L.soportado + L.dua) + '</span><span class="eco-sub">' +
          (L.dua ? 'Con ' + eur(L.dua) + ' de IVA de aduana (DUA)' : 'Recibidas y tickets') + '</span></div></div>';
        if (L.ret) h += '<p class="eco-gest-ret">Retenciones de IRPF que pagas tú a Hacienda (modelo 111): <b class="u-cifra">' + eur(L.ret) + '</b></p>';
        h += '<div class="n-botones eco-gest-bot"><button type="button" class="u-btn u-btn-accion" data-accion="gestcsv"' + (L.filas.length ? '' : ' disabled') + '>Descargar (CSV)</button>' +
          '<button type="button" class="u-btn" data-accion="gestcopiar"' + (L.filas.length ? '' : ' disabled') + '>Copiar</button></div>' +
          '<p class="u-nota">Para mandárselo a tu gestoría: fecha, número, NIF, nombre, base, % de IVA, cuota, retención, total, estado y PDF de cada factura del ' + texto(nq) + '. «Copiar» es para pegarlo en una hoja de cálculo.</p>';
        // Lo que hay que arreglar antes de mandarlo, en palabras.
        var av = [];
        if (L.sinNif.length) av.push(L.sinNif.length === 1 ? 'La ' + texto(numFac(L.sinNif[0])) + ' no tiene el CIF o NIF del cliente: ábrela y ponlo.' :
          L.sinNif.length + ' facturas tuyas no tienen el CIF o NIF del cliente (' + texto(listaY(L.sinNif.map(numFac))) + '): ábrelas y ponlo.');
        if (L.sinFacGasto.length) {
          var ig = 0; L.sinFacGasto.forEach(function (m) { ig += importe(m).iva; });
          av.push(deMas(L.sinFacGasto.length, 'gasto', 'gastos') + ' del trimestre sin factura' + (ig ? ': su IVA (' + eur(ig) + ') no se puede descontar hasta que la tengas.' : '.') +
            (pest.indexOf('PENDIENTE') >= 0 ? ' <button type="button" class="u-btn u-btn-texto" data-ir="PENDIENTE">Verlos en Pendiente</button>' : ''));
        }
        if (L.sinFacCobro.length) {
          var ic = 0; L.sinFacCobro.forEach(function (m) { ic += importe(m).iva; });
          av.push(deMas(L.sinFacCobro.length, 'cobro', 'cobros') + ' del trimestre sin factura, con ' + eur(ic) + ' de IVA: lo cobrado también se declara aunque aún no hayas hecho la factura.');
        }
        if (av.length) h += '<div class="eco-aviso eco-amb"><b>Antes de mandarlo</b>' + av.map(function (x) { return '<p>' + x + '</p>'; }).join('') + '</div>';
        if (!L.filas.length) return h + '<p class="u-vacio">No hay facturas del ' + texto(nq) + '. Las que hagas o apuntes con fecha de este trimestre salen aquí.</p>';
        h += '<h2 class="n-grupo">Las facturas del ' + texto(nq) + ' <span class="u-nota">' + deMas(L.filas.length, 'factura', 'facturas') + '</span></h2>' +
          '<table class="u-tabla eco-tabla"><thead><tr><th>Factura</th><th class="u-solo-ancho">CIF o NIF</th><th class="num u-solo-ancho">Base</th><th class="num">IVA</th><th class="num u-solo-ancho">Total</th></tr></thead><tbody>' +
          L.filas.map(function (x) {
            var f = x.f, i = x.imp, an = x.anulada ? ' eco-anulada' : '', extra = [];
            if (i.dua) extra.push('IVA de aduana ' + eur(i.dua));
            if (i.ret) extra.push('retención ' + tipoIva(f.RETENCION) + ' ' + eur(i.ret));
            return '<tr tabindex="0" data-fac="' + texto(f.ID) + '"><td class="u-tabla-t">' + texto(numFac(f)) + (x.nombre ? ' · ' + texto(x.nombre) : '') +
              '<div class="u-nota">' + [texto(fecha(f.FECHA)), f.TIPO === 'Emitida' ? 'Emitida' : f.TIPO === 'Ticket' ? 'Ticket' : 'Recibida'].concat(extra.map(texto)).join(' · ') + pildoraFac(f) + '</div>' +
              '<div class="u-nota u-solo-movil">' + (x.nif ? 'CIF/NIF ' + texto(x.nif) + ' · ' : '') + 'base ' + eur(i.base) + ' · total ' + eur(i.total) + '</div></td>' +
              '<td class="u-solo-ancho">' + (x.nif ? texto(x.nif) : f.TIPO === 'Emitida' && !x.anulada ? '<span class="u-mal">Falta</span>' : '') + '</td>' +
              '<td class="num u-solo-ancho"><span class="u-cifra' + an + '">' + eur(i.base) + '</span></td>' +
              '<td class="num"><span class="u-cifra' + an + '">' + eur(i.iva) + '</span><div class="u-nota">' + texto(tipoIva(f.TIPO_IVA) || '0%') + '</div></td>' +
              '<td class="num u-solo-ancho"><span class="u-cifra' + an + '">' + eur(i.total) + '</span></td></tr>';
          }).join('') + '</tbody></table><p class="u-nota">Por la fecha de cada factura. Las anuladas salen tachadas y no suman.</p>';
        return h;
      }
      /** El nombre del archivo: «Facturas 4T 2026 · Telas Ejemplo S.L.csv». */
      function archivoGestoria() {
        var e = LINEAS ? empresaAhora() : null, n = String((e && e.NOMBRE) || '').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim();
        return 'Facturas ' + trimestreNombre(trimestreVisto()) + (n ? ' · ' + n : '') + '.csv';
      }
      function descargarGestoria() {
        var csv = '﻿' + csvLibro(libroAhora(), ';'); // con BOM: Excel lo abre con sus tildes
        try {
          var a = document.createElement('a'), url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
          a.href = url; a.download = archivoGestoria(); document.body.appendChild(a); a.click();
          setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 1000);
        } catch (e) { ctx.aviso('No se ha podido descargar: prueba con «Copiar».'); }
      }
      function copiarGestoria() {
        var tsv = csvLibro(libroAhora(), '\t'), n = libroAhora().filas.length;
        var ok = function () { if (ctx.abierta()) ctx.aviso('Copiadas las ' + n + ' facturas del ' + trimestreNombre(trimestreVisto()) + ': pégalas en una hoja de cálculo.'); };
        try { navigator.clipboard.writeText(tsv).then(ok, function () { ctx.aviso('No se ha podido copiar: usa «Descargar (CSV)».'); }); }
        catch (e) { ctx.aviso('No se ha podido copiar: usa «Descargar (CSV)».'); }
      }
      /** T0646 · Los filtros de Facturas, en su ventana (como «Filtrar» del Listado): nada cambia hasta «Ver». */
      /** T0644 · Filtrar · Movimientos: tipo, categoría (las de ese tipo), cuenta y gastos sin factura, con cuántos se verían. */
      function filtrosMov() {
        var f = S.mov;
        function cats(t) { return d.cat.filter(function (c) { return !t || c.TIPO === t; }).map(function (c) { return [c.ID, c.NOMBRE]; }); }
        ventana('<h2 id="eco-vt">Filtrar · Movimientos</h2><div class="u-campos">' +
          campo('Tipo', '<select id="fm-tipo">' + opciones([['Ingreso', 'Entra dinero'], ['Gasto', 'Sale dinero'], ['Interno', 'Entre cuentas']], f.tipo, 'Todos') + '</select>') +
          campo('Categoría', '<select id="fm-cat">' + opciones(cats(f.tipo), f.cat, 'Todas') + '</select>') +
          campo('Cuenta', '<select id="fm-cue">' + opciones(d.cue.map(function (c) { return [c.ID, c.NOMBRE]; }), f.cue, 'Todas') + '</select>') +
          '<label class="u-check"><input type="checkbox" id="fm-sinfac"' + (f.sinFac ? ' checked' : '') + '> Gastos sin factura</label>' +
          (f.cruz ? '<label class="u-check"><input type="checkbox" id="fm-cruz" checked> Con categoría del otro tipo</label>' : '') + '</div>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="fm-ver"></button><button type="button" class="u-btn u-btn-texto" id="fm-quitar">Quitar filtros</button></div>', function () {
          function leer() {
            var c = vent.querySelector('#fm-cruz');
            return Object.assign({}, S.mov, { tipo: val('fm-tipo'), cat: val('fm-cat'), cue: val('fm-cue'), sinFac: vent.querySelector('#fm-sinfac').checked, cruz: !!(c && c.checked), ver: VER });
          }
          function cuenta() { var k = movFiltrados(leer()).length; vent.querySelector('#fm-ver').textContent = 'Ver ' + k + (k === 1 ? ' movimiento' : ' movimientos'); }
          vent.querySelector('#fm-tipo').addEventListener('change', function () { vent.querySelector('#fm-cat').innerHTML = opciones(cats(val('fm-tipo')), '', 'Todas'); cuenta(); });
          ['fm-cat', 'fm-cue', 'fm-sinfac', 'fm-cruz'].forEach(function (id) { var e = vent.querySelector('#' + id); if (e) e.addEventListener('change', cuenta); });
          cuenta();
          vent.querySelector('#fm-ver').onclick = function () { S.mov = leer(); cerrar(); pintar(); };
          vent.querySelector('#fm-quitar').onclick = function () { S.mov = Object.assign(movVacio(), { q: S.mov.q, desde: S.mov.desde }); cerrar(); pintar(); };
        });
      }
      function filtrosFac() {
        var f = S.fac;
        ventana('<h2 id="eco-vt">Filtrar · Facturas</h2><div class="u-campos">' +
          campo('Tipo', '<select id="ff-tipo">' + opciones([['Emitida', 'Emitidas'], ['Recibida', 'Recibidas'], ['Ticket', 'Tickets']], f.tipo, 'Cualquiera') + '</select>') +
          campo('Estado', '<select id="ff-estado">' + opciones([['Pendiente', 'Pendiente'], ['Pagada', 'Pagada'], ['Anulada', 'Anulada'], ['-', 'Sin estado']], f.estado, 'Cualquiera') + '</select>') + '</div>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="ff-ver"></button><button type="button" class="u-btn u-btn-texto" id="ff-quitar">Quitar filtros</button></div>', function () {
          function n() {
            var t = val('ff-tipo'), e = val('ff-estado');
            return facDe(d, per).filter(function (x) { return (!t || x.TIPO === t) && (!e || (e === '-' ? !x.ESTADO : x.ESTADO === e)); }).length;
          }
          function cuenta() { var k = n(); vent.querySelector('#ff-ver').textContent = 'Ver ' + k + (k === 1 ? ' factura' : ' facturas'); }
          ['ff-tipo', 'ff-estado'].forEach(function (id) { vent.querySelector('#' + id).addEventListener('change', cuenta); });
          cuenta();
          vent.querySelector('#ff-ver').onclick = function () { S.fac = { tipo: val('ff-tipo'), estado: val('ff-estado') }; cerrar(); pintar(); };
          vent.querySelector('#ff-quitar').onclick = function () { S.fac = { tipo: '', estado: '' }; cerrar(); pintar(); };
        });
      }
      /**
       * El enlace al archivo de una factura en Drive, para abrirlo en otra pestaña (sin abrir la ficha). T0726 (R56): como un
       * enlace del Listado (li-enl, con su icono): «Ver el PDF» (la emitida), «Ver la factura» (la recibida) o «Ver el ticket».
       * Sin archivo, nada (la nota de debajo de la lista cuenta las que no tienen).
       */
      function enlaceDrive(f) {
        if (!f || !f.ARCHIVO_URL) return '';
        var q = f.TIPO === 'Ticket' ? 'Ver el ticket' : f.TIPO === 'Recibida' ? 'Ver la factura' : 'Ver el PDF';
        return '<a class="li-enl eco-drive" href="' + texto(f.ARCHIVO_URL) + '" target="_blank" rel="noopener" data-fuera>' + ICONO_PDF + '<span>' + q + '</span></a>';
      }
      /**
       * T0726 (R56) · El estado de una factura en la píldora común: pendiente en ocre, cobrada (una emitida pagada: se guarda
       * Pagada, T0679) en verde, y pagada y anulada (tachada) en gris. Sin estado, nada.
       */
      function pildoraFac(x) {
        var e = String(x.ESTADO || ''); if (!e) return '';
        var t = x.TIPO === 'Emitida' && e === 'Pagada' ? 'Cobrada' : e;
        var c = e === 'Pendiente' ? 'li-medio' : t === 'Cobrada' ? 'li-bien' : 'li-apagado';
        return ' <span class="u-chip li-estado ' + c + (e === 'Anulada' ? ' eco-anulada' : '') + '">' + texto(t) + '</span>';
      }

      /* ----- Presupuesto (se mira; se prepara aparte) ----- */

      function htmlPresupuesto() {
        var ps = presupuesto(d, per, S.des), av = avisos(d, ps);
        var h = '<p class="u-nota">Lo previsto' + (presPorPeriodo(d) ? ' ' + texto(enPeriodo(nomPeriodo(), 'para')) : '') + ' frente a lo real, sin IVA. ' +
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
      function cerrar() {
        if (debajo) { volverDebajo(); return; } // T0726 (R64): cerrar la de encima vuelve a la de debajo
        velo.classList.remove('abierto'); vent.innerHTML = ''; if (alCerrar) { var f = alCerrar; alCerrar = null; f(); }
      }
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
      // T0689: de entrada, con el IVA incluido (como viene en el ticket); «Lo tengo sin IVA» lo cambia y se recuerda ('0').
      function conIva() { return guardado(CLAVE + 'coniva') !== '0'; }
      function verImporte(v) {
        if (v.BASE === '' || v.BASE == null) return '';
        var x = conIva() ? importe(v).total : cts(v.BASE);
        return (x / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');
      }
      /** T0689 · Cómo se lee el importe: con el IVA incluido (de entrada) o sin él, con un botón de texto que lo cambia. La casilla
       *  sigue (escondida): es lo que leen baseEn y pintaImporte. */
      function casillaIva(pre) {
        return '<div class="u-ancho eco-iva-sw" id="' + pre + '-iva-sw"><input type="checkbox" id="' + pre + '-coniva" hidden' + (conIva() ? ' checked' : '') + '>' +
          '<button type="button" class="u-btn u-btn-texto" id="' + pre + '-iva-cambio"></button></div>';
      }
      /** La base escrita (en céntimos), o la que sale del total si la casilla del IVA incluido está marcada. */
      function baseEn(pre) {
        var mx = enOtraMoneda(pre), x = mx ? (mx.euros ? mx.euros.cts : 0) : cts(val(pre + '-BASE')), c = vent.querySelector('#' + pre + '-coniva');
        // T0733: con el IVA incluido, lo escrito es lo que se paga: sin el IVA de aduana y con la retención ya descontada.
        return c && c.checked ? baseDeTotal(x - duaEn(pre), val(pre + '-TIPO_IVA'), retEn(pre)) : x;
      }
      /* ----- T0733 (R101) · la retención de IRPF y el IVA de aduana (DUA) de una factura recibida o un gasto ----- */

      /** ¿Tiene la tabla las columnas? (Konamigas no: no se enseñan.) */
      function conRetDua(cols) { return { ret: cols.indexOf('RETENCION') >= 0, dua: cols.indexOf('IVA_IMPORTACION') >= 0 }; }
      /** La caja plegada «+ Retención de IRPF o IVA de aduana (DUA)», abierta si ya lleva alguno. */
      function cajaRetDua(pre, v, cols) {
        var c = conRetDua(cols); if (!c.ret && !c.dua) return '';
        var abierta = pct(v.RETENCION) > 0 || cts(v.IVA_IMPORTACION) > 0;
        var que = c.ret && c.dua ? 'Retención de IRPF o IVA de aduana (DUA)' : c.ret ? 'Retención de IRPF' : 'IVA de aduana (DUA)';
        return '<div class="u-ancho eco-retdua" id="' + pre + '-retdua"><button type="button" class="u-btn u-btn-texto" id="' + pre + '-retdua-b"' + (abierta ? ' hidden' : '') + '>+ ' + que + '</button>' +
          '<div class="u-campos" id="' + pre + '-retdua-c"' + (abierta ? '' : ' hidden') + '>' +
          (c.ret ? campo('Retención de IRPF', '<select id="' + pre + '-RETENCION">' + opcionesConValor([['0%', 'Sin retención'], ['7%', '7 %'], ['15%', '15 %']], tipoIva(v.RETENCION) || '0%') + '</select>') : '') +
          (c.dua ? campo('IVA de aduana (DUA)', '<input type="text" inputmode="decimal" id="' + pre + '-IVA_IMPORTACION" value="' + texto(cts(v.IVA_IMPORTACION) ? (cts(v.IVA_IMPORTACION) / 100).toFixed(2).replace('.', ',') : '') + '" placeholder="0,00">') : '') +
          '<p class="u-nota u-ancho">' + [c.ret ? 'Retención: la de las facturas de profesionales (gestoría, abogados). Pagas menos a quien te factura y ese dinero lo ingresas tú a Hacienda cada trimestre.' : '',
            c.dua ? 'IVA de aduana: el que pagas al traer las telas, que viene en el DUA. Se recupera: no es un gasto del pedido.' : ''].filter(Boolean).join(' ') + '</p></div></div>';
      }
      function retDuaVisible(pre) { var x = vent.querySelector('#' + pre + '-retdua'); return !!x && !x.hidden; }
      function retEn(pre) { var e = vent.querySelector('#' + pre + '-RETENCION'); return e && retDuaVisible(pre) ? e.value : ''; }
      function duaEn(pre) { var e = vent.querySelector('#' + pre + '-IVA_IMPORTACION'); return e && retDuaVisible(pre) ? Math.max(0, cts(e.value)) : 0; }
      /** Lo que se guarda de las dos (solo las columnas que hay): { RETENCION, IVA_IMPORTACION }; sin enseñar, vacías. */
      function valoresRetDua(pre, cols) {
        var c = conRetDua(cols), o = {};
        if (c.ret) o.RETENCION = retEn(pre) && retEn(pre) !== '0%' ? retEn(pre) : '';
        if (c.dua) o.IVA_IMPORTACION = duaEn(pre) ? duaEn(pre) / 100 : '';
        return o;
      }
      function oirRetDua(pre, refrescar) {
        var b = vent.querySelector('#' + pre + '-retdua-b'); if (!b) return;
        b.onclick = function () { b.hidden = true; vent.querySelector('#' + pre + '-retdua-c').hidden = false; var s = vent.querySelector('#' + pre + '-RETENCION, #' + pre + '-IVA_IMPORTACION'); if (s) s.focus(); };
        var r = vent.querySelector('#' + pre + '-RETENCION'); if (r) r.addEventListener('change', refrescar);
        var dd = vent.querySelector('#' + pre + '-IVA_IMPORTACION'); if (dd) dd.addEventListener('input', refrescar);
      }
      /* ----- T0726 (R61) · un gasto en rupias o dólares, pasado a euros con su cambio ----- */

      /** Las monedas de este negocio (MONEDAS, con el cambio de AJUSTES), o solo el euro. */
      function monedasAhora() { return monedas(cfg.MONEDAS, function (t) { return T.filas(t) || []; }); }
      /** El desplegable de la moneda junto al importe (solo si hay más que el euro) y, para una sin cambio guardado, «1 € = … $». */
      function cajaMoneda(pre) {
        var ms = monedasAhora(); if (ms.length < 2) return '';
        return '<select id="' + pre + '-moneda" class="eco-moneda" aria-label="Moneda">' + ms.map(function (m) { return '<option value="' + texto(m.sim) + '">' + texto(m.sim) + '</option>'; }).join('') + '</select>';
      }
      function cajaCambio(pre) {
        return monedasAhora().length < 2 ? '' : '<label class="u-campo eco-cambio" id="' + pre + '-cambio-c" hidden><span class="u-etiqueta">Cambio</span><span class="eco-cambio-f">1 € = ' +
          '<input type="text" inputmode="decimal" id="' + pre + '-cambio" placeholder="0"> <span id="' + pre + '-cambio-s"></span></span></label>';
      }
      /** La moneda elegida si no es el euro: { m, n (lo escrito), euros: aEuros(…) o null }; en euros, null. */
      function enOtraMoneda(pre) {
        var sel = vent.querySelector('#' + pre + '-moneda'); if (!sel || sel.value === '€') return null;
        var m = monedasAhora().filter(function (x) { return x.sim === sel.value; })[0]; if (!m) return null;
        if (!m.cambio) { var c = numeroEscrito(val(pre + '-cambio')); m = Object.assign({}, m, { cambio: c > 0 ? c : null }); }
        return { m: m, n: numeroEscrito(val(pre + '-BASE')), euros: aEuros(val(pre + '-BASE'), m) };
      }
      /** Al cambiar de moneda: el cambio, a la vista si no se sabe (con el último que se puso en este navegador). */
      function oirMoneda(pre, refrescar) {
        var sel = vent.querySelector('#' + pre + '-moneda'); if (!sel) return;
        var ci = vent.querySelector('#' + pre + '-cambio');
        sel.addEventListener('change', function () {
          var m = monedasAhora().filter(function (x) { return x.sim === sel.value; })[0], pide = !!m && m.sim !== '€' && !m.cambio;
          vent.querySelector('#' + pre + '-cambio-c').hidden = !pide;
          vent.querySelector('#' + pre + '-cambio-s').textContent = m ? m.sim : '';
          if (pide && !ci.value) ci.value = guardado(CLAVE + 'cambio' + m.sim);
          refrescar();
        });
        ci.addEventListener('input', function () { var m = enOtraMoneda(pre); if (m) guardado(CLAVE + 'cambio' + m.m.sim, ci.value); refrescar(); });
      }
      /** Etiqueta del importe y la línea de debajo con lo que se va a guardar. */
      /* ----- T0689 · la foto del ticket (o de una factura recibida) ----- */

      /** La caja de la foto (pre: m o f): un botón grande que en el móvil abre la cámara o la galería; elegida, su miniatura, «Cambiar» y «Quitar». */
      function cajaFoto(pre, titulo) {
        return '<div class="u-ancho eco-foto" id="' + pre + '-foto-caja"><input type="file" id="' + pre + '-foto" accept="image/*,application/pdf" hidden>' +
          '<button type="button" class="eco-foto-b" id="' + pre + '-foto-b">' + ICONO_FOTO + '<b>' + texto(titulo) + '</b><span class="u-nota">Hazle una foto o elige una que ya tengas</span></button>' +
          '<div class="eco-foto-ok" id="' + pre + '-foto-ok" hidden><img alt="" id="' + pre + '-foto-img"><span class="eco-foto-n"><b id="' + pre + '-foto-n"></b>' +
          '<span class="u-nota">Se guarda en Drive al guardar.</span></span><button type="button" class="u-btn u-btn-texto" id="' + pre + '-foto-cambiar">Cambiar</button>' +
          '<button type="button" class="u-btn u-btn-texto" id="' + pre + '-foto-quitar">Quitar</button></div></div>';
      }
      function fotoDe(pre) { var i = vent.querySelector('#' + pre + '-foto'); return (i && i.files && i.files[0]) || null; }
      function quitarFoto(pre) {
        var i = vent.querySelector('#' + pre + '-foto'); if (!i) return;
        i.value = ''; vent.querySelector('#' + pre + '-foto-b').hidden = false; vent.querySelector('#' + pre + '-foto-ok').hidden = true;
      }
      function oirFoto(pre) {
        var inp = vent.querySelector('#' + pre + '-foto'); if (!inp) return;
        var abrir = function () { inp.click(); };
        vent.querySelector('#' + pre + '-foto-b').onclick = abrir;
        vent.querySelector('#' + pre + '-foto-cambiar').onclick = abrir;
        vent.querySelector('#' + pre + '-foto-quitar').onclick = function () { quitarFoto(pre); };
        inp.onchange = function () {
          var fl = fotoDe(pre); if (!fl) return;
          if (!/^image\//.test(fl.type || '') && fl.type !== 'application/pdf') { verError(['Elige una foto o un PDF.']); quitarFoto(pre); return; }
          if (fl.size > MAX_FOTO) { verError(['Es muy grande (más de 20 MB): elige otra o hazle una foto.']); quitarFoto(pre); return; }
          verError([]);
          var img = vent.querySelector('#' + pre + '-foto-img');
          img.hidden = !/^image\//.test(fl.type || '');
          if (!img.hidden) { try { img.src = URL.createObjectURL(fl); } catch (e) { img.hidden = true; } }
          vent.querySelector('#' + pre + '-foto-n').textContent = fl.type === 'application/pdf' ? fl.name || 'El PDF' : 'La foto del ticket';
          vent.querySelector('#' + pre + '-foto-b').hidden = true; vent.querySelector('#' + pre + '-foto-ok').hidden = false;
        };
      }
      /** Sube un archivo (la foto, ya reducida, o el PDF) a la carpeta de los tickets → promesa con su enlace. */
      function subirArchivo(fl, nombreA, fechaIso) {
        if (!fl) return Promise.reject(new Error('No hay ninguna foto.'));
        return prepararArchivo(fl).then(function (a) { return ctx.llamar('economiaTicket', [{ nombre: nombreA, fecha: fechaIso, tipo: a.tipo, datos: a.datos }]); })
          .then(function (r) { return r.url; });
      }
      function subirFoto(pre, nombreA, fechaIso) { return subirArchivo(fotoDe(pre), nombreA, fechaIso); }

      /** Etiqueta del importe y, debajo, la cuenta: «82,64 € + IVA 17,36 € = 100,00 €». etCon: cómo se llama con IVA. */
      function pintaImporte(pre, etBase, etCon) {
        var ci = vent.querySelector('#' + pre + '-coniva').checked, b = baseEn(pre), t = importe({ BASE: b / 100, TIPO_IVA: val(pre + '-TIPO_IVA'), RETENCION: retEn(pre), IVA_IMPORTACION: duaEn(pre) / 100 });
        // T0733: con retención, lo escrito con el IVA incluido es lo que se paga (base + IVA − retención).
        vent.querySelector('#' + pre + '-imp-et').textContent = ci ? (t.ret ? 'Lo que pagas' : etCon || 'Importe con IVA') : etBase;
        var bc = vent.querySelector('#' + pre + '-iva-cambio'); if (bc) bc.textContent = ci ? 'Lo tengo sin IVA' : 'Lo tengo con el IVA incluido';
        var mx = enOtraMoneda(pre), cambio = !mx ? '' : mx.euros ? mx.euros.cuenta + ' · ' : isNaN(mx.n) ? '' : 'Falta el cambio: cuántos ' + mx.m.sim + ' hay en un euro. ';
        // T0733: «100,00 € + IVA 21,00 € − retención 15,00 € = 106,00 €» (y el IVA de aduana, aparte).
        vent.querySelector('#' + pre + '-total').textContent = cambio + eur(t.base) + ' + IVA ' + eur(t.cuota) + (t.dua ? ' + IVA de aduana ' + eur(t.dua) : '') +
          (t.ret ? ' − retención ' + eur(t.ret) : '') + ' = ' + eur(t.total) + (ci ? '' : t.ret ? ' a pagar' : ' con IVA');
      }
      function oirImporte(pre, refrescar) {
        var ci = vent.querySelector('#' + pre + '-coniva');
        ci.addEventListener('change', function (e) { guardado(CLAVE + 'coniva', e.target.checked ? '1' : '0'); refrescar(); });
        // Cambiar cómo se lee no cambia el número escrito: lo que se guarda es su base, con o sin IVA.
        vent.querySelector('#' + pre + '-iva-cambio').addEventListener('click', function () { ci.checked = !ci.checked; ci.dispatchEvent(new Event('change')); });
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
          dato('Sin IVA', eur(x.base)) + dato('IVA', texto(m.TIPO_IVA || '0%') + ' · ' + eur(x.cuota)) +
          (x.dua ? dato('IVA de aduana (DUA)', eur(x.dua)) : '') + (x.ret ? dato('Retención de IRPF', texto(tipoIva(m.RETENCION)) + ' · −' + eur(x.ret)) : '') + // T0733
          dato('Total', eur(x.total)) +
          (interno ? '' : dato('Factura o ticket', f ? '<button type="button" class="u-btn u-btn-texto" data-verfac="' + texto(f.ID) + '">' + texto(numFac(f)) + ' ›</button>' + (f.ARCHIVO_URL ? ' · ' + enlaceDrive(f) : '') : sinFac(m) ? '<span class="u-mal">Falta</span>' : 'No lleva')) +
          dato('Notas', texto(m.NOTAS)) + '</div>' +
          (m.LOG ? '<details class="eco-hist"><summary>Historial de cambios</summary><pre>' + texto(m.LOG) + '</pre></details>' : '') +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="d-editar" data-foco>Editar movimiento</button>' +
          // T0689: donde la factura se hace desde su pedido (FACTURAS con ID_VENTA), un cobro no la hace: la lleva al unirse.
          (!interno && !m.ID_FACTURA && !(c && esReparto(d, c)) && !(m.TIPO === 'Ingreso' && facPorVenta()) ? '<button type="button" class="u-btn" id="d-factura">' + (m.TIPO === 'Ingreso' ? 'Hacer la factura' : 'Añadir su factura') + '</button>' : '') +
          '<button type="button" class="u-btn" data-cerrar>Cerrar</button>' +
          '<button type="button" class="u-btn u-btn-texto" id="d-borrar">Borrar movimiento</button></div>';
        ventana(html, function () {
          vent.querySelector('#d-editar').onclick = function () { formMov(m); };
          var bf = vent.querySelector('#d-factura');
          if (bf) bf.onclick = function () {
            var emit = m.TIPO === 'Ingreso';
            formFac(null, { TIPO: emit ? 'Emitida' : 'Recibida', FECHA: emit ? hoy() : m.FECHA, ID_CONTRAPARTE: m.ID_CONTRAPARTE, BASE: emit ? x.base / 100 : m.BASE, TIPO_IVA: m.TIPO_IVA || '21%',
              RETENCION: emit ? '' : m.RETENCION || '', IVA_IMPORTACION: emit ? '' : m.IVA_IMPORTACION || '', // T0733
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
        // T0646 · Un movimiento nuevo de un tipo con una sola categoría (el cobro de una factura: Ventas) la trae ya puesta.
        if (!m && !v.ID_CATEGORIA) v.ID_CATEGORIA = categoriaUnica(d, v.TIPO);
        if (!m && P && !v[P] && per && d.colsMov.indexOf(P) >= 0) v[P] = per.id;
        if (!m && DS && !v[DS] && S.des && S.des !== '-' && d.colsMov.indexOf(DS) >= 0) v[DS] = S.des;
        var tienePer = P && d.colsMov.indexOf(P) >= 0, tieneDes = DS && d.colsMov.indexOf(DS) >= 0;
        var cuentas = d.cue.map(function (c) { return [c.ID, c.NOMBRE]; }), st = { tipo: v.TIPO || 'Gasto' };
        var altaCtr = [].concat(cfg.ALTA_CONTRAPARTE || []).map(String).filter(Boolean);
        function opcContrapartes(sel) {
          return opciones(d.ctr.map(function (c) { return [c.ID, c.NOMBRE]; }).sort(function (a, b) { return String(a[1]).localeCompare(String(b[1]), 'es'); }), sel, cfg.PIDE_CONTRAPARTE === 'Sí' ? 'Elige' : 'Nadie en concreto');
        }
        var html = '<h2 id="eco-vt">' + (m ? 'Editar movimiento' : 'Añadir movimiento') + '</h2>' +
          '<div class="eco-sw" role="group" aria-label="Qué es">' +
          '<button type="button" data-tipo="Ingreso">↓ Entra dinero</button><button type="button" data-tipo="Gasto">↑ Sale dinero</button><button type="button" data-tipo="Interno">⇄ Entre cuentas</button></div>' +
          '<div class="u-campos">' +
          // T0689 · La foto del ticket, lo primero de un gasto (en el móvil abre la cámara o la galería); al guardar, a Drive.
          (TICKETS && !(m && m.ID_FACTURA) ? cajaFoto('m', 'Foto del ticket') : '') +
          campo('<span id="m-imp-et">Importe sin IVA</span>', '<span class="eco-imp-m"><input type="text" inputmode="decimal" class="eco-imp" id="m-BASE" value="' + texto(verImporte(v)) + '" placeholder="0,00" data-foco>' + cajaMoneda('m') + '</span>') +
          cajaCambio('m') +
          campo('IVA', '<select id="m-TIPO_IVA">' + opcionesConValor(ivas().map(function (x) { return [x, x]; }), v.TIPO_IVA) + '</select>') +
          casillaIva('m') +
          '<p class="u-nota u-ancho" id="m-total"></p>' +
          cajaRetDua('m', v, d.colsMov) + // T0733 (R101): solo en un gasto
          campo('Concepto', '<input type="text" id="m-CONCEPTO" value="' + texto(v.CONCEPTO) + '" maxlength="200" placeholder="Por ejemplo: el dominio de la web">', 'u-ancho') +
          campo('Fecha', '<input type="date" id="m-FECHA" value="' + texto(v.FECHA) + '">') +
          (tienePer ? campo(texto(nomPer), '<select id="m-PER">' + opciones(lista.map(function (p) { return [p.id, p.nombre]; }), v[P], 'Elige') + '</select>') : '') +
          campo('Categoría', '<select id="m-ID_CATEGORIA"></select>', 'eco-no-interno') +
          (tieneDes ? campo(texto(nomDes), '<select id="m-DES" data-elegir="venta"></select>', 'eco-no-interno') : '') +
          campo('<span id="m-cue-et">Cuenta</span>', '<select id="m-ID_CUENTA">' + opciones(cuentas, v.ID_CUENTA, 'Elige la cuenta') + '</select>') +
          campo('A la cuenta', '<select id="m-ID_CUENTA_DESTINO">' + opciones(cuentas, v.ID_CUENTA_DESTINO, 'Elige a dónde va') + '</select>', 'eco-interno') +
          campo('<span id="m-ctr-et">Quién paga o cobra</span>', '<select id="m-ID_CONTRAPARTE" data-elegir="contraparte">' + opcContrapartes(v.ID_CONTRAPARTE) + '</select>', 'eco-no-interno') +
          (altaCtr.length ? '<div class="u-ancho eco-no-interno"><button type="button" class="u-btn u-btn-texto" id="m-ctr-nueva">+ Nueva (no está en la lista)</button>' +
            '<div class="u-campos" id="m-ctr-alta" hidden>' + campo('Nombre', '<input type="text" id="m-ctr-nom" maxlength="120" autocomplete="off">') +
            campo('Es', '<select id="m-ctr-tipo">' + opciones(altaCtr.map(function (x) { return [x, x]; }), altaCtr[0]) + '</select>') +
            '<p class="u-ancho"><button type="button" class="u-btn" id="m-ctr-ok">Añadirla</button> <span class="u-nota">El resto de sus datos (contacto…), en Ajustes.</span></p></div></div>' : '') +
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
              // T0628: las ventas, con su marca; sin venta, es un gasto de la empresa (lo invertido).
              if (VEN) filas = filas.slice().sort(function (a, b) { return String(a.FECHA || '') < String(b.FECHA || '') ? 1 : -1; });
              sd.innerHTML = opciones((R.DESGLOSE ? filas.map(function (r) { return [r.ID, VEN ? nombreVenta(r) : r.NOMBRE || r.ID]; }) : []), des, VEN ? V('Ningun{a}: es de la empresa') : 'General');
            }
            var sf = vent.querySelector('#m-ID_FACTURA'), fa = sf.value || v.ID_FACTURA, ctr = val('m-ID_CONTRAPARTE');
            var fs = d.fac.filter(function (f) { return String(f.ID) === String(fa) || (f.ESTADO !== 'Anulada' && (!ctr || String(f.ID_CONTRAPARTE) === ctr) && (tipo === 'Ingreso' ? f.TIPO === 'Emitida' : f.TIPO !== 'Emitida')); })
              .sort(function (a, b) { return String(a.FECHA) < String(b.FECHA) ? 1 : -1; }).slice(0, 60);
            sf.innerHTML = opciones(fs.map(function (f) { return [f.ID, numFac(f) + ' · ' + fecha(f.FECHA) + ' · ' + eur(importe(f).total)]; }), fa, 'Sin factura');
            pintaImporte('m', 'Importe sin IVA', tipo === 'Gasto' ? 'Lo que pagaste, con IVA' : tipo === 'Ingreso' ? 'Lo que cobraste, con IVA' : 'Importe con IVA');
            var cf = vent.querySelector('#m-foto-caja'); if (cf) cf.hidden = tipo !== 'Gasto';
            var rd = vent.querySelector('#m-retdua'); if (rd && rd.hidden !== (tipo !== 'Gasto')) { rd.hidden = tipo !== 'Gasto'; pintaImporte('m', 'Importe sin IVA', tipo === 'Gasto' ? 'Lo que pagaste, con IVA' : tipo === 'Ingreso' ? 'Lo que cobraste, con IVA' : 'Importe con IVA'); }
          }
          refrescar();
          vent.querySelector('.eco-sw').onclick = function (e) { var b = e.target.closest('[data-tipo]'); if (b) { st.tipo = b.getAttribute('data-tipo'); refrescar(); } };
          ['m-TIPO_IVA', 'm-ID_CONTRAPARTE', 'm-PER'].forEach(function (id) { var e = vent.querySelector('#' + id); if (e) e.addEventListener('change', refrescar); });
          vent.querySelector('#m-BASE').addEventListener('input', refrescar);
          oirImporte('m', refrescar);
          oirRetDua('m', refrescar);
          oirMoneda('m', refrescar);
          oirFoto('m');
          // T0293 · Alta rápida de quién paga o cobra (ALTA_CONTRAPARTE): se crea al momento y queda elegida.
          var bn = vent.querySelector('#m-ctr-nueva');
          if (bn) {
            bn.onclick = function () { bn.hidden = true; vent.querySelector('#m-ctr-alta').hidden = false; vent.querySelector('#m-ctr-nom').focus(); };
            vent.querySelector('#m-ctr-ok').onclick = function () {
              var nom = val('m-ctr-nom'), tipoC = val('m-ctr-tipo'), b = this;
              if (!nom) { verError(['Falta el nombre de quién paga o cobra.']); return; }
              var ya = d.ctr.filter(function (c) { return norm(c.NOMBRE) === norm(nom); })[0];
              var cerrarAlta = function () { vent.querySelector('#m-ctr-alta').hidden = true; bn.hidden = false; vent.querySelector('#m-ctr-nom').value = ''; verError([]); };
              if (ya) { vent.querySelector('#m-ID_CONTRAPARTE').value = ya.ID; cerrarAlta(); refrescar(); if (ctx.abierta()) ctx.aviso('«' + ya.NOMBRE + '» ya estaba: queda elegida.'); return; }
              b.disabled = true; b.textContent = 'Añadiendo…';
              T.crear('CONTRAPARTES', { NOMBRE: nom, TIPO: tipoC }).then(function (r) {
                if (!d.ctr.some(function (c) { return String(c.ID) === String(r.id); })) d.ctr.push(r.fila || { ID: r.id, NOMBRE: nom, TIPO: tipoC });
                ix.ctr[r.id] = r.fila || { ID: r.id, NOMBRE: nom, TIPO: tipoC };
                var s = vent.querySelector('#m-ID_CONTRAPARTE');
                if (s) { s.innerHTML = opcContrapartes(r.id); refrescar(); }
                cerrarAlta();
                b.disabled = false; b.textContent = 'Añadirla';
                if (ctx.abierta()) ctx.aviso(nom + ' añadida a quién paga o cobra.');
              }, function () { b.disabled = false; b.textContent = 'Volver a probar'; });
            };
          }
          vent.querySelector('#m-guardar').onclick = function () {
            var tipo = st.tipo, interno = tipo === 'Interno';
            var nv = { FECHA: val('m-FECHA'), TIPO: tipo, CONCEPTO: val('m-CONCEPTO'), BASE: baseEn('m') / 100, TIPO_IVA: val('m-TIPO_IVA'),
              ID_CATEGORIA: interno ? '' : val('m-ID_CATEGORIA'), ID_CUENTA: val('m-ID_CUENTA'), ID_CUENTA_DESTINO: interno ? val('m-ID_CUENTA_DESTINO') : '',
              ID_CONTRAPARTE: interno ? '' : val('m-ID_CONTRAPARTE'), ID_FACTURA: interno ? '' : val('m-ID_FACTURA'), NOTAS: val('m-NOTAS') };
            Object.assign(nv, valoresRetDua('m', d.colsMov)); // T0733: vacías si no es un gasto (la caja no se ve)
            if (tienePer) nv[P] = val('m-PER');
            if (tieneDes) nv[DS] = interno ? '' : val('m-DES');
            // T0689: un cobro de un pedido con factura la lleva aunque no se elija.
            if (tieneDes && facPorVenta() && !nv.ID_FACTURA) nv.ID_FACTURA = facturaDelCobro(nv, d.fac, DS);
            var mal = problemasMov(Object.assign({}, nv, { BASE: val('m-BASE') }), Object.assign({}, cfg, { PERIODO: tienePer ? P : '' }));
            // T0726 (R61): en otra moneda se guarda en euros, con la cuenta en las notas («Cambio: 4.000 ₹ ÷ 110 = 36,36 €»).
            var mx = enOtraMoneda('m');
            if (mx && !isNaN(mx.n)) {
              if (!mx.euros) mal.push('Falta el cambio: cuántos ' + mx.m.sim + ' hay en un euro.');
              else nv.NOTAS = notasConCambio(nv.NOTAS, mx.euros.cuenta);
            }
            if (mal.length) { verError(mal); return; }
            var foto = tipo === 'Gasto' ? fotoDe('m') : null; // T0689: se lee antes de cerrar la ventana
            cerrar();
            var p = m ? T.actualizar('MOVIMIENTOS', m.ID, cambios(m, nv)) : T.crear('MOVIMIENTOS', nv);
            p.then(function (r) {
              if (!foto) { if (ctx.abierta()) ctx.aviso('Movimiento guardado en el Excel.'); revisarFactura(nv.ID_FACTURA); return; }
              ticketDelGasto(m ? m.ID : (r && (r.id || (r.fila && r.fila.ID))), nv, foto);
            }, function () {});
          };
        });
      }

      /**
       * T0689 · Tras apuntar un gasto con su foto: la sube a Drive y la guarda como su ticket (una fila de FACTURAS de tipo
       * Ticket, Pagada, con el mismo importe), unido al gasto. Si el gasto ya llevaba una factura sin archivo, la foto va a
       * esa. El gasto ya está apuntado: si la foto falla, lo dice y queda como gasto sin factura (sale en Pendiente).
       */
      /** T0733 · La retención y el IVA de aduana del gasto, para su ticket (solo las columnas que tiene FACTURAS). */
      function ticketRetDua(nv) { var o = {}; ['RETENCION', 'IVA_IMPORTACION'].forEach(function (k) { if (d.colsFac.indexOf(k) >= 0 && nv[k]) o[k] = nv[k]; }); return o; }
      function ticketDelGasto(idMov, nv, foto) {
        if (!idMov) return;
        if (ctx.abierta()) ctx.aviso('Gasto apuntado. Subiendo la foto del ticket…');
        subirArchivo(foto, nv.CONCEPTO || 'Ticket', nv.FECHA).then(function (url) {
          var ya = nv.ID_FACTURA ? ix.fac[nv.ID_FACTURA] : null;
          if (ya) return ya.ARCHIVO_URL ? null : T.actualizar('FACTURAS', ya.ID, { ARCHIVO_URL: url });
          return T.crear('FACTURAS', Object.assign({ TIPO: 'Ticket', NUMERO: numeroTicket(nv.CONCEPTO, nv.FECHA), FECHA: nv.FECHA, ID_CONTRAPARTE: nv.ID_CONTRAPARTE || '',
            BASE: nv.BASE, TIPO_IVA: nv.TIPO_IVA, ESTADO: 'Pagada', ARCHIVO_URL: url }, ticketRetDua(nv))).then(function (rf) {
            var idf = rf && (rf.id || (rf.fila && rf.fila.ID));
            if (idf) return T.actualizar('MOVIMIENTOS', idMov, { ID_FACTURA: idf });
          });
        }).then(function () { if (ctx.abierta()) ctx.aviso('Ticket guardado en Drive y unido al gasto.'); },
          function (e) { if (ctx.abierta()) ctx.aviso('El gasto está apuntado, pero la foto no se ha subido: ' + String((e && e.message) || e).replace(/^[A-Z]+: /, '') + '. Añádela desde el gasto.'); });
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

      /** T0726 (R64) · La fila de EMPRESA tal como está ahora en la copia (también lo recién cambiado en «Datos de tu empresa»). */
      function empresaAhora() { return LINEAS ? (T.filas('EMPRESA') || [])[0] || d.emp || null : null; }
      /** T0627 · Lo que le falta a la empresa para que sus facturas estén completas. */
      function empresaFaltan() {
        var e = empresaAhora() || {}, f = [];
        if (!String(e.NOMBRE || '').trim()) f.push('el nombre');
        if (!String(e.NIF || '').trim()) f.push('el CIF');
        if (!String(e.DIRECCION || '').trim()) f.push('la dirección');
        return f;
      }
      /**
       * T0726 (R27 y R64) · «Para … faltan el nombre, el CIF y la dirección de tu empresa: ponlos en «Datos de tu empresa»», con
       * el botón que los abre. encima: desde una factura a medias, que no se pierde (los datos se abren encima).
       */
      function avisoEmpresa(para, encima) {
        var xs = empresaFaltan(), n = xs.length;
        return texto(para) + ' ' + (n > 1 ? 'faltan ' : 'falta ') + texto(listaY(xs)) + ' de tu empresa: <button type="button" class="u-btn u-btn-texto" data-accion="empresa"' +
          (encima ? ' id="f-empresa"' : '') + '>' + (n > 1 ? 'ponlos' : 'ponlo') + ' en «Datos de tu empresa»</button>.' + (encima ? ' Se abren encima y no pierdes la factura.' : '');
      }
      /**
       * T0726 (R64) · Una ventana encima de otra (los datos de la empresa sobre una factura a medias): la de debajo se aparta tal
       * cual (con lo escrito y sus botones) y vuelve al cerrar la de encima. alVolver: lo que se hace al volver.
       */
      var debajo = null;
      function apartar(alVolver) {
        var fr = document.createDocumentFragment(), uv = vent.closest('.u-ventana');
        while (vent.firstChild) fr.appendChild(vent.firstChild);
        debajo = { fr: fr, arriba: uv ? uv.scrollTop : 0, alVolver: alVolver || null };
      }
      function volverDebajo() {
        var x = debajo; debajo = null;
        vent.innerHTML = ''; vent.appendChild(x.fr);
        var uv = vent.closest('.u-ventana'); if (uv) uv.scrollTop = x.arriba;
        if (x.alVolver) x.alVolver();
      }
      /** T0627 · Los datos de la empresa para sus facturas (la fila de EMPRESA; si no hay, se crea al guardar). T0726: alVolver, encima de una factura. */
      function formEmpresa(alVolver) {
        if (alVolver) apartar(alVolver);
        var e = empresaAhora() || {};
        var c = function (et, col, html, extra) { return campo(et, html.replace('%v', texto(e[col])), extra); };
        ventana('<h2 id="eco-vt">Datos de tu empresa</h2><p class="u-nota">Salen en todas tus facturas. El nombre, el CIF y la dirección son obligatorios en una factura.</p><div class="u-campos">' +
          c('Nombre o razón social', 'NOMBRE', '<input type="text" id="e-NOMBRE" value="%v" maxlength="120">', 'u-ancho') +
          c('CIF', 'NIF', '<input type="text" id="e-NIF" value="%v" maxlength="20" autocomplete="off">') +
          c('Teléfono', 'TELEFONO', '<input type="tel" id="e-TELEFONO" value="%v" maxlength="30">') +
          c('Dirección fiscal', 'DIRECCION', '<textarea id="e-DIRECCION" rows="2" placeholder="Calle y número&#10;Código postal y ciudad">%v</textarea>', 'u-ancho') +
          c('Email', 'EMAIL', '<input type="email" id="e-EMAIL" value="%v" maxlength="120">') +
          c('Web', 'WEB', '<input type="text" id="e-WEB" value="%v" maxlength="120">') +
          c('Forma de pago', 'FORMA_PAGO', '<textarea id="e-FORMA_PAGO" rows="2" placeholder="P. ej. Transferencia a 30 días">%v</textarea>', 'u-ancho') +
          // T0681: la cuenta en la que te pagan: sale en la factura, bajo la forma de pago (Javi, 19/11/2026).
          (d.colsEmp.indexOf('IBAN') >= 0 ? c('IBAN de la cuenta en la que te pagan', 'IBAN', '<input type="text" id="e-IBAN" value="%v" maxlength="42" autocomplete="off" placeholder="ES00 0000 0000 0000 0000 0000">', 'u-ancho') : '') +
          c('Pie de la factura (opcional)', 'PIE', '<textarea id="e-PIE" rows="2">%v</textarea>', 'u-ancho') + '</div>' +
          '<p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="e-guardar">Guardar</button><button type="button" class="u-btn" data-cerrar>' + (alVolver ? 'Volver a la factura' : 'Cancelar') + '</button></div>',
        function () {
          vent.querySelector('#e-guardar').onclick = function () {
            var nv = {};
            ['NOMBRE', 'NIF', 'DIRECCION', 'EMAIL', 'TELEFONO', 'WEB', 'FORMA_PAGO', 'PIE'].concat(d.colsEmp.indexOf('IBAN') >= 0 ? ['IBAN'] : []).forEach(function (k) { nv[k] = val('e-' + k); });
            nv.NIF = nv.NIF.toUpperCase().replace(/\s+/g, '');
            if (nv.EMAIL && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nv.EMAIL)) { verError(['El email no parece bien escrito.']); return; }
            if ('IBAN' in nv) { var ib = iban(nv.IBAN); if (!ib.ok) { verError(['El IBAN no cuadra: revisa que esté entero y sin cambiar ningún número.']); return; } nv.IBAN = ib.texto; }
            // T0726: primero a la copia (al momento) y después se cierra: si vuelve a una factura, ya los tiene.
            var e0 = empresaAhora(), p = e0 && e0.ID ? T.actualizar('EMPRESA', e0.ID, cambios(e0, nv)) : T.crear('EMPRESA', nv);
            cerrar();
            p.then(function () { if (ctx.abierta()) ctx.aviso('Datos de tu empresa guardados en el Excel.'); }, function () {});
          };
        });
      }

      /**
       * Ventana de una factura: nueva (f null, con lo que venga en pre) o una que ya está. Una emitida nueva la numera el
       * motor. movId: el movimiento al que se enlaza al guardarla (desde «Hacer la factura» de su ficha).
       * T0627 · Con FACTURA_LINEAS, una emitida se hace por líneas (qué se vende, cantidad, unidad y precio; la base es su
       * suma), con el CIF y la dirección del cliente (CONTRAPARTES, si el negocio tiene esas columnas), y se puede ver como
       * documento («Ver la factura») y, con FACTURA_CARPETA, guardar su PDF en Drive («Guardar y sacar el PDF»).
       */
      /** T0673 · Los tipos de factura, en botones al añadirla: [valor, lo que dice el botón] y lo que es cada uno, debajo. */
      var TIPOS_FAC = [['Emitida', 'Emitida'], ['Recibida', 'Recibida'], ['Ticket', 'Ticket']];
      function notaTipoFac(t) {
        return { Emitida: 'La haces tú, a un cliente.', Recibida: 'Te la manda un proveedor, el taller o la gestoría: pon el número que trae.',
          Ticket: 'Un ticket de una compra pequeña (un taxi, la entrada a una feria).' }[t] || '';
      }
      /** T0646 · Las fichas de CLIENTES (las marcas). */
      function fichasCli() { return CLI ? (T.filas(CLI.tabla) || []) : []; }
      /** Quién se puede elegir en una factura: en una emitida con CLIENTES, solo clientes (los que ya lo son y las fichas que
       *  aún no tienen contraparte, con «marca:» delante); si no, todas las contrapartes. */
      function opcContraparte(tipo, sel) {
        function orden(a, b) { return String(a[1]).localeCompare(String(b[1]), 'es'); }
        // T0726 (R60): en una recibida o un ticket, primero quien te factura (proveedores, gestoría, herramientas…) y los clientes, aparte.
        if (tipo !== 'Emitida' && d.ctr.some(function (c) { return c.TIPO === 'Cliente'; })) {
          var no = d.ctr.filter(function (c) { return c.TIPO !== 'Cliente'; }), si = d.ctr.filter(function (c) { return c.TIPO === 'Cliente'; });
          var de = function (xs) { return xs.map(function (c) { return [c.ID, c.NOMBRE]; }).sort(orden); };
          return '<option value="">Elige</option>' + opciones(de(no), sel) + '<optgroup label="Clientes">' + opciones(de(si), sel) + '</optgroup>';
        }
        if (!(CLI && tipo === 'Emitida')) return opciones(d.ctr.map(function (c) { return [c.ID, c.NOMBRE]; }).sort(orden), sel, 'Elige');
        var x = clientesFactura(d.ctr, fichasCli(), CLI, sel), xs = x.clientes, otros = x.otros;
        var h = '<option value="">Elige</option>' + opciones(xs, sel);
        if (otros.length) h += '<optgroup label="' + texto(CLI.otros || 'En prospección') + '">' + opciones(otros, sel) + '</optgroup>';
        return h;
      }
      function formFac(f, pre, movId, linea0) {
        var v = f || Object.assign({ TIPO: 'Recibida', FECHA: hoy(), TIPO_IVA: '21%', ESTADO: 'Pendiente' }, pre || {});
        var movs = f ? d.mov.filter(function (m) { return String(m.ID_FACTURA) === String(f.ID); }) : [];
        var pagado = 0; movs.forEach(function (m) { pagado += importe(m).total; });
        var lin0 = f && LINEAS ? lineasDe(d.lin, f.ID) : [];
        var ARTS = ART ? articulos(ART, { filas: function (t) { return T.filas(t) || []; }, fila: filaDe }) : [];
        var datosCli = LINEAS && d.colsCtr.indexOf('NIF') >= 0 && d.colsCtr.indexOf('DIRECCION') >= 0;
        // T0726 (R60): el CIF o NIF del proveedor, también en una recibida (se guarda en su contraparte, como el del cliente).
        var nifProv = d.colsCtr.indexOf('NIF') >= 0;
        var pdf = LINEAS && !!String(cfg.FACTURA_CARPETA || '').trim();
        // T0725 (R12): una emitida con PDF, cobrada o anulada no se cambia; solo su estado y sus notas.
        var cerrada = LINEAS && facturaCerrada(f);
        // T0689 · Desde un pedido: a su marca y con lo que pidió; al guardarla queda unida a él (FACTURAS · ID_VENTA).
        var deVenta = !f && DS && v[DS] && d.colsFac.indexOf(DS) >= 0 ? ix.des[String(v[DS])] || null : null;
        var html = '<h2 id="eco-vt">' + (f ? 'Factura ' + texto(numFac(f)) : deVenta ? 'Factura a ' + texto(nombre('ctr', v.ID_CONTRAPARTE) || 'la marca') : movId ? (v.TIPO === 'Emitida' ? 'Hacer la factura' : 'Añadir su factura') : 'Añadir factura') + '</h2>' +
          (deVenta ? '<p class="u-nota">' + V('{Del} {venta}') + ' «' + texto(deVenta.NOMBRE || deVenta.ID) + '»: revisa lo que se vende y el precio. Será la siguiente de la serie ' + texto(String(cfg.SERIE_EMITIDAS || '')) + ', con fecha de hoy.</p>' : '') +
          // T0627: en una emitida por líneas, arriba, su PDF guardado (el que se manda al cliente) o que aún no tiene.
          (f && LINEAS && f.TIPO === 'Emitida' ? '<p>' + (f.ARCHIVO_URL ? enlaceDrive(f) : '<span class="u-nota">Todavía sin PDF' + (pdf && puedeSacarPdf(f) ? ': «Guardar y sacar el PDF» lo hace.' : '.') + '</span>') + '</p>'
            : f && f.ARCHIVO_URL ? '<p>' + enlaceDrive(f) + '</p>' : '') +
          (cerrada ? '<p class="u-nota" id="f-cerrada">' + (String(f.ARCHIVO_URL || '').trim() ? 'Ya tiene su PDF' : f.ESTADO === 'Anulada' ? 'Está anulada' : 'Ya está cobrada') +
            ': solo se cambian el estado y las notas. La fecha, el cliente, lo que se vende y el IVA se quedan como están.</p>' : '') +
          // T0726 (R64): sin los datos de la empresa, dónde se ponen, sin perder la factura.
          (LINEAS && !cerrada ? '<p class="u-nota eco-falta" id="f-emp" hidden></p>' : '') +
          (movId ? '<p class="u-nota">Con los datos del movimiento. ' + (v.TIPO === 'Emitida' ? 'La fecha es la de hoy, que es cuando se emite; el número lo pone el Excel al guardarla.' : 'Pon el número que trae la factura.') + ' Al guardarla queda enlazada al movimiento.</p>' : '') +
          // T0673 · El tipo, arriba y a la vista (como «Entra / Sale / Entre cuentas» en Movimientos), no en un desplegable.
          (f ? '' : '<div class="eco-sw" role="group" aria-label="Qué factura es">' + TIPOS_FAC.map(function (t) {
            return '<button type="button" data-tipo="' + t[0] + '" aria-pressed="' + (t[0] === (v.TIPO || 'Emitida') ? 'true' : 'false') + '">' + t[1] + '</button>';
          }).join('') + '</div><input type="hidden" id="f-TIPO" value="' + texto(v.TIPO || 'Emitida') + '"><p class="u-nota" id="f-tipo-nota">' + texto(notaTipoFac(v.TIPO || 'Emitida')) + '</p>') +
          '<div class="u-campos">' +
          campo('Número', '<input type="text" id="f-NUMERO" value="' + texto(v.NUMERO) + '" maxlength="40">', 'eco-numero') +
          '<p class="u-nota u-ancho" id="f-num-nota" hidden></p>' +
          campo('Fecha', '<input type="date" id="f-FECHA" value="' + texto(v.FECHA) + '">') +
          campo('<span id="f-ctr-et">' + (v.TIPO === 'Emitida' ? 'Cliente (a quién se la hacemos)' : 'Proveedor (quién nos la hace)') + '</span>', '<select id="f-ID_CONTRAPARTE">' + opcContraparte(v.TIPO, v.ID_CONTRAPARTE) + '</select>') +
          (datosCli || nifProv ? '<div class="u-campos u-ancho" id="f-cli">' + campo('<span id="f-nif-et">CIF o NIF del cliente</span>', '<input type="text" id="f-NIF" maxlength="20" autocomplete="off">') +
            (datosCli ? campo('Dirección del cliente', '<textarea id="f-DIRECCION" rows="2" placeholder="Calle y número&#10;Código postal y ciudad"></textarea>', 'u-ancho eco-dir-cli') : '') +
            '<p class="u-nota u-ancho" id="f-cli-nota">Salen en su factura. Se guardan en el cliente: la próxima vez ya están.</p></div>' : '') +
          (LINEAS ? '<div class="u-ancho" id="f-lin"><span class="u-etiqueta">Qué se vende</span><div id="f-lineas"></div>' +
            '<button type="button" class="u-btn u-btn-texto" id="f-mas">+ Añadir línea</button>' +
            '<p class="u-nota" id="f-lin-nota"></p></div>' : '') +
          campo('<span id="f-imp-et">Base imponible</span>', '<input type="text" inputmode="decimal" id="f-BASE" value="' + texto(verImporte(v)) + '" placeholder="0,00">', 'eco-base') +
          campo('IVA', '<select id="f-TIPO_IVA">' + opcionesConValor(ivas().map(function (x) { return [x, x]; }), v.TIPO_IVA) + '</select>') +
          casillaIva('f') +
          '<div class="u-nota u-ancho" id="f-total"></div>' +
          (cerrada ? '' : cajaRetDua('f', v, d.colsFac)) + // T0733 (R101): solo en una recibida o un ticket
          campo('Estado', '<select id="f-ESTADO">' + opciones([['Pendiente', 'Pendiente'], ['Pagada', 'Pagada'], ['Anulada', 'Anulada']], v.ESTADO, 'Sin estado') + '</select>') +
          // T0689 · La foto o el PDF de una recibida o un ticket, desde el móvil (la sube el motor a Drive al guardar).
          (TICKETS && !(f && f.ARCHIVO_URL) ? cajaFoto('f', 'Foto o PDF de la factura') : '') +
          campo('Enlace en Drive', '<input type="url" id="f-ARCHIVO_URL" value="' + texto(v.ARCHIVO_URL) + '" placeholder="https://drive.google.com/…">', 'u-ancho eco-url') +
          '<p class="u-nota u-ancho" id="f-url-nota">' + (TICKETS && !(f && f.ARCHIVO_URL) ? 'O, si ya está en Drive, su enlace: Compartir › Copiar enlace.' : 'El del PDF o la foto de la factura: en Drive, Compartir › Copiar enlace.') + '</p>' +
          campo('Notas', '<textarea id="f-NOTAS" rows="2">' + texto(v.NOTAS) + '</textarea>', 'u-ancho') + '</div>' +
          (f ? '<p class="u-nota">' + (movs.length ? movs.length + (movs.length === 1 ? ' movimiento' : ' movimientos') + ' con esta factura: ' + eur(pagado) + ' de ' + eur(importe(f).total) + '.' : 'Ningún movimiento lleva todavía esta factura.') + '</p>' : '') +
          // T0646 · Lo que se hace, primero (guardar, sacar el PDF, apuntar el cobro); «Vista previa» y «Cancelar», como texto, al final.
          '<p class="u-error" role="alert" hidden></p><div class="n-botones eco-fbotones">' +
          // T0689 · Una emitida nueva con carpeta para el PDF: un solo botón, que la guarda, la numera y saca su PDF.
          (pdf && !f ? '<button type="button" class="u-btn u-btn-accion" id="f-hacer" hidden>Hacer la factura y el PDF</button>' : '') +
          '<button type="button" class="u-btn u-btn-accion" id="f-guardar">Guardar factura</button>' +
          (pdf && puedeSacarPdf(f) ? '<button type="button" class="u-btn" id="f-pdf" hidden>Guardar y sacar el PDF</button>' : '') +
          (f && f.ESTADO === 'Pendiente' ? '<button type="button" class="u-btn" id="f-apuntar">' + (f.TIPO === 'Emitida' ? 'Apuntar el cobro' : 'Apuntar el pago') + '</button>' : '') +
          (LINEAS ? '<button type="button" class="u-btn u-btn-texto" id="f-ver" hidden title="Cómo queda con lo que hay ahora en pantalla, sin guardar">Vista previa</button>' : '') +
          '<button type="button" class="u-btn u-btn-texto" data-cerrar>Cancelar</button></div>';
        ventana(html, function () {
          var cajaLin = vent.querySelector('#f-lineas');
          function tipoAhora() { return f ? f.TIPO : val('f-TIPO'); }
          function porLineas() { return LINEAS && tipoAhora() === 'Emitida'; }
          /** T0627 · ¿El precio de esta línea (la fila o algo dentro de ella) se escribió con el IVA incluido? (su casilla «IVA incl.») */
          function linIva(x) { var r = x && x.closest ? x.closest('.eco-lin') : null, c = r && r.querySelector('.eco-lin-ci'); return !!(c && c.checked); }
          function siBool(v) { return v === true || /^(true|sí|si|1|x)$/i.test(String(v == null ? '' : v)); }
          /** Una línea en pantalla (l: { ID, CONCEPTO, DETALLE, CANTIDAD, UNIDAD, PRECIO }). */
          function filaLin(l) {
            var n = function (x) { return x === '' || x == null ? '' : String(x).replace('.', ','); };
            var ci = siBool(l.IVA_INCLUIDO), pv = l.PRECIO === '' || l.PRECIO == null ? '' : ci ? conIvaPrecio(l.PRECIO, val('f-TIPO_IVA')) : precio(l.PRECIO);
            var div = document.createElement('div');
            div.className = 'eco-lin';
            if (l.ID) div.setAttribute('data-id', l.ID);
            div.innerHTML = (ARTS.length
              ? '<div class="eco-lin-cw"><textarea rows="1" class="eco-lin-c" aria-label="Concepto" autocomplete="off" role="combobox" aria-expanded="false" placeholder="Busca en ' + texto(ART.titulo || 'la lista') + ' por nombre o código, o escribe (el envío)">' + texto(l.CONCEPTO) + '</textarea>' +
                '<div class="eco-lin-op" role="listbox" hidden></div></div>'
              : '<textarea rows="1" class="eco-lin-c" aria-label="Concepto" placeholder="Qué (p. ej. Lino Celosía BOR-004-01)">' + texto(l.CONCEPTO) + '</textarea>') +
              '<textarea rows="1" class="eco-lin-d" aria-label="Detalle" placeholder="Detalle (opcional)">' + texto(l.DETALLE) + '</textarea>' +
              '<input type="text" inputmode="decimal" class="eco-lin-n" aria-label="Cantidad" placeholder="Cant." value="' + texto(n(l.CANTIDAD)) + '">' +
              '<input type="text" class="eco-lin-u" aria-label="Unidad" placeholder="ud." maxlength="8" value="' + texto(l.UNIDAD) + '">' +
              '<input type="text" inputmode="decimal" class="eco-lin-p" aria-label="Precio" placeholder="Precio" value="' + texto(n(pv)) + '" data-precio="' + texto(l.PRECIO == null ? '' : l.PRECIO) + '">' +
              '<label class="eco-lin-iva" title="El precio que has puesto ya lleva el IVA"><input type="checkbox" class="eco-lin-ci"' + (ci ? ' checked' : '') + '> IVA incl.</label>' +
              '<span class="eco-lin-t u-cifra"></span><button type="button" class="u-btn u-btn-texto eco-lin-x" aria-label="Quitar la línea">Quitar</button>' +
              (ARTS.length ? '<p class="eco-lin-rec" hidden></p>' : '') + '<p class="u-error eco-lin-falta" hidden></p>';
            cajaLin.appendChild(div);
            crecer(div);
            if (ARTS.length) {
              // Una línea guardada de un artículo (su código al final del concepto) sigue con su recomendado.
              var a0 = artDe(ARTS, l.CONCEPTO);
              if (a0) div.setAttribute('data-art', a0.codigo);
              pintaRec(div);
            }
          }
          /* T0635 · Elegir lo que se vende de ARTICULOS (Mis telas): se busca por nombre o código y la línea se rellena
           * con su nombre y código, el detalle, la unidad y el precio recomendado sin IVA (se puede cambiar). */
          /** T0635 · El concepto y el detalle crecen con el texto (en el móvil, una tela con su código no cabe en una línea). */
          function crecer(r) {
            Array.prototype.forEach.call(r.querySelectorAll('textarea.eco-lin-c, textarea.eco-lin-d'), function (t) {
              // T0646: con el borde (scrollHeight no lo cuenta y, sin él, el texto se cortaba: «De!»).
              t.style.height = 'auto'; if (t.scrollHeight) t.style.height = (t.scrollHeight + t.offsetHeight - t.clientHeight) + 'px';
            });
          }
          function artPorCodigo(c) { return ARTS.filter(function (a) { return a.codigo === c; })[0] || null; }
          function eurPrecio(n) { return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'; }
          /** T0653 · El último precio de este artículo al cliente elegido (si ARTICULOS lo pide con «ultimo»), o null. */
          function ultimoDe(a) { return ART.ultimo ? ultimoPrecio(d.lin, d.fac, val('f-ID_CONTRAPARTE'), a.codigo, f && f.ID) : null; }
          /** Lo que se propone al elegirlo y con «Ponerlo»: el último precio a ese cliente o, si no, el recomendado (NaN: nada). */
          function propuesto(a) { var u = ultimoDe(a); return u ? u.precio : a.precio; }
          function pintaRec(r) {
            var p = r.querySelector('.eco-lin-rec'); if (!p) return;
            var a = artPorCodigo(r.getAttribute('data-art') || '');
            p.hidden = !a;
            if (!a) { p.innerHTML = ''; return; }
            var u = a.unidad ? '/' + a.unidad : '';
            var dp = r.querySelector('.eco-lin-p').getAttribute('data-precio'), sinPrecio = dp === '' || dp == null, puesto = sinPrecio ? NaN : Number(dp);
            var ult = ultimoDe(a), prop = ult ? ult.precio : a.precio, partes = [];
            var pon = !isNaN(prop) && !(Math.abs(puesto - prop) < 0.005) ? ' · <button type="button" class="u-btn u-btn-texto eco-lin-pon" data-pon="' + prop + '">Ponerlo</button>' : '';
            // T0653: con «ultimo», lo que le pusiste la última vez a este cliente; si no hay, el recomendado (si lo hay).
            if (ult) partes.push('La última vez a este cliente: <b>' + eurPrecio(ult.precio) + texto(u) + '</b> sin IVA (' + (ult.numero ? texto(ult.numero) + ', ' : '') + texto(fecha(ult.fecha)) + ')' + pon);
            else if (!isNaN(a.precio)) partes.push('Recomendado: <b>' + eurPrecio(a.precio) + texto(u) + '</b> sin IVA' + pon);
            // Sin recomendado (en Mis telas le falta el coste): en rojo solo mientras la línea no tiene precio.
            else if (ART.precio) partes.push(sinPrecio ? '<span class="u-mal">Sin precio recomendado: en ' + texto(ART.titulo || 'la lista') + ' le falta el coste. Ponlo tú.</span>' : 'Sin precio recomendado: en ' + texto(ART.titulo || 'la lista') + ' le falta el coste.');
            if (ART.coste) {
              if (a.faltaEnvio) partes.push('<span class="u-mal">Sin coste: falta el envío en Ajustes.</span>');
              else if (isNaN(a.coste)) partes.push('Sin coste: en ' + texto(ART.titulo || 'la lista') + ' le falta.');
              else if (!isNaN(puesto) && puesto < a.coste - 0.004) partes.push('<span class="u-mal">Por debajo de lo que te cuesta (' + eurPrecio(a.coste) + texto(u) + ')</span>');
              else partes.push('Te cuesta ' + eurPrecio(a.coste) + texto(u));
            }
            p.hidden = !partes.length;
            p.innerHTML = partes.join(' · ');
          }
          function sugerir(r, q) {
            var caja = r.querySelector('.eco-lin-op'), inp = r.querySelector('.eco-lin-c'), hay = buscarArt(ARTS, q, 6);
            caja.hidden = !hay.length; inp.setAttribute('aria-expanded', hay.length ? 'true' : 'false');
            caja.innerHTML = hay.map(function (a, i) {
              return '<button type="button" role="option" class="eco-lin-o' + (i ? '' : ' eco-lin-o-sel') + '" data-cod="' + texto(a.codigo) + '">' +
                '<span class="eco-lin-on">' + texto(a.nombre) + ' <span class="eco-lin-oc">' + texto(a.codigo) + '</span></span>' +
                (precioOpcion(a) ? '<span class="eco-lin-op-p">' + texto(precioOpcion(a)) + '</span>' : '') + '</button>';
            }).join('');
          }
          function elegir(r, a) {
            r.querySelector('.eco-lin-c').value = a.nombre + ' · ' + a.codigo;
            r.querySelector('.eco-lin-d').value = a.detalle;
            if (a.unidad) r.querySelector('.eco-lin-u').value = a.unidad;
            r.querySelector('.eco-lin-ci').checked = false;
            var pi = r.querySelector('.eco-lin-p');
            r.setAttribute('data-art', a.codigo);
            var pr = propuesto(a); // T0653: el último a este cliente o el recomendado; si no, vacío para que lo ponga
            pi.value = isNaN(pr) ? '' : String(pr).replace('.', ',');
            leerPrecio(pi);
            cerrarOp(r);
            crecer(r);
            pintaLineas(); pintaTot();
            var cant = r.querySelector('.eco-lin-n'); if (cant) cant.focus();
          }
          function cerrarOp(r) { var c = r.querySelector('.eco-lin-op'); if (c) { c.hidden = true; c.innerHTML = ''; r.querySelector('.eco-lin-c').setAttribute('aria-expanded', 'false'); } }
          /**
           * T0627 · Cada precio guarda en data-precio el sin IVA exacto. Lo escrito se queda tal cual en pantalla: la casilla
           * «IVA incl.» de su línea solo dice cómo se lee (100 con IVA → 82,6446 sin IVA). Lo que no se toca se queda como
           * estaba: abrir y guardar no cambia ni un céntimo.
           */
          function leerPrecio(inp) {
            var x = String(inp.value).trim();
            inp.setAttribute('data-precio', x === '' ? '' : String(linIva(inp) ? sinIva(x, val('f-TIPO_IVA')) : precio(x)));
          }
          /** Las líneas de la pantalla, como filas de FACTURA_LINEAS (sin las vacías). */
          function lineasAhora() {
            return cajaLin ? Array.prototype.map.call(cajaLin.querySelectorAll('.eco-lin'), function (r) {
              var q = function (c) { return String(r.querySelector(c).value).trim(); };
              var dp = r.querySelector('.eco-lin-p').getAttribute('data-precio');
              return { ID: r.getAttribute('data-id') || '', CONCEPTO: q('.eco-lin-c'), DETALLE: q('.eco-lin-d'), CANTIDAD: q('.eco-lin-n') === '' ? '' : cantidad(q('.eco-lin-n')),
                UNIDAD: q('.eco-lin-u'), PRECIO: dp === '' || dp == null ? '' : Number(dp), IVA_INCLUIDO: r.querySelector('.eco-lin-ci').checked };
            }).filter(function (l) { return l.CONCEPTO || l.PRECIO !== ''; }) : [];
          }
          function pintaLineas() {
            if (!cajaLin) return;
            Array.prototype.forEach.call(cajaLin.querySelectorAll('.eco-lin'), function (r) {
              var q = function (c) { return r.querySelector(c).value; };
              var vacia = !String(q('.eco-lin-c')).trim() && !String(q('.eco-lin-p')).trim();
              // El importe de cada línea, como su precio: con IVA si su casilla está marcada, sin IVA si no.
              var ci = linIva(r);
              r.querySelector('.eco-lin-t').textContent = vacia ? '' : eur(importeLinea({ CANTIDAD: q('.eco-lin-n'), PRECIO: q('.eco-lin-p') })) + (ci ? ' con IVA' : '');
              pintaRec(r);
              // T0725 (R62): una tela sin metros no se toma por 1 m sin avisar.
              var fc = faltaCantidad({ CONCEPTO: q('.eco-lin-c'), UNIDAD: q('.eco-lin-u'), CANTIDAD: q('.eco-lin-n') }), pf = r.querySelector('.eco-lin-falta');
              if (pf) { pf.textContent = fc; pf.hidden = !fc || cerrada; }
              r.querySelector('.eco-lin-n').setAttribute('aria-invalid', fc && !cerrada ? 'true' : 'false');
            });
            vent.querySelector('#f-lin-nota').textContent = 'Precio por unidad (metro, pieza…), sin IVA. Si el que sabes ya lleva el IVA, ponlo tal cual y marca «IVA incl.» en esa línea: la factura lo pone sin IVA y el total cuadra.';
            var b = vent.querySelector('#f-BASE');
            b.value = (baseLineas(lineasAhora()) / 100).toFixed(2).replace('.', ',');
          }
          /**
           * T0627 · El importe debajo del IVA; por líneas, un resumen a la vista mientras se escribe: base, IVA y el total
           * de la factura en grande (la casilla de la base no sale: ya está aquí).
           */
          function pintaTot() {
            pintaImporte('f', 'Base imponible', 'Total con IVA');
            var lin = porLineas(), b = vent.querySelector('.eco-base');
            if (b) b.hidden = lin;
            if (!lin) return;
            var t = importe({ BASE: baseEn('f') / 100, TIPO_IVA: val('f-TIPO_IVA') });
            vent.querySelector('#f-total').innerHTML = '<div class="eco-tot">' +
              '<div><span>Base imponible</span><span>' + eur(t.base) + '</span></div>' +
              '<div><span>IVA ' + texto(val('f-TIPO_IVA')) + '</span><span>' + eur(t.iva) + '</span></div>' +
              '<div class="eco-tot-total"><span>Total de la factura</span><span>' + eur(t.total) + '</span></div></div>';
          }
          function clienteElegido() {
            var v0 = val('f-ID_CONTRAPARTE'), c = ix.ctr[v0] || null, m = null;
            if (CLI && /^marca:/.test(v0)) { m = filaDe(CLI.tabla, v0.slice(6)); return m ? { NOMBRE: m.NOMBRE, _ficha: m, _nuevo: true } : null; }
            if (c && CLI) m = filaDe(CLI.tabla, c[String(CLI.campo || 'ID_MARCA')]);
            return c ? Object.assign({}, c, { _ficha: m }) : null;
          }
          /** La dirección para la factura: la que ya tiene el cliente o, si no, la de su ficha (CLIENTES · direccion). */
          function direccionDe(c) { return direccionCliente(c, c._ficha, CLI && CLI.direccion); }
          /** T0726 (R60) · ¿Pide el CIF o NIF de quien la hace? En una recibida (no en un ticket), si CONTRAPARTES lo tiene. */
          function pideNifProv() { return nifProv && tipoAhora() === 'Recibida'; }
          function pintaCliente() {
            var caja = vent.querySelector('#f-cli'); if (!caja) return;
            var c = clienteElegido(), lin = porLineas() && datosCli, prov = pideNifProv();
            caja.hidden = !c || !(lin || prov);
            vent.querySelector('#f-nif-et').textContent = prov ? 'CIF o NIF del proveedor' : 'CIF o NIF del cliente';
            vent.querySelector('#f-cli-nota').textContent = prov ? 'Se guarda en el proveedor: la próxima vez ya está.' : 'Salen en su factura. Se guardan en el cliente: la próxima vez ya están.';
            var dir = vent.querySelector('.eco-dir-cli'); if (dir) dir.hidden = !lin;
            vent.querySelector('#f-NIF').value = c ? String(c.NIF || '') : '';
            var td = vent.querySelector('#f-DIRECCION'); if (td) td.value = c && lin ? direccionDe(c) : '';
          }
          function refrescar() {
            var tipo = tipoAhora(), em = tipo === 'Emitida' && !f, lin = porLineas();
            // T0627: el número de una emitida lo pone el motor al guardarla y ya no se cambia (correlativo y sin huecos).
            vent.querySelector('#f-ctr-et').textContent = tipo === 'Emitida' ? 'Cliente (a quién se la hacemos)' : 'Proveedor (quién nos la hace)';
            var sc = vent.querySelector('#f-ID_CONTRAPARTE');
            if (!f && sc.getAttribute('data-tipo') !== tipo) { var sv = sc.value; sc.innerHTML = opcContraparte(tipo, sv); sc.setAttribute('data-tipo', tipo); } // T0726: también sin CLIENTES (las recibidas, proveedores primero)
            var n = vent.querySelector('#f-NUMERO');
            // Bloqueado se ve como texto, sin caja (no parece que se pueda escribir), con su porqué debajo.
            n.disabled = tipo === 'Emitida'; if (em) n.value = ''; n.placeholder = em ? 'Se pone sola al guardar' : '';
            var nn = vent.querySelector('#f-num-nota');
            nn.hidden = tipo !== 'Emitida';
            nn.textContent = em ? 'La siguiente de la serie ' + String(cfg.SERIE_EMITIDAS || '') + ', seguida y sin huecos.' : 'No se cambia. Si ya la has mandado, no la cambies: Utilo te ayuda a corregirla.';
            if (LINEAS) {
              vent.querySelector('#f-lin').hidden = !lin;
              var ci = vent.querySelector('#f-coniva');
              if (lin && ci.checked) ci.checked = false; // por líneas, los precios van sin IVA
              else if (!lin && !f && ci.getAttribute('data-lin')) ci.checked = conIva(); // T0689: al volver a recibida, como venía
              if (lin) ci.setAttribute('data-lin', '1'); else ci.removeAttribute('data-lin');
              vent.querySelector('#f-iva-sw').hidden = lin;
              var bh = vent.querySelector('#f-hacer'); if (bh) { bh.hidden = !lin; vent.querySelector('#f-guardar').hidden = lin; }
              vent.querySelector('#f-BASE').readOnly = lin;
              vent.querySelector('.eco-base').classList.toggle('eco-calculada', lin);
              if (lin) { if (!cajaLin.children.length) filaLin({ CANTIDAD: '', UNIDAD: '' }); pintaLineas(); }
              var bv = vent.querySelector('#f-ver'); if (bv) bv.hidden = !lin;
              var bp = vent.querySelector('#f-pdf'); if (bp) bp.hidden = !lin;
              // Por líneas, el enlace al PDF lo pone la app: no se enseña el campo (sale arriba, «Abrir el PDF»).
              vent.querySelector('.eco-url').hidden = lin && pdf;
              vent.querySelector('#f-url-nota').hidden = lin && pdf;
            }
            var cf = vent.querySelector('#f-foto-caja'); if (cf) cf.hidden = tipo === 'Emitida';
            var rd = vent.querySelector('#f-retdua'); if (rd) rd.hidden = tipo === 'Emitida';
            pintaEmpresa();
            pintaTot();
          }
          /** T0726 (R64) · El aviso de lo que le falta a la empresa (solo en una emitida por líneas), con «ponlos en Datos de tu empresa». */
          function pintaEmpresa() {
            var pe = vent.querySelector('#f-emp'); if (!pe) return;
            var falta = porLineas() && empresaFaltan().length;
            pe.hidden = !falta;
            pe.innerHTML = falta ? avisoEmpresa('Para sacar el PDF de una factura', true) : '';
            var be = pe.querySelector('#f-empresa');
            if (be) be.onclick = function () { formEmpresa(function () { verError([]); pintaEmpresa(); }); };
          }
          if (cajaLin) {
            lin0.forEach(filaLin);
            if (!lin0.length && f && f.TIPO === 'Emitida' && cts(f.BASE)) filaLin({ CONCEPTO: '', CANTIDAD: 1, PRECIO: f.BASE }); // una de antes, sin líneas
            cajaLin.addEventListener('input', function (e) {
              if (e.target.classList.contains('eco-lin-p')) leerPrecio(e.target);
              if (e.target.tagName === 'TEXTAREA') {
                if (/\n/.test(e.target.value)) e.target.value = e.target.value.replace(/\s*\n+\s*/g, ' '); // una sola línea (al pegar)
                crecer(e.target.closest('.eco-lin'));
              }
              if (ARTS.length && e.target.classList.contains('eco-lin-c')) {
                var r = e.target.closest('.eco-lin'), a = artDe(ARTS, e.target.value);
                if (a) r.setAttribute('data-art', a.codigo); else r.removeAttribute('data-art');
                sugerir(r, e.target.value);
              }
              pintaLineas(); pintaTot();
            });
            // Intro no parte el concepto ni el detalle en dos líneas (con la lista abierta, elige).
            cajaLin.addEventListener('keydown', function (e) {
              if (e.key !== 'Enter' || e.target.tagName !== 'TEXTAREA') return;
              var op = e.target.closest('.eco-lin').querySelector('.eco-lin-op');
              if (!op || op.hidden) e.preventDefault();
            });
            if (ARTS.length) {
              // Con el teclado: flechas para moverse, Intro elige, Esc cierra. Con el ratón o el dedo, al tocar.
              cajaLin.addEventListener('keydown', function (e) {
                if (!e.target.classList.contains('eco-lin-c')) return;
                var r = e.target.closest('.eco-lin'), caja = r.querySelector('.eco-lin-op');
                if (caja.hidden) return;
                var os = Array.prototype.slice.call(caja.querySelectorAll('.eco-lin-o')), i = os.findIndex(function (o) { return o.classList.contains('eco-lin-o-sel'); });
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  if (os[i]) os[i].classList.remove('eco-lin-o-sel');
                  i = (i + (e.key === 'ArrowDown' ? 1 : os.length - 1)) % os.length; os[i].classList.add('eco-lin-o-sel');
                } else if (e.key === 'Enter' && os[i]) { e.preventDefault(); elegir(r, artPorCodigo(os[i].getAttribute('data-cod'))); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarOp(r); }
              });
              cajaLin.addEventListener('mousedown', function (e) { if (e.target.closest('.eco-lin-o')) e.preventDefault(); });
              cajaLin.addEventListener('focusout', function (e) { if (e.target.classList.contains('eco-lin-c')) cerrarOp(e.target.closest('.eco-lin')); });
              cajaLin.addEventListener('click', function (e) {
                var o = e.target.closest('.eco-lin-o'); if (o) { elegir(o.closest('.eco-lin'), artPorCodigo(o.getAttribute('data-cod'))); return; }
                var pon = e.target.closest('.eco-lin-pon'); if (!pon) return;
                var r = pon.closest('.eco-lin'), pv = Number(pon.getAttribute('data-pon')); if (isNaN(pv)) return;
                r.querySelector('.eco-lin-ci').checked = false;
                var pi = r.querySelector('.eco-lin-p'); pi.value = String(pv).replace('.', ','); leerPrecio(pi);
                pintaLineas(); pintaTot();
              });
            }
            // Marcar «IVA incl.» en una línea cambia cómo se lee su precio (el número escrito no cambia); las demás, igual.
            cajaLin.addEventListener('change', function (e) {
              if (!e.target.classList.contains('eco-lin-ci')) return;
              leerPrecio(e.target.closest('.eco-lin').querySelector('.eco-lin-p'));
              pintaLineas(); pintaTot();
            });
            cajaLin.addEventListener('click', function (e) {
              var x = e.target.closest('.eco-lin-x'); if (!x) return;
              x.closest('.eco-lin').remove();
              if (!cajaLin.children.length) filaLin({ CANTIDAD: '', UNIDAD: '' });
              pintaLineas(); pintaTot();
            });
            vent.querySelector('#f-mas').onclick = function () { filaLin({ CANTIDAD: '', UNIDAD: '' }); var u = cajaLin.lastChild.querySelector('.eco-lin-c'); if (u) u.focus(); };
          }
          refrescar();
          pintaCliente();
          // T0725 (R12): cerrada, todo se ve pero solo se tocan el estado y las notas (ni líneas nuevas ni quitar).
          if (cerrada) {
            Array.prototype.forEach.call(vent.querySelectorAll('.u-campos input, .u-campos select, .u-campos textarea'), function (x) {
              if (x.id !== 'f-ESTADO' && x.id !== 'f-NOTAS') x.disabled = true;
            });
            Array.prototype.forEach.call(vent.querySelectorAll('#f-mas, .eco-lin-x, .eco-lin-pon, .eco-lin-rec'), function (x) { x.hidden = true; });
          }
          // T0653 · Desde «Calcular precio» («Llevar a una factura»): la primera línea, con la tela y el precio calculado.
          // T0689 · Desde un pedido: además, los metros; y si su nombre no trae ninguna tela de la lista, la línea con lo que dice.
          // T0739 · Desde un pedido con sus líneas: una por tela (linea0 es una lista).
          var lins0 = [].concat(linea0 || []).filter(function (x) { return x && (x.articulo || x.concepto); });
          if (lins0.length && cajaLin && porLineas()) {
            var r0 = cajaLin.querySelector('.eco-lin');
            lins0.forEach(function (l0, i) {
              if (i) filaLin({ CANTIDAD: '', UNIDAD: '' });
              var rr = i ? cajaLin.lastChild : r0, a0 = ARTS.length ? artPorCodigo(String(l0.articulo || '')) : null;
              if (!rr || !(a0 || l0.concepto)) return;
              if (a0) elegir(rr, a0);
              else { rr.querySelector('.eco-lin-c').value = String(l0.concepto); if (l0.unidad) rr.querySelector('.eco-lin-u').value = l0.unidad; crecer(rr); }
              if (l0.cantidad != null && l0.cantidad !== '') rr.querySelector('.eco-lin-n').value = String(l0.cantidad).replace('.', ',');
              if (l0.precio != null && !isNaN(l0.precio)) { var pi0 = rr.querySelector('.eco-lin-p'); pi0.value = String(l0.precio).replace('.', ','); leerPrecio(pi0); }
            });
            if (r0) {
              pintaLineas(); pintaTot();
              // Desde un pedido, la ventana se abre desde arriba (a quién y de qué pedido), no en los metros.
              if (deVenta) setTimeout(function () { var uv = vent.closest('.u-ventana'); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); if (uv) uv.scrollTop = 0; }, 0);
              // T0725 (R62): desde Calcular precio llega sin metros: el cursor, en «Cant.».
              else if (r0.querySelector('.eco-lin-n').value === '') setTimeout(function () { r0.querySelector('.eco-lin-n').focus(); }, 0);
            }
          }
          ['f-TIPO', 'f-TIPO_IVA'].forEach(function (id) { var e = vent.querySelector('#' + id); if (e) e.addEventListener('change', function () { refrescar(); pintaCliente(); }); });
          var sw = vent.querySelector('.eco-sw');
          if (sw) sw.onclick = function (e) { // T0673: el botón pone el tipo y avisa como lo hacía el desplegable
            var b = e.target.closest('[data-tipo]'), inp = vent.querySelector('#f-TIPO'); if (!b || !inp) return;
            inp.value = b.getAttribute('data-tipo');
            [].forEach.call(sw.querySelectorAll('[data-tipo]'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
            vent.querySelector('#f-tipo-nota').textContent = notaTipoFac(inp.value);
            inp.dispatchEvent(new Event('change'));
          };
          // En las líneas con el IVA incluido, cambiar el tipo de IVA deja lo escrito (lo que cobra) y cambia el sin IVA.
          vent.querySelector('#f-TIPO_IVA').addEventListener('change', function () {
            if (!cajaLin) return;
            Array.prototype.forEach.call(cajaLin.querySelectorAll('.eco-lin-p'), function (inp) { if (linIva(inp)) leerPrecio(inp); });
            pintaLineas(); pintaTot();
          });
          // T0653: otro cliente, otro «la última vez a este cliente» en cada línea.
          vent.querySelector('#f-ID_CONTRAPARTE').addEventListener('change', function () { pintaCliente(); if (porLineas()) pintaLineas(); });
          vent.querySelector('#f-BASE').addEventListener('input', refrescar);
          oirImporte('f', refrescar);
          oirRetDua('f', refrescar);
          oirFoto('f');
          /** Lo que hay en pantalla, para el documento (el número, el que tiene; una nueva aún no lo tiene). */
          function documento(numero) {
            var c = clienteElegido() || {};
            // T0733 (R94): la de un pedido lleva la fecha de su entrega (si es otra) y, si la forma de pago dice «a 30 días», el vencimiento.
            var vta = deVenta || (f && DS && f[DS] ? ix.des[String(f[DS])] || null : null), emp = empresaAhora() || {};
            return {
              factura: Object.assign({ ID: (f && f.ID) || '', NUMERO: numero || (f && f.NUMERO) || '', FECHA: val('f-FECHA'), TIPO_IVA: val('f-TIPO_IVA'), NOTAS: val('f-NOTAS'), ESTADO: val('f-ESTADO'), ARCHIVO_URL: val('f-ARCHIVO_URL') },
                fechasFactura(val('f-FECHA'), vta, emp.FORMA_PAGO || cfg.FACTURA_PAGO || '')),
              cliente: { NOMBRE: c.NOMBRE || '', NIF: datosCli ? val('f-NIF') : c.NIF || '', DIRECCION: datosCli ? val('f-DIRECCION') : c.DIRECCION || '' },
              lineas: lineasAhora(), base: baseEn('f') / 100, empresa: empresaAhora()
            };
          }
          /** Guarda la factura (y sus líneas y los datos del cliente) → promesa con { id, numero }. */
          function guardar() {
            if (cerrada) { // T0725 (R12): solo el estado y las notas
              return T.actualizar('FACTURAS', f.ID, cambios(f, { ESTADO: val('f-ESTADO'), NOTAS: val('f-NOTAS') })).then(function () { return { id: f.ID, numero: f.NUMERO, nueva: false }; });
            }
            var tipo = tipoAhora(), em = tipo === 'Emitida' && !f, lin = porLineas(), conNumero = tipo !== 'Emitida';
            var nv = { FECHA: val('f-FECHA'), ID_CONTRAPARTE: val('f-ID_CONTRAPARTE'), BASE: baseEn('f') / 100, TIPO_IVA: val('f-TIPO_IVA'),
              ESTADO: val('f-ESTADO'), ARCHIVO_URL: val('f-ARCHIVO_URL'), NOTAS: val('f-NOTAS') };
            Object.assign(nv, valoresRetDua('f', d.colsFac)); // T0733: vacías en una emitida (la caja no se ve)
            if (conNumero) nv.NUMERO = val('f-NUMERO');
            if (deVenta && tipo === 'Emitida') nv[DS] = deVenta.ID; // T0689: unida a su pedido
            var mal = [], ls = lin ? lineasAhora() : [];
            if (conNumero && !nv.NUMERO) mal.push('Falta el número.');
            if (!nv.FECHA) mal.push('Falta la fecha.');
            var fm = em ? fechaEmitidaMal(d.fac, cfg.SERIE_EMITIDAS || 'FE.', nv.FECHA) : ''; if (fm) mal.push(fm); // T0725 (R14)
            if (!nv.ID_CONTRAPARTE) mal.push('Falta ' + (tipo === 'Emitida' ? 'el cliente.' : 'el proveedor.'));
            if (lin && ls.some(function (l) { return !l.CONCEPTO; })) mal.push('Cada línea necesita qué se vende.');
            if (lin && ls.some(function (l) { return l.PRECIO === ''; })) mal.push('Cada línea necesita su precio.');
            var fcs = lin ? ls.map(faltaCantidad).filter(Boolean) : []; if (fcs.length) mal.push(fcs[0]); // T0725 (R62)
            if (!(cts(val('f-BASE')) > 0)) mal.push(lin ? 'Añade lo que se vende, con su precio.' : 'La base tiene que ser mayor que 0.');
            if (conNumero && nv.NUMERO && d.fac.some(function (x) { return x !== f && x.TIPO === tipo && String(x.NUMERO).trim() === nv.NUMERO; })) mal.push('Ya hay una ' + tipo.toLowerCase() + ' con el número ' + nv.NUMERO + '.');
            if (mal.length) { verError(mal); return null; }
            var cli = clienteElegido(), cliNuevo = datosCli && lin && cli ? { NIF: val('f-NIF'), DIRECCION: val('f-DIRECCION') } : pideNifProv() && cli ? { NIF: val('f-NIF').toUpperCase().replace(/\s+/g, '') } : null;
            if (cliNuevo && !cli._nuevo && Object.keys(cliNuevo).every(function (k) { return String(cli[k] || '') === cliNuevo[k]; })) cliNuevo = null;
            // T0646 · Una marca que aún no es contraparte se da de alta como Cliente, con su ficha, antes de la factura.
            var alta = cli && cli._nuevo ? T.crear('CONTRAPARTES', Object.assign({ NOMBRE: cli.NOMBRE, TIPO: 'Cliente' }, cliNuevo || {},
              (function () { var o = {}; o[String(CLI.campo || 'ID_MARCA')] = cli._ficha.ID; return o; })())).then(function (r) {
              var idc = (r && r.id) || (r && r.fila && r.fila.ID); if (!idc) throw new Error('No se ha podido dar de alta el cliente.');
              nv.ID_CONTRAPARTE = idc; cliNuevo = null; return idc;
            }) : Promise.resolve();
            return alta.then(function () {
              if (f) return T.actualizar('FACTURAS', f.ID, cambios(f, nv));
              if (em) return T.crear('FACTURAS', Object.assign({ TIPO: 'Emitida', NUMERO: '' }, nv), { fn: 'economiaEmitir' });
              return T.crear('FACTURAS', Object.assign({ TIPO: tipo }, nv));
            }).then(function (r) {
              var x = r && r.fila ? r.fila : null, id = (f && f.ID) || (r && r.id) || (x && x.ID), numero = (x && x.NUMERO) || nv.NUMERO || (f && f.NUMERO) || '';
              if (movId && id) T.actualizar('MOVIMIENTOS', movId, { ID_FACTURA: id }).then(function () {}, function () {});
              // T0689: los cobros de su pedido que aún no llevaban factura, ahora la llevan (y, si ya está cobrada, queda Pagada).
              if (id && nv[DS]) {
                var cobros = d.mov.filter(function (m) { return m.TIPO === 'Ingreso' && !m.ID_FACTURA && String(m[DS] || '') === String(nv[DS]); });
                Promise.all(cobros.map(function (m) { return T.actualizar('MOVIMIENTOS', m.ID, { ID_FACTURA: id }); })).then(function () { if (cobros.length) revisarFactura(id); }, function () {});
              }
              // T0726 (R63): lo que devuelve el motor va a la copia (sin volver a leer CONTRAPARTES).
              if (cliNuevo && cli.ID) ctx.llamar('economiaClienteDatos', [cli.ID, cliNuevo]).then(anotar(['CONTRAPARTES']), function (e) { ctx.aviso(String((e && e.message) || e)); });
              var res = { id: id, numero: numero, nueva: !f && em };
              // T0681: la factura no está guardada hasta que lo están sus líneas (reabierta antes, salía a medias).
              return lin && id ? guardarLineas(id, ls).then(function () { return res; }) : res;
            });
          }
          /**
           * Las líneas de la factura en FACTURA_LINEAS: las cambiadas se actualizan, las quitadas se borran y las nuevas se
           * crean todas en una llamada, en su orden (T0681: economiaLineasCrear; una a una, reabierta antes de acabar, la
           * factura salía a medias). Devuelve una promesa que acaba cuando está todo.
           */
          function guardarLineas(id, ls) {
            var antes = lineasDe(d.lin, id), vistas = {}, nuevas = [], va = [];
            ls.forEach(function (l) {
              var fila = { ID_FACTURA: id, CONCEPTO: l.CONCEPTO, DETALLE: l.DETALLE, CANTIDAD: l.CANTIDAD, UNIDAD: l.UNIDAD, PRECIO: l.PRECIO, IVA_INCLUIDO: !!l.IVA_INCLUIDO };
              var a = l.ID && antes.filter(function (x) { return String(x.ID) === String(l.ID); })[0];
              if (a) { vistas[a.ID] = 1; var c = cambios(a, fila); if (Object.keys(c).length) va.push(T.actualizar('FACTURA_LINEAS', a.ID, c)); }
              else nuevas.push(fila);
            });
            antes.forEach(function (a) { if (!vistas[a.ID]) va.push(T.borrar('FACTURA_LINEAS', a.ID)); });
            // T0726 (R63): las filas que devuelve van a la copia, sin volver a leer FACTURA_LINEAS del Excel.
            if (nuevas.length) va.push(ctx.llamar('economiaLineasCrear', [id, nuevas]).then(anotar(['FACTURA_LINEAS'])));
            return Promise.all(va.map(function (p) { return Promise.resolve(p).then(null, function (e) { ctx.aviso('Alguna línea no se ha guardado: ' + String((e && e.message) || e)); }); }));
          }
          vent.querySelector('#f-guardar').onclick = function () {
            // T0689 · Con foto (una recibida o un ticket): primero se sube y su enlace queda en «Enlace en Drive».
            var bf0 = this;
            if (tipoAhora() !== 'Emitida' && fotoDe('f')) {
              bf0.disabled = true; bf0.textContent = 'Subiendo la foto…';
              subirFoto('f', val('f-NUMERO') || tipoAhora(), val('f-FECHA')).then(function (url) {
                vent.querySelector('#f-ARCHIVO_URL').value = url; quitarFoto('f');
                bf0.disabled = false; bf0.textContent = 'Guardar factura'; bf0.click();
              }, function (e) { bf0.disabled = false; bf0.textContent = 'Guardar factura'; verError(['La foto no se ha subido: ' + String((e && e.message) || e).replace(/^[A-Z]+: /, '') + '. Prueba otra vez.']); });
              return;
            }
            var lin = porLineas(), p = guardar(); if (!p) return;
            // T0681: con líneas, la ventana espera a que estén guardadas (si se cerrara antes, se podría reabrir a medias).
            var bg = vent.querySelector('#f-guardar');
            if (lin) { bg.disabled = true; bg.textContent = 'Guardando…'; } else cerrar();
            p.then(function (r) {
              if (lin) cerrar();
              if (ctx.abierta()) ctx.aviso(r.nueva ? 'Factura ' + r.numero + ' guardada en el Excel.' : 'Factura guardada en el Excel.');
            }, function () { if (lin) { bg.disabled = false; bg.textContent = 'Guardar factura'; } });
          };
          /**
           * T0689 · «Hacer la factura y el PDF»: comprueba que no le falta nada, la guarda (el motor le pone el número), saca su
           * PDF y lo enlaza. Al acabar, la ventana dice que está hecha, con «Abrir el PDF» y «Copiar el enlace». Si el PDF falla,
           * la factura ya está guardada: lo dice y cómo sacarlo después.
           */
          var bh = vent.querySelector('#f-hacer');
          if (bh) bh.onclick = function () {
            function vuelta(msg) { bh.disabled = false; bh.textContent = 'Hacer la factura y el PDF'; if (msg) verError([msg]); }
            verError([]);
            // T0726 (R63): lo que falta se mira aquí (sin ir al motor); el motor lo vuelve a mirar al sacar el PDF. Así son tres
            // viajes: la factura (con su número), sus líneas y el PDF, que el motor deja enlazado en la misma llamada.
            var ft = faltanTexto(faltanFactura(documento('(se numera al guardar)')));
            if (ft) { vuelta('Antes de hacerla ' + ft + '.'); return; }
            var p = guardar(); if (!p) { vuelta(); return; }
            bh.disabled = true; bh.textContent = 'Haciendo la factura…';
            p.then(function (g) {
              var doc = documento(g.numero); doc.factura.ID = g.id; // T0725 (R06): el motor coge su PDF de la fila guardada
              bh.textContent = 'Sacando el PDF…';
              return ctx.llamar('economiaFacturaPdf', [doc]).then(function (x) { anotar(['FACTURAS'])(x); hecha(g, doc, x.url, ''); },
                function (e) { hecha(g, doc, '', String((e && e.message) || e).replace(/^[A-Z]+: /, '')); });
            }, function (e) { vuelta(String((e && e.message) || e).replace(/^[A-Z]+: /, '')); });
          };
          /** La factura ya hecha: su número, a quién y cuánto, y su PDF (o por qué no ha salido). */
          function hecha(g, doc, url, err) {
            var t = importe({ BASE: doc.base, TIPO_IVA: doc.factura.TIPO_IVA }).total, va = volverTras; volverTras = null;
            if (!velo.classList.contains('abierto')) { if (ctx.abierta()) ctx.aviso(url ? 'Factura ' + g.numero + ' hecha, con su PDF.' : 'Factura ' + g.numero + ' guardada, sin PDF: ' + err); return; }
            vent.innerHTML = '<div class="eco-hecha"><div class="eco-hecha-ic" aria-hidden="true">✓</div><h2 id="eco-vt">Factura ' + texto(g.numero) + ' hecha</h2>' +
              '<p>' + texto(doc.cliente.NOMBRE) + ' · ' + eur(t) + ' con IVA.</p>' +
              (url ? '<p class="u-nota">El PDF está guardado en tu carpeta de facturas de Drive.</p>'
                : '<p class="u-error">El PDF no ha salido: ' + texto(err) + '. La factura sí está guardada: ábrela en Facturas y toca «Guardar y sacar el PDF».</p>') +
              '<div class="n-botones eco-hecha-b">' + (url ? '<a class="u-btn u-btn-accion" href="' + texto(url) + '" target="_blank" rel="noopener" data-fuera>Abrir el PDF</a>' +
                '<button type="button" class="u-btn" id="h-copiar">Copiar el enlace</button>' : '') +
              (va ? '<button type="button" class="u-btn u-btn-texto" id="h-volver">Volver a ' + texto(va.titulo) + '</button>' : '<button type="button" class="u-btn u-btn-texto" data-cerrar>Cerrar</button>') + '</div></div>';
            var bc = vent.querySelector('#h-copiar');
            if (bc) bc.onclick = function () {
              var ok = function () { bc.textContent = 'Enlace copiado'; };
              try { navigator.clipboard.writeText(url).then(ok, function () { ctx.aviso(url); }); } catch (e) { ctx.aviso(url); }
            };
            var bv = vent.querySelector('#h-volver');
            if (bv) bv.onclick = function () { cerrar(); ctx.volver(); };
            var a = vent.querySelector('.eco-hecha-b a, .eco-hecha-b button'); if (a) a.focus();
            if (ctx.abierta()) ctx.aviso(url ? 'Factura ' + g.numero + ' hecha, con su PDF.' : 'Factura ' + g.numero + ' guardada, sin PDF.');
          }
          var bver = vent.querySelector('#f-ver');
          if (bver) bver.onclick = function () {
            // T0627: flotante, encima de la factura, y con la marca BORRADOR (la pone el motor): nunca se confunde con el PDF.
            var o = document.createElement('div');
            o.className = 'eco-previa';
            o.innerHTML = '<div class="eco-previa-caja" role="dialog" aria-modal="true" aria-label="Vista previa de la factura">' +
              '<div class="eco-previa-cab"><span><b>Vista previa</b> · borrador, sin guardar</span><button type="button" class="u-btn" data-previa-cerrar>Cerrar</button></div>' +
              '<div class="eco-previa-hoja"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div></div>';
            el.appendChild(o);
            function quitar() { o.remove(); document.removeEventListener('keydown', esc, true); }
            function esc(e) { if (e.key === 'Escape') { e.stopPropagation(); quitar(); } }
            document.addEventListener('keydown', esc, true);
            o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('[data-previa-cerrar]')) quitar(); });
            o.querySelector('[data-previa-cerrar]').focus();
            ctx.llamar('economiaFacturaVer', [documento(f ? '' : '(se numera al guardar)')]).then(function (r) {
              var hoja = o.querySelector('.eco-previa-hoja');
              hoja.innerHTML = '<iframe title="Factura en borrador"></iframe>';
              var ifr = hoja.querySelector('iframe');
              // La hoja A4 (794 px) se encoge para caber entera a lo ancho (en el móvil, como un PDF).
              ifr.onload = function () {
                var k = Math.min(1, (hoja.clientWidth - 16) / 794);
                ifr.style.width = Math.round(794 * k) + 'px';
                // T0725 (R05): una factura larga lleva más de una hoja: se ven todas, una debajo de otra.
                var nh = 1; try { nh = Math.max(1, ifr.contentDocument.querySelectorAll('.hoja').length); } catch (e) {}
                ifr.style.height = Math.round(1119 * nh * k) + 'px';
                try { ifr.contentDocument.documentElement.style.zoom = k; } catch (e) {}
              };
              ifr.srcdoc = r.html;
              verError(r.faltan && r.faltan.length ? ['Le ' + (r.faltan.length > 1 ? 'faltan ' : 'falta ') + listaY(r.faltan) + ': sale en rojo en el borrador.'] : []);
            }, function (e) { quitar(); verError([String((e && e.message) || e)]); });
          };
          var bpdf = vent.querySelector('#f-pdf');
          if (bpdf) bpdf.onclick = function () {
            var doc = documento();
            // T0726 (R63): lo que falta, aquí; el PDF lo enlaza el motor en la misma llamada.
            var ft = faltanTexto(faltanFactura(doc));
            if (ft) { verError(['Antes de sacar el PDF ' + ft + '.']); return; }
            var p = guardar(); if (!p) return;
            bpdf.disabled = true; bpdf.textContent = 'Sacando el PDF…';
            // T0681: la ventana se cierra cuando la factura y sus líneas están guardadas (antes, se podía reabrir a medias).
            p.then(function () {
              cerrar();
              ctx.aviso('Sacando el PDF de la factura ' + numFac(f) + '…');
              return ctx.llamar('economiaFacturaPdf', [doc]);
            }).then(function (x) {
              anotar(['FACTURAS'])(x);
              if (ctx.abierta()) ctx.aviso('PDF de la factura ' + numFac(f) + ' guardado en Drive y enlazado.');
            }, function (e) { bpdf.disabled = false; bpdf.textContent = 'Guardar y sacar el PDF'; if (ctx.abierta()) ctx.aviso(String((e && e.message) || e).replace(/^[A-Z]+: /, '')); });
          };
          var ba = vent.querySelector('#f-apuntar');
          if (ba) ba.onclick = function () {
            // T0733: con la retención y el IVA de aduana de la factura; si ya se ha pagado una parte, en proporción a lo que falta.
            var t = importe(f), falta = t.total - pagado, k = t.total ? falta / t.total : 1, base = pagado ? Math.round(cts(f.BASE) * k) : null;
            var pre = { TIPO: f.TIPO === 'Emitida' ? 'Ingreso' : 'Gasto', CONCEPTO: (f.TIPO === 'Emitida' ? 'Cobro ' : 'Pago ') + numFac(f), ID_CONTRAPARTE: f.ID_CONTRAPARTE,
              ID_FACTURA: f.ID, TIPO_IVA: f.TIPO_IVA, BASE: base === null ? f.BASE : base / 100, RETENCION: f.RETENCION || '',
              IVA_IMPORTACION: t.dua ? Math.round(t.dua * (pagado ? k : 1)) / 100 : '' };
            formMov(null, pre);
          };
        });
      }

      /* ---------- T0689 · la factura de un pedido, en un sitio ---------- */

      /** La factura de una venta: emitida, de hoy, a su marca, con la línea que sale de lo que dice la venta. Si ya tiene, esa. */
      function facturarVenta(v) {
        if (!v) return;
        var ya = facturaDeVenta(d.fac, DS, v.ID);
        if (ya) { formFac(ya); return; }
        var arts = ART ? articulos(ART, { filas: function (t) { return T.filas(t) || []; }, fila: filaDe }) : [];
        var pre = { TIPO: 'Emitida', FECHA: hoy(), ID_CONTRAPARTE: v.ID_CONTRAPARTE || '' };
        pre[DS] = v.ID;
        formFac(null, pre, null, LV ? lineasFacturaVenta(v, d.lv, arts) : lineaDeVenta(v, arts)); // T0739: con sus líneas, una por tela
      }
      /** Desde la ficha de una marca (idCtr: su contraparte, o «marca:M-214» si aún no lo es): si tiene pedidos sin factura,
       *  primero de cuál (sale ya con lo que pidió); si no, una factura a su nombre. */
      function facturarA(idCtr) {
        var vs = facPorVenta() && !/^marca:/.test(idCtr) ? ventasSinFactura(d.des, d.fac, DS, idCtr) : [];
        var pre = { TIPO: 'Emitida', FECHA: hoy(), ID_CONTRAPARTE: idCtr };
        if (!vs.length) { formFac(null, pre); return; }
        var html = '<h2 id="eco-vt">¿De qué pedido es la factura?</h2><p class="u-nota">Factura a ' + texto(nombre('ctr', idCtr)) + '. Con su pedido, sale ya con lo que pidió.</p>' +
          '<div class="eco-elige" role="radiogroup" aria-label="Pedido">' + vs.map(function (v, i) {
            var imp = v.IMPORTE === '' || v.IMPORTE == null ? 'sin precio cerrado' : eur0(cts(v.IMPORTE)) + ' sin IVA';
            return '<label class="eco-elige-o"><input type="radio" name="eco-ped" value="' + texto(v.ID) + '"' + (i ? '' : ' checked') + '><span><b>' + texto(v.NOMBRE || v.ID) + '</b>' +
              '<span class="u-nota">Pedido el ' + texto(fecha(v.FECHA)) + ' · ' + texto(imp) + '</span></span></label>';
          }).join('') + '<label class="eco-elige-o eco-elige-sin"><input type="radio" name="eco-ped" value=""><span>Una factura sin pedido</span></label></div>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="p-seguir">Seguir</button><button type="button" class="u-btn u-btn-texto" data-cerrar>Cancelar</button></div>';
        ventana(html, function () {
          vent.querySelector('#p-seguir').onclick = function () {
            var r = vent.querySelector('input[name="eco-ped"]:checked'), id = r ? r.value : '';
            if (id && ix.des[id]) facturarVenta(ix.des[id]); else formFac(null, pre);
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
              vent.querySelector('#p-tot').innerHTML = '<b>' + texto(c.NOMBRE) + ': ' + eur0(antes) + ' → ' + eur0(n) + '.</b> Beneficio previsto' + (presPorPeriodo(d) ? ' ' + texto(enPeriodo(nomPeriodo(), 'de')) : '') + ': ' + eur0(b0) + ' → ' + eur0(b1) + '. Queda apuntado en el Excel con tu nombre.';
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

      /* ---------- T0628 · Ventas ---------- */

      /** T0726 (R26) · Dónde se apuntan los pagos y cobros: aquí, en Movimientos, o (en Pedidos, sin esa pestaña) en Economía. */
      function dondeMov() { return pest.indexOf('MOVIMIENTOS') >= 0 ? 'Movimientos' : 'Economía › Movimientos'; }
      function minimo() { return MIN ? minimoDe(MIN, T.filas(MIN.tabla)) : minimoDe(cfg.MARGEN_MINIMO); }
      function pc(x) { return Math.round(x * 100) + ' %'; }
      function deMas(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
      /** Lo que ha pagado en una venta, por categoría: «Telas 2.760 € + Transporte 450 €». */
      function costesTxt(x) { return x.costes.map(function (c) { return texto(c.nombre) + ' ' + eur0(c.base); }).join(' + '); }
      /** El paso de una venta en palabras: «En camino desde el 04/11/2026 · te debe 2.700 € de 5.400 €». */
      function pasoTxt(x) {
        var h = '<b>' + texto(paso(x.paso)) + '</b>' + (x.fechaPaso ? (x.paso === 'En camino' ? ' desde el ' : ' el ') + texto(fecha(x.fechaPaso)) : '');
        if (x.cobrada) return h;
        if (x.adelantado) return h + ' · aún sin pagar al taller';
        if (x.debe === null) return h + ' · sin precio cerrado';
        if (!x.cobrado) return h + ' · te debe los ' + eur0(x.importe) + (x.anticipo ? ', aún sin el anticipo del ' + pc(x.anticipo) : ', sin anticipo');
        return h + ' · te debe ' + eur0(x.debe) + ' de ' + eur0(x.importe);
      }
      function kpi(id, titulo, valor, sub, grande) {
        var ab = S.ven.des === id;
        return '<button type="button" class="eco-kpi' + (grande ? ' eco-grande' : '') + '" data-desv="' + id + '" aria-expanded="' + ab + '">' +
          '<b>' + titulo + '</b><span class="eco-val">' + valor + '</span><span class="eco-sub">' + sub + '</span><span class="eco-ver">De dónde sale ›</span></button>';
      }

      function htmlVentas() {
        if (S.ven.id) { var una = ix.des[S.ven.id]; if (una) return htmlVenta(una); S.ven.id = ''; }
        var V0 = ventas(d, d.des, DS, minimo()), m = V0.minimo;
        // T0726 (R26): un solo texto de entrada (con AYUDA, el suyo; si no, este).
        var h = cfg.AYUDA ? '' : '<p class="u-nota">' + V('Cad{a} {venta}, desde que la marca te {lo} pide hasta que te {lo} paga: cuánto te juegas, cuánto ganas y cuánto te falta para recuperar lo invertido. Sin IVA.') + '</p>';
        var nueva = '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-accion="nuevaventa">' + V('Nuev{a} {venta}') + '</button></div>';
        if (!V0.todas.length) {
          return h + '<p class="u-vacio">' + V('Aún no hay {ventas}. Cuando una marca te haga un pedido, créa{lo} con «Nuev{a} {venta}»; al apuntar sus pagos y cobros en ' + dondeMov() + ', elige {esa} {venta}.') + '</p>' + nueva;
        }
        var k3 = V0.falta > 0 ? kpi('recuperar', 'Te falta por recuperar', eur0(V0.falta), 'De ' + eur0(V0.invertido) + ' invertidos · llevas el ' + pc(V0.recuperado) + barra(V0.recuperado)) :
          V0.invertido > 0 ? kpi('recuperar', 'Lo invertido', 'Recuperado', 'Has recuperado los ' + eur0(V0.invertido) + ' invertidos' + (V0.ganado > V0.invertido ? ' y llevas ' + eur0(V0.ganado - V0.invertido) + ' de más' : '')) :
          kpi('recuperar', 'Lo invertido', '0 €', 'Aún no hay gastos de la empresa');
        h += '<div class="eco-kpis eco-kpis-ven">' + // T0726 (R26): las cifras, a 24 px
          kpi('juego', 'Tu dinero en juego', eur0(V0.enJuego), V0.enJuego ? V('Lo que has pagado en {ventas} que la marca aún no te ha pagado') + (V0.conJuego > 1 ? ', en ' + V0.conJuego + ' ' + V('{ventas}') : '') + '. Si una no pagara, es lo que perderías.' :
            'Ahora no tienes dinero tuyo pendiente de cobrar.', true) +
          kpi('ganado', V('Has ganado con {los} {ventas}'), eur0(V0.ganado), V0.cobradas.length ? 'En ' + deMas(V0.cobradas.length, V('{venta} cobrad{a}'), V('{ventas} cobrad{a}s')) +
            (V0.bajos ? ' · <span class="u-mal">' + V0.bajos + ' por debajo de tu mínimo del ' + pc(m) + '</span>' : '') : V('Aún no has cobrado {ninguna} {venta} enter{a}')) +
          k3 + '</div>';
        if (S.ven.des) h += htmlDesVentas(V0, S.ven.des);
        if (V0.abiertas.length) {
          h += '<h2 class="n-grupo">Sin cobrar todavía</h2><p class="u-nota">Te deben ' + eur0(V0.deben) + (V0.abiertas.length > 1 ? ' entre las ' + V0.abiertas.length : '') +
            (V0.sinImporte ? ' (' + deMas(V0.sinImporte, 'sin precio cerrado', 'sin precio cerrado') + ')' : '') + '. «En juego» es lo que has pagado tú y aún no has recuperado.</p>' +
            '<table class="u-tabla eco-tabla"><thead><tr><th>' + V('{Venta}') + '</th><th class="num">En juego</th></tr></thead><tbody>' + V0.abiertas.map(function (x) {
              return '<tr tabindex="0" data-venta="' + texto(x.v.ID) + '"><td class="u-tabla-t">' + texto(nombreVenta(x.v)) + chip(x.v) + '<span class="eco-paso">' + pasoTxt(x) + '</span></td>' +
                '<td class="num"><span class="u-cifra">' + eur0(x.enJuego) + '</span>' + (!x.enJuego ? '<div class="u-nota">' + (x.pagado ? 'Cubierto con lo que te han pagado' : 'Aún no has pagado nada') + '</div>' : '') + '</td></tr>';
            }).join('') + '</tbody></table>';
        }
        h += nueva;
        if (V0.cobradas.length) {
          h += '<h2 class="n-grupo">' + V('Cobrad{a}s') + '</h2>' + (V0.dias !== null ? '<p class="u-nota">Tardas ' + (V0.dias === 1 ? '1 día' : 'unos ' + V0.dias + ' días') + ' en cobrar desde que pagas al taller.</p>' : '') +
            '<table class="u-tabla eco-tabla"><thead><tr><th>' + V('{Venta}') + '</th><th class="num">Has ganado</th></tr></thead><tbody>' + V0.cobradas.map(function (x) {
              return '<tr tabindex="0" data-venta="' + texto(x.v.ID) + '"><td class="u-tabla-t">' + texto(nombreVenta(x.v)) + '<span class="eco-paso">' + pasoTxt(x) + '</span></td>' +
                '<td class="num"><span class="u-cifra' + (x.ganado < 0 ? ' u-mal' : x.bajo ? '' : ' eco-bien') + '">' + eur0(x.ganado) + '</span>' +
                (m && x.margen !== null ? '<div class="u-nota' + (x.bajo ? ' u-mal' : '') + '">' + pc(x.margen) + (x.bajo ? ': por debajo del ' + pc(m) : '') + '</div>' : '') + '</td></tr>';
            }).join('') + '</tbody></table>';
        }
        return h + '<p class="u-nota">' + V('Toca {una} {venta} para ver sus cuentas y sus movimientos.') + '</p>';
      }

      /** De dónde sale cada cifra de arriba: un resumen corto, con la cuenta. */
      function htmlDesVentas(V0, k) {
        var m = V0.minimo, h = '<div class="eco-card eco-des" id="eco-des"><div class="eco-des-cab"><h2 class="n-grupo">';
        var cerrarB = '</h2><button type="button" class="u-btn u-btn-texto" data-accion="cerrardes">Cerrar</button></div>';
        if (k === 'juego') {
          var xs = V0.abiertas.filter(function (x) { return x.pagado || x.cobrado; });
          h += 'Tu dinero en juego: ' + eur0(V0.enJuego) + cerrarB + '<p class="u-nota">' + V('{Venta} a {venta}') + ': lo que has pagado tú (taller, envío, aduanas…) menos lo que te ha pagado ya la marca.</p>';
          if (!xs.length) return h + '<p class="u-vacio">' + V('En {los} {ventas} sin cobrar aún no has pagado nada ni te han pagado nada.') + '</p></div>';
          return h + '<table class="u-tabla eco-tabla"><thead><tr><th>' + V('{Venta}') + '</th><th class="num u-solo-ancho">Has pagado</th><th class="num u-solo-ancho">Te han pagado</th><th class="num">En juego</th></tr></thead><tbody>' +
            xs.map(function (x) {
              var det = x.pagado ? costesTxt(x) : 'Aún no has pagado nada';
              return '<tr><td class="u-tabla-t">' + texto(nombreVenta(x.v)) + '<div class="u-nota">' + det + '<span class="u-solo-movil"> · te han pagado ' + eur0(x.cobrado) + '</span></div></td>' +
                '<td class="num u-solo-ancho">' + eur0(x.pagado) + '</td><td class="num u-solo-ancho">' + eur0(x.cobrado) + '</td><td class="num">' + eur0(x.enJuego) + '</td></tr>';
            }).join('') + '<tr class="eco-total"><td class="u-tabla-t">Total</td><td class="num u-solo-ancho"></td><td class="num u-solo-ancho"></td><td class="num">' + eur0(V0.enJuego) + '</td></tr></tbody></table>' +
            '<p class="u-nota">' + V('{Una} {venta} en {la} que la marca te ha pagado tanto o más de lo que has gastado cuenta 0: ahí no arriesgas nada. {Los} {ventas} ya cobrad{a}s no cuentan.') + '</p></div>';
        }
        if (k === 'ganado') {
          h += V('Has ganado con {los} {ventas}') + ': ' + eur0(V0.ganado) + cerrarB + '<p class="u-nota">' + V('Solo {los} {ventas} cobrad{a}s') + ': lo que te ha pagado la marca menos lo que te ha costado.</p>';
          if (!V0.cobradas.length) return h + '<p class="u-vacio">' + V('Cuando una marca te pague {una} {venta} enter{a}, sale aquí lo que te ha dejado.') + '</p></div>';
          var bajo = V0.cobradas.filter(function (x) { return x.bajo; })[0];
          return h + '<table class="u-tabla eco-tabla"><thead><tr><th>' + V('{Venta}') + '</th><th class="num u-solo-ancho">Te pagó</th><th class="num u-solo-ancho">Te costó</th><th class="num">Ganaste</th></tr></thead><tbody>' +
            V0.cobradas.map(function (x) {
              return '<tr><td class="u-tabla-t">' + texto(nombreVenta(x.v)) + '<div class="u-nota">' + (x.pagado ? 'Costó ' + costesTxt(x) : 'Sin gastos apuntados') +
                '<span class="u-solo-movil"> · te pagó ' + eur0(x.cobrado) + '</span></div></td><td class="num u-solo-ancho">' + eur0(x.cobrado) + '</td><td class="num u-solo-ancho">' + eur0(x.pagado) + '</td>' +
                '<td class="num">' + eur0(x.ganado) + (m && x.margen !== null ? '<div class="u-nota' + (x.bajo ? ' u-mal' : '') + '">' + pc(x.margen) + '</div>' : '') + '</td></tr>';
            }).join('') + '<tr class="eco-total"><td class="u-tabla-t">Total</td><td class="num u-solo-ancho">' + eur0(V0.cobradas.reduce(function (s, x) { return s + x.cobrado; }, 0)) + '</td>' +
            '<td class="num u-solo-ancho">' + eur0(V0.cobradas.reduce(function (s, x) { return s + x.pagado; }, 0)) + '</td><td class="num">' + eur0(V0.ganado) + '</td></tr></tbody></table>' +
            (m ? '<p class="u-nota"><b>El %</b> es lo que ganas sobre lo que te cuesta' + (bajo ? ': en ' + texto(nombreVenta(bajo.v)) + ', ' + eur0(bajo.ganado) + ' sobre ' + eur0(bajo.pagado) + ' es un ' + pc(bajo.margen) + '.' : '.') +
              ' <b>Tu mínimo es el ' + pc(m) + '</b>' + (bajo ? '; para llegar, ' + V('{esa} {venta}') + ' tendría que haber sido de ' + eur(bajo.paraMinimo) + ' en lugar de ' + eur(bajo.cobrado) + '.' : ', y todas llegan.') + '</p>' :
              '<p class="u-nota">' + V('Lo que ganas en cada {venta}') + ' es lo que te paga la marca menos lo que te cuesta (taller, envío, aduanas…).</p>') + '</div>';
        }
        h += (V0.falta > 0 ? 'Te falta por recuperar: ' + eur0(V0.falta) : 'Lo invertido: ' + eur0(V0.invertido)) + cerrarB +
          '<p class="u-nota"><b>Lo invertido</b> son los gastos que no son de ' + V('{ninguna} {venta}: lo que cuesta montar y mover el negocio. Se recupera con lo que ganas en {los} {ventas}.') + '</p>';
        if (!V0.porCategoria.length) return h + '<p class="u-vacio">' + V('Aún no hay gastos de la empresa: todos los gastos apuntados son de {alguna} {venta}.') + '</p></div>';
        return h + '<table class="u-tabla eco-tabla"><tbody>' + V0.porCategoria.map(function (c) {
          return '<tr><td class="u-tabla-t">' + texto(c.nombre) + '</td><td class="num">' + eur0(c.base) + '</td></tr>';
        }).join('') + '<tr class="eco-total"><td class="u-tabla-t">Has invertido</td><td class="num">' + eur0(V0.invertido) + '</td></tr>' +
          '<tr><td class="u-tabla-t">' + V('Has ganado con {los} {ventas}') + '</td><td class="num">− ' + eur0(V0.ganado) + '</td></tr>' +
          '<tr class="eco-total"><td class="u-tabla-t">Te falta por recuperar</td><td class="num">' + eur0(V0.falta) + '</td></tr></tbody></table>' +
          '<p class="u-nota">El dinero que pones en la empresa (el capital) no cuenta aquí: no es un gasto, es con lo que pagas todo esto. Desde el principio, no solo este año.</p></div>';
      }

      /** Una venta por dentro: dónde está, sus cuentas y sus movimientos. */
      function htmlVenta(v) {
        var m = minimo(), x = venta(d, v, DS, m), c = v.ID_CONTRAPARTE ? nombre('ctr', v.ID_CONTRAPARTE) : 'La marca';
        var sub = x.cobrada ? 'Te pagó ' + eur0(x.cobrado) + ' y te costó ' + eur0(x.pagado) + (m && x.margen !== null ? ': un ' + pc(x.margen) + ' sobre lo que te costó.' : '.') +
            (x.bajo ? ' <b>Por debajo de tu mínimo del ' + pc(m) + '</b>: para llegar, ' + eur(x.paraMinimo) + '.' : '') :
          x.adelantado ? texto(c) + ' te ha pagado los ' + eur0(x.cobrado) + ' por adelantado y aún no has pagado al taller: lo que ganas sale cuando lo pagues.' :
          // T0726 (R66): antes del primer pago al taller no se dice lo que ganará (sería el precio entero, sin la tela).
          !x.pagado ? (x.debe === null ? 'Aún sin precio cerrado: apunta lo que paga la marca en «' + V('Editar {la} {venta}') + '». ' : 'Te debe ' + (x.cobrado ? 'otros ' : '') + eur0(x.debe) + '; ') + 'aún no has pagado el taller.' :
          'Has pagado ' + eur0(x.pagado) + ' y ' + texto(c) + ' te ha pagado ' + eur0(x.cobrado) + '. ' +
            (x.debe === null ? 'Aún sin precio cerrado: apunta lo que paga la marca en «' + V('Editar {la} {venta}') + '».' :
              'Te debe ' + (x.cobrado ? 'otros ' : '') + eur0(x.debe) + ': cuando pague, habrás ganado ' + eur0(x.previsto) + ', si no hay más gastos.');
        var h = (S.ven.volver ? '<button type="button" class="u-btn u-btn-texto eco-volver" data-accion="volverficha">‹ Volver a ' + texto(S.ven.volver.titulo) + '</button>' : '<button type="button" class="u-btn u-btn-texto eco-volver" data-accion="todasventas">‹ ' + V('Tod{a}s {los} {ventas}') + '</button>') +
          '<div class="eco-kpis eco-kpis-ven"><div class="eco-kpi eco-grande"><b>' + texto(nombreVenta(v)) + '</b><span class="eco-val">' +
          (x.cobrada ? eur0(x.ganado) + ' ganados' : x.adelantado ? paso('Cobrada por adelantado') : eur0(x.enJuego) + ' en juego') + '</span><span class="eco-sub">' + sub + '</span></div></div>@@FACTURA@@';
        // T0739 · Lo que lleva: cada tela con sus metros, su taller y cómo va su envío (como su pestaña Pedidos).
        if (LV && !v._nueva) {
          var lvs = lineasVenta(d.lv, v.ID);
          h += '<h2 class="n-grupo">' + V('Qué lleva {la} {venta}') + '</h2>' + (lvs.length ? '<ul class="eco-lvs">' + lvs.map(function (l) {
            var env = envioLinea(l), quien = l.ID_PROVEEDOR ? nombreTaller(l.ID_PROVEEDOR) : '';
            return '<li><button type="button" class="eco-lv" data-linea="' + texto(l.ID) + '"><span class="eco-lv-t"><b>' + texto(nombreTela(l.ARTICULO)) + '</b>' +
              '<span class="u-nota">' + texto([metrosDe(l), quien ? 'taller ' + quien : 'sin taller'].join(' · ')) + '</span></span>' +
              '<span class="eco-lv-e' + (env === 'Por salir' ? ' eco-lv-por' : '') + '">' + texto(env) + '</span></button></li>';
          }).join('') + '</ul>' : '<p class="u-vacio">' + V('Aún no has apuntado las telas de {este} {venta}.') + '</p>') +
            '<p><button type="button" class="u-btn u-btn-texto" data-accion="nuevalinea">+ Añadir línea</button></p>';
        }
        // T0689 · Su factura (la emitida que la elige), como un paso más y, abajo, para abrirla o hacerla.
        var fv = facPorVenta() ? facturaDeVenta(d.fac, DS, v.ID) : null;
        var pasos = [[paso('Pedida'), v.FECHA]];
        if (facPorVenta()) pasos.push([fv ? paso('Facturada') + ' · ' + numFac(fv) : paso('Facturada'), fv ? fv.FECHA : '']);
        if (x.anticipo) pasos.push(['Anticipo cobrado · ' + pc(x.anticipo), x.primerCobro]);
        pasos.push([paso('Pagada al taller'), x.primerPago], ['En camino', v.FECHA_ENVIO], [paso('Entregada'), v.FECHA_ENTREGA], [paso('Cobrada'), x.cobro]);
        h += '<h2 class="n-grupo">Dónde está</h2><ol class="eco-pasos">' + pasos.map(function (p) {
          return '<li' + (p[1] ? ' class="eco-ya"' : '') + '><span>' + texto(p[0]) + '</span><span>' + texto(fecha(p[1])) + '</span></li>';
        }).join('') + '</ol>';
        var gan = x.cobrada ? x.ganado : x.previsto;
        h += '<h2 class="n-grupo">Las cuentas</h2><table class="u-tabla eco-tabla"><tbody>' +
          '<tr><td class="u-tabla-t">Lo que paga la marca<div class="u-nota">' + (x.importe === null ? 'Sin precio cerrado' : 'Te ha pagado ' + eur0(x.cobrado)) + '</div></td><td class="num">' + (x.importe === null ? '—' : eur0(x.importe)) + '</td></tr>' +
          x.costes.map(function (k) { return '<tr><td class="u-tabla-t">' + texto(k.nombre) + '</td><td class="num">− ' + eur0(k.base) + '</td></tr>'; }).join('') +
          // T0726 (R66): sin nada pagado al taller, lo que ganas aún no se sabe (no es el precio entero).
          (x.adelantado || (!x.cobrada && !x.pagado) ? '<tr class="eco-total"><td class="u-tabla-t">Lo que ganas<div class="u-nota">Sale cuando pagues al taller: lo que ' + (x.adelantado ? 'te pagó' : 'te pague') + ' menos lo que te cueste</div></td><td class="num">—</td></tr>' :
           x.importe === null ? '' : '<tr class="eco-total"><td class="u-tabla-t">' + (x.cobrada ? 'Has ganado' : 'Ganarás, si no hay más gastos') +
            (m && x.pagado ? '<div class="u-nota">' + pc(gan / x.pagado) + ' sobre lo que te cuesta</div>' : '') + '</td><td class="num"><span class="u-cifra' +
            (gan < 0 ? ' u-mal' : ' eco-bien') + '">' + eur0(gan) + '</span></td></tr>') +
          '</tbody></table><p class="u-nota">Sin IVA.' + (x.anticipo ? ' Anticipo pactado: ' + pc(x.anticipo) + (x.importe !== null ? ' (' + eur0(Math.round(x.importe * x.anticipo)) + ')' : '') + '.' : '') + '</p>';
        h += '<h2 class="n-grupo">Sus movimientos</h2>' + (x.movs.length ? '<table class="u-tabla eco-tabla"><thead><tr><th>Movimiento</th><th class="num u-solo-ancho">Cuenta</th><th class="num">Importe</th></tr></thead><tbody>' +
          x.movs.slice().reverse().map(function (mv) { return filaMov(mv); }).join('') + '</tbody></table>' :
          '<p class="u-vacio">' + V('Todavía no hay pagos ni cobros de {esta} {venta}. Al apuntarlos, elige {esta} {venta}.') + '</p>');
        if (v.NOTAS) h += '<div class="eco-dl">' + dato('Notas', texto(v.NOTAS)) + '</div>';
        // T0689 · Sin factura, «Hacer la factura» es lo primero (aquí, o en la sección que las hace: FACTURAR); con ella, su PDF.
        var hacer = facPorVenta() && !fv && (LINEAS || FACTURAR) && !v._nueva;
        var bFac = !facPorVenta() ? '' : fv ? (fv.ARCHIVO_URL ? '<a class="u-btn" href="' + texto(fv.ARCHIVO_URL) + '" target="_blank" rel="noopener" data-fuera>Abrir la factura ' + texto(numFac(fv)) + ' ↗</a>' : '')
          : hacer ? (LINEAS ? '<button type="button" class="u-btn u-btn-accion" data-accion="facturaventa">Hacer la factura</button>'
            : '<a class="u-btn u-btn-accion" href="' + texto(hrefFacturaVenta(v)) + '" data-sx="' + texto(FACTURAR.toUpperCase()) + '">Hacer la factura</a>') : '';
        // Arriba, junto a la cifra (lo primero que se hace con un pedido sin factura); abajo, lo de siempre.
        h = h.replace('@@FACTURA@@', bFac ? '<div class="n-botones eco-ven-fac">' + bFac + '</div>' : fv && !fv.ARCHIVO_URL ? '<p class="u-nota">Su factura, ' + texto(numFac(fv)) + ', aún no tiene PDF: sácalo desde Economía › Facturas.</p>' : '');
        return h + '<div class="n-botones"><button type="button" class="u-btn' + (hacer ? '' : ' u-btn-accion') + '" data-accion="movventa">Apuntar un pago o un cobro</button>' +
          '<button type="button" class="u-btn" data-accion="editarventa">' + V('Editar {la} {venta}') + '</button></div>';
      }

      /* ---------- T0739 · las líneas de una venta ---------- */
      function artsVenta() { return ARTV ? articulos(ARTV, { filas: function (t) { return T.filas(t) || []; }, fila: filaDe }) : []; }
      /** Una tela como se dice: «BOR-004-01 · Bordado · Arena» (su código, si ya no está en la lista). */
      function nombreTela(cod) {
        cod = String(cod || '').trim();
        var a = artsVenta().filter(function (x) { return x.codigo === cod; })[0];
        if (a) return a.nombre && a.nombre !== cod ? cod + ' · ' + a.nombre : cod;
        return cod || 'Sin tela';
      }
      function nombreTaller(id) { var t = ARTV ? (ARTV._refs || {}) : {}, f = null; Object.keys(t).forEach(function (k) { if (!f && /PROVEEDOR/.test(k)) f = filaDe(k, id); }); return f ? String(f.NOMBRE || id) : String(id); }
      function metrosDe(l) { return l.CANTIDAD === '' || l.CANTIDAD == null ? 'sin metros' : String(cantidad(l.CANTIDAD)).replace('.', ',') + ' m'; }
      /** Los talleres que se pueden elegir: los de las telas de la lista, por nombre (y el que ya tenga la línea). */
      function talleres(arts, sel) {
        var vistos = {}, xs = [];
        arts.map(function (a) { return a.taller; }).concat(sel ? [sel] : []).forEach(function (id) {
          if (!id || vistos[id]) return; vistos[id] = 1; xs.push([id, nombreTaller(id)]);
        });
        return xs.sort(function (a, b) { return String(a[1]).localeCompare(String(b[1]), 'es'); });
      }
      /** Añadir (l null) o cambiar una línea: la tela, los metros, el taller y su envío. */
      function formLinea(v, l) {
        var arts = artsVenta(), x = l || {}, cod = String(x.ARTICULO || '');
        var trs = {}; d.lv.forEach(function (y) { var t = String(y.TRANSPORTISTA || '').trim(); if (t) trs[t] = 1; });
        var html = '<h2 id="eco-vt">' + (l ? 'Cambiar la línea' : 'Añadir una línea') + '</h2><p class="u-nota">' + texto(nombreVenta(v)) + '</p><div class="u-campos">' +
          campo('Tela', '<input type="text" id="l-ART" list="l-arts" value="' + texto(cod) + '" placeholder="Busca por código o nombre" autocomplete="off" data-foco>' +
            '<datalist id="l-arts">' + arts.map(function (a) { return '<option value="' + texto(a.codigo) + '">' + texto(a.nombre) + '</option>'; }).join('') + '</datalist>', 'u-ancho') +
          campo('Metros', '<input type="text" inputmode="decimal" id="l-CANTIDAD" value="' + texto(x.CANTIDAD === '' || x.CANTIDAD == null ? '' : String(x.CANTIDAD).replace('.', ',')) + '" placeholder="Si aún no se sabe, vacío">') +
          campo('Taller', '<select id="l-ID_PROVEEDOR">' + opciones(talleres(arts, x.ID_PROVEEDOR), x.ID_PROVEEDOR, 'Sin taller') + '</select>') +
          campo('Transportista <span class="eco-opc">(al salir)</span>', '<input type="text" id="l-TRANSPORTISTA" list="l-trs" value="' + texto(x.TRANSPORTISTA) + '" maxlength="60" placeholder="DHL, FedEx, tu transitario…" autocomplete="off">' +
            '<datalist id="l-trs">' + Object.keys(trs).sort().map(function (t) { return '<option value="' + texto(t) + '"></option>'; }).join('') + '</datalist>') +
          campo('Nº de seguimiento <span class="eco-opc">(al salir)</span>', '<input type="text" id="l-SEGUIMIENTO" value="' + texto(x.SEGUIMIENTO) + '" maxlength="80" autocomplete="off">') +
          '</div><p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="l-guardar">' + (l ? 'Guardar' : 'Añadir') + '</button>' +
          (l ? '<button type="button" class="u-btn" id="l-quitar">Quitar la línea</button>' : '') +
          '<button type="button" class="u-btn" data-cerrar>Cancelar</button></div>';
        ventana(html, function () {
          var inA = vent.querySelector('#l-ART'), selT = vent.querySelector('#l-ID_PROVEEDOR');
          function artEscrito() { var c = val('l-ART').split('·')[0].trim().toUpperCase(); return arts.filter(function (a) { return a.codigo.toUpperCase() === c; })[0] || null; }
          // Al elegir la tela, su taller (si es otra tela que la de antes; el que se haya puesto a mano en esta, no se toca).
          inA.addEventListener('change', function () {
            var a = artEscrito(); if (!a) return;
            inA.value = a.codigo;
            if (a.taller && (!l || a.codigo !== cod)) {
              if (!selT.querySelector('option[value="' + a.taller.replace(/"/g, '') + '"]')) selT.insertAdjacentHTML('beforeend', opciones([[a.taller, nombreTaller(a.taller)]], ''));
              selT.value = a.taller;
            }
          });
          vent.querySelector('#l-guardar').onclick = function () {
            var a = artEscrito(), tm = val('l-CANTIDAD'), mal = [];
            var nl = { ARTICULO: a ? a.codigo : '', CANTIDAD: tm === '' ? '' : cantidad(tm), ID_PROVEEDOR: val('l-ID_PROVEEDOR'), TRANSPORTISTA: val('l-TRANSPORTISTA'), SEGUIMIENTO: val('l-SEGUIMIENTO') };
            if (!a) mal.push(val('l-ART') ? 'Esa tela no está en ' + (ARTV && ARTV.titulo ? ARTV.titulo : 'la lista') + ': elígela de la lista.' : 'Falta la tela.');
            if (tm !== '' && !(cantidad(tm) > 0)) mal.push('Los metros tienen que ser un número mayor que 0 (o vacío).');
            if (mal.length) { verError(mal); return; }
            cerrar();
            if (l) T.actualizar('VENTA_LINEAS', l.ID, cambios(l, nl)).then(function () { if (ctx.abierta()) ctx.aviso('Línea guardada en el Excel.'); }, function () {});
            else T.crear('VENTA_LINEAS', Object.assign({ ID_VENTA: v.ID }, nl)).then(function () { if (ctx.abierta()) ctx.aviso('Línea añadida.'); }, function () {});
          };
          var bq = vent.querySelector('#l-quitar');
          if (bq) bq.onclick = function () {
            if (bq.getAttribute('data-seguro') !== '1') { bq.setAttribute('data-seguro', '1'); bq.textContent = '¿Seguro? Quitarla'; return; }
            cerrar();
            T.borrar('VENTA_LINEAS', l.ID).then(function () { if (ctx.abierta()) ctx.aviso('Línea quitada.'); }, function () {});
          };
        });
      }

      /**
       * T0725 (R04) · Las marcas de una venta. Con CLIENTES, como en una factura emitida (clientesFactura): las contrapartes
       * Cliente y las marcas que aún no lo son (las de su lista arriba y las de prospección aparte), que se dan de alta al
       * guardar. Sin CLIENTES, las contrapartes Cliente; nunca un proveedor o una herramienta (antes, sin ningún Cliente,
       * salían todas: Canva y Google Workspace).
       */
      function opcVenta(sel) {
        function orden(a, b) { return String(a[1]).localeCompare(String(b[1]), 'es'); }
        if (!CLIV) return opciones(d.ctr.filter(function (c) { return c.TIPO === 'Cliente' || String(c.ID) === String(sel); }).map(function (c) { return [c.ID, c.NOMBRE]; }).sort(orden), sel, 'Elige la marca');
        var x = clientesFactura(d.ctr, T.filas(CLIV.tabla) || [], CLIV, sel);
        return '<option value="">Elige la marca</option>' + opciones(x.clientes, sel) +
          (x.otros.length ? '<optgroup label="' + texto(CLIV.otros || 'En prospección') + '">' + opciones(x.otros, sel) + '</optgroup>' : '');
      }
      /** T0725 · La contraparte de la marca elegida: si es una ficha que aún no es contraparte («marca:M-…»), la da de alta
       *  como Cliente con su ficha → promesa con su ID. */
      function contraparteDe(v0) {
        if (!(CLIV && /^marca:/.test(String(v0 || '')))) return Promise.resolve(v0);
        var m = filaDe(CLIV.tabla, String(v0).slice(6));
        if (!m) return Promise.reject(new Error('No encuentro esa marca: actualiza y vuelve a probar.'));
        var ya = d.ctr.filter(function (c) { return String(c[String(CLIV.campo || 'ID_MARCA')] || '') === String(m.ID); })[0];
        if (ya) return Promise.resolve(ya.ID);
        var o = { NOMBRE: m.NOMBRE, TIPO: 'Cliente' }; o[String(CLIV.campo || 'ID_MARCA')] = m.ID;
        return T.crear('CONTRAPARTES', o).then(function (r) {
          var idc = (r && r.id) || (r && r.fila && r.fila.ID); if (!idc) throw new Error('No se ha podido dar de alta la marca.');
          return idc;
        });
      }
      /** T0739 · La fila de ANTICIPO_MARCA (NECESIDADES) de la marca elegida: una contraparte con su ficha o «marca:M-…». */
      function fichaAnticipo(v0) {
        v0 = String(v0 || '');
        var campoM = String(CLIV.campo || 'ID_MARCA'), c = /^marca:/.test(v0) ? null : ix.ctr[v0];
        var idm = /^marca:/.test(v0) ? v0.slice(6) : c ? String(c[campoM] || '') : '';
        if (!idm) return null;
        var col = String(ANT.marca || campoM);
        return (T.filas(ANT.tabla) || []).filter(function (r) { return String(r[col] || '') === idm; })[0] || null;
      }
      /** Nueva venta (v null) o cambiar una: la marca, qué es, lo que paga, el anticipo y las fechas. */
      function formVenta(v) {
        var cols = T.columnas ? T.columnas(VEN) : [], hay = function (c) { return !cols.length || cols.indexOf(c) >= 0; };
        var x = v || { FECHA: hoy() };
        var ant = fraccion(x.ANTICIPO);
        var html = '<h2 id="eco-vt">' + V(v ? 'Editar {la} {venta}' : 'Nuev{a} {venta}') + '</h2><div class="u-campos">' +
          (hay('ID_CONTRAPARTE') ? campo('Marca', '<select id="v-ID_CONTRAPARTE">' + opcVenta(x.ID_CONTRAPARTE) + '</select>') : '') +
          campo('Qué es', '<input type="text" id="v-NOMBRE" value="' + texto(x.NOMBRE) + '" maxlength="120" placeholder="Por ejemplo: Celosía arena · 300 m" data-foco>', 'u-ancho') +
          campo('Fecha del pedido', '<input type="date" id="v-FECHA" value="' + texto(x.FECHA) + '">') +
          (hay('IMPORTE') ? campo('Lo que paga la marca, sin IVA', '<input type="text" inputmode="decimal" id="v-IMPORTE" value="' + texto(x.IMPORTE === '' || x.IMPORTE == null ? '' : String(x.IMPORTE).replace('.', ',')) + '" placeholder="Si aún no está cerrado, vacío">') : '') +
          (hay('ANTICIPO') ? campo('Anticipo (%)', '<input type="text" inputmode="decimal" id="v-ANTICIPO" value="' + (ant ? String(Math.round(ant * 1000) / 10).replace('.', ',') : '') + '" placeholder="Sin anticipo, vacío"><span class="u-nota" id="v-ant-nota" hidden>Lo pone su ficha: acepta anticipo. Puedes cambiarlo.</span>') : '') +
          (hay('FECHA_ENVIO') ? campo('Salieron las telas <span class="eco-opc">(en camino)</span>', '<input type="date" id="v-FECHA_ENVIO" value="' + texto(x.FECHA_ENVIO) + '">') : '') +
          (hay('FECHA_ENTREGA') ? campo('Las recibió la marca', '<input type="date" id="v-FECHA_ENTREGA" value="' + texto(x.FECHA_ENTREGA) + '">') : '') +
          (hay('NOTAS') ? campo('Notas <span class="eco-opc">(opcional)</span>', '<textarea id="v-NOTAS" rows="2" placeholder="Condiciones, plazos, lo que hayáis acordado…">' + texto(x.NOTAS) + '</textarea>', 'u-ancho') : '') +
          '</div><p class="u-nota">' + V('Los pagos (taller, envío, aduanas) y los cobros (anticipo, el resto) se apuntan en ' + dondeMov() + ', eligiendo {esta} {venta}.') + '</p>' +
          '<p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="v-guardar">' + (v ? 'Guardar' : V('Crear {la} {venta}')) + '</button>' +
          '<button type="button" class="u-btn" data-cerrar>Cancelar</button></div>';
        ventana(html, function () {
          // T0739 · En un pedido nuevo, al elegir la marca, el anticipo que dice su ficha (si no se ha escrito otro).
          var selM = vent.querySelector('#v-ID_CONTRAPARTE'), inAnt = vent.querySelector('#v-ANTICIPO'), notaAnt = vent.querySelector('#v-ant-nota'), puesto = '';
          if (ANT && !v && selM && inAnt) selM.addEventListener('change', function () {
            var p = anticipoMarca(ANT, fichaAnticipo(selM.value), function (t, id) { var f = filaDe(t, id); return f ? f.NOMBRE : ''; });
            if (inAnt.value.trim() !== '' && inAnt.value !== puesto) return; // lo ha escrito ella: no se toca
            puesto = p ? String(Math.round(p * 1000) / 10).replace('.', ',') : '';
            inAnt.value = puesto; notaAnt.hidden = !p;
          });
          if (inAnt && notaAnt) inAnt.addEventListener('input', function () { notaAnt.hidden = true; });
          vent.querySelector('#v-guardar').onclick = function () {
            var nv = { NOMBRE: val('v-NOMBRE'), FECHA: val('v-FECHA') }, mal = [];
            if (hay('ID_CONTRAPARTE')) nv.ID_CONTRAPARTE = val('v-ID_CONTRAPARTE');
            if (hay('IMPORTE')) {
              var ti = val('v-IMPORTE');
              nv.IMPORTE = ti === '' ? '' : cts(ti) / 100;
              if (ti !== '' && !(cts(ti) > 0)) mal.push('Lo que paga la marca tiene que ser un importe mayor que 0 (o vacío).');
            }
            if (hay('ANTICIPO')) {
              var ta = val('v-ANTICIPO').replace('%', '').trim(), na = parseFloat(ta.replace(',', '.'));
              if (ta !== '' && !(na >= 0 && na <= 100)) mal.push('El anticipo es un porcentaje entre 0 y 100.');
              nv.ANTICIPO = ta === '' || !na ? '' : Math.round(na * 10) / 1000;
            }
            ['FECHA_ENVIO', 'FECHA_ENTREGA', 'NOTAS'].forEach(function (k) { if (hay(k)) nv[k] = val('v-' + k); });
            if (!nv.NOMBRE) mal.push('Falta qué es (por ejemplo, la tela y los metros).');
            if (!nv.FECHA) mal.push('Falta la fecha del pedido.');
            if (nv.FECHA_ENTREGA && nv.FECHA_ENVIO && nv.FECHA_ENTREGA < nv.FECHA_ENVIO) mal.push('La entrega no puede ser antes de que salieran las telas.');
            if (mal.length) { verError(mal); return; }
            var bg = vent.querySelector('#v-guardar'); bg.disabled = true;
            contraparteDe(nv.ID_CONTRAPARTE).then(function (idc) {
              if (hay('ID_CONTRAPARTE')) nv.ID_CONTRAPARTE = idc;
              cerrar();
              if (v) {
                T.actualizar(VEN, v.ID, cambios(v, nv)).then(function () { if (ctx.abierta()) ctx.aviso(V('{Venta} guardad{a} en el Excel.')); }, function () {});
              } else {
                T.crear(VEN, nv).then(function (r) { if (r && r.id) { S.ven.id = String(r.id); pintar(); arriba(); } if (ctx.abierta()) ctx.aviso(V('{Venta} cread{a}. Apunta sus pagos y cobros eligiéndo{lo}.')); }, function () {});
              }
            }, function (e) { bg.disabled = false; verError([String((e && e.message) || e).replace(/^[A-Z]+: /, '')]); });
          };
        });
      }

      /* ---------- eventos ---------- */

      /** Arriba del todo: en el móvil se desplaza el cuerpo de la página, no la ventana (como en el marco del núcleo). */
      function arriba() { window.scrollTo(0, 0); document.body.scrollTop = 0; }
      function irA(tab) { S.tab = tab; guardado(CLAVE + 'tab', tab); pintar(); arriba(); }
      function verMovs(f, desde) { S.mov = Object.assign(movVacio(), f, { desde: desde || '' }); irA('MOVIMIENTOS'); }
      el.addEventListener('click', function (e) {
        var t = e.target;
        var b = t.closest('[data-tab]'); if (b) { if (b.getAttribute('data-tab') === 'MOVIMIENTOS') S.mov.desde = ''; if (b.getAttribute('data-tab') === 'CAJA') S.caja.cue = ''; if (b.getAttribute('data-tab') === 'VENTAS') { S.ven.id = ''; S.ven.volver = null; } irA(b.getAttribute('data-tab')); return; }
        if (t.closest('[data-fuera]')) return; // un enlace a Drive se abre en otra pestaña, sin abrir la fila
        if (t.closest('[data-cerrar]')) { cerrar(); return; }
        if (velo.contains(t)) return; // lo de dentro de una ventana lo lleva su ventana
        var g = t.closest('[data-grupo]');
        if (g) { var id = g.getAttribute('data-grupo'); S.ab[id] = !S.ab[id]; g.setAttribute('aria-expanded', S.ab[id]); g.nextElementSibling.hidden = !S.ab[id]; return; }
        var vc = t.closest('[data-vercat]');
        if (vc) { if (pest.indexOf('MOVIMIENTOS') >= 0) verMovs({ cat: vc.getAttribute('data-vercat') }, S.tab); return; }
        var ab = t.closest('[data-abrir]');
        if (ab) { var dt = el.querySelector('#eco-' + ab.getAttribute('data-abrir')); if (dt) { dt.open = true; S.ab[ab.getAttribute('data-abrir')] = true; dt.scrollIntoView({ block: 'start' }); } return; }
        var dv = t.closest('[data-desv]'); // T0628: de dónde sale una cifra de Ventas
        if (dv) { var kd = dv.getAttribute('data-desv'); S.ven.des = S.ven.des === kd ? '' : kd; pintar(); return; }
        var tb = t.closest('[data-trim]'); // T0733: el trimestre de «Para tu gestoría»
        if (tb) { S.gest.q = { ano: trimestreVisto().ano, t: Number(tb.getAttribute('data-trim')) }; pintar(); return; }
        var ir = t.closest('button[data-ir]');
        if (ir) {
          var ti = /^(\d{4})-(\d)$/.exec(ir.getAttribute('data-trim-ir') || ''); if (ti) S.gest.q = { ano: ti[1], t: Number(ti[2]) }; // T0733: el del Resumen
          if (pest.indexOf(ir.getAttribute('data-ir')) >= 0) irA(ir.getAttribute('data-ir')); return;
        }
        var bl = t.closest('[data-linea]'); // T0739: una línea de la venta abierta
        if (bl) { var vb = ix.des[S.ven.id], lb = d.lv.filter(function (y) { return String(y.ID) === bl.getAttribute('data-linea'); })[0]; if (vb && lb && !lb._nueva) formLinea(vb, lb); return; }
        var a = t.closest('[data-accion]');
        if (a) {
          var ac = a.getAttribute('data-accion');
          if (ac === 'apuntar') formMov(null);
          else if (ac === 'factura') formFac(null);
          else if (ac === 'filtrarfac') filtrosFac();
          else if (ac === 'filtrarmov') filtrosMov();
          else if (ac === 'quitarfmov') { S.mov = Object.assign(movVacio(), { q: S.mov.q, desde: S.mov.desde }); pintar(); }
          else if (ac === 'quitarffac') { S.fac = { tipo: '', estado: '' }; pintar(); }
          else if (ac === 'empresa') formEmpresa();
          else if (ac === 'vermas') { S.mov.ver += VER; pintar(); }
          else if (ac === 'vermascaja') { S.caja.ver = (S.caja.ver || VER) + VER; pintar(); }
          else if (ac === 'ceros') { S.ceros = !S.ceros; pintar(); }
          else if (ac === 'ceroscaja') { S.caja.ceros = !S.caja.ceros; pintar(); }
          else if (ac === 'todascuentas') { S.caja.cue = ''; pintar(); arriba(); }
          else if (ac === 'todasdes') { S.des = ''; pintar(); }
          else if (ac === 'volver') { var dd = S.mov.desde; S.mov.desde = ''; irA(dd || 'RESUMEN'); }
          else if (ac === 'cruzados') verMovs({ cruz: true }, S.tab);
          else if (ac === 'sinfac') verMovs({ tipo: 'Gasto', sinFac: true }, S.tab);
          else if (ac === 'nuevaventa') formVenta(null);
          else if (ac === 'nuevalinea') { var vl = ix.des[S.ven.id]; if (vl && LV) formLinea(vl, null); } // T0739
          else if (ac === 'editarventa') { var ve = ix.des[S.ven.id]; if (ve && !ve._nueva) formVenta(ve); }
          else if (ac === 'movventa') { var pv = {}; pv[DS] = S.ven.id; formMov(null, pv); }
          else if (ac === 'facturaventa') { volverTras = null; facturarVenta(ix.des[S.ven.id]); } // T0689
          else if (ac === 'todasventas') { S.ven.id = ''; pintar(); arriba(); }
          else if (ac === 'volverficha') { S.ven.volver = null; ctx.volver(); }
          else if (ac === 'cerrardes') { S.ven.des = ''; pintar(); }
          else if (ac === 'gestcsv') descargarGestoria(); // T0733
          else if (ac === 'gestcopiar') copiarGestoria();
          return;
        }
        var tr = t.closest('tr[tabindex]');
        if (!tr) return;
        if (tr.hasAttribute('data-mov')) { var m = T.fila('MOVIMIENTOS', tr.getAttribute('data-mov')); if (m && !m._nueva) fichaMov(m); }
        else if (tr.hasAttribute('data-fac')) { var f = T.fila('FACTURAS', tr.getAttribute('data-fac')); if (f && !f._nueva) formFac(f); }
        else if (tr.hasAttribute('data-precat')) formPresCat(tr.getAttribute('data-precat'));
        else if (tr.hasAttribute('data-vercat')) { if (pest.indexOf('MOVIMIENTOS') >= 0) verMovs({ cat: tr.getAttribute('data-vercat') }, S.tab); }
        else if (tr.hasAttribute('data-verdes')) { S.des = tr.getAttribute('data-verdes'); pintar(); arriba(); }
        else if (tr.hasAttribute('data-venta')) { S.ven.id = tr.getAttribute('data-venta'); pintar(); arriba(); }
        else if (tr.hasAttribute('data-cuenta')) { S.caja.cue = tr.getAttribute('data-cuenta'); S.caja.ver = VER; pintar(); arriba(); }
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
        if (t.id === 'eco-gano') { S.gest.q = { ano: t.value, t: trimestreVisto().t }; pintar(); return; }
        if (t.hasAttribute('data-filtro')) { var k = t.getAttribute('data-filtro'); S.mov[k] = t.type === 'checkbox' ? t.checked : t.value; if (k === 'tipo') S.mov.cat = ''; S.mov.ver = VER; pintar(); return; }
      });
      var tq = 0;
      el.addEventListener('input', function (e) {
        if (e.target.id !== 'eco-q') return;
        S.mov.q = e.target.value; clearTimeout(tq);
        tq = setTimeout(function () { S.mov.ver = VER; S.foco = true; pintar(); }, 200);
      });

      ctx.alCambiar(function (t) { if (tablas.indexOf(t) >= 0) pintar(); });
      /**
       * T0653 · ?factura=nueva&articulo=BOR-004-01&precio=28&cliente=ID_MARCA:M-002 (desde «Calcular precio» de Telas): abre una
       * factura emitida nueva con esa línea y, si hay una contraparte con esa columna en ese valor, a su nombre. Se quita de la
       * dirección para que volver a entrar no la abra otra vez.
       */
      function desdeEnlace() {
        var u; try { u = new URL(location.href); } catch (e) { return; }
        if (u.searchParams.get('factura') !== 'nueva') return;
        var art = u.searchParams.get('articulo') || '', pr = aNum(u.searchParams.get('precio')), cli = String(u.searchParams.get('cliente') || ''), i = cli.indexOf(':');
        var ped = String(u.searchParams.get('pedido') || '');
        ['factura', 'articulo', 'precio', 'cliente', 'pedido'].forEach(function (k) { u.searchParams.delete(k); });
        try { history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) {}
        if (!LINEAS) return;
        // T0689 · Al acabar la factura, «Volver a …» lleva a donde se estaba (el pedido, la ficha de la marca).
        volverTras = ctx.desde || null;
        // T0689 · ?pedido=VEN0001 (desde Pedidos): la factura de esa venta, ya rellena.
        if (ped) { var v = ix.des[ped]; if (v) facturarVenta(v); else ctx.aviso('Ese pedido ya no está.'); return; }
        var col = i > 0 ? cli.slice(0, i) : '', valor = cli.slice(i + 1);
        var ctr = col ? (T.filas('CONTRAPARTES') || []).filter(function (c) { return c[col] != null && String(c[col]) === valor; })[0] : null;
        // T0689 · Desde la ficha de una marca (?cliente=ID_MARCA:M-214, sin artículo): primero de qué pedido, si tiene sin factura.
        // Una marca que aún no es contraparte se elige como tal y se da de alta al guardar (T0646).
        var id = ctr ? ctr.ID : CLI && col === String(CLI.campo || 'ID_MARCA') && valor && filaDe(CLI.tabla, valor) ? 'marca:' + valor : '';
        if (!art && id) { facturarA(id); return; }
        formFac(null, { TIPO: 'Emitida', FECHA: hoy(), ID_CONTRAPARTE: id }, null, { articulo: art, precio: pr });
      }

      ctx.tablas.leer(tablas).then(function () { S.leido = true; pintar(); desdeEnlace(); }, function (e) {
        cont.innerHTML = '<p class="u-error">No se han podido leer las cuentas.</p><p class="u-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Vuelve a abrir la sección para probar otra vez.</p>';
      });
      this._cerrar = cerrar;
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); },
    /**
     * T0692 · Las ventas de cada uno con quien se trata, para otra sección (la ficha de una marca en Clientes) sin abrir esta:
     * lee lo que hace falta con las tablas de quien ha entrado (el permiso es el de esta sección) y da ventasPorQuien() por
     * «campo» de CONTRAPARTES (ID_MARCA). null si esta sección no tiene ventas (sin VENTAS o sin su DESGLOSE).
     */
    ventasDe: function (T, cfg, campo) {
      cfg = cfg || {};
      var R = cfg._refs || {}, DS = String(cfg.DESGLOSE || ''), VEN = cfg.VENTAS && DS && R.DESGLOSE === cfg.VENTAS ? String(cfg.VENTAS) : '';
      if (!VEN || !campo) return Promise.resolve(null);
      var MIN = cfg.MARGEN_MINIMO && typeof cfg.MARGEN_MINIMO === 'object' && cfg.MARGEN_MINIMO.tabla ? cfg.MARGEN_MINIMO : null;
      return T.leer(['MOVIMIENTOS', 'CATEGORIAS', 'CONTRAPARTES', VEN].concat(MIN ? [MIN.tabla] : [])).then(function () {
        var m = MIN ? minimoDe(MIN, T.filas(MIN.tabla)) : minimoDe(cfg.MARGEN_MINIMO);
        return ventasPorQuien({ cfg: cfg, mov: T.filas('MOVIMIENTOS') || [], cat: T.filas('CATEGORIAS') || [] }, T.filas(VEN) || [], DS, m, T.filas('CONTRAPARTES') || [], campo, hoy());
      });
    }
  });
})();
