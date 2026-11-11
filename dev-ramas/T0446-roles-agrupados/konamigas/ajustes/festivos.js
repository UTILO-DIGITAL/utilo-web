/*
 * Calendario de la temporada · Konamigas · vista de Ajustes › Festivos y descansos (T0292) · config.json · «vistas»
 *
 * Los meses de una temporada, de lunes a domingo, con los festivos y descansos de CALENDARIO marcados y, cada día, qué
 * ligas juegan (las de las competiciones de esa temporada, su DIA_SEMANA, desde su FECHA_INICIO hasta el final de su
 * competición). Debajo, las jornadas que se pierden: los festivos o descansos en un día con ligas. Tocar un día lo abre
 * (si ya está marcado) o abre uno nuevo como festivo, con las fichas de Ajustes (ctx.ajustes). Lee las tablas que ya
 * tiene Ajustes: no llama al motor.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate()); }
  function fecha(s) { var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(s || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; }
  /** 0 = lunes … 6 = domingo. */
  function diaSemana(d) { return (d.getUTCDay() + 6) % 7; }

  /**
   * El calendario de una temporada (tem: su fila, con FECHA_INICIO y FECHA_FIN). d: filas de CALENDARIO, LIGAS y
   * COMPETICIONES. Devuelve { meses: [{ titulo, semanas: [[día | null] × 7] }], perdidas: [día] }; cada día:
   * { fecha, n, marca (fila de CALENDARIO o null), ligas: [liga] }.
   */
  function calendario(d, tem) {
    var ini = fecha(tem && tem.FECHA_INICIO), fin = fecha(tem && tem.FECHA_FIN);
    if (!ini || !fin || fin < ini) return { meses: [], perdidas: [] };
    var marcas = {}; (d.calendario || []).forEach(function (c) { marcas[String(c.FECHA)] = c; });
    var comps = {}; (d.comps || []).forEach(function (c) { if (String(c.ID_TEMPORADA) === String(tem.ID)) comps[c.ID] = c; });
    var ligas = (d.ligas || []).filter(function (l) { return comps[l.ID_COMPETICION] && DIAS.indexOf(l.DIA_SEMANA) >= 0; });
    var meses = [], perdidas = [], mes = null;
    for (var x = new Date(ini.getTime()); x <= fin; x = new Date(x.getTime() + 86400000)) {
      var f = iso(x), ds = diaSemana(x);
      if (!mes || mes.m !== x.getUTCMonth()) {
        mes = { m: x.getUTCMonth(), titulo: MESES[x.getUTCMonth()] + ' ' + x.getUTCFullYear(), semanas: [[null, null, null, null, null, null, null]] };
        meses.push(mes);
      }
      var sem = mes.semanas[mes.semanas.length - 1];
      if (ds === 0 && sem.some(Boolean)) { sem = [null, null, null, null, null, null, null]; mes.semanas.push(sem); }
      var juegan = ligas.filter(function (l) {
        var c = comps[l.ID_COMPETICION];
        return l.DIA_SEMANA === DIAS[ds] && (!l.FECHA_INICIO || f >= l.FECHA_INICIO) && (!c.FECHA_FIN || f <= c.FECHA_FIN) && (!c.FECHA_INICIO || f >= c.FECHA_INICIO);
      });
      var dia = { fecha: f, n: x.getUTCDate(), marca: marcas[f] || null, ligas: juegan };
      sem[ds] = dia;
      if (dia.marca && juegan.length && (dia.marca.FESTIVO === true || dia.marca.DESCANSO === true)) perdidas.push(dia);
    }
    return { meses: meses, perdidas: perdidas };
  }

  var CALC = { calendario: calendario };
  if (typeof window === 'undefined' || !window.UN || !window.UN.ajustes) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var TABLAS = ['CALENDARIO', 'LIGAS', 'COMPETICIONES', 'TEMPORADAS'];

  window.UN.ajustes('FESTIVOS', {
    abrir: function (el, ctx) {
      var A = ctx.ajustes, T = ctx.tablas;
      function pintar() {
        if (!el.isConnected) return;
        var per = A.periodo(), lista = A.periodos();
        var tem = (T.filas('TEMPORADAS') || []).filter(function (t) { return String(t.ID) === per; })[0];
        var c = calendario({ calendario: T.filas('CALENDARIO'), ligas: T.filas('LIGAS'), comps: T.filas('COMPETICIONES') }, tem);
        var nombre = function (l) { return A.nombre('LIGAS', l.ID); };
        var html = '<div class="u-filtros"><label class="u-campo"><span class="u-etiqueta">Temporada</span><select id="cal-per">' + lista.map(function (p) {
          return '<option value="' + texto(p.id) + '"' + (p.id === per ? ' selected' : '') + '>' + texto(p.nombre) + '</option>';
        }).join('') + '</select></label></div>';
        if (!c.meses.length) { el.innerHTML = html + '<p class="u-vacio">Esta temporada no tiene fechas de inicio y fin.</p>'; oir(); return; }
        html += '<p class="aj-cal-ley"><span class="aj-cal-fes">Festivo</span><span class="aj-cal-des">Descanso</span><span><i class="aj-cal-p"></i> ligas ese día</span></p>' +
          '<p class="u-nota">Toca un día para marcarlo como festivo o descanso, o para cambiar el que ya está.</p>';
        if (c.perdidas.length) {
          html += '<section class="aj-cal-perdidas"><h3 class="n-grupo">Jornadas que se pierden <span class="u-cifra">' + c.perdidas.length + '</span></h3><ul>' +
            c.perdidas.map(function (d) {
              return '<li><button type="button" class="u-btn u-btn-texto" data-cal="' + d.fecha + '">' + d.fecha.split('-').reverse().join('/') + '</button> ' +
                texto(d.marca.MOTIVO || (d.marca.FESTIVO === true ? 'Festivo' : 'Descanso')) + ' · ' + texto(d.ligas.map(nombre).join(', ')) + '</li>';
            }).join('') + '</ul></section>';
        }
        html += '<div class="aj-cal">' + c.meses.map(function (m) {
          return '<section class="aj-cal-mes"><h3 class="n-grupo">' + texto(m.titulo) + '</h3><table class="aj-cal-t"><thead><tr>' +
            ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' +
            m.semanas.map(function (s) {
              return '<tr>' + s.map(function (d) {
                if (!d) return '<td></td>';
                var mk = d.marca, cl = mk && mk.FESTIVO === true ? 'aj-cal-fes' : mk && mk.DESCANSO === true ? 'aj-cal-des' : '';
                var tit = (mk ? (mk.MOTIVO || '') + (d.ligas.length ? ' · ' : '') : '') + d.ligas.map(nombre).join(', ');
                return '<td><button type="button" class="aj-cal-d ' + cl + '" data-cal="' + d.fecha + '"' + (tit ? ' title="' + texto(tit) + '"' : '') + '>' + d.n +
                  (d.ligas.length ? '<i class="aj-cal-p" aria-label="' + d.ligas.length + ' ligas"></i>' : '') + '</button></td>';
              }).join('') + '</tr>';
            }).join('') + '</tbody></table></section>';
        }).join('') + '</div>';
        el.innerHTML = html;
        oir();
      }
      function oir() {
        var sp = el.querySelector('#cal-per');
        if (sp) sp.onchange = function () { A.ponerPeriodo(sp.value); pintar(); };
      }
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cal]');
        if (!b) return;
        var f = b.getAttribute('data-cal');
        var ya = (T.filas('CALENDARIO') || []).some(function (x) { return String(x.FECHA) === f; });
        if (ya) A.ficha('CALENDARIO', f); else A.nueva('CALENDARIO', { FECHA: f, FESTIVO: true });
      });
      ctx.alCambiar(function (t) { if (TABLAS.indexOf(t) >= 0) pintar(); });
      T.leer(TABLAS).then(pintar, pintar);
      pintar();
    }
  });
})();
