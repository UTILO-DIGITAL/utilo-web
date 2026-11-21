  /* ---------- condiciones (filtros de las vistas y avisos) ----------
   * Una lista de condiciones que se cumplen todas: { campo, es | no | vacio | contiene | desde | hasta | mayor | menor }.
   * desde y hasta son días contados desde hoy (incluidos) en una columna de fecha: { campo: 'FECHA', hasta: -1 } es «ya
   * pasó». En un aviso, «dias» (o «-dias») en vez de un número usa los días del aviso, que se cambian al personalizar. */
  /** T0706 · Las columnas que mira una lista de condiciones, también las de dentro de un «o». */
  function camposCond(conds) {
    var r = [];
    lista(conds).forEach(function (c) { if (!c) return; if (c.campo) r.push(c.campo); lista(c.o).forEach(function (g) { r = r.concat(camposCond(g)); }); });
    return r;
  }
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

