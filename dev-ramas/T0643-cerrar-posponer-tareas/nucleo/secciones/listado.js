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
      nueva: cfg.NUEVA || {}, obligatorias: cfg.OBLIGATORIAS || [], filtros: cfg.FILTROS || [], filas: cfg.FILAS && cfg.FILAS.length ? cfg.FILAS : null,
      rapidas: rapidasDe(cfg.RAPIDAS), alta: cfg.ALTA && lista(cfg.ALTA.campos).length ? { campos: lista(cfg.ALTA.campos), mas: lista(cfg.ALTA.mas) } : null,
      deducir: cfg.DEDUCIR || {} };
  }
  /** T0643 · RAPIDAS de la configuración, con sus claves por defecto; null si no hay ninguna. */
  function rapidasDe(r) {
    if (!r || (!r.HECHA && !r.PASAR)) return null;
    var s = r.SIGUIENTE;
    return { hecha: r.HECHA && r.HECHA.campo ? { campo: r.HECHA.campo, valor: r.HECHA.valor } : null, pasar: r.PASAR || '', si: r.SI || [],
      siguiente: s && lista(s.con).length ? { con: lista(s.con), copia: lista(s.copia).length ? lista(s.copia) : lista(s.con), pone: s.pone || {} } : null };
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
    var t = [ap.nombre, ap.codigo, ap.orden].concat(ap.columnas, ap.detalle, ap.buscar || [], ap.filtros || []);
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
    lista(ap.filtros).forEach(function (c) { hay(c, 'FILTROS nombra'); });
    // T0630: cómo se llama cada fila al contarlas, [singular, plural] («tarea», «tareas»).
    var malFilas = function (x) { return x !== null && x !== undefined && !(Array.isArray(x) && !x.length) && !(Array.isArray(x) && x.length === 2 && x.every(function (t) { return typeof t === 'string' && t.trim(); })); };
    if (malFilas(cfg.FILAS)) errores.push(donde + 'FILAS tiene que ser [singular, plural], como ["tarea", "tareas"].');
    var vids = {};
    vistasDe(ap).forEach(function (v) {
      if (vids[v.id]) errores.push(donde + 'la vista «' + v.id + '» está dos veces.');
      if (malFilas(v.filas)) errores.push(donde + 'filas de la vista «' + v.id + '» tiene que ser [singular, plural], como ["nota", "notas"].');
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
    // T0643 · Lo de un toque (RAPIDAS), el alta (ALTA) y lo que se pone solo (DEDUCIR).
    var edTodo = ap.editar === true, sePuede = function (c) { return edTodo || ed.indexOf(c) >= 0; };
    var rp = ap.rapidas;
    if (cfg.RAPIDAS && !rp) errores.push(donde + 'RAPIDAS no dice ni HECHA ni PASAR.');
    if (rp) {
      if (cfg.RAPIDAS.HECHA && !rp.hecha) errores.push(donde + 'RAPIDAS.HECHA no dice su columna (campo).');
      if (rp.hecha) {
        hay(rp.hecha.campo, 'RAPIDAS.HECHA usa');
        if (vacio(rp.hecha.valor)) errores.push(donde + 'RAPIDAS.HECHA no dice qué valor pone (valor).');
        if (!sePuede(rp.hecha.campo)) errores.push(donde + 'RAPIDAS.HECHA cambia «' + rp.hecha.campo + '», que no está en EDITAR.');
      }
      if (rp.pasar) {
        hay(rp.pasar, 'RAPIDAS.PASAR usa');
        if (!sePuede(rp.pasar)) errores.push(donde + 'RAPIDAS.PASAR cambia «' + rp.pasar + '», que no está en EDITAR.');
        if (campo(ap, rp.pasar).tipo !== 'fecha') errores.push(donde + 'RAPIDAS.PASAR tiene que ser una fecha («' + rp.pasar + '» no lo es).');
      }
      lista(rp.si).forEach(function (cnd) { if (cnd.campo) hay(cnd.campo, 'RAPIDAS.SI usa'); });
      if (cfg.RAPIDAS.SIGUIENTE) {
        if (!rp.siguiente) errores.push(donde + 'RAPIDAS.SIGUIENTE no dice con quién (con).');
        else {
          if (!rp.hecha) errores.push(donde + 'RAPIDAS.SIGUIENTE se pregunta al cerrar: hace falta RAPIDAS.HECHA.');
          if (!ap.crear) errores.push(donde + 'RAPIDAS.SIGUIENTE crea una fila: hace falta CREAR.');
          rp.siguiente.con.concat(rp.siguiente.copia, Object.keys(rp.siguiente.pone)).forEach(function (c) { hay(c, 'RAPIDAS.SIGUIENTE usa'); });
        }
      }
    }
    if (cfg.ALTA && !ap.alta) errores.push(donde + 'ALTA no dice sus campos (campos).');
    if (ap.alta) ap.alta.campos.concat(ap.alta.mas).forEach(function (c) {
      var d = ap.campos[c];
      if (d && d.primero) { d.primero.forEach(function (p) { hay(p, 'ALTA usa'); if (!sePuede(p)) errores.push(donde + 'ALTA pide «' + c + '», pero «' + p + '» no está en EDITAR.'); }); return; }
      hay(c, 'ALTA usa');
      if (!sePuede(c)) errores.push(donde + 'ALTA pide «' + c + '», que no está en EDITAR.');
    });
    Object.keys(ap.deducir).forEach(function (c) {
      hay(c, 'DEDUCIR pone');
      if (!sePuede(c)) errores.push(donde + 'DEDUCIR pone «' + c + '», que no está en EDITAR.');
      Object.keys(ap.deducir[c] || {}).forEach(function (o) { hay(o, 'DEDUCIR mira'); });
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

  /** T0630 · Cuántas filas hay, con su nombre: «8 tareas», «1 tela» o, con algo puesto (búsqueda, filtros, un aviso),
   *  «3 de 8 clientes». El nombre, de filas en la vista o FILAS de la sección ([singular, plural]); sin decirlo, «filas». */
  function cuenta(ap, vista, n, total) {
    var p = [vista && vista.filas, ap.filas].filter(function (x) { return x && x.length === 2; })[0] || ['fila', 'filas'], todas = total === undefined || total === n;
    return (todas ? n : n + ' de ' + total) + ' ' + ((todas ? n : total) === 1 ? p[0] : p[1]);
  }
  /** T0630 · La línea de ayuda bajo las pestañas: la de la vista (qué es esa vista) o, si no tiene, la de la sección
   *  (TEXTO). Una vista con «texto»: «» no enseña ninguna. */
  function textoDe(ap, vista) { return vista && typeof vista.texto === 'string' ? vista.texto : (ap.texto || ''); }
  /** T0630 · Los campos de un apartado de la ficha, partidos en los que tienen algo (ver) y los vacíos, que salen juntos
   *  en una línea («Sin rellenar: Formato, Notas») en vez de uno debajo de otro con su guion. lleno(c) dice si tiene algo;
   *  los de siempre (los obligatorios: que se vea que faltan) no se esconden aunque estén vacíos. */
  function repartir(cs, lleno, siempre) {
    var r = { ver: [], vacios: [] };
    (cs || []).forEach(function (c) { (lleno(c) || (siempre || []).indexOf(c) >= 0 ? r.ver : r.vacios).push(c); });
    return r;
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
      if (o.filtros && !cumpleFiltros(ap, f, o.filtros, o.valores)) return false; // T0625: lo de «Filtrar»
      return true;
    });
    var ord = (vista && vista.orden) || ap.orden;
    return ord ? r.slice().sort(comparar(ord)) : r;
  }

  /* ---------- T0625 · filtros por columna («Filtrar») ----------
   * Lo que se elige en «Filtrar», encima de la vista, del buscador y del aviso elegido. Cada columna que se ve en la vista
   * (o las de FILTROS) se filtra según lo que lleva: una lista (un estado, sus opciones, lo que apunta a otra tabla, Sí o
   * No, o un texto con pocos valores distintos, como el proveedor), un rango (números, importes, porcentajes, calculados o
   * un texto que siempre es un número, como el gramaje «273») o unas fechas (desde y hasta). El texto libre, las notas, las
   * fotos y los enlaces, no: para eso está el buscador. Lo oculto de la vista (lo privado en la de clientes), tampoco.
   * filtros: { COLUMNA: { es: 'valor' } | { vacio: true } | { min, max } | { desde, hasta } } (fechas aaaa-mm-dd). */
  var MAX_LISTA = 40; // más valores distintos que esto es un texto libre: se busca, no se elige de una lista
  function nada(v) { return vacio(v) || (typeof v === 'number' && isNaN(v)); }
  /** Un número o un intervalo escrito como texto («273», «1.020 ₹», «400–500», «400 - 500») → [mínimo, máximo]; null si no lo es. */
  function aIntervalo(v) {
    var n = aNumero(v);
    if (!isNaN(n)) return [n, n];
    if (typeof v !== 'string') return null;
    var m = /^\s*(.+?)\s*(?:[–—]|\s-\s|(?<=\d)-(?=\d))\s*(.+?)\s*$/.exec(v);
    if (!m) return null;
    var a = aNumero(m[1]), b = aNumero(m[2]);
    return isNaN(a) || isNaN(b) ? null : [Math.min(a, b), Math.max(a, b)];
  }
  function valorDe(ap, c, f, valores) { var cp = campo(ap, c); return cp.calculo ? calcular(cp.calculo, f, valores) : f[c]; }
  /** Las columnas que se pueden filtrar en esta vista con estas filas: [{ campo, titulo, tipo: lista|rango|fecha, opciones, vacios, unidad }]. */
  function filtrables(ap, vista, filas, valores) {
    var fuera = ocultas(ap, vista), r = [];
    var cs = ap.filtros && ap.filtros.length ? ap.filtros : columnasDe(ap, vista).concat(ap.detalle || []);
    cs.forEach(function (c) {
      // El código y el nombre de cada fila se buscan: no se eligen de una lista (salvo que FILTROS los pida).
      var pedido = !!(ap.filtros && ap.filtros.length);
      if (!c || fuera.indexOf(c) >= 0 || r.some(function (x) { return x.campo === c; }) || (!pedido && (c === ap.codigo || c === ap.nombre))) return;
      var cp = campo(ap, c);
      if (/^(nota|foto|enlace|email|telefono)$/.test(cp.tipo)) return;
      var vs = filas.map(function (f) { return valorDe(ap, c, f, valores); }), llenos = vs.filter(function (v) { return !nada(v); });
      var hayVacios = llenos.length < vs.length, base = { campo: c, titulo: cp.titulo, vacios: hayVacios };
      if (!llenos.length) return;
      if (cp.tipo === 'fecha') { if (llenos.some(aFecha)) r.push(Object.assign(base, { tipo: 'fecha' })); return; }
      var distintos = [];
      llenos.forEach(function (v) { var s = String(v).trim(); if (distintos.map(norm).indexOf(norm(s)) < 0) distintos.push(s); });
      var esLista = cp.ids || cp.opciones || /^(estado|sino)$/.test(cp.tipo);
      var numeros = llenos.every(function (v) { return aIntervalo(v) !== null; });
      if (!esLista && (/^(importe|numero|porcentaje)$/.test(cp.tipo) || cp.calculo || numeros)) {
        if (distintos.length > 1 && numeros) r.push(Object.assign(base, { tipo: 'rango', unidad: cp.tipo === 'porcentaje' ? '%' : (cp.unidad || (cp.tipo === 'importe' ? '€' : '')) }));
        return;
      }
      if (distintos.length > MAX_LISTA || distintos.length + (hayVacios ? 1 : 0) < 2) return;
      // Un texto sin opciones solo es una lista si se repite (la ciudad, con quién): si cada fila dice una cosa, es texto libre.
      if (!esLista && !pedido && distintos.length === llenos.length) return;
      var ops = (cp.opciones || []).filter(function (o) { return distintos.map(norm).indexOf(norm(o)) >= 0; });
      distintos.slice().sort(function (a, b) { return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }); })
        .forEach(function (v) { if (ops.map(norm).indexOf(norm(v)) < 0) ops.push(v); });
      r.push(Object.assign(base, { tipo: 'lista', opciones: ops }));
    });
    return r;
  }
  /** Si una fila (como se ve) cumple los filtros puestos. */
  function cumpleFiltros(ap, f, filtros, valores) {
    return Object.keys(filtros || {}).every(function (c) {
      var x = filtros[c], v = valorDe(ap, c, f, valores);
      if (!x) return true;
      if (x.vacio) return nada(v);
      if (x.es !== undefined) return !nada(v) && norm(v) === norm(x.es);
      if (x.min !== undefined || x.max !== undefined) {
        // Un intervalo («400–500») entra si se cruza con lo pedido: «de 450 a 600» lo incluye.
        var iv = aIntervalo(v);
        if (!iv) return false;
        if (campo(ap, c).tipo === 'porcentaje') iv = iv.map(function (n) { return Math.round(n * 100 * 1e6) / 1e6; }); // se escribe 30, no 0,3
        if (typeof x.min === 'number' && iv[1] < x.min) return false;
        if (typeof x.max === 'number' && iv[0] > x.max) return false;
        return true;
      }
      if (x.desde || x.hasta) {
        var d = aFecha(v);
        if (!d) return false;
        if (x.desde && aFecha(x.desde) && d < aFecha(x.desde)) return false;
        if (x.hasta && aFecha(x.hasta) && d > aFecha(x.hasta)) return false;
      }
      return true;
    });
  }
  /** Solo los filtros que valen en esta vista (de columnas que se pueden filtrar en ella) y que dicen algo. */
  function filtrosQueValen(filtros, disponibles) {
    var r = {}, ids = disponibles.map(function (x) { return x.campo; });
    Object.keys(filtros || {}).forEach(function (c) {
      var x = filtros[c];
      if (!x || ids.indexOf(c) < 0) return;
      if (x.vacio || (x.es !== undefined && x.es !== '') || typeof x.min === 'number' || typeof x.max === 'number' || x.desde || x.hasta) r[c] = x;
    });
    return r;
  }
  /** Lo que dice la etiqueta de un filtro puesto: «Proveedor: Ramesh», «Gramaje: de 120 a 180», «Fecha: desde el 01/11/2026». */
  function textoFiltro(d, x) {
    var u = d.unidad ? (d.unidad === '%' ? ' %' : ' ' + d.unidad) : '';
    var n = function (v) { return num(v, v % 1 === 0 ? 0 : (Math.round(v * 10) / 10 === v ? 1 : 2)); }; // la unidad, una vez, al final
    if (x.vacio) return 'Sin ' + d.titulo.toLowerCase();
    if (x.es !== undefined) return d.titulo + ': ' + x.es;
    var hayMin = typeof x.min === 'number', hayMax = typeof x.max === 'number';
    if (hayMin || hayMax) return d.titulo + ': ' + (hayMin && hayMax ? (x.min === x.max ? n(x.min) : 'de ' + n(x.min) + ' a ' + n(x.max)) : (hayMin ? 'desde ' + n(x.min) : 'hasta ' + n(x.max))) + u;
    if (x.desde && x.hasta) return d.titulo + ': ' + (x.desde === x.hasta ? 'el ' + fechaCorta(x.desde) : 'del ' + fechaCorta(x.desde) + ' al ' + fechaCorta(x.hasta));
    return d.titulo + ': ' + (x.desde ? 'desde el ' + fechaCorta(x.desde) : 'hasta el ' + fechaCorta(x.hasta));
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

  /** T0624 · Una señal por cosa: la fecha que hace saltar un aviso de nivel alto (vencido) o medio (pendiente) se pinta con
   *  su color, y la franja de la fila con el mismo; lo demás (estado, botones de aviso) va neutro. Da el nivel del primer
   *  aviso de la fila que mira esa columna, o '' (ninguno, o solo de nivel info: «Sin fecha» no pinta nada). */
  function nivelDeCampo(avs, c) {
    for (var i = 0; i < (avs || []).length; i++) {
      var n = avs[i].nivel || 'medio';
      if ((n === 'alto' || n === 'medio') && lista(avs[i].si).some(function (x) { return x && x.campo === c; })) return n;
    }
    return '';
  }

  /** T0610 · La columna que ya dicen los títulos de los grupos (agrupar por FASE: cada grupo es una fase), que en la tabla
   *  y en las tarjetas sobra; '' si no hay (sin agrupar, o por plazo de una fecha: la fecha exacta sí dice algo). */
  function columnaDelGrupo(vista) {
    var g = vista && vista.agrupar;
    if (!g || g.por === 'plazo') return '';
    return String(g.campo || g);
  }

  /** T0633 · La columna de foto que lleva la tarjeta del móvil: la primera de tipo foto entre las que se ven en la vista
   *  (aunque no esté en DETALLE: en el móvil, una tela se reconoce por su foto); '' si la vista no tiene ninguna. */
  function fotoDeTarjeta(a, cols) {
    return (cols || []).filter(function (c) { return campo(a, c).tipo === 'foto'; })[0] || '';
  }
  /** T0633 · Lo que sale en lugar de una foto que no se puede ver (la de Drive no compartida «con el enlace»: en la app del
   *  móvil no hay sesión de Google, o quien mira no tiene permiso). En la ficha, el porqué entero; en una miniatura, corto. */
  var SIN_FOTO = { corto: 'No se ve', largo: 'No se puede ver la foto aquí. Para que se vea en la app (también en el móvil), su carpeta de Drive tiene que estar compartida como «Cualquier persona con el enlace».' };

  /* ---------- T0643 · Cerrar, pasar y apuntar en un toque ----------
   * RAPIDAS: { HECHA: { campo, valor }, PASAR: columna de fecha, SI: [condiciones], SIGUIENTE: { con, copia, pone } }.
   * Las filas que cumplen SI (y no tienen ya el valor de HECHA) llevan un círculo que las cierra y «Pasar» (mañana, una
   * semana u otro día); al cerrar una que es con alguien de SIGUIENTE.con, se pregunta el siguiente paso con él. */
  var DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function isoDe(d) { return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function masDias(hoy, n) { var d = aFecha(hoy); d.setDate(d.getDate() + n); return isoDe(d); }
  /** «jue 19»: el día de la semana y del mes, para que se vea a qué día va. */
  function diaCorto(iso) { var d = aFecha(iso); return d ? DIAS_SEMANA[d.getDay()].slice(0, 3) + ' ' + d.getDate() : ''; }
  /** A qué días se puede pasar algo, desde hoy (no desde la fecha que tenía). Si mañana es sábado o domingo, se ofrecen
   *  los dos, mañana y el lunes (Javi, 18/11/2026): que elija. titulo, para el menú; corto, para los botones de la ficha. */
  function opcionesPasar(hoy) {
    var m = masDias(hoy, 1), dm = aFecha(m).getDay(), r = [];
    if (dm === 6 || dm === 0) {
      r.push({ fecha: m, titulo: 'Mañana, ' + DIAS_SEMANA[dm], corto: 'Pasar al ' + DIAS_SEMANA[dm] });
      r.push({ fecha: masDias(hoy, dm === 6 ? 3 : 2), titulo: 'El lunes', corto: 'Pasar al lunes' });
    } else r.push({ fecha: m, titulo: 'Mañana', corto: 'Pasar a mañana' });
    r.push({ fecha: masDias(hoy, 7), titulo: 'En una semana', corto: '+1 semana' });
    return r;
  }
  /** Para cuándo se apunta el siguiente paso: el primer día de trabajo, en 3 días o en una semana. */
  function fechasSiguiente(hoy) {
    var p = opcionesPasar(hoy), lab = p.length > 2 ? p[1] : p[0];
    return [{ fecha: lab.fecha, titulo: lab.titulo }, { fecha: masDias(hoy, 3), titulo: 'En 3 días' }, { fecha: masDias(hoy, 7), titulo: 'En una semana' }];
  }
  /** Si una fila (como se ve, con nombres) lleva el círculo y «Pasar». */
  function rapidaEn(ap, f, hoy) {
    var r = ap.rapidas;
    if (!r || !f) return false;
    if (r.hecha && norm(f[r.hecha.campo]) === norm(r.hecha.valor)) return false;
    return cumple(f, r.si, { hoy: hoy });
  }
  /** El código de un valor dicho por su nombre en una columna que apunta a otra tabla («Hecha» → EST04); si no, tal cual. */
  function codigoDe(ap, c, v) { var cp = campo(ap, c); return cp.ids && v in cp.ids ? cp.ids[v] : v; }
  /** Con quién se pregunta el siguiente paso al cerrar una fila (la de verdad, con códigos): la primera columna de
   *  SIGUIENTE.con que tiene algo, o '' (no se pregunta). */
  function siguienteCon(ap, crudo) {
    var s = ap.rapidas && ap.rapidas.siguiente;
    return s ? s.con.filter(function (c) { return !vacio((crudo || {})[c]); })[0] || '' : '';
  }
  /** DEDUCIR: { DESTINO: { ORIGEN: nombre } }. Lo que se pone solo en una fila (con códigos) que tiene vacío el destino y
   *  algo en un origen: { ID_TEMA: 'TEM01' } (marca → Clientes). Lo que ya tiene algo no se toca. */
  function deducidos(ap, crudo) {
    var r = {};
    Object.keys(ap.deducir || {}).forEach(function (c) {
      if (!vacio((crudo || {})[c])) return;
      var o = Object.keys(ap.deducir[c] || {}).filter(function (x) { return !vacio((crudo || {})[x]); })[0];
      if (o) r[c] = codigoDe(ap, c, ap.deducir[c][o]);
    });
    return r;
  }
  /** La fila del siguiente paso, al cerrar crudo: lo de SIGUIENTE.copia de la que se cierra (con quién, el área), el texto
   *  en el nombre, la fecha en PASAR, lo de SIGUIENTE.pone (por nombre) y, si falta, lo que se deduce. */
  function filaSiguiente(ap, crudo, txt, fecha) {
    var s = ap.rapidas.siguiente, r = {};
    s.copia.forEach(function (c) { if (!vacio(crudo[c])) r[c] = crudo[c]; });
    Object.keys(s.pone).forEach(function (c) { r[c] = codigoDe(ap, c, s.pone[c]); });
    r[ap.nombre] = txt;
    if (ap.rapidas.pasar && fecha) r[ap.rapidas.pasar] = fecha;
    var d = deducidos(ap, r); Object.keys(d).forEach(function (c) { r[c] = d[c]; });
    return r;
  }

  var CALC = { opcionesPasar: opcionesPasar, fechasSiguiente: fechasSiguiente, rapidaEn: rapidaEn, siguienteCon: siguienteCon, deducidos: deducidos, filaSiguiente: filaSiguiente, codigoDe: codigoDe, diaCorto: diaCorto, masDias: masDias,
    imagen: imagen, fotoDeTarjeta: fotoDeTarjeta, SIN_FOTO: SIN_FOTO, sinRepetir: sinRepetir, nivelDeCampo: nivelDeCampo, columnaDelGrupo: columnaDelGrupo, titulo: titulo, aFecha: aFecha, diasHasta: diasHasta, aNumero: aNumero, cumple: cumple, calcular: calcular, usa: usa,
    valoresDe: valoresDe, prohibido: prohibido, tapar: tapar, num: num, textoProhibido: textoProhibido, apartado: apartado, campo: campo,
    ocultas: ocultas, vistasDe: vistasDe, enriquecer: enriquecer, preparar: preparar, seguir: seguir, conNombres: conNombres, nombradas: nombradas, columnasDe: columnasDe, comprobar: comprobar, aplicar: aplicar, mover: mover, paraClaude: paraClaude, cuenta: cuenta, textoDe: textoDe, repartir: repartir,
    avisosDe: avisosDe, avisosActivos: avisosActivos, filtrar: filtrar, agrupar: agrupar, columnasTablero: columnasTablero,
    relacionadas: relacionadas, verTexto: verTexto, cuando: cuando, comparar: comparar,
    filtrables: filtrables, aIntervalo: aIntervalo, cumpleFiltros: cumpleFiltros, filtrosQueValen: filtrosQueValen, textoFiltro: textoFiltro };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) {} return ''; }
  function hoyIso() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function json(t) { try { return JSON.parse(t || 'null'); } catch (e) { return null; } }
  var ICONO_AJUSTAR = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>';
  var ICONO_X = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICONO_FILTRO = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4 1.5v-8L4 5z"/></svg>';
  var ICONO_COPIAR = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';
  var ICONO_OK = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  var ICONO_RELOJ = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>';
  var MENU = 'MENU'; // la fila de PREFERENCIAS con el orden del menú
  var teclaEsc = null, alMover = null, alSoltar = null, alCancelar = null, alDesplazar = null; // oyentes del documento, para quitarlos al cerrar

  window.UN.registrar('LISTADO', {
    abrir: function (el, ctx) {
      var T = ctx.tablas, cfg = ctx.config || {}, PROHIB = cfg.PROHIBIDO === undefined ? PROHIB_DEFECTO : cfg.PROHIBIDO;
      var BASE = apartado(cfg, ctx.id, ctx.titulo), PREF = cfg.PREFERENCIAS || '';
      var puedePersonalizar = !!ctx.admin || (cfg.PERSONALIZAN || []).indexOf(ctx.perfil) >= 0;
      var K = 'li_' + ctx.id + '_';
      // T0625: los filtros (S.filtros) no se recuerdan: al volver a la sección, se ve todo.
      var S = { vista: guardado(K + 'vista'), q: '', aviso: '', filtros: {}, leido: false, menu: '' };
      var url = new URLSearchParams(location.search), pedida = url.get('ficha');

      el.innerHTML = '<div id="li-cont"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<div class="u-velo" id="li-velo"><div class="u-ventana li-ventana" role="dialog" aria-modal="true" aria-labelledby="li-vt"><div class="n-ventana" id="li-vent"></div></div></div>' +
        '<div class="u-aviso li-deshacer" id="li-deshacer" role="status" hidden><span></span><button type="button" data-deshacer>Deshacer</button></div>';
      var cont = el.querySelector('#li-cont'), velo = el.querySelector('#li-velo'), vent = el.querySelector('#li-vent'), avDes = el.querySelector('#li-deshacer');
      // T0602: una foto que no se puede ver (un archivo de Drive que no es público ni de quien mira) no sale rota.
      // T0633: en su lugar, un aviso (en la ficha, con el porqué; el enlace «Ver foto ↗» sigue al lado), no un hueco.
      el.addEventListener('error', function (e) {
        var t = e.target; if (!t || !t.hasAttribute || !t.hasAttribute('data-li-foto') || !t.parentNode) return;
        var grande = /\bli-foto\b/.test(t.className), s = document.createElement('span');
        s.className = 'li-nofoto' + (grande ? ' li-nofoto-g' : '') + (/\bli-t-img\b/.test(t.className) ? ' li-t-img' : '');
        s.textContent = grande ? SIN_FOTO.largo : SIN_FOTO.corto;
        if (!grande) s.title = SIN_FOTO.largo;
        t.parentNode.replaceChild(s, t);
      }, true);

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
            (/^https?:/i.test(String(v)) ? ' <a class="u-nota li-verfoto" href="' + texto(v) + '" target="_blank" rel="noopener">Ver foto ↗</a>' : '');
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
      /** T0624 · Una fecha que hace saltar un aviso de vencido o pendiente, con su color (y su palabra: «hace 3 días», «hoy»). */
      function fechaAviso(a, c, h, avs) {
        var n = campo(a, c).tipo === 'fecha' ? nivelDeCampo(avs, c) : '';
        return n && h.indexOf('class="li-nada"') < 0 ? '<span class="li-fecha li-' + n + '">' + h + '</span>' : h;
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
        var ayuda = textoDe(a, vista);
        if (ayuda) html += '<p class="u-nota li-texto">' + texto(ayuda) + '</p>';
        if (vista.cliente) {
          var nombres = []; ocultas(a, vista).forEach(function (c) { var t = campo(a, c).titulo; if (nombres.indexOf(t) < 0) nombres.push(t); });
          html += '<p class="li-cliente">Vista para enseñar a un cliente: sin avisos y sin ' + (nombres.length ? nombres.map(function (t) { return t.toLowerCase(); }).join(', ').replace(/, ([^,]*)$/, ' ni $1') : 'los datos privados') + '.</p>';
        }
        var deVista = filtrar(a, vista, todas, { hoy: hoy });
        var avs = vista.cliente ? [] : avisosActivos(a).map(function (x) { return { a: x, n: filtrar(a, vista, todas, { hoy: hoy, aviso: x.id }).length }; }).filter(function (x) { return x.n; });
        if (S.aviso && !avs.some(function (x) { return x.a.id === S.aviso; })) S.aviso = '';
        // T0625: los filtros que no valen en esta vista (una columna que no se ve, lo privado en la de clientes) se quitan.
        var disp = filtrables(a, vista, deVista, VAL);
        S.filtros = filtrosQueValen(S.filtros, disp);
        var nf = Object.keys(S.filtros).length;
        var fs = filtrar(a, vista, todas, { hoy: hoy, q: S.q, aviso: S.aviso, filtros: S.filtros, valores: VAL });
        html += '<div class="li-barra"><div class="li-buscar"><label class="u-oculto" for="li-q">Buscar</label><input id="li-q" type="search" placeholder="Buscar en ' + texto((a.titulo || '').toLowerCase()) + '" value="' + texto(S.q) + '" autocomplete="off"></div>' +
          (disp.length ? '<button type="button" class="u-btn li-filtrar" data-filtrar aria-haspopup="dialog"' + (nf ? ' aria-pressed="true"' : '') + '>' + ICONO_FILTRO + 'Filtrar' + (nf ? ' <span class="li-nf" aria-label="' + nf + (nf === 1 ? ' puesto' : ' puestos') + '">' + nf + '</span>' : '') + '</button>' : '') +
          '<span class="u-nota li-cuenta">' + texto(cuenta(a, vista, fs.length, deVista.length)) + '</span>' +
          (a.crear && editables(a).length && !vista.cliente ? '<button type="button" class="u-btn u-btn-accion li-nueva" data-nueva>Añadir</button>' : '') + '</div>';
        // Los filtros puestos, a la vista: cada uno se quita con su ✕, o todos a la vez.
        if (nf) html += '<div class="li-filtros" role="group" aria-label="Filtros puestos">' + disp.filter(function (d) { return S.filtros[d.campo]; }).map(function (d) {
          var t = textoFiltro(d, S.filtros[d.campo]);
          return '<button type="button" class="li-fchip" data-quitar="' + texto(d.campo) + '" aria-label="Quitar el filtro ' + texto(t) + '">' + texto(t) + ICONO_X + '</button>';
        }).join('') + '<button type="button" class="u-btn u-btn-texto li-fquitar" data-quitar="">Quitar filtros</button></div>';
        if (avs.length) html += '<div class="li-avisos" role="group" aria-label="Avisos">' + avs.map(function (x) {
          return '<button type="button" class="li-av li-' + texto(x.a.nivel || 'medio') + '" data-aviso="' + texto(x.a.id) + '" aria-pressed="' + (S.aviso === x.a.id) + '"><b>' + x.n + '</b> ' + texto(x.a.titulo) + '</button>';
        }).join('') + (S.aviso ? '<button type="button" class="u-btn u-btn-texto" data-aviso="">Ver todas</button>' : '') + '</div>';
        if (!todas.length) html += '<p class="u-vacio">' + texto(a.vacio || 'Todavía no hay nada en ' + (a.titulo || '').toLowerCase() + '.') + '</p>';
        else if (!fs.length) html += '<p class="u-vacio">' + (S.q ? 'Nada con «' + texto(S.q) + '»' + (nf ? ' y estos filtros.' : '.') : (nf ? 'Nada con estos filtros.' : 'Nada en esta vista.')) + '</p>';
        else if (vista.tablero) html += pintarTablero(a, vista, fs, hoy);
        else html += pintarGrupos(a, vista, agrupar(a, vista, fs, hoy), hoy);
        if (vista.tablero || !conRapidas(a, vista)) S.menu = '';
        html += menuPasar(hoy);
        // Si no ha cambiado nada (un refresco por detrás con lo mismo), no se rehace: un toque a medias en una fila no se pierde.
        if (html === pintado) return;
        pintado = html;
        var foco = document.activeElement && document.activeElement.id === 'li-q' ? document.activeElement.selectionStart : null;
        cont.innerHTML = html;
        if (foco !== null) { var q = cont.querySelector('#li-q'); q.focus(); try { q.setSelectionRange(foco, foco); } catch (e) {} }
        colocarMenu();
      }

      /* ---------- T0643 · cerrar, pasar y apuntar en un toque ---------- */
      var tDes = 0;
      /** Un aviso con «Deshacer» (8 segundos): lo que se acaba de hacer se puede volver atrás. */
      function deshacible(txt, deshacer) {
        avDes.querySelector('span').textContent = txt;
        avDes.hidden = false; avDes._deshacer = deshacer;
        clearTimeout(tDes);
        tDes = setTimeout(function () { avDes.hidden = true; avDes._deshacer = null; }, 8000);
      }
      function sinDeshacer() { clearTimeout(tDes); avDes.hidden = true; avDes._deshacer = null; }
      function mal(que) { return function (e) { ctx.aviso('No se ha ' + que + ': ' + ((e && e.message) || e)); }; }
      /** El nombre corto de una fila para un aviso: su código o, sin él, su nombre (cortado). */
      function quien(a, f) { var t = !vacio(f[a.codigo]) ? f[a.codigo] : String(f[a.nombre] || ''); return t.length > 40 ? t.slice(0, 38) + '…' : t; }
      function marcarHecha(id) {
        var a = ap(), r = a.rapidas, f = filaVista(a, id);
        if (!f || !r || !r.hecha) return;
        var crudo = f.__crudo || f, c = r.hecha.campo, antes = {}, cambios = {};
        antes[c] = vacio(crudo[c]) ? '' : crudo[c];
        cambios[c] = codigoDe(a, c, r.hecha.valor);
        var volver = function () { return Promise.resolve(T.actualizar(a.tabla, id, antes)).then(null, mal('deshecho')); };
        Promise.resolve(T.actualizar(a.tabla, id, cambios)).then(null, mal('guardado'));
        var con = siguienteCon(a, crudo);
        if (con) { sinDeshacer(); siguientePaso(a, f, con, volver); }
        else deshacible(r.hecha.valor + ': ' + quien(a, f), volver);
      }
      function pasar(id, fecha) {
        var a = ap(), c = a.rapidas && a.rapidas.pasar, f = filaVista(a, id);
        if (!f || !c || !fecha) return;
        var crudo = f.__crudo || f, antes = {}, cambios = {};
        antes[c] = vacio(crudo[c]) ? '' : crudo[c]; cambios[c] = fecha;
        Promise.resolve(T.actualizar(a.tabla, id, cambios)).then(null, mal('guardado'));
        deshacible(quien(a, f) + ' pasa al ' + diaCorto(fecha), function () { return Promise.resolve(T.actualizar(a.tabla, id, antes)).then(null, mal('deshecho')); });
      }
      /** «Otro día…»: una ventana con el calendario. */
      function pasarOtroDia(id) {
        var a = ap(), f = filaVista(a, id); if (!f) return;
        abrirVentana('<div class="li-ficha-cab"><h2 id="li-vt">Pasar a otro día</h2><button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Cerrar">' + ICONO_X + '</button></div>' +
          '<p class="u-nota">' + texto(quien(a, f)) + '</p><form id="li-fotro" class="li-form" novalidate><div class="u-campo"><label class="u-etiqueta" for="li-otro">Día</label>' +
          '<input id="li-otro" type="date" value="' + texto(masDias(hoyIso(), 1)) + '"></div><div class="n-botones"><button type="submit" class="u-btn u-btn-accion">Pasar</button></div></form>');
        vent.querySelector('#li-fotro').addEventListener('submit', function (ev) {
          ev.preventDefault();
          var v = vent.querySelector('#li-otro').value; if (!v) return;
          cerrarVentana(); pasar(id, v);
        });
      }
      /** Al cerrar una fila que es con alguien (una marca, un proveedor): ¿cuál es el siguiente paso con él? La ✕, tocar fuera
       *  o Esc vuelven atrás (la fila sigue sin cerrar); «No hay siguiente paso» la deja cerrada sin apuntar nada. */
      function siguientePaso(a, f, con, volver) {
        var hoy = hoyIso(), fs = fechasSiguiente(hoy), crudo = f.__crudo || f;
        // Viene marcado «En 3 días»; si cae en fin de semana, el primer día de trabajo.
        var d3 = aFecha(fs[1].fecha).getDay(), marcado = d3 === 0 || d3 === 6 ? 0 : 1;
        var h = '<div class="li-ficha-cab"><p class="li-sig-ok">' + ICONO_OK + texto(a.rapidas.hecha.valor) + ': ' + texto(quien(a, f)) + '</p>' +
          '<button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Volver sin cerrarla" title="Volver sin cerrarla">' + ICONO_X + '</button></div>' +
          '<h2 id="li-vt">¿Cuál es el siguiente paso con ' + texto(f[con] || '') + '?</h2>' +
          '<form id="li-fsig" class="li-form" novalidate><div class="u-campo u-ancho"><label class="u-etiqueta" for="li-sig">Siguiente paso</label>' +
          '<input id="li-sig" type="text" autocomplete="off" aria-describedby="li-sig-err"></div>' +
          (a.rapidas.pasar ? '<fieldset class="u-campo li-dias"><legend class="u-etiqueta">Cuándo</legend><div>' + fs.map(function (o, i) {
            return '<button type="button" class="li-dia" data-dia="' + o.fecha + '" aria-pressed="' + (i === marcado) + '">' + texto(o.titulo) + ' <small>' + texto(diaCorto(o.fecha)) + '</small></button>';
          }).join('') + '</div></fieldset>' : '') +
          '<p class="u-error" id="li-sig-err" role="alert" hidden></p>' +
          '<div class="n-botones"><button type="submit" class="u-btn u-btn-accion">Apuntar</button><button type="button" class="u-btn u-btn-texto" data-sig-no>No hay siguiente paso</button></div>' +
          '<p class="u-nota">¿Te has equivocado? Con la ✕, tocando fuera o con Esc, vuelves atrás y sigue sin cerrar.</p></form>';
        abrirVentana(h);
        alCerrar = volver;
        var form = vent.querySelector('#li-fsig'), inp = vent.querySelector('#li-sig');
        inp.focus();
        form.addEventListener('click', function (ev) {
          var d = ev.target.closest('[data-dia]');
          if (d) { [].forEach.call(form.querySelectorAll('[data-dia]'), function (x) { x.setAttribute('aria-pressed', String(x === d)); }); return; }
          if (ev.target.closest('[data-sig-no]')) {
            alCerrar = null; cerrarVentana();
            deshacible(a.rapidas.hecha.valor + ': ' + quien(a, f), volver);
          }
        });
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var t = inp.value.trim(), err = vent.querySelector('#li-sig-err'), p = prohibido(t, PROHIB);
          if (!t) { err.textContent = 'Escribe el siguiente paso, o pulsa «No hay siguiente paso».'; err.hidden = false; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
          if (p.length) { err.textContent = textoProhibido(p); err.hidden = false; inp.setAttribute('aria-invalid', 'true'); return; }
          var d = form.querySelector('[data-dia][aria-pressed="true"]');
          alCerrar = null; cerrarVentana();
          Promise.resolve(T.crear(a.tabla, filaSiguiente(a, crudo, t, d ? d.getAttribute('data-dia') : ''))).then(function () {
            ctx.aviso('Apuntado el siguiente paso con ' + (f[con] || '') + '.');
          }, mal('apuntado el siguiente paso'));
        });
      }
      /** T0643 · Si la sección cierra y pasa en un toque en esta vista (no en la de clientes; su columna se edita). */
      function conRapidas(a, vista) {
        var r = a.rapidas, ed = editables(a);
        return !!r && !vista.cliente && ((r.hecha && ed.indexOf(r.hecha.campo) >= 0) || (r.pasar && ed.indexOf(r.pasar) >= 0));
      }
      function circulo(a, f) {
        var r = a.rapidas, id = f[a.clave], cod = !vacio(f[a.codigo]) ? f[a.codigo] : f[a.nombre];
        if (!r.hecha || editables(a).indexOf(r.hecha.campo) < 0) return '';
        return '<button type="button" class="li-circ" data-hecha="' + texto(id) + '" aria-label="Marcar como ' + texto(String(r.hecha.valor).toLowerCase()) + ': ' + texto(cod) + '" title="Marcar como ' + texto(String(r.hecha.valor).toLowerCase()) + '">' + ICONO_OK + '</button>';
      }
      function botonPasar(a, f) {
        if (!a.rapidas.pasar || editables(a).indexOf(a.rapidas.pasar) < 0) return '';
        var id = String(f[a.clave]);
        return '<button type="button" class="u-btn li-pasar" data-pasar-menu="' + texto(id) + '" aria-haspopup="menu" aria-expanded="' + (S.menu === id) + '">' + ICONO_RELOJ + 'Pasar</button>';
      }
      /** El menú de «Pasar», fuera de la tabla (no lo corta su desplazamiento); se coloca junto a su botón al pintar. */
      function menuPasar(hoy) {
        if (!S.menu) return '';
        return '<div class="li-menu" role="menu" aria-label="Pasar a otro día">' + opcionesPasar(hoy).map(function (o) {
          return '<button type="button" role="menuitem" data-pasar-a="' + o.fecha + '" data-fila="' + texto(S.menu) + '">' + texto(o.titulo) + ' <small>' + texto(diaCorto(o.fecha)) + '</small></button>';
        }).join('') + '<button type="button" role="menuitem" data-pasar-otro="' + texto(S.menu) + '">Otro día…</button></div>';
      }
      function colocarMenu() {
        var m = cont.querySelector('.li-menu'); if (!m) return;
        var b = [].filter.call(cont.querySelectorAll('[data-pasar-menu]'), function (x) { return x.getAttribute('data-pasar-menu') === S.menu && x.offsetParent; })[0];
        if (!b) { S.menu = ''; m.remove(); pintado = ''; return; }
        var r = b.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
        m.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
        m.style.top = (r.bottom + 4 + h > window.innerHeight - 8 ? r.top - h - 4 : r.bottom + 4) + 'px';
      }
      function tarjeta(a, f, det, cli, hoy, arrastrar, tituloGrupo, foto, rap) {
        var avs = cli ? [] : avisosDe(a, f, hoy), mar = sinRepetir(avs, tituloGrupo);
        // T0601: en la tarjeta, lo vacío no sale (una prospección sin estado ni nota no enseña «— —»).
        var dets = det.filter(function (x) { return x !== foto; }).map(function (x) { return fechaAviso(a, x, celda(a, x, f, false, cli), avs); }).filter(function (h) { return h.indexOf('class="li-nada"') < 0; });
        // T0633: con foto, a la izquierda (sin foto, un hueco igual, para que los nombres caigan en línea).
        var src = foto && !prohibido(f[foto], PROHIB).length ? imagen(f[foto]) : '';
        var img = !foto ? '' : (src ? '<img class="li-mini li-t-img" src="' + texto(src) + '" alt="" referrerpolicy="no-referrer" loading="lazy" data-li-foto>' : '<span class="li-t-img li-t-vacia" aria-hidden="true"></span>');
        var cuerpo = '<strong>' + titulo2(a, f, cli) + '</strong>' +
          (dets.length ? '<span class="li-det">' + dets.map(function (h) { return '<span>' + h + '</span>'; }).join('') + '</span>' : '') +
          (mar.length ? '<span class="li-marcas">' + marcas(mar) + '</span>' : '');
        // T0643: con lo de un toque, el círculo a la izquierda y «Pasar» a la derecha, encima de la tarjeta (no dentro: un botón no va dentro de otro).
        var r = rap && rapidaEn(a, f, hoy), ci = r ? circulo(a, f) : '', pa = r ? botonPasar(a, f) : '';
        return '<li' + (ci || pa ? ' class="li-t-rap' + (ci ? ' li-t-ci' : '') + (pa ? ' li-t-pa' : '') + '"' : '') + '>' + ci + '<button type="button" class="li-tarjeta' + (foto ? ' li-con-foto' : '') + (avs.length ? ' li-f-' + texto(avs[0].nivel || 'medio') : '') + '" data-id="' + texto(f[a.clave]) + '"' + (arrastrar ? ' data-mover' : '') + '>' +
          (foto ? img + '<span class="li-t-txt">' + cuerpo + '</span>' : cuerpo) + '</button>' + pa + '</li>';
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
        // T0643: el círculo, delante del código; «Pasar», al final. Solo si alguna fila de la vista los lleva.
        var rap = conRapidas(a, vista), conCi = rap && !!a.rapidas.hecha, conPa = rap && !!a.rapidas.pasar;
        if (rap && !gs.some(function (g) { return g.filas.some(function (f) { return rapidaEn(a, f, hoy); }); })) conCi = conPa = false;
        var nCols = conCod.length + (conCi ? 1 : 0) + (conPa ? 1 : 0);
        var fila = function (f, g) {
          var avs = cli ? [] : avisosDe(a, f, hoy), mar = sinRepetir(avs, g.titulo), r = (conCi || conPa) && rapidaEn(a, f, hoy);
          return '<tr tabindex="0" data-id="' + texto(f[a.clave]) + '"' + (avs.length ? ' class="li-con-aviso li-f-' + texto(avs[0].nivel || 'medio') + '"' : '') + '>' +
            (conCi ? '<td class="li-td-ci">' + (r ? circulo(a, f) : '') + '</td>' : '') + conCod.map(function (c) {
            var cp = campo(a, c), principal = c === nom;
            // Fechas, cifras, estados y lo corto no se parten («273 / g/m²», «hace 9 / días»): lo que se estrecha es el texto largo.
            var h = fechaAviso(a, c, celda(a, c, f, false, cli), avs), corta = !principal && (num(cp) || /^(fecha|estado|sino)$/.test(cp.tipo) || h.replace(/<[^>]*>/g, '').length <= 14);
            return '<td class="' + (num(cp) ? 'num' : '') + (corta ? ' li-td-corta' : '') + (principal ? ' u-tabla-t' : '') + (c === a.codigo ? ' li-td-cod' : '') + '">' + h +
              (principal && mar.length ? '<div class="li-marcas">' + marcas(mar) + '</div>' : '') + '</td>';
          }).join('') + (conPa ? '<td class="li-td-pa">' + (r ? botonPasar(a, f) : '') + '</td>' : '') + '</tr>';
        };
        var tabla = '<div class="u-solo-ancho li-tabla"><table class="u-tabla"><thead><tr>' + (conCi ? '<th scope="col" class="li-td-ci"><span class="u-oculto">' + texto(a.rapidas.hecha.valor) + '</span></th>' : '') + conCod.map(function (c) {
          var cp = campo(a, c); return '<th scope="col"' + (num(cp) ? ' class="num"' : '') + '>' + texto(cp.titulo) + '</th>';
        }).join('') + (conPa ? '<th scope="col" class="li-td-pa"><span class="u-oculto">Pasar a otro día</span></th>' : '') + '</tr></thead>' + gs.map(function (g) {
          return '<tbody>' + (g.titulo ? '<tr class="li-g-cab"><th scope="colgroup" colspan="' + nCols + '">' + cabG(g) + '</th></tr>' : '') +
            g.filas.map(function (f) { return fila(f, g); }).join('') + '</tbody>';
        }).join('') + '</table></div>';
        var foto = fotoDeTarjeta(a, cols);
        var tarjetas = '<div class="u-solo-movil">' + gs.map(function (g) {
          return '<section class="li-grupo">' + (g.titulo ? cabG(g) : '') + '<ul class="li-tarjetas">' +
            g.filas.map(function (f) { return tarjeta(a, f, det, cli, hoy, false, g.titulo, foto, rap); }).join('') + '</ul></section>';
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
        alCerrar = null; S.menu = '';
        vent.innerHTML = html;
        velo.classList.add('abierto');
        var h = vent.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      }
      var alCerrar = null; // T0643: lo que se hace si la ventana se cierra sin terminar (el siguiente paso: volver atrás)
      function cerrarVentana() {
        var al = alCerrar; alCerrar = null;
        if (al) al();
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
        if (avs.length) h += '<div class="li-ficha-avisos">' + marcas(avs) + '</div>';
        if (cli) h += '<p class="li-cliente">Ficha para enseñar a un cliente: sin datos privados.</p>';
        // T0643: arriba, cerrarla o pasarla en un toque (guardan solas, sin «Guardar»).
        if (!nueva && conRapidas(a, vista) && rapidaEn(a, f, hoy)) {
          var rr = a.rapidas, edr = editables(a);
          h += '<div class="li-rapidas">' + (rr.hecha && edr.indexOf(rr.hecha.campo) >= 0 ? '<button type="button" class="u-btn li-r-hecha" data-r-hecha>' + ICONO_OK + texto(rr.hecha.valor) + '</button>' : '') +
            (rr.pasar && edr.indexOf(rr.pasar) >= 0 ? opcionesPasar(hoy).map(function (o) { return '<button type="button" class="u-btn" data-r-pasar="' + o.fecha + '" title="' + texto(diaCorto(o.fecha)) + '">' + texto(o.corto) + '</button>'; }).join('') : '') + '</div>';
        }
        var puestos = [];
        // T0630: lo que tiene algo, cada uno en su sitio; lo vacío, junto en una línea al final de su apartado («Sin
        // rellenar: Formato, Notas»). Lo que se edita se abre al tocar su nombre (su campo ya está, escondido, en el form).
        var lleno = function (c) { return ed.indexOf(c) >= 0 ? !vacio(crudo[c]) : verTexto(campo(a, c), f, VAL, PROHIB) !== ''; };
        var apartadoFicha = function (titulo, cs) {
          if (!cs.length) return '';
          cs.forEach(function (c) { puestos.push(c); });
          var rp = nueva ? { ver: cs, vacios: [] } : repartir(cs, lleno, a.obligatorias);
          var cuerpo = rp.ver.map(function (c) {
            if (ed.indexOf(c) >= 0) return entrada(a, c, crudo);
            var cp = campo(a, c);
            return '<div class="li-dato' + (cp.tipo === 'nota' || cp.tipo === 'foto' ? ' u-ancho' : '') + '"><span class="u-etiqueta">' + texto(cp.titulo) + '</span><span class="li-valor">' + celda(a, c, f, true, cli) + '</span>' +
              (cp.ayuda && !cli ? '<span class="u-nota">' + texto(cp.ayuda) + '</span>' : '') + '</div>';
          }).join('') + rp.vacios.filter(function (c) { return ed.indexOf(c) >= 0; }).map(function (c) {
            return entrada(a, c, crudo).replace(/^<div class="u-campo/, '<div hidden data-hueco="' + texto(c) + '" class="u-campo');
          }).join('');
          var linea = rp.vacios.length ? '<p class="li-vacios"><span class="u-etiqueta">Sin rellenar</span>' + rp.vacios.map(function (c) {
            var t = texto(campo(a, c).titulo);
            return ed.indexOf(c) >= 0 ? '<button type="button" class="li-rellenar" data-rellenar="' + texto(c) + '" aria-label="Rellenar ' + t + '">' + t + '</button>' : '<span class="li-vacio">' + t + '</span>';
          }).join('') + '</p>' : '';
          return '<section class="li-fgrupo">' + (titulo ? '<h3 class="li-fg-t">' + texto(titulo) + '</h3>' : '') + (cuerpo ? '<div class="u-campos">' + cuerpo + '</div>' : '') + linea + '</section>';
        };
        var alta = nueva && a.alta;
        if (alta) {
          // T0643: el alta con lo que dice ALTA, en su orden (lo primero, qué hay que hacer); lo de «mas», plegado.
          var deEd = function (c) { var cp = campo(a, c); return cp.primero ? cp.primero.some(function (p) { return ed.indexOf(p) >= 0; }) : ed.indexOf(c) >= 0; };
          var mas = a.alta.mas.filter(function (c) { return fuera.indexOf(c) < 0 && deEd(c); });
          h += '<form id="li-form" class="li-form li-alta" novalidate><div class="u-campos">' + a.alta.campos.filter(function (c) { return fuera.indexOf(c) < 0 && deEd(c); }).map(function (c) { return entradaAlta(a, c, crudo, ed, hoy); }).join('') + '</div>' +
            (mas.length ? '<details class="li-mas"><summary>Más: ' + texto(mas.map(function (c) { return campo(a, c).titulo.toLowerCase(); }).join(', ').replace(/, ([^,]*)$/, ' y $1')) + '</summary><div class="u-campos">' +
              mas.map(function (c) { return entradaAlta(a, c, crudo, ed, hoy); }).join('') + '</div></details>' : '');
        } else {
          h += '<form id="li-form" class="li-form" novalidate>' + grupos.map(function (g) {
            // Para enseñar a un cliente, la ficha enseña solo lo que enseña su vista (ni marcas interesadas ni muestras).
            return apartadoFicha(g.titulo, (g.campos || []).filter(function (c) { return fuera.indexOf(c) < 0 && c !== a.codigo && (nueva ? ed.indexOf(c) >= 0 : true) && (!cli || columnasDe(a, vista).indexOf(c) >= 0); }));
          }).join('');
          // Lo que se edita y no está en ningún apartado de la ficha, al final.
          h += apartadoFicha('', ed.filter(function (c) { return puestos.indexOf(c) < 0; }));
        }
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
        // T0630: «Copiar para Claude», al final: arriba va lo que se decide.
        if (!nueva && !cli && a.codigo) h += '<div class="li-claude"><button type="button" class="u-btn" data-claude>' + ICONO_COPIAR + 'Copiar para Claude</button><span class="u-nota">Pégalo al empezar una sesión de Claude para trabajar ' + texto(vacio(f[a.codigo]) ? 'esta fila' : f[a.codigo]) + '.</span></div>';
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
          if (nueva) {
            // T0643: «Con quién» del alta (una lista para varias columnas) guarda en la que toca.
            [].forEach.call(form.querySelectorAll('[data-uno]'), function (s) { var v = s.value, k = v.indexOf('|'); if (k > 0) cambios[v.slice(0, k)] = v.slice(k + 1); });
            // Lo que NUEVA pone y el alta no pregunta (el estado: nace Pendiente), también.
            var base = nuevaFila(a), enForm = function (c) { return [].some.call(form.querySelectorAll('[data-c]'), function (i) { return i.getAttribute('data-c') === c; }); };
            Object.keys(base).forEach(function (c) { if (!enForm(c) && !(c in cambios) && !vacio(base[c])) cambios[c] = base[c]; });
            a.obligatorias.forEach(function (c) { if (!enForm(c) && vacio(cambios[c])) faltan.push(campo(a, c).titulo); });
          }
          // T0643: lo que se pone solo (el área por con quién es), si está vacío y no se ha tocado.
          var ded = deducidos(a, nueva ? cambios : mezclar(crudo, cambios));
          Object.keys(ded).forEach(function (c) { if (nueva ? vacio(cambios[c]) : vacio(crudo[c]) && !(c in cambios)) cambios[c] = ded[c]; });
          if (malos.length) { err.textContent = textoProhibido(malos.filter(function (k, i) { return malos.indexOf(k) === i; })); err.hidden = false; return; }
          if (faltan.length) { err.textContent = 'Falta ' + faltan.join(', ').replace(/, ([^,]*)$/, ' y $1') + '.'; err.hidden = false; return; }
          if (!Object.keys(cambios).length) { cerrarVentana(); return; }
          var p = nueva ? T.crear(a.tabla, cambios) : T.actualizar(a.tabla, id, cambios);
          cerrarVentana();
          Promise.resolve(p).then(function () { ctx.aviso(nueva ? 'Añadido.' : 'Guardado.'); }, function (e) { ctx.aviso('No se ha guardado: ' + ((e && e.message) || e)); });
        });
        if (alta) {
          // El área (lo de DEDUCIR) se pone sola al elegir con quién, mientras no se toque a mano.
          var ponerDeducidos = function () {
            var fl = {};
            [].forEach.call(form.querySelectorAll('[data-c]'), function (i) { fl[i.getAttribute('data-c')] = i.value; });
            [].forEach.call(form.querySelectorAll('[data-uno]'), function (s) { var v = s.value, k = v.indexOf('|'); if (k > 0) fl[v.slice(0, k)] = v.slice(k + 1); });
            Object.keys(a.deducir).forEach(function (c) {
              var s = [].filter.call(form.querySelectorAll('[data-c]'), function (i) { return i.getAttribute('data-c') === c; })[0];
              if (!s || s.hasAttribute('data-tocado')) return;
              var tmp = mezclar(fl, {}); tmp[c] = '';
              var d = deducidos(a, tmp);
              s.value = d[c] || '';
              var nota = form.querySelector('[data-deducido="' + c + '"]');
              if (nota) nota.textContent = d[c] ? 'Puesta sola según con quién es. Puedes cambiarla.' : '';
            });
          };
          form.addEventListener('change', function (ev) {
            var c = ev.target.getAttribute && ev.target.getAttribute('data-c');
            if (c && c in a.deducir) { ev.target.setAttribute('data-tocado', ''); var n = form.querySelector('[data-deducido="' + c + '"]'); if (n) n.textContent = ''; return; }
            ponerDeducidos();
          });
          form.addEventListener('click', function (ev) {
            var b = ev.target.closest('[data-poner-fecha]'); if (!b) return;
            var c = b.getAttribute('data-col'), i = [].filter.call(form.querySelectorAll('[data-c]'), function (x) { return x.getAttribute('data-c') === c; })[0];
            if (i) i.value = b.getAttribute('data-poner-fecha');
            [].forEach.call(b.parentNode.querySelectorAll('[data-poner-fecha]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          });
          form.addEventListener('input', function (ev) {
            var c = ev.target.getAttribute && ev.target.getAttribute('data-c'), ch = c && form.querySelector('.li-dias[data-col-dias="' + c + '"]');
            if (ch) [].forEach.call(ch.querySelectorAll('[data-poner-fecha]'), function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-poner-fecha') === ev.target.value)); });
          });
          ponerDeducidos();
          var pri = form.querySelector('textarea,input,select'); if (pri) pri.focus();
        }
      }
      function mezclar(x, y) { var r = {}; [x, y].forEach(function (o) { Object.keys(o || {}).forEach(function (k) { if (k !== '__crudo') r[k] = o[k]; }); }); return r; }
      /** T0643 · Un campo del alta: «con quién» (un «primero» de varias columnas) es una sola lista agrupada por cada una; una
       *  fecha lleva sus días de un toque (hoy, mañana, una semana, sin fecha); lo que se pone solo, su nota. */
      function entradaAlta(a, c, crudo, ed, hoy) {
        var cp = campo(a, c), id = 'li-c-' + c;
        if (cp.primero) {
          var partes = cp.primero.filter(function (p) { return ed.indexOf(p) >= 0 && campo(a, p).ids; });
          return '<div class="u-campo u-ancho"><label class="u-etiqueta" for="' + id + '">' + texto(cp.titulo) + '</label><select id="' + id + '" data-uno="' + texto(c) + '">' +
            '<option value="">Nadie en concreto</option>' + partes.map(function (p) {
              var ids = campo(a, p).ids;
              return '<optgroup label="' + texto(campo(a, p).titulo) + '">' + Object.keys(ids).map(function (n) {
                return '<option value="' + texto(p + '|' + ids[n]) + '"' + (String(crudo[p] || '') === String(ids[n]) ? ' selected' : '') + '>' + texto(n) + '</option>';
              }).join('') + '</optgroup>';
            }).join('') + '</select></div>';
        }
        var h = entrada(a, c, crudo), fin = h.lastIndexOf('</div>');
        if (cp.tipo === 'fecha') {
          var v = String(crudo[c] || ''), ds = [{ fecha: hoy, titulo: 'Hoy' }].concat(opcionesPasar(hoy)).concat([{ fecha: '', titulo: 'Sin fecha' }]);
          return h.slice(0, fin) + '<div class="li-dias" data-col-dias="' + texto(c) + '" role="group" aria-label="' + texto(cp.titulo) + ' en un toque">' + ds.map(function (o) {
            return '<button type="button" class="li-dia" data-col="' + texto(c) + '" data-poner-fecha="' + o.fecha + '" aria-pressed="' + (v === o.fecha) + '">' + texto(o.titulo) + '</button>';
          }).join('') + '</div>' + h.slice(fin);
        }
        if (c in a.deducir) return h.slice(0, fin) + '<span class="u-nota" data-deducido="' + texto(c) + '"></span>' + h.slice(fin);
        return h;
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

      /* ---------- T0625 · Filtrar ----------
       * Un campo por cada columna que se puede filtrar en la vista: una lista, «de … a …» o «desde … hasta …» (fechas). El
       * botón dice cuántas filas quedan mientras se elige; nada cambia en la lista hasta que se pulsa. */
      function panelFiltros() {
        var a = ap(), vista = vistaActual(a), hoy = hoyIso(), todas = vistas(a);
        var disp = filtrables(a, vista, filtrar(a, vista, todas, { hoy: hoy }), VAL), F = S.filtros;
        var h = '<div class="li-ficha-cab"><h2 id="li-vt">Filtrar · ' + texto(a.titulo || '') + '</h2><button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Cerrar">' + ICONO_X + '</button></div>' +
          '<form id="li-ff" class="li-form" novalidate><div class="u-campos">' + disp.map(function (d, i) {
            var x = F[d.campo] || {}, id = 'li-f' + i, et = function (para) { return '<label class="u-etiqueta" for="' + para + '">' + texto(d.titulo) + '</label>'; };
            if (d.tipo === 'lista') {
              return '<div class="u-campo">' + et(id) + '<select id="' + id + '" data-f="' + texto(d.campo) + '"><option value="">Cualquiera</option>' +
                d.opciones.map(function (o) { return '<option value="=' + texto(o) + '"' + (x.es !== undefined && norm(x.es) === norm(o) ? ' selected' : '') + '>' + texto(o) + '</option>'; }).join('') +
                (d.vacios ? '<option value="!"' + (x.vacio ? ' selected' : '') + '>Sin ' + texto(d.titulo.toLowerCase()) + '</option>' : '') + '</select></div>';
            }
            var fecha = d.tipo === 'fecha', t = fecha ? 'date' : 'text', k1 = fecha ? 'desde' : 'min', k2 = fecha ? 'hasta' : 'max';
            var v1 = x[k1] === undefined ? '' : (fecha ? x[k1] : String(x[k1]).replace('.', ',')), v2 = x[k2] === undefined ? '' : (fecha ? x[k2] : String(x[k2]).replace('.', ','));
            var extra = fecha ? '' : ' inputmode="decimal" autocomplete="off"', u = d.unidad ? '<span class="u-nota">' + texto(d.unidad) + '</span>' : '';
            return '<fieldset class="u-campo li-rango"><legend class="u-etiqueta">' + texto(d.titulo) + '</legend><div class="li-rango-c">' +
              '<label class="u-oculto" for="' + id + 'a">' + texto(d.titulo) + (fecha ? ' desde' : ' desde (mínimo)') + '</label><span class="u-nota">' + (fecha ? 'Desde' : 'De') + '</span>' +
              '<input id="' + id + 'a" type="' + t + '"' + extra + ' data-f="' + texto(d.campo) + '" data-k="' + k1 + '" value="' + texto(v1) + '">' +
              '<label class="u-oculto" for="' + id + 'b">' + texto(d.titulo) + (fecha ? ' hasta' : ' hasta (máximo)') + '</label><span class="u-nota">' + (fecha ? 'hasta' : 'a') + '</span>' +
              '<input id="' + id + 'b" type="' + t + '"' + extra + ' data-f="' + texto(d.campo) + '" data-k="' + k2 + '" value="' + texto(v2) + '">' + u + '</div></fieldset>';
          }).join('') + '</div><p class="u-error" id="li-ferr" role="alert" hidden></p>' +
          '<div class="n-botones"><button type="submit" class="u-btn u-btn-accion" data-ver></button><button type="button" class="u-btn u-btn-texto" data-fquitar>Quitar filtros</button></div></form>';
        abrirVentana(h);
        var form = vent.querySelector('#li-ff'), boton = form.querySelector('[data-ver]'), err = vent.querySelector('#li-ferr');
        /** Lo elegido en el panel: { filtros } o { error } (un número que no lo es). */
        function leer() {
          var r = {}, mal = '';
          [].forEach.call(form.querySelectorAll('[data-f]'), function (i) {
            var c = i.getAttribute('data-f'), k = i.getAttribute('data-k'), v = i.value.trim();
            i.removeAttribute('aria-invalid');
            if (!v) return;
            if (!k) { r[c] = v === '!' ? { vacio: true } : { es: v.slice(1) }; return; }
            if (k === 'min' || k === 'max') {
              var n = aNumero(v);
              if (isNaN(n)) { i.setAttribute('aria-invalid', 'true'); mal = mal || 'Escribe solo un número en ' + campo(a, c).titulo.toLowerCase() + '.'; return; }
              v = /%$/.test(v) ? n * 100 : n; // «30 %» es 30, como se ve
            }
            (r[c] = r[c] || {})[k] = v;
          });
          // Al revés («de 300 a 100», «del 15 al 1»): se entiende y se da la vuelta.
          Object.keys(r).forEach(function (c) {
            var x = r[c];
            if (typeof x.min === 'number' && typeof x.max === 'number' && x.min > x.max) { var t1 = x.min; x.min = x.max; x.max = t1; }
            if (x.desde && x.hasta && x.desde > x.hasta) { var t2 = x.desde; x.desde = x.hasta; x.hasta = t2; }
          });
          return { filtros: r, error: mal };
        }
        function contar() {
          var l = leer(), n = filtrar(a, vista, todas, { hoy: hoy, q: S.q, aviso: S.aviso, filtros: l.filtros, valores: VAL }).length;
          err.textContent = l.error; err.hidden = !l.error;
          boton.textContent = n ? 'Ver ' + n + (n === 1 ? ' fila' : ' filas') : 'Ninguna fila así';
          return l;
        }
        contar();
        form.addEventListener('input', contar);
        form.addEventListener('change', contar);
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var l = contar();
          if (l.error) return;
          S.filtros = l.filtros;
          cerrarVentana(); pintar();
        });
        vent.querySelector('[data-fquitar]').addEventListener('click', function () { S.filtros = {}; cerrarVentana(); pintar(); });
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
        // T0643: el círculo, «Pasar» y su menú. Con el menú abierto, tocar fuera solo lo cierra.
        var r = ev.target.closest('[data-hecha],[data-pasar-menu],[data-pasar-a],[data-pasar-otro]');
        if (r) {
          var abierto = S.menu; S.menu = '';
          if (r.hasAttribute('data-hecha')) { pintar(); marcarHecha(r.getAttribute('data-hecha')); return; }
          if (r.hasAttribute('data-pasar-menu')) { var pm = r.getAttribute('data-pasar-menu'); S.menu = abierto === pm ? '' : pm; pintar(); var p1 = cont.querySelector('.li-menu [role=menuitem]'); if (p1) p1.focus(); return; }
          if (r.hasAttribute('data-pasar-a')) { pintar(); pasar(r.getAttribute('data-fila'), r.getAttribute('data-pasar-a')); return; }
          pintar(); pasarOtroDia(r.getAttribute('data-pasar-otro')); return;
        }
        if (S.menu && !ev.target.closest('.li-menu')) { S.menu = ''; pintar(); return; }
        var t = ev.target.closest('[data-vista],[data-aviso],[data-id],[data-pers],[data-nueva],[data-filtrar],[data-quitar]');
        if (!t) return;
        if (t.hasAttribute('data-filtrar')) { panelFiltros(); return; }
        if (t.hasAttribute('data-quitar')) {
          var qc = t.getAttribute('data-quitar');
          if (qc) delete S.filtros[qc]; else S.filtros = {};
          pintar();
          // El foco no se pierde: a la siguiente etiqueta o, si ya no queda ninguna, al botón Filtrar.
          var sig = cont.querySelector('.li-fchip') || cont.querySelector('[data-filtrar]'); if (sig) sig.focus();
          return;
        }
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
        // T0643: cerrar o pasar desde la ficha (se cierra la ficha y se hace como en la lista).
        var rh = ev.target.closest('[data-r-hecha],[data-r-pasar]');
        if (rh && abierta) {
          var idr = abierta.id; cerrarVentana();
          if (rh.hasAttribute('data-r-hecha')) marcarHecha(idr); else pasar(idr, rh.getAttribute('data-r-pasar'));
          return;
        }
        // T0630: un campo vacío de la ficha se abre al tocar su nombre en «Sin rellenar».
        var rl = ev.target.closest('[data-rellenar]');
        if (rl) {
          var c = rl.getAttribute('data-rellenar'), hu = [].filter.call(vent.querySelectorAll('[data-hueco]'), function (x) { return x.getAttribute('data-hueco') === c; })[0];
          if (!hu) return;
          var linea = rl.parentNode;
          hu.hidden = false;
          rl.remove();
          if (!linea.querySelector('.li-rellenar,.li-vacio')) linea.remove();
          var i = hu.querySelector('input,select,textarea'); if (i) i.focus();
          return;
        }
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
      teclaEsc = function (ev) {
        if (ev.key !== 'Escape' || !ctx.abierta()) return;
        if (velo.classList.contains('abierto')) { cerrarVentana(); return; }
        if (S.menu) { var b = S.menu; S.menu = ''; pintar(); var bb = cont.querySelector('[data-pasar-menu="' + b.replace(/"/g, '') + '"]'); if (bb && bb.offsetParent) bb.focus(); }
      };
      document.addEventListener('keydown', teclaEsc);
      // T0643: el menú de «Pasar» va fijo junto a su botón: al desplazar, se cierra (no se queda flotando en otro sitio).
      alDesplazar = function () { if (S.menu) { S.menu = ''; pintar(); } };
      window.addEventListener('scroll', alDesplazar, true);
      avDes.querySelector('[data-deshacer]').addEventListener('click', function () {
        var d = avDes._deshacer; sinDeshacer();
        if (d) Promise.resolve(d()).then(function () { ctx.aviso('Deshecho.'); });
      });

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
      if (alDesplazar) window.removeEventListener('scroll', alDesplazar, true);
      alMover = alSoltar = alCancelar = alDesplazar = null;
    }
  });
})();
