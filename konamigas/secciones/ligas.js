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
 * SIN_CLASIFICACION, ACTA_TODAS, PROGRAMAR, GOLEADORAS y AYUDA.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var CON_MOTIVO = ['Aplazado', 'Suspendido', 'Anulado'];
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

  /** ¿Cuenta el partido para la clasificación? Jugado y con los dos resultados. */
  function conResultado(p) { return p.ESTADO === 'Jugado' && isFinite(num(p.GOLES_LOCAL)) && isFinite(num(p.GOLES_VISITANTE)); }

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
   * goles a favor y nombre (nombres: { ID: nombre }). Devuelve [{ pos, id, pj, pg, pe, pp, gf, gc, dg, pts, jugar }]:
   * jugar, los partidos que le quedan (programados o aplazados).
   */
  function clasificacion(ps, equipos, puntos, nombres) {
    puntos = puntos || {};
    var G = num(puntos.GANAR), E = num(puntos.EMPATAR), P = num(puntos.PERDER);
    if (!isFinite(G)) G = 3; if (!isFinite(E)) E = 1; if (!isFinite(P)) P = 0;
    var t = {}, fila = function (id) { return t[id] || (t[id] = { id: id, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, jugar: 0 }); };
    (equipos || []).forEach(function (id) { if (id) fila(String(id)); });
    ps.forEach(function (p) {
      var l = String(p.ID_INSCRIPCION_LOCAL || ''), v = String(p.ID_INSCRIPCION_VISITANTE || '');
      if (!l || !v) return;
      var a = fila(l), b = fila(v);
      if (p.ESTADO === 'Programado' || p.ESTADO === 'Aplazado') { a.jugar++; b.jugar++; return; }
      if (!conResultado(p)) return;
      var gl = num(p.GOLES_LOCAL), gv = num(p.GOLES_VISITANTE);
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

  /** Los goles de un equipo en un partido, juntos por jugadora: [{ jugadora ('' = en propia del rival), goles }]. */
  function golesEquipo(goles, eq) {
    var o = {}, l = [];
    (goles || []).forEach(function (g) {
      if (String(g.ID_INSCRIPCION_EQUIPO) !== String(eq)) return;
      var k = String(g.ID_INSCRIPCION_JUGADORA || '');
      if (!o[k]) { o[k] = { jugadora: k, goles: 0 }; l.push(o[k]); }
      o[k].goles++;
    });
    return l.sort(function (a, b) { return b.goles - a.goles || (a.jugadora ? 0 : 1) - (b.jugadora ? 0 : 1); });
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

  /** ¿Puede cerrar el acta? Quien administra, un perfil de ACTA_TODAS o el árbitro del partido. */
  function puedeActa(p, quien) {
    if (!p || p.ESTADO === 'Libre' || p.ESTADO === 'Anulado' || !p.ID_INSCRIPCION_LOCAL || !p.ID_INSCRIPCION_VISITANTE) return false;
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
    var mover = de.filter(function (p) { return CON_MOTIVO.indexOf(p.ESTADO) < 0; }), dias = {};
    mover.forEach(function (p) { dias[p.FECHA] = 1; });
    if (Object.keys(dias).length !== 1) return { ok: false, motivo: 'tiene partidos en varios días' };
    if (h && Object.keys(dias)[0] < h) return { ok: false, motivo: 'ya ha pasado' };
    return { ok: true, fecha: Object.keys(dias)[0], ps: mover };
  }

  var CALC = { hoy: hoy, fecha: fecha, fechaDia: fechaDia, lunes: lunes, sumarDias: sumarDias, temporadaActual: temporadaActual, ligasDe: ligasDe,
    jornadas: jornadas, jornadaInicial: jornadaInicial, clasificacion: clasificacion, goleadoras: goleadoras, golesEquipo: golesEquipo,
    descansan: descansan, equiposDe: equiposDe, puedeActa: puedeActa, conResultado: conResultado, huecosMover: huecosMover, jornadaMovible: jornadaMovible };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  var TABLAS = ['TEMPORADAS', 'COMPETICIONES', 'LIGAS', 'PARTIDOS', 'GOLES', 'CAMPOS', 'INSTALACIONES', 'CALENDARIO', 'INSCRIPCIONES_EQUIPOS', 'HUECOS'];
  var PESTANAS = { JORNADAS: 'Jornadas', CLASIFICACION: 'Clasificación', CALENDARIO: 'Calendario' };
  var ESTADOS = { Programado: 'ni', Jugado: 'co', Aplazado: 'pr', Suspendido: 'pr', Anulado: 'bl', Libre: 'x' };
  var JUG = {}; // jugadoras de cada equipo inscrito (ligasJugadoras), mientras la página está abierta

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
      var pest = String(cfg.PESTANAS || Object.keys(PESTANAS).join(',')).split(',').map(function (s) { return s.trim().toUpperCase(); })
        .filter(function (s) { return PESTANAS[s]; });
      if (!pest.length) pest = Object.keys(PESTANAS);
      var CLAVE = 'lig_' + ctx.id + '_';
      var KSTAFF = CLAVE + 'staff_' + String(ctx.correo || ctx.persona || '').toLowerCase(), KCOL = CLAVE + 'colores';
      var staff = guardadoJson(KSTAFF) || { yo: '', staff: [] }, colores = guardadoJson(KCOL) || {};
      var quien = { admin: !!ctx.admin, perfil: ctx.perfil, actaTodas: lista(cfg.ACTA_TODAS), yo: staff.yo };
      var programa = !!ctx.admin || lista(cfg.PROGRAMAR).indexOf(ctx.perfil) >= 0;
      var S = { tab: pest.indexOf(guardado(CLAVE + 'tab')) >= 0 ? guardado(CLAVE + 'tab') : '', temp: guardado(CLAVE + 'temp'), comp: guardado(CLAVE + 'comp'),
        liga: guardado(CLAVE + 'liga'), compCal: guardado(CLAVE + 'compcal'), jornada: null, semana: lunes(hoy()), mios: guardado(CLAVE + 'mios') !== 'no', leido: false };
      // Un árbitro viene a ver sus partidos: entra en el calendario, con los suyos.
      if (!S.tab) S.tab = !programa && quien.actaTodas.indexOf(ctx.perfil) < 0 && pest.indexOf('CALENDARIO') >= 0 ? 'CALENDARIO' : pest[0];

      el.innerHTML = (cfg.AYUDA ? '<p class="u-nota n-ayuda">' + texto(cfg.AYUDA) + '</p>' : '') +
        '<div class="lg-barra"><label class="u-campo lg-temp"><span class="u-etiqueta">Temporada</span><select id="lg-temp"></select></label>' +
        '<label class="u-check lg-mios" hidden><input type="checkbox" id="lg-mios"> Solo mis partidos</label></div>' +
        '<div class="lg-elige" id="lg-elige"></div>' +
        '<div class="u-pestanas" role="tablist">' + pest.map(function (p) { return '<button type="button" role="tab" data-tab="' + p + '">' + PESTANAS[p] + '</button>'; }).join('') + '</div>' +
        '<div id="lg-cont" class="lg-cont"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<div class="u-velo" id="lg-velo"><div class="u-ventana" role="dialog" aria-modal="true" aria-labelledby="lg-vt"><div class="n-ventana" id="lg-vent"></div></div></div>';
      var cont = el.querySelector('#lg-cont'), velo = el.querySelector('#lg-velo'), vent = el.querySelector('#lg-vent');
      var selTemp = el.querySelector('#lg-temp'), chkMios = el.querySelector('#lg-mios'), elige = el.querySelector('#lg-elige');

      /* ---------- datos ---------- */

      var d, ix, temp, ligas, comps, actual;
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
        el.querySelector('.lg-mios').hidden = S.tab !== 'CALENDARIO' || !quien.yo;
        chkMios.checked = S.mios;
        elige.innerHTML = htmlElige();
        if (!temp) { cont.innerHTML = '<p class="u-vacio">Todavía no hay temporadas. Añade la primera en la tabla TEMPORADAS del Excel COMPETICION.</p>'; return; }
        if (S.tab !== 'CALENDARIO' && !actual) { cont.innerHTML = '<p class="u-vacio">Esta temporada todavía no tiene ligas. Se crean en las tablas COMPETICIONES y LIGAS del Excel COMPETICION.</p>'; return; }
        cont.innerHTML = ({ JORNADAS: htmlJornadas, CLASIFICACION: htmlClasificacion, CALENDARIO: htmlCalendario })[S.tab]();
        [].forEach.call(el.querySelectorAll('.lg-fila-chips [aria-pressed=true], .lg-jornadas [aria-pressed=true]'), function (sel) {
          var p = sel.parentNode;
          if (p.scrollWidth > p.clientWidth) p.scrollLeft = Math.max(0, sel.offsetLeft - p.offsetLeft - p.clientWidth / 2 + sel.offsetWidth / 2);
        });
        if (S.tab === 'CLASIFICACION') nombresGoleadoras();
      }

      /** Competición y liga, en botones (en el calendario, todas las competiciones o una, sin liga). */
      function htmlElige() {
        if (!temp || !comps.length) return '';
        var cal = S.tab === 'CALENDARIO', compSel = cal ? S.compCal : actual ? actual.comp.ID : '';
        var h = '<div class="lg-fila-chips" role="group" aria-label="Competición">' +
          (cal ? '<button type="button" data-comp="" aria-pressed="' + !compSel + '">Todas</button>' : '') +
          comps.map(function (c) { return '<button type="button" data-comp="' + texto(c.ID) + '" aria-pressed="' + (c.ID === compSel) + '">' + texto(nomComp(c)) + '</button>'; }).join('') + '</div>';
        if (!cal && actual) {
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
      /** Un partido en una lista: hora y campo, los dos equipos (con su color) y su resultado, y debajo el estado y el árbitro. */
      function htmlPartido(p, conLiga) {
        var res = conResultado(p), gl = num(p.GOLES_LOCAL), gv = num(p.GOLES_VISITANTE);
        var libre = p.ESTADO === 'Libre' || !p.ID_INSCRIPCION_LOCAL || !p.ID_INSCRIPCION_VISITANTE;
        var lado = function (id, g, gana) {
          return '<span class="lg-eq' + (gana ? ' lg-gana' : '') + '">' + punto(id) + '<span class="lg-nom">' + texto(equipo(id) || 'Por decidir') + '</span>' +
            (res ? '<span class="lg-gol u-cifra">' + g + '</span>' : '') + '</span>';
        };
        var meta = [conLiga ? ligaCompleta(p.ID_LIGA) + ' · J' + p.JORNADA : '',
          arbitro(p) ? 'Árbitro: ' + persona(arbitro(p)) : (libre ? '' : 'Sin árbitro'), p.ESTADO !== 'Programado' && p.MOTIVO ? p.MOTIVO : ''].filter(String);
        return '<button type="button" class="lg-p' + (esMio(p) ? ' lg-mio' : '') + '" data-p="' + texto(p.ID) + '">' +
          '<span class="lg-hora"><b class="u-cifra">' + texto(p.HORA || '--:--') + '</b><small>' + texto(campo(p.ID_CAMPO)) + '</small></span>' +
          '<span class="lg-eqs">' + (libre ? '<span class="lg-eq"><span class="lg-nom">' + texto(equipo(p.ID_INSCRIPCION_LOCAL || p.ID_INSCRIPCION_VISITANTE) || 'Campo libre') + '</span></span>'
            : lado(p.ID_INSCRIPCION_LOCAL, gl, res && gl > gv) + lado(p.ID_INSCRIPCION_VISITANTE, gv, res && gv > gl)) +
          '<span class="lg-meta">' + chipEstado(p) + (meta.length ? '<span>' + texto(meta.join(' · ')) + '</span>' : '') + '</span></span></button>';
      }
      /** Festivo o descanso de un día (tabla CALENDARIO), o ''. */
      function especial(f) { var c = ix.cal[f]; return c ? (c.FESTIVO ? 'Festivo' : 'Sin partidos') + (c.MOTIVO ? ': ' + c.MOTIVO : '') : ''; }
      function htmlDia(f) { var e = especial(f); return e ? '<p class="lg-aviso">' + texto(e) + '</p>' : ''; }

      function htmlJornadas() {
        var ps = partidosLiga(actual.liga.ID), js = jornadas(ps);
        var h = cabLiga();
        if (!js.length) return h + '<p class="u-vacio">Esta liga todavía no tiene partidos.</p>';
        if (S.jornada === null || js.indexOf(S.jornada) < 0) S.jornada = jornadaInicial(ps, hoy());
        h += '<div class="lg-jornadas" role="group" aria-label="Jornada">' + js.map(function (j) {
          var pj = ps.filter(function (p) { return num(p.JORNADA) === j; }), hecha = pj.length && pj.every(function (p) { return p.ESTADO !== 'Programado'; });
          return '<button type="button" data-jornada="' + j + '" aria-pressed="' + (j === S.jornada) + '"' + (hecha ? ' class="lg-hecha"' : '') + ' aria-label="Jornada ' + j + '">J' + j + '</button>';
        }).join('') + '</div>';
        var pj = ps.filter(function (p) { return num(p.JORNADA) === S.jornada; }).sort(function (a, b) { return orden(cuando(a), cuando(b)) || orden(campo(a.ID_CAMPO), campo(b.ID_CAMPO)); });
        var fechas = []; pj.forEach(function (p) { if (fechas.indexOf(p.FECHA) < 0) fechas.push(p.FECHA); });
        var mov = programa && jornadaMovible(ps, S.jornada, hoy()).ok;
        h += '<div class="lg-jcab"><h2 class="n-grupo">Jornada ' + S.jornada + '</h2>' +
          (mov ? '<button type="button" class="u-btn" data-accion="jornadas">Intercambiar fecha con otra jornada</button>' : '') + '</div>';
        fechas.forEach(function (f) {
          h += (fechas.length > 1 || f ? '<h3 class="lg-dia">' + texto(f ? fechaDia(f) + ' · ' + fecha(f) : 'Sin fecha') + '</h3>' : '') + htmlDia(f) +
            '<div class="lg-lista">' + pj.filter(function (p) { return p.FECHA === f; }).map(function (p) { return htmlPartido(p); }).join('') + '</div>';
        });
        var des = descansan(pj, equiposLiga(actual.liga.ID));
        if (des.length && pj.length) h += '<p class="u-nota">Descansa' + (des.length > 1 ? 'n' : '') + ': ' + texto(des.map(equipo).sort().join(', ')) + '.</p>';
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
          return h + '<p class="u-vacio">' + texto(nomComp(actual.comp)) + ' se juega por eliminatorias: no tiene clasificación. Los cruces están en Jornadas.</p>';
        var ps = partidosLiga(actual.liga.ID), nombres = {};
        d.eq.forEach(function (e) { nombres[e.ID] = e.NOMBRE_EQUIPO; });
        var cl = clasificacion(ps, equiposLiga(actual.liga.ID), cfg.PUNTOS, nombres);
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
          (isFinite(num(P.EMPATAR)) ? num(P.EMPATAR) : 1) + ' por empatar; a igualdad de puntos, mejor diferencia de goles y después más goles a favor.</p>';
        var max = num(cfg.GOLEADORAS);
        if (max === 0) return h;
        if (!isFinite(max)) max = 10;
        var go = goleadoras(d.gol, ps.map(function (p) { return p.ID; })).slice(0, max);
        h += '<h2 class="n-grupo">Goleadoras</h2>';
        if (!go.length) return h + '<p class="u-vacio">Todavía no hay goles apuntados en las actas de esta liga.</p>';
        return h + '<ol class="lg-ranking">' + go.map(function (g) {
          return '<li><span class="lg-eqt">' + punto(g.equipo) + '<span><b data-jugadora="' + texto(g.jugadora) + '" data-eq="' + texto(g.equipo) + '">' + texto(nomJugadora(g.equipo, g.jugadora)) + '</b>' +
            '<small>' + texto(equipo(g.equipo)) + '</small></span></span><span class="lg-n u-cifra">' + g.goles + '</span></li>';
        }).join('') + '</ol>';
      }
      function nomJugadora(eq, id) {
        var j = (JUG[eq] || []).filter(function (x) { return x.ID === id; })[0];
        return j ? j.NOMBRE : JUG[eq] ? id : 'Cargando…';
      }
      function dorsal(eq, id) { var j = (JUG[eq] || []).filter(function (x) { return x.ID === id; })[0]; return j ? j.DORSAL : ''; }
      /** Pide los nombres de las goleadoras que aún no tiene y los pone en su sitio. */
      function nombresGoleadoras() {
        var faltan = [];
        [].forEach.call(cont.querySelectorAll('[data-jugadora]'), function (x) { var e = x.getAttribute('data-eq'); if (e && !JUG[e] && faltan.indexOf(e) < 0) faltan.push(e); });
        if (!faltan.length) return;
        cargarJugadoras(faltan).then(function () {
          if (!ctx.abierta()) return;
          [].forEach.call(cont.querySelectorAll('[data-jugadora]'), function (x) { x.textContent = nomJugadora(x.getAttribute('data-eq'), x.getAttribute('data-jugadora')); });
        }, function () {});
      }
      function cargarJugadoras(eqs) {
        eqs = eqs.filter(function (e) { return e && !JUG[e]; });
        if (!eqs.length) return Promise.resolve();
        return ctx.llamar('ligasJugadoras', [eqs]).then(function (r) { Object.keys(r || {}).forEach(function (e) { JUG[e] = r[e]; }); });
      }

      function htmlCalendario() {
        var ini = S.semana, fin = sumarDias(ini, 6);
        var deLigas = indice(ligas.filter(function (x) { return !S.compCal || x.comp.ID === S.compCal; }).map(function (x) { return x.liga; }));
        var ps = d.par.filter(function (p) { return deLigas[p.ID_LIGA] && p.FECHA >= ini && p.FECHA <= fin && (!S.mios || !quien.yo || esMio(p)); })
          .sort(function (a, b) { return orden(cuando(a), cuando(b)) || orden(campo(a.ID_CAMPO), campo(b.ID_CAMPO)); });
        var h = '<div class="lg-semana"><button type="button" class="u-btn u-btn-icono" data-semana="-7" aria-label="Semana anterior">‹</button>' +
          '<h2 class="n-grupo">' + texto(fecha(ini, true) + ' – ' + fecha(fin, true)) + '</h2>' +
          '<button type="button" class="u-btn u-btn-icono" data-semana="7" aria-label="Semana siguiente">›</button>' +
          (ini !== lunes(hoy()) ? '<button type="button" class="u-btn u-btn-texto" data-semana="0">Esta semana</button>' : '') + '</div>';
        var hay = false;
        for (var i = 0; i < 7; i++) {
          var f = sumarDias(ini, i), del = ps.filter(function (p) { return p.FECHA === f; }), esp = htmlDia(f);
          if (!del.length && !esp) continue;
          hay = true;
          h += '<h3 class="lg-dia' + (f === hoy() ? ' lg-hoy' : '') + '">' + texto(fechaDia(f) + (f === hoy() ? ' · hoy' : '')) + '</h3>' + esp +
            (del.length ? '<div class="lg-lista">' + del.map(function (p) { return htmlPartido(p, true); }).join('') + '</div>' : '');
        }
        if (!hay) h += '<p class="u-vacio">' + (S.mios && quien.yo ? 'No tienes partidos esta semana.' : 'No hay partidos esta semana.') + '</p>';
        var pend = quien.yo ? d.par.filter(function (p) { return p.ESTADO === 'Programado' && p.FECHA < hoy() && (p.ID_ARBITRO_REAL ? p.ID_ARBITRO_REAL === quien.yo : p.ID_ARBITRO === quien.yo); }) : [];
        if (pend.length) h = '<p class="u-bloque lg-pend">Tienes ' + pend.length + (pend.length === 1 ? ' acta por cerrar' : ' actas por cerrar') + ' de partidos ya jugados. ' +
          '<button type="button" class="u-btn u-btn-texto" data-ir-pend="' + texto(pend[0].FECHA) + '">Ver</button></p>' + h;
        return h;
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
      function titulo(p) { return p.ID_INSCRIPCION_LOCAL || p.ID_INSCRIPCION_VISITANTE ? equipo(p.ID_INSCRIPCION_LOCAL) + ' – ' + equipo(p.ID_INSCRIPCION_VISITANTE) : 'Campo libre'; }

      /** Un equipo en el marcador de la ficha: su color, su nombre y quién marcó sus goles. */
      function ladoMarcador(p, eq, rival, que) {
        var gs = golesEquipo(golesDe(p.ID), eq);
        return '<div class="lg-mlado"' + (colorEq(eq) ? ' style="--c:' + texto(colorEq(eq)) + '"' : '') + '>' +
          '<span class="lg-mcolor' + (colorEq(eq) ? '' : ' lg-color-no') + '" aria-hidden="true"></span>' +
          '<b>' + texto(equipo(eq)) + '</b><small>' + texto(que + (nomColor(eq) ? ' · ' + nomColor(eq) : '')) + '</small>' +
          (gs.length ? '<ul class="lg-mgoles">' + gs.map(function (g) {
            return '<li>' + (g.jugadora ? '<span class="lg-dorsal u-cifra" data-dorsal="' + texto(g.jugadora) + '" data-eq="' + texto(eq) + '">' + texto(dorsal(eq, g.jugadora)) + '</span>' +
              '<span data-jugadora="' + texto(g.jugadora) + '" data-eq="' + texto(eq) + '">' + texto(nomJugadora(eq, g.jugadora)) + '</span>'
              : '<span class="lg-dorsal">–</span><span>En propia de ' + texto(equipo(rival)) + '</span>') +
              (g.goles > 1 ? '<span class="lg-veces u-cifra">×' + g.goles + '</span>' : '') + '</li>';
          }).join('') + '</ul>' : '') + '</div>';
      }

      /** Ficha de un partido: marcador con los colores y las goleadoras de cada equipo, los datos y lo que se puede hacer. */
      function ficha(id) {
        var p = T.fila('PARTIDOS', id);
        if (!p) return;
        var c = ix.cam[p.ID_CAMPO], ins = c && ix.ins[c.ID_INSTALACION], ges = ix.staff[p.ID_GESTOR], tel = ges && wa(ges.TELEFONO);
        var res = conResultado(p), gs = golesDe(p.ID), acta = puedeActa(p, quien) && !p._nueva;
        var L = p.ID_INSCRIPCION_LOCAL, V = p.ID_INSCRIPCION_VISITANTE;
        var fila = function (dt, dd) { return dd ? '<dt>' + dt + '</dt><dd>' + dd + '</dd>' : ''; };
        var html = '<h2 id="lg-vt">' + texto(titulo(p)) + '</h2>' +
          '<p class="u-nota">' + texto([ligaCompleta(p.ID_LIGA), 'Jornada ' + p.JORNADA].filter(String).join(' · ')) + '</p>' +
          (L && V ? '<div class="lg-marcador">' + ladoMarcador(p, L, V, 'Local') +
            '<div class="lg-mcentro">' + (res ? '<b class="u-cifra">' + num(p.GOLES_LOCAL) + '<span>–</span>' + num(p.GOLES_VISITANTE) + '</b>'
              : '<b class="lg-mhora u-cifra">' + texto(p.HORA || '--:--') + '</b>') + chipEstado(p) + '</div>' +
            ladoMarcador(p, V, L, 'Visitante') + '</div>' : '') +
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
          (programa && !p._nueva ? '<button type="button" class="u-btn" id="lg-prog">Árbitro y estado</button>' : '') +
          '<button type="button" class="u-btn' + (acta || programa ? ' u-btn-texto' : '') + '" data-cerrar>Cerrar</button></div>';
        ventana(html, function () {
          var a = vent.querySelector('#lg-acta'), b = vent.querySelector('#lg-prog'), m = vent.querySelector('#lg-mover');
          if (a) a.onclick = function () { formActa(p); };
          if (b) b.onclick = function () { formPartido(p); };
          if (m) m.onclick = function () { formMover(p); };
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
        gs.forEach(function (g) { if (elegidos[g.ID_INSCRIPCION_EQUIPO]) elegidos[g.ID_INSCRIPCION_EQUIPO].push(g.ID_INSCRIPCION_JUGADORA || '_propia'); });
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
                opciones(ops.concat([['_propia', 'En propia (de ' + rival + ')']]), v, js ? 'Gol ' + (i + 1) + ': ¿quién marcó?' : 'Cargando jugadoras…') + '</select></label>';
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
                if (!v) { mal.push('Falta quién marcó algún gol de ' + equipo(x[0]) + '.'); break; }
                goles.push({ ID_INSCRIPCION_EQUIPO: x[0], ID_INSCRIPCION_JUGADORA: v === '_propia' ? '' : v });
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
          return '<li><b>' + texto(titulo(c.p)) + '</b><span class="u-cifra">' + texto(deA(c.p, c.nuevo)) + '</span></li>';
        }).join('') + '</ul></div>' +
          '<div class="lg-avisar-ya" role="note"><b>Tendrás que avisar a ' + eqs.length + (eqs.length === 1 ? ' capitana' : ' capitanas') + '</b>' +
          '<span>' + texto(eqs.map(equipo).join(', ')) + '. Al guardar te saldrá la lista con el mensaje ya escrito para enviárselo por WhatsApp.</span></div>';
      }
      /** Mensaje para la capitana de un equipo con los cambios de sus partidos. */
      function mensaje(eq, capitana, cambios) {
        var suyos = cambios.filter(function (c) { return c.p.ID_INSCRIPCION_LOCAL === eq || c.p.ID_INSCRIPCION_VISITANTE === eq; });
        return 'Hola' + (capitana ? ' ' + capitana.split(' ')[0] : '') + ', soy de Konamigas. Cambio en ' + ligaCompleta(suyos[0].p.ID_LIGA) + ': ' + suyos.map(function (c) {
          return 'vuestro partido ' + titulo(c.p) + ' de la jornada ' + c.p.JORNADA + ' pasa al ' + fechaDia(c.nuevo.FECHA).toLowerCase() + ' a las ' + c.nuevo.HORA + ' en ' + campoLargo(c.nuevo.ID_CAMPO);
        }).join('; y ') + '. ¡Gracias!';
      }
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
              '<p class="lg-msg">' + texto(m) + '</p></li>';
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
          '<p class="lg-regla">Solo a los campos reservados para ' + texto(ligaCompleta(p.ID_LIGA)) + ' esta temporada. Si eliges uno ocupado, los dos partidos se intercambian.</p>' +
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
            var cambios = [{ p: p, nuevo: { FECHA: p.FECHA, HORA: elegido.hueco.HORA, ID_CAMPO: elegido.hueco.ID_CAMPO } }];
            if (elegido.otro) cambios.push({ p: elegido.otro, nuevo: { FECHA: p.FECHA, HORA: p.HORA, ID_CAMPO: p.ID_CAMPO } });
            vent.querySelector('#lg-conf').innerHTML = htmlCambios(cambios);
            var g = vent.querySelector('#lg-guardar');
            g.disabled = false; g.textContent = elegido.otro ? 'Intercambiar los dos partidos' : 'Mover el partido';
            g.onclick = function () {
              guardarCambio(cambios, { fn: 'ligasMover', args: [p.ID, elegido.hueco.ID] }, { HORA: elegido.hueco.HORA, ID_CAMPO: elegido.hueco.ID_CAMPO, ID_HUECO: elegido.hueco.ID },
                capitanas || ctx.llamar('ligasCapitanas', [equiposDe(cambios.map(function (c) { return c.p; }))]),
                elegido.otro ? 'Partidos intercambiados.' : 'Partido movido.');
            };
            // Las capitanas se piden ya, para que la lista salga al momento al guardar.
            capitanas = ctx.llamar('ligasCapitanas', [equiposDe(cambios.map(function (c) { return c.p; }))]);
            capitanas.catch(function () {});
          };
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
          '<p class="lg-regla">Los partidos de las dos jornadas cambian de día y se quedan en su hora y su campo. Solo jornadas sin jugar, de hoy en adelante y en un solo día.</p>' +
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
            var cambios = A.ps.map(function (p) { return { p: p, nuevo: { FECHA: B.fecha, HORA: p.HORA, ID_CAMPO: p.ID_CAMPO } }; })
              .concat(B.ps.map(function (p) { return { p: p, nuevo: { FECHA: A.fecha, HORA: p.HORA, ID_CAMPO: p.ID_CAMPO } }; }));
            var esp = [especial(B.fecha) ? 'Ojo: el ' + fechaDia(B.fecha).toLowerCase() + ' es ' + especial(B.fecha).toLowerCase() + '.' : '',
              especial(A.fecha) ? 'Ojo: el ' + fechaDia(A.fecha).toLowerCase() + ' es ' + especial(A.fecha).toLowerCase() + '.' : ''].filter(String).join(' ');
            vent.querySelector('#lg-conf').innerHTML = '<p class="lg-regla"><b>J' + a + '</b> pasa al ' + texto(fechaDia(B.fecha).toLowerCase()) + ' y <b>J' + bj + '</b> al ' + texto(fechaDia(A.fecha).toLowerCase()) + '. ' + texto(esp) + '</p>' + htmlCambios(cambios);
            var g = vent.querySelector('#lg-guardar');
            g.disabled = false;
            capitanas = ctx.llamar('ligasCapitanas', [equiposDe(cambios.map(function (c) { return c.p; }))]);
            capitanas.catch(function () {});
            g.onclick = function () {
              guardarCambio(cambios, { fn: 'ligasJornadas', args: [actual.liga.ID, a, bj, A.ps[0].ID] }, { FECHA: B.fecha }, capitanas, 'Jornadas ' + a + ' y ' + bj + ' intercambiadas.');
              S.jornada = bj;
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
          '. Para cambiar la hora o el campo, usa «Mover dentro del día».</p>' +
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
        var b = t.closest('[data-tab]'); if (b) { irA(b.getAttribute('data-tab')); return; }
        b = t.closest('[data-comp]');
        if (b) {
          var c = b.getAttribute('data-comp');
          if (S.tab === 'CALENDARIO') { S.compCal = c; guardado(CLAVE + 'compcal', c); }
          else { S.comp = c; S.liga = ''; S.jornada = null; guardado(CLAVE + 'comp', c); guardado(CLAVE + 'liga', ''); }
          pintar(); return;
        }
        b = t.closest('[data-liga]'); if (b) { S.liga = b.getAttribute('data-liga'); S.jornada = null; guardado(CLAVE + 'liga', S.liga); pintar(); return; }
        b = t.closest('[data-jornada]'); if (b) { S.jornada = Number(b.getAttribute('data-jornada')); pintar(); return; }
        b = t.closest('[data-accion="jornadas"]'); if (b) { formJornadas(); return; }
        b = t.closest('[data-semana]'); if (b) { var n = Number(b.getAttribute('data-semana')); S.semana = n ? sumarDias(S.semana, n) : lunes(hoy()); pintar(); return; }
        b = t.closest('[data-ir-pend]'); if (b) { S.semana = lunes(b.getAttribute('data-ir-pend')); pintar(); return; }
        b = t.closest('[data-p]'); if (b) ficha(b.getAttribute('data-p'));
      });
      el.addEventListener('keydown', function (e) { if (e.key === 'Escape' && velo.classList.contains('abierto')) cerrar(); });
      velo.addEventListener('click', function (e) { if (e.target === velo) cerrar(); });
      el.addEventListener('change', function (e) {
        var t = e.target;
        if (t === selTemp) { S.temp = t.value; S.comp = ''; S.liga = ''; S.jornada = null; guardado(CLAVE + 'temp', t.value); pintar(); }
        else if (t === chkMios) { S.mios = t.checked; guardado(CLAVE + 'mios', t.checked ? 'si' : 'no'); pintar(); }
      });

      ctx.alCambiar(function (t) { if (TABLAS.indexOf(t) >= 0 && !velo.classList.contains('abierto')) pintar(); });
      ctx.tablas.leer(TABLAS).then(function () { S.leido = true; pintar(); }, function (e) {
        cont.innerHTML = '<p class="u-error">No se han podido leer las ligas.</p><p class="u-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Vuelve a abrir la sección para probar otra vez.</p>';
      });
      // Los nombres del staff y los colores de los equipos: los guardados, al momento; los de ahora, por detrás.
      ctx.llamar('ligasStaff').then(function (r) {
        staff = r || staff; guardadoJson(KSTAFF, staff); quien.yo = staff.yo;
        if (ix) ix.staff = indice(staff.staff);
        if (ctx.abierta() && !velo.classList.contains('abierto')) pintar();
      }, function () {});
      ctx.llamar('ligasColores').then(function (r) {
        colores = r || {}; guardadoJson(KCOL, colores);
        if (ctx.abierta() && !velo.classList.contains('abierto')) pintar();
      }, function () {});
      this._cerrar = function () { cerrar(true); };
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); }
  });
})();
