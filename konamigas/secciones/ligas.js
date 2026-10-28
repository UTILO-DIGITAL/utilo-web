/*
 * Sección Ligas de Konamigas · núcleo 5.0 (T0255) · clientes/konamigas/modulos/ligas de utilo-apps
 *
 * Sobre el Excel COMPETICION nuevo: competiciones y ligas de cada temporada, partidos por jornada con fecha, hora,
 * campo y árbitro, resultados y goles, la clasificación y las goleadoras, y el calendario de la semana con festivos y
 * descansos (lo que hacían CALENDARIO, CLASIFICACION y DB_JORNADAS del Excel GESTION, sin fórmulas).
 * - Todo se lee con las tablas al momento (ctx.tablas): se pinta con lo guardado en el dispositivo y se refresca por
 *   detrás. La clasificación y las goleadoras se calculan aquí (CALC, más abajo, se prueba en node).
 * - Los nombres de staff y jugadoras vienen del motor sin sus datos personales (ligasStaff, ligasJugadoras) y se
 *   guardan en el dispositivo.
 * - El acta (resultado y quién marcó cada gol) y la programación (fecha, hora, campo, árbitro, aplazar, anular…) cambian
 *   la pantalla al momento y van por detrás a ligasActa y ligasPartido; si el motor dice que no, vuelve a como estaba.
 *   El acta la cierra el árbitro del partido o un perfil de ACTA_TODAS; la programación, los perfiles de PROGRAMAR.
 *
 * Personalización (config.json · nucleo.secciones.ligas.config, declarada en su modulo.json): PESTANAS, PUNTOS,
 * SIN_CLASIFICACION, ACTA_TODAS, PROGRAMAR, GOLEADORAS y AYUDA.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
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

  /** Los equipos inscritos en una liga que no juegan en esa jornada (descansan). */
  function descansan(ps, equipos) {
    var juega = {};
    ps.forEach(function (p) { juega[p.ID_INSCRIPCION_LOCAL] = 1; juega[p.ID_INSCRIPCION_VISITANTE] = 1; });
    return (equipos || []).filter(function (id) { return !juega[id]; });
  }

  /** ¿Puede cerrar el acta? Quien administra, un perfil de ACTA_TODAS o el árbitro del partido. */
  function puedeActa(p, quien) {
    if (!p || p.ESTADO === 'Libre' || p.ESTADO === 'Anulado' || !p.ID_INSCRIPCION_LOCAL || !p.ID_INSCRIPCION_VISITANTE) return false;
    if (quien.admin || (quien.actaTodas || []).indexOf(quien.perfil) >= 0) return true;
    return !!quien.yo && (p.ID_ARBITRO === quien.yo || p.ID_ARBITRO_REAL === quien.yo);
  }

  var CALC = { hoy: hoy, fecha: fecha, fechaDia: fechaDia, lunes: lunes, sumarDias: sumarDias, temporadaActual: temporadaActual, ligasDe: ligasDe,
    jornadas: jornadas, jornadaInicial: jornadaInicial, clasificacion: clasificacion, goleadoras: goleadoras, descansan: descansan,
    puedeActa: puedeActa, conResultado: conResultado };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  var TABLAS = ['TEMPORADAS', 'COMPETICIONES', 'LIGAS', 'PARTIDOS', 'GOLES', 'CAMPOS', 'INSTALACIONES', 'CALENDARIO', 'INSCRIPCIONES_EQUIPOS'];
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
  function wa(tel) {
    var t = String(tel || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
    if (!t) return '';
    if (t.length === 9) t = '34' + t;
    return /Android|iPhone|iPad/i.test(navigator.userAgent) ? 'whatsapp://send?phone=' + t : 'https://web.whatsapp.com/send?phone=' + t;
  }

  window.UN.registrar('LIGAS', {
    abrir: function (el, ctx) {
      var T = ctx.tablas, cfg = ctx.config || {};
      var pest = String(cfg.PESTANAS || Object.keys(PESTANAS).join(',')).split(',').map(function (s) { return s.trim().toUpperCase(); })
        .filter(function (s) { return PESTANAS[s]; });
      if (!pest.length) pest = Object.keys(PESTANAS);
      var CLAVE = 'lig_' + ctx.id + '_';
      var KSTAFF = CLAVE + 'staff_' + String(ctx.correo || ctx.persona || '').toLowerCase();
      var staff = guardadoJson(KSTAFF) || { yo: '', staff: [] };
      var quien = { admin: !!ctx.admin, perfil: ctx.perfil, actaTodas: lista(cfg.ACTA_TODAS), yo: staff.yo };
      var programa = !!ctx.admin || lista(cfg.PROGRAMAR).indexOf(ctx.perfil) >= 0;
      var S = { tab: pest.indexOf(guardado(CLAVE + 'tab')) >= 0 ? guardado(CLAVE + 'tab') : '', temp: guardado(CLAVE + 'temp'), liga: guardado(CLAVE + 'liga'),
        jornada: null, semana: lunes(hoy()), mios: guardado(CLAVE + 'mios') !== 'no', leido: false };
      // Un árbitro viene a ver sus partidos: entra en el calendario, con los suyos.
      if (!S.tab) S.tab = !programa && quien.actaTodas.indexOf(ctx.perfil) < 0 && pest.indexOf('CALENDARIO') >= 0 ? 'CALENDARIO' : pest[0];

      el.innerHTML = (cfg.AYUDA ? '<p class="u-nota n-ayuda">' + texto(cfg.AYUDA) + '</p>' : '') +
        '<div class="lg-barra"><label class="u-campo lg-temp"><span class="u-etiqueta">Temporada</span><select id="lg-temp"></select></label>' +
        '<label class="u-campo lg-liga"><span class="u-etiqueta">Liga</span><select id="lg-liga"></select></label>' +
        '<label class="u-check lg-mios" hidden><input type="checkbox" id="lg-mios"> Solo mis partidos</label></div>' +
        '<div class="u-pestanas" role="tablist">' + pest.map(function (p) { return '<button type="button" role="tab" data-tab="' + p + '">' + PESTANAS[p] + '</button>'; }).join('') + '</div>' +
        '<div id="lg-cont" class="lg-cont"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<div class="u-velo" id="lg-velo"><div class="u-ventana" role="dialog" aria-modal="true" aria-labelledby="lg-vt"><div class="n-ventana" id="lg-vent"></div></div></div>';
      var cont = el.querySelector('#lg-cont'), velo = el.querySelector('#lg-velo'), vent = el.querySelector('#lg-vent');
      var selTemp = el.querySelector('#lg-temp'), selLiga = el.querySelector('#lg-liga'), chkMios = el.querySelector('#lg-mios');

      /* ---------- datos ---------- */

      var d, ix, temp, ligas, actual;
      function preparar() {
        d = { temp: T.filas('TEMPORADAS'), comp: T.filas('COMPETICIONES'), ligas: T.filas('LIGAS'), par: T.filas('PARTIDOS'), gol: T.filas('GOLES'),
          cam: T.filas('CAMPOS'), ins: T.filas('INSTALACIONES'), cal: T.filas('CALENDARIO'), eq: T.filas('INSCRIPCIONES_EQUIPOS') };
        ix = { comp: indice(d.comp), liga: indice(d.ligas), cam: indice(d.cam), ins: indice(d.ins), cal: indice(d.cal, 'FECHA'), eq: indice(d.eq),
          staff: indice(staff.staff) };
        var ts = temporadas(d.temp);
        temp = ts.filter(function (t) { return t.ID === S.temp; })[0] || temporadaActual(d.temp, hoy());
        selTemp.innerHTML = opciones(ts.map(function (t) { return [t.ID, t.NOMBRE]; }), temp ? temp.ID : '');
        ligas = temp ? ligasDe(d, temp.ID) : [];
        actual = ligas.filter(function (x) { return x.liga.ID === S.liga; })[0] || ligas[0] || null;
        var grupos = [], porComp = {};
        ligas.forEach(function (x) { var k = x.comp.ID; if (!porComp[k]) { porComp[k] = []; grupos.push(x.comp); } porComp[k].push(x.liga); });
        selLiga.innerHTML = grupos.map(function (c) {
          return '<optgroup label="' + texto(c.NOMBRE_COMERCIAL || c.NOMBRE) + '">' + opciones(porComp[c.ID].map(function (l) { return [l.ID, nomLiga(l)]; }), actual ? actual.liga.ID : '') + '</optgroup>';
        }).join('');
        selLiga.disabled = !ligas.length;
      }
      function nomLiga(l) { return String(l.NOMBRE || l.ID) + (l.DIA_SEMANA && String(l.NOMBRE).indexOf(l.DIA_SEMANA) < 0 ? ' · ' + l.DIA_SEMANA : ''); }
      function nomComp(c) { return c ? String(c.NOMBRE_COMERCIAL || c.NOMBRE || c.ID) : ''; }
      function equipo(id) { var e = ix.eq[String(id || '')]; return e ? String(e.NOMBRE_EQUIPO || e.ID) : id ? String(id) : ''; }
      function persona(id) { var s = ix.staff[String(id || '')]; return s ? s.APODO : id ? String(id) : ''; }
      function campo(id) { var c = ix.cam[String(id || '')]; return c ? String(c.ABREVIACION || c.NOMBRE) : String(id || ''); }
      function partidosLiga(idLiga) { return d.par.filter(function (p) { return String(p.ID_LIGA) === String(idLiga); }); }
      function equiposLiga(idLiga) {
        return d.eq.filter(function (e) { return String(e.ID_LIGA) === String(idLiga) && e.ESTADO !== 'Baja'; }).map(function (e) { return String(e.ID); });
      }
      function golesDe(id) { return d.gol.filter(function (g) { return String(g.ID_PARTIDO) === String(id); }); }
      function arbitro(p) { return p.ID_ARBITRO_REAL || p.ID_ARBITRO; }
      function esMio(p) { return !!quien.yo && (p.ID_ARBITRO === quien.yo || p.ID_ARBITRO_REAL === quien.yo || p.ID_GESTOR === quien.yo); }

      /* ---------- pintar ---------- */

      function pintar() {
        if (!S.leido) return;
        preparar();
        [].forEach.call(el.querySelectorAll('[data-tab]'), function (b) {
          var si = b.getAttribute('data-tab') === S.tab;
          b.setAttribute('aria-selected', si ? 'true' : 'false');
          if (si && b.parentNode.scrollWidth > b.parentNode.clientWidth) b.parentNode.scrollLeft = Math.max(0, b.offsetLeft - b.parentNode.offsetLeft - 16);
        });
        el.querySelector('.lg-liga').hidden = S.tab === 'CALENDARIO';
        el.querySelector('.lg-mios').hidden = S.tab !== 'CALENDARIO' || !quien.yo;
        chkMios.checked = S.mios;
        if (!temp) { cont.innerHTML = '<p class="u-vacio">Todavía no hay temporadas. Añade la primera en la tabla TEMPORADAS del Excel COMPETICION.</p>'; return; }
        if (S.tab !== 'CALENDARIO' && !actual) { cont.innerHTML = '<p class="u-vacio">Esta temporada todavía no tiene ligas. Se crean en las tablas COMPETICIONES y LIGAS del Excel COMPETICION.</p>'; return; }
        cont.innerHTML = ({ JORNADAS: htmlJornadas, CLASIFICACION: htmlClasificacion, CALENDARIO: htmlCalendario })[S.tab]();
        var sel = cont.querySelector('.lg-jornadas [aria-pressed=true]');
        if (sel) sel.parentNode.scrollLeft = Math.max(0, sel.offsetLeft - sel.parentNode.offsetLeft - sel.parentNode.clientWidth / 2 + sel.offsetWidth / 2);
        if (S.tab === 'CLASIFICACION') nombresGoleadoras();
      }

      function chipEstado(p) {
        if (p._pendiente) return '<span class="u-chip">Guardando</span>';
        return '<span class="n-estado n-e-' + (ESTADOS[p.ESTADO] || 'x') + '">' + texto(p.ESTADO || 'Sin estado') + '</span>';
      }
      /** Un partido en una lista: hora y campo, los dos equipos con su resultado, y debajo el estado y el árbitro. */
      function htmlPartido(p, conLiga) {
        var res = conResultado(p), gl = num(p.GOLES_LOCAL), gv = num(p.GOLES_VISITANTE);
        var libre = p.ESTADO === 'Libre' || !p.ID_INSCRIPCION_LOCAL || !p.ID_INSCRIPCION_VISITANTE;
        var lado = function (id, g, gana) {
          return '<span class="lg-eq' + (gana ? ' lg-gana' : '') + '"><span class="lg-nom">' + texto(equipo(id) || 'Por decidir') + '</span>' +
            (res ? '<span class="lg-gol u-cifra">' + g + '</span>' : '') + '</span>';
        };
        var meta = [conLiga && ix.liga[p.ID_LIGA] ? nomLiga(ix.liga[p.ID_LIGA]) + ' · J' + p.JORNADA : '',
          arbitro(p) ? 'Árbitro: ' + persona(arbitro(p)) : (libre ? '' : 'Sin árbitro'), p.ESTADO !== 'Programado' && p.MOTIVO ? p.MOTIVO : ''].filter(String);
        return '<button type="button" class="lg-p' + (esMio(p) ? ' lg-mio' : '') + '" data-p="' + texto(p.ID) + '">' +
          '<span class="lg-hora"><b class="u-cifra">' + texto(p.HORA || '--:--') + '</b><small>' + texto(campo(p.ID_CAMPO)) + '</small></span>' +
          '<span class="lg-eqs">' + (libre ? '<span class="lg-eq"><span class="lg-nom">' + texto(equipo(p.ID_INSCRIPCION_LOCAL || p.ID_INSCRIPCION_VISITANTE) || 'Campo libre') + '</span></span>'
            : lado(p.ID_INSCRIPCION_LOCAL, gl, res && gl > gv) + lado(p.ID_INSCRIPCION_VISITANTE, gv, res && gv > gl)) +
          '<span class="lg-meta">' + chipEstado(p) + (meta.length ? '<span>' + texto(meta.join(' · ')) + '</span>' : '') + '</span></span></button>';
      }
      /** Festivo o descanso de un día (tabla CALENDARIO), o ''. */
      function htmlDia(f) {
        var c = ix.cal[f];
        if (!c) return '';
        return '<p class="lg-aviso">' + (c.FESTIVO ? 'Festivo' : 'Sin partidos') + (c.MOTIVO ? ': ' + texto(c.MOTIVO) : '') + '</p>';
      }

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
        h += '<h2 class="n-grupo">Jornada ' + S.jornada + '</h2>';
        fechas.forEach(function (f) {
          h += (fechas.length > 1 || f ? '<h3 class="lg-dia">' + texto(f ? fechaDia(f) + ' · ' + fecha(f) : 'Sin fecha') + '</h3>' : '') + htmlDia(f) +
            '<div class="lg-lista">' + pj.filter(function (p) { return p.FECHA === f; }).map(function (p) { return htmlPartido(p); }).join('') + '</div>';
        });
        var des = descansan(pj, equiposLiga(actual.liga.ID));
        if (des.length && pj.length) h += '<p class="u-nota">Descansa' + (des.length > 1 ? 'n' : '') + ': ' + texto(des.map(equipo).sort().join(', ')) + '.</p>';
        return h;
      }

      /** Competición, día, nivel y gestor de la liga elegida (con su WhatsApp). */
      function cabLiga() {
        var l = actual.liga, g = ix.staff[l.ID_GESTOR], tel = g && wa(g.TELEFONO);
        var datos = [nomComp(actual.comp), l.DIA_SEMANA, l.NIVEL ? 'Nivel ' + l.NIVEL : ''].filter(String).join(' · ');
        return '<div class="lg-cab"><p class="u-nota">' + texto(datos) + '</p>' + (l.ID_GESTOR ? '<p class="lg-gestor">Gestor: <b>' + texto(persona(l.ID_GESTOR)) + '</b>' +
          (tel ? ' <a class="u-btn u-btn-texto" href="' + texto(tel) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</p>' : '') + '</div>';
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
            return '<tr><td class="num">' + e.pos + '</td><td class="u-tabla-t">' + texto(equipo(e.id)) + (e.jugar ? '<div class="u-nota u-solo-ancho">' + e.jugar + ' por jugar</div>' : '') + '</td>' +
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
        return h + '<table class="u-tabla n-lista lg-goleadoras"><thead><tr><th>Jugadora</th><th>Equipo</th><th class="num">Goles</th></tr></thead><tbody>' + go.map(function (g) {
          return '<tr><td class="u-tabla-t" data-jugadora="' + texto(g.jugadora) + '" data-eq="' + texto(g.equipo) + '">' + texto(nomJugadora(g.equipo, g.jugadora)) + '</td><td data-t="Equipo">' + texto(equipo(g.equipo)) +
            '</td><td class="num" data-t="Goles">' + g.goles + (g.goles === 1 ? ' gol' : ' goles') + '</td></tr>';
        }).join('') + '</tbody></table>';
      }
      function nomJugadora(eq, id) {
        var j = (JUG[eq] || []).filter(function (x) { return x.ID === id; })[0];
        return j ? j.NOMBRE + (j.DORSAL !== '' ? ' (' + j.DORSAL + ')' : '') : JUG[eq] ? id : 'Cargando…';
      }
      /** Pide los nombres de las goleadoras que aún no tiene y las pone en su sitio. */
      function nombresGoleadoras() {
        var faltan = [];
        [].forEach.call(cont.querySelectorAll('[data-jugadora]'), function (td) { var e = td.getAttribute('data-eq'); if (!JUG[e] && faltan.indexOf(e) < 0) faltan.push(e); });
        if (!faltan.length) return;
        cargarJugadoras(faltan).then(function () {
          if (!ctx.abierta()) return;
          [].forEach.call(cont.querySelectorAll('[data-jugadora]'), function (td) { td.textContent = nomJugadora(td.getAttribute('data-eq'), td.getAttribute('data-jugadora')); });
        }, function () {});
      }
      function cargarJugadoras(eqs) {
        eqs = eqs.filter(function (e) { return e && !JUG[e]; });
        if (!eqs.length) return Promise.resolve();
        return ctx.llamar('ligasJugadoras', [eqs]).then(function (r) { Object.keys(r || {}).forEach(function (e) { JUG[e] = r[e]; }); });
      }

      function htmlCalendario() {
        var ini = S.semana, fin = sumarDias(ini, 6);
        var deLigas = indice(ligasDe(d, temp.ID).map(function (x) { return x.liga; }));
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

      function ventana(html, alAbrir) {
        vent.innerHTML = html;
        velo.classList.add('abierto');
        if (alAbrir) alAbrir();
        var b = vent.querySelector('h2');
        if (b) { b.setAttribute('tabindex', '-1'); b.focus(); }
      }
      function cerrar() { velo.classList.remove('abierto'); vent.innerHTML = ''; vent.onclick = vent.oninput = null; }
      function campoF(et, html, extra) { return '<label class="u-campo' + (extra ? ' ' + extra : '') + '"><span class="u-etiqueta">' + et + '</span>' + html + '</label>'; }
      function val(id) { var e = vent.querySelector('#' + id); return e ? String(e.value).trim() : ''; }
      function verError(mal) { var e = vent.querySelector('.u-error'); e.textContent = mal.join(' '); e.hidden = !mal.length; }
      function titulo(p) { return p.ID_INSCRIPCION_LOCAL || p.ID_INSCRIPCION_VISITANTE ? equipo(p.ID_INSCRIPCION_LOCAL) + ' – ' + equipo(p.ID_INSCRIPCION_VISITANTE) : 'Campo libre'; }

      /** Ficha de un partido: todo lo suyo, sus goles y, si se puede, cerrar el acta o cambiarlo. */
      function ficha(id) {
        var p = T.fila('PARTIDOS', id);
        if (!p) return;
        var l = ix.liga[p.ID_LIGA], c = ix.cam[p.ID_CAMPO], ins = c && ix.ins[c.ID_INSTALACION], ges = ix.staff[p.ID_GESTOR], tel = ges && wa(ges.TELEFONO);
        var res = conResultado(p), gs = golesDe(p.ID), acta = puedeActa(p, quien) && !p._nueva;
        var fila = function (dt, dd) { return dd ? '<dt>' + dt + '</dt><dd>' + dd + '</dd>' : ''; };
        var html = '<h2 id="lg-vt">' + texto(titulo(p)) + '</h2>' +
          '<p class="u-nota">' + texto([l ? nomComp(ix.comp[l.ID_COMPETICION]) + ' · ' + nomLiga(l) : '', 'Jornada ' + p.JORNADA].filter(String).join(' · ')) + '</p>' +
          (res ? '<p class="lg-marcador-v"><span>' + texto(equipo(p.ID_INSCRIPCION_LOCAL)) + '</span><b class="u-cifra">' + num(p.GOLES_LOCAL) + ' – ' + num(p.GOLES_VISITANTE) + '</b><span>' + texto(equipo(p.ID_INSCRIPCION_VISITANTE)) + '</span></p>' : '') +
          '<dl class="lg-datos">' +
          fila('Estado', chipEstado(p)) +
          fila('Cuándo', texto(p.FECHA ? fechaDia(p.FECHA) + ' · ' + fecha(p.FECHA) + (p.HORA ? ' a las ' + p.HORA : '') : 'Sin fecha')) +
          fila('Campo', texto([c ? c.NOMBRE : p.ID_CAMPO, ins ? ins.NOMBRE : ''].filter(String).join(' · ')) + (ins && ins.UBICACION_URL ? ' <a href="' + texto(ins.UBICACION_URL) + '" target="_blank" rel="noopener">Cómo llegar</a>' : '')) +
          fila('Árbitro', texto(p.ID_ARBITRO ? persona(p.ID_ARBITRO) : 'Sin asignar') + (p.ID_ARBITRO_REAL ? ' · arbitró ' + texto(persona(p.ID_ARBITRO_REAL)) : '')) +
          fila('Gestor', p.ID_GESTOR ? texto(persona(p.ID_GESTOR)) + (tel ? ' <a href="' + texto(tel) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') : '') +
          fila('Motivo', texto(p.MOTIVO)) +
          fila('Anulado por', texto(p.ANULADO_POR ? equipo(p.ANULADO_POR) : '')) +
          fila('Notas', texto(p.NOTAS)) + '</dl>';
        if (res) {
          html += '<h3 class="lg-sub">Goles</h3>';
          if (!gs.length) html += '<p class="u-nota">El acta no dice quién marcó.</p>';
          else html += '<ul class="lg-goles" id="lg-goles">' + [p.ID_INSCRIPCION_LOCAL, p.ID_INSCRIPCION_VISITANTE].map(function (e) {
            return gs.filter(function (g) { return g.ID_INSCRIPCION_EQUIPO === e; }).map(function (g) {
              return '<li><span>' + texto(equipo(e)) + '</span> <b data-jugadora="' + texto(g.ID_INSCRIPCION_JUGADORA) + '" data-eq="' + texto(g.ID_INSCRIPCION_JUGADORA ? e : '') + '">' +
                texto(g.ID_INSCRIPCION_JUGADORA ? nomJugadora(e, g.ID_INSCRIPCION_JUGADORA) : 'Gol en propia del rival') + '</b></li>';
            }).join('');
          }).join('') + '</ul>';
        }
        html += '<div class="n-botones">' + (acta ? '<button type="button" class="u-btn u-btn-accion" id="lg-acta">' + (p.ESTADO === 'Jugado' ? 'Cambiar el acta' : 'Cerrar el acta') + '</button>' : '') +
          (programa && !p._nueva ? '<button type="button" class="u-btn" id="lg-prog">Cambiar el partido</button>' : '') +
          '<button type="button" class="u-btn' + (acta || programa ? ' u-btn-texto' : '') + '" data-cerrar>Cerrar</button></div>';
        ventana(html, function () {
          var a = vent.querySelector('#lg-acta'), b = vent.querySelector('#lg-prog');
          if (a) a.onclick = function () { formActa(p); };
          if (b) b.onclick = function () { formPartido(p); };
          var faltan = gs.filter(function (g) { return g.ID_INSCRIPCION_JUGADORA && !JUG[g.ID_INSCRIPCION_EQUIPO]; }).map(function (g) { return g.ID_INSCRIPCION_EQUIPO; });
          if (faltan.length) cargarJugadoras(faltan).then(function () {
            [].forEach.call(vent.querySelectorAll('#lg-goles [data-jugadora]'), function (x) { x.textContent = nomJugadora(x.getAttribute('data-eq'), x.getAttribute('data-jugadora')); });
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
          return '<div class="lg-lado"><span class="u-etiqueta">' + texto(k) + '</span><b>' + texto(equipo(e)) + '</b>' +
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
            cerrar();
            T.actualizar('PARTIDOS', p.ID, cambios, { fn: 'ligasActa', args: [p.ID, acta] }).then(function (r) {
              if (r && r.quitados) T.refrescar(['GOLES']).catch(function () {});
              if (ctx.abierta()) ctx.aviso('Acta guardada: ' + equipo(L) + ' ' + gl + ' – ' + gv + ' ' + equipo(V) + '.');
            }, function () {});
          };
        });
      }

      /** Cambiar la programación: fecha, hora, campo, árbitro, gestor y estado (aplazar, suspender, anular…). */
      function formPartido(p) {
        var ests = ['Programado', 'Aplazado', 'Suspendido', 'Anulado', 'Libre'].concat(p.ESTADO === 'Jugado' ? ['Jugado'] : []);
        var conStaff = function (f, ya) {
          var l = staff.staff.filter(function (s) { return f(s) && s.ACTIVO; }).map(function (s) { return s.ID; });
          ya.forEach(function (x) { if (x && l.indexOf(x) < 0) l.push(x); });
          return l.map(function (x) { return [x, persona(x)]; });
        };
        var campos = d.cam.map(function (c) { return [c.ID, (c.ABREVIACION ? c.ABREVIACION + ' · ' : '') + c.NOMBRE]; });
        var html = '<h2 id="lg-vt">' + texto(titulo(p)) + '</h2><p class="u-nota">Jornada ' + texto(p.JORNADA) + '. Los cambios se ven al momento y se guardan en el Excel por detrás.</p>' +
          '<div class="u-campos">' +
          campoF('Día', '<input type="date" id="lg-FECHA" value="' + texto(p.FECHA) + '">') +
          campoF('Hora', '<input type="time" id="lg-HORA" value="' + texto(p.HORA) + '">') +
          campoF('Campo', '<select id="lg-ID_CAMPO">' + opciones(campos, p.ID_CAMPO, 'Elige el campo') + '</select>', 'u-ancho') +
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
            vent.querySelector('.lg-si-motivo').hidden = ['Aplazado', 'Suspendido', 'Anulado'].indexOf(e) < 0;
          }
          ver();
          vent.querySelector('#lg-ESTADO').onchange = ver;
          var g = vent.querySelector('#lg-guardar');
          g.onclick = function () {
            var v = {}, c = {}, mal = [];
            ['FECHA', 'HORA', 'ID_CAMPO', 'ID_ARBITRO', 'ID_GESTOR', 'ESTADO', 'MOTIVO', 'ANULADO_POR', 'NOTAS'].forEach(function (k) { v[k] = val('lg-' + k); });
            if (v.ESTADO !== 'Anulado') v.ANULADO_POR = '';
            if (['Aplazado', 'Suspendido', 'Anulado'].indexOf(v.ESTADO) < 0) v.MOTIVO = '';
            else if (!v.MOTIVO) mal.push('Di el motivo.');
            if (!v.FECHA || !v.HORA || !v.ID_CAMPO) mal.push('El partido necesita día, hora y campo.');
            Object.keys(v).forEach(function (k) { if (String(p[k] == null ? '' : p[k]) !== v[k]) c[k] = v[k]; });
            verError(mal);
            if (mal.length) return;
            if (!Object.keys(c).length) { cerrar(); return; }
            var pierde = p.ESTADO === 'Jugado' && v.ESTADO !== 'Jugado';
            if (pierde && !g.getAttribute('data-ok')) { g.setAttribute('data-ok', '1'); g.textContent = 'Se borra el resultado y sus goles: pulsa otra vez'; return; }
            var pantalla = Object.assign({}, c, pierde ? { GOLES_LOCAL: '', GOLES_VISITANTE: '' } : {});
            cerrar();
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
        b = t.closest('[data-jornada]'); if (b) { S.jornada = Number(b.getAttribute('data-jornada')); pintar(); return; }
        b = t.closest('[data-semana]'); if (b) { var n = Number(b.getAttribute('data-semana')); S.semana = n ? sumarDias(S.semana, n) : lunes(hoy()); pintar(); return; }
        b = t.closest('[data-ir-pend]'); if (b) { S.semana = lunes(b.getAttribute('data-ir-pend')); pintar(); return; }
        b = t.closest('[data-p]'); if (b) ficha(b.getAttribute('data-p'));
      });
      el.addEventListener('keydown', function (e) { if (e.key === 'Escape' && velo.classList.contains('abierto')) cerrar(); });
      velo.addEventListener('click', function (e) { if (e.target === velo) cerrar(); });
      el.addEventListener('change', function (e) {
        var t = e.target;
        if (t === selTemp) { S.temp = t.value; S.liga = ''; S.jornada = null; guardado(CLAVE + 'temp', t.value); pintar(); }
        else if (t === selLiga) { S.liga = t.value; S.jornada = null; guardado(CLAVE + 'liga', t.value); pintar(); }
        else if (t === chkMios) { S.mios = t.checked; guardado(CLAVE + 'mios', t.checked ? 'si' : 'no'); pintar(); }
      });

      ctx.alCambiar(function (t) { if (TABLAS.indexOf(t) >= 0 && !velo.classList.contains('abierto')) pintar(); });
      ctx.tablas.leer(TABLAS).then(function () { S.leido = true; pintar(); }, function (e) {
        cont.innerHTML = '<p class="u-error">No se han podido leer las ligas.</p><p class="u-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Vuelve a abrir la sección para probar otra vez.</p>';
      });
      // Los nombres del staff: los guardados, al momento; los de ahora, por detrás.
      ctx.llamar('ligasStaff').then(function (r) {
        staff = r || staff; guardadoJson(KSTAFF, staff); quien.yo = staff.yo;
        if (ix) ix.staff = indice(staff.staff);
        if (ctx.abierta() && !velo.classList.contains('abierto')) pintar();
      }, function () {});
      this._cerrar = cerrar;
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); }
  });
})();
