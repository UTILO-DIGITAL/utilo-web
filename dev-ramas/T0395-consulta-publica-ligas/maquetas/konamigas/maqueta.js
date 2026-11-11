/*
 * La maqueta de Konamigas · T0364 · clientes/konamigas/modulos/maqueta de utilo-apps
 *
 * Para enseñar a Konamigas la propuesta completa, con su interfaz y sus datos (los de ejemplo o los Excel de verdad del
 * modo local). Solo va en el proyecto konamigas/maqueta, que no se publica. Una sección, dos sitios:
 * - konamigas.com (index.html, con web.js y ctx.web): la web de todas. Sin entrar, inicio (las inscripciones y las
 *   competiciones en curso) y cada competición (próximos, resultados, clasificación y goleadoras). Al entrar con su
 *   correo, «Mi área» es su inicio (sus novedades y sus partidos, que se tocan: reclamar, avisar…); la capitana, también
 *   su equipo y sus incidencias. Competiciones es la liga entera. Las inscripciones y la bolsa de jugadoras son la página que ya existe (inscripciones/). El staff entra
 *   con Google en la plataforma (app/).
 *   Competiciones es la sección Ligas de verdad, solo para ver; la capitana reclama desde la ficha de un partido suyo.
 * - La sección «Futuro» de la plataforma (app/): Incidencias (como le llegan al gestor) y Redes sociales, con las
 *   jornadas temáticas (Halloween, Navidad…): su
 *   aviso a las jugadoras, que sale en konamigas.com, sus tareas (en Tareas, de verdad) y su plantilla de publicación.
 *   Lo del árbitro ya existe: entrando en la plataforma con el perfil Árbitro.
 * - Lee con ctx.tablas, como cualquier sección; no escribe en ninguna suya: lo que se hace aquí (una incidencia, un
 *   aviso, una publicación) se queda en la pantalla; lo compartido, en el motor de la maqueta (maquetaComun). Las tareas de una jornada temática se crean con
 *   Tareas (kanbanCrear), en la memoria del modo local o de la copia del móvil. Todas llevan la franja «Maqueta».
 * - Los cálculos (CALC) se prueban en node: herramientas/probar-maqueta.js.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function hoy() { return iso(new Date()); }
  function deIso(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function sumarDias(s, n) { var d = deIso(s); if (!d) return ''; d.setDate(d.getDate() + n); return iso(d); }
  function fechaDia(s) { var d = deIso(s); return d ? DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()] : String(s || ''); }
  function fechaCorta(s) { var d = deIso(s); return d ? d.getDate() + ' ' + MESES[d.getMonth()] : String(s || ''); }
  function num(v) { return typeof v === 'number' ? v : String(v == null ? '' : v).trim() === '' ? NaN : Number(v); }
  function orden(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function indice(filas, k) { var o = {}; (filas || []).forEach(function (f) { o[String(f[k || 'ID'])] = f; }); return o; }
  function grupos(filas, k) { var o = {}; (filas || []).forEach(function (f) { var v = String(f[k] == null ? '' : f[k]); (o[v] = o[v] || []).push(f); }); return o; }
  function cuando(p) { return String(p.FECHA || '') + ' ' + String(p.HORA || ''); }
  function conResultado(p) { return p.ESTADO === 'Jugado' && !!p.ID_INSCRIPCION_LOCAL && !!p.ID_INSCRIPCION_VISITANTE && isFinite(num(p.GOLES_LOCAL)) && isFinite(num(p.GOLES_VISITANTE)); }
  function juega(p, ie) { return String(p.ID_INSCRIPCION_LOCAL) === String(ie) || String(p.ID_INSCRIPCION_VISITANTE) === String(ie); }

  /** La temporada de hoy (o la más nueva): una fila de TEMPORADAS. */
  function temporadaActual(temps, h) {
    var l = (temps || []).slice().sort(function (a, b) { return orden(String(b.FECHA_INICIO || b.ID), String(a.FECHA_INICIO || a.ID)); });
    return l.filter(function (t) { return t.FECHA_INICIO && t.FECHA_FIN && t.FECHA_INICIO <= h && h <= t.FECHA_FIN; })[0] || l[0] || null;
  }

  /** Clasificación de una liga: [{ id, pos, pj, pg, pe, pp, gf, gc, dg, pts }], con los equipos sin partidos a cero. */
  function clasificacion(ps, equipos, puntos) {
    var P = puntos || { GANAR: 3, EMPATAR: 1, PERDER: 0 }, t = {};
    var fila = function (id) { return t[id] || (t[id] = { id: id, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 }); };
    (equipos || []).forEach(function (id) { if (id) fila(String(id)); });
    (ps || []).filter(conResultado).forEach(function (p) {
      var gl = num(p.GOLES_LOCAL), gv = num(p.GOLES_VISITANTE);
      [[String(p.ID_INSCRIPCION_LOCAL), gl, gv], [String(p.ID_INSCRIPCION_VISITANTE), gv, gl]].forEach(function (x) {
        var e = fila(x[0]); e.pj++; e.gf += x[1]; e.gc += x[2];
        if (x[1] > x[2]) { e.pg++; e.pts += P.GANAR; } else if (x[1] === x[2]) { e.pe++; e.pts += P.EMPATAR; } else { e.pp++; e.pts += P.PERDER; }
      });
    });
    return Object.keys(t).map(function (k) { var e = t[k]; e.dg = e.gf - e.gc; return e; })
      .sort(function (a, b) { return b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || orden(a.id, b.id); })
      .map(function (e, i) { e.pos = i + 1; return e; });
  }

  /** «Ganado», «Empatado» o «Perdido» de un equipo en un partido jugado; '' si no se ha jugado. */
  function resultadoDe(p, ie) {
    if (!conResultado(p)) return '';
    var gl = num(p.GOLES_LOCAL), gv = num(p.GOLES_VISITANTE), local = String(p.ID_INSCRIPCION_LOCAL) === String(ie);
    var a = local ? gl : gv, b = local ? gv : gl;
    return a > b ? 'Ganado' : a === b ? 'Empatado' : 'Perdido';
  }

  /** Un número del 0 al 1 que sale siempre igual para el mismo texto (para los goles de ejemplo). */
  function azar(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }

  /**
   * Los goles de una jugadora: los de GOLES con sus inscripciones. Si GOLES está vacía para todo su equipo (el acta aún no
   * dice quién marca), unos de ejemplo: en cada partido jugado de su equipo, alguno de los goles del equipo, siempre los
   * mismos para la misma jugadora. [{ partido, ie, goles, ejemplo }]
   */
  function golesJugadora(goles, ijs, partidosEquipo) {
    var mias = {}, por = {};
    (ijs || []).forEach(function (ij) { mias[String(ij.ID)] = ij; });
    var reales = (goles || []).filter(function (g) { return mias[String(g.ID_INSCRIPCION_JUGADORA)]; });
    if (reales.length) {
      // Los que pone la maqueta (MAQUETA.js · maquetaPreparar) llevan NOTAS «Ejemplo (maqueta)»: se dice que son de ejemplo.
      reales.forEach(function (g) { var k = String(g.ID_PARTIDO); (por[k] = por[k] || { partido: k, ie: String(g.ID_INSCRIPCION_EQUIPO), goles: 0, ejemplo: g.NOTAS === 'Ejemplo (maqueta)' }).goles++; });
      return Object.keys(por).map(function (k) { return por[k]; });
    }
    var ies = {}, conGoles = {};
    (ijs || []).forEach(function (ij) { ies[String(ij.ID_INSCRIPCION_EQUIPO)] = ij; });
    (goles || []).forEach(function (g) { conGoles[String(g.ID_PARTIDO)] = 1; });
    var out = [];
    (partidosEquipo || []).filter(conResultado).forEach(function (p) {
      if (conGoles[p.ID]) return; // ese partido ya tiene sus goles apuntados (y no son suyos)
      var ie = ies[String(p.ID_INSCRIPCION_LOCAL)] ? String(p.ID_INSCRIPCION_LOCAL) : ies[String(p.ID_INSCRIPCION_VISITANTE)] ? String(p.ID_INSCRIPCION_VISITANTE) : '';
      if (!ie) return;
      var delEquipo = num(String(p.ID_INSCRIPCION_LOCAL) === ie ? p.GOLES_LOCAL : p.GOLES_VISITANTE);
      var r = azar(p.ID + '|' + ies[ie].ID), n = r < 0.55 ? 0 : r < 0.85 ? 1 : r < 0.96 ? 2 : 3;
      n = Math.min(n, delEquipo);
      if (n > 0) out.push({ partido: String(p.ID), ie: ie, goles: n, ejemplo: true });
    });
    return out;
  }

  /**
   * El plan de publicaciones de Redes sociales entre desde y hasta, sacado de los partidos: el día después de cada día
   * con partidos, «Resultados»; el día antes, «Previa»; los miércoles, «Jugadora de la semana»; y el día después de un
   * día con partidos, si hay fotos publicables, «Fotos de la jornada». Lo pasado, Publicada; lo de los próximos 7 días,
   * Programada; lo demás, Borrador. [{ fecha, tipo, titulo, redes, estado, ligas }] por fecha.
   */
  function planRedes(partidos, nombreLiga, desde, hasta, h, hayFotos) {
    var porDia = {};
    (partidos || []).forEach(function (p) {
      if (!p.FECHA || p.ESTADO === 'Anulado' || p.ESTADO === 'Libre') return;
      (porDia[p.FECHA] = porDia[p.FECHA] || {})[p.ID_LIGA] = 1;
    });
    var out = [], estado = function (f) { return f < h ? 'Publicada' : f <= sumarDias(h, 7) ? 'Programada' : 'Borrador'; };
    var mete = function (f, tipo, titulo, redes, ligas) { if (f >= desde && f <= hasta) out.push({ fecha: f, tipo: tipo, titulo: titulo, redes: redes, estado: estado(f), ligas: ligas || [] }); };
    Object.keys(porDia).sort().forEach(function (f) {
      var ligas = Object.keys(porDia[f]).map(nombreLiga), d = deIso(f), dia = DIAS[d.getDay()].toLowerCase();
      mete(sumarDias(f, -1), 'Previa', 'Previa del ' + dia + ': ' + ligas.length + (ligas.length === 1 ? ' liga' : ' ligas'), ['Instagram'], ligas);
      mete(sumarDias(f, 1), 'Resultados', 'Resultados del ' + dia + ' ' + d.getDate(), ['Instagram', 'TikTok'], ligas);
      if (hayFotos) mete(sumarDias(f, 1), 'Fotos', 'Fotos de la jornada del ' + dia, ['Instagram'], ligas);
    });
    for (var f = desde; f <= hasta; f = sumarDias(f, 1)) if (deIso(f).getDay() === 3) mete(f, 'Jugadora', 'Jugadora de la semana', ['Instagram', 'TikTok']);
    return out.sort(function (a, b) { return orden(a.fecha, b.fecha) || orden(a.tipo, b.tipo); });
  }

  /** «laura.gomez@gmail.com» → «la•••••@gmail.com», para enseñar un correo sin darlo entero. */
  function tapar(correo) { var m = /^([^@]{1,2})[^@]*(@.*)$/.exec(String(correo || '')); return m ? m[1] + '•••••' + m[2] : ''; }

  /** El domingo de Pascua de un año (algoritmo anónimo gregoriano), 'aaaa-mm-dd'. */
  function pascua(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return y + '-' + dos(mes) + '-' + dos(dia);
  }
  /** El lunes de la semana de un día. */
  function lunes(s) { var d = deIso(s); if (!d) return ''; d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); }

  /**
   * Las jornadas temáticas de una temporada, cada una una semana de lunes a domingo: Halloween (la del 31 de octubre),
   * Navidad (la del último día con partidos antes del 24 de diciembre), Carnaval (la del martes de Carnaval, 47 días antes
   * de Pascua) y Sant Jordi (la del 23 de abril). Solo las que caen en la temporada y, si el calendario ya llega hasta
   * esa semana, solo si esa semana se juega. [{ id, nombre, emoji, lema, desde, hasta }] por fecha.
   */
  function tematicas(temp, partidos) {
    if (!temp || !temp.FECHA_INICIO) return [];
    var y = Number(String(temp.FECHA_INICIO).slice(0, 4)), fin = String(temp.FECHA_FIN || (y + 1) + '-07-31');
    var dias = {};
    (partidos || []).forEach(function (p) { if (p.FECHA && p.ESTADO !== 'Anulado' && p.ESTADO !== 'Libre') dias[String(p.FECHA)] = 1; });
    var fechas = Object.keys(dias).sort(), ultimo = fechas[fechas.length - 1] || '';
    var nav = fechas.filter(function (f) { return f >= y + '-12-01' && f < y + '-12-24'; }).pop() || y + '-12-18';
    return [['halloween', 'Halloween', '🎃', '¡ven disfrazada!', y + '-10-31'], ['navidad', 'Navidad', '🎄', 'jersey de Navidad, gorro o lo que se os ocurra', nav],
      ['carnaval', 'Carnaval', '🎭', '¡ven disfrazada con tu equipo!', sumarDias(pascua(y + 1), -47)], ['santjordi', 'Sant Jordi', '🌹', 'una rosa para cada jugadora', (y + 1) + '-04-23']]
      .map(function (x) { var d = lunes(x[4]); return { id: x[0], nombre: x[1], emoji: x[2], lema: x[3], desde: d, hasta: sumarDias(d, 6) }; })
      .filter(function (t) {
        if (t.hasta < String(temp.FECHA_INICIO) || t.desde > fin) return false;
        if (!ultimo || ultimo < t.desde) return true; // el calendario aún no llega: se propone igual
        return fechas.some(function (f) { return f >= t.desde && f <= t.hasta; });
      });
  }
  /** Las tareas de una jornada temática, con su fecha límite: [{ titulo, deadline, texto }]. ps: sus partidos. */
  function tareasTematica(t, ps, campo) {
    var dias = {};
    (ps || []).forEach(function (p) { var k = String(p.FECHA); (dias[k] = dias[k] || { n: 0, campos: {} }).n++; if (campo) dias[k].campos[campo(p.ID_CAMPO) || '?'] = 1; });
    var lista = Object.keys(dias).sort().map(function (f) { return fechaDia(f) + ': ' + plural_(dias[f].n, 'partido', 'partidos') + (campo ? ' (' + Object.keys(dias[f].campos).join(', ') + ')' : ''); });
    return [
      { titulo: 'Avisar a los fotógrafos: ' + t.nombre, deadline: sumarDias(t.desde, -14),
        texto: 'Semana de ' + t.nombre + ' (' + fechaCorta(t.desde) + ' – ' + fechaCorta(t.hasta) + '): ' + (lista.length ? lista.join('; ') : 'aún sin partidos') + '. Que haya fotógrafo en cada día.' },
      { titulo: 'Preparar la plantilla de ' + t.nombre, deadline: sumarDias(t.desde, -7), texto: 'La plantilla de la ocasión, para Instagram y TikTok: la previa, los resultados y las fotos de la semana de ' + t.nombre + '.' },
      { titulo: 'Premio al mejor disfraz: ' + t.nombre, deadline: sumarDias(t.desde, -3), texto: 'Elegir y comprar el premio al mejor disfraz de equipo de la semana de ' + t.nombre + '.' },
      { titulo: 'Publicar las fotos de ' + t.nombre, deadline: sumarDias(t.hasta, 3), texto: 'Subir las fotos de la semana de ' + t.nombre + ' con su plantilla (solo las de quien ha dado permiso).' }
    ];
  }
  /** Tareas no deja títulos de más de 50 caracteres. */
  function corto(t) { t = String(t); return t.length > 50 ? t.slice(0, 49).replace(/\s+\S*$/, '') + '…' : t; }
  function plural_(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

  /** Lo que importa de cada partido para avisar a las jugadoras: { ID: 'ESTADO|FECHA|HORA|CAMPO|GL|GV' }. */
  var CAMPOS_PARTIDO = ['ESTADO', 'FECHA', 'HORA', 'ID_CAMPO', 'GOLES_LOCAL', 'GOLES_VISITANTE'];
  function instantanea(ps) { var o = {}; (ps || []).forEach(function (p) { o[p.ID] = CAMPOS_PARTIDO.map(function (k) { return String(p[k] == null ? '' : p[k]); }).join('|'); }); return o; }
  /**
   * Los partidos que han cambiado desde una instantánea, con qué les ha pasado: [{ p, tipo, clave, nueva }]. tipo: 'Aplazado',
   * 'Suspendido' o 'Anulado'; 'resultado' (con resultado nuevo); 'horario' (otro día, hora o campo); 'estado' (otro estado);
   * 'recuperacion' (T0419: uno que ya estaba aplazado o suspendido tiene nueva fecha). nueva: su recuperación (el partido
   * nuevo con ID_PARTIDO_ORIGEN = el aplazado), si la tiene. Los demás nuevos no cuentan (son nuevos, no cambios).
   */
  function cambiosPartidos(antes, ps) {
    var out = [], ix = {}, rec = {};
    antes = antes || {};
    (ps || []).forEach(function (p) { ix[p.ID] = p; if (p.ID_PARTIDO_ORIGEN && p.ESTADO !== 'Anulado') rec[p.ID_PARTIDO_ORIGEN] = p; });
    (ps || []).forEach(function (p) {
      var a = antes[p.ID], ahora = instantanea([p])[p.ID];
      if (a === undefined) {
        // Una recuperación nueva de un partido que ya se veía y que no cambia ahora (si cambia, va con él).
        var o = ix[p.ID_PARTIDO_ORIGEN];
        if (o && antes[o.ID] !== undefined && antes[o.ID] === instantanea([o])[o.ID] && p.ESTADO !== 'Anulado') out.push({ p: o, tipo: 'recuperacion', nueva: p, clave: 'r-' + p.ID + '-' + ahora });
        return;
      }
      if (a === ahora) return;
      var v = a.split('|'), tipo;
      if (p.ESTADO !== v[0] && ['Aplazado', 'Suspendido', 'Anulado'].indexOf(p.ESTADO) >= 0) tipo = p.ESTADO;
      else if (conResultado(p) && (String(p.GOLES_LOCAL) !== v[4] || String(p.GOLES_VISITANTE) !== v[5])) tipo = 'resultado';
      else if (String(p.FECHA) !== v[1] || String(p.HORA) !== v[2] || String(p.ID_CAMPO) !== v[3]) tipo = 'horario';
      else tipo = 'estado';
      var nueva = (tipo === 'Aplazado' || tipo === 'Suspendido') && rec[p.ID] ? rec[p.ID] : null;
      out.push({ p: p, tipo: tipo, nueva: nueva, clave: 'p-' + p.ID + '-' + ahora + (nueva ? '-' + nueva.ID : '') });
    });
    return out;
  }

  /**
   * T0419 · A quién le llega lo que avisa una capitana: lo de un resultado («El resultado está mal», «Un gol lo marcó otra
   * jugadora») de un partido jugado, al árbitro que lo pitó (ID_ARBITRO_REAL o, si no, ID_ARBITRO), que corrige su acta; lo
   * demás (un partido que viene: no podemos venir, otra hora; otra cosa), y lo de un partido sin árbitro, al gestor de la liga.
   * { para: 'arbitro', arbitro } o { para: 'gestor' }.
   */
  var DEL_ACTA = ['El resultado está mal', 'Un gol lo marcó otra jugadora'];
  function destinoIncidencia(tipo, p) {
    var arb = p ? String(p.ID_ARBITRO_REAL || p.ID_ARBITRO || '') : '';
    return DEL_ACTA.indexOf(tipo) >= 0 && p && p.ESTADO === 'Jugado' && arb ? { para: 'arbitro', arbitro: arb } : { para: 'gestor' };
  }

  /**
   * T0419 · Dónde se puede jugar un partido: los huecos libres de su liga (HUECOS), [{ fecha, hueco }] por fecha y hora.
   * o.mismoDia: solo su día, a otra hora o en otro campo (para ligasMover). Si no, los días siguientes al partido (y a hoy)
   * hasta o.hasta (o seis semanas), con el día de la semana de cada hueco, sin festivos ni descansos (o.calendario) y sin que
   * ninguno de los dos equipos juegue ese día (para recuperarlo con ligasRecuperar). Un hueco está ocupado si ese día hay
   * otro partido a esa hora en ese campo que no esté aplazado, suspendido ni anulado. Como mucho o.max (6).
   */
  function huecosLibres(p, o) {
    o = o || {};
    var hs = (o.huecos || []).filter(function (h) { return String(h.ID_LIGA) === String(p.ID_LIGA); });
    var ocupado = {}, juega = {}, cerrado = {};
    (o.partidos || []).forEach(function (x) {
      if (String(x.ID) === String(p.ID) || ['Aplazado', 'Suspendido', 'Anulado'].indexOf(x.ESTADO) >= 0) return;
      ocupado[x.FECHA + '|' + x.HORA + '|' + x.ID_CAMPO] = 1;
      [x.ID_INSCRIPCION_LOCAL, x.ID_INSCRIPCION_VISITANTE].forEach(function (ie) { if (ie) juega[x.FECHA + '|' + ie] = 1; });
    });
    (o.calendario || []).forEach(function (c) { if (c.FESTIVO === true || c.DESCANSO === true) cerrado[String(c.FECHA)] = 1; });
    var libre = function (f, h) { return !ocupado[f + '|' + h.HORA + '|' + h.ID_CAMPO]; };
    var out = [];
    if (o.mismoDia) {
      hs.forEach(function (h) { if (!(String(h.HORA) === String(p.HORA) && String(h.ID_CAMPO) === String(p.ID_CAMPO)) && libre(p.FECHA, h)) out.push({ fecha: p.FECHA, hueco: h }); });
    } else {
      var desde = sumarDias(String(p.FECHA) > String(o.hoy || '') ? p.FECHA : o.hoy, 1), hasta = o.hasta || sumarDias(desde, 42);
      for (var f = desde; f && f <= hasta && out.length < (o.max || 6); f = sumarDias(f, 1)) {
        if (cerrado[f] || juega[f + '|' + p.ID_INSCRIPCION_LOCAL] || juega[f + '|' + p.ID_INSCRIPCION_VISITANTE]) continue;
        var dia = DIAS[deIso(f).getDay()];
        hs.filter(function (h) { return (!h.DIA_SEMANA || h.DIA_SEMANA === dia) && libre(f, h); })
          .sort(function (a, b) { return orden(String(a.HORA), String(b.HORA)); }).slice(0, 1) // un hueco por día: el más temprano
          .forEach(function (h) { out.push({ fecha: f, hueco: h }); });
      }
    }
    return out.sort(function (a, b) { return orden(a.fecha + ' ' + a.hueco.HORA, b.fecha + ' ' + b.hueco.HORA); }).slice(0, o.max || 6);
  }

  var CALC = { hoy: hoy, sumarDias: sumarDias, temporadaActual: temporadaActual, clasificacion: clasificacion, resultadoDe: resultadoDe,
    golesJugadora: golesJugadora, planRedes: planRedes, instantanea: instantanea, cambiosPartidos: cambiosPartidos, destinoIncidencia: destinoIncidencia, huecosLibres: huecosLibres, corto: corto, pascua: pascua, lunes: lunes, tematicas: tematicas, tareasTematica: tareasTematica, tapar: tapar, conResultado: conResultado };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  var TABLAS = ['TEMPORADAS', 'COMPETICIONES', 'LIGAS', 'PARTIDOS', 'GOLES', 'CAMPOS', 'INSTALACIONES', 'CALENDARIO', 'STAFF',
    'EQUIPOS', 'JUGADORAS', 'INSCRIPCIONES_EQUIPOS', 'INSCRIPCIONES_JUGADORAS', 'FOTOS', 'HUECOS']; // HUECOS: dónde aplazar o mover un partido (T0419)
  // konamigas.com (la web de todas: inscripciones, competiciones y el área de jugadora y de capitana) es otra página,
  // web/maquetas/konamigas/index.html, que pinta esta misma sección con ctx.web (abajo, «konamigas.com»).
  var PORTALES = [
    { id: 'web', titulo: 'konamigas.com', quien: 'Cualquiera, sin entrar; cada jugadora y capitana, con su correo',
      que: 'La web de todas: las inscripciones y la bolsa de jugadoras, las competiciones en curso y, al entrar, lo de cada jugadora y lo de cada capitana.' },
    { id: 'arbitro', titulo: 'Árbitro: el acta en directo', corto: 'Acta en directo', quien: 'Cada árbitro, en su móvil, durante el partido',
      que: 'Empieza el partido, marca cada gol tocando a quien marca (se ve en directo en konamigas.com) y, al acabar, cierra el acta. Si no se jugó, dice qué pasó.' },
    { id: 'incidencias', titulo: 'Incidencias', quien: 'El gestor de cada liga y los socios',
      que: 'Lo que reclaman las capitanas desde konamigas.com, con su partido: verla, responder, resolverla y, si hace falta, cambiar el partido en Ligas.' },
    { id: 'redes', titulo: 'Redes sociales', quien: 'Los socios',
      que: 'El calendario de publicaciones de la temporada, las fotos que nunca se comparten y publicar en Instagram y TikTok.' }
  ];
  // T0419: lo del acta (el resultado, quién marcó) le llega al árbitro del partido; lo demás, al gestor (destinoIncidencia).
  var TIPOS_INCIDENCIA = ['No podremos venir', 'Queremos otra hora', 'El resultado está mal', 'Un gol lo marcó otra jugadora', 'Otra cosa'];
  // T0366: aquí y no dentro de abrir, que pinta antes de llegar a su línea (Futuro se quedaba en blanco con incidencias).
  var ORDEN_INC = { 'Enviada': 0, 'Vista por el gestor': 1, 'Vista por el árbitro': 1, 'Resuelta': 2 };
  var CHIP_INC = { 'Enviada': 'lg-av-rec', 'Vista por el gestor': 'lg-av-si', 'Vista por el árbitro': 'lg-av-si', 'Resuelta': 'mq-ok' };

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function euros(n) { return Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'; }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
  function normal(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  /** Lo que se hace en la maqueta, mientras la página está abierta (no va a ninguna tabla). */
  var M = { portal: '', pestana: {}, liga: '', actas: {},
    web: { vista: 'inicio', yo: '', paso: '', como: '', personas: null, ins: null },
    publicadas: [], foto: [], plantilla: 'Resultados', formato: 'cuadrado', ligaPost: '', auto: { Resultados: true, Previa: true, Fotos: false, Jugadora: true, Revisar: true },
    filtroFotos: 'publicables', mesRedes: '', tema: '' };

  window.UN.registrar('MAQUETA', {
    abrir: function (el, ctx) {
      var T = ctx.tablas, D = null, firma = '', W = ctx.web || null;
      /** Una función pública de la maqueta, sin entrar (las dos páginas la llaman igual). */
      function llamarPublica(fn, args) {
        return fetch((window.KANBAN || {}).api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args || [] }) })
          .then(function (r) { return r.json(); }).then(function (r) { if (!r.ok) throw new Error(String(r.error || '').replace(/^\w+:\s*/, '')); return r.r; });
      }
      function cargarComun() {
        return llamarPublica('maquetaComun').then(function (c) {
          var n = comun();
          if (c && c.v === 1) Object.keys(n).forEach(function (k) { delete n[k]; }), Object.assign(n, c);
          n.incidencias = n.incidencias || {};
          window.MQ_COMUN_LEIDO = true;
        }, function () { window.MQ_COMUN_LEIDO = true; });
      }
      /** En el simulador, lo que tiene que saber la otra pantalla (una incidencia nueva, una respuesta…). */
      function avisarSim(o) { try { if (window.parent !== window) window.parent.postMessage(Object.assign({ mq: 'aviso' }, o), '*'); } catch (e) {} }
      // El simulador avisa cuando la otra pantalla cambia algo: se vuelve a leer lo compartido y se repinta.
      if (window.MQ_OYENTE) window.removeEventListener('mq-refrescar', window.MQ_OYENTE);
      window.MQ_OYENTE = function () {
        if (!ctx.abierta()) return;
        var antes = W && D ? instantanea(D.PARTIDOS) : null; // lo que veían las jugadoras, para saber qué partidos han cambiado
        cargarComun().then(function () { firma = ''; D = datos(); if (antes) novedadesDePartidos(antes, D.PARTIDOS); pintar(); });
      };
      window.addEventListener('mq-refrescar', window.MQ_OYENTE);
      if (!window.MQ_COMUN_LEIDO) cargarComun().then(function () { if (ctx.abierta()) pintar(); });
      // Los goles de ejemplo (si GOLES está vacía): konamigas.com los pide al abrir; la plataforma, por si se abre sola.
      if (!W && !window.MQ_PREP) { window.MQ_PREP = 1; llamarPublica('maquetaPreparar').catch(function () {}); }
      /** En el simulador, un paso del guion hecho («Qué probar»). */
      function paso(id) { try { if (window.parent !== window) window.parent.postMessage({ mq: 'paso', id: id }, '*'); } catch (e) {} }
      var params = new URLSearchParams(location.search);
      if (params.get('portal') && !M.portal) M.portal = params.get('portal');
      if (W && W.yo) M.web.yo = W.yo;
      // Vuelve de la inscripción (a la pantalla que se toca en su menú) o se abre en una (#liga, #entrar).
      var ancla = /^#(inicio|liga|entrar|mia)$/.exec(location.hash || '');
      if (W && W.volver) { M.web.vista = W.volver === true ? 'inicio' : W.volver; W.volver = false; M.web.personas = null; M.web.pPidiendo = 0; M.web.ins = null; M.web.insPidiendo = 0; }
      else if (W && ancla) M.web.vista = ancla[1];
      if (!W && window.MQ_IR) { M.portal = window.MQ_IR; window.MQ_IR = ''; } // el simulador pide abrir un portal (Incidencias)
      else if (!W && !M.portal && !ctx.admin && /Árbitro/.test(String(ctx.perfil || '')) && !/Gestor|Socio/.test(String(ctx.perfil || ''))) M.portal = 'arbitro'; // un árbitro viene a lo suyo

      ctx.alCambiar(function (t) { if (TABLAS.indexOf(t) >= 0) pintar(); });
      if (TABLAS.every(function (t) { return T.tiene(t); })) pintar();
      else el.innerHTML = '<div class="kz-centro" role="status"><div class="u-carga"></div><p class="u-nota">Leyendo las ligas, los equipos y las jugadoras…</p></div>';
      T.leer(TABLAS).then(pintar, function (e) { el.innerHTML = '<p class="u-error">No se han podido leer los datos: ' + texto(e && e.message || e) + '</p>'; });

      /* ---------- los datos, con sus índices (se rehacen solo si cambian las tablas) ---------- */

      function datos() {
        var f = TABLAS.map(function (t) { return T.filas(t).length; }).join(',') + (T.version ? '|' + T.version() : '');
        if (D && f === firma) return D;
        firma = f;
        var d = {};
        TABLAS.forEach(function (t) { d[t] = T.filas(t) || []; });
        d.h = hoy();
        d.temp = temporadaActual(d.TEMPORADAS, d.h) || {};
        d.ixTemp = indice(d.TEMPORADAS); d.ixComp = indice(d.COMPETICIONES); d.ixLiga = indice(d.LIGAS); d.ixCampo = indice(d.CAMPOS);
        d.ixStaff = indice(d.STAFF); d.ixJug = indice(d.JUGADORAS); d.ixIE = indice(d.INSCRIPCIONES_EQUIPOS); d.ixPar = indice(d.PARTIDOS);
        d.ijPorJug = grupos(d.INSCRIPCIONES_JUGADORAS, 'ID_JUGADORA'); d.ijPorIE = grupos(d.INSCRIPCIONES_JUGADORAS, 'ID_INSCRIPCION_EQUIPO');
        d.parPorLiga = grupos(d.PARTIDOS, 'ID_LIGA'); d.fotosPorJug = grupos(d.FOTOS, 'ID_JUGADORA');
        d.camPorIJ = grupos(W ? T.filas('CAMISETAS') : [], 'ID_INSCRIPCION_JUGADORA'); // las suyas, al entrar en konamigas.com
        d.parPorIE = {};
        d.PARTIDOS.forEach(function (p) { [p.ID_INSCRIPCION_LOCAL, p.ID_INSCRIPCION_VISITANTE].forEach(function (ie) { if (ie) (d.parPorIE[ie] = d.parPorIE[ie] || []).push(p); }); });
        Object.keys(d.parPorIE).forEach(function (k) { d.parPorIE[k].sort(function (a, b) { return orden(cuando(a), cuando(b)); }); });
        d.tempDeLiga = function (idLiga) { var l = d.ixLiga[idLiga], c = l && d.ixComp[l.ID_COMPETICION]; return c ? String(c.ID_TEMPORADA) : ''; };
        d.tempDeIE = function (ie) { var i = d.ixIE[ie], c = i && d.ixComp[i.ID_COMPETICION]; return c ? String(c.ID_TEMPORADA) : ''; };
        // Las inscripciones de equipo de la temporada que juegan en una liga.
        d.ieTemp = d.INSCRIPCIONES_EQUIPOS.filter(function (i) { return i.ID_LIGA && d.tempDeIE(i.ID) === String(d.temp.ID) && i.ESTADO !== 'Baja'; });
        D = d;
        return d;
      }

      /* ---------- nombres ---------- */

      function nombreJug(j) { return j ? [j.NOMBRE, j.APELLIDO_1].filter(Boolean).join(' ') : 'Jugadora'; }
      function nombrePublico(j) { return j ? String(j.NOMBRE || '') + (j.APELLIDO_1 ? ' ' + String(j.APELLIDO_1).charAt(0) + '.' : '') : ''; }
      function equipo(ie) { var i = D.ixIE[ie]; return i ? i.NOMBRE_EQUIPO || 'Equipo' : ''; }
      function liga(id) {
        var l = D.ixLiga[id], c = l && D.ixComp[l.ID_COMPETICION];
        return l ? [c && (c.NOMBRE_COMERCIAL || c.NOMBRE), l.NOMBRE].filter(Boolean).join(' · ') : '';
      }
      function campo(id) { var c = D.ixCampo[id]; return c ? c.NOMBRE || c.ABREVIACION : ''; } // T0367: el nombre, no la sigla
      function staff(id) { var s = D.ixStaff[id]; return s ? s.APODO || [s.NOMBRE, s.APELLIDOS].filter(Boolean).join(' ') : ''; }
      function temporada(id) { var t = D.ixTemp[id]; return t ? t.NOMBRE : id; }

      /* ---------- piezas comunes ---------- */

      // En el simulador basta su franja de arriba: dentro de las pantallas no se repite.
      function franja(quien) {
        if (window.parent !== window) return '';
        return '<div class="mq-franja" role="note"><span class="mq-sello">Maqueta</span><p>' + texto(quien) +
          '. Aún no existe: datos de verdad, pero nada de lo que hagas aquí se guarda.</p></div>';
      }
      function pestanas(portal, lista) {
        var sel = M.pestana[portal] || lista[0][0];
        return '<div class="u-pestanas mq-pest" role="tablist">' + lista.map(function (x) {
          return '<button type="button" role="tab" data-mqp="' + x[0] + '" aria-selected="' + (x[0] === sel) + '">' + texto(x[1]) + '</button>';
        }).join('') + '</div>';
      }
      function elegida(portal, lista) { var p = M.pestana[portal]; return lista.some(function (x) { return x[0] === p; }) ? p : lista[0][0]; }
      function cifras(l) { return '<div class="lg-stats">' + l.map(function (x) { return '<div><b class="u-cifra">' + texto(x[0]) + '</b><span>' + texto(x[1]) + '</span></div>'; }).join('') + '</div>'; }

      /** Un partido en una lista, con el marcado de Ligas (el equipo propio, con la franja a la izquierda). */
      function htmlPartido(p, mio, conLiga) {
        var res = conResultado(p), gl = num(p.GOLES_LOCAL), gv = num(p.GOLES_VISITANTE), fuera = ['Aplazado', 'Suspendido', 'Anulado'].indexOf(p.ESTADO) >= 0;
        var eq = function (id, lado, gana) {
          return '<span class="lg-p' + lado + (gana ? ' lg-gana' : '') + '"><span class="lg-nom">' + texto(equipo(id) || 'Por decidir') + '</span></span>';
        };
        var deb = [conLiga ? '<span class="lg-pliga">' + texto(fechaDia(p.FECHA) + ' · ' + liga(p.ID_LIGA) + (p.JORNADA ? ' · J' + p.JORNADA : '')) + '</span>' : '',
          fuera ? '<span class="lg-pav ' + (p.ESTADO === 'Anulado' ? 'lg-av-no' : 'lg-av-si') + '">' + texto(p.ESTADO + (p.MOTIVO ? ' · ' + p.MOTIVO : '')) + '</span>' : ''].join('');
        return '<div class="lg-p' + (mio ? ' lg-mio' : '') + (fuera ? ' lg-p-fuera' : '') + '"><span class="lg-pi"><b class="u-cifra">' + texto(p.HORA || '--:--') + '</b><small>' + texto(campo(p.ID_CAMPO)) + '</small></span>' +
          eq(p.ID_INSCRIPCION_LOCAL, 'l', res && gl > gv) + '<span class="lg-pc' + (res ? '' : ' lg-pvs') + '">' + (res ? '<b class="u-cifra">' + gl + '<span>–</span>' + gv + '</b>' : 'vs') + '</span>' +
          eq(p.ID_INSCRIPCION_VISITANTE, 'v', res && gv > gl) + (deb ? '<span class="lg-pa">' + deb + '</span>' : '') + '</div>';
      }
      function listaPartidos(ps, esMio, vacio, clic) {
        if (!ps.length) return '<p class="u-vacio">' + texto(vacio) + '</p>';
        return '<div class="lg-lista">' + ps.map(function (p) {
          var h = htmlPartido(p, esMio(p), true);
          // En Mi área, cada partido se toca: su ficha con lo que se puede hacer (reclamar, avisar…).
          return clic ? h.replace('<div class="lg-p', '<div role="button" tabindex="0" data-mqpart="' + texto(p.ID) + '" class="mq-clic lg-p') : h;
        }).join('') + '</div>';
      }
      function tablaClasificacion(idLiga, marcar) {
        var eqs = D.ieTemp.filter(function (i) { return String(i.ID_LIGA) === String(idLiga); }).map(function (i) { return i.ID; });
        var cl = clasificacion(D.parPorLiga[idLiga] || [], eqs);
        if (!cl.length) return '<p class="u-vacio">Esta liga todavía no tiene equipos ni partidos.</p>';
        return '<div class="u-tabla-caja"><table class="u-tabla lg-clas"><thead><tr><th class="num">#</th><th>Equipo</th><th class="num">PJ</th><th class="num">G</th>' +
          '<th class="num">E</th><th class="num">P</th><th class="num u-solo-ancho">GF</th><th class="num u-solo-ancho">GC</th><th class="num">DG</th><th class="num">Pts</th></tr></thead><tbody>' +
          cl.map(function (e) {
            return '<tr' + (String(e.id) === String(marcar) ? ' class="mq-fila-mia"' : '') + '><td class="num">' + e.pos + '</td><td class="u-tabla-t">' + texto(equipo(e.id)) + '</td><td class="num">' + e.pj +
              '</td><td class="num">' + e.pg + '</td><td class="num">' + e.pe + '</td><td class="num">' + e.pp + '</td><td class="num u-solo-ancho">' + e.gf +
              '</td><td class="num u-solo-ancho">' + e.gc + '</td><td class="num">' + (e.dg > 0 ? '+' : '') + e.dg + '</td><td class="num"><b>' + e.pts + '</b></td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      function posicion(idLiga, ie) {
        var eqs = D.INSCRIPCIONES_EQUIPOS.filter(function (i) { return String(i.ID_LIGA) === String(idLiga) && i.ESTADO !== 'Baja'; }).map(function (i) { return i.ID; });
        var e = clasificacion(D.parPorLiga[idLiga] || [], eqs).filter(function (x) { return String(x.id) === String(ie); })[0];
        return e && e.pj ? e.pos + 'º de ' + eqs.length : '';
      }

      /** Ventana para elegir a quién se ve: un buscador sobre una lista [{ id, titulo, sub }]. */
      function ventanaElegir(titulo, lista, alElegir) {
        var v = document.createElement('div');
        v.className = 'u-velo abierto';
        v.innerHTML = '<div class="u-ventana n-ventana" role="dialog" aria-label="' + texto(titulo) + '"><h2>' + texto(titulo) + '</h2>' +
          '<label class="u-campo"><span class="u-etiqueta">Buscar</span><input type="search" autocomplete="off" placeholder="Nombre o equipo"></label>' +
          '<ul class="n-como-lista"></ul><div class="n-botones"><button type="button" class="u-btn" data-cerrar>Cerrar</button></div></div>';
        var ul = v.querySelector('ul'), inp = v.querySelector('input');
        var poner = function () {
          var q = normal(inp.value), l = lista.filter(function (x) { return !q || normal(x.titulo + ' ' + x.sub).indexOf(q) >= 0; }).slice(0, 40);
          ul.innerHTML = l.map(function (x) { return '<li><button type="button" data-id="' + texto(x.id) + '"><b>' + texto(x.titulo) + '</b><span>' + texto(x.sub) + '</span></button></li>'; }).join('') ||
            '<li class="u-nota">Nadie con ese nombre.</li>';
        };
        inp.oninput = poner;
        v.onclick = function (e) {
          var b = e.target.closest('button');
          if (e.target === v || (b && b.hasAttribute('data-cerrar'))) return v.remove();
          if (b && b.getAttribute('data-id')) { v.remove(); alElegir(b.getAttribute('data-id')); }
        };
        poner();
        document.body.appendChild(v);
        setTimeout(function () { inp.focus(); }, 30);
      }
      function ventana(html, alPulsar) {
        var v = document.createElement('div');
        v.className = 'u-velo abierto';
        v.innerHTML = '<div class="u-ventana n-ventana" role="dialog">' + html + '</div>';
        v.onclick = function (e) {
          var b = e.target.closest('button');
          if (e.target === v || (b && b.hasAttribute('data-cerrar'))) return v.remove();
          if (b && alPulsar) alPulsar(b, v);
        };
        document.body.appendChild(v);
        return v;
      }

      /* ---------- pintar ---------- */

      function pintar() {
        if (!ctx.abierta()) return;
        D = datos();
        if (W) { el.innerHTML = pintarWeb(); cargarFotos(); montarLigas(); return; }
        var p = PORTALES.filter(function (x) { return x.id === M.portal && x.id !== 'web'; })[0];
        ctx.ponerTitulo(p ? p.corto || p.titulo : 'Futuro'); // corto: en el móvil, la cabecera de la app es pequeña
        var soloArbitro = !ctx.admin && /Árbitro/.test(String(ctx.perfil || '')) && !/Gestor|Socio/.test(String(ctx.perfil || ''));
        var h = '<div class="mq">' + (p && !(soloArbitro && p.id === 'arbitro') ? '<p class="mq-volver"><button type="button" class="u-btn u-btn-texto" data-mqir="">‹ Todo lo que viene</button></p>' : '');
        if (!p) h += portada();
        else if (p.id === 'incidencias') h += portalIncidencias();
        else if (p.id === 'arbitro') h += portalArbitro();
        else h += redes();
        el.innerHTML = h + '</div>';
        cargarFotos();
      }

      function portada() {
        var n = D.ieTemp.length, jug = 0;
        D.ieTemp.forEach(function (i) { jug += (D.ijPorIE[i.ID] || []).filter(function (x) { return x.ESTADO !== 'Baja'; }).length; });
        return htmlDirecto(null) + franja('Lo que viene en la plataforma de Konamigas') +
          '<p class="mq-intro">La temporada <b>' + texto(D.temp.NOMBRE || '') + '</b> en la web: ' + plural(n, 'equipo', 'equipos') + ' en sus ligas y ' + plural(jug, 'jugadora inscrita', 'jugadoras inscritas') +
          '. Lo de arriba del menú ya existe; esto es lo siguiente, cada cosa con los datos de verdad.</p>' +
          '<div class="mq-tarjetas">' + PORTALES.map(function (x) {
            var dentro = '<span class="mq-t-tit">' + texto(x.titulo) + '</span><span class="mq-t-quien">' + texto(x.quien) + '</span>' +
              '<span class="mq-t-que">' + texto(x.que) + '</span><span class="mq-t-ir">Abrir ›</span>';
            // konamigas.com es otra página (la misma para todas): se abre en su sitio.
            if (x.id === 'web') return '<a class="mq-tarjeta" href="' + texto((window.KANBAN || {}).web || '../') + '" data-mqira="web" data-q="">' + dentro + '</a>';
            // T0419: a cada portal, las suyas: al gestor, las de partidos que vienen; al árbitro, las reclamaciones de su acta.
            var nuevas = x.id === 'incidencias' ? todasIncidencias().filter(function (y) { return y.x.estado === 'Enviada' && y.x.para !== 'arbitro'; }).length
              : x.id === 'arbitro' ? reclamacionesArbitro(ctx.admin ? '' : yoStaff()).filter(function (y) { return y.x.estado !== 'Resuelta'; }).length : 0;
            return '<button type="button" class="mq-tarjeta" data-mqir="' + x.id + '">' + (nuevas ? '<span class="u-chip mq-nuevas">' + plural(nuevas, 'nueva', 'nuevas') + '</span>' : '') + dentro + '</button>';
          }).join('') + '</div>';
      }

      /* ======================= Novedades de la jugadora (konamigas.com) ======================= */
      // Lo que le pasa a su equipo: la respuesta del gestor a una incidencia (la apunta la plataforma) y un partido que
      // Konamigas cambia (aplazado, otra hora o campo, el resultado: lo ve konamigas.com al refrescarse). En lo compartido.

      // prio (T0419): la que explica más (la corrección del árbitro) gana a la automática del mismo cambio (mismo id).
      function novedad(ies, titulo, textoN, id, prio) {
        var c = comun(), l = c.novedades || (c.novedades = []), ya = id ? l.filter(function (x) { return x.id === id; })[0] : null;
        if (ya && (ya.prio || 0) >= (prio || 0)) return;
        if (ya) l.splice(l.indexOf(ya), 1);
        l.unshift({ id: id || 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ies: ies.map(String), titulo: titulo, texto: textoN, cuando: new Date().toISOString(), prio: prio || 0 });
        if (l.length > 80) l.length = 80;
      }
      function cuandoDonde(p) { return fechaDia(p.FECHA) + (p.HORA ? ' a las ' + p.HORA : '') + (p.ID_CAMPO ? ' · ' + campo(p.ID_CAMPO) : ''); }
      function novedadesDePartidos(antes, ps) {
        var l = cambiosPartidos(antes, ps);
        l.forEach(function (x) {
          var p = x.p, L = p.ID_INSCRIPCION_LOCAL, V = p.ID_INSCRIPCION_VISITANTE, vs = equipo(L) + ' – ' + equipo(V);
          // T0419: aplazado, suspendido o anulado, con el motivo y, si ya la tiene, la nueva fecha (su recuperación).
          if (x.tipo === 'recuperacion') return novedad([L, V].filter(Boolean), 'Nueva fecha para el partido ' + String(p.ESTADO).toLowerCase(), vs + ' · ' + cuandoDonde(x.nueva), x.clave);
          var t = x.tipo === 'resultado' ? 'Resultado: ' + equipo(L) + ' ' + p.GOLES_LOCAL + '–' + p.GOLES_VISITANTE + ' ' + equipo(V)
            : x.tipo === 'horario' ? 'Cambio de día, hora o campo' : 'Partido ' + String(p.ESTADO).toLowerCase() + (x.tipo !== 'estado' && p.MOTIVO ? ': ' + p.MOTIVO : '');
          var txt = x.nueva ? vs + ' · era el ' + fechaDia(p.FECHA).toLowerCase() + '. Nueva fecha: ' + cuandoDonde(x.nueva)
            : vs + ' · ' + cuandoDonde(p) + (['Aplazado', 'Suspendido'].indexOf(x.tipo) >= 0 ? '. La nueva fecha, cuando la diga Konamigas.' : '');
          novedad([L, V].filter(Boolean), t, txt, x.clave);
        });
        if (l.length) guardarComun();
      }
      /** Las de una jugadora (de sus equipos), la más nueva primero, y cuántas no ha visto. */
      function novedadesDe(idJ) {
        var Y = deJugadora(idJ), mias = {}, c = comun(), vistas = (c.vistas || {})[idJ] || [];
        Y.ies.forEach(function (ie) { mias[ie] = 1; });
        var l = (c.novedades || []).filter(function (n) { return n.ies.some(function (ie) { return mias[ie]; }); });
        return { l: l, nuevas: l.filter(function (n) { return vistas.indexOf(n.id) < 0; }).length, vistas: vistas };
      }
      function hace(iso) {
        var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
        return m < 1 ? 'Ahora mismo' : m < 60 ? 'Hace ' + plural(m, 'minuto', 'minutos') : m < 1440 ? 'Hace ' + plural(Math.round(m / 60), 'hora', 'horas') : fechaDia(String(iso).slice(0, 10));
      }
      function htmlNovedades(idJ) {
        var N = novedadesDe(idJ);
        var h = N.l.length ? '<ul class="mqw-novs">' + N.l.map(function (n) {
          return '<li' + (N.vistas.indexOf(n.id) < 0 ? ' class="mqw-nov-nueva"' : '') + '><b>' + texto(n.titulo) + '</b><p>' + texto(n.texto) + '</p><small>' + texto(hace(n.cuando)) + '</small></li>';
        }).join('') + '</ul>' : '<p class="u-vacio">Nada nuevo. Aquí te llegará si Konamigas cambia un partido de tu equipo o responde a lo que avises.</p>';
        // Al verlas, quedan vistas.
        var c = comun(), v = (c.vistas = c.vistas || {});
        if (N.nuevas) { v[idJ] = N.l.map(function (n) { return n.id; }); guardarComun(); }
        return h;
      }

      /* ======================= Jugadora y capitana (en konamigas.com, al entrar) ======================= */

      /** Para «Jugadora de la semana» (Redes sociales): la de esta temporada con más temporadas jugadas. */
      function jugadoraDeLaSemana() {
        var mejor = '', n = -1;
        D.ieTemp.forEach(function (i) {
          (D.ijPorIE[i.ID] || []).forEach(function (x) { var k = (D.ijPorJug[x.ID_JUGADORA] || []).length; if (k > n && D.ixJug[x.ID_JUGADORA]) { n = k; mejor = x.ID_JUGADORA; } });
        });
        return mejor;
      }
      /** Su inscripción de capitana de esta temporada (una fila de INSCRIPCIONES_EQUIPOS) o null. */
      function capitanaDe(idJ) {
        return D.ieTemp.filter(function (i) { return String(i.ID_CAPITANA || '') === String(idJ); })[0] || null;
      }
      /** Lo de una jugadora: sus inscripciones (la más nueva, primero), sus equipos, los de esta temporada y sus partidos. */
      function deJugadora(idJ) {
        var ijs = (D.ijPorJug[idJ] || []).slice().sort(function (a, b) {
          return orden(D.tempDeIE(b.ID_INSCRIPCION_EQUIPO), D.tempDeIE(a.ID_INSCRIPCION_EQUIPO)) || orden(String(b.FECHA_INSCRIPCION || ''), String(a.FECHA_INSCRIPCION || ''));
        });
        var ies = ijs.map(function (x) { return String(x.ID_INSCRIPCION_EQUIPO); });
        // Los equipos que capitanea, también sin su inscripción de jugadora (recién inscrito: Solicitada, aún sin liga).
        D.INSCRIPCIONES_EQUIPOS.forEach(function (i) { if (String(i.ID_CAPITANA || '') === String(idJ) && ies.indexOf(String(i.ID)) < 0 && i.ESTADO !== 'Baja') ies.push(String(i.ID)); });
        var solicitadas = ies.map(function (ie) { return D.ixIE[ie]; }).filter(function (i) { return i && !i.ID_LIGA && D.tempDeIE(i.ID) === String(D.temp.ID); });
        var actuales = ies.filter(function (ie) { return D.tempDeIE(ie) === String(D.temp.ID) && D.ixIE[ie] && D.ixIE[ie].ID_LIGA; });
        var ps = [], visto = {};
        ies.forEach(function (ie) { (D.parPorIE[ie] || []).forEach(function (p) { if (!visto[p.ID]) { visto[p.ID] = 1; ps.push(p); } }); });
        ps.sort(function (a, b) { return orden(cuando(a), cuando(b)); });
        return { j: D.ixJug[idJ], ijs: ijs, ies: ies, actuales: actuales, ps: ps, cap: capitanaDe(idJ), solicitadas: solicitadas };
      }

      /** La ficha de un partido suyo (Mi área): cómo fue o cuándo es, quién marcó y lo que puede hacer. */
      function fichaMia(idP) {
        var p = D.ixPar[idP], yo = M.web.yo, Y = deJugadora(yo);
        if (!p) return;
        var mio = Y.ies.filter(function (ie) { return juega(p, ie); })[0], cap = Y.cap && juega(p, Y.cap.ID) ? Y.cap : null, futuro = p.ESTADO === 'Programado' && p.FECHA >= D.h;
        var gs = (D.GOLES || []).filter(function (g) { return String(g.ID_PARTIDO) === String(p.ID) && g.ID_INSCRIPCION_JUGADORA; });
        var ij = {}; (D.INSCRIPCIONES_JUGADORAS || []).forEach(function (x) { ij[x.ID] = x; });
        var quien = function (ie) {
          var c = {};
          gs.filter(function (g) { return String(g.ID_INSCRIPCION_EQUIPO) === String(ie); }).forEach(function (g) { var x = ij[g.ID_INSCRIPCION_JUGADORA], n = x ? nombrePublico(D.ixJug[x.ID_JUGADORA]) : '?'; c[n] = (c[n] || 0) + 1; });
          return Object.keys(c).map(function (n) { return n + (c[n] > 1 ? ' (' + c[n] + ')' : ''); }).join(', ');
        };
        var L = p.ID_INSCRIPCION_LOCAL, V = p.ID_INSCRIPCION_VISITANTE, res = conResultado(p);
        ventana('<h2>' + texto(equipo(L) + ' – ' + equipo(V)) + '</h2><p class="u-nota">' + texto(liga(p.ID_LIGA) + (p.JORNADA ? ' · Jornada ' + p.JORNADA : '')) + '</p>' +
          '<div class="mq-ficha-m"><b class="u-cifra">' + (res ? texto(p.GOLES_LOCAL + '–' + p.GOLES_VISITANTE) : texto(p.HORA || '--:--')) + '</b><span class="lg-pav">' + texto(p.ESTADO + (p.MOTIVO ? ' · ' + p.MOTIVO : '')) + '</span></div>' +
          '<dl class="mq-ficha-d"><dt>Cuándo</dt><dd>' + texto(fechaDia(p.FECHA) + (p.HORA ? ' a las ' + p.HORA : '')) + '</dd><dt>Campo</dt><dd>' + texto(campo(p.ID_CAMPO) || '—') + '</dd>' +
          (res && gs.length ? '<dt>Marcan</dt><dd>' + texto([quien(L) && equipo(L) + ': ' + quien(L), quien(V) && equipo(V) + ': ' + quien(V)].filter(Boolean).join(' · ')) + '</dd>' : '') + '</dl>' +
          '<div class="n-botones">' + (cap ? '<button type="button" class="u-btn u-btn-accion" data-fic="reclamar">' + (futuro ? 'Avisar al gestor' : 'Reclamar algo de este partido') + '</button>' : '') +
          (!cap && futuro && mio ? '<button type="button" class="u-btn u-btn-accion" data-fic="noir">No podré ir</button>' : '') +
          '<button type="button" class="u-btn" data-fic="liga">Ver la liga ›</button><button type="button" class="u-btn u-btn-texto" data-cerrar>Cerrar</button></div>', function (b, v) {
          var q = b.getAttribute('data-fic');
          if (q === 'reclamar') { v.remove(); return nuevaIncidencia(cap.ID, p.ID); }
          if (q === 'noir') { v.remove(); return ctx.aviso('Maqueta: le llegaría a tu capitana que no podrás ir al partido del ' + fechaDia(p.FECHA).toLowerCase() + '.'); }
          if (q === 'liga') { v.remove(); M.web.vista = 'liga'; M.web.recien = true; window.scrollTo(0, 0); return pintar(); }
        });
      }

      /** Mi área: el saludo, sus cifras y sus pestañas (las de capitana, si lo es). */
      function areaJugadora(idJ) {
        // T0419: la capitana de un equipo aún sin liga también tiene Mi equipo (su inscripción y lo que lleva pagado).
        var Y = deJugadora(idJ), j = Y.j, ieCap = Y.cap || Y.solicitadas.filter(function (i) { return String(i.ID_CAPITANA || '') === String(idJ); })[0] || null;
        if (!j) return '<p class="u-vacio">No se ha encontrado tu ficha.</p>';
        var goles = golesJugadora(D.GOLES, Y.ijs, Y.ps), nGoles = goles.reduce(function (t, g) { return t + g.goles; }, 0);
        var temps = {}; Y.ies.forEach(function (ie) { var t = D.tempDeIE(ie); if (t) temps[t] = 1; });
        var h = htmlDirecto(Y.ies) + '<div class="mq-hola"><h2>Hola, <span class="mq-pintada">' + texto(j.NOMBRE || '') + '</span></h2><p class="u-nota">' +
          texto(Y.actuales.length ? Y.actuales.map(equipo).join(' y ') + ' · temporada ' + D.temp.NOMBRE : Y.solicitadas.length ? 'Capitana de ' + Y.solicitadas.map(function (i) { return i.NOMBRE_EQUIPO; }).join(' y ') + ' · temporada ' + D.temp.NOMBRE : 'Esta temporada no estás en ningún equipo') +
          (Y.cap ? ' · capitana de ' + Y.cap.NOMBRE_EQUIPO : '') + '</p></div>' +
          cifras([[Object.keys(temps).length, 'temporadas'], [Y.ps.filter(conResultado).length, 'partidos jugados'], [nGoles, goles.some(function (g) { return g.ejemplo; }) ? 'goles (de ejemplo)' : 'goles'],
            [new Set(Y.ies.map(function (ie) { return (D.ixIE[ie] || {}).ID_EQUIPO; }).filter(Boolean)).size, 'equipos']]); // también los que capitanea (T0366)
        h += Y.solicitadas.map(function (i) {
          // T0366: lo que le toca según cómo va: pagar la señal (Solicitada) o esperar su liga (Confirmada, con la señal pagada).
          var c = D.ixComp[i.ID_COMPETICION] || {}, senal = num(c.SENAL), conf = i.ESTADO === 'Confirmada';
          var que = conf ? 'Plaza confirmada: Konamigas ha recibido la señal. Cuando cierre las ligas te dirá la vuestra, el día y la hora, y aquí verás vuestros partidos.'
            : (senal > 0 ? 'Para confirmar vuestra plaza falta la señal (' + euros(senal) + '): Konamigas te escribirá por WhatsApp para decirte a quién pagarla.' : 'Konamigas la está revisando: te dirá la liga, el día y la hora, y el pago de la señal.');
          return '<div class="mqw-solicitada' + (conf ? ' mqw-confirmada' : '') + '"><b>' + texto(i.NOMBRE_EQUIPO) + ' · ' + (conf ? 'plaza confirmada' : 'inscripción ' + texto(String(i.ESTADO || 'Solicitada').toLowerCase())) + '</b><p>' +
            texto((c.NOMBRE_COMERCIAL || c.NOMBRE || '') + '. ' + que + ' Mientras, pásales a tus jugadoras el enlace para que se inscriban en tu equipo.') + '</p>' +
            '<button type="button" class="u-btn" data-mqaviso="Se copiaría el enlace de la inscripción de jugadoras, ya con tu equipo puesto, para mandarlo por WhatsApp.">Copiar el enlace para mis jugadoras</button></div>';
        }).join('');
        var nN = novedadesDe(idJ).nuevas;
        var lista = [['novedades', 'Novedades' + (nN ? ' (' + nN + ')' : '')], ['partidos', 'Mis partidos'], ['goles', 'Mis goles'], ['historico', 'Mi histórico'], ['datos', 'Mis datos']];
        if (ieCap) lista = lista.concat([['equipo', 'Mi equipo'], ['incidencias', 'Incidencias']]);
        if (!M.pestana.mia) M.pestana.mia = nN ? 'novedades' : 'partidos';
        var sel = elegida('mia', lista);
        h += pestanas('mia', lista) + '<div class="mq-cuerpo">';
        var esMio = function (p) { return Y.ies.some(function (ie) { return juega(p, ie); }); };
        if (sel === 'novedades') { h += htmlNovedades(idJ); paso('novedades'); }
        else if (sel === 'partidos') {
          var deEsta = Y.ps.filter(function (p) { return Y.actuales.some(function (ie) { return juega(p, ie); }); });
          var prox = deEsta.filter(function (p) { return p.ESTADO === 'Programado' && String(p.FECHA) >= D.h; });
          var jug = deEsta.filter(function (p) { return p.ESTADO !== 'Programado' || String(p.FECHA) < D.h; }).reverse();
          var hProx = '<h3 class="n-grupo">Próximos <span class="u-cifra">' + prox.length + '</span></h3>' + listaPartidos(prox.slice(0, 6), esMio, 'No tienes partidos programados.', true) +
            (prox.length > 6 ? '<p class="u-nota">Y ' + plural(prox.length - 6, 'partido más', 'partidos más') + ' hasta final de temporada.</p>' : '');
          var hJug = '<h3 class="n-grupo">Jugados esta temporada <span class="u-cifra">' + jug.length + '</span></h3>' + listaPartidos(jug, esMio, 'Aún no has jugado esta temporada.', true);
          // T0366: si ya ha jugado, lo jugado arriba (para reclamar no hay que bajar por todos los próximos).
          h += '<p class="u-nota">Toca un partido para ver su ficha' + (ieCap ? ' y reclamar si algo no cuadra' : ' o avisar si no puedes ir') + '.</p>' + (jug.length ? hJug + hProx : hProx + hJug);
        } else if (sel === 'historico') h += historico(Y.ijs);
        else if (sel === 'goles') h += misGoles(goles);
        else if (sel === 'datos') h += misDatos(j, Y.ijs);
        else if (sel === 'equipo') { h += miEquipo(ieCap); paso('pagos'); }
        else if (sel === 'incidencias') h += incidencias(ieCap);
        return h + '</div>';
      }

      function historico(ijs) {
        if (!ijs.length) return '<p class="u-vacio">Aún no tienes ninguna temporada.</p>';
        return '<div class="u-tabla-caja"><table class="u-tabla n-lista"><thead><tr><th>Temporada</th><th>Equipo</th><th>Liga</th><th>Puesto</th><th class="num">Jugados</th><th>Dorsal</th></tr></thead><tbody>' +
          ijs.map(function (x) {
            var ie = D.ixIE[x.ID_INSCRIPCION_EQUIPO] || {}, ps = (D.parPorIE[ie.ID] || []).filter(conResultado);
            return '<tr><td class="u-tabla-t">' + texto(temporada(D.tempDeIE(ie.ID))) + '</td><td data-t="Equipo">' + texto(ie.NOMBRE_EQUIPO || '') + '</td><td>' + texto(liga(ie.ID_LIGA) || (D.ixComp[ie.ID_COMPETICION] || {}).NOMBRE || '') +
              '</td><td>' + texto(ie.ID_LIGA ? posicion(ie.ID_LIGA, ie.ID) : '') + '</td><td class="num">' + ps.length + '</td><td>' + texto(x.DORSAL || '') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }

      function misGoles(goles) {
        var ej = goles.some(function (g) { return g.ejemplo; });
        var h = ej ? '<p class="mq-aviso">Aún no se apunta en el acta quién marca cada gol, así que en la maqueta los goles son de ejemplo, sobre los resultados de verdad de tu equipo. Con el acta del árbitro (Ligas) saldrán los tuyos.</p>' : '';
        if (!goles.length) return h + '<p class="u-vacio">Todavía no has marcado.</p>';
        var porTemp = {};
        goles.forEach(function (g) { var p = D.ixPar[g.partido], t = p ? D.tempDeLiga(p.ID_LIGA) : ''; (porTemp[t] = porTemp[t] || []).push(g); });
        Object.keys(porTemp).sort().reverse().forEach(function (t) {
          var l = porTemp[t].map(function (g) { return { g: g, p: D.ixPar[g.partido] }; }).filter(function (x) { return x.p; }).sort(function (a, b) { return orden(cuando(b.p), cuando(a.p)); });
          h += '<h3 class="n-grupo">' + texto(temporada(t)) + ' <span class="u-cifra">' + l.reduce(function (s, x) { return s + x.g.goles; }, 0) + '</span></h3><ol class="mq-goles">' +
            l.map(function (x) {
              var rival = String(x.p.ID_INSCRIPCION_LOCAL) === x.g.ie ? x.p.ID_INSCRIPCION_VISITANTE : x.p.ID_INSCRIPCION_LOCAL;
              return '<li><span class="mq-gol-n">' + '⚽'.repeat(Math.min(x.g.goles, 4)) + '</span><span><b>' + texto(equipo(x.g.ie)) + ' ' + texto(x.p.GOLES_LOCAL) + '–' + texto(x.p.GOLES_VISITANTE) + ' · contra ' + texto(equipo(rival)) +
                '</b><small>' + texto(fechaDia(x.p.FECHA) + ' · ' + liga(x.p.ID_LIGA) + (x.p.JORNADA ? ' · J' + x.p.JORNADA : '')) + '</small></span></li>';
            }).join('') + '</ol>';
        });
        return h;
      }

      function misDatos(j, ijs) {
        var ult = ijs[0] || {}, fotos = D.fotosPorJug[j.ID] || [];
        // T0366: su camiseta de esta temporada (la de su inscripción más nueva), y si ya se la han dado.
        var cam = ijs.map(function (x) { return (D.camPorIJ[x.ID] || [])[0]; }).filter(Boolean)[0];
        var htmlCam = cam ? '<h3 class="n-grupo">Tu camiseta</h3><p class="mq-camiseta"><b class="u-cifra">' + texto(cam.DORSAL || '—') + '</b> talla ' + texto(cam.TALLA || '—') + ' · ' +
          texto(cam.ESTADO === 'Entregada' ? 'entregada' + (cam.FECHA_ENTREGA ? ' el ' + fechaCorta(cam.FECHA_ENTREGA) : '') : cam.ESTADO === 'Preparada' ? 'preparada: te la dan en tu próximo partido' : String(cam.ESTADO || 'por pedir').toLowerCase()) +
'</p>' : '';
        var campoD = function (et, v, tipo) { return '<label class="u-campo"><span class="u-etiqueta">' + et + '</span><input' + (tipo ? ' type="' + tipo + '"' : '') + ' value="' + texto(v || '') + '"></label>'; };
        var doc = String(j.NUM_DOCUMENTO || '');
        return '<div class="u-campos">' + campoD('Nombre', j.NOMBRE) + campoD('Apellidos', [j.APELLIDO_1, j.APELLIDO_2].filter(Boolean).join(' ')) +
          campoD('Correo', j.EMAIL, 'email') + campoD('Teléfono', j.TELEFONO, 'tel') + campoD('Instagram', j.INSTAGRAM) + campoD('Talla de camiseta', ult.TALLA) +
          '<div class="u-campo"><span class="u-etiqueta">' + texto(j.TIPO_DOCUMENTO || 'Documento') + '</span><p class="mq-doc">' + (doc ? '•••••' + texto(doc.slice(-3)) : 'Sin documento') +
          '</p><span class="u-nota">Lo guarda Konamigas para el seguro; nunca se enseña a nadie más.</span></div></div>' +
          '<div class="n-botones mq-botones"><button type="button" class="u-btn u-btn-accion" data-mqaviso="En la maqueta no se guarda: en la de verdad, se cambia al momento en su ficha.">Guardar</button>' +
          '<button type="button" class="u-btn" data-mqaviso="Le llegaría un código a ese correo para confirmarlo; los dos correos serían la misma jugadora.">Añadir otro correo</button></div>' +
          htmlCam + '<h3 class="n-grupo">Permisos</h3><label class="u-check"><input type="checkbox"' + (ult.ACEPTA_DERECHOS_IMAGEN ? ' checked' : '') + '> Konamigas puede publicar fotos en las que salgo</label>' +
          '<label class="u-check"><input type="checkbox"' + (ult.ACEPTA_DATOS !== false ? ' checked' : '') + '> Mi nombre sale en la clasificación de goleadoras de la web</label>' +
          '<h3 class="n-grupo">Tus fotos <span class="u-cifra">' + fotos.length + '</span></h3>' +
          (fotos.length ? '<div class="mq-fotos">' + fotos.slice(0, 12).map(htmlFoto).join('') + '</div>' : '<p class="u-vacio">Aún no hay fotos tuyas.</p>');
      }

      /**
       * T0419 · La inscripción del equipo y sus pagos, como los ve Konamigas en Gestión (W.pagos, de maquetaEntrar): el estado,
       * la señal (pagada y cuándo, o lo que falta), la inscripción y las camisetas personalizadas con lo que falta de cada una, y
       * cada pago con su fecha. Importes en céntimos con IVA.
       */
      function inscripcionYPagos(ie) {
        // Con céntimos solo si los hay: «100 €», «81,50 €».
        var P = ((W && W.pagos) || {})[ie.ID], c = D.ixComp[ie.ID_COMPETICION] || {}, eur = function (cts) {
          cts = Math.round(cts || 0);
          return (cts / 100).toLocaleString('es-ES', { minimumFractionDigits: cts % 100 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
        };
        var conf = ie.ESTADO === 'Confirmada';
        var estado = conf ? (ie.ID_LIGA ? 'Confirmada' : 'Plaza confirmada: falta saber vuestra liga') : ie.ESTADO === 'Solicitada' ? 'Solicitada: falta la señal para confirmar la plaza' : String(ie.ESTADO || '');
        var h = '<h3 class="n-grupo">Inscripción</h3><p class="mq-ins-estado"><span class="lg-pav ' + (conf ? 'mq-ok' : 'lg-av-si') + '">' + texto(estado) + '</span> ' +
          texto(c.NOMBRE_COMERCIAL || c.NOMBRE || '') + '</p>';
        if (!P) return h + '<p class="u-nota">Los pagos de tu equipo te los dice Konamigas por WhatsApp.</p>';
        if (P.incluida) return h + '<p class="u-nota">Esta competición va incluida en otra inscripción: no se paga aparte.</p>';
        var fila = function (et, v, nota) { return '<dt>' + texto(et) + '</dt><dd>' + v + (nota ? ' <span class="u-nota">' + texto(nota) + '</span>' : '') + '</dd>'; };
        var falta = function (n) { return n > 0 ? '<b class="mq-falta">faltan ' + texto(eur(n)) + '</b>' : '<span class="mq-pagado">pagado</span>'; };
        var dl = '';
        if (P.senal > 0) dl += fila('Señal', texto(eur(P.senal)) + ' · ' + (P.senalFecha ? '<span class="mq-pagado">pagada el ' + texto(fechaCorta(P.senalFecha)) + '</span>' : falta(Math.max(0, P.senal - Math.max(0, P.cobrado)))), P.senalFecha ? '' : 'con ella se confirma la plaza');
        if (P.inscripcion !== null) dl += fila('Inscripción', texto(eur(P.inscripcion)) + ' · ' + falta(P.faltaInscripcion), P.senal > 0 ? 'la señal va dentro' : '');
        if (P.camisetas && P.camisetas.n) dl += fila('Camisetas', texto(plural(P.camisetas.n, 'personalizada', 'personalizadas') + (P.camisetas.unidad ? ' × ' + eur(P.camisetas.unidad) : '') + ' = ' + eur(P.camisetas.total)) + ' · ' + falta(P.faltaCamisetas), 'las que no van en el pack');
        dl += fila('Pagado', '<b>' + texto(eur(P.cobrado)) + '</b>');
        if (P.falta !== null) dl += fila('Lo que falta', P.falta > 0 ? '<b class="mq-falta">' + texto(eur(P.falta)) + '</b>' : P.falta < 0 ? '<span class="mq-pagado">al día (' + texto(eur(-P.falta)) + ' de más)</span>' : '<span class="mq-pagado">nada: al día</span>');
        h += '<dl class="mq-ficha-d mq-pagos">' + dl + '</dl>';
        h += (P.cobros || []).length ? '<h3 class="n-grupo">Vuestros pagos <span class="u-cifra">' + P.cobros.length + '</span></h3><ul class="mq-cobros">' + P.cobros.map(function (x) {
          return '<li><span>' + texto(fechaCorta(x.fecha)) + '</span><span>' + texto(x.concepto || 'Pago') + '</span><b class="u-cifra">' + texto(eur(x.importe)) + '</b></li>';
        }).join('') + '</ul>' : '<p class="u-vacio">Todavía no habéis pagado nada.</p>';
        return h + (P.falta > 0 ? '<p class="u-nota">Konamigas te escribirá por WhatsApp para decirte cómo pagar lo que falta. Aquí lo verás en cuanto lo apunte.</p>' : '');
      }

      function miEquipo(ie) {
        var js = (D.ijPorIE[ie.ID] || []).filter(function (x) { return x.ESTADO !== 'Baja'; });
        var faltan = js.filter(function (x) { return !x.ACEPTA_NORMAS || !x.ACEPTA_DATOS; });
        var gestor = (D.ixLiga[ie.ID_LIGA] || {}).ID_GESTOR;
        return inscripcionYPagos(ie) + '<h3 class="n-grupo">Jugadoras</h3><p class="u-nota">' + texto(liga(ie.ID_LIGA) || 'Aún sin liga') + (gestor ? ' · tu gestor es ' + texto(staff(gestor)) : '') + '</p>' +
          cifras([[js.length, 'jugadoras'], [faltan.length, 'les falta aceptar'], [(ie.ID_LIGA && posicion(ie.ID_LIGA, ie.ID)) || '—', 'en la liga']]) +
          '<ol class="lg-ranking mq-plantilla">' + js.map(function (x) {
            var jj = D.ixJug[x.ID_JUGADORA], cap = String(x.ID_JUGADORA) === String(ie.ID_CAPITANA);
            return '<li><span class="lg-pos">' + texto(x.DORSAL || '') + '</span><span class="lg-nom"><b>' + texto(nombreJug(jj)) + '</b>' + (cap ? ' <span class="u-chip">Capitana</span>' : '') +
              ((!x.ACEPTA_NORMAS || !x.ACEPTA_DATOS) ? ' <span class="lg-pav lg-av-si">Le falta aceptar las normas</span>' : '') + '</span></li>';
          }).join('') + '</ol>' +
          '<div class="n-botones mq-botones"><button type="button" class="u-btn" data-mqaviso="Le llegaría por WhatsApp el enlace de la inscripción de jugadoras, ya con el equipo puesto.">Invitar a una jugadora</button></div>';
      }

      /* ---------- incidencias de la capitana (en memoria) ---------- */

      function incidenciasDe(ie) {
        var I = comun().incidencias || (comun().incidencias = {});
        if (!I[ie.ID]) {
          var ps = D.parPorIE[ie.ID] || [], jug = ps.filter(conResultado), prox = ps.filter(function (p) { return p.ESTADO === 'Programado' && p.FECHA >= D.h; });
          // T0366: las de ejemplo, solo para un equipo que ya jugaba antes de hoy (uno recién inscrito no ha reclamado nada).
          if (!ps.some(function (p) { return conResultado(p) && String(p.FECHA) < D.h; })) jug = prox = [];
          var l = [];
          if (jug.length) {
            var pj = jug[jug.length - 1];
            l.push(Object.assign({ tipo: 'El resultado está mal', partido: pj.ID, texto: 'Ganamos por un gol más: el último lo marcamos en el descuento.', estado: 'Resuelta', respuesta: 'Revisado: el resultado se queda como está.', cuando: sumarDias(D.h, -3) }, destinoIncidencia('El resultado está mal', pj)));
          }
          if (prox.length > 1) l.push({ tipo: 'No podremos venir', partido: prox[1].ID, texto: 'Ese día tenemos boda de una compañera: ¿se puede aplazar?', estado: 'Vista por el gestor', respuesta: '', cuando: sumarDias(D.h, -1), para: 'gestor' });
          l.forEach(function (x, i) { x.id = ie.ID + '-' + i; x.ie = ie.ID; });
          I[ie.ID] = l;
          guardarComun();
        }
        return I[ie.ID];
      }
      /** A quién le llega una incidencia: «al árbitro Marta» o «a Lucía» (el gestor de la liga). */
      function quienLleva(x, ie) {
        if (x.para === 'arbitro') return staff(x.arbitro) ? 'al árbitro ' + staff(x.arbitro) : 'al árbitro del partido';
        var g = staff((D.ixLiga[(ie || D.ixIE[x.ie] || {}).ID_LIGA] || {}).ID_GESTOR);
        return g ? 'a ' + g : 'al gestor de la liga';
      }
      function incidencias(ie) {
        var l = incidenciasDe(ie), gestor = quienLleva({ para: 'gestor' }, ie).replace(/^al? /, '');
        var una = function (x, gest) {
          var p = D.ixPar[x.partido], arb = x.para === 'arbitro', quien = quienLleva(x, ie);
          return '<li class="mq-inc"><div class="mq-inc-cab"><b>' + texto(x.tipo) + '</b><span class="lg-pav ' + (CHIP_INC[x.estado] || '') + '">' + texto(x.estado) + '</span></div>' +
            '<small>' + texto((p ? fechaDia(p.FECHA) + ' · ' + equipo(p.ID_INSCRIPCION_LOCAL) + ' – ' + equipo(p.ID_INSCRIPCION_VISITANTE) + ' · ' : '') + 'le llega ' + quien) + '</small>' +
            '<p>' + texto(x.texto) + '</p>' + (x.respuesta ? '<p class="mq-resp"><b>' + texto(arb ? 'Árbitro' : gestor) + ':</b> ' + texto(x.respuesta) + '</p>' : '') +
            (gest && !arb && x.estado !== 'Resuelta' ? '<div class="n-botones">' + (x.estado === 'Enviada' ? '<button type="button" class="u-btn" data-mqinc="' + texto(x.id) + '" data-accion="ver">Marcar vista</button>' : '') +
              '<button type="button" class="u-btn" data-mqinc="' + texto(x.id) + '" data-accion="resolver">Resolver</button></div>' : '') + '</li>';
        };
        var deGestor = l.filter(function (x) { return x.para !== 'arbitro'; });
        return '<p class="u-nota">Avisos sencillos: lo del resultado o de quién marcó le llega al árbitro del partido, que corrige el acta; lo de un partido que viene (no podéis venir, otra hora), ' + texto(quienLleva({ para: 'gestor' }, ie)) +
          ', que os propone una solución. Tú nunca editas el partido.</p>' +
          '<div class="n-botones mq-botones"><button type="button" class="u-btn u-btn-accion" data-mqnueva="' + texto(ie.ID) + '">Avisar de algo</button></div>' +
          '<h3 class="n-grupo">Tus avisos <span class="u-cifra">' + l.length + '</span></h3>' + (l.length ? '<ul class="mq-incs">' + l.map(function (x) { return una(x, false); }).join('') + '</ul>' : '<p class="u-vacio">No has avisado de nada.</p>') +
          // Fuera del simulador (no se ve la plataforma al lado): así le llega al gestor, con sus botones.
          (window.parent === window && deGestor.length ? '<section class="mq-gestor"><h3 class="n-grupo">Así le llega a ' + texto(gestor) + '</h3><p class="u-nota">En su Perfil y en Ligas, con un aviso en el móvil.</p>' +
            '<ul class="mq-incs">' + deGestor.map(function (x) { return una(x, true); }).join('') + '</ul></section>' : '');
      }
      function nuevaIncidencia(idIE, idP) {
        var ie = D.ixIE[idIE], ps = (D.parPorIE[idIE] || []).filter(function (p) { return p.FECHA >= sumarDias(D.h, -21) || String(p.ID) === String(idP); }).slice(0, 14);
        var elegido = D.ixPar[idP], tipo = !elegido ? '' : conResultado(elegido) ? 'El resultado está mal' : elegido.ESTADO === 'Programado' && elegido.FECHA >= D.h ? 'No podremos venir' : 'Otra cosa';
        var v = ventana('<h2>Avisar de algo</h2><div class="u-campos"><label class="u-campo u-ancho"><span class="u-etiqueta">Qué pasa</span><select data-k="tipo">' +
          TIPOS_INCIDENCIA.map(function (t) { return '<option' + (t === tipo ? ' selected' : '') + '>' + texto(t) + '</option>'; }).join('') + '</select></label>' +
          '<label class="u-campo u-ancho"><span class="u-etiqueta">Partido</span><select data-k="partido">' + ps.map(function (p) {
            return '<option value="' + texto(p.ID) + '"' + (String(p.ID) === String(idP) ? ' selected' : '') + '>' + texto(fechaDia(p.FECHA) + ' · ' + equipo(p.ID_INSCRIPCION_LOCAL) + ' – ' + equipo(p.ID_INSCRIPCION_VISITANTE)) + '</option>';
          }).join('') + '</select></label><label class="u-campo u-ancho"><span class="u-etiqueta">Cuéntaselo</span><textarea rows="3" data-k="texto" placeholder="Lo que tenga que saber"></textarea></label></div>' +
          '<p class="u-nota" data-k="destino"></p>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-enviar>Enviar</button><button type="button" class="u-btn" data-cerrar>Cancelar</button></div>', function (b, v) {
          if (!b.hasAttribute('data-enviar')) return;
          var val = function (k) { return v.querySelector('[data-k=' + k + ']').value; };
          var dest = destinoIncidencia(val('tipo'), D.ixPar[val('partido')]);
          var nueva = Object.assign({ id: ie.ID + '-' + Date.now().toString(36), ie: ie.ID, tipo: val('tipo'), partido: val('partido'), texto: val('texto') || '(sin texto)', estado: 'Enviada', respuesta: '', cuando: D.h, cambio: new Date().toISOString() }, dest);
          incidenciasDe(ie).unshift(nueva);
          guardarComun();
          var quien = quienLleva(nueva, ie);
          avisarSim({ a: 'app', titulo: 'Incidencia de ' + equipo(ie.ID) + (dest.para === 'arbitro' ? ' para el árbitro' : ''), texto: nueva.tipo + ': ' + nueva.texto, ir: dest.para === 'arbitro' ? 'arbitro' : 'incidencias' });
          v.remove();
          ctx.aviso('Enviado ' + quien + ': lo verás en Mi área · Incidencias');
          if (!(W && M.web.vista === 'liga')) pintar(); // en Competiciones se queda la ficha del partido abierta
        });
        // A quién le llega, según lo que se elige (T0419): el botón lo dice.
        var poner = function () {
          var val = function (k) { return v.querySelector('[data-k=' + k + ']').value; };
          var dest = destinoIncidencia(val('tipo'), D.ixPar[val('partido')]), quien = quienLleva(dest, ie);
          v.querySelector('[data-enviar]').textContent = dest.para === 'arbitro' ? 'Enviar al árbitro' : 'Enviar al gestor';
          v.querySelector('[data-k=destino]').textContent = dest.para === 'arbitro' ? 'Le llega ' + quien + ', que pitó el partido: si tenéis razón, corrige el acta y lo veréis en Novedades.'
            : DEL_ACTA.indexOf(val('tipo')) >= 0 ? 'Ese partido aún no tiene acta: le llega ' + quien + '.' : 'Le llega ' + quien + ', que os propondrá una solución.';
        };
        v.addEventListener('change', poner);
        poner();
        return v;
      }

      /* ======================= konamigas.com (ctx.web) ======================= */
      // Una web para todas: sin entrar, inicio (inscripciones y competiciones en curso) y cada competición; al entrar,
      // la jugadora ve lo mismo con su equipo marcado y además «Mi área» (y lo de capitana, si lo es). El staff entra
      // con Google en la plataforma (W.app). Las inscripciones son la página que ya existe (W.ins), con su bolsa.

      /** Las ligas de esta temporada con partidos, por competición y nombre. */
      function ligasEnCurso() {
        return D.LIGAS.filter(function (l) { return D.tempDeLiga(l.ID) === String(D.temp.ID) && (D.parPorLiga[l.ID] || []).length; })
          .sort(function (a, b) { return orden(liga(a.ID), liga(b.ID)); });
      }
      /** Un enlace a otra página de la maqueta (a: 'ins', 'app' o 'web'), con su dirección y, para la copia del móvil, qué es. */
      function enlace(a, q) {
        var base = a === 'ins' ? W.ins : a === 'app' ? W.app : (window.KANBAN || {}).web || '../';
        return 'href="' + texto(base + (q ? '?' + q : '')) + '" data-mqira="' + a + '" data-q="' + texto(q || '') + '"';
      }

      function pintarWeb() {
        var v = M.web.vista, yo = M.web.yo && D.ixJug[M.web.yo] ? M.web.yo : '';
        // Habiendo entrado, Mi área es su inicio: lo suyo; Competiciones, la liga entera. Sin entrar, Inicio y Entrar.
        if (!yo && v === 'mia') v = M.web.vista = 'entrar';
        if (yo && (v === 'entrar' || v === 'inicio')) v = M.web.vista = 'mia';
        var nav = yo ? [['mia', 'Mi área'], ['liga', 'Competiciones'], ['inscripciones', 'Inscripciones']] : [['inicio', 'Inicio'], ['liga', 'Competiciones'], ['inscripciones', 'Inscripciones'], ['entrar', 'Entrar']];
        ctx.ponerTitulo({ inicio: 'Konamigas', liga: 'Competiciones', mia: 'Mi área', entrar: 'Entrar' }[v] || 'Konamigas');
        var h = '<div class="mq mqw"><header class="mqw-cab"><button type="button" class="mqw-marca" data-mqw="inicio"><img src="' + texto(W.icono) + '" alt="" width="34" height="34"><span>KONAMIGAS</span></button>' +
          '<nav class="mqw-nav" aria-label="Konamigas">' + nav.map(function (x) {
            if (x[0] === 'inscripciones') return '<a ' + enlace('ins', '') + '>' + texto(x[1]) + '</a>';
            var punto = x[0] === 'mia' && yo && novedadesDe(yo).nuevas ? ' <span class="mqw-punto" aria-label="Novedades"></span>' : '';
            return '<button type="button" data-mqw="' + x[0] + '"' + (x[0] === v ? ' aria-current="page"' : '') + '>' + texto(x[1]) + punto + '</button>';
          }).join('') + '</nav></header>';
        h += franja(yo ? 'konamigas.com, como ' + nombreJug(D.ixJug[yo]) + (capitanaDe(yo) ? ' (capitana)' : '') : 'konamigas.com, la web de todas, sin entrar');
        // Los avisos de Konamigas (jornadas temáticas…), arriba: a todas o a las de su liga si ha entrado.
        if (v !== 'entrar') h += htmlAvisos(avisosVisibles(yo ? deJugadora(yo).actuales.map(function (ie) { return String((D.ixIE[ie] || {}).ID_LIGA); }) : []));
        if (v === 'liga') h += webLiga(yo);
        else if (v === 'entrar') h += webEntrar();
        else if (v === 'mia') h += areaJugadora(yo) + '<div class="n-botones mq-botones"><button type="button" class="u-btn" data-mqwsalir>Salir</button></div>';
        else h += webInicio(yo);
        return h + '<footer class="mqw-pie">IG: @KONAMIGASBARCELONA · <a ' + enlace('ins', 'f=privacidad') + '>Privacidad</a></footer></div>';
      }

      /** Los partidos en directo ahora (el árbitro lleva el acta desde su móvil): tarjetas con el marcador y el minuto. */
      function htmlDirecto(ies) {
        var d = comun().directo || {}, l = Object.keys(d).map(function (id) { return { p: D.ixPar[id], d: d[id] }; }).filter(function (x) {
          return x.p && (!ies || ies.some(function (ie) { return juega(x.p, ie); }));
        });
        if (!l.length) return '';
        return '<section class="mqw-directo" aria-label="En directo">' + l.map(function (x) {
          var p = x.p;
          return '<article><span class="mq-vivo">En directo · min ' + minuto(x.d) + '</span><div class="mqw-dir-m"><b>' + texto(equipo(p.ID_INSCRIPCION_LOCAL)) + '</b><b class="u-cifra">' + x.d.gl + '–' + x.d.gv + '</b><b>' + texto(equipo(p.ID_INSCRIPCION_VISITANTE)) + '</b></div><small>' +
            texto(liga(p.ID_LIGA) + ' · ' + campo(p.ID_CAMPO) + (x.d.arbitro ? ' · lleva el acta ' + staff(x.d.arbitro) : '')) + '</small></article>';
        }).join('') + '</section>';
      }

      function webInicio(yo) {
        var ligas = ligasEnCurso(), h = htmlDirecto(null);
        h += '<section class="mq-web-hero"><p class="mq-web-marca">Temporada ' + texto(D.temp.NOMBRE || '') + '</p><h2>Las mejores ligas <span class="mq-pintada">del mundo</span></h2>' +
          '<p>' + plural(D.ieTemp.length, 'equipo', 'equipos') + ' · ' + plural(ligas.length, 'liga', 'ligas') + ' en juego</p>' +
          '<div class="mqw-botones"><button type="button" class="u-btn u-btn-accion" data-mqw="liga">Ver las competiciones</button></div></section>';
        h += '<section class="mqw-invita"><div><h3>¿Juegas en Konamigas?</h3><p>Entra con tu correo, sin contraseña: tus partidos, tus goles, tu histórico y tus datos. Si eres capitana, también tu equipo.</p></div>' +
          '<button type="button" class="u-btn u-btn-accion" data-mqw="entrar">Entrar</button></section>';
        h += '<h2 class="mqw-tit">Inscripciones</h2>' + webInscripciones();
        return h;
      }

      /** Las competiciones con la inscripción abierta, de la página de inscripciones (su función pública de verdad). */
      function webInscripciones() {
        var I = M.web.ins;
        if (!I) {
          if (!M.web.insPidiendo) { M.web.insPidiendo = 1; W.inscripciones().then(function (r) { M.web.ins = r || { competiciones: [] }; pintar(); }, function () { M.web.ins = { competiciones: [], error: 1 }; pintar(); }); }
          return '<p class="u-nota">Mirando qué competiciones tienen la inscripción abierta…</p>';
        }
        var cs = I.competiciones || [];
        var h = cs.length ? '<div class="mqw-comps">' + cs.slice(0, 6).map(function (c) {
          var dias = {};
          (c.opciones || []).forEach(function (o) { dias[String(o).split(' · ')[0]] = 1; });
          return '<article class="mqw-comp"><h3>' + texto(c.nombre) + '</h3><p class="mqw-precio">' + (c.precio ? texto(euros(c.precio.importe)) + ' <small>por equipo</small>' : '<small>Precio por confirmar</small>') + '</p>' +
            '<p class="u-nota">' + texto(Object.keys(dias).join(', ')) + '</p><a class="u-btn u-btn-accion" ' + enlace('ins', 'f=equipo&c=' + encodeURIComponent(c.id)) + '>Inscribir a mi equipo</a></article>';
        }).join('') + '</div>' : '<p class="u-vacio">' + (I.error ? 'No se han podido leer las inscripciones.' : 'Ahora mismo no hay ninguna competición con la inscripción abierta.') + '</p>';
        return h + '<div class="mqw-ins-mas"><a class="mqw-ins-op" ' + enlace('ins', 'f=jugadora') + '><b>Mi equipo ya está inscrito</b><span>Inscríbete como jugadora en tu equipo ›</span></a>' +
          '<a class="mqw-ins-op" ' + enlace('ins', 'f=banco') + '><b>Bolsa de jugadoras</b><span>Equipos que buscan jugadoras y jugadoras que buscan equipo ›</span></a></div>';
      }

      /**
       * Competiciones: la sección Ligas de la plataforma, la misma, solo para ver (W.ligas; se monta en #mqw-ligas después
       * de pintar). Encima, sin entrar, la invitación a entrar o a inscribirse; habiendo entrado, su equipo, y se abre en su liga.
       */
      function webLiga(yo) {
        var h = htmlDirecto(null);
        // Sin entrar, invita a entrar o a inscribirse; habiendo entrado, lo suyo está en Mi área (aquí, la liga entera).
        if (!yo) {
          h += '<div class="mqw-anima"><div><b>¿Juegas en Konamigas?</b><p>Entra y verás tu equipo, tus partidos y tus goles.</p><button type="button" class="u-btn u-btn-accion" data-mqw="entrar">Entrar</button></div>' +
            '<div><b>¿Aún no juegas?</b><p>Inscribe a tu equipo o búscalo en la bolsa de jugadoras.</p><a class="u-btn" ' + enlace('ins', '') + '>Inscríbete</a></div></div>';
        }
        return h + '<div id="mqw-ligas" class="mqw-ligas-sec"></div>';
      }
      /** Monta Ligas en su sitio (si se está en Competiciones): en la liga de la jugadora y con «Reclamar» para la capitana. */
      var cerrarLigas; // sin «= null»: pintar puede haberla puesto antes de llegar aquí (T0366)
      function montarLigas() {
        if (cerrarLigas) { cerrarLigas(); cerrarLigas = null; }
        var c = el.querySelector('#mqw-ligas');
        if (!c || !W.ligas) return;
        var yo = M.web.yo && D.ixJug[M.web.yo] ? M.web.yo : '', Y = yo ? deJugadora(yo) : null, ie = Y && D.ixIE[Y.actuales[0]];
        var l = ie && D.ixLiga[ie.ID_LIGA];
        var recien = M.web.recien; M.web.recien = false;
        cerrarLigas = W.ligas(c, l ? { comp: String(l.ID_COMPETICION), liga: String(l.ID), partidos: recien } : null, function (idP, vent) {
          var cap = Y && Y.cap, p = D.ixPar[idP];
          if (!cap || !p || !juega(p, cap.ID)) return;
          var bs = vent.querySelector('.n-botones');
          if (!bs || bs.querySelector('[data-mqficha]')) return;
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'u-btn u-btn-accion'; b.setAttribute('data-mqficha', '1');
          b.textContent = 'Reclamar';
          b.onclick = function () { nuevaIncidencia(cap.ID, idP); };
          bs.insertBefore(b, bs.firstChild);
          var n = document.createElement('p');
          n.className = 'u-nota mqw-recl'; n.setAttribute('data-mqficha', '1');
          n.textContent = 'Eres la capitana de ' + equipo(cap.ID) + ': si algo de este partido no cuadra, reclámalo y le llega a ' + (staff((D.ixLiga[cap.ID_LIGA] || {}).ID_GESTOR) || 'el gestor de la liga') + '.';
          bs.parentNode.insertBefore(n, bs);
        });
      }

      /** Entrar: las jugadoras y capitanas, con su correo y un código; el staff, con Google en la plataforma. */
      function webEntrar() {
        var P = M.web.personas;
        if (!P) {
          if (!M.web.pPidiendo) { M.web.pPidiendo = 1; W.personas().then(function (r) { M.web.personas = r || []; pintar(); }, function () { M.web.personas = []; pintar(); }); }
        }
        var como = (P || []).filter(function (x) { return x.id === M.web.como; })[0] || (P || []).filter(function (x) { return x.nueva; })[0] || (P || []).filter(function (x) { return x.temporada && !x.capitana; })[0] || (P || [])[0];
        if (como) M.web.como = como.id;
        var h = '<div class="mqw-entrar"><section class="mq-entrar"><h2>Jugadoras y capitanas</h2>';
        if (M.web.paso) {
          h += '<p>Te hemos enviado un código de 6 cifras a <b>' + texto(M.web.correo || 'tu correo') + '</b>. Caduca en 10 minutos.</p>' +
            '<label class="u-campo"><span class="u-etiqueta">Código</span><input inputmode="numeric" maxlength="6" placeholder="123456" class="mq-codigo"></label>' +
            '<button type="button" class="u-btn u-btn-accion" data-mqwentrar>Entrar</button><p class="u-nota">En la maqueta vale cualquier código.</p>';
        } else {
          h += '<p>Sin contraseña: escribe el correo con el que te inscribiste y te mandamos un código.</p>' +
            '<label class="u-campo"><span class="u-etiqueta">Tu correo</span><input type="email" data-mqwcorreo placeholder="tu@correo.com" value="' + texto(M.web.correo || '') + '"></label>' +
            '<button type="button" class="u-btn u-btn-accion" data-mqwcodigo>Enviarme el código</button>';
        }
        h += '<div class="mqw-como"><span class="mq-sello">Maqueta</span><p>Entrarás como <b>' + texto(como ? como.nombre : '…') + '</b>' + (como && como.nueva ? ' (capitana, recién inscrita)' : como && como.capitana ? ' (capitana)' : '') +
          (como && como.equipos.length ? ', de ' + texto(como.equipos.join(', ')) : '') + '.</p><button type="button" class="u-btn u-btn-texto" data-mqwcomo>Cambiar</button></div></section>' +
          '<section class="mq-entrar"><h2>Árbitros</h2><p>Entra con tu cuenta de Google y, en tu móvil, lleva el acta en directo durante el partido.</p>' +
          '<button type="button" class="u-btn u-btn-accion" data-mqwarbitro>Entrar como árbitro</button></section>' +
          '<section class="mq-entrar"><h2>Staff y Konamigas</h2><p>Árbitros, gestores y socios entran con su cuenta de Google en la plataforma: sus partidos, las ligas, la gestión y la economía, según su perfil.</p>' +
          '<a class="u-btn" ' + enlace('app', '') + '>Entrar con Google</a></section></div>';
        return h;
      }

      /* ======================= Incidencias: cómo le llegan al gestor ======================= */

      function todasIncidencias() {
        var I = comun().incidencias || {}, l = [];
        Object.keys(I).forEach(function (ie) { (I[ie] || []).forEach(function (x, i) { l.push({ x: x, ie: ie, i: i }); }); });
        return l.sort(function (a, b) { return (ORDEN_INC[a.x.estado] || 0) - (ORDEN_INC[b.x.estado] || 0) || orden(String(b.x.cuando), String(a.x.cuando)); });
      }
      /** Quién es en STAFF quien ha entrado (ligasStaff, como en Ligas); undefined mientras se pregunta. */
      function yoStaff() {
        if (M.yoStaff === undefined && typeof ctx.llamar === 'function') {
          M.yoStaff = null;
          ctx.llamar('ligasStaff').then(function (r) { M.yoStaff = (r && r.yo) || ''; if (ctx.abierta()) pintar(); }, function () { M.yoStaff = ''; });
        }
        return M.yoStaff;
      }
      function portalIncidencias() {
        // Un gestor ve las de sus ligas; quien administra y los socios, todas. Lo del acta lo lleva el árbitro (T0419).
        var gestor = !ctx.admin && /Gestor/.test(String(ctx.perfil || '')), yo = gestor ? yoStaff() : '';
        var deSusLigas = todasIncidencias().filter(function (y) { var ie = D.ixIE[y.ie], lg = ie && D.ixLiga[ie.ID_LIGA]; return !gestor || (yo && lg && String(lg.ID_GESTOR) === String(yo)); });
        var l = deSusLigas.filter(function (y) { return y.x.para !== 'arbitro'; }), alArbitro = deSusLigas.length - l.length;
        var n = function (e) { return l.filter(function (y) { return y.x.estado === e; }).length; };
        var h = franja('Así le llegan al gestor las incidencias de las capitanas') +
          cifras([[n('Enviada'), 'sin ver'], [n('Vista por el gestor'), 'vistas'], [n('Resuelta'), 'resueltas']]) +
          '<p class="u-nota">Lo de un partido que viene (no pueden venir, quieren otra hora) le llega al gestor de la liga, que propone la solución desde aquí: aplazarlo a un hueco libre o cambiarle la hora, y las jugadoras de los dos equipos lo ven en Novedades.' +
          (alArbitro ? ' Las reclamaciones del resultado (' + alArbitro + ') las revisa el árbitro de cada partido.' : '') +
          (gestor ? ' Ves las de tus ligas' + (yo ? ' (' + texto(D.LIGAS.filter(function (x) { return String(x.ID_GESTOR) === String(yo) && D.tempDeLiga(x.ID) === String(D.temp.ID); }).map(function (x) { return liga(x.ID); }).join(', ') || 'ninguna esta temporada') + ')' : '') + '.' : '') + '</p>';
        if (gestor && yo === null) return h + '<div class="kz-centro" role="status"><div class="u-carga"></div></div>';
        if (!l.length) return h + '<p class="u-vacio">' + (gestor ? 'Ninguna capitana de tus ligas ha avisado de nada todavía.' : 'Ninguna capitana ha avisado de nada todavía.') + '</p>';
        return h + '<ul class="mq-incs">' + l.map(function (y) {
          var x = y.x, p = D.ixPar[x.partido], ie = D.ixIE[y.ie], k = texto(y.ie) + '|' + texto(x.id);
          return '<li class="mq-inc"><div class="mq-inc-cab"><b>' + texto(equipo(y.ie)) + ' · ' + texto(x.tipo) + '</b><span class="lg-pav ' + (CHIP_INC[x.estado] || '') + '">' + texto(x.estado) + '</span></div>' +
            '<small>' + texto((ie ? liga(ie.ID_LIGA) + ' · ' : '') + (p ? fechaDia(p.FECHA) + (p.HORA ? ' a las ' + p.HORA : '') + ' · ' + equipo(p.ID_INSCRIPCION_LOCAL) + ' – ' + equipo(p.ID_INSCRIPCION_VISITANTE) + (p.ESTADO !== 'Programado' ? ' · ' + String(p.ESTADO).toLowerCase() : '') : '')) + '</small>' +
            '<p>' + texto(x.texto) + '</p>' + (x.respuesta ? '<p class="mq-resp"><b>Respuesta:</b> ' + texto(x.respuesta) + '</p>' : '') +
            '<div class="n-botones">' + (x.estado === 'Enviada' ? '<button type="button" class="u-btn" data-mqgest="' + k + '" data-accion="ver">Marcar vista</button>' : '') +
            (x.estado !== 'Resuelta' ? '<button type="button" class="u-btn u-btn-accion" data-mqgest="' + k + '" data-accion="responder">' + (solucionesDe(x).length > 1 ? 'Proponer una solución' : 'Responder y resolver') + '</button>' : '') +
            (p ? '<button type="button" class="u-btn" data-mqenligas="' + texto(p.ID) + '">Abrir el partido en Ligas ›</button>' : '') + '</div></li>';
        }).join('') + '</ul>';
      }
      /**
       * T0419 · Lo que el gestor puede proponer desde el aviso de un partido que viene, con su respuesta a la capitana:
       * con «Queremos otra hora», los huecos libres de su liga ese mismo día (ligasMover); con «No podremos venir» y «Queremos
       * otra hora», aplazarlo a uno de los próximos huecos libres en los que no juega ningún equipo (ligasPartido y
       * ligasRecuperar) o aplazarlo sin fecha; y siempre, solo responder. [{ k, titulo, resp, hacer }]
       */
      function solucionesDe(x) {
        var p = D.ixPar[x.partido], ie = x.ie, ops = [];
        var futuro = p && p.ESTADO === 'Programado' && String(p.FECHA) >= D.h && ['No podremos venir', 'Queremos otra hora'].indexOf(x.tipo) >= 0;
        if (futuro) {
          var aplazar = function () {
            return ctx.llamar('ligasPartido', [p.ID, { ESTADO: 'Aplazado', MOTIVO: 'Lo pidió ' + equipo(ie), APLAZADO_POR: ie, AVISO_APLAZAMIENTO: String(x.cuando || D.h).slice(0, 10) > String(p.FECHA) ? p.FECHA : String(x.cuando || D.h).slice(0, 10) }]);
          };
          var dia = fechaDia(p.FECHA).toLowerCase();
          if (x.tipo === 'Queremos otra hora') huecosLibres(p, { huecos: D.HUECOS, partidos: D.PARTIDOS, mismoDia: true }).forEach(function (o) {
            ops.push({ k: 'mover-' + o.hueco.ID, titulo: 'El mismo día a las ' + o.hueco.HORA + ' en ' + campo(o.hueco.ID_CAMPO),
              resp: 'Cambiado: jugáis el ' + dia + ' a las ' + o.hueco.HORA + ' en ' + campo(o.hueco.ID_CAMPO) + '.', hacer: function () { return ctx.llamar('ligasMover', [p.ID, o.hueco.ID]); } });
          });
          var c = D.ixComp[(D.ixLiga[p.ID_LIGA] || {}).ID_COMPETICION] || {};
          huecosLibres(p, { huecos: D.HUECOS, partidos: D.PARTIDOS, calendario: D.CALENDARIO, hoy: D.h, hasta: c.FECHA_FIN || D.temp.FECHA_FIN, max: 3 }).forEach(function (o) {
            var cu = fechaDia(o.fecha).toLowerCase() + ' a las ' + o.hueco.HORA + ' en ' + campo(o.hueco.ID_CAMPO);
            ops.push({ k: 'recuperar-' + o.fecha + '-' + o.hueco.ID, titulo: 'Aplazarlo al ' + cu,
              resp: 'Aplazado: lo jugáis el ' + cu + '.', hacer: function () { return aplazar().then(function () { return ctx.llamar('ligasRecuperar', [o.fecha, [{ id: p.ID, hueco: o.hueco.ID }]]); }); } });
          });
          ops.push({ k: 'aplazar', titulo: 'Aplazarlo; la nueva fecha, más adelante', resp: 'Aplazado: os decimos la nueva fecha en cuanto la tengamos.', hacer: aplazar });
        }
        ops.push({ k: 'responder', titulo: futuro ? 'Solo responder, sin cambiar el partido' : 'Responder', resp: x.tipo === 'No podremos venir' ? 'Lo miramos y os decimos algo.' : 'Lo revisamos y os decimos algo. Gracias por avisar.', hacer: null });
        return ops;
      }
      function responderIncidencia(ie, id) {
        var x = incidencia(ie, id);
        if (!x) return;
        var ops = solucionesDe(x), p = D.ixPar[x.partido], editado = false;
        var v = ventana('<h2>' + (ops.length > 1 ? 'Proponer una solución a ' : 'Responder a ') + texto(equipo(ie)) + '</h2><p class="u-nota">' + texto(x.tipo + ': ' + x.texto) + '</p>' +
          (p ? '<p class="u-nota">' + texto(equipo(p.ID_INSCRIPCION_LOCAL) + ' – ' + equipo(p.ID_INSCRIPCION_VISITANTE) + ' · ' + cuandoDonde(p)) + '</p>' : '') +
          (ops.length > 1 ? '<fieldset class="mq-opciones"><legend class="u-etiqueta">Qué propones</legend>' + ops.map(function (o, i) {
            return '<label class="u-check"><input type="radio" name="mq-sol" value="' + i + '"' + (i === 0 ? ' checked' : '') + '> ' + texto(o.titulo) + '</label>';
          }).join('') + '</fieldset>' : '') +
          '<label class="u-campo u-ancho"><span class="u-etiqueta">Respuesta a la capitana</span><textarea rows="3" data-k="r">' + texto(ops[0].resp) + '</textarea></label>' +
          (ops.length > 1 ? '<p class="u-nota">El partido se cambia en Ligas al enviar, y las jugadoras de los dos equipos lo ven en Novedades.</p>' : '') +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-guardar>Enviar y resolver</button><button type="button" class="u-btn" data-cerrar>Cancelar</button></div>', function (b, v) {
          if (!b.hasAttribute('data-guardar')) return;
          var sel = v.querySelector('[name=mq-sol]:checked'), o = ops[sel ? Number(sel.value) : ops.length - 1];
          var resp = v.querySelector('[data-k=r]').value || o.resp;
          b.disabled = true;
          (o.hacer ? o.hacer().then(function () { return T.refrescar ? T.refrescar(['PARTIDOS', 'SANCIONES']) : null; }) : Promise.resolve()).then(function () {
            cambiarIncidencia(ie, id, { estado: 'Resuelta', respuesta: resp });
            novedad([ie], 'Respuesta de Konamigas a tu aviso', x.tipo + ': ' + resp);
            guardarComun();
            avisarSim({ a: 'web', titulo: 'Respuesta del gestor a ' + equipo(ie), texto: resp });
            if (o.hacer) paso('aplaza');
            v.remove();
            ctx.aviso(o.hacer ? 'Hecho en Ligas y respondido: las jugadoras lo ven en Novedades' : 'Respondida: la capitana lo ve en su área');
            firma = ''; pintar();
          }, function (e) { b.disabled = false; ctx.aviso(String(e && e.message || e).replace(/^\w+:\s*/, '')); });
        });
        // Al elegir otra solución, su respuesta (si no se ha escrito otra a mano).
        v.querySelector('textarea').addEventListener('input', function () { editado = true; });
        v.addEventListener('change', function (e) { if (e.target.name === 'mq-sol' && !editado) v.querySelector('textarea').value = ops[Number(e.target.value)].resp; });
      }
      /** Abre un partido en la sección Ligas de la plataforma (su ficha, con Partidos en su día detrás). */
      function abrirEnLigas(id) {
        history.pushState({ s: 'LIGAS' }, '', '?s=ligas&partido=' + encodeURIComponent(id));
        window.dispatchEvent(new PopStateEvent('popstate', { state: { s: 'LIGAS' } }));
      }

      /* ======================= Árbitro: el acta en el campo ======================= */
      // Pensado para el móvil del árbitro, en el campo: sus partidos de hoy, las actas que le faltan y, en cada partido, el
      // marcador apuntando cada gol al tocar a la jugadora. Cierra el acta de verdad con Ligas (ligasActa) y, si no se jugó,
      // dice qué pasó (ligasPartido: suspendido o un equipo no se presentó). Quien administra los ve todos.

      /**
       * Lo nuevo del árbitro (lo demás, sus próximos partidos, cobros y nivel, ya lo tiene en su Perfil): el acta en directo,
       * desde su móvil, durante el partido. «Empezar el partido», tocar a quien marca en cada gol (el marcador se ve en
       * directo en konamigas.com y a Konamigas le llega cada gol) y «Terminar y cerrar el acta», que la cierra de verdad
       * en Ligas (ligasActa). Lo que va en directo se guarda en lo compartido (comun().directo), mientras se juega.
       */
      function directo(id) { var c = comun(); return (c.directo || {})[id] || null; }
      /**
       * T0419 · Las reclamaciones del acta que le llegan a un árbitro (las de los partidos que pitó; yo '': todas, para quien
       * administra; null, mientras se sabe quién es: ninguna), las pendientes primero.
       */
      function reclamacionesArbitro(yo) {
        if (yo === null || yo === undefined) return [];
        return todasIncidencias().filter(function (y) { return y.x.para === 'arbitro' && (!yo || String(y.x.arbitro) === String(yo)); });
      }
      function htmlReclamaciones(yo) {
        var l = reclamacionesArbitro(ctx.admin ? '' : yo), pend = l.filter(function (y) { return y.x.estado !== 'Resuelta'; });
        if (!l.length) return '';
        var hechas = l.length - pend.length;
        return '<h3 class="n-grupo">Reclamaciones <span class="u-cifra">' + pend.length + '</span></h3>' +
          (pend.length ? '<p class="u-nota">Lo que reclaman las capitanas del acta de tus partidos. Ábrela, corrige lo que haga falta y guárdala: las jugadoras de los dos equipos lo ven en Novedades.</p><ul class="mq-incs">' + pend.map(function (y) {
            var x = y.x, p = D.ixPar[x.partido];
            return '<li class="mq-inc"><div class="mq-inc-cab"><b>' + texto(equipo(y.ie)) + ' · ' + texto(x.tipo) + '</b><span class="lg-pav ' + (CHIP_INC[x.estado] || '') + '">' + texto(x.estado) + '</span></div>' +
              (p ? '<small>' + texto(fechaDia(p.FECHA) + ' · ' + equipo(p.ID_INSCRIPCION_LOCAL) + ' ' + (conResultado(p) ? p.GOLES_LOCAL + '–' + p.GOLES_VISITANTE : '–') + ' ' + equipo(p.ID_INSCRIPCION_VISITANTE)) + '</small>' : '') +
              '<p>' + texto(x.texto) + '</p><div class="n-botones">' + (p ? '<button type="button" class="u-btn u-btn-accion" data-mqarbrec="' + texto(y.ie) + '|' + texto(x.id) + '">Revisar el acta</button>' : '') + '</div></li>';
          }).join('') + '</ul>' : '') +
          (hechas ? '<p class="u-nota">' + plural(hechas, 'reclamación revisada', 'reclamaciones revisadas') + '.</p>' : '');
      }
      function minuto(d) { return d ? Math.max(1, Math.round((Date.now() - new Date(d.desde).getTime()) / 60000)) : 0; }
      function portalArbitro() {
        var yo = yoStaff();
        if (yo === null) return '<div class="kz-centro" role="status"><div class="u-carga"></div></div>';
        if (!yo && !ctx.admin) return '<p class="u-vacio">No tienes ficha de árbitro en STAFF: pídesela a Konamigas.</p>';
        if (M.arbActa) return actaArbitro(M.arbActa, yo);
        var mio = function (p) { return !yo || String(p.ID_ARBITRO_REAL || p.ID_ARBITRO || '') === String(yo); };
        var ps = partidosTemp().filter(function (p) { return mio(p) && p.ID_INSCRIPCION_LOCAL && p.ID_INSCRIPCION_VISITANTE; }).sort(function (a, b) { return orden(cuando(a), cuando(b)); });
        var hoyL = ps.filter(function (p) { return p.FECHA === D.h && ['Programado', 'Jugado'].indexOf(p.ESTADO) >= 0; });
        var cerrar = ps.filter(function (p) { return p.ESTADO === 'Programado' && p.FECHA < D.h; }).slice(-6).reverse();
        var tarjeta = function (p) {
          var d = directo(p.ID), res = conResultado(p);
          var chip = d ? '<span class="lg-pav mq-vivo">En directo · ' + d.gl + '–' + d.gv + '</span>' : res ? '<span class="lg-pav mq-ok">' + texto(p.GOLES_LOCAL + '–' + p.GOLES_VISITANTE) + '</span>' : p.FECHA < D.h ? '<span class="lg-pav lg-av-rec">Acta por cerrar</span>' : '';
          return '<button type="button" class="mq-arb-p" data-mqarb="' + texto(p.ID) + '"><span class="mq-arb-h"><b>' + texto(p.HORA || '--:--') + '</b><small>' + texto(campo(p.ID_CAMPO)) + '</small></span>' +
            '<span class="mq-arb-e"><b>' + texto(equipo(p.ID_INSCRIPCION_LOCAL)) + '</b><b>' + texto(equipo(p.ID_INSCRIPCION_VISITANTE)) + '</b><small>' + texto((p.FECHA === D.h ? 'Hoy' : fechaDia(p.FECHA)) + ' · ' + liga(p.ID_LIGA)) + '</small></span>' + chip + '</button>';
        };
        return franja('Lo nuevo para el árbitro: el acta en directo, desde el móvil, durante el partido') +
          '<div class="mq-hola"><h2>Hola, <span class="mq-pintada">' + texto(yo ? staff(yo) : 'Konamigas') + '</span></h2><p class="u-nota">Tus partidos de hoy: tócalo al empezar, marca cada gol tocando a quien marca y, al pitar el final, cierra el acta. Lo demás (próximos, cobros, nivel) sigue en tu Perfil.</p></div>' +
          htmlReclamaciones(yo) +
          '<h3 class="n-grupo">Hoy <span class="u-cifra">' + hoyL.length + '</span></h3>' + (hoyL.length ? '<div class="mq-arb-lista">' + hoyL.map(tarjeta).join('') + '</div>' : '<p class="u-vacio">Hoy no arbitras ningún partido.</p>') +
          (cerrar.length ? '<h3 class="n-grupo">Actas por cerrar <span class="u-cifra">' + cerrar.length + '</span></h3><div class="mq-arb-lista">' + cerrar.map(tarjeta).join('') + '</div>' : '');
      }

      /** Los goles del acta que se está cerrando: los ya apuntados en GOLES (si se jugó) o ninguno. [{ eq, ju, tipo }] */
      function golesActa(p) {
        M.arbGoles = M.arbGoles || {};
        var d = directo(p.ID);
        if (d) return (M.arbGoles[p.ID] = d.goles);
        if (!M.arbGoles[p.ID]) M.arbGoles[p.ID] = (D.GOLES || []).filter(function (g) { return String(g.ID_PARTIDO) === String(p.ID); }).map(function (g) {
          return { eq: String(g.ID_INSCRIPCION_EQUIPO), ju: String(g.ID_INSCRIPCION_JUGADORA || ''), tipo: g.ID_INSCRIPCION_JUGADORA ? '' : String(g.NOTAS || 'En propia') };
        });
        return M.arbGoles[p.ID];
      }
      function plantillas(p) {
        M.arbPlant = M.arbPlant || {};
        var faltan = [p.ID_INSCRIPCION_LOCAL, p.ID_INSCRIPCION_VISITANTE].filter(function (ie) { return !M.arbPlant[ie]; });
        if (faltan.length && !M.arbPidiendo && typeof ctx.llamar === 'function') {
          M.arbPidiendo = 1;
          ctx.llamar('ligasJugadoras', [faltan]).then(function (r) { Object.keys(r || {}).forEach(function (k) { M.arbPlant[k] = (r[k] || []).filter(function (j) { return j.ACTIVA !== false; }); }); M.arbPidiendo = 0; pintar(); },
            function () { faltan.forEach(function (k) { M.arbPlant[k] = []; }); M.arbPidiendo = 0; pintar(); });
        }
        return faltan.length ? null : M.arbPlant;
      }
      function actaArbitro(id, yo) {
        var p = D.ixPar[id];
        if (!p) { M.arbActa = ''; return portalArbitro(); }
        var L = String(p.ID_INSCRIPCION_LOCAL), V = String(p.ID_INSCRIPCION_VISITANTE), gs = golesActa(p), pl = plantillas(p);
        var n = function (eq) { return gs.filter(function (g) { return g.eq === eq; }).length; };
        var rec = M.arbRec && M.arbRec.partido === String(p.ID) ? incidencia(M.arbRec.ie, M.arbRec.id) : null;
        var h = '<p class="mq-volver"><button type="button" class="u-btn u-btn-texto" data-mqarbvolver>‹ Mis partidos</button></p>' +
          // T0419: la reclamación que se está revisando, encima del acta.
          (rec ? '<div class="mq-aviso mq-arb-rec"><b>' + texto(equipo(rec.ie) + ' reclama: ' + rec.tipo) + '</b><p>' + texto(rec.texto) + '</p><p class="u-nota">Cambia lo que haga falta (toca a quien marcó; «−» lo quita) y guarda el acta. Si está bien, dilo sin cambiar nada.</p>' +
            '<div class="n-botones"><button type="button" class="u-btn" data-mqarbbien>Está bien como está</button></div></div>' : '') +
          '<div class="mq-arb-cab"><p class="u-nota">' + texto(fechaDia(p.FECHA) + ' · ' + (p.HORA || '') + ' · ' + campo(p.ID_CAMPO) + ' · ' + liga(p.ID_LIGA) + (p.JORNADA ? ' · J' + p.JORNADA : '')) + '</p>' +
          '<div class="mq-arb-marcador"><span>' + texto(equipo(L)) + '</span><b class="u-cifra">' + n(L) + '<i>–</i>' + n(V) + '</b><span>' + texto(equipo(V)) + '</span></div>' +
          (directo(p.ID) ? '<p class="mq-arb-vivo"><span class="mq-vivo">En directo</span> Minuto ' + minuto(directo(p.ID)) + ' · cada gol se ve al momento en konamigas.com</p>' : '') +
          (p.FECHA > D.h ? '<p class="mq-aviso">Es del ' + texto(fechaDia(p.FECHA)) + ': el acta se cierra el día del partido.</p>' : '') + '</div>';
        if (!pl) return h + '<div class="kz-centro" role="status"><div class="u-carga"></div><p class="u-nota">Leyendo las plantillas…</p></div>';
        if (M.arbRec && M.arbRec.partido === String(p.ID) && M.arbRec.marcan === null) M.arbRec.marcan = marcanActa(p, gs); // cómo estaba, antes de tocar nada
        var columna = function (eq) {
          var cuenta = {};
          gs.forEach(function (g) { if (g.eq === eq) cuenta[g.ju || 'propia'] = (cuenta[g.ju || 'propia'] || 0) + 1; });
          return '<section class="mq-arb-eq"><h3>' + texto(equipo(eq)) + '</h3><p class="u-nota">Toca a quien marca; «−» lo quita.</p><ul>' + (pl[eq] || []).map(function (j) {
            var c = cuenta[j.ID] || 0;
            return '<li><button type="button" class="mq-arb-j' + (c ? ' mq-arb-marco' : '') + '" data-mqgol="' + texto(eq) + '|' + texto(j.ID) + '"><span class="mq-arb-d">' + texto(j.DORSAL || '·') + '</span><span>' + texto(j.NOMBRE) + '</span>' +
              (c ? '<b class="mq-arb-n">' + '⚽'.repeat(Math.min(c, 5)) + '</b>' : '') + '</button>' + (c ? '<button type="button" class="u-btn u-btn-icono" data-mqgolmenos="' + texto(eq) + '|' + texto(j.ID) + '" aria-label="Quitar un gol">−</button>' : '') + '</li>';
          }).join('') + '<li><button type="button" class="mq-arb-j mq-arb-propia' + (cuenta.propia ? ' mq-arb-marco' : '') + '" data-mqgol="' + texto(eq) + '|"><span class="mq-arb-d">⚽</span><span>Gol en propia del rival</span>' +
            (cuenta.propia ? '<b class="mq-arb-n">' + cuenta.propia + '</b>' : '') + '</button>' + (cuenta.propia ? '<button type="button" class="u-btn u-btn-icono" data-mqgolmenos="' + texto(eq) + '|" aria-label="Quitar un gol">−</button>' : '') + '</li></ul>' +
            (!(pl[eq] || []).length ? '<p class="u-vacio">Este equipo no tiene plantilla apuntada.</p>' : '') + '</section>';
        };
        return h + '<div class="mq-arb-eqs">' + columna(L) + columna(V) + '</div>' +
          '<div class="n-botones mq-arb-pie">' + (p.FECHA === D.h && p.ESTADO === 'Programado' && !directo(p.ID) ? '<button type="button" class="u-btn u-btn-accion" data-mqarbempezar>Empezar el partido</button>' : '') +
          // T0366: el partido de hoy sin empezar, sin «Cerrar el acta» (salía con un 0–0 antes de jugar).
          (p.FECHA === D.h && p.ESTADO === 'Programado' && !directo(p.ID) ? '' : '<button type="button" class="u-btn' + (directo(p.ID) || p.FECHA < D.h || rec ? ' u-btn-accion' : '') + '" data-mqarbcerrar' + (p.FECHA > D.h ? ' disabled' : '') + '>' + (directo(p.ID) ? 'Terminar y cerrar el acta' : p.ESTADO === 'Jugado' ? 'Guardar el acta' : 'Cerrar el acta') + ' (' + n(L) + '–' + n(V) + ')</button>') +
          '</div><p class="mq-arb-mas">' + (p.FECHA > D.h ? '' : '<button type="button" class="u-btn u-btn-texto" data-mqarbestado="Suspendido">Se suspendió</button>' +
          '<button type="button" class="u-btn u-btn-texto" data-mqarbestado="Anulado">No se presentó un equipo</button>') +
          '<button type="button" class="u-btn u-btn-texto" data-mqenligas="' + texto(p.ID) + '">Su ficha en Ligas ›</button></p>';
      }
      function cerrarActaArbitro(b) {
        var p = D.ixPar[M.arbActa], gs = golesActa(p), L = String(p.ID_INSCRIPCION_LOCAL), V = String(p.ID_INSCRIPCION_VISITANTE);
        var acta = { GOLES_LOCAL: gs.filter(function (g) { return g.eq === L; }).length, GOLES_VISITANTE: gs.filter(function (g) { return g.eq === V; }).length,
          goles: gs.map(function (g) { return { ID_INSCRIPCION_EQUIPO: g.eq, ID_INSCRIPCION_JUGADORA: g.ju, TIPO: g.ju ? '' : 'En propia' }; }) };
        b.disabled = true;
        ctx.llamar('ligasActa', [p.ID, acta]).then(function () { return T.refrescar ? T.refrescar(['PARTIDOS', 'GOLES']) : null; }).then(function () {
          ctx.aviso('Acta cerrada: ' + equipo(L) + ' ' + acta.GOLES_LOCAL + '–' + acta.GOLES_VISITANTE + ' ' + equipo(V) + '. Ya sale en Competiciones.');
          delete M.arbGoles[p.ID];
          if (comun().directo && comun().directo[p.ID]) { delete comun().directo[p.ID]; guardarComun(); }
          var rec = M.arbRec && M.arbRec.partido === String(p.ID) ? M.arbRec : null;
          if (rec) resolverReclamacion(rec, p, acta, gs);
          else avisarSim({ a: 'app', titulo: 'Final: ' + equipo(L) + ' ' + acta.GOLES_LOCAL + '–' + acta.GOLES_VISITANTE + ' ' + equipo(V), texto: 'Acta cerrada por ' + (staff(yoStaff()) || 'el árbitro') + ': ya está en Ligas.' });
          M.arbActa = ''; firma = ''; pintar();
        }, function (e) { b.disabled = false; ctx.aviso(String(e && e.message || e).replace(/^\w+:\s*/, '')); });
      }
      /** «Laura Gómez» → «Laura G.»: lo que ven las jugadoras de quien marca. */
      function nombreCorto(n) { var x = String(n || '').trim().split(/\s+/); return x[0] + (x[1] ? ' ' + x[1].charAt(0) + '.' : ''); }
      /** Quién marcó en un acta, por equipo: «Laura G. (2) y Ana P. (Las Tigres); en propia (Las Leonas)». */
      function marcanActa(p, gs) {
        var pl = M.arbPlant || {};
        return [String(p.ID_INSCRIPCION_LOCAL), String(p.ID_INSCRIPCION_VISITANTE)].map(function (eq) {
          var c = {}, orden_ = [];
          gs.filter(function (g) { return g.eq === eq; }).forEach(function (g) {
            var n = g.ju ? nombreCorto(((pl[eq] || []).filter(function (j) { return String(j.ID) === String(g.ju); })[0] || {}).NOMBRE || '?') : 'en propia';
            if (!c[n]) orden_.push(n);
            c[n] = (c[n] || 0) + 1;
          });
          var l = orden_.map(function (n) { return n + (c[n] > 1 ? ' (' + c[n] + ')' : ''); });
          return l.length ? (l.length > 1 ? l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1] : l[0]) + ' (' + equipo(eq) + ')' : '';
        }).filter(Boolean).join('; ');
      }
      /** T0419 · Abre el acta de una reclamación: la marca vista por el árbitro y guarda cómo estaba, para saber qué corrige. */
      function abrirReclamacion(ie, id) {
        var x = incidencia(ie, id), p = x && D.ixPar[x.partido];
        if (!p) return;
        M.arbActa = String(p.ID);
        if (M.arbGoles) delete M.arbGoles[p.ID]; // el acta, como está guardada
        M.arbRec = { ie: ie, id: id, partido: String(p.ID), gl: String(p.GOLES_LOCAL), gv: String(p.GOLES_VISITANTE), marcan: null };
        if (x.estado === 'Enviada') {
          cambiarIncidencia(ie, id, { estado: 'Vista por el árbitro' });
          guardarComun();
          avisarSim({ a: 'web', titulo: 'El árbitro está revisando la reclamación de ' + equipo(ie), texto: x.tipo });
        }
        window.scrollTo(0, 0);
        pintar();
      }
      /**
       * T0419 · El árbitro ha guardado el acta de una reclamación (o dice que está bien, sin acta): la resuelve con lo que ha
       * cambiado y, si ha corregido algo, las jugadoras de los dos equipos lo ven en Novedades (la misma que la del resultado
       * nuevo, que la sustituye: prio 1); si no, la capitana ve que se ha revisado.
       */
      function resolverReclamacion(rec, p, acta, gs) {
        var x = incidencia(rec.ie, rec.id);
        if (!x) { M.arbRec = null; return; }
        var L = String(p.ID_INSCRIPCION_LOCAL), V = String(p.ID_INSCRIPCION_VISITANTE);
        var marcan = acta ? marcanActa(p, gs) : '';
        var cambiaRes = !!acta && (String(acta.GOLES_LOCAL) !== rec.gl || String(acta.GOLES_VISITANTE) !== rec.gv);
        var cambia = !!acta && (cambiaRes || marcan !== rec.marcan);
        var res = acta ? equipo(L) + ' ' + acta.GOLES_LOCAL + '–' + acta.GOLES_VISITANTE + ' ' + equipo(V) : '';
        var resp = cambia ? 'Corregido en el acta: ' + res + (marcan ? '. Goles: ' + marcan : '') : 'Revisado: el acta se queda como estaba.';
        cambiarIncidencia(rec.ie, rec.id, { estado: 'Resuelta', respuesta: resp });
        if (cambia) {
          var nuevo = Object.assign({}, p, { ESTADO: 'Jugado', GOLES_LOCAL: acta.GOLES_LOCAL, GOLES_VISITANTE: acta.GOLES_VISITANTE });
          novedad([L, V], 'El árbitro ha corregido el acta', res + ' · ' + fechaDia(p.FECHA) + ', lo reclamó ' + equipo(rec.ie) + (marcan ? '. Goles: ' + marcan : ''),
            cambiaRes ? 'p-' + p.ID + '-' + instantanea([nuevo])[p.ID] : '', 1);
        } else novedad([rec.ie], 'El árbitro ha revisado tu reclamación', x.tipo + ': el acta se queda como estaba.');
        guardarComun();
        avisarSim({ a: 'web', titulo: 'Respuesta del árbitro a ' + equipo(rec.ie), texto: resp });
        ctx.aviso(cambia ? 'Acta corregida: las jugadoras de los dos equipos lo ven en Novedades' : 'Reclamación revisada: la capitana lo ve en su área');
        M.arbRec = null;
      }
      function estadoArbitro(estado) {
        var p = D.ixPar[M.arbActa], L = p.ID_INSCRIPCION_LOCAL, V = p.ID_INSCRIPCION_VISITANTE;
        ventana('<h2>' + (estado === 'Suspendido' ? 'Se suspendió' : 'Un equipo no se presentó') + '</h2><p class="u-nota">' + texto(equipo(L) + ' – ' + equipo(V)) + '</p><div class="u-campos">' +
          (estado === 'Anulado' ? '<label class="u-campo u-ancho"><span class="u-etiqueta">Qué equipo no vino</span><select data-k="eq"><option value="' + texto(L) + '">' + texto(equipo(L)) + '</option><option value="' + texto(V) + '">' + texto(equipo(V)) + '</option></select></label>'
            : '<label class="u-campo u-ancho"><span class="u-etiqueta">Por qué</span><select data-k="m"><option>Lluvia</option><option>Lesión</option><option>Pista en mal estado</option><option>Otro</option></select></label>') +
          '</div><p class="u-nota">' + (estado === 'Anulado' ? 'Pierde el partido y se le apunta sola su sanción, como dice la normativa.' : 'Se vuelve a jugar otro día: lo programa Konamigas.') + '</p>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-guardar>Guardar</button><button type="button" class="u-btn" data-cerrar>Cancelar</button></div>', function (b, v) {
          if (!b.hasAttribute('data-guardar')) return;
          var val = function (k) { var x = v.querySelector('[data-k=' + k + ']'); return x ? x.value : ''; };
          var c = estado === 'Anulado' ? { ESTADO: 'Anulado', ANULADO_POR: val('eq'), MOTIVO: 'No presentado' } : { ESTADO: 'Suspendido', MOTIVO: val('m') };
          b.disabled = true;
          ctx.llamar('ligasPartido', [p.ID, c]).then(function () { return T.refrescar ? T.refrescar(['PARTIDOS', 'GOLES', 'SANCIONES']) : null; }).then(function () {
            v.remove(); ctx.aviso('Guardado: ' + (estado === 'Anulado' ? equipo(c.ANULADO_POR) + ' no se presentó' : 'suspendido (' + c.MOTIVO + ')') + '.'); M.arbActa = ''; firma = ''; pintar();
          }, function (e) { b.disabled = false; ctx.aviso(String(e && e.message || e).replace(/^\w+:\s*/, '')); });
        });
      }

      /* ======================= Jornadas temáticas y avisos a las jugadoras ======================= */
      // Lo que se decide en Redes sociales (las jornadas, sus avisos y sus tareas) lo ve konamigas.com: se guarda en
      // window.MQ_COMUN (la misma página, en el móvil) y en este navegador (el modo local, que son dos páginas).

      // Se guarda en el motor de la maqueta (maquetaComun, la memoria del modo local o de la copia del móvil): así lo
      // comparten konamigas.com y la plataforma, también a la vez en el simulador. Hasta leerlo, no se propone ni se guarda nada.
      function comun() { return window.MQ_COMUN || (window.MQ_COMUN = { v: 1, avisos: null, tareas: {}, propias: [], incidencias: {} }); }
      // T0419: el motor lo junta con lo que haya guardado la otra pantalla (las incidencias y las novedades no se pisan) y
      // devuelve lo junto, que pasa a ser lo de esta.
      function guardarComun() {
        if (!window.MQ_COMUN_LEIDO) return Promise.resolve();
        return llamarPublica('maquetaComunGuardar', [comun()]).then(function (r) {
          if (!r || r.v !== 1) return;
          var n = comun();
          Object.keys(n).forEach(function (k) { delete n[k]; });
          Object.assign(n, r);
          n.incidencias = n.incidencias || {};
        }, function (e) { ctx.aviso(String(e && e.message || e)); });
      }
      /** Una incidencia por su id (lo compartido se rehace al guardar: no vale quedarse con la de antes). */
      function incidencia(ie, id) { return ((comun().incidencias || {})[ie] || []).filter(function (x) { return x.id === id; })[0] || null; }
      /** Cambia una incidencia, con cuándo (al juntar lo de las dos pantallas, gana el último cambio). */
      function cambiarIncidencia(ie, id, cambios) {
        var x = incidencia(ie, id);
        if (x) Object.assign(x, cambios, { cambio: new Date().toISOString() });
        return x;
      }
      function partidosTemp() { return D.PARTIDOS.filter(function (p) { return D.tempDeLiga(p.ID_LIGA) === String(D.temp.ID); }); }
      function listaTematicas() {
        return tematicas(D.temp, partidosTemp()).concat(comun().propias).sort(function (a, b) { return orden(a.desde, b.desde); });
      }
      function tematica(id) { return listaTematicas().filter(function (t) { return t.id === id; })[0] || null; }
      function partidosDe(t) { return partidosTemp().filter(function (p) { return p.FECHA >= t.desde && p.FECHA <= t.hasta && p.ESTADO !== 'Anulado'; }); }
      function textoAviso(t) {
        return 'Del ' + fechaCorta(t.desde) + ' al ' + fechaCorta(t.hasta) + ' es la semana de ' + t.nombre + ': ' + t.lema + (/[.!?…]$/.test(t.lema) ? '' : '.') + ' Habrá fotógrafo en todos los partidos y premio al mejor disfraz de equipo.';
      }
      function avisoDeTema(t, publicado) { return { id: 'tema-' + t.id, tema: t.id, titulo: t.emoji + ' Semana de ' + t.nombre, texto: textoAviso(t), hasta: t.hasta, liga: '', publicado: !!publicado }; }
      /** Los avisos a las jugadoras: al principio, uno por jornada temática, con el de la próxima ya publicado. */
      function avisos() {
        var c = comun();
        if (!window.MQ_COMUN_LEIDO) return c.avisos || [];
        if (!c.avisos) {
          var ts = listaTematicas(), prox = ts.filter(function (t) { return t.hasta >= D.h; })[0];
          c.avisos = ts.map(function (t) { return avisoDeTema(t, prox && prox.id === t.id); });
          guardarComun();
        }
        return c.avisos;
      }
      /** Los que ve una jugadora en konamigas.com: publicados, sin caducar y de todas o de una de sus ligas. */
      function avisosVisibles(ligas) {
        return avisos().filter(function (a) { return a.publicado && String(a.hasta || '9999') >= D.h && (!a.liga || (ligas || []).indexOf(String(a.liga)) >= 0); });
      }
      function htmlAvisos(l) {
        if (!l.length) return '';
        return '<section class="mqw-avisos" aria-label="Avisos de Konamigas">' + l.map(function (a) {
          var t = a.tema ? tematica(a.tema) : null;
          return '<article class="mqw-av' + (t ? ' mq-tema-' + texto(t.id) : '') + '"><b>' + texto(a.titulo) + '</b><p>' + texto(a.texto) + '</p>' +
            (a.liga ? '<small>' + texto(liga(a.liga)) + '</small>' : '') + '</article>';
        }).join('') + '</section>';
      }

      function estadoTema(t) {
        if (t.hasta < D.h) return ['Pasada', ''];
        if (t.desde <= D.h) return ['Esta semana', 'lg-av-si'];
        var n = Math.round((deIso(t.desde) - deIso(D.h)) / 864e5);
        return ['Dentro de ' + plural(n, 'día', 'días'), 'lg-av-rec'];
      }
      function pestanaTematicas() {
        var c = comun(), ts = listaTematicas();
        var h = '<p class="u-nota">Las semanas especiales, en las que las jugadoras vienen disfrazadas. Cada una lleva su aviso en konamigas.com, sus tareas y su plantilla. Salen solas del calendario de la temporada; se pueden añadir más.</p>' +
          '<div class="n-botones mq-botones"><button type="button" class="u-btn u-btn-accion" data-mqtnueva>Nueva jornada temática</button></div>';
        if (!ts.length) return h + '<p class="u-vacio">Esta temporada aún no tiene jornadas temáticas.</p>';
        return h + '<div class="mq-temas">' + ts.map(function (t) {
          var e = estadoTema(t), ps = partidosDe(t), av = avisos().filter(function (a) { return a.tema === t.id; })[0];
          var hechas = c.tareas[t.id] || [], tareas = tareasTematica(t, ps, campo);
          var dias = {}; ps.forEach(function (p) { dias[p.FECHA] = 1; });
          return '<article class="mq-tema mq-tema-' + texto(t.id) + '"><header class="mq-tema-cab"><span class="mq-tema-emoji" aria-hidden="true">' + texto(t.emoji) + '</span>' +
            '<div><h3>' + texto(t.nombre) + '</h3><p>' + texto(fechaDia(t.desde) + ' – ' + fechaDia(t.hasta)) + ' · ' + plural(ps.length, 'partido', 'partidos') + (ps.length ? ' en ' + plural(Object.keys(dias).length, 'día', 'días') : '') + '</p></div>' +
            '<span class="lg-pav ' + e[1] + '">' + texto(e[0]) + '</span></header>' +
            '<div class="mq-tema-partes">' +
            '<section><h4>Aviso a las jugadoras</h4><p class="u-nota">' + texto(av ? av.texto : textoAviso(t)) + '</p>' +
              '<p>' + (av && av.publicado ? '<span class="lg-pav mq-ok">En konamigas.com</span>' : '<span class="lg-pav">Sin publicar</span>') + '</p>' +
              '<div class="n-botones"><button type="button" class="u-btn" data-mqtaviso="' + texto(t.id) + '">' + (av && av.publicado ? 'Quitar de la web' : 'Publicar en la web') + '</button>' +
              '<button type="button" class="u-btn u-btn-texto" data-mqp="avisos">Editar ›</button></div></section>' +
            '<section><h4>Tareas</h4><ul class="mq-tema-tareas">' + tareas.map(function (x, i) {
              var id = hechas[i];
              return '<li><span>' + (id ? '✔' : '○') + '</span><span><b>' + texto(x.titulo) + '</b><small>Antes del ' + texto(fechaCorta(x.deadline)) + (id ? ' · ' + texto(id) + ' en Tareas' : '') + '</small></span></li>';
            }).join('') + '</ul>' +
              (hechas.length ? '<p class="u-nota">Ya están en Tareas, con su fecha límite.</p>' : '<div class="n-botones"><button type="button" class="u-btn" data-mqttareas="' + texto(t.id) + '">Crear las tareas en Tareas</button></div>') + '</section>' +
            '<section><h4>Plantilla</h4><div class="mq-post mq-post-mini mq-post-tema-' + texto(t.id) + '"><p class="mq-post-marca">KONAMIGAS</p><p class="mq-post-grande">' + texto(t.nombre) + '</p><p class="mq-post-deco" aria-hidden="true">' + texto(t.emoji + t.emoji + t.emoji) + '</p></div>' +
              '<div class="n-botones"><button type="button" class="u-btn" data-mqtplantilla="' + texto(t.id) + '">Crear publicación ›</button></div></section>' +
            '</div></article>';
        }).join('') + '</div>';
      }

      function pestanaAvisos() {
        var l = avisos(), ligas = D.LIGAS.filter(function (x) { return D.tempDeLiga(x.ID) === String(D.temp.ID); });
        var vistos = avisosVisibles(ligas.map(function (x) { return String(x.ID); }));
        var h = '<p class="u-nota">Lo que ven todas las jugadoras al entrar en konamigas.com (o solo las de una liga): jornadas temáticas, cambios, lo que sea. Sale arriba, en el inicio, en cada competición y en su área.</p>' +
          '<div class="n-botones mq-botones"><button type="button" class="u-btn u-btn-accion" data-mqavnuevo>Nuevo aviso</button></div>';
        h += l.length ? '<ul class="mq-avisos">' + l.map(function (a, i) {
          return '<li class="mq-av-ed"><div class="u-campos">' +
            '<label class="u-campo u-ancho"><span class="u-etiqueta">Título</span><input data-mqav="' + i + '" data-k="titulo" value="' + texto(a.titulo) + '"></label>' +
            '<label class="u-campo u-ancho"><span class="u-etiqueta">Texto</span><textarea rows="3" data-mqav="' + i + '" data-k="texto">' + texto(a.texto) + '</textarea></label>' +
            '<label class="u-campo"><span class="u-etiqueta">Para</span><select data-mqav="' + i + '" data-k="liga"><option value="">Todas las jugadoras</option>' + ligas.map(function (x) {
              return '<option value="' + texto(x.ID) + '"' + (String(a.liga) === String(x.ID) ? ' selected' : '') + '>' + texto(liga(x.ID)) + '</option>';
            }).join('') + '</select></label>' +
            '<label class="u-campo"><span class="u-etiqueta">Se ve hasta</span><input type="date" data-mqav="' + i + '" data-k="hasta" value="' + texto(a.hasta || '') + '"></label></div>' +
            '<div class="n-botones"><label class="u-check"><input type="checkbox" data-mqav="' + i + '" data-k="publicado"' + (a.publicado ? ' checked' : '') + '> Publicado en konamigas.com</label>' +
            (a.tema ? '' : '<button type="button" class="u-btn u-btn-texto" data-mqavborrar="' + i + '">Borrar</button>') + '</div></li>';
        }).join('') + '</ul>' : '<p class="u-vacio">No hay avisos.</p>';
        return h + '<h3 class="n-grupo">Así lo ven ahora en konamigas.com</h3>' + (htmlAvisos(vistos) || '<p class="u-vacio">Ahora mismo no se ve ningún aviso.</p>');
      }

      function nuevaTematica() {
        ventana('<h2>Nueva jornada temática</h2><div class="u-campos">' +
          '<label class="u-campo u-ancho"><span class="u-etiqueta">Nombre</span><input data-k="nombre" placeholder="Mundial, Orgullo, Aniversario…"></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Emoji</span><input data-k="emoji" value="🎉" maxlength="4"></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Semana del</span><input type="date" data-k="desde" value="' + texto(sumarDias(D.h, 14)) + '"></label>' +
          '<label class="u-campo u-ancho"><span class="u-etiqueta">Qué se pide a las jugadoras</span><input data-k="lema" value="¡ven disfrazada!"></label></div>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-guardar>Añadir</button><button type="button" class="u-btn" data-cerrar>Cancelar</button></div>', function (b, v) {
          if (!b.hasAttribute('data-guardar')) return;
          var val = function (k) { return String(v.querySelector('[data-k=' + k + ']').value || '').trim(); };
          if (!val('nombre') || !val('desde')) return ctx.aviso('Falta el nombre o la semana');
          var d = lunes(val('desde')), t = { id: 'p' + Date.now().toString(36), nombre: val('nombre'), emoji: val('emoji') || '🎉', lema: val('lema') || '¡ven disfrazada!', desde: d, hasta: sumarDias(d, 6), propia: true };
          comun().propias.push(t);
          avisos().push(avisoDeTema(t, false));
          guardarComun();
          v.remove();
          ctx.aviso('Jornada añadida (en la maqueta, solo en este navegador)');
          pintar();
        });
      }

      /** Las tareas de una jornada, en Tareas de verdad (el kanban de la plataforma, en la memoria de la maqueta). */
      function crearTareas(id, b) {
        var t = tematica(id);
        if (!t) return;
        var lista = tareasTematica(t, partidosDe(t), campo), ids = [];
        var guardar = function () { comun().tareas[id] = ids; guardarComun(); pintar(); };
        if (typeof ctx.llamar !== 'function') { lista.forEach(function (x, i) { ids.push('Tarea ' + (i + 1)); }); ctx.aviso('Se crearían ' + lista.length + ' tareas en Tareas'); return guardar(); }
        b.disabled = true;
        ctx.llamar('kanbanOpciones').then(function (o) { return o || {}; }, function () { return {}; }).then(function (o) {
          // Lo obligatorio de una tarea, con los valores que da el propio Tareas: épica de redes, prioridad y tamaño
          // de en medio y, como responsable, quien ha entrado (o la primera persona, si no se le pueden asignar).
          var col = function (n) { return (o.columnas || []).filter(function (c) { return c.nombre === n; })[0] || {}; };
          var valor = function (n, quiero) { var v = col(n).valores || []; return v.indexOf(quiero) >= 0 ? quiero : v[Math.floor(v.length / 2)] || quiero; };
          var personas = o.personas || [], yo = personas.indexOf(o.yo) >= 0 ? o.yo : personas[0] || '';
          return lista.reduce(function (p, x) {
            return p.then(function () {
              var d = { TITULO: corto(x.titulo), SOLICITUD: x.texto, EPICA: 'REDES SOCIALES', P: valor('P', '!'), T: valor('T', 'S'), DEADLINE: x.deadline };
              if (yo) d.ASIGNADO = yo;
              return ctx.llamar('kanbanCrear', [d]).then(function (r) { ids.push(r && r.id || '?'); });
            });
          }, Promise.resolve());
        }).then(function () { ctx.aviso(plural(ids.length, 'tarea creada', 'tareas creadas') + ' en Tareas (en la maqueta: hasta recargar)'); guardar(); },
          function (e) { b.disabled = false; ctx.aviso('No se han podido crear: ' + String(e && e.message || e)); });
      }

      /* ======================= Redes sociales ======================= */

      function idDrive(url) { var m = /\/d\/([\w-]{10,})|[?&]id=([\w-]{10,})/.exec(String(url || '')); return m ? m[1] || m[2] : ''; }
      function htmlFoto(f) {
        var id = idDrive(f.ARCHIVO_URL), j = D.ixJug[f.ID_JUGADORA], sel = M.foto.indexOf(f.ID) >= 0;
        return '<button type="button" class="mq-foto' + (sel ? ' mq-foto-sel' : '') + '" data-mqfoto="' + texto(f.ID) + '" aria-pressed="' + sel + '"><span class="mq-foto-img"' + (id ? ' data-drive="' + texto(id) + '"' : '') + '>' +
          '<span class="mq-foto-ini">' + texto((j && j.NOMBRE || '?').charAt(0)) + '</span></span><span class="mq-foto-pie">' + texto(j ? nombrePublico(j) : f.NOMBRE_ORIGINAL || f.ID) + '</span>' +
          (f.PUBLICABLE === true ? '<span class="mq-foto-ok">Se puede publicar</span>' : '<span class="mq-foto-no">Sin permiso</span>') + '</button>';
      }
      /** Las miniaturas de Drive, si quien mira puede verlas; si no, se queda la inicial. */
      function cargarFotos() {
        el.querySelectorAll('[data-drive]').forEach(function (s) {
          var im = new Image();
          im.onload = function () { s.style.backgroundImage = 'url("' + im.src + '")'; s.classList.add('mq-foto-cargada'); };
          im.src = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(s.getAttribute('data-drive')) + '&sz=w400';
        });
      }

      function redes() {
        var fotosTemp = D.FOTOS.filter(function (f) { return !f.ID_TEMPORADA || String(f.ID_TEMPORADA) === String(D.temp.ID); });
        var publicables = fotosTemp.filter(function (f) { return f.PUBLICABLE === true; });
        var h = franja('Así será la sección Redes sociales para los socios') +
          cifras([[fotosTemp.length, 'fotos esta temporada'], [publicables.length, 'se pueden publicar'], [M.publicadas.length, 'publicadas desde aquí'], ['IG · TikTok', 'redes conectadas']]);
        var lista = [['calendario', 'Calendario'], ['tematicas', 'Jornadas temáticas'], ['avisos', 'Avisos a jugadoras'], ['crear', 'Crear publicación'], ['fotos', 'Fotos'], ['auto', 'Automático']], sel = elegida('redes', lista);
        h += pestanas('redes', lista) + '<div class="mq-cuerpo">';
        if (sel === 'calendario') h += calendarioRedes(true);
        else if (sel === 'tematicas') h += pestanaTematicas();
        else if (sel === 'avisos') h += pestanaAvisos();
        else if (sel === 'fotos') {
          var vistas = M.filtroFotos === 'publicables' && publicables.length ? publicables : fotosTemp;
          h += '<div class="u-filtros"><label class="u-check"><input type="radio" name="mqff" value="publicables"' + (M.filtroFotos === 'publicables' ? ' checked' : '') + ' data-mqff> Se pueden publicar</label>' +
            '<label class="u-check"><input type="radio" name="mqff" value="todas"' + (M.filtroFotos !== 'publicables' ? ' checked' : '') + ' data-mqff> Todas</label></div>' +
            '<p class="u-nota">Las fotos de JUGADORAS Y EQUIPOS. Se publica solo la de quien ha dado permiso (derechos de imagen). Toca las que quieras para una publicación.</p>' +
            (publicables.length ? '' : '<p class="mq-aviso">Aún no hay ninguna marcada como publicable: se marcarán en Gestión o las dará la jugadora desde su área. Mientras, se ven todas.</p>') +
            (vistas.length ? '<div class="mq-fotos">' + vistas.slice(0, 60).map(htmlFoto).join('') + '</div>' + (vistas.length > 60 ? '<p class="u-nota">Y ' + (vistas.length - 60) + ' más.</p>' : '') : '<p class="u-vacio">No hay fotos.</p>') +
            (M.foto.length ? '<div class="n-botones mq-botones"><button type="button" class="u-btn u-btn-accion" data-mqp="crear">Crear con ' + plural(M.foto.length, 'foto', 'fotos') + ' ›</button></div>' : '');
        } else if (sel === 'crear') h += crear();
        else h += automatico();
        return h + '</div>';
      }

      function calendarioRedes(hayFotos) {
        var base = M.mesRedes || D.h.slice(0, 7) + '-01', d0 = deIso(base), fin = iso(new Date(d0.getFullYear(), d0.getMonth() + 1, 0));
        var plan = planRedes(D.PARTIDOS.filter(function (p) { return D.tempDeLiga(p.ID_LIGA) === String(D.temp.ID); }), liga, base, fin, D.h, hayFotos)
          .concat(M.publicadas.filter(function (x) { return x.fecha >= base && x.fecha <= fin; }));
        var porDia = grupos(plan, 'fecha'), h = '<div class="mq-mes"><button type="button" class="u-btn u-btn-icono" data-mqmes="-1" aria-label="Mes anterior">‹</button><b>' +
          texto(MESES_LARGOS[d0.getMonth()] + ' ' + d0.getFullYear()) + '</b><button type="button" class="u-btn u-btn-icono" data-mqmes="1" aria-label="Mes siguiente">›</button></div>';
        h += '<div class="mq-cal"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>';
        for (var i = 0; i < (d0.getDay() + 6) % 7; i++) h += '<span></span>';
        var ts = listaTematicas(), temaDe = function (f) { return ts.filter(function (t) { return f >= t.desde && f <= t.hasta; })[0]; };
        for (var f = base; f <= fin; f = sumarDias(f, 1)) {
          var ps = porDia[f] || [], tm = temaDe(f);
          h += '<span class="mq-cal-d' + (f === D.h ? ' mq-cal-hoy' : '') + (tm ? ' mq-cal-tema mq-tema-' + texto(tm.id) : '') + '"' + (tm ? ' title="Semana de ' + texto(tm.nombre) + '"' : '') + '><b>' + deIso(f).getDate() + (tm ? ' ' + texto(tm.emoji) : '') + '</b>' + ps.slice(0, 3).map(function (x) { return '<i class="mq-cal-p mq-tipo-' + normal(x.tipo) + '" title="' + texto(x.titulo) + '"></i>'; }).join('') + '</span>';
        }
        h += '</div><p class="u-nota mq-leyenda"><i class="mq-cal-p mq-tipo-previa"></i> Previa <i class="mq-cal-p mq-tipo-resultados"></i> Resultados <i class="mq-cal-p mq-tipo-fotos"></i> Fotos <i class="mq-cal-p mq-tipo-jugadora"></i> Jugadora de la semana · con emoji, las jornadas temáticas</p>';
        var prox = plan.filter(function (x) { return x.fecha >= D.h; }).slice(0, 8);
        h += '<h3 class="n-grupo">Lo próximo <span class="u-cifra">' + prox.length + '</span></h3>' + (prox.length ? '<ul class="mq-posts">' + prox.map(function (x) {
          return '<li><span class="mq-post-f">' + texto(fechaCorta(x.fecha)) + '</span><span class="mq-post-t"><b>' + texto(x.titulo) + '</b><small>' + texto(x.redes.join(' · ') + (x.ligas.length ? ' · ' + x.ligas.slice(0, 3).join(', ') + (x.ligas.length > 3 ? '…' : '') : '')) +
            '</small></span><span class="lg-pav ' + (x.estado === 'Publicada' ? 'mq-ok' : x.estado === 'Programada' ? 'lg-av-rec' : 'lg-av-si') + '">' + texto(x.estado) + '</span>' +
            '<button type="button" class="u-btn" data-mqeditar="' + texto(x.tipo) + '">Editar</button></li>';
        }).join('') + '</ul>' : '<p class="u-vacio">Nada programado este mes.</p>');
        return h;
      }

      /** La última jornada jugada de una liga, para rellenar la plantilla: { fecha, partidos }. */
      function ultimaJornada(idLiga) {
        var ps = (D.parPorLiga[idLiga] || []).filter(conResultado).sort(function (a, b) { return orden(cuando(b), cuando(a)); });
        var f = ps[0] && ps[0].FECHA;
        return { fecha: f || '', partidos: ps.filter(function (p) { return p.FECHA === f; }) };
      }
      function proximaJornada(idLiga) {
        var ps = (D.parPorLiga[idLiga] || []).filter(function (p) { return p.ESTADO === 'Programado' && p.FECHA >= D.h; }).sort(function (a, b) { return orden(cuando(a), cuando(b)); });
        var f = ps[0] && ps[0].FECHA;
        return { fecha: f || '', partidos: ps.filter(function (p) { return p.FECHA === f; }) };
      }

      function crear() {
        var ligas = D.LIGAS.filter(function (l) { return D.tempDeLiga(l.ID) === String(D.temp.ID) && (D.parPorLiga[l.ID] || []).length; }).sort(function (a, b) { return orden(liga(a.ID), liga(b.ID)); });
        if (!M.ligaPost || !ligas.some(function (l) { return l.ID === M.ligaPost; })) M.ligaPost = (ligas.filter(function (l) { return ultimaJornada(l.ID).fecha; })[0] || ligas[0] || {}).ID || '';
        var pl = M.plantilla, h = '<div class="mq-crear"><div class="mq-crear-op"><div class="u-campos">' +
          '<label class="u-campo"><span class="u-etiqueta">Plantilla</span><select data-mqplantilla>' + ['Resultados', 'Previa', 'Fotos', 'Jugadora'].map(function (x) {
            return '<option value="' + x + '"' + (x === pl ? ' selected' : '') + '>' + { Resultados: 'Resultados de la jornada', Previa: 'Previa de la jornada', Fotos: 'Fotos de la jornada', Jugadora: 'Jugadora de la semana' }[x] + '</option>';
          }).join('') + '</select></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Formato</span><select data-mqformato><option value="cuadrado"' + (M.formato === 'cuadrado' ? ' selected' : '') + '>Instagram · publicación</option>' +
          '<option value="vertical"' + (M.formato === 'vertical' ? ' selected' : '') + '>Historia o TikTok</option></select></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Ocasión</span><select data-mqtema><option value="">Una jornada normal</option>' + listaTematicas().map(function (t) {
            return '<option value="' + texto(t.id) + '"' + (t.id === M.tema ? ' selected' : '') + '>' + texto(t.emoji + ' ' + t.nombre) + '</option>';
          }).join('') + '</select></label>' +
          '<label class="u-campo u-ancho"><span class="u-etiqueta">Liga</span><select data-mqligapost>' + ligas.map(function (l) {
            return '<option value="' + texto(l.ID) + '"' + (l.ID === M.ligaPost ? ' selected' : '') + '>' + texto(liga(l.ID)) + '</option>';
          }).join('') + '</select></label></div>';
        var post = contenidoPost(pl, M.ligaPost);
        h += '<label class="u-campo"><span class="u-etiqueta">Texto de la publicación</span><textarea rows="5">' + texto(post.texto) + '</textarea></label>' +
          '<p class="u-nota">Lo escribe solo con los datos de la liga y el estilo de Konamigas; se puede cambiar antes de publicar.</p>' +
          '<div class="u-filtros"><label class="u-check"><input type="checkbox" checked> Instagram</label><label class="u-check"><input type="checkbox"' + (M.formato === 'vertical' ? ' checked' : '') + '> TikTok</label></div>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-mqpublicar="ahora">Publicar ahora</button><button type="button" class="u-btn" data-mqpublicar="programar">Programar</button></div></div>' +
          '<div class="mq-crear-vista"><div class="mq-post mq-post-' + M.formato + (tematica(M.tema) ? ' mq-post-tema-' + texto(M.tema) : '') + '">' + post.html + '</div></div></div>';
        return h;
      }

      /** El contenido de una plantilla para una liga, con los datos de verdad: { html (la imagen), texto (el pie) }. */
      function contenidoPost(pl, idLiga) {
        var r = contenidoBase(pl, idLiga), t = tematica(M.tema);
        if (!t) return r;
        // La plantilla de la ocasión: su nombre y su emoji en la imagen, y su etiqueta en el texto.
        return { html: '<p class="mq-post-deco" aria-hidden="true">' + texto(t.emoji + ' ' + t.emoji + ' ' + t.emoji) + '</p>' + r.html.replace('<p class="mq-post-marca">KONAMIGAS</p>', '<p class="mq-post-marca">KONAMIGAS · ' + texto(t.nombre.toUpperCase()) + '</p>'),
          texto: t.emoji + ' Semana de ' + t.nombre + '\n' + r.texto + ' #' + t.nombre.replace(/\s+/g, '') + 'Konamigas' };
      }
      function contenidoBase(pl, idLiga) {
        var nl = liga(idLiga), etiq = '#Konamigas #FútbolFemenino #Barcelona';
        var res = function (p) { return '<li><span>' + texto(equipo(p.ID_INSCRIPCION_LOCAL)) + '</span><b>' + texto(p.GOLES_LOCAL) + '–' + texto(p.GOLES_VISITANTE) + '</b><span>' + texto(equipo(p.ID_INSCRIPCION_VISITANTE)) + '</span></li>'; };
        var vs = function (p) { return '<li><span>' + texto(equipo(p.ID_INSCRIPCION_LOCAL)) + '</span><b>' + texto(p.HORA || '') + '</b><span>' + texto(equipo(p.ID_INSCRIPCION_VISITANTE)) + '</span></li>'; };
        var cab = function (gr, peq) { return '<p class="mq-post-marca">KONAMIGAS</p><p class="mq-post-grande">' + texto(gr) + '</p><p class="mq-post-peq">' + texto(peq) + '</p>'; };
        if (pl === 'Previa') {
          var pj = proximaJornada(idLiga);
          return { html: cab('Previa', nl + (pj.fecha ? ' · ' + fechaDia(pj.fecha) : '')) + '<ul class="mq-post-lista">' + pj.partidos.slice(0, 6).map(vs).join('') + '</ul>',
            texto: '¡Vuelve ' + nl + '! ' + (pj.fecha ? fechaDia(pj.fecha) + ', ' : '') + plural(pj.partidos.length, 'partido', 'partidos') + ' y mucho fútbol. ¿Quién se lleva los tres puntos? 💪\n\n' + etiq };
        }
        if (pl === 'Fotos') {
          var pub = D.FOTOS.filter(function (f) { return f.PUBLICABLE === true; });
          var fs = M.foto.length ? M.foto : (pub.length ? pub : D.FOTOS).slice(-4).map(function (f) { return f.ID; });
          var ix = indice(D.FOTOS);
          return { html: cab('Fotos', nl) + '<div class="mq-post-fotos">' + fs.slice(0, 4).map(function (id) {
            var f = ix[id] || {}, d = idDrive(f.ARCHIVO_URL);
            return '<span class="mq-foto-img"' + (d ? ' data-drive="' + texto(d) + '"' : '') + '><span class="mq-foto-ini">' + texto(((D.ixJug[f.ID_JUGADORA] || {}).NOMBRE || '?').charAt(0)) + '</span></span>';
          }).join('') + '</div>', texto: 'Así se vivió la jornada en ' + nl + ' 📸 ¿Te encuentras? Etiquétate y etiqueta a tu equipo.\n\n' + etiq };
        }
        if (pl === 'Jugadora') {
          var j = D.ixJug[jugadoraDeLaSemana()], ij = (D.ijPorJug[(j || {}).ID] || [])[0] || {};
          return { html: cab('Jugadora de la semana', equipo(ij.ID_INSCRIPCION_EQUIPO)) + '<p class="mq-post-nombre">' + texto(nombrePublico(j)) + '</p>' +
            '<p class="mq-post-peq">' + plural((D.ijPorJug[(j || {}).ID] || []).length, 'temporada', 'temporadas') + ' en Konamigas</p>',
            texto: 'Nuestra jugadora de la semana es ' + nombrePublico(j) + ', de ' + equipo(ij.ID_INSCRIPCION_EQUIPO) + ' 🌟 ¡Enhorabuena!\n\n' + etiq };
        }
        var uj = ultimaJornada(idLiga);
        return { html: cab('Resultados', nl + (uj.fecha ? ' · ' + fechaDia(uj.fecha) : '')) + '<ul class="mq-post-lista">' + uj.partidos.slice(0, 6).map(res).join('') + '</ul>',
          texto: 'Resultados de ' + nl + (uj.fecha ? ' (' + fechaDia(uj.fecha).toLowerCase() + ')' : '') + ' ⚽\n' + uj.partidos.slice(0, 6).map(function (p) {
            return equipo(p.ID_INSCRIPCION_LOCAL) + ' ' + p.GOLES_LOCAL + '-' + p.GOLES_VISITANTE + ' ' + equipo(p.ID_INSCRIPCION_VISITANTE);
          }).join('\n') + '\n\n' + etiq };
      }

      function automatico() {
        var regla = function (k, t, sub) { return '<label class="u-check mq-regla"><input type="checkbox" data-mqauto="' + k + '"' + (M.auto[k] ? ' checked' : '') + '><span><b>' + texto(t) + '</b><small>' + texto(sub) + '</small></span></label>'; };
        return '<p class="u-nota">Lo que se prepara solo con los datos de las ligas. Cada publicación sale en el calendario como Programada.</p>' +
          regla('Resultados', 'Resultados de cada jornada', 'El día después de jugar, una imagen por liga con sus resultados. Instagram y TikTok.') +
          regla('Previa', 'Previa de la jornada', 'El día antes, los partidos y las horas.') +
          regla('Fotos', 'Fotos de la jornada', 'Un carrusel con las fotos que se pueden publicar de ese día.') +
          regla('Jugadora', 'Jugadora de la semana', 'Los miércoles, una jugadora con su equipo (solo quien ha dado permiso).') +
          '<h3 class="n-grupo">Antes de publicar</h3>' + regla('Revisar', 'Lo revisa un socio', 'Cada publicación automática espera en «Programada» a que un socio la apruebe. Sin marcar, se publica sola a su hora.') +
          '<p class="u-nota">Para publicar de verdad hace falta la cuenta profesional de Instagram (API de Meta) y la de TikTok, las dos con la revisión de su aplicación.</p>';
      }

      /* ======================= lo que se pulsa ======================= */

      el.onclick = function (e) {
        // En la copia del móvil todo va en una página: los enlaces a otra de la maqueta los abre KANBAN.irA.
        var ln = e.target.closest('a[data-mqira]'), C = window.KANBAN || {};
        // En el simulador, la plataforma y konamigas.com están al lado: se enseña la otra en vez de ir a ella.
        var enSim = window.parent !== window && ln && ln.getAttribute('data-mqira') !== 'ins';
        if (enSim) { e.preventDefault(); return window.parent.postMessage({ mq: 'mostrar', a: ln.getAttribute('data-mqira') === 'app' ? 'app' : 'web' }, '*'); }
        if (ln && typeof C.irA === 'function') { e.preventDefault(); return C.irA(ln.getAttribute('data-mqira'), ln.getAttribute('data-q')); }
        var b = e.target.closest('button, [data-mqff], [data-mqauto], [data-mqpart]');
        if (!b || !el.contains(b)) return;
        var a = function (k) { return b.getAttribute(k); };
        if (b.hasAttribute('data-mqir')) { M.portal = a('data-mqir'); window.scrollTo(0, 0); return pintar(); }
        if (b.hasAttribute('data-mqp')) { M.pestana[W ? M.web.vista : M.portal] = a('data-mqp'); return pintar(); }
        if (b.hasAttribute('data-mqaviso')) return ctx.aviso('Maqueta: ' + a('data-mqaviso'));
        // konamigas.com: ir a una pantalla, abrir una liga, entrar y salir.
        if (b.hasAttribute('data-mqpart')) return fichaMia(a('data-mqpart'));
        if (b.hasAttribute('data-mqw')) { M.web.vista = a('data-mqw'); if (a('data-mqpest')) M.pestana.mia = a('data-mqpest'); window.scrollTo(0, 0); return pintar(); }
        if (b.hasAttribute('data-mqwliga')) { M.liga = a('data-mqwliga'); M.web.vista = 'liga'; window.scrollTo(0, 0); return pintar(); }
        if (b.hasAttribute('data-mqwarbitro')) {
          var Cw = window.KANBAN || {};
          if (typeof Cw.irA === 'function') return Cw.irA('arbitro');
          // En el modo local, la plataforma de al lado: se entra como el árbitro con «Cambiar de persona».
          ctx.aviso('En el modo local, entra como el árbitro en la plataforma (al lado) y abre Futuro → Árbitro.');
          try { if (window.parent !== window) window.parent.postMessage({ mq: 'mostrar', a: 'app' }, '*'); } catch (e) {}
          return;
        }
        if (b.hasAttribute('data-mqwcomo')) {
          return ventanaElegir('Entrar como', (M.web.personas || []).map(function (x) {
            return { id: x.id, titulo: x.nombre + (x.nueva ? ' · capitana, recién inscrita' : x.capitana ? ' · capitana' : ''), sub: x.equipos.join(', ') + (x.temporada ? '' : ' · de otras temporadas') };
          }), function (id) { M.web.como = id; pintar(); });
        }
        if (b.hasAttribute('data-mqwcodigo')) {
          var c = el.querySelector('[data-mqwcorreo]');
          M.web.correo = tapar(c && c.value) || 'tu correo';
          M.web.paso = 'codigo';
          ctx.aviso('Código enviado (en la maqueta, no se manda nada)');
          return pintar();
        }
        if (b.hasAttribute('data-mqwentrar')) {
          b.disabled = true;
          return W.entrar(M.web.como).then(function () {
            var p0 = (M.web.personas || []).filter(function (x) { return x.id === M.web.como; })[0];
            M.web.yo = M.web.como; M.web.paso = ''; M.liga = ''; M.pestana.mia = ''; M.web.recien = true;
            // La capitana de un equipo recién inscrito aún no tiene liga: va a su área, a ver su inscripción.
            M.web.vista = 'mia';
            paso(p0 && p0.nueva ? 'capitana' : 'area'); window.scrollTo(0, 0); pintar(); // en el guion: la recién inscrita, o una jugadora cualquiera
          },
            function (er) { b.disabled = false; ctx.aviso(String(er && er.message || er)); });
        }
        if (b.hasAttribute('data-mqwsalir')) { W.salir(); M.web.yo = ''; M.web.vista = 'inicio'; M.liga = ''; M.pestana = {}; window.scrollTo(0, 0); return pintar(); }
        if (b.hasAttribute('data-mqnueva')) return nuevaIncidencia(a('data-mqnueva'));
        if (b.hasAttribute('data-mqinc')) {
          var x = incidencia(capitanaDe(M.web.yo).ID, a('data-mqinc'));
          if (!x) return;
          cambiarIncidencia(x.ie, x.id, a('data-accion') === 'ver' ? { estado: 'Vista por el gestor' } : { estado: 'Resuelta', respuesta: x.respuesta || 'Hecho, gracias por avisar.' });
          guardarComun();
          return pintar();
        }
        if (b.hasAttribute('data-mqfoto')) {
          var id = a('data-mqfoto'), i = M.foto.indexOf(id);
          if (i >= 0) M.foto.splice(i, 1); else M.foto.push(id);
          return pintar();
        }
        if (b.hasAttribute('data-mqmes')) {
          var d = deIso(M.mesRedes || D.h.slice(0, 7) + '-01');
          d.setMonth(d.getMonth() + Number(a('data-mqmes')));
          M.mesRedes = iso(d);
          return pintar();
        }
        if (b.hasAttribute('data-mqgest')) {
          var g = a('data-mqgest').split('|'), xg = incidencia(g[0], g[1]);
          if (!xg) return;
          if (a('data-accion') === 'ver') {
            cambiarIncidencia(g[0], g[1], { estado: 'Vista por el gestor' }); novedad([g[0]], 'Konamigas ha visto tu aviso', xg.tipo + ': ' + xg.texto); guardarComun();
            avisarSim({ a: 'web', titulo: 'El gestor ha visto la incidencia de ' + equipo(g[0]), texto: xg.tipo });
            return pintar();
          }
          return responderIncidencia(g[0], g[1]);
        }
        if (b.hasAttribute('data-mqenligas')) return abrirEnLigas(a('data-mqenligas'));
        if (b.hasAttribute('data-mqarb')) { M.arbActa = a('data-mqarb'); M.arbRec = null; window.scrollTo(0, 0); return pintar(); }
        if (b.hasAttribute('data-mqarbvolver')) { M.arbActa = ''; M.arbRec = null; return pintar(); }
        if (b.hasAttribute('data-mqarbrec')) { var rr = a('data-mqarbrec').split('|'); return abrirReclamacion(rr[0], rr[1]); }
        if (b.hasAttribute('data-mqarbbien')) { resolverReclamacion(M.arbRec, D.ixPar[M.arbActa], null, []); M.arbActa = ''; return pintar(); }
        if (b.hasAttribute('data-mqarbempezar')) {
          var pe = D.ixPar[M.arbActa], cd = comun();
          (cd.directo = cd.directo || {})[pe.ID] = { gl: 0, gv: 0, goles: [], desde: new Date().toISOString(), arbitro: yoStaff() || '' };
          guardarComun();
          avisarSim({ a: 'app', titulo: 'Empieza ' + equipo(pe.ID_INSCRIPCION_LOCAL) + ' – ' + equipo(pe.ID_INSCRIPCION_VISITANTE), texto: 'En directo en konamigas.com, con su árbitro.' });
          return pintar();
        }
        if (b.hasAttribute('data-mqgol') || b.hasAttribute('data-mqgolmenos')) {
          var mas = b.hasAttribute('data-mqgol'), gg = a(mas ? 'data-mqgol' : 'data-mqgolmenos').split('|'), pg = D.ixPar[M.arbActa], lg = golesActa(pg);
          if (mas) lg.push({ eq: gg[0], ju: gg[1], tipo: gg[1] ? '' : 'En propia' });
          else for (var q = lg.length - 1; q >= 0; q--) if (lg[q].eq === gg[0] && lg[q].ju === gg[1]) { lg.splice(q, 1); break; }
          var dv = directo(pg.ID);
          if (dv) {
            // En directo: el marcador va a lo compartido (konamigas.com lo enseña) y cada gol le llega a Konamigas.
            dv.gl = lg.filter(function (x) { return x.eq === String(pg.ID_INSCRIPCION_LOCAL); }).length;
            dv.gv = lg.filter(function (x) { return x.eq === String(pg.ID_INSCRIPCION_VISITANTE); }).length;
            guardarComun();
            if (mas) {
              var jn = gg[1] ? ((M.arbPlant[gg[0]] || []).filter(function (j) { return j.ID === gg[1]; })[0] || {}).NOMBRE : 'en propia';
              avisarSim({ a: 'app', titulo: '⚽ Gol de ' + equipo(gg[0]) + (jn ? ' · ' + jn : ''), texto: equipo(pg.ID_INSCRIPCION_LOCAL) + ' ' + dv.gl + '–' + dv.gv + ' ' + equipo(pg.ID_INSCRIPCION_VISITANTE) + ' · minuto ' + minuto(dv) + ', en directo' });
            }
          }
          return pintar();
        }
        if (b.hasAttribute('data-mqarbcerrar')) return cerrarActaArbitro(b);
        if (b.hasAttribute('data-mqarbestado')) return estadoArbitro(a('data-mqarbestado'));
        if (b.hasAttribute('data-mqtnueva')) return nuevaTematica();
        if (b.hasAttribute('data-mqttareas')) return crearTareas(a('data-mqttareas'), b);
        if (b.hasAttribute('data-mqtplantilla')) { M.tema = a('data-mqtplantilla'); M.plantilla = 'Fotos'; M.pestana.redes = 'crear'; window.scrollTo(0, 0); return pintar(); }
        if (b.hasAttribute('data-mqtaviso')) {
          var tt = tematica(a('data-mqtaviso')), av = avisos().filter(function (x) { return x.tema === tt.id; })[0];
          if (!av) { av = avisoDeTema(tt, false); avisos().push(av); }
          av.publicado = !av.publicado;
          guardarComun();
          ctx.aviso(av.publicado ? 'Publicado: lo verán todas las jugadoras en konamigas.com' : 'Quitado de konamigas.com');
          return pintar();
        }
        if (b.hasAttribute('data-mqavnuevo')) {
          avisos().unshift({ id: 'av' + Date.now().toString(36), titulo: 'Aviso para las jugadoras', texto: '', hasta: sumarDias(D.h, 14), liga: '', publicado: false });
          guardarComun();
          return pintar();
        }
        if (b.hasAttribute('data-mqavborrar')) { avisos().splice(Number(a('data-mqavborrar')), 1); guardarComun(); return pintar(); }
        if (b.hasAttribute('data-mqeditar')) { M.plantilla = a('data-mqeditar'); M.pestana.redes = 'crear'; return pintar(); }
        if (b.hasAttribute('data-mqpublicar')) {
          var ahora = a('data-mqpublicar') === 'ahora';
          M.publicadas.push({ fecha: ahora ? D.h : sumarDias(D.h, 1), tipo: M.plantilla, titulo: M.plantilla + ' · ' + liga(M.ligaPost), redes: M.formato === 'vertical' ? ['Instagram', 'TikTok'] : ['Instagram'],
            estado: ahora ? 'Publicada' : 'Programada', ligas: [liga(M.ligaPost)] });
          ctx.aviso(ahora ? 'Maqueta: así se publicaría en Instagram y TikTok (no se publica de verdad)' : 'Programada para mañana (en la maqueta, solo aquí)');
          M.pestana.redes = 'calendario';
          return pintar();
        }
      };
      el.onchange = function (e) {
        var t = e.target;
        if (t.hasAttribute('data-mqliga')) { M.liga = t.value; return pintar(); }
        if (t.hasAttribute('data-mqligapost')) { M.ligaPost = t.value; return pintar(); }
        if (t.hasAttribute('data-mqplantilla')) { M.plantilla = t.value; return pintar(); }
        if (t.hasAttribute('data-mqformato')) { M.formato = t.value; return pintar(); }
        if (t.hasAttribute('data-mqtema')) { M.tema = t.value; return pintar(); }
        if (t.hasAttribute('data-mqav')) {
          var av = avisos()[Number(t.getAttribute('data-mqav'))], k = t.getAttribute('data-k');
          if (!av) return;
          av[k] = t.type === 'checkbox' ? t.checked : t.value;
          guardarComun();
          if (k === 'publicado' || k === 'liga') { ctx.aviso(k === 'publicado' ? (av.publicado ? 'Publicado en konamigas.com' : 'Quitado de konamigas.com') : 'Cambiado'); return pintar(); }
        }
        if (t.hasAttribute('data-mqff')) { M.filtroFotos = t.value; return pintar(); }
        if (t.hasAttribute('data-mqauto')) { M.auto[t.getAttribute('data-mqauto')] = t.checked; ctx.aviso('Maqueta: la regla se guardaría para toda la temporada'); }
      };
    },
    cerrar: function () {}
  });
})();
