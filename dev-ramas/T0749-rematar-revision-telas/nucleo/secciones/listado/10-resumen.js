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
   * de esta fila; undefined, aún no han llegado («Mirando sus ventas…»); null o sin ventas, nada. o: { titulo, seccion, va, max, hoy, nombre }.
   * T0726 (R26) · nombre: cómo se llaman allí («pedido» en Telas; vacío, «venta»), para que diga lo mismo en todas partes.
   */
  function htmlVentas(q, o) {
    var uno = String(o.nombre || 'venta').toLowerCase(), varios = /[aeiouáéó]$/.test(uno) ? uno + 's' : uno + 'es', f = /a$/.test(uno);
    var tit = texto(o.titulo || 'Sus ' + varios);
    if (q === undefined) return '<section class="li-fgrupo"><h3 class="li-fg-t">' + tit + '</h3><p class="u-nota">Mirando sus ' + texto(varios) + '…</p></section>';
    if (!q || !q.ventas || !q.ventas.length) return '';
    var eur = function (c) { return num(c / 100, c % 100 ? 2 : 0) + ' €'; };
    var partes = [(f ? 'Última ' : 'Último ') + uno + ' ' + (cuando(q.ultima, o.hoy) || fechaCorta(q.ultima))];
    if (q.enAnio) partes.push(q.anio ? eur(q.anio) + ' este año' : (q.enAnio === 1 ? '1 ' + uno : q.enAnio + ' ' + varios) + ' este año, sin precio cerrado');
    var debe = q.debe > 0 ? '<span class="u-mal">Te debe ' + eur(q.debe) + '</span>' : (q.sinPrecio ? 'Sin precio cerrado en ' + (q.sinPrecio === 1 ? (f ? 'una' : 'uno') : q.sinPrecio) : '<span class="u-bien">Al día</span>');
    // El paso, concordando con la palabra: «Pedido», «Cobrado».
    var paso = function (t) { return f ? String(t || '') : String(t || '').replace(/^(Pedid|Cobrad|Entregad|Pagad|Facturad)a\b/, '$1o'); };
    var sec = String(o.seccion || ''), va = o.va, max = o.max || 10;
    return '<section class="li-fgrupo li-ventas"><h3 class="li-fg-t">' + tit + ' <span class="u-cifra">' + q.ventas.length + '</span></h3>' +
      '<p class="li-ven-res">' + partes.map(texto).join(' · ') + ' · ' + debe + '</p><ul class="li-rel">' + q.ventas.slice(0, max).map(function (x) {
        var pasoT = paso(x.paso) + (x.fechaPaso ? ' ' + fechaCorta(x.fechaPaso) : ''), extra = x.cobrada || x.adelantado ? (x.importe !== null ? eur(x.importe) : '') :
          (x.debe === null ? 'Sin precio cerrado' : x.debe > 0 ? 'Te debe ' + eur(x.debe) : '');
        var dentro = '<span class="li-rel-n">' + texto(x.v.NOMBRE || x.v.ID) + '</span><span>' + texto(pasoT) + '</span>' +
          (extra ? '<span' + (x.debe > 0 && !x.cobrada && !x.adelantado ? ' class="u-mal"' : '') + '>' + texto(extra) + '</span>' : '');
        return '<li>' + (va ? '<a class="li-rel-f" href="?s=' + encodeURIComponent(sec.toLowerCase()) + '&venta=' + encodeURIComponent(x.v.ID) + '" data-sx="' + texto(sec) + '">' + dentro + '<span class="li-ir">' + texto(va) + ' ›</span></a>' : '<div class="li-rel-f">' + dentro + '</div>') + '</li>';
      }).join('') + '</ul>' + (q.ventas.length > max ? '<p class="u-nota">Y ' + (q.ventas.length - max) + ' más, en ' + texto(va || 'Pedidos') + '.</p>' : '') + '</section>';
  }

  /* ---------- T0651 · editar tocando, dar de alta, borrar y lo de dentro de una ficha ---------- */

  function aRegex(x) { return String(x).split('').map(function (ch) { return '\\^$.*+?()|{}[]/-'.indexOf(ch) >= 0 ? '\\' + ch : ch; }).join(''); }
