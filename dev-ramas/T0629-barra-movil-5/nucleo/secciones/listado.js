/*
 * Sección Listado base del núcleo · UTILO_CORE 5.0 (T0599) · motor/modulos/listado de utilo-apps
 *
 * Un listado con ficha y avisos que sirve para cualquier tabla de cualquier cliente, sin una pantalla a medida por tabla:
 * cada sección del menú (Seguimiento, Clientes, Proveedores…) es esta misma con su configuración (config.json ·
 * nucleo.secciones.<nombre>, con «modulo»: «listado»): qué tabla, qué columnas, la ficha, las vistas y los avisos. Lee y
 * escribe con la capa de tablas (ctx.tablas), con un Sheet o con Supabase: la sección no lo sabe.
 *
 *   Vistas     pestañas arriba: filtros guardados con su orden, sus grupos (por valor o por plazo) y lo que ocultan, o un
 *              tablero por columnas como el Kanban. Una vista «para enseñar a un cliente» (cliente: true) oculta siempre
 *              los campos privados (el proveedor), también en la ficha.
 *   Avisos     lo que no se puede escapar (fecha pasada, vence en unos días, sin hacer): arriba de la lista, en cada fila
 *              y en la ficha. Tocar uno filtra la lista.
 *   Código     cada fila con su identificador delante (T0012), como las tareas de Utilo; la ficha lo copia con sus datos
 *              («Copiar para Claude») para trabajar esa fila en una sesión de Claude.
 *   Ficha      sus apartados, en orden; lo relacionado de otra tabla (el seguimiento de un cliente), que lleva a su
 *              sección con la ficha abierta y «Volver a …»; y, si se puede, editar y añadir.
 *   Personalizar  quien está en PERSONALIZAN (y quien administra) cambia el orden del menú, qué vistas se ven y en qué
 *              orden, y qué avisos están encendidos y con cuántos días. Se guarda en la tabla PREFERENCIAS (para todos) o,
 *              sin ella, en este dispositivo.
 * Reglas que cumple sola: un campo calculado con «precio» nunca enseña un importe sin su envío; los datos de PROHIBIDO
 * (contraseñas, números de cuenta, DNI/NIE) no se guardan y, si ya están en la tabla, se enseñan tapados.
 * Claves de la configuración: docs/SECCION_LISTADO.md.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  var DIA = 86400000;
  function vacio(v) { return v === '' || v === null || v === undefined; }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function lista(v) { return v === undefined || v === null ? [] : (Array.isArray(v) ? v : [v]); }
  function dos(n) { return (n < 10 ? '0' : '') + n; }

  // Palabras de los nombres de columna que se escriben con tilde (como en Ajustes).
  var PALABRAS = { area: 'área', telefono: 'teléfono', direccion: 'dirección', proximo: 'próximo', via: 'vía', codigo: 'código',
    numero: 'número', tecnica: 'técnica', region: 'región', categoria: 'categoría', descripcion: 'descripción', prospeccion: 'prospección',
    quien: 'quién', que: 'qué', algodon: 'algodón', poliester: 'poliéster', acrilico: 'acrílico', minimo: 'mínimo', espana: 'España', n: 'nº', id: 'ID', email: 'email', eur: '€', inr: '₹' };
  /** «PROXIMO_PASO» → «Próximo paso». */
  function titulo(n) {
    var t = String(n || '').replace(/^ID_(?=.)/, '').toLowerCase().split('_').map(function (p) { return PALABRAS[p] || p; }).join(' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /** Una fecha de la tabla (Date, «2026-11-17», «17/11/2026», con o sin hora) a medianoche de ese día; null si no lo es. */
  function aFecha(v) {
    if (vacio(v)) return null;
    if (v instanceof Date) return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
    var s = String(v).trim(), m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
    if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
    return null;
  }
  /** Días de hoy a esa fecha (negativo, ya pasó); null si no es una fecha. */
  function diasHasta(v, hoy) {
    var f = aFecha(v), h = aFecha(hoy);
    return f && h ? Math.round((f - h) / DIA) : null;
  }
  /** Un número de la tabla: 12.5, «12,5», «1.234,50 €», «50 %» (0,5). NaN si no lo es. */
  function aNumero(v) {
    if (typeof v === 'number') return v;
    if (vacio(v)) return NaN;
    var s = String(v).trim(), pc = /%$/.test(s);
    s = s.replace(/[€₹%\s]/g, '');
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    var n = /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
    return pc ? n / 100 : n;
  }

  /* ---------- condiciones (filtros de las vistas y avisos) ----------
   * Una lista de condiciones que se cumplen todas: { campo, es | no | vacio | contiene | desde | hasta | mayor | menor }.
   * desde y hasta son días contados desde hoy (incluidos) en una columna de fecha: { campo: 'FECHA', hasta: -1 } es «ya
   * pasó». En un aviso, «dias» (o «-dias») en vez de un número usa los días del aviso, que se cambian al personalizar. */
  function deDias(x, dias) { return x === 'dias' ? dias : (x === '-dias' ? -dias : x); }
  function cumple(f, conds, o) {
    o = o || {};
    return lista(conds).every(function (c) {
      var v = f[c.campo];
      if (c.o) return c.o.some(function (g) { return cumple(f, g, o); });
      if (c.es !== undefined && lista(c.es).map(norm).indexOf(norm(v)) < 0) return false;
      if (c.no !== undefined && lista(c.no).map(norm).indexOf(norm(v)) >= 0) return false;
      if (c.vacio !== undefined && vacio(v) !== !!c.vacio) return false;
      if (c.contiene !== undefined && norm(v).indexOf(norm(c.contiene)) < 0) return false;
      if (c.desde !== undefined || c.hasta !== undefined) {
        var d = diasHasta(v, o.hoy);
        if (d === null) return false;
        var de = deDias(c.desde, o.dias), ha = deDias(c.hasta, o.dias);
        if (de !== undefined && de !== null && d < de) return false;
        if (ha !== undefined && ha !== null && d > ha) return false;
      }
      if (c.mayor !== undefined || c.menor !== undefined) {
        var n = aNumero(v);
        if (isNaN(n)) return false;
        if (c.mayor !== undefined && !(n > c.mayor)) return false;
        if (c.menor !== undefined && !(n < c.menor)) return false;
      }
      return true;
    });
  }

  /* ---------- campos calculados ----------
   * Una expresión en JSON: un número, el nombre de una columna de la fila, «$NOMBRE» (de VALORES) o [op, …] con op
   * +, -, *, /, «o» (el primero que no está vacío) y «redondear» ([«redondear», x, decimales]). Un hueco da NaN. */
  function calcular(expr, f, valores) {
    if (typeof expr === 'number') return expr;
    if (typeof expr === 'string') {
      var v = expr.charAt(0) === '$' ? (valores || {})[expr.slice(1)] : f[expr];
      return aNumero(v);
    }
    if (!Array.isArray(expr) || !expr.length) return NaN;
    var op = expr[0], a = expr.slice(1);
    if (op === 'o') {
      for (var i = 0; i < a.length; i++) { var x = calcular(a[i], f, valores); if (!isNaN(x)) return x; }
      return NaN;
    }
    if (op === 'redondear') { var r = calcular(a[0], f, valores), p = Math.pow(10, a[1] || 0); return Math.round(r * p) / p; }
    var ns = a.map(function (e) { return calcular(e, f, valores); });
    if (ns.some(isNaN)) return NaN;
    if (op === '+') return ns.reduce(function (s, n) { return s + n; }, 0);
    if (op === '*') return ns.reduce(function (s, n) { return s * n; }, 1);
    if (op === '-') return ns.length === 1 ? -ns[0] : ns.slice(1).reduce(function (s, n) { return s - n; }, ns[0]);
    if (op === '/') return ns[1] === 0 ? NaN : ns[0] / ns[1];
    return NaN;
  }
  /** Las columnas y valores ($…) que usa una expresión. */
  function usa(expr, acc) {
    acc = acc || [];
    if (typeof expr === 'string') acc.push(expr);
    else if (Array.isArray(expr)) expr.slice(1).forEach(function (e) { usa(e, acc); });
    return acc;
  }
  /** Los VALORES de la configuración: un número fijo o { tabla, fila, columna } leído de esa tabla (filaDe(tabla, id)). */
  function valoresDe(cfgValores, filaDe) {
    var r = {};
    Object.keys(cfgValores || {}).forEach(function (k) {
      var v = cfgValores[k];
      if (v && typeof v === 'object') { var f = filaDe ? filaDe(v.tabla, v.fila) : null; r[k] = f ? f[v.columna || 'VALOR'] : ''; }
      else r[k] = v;
    });
    return r;
  }

  /* ---------- datos que no se guardan (PROHIBIDO) ---------- */
  var LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
  function dniBueno(num, letra) { return LETRAS_DNI.charAt(Number(num) % 23) === String(letra).toUpperCase(); }
  function ibanBueno(s) {
    var t = s.replace(/[\s-]/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(t)) return false;
    var r = (t.slice(4) + t.slice(0, 4)).replace(/[A-Z]/g, function (c) { return String(c.charCodeAt(0) - 55); }), m = 0;
    for (var i = 0; i < r.length; i++) m = (m * 10 + +r.charAt(i)) % 97;
    return m === 1;
  }
  // Cada dato: las expresiones que lo encuentran en un texto y, si hace falta, la comprobación que descarta los falsos (la
  // letra del DNI, el dígito de control del IBAN), para no tapar un número de pedido.
  var DETECTORES = {
    CONTRASENA: [{ re: /\b(contrase(ñ|n)as?|password|passwd|pwd|clave de acceso|clave|pin)\s*[:=]\s*\S+/gi }],
    CUENTA: [
      { re: /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]{4}){2,7}(?:[ -]?[A-Z0-9]{1,4})?\b/gi, ok: function (m) { return ibanBueno(m[0]); } },
      { re: /\b\d{4}[ -]?\d{4}[ -]?\d{2}[ -]?\d{10}\b/g }
    ],
    DNI: [
      { re: /\b(\d{8})[ -]?([A-Z])\b/gi, ok: function (m) { return dniBueno(m[1], m[2]); } },
      { re: /\b([XYZ])[ -]?(\d{7})[ -]?([A-Z])\b/gi, ok: function (m) { return dniBueno('XYZ'.indexOf(m[1].toUpperCase()) + m[2], m[3]); } }
    ]
  };
  /** Los trozos de un texto con datos de esos tipos: [{ k, desde, hasta }]. */
  function trozos(s, que) {
    var r = [];
    lista(que).forEach(function (k) {
      (DETECTORES[k] || []).forEach(function (d) {
        var m, re = new RegExp(d.re.source, d.re.flags);
        while ((m = re.exec(s))) { if (!d.ok || d.ok(m)) r.push({ k: k, desde: m.index, hasta: m.index + m[0].length }); if (!m[0].length) re.lastIndex++; }
      });
    });
    return r;
  }
  var NOMBRES_PROHIBIDOS = {
    CONTRASENA: /(^|_)(PASSWORD|PASS|CONTRASENA|CONTRASEÑA|CLAVE_ACCESO|PIN)(_|$)/,
    CUENTA: /(^|_)(IBAN|CUENTA_BANCARIA|NUM_CUENTA|N_CUENTA|CCC|CUENTA)(_|$)/,
    DNI: /(^|_)(DNI|NIE|PASAPORTE)(_|$)/
  };
  var QUE_ES = { CONTRASENA: 'contraseñas', CUENTA: 'números de cuenta', DNI: 'DNI o NIE' };
  var QUE_ES_UNO = { CONTRASENA: 'contraseña', CUENTA: 'número de cuenta', DNI: 'DNI o NIE' };
  /** Qué datos prohibidos lleva un texto ([] si ninguno). */
  function prohibido(v, que) {
    if (vacio(v)) return [];
    var ks = trozos(String(v), que).map(function (t) { return t.k; });
    return lista(que).filter(function (k) { return ks.indexOf(k) >= 0; });
  }
  /** El texto con esos datos tapados («[número de cuenta: no se guarda]»), para enseñar lo demás de una nota. */
  function tapar(v, que) {
    var s = String(v), ts = trozos(s, que).sort(function (a, b) { return b.desde - a.desde; }), ult = Infinity;
    ts.forEach(function (t) {
      if (t.hasta > ult) return; // se pisa con uno ya tapado
      s = s.slice(0, t.desde) + '[' + QUE_ES_UNO[t.k] + ': no se guarda]' + s.slice(t.hasta); ult = t.desde;
    });
    return s;
  }
  function textoProhibido(ks) {
    var n = ks.map(function (k) { return QUE_ES[k]; });
    return 'Aquí no se guardan ' + (n.length > 1 ? n.slice(0, -1).join(', ') + ' ni ' + n[n.length - 1] : n[0]) + ': quítalo antes de guardar.';
  }

  /* ---------- configuración ----------
   * Cada sección del menú es un apartado (una tabla): Seguimiento, Clientes… son la misma sección con su configuración
   * (config.json · nucleo.secciones.<nombre>, con «modulo»: «listado»). apartado(cfg) la pasa a un objeto con sus claves. */
  var PROHIB_DEFECTO = ['CONTRASENA', 'CUENTA', 'DNI'];
  function apartado(cfg, id, tit) {
    cfg = cfg || {};
    return { id: id || 'LISTADO', titulo: tit || '', tabla: cfg.TABLA || '', clave: cfg.CLAVE || 'ID', codigo: cfg.CODIGO || '',
      nombre: cfg.NOMBRE || cfg.CLAVE || 'ID', columnas: cfg.COLUMNAS || [], detalle: cfg.DETALLE || [], orden: cfg.ORDEN || '',
      buscar: cfg.BUSCAR && cfg.BUSCAR.length ? cfg.BUSCAR : null, campos: cfg.CAMPOS || {}, ficha: cfg.FICHA || [],
      relacionados: cfg.RELACIONADOS || [], vistas: cfg.VISTAS || [], avisos: cfg.AVISOS || [], editar: cfg.EDITAR || [],
      crear: !!cfg.CREAR, texto: cfg.TEXTO || '', vacio: cfg.VACIO || '', refs: cfg._refs || {}, filtro: cfg.FILTRO || [],
      nueva: cfg.NUEVA || {}, obligatorias: cfg.OBLIGATORIAS || [] };
  }
  /** El campo de un apartado, con su título y tipo por defecto (una columna FECHA… es una fecha; ESTADO, un estado). */
  function campo(ap, c) {
    var d = (ap.campos || {})[c] || {};
    var base = String(c).split('.').pop();
    var tipo = d.tipo || (d.calculo ? 'importe' : (d.de && !d.de.columna ? 'numero' : (/^FECHA/.test(base) ? 'fecha' : (/^(ID_)?ESTADO$/.test(base) ? 'estado' : 'texto'))));
    return { n: c, titulo: d.titulo || (c === ap.codigo ? 'Código' : titulo(base)), tipo: tipo, opciones: d.opciones || null, ref: d.ref || refDe(ap, ap.tabla, c), ids: d._ids || null,
      de: d.de || null, primero: d.primero || null,
      unidad: d.unidad || '', calculo: d.calculo || null, precio: d.precio || null, privado: !!d.privado, colores: d.colores || null,
      ayuda: d.ayuda || '' };
  }
  function columnasDe(ap, vista) { return (vista && vista.columnas) || (ap.columnas && ap.columnas.length ? ap.columnas : [ap.nombre]); }
  /** Lo que una vista no enseña: lo que dice ocultar y, si es para enseñar a un cliente, todos los campos privados. */
  function ocultas(ap, vista) {
    var o = lista(vista && vista.ocultar).slice();
    if (vista && vista.cliente) Object.keys(ap.campos || {}).forEach(function (c) { if (ap.campos[c].privado && o.indexOf(c) < 0) o.push(c); });
    return o;
  }
  /** Las vistas de un apartado; sin ninguna, «Todo». */
  function vistasDe(ap) { return ap.vistas && ap.vistas.length ? ap.vistas : [{ id: 'TODO', titulo: 'Todo' }]; }

  /* ---------- referencias y datos de otras tablas (T0599, para tablas normalizadas como las de GESTION) ----------
   * config._refs (lo pone montar.js desde los YAML): { TABLA: { COLUMNA: tabla a la que apunta } }. Una columna que apunta a
   * otra tabla (ID_ESTADO → ESTADOS_TAREA) se enseña con el nombre de esa fila (NOMBRE) y sus opciones van en su ORDEN; una
   * ruta («ID_DISENO.COSTE_INR», «ID_MARCA.ID_FASE») sigue las referencias; un campo con «de» saca su valor de otra tabla
   * (el próximo paso de una marca, de su Seguimiento; cuántas telas tiene un proveedor) y uno con «primero», el primero de
   * varios que no esté vacío (con quién: la marca, el proveedor u otro contacto). Los filtros, avisos y colores usan los
   * nombres, como se ven; lo que se guarda sigue siendo el código. D: { filas(t), fila(t, id) }. */
  function refDe(ap, t, c) { return ((ap.refs || {})[t] || {})[c] || ''; }
  function nombreDe(D, t, id) {
    if (vacio(id)) return '';
    var f = D.fila(t, id);
    if (!f) return String(id);
    var n = ['NOMBRE', 'TITULO', 'DETALLE'].filter(function (k) { return !vacio(f[k]); })[0];
    return n ? String(f[n]) : String(id);
  }
  /** Una fila de otra tabla con sus referencias ya en nombre (un salto). */
  function conNombres(ap, D, t, x) {
    var r = {}, rs = (ap.refs || {})[t] || {};
    Object.keys(x).forEach(function (k) { r[k] = rs[k] ? nombreDe(D, rs[k], x[k]) : x[k]; });
    r.__crudo = x;
    return r;
  }
  /** El valor de una ruta («ID_DISENO.ID_TECNICA») desde una fila de la tabla t: sigue las referencias y da el nombre al final. */
  function seguir(ap, D, t, f, ruta) {
    var ps = ruta.split('.'), fila = f, tt = t;
    for (var i = 0; i < ps.length - 1; i++) {
      var r = refDe(ap, tt, ps[i]);
      if (!r || !fila || vacio(fila[ps[i]])) return '';
      fila = D.fila(r, fila[ps[i]]); tt = r;
    }
    if (!fila) return '';
    var ult = ps[ps.length - 1], rr = refDe(ap, tt, ult);
    return rr ? nombreDe(D, rr, fila[ult]) : fila[ult];
  }
  /** Todas las columnas que nombra la configuración (para saber qué rutas preparar). */
  function nombradas(ap) {
    var t = [ap.nombre, ap.codigo, ap.orden].concat(ap.columnas, ap.detalle, ap.buscar || []);
    ap.ficha.forEach(function (g) { t = t.concat(g.campos || []); });
    vistasDe(ap).forEach(function (v) {
      t = t.concat(v.columnas || [], [v.orden, v.agrupar && (v.agrupar.campo || v.agrupar), v.tablero && v.tablero.campo]);
      lista(v.filtro).forEach(function (c) { t.push(c.campo); });
    });
    lista(ap.filtro).forEach(function (c) { t.push(c.campo); });
    ap.avisos.forEach(function (a) { lista(a.si).forEach(function (c) { t.push(c.campo); }); });
    Object.keys(ap.campos).forEach(function (c) { t.push(c); if (ap.campos[c].calculo) t = t.concat(usa(ap.campos[c].calculo)); t = t.concat(ap.campos[c].primero || []); });
    return t.filter(function (c, i) { return c && typeof c === 'string' && c.charAt(0) !== '$' && t.indexOf(c) === i; }).map(function (c) { return c.replace(/^-/, ''); });
  }
  /**
   * El apartado listo para pintar con estos datos: cada columna que apunta a otra tabla, con sus opciones (los nombres, en
   * su ORDEN) y sus códigos (_ids: nombre → código, para guardar). No cambia la configuración.
   */
  function enriquecer(ap, D) {
    var a = JSON.parse(JSON.stringify(ap)), rs = (a.refs || {})[a.tabla] || {};
    Object.keys(rs).forEach(function (c) {
      var d = a.campos[c] = a.campos[c] || {}, t = rs[c];
      var fs = (D.filas(t) || []).slice();
      if (fs.length && 'ORDEN' in fs[0]) fs.sort(comparar('ORDEN'));
      d._ids = {};
      var ops = fs.map(function (x) { var n = nombreDe(D, t, x.ID !== undefined ? x.ID : x[Object.keys(x)[0]]); d._ids[n] = x.ID !== undefined ? x.ID : x[Object.keys(x)[0]]; return n; });
      if (!d.opciones) d.opciones = ops;
      d.ref = t;
    });
    return a;
  }
  /** Las filas como se ven: con nombres, rutas, «de» y «primero». Cada una guarda la de verdad en __crudo. */
  function preparar(a, filas, D) {
    var rs = (a.refs || {})[a.tabla] || {}, rutas = nombradas(a).filter(function (c) { return c.indexOf('.') > 0; });
    var conDe = Object.keys(a.campos).filter(function (c) { return a.campos[c].de; }), conPrimero = Object.keys(a.campos).filter(function (c) { return a.campos[c].primero; });
    return filas.map(function (f) {
      var r = {};
      Object.keys(f).forEach(function (k) { r[k] = rs[k] ? nombreDe(D, rs[k], f[k]) : f[k]; });
      rutas.forEach(function (ruta) { r[ruta] = seguir(a, D, a.tabla, f, ruta); });
      conDe.forEach(function (c) {
        var de = a.campos[c].de, clave = f[de.con || a.clave];
        var xs = vacio(clave) ? [] : (D.filas(de.tabla) || []).filter(function (x) { return norm(x[de.campo]) === norm(clave); }).map(function (x) { return conNombres(a, D, de.tabla, x); });
        if (de.filtro) xs = xs.filter(function (x) { return cumple(x, de.filtro, { hoy: de.hoy }); });
        if (de.orden) xs.sort(comparar(de.orden));
        r[c] = de.columna ? (xs.length ? xs[0][de.columna] : '') : xs.length;
      });
      conPrimero.forEach(function (c) { r[c] = a.campos[c].primero.map(function (x) { return r[x]; }).filter(function (v) { return !vacio(v); })[0] || ''; });
      r.__crudo = f;
      return r;
    });
  }

  /**
   * Comprueba la configuración de una sección (para quien administra y para las pruebas): columnas que faltan, un precio
   * cuyo cálculo no lleva el envío, una vista para clientes que enseñaría algo privado, columnas con datos que no se
   * guardan, vistas y avisos repetidos. columnasTabla(tabla) da las columnas de una tabla, si se saben (si no, no se miran).
   */
  function comprobar(cfg, columnasTabla, id) {
    var errores = [], ap = apartado(cfg, id), prohib = cfg.PROHIBIDO === undefined ? PROHIB_DEFECTO : cfg.PROHIBIDO, donde = id ? id + ': ' : '';
    if (!ap.tabla) return [donde + 'falta la tabla (TABLA).'];
    var cols = columnasTabla ? columnasTabla(ap.tabla) : null, calc = Object.keys(ap.campos).filter(function (c) { return ap.campos[c].calculo; });
    function hay(c, que, t, cs) {
      if (!t && calc.indexOf(c) >= 0) return;
      if (!t && ap.campos[c] && (ap.campos[c].de || ap.campos[c].primero)) return;
      if (!t && String(c).indexOf('.') > 0) { // una ruta: su primer paso tiene que apuntar a otra tabla
        var p0 = String(c).split('.')[0];
        if (cols && cols.indexOf(p0) < 0) errores.push(donde + que + ' «' + c + '»: ' + p0 + ' no es una columna de ' + ap.tabla + '.');
        else if (cols && ap.refs && ap.refs[ap.tabla] && !refDe(ap, ap.tabla, p0)) errores.push(donde + que + ' «' + c + '»: ' + p0 + ' no apunta a otra tabla.');
        return;
      }
      var en = t ? cs : cols;
      if (en && en.indexOf(c) < 0) errores.push(donde + que + ' «' + c + '» no es una columna de ' + (t || ap.tabla) + '.');
    }
    var todas = [ap.nombre, ap.clave].concat(ap.codigo ? [ap.codigo] : [], ap.columnas, ap.detalle);
    ap.ficha.forEach(function (g) { todas = todas.concat(g.campos || []); });
    todas.forEach(function (c) { hay(c, 'la columna'); });
    var ed = ap.editar === true ? [] : lista(ap.editar);
    ed.forEach(function (c) { hay(c, 'la columna que se edita'); if (calc.indexOf(c) >= 0) errores.push(donde + '«' + c + '» es calculado, no se edita.'); });
    var nombres = todas.concat(ed, cols || []);
    nombres.filter(function (c, i) { return nombres.indexOf(c) === i; }).forEach(function (c) {
      prohib.forEach(function (k) { if (NOMBRES_PROHIBIDOS[k] && NOMBRES_PROHIBIDOS[k].test(norm(c).toUpperCase())) errores.push(donde + 'la columna «' + c + '» guardaría ' + QUE_ES[k] + ', que aquí no se guardan.'); });
    });
    calc.forEach(function (c) {
      var d = ap.campos[c];
      usa(d.calculo).forEach(function (u) {
        if (u.charAt(0) === '$') { if (!cfg.VALORES || !(u.slice(1) in cfg.VALORES)) errores.push(donde + '«' + c + '» usa ' + u + ', que no está en VALORES.'); }
        else hay(u, 'el cálculo de «' + c + '» usa');
      });
      if (d.precio) {
        var env = lista(d.precio.envio);
        if (!env.length) errores.push(donde + 'el precio «' + c + '» no dice cuál es su envío (precio.envio).');
        else if (!env.some(function (e) { return usa(d.calculo).indexOf(e) >= 0; })) errores.push(donde + 'el precio «' + c + '» no suma su envío (' + env.join(' o ') + '): se vería un precio sin envío.');
      }
    });
    lista(ap.filtro).forEach(function (cnd) { if (cnd.campo) hay(cnd.campo, 'el FILTRO usa'); });
    Object.keys(ap.nueva).forEach(function (c) { hay(c, 'NUEVA pone'); });
    ap.obligatorias.forEach(function (c) { hay(c, 'OBLIGATORIAS nombra'); });
    var vids = {};
    vistasDe(ap).forEach(function (v) {
      if (vids[v.id]) errores.push(donde + 'la vista «' + v.id + '» está dos veces.');
      vids[v.id] = true;
      lista(v.filtro).forEach(function (cnd) { if (cnd.campo) hay(cnd.campo, 'el filtro de la vista «' + v.id + '» usa'); });
      if (v.agrupar) hay(v.agrupar.campo || v.agrupar, 'la vista «' + v.id + '» agrupa por');
      if (v.tablero) {
        if (!v.tablero.campo) errores.push(donde + 'el tablero de la vista «' + v.id + '» no dice por qué columna (tablero.campo).');
        else hay(v.tablero.campo, 'el tablero de la vista «' + v.id + '» usa');
        if (v.agrupar) errores.push(donde + 'la vista «' + v.id + '» es un tablero: no agrupa además.');
      }
      if (v.cliente) {
        var priv = function (c) { return ap.campos[c] && ap.campos[c].privado; };
        var se = columnasDe(ap, v).filter(function (c) { return ocultas(ap, v).indexOf(c) < 0 && priv(c); });
        // El nombre y el código salen siempre (en la tarjeta y en el título de la ficha): no pueden ser privados.
        [ap.nombre, ap.codigo].forEach(function (c) { if (c && priv(c) && se.indexOf(c) < 0) se.push(c); });
        if (se.length) errores.push(donde + 'la vista para clientes «' + v.id + '» enseñaría ' + se.join(', ') + '.');
      }
    });
    var aids = {};
    ap.avisos.forEach(function (a) {
      if (!a.id) errores.push(donde + 'un aviso sin id.');
      if (aids[a.id]) errores.push(donde + 'el aviso «' + a.id + '» está dos veces.');
      aids[a.id] = true;
      lista(a.si).forEach(function (cnd) { if (cnd.campo) hay(cnd.campo, 'el aviso «' + a.id + '» usa'); });
    });
    ap.relacionados.forEach(function (r) {
      var q = 'lo relacionado «' + (r.titulo || r.tabla) + '»';
      if (!r.tabla) { errores.push(donde + q + ' no dice su tabla.'); return; }
      var cs = columnasTabla ? columnasTabla(r.tabla) : null;
      if (columnasTabla && !cs) errores.push(donde + q + ': la tabla ' + r.tabla + ' no está.');
      hay(r.con, q + ' usa');
      if (cs) [r.campo].concat(r.columnas || []).forEach(function (c) { hay(c, q + ' usa', r.tabla, cs); });
    });
    return errores;
  }

  /* ---------- personalizar ----------
   * Lo de una sección: { vistas: [orden], ocultas: [vistas], avisos: { ID: { activo, dias } } }. Se aplica sobre su
   * configuración: lo que no nombra se queda como está y lo que ya no existe se olvida. El orden del menú va aparte (el
   * marco: UN.ordenMenu). */
  function aplicar(ap, p) {
    var r = JSON.parse(JSON.stringify(ap));
    p = p || {};
    if (r.vistas && r.vistas.length) {
      var ov = lista(p.vistas), fuera = lista(p.ocultas);
      var vs = r.vistas.filter(function (v) { return ov.indexOf(v.id) >= 0; }).sort(function (a, b) { return ov.indexOf(a.id) - ov.indexOf(b.id); })
        .concat(r.vistas.filter(function (v) { return ov.indexOf(v.id) < 0; }));
      var quedan = vs.filter(function (v) { return fuera.indexOf(v.id) < 0; });
      r.vistas = quedan.length ? quedan : vs.slice(0, 1); // al menos una vista
    }
    (r.avisos || []).forEach(function (a) {
      var pa = (p.avisos || {})[a.id];
      if (!pa) return;
      if (pa.activo !== undefined) a.activo = !!pa.activo;
      if (typeof pa.dias === 'number' && isFinite(pa.dias)) a.dias = Math.max(0, Math.min(365, Math.round(pa.dias)));
    });
    return r;
  }
  /** El orden del menú con uno movido: ids en el orden de ahora, el que se mueve y hacia dónde (-1 sube, 1 baja). */
  function mover(ids, id, d) {
    var r = ids.slice(), i = r.indexOf(id), j = i + d;
    if (i < 0 || j < 0 || j >= r.length) return r;
    r[i] = r[j]; r[j] = id;
    return r;
  }
  /** Lo que se copia para trabajar una fila en Claude: «Seguimiento T0012 · Mandar la propuesta» y sus datos, una línea cada uno. */
  function paraClaude(ap, f, valores, prohib, negocio) {
    var cod = ap.codigo && !vacio(f[ap.codigo]) ? String(f[ap.codigo]) : '';
    var nom = verTexto(campo(ap, ap.nombre), f, valores, prohib);
    var cs = [];
    (ap.ficha.length ? ap.ficha : [{ campos: ap.columnas }]).forEach(function (g) { (g.campos || []).forEach(function (c) { if (cs.indexOf(c) < 0 && c !== ap.nombre && c !== ap.codigo) cs.push(c); }); });
    var lineas = cs.map(function (c) { var cp = campo(ap, c), t = verTexto(cp, f, valores, prohib); return t ? cp.titulo + ': ' + t.replace(/\s*\n\s*/g, ' / ') : ''; }).filter(String);
    return (ap.titulo || ap.id) + (cod ? ' ' + cod : '') + ' · ' + nom + (negocio ? ' (' + negocio + ')' : '') + '\n' + lineas.join('\n');
  }

  /* ---------- avisos, vistas y orden ---------- */
  function avisosActivos(ap) { return (ap.avisos || []).filter(function (a) { return a.activo !== false; }); }
  /** Los avisos que tiene una fila, en el orden del apartado. */
  function avisosDe(ap, f, hoy) {
    return avisosActivos(ap).filter(function (a) { return cumple(f, a.si, { hoy: hoy, dias: a.dias === undefined ? 7 : a.dias }); });
  }
  function comparar(campoOrden) {
    var c = String(campoOrden || ''), al = c.charAt(0) === '-' ? -1 : 1;
    c = c.replace(/^-/, '');
    return function (a, b) {
      var x = a[c], y = b[c];
      if (vacio(x) && vacio(y)) return 0;
      if (vacio(x)) return 1; // los vacíos, siempre al final
      if (vacio(y)) return -1;
      var fx = aFecha(x), fy = aFecha(y);
      if (fx && fy) return al * (fx - fy);
      var nx = aNumero(x), ny = aNumero(y);
      if (!isNaN(nx) && !isNaN(ny)) return al * (nx - ny);
      return al * String(x).localeCompare(String(y), 'es', { numeric: true, sensitivity: 'base' });
    };
  }
  /** Las filas de una vista: su filtro, la búsqueda (en lo que se ve) y un aviso elegido, ordenadas. */
  function filtrar(ap, vista, filas, o) {
    o = o || {};
    var q = norm(o.q), fuera = ocultas(ap, vista);
    var dondeBuscar = (ap.buscar || [ap.nombre, ap.codigo].concat(columnasDe(ap, vista), ap.detalle || [])).filter(function (c) { return c && fuera.indexOf(c) < 0; });
    var r = filas.filter(function (f) {
      if (ap.filtro && ap.filtro.length && !cumple(f, ap.filtro, { hoy: o.hoy })) return false; // FILTRO: las filas de esta sección
      if (vista && vista.filtro && !cumple(f, vista.filtro, { hoy: o.hoy })) return false;
      if (o.aviso) { var a = (ap.avisos || []).filter(function (x) { return x.id === o.aviso; })[0]; if (a && !cumple(f, a.si, { hoy: o.hoy, dias: a.dias === undefined ? 7 : a.dias })) return false; }
      if (q && !dondeBuscar.some(function (c) { return norm(f[c]).indexOf(q) >= 0; })) return false;
      return true;
    });
    var ord = (vista && vista.orden) || ap.orden;
    return ord ? r.slice().sort(comparar(ord)) : r;
  }
  var PLAZOS = [
    { id: 'pasado', titulo: 'Con la fecha pasada', hasta: -1 },
    { id: 'hoy', titulo: 'Hoy', desde: 0, hasta: 0 },
    { id: 'semana', titulo: 'Próximos 7 días', desde: 1, hasta: 7 },
    { id: 'luego', titulo: 'Más adelante', desde: 8 },
    { id: 'sin', titulo: 'Sin fecha' }
  ];
  /** Grupos de una vista: por plazo de una fecha ({ campo, por: 'plazo' }) o por el valor de una columna (en el orden de sus opciones). */
  /**
   * T0599 · Las columnas de una vista tablero (como el Kanban): una por cada valor de tablero.columnas o, si no las dice,
   * de las opciones del campo, aunque estén vacías; detrás, los valores que no están en la lista y «Sin …» si hay filas
   * vacías. Con columnas dichas, solo esas: lo demás no sale (se dice en la configuración, como Descartada).
   */
  function columnasTablero(ap, vista, filas) {
    var t = vista.tablero, c = t.campo, cp = campo(ap, c), dichas = !!(t.columnas && t.columnas.length);
    var valores = (dichas ? t.columnas : (cp.opciones || [])).slice();
    if (!dichas) filas.forEach(function (f) { var v = vacio(f[c]) ? '' : String(f[c]); if (v && valores.indexOf(v) < 0) valores.push(v); });
    var cols = valores.map(function (v) { return { id: v, titulo: v, filas: [] }; });
    var sin = { id: '', titulo: 'Sin ' + cp.titulo.toLowerCase(), filas: [] };
    filas.forEach(function (f) {
      var v = vacio(f[c]) ? '' : String(f[c]), k = valores.map(norm).indexOf(norm(v));
      if (k >= 0) cols[k].filas.push(f); else if (!v && !dichas) sin.filas.push(f);
    });
    return sin.filas.length ? cols.concat([sin]) : cols;
  }
  function agrupar(ap, vista, filas, hoy) {
    var g = vista && vista.agrupar;
    if (!g) return [{ titulo: '', filas: filas }];
    var c = g.campo || g;
    if (g.por === 'plazo') {
      return PLAZOS.map(function (p) {
        return { id: p.id, titulo: p.titulo, filas: filas.filter(function (f) {
          var d = diasHasta(f[c], hoy);
          if (p.id === 'sin') return d === null;
          return d !== null && (p.desde === undefined || d >= p.desde) && (p.hasta === undefined || d <= p.hasta);
        }) };
      }).filter(function (x) { return x.filas.length; });
    }
    var ops = campo(ap, c).opciones || [], grupos = {}, orden = [];
    filas.forEach(function (f) { var k = vacio(f[c]) ? '' : String(f[c]); if (!grupos[k]) { grupos[k] = []; orden.push(k); } grupos[k].push(f); });
    orden.sort(function (a, b) {
      if (a === '') return 1; if (b === '') return -1;
      var ia = ops.indexOf(a), ib = ops.indexOf(b);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib);
      return a.localeCompare(b, 'es', { numeric: true });
    });
    return orden.map(function (k) { return { id: k, titulo: k || 'Sin ' + campo(ap, c).titulo.toLowerCase(), filas: grupos[k] }; });
  }
  /** Las filas de otro apartado que van con esta (el seguimiento de un cliente: CON_QUIEN = CLIENTE). */
  function relacionadas(r, f, filasOtro) {
    var v = norm((f.__crudo || f)[r.con]);
    if (!v) return [];
    return filasOtro.filter(function (x) { var y = norm((x.__crudo || x)[r.campo]); return r.contiene ? y.indexOf(v) >= 0 : y === v; });
  }

  /* ---------- valores en la pantalla ---------- */
  function fechaCorta(v) { var f = aFecha(v); return f ? dos(f.getDate()) + '/' + dos(f.getMonth() + 1) + '/' + f.getFullYear() : String(v); }
  /** 1840.5 → «1.840,50» (con punto de miles también en las de cuatro cifras, que toLocaleString no pone). */
  function num(n, dec) {
    var p = Math.abs(n).toFixed(dec).split('.');
    return (n < 0 ? '-' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (p[1] ? ',' + p[1] : '');
  }
  /** El valor de un campo como texto para la pantalla (sin HTML). Los calculados, ya calculados; un precio sin envío no sale. */
  function verTexto(cp, f, valores, prohib) {
    var v = cp.calculo ? calcular(cp.calculo, f, valores) : f[cp.n];
    if (cp.calculo) {
      if (isNaN(v)) return cp.precio ? 'Falta el coste o el envío' : '';
      v = Math.round(v * 100) / 100;
    }
    if (vacio(v)) return '';
    if (!cp.calculo && prohibido(v, prohib).length) return tapar(v, prohib);
    var u = cp.unidad ? ' ' + cp.unidad : '';
    if (cp.tipo === 'fecha') return fechaCorta(v);
    if (cp.tipo === 'importe') { var n = aNumero(v); return isNaN(n) ? String(v) : num(n, 2) + (u || ' €'); }
    if (cp.tipo === 'porcentaje') { var p = aNumero(v); return isNaN(p) ? String(v) : num(p * 100, 0) + ' %'; }
    if (cp.tipo === 'numero') { var m = aNumero(v); return isNaN(m) ? String(v) : num(m, m % 1 ? 1 : 0) + u; }
    if (cp.tipo === 'sino') return v === true || norm(v) === 'si' || norm(v) === 'true' ? 'Sí' : (v === false || norm(v) === 'no' || norm(v) === 'false' ? 'No' : String(v));
    return String(v) + u;
  }
  /** Cuándo es una fecha, en palabras: «hoy», «mañana», «hace 3 días», «en 5 días». */
  function cuando(v, hoy) {
    var d = diasHasta(v, hoy);
    if (d === null) return '';
    if (d === 0) return 'hoy';
    if (d === 1) return 'mañana';
    if (d === -1) return 'ayer';
    return d < 0 ? 'hace ' + (-d) + ' días' : 'en ' + d + ' días';
  }
  /** T0602 · La imagen de un campo foto: un enlace de Drive a un archivo («…/file/d/ID/view», «open?id=ID») se ve con su
   *  miniatura; otra dirección o una imagen «data:», tal cual; lo demás, '' (no es una imagen). */
  function imagen(v) {
    v = String(v === undefined || v === null ? '' : v).trim();
    var d = /^https?:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?(?:[^#]*&)?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,})/i.exec(v);
    if (d) return 'https://drive.google.com/thumbnail?id=' + d[1] + '&sz=w800';
    return /^(https?:|data:image\/)/i.test(v) ? v : '';
  }

  /** T0610 · Los avisos de una fila sin el que ya dice el título de su grupo: en «Con la fecha pasada», cada fila no repite
   *  «Con la fecha pasada» (la franja de color de la fila sigue). Sin grupo, todos. */
  function sinRepetir(avs, tituloGrupo) {
    var t = String(tituloGrupo || '').trim().toLowerCase();
    return t ? avs.filter(function (x) { return String(x.titulo || '').trim().toLowerCase() !== t; }) : avs;
  }

  /** T0610 · La columna que ya dicen los títulos de los grupos (agrupar por FASE: cada grupo es una fase), que en la tabla
   *  y en las tarjetas sobra; '' si no hay (sin agrupar, o por plazo de una fecha: la fecha exacta sí dice algo). */
  function columnaDelGrupo(vista) {
    var g = vista && vista.agrupar;
    if (!g || g.por === 'plazo') return '';
    return String(g.campo || g);
  }

  var CALC = { imagen: imagen, sinRepetir: sinRepetir, columnaDelGrupo: columnaDelGrupo, titulo: titulo, aFecha: aFecha, diasHasta: diasHasta, aNumero: aNumero, cumple: cumple, calcular: calcular, usa: usa,
    valoresDe: valoresDe, prohibido: prohibido, tapar: tapar, num: num, textoProhibido: textoProhibido, apartado: apartado, campo: campo,
    ocultas: ocultas, vistasDe: vistasDe, enriquecer: enriquecer, preparar: preparar, seguir: seguir, conNombres: conNombres, nombradas: nombradas, columnasDe: columnasDe, comprobar: comprobar, aplicar: aplicar, mover: mover, paraClaude: paraClaude,
    avisosDe: avisosDe, avisosActivos: avisosActivos, filtrar: filtrar, agrupar: agrupar, columnasTablero: columnasTablero,
    relacionadas: relacionadas, verTexto: verTexto, cuando: cuando, comparar: comparar };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) {} return ''; }
  function hoyIso() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function json(t) { try { return JSON.parse(t || 'null'); } catch (e) { return null; } }
  var ICONO_AJUSTAR = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>';
  var ICONO_X = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICONO_COPIAR = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';
  var MENU = 'MENU'; // la fila de PREFERENCIAS con el orden del menú
  var teclaEsc = null, alMover = null, alSoltar = null, alCancelar = null; // oyentes del documento, para quitarlos al cerrar

  window.UN.registrar('LISTADO', {
    abrir: function (el, ctx) {
      var T = ctx.tablas, cfg = ctx.config || {}, PROHIB = cfg.PROHIBIDO === undefined ? PROHIB_DEFECTO : cfg.PROHIBIDO;
      var BASE = apartado(cfg, ctx.id, ctx.titulo), PREF = cfg.PREFERENCIAS || '';
      var puedePersonalizar = !!ctx.admin || (cfg.PERSONALIZAN || []).indexOf(ctx.perfil) >= 0;
      var K = 'li_' + ctx.id + '_';
      var S = { vista: guardado(K + 'vista'), q: '', aviso: '', leido: false };
      var url = new URLSearchParams(location.search), pedida = url.get('ficha');

      el.innerHTML = '<div id="li-cont"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<div class="u-velo" id="li-velo"><div class="u-ventana li-ventana" role="dialog" aria-modal="true" aria-labelledby="li-vt"><div class="n-ventana" id="li-vent"></div></div></div>';
      var cont = el.querySelector('#li-cont'), velo = el.querySelector('#li-velo'), vent = el.querySelector('#li-vent');
      // T0602: una foto que no se puede ver (un archivo de Drive que no es público ni de quien mira) no sale rota.
      el.addEventListener('error', function (e) { var t = e.target; if (t && t.hasAttribute && t.hasAttribute('data-li-foto')) t.hidden = true; }, true);

      /* ---------- datos ---------- */
      var tablas = [BASE.tabla];
      BASE.relacionados.forEach(function (r) { if (r.tabla && tablas.indexOf(r.tabla) < 0) tablas.push(r.tabla); });
      Object.keys(cfg.VALORES || {}).forEach(function (k) { var v = cfg.VALORES[k]; if (v && v.tabla && tablas.indexOf(v.tabla) < 0) tablas.push(v.tabla); });
      if (PREF && tablas.indexOf(PREF) < 0) tablas.push(PREF);
      // Las tablas a las que apuntan (los nombres de las fases, de las marcas…) y las de los campos con «de».
      Object.keys(BASE.refs).forEach(function (t) { if (tablas.indexOf(t) < 0) tablas.push(t); });
      Object.keys(BASE.campos).forEach(function (c) { var de = BASE.campos[c].de; if (de && de.tabla && tablas.indexOf(de.tabla) < 0) tablas.push(de.tabla); });
      function filas(t) { return T.filas(t) || []; }
      function filaDe(t, id) { return T.fila ? T.fila(t, id) : null; }
      var D = { filas: filas, fila: filaDe };
      /** Lo personalizado: de la tabla PREFERENCIAS (para todos) o, sin ella, del dispositivo. */
      function prefDe(clave) {
        var f = PREF ? filaDe(PREF, clave) : null;
        return json(f ? f.VALOR : guardado('li_pref_' + clave));
      }
      function ap() { return enriquecer(aplicar(BASE, prefDe(ctx.id)), D); }
      /** Las filas como se ven (nombres en vez de códigos, rutas, «de»); cada una con la de verdad en __crudo. */
      function vistas(a) { return preparar(a, filas(a.tabla), D); }
      function filaVista(a, id) { return vistas(a).filter(function (f) { return String(f[a.clave]) === String(id); })[0] || null; }
      function vistaActual(a) { var vs = vistasDe(a); return vs.filter(function (v) { return v.id === S.vista; })[0] || vs[0]; }
      var VAL = {};
      // Las secciones a las que se puede ir (las que ve quien ha entrado), para los enlaces de lo relacionado.
      var veo = {}; (ctx.secciones || []).forEach(function (s) { veo[s.id] = s.titulo; });
      var errores = null, pintado = '';

      /* ---------- pintar ---------- */
      function celda(a, c, f, conEnlaces, cliente) {
        var cp = campo(a, c), t = verTexto(cp, f, VAL, PROHIB);
        if (c === a.codigo && t) return '<span class="li-cod">' + texto(t) + '</span>';
        if (t === '') return '<span class="li-nada">—</span>';
        var v = f[c];
        if (cp.calculo && cp.precio && t.indexOf('Falta') === 0) return cliente ? 'Precio a consultar' : '<span class="u-mal">' + texto(t) + '</span>';
        if (conEnlaces && !cp.calculo && !prohibido(v, PROHIB).length) {
          if (cp.tipo === 'enlace' && /^https?:\/\//i.test(String(v))) return '<a href="' + texto(v) + '" target="_blank" rel="noopener">Abrir ↗</a>';
          if (cp.tipo === 'email' && /@/.test(String(v))) return '<a href="mailto:' + texto(v) + '">' + texto(v) + '</a>';
          if (cp.tipo === 'telefono') return '<a href="tel:' + texto(String(v).replace(/[^\d+]/g, '')) + '">' + texto(v) + '</a>';
          if (cp.tipo === 'foto' && imagen(v)) return '<img class="li-foto" src="' + texto(imagen(v)) + '" alt="" referrerpolicy="no-referrer" data-li-foto>' +
            (/^https?:/i.test(String(v)) ? ' <a class="u-nota" href="' + texto(v) + '" target="_blank" rel="noopener">Abrir ↗</a>' : '');
        }
        if (cp.tipo === 'foto') return imagen(v) ? '<img class="li-mini" src="' + texto(imagen(v)) + '" alt="" referrerpolicy="no-referrer" data-li-foto>' : texto(t);
        if (cp.tipo === 'estado' || cp.colores) {
          var col = (cp.colores || {})[String(v)] || '';
          return '<span class="u-chip li-estado' + (col ? ' li-' + texto(col) : '') + '">' + texto(t) + '</span>';
        }
        if (cp.tipo === 'fecha') { var cu = cuando(v, hoyIso()); return texto(t) + (cu ? ' <span class="u-nota">· ' + texto(cu) + '</span>' : ''); }
        return texto(t);
      }
      /** El nombre de una fila con su código delante (el de la tarea, para trabajarla en Claude). */
      function titulo2(a, f, cli) {
        var cod = a.codigo && a.codigo !== a.nombre && !vacio(f[a.codigo]) ? '<span class="li-cod">' + texto(f[a.codigo]) + '</span> ' : '';
        return cod + celda(a, a.nombre, f, false, cli);
      }
      function marcas(avs) { return avs.map(function (x) { return '<span class="li-aviso li-' + texto(x.nivel || 'medio') + '">' + texto(x.titulo) + '</span>'; }).join(''); }

      function pintar() {
        if (!S.leido) return;
        VAL = valoresDe(cfg.VALORES, filaDe);
        if (errores === null) errores = ctx.admin ? comprobar(cfg, function (t) { var c = T.columnas && T.columnas(t); return c && c.length ? c : null; }, '') : [];
        var a = ap(), vista = vistaActual(a), hoy = hoyIso(), todas = vistas(a);
        S.vista = vista.id;
        var html = '';
        if (errores.length) html += '<div class="u-bloque li-errores"><strong>La configuración de esta sección tiene cosas que no cuadran (solo lo ve quien administra):</strong><ul>' + errores.map(function (e) { return '<li>' + texto(e) + '</li>'; }).join('') + '</ul></div>';
        var vs = vistasDe(a);
        html += '<div class="li-arriba">' + (vs.length > 1 ? '<div class="u-pestanas li-vistas" role="tablist" aria-label="Vistas">' + vs.map(function (v) {
          return '<button type="button" role="tab" data-vista="' + texto(v.id) + '" aria-selected="' + (v.id === vista.id) + '">' + texto(v.titulo) + (v.cliente ? ' <span class="li-cli">para clientes</span>' : '') + '</button>';
        }).join('') + '</div>' : '<div class="li-vistas"></div>') +
          (puedePersonalizar ? '<button type="button" class="u-btn u-btn-texto li-pers" data-pers>' + ICONO_AJUSTAR + 'Personalizar</button>' : '') + '</div>';
        if (a.texto) html += '<p class="u-nota li-texto">' + texto(a.texto) + '</p>';
        if (vista.cliente) {
          var nombres = []; ocultas(a, vista).forEach(function (c) { var t = campo(a, c).titulo; if (nombres.indexOf(t) < 0) nombres.push(t); });
          html += '<p class="li-cliente">Vista para enseñar a un cliente: sin avisos y sin ' + (nombres.length ? nombres.map(function (t) { return t.toLowerCase(); }).join(', ').replace(/, ([^,]*)$/, ' ni $1') : 'los datos privados') + '.</p>';
        }
        var deVista = filtrar(a, vista, todas, { hoy: hoy });
        var avs = vista.cliente ? [] : avisosActivos(a).map(function (x) { return { a: x, n: filtrar(a, vista, todas, { hoy: hoy, aviso: x.id }).length }; }).filter(function (x) { return x.n; });
        if (S.aviso && !avs.some(function (x) { return x.a.id === S.aviso; })) S.aviso = '';
        var fs = filtrar(a, vista, todas, { hoy: hoy, q: S.q, aviso: S.aviso });
        html += '<div class="li-barra"><div class="li-buscar"><label class="u-oculto" for="li-q">Buscar</label><input id="li-q" type="search" placeholder="Buscar en ' + texto((a.titulo || '').toLowerCase()) + '" value="' + texto(S.q) + '" autocomplete="off"></div>' +
          '<span class="u-nota li-cuenta">' + (fs.length === deVista.length ? fs.length + (fs.length === 1 ? ' fila' : ' filas') : fs.length + ' de ' + deVista.length) + '</span>' +
          (a.crear && editables(a).length && !vista.cliente ? '<button type="button" class="u-btn u-btn-accion li-nueva" data-nueva>Añadir</button>' : '') + '</div>';
        if (avs.length) html += '<div class="li-avisos" role="group" aria-label="Avisos">' + avs.map(function (x) {
          return '<button type="button" class="li-av li-' + texto(x.a.nivel || 'medio') + '" data-aviso="' + texto(x.a.id) + '" aria-pressed="' + (S.aviso === x.a.id) + '"><b>' + x.n + '</b> ' + texto(x.a.titulo) + '</button>';
        }).join('') + (S.aviso ? '<button type="button" class="u-btn u-btn-texto" data-aviso="">Ver todas</button>' : '') + '</div>';
        if (!todas.length) html += '<p class="u-vacio">' + texto(a.vacio || 'Todavía no hay nada en ' + (a.titulo || '').toLowerCase() + '.') + '</p>';
        else if (!fs.length) html += '<p class="u-vacio">' + (S.q ? 'Nada con «' + texto(S.q) + '».' : 'Nada en esta vista.') + '</p>';
        else if (vista.tablero) html += pintarTablero(a, vista, fs, hoy);
        else html += pintarGrupos(a, vista, agrupar(a, vista, fs, hoy), hoy);
        // Si no ha cambiado nada (un refresco por detrás con lo mismo), no se rehace: un toque a medias en una fila no se pierde.
        if (html === pintado) return;
        pintado = html;
        var foco = document.activeElement && document.activeElement.id === 'li-q' ? document.activeElement.selectionStart : null;
        cont.innerHTML = html;
        if (foco !== null) { var q = cont.querySelector('#li-q'); q.focus(); try { q.setSelectionRange(foco, foco); } catch (e) {} }
      }
      function tarjeta(a, f, det, cli, hoy, arrastrar, tituloGrupo) {
        var avs = cli ? [] : avisosDe(a, f, hoy), mar = sinRepetir(avs, tituloGrupo);
        // T0601: en la tarjeta, lo vacío no sale (una prospección sin estado ni nota no enseña «— —»).
        var dets = det.map(function (x) { return celda(a, x, f, false, cli); }).filter(function (h) { return h.indexOf('class="li-nada"') < 0; });
        return '<li><button type="button" class="li-tarjeta' + (avs.length ? ' li-f-' + texto(avs[0].nivel || 'medio') : '') + '" data-id="' + texto(f[a.clave]) + '"' + (arrastrar ? ' data-mover' : '') + '>' +
          '<strong>' + titulo2(a, f, cli) + '</strong>' +
          (dets.length ? '<span class="li-det">' + dets.map(function (h) { return '<span>' + h + '</span>'; }).join('') + '</span>' : '') +
          (mar.length ? '<span class="li-marcas">' + marcas(mar) + '</span>' : '') + '</button></li>';
      }
      /** T0610 · Los grupos de una vista. En el ordenador, UNA tabla: la cabecera una vez y cada grupo como una fila con su
       *  título, así las columnas caen igual en todos y se ajustan a lo que llevan. En el móvil, una lista de tarjetas por grupo. */
      function pintarGrupos(a, vista, gs, hoy) {
        // En una vista para clientes no salen los avisos (son para quien trabaja) y un precio que falta es «a consultar».
        var cli = !!vista.cliente, fuera = ocultas(a, vista), nom = a.nombre;
        // La columna por la que se agrupa ya la dice el título de cada grupo: no se repite en cada fila (salvo que sea el nombre).
        var delGrupo = columnaDelGrupo(vista);
        if (delGrupo && delGrupo !== nom && gs.length > 1) fuera = fuera.concat([delGrupo]);
        var cols = columnasDe(a, vista).filter(function (c) { return fuera.indexOf(c) < 0 && c !== a.codigo; });
        // En la tabla, el código va en su columna, la primera (en las tarjetas, delante del nombre).
        var conCod = a.codigo && a.codigo !== nom ? [a.codigo].concat(cols) : cols;
        var det = (a.detalle.length ? a.detalle : cols.filter(function (c) { return c !== nom; }).slice(0, 2)).filter(function (c) { return fuera.indexOf(c) < 0 && c !== nom && (!cli || cols.indexOf(c) >= 0); });
        var num = function (cp) { return /importe|numero|porcentaje/.test(cp.tipo); };
        var cabG = function (g) { return '<h2 class="n-grupo">' + texto(g.titulo) + ' <span class="u-cifra">' + g.filas.length + '</span></h2>'; };
        var fila = function (f, g) {
          var avs = cli ? [] : avisosDe(a, f, hoy), mar = sinRepetir(avs, g.titulo);
          return '<tr tabindex="0" data-id="' + texto(f[a.clave]) + '"' + (avs.length ? ' class="li-con-aviso li-f-' + texto(avs[0].nivel || 'medio') + '"' : '') + '>' + conCod.map(function (c) {
            var cp = campo(a, c), principal = c === nom;
            // Fechas, cifras, estados y lo corto no se parten («273 / g/m²», «hace 9 / días»): lo que se estrecha es el texto largo.
            var h = celda(a, c, f, false, cli), corta = !principal && (num(cp) || /^(fecha|estado|sino)$/.test(cp.tipo) || h.replace(/<[^>]*>/g, '').length <= 14);
            return '<td class="' + (num(cp) ? 'num' : '') + (corta ? ' li-td-corta' : '') + (principal ? ' u-tabla-t' : '') + (c === a.codigo ? ' li-td-cod' : '') + '">' + h +
              (principal && mar.length ? '<div class="li-marcas">' + marcas(mar) + '</div>' : '') + '</td>';
          }).join('') + '</tr>';
        };
        var tabla = '<div class="u-solo-ancho li-tabla"><table class="u-tabla"><thead><tr>' + conCod.map(function (c) {
          var cp = campo(a, c); return '<th scope="col"' + (num(cp) ? ' class="num"' : '') + '>' + texto(cp.titulo) + '</th>';
        }).join('') + '</tr></thead>' + gs.map(function (g) {
          return '<tbody>' + (g.titulo ? '<tr class="li-g-cab"><th scope="colgroup" colspan="' + conCod.length + '">' + cabG(g) + '</th></tr>' : '') +
            g.filas.map(function (f) { return fila(f, g); }).join('') + '</tbody>';
        }).join('') + '</table></div>';
        var tarjetas = '<div class="u-solo-movil">' + gs.map(function (g) {
          return '<section class="li-grupo">' + (g.titulo ? cabG(g) : '') + '<ul class="li-tarjetas">' +
            g.filas.map(function (f) { return tarjeta(a, f, det, cli, hoy, false, g.titulo); }).join('') + '</ul></section>';
        }).join('') + '</div>';
        return tabla + tarjetas;
      }
      /** Tablero: una columna por valor, con sus tarjetas; se arrastra de una a otra si ese campo se edita (y no es para clientes). */
      function pintarTablero(a, vista, fs, hoy) {
        var cli = !!vista.cliente, fuera = ocultas(a, vista), c = vista.tablero.campo, nom = a.nombre;
        var mueve = !cli && editables(a).indexOf(c) >= 0;
        var det = (a.detalle.length ? a.detalle : columnasDe(a, vista)).filter(function (x) { return fuera.indexOf(x) < 0 && x !== nom && x !== c && x !== a.codigo; }).slice(0, 3);
        var cp = campo(a, c);
        return '<div class="li-tablero" data-campo="' + texto(c) + '">' + columnasTablero(a, vista, fs).map(function (col) {
          var color = (cp.colores || {})[col.id] || '';
          return '<section class="li-col' + (color ? ' li-' + texto(color) : '') + '" data-valor="' + texto(col.id) + '"' + (mueve ? ' data-soltar' : '') + '>' +
            '<h2 class="li-col-t">' + texto(col.titulo) + ' <span class="u-cifra">' + col.filas.length + '</span></h2>' +
            (col.filas.length ? '<ul class="li-tarjetas li-col-l">' + col.filas.map(function (f) { return tarjeta(a, f, det, cli, hoy, mueve); }).join('') + '</ul>' : '<p class="u-nota li-col-vacia">Nada</p>') + '</section>';
        }).join('') + '</div>' + (mueve ? '<p class="u-nota li-col-ayuda">En el ordenador, arrastra una tarjeta a otra columna para cambiar su ' + texto(cp.titulo.toLowerCase()) + '. En el móvil, ábrela y cámbialo en su ficha.</p>' : '');
      }

      /* ---------- ficha ---------- */
      function abrirVentana(html) {
        vent.innerHTML = html;
        velo.classList.add('abierto');
        var h = vent.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      }
      function cerrarVentana() {
        velo.classList.remove('abierto'); vent.innerHTML = '';
        // Si se llegó con ?ficha=…, se quita de la dirección para que al volver no se abra otra vez.
        if (new URLSearchParams(location.search).get('ficha')) { var u = new URL(location.href); u.searchParams.delete('ficha'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); }
      }
      /** Una fila nueva con lo que pone NUEVA (por el nombre en una columna que apunta a otra tabla; «hoy» en una fecha). */
      function nuevaFila(a) {
        var r = {};
        Object.keys(a.nueva || {}).forEach(function (c) {
          var v = a.nueva[c], cp = campo(a, c);
          if (v === 'hoy' && cp.tipo === 'fecha') v = hoyIso();
          r[c] = cp.ids && v in cp.ids ? cp.ids[v] : v;
        });
        return r;
      }
      function editables(a) {
        if (a.editar === true) {
          var t = [a.nombre].concat(a.columnas); a.ficha.forEach(function (g) { t = t.concat(g.campos || []); });
          return t.filter(function (c, i) { return c && t.indexOf(c) === i && c !== a.clave && c !== a.codigo && !campo(a, c).calculo; });
        }
        return lista(a.editar).filter(function (c) { return !campo(a, c).calculo; });
      }
      function entrada(a, c, f) {
        var cp = campo(a, c), v = f ? f[c] : '', id = 'li-c-' + c;
        var et = '<label class="u-etiqueta" for="' + id + '">' + texto(cp.titulo) + '</label>';
        if (cp.ids) {
          // Una columna que apunta a otra tabla: se elige por el nombre y se guarda el código.
          var ns = Object.keys(cp.ids);
          return '<div class="u-campo">' + et + '<select id="' + id + '" data-c="' + texto(c) + '"><option value=""></option>' +
            ns.map(function (n) { return '<option value="' + texto(cp.ids[n]) + '"' + (String(v) === String(cp.ids[n]) ? ' selected' : '') + '>' + texto(n) + '</option>'; }).join('') +
            (!vacio(v) && !ns.some(function (n) { return String(cp.ids[n]) === String(v); }) ? '<option value="' + texto(v) + '" selected>' + texto(v) + '</option>' : '') + '</select></div>';
        }
        if (cp.opciones) {
          var ops = cp.opciones.slice(); if (!vacio(v) && ops.indexOf(String(v)) < 0) ops.unshift(String(v));
          return '<div class="u-campo">' + et + '<select id="' + id + '" data-c="' + texto(c) + '"><option value=""></option>' +
            ops.map(function (o) { return '<option' + (String(v) === o ? ' selected' : '') + '>' + texto(o) + '</option>'; }).join('') + '</select></div>';
        }
        // Lo que no se guarda (una cuenta, un DNI) tampoco se enseña al editar: sale tapado y, si se guarda, se quita.
        var tapado = !vacio(v) && prohibido(v, PROHIB).length ? tapar(v, PROHIB) : null;
        var nota = tapado !== null ? '<span class="u-nota">Hemos tapado un dato que aquí no se guarda. Si guardas este campo, se quita.</span>' : '';
        if (tapado !== null) v = tapado;
        if (cp.tipo === 'nota') return '<div class="u-campo u-ancho">' + et + '<textarea id="' + id + '" rows="3" data-c="' + texto(c) + '">' + texto(v) + '</textarea>' + nota + '</div>';
        var tipo = cp.tipo === 'fecha' ? 'date' : (cp.tipo === 'email' ? 'email' : (cp.tipo === 'telefono' ? 'tel' : (cp.tipo === 'enlace' || cp.tipo === 'foto' ? 'url' : 'text')));
        var d = cp.tipo === 'fecha' ? aFecha(v) : null;
        var val = d ? d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()) : (vacio(v) ? '' : String(v));
        return '<div class="u-campo">' + et + '<input id="' + id + '" type="' + tipo + '"' + (/importe|numero|porcentaje/.test(cp.tipo) ? ' inputmode="decimal"' : '') + ' data-c="' + texto(c) + '" value="' + texto(val) + '">' + nota + '</div>';
      }
      /** El valor con el que se abrió un campo de la ficha (para guardar solo lo que se ha cambiado). */
      function inicial(i) {
        if (i.tagName === 'SELECT') { var o = [].filter.call(i.options, function (x) { return x.defaultSelected; })[0]; return o ? o.value : ''; }
        return i.defaultValue;
      }
      var abierta = null; // { id } de la ficha abierta, para «Copiar para Claude»
      function ficha(id, nueva) {
        var a = ap(), vista = vistaActual(a), fuera = ocultas(a, vista), f = nueva ? {} : filaVista(a, id), hoy = hoyIso(), cli = !!vista.cliente;
        if (!f) { ctx.aviso('Esa fila ya no está.'); return; }
        var crudo = f.__crudo || {}; // lo que de verdad hay (los códigos), para editar
        if (nueva) crudo = nuevaFila(a);
        abierta = nueva ? null : { id: id };
        var ed = cli ? [] : editables(a).filter(function (c) { return fuera.indexOf(c) < 0; });
        var grupos = a.ficha.length ? a.ficha : [{ titulo: '', campos: columnasDe(a, vista) }];
        var avs = nueva || cli ? [] : avisosDe(a, f, hoy);
        var vuelta = ctx.desde && pedida && !nueva ? '<button type="button" class="u-btn u-btn-texto li-volver" data-volver>‹ Volver a ' + texto(ctx.desde.titulo) + '</button>' : '';
        var h = vuelta + '<div class="li-ficha-cab"><h2 id="li-vt">' + (nueva ? 'Añadir · ' + texto(a.titulo) : titulo2(a, f, cli)) + '</h2>' +
          '<button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Cerrar">' + ICONO_X + '</button></div>';
        if (!nueva && !cli && a.codigo) h += '<div class="li-claude"><button type="button" class="u-btn" data-claude>' + ICONO_COPIAR + 'Copiar para Claude</button><span class="u-nota">Pégalo al empezar una sesión de Claude para trabajar ' + texto(vacio(f[a.codigo]) ? 'esta fila' : f[a.codigo]) + '.</span></div>';
        if (avs.length) h += '<div class="li-ficha-avisos">' + marcas(avs) + '</div>';
        if (cli) h += '<p class="li-cliente">Ficha para enseñar a un cliente: sin datos privados.</p>';
        var puestos = [];
        h += '<form id="li-form" class="li-form" novalidate>' + grupos.map(function (g) {
          // Para enseñar a un cliente, la ficha enseña solo lo que enseña su vista (ni marcas interesadas ni muestras).
          var cs = (g.campos || []).filter(function (c) { return fuera.indexOf(c) < 0 && c !== a.codigo && (nueva ? ed.indexOf(c) >= 0 : true) && (!cli || columnasDe(a, vista).indexOf(c) >= 0); });
          if (!cs.length) return '';
          var cuerpo = cs.map(function (c) {
            puestos.push(c);
            if (ed.indexOf(c) >= 0) return entrada(a, c, crudo);
            var cp = campo(a, c);
            return '<div class="li-dato' + (cp.tipo === 'nota' || cp.tipo === 'foto' ? ' u-ancho' : '') + '"><span class="u-etiqueta">' + texto(cp.titulo) + '</span><span class="li-valor">' + celda(a, c, f, true, cli) + '</span>' +
              (cp.ayuda && !cli ? '<span class="u-nota">' + texto(cp.ayuda) + '</span>' : '') + '</div>';
          }).join('');
          return '<section class="li-fgrupo">' + (g.titulo ? '<h3 class="li-fg-t">' + texto(g.titulo) + '</h3>' : '') + '<div class="u-campos">' + cuerpo + '</div></section>';
        }).join('');
        // Lo que se edita y no está en ningún apartado de la ficha, al final.
        var resto = ed.filter(function (c) { return puestos.indexOf(c) < 0; });
        if (resto.length) h += '<section class="li-fgrupo"><div class="u-campos">' + resto.map(function (c) { return entrada(a, c, crudo); }).join('') + '</div></section>';
        h += '<p class="u-error" id="li-err" role="alert" hidden></p>';
        if (ed.length) h += '<div class="n-botones"><button type="submit" class="u-btn u-btn-accion">' + (nueva ? 'Añadir' : 'Guardar') + '</button></div>';
        h += '</form>';
        // Lo relacionado (el seguimiento de un cliente): cada fila lleva a su sección, con su ficha abierta.
        if (!nueva && !cli) a.relacionados.forEach(function (r) {
          var rs = relacionadas(r, f, filas(r.tabla).map(function (x) { return conNombres(a, D, r.tabla, x); })), sec = String(r.seccion || '').toUpperCase(), va = sec && veo[sec];
          if (r.orden) rs = rs.slice().sort(comparar(r.orden));
          if (!rs.length && r.siHay) return; // T0602: lo que casi nunca hay (a quién se compra a través de este), solo si hay
          var otro = { id: sec, titulo: r.titulo, tabla: r.tabla, refs: a.refs, clave: r.clave || 'ID', codigo: r.codigo || '', nombre: r.nombre || (r.columnas || [r.clave || 'ID'])[0], campos: r.campos || {} };
          var cols = (r.columnas || [otro.nombre]).filter(function (c) { return c !== otro.codigo; });
          h += '<section class="li-fgrupo"><h3 class="li-fg-t">' + texto(r.titulo || r.tabla) + ' <span class="u-cifra">' + rs.length + '</span></h3>' +
            (rs.length ? '<ul class="li-rel">' + rs.slice(0, r.max || 20).map(function (x) {
              var dentro = (otro.codigo && !vacio(x[otro.codigo]) ? '<span class="li-cod">' + texto(x[otro.codigo]) + '</span>' : '') + cols.map(function (c) { return '<span>' + celda(otro, c, x, false) + '</span>'; }).join('');
              return '<li>' + (va ? '<a class="li-rel-f" href="?s=' + encodeURIComponent(sec.toLowerCase()) + '&ficha=' + encodeURIComponent((x.__crudo || x)[otro.clave]) + '" data-sx="' + texto(sec) + '">' + dentro + '<span class="li-ir">' + texto(va) + ' ›</span></a>' : '<div class="li-rel-f">' + dentro + '</div>') + '</li>';
            }).join('') + '</ul>' : '<p class="u-vacio">' + texto(r.vacio || 'Nada todavía.') + '</p>') + '</section>';
        });
        abrirVentana(h);
        var form = vent.querySelector('#li-form');
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var err = vent.querySelector('#li-err'), cambios = {}, malos = [], faltan = [];
          [].forEach.call(form.querySelectorAll('[data-c]'), function (i) {
            var c = i.getAttribute('data-c'), v = i.value.trim(), cp = campo(a, c);
            var p = prohibido(v, PROHIB); if (p.length) { malos = malos.concat(p); i.setAttribute('aria-invalid', 'true'); } else i.removeAttribute('aria-invalid');
            if (v === '' && a.obligatorias.indexOf(c) >= 0) { faltan.push(cp.titulo); i.setAttribute('aria-invalid', 'true'); }
            // Al añadir, todo lo que tiene valor (también lo que viene puesto); al editar, solo lo que ha cambiado.
            if (nueva ? v !== '' : v !== String(inicial(i)).trim()) cambios[c] = cp.tipo === 'importe' || cp.tipo === 'numero' ? (v === '' ? '' : (isNaN(aNumero(v)) ? v : aNumero(v))) : v;
          });
          if (malos.length) { err.textContent = textoProhibido(malos.filter(function (k, i) { return malos.indexOf(k) === i; })); err.hidden = false; return; }
          if (faltan.length) { err.textContent = 'Falta ' + faltan.join(', ').replace(/, ([^,]*)$/, ' y $1') + '.'; err.hidden = false; return; }
          if (!Object.keys(cambios).length) { cerrarVentana(); return; }
          var p = nueva ? T.crear(a.tabla, cambios) : T.actualizar(a.tabla, id, cambios);
          cerrarVentana();
          Promise.resolve(p).then(function () { ctx.aviso(nueva ? 'Añadido.' : 'Guardado.'); }, function (e) { ctx.aviso('No se ha guardado: ' + ((e && e.message) || e)); });
        });
      }
      function copiarClaude() {
        var a = ap(), f = abierta && filaVista(a, abierta.id);
        if (!f) return;
        var t = paraClaude(a, f, VAL, PROHIB, '');
        var hecho = function () { ctx.aviso('Copiado: pégalo en Claude al empezar la sesión.'); };
        var aMano = function () {
          var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
          document.body.removeChild(ta);
          if (ok) hecho(); else ctx.aviso('No se ha podido copiar: selecciona el texto de la ficha y cópialo.');
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(hecho, aMano); else aMano();
      }

      /* ---------- personalizar ---------- */
      function guardarPref(clave, valor, otraVez) {
        var txt = JSON.stringify(valor);
        guardado('li_pref_' + clave, txt);
        if (!PREF) { if (otraVez) otraVez(); return Promise.resolve('en este dispositivo'); }
        var hay = filaDe(PREF, clave);
        var p = hay ? T.actualizar(PREF, clave, { VALOR: txt }) : T.crear(PREF, { ID: clave, VALOR: txt });
        if (otraVez) otraVez();
        return Promise.resolve(p).then(function () { return 'para todos'; });
      }
      /** Las secciones del menú, en el orden de ahora (sin Perfil ni las de dentro de Perfil). */
      function delMenu() {
        var ss = (ctx.secciones || []).filter(function (s) { return !s.enPerfil && s.id !== 'PERFIL'; });
        // ctx.secciones es el orden de cuando se abrió la sección: el de ahora es el que guarda el marco.
        var o = window.UN.ordenMenu ? window.UN.ordenMenu() || [] : [];
        return o.length ? ss.filter(function (s) { return o.indexOf(s.id) >= 0; }).sort(function (x, y) { return o.indexOf(x.id) - o.indexOf(y.id); }).concat(ss.filter(function (s) { return o.indexOf(s.id) < 0; })) : ss;
      }
      function personalizar() {
        var base = BASE, p = prefDe(ctx.id) || {}, conPref = ap();
        var ordenV = (base.vistas || []).slice().sort(function (x, y) { var o = lista(p.vistas); var ia = o.indexOf(x.id), ib = o.indexOf(y.id); return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib); });
        var fuera = lista(p.ocultas), menu = delMenu();
        function fila(id, tit, extra, i, n, grupo) {
          return '<li class="li-p-fila" data-g="' + grupo + '" data-id="' + texto(id) + '">' + extra + '<span class="li-p-t">' + texto(tit) + '</span>' +
            '<button type="button" class="u-btn u-btn-icono" data-sube aria-label="Subir ' + texto(tit) + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button type="button" class="u-btn u-btn-icono" data-baja aria-label="Bajar ' + texto(tit) + '"' + (i === n - 1 ? ' disabled' : '') + '>↓</button></li>';
        }
        var h = '<div class="li-ficha-cab"><h2 id="li-vt">Personalizar</h2><button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Cerrar">' + ICONO_X + '</button></div>' +
          '<p class="u-nota">' + (PREF ? 'Vale para todos los que usan la app.' : 'Se guarda en este dispositivo.') + '</p>';
        if (menu.length > 1 && window.UN.ordenMenu) h += '<section class="li-fgrupo"><h3 class="li-fg-t">Orden del menú</h3><ul class="li-p-lista">' +
          menu.map(function (s, i) { return fila(s.id, s.titulo, '', i, menu.length, 'menu'); }).join('') + '</ul></section>';
        if (ordenV.length > 1) h += '<section class="li-fgrupo"><h3 class="li-fg-t">Vistas de ' + texto(ctx.titulo) + '</h3><p class="u-nota">La primera se abre al entrar. Quita las que no uses.</p><ul class="li-p-lista">' +
          ordenV.map(function (v, i) { return fila(v.id, v.titulo, '<input type="checkbox" data-ver aria-label="Ver ' + texto(v.titulo) + '"' + (fuera.indexOf(v.id) < 0 ? ' checked' : '') + '>', i, ordenV.length, 'vi'); }).join('') + '</ul></section>';
        if ((conPref.avisos || []).length) h += '<section class="li-fgrupo"><h3 class="li-fg-t">Avisos de ' + texto(ctx.titulo) + '</h3><ul class="li-p-lista">' +
          conPref.avisos.map(function (x) {
            var usaDias = JSON.stringify(x.si || []).indexOf('dias"') >= 0;
            return '<li class="li-p-fila" data-g="av" data-id="' + texto(x.id) + '"><input type="checkbox" data-on aria-label="Avisar: ' + texto(x.titulo) + '"' + (x.activo !== false ? ' checked' : '') + '>' +
              '<span class="li-p-t">' + texto(x.titulo) + (x.texto ? '<small class="u-nota">' + texto(x.texto) + '</small>' : '') + '</span>' +
              (usaDias ? '<label class="li-p-dias">con <input type="number" min="0" max="365" inputmode="numeric" data-dias value="' + (x.dias === undefined ? 7 : x.dias) + '"> días</label>' : '') + '</li>';
          }).join('') + '</ul></section>';
        h += '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-guardar>Guardar</button><button type="button" class="u-btn u-btn-texto" data-defecto>Volver a como venía</button></div>';
        abrirVentana(h);
        var fin = function (donde) { ctx.aviso('Guardado ' + donde + '.'); }, mal = function (e) { ctx.aviso('No se ha guardado: ' + ((e && e.message) || e)); };
        vent.querySelector('[data-defecto]').addEventListener('click', function () {
          cerrarVentana();
          if (window.UN.ordenMenu) window.UN.ordenMenu([]);
          Promise.all([guardarPref(ctx.id, {}, pintar), menu.length > 1 ? guardarPref(MENU, []) : null]).then(function (r) { fin(r[0]); }, mal);
        });
        vent.querySelector('[data-guardar]').addEventListener('click', function () {
          var n = { vistas: [], ocultas: [], avisos: {} };
          var vis = vent.querySelectorAll('[data-g=vi]');
          if (vis.length) {
            n.vistas = [].map.call(vis, function (li) { return li.getAttribute('data-id'); });
            n.ocultas = [].filter.call(vis, function (li) { return !li.querySelector('[data-ver]').checked; }).map(function (li) { return li.getAttribute('data-id'); });
            if (n.ocultas.length === n.vistas.length) { ctx.aviso('Deja al menos una vista.'); return; }
          }
          [].forEach.call(vent.querySelectorAll('[data-g=av]'), function (li) {
            var d = li.querySelector('[data-dias]'), o = { activo: li.querySelector('[data-on]').checked };
            if (d && d.value !== '' && isFinite(+d.value)) o.dias = Math.max(0, Math.min(365, Math.round(+d.value)));
            n.avisos[li.getAttribute('data-id')] = o;
          });
          var orden = [].map.call(vent.querySelectorAll('[data-g=menu]'), function (li) { return li.getAttribute('data-id'); });
          cerrarVentana();
          var ps = [guardarPref(ctx.id, n, pintar)];
          if (orden.length && JSON.stringify(orden) !== JSON.stringify(menu.map(function (s) { return s.id; }))) { ps.push(guardarPref(MENU, orden)); window.UN.ordenMenu(orden); }
          Promise.all(ps).then(function (r) { fin(r[0]); }, mal);
        });
      }

      /* ---------- eventos ---------- */
      cont.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-vista],[data-aviso],[data-id],[data-pers],[data-nueva]');
        if (!t) return;
        if (t.hasAttribute('data-vista')) { S.vista = t.getAttribute('data-vista'); S.aviso = ''; guardado(K + 'vista', S.vista); pintar(); return; }
        if (t.hasAttribute('data-aviso')) { var x = t.getAttribute('data-aviso'); S.aviso = S.aviso === x ? '' : x; pintar(); return; }
        if (t.hasAttribute('data-pers')) { personalizar(); return; }
        if (t.hasAttribute('data-nueva')) { ficha(null, true); return; }
        ficha(t.getAttribute('data-id'));
      });
      cont.addEventListener('keydown', function (ev) {
        if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('tr[data-id]')) { ev.preventDefault(); ficha(ev.target.getAttribute('data-id')); }
      });
      cont.addEventListener('input', function (ev) { if (ev.target.id === 'li-q') { S.q = ev.target.value; pintar(); } });
      // Tablero: arrastrar una tarjeta a otra columna cambia ese campo (con la capa de tablas: al momento y por detrás).
      // Con el ratón, a mano (pointer events), no con el arrastre del navegador: así va igual en todos los navegadores y
      // con las pruebas automáticas. En el móvil (dedo), el tablero se desliza de lado y el estado se cambia en la ficha.
      var arr = null, sinClic = false;
      function columnaEn(x, y) { var e = document.elementFromPoint(x, y); return e && e.closest ? e.closest('[data-soltar]') : null; }
      function soltarArrastre() {
        if (arr && arr.fantasma) arr.fantasma.remove();
        [].forEach.call(cont.querySelectorAll('.li-cogida,.li-encima'), function (x) { x.classList.remove('li-cogida', 'li-encima'); });
        arr = null;
      }
      cont.addEventListener('pointerdown', function (ev) {
        if (ev.pointerType === 'touch' || ev.button !== 0) return;
        var b = ev.target.closest && ev.target.closest('.li-tarjeta[data-mover]'); if (!b) return;
        arr = { id: b.getAttribute('data-id'), b: b, x: ev.clientX, y: ev.clientY, moviendo: false, fantasma: null };
      });
      document.addEventListener('pointermove', alMover = function (ev) {
        if (!arr) return;
        if (!arr.moviendo) {
          if (Math.abs(ev.clientX - arr.x) + Math.abs(ev.clientY - arr.y) < 6) return; // un clic no es arrastrar
          arr.moviendo = true; arr.b.classList.add('li-cogida');
          var r = arr.b.getBoundingClientRect(), g = arr.b.cloneNode(true);
          g.className += ' li-fantasma'; g.style.width = r.width + 'px'; g.setAttribute('aria-hidden', 'true');
          arr.dx = arr.x - r.left; arr.dy = arr.y - r.top; arr.fantasma = g; cont.appendChild(g);
        }
        ev.preventDefault();
        arr.fantasma.style.left = (ev.clientX - arr.dx) + 'px'; arr.fantasma.style.top = (ev.clientY - arr.dy) + 'px';
        var col = columnaEn(ev.clientX, ev.clientY);
        [].forEach.call(cont.querySelectorAll('.li-encima'), function (x) { if (x !== col) x.classList.remove('li-encima'); });
        if (col) col.classList.add('li-encima');
        // Cerca del borde del tablero, se desplaza solo: la última columna puede no caber (Hecha, en un portátil).
        var tb = cont.querySelector('.li-tablero');
        if (tb) { var rc = tb.getBoundingClientRect(); if (ev.clientX > rc.right - 60) tb.scrollLeft += 24; else if (ev.clientX < rc.left + 60) tb.scrollLeft -= 24; }
      });
      document.addEventListener('pointerup', alSoltar = function (ev) {
        if (!arr) return;
        var era = arr, col = era.moviendo ? columnaEn(ev.clientX, ev.clientY) : null;
        soltarArrastre();
        if (!era.moviendo) return; // fue un clic: abre la ficha
        sinClic = true; setTimeout(function () { sinClic = false; }, 0);
        if (!col) return;
        var a = ap(), c = cont.querySelector('.li-tablero').getAttribute('data-campo'), v = col.getAttribute('data-valor');
        var f = filaVista(a, era.id), cp = campo(a, c);
        if (!f || norm(f[c]) === norm(v)) return;
        var cambios = {}; cambios[c] = cp.ids && v in cp.ids ? cp.ids[v] : v; // una columna que apunta a otra tabla guarda el código
        Promise.resolve(T.actualizar(a.tabla, era.id, cambios)).then(function () { ctx.aviso('Movida a «' + (v || 'sin ' + campo(a, c).titulo.toLowerCase()) + '».'); }, function (e) { ctx.aviso('No se ha movido: ' + ((e && e.message) || e)); });
      });
      document.addEventListener('pointercancel', alCancelar = function () { soltarArrastre(); });
      // Después de arrastrar no se abre la ficha (el navegador manda un clic al soltar).
      cont.addEventListener('click', function (ev) { if (sinClic) { ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
      velo.addEventListener('click', function (ev) {
        if (ev.target === velo || ev.target.closest('[data-cerrar]')) { cerrarVentana(); return; }
        if (ev.target.closest('[data-volver]')) { velo.classList.remove('abierto'); ctx.volver(); return; }
        if (ev.target.closest('[data-claude]')) { copiarClaude(); return; }
        // Personalizar: subir y bajar una sección del menú o una vista.
        var b = ev.target.closest('[data-sube],[data-baja]');
        if (b) {
          var li = b.closest('li'), ul = li.parentNode;
          if (b.hasAttribute('data-sube') && li.previousElementSibling) ul.insertBefore(li, li.previousElementSibling);
          else if (b.hasAttribute('data-baja') && li.nextElementSibling) ul.insertBefore(li.nextElementSibling, li);
          [].forEach.call(ul.children, function (x, i) { x.querySelector('[data-sube]').disabled = i === 0; x.querySelector('[data-baja]').disabled = i === ul.children.length - 1; });
          b.focus();
          return;
        }
        // Un enlace a otra sección (lo relacionado): el marco lo abre; aquí solo se cierra la ventana.
        if (ev.target.closest('a[data-sx]')) velo.classList.remove('abierto');
      });
      teclaEsc = function (ev) { if (ev.key === 'Escape' && ctx.abierta() && velo.classList.contains('abierto')) cerrarVentana(); };
      document.addEventListener('keydown', teclaEsc);

      ctx.alCambiar(function (t) {
        if (t === PREF && window.UN.ordenMenu) { var m = prefDe(MENU); if (Array.isArray(m)) window.UN.ordenMenu(m); }
        if (tablas.indexOf(t) >= 0) pintar();
      });
      T.leer(tablas).then(function () {
        S.leido = true;
        // El orden del menú que ha guardado quien personaliza (para todos), por si este dispositivo aún no lo tiene.
        if (PREF && window.UN.ordenMenu) { var m = prefDe(MENU); if (Array.isArray(m)) window.UN.ordenMenu(m); }
        pintar();
        if (pedida) ficha(pedida);
      }, function (e) {
        cont.innerHTML = '<p class="u-error">No se han podido leer los datos: ' + texto((e && e.message) || e) + '</p>';
      });
    },
    cerrar: function () {
      if (teclaEsc) document.removeEventListener('keydown', teclaEsc); teclaEsc = null;
      if (alMover) document.removeEventListener('pointermove', alMover);
      if (alSoltar) document.removeEventListener('pointerup', alSoltar);
      if (alCancelar) document.removeEventListener('pointercancel', alCancelar);
      alMover = alSoltar = alCancelar = null;
    }
  });
})();
