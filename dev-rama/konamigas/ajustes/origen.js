/*
 * Esquema de competiciones · Konamigas · vista de Ajustes › Competiciones y Origen de las competiciones (T0292)
 *
 * Las competiciones de una temporada como un árbol, de izquierda a derecha: cada competición de la que salen otras, una
 * flecha con quién pasa (Todos, Campeones…, de COMPETICIONES_ORIGEN) y la que sale de ella (LIGA ──Todos──▶ COPA LIGA).
 * Las que no tienen nada detrás van aparte. Cada caja dice cuántas ligas tiene. Tocar una competición abre su ficha; tocar
 * una flecha, la fila de COMPETICIONES_ORIGEN. Lee las tablas que ya tiene Ajustes.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  /**
   * El árbol de una temporada: [nodo] con las competiciones que no salen de ninguna, primero las que tienen otras detrás.
   * Cada nodo: { c (fila), ligas (cuántas), hijas: [{ o (fila de COMPETICIONES_ORIGEN), n (nodo) }] }. Una que sale de
   * dos (una copa de LIGA y de SENIOR) sale debajo de las dos. Sin bucles: una que ya está en el camino no se repite, y las de un bucle salen igual.
   */
  function arbol(d, per) {
    var comps = (d.comps || []).filter(function (c) { return String(c.ID_TEMPORADA) === per; })
      .sort(function (a, b) { return String(a.FECHA_INICIO || '').localeCompare(String(b.FECHA_INICIO || '')); });
    var por = {}, ligas = {}, salen = {}, viene = {};
    comps.forEach(function (c) { por[c.ID] = c; });
    (d.ligas || []).forEach(function (l) { ligas[l.ID_COMPETICION] = (ligas[l.ID_COMPETICION] || 0) + 1; });
    (d.origen || []).forEach(function (o) {
      if (!por[o.ID_COMPETICION] || !por[o.ID_COMPETICION_ORIGEN]) return;
      (salen[o.ID_COMPETICION_ORIGEN] = salen[o.ID_COMPETICION_ORIGEN] || []).push(o);
      viene[o.ID_COMPETICION] = 1;
    });
    function nodo(c, camino) {
      var hs = (salen[c.ID] || []).filter(function (o) { return camino.indexOf(o.ID_COMPETICION) < 0; });
      return { c: c, ligas: ligas[c.ID] || 0, hijas: hs.map(function (o) { return { o: o, n: nodo(por[o.ID_COMPETICION], camino.concat([o.ID_COMPETICION])) }; }) };
    }
    var raices = comps.filter(function (c) { return !viene[c.ID]; }).map(function (c) { return nodo(c, [c.ID]); });
    // Las de un bucle (A sale de B y B de A) no empiezan en ningún sitio: la primera que no ha salido empieza su árbol.
    var visto = {}, ver = function (n) { visto[n.c.ID] = 1; n.hijas.forEach(function (h) { ver(h.n); }); };
    raices.forEach(ver);
    comps.forEach(function (c) { if (!visto[c.ID]) { var n = nodo(c, [c.ID]); ver(n); raices.push(n); } });
    return raices.filter(function (n) { return n.hijas.length; }).concat(raices.filter(function (n) { return !n.hijas.length; }));
  }

  var CALC = { arbol: arbol };
  if (typeof window === 'undefined' || !window.UN || !window.UN.ajustes) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var TABLAS = ['COMPETICIONES', 'COMPETICIONES_ORIGEN', 'LIGAS'];

  window.UN.ajustes('ORIGEN', {
    abrir: function (el, ctx) {
      var A = ctx.ajustes, T = ctx.tablas;
      function caja(n) {
        var c = n.c;
        return '<button type="button" class="aj-or-c" data-comp="' + texto(c.ID) + '"><strong>' + texto(c.NOMBRE) + '</strong><small>' + texto(c.TIPO || '') +
          (c.INCLUIDA === true ? ' · incluida' : '') + ' · ' + n.ligas + (n.ligas === 1 ? ' liga' : ' ligas') + '</small>' +
          (c.DESCRIPCION ? '<small class="aj-or-nota">' + texto(String(c.DESCRIPCION).slice(0, 90)) + '</small>' : '') + '</button>';
      }
      /** Una competición y, a su derecha, cada una de las que salen de ella con su flecha (y así hacia la derecha). */
      function rama(n) {
        if (!n.hijas.length) return caja(n);
        return '<div class="aj-or-rama">' + caja(n) + '<div class="aj-or-hijas">' + n.hijas.map(function (h) {
          return '<div class="aj-or-paso"><button type="button" class="aj-or-flecha" data-origen="' + texto(h.o.ID) + '"><span>' + texto(h.o.CRITERIO || 'Pasan') + '</span></button>' + rama(h.n) + '</div>';
        }).join('') + '</div></div>';
      }
      function pintar() {
        if (!el.isConnected) return;
        var per = A.periodo(), lista = A.periodos();
        var raices = arbol({ comps: T.filas('COMPETICIONES'), origen: T.filas('COMPETICIONES_ORIGEN'), ligas: T.filas('LIGAS') }, per);
        var html = '<div class="u-filtros"><label class="u-campo"><span class="u-etiqueta">Temporada</span><select id="or-per">' + lista.map(function (p) {
          return '<option value="' + texto(p.id) + '"' + (p.id === per ? ' selected' : '') + '>' + texto(p.nombre) + '</option>';
        }).join('') + '</select></label></div>';
        if (!raices.length) { el.innerHTML = html + '<p class="u-vacio">Esta temporada todavía no tiene competiciones.</p>'; oir(); return; }
        var con = raices.filter(function (n) { return n.hijas.length; }), sin = raices.filter(function (n) { return !n.hijas.length; });
        html += '<p class="u-nota">Cada flecha va de una competición a la que sale de ella, con quién pasa (Todos, Campeones…). Toca una caja o una flecha para abrirla.</p>';
        if (con.length) html += '<div class="aj-or">' + con.map(function (n) { return '<div class="aj-or-fila">' + rama(n) + '</div>'; }).join('') + '</div>';
        if (sin.length) html += '<h3 class="n-grupo">' + (con.length ? 'Sin otras que salgan de ellas' : 'Ninguna sale de otra') + '</h3><div class="aj-or-sueltas">' + sin.map(caja).join('') + '</div>';
        el.innerHTML = html;
        oir();
      }
      function oir() {
        var sp = el.querySelector('#or-per');
        if (sp) sp.onchange = function () { A.ponerPeriodo(sp.value); pintar(); };
      }
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-comp], [data-origen]');
        if (!b) return;
        if (b.hasAttribute('data-comp')) A.ficha('COMPETICIONES', b.getAttribute('data-comp'));
        else A.ficha('COMPETICIONES_ORIGEN', b.getAttribute('data-origen'));
      });
      ctx.alCambiar(function (t) { if (TABLAS.indexOf(t) >= 0) pintar(); });
      pintar();
    }
  });
})();
