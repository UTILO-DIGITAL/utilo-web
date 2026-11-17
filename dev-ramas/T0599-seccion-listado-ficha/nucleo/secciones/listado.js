/*
 * Sección Listado base del núcleo · UTILO_CORE 5.0 (T0599) · motor/modulos/listado de utilo-apps
 *
 * Un listado con ficha y avisos que sirve para cualquier tabla de cualquier cliente, sin una pantalla a medida por
 * pestaña: cada cliente dice en su config.json (nucleo.secciones.listado.config.APARTADOS) sus apartados, y de cada uno
 * qué columnas salen en la lista, los apartados de la ficha, las vistas y los avisos. Lee y escribe con la capa de
 * tablas (ctx.tablas), con un Sheet o con Supabase: la sección no lo sabe.
 *
 *   Pestañas   un apartado cada una, con cuántas filas tienen un aviso.
 *   Vistas     filtros guardados (con su orden, sus grupos y las columnas que ocultan). Una vista «para enseñar a un
 *              cliente» (cliente: true) oculta siempre los campos privados (el proveedor), también en la ficha.
 *   Avisos     lo que no se puede escapar (fecha pasada, vence en unos días, sin hacer): arriba de la lista, en cada fila
 *              y en la ficha. Tocar uno filtra la lista.
 *   Ficha      los apartados de la ficha, en orden; las filas relacionadas de otro apartado (el seguimiento de un
 *              cliente) y, si se puede, editar.
 *   Personalizar  quien está en PERSONALIZAN (y quien administra) cambia el orden de los apartados, qué vistas se ven y
 *              en qué orden, y qué avisos están encendidos y con cuántos días. Se guarda en la tabla PREFERENCIAS (para
 *              todos los dispositivos) o, sin ella, en este dispositivo.
 * Reglas que cumple sola: un campo calculado con «precio» nunca enseña un importe sin su envío; los datos de PROHIBIDO
 * (contraseñas, números de cuenta, DNI/NIE) no se guardan y, si ya están en la tabla, no se enseñan.
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

  /* ---------- configuración ---------- */
  /** El campo de un apartado, con su título y tipo por defecto. */
  function campo(ap, c) {
    var d = (ap.campos || {})[c] || {};
    return { n: c, titulo: d.titulo || titulo(c), tipo: d.tipo || (d.calculo ? 'importe' : 'texto'), opciones: d.opciones || null,
      unidad: d.unidad || '', calculo: d.calculo || null, precio: d.precio || null, privado: !!d.privado, colores: d.colores || null,
      ayuda: d.ayuda || '' };
  }
  function columnasDe(ap, vista) { return (vista && vista.columnas) || ap.columnas || [ap.nombre || 'ID']; }
  /** Lo que una vista no enseña: lo que dice ocultar y, si es para enseñar a un cliente, todos los campos privados. */
  function ocultas(ap, vista) {
    var o = lista(vista && vista.ocultar).slice();
    if (vista && vista.cliente) Object.keys(ap.campos || {}).forEach(function (c) { if (ap.campos[c].privado && o.indexOf(c) < 0) o.push(c); });
    return o;
  }
  /** Las vistas de un apartado; sin ninguna, «Todo». */
  function vistasDe(ap) { return ap.vistas && ap.vistas.length ? ap.vistas : [{ id: 'TODO', titulo: 'Todo' }]; }

  /**
   * Comprueba la configuración (para quien administra y para las pruebas): ids repetidos, columnas que faltan, un
   * precio cuyo cálculo no lleva el envío, una vista para clientes que enseñaría un campo privado y columnas con datos
   * que no se guardan. columnasDe(tabla) da las columnas de la tabla, si se saben (si no, no se miran).
   */
  function comprobar(cfg, columnasTabla) {
    var errores = [], aps = cfg.APARTADOS || [], vistos = {}, prohib = cfg.PROHIBIDO === undefined ? ['CONTRASENA', 'CUENTA', 'DNI'] : cfg.PROHIBIDO;
    aps.forEach(function (ap, i) {
      var donde = 'Apartado ' + (ap.id || '#' + (i + 1));
      if (!ap.id || !/^[A-Z0-9_]+$/.test(ap.id)) errores.push(donde + ': el id va en mayúsculas, sin tildes ni espacios.');
      if (vistos[ap.id]) errores.push(donde + ': está dos veces.');
      vistos[ap.id] = true;
      if (!ap.tabla) { errores.push(donde + ': falta la tabla.'); return; }
      var cols = columnasTabla ? columnasTabla(ap.tabla) : null, calc = Object.keys(ap.campos || {}).filter(function (c) { return ap.campos[c].calculo; });
      function hay(c, que) {
        if (calc.indexOf(c) >= 0) return;
        if (cols && cols.indexOf(c) < 0) errores.push(donde + ': ' + que + ' «' + c + '» no es una columna de ' + ap.tabla + '.');
      }
      var todas = [ap.nombre || ap.clave || 'ID'].concat(ap.columnas || [], ap.detalle || []);
      (ap.ficha || []).forEach(function (g) { todas = todas.concat(g.campos || []); });
      todas.forEach(function (c) { hay(c, 'la columna'); });
      lista(ap.editar === true ? [] : ap.editar).forEach(function (c) { hay(c, 'la columna que se edita'); if (calc.indexOf(c) >= 0) errores.push(donde + ': «' + c + '» es calculado, no se edita.'); });
      todas.concat(lista(ap.editar === true ? [] : ap.editar), cols || []).forEach(function (c) {
        prohib.forEach(function (k) { if (NOMBRES_PROHIBIDOS[k] && NOMBRES_PROHIBIDOS[k].test(norm(c).toUpperCase())) errores.push(donde + ': la columna «' + c + '» guardaría ' + QUE_ES[k] + ', que aquí no se guardan.'); });
      });
      calc.forEach(function (c) {
        var d = ap.campos[c];
        usa(d.calculo).forEach(function (u) {
          if (u.charAt(0) === '$') { if (!cfg.VALORES || !(u.slice(1) in cfg.VALORES)) errores.push(donde + ': «' + c + '» usa ' + u + ', que no está en VALORES.'); }
          else hay(u, 'el cálculo de «' + c + '» usa');
        });
        if (d.precio) {
          var env = lista(d.precio.envio);
          if (!env.length) errores.push(donde + ': el precio «' + c + '» no dice cuál es su envío (precio.envio).');
          else if (!env.some(function (e) { return usa(d.calculo).indexOf(e) >= 0; })) errores.push(donde + ': el precio «' + c + '» no suma su envío (' + env.join(' o ') + '): se vería un precio sin envío.');
        }
      });
      var vids = {};
      vistasDe(ap).forEach(function (v) {
        if (vids[v.id]) errores.push(donde + ': la vista «' + v.id + '» está dos veces.');
        vids[v.id] = true;
        lista(v.filtro).forEach(function (cnd) { if (cnd.campo) hay(cnd.campo, 'el filtro de la vista «' + v.id + '» usa'); });
        if (v.agrupar) hay(v.agrupar.campo || v.agrupar, 'la vista «' + v.id + '» agrupa por');
        if (v.tablero) {
          if (!v.tablero.campo) errores.push(donde + ': el tablero de la vista «' + v.id + '» no dice por qué columna (tablero.campo).');
          else hay(v.tablero.campo, 'el tablero de la vista «' + v.id + '» usa');
          if (v.agrupar) errores.push(donde + ': la vista «' + v.id + '» es un tablero: no agrupa además.');
        }
        if (v.cliente) {
          var priv = function (c) { return (ap.campos || {})[c] && ap.campos[c].privado; };
          var se = columnasDe(ap, v).filter(function (c) { return ocultas(ap, v).indexOf(c) < 0 && priv(c); });
          // El nombre de la fila sale siempre (en la tarjeta y en el título de la ficha): no puede ser privado.
          if (ap.nombre && priv(ap.nombre) && se.indexOf(ap.nombre) < 0) se.push(ap.nombre);
          if (se.length) errores.push(donde + ': la vista para clientes «' + v.id + '» enseñaría ' + se.join(', ') + '.');
        }
      });
      var aids = {};
      (ap.avisos || []).forEach(function (a) {
        if (!a.id) errores.push(donde + ': un aviso sin id.');
        if (aids[a.id]) errores.push(donde + ': el aviso «' + a.id + '» está dos veces.');
        aids[a.id] = true;
        lista(a.si).forEach(function (cnd) { if (cnd.campo) hay(cnd.campo, 'el aviso «' + a.id + '» usa'); });
      });
      (ap.relacionados || []).forEach(function (r) {
        if (!aps.some(function (x) { return x.id === r.apartado; })) errores.push(donde + ': lo relacionado «' + (r.titulo || r.apartado) + '» apunta a un apartado que no existe.');
      });
    });
    return errores;
  }

  /* ---------- personalizar ----------
   * Lo que se personaliza: { orden: [apartados], apartados: { ID: { vistas: [orden], ocultas: [vistas], avisos: { ID: { activo, dias } } } } }.
   * Se aplica sobre la configuración: lo que no nombra se queda como está y lo que ya no existe se olvida. */
  function aplicar(aps, pref) {
    pref = pref || {};
    var orden = lista(pref.orden), copia = JSON.parse(JSON.stringify(aps || []));
    // Primero las que nombra, en su orden; después las demás (las nuevas), como vienen.
    copia = copia.filter(function (a) { return orden.indexOf(a.id) >= 0; }).sort(function (a, b) { return orden.indexOf(a.id) - orden.indexOf(b.id); })
      .concat(copia.filter(function (a) { return orden.indexOf(a.id) < 0; }));
    copia.forEach(function (ap) {
      var p = (pref.apartados || {})[ap.id];
      if (!p) return;
      if (ap.vistas && ap.vistas.length) {
        var ov = lista(p.vistas), fuera = lista(p.ocultas);
        var vs = ap.vistas.filter(function (v) { return ov.indexOf(v.id) >= 0; }).sort(function (a, b) { return ov.indexOf(a.id) - ov.indexOf(b.id); })
          .concat(ap.vistas.filter(function (v) { return ov.indexOf(v.id) < 0; }));
        var quedan = vs.filter(function (v) { return fuera.indexOf(v.id) < 0; });
        ap.vistas = quedan.length ? quedan : vs.slice(0, 1); // al menos una vista
      }
      (ap.avisos || []).forEach(function (a) {
        var pa = (p.avisos || {})[a.id];
        if (!pa) return;
        if (pa.activo !== undefined) a.activo = !!pa.activo;
        if (typeof pa.dias === 'number' && isFinite(pa.dias)) a.dias = Math.max(0, Math.min(365, Math.round(pa.dias)));
      });
    });
    return copia;
  }
  function apartadoVisible(ap, perfil, admin) { return admin || !ap.perfiles || lista(ap.perfiles).indexOf(perfil) >= 0; }

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
    var dondeBuscar = (ap.buscar || [ap.nombre].concat(columnasDe(ap, vista), ap.detalle || [])).filter(function (c) { return c && fuera.indexOf(c) < 0; });
    var r = filas.filter(function (f) {
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
    var v = norm(f[r.con]);
    if (!v) return [];
    return filasOtro.filter(function (x) { return r.contiene ? norm(x[r.campo]).indexOf(v) >= 0 : norm(x[r.campo]) === v; });
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

  var CALC = { titulo: titulo, aFecha: aFecha, diasHasta: diasHasta, aNumero: aNumero, cumple: cumple, calcular: calcular, usa: usa,
    valoresDe: valoresDe, prohibido: prohibido, tapar: tapar, num: num, textoProhibido: textoProhibido, campo: campo, ocultas: ocultas, vistasDe: vistasDe,
    columnasDe: columnasDe, comprobar: comprobar, aplicar: aplicar, visible: apartadoVisible, avisosDe: avisosDe, avisosActivos: avisosActivos,
    filtrar: filtrar, agrupar: agrupar, columnasTablero: columnasTablero, relacionadas: relacionadas, verTexto: verTexto, cuando: cuando, comparar: comparar };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) {} return ''; }
  function hoyIso() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  var ICONO_AJUSTAR = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>';
  var CLAVE_PREF = 'LISTADO';
  var teclaEsc = null;

  window.UN.registrar('LISTADO', {
    abrir: function (el, ctx) {
      var T = ctx.tablas, cfg = ctx.config || {};
      var BASE = cfg.APARTADOS || [], PROHIB = cfg.PROHIBIDO === undefined ? ['CONTRASENA', 'CUENTA', 'DNI'] : cfg.PROHIBIDO;
      var puedePersonalizar = !!ctx.admin || (cfg.PERSONALIZAN || []).indexOf(ctx.perfil) >= 0;
      var K = 'li_' + ctx.id + '_';
      var S = { ap: guardado(K + 'ap'), vista: {}, q: '', aviso: '', leido: false };
      try { S.vista = JSON.parse(guardado(K + 'vistas') || '{}') || {}; } catch (e) { S.vista = {}; }
      var errores = comprobar(cfg, function (t) { var c = T.columnas && T.columnas(t); return c && c.length ? c : null; });

      el.innerHTML = '<div id="li-cont"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<div class="u-velo" id="li-velo"><div class="u-ventana" role="dialog" aria-modal="true" aria-labelledby="li-vt"><div class="n-ventana" id="li-vent"></div></div></div>';
      var cont = el.querySelector('#li-cont'), velo = el.querySelector('#li-velo'), vent = el.querySelector('#li-vent');

      /* ---------- datos ---------- */
      var tablas = [];
      BASE.forEach(function (a) { if (tablas.indexOf(a.tabla) < 0) tablas.push(a.tabla); });
      Object.keys(cfg.VALORES || {}).forEach(function (k) { var v = cfg.VALORES[k]; if (v && v.tabla && tablas.indexOf(v.tabla) < 0) tablas.push(v.tabla); });
      if (cfg.PREFERENCIAS && tablas.indexOf(cfg.PREFERENCIAS) < 0) tablas.push(cfg.PREFERENCIAS);
      function filas(t) { return T.filas(t) || []; }
      function filaDe(t, id) { return T.fila ? T.fila(t, id) : null; }
      function pref() {
        var txt = '';
        if (cfg.PREFERENCIAS) { var f = filaDe(cfg.PREFERENCIAS, CLAVE_PREF); txt = f ? f.VALOR : ''; }
        if (!txt) txt = guardado(K + 'pref');
        try { return JSON.parse(txt || '{}') || {}; } catch (e) { return {}; }
      }
      function apartados() { return aplicar(BASE, pref()).filter(function (a) { return apartadoVisible(a, ctx.perfil, ctx.admin); }); }
      function apActual(aps) { return aps.filter(function (a) { return a.id === S.ap; })[0] || aps[0] || null; }
      function vistaActual(ap) { var vs = vistasDe(ap); return vs.filter(function (v) { return v.id === S.vista[ap.id]; })[0] || vs[0]; }
      function clave(ap) { return ap.clave || 'ID'; }
      var VAL = {};

      /* ---------- pintar ---------- */
      function celda(ap, c, f, conEnlaces, cliente) {
        var cp = campo(ap, c), t = verTexto(cp, f, VAL, PROHIB);
        if (t === '') return '<span class="li-nada">—</span>';
        var v = f[c];
        if (cp.calculo && cp.precio && t.indexOf('Falta') === 0) return cliente ? 'Precio a consultar' : '<span class="u-mal">' + texto(t) + '</span>';
        if (conEnlaces && !cp.calculo && !prohibido(v, PROHIB).length) {
          if (cp.tipo === 'enlace' && /^https?:\/\//i.test(String(v))) return '<a href="' + texto(v) + '" target="_blank" rel="noopener">Abrir ↗</a>';
          if (cp.tipo === 'email' && /@/.test(String(v))) return '<a href="mailto:' + texto(v) + '">' + texto(v) + '</a>';
          if (cp.tipo === 'telefono') return '<a href="tel:' + texto(String(v).replace(/[^\d+]/g, '')) + '">' + texto(v) + '</a>';
          if (cp.tipo === 'foto' && /^(https?:|data:image\/)/i.test(String(v))) return '<img class="li-foto" src="' + texto(v) + '" alt="">';
        }
        if (cp.tipo === 'foto') return /^(https?:|data:image\/)/i.test(String(v)) ? '<img class="li-mini" src="' + texto(v) + '" alt="">' : texto(t);
        if (cp.tipo === 'estado' || cp.colores) {
          var col = (cp.colores || {})[String(v)] || '';
          return '<span class="u-chip li-estado' + (col ? ' li-' + texto(col) : '') + '">' + texto(t) + '</span>';
        }
        if (cp.tipo === 'fecha') {
          var cu = cuando(v, hoyIso());
          return texto(t) + (cu ? ' <span class="u-nota">· ' + texto(cu) + '</span>' : '');
        }
        return texto(t);
      }
      function marcas(avs) {
        return avs.map(function (a) { return '<span class="li-aviso li-' + texto(a.nivel || 'medio') + '">' + texto(a.titulo) + '</span>'; }).join('');
      }
      function pintar() {
        if (!S.leido) return;
        VAL = valoresDe(cfg.VALORES, filaDe);
        var aps = apartados();
        if (!aps.length) {
          cont.innerHTML = '<p class="u-vacio">' + (BASE.length ? 'No tienes ningún apartado a la vista. Pide a quien administra que te dé alguno.' :
            'Todavía no hay apartados. Quien administra la app los dice en config.json (nucleo.secciones.listado.config.APARTADOS).') + '</p>';
          return;
        }
        var ap = apActual(aps), vista = vistaActual(ap), hoy = hoyIso();
        S.ap = ap.id;
        ctx.ponerTitulo(ctx.titulo);
        var todas = filas(ap.tabla);
        var conAviso = function (a) { return filas(a.tabla).filter(function (f) { return avisosDe(a, f, hoy).some(function (x) { return (x.nivel || 'medio') === 'alto'; }); }).length; };
        var html = '';
        if (ctx.admin && errores.length) html += '<div class="u-bloque li-errores"><strong>La configuración tiene cosas que no cuadran (solo lo ve quien administra):</strong><ul>' + errores.map(function (e) { return '<li>' + texto(e) + '</li>'; }).join('') + '</ul></div>';
        if (cfg.AYUDA) html += '<p class="u-nota li-ayuda">' + texto(cfg.AYUDA) + '</p>';
        html += '<div class="li-arriba"><div class="u-pestanas li-aps" role="tablist">' + aps.map(function (a) {
          var n = conAviso(a);
          return '<button type="button" role="tab" data-ap="' + texto(a.id) + '" aria-selected="' + (a.id === ap.id) + '">' + texto(a.titulo || titulo(a.id)) +
            (n ? ' <span class="li-n" title="Filas con un aviso">' + n + '</span>' : '') + '</button>';
        }).join('') + '</div>' +
          (puedePersonalizar ? '<button type="button" class="u-btn u-btn-texto li-pers" data-pers>' + ICONO_AJUSTAR + 'Personalizar</button>' : '') + '</div>';
        if (ap.texto) html += '<p class="u-nota li-texto">' + texto(ap.texto) + '</p>';
        var vs = vistasDe(ap);
        if (vs.length > 1) html += '<div class="li-vistas" role="group" aria-label="Vistas">' + vs.map(function (v) {
          return '<button type="button" class="li-vista" data-vista="' + texto(v.id) + '" aria-pressed="' + (v.id === vista.id) + '">' + texto(v.titulo) + (v.cliente ? ' <span class="li-cli">para clientes</span>' : '') + '</button>';
        }).join('') + '</div>';
        if (vista.cliente) {
          var nombres = []; ocultas(ap, vista).forEach(function (c) { var t = campo(ap, c).titulo; if (nombres.indexOf(t) < 0) nombres.push(t); });
          html += '<p class="li-cliente">Vista para enseñar a un cliente: sin avisos y sin ' + (nombres.length ? nombres.map(function (t) { return t.toLowerCase(); }).join(', ').replace(/, ([^,]*)$/, ' ni $1') : 'los datos privados') + '.</p>';
        }
        // Avisos: cuántas filas de la vista tiene cada uno; tocar uno filtra.
        var deVista = filtrar(ap, vista, todas, { hoy: hoy });
        var avs = vista.cliente ? [] : avisosActivos(ap).map(function (a) { return { a: a, n: filtrar(ap, vista, todas, { hoy: hoy, aviso: a.id }).length }; }).filter(function (x) { return x.n; });
        if (S.aviso && !avs.some(function (x) { return x.a.id === S.aviso; })) S.aviso = '';
        if (avs.length) html += '<div class="li-avisos" role="group" aria-label="Avisos">' + avs.map(function (x) {
          return '<button type="button" class="li-av li-' + texto(x.a.nivel || 'medio') + '" data-aviso="' + texto(x.a.id) + '" aria-pressed="' + (S.aviso === x.a.id) + '"><b>' + x.n + '</b> ' + texto(x.a.titulo) + '</button>';
        }).join('') + (S.aviso ? '<button type="button" class="u-btn u-btn-texto" data-aviso="">Ver todas</button>' : '') + '</div>';
        html += '<div class="li-buscar"><label class="u-oculto" for="li-q">Buscar</label><input id="li-q" type="search" placeholder="Buscar en ' + texto((ap.titulo || '').toLowerCase()) + '" value="' + texto(S.q) + '" autocomplete="off">' +
          (ap.crear && ap.editar ? '<button type="button" class="u-btn" data-nueva>Añadir</button>' : '') + '</div>';
        var fs = filtrar(ap, vista, todas, { hoy: hoy, q: S.q, aviso: S.aviso });
        html += '<p class="u-nota li-cuenta">' + (fs.length === deVista.length ? fs.length + (fs.length === 1 ? ' fila' : ' filas') : fs.length + ' de ' + deVista.length) + '</p>';
        if (!todas.length) html += '<p class="u-vacio">' + texto(ap.vacio || 'Todavía no hay nada en ' + (ap.titulo || '').toLowerCase() + '.') + '</p>';
        else if (!fs.length) html += '<p class="u-vacio">' + (S.q ? 'Nada con «' + texto(S.q) + '».' : 'Nada en esta vista.') + '</p>';
        else if (vista.tablero) html += pintarTablero(ap, vista, fs, hoy);
        else html += agrupar(ap, vista, fs, hoy).map(function (g) { return pintarGrupo(ap, vista, g, hoy); }).join('');
        var foco = document.activeElement && document.activeElement.id === 'li-q' ? document.activeElement.selectionStart : null;
        cont.innerHTML = html;
        if (foco !== null) { var q = cont.querySelector('#li-q'); q.focus(); try { q.setSelectionRange(foco, foco); } catch (e) {} }
      }
      /** Tablero: una columna por valor, con sus tarjetas; se arrastra de una a otra si ese campo se edita (y no es para clientes). */
      function pintarTablero(ap, vista, fs, hoy) {
        var cli = !!vista.cliente, fuera = ocultas(ap, vista), c = vista.tablero.campo, nom = ap.nombre || clave(ap);
        var mueve = !cli && editables(ap).indexOf(c) >= 0;
        var det = (ap.detalle || columnasDe(ap, vista)).filter(function (x) { return fuera.indexOf(x) < 0 && x !== nom && x !== c; }).slice(0, 3);
        var cp = campo(ap, c);
        return '<div class="li-tablero" data-campo="' + texto(c) + '">' + columnasTablero(ap, vista, fs).map(function (col) {
          var color = (cp.colores || {})[col.id] || '';
          return '<section class="li-col' + (color ? ' li-' + texto(color) : '') + '" data-valor="' + texto(col.id) + '"' + (mueve ? ' data-soltar' : '') + '>' +
            '<h2 class="li-col-t">' + texto(col.titulo) + ' <span class="u-cifra">' + col.filas.length + '</span></h2>' +
            (col.filas.length ? '<ul class="li-tarjetas li-col-l">' + col.filas.map(function (f) {
              var avs = cli ? [] : avisosDe(ap, f, hoy);
              return '<li><button type="button" class="li-tarjeta' + (avs.length ? ' li-f-' + texto(avs[0].nivel || 'medio') : '') + '" data-id="' + texto(f[clave(ap)]) + '"' + (mueve ? ' draggable="true"' : '') + '>' +
                '<strong>' + celda(ap, nom, f, false, cli) + '</strong>' +
                '<span class="li-det">' + det.map(function (x) { return '<span>' + celda(ap, x, f, false, cli) + '</span>'; }).join('') + '</span>' +
                (avs.length ? '<span class="li-marcas">' + marcas(avs) + '</span>' : '') + '</button></li>';
            }).join('') + '</ul>' : '<p class="u-nota li-col-vacia">Nada</p>') + '</section>';
        }).join('') + '</div>' + (mueve ? '<p class="u-nota li-col-ayuda">En el ordenador, arrastra una tarjeta a otra columna para cambiar su ' + texto(cp.titulo.toLowerCase()) + '. En el móvil, ábrela y cámbialo en su ficha.</p>' : '');
      }
      function pintarGrupo(ap, vista, g, hoy) {
        // En una vista para clientes no salen los avisos (son para quien trabaja) y un precio que falta es «a consultar».
        var cli = !!vista.cliente, fuera = ocultas(ap, vista), cols = columnasDe(ap, vista).filter(function (c) { return fuera.indexOf(c) < 0; });
        var nom = ap.nombre || clave(ap), det = (ap.detalle || []).filter(function (c) { return fuera.indexOf(c) < 0 && c !== nom; });
        var cab = g.titulo ? '<h2 class="n-grupo">' + texto(g.titulo) + ' <span class="u-cifra">' + g.filas.length + '</span></h2>' : '';
        // Ordenador: tabla. Móvil: una tarjeta por fila con el nombre, lo de debajo y los avisos.
        var tabla = '<div class="u-solo-ancho li-tabla"><table class="u-tabla"><thead><tr>' + cols.map(function (c) {
          var cp = campo(ap, c); return '<th' + (/importe|numero|porcentaje/.test(cp.tipo) ? ' class="num"' : '') + '>' + texto(cp.titulo) + '</th>';
        }).join('') + '</tr></thead><tbody>' + g.filas.map(function (f) {
          var avs = cli ? [] : avisosDe(ap, f, hoy);
          return '<tr tabindex="0" data-id="' + texto(f[clave(ap)]) + '"' + (avs.length ? ' class="li-con-aviso li-f-' + texto(avs[0].nivel || 'medio') + '"' : '') + '>' + cols.map(function (c, i) {
            var cp = campo(ap, c);
            return '<td class="' + (/importe|numero|porcentaje/.test(cp.tipo) ? 'num' : '') + (c === nom ? ' u-tabla-t' : '') + '">' + celda(ap, c, f, false, cli) +
              (i === 0 && avs.length ? '<div class="li-marcas">' + marcas(avs) + '</div>' : '') + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
        var tarjetas = '<ul class="u-solo-movil li-tarjetas">' + g.filas.map(function (f) {
          var avs = cli ? [] : avisosDe(ap, f, hoy);
          var debajo = det.length ? det : cols.filter(function (c) { return c !== nom; }).slice(0, 2);
          return '<li><button type="button" class="li-tarjeta' + (avs.length ? ' li-f-' + texto(avs[0].nivel || 'medio') : '') + '" data-id="' + texto(f[clave(ap)]) + '">' +
            '<strong>' + celda(ap, nom, f, false, cli) + '</strong>' +
            '<span class="li-det">' + debajo.map(function (c) { return '<span>' + celda(ap, c, f, false, cli) + '</span>'; }).join('') + '</span>' +
            (avs.length ? '<span class="li-marcas">' + marcas(avs) + '</span>' : '') + '</button></li>';
        }).join('') + '</ul>';
        return '<section class="li-grupo">' + cab + tabla + tarjetas + '</section>';
      }

      /* ---------- ficha ---------- */
      function abrirVentana(html) {
        vent.innerHTML = html;
        velo.classList.add('abierto');
        var h = vent.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      }
      function cerrarVentana() { velo.classList.remove('abierto'); vent.innerHTML = ''; }
      function editables(ap) {
        if (ap.editar === true) {
          var t = [ap.nombre].concat(ap.columnas || []); (ap.ficha || []).forEach(function (g) { t = t.concat(g.campos || []); });
          return t.filter(function (c, i) { return c && t.indexOf(c) === i && c !== clave(ap) && !campo(ap, c).calculo; });
        }
        return lista(ap.editar).filter(function (c) { return !campo(ap, c).calculo; });
      }
      function entrada(ap, c, f) {
        var cp = campo(ap, c), v = f ? f[c] : '', id = 'li-c-' + c;
        var et = '<label class="u-etiqueta" for="' + id + '">' + texto(cp.titulo) + '</label>';
        if (cp.opciones) {
          var ops = cp.opciones.slice(); if (!vacio(v) && ops.indexOf(String(v)) < 0) ops.unshift(String(v));
          return '<div class="u-campo">' + et + '<select id="' + id + '" data-c="' + texto(c) + '"><option value=""></option>' +
            ops.map(function (o) { return '<option' + (String(v) === o ? ' selected' : '') + '>' + texto(o) + '</option>'; }).join('') + '</select></div>';
        }
        if (cp.tipo === 'nota') return '<div class="u-campo u-ancho">' + et + '<textarea id="' + id + '" rows="3" data-c="' + texto(c) + '">' + texto(v) + '</textarea></div>';
        var tipo = cp.tipo === 'fecha' ? 'date' : (cp.tipo === 'email' ? 'email' : (cp.tipo === 'telefono' ? 'tel' : (cp.tipo === 'enlace' || cp.tipo === 'foto' ? 'url' : 'text')));
        var val = cp.tipo === 'fecha' && aFecha(v) ? (function (d) { return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); })(aFecha(v)) : (vacio(v) ? '' : String(v));
        return '<div class="u-campo">' + et + '<input id="' + id + '" type="' + tipo + '"' + (/importe|numero|porcentaje/.test(cp.tipo) ? ' inputmode="decimal"' : '') + ' data-c="' + texto(c) + '" value="' + texto(val) + '"></div>';
      }
      function ficha(ap, id, nueva) {
        var vista = vistaActual(ap), fuera = ocultas(ap, vista), f = nueva ? {} : filaDe(ap.tabla, id), hoy = hoyIso();
        if (!f) { ctx.aviso('Esa fila ya no está.'); return; }
        var ed = vista.cliente ? [] : editables(ap).filter(function (c) { return fuera.indexOf(c) < 0; });
        var nom = ap.nombre || clave(ap), grupos = ap.ficha && ap.ficha.length ? ap.ficha : [{ titulo: '', campos: columnasDe(ap, vista) }];
        var avs = nueva || vista.cliente ? [] : avisosDe(ap, f, hoy);
        var h = '<div class="li-ficha-cab"><h2 id="li-vt">' + (nueva ? 'Añadir · ' + texto(ap.titulo || '') : celda(ap, nom, f, false)) + '</h2>' +
          '<button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Cerrar"><svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
        if (avs.length) h += '<div class="li-ficha-avisos">' + marcas(avs) + '</div>';
        if (vista.cliente) h += '<p class="li-cliente">Ficha para enseñar a un cliente: sin datos privados.</p>';
        var puestos = [];
        h += '<form id="li-form" class="li-form" novalidate>' + grupos.map(function (g) {
          var cs = (g.campos || []).filter(function (c) { return fuera.indexOf(c) < 0 && (nueva ? ed.indexOf(c) >= 0 : true); });
          if (!cs.length) return '';
          var cuerpo = cs.map(function (c) {
            puestos.push(c);
            if (ed.indexOf(c) >= 0) return entrada(ap, c, f);
            var cp = campo(ap, c);
            return '<div class="li-dato' + (cp.tipo === 'nota' || cp.tipo === 'foto' ? ' u-ancho' : '') + '"><span class="u-etiqueta">' + texto(cp.titulo) + '</span><span class="li-valor">' + celda(ap, c, f, true, vista.cliente) + '</span>' +
              (cp.ayuda ? '<span class="u-nota">' + texto(cp.ayuda) + '</span>' : '') + '</div>';
          }).join('');
          return '<section class="li-fgrupo">' + (g.titulo ? '<h3 class="li-fg-t">' + texto(g.titulo) + '</h3>' : '') + '<div class="u-campos">' + cuerpo + '</div></section>';
        }).join('');
        // Lo que se edita y no está en ningún apartado de la ficha, al final.
        var resto = ed.filter(function (c) { return puestos.indexOf(c) < 0; });
        if (resto.length) h += '<section class="li-fgrupo"><div class="u-campos">' + resto.map(function (c) { return entrada(ap, c, f); }).join('') + '</div></section>';
        h += '<p class="u-error" id="li-err" role="alert" hidden></p>';
        if (ed.length) h += '<div class="n-botones"><button type="submit" class="u-btn u-btn-accion">' + (nueva ? 'Añadir' : 'Guardar') + '</button></div>';
        h += '</form>';
        if (!nueva && !vista.cliente) (ap.relacionados || []).forEach(function (r) {
          var otro = BASE.filter(function (a) { return a.id === r.apartado; })[0];
          if (!otro || !apartadoVisible(otro, ctx.perfil, ctx.admin)) return;
          var rs = relacionadas(r, f, filas(otro.tabla));
          if (otro.orden || r.orden) rs = rs.slice().sort(comparar(r.orden || otro.orden));
          var cols = r.columnas || (otro.columnas || []).slice(0, 3);
          h += '<section class="li-fgrupo"><h3 class="li-fg-t">' + texto(r.titulo || otro.titulo) + ' <span class="u-cifra">' + rs.length + '</span></h3>' +
            (rs.length ? '<ul class="li-rel">' + rs.slice(0, r.max || 20).map(function (x) {
              var ra = avisosDe(otro, x, hoy);
              return '<li><button type="button" class="li-rel-f" data-rel="' + texto(otro.id) + '" data-id="' + texto(x[clave(otro)]) + '">' +
                cols.map(function (c) { return '<span>' + celda(otro, c, x, false) + '</span>'; }).join('') + (ra.length ? marcas(ra) : '') + '</button></li>';
            }).join('') + '</ul>' : '<p class="u-vacio">' + texto(r.vacio || 'Nada todavía.') + '</p>') + '</section>';
        });
        abrirVentana(h);
        var form = vent.querySelector('#li-form');
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var err = vent.querySelector('#li-err'), cambios = {}, malos = [];
          [].forEach.call(form.querySelectorAll('[data-c]'), function (i) {
            var c = i.getAttribute('data-c'), v = i.value.trim(), cp = campo(ap, c);
            var p = prohibido(v, PROHIB); if (p.length) { malos = malos.concat(p); i.setAttribute('aria-invalid', 'true'); } else i.removeAttribute('aria-invalid');
            var antes = vacio(f[c]) ? '' : (cp.tipo === 'fecha' && aFecha(f[c]) ? i.defaultValue : String(f[c]));
            if (v !== antes) cambios[c] = cp.tipo === 'importe' || cp.tipo === 'numero' ? (v === '' ? '' : (isNaN(aNumero(v)) ? v : aNumero(v))) : v;
          });
          if (malos.length) { err.textContent = textoProhibido(malos.filter(function (k, i) { return malos.indexOf(k) === i; })); err.hidden = false; return; }
          if (!Object.keys(cambios).length) { cerrarVentana(); return; }
          var p = nueva ? T.crear(ap.tabla, cambios) : T.actualizar(ap.tabla, id, cambios);
          cerrarVentana();
          Promise.resolve(p).then(function () { ctx.aviso(nueva ? 'Añadido.' : 'Guardado.'); }, function (e) { ctx.aviso('No se ha guardado: ' + ((e && e.message) || e)); });
        });
      }

      /* ---------- personalizar ---------- */
      function guardarPref(p) {
        var txt = JSON.stringify(p);
        guardado(K + 'pref', txt);
        if (!cfg.PREFERENCIAS) { pintar(); ctx.aviso('Guardado en este dispositivo.'); return; }
        var hay = filaDe(cfg.PREFERENCIAS, CLAVE_PREF), v = {}; v.VALOR = txt;
        var pr = hay ? T.actualizar(cfg.PREFERENCIAS, CLAVE_PREF, v) : T.crear(cfg.PREFERENCIAS, (function () { var o = { VALOR: txt }; o.ID = CLAVE_PREF; return o; })());
        pintar();
        Promise.resolve(pr).then(function () { ctx.aviso('Guardado para todos.'); }, function (e) { ctx.aviso('No se ha guardado: ' + ((e && e.message) || e)); });
      }
      function personalizar() {
        var p = pref(), aps = aplicar(BASE, p), ap = apActual(aps), base = BASE.filter(function (a) { return a.id === ap.id; })[0];
        var pa = (p.apartados || {})[ap.id] || {}, conPref = aplicar(BASE, p).filter(function (a) { return a.id === ap.id; })[0];
        var ordenV = (base.vistas || []).slice().sort(function (a, b) { var o = lista(pa.vistas); var ia = o.indexOf(a.id), ib = o.indexOf(b.id); return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib); });
        var fuera = lista(pa.ocultas);
        function fila(id, tit, extra, i, n, grupo) {
          return '<li class="li-p-fila" data-g="' + grupo + '" data-id="' + texto(id) + '">' + extra + '<span class="li-p-t">' + texto(tit) + '</span>' +
            '<button type="button" class="u-btn u-btn-icono" data-sube aria-label="Subir ' + texto(tit) + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button type="button" class="u-btn u-btn-icono" data-baja aria-label="Bajar ' + texto(tit) + '"' + (i === n - 1 ? ' disabled' : '') + '>↓</button></li>';
        }
        var h = '<div class="li-ficha-cab"><h2 id="li-vt">Personalizar</h2><button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Cerrar"><svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
          '<p class="u-nota">' + (cfg.PREFERENCIAS ? 'Vale para todos los que usan la app.' : 'Se guarda en este dispositivo.') + '</p>' +
          '<section class="li-fgrupo"><h3 class="li-fg-t">Orden de los apartados</h3><ul class="li-p-lista">' +
          aps.map(function (a, i) { return fila(a.id, a.titulo || titulo(a.id), '', i, aps.length, 'ap'); }).join('') + '</ul></section>';
        if (ordenV.length > 1) h += '<section class="li-fgrupo"><h3 class="li-fg-t">Vistas de ' + texto(ap.titulo) + '</h3><p class="u-nota">La primera se abre al entrar. Quita las que no uses.</p><ul class="li-p-lista">' +
          ordenV.map(function (v, i) { return fila(v.id, v.titulo, '<input type="checkbox" data-ver aria-label="Ver ' + texto(v.titulo) + '"' + (fuera.indexOf(v.id) < 0 ? ' checked' : '') + '>', i, ordenV.length, 'vi'); }).join('') + '</ul></section>';
        if ((conPref.avisos || []).length) h += '<section class="li-fgrupo"><h3 class="li-fg-t">Avisos de ' + texto(ap.titulo) + '</h3><ul class="li-p-lista">' +
          conPref.avisos.map(function (a) {
            var usaDias = JSON.stringify(a.si || []).indexOf('dias"') >= 0;
            return '<li class="li-p-fila" data-g="av" data-id="' + texto(a.id) + '"><input type="checkbox" data-on aria-label="Avisar: ' + texto(a.titulo) + '"' + (a.activo !== false ? ' checked' : '') + '>' +
              '<span class="li-p-t">' + texto(a.titulo) + (a.texto ? '<small class="u-nota">' + texto(a.texto) + '</small>' : '') + '</span>' +
              (usaDias ? '<label class="li-p-dias">con <input type="number" min="0" max="365" inputmode="numeric" data-dias value="' + (a.dias === undefined ? 7 : a.dias) + '"> días</label>' : '') + '</li>';
          }).join('') + '</ul></section>';
        h += '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-guardar>Guardar</button><button type="button" class="u-btn u-btn-texto" data-defecto>Volver a como venía</button></div>';
        abrirVentana(h);
        vent.querySelector('[data-defecto]').addEventListener('click', function () { cerrarVentana(); guardarPref({}); });
        vent.querySelector('[data-guardar]').addEventListener('click', function () {
          var n = JSON.parse(JSON.stringify(p)); n.apartados = n.apartados || {};
          n.orden = [].map.call(vent.querySelectorAll('[data-g=ap]'), function (li) { return li.getAttribute('data-id'); });
          var q = n.apartados[ap.id] = n.apartados[ap.id] || {};
          var vis = vent.querySelectorAll('[data-g=vi]');
          if (vis.length) {
            q.vistas = [].map.call(vis, function (li) { return li.getAttribute('data-id'); });
            q.ocultas = [].filter.call(vis, function (li) { return !li.querySelector('[data-ver]').checked; }).map(function (li) { return li.getAttribute('data-id'); });
            if (q.ocultas.length === q.vistas.length) { ctx.aviso('Deja al menos una vista.'); return; }
          }
          q.avisos = q.avisos || {};
          [].forEach.call(vent.querySelectorAll('[data-g=av]'), function (li) {
            var d = li.querySelector('[data-dias]'), o = { activo: li.querySelector('[data-on]').checked };
            if (d && d.value !== '' && isFinite(+d.value)) o.dias = Math.max(0, Math.min(365, Math.round(+d.value)));
            q.avisos[li.getAttribute('data-id')] = o;
          });
          cerrarVentana();
          guardarPref(n);
        });
      }

      /* ---------- eventos ---------- */
      cont.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-ap],[data-vista],[data-aviso],[data-id],[data-pers],[data-nueva]');
        if (!t) return;
        if (t.hasAttribute('data-ap')) { S.ap = t.getAttribute('data-ap'); S.aviso = ''; S.q = ''; guardado(K + 'ap', S.ap); pintar(); return; }
        if (t.hasAttribute('data-vista')) { S.vista[S.ap] = t.getAttribute('data-vista'); S.aviso = ''; guardado(K + 'vistas', JSON.stringify(S.vista)); pintar(); return; }
        if (t.hasAttribute('data-aviso')) { var a = t.getAttribute('data-aviso'); S.aviso = S.aviso === a ? '' : a; pintar(); return; }
        if (t.hasAttribute('data-pers')) { personalizar(); return; }
        var aps = apartados(), ap = apActual(aps);
        if (t.hasAttribute('data-nueva')) { ficha(ap, null, true); return; }
        ficha(ap, t.getAttribute('data-id'));
      });
      cont.addEventListener('keydown', function (ev) {
        if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('tr[data-id]')) { ev.preventDefault(); ficha(apActual(apartados()), ev.target.getAttribute('data-id')); }
      });
      // Tablero: arrastrar una tarjeta a otra columna cambia ese campo (con la capa de tablas: al momento y por detrás).
      var arrastrada = null;
      cont.addEventListener('dragstart', function (ev) {
        var b = ev.target.closest && ev.target.closest('.li-tarjeta[draggable]'); if (!b) return;
        arrastrada = b.getAttribute('data-id'); b.classList.add('li-cogida');
        try { ev.dataTransfer.setData('text/plain', arrastrada); ev.dataTransfer.effectAllowed = 'move'; } catch (e) {}
      });
      cont.addEventListener('dragend', function () { arrastrada = null; [].forEach.call(cont.querySelectorAll('.li-cogida,.li-encima'), function (x) { x.classList.remove('li-cogida', 'li-encima'); }); });
      cont.addEventListener('dragover', function (ev) {
        var col = ev.target.closest && ev.target.closest('[data-soltar]'); if (!col || arrastrada === null) return;
        ev.preventDefault();
        [].forEach.call(cont.querySelectorAll('.li-encima'), function (x) { if (x !== col) x.classList.remove('li-encima'); });
        col.classList.add('li-encima');
      });
      cont.addEventListener('drop', function (ev) {
        var col = ev.target.closest && ev.target.closest('[data-soltar]'); if (!col || arrastrada === null) return;
        ev.preventDefault();
        var ap = apActual(apartados()), c = cont.querySelector('.li-tablero').getAttribute('data-campo'), v = col.getAttribute('data-valor'), id = arrastrada;
        arrastrada = null;
        var f = filaDe(ap.tabla, id);
        if (!f || norm(f[c]) === norm(v)) { pintar(); return; }
        var cambios = {}; cambios[c] = v;
        Promise.resolve(T.actualizar(ap.tabla, id, cambios)).then(function () { ctx.aviso('Movida a «' + (v || 'sin ' + campo(ap, c).titulo.toLowerCase()) + '».'); }, function (e) { ctx.aviso('No se ha movido: ' + ((e && e.message) || e)); });
      });
      cont.addEventListener('input', function (ev) { if (ev.target.id === 'li-q') { S.q = ev.target.value; pintar(); } });
      velo.addEventListener('click', function (ev) {
        if (ev.target === velo || ev.target.closest('[data-cerrar]')) { cerrarVentana(); return; }
        // Personalizar: subir y bajar un apartado o una vista.
        var b = ev.target.closest('[data-sube],[data-baja]');
        if (b) {
          var li = b.closest('li'), ul = li.parentNode;
          if (b.hasAttribute('data-sube') && li.previousElementSibling) ul.insertBefore(li, li.previousElementSibling);
          else if (b.hasAttribute('data-baja') && li.nextElementSibling) ul.insertBefore(li.nextElementSibling, li);
          [].forEach.call(ul.children, function (x, i) { x.querySelector('[data-sube]').disabled = i === 0; x.querySelector('[data-baja]').disabled = i === ul.children.length - 1; });
          b.focus();
          return;
        }
        var r = ev.target.closest('[data-rel]');
        if (r) { var otro = BASE.filter(function (a) { return a.id === r.getAttribute('data-rel'); })[0]; if (otro) ficha(otro, r.getAttribute('data-id')); }
      });
      teclaEsc = function (ev) { if (ev.key === 'Escape' && ctx.abierta() && velo.classList.contains('abierto')) cerrarVentana(); };
      document.addEventListener('keydown', teclaEsc);

      ctx.alCambiar(function (t) { if (tablas.indexOf(t) >= 0) pintar(); });
      if (!tablas.length) { S.leido = true; pintar(); return; }
      T.leer(tablas).then(function () { S.leido = true; pintar(); }, function (e) {
        cont.innerHTML = '<p class="u-error">No se han podido leer los datos: ' + texto((e && e.message) || e) + '</p>';
      });
    },
    cerrar: function () { if (teclaEsc) document.removeEventListener('keydown', teclaEsc); teclaEsc = null; }
  });
})();
