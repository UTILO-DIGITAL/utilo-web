  /** El campo de un apartado, con su título y tipo por defecto (una columna FECHA… es una fecha; ESTADO, un estado). */
  function campo(ap, c) {
    var d = (ap.campos || {})[c] || {};
    var base = String(c).split('.').pop();
    var tipo = d.tipo || (d.calculo ? 'importe' : (d.de && !d.de.columna && !d.de.columnas ? 'numero' : (/^FECHA/.test(base) ? 'fecha' : (/^(ID_)?ESTADO$/.test(base) ? 'estado' : 'texto'))));
    return { n: c, titulo: d.titulo || (c === ap.codigo ? 'Código' : titulo(base)), tipo: tipo, opciones: d.opciones || null, ref: d.ref || refDe(ap, ap.tabla, c), ids: d._ids || null,
      de: d.de || null, primero: d.primero || null, grupos: d.grupos || null,
      unidad: d.unidad || '', calculo: d.calculo ? expandir(d.calculo, ap.campos, [c]) : null, precio: d.precio || null, envio: d.calculo ? envioDe(d) || conEnvio(d.calculo, ap.campos, [c]) : null, privado: !!d.privado, colores: d.colores || null,
      ayuda: d.ayuda || '', sinNumero: !!d.sinNumero, nombres: d.nombres || null, comun: d.comun || null, signo: d.signo || null, desglose: d.desglose || null, plantilla: d.plantilla || '', varios: !!d.varios,
      palabras: Array.isArray(d.palabras) && d.palabras.length >= 2 ? d.palabras : null,
      ir: d.ir && d.ir.seccion ? { seccion: String(d.ir.seccion), texto: d.ir.texto || '' } : null, // T0651: un «de» que lleva a su fila
      genero: d.genero === 'f' ? 'f' : '', // T0724 (R38): «Todas» en su filtro (Fase, Prioridad)
      siVacio: d.siVacio ? String(d.siVacio) : '', // T0731 (R67, R71): lo que dice en una lista si está vacío («Contacto», «Sin nada pendiente»)
      soloAlta: !!d.soloAlta }; // T0651: se elige al dar de alta y después no se cambia (el diseño de una tela: su código sale de él)
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
    ap.avisos.forEach(function (a) { t = t.concat(camposCond(a.si)); });
    lista(ap.acciones).forEach(function (x) { lista(x.recomendar).forEach(function (r) { t = t.concat(camposCond(r && r.si)); }); }); // T0706
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
    // T0651: una ruta que se edita («ID_DISENO.ID_TECNICA») que acaba en otra tabla, con sus opciones como las demás.
    lista(a.editar).concat(a.alta && a.alta.nuevo ? a.alta.nuevo.campos : []).filter(esRuta).forEach(function (c) { // T0714: también las del diseño nuevo
      var ps = c.split('.'), tt = a.tabla;
      for (var i = 0; i < ps.length - 1 && tt; i++) tt = refDe(a, tt, ps[i]);
      var t = tt && refDe(a, tt, ps[ps.length - 1]);
      if (!t) return;
      var d = a.campos[c] = a.campos[c] || {}, fs = (D.filas(t) || []).slice();
      if (fs.length && 'ORDEN' in fs[0]) fs.sort(comparar('ORDEN'));
      d._ids = {};
      var ops = fs.map(function (x) { var k = x.ID !== undefined ? x.ID : x[Object.keys(x)[0]], n = nombreDe(D, t, k); d._ids[n] = k; return n; });
      if (!d.opciones) d.opciones = ops;
      d.ref = t;
    });
    return a;
  }
  /** T0641 · Los campos que nombra una plantilla («Hoy {PRECIO_A_BATIR}[ ({ID_COMPETIDOR})]»). T0731: también las de cada caso y su «segun». */
  function enPlantilla(p) {
    if (p && typeof p === 'object') { var t = [p.segun]; plantillasDe(p).forEach(function (x) { t = t.concat(enPlantilla(x)); }); return t.filter(Boolean); }
    var r = [], m, re = /\{([^{}]+)\}/g; while ((m = re.exec(String(p)))) r.push(m[1]); return r;
  }
  /** T0731 · Las plantillas de una plantilla por casos: las de «casos» y la de «otro». */
  function plantillasDe(p) { return Object.keys((p && p.casos) || {}).map(function (k) { return p.casos[k]; }).concat(p && p.otro ? [p.otro] : []); }
  /**
   * T0731 (R19) · La plantilla que toca a una fila: un texto, tal cual; o { "segun": "ID_TIPO_PRECIO", "casos": { "Objetivo":
   * "Su objetivo: {…}", "Catálogo": "En catálogo…" }, "otro": "Hoy paga {…}" }, la del caso que dice ese campo de la fila (como
   * se ve, sin mayúsculas ni tildes) y, si no es ninguno o está vacío, «otro» (sin «otro», nada).
   */
  function plantillaPara(p, f) {
    if (!p || typeof p !== 'object') return p || '';
    var v = norm(f ? f[p.segun] : ''), k = Object.keys(p.casos || {}).filter(function (x) { return v && norm(x) === v; })[0];
    return k !== undefined ? p.casos[k] : (p.otro || '');
  }
  /**
   * T0641 · Una plantilla rellenada: cada {CAMPO}, como se ve (con su unidad; un calculado que no da número, vacío). Lo que va
   * entre [corchetes] solo sale si todo lo de dentro tiene algo; si algo de fuera está vacío, toda la plantilla queda vacía.
   */
  function rellenar(ap, p, f, valores) {
    var hueco = false;
    p = plantillaPara(p, f);
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
        // T0651: la fila de la que sale (el próximo paso: su tarea), para ir a ella. No es una columna: no se enumera.
        if (de.columna && xs.length) { if (!r.__de) Object.defineProperty(r, '__de', { value: {}, enumerable: false }); r.__de[c] = xs[0].__crudo[de.clave || 'ID']; }
      });
      conVenta.forEach(function (c) { r[c] = deVentas(a.campos[c].venta, D.ventas ? D.ventas[String(f[a.clave])] : null); });
      conPrimero.forEach(function (c) { r[c] = a.campos[c].primero.map(function (x) { return r[x]; }).filter(function (v) { return !vacio(v); })[0] || ''; });
      conPlantilla.forEach(function (c) { r[c] = rellenar(a, a.campos[c].plantilla, r, valores || {}); });
      r.__crudo = f;
      return r;
    });
  }

