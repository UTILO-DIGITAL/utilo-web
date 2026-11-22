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
      crear: !!cfg.CREAR, texto: cfg.TEXTO || '', vacio: cfg.VACIO || '', antiguo: cfg.ANTIGUO === true, refs: cfg._refs || {}, filtro: cfg.FILTRO || [],
      nueva: cfg.NUEVA || {}, obligatorias: cfg.OBLIGATORIAS || [], filtros: cfg.FILTROS || [], filas: cfg.FILAS && cfg.FILAS.length ? cfg.FILAS : null,
      rapidas: rapidasDe(cfg.RAPIDAS), alta: cfg.ALTA && lista(cfg.ALTA.campos).length ? { campos: lista(cfg.ALTA.campos), mas: lista(cfg.ALTA.mas), titulo: cfg.ALTA.titulo || '', abrir: !!cfg.ALTA.abrir, nuevo: altaNuevoDe(cfg.ALTA.nuevo) } : null,
      deducir: cfg.DEDUCIR || {}, acciones: cfg.ACCIONES || [], contexto: contextoDe(cfg.CONTEXTO), resumen: resumenCifras(cfg.RESUMEN), arriba: arribaDe(cfg.ARRIBA),
      // T0689: la ficha guarda sola cada campo al cambiarlo; con GUARDAR: "boton", como antes (con «Guardar»). MIAS: Mías / Todas.
      guardar: cfg.GUARDAR === 'boton' ? 'boton' : 'solo', mias: miasDe(cfg.MIAS),
      // T0752: AYUDA: false, sin la línea que explica la vista (ni su «i» en el móvil); RAPIDO: false, sin el filtro rápido
      // en pastillas (sigue en Filtrar). Telas, para que la cabecera de cada sección tenga lo mismo y poco ruido.
      ayuda: cfg.AYUDA !== false, rapido: cfg.RAPIDO !== false,
      // T0651: borrar (dentro de «Más»), el código de una fila nueva (sin prefijo en su tabla) y los prefijos que da montar.js.
      borrar: borrarDe(cfg.BORRAR), nuevoId: cfg.NUEVO_ID || '', prefijos: cfg._prefijos || {} };
  }
  /**
   * T0710 · ARRIBA: lo de otra tabla que pide una decisión, arriba de la lista (las ferias a 45 días sin decidir, en Hoy).
   * Cada uno: { tabla, seccion, si: [condiciones], dias, fecha, fin, titulo: [columnas], debajo: [columnas], etiqueta: «… {dias}
   * …», botones: [{ titulo, poner: { COLUMNA: valor }, hecho }], ver }. «dias» es el de las condiciones con «dias»; {dias} en la
   * etiqueta, los que faltan hasta «fecha». Sin tabla, no va.
   */
  function arribaDe(x) {
    return lista(x).filter(function (a) { return a && typeof a === 'object' && a.tabla; }).map(function (a) {
      return { tabla: a.tabla, seccion: a.seccion || '', clave: a.clave || 'ID', si: lista(a.si), dias: typeof a.dias === 'number' ? a.dias : 7,
        fecha: a.fecha || '', fin: a.fin || '', titulo: lista(a.titulo).length ? lista(a.titulo) : ['NOMBRE'], debajo: lista(a.debajo),
        etiqueta: a.etiqueta || '', ver: a.ver || '', botones: lista(a.botones).filter(function (b) { return b && b.titulo && b.poner; }) };
    });
  }
  /** T0710 · Las filas de un ARRIBA que tocan hoy, de la fecha más cercana a la más lejana (sin fecha, al final). */
  function filasArriba(x, filas, hoy) {
    return (filas || []).filter(function (f) { return cumple(f, x.si, { hoy: hoy, dias: x.dias }); }).sort(function (a, b) {
      var da = x.fecha ? diasHasta(a[x.fecha], hoy) : null, db = x.fecha ? diasHasta(b[x.fecha], hoy) : null;
      return (da === null ? 1e9 : da) - (db === null ? 1e9 : db);
    });
  }
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  /** T0710 · Unas fechas en palabras: «del 12 al 15 de enero», «del 29 de enero al 2 de febrero», «el 3 de marzo» (con el año
   *  solo si no es el de hoy). Sin la primera, ''. */
  function rangoFechas(a, b, hoy) {
    var d = aFecha(a), e = aFecha(b), h = aFecha(hoy);
    if (!d) return '';
    var anio = function (x) { return h && x.getFullYear() !== h.getFullYear() ? ' de ' + x.getFullYear() : ''; };
    var dm = function (x) { return x.getDate() + ' de ' + MESES[x.getMonth()]; };
    if (!e || e <= d) return 'el ' + dm(d) + anio(d);
    if (d.getFullYear() !== e.getFullYear()) return 'del ' + dm(d) + anio(d) + ' al ' + dm(e) + anio(e);
    if (d.getMonth() === e.getMonth()) return 'del ' + d.getDate() + ' al ' + dm(e) + anio(e);
    return 'del ' + dm(d) + ' al ' + dm(e) + anio(e);
  }
  /** T0710 · Lo que se enseña de una fila de ARRIBA (ya como se ve): etiqueta, título, debajo. */
  function lineaArriba(x, f, hoy) {
    var d = x.fecha ? diasHasta(f[x.fecha], hoy) : null;
    var et = x.etiqueta.replace(/\{dias\}/g, d === null ? '' : String(d)).replace(/\ben 1 días\b/, 'mañana').replace(/\ben 0 días\b/, 'hoy');
    var r = x.fecha ? rangoFechas(f[x.fecha], x.fin ? f[x.fin] : '', hoy) : '';
    var debajo = (r ? [r.charAt(0).toUpperCase() + r.slice(1)] : []).concat(x.debajo.map(function (c) { return vacio(f[c]) ? '' : String(f[c]); }).filter(Boolean));
    return { etiqueta: et, titulo: x.titulo.map(function (c) { return vacio(f[c]) ? '' : String(f[c]); }).filter(Boolean).join(' · '), debajo: debajo.join(' · ') };
  }
  /** T0708 · RESUMEN de la configuración: { cifras: [{ tabla, filas: [singular, plural] }], texto }; null sin ninguna cifra. */
  function resumenCifras(r) {
    var cs = (r && Array.isArray(r.cifras) ? r.cifras : []).filter(function (x) { return x && x.tabla; });
    return cs.length ? { cifras: cs, texto: typeof r.texto === 'string' ? r.texto : '' } : null;
  }
  /** T0708 · Las cifras del resumen: cuántas filas tiene cada tabla, todas (no las de la vista), con su nombre.
   *  T0734: una cifra con «si» cuenta solo las filas que lo cumplen (sus campos pueden ser rutas, «ID_DISENO.ID_PROVEEDOR»,
   *  que se miran con el código) y, si no hay ninguna, no sale: «21 sin proveedor». */
  function cifrasResumen(ap, D) {
    if (!ap.resumen) return [];
    return ap.resumen.cifras.map(function (x) {
      var fs = D.filas(x.tabla) || [], f = x.filas && x.filas.length === 2 ? x.filas : ['fila', 'filas'];
      var si = lista(x.si), rutas = camposCond(si).filter(function (c) { return c.indexOf('.') > 0; });
      if (si.length) fs = fs.filter(function (fila) {
        var g = fila;
        if (rutas.length) { g = {}; Object.keys(fila).forEach(function (k) { g[k] = fila[k]; }); rutas.forEach(function (r) { g[r] = seguirCrudo(ap, D, x.tabla, fila, r); }); }
        return cumple(g, si);
      });
      return si.length && !fs.length ? null : { n: fs.length, nombre: fs.length === 1 ? f[0] : f[1] };
    }).filter(Boolean);
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
      hoy: !!r.CERRAR_HOY, hablado: r.HABLADO || '', // T0732 (R23, R74)
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
  /**
   * T0717 · SOLO_LEER: quien está ahí (y no administra) ve la sección entera, pero sin nada que cambie: sin «Añadir» (CREAR,
   * ALTA), sin «Borrar», sin editar la ficha ni tocando (EDITAR, que también quita arrastrar en el tablero), sin cerrar ni pasar
   * (RAPIDAS), sin los botones que cambian la fila o lo de arriba (ACCIONES con «poner», ARRIBA), sin cambiar lo de dentro de
   * la ficha (RELACIONADOS) y sin personalizar. Los botones que llevan a otra sección («ir») se quedan. El motor tampoco le deja.
   * Con _soloMirar: true, para decirlo en la pantalla. me: { admin, perfil }.
   */
  function soloMirar(cfg, me) {
    if (!cfg || !me || me.admin || lista(cfg.SOLO_LEER).indexOf(me.perfil) < 0) return cfg;
    var c = JSON.parse(JSON.stringify(cfg));
    c.EDITAR = []; c.CREAR = false; c.BORRAR = {}; c.RAPIDAS = {}; c.ALTA = {}; c.PERSONALIZAN = [];
    c.ACCIONES = lista(c.ACCIONES).filter(function (x) { return x && x.ir; }).map(function (x) { delete x.poner; return x; });
    c.RELACIONADOS = lista(c.RELACIONADOS).map(function (r) { if (r && typeof r === 'object') { delete r.editar; delete r.crear; delete r.quitar; delete r.elegir; delete r.poner; } return r; });
    c.ARRIBA = lista(c.ARRIBA).map(function (x) { if (x && typeof x === 'object') x.botones = []; return x; });
    c._soloMirar = true;
    return c;
  }
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
    // T0710: ni lo de arriba de una tabla oculta (las ferias, en el Hoy de Ayuda).
    if (Array.isArray(c.ARRIBA)) c.ARRIBA = c.ARRIBA.filter(function (x) { return !(x && oculta(x.tabla)); });
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
  /**
   * T0714 · ALTA.nuevo: al dar de alta, elegir una fila de la tabla a la que apunta un campo o crearla a la vez (el diseño de
   * una tela nueva, con su proveedor). { campo: "ID_DISENO", titulo: "Diseño nuevo", ya: "Uno que ya tengo", campos: [rutas
   * de ese campo: "ID_DISENO.ID_PROVEEDOR"…], obligatorias: [de esas], codigo: { segun: "ID_TECNICA", cifras: 3, titulo } }.
   */
  function altaNuevoDe(x) {
    if (!x || typeof x !== 'object' || !x.campo) return null;
    var c = String(x.campo), k = x.codigo || {}, cs = lista(x.campos).map(String);
    return { campo: c, titulo: x.titulo || 'Nuevo', ya: x.ya || 'Uno que ya tengo', campos: cs, obligatorias: lista(x.obligatorias).map(String),
      codigo: { segun: k.segun ? String(k.segun) : '', cifras: Math.max(1, +k.cifras || 3), titulo: k.titulo || 'Letras del código' } };
  }
  /**
   * T0714 · El código de la fila nueva de ALTA.nuevo (un diseño): las letras de los de su mismo «segun» (los otros diseños
   * de esa técnica: BOR) y el número siguiente entre todos los que empiezan así (BOR-005). Si no hay ninguno de esa técnica
   * (o no la ha elegido), con las letras escritas («jaq» → JAQ-001). → { codigo, pedir: si hacen falta las letras }.
   */
  function codigoAltaNuevo(nv, filasT, valores, letras, clave) {
    clave = clave || 'ID';
    var seg = nv.codigo.segun, v = seg && valores ? valores[seg] : '', cuenta = {};
    if (!vacio(v)) lista(filasT).forEach(function (x) {
      if (String(x[seg]) !== String(v)) return;
      var m = /^([A-Za-z]+)-\d+$/.exec(String(x[clave] || '').trim());
      if (m) { var l = m[1].toUpperCase(); cuenta[l] = (cuenta[l] || 0) + 1; }
    });
    var suyas = Object.keys(cuenta).sort(function (p, q) { return cuenta[q] - cuenta[p] || (p < q ? -1 : 1); });
    var pre = suyas[0] || norm(letras).toUpperCase().replace(/[^A-Z]/g, '');
    if (!pre) return { codigo: '', pedir: true };
    return { codigo: nuevoId(pre + '-{n:' + nv.codigo.cifras + '}', {}, lista(filasT).map(function (x) { return x[clave]; })), pedir: !suyas.length };
  }
