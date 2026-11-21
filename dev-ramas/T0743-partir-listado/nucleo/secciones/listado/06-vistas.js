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
  /** T0706 · Si un botón de ACCIONES se recomienda para esta fila: el primero de su «recomendar» ({ si, texto }) que cumple, o null. */
  function recomendacionDe(x, f, hoy) {
    return lista(x.recomendar).filter(function (r) { return r && cumple(f, r.si, { hoy: hoy }); })[0] || null;
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
    var nv = deEscrito(cp, s), pc = cp.tipo === 'porcentaje'; // T0714: un porcentaje, escrito en % y guardado como parte
    var igual = esNum && typeof nv === 'number' && antes !== '' && !isNaN(aNumero(antes)) ? (pc ? pctVer(nv) === pctVer(antes) : nv === aNumero(antes)) : s === antes;
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
  /** Los avisos encendidos; con vista, solo los que salen en ella (T0706: un aviso con «vistas» [ids], solo en esas). */
  function avisosActivos(ap, vista) {
    return (ap.avisos || []).filter(function (a) { return a.activo !== false && (!vista || !a.vistas || lista(a.vistas).indexOf(vista.id) >= 0); });
  }
  /** T0731 (R69) · Una vista con «"marcas": false» no pone el nombre de su aviso en cada fila: ya lo dicen los botones de arriba (la franja de color sigue). */
  function sinMarcas(vista) { return !!(vista && vista.marcas === false); }
  /** T0727 (R21) · Los avisos de la barra de arriba: en una vista agrupada por el plazo de una fecha, sin los que solo miran
   *  esa fecha («Con la fecha pasada», «Es para hoy», «Sin fecha»): ya son un grupo de la lista, con su número. */
  function avisosBarra(ap, vista) {
    var g = vista && vista.agrupar, c = g && g.por === 'plazo' ? g.campo : '';
    return avisosActivos(ap, vista).filter(function (a) { var cs = lista(a.si); return !c || !cs.length || !cs.every(function (x) { return x && x.campo === c; }); });
  }
  /** Los avisos que tiene una fila, en el orden del apartado (con vista, solo los de esa vista). */
  function avisosDe(ap, f, hoy, vista) {
    return avisosActivos(ap, vista).filter(function (a) { return cumple(f, a.si, { hoy: hoy, dias: a.dias === undefined ? 7 : a.dias }); });
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

