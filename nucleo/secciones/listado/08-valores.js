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
    if (cp.tipo === 'porcentaje') { var p = pctVer(v); return isNaN(p) ? String(v) : num(p, 0) + ' %'; } // T0714: 100 (ya en %) no es 10.000 %
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
  /** T0724 (R24) · Lo que no es el nombre en el título de una ficha: su código, la etiqueta del título que se toca («Marca»), «Guardado». */
  var QUITAR_DE_VUELTA = '.li-cod, .u-etiqueta, .li-guardado, .li-para';
  function textoVuelta(deFicha, desde) { var t = deFicha || (desde && desde.titulo) || ''; return t ? '‹ Volver a ' + t : ''; }
  /** T0642 · La dirección de ahora con la ficha abierta (?ficha=M-001) y sin lo de «+ Nueva …», para que «atrás» la vuelva a abrir. */
  function conFicha(search, id, quitar) {
    var u = new URLSearchParams(search);
    ['nueva'].concat(quitar || []).forEach(function (k) { u.delete(k); });
    u.set('ficha', id);
    return '?' + u.toString();
  }
  /** T0732 (R50) · Qué hace la sección cuando atrás (o adelante) se queda en ella. st: la entrada del historial a la que se
   *  llega (su «fichaLi», la ficha que se abrió desde la lista: su código, o «+» para una nueva); ahora: la ficha abierta ('' si
   *  ninguna). { hacer: 'cerrar' } (la ficha se cierra y se ve la lista), { hacer: 'abrir', id }, { hacer: 'nada' } (ya está
   *  como pide), o null: no es cosa de la ficha y el marco abre la sección como siempre. */
  function queHacerAtras(st, ahora) {
    var quiere = String((st && st.fichaLi) || ''); ahora = String(ahora || '');
    if (quiere === ahora) return ahora ? { hacer: 'nada' } : null;
    if (!quiere) return { hacer: 'cerrar' };
    return { hacer: 'abrir', id: quiere };
  }
  /** T0732 (R50) · La dirección de una ficha que se abre desde la lista: con ?ficha=… (una nueva, sin ficha ni lo de antes). */
  function dirFicha(search, id, quitar) {
    if (id !== '+') return conFicha(search, id, quitar);
    var u = new URLSearchParams(search);
    ['ficha', 'nueva'].concat(quitar || []).forEach(function (k) { u.delete(k); });
    var q = u.toString(); return q ? '?' + q : '';
  }
  var atrasDe = null; // T0732: lo que hace la sección abierta con atrás (def.atras, que llama el marco)
  // T0642: el nombre de la ficha desde la que se salta a otra (una tela, una tarea, «+ Nueva tarea»), hasta que la abre la
  // sección a la que se va (todas las de Listado comparten este archivo).
  var vueltaPendiente = null;

  /** T0610 · Los avisos de una fila sin el que ya dice el título de su grupo: en «Con la fecha pasada», cada fila no repite
   *  «Con la fecha pasada» (la franja de color de la fila sigue). Sin grupo, todos. */
  function sinRepetir(avs, tituloGrupo, campoPlazo) {
    var t = String(tituloGrupo || '').trim().toLowerCase();
    var r = t ? avs.filter(function (x) { return String(x.titulo || '').trim().toLowerCase() !== t; }) : avs;
    // T0642: agrupado por el plazo de una fecha («Hoy», «Esta semana»), un aviso que solo mira esa fecha («Es para
    // hoy») ya lo dice su grupo. La franja de color de la fila sigue.
    if (t && campoPlazo) r = r.filter(function (x) { var cs = lista(x.si); return !cs.length || !cs.every(function (c) { return c && c.campo === campoPlazo; }); });
    return r;
  }

  /** T0624 · Una señal por cosa: la fecha que hace saltar un aviso de nivel alto (vencido) o medio (pendiente) se pinta con
   *  su color, y la franja de la fila con el mismo; lo demás (estado, botones de aviso) va neutro. Da el nivel del primer
   *  aviso de la fila que mira esa columna, o '' (ninguno, o solo de nivel info: «Sin fecha» no pinta nada). */
  /** T0730 (R41) · El color de la franja de la fila: el del primer aviso que la pinta (`"fila": false` no la pinta: «Falta el
   *  coste» se dice en palabras, sin parecer atrasado); '' si ninguno. */
  function franja(avs) {
    var x = (avs || []).filter(function (a) { return a.fila !== false; })[0];
    return x ? (x.nivel || 'medio') : '';
  }
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

