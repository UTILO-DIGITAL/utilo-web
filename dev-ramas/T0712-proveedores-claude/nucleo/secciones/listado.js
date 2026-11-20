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
  /**
   * Un número de la tabla: 12.5, «12,5», «1.234,50 €», «50 %» (0,5). NaN si no lo es. Una coma con grupos de tres cifras
   * detrás («1,020», «1,020.50»: como se escribe en la India y en inglés) es de miles: 1020 (T0645).
   */
  function aNumero(v) {
    if (typeof v === 'number') return v;
    if (vacio(v)) return NaN;
    var s = String(v).trim(), pc = /%$/.test(s);
    s = s.replace(/[€₹%\s]/g, '');
    if (/^-?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    var n = /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
    return pc ? n / 100 : n;
  }

  /**
   * ¿Es un teléfono («+91 98200 12345», «(93) 555-12-34», «+91 78699 57726 (WhatsApp)», «619 060 112 / 670 943 907»)? Lo
   * que va entre paréntesis con letras es una nota y no cuenta (T0656). «Formulario en la web» no: sale como texto, sin
   * enlace (T0645).
   */
  function sinNotas(v) { return String(v == null ? '' : v).replace(/\([^)]*[A-Za-zÀ-ÿ][^)]*\)/g, ' ').trim(); }
  function esTelefono(v) { var s = sinNotas(v); return /^\+?[\d\s().\-\/+]+$/.test(s) && s.replace(/\D/g, '').length >= 6; }
  /** El número al que llama el enlace: el primero si hay varios («… / …»), solo con sus cifras y el «+». */
  function telDe(v) { return sinNotas(v).split('/')[0].replace(/[^\d+]/g, ''); }

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
   * +, -, *, /, «o» (el primero que no está vacío) y «redondear» ([«redondear», x, decimales]). Un campo calculado puede usar
   * otro por su nombre (campo() lo cambia por su cálculo; T0641). Un hueco da NaN. */
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
  /** T0641 · Una expresión con los campos calculados que nombra cambiados por su cálculo (el ahorro usa «MI_PRECIO»). */
  function expandir(expr, campos, vistos) {
    vistos = vistos || [];
    if (typeof expr === 'string') {
      var d = (campos || {})[expr];
      return d && d.calculo && vistos.indexOf(expr) < 0 ? expandir(d.calculo, campos, vistos.concat(expr)) : expr;
    }
    if (Array.isArray(expr)) return [expr[0]].concat(expr.slice(1).map(function (e) { return expandir(e, campos, vistos); }));
    return expr;
  }
  /** El envío que lleva un calculado: el de «envio» (un coste: T0678) o el de su «precio». */
  function envioDe(d) { return (d && (d.envio || (d.precio && d.precio.envio))) || null; }
  /** T0678 · Si una expresión usa un calculado que lleva envío (MI_COSTE en «Hasta su precio»), ese envío: sin él, tampoco sale. */
  function conEnvio(expr, campos, vistos) {
    var r = null;
    usa(expr).some(function (u) {
      var d = (campos || {})[u];
      if (!d || !d.calculo || vistos.indexOf(u) >= 0) return false;
      r = envioDe(d) || conEnvio(d.calculo, campos, vistos.concat(u));
      return !!r;
    });
    return r;
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
      rapidas: rapidasDe(cfg.RAPIDAS), alta: cfg.ALTA && lista(cfg.ALTA.campos).length ? { campos: lista(cfg.ALTA.campos), mas: lista(cfg.ALTA.mas), titulo: cfg.ALTA.titulo || '' } : null,
      deducir: cfg.DEDUCIR || {}, acciones: cfg.ACCIONES || [], contexto: contextoDe(cfg.CONTEXTO), resumen: resumenCifras(cfg.RESUMEN),
      // T0689: la ficha guarda sola cada campo al cambiarlo; con GUARDAR: "boton", como antes (con «Guardar»). MIAS: Mías / Todas.
      guardar: cfg.GUARDAR === 'boton' ? 'boton' : 'solo', mias: miasDe(cfg.MIAS) };
  }
  /** T0708 · RESUMEN de la configuración: { cifras: [{ tabla, filas: [singular, plural] }], texto }; null sin ninguna cifra. */
  function resumenCifras(r) {
    var cs = (r && Array.isArray(r.cifras) ? r.cifras : []).filter(function (x) { return x && x.tabla; });
    return cs.length ? { cifras: cs, texto: typeof r.texto === 'string' ? r.texto : '' } : null;
  }
  /** T0708 · Las cifras del resumen: cuántas filas tiene cada tabla, todas (no las de la vista), con su nombre. */
  function cifrasResumen(ap, D) {
    if (!ap.resumen) return [];
    return ap.resumen.cifras.map(function (x) {
      var n = (D.filas(x.tabla) || []).length, f = x.filas && x.filas.length === 2 ? x.filas : ['fila', 'filas'];
      return { n: n, nombre: n === 1 ? f[0] : f[1] };
    });
  }
  /** T0652 · CONTEXTO de la configuración, con sus claves por defecto; null sin ninguna tabla en «de». Cada sección de
   *  «seccion» es un nombre o { id, si: [condiciones] } (la primera que cumple la fila de la otra tabla: Clientes o Prospección). */
  function contextoDe(c) {
    if (!c || !c.de || typeof c.de !== 'object' || !Object.keys(c.de).length) return null;
    var de = {};
    Object.keys(c.de).forEach(function (k) {
      var x = c.de[k] || {};
      de[k] = { tabla: x.tabla || '', sub: lista(x.sub), chips: lista(x.chips), nota: x.nota || '', lineas: lista(x.lineas),
        secciones: lista(x.seccion).map(function (s) { return typeof s === 'string' ? { id: s, si: [] } : { id: (s && s.id) || '', si: (s && s.si) || [] }; }) };
    });
    return { campo: c.campo || '', de: de, hecho: c.hecho || null, notas: c.notas || '', fecha: c.fecha || '',
      hechas: typeof c.hechas === 'number' ? c.hechas : 2, pendientes: typeof c.pendientes === 'number' ? c.pendientes : 3 };
  }
  /** T0643 · RAPIDAS de la configuración, con sus claves por defecto; null si no hay ninguna. */
  function rapidasDe(r) {
    if (!r || (!r.HECHA && !r.PASAR)) return null;
    var s = r.SIGUIENTE;
    return { hecha: r.HECHA && r.HECHA.campo ? { campo: r.HECHA.campo, valor: r.HECHA.valor } : null, pasar: r.PASAR || '', si: r.SI || [],
      siguiente: s && lista(s.con).length ? { con: lista(s.con), copia: lista(s.copia).length ? lista(s.copia) : lista(s.con), pone: s.pone || {} } : null };
  }
  /**
   * T0650 · La configuración sin lo que el perfil de quien mira no ve (ctx.ocultar, de config.json · nucleo.ocultar): ni las
   * tablas ocultas (lo que se lee de ellas: VALORES, lo relacionado, los campos con «de», sus referencias) ni, en las demás, las
   * columnas que apuntan a ellas (Con quién = proveedor). Así la sección no las pide, que el motor diría «no tienes permiso», ni
   * enseña esos campos. Con «filas» ({ TABLA: { COLUMNA: [valores] } }), esos valores no salen en los desplegables de su tabla.
   * T0671: ni lo de CONTEXTO que va a una tabla oculta (el resumen del proveedor) o a una columna quitada, ni sus líneas; y, con
   * «columnas» ({ TABLA: [columnas] }, que le llegan vacías), esos campos fuera como los demás.
   * No cambia cfg. Sin nada que ocultar, la misma.
   */
  /**
   * Quita de la configuración (ya copiada: la cambia) los campos de «fuera»: de CAMPOS, de las columnas, la ficha, el orden,
   * las vistas, los filtros y lo que se edita. Devuelve vale(x): si x (una columna, una ruta o «-COLUMNA») sigue.
   */
  function sinCampos(c, fuera) {
    var vale = function (x) { return typeof x !== 'string' || fuera.indexOf(x.replace(/^-/, '').split('.')[0]) < 0; };
    if (!fuera.length) return vale;
    var limpiar = function (a) { return Array.isArray(a) ? a.filter(vale) : a; };
    fuera.forEach(function (k) { if (c.CAMPOS) delete c.CAMPOS[k]; if (c.NUEVA) delete c.NUEVA[k]; });
    Object.keys(c.CAMPOS || {}).forEach(function (k) { if (c.CAMPOS[k].primero) c.CAMPOS[k].primero = limpiar(c.CAMPOS[k].primero); });
    ['COLUMNAS', 'DETALLE', 'BUSCAR', 'EDITAR', 'OBLIGATORIAS', 'FILTROS'].forEach(function (k) { if (k in c) c[k] = limpiar(c[k]); });
    if (!vale(c.ORDEN)) c.ORDEN = '';
    if (c.FICHA) c.FICHA = c.FICHA.map(function (g) { if (g.campos) g.campos = limpiar(g.campos); return g; }).filter(function (g) { return !g.campos || g.campos.length; });
    (c.VISTAS || []).forEach(function (v) {
      if (v.columnas) v.columnas = limpiar(v.columnas);
      if (v.orden && !vale(v.orden)) delete v.orden;
      if (v.agrupar && !vale(v.agrupar.campo || v.agrupar)) delete v.agrupar;
      if (v.tablero && !vale(v.tablero.campo)) delete v.tablero;
    });
    return vale;
  }
  /**
   * T0692 · VENTAS: las ventas de cada fila, que da otra sección (Pedidos: { seccion, campo, titulo }), en su ficha («Sus
   * ventas») y en los campos con «venta» (ULTIMA_VENTA: { "venta": "ultima" }; también «anio» y «debe»). Quien no ve esa
   * sección no ve nada de esto: sin VENTAS ni esos campos (veo: { ID: titulo } de las secciones que ve).
   */
  function sinVentas(cfg, veo) {
    var v = cfg && cfg.VENTAS && Object.keys(cfg.VENTAS).length ? cfg.VENTAS : null, ve = !!(v && v.seccion && veo[String(v.seccion).toUpperCase()]);
    var fuera = Object.keys((cfg && cfg.CAMPOS) || {}).filter(function (k) { return cfg.CAMPOS[k] && cfg.CAMPOS[k].venta; });
    if (ve || (!v && !fuera.length)) return cfg;
    var c = JSON.parse(JSON.stringify(cfg));
    delete c.VENTAS;
    sinCampos(c, fuera);
    return c;
  }
  /** T0692 · El valor de un campo con «venta» para las ventas de una fila (las de ventasPorQuien de Economía, o nada). */
  function deVentas(que, q) {
    if (!q) return '';
    if (que === 'ultima') return q.ultima || '';
    if (que === 'anio') return q.enAnio ? q.anio / 100 : '';
    if (que === 'debe') return q.debe / 100;
    return '';
  }
  function quitada(vs, n) { var k = String(n).trim().toLowerCase(); return vs.some(function (v) { return String(v).trim().toLowerCase() === k; }); }
  function sinOcultas(cfg, oc) {
    var ts = (oc && oc.tablas) || [], fs = ((oc && oc.filas) || {})[cfg && cfg.TABLA] || {}, vacias = (oc && oc.columnas) || {};
    if ((!ts.length && !Object.keys(fs).length && !Object.keys(vacias).length) || !cfg) return cfg;
    var c = JSON.parse(JSON.stringify(cfg)), refs = (oc && oc.refs) || {}, fuera = (refs[c.TABLA] || []).concat(vacias[c.TABLA] || []);
    // Las opciones con las que dejaría de ver la fila (el área «Proveedores»), fuera de los desplegables: el motor no dejaría guardarla.
    Object.keys(fs).forEach(function (k) {
      var d = (c.CAMPOS = c.CAMPOS || {})[k] = c.CAMPOS[k] || {};
      d._quitar = fs[k].slice();
      if (Array.isArray(d.opciones)) d.opciones = d.opciones.filter(function (n) { return !quitada(fs[k], n); });
    });
    var oculta = function (t) { return ts.indexOf(t) >= 0; };
    Object.keys(c.CAMPOS || {}).forEach(function (k) { var d = c.CAMPOS[k]; if (d && d.de && oculta(d.de.tabla)) fuera.push(k); });
    var vale = sinCampos(c, fuera);
    if (c.RELACIONADOS) c.RELACIONADOS = c.RELACIONADOS.filter(function (r) { return !oculta(r.tabla); });
    // T0708: ni las cifras del resumen de una tabla oculta.
    if (c.RESUMEN && Array.isArray(c.RESUMEN.cifras)) {
      c.RESUMEN.cifras = c.RESUMEN.cifras.filter(function (x) { return !(x && oculta(x.tabla)); });
      if (!c.RESUMEN.cifras.length) delete c.RESUMEN;
    }
    // T0671: el resumen de con quién es (CONTEXTO.de): sin el de una tabla oculta ni el de una columna quitada (el proveedor), y
    // sin las líneas de una tabla oculta o por una columna que apunta a una oculta (las personas de un proveedor).
    var cx = c.CONTEXTO;
    if (cx && typeof cx === 'object') {
      if (cx.campo && !vale(cx.campo)) delete c.CONTEXTO;
      else if (cx.de && typeof cx.de === 'object') {
        Object.keys(cx.de).forEach(function (k) {
          var d = cx.de[k];
          if (!vale(k) || !d || oculta(d.tabla)) { delete cx.de[k]; return; }
          if (Array.isArray(d.lineas)) d.lineas = d.lineas.filter(function (l) { return !l || (!oculta(l.tabla) && (refs[l.tabla] || []).indexOf(l.campo) < 0); });
        });
        if (!Object.keys(cx.de).length) delete c.CONTEXTO;
      }
    }
    Object.keys(c.VALORES || {}).forEach(function (k) { var v = c.VALORES[k]; if (v && typeof v === 'object' && oculta(v.tabla)) delete c.VALORES[k]; });
    var r = c._refs || {};
    Object.keys(r).forEach(function (t) {
      if (oculta(t)) { delete r[t]; return; }
      Object.keys(r[t]).forEach(function (k) { if (oculta(r[t][k])) delete r[t][k]; });
    });
    return c;
  }
  /** El campo de un apartado, con su título y tipo por defecto (una columna FECHA… es una fecha; ESTADO, un estado). */
  function campo(ap, c) {
    var d = (ap.campos || {})[c] || {};
    var base = String(c).split('.').pop();
    var tipo = d.tipo || (d.calculo ? 'importe' : (d.de && !d.de.columna && !d.de.columnas ? 'numero' : (/^FECHA/.test(base) ? 'fecha' : (/^(ID_)?ESTADO$/.test(base) ? 'estado' : 'texto'))));
    return { n: c, titulo: d.titulo || (c === ap.codigo ? 'Código' : titulo(base)), tipo: tipo, opciones: d.opciones || null, ref: d.ref || refDe(ap, ap.tabla, c), ids: d._ids || null,
      de: d.de || null, primero: d.primero || null, grupos: d.grupos || null,
      unidad: d.unidad || '', calculo: d.calculo ? expandir(d.calculo, ap.campos, [c]) : null, precio: d.precio || null, envio: d.calculo ? envioDe(d) || conEnvio(d.calculo, ap.campos, [c]) : null, privado: !!d.privado, colores: d.colores || null,
      ayuda: d.ayuda || '', sinNumero: !!d.sinNumero, nombres: d.nombres || null, comun: d.comun || null, signo: d.signo || null, desglose: d.desglose || null, plantilla: d.plantilla || '', varios: !!d.varios,
      palabras: Array.isArray(d.palabras) && d.palabras.length >= 2 ? d.palabras : null };
  }
  /** T0642 · Un valor como se enseña: sin el número de delante («1 Contactado» → «Contactado», con «sinNumero») y con su
   *  nombre en palabras («IG» → «Instagram», con «nombres»). Lo guardado, los filtros y los colores siguen con el valor de verdad. */
  function mostrar(cp, v) {
    var s = String(v === undefined || v === null ? '' : v);
    if (cp && cp.nombres) { var k = Object.keys(cp.nombres).filter(function (x) { return norm(x) === norm(s); })[0]; if (k !== undefined) s = cp.nombres[k]; }
    if (cp && cp.sinNumero) s = s.replace(/^\s*\d+[.)]?\s+(?=\S)/, '');
    return s;
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
  /** T0688 · La vista en la que abrir la ficha de una fila que pide la dirección (?ficha=): la de ahora si la fila está en
   *  ella y, si no, la primera en la que esté (una marca de Prospección no se abre con la lista de Clientes detrás). */
  function vistaDeFila(ap, f, actual, hoy) {
    var vs = vistasDe(ap), esta = function (v) { return !!v && (!v.filtro || cumple(f, v.filtro, { hoy: hoy })); };
    var ahora = vs.filter(function (v) { return v.id === actual; })[0] || vs[0];
    if (!f || esta(ahora)) return ahora.id;
    return (vs.filter(esta)[0] || ahora).id;
  }

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
  /** T0708 · Si lo relacionado enseña una columna que es uno de sus «campos» calculados, plantilla, «de» o «primero». */
  function conCamposPropios(r) {
    return (r.columnas || []).some(function (c) { var d = (r.campos || {})[c]; return !!(d && (d.calculo || d.plantilla || d.de || d.primero)); });
  }
  /** T0708 · Lo de verdad (el código, no el nombre) al final de una ruta («ID_DISENO.ID_PROVEEDOR» → P-001). */
  function seguirCrudo(ap, D, t, f, ruta) {
    var ps = String(ruta).split('.'), fila = f, tt = t;
    for (var i = 0; i < ps.length - 1; i++) {
      var r = refDe(ap, tt, ps[i]);
      if (!r || !fila || vacio(fila[ps[i]])) return '';
      fila = D.fila(r, fila[ps[i]]); tt = r;
    }
    return fila ? fila[ps[ps.length - 1]] : '';
  }
  /** T0708 · Las tablas por las que pasa una ruta desde t (TELAS, «ID_DISENO.ID_PROVEEDOR» → [DISENOS]): hay que leerlas. */
  function tablasDeRuta(ap, t, ruta) {
    var ps = String(ruta || '').split('.'), r = [], tt = t;
    for (var i = 0; i < ps.length - 1; i++) { tt = refDe(ap, tt, ps[i]); if (!tt) break; r.push(tt); }
    return r;
  }
  /** Todas las columnas que nombra la configuración (para saber qué rutas preparar). */
  function nombradas(ap) {
    var t = [ap.nombre, ap.codigo, ap.orden].concat(ap.columnas, ap.detalle, ap.buscar || [], ap.filtros || []);
    ap.ficha.forEach(function (g) { t = t.concat(g.campos || []); });
    vistasDe(ap).forEach(function (v) {
      t = t.concat(v.columnas || [], [v.orden, v.agrupar && (v.agrupar.campo || v.agrupar), v.tablero && v.tablero.campo]);
      if (v.galeria) t = t.concat([v.galeria.foto, v.galeria.titulo, v.galeria.cifra], lista(v.galeria.debajo));
      lista(v.filtro).forEach(function (c) { t.push(c.campo); });
    });
    lista(ap.filtro).forEach(function (c) { t.push(c.campo); });
    ap.avisos.forEach(function (a) { lista(a.si).forEach(function (c) { t.push(c.campo); }); });
    Object.keys(ap.campos).forEach(function (c) {
      var d = ap.campos[c]; t.push(c);
      if (d.calculo) t = t.concat(usa(expandir(d.calculo, ap.campos, [c])));
      t = t.concat(d.primero || [], d.plantilla ? enPlantilla(d.plantilla) : []);
      lista(d.desglose).forEach(function (p) { if (p && p.calculo) t = t.concat(usa(expandir(p.calculo, ap.campos))); });
    });
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
      // T0650: lo que dejaría sin ver la fila (nucleo.ocultar · filas), fuera de las opciones y del desplegable del formulario.
      if (d._quitar) {
        d.opciones = d.opciones.filter(function (n) { return !quitada(d._quitar, n); });
        Object.keys(d._ids).forEach(function (n) { if (quitada(d._quitar, n)) delete d._ids[n]; });
      }
      d.ref = t;
    });
    return a;
  }
  /** T0641 · Los campos que nombra una plantilla («Hoy {PRECIO_A_BATIR}[ ({ID_COMPETIDOR})]»). */
  function enPlantilla(p) { var r = [], m, re = /\{([^{}]+)\}/g; while ((m = re.exec(String(p)))) r.push(m[1]); return r; }
  /**
   * T0641 · Una plantilla rellenada: cada {CAMPO}, como se ve (con su unidad; un calculado que no da número, vacío). Lo que va
   * entre [corchetes] solo sale si todo lo de dentro tiene algo; si algo de fuera está vacío, toda la plantilla queda vacía.
   */
  function rellenar(ap, p, f, valores) {
    var hueco = false;
    function poner(t) {
      return t.replace(/\{([^{}]+)\}/g, function (x, c) {
        var cp = campo(ap, c), v = cp.calculo && isNaN(calcular(cp.calculo, f, valores)) ? '' : (cp.plantilla ? '' : verTexto(cp, f, valores, []));
        if (cp.calculo && cp.envio && v.indexOf('Falta') === 0) v = ''; // T0678: un coste sin envío no va dentro de una frase
        if (v === '') hueco = true;
        return v;
      });
    }
    var r = String(p).replace(/\[([^\[\]]*)\]/g, function (x, dentro) { hueco = false; var t = poner(dentro); return hueco ? '' : t; });
    hueco = false;
    r = poner(r);
    return hueco ? '' : r.trim();
  }
  /**
   * T0641 · Las filas de otra tabla de un campo con «de» y «columnas», en una línea: cada fila, sus columnas como se ven
   * (con su tipo en «campos»: la parte, en porcentaje) separadas por un espacio; las filas, por « · » («52 % Poliéster · 48 % Algodón»).
   */
  function enLinea(de, xs) {
    var sub = { campos: de.campos || {}, refs: {}, tabla: de.tabla };
    return xs.map(function (x) { return de.columnas.map(function (c) { return verTexto(campo(sub, c), x, {}, []); }).filter(String).join(' '); }).filter(String).join(' · ');
  }
  /** Las filas como se ven: con nombres, rutas, «de», «primero» y, con valores, las plantillas. Cada una guarda la de verdad en __crudo. */
  function preparar(a, filas, D, valores) {
    var rs = (a.refs || {})[a.tabla] || {}, rutas = nombradas(a).filter(function (c) { return c.indexOf('.') > 0; });
    var conDe = Object.keys(a.campos).filter(function (c) { return a.campos[c].de; }), conPrimero = Object.keys(a.campos).filter(function (c) { return a.campos[c].primero; });
    var conPlantilla = Object.keys(a.campos).filter(function (c) { return a.campos[c].plantilla; });
    var conVenta = Object.keys(a.campos).filter(function (c) { return a.campos[c].venta; });
    return filas.map(function (f) {
      var r = {};
      Object.keys(f).forEach(function (k) { r[k] = rs[k] ? nombreDe(D, rs[k], f[k]) : f[k]; });
      rutas.forEach(function (ruta) { r[ruta] = seguir(a, D, a.tabla, f, ruta); });
      conDe.forEach(function (c) {
        var de = a.campos[c].de, clave = f[de.con || a.clave];
        // T0708: «campo» puede ser una ruta (las telas de un proveedor: TELAS · ID_DISENO.ID_PROVEEDOR).
        var ruta = String(de.campo || '').indexOf('.') > 0;
        var xs = vacio(clave) ? [] : (D.filas(de.tabla) || []).filter(function (x) { return norm(ruta ? seguirCrudo(a, D, de.tabla, x, de.campo) : x[de.campo]) === norm(clave); }).map(function (x) { return conNombres(a, D, de.tabla, x); });
        if (de.filtro) xs = xs.filter(function (x) { return cumple(x, de.filtro, { hoy: de.hoy }); });
        if (de.orden) xs.sort(comparar(de.orden));
        r[c] = de.columnas ? enLinea(de, xs) : (de.columna ? (xs.length ? xs[0][de.columna] : '') : xs.length);
      });
      conVenta.forEach(function (c) { r[c] = deVentas(a.campos[c].venta, D.ventas ? D.ventas[String(f[a.clave])] : null); });
      conPrimero.forEach(function (c) { r[c] = a.campos[c].primero.map(function (x) { return r[x]; }).filter(function (v) { return !vacio(v); })[0] || ''; });
      conPlantilla.forEach(function (c) { r[c] = rellenar(a, a.campos[c].plantilla, r, valores || {}); });
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
      if (!t && ap.campos[c] && (ap.campos[c].de || ap.campos[c].primero || ap.campos[c].plantilla || ap.campos[c].venta)) return;
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
    // T0689: GUARDAR, «solo» (de entrada) o «boton»; MIAS, con su columna (el correo de la persona).
    if (cfg.GUARDAR !== undefined && ['solo', 'boton'].indexOf(cfg.GUARDAR) < 0) errores.push(donde + 'GUARDAR es «solo» (cada campo se guarda al cambiarlo) o «boton» (con «Guardar»), no «' + cfg.GUARDAR + '».');
    if (cfg.MIAS !== undefined && cfg.MIAS !== null && !(typeof cfg.MIAS === 'object' && !Array.isArray(cfg.MIAS) && !Object.keys(cfg.MIAS).length)) {
      if (!cfg.MIAS || typeof cfg.MIAS !== 'object' || !cfg.MIAS.campo) errores.push(donde + 'MIAS lleva «campo» (la columna con el correo de para quién es) y, si hace falta, «sinNadie» (los perfiles de los que es lo que no es de nadie).');
      else hay(cfg.MIAS.campo, 'MIAS usa');
    }
    // T0692: las ventas de cada fila salen de otra sección (VENTAS: { seccion, campo }); un campo con «venta» las necesita.
    var vts =cfg.VENTAS && (typeof cfg.VENTAS !== 'object' || Object.keys(cfg.VENTAS).length) ? cfg.VENTAS : null;
    if (vts && (typeof vts !== 'object' || !vts.seccion || !vts.campo)) errores.push(donde + 'VENTAS lleva «seccion» (la que tiene las ventas, Pedidos) y «campo» (la columna de CONTRAPARTES con la clave de esta fila).');
    Object.keys(ap.campos).filter(function (c) { return ap.campos[c] && ap.campos[c].venta; }).forEach(function (c) {
      var q = ap.campos[c].venta;
      if (['ultima', 'anio', 'debe'].indexOf(q) < 0) errores.push(donde + '«' + c + '»: «venta» es ultima, anio o debe, no «' + q + '».');
      if (!vts) errores.push(donde + '«' + c + '» sale de las ventas, pero falta VENTAS.');
      if (ed.indexOf(c) >= 0) errores.push(donde + '«' + c + '» sale de las ventas, no se edita.');
    });
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
      // T0678: lo que cuesta con su envío («envio»), igual: tiene que sumarlo.
      if (d.envio && !lista(d.envio).some(function (e) { return usa(d.calculo).indexOf(e) >= 0; })) errores.push(donde + '«' + c + '» no suma su envío (' + lista(d.envio).join(' o ') + '): se vería un coste sin envío.');
    });
    // T0656: los calculados de lo relacionado (la Comparativa en la ficha de una marca) también sacan sus $ de VALORES.
    lista(ap.relacionados).forEach(function (r) {
      Object.keys(r.campos || {}).forEach(function (c) {
        usa((r.campos[c] || {}).calculo).forEach(function (u) {
          if (u.charAt(0) === '$' && (!cfg.VALORES || !(u.slice(1) in cfg.VALORES))) errores.push(donde + '«' + c + '» de «' + (r.titulo || r.tabla) + '» usa ' + u + ', que no está en VALORES.');
        });
      });
    });
    lista(ap.filtro).forEach(function (cnd) { if (cnd.campo) hay(cnd.campo, 'el FILTRO usa'); });
    Object.keys(ap.nueva).forEach(function (c) { hay(c, 'NUEVA pone'); });
    ap.obligatorias.forEach(function (c) { hay(c, 'OBLIGATORIAS nombra'); });
    lista(ap.filtros).forEach(function (c) { hay(c, 'FILTROS nombra'); });
    // T0630: cómo se llama cada fila al contarlas, [singular, plural] («tarea», «tareas»).
    var malFilas = function (x) { return x !== null && x !== undefined && !(Array.isArray(x) && !x.length) && !(Array.isArray(x) && x.length === 2 && x.every(function (t) { return typeof t === 'string' && t.trim(); })); };
    if (malFilas(cfg.FILAS)) errores.push(donde + 'FILAS tiene que ser [singular, plural], como ["tarea", "tareas"].');
    // T0642: lo que cambia un botón de ACCIONES se tiene que poder editar (si no, la tabla no deja guardarlo).
    lista(ap.acciones).forEach(function (x) {
      if (!x.titulo) errores.push(donde + 'un botón de ACCIONES sin título.');
      if (x.ir && x.poner) errores.push(donde + 'el botón «' + (x.titulo || '') + '» lleva «ir» y «poner»: o lleva a otra sección o cambia la fila.');
      Object.keys(x.con || {}).forEach(function (k) { columnasCon(x.con[k]).forEach(function (c) { hay(c, 'el botón «' + (x.titulo || '') + '» usa'); }); }); // T0689: también las {COLUMNA} de una plantilla
      if (x.fijo && (typeof x.fijo !== 'object' || Array.isArray(x.fijo))) errores.push(donde + 'el botón «' + (x.titulo || '') + '»: «fijo» es { parámetro: valor }.');
      Object.keys(x.poner || {}).forEach(function (c) { if (ap.editar !== true && ed.indexOf(c) < 0) errores.push(donde + 'el botón «' + (x.titulo || '') + '» cambia ' + c + ', que no está en EDITAR.'); });
    });
    var vids = {};
    vistasDe(ap).forEach(function (v) {
      if (vids[v.id]) errores.push(donde + 'la vista «' + v.id + '» está dos veces.');
      if (malFilas(v.filas)) errores.push(donde + 'filas de la vista «' + v.id + '» tiene que ser [singular, plural], como ["nota", "notas"].');
      vids[v.id] = true;
      lista(v.filtro).forEach(function (cnd) { if (cnd.campo) hay(cnd.campo, 'el filtro de la vista «' + v.id + '» usa'); });
      if (v.agrupar) hay(v.agrupar.campo || v.agrupar, 'la vista «' + v.id + '» agrupa por');
      // T0691: el muestrario, con columnas que existen; y no es además un tablero.
      if (v.galeria) {
        if (typeof v.galeria !== 'object' || Array.isArray(v.galeria)) errores.push(donde + 'el muestrario de la vista «' + v.id + '» es { "foto", "titulo", "debajo", "cifra" }.');
        else [v.galeria.foto, v.galeria.titulo, v.galeria.cifra].concat(lista(v.galeria.debajo)).forEach(function (c) { if (c) hay(c, 'el muestrario de la vista «' + v.id + '» usa'); });
        if (v.tablero) errores.push(donde + 'la vista «' + v.id + '» es un muestrario: no es además un tablero.');
      }
      if (v.tablero) {
        if (!v.tablero.campo) errores.push(donde + 'el tablero de la vista «' + v.id + '» no dice por qué columna (tablero.campo).');
        else hay(v.tablero.campo, 'el tablero de la vista «' + v.id + '» usa');
        if (v.agrupar) errores.push(donde + 'la vista «' + v.id + '» es un tablero: no agrupa además.');
      }
      // T0690: lo hecho, plegado al final de cada grupo: dice qué es lo hecho (si) y, para «Ver lo de antes», su fecha y días.
      if (v.plegar) {
        var pg = v.plegar;
        if (typeof pg !== 'object' || Array.isArray(pg) || !lista(pg.si).length) errores.push(donde + 'la vista «' + v.id + '» pliega sin decir qué (plegar.si, unas condiciones).');
        else lista(pg.si).forEach(function cond(x) { if (x && x.o) lista(x.o).forEach(function (y) { lista(y).forEach(cond); }); else if (x && x.campo) hay(x.campo, 'lo plegado de la vista «' + v.id + '» usa'); });
        if (pg.campo) hay(pg.campo, 'lo plegado de la vista «' + v.id + '» usa');
        if ((pg.dias && !pg.campo) || (pg.campo && !(pg.dias > 0))) errores.push(donde + 'lo plegado de la vista «' + v.id + '» necesita su fecha y sus días a la vez (plegar.campo y plegar.dias).');
        if (v.tablero || v.galeria) errores.push(donde + 'la vista «' + v.id + '» pliega lo hecho: no es además un tablero ni un muestrario.');
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
    // T0662: el motor pone {} a lo que la sección no dice (el defecto de modulo.json): eso no es un error, es que no lo usa.
    var puesto = function (x) { return !!x && (typeof x !== 'object' || Object.keys(x).length > 0); };
    var rp = ap.rapidas;
    if (puesto(cfg.RAPIDAS) && !rp) errores.push(donde + 'RAPIDAS no dice ni HECHA ni PASAR.');
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
    if (puesto(cfg.ALTA) && !ap.alta) errores.push(donde + 'ALTA no dice sus campos (campos).');
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
    // T0708: un «de» por una ruta (TELAS · ID_DISENO.ID_PROVEEDOR): su primer paso apunta a otra tabla; y las cifras del resumen.
    Object.keys(ap.campos).forEach(function (c) {
      var de = ap.campos[c].de;
      if (!de || !de.tabla || String(de.campo || '').indexOf('.') < 0) return;
      var p0 = String(de.campo).split('.')[0], cs = columnasTabla ? columnasTabla(de.tabla) : null;
      if (cs && cs.indexOf(p0) < 0) errores.push(donde + 'CAMPOS.' + c + '.de.campo «' + de.campo + '»: ' + p0 + ' no es una columna de ' + de.tabla + '.');
      else if (Object.keys(ap.refs).length && !refDe(ap, de.tabla, p0)) errores.push(donde + 'CAMPOS.' + c + '.de.campo «' + de.campo + '»: ' + p0 + ' no apunta a otra tabla.');
    });
    if (puesto(cfg.RESUMEN) && !ap.resumen) errores.push(donde + 'RESUMEN no dice en «cifras» qué tablas cuenta.');
    if (ap.resumen) ap.resumen.cifras.forEach(function (x, i) {
      if (!x.filas || x.filas.length !== 2) errores.push(donde + 'RESUMEN.cifras[' + i + '] (' + x.tabla + ') no dice en «filas» cómo se llama una y cómo varias (["tela", "telas"]).');
    });
    // T0652: el resumen de con quién es la fila.
    if (puesto(cfg.CONTEXTO) && !ap.contexto) errores.push(donde + 'CONTEXTO no dice en «de» de qué tablas sale el resumen.');
    if (ap.contexto) {
      var cx = ap.contexto, cn = function (p) { return typeof p === 'string' ? p : (p && p.campo); };
      if (!cx.campo) errores.push(donde + 'CONTEXTO no dice en «campo» qué columna lleva al resumen.');
      else if (!campo(ap, cx.campo).primero) hay(cx.campo, 'CONTEXTO.campo es');
      if (cx.notas) hay(cx.notas, 'CONTEXTO.notas es');
      if (cx.fecha) hay(cx.fecha, 'CONTEXTO.fecha es');
      lista(cx.hecho).forEach(function (cnd) { if (cnd && cnd.campo) hay(cnd.campo, 'CONTEXTO.hecho usa'); });
      if (!cx.hecho && !(ap.rapidas && ap.rapidas.hecha)) errores.push(donde + 'CONTEXTO no sabe qué está hecho: falta «hecho» (o RAPIDAS.HECHA).');
      Object.keys(cx.de).forEach(function (c) {
        var d = cx.de[c], q = 'CONTEXTO.de.' + c;
        hay(c, q + ' es');
        if (!d.tabla) { errores.push(donde + q + ' no dice su tabla.'); return; }
        var cs = columnasTabla ? columnasTabla(d.tabla) : null;
        if (cs) d.sub.concat(d.chips, d.nota ? [d.nota] : []).map(cn).forEach(function (x) { hay(x, q + ' usa', d.tabla, cs); });
        d.lineas.forEach(function (l, i) {
          if (!l || !l.tabla || !l.campo) { errores.push(donde + q + '.lineas[' + i + '] necesita «tabla» y «campo».'); return; }
          var cl = columnasTabla ? columnasTabla(l.tabla) : null;
          if (cl) [l.campo].concat(lista(l.columnas).map(cn)).forEach(function (x) { hay(x, q + '.lineas «' + (l.titulo || l.tabla) + '» usa', l.tabla, cl); });
        });
      });
    }
    ap.relacionados.forEach(function (r) {
      var q = 'lo relacionado «' + (r.titulo || r.tabla) + '»';
      // T0691: «juntar», cada fuente con su tabla, su campo, con quién y la columna de esta con la que se cruza.
      if (r.juntar) {
        lista(r.juntar).forEach(function (j, i) {
          var qj = q + ', fuente ' + (i + 1);
          if (!j.tabla || !j.campo || !j.quien) { errores.push(donde + qj + ' necesita tabla, campo y quien.'); return; }
          var cj = columnasTabla ? columnasTabla(j.tabla) : null;
          if (columnasTabla && !cj) { errores.push(donde + qj + ': la tabla ' + j.tabla + ' no está.'); return; }
          if (cj) [j.campo, String(j.quien).split('.')[0]].concat(j.cuando ? [String(j.cuando).split('.')[0]] : []).forEach(function (x) { hay(x, qj + ' usa', j.tabla, cj); });
          hay(j.con || ap.clave, qj + ' usa');
        });
        return;
      }
      if (!r.tabla) { errores.push(donde + q + ' no dice su tabla.'); return; }
      var cs = columnasTabla ? columnasTabla(r.tabla) : null;
      if (columnasTabla && !cs) errores.push(donde + q + ': la tabla ' + r.tabla + ' no está.');
      hay(r.con, q + ' usa');
      // T0642: una columna con ruta («ID_TELA.COLOR»): su primer paso es una columna de esa tabla.
      // T0708: una columna que es uno de sus «campos» calculados, plantilla o «de» (los colores de cada diseño) no está en la tabla.
      var deCampos = function (c) { var d = (r.campos || {})[c]; return !!(d && (d.calculo || d.plantilla || d.de || d.primero)); };
      if (cs) [r.campo].concat((r.columnas || []).filter(function (c) { return !deCampos(c); })).forEach(function (c) { hay(String(c).split('.')[0], q + ' usa', r.tabla, cs); });
      if (r.nueva && !r.seccion) errores.push(donde + q + ': «nueva» necesita la sección a la que lleva (seccion).');
      // T0641: en una «tarjeta», cada campo es una columna de esa tabla, una ruta o uno de sus «campos» (calculado, plantilla, «de»).
      if (cs && r.tarjeta) camposTarjeta(r).forEach(function (c) {
        var d = (r.campos || {})[c];
        if (!(d && (d.calculo || d.plantilla || d.de || d.primero))) hay(String(c).split('.')[0], q + ' usa', r.tabla, cs);
      });
    });
    return errores;
  }

  /** T0641 · Si quien ha entrado ve lo relacionado: sin «perfiles», todos; con ellos, esos perfiles y quien administra (la
   *  comparativa de una marca lleva lo que le cuesta a Marta: no para el perfil Ayuda, que no ve costes). */
  function veRelacionado(r, quien) { return !r.perfiles || !!(quien && quien.admin) || lista(r.perfiles).indexOf(quien && quien.perfil) >= 0; }
  /** T0641 · Lo que enseña la tarjeta de lo relacionado: la línea, lo de debajo, el cara a cara y el detalle. */
  function camposTarjeta(r) {
    var t = r.tarjeta || {}, cs = [].concat(lista(t.titulo), t.linea || [], t.debajo || [], t.detalle || []);
    ((t.comparar || {}).filas || []).forEach(function (x) { cs = cs.concat(x.campos || []); });
    return cs.filter(function (c, i) { return c && cs.indexOf(c) === i; });
  }

  /* ---------- personalizar ----------
   * Lo de una sección: { vistas: [orden], ocultas: [vistas], avisos: { ID: { activo, dias } } }. Se aplica sobre su
   * configuración: lo que no nombra se queda como está y lo que ya no existe se olvida. El orden del menú va aparte (el
   * marco: UN.ordenMenu). */
  function aplicar(ap, p) {
    var r = JSON.parse(JSON.stringify(ap));
    p = p || {};
    if (r.vistas && r.vistas.length) {
      var ov = lista(p.vistas), fuera = ocultasDe(r, p);
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
  /** T0642 · Los botones de ACCIONES que salen en la ficha de esta fila: los que la cambian (si ya está como dejan, no) y
   *  cumplen su «si». Cada uno: { titulo, poner: { COLUMNA: valor }, hecho: 'Ha pasado a Clientes.', texto, si }. */
  function accionesDe(ap, f, hoy) {
    return (ap.acciones || []).filter(function (x) {
      if (x.ir) return !x.si || cumple(f, x.si, { hoy: hoy }); // T0687: lleva a otra sección; no cambia nada
      var ya = Object.keys(x.poner || {}).every(function (c) { return norm(f[c]) === norm(x.poner[c]); });
      return !ya && (!x.si || cumple(f, x.si, { hoy: hoy }));
    });
  }
  /**
   * T0687 · Adónde lleva un botón de ACCIONES con «ir»: ?s=precio&tela=BOR-004-01 («con»: parámetro → columna de la fila).
   * T0689 · «fijo»: parámetros que van tal cual ({ factura: "nueva" }); y un valor de «con» con {COLUMNA} es una plantilla
   * («ID_MARCA:{ID}» → cliente=ID_MARCA:M-214): si alguna de sus columnas está vacía, ese parámetro no va.
   */
  function irA(x, f) {
    var q = '?s=' + encodeURIComponent(String(x.ir).toLowerCase());
    Object.keys(x.fijo || {}).forEach(function (k) { if (!vacio(x.fijo[k])) q += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(x.fijo[k]); });
    Object.keys(x.con || {}).forEach(function (k) { var v = valorCon(x.con[k], f); if (!vacio(v)) q += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v); });
    return q;
  }
  /** T0689 · Las columnas que usa un valor de «con»: las {COLUMNA} de una plantilla o, si no lo es, él mismo. */
  function columnasCon(v) {
    var s = String(v == null ? '' : v), m = s.match(/\{[^{}]+\}/g);
    return m ? m.map(function (x) { return x.slice(1, -1).trim(); }) : [s];
  }
  /** T0689 · El valor de un «con» para una fila: la columna o la plantilla rellena ('' si le falta alguna columna). */
  function valorCon(v, f) {
    var s = String(v == null ? '' : v);
    if (!/\{[^{}]+\}/.test(s)) return f[s];
    var falta = false, r = s.replace(/\{([^{}]+)\}/g, function (_, c) { var x = f[c.trim()]; if (vacio(x)) falta = true; return vacio(x) ? '' : String(x); });
    return falta ? '' : r;
  }

  /* ---------- T0689 · la ficha guarda sola, campo a campo ---------- */

  /**
   * Lo que se guarda al cambiar el campo c de una ficha que ya está (crudo: lo que tiene la fila) al valor v (lo de la
   * entrada) → { cambios, error }. Las reglas que tenía «Guardar»: lo prohibido no se guarda, una obligatoria no se queda
   * vacía, un número se guarda como número y lo que se pone solo (DEDUCIR), si está vacío, va con él. Si es el mismo valor
   * que tenía, cambios vacío y sin error.
   */
  function cambioCampo(a, c, v, crudo, prohib) {
    crudo = crudo || {};
    var cp = campo(a, c), s = String(v == null ? '' : v).trim(), antes = vacio(crudo[c]) ? '' : String(crudo[c]).trim();
    var p = prohibido(s, prohib || []);
    if (p.length) return { cambios: {}, error: textoProhibido(p) };
    if (s === '' && (a.obligatorias || []).indexOf(c) >= 0) return { cambios: {}, error: 'Falta ' + cp.titulo + ': no se puede quedar vacío.' };
    var esNum = /^(importe|numero|porcentaje)$/.test(cp.tipo || '');
    var nv = esNum && s !== '' && !isNaN(aNumero(s)) ? aNumero(s) : s;
    var igual = esNum && s !== '' && antes !== '' && !isNaN(aNumero(s)) && !isNaN(aNumero(antes)) ? aNumero(s) === aNumero(antes) : s === antes;
    if (igual) return { cambios: {}, error: '' };
    var cambios = {}; cambios[c] = nv;
    var r = {}; Object.keys(crudo).forEach(function (k) { if (k !== '__crudo') r[k] = crudo[k]; }); r[c] = nv;
    var ded = deducidos(a, r);
    Object.keys(ded).forEach(function (k) { if (k !== c && vacio(crudo[k])) cambios[k] = ded[k]; });
    return { cambios: cambios, error: '' };
  }
  /**
   * T0689 · «Fase: Comprando» para el aviso con Deshacer: el título del campo y el valor como se ve (v: lo de la entrada; de
   * un desplegable, el texto de la opción). Vacío: «Fase: sin fase». Una nota, cortada; una fecha, como se ve en la lista.
   */
  function textoCambio(a, c, v, valores, prohib) {
    var cp = campo(a, c), s = String(v == null ? '' : v).trim(), x = {}; x[c] = s;
    if (!s) return cp.titulo + ': sin ' + String(cp.titulo).toLowerCase();
    if (cp.ids || cp.opciones) return cp.titulo + ': ' + s;
    return cp.titulo + ': ' + (cp.tipo === 'nota' || cp.tipo === 'texto' ? textoCorto(s, 40) : verTexto(cp, x, valores || {}, prohib || []));
  }

  /* ---------- T0689 · Mías / Todas ---------- */

  /** MIAS de la configuración: { campo, sinNadie: [perfiles] } o null. */
  function miasDe(m) {
    if (!m || !m.campo) return null;
    return { campo: String(m.campo), sinNadie: lista(m.sinNadie).map(String) };
  }
  /** El equipo sin repetir correos ni quien no tiene correo: [{ persona, correo }] (correos en minúsculas). */
  function equipoLimpio(eq) {
    var vistos = {};
    return lista(eq).map(function (p) { return { persona: String((p && p.persona) || '').trim(), correo: String((p && p.correo) || '').trim().toLowerCase() }; })
      .filter(function (p) { if (!p.correo || vistos[p.correo]) return false; vistos[p.correo] = 1; if (!p.persona) p.persona = p.correo; return true; });
  }
  /** ¿Sale «Mías / Todas»? Con MIAS y alguien más en el equipo que quien ha entrado. */
  function hayMias(mias, equipo, yo) {
    var c = String(yo || '').trim().toLowerCase();
    return !!mias && equipoLimpio(equipo).some(function (p) { return p.correo !== c; });
  }
  /** ¿Es mía esta fila? La de mi correo; la que no es de nadie, de quien administra y de los perfiles de sinNadie. */
  function esMia(mias, f, q) {
    var v = String(((f && (f.__crudo || f)) || {})[mias.campo] || '').trim().toLowerCase();
    if (!v) return !!q.admin || mias.sinNadie.indexOf(String(q.perfil || '')) >= 0;
    return v === String(q.correo || '').trim().toLowerCase();
  }
  /** El nombre corto de una persona del equipo para su etiqueta en la lista («Alejandro»); si no está, lo de antes de @. */
  /**
   * T0689 · El campo de MIAS como un desplegable del equipo: cada persona por su nombre, guardando su correo; en la lista y la
   * ficha se ve el nombre. Uno que ya no está en el equipo sale con su correo. Devuelve el apartado (cambiado).
   */
  function conEquipo(a, c, equipo) {
    var d = a.campos[c] = a.campos[c] || {}, ids = {}, nombres = {};
    equipoLimpio(equipo).forEach(function (p) { ids[p.persona] = p.correo; nombres[p.correo] = p.persona; });
    d._ids = ids; d.nombres = Object.assign({}, d.nombres || {}, nombres);
    if (!d.titulo) d.titulo = 'Para quién';
    return a;
  }
  function nombrePara(equipo, correo) {
    var c = String(correo || '').trim().toLowerCase(); if (!c) return '';
    var p = equipoLimpio(equipo).filter(function (x) { return x.correo === c; })[0];
    if (p && p.persona !== p.correo) return p.persona.split(/\s+/)[0];
    return c.split('@')[0];
  }
  /** T0642 · Las vistas que no se ven: las que ha quitado quien personaliza o, si nadie ha tocado nada, las que vienen
   *  quitadas («oculta»: true; de entrada, 2 o 3 por sección, y las demás se ponen en Personalizar). */
  function ocultasDe(ap, p) {
    if (p && p.ocultas !== undefined) return lista(p.ocultas);
    return (ap.vistas || []).filter(function (v) { return v.oculta; }).map(function (v) { return v.id; });
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
    // T0690: el orden puesto tocando el título de una columna manda sobre el de la vista.
    if (o.orden) return r.slice().sort(compararCampo(ap, o.orden, o.valores));
    var ord = (vista && vista.orden) || ap.orden;
    return ord ? r.slice().sort(comparar(ord)) : r;
  }

  /* ---------- T0690 · listas largas ----------
   * Con 2.000 apuntes, ninguna pantalla se hace interminable: 50 filas por grupo (POR_GRUPO) y «Ver más», 20 tarjetas por
   * columna del tablero (POR_COLUMNA, o tablero.max) y «Ver N más», lo relacionado de una ficha con su «max» y «Ver todo»;
   * y, en una vista con «plegar», lo hecho al final de cada grupo y cerrado, con lo de hace más de «dias» aparte. */
  var POR_GRUPO = 50, POR_COLUMNA = 20, EN_FICHA = 20;
  /** Ordenar por una columna tocando su título («CAMPO» o «-CAMPO»): las opciones (fases, prioridades) en su orden, los
   *  calculados por su valor y lo demás como `comparar` (fechas, números, textos; los vacíos, al final). */
  function compararCampo(ap, ord, valores) {
    var s = String(ord || ''), al = s.charAt(0) === '-' ? -1 : 1, c = s.replace(/^-/, ''), cp = campo(ap, c);
    var ops = lista(cp.opciones).map(norm), base = comparar(s);
    if (!cp.calculo && !ops.length) return base;
    return function (a, b) {
      var x = cp.calculo ? calcular(cp.calculo, a, valores) : a[c], y = cp.calculo ? calcular(cp.calculo, b, valores) : b[c];
      if (nada(x) && nada(y)) return 0;
      if (nada(x)) return 1;
      if (nada(y)) return -1;
      var ix = ops.indexOf(norm(x)), iy = ops.indexOf(norm(y));
      if (ix >= 0 && iy >= 0) return al * (ix - iy);
      var ox = {}, oy = {}; ox[c] = x; oy[c] = y;
      return base(ox, oy);
    };
  }
  /** El orden siguiente al tocar el título de una columna: primero de más a menos en fechas y cifras (lo último arriba) y de
   *  la A a la Z en lo demás, luego al revés, y a la tercera vuelve el de la vista (''). */
  function siguienteOrden(ap, puesto, c) {
    var cp = campo(ap, c), primero = cp.tipo === 'fecha' || /importe|numero|porcentaje/.test(cp.tipo) || !!cp.calculo ? '-' + c : c;
    var otro = primero.charAt(0) === '-' ? c : '-' + c;
    return puesto === primero ? otro : (puesto === otro ? '' : primero);
  }
  /** Lo de un grupo con «plegar» ({ si, campo, dias }): lo que no cumple «si» (lo pendiente), a la vista; lo que lo cumple
   *  (lo hecho, las notas), cerrado: lo de los últimos «dias» días y, aparte, lo de antes (o sin fecha, que no se sabe). */
  function plegados(vista, filas, hoy) {
    var p = vista && vista.plegar;
    if (!p || !p.si) return { abiertas: filas, hechas: [], antes: [] };
    var r = { abiertas: [], hechas: [], antes: [] };
    filas.forEach(function (f) {
      if (!cumple(f, p.si, { hoy: hoy })) { r.abiertas.push(f); return; }
      var d = p.dias && p.campo ? diasHasta(f[p.campo], hoy) : 0;
      (d !== null && d >= -(p.dias || Infinity) ? r.hechas : r.antes).push(f);
    });
    return r;
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
  /** T0691 · Los valores de un campo con «varios» («Poliéster · Algodón» → ['Poliéster', 'Algodón']). */
  function partes(v) { return String(v == null ? '' : v).split(/\s*[·,]\s*/).map(function (x) { return x.trim(); }).filter(Boolean); }
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
      var hayVacios = llenos.length < vs.length, base = { campo: c, titulo: cp.titulo, vacios: hayVacios, cp: cp };
      if (!llenos.length) return;
      if (cp.tipo === 'fecha') { if (llenos.some(aFecha)) r.push(Object.assign(base, { tipo: 'fecha' })); return; }
      var distintos = [];
      // T0691: un campo con «varios» lleva varios valores en uno («Poliéster · Algodón»): se elige cada uno («Lleva algodón»).
      if (cp.varios) llenos = [].concat.apply([], llenos.map(partes));
      llenos.forEach(function (v) { var s = String(v).trim(); if (distintos.map(norm).indexOf(norm(s)) < 0) distintos.push(s); });
      var esLista = cp.ids || cp.opciones || cp.varios || /^(estado|sino)$/.test(cp.tipo);
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
      if (x.es !== undefined) return !nada(v) && (campo(ap, c).varios ? partes(v).map(norm).indexOf(norm(x.es)) >= 0 : norm(v) === norm(x.es));
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
    if (x.es !== undefined) return d.titulo + ': ' + (d.cp ? mostrar(d.cp, x.es) : x.es);
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
    // T0642: una columna puede juntar varios valores ({ titulo: 'Hablando', valores: [...] }): el embudo de 9 fases, en 3.
    var cols = (dichas ? t.columnas : (cp.opciones || [])).map(function (v) {
      return v && typeof v === 'object' ? { id: '', titulo: v.titulo || '', valores: lista(v.valores).map(String), junta: true, filas: [] } : { id: String(v), titulo: mostrar(cp, v), valores: [String(v)], filas: [] };
    });
    var hay = function (v) { return cols.some(function (x) { return x.valores.map(norm).indexOf(norm(v)) >= 0; }); };
    if (!dichas) filas.forEach(function (f) { var v = vacio(f[c]) ? '' : String(f[c]); if (v && !hay(v)) cols.push({ id: v, titulo: mostrar(cp, v), valores: [v], filas: [] }); });
    var sin = { id: '', titulo: 'Sin ' + cp.titulo.toLowerCase(), valores: [''], filas: [] };
    filas.forEach(function (f) {
      var v = vacio(f[c]) ? '' : String(f[c]), col = v ? cols.filter(function (x) { return x.valores.map(norm).indexOf(norm(v)) >= 0; })[0] : null;
      if (col) col.filas.push(f); else if (!v && !dichas) sin.filas.push(f);
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
    return orden.map(function (k) { return { id: k, titulo: k ? mostrar(campo(ap, c), k) : 'Sin ' + campo(ap, c).titulo.toLowerCase(), filas: grupos[k] }; });
  }
  /** T0691 · «juntar»: con quién va esta fila, de varias tablas a la vez, una línea por cada uno con lo más fuerte que
   *  hay con él (el orden de juntar: comprada antes que propuesta, propuesta antes que interesada). Cada fuente:
   *  { tabla, campo, con, alFinal, quien, si, estado, color, cuando }: sus filas cuyo «campo» es el «con» de esta (con
   *  «alFinal», el código al final del texto: «… · BOR-004-01», como una línea de factura), que cumplen «si» (rutas
   *  valen: «ID_FACTURA.TIPO»); «quien», la ruta que dice con quién (su nombre); «cuando», la fecha, la más reciente. */
  function juntarDe(a, D, r, f, filas) {
    var crudo = f.__crudo || f, por = {}, orden = [];
    lista(r.juntar).forEach(function (j, ij) {
      var v = norm(crudo[j.con || a.clave]);
      if (!v || !j.tabla || !j.campo || !j.quien) return;
      var ver = function (x, ruta) {
        if (String(ruta).indexOf('.') > 0) return seguir(a, D, j.tabla, x, ruta);
        var rf = refDe(a, j.tabla, ruta);
        return rf ? nombreDe(D, rf, x[ruta]) : x[ruta];
      };
      filas(j.tabla).forEach(function (x) {
        var t = x[j.campo], m = j.alFinal ? /·\s*([^·]+)$/.exec(String(t == null ? '' : t)) : null;
        if ((j.alFinal ? (m ? norm(m[1]) : '') : norm(t)) !== v) return;
        if (j.si) { var y = {}; lista(j.si).forEach(function (c) { if (c.campo) y[c.campo] = ver(x, c.campo); }); if (!cumple(y, j.si)) return; }
        var q = ver(x, j.quien), k = norm(q);
        if (!k) return;
        var cu = j.cuando ? ver(x, j.cuando) : '', ya = por[k];
        if (ya && (ya.de !== ij || !(aFecha(cu) && (!aFecha(ya.cuando) || aFecha(cu) > aFecha(ya.cuando))))) return;
        if (!ya) orden.push(k);
        por[k] = { de: ij, quien: String(q), estado: j.estado || '', color: j.color || '', cuando: cu };
      });
    });
    return orden.map(function (k) { return por[k]; });
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
      // T0645: un envío a 0 no es un envío (en su Excel, una celda sin rellenar): el precio sin él no sale.
      // T0678: también lo que cuesta («envio»: lo que te cuesta puesta en España) y lo que lo usa (lo que te queda hasta su precio).
      if (cp.envio && !lista(cp.envio).some(function (e) { return calcular(e, f, valores) > 0; })) return 'Falta el envío';
      if (isNaN(v)) return cp.precio ? 'Falta el coste o el envío' : '';
      // T0641: «signo» dice el número en palabras según sea positivo o negativo («Te quedan 17,04 €/m», «Tu coste ya pasa su precio en 2,27 €/m»).
      if (cp.signo) {
        var pl = v > 0.00001 ? cp.signo.mas : (v < -0.00001 ? cp.signo.menos : (cp.signo.cero || cp.signo.mas));
        return String(pl || '{}').replace('{}', verTexto(Object.assign({}, cp, { calculo: ['+', Math.abs(v)], signo: null }), f, valores, prohib));
      }
      v = Math.round(v * 100) / 100;
    }
    if (vacio(v)) return '';
    if (!cp.calculo && prohibido(v, prohib).length) return tapar(v, prohib);
    var u = cp.unidad ? ' ' + cp.unidad : '';
    if (cp.tipo === 'fecha') return fechaCorta(v);
    if (cp.tipo === 'importe') { var n = aNumero(v); return isNaN(n) ? String(v) : num(n, 2) + (u || ' €'); }
    if (cp.tipo === 'porcentaje') { var p = aNumero(v); return isNaN(p) ? String(v) : num(p * 100, 0) + ' %'; }
    if (cp.tipo === 'numero') {
      var m = aNumero(v);
      // T0708: «palabras» [uno, varios, cero]: «1 tela», «82 telas» y, con 0, el tercero (sin él, vacío).
      if (cp.palabras && !isNaN(m)) return m === 0 ? String(cp.palabras[2] || '') : num(m, m % 1 ? 1 : 0) + ' ' + (m === 1 ? cp.palabras[0] : cp.palabras[1]);
      return isNaN(m) ? String(v) : num(m, m % 1 ? 1 : 0) + u;
    }
    if (cp.tipo === 'sino') return v === true || norm(v) === 'si' || norm(v) === 'true' ? 'Sí' : (v === false || norm(v) === 'no' || norm(v) === 'false' ? 'No' : String(v));
    if (cp.tipo === 'instagram') return cuentaInstagram(v) || String(v);
    return mostrar(cp, v) + u;
  }
  /**
   * T0641 · Las cuentas de un calculado, en una línea: «1.020 ₹ → 9,27 € + envío 5,00 € + margen 50 % = 21,41 €/m». Cada parte
   * de «desglose» es un texto («→», «+ envío») o { calculo, tipo, unidad }; al final, «=» y el valor. '' si a alguna parte le falta
   * algo (sin coste no hay cuentas que enseñar).
   */
  function desglose(ap, cp, f, valores) {
    if (!cp.desglose || !cp.calculo) return '';
    var total = verTexto(cp, f, valores, []), falta = isNaN(calcular(cp.calculo, f, valores));
    var partes = cp.desglose.map(function (p) {
      if (typeof p === 'string') return p;
      var x = { n: '', titulo: '', tipo: p.tipo || 'importe', unidad: p.unidad || '', calculo: expandir(p.calculo, ap.campos) };
      if (isNaN(calcular(x.calculo, f, valores))) falta = true;
      return verTexto(x, f, valores, []);
    });
    return falta || (cp.envio && total.indexOf('Falta') === 0) ? '' : partes.join(' ') + ' = ' + total;
  }
  /** Cuándo es una fecha, en palabras: «hoy», «mañana», «hace 3 días», «en 5 días». */
  /** T0679 · La fecha corta, con su día: «mar 10/11» (con el año solo si no es el de hoy). */
  function fechaDia(v, hoy) {
    var d = aFecha(v), h = aFecha(hoy); if (!d) return String(v);
    return DIAS_SEMANA[d.getDay()].slice(0, 3) + ' ' + dos(d.getDate()) + '/' + dos(d.getMonth() + 1) + (h && h.getFullYear() !== d.getFullYear() ? '/' + d.getFullYear() : '');
  }
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

  /** T0642 · Una cuenta de Instagram como se escribe («@marca», «marca», «instagram.com/marca/», el enlace entero) →
   *  «@marca»; '' si no lo parece. instagramUrl da su dirección. */
  function cuentaInstagram(v) {
    var s = String(v === undefined || v === null ? '' : v).trim(), m = /instagram\.com\/([\w.]+)/i.exec(s);
    var u = m ? m[1] : s.replace(/^@/, '');
    return /^[\w.]{1,30}$/.test(u) ? '@' + u : '';
  }
  function instagramUrl(v) { var c = cuentaInstagram(v); return c ? 'https://www.instagram.com/' + c.slice(1) + '/' : ''; }

  /** T0642 · Volver de una ficha a la que se ha llegado desde otra: a esa ficha («‹ Volver a Casa Albero») si se viene de
   *  una; si no, a la sección de la que se viene («‹ Volver a Clientes»); '' si no se viene de ninguna. */
  function textoVuelta(deFicha, desde) { var t = deFicha || (desde && desde.titulo) || ''; return t ? '‹ Volver a ' + t : ''; }
  /** T0642 · La dirección de ahora con la ficha abierta (?ficha=M-001) y sin lo de «+ Nueva …», para que «atrás» la vuelva a abrir. */
  function conFicha(search, id, quitar) {
    var u = new URLSearchParams(search);
    ['nueva'].concat(quitar || []).forEach(function (k) { u.delete(k); });
    u.set('ficha', id);
    return '?' + u.toString();
  }
  // T0642: el nombre de la ficha desde la que se salta a otra (una tela, una tarea, «+ Nueva tarea»), hasta que la abre la
  // sección a la que se va (todas las de Listado comparten este archivo).
  var vueltaPendiente = null;

  /** T0610 · Los avisos de una fila sin el que ya dice el título de su grupo: en «Con la fecha pasada», cada fila no repite
   *  «Con la fecha pasada» (la franja de color de la fila sigue). Sin grupo, todos. */
  function sinRepetir(avs, tituloGrupo, campoPlazo) {
    var t = String(tituloGrupo || '').trim().toLowerCase();
    var r = t ? avs.filter(function (x) { return String(x.titulo || '').trim().toLowerCase() !== t; }) : avs;
    // T0642: agrupado por el plazo de una fecha («Hoy», «Próximos 7 días»), un aviso que solo mira esa fecha («Es para
    // hoy») ya lo dice su grupo. La franja de color de la fila sigue.
    if (t && campoPlazo) r = r.filter(function (x) { var cs = lista(x.si); return !cs.length || !cs.every(function (c) { return c && c.campo === campoPlazo; }); });
    return r;
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
      r.push({ fecha: m, titulo: 'Mañana, ' + DIAS_SEMANA[dm], corto: 'Mañana' });
      r.push({ fecha: masDias(hoy, dm === 6 ? 3 : 2), titulo: 'El lunes', corto: 'El lunes' });
    } else r.push({ fecha: m, titulo: 'Mañana', corto: 'Mañana' });
    r.push({ fecha: masDias(hoy, 7), titulo: 'En una semana', corto: 'En una semana' });
    return r;
  }
  /** Para cuándo se apunta el siguiente paso: el primer día de trabajo, en 3 días o en una semana. «En 3 días» no cae en
   *  fin de semana (como Pasar, T0677): si cae, va al lunes; y si ese día ya es el primero (el viernes, «El lunes»), al
   *  siguiente de trabajo. Cuando no es justo dentro de 3 días, se dice el día («El lunes», «El martes»). */
  function fechasSiguiente(hoy) {
    var p = opcionesPasar(hoy), lab = p.length > 2 ? p[1] : p[0];
    var t = masDias(hoy, 3), dt = aFecha(t).getDay();
    if (dt === 6) t = masDias(t, 2); else if (dt === 0) t = masDias(t, 1);
    if (t <= lab.fecha) { t = masDias(lab.fecha, 1); dt = aFecha(t).getDay(); if (dt === 6) t = masDias(t, 2); else if (dt === 0) t = masDias(t, 1); }
    var tres = t === masDias(hoy, 3) ? 'En 3 días' : 'El ' + DIAS_SEMANA[aFecha(t).getDay()];
    return [{ fecha: lab.fecha, titulo: lab.titulo }, { fecha: t, titulo: tres }, { fecha: masDias(hoy, 7), titulo: 'En una semana' }];
  }
  /** T0677 · Un texto cortado para un aviso: hasta n letras, por la última palabra entera, con «…». */
  function textoCorto(t, n) {
    t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); n = n || 40;
    if (t.length <= n) return t;
    var c = t.slice(0, n - 1), e = c.lastIndexOf(' ');
    if (t.charAt(n - 1) !== ' ' && e > n / 2) c = c.slice(0, e); // si se corta a media palabra, hasta la anterior
    return c.replace(/[\s,.;:·–-]+$/, '') + '…';
  }
  /** T0677 · Cómo se nombra una fila en un aviso (««Mandar muestras» pasa al vie 20»): su texto, cortado y entre comillas;
   *  sin texto, su código. Lo que no se guarda sale tapado. */
  function nombreCorto(ap, f, prohib) {
    var v = f ? f[ap.nombre] : '', t = vacio(v) ? '' : (prohibido(v, prohib || []).length ? tapar(v, prohib) : String(v));
    t = textoCorto(t, 48);
    return t ? '«' + t + '»' : (f && !vacio(f[ap.codigo]) ? String(f[ap.codigo]) : '');
  }
  /** T0677 · Un cambio que se puede deshacer. «hecho»: la promesa del cambio. deshacer(): espera a que el cambio acabe (si
   *  aún se está guardando) y entonces vuelve atrás; si el cambio no llegó a guardarse, no hay nada que deshacer. Su promesa
   *  falla si falla el deshacer, para no decir «Deshecho» sin serlo. Una sola vez: la segunda no hace nada. */
  function deshacerEnOrden(cambio, volver) {
    var hecho = Promise.resolve().then(cambio), usado = null;
    return { hecho: hecho, deshacer: function () {
      if (!usado) usado = hecho.then(function () { return Promise.resolve().then(volver).then(function () { return true; }); }, function () { return false; });
      return usado;
    } };
  }
  /** T0677 · La lista de «con quién» al añadir (un campo con «primero»): un grupo por columna, con el título de «grupos»
   *  («Marcas», «Proveedores», «Otros») o el del campo, en orden alfabético y, con q, solo lo que lo lleva (sin tildes ni
   *  mayúsculas). ed: las columnas que se pueden poner. [{ col, titulo, opciones: [{ nombre, valor }] }], sin grupos vacíos. */
  function gruposConQuien(ap, c, ed, q) {
    var cp = campo(ap, c), t = norm(q);
    return (cp.primero || []).filter(function (p) { return (!ed || ed.indexOf(p) >= 0) && campo(ap, p).ids; }).map(function (p) {
      var ids = campo(ap, p).ids;
      var ops = Object.keys(ids).filter(function (n) { return !t || norm(n).indexOf(t) >= 0; })
        .sort(function (x, y) { return x.localeCompare(y, 'es', { sensitivity: 'base' }); })
        .map(function (n) { return { nombre: n, valor: ids[n] }; });
      return { col: p, titulo: (cp.grupos && cp.grupos[p]) || campo(ap, p).titulo, opciones: ops };
    }).filter(function (g) { return g.opciones.length; });
  }
  /** T0677 · Lo que se enseña de una fila que ya dice un aviso: el estado «Esperando respuesta» junto al aviso «Esperando
   *  respuesta hace días» es lo mismo dos veces. true si algún aviso empieza por ese texto. */
  function loDiceUnAviso(txt, avs) {
    var t = norm(txt);
    return !!t && (avs || []).some(function (x) { return norm(x.titulo).indexOf(t) === 0; });
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

  /* ---------- T0652 · el resumen de con quién es una fila ----------
   * Desde una tarea con un cliente (o un proveedor), lo último que se hizo con él, lo que queda y unas líneas de su ficha,
   * sin salir de la lista. Lo junta de lo apuntado: no escribe nada. */
  /** La columna de CONTEXTO.de que tiene algo en la fila (la de verdad, con códigos): en el orden de «primero» del campo. */
  function contextoCol(ap, crudo) {
    var cx = ap.contexto;
    if (!cx || !crudo) return '';
    var orden = (campo(ap, cx.campo).primero || []).concat(Object.keys(cx.de));
    return orden.filter(function (c) { return cx.de[c] && !vacio(crudo[c]); })[0] || '';
  }
  /** Un trozo de una línea: una columna o { campo, antes, despues } («pagan hoy 14 €/m»). Lo que no se guarda sale tapado;
   *  «despues» solo va tras un número (una unidad no va detrás de «Ideal 8, aceptan 9»). */
  function pieza(ap, t, fila, p, prohib) {
    var q = typeof p === 'string' ? { campo: p } : (p || {}), v = fila[q.campo];
    if (vacio(v)) return '';
    var s = prohibido(v, prohib).length ? tapar(v, prohib) : String(v).trim();
    if (q.despues && !isNaN(aNumero(v))) s += q.despues;
    if (q.sinNumero) s = mostrar({ sinNumero: true }, s); // T0677: «6 Propuesta enviada» → «Propuesta enviada», como en las listas
    // «Prioridad alta»: el nombre de otra tabla, detrás de su «antes», en minúscula.
    if (q.antes) s = q.antes + ' ' + (refDe(ap, t, q.campo) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
    return s;
  }
  function piezas(ap, t, fila, ps, prohib) { return lista(ps).map(function (p) { return pieza(ap, t, fila, p, prohib); }).filter(String).join(' · '); }
  /** El resumen de la fila (crudo, con códigos) desde las filas de su tabla como se ven (preparar). o: { hoy, prohib, sin
   *  (la clave de la fila que no sale: la de la ficha abierta) }. null si la fila no es con nadie de CONTEXTO.de. */
  function resumenDe(ap, D, crudo, vistas, o) {
    o = o || {};
    var col = contextoCol(ap, crudo);
    if (!col) return null;
    var cx = ap.contexto, d = cx.de[col], id = crudo[col], hoy = o.hoy, prohib = o.prohib || [];
    var otra = d.tabla ? D.fila(d.tabla, id) : null, x = otra ? conNombres(ap, D, d.tabla, otra) : {};
    var nombre = otra ? nombreDe(D, d.tabla, id) : String(id);
    var sec = d.secciones.filter(function (s) { return s.id && cumple(x, s.si, { hoy: hoy }); })[0];
    var fc = cx.fecha || (ap.rapidas && ap.rapidas.pasar) || 'FECHA', h = ap.rapidas && ap.rapidas.hecha;
    var esHecho = function (f) { return cx.hecho ? cumple(f, cx.hecho, { hoy: hoy }) : !!h && norm(f[h.campo]) === norm(h.valor); };
    var esPend = function (f) { return ap.rapidas ? rapidaEn(ap, f, hoy) : !esHecho(f); };
    var suyas = (vistas || []).filter(function (f) {
      var c = f.__crudo || f;
      return norm(c[col]) === norm(id) && (o.sin === undefined || o.sin === null || String(c[ap.clave]) !== String(o.sin));
    });
    var porFecha = function (desc) {
      return function (a, b) {
        var x1 = aFecha(a[fc]), x2 = aFecha(b[fc]);
        if (!x1 || !x2) return x1 ? -1 : (x2 ? 1 : 0); // sin fecha, al final
        return desc ? x2 - x1 : x1 - x2;
      };
    };
    var item = function (f) {
      var dd = aFecha(f[fc]), dh = diasHasta(f[fc], hoy);
      return { id: (f.__crudo || f)[ap.clave], fecha: dd ? dos(dd.getDate()) + '/' + dos(dd.getMonth() + 1) : '', titulo: pieza(ap, ap.tabla, f, ap.nombre, prohib),
        nota: cx.notas ? pieza(ap, ap.tabla, f, cx.notas, prohib) : '', cuando: cuando(f[fc], hoy), tarde: dh !== null && dh < 0 };
    };
    var hechas = suyas.filter(esHecho).sort(porFecha(true)), pend = suyas.filter(function (f) { return !esHecho(f) && esPend(f); }).sort(porFecha(false));
    var lineas = d.lineas.map(function (l) {
      var t = l.tabla || '';
      var rs = (t ? D.filas(t) || [] : []).filter(function (r) { return !vacio(r[l.campo]) && norm(r[l.campo]) === norm(id); }).slice(0, l.max || 1);
      var txt = rs.map(function (r) { return piezas(ap, t, conNombres(ap, D, t, r), l.columnas, prohib); }).filter(String).join('; ');
      return { titulo: l.titulo || '', texto: txt };
    }).filter(function (l) { return l.texto; });
    return { col: col, id: id, nombre: nombre, seccion: sec ? sec.id : '', sub: piezas(ap, d.tabla, x, d.sub, prohib),
      chips: d.chips.map(function (p) { return pieza(ap, d.tabla, x, p, prohib); }).filter(String), nota: d.nota ? pieza(ap, d.tabla, x, d.nota, prohib) : '',
      ultimas: hechas.slice(0, cx.hechas).map(item), pendientes: pend.slice(0, cx.pendientes).map(item),
      masPendientes: Math.max(0, pend.length - cx.pendientes), lineas: lineas };
  }

  /**
   * T0692 · «Sus ventas» en la ficha: lo que dice de un vistazo (la última, lo de este año y lo que debe) y cada venta, que
   * abre su sección (o.seccion, o.va: su título si quien mira la ve) con ella (?venta=). q: las de ventasPorQuien de Economía
   * de esta fila; undefined, aún no han llegado («Mirando sus ventas…»); null o sin ventas, nada. o: { titulo, seccion, va, max, hoy }.
   */
  function htmlVentas(q, o) {
    var tit = texto(o.titulo || 'Sus ventas');
    if (q === undefined) return '<section class="li-fgrupo"><h3 class="li-fg-t">' + tit + '</h3><p class="u-nota">Mirando sus ventas…</p></section>';
    if (!q || !q.ventas || !q.ventas.length) return '';
    var eur = function (c) { return num(c / 100, c % 100 ? 2 : 0) + ' €'; };
    var partes = ['Última venta ' + (cuando(q.ultima, o.hoy) || fechaCorta(q.ultima))];
    if (q.enAnio) partes.push(q.anio ? eur(q.anio) + ' este año' : (q.enAnio === 1 ? '1 venta' : q.enAnio + ' ventas') + ' este año, sin precio cerrado');
    var debe = q.debe > 0 ? '<span class="u-mal">Te debe ' + eur(q.debe) + '</span>' : (q.sinPrecio ? 'Sin precio cerrado en ' + (q.sinPrecio === 1 ? 'una' : q.sinPrecio) : '<span class="u-bien">Al día</span>');
    var sec = String(o.seccion || ''), va = o.va, max = o.max || 10;
    return '<section class="li-fgrupo li-ventas"><h3 class="li-fg-t">' + tit + ' <span class="u-cifra">' + q.ventas.length + '</span></h3>' +
      '<p class="li-ven-res">' + partes.map(texto).join(' · ') + ' · ' + debe + '</p><ul class="li-rel">' + q.ventas.slice(0, max).map(function (x) {
        var paso = x.paso + (x.fechaPaso ? ' ' + fechaCorta(x.fechaPaso) : ''), extra = x.cobrada || x.adelantado ? (x.importe !== null ? eur(x.importe) : '') :
          (x.debe === null ? 'Sin precio cerrado' : x.debe > 0 ? 'Te debe ' + eur(x.debe) : '');
        var dentro = '<span class="li-rel-n">' + texto(x.v.NOMBRE || x.v.ID) + '</span><span>' + texto(paso) + '</span>' +
          (extra ? '<span' + (x.debe > 0 && !x.cobrada && !x.adelantado ? ' class="u-mal"' : '') + '>' + texto(extra) + '</span>' : '');
        return '<li>' + (va ? '<a class="li-rel-f" href="?s=' + encodeURIComponent(sec.toLowerCase()) + '&venta=' + encodeURIComponent(x.v.ID) + '" data-sx="' + texto(sec) + '">' + dentro + '<span class="li-ir">' + texto(va) + ' ›</span></a>' : '<div class="li-rel-f">' + dentro + '</div>') + '</li>';
      }).join('') + '</ul>' + (q.ventas.length > max ? '<p class="u-nota">Y ' + (q.ventas.length - max) + ' más, en ' + texto(va || 'Pedidos') + '.</p>' : '') + '</section>';
  }

  var CALC = { fechaDia: fechaDia, webCorta: webCorta, textoCorto: textoCorto, gruposConQuien: gruposConQuien, nombreCorto: nombreCorto, deshacerEnOrden: deshacerEnOrden, loDiceUnAviso: loDiceUnAviso, contextoCol: contextoCol, resumenDe: resumenDe, opcionesPasar: opcionesPasar, fechasSiguiente: fechasSiguiente, rapidaEn: rapidaEn, siguienteCon: siguienteCon, deducidos: deducidos, filaSiguiente: filaSiguiente, codigoDe: codigoDe, diaCorto: diaCorto, masDias: masDias,
    textoVuelta: textoVuelta, conFicha: conFicha, mostrar: mostrar, cuentaInstagram: cuentaInstagram, instagramUrl: instagramUrl, imagen: imagen, fotoDeTarjeta: fotoDeTarjeta, SIN_FOTO: SIN_FOTO, sinRepetir: sinRepetir, nivelDeCampo: nivelDeCampo, columnaDelGrupo: columnaDelGrupo, titulo: titulo, aFecha: aFecha, diasHasta: diasHasta, aNumero: aNumero, esTelefono: esTelefono, telDe: telDe, cumple: cumple, calcular: calcular, usa: usa,
    valoresDe: valoresDe, resumenCifras: resumenCifras, cifrasResumen: cifrasResumen, seguirCrudo: seguirCrudo, tablasDeRuta: tablasDeRuta, conCamposPropios: conCamposPropios, prohibido: prohibido, tapar: tapar, num: num, textoProhibido: textoProhibido, apartado: apartado, sinOcultas: sinOcultas, campo: campo,
    ocultas: ocultas, vistasDe: vistasDe, vistaDeFila: vistaDeFila, enriquecer: enriquecer, preparar: preparar, seguir: seguir, conNombres: conNombres, nombradas: nombradas, columnasDe: columnasDe, comprobar: comprobar, aplicar: aplicar, accionesDe: accionesDe, irA: irA, ocultasDe: ocultasDe, mover: mover, paraClaude: paraClaude, cuenta: cuenta, textoDe: textoDe, repartir: repartir, valorCon: valorCon, columnasCon: columnasCon, cambioCampo: cambioCampo, textoCambio: textoCambio, miasDe: miasDe, equipoLimpio: equipoLimpio, hayMias: hayMias, esMia: esMia, nombrePara: nombrePara, conEquipo: conEquipo,
    avisosDe: avisosDe, avisosActivos: avisosActivos, filtrar: filtrar, agrupar: agrupar, columnasTablero: columnasTablero,
    relacionadas: relacionadas, juntarDe: juntarDe, partes: partes, verTexto: verTexto, rellenar: rellenar, enPlantilla: enPlantilla, veRelacionado: veRelacionado, expandir: expandir, camposTarjeta: camposTarjeta, desglose: desglose, cuando: cuando, comparar: comparar,
    filtrables: filtrables, aIntervalo: aIntervalo, cumpleFiltros: cumpleFiltros, filtrosQueValen: filtrosQueValen, textoFiltro: textoFiltro, sinVentas: sinVentas, deVentas: deVentas, sinCampos: sinCampos, htmlVentas: htmlVentas,
    compararCampo: compararCampo, siguienteOrden: siguienteOrden, plegados: plegados, POR_GRUPO: POR_GRUPO, POR_COLUMNA: POR_COLUMNA, EN_FICHA: EN_FICHA };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) {} return ''; }
  function hoyIso() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function json(t) { try { return JSON.parse(t || 'null'); } catch (e) { return null; } }
  var ICONO_AJUSTAR = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>';
  var ICONO_X = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICONO_INFO = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>';
  var ICONO_FILTRO = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4 1.5v-8L4 5z"/></svg>';
  var ICONO_COPIAR = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';
  var ICONO_OK = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  // T0679 · Los enlaces de una ficha, con el icono de lo que abren (sin la flecha ↗).
  var ICONO_WEB = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>';
  var ICONO_IG = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6"/></svg>';
  var ICONO_MAIL = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>';
  var ICONO_TEL = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>';
  var ICONO_FOTO = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>';
  /** La dirección de una web, corta y sin «https://www.» (ejemplo.com/casa). */
  function webCorta(v) { return String(v).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''); }
  var ICONO_FLECHA = '<svg class="u-icono li-flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  var ICONO_MAS = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  var ICONO_MOVER = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="13" height="14" rx="2"/><path d="M3.5 9.5h13M7.5 3v4M12.5 3v4M15 15h6M18.5 12.5L21 15l-2.5 2.5"/></svg>';
  var ICONO_RELOJ = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>';
  var MENU = 'MENU'; // la fila de PREFERENCIAS con el orden del menú
  var teclaEsc = null, alMover = null, alSoltar = null, alCancelar = null, alDesplazar = null, alTocarFuera = null; // oyentes del documento, para quitarlos al cerrar

  window.UN.registrar('LISTADO', {
    abrir: function (el, ctx) {
      // Las secciones a las que se puede ir (las que ve quien ha entrado), para los enlaces de lo relacionado.
      var veo = {}; (ctx.secciones || []).forEach(function (s) { veo[s.id] = s.titulo; });
      // T0692: las ventas (VENTAS y los campos con «venta»), solo para quien ve su sección (Pedidos).
      var T = ctx.tablas, cfg = sinVentas(sinOcultas(ctx.config || {}, ctx.ocultar), veo), PROHIB = cfg.PROHIBIDO === undefined ? PROHIB_DEFECTO : cfg.PROHIBIDO;
      var BASE = apartado(cfg, ctx.id, ctx.titulo), PREF = cfg.PREFERENCIAS || '';
      var puedePersonalizar = !!ctx.admin || (cfg.PERSONALIZAN || []).indexOf(ctx.perfil) >= 0;
      var K = 'li_' + ctx.id + '_';
      // T0689 · Mías / Todas: con MIAS y alguien más en el equipo (ctx.equipo, de ACCESOS y quien administra). Cada fila es de
      // quien dice su columna (su correo); la que no dice nada, de quien administra y de los perfiles de «sinNadie».
      var EQ = equipoLimpio(ctx.equipo), YO = { correo: String(ctx.correo || '').toLowerCase(), perfil: ctx.perfil || '', admin: !!ctx.admin };
      var MIAS = hayMias(BASE.mias, EQ, YO.correo) ? BASE.mias : null;
      var KM = K + 'mias_' + YO.correo;
      // T0625: los filtros (S.filtros) no se recuerdan: al volver a la sección, se ve todo.
      var S = { vista: guardado(K + 'vista'), q: '', aviso: '', filtros: {}, leido: false, menu: '', ctx: '', mas: {}, abre: {}, antes: {}, mias: guardado(KM) === 'todas' ? 'todas' : 'mias' };
      var url = new URLSearchParams(location.search), pedida = url.get('ficha');
      // T0642: si se llega desde otra ficha, su nombre se queda en esta entrada del historial: vale también al ir y volver.
      if (vueltaPendiente !== null) { try { history.replaceState(Object.assign({}, history.state, { deFicha: vueltaPendiente }), ''); } catch (e) {} vueltaPendiente = null; }
      var deFicha = (history.state && history.state.deFicha) || '';

      el.innerHTML = '<div id="li-cont"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<div class="u-velo" id="li-velo"><div class="u-ventana li-ventana" role="dialog" aria-modal="true" aria-labelledby="li-vt"><div class="n-ventana" id="li-vent"></div></div></div>' +
        '<div class="u-aviso li-deshacer" id="li-deshacer" role="status" hidden><span></span><button type="button" data-deshacer>Deshacer</button></div>' +
        '<aside class="li-ctx" id="li-ctx" role="dialog" aria-labelledby="li-ctx-t" hidden></aside>';
      var cont = el.querySelector('#li-cont'), velo = el.querySelector('#li-velo'), vent = el.querySelector('#li-vent'), avDes = el.querySelector('#li-deshacer'), pCtx = el.querySelector('#li-ctx');
      // T0602: una foto que no se puede ver (un archivo de Drive que no es público ni de quien mira) no sale rota.
      // T0633: en su lugar, un aviso (en la ficha, con el porqué; el enlace «Ver foto ↗» sigue al lado), no un hueco.
      el.addEventListener('error', function (e) {
        var t = e.target; if (!t || !t.hasAttribute || !t.hasAttribute('data-li-foto') || !t.parentNode) return;
        // T0691: en el muestrario, una foto que no se ve deja su fondo neutro, como una tela sin foto (sin «No se ve»).
        if (/\bli-gal-img\b/.test(t.className)) { t.parentNode.removeChild(t); return; }
        var grande = /\bli-foto\b/.test(t.className), s = document.createElement('span');
        s.className = 'li-nofoto' + (grande ? ' li-nofoto-g' : '') + (/\bli-t-img\b/.test(t.className) ? ' li-t-img' : '');
        s.textContent = grande ? SIN_FOTO.largo : SIN_FOTO.corto;
        if (!grande) s.title = SIN_FOTO.largo;
        t.parentNode.replaceChild(s, t);
      }, true);

      /* ---------- datos ---------- */
      var tablas = [BASE.tabla];
      BASE.relacionados.forEach(function (r) { [r].concat(lista(r.juntar)).forEach(function (j) { if (j.tabla && tablas.indexOf(j.tabla) < 0) tablas.push(j.tabla); }); });
      Object.keys(cfg.VALORES || {}).forEach(function (k) { var v = cfg.VALORES[k]; if (v && v.tabla && tablas.indexOf(v.tabla) < 0) tablas.push(v.tabla); });
      if (PREF && tablas.indexOf(PREF) < 0) tablas.push(PREF);
      // Las tablas a las que apuntan (los nombres de las fases, de las marcas…) y las de los campos con «de».
      Object.keys(BASE.refs).forEach(function (t) { if (tablas.indexOf(t) < 0) tablas.push(t); });
      Object.keys(BASE.campos).forEach(function (c) { var de = BASE.campos[c].de; if (de && de.tabla && tablas.indexOf(de.tabla) < 0) tablas.push(de.tabla); });
      // T0641: y las de los campos con «de» de lo relacionado (la composición de la alternativa de una comparativa).
      BASE.relacionados.forEach(function (r) { Object.keys(r.campos || {}).forEach(function (c) { var de = r.campos[c].de; if (de && de.tabla && tablas.indexOf(de.tabla) < 0) tablas.push(de.tabla); }); });
      // T0708: las de por medio de un «de» por una ruta (DISENOS, para las telas de un proveedor) y las del resumen.
      function ruta(de) { if (de && de.tabla) tablasDeRuta(BASE, de.tabla, de.campo).forEach(function (t) { if (tablas.indexOf(t) < 0) tablas.push(t); }); }
      Object.keys(BASE.campos).forEach(function (c) { ruta(BASE.campos[c].de); });
      BASE.relacionados.forEach(function (r) { Object.keys(r.campos || {}).forEach(function (c) { ruta(r.campos[c].de); }); });
      if (BASE.resumen) BASE.resumen.cifras.forEach(function (x) { if (tablas.indexOf(x.tabla) < 0) tablas.push(x.tabla); });
      // T0652: las del resumen de con quién es cada fila (la marca, sus necesidades, sus personas).
      if (BASE.contexto) Object.keys(BASE.contexto.de).forEach(function (c) {
        var d = BASE.contexto.de[c];
        [d.tabla].concat(d.lineas.map(function (l) { return l && l.tabla; })).forEach(function (t) { if (t && tablas.indexOf(t) < 0) tablas.push(t); });
      });
      function filas(t) { return T.filas(t) || []; }
      function filaDe(t, id) { return T.fila ? T.fila(t, id) : null; }
      var D = { filas: filas, fila: filaDe };
      /** Lo personalizado: de la tabla PREFERENCIAS (para todos) o, sin ella, del dispositivo. */
      function prefDe(clave) {
        var f = PREF ? filaDe(PREF, clave) : null;
        return json(f ? f.VALOR : guardado('li_pref_' + clave));
      }
      function ap() { var a = enriquecer(aplicar(BASE, prefDe(ctx.id)), D); return MIAS ? conEquipo(a, MIAS.campo, EQ) : a; }
      /** T0689 · La etiqueta de para quién es una fila que no es mía, en «Todas» («Alejandro»); la de nadie, de quien administra. */
      function etPara(f) {
        if (!MIAS || S.mias !== 'todas' || esMia(MIAS, f, YO)) return '';
        var v = String((f.__crudo || f)[MIAS.campo] || '').trim(), adm = EQ.filter(function (p) { return p.admin; })[0];
        var n = v ? nombrePara(EQ, v) : adm ? nombrePara(EQ, adm.correo) : '';
        return n ? ' <span class="li-para">' + texto(n) + '</span>' : '';
      }
      /** Las filas como se ven (nombres en vez de códigos, rutas, «de»); cada una con la de verdad en __crudo. */
      function vistas(a) { return preparar(a, filas(a.tabla), D, VAL); }
      function filaVista(a, id) { return vistas(a).filter(function (f) { return String(f[a.clave]) === String(id); })[0] || null; }
      function vistaActual(a) { var vs = vistasDe(a); return vs.filter(function (v) { return v.id === S.vista; })[0] || vs[0]; }
      var VAL = {};
      var errores = null, pintado = '';

      /* ---------- T0692 · ventas (de Pedidos) ---------- */
      var VENTAS = cfg.VENTAS && cfg.VENTAS.seccion ? cfg.VENTAS : null, venSec = VENTAS ? String(VENTAS.seccion).toUpperCase() : '';
      /** «Sus ventas» de una fila (vacío si no tiene; «Mirando…» mientras no han llegado). */
      function htmlVentasDe(crudo, hoy) {
        return htmlVentas(D.ventas ? D.ventas[String(crudo[BASE.clave])] || null : undefined, { titulo: VENTAS.titulo, seccion: venSec, va: veo[venSec], max: VENTAS.max, hoy: hoy });
      }
      /** Las ventas de cada fila, de su sección (sin abrirla). Al llegar, la lista (Última venta) y la ficha abierta las enseñan. */
      function leerVentas() {
        if (!VENTAS || !window.UN.seccion) return;
        window.UN.seccion(venSec).then(function (s) {
          return s && s.def && typeof s.def.ventasDe === 'function' ? s.def.ventasDe(T, s.config, VENTAS.campo) : null;
        }).then(function (o) { ponerVentas(o || {}); }, function () { ponerVentas({}); });
      }
      function ponerVentas(o) {
        D.ventas = o;
        if (!ctx.abierta()) return;
        pintar();
        var sv = vent.querySelector('#li-ventas'), f = abierta && filaVista(ap(), abierta.id);
        if (sv && f) sv.innerHTML = htmlVentasDe(f.__crudo || {}, hoyIso());
      }

      /* ---------- pintar ---------- */
      function celda(a, c, f, conEnlaces, cliente) {
        var cp = campo(a, c), t = verTexto(cp, f, VAL, PROHIB);
        if (c === a.codigo && t) return '<span class="li-cod">' + texto(t) + '</span>';
        if (t === '') return '<span class="li-nada">—</span>';
        // T0679: en la lista, lo de siempre («Tarea», «Pendiente») no se repite en cada fila: solo sale lo que es distinto.
        if (!conEnlaces && cp.comun && lista(cp.comun).indexOf(t) >= 0) return '<span class="li-nada li-comun"></span>';
        var v = f[c];
        if (cp.calculo && cp.envio && t.indexOf('Falta') === 0) return cliente ? 'Precio a consultar' : '<span class="u-mal">' + texto(t) + '</span>';
        if (cp.signo) { var sv = calcular(cp.calculo, f, VAL); return '<span class="' + (sv > 0.00001 ? 'li-signo-mas' : (sv < -0.00001 ? 'li-signo-menos' : '')) + '">' + texto(t) + '</span>'; }
        if (conEnlaces && !cp.calculo && !prohibido(v, PROHIB).length) {
          if (cp.tipo === 'enlace' && /^https?:\/\//i.test(String(v))) return '<a class="li-enl" href="' + texto(v) + '" target="_blank" rel="noopener">' + ICONO_WEB + '<span>' + texto(webCorta(v)) + '</span></a>';
          if (cp.tipo === 'instagram' && instagramUrl(v)) return '<a class="li-enl" href="' + texto(instagramUrl(v)) + '" target="_blank" rel="noopener">' + ICONO_IG + '<span>' + texto(cuentaInstagram(v)) + '</span></a>';
          if (cp.tipo === 'email' && /@/.test(String(v))) return '<a class="li-enl" href="mailto:' + texto(v) + '">' + ICONO_MAIL + '<span>' + texto(v) + '</span></a>';
          if (cp.tipo === 'telefono' && esTelefono(v)) return '<a class="li-enl" href="tel:' + texto(telDe(v)) + '">' + ICONO_TEL + '<span>' + texto(v) + '</span></a>';
          if (cp.tipo === 'foto' && imagen(v)) return '<img class="li-foto" src="' + texto(imagen(v)) + '" alt="" referrerpolicy="no-referrer" data-li-foto>' +
            (/^https?:/i.test(String(v)) ? ' <a class="li-enl li-verfoto" href="' + texto(v) + '" target="_blank" rel="noopener">' + ICONO_FOTO + '<span>Ver foto</span></a>' : '');
        }
        if (cp.tipo === 'foto') return imagen(v) ? '<img class="li-mini" src="' + texto(imagen(v)) + '" alt="" referrerpolicy="no-referrer" data-li-foto>' : texto(t);
        if (cp.tipo === 'estado' || cp.colores) {
          var col = (cp.colores || {})[String(v)] || '';
          return '<span class="u-chip li-estado' + (col ? ' li-' + texto(col) : '') + '">' + texto(t) + '</span>';
        }
        // T0679: primero cuándo, en palabras («hace 9 días»); debajo, el día, pequeño («mar 10/11»).
        if (cp.tipo === 'fecha') { var hy = hoyIso(), cu = cuando(v, hy); return cu ? '<span class="li-cuando-1">' + texto(cu.charAt(0).toUpperCase() + cu.slice(1)) + '</span><span class="u-nota li-fecha-d">' + texto(fechaDia(v, hy)) + '</span>' : texto(t); }
        return texto(t);
      }
      /**
       * T0641 · Lo relacionado como tarjetas cortas (la comparativa de una marca): el título, una línea con lo que se decide
       * («Hoy 32,00 €/m (Yutes) · BOR-004 a 21,41 €/m · Ahorra 32 %»), lo de debajo (el estado) y, al tocar «Ver detalle», el
       * cara a cara (una fila por dato, una columna por lado; sin la fila si los dos están vacíos) y el resto de sus datos.
       */
      function tarjetas(r, otro, rs, max) {
        var tj = r.tarjeta, cmp = tj.comparar || {}, tits = cmp.titulos || [];
        var nada = function (t) { return t.indexOf('class="li-nada"') >= 0; };
        return '<ul class="li-rt">' + rs.map(function (x, i) {
          var trozos = function (cs, cls) {
            var p = (cs || []).map(function (c) { var t = celda(otro, c, x, false); return nada(t) ? '' : '<span>' + t + '</span>'; }).join('');
            return p ? '<div class="' + cls + '">' + p + '</div>' : '';
          };
          var cara = (cmp.filas || []).map(function (fl) {
            var vs = (fl.campos || []).map(function (c) { return celda(otro, c, x, false); });
            return vs.every(nada) ? '' : '<span class="u-etiqueta">' + texto(fl.titulo || '') + '</span>' + vs.map(function (v) { return '<span>' + v + '</span>'; }).join('');
          }).join('');
          if (cara) cara = '<div class="li-cara" style="grid-template-columns:auto' + new Array(tits.length + 1).join(' 1fr') + '"><span></span>' +
            tits.map(function (t) { return '<span class="u-etiqueta li-cara-t">' + texto(t) + '</span>'; }).join('') + cara + '</div>';
          var det = (tj.detalle || []).map(function (c) {
            var cp = campo(otro, c), t = celda(otro, c, x, true);
            return nada(t) ? '' : '<div class="li-dato' + (cp.tipo === 'nota' ? ' u-ancho' : '') + '"><span class="u-etiqueta">' + texto(cp.titulo) + '</span><span class="li-valor">' + t + '</span></div>';
          }).join('');
          var mas = cara || det ? '<details class="li-rt-mas"><summary>' + texto(tj.verMas || 'Ver detalle') + '</summary>' + cara + (det ? '<div class="u-campos">' + det + '</div>' : '') + '</details>' : '';
          return '<li class="li-rt-f"' + (max && i >= max ? ' hidden data-resto' : '') + '><div class="li-rt-t">' + celda(otro, tj.titulo || otro.nombre, x, false) + '</div>' + trozos(tj.linea, 'li-rt-l') + trozos(tj.debajo, 'li-rt-d') + mas + '</li>';
        }).join('') + '</ul>';
      }
      /** El nombre de una fila con su código delante (el de la tarea, para trabajarla en Claude). */
      function titulo2(a, f, cli, conCodigo) {
        // T0642: el código (S-0002, M-001) solo en la ficha, para trabajar esa fila en Claude; en la lista no dice nada a quien la usa (se sigue buscando por él).
        var cod = conCodigo && a.codigo && a.codigo !== a.nombre && !vacio(f[a.codigo]) ? '<span class="li-cod">' + texto(f[a.codigo]) + '</span> ' : '';
        return cod + celda(a, a.nombre, f, false, cli) + (conCodigo ? '' : etPara(f));
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
        if (MIAS && S.mias === 'mias') todas = todas.filter(function (f) { return esMia(MIAS, f, YO); }); // T0689
        S.vista = vista.id;
        var html = '';
        if (errores.length) html += '<div class="u-bloque li-errores"><strong>La configuración de esta sección tiene cosas que no cuadran (solo lo ve quien administra):</strong><ul>' + errores.map(function (e) { return '<li>' + texto(e) + '</li>'; }).join('') + '</ul></div>';
        var vs = vistasDe(a);
        html += '<div class="li-arriba">' + (vs.length > 1 ? '<div class="u-pestanas li-vistas" role="tablist" aria-label="Vistas">' + vs.map(function (v) {
          return '<button type="button" role="tab" data-vista="' + texto(v.id) + '" aria-selected="' + (v.id === vista.id) + '">' + texto(v.titulo) + (v.cliente ? ' <span class="li-cli">para clientes</span>' : '') + '</button>';
        }).join('') + '</div>' : '<div class="li-vistas"></div>');
        // T0644: Personalizar va al Perfil; lo que es la vista, a mano en el ordenador y tras «i» en el móvil.
        var ayuda = textoDe(a, vista);
        html += '<span class="u-nota li-cuenta">@@CUENTA@@</span>';
        if (ayuda) html += '<button type="button" class="u-btn u-btn-icono li-qes" data-qes aria-expanded="' + !!S.qes + '" aria-controls="li-texto" aria-label="Qué es esta vista">' + ICONO_INFO + '</button>';
        html += '</div>';
        if (ayuda) html += '<p class="u-nota li-texto' + (S.qes ? ' li-abierto' : '') + '" id="li-texto">' + texto(ayuda) + '</p>';
        // T0708: el resumen de todo lo que hay (no solo lo de la vista): «203 telas · 39 diseños», con su frase.
        var cifras = vista.cliente ? [] : cifrasResumen(a, D);
        if (cifras.length) html += '<div class="li-resumen" role="group" aria-label="Resumen">' + cifras.map(function (x) {
          return '<span class="li-cifra"><b>' + texto(num(x.n, 0)) + '</b> ' + texto(x.nombre) + '</span>';
        }).join('') + (a.resumen.texto ? '<span class="li-resumen-t">' + texto(a.resumen.texto) + '</span>' : '') + '</div>';
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
        // T0690: el orden puesto tocando el título de una columna, el de esta vista en este dispositivo (si la columna sigue).
        S.orden = guardado(K + 'orden_' + vista.id);
        if (S.orden && columnasDe(a, vista).indexOf(S.orden.replace(/^-/, '')) < 0) S.orden = '';
        // Buscando, filtrando o con un aviso elegido no se pliega nada: lo que sale es lo que se busca.
        S.todo = !!(S.q || nf || S.aviso);
        var fs = filtrar(a, vista, todas, { hoy: hoy, q: S.q, aviso: S.aviso, filtros: S.filtros, valores: VAL, orden: S.orden });
        html = html.replace('@@CUENTA@@', texto(cuenta(a, vista, fs.length, deVista.length)));
        html += '<div class="li-barra">' + (MIAS ? '<div class="li-mias" role="group" aria-label="De quién">' + [['mias', 'Mías'], ['todas', 'Todas']].map(function (o) {
          return '<button type="button" data-mias="' + o[0] + '" aria-pressed="' + (S.mias === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' : '') + '<div class="li-buscar"><label class="u-oculto" for="li-q">Buscar</label><input id="li-q" type="search" placeholder="Buscar en ' + texto((a.titulo || '').toLowerCase()) + '" value="' + texto(S.q) + '" autocomplete="off"></div>' +
          (disp.length ? '<button type="button" class="u-btn li-filtrar" data-filtrar aria-haspopup="dialog"' + (nf ? ' aria-pressed="true"' : '') + '>' + ICONO_FILTRO + '<span class="li-bt">Filtrar</span>' + (nf ? ' <span class="li-nf" aria-label="' + nf + (nf === 1 ? ' puesto' : ' puestos') + '">' + nf + '</span>' : '') + '</button>' : '') +
          (a.crear && editables(a).length && !vista.cliente ? '<button type="button" class="u-btn u-btn-accion li-nueva" data-nueva aria-label="Añadir">' + ICONO_MAS + '<span class="li-bt">Añadir</span></button>' : '') + '</div>';
        // T0679: el primer filtro de pocas opciones (hasta 5), a la vista sobre la lista: «Todas» y cada opción, en pastillas.
        var rap = disp.filter(function (d) { return d.tipo === 'lista' && d.opciones.length >= 2 && d.opciones.length <= 5; })[0];
        if (rap) {
          var xr = S.filtros[rap.campo] || {};
          html += '<div class="li-rapido" role="group" aria-label="' + texto(rap.titulo) + '"><span class="li-rapido-t">' + texto(rap.titulo) + '</span>' +
            '<button type="button" class="li-fop" data-rapido="' + texto(rap.campo) + '" data-v="" aria-pressed="' + (!xr.es && !xr.vacio) + '">Todos</button>' + rap.opciones.map(function (o) {
              return '<button type="button" class="li-fop" data-rapido="' + texto(rap.campo) + '" data-v="' + texto(o) + '" aria-pressed="' + (xr.es !== undefined && norm(xr.es) === norm(o)) + '">' + texto(mostrar(rap.cp, o)) + '</button>';
            }).join('') + '</div>';
        }
        // Los filtros puestos, a la vista: cada uno se quita con su ✕, o todos a la vez. El del filtro rápido ya se ve en sus
        // pastillas (li-fchip-rap, escondido); T0691: en el móvil, con cuatro opciones o más las pastillas no salen y sí él.
        if (nf) html += '<div class="li-filtros" role="group" aria-label="Filtros puestos">' + disp.filter(function (d) { return S.filtros[d.campo]; }).map(function (d) {
          var t = textoFiltro(d, S.filtros[d.campo]);
          return '<button type="button" class="li-fchip' + (rap && d.campo === rap.campo ? ' li-fchip-rap' : '') + '" data-quitar="' + texto(d.campo) + '" aria-label="Quitar el filtro ' + texto(t) + '">' + texto(t) + ICONO_X + '</button>';
        }).join('') + '<button type="button" class="u-btn u-btn-texto li-fquitar" data-quitar="">Quitar filtros</button></div>';
        if (avs.length) html += '<div class="li-avisos" role="group" aria-label="Avisos">' + avs.map(function (x) {
          return '<button type="button" class="li-av li-' + texto(x.a.nivel || 'medio') + '" data-aviso="' + texto(x.a.id) + '" aria-pressed="' + (S.aviso === x.a.id) + '"><b>' + x.n + '</b> ' + texto(x.a.titulo) + '</button>';
        }).join('') + (S.aviso ? '<button type="button" class="u-btn u-btn-texto" data-aviso="">Ver todas</button>' : '') + '</div>';
        if (!todas.length) html += '<p class="u-vacio">' + texto(a.vacio || 'Todavía no hay nada en ' + (a.titulo || '').toLowerCase() + '.') + '</p>';
        else if (!fs.length) html += '<p class="u-vacio">' + (S.q ? 'Nada con «' + texto(S.q) + '»' + (nf ? ' y estos filtros.' : '.') : (nf ? 'Nada con estos filtros.' : 'Nada en esta vista.')) + '</p>';
        else if (vista.tablero) html += pintarTablero(a, vista, fs, hoy);
        else if (vista.galeria) html += pintarGaleria(a, vista, agrupar(a, vista, fs, hoy), hoy);
        else html += pintarGrupos(a, vista, agrupar(a, vista, fs, hoy), hoy);
        if (vista.tablero || !conRapidas(a, vista)) S.menu = '';
        html += menuPasar(hoy);
        if (S.ctx) pintarCtx(); // T0652: el resumen abierto, con lo nuevo
        // Si no ha cambiado nada (un refresco por detrás con lo mismo), no se rehace: un toque a medias en una fila no se pierde.
        if (html === pintado) return;
        pintado = html;
        var foco = document.activeElement && document.activeElement.id === 'li-q' ? document.activeElement.selectionStart : null;
        cont.innerHTML = html;
        if (abierta && velo.classList.contains('li-v-ficha')) marcarAbierta(abierta.id); // T0679: la fila de la ficha abierta, marcada
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
      /** El nombre de una fila para un aviso: su texto, cortado (T0677: no su código, que no dice nada a quien la usa). */
      function quien(a, f) { return nombreCorto(a, f, PROHIB); }
      /** T0677 · Guarda un cambio de la fila id y da cómo deshacerlo: el deshacer espera al cambio y falla si falla. */
      function cambioDeshacible(a, id, cambios, antes) {
        var c = deshacerEnOrden(function () { return T.actualizar(a.tabla, id, cambios); }, function () { return T.actualizar(a.tabla, id, antes); });
        c.hecho.then(null, mal('guardado'));
        return c.deshacer;
      }
      /** Deshace y lo dice: «Deshecho.» solo si de verdad se ha deshecho. */
      function deshacerYDecir(d) {
        return Promise.resolve().then(d).then(function () { ctx.aviso('Deshecho.'); }, mal('deshecho'));
      }
      function marcarHecha(id) {
        var a = ap(), r = a.rapidas, f = filaVista(a, id);
        if (!f || !r || !r.hecha) return;
        var crudo = f.__crudo || f, c = r.hecha.campo, antes = {}, cambios = {};
        antes[c] = vacio(crudo[c]) ? '' : crudo[c];
        cambios[c] = codigoDe(a, c, r.hecha.valor);
        var volver = cambioDeshacible(a, id, cambios, antes);
        var con = siguienteCon(a, crudo);
        if (con) { sinDeshacer(); siguientePaso(a, f, con, volver); }
        else deshacible(r.hecha.valor + ': ' + quien(a, f), volver);
      }
      function pasar(id, fecha) {
        var a = ap(), c = a.rapidas && a.rapidas.pasar, f = filaVista(a, id);
        if (!f || !c || !fecha) return;
        var crudo = f.__crudo || f, antes = {}, cambios = {};
        antes[c] = vacio(crudo[c]) ? '' : crudo[c]; cambios[c] = fecha;
        deshacible(quien(a, f) + ' pasa al ' + diaCorto(fecha), cambioDeshacible(a, id, cambios, antes));
      }
      /** «Otro día…»: una ventana con el calendario. */
      function pasarOtroDia(id) {
        var a = ap(), f = filaVista(a, id); if (!f) return;
        abrirVentana('<div class="li-ficha-cab"><h2 id="li-vt">Mover a otro día</h2><button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Cerrar">' + ICONO_X + '</button></div>' +
          '<p class="u-nota">' + texto(quien(a, f)) + '</p><form id="li-fotro" class="li-form" novalidate><div class="u-campo"><label class="u-etiqueta" for="li-otro">Día</label>' +
          '<input id="li-otro" type="date" value="' + texto(masDias(hoyIso(), 1)) + '"></div><div class="n-botones"><button type="submit" class="u-btn u-btn-accion">Mover</button></div></form>', true);
        vent.querySelector('#li-fotro').addEventListener('submit', function (ev) {
          ev.preventDefault();
          var v = vent.querySelector('#li-otro').value; if (!v) return;
          cerrarVentana(); pasar(id, v);
        });
      }
      /** Al cerrar una fila que es con alguien (una marca, un proveedor): ¿cuál es el siguiente paso con él? La ✕, tocar fuera
       *  o Esc vuelven atrás (la fila sigue sin cerrar); «No hay siguiente paso» la deja cerrada sin apuntar nada. */
      /** T0679 · Al cerrar una tarea, lo que hace falta para decidir el siguiente paso: la tarea entera, con quién y para cuándo
       *  era, y lo que ya hay pendiente con ellos (para no apuntar dos veces lo mismo). */
      function ctxSiguiente(a, f, con) {
        var crudo = f.__crudo || f, fc = a.rapidas && a.rapidas.pasar, dia = fc && !vacio(crudo[fc]) ? fechaDia(crudo[fc], hoyIso()) : '';
        var h = '<div class="li-sig-ctx"><p class="li-sig-t">' + texto(verTexto(campo(a, a.nombre), f, VAL, PROHIB) || quien(a, f)) + '</p>' +
          '<p class="u-nota">' + [f[con] ? 'Con ' + texto(f[con]) : '', dia ? 'era para el ' + texto(dia) : ''].filter(String).join(' · ') + '</p>';
        var rc = null;
        try { rc = a.contexto ? resumenDe(a, D, crudo, vistas(a), { hoy: hoyIso(), prohib: PROHIB, sin: f[a.clave] }) : null; } catch (e) { rc = null; }
        if (rc && rc.pendientes && rc.pendientes.length) h += '<p class="u-etiqueta li-sig-pt">Ya tienes pendiente con ' + texto(rc.nombre || f[con] || '') + '</p><ul class="li-sig-pend">' + rc.pendientes.slice(0, 3).map(function (e) {
          return '<li>' + texto(e.titulo) + (e.cuando ? ' <small class="' + (e.tarde ? 'li-ctx-tarde' : '') + '">' + texto(e.cuando) + '</small>' : '') + '</li>';
        }).join('') + '</ul>';
        return h + '</div>';
      }
      function siguientePaso(a, f, con, volver) {
        var hoy = hoyIso(), fs = fechasSiguiente(hoy), crudo = f.__crudo || f;
        // Viene marcado «En 3 días»; si cae en fin de semana, el primer día de trabajo.
        var d3 = aFecha(fs[1].fecha).getDay(), marcado = d3 === 0 || d3 === 6 ? 0 : 1;
        var h = '<div class="li-ficha-cab"><p class="li-sig-ok">' + ICONO_OK + texto(a.rapidas.hecha.valor) + ': ' + texto(quien(a, f)) + '</p>' +
          '<button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Volver sin cerrarla" title="Volver sin cerrarla">' + ICONO_X + '</button></div>' +
          ctxSiguiente(a, f, con) +
          '<h2 id="li-vt">¿Cuál es el próximo paso con ' + texto(f[con] || '') + '?</h2>' +
          '<form id="li-fsig" class="li-form" novalidate><div class="u-campo u-ancho"><label class="u-etiqueta" for="li-sig">Próximo paso</label>' +
          '<input id="li-sig" type="text" autocomplete="off" aria-describedby="li-sig-err"></div>' +
          (a.rapidas.pasar ? '<fieldset class="u-campo li-dias"><legend class="u-etiqueta">Cuándo</legend><div>' + fs.map(function (o, i) {
            return '<button type="button" class="li-dia" data-dia="' + o.fecha + '" aria-pressed="' + (i === marcado) + '">' + texto(o.titulo) + ' <small>' + texto(diaCorto(o.fecha)) + '</small></button>';
          }).join('') + '</div></fieldset>' : '') +
          '<p class="u-error" id="li-sig-err" role="alert" hidden></p>' +
          '<div class="n-botones"><button type="submit" class="u-btn u-btn-accion">Guardar próximo paso</button><button type="button" class="u-btn u-btn-texto" data-sig-no>No hay próximo paso</button></div>' +
          '<p class="u-nota">¿Te has equivocado? Cierra esta ventana y la tarea seguirá pendiente.</p></form>';
        abrirVentana(h, true);
        // Volver atrás (la ✕, fuera o Esc): sin «Deshecho», pero con su aviso si falla (T0677).
        alCerrar = function () { return Promise.resolve().then(volver).then(null, mal('deshecho')); };
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
          if (!t) { err.textContent = 'Escribe el próximo paso, o pulsa «No hay próximo paso».'; err.hidden = false; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
          if (p.length) { err.textContent = textoProhibido(p); err.hidden = false; inp.setAttribute('aria-invalid', 'true'); return; }
          var d = form.querySelector('[data-dia][aria-pressed="true"]');
          alCerrar = null; cerrarVentana();
          Promise.resolve(T.crear(a.tabla, filaSiguiente(a, crudo, t, d ? d.getAttribute('data-dia') : ''))).then(function () {
            ctx.aviso('Guardado el próximo paso con ' + (f[con] || '') + '.');
          }, mal('guardado el próximo paso'));
        });
      }
      /** T0643 · Si la sección cierra y pasa en un toque en esta vista (no en la de clientes; su columna se edita). */
      function conRapidas(a, vista) {
        var r = a.rapidas, ed = editables(a);
        return !!r && !vista.cliente && ((r.hecha && ed.indexOf(r.hecha.campo) >= 0) || (r.pasar && ed.indexOf(r.pasar) >= 0));
      }
      function circulo(a, f) {
        var r = a.rapidas, id = f[a.clave], cod = quien(a, f); // T0677: lo que dice el lector de pantalla, el texto de la tarea
        if (!r.hecha || editables(a).indexOf(r.hecha.campo) < 0) return '';
        return '<button type="button" class="li-circ" data-hecha="' + texto(id) + '" aria-label="Marcar como ' + texto(String(r.hecha.valor).toLowerCase()) + ': ' + texto(cod) + '" title="Marcar como ' + texto(String(r.hecha.valor).toLowerCase()) + '">' + ICONO_OK + '</button>';
      }
      function botonPasar(a, f) {
        if (!a.rapidas.pasar || editables(a).indexOf(a.rapidas.pasar) < 0) return '';
        var id = String(f[a.clave]);
        return '<button type="button" class="u-btn li-pasar" data-pasar-menu="' + texto(id) + '" aria-haspopup="menu" aria-expanded="' + (S.menu === id) + '" aria-label="Mover a otro día: ' + texto(quien(a, f)) + '" title="Mover a otro día">' + ICONO_MOVER + '<span class="li-pasar-t" aria-hidden="true">Mover</span></button>';
      }
      /* ---------- T0652 · el resumen de con quién es una fila ---------- */
      /** El nombre de con quién es (h, ya pintado) como botón que abre su resumen; sin nadie de CONTEXTO.de, tal cual. */
      function botonCtx(a, f, h) {
        if (!contextoCol(a, f.__crudo) || h.indexOf('class="li-nada"') >= 0) return h;
        var n = h.replace(/<[^>]*>/g, '');
        return '<button type="button" class="li-ctx-b" data-ctx="' + texto(f[a.clave]) + '" aria-haspopup="dialog" aria-expanded="' + (S.ctx === String(f[a.clave])) + '" title="Lo último con ' + texto(n) + '">' + h + '<span aria-hidden="true"> ›</span></button>';
      }
      function resumenFila(a, id, sin) {
        var f = filaVista(a, id);
        return f ? resumenDe(a, D, f.__crudo, vistas(a), { hoy: hoyIso(), prohib: PROHIB, sin: sin }) : null;
      }
      /** El resumen en HTML: en el panel (con su cabecera y la ✕) o dentro de la ficha. */
      function htmlResumen(r, enFicha) {
        var ev = function (e, hecha) {
          return '<li><button type="button" class="li-ctx-ev" data-ctx-fila="' + texto(e.id) + '"><span class="li-ctx-f">' + texto(e.fecha || 'Sin fecha') + '</span><span class="li-ctx-q">' +
            (hecha ? '<span class="li-ctx-ok" aria-hidden="true">' + ICONO_OK + '</span>' : '') + texto(e.titulo) +
            (!hecha && e.cuando ? '<small class="' + (e.tarde ? 'li-ctx-tarde' : '') + '">' + texto(e.cuando) + '</small>' : '') +
            (e.nota ? '<small>' + texto(e.nota) + '</small>' : '') + '</span></button></li>';
        };
        var sec = r.seccion ? String(r.seccion).toUpperCase() : '', va = sec && veo[sec];
        var h = enFicha ? '<h3 class="li-fg-t">Con ' + texto(r.nombre) + '</h3>' + (r.sub ? '<p class="li-ctx-sub">' + texto(r.sub) + '</p>' : '')
          : '<div class="li-ctx-cab"><div><h2 id="li-ctx-t" tabindex="-1">' + texto(r.nombre) + '</h2>' + (r.sub ? '<p class="li-ctx-sub">' + texto(r.sub) + '</p>' : '') + '</div>' +
            '<button type="button" class="u-btn u-btn-icono" data-ctx-cerrar aria-label="Cerrar">' + ICONO_X + '</button></div>';
        if (r.chips.length) h += '<p class="li-ctx-chips">' + r.chips.map(function (c) { return '<span class="u-chip">' + texto(c) + '</span>'; }).join('') + '</p>';
        if (r.nota) h += '<p class="li-ctx-nota">' + texto(r.nota) + '</p>';
        h += '<section class="li-ctx-bl"><h4 class="u-etiqueta">Lo último que hicimos</h4>' + (r.ultimas.length ? '<ul class="li-ctx-l">' + r.ultimas.map(function (e) { return ev(e, true); }).join('') + '</ul>' : '<p class="u-nota">Todavía no hay nada hecho con ellos.</p>') + '</section>';
        h += '<section class="li-ctx-bl"><h4 class="u-etiqueta">' + (enFicha ? 'Lo demás pendiente' : 'Lo que tenemos pendiente') + '</h4>' + (r.pendientes.length ? '<ul class="li-ctx-l">' + r.pendientes.map(function (e) { return ev(e, false); }).join('') + '</ul>' +
          (r.masPendientes ? '<p class="u-nota">Y ' + r.masPendientes + ' más.</p>' : '') : '<p class="u-nota">Nada ' + (enFicha ? 'más ' : '') + 'pendiente con ellos.</p>') + '</section>';
        r.lineas.forEach(function (l) { h += '<p class="li-ctx-lin"><span class="u-etiqueta">' + texto(l.titulo) + '</span> ' + texto(l.texto) + '</p>'; });
        if (va) h += '<p><a class="u-btn li-ctx-ir" href="?s=' + encodeURIComponent(sec.toLowerCase()) + '&ficha=' + encodeURIComponent(r.id) + '" data-sx="' + texto(sec) + '">Abrir en ' + texto(va) + ' ›</a></p>';
        return enFicha ? '<section class="li-fgrupo li-ctx-ficha">' + h + '</section>' : h;
      }
      /** El panel: al lado en el ordenador, desde abajo en el móvil. Se pinta otra vez si cambian los datos. */
      function pintarCtx(foco) {
        var r = S.ctx ? resumenFila(ap(), S.ctx) : null;
        if (!r) { pCtx.hidden = true; pCtx.innerHTML = ''; pCtx._html = ''; S.ctx = ''; return; }
        var h = htmlResumen(r, false);
        if (h !== pCtx._html) { pCtx.innerHTML = h; pCtx._html = h; } // un refresco con lo mismo no le quita el foco
        pCtx.hidden = false;
        if (foco) { var t = pCtx.querySelector('#li-ctx-t'); if (t) t.focus(); }
      }
      function abrirCtx(id) { S.ctx = String(id); S.menu = ''; pintar(); pintarCtx(true); }
      function cerrarCtx(sinFoco) {
        if (!S.ctx) return;
        var id = S.ctx; S.ctx = ''; pintarCtx(); pintar();
        if (sinFoco) return;
        var b = [].filter.call(cont.querySelectorAll('[data-ctx]'), function (x) { return x.getAttribute('data-ctx') === id && x.offsetParent; })[0];
        if (b) b.focus();
      }
      /** El menú de «Pasar», fuera de la tabla (no lo corta su desplazamiento); se coloca junto a su botón al pintar. */
      function menuPasar(hoy) {
        if (!S.menu) return '';
        return '<div class="li-menu" role="menu" aria-label="Mover a otro día"><p class="li-menu-t" aria-hidden="true">Mover a…</p>' + opcionesPasar(hoy).map(function (o) {
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
      function tarjeta(a, f, det, cli, hoy, arrastrar, tituloGrupo, foto, plazo, rap) {
        var avs = cli ? [] : avisosDe(a, f, hoy), mar = sinRepetir(avs, tituloGrupo, plazo);
        // T0652: con quién es, debajo de la tarjeta y aparte, para abrir su resumen (en el tablero, no: ahí se arrastra).
        var cx = !cli && !arrastrar && a.contexto && contextoCol(a, f.__crudo) ? a.contexto.campo : '';
        if (cx) det = det.filter(function (x) { return x !== cx; });
        // T0601: en la tarjeta, lo vacío no sale (una prospección sin estado ni nota no enseña «— —»).
        var dets = det.filter(function (x) { return x !== foto; }).map(function (x) { return fechaAviso(a, x, celda(a, x, f, false, cli), avs); }).filter(function (h) { return h.indexOf('class="li-nada"') < 0; })
          // T0677: lo que ya dice un aviso de la tarjeta no sale dos veces («Esperando respuesta» y «Esperando respuesta hace días»).
          .filter(function (h) { return !loDiceUnAviso(h.replace(/<[^>]*>/g, ''), mar); });
        // T0633: con foto, a la izquierda (sin foto, un hueco igual, para que los nombres caigan en línea).
        var src = foto && !prohibido(f[foto], PROHIB).length ? imagen(f[foto]) : '';
        var img = !foto ? '' : (src ? '<img class="li-mini li-t-img" src="' + texto(src) + '" alt="" referrerpolicy="no-referrer" loading="lazy" data-li-foto>' : '<span class="li-t-img li-t-vacia" aria-hidden="true"></span>');
        var cuerpo = '<strong>' + titulo2(a, f, cli) + '</strong>' +
          (dets.length ? '<span class="li-det">' + dets.map(function (h) { return '<span>' + h + '</span>'; }).join('') + '</span>' : '') +
          (mar.length ? '<span class="li-marcas">' + marcas(mar) + '</span>' : '');
        // T0643: con lo de un toque, el círculo a la izquierda y «Pasar» a la derecha, encima de la tarjeta (no dentro: un botón no va dentro de otro).
        var r = rap && rapidaEn(a, f, hoy), ci = r ? circulo(a, f) : '', pa = r ? botonPasar(a, f) : '';
        var bc = cx ? botonCtx(a, f, celda(a, cx, f, false, cli)) : '';
        return '<li' + (ci || pa || bc ? ' class="li-t-rap' + (ci ? ' li-t-ci' : '') + (pa ? ' li-t-pa' : '') + (bc ? ' li-t-ctx' : '') + '"' : '') + '>' + ci + '<button type="button" class="li-tarjeta' + (foto ? ' li-con-foto' : '') + (avs.length ? ' li-f-' + texto(avs[0].nivel || 'medio') : '') + '" data-id="' + texto(f[a.clave]) + '"' + (arrastrar ? ' data-mover' : '') + '>' +
          (foto ? img + '<span class="li-t-txt">' + cuerpo + '</span>' : cuerpo) + '</button>' + pa + bc + '</li>';
      }
      /** T0610 · Los grupos de una vista. En el ordenador, UNA tabla: la cabecera una vez y cada grupo como una fila con su
       *  título, así las columnas caen igual en todos y se ajustan a lo que llevan. En el móvil, una lista de tarjetas por grupo. */
      function pintarGrupos(a, vista, gs, hoy) {
        // En una vista para clientes no salen los avisos (son para quien trabaja) y un precio que falta es «a consultar».
        var cli = !!vista.cliente, fuera = ocultas(a, vista), nom = a.nombre;
        var plazo = vista.agrupar && vista.agrupar.por === 'plazo' ? vista.agrupar.campo : '';
        // La columna por la que se agrupa ya la dice el título de cada grupo: no se repite en cada fila (salvo que sea el nombre).
        var delGrupo = columnaDelGrupo(vista);
        if (delGrupo && delGrupo !== nom && gs.length > 1) fuera = fuera.concat([delGrupo]);
        var cols = columnasDe(a, vista).filter(function (c) { return fuera.indexOf(c) < 0 && c !== a.codigo; });
        // En la tabla, el código va en su columna, la primera (en las tarjetas, delante del nombre).
        var conCod = cols; // T0642: sin la columna del código
        var det = (a.detalle.length ? a.detalle : cols.filter(function (c) { return c !== nom; }).slice(0, 2)).filter(function (c) { return fuera.indexOf(c) < 0 && c !== nom && (!cli || cols.indexOf(c) >= 0); });
        var num = function (cp) { return /importe|numero|porcentaje/.test(cp.tipo); };
        var cabG = function (g) { return '<h2 class="n-grupo">' + texto(g.titulo) + ' <span class="u-cifra">' + g.filas.length + '</span></h2>'; };
        // T0643: el círculo, delante del código; «Pasar», al final. Solo si alguna fila de la vista los lleva.
        var rap = conRapidas(a, vista), conCi = rap && !!a.rapidas.hecha, conPa = rap && !!a.rapidas.pasar;
        if (rap && !gs.some(function (g) { return g.filas.some(function (f) { return rapidaEn(a, f, hoy); }); })) conCi = conPa = false;
        var nCols = conCod.length + (conCi ? 1 : 0) + (conPa ? 1 : 0);
        // T0690: cada grupo, en trozos: lo pendiente (50 y «Ver más»), lo hecho plegado (50 y «Ver más») y lo de antes.
        var trozos = gs.map(function (g) { return trozosDe(vista, g, hoy); });
        var fila = function (f, g) {
          var avs = cli ? [] : avisosDe(a, f, hoy), mar = sinRepetir(avs, g.titulo, plazo), r = (conCi || conPa) && rapidaEn(a, f, hoy);
          // T0677: en la tabla, el estado tiene su columna: el aviso que solo lo repite («Esperando respuesta hace días») no sale
          // (la fecha ya va en rojo con «hace 9 días»). En la tarjeta del móvil es al revés: se queda el aviso y se quita la etiqueta.
          var vistos = conCod.filter(function (c) { return c !== nom; }).map(function (c) { return verTexto(campo(a, c), f, VAL, PROHIB); });
          mar = mar.filter(function (x) { return !vistos.some(function (t) { return loDiceUnAviso(t, [x]); }); });
          return '<tr tabindex="0" data-id="' + texto(f[a.clave]) + '"' + (avs.length ? ' class="li-con-aviso li-f-' + texto(avs[0].nivel || 'medio') + '"' : '') + '>' +
            (conCi ? '<td class="li-td-ci">' + (r ? circulo(a, f) : '') + '</td>' : '') + conCod.map(function (c) {
            var cp = campo(a, c), principal = c === nom;
            // Fechas, cifras, estados y lo corto no se parten («273 / g/m²», «hace 9 / días»): lo que se estrecha es el texto largo.
            var h = fechaAviso(a, c, celda(a, c, f, false, cli), avs);
            if (!cli && a.contexto && c === a.contexto.campo) h = botonCtx(a, f, h);
            if (principal) h += etPara(f); // T0689: en «Todas», para quién es la que no es mía
            var corta = !principal && (num(cp) || /^(fecha|estado|sino)$/.test(cp.tipo) || h.replace(/<[^>]*>/g, '').length <= 14);
            return '<td class="' + (num(cp) ? 'num' : '') + (corta ? ' li-td-corta' : '') + (cp.tipo === 'fecha' ? ' li-td-fecha' : '') + (cp.tipo === 'estado' || cp.colores ? ' li-td-estado' : '') + (principal ? ' u-tabla-t' : '') + (c === a.codigo ? ' li-td-cod' : '') + '">' + h +
              (principal && mar.length ? '<div class="li-marcas">' + marcas(mar) + '</div>' : '') + '</td>';
          }).join('') + (conPa ? '<td class="li-td-pa">' + (r ? botonPasar(a, f) : '') + '</td>' : '') + '</tr>';
        };
        // T0690: el título de cada columna ordena al tocarlo (otra vez, al revés; a la tercera, el orden de la vista).
        var th = function (c) {
          var cp = campo(a, c), o = S.orden === c ? 'ascending' : (S.orden === '-' + c ? 'descending' : '');
          if (cp.tipo === 'foto') return '<th scope="col"><span class="u-oculto">' + texto(cp.titulo) + '</span></th>';
          return '<th scope="col"' + (num(cp) ? ' class="num"' : '') + (o ? ' aria-sort="' + o + '"' : '') + '><button type="button" class="li-ord' + (o ? ' li-ord-on' : '') + '" data-orden="' + texto(c) + '" title="Ordenar por ' + texto(cp.titulo.toLowerCase()) + '">' +
            texto(cp.titulo) + '<span class="li-ord-f" aria-hidden="true">' + (o === 'ascending' ? '↑' : (o === 'descending' ? '↓' : '↕')) + '</span></button></th>';
        };
        var filaMas = function (h) { return h ? '<tr class="li-mas-f"><td colspan="' + nCols + '">' + h + '</td></tr>' : ''; };
        var tabla = '<div class="u-solo-ancho li-tabla"><table class="u-tabla"><thead><tr>' + (conCi ? '<th scope="col" class="li-td-ci"><span class="u-oculto">' + texto(a.rapidas.hecha.valor) + '</span></th>' : '') + conCod.map(th).join('') +
          (conPa ? '<th scope="col" class="li-td-pa"><span class="u-oculto">Pasar a otro día</span></th>' : '') + '</tr></thead>' + gs.map(function (g, i) {
          var tz = trozos[i], filas = function (xs) { return xs.map(function (f) { return fila(f, g); }).join(''); };
          return '<tbody>' + (g.titulo ? '<tr class="li-g-cab' + (plazo && g.id === 'pasado' ? ' li-g-tarde' : '') + '"><th scope="colgroup" colspan="' + nCols + '">' + cabG(g) + '</th></tr>' : '') +
            filas(tz.abiertas) + filaMas(tz.masA) + filaMas(tz.plegar) + filas(tz.hechas) + filaMas(tz.masH) + filaMas(tz.antes) + '</tbody>';
        }).join('') + '</table></div>';
        var foto = fotoDeTarjeta(a, cols);
        var tarjetas = '<div class="u-solo-movil">' + gs.map(function (g, i) {
          var tz = trozos[i], lis = function (xs) { return xs.map(function (f) { return tarjeta(a, f, det, cli, hoy, false, g.titulo, foto, plazo, rap); }).join(''); };
          var li = function (h) { return h ? '<li class="li-mas-f">' + h + '</li>' : ''; };
          return '<section class="li-grupo' + (plazo && g.id === 'pasado' ? ' li-g-tarde' : '') + '">' + (g.titulo ? cabG(g) : '') + '<ul class="li-tarjetas">' +
            lis(tz.abiertas) + li(tz.masA) + li(tz.plegar) + lis(tz.hechas) + li(tz.masH) + li(tz.antes) + '</ul></section>';
        }).join('') + '</div>';
        return tabla + tarjetas;
      }
      /** T0690 · «Ver N más»: cuántas quedan y el botón que enseña otras tantas (data-mas con su clave en S.mas). */
      function botonMas(k, quedan, paso) {
        return '<button type="button" class="li-vermas" data-mas="' + texto(k) + '" data-paso="' + paso + '">Ver ' + (quedan > paso ? paso + ' más' : (quedan === 1 ? 'la que queda' : 'las ' + quedan + ' que quedan')) +
          (quedan > paso ? ' <span class="u-nota">· quedan ' + num(quedan) + '</span>' : '') + '</button>';
      }
      /** Las primeras de una lista (S.mas[k] o «paso») y su «Ver más». */
      function primeras(k, xs, paso) {
        var n = Math.min(xs.length, S.mas[k] || paso);
        return { filas: xs.slice(0, n), mas: xs.length > n ? botonMas(k, xs.length - n, paso) : '' };
      }
      /** Un grupo de la lista, en trozos: lo pendiente con su «Ver más», el botón de lo hecho plegado, lo hecho (si está
       *  abierto) con su «Ver más» y «Ver lo de antes». Buscando o filtrando, todo seguido (con su «Ver más»). */
      function trozosDe(vista, g, hoy) {
        var k = vista.id + '|' + (g.id || g.titulo || ''), p = vista.plegar || {};
        var pl = S.todo ? { abiertas: g.filas, hechas: [], antes: [] } : plegados(vista, g.filas, hoy);
        var a1 = primeras(k + '|a', pl.abiertas, POR_GRUPO), nh = pl.hechas.length + pl.antes.length, abre = !!S.abre[k];
        var r = { abiertas: a1.filas, masA: a1.mas, plegar: '', hechas: [], masH: '', antes: '' };
        if (!nh) return r;
        r.plegar = '<button type="button" class="li-plegar" data-plegar="' + texto(k) + '" aria-expanded="' + abre + '">' + ICONO_FLECHA +
          '<span>' + texto(p.titulo || 'Lo hecho') + '</span> <span class="u-cifra">' + num(nh) + '</span></button>';
        if (!abre) return r;
        var verAntes = !!S.antes[k] || !pl.hechas.length, xs = verAntes ? pl.hechas.concat(pl.antes) : pl.hechas, h1 = primeras(k + '|h', xs, POR_GRUPO);
        r.hechas = h1.filas; r.masH = h1.mas;
        if (!verAntes && pl.antes.length) r.antes = '<button type="button" class="li-vermas" data-antes="' + texto(k) + '">Ver lo de antes <span class="u-nota">· ' +
          (p.dias ? 'de hace más de ' + (p.dias % 30 === 0 ? (p.dias / 30) + ' meses' : p.dias + ' días') + ', ' : '') + num(pl.antes.length) + '</span></button>';
        return r;
      }
      /** T0691 · Muestrario: una cuadrícula de fotos grandes, cada una con su título, lo de debajo (el color) y su cifra (lo
       *  que cuesta). Sin foto, o con una que no se ve, un fondo neutro del mismo tamaño. Sin avisos: es para mirar y encontrar
       *  una tela por cómo es (los avisos siguen arriba, para filtrar). Con «agrupar», un título por grupo. */
      function pintarGaleria(a, vista, gs, hoy) {
        var cli = !!vista.cliente, gl = vista.galeria || {}, fuera = ocultas(a, vista);
        var vale = function (c) { return c && fuera.indexOf(c) < 0; };
        var foto = gl.foto || fotoDeTarjeta(a, columnasDe(a, vista)), tit = gl.titulo || a.nombre;
        var deb = lista(gl.debajo).filter(vale), cif = vale(gl.cifra) ? gl.cifra : '';
        var txt = function (c, f) { var h = celda(a, c, f, false, cli); return h.indexOf('class="li-nada') >= 0 ? '' : h; };
        var una = function (f) {
          var src = foto && !prohibido(f[foto], PROHIB).length ? imagen(f[foto]) : '';
          return '<li><button type="button" class="li-gal-t" data-id="' + texto(f[a.clave]) + '">' +
            '<span class="li-gal-foto">' + (src ? '<img class="li-gal-img" src="' + texto(src) + '" alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async" data-li-foto>' : '') + '</span>' +
            '<span class="li-gal-txt"><strong>' + txt(tit, f) + '</strong>' + deb.map(function (c) { var h = txt(c, f); return h ? '<span class="li-gal-d">' + h + '</span>' : ''; }).join('') +
            (cif ? (txt(cif, f) ? '<span class="li-gal-c">' + txt(cif, f) + '</span>' : (gl.sinCifra ? '<span class="li-gal-c li-gal-sin">' + texto(gl.sinCifra) + '</span>' : '')) : '') + '</span></button></li>';
        };
        // T0690: 48 por grupo (ocho filas de seis) y «Ver más».
        return '<div class="li-galerias">' + gs.map(function (g) {
          var p = primeras(vista.id + '|' + (g.id || g.titulo || '') + '|g', g.filas, gl.max || 48);
          return '<section class="li-gal-g">' + (g.titulo ? '<h2 class="n-grupo">' + texto(g.titulo) + ' <span class="u-cifra">' + g.filas.length + '</span></h2>' : '') +
            '<ul class="li-galeria">' + p.filas.map(una).join('') + '</ul>' + (p.mas ? '<div class="li-mas-f">' + p.mas + '</div>' : '') + '</section>';
        }).join('') + '</div>';
      }
      /** Tablero: una columna por valor, con sus tarjetas; se arrastra de una a otra si ese campo se edita (y no es para clientes). */
      function pintarTablero(a, vista, fs, hoy) {
        var cli = !!vista.cliente, fuera = ocultas(a, vista), c = vista.tablero.campo, nom = a.nombre;
        var mueve = !cli && editables(a).indexOf(c) >= 0;
        var cp = campo(a, c), cols = columnasTablero(a, vista, fs), junta = cols.some(function (x) { return x.junta; });
        // T0642: en un tablero con columnas que juntan varios valores (el embudo), cada tarjeta dice el suyo (su fase); se
        // cambia en la ficha (a una columna así no se arrastra: no se sabría cuál de sus valores poner).
        var det = (a.detalle.length ? a.detalle : columnasDe(a, vista)).filter(function (x) { return fuera.indexOf(x) < 0 && x !== nom && (x !== c || junta) && x !== a.codigo; }).slice(0, 3);
        if (junta) mueve = false;
        return '<div class="li-tablero" data-campo="' + texto(c) + '">' + cols.map(function (col) {
          var color = col.junta ? '' : (cp.colores || {})[col.id] || '';
          // T0690: como mucho 20 tarjetas por columna (tablero.max) y «Ver N más».
          var p = primeras(vista.id + '|' + (col.id || col.titulo) + '|c', col.filas, vista.tablero.max || POR_COLUMNA);
          return '<section class="li-col' + (color ? ' li-' + texto(color) : '') + '" data-valor="' + texto(col.id) + '"' + (mueve ? ' data-soltar' : '') + '>' +
            '<h2 class="li-col-t">' + texto(col.titulo) + ' <span class="u-cifra">' + col.filas.length + '</span></h2>' +
            (col.filas.length ? '<ul class="li-tarjetas li-col-l">' + p.filas.map(function (f) { return tarjeta(a, f, det, cli, hoy, mueve); }).join('') + (p.mas ? '<li class="li-mas-f">' + p.mas + '</li>' : '') + '</ul>' : '<p class="u-nota li-col-vacia">Nada todavía</p>') + '</section>';
        }).join('') + '</div>' + (mueve ? '<p class="u-nota li-col-ayuda">En el ordenador, arrastra una tarjeta a otra columna para cambiar su ' + texto(cp.titulo.toLowerCase()) + '. En el móvil, ábrela y cámbialo en su ficha.</p>' : '');
      }

      function pintarJuntar(a, r, f) {
        var rs = juntarDe(a, D, r, f, filas);
        if (!rs.length && r.siHay) return '';
        return '<section class="li-fgrupo"><h3 class="li-fg-t">' + texto(r.titulo || '') + ' <span class="u-cifra">' + rs.length + '</span></h3>' +
          (!rs.length ? '<p class="u-vacio">' + texto(r.vacio || 'Nada todavía.') + '</p>' : '<ul class="li-rel li-junta">' + rs.map(function (x) {
            return '<li><div class="li-rel-f"><span class="li-rel-n">' + texto(x.quien) + '</span>' +
              (x.estado ? '<span><span class="u-chip li-estado' + (x.color ? ' li-' + texto(x.color) : '') + '">' + texto(x.estado) + '</span></span>' : '') +
              (aFecha(x.cuando) ? '<span class="u-nota">' + texto(fechaCorta(x.cuando)) + '</span>' : '') + '</div></li>';
          }).join('') + '</ul>') + '</section>';
      }

      /* ---------- ficha ---------- */
      /** T0679 · En el ordenador, la ficha va a la derecha de la lista (vista partida): la lista sigue a la vista y otra fila
       *  abre su ficha sin cerrar nada; la fila abierta, marcada. Las demás ventanas (filtrar, pasar…) siguen encima de todo. */
      function partir(id) {
        var si = id !== undefined && id !== null;
        velo.classList.toggle('li-v-ficha', si);
        document.body.classList.toggle('li-partida', si);
        marcarAbierta(si ? id : null);
      }
      function marcarAbierta(id) {
        [].forEach.call(cont.querySelectorAll('tr[data-id],.li-gal-t[data-id]'), function (t) { t.classList.toggle('li-sel', id !== null && t.getAttribute('data-id') === String(id)); });
      }
      function abrirVentana(html, corta) {
        partir(null);
        velo.classList.toggle('li-v-corta', !!corta); // T0679: una ventana corta, en el móvil, sale desde abajo (no a pantalla completa)
        alCerrar = null; S.menu = '';
        vent.innerHTML = html;
        velo.classList.add('abierto');
        var h = vent.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      }
      var alCerrar = null; // T0643: lo que se hace si la ventana se cierra sin terminar (el siguiente paso: volver atrás)
      function cerrarVentana() {
        var al = alCerrar; alCerrar = null;
        if (al) al();
        velo.classList.remove('abierto'); vent.innerHTML = ''; partir(null);
        // Si se llegó con ?ficha=…, se quita de la dirección para que al volver no se abra otra vez.
        var us = new URLSearchParams(location.search);
        if (us.get('ficha') || us.get('nueva')) { var u = new URL(location.href); ['ficha', 'nueva'].concat(editables(BASE)).forEach(function (k) { u.searchParams.delete(k); }); history.replaceState(history.state, '', u.pathname + u.search + u.hash); }
      }
      /** Una fila nueva con lo que pone NUEVA (por el nombre en una columna que apunta a otra tabla; «hoy» en una fecha). */
      function nuevaFila(a) {
        var r = {};
        Object.keys(a.nueva || {}).forEach(function (c) {
          var v = a.nueva[c], cp = campo(a, c);
          if (v === 'hoy' && cp.tipo === 'fecha') v = hoyIso();
          r[c] = cp.ids && v in cp.ids ? cp.ids[v] : v;
        });
        if (MIAS && vacio(r[MIAS.campo])) r[MIAS.campo] = YO.correo; // T0689: una nueva es, de entrada, de quien la crea
        return r;
      }
      /** T0689: sin nadie más en el equipo, «Para quién» no se enseña ni se edita (todo es de quien entra). */
      function sinMias(c) { return !(BASE.mias && !MIAS && c === BASE.mias.campo); }
      function editables(a) {
        if (a.editar === true) {
          var t = [a.nombre].concat(a.columnas); a.ficha.forEach(function (g) { t = t.concat(g.campos || []); });
          return t.filter(function (c, i) { return c && t.indexOf(c) === i && c !== a.clave && c !== a.codigo && !campo(a, c).calculo && sinMias(c); });
        }
        return lista(a.editar).filter(function (c) { return !campo(a, c).calculo && sinMias(c); });
      }
      function entrada(a, c, f) {
        var cp = campo(a, c), v = f ? f[c] : '', id = 'li-c-' + c;
        var et = '<label class="u-etiqueta" for="' + id + '">' + texto(cp.titulo) + '</label>';
        if (cp.ids) {
          // Una columna que apunta a otra tabla: se elige por el nombre y se guarda el código.
          var ns = Object.keys(cp.ids);
          // T0679: un campo con colores (la fase, el estado) se elige en una pastilla de su color, no en un desplegable gris.
          var nv = ns.filter(function (n) { return String(cp.ids[n]) === String(v); })[0];
          var mp = {}; if (cp.colores) ns.forEach(function (n) { if (cp.colores[n]) mp[cp.ids[n]] = cp.colores[n]; });
          var pil = cp.colores ? ' class="li-sel-pil li-estado li-' + texto(cp.colores[nv] || 'gris') + '" data-pil="' + texto(JSON.stringify(mp)) + '"' : ' data-elegir="' + texto(c) + '"'; // T0684
          return '<div class="u-campo">' + et + '<select id="' + id + '"' + pil + ' data-c="' + texto(c) + '"><option value=""></option>' +
            ns.map(function (n) { return '<option value="' + texto(cp.ids[n]) + '"' + (String(v) === String(cp.ids[n]) ? ' selected' : '') + '>' + texto(mostrar(cp, n)) + '</option>'; }).join('') +
            (!vacio(v) && !ns.some(function (n) { return String(cp.ids[n]) === String(v); }) ? '<option value="' + texto(v) + '" selected>' + texto(v) + '</option>' : '') + '</select></div>';
        }
        if (cp.opciones) {
          var ops = cp.opciones.slice(); if (!vacio(v) && ops.indexOf(String(v)) < 0) ops.unshift(String(v));
          return '<div class="u-campo">' + et + '<select id="' + id + '"' + (cp.colores ? ' class="li-sel-pil li-estado li-' + texto(cp.colores[String(v)] || 'gris') + '" data-pil="' + texto(JSON.stringify(cp.colores)) + '"' : ' data-elegir="' + texto(c) + '"') + ' data-c="' + texto(c) + '"><option value=""></option>' +
            ops.map(function (o) { return '<option value="' + texto(o) + '"' + (String(v) === o ? ' selected' : '') + '>' + texto(mostrar(cp, o)) + '</option>'; }).join('') + '</select></div>';
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
      function ficha(id, nueva, puesto) {
        var a = ap(), vista = vistaActual(a), fuera = ocultas(a, vista), f = nueva ? {} : filaVista(a, id), hoy = hoyIso(), cli = !!vista.cliente;
        if (!f) { ctx.aviso('Esa fila ya no está.'); return; }
        var crudo = f.__crudo || {}; // lo que de verdad hay (los códigos), para editar
        if (nueva) crudo = Object.assign(nuevaFila(a), puesto || {}); // T0642: lo que trae «+ Nueva tarea» (su marca)
        abierta = nueva ? null : { id: id };
        var llegada = nueva ? !!(puesto && url.get('nueva')) : !!pedida && String(id) === String(pedida); // la ficha que trae la dirección
        var ed = cli ? [] : editables(a).filter(function (c) { return fuera.indexOf(c) < 0; });
        var grupos = a.ficha.length ? a.ficha : [{ titulo: '', campos: columnasDe(a, vista) }];
        var avs = nueva || cli ? [] : avisosDe(a, f, hoy);
        var tv = llegada ? textoVuelta(deFicha, ctx.desde) : ''; // T0642: a la ficha de la que vienes, si vienes de una
        var vuelta = tv ? '<button type="button" class="u-btn u-btn-texto li-volver" data-volver>' + texto(tv) + '</button>' : '';
        var h = vuelta + '<div class="li-ficha-cab"><h2 id="li-vt">' + (nueva ? texto(a.alta && a.alta.titulo ? a.alta.titulo : 'Añadir · ' + a.titulo) : titulo2(a, f, cli, true)) + '</h2>' +
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
            // T0641: un calculado con «desglose» lleva debajo sus cuentas (no para un cliente: enseñan el coste) y ocupa todo el ancho.
            var dg = cli ? '' : desglose(a, cp, f, VAL);
            return '<div class="li-dato' + (cp.tipo === 'nota' || cp.tipo === 'foto' || dg ? ' u-ancho' : '') + '"><span class="u-etiqueta">' + texto(cp.titulo) + '</span><span class="li-valor">' + celda(a, c, f, true, cli) + '</span>' +
              (dg ? '<span class="li-desglose">' + texto(dg) + '</span>' : '') +
              (cp.ayuda && !cli && !dg ? '<span class="u-nota">' + texto(cp.ayuda) + '</span>' : '') + '</div>';
          }).join('') + rp.vacios.filter(function (c) { return ed.indexOf(c) >= 0; }).map(function (c) {
            return entrada(a, c, crudo).replace(/^<div class="u-campo/, '<div hidden data-hueco="' + texto(c) + '" class="u-campo');
          }).join('');
          // T0642: en «Sin rellenar», solo lo que se puede rellenar aquí (lo demás, vacío, no sale: no se puede tocar).
          var aRellenar = rp.vacios.filter(function (c) { return ed.indexOf(c) >= 0; });
          var linea = aRellenar.length ? '<p class="li-vacios"><span class="u-etiqueta">Sin rellenar</span>' + aRellenar.map(function (c) {
            var t = texto(campo(a, c).titulo);
            return ed.indexOf(c) >= 0 ? '<button type="button" class="li-rellenar" data-rellenar="' + texto(c) + '" aria-label="Rellenar ' + t + '">' + t + '</button>' : '<span class="li-vacio">' + t + '</span>';
          }).join('') + '</p>' : '';
          // T0679: un apartado que solo trae la fase o el estado (un campo con colores que se edita) va arriba, sin tarjeta: su pastilla.
          if (titulo && rp.ver.length === 1 && !aRellenar.length && ed.indexOf(rp.ver[0]) >= 0 && campo(a, rp.ver[0]).colores) return '<section class="li-fgrupo li-f-pil">' + cuerpo + '</section>';
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
            return apartadoFicha(g.titulo, (g.campos || []).filter(function (c) { return fuera.indexOf(c) < 0 && sinMias(c) && c !== a.codigo && (nueva ? ed.indexOf(c) >= 0 : true) && (!cli || columnasDe(a, vista).indexOf(c) >= 0); }));
          }).join('');
          // Lo que se edita y no está en ningún apartado de la ficha, al final.
          // T0642: lo que cambia un botón de ACCIONES («Pasar a Clientes») no sale como campo.
          var deAccion = []; a.acciones.forEach(function (x) { Object.keys(x.poner || {}).forEach(function (c) { deAccion.push(c); }); });
          h += apartadoFicha('', ed.filter(function (c) { return puestos.indexOf(c) < 0 && deAccion.indexOf(c) < 0; }));
        }
        h += '<p class="u-error" id="li-err" role="alert" hidden></p>';
        // T0687: un botón con «ir» («Calcular precio») sale solo si quien ha entrado ve esa sección.
        var acc = nueva || cli ? [] : accionesDe(a, f, hoy).filter(function (x) { return !x.ir || veo[String(x.ir).toUpperCase()]; });
        // T0679: Guardar y lo que se hace con la ficha, al final y fijos abajo (fuera del formulario: el botón lo nombra con form=).
        // T0689: con GUARDAR «solo» (de entrada), una ficha que ya está no tiene «Guardar»: cada campo se guarda al cambiarlo.
        // En el pie, solo lo que lleva a otra sección («Hacer una factura», «Calcular precio»; el primero, el principal); lo que
        // cambia la fila («Pasar a Prospección»), dentro de «Más», lejos de lo del día a día.
        var solo = !nueva && a.guardar === 'solo';
        var conBoton = ed.length && !solo, accIr = acc.filter(function (x) { return x.ir; }), accPoner = acc.filter(function (x) { return !x.ir; });
        var pie = '';
        if (conBoton || accIr.length) pie += '<div class="li-pie"><div class="n-botones">' + (conBoton ? '<button type="submit" form="li-form" class="u-btn u-btn-accion">' + (nueva ? 'Añadir' : 'Guardar') + '</button>' : '') +
          accIr.map(function (x, i) { return '<a class="u-btn' + (!conBoton && !i ? ' u-btn-accion' : '') + '" href="' + texto(irA(x, f.__crudo || f)) + '" data-sx="' + texto(String(x.ir).toUpperCase()) + '">' + texto(x.titulo) + '</a>'; }).join('') + '</div>' +
          accIr.filter(function (x) { return x.texto; }).map(function (x) { return '<p class="u-nota li-accion-t">' + texto(x.texto) + '</p>'; }).join('') + '</div>';
        var masAcc = accPoner.map(function (x) { return '<div class="li-mas-acc"><button type="button" class="u-btn" data-accion="' + acc.indexOf(x) + '">' + texto(x.titulo) + '</button>' + (x.texto ? '<span class="u-nota">' + texto(x.texto) + '</span>' : '') + '</div>'; }).join('');
        h += '</form>';
        // T0652: con quién es, ya abierto (sin la propia tarea: esa es la ficha).
        if (!nueva && !cli && a.contexto) { var rc = resumenDe(a, D, crudo, vistas(a), { hoy: hoy, prohib: PROHIB, sin: id }); if (rc) h += htmlResumen(rc, true); }
        // T0692: sus ventas (de Pedidos), antes de lo relacionado; si aún no han llegado, su sitio, que se rellena al llegar.
        if (!nueva && !cli && VENTAS) h += '<div id="li-ventas">' + htmlVentasDe(crudo, hoy) + '</div>';
        // Lo relacionado (el seguimiento de un cliente): cada fila lleva a su sección, con su ficha abierta.
        if (!nueva && !cli) a.relacionados.filter(function (r) { return veRelacionado(r, ctx); }).forEach(function (r) {
          if (r.juntar) { h += pintarJuntar(a, r, f); return; } // T0691: las marcas de una tela, de varias tablas, una vez cada una
          // T0641: con «tarjeta», sus filas se preparan como las de una sección (rutas, calculados, «de» y plantillas de sus «campos»).
          // T0708: también sin tarjeta, si alguna de sus columnas es uno de esos «campos» (los colores de cada diseño de un proveedor).
          var otroAp = r.tarjeta || conCamposPropios(r) ? apartado({ TABLA: r.tabla, CAMPOS: r.campos || {}, COLUMNAS: (r.columnas || []).concat(r.tarjeta ? camposTarjeta(r) : []), _refs: a.refs }) : null;
          var rs = relacionadas(r, f, otroAp ? preparar(otroAp, filas(r.tabla), D, VAL) : filas(r.tabla).map(function (x) {
            // T0642: una columna con ruta («ID_TELA.COLOR»: el color de la tela que le interesa) sigue las referencias.
            var y = conNombres(a, D, r.tabla, x);
            (r.columnas || []).forEach(function (c) { if (String(c).indexOf('.') > 0) y[c] = seguir(a, D, r.tabla, x, c); });
            return y;
          })), sec = String(r.seccion || '').toUpperCase(), va = sec && veo[sec];
          if (r.orden) rs = rs.slice().sort(comparar(r.orden));
          if (!rs.length && r.siHay && !r.nueva) return; // T0602: lo que casi nunca hay (a quién se compra a través de este), solo si hay
          var otro = { id: sec, titulo: r.titulo, tabla: r.tabla, refs: a.refs, clave: r.clave || 'ID', codigo: r.codigo || '', nombre: r.nombre || (r.columnas || [r.clave || 'ID'])[0], campos: r.campos || {} };
          var cols = (r.columnas || [otro.nombre]).filter(function (c) { return c !== otro.codigo; });
          // T0642: «+ Nueva tarea» lleva a su sección con una nueva ya puesta con esta (su marca).
          // T0688: «nueva.seccion», otra que la de sus filas (en Telas, la tarea nueva va a Hoy: el Historial no la enseña).
          var secN = r.nueva && r.nueva.seccion ? String(r.nueva.seccion).toUpperCase() : sec;
          var nv = r.nueva && secN && veo[secN] ? (function () {
            var q = '?s=' + encodeURIComponent(secN.toLowerCase()) + '&nueva=1';
            Object.keys(r.nueva.poner || {}).forEach(function (k) { q += '&' + encodeURIComponent(k) + '=' + encodeURIComponent((f.__crudo || f)[r.nueva.poner[k]]); });
            return '<a class="u-btn u-btn-texto li-rel-nueva" href="' + texto(q) + '" data-sx="' + texto(secN) + '">+ ' + texto(r.nueva.titulo || 'Añadir') + '</a>';
          })() : '';
          var max = r.max || EN_FICHA, resto = rs.length - max; // T0690
          var cab = '<h3 class="li-fg-t">' + texto(r.titulo || r.tabla) + (r.datos ? '' : ' <span class="u-cifra">' + rs.length + '</span>') + '</h3>';
          var cuerpo;
          if (!rs.length) cuerpo = '<p class="u-vacio">' + texto(r.vacio || 'Nada todavía.') + '</p>';
          else if (r.tarjeta) cuerpo = tarjetas(r, otro, rs, max);
          else if (r.datos) {
            // T0642: «datos»: cada fila como en la ficha, cada dato con su título («Material que buscan: 100 % lino»), no
            // seguidos con puntos. Lo vacío no sale.
            cuerpo = rs.map(function (x, i) {
              return '<div class="u-campos li-rel-datos"' + (i >= max ? ' hidden data-resto' : '') + '>' + cols.map(function (c) {
                var cpo = campo(otro, c), t = celda(otro, c, x, true);
                return t.indexOf('class="li-nada"') >= 0 ? '' : '<div class="li-dato' + (cpo.tipo === 'nota' ? ' u-ancho' : '') + '"><span class="u-etiqueta">' + texto(cpo.titulo) + '</span><span class="li-valor">' + t + '</span></div>';
              }).join('') + '</div>';
            }).join('');
          } else cuerpo = '<ul class="li-rel">' + rs.map(function (x, i) {
              var dentro = cols.map(function (c, k) { var t = celda(otro, c, x, !va); return t.indexOf('class="li-nada"') >= 0 ? '' : '<span' + (k ? '' : ' class="li-rel-n"') + '>' + t + '</span>'; }).join('');
              return '<li' + (i >= max ? ' hidden data-resto' : '') + '>' + (va ? '<a class="li-rel-f" href="?s=' + encodeURIComponent(sec.toLowerCase()) + '&ficha=' + encodeURIComponent((x.__crudo || x)[otro.clave]) + '" data-sx="' + texto(sec) + '">' + dentro + '<span class="li-ir">' + texto(va) + ' ›</span></a>' : '<div class="li-rel-f">' + dentro + '</div>') + '</li>';
            }).join('') + '</ul>';
          // T0690: las primeras «max» (20 si no lo dice) y «Ver todo»: las demás van escondidas y salen al tocarlo.
          if (resto > 0) cuerpo += '<button type="button" class="li-vermas li-vertodo" data-ver-todo>Ver todo <span class="u-nota">· ' + num(rs.length) + ' en total</span></button>';
          h += '<section class="li-fgrupo">' + cab + cuerpo + nv + '</section>';
        });
        // T0630: «Copiar para Claude», al final: arriba va lo que se decide. T0642: dentro de «Más», que no es para el día a día.
        // T0689: con lo que cambia la fila de ACCIONES («Pasar a Prospección»), también sin código.
        if (!nueva && !cli && (a.codigo || masAcc)) h += '<details class="li-mas"><summary>Más</summary>' + masAcc + (a.codigo ? '<div class="li-claude"><button type="button" class="u-btn" data-claude>' + ICONO_COPIAR + 'Copiar para Claude</button><span class="u-nota">Pégalo al empezar una sesión de Claude para trabajar ' + texto(vacio(f[a.codigo]) ? 'esta fila' : f[a.codigo]) + '.</span></div>' : '') + '</details>';
        h += pie;
        abrirVentana(h);
        partir(nueva ? '' : id);
        // T0679: la pastilla de la fase o el estado cambia de color al elegir otro valor.
        [].forEach.call(vent.querySelectorAll('select[data-pil]'), function (sel) {
          sel.addEventListener('change', function () { var m = json(sel.getAttribute('data-pil')) || {}; sel.className = 'li-sel-pil li-estado li-' + (m[sel.value] || 'gris'); });
        });
        var form = vent.querySelector('#li-form');
        [].forEach.call(vent.querySelectorAll('[data-accion]'), function (b) {
          b.addEventListener('click', function () {
            var x = acc[+b.getAttribute('data-accion')], cambios = {};
            Object.keys(x.poner || {}).forEach(function (c) { var cp = campo(a, c), v = x.poner[c]; cambios[c] = cp.ids && v in cp.ids ? cp.ids[v] : v; });
            cerrarVentana();
            Promise.resolve(T.actualizar(a.tabla, id, cambios)).then(function () { ctx.aviso(x.hecho || 'Hecho.'); }, function (e) { ctx.aviso('No se ha cambiado: ' + ((e && e.message) || e)); });
          });
        });
        /* T0689 · La ficha guarda sola: cada campo, al cambiarlo (un desplegable o una fecha, al momento; un texto, al salir de él
         * o tras 1,5 s sin escribir), con «Guardando…» y «Guardado» a su lado y el aviso con «Deshacer». Lo que no vale (algo
         * que aquí no se guarda, una obligatoria vacía) se dice al lado y no se guarda; si falla al guardar, vuelve a como estaba. */
        var actual = solo ? mezclar(crudo, {}) : null, esperas = {}, enCurso = {};
        function marcaCampo(i, txt, mal) {
          var u = i.closest('.u-campo') || i.parentNode, sp = u.querySelector('.li-guardado');
          if (!sp) { sp = document.createElement('span'); sp.className = 'li-guardado'; sp.setAttribute('aria-live', 'polite'); u.appendChild(sp); }
          sp.textContent = txt; sp.classList.toggle('li-guardado-mal', !!mal); sp.classList.toggle('li-guardado-ok', txt === 'Guardado');
        }
        function ponerInicial(i, v) {
          if (i.tagName === 'SELECT') [].forEach.call(i.options, function (o) { o.defaultSelected = o.value === String(v); });
          else i.defaultValue = String(v);
        }
        function ponerValor(c, v) {
          var i = form.querySelector('[data-c="' + c + '"]'); if (!i) return;
          i.value = vacio(v) ? '' : String(v); ponerInicial(i, i.value);
          if (i.hasAttribute('data-pil')) i.dispatchEvent(new Event('change')); // su color
        }
        function guardarCampo(i) {
          var c = i.getAttribute('data-c'); clearTimeout(esperas[c]); delete esperas[c];
          var r = cambioCampo(a, c, i.value, actual, PROHIB);
          if (r.error) { i.setAttribute('aria-invalid', 'true'); marcaCampo(i, r.error, true); return; }
          i.removeAttribute('aria-invalid');
          var ks = Object.keys(r.cambios);
          if (!ks.length) { var sp = (i.closest('.u-campo') || i.parentNode).querySelector('.li-guardado'); if (sp && sp.classList.contains('li-guardado-mal')) sp.textContent = ''; return; }
          var antes = {}; ks.forEach(function (k) { antes[k] = vacio(actual[k]) ? '' : actual[k]; actual[k] = r.cambios[k]; });
          ponerInicial(i, i.value);
          ks.forEach(function (k) { if (k !== c) ponerValor(k, r.cambios[k]); }); // lo que se pone solo (el área), también en pantalla
          marcaCampo(i, 'Guardando…');
          // En orden: si el mismo campo aún se está guardando, después de él (lo de antes se coge ahora, no al ejecutarse).
          var previo = (enCurso[c] || Promise.resolve()).then(null, function () {});
          var ch = deshacerEnOrden(function () { return previo.then(function () { return T.actualizar(a.tabla, id, r.cambios); }); },
            function () { return T.actualizar(a.tabla, id, antes); });
          enCurso[c] = ch.hecho;
          ch.hecho.then(function () {
            if (vent.contains(i)) marcaCampo(i, 'Guardado');
            deshacible(textoCambio(a, c, i.tagName === 'SELECT' && i.selectedIndex >= 0 ? i.options[i.selectedIndex].text : i.value, VAL, PROHIB), function () {
              return Promise.resolve(ch.deshacer()).then(function () {
                ks.forEach(function (k) { actual[k] = antes[k]; if (vent.contains(i)) ponerValor(k, antes[k]); });
                if (vent.contains(i)) marcaCampo(i, '');
              });
            });
          }, function (e) {
            ks.forEach(function (k) { actual[k] = antes[k]; if (vent.contains(i)) ponerValor(k, antes[k]); });
            if (vent.contains(i)) marcaCampo(i, 'No se ha guardado', true);
            ctx.aviso('No se ha guardado ' + campo(a, c).titulo.toLowerCase() + ': ' + ((e && e.message) || e));
          });
        }
        if (solo) {
          form.addEventListener('change', function (ev) { var i = ev.target; if (i.getAttribute && i.getAttribute('data-c')) guardarCampo(i); });
          form.addEventListener('input', function (ev) {
            var i = ev.target, c = i.getAttribute && i.getAttribute('data-c');
            if (!c || i.tagName === 'SELECT' || /^(date|checkbox|radio)$/.test(i.type)) return;
            clearTimeout(esperas[c]); esperas[c] = setTimeout(function () { if (vent.contains(i)) guardarCampo(i); }, 1500);
          });
          // Al cerrar la ficha con algo escrito y sin guardar aún, se guarda.
          alCerrar = function () { Object.keys(esperas).forEach(function (c) { var i = form.querySelector('[data-c="' + c + '"]'); if (i) guardarCampo(i); }); };
        }
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          // T0689: sin «Guardar», Intro en un campo lo guarda y la ficha sigue abierta.
          if (solo) { var ae = document.activeElement; if (ae && form.contains(ae) && ae.getAttribute('data-c')) guardarCampo(ae); return; }
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
          // T0677: el buscador de «con quién» deja en la lista solo lo que lleva lo escrito (y elige lo primero que lo lleva).
          form.addEventListener('input', function (ev) {
            var c = ev.target.getAttribute && ev.target.getAttribute('data-buscar-uno'); if (!c) return;
            var sl = form.querySelector('select[data-uno="' + c + '"]'), antes = sl.value;
            var gs = gruposConQuien(a, c, editables(a), ev.target.value), vale = gs.some(function (g) { return g.opciones.some(function (o) { return g.col + '|' + o.valor === antes; }); });
            var sel = vale || !ev.target.value.trim() ? antes : (gs[0] ? gs[0].col + '|' + gs[0].opciones[0].valor : '');
            sl.innerHTML = opcionesUno(gs, sel);
            if (sl.value !== antes) ponerDeducidos();
          });
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
      function opcionesUno(gs, sel) {
        return '<option value="">Nadie en concreto</option>' + gs.map(function (g) {
          return '<optgroup label="' + texto(g.titulo) + '">' + g.opciones.map(function (o) {
            var v = g.col + '|' + o.valor;
            return '<option value="' + texto(v) + '"' + (v === sel ? ' selected' : '') + '>' + texto(o.nombre) + '</option>';
          }).join('') + '</optgroup>';
        }).join('');
      }
      function entradaAlta(a, c, crudo, ed, hoy) {
        var cp = campo(a, c), id = 'li-c-' + c;
        if (cp.primero) {
          // T0677: agrupada (Marcas, Proveedores, Otros), por orden alfabético y, si es larga, con un buscador encima.
          var gs = gruposConQuien(a, c, ed), n = gs.reduce(function (k, g) { return k + g.opciones.length; }, 0), sel = '';
          gs.forEach(function (g) { if (!vacio(crudo[g.col])) sel = g.col + '|' + crudo[g.col]; });
          return '<div class="u-campo u-ancho"><label class="u-etiqueta" for="' + id + '">' + texto(cp.titulo) + '</label>' +
            (n > 12 && !(typeof window !== 'undefined' && window.UElegir) ? '<input type="search" class="li-cq-buscar" data-buscar-uno="' + texto(c) + '" placeholder="Busca por el nombre" aria-label="Buscar en ' + texto(cp.titulo.toLowerCase()) + '" autocomplete="off">' : '') +
            '<select id="' + id + '" data-uno="' + texto(c) + '" data-elegir="con-quien">' + opcionesUno(gs, sel) + '</select></div>';
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
            if (d.tipo === 'lista' && d.opciones.length + (d.vacios ? 1 : 0) <= 6) { // T0679: hasta 6, pastillas; con más (con quién, ciudad), un desplegable
              // T0679: pocas opciones, en pastillas que se tocan (una a la vez; tocar la elegida la quita). Lo elegido va en el oculto.
              var val = x.vacio ? '!' : (x.es !== undefined ? '=' + (d.opciones.filter(function (o) { return norm(o) === norm(x.es); })[0] || x.es) : '');
              var pil = function (v, t) { return '<button type="button" class="li-fop" data-fop="' + texto(v) + '" aria-pressed="' + (val === v) + '">' + texto(t) + '</button>'; };
              return '<fieldset class="u-campo u-ancho li-fops"><legend class="u-etiqueta">' + texto(d.titulo) + '</legend><input type="hidden" id="' + id + '" data-f="' + texto(d.campo) + '" value="' + texto(val) + '">' +
                '<div>' + d.opciones.map(function (o) { return pil('=' + o, mostrar(d.cp, o)); }).join('') + (d.vacios ? pil('!', 'Sin ' + d.titulo.toLowerCase()) : '') + '</div></fieldset>';
            }
            if (d.tipo === 'lista') {
              return '<div class="u-campo u-ancho">' + et(id) + '<select class="li-fsel" id="' + id + '" data-f="' + texto(d.campo) + '" data-elegir="filtro-' + texto(d.campo) + '"><option value="">Cualquiera</option>' +
                d.opciones.map(function (o) { return '<option value="=' + texto(o) + '"' + (x.es !== undefined && norm(x.es) === norm(o) ? ' selected' : '') + '>' + texto(mostrar(d.cp, o)) + '</option>'; }).join('') +
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
          '<div class="n-botones li-ff-pie"><button type="submit" class="u-btn u-btn-accion" data-ver></button><button type="button" class="u-btn u-btn-texto" data-fquitar>Quitar filtros</button></div></form>';
        abrirVentana(h, true);
        var form = vent.querySelector('#li-ff'), boton = form.querySelector('[data-ver]'), err = vent.querySelector('#li-ferr');
        form.addEventListener('click', function (ev) {
          var b = ev.target.closest('[data-fop]'); if (!b) return;
          var g = b.closest('.li-fops'), inp = g.querySelector('[data-f]'), v = b.getAttribute('data-fop'), quita = b.getAttribute('aria-pressed') === 'true';
          inp.value = quita ? '' : v;
          [].forEach.call(g.querySelectorAll('[data-fop]'), function (x) { x.setAttribute('aria-pressed', String(!quita && x === b)); });
          contar();
        });
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
          boton.textContent = n ? 'Ver ' + cuenta(a, vista, n) : 'Nada con estos filtros';
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
        var fuera = ocultasDe(base, p), menu = delMenu();
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
        var rp = ev.target.closest('[data-rapido]');
        if (rp) { // T0679: el filtro rápido de encima de la lista
          var c = rp.getAttribute('data-rapido'), v = rp.getAttribute('data-v');
          if (v && rp.getAttribute('aria-pressed') !== 'true') S.filtros[c] = { es: v }; else delete S.filtros[c];
          pintar(); return;
        }
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
        // T0652: el nombre de con quién es abre su resumen (otra vez, lo cierra).
        var bx = ev.target.closest('[data-ctx]');
        if (bx) { var ix = bx.getAttribute('data-ctx'); if (S.ctx === ix) cerrarCtx(); else abrirCtx(ix); return; }
        // T0690: ordenar por una columna (se recuerda por vista en este dispositivo), «Ver más», lo hecho y lo de antes.
        var lg = ev.target.closest('[data-orden],[data-mas],[data-plegar],[data-antes]');
        if (lg) {
          if (lg.hasAttribute('data-orden')) { var vo = vistaActual(ap()).id; guardado(K + 'orden_' + vo, siguienteOrden(ap(), guardado(K + 'orden_' + vo), lg.getAttribute('data-orden'))); }
          else if (lg.hasAttribute('data-mas')) { var km = lg.getAttribute('data-mas'), pm = +lg.getAttribute('data-paso') || POR_GRUPO; S.mas[km] = (S.mas[km] || pm) + pm; }
          else if (lg.hasAttribute('data-plegar')) { var kp = lg.getAttribute('data-plegar'); S.abre[kp] = !S.abre[kp]; }
          else S.antes[lg.getAttribute('data-antes')] = true;
          var sel = lg.hasAttribute('data-orden') ? '[data-orden="' + lg.getAttribute('data-orden') + '"]' : (lg.hasAttribute('data-plegar') ? '[data-plegar="' + lg.getAttribute('data-plegar') + '"]' : '');
          pintar();
          // El foco no se pierde: vuelve al mismo botón (ordenar, plegar), el que se ve (la tabla o las tarjetas).
          var vuelta = sel ? [].filter.call(cont.querySelectorAll(sel), function (x) { return x.offsetParent !== null; })[0] : null;
          if (vuelta) vuelta.focus();
          return;
        }
        // T0689: Mías / Todas (se recuerda para esta persona en este dispositivo).
        var bm = ev.target.closest('[data-mias]');
        if (bm) { S.mias = bm.getAttribute('data-mias') === 'todas' ? 'todas' : 'mias'; guardado(KM, S.mias); pintar(); var bv = cont.querySelector('[data-mias="' + S.mias + '"]'); if (bv) bv.focus(); return; }
        var t = ev.target.closest('[data-vista],[data-aviso],[data-id],[data-pers],[data-qes],[data-nueva],[data-filtrar],[data-quitar]');
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
        if (t.hasAttribute('data-vista')) { S.vista = t.getAttribute('data-vista'); S.aviso = ''; S.mas = {}; S.abre = {}; S.antes = {}; guardado(K + 'vista', S.vista); pintar(); return; }
        if (t.hasAttribute('data-aviso')) { var x = t.getAttribute('data-aviso'); S.aviso = S.aviso === x ? '' : x; pintar(); return; }
        if (t.hasAttribute('data-pers')) { personalizar(); return; }
        if (t.hasAttribute('data-qes')) { S.qes = !S.qes; pintar(); return; }
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
        Promise.resolve(T.actualizar(a.tabla, era.id, cambios)).then(function () { ctx.aviso('Movida a «' + (v ? mostrar(cp, v) : 'sin ' + campo(a, c).titulo.toLowerCase()) + '».'); }, function (e) { ctx.aviso('No se ha movido: ' + ((e && e.message) || e)); });
      });
      document.addEventListener('pointercancel', alCancelar = function () { soltarArrastre(); });
      // Después de arrastrar no se abre la ficha (el navegador manda un clic al soltar).
      cont.addEventListener('click', function (ev) { if (sinClic) { ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
      velo.addEventListener('click', function (ev) {
        if (ev.target === velo || ev.target.closest('[data-cerrar]')) { cerrarVentana(); return; }
        if (ev.target.closest('[data-volver]')) { velo.classList.remove('abierto'); partir(null); ctx.volver(); return; }
        // T0642: al saltar de esta ficha a otra (lo relacionado, «+ Nueva tarea»), la dirección de ahora se queda con la ficha
        // abierta, para que «Volver» o el atrás del móvil la vuelvan a abrir, y la siguiente dice «‹ Volver a <esta>».
        var sx = ev.target.closest('a[data-sx]');
        if (sx && abierta && !(ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button)) {
          var h2 = vent.querySelector('#li-vt'), nom = '';
          if (h2) { var cp2 = h2.cloneNode(true); [].forEach.call(cp2.querySelectorAll('.li-cod'), function (x) { x.parentNode.removeChild(x); }); nom = cp2.textContent.trim(); }
          try { history.replaceState(history.state, '', location.pathname + conFicha(location.search, abierta.id, editables(BASE)) + location.hash); } catch (e) {}
          // T0692: a Pedidos (otra sección, no un Listado) no se le dice: lo recogería esta ficha al volver («‹ Volver a» sí misma).
          if (!(venSec && String(sx.getAttribute('data-sx')).toUpperCase() === venSec)) vueltaPendiente = nom;
          return; // el marco hace el salto
        }
        if (ev.target.closest('[data-claude]')) { copiarClaude(); return; }
        // T0690: «Ver todo» de lo relacionado (el seguimiento de un cliente): salen las que estaban escondidas.
        var vt = ev.target.closest('[data-ver-todo]');
        if (vt) { var sc = vt.closest('.li-fgrupo'); [].forEach.call(sc.querySelectorAll('[data-resto]'), function (x) { x.hidden = false; }); vt.remove(); return; }
        // T0652: una tarea del resumen de la ficha abre la suya.
        var cf = ev.target.closest('[data-ctx-fila]');
        if (cf) { var idf = cf.getAttribute('data-ctx-fila'); cerrarVentana(); ficha(idf); return; }
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
        if (ev.target.closest('a[data-sx]')) { velo.classList.remove('abierto'); partir(null); }
      });
      // T0652: el resumen. Una tarea de la lista abre su ficha; «Abrir en Clientes», la otra sección (la abre el marco).
      pCtx.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-ctx-cerrar]')) { cerrarCtx(); return; }
        var e = ev.target.closest('[data-ctx-fila]');
        if (e) { cerrarCtx(true); ficha(e.getAttribute('data-ctx-fila')); return; }
        if (ev.target.closest('a[data-sx]')) cerrarCtx(true);
      });
      // Tocar fuera del resumen solo lo cierra (no abre lo que había debajo); fuera de la sección (el menú), lo cierra y sigue.
      alTocarFuera = function (ev) {
        if (!S.ctx || pCtx.contains(ev.target) || (ev.target.closest && ev.target.closest('[data-ctx]'))) return;
        var dentro = el.contains(ev.target);
        cerrarCtx(!dentro);
        if (dentro) { ev.stopPropagation(); ev.preventDefault(); }
      };
      document.addEventListener('click', alTocarFuera, true);
      teclaEsc = function (ev) {
        if (ev.key !== 'Escape' || !ctx.abierta()) return;
        if (velo.classList.contains('abierto')) { cerrarVentana(); return; }
        if (S.ctx) { cerrarCtx(); return; }
        if (S.menu) { var b = S.menu; S.menu = ''; pintar(); var bb = cont.querySelector('[data-pasar-menu="' + b.replace(/"/g, '') + '"]'); if (bb && bb.offsetParent) bb.focus(); }
      };
      document.addEventListener('keydown', teclaEsc);
      // T0643: el menú de «Pasar» va fijo junto a su botón: al desplazar, se cierra (no se queda flotando en otro sitio).
      alDesplazar = function () { if (S.menu) { S.menu = ''; pintar(); } };
      window.addEventListener('scroll', alDesplazar, true);
      avDes.querySelector('[data-deshacer]').addEventListener('click', function () {
        var d = avDes._deshacer; sinDeshacer();
        if (d) deshacerYDecir(d);
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
        leerVentas(); // T0692
        // T0644: desde el Perfil («Personalizar»), ?personalizar=1 abre aquí su ventana.
        if (url.get('personalizar') && puedePersonalizar) personalizar();
        else if (pedida) {
          // T0688: si la fila pedida no está en la vista que se ve, la de su vista (sin recordarla: la próxima vez, la de siempre).
          var aP = ap(), fP = filaVista(aP, pedida), vP = fP ? vistaDeFila(aP, fP, vistaActual(aP).id, hoyIso()) : '';
          if (vP && vP !== vistaActual(aP).id) { S.vista = vP; pintar(); }
          ficha(pedida);
        }
        else if (url.get('nueva') && BASE.crear) {
          // T0642: «+ Nueva tarea» desde la ficha de una marca: ?nueva=1&ID_MARCA=M-001 (solo columnas que se editan).
          var puesto = {}, edn = editables(ap());
          url.forEach(function (v, k) { if (edn.indexOf(k) >= 0 && v) puesto[k] = v; });
          ficha(null, true, puesto);
        }
      }, function (e) {
        cont.innerHTML = '<p class="u-error">No se han podido leer los datos: ' + texto((e && e.message) || e) + '</p>';
      });
    },
    cerrar: function () {
      document.body.classList.remove('li-partida');
      if (teclaEsc) document.removeEventListener('keydown', teclaEsc); teclaEsc = null;
      if (alMover) document.removeEventListener('pointermove', alMover);
      if (alSoltar) document.removeEventListener('pointerup', alSoltar);
      if (alCancelar) document.removeEventListener('pointercancel', alCancelar);
      if (alDesplazar) window.removeEventListener('scroll', alDesplazar, true);
      if (alTocarFuera) document.removeEventListener('click', alTocarFuera, true);
      alMover = alSoltar = alCancelar = alDesplazar = alTocarFuera = null;
    }
  });
})();
