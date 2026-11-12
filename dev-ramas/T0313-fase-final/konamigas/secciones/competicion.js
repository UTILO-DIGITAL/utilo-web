/*
 * Ligas · plataforma de Konamigas sobre Supabase (T0394, K5) · clientes/konamigas/modulos/competicion de utilo-apps
 *
 * Las ligas de Konamigas para todo el que entra, cada uno con lo suyo (sus roles, T0390; quién ve qué lo dicen las reglas
 * por fila de la base, y aquí solo se ofrece lo que sus roles le dejan hacer):
 * - Arriba, la barra de la plataforma: buscar un equipo y «Filtros» (la hoja de siempre: Temporada, Liga y, a quien arbitra o
 *   gestiona, Solo mis partidos). Debajo, tres pestañas: Partidos, Clasificación y Goleadoras.
 * - Partidos: los días de juego de la liga en una tira (J1, J2… y JR, los de recuperación), con una barrita de cómo va cada
 *   uno; debajo, los partidos del día elegido con su marcador, hora, campo y árbitro, quién descansa y lo que hay que saber
 *   (aplazado y cuándo se recupera, no presentado, quién debe una multa). Con «Todas» las ligas, como el calendario de un
 *   árbitro. Arriba, lo pendiente: actas por cerrar, aplazados por recuperar y anulados sin su sanción.
 * - Clasificación y Goleadoras salen de las vistas de la base (clasificacion, goleadoras, ligas_resumen), que cuentan todos
 *   los partidos aunque quien mira solo vea los suyos.
 * - La fase final (T0313): bloques fijos de 4 por la clasificación (Oro, Plata…), semifinales una semana y final y tercer
 *   puesto la siguiente, en los horarios de la liga. Sus partidos van atados al puesto: quien lleva la liga los crea cuando
 *   quiera (ligas_fase_final) y cada puesto pasa a ser su equipo al acabar la liga (lo hace la base). Hasta entonces se ve
 *   quién iría si la liga acabara hoy. Sale en Partidos («Semis» y «Final» en la tira) y en Clasificación, debajo de la
 *   tabla, que solo cuenta la liga. Un empate se decide por penaltis, en el acta.
 * - Fichas: la del partido (marcador con los colores, quién marcó, datos, sanciones y lo que se puede hacer), la del equipo
 *   (cómo va, próximo partido, últimos resultados, plantilla, su carta de aplazamiento y sus sanciones) y la de una jugadora
 *   (sus goles por temporada).
 * - Hacer (lo que dejan sus roles; la base lo vuelve a mirar):
 *   - El árbitro de un partido, desde ese día: el acta (resultado y quién marcó), un equipo no se presentó o se suspendió.
 *   - Quien gestiona la liga o el partido: además, aplazar (con la carta del equipo, ligas_carta), anular, campo libre,
 *     árbitro y notas; mover a otro hueco del día, intercambiar dos jornadas y recuperar aplazados en huecos libres, con la
 *     lista de capitanas para avisarlas por WhatsApp con el mensaje escrito; y las sanciones: apuntarlas, cobrar la multa
 *     (factura en Economía) y pagar al rival (justificante en PDF, la función del servidor justificante).
 *   - Lo interno (admin, socio): todo, también el importe de una multa.
 *   - La capitana y la jugadora: mirar (sus partidos, la liga entera en Clasificación y Goleadoras).
 * Escribe con las funciones ligas_* de la base (T0392); la pantalla cambia al momento y, al acabar, vuelve a leer lo que ha
 * cambiado. En directo (Realtime): partidos, goles y sanciones. Sin ↻.
 * Los cálculos (CALC) se prueban en node (herramientas/probar-competicion.js). Estilos: estilos/base.css (.lg-*) y la barra y
 * la hoja de estilos/kanban.css, como el resto de la plataforma.
 */
