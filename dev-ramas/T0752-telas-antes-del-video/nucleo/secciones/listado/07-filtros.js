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
    { id: 'semana', titulo: 'Esta semana', desde: 1, hasta: 7 }, // T0727 (R21): como en el Excel de Telas
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
      // T0706: con columnas dichas, lo vacío va a la que lo lleva entre sus valores («Por empezar»: «», Contactado, Interesado).
      var v = vacio(f[c]) ? '' : String(f[c]), col = cols.filter(function (x) { return x.valores.map(norm).indexOf(norm(v)) >= 0; })[0] || null;
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
   *  valen: «ID_FACTURA.TIPO»); «quien», la ruta que dice con quién (su nombre); «cuando», la fecha, la más reciente.
   *  T0737: «estadoDe», la columna de esa fila que dice el estado (el de la muestra: «Muestra enviada»), con «estado» si
   *  está vacía, y «colores», el de cada valor (si no, «color»). */
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
        var es = j.estadoDe ? ver(x, j.estadoDe) : '';
        es = vacio(es) ? j.estado || '' : String(es);
        por[k] = { de: ij, quien: String(q), estado: es, color: (j.colores || {})[es] || j.color || '', cuando: cu };
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

