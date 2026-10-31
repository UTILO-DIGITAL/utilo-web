/*
 * Semana de las ligas · Konamigas · vista de Ajustes › Ligas (T0292)
 *
 * Las ligas de una temporada en su semana: cada día una columna y, dentro, sus ligas por competición y nivel, con cuántos
 * equipos tiene cada una (INSCRIPCIONES_EQUIPOS que no son baja), su gestor y sus horarios. Las ligas sin día van aparte.
 * Tocar una liga abre su ficha (con sus equipos y horarios). Lee las tablas que ya tiene Ajustes.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  /**
   * La semana de una temporada: { dias: [{ dia, ligas: [{ l, comp, equipos, horarios }] }], sinDia: [...] }. Solo los días
   * con alguna liga; dentro, por competición (su FECHA_INICIO), nivel y nombre.
   */
  function semana(d, per) {
    var comps = {}; (d.comps || []).forEach(function (c) { if (String(c.ID_TEMPORADA) === per) comps[c.ID] = c; });
    var eq = {}; (d.inscripciones || []).forEach(function (i) { if (i.ESTADO !== 'Baja') eq[i.ID_LIGA] = (eq[i.ID_LIGA] || 0) + 1; });
    var hs = {}; (d.huecos || []).forEach(function (h) { hs[h.ID_LIGA] = (hs[h.ID_LIGA] || 0) + 1; });
    var ls = (d.ligas || []).filter(function (l) { return comps[l.ID_COMPETICION]; }).map(function (l) {
      return { l: l, comp: comps[l.ID_COMPETICION], equipos: eq[l.ID] || 0, horarios: hs[l.ID] || 0 };
    }).sort(function (a, b) {
      return String(a.comp.FECHA_INICIO || '').localeCompare(String(b.comp.FECHA_INICIO || '')) || String(a.comp.NOMBRE).localeCompare(String(b.comp.NOMBRE), 'es') ||
        (Number(a.l.NIVEL) || 9) - (Number(b.l.NIVEL) || 9) || String(a.l.NOMBRE).localeCompare(String(b.l.NOMBRE), 'es', { numeric: true });
    });
    return {
      dias: DIAS.map(function (x) { return { dia: x, ligas: ls.filter(function (y) { return y.l.DIA_SEMANA === x; }) }; }).filter(function (x) { return x.ligas.length; }),
      sinDia: ls.filter(function (y) { return DIAS.indexOf(y.l.DIA_SEMANA) < 0; })
    };
  }

  var CALC = { semana: semana };
  if (typeof window === 'undefined' || !window.UN || !window.UN.ajustes) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var TABLAS = ['LIGAS', 'COMPETICIONES', 'INSCRIPCIONES_EQUIPOS', 'HUECOS'];

  window.UN.ajustes('SEMANA', {
    abrir: function (el, ctx) {
      var A = ctx.ajustes, T = ctx.tablas;
      function caja(x) {
        var l = x.l;
        return '<button type="button" class="aj-se-liga" data-liga="' + texto(l.ID) + '"><strong>' + texto(l.NOMBRE) + '</strong>' +
          '<small>' + texto(x.comp.NOMBRE) + (l.NIVEL ? ' · nivel ' + texto(l.NIVEL) : '') + '</small>' +
          '<small>' + x.equipos + (x.equipos === 1 ? ' equipo' : ' equipos') + ' · ' + x.horarios + (x.horarios === 1 ? ' horario' : ' horarios') +
          (l.ID_GESTOR ? ' · ' + texto(A.nombre('STAFF', l.ID_GESTOR)) : ' · <span class="aj-se-falta">sin gestor</span>') + '</small></button>';
      }
      function pintar() {
        if (!el.isConnected) return;
        var per = A.periodo(), lista = A.periodos();
        var s = semana({ ligas: T.filas('LIGAS'), comps: T.filas('COMPETICIONES'), inscripciones: T.filas('INSCRIPCIONES_EQUIPOS'), huecos: T.filas('HUECOS') }, per);
        var html = '<div class="u-filtros"><label class="u-campo"><span class="u-etiqueta">Temporada</span><select id="se-per">' + lista.map(function (p) {
          return '<option value="' + texto(p.id) + '"' + (p.id === per ? ' selected' : '') + '>' + texto(p.nombre) + '</option>';
        }).join('') + '</select></label></div>';
        if (!s.dias.length && !s.sinDia.length) { el.innerHTML = html + '<p class="u-vacio">Esta temporada todavía no tiene ligas.</p>'; oir(); return; }
        html += '<div class="aj-se">' + s.dias.map(function (x) {
          return '<section class="aj-se-dia"><h3 class="n-grupo">' + texto(x.dia) + ' <span class="u-cifra">' + x.ligas.length + '</span></h3>' + x.ligas.map(caja).join('') + '</section>';
        }).join('') + (s.sinDia.length ? '<section class="aj-se-dia"><h3 class="n-grupo">Sin día <span class="u-cifra">' + s.sinDia.length + '</span></h3>' + s.sinDia.map(caja).join('') + '</section>' : '') + '</div>';
        el.innerHTML = html;
        oir();
      }
      function oir() {
        var sp = el.querySelector('#se-per');
        if (sp) sp.onchange = function () { A.ponerPeriodo(sp.value); pintar(); };
      }
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-liga]');
        if (b) A.ficha('LIGAS', b.getAttribute('data-liga'));
      });
      ctx.alCambiar(function (t) { if (TABLAS.indexOf(t) >= 0) pintar(); });
      pintar();
    }
  });
})();
