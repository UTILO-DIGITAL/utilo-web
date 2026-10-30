/*
 * Sección Ligas de Konamigas · núcleo 5.0 (T0255) · clientes/konamigas/modulos/ligas de utilo-apps
 *
 * Sobre el Excel COMPETICION nuevo: competiciones y ligas de cada temporada, partidos por jornada con fecha, hora,
 * campo y árbitro, resultados y goles, la clasificación y las goleadoras, y el calendario de la semana con festivos y
 * descansos (lo que hacían CALENDARIO, CLASIFICACION y DB_JORNADAS del Excel GESTION, sin fórmulas).
 * - Arriba se elige la competición y su liga (en el calendario, todas o una competición).
 * - Todo se lee con las tablas al momento (ctx.tablas): se pinta con lo guardado en el dispositivo y se refresca por
 *   detrás. La clasificación y las goleadoras se calculan aquí (CALC, más abajo, se prueba en node).
 * - Los nombres de staff y jugadoras y el color de cada equipo vienen del motor sin datos personales (ligasStaff,
 *   ligasJugadoras, ligasColores) y se guardan en el dispositivo.
 * - La ficha de un partido es un marcador: cada equipo con su color y, debajo, quién marcó.
 * - El acta (resultado y quién marcó cada gol) la cierra el árbitro del partido o un perfil de ACTA_TODAS (ligasActa).
 * - Quien programa (PROGRAMAR) mueve un partido a otro hueco de su liga el mismo día (si está ocupado, se intercambian;
 *   ligasMover) o intercambia la fecha de dos jornadas (ligasJornadas), siempre en los campos reservados para la liga
 *   (HUECOS). Antes de guardar se le avisa de las capitanas afectadas y después tiene la lista para avisarlas por
 *   WhatsApp con el mensaje ya escrito (ligasCapitanas). Árbitro, gestor y aplazar, suspender o anular, con ligasPartido.
 * - Cada cambio se ve al momento y va al motor por detrás; si dice que no, vuelve a como estaba.
 *
 * Personalización (config.json · nucleo.secciones.ligas.config, declarada en su modulo.json): PESTANAS, PUNTOS,
 * SIN_CLASIFICACION, ACTA_TODAS, PROGRAMAR, GOLEADORAS, ACTUALIZAR_PAGOS y AYUDA.
 * - T0274: a quien puede (ACTUALIZAR_PAGOS, Socio), al final, cómo está la copia de los pagos y las tarifas del staff (de
 *   ECONOMIA a COMPETICION, para que árbitros y gestores vean sus cobros sin ECONOMIA) y «Actualizar pagos del staff».
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var CON_MOTIVO = ['Aplazado', 'Suspendido', 'Anulado'];
  var PUNTUALIDAD = 'Puntualidad'; // GOLES · NOTAS de un gol de puntualidad (ligasActa del motor)
  var EN_PROPIA = 'En propia'; // GOLES · NOTAS de un gol que no marca nadie del equipo
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function hoy() { return iso(new Date()); }
  function deIso(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function sumarDias(s, n) { var d = deIso(s); if (!d) return ''; d.setDate(d.getDate() + n); return iso(d); }
  /** El lunes de la semana de una fecha. */
  function lunes(s) { var d = deIso(s); if (!d) return ''; return sumarDias(s, -((d.getDay() + 6) % 7)); }
  /** «2026-11-03» → «03/11/2026»; corta: «03/11». */
  function fecha(s, corta) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + (corta ? '' : '/' + m[1]) : String(s || ''); }
  /** «2026-11-03» → «Lunes 3 nov». */
  function fechaDia(s) { var d = deIso(s); return d ? DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()] : String(s || ''); }
  function diaSemana(s) { var d = deIso(s); return d ? DIAS[d.getDay()] : ''; }
  function indice(filas, k) { var o = {}; (filas || []).forEach(function (f) { o[String(f[k || 'ID'])] = f; }); return o; }
  function num(v) { return typeof v === 'number' ? v : String(v == null ? '' : v).trim() === '' ? NaN : Number(v); }
  function orden(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function cuando(p) { return String(p.FECHA || '') + ' ' + String(p.HORA || ''); }

  /** ¿Cuenta el partido para la clasificación? Jugado, con los dos equipos y los dos resultados. */
  function conResultado(p) { return p.ESTADO === 'Jugado' && !!p.ID_INSCRIPCION_LOCAL && !!p.ID_INSCRIPCION_VISITANTE && isFinite(num(p.GOLES_LOCAL)) && isFinite(num(p.GOLES_VISITANTE)); }
  /**
   * ¿Le falta uno de los dos equipos? (un fallo de los datos: en PARTIDOS solo está el local o el visitante). No cuenta en la
   * clasificación ni en las goleadoras, y la pantalla lo avisa. En una eliminatoria (elim), un partido sin jugar puede tener
   * un equipo por decidir: eso no es un fallo.
   */
  function incompleto(p, elim) {
    if (p.ESTADO === 'Libre' || !p.ID_INSCRIPCION_LOCAL === !p.ID_INSCRIPCION_VISITANTE) return false;
    return !elim || p.ESTADO === 'Jugado';
  }

  /** La temporada de hoy (FECHA_INICIO ≤ hoy ≤ FECHA_FIN) o, si no, la más reciente. Lista ordenada de la más nueva a la más vieja. */
  function temporadas(filas) { return (filas || []).slice().sort(function (a, b) { return orden(String(b.FECHA_INICIO || b.ID), String(a.FECHA_INICIO || a.ID)); }); }
  function temporadaActual(filas, h) {
    var l = temporadas(filas);
    return l.filter(function (t) { return t.FECHA_INICIO && t.FECHA_FIN && t.FECHA_INICIO <= h && h <= t.FECHA_FIN; })[0] || l[0] || null;
  }

  /** Ligas de una temporada: [{ liga, comp }], por competición y por día de la semana. */
  function ligasDe(d, temp) {
    var comps = (d.comp || []).filter(function (c) { return String(c.ID_TEMPORADA) === String(temp); });
    var ci = indice(comps), dia = function (l) { var i = DIAS.indexOf(l.DIA_SEMANA); return i < 0 ? 9 : (i + 6) % 7; };
    return (d.ligas || []).filter(function (l) { return ci[l.ID_COMPETICION]; }).map(function (l) { return { liga: l, comp: ci[l.ID_COMPETICION] }; })
      .sort(function (a, b) {
        return orden(String(a.comp.FECHA_INICIO || ''), String(b.comp.FECHA_INICIO || '')) || orden(String(a.comp.NOMBRE), String(b.comp.NOMBRE)) ||
          dia(a.liga) - dia(b.liga) || String(a.liga.NOMBRE).localeCompare(String(b.liga.NOMBRE), 'es');
      });
  }

  /** Jornadas de unos partidos, en orden. */
  function jornadas(ps) {
    var o = {};
    ps.forEach(function (p) { var j = num(p.JORNADA); if (isFinite(j)) o[j] = 1; });
    return Object.keys(o).map(Number).sort(function (a, b) { return a - b; });
  }
  /** La jornada que se abre: la primera con partidos pendientes de hoy en adelante; si no hay, la última. */
  function jornadaInicial(ps, h) {
    var js = jornadas(ps);
    var prox = ps.filter(function (p) { return p.ESTADO === 'Programado' && String(p.FECHA || '') >= h && isFinite(num(p.JORNADA)); })
      .sort(function (a, b) { return orden(cuando(a), cuando(b)); })[0];
    return prox ? num(prox.JORNADA) : js.length ? js[js.length - 1] : null;
  }

  /**
   * Clasificación de una liga. ps: sus partidos; equipos: IDs de inscripción que tienen que salir aunque no hayan jugado;
   * puntos: { GANAR, EMPATAR, PERDER }. Solo cuentan los Jugados con resultado. Orden: puntos, diferencia de goles,
   * goles a favor y nombre (nombres: { ID: nombre }). anulado: los goles con que pierde el equipo que provoca un partido
   * anulado (ANULADO_POR; 0-5 por defecto; 0, no cuenta). Devuelve [{ pos, id, pj, pg, pe, pp, gf, gc, dg, pts, jugar }]:
   * jugar, los partidos que le quedan (programados o aplazados).
   */
  function clasificacion(ps, equipos, puntos, nombres, anulado) {
    puntos = puntos || {};
    var G = num(puntos.GANAR), E = num(puntos.EMPATAR), P = num(puntos.PERDER);
    if (!isFinite(G)) G = 3; if (!isFinite(E)) E = 1; if (!isFinite(P)) P = 0;
    var t = {}, fila = function (id) { return t[id] || (t[id] = { id: id, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, jugar: 0 }); };
    (equipos || []).forEach(function (id) { if (id) fila(String(id)); });
    var recuperados = {}; // un aplazado con su recuperación ya cuenta por ella
    ps.forEach(function (p) { if (p.ID_PARTIDO_ORIGEN && p.ESTADO !== 'Anulado') recuperados[p.ID_PARTIDO_ORIGEN] = 1; });
    ps.forEach(function (p) {
      var l = String(p.ID_INSCRIPCION_LOCAL || ''), v = String(p.ID_INSCRIPCION_VISITANTE || '');
      if (!l || !v) return;
      var a = fila(l), b = fila(v);
      if (p.ESTADO === 'Programado' || (p.ESTADO === 'Aplazado' && !recuperados[p.ID])) { a.jugar++; b.jugar++; return; }
      var an = resultadoAnulado(p, anulado);
      if (!conResultado(p) && !an) return;
      var gl = an ? an.gl : num(p.GOLES_LOCAL), gv = an ? an.gv : num(p.GOLES_VISITANTE);
      [[a, gl, gv], [b, gv, gl]].forEach(function (x) {
        var e = x[0];
        e.pj++; e.gf += x[1]; e.gc += x[2];
        if (x[1] > x[2]) { e.pg++; e.pts += G; } else if (x[1] === x[2]) { e.pe++; e.pts += E; } else { e.pp++; e.pts += P; }
      });
    });
    nombres = nombres || {};
    return Object.keys(t).map(function (k) { var e = t[k]; e.dg = e.gf - e.gc; return e; }).sort(function (a, b) {
      return b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || String(nombres[a.id] || a.id).localeCompare(String(nombres[b.id] || b.id), 'es');
    }).map(function (e, i) { e.pos = i + 1; return e; });
  }

  /**
   * El resultado que cuenta de un partido anulado por culpa de un equipo (ANULADO_POR): pierde 0-n (n = 5 por defecto).
   * { gl, gv } o null (no anulado, sin culpable o n = 0).
   */
  function resultadoAnulado(p, n) {
    n = n === undefined || n === null || n === '' ? 5 : num(n);
    if (p.ESTADO !== 'Anulado' || !p.ANULADO_POR || !(n > 0)) return null;
    if (p.ANULADO_POR === p.ID_INSCRIPCION_LOCAL) return { gl: 0, gv: n };
    if (p.ANULADO_POR === p.ID_INSCRIPCION_VISITANTE) return { gl: n, gv: 0 };
    return null;
  }

  /**
   * Los días de juego de unos partidos, en orden: [{ fecha, jornadas (las de sus partidos que no son recuperación), jr
   * (solo hay recuperaciones de aplazados: «jornada de recuperación»), jugado (ya no queda nada por jugar), ps }].
   */
  function diasDeJuego(ps) {
    var o = {};
    ps.forEach(function (p) { if (p.FECHA) (o[p.FECHA] = o[p.FECHA] || []).push(p); });
    return Object.keys(o).sort().map(function (f) {
      var de = o[f], js = jornadas(de.filter(function (p) { return !p.ID_PARTIDO_ORIGEN; }));
      return { fecha: f, jornadas: js, jr: !js.length, jugado: de.every(function (p) { return p.ESTADO !== 'Programado'; }), ps: de };
    });
  }
  /**
   * Cómo va un día de juego, para su barrita: cuántos partidos hay jugados, anulados, aplazados (o suspendidos) y por
   * jugar. Los de campo libre no cuentan. { jugado, anulado, aplazado, pendiente, total }.
   */
  function resumenDia(ps) {
    var r = { jugado: 0, anulado: 0, aplazado: 0, pendiente: 0, total: 0 };
    ps.forEach(function (p) {
      if (p.ESTADO === 'Libre' || !p.ID_INSCRIPCION_LOCAL || !p.ID_INSCRIPCION_VISITANTE) return;
      r.total++;
      if (p.ESTADO === 'Jugado') r.jugado++;
      else if (p.ESTADO === 'Anulado') r.anulado++;
      else if (p.ESTADO === 'Aplazado' || p.ESTADO === 'Suspendido') r.aplazado++;
      else r.pendiente++;
    });
    return r;
  }
  /** El día que se abre: el primero de hoy en adelante; si no hay, el último. */
  function diaInicial(dias, h) {
    var x = dias.filter(function (d) { return d.fecha >= h; })[0] || dias[dias.length - 1];
    return x ? x.fecha : '';
  }

  /** Goleadoras de unos partidos (ids): [{ jugadora, equipo, goles }], de más a menos. Los goles en propia no cuentan. */
  function goleadoras(goles, ids) {
    var en = {}, g = {};
    (ids || []).forEach(function (id) { en[String(id)] = 1; });
    (goles || []).forEach(function (x) {
      if (!en[String(x.ID_PARTIDO)] || !x.ID_INSCRIPCION_JUGADORA || x._nueva) return;
      var k = String(x.ID_INSCRIPCION_JUGADORA);
      (g[k] = g[k] || { jugadora: k, equipo: String(x.ID_INSCRIPCION_EQUIPO || ''), goles: 0 }).goles++;
    });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.goles - a.goles || orden(a.jugadora, b.jugadora); });
  }

  /**
   * Goleadoras por persona: los goles de unos partidos (ids) juntos por jugadora. nombres: { ID_INSCRIPCION_JUGADORA:
   * { J (su ID_JUGADORA) } } (ligasNombres): con él, una jugadora con varias inscripciones (otra temporada, la copa…) cuenta
   * una vez; sin él, cada inscripción aparte. [{ clave ('J:…' o 'I:…'), ijs, equipos (inscripciones de equipo), goles }].
   */
  function rankingPersonas(goles, ids, nombres) {
    var en = {}, g = {}, l = [];
    (ids || []).forEach(function (id) { en[String(id)] = 1; });
    nombres = nombres || {};
    (goles || []).forEach(function (x) {
      if (!en[String(x.ID_PARTIDO)] || !x.ID_INSCRIPCION_JUGADORA || x._nueva) return;
      var ij = String(x.ID_INSCRIPCION_JUGADORA), n = nombres[ij], k = n && n.J ? 'J:' + n.J : 'I:' + ij;
      if (!g[k]) { g[k] = { clave: k, ijs: [], equipos: [], goles: 0 }; l.push(g[k]); }
      g[k].goles++;
      if (g[k].ijs.indexOf(ij) < 0) g[k].ijs.push(ij);
      var e = String(x.ID_INSCRIPCION_EQUIPO || '');
      if (e && g[k].equipos.indexOf(e) < 0) g[k].equipos.push(e);
    });
    return l.sort(function (a, b) { return b.goles - a.goles || orden(a.clave, b.clave); });
  }
  /** Goles, partidos jugados y media por partido de unos partidos (los jugados con resultado). */
  function resumenGoles(ps) {
    var j = ps.filter(conResultado), g = j.reduce(function (t, p) { return t + num(p.GOLES_LOCAL) + num(p.GOLES_VISITANTE); }, 0);
    return { goles: g, jugados: j.length, media: j.length ? Math.round(g / j.length * 10) / 10 : 0 };
  }
  /**
   * Las estadísticas de una jugadora con todas sus inscripciones (ijs): sus goles por temporada (temporadaDe: idLiga →
   * temporada) con sus equipos y cuántos partidos jugaron (con resultado), el total y su mejor partido.
   * { total, temporadas: [{ temporada, equipos, ligas, goles, jugados }] (la más nueva primero), mejor: { partido, goles } }.
   */
  function estadisticasJugadora(goles, partidos, ijs, temporadaDe) {
    var mias = {}, pi = indice(partidos), t = {}, porPartido = {}, total = 0;
    ijs.forEach(function (i) { mias[String(i)] = 1; });
    goles.forEach(function (g) {
      if (!mias[String(g.ID_INSCRIPCION_JUGADORA)]) return;
      var p = pi[String(g.ID_PARTIDO)];
      if (!p) return;
      var tem = temporadaDe(p.ID_LIGA) || '', x = t[tem] || (t[tem] = { temporada: tem, equipos: [], ligas: [], goles: 0, jugados: 0 });
      x.goles++; total++;
      if (x.equipos.indexOf(g.ID_INSCRIPCION_EQUIPO) < 0) x.equipos.push(g.ID_INSCRIPCION_EQUIPO);
      if (x.ligas.indexOf(p.ID_LIGA) < 0) x.ligas.push(p.ID_LIGA);
      porPartido[p.ID] = (porPartido[p.ID] || 0) + 1;
    });
    Object.keys(t).forEach(function (k) {
      var x = t[k];
      x.jugados = partidos.filter(function (p) { return conResultado(p) && (x.equipos.indexOf(p.ID_INSCRIPCION_LOCAL) >= 0 || x.equipos.indexOf(p.ID_INSCRIPCION_VISITANTE) >= 0); }).length;
    });
    var mejor = Object.keys(porPartido).sort(function (a, b) { return porPartido[b] - porPartido[a] || orden(a, b); })[0];
    return { total: total, temporadas: Object.keys(t).map(function (k) { return t[k]; }).sort(function (a, b) { return orden(b.temporada, a.temporada); }),
      mejor: mejor ? { partido: mejor, goles: porPartido[mejor] } : null };
  }
  /** Un día marcado como festivo o descanso en CALENDARIO que tiene partidos (no debería): { motivo, n } o null. */
  function choqueCalendario(cal, f, ps) {
    var c = (cal || []).filter(function (x) { return x.FECHA === f; })[0];
    if (!c || !(c.FESTIVO || c.DESCANSO)) return null;
    var n = ps.filter(function (p) { return p.FECHA === f && CON_MOTIVO.indexOf(p.ESTADO) < 0 && p.ESTADO !== 'Libre'; }).length;
    return n ? { motivo: (c.FESTIVO ? 'festivo' : 'descanso') + (c.MOTIVO ? ' (' + c.MOTIVO + ')' : ''), n: n } : null;
  }

  /** ¿Es un gol de puntualidad (el que se da al equipo cuando el rival llega muy tarde)? Sin jugadora y «Puntualidad» en NOTAS. */
  function esPuntualidad(g) { return !g.ID_INSCRIPCION_JUGADORA && String(g.NOTAS || '').trim() === PUNTUALIDAD; }
  /**
   * Los goles de un equipo en un partido, juntos: [{ jugadora, tipo, goles }]. tipo: 'jugadora', 'puntualidad' o
   * 'nadie' (en propia: no lo marca nadie del equipo). Primero las jugadoras.
   */
  function golesEquipo(goles, eq) {
    var o = {}, l = [], peso = { jugadora: 0, nadie: 1, puntualidad: 2 };
    (goles || []).forEach(function (g) {
      if (String(g.ID_INSCRIPCION_EQUIPO) !== String(eq)) return;
      var tipo = g.ID_INSCRIPCION_JUGADORA ? 'jugadora' : esPuntualidad(g) ? 'puntualidad' : 'nadie', k = tipo + '|' + String(g.ID_INSCRIPCION_JUGADORA || '');
      if (!o[k]) { o[k] = { jugadora: String(g.ID_INSCRIPCION_JUGADORA || ''), tipo: tipo, goles: 0 }; l.push(o[k]); }
      o[k].goles++;
    });
    return l.sort(function (a, b) { return peso[a.tipo] - peso[b.tipo] || b.goles - a.goles; });
  }

  var MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  /** «2026-11-09» → «lunes 9 de noviembre». */
  function fechaLarga(s) { var d = deIso(s); return d ? DIAS[d.getDay()].toLowerCase() + ' ' + d.getDate() + ' de ' + MESES_LARGOS[d.getMonth()] : String(s || ''); }
  /**
   * El WhatsApp para la capitana de un equipo cuando cambian sus partidos: un bloque por partido con lo que cambia, cómo
   * estaba y cómo queda (lo que cambia, en negrita de WhatsApp). a: { capitana, liga, partidos: [{ titulo, jornada,
   * antes: { dia, hora, campo }, ahora: { dia, hora, campo }, recupera (la recuperación de un aplazado) }] }; dia en aaaa-mm-dd.
   */
  function textoAviso(a) {
    var ps = a.partidos || [], nombre = String(a.capitana || '').trim().split(/\s+/)[0];
    var l = ['Hola' + (nombre ? ' ' + nombre : '') + ', te escribo de Konamigas.', '',
      (ps.length && ps.every(function (p) { return p.recupera; }) ? (ps.length === 1 ? 'Se recupera vuestro partido aplazado de ' : 'Se recuperan ' + ps.length + ' partidos aplazados vuestros de ')
        : ps.length === 1 ? 'Cambia vuestro partido de ' : 'Cambian ' + ps.length + ' partidos vuestros de ') + a.liga + ':'];
    ps.forEach(function (p) {
      var c = { dia: p.antes.dia !== p.ahora.dia, hora: p.antes.hora !== p.ahora.hora, campo: p.antes.campo !== p.ahora.campo };
      var que = [c.dia ? 'el día' : '', c.hora ? 'la hora' : '', c.campo ? 'el campo' : ''].filter(String);
      var cosa = function (x, k) { var t = k === 'dia' ? fechaLarga(x.dia) : k === 'hora' ? 'a las ' + x.hora : 'en ' + x.campo; return t; };
      l.push('', '*' + p.titulo + '* (jornada ' + p.jornada + ')',
        p.recupera ? 'Estaba aplazado.' : 'Cambia ' + (que.length > 1 ? que.slice(0, -1).join(', ') + ' y ' + que[que.length - 1] : que[0] || 'nada') + '.',
        (p.recupera ? 'Era: ' : 'Antes: ') + ['dia', 'hora', 'campo'].map(function (k) { return cosa(p.antes, k); }).join(', '),
        'Ahora: ' + ['dia', 'hora', 'campo'].map(function (k) { return c[k] ? '*' + cosa(p.ahora, k) + '*' : cosa(p.ahora, k); }).join(', '));
    });
    l.push('', '¡Gracias! Cualquier duda, me dices.');
    return l.join('\n');
  }

  /** Los equipos inscritos en una liga que no juegan en esa jornada (descansan). */
  function descansan(ps, equipos) {
    var juega = {};
    ps.forEach(function (p) { juega[p.ID_INSCRIPCION_LOCAL] = 1; juega[p.ID_INSCRIPCION_VISITANTE] = 1; });
    return (equipos || []).filter(function (id) { return !juega[id]; });
  }

  /** Los equipos de unos partidos, sin repetir. */
  function equiposDe(ps) {
    var r = [];
    ps.forEach(function (p) { [p.ID_INSCRIPCION_LOCAL, p.ID_INSCRIPCION_VISITANTE].forEach(function (e) { if (e && r.indexOf(e) < 0) r.push(e); }); });
    return r;
  }

  /** ¿Puede cerrar el acta? Quien administra, un perfil de ACTA_TODAS o el árbitro del partido, desde el día del partido. */
  function puedeActa(p, quien) {
    // Un aplazado no tiene acta: se cierra la de su recuperación.
    if (!p || p.ESTADO === 'Libre' || p.ESTADO === 'Anulado' || p.ESTADO === 'Aplazado' || !p.ID_INSCRIPCION_LOCAL || !p.ID_INSCRIPCION_VISITANTE) return false;
    if (String(p.FECHA || '') > hoy()) return false; // el acta se cierra el día del partido o después
    if (quien.admin || (quien.actaTodas || []).indexOf(quien.perfil) >= 0) return true;
    return !!quien.yo && (p.ID_ARBITRO === quien.yo || p.ID_ARBITRO_REAL === quien.yo);
  }

  /**
   * Los huecos a los que se puede mover un partido el mismo día (como ligasMover del motor): los de su liga en su día de
   * la semana. Cada uno: { hueco, estado: 'actual' | 'libre' | 'cambio' (lo ocupa otro de la liga: se intercambian) |
   * 'ocupado' (otro de otra liga, o uno que no se mueve), otro }.
   */
  function huecosMover(ps, huecos, p) {
    var dia = diaSemana(p.FECHA);
    return (huecos || []).filter(function (h) { return String(h.ID_LIGA) === String(p.ID_LIGA) && (!h.DIA_SEMANA || !dia || h.DIA_SEMANA === dia); })
      .sort(function (a, b) { return orden(String(a.HORA), String(b.HORA)) || orden(String(a.ID_CAMPO), String(b.ID_CAMPO)); })
      .map(function (h) {
        if (String(h.HORA) === String(p.HORA) && String(h.ID_CAMPO) === String(p.ID_CAMPO)) return { hueco: h, estado: 'actual' };
        var otro = ps.filter(function (o) {
          return o.ID !== p.ID && CON_MOTIVO.indexOf(o.ESTADO) < 0 && String(o.FECHA) === String(p.FECHA) && String(o.HORA) === String(h.HORA) && String(o.ID_CAMPO) === String(h.ID_CAMPO);
        })[0];
        if (!otro) return { hueco: h, estado: 'libre' };
        return { hueco: h, otro: otro, estado: String(otro.ID_LIGA) === String(p.ID_LIGA) && otro.ESTADO === 'Programado' ? 'cambio' : 'ocupado' };
      });
  }

  /**
   * Si las jornadas a y b de una liga se pueden intercambiar (como ligasJornadas del motor): { ok, motivo, fecha, ps } de
   * cada una. Sin partidos jugados, de h (hoy) en adelante y cada una en un solo día; los aplazados, suspendidos y
   * anulados no se mueven.
   */
  function jornadaMovible(ps, n, h) {
    var de = ps.filter(function (p) { return num(p.JORNADA) === n; });
    if (!de.length) return { ok: false, motivo: 'sin partidos' };
    if (de.some(function (p) { return p.ESTADO === 'Jugado'; })) return { ok: false, motivo: 'ya tiene partidos jugados' };
    // Las recuperaciones de aplazados tienen su propio día: no se mueven con la jornada.
    var mover = de.filter(function (p) { return CON_MOTIVO.indexOf(p.ESTADO) < 0 && !p.ID_PARTIDO_ORIGEN; }), dias = {};
    if (!mover.length) return { ok: false, motivo: 'sin partidos programados que mover' };
    mover.forEach(function (p) { dias[p.FECHA] = 1; });
    if (Object.keys(dias).length !== 1) return { ok: false, motivo: 'tiene partidos en varios días' };
    if (h && Object.keys(dias)[0] < h) return { ok: false, motivo: 'ya ha pasado' };
    return { ok: true, fecha: Object.keys(dias)[0], ps: mover };
  }

  /**
   * El hueco de una liga un día a una hora y en un campo (como ligasHuecoEn_ del motor), o null. Su ID_ARBITRO es el árbitro
   * de esa instalación a esa hora: el que se lleva por defecto el partido que llega ahí.
   */
  function huecoEn(huecos, idLiga, f, hora, campo) {
    var dia = diaSemana(f);
    return (huecos || []).filter(function (h) {
      return String(h.ID_LIGA) === String(idLiga) && (!h.DIA_SEMANA || !dia || h.DIA_SEMANA === dia) && String(h.HORA) === String(hora) && String(h.ID_CAMPO) === String(campo);
    })[0] || null;
  }
  /** El árbitro que se lleva un partido al llegar a un día, hora y campo: el de su hueco o, si no tiene, el suyo. */
  function arbitroEn(huecos, p, f, hora, campo) { var h = huecoEn(huecos, p.ID_LIGA, f, hora, campo); return (h && h.ID_ARBITRO) || p.ID_ARBITRO || ''; }

  /** La recuperación de un aplazado (el partido con ID_PARTIDO_ORIGEN = su ID, que no esté anulado), o null. */
  function recuperacionDe(ps, id) { return ps.filter(function (p) { return p.ID_PARTIDO_ORIGEN === id && p.ESTADO !== 'Anulado'; })[0] || null; }
  /** Los aplazados de una liga que aún no tienen recuperación, por jornada y fecha. */
  function aplazadosPendientes(ps, idLiga) {
    return ps.filter(function (p) { return String(p.ID_LIGA) === String(idLiga) && p.ESTADO === 'Aplazado' && !recuperacionDe(ps, p.ID); })
      .sort(function (a, b) { return num(a.JORNADA) - num(b.JORNADA) || orden(cuando(a), cuando(b)); });
  }
  /** Huecos de una liga libres un día: los de su día de la semana que no ocupa ningún partido (salvo aplazados, suspendidos y anulados). */
  function huecosLibres(ps, huecos, idLiga, f) {
    var dia = diaSemana(f), usados = {};
    ps.forEach(function (o) { if (String(o.FECHA) === f && CON_MOTIVO.indexOf(o.ESTADO) < 0) usados[o.HORA + '|' + o.ID_CAMPO] = 1; });
    return (huecos || []).filter(function (h) { return String(h.ID_LIGA) === String(idLiga) && (!h.DIA_SEMANA || h.DIA_SEMANA === dia) && !usados[h.HORA + '|' + h.ID_CAMPO]; })
      .sort(function (a, b) { return orden(String(a.HORA), String(b.HORA)) || orden(String(a.ID_CAMPO), String(b.ID_CAMPO)); });
  }
  /**
   * Cómo quedan unos aplazados recuperados un día (como ligasRecuperar del motor): cada uno en el siguiente hueco libre
   * de su liga, por hora. { asignaciones: [{ p, hueco }], error }: error si no hay huecos para todos o si un equipo ya
   * juega ese día (o dos veces entre los elegidos; equipo: cuál).
   */
  /** Los equipos que juegan más de uno de estos partidos (no pueden recuperarse todos el mismo día). */
  function repetidos(aplazados) {
    var n = {}, r = [];
    aplazados.forEach(function (p) { [p.ID_INSCRIPCION_LOCAL, p.ID_INSCRIPCION_VISITANTE].forEach(function (e) { n[e] = (n[e] || 0) + 1; if (n[e] === 2) r.push(e); }); });
    return r;
  }
  function planRecuperar(ps, huecos, f, aplazados) {
    var juegan = {}, libres = {}, asig = [], error = '', ocupado = '';
    ps.forEach(function (o) { if (String(o.FECHA) === f && CON_MOTIVO.indexOf(o.ESTADO) < 0) { juegan[o.ID_INSCRIPCION_LOCAL] = 1; juegan[o.ID_INSCRIPCION_VISITANTE] = 1; } });
    aplazados.forEach(function (p) {
      if (error) return;
      var l = String(p.ID_LIGA);
      if (!libres[l]) libres[l] = huecosLibres(ps, huecos, l, f);
      var otra = [p.ID_INSCRIPCION_LOCAL, p.ID_INSCRIPCION_VISITANTE].filter(function (e) { return juegan[e]; })[0];
      if (otra) { error = 'equipo ocupado'; ocupado = otra; return; }
      var h = libres[l].shift();
      if (!h) { error = 'faltan huecos'; return; }
      juegan[p.ID_INSCRIPCION_LOCAL] = juegan[p.ID_INSCRIPCION_VISITANTE] = 1;
      asig.push({ p: p, hueco: h });
    });
    return { asignaciones: error ? [] : asig, error: error, equipo: ocupado };
  }
  /**
   * Días para recuperar unos aplazados de una liga: los días de la semana de sus huecos, de desde a hasta (como mucho max).
   * Cada uno: { fecha, libres (cuántos huecos libres), sinPartidos (la liga no juega ese día), especial (festivo o
   * descanso de CALENDARIO), ok, motivo }.
   */
  function diasRecuperar(ps, huecos, cal, idLiga, aplazados, desde, hasta, max) {
    var dias = {}, r = [];
    (huecos || []).forEach(function (h) { if (String(h.ID_LIGA) === String(idLiga) && h.DIA_SEMANA) dias[h.DIA_SEMANA] = 1; });
    var calI = indice(cal, 'FECHA');
    for (var f = desde, i = 0; f && f <= hasta && i < 400 && r.length < (max || 12); f = sumarDias(f, 1), i++) {
      if (!dias[diaSemana(f)]) continue;
      var c = calI[f], esp = c && (c.FESTIVO || c.DESCANSO) ? (c.FESTIVO ? 'Festivo' : 'Descanso') + (c.MOTIVO ? ': ' + c.MOTIVO : '') : '';
      var libres = huecosLibres(ps, huecos, idLiga, f).length;
      var sin = !ps.some(function (o) { return String(o.ID_LIGA) === String(idLiga) && String(o.FECHA) === f && CON_MOTIVO.indexOf(o.ESTADO) < 0; });
      var plan = planRecuperar(ps, huecos, f, aplazados);
      var motivo = esp ? esp : plan.error === 'faltan huecos' ? (libres ? 'solo ' + libres + (libres === 1 ? ' hueco libre' : ' huecos libres') : 'sin huecos libres')
        : plan.error === 'equipo ocupado' ? 'algún equipo ya juega ese día' : '';
      r.push({ fecha: f, libres: libres, sinPartidos: sin, especial: esp, ok: !motivo, motivo: motivo, equipo: !esp && plan.error === 'equipo ocupado' ? plan.equipo : '' });
    }
    return r;
  }

  /**
   * T0274 · Cómo está la copia de los pagos y las tarifas del staff (ligasPagosStaff del motor): { ultima, noche, error } →
   * las frases para Socio. ahora: 'aaaa-mm-ddThh:mm' (para ver si la copia de la noche lleva días sin hacerse).
   * { ultima: texto, nocheMal: texto o '', error: texto o '', avisos: [texto], mas: n }.
   */
  function estadoCopia(e, ahora) {
    e = e || {};
    var u = e.ultima, n = e.noche;
    var cuando = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] + ' a las ' + m[4] : String(s || ''); };
    var dias = function (s) { var a = deIso(s), b = deIso(ahora); return a && b ? Math.round((b - a) / 86400000) : 0; };
    var out = { ultima: '', nocheMal: '', error: e.error || '', avisos: u && u.avisos ? u.avisos : [], mas: u && u.mas || 0 };
    out.ultima = !u ? 'Todavía no se han copiado nunca.' : 'Última copia: ' + cuando(u.cuando) + ' (' + (u.quien === 'Cada noche' ? 'la de cada noche' : u.quien || '—') + '): ' +
      u.pagos + (u.pagos === 1 ? ' pago' : ' pagos') + ' y ' + u.tarifas + (u.tarifas === 1 ? ' tarifa.' : ' tarifas.');
    if (n && n.error) out.nocheMal = 'La copia de la noche del ' + cuando(n.cuando).split(' a las')[0] + ' ha fallado: ' + n.error;
    else if (!n || !n.cuando) out.nocheMal = 'La copia de cada noche todavía no está en marcha: la pone Utilo.';
    else if (dias(n.cuando) > 2) out.nocheMal = 'La copia de cada noche no se hace desde el ' + cuando(n.cuando).split(' a las')[0] + ': avisa a Utilo.';
    return out;
  }

  var CALC = { hoy: hoy, estadoCopia: estadoCopia, fecha: fecha, fechaDia: fechaDia, lunes: lunes, sumarDias: sumarDias, temporadaActual: temporadaActual, ligasDe: ligasDe,
    jornadas: jornadas, jornadaInicial: jornadaInicial, clasificacion: clasificacion, goleadoras: goleadoras, golesEquipo: golesEquipo,
    descansan: descansan, equiposDe: equiposDe, puedeActa: puedeActa, conResultado: conResultado, incompleto: incompleto, huecosMover: huecosMover, huecoEn: huecoEn, arbitroEn: arbitroEn, jornadaMovible: jornadaMovible,
    textoAviso: textoAviso, fechaLarga: fechaLarga, recuperacionDe: recuperacionDe, aplazadosPendientes: aplazadosPendientes, huecosLibres: huecosLibres,
    planRecuperar: planRecuperar, diasRecuperar: diasRecuperar, repetidos: repetidos, resultadoAnulado: resultadoAnulado, diasDeJuego: diasDeJuego,
    diaInicial: diaInicial, resumenDia: resumenDia, rankingPersonas: rankingPersonas, resumenGoles: resumenGoles, estadisticasJugadora: estadisticasJugadora,
    choqueCalendario: choqueCalendario };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  var TABLAS = ['TEMPORADAS', 'COMPETICIONES', 'LIGAS', 'PARTIDOS', 'GOLES', 'CAMPOS', 'INSTALACIONES', 'CALENDARIO', 'INSCRIPCIONES_EQUIPOS', 'HUECOS'];
  var PESTANAS = { PARTIDOS: 'Partidos', CLASIFICACION: 'Clasificación', GOLEADORAS: 'Goleadoras' };
  var ANTES = { JORNADAS: 'PARTIDOS', CALENDARIO: 'PARTIDOS' }; // las pestañas de antes de T0255 (jornadas y calendario, juntas)
  var ESTADOS = { Programado: 'ni', Jugado: 'co', Aplazado: 'pr', Suspendido: 'pr', Anulado: 'bl', Libre: 'x' };
  var JUG = {}; // jugadoras de cada equipo inscrito (ligasJugadoras), mientras la página está abierta
  var NOM = {}; // nombre, dorsal y persona de cada inscripción que ha marcado (ligasNombres), también guardado en el dispositivo

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function opciones(lista, sel, vacio) {
    return (vacio !== undefined ? '<option value="">' + texto(vacio) + '</option>' : '') + lista.map(function (o) {
      return '<option value="' + texto(o[0]) + '"' + (String(o[0]) === String(sel == null ? '' : sel) ? ' selected' : '') + '>' + texto(o[1]) + '</option>';
    }).join('');
  }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) {} return ''; }
  function guardadoJson(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} return null; }
  function lista(v) { return [].concat(v || []).map(function (x) { return String(x).trim(); }); }
  /** Enlace de WhatsApp a un teléfono (con el mensaje ya escrito): la app en el móvil y WhatsApp Web en el ordenador. */
  function wa(tel, msg) {
    var t = String(tel || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
    if (!t) return '';
    if (t.length === 9) t = '34' + t;
    var m = msg ? '&text=' + encodeURIComponent(msg) : '';
    return (/Android|iPhone|iPad/i.test(navigator.userAgent) ? 'whatsapp://send?phone=' : 'https://web.whatsapp.com/send?phone=') + t + m;
  }

  window.UN.registrar('LIGAS', {
    abrir: function (el, ctx) {
      var T = ctx.tablas, cfg = ctx.config || {};
      var pest = String(cfg.PESTANAS || Object.keys(PESTANAS).join(',')).split(',').map(function (s) { s = s.trim().toUpperCase(); return ANTES[s] || s; })
        .filter(function (s, i, l) { return PESTANAS[s] && l.indexOf(s) === i; });
      if (!pest.length) pest = Object.keys(PESTANAS);
      var CLAVE = 'lig_' + ctx.id + '_';
      var KSTAFF = CLAVE + 'staff_' + String(ctx.correo || ctx.persona || '').toLowerCase(), KCOL = CLAVE + 'colores';
      var staff = guardadoJson(KSTAFF) || { yo: '', staff: [] }, colores = guardadoJson(KCOL) || {}, KNOM = CLAVE + 'nombres';
      var nomG = guardadoJson(KNOM); if (nomG) Object.keys(nomG).forEach(function (k) { if (!NOM[k]) NOM[k] = nomG[k]; });
      var quien = { admin: !!ctx.admin, perfil: ctx.perfil, actaTodas: lista(cfg.ACTA_TODAS), yo: staff.yo };
      var programa = !!ctx.admin || lista(cfg.PROGRAMAR).indexOf(ctx.perfil) >= 0;
      // comp: la competición elegida ('*' = todas, solo en Partidos); fecha: el día de juego abierto en Partidos; golAmbito:
      // las goleadoras de la liga o de toda la competición; q: lo que se busca en Goleadoras.
      var S = { tab: pest.indexOf(guardado(CLAVE + 'tab')) >= 0 ? guardado(CLAVE + 'tab') : '', temp: guardado(CLAVE + 'temp'), comp: guardado(CLAVE + 'comp'),
        liga: guardado(CLAVE + 'liga'), fecha: '', jornada: null, golAmbito: guardado(CLAVE + 'golamb') || 'liga', q: '', mios: guardado(CLAVE + 'mios2') ? guardado(CLAVE + 'mios2') === 'si' : !programa && lista(cfg.ACTA_TODAS).indexOf(ctx.perfil) < 0, leido: false };
      // Un árbitro viene a ver sus partidos: entra en Partidos, de todas las competiciones y solo los suyos.
      var arbitra = !programa && quien.actaTodas.indexOf(ctx.perfil) < 0;
      // T0277: desde Perfil (?s=ligas&partido=PAR…, al tocar un partido o un acta por cerrar) se abre la ficha de ese partido,
      // con Partidos en su día detrás. El parámetro se quita de la dirección para que al volver no se abra otra vez.
      var urlP = new URL(location.href), pedido = urlP.searchParams.get('partido') || '';
      if (pedido) { urlP.searchParams.delete('partido'); history.replaceState(history.state, '', urlP.pathname + urlP.search); }
      if (!S.tab) S.tab = pest[0];
      if (arbitra && !S.comp) S.comp = '*';

      el.innerHTML = (cfg.AYUDA ? '<p class="u-nota n-ayuda">' + texto(cfg.AYUDA) + '</p>' : '') +
        // Filtros: en el ordenador, a la vista; en el móvil, recogidos en una línea con lo que se ve y «Cambiar».
        '<div class="lg-filtros" id="lg-filtros"><button type="button" class="lg-filtros-res" id="lg-fres" aria-expanded="false" aria-controls="lg-fcuerpo"></button>' +
        '<div class="lg-filtros-cuerpo" id="lg-fcuerpo">' +
        '<div class="lg-barra"><label class="u-campo lg-temp"><span class="u-etiqueta">Temporada</span><select id="lg-temp"></select></label>' +
        '<label class="u-check lg-mios" hidden><input type="checkbox" id="lg-mios"> Solo mis partidos</label></div>' +
        '<div class="lg-elige" id="lg-elige"></div></div></div>' +
        '<div class="u-pestanas" role="tablist">' + pest.map(function (p) { return '<button type="button" role="tab" data-tab="' + p + '">' + PESTANAS[p] + '</button>'; }).join('') + '</div>' +
        // T0277: si viene de Perfil a ver un partido, lo dice mientras se leen las tablas (antes, Ligas vacío con el cargador).
        '<div id="lg-cont" class="lg-cont"><div class="kz-centro" role="status"><div class="u-carga"></div>' + (pedido ? '<p>Abriendo el partido…</p>' : '') + '</div></div>' +
        '<div id="lg-copia" class="u-bloque" hidden></div>' +
        '<div class="u-velo" id="lg-velo"><div class="u-ventana" role="dialog" aria-modal="true" aria-labelledby="lg-vt"><div class="n-ventana" id="lg-vent"></div></div></div>';
      var cont = el.querySelector('#lg-cont'), velo = el.querySelector('#lg-velo'), vent = el.querySelector('#lg-vent');
      var selTemp = el.querySelector('#lg-temp'), chkMios = el.querySelector('#lg-mios'), elige = el.querySelector('#lg-elige');

      /* ---------- pagos y tarifas del staff (T0274) ---------- */

      // Árbitros y gestores no tienen ECONOMIA: sus cobros y su nivel salen de una copia en COMPETICION que el motor rehace
      // al apuntar un pago en Economía y cada noche. Quien puede (ACTUALIZAR_PAGOS, Socio) ve al final cómo está y la rehace.
      var copiaEl = el.querySelector('#lg-copia'), copiaPuede = !!ctx.admin || lista(cfg.ACTUALIZAR_PAGOS).indexOf(ctx.perfil) >= 0, copiaE = null, copiando = false;
      function pintarCopia() {
        if (!copiaPuede || !copiaE) { copiaEl.hidden = true; return; }
        var x = estadoCopia(copiaE, hoy() + 'T00:00');
        copiaEl.hidden = false;
        copiaEl.innerHTML = '<p><b>Pagos y tarifas del staff</b></p>' +
          '<p class="u-nota">Árbitros y gestores no tienen Economía: sus cobros y su nivel salen de una copia que se hace sola al apuntar un pago a staff en Economía y cada noche. Si has cambiado algo a mano en el Excel ECONOMIA, cópialos ahora.</p>' +
          '<p class="u-nota">' + texto(x.ultima) + '</p>' +
          (x.nocheMal ? '<p class="u-error">' + texto(x.nocheMal) + '</p>' : '') + (x.error ? '<p class="u-error">' + texto(x.error) + '</p>' : '') +
          (x.avisos.length ? '<details><summary class="u-nota">' + (x.avisos.length + x.mas === 1 ? '1 pago parece de staff, pero no es de nadie de STAFF: no se copia' :
            (x.avisos.length + x.mas) + ' pagos parecen de staff, pero no son de nadie de STAFF: no se copian') + '</summary><ul class="u-nota">' +
            x.avisos.map(function (a) { return '<li>' + texto(a) + '</li>'; }).join('') + (x.mas ? '<li>y ' + x.mas + ' más</li>' : '') + '</ul></details>' : '') +
          '<p><button type="button" class="u-btn" data-accion="copiar"' + (copiando ? ' disabled' : '') + '>' + (copiando ? 'Copiando…' : 'Actualizar pagos del staff') + '</button></p>';
      }
      function copiar() {
        if (copiando) return;
        copiando = true; pintarCopia();
        ctx.llamar('ligasPagosStaff', [true]).then(function (e) {
          copiando = false; copiaE = e || {}; pintarCopia();
          var u = copiaE.ultima;
          if (ctx.abierta() && u) ctx.aviso(u.cambiada ? 'Pagos del staff copiados: ' + u.pagos + ' pagos y ' + u.tarifas + ' tarifas.' : 'Los pagos del staff ya estaban al día.');
        }, function (err) {
          copiando = false; pintarCopia();
          if (ctx.abierta()) ctx.aviso('No se han podido copiar: ' + String(err.message).replace(/^\w+:\s*/, ''));
        });
      }

      /* ---------- datos ---------- */

      var d, ix, temp, ligas, comps, actual, todas;
      function preparar() {
        d = { temp: T.filas('TEMPORADAS'), comp: T.filas('COMPETICIONES'), ligas: T.filas('LIGAS'), par: T.filas('PARTIDOS'), gol: T.filas('GOLES'),
          cam: T.filas('CAMPOS'), ins: T.filas('INSTALACIONES'), cal: T.filas('CALENDARIO'), eq: T.filas('INSCRIPCIONES_EQUIPOS'), hue: T.filas('HUECOS') };
        ix = { comp: indice(d.comp), liga: indice(d.ligas), cam: indice(d.cam), ins: indice(d.ins), cal: indice(d.cal, 'FECHA'), eq: indice(d.eq),
          staff: indice(staff.staff) };
        var ts = temporadas(d.temp);
        temp = ts.filter(function (t) { return t.ID === S.temp; })[0] || temporadaActual(d.temp, hoy());
        selTemp.innerHTML = opciones(ts.map(function (t) { return [t.ID, t.NOMBRE]; }), temp ? temp.ID : '');
        ligas = temp ? ligasDe(d, temp.ID) : [];
        comps = [];
        ligas.forEach(function (x) { if (comps.indexOf(x.comp) < 0) comps.push(x.comp); });
        // «Todas» solo en Partidos; en las demás pestañas, la primera competición.
        todas = S.comp === '*' && S.tab === 'PARTIDOS';
        var comp = comps.filter(function (c) { return c.ID === S.comp; })[0] || comps[0] || null;
        var deComp = ligas.filter(function (x) { return comp && x.comp.ID === comp.ID; });
        actual = deComp.filter(function (x) { return x.liga.ID === S.liga; })[0] || deComp[0] || null;
      }
      function nomLiga(l) { return String(l.NOMBRE || l.ID) + (l.DIA_SEMANA && String(l.NOMBRE).indexOf(l.DIA_SEMANA) < 0 ? ' · ' + l.DIA_SEMANA : ''); }
      function nomComp(c) { return c ? String(c.NOMBRE_COMERCIAL || c.NOMBRE || c.ID) : ''; }
      function equipo(id) { var e = ix.eq[String(id || '')]; return e ? String(e.NOMBRE_EQUIPO || e.ID) : id ? String(id) : ''; }
      function persona(id) { var s = ix.staff[String(id || '')]; return s ? s.APODO : id ? String(id) : ''; }
      function campo(id) { var c = ix.cam[String(id || '')]; return c ? String(c.ABREVIACION || c.NOMBRE) : String(id || ''); }
      function campoLargo(id) { var c = ix.cam[String(id || '')]; return c ? String(c.NOMBRE || c.ABREVIACION) + (c.ABREVIACION && c.NOMBRE ? ' (' + c.ABREVIACION + ')' : '') : String(id || ''); }
      function colorEq(id) { var e = ix.eq[String(id || '')], c = e && colores[e.ID_COLOR]; return c && c.HEX ? c.HEX : ''; }
      function nomColor(id) { var e = ix.eq[String(id || '')], c = e && colores[e.ID_COLOR]; return c ? c.NOMBRE : ''; }
      /** El punto con el color de la camiseta de un equipo (gris con borde si no se sabe). */
      function punto(id) {
        var c = colorEq(id), n = nomColor(id);
        return '<span class="lg-color' + (c ? '' : ' lg-color-no') + '"' + (c ? ' style="--c:' + texto(c) + '"' : '') + (n ? ' title="' + texto(n) + '"' : '') + ' aria-hidden="true"></span>';
      }
      /** Los goles con que pierde el equipo que provoca un partido anulado (config · RESULTADO_ANULADO, 5 por defecto). */
      function nAnulado() { return cfg.RESULTADO_ANULADO === undefined || cfg.RESULTADO_ANULADO === '' ? 5 : num(cfg.RESULTADO_ANULADO); }
      function partidosLiga(idLiga) { return d.par.filter(function (p) { return String(p.ID_LIGA) === String(idLiga); }); }
      function equiposLiga(idLiga) {
        return d.eq.filter(function (e) { return String(e.ID_LIGA) === String(idLiga) && e.ESTADO !== 'Baja'; }).map(function (e) { return String(e.ID); });
      }
      function golesDe(id) { return d.gol.filter(function (g) { return String(g.ID_PARTIDO) === String(id); }); }
      function arbitro(p) { return p.ID_ARBITRO_REAL || p.ID_ARBITRO; }
      function esMio(p) { return !!quien.yo && (p.ID_ARBITRO === quien.yo || p.ID_ARBITRO_REAL === quien.yo || p.ID_GESTOR === quien.yo); }
      function ligaCompleta(idLiga) { var l = ix.liga[idLiga]; return l ? nomComp(ix.comp[l.ID_COMPETICION]) + ' · ' + nomLiga(l) : ''; }

      /* ---------- pintar ---------- */

      function pintar() {
        if (!S.leido) return;
        preparar();
        [].forEach.call(el.querySelectorAll('[data-tab]'), function (b) {
          var si = b.getAttribute('data-tab') === S.tab;
          b.setAttribute('aria-selected', si ? 'true' : 'false');
          if (si && b.parentNode.scrollWidth > b.parentNode.clientWidth) b.parentNode.scrollLeft = Math.max(0, b.offsetLeft - b.parentNode.offsetLeft - 16);
        });
        el.querySelector('.lg-mios').hidden = S.tab !== 'PARTIDOS' || !quien.yo;
        chkMios.checked = S.mios;
        elige.innerHTML = htmlElige();
        pintarResumen();
        if (!temp) { cont.innerHTML = '<p class="u-vacio">Todavía no hay temporadas. Añade la primera en la tabla TEMPORADAS del Excel COMPETICION.</p>'; return; }
        if (!actual) { cont.innerHTML = '<p class="u-vacio">Esta temporada todavía no tiene ligas. Se crean en las tablas COMPETICIONES y LIGAS del Excel COMPETICION.</p>'; return; }
        cont.innerHTML = ({ PARTIDOS: htmlPartidos, CLASIFICACION: htmlClasificacion, GOLEADORAS: htmlGoleadoras })[S.tab]();
        [].forEach.call(el.querySelectorAll('.lg-fila-chips [aria-pressed=true]'), function (sel) {
          var p = sel.parentNode;
          if (p.scrollWidth > p.clientWidth) p.scrollLeft = Math.max(0, sel.offsetLeft - p.offsetLeft - p.clientWidth / 2 + sel.offsetWidth / 2);
        });
        // La tira de días: el abierto, en medio (se ven los de antes y los de después).
        var tira = cont.querySelector('.lg-dias-tira'), abierto = tira && tira.querySelector('[aria-pressed=true]');
        if (abierto) tira.scrollLeft = Math.max(0, abierto.offsetLeft - tira.offsetLeft - (tira.clientWidth - abierto.offsetWidth) / 2);
        if (S.tab === 'GOLEADORAS') cargarGoleadoras();
      }

      /** La línea de los filtros en el móvil: qué se está viendo (competición y liga, temporada) y «Cambiar». */
      function pintarResumen() {
        var f = el.querySelector('#lg-filtros'), b = el.querySelector('#lg-fres');
        f.classList.toggle('abierto', !!S.filtros);
        b.setAttribute('aria-expanded', S.filtros ? 'true' : 'false');
        var que = !temp ? 'Sin temporadas' : todas ? 'Todas las competiciones' : actual ? nomComp(actual.comp) + ' · ' + nomLiga(actual.liga) : 'Sin ligas';
        var mas = [temp ? temp.NOMBRE : '', S.tab === 'PARTIDOS' && S.mios && quien.yo ? 'solo mis partidos' : ''].filter(String).join(' · ');
        b.innerHTML = '<span><b>' + texto(que) + '</b><small>' + texto(mas) + '</small></span><span class="lg-filtros-cambiar">' + (S.filtros ? 'Cerrar' : 'Cambiar') + '</span>';
      }

      /** Competición y liga, en botones (en Partidos, también «Todas» las competiciones, sin liga). */
      function htmlElige() {
        if (!temp || !comps.length) return '';
        var cal = S.tab === 'PARTIDOS', compSel = todas ? '' : actual ? actual.comp.ID : '';
        var h = '<div class="lg-fila-chips" role="group" aria-label="Competición">' +
          (cal ? '<button type="button" data-comp="*" aria-pressed="' + todas + '">Todas</button>' : '') +
          comps.map(function (c) { return '<button type="button" data-comp="' + texto(c.ID) + '" aria-pressed="' + (c.ID === compSel) + '">' + texto(nomComp(c)) + '</button>'; }).join('') + '</div>';
        if (!todas && actual) {
          var deComp = ligas.filter(function (x) { return x.comp.ID === actual.comp.ID; });
          if (deComp.length > 1) h += '<div class="lg-fila-chips lg-chips-liga" role="group" aria-label="Liga">' + deComp.map(function (x) {
            return '<button type="button" data-liga="' + texto(x.liga.ID) + '" aria-pressed="' + (x.liga.ID === actual.liga.ID) + '">' + texto(nomLiga(x.liga)) + '</button>';
          }).join('') + '</div>';
        }
        return h;
      }

      function chipEstado(p) {
        if (p._pendiente) return '<span class="u-chip">Guardando</span>';
        return '<span class="n-estado n-e-' + (ESTADOS[p.ESTADO] || 'x') + '">' + texto(p.ESTADO || 'Sin estado') + '</span>';
      }
      /**
       * Lo que hay que saber de un partido que no se juega como estaba: anulado (no se recupera), aplazado (se recupera:
       * cuándo, o pendiente de fecha) o la recuperación de un aplazado. { clase, texto } o null.
       */
      function avisoPartido(p) {
        if (p.ESTADO === 'Anulado') {
          var an = resultadoAnulado(p, nAnulado());
          return { clase: 'lg-av-no', texto: 'Anulado: no se recuperará' + (p.ANULADO_POR ? '. Lo provoca ' + equipo(p.ANULADO_POR) + (an ? ': pierde ' + Math.min(an.gl, an.gv) + '-' + Math.max(an.gl, an.gv) : '') : '') };
        }
        if (p.ESTADO === 'Aplazado') {
          var r = recuperacionDe(d.par, p.ID);
          return { clase: 'lg-av-si', texto: 'Aplazado: se recuperará ' + (r ? 'el ' + fechaDia(r.FECHA).toLowerCase() + ' a las ' + r.HORA + ' en ' + campo(r.ID_CAMPO) : '(pendiente de fecha)') };
        }
        if (p.ESTADO === 'Suspendido') return { clase: 'lg-av-si', texto: 'Suspendido' };
        if (p.ID_PARTIDO_ORIGEN) { var o = T.fila('PARTIDOS', p.ID_PARTIDO_ORIGEN); return { clase: 'lg-av-rec', texto: 'Recupera la J' + p.JORNADA + (o ? ' (aplazado del ' + fechaDia(o.FECHA).toLowerCase() + ')' : '') }; }
        return null;
      }
      /**
       * Un partido en una lista. En el centro, solo el marcador: el local, el resultado (o «vs» si aún no se ha jugado) y el
       * visitante, cada uno con el color de su camiseta. A un lado, la hora, el campo y el árbitro. Debajo del marcador, si
       * no se juega como estaba, por qué (y, en el calendario, de qué liga y jornada es).
       */
      function htmlPartido(p, conLiga) {
        var res = conResultado(p), gl = num(p.GOLES_LOCAL), gv = num(p.GOLES_VISITANTE), av = avisoPartido(p);
        var an = resultadoAnulado(p, nAnulado()); // un anulado por culpa de un equipo cuenta como 0-5
        if (an) { res = true; gl = an.gl; gv = an.gv; }
        var roto = falta(p), libre = p.ESTADO === 'Libre' || (!p.ID_INSCRIPCION_LOCAL && !p.ID_INSCRIPCION_VISITANTE);
        if (roto && p.ESTADO === 'Jugado') res = isFinite(gl) && isFinite(gv); // se enseña su resultado, aunque no cuente
        var eq = function (id, lado, gana) {
          if (!id) return '<span class="lg-p' + lado + (roto ? ' lg-falta' : '') + '"><span class="lg-nom">' + (roto ? 'Falta el equipo' : 'Por decidir') + '</span></span>';
          return '<span class="lg-p' + lado + (gana ? ' lg-gana' : '') + '">' + (lado === 'l' ? '<span class="lg-nom">' + texto(equipo(id)) + '</span>' + punto(id)
            : punto(id) + '<span class="lg-nom">' + texto(equipo(id)) + '</span>') + '</span>';
        };
        var info = '<span class="lg-pi"><b class="u-cifra">' + texto(p.HORA || '--:--') + '</b><small>' + texto(campo(p.ID_CAMPO)) + '</small>' +
          (libre ? '' : '<small class="lg-parb" title="Árbitro">' + texto(arbitro(p) ? persona(arbitro(p)) : 'Sin árbitro') + '</small>') + '</span>';
        var debajo = [conLiga ? '<span class="lg-pliga">' + texto(ligaCompleta(p.ID_LIGA) + ' · J' + p.JORNADA) + '</span>' : '',
          p._pendiente || p._nueva ? '<span class="u-chip">Guardando</span>' : '',
          roto ? '<span class="lg-pav lg-av-no">En PARTIDOS falta el ' + (p.ID_INSCRIPCION_LOCAL ? 'visitante' : 'local') + ' (' + texto(p.ID) + '): no cuenta en la clasificación</span>' : '',
          av ? '<span class="lg-pav ' + av.clase + '">' + texto(av.texto) + (p.MOTIVO && CON_MOTIVO.indexOf(p.ESTADO) >= 0 ? ' · ' + texto(p.MOTIVO) : '') + '</span>' : ''].join('');
        return '<button type="button" class="lg-p' + (esMio(p) ? ' lg-mio' : '') + (CON_MOTIVO.indexOf(p.ESTADO) >= 0 ? ' lg-p-fuera' : '') + '" data-p="' + texto(p.ID) + '"' +
          ' aria-label="' + texto(titulo(p) + ', ' + (p.HORA || '') + ', ' + campo(p.ID_CAMPO) + (res ? ', ' + gl + ' a ' + gv : '')) + '">' + info +
          (libre ? '<span class="lg-pl"></span><span class="lg-pc lg-pvs">' + texto(equipo(p.ID_INSCRIPCION_LOCAL || p.ID_INSCRIPCION_VISITANTE) || 'Campo libre') + '</span><span class="lg-pv"></span>'
            : eq(p.ID_INSCRIPCION_LOCAL, 'l', res && gl > gv) + '<span class="lg-pc' + (res ? '' : ' lg-pvs') + (an ? ' lg-pc-an' : '') + '">' + (res ? '<b class="u-cifra">' + gl + '<span>–</span>' + gv + '</b>' : 'vs') + '</span>' + eq(p.ID_INSCRIPCION_VISITANTE, 'v', res && gv > gl)) +
          (debajo ? '<span class="lg-pa">' + debajo + '</span>' : '') + '</button>';
      }
      /** Festivo o descanso de un día (tabla CALENDARIO), o ''. */
      function especial(f) { var c = ix.cal[f]; return c && (c.FESTIVO || c.DESCANSO) ? (c.FESTIVO ? 'Festivo' : 'Descanso') + (c.MOTIVO ? ': ' + c.MOTIVO : '') : ''; }
      function htmlDia(f) { var e = especial(f); return e ? '<p class="lg-aviso">' + texto(e) + '</p>' : ''; }

      /** Los partidos que se ven en Partidos: los de la liga elegida o, con «Todas», los de la temporada; y si se pide, solo los míos. */
      function partidosVistos() {
        var deLigas = todas ? indice(ligas.map(function (x) { return x.liga; })) : null;
        return d.par.filter(function (p) {
          if (todas ? !deLigas[p.ID_LIGA] : String(p.ID_LIGA) !== String(actual.liga.ID)) return false;
          return !(S.mios && quien.yo) || esMio(p);
        });
      }
      /**
       * La barrita de un día de la tira: un trozo por partido, en orden: verde los jugados, rojo los anulados, gris los
       * aplazados y vacío los que faltan por jugar. Toda verde: la jornada se ha jugado entera.
       */
      function barraDia(ps) {
        var r = resumenDia(ps);
        if (!r.total) return '';
        var trozo = function (n, c) { return n ? '<i class="lg-s-' + c + '" style="flex-grow:' + n + '"></i>' : ''; };
        return '<span class="lg-barrita" role="img" aria-label="' + texto([r.jugado + ' jugados', r.anulado ? r.anulado + ' anulados' : '', r.aplazado ? r.aplazado + ' aplazados' : '',
          r.pendiente ? r.pendiente + ' por jugar' : ''].filter(String).join(', ')) + '">' +
          trozo(r.jugado, 'jugado') + trozo(r.anulado, 'anulado') + trozo(r.aplazado, 'aplazado') + trozo(r.pendiente, 'pendiente') + '</span>';
      }
      /** ¿Se ha jugado el día entero? Sin nada por jugar ni aplazado (un anulado ya está resuelto). */
      function completa(ps) { var r = resumenDia(ps); return r.total > 0 && !r.pendiente && !r.aplazado; }
      /** Nombre de un día de juego en la tira: «J9», «JR» (solo recuperaciones) o, con todas las ligas, el día de la semana. */
      function nombreDia(x) {
        if (todas) return DIAS[deIso(x.fecha).getDay()].slice(0, 3);
        return x.jr ? 'JR' : 'J' + x.jornadas.join('/');
      }

      /**
       * Partidos (lo que antes eran Jornadas y Calendario): arriba una tira con los días de juego (J1, J2… y JR, la jornada de
       * recuperación: un día con solo partidos aplazados que se recuperan), que se abre en el de hoy o el siguiente con los
       * tres anteriores a la vista; debajo, los partidos de ese día. Con «Todas» las competiciones (y «Solo mis partidos»),
       * los días de juego de todas las ligas, como el calendario de un árbitro.
       */
      function htmlPartidos() {
        var h = '';
        var pendActas = quien.yo ? d.par.filter(function (p) { return p.ESTADO === 'Programado' && p.FECHA < hoy() && (p.ID_ARBITRO_REAL ? p.ID_ARBITRO_REAL === quien.yo : p.ID_ARBITRO === quien.yo); }) : [];
        if (pendActas.length) h += '<p class="u-bloque lg-pend">Tienes ' + pendActas.length + (pendActas.length === 1 ? ' acta por cerrar' : ' actas por cerrar') + ' de partidos ya jugados. ' +
          '<button type="button" class="u-btn u-btn-texto" data-ir-pend="' + texto(pendActas[0].FECHA) + '">Ver</button></p>';
        if (!todas) {
          h += cabLiga();
          // Partidos a los que les falta un equipo (fallo de los datos): se dice cuántos y cuáles, para corregirlos en PARTIDOS.
          var rotos = partidosLiga(actual.liga.ID).filter(falta);
          if (rotos.length) h += '<p class="lg-pav lg-pav-ficha lg-av-no" role="alert">' + rotos.length + (rotos.length === 1 ? ' partido de esta liga no tiene' : ' partidos de esta liga no tienen') +
            ' uno de los dos equipos en COMPETICION · PARTIDOS (' + texto(rotos.slice(0, 6).map(function (p) { return p.ID; }).join(', ') + (rotos.length > 6 ? '…' : '')) +
            '). No cuentan en la clasificación ni en las goleadoras, y quién descansa puede salir mal. Avisa a quien administra para completarlos.</p>';
          var pend = aplazadosPendientes(d.par, actual.liga.ID);
          if (pend.length) h += '<div class="lg-pend-rec"><span><b>' + pend.length + (pend.length === 1 ? ' partido aplazado' : ' partidos aplazados') + ' por recuperar</b>' +
            '<small>' + texto(pend.map(function (p) { return 'J' + p.JORNADA + ' ' + titulo(p); }).join(' · ')) + '</small></span>' +
            (programa ? '<button type="button" class="u-btn" data-accion="recuperar">Recuperar en huecos libres</button>' : '') + '</div>';
        }
        var ps = partidosVistos(), dias = diasDeJuego(ps);
        if (!dias.length) return h + '<p class="u-vacio">' + (S.mios && quien.yo ? 'No tienes partidos aquí. Quita «Solo mis partidos» para ver todos.' : 'Todavía no hay partidos.') + '</p>';
        if (!dias.some(function (x) { return x.fecha === S.fecha; })) S.fecha = diaInicial(dias, hoy());
        var dia = dias.filter(function (x) { return x.fecha === S.fecha; })[0];
        h += '<div class="lg-dias"><button type="button" class="u-btn u-btn-icono" data-dias="-1" aria-label="Días anteriores">‹</button>' +
          '<div class="lg-dias-tira" role="group" aria-label="Días de juego">' + dias.map(function (x) {
            var dt = deIso(x.fecha);
            return '<button type="button" data-fecha="' + x.fecha + '" aria-pressed="' + (x.fecha === S.fecha) + '" class="' + [x.jr ? 'lg-jr' : '', completa(x.ps) ? 'lg-completa' : '', x.fecha === hoy() ? 'lg-hoy' : '', choqueCalendario(d.cal, x.fecha, x.ps) ? 'lg-choque' : ''].join(' ').trim() + '"' +
              ' aria-label="' + texto((x.jr ? 'Jornada de recuperación' : todas ? '' : 'Jornada ' + x.jornadas.join(' y ')) + ' ' + fechaDia(x.fecha)) + '">' +
              '<b>' + texto(nombreDia(x)) + '</b><small>' + dt.getDate() + ' ' + MESES[dt.getMonth()] + '</small>' + barraDia(x.ps) + '</button>';
          }).join('') + '</div><button type="button" class="u-btn u-btn-icono" data-dias="1" aria-label="Días siguientes">›</button></div>' +
          '<p class="lg-leyenda" aria-hidden="true"><span><i class="lg-s-jugado"></i>Jugado</span><span><i class="lg-s-anulado"></i>Anulado</span><span><i class="lg-s-aplazado"></i>Aplazado</span><span><i class="lg-s-pendiente"></i>Por jugar</span></p>';
        // El día abierto: qué jornada es, lo que se puede hacer con ella y sus partidos.
        // Arriba la jornada y debajo su día (con «Todas», solo el día).
        var titu = todas ? fechaDia(dia.fecha) : dia.jr ? 'Jornada de recuperación' : 'Jornada ' + dia.jornadas.join(' y ');
        var sub = (todas ? '' : fechaDia(dia.fecha)) + (dia.fecha === hoy() ? (todas ? 'Hoy' : ' · hoy') : '');
        S.jornada = !todas && dia.jornadas.length === 1 ? dia.jornadas[0] : null;
        var mov = programa && S.jornada !== null && jornadaMovible(partidosLiga(actual.liga.ID), S.jornada, hoy()).ok;
        h += '<div class="lg-jcab"><h2 class="n-grupo' + (dia.jr ? ' lg-jr-t' : '') + '">' + texto(titu) + '</h2>' +
          (sub || mov ? '<p class="lg-jfecha">' + (sub ? '<span>' + texto(sub) + '</span>' : '') +
            (mov ? '<button type="button" class="lg-jcambiar" data-accion="jornadas" title="Intercambiar la fecha con otra jornada"><span aria-hidden="true">⇄</span> Cambiar de fecha</button>' : '') + '</p>' : '') + '</div>';
        // Un día marcado como festivo o descanso en CALENDARIO no debería tener partidos: se avisa para corregirlo.
        var ch = choqueCalendario(d.cal, dia.fecha, dia.ps);
        h += ch ? '<p class="lg-pav lg-pav-ficha lg-av-no" role="alert">Ojo: este día está marcado como ' + texto(ch.motivo) + ' en el calendario y tiene ' + ch.n + (ch.n === 1 ? ' partido' : ' partidos') +
          '. Si no se juega, ' + (mov ? 'intercambia la fecha con otra jornada o ' : '') + 'aplaza los partidos; si sí se juega, quita el ' + (ch.motivo.indexOf('festivo') === 0 ? 'festivo' : 'descanso') + ' de la tabla CALENDARIO.</p>' : htmlDia(dia.fecha);
        if (dia.jr) h += '<p class="u-nota">Día sin jornada: aquí se juegan partidos aplazados de otras jornadas.</p>';
        h += '<div class="lg-lista">' + dia.ps.slice().sort(function (a, b) { return orden(cuando(a), cuando(b)) || orden(campo(a.ID_CAMPO), campo(b.ID_CAMPO)); })
          .map(function (p) { return htmlPartido(p, todas, !todas && !dia.jr); }).join('') + '</div>';
        if (S.jornada !== null) {
          var pj = partidosLiga(actual.liga.ID).filter(function (p) { return num(p.JORNADA) === S.jornada && !p.ID_PARTIDO_ORIGEN; });
          // Si a algún partido de la jornada le falta un equipo, no se sabe quién descansa: no se dice.
          var des = pj.some(falta) ? [] : descansan(pj, equiposLiga(actual.liga.ID));
          // Con un número impar de equipos, en cada jornada descansa uno: va como una línea más, debajo de los partidos.
          if (des.length) h = h.replace(/<\/div>$/, '') + des.sort(function (a, b) { return equipo(a).localeCompare(equipo(b), 'es'); }).map(function (e) {
            return '<div class="lg-p lg-p-descansa"><span class="lg-pi"><b>Descansa</b></span><span class="lg-pdes">' + punto(e) + '<span class="lg-nom">' + texto(equipo(e)) + '</span></span></div>';
          }).join('') + '</div>';
        }
        return h;
      }

      /** Día, nivel y gestor de la liga elegida (con su WhatsApp). */
      function cabLiga() {
        var l = actual.liga, g = ix.staff[l.ID_GESTOR], tel = g && wa(g.TELEFONO);
        var datos = [l.DIA_SEMANA ? 'Los ' + l.DIA_SEMANA.toLowerCase().replace(/s$/, '') + 's' : '', l.NIVEL ? 'Nivel ' + l.NIVEL : '', l.ID_GESTOR ? 'Gestor: ' + persona(l.ID_GESTOR) : ''].filter(String);
        return '<div class="lg-cab"><p>' + texto(datos.join(' · ')) + (tel ? ' <a href="' + texto(tel) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</p></div>';
      }

      function htmlClasificacion() {
        var h = cabLiga();
        if (lista(cfg.SIN_CLASIFICACION).indexOf(String(actual.comp.TIPO || '')) >= 0)
          return h + '<p class="u-vacio">' + texto(nomComp(actual.comp)) + ' se juega por eliminatorias: no tiene clasificación. Los cruces están en Partidos.</p>';
        var ps = partidosLiga(actual.liga.ID), nombres = {};
        d.eq.forEach(function (e) { nombres[e.ID] = e.NOMBRE_EQUIPO; });
        var nAn = nAnulado();
        var cl = clasificacion(ps, equiposLiga(actual.liga.ID), cfg.PUNTOS, nombres, nAn);
        if (!cl.length) return h + '<p class="u-vacio">Esta liga todavía no tiene equipos ni partidos.</p>';
        var P = cfg.PUNTOS || {}, jugados = ps.filter(conResultado).length;
        h += '<div class="u-tabla-caja"><table class="u-tabla lg-clas"><thead><tr><th class="num">#</th><th>Equipo</th><th class="num" title="Jugados">PJ</th>' +
          '<th class="num" title="Ganados">G</th><th class="num" title="Empatados">E</th><th class="num" title="Perdidos">P</th>' +
          '<th class="num u-solo-ancho" title="Goles a favor">GF</th><th class="num u-solo-ancho" title="Goles en contra">GC</th><th class="num" title="Diferencia de goles">DG</th><th class="num">Pts</th></tr></thead><tbody>' +
          cl.map(function (e) {
            return '<tr><td class="num">' + e.pos + '</td><td class="u-tabla-t"><span class="lg-eqt">' + punto(e.id) + texto(equipo(e.id)) + '</span>' +
              (e.jugar ? '<div class="u-nota u-solo-ancho">' + e.jugar + ' por jugar</div>' : '') + '</td>' +
              '<td class="num">' + e.pj + '</td><td class="num">' + e.pg + '</td><td class="num">' + e.pe + '</td><td class="num">' + e.pp + '</td>' +
              '<td class="num u-solo-ancho">' + e.gf + '</td><td class="num u-solo-ancho">' + e.gc + '</td><td class="num">' + (e.dg > 0 ? '+' : '') + e.dg + '</td><td class="num"><b>' + e.pts + '</b></td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<p class="u-nota">' + jugados + (jugados === 1 ? ' partido jugado' : ' partidos jugados') + '. ' + (isFinite(num(P.GANAR)) ? num(P.GANAR) : 3) + ' puntos por ganar y ' +
          (isFinite(num(P.EMPATAR)) ? num(P.EMPATAR) : 1) + ' por empatar; a igualdad de puntos, mejor diferencia de goles y después más goles a favor.' +
          (nAn > 0 ? ' Un partido anulado cuenta como 0-' + nAn + ' para el equipo que lo provoca.' : '') + '</p>';
        return h;
      }
      function nomJugadora(eq, id) {
        var j = (JUG[eq] || []).filter(function (x) { return x.ID === id; })[0];
        return j ? j.NOMBRE : JUG[eq] ? id : 'Cargando…';
      }
      function dorsal(eq, id) { var j = (JUG[eq] || []).filter(function (x) { return x.ID === id; })[0]; return j ? j.DORSAL : ''; }
      function cargarJugadoras(eqs) {
        eqs = eqs.filter(function (e) { return e && !JUG[e]; });
        if (!eqs.length) return Promise.resolve();
        return ctx.llamar('ligasJugadoras', [eqs]).then(function (r) { Object.keys(r || {}).forEach(function (e) { JUG[e] = r[e]; }); });
      }

      /**
       * De dónde salen las goleadoras: la liga elegida, toda la temporada (todas sus ligas) o el histórico (todas las
       * temporadas). { ambito, ps (partidos), eqs (equipos inscritos con plantilla que se puede pedir; en el histórico, ninguno) }.
       */
      function ambitoGoleadoras() {
        var a = S.golAmbito === 'temporada' || S.golAmbito === 'historico' ? S.golAmbito : 'liga';
        if (a === 'historico') return { ambito: a, ps: d.par, eqs: [] };
        var idL = a === 'temporada' ? ligas.map(function (x) { return String(x.liga.ID); }) : [String(actual.liga.ID)];
        return {
          ambito: a,
          ps: d.par.filter(function (p) { return idL.indexOf(String(p.ID_LIGA)) >= 0; }),
          eqs: d.eq.filter(function (e) { return idL.indexOf(String(e.ID_LIGA)) >= 0 && e.ESTADO !== 'Baja'; }).map(function (e) { return String(e.ID); })
        };
      }
      function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
      /** La temporada de una liga (su competición). */
      function temporadaDeLiga(idLiga) { var l = ix.liga[idLiga], c = l && ix.comp[l.ID_COMPETICION]; return c ? String(c.ID_TEMPORADA) : ''; }
      function nomTemporada(id) { var t = d.temp.filter(function (x) { return x.ID === id; })[0]; return t ? t.NOMBRE : id; }
      /** Nombre y dorsal de una inscripción de jugadora: de ligasNombres o, si no, de la plantilla de su equipo. */
      function nomIJ(ij) { var n = NOM[ij]; if (n) return n.N; for (var e in JUG) { var j = JUG[e].filter(function (x) { return x.ID === ij; })[0]; if (j) return j.NOMBRE; } return 'Cargando…'; }
      function dorsalIJ(ij) { var n = NOM[ij]; return n ? n.D : ''; }

      /**
       * Goleadoras: de la liga, de toda la temporada o del histórico. Arriba, el resumen (goles, partidos, media y quién va
       * primera); debajo, la clasificación por persona (una jugadora con varias inscripciones cuenta una vez) y un buscador:
       * una jugadora dice cuántos lleva (también 0) y un equipo enseña a todas sus jugadoras. Cada jugadora abre su ficha.
       */
      function htmlGoleadoras() {
        var a = ambitoGoleadoras().ambito, op = [['liga', nomLiga(actual.liga)], ['temporada', 'Toda la temporada'], ['historico', 'Histórico']];
        return '<div class="lg-gol-cab"><div class="lg-fila-chips lg-chips-liga" role="group" aria-label="De dónde">' + op.map(function (o) {
            return '<button type="button" data-golamb="' + o[0] + '" aria-pressed="' + (a === o[0]) + '">' + texto(o[1]) + '</button>';
          }).join('') + '</div>' +
          '<label class="u-campo lg-gol-busca"><span class="u-oculto">Buscar</span><input type="search" id="lg-gq" placeholder="Busca una jugadora o un equipo" value="' + texto(S.q) + '" autocomplete="off"></label></div>' +
          '<div id="lg-gol-res">' + htmlGolRes() + '</div>' +
          '<p class="u-nota">Cuentan los goles apuntados en las actas. Los goles sin asignar (en propia o de una sustituta) y los de puntualidad no son de ninguna jugadora. Toca una jugadora para ver sus temporadas.</p>';
      }
      function htmlGolRes() {
        var A = ambitoGoleadoras(), ids = A.ps.map(function (p) { return p.ID; }), rk = rankingPersonas(d.gol, ids, NOM), porClave = {};
        rk.forEach(function (x) { porClave[x.clave] = x; });
        var puesto = function (n) { return 1 + rk.filter(function (x) { return x.goles > n; }).length; };
        var claveIJ = function (ij, jugadora) { var n = NOM[ij]; return n && n.J ? 'J:' + n.J : jugadora ? 'J:' + jugadora : 'I:' + ij; };
        // De varias inscripciones de un equipo, la más nueva que tenga color (las de otros años pueden no tenerlo).
        var conColor = function (eqs) { for (var i = eqs.length - 1; i >= 0; i--) if (colorEq(eqs[i])) return eqs[i]; return eqs[eqs.length - 1]; };
        var nombreEquipos = function (eqs) { var l = []; eqs.forEach(function (e) { var n = equipo(e); if (l.indexOf(n) < 0) l.push(n); }); return l.join(', '); };
        var fila = function (clave, ij, n, eqs, conEquipo, dor) {
          return '<li' + (n ? '' : ' class="lg-cero"') + '><span class="lg-pos u-cifra">' + (n ? puesto(n) : '–') + '</span>' +
            '<button type="button" class="lg-jug" data-jug="' + texto(clave) + '" data-ij="' + texto(ij) + '"><span class="lg-eqt">' + punto(conColor(eqs)) + '<span><b>' +
            (dor ? '<span class="lg-dorsal u-cifra">' + texto(dor) + '</span> ' : '') + texto(nomIJ(ij)) + '</b>' +
            (conEquipo ? '<small>' + texto(nombreEquipos(eqs)) + '</small>' : '') + '</span></span></button>' +
            '<span class="lg-n u-cifra">' + n + '<small>' + (n === 1 ? ' gol' : ' goles') + '</small></span></li>';
        };
        var R = resumenGoles(A.ps), top = rk[0];
        var h = '<div class="lg-stats"><div><b class="u-cifra">' + R.goles + '</b><span>goles</span></div><div><b class="u-cifra">' + R.jugados + '</b><span>partidos jugados</span></div>' +
          '<div><b class="u-cifra">' + String(R.media).replace('.', ',') + '</b><span>goles por partido</span></div>' +
          '<div><b>' + (top ? texto(nomIJ(top.ijs[0])) : '—') + '</b><span>' + (top ? 'máxima goleadora · ' + top.goles + ' goles' : 'máxima goleadora') + '</span></div></div>';
        var q = norm(S.q).trim();
        if (!q) {
          if (!rk.length) return h + '<p class="u-vacio">Todavía no hay goles apuntados en las actas.</p>';
          return h + '<ol class="lg-ranking">' + rk.slice(0, 100).map(function (x) { return fila(x.clave, x.ijs[0], x.goles, x.equipos, true, A.ambito === 'liga' ? dorsalIJ(x.ijs[0]) : ''); }).join('') + '</ol>' +
            (rk.length > 100 ? '<p class="u-nota">Y ' + (rk.length - 100) + ' más: búscalas por su nombre.</p>' : '');
        }
        // Equipos que coinciden: en la liga y la temporada, toda su plantilla (también con 0); en el histórico, quién ha marcado con ese equipo.
        var eqsQ = [];
        if (A.ambito === 'historico') {
          var porEquipo = {};
          d.eq.forEach(function (e) { if (norm(e.NOMBRE_EQUIPO).indexOf(q) >= 0) { var k = e.ID_EQUIPO || e.NOMBRE_EQUIPO; (porEquipo[k] = porEquipo[k] || []).push(String(e.ID)); } });
          Object.keys(porEquipo).forEach(function (k) {
            var ins = porEquipo[k], suyos = rk.filter(function (x) { return x.equipos.some(function (e) { return ins.indexOf(e) >= 0; }); });
            eqsQ.push('<section class="lg-gol-eq"><h3 class="lg-sub"><span class="lg-eqt">' + punto(conColor(ins)) + texto(nombreEquipos(ins)) + '</span><span class="u-cifra">' + ins.length + (ins.length === 1 ? ' temporada' : ' inscripciones') + '</span></h3>' +
              (suyos.length ? '<ol class="lg-ranking">' + suyos.map(function (x) { return fila(x.clave, x.ijs[0], x.goles, x.equipos, false, ''); }).join('') + '</ol>' : '<p class="u-vacio">Nadie ha marcado con este equipo.</p>') + '</section>');
          });
        } else {
          if (A.eqs.some(function (e) { return !JUG[e]; })) return h + '<p class="u-vacio">Cargando los nombres de las jugadoras…</p>';
          A.eqs.filter(function (e) { return norm(equipo(e)).indexOf(q) >= 0; }).forEach(function (e) {
            var js = (JUG[e] || []).map(function (j) { var k = claveIJ(j.ID, j.JUGADORA); return { j: j, k: k, n: porClave[k] ? porClave[k].goles : 0 }; })
              .sort(function (a, b) { return b.n - a.n || a.j.NOMBRE.localeCompare(b.j.NOMBRE, 'es'); });
            var tot = js.reduce(function (t, x) { return t + x.n; }, 0);
            eqsQ.push('<section class="lg-gol-eq"><h3 class="lg-sub"><span class="lg-eqt">' + punto(e) + texto(equipo(e)) + '</span><span class="u-cifra">' + tot + (tot === 1 ? ' gol' : ' goles') + '</span></h3>' +
              '<ol class="lg-ranking">' + js.map(function (x) { return fila(x.k, x.j.ID, x.n, [e], false, x.j.DORSAL); }).join('') + '</ol></section>');
          });
        }
        // Jugadoras que coinciden: las que han marcado en el alcance y, en la liga y la temporada, también las de las plantillas (con 0).
        var vistas = {}, jug = [];
        rk.forEach(function (x) { if (norm(nomIJ(x.ijs[0])).indexOf(q) >= 0) { vistas[x.clave] = 1; jug.push({ k: x.clave, ij: x.ijs[0], n: x.goles, eqs: x.equipos }); } });
        A.eqs.forEach(function (e) { (JUG[e] || []).forEach(function (j) { var k = claveIJ(j.ID, j.JUGADORA); if (!vistas[k] && norm(j.NOMBRE).indexOf(q) >= 0) { vistas[k] = 1; jug.push({ k: k, ij: j.ID, n: 0, eqs: [e] }); } }); });
        h += eqsQ.join('');
        if (jug.length) h += (eqsQ.length ? '<h3 class="lg-sub">Jugadoras</h3>' : '') + '<ol class="lg-ranking">' + jug.map(function (x) { return fila(x.k, x.ij, x.n, x.eqs, true, ''); }).join('') + '</ol>';
        return eqsQ.length || jug.length ? h : h + '<p class="u-vacio">Ninguna jugadora ni equipo con «' + texto(S.q) + '».</p>';
      }
      /**
       * Los nombres que faltan: de las que han marcado en el alcance (ligasNombres, guardados en el dispositivo) y, en la liga y la
       * temporada, las plantillas de sus equipos (de 60 en 60). Después vuelve a pintar el resultado.
       */
      function cargarGoleadoras() {
        var A = ambitoGoleadoras(), ids = A.ps.map(function (p) { return p.ID; }), faltan = [];
        rankingPersonas(d.gol, ids, {}).forEach(function (x) { x.ijs.forEach(function (ij) { if (!NOM[ij]) faltan.push(ij); }); });
        var eqs = A.eqs.filter(function (e) { return !JUG[e]; }), trozos = [];
        for (var i = 0; i < eqs.length; i += 60) trozos.push(eqs.slice(i, i + 60));
        if (!faltan.length && !trozos.length) return;
        Promise.all([cargarNombres(faltan)].concat(trozos.map(cargarJugadoras))).then(function () {
          var r = cont.querySelector('#lg-gol-res');
          if (r && ctx.abierta() && S.tab === 'GOLEADORAS') r.innerHTML = htmlGolRes();
        }, function () {});
      }
      function cargarNombres(ijs) {
        ijs = ijs.filter(function (i) { return i && !NOM[i]; });
        if (!ijs.length) return Promise.resolve();
        var trozos = [];
        for (var i = 0; i < ijs.length; i += 5000) trozos.push(ijs.slice(i, i + 5000));
        return Promise.all(trozos.map(function (t) { return ctx.llamar('ligasNombres', [t]); })).then(function (rs) {
          rs.forEach(function (r) { Object.keys(r || {}).forEach(function (k) { NOM[k] = r[k]; }); });
          guardadoJson(KNOM, NOM);
        });
      }

      /**
       * La ficha de una jugadora: sus goles de siempre, por temporada (con su equipo, su liga, los partidos que jugó su equipo
       * y la media) y su mejor partido. Junta todas sus inscripciones (la persona, ID_JUGADORA).
       */
      function fichaJugadora(clave, ij) {
        var pintarFicha = function () {
          var ijs = clave.indexOf('J:') === 0 ? Object.keys(NOM).filter(function (k) { return 'J:' + NOM[k].J === clave; }) : [clave.slice(2)];
          if (ij && ijs.indexOf(ij) < 0) ijs.push(ij);
          var E = estadisticasJugadora(d.gol, d.par, ijs, temporadaDeLiga), nombre = nomIJ(ijs[0] || ij);
          var mp = E.mejor && T.fila('PARTIDOS', E.mejor.partido);
          var html = '<h2 id="lg-vt">' + texto(nombre) + '</h2>' +
            '<div class="lg-stats"><div><b class="u-cifra">' + E.total + '</b><span>' + (E.total === 1 ? 'gol' : 'goles') + ' en total</span></div>' +
            '<div><b class="u-cifra">' + E.temporadas.length + '</b><span>' + (E.temporadas.length === 1 ? 'temporada marcando' : 'temporadas marcando') + '</span></div>' +
            (mp ? '<div><b class="u-cifra">' + E.mejor.goles + '</b><span>en su mejor partido</span></div>' : '') + '</div>' +
            (E.temporadas.length ? '<div class="u-tabla-caja"><table class="u-tabla lg-clas"><thead><tr><th>Temporada</th><th>Equipo</th><th class="num">Goles</th><th class="num u-solo-ancho">Partidos</th><th class="num">Por partido</th></tr></thead><tbody>' +
              E.temporadas.map(function (t) {
                var ls = t.ligas.map(function (l) { return ix.liga[l] ? nomComp(ix.comp[ix.liga[l].ID_COMPETICION]) + ' · ' + ix.liga[l].NOMBRE : l; });
                return '<tr><td class="u-tabla-t">' + texto(nomTemporada(t.temporada)) + '<div class="u-nota">' + texto(ls.join(', ')) + '</div></td>' +
                  '<td><span class="lg-eqt">' + punto(t.equipos[t.equipos.length - 1]) + texto(t.equipos.map(equipo).join(', ')) + '</span></td>' +
                  '<td class="num"><b>' + t.goles + '</b></td><td class="num u-solo-ancho">' + t.jugados + '</td><td class="num">' + (t.jugados ? String(Math.round(t.goles / t.jugados * 100) / 100).replace('.', ',') : '–') + '</td></tr>';
              }).join('') + '</tbody></table></div>' : '<p class="u-vacio">Todavía no ha marcado ningún gol en las actas.</p>') +
            (mp ? '<p class="u-nota">Mejor partido: ' + E.mejor.goles + ' goles en ' + texto(titulo(mp)) + (conResultado(mp) ? ' (' + num(mp.GOLES_LOCAL) + '-' + num(mp.GOLES_VISITANTE) + ')' : '') + ', ' + texto(fechaDia(mp.FECHA).toLowerCase() + ' de ' + deIso(mp.FECHA).getFullYear()) + '.</p>' : '') +
            '<p class="u-nota">«Partidos» son los que jugó su equipo con resultado: el acta no dice qué jugadoras jugaron.</p>' +
            '<div class="n-botones"><button type="button" class="u-btn" data-cerrar>Cerrar</button></div>';
          ventana(html);
        };
        // Para tener todas sus temporadas hacen falta los nombres de todas las que han marcado alguna vez (se guardan en el dispositivo).
        var todas = rankingPersonas(d.gol, d.par.map(function (p) { return p.ID; }), {}).reduce(function (l, x) { return l.concat(x.ijs); }, []);
        var faltan = todas.filter(function (i) { return !NOM[i]; });
        if (!faltan.length) { pintarFicha(); return; }
        ventana('<h2 id="lg-vt">Buscando sus temporadas…</h2><div class="kz-centro" role="status"><div class="u-carga"></div></div>');
        cargarNombres(faltan).then(function () { if (velo.classList.contains('abierto')) pintarFicha(); }, function (e) {
          ventana('<h2 id="lg-vt">No se ha podido leer</h2><p class="u-error">' + texto(String(e.message || e).replace(/^\w+:\s*/, '')) + '</p><div class="n-botones"><button type="button" class="u-btn" data-cerrar>Cerrar</button></div>');
        });
      }

      /* ---------- ventanas ---------- */

      var antesDeCerrar = null;
      function ventana(html, alAbrir) {
        vent.innerHTML = html;
        vent.onclick = vent.oninput = vent.onchange = null;
        velo.classList.add('abierto');
        if (alAbrir) alAbrir();
        var b = vent.querySelector('h2');
        if (b) { b.setAttribute('tabindex', '-1'); b.focus(); }
      }
      function cerrar(forzar) {
        if (!forzar && antesDeCerrar && !antesDeCerrar()) return;
        antesDeCerrar = null;
        var abierta = velo.classList.contains('abierto');
        velo.classList.remove('abierto'); vent.innerHTML = ''; vent.onclick = vent.oninput = vent.onchange = null;
        if (abierta && ctx.abierta()) pintar(); // lo que haya cambiado mientras estaba abierta
      }
      function campoF(et, html, extra) { return '<label class="u-campo' + (extra ? ' ' + extra : '') + '"><span class="u-etiqueta">' + et + '</span>' + html + '</label>'; }
      function val(id) { var e = vent.querySelector('#' + id); return e ? String(e.value).trim() : ''; }
      function verError(mal) { var e = vent.querySelector('.u-error'); e.textContent = mal.join(' '); e.hidden = !mal.length; }
      /** ¿Le falta un equipo por un fallo de los datos? (en una copa, un partido sin jugar puede tener uno por decidir) */
      function falta(p) { var l = ix.liga[p.ID_LIGA], c = l && ix.comp[l.ID_COMPETICION]; return incompleto(p, !!c && lista(cfg.SIN_CLASIFICACION).indexOf(String(c.TIPO || '')) >= 0); }
      function titulo(p) {
        if (!p.ID_INSCRIPCION_LOCAL && !p.ID_INSCRIPCION_VISITANTE) return 'Campo libre';
        var x = falta(p) ? '(falta el equipo)' : 'Por decidir';
        return (equipo(p.ID_INSCRIPCION_LOCAL) || x) + ' – ' + (equipo(p.ID_INSCRIPCION_VISITANTE) || x);
      }

      /** Un equipo en el marcador de la ficha: su color, su nombre y quién marcó sus goles. */
      function ladoMarcador(p, eq, rival, que) {
        var gs = golesEquipo(golesDe(p.ID), eq);
        return '<div class="lg-mlado"' + (colorEq(eq) ? ' style="--c:' + texto(colorEq(eq)) + '"' : '') + '>' +
          '<span class="lg-mcolor' + (colorEq(eq) ? '' : ' lg-color-no') + '" aria-hidden="true"></span>' +
          '<b>' + texto(equipo(eq)) + '</b><small>' + texto(que + (nomColor(eq) ? ' · ' + nomColor(eq) : '')) + '</small>' +
          (gs.length ? '<ul class="lg-mgoles">' + gs.map(function (g) {
            return '<li' + (g.tipo !== 'jugadora' ? ' class="lg-gol-otro"' : '') + '>' + (g.tipo === 'jugadora' ? '<span class="lg-dorsal u-cifra" data-dorsal="' + texto(g.jugadora) + '" data-eq="' + texto(eq) + '">' + texto(dorsal(eq, g.jugadora)) + '</span>' +
              '<span data-jugadora="' + texto(g.jugadora) + '" data-eq="' + texto(eq) + '">' + texto(nomJugadora(eq, g.jugadora)) + '</span>'
              : g.tipo === 'puntualidad' ? '<span class="lg-dorsal">P</span><span>Puntualidad (llegó tarde ' + texto(equipo(rival)) + ')</span>'
              : '<span class="lg-dorsal">–</span><span>En propia</span>') +
              (g.goles > 1 ? '<span class="lg-veces u-cifra">×' + g.goles + '</span>' : '') + '</li>';
          }).join('') + '</ul>' : '') + '</div>';
      }

      /** Ficha de un partido: marcador con los colores y las goleadoras de cada equipo, los datos y lo que se puede hacer. */
      function ficha(id) {
        var p = T.fila('PARTIDOS', id);
        if (!p) return;
        var c = ix.cam[p.ID_CAMPO], ins = c && ix.ins[c.ID_INSTALACION], ges = ix.staff[p.ID_GESTOR], tel = ges && wa(ges.TELEFONO);
        var res = conResultado(p), gs = golesDe(p.ID), acta = puedeActa(p, quien) && !p._nueva, an = resultadoAnulado(p, nAnulado());
        var L = p.ID_INSCRIPCION_LOCAL, V = p.ID_INSCRIPCION_VISITANTE;
        var fila = function (dt, dd) { return dd ? '<dt>' + dt + '</dt><dd>' + dd + '</dd>' : ''; };
        var html = '<h2 id="lg-vt">' + texto(titulo(p)) + '</h2>' +
          '<p class="u-nota">' + texto([ligaCompleta(p.ID_LIGA), 'Jornada ' + p.JORNADA].filter(String).join(' · ')) + '</p>' +
          (L && V ? '<div class="lg-marcador">' + ladoMarcador(p, L, V, 'Local') +
            '<div class="lg-mcentro">' + (an ? '<b class="u-cifra lg-mcentro-an">' + an.gl + '<span>–</span>' + an.gv + '</b>' : res ? '<b class="u-cifra">' + num(p.GOLES_LOCAL) + '<span>–</span>' + num(p.GOLES_VISITANTE) + '</b>'
              : '<b class="lg-mhora u-cifra">' + texto(p.HORA || '--:--') + '</b>') + chipEstado(p) + '</div>' +
            ladoMarcador(p, V, L, 'Visitante') + '</div>' : '') +
          (avisoPartido(p) ? '<p class="lg-pav lg-pav-ficha ' + avisoPartido(p).clase + '">' + texto(avisoPartido(p).texto) + '</p>' : '') +
          (res && !gs.length ? '<p class="u-nota">El acta no dice quién marcó.</p>' : '') +
          '<dl class="lg-datos">' +
          fila('Cuándo', texto(p.FECHA ? fechaDia(p.FECHA) + ' · ' + fecha(p.FECHA) + (p.HORA ? ' a las ' + p.HORA : '') : 'Sin fecha')) +
          fila('Campo', texto([campoLargo(p.ID_CAMPO), ins ? ins.NOMBRE : ''].filter(String).join(' · ')) + (ins && ins.UBICACION_URL ? ' <a href="' + texto(ins.UBICACION_URL) + '" target="_blank" rel="noopener">Cómo llegar</a>' : '')) +
          fila('Árbitro', texto(p.ID_ARBITRO ? persona(p.ID_ARBITRO) : 'Sin asignar') + (p.ID_ARBITRO_REAL ? ' · arbitró ' + texto(persona(p.ID_ARBITRO_REAL)) : '')) +
          fila('Gestor', p.ID_GESTOR ? texto(persona(p.ID_GESTOR)) + (tel ? ' <a href="' + texto(tel) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') : '') +
          fila('Motivo', texto(p.MOTIVO)) +
          fila('Anulado por', texto(p.ANULADO_POR ? equipo(p.ANULADO_POR) : '')) +
          fila('Notas', texto(p.NOTAS)) + '</dl>';
        var mover = programa && !p._nueva && p.ESTADO === 'Programado' && String(p.FECHA || '') >= hoy();
        html += '<div class="n-botones">' + (acta ? '<button type="button" class="u-btn u-btn-accion" id="lg-acta">' + (p.ESTADO === 'Jugado' ? 'Cambiar el acta' : 'Cerrar el acta') + '</button>' : '') +
          (mover ? '<button type="button" class="u-btn" id="lg-mover">Mover dentro del día</button>' : '') +
          (programa && p.ESTADO === 'Aplazado' && !recuperacionDe(d.par, p.ID) ? '<button type="button" class="u-btn" id="lg-recuperar">Recuperar en un hueco libre</button>' : '') +
          (programa && !p._nueva ? '<button type="button" class="u-btn" id="lg-prog">Árbitro y estado</button>' : '') +
          '<button type="button" class="u-btn' + (acta || programa ? ' u-btn-texto' : '') + '" data-cerrar>Cerrar</button></div>';
        ventana(html, function () {
          var a = vent.querySelector('#lg-acta'), b = vent.querySelector('#lg-prog'), m = vent.querySelector('#lg-mover');
          if (a) a.onclick = function () { formActa(p); };
          if (b) b.onclick = function () { formPartido(p); };
          if (m) m.onclick = function () { formMover(p); };
          var rc = vent.querySelector('#lg-recuperar');
          if (rc) rc.onclick = function () { formRecuperar(p.ID_LIGA, [p.ID]); };
          var faltan = gs.filter(function (g) { return g.ID_INSCRIPCION_JUGADORA && !JUG[g.ID_INSCRIPCION_EQUIPO]; }).map(function (g) { return g.ID_INSCRIPCION_EQUIPO; });
          if (faltan.length) cargarJugadoras(faltan).then(function () {
            [].forEach.call(vent.querySelectorAll('.lg-mgoles [data-jugadora]'), function (x) { x.textContent = nomJugadora(x.getAttribute('data-eq'), x.getAttribute('data-jugadora')); });
            [].forEach.call(vent.querySelectorAll('.lg-mgoles [data-dorsal]'), function (x) { x.textContent = dorsal(x.getAttribute('data-eq'), x.getAttribute('data-dorsal')); });
          }, function () {});
        });
      }

      /**
       * El acta: el marcador y, por cada gol, quién lo marcó (una jugadora del equipo o «en propia» del rival), quién
       * arbitró y notas. Guardar pone el partido Jugado al momento; ligasActa escribe el partido y sus goles.
       */
      function formActa(p) {
        var L = p.ID_INSCRIPCION_LOCAL, V = p.ID_INSCRIPCION_VISITANTE, gs = golesDe(p.ID);
        var elegidos = {}; elegidos[L] = []; elegidos[V] = [];
        gs.forEach(function (g) { if (elegidos[g.ID_INSCRIPCION_EQUIPO]) elegidos[g.ID_INSCRIPCION_EQUIPO].push(g.ID_INSCRIPCION_JUGADORA || (esPuntualidad(g) ? '_puntualidad' : '_nadie')); });
        var marcador = {}; marcador[L] = conResultado(p) ? num(p.GOLES_LOCAL) : elegidos[L].length; marcador[V] = conResultado(p) ? num(p.GOLES_VISITANTE) : elegidos[V].length;
        var arbs = staff.staff.filter(function (s) { return s.ARBITRO && s.ACTIVO; }).map(function (s) { return s.ID; });
        [p.ID_ARBITRO, p.ID_ARBITRO_REAL].forEach(function (x) { if (x && arbs.indexOf(x) < 0) arbs.push(x); });
        var lado = function (e, k) {
          return '<div class="lg-lado"' + (colorEq(e) ? ' style="--c:' + texto(colorEq(e)) + '"' : '') + '><span class="u-etiqueta">' + texto(k) + '</span><b class="lg-eqt">' + punto(e) + texto(equipo(e)) + '</b>' +
            '<div class="lg-paso"><button type="button" class="u-btn u-btn-icono" data-paso="-1" data-e="' + texto(e) + '" aria-label="Un gol menos de ' + texto(equipo(e)) + '">−</button>' +
            '<input type="number" inputmode="numeric" min="0" step="1" id="lg-g-' + texto(e) + '" value="' + marcador[e] + '" aria-label="Goles de ' + texto(equipo(e)) + '">' +
            '<button type="button" class="u-btn u-btn-icono" data-paso="1" data-e="' + texto(e) + '" aria-label="Un gol más de ' + texto(equipo(e)) + '">+</button></div>' +
            '<div class="lg-quien" id="lg-q-' + texto(e) + '"></div></div>';
        };
        var html = '<h2 id="lg-vt">Acta · ' + texto(titulo(p)) + '</h2>' +
          '<p class="u-nota">' + texto([p.FECHA ? fechaDia(p.FECHA) + ' · ' + fecha(p.FECHA) : '', p.HORA, campo(p.ID_CAMPO)].filter(String).join(' · ')) + '. Apunta el resultado y quién marcó cada gol.</p>' +
          '<div class="lg-acta">' + lado(L, 'Local') + lado(V, 'Visitante') + '</div>' +
          '<div class="u-campos">' + campoF('Arbitró', '<select id="lg-real">' + opciones(arbs.map(function (x) { return [x, persona(x)]; }), p.ID_ARBITRO_REAL || p.ID_ARBITRO, 'Sin árbitro') + '</select>') +
          campoF('Notas', '<textarea id="lg-notas" rows="2">' + texto(p.NOTAS) + '</textarea>', 'u-ancho') + '</div>' +
          '<p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="lg-guardar">Guardar el acta</button>' +
          '<button type="button" class="u-btn" data-cerrar>Cancelar</button></div>';
        ventana(html, function () {
          function quien(e) {
            var caja = vent.querySelector('#lg-q-' + e), n = Math.max(0, Math.min(40, parseInt(vent.querySelector('#lg-g-' + e).value, 10) || 0));
            [].forEach.call(caja.querySelectorAll('select'), function (s, i) { elegidos[e][i] = s.value; });
            var js = JUG[e], rival = equipo(e === L ? V : L), h = '';
            for (var i = 0; i < n; i++) {
              var v = elegidos[e][i] || '';
              var ops = (js || []).filter(function (j) { return j.ACTIVA || j.ID === v; }).map(function (j) { return [j.ID, (j.DORSAL !== '' ? j.DORSAL + ' · ' : '') + j.NOMBRE]; });
              h += '<label class="u-campo"><span class="u-oculto">Gol ' + (i + 1) + ' de ' + texto(equipo(e)) + '</span><select data-gol="' + i + '">' +
                opciones(ops.concat([['_nadie', 'En propia'], ['_puntualidad', 'Puntualidad (llega tarde ' + rival + ')']]), v, js ? 'Gol ' + (i + 1) + ': ¿quién marcó?' : 'Cargando jugadoras…') + '</select></label>';
            }
            caja.innerHTML = h;
          }
          function todo() { quien(L); quien(V); }
          todo();
          cargarJugadoras([L, V]).then(function () { if (velo.classList.contains('abierto')) todo(); }, function (e) {
            verError(['No se han podido leer las jugadoras: ' + String(e.message || e).replace(/^\w+:\s*/, '')]);
          });
          vent.oninput = function (e) { if (/^lg-g-/.test(e.target.id || '')) quien(e.target.id.slice(5)); };
          vent.onclick = function (e) {
            var b = e.target.closest('[data-paso]');
            if (!b) return;
            var k = b.getAttribute('data-e'), inp = vent.querySelector('#lg-g-' + k);
            inp.value = Math.max(0, (parseInt(inp.value, 10) || 0) + Number(b.getAttribute('data-paso')));
            quien(k);
          };
          vent.querySelector('#lg-guardar').onclick = function () {
            quien(L); quien(V);
            var gl = parseInt(vent.querySelector('#lg-g-' + L).value, 10), gv = parseInt(vent.querySelector('#lg-g-' + V).value, 10), mal = [];
            if (!(gl >= 0) || !(gv >= 0)) mal.push('Pon los goles de los dos equipos (0 si no marcó).');
            var goles = [];
            [[L, gl], [V, gv]].forEach(function (x) {
              for (var i = 0; i < (x[1] || 0); i++) {
                var v = elegidos[x[0]][i];
                if (!v) { mal.push('Falta quién marcó algún gol de ' + equipo(x[0]) + ': una jugadora, en propia o puntualidad.'); break; }
                goles.push(v === '_puntualidad' ? { ID_INSCRIPCION_EQUIPO: x[0], ID_INSCRIPCION_JUGADORA: '', TIPO: PUNTUALIDAD }
                  : v === '_nadie' ? { ID_INSCRIPCION_EQUIPO: x[0], ID_INSCRIPCION_JUGADORA: '', TIPO: EN_PROPIA }
                  : { ID_INSCRIPCION_EQUIPO: x[0], ID_INSCRIPCION_JUGADORA: v });
              }
            });
            verError(mal);
            if (mal.length) return;
            var real = val('lg-real'), notas = val('lg-notas');
            var acta = { GOLES_LOCAL: gl, GOLES_VISITANTE: gv, ID_ARBITRO_REAL: real, NOTAS: notas, goles: goles };
            var cambios = { GOLES_LOCAL: gl, GOLES_VISITANTE: gv, ESTADO: 'Jugado', ID_ARBITRO_REAL: real === p.ID_ARBITRO ? '' : real, MOTIVO: '', ANULADO_POR: '', NOTAS: notas };
            cerrar(true);
            T.actualizar('PARTIDOS', p.ID, cambios, { fn: 'ligasActa', args: [p.ID, acta] }).then(function (r) {
              if (r && r.quitados) T.refrescar(['GOLES']).catch(function () {});
              if (ctx.abierta()) ctx.aviso('Acta guardada: ' + equipo(L) + ' ' + gl + ' – ' + gv + ' ' + equipo(V) + '.');
            }, function () {});
          };
        });
      }

      /* ---------- mover partidos y avisar a las capitanas ---------- */

      /** Día, hora y campo de un partido antes de cambiarlo (la fila cambia en la pantalla al guardar). */
      function foto(p) { return { FECHA: p.FECHA, HORA: p.HORA, ID_CAMPO: p.ID_CAMPO, ID_ARBITRO: p.ID_ARBITRO || '' }; }
      /** Dónde queda un partido en un día, hora y campo, con el árbitro de ese hueco (arbitroEn). */
      function nuevoEn(p, f, hora, cam) { return { FECHA: f, HORA: hora, ID_CAMPO: cam, ID_ARBITRO: arbitroEn(d.hue, p, f, hora, cam) }; }
      /** Lo que cambia en un partido, en palabras: «20:00 SCS1 → 21:00 SCS2». */
      function deA(antes, despues) {
        var a = [antes.FECHA !== despues.FECHA ? fechaDia(antes.FECHA) : '', antes.HORA, campo(antes.ID_CAMPO)].filter(String).join(' ');
        var b = [antes.FECHA !== despues.FECHA ? fechaDia(despues.FECHA) : '', despues.HORA, campo(despues.ID_CAMPO)].filter(String).join(' ');
        return a + ' → ' + b;
      }
      /** El resumen de un cambio y el aviso de las capitanas que hay que avisar, antes de guardar. */
      function htmlCambios(cambios) {
        var eqs = equiposDe(cambios.map(function (c) { return c.p; }));
        return '<div class="lg-cambios"><h3 class="lg-sub">Qué cambia</h3><ul>' + cambios.map(function (c) {
          var arb = c.nuevo.ID_ARBITRO && c.nuevo.ID_ARBITRO !== c.antes.ID_ARBITRO ? ' · arbitra ' + persona(c.nuevo.ID_ARBITRO) : '';
          return '<li><b>' + texto(titulo(c.p) + ' · J' + c.p.JORNADA) + '</b><span class="u-cifra">' + texto((c.recupera ? 'Aplazado ' : '') + deA(c.antes, c.nuevo) + arb) + '</span></li>';
        }).join('') + '</ul></div>' +
          '<div class="lg-avisar-ya" role="note"><b>Tendrás que avisar a ' + eqs.length + (eqs.length === 1 ? ' capitana' : ' capitanas') + '</b>' +
          '<span>' + texto(eqs.map(equipo).join(', ')) + '. Al guardar te saldrá la lista con el mensaje ya escrito para enviárselo por WhatsApp.</span></div>';
      }
      /** Mensaje para la capitana de un equipo con los cambios de sus partidos (textoAviso). */
      function mensaje(eq, capitana, cambios) {
        var suyos = cambios.filter(function (c) { return c.p.ID_INSCRIPCION_LOCAL === eq || c.p.ID_INSCRIPCION_VISITANTE === eq; });
        var l = ix.liga[suyos[0].p.ID_LIGA], co = l && ix.comp[l.ID_COMPETICION];
        var fecha = function (x) { return { dia: x.FECHA, hora: x.HORA, campo: campoLargo(x.ID_CAMPO) }; };
        return textoAviso({ capitana: capitana, liga: 'la ' + (co ? nomComp(co) : 'liga') + (l ? ' (' + String(l.NOMBRE || l.ID) + ')' : ''),
          partidos: suyos.map(function (c) { return { titulo: titulo(c.p), jornada: c.p.JORNADA, antes: fecha(c.antes), ahora: fecha(c.nuevo), recupera: !!c.recupera }; }) });
      }
      /** Un mensaje de WhatsApp en la pantalla: sus saltos de línea y su *negrita*. */
      function htmlMsg(m) { return texto(m).replace(/\*([^*\n]+)\*/g, '<b>$1</b>'); }
      /**
       * Al guardar un cambio: la lista de capitanas afectadas, cada una con su WhatsApp y el mensaje ya escrito, y una
       * casilla para marcarla como avisada. Arriba, si el cambio se está guardando o ya está guardado; si el motor dice
       * que no, la pantalla vuelve a como estaba y aquí se dice que no hay que avisar a nadie. Al cerrar con alguna capitana
       * sin marcar, avisa una vez.
       */
      function avisar(cambios, capitanas, guardando, ok) {
        var eqs = equiposDe(cambios.map(function (c) { return c.p; })), fallo = false;
        function lista(caps) {
          return '<ul class="lg-capitanas">' + eqs.map(function (eq) {
            var c = (caps || {})[eq] || {}, m = mensaje(eq, c.CAPITANA, cambios), enlace = wa(c.TELEFONO, m);
            return '<li><label class="u-check"><input type="checkbox" data-avisada="' + texto(eq) + '"><span class="lg-eqt">' + punto(eq) + '<span><b>' + texto(equipo(eq)) + '</b>' +
              '<small>' + texto(!caps ? 'Buscando a su capitana…' : c.CAPITANA ? c.CAPITANA + (c.TELEFONO ? ' · ' + c.TELEFONO : ' · sin teléfono') : 'Sin capitana en la inscripción') + '</small></span></span></label>' +
              (enlace ? '<a class="u-btn" href="' + texto(enlace) + '" target="_blank" rel="noopener" data-wa="' + texto(eq) + '">WhatsApp</a>' : '') +
              '<p class="lg-msg">' + htmlMsg(m) + '</p></li>';
          }).join('') + '</ul>';
        }
        var html = '<h2 id="lg-vt">Avisa a las capitanas</h2>' +
          '<p class="lg-avisar-ya" role="status" id="lg-guardado"><b>Guardando el cambio…</b><span>Mientras, avisa a cada capitana de lo que cambia y márcala cuando lo hayas hecho.</span></p>' +
          '<div id="lg-caps">' + lista(null) + '</div>' +
          '<p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="lg-hecho">Hecho</button></div>';
        ventana(html, function () {
          var aviso = false, marcadas = {};
          vent.onclick = function (e) {
            var a = e.target.closest('[data-wa]');
            if (a) { var c = vent.querySelector('[data-avisada="' + a.getAttribute('data-wa') + '"]'); if (c) { c.checked = true; marcadas[c.getAttribute('data-avisada')] = 1; } }
          };
          vent.onchange = function (e) { var c = e.target.closest('[data-avisada]'); if (c) marcadas[c.getAttribute('data-avisada')] = c.checked ? 1 : 0; };
          capitanas.then(function (caps) {
            var caja = vent.querySelector('#lg-caps');
            if (!caja || fallo) return;
            caja.innerHTML = lista(caps || {});
            Object.keys(marcadas).forEach(function (k) { var c = caja.querySelector('[data-avisada="' + k + '"]'); if (c) c.checked = !!marcadas[k]; });
          }, function (e) {
            var caja = vent.querySelector('#lg-caps');
            if (caja && !fallo) caja.insertAdjacentHTML('afterbegin', '<p class="u-nota">No se han podido leer las capitanas: ' + texto(String(e.message || e).replace(/^\w+:\s*/, '')) + '. Los mensajes sí están.</p>');
          });
          guardando.then(function () {
            var g = vent.querySelector('#lg-guardado');
            if (g) g.querySelector('b').textContent = ok;
            else if (ctx.abierta()) ctx.aviso(ok); // si ya se ha cerrado la lista
          }, function (e) {
            fallo = true;
            var g = vent.querySelector('#lg-guardado');
            if (!g) return;
            g.className = 'lg-avisar-ya lg-avisar-mal';
            g.innerHTML = '<b>No se ha guardado el cambio.</b><span>' + texto(String(e.message || e).replace(/^\w+:\s*/, '')) + ' Los partidos siguen como estaban: no avises a nadie.</span>';
            var caja = vent.querySelector('#lg-caps'); if (caja) caja.innerHTML = '';
          });
          antesDeCerrar = function () {
            if (fallo) return true;
            var faltan = [].filter.call(vent.querySelectorAll('[data-avisada]'), function (c) { return !c.checked; }).length;
            if (!faltan || aviso) return true;
            aviso = true;
            verError(['Te ' + (faltan === 1 ? 'queda 1 capitana' : 'quedan ' + faltan + ' capitanas') + ' por avisar. Si ya lo has hecho por otro lado, vuelve a pulsar para cerrar.']);
            return false;
          };
          vent.querySelector('#lg-hecho').onclick = function () { cerrar(); };
        });
      }
      /** Guarda un cambio de partidos (con su función del motor): la pantalla cambia al momento y sale la lista para avisar. */
      function guardarCambio(cambios, op, pantalla, capitanas, ok) {
        var g = T.actualizar('PARTIDOS', cambios[0].p.ID, pantalla, op);
        g.catch(function () {});
        avisar(cambios, capitanas, g, ok);
      }

      /** Mover un partido a otro hueco de su liga el mismo día; si está ocupado por otro de la liga, se intercambian. */
      function formMover(p) {
        var hs = huecosMover(d.par, d.hue, p), elegido = null;
        var html = '<h2 id="lg-vt">Mover dentro del día</h2>' +
          '<p class="u-nota">' + texto(titulo(p) + ' · ' + fechaDia(p.FECHA) + ' · ahora a las ' + p.HORA + ' en ' + campo(p.ID_CAMPO)) + '</p>' +
          '<p class="lg-regla">Solo a los campos reservados para ' + texto(ligaCompleta(p.ID_LIGA)) + ' esta temporada. Si eliges uno ocupado, los dos partidos se intercambian. Cada partido se lleva el árbitro de su campo y hora nuevos (luego lo puedes cambiar en «Árbitro y estado»).</p>' +
          (hs.length ? '<div class="lg-huecos" role="radiogroup" aria-label="Hueco">' + hs.map(function (x, i) {
            var h = x.hueco, que = x.estado === 'actual' ? 'Ahora está aquí' : x.estado === 'libre' ? 'Libre' : x.estado === 'cambio' ? 'Se intercambia con ' + titulo(x.otro) : 'Ocupado: ' + titulo(x.otro) + ' (' + String(x.otro.ESTADO).toLowerCase() + ')';
            return '<button type="button" role="radio" aria-checked="false" data-h="' + i + '"' + (x.estado === 'actual' || x.estado === 'ocupado' ? ' disabled' : '') + ' class="lg-h lg-h-' + x.estado + '">' +
              '<b class="u-cifra">' + texto(h.HORA) + '</b><span>' + texto(campoLargo(h.ID_CAMPO)) + '</span><small>' + texto(que) + '</small></button>';
          }).join('') + '</div>' : '<p class="u-vacio">Esta liga no tiene huecos reservados para ese día en la tabla HUECOS: no se puede mover.</p>') +
          '<div id="lg-conf" class="lg-conf"></div><p class="u-error" role="alert" hidden></p>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="lg-guardar" disabled>Mover el partido</button><button type="button" class="u-btn" data-cerrar>Cancelar</button></div>';
        var capitanas = null;
        ventana(html, function () {
          vent.onclick = function (e) {
            var b = e.target.closest('[data-h]');
            if (!b || b.disabled) return;
            [].forEach.call(vent.querySelectorAll('[data-h]'), function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
            elegido = hs[Number(b.getAttribute('data-h'))];
            var cambios = [{ p: p, antes: foto(p), nuevo: { FECHA: p.FECHA, HORA: elegido.hueco.HORA, ID_CAMPO: elegido.hueco.ID_CAMPO, ID_ARBITRO: elegido.hueco.ID_ARBITRO || p.ID_ARBITRO || '' } }];
            if (elegido.otro) cambios.push({ p: elegido.otro, antes: foto(elegido.otro), nuevo: nuevoEn(elegido.otro, p.FECHA, p.HORA, p.ID_CAMPO) });
            vent.querySelector('#lg-conf').innerHTML = htmlCambios(cambios);
            var g = vent.querySelector('#lg-guardar');
            g.disabled = false; g.textContent = elegido.otro ? 'Intercambiar los dos partidos' : 'Mover el partido';
            g.onclick = function () {
              guardarCambio(cambios, { fn: 'ligasMover', args: [p.ID, elegido.hueco.ID] }, { HORA: elegido.hueco.HORA, ID_CAMPO: elegido.hueco.ID_CAMPO, ID_HUECO: elegido.hueco.ID, ID_ARBITRO: cambios[0].nuevo.ID_ARBITRO },
                capitanas || ctx.llamar('ligasCapitanas', [equiposDe(cambios.map(function (c) { return c.p; }))]),
                elegido.otro ? 'Partidos intercambiados.' : 'Partido movido.');
            };
            // Las capitanas se piden ya, para que la lista salga al momento al guardar.
            capitanas = ctx.llamar('ligasCapitanas', [equiposDe(cambios.map(function (c) { return c.p; }))]);
            capitanas.catch(function () {});
          };
        });
      }

      /**
       * Recuperar aplazados en huecos libres de su liga: se eligen los partidos (uno, varios o la jornada entera), el día y,
       * para cada uno, la hora y el campo entre los huecos libres de ese día (propuesto: el siguiente libre, por hora). Se ven primero los días en que la liga no juega, que
       * son los que se dejan para recuperar. Antes de guardar, el aviso de las capitanas; al guardar, la lista para avisarlas.
       * elegidos: los IDs de aplazados marcados al abrir (null: todos los pendientes).
       */
      function formRecuperar(idLiga, elegidos) {
        var pend = aplazadosPendientes(d.par, idLiga);
        if (!pend.length) return;
        var marcados = {}, dia = '', capitanas = null, horas = {}; // horas: aplazado → hueco elegido
        // Desde el aviso, la primera jornada pendiente; desde la ficha, ese partido.
        pend.forEach(function (p) { marcados[p.ID] = elegidos ? elegidos.indexOf(p.ID) >= 0 : num(p.JORNADA) === num(pend[0].JORNADA); });
        var jornadasP = jornadas(pend), hasta = temp && temp.FECHA_FIN ? temp.FECHA_FIN : sumarDias(hoy(), 180);
        var html = '<h2 id="lg-vt">Recuperar aplazados</h2>' +
          '<p class="u-nota">' + texto(ligaCompleta(idLiga)) + '</p>' +
          '<p class="lg-regla">Solo en los campos reservados para la liga esta temporada. Eliges el día y, para cada partido, la hora y el campo entre los huecos libres. El aplazado se queda como estaba y la recuperación es un partido nuevo.</p>' +
          '<h3 class="lg-sub">1 · Qué partidos</h3><div class="lg-rec-ps">' + jornadasP.map(function (j) {
            var de = pend.filter(function (p) { return num(p.JORNADA) === j; });
            return '<fieldset class="lg-rec-j"><legend><label class="u-check"><input type="checkbox" data-jornada-rec="' + j + '"> Jornada ' + j + (de.length > 1 ? ' entera' : '') + '</label></legend>' +
              de.map(function (p) {
                return '<label class="u-check"><input type="checkbox" data-rec="' + texto(p.ID) + '"' + (marcados[p.ID] ? ' checked' : '') + '><span class="lg-eqt"><span><b>' + texto(titulo(p)) + '</b>' +
                  '<small>' + texto('Era el ' + fechaDia(p.FECHA).toLowerCase() + ' · ' + p.HORA + ' · ' + campo(p.ID_CAMPO) + (p.MOTIVO ? ' · ' + p.MOTIVO : '')) + '</small></span></span></label>';
              }).join('') + '</fieldset>';
          }).join('') + '</div>' +
          '<h3 class="lg-sub">2 · Qué día</h3><div id="lg-rec-dias"></div>' +
          '<div id="lg-conf" class="lg-conf"></div><p class="u-error" role="alert" hidden></p>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="lg-guardar" disabled>Recuperar</button><button type="button" class="u-btn" data-cerrar>Cancelar</button></div>';
        ventana(html, function () {
          function elegidosAhora() { return pend.filter(function (p) { return marcados[p.ID]; }); }
          function pintarDias() {
            var sel = elegidosAhora(), caja = vent.querySelector('#lg-rec-dias');
            [].forEach.call(vent.querySelectorAll('[data-jornada-rec]'), function (c) {
              var de = pend.filter(function (p) { return String(num(p.JORNADA)) === c.getAttribute('data-jornada-rec'); });
              c.checked = de.every(function (p) { return marcados[p.ID]; });
              c.indeterminate = !c.checked && de.some(function (p) { return marcados[p.ID]; });
            });
            if (!sel.length) { caja.innerHTML = '<p class="u-vacio">Marca al menos un partido.</p>'; dia = ''; confirmar(); return; }
            var rep = repetidos(sel);
            if (rep.length) {
              caja.innerHTML = '<p class="lg-pav lg-pav-ficha lg-av-si">' + texto(rep.map(equipo).join(' y ') + (rep.length === 1 ? ' jugaría' : ' jugarían') + ' dos veces el mismo día. Recupera esos partidos en días distintos: marca menos y repite después con los demás.') + '</p>';
              dia = ''; confirmar(); return;
            }
            var ds = diasRecuperar(d.par, d.hue, d.cal, idLiga, sel, hoy() > (temp && temp.FECHA_INICIO || '') ? hoy() : temp.FECHA_INICIO, hasta, 9);
            ds.sort(function (a, b) { return (a.ok ? 0 : 1) - (b.ok ? 0 : 1) || (a.sinPartidos ? 0 : 1) - (b.sinPartidos ? 0 : 1) || orden(a.fecha, b.fecha); });
            if (ds.filter(function (x) { return x.ok; }).every(function (x) { return x.fecha !== dia; })) dia = '';
            caja.innerHTML = ds.length ? '<div class="lg-huecos" role="radiogroup" aria-label="Día">' + ds.map(function (x) {
              return '<button type="button" role="radio" aria-checked="' + (x.fecha === dia) + '" data-dia="' + x.fecha + '"' + (x.ok ? '' : ' disabled') + ' class="lg-h' + (x.ok && x.sinPartidos ? ' lg-h-libre' : '') + '">' +
                '<b>' + texto(fechaDia(x.fecha)) + '</b><span>' + texto(x.ok ? x.libres + (x.libres === 1 ? ' hueco libre' : ' huecos libres') : 'No se puede') + '</span>' +
                '<small>' + texto(x.ok ? (x.sinPartidos ? 'La liga no juega: día para recuperar' : 'La liga ya juega ese día') : x.equipo ? equipo(x.equipo) + ' ya juega ese día' : x.motivo) + '</small></button>';
            }).join('') + '</div>' : '<p class="u-vacio">La liga no tiene huecos en HUECOS: no se puede recuperar aquí.</p>';
            confirmar();
          }
          function confirmar() {
            var g = vent.querySelector('#lg-guardar'), conf = vent.querySelector('#lg-conf'), sel = elegidosAhora();
            if (!dia || !sel.length) { conf.innerHTML = ''; g.disabled = true; g.textContent = 'Recuperar'; return; }
            var plan = planRecuperar(d.par, d.hue, dia, sel);
            if (plan.error) { conf.innerHTML = ''; g.disabled = true; return; }
            // La hora y el campo de cada partido: la propuesta (el siguiente hueco libre), que se puede cambiar por otro libre.
            var libres = huecosLibres(d.par, d.hue, idLiga, dia), hi = indice(libres);
            plan.asignaciones.forEach(function (a) { if (!horas[a.p.ID] || !hi[horas[a.p.ID]]) horas[a.p.ID] = a.hueco.ID; });
            var usados = {}, repetido = false;
            sel.forEach(function (p) { if (usados[horas[p.ID]]) repetido = true; usados[horas[p.ID]] = 1; });
            var cambios = sel.map(function (p) { var h = hi[horas[p.ID]]; return { p: p, hueco: h, recupera: true, antes: foto(p), nuevo: { FECHA: dia, HORA: h.HORA, ID_CAMPO: h.ID_CAMPO } }; });
            conf.innerHTML = '<h3 class="lg-sub">3 · A qué hora</h3><div class="lg-rec-horas">' + sel.map(function (p) {
              return '<label class="u-campo"><span class="u-etiqueta">' + texto(titulo(p) + ' · J' + p.JORNADA) + '</span><select data-hora="' + texto(p.ID) + '">' +
                opciones(libres.map(function (h) { return [h.ID, h.HORA + ' · ' + campoLargo(h.ID_CAMPO)]; }), horas[p.ID]) + '</select></label>';
            }).join('') + '</div>' +
              (repetido ? '<p class="lg-pav lg-pav-ficha lg-av-no">Dos partidos no pueden ir al mismo hueco: cambia la hora de uno.</p>' : htmlCambios(cambios));
            if (repetido) { g.disabled = true; return; }
            g.disabled = false; g.textContent = 'Recuperar ' + (sel.length === 1 ? 'el partido' : 'los ' + sel.length + ' partidos') + ' el ' + fechaDia(dia).toLowerCase();
            capitanas = ctx.llamar('ligasCapitanas', [equiposDe(sel)]);
            capitanas.catch(function () {});
            g.onclick = function () {
              var a0 = cambios[0];
              var valores = { ID_LIGA: a0.p.ID_LIGA, JORNADA: a0.p.JORNADA, FECHA: dia, HORA: a0.hueco.HORA, ID_CAMPO: a0.hueco.ID_CAMPO, ID_HUECO: a0.hueco.ID,
                ID_ARBITRO: a0.hueco.ID_ARBITRO || a0.p.ID_ARBITRO || '', ID_GESTOR: a0.p.ID_GESTOR || '', ID_INSCRIPCION_LOCAL: a0.p.ID_INSCRIPCION_LOCAL,
                ID_INSCRIPCION_VISITANTE: a0.p.ID_INSCRIPCION_VISITANTE, ESTADO: 'Programado', ID_PARTIDO_ORIGEN: a0.p.ID };
              var gd = T.crear('PARTIDOS', valores, { fn: 'ligasRecuperar', args: [dia, cambios.map(function (c) { return { id: c.p.ID, hueco: c.hueco.ID }; })] });
              gd.catch(function () {});
              avisar(cambios, capitanas, gd, cambios.length === 1 ? 'Partido recuperado.' : cambios.length + ' partidos recuperados.');
            };
          }
          vent.onchange = function (e) {
            var c = e.target;
            if (c.hasAttribute('data-hora')) { horas[c.getAttribute('data-hora')] = c.value; confirmar(); return; }
            if (c.hasAttribute('data-rec')) marcados[c.getAttribute('data-rec')] = c.checked;
            else if (c.hasAttribute('data-jornada-rec')) pend.forEach(function (p) { if (String(num(p.JORNADA)) === c.getAttribute('data-jornada-rec')) { marcados[p.ID] = c.checked; var x = vent.querySelector('[data-rec="' + p.ID + '"]'); if (x) x.checked = c.checked; } });
            else return;
            pintarDias();
          };
          vent.onclick = function (e) {
            var b = e.target.closest('[data-dia]');
            if (!b || b.disabled) return;
            dia = b.getAttribute('data-dia'); horas = {};
            [].forEach.call(vent.querySelectorAll('[data-dia]'), function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
            confirmar();
          };
          pintarDias();
        });
      }

      /** Intercambiar la fecha de la jornada abierta con otra de la misma liga. */
      function formJornadas() {
        var ps = partidosLiga(actual.liga.ID), A = jornadaMovible(ps, S.jornada, hoy()), a = S.jornada;
        if (!A.ok) return;
        var otras = jornadas(ps).filter(function (j) { return j !== a; }).map(function (j) { return { j: j, m: jornadaMovible(ps, j, hoy()) }; });
        var si = otras.filter(function (x) { return x.m.ok; }), no = otras.filter(function (x) { return !x.m.ok; }), porQue = {};
        no.forEach(function (x) { (porQue[x.m.motivo] = porQue[x.m.motivo] || []).push('J' + x.j); });
        var html = '<h2 id="lg-vt">Intercambiar la fecha de la jornada ' + a + '</h2>' +
          '<p class="u-nota">' + texto(ligaCompleta(actual.liga.ID) + ' · jornada ' + a + ': ' + fechaDia(A.fecha) + ' · ' + fecha(A.fecha)) + '</p>' +
          '<p class="lg-regla">Los partidos de las dos jornadas cambian de día y se quedan en su hora y su campo, con el árbitro que tiene ese campo a esa hora. Solo jornadas sin jugar, de hoy en adelante y en un solo día.</p>' +
          (si.length ? '' : '<p class="u-vacio">No hay ninguna otra jornada con la que se pueda intercambiar.</p>') +
          '<div class="lg-huecos" role="radiogroup" aria-label="Jornada">' + si.map(function (x) {
            var esp = x.m.ok ? especial(x.m.fecha) : '';
            return '<button type="button" role="radio" aria-checked="false" data-j="' + x.j + '"' + (x.m.ok ? '' : ' disabled') + ' class="lg-h' + (x.m.ok ? '' : ' lg-h-ocupado') + '">' +
              '<b>J' + x.j + '</b><span>' + texto(x.m.ok ? fechaDia(x.m.fecha) + ' · ' + fecha(x.m.fecha) : 'No se puede') + '</span><small>' + texto(x.m.ok ? (esp || '') : x.m.motivo) + '</small></button>';
          }).join('') + '</div>' +
          (no.length ? '<p class="u-nota">' + texto(Object.keys(porQue).map(function (k) { return porQue[k].join(', ') + ': ' + k; }).join('. ')) + '.</p>' : '') +
          '<div id="lg-conf" class="lg-conf"></div><p class="u-error" role="alert" hidden></p>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="lg-guardar" disabled>Intercambiar las fechas</button><button type="button" class="u-btn" data-cerrar>Cancelar</button></div>';
        var capitanas = null;
        ventana(html, function () {
          vent.onclick = function (e) {
            var b = e.target.closest('[data-j]');
            if (!b || b.disabled) return;
            [].forEach.call(vent.querySelectorAll('[data-j]'), function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
            var bj = Number(b.getAttribute('data-j')), B = jornadaMovible(ps, bj, hoy());
            var cambios = A.ps.map(function (p) { return { p: p, antes: foto(p), nuevo: nuevoEn(p, B.fecha, p.HORA, p.ID_CAMPO) }; })
              .concat(B.ps.map(function (p) { return { p: p, antes: foto(p), nuevo: nuevoEn(p, A.fecha, p.HORA, p.ID_CAMPO) }; }));
            var esp = [especial(B.fecha) ? 'Ojo: el ' + fechaDia(B.fecha).toLowerCase() + ' es ' + especial(B.fecha).toLowerCase() + '.' : '',
              especial(A.fecha) ? 'Ojo: el ' + fechaDia(A.fecha).toLowerCase() + ' es ' + especial(A.fecha).toLowerCase() + '.' : ''].filter(String).join(' ');
            vent.querySelector('#lg-conf').innerHTML = '<p class="lg-regla"><b>J' + a + '</b> pasa al ' + texto(fechaDia(B.fecha).toLowerCase()) + ' y <b>J' + bj + '</b> al ' + texto(fechaDia(A.fecha).toLowerCase()) + '. ' + texto(esp) + '</p>' + htmlCambios(cambios);
            var g = vent.querySelector('#lg-guardar');
            g.disabled = false;
            capitanas = ctx.llamar('ligasCapitanas', [equiposDe(cambios.map(function (c) { return c.p; }))]);
            capitanas.catch(function () {});
            g.onclick = function () {
              guardarCambio(cambios, { fn: 'ligasJornadas', args: [actual.liga.ID, a, bj, A.ps[0].ID] }, { FECHA: B.fecha, ID_ARBITRO: cambios[0].nuevo.ID_ARBITRO }, capitanas, 'Jornadas ' + a + ' y ' + bj + ' intercambiadas.');
              S.fecha = B.fecha; // la jornada que se estaba viendo, en su día nuevo
            };
          };
        });
      }

      /** Árbitro, gestor y estado (aplazar, suspender, anular). El día, la hora y el campo se cambian moviendo el partido. */
      function formPartido(p) {
        var ests = ['Programado', 'Aplazado', 'Suspendido', 'Anulado', 'Libre'].concat(p.ESTADO === 'Jugado' ? ['Jugado'] : []);
        var conStaff = function (f, ya) {
          var l = staff.staff.filter(function (s) { return f(s) && s.ACTIVO; }).map(function (s) { return s.ID; });
          ya.forEach(function (x) { if (x && l.indexOf(x) < 0) l.push(x); });
          return l.map(function (x) { return [x, persona(x)]; });
        };
        var html = '<h2 id="lg-vt">' + texto(titulo(p)) + '</h2><p class="u-nota">' + texto(fechaDia(p.FECHA) + ' · ' + p.HORA + ' · ' + campo(p.ID_CAMPO)) +
          (p.ESTADO === 'Programado' && String(p.FECHA || '') >= hoy() ? '. Para cambiar la hora o el campo, usa «Mover dentro del día».' : '.') + '</p>' +
          '<div class="u-campos">' +
          campoF('Árbitro', '<select id="lg-ID_ARBITRO">' + opciones(conStaff(function (s) { return s.ARBITRO; }, [p.ID_ARBITRO]), p.ID_ARBITRO, 'Sin asignar') + '</select>') +
          campoF('Gestor', '<select id="lg-ID_GESTOR">' + opciones(conStaff(function (s) { return s.GESTOR; }, [p.ID_GESTOR]), p.ID_GESTOR, 'Sin gestor') + '</select>') +
          campoF('Estado', '<select id="lg-ESTADO">' + opciones(ests.map(function (e) { return [e, e]; }), p.ESTADO) + '</select>') +
          campoF('Lo provoca', '<select id="lg-ANULADO_POR">' + opciones([p.ID_INSCRIPCION_LOCAL, p.ID_INSCRIPCION_VISITANTE].filter(Boolean).map(function (e) { return [e, equipo(e)]; }), p.ANULADO_POR, 'Ninguno de los dos') + '</select>', 'lg-si-anulado') +
          campoF('Motivo', '<input type="text" id="lg-MOTIVO" maxlength="200" value="' + texto(p.MOTIVO) + '">', 'u-ancho lg-si-motivo') +
          campoF('Notas', '<textarea id="lg-NOTAS" rows="2">' + texto(p.NOTAS) + '</textarea>', 'u-ancho') + '</div>' +
          '<p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="lg-guardar">Guardar cambios</button>' +
          '<button type="button" class="u-btn" data-cerrar>Cancelar</button></div>';
        ventana(html, function () {
          function ver() {
            var e = val('lg-ESTADO');
            vent.querySelector('.lg-si-anulado').hidden = e !== 'Anulado';
            vent.querySelector('.lg-si-motivo').hidden = CON_MOTIVO.indexOf(e) < 0;
          }
          ver();
          vent.onchange = function (e) { if (e.target.id === 'lg-ESTADO') ver(); };
          var g = vent.querySelector('#lg-guardar');
          g.onclick = function () {
            var v = {}, c = {}, mal = [];
            ['ID_ARBITRO', 'ID_GESTOR', 'ESTADO', 'MOTIVO', 'ANULADO_POR', 'NOTAS'].forEach(function (k) { v[k] = val('lg-' + k); });
            if (v.ESTADO !== 'Anulado') v.ANULADO_POR = '';
            if (CON_MOTIVO.indexOf(v.ESTADO) < 0) v.MOTIVO = '';
            else if (!v.MOTIVO) mal.push('Di el motivo.');
            Object.keys(v).forEach(function (k) { if (String(p[k] == null ? '' : p[k]) !== v[k]) c[k] = v[k]; });
            verError(mal);
            if (mal.length) return;
            if (!Object.keys(c).length) { cerrar(true); return; }
            var pierde = p.ESTADO === 'Jugado' && v.ESTADO !== 'Jugado';
            if (pierde && !g.getAttribute('data-ok')) { g.setAttribute('data-ok', '1'); g.textContent = 'Se borra el resultado y sus goles: pulsa otra vez'; return; }
            var pantalla = Object.assign({}, c, pierde ? { GOLES_LOCAL: '', GOLES_VISITANTE: '' } : {});
            // Como el motor: un anulado por culpa de un equipo se queda con su 0-5 en el Excel; si deja de estarlo, sin resultado.
            var an = resultadoAnulado(Object.assign({}, p, v), nAnulado());
            if (an) { pantalla.GOLES_LOCAL = an.gl; pantalla.GOLES_VISITANTE = an.gv; }
            else if (p.ESTADO === 'Anulado') { pantalla.GOLES_LOCAL = ''; pantalla.GOLES_VISITANTE = ''; }
            cerrar(true);
            T.actualizar('PARTIDOS', p.ID, pantalla, { fn: 'ligasPartido', args: [p.ID, c] }).then(function (r) {
              if (r && r.quitados) T.refrescar(['GOLES']).catch(function () {});
              if (ctx.abierta()) ctx.aviso('Partido guardado.');
            }, function () {});
          };
        });
      }

      /* ---------- eventos ---------- */

      function irA(tab) { S.tab = tab; guardado(CLAVE + 'tab', tab); pintar(); window.scrollTo(0, 0); }
      el.addEventListener('click', function (e) {
        var t = e.target;
        if (t.closest('[data-cerrar]')) { cerrar(); return; }
        if (velo.contains(t)) return;
        var b = t.closest('#lg-fres'); if (b) { S.filtros = !S.filtros; pintarResumen(); return; }
        b = t.closest('[data-tab]'); if (b) { irA(b.getAttribute('data-tab')); return; }
        b = t.closest('[data-comp]');
        if (b) {
          S.comp = b.getAttribute('data-comp'); S.liga = ''; S.fecha = ''; guardado(CLAVE + 'comp', S.comp); guardado(CLAVE + 'liga', '');
          // En el móvil, los filtros se recogen solos si ya no hay liga que elegir.
          if (S.comp === '*' || ligas.filter(function (x) { return x.comp.ID === S.comp; }).length < 2) S.filtros = false;
          pintar(); return;
        }
        b = t.closest('[data-liga]'); if (b) { S.liga = b.getAttribute('data-liga'); S.fecha = ''; S.filtros = false; guardado(CLAVE + 'liga', S.liga); pintar(); return; }
        b = t.closest('[data-fecha]'); if (b) { S.fecha = b.getAttribute('data-fecha'); pintar(); return; }
        b = t.closest('[data-dias]');
        if (b) { var tira = cont.querySelector('.lg-dias-tira'), una = tira && tira.firstElementChild; if (una) tira.scrollBy({ left: Number(b.getAttribute('data-dias')) * 3 * (una.offsetWidth + 8), behavior: 'smooth' }); return; }
        b = t.closest('[data-jug]'); if (b) { fichaJugadora(b.getAttribute('data-jug'), b.getAttribute('data-ij')); return; }
        b = t.closest('[data-golamb]'); if (b) { S.golAmbito = b.getAttribute('data-golamb'); guardado(CLAVE + 'golamb', S.golAmbito); pintar(); return; }
        b = t.closest('[data-accion="jornadas"]'); if (b) { formJornadas(); return; }
        b = t.closest('[data-accion="recuperar"]'); if (b) { formRecuperar(actual.liga.ID, null); return; }
        b = t.closest('[data-accion="copiar"]'); if (b) { copiar(); return; }
        b = t.closest('[data-ir-pend]'); if (b) { S.comp = '*'; S.mios = true; S.fecha = b.getAttribute('data-ir-pend'); pintar(); return; }
        b = t.closest('[data-p]'); if (b) ficha(b.getAttribute('data-p'));
      });
      el.addEventListener('keydown', function (e) { if (e.key === 'Escape' && velo.classList.contains('abierto')) cerrar(); });
      velo.addEventListener('click', function (e) { if (e.target === velo) cerrar(); });
      el.addEventListener('change', function (e) {
        var t = e.target;
        if (t === selTemp) { S.temp = t.value; S.comp = ''; S.liga = ''; S.jornada = null; guardado(CLAVE + 'temp', t.value); pintar(); }
        else if (t === chkMios) { S.mios = t.checked; guardado(CLAVE + 'mios2', t.checked ? 'si' : 'no'); pintar(); }
      });

      // Buscar en Goleadoras: solo se repinta el resultado (el campo no pierde el foco).
      var tBusca = 0;
      el.addEventListener('input', function (e) {
        if (e.target.id !== 'lg-gq') return;
        S.q = e.target.value; clearTimeout(tBusca);
        tBusca = setTimeout(function () { var r = cont.querySelector('#lg-gol-res'); if (r) r.innerHTML = htmlGolRes(); }, 150);
      });
      ctx.alCambiar(function (t) { if (TABLAS.indexOf(t) >= 0 && !velo.classList.contains('abierto')) pintar(); });
      /** Pone Partidos en la temporada, competición, liga y día de un partido (T0277). false si no está. */
      function irA(id) {
        var p = T.fila('PARTIDOS', id), l = p && T.fila('LIGAS', p.ID_LIGA), c = l && T.fila('COMPETICIONES', l.ID_COMPETICION);
        if (!p) return false;
        S.tab = 'PARTIDOS'; S.fecha = String(p.FECHA || '');
        if (c) { S.temp = String(c.ID_TEMPORADA || ''); if (S.comp !== '*') S.comp = String(c.ID); S.liga = String(l.ID); }
        return true;
      }
      ctx.tablas.leer(TABLAS).then(function () {
        S.leido = true;
        var ir = pedido && irA(pedido);
        pintar();
        if (ir) ficha(pedido);
        else if (pedido) ctx.aviso('Ese partido ya no está en Ligas.');
        pedido = '';
      }, function (e) {
        cont.innerHTML = '<p class="u-error">No se han podido leer las ligas.</p><p class="u-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Vuelve a abrir la sección para probar otra vez.</p>';
      });
      // Los nombres del staff y los colores de los equipos: los guardados, al momento; los de ahora, por detrás.
      ctx.llamar('ligasStaff').then(function (r) {
        staff = r || staff; guardadoJson(KSTAFF, staff); quien.yo = staff.yo;
        if (ix) ix.staff = indice(staff.staff);
        if (ctx.abierta() && !velo.classList.contains('abierto')) pintar();
      }, function () {});
      if (copiaPuede) ctx.llamar('ligasPagosStaff', [false]).then(function (e) { copiaE = e || {}; pintarCopia(); }, function () {});
      ctx.llamar('ligasColores').then(function (r) {
        colores = r || {}; guardadoJson(KCOL, colores);
        if (ctx.abierta() && !velo.classList.contains('abierto')) pintar();
      }, function () {});
      this._cerrar = function () { cerrar(true); };
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); }
  });
})();
