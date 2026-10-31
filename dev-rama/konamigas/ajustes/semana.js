/*
 * Semana de las ligas · Konamigas · vista de Ajustes › Ligas (T0292)
 *
 * Las ligas de una temporada en su semana: cada día una columna y, dentro, sus ligas agrupadas por competición y por
 * nivel. Cada liga dice sus equipos confirmados, sus horarios y su gestor, y lo que le falta (en naranja); las que no están
 * en marcha (sin equipos ni horarios), en rojo y arriba. Tocar una liga abre su estado: gestor, equipos, horario, campos
 * contratados, calendario creado (cuántos partidos, lo cuenta el motor) y fecha de inicio, con un botón a su ficha.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  /**
   * Cómo está una liga para empezar: { equipos (inscritos sin las bajas), confirmados, partidos (los de cada semana: la
   * mitad de los confirmados), horarios, campos: [{ id, estado }] (los de sus horarios y cómo están esa temporada),
   * faltan: ['gestor' | 'equipos' | 'horarios' | 'campos'], parada (sin equipos ni horarios: no está en marcha) }.
   */
  function estadoLiga(l, d, per) {
    var ins = (d.inscripciones || []).filter(function (i) { return i.ID_LIGA === l.ID && i.ESTADO !== 'Baja'; });
    var conf = ins.filter(function (i) { return i.ESTADO === 'Confirmada'; }).length;
    var hs = (d.huecos || []).filter(function (h) { return h.ID_LIGA === l.ID; });
    var ctp = {}; (d.ctps || []).forEach(function (c) { if (String(c.ID_TEMPORADA) === per) ctp[c.ID_CAMPO] = c.ESTADO || ''; });
    var campos = hs.map(function (h) { return h.ID_CAMPO; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; })
      .map(function (id) { return { id: id, estado: ctp[id] || '' }; });
    var partidos = Math.floor(conf / 2), faltan = [];
    if (!l.ID_GESTOR) faltan.push('gestor');
    if (conf < 2) faltan.push('equipos');
    if (!hs.length || hs.length < partidos) faltan.push('horarios');
    if (campos.some(function (c) { return c.estado !== 'Contratado'; })) faltan.push('campos');
    return { equipos: ins.length, confirmados: conf, partidos: partidos, horarios: hs.length, campos: campos, faltan: faltan, parada: !ins.length && !hs.length };
  }

  /**
   * La semana de una temporada: { dias: [{ dia, ligas, comps: [{ comp, ligas }] }], sinDia, paradas }. Cada liga:
   * { l, comp, equipos, horarios, e (estadoLiga) }. Solo los días con alguna liga; dentro, por competición (su FECHA_INICIO)
   * y, en cada una, por nivel y nombre. paradas: las ligas que no están en marcha.
   */
  function semana(d, per) {
    var comps = {}; (d.comps || []).forEach(function (c) { if (String(c.ID_TEMPORADA) === per) comps[c.ID] = c; });
    var ls = (d.ligas || []).filter(function (l) { return comps[l.ID_COMPETICION]; }).map(function (l) {
      var e = estadoLiga(l, d, per);
      return { l: l, comp: comps[l.ID_COMPETICION], equipos: e.equipos, horarios: e.horarios, e: e };
    }).sort(function (a, b) {
      return String(a.comp.FECHA_INICIO || '').localeCompare(String(b.comp.FECHA_INICIO || '')) || String(a.comp.NOMBRE).localeCompare(String(b.comp.NOMBRE), 'es') ||
        (Number(a.l.NIVEL) || 9) - (Number(b.l.NIVEL) || 9) || String(a.l.NOMBRE).localeCompare(String(b.l.NOMBRE), 'es', { numeric: true });
    });
    var porComp = function (xs) {
      var out = [];
      xs.forEach(function (x) { var g = out[out.length - 1]; if (!g || g.comp !== x.comp) out.push(g = { comp: x.comp, ligas: [] }); g.ligas.push(x); });
      return out;
    };
    return {
      dias: DIAS.map(function (x) { var y = ls.filter(function (z) { return z.l.DIA_SEMANA === x; }); return { dia: x, ligas: y, comps: porComp(y) }; }).filter(function (x) { return x.ligas.length; }),
      sinDia: ls.filter(function (y) { return DIAS.indexOf(y.l.DIA_SEMANA) < 0; }),
      paradas: ls.filter(function (y) { return y.e.parada; })
    };
  }

  var CALC = { semana: semana, estadoLiga: estadoLiga };
  if (typeof window === 'undefined' || !window.UN || !window.UN.ajustes) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var TABLAS = ['LIGAS', 'COMPETICIONES', 'INSCRIPCIONES_EQUIPOS', 'HUECOS', 'CAMPOS_TEMPORADA'];
  var FALTA = { gestor: 'sin gestor', equipos: 'sin equipos', horarios: 'faltan horarios', campos: 'campo sin contratar' };

  window.UN.ajustes('SEMANA', {
    abrir: function (el, ctx) {
      var A = ctx.ajustes, T = ctx.tablas, abierta = '', partidos = {};
      function datos() { return { ligas: T.filas('LIGAS'), comps: T.filas('COMPETICIONES'), inscripciones: T.filas('INSCRIPCIONES_EQUIPOS'), huecos: T.filas('HUECOS'), ctps: T.filas('CAMPOS_TEMPORADA') }; }
      function pl(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
      function caja(x) {
        var l = x.l, e = x.e, ab = abierta === String(l.ID);
        var chips = e.parada ? '<span class="u-chip aj-se-chip-parada">Sin arrancar</span>' :
          e.faltan.map(function (f) { return '<span class="u-chip aj-se-chip">' + FALTA[f] + '</span>'; }).join('');
        return '<div class="aj-se-liga' + (e.parada ? ' aj-se-parada' : e.faltan.length ? ' aj-se-pendiente' : '') + (ab ? ' aj-se-abierta' : '') + '">' +
          '<button type="button" class="aj-se-cab" data-liga="' + texto(l.ID) + '" aria-expanded="' + ab + '"><strong>' + texto(l.NOMBRE) + '</strong>' +
          '<small>' + pl(e.confirmados, 'equipo', 'equipos') + ' · ' + pl(e.horarios, 'horario', 'horarios') + (l.ID_GESTOR ? ' · ' + texto(A.nombre('STAFF', l.ID_GESTOR)) : '') + '</small>' +
          (chips ? '<span class="aj-se-chips">' + chips + '</span>' : '') + '</button>' + (ab ? detalle(x) : '') + '</div>';
      }
      /** Lo básico de una liga para ver si está lista: cada cosa con ✓ o lo que falta. */
      function detalle(x) {
        var l = x.l, e = x.e, p = partidos[l.ID];
        var fila = function (ok, t, v) { return '<li class="' + (ok ? 'aj-se-ok' : 'aj-se-mal') + '"><span>' + (ok ? '✓' : '!') + '</span><b>' + t + '</b> ' + v + '</li>'; };
        var nc = e.campos.filter(function (c) { return c.estado !== 'Contratado'; });
        return '<div class="aj-se-det"><ul>' +
          fila(!!l.ID_GESTOR, 'Gestor:', l.ID_GESTOR ? texto(A.nombre('STAFF', l.ID_GESTOR)) : 'sin poner') +
          fila(e.confirmados >= 2, 'Equipos:', pl(e.confirmados, 'confirmado', 'confirmados') + (e.equipos > e.confirmados ? ' (y ' + pl(e.equipos - e.confirmados, 'por confirmar', 'por confirmar') + ')' : '')) +
          fila(e.horarios > 0 && e.horarios >= e.partidos, 'Horario:', e.horarios ? pl(e.horarios, 'hueco', 'huecos') + ' para ' + pl(e.partidos, 'partido', 'partidos') + ' por semana' : 'sin definir') +
          fila(e.campos.length > 0 && !nc.length, 'Campos:', e.campos.length ? e.campos.map(function (c) { return texto(A.nombre('CAMPOS', c.id)) + (c.estado !== 'Contratado' ? ' (' + texto(c.estado || 'sin contratar') + ')' : ''); }).join(', ') : 'ninguno') +
          (p === undefined ? '<li class="aj-se-espera"><span>…</span><b>Calendario:</b> mirando…</li>' : fila(p > 0, 'Calendario:', p > 0 ? pl(p, 'partido creado', 'partidos creados') : p === null ? 'no se ha podido mirar' : 'sin crear')) +
          fila(!!l.FECHA_INICIO, 'Empieza:', l.FECHA_INICIO ? String(l.FECHA_INICIO).split('-').reverse().join('/') + (l.NUM_JORNADAS ? ' · ' + l.NUM_JORNADAS + ' jornadas' : '') : 'sin fecha') +
          '</ul><button type="button" class="u-btn" data-ficha="' + texto(l.ID) + '">Abrir la liga</button></div>';
      }
      function pintar() {
        if (!el.isConnected) return;
        var per = A.periodo(), lista = A.periodos();
        var s = semana(datos(), per);
        var html = '<div class="u-filtros"><label class="u-campo"><span class="u-etiqueta">Temporada</span><select id="se-per">' + lista.map(function (p) {
          return '<option value="' + texto(p.id) + '"' + (p.id === per ? ' selected' : '') + '>' + texto(p.nombre) + '</option>';
        }).join('') + '</select></label></div>';
        if (!s.dias.length && !s.sinDia.length) { el.innerHTML = html + '<p class="u-vacio">Esta temporada todavía no tiene ligas.</p>'; oir(); return; }
        var pend = s.dias.concat([{ ligas: s.sinDia }]).reduce(function (n, x) { return n + x.ligas.filter(function (y) { return !y.e.parada && y.e.faltan.length; }).length; }, 0);
        if (s.paradas.length) html += '<section class="aj-cu-alertas" role="alert"><h3 class="n-grupo">⚠ ' + pl(s.paradas.length, 'liga sin arrancar', 'ligas sin arrancar') + '</h3><p>Sin equipos ni horarios: ' +
          s.paradas.map(function (y) { return '<button type="button" class="u-btn u-btn-texto" data-liga="' + texto(y.l.ID) + '">' + texto(y.l.NOMBRE) + '</button>' + (y.l.DIA_SEMANA ? ' (' + texto(y.l.DIA_SEMANA.toLowerCase()) + ')' : ''); }).join(', ') + '.</p></section>';
        if (pend) html += '<p class="aj-se-pend">' + pl(pend, 'liga con cosas pendientes', 'ligas con cosas pendientes') + ' (en naranja). Toca una liga para ver qué le falta.</p>';
        else if (!s.paradas.length) html += '<p class="aj-cu-ok">✓ Todas las ligas tienen gestor, equipos, horarios y campos.</p>';
        var dia = function (titulo, x) {
          return '<section class="aj-se-dia"><h3 class="n-grupo">' + texto(titulo) + ' <span class="u-cifra">' + x.ligas.length + '</span></h3>' + x.comps.map(function (g) {
            return '<div class="aj-se-comp"><h4>' + texto(g.comp.NOMBRE) + '</h4>' + g.ligas.map(caja).join('') + '</div>';
          }).join('') + '</section>';
        };
        html += '<div class="aj-se">' + s.dias.map(function (x) { return dia(x.dia, x); }).join('') +
          (s.sinDia.length ? dia('Sin día', { ligas: s.sinDia, comps: [{ comp: { NOMBRE: 'Sin día de juego' }, ligas: s.sinDia }] }) : '') + '</div>';
        el.innerHTML = html;
        oir();
      }
      function oir() {
        var sp = el.querySelector('#se-per');
        if (sp) sp.onchange = function () { A.ponerPeriodo(sp.value); abierta = ''; pintar(); };
      }
      /** Cuántos partidos tiene ya la liga (su calendario): lo cuenta el motor (ajustesUsos), que lee PARTIDOS. */
      function mirarCalendario(id) {
        if (partidos[id] !== undefined) return;
        ctx.llamar('ajustesUsos', ['LIGAS', id]).then(function (r) {
          partidos[id] = (r || []).filter(function (u) { return u.tabla === 'PARTIDOS'; }).reduce(function (n, u) { return n + u.n; }, 0);
          pintar();
        }, function () { partidos[id] = null; pintar(); });
      }
      el.addEventListener('click', function (e) {
        var f = e.target.closest('[data-ficha]');
        if (f) { A.ficha('LIGAS', f.getAttribute('data-ficha')); return; }
        var b = e.target.closest('[data-liga]');
        if (!b) return;
        var id = b.getAttribute('data-liga');
        abierta = abierta === id ? '' : id;
        if (abierta) mirarCalendario(id);
        pintar();
        if (abierta) { var c = el.querySelector('.aj-se-abierta'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); }
      });
      ctx.alCambiar(function (t) { if (TABLAS.indexOf(t) >= 0) pintar(); });
      T.leer(TABLAS.concat(['STAFF', 'CAMPOS'])).then(pintar, pintar);
      pintar();
    }
  });
})();