(function () {
  'use strict';

  var TABLAS = ['TEMPORADAS', 'COMPETICIONES', 'LIGAS', 'PARTIDOS', 'GOLES', 'CAMPOS', 'INSTALACIONES', 'CALENDARIO', 'HUECOS', 'SANCIONES',
    'EQUIPOS_INSCRITOS', 'STAFF', 'STAFF_NOMBRES', 'COLORES', 'CONFIG', 'CLASIFICACION', 'GOLEADORAS', 'LIGAS_RESUMEN'];
  /** Lo que cambia en la base al escribir con cada función: se vuelve a leer al acabar (la base no devuelve las filas). */
  var CAMBIA = {
    ligas_acta: ['PARTIDOS', 'GOLES', 'CLASIFICACION', 'GOLEADORAS', 'LIGAS_RESUMEN'],
    ligas_partido: ['PARTIDOS', 'GOLES', 'SANCIONES', 'CLASIFICACION', 'GOLEADORAS', 'LIGAS_RESUMEN'],
    ligas_mover: ['PARTIDOS'], ligas_jornadas: ['PARTIDOS'], ligas_recuperar: ['PARTIDOS', 'CLASIFICACION'],
    ligas_sancion: ['SANCIONES'], ligas_sancion_quitar: ['SANCIONES'], ligas_sanciones_faltan: ['SANCIONES'],
    ligas_sancion_pagar: ['SANCIONES'], ligas_sancion_despagar: ['SANCIONES'], justificante: ['SANCIONES'],
    ligas_fase_final: ['PARTIDOS', 'EQUIPOS_INSCRITOS'], ligas_fase_final_quitar: ['PARTIDOS', 'EQUIPOS_INSCRITOS']
  };
  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var FUERA = ['Aplazado', 'Suspendido', 'Anulado'];   // no ocupan su hueco y llevan motivo
  var POR_RECUPERAR = ['Aplazado', 'Suspendido'];     // se vuelven a jugar otro día (normativa)
  var MOTIVOS_SUSPENDER = ['Lluvia', 'Lesión', 'Pista en mal estado', 'Otro'];
  var TIPOS_SANCION = ['No presentado', 'Aplazamiento fuera de plazo', 'Aplazamiento sin carta', 'Retraso', 'Alineación indebida', 'Conducta', 'Otro'];
  var EN_PROPIA = 'En propia', PUNTUALIDAD = 'Puntualidad';
  /** La configuración de Ligas que lee la pantalla, de CONFIG de la base; sin ella (la jugadora no la ve), la de siempre. */
  var CONFIG_LIGAS = { PUNTOS: { GANAR: 3, EMPATAR: 1, PERDER: 0 }, RESULTADO_ANULADO: 5, CARTA_DIAS: 7, SIN_CLASIFICACION: ['Copa', 'Supercopa'],
    SANCION_MULTAS: { 'No presentado': { MULTA: 60, RIVAL: 50, ARBITRO: 10 }, 'Aplazamiento fuera de plazo': { MULTA: 60, RIVAL: 50, ARBITRO: 10 },
      'Aplazamiento sin carta': { MULTA: 60, RIVAL: 50, ARBITRO: 10 } } };

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  /* ---------- fechas y números ---------- */

  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function hoy() { return iso(new Date()); }
  function deIso(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function sumarDias(s, n) { var d = deIso(s); if (!d) return ''; d.setDate(d.getDate() + n); return iso(d); }
  /** «2026-11-03» → «03/11/2026»; corta: «03/11». */
  function fecha(s, corta) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + (corta ? '' : '/' + m[1]) : String(s || ''); }
  /** «2026-11-03» → «Martes 3 nov». */
  function fechaDia(s) { var d = deIso(s); return d ? DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()] : String(s || ''); }
  /** «2026-11-09» → «lunes 9 de noviembre». */
  function fechaLarga(s) { var d = deIso(s); return d ? DIAS[d.getDay()].toLowerCase() + ' ' + d.getDate() + ' de ' + MESES_LARGOS[d.getMonth()] : String(s || ''); }
  function num(v) { return typeof v === 'number' ? v : String(v == null ? '' : v).trim() === '' ? NaN : Number(v); }
  function orden(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function indice(filas, k) { var o = {}; (filas || []).forEach(function (f) { o[String(f[k || 'ID'])] = f; }); return o; }
  function cuando(p) { return String(p.FECHA || '') + ' ' + String(p.HORA || ''); }
  /** 60 → «60 €»; 20.5 → «20,50 €». */
  function euros(n) { n = Math.round(num(n) * 100) / 100; return (n % 1 ? n.toFixed(2).replace('.', ',') : String(n)) + ' €'; }

  /* ---------- la configuración ---------- */

  /** La configuración de Ligas: la de CONFIG de la base (texto o JSON) sobre la de siempre; lo que no se entiende, la de siempre. */
  function configuracion(filas) {
    var out = JSON.parse(JSON.stringify(CONFIG_LIGAS));
    (filas || []).forEach(function (f) {
      var c = String(f.ID || ''), v = f.VALOR, x = v;
      if (!(c in CONFIG_LIGAS) || v === '' || v == null) return;
      try { x = JSON.parse(v); } catch (e) { /* texto */ }
      if (c === 'SIN_CLASIFICACION' && typeof x === 'string') x = x.split(',').map(function (s) { return s.trim(); }).filter(String);
      var numero = c === 'RESULTADO_ANULADO' || c === 'CARTA_DIAS';
      var bien = numero ? isFinite(num(x)) : c === 'SIN_CLASIFICACION' ? Array.isArray(x) : !!x && typeof x === 'object' && !Array.isArray(x);
      if (bien) out[c] = numero ? num(x) : x;
    });
    return out;
  }

  /* ---------- temporadas y ligas ---------- */

  /** Las temporadas, de la más nueva a la más vieja; la de hoy (o, si no hay, la más nueva). */
  function temporadas(filas) { return (filas || []).slice().sort(function (a, b) { return orden(String(b.FECHA_INICIO || b.ID), String(a.FECHA_INICIO || a.ID)); }); }
  function temporadaActual(filas, h) {
    var l = temporadas(filas);
    return l.filter(function (t) { return t.FECHA_INICIO && t.FECHA_FIN && t.FECHA_INICIO <= h && h <= t.FECHA_FIN; })[0] || l[0] || null;
  }
  /** Las ligas de una temporada, [{ liga, comp }], por competición (la que empieza antes) y por día de la semana. */
  function ligasDe(comps, ligas, temp) {
    var ci = indice((comps || []).filter(function (c) { return String(c.ID_TEMPORADA) === String(temp); }));
    var dia = function (l) { var i = DIAS.indexOf(l.DIA_SEMANA); return i < 0 ? 9 : (i + 6) % 7; };
    return (ligas || []).filter(function (l) { return ci[l.ID_COMPETICION]; }).map(function (l) { return { liga: l, comp: ci[l.ID_COMPETICION] }; })
      .sort(function (a, b) {
        return orden(String(a.comp.FECHA_INICIO || ''), String(b.comp.FECHA_INICIO || '')) || orden(String(a.comp.NOMBRE), String(b.comp.NOMBRE)) ||
          dia(a.liga) - dia(b.liga) || String(a.liga.NOMBRE).localeCompare(String(b.liga.NOMBRE), 'es');
      });
  }

  /* ---------- partidos ---------- */

  /** ¿Lleva marcador? Jugado o anulado por culpa de un equipo (la base le pone el 0-5 que cuenta), con los dos equipos. */
  function conMarcador(p) { return (p.ESTADO === 'Jugado' || (p.ESTADO === 'Anulado' && !!p.ANULADO_POR)) && !!p.ID_INSCRIPCION_LOCAL && !!p.ID_INSCRIPCION_VISITANTE && isFinite(num(p.GOLES_LOCAL)) && isFinite(num(p.GOLES_VISITANTE)); }
  /** Un partido visto desde un equipo: { p, rival, hay (tiene marcador), a (sus goles), b (los del rival), r ('G', 'E', 'P' o '') }. */
  function resultadoDe(p, ie) {
    var loc = String(p.ID_INSCRIPCION_LOCAL) === String(ie), gl = num(p.GOLES_LOCAL), gv = num(p.GOLES_VISITANTE), hay = conMarcador(p);
    var a = loc ? gl : gv, b = loc ? gv : gl;
    return { p: p, rival: loc ? p.ID_INSCRIPCION_VISITANTE : p.ID_INSCRIPCION_LOCAL, hay: hay, a: a, b: b, r: !hay ? '' : a > b ? 'G' : a < b ? 'P' : 'E' };
  }
  /** ¿Le falta un equipo por un fallo de los datos? En una eliminatoria (elim), uno sin jugar puede tener un equipo por decidir. */
  function incompleto(p, elim) {
    if (p.ESTADO === 'Libre' || !p.ID_INSCRIPCION_LOCAL === !p.ID_INSCRIPCION_VISITANTE) return false;
    return !elim || p.ESTADO === 'Jugado';
  }
  function jornadas(ps) {
    var o = {};
    ps.forEach(function (p) { var j = num(p.JORNADA); if (isFinite(j)) o[j] = 1; });
    return Object.keys(o).map(Number).sort(function (a, b) { return a - b; });
  }
  /**
   * Los días de juego, en orden: [{ fecha, jornadas (sin las recuperaciones), jr (solo recuperaciones), ff, ps }]. ff (T0313):
   * un día de la fase final, «Semifinales» o «Finales» (con final o tercer puesto); vacío si es de la liga.
   */
  function diasDeJuego(ps) {
    var o = {};
    ps.forEach(function (p) { if (p.FECHA) (o[p.FECHA] = o[p.FECHA] || []).push(p); });
    return Object.keys(o).sort().map(function (f) {
      var base = o[f].filter(function (p) { return !p.ID_PARTIDO_ORIGEN; }), js = jornadas(base.filter(function (p) { return !p.FASE; }));
      var ff = base.length > 0 && base.every(function (p) { return !!p.FASE; }) ? (base.every(function (p) { return p.RONDA === 'Semifinal'; }) ? 'Semifinales' : 'Finales') : '';
      return { fecha: f, jornadas: js, jr: !js.length && !ff, ff: ff, ps: o[f] };
    });
  }
  /** Cómo va un día: { jugado, anulado, aplazado (o suspendido), pendiente, total }, sin los de campo libre. */
  function resumenDia(ps) {
    var r = { jugado: 0, anulado: 0, aplazado: 0, pendiente: 0, total: 0 };
    ps.forEach(function (p) {
      if (p.ESTADO === 'Libre' || !p.ID_INSCRIPCION_LOCAL || !p.ID_INSCRIPCION_VISITANTE) return;
      r.total++;
      if (p.ESTADO === 'Jugado') r.jugado++;
      else if (p.ESTADO === 'Anulado') r.anulado++;
      else if (POR_RECUPERAR.indexOf(p.ESTADO) >= 0) r.aplazado++;
      else r.pendiente++;
    });
    return r;
  }
  /** El día que se abre: el primero de hoy en adelante; si no hay, el último. */
  function diaInicial(dias, h) { var x = dias.filter(function (d) { return d.fecha >= h; })[0] || dias[dias.length - 1]; return x ? x.fecha : ''; }
  /** Los equipos de una liga que no juegan esa jornada. */
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
  /** Los goles de un equipo en un partido, juntos: [{ jugadora, tipo ('jugadora', 'nadie': en propia, 'puntualidad'), goles }]. */
  function golesEquipo(goles, eq) {
    var o = {}, l = [], peso = { jugadora: 0, nadie: 1, puntualidad: 2 };
    (goles || []).forEach(function (g) {
      if (String(g.ID_INSCRIPCION_EQUIPO) !== String(eq)) return;
      var tipo = g.ID_INSCRIPCION_JUGADORA ? 'jugadora' : String(g.NOTAS || '').trim() === PUNTUALIDAD ? 'puntualidad' : 'nadie', k = tipo + '|' + String(g.ID_INSCRIPCION_JUGADORA || '');
      if (!o[k]) { o[k] = { jugadora: String(g.ID_INSCRIPCION_JUGADORA || ''), tipo: tipo, goles: 0 }; l.push(o[k]); }
      o[k].goles++;
    });
    return l.sort(function (a, b) { return peso[a.tipo] - peso[b.tipo] || b.goles - a.goles; });
  }
  /** Lo que es ahora un partido, con las claves de «Acta y estado» (las de PARTIDOS_DETALLE · PUEDE): la opción marcada. */
  function queEs(p) {
    if (p.ESTADO === 'Anulado' && p.APLAZADO_POR && p.APLAZADO_POR === p.ANULADO_POR) return 'aplazado'; // pidió aplazarlo y no se aceptó
    return { Jugado: 'jugado', Suspendido: 'suspendido', Aplazado: 'aplazado', Libre: 'libre' }[p.ESTADO] || (p.ESTADO === 'Anulado' ? (p.ANULADO_POR ? 'nopresentado' : 'anulado') : 'porjugar');
  }

  /* ---------- la fase final (T0313) ---------- */

  var RONDAS = ['Semifinal', 'Final', 'Tercer puesto'];
  /** Lo que es un partido de la fase final, «Oro · Semifinal»; vacío si es de la liga. */
  function faseDe(p) { return p.FASE ? p.FASE + (p.RONDA ? ' · ' + p.RONDA : '') : ''; }
  /** Quién gana un partido con marcador ('l', 'v' o ''): el que marca más y, en un empate, el de los penaltis. */
  function ganaLado(p) {
    if (!conMarcador(p)) return '';
    var gl = num(p.GOLES_LOCAL), gv = num(p.GOLES_VISITANTE), pl = num(p.PENALTIS_LOCAL), pv = num(p.PENALTIS_VISITANTE);
    return gl > gv ? 'l' : gl < gv ? 'v' : isFinite(pl) && isFinite(pv) && pl !== pv ? (pl > pv ? 'l' : 'v') : '';
  }
  /** Los bloques de la fase final de una liga, en el orden en que se crearon: [{ fase, ps }] (semifinales, final y tercer puesto). */
  function bloquesFase(ps) {
    var orden1 = [], o = {};
    (ps || []).filter(function (p) { return !!p.FASE; }).sort(function (a, b) { return orden(String(a.ID), String(b.ID)); }).forEach(function (p) {
      if (!o[p.FASE]) { o[p.FASE] = []; orden1.push(p.FASE); }
      o[p.FASE].push(p);
    });
    return orden1.map(function (f) {
      return { fase: f, ps: o[f].sort(function (a, b) { return RONDAS.indexOf(a.RONDA) - RONDAS.indexOf(b.RONDA) || orden(cuando(a), cuando(b)); }) };
    });
  }
  /** Los bloques de la fase final de una liga con n equipos (como ligas.bloques_fase): [{ fase, desde, hasta }]; si sobra uno, descansa. */
  function bloquesPuestos(n) {
    var r = [], nombres = ['Oro', 'Plata', 'Bronce'];
    for (var b = 1; 4 * b - 3 <= n; b++) if (Math.min(4 * b, n) > 4 * b - 3) r.push({ fase: nombres[b - 1] || 'Bloque ' + b, desde: 4 * b - 3, hasta: Math.min(4 * b, n) });
    return r;
  }
  /**
   * Los partidos de un bloque, como los crea la base: [{ FASE, RONDA, PUESTO_LOCAL, PUESTO_VISITANTE }]; la final y el tercer
   * puesto de un bloque de 4 salen de las semifinales (sin puestos). De 3: semifinal 2.ª–3.ª y final contra la 1.ª. De 2: la final.
   */
  function crucesBloque(b) {
    var d = b.desde, k = b.hasta - d + 1, x = function (r, l, v) { return { FASE: b.fase, RONDA: r, PUESTO_LOCAL: l, PUESTO_VISITANTE: v, ESTADO: 'Programado' }; };
    if (k === 4) return [x('Semifinal', d, d + 3), x('Semifinal', d + 1, d + 2), x('Final', '', ''), x('Tercer puesto', '', '')];
    if (k === 3) return [x('Semifinal', d + 1, d + 2), x('Final', d, '')];
    return [x('Final', d, d + 1)];
  }
  /**
   * Quién juega en un lado ('l' o 'v') de un partido de la fase final sin equipo: «1.ª» o, en una final o un tercer puesto, de
   * qué semifinal sale («Ganadora 1.ª–4.ª»). semis: las semifinales de su bloque, por su orden. { puesto (número o NaN), txt }.
   */
  function huecoFase(p, lado, semis) {
    var n = num(lado === 'l' ? p.PUESTO_LOCAL : p.PUESTO_VISITANTE);
    if (isFinite(n)) return { puesto: n, txt: n + '.ª' };
    var s = (semis || []).length === 1 ? semis[0] : (semis || [])[lado === 'l' ? 0 : 1];
    return { puesto: NaN, txt: s ? (p.RONDA === 'Tercer puesto' ? 'Perdedora ' : 'Ganadora ') + num(s.PUESTO_LOCAL) + '.ª–' + num(s.PUESTO_VISITANTE) + '.ª' : 'Por decidir' };
  }

  /* ---------- sanciones ---------- */

  /** Las sanciones de un partido o de un equipo (o: { partido, equipo }), de la más nueva a la más vieja. */
  function sancionesDe(sans, o) {
    return (sans || []).filter(function (s) {
      return (!o.partido || String(s.ID_PARTIDO || '') === String(o.partido)) && (!o.equipo || String(s.ID_INSCRIPCION_EQUIPO || '') === String(o.equipo));
    }).sort(function (a, b) { return orden(String(b.FECHA || ''), String(a.FECHA || '')) || orden(String(b.ID), String(a.ID)); });
  }
  /** El dinero de una sanción en una línea: «Multa de 60 €: la debe» o «pagada el …» y lo del rival. */
  function dineroSancion(s, nomRival) {
    var m = num(s.IMPORTE), r = num(s.COMPENSACION);
    if (!(m > 0)) return '';
    var t = 'Multa de ' + euros(m) + ': ' + (s.FECHA_PAGO ? 'pagada el ' + fecha(s.FECHA_PAGO) : 'la debe');
    if (s.FECHA_PAGO && r > 0) t += s.FECHA_COMPENSACION ? ' · ' + euros(r) + ' dados a ' + (nomRival || 'el rival') + ' el ' + fecha(s.FECHA_COMPENSACION) : ' · debemos ' + euros(r) + ' a ' + (nomRival || 'el rival');
    return t;
  }
  /** La multa de la normativa para un tipo (SANCION_MULTAS): { IMPORTE, COMPENSACION, PARA_ARBITRO }, vacía si no tiene. */
  function multaDe(multas, tipo) {
    var m = (multas || {})[tipo] || {}, v = function (x) { return x === undefined ? '' : x; };
    return { IMPORTE: v(m.MULTA), COMPENSACION: v(m.RIVAL), PARA_ARBITRO: v(m.ARBITRO) };
  }

  /* ---------- lo que dan las vistas y las tablas de la base ---------- */

  /** El staff: { yo (su ID_STAFF, por su persona), staff: [{ ID, APODO, ARBITRO, GESTOR, ACTIVO, TELEFONO }] } (el teléfono, de las fichas que ve). */
  function staffDe(nombres, fichas, personaId) {
    var tel = {}, yo = '';
    (fichas || []).forEach(function (s) { tel[s.ID] = String(s.TELEFONO || ''); if (personaId && String(s.PERSONA) === String(personaId)) yo = String(s.ID); });
    return {
      yo: yo,
      staff: (nombres || []).map(function (s) {
        return { ID: String(s.ID), APODO: String(s.APODO || s.ID), ARBITRO: s.ES_ARBITRO === true, GESTOR: s.ES_GESTOR === true, ACTIVO: s.ACTIVO === true, TELEFONO: tel[s.ID] || '' };
      }).sort(function (a, b) { return a.APODO.localeCompare(b.APODO, 'es'); })
    };
  }
  /** Los colores: { ID: { NOMBRE, HEX } } (un HEX que no lo es, vacío). */
  function coloresDe(filas) {
    var r = {};
    (filas || []).forEach(function (c) { var hex = String(c.COLOR_HEX || '').trim(); r[c.ID] = { NOMBRE: String(c.NOMBRE || ''), HEX: /^#[0-9a-f]{6}$/i.test(hex) ? hex : '' }; });
    return r;
  }
  /** Las jugadoras de cada inscripción (PLANTILLAS y NOMBRES_JUGADORAS): { IJ: { ID, JUGADORA, EQUIPO, NOMBRE, DORSAL, ACTIVA } }. */
  function jugadorasDe(plantillas, nombres) {
    var nom = {}, r = {};
    (nombres || []).forEach(function (n) { nom[n.ID] = String(n.NOMBRE || ''); });
    (plantillas || []).forEach(function (i) {
      r[i.ID] = { ID: String(i.ID), JUGADORA: String(i.ID_JUGADORA || ''), EQUIPO: String(i.ID_INSCRIPCION_EQUIPO || ''),
        NOMBRE: nom[i.ID_JUGADORA] || 'Sin nombre', DORSAL: String(i.DORSAL == null ? '' : i.DORSAL), ACTIVA: i.ESTADO !== 'Baja' };
    });
    return r;
  }
  /** La plantilla de un equipo, por dorsal (las sin dorsal, al final, por nombre). */
  function plantilla(jugadoras, ie) {
    return Object.keys(jugadoras).map(function (k) { return jugadoras[k]; }).filter(function (j) { return j.EQUIPO === String(ie); }).sort(function (a, b) {
      var x = parseInt(a.DORSAL, 10), y = parseInt(b.DORSAL, 10);
      if (isFinite(x) && isFinite(y) && x !== y) return x - y;
      if (isFinite(x) !== isFinite(y)) return isFinite(x) ? -1 : 1;
      return a.NOMBRE.localeCompare(b.NOMBRE, 'es');
    });
  }
  /** La clasificación de una liga (vista CLASIFICACION), por puesto: [{ pos, id, pj, pg, pe, pp, gf, gc, dg, pts, jugar, racha }]. */
  function clasificacion(filas, idLiga) {
    return (filas || []).filter(function (f) { return String(f.ID_LIGA) === String(idLiga); }).map(function (f) {
      var n = function (k) { return num(f[k]) || 0; };
      return { pos: n('PUESTO'), id: String(f.ID_INSCRIPCION_EQUIPO), pj: n('PJ'), pg: n('PG'), pe: n('PE'), pp: n('PP'), gf: n('GF'), gc: n('GC'), dg: n('DG'),
        pts: n('PTS'), jugar: n('POR_JUGAR'), racha: String(f.RACHA || ''), baja: f.BAJA === true || f.BAJA === 'true' };
    }).sort(function (a, b) { return a.pos - b.pos; });
  }
  /** Goles y partidos jugados de unas ligas (vista LIGAS_RESUMEN, sin el 0-5 de los anulados): { goles, jugados, media }. */
  function resumenGoles(filas, ligas) {
    var g = 0, j = 0;
    (filas || []).forEach(function (f) { if (ligas.indexOf(String(f.ID_LIGA)) >= 0) { g += num(f.GOLES) || 0; j += num(f.JUGADOS) || 0; } });
    return { goles: g, jugados: j, media: j ? Math.round(g / j * 10) / 10 : 0 };
  }
  /** Las goleadoras de unas ligas por persona (vista GOLEADORAS): [{ jugadora (ID_JUGADORA), ijs, equipos, goles }], de más a menos. */
  function goleadoras(filas, ligas) {
    var g = {}, l = [];
    (filas || []).forEach(function (f) {
      if (ligas.indexOf(String(f.ID_LIGA)) < 0) return;
      var k = String(f.ID_JUGADORA), ij = String(f.ID_INSCRIPCION_JUGADORA), e = String(f.ID_INSCRIPCION_EQUIPO || '');
      if (!g[k]) { g[k] = { jugadora: k, ijs: [], equipos: [], goles: 0 }; l.push(g[k]); }
      g[k].goles += num(f.GOLES) || 0;
      if (g[k].ijs.indexOf(ij) < 0) g[k].ijs.push(ij);
      if (e && g[k].equipos.indexOf(e) < 0) g[k].equipos.push(e);
    });
    return l.sort(function (a, b) { return b.goles - a.goles || orden(a.jugadora, b.jugadora); });
  }
  /** Los goles de una jugadora (su ID_JUGADORA) por temporada, con sus equipos y los partidos que jugaron: { total, temporadas }. */
  function golesJugadora(gol, clas, jugadora) {
    var t = {}, total = 0, pj = {};
    (clas || []).forEach(function (c) { pj[c.ID_INSCRIPCION_EQUIPO] = num(c.PJ) || 0; });
    (gol || []).forEach(function (f) {
      if (String(f.ID_JUGADORA) !== String(jugadora)) return;
      var tem = String(f.ID_TEMPORADA || ''), x = t[tem] || (t[tem] = { temporada: tem, equipos: [], ligas: [], goles: 0, jugados: 0 }), n = num(f.GOLES) || 0;
      x.goles += n; total += n;
      if (x.equipos.indexOf(f.ID_INSCRIPCION_EQUIPO) < 0) { x.equipos.push(f.ID_INSCRIPCION_EQUIPO); x.jugados += pj[f.ID_INSCRIPCION_EQUIPO] || 0; }
      if (x.ligas.indexOf(f.ID_LIGA) < 0) x.ligas.push(f.ID_LIGA);
    });
    return { total: total, temporadas: Object.keys(t).map(function (k) { return t[k]; }).sort(function (a, b) { return orden(b.temporada, a.temporada); }) };
  }

  /* ---------- avisar a las capitanas ---------- */

  /**
   * El WhatsApp para la capitana de un equipo cuando cambian sus partidos: un bloque por partido con cómo estaba y cómo queda
   * (lo que cambia, en negrita). a: { capitana, liga, partidos: [{ titulo, jornada, antes, ahora: { dia, hora, campo }, recupera }] }.
   */
  function textoAviso(a) {
    var ps = a.partidos || [], nombre = String(a.capitana || '').trim().split(/\s+/)[0];
    var l = ['Hola' + (nombre ? ' ' + nombre : '') + ', te escribo de Konamigas.', '',
      (ps.length && ps.every(function (p) { return p.recupera; }) ? (ps.length === 1 ? 'Se recupera vuestro partido aplazado de ' : 'Se recuperan ' + ps.length + ' partidos aplazados vuestros de ')
        : ps.length === 1 ? 'Cambia vuestro partido de ' : 'Cambian ' + ps.length + ' partidos vuestros de ') + a.liga + ':'];
    ps.forEach(function (p) {
      var c = { dia: p.antes.dia !== p.ahora.dia, hora: p.antes.hora !== p.ahora.hora, campo: p.antes.campo !== p.ahora.campo };
      var que = [c.dia ? 'el día' : '', c.hora ? 'la hora' : '', c.campo ? 'el campo' : ''].filter(String);
      var cosa = function (x, k) { return k === 'dia' ? fechaLarga(x.dia) : k === 'hora' ? 'a las ' + x.hora : 'en ' + x.campo; };
      l.push('', '*' + p.titulo + '* (jornada ' + p.jornada + ')',
        p.recupera ? 'Estaba aplazado.' : 'Cambia ' + (que.length > 1 ? que.slice(0, -1).join(', ') + ' y ' + que[que.length - 1] : que[0] || 'nada') + '.',
        (p.recupera ? 'Era: ' : 'Antes: ') + ['dia', 'hora', 'campo'].map(function (k) { return cosa(p.antes, k); }).join(', '),
        'Ahora: ' + ['dia', 'hora', 'campo'].map(function (k) { return c[k] ? '*' + cosa(p.ahora, k) + '*' : cosa(p.ahora, k); }).join(', '));
    });
    l.push('', '¡Gracias! Cualquier duda, me dices.');
    return l.join('\n');
  }

  /* ---------- T0423 · LA HOJA DE FILTROS: igual en tablero.js y entregas.js (probar-plataforma.js comprueba que no se separan) ----------
   * Cada filtro es un grupo de botones. Los de «varias» (iniciativa, entrega, persona…) dejan elegir más de uno: «Todas» quita
   * lo elegido. Un grupo con más de HOJA_MAX opciones enseña las primeras (y las elegidas), «Ver las otras N» y un buscador; las
   * opciones «al buscar» (p. ej. las entregas ya cerradas) solo salen buscándolas. */
  var HOJA_MAX = 8;
  function sinTildes(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  /** Lo elegido en un filtro, siempre en lista (antes de T0423 se guardaba un texto: '' era «Todas»). */
  function lista(v) { return (Array.isArray(v) ? v : v === '' || v == null ? [] : [v]).filter(function (x) { return x !== '' && x != null; }).map(String); }
  /** Lo elegido tras pulsar «v»: con varias, se añade o se quita («» quita todo); si no, solo ese. */
  function elegirEn(actual, v, varias) {
    if (!varias) return v;
    if (v === '') return [];
    var l = lista(actual), i = l.indexOf(String(v));
    if (i >= 0) l.splice(i, 1); else l.push(String(v));
    return l;
  }
  /** Un grupo de la hoja. o: { k, t, vs: [[valor, texto, alBuscar]], sel, varias, abierto, buscar }. */
  function grupoHoja(o) {
    var sel = o.varias ? lista(o.sel) : [String(o.sel)];
    var larga = o.vs.filter(function (x) { return !x[2]; }).length > HOJA_MAX, mas = 0, k = 0;
    var vs = !larga ? o.vs : o.vs.slice().sort(function (a, b) { return (sel.indexOf(String(b[0])) >= 0) - (sel.indexOf(String(a[0])) >= 0); }); // larga: las elegidas, primero
    var bs = vs.map(function (x) {
      var p = sel.indexOf(String(x[0])) >= 0, oculta = false;
      if (!p && x[2]) oculta = true;
      else if (!x[2] && k++ >= HOJA_MAX && larga && !o.abierto && !p) { oculta = true; mas++; }
      return '<button type="button" class="en-chip" data-g="' + texto(o.k) + '" data-v="' + texto(x[0]) + '" data-txt="' + texto(sinTildes(x[1])) + '"' +
        ' aria-pressed="' + p + '"' + (oculta ? ' data-oculta hidden' : '') + '>' + texto(x[1]) + '</button>';
    });
    if (o.varias) bs.unshift('<button type="button" class="en-chip" data-g="' + texto(o.k) + '" data-v="" aria-pressed="' + !sel.length + '">Todas</button>');
    var buscador = larga || vs.some(function (x) { return x[2]; });
    return '<div class="en-grupo" data-grupo="' + texto(o.k) + '"><h3 class="en-hoja-h">' + texto(o.t) +
        (o.varias && sel.length ? ' <span class="en-hoja-cu">' + (sel.length === 1 ? '1 elegida' : sel.length + ' elegidas') + '</span>' : '') + '</h3>' +
      (buscador ? '<input type="search" class="en-hoja-busca" data-gbusca="' + texto(o.k) + '" placeholder="' + texto(o.buscar || 'Buscar') + '" aria-label="' + texto(o.buscar || 'Buscar') + '" autocomplete="off">' : '') +
      '<div class="en-chips' + (o.varias ? ' varias' : '') + '" role="group" aria-label="' + texto(o.t) + '">' + bs.join('') + '</div>' +
      (mas ? '<button type="button" class="en-hoja-mas" data-gmas="' + texto(o.k) + '">' + (mas === 1 ? 'Ver otra' : 'Ver las otras ' + mas) + '</button>' : '') +
      '<p class="en-hoja-nada" hidden>Ninguna con ese nombre.</p></div>';
  }
  /** Buscar dentro de un grupo: salen las que coinciden (también las «al buscar») y las elegidas. */
  function buscarEnGrupo(input) {
    var q = sinTildes(input.value.trim()), g = input.closest('.en-grupo'), n = 0;
    [].forEach.call(g.querySelectorAll('.en-chip[data-txt]'), function (b) {
      var ve = q ? b.getAttribute('aria-pressed') === 'true' || q.split(/\s+/).every(function (p) { return b.getAttribute('data-txt').indexOf(p) >= 0; }) : !b.hasAttribute('data-oculta');
      b.hidden = !ve; if (ve) n++;
    });
    var m = g.querySelector('.en-hoja-mas'); if (m) m.hidden = !!q;
    g.querySelector('.en-hoja-nada').hidden = !q || n > 0;
  }
  /** Vuelve a pintar la hoja sin perder lo buscado, por dónde iba ni el foco. */
  function repintarHoja(form, pintar, foco) {
    var bs = {}, y = form.scrollTop;
    [].forEach.call(form.querySelectorAll('[data-gbusca]'), function (i) { if (i.value) bs[i.getAttribute('data-gbusca')] = i.value; });
    pintar();
    form.scrollTop = y;
    Object.keys(bs).forEach(function (k) { var i = form.querySelector('[data-gbusca="' + k + '"]'); if (i) { i.value = bs[k]; buscarEnGrupo(i); } });
    var x = foco && form.querySelector(foco); if (x) try { x.focus({ preventScroll: true }); } catch (e) { x.focus(); }
  }
  /** Los botones de la hoja: elegir(k, v) cambia el filtro; «Ver las otras» abre el grupo; el buscador filtra sin volver a pintar. */
  function atenderHoja(form, velo, o) {
    form.addEventListener('click', function (ev) {
      if (!velo.classList.contains('en-hoja')) return;
      var m = ev.target.closest('[data-gmas]');
      if (m) { var g = m.getAttribute('data-gmas'); o.abiertos[g] = 1; repintarHoja(form, o.pintar, ''); return; }
      var b = ev.target.closest('.en-chip[data-g]');
      if (b) {
        var k = b.getAttribute('data-g'), v = b.getAttribute('data-v');
        o.elegir(k, v);
        repintarHoja(form, o.pintar, '[data-g="' + k + '"][data-v="' + (window.CSS && CSS.escape ? CSS.escape(v) : v) + '"]');
      } else if (ev.target.closest('[data-quitar-filtros]')) { o.quitar(); repintarHoja(form, o.pintar, '.pri'); }
    });
    form.addEventListener('input', function (ev) { if (ev.target.hasAttribute('data-gbusca')) buscarEnGrupo(ev.target); });
    form.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target.hasAttribute && ev.target.hasAttribute('data-gbusca')) ev.preventDefault(); });
  }
  /* ---------- FIN DE LA HOJA DE FILTROS ---------- */

  var CALC = { hoy: hoy, sumarDias: sumarDias, fecha: fecha, fechaDia: fechaDia, fechaLarga: fechaLarga, euros: euros, configuracion: configuracion,
    temporadaActual: temporadaActual, ligasDe: ligasDe, conMarcador: conMarcador, resultadoDe: resultadoDe, incompleto: incompleto, jornadas: jornadas,
    diasDeJuego: diasDeJuego, resumenDia: resumenDia, diaInicial: diaInicial, descansan: descansan, equiposDe: equiposDe, golesEquipo: golesEquipo,
    queEs: queEs, faseDe: faseDe, ganaLado: ganaLado, bloquesFase: bloquesFase, bloquesPuestos: bloquesPuestos, crucesBloque: crucesBloque, huecoFase: huecoFase, sancionesDe: sancionesDe, dineroSancion: dineroSancion, multaDe: multaDe, staffDe: staffDe, coloresDe: coloresDe, jugadorasDe: jugadorasDe,
    plantilla: plantilla, clasificacion: clasificacion, resumenGoles: resumenGoles, goleadoras: goleadoras, golesJugadora: golesJugadora, textoAviso: textoAviso,
    grupoHoja: grupoHoja, lista: lista, elegirEn: elegirEn, TABLAS: TABLAS, CAMBIA: CAMBIA };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  var RAIZ = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/konamigas\/secciones\/[^/]*$/, '') : '../../'; })();
  var VERSION = (function () { var s = document.currentScript && document.currentScript.src; var m = s && /[?&]v=([^&]+)/.exec(s); return m ? m[1] : '1'; })();
  var ICO_FILTROS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
  var ICO_CERRAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var PESTANAS = { PARTIDOS: 'Partidos', CLASIFICACION: 'Clasificación', GOLEADORAS: 'Goleadoras' };
  var ESTADOS = { Programado: 'ni', Jugado: 'co', Aplazado: 'pr', Suspendido: 'pr', Anulado: 'bl', Libre: 'x' };
  /** Lo que se vuelve a leer, además de lo que cambia cada función: lo que la base calcula de los partidos. */
  var DETALLE = ['PARTIDOS_DETALLE', 'JORNADAS', 'EQUIPOS_DETALLE', 'LIGAS_GESTIONADAS'];

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function leerLocal(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function guardarLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function limpio(e) { return String((e && e.message) || e || '').replace(/^\w+:\s*/, ''); }
  function opciones(vs, sel, vacio) {
    return (vacio !== undefined ? '<option value="">' + texto(vacio) + '</option>' : '') + vs.map(function (o) {
      return '<option value="' + texto(o[0]) + '"' + (String(o[0]) === String(sel == null ? '' : sel) ? ' selected' : '') + '>' + texto(o[1]) + '</option>';
    }).join('');
  }
  /** Enlace de WhatsApp a un teléfono con el mensaje escrito: la app en el móvil y WhatsApp Web en el ordenador. */
  function wa(tel, msg) {
    var t = String(tel || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
    if (!t) return '';
    if (t.length === 9) t = '34' + t;
    return (/Android|iPhone|iPad/i.test(navigator.userAgent) ? 'whatsapp://send?phone=' : 'https://web.whatsapp.com/send?phone=') + t + (msg ? '&text=' + encodeURIComponent(msg) : '');
  }
  /** La hoja de la plataforma (kanban.css: la barra y la hoja de filtros), una vez por página; mientras llega, la sección no se ve. */
  function estilos(el) {
    var l = document.getElementById('kb-css');
    if (l && l.getAttribute('data-lista')) return;
    if (!l) {
      l = document.createElement('link');
      l.id = 'kb-css'; l.rel = 'stylesheet'; l.href = RAIZ + 'estilos/kanban.css?v=' + encodeURIComponent(VERSION);
      l.addEventListener('load', function () { l.setAttribute('data-lista', '1'); });
      document.head.appendChild(l);
    }
    el.style.visibility = 'hidden';
    var ver = function () { el.style.visibility = ''; };
    l.addEventListener('load', ver); l.addEventListener('error', ver);
    setTimeout(ver, 3000);
  }

  window.UN.registrar('LIGAS', {
    abrir: function (el, ctx) {
      estilos(el);
      var T = ctx.tablas, nada = function () {};
      var CLAVE = 'lg_' + String(ctx.correo || ctx.persona || '').toLowerCase().replace(/\W+/g, '');
      // Filtros (la hoja): temporada, liga ('*': todas, solo en Partidos) y solo mis partidos. S: lo demás de la pantalla.
      var F = leerLocal(CLAVE + '_f', {});
      F.busca = '';
      var S = { tab: PESTANAS[leerLocal(CLAVE + '_tab', '')] ? leerLocal(CLAVE + '_tab', '') : 'PARTIDOS', fecha: '', golAmbito: leerLocal(CLAVE + '_gol', 'liga'), leido: false };
      // Lo interno (admin, socio) cambia el importe de una multa; lo demás que puede cada uno lo dice la base (PARTIDOS_DETALLE…).
      // T0395 · La consulta pública (nucleo/publica-supabase.js): sin entrar no se enseña el staff (árbitro, gestor).
      var publica = !!ctx.publica;
      var interno = (ctx.roles || []).some(function (r) { return (r.rol === 'admin' || r.rol === 'socio') && r.ambito === 'todo'; });
      // Desde otra sección (?partido=PAR…) se abre la ficha de ese partido.
      var url = new URL(location.href), pedido = url.searchParams.get('partido') || '';
      if (pedido) { url.searchParams.delete('partido'); history.replaceState(history.state, '', url.pathname + url.search); }

      el.classList.add('kb', 'tb');
      el.innerHTML = '<div class="filtros tb-fil">' +
          '<label class="busca"><span class="u-oculto">Buscar un equipo o una jugadora</span><input type="search" id="lg-busca" placeholder="Buscar un equipo o una jugadora" autocomplete="off"></label>' +
          '<button id="lg-fil" class="sec en-filtros" type="button" aria-haspopup="dialog">' + ICO_FILTROS + '<span>Filtros</span><span id="lg-fil-n" class="k-fil-n" hidden></span></button>' +
        '</div><div class="lg-cuerpo"><p class="lg-viendo" id="lg-viendo"></p>' +
        '<div class="u-pestanas" role="tablist">' + Object.keys(PESTANAS).map(function (p) { return '<button type="button" role="tab" data-tab="' + p + '">' + PESTANAS[p] + '</button>'; }).join('') + '</div>' +
        '<div id="lg-cont" class="lg-cont"><div class="kz-centro" role="status"><div class="u-carga"></div>' + (pedido ? '<p>Abriendo el partido…</p>' : '') + '</div></div></div>' +
        '<div id="alta-velo"><form id="alta-form" novalidate></form></div>' +
        '<div class="u-velo" id="lg-velo"><div class="u-ventana" role="dialog" aria-modal="true" aria-labelledby="lg-vt"><div class="n-ventana" id="lg-vent"></div></div></div>';
      var $ = function (id) { return el.querySelector('#' + id); };
      var cont = $('lg-cont'), velo = $('lg-velo'), vent = $('lg-vent'), altaVelo = $('alta-velo'), altaForm = $('alta-form');

      /* ---------- los datos ---------- */

      // M: lo leído, preparado para pintar; se rehace en cada pintar().
      var M = {}, cfg = configuracion([]), staff = { yo: '', staff: [] }, colores = {};
      function preparar() {
        cfg = configuracion(T.filas('CONFIG'));
        staff = staffDe(T.filas('STAFF_NOMBRES'), T.filas('STAFF'), ctx.personaId);
        colores = coloresDe(T.filas('COLORES'));
        M = { temp: T.filas('TEMPORADAS'), comp: T.filas('COMPETICIONES'), ligas: T.filas('LIGAS'), par: T.filas('PARTIDOS'), gol: T.filas('GOLES'),
          cal: T.filas('CALENDARIO'), eq: T.filas('EQUIPOS_INSCRITOS'), san: T.filas('SANCIONES'), clas: T.filas('CLASIFICACION'), goleadoras: T.filas('GOLEADORAS') };
        M.ix = { comp: indice(M.comp), liga: indice(M.ligas), cam: indice(T.filas('CAMPOS')), ins: indice(T.filas('INSTALACIONES')), cal: indice(M.cal, 'FECHA'),
          eq: indice(M.eq), staff: indice(staff.staff), det: indice(T.filas('PARTIDOS_DETALLE')), eqd: indice(T.filas('EQUIPOS_DETALLE')),
          jor: indice(T.filas('JORNADAS')), gest: indice(T.filas('LIGAS_GESTIONADAS')) };
        M.jug = jugadorasDe(T.filas('PLANTILLAS'), T.filas('NOMBRES_JUGADORAS'));
        var ts = temporadas(M.temp);
        M.temporadas = ts;
        M.tempo = ts.filter(function (t) { return t.ID === F.temp; })[0] || temporadaActual(M.temp, hoy());
        M.lis = M.tempo ? ligasDe(M.comp, M.ligas, M.tempo.ID) : [];
        // La liga: la elegida; si no, una que lleva (el gestor) o la de su primer partido (árbitro, capitana, jugadora).
        var mio = M.par.filter(function (p) { return M.lis.some(function (x) { return x.liga.ID === p.ID_LIGA; }); }).sort(function (a, b) { return orden(cuando(a), cuando(b)); })[0];
        var suya = M.lis.filter(function (x) { return M.ix.gest[x.liga.ID]; })[0] || (mio && M.lis.filter(function (x) { return x.liga.ID === mio.ID_LIGA; })[0]);
        M.todas = F.liga === '*' && S.tab === 'PARTIDOS';
        M.actual = M.lis.filter(function (x) { return x.liga.ID === F.liga; })[0] || suya || M.lis[0] || null;
      }
      function det(p) { return M.ix.det[p.ID] || { PUEDE: '' }; }
      function puede(p) { return String(det(p).PUEDE || '').split(',').filter(String); }
      function nomLiga(l) { return String(l.NOMBRE || l.ID) + (l.DIA_SEMANA && String(l.NOMBRE).indexOf(l.DIA_SEMANA) < 0 ? ' · ' + l.DIA_SEMANA : ''); }
      function nomComp(c) { return c ? String(c.NOMBRE_COMERCIAL || c.NOMBRE || c.ID) : ''; }
      function ligaCompleta(idL) { var l = M.ix.liga[idL]; return l ? nomComp(M.ix.comp[l.ID_COMPETICION]) + ' · ' + nomLiga(l) : ''; }
      function equipo(id) { var e = M.ix.eq[String(id || '')]; return e ? String(e.NOMBRE_EQUIPO || e.ID) : id ? String(id) : ''; }
      function persona(id) { var s = M.ix.staff[String(id || '')]; return s ? s.APODO : id ? String(id) : ''; }
      function campo(id) { var c = M.ix.cam[String(id || '')]; return c ? String(c.NOMBRE || c.ABREVIACION) : String(id || ''); }
      function campoLargo(id) { var c = M.ix.cam[String(id || '')], i = c && M.ix.ins[String(c.ID_INSTALACION || '')]; return [campo(id), i ? String(i.NOMBRE || '') : ''].filter(String).join(' · '); }
      function color(id) { var e = M.ix.eq[String(id || '')]; return (e && colores[e.ID_COLOR]) || { NOMBRE: '', HEX: '' }; }
      /** El punto con el color de la camiseta de un equipo (gris con borde si no se sabe). */
      function punto(id) {
        var c = color(id);
        return '<span class="lg-color' + (c.HEX ? '' : ' lg-color-no') + '"' + (c.HEX ? ' style="--c:' + texto(c.HEX) + '"' : '') + (c.NOMBRE ? ' title="' + texto(c.NOMBRE) + '"' : '') + ' aria-hidden="true"></span>';
      }
      function partidosLiga(idL) { return M.par.filter(function (p) { return String(p.ID_LIGA) === String(idL); }); }
      function equiposLiga(idL) { return M.eq.filter(function (e) { return String(e.ID_LIGA) === String(idL) && e.ESTADO !== 'Baja'; }).map(function (e) { return String(e.ID); }); }
      function golesDe(id) { return M.gol.filter(function (g) { return String(g.ID_PARTIDO) === String(id); }); }
      function esMio(p) { return !!staff.yo && [p.ID_ARBITRO, p.ID_ARBITRO_REAL, p.ID_GESTOR].indexOf(staff.yo) >= 0; }
      function copa(idL) { var l = M.ix.liga[idL], c = l && M.ix.comp[l.ID_COMPETICION]; return !!c && cfg.SIN_CLASIFICACION.indexOf(String(c.TIPO || '')) >= 0; }
      function falta(p) { return incompleto(p, copa(p.ID_LIGA) || !!p.FASE); } // la final de la fase final, por decidir
      function titulo(p) {
        if (p.FASE) return [['l', p.ID_INSCRIPCION_LOCAL], ['v', p.ID_INSCRIPCION_VISITANTE]].map(function (x) { return x[1] ? equipo(x[1]) : huecoFase(p, x[0], semisDe(p)).txt; }).join(' – ');
        if (!p.ID_INSCRIPCION_LOCAL && !p.ID_INSCRIPCION_VISITANTE) return 'Campo libre';
        var x = falta(p) ? '(falta el equipo)' : 'Por decidir';
        return (equipo(p.ID_INSCRIPCION_LOCAL) || x) + ' – ' + (equipo(p.ID_INSCRIPCION_VISITANTE) || x);
      }
      /** Las semifinales del bloque de un partido de la fase final, por su orden (las recuperaciones, no). */
      function semisDe(p) {
        return M.par.filter(function (x) { return x.FASE === p.FASE && x.RONDA === 'Semifinal' && !x.ID_PARTIDO_ORIGEN && String(x.ID_LIGA) === String(p.ID_LIGA); })
          .sort(function (a, b) { return orden(String(a.ID), String(b.ID)); });
      }
      /** Quién va hoy en cada puesto de una liga (sin los de baja): ['', id del 1.º, id del 2.º…]. */
      function puestosHoy(idL) { return [''].concat(clasificacion(M.clas, idL).filter(function (e) { return !e.baja; }).map(function (e) { return e.id; })); }
      /** «Jornada 3» (corta, «J3») o, en la fase final, «Oro · Semifinal». */
      function nomJornada(p, corta) { return p.FASE ? faseDe(p) : (corta ? 'J' : 'Jornada ') + p.JORNADA; }
      function buscado(txt) { var q = sinTildes(F.busca).trim(); return !q || sinTildes(txt).indexOf(q) >= 0; }

      /**
       * Escribe con una función de la base (args: sus argumentos por nombre). Con fila ({ tabla, id, cambios }), la pantalla
       * cambia al momento y, si la base dice que no, vuelve a como estaba. Al acabar bien, vuelve a leer lo que ha cambiado.
       */
      function guardar(fn, args, fila) {
        var h = fila ? T.actualizar(fila.tabla, fila.id, fila.cambios, { fn: fn, args: [args] }) : ctx.llamar(fn, [args]);
        h.then(function () { T.refrescar((CAMBIA[fn] || []).concat(DETALLE), true).catch(nada); }, nada);
        if (!fila) h.catch(function (e) { if (ctx.abierta()) ctx.aviso('No se ha guardado: ' + limpio(e)); });
        return h;
      }
      /** Las plantillas de unos equipos (o unas inscripciones: col 'ID') y los nombres de sus jugadoras, solo las que faltan. */
      function cargarJugadoras(col, valores) {
        var faltan = valores.filter(function (v) {
          return v && !T.filas('PLANTILLAS').some(function (i) { return String(i[col]) === String(v); });
        });
        if (!faltan.length) return Promise.resolve();
        var parte = function (n, c, vs) { var p = {}; p[n] = { clave: c + ':' + vs.slice().sort().join(','), col: c, valores: vs }; return T.leer([n], { partes: p }); };
        return parte('PLANTILLAS', col, faltan).then(function () {
          var js = T.filas('PLANTILLAS').filter(function (i) { return faltan.indexOf(String(i[col])) >= 0; }).map(function (i) { return String(i.ID_JUGADORA); })
            .filter(function (j, i, l) { return j && l.indexOf(j) === i; });
          return js.length ? parte('NOMBRES_JUGADORAS', 'ID', js) : null;
        }).then(function () { M.jug = jugadorasDe(T.filas('PLANTILLAS'), T.filas('NOMBRES_JUGADORAS')); });
      }

      /* ---------- pintar ---------- */

      function pintar() {
        if (!S.leido) return;
        preparar();
        [].forEach.call(el.querySelectorAll('[data-tab]'), function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === S.tab ? 'true' : 'false'); });
        var n = (F.temp && M.tempo && F.temp !== (temporadaActual(M.temp, hoy()) || {}).ID ? 1 : 0) + (F.liga ? 1 : 0) + (F.mios ? 1 : 0), fn = $('lg-fil-n');
        fn.textContent = n ? String(n) : ''; fn.hidden = !n;
        $('lg-viendo').textContent = !M.tempo ? '' : (M.todas ? 'Todas las ligas' : M.actual ? ligaCompleta(M.actual.liga.ID) : 'Sin ligas') + ' · ' + M.tempo.NOMBRE + (F.mios && staff.yo && S.tab === 'PARTIDOS' ? ' · solo mis partidos' : '');
        if (!M.tempo) { cont.innerHTML = '<p class="u-vacio">Todavía no hay temporadas.</p>'; return; }
        if (!M.actual) { cont.innerHTML = '<p class="u-vacio">Esta temporada todavía no tiene ligas.</p>'; return; }
        cont.innerHTML = ({ PARTIDOS: htmlPartidos, CLASIFICACION: function () { return htmlClasificacion() + htmlFaseFinal(); }, GOLEADORAS: htmlGoleadoras })[S.tab]();
        var tira = cont.querySelector('.lg-dias-tira'), abierto = tira && tira.querySelector('[aria-pressed=true]');
        if (abierto) tira.scrollLeft = Math.max(0, abierto.offsetLeft - tira.offsetLeft - (tira.clientWidth - abierto.offsetWidth) / 2);
        if (S.tab === 'GOLEADORAS') cargarGoleadoras();
      }

      /* ---------- Partidos ---------- */

      function chipEstado(p) {
        if (p._pendiente) return '<span class="u-chip">Guardando</span>';
        return '<span class="n-estado n-e-' + (ESTADOS[p.ESTADO] || 'x') + '">' + texto(p.ESTADO === 'Anulado' && p.ANULADO_POR ? (p.APLAZADO_POR === p.ANULADO_POR ? 'Lo pierde' : 'No presentado') : p.ESTADO || 'Sin estado') + '</span>';
      }
      /** Lo que hay que saber de un partido que no se juega como estaba, en una línea: { clase, texto } o null. */
      function avisoPartido(p) {
        var d = det(p);
        if (p.ESTADO === 'Anulado') return p.ANULADO_POR
          ? { clase: 'lg-av-no', texto: (p.APLAZADO_POR === p.ANULADO_POR ? 'Aplazamiento no aceptado: ' + equipo(p.ANULADO_POR) + ' lo' : 'No presentado: ' + equipo(p.ANULADO_POR)) + ' pierde y paga su multa' }
          : { clase: 'lg-av-no', texto: 'Anulado: no se recuperará ni cuenta' };
        if (POR_RECUPERAR.indexOf(p.ESTADO) >= 0) return { clase: 'lg-av-si', texto: p.ESTADO + ': se recuperará ' +
          (d.RECUPERACION ? 'el ' + fechaDia(d.RECUPERA_FECHA).toLowerCase() + ' a las ' + d.RECUPERA_HORA + ' en ' + campo(d.RECUPERA_CAMPO) : '(pendiente de fecha)') };
        if (p.ID_PARTIDO_ORIGEN) { var o = T.fila('PARTIDOS', p.ID_PARTIDO_ORIGEN); return { clase: 'lg-av-rec', texto: 'Recupera la J' + p.JORNADA + (o ? ' (' + (o.ESTADO === 'Suspendido' ? 'suspendido' : 'aplazado') + ' del ' + fechaDia(o.FECHA).toLowerCase() + ')' : '') }; }
        return null;
      }
      /** Lo que debe cada equipo antes de jugar (lo calcula la base): «X debe 60 €: tiene que pagarlo antes de jugar». */
      function avisoMultas(p) {
        var d = det(p);
        return [[p.ID_INSCRIPCION_LOCAL, d.DEBE_LOCAL], [p.ID_INSCRIPCION_VISITANTE, d.DEBE_VISITANTE]].filter(function (x) { return num(x[1]) > 0; })
          .map(function (x) { return equipo(x[0]) + ' debe ' + euros(x[1]) + ' de multas: tiene que pagarlas antes de jugar'; });
      }
      /** Un partido en una lista: el marcador en el centro, la hora, el campo y el árbitro a un lado y, debajo, lo que hay que saber. */
      function htmlPartido(p, conLiga) {
        var res = conMarcador(p), gl = num(p.GOLES_LOCAL), gv = num(p.GOLES_VISITANTE), av = avisoPartido(p), d = det(p), gana = ganaLado(p);
        var pen = res && isFinite(num(p.PENALTIS_LOCAL)) && isFinite(num(p.PENALTIS_VISITANTE)) ? num(p.PENALTIS_LOCAL) + '-' + num(p.PENALTIS_VISITANTE) : '';
        var roto = falta(p), libre = p.ESTADO === 'Libre' || (!p.ID_INSCRIPCION_LOCAL && !p.ID_INSCRIPCION_VISITANTE && !p.FASE);
        var hoyEn = p.FASE ? puestosHoy(p.ID_LIGA) : null;
        var eq = function (id, lado, gana) {
          if (!id && p.FASE) {
            var hu = huecoFase(p, lado, semisDe(p)), ya = isFinite(hu.puesto) && hoyEn[hu.puesto];
            return '<span class="lg-p' + lado + '"><span class="lg-nom"><b>' + texto(hu.txt) + '</b>' + (ya ? '<br><small>' + texto(equipo(ya)) + '</small>' : '') + '</span></span>';
          }
          if (!id) return '<span class="lg-p' + lado + (roto ? ' lg-falta' : '') + '"><span class="lg-nom">' + (roto ? 'Falta el equipo' : 'Por decidir') + '</span></span>';
          return '<span class="lg-p' + lado + (gana ? ' lg-gana' : '') + '">' + (lado === 'l' ? '<span class="lg-nom">' + texto(equipo(id)) + '</span>' + punto(id) : punto(id) + '<span class="lg-nom">' + texto(equipo(id)) + '</span>') + '</span>';
        };
        var arb = p.ID_ARBITRO_REAL || p.ID_ARBITRO;
        var info = '<span class="lg-pi"><b class="u-cifra">' + texto(p.HORA || '--:--') + '</b><small>' + texto(campo(p.ID_CAMPO)) + '</small>' +
          (libre || publica ? '' : '<small class="lg-parb" title="Árbitro">' + texto(arb ? persona(arb) : 'Sin árbitro') + '</small>') + '</span>';
        var debajo = [conLiga ? '<span class="lg-pliga">' + texto(ligaCompleta(p.ID_LIGA) + ' · ' + (p.FASE ? faseDe(p) : 'J' + p.JORNADA)) + '</span>' : '',
          p.FASE && !conLiga ? '<span class="lg-pav lg-av-rec">' + texto(faseDe(p) + (p.FECHA ? ' · ' + fechaDia(p.FECHA) : '')) + '</span>' : '',
          p.FASE && p.ESTADO === 'Programado' && (!p.ID_INSCRIPCION_LOCAL || !p.ID_INSCRIPCION_VISITANTE) && [p.PUESTO_LOCAL, p.PUESTO_VISITANTE].some(function (x) { return isFinite(num(x)); })
            ? '<span class="lg-pav">Si la liga acabara hoy</span>' : '',
          pen ? '<span class="lg-pav lg-av-si">' + texto('Penaltis: ' + pen + ', gana ' + equipo(gana === 'l' ? p.ID_INSCRIPCION_LOCAL : p.ID_INSCRIPCION_VISITANTE)) + '</span>' : '',
          p._pendiente ? '<span class="u-chip">Guardando</span>' : '',
          roto ? '<span class="lg-pav lg-av-no">Le falta el ' + (p.ID_INSCRIPCION_LOCAL ? 'visitante' : 'local') + ': no cuenta en la clasificación</span>' : '',
          av ? '<span class="lg-pav ' + av.clase + '">' + texto(av.texto) + (p.MOTIVO && FUERA.indexOf(p.ESTADO) >= 0 ? ' · ' + texto(p.MOTIVO) : '') + '</span>' : '',
          avisoMultas(p).map(function (t) { return '<span class="lg-pav lg-av-no">' + texto(t) + '</span>'; }).join(''),
          d.SIN_SANCION && d.GESTIONA ? '<span class="lg-pav lg-av-si">Sin su sanción de no presentado</span>' : ''].join('');
        var tag = p.ID ? 'button' : 'div';
        return '<' + tag + (p.ID ? ' type="button"' : '') + ' class="lg-p' + (esMio(p) ? ' lg-mio' : '') + (FUERA.indexOf(p.ESTADO) >= 0 ? ' lg-p-fuera' : '') + '"' + (p.ID ? ' data-p="' + texto(p.ID) + '"' : '') +
          ' aria-label="' + texto(titulo(p) + ', ' + (p.HORA || '') + ', ' + campo(p.ID_CAMPO) + (res ? ', ' + gl + ' a ' + gv : '') + (pen ? ', penaltis ' + pen : '')) + '">' + info +
          (libre ? '<span class="lg-pl"></span><span class="lg-pc lg-pvs">' + texto(equipo(p.ID_INSCRIPCION_LOCAL || p.ID_INSCRIPCION_VISITANTE) || 'Campo libre') + '</span><span class="lg-pv"></span>'
            : eq(p.ID_INSCRIPCION_LOCAL, 'l', gana === 'l') + '<span class="lg-pc' + (res ? '' : ' lg-pvs') + (p.ESTADO === 'Anulado' ? ' lg-pc-an' : '') + '">' +
              (res ? '<b class="u-cifra">' + gl + '<span>–</span>' + gv + '</b>' : 'vs') + '</span>' + eq(p.ID_INSCRIPCION_VISITANTE, 'v', gana === 'v')) +
          (debajo ? '<span class="lg-pa">' + debajo + '</span>' : '') + '</' + tag + '>';
      }
      /** La barrita de un día: verde lo jugado, rojo lo anulado, gris lo aplazado y vacío lo que falta. */
      function barraDia(ps) {
        var r = resumenDia(ps);
        if (!r.total) return '';
        var trozo = function (n, c) { return n ? '<i class="lg-s-' + c + '" style="flex-grow:' + n + '"></i>' : ''; };
        return '<span class="lg-barrita" role="img" aria-label="' + texto([r.jugado + ' jugados', r.anulado ? r.anulado + ' anulados' : '', r.aplazado ? r.aplazado + ' aplazados' : '', r.pendiente ? r.pendiente + ' por jugar' : ''].filter(String).join(', ')) + '">' +
          trozo(r.jugado, 'jugado') + trozo(r.anulado, 'anulado') + trozo(r.aplazado, 'aplazado') + trozo(r.pendiente, 'pendiente') + '</span>';
      }
      function especial(f) { var c = M.ix.cal[f]; return c && (c.FESTIVO || c.DESCANSO) ? (c.FESTIVO ? 'Festivo' : 'Descanso') + (c.MOTIVO ? ': ' + c.MOTIVO : '') : ''; }
      /** Día, nivel y gestor de la liga (con su WhatsApp, si se ve su teléfono). */
      function cabLiga(l) {
        var g = M.ix.staff[l.ID_GESTOR], tel = g && wa(g.TELEFONO);
        var datos = [l.DIA_SEMANA ? 'Los ' + l.DIA_SEMANA.toLowerCase().replace(/s$/, '') + 's' : '', l.NIVEL ? 'Nivel ' + l.NIVEL : '', l.ID_GESTOR && !publica ? 'Gestor: ' + persona(l.ID_GESTOR) : ''].filter(String);
        return '<div class="lg-cab"><p>' + texto(datos.join(' · ')) + (tel ? ' <a href="' + texto(tel) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</p></div>';
      }
      /** Lo pendiente de la liga, arriba: aplazados por recuperar y anulados sin su sanción (lo que dice la base). */
      function htmlPendiente(idL) {
        var ps = partidosLiga(idL), h = '';
        var sinSan = ps.filter(function (p) { return det(p).SIN_SANCION && det(p).GESTIONA; });
        if (sinSan.length) h += '<div class="lg-pend-rec"><span><b>' + sinSan.length + (sinSan.length === 1 ? ' anulado por culpa de un equipo sin su sanción' : ' anulados por culpa de un equipo sin su sanción') + '</b>' +
          '<small>' + texto(sinSan.map(function (p) { return 'J' + p.JORNADA + ' ' + equipo(p.ANULADO_POR); }).join(' · ')) + '</small></span>' +
          '<button type="button" class="u-btn" data-accion="sanciones"' + (S.apuntando ? ' disabled' : '') + '>' + (S.apuntando ? 'Apuntando…' : 'Apuntar sus sanciones') + '</button></div>';
        var pend = ps.filter(function (p) { return det(p).POR_RECUPERAR; }).sort(function (a, b) { return num(a.JORNADA) - num(b.JORNADA) || orden(cuando(a), cuando(b)); });
        if (pend.length) h += '<div class="lg-pend-rec"><span><b>' + pend.length + (pend.length === 1 ? ' partido por recuperar' : ' partidos por recuperar') + '</b>' +
          '<small>' + texto(pend.map(function (p) { return 'J' + p.JORNADA + ' ' + titulo(p); }).join(' · ')) + '</small></span>' +
          (pend.some(function (p) { return det(p).RECUPERAR; }) ? '<button type="button" class="u-btn" data-accion="recuperar">Recuperar en huecos libres</button>' : '') + '</div>';
        return h;
      }
      /**
       * Partidos: arriba lo pendiente; luego la tira de días de juego (J1, J2… y JR, los de solo recuperaciones), que se abre en
       * el de hoy o el siguiente, y los partidos de ese día. Con «Todas» las ligas, los días de todas (el calendario de un árbitro).
       */
      function htmlPartidos() {
        var h = '', todas = M.todas, idL = M.actual.liga.ID;
        var actas = staff.yo ? M.par.filter(function (p) { return p.ESTADO === 'Programado' && p.FECHA < hoy() && (p.ID_ARBITRO_REAL || p.ID_ARBITRO) === staff.yo && puede(p).indexOf('jugado') >= 0; }) : [];
        if (actas.length) h += '<p class="u-bloque lg-pend">Tienes ' + actas.length + (actas.length === 1 ? ' acta por cerrar' : ' actas por cerrar') + ' de partidos ya jugados. ' +
          '<button type="button" class="u-btn u-btn-texto" data-ir-actas="' + texto(actas[0].FECHA) + '">Ver</button></p>';
        if (!todas) {
          h += cabLiga(M.actual.liga) + htmlPendiente(idL);
          var rotos = partidosLiga(idL).filter(falta);
          if (rotos.length) h += '<p class="lg-pav lg-pav-ficha lg-av-no" role="alert">' + rotos.length + (rotos.length === 1 ? ' partido de esta liga no tiene' : ' partidos de esta liga no tienen') +
            ' uno de los dos equipos: no cuentan en la clasificación. Avisa a Konamigas para completarlos.</p>';
        }
        var ligasIds = M.lis.map(function (x) { return x.liga.ID; });
        var ps = M.par.filter(function (p) {
          return (todas ? ligasIds.indexOf(p.ID_LIGA) >= 0 : p.ID_LIGA === idL) && (!F.mios || !staff.yo || esMio(p)) &&
            (!F.busca || buscado(equipo(p.ID_INSCRIPCION_LOCAL) + ' ' + equipo(p.ID_INSCRIPCION_VISITANTE)));
        });
        var dias = diasDeJuego(ps);
        if (!dias.length) return h + '<p class="u-vacio">' + (F.busca ? 'Ningún partido de «' + texto(F.busca) + '».' : F.mios && staff.yo ? 'No tienes partidos aquí. Quita «Solo mis partidos» en Filtros para ver todos.' : 'Todavía no hay partidos.') + '</p>';
        if (!dias.some(function (x) { return x.fecha === S.fecha; })) S.fecha = diaInicial(dias, hoy());
        var dia = dias.filter(function (x) { return x.fecha === S.fecha; })[0];
        h += '<div class="lg-dias"><button type="button" class="u-btn u-btn-icono" data-dias="-1" aria-label="Días anteriores">‹</button><div class="lg-dias-tira" role="group" aria-label="Días de juego">' +
          dias.map(function (x) {
            var dt = deIso(x.fecha), r = resumenDia(x.ps), completa = r.total > 0 && !r.pendiente && !r.aplazado;
            return '<button type="button" data-fecha="' + x.fecha + '" aria-pressed="' + (x.fecha === S.fecha) + '" class="' + [x.jr ? 'lg-jr' : '', completa ? 'lg-completa' : '', x.fecha === hoy() ? 'lg-hoy' : '', especial(x.fecha) ? 'lg-choque' : ''].join(' ').trim() + '"' +
              ' aria-label="' + texto((x.ff ? 'Fase final, ' + x.ff.toLowerCase() : x.jr ? 'Jornada de recuperación' : todas ? '' : 'Jornada ' + x.jornadas.join(' y ')) + ' ' + fechaDia(x.fecha)) + '"><b>' +
              texto(todas ? DIAS[dt.getDay()].slice(0, 3) : x.ff ? (x.ff === 'Semifinales' ? 'Semis' : 'Final') : x.jr ? 'JR' : 'J' + x.jornadas.join('/')) + '</b><small>' + dt.getDate() + ' ' + MESES[dt.getMonth()] + '</small>' + barraDia(x.ps) + '</button>';
          }).join('') + '</div><button type="button" class="u-btn u-btn-icono" data-dias="1" aria-label="Días siguientes">›</button></div>' +
          '<p class="lg-leyenda" aria-hidden="true"><span><i class="lg-s-jugado"></i>Jugado</span><span><i class="lg-s-anulado"></i>Anulado</span><span><i class="lg-s-aplazado"></i>Aplazado</span><span><i class="lg-s-pendiente"></i>Por jugar</span></p>';
        var jornada = !todas && !dia.ff && dia.jornadas.length === 1 ? dia.jornadas[0] : null, jor = jornada !== null && M.ix.jor[idL + '·' + jornada];
        var sub = (todas ? '' : fechaDia(dia.fecha)) + (dia.fecha === hoy() ? (todas ? 'Hoy' : ' · hoy') : '');
        h += '<div class="lg-jcab"><h2 class="n-grupo' + (dia.jr ? ' lg-jr-t' : '') + '">' + texto(todas ? fechaDia(dia.fecha) : dia.ff ? 'Fase final · ' + dia.ff.toLowerCase() : dia.jr ? 'Jornada de recuperación' : 'Jornada ' + dia.jornadas.join(' y ')) + '</h2>' +
          (sub || (jor && jor.MOVIBLE) ? '<p class="lg-jfecha">' + (sub ? '<span>' + texto(sub) + '</span>' : '') +
            (jor && jor.MOVIBLE ? '<button type="button" class="lg-jcambiar" data-jornadas="' + jornada + '" title="Intercambiar la fecha con otra jornada"><span aria-hidden="true">⇄</span> Cambiar de fecha</button>' : '') + '</p>' : '') + '</div>';
        var esp = especial(dia.fecha), juegan = dia.ps.filter(function (p) { return FUERA.indexOf(p.ESTADO) < 0 && p.ESTADO !== 'Libre'; }).length;
        if (esp) h += '<p class="lg-pav lg-pav-ficha ' + (juegan ? 'lg-av-no" role="alert">Ojo: este día es ' + texto(esp.toLowerCase()) + ' y tiene ' + juegan + (juegan === 1 ? ' partido.' : ' partidos.') + ' Si no se juega, aplázalos o cambia la jornada de fecha.' : 'lg-av-si">' + texto(esp)) + '</p>';
        if (dia.jr) h += '<p class="u-nota">Día sin jornada: aquí se juegan partidos aplazados de otras jornadas.</p>';
        h += '<div class="lg-lista">' + dia.ps.slice().sort(function (a, b) { return orden(cuando(a), cuando(b)) || orden(campo(a.ID_CAMPO), campo(b.ID_CAMPO)); })
          .map(function (p) { return htmlPartido(p, todas); }).join('');
        if (jornada !== null && !F.busca) {
          var pj = partidosLiga(idL).filter(function (p) { return num(p.JORNADA) === jornada && !p.ID_PARTIDO_ORIGEN; });
          if (!pj.some(falta)) h += descansan(pj, equiposLiga(idL)).sort(function (a, b) { return equipo(a).localeCompare(equipo(b), 'es'); }).map(function (e) {
            return '<div class="lg-p lg-p-descansa"><span class="lg-pi"><b>Descansa</b></span><span class="lg-pdes">' + punto(e) + '<span class="lg-nom">' + texto(equipo(e)) + '</span></span></div>';
          }).join('');
        }
        return h + '</div>';
      }

      /* ---------- Clasificación ---------- */

      function htmlRacha(r) {
        if (!r) return '';
        var nombre = { G: 'ganado', E: 'empatado', P: 'perdido' };
        return '<span class="lg-racha" aria-label="Últimos partidos: ' + texto(r.split('').map(function (x) { return nombre[x]; }).join(', ')) + '">' +
          r.split('').map(function (x) { return '<span class="lg-ef-r lg-ef-' + x + '">' + x + '</span>'; }).join('') + '</span>';
      }
      /** La clasificación de la vista de la base (cuenta todos los partidos de la liga, también los que no ves). */
      function htmlClasificacion() {
        var l = M.actual.liga, h = cabLiga(l);
        if (copa(l.ID)) return h + '<p class="u-vacio">' + texto(nomComp(M.actual.comp)) + ' se juega por eliminatorias: no tiene clasificación. Los cruces están en Partidos.</p>';
        var cl = clasificacion(M.clas, l.ID).filter(function (e) { return buscado(equipo(e.id)); });
        if (!cl.length) return h + '<p class="u-vacio">' + (F.busca ? 'Ningún equipo de «' + texto(F.busca) + '» en esta liga.' : 'Esta liga todavía no tiene equipos ni partidos.') + '</p>';
        var P = cfg.PUNTOS, R = resumenGoles(T.filas('LIGAS_RESUMEN'), [l.ID]), nAn = num(cfg.RESULTADO_ANULADO);
        return h + '<div class="u-tabla-caja"><table class="u-tabla lg-clas"><thead><tr><th class="num">#</th><th>Equipo</th><th class="num" title="Jugados">PJ</th>' +
          '<th class="num" title="Ganados">G</th><th class="num" title="Empatados">E</th><th class="num" title="Perdidos">P</th>' +
          '<th class="num u-solo-ancho" title="Goles a favor">GF</th><th class="num u-solo-ancho" title="Goles en contra">GC</th><th class="num" title="Diferencia de goles">DG</th><th class="num">Pts</th>' +
          '<th class="u-solo-ancho" title="Los últimos 5 partidos, del más viejo al más nuevo">Últimos</th></tr></thead><tbody>' +
          cl.map(function (e) {
            var ed = M.ix.eqd[e.id] || {}, ra = htmlRacha(e.racha);
            return '<tr><td class="num">' + (e.baja ? '–' : e.pos) + '</td><td class="u-tabla-t"><button type="button" class="lg-eqf" data-eqf="' + texto(e.id) + '"><span class="lg-eqt">' + punto(e.id) + texto(equipo(e.id)) + '</span></button>' +
              (e.baja ? ' <span class="u-chip">Baja</span>' : '') +
              (ra ? '<div class="u-solo-movil">' + ra + '</div>' : '') + (num(ed.DEBE) > 0 ? '<div class="u-nota lg-san-nota">Debe ' + euros(ed.DEBE) + ' de multas</div>' : '') +
              (e.jugar && !e.baja ? '<div class="u-nota u-solo-ancho">' + e.jugar + ' por jugar</div>' : '') + '</td>' +
              '<td class="num">' + e.pj + '</td><td class="num">' + e.pg + '</td><td class="num">' + e.pe + '</td><td class="num">' + e.pp + '</td>' +
              '<td class="num u-solo-ancho">' + e.gf + '</td><td class="num u-solo-ancho">' + e.gc + '</td><td class="num">' + (e.dg > 0 ? '+' : '') + e.dg + '</td><td class="num"><b>' + e.pts + '</b></td>' +
              '<td class="u-solo-ancho">' + ra + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<p class="u-nota">' + R.jugados + (R.jugados === 1 ? ' partido jugado' : ' partidos jugados') + '. ' + num(P.GANAR) + ' puntos por ganar y ' + num(P.EMPATAR) + ' por empatar; ' +
          'a igualdad de puntos, mejor diferencia de goles y después más goles a favor.' + (nAn > 0 ? ' Un partido anulado cuenta como 0-' + nAn + ' para el equipo que lo provoca.' : '') +
          (cl.some(function (e) { return e.baja; }) ? ' Los equipos de baja van al final, con lo que jugaron.' : '') +
          ' Los últimos partidos van del más viejo al más nuevo. Toca un equipo para ver su ficha.</p>';
      }

      /* ---------- la fase final (T0313) ---------- */

      /**
       * Debajo de la clasificación, la fase final: sus partidos por bloques o, si aún no están, cómo quedaría si la liga acabara
       * hoy. A quien lleva la liga, crearla o deshacerla.
       */
      function htmlFaseFinal() {
        var l = M.actual.liga, ps = partidosLiga(l.ID).filter(function (p) { return !!p.FASE; }), gest = !publica && !!M.ix.gest[l.ID];
        if (copa(l.ID) || F.busca) return '';
        var hoyEn = puestosHoy(l.ID), n = hoyEn.length - 1, bl = bloquesPuestos(n);
        if (!ps.length && !bl.length) return '';
        var lista = function (fase, xs) { return '<h3 class="lg-sub">' + texto(fase) + '</h3><div class="lg-lista">' + xs.map(function (p) { return htmlPartido(p, false); }).join('') + '</div>'; };
        var sinEquipos = ps.some(function (p) { return p.ESTADO === 'Programado' && (!p.ID_INSCRIPCION_LOCAL || !p.ID_INSCRIPCION_VISITANTE) && isFinite(num(p.PUESTO_LOCAL)); });
        var descansa = n % 4 === 1 && n > 1 && hoyEn[n] ? '<p class="u-nota">' + texto('Descansa la ' + n + '.ª' + (sinEquipos || !ps.length ? ' (hoy, ' + equipo(hoyEn[n]) + ')' : '') + '.') + '</p>' : '';
        var h = '<h2 class="n-grupo">Fase final</h2>';
        if (!ps.length) {
          return h + '<p class="u-nota">Al acabar la liga, dos semanas más en bloques de 4 por la clasificación: semifinales y, la semana siguiente, final y tercer puesto. Así quedaría si la liga acabara hoy:</p>' +
            bl.map(function (b) { return lista(b.fase, crucesBloque(b)); }).join('') + descansa +
            (gest ? '<p class="u-nota">Al ponerlos, cada partido tiene ya su día y su hora; los equipos se ponen solos al jugarse el último partido de la liga.</p>' +
              '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-accion="fasefinal">Poner los partidos de la fase final</button></div>' : '');
        }
        if (sinEquipos) h += '<p class="u-nota">Los equipos se ponen solos al jugarse el último partido de la liga. Mientras, sale quién iría si acabara hoy.</p>';
        h += bloquesFase(ps).map(function (b) { return lista(b.fase, b.ps); }).join('') + descansa;
        var deshacer = gest && ps.every(function (p) { return p.ESTADO === 'Programado' && !p.ID_PARTIDO_ORIGEN; });
        return h + (deshacer ? '<div class="n-botones"><button type="button" class="u-btn" data-accion="ffquitar">Deshacer la fase final</button></div>' : '');
      }
      function crearFaseFinal(b) {
        b.disabled = true; b.textContent = 'Poniendo…';
        guardar('ligas_fase_final', { liga: M.actual.liga.ID }).then(function (z) {
          if (ctx.abierta()) ctx.aviso('Fase final puesta: ' + z.partidos + ' partidos, el ' + fechaLarga(z.semana_1) + ' y el ' + fechaLarga(z.semana_2) + '.');
        }, function () { b.disabled = false; b.textContent = 'Poner los partidos de la fase final'; });
      }
      function quitarFaseFinal(b) {
        if (!b.getAttribute('data-ok')) { b.setAttribute('data-ok', '1'); b.textContent = 'Se borran sus partidos: pulsa otra vez'; return; }
        b.disabled = true; b.textContent = 'Deshaciendo…';
        guardar('ligas_fase_final_quitar', { liga: M.actual.liga.ID }).then(function () { if (ctx.abierta()) ctx.aviso('Fase final deshecha.'); },
          function () { b.disabled = false; b.removeAttribute('data-ok'); b.textContent = 'Deshacer la fase final'; });
      }

      /* ---------- Goleadoras ---------- */

      /** De dónde: la liga, toda la temporada o el histórico (todas las ligas). */
      function ambito() {
        var a = ['temporada', 'historico'].indexOf(S.golAmbito) >= 0 ? S.golAmbito : 'liga';
        return { a: a, ligas: a === 'historico' ? M.ligas.map(function (l) { return String(l.ID); }) : a === 'temporada' ? M.lis.map(function (x) { return String(x.liga.ID); }) : [String(M.actual.liga.ID)] };
      }
      function nomJug(ij) { var j = M.jug[ij]; return j ? j.NOMBRE : 'Cargando…'; }
      function htmlGoleadoras() {
        var A = ambito(), op = [['liga', nomLiga(M.actual.liga)], ['temporada', 'Toda la temporada'], ['historico', 'Histórico']];
        return '<div class="lg-fila-chips lg-chips-liga" role="group" aria-label="De dónde">' + op.map(function (o) {
            return '<button type="button" data-golamb="' + o[0] + '" aria-pressed="' + (A.a === o[0]) + '">' + texto(o[1]) + '</button>';
          }).join('') + '</div><div id="lg-gol-res">' + htmlGolRes() + '</div>' +
          '<p class="u-nota">Cuentan los goles apuntados en las actas. Los que no marca nadie del equipo (en propia) y los de puntualidad no son de ninguna jugadora. Toca una jugadora para ver sus temporadas.</p>';
      }
      function htmlGolRes() {
        var A = ambito(), rk = goleadoras(M.goleadoras, A.ligas), R = resumenGoles(T.filas('LIGAS_RESUMEN'), A.ligas);
        var puesto = function (n) { return 1 + rk.filter(function (x) { return x.goles > n; }).length; };
        var conColor = function (eqs) { for (var i = eqs.length - 1; i >= 0; i--) if (color(eqs[i]).HEX) return eqs[i]; return eqs[eqs.length - 1]; };
        var vistas = rk.filter(function (x) { return buscado(nomJug(x.ijs[0]) + ' ' + x.equipos.map(equipo).join(' ')); });
        var h = '<div class="lg-stats"><div><b class="u-cifra">' + R.goles + '</b><span>goles</span></div><div><b class="u-cifra">' + R.jugados + '</b><span>partidos jugados</span></div>' +
          '<div><b class="u-cifra">' + String(R.media).replace('.', ',') + '</b><span>goles por partido</span></div>' +
          '<div><b>' + (rk[0] ? texto(nomJug(rk[0].ijs[0])) : '—') + '</b><span>' + (rk[0] ? 'máxima goleadora · ' + rk[0].goles + ' goles' : 'máxima goleadora') + '</span></div></div>';
        if (!rk.length) return h + '<p class="u-vacio">Todavía no hay goles apuntados en las actas.</p>';
        if (!vistas.length) return h + '<p class="u-vacio">Ninguna jugadora ni equipo con «' + texto(F.busca) + '».</p>';
        return h + '<ol class="lg-ranking">' + vistas.slice(0, 100).map(function (x) {
          var j = M.jug[x.ijs[0]];
          return '<li><span class="lg-pos u-cifra">' + puesto(x.goles) + '</span><button type="button" class="lg-jug" data-jug="' + texto(x.jugadora) + '"><span class="lg-eqt">' + punto(conColor(x.equipos)) + '<span><b>' +
            (A.a === 'liga' && j && j.DORSAL ? '<span class="lg-dorsal u-cifra">' + texto(j.DORSAL) + '</span> ' : '') + texto(nomJug(x.ijs[0])) + '</b>' +
            '<small>' + texto(x.equipos.map(equipo).filter(function (n, i, l) { return l.indexOf(n) === i; }).join(', ')) + '</small></span></span></button>' +
            '<span class="lg-n u-cifra">' + x.goles + '<small>' + (x.goles === 1 ? ' gol' : ' goles') + '</small></span></li>';
        }).join('') + '</ol>' + (vistas.length > 100 ? '<p class="u-nota">Y ' + (vistas.length - 100) + ' más: búscalas por su nombre.</p>' : '');
      }
      /** Los nombres de las que han marcado en el ámbito, de 500 en 500; después se vuelve a pintar el resultado. */
      function cargarGoleadoras() {
        var ijs = [];
        goleadoras(M.goleadoras, ambito().ligas).forEach(function (x) { if (!M.jug[x.ijs[0]]) ijs.push(x.ijs[0]); });
        if (!ijs.length) return;
        var trozos = [];
        for (var i = 0; i < ijs.length; i += 500) trozos.push(ijs.slice(i, i + 500));
        Promise.all(trozos.map(function (t) { return cargarJugadoras('ID', t); })).then(function () {
          var r = cont.querySelector('#lg-gol-res');
          if (r && ctx.abierta() && S.tab === 'GOLEADORAS') r.innerHTML = htmlGolRes();
        }, nada);
      }

      /* ---------- ventanas ---------- */

      var antesDeCerrar = null, abierta = ''; // abierta: la ficha que se ve ('P:' partido, 'E:' equipo), para volver a pintarla
      function ventana(html, alAbrir) {
        abierta = '';
        vent.innerHTML = html;
        vent.onclick = vent.oninput = vent.onchange = null;
        velo.classList.add('abierto');
        if (alAbrir) alAbrir();
        var b = vent.querySelector('h2'); if (b) { b.setAttribute('tabindex', '-1'); b.focus(); }
      }
      function cerrar(forzar) {
        if (!forzar && antesDeCerrar && !antesDeCerrar()) return;
        var estaba = velo.classList.contains('abierto');
        antesDeCerrar = null; abierta = '';
        velo.classList.remove('abierto'); vent.innerHTML = ''; vent.onclick = vent.oninput = vent.onchange = null;
        if (estaba && ctx.abierta()) pintar();
      }
      function campoF(et, html, extra) { return '<label class="u-campo' + (extra ? ' ' + extra : '') + '"><span class="u-etiqueta">' + et + '</span>' + html + '</label>'; }
      function val(id) { var e = vent.querySelector('#' + id); return e ? String(e.value).trim() : ''; }
      function verError(mal) { var e = vent.querySelector('.u-error'); e.textContent = mal.join(' '); e.hidden = !mal.length; }
      function botones(h) { return '<p class="u-error" role="alert" hidden></p><div class="n-botones">' + h + '</div>'; }

      /* ---------- ficha de un partido ---------- */

      /** Un equipo en el marcador de la ficha: su color, su nombre y quién marcó sus goles. */
      function ladoMarcador(p, eq, rival, que) {
        var gs = golesEquipo(golesDe(p.ID), eq), c = color(eq);
        return '<div class="lg-mlado"' + (c.HEX ? ' style="--c:' + texto(c.HEX) + '"' : '') + '><span class="lg-mcolor' + (c.HEX ? '' : ' lg-color-no') + '" aria-hidden="true"></span>' +
          '<button type="button" class="lg-eqf" data-eqf="' + texto(eq) + '">' + texto(equipo(eq)) + '</button><small>' + texto(que + (c.NOMBRE ? ' · ' + c.NOMBRE : '')) + '</small>' +
          (gs.length ? '<ul class="lg-mgoles">' + gs.map(function (g) {
            var j = M.jug[g.jugadora];
            return '<li' + (g.tipo !== 'jugadora' ? ' class="lg-gol-otro"' : '') + '>' + (g.tipo === 'jugadora' ? '<span class="lg-dorsal u-cifra">' + texto(j ? j.DORSAL : '') + '</span><span>' + texto(j ? j.NOMBRE : 'Cargando…') + '</span>'
              : g.tipo === 'puntualidad' ? '<span class="lg-dorsal">P</span><span>Puntualidad (llegó tarde ' + texto(equipo(rival)) + ')</span>' : '<span class="lg-dorsal">–</span><span>En propia</span>') +
              (g.goles > 1 ? '<span class="lg-veces u-cifra">×' + g.goles + '</span>' : '') + '</li>';
          }).join('') + '</ul>' : '') + '</div>';
      }
      function ficha(id) {
        var p = T.fila('PARTIDOS', id);
        if (!p) return;
        var d = det(p), c = M.ix.cam[p.ID_CAMPO], ins = c && M.ix.ins[c.ID_INSTALACION], ges = M.ix.staff[p.ID_GESTOR], tel = ges && wa(ges.TELEFONO);
        var L = p.ID_INSCRIPCION_LOCAL, V = p.ID_INSCRIPCION_VISITANTE, gs = golesDe(p.ID), av = avisoPartido(p);
        var fila = function (dt, dd) { return dd ? '<dt>' + dt + '</dt><dd>' + dd + '</dd>' : ''; };
        var html = '<h2 id="lg-vt">' + texto(titulo(p)) + '</h2><p class="u-nota">' + texto(ligaCompleta(p.ID_LIGA) + ' · ' + nomJornada(p)) + '</p>' +
          (L && V ? '<div class="lg-marcador">' + ladoMarcador(p, L, V, 'Local') + '<div class="lg-mcentro">' +
            (conMarcador(p) ? '<b class="u-cifra' + (p.ESTADO === 'Anulado' ? ' lg-mcentro-an' : '') + '">' + num(p.GOLES_LOCAL) + '<span>–</span>' + num(p.GOLES_VISITANTE) + '</b>' : '<b class="lg-mhora u-cifra">' + texto(p.HORA || '--:--') + '</b>') +
            chipEstado(p) + '</div>' + ladoMarcador(p, V, L, 'Visitante') + '</div>' : '') +
          (av ? '<p class="lg-pav lg-pav-ficha ' + av.clase + '">' + texto(av.texto) + '</p>' : '') +
          avisoMultas(p).map(function (t) { return '<p class="lg-pav lg-pav-ficha lg-av-no" role="alert">' + texto(t) + '</p>'; }).join('') +
          (p.ESTADO === 'Jugado' && !gs.length ? '<p class="u-nota">El acta no dice quién marcó.</p>' : '') +
          '<dl class="lg-datos">' + fila('Cuándo', texto(p.FECHA ? fechaDia(p.FECHA) + ' · ' + fecha(p.FECHA) + (p.HORA ? ' a las ' + p.HORA : '') : 'Sin fecha')) +
          fila('Campo', texto(campoLargo(p.ID_CAMPO)) + (ins && ins.UBICACION_URL ? ' <a href="' + texto(ins.UBICACION_URL) + '" target="_blank" rel="noopener">Cómo llegar</a>' : '')) +
          (publica ? '' : fila('Árbitro', texto(p.ID_ARBITRO ? persona(p.ID_ARBITRO) : 'Sin asignar') + (p.ID_ARBITRO_REAL ? ' · arbitró ' + texto(persona(p.ID_ARBITRO_REAL)) : ''))) +
          (publica ? '' : fila('Gestor', p.ID_GESTOR ? texto(persona(p.ID_GESTOR)) + (tel ? ' <a href="' + texto(tel) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') : '')) +
          fila('Motivo', texto(p.MOTIVO)) + fila('Pidió aplazarlo', texto(p.APLAZADO_POR ? equipo(p.APLAZADO_POR) + (p.AVISO_APLAZAMIENTO ? ', avisó el ' + fecha(p.AVISO_APLAZAMIENTO) : '') : '')) +
          fila('Notas', texto(p.NOTAS)) + '</dl>';
        var sp = sancionesDe(M.san, { partido: p.ID });
        if (d.SIN_SANCION && d.GESTIONA) html += '<div class="lg-pend-rec"><span><b>' + texto(equipo(p.ANULADO_POR) + ' no se presentó y aún no tiene su sanción') + '</b><small>Se apunta con la multa de la normativa.</small></span>' +
          '<button type="button" class="u-btn" data-san-nueva>Apuntar su sanción</button></div>';
        if (sp.length) html += '<h3 class="lg-sub">' + (sp.length === 1 ? 'Sanción' : 'Sanciones') + '</h3>' + htmlSanciones(sp, 'partido');
        var ops = puede(p);
        if (!ops.length && p.ESTADO === 'Programado' && p.FECHA > hoy() && (p.ID_ARBITRO_REAL || p.ID_ARBITRO) === staff.yo && staff.yo)
          html += '<p class="u-nota">El día del partido podrás cerrar el acta o decir si un equipo no se presentó o si se suspendió.</p>';
        html += '<div class="n-botones">' + (ops.length && !p._pendiente ? '<button type="button" class="u-btn u-btn-accion" data-estado>Acta y estado</button>' : '') +
          (d.MOVER ? '<button type="button" class="u-btn" data-mover>Mover dentro del día</button>' : '') +
          (d.RECUPERAR ? '<button type="button" class="u-btn" data-recuperar>Recuperar en un hueco libre</button>' : '') +
          (d.GESTIONA && (L || V) ? '<button type="button" class="u-btn u-btn-texto" data-san-nueva>Apuntar una sanción</button>' : '') +
          '<button type="button" class="u-btn u-btn-texto" data-cerrar>Cerrar</button></div>';
        ventana(html, function () {
          abierta = 'P:' + p.ID;
          var volver = function () { ficha(p.ID); };
          vent.onclick = function (e) {
            if (e.target.closest('[data-estado]')) { formEstado(T.fila('PARTIDOS', p.ID) || p); return; }
            if (e.target.closest('[data-mover]')) { formMover(p); return; }
            if (e.target.closest('[data-recuperar]')) { formRecuperar(p.ID_LIGA, [p.ID]); return; }
            if (e.target.closest('[data-san-nueva]')) { formSancion(null, { partido: p.ID }, volver); return; }
            clicFicha(e, volver);
          };
          var eqs = gs.filter(function (g) { return g.ID_INSCRIPCION_JUGADORA && !M.jug[g.ID_INSCRIPCION_JUGADORA]; }).map(function (g) { return g.ID_INSCRIPCION_EQUIPO; });
          if (eqs.length) cargarJugadoras('ID_INSCRIPCION_EQUIPO', eqs).then(function () { if (abierta === 'P:' + p.ID) ficha(p.ID); }, nada);
        });
      }
      /** Clics comunes en una ficha: un equipo abre la suya, un partido la suya y una sanción, su formulario (y luego vuelve). */
      function clicFicha(e, volver) {
        var b = e.target.closest('[data-san]');
        if (b) { var s = T.fila('SANCIONES', b.getAttribute('data-san')); if (s) formSancion(s, null, volver); return; }
        b = e.target.closest('[data-eqf]'); if (b) { fichaEquipo(b.getAttribute('data-eqf')); return; }
        b = e.target.closest('[data-p]'); if (b) ficha(b.getAttribute('data-p'));
      }

      /* ---------- sanciones ---------- */

      /** ¿Apunta y cambia esta sanción? La de un partido, quien lo gestiona; sin partido, quien lleva la liga del equipo (lo dice la base). */
      function sanciona(s) { return s.ID_PARTIDO ? !!(M.ix.det[s.ID_PARTIDO] || {}).GESTIONA : !!(M.ix.eqd[s.ID_INSCRIPCION_EQUIPO] || {}).GESTIONA; }
      function rivalDe(s) { var p = s.ID_PARTIDO && T.fila('PARTIDOS', s.ID_PARTIDO); return p ? (String(p.ID_INSCRIPCION_LOCAL) === String(s.ID_INSCRIPCION_EQUIPO) ? p.ID_INSCRIPCION_VISITANTE : p.ID_INSCRIPCION_LOCAL) : ''; }
      /** Una lista de sanciones: en la ficha del partido dice el equipo; en la del equipo, el partido. */
      function htmlSanciones(ss, que) {
        return '<ul class="lg-san">' + ss.map(function (s) {
          var p = s.ID_PARTIDO ? T.fila('PARTIDOS', s.ID_PARTIDO) : null, din = dineroSancion(s, equipo(rivalDe(s)));
          var de = [que === 'partido' ? equipo(s.ID_INSCRIPCION_EQUIPO) : p ? nomJornada(p) + ' · ' + titulo(p) : 'Sin partido', s.FECHA ? fecha(s.FECHA) : ''].filter(String).join(' · ');
          var dentro = '<span class="lg-san-tipo">' + texto(s.TIPO || 'Sanción') + '</span><span class="lg-san-txt"><b>' + texto(s.MOTIVO) + '</b><small>' + texto(de) + '</small>' +
            (din ? '<small class="lg-san-din' + (!s.FECHA_PAGO ? ' lg-san-debe' : '') + '">' + texto(din) + '</small>' : '') + '</span>';
          var attr = s._nueva ? '' : sanciona(s) ? ' data-san="' + texto(s.ID) + '"' : que === 'equipo' && p ? ' data-p="' + texto(p.ID) + '"' : '';
          var cl = 'lg-san-i' + (num(s.IMPORTE) > 0 && !s.FECHA_PAGO ? ' lg-san-i-debe' : '');
          return '<li>' + (attr ? '<button type="button" class="' + cl + ' lg-san-b"' + attr + '>' + dentro + '</button>' : '<div class="' + cl + '">' + dentro + '</div>') + '</li>';
        }).join('') + '</ul>';
      }
      /**
       * Apuntar (s = null) o cambiar una sanción, desde un partido (base.partido: se elige uno de sus dos equipos) o desde un
       * equipo (base.equipo: se elige su partido o ninguno). El importe lo pone la base (el de la normativa); lo interno lo
       * cambia. Al cambiarla, debajo, cobrar la multa y pagar al rival o deshacerlo.
       */
      function formSancion(s, base, volver) {
        base = base || {};
        var pFijo = !s && base.partido ? T.fila('PARTIDOS', base.partido) : null;
        var anulo = pFijo && det(pFijo).SIN_SANCION ? pFijo.ANULADO_POR : '';
        var idEq = s ? String(s.ID_INSCRIPCION_EQUIPO || '') : pFijo ? anulo : base.equipo || '', idP = s ? String(s.ID_PARTIDO || '') : pFijo ? pFijo.ID : '';
        var tipo = s ? s.TIPO : anulo ? 'No presentado' : '', motivo = s ? s.MOTIVO : anulo ? pFijo.MOTIVO || '' : '';
        var fechaDe = function (id) { var p = id && T.fila('PARTIDOS', id); return (p && p.FECHA) || hoy(); };
        var suyos = M.par.filter(function (p) { return p.ID_INSCRIPCION_LOCAL === idEq || p.ID_INSCRIPCION_VISITANTE === idEq; }).sort(function (a, b) { return orden(cuando(b), cuando(a)); });
        var nomP = function (p) { return (p.FECHA ? fecha(p.FECHA) + ' · ' : '') + nomJornada(p, true) + ' · ' + titulo(p) + (p.ESTADO !== 'Jugado' && p.ESTADO !== 'Programado' ? ' (' + String(p.ESTADO).toLowerCase() + ')' : ''); };
        var ini = s ? { IMPORTE: s.IMPORTE, COMPENSACION: s.COMPENSACION, PARA_ARBITRO: s.PARA_ARBITRO } : multaDe(cfg.SANCION_MULTAS, tipo);
        var importe = function (k, fijo) { return '<input type="text" inputmode="decimal" id="lg-s-' + k + '" value="' + texto(ini[k] === '' || ini[k] == null ? '' : String(ini[k]).replace('.', ',')) + '" placeholder="0"' + (fijo ? ' disabled' : '') + '>'; };
        var precio = function (m) {
          var x = num(m.IMPORTE);
          if (!(x > 0)) return 'Este tipo de sanción no lleva multa.';
          var partes = [num(m.COMPENSACION) > 0 ? euros(m.COMPENSACION) + ' para el rival' : '', num(m.PARA_ARBITRO) > 0 ? euros(m.PARA_ARBITRO) + ' para el árbitro' : ''].filter(String);
          return 'Multa: ' + euros(x) + (partes.length ? ' (' + partes.join(' y ') + ')' : '') + ', la de la normativa. Solo un socio la cambia.';
        };
        var html = '<h2 id="lg-vt">' + (s ? 'Cambiar la sanción' : 'Apuntar una sanción') + '</h2>' +
          '<p class="u-nota">' + texto(pFijo ? titulo(pFijo) + ' · ' + nomJornada(pFijo) : equipo(idEq) + ' · ' + ligaCompleta((M.ix.eq[idEq] || {}).ID_LIGA)) + '</p><div class="u-campos">' +
          (pFijo ? campoF('Equipo sancionado', '<select id="lg-s-eq">' + opciones([pFijo.ID_INSCRIPCION_LOCAL, pFijo.ID_INSCRIPCION_VISITANTE].filter(Boolean).map(function (x) { return [x, equipo(x)]; }), idEq, 'Elige el equipo') + '</select>')
            : campoF('Partido', '<select id="lg-s-par">' + opciones(suyos.map(function (p) { return [p.ID, nomP(p)]; }), idP, 'Sin partido') + '</select>', 'u-ancho')) +
          campoF('Tipo', '<select id="lg-s-tipo">' + opciones(TIPOS_SANCION.concat(tipo && TIPOS_SANCION.indexOf(tipo) < 0 ? [tipo] : []).map(function (x) { return [x, x]; }), tipo, 'Elige el tipo') + '</select>') +
          campoF('Fecha', '<input type="date" id="lg-s-fecha" value="' + texto(s && s.FECHA ? s.FECHA : fechaDe(idP)) + '">') +
          campoF('Motivo', '<textarea id="lg-s-motivo" rows="2" maxlength="300">' + texto(motivo) + '</textarea>', 'u-ancho') +
          (interno ? campoF('Multa (€)', importe('IMPORTE', s && s.FECHA_PAGO)) + campoF('Para el rival (€)', importe('COMPENSACION', s && s.FECHA_COMPENSACION)) + campoF('Para el árbitro (€)', importe('PARA_ARBITRO', s && s.FECHA_PAGO)) : '') +
          '</div><p class="u-nota" id="lg-s-precio">' + texto(interno ? 'De la multa, lo que se da al equipo rival y lo que gana el árbitro. Por defecto, el de la normativa.' : precio(ini)) + '</p>' +
          (s && !s._nueva ? htmlPagos(s) : '') +
          botones('<button type="button" class="u-btn u-btn-accion" id="lg-guardar">' + (s ? 'Guardar cambios' : 'Apuntar la sanción') + '</button>' +
            (s && !s.FECHA_PAGO && !s.FECHA_COMPENSACION ? '<button type="button" class="u-btn" id="lg-s-quitar">Quitar la sanción</button>' : '') +
            '<button type="button" class="u-btn u-btn-texto" id="lg-s-volver">Volver</button>');
        ventana(html, function () {
          if (s) abierta = 'S:' + s.ID;
          var fechaMano = !!(s && s.FECHA && s.FECHA !== fechaDe(idP));
          vent.oninput = function (e) { if (e.target.id === 'lg-s-fecha') fechaMano = true; };
          vent.onchange = function (e) {
            if (e.target.id === 'lg-s-par' && !fechaMano) vent.querySelector('#lg-s-fecha').value = fechaDe(e.target.value);
            if (e.target.id === 'lg-s-tipo' && !interno) vent.querySelector('#lg-s-precio').textContent = precio(multaDe(cfg.SANCION_MULTAS, e.target.value));
          };
          vent.onclick = function (e) {
            var b = e.target.closest('[data-pago]'); if (b) { formPago(s, b.getAttribute('data-pago'), function () { formSancion(T.fila('SANCIONES', s.ID) || s, null, volver); }); return; }
            b = e.target.closest('[data-despagar]'); if (b) despagar(s, b.getAttribute('data-despagar'), b, volver);
          };
          vent.querySelector('#lg-s-volver').onclick = volver;
          vent.querySelector('#lg-guardar').onclick = function () {
            var v = { id_partido: pFijo ? pFijo.ID : val('lg-s-par'), id_inscripcion_equipo: pFijo ? val('lg-s-eq') : idEq, tipo: val('lg-s-tipo'), motivo: val('lg-s-motivo'), fecha: val('lg-s-fecha') }, mal = [];
            if (interno) ['IMPORTE', 'COMPENSACION', 'PARA_ARBITRO'].forEach(function (k) { v[k.toLowerCase()] = val('lg-s-' + k).replace(/\s*€$/, '').replace(',', '.'); });
            if (!v.id_inscripcion_equipo) mal.push('Elige el equipo sancionado.');
            if (!v.tipo) mal.push('Elige el tipo de sanción.');
            if (!v.motivo) mal.push('Di el motivo.');
            verError(mal);
            if (mal.length) return;
            if (s) { // solo lo que cambia
              Object.keys(v).forEach(function (k) { if (String(s[k.toUpperCase()] == null ? '' : s[k.toUpperCase()]) === String(v[k])) delete v[k]; });
              if (!Object.keys(v).length) { volver(); return; }
            }
            var bt = vent.querySelector('#lg-guardar'); bt.disabled = true; bt.textContent = 'Guardando…';
            guardar('ligas_sancion', { sancion: s ? s.ID : null, valores: v }).then(function () {
              if (ctx.abierta()) ctx.aviso(s ? 'Sanción cambiada.' : 'Sanción apuntada.');
              volver();
            }, function (e) { bt.disabled = false; bt.textContent = s ? 'Guardar cambios' : 'Apuntar la sanción'; verError([limpio(e)]); });
          };
          var q = vent.querySelector('#lg-s-quitar');
          if (q) q.onclick = function () {
            if (!q.getAttribute('data-ok')) { q.setAttribute('data-ok', '1'); q.textContent = 'Se quita del todo: pulsa otra vez'; return; }
            q.disabled = true; q.textContent = 'Quitando…';
            guardar('ligas_sancion_quitar', { sancion: s.ID }).then(function () { if (ctx.abierta()) ctx.aviso('Sanción quitada.'); volver(); },
              function (e) { q.disabled = false; q.removeAttribute('data-ok'); q.textContent = 'Quitar la sanción'; verError([limpio(e)]); });
          };
        });
      }
      /** El dinero de una sanción apuntada: la multa (cobrarla o deshacer) y lo del rival (pagarlo con su justificante o deshacer). */
      function htmlPagos(s) {
        var m = num(s.IMPORTE), r = num(s.COMPENSACION), p = s.ID_PARTIDO ? T.fila('PARTIDOS', s.ID_PARTIDO) : null, rival = equipo(rivalDe(s));
        if (!(m > 0)) return '';
        var linea = function (txt, debe, boton) { return '<li' + (debe ? ' class="lg-san-debe"' : '') + '><span>' + texto(txt) + '</span>' + boton + '</li>'; };
        var h = linea('Multa de ' + euros(m) + (s.FECHA_PAGO ? ': pagada el ' + fecha(s.FECHA_PAGO) : ': la debe ' + equipo(s.ID_INSCRIPCION_EQUIPO)), !s.FECHA_PAGO,
          s.FECHA_PAGO ? (s.FECHA_COMPENSACION ? '' : '<button type="button" class="u-btn u-btn-texto" data-despagar="multa">Deshacer el cobro</button>') : '<button type="button" class="u-btn" data-pago="multa">La ha pagado</button>');
        if (r > 0 && s.FECHA_PAGO) h += linea(euros(r) + ' para ' + (rival || 'el rival') + (s.FECHA_COMPENSACION ? ': dados el ' + fecha(s.FECHA_COMPENSACION) : ': se los debemos'), !s.FECHA_COMPENSACION,
          s.FECHA_COMPENSACION ? '<button type="button" class="u-btn u-btn-texto" data-despagar="rival">Deshacer el pago</button>' : '<button type="button" class="u-btn" data-pago="rival">Ya se los hemos dado</button>');
        if (num(s.PARA_ARBITRO) > 0 && p && (p.ID_ARBITRO_REAL || p.ID_ARBITRO)) h += linea(euros(s.PARA_ARBITRO) + ' para ' + persona(p.ID_ARBITRO_REAL || p.ID_ARBITRO) + ', el árbitro: ' +
          (s.FECHA_PAGO ? 'en sus cobros, con su arbitraje' : 'cuando se pague la multa'), false, '');
        return '<h3 class="lg-sub">Dinero</h3><ul class="lg-san-pagos">' + h + '</ul>';
      }
      /**
       * Cobrar la multa (que = 'multa': ingreso con su factura en Economía) o pagar al rival ('rival': gasto con su justificante
       * en PDF, la función del servidor). La cuenta, por defecto la caja del gestor de la liga (ligas_sancion_cuentas).
       */
      function formPago(s, que, volver) {
        var multa = que === 'multa';
        ventana('<h2 id="lg-vt">' + (multa ? 'Cobrar la multa' : 'Pagar al rival') + '</h2>' +
          '<p class="u-nota">' + texto(euros(multa ? s.IMPORTE : s.COMPENSACION) + (multa ? ' de ' + equipo(s.ID_INSCRIPCION_EQUIPO) + '. Se apunta como ingreso en Economía, con su factura sin IVA.' : '. Se apunta como gasto en Economía, con un justificante en PDF para que lo firme quien lo recibe.')) + '</p>' +
          '<p class="u-nota" id="lg-pg-gestor"></p><div class="u-campos">' + campoF('Día', '<input type="date" id="lg-pg-fecha" value="' + hoy() + '" max="' + hoy() + '">') +
          campoF(multa ? 'Dónde entra el dinero' : 'De dónde sale el dinero', '<select id="lg-pg-cuenta"><option value="">Cargando…</option></select>') + '</div>' +
          botones('<button type="button" class="u-btn u-btn-accion" id="lg-pg-ok" disabled>' + (multa ? 'Apuntar el cobro' : 'Apuntar el pago') + '</button><button type="button" class="u-btn u-btn-texto" id="lg-pg-volver">Volver</button>'), function () {
          var sel = vent.querySelector('#lg-pg-cuenta'), ok = vent.querySelector('#lg-pg-ok');
          vent.querySelector('#lg-pg-volver').onclick = volver;
          ctx.llamar('ligas_sancion_cuentas', [{ sancion: s.ID }]).then(function (r) {
            if (!vent.contains(sel)) return;
            sel.innerHTML = opciones((r.cuentas || []).map(function (x) { return [x.id, x.nombre]; }), r.defecto, 'Elige la cuenta');
            vent.querySelector('#lg-pg-gestor').innerHTML = r.aviso ? '<span class="u-mal">' + texto(r.aviso) + '</span>'
              : texto(multa ? 'La multa se le paga a ' + r.gestor.apodo + ', el gestor de la liga: entra en su caja de Konamigas.' : 'Se los da ' + r.gestor.apodo + ', el gestor de la liga, de su caja de Konamigas.');
            ok.disabled = false;
          }, function (e) { if (vent.contains(sel)) { sel.innerHTML = '<option value="">—</option>'; verError(['No se han podido leer las cuentas: ' + limpio(e)]); } });
          ok.onclick = function () {
            var f = val('lg-pg-fecha'), c = val('lg-pg-cuenta');
            if (!f || !c) { verError([!f ? 'Pon el día.' : multa ? 'Di dónde entra el dinero.' : 'Di de dónde sale el dinero.']); return; }
            var hecho = guardar(multa ? 'ligas_sancion_pagar' : 'justificante', multa ? { sancion: s.ID, que: 'multa', fecha: f, cuenta: c } : { sancion: s.ID, fecha: f, cuenta: c },
              { tabla: 'SANCIONES', id: s.ID, cambios: multa ? { FECHA_PAGO: f } : { FECHA_COMPENSACION: f } });
            volver();
            hecho.then(function (r) {
              if (ctx.abierta()) ctx.aviso((multa ? 'Multa cobrada: factura ' + ((r && r.factura) || '') + ' apuntada en Economía.' : 'Pago al rival apuntado en Economía, con su justificante en PDF.') +
                (r && r.avisos && r.avisos.length ? ' ' + r.avisos.join(' ') : ''));
            }, nada);
          };
        });
      }
      /** Deshacer un cobro o un pago (dos toques): quita su movimiento de Economía y su papel queda Anulado. */
      function despagar(s, que, b, volver) {
        if (!b.getAttribute('data-ok')) { b.setAttribute('data-ok', '1'); b.textContent = 'Se quita de Economía: pulsa otra vez'; return; }
        guardar('ligas_sancion_despagar', { sancion: s.ID, que: que }, { tabla: 'SANCIONES', id: s.ID, cambios: que === 'multa' ? { FECHA_PAGO: '' } : { FECHA_COMPENSACION: '' } })
          .then(function () { if (ctx.abierta()) ctx.aviso('Pago deshecho.'); }, nada);
        formSancion(T.fila('SANCIONES', s.ID) || s, null, volver);
      }

      /* ---------- ficha de un equipo y de una jugadora ---------- */

      /** La ficha de un equipo: cómo va (de la clasificación), su próximo partido, sus últimos resultados, su plantilla, su carta y sus sanciones. */
      function fichaEquipo(id) {
        var e = M.ix.eq[String(id || '')];
        if (!e) return;
        var ed = M.ix.eqd[e.ID] || {}, ss = sancionesDe(M.san, { equipo: e.ID }), c = color(e.ID);
        var fe = copa(e.ID_LIGA) ? null : clasificacion(M.clas, e.ID_LIGA).filter(function (x) { return x.id === String(e.ID); })[0];
        var ps = M.par.filter(function (p) { return p.ID_INSCRIPCION_LOCAL === e.ID || p.ID_INSCRIPCION_VISITANTE === e.ID; });
        var jugados = ps.map(function (p) { return resultadoDe(p, e.ID); }).filter(function (x) { return x.hay; }).sort(function (x, y) { return orden(cuando(y.p), cuando(x.p)); });
        var proximo = ps.filter(function (p) { return p.ESTADO === 'Programado' && String(p.FECHA || '') >= hoy(); }).sort(function (a, b) { return orden(cuando(a), cuando(b)); })[0];
        var linea = function (x) {
          return '<li><button type="button" class="lg-ef-p" data-p="' + texto(x.p.ID) + '"><span class="lg-ef-r lg-ef-' + x.r + '">' + x.r + '</span><span class="lg-ef-txt"><b>' + texto('Contra ' + equipo(x.rival)) + '</b>' +
            '<small>' + texto(nomJornada(x.p, true) + ' · ' + fecha(x.p.FECHA) + (x.p.ID_INSCRIPCION_LOCAL === e.ID ? ' · local' : ' · visitante') + (x.p.ESTADO === 'Anulado' ? ' · anulado' : '')) + '</small></span>' +
            '<b class="u-cifra">' + x.a + '–' + x.b + '</b></button></li>';
        };
        var cifra = function (v, t) { return '<div><b class="u-cifra">' + texto(v) + '</b><span>' + texto(t) + '</span></div>'; };
        var html = '<h2 id="lg-vt"><span class="lg-eqt">' + punto(e.ID) + texto(equipo(e.ID)) + '</span></h2>' +
          '<p class="u-nota">' + texto([ligaCompleta(e.ID_LIGA), c.NOMBRE ? 'Color ' + c.NOMBRE.toLowerCase() : '', e.ESTADO === 'Baja' ? 'De baja' : ''].filter(String).join(' · ')) + '</p>' +
          (num(ed.DEBE) > 0 ? '<p class="lg-pav lg-pav-ficha lg-av-no">Debe ' + euros(ed.DEBE) + ' de multas.</p>' : '') +
          (fe ? '<div class="pf-cifras lg-ef-cifras">' + (fe.baja ? cifra('–', 'de baja') : cifra(fe.pos + '.º', 'de ' + clasificacion(M.clas, e.ID_LIGA).filter(function (x) { return !x.baja; }).length)) + cifra(fe.pts, fe.pts === 1 ? 'punto' : 'puntos') +
            cifra(fe.pg + ' · ' + fe.pe + ' · ' + fe.pp, 'ganados · empatados · perdidos') + cifra(fe.gf + '–' + fe.gc, 'goles a favor y en contra') + '</div>' +
            '<p class="u-nota">' + fe.pj + (fe.pj === 1 ? ' partido jugado' : ' partidos jugados') + (fe.jugar ? ' y ' + fe.jugar + ' por jugar' : '') + '.</p>' : '') +
          (proximo ? '<h3 class="lg-sub">Próximo partido</h3><ul class="lg-ef-ps"><li><button type="button" class="lg-ef-p" data-p="' + texto(proximo.ID) + '"><span class="lg-ef-txt"><b>' +
            texto('Contra ' + (equipo(proximo.ID_INSCRIPCION_LOCAL === e.ID ? proximo.ID_INSCRIPCION_VISITANTE : proximo.ID_INSCRIPCION_LOCAL) || 'por decidir')) + '</b><small>' +
            texto(fechaDia(proximo.FECHA) + (proximo.HORA ? ' · ' + proximo.HORA : '') + ' · ' + campo(proximo.ID_CAMPO) + ' · J' + proximo.JORNADA) + '</small></span></button></li></ul>' : '') +
          (jugados.length ? '<h3 class="lg-sub">Últimos resultados</h3><ul class="lg-ef-ps">' + jugados.slice(0, 5).map(linea).join('') + '</ul>' +
            (jugados.length > 5 ? '<details><summary class="u-nota">Ver los ' + jugados.length + ' resultados</summary><ul class="lg-ef-ps">' + jugados.slice(5).map(linea).join('') + '</ul></details>' : '') : '') +
          '<h3 class="lg-sub">Plantilla</h3><div id="lg-ef-plantilla">' + htmlPlantilla(e.ID) + '</div>' +
          '<h3 class="lg-sub">Carta de aplazamiento</h3><p>' + texto(ed.CARTA_USADA ? 'Ya la ha gastado esta temporada: aplazó el partido del ' + fecha(ed.CARTA_USADA_FECHA) + '. Otro aplazamiento le cuesta su multa.'
            : 'La tiene: puede aplazar un partido esta temporada avisando con ' + num(cfg.CARTA_DIAS) + ' días como mínimo.') + '</p>' +
          '<h3 class="lg-sub">Sanciones</h3>' + (ss.length ? htmlSanciones(ss, 'equipo') : '<p class="u-vacio">No tiene sanciones.</p>') +
          '<div class="n-botones">' + (ed.GESTIONA ? '<button type="button" class="u-btn" data-san-nueva>Apuntar una sanción</button>' : '') + '<button type="button" class="u-btn u-btn-texto" data-cerrar>Cerrar</button></div>';
        ventana(html, function () {
          abierta = 'E:' + e.ID;
          var volver = function () { fichaEquipo(e.ID); };
          vent.onclick = function (ev) { if (ev.target.closest('[data-san-nueva]')) { formSancion(null, { equipo: e.ID }, volver); return; } clicFicha(ev, volver); };
          cargarJugadoras('ID_INSCRIPCION_EQUIPO', [e.ID]).then(function () { var x = vent.querySelector('#lg-ef-plantilla'); if (x && abierta === 'E:' + e.ID) x.innerHTML = htmlPlantilla(e.ID); },
            function () { var x = vent.querySelector('#lg-ef-plantilla'); if (x) x.innerHTML = '<p class="u-nota">No se ha podido leer la plantilla.</p>'; });
        });
      }
      /** La plantilla: las activas por dorsal, con sus goles en la liga (de la vista de goleadoras); las de baja, contadas. */
      function htmlPlantilla(ie) {
        var js = plantilla(M.jug, ie);
        if (!T.filas('PLANTILLAS').some(function (i) { return String(i.ID_INSCRIPCION_EQUIPO) === String(ie); })) return '<p class="u-nota">Cargando la plantilla…</p>';
        var goles = {};
        M.goleadoras.forEach(function (f) { if (String(f.ID_INSCRIPCION_EQUIPO) === String(ie)) goles[f.ID_INSCRIPCION_JUGADORA] = num(f.GOLES) || 0; });
        var act = js.filter(function (j) { return j.ACTIVA; }), baja = js.length - act.length;
        if (!act.length) return '<p class="u-vacio">No tiene jugadoras inscritas' + (baja ? ' (' + baja + ' de baja)' : '') + '.</p>';
        return '<p class="u-nota">' + act.length + (act.length === 1 ? ' jugadora' : ' jugadoras') + (baja ? ' (y ' + baja + ' de baja)' : '') + '.</p><ol class="lg-ranking lg-ef-plantilla">' + act.map(function (j) {
          var n = goles[j.ID] || 0;
          return '<li><span class="lg-dorsal u-cifra">' + texto(j.DORSAL || '–') + '</span><span class="lg-ef-nom">' + texto(j.NOMBRE) + '</span>' + (n ? '<span class="u-cifra lg-ef-gol">' + n + (n === 1 ? ' gol' : ' goles') + '</span>' : '') + '</li>';
        }).join('') + '</ol>';
      }
      /** La ficha de una jugadora: sus goles por temporada (de la vista de goleadoras), con sus equipos y los partidos que jugaron. */
      function fichaJugadora(jugadora) {
        var G = golesJugadora(M.goleadoras, M.clas, jugadora), ij = M.goleadoras.filter(function (f) { return String(f.ID_JUGADORA) === String(jugadora); }).map(function (f) { return f.ID_INSCRIPCION_JUGADORA; })[0];
        var nomTemp = function (id) { var t = M.temp.filter(function (x) { return x.ID === id; })[0]; return t ? t.NOMBRE : id; };
        ventana('<h2 id="lg-vt">' + texto(nomJug(ij)) + '</h2>' +
          '<div class="lg-stats"><div><b class="u-cifra">' + G.total + '</b><span>' + (G.total === 1 ? 'gol' : 'goles') + ' en total</span></div>' +
          '<div><b class="u-cifra">' + G.temporadas.length + '</b><span>' + (G.temporadas.length === 1 ? 'temporada marcando' : 'temporadas marcando') + '</span></div></div>' +
          '<div class="u-tabla-caja"><table class="u-tabla lg-clas"><thead><tr><th>Temporada</th><th>Equipo</th><th class="num">Goles</th><th class="num u-solo-ancho">Partidos</th><th class="num">Por partido</th></tr></thead><tbody>' +
          G.temporadas.map(function (t) {
            return '<tr><td class="u-tabla-t">' + texto(nomTemp(t.temporada)) + '<div class="u-nota">' + texto(t.ligas.map(ligaCompleta).join(', ')) + '</div></td>' +
              '<td><span class="lg-eqt">' + punto(t.equipos[t.equipos.length - 1]) + texto(t.equipos.map(equipo).join(', ')) + '</span></td><td class="num"><b>' + t.goles + '</b></td>' +
              '<td class="num u-solo-ancho">' + t.jugados + '</td><td class="num">' + (t.jugados ? String(Math.round(t.goles / t.jugados * 100) / 100).replace('.', ',') : '–') + '</td></tr>';
          }).join('') + '</tbody></table></div><p class="u-nota">«Partidos» son los que jugó su equipo, contando los anulados: el acta no dice qué jugadoras jugaron.</p>' +
          '<div class="n-botones"><button type="button" class="u-btn" data-cerrar>Cerrar</button></div>');
      }

      /* ---------- el acta y el estado ---------- */

      /** El acta: el marcador y, por cada gol, quién lo marcó (una jugadora, en propia o puntualidad), quién arbitró y notas. */
      function formActa(p) {
        var L = p.ID_INSCRIPCION_LOCAL, V = p.ID_INSCRIPCION_VISITANTE, elegidos = {}, marcador = {};
        elegidos[L] = []; elegidos[V] = [];
        golesDe(p.ID).forEach(function (g) { if (elegidos[g.ID_INSCRIPCION_EQUIPO]) elegidos[g.ID_INSCRIPCION_EQUIPO].push(g.ID_INSCRIPCION_JUGADORA || (String(g.NOTAS || '').trim() === PUNTUALIDAD ? '_puntualidad' : '_nadie')); });
        marcador[L] = p.ESTADO === 'Jugado' ? num(p.GOLES_LOCAL) : elegidos[L].length; marcador[V] = p.ESTADO === 'Jugado' ? num(p.GOLES_VISITANTE) : elegidos[V].length;
        var arbs = staff.staff.filter(function (s) { return s.ARBITRO && s.ACTIVO; }).map(function (s) { return s.ID; });
        [p.ID_ARBITRO, p.ID_ARBITRO_REAL].forEach(function (x) { if (x && arbs.indexOf(x) < 0) arbs.push(x); });
        var lado = function (e, k) {
          var c = color(e);
          return '<div class="lg-lado"' + (c.HEX ? ' style="--c:' + texto(c.HEX) + '"' : '') + '><span class="u-etiqueta">' + k + '</span><b class="lg-eqt">' + punto(e) + texto(equipo(e)) + '</b>' +
            '<div class="lg-paso"><button type="button" class="u-btn u-btn-icono" data-paso="-1" data-e="' + texto(e) + '" aria-label="Un gol menos de ' + texto(equipo(e)) + '">−</button>' +
            '<input type="number" inputmode="numeric" min="0" step="1" id="lg-g-' + texto(e) + '" value="' + marcador[e] + '" aria-label="Goles de ' + texto(equipo(e)) + '">' +
            '<button type="button" class="u-btn u-btn-icono" data-paso="1" data-e="' + texto(e) + '" aria-label="Un gol más de ' + texto(equipo(e)) + '">+</button></div><div class="lg-quien" id="lg-q-' + texto(e) + '"></div></div>';
        };
        ventana('<h2 id="lg-vt">Acta · ' + texto(titulo(p)) + '</h2><p class="u-nota">' + texto([fechaDia(p.FECHA) + ' · ' + fecha(p.FECHA), p.HORA, campo(p.ID_CAMPO)].filter(String).join(' · ')) + '. Apunta el resultado y quién marcó cada gol.</p>' +
          '<div class="lg-acta">' + lado(L, 'Local') + lado(V, 'Visitante') + '</div>' +
          (p.FASE ? '<div class="u-campos" id="lg-pen" hidden><p class="u-nota u-ancho">Empate en la fase final: se decide por penaltis.</p>' +
            campoF('Penaltis de ' + texto(equipo(L)), '<input type="number" inputmode="numeric" min="0" step="1" id="lg-pen-l" value="' + texto(p.PENALTIS_LOCAL == null ? '' : p.PENALTIS_LOCAL) + '">') +
            campoF('Penaltis de ' + texto(equipo(V)), '<input type="number" inputmode="numeric" min="0" step="1" id="lg-pen-v" value="' + texto(p.PENALTIS_VISITANTE == null ? '' : p.PENALTIS_VISITANTE) + '">') + '</div>' : '') +
          '<div class="u-campos">' +
          campoF('Arbitró', '<select id="lg-real">' + opciones(arbs.map(function (x) { return [x, persona(x)]; }), p.ID_ARBITRO_REAL || p.ID_ARBITRO, 'Sin árbitro') + '</select>') +
          campoF('Notas', '<textarea id="lg-notas" rows="2">' + texto(p.NOTAS) + '</textarea>', 'u-ancho') + '</div>' +
          botones('<button type="button" class="u-btn u-btn-accion" id="lg-guardar">Guardar el acta</button><button type="button" class="u-btn" data-cerrar>Cancelar</button>'), function () {
          function quien(e) {
            var caja = vent.querySelector('#lg-q-' + e), n = Math.max(0, Math.min(40, parseInt(vent.querySelector('#lg-g-' + e).value, 10) || 0));
            [].forEach.call(caja.querySelectorAll('select'), function (s, i) { elegidos[e][i] = s.value; });
            var js = plantilla(M.jug, e), cargada = T.filas('PLANTILLAS').some(function (i) { return String(i.ID_INSCRIPCION_EQUIPO) === String(e); }), h = '';
            for (var i = 0; i < n; i++) {
              var v = elegidos[e][i] || '', ops = js.filter(function (j) { return j.ACTIVA || j.ID === v; }).map(function (j) { return [j.ID, (j.DORSAL ? j.DORSAL + ' · ' : '') + j.NOMBRE]; });
              h += '<label class="u-campo"><span class="u-oculto">Gol ' + (i + 1) + ' de ' + texto(equipo(e)) + '</span><select data-gol="' + i + '">' +
                opciones(ops.concat([['_nadie', 'En propia'], ['_puntualidad', 'Puntualidad (llega tarde ' + equipo(e === L ? V : L) + ')']]), v, cargada ? 'Gol ' + (i + 1) + ': ¿quién marcó?' : 'Cargando jugadoras…') + '</select></label>';
            }
            caja.innerHTML = h;
          }
          function empate() { return parseInt(vent.querySelector('#lg-g-' + L).value, 10) === parseInt(vent.querySelector('#lg-g-' + V).value, 10); }
          function todo() { quien(L); quien(V); var pn = vent.querySelector('#lg-pen'); if (pn) pn.hidden = !empate(); }
          todo();
          cargarJugadoras('ID_INSCRIPCION_EQUIPO', [L, V]).then(function () { if (velo.classList.contains('abierto')) todo(); }, function (e) { verError(['No se han podido leer las jugadoras: ' + limpio(e)]); });
          vent.oninput = function (e) { if (/^lg-g-/.test(e.target.id || '')) { quien(e.target.id.slice(5)); var pn = vent.querySelector('#lg-pen'); if (pn) pn.hidden = !empate(); } };
          vent.onclick = function (e) {
            var b = e.target.closest('[data-paso]');
            if (!b) return;
            var k = b.getAttribute('data-e'), inp = vent.querySelector('#lg-g-' + k);
            inp.value = Math.max(0, (parseInt(inp.value, 10) || 0) + Number(b.getAttribute('data-paso')));
            quien(k);
            var pn = vent.querySelector('#lg-pen'); if (pn) pn.hidden = !empate();
          };
          vent.querySelector('#lg-guardar').onclick = function () {
            todo();
            var gl = parseInt(vent.querySelector('#lg-g-' + L).value, 10), gv = parseInt(vent.querySelector('#lg-g-' + V).value, 10), mal = [], goles = [];
            if (!(gl >= 0) || !(gv >= 0)) mal.push('Pon los goles de los dos equipos (0 si no marcó).');
            [[L, gl], [V, gv]].forEach(function (x) {
              for (var i = 0; i < (x[1] || 0); i++) {
                var v = elegidos[x[0]][i];
                if (!v) { mal.push('Falta quién marcó algún gol de ' + equipo(x[0]) + ': una jugadora, en propia o puntualidad.'); break; }
                goles.push({ id_inscripcion_equipo: x[0], id_inscripcion_jugadora: v.charAt(0) === '_' ? null : v, tipo: v === '_puntualidad' ? PUNTUALIDAD : v === '_nadie' ? EN_PROPIA : null });
              }
            });
            var pl = null, pv = null;
            if (p.FASE && gl === gv && gl >= 0) {
              pl = parseInt(val('lg-pen-l'), 10); pv = parseInt(val('lg-pen-v'), 10);
              if (!(pl >= 0) || !(pv >= 0)) mal.push('Empate: apunta cómo acabaron los penaltis.');
              else if (pl === pv) mal.push('En los penaltis gana alguien: no pueden acabar empatados.');
            }
            verError(mal);
            if (mal.length) return;
            var real = val('lg-real'), notas = val('lg-notas');
            cerrar(true);
            guardar('ligas_acta', { partido: p.ID, goles_local: gl, goles_visitante: gv, goles: goles, arbitro_real: real || null, notas: notas, penaltis_local: pl, penaltis_visitante: pv },
              { tabla: 'PARTIDOS', id: p.ID, cambios: { GOLES_LOCAL: gl, GOLES_VISITANTE: gv, ESTADO: 'Jugado', ID_ARBITRO_REAL: real === p.ID_ARBITRO ? '' : real, MOTIVO: '', ANULADO_POR: '', NOTAS: notas,
                PENALTIS_LOCAL: pl === null ? '' : pl, PENALTIS_VISITANTE: pv === null ? '' : pv } })
              .then(function () { if (ctx.abierta()) ctx.aviso('Acta guardada: ' + equipo(L) + ' ' + gl + ' – ' + gv + ' ' + equipo(V) + (pl !== null ? ' (penaltis ' + pl + '-' + pv + ')' : '') + '.'); }, nada);
          };
        });
      }
      /** La carta de un equipo para aplazar un partido, de la base (ligas_carta): guardada mientras se ve el formulario. */
      var cartas = {};
      function cartaDe(p, ie, aviso, alLlegar) {
        var k = p.ID + '|' + ie + '|' + aviso;
        if (cartas[k] && cartas[k].ya) return cartas[k].ya;
        if (!cartas[k]) {
          cartas[k] = ctx.llamar('ligas_carta', [{ partido: p.ID, equipo: ie, aviso: aviso }]);
          cartas[k].then(function (r) { cartas[k].ya = r; if (alLlegar) alLlegar(); }, function (e) { delete cartas[k]; if (ctx.abierta()) ctx.aviso('No se ha podido mirar la carta: ' + limpio(e)); });
        }
        return null;
      }
      /**
       * «Acta y estado»: qué pasó (lo que deja la base a quien mira: PARTIDOS_DETALLE · PUEDE) y, a quien lo gestiona, árbitro y
       * notas. «Se jugó» sigue con el acta; lo demás lo escribe ligas_partido (que apunta sola la sanción del no presentado).
       */
      function formEstado(p) {
        var ops = puede(p), ya = queEs(p), gestiona = !!det(p).GESTIONA, nAn = num(cfg.RESULTADO_ANULADO);
        var TXT = { jugado: p.ESTADO === 'Jugado' ? 'Se jugó: cambiar el acta' : 'Se jugó: cerrar el acta', nopresentado: 'Un equipo no se presentó o avisó demasiado tarde' + (nAn > 0 ? ' (pierde 0-' + nAn + ')' : '') + ' y paga su multa',
          suspendido: 'Se suspendió por lluvia u otra causa (se vuelve a jugar otro día)', aplazado: 'Se aplaza a otro día (el equipo avisó con tiempo, u otra causa)',
          anulado: 'Anulado sin culpable, por algo excepcional (no cuenta)', porjugar: 'Por jugar', libre: 'Campo libre' };
        var dos = [p.ID_INSCRIPCION_LOCAL, p.ID_INSCRIPCION_VISITANTE].filter(Boolean).map(function (e) { return [e, equipo(e)]; });
        var conStaff = function (f, yaEsta) {
          var l = staff.staff.filter(function (s) { return f(s) && s.ACTIVO; }).map(function (s) { return s.ID; });
          if (yaEsta && l.indexOf(yaEsta) < 0) l.push(yaEsta);
          return l.map(function (x) { return [x, persona(x)]; });
        };
        ventana('<h2 id="lg-vt">' + texto(titulo(p)) + '</h2><p class="u-nota">' + texto(fechaDia(p.FECHA) + ' · ' + p.HORA + ' · ' + campo(p.ID_CAMPO)) + (det(p).MOVER ? '. Para cambiar la hora o el campo, usa «Mover dentro del día».' : '.') + '</p>' +
          '<fieldset class="lg-que"><legend class="u-etiqueta">¿Qué pasó?</legend>' + ops.map(function (o) {
            return '<label class="u-check"><input type="radio" name="lg-que" value="' + o + '"' + (o === ya ? ' checked' : '') + '> ' + texto(TXT[o]) + '</label>';
          }).join('') + '</fieldset><div class="u-campos">' +
          campoF('Qué equipo', '<select id="lg-ANULADO_POR">' + opciones(dos, p.ANULADO_POR, 'Elige el equipo') + '</select>', 'lg-si-np') +
          (gestiona ? campoF('¿Lo pide un equipo?', '<select id="lg-APLAZADO_POR">' + opciones(dos, p.APLAZADO_POR, 'No: por otra causa (sin carta ni multa)') + '</select>', 'lg-si-apl') +
            campoF('Avisó el', '<input type="date" id="lg-AVISO_APLAZAMIENTO" value="' + texto(p.AVISO_APLAZAMIENTO || hoy()) + '">', 'lg-si-apl lg-si-pide') +
            '<p class="u-nota u-ancho lg-si-apl lg-si-pide" id="lg-veredicto"></p>' +
            '<fieldset class="lg-que u-ancho lg-si-paga"><legend class="u-etiqueta">Paga su multa. ¿Y el partido?</legend>' +
              '<label class="u-check"><input type="radio" name="lg-decide" value="aplaza"' + (p.ESTADO !== 'Anulado' ? ' checked' : '') + '> Se aplaza igual</label>' +
              '<label class="u-check"><input type="radio" name="lg-decide" value="pierde"' + (p.ESTADO === 'Anulado' ? ' checked' : '') + '> No se aplaza: lo pierde' + (nAn > 0 ? ' 0-' + nAn : '') + '</label></fieldset>' : '') +
          campoF('Motivo', '<input type="text" id="lg-MOTIVO" maxlength="200" value="' + texto(p.MOTIVO) + '">', 'u-ancho lg-si-motivo') +
          '<div class="lg-fila-chips lg-chips-liga lg-si-susp u-ancho" role="group" aria-label="Motivo">' + MOTIVOS_SUSPENDER.map(function (m) { return '<button type="button" data-motivo="' + texto(m) + '">' + texto(m) + '</button>'; }).join('') + '</div>' +
          (gestiona ? campoF('Árbitro', '<select id="lg-ID_ARBITRO">' + opciones(conStaff(function (s) { return s.ARBITRO; }, p.ID_ARBITRO), p.ID_ARBITRO, 'Sin asignar') + '</select>') +
            campoF('Notas', '<textarea id="lg-NOTAS" rows="2">' + texto(p.NOTAS) + '</textarea>', 'u-ancho') : '') + '</div>' +
          '<p class="u-nota lg-si-jugado">Al seguir, el marcador y quién marcó cada gol.</p><p class="u-nota lg-si-np">Su sanción de no presentado se apunta sola, con la multa de la normativa.</p>' +
          botones('<button type="button" class="u-btn u-btn-accion" id="lg-guardar">Guardar</button><button type="button" class="u-btn u-btn-texto" data-cerrar>Cancelar</button>'), function () {
          var g = vent.querySelector('#lg-guardar'), mo = vent.querySelector('#lg-MOTIVO');
          var que = function () { var r = vent.querySelector('input[name="lg-que"]:checked'); return r ? r.value : ''; };
          var ver = function (sel, si) { [].forEach.call(vent.querySelectorAll(sel), function (x) { x.hidden = !si; }); };
          function marcarMotivo() { [].forEach.call(vent.querySelectorAll('[data-motivo]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-motivo') === mo.value ? 'true' : 'false'); }); }
          /** La carta del equipo que pide aplazarlo (de la base) y, si paga, qué decide el gestor. */
          function verCarta() {
            var apl = que() === 'aplazado', sel = vent.querySelector('#lg-APLAZADO_POR'), pide = apl && sel && sel.value, v = vent.querySelector('#lg-veredicto');
            ver('.lg-si-apl', apl); ver('.lg-si-pide', !!pide);
            var c = pide ? cartaDe(p, sel.value, val('lg-AVISO_APLAZAMIENTO'), verCarta) : null;
            if (v) {
              v.textContent = !pide ? '' : !c ? 'Mirando si tiene su carta…' : !c.tipo ? equipo(pide) + ' avisó con ' + c.dias + (c.dias === 1 ? ' día' : ' días') + ' y tiene su carta de aplazamiento: se aplaza sin multa (y la gasta).'
                : c.usada ? equipo(pide) + ' ya gastó su carta de aplazamiento de esta temporada (el ' + fecha(c.usada_fecha) + '): paga su multa.'
                : equipo(pide) + ' avisó con ' + c.dias + (c.dias === 1 ? ' día' : ' días') + ' (el mínimo son ' + c.min + '): paga su multa.';
              v.classList.toggle('u-mal', !!(c && c.tipo));
            }
            ver('.lg-si-paga', !!(c && c.tipo));
          }
          function todo() {
            var q = que();
            ver('.lg-si-np', q === 'nopresentado'); ver('.lg-si-motivo', ['nopresentado', 'suspendido', 'aplazado', 'anulado'].indexOf(q) >= 0); ver('.lg-si-susp', q === 'suspendido'); ver('.lg-si-jugado', q === 'jugado');
            if (q === 'suspendido' && (!mo.value || mo.getAttribute('data-auto'))) { mo.value = MOTIVOS_SUSPENDER[0]; mo.setAttribute('data-auto', '1'); }
            else if (q !== 'suspendido' && mo.getAttribute('data-auto')) { mo.value = ''; mo.removeAttribute('data-auto'); }
            marcarMotivo(); verCarta();
            g.textContent = q === 'jugado' ? 'Seguir con el acta' : 'Guardar'; g.removeAttribute('data-ok');
          }
          todo();
          vent.onchange = function (e) { if (e.target.name === 'lg-que') todo(); else if (e.target.id === 'lg-APLAZADO_POR' || e.target.id === 'lg-AVISO_APLAZAMIENTO') verCarta(); };
          vent.oninput = function (e) { if (e.target === mo) { mo.removeAttribute('data-auto'); marcarMotivo(); } };
          vent.onclick = function (e) {
            var b = e.target.closest('[data-motivo]');
            if (!b) return;
            var m = b.getAttribute('data-motivo');
            mo.removeAttribute('data-auto'); mo.value = m === 'Otro' ? '' : m; marcarMotivo();
            if (m === 'Otro') mo.focus();
          };
          g.onclick = function () {
            var q = que(), c = {}, mal = [], motivo = mo.value.trim();
            if (!q) { verError(['Elige qué pasó.']); return; }
            if (q === 'jugado') { // si estaba anulado, primero vuelve a por jugar (un anulado no tiene acta); luego el acta
              if (p.ESTADO === 'Anulado') guardar('ligas_partido', { partido: p.ID, cambios: { estado: 'Programado', anulado_por: '', motivo: '' } }, { tabla: 'PARTIDOS', id: p.ID, cambios: { ESTADO: 'Programado', ANULADO_POR: '', MOTIVO: '' } });
              formActa(T.fila('PARTIDOS', p.ID) || p); return;
            }
            c.estado = { nopresentado: 'Anulado', suspendido: 'Suspendido', aplazado: 'Aplazado', anulado: 'Anulado', porjugar: 'Programado', libre: 'Libre' }[q];
            c.anulado_por = q === 'nopresentado' ? val('lg-ANULADO_POR') : '';
            if (gestiona) { c.id_arbitro = val('lg-ID_ARBITRO'); c.notas = val('lg-NOTAS'); c.aplazado_por = ''; c.aviso_aplazamiento = ''; }
            var pide = q === 'aplazado' && gestiona ? val('lg-APLAZADO_POR') : '';
            if (pide) {
              c.aplazado_por = pide; c.aviso_aplazamiento = val('lg-AVISO_APLAZAMIENTO');
              var cc = cartaDe(p, pide, c.aviso_aplazamiento), dec = vent.querySelector('input[name="lg-decide"]:checked');
              if (!cc) mal.push('Espera a ver si tiene su carta de aplazamiento.');
              else if (cc.tipo && dec && dec.value === 'pierde') { c.estado = 'Anulado'; c.anulado_por = pide; }
              if (!motivo) motivo = 'Lo pide ' + equipo(pide);
            }
            c.motivo = q === 'nopresentado' ? motivo || 'No se presentó' : ['suspendido', 'aplazado', 'anulado'].indexOf(q) >= 0 ? motivo : '';
            if (q === 'nopresentado' && !c.anulado_por) mal.push('Di qué equipo no se presentó.');
            if (['suspendido', 'aplazado', 'anulado'].indexOf(q) >= 0 && !motivo) mal.push('Di el motivo.');
            verError(mal);
            if (mal.length) return;
            if (p.ESTADO === 'Jugado' && !g.getAttribute('data-ok')) { g.setAttribute('data-ok', '1'); g.textContent = 'Se borra el resultado y sus goles: pulsa otra vez'; return; }
            var pantalla = {};
            Object.keys(c).forEach(function (k) { pantalla[k.toUpperCase()] = c[k]; });
            cerrar(true);
            guardar('ligas_partido', { partido: p.ID, cambios: c }, { tabla: 'PARTIDOS', id: p.ID, cambios: pantalla }).then(function (r) {
              if (ctx.abierta()) ctx.aviso(r && r.sanciones && c.estado === 'Anulado' ? 'Partido guardado: apuntada su sanción.' : 'Partido guardado.');
            }, nada);
          };
        });
      }

      /* ---------- mover, jornadas y recuperar, y avisar a las capitanas ---------- */

      function foto(p) { return { FECHA: p.FECHA, HORA: p.HORA, ID_CAMPO: p.ID_CAMPO }; }
      /** El resumen de un cambio y cuántas capitanas habrá que avisar, antes de guardar. */
      function htmlCambios(cambios) {
        var eqs = equiposDe(cambios.map(function (c) { return c.p; }));
        var deA = function (a, b) { return [a.FECHA !== b.FECHA ? fechaDia(a.FECHA) : '', a.HORA, campo(a.ID_CAMPO)].filter(String).join(' ') + ' → ' + [a.FECHA !== b.FECHA ? fechaDia(b.FECHA) : '', b.HORA, campo(b.ID_CAMPO)].filter(String).join(' '); };
        return '<div class="lg-cambios"><h3 class="lg-sub">Qué cambia</h3><ul>' + cambios.map(function (c) {
          return '<li><b>' + texto(titulo(c.p) + ' · J' + c.p.JORNADA) + '</b><span class="u-cifra">' + texto((c.recupera ? 'Aplazado ' : '') + deA(c.antes, c.nuevo)) + '</span></li>';
        }).join('') + '</ul></div><div class="lg-avisar-ya" role="note"><b>Tendrás que avisar a ' + eqs.length + (eqs.length === 1 ? ' capitana' : ' capitanas') + '</b>' +
          '<span>' + texto(eqs.map(equipo).join(', ')) + '. Al guardar te saldrá la lista con el mensaje ya escrito para enviárselo por WhatsApp.</span></div>';
      }
      /**
       * Guarda un cambio de partidos y enseña la lista de capitanas afectadas, cada una con su WhatsApp y el mensaje escrito (de
       * la vista CONTACTOS_CAPITANAS: las de las ligas y partidos que lleva quien mira) y una casilla para marcarla avisada.
       */
      function avisar(cambios, guardando, ok) {
        var eqs = equiposDe(cambios.map(function (c) { return c.p; })), fallo = false;
        var mensaje = function (eq, capitana) {
          var suyos = cambios.filter(function (c) { return c.p.ID_INSCRIPCION_LOCAL === eq || c.p.ID_INSCRIPCION_VISITANTE === eq; }), l = M.ix.liga[suyos[0].p.ID_LIGA];
          var cuando = function (x) { return { dia: x.FECHA, hora: x.HORA, campo: campoLargo(x.ID_CAMPO) }; };
          return textoAviso({ capitana: capitana, liga: 'la ' + (l ? nomComp(M.ix.comp[l.ID_COMPETICION]) + ' (' + l.NOMBRE + ')' : 'liga'),
            partidos: suyos.map(function (c) { return { titulo: titulo(c.p), jornada: c.p.JORNADA, antes: cuando(c.antes), ahora: cuando(c.nuevo), recupera: !!c.recupera }; }) });
        };
        var lista = function (caps) {
          return '<ul class="lg-capitanas">' + eqs.map(function (eq) {
            var c = caps ? caps[eq] || {} : {}, m = mensaje(eq, c.NOMBRE), enlace = wa(c.TELEFONO, m);
            return '<li><label class="u-check"><input type="checkbox" data-avisada="' + texto(eq) + '"><span class="lg-eqt">' + punto(eq) + '<span><b>' + texto(equipo(eq)) + '</b>' +
              '<small>' + texto(!caps ? 'Buscando a su capitana…' : c.NOMBRE ? c.NOMBRE + (c.TELEFONO ? ' · ' + c.TELEFONO : ' · sin teléfono') : 'Sin capitana en la inscripción') + '</small></span></span></label>' +
              (enlace ? '<a class="u-btn" href="' + texto(enlace) + '" target="_blank" rel="noopener" data-wa="' + texto(eq) + '">WhatsApp</a>' : '') + '<p class="lg-msg">' + texto(m).replace(/\*([^*\n]+)\*/g, '<b>$1</b>') + '</p></li>';
          }).join('') + '</ul>';
        };
        ventana('<h2 id="lg-vt">Avisa a las capitanas</h2><p class="lg-avisar-ya" role="status" id="lg-guardado"><b>Guardando el cambio…</b><span>Mientras, avisa a cada capitana de lo que cambia y márcala cuando lo hayas hecho.</span></p>' +
          '<div id="lg-caps">' + lista(null) + '</div>' + botones('<button type="button" class="u-btn u-btn-accion" id="lg-hecho">Hecho</button>'), function () {
          var marcadas = {}, avisado = false;
          vent.onclick = function (e) { var a = e.target.closest('[data-wa]'); if (a) { var c = vent.querySelector('[data-avisada="' + a.getAttribute('data-wa') + '"]'); if (c) { c.checked = true; marcadas[a.getAttribute('data-wa')] = 1; } } };
          vent.onchange = function (e) { var c = e.target.closest('[data-avisada]'); if (c) marcadas[c.getAttribute('data-avisada')] = c.checked ? 1 : 0; };
          T.leer(['CONTACTOS_CAPITANAS']).then(function () {
            var caja = vent.querySelector('#lg-caps');
            if (!caja || fallo) return;
            caja.innerHTML = lista(indice(T.filas('CONTACTOS_CAPITANAS'), 'ID_INSCRIPCION_EQUIPO'));
            Object.keys(marcadas).forEach(function (k) { var c = caja.querySelector('[data-avisada="' + k + '"]'); if (c) c.checked = !!marcadas[k]; });
          }, function (e) { var caja = vent.querySelector('#lg-caps'); if (caja) caja.insertAdjacentHTML('afterbegin', '<p class="u-nota">No se han podido leer las capitanas: ' + texto(limpio(e)) + '. Los mensajes sí están.</p>'); });
          guardando.then(function () { var g = vent.querySelector('#lg-guardado'); if (g) g.querySelector('b').textContent = ok; else if (ctx.abierta()) ctx.aviso(ok); }, function (e) {
            fallo = true;
            var g = vent.querySelector('#lg-guardado');
            if (!g) return;
            g.className = 'lg-avisar-ya lg-avisar-mal';
            g.innerHTML = '<b>No se ha guardado el cambio.</b><span>' + texto(limpio(e)) + ' Los partidos siguen como estaban: no avises a nadie.</span>';
            vent.querySelector('#lg-caps').innerHTML = '';
          });
          antesDeCerrar = function () {
            var faltan = fallo ? 0 : [].filter.call(vent.querySelectorAll('[data-avisada]'), function (c) { return !c.checked; }).length;
            if (!faltan || avisado) return true;
            avisado = true;
            verError(['Te ' + (faltan === 1 ? 'queda 1 capitana' : 'quedan ' + faltan + ' capitanas') + ' por avisar. Si ya lo has hecho por otro lado, vuelve a pulsar para cerrar.']);
            return false;
          };
          vent.querySelector('#lg-hecho').onclick = function () { cerrar(); };
        });
      }
      /** Mover un partido a otro hueco de su liga el mismo día (las opciones, de la base); si lo ocupa otro de la liga, se intercambian. */
      function formMover(p) {
        ventana('<h2 id="lg-vt">Mover dentro del día</h2><p class="u-nota">' + texto(titulo(p) + ' · ' + fechaDia(p.FECHA) + ' · ahora a las ' + p.HORA + ' en ' + campo(p.ID_CAMPO)) + '</p>' +
          '<p class="lg-regla">Solo a los campos reservados para ' + texto(ligaCompleta(p.ID_LIGA)) + ' esta temporada. Si eliges uno ocupado, los dos partidos se intercambian. Cada partido se lleva el árbitro de su campo y hora nuevos.</p>' +
          '<div id="lg-huecos"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div><div id="lg-conf" class="lg-conf"></div>' +
          botones('<button type="button" class="u-btn u-btn-accion" id="lg-guardar" disabled>Mover el partido</button><button type="button" class="u-btn" data-cerrar>Cancelar</button>'), function () {
          var hs = [];
          ctx.llamar('ligas_huecos_mover', [{ partido: p.ID }]).then(function (r) {
            hs = r || [];
            var caja = vent.querySelector('#lg-huecos');
            if (!caja) return;
            caja.innerHTML = hs.length ? '<div class="lg-huecos" role="radiogroup" aria-label="Hueco">' + hs.map(function (x, i) {
              var otro = x.otro && T.fila('PARTIDOS', x.otro), que = { actual: 'Ahora está aquí', libre: 'Libre', cambio: 'Se intercambia con ' + (otro ? titulo(otro) : 'otro partido'), ocupado: 'Ocupado' + (otro ? ': ' + titulo(otro) : ' por otra liga') }[x.estado];
              return '<button type="button" role="radio" aria-checked="false" data-h="' + i + '"' + (x.estado === 'actual' || x.estado === 'ocupado' ? ' disabled' : '') + ' class="lg-h lg-h-' + x.estado + '">' +
                '<b class="u-cifra">' + texto(x.hora) + '</b><span>' + texto(campoLargo(x.campo)) + '</span><small>' + texto(que) + '</small></button>';
            }).join('') + '</div>' : '<p class="u-vacio">Esta liga no tiene horarios para ese día: no se puede mover.</p>';
          }, function (e) { verError([limpio(e)]); });
          vent.onclick = function (e) {
            var b = e.target.closest('[data-h]');
            if (!b || b.disabled) return;
            [].forEach.call(vent.querySelectorAll('[data-h]'), function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
            var x = hs[Number(b.getAttribute('data-h'))], otro = x.otro && T.fila('PARTIDOS', x.otro);
            var cambios = [{ p: p, antes: foto(p), nuevo: { FECHA: p.FECHA, HORA: x.hora, ID_CAMPO: x.campo } }];
            if (otro) cambios.push({ p: otro, antes: foto(otro), nuevo: foto(p) });
            vent.querySelector('#lg-conf').innerHTML = htmlCambios(cambios);
            var g = vent.querySelector('#lg-guardar');
            g.disabled = false; g.textContent = otro ? 'Intercambiar los dos partidos' : 'Mover el partido';
            g.onclick = function () {
              var h = guardar('ligas_mover', { partido: p.ID, hueco: x.hueco }, { tabla: 'PARTIDOS', id: p.ID, cambios: { HORA: x.hora, ID_CAMPO: x.campo, ID_HUECO: x.hueco } });
              h.catch(nada);
              avisar(cambios, h, otro ? 'Partidos intercambiados.' : 'Partido movido.');
            };
          };
        });
      }
      /** Intercambiar la fecha de una jornada con otra de la liga (las que se pueden, de la vista JORNADAS). */
      function formJornadas(a) {
        var idL = M.actual.liga.ID, A = M.ix.jor[idL + '·' + a], ps = partidosLiga(idL);
        var otras = T.filas('JORNADAS').filter(function (j) { return j.ID_LIGA === idL && num(j.JORNADA) !== a; }).sort(function (x, y) { return num(x.JORNADA) - num(y.JORNADA); });
        var si = otras.filter(function (j) { return j.MOVIBLE; }), no = otras.filter(function (j) { return !j.MOVIBLE; }), porQue = {};
        no.forEach(function (j) { (porQue[j.MOTIVO] = porQue[j.MOTIVO] || []).push('J' + j.JORNADA); });
        var deJ = function (n) { return ps.filter(function (p) { return num(p.JORNADA) === n && FUERA.indexOf(p.ESTADO) < 0 && !p.ID_PARTIDO_ORIGEN; }); };
        ventana('<h2 id="lg-vt">Intercambiar la fecha de la jornada ' + a + '</h2><p class="u-nota">' + texto(ligaCompleta(idL) + ' · jornada ' + a + ': ' + fechaDia(A.FECHA) + ' · ' + fecha(A.FECHA)) + '</p>' +
          '<p class="lg-regla">Los partidos de las dos jornadas cambian de día y se quedan en su hora y su campo, con el árbitro que tiene ese campo a esa hora. Solo jornadas sin jugar, de hoy en adelante y en un solo día.</p>' +
          (si.length ? '<div class="lg-huecos" role="radiogroup" aria-label="Jornada">' + si.map(function (j) {
            return '<button type="button" role="radio" aria-checked="false" data-j="' + num(j.JORNADA) + '" class="lg-h"><b>J' + num(j.JORNADA) + '</b><span>' + texto(fechaDia(j.FECHA) + ' · ' + fecha(j.FECHA)) + '</span><small>' + texto(especial(j.FECHA)) + '</small></button>';
          }).join('') + '</div>' : '<p class="u-vacio">No hay ninguna otra jornada con la que se pueda intercambiar.</p>') +
          (no.length ? '<p class="u-nota">' + texto(Object.keys(porQue).map(function (k) { return porQue[k].join(', ') + ': ' + k; }).join('. ')) + '.</p>' : '') +
          '<div id="lg-conf" class="lg-conf"></div>' + botones('<button type="button" class="u-btn u-btn-accion" id="lg-guardar" disabled>Intercambiar las fechas</button><button type="button" class="u-btn" data-cerrar>Cancelar</button>'), function () {
          vent.onclick = function (e) {
            var b = e.target.closest('[data-j]');
            if (!b) return;
            [].forEach.call(vent.querySelectorAll('[data-j]'), function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
            var bj = Number(b.getAttribute('data-j')), B = M.ix.jor[idL + '·' + bj];
            var cambios = deJ(a).map(function (p) { return { p: p, antes: foto(p), nuevo: { FECHA: B.FECHA, HORA: p.HORA, ID_CAMPO: p.ID_CAMPO } }; })
              .concat(deJ(bj).map(function (p) { return { p: p, antes: foto(p), nuevo: { FECHA: A.FECHA, HORA: p.HORA, ID_CAMPO: p.ID_CAMPO } }; }));
            vent.querySelector('#lg-conf').innerHTML = '<p class="lg-regla"><b>J' + a + '</b> pasa al ' + texto(fechaDia(B.FECHA).toLowerCase()) + ' y <b>J' + bj + '</b> al ' + texto(fechaDia(A.FECHA).toLowerCase()) + '.</p>' + htmlCambios(cambios);
            var g = vent.querySelector('#lg-guardar');
            g.disabled = false;
            g.onclick = function () {
              var h = guardar('ligas_jornadas', { liga: idL, a: a, b: bj }, { tabla: 'PARTIDOS', id: cambios[0].p.ID, cambios: { FECHA: B.FECHA } });
              h.catch(nada);
              S.fecha = B.FECHA;
              avisar(cambios, h, 'Jornadas ' + a + ' y ' + bj + ' intercambiadas.');
            };
          };
        });
      }
      /**
       * Recuperar aplazados en huecos libres: se marcan los partidos, se elige un día (los que da la base, con por qué no se
       * puede) y, para cada uno, su hueco entre los libres (propuesto: el siguiente por hora). Es un partido nuevo; el aplazado se queda.
       */
      function formRecuperar(idL, elegidos) {
        var pend = partidosLiga(idL).filter(function (p) { return det(p).RECUPERAR; }).sort(function (a, b) { return num(a.JORNADA) - num(b.JORNADA) || orden(cuando(a), cuando(b)); });
        if (!pend.length) return;
        var marcados = {}, dias = [], dia = null, horas = {};
        pend.forEach(function (p) { marcados[p.ID] = elegidos ? elegidos.indexOf(p.ID) >= 0 : num(p.JORNADA) === num(pend[0].JORNADA); });
        var hasta = M.tempo && M.tempo.FECHA_FIN ? M.tempo.FECHA_FIN : sumarDias(hoy(), 180);
        ventana('<h2 id="lg-vt">Recuperar aplazados</h2><p class="u-nota">' + texto(ligaCompleta(idL)) + '</p>' +
          '<p class="lg-regla">Solo en los campos reservados para la liga esta temporada. Eliges el día y, para cada partido, su hora y su campo entre los libres. El aplazado se queda como estaba y la recuperación es un partido nuevo.</p>' +
          '<h3 class="lg-sub">1 · Qué partidos</h3><div class="lg-rec-ps">' + pend.map(function (p) {
            return '<label class="u-check"><input type="checkbox" data-rec="' + texto(p.ID) + '"' + (marcados[p.ID] ? ' checked' : '') + '><span class="lg-eqt"><span><b>' + texto(nomJornada(p, true) + ' · ' + titulo(p)) + '</b>' +
              '<small>' + texto('Era el ' + fechaDia(p.FECHA).toLowerCase() + ' · ' + p.HORA + ' · ' + campo(p.ID_CAMPO) + (p.MOTIVO ? ' · ' + p.MOTIVO : '')) + '</small></span></span></label>';
          }).join('') + '</div><h3 class="lg-sub">2 · Qué día</h3><div id="lg-rec-dias"></div><div id="lg-conf" class="lg-conf"></div>' +
          botones('<button type="button" class="u-btn u-btn-accion" id="lg-guardar" disabled>Recuperar</button><button type="button" class="u-btn" data-cerrar>Cancelar</button>'), function () {
          var sel = function () { return pend.filter(function (p) { return marcados[p.ID]; }); };
          var vez = 0;
          function pedirDias() {
            var caja = vent.querySelector('#lg-rec-dias'), ids = sel().map(function (p) { return p.ID; }), esta = ++vez;
            dia = null; horas = {}; confirmar();
            if (!ids.length) { caja.innerHTML = '<p class="u-vacio">Marca al menos un partido.</p>'; return; }
            caja.innerHTML = '<div class="kz-centro" role="status"><div class="u-carga"></div></div>';
            ctx.llamar('ligas_dias_recuperar', [{ partidos: ids, desde: hoy(), hasta: hasta, max: 9 }]).then(function (r) {
              if (esta !== vez || !vent.contains(caja)) return;
              dias = (r || []).slice().sort(function (a, b) { return (a.ok ? 0 : 1) - (b.ok ? 0 : 1) || (a.sin_partidos ? 0 : 1) - (b.sin_partidos ? 0 : 1) || orden(a.fecha, b.fecha); });
              caja.innerHTML = dias.length ? '<div class="lg-huecos" role="radiogroup" aria-label="Día">' + dias.map(function (x, i) {
                return '<button type="button" role="radio" aria-checked="false" data-dia="' + i + '"' + (x.ok ? '' : ' disabled') + ' class="lg-h' + (x.ok && x.sin_partidos ? ' lg-h-libre' : '') + '">' +
                  '<b>' + texto(fechaDia(x.fecha)) + '</b><span>' + texto(x.ok ? x.libres.length + (x.libres.length === 1 ? ' hueco libre' : ' huecos libres') : 'No se puede') + '</span>' +
                  '<small>' + texto(x.ok ? (x.sin_partidos ? 'La liga no juega: día para recuperar' : 'La liga ya juega ese día') : x.equipo ? equipo(x.equipo) + ' ya juega ese día' : x.motivo) + '</small></button>';
              }).join('') + '</div>' : '<p class="u-vacio">La liga no tiene horarios: no se puede recuperar aquí.</p>';
            }, function (e) { if (esta === vez) caja.innerHTML = '<p class="u-error">' + texto(limpio(e)) + '</p>'; });
          }
          function confirmar() {
            var g = vent.querySelector('#lg-guardar'), conf = vent.querySelector('#lg-conf'), ps = sel();
            if (!dia || !ps.length) { conf.innerHTML = ''; g.disabled = true; g.textContent = 'Recuperar'; return; }
            var hi = indice(dia.libres, 'hueco'), usados = {}, repetido = false;
            dia.propuesta.forEach(function (a) { if (!horas[a.partido]) horas[a.partido] = a.hueco; });
            ps.forEach(function (p) { if (usados[horas[p.ID]]) repetido = true; usados[horas[p.ID]] = 1; });
            var cambios = ps.map(function (p) { var h = hi[horas[p.ID]]; return { p: p, hueco: h.hueco, recupera: true, antes: foto(p), nuevo: { FECHA: dia.fecha, HORA: h.hora, ID_CAMPO: h.campo } }; });
            conf.innerHTML = '<h3 class="lg-sub">3 · A qué hora</h3><div class="lg-rec-horas">' + ps.map(function (p) {
              return '<label class="u-campo"><span class="u-etiqueta">' + texto(titulo(p) + ' · J' + p.JORNADA) + '</span><select data-hora="' + texto(p.ID) + '">' +
                opciones(dia.libres.map(function (h) { return [h.hueco, h.hora + ' · ' + campoLargo(h.campo)]; }), horas[p.ID]) + '</select></label>';
            }).join('') + '</div>' + (repetido ? '<p class="lg-pav lg-pav-ficha lg-av-no">Dos partidos no pueden ir al mismo hueco: cambia la hora de uno.</p>' : htmlCambios(cambios));
            g.disabled = repetido;
            g.textContent = 'Recuperar ' + (ps.length === 1 ? 'el partido' : 'los ' + ps.length + ' partidos') + ' el ' + fechaDia(dia.fecha).toLowerCase();
            g.onclick = function () {
              var h = guardar('ligas_recuperar', { fecha: dia.fecha, asignaciones: cambios.map(function (c) { return { partido: c.p.ID, hueco: c.hueco }; }) });
              avisar(cambios, h, cambios.length === 1 ? 'Partido recuperado.' : cambios.length + ' partidos recuperados.');
            };
          }
          vent.onchange = function (e) {
            var c = e.target;
            if (c.hasAttribute('data-hora')) { horas[c.getAttribute('data-hora')] = c.value; confirmar(); }
            else if (c.hasAttribute('data-rec')) { marcados[c.getAttribute('data-rec')] = c.checked; pedirDias(); }
          };
          vent.onclick = function (e) {
            var b = e.target.closest('[data-dia]');
            if (!b || b.disabled) return;
            [].forEach.call(vent.querySelectorAll('[data-dia]'), function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
            dia = dias[Number(b.getAttribute('data-dia'))]; horas = {}; confirmar();
          };
          pedirDias();
        });
      }
      /** Las sanciones que les faltan a los anulados de la liga, de una vez. */
      function apuntarSanciones() {
        var ids = partidosLiga(M.actual.liga.ID).filter(function (p) { return det(p).SIN_SANCION && det(p).GESTIONA; }).map(function (p) { return p.ID; });
        if (S.apuntando || !ids.length) return;
        S.apuntando = true; pintar();
        guardar('ligas_sanciones_faltan', { partidos: ids }).then(function (r) {
          if (ctx.abierta()) ctx.aviso(r.creadas === 1 ? 'Apuntada 1 sanción.' : 'Apuntadas ' + r.creadas + ' sanciones.');
        }, nada).then(function () { S.apuntando = false; if (ctx.abierta()) pintar(); });
      }

      /* ---------- filtros: la hoja de siempre ---------- */

      var ABIERTOS = {};
      function abrirVelo() { altaVelo.classList.add('abierto'); document.documentElement.classList.add('fv-abierta'); }
      function cerrarVelo() { altaVelo.classList.remove('abierto', 'en-hoja'); document.documentElement.classList.remove('fv-abierta'); altaForm.onsubmit = null; }
      altaVelo.addEventListener('click', function (ev) { if (ev.target === altaVelo || ev.target.closest('[data-cancelar-alta]')) cerrarVelo(); });
      altaVelo.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); cerrarVelo(); } });
      function pintarHoja() {
        preparar();
        var ligasHoja = M.lis.map(function (x) { return [x.liga.ID, nomComp(x.comp) + ' · ' + nomLiga(x.liga)]; });
        altaForm.innerHTML = '<div class="en-hoja-cab"><h2>Filtros</h2><button type="button" class="en-hoja-x" data-cancelar-alta aria-label="Cerrar" title="Cerrar">' + ICO_CERRAR + '</button></div>' +
          (M.temporadas.length > 1 ? grupoHoja({ k: 'temp', t: 'Temporada', vs: M.temporadas.map(function (t) { return [t.ID, t.NOMBRE]; }), sel: M.tempo ? M.tempo.ID : '' }) : '') +
          grupoHoja({ k: 'liga', t: 'Liga', vs: [['*', 'Todas (en Partidos)']].concat(ligasHoja), sel: F.liga === '*' ? '*' : M.actual ? M.actual.liga.ID : '', abierto: ABIERTOS.liga, buscar: 'Buscar liga' }) +
          (staff.yo ? grupoHoja({ k: 'mios', t: 'Partidos', vs: [['', 'Todos'], ['si', 'Solo los míos']], sel: F.mios ? 'si' : '' }) : '') +
          '<div class="botones"><button type="button" class="sec" data-quitar-filtros' + (F.temp || F.liga || F.mios ? '' : ' disabled') + '>Quitar filtros</button><button type="submit" class="pri">Ver</button></div>';
      }
      atenderHoja(altaForm, altaVelo, {
        abiertos: ABIERTOS, pintar: pintarHoja,
        elegir: function (k, v) {
          if (k === 'temp') { F.temp = v; F.liga = ''; } else if (k === 'liga') F.liga = v; else if (k === 'mios') F.mios = v === 'si';
          S.fecha = ''; guardarLocal(CLAVE + '_f', { temp: F.temp, liga: F.liga, mios: F.mios }); pintar();
        },
        quitar: function () { F.temp = ''; F.liga = ''; F.mios = false; S.fecha = ''; guardarLocal(CLAVE + '_f', {}); pintar(); }
      });
      $('lg-fil').onclick = function () {
        Object.keys(ABIERTOS).forEach(function (k) { delete ABIERTOS[k]; });
        pintarHoja();
        altaForm.onsubmit = function (ev) { ev.preventDefault(); cerrarVelo(); };
        altaVelo.classList.add('en-hoja'); abrirVelo();
        var b = altaForm.querySelector('.en-chip[aria-pressed=true]'); if (b) b.focus();
      };
      var tBusca = 0;
      $('lg-busca').addEventListener('input', function () {
        var v = this.value; clearTimeout(tBusca);
        tBusca = setTimeout(function () { F.busca = v.trim(); if (S.tab === 'GOLEADORAS') { var r = cont.querySelector('#lg-gol-res'); if (r) { r.innerHTML = htmlGolRes(); return; } } pintar(); }, 150);
      });

      /* ---------- eventos ---------- */

      el.addEventListener('click', function (e) {
        var t = e.target;
        if (t.closest('[data-cerrar]')) { cerrar(); return; }
        if (velo.contains(t) || altaVelo.contains(t)) return;
        var b = t.closest('[data-tab]'); if (b) { S.tab = b.getAttribute('data-tab'); guardarLocal(CLAVE + '_tab', S.tab); pintar(); window.scrollTo(0, 0); return; }
        b = t.closest('[data-fecha]'); if (b) { S.fecha = b.getAttribute('data-fecha'); pintar(); return; }
        b = t.closest('[data-dias]');
        if (b) { var tira = cont.querySelector('.lg-dias-tira'), una = tira && tira.firstElementChild; if (una) tira.scrollBy({ left: Number(b.getAttribute('data-dias')) * 3 * (una.offsetWidth + 8), behavior: 'smooth' }); return; }
        b = t.closest('[data-eqf]'); if (b) { fichaEquipo(b.getAttribute('data-eqf')); return; }
        b = t.closest('[data-jug]'); if (b) { fichaJugadora(b.getAttribute('data-jug')); return; }
        b = t.closest('[data-golamb]'); if (b) { S.golAmbito = b.getAttribute('data-golamb'); guardarLocal(CLAVE + '_gol', S.golAmbito); pintar(); return; }
        b = t.closest('[data-jornadas]'); if (b) { formJornadas(Number(b.getAttribute('data-jornadas'))); return; }
        b = t.closest('[data-accion="recuperar"]'); if (b) { formRecuperar(M.actual.liga.ID, null); return; }
        b = t.closest('[data-accion="sanciones"]'); if (b) { apuntarSanciones(); return; }
        b = t.closest('[data-accion="fasefinal"]'); if (b) { crearFaseFinal(b); return; }
        b = t.closest('[data-accion="ffquitar"]'); if (b) { quitarFaseFinal(b); return; }
        b = t.closest('[data-ir-actas]'); if (b) { F.liga = '*'; F.mios = true; S.fecha = b.getAttribute('data-ir-actas'); pintar(); return; }
        b = t.closest('[data-p]'); if (b) ficha(b.getAttribute('data-p'));
      });
      el.addEventListener('keydown', function (e) { if (e.key === 'Escape' && velo.classList.contains('abierto')) cerrar(); });
      velo.addEventListener('click', function (e) { if (e.target === velo) cerrar(); });
      // Lo que cambia mientras se ve: la lista, o la ficha abierta (si no hay un formulario a medias).
      ctx.alCambiar(function (t) {
        if (TABLAS.indexOf(t) < 0 && DETALLE.indexOf(t) < 0) return;
        if (!velo.classList.contains('abierto')) pintar();
        else if (/^[PE]:/.test(abierta)) { preparar(); (abierta.charAt(0) === 'P' ? ficha : fichaEquipo)(abierta.slice(2)); }
      });
      ctx.tablas.leer(TABLAS.concat(DETALLE)).then(function () {
        S.leido = true;
        var p = pedido && T.fila('PARTIDOS', pedido);
        if (p) { F.liga = p.ID_LIGA; S.tab = 'PARTIDOS'; S.fecha = String(p.FECHA || ''); }
        pintar();
        if (p) ficha(pedido); else if (pedido) ctx.aviso('Ese partido ya no está en Ligas.');
      }, function (e) {
        cont.innerHTML = '<p class="u-error">No se han podido leer las ligas.</p><p class="u-nota">' + texto(limpio(e)) + ' Vuelve a abrir la sección para probar otra vez.</p>';
      });
      // En directo: un partido, un gol o una sanción que cambia en otro sitio (el acta que cierra el árbitro…).
      var directo = null, tDirecto = null;
      if (ctx.enDirecto) directo = ctx.enDirecto(['partidos', 'goles', 'sanciones'], function () {
        if (tDirecto) return;
        tDirecto = setTimeout(function () { tDirecto = null; if (ctx.abierta()) T.refrescar(['PARTIDOS', 'GOLES', 'SANCIONES', 'CLASIFICACION', 'GOLEADORAS', 'LIGAS_RESUMEN'].concat(DETALLE), true).catch(nada); }, 800);
      });
      this._cerrar = function () {
        cerrar(true); cerrarVelo();
        el.classList.remove('kb', 'tb');
        if (directo) { directo.cerrar(); directo = null; }
        if (tDirecto) { clearTimeout(tDirecto); tDirecto = null; }
      };
    },
    cerrar: function () { if (this._cerrar) this._cerrar(); }
  });
})();
