  /**
   * El código de una fila nueva con una plantilla: «{ID_DISENO}-{n:2}» → BOR-004-04 (cada {COLUMNA}, el valor de la fila
   * nueva; {n:k}, el número siguiente con k cifras entre los códigos que ya empiezan y acaban igual). Sin {n}, la plantilla
   * rellena tal cual («{ID_TELA}·{ID_MARCA}»). Si le falta una columna, ''. Con el prefijo de una tabla («M-», 3 cifras),
   * plantillaPrefijo da «M-{n:3}».
   */
  function nuevoId(plantilla, valores, existentes) {
    var falta = false;
    var r = String(plantilla || '').replace(/\{([A-Z0-9_]+)\}/g, function (_, c) {
      var v = valores ? valores[c] : '', s = vacio(v) ? '' : String(v).trim();
      if (!s) falta = true; // también uno en blanco: daría «-01»
      return s;
    });
    if (falta || !r) return '';
    var m = /\{n(?::(\d+))?\}/.exec(r);
    if (!m) return r;
    var antes = r.slice(0, m.index), despues = r.slice(m.index + m[0].length), k = +(m[1] || 1), max = 0;
    var re = new RegExp('^' + aRegex(antes) + '(\\d+)' + aRegex(despues) + '$');
    lista(existentes).forEach(function (id) { var x = re.exec(String(id)); if (x && +x[1] > max) max = +x[1]; });
    var n = String(max + 1);
    while (n.length < k) n = '0' + n;
    return antes + n + despues;
  }
  function plantillaPrefijo(p) { return p && p.prefijo ? p.prefijo + '{n:' + (p.digitos || 4) + '}' : ''; }
  /**
   * El código que tendrá una fila nueva de la tabla t: con NUEVO_ID (o «id» de lo relacionado), su plantilla; si no, con el
   * prefijo de la tabla (config._prefijos, de montar.js: el motor lo pone así), el siguiente. '' si no se sabe.
   */
  function codigoNuevo(plantilla, prefijos, t, valores, existentes) {
    return nuevoId(plantilla || plantillaPrefijo((prefijos || {})[t]), valores, existentes);
  }

  /** T0651 · ¿Es una ruta («ID_DISENO.ANCHO»)? */
  function esRuta(c) { return String(c).indexOf('.') > 0; }
  /**
   * Dónde se guarda un campo de la ficha: el suyo, en su fila; una ruta («ID_DISENO.ANCHO»), en la fila a la que llega (el
   * diseño de esa tela). → { tabla, id, columna, ruta, primero (la columna de esta fila que la une) } o null si no llega.
   */
  function destinoDe(ap, D, c, crudo) {
    crudo = crudo || {};
    if (!esRuta(c)) return { tabla: ap.tabla, id: crudo[ap.clave], columna: c, ruta: false, primero: c };
    var ps = String(c).split('.'), fila = crudo, tt = ap.tabla, id = '';
    for (var i = 0; i < ps.length - 1; i++) {
      var r = refDe(ap, tt, ps[i]);
      if (!r || !fila || vacio(fila[ps[i]])) return null;
      id = fila[ps[i]]; fila = D.fila(r, id); tt = r;
      if (!fila) return null;
    }
    return { tabla: tt, id: id, columna: ps[ps.length - 1], ruta: true, primero: ps[0] };
  }
  /**
   * Lo que dice un campo de una ruta al abrirlo: «Es de BOR-004: cambia también en 2 telas más.» (las otras filas de esta
   * tabla que comparten el primer salto: los otros colores del mismo diseño). Sin otras, «Es de BOR-004.».
   */
  function avisoRuta(ap, D, c, crudo) {
    if (!esRuta(c)) return '';
    var pri = String(c).split('.')[0], v = (crudo || {})[pri];
    if (vacio(v)) return '';
    var n = (D.filas(ap.tabla) || []).filter(function (x) { return String(x[pri]) === String(v) && String(x[ap.clave]) !== String(crudo[ap.clave]); }).length;
    var fs = ap.filas || ['fila', 'filas'];
    return 'Es de ' + v + (n ? ': cambia también en ' + n + ' ' + (n === 1 ? fs[0] : fs[1]) + ' más.' : '.');
  }

  /**
   * T0651 · BORRAR de la configuración: {} (no se borra), true o { con: [{ tabla, campo, filas }] (lo que se borra con ella: sus personas de
   * contacto), bloquean: [{ tabla, campo, filas, si }] (lo que no deja borrarla: su seguimiento), sino: { titulo, poner,
   * hecho } (lo que se ofrece en su lugar: Descartado) }. Sin BORRAR, null.
   */
  function borrarDe(x) {
    if (!x || (typeof x === 'object' && !Object.keys(x).length)) return null; // {}: no se borra (el defecto)
    var o = x === true ? {} : x, uno = function (y) { return y && y.tabla && y.campo ? { tabla: y.tabla, campo: y.campo, clave: y.clave || 'ID', filas: lista(y.filas).length >= 2 ? y.filas : ['fila', 'filas'], si: y.si || null, alFinal: !!y.alFinal } : null; };
    return { con: lista(o.con).map(uno).filter(Boolean), bloquean: lista(o.bloquean).map(uno).filter(Boolean),
      sino: o.sino && o.sino.poner ? { titulo: o.sino.titulo || 'Descartar', poner: o.sino.poner, hecho: o.sino.hecho || '' } : null, texto: o.texto || '' };
  }
  /** «1 persona de contacto», «3 cosas en su seguimiento». */
  function cuantas(n, fs) { return n + ' ' + (n === 1 ? fs[0] : fs[1]); }
  /** «a, b y c». */
  function yJuntos(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]; }
  /**
   * T0651 · Qué pasa al borrar esta fila (crudo): lo que no deja (paran: [{ tabla, n, texto }]) y lo que se va con ella
   * (van: [{ tabla, clave, ids, texto }]), con los datos que se tienen. El motor comprueba además, al borrar, que nada más
   * la use (y si algo la usa, no la borra y lo dice).
   */
  function queBorra(ap, D, crudo) {
    var b = ap.borrar; if (!b) return null;
    var id = (crudo || {})[ap.clave], de = function (x) {
      // T0714: con «alFinal», su código al final del texto («… · BOR-004-01», una línea de factura), como en «juntar».
      var es = function (t) { if (!x.alFinal) return String(t) === String(id); var m = /·\s*([^·]+)$/.exec(String(t == null ? '' : t)); return !!m && norm(m[1]) === norm(id); };
      return (D.filas(x.tabla) || []).filter(function (y) { return !vacio(id) && es(y[x.campo]) && (!x.si || cumple(y, x.si, {})); });
    };
    return {
      paran: b.bloquean.map(function (x) { var n = de(x).length; return { tabla: x.tabla, n: n, texto: cuantas(n, x.filas) }; }).filter(function (x) { return x.n > 0; }),
      van: b.con.map(function (x) { var fs = de(x); return { tabla: x.tabla, clave: x.clave, ids: fs.map(function (y) { return y[x.clave]; }), texto: cuantas(fs.length, x.filas) }; }).filter(function (x) { return x.ids.length > 0; })
    };
  }

  /**
   * T0724 (R07) · Lo que se va con la fila, como lo pide el motor (tablasBorrar con { con }): [{ tabla, campo }], sin repetir.
   * El motor comprueba antes todos los usos, también en las tablas que quien borra no ve (la Comparativa para Ayuda), y si
   * algo bloquea no borra nada. Así no se borran sus personas antes de saber si la marca se puede borrar.
   */
  function borrarCon(ap) {
    var b = ap && ap.borrar, out = [], vistos = {};
    (b ? b.con : []).forEach(function (x) { var k = x.tabla + '.' + x.campo; if (!vistos[k]) { vistos[k] = 1; out.push({ tabla: x.tabla, campo: x.campo }); } });
    return out;
  }
  /**
   * T0724 (para R18) · A qué sección lleva cada fila de lo relacionado: «seccion» es una (string) o una lista de { id, si }
   * (la primera cuyo «si» cumple la fila y que quien mira ve; un string en la lista, sin condición). → su id en mayúsculas o ''.
   * Así lo pendiente del seguimiento de una marca puede llevar a Hoy y lo hecho, a Historial.
   */
  function seccionesRel(r) {
    return lista(r && r.seccion).map(function (s) { return typeof s === 'string' ? { id: s, si: [] } : { id: String((s && s.id) || ''), si: lista(s && s.si) }; }).filter(function (s) { return s.id; });
  }
  function seccionDeFila(r, x, veo) {
    // T0731 (R18): las condiciones miran la fila como se ve («Hecha», «Nota»), no la de verdad (sus códigos: EST04, TSE03).
    var f = x || {};
    var s = seccionesRel(r).filter(function (y) { return (!y.si.length || cumple(f, y.si, {})) && (!veo || veo[y.id.toUpperCase()]); })[0];
    return s ? s.id.toUpperCase() : '';
  }
  /**
   * T0724 (R20) · Las columnas de la lista sin las que no dicen nada en ninguna fila: con «comun», si todas sus filas tienen lo
   * de siempre (todo es «Tarea»), la columna entera saldría vacía y no se pinta. Las demás, como estaban.
   */
  function sinComunes(ap, cols, fs, valores, prohib) {
    return cols.filter(function (c) {
      var cp = campo(ap, c), cm = cp.comun ? lista(cp.comun) : null;
      if (!cm || !fs.length) return true;
      return fs.some(function (f) { var t = verTexto(cp, f, valores, prohib); return t !== '' && cm.indexOf(t) < 0; });
    });
  }
  /** T0724 (R38) · «Todas» o «Todos» delante de las opciones de un filtro, según el campo («genero»: "f" en CAMPOS: Fase, Prioridad). */
  function palabraTodos(cp) { return cp && cp.genero === 'f' ? 'Todas' : 'Todos'; }
  function primeraMay(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  /**
   * T0724 (R35) · El «ID: ya hay un BOR-004 en DISENOS» del motor, en palabras de la sección: «BOR-004 ya está en sus diseños.»
   * o, si el código no lo ha escrito quien añade (sale de la plantilla: «DIS-001·FIB-002»), con el nombre de lo elegido: «Lino
   * ya está en composición.». o: { escritos: lo del formulario, nombre, donde: el título de lo relacionado }. Los demás
   * errores, sin su prefijo (VALIDAR:).
   */
  function yaEsta(msg, o) {
    o = o || {};
    var m = String((msg && msg.message) || msg || ''), x = /ya hay una? (.+?) en [A-Z0-9_]+\.?$/.exec(m);
    if (!x) return m.replace(/^[A-Z]+:\s*/, '');
    var cod = x[1], escrito = Object.keys(o.escritos || {}).some(function (k) { return String(o.escritos[k]).trim() === cod; });
    return primeraMay(escrito || !o.nombre ? cod : o.nombre) + ' ya está' + (o.donde ? ' en ' + String(o.donde).toLowerCase() : '') + '.';
  }
  /**
   * T0724 (R35) · Lo que ya está y no se vuelve a ofrecer al añadir lo relacionado: las columnas de su «id» (la plantilla,
   * «{ID_DISENO}·{ID_FIBRA}») que no son la que lo une, con los valores que ya tienen sus filas: { ID_FIBRA: ['FIB-002'] }.
   */
  function yaPuestos(r, rs) {
    var e = relEdicion(r), out = {};
    if (!e.id) return out;
    enPlantilla(e.id).filter(function (c) { return /^[A-Z0-9_]+$/.test(c) && c !== r.campo; }).forEach(function (c) {
      out[c] = lista(rs).map(function (y) { var v = ((y && y.__crudo) || y || {})[c]; return v == null ? '' : String(v); }).filter(function (v) { return v !== ''; });
    });
    return out;
  }
  /**
   * T0724 (R16) · El aviso de la configuración que no cuadra: a soporte (la cuenta de Utilo), la lista técnica; a quien
   * administra (Marta), una frase sin jerga. La lista va también en la consola y, escondida dentro del aviso, en lo que apunta
   * el uso de la app (nucleo/uso.js lee el texto entero de cada .u-error): por eso «Utilo ya lo sabe». Sin errores, ''.
   */
  var SOPORTE = /^utilo\.digital@gmail\.com$/i;
  function esSoporte(correo) { return SOPORTE.test(String(correo || '').trim()); }
  function htmlErrores(errores, soporte) {
    if (!errores || !errores.length) return '';
    if (soporte) return '<div class="u-bloque li-errores"><strong>La configuración de esta sección tiene cosas que no cuadran (solo lo ve soporte):</strong><ul>' + errores.map(function (e) { return '<li>' + texto(e) + '</li>'; }).join('') + '</ul></div>';
    return '<p class="u-error li-errores" role="status">Hay algo de esta sección que no se ha podido preparar. Utilo ya lo sabe.<span hidden> · ' + texto(errores.join(' · ')) + '</span></p>';
  }

  /**
   * T0651 · Lo que se puede hacer desde la ficha con lo relacionado (las personas de contacto de una marca): «editar» (sus
   * columnas, o true: las de «columnas» que no son rutas), «crear» (+ Añadir, con «alta»: las que pide, o las de editar),
   * «elegir» (añadir eligiendo una fila de la tabla a la que apunta esa columna: la tela que le interesa), «quitar» (con
   * confirmación y Deshacer), «id» (la plantilla del código, si su tabla no tiene prefijo), «obligatorias» y «filas» (cómo
   * se llama cada una: «+ Añadir persona de contacto»). La columna que la une (campo) no se edita: se pone sola.
   * T0728: «quitar»: "admin", solo quien administra (los precios propuestos a una marca: solo Marta); admin = si lo es quien ve.
   */
  function relEdicion(r, admin) {
    var ed = r.editar === true ? lista(r.columnas).filter(function (c) { return !esRuta(c); }) : lista(r.editar);
    ed = ed.filter(function (c, i) { return c !== r.campo && ed.indexOf(c) === i && !esRuta(c); });
    var crear = !!r.crear && !r.contiene, elegir = crear && r.elegir ? String(r.elegir) : '';
    var quitar = (r.quitar === 'admin' ? !!admin : !!r.quitar) && !r.contiene;
    return { editar: r.contiene ? [] : ed, crear: crear, elegir: elegir, quitar: quitar,
      alta: (lista(r.alta).length ? lista(r.alta) : ed).filter(function (c) { return c !== r.campo; }), obligatorias: lista(r.obligatorias),
      // La clave de su tabla (para cambiarla o quitarla): «claveTabla»; si no, ID cuando lleva a una sección (entonces «clave» es la
      // de la fila a la que lleva: la tela que le interesa) y, si no, su «clave» (NECESIDADES: ID_MARCA).
      filas: lista(r.filas).length >= 2 ? r.filas : ['fila', 'filas'], id: r.id || '', clave: r.claveTabla || (r.seccion ? 'ID' : r.clave || 'ID'),
      algo: !r.contiene && (ed.length > 0 || !!r.crear || quitar) };
  }
  /**
   * T0651 · La fila nueva de lo relacionado: lo escrito (sin lo vacío), la columna que la une (r.campo = el «con» de esta
   * fila) y su código, si lleva plantilla o su tabla prefijo conocido (si no, lo pone el motor). → { valores, faltan }.
   * T0738: idDe(columna, valor), si se pasa, da el código de lo de «poner» que apunta a otra tabla y va por su nombre
   * («Buscando» → ECO01); si no lo encuentra (undefined), no se pone.
   */
  function altaRelacionada(r, crudo, valores, existentes, prefijos, idDe) {
    var e = relEdicion(r), v = {};
    Object.keys(valores || {}).forEach(function (k) { if (!vacio(valores[k])) v[k] = typeof valores[k] === 'string' ? valores[k].trim() : valores[k]; });
    v[r.campo] = (crudo || {})[r.con || 'ID'];
    // T0737: «poner», lo que lleva siempre una fila nueva si no se ha escrito (la tela que le interesa: «Le interesa»).
    Object.keys(r.poner || {}).forEach(function (k) {
      if (!vacio(v[k])) return;
      var p = idDe ? idDe(k, r.poner[k]) : r.poner[k];
      if (p !== undefined) v[k] = p;
    });
    var faltan = e.obligatorias.filter(function (c) { return vacio(v[c]); });
    if (e.id) { var id = nuevoId(e.id, v, existentes); if (id) v[e.clave] = id; else if (!faltan.length) faltan.push(e.clave); }
    return { valores: v, faltan: faltan };
  }
  /**
   * T0651 · Lo que se puede elegir para añadir a lo relacionado (las telas que aún no le interesan a una marca): las filas de
   * la tabla a la que apunta «elegir», sin las que ya tiene, buscando q sin tildes ni mayúsculas en su código y en lo que
   * enseñan las columnas de lo relacionado («ID_TELA.COLOR» → su COLOR). → [{ id, texto }], hasta max.
   */
  function paraElegir(ap, D, r, ya, q, max) {
    var e = relEdicion(r), t = e.elegir ? refDe(ap, r.tabla, e.elegir) : '';
    if (!t) return [];
    var tiene = lista(ya).map(String), b = norm(q || '');
    var mas = lista(r.columnas).filter(function (c) { return c.indexOf(e.elegir + '.') === 0; }).map(function (c) { return c.slice(e.elegir.length + 1); });
    var out = [];
    (D.filas(t) || []).some(function (x) {
      var id = x.ID !== undefined ? x.ID : x[Object.keys(x)[0]];
      if (vacio(id) || tiene.indexOf(String(id)) >= 0) return false;
      var resto = mas.map(function (c) { return seguir(ap, D, t, x, c); }).filter(function (s) { return !vacio(s); });
      var nom = nombreDe(D, t, id), partes = [String(id)].concat(nom !== String(id) ? [nom] : [], resto);
      var txt = partes.filter(function (s, i) { return partes.indexOf(s) === i; }).join(' · ');
      if (b && norm(txt).indexOf(b) < 0) return false;
      out.push({ id: id, texto: txt });
      return out.length >= (max || 20);
    });
    return out;
  }
  /** T0651 · La palabra pequeña junto a la etiqueta de lo que no se edita en una ficha que sí: «calculado» o la del «ir» de un «de». */
  function sufijoFijo(cp) { return cp.calculo ? 'calculado' : (cp.de && cp.ir && cp.ir.texto ? String(cp.ir.texto) : ''); }

  var CALC = { pctVer: pctVer, pctEscrito: pctEscrito, deEscrito: deEscrito, nuevoId: nuevoId, altaNuevoDe: altaNuevoDe, codigoAltaNuevo: codigoAltaNuevo, plantillaPrefijo: plantillaPrefijo, codigoNuevo: codigoNuevo, esRuta: esRuta, destinoDe: destinoDe, avisoRuta: avisoRuta, borrarDe: borrarDe, queBorra: queBorra, borrarCon: borrarCon, seccionDeFila: seccionDeFila, seccionesRel: seccionesRel, plantillaPara: plantillaPara, sinMarcas: sinMarcas, sinComunes: sinComunes, palabraTodos: palabraTodos, yaEsta: yaEsta, yaPuestos: yaPuestos, esSoporte: esSoporte, htmlErrores: htmlErrores, cuantas: cuantas, yJuntos: yJuntos, relEdicion: relEdicion, altaRelacionada: altaRelacionada, paraElegir: paraElegir, sufijoFijo: sufijoFijo, dosOpciones: dosOpciones,
    fechaDia: fechaDia, webCorta: webCorta, webSitio: webSitio, textoCorto: textoCorto, gruposConQuien: gruposConQuien, nombreCorto: nombreCorto, deshacerEnOrden: deshacerEnOrden, guardadoSolo: guardadoSolo, loDiceUnAviso: loDiceUnAviso, contextoCol: contextoCol, resumenDe: resumenDe, opcionesPasar: opcionesPasar, fechasSiguiente: fechasSiguiente, rapidaEn: rapidaEn, siguienteCon: siguienteCon, queHacerAtras: queHacerAtras, dirFicha: dirFicha, cambiosHecha: cambiosHecha, conHablado: conHablado, deducidos: deducidos, filaSiguiente: filaSiguiente, codigoDe: codigoDe, diaCorto: diaCorto, masDias: masDias,
    textoVuelta: textoVuelta, QUITAR_DE_VUELTA: QUITAR_DE_VUELTA, conFicha: conFicha, mostrar: mostrar, cuentaInstagram: cuentaInstagram, instagramUrl: instagramUrl, imagen: imagen, fotoDeTarjeta: fotoDeTarjeta, SIN_FOTO: SIN_FOTO, sinRepetir: sinRepetir, franja: franja, nivelDeCampo: nivelDeCampo, columnaDelGrupo: columnaDelGrupo, titulo: titulo, aFecha: aFecha, diasHasta: diasHasta, aNumero: aNumero, esTelefono: esTelefono, telDe: telDe, cumple: cumple, calcular: calcular, usa: usa,
    valoresDe: valoresDe, resumenCifras: resumenCifras, arribaDe: arribaDe, filasArriba: filasArriba, rangoFechas: rangoFechas, lineaArriba: lineaArriba, cifrasResumen: cifrasResumen, seguirCrudo: seguirCrudo, tablasDeRuta: tablasDeRuta, conCamposPropios: conCamposPropios, prohibido: prohibido, tapar: tapar, num: num, textoProhibido: textoProhibido, apartado: apartado, sinOcultas: sinOcultas, campo: campo,
    ocultas: ocultas, vistasDe: vistasDe, vistaDeFila: vistaDeFila, enriquecer: enriquecer, preparar: preparar, seguir: seguir, conNombres: conNombres, nombradas: nombradas, columnasDe: columnasDe, comprobar: comprobar, aplicar: aplicar, accionesDe: accionesDe, recomendacionDe: recomendacionDe, camposCond: camposCond, irA: irA, ocultasDe: ocultasDe, mover: mover, paraClaude: paraClaude, cuenta: cuenta, textoDe: textoDe, repartir: repartir, valorCon: valorCon, columnasCon: columnasCon, cambioCampo: cambioCampo, textoCambio: textoCambio, miasDe: miasDe, equipoLimpio: equipoLimpio, hayMias: hayMias, esMia: esMia, nombrePara: nombrePara, conEquipo: conEquipo,
    avisosDe: avisosDe, avisosActivos: avisosActivos, avisosBarra: avisosBarra, filtrar: filtrar, agrupar: agrupar, columnasTablero: columnasTablero,
    relacionadas: relacionadas, juntarDe: juntarDe, partes: partes, verTexto: verTexto, rellenar: rellenar, enPlantilla: enPlantilla, veRelacionado: veRelacionado, expandir: expandir, camposTarjeta: camposTarjeta, desglose: desglose, cuando: cuando, comparar: comparar,
    filtrables: filtrables, aIntervalo: aIntervalo, cumpleFiltros: cumpleFiltros, filtrosQueValen: filtrosQueValen, textoFiltro: textoFiltro, sinVentas: sinVentas, deVentas: deVentas, sinCampos: sinCampos, htmlVentas: htmlVentas,
    compararCampo: compararCampo, siguienteOrden: siguienteOrden, plegados: plegados, POR_GRUPO: POR_GRUPO, POR_COLUMNA: POR_COLUMNA, EN_FICHA: EN_FICHA };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

