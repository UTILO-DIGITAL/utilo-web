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
        else {
          [v.galeria.foto, v.galeria.titulo, v.galeria.cifra].concat(lista(v.galeria.debajo)).forEach(function (c) { if (c) hay(c, 'el muestrario de la vista «' + v.id + '» usa'); });
          // T0730: «avisoSinCifra», el id de uno de sus AVISOS.
          if (v.galeria.avisoSinCifra !== undefined && !ap.avisos.some(function (x) { return x.id === v.galeria.avisoSinCifra; })) errores.push(donde + 'el muestrario de la vista «' + v.id + '»: avisoSinCifra «' + v.galeria.avisoSinCifra + '» no es ninguno de sus avisos (' + ap.avisos.map(function (x) { return x.id; }).join(', ') + ').');
        }
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
      camposCond(a.si).forEach(function (c) { hay(c, 'el aviso «' + a.id + '» usa'); });
      // T0706: «vistas», las vistas en las que sale (si no lo dice, en todas).
      lista(a.vistas).forEach(function (v) { if (!vids[v]) errores.push(donde + 'el aviso «' + a.id + '» sale en la vista «' + v + '», que no está.'); });
    });
    // T0706: «recomendar» de un botón de ACCIONES: [{ si, texto, aviso }], cuándo se recomienda (arriba en la ficha, con su porqué).
    lista(ap.acciones).forEach(function (x) {
      lista(x.recomendar).forEach(function (r) {
        var t = 'el botón «' + (x.titulo || '') + '»';
        if (!r || typeof r !== 'object' || !r.si || !r.texto) { errores.push(donde + t + ': cada «recomendar» lleva «si» (cuándo) y «texto» (por qué).'); return; }
        if (x.ir) errores.push(donde + t + ' lleva a otra sección: «recomendar» es para los que cambian la fila.');
        camposCond(r.si).forEach(function (c) { hay(c, t + ' recomienda con'); });
        if (r.aviso && !aids[r.aviso]) errores.push(donde + t + ' recomienda con el aviso «' + r.aviso + '», que no está.');
      });
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
      // T0732 (R23): cerrar antes de tiempo deja la fecha de hoy; (R74) lo hablado, en su columna, se pregunta con el siguiente paso.
      if (rp.hoy && !(rp.hecha && rp.pasar)) errores.push(donde + 'RAPIDAS.CERRAR_HOY pone la fecha de hoy al cerrar: hacen falta HECHA y PASAR.');
      if (rp.hablado) {
        hay(rp.hablado, 'RAPIDAS.HABLADO usa');
        if (!sePuede(rp.hablado)) errores.push(donde + 'RAPIDAS.HABLADO escribe en «' + rp.hablado + '», que no está en EDITAR.');
        if (!rp.siguiente) errores.push(donde + 'RAPIDAS.HABLADO se pregunta con el siguiente paso: hace falta RAPIDAS.SIGUIENTE.');
      }
    }
    if (puesto(cfg.ALTA) && !ap.alta) errores.push(donde + 'ALTA no dice sus campos (campos).');
    if (ap.alta) ap.alta.campos.concat(ap.alta.mas).forEach(function (c) {
      var d = ap.campos[c];
      if (d && d.primero) { d.primero.forEach(function (p) { hay(p, 'ALTA usa'); if (!sePuede(p)) errores.push(donde + 'ALTA pide «' + c + '», pero «' + p + '» no está en EDITAR.'); }); return; }
      hay(c, 'ALTA usa');
      if (!sePuede(c)) errores.push(donde + 'ALTA pide «' + c + '», que no está en EDITAR.');
    });
    // T0714: ALTA.nuevo (el diseño nuevo de una tela): un campo del alta que apunta a otra tabla y lo suyo, rutas de ese campo.
    if (puesto(cfg.ALTA) && cfg.ALTA.nuevo !== undefined) {
      var nv = ap.alta && ap.alta.nuevo;
      if (!nv) errores.push(donde + 'ALTA.nuevo es { "campo": "ID_DISENO", "campos": ["ID_DISENO.ID_PROVEEDOR"…] }.');
      else {
        if (ap.alta.campos.indexOf(nv.campo) < 0) errores.push(donde + 'ALTA.nuevo.campo «' + nv.campo + '» no está en ALTA.campos.');
        if (Object.keys(ap.refs).length && !refDe(ap, ap.tabla, nv.campo)) errores.push(donde + 'ALTA.nuevo.campo «' + nv.campo + '» no apunta a otra tabla.');
        if (!nv.campos.length) errores.push(donde + 'ALTA.nuevo no dice qué pide (campos).');
        nv.campos.forEach(function (c) { if (c.indexOf(nv.campo + '.') !== 0 || c.split('.').length !== 2) errores.push(donde + 'ALTA.nuevo.campos: «' + c + '» no es una columna de ' + nv.campo + ' («' + nv.campo + '.ANCHO»).'); });
        nv.obligatorias.forEach(function (c) { if (nv.campos.indexOf(c) < 0) errores.push(donde + 'ALTA.nuevo.obligatorias: «' + c + '» no está en sus campos.'); });
        if (nv.codigo.segun && nv.campos.indexOf(nv.campo + '.' + nv.codigo.segun) < 0) errores.push(donde + 'ALTA.nuevo.codigo.segun «' + nv.codigo.segun + '» no se pide en sus campos (' + nv.campo + '.' + nv.codigo.segun + ').');
      }
    }
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
      // T0734: lo que mira su «si», columnas de esa tabla (el primer paso de una ruta).
      var cs = columnasTabla ? columnasTabla(x.tabla) : null;
      if (cs) camposCond(x.si).forEach(function (c) {
        var p0 = String(c).split('.')[0];
        if (cs.indexOf(p0) < 0) errores.push(donde + 'RESUMEN.cifras[' + i + '] (' + x.tabla + '): su «si» mira «' + c + '», y ' + p0 + ' no es una columna de ' + x.tabla + '.');
      });
    });
    // T0710: lo de arriba (otra tabla): sus columnas y lo que ponen sus botones.
    ap.arriba.forEach(function (x, i) {
      var cs = columnasTabla ? columnasTabla(x.tabla) : null, dd = donde + 'ARRIBA[' + i + '] (' + x.tabla + ')';
      if (!cs) return;
      var mira = function (c, que) { if (c && cs.indexOf(c) < 0) errores.push(dd + ': ' + que + ' «' + c + '», que no es una columna de ' + x.tabla + '.'); };
      x.si.forEach(function (c) { mira(c && c.campo, 'una condición mira'); });
      [x.fecha, x.fin].concat(x.titulo, x.debajo).forEach(function (c) { mira(c, 'enseña'); });
      x.botones.forEach(function (b) { Object.keys(b.poner).forEach(function (c) { mira(c, '«' + b.titulo + '» pone'); }); });
      if (!x.si.length) errores.push(dd + ' no dice en «si» qué filas salen: saldrían todas.');
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
          if (cj) [j.campo, String(j.quien).split('.')[0]].concat(j.cuando ? [String(j.cuando).split('.')[0]] : [], j.estadoDe ? [String(j.estadoDe).split('.')[0]] : []).forEach(function (x) { hay(x, qj + ' usa', j.tabla, cj); });
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
      // T0724: «seccion» por fila, una lista de secciones o de { id, si }.
      if (r.seccion && typeof r.seccion !== 'string' && seccionesRel(r).length !== lista(r.seccion).length) errores.push(donde + q + ': cada «seccion» es el nombre de una sección o { "id", "si" }.');
      // T0731 (R68): «tras», el título de un apartado de FICHA, para salir justo detrás de él; sin edición dentro (va en el formulario).
      if (r.tras !== undefined && !(ap.ficha || []).some(function (g) { return g && g.titulo === r.tras; })) errores.push(donde + q + ': «tras» es el título de un apartado de FICHA («' + r.tras + '» no lo es).');
      if (r.tras !== undefined && (r.editar || r.crear || r.quitar)) errores.push(donde + q + ': con «tras» no se edita desde la ficha.');
      // T0731 (R19): una plantilla por casos dice según qué campo y trae algún caso.
      Object.keys(r.campos || {}).forEach(function (c) { var pl = r.campos[c].plantilla; if (pl && typeof pl === 'object' && (!pl.segun || !plantillasDe(pl).length)) errores.push(donde + q + ': la plantilla de ' + c + ' por casos necesita «segun» y algún caso.'); });
      // T0641: en una «tarjeta», cada campo es una columna de esa tabla, una ruta o uno de sus «campos» (calculado, plantilla, «de»).
      if (cs && r.tarjeta) camposTarjeta(r).forEach(function (c) {
        var d = (r.campos || {})[c];
        if (!(d && (d.calculo || d.plantilla || d.de || d.primero))) hay(String(c).split('.')[0], q + ' usa', r.tabla, cs);
      });
      // T0651: lo que se edita, se añade o se elige desde la ficha, columnas de esa tabla; con «tarjeta» o «contiene», no se edita.
      // T0738: con «tarjeta», sí se añade («crear»: la comparativa de una marca), pero no se edita ni se quita.
      if (r.editar || r.crear || r.quitar) {
        var e = relEdicion(r);
        if (r.contiene || r.juntar) errores.push(donde + q + ': con «' + (r.contiene ? 'contiene' : 'juntar') + '» no se edita desde la ficha.');
        else if (r.tarjeta && (r.editar || r.quitar)) errores.push(donde + q + ': con «tarjeta» solo se añade («crear») desde la ficha: ni «editar» ni «quitar».');
        if (r.tarjeta && r.elegir) errores.push(donde + q + ': con «tarjeta» no se añade eligiendo («elegir»): se pide con «alta».');
        if (cs) e.editar.concat(e.crear ? e.alta : [], e.elegir ? [e.elegir] : [], e.obligatorias).forEach(function (c) { hay(c, q + ' edita', r.tabla, cs); });
        if (cs) Object.keys(r.poner || {}).forEach(function (c) { hay(c, q + ' pone', r.tabla, cs); }); // T0737
        if (e.crear && !e.elegir && !e.alta.length) errores.push(donde + q + ': «crear» necesita lo que se pide al añadir («alta» o «editar»).');
        if (r.elegir && !r.crear) errores.push(donde + q + ': «elegir» va con «crear».');
        if (r.quitar != null && r.quitar !== true && r.quitar !== false && r.quitar !== 'admin') errores.push(donde + q + ': «quitar» es true o "admin" (solo quien administra).');
        if (e.crear && lista(r.filas).length < 2) errores.push(donde + q + ': «crear» lleva «filas» (cómo se llama cada una: ["persona de contacto", "personas de contacto"]), para «+ Añadir …».');
        if (e.id && cs) enPlantilla(e.id).filter(function (c) { return /^[A-Z0-9_]+$/.test(c); }).forEach(function (c) { hay(c, q + ': «id» usa', r.tabla, cs); });
      }
    });
    // T0651: BORRAR (lo que se va con ella y lo que no deja borrarla, columnas de su tabla) y NUEVO_ID (columnas de esta tabla).
    if (borrarDe(cfg.BORRAR)) {
      if (cfg.BORRAR !== true && (typeof cfg.BORRAR !== 'object' || Array.isArray(cfg.BORRAR))) errores.push(donde + 'BORRAR es true o { "con": […], "bloquean": […], "sino": { … } }.');
      else if (cfg.BORRAR !== true) {
        ['con', 'bloquean'].forEach(function (k) {
          lista(cfg.BORRAR[k]).forEach(function (x, i) {
            var dd = 'BORRAR.' + k + '[' + i + ']';
            if (!x || !x.tabla || !x.campo) { errores.push(donde + dd + ' necesita «tabla» y «campo».'); return; }
            var cs = columnasTabla ? columnasTabla(x.tabla) : null;
            if (columnasTabla && !cs) errores.push(donde + dd + ': la tabla ' + x.tabla + ' no está.');
            else hay(x.campo, dd + ' usa', x.tabla, cs);
            if (lista(x.filas).length < 2) errores.push(donde + dd + ' lleva «filas» (["persona de contacto", "personas de contacto"]), para decir cuántas.');
          });
        });
        var sn = cfg.BORRAR.sino;
        if (sn && (!sn.poner || typeof sn.poner !== 'object')) errores.push(donde + 'BORRAR.sino necesita «poner»: { COLUMNA: valor }.');
        else if (sn) Object.keys(sn.poner).forEach(function (c) { hay(c, 'BORRAR.sino pone'); });
      }
    }
    if (ap.nuevoId) {
      if (!/\{n(:\d+)?\}/.test(ap.nuevoId) && !enPlantilla(ap.nuevoId).length) errores.push(donde + 'NUEVO_ID «' + ap.nuevoId + '» no lleva ni columnas ({ID_DISENO}) ni el número ({n:2}): todas las filas tendrían el mismo código.');
      enPlantilla(ap.nuevoId).filter(function (c) { return /^[A-Z0-9_]+$/.test(c); }).forEach(function (c) { hay(c, 'NUEVO_ID usa'); });
    }
    // Una ruta que se edita tiene que llegar a otra tabla por referencias (su primer paso ya lo mira «hay»).
    ed.filter(esRuta).forEach(function (c) { if (ap.campos[c] && (ap.campos[c].calculo || ap.campos[c].de)) errores.push(donde + '«' + c + '» se calcula, no se edita.'); });
    return errores;
  }

