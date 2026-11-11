/*
 * Konamigas · Ajustes › «Repartir los equipos y cerrar las ligas» (T0304) · acción del cliente en la sección Ajustes
 *
 * El paso 6 de «Preparar la temporada». Los equipos se apuntan a una competición diciendo los días que pueden y poco más;
 * Konamigas los reparte en sus ligas para llenar todas las plazas y, cuando quiere, cierra cada liga con los que tiene
 * (Javi, T0296):
 * - Un tablero por competición: arriba, los equipos sin liga con su disponibilidad, su horario preferido y su nivel; debajo,
 *   cada liga una columna con su día, su nivel y sus plazas (las ocupadas y las libres).
 * - Plazas: las que dan los horarios de la liga y los partidos por equipo de su competición (4 horarios y 16 partidos: 9
 *   equipos, dos vueltas, 18 jornadas). Avisa si la liga se queda en un número que no cuadra (8, 10…) o si no caben.
 * - Se reparte arrastrando un equipo desde su asa (en el móvil también) o con su «Mover a…». Avisa si el día de la liga no
 *   está en lo que puede el equipo. Lo guarda el motor (ligasMoverEquipo), que no toca una liga cerrada.
 * - Un equipo cuenta con la señal pagada entera (se confirma solo al apuntar el cobro en Economía, T0300; lo pagado lo da
 *   ligasSenales). «Cerrar la liga» solo con todos sus equipos confirmados; si no, dice a cuáles les falta (ligasCerrar).
 *   Cerrada, queda fija y ya se puede generar su calendario (la acción CALENDARIO); se vuelve a abrir solo sin partidos.
 * En solo lectura (SOLO_LEER de Ajustes) se ve, pero no se mueve ni se cierra nada.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var LETRA = { L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo' };
  var SIN_REPARTIR = ['Copa', 'Supercopa']; // sus equipos salen de otra competición (Clasificación): no se reparten aquí

  function s(v) { return String(v == null ? '' : v); }
  function sinTildes(x) { return s(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function entero(v) { var n = Number(v); return isFinite(n) && n > 0 && Math.floor(n) === n ? n : 0; }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
  function lista(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]; }
  function euros(n) { var x = Number(n) || 0; return (Math.round(x * 100) % 100 ? x.toFixed(2).replace('.', ',') : String(Math.round(x))) + ' €'; }
  /** «los jueves», «los sábados». */
  function losDias(d) { d = s(d).toLowerCase(); return d ? 'los ' + (/s$/.test(d) ? d : d + 's') : ''; }
  function fecha(f) { return /^\d{4}-\d\d-\d\d/.test(s(f)) ? s(f).slice(0, 10).split('-').reverse().join('/') : s(f); }

  /**
   * Los días que puede un equipo, de lo que escribió (INSCRIPCIONES_EQUIPOS · DISPONIBILIDAD): «Lunes o miércoles»,
   * «L (SCS), X (BET)», «jue», «cualquier día»… Devuelve los días (como en LIGAS · DIA_SEMANA) o null si no lo dice (vacío
   * o un texto sin días): entonces no se avisa de nada.
   */
  function diasDe(t) {
    t = s(t);
    if (!t.trim()) return null;
    var n = sinTildes(t);
    if (/cualquier|todos los dias|indiferente|nos da igual|da igual/.test(n)) return DIAS.slice();
    var out = [];
    [['lunes', 'lun'], ['martes', 'mar'], ['miercoles', 'mie'], ['jueves', 'jue'], ['viernes', 'vie'], ['sabado', 'sab'], ['domingo', 'dom']].forEach(function (p, i) {
      if (new RegExp('(^|[^a-z])(' + p[0] + '|' + p[1] + ')(?![a-z])').test(n)) out.push(DIAS[i]);
    });
    // Una letra suelta en mayúscula (L, M, X, J, V, S, D), como en las respuestas del formulario: «J (SCS)».
    var re = /(^|[^A-Za-zÀ-ÿ])([LMXJVSD])(?![A-Za-zÀ-ÿ])/g, m;
    while ((m = re.exec(t))) if (out.indexOf(LETRA[m[2]]) < 0) out.push(LETRA[m[2]]);
    return out.length ? DIAS.filter(function (d) { return out.indexOf(d) >= 0; }) : null;
  }
  /** Los días, cortos: «Lun, Mié»; todos, «Cualquier día»; '' si no se sabe. */
  function diasCortos(dias) { return !dias ? '' : dias.length === 7 ? 'Cualquier día' : dias.map(function (d) { return d.slice(0, 3); }).join(', '); }
  /** Los días, en palabras: «los lunes y miércoles»; todos, «cualquier día»; '' si no se sabe. */
  function diasLargos(dias) {
    if (!dias || !dias.length) return '';
    if (dias.length === 7) return 'cualquier día';
    return 'los ' + lista(dias.map(function (d, i) { d = d.toLowerCase(); return i === dias.length - 1 && !/s$/.test(d) ? d + 's' : d; }));
  }
  /** ¿Le va al equipo el día de la liga? true / false, o null si no se sabe (no dice días o la liga no tiene día). */
  function leVa(dias, dia) { return !dias || !dia ? null : dias.indexOf(dia) >= 0; }

  /**
   * ¿Se puede poner al equipo e en la liga l? Solo en una abierta y de un día que puede (Javi: al arrastrar, solo se
   * marcan en verde esas). Si el equipo no dice qué días puede, en cualquiera abierta.
   */
  function vale(e, l) { return !!l && !l.cerrada && leVa(e.dias, l.DIA_SEMANA) !== false; }
  /** Cuántos equipos caben con h horarios y p partidos por equipo, a una o dos vueltas (como Preparar la temporada). */
  function ideal(h, p) {
    h = entero(h); p = entero(p);
    if (!h || !p) return null;
    for (var v = 1; v <= 2; v++) { if (p % v) continue; var n = p / v + 1; if (Math.floor(n / 2) <= h) return { equipos: n, vueltas: v, jornadas: v * (n % 2 ? n : n - 1) }; }
    return null;
  }
  /**
   * ¿Cuadra una liga de n equipos con h horarios y p partidos por equipo? Cuadra si, todos contra todos a una o dos
   * vueltas, cada equipo juega justo p partidos y caben en sus horarios (como mucho h por jornada). null si no se sabe
   * (falta p) o con menos de dos equipos; si no, { ok, texto } con lo que pasa.
   */
  function cuadra(n, h, p) {
    p = entero(p); h = entero(h);
    if (!p || n < 2) return null;
    var porJ = Math.floor(n / 2);
    if (h && porJ > h) return { ok: false, texto: 'No caben: con ' + n + ' equipos se juegan ' + porJ + ' partidos cada jornada y hay ' + pl(h, 'horario', 'horarios') + '.' };
    for (var v = 1; v <= 2; v++) if ((n - 1) * v === p) return { ok: true, texto: '' };
    // En palabras de la socia (Javi): cuántos partidos le salen a cada equipo, cuántos se venden y cuántos equipos harían falta.
    var id = ideal(h, p), vu = id ? id.vueltas : 2;
    return { ok: false, texto: 'Con ' + n + ' equipos salen ' + pl((n - 1) * vu, 'partido', 'partidos') + ' por equipo y se venden ' + p + (id ? ': lo ideal son ' + id.equipos + ' equipos.' : '.') };
  }

  /** Las competiciones de la temporada cuyos equipos se reparten aquí: las que no van incluidas ni salen de otra, ni son copas. */
  function competiciones(d, tid) {
    var destino = {}; (d.origen || []).forEach(function (o) { destino[s(o.ID_COMPETICION)] = true; });
    return (d.comps || []).filter(function (c) { return s(c.ID_TEMPORADA) === s(tid) && c.INCLUIDA !== true && !destino[s(c.ID)] && SIN_REPARTIR.indexOf(s(c.TIPO)) < 0; })
      .sort(function (a, b) { return s(a.FECHA_INICIO).localeCompare(s(b.FECHA_INICIO)) || s(a.NOMBRE).localeCompare(s(b.NOMBRE), 'es'); });
  }

  /**
   * El nivel con el que se reparte un equipo (Javi): el de su liga del año pasado (LIGAS · NIVEL, más es mejor), uno más si
   * la ganó y uno menos si quedó la última (con más de dos equipos); si no jugó o su liga no tenía nivel, el que declara
   * (INSCRIPCIONES_EQUIPOS · NIVEL). { valor (1 a 5, o null), txt (de dónde sale) }. h: lo de ligasHistorial para ese equipo.
   */
  function fuerza(nivelDeclarado, h) {
    var lim = function (n) { return Math.max(1, Math.min(5, n)); };
    var d = entero(nivelDeclarado);
    if (h && h.nivel) {
      var sube = h.puesto === 1 && h.equipos > 2 ? 1 : h.puesto && h.puesto === h.equipos && h.equipos > 2 ? -1 : 0, v = lim(h.nivel + sube), en = h.liga + ' (' + h.temporada + ')';
      return { valor: v, txt: sube > 0 ? 'Ganó ' + en + ': sube a nivel ' + v : sube < 0 ? 'Quedó último en ' + en + ': baja a nivel ' + v :
        (h.puesto ? 'Quedó ' + h.puesto + '.º en ' + en : 'Jugó ' + en) + ': nivel ' + v };
    }
    return { valor: d ? lim(d) : null, txt: h ? 'Jugó ' + h.liga + ' (' + h.temporada + '), que no tiene nivel: cuenta el que dice' + (d ? ' (' + d + ')' : ', y no dice ninguno') :
      d ? 'Equipo nuevo: dice nivel ' + d : 'No dice su nivel' };
  }
  /**
   * Cómo está una inscripción para repartirla: { ID, nombre, estado, conf, nivel, dispo, pref, comentarios, dias, senal
   * (lo que cuesta, o 0), pagado (null si no se sabe), senalTxt, mano (confirmada sin pagar la señal entera) }.
   * sen: lo de ligasSenales ({ IE: { senal, pagado } }) o null.
   */
  function equipo(i, sen, hist) {
    var x = sen && sen[s(i.ID)], conf = i.ESTADO === 'Confirmada';
    var senal = x ? Number(x.senal) || 0 : 0, pagado = x ? Number(x.pagado) || 0 : null;
    var mano = conf && x && senal > 0 && pagado < senal;
    var txt = conf ? (mano ? 'Confirmado a mano, sin pagar toda la señal' + (pagado > 0 ? ' (' + euros(pagado) + ' de ' + euros(senal) + ')' : '') : 'Señal pagada')
      : x && senal > 0 ? (pagado >= senal ? 'Señal pagada, por confirmar en Gestión' : pagado > 0 ? 'Señal: ' + euros(pagado) + ' de ' + euros(senal) : 'Falta la señal (' + euros(senal) + ')') : 'Por confirmar';
    // Lo corto, en la tarjeta: nada si todo está bien (el borde verde ya lo dice); si no, lo que falta.
    var corto = conf ? '' : x && senal > 0 ? (pagado >= senal ? 'Pagada, sin confirmar' : pagado > 0 ? euros(pagado) + ' de ' + euros(senal) : 'Falta la señal') : 'Por confirmar';
    var fz = fuerza(i.NIVEL, hist && hist[s(i.ID)]), dias = diasDe(i.DISPONIBILIDAD);
    return { ID: s(i.ID), nombre: s(i.NOMBRE_EQUIPO || i.ID), estado: s(i.ESTADO), conf: conf, nivel: s(i.NIVEL), fuerza: fz.valor, fuerzaTxt: fz.txt, dispo: s(i.DISPONIBILIDAD), pref: s(i.PREFERENCIA_HORARIA),
      comentarios: s(i.COMENTARIOS), dias: dias, puedeTxt: dias ? 'Puede ' + diasLargos(dias) : 'No dice qué días puede', senal: senal, pagado: pagado, senalTxt: txt, corto: corto, mano: !!mano, fecha: s(i.FECHA_INSCRIPCION) };
  }
  function porAlta(a, b) { return (b.conf - a.conf) || a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre, 'es'); }

  /**
   * El tablero de una competición: { comp, avisoComp (lo que falta en la competición), porDia ([{ dia, ligas, equipos, libres }]), sinLiga: [equipo + { ligasQueLeVan }], ligas: [{ ID, NOMBRE, DIA_SEMANA, NIVEL,
   * cerrada, FECHA_CIERRE, horarios, ideal, plazas, ocupadas, libres, equipos: [equipo + { leVa }], cuadra, avisos, faltan
   * (los que no están confirmados), puedeCerrar, porQueNo, partidos }], todasCerradas }.
   * d: { comps, ligas, huecos, ins, origen }; partidos: { ID_LIGA: n } o null.
   */
  function tablero(d, idComp, sen, partidos, hist) {
    var comp = (d.comps || []).filter(function (c) { return s(c.ID) === s(idComp); })[0];
    if (!comp) return null;
    var ins = (d.ins || []).filter(function (i) { return s(i.ID_COMPETICION) === s(comp.ID) && i.ESTADO !== 'Baja' && i.ORIGEN !== 'Clasificación'; });
    // Por día de la semana y, dentro de cada día, de más a menos nivel (ORO primero; las de sin nivel, al final).
    var dn = function (l) { var i = DIAS.indexOf(l.DIA_SEMANA); return i < 0 ? 99 : i; }, nv = function (l) { return entero(l.NIVEL) || 0; };
    var ligas = (d.ligas || []).filter(function (l) { return s(l.ID_COMPETICION) === s(comp.ID); })
      .sort(function (a, b) { return dn(a) - dn(b) || nv(b) - nv(a) || s(a.NOMBRE).localeCompare(s(b.NOMBRE), 'es', { numeric: true }); });
    var ids = ligas.map(function (l) { return s(l.ID); });
    var out = ligas.map(function (l) {
      var hs = (d.huecos || []).filter(function (h) { return s(h.ID_LIGA) === s(l.ID) && (!h.DIA_SEMANA || !l.DIA_SEMANA || h.DIA_SEMANA === l.DIA_SEMANA); }).length;
      var id = ideal(hs, comp.PARTIDOS_EQUIPO), cerrada = !!s(l.FECHA_CIERRE).trim();
      var eqs = ins.filter(function (i) { return s(i.ID_LIGA) === s(l.ID); }).map(function (i) { var e = equipo(i, sen, hist); e.leVa = leVa(e.dias, s(l.DIA_SEMANA)); return e; })
        .sort(function (a, c) { return (c.fuerza || 0) - (a.fuerza || 0) || porAlta(a, c); }); // de más a menos nivel
      var n = eqs.length, cu = cuadra(n, hs, comp.PARTIDOS_EQUIPO), avisos = [];
      if (!hs) avisos.push('Sin horarios: añádelos en «Campos y horarios» para saber cuántos equipos caben.');
      if (cu && !cu.ok) avisos.push(cu.texto);
      var noVa = eqs.filter(function (e) { return e.leVa === false; });
      if (noVa.length) avisos.push((noVa.length === 1 ? noVa[0].nombre + ' no dice que pueda ' : lista(noVa.map(function (e) { return e.nombre; })) + ' no dicen que puedan ') + losDias(l.DIA_SEMANA) + '.');
      var faltan = eqs.filter(function (e) { return !e.conf; });
      var np = partidos ? partidos[s(l.ID)] || 0 : null;
      var porQueNo = cerrada ? '' : faltan.length ? 'Para cerrarla falta la señal de ' + lista(faltan.map(function (e) { return e.nombre; })) + '.' :
        n < 2 ? 'Para cerrarla hacen falta al menos dos equipos.' : '';
      return { ID: s(l.ID), NOMBRE: s(l.NOMBRE || l.ID), DIA_SEMANA: s(l.DIA_SEMANA), NIVEL: s(l.NIVEL), cerrada: cerrada, FECHA_CIERRE: s(l.FECHA_CIERRE), horarios: hs,
        ideal: id, plazas: id ? id.equipos : null, ocupadas: n, libres: id ? id.equipos - n : null, equipos: eqs, cuadra: cu, avisos: avisos, faltan: faltan,
        puedeCerrar: !cerrada && !porQueNo, porQueNo: porQueNo, partidos: np };
    });
    var sinLiga = ins.filter(function (i) { return !i.ID_LIGA || ids.indexOf(s(i.ID_LIGA)) < 0; }).map(function (i) {
      var e = equipo(i, sen, hist);
      e.ligasQueLeVan = e.dias ? out.filter(function (l) { return !l.cerrada && leVa(e.dias, l.DIA_SEMANA); }).map(function (l) { return l.NOMBRE; }) : null;
      return e;
    }).sort(porAlta);
    // Lo que es de toda la competición se dice una vez, arriba, y no en cada liga.
    var avisoComp = out.length && !entero(comp.PARTIDOS_EQUIPO) ? 'La competición no dice cuántos partidos juega cada equipo: sin eso no se saben las plazas de sus ligas.' : '';
    // Las ligas agrupadas por día (Javi: mejor organizado por días): [{ dia, ligas, equipos, libres (null si no se sabe), abiertas, candidatos, sinSitio }].
    var porDia = [];
    out.forEach(function (l) {
      var g = porDia[porDia.length - 1], dia = l.DIA_SEMANA || '';
      if (!g || g.dia !== dia) porDia.push(g = { dia: dia, ligas: [], equipos: 0, libres: null });
      g.ligas.push(l); g.equipos += l.ocupadas;
      // Las plazas libres del día: las que se saben de sus ligas abiertas (null si no se sabe ninguna).
      if (!l.cerrada && l.libres !== null) g.libres = (g.libres || 0) + Math.max(0, l.libres);
    });
    // T0304 (Javi: rellenar día a día): los sin liga que pueden ir a alguna liga abierta de cada día (también los que no dicen días).
    porDia.forEach(function (g) {
      g.abiertas = g.ligas.filter(function (l) { return !l.cerrada; }).length;
      g.candidatos = sinLiga.filter(function (e) { return g.ligas.some(function (l) { return vale(e, l); }); }).length;
      // Que nadie se esconda (Javi): los que dicen que pueden ese día pero no tienen ninguna liga abierta que les vaya.
      g.sinSitio = sinLiga.filter(function (e) { return leVa(e.dias, g.dia) === true && !g.ligas.some(function (l) { return vale(e, l); }); }).length;
    });
    // El día por el que empezar: el primero con liga abierta, plazas libres y equipos que pueden; si no, el primero con liga abierta.
    var empezar = (porDia.filter(function (g) { return g.abiertas && g.candidatos && g.libres !== 0; })[0] || porDia.filter(function (g) { return g.abiertas; })[0] || porDia[0] || {}).dia;
    return { comp: { ID: s(comp.ID), nombre: s(comp.NOMBRE_COMERCIAL || comp.NOMBRE || comp.ID), PARTIDOS_EQUIPO: entero(comp.PARTIDOS_EQUIPO) }, sinLiga: sinLiga, ligas: out, porDia: porDia, empezar: empezar === undefined ? null : empezar, avisoComp: avisoComp,
      todasCerradas: out.length > 0 && out.every(function (l) { return l.cerrada; }) };
  }

  /**
   * La propuesta de reparto de un día (Javi): con todos los equipos que no están en una liga cerrada, se rehace el reparto
   * de ese día. Entran los sin liga que pueden ese día y los que ya están en sus ligas abiertas (si les van); las cerradas no
   * se tocan. De más a menos nivel (un equipo colocado sin nivel cuenta con el de su liga, para no moverlo sin motivo; los que
   * no tienen ninguno, al final), cada uno a la liga abierta de más nivel que le va y tiene plaza. Las ligas sin plazas
   * sabidas no se llenan. { asignar: [{ ID, liga, antes }] (solo los que cambian), final: { liga: [ID] }, sinSitio: [{ ID,
   * antes }] (los que no caben: si tenían liga, salen a sin liga) }.
   */
  function proponer(b, dia) {
    var vacio = { asignar: [], final: {}, sinSitio: [] };
    var g = (b.porDia || []).filter(function (x) { return x.dia === dia; })[0];
    if (!g) return vacio;
    var ligas = g.ligas.filter(function (l) { return !l.cerrada && l.plazas !== null; })
      .sort(function (a, c) { return (entero(c.NIVEL) || 0) - (entero(a.NIVEL) || 0); });
    if (!ligas.length) return vacio;
    var sitio = {}, final = {}; ligas.forEach(function (l) { sitio[l.ID] = l.plazas; final[l.ID] = []; });
    var cand = [];
    b.sinLiga.forEach(function (e) { if (ligas.some(function (l) { return vale(e, l); })) cand.push({ e: e, antes: '', f: e.fuerza || 0 }); });
    ligas.forEach(function (l) {
      l.equipos.forEach(function (e) { if (vale(e, l)) cand.push({ e: e, antes: l.ID, f: e.fuerza || entero(l.NIVEL) || 0 }); else sitio[l.ID]--; }); // el que no le va, se queda
    });
    cand.sort(function (a, c) { return c.f - a.f || (a.antes ? 0 : 1) - (c.antes ? 0 : 1) || porAlta(a.e, c.e); }); // a igual nivel, primero los que ya estaban
    var out = { asignar: [], final: final, sinSitio: [] };
    cand.forEach(function (x) {
      var l = ligas.filter(function (y) { return sitio[y.ID] > 0 && vale(x.e, y); })[0];
      if (!l) { out.sinSitio.push({ ID: x.e.ID, antes: x.antes }); if (x.antes) out.asignar.push({ ID: x.e.ID, liga: '', antes: x.antes }); return; }
      sitio[l.ID]--; final[l.ID].push(x.e.ID);
      if (l.ID !== x.antes) out.asignar.push({ ID: x.e.ID, liga: l.ID, antes: x.antes });
    });
    return out;
  }

  /**
   * ¿Avisar de que el equipo e no encaja por nivel en su liga l? Solo si está a dos niveles o más y, ese mismo día, hay otra
   * liga cuyo nivel le queda más cerca (Javi: si el jueves solo hay ORO, van todos a ORO y no hay nada que avisar). ligas: las
   * de la competición. Devuelve el nivel de la liga que le iría mejor, o 0.
   */
  function mejorOtra(e, l, ligas) {
    var nl = entero(l && l.NIVEL), f = e && e.fuerza;
    if (!nl || !f || Math.abs(f - nl) < 2) return 0;
    var otras = (ligas || []).filter(function (x) { return x.ID !== l.ID && x.DIA_SEMANA === l.DIA_SEMANA && entero(x.NIVEL) && Math.abs(f - entero(x.NIVEL)) < Math.abs(f - nl); });
    return otras.length ? entero(otras.sort(function (a, b) { return Math.abs(f - entero(a.NIVEL)) - Math.abs(f - entero(b.NIVEL)); })[0].NIVEL) : 0;
  }

  /**
   * Lo que falta para poder proponer el reparto de un día: { plazas (ninguna liga abierta del día sabe cuántos caben: faltan
   * los partidos por equipo o los horarios), sinNivel: [ligas abiertas sin nivel, si hay más de una abierta] }. Sin plazas no
   * se propone; sin nivel sí, pero no sabe cuál es la de arriba.
   */
  function faltaParaProponer(b, dia) {
    var g = (b.porDia || []).filter(function (x) { return x.dia === dia; })[0], ab = g ? g.ligas.filter(function (l) { return !l.cerrada; }) : [];
    return { plazas: !ab.some(function (l) { return l.libres !== null; }), sinNivel: ab.length > 1 ? ab.filter(function (l) { return !entero(l.NIVEL); }) : [] };
  }

  /**
   * T0367 · Lo que se pregunta antes de cerrar o volver a abrir una liga: una pregunta con lo que pasará, no algo que ya ha
   * pasado (en la demo, «Cerrada, sus equipos quedan fijos…» parecía hecho). que: 'cerrar' o 'abrir'; l: la liga del tablero.
   * { pregunta, aviso (lo que no cuadra, o ''), si (el botón que lo hace) }.
   */
  function confirmar(que, l) {
    if (que === 'abrir') return { pregunta: '¿Volver a abrir ' + s(l.NOMBRE) + '? Se podrán mover otra vez sus equipos.', aviso: '', si: 'Sí, volver a abrirla' };
    return { pregunta: '¿Cerrar ' + s(l.NOMBRE) + ' con ' + pl(l.ocupadas, 'equipo', 'equipos') + '? Al cerrarla, sus equipos quedarán fijos y ya se podrá generar su calendario.',
      aviso: l.cuadra && !l.cuadra.ok ? s(l.cuadra.texto) : '', si: 'Sí, cerrarla' };
  }

  var CALC = { confirmar: confirmar, diasLargos: diasLargos, faltaParaProponer: faltaParaProponer, mejorOtra: mejorOtra, fuerza: fuerza, proponer: proponer, vale: vale, losDias: losDias, diasCortos: diasCortos, diasDe: diasDe, leVa: leVa, ideal: ideal, cuadra: cuadra, competiciones: competiciones, equipo: equipo, tablero: tablero };
  if (typeof window === 'undefined' || !window.UN || !window.UN.ajustes) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  function texto(v) { return s(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sinPrefijo(e) { return s((e && e.message) || e).replace(/^\w+:\s*/, ''); }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem('kon_rep_' + k) || ''; localStorage.setItem('kon_rep_' + k, v); } catch (e) {} return ''; }
  var TABLAS = ['TEMPORADAS', 'COMPETICIONES', 'COMPETICIONES_ORIGEN', 'LIGAS', 'HUECOS', 'INSCRIPCIONES_EQUIPOS'];
  var fin = null;

  window.UN.ajustes('REPARTIR', {
    abrir: function (el, ctx) {
      var dia = null; // el día que se está llenando ('*': todos); se recuerda por competición
      var hist = {}, pidiendoHist = {}, prop = null, aplicando = false; // lo del año pasado; la propuesta del día
      // Un solo aviso para todo lo que se hace aquí, abajo, con «Deshacer» si se puede (Claude en Chrome, T0304): { texto, deshacer: [[ID, liga]], t }.
      var aviso = null, avisoT = null;
      function avisar(t, deshacer) {
        aviso = { texto: t, deshacer: deshacer || null };
        if (avisoT) clearTimeout(avisoT);
        avisoT = setTimeout(function () { aviso = null; if (vivo) pintar(); }, deshacer ? 10000 : 6000);
        if (vivo) pintar();
      }
      /** El elemento que hace scroll (el de Ajustes o la página), para no saltar al repintar ni al arrastrar cerca del borde. */
      function scrollPadre() {
        for (var x = el.parentElement; x && x !== document.body; x = x.parentElement) {
          var o = getComputedStyle(x).overflowY;
          if ((o === 'auto' || o === 'scroll') && x.scrollHeight > x.clientHeight) return x;
        }
        return document.scrollingElement || document.documentElement;
      }
      var A = ctx.ajustes, T = ctx.tablas, vivo = true, tid = '', comp = guardado('comp'), sen = {}, pidiendoSen = {}, partidos, moviendo = {}, cerrando = '', pide = '', arr = null, foco = '', abiertaEq = '';
      fin = function () { vivo = false; if (avisoT) clearTimeout(avisoT); soltar(true); };
      el.innerHTML = '<div class="kz-centro" role="status"><div class="u-carga"></div></div>';

      function datos() { return { comps: T.filas('COMPETICIONES') || [], origen: T.filas('COMPETICIONES_ORIGEN') || [], ligas: T.filas('LIGAS') || [], huecos: T.filas('HUECOS') || [], ins: T.filas('INSCRIPCIONES_EQUIPOS') || [] }; }
      /** Lo pagado de cada equipo lo da el motor (ECONOMIA no está en Ajustes). Una vez por temporada. */
      function mirarSenales(t) {
        if (!t || sen[t] !== undefined || pidiendoSen[t]) return;
        pidiendoSen[t] = true;
        ctx.llamar('ligasSenales', [t]).then(function (r) {
          sen[t] = (r && r.senales) || {}; pidiendoSen[t] = false;
          // Las que ya la han pagado entera se acaban de confirmar (como al abrir Gestión): se vuelven a leer.
          if (r && (r.confirmadas || []).length) T.refrescar(['INSCRIPCIONES_EQUIPOS'], true).then(function () { if (vivo) pintar(); }, function () {});
          if (vivo) pintar();
        },
          function () { sen[t] = null; pidiendoSen[t] = false; if (vivo) pintar(); });
      }
      /** Lo del año pasado de cada equipo (su liga, su nivel y su puesto), para el nivel con el que se reparte. Una vez por temporada. */
      function mirarHistorial(t) {
        if (!t || hist[t] !== undefined || pidiendoHist[t]) return;
        pidiendoHist[t] = true;
        ctx.llamar('ligasHistorial', [t]).then(function (r) { hist[t] = r || {}; pidiendoHist[t] = false; if (vivo) pintar(); },
          function () { hist[t] = null; pidiendoHist[t] = false; if (vivo) pintar(); });
      }
      /** Los partidos de cada liga (para saber si se puede volver a abrir y si ya tiene calendario). */
      function mirarPartidos() {
        ctx.llamar('ligasCalendarioLigas', []).then(function (r) {
          var o = {};
          ((r && r.temporadas) || []).forEach(function (t) { t.competiciones.forEach(function (c) { c.ligas.forEach(function (l) { o[l.ID] = l.partidos; }); }); });
          partidos = o; if (vivo) pintar();
        }, function () { partidos = null; if (vivo) pintar(); });
      }

      /**
       * Una tarjeta, corta (Javi: sin ruido): el nombre, el nivel, los días y solo lo que falta (la señal, el día que no le va).
       * Al tocarla se abre lo demás (lo que escribió, lo que prefiere, sus comentarios) y a dónde moverla.
       */
      function tarjeta(e, l) {
        // A dónde puede ir: las otras ligas abiertas y, si tiene liga, sin liga. Sin ningún sitio (todas cerradas), sin asa ni botones.
        var abiertas = B.ligas.filter(function (x) { return !x.cerrada && (!l || x.ID !== l.ID); });
        var destinos = abiertas.filter(function (x) { return vale(e, x); }), otrosDias = abiertas.length - destinos.length;
        var puedeMover = !ctx.soloLeer && !(l && l.cerrada) && !moviendo[e.ID] && (!!l || destinos.length > 0);
        var abierta = abiertaEq === e.ID, noVa = l && e.leVa === false;
        var linea = diasCortos(e.dias), sinSitio = !l && !destinos.length && !ctx.soloLeer;
        // Un equipo de nivel lejos del de su liga, si ese día hay otra que le iría mejor: se avisa.
        var nl = l ? entero(l.NIVEL) : 0, lejos = l ? mejorOtra(e, l, B.ligas) : 0;
        var marcas = (e.corto ? '<span class="rp-marca">' + texto(e.corto) + '</span>' : '') + (sinSitio ? '<span class="rp-marca">Sin sitio: sus ligas están cerradas o llenas</span>' : '') + (noVa ? '<span class="rp-marca">' + texto('No dice ' + losDias(l.DIA_SEMANA)) + '</span>' : '') +
          (lejos ? '<span class="rp-marca">' + texto('Nivel ' + e.fuerza + ' en una liga de nivel ' + nl + ': hay una de nivel ' + lejos + ' ese día') + '</span>' : '');
        var chip = '<span class="rp-fz' + (e.fuerza ? ' rp-f' + e.fuerza : '') + '" title="' + texto(e.fuerzaTxt) + '">' + (e.fuerza || '?') + '<span class="u-oculto"> de nivel</span></span>';
        var det = '';
        if (abierta) {
          // Lo que escribió, una vez (a veces la preferencia y el comentario son el mismo texto) y recortado; entero, al pasar por encima.
          var pref = e.pref && e.pref !== e.comentarios ? 'Prefiere: ' + e.pref : '';
          // En palabras de la socia: los días que puede; lo que escribió en el formulario, aparte y en pequeño.
          var datos = [e.fuerzaTxt, e.senalTxt, e.puedeTxt + (e.dispo ? ' (en el formulario: «' + e.dispo + '»)' : ''), pref, e.comentarios ? '«' + e.comentarios + '»' : ''].filter(String);
          det = '<div class="rp-det">' + datos.map(function (t) { return '<small class="rp-corta" title="' + texto(t) + '">' + texto(t) + '</small>'; }).join('') +
            (puedeMover ? '<div class="rp-a"><span class="rp-a-t">Mover a</span>' + (l ? '<button type="button" class="aj-as-chipe" data-rp-a="' + texto(e.ID) + '|">Sin liga</button>' : '') +
              destinos.map(function (x) {
                return '<button type="button" class="aj-as-chipe" data-rp-a="' + texto(e.ID + '|' + x.ID) + '">' + texto(x.NOMBRE + (x.libres !== null ? ' (' + (x.libres > 0 ? x.libres : 'llena') + ')' : '')) + '</button>';
              }).join('') + (otrosDias ? '<small>' + texto(otrosDias === 1 ? 'La otra liga abierta es de un día que no puede.' : 'Las otras ' + otrosDias + ' ligas abiertas son de días que no puede.') + '</small>' : '') + '</div>'
              : !l && !abiertas.length ? '<small class="rp-aviso">Todas las ligas están cerradas: no se puede repartir.</small>'
              : !l ? '<small class="rp-aviso">Ninguna liga abierta es de un día que puede.</small>' : '') + '</div>';
        }
        return '<li class="rp-eq' + (e.conf ? '' : ' rp-sol') + (noVa ? ' rp-novade' : '') + (abierta ? ' rp-abierta' : '') + (moviendo[e.ID] ? ' rp-guardando' : '') + '" data-rp-eq="' + texto(e.ID) + '">' +
          (puedeMover ? '<button type="button" class="rp-asa" data-rp-asa="' + texto(e.ID) + '" aria-label="' + texto('Mover a ' + e.nombre + ': arrástralo, o pulsa Intro para ver a dónde') + '"><span aria-hidden="true">⠿</span></button>' : '') +
          '<div class="rp-eqc"><button type="button" class="rp-eqb" data-rp-ver="' + texto(e.ID) + '" aria-expanded="' + abierta + '">' + chip + '<b>' + texto(e.nombre) + '</b>' +
          (linea ? '<small>' + texto(linea) + '</small>' : '') + '</button>' + (marcas ? '<span class="rp-marcas">' + marcas + '</span>' : '') + det + '</div></li>';
      }
      function columna(l) {
        var pz = '<span class="rp-plazas' + (l.libres !== null && l.libres < 0 ? ' rp-mal' : '') + '" title="' + texto(l.plazas !== null ? l.ocupadas + ' equipos de ' + l.plazas + ' que caben' : pl(l.ocupadas, 'equipo', 'equipos') + ': no se sabe cuántos caben') + '">' +
          '<b class="u-cifra">' + l.ocupadas + '</b> / ' + (l.plazas !== null ? l.plazas : '?') + '</span>';
        var pie = '';
        if (l.cerrada) {
          pie = '<p class="rp-cerrada">' + texto('Cerrada el ' + fecha(l.FECHA_CIERRE)) + (l.partidos ? texto(' · ' + pl(l.partidos, 'partido', 'partidos')) : '') + '</p>' +
            (!l.partidos && l.partidos !== null ? '<div class="rp-botones">' + (l.ocupadas >= 2 ? '<button type="button" class="u-btn u-btn-accion" data-rp-cal="' + texto(l.ID) + '">Generar calendario ›</button>' : '') +
              (ctx.soloLeer ? '' : pide === 'abrir|' + l.ID ? '<p class="u-nota">' + texto(confirmar('abrir', l).pregunta) + '</p><button type="button" class="u-btn u-btn-texto" data-rp-no>No</button><button type="button" class="u-btn" data-rp-abrir="' + texto(l.ID) + '">' + texto(confirmar('abrir', l).si) + '</button>'
                : '<button type="button" class="u-btn u-btn-texto" data-rp-pide="abrir|' + texto(l.ID) + '">Volver a abrirla</button>') + '</div>' : '');
        } else if (!ctx.soloLeer && l.ocupadas) { // vacía: nada que cerrar (solo «Arrastra aquí sus equipos»)
          pie = (l.porQueNo ? '<p class="u-nota rp-falta">' + texto(l.porQueNo) + '</p>' : '') + '<div class="rp-botones">' +
            (pide === 'cerrar|' + l.ID ? (function (q) {
              return '<p class="u-nota">' + (q.aviso ? '<b>' + texto(q.aviso) + '</b> ' : '') + texto(q.pregunta) + '</p>' +
                '<button type="button" class="u-btn u-btn-texto" data-rp-no>No</button><button type="button" class="u-btn u-btn-accion" data-rp-cerrar="' + texto(l.ID) + '"' + (cerrando ? ' disabled' : '') + '>' + (cerrando === l.ID ? 'Cerrando…' : texto(q.si)) + '</button>';
            })(confirmar('cerrar', l))
              : '<button type="button" class="u-btn" data-rp-pide="cerrar|' + texto(l.ID) + '"' + (l.puedeCerrar ? '' : ' disabled') + '>Cerrar la liga</button>') + '</div>';
        }
        var n = entero(l.NIVEL);
        return '<section class="rp-liga' + (l.cerrada ? ' rp-liga-cerrada' : '') + (n ? ' rp-n' + Math.min(n, 5) : '') + '" data-rp-zona="' + texto(l.ID) + '"' + (l.cerrada ? ' data-rp-fija' : '') + ' aria-label="' + texto('Liga ' + l.NOMBRE) + '">' +
          '<header><div>' + (n || ctx.soloLeer ? '<span class="rp-nivel">' + texto(n ? 'Nivel ' + n : 'Sin nivel') + '</span>' :
            '<button type="button" class="rp-nivel rp-nivel-falta" data-rp-liga-ficha="' + texto(l.ID) + '" title="Poner el nivel de la liga">Sin nivel ›</button>') + '<h3>' + (l.cerrada ? '🔒 ' : '') + texto(l.NOMBRE) + '</h3><small>' + texto(pl(l.horarios, 'horario', 'horarios')) + '</small></div>' + pz + '</header>' +
          (l.avisos.length && !l.cerrada ? '<ul class="rp-avisos">' + l.avisos.map(function (a) { return '<li>' + texto(a) + '</li>'; }).join('') + '</ul>' : '') +
          '<ul class="rp-eqs">' + (l.equipos.length ? l.equipos.map(function (e) { return tarjeta(e, l); }).join('') : '<li class="rp-vacia">' + (l.cerrada ? 'Sin equipos' : ctx.soloLeer ? 'Sin equipos todavía' : 'Arrastra aquí sus equipos') + '</li>') + '</ul>' + pie + '</section>';
      }

      /** La propuesta del día, para revisarla antes de aplicarla: cada liga con los que irían, y los que no caben. */
      function panelPropuesta() {
        var g = B.porDia.filter(function (x) { return x.dia === prop.dia; })[0] || { ligas: [] };
        var nom = function (id) { var e = eqDe(id); return e ? e.nombre + (e.fuerza ? ' (' + e.fuerza + ')' : '') + (e.conf ? '' : ' · sin señal') : id; };
        var nomL = function (id) { var l = ligaDe(id); return l ? l.NOMBRE : id; };
        var cambio = {}; prop.asignar.forEach(function (a) { cambio[a.ID] = a; });
        var ligas = g.ligas.filter(function (l) { return prop.final[l.ID]; }).sort(function (a, c) { return (entero(c.NIVEL) || 0) - (entero(a.NIVEL) || 0); });
        var salen = prop.asignar.filter(function (a) { return !a.liga; });
        return '<div class="rp-prop"><p class="rp-prop-t">' + texto('Así quedaría el ' + prop.dia.toLowerCase()) + ' <small>(con todos los que no están en una liga cerrada, de más a menos nivel)</small></p>' +
          (prop.asignar.length ? '' : '<p class="u-nota">Ya está como lo propondría: no hay nada que cambiar.</p>') +
          '<ul>' + ligas.map(function (l) {
            var ids = prop.final[l.ID], nuevos = ids.filter(function (id) { return cambio[id]; });
            return '<li><b>' + texto(l.NOMBRE) + '</b> <small>' + texto(ids.length + (l.plazas !== null ? ' / ' + l.plazas : '') + (nuevos.length ? ' · ' + pl(nuevos.length, 'cambio', 'cambios') : ' · sin cambios')) + '</small>' +
              '<span>' + ids.map(function (id) {
                var c = cambio[id], t = texto(nom(id));
                return c ? '<b class="rp-prop-nuevo">' + t + (c.antes ? ' <small>' + texto('(viene de ' + nomL(c.antes) + ')') + '</small>' : ' <small>(nuevo)</small>') + '</b>' : t;
              }).join(', ') + '</span></li>';
          }).join('') +
          (salen.length ? '<li class="rp-prop-no"><b>Salen a sin liga</b><span>' + texto(salen.map(function (a) { return nom(a.ID) + ' (de ' + nomL(a.antes) + ')'; }).join(', ')) + '</span></li>' : '') +
          (prop.sinSitio.filter(function (x) { return !x.antes; }).length ? '<li class="rp-prop-no"><b>Siguen sin sitio</b><span>' + texto(prop.sinSitio.filter(function (x) { return !x.antes; }).map(function (x) { return nom(x.ID); }).join(', ')) + '</span></li>' : '') + '</ul>' +
          '<div class="rp-botones"><button type="button" class="u-btn u-btn-texto" data-rp-noprop' + (aplicando ? ' disabled' : '') + '>Cancelar</button><button type="button" class="u-btn u-btn-accion" data-rp-aplicar' + (prop.asignar.length && !aplicando ? '' : ' disabled') + '>' +
          (aplicando ? 'Repartiendo…' : texto('Aplicar (' + pl(prop.asignar.length, 'cambio', 'cambios') + ')')) + '</button></div></div>';
      }
      /** Mueve varios equipos, uno detrás de otro (cada uno lo guarda el motor, con sus comprobaciones). [[ID, liga]] → promesa con los que se han movido. */
      function moverVarios(lista) {
        var hechos = [];
        return lista.reduce(function (p, x) {
          return p.then(function () {
            return T.actualizar('INSCRIPCIONES_EQUIPOS', x[0], { ID_LIGA: x[1] }, { fn: 'ligasMoverEquipo', args: [x[0], x[1]] }).then(function () { hechos.push(x[0]); if (vivo) pintar(); }, function () {});
          });
        }, Promise.resolve()).then(function () { return hechos; });
      }

      var B = null;
      function pintar() {
        if (!vivo || !el.isConnected || arr) return;
        var todas = A.periodos();
        if (!todas.length) { el.innerHTML = '<p class="u-vacio">Todavía no hay temporadas: añade una en «Preparar la temporada».</p>'; return; }
        if (!tid || !todas.some(function (p) { return p.id === tid; })) tid = A.periodo() && todas.some(function (p) { return p.id === A.periodo(); }) ? A.periodo() : todas[0].id;
        mirarSenales(tid); mirarHistorial(tid);
        var d = datos(), cs = competiciones(d, tid);
        if (!cs.some(function (c) { return s(c.ID) === comp; })) comp = cs.length ? s((cs.filter(function (c) { return (d.ligas || []).some(function (l) { return s(l.ID_COMPETICION) === s(c.ID); }); })[0] || cs[0]).ID) : '';
        B = comp ? tablero(d, comp, sen[tid], partidos, hist[tid] || null) : null;
        var h = '<section class="rp"><p class="u-nota">Elige un día y lleva cada equipo a su liga: arrastrándolo, o tocándolo. Una liga se cierra cuando todos han pagado la señal.</p>' +
          '<div class="rp-cab"><label class="u-campo"><span class="u-etiqueta">Temporada</span><select id="rp-temp">' + todas.map(function (p) {
            return '<option value="' + texto(p.id) + '"' + (p.id === tid ? ' selected' : '') + '>' + texto(p.nombre) + '</option>';
          }).join('') + '</select></label>' +
          (cs.length > 1 ? '<div class="rp-comps" role="tablist" aria-label="Competiciones">' + cs.map(function (c) {
            return '<button type="button" role="tab" class="aj-as-chipe' + (s(c.ID) === comp ? ' rp-comp-sel' : '') + '" aria-selected="' + (s(c.ID) === comp) + '" data-rp-comp="' + texto(c.ID) + '">' + texto(c.NOMBRE_COMERCIAL || c.NOMBRE) + '</button>';
          }).join('') + '</div>' : '') + '</div>';
        if (!cs.length) h += '<p class="u-vacio">Esta temporada no tiene competiciones a las que se apunten equipos.</p>';
        else if (B) {
          if (B.avisoComp) h += '<p class="rp-avcomp">' + texto(B.avisoComp) + (!ctx.soloLeer ? ' <button type="button" class="u-btn u-btn-texto" data-rp-comp-ficha="' + texto(B.comp.ID) + '">Ponerlo ›</button>' : '') + '</p>';
          if (sen[tid] === null) h += '<p class="u-nota">No se ha podido mirar lo pagado de cada señal (hace falta ECONOMIA conectada): se ve solo si cada equipo está confirmado.</p>';
          var nCer = B.ligas.filter(function (l) { return l.cerrada; }).length;
          h += '<p class="rp-resumen">' + texto(B.comp.nombre + ': ' + pl(B.sinLiga.length, 'equipo sin liga', 'equipos sin liga') + ' · ' + nCer + ' de ' + pl(B.ligas.length, 'liga cerrada', 'ligas cerradas')) + '</p>';
          // Día a día (Javi): una pestaña por día con lo que le falta; se ven sus ligas y solo los sin liga que pueden ese día.
          if (dia === null || (dia !== '*' && !B.porDia.some(function (g) { return g.dia === dia; }))) {
            var g0 = guardado('dia_' + comp);
            dia = g0 && (g0 === '*' || B.porDia.some(function (g) { return g.dia === g0; })) ? g0 : B.empezar !== null ? B.empezar : '*';
          }
          var grupos = dia === '*' ? B.porDia : B.porDia.filter(function (g) { return g.dia === dia; });
          // Los de ese día: los que tienen sitio en alguna liga suya y, para que nadie se esconda, los que pueden ese día aunque sus ligas estén cerradas.
          var pool = dia === '*' ? B.sinLiga : B.sinLiga.filter(function (e) { return grupos[0] && (grupos[0].ligas.some(function (l) { return vale(e, l); }) || leVa(e.dias, dia) === true); })
            .sort(function (a, c) { return (c.fuerza || 0) - (a.fuerza || 0); }); // en un día, de más a menos nivel, como se reparten
          if (prop && (prop.dia !== dia || prop.comp !== comp)) prop = null;
          if (B.porDia.length > 1) h += '<div class="rp-dias" role="tablist" aria-label="Días">' + B.porDia.map(function (g) {
            var t = [g.candidatos ? pl(g.candidatos, 'por poner', 'por poner') : '', g.sinSitio ? pl(g.sinSitio, 'sin sitio', 'sin sitio') : '', g.libres === null || !g.abiertas ? '' : pl(g.libres, 'libre', 'libres')].filter(String).join(' · ');
            return '<button type="button" role="tab" class="rp-diab' + (g.dia === dia ? ' rp-diab-sel' : '') + (!g.abiertas ? ' rp-diab-cerrado' : '') + '" aria-selected="' + (g.dia === dia) + '" data-rp-dia="' + texto(g.dia) + '">' +
              '<b>' + texto(g.dia || 'Sin día') + (g.abiertas ? '' : ' 🔒') + '</b><small>' + texto((!g.abiertas ? 'cerrado' + (t ? ' · ' : '') : '') + (t || (g.abiertas ? 'nada por poner' : ''))) + '</small></button>';
          }).join('') + '<button type="button" role="tab" class="rp-diab' + (dia === '*' ? ' rp-diab-sel' : '') + '" aria-selected="' + (dia === '*') + '" data-rp-dia="*"><b>Todos</b><small>' +
            texto(pl(B.sinLiga.length, 'sin liga', 'sin liga')) + '</small></button></div>';
          h += '<p class="rp-leyenda"><span><span class="rp-fz rp-f3">3</span> nivel del equipo (1 a 5)</span><span>· <b>3 / 9</b> equipos de la liga / los que caben</span><span>· borde naranja: le falta la señal</span></p>';
          var fuera = B.sinLiga.length - pool.length;
          var falta = dia !== '*' ? faltaParaProponer(B, dia) : { plazas: true, sinNivel: [] };
          var hayQue = pool.length || (grupos[0] && grupos[0].ligas.some(function (l) { return !l.cerrada && l.ocupadas; })); // también para recolocar a los ya puestos
          var puedeProponer = !ctx.soloLeer && dia !== '*' && hayQue && grupos[0] && grupos[0].ligas.some(function (l) { return !l.cerrada; }) && !falta.plazas;
          var porQueNoProp = ctx.soloLeer || dia === '*' || !hayQue || !grupos[0] || !grupos[0].abiertas ? '' : falta.plazas ? (B.avisoComp ? 'Para proponer un reparto falta saber cuántos caben: pon los partidos por equipo de la competición (arriba).' : 'Para proponer un reparto falta saber cuántos caben en sus ligas: ponles horarios.')
            : falta.sinNivel.length ? 'Para que la propuesta sepa cuál es la liga de arriba, pon el nivel de ' + lista(falta.sinNivel.map(function (l) { return l.NOMBRE; })) + ' (toca «Sin nivel»).' : '';
          h += '<div class="rp-cuerpo"><section class="rp-pool" data-rp-zona="" aria-label="Equipos sin liga"><div class="rp-pool-cab"><h3>' + texto(dia === '*' ? 'Sin liga' : 'Sin liga que pueden ' + losDias(dia)) + '</h3>' +
            (puedeProponer && !prop ? '<button type="button" class="u-btn" data-rp-proponer>' + texto('Proponer el reparto del ' + dia.toLowerCase()) + '</button>' : '') + '</div>' +
            (porQueNoProp && !prop ? '<p class="u-nota rp-fuera">' + texto(porQueNoProp) + '</p>' : '') +
            (grupos[0] && !grupos[0].abiertas && dia !== '*' ? '<p class="u-nota rp-fuera">' + texto('Las ligas de ' + losDias(dia) + ' están cerradas: estos equipos tendrán que ir otro día.') + '</p>' : '') +
            (prop ? panelPropuesta() : '<ul class="rp-eqs">' + (pool.length ? pool.map(function (e) { return tarjeta(e, null); }).join('') : '<li class="rp-vacia">' + (B.sinLiga.length ? 'Ninguno de los que faltan puede este día.' : 'Todos los equipos tienen liga.') + '</li>') + '</ul>') +
            (fuera && dia !== '*' ? '<p class="u-nota rp-fuera">' + texto(pl(fuera, 'equipo sin liga no puede', 'equipos sin liga no pueden') + ' ' + losDias(dia) + '.') + ' <button type="button" class="u-btn u-btn-texto" data-rp-dia="*">Ver todos ›</button></p>' : '') + '</section><div class="rp-dere">';
          h += B.ligas.length ? grupos.map(function (g) {
            return '<section class="rp-dia">' + (dia === '*' ? '<h3 class="rp-dia-t">' + texto(g.dia || 'Sin día') + '<small>' + texto([pl(g.ligas.length, 'liga', 'ligas'), pl(g.equipos, 'equipo', 'equipos'),
              g.libres === null ? '' : pl(g.libres, 'plaza libre', 'plazas libres')].filter(String).join(' · ')) + '</small></h3>' : '') + '<div class="rp-ligas">' + g.ligas.map(columna).join('') + '</div></section>';
          }).join('') : '<p class="u-vacio">Esta competición todavía no tiene ligas: añádelas en «Preparar la temporada» › Competiciones.</p>';
          h += '</div></div>';
        }
        if (aviso) h += '<div class="rp-toast" role="status"><span>' + texto(aviso.texto) + '</span>' + (aviso.deshacer && !aplicando ? '<button type="button" class="u-btn u-btn-texto" data-rp-deshacer>Deshacer</button>' : '') + '</div>';
        // Sin saltos: el scroll se queda donde estaba al repintar.
        var sp = scrollPadre(), y = sp.scrollTop;
        el.innerHTML = h + '</section>';
        sp.scrollTop = y;
        if (foco) { var f = el.querySelector('[data-rp-eq="' + foco + '"] .rp-eqb'); if (f) f.focus({ preventScroll: true }); foco = ''; }
      }

      /* ---------- mover un equipo ---------- */

      function ligaDe(id) { return B && B.ligas.filter(function (l) { return l.ID === id; })[0]; }
      function eqDe(id) {
        var e = null;
        if (B) B.sinLiga.concat.apply(B.sinLiga, B.ligas.map(function (l) { return l.equipos; })).forEach(function (x) { if (x.ID === id) e = x; });
        return e;
      }
      /** Se puede deshacer volviendo a la liga de antes si estaba sin liga o en una que sigue abierta. */
      function deshacerOk(antes) { var la = antes ? ligaDe(antes) : null; return !antes || (la && !la.cerrada); }
      function mover(id, liga) {
        var f = T.fila('INSCRIPCIONES_EQUIPOS', id), e = eqDe(id), l = liga ? ligaDe(liga) : null;
        if (!f || s(f.ID_LIGA) === liga || moviendo[id]) return;
        if (liga && (!l || l.cerrada)) { avisar('Esa liga está cerrada: no entran más equipos.'); return; }
        if (liga && e && !vale(e, l)) { avisar(e.nombre + ' solo puede ' + diasLargos(e.dias) + '.'); return; }
        var antes = s(f.ID_LIGA);
        moviendo[id] = true; foco = id;
        var p = T.actualizar('INSCRIPCIONES_EQUIPOS', id, { ID_LIGA: liga }, { fn: 'ligasMoverEquipo', args: [id, liga] });
        pintar();
        p.then(function () {
          delete moviendo[id];
          if (!vivo) return;
          foco = id;
          avisar((e ? e.nombre : id) + (l ? ' va a ' + l.NOMBRE + '.' : ' queda sin liga.'), deshacerOk(antes) ? [[id, antes]] : null);
        }, function () { delete moviendo[id]; if (vivo) pintar(); });
      }

      /* ---------- arrastrar (desde el asa; con el ratón y en el móvil) ---------- */

      function zonaEn(x, y) {
        var z = document.elementFromPoint(x, y);
        z = z && z.closest && z.closest('[data-rp-zona]');
        return z && el.contains(z) ? z : null;
      }
      function marcar(z) {
        [].forEach.call(el.querySelectorAll('.rp-sobre'), function (x) { if (x !== z) x.classList.remove('rp-sobre', 'rp-no'); });
        if (!z) return;
        z.classList.add('rp-sobre');
        z.classList.toggle('rp-no', z.hasAttribute('data-rp-nova'));
      }
      function soltar(cancelar) {
        if (!arr) return;
        var a = arr; arr = null;
        if (a.fantasma && a.fantasma.parentNode) a.fantasma.parentNode.removeChild(a.fantasma);
        a.li.classList.remove('rp-mueve');
        marcar(null);
        el.classList.remove('rp-arrastrando');
        var nova = a.zona && a.zona.hasAttribute('data-rp-nova') && a.zona.getAttribute('data-rp-zona') !== a.desde;
        [].forEach.call(el.querySelectorAll('[data-rp-zona]'), function (zz) { zz.classList.remove('rp-vale'); zz.removeAttribute('data-rp-nova'); });
        if (nova && !cancelar) {
          var e1 = eqDe(a.id), l1 = ligaDe(a.zona.getAttribute('data-rp-zona'));
          if (e1 && l1) avisar(l1.cerrada ? 'La liga ' + l1.NOMBRE + ' está cerrada: no entran más equipos.' : e1.nombre + ' no puede ' + losDias(l1.DIA_SEMANA) + ': solo ' + diasLargos(e1.dias) + '.');
        }
        if (cancelar || !a.zona || nova) { if (vivo) pintar(); return; }
        var liga = a.zona.getAttribute('data-rp-zona');
        if (liga === a.desde) { pintar(); return; }
        mover(a.id, liga);
      }
      el.addEventListener('pointerdown', function (e) {
        var asa = e.target.closest('.rp-asa');
        if (!asa || ctx.soloLeer) return;
        e.preventDefault();
        var li = asa.closest('[data-rp-eq]'), r = li.getBoundingClientRect(), z = li.closest('[data-rp-zona]');
        var fantasma = li.cloneNode(true);
        fantasma.classList.add('rp-fantasma');
        var ancho = Math.min(r.width, window.innerWidth - 16);
        fantasma.style.width = ancho + 'px'; fantasma.style.left = Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)) + 'px'; fantasma.style.top = r.top + 'px';
        document.body.appendChild(fantasma);
        arr = { li: li, id: li.getAttribute('data-rp-eq'), desde: z ? z.getAttribute('data-rp-zona') : '', fantasma: fantasma, dx: e.clientX - r.left, dy: e.clientY - r.top, zona: null };
        li.classList.add('rp-mueve');
        // Solo en verde donde se puede soltar (Javi): las ligas abiertas de los días que puede y, si viene de una liga, «Sin liga».
        var eq = eqDe(arr.id);
        el.classList.add('rp-arrastrando');
        [].forEach.call(el.querySelectorAll('[data-rp-zona]'), function (zz) {
          var id = zz.getAttribute('data-rp-zona'), ok = id === '' ? arr.desde !== '' : id !== arr.desde && eq && vale(eq, ligaDe(id));
          zz.classList.toggle('rp-vale', !!ok); if (!ok) zz.setAttribute('data-rp-nova', ''); else zz.removeAttribute('data-rp-nova');
        });
        try { asa.setPointerCapture(e.pointerId); } catch (x) {}
      });
      el.addEventListener('pointermove', function (e) {
        if (!arr) return;
        var an = arr.fantasma.offsetWidth;
        arr.fantasma.style.left = Math.max(4, Math.min(e.clientX - arr.dx, window.innerWidth - an - 4)) + 'px'; arr.fantasma.style.top = (e.clientY - arr.dy) + 'px';
        arr.fantasma.style.visibility = 'hidden';
        arr.zona = zonaEn(e.clientX, e.clientY);
        arr.fantasma.style.visibility = '';
        marcar(arr.zona);
        // Cerca del borde de la pantalla, se desplaza sola (en el móvil las ligas van una debajo de otra).
        var sp = scrollPadre(), alto = window.innerHeight;
        if (e.clientY < 80) sp.scrollTop -= 14; else if (e.clientY > alto - 100) sp.scrollTop += 14; // en el móvil, por encima de la barra de abajo
      });
      el.addEventListener('pointerup', function () { soltar(false); });
      el.addEventListener('pointercancel', function () { soltar(true); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && arr) { soltar(true); return; }
        // Con el teclado, el asa abre la tarjeta con sus «Mover a» (arrastrar es solo con el ratón o el dedo).
        var asa = e.target.closest && e.target.closest('[data-rp-asa]');
        if (asa && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); var id = asa.getAttribute('data-rp-asa'); abiertaEq = id; foco = id; pintar(); }
      });

      /* ---------- botones ---------- */

      el.addEventListener('change', function (e) {
        if (e.target.id === 'rp-temp') { tid = e.target.value; A.ponerPeriodo(tid); comp = ''; pide = ''; dia = null; aviso = null; pintar(); return; }
      });
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-rp-liga-ficha], [data-rp-proponer], [data-rp-noprop], [data-rp-aplicar], [data-rp-deshacer], [data-rp-comp], [data-rp-dia], [data-rp-pide], [data-rp-no], [data-rp-cerrar], [data-rp-abrir], [data-rp-cal], [data-rp-ver], [data-rp-a], [data-rp-comp-ficha]');
        if (!b) return;
        if (b.hasAttribute('data-rp-ver')) { var v = b.getAttribute('data-rp-ver'); abiertaEq = abiertaEq === v ? '' : v; foco = v; pintar(); return; }
        if (b.hasAttribute('data-rp-a')) { var x = b.getAttribute('data-rp-a').split('|'); abiertaEq = ''; mover(x[0], x[1]); return; }
        if (b.hasAttribute('data-rp-proponer')) {
          var pr = proponer(B, dia);
          prop = { dia: dia, comp: comp, asignar: pr.asignar, final: pr.final, sinSitio: pr.sinSitio }; pintar(); return;
        }
        if (b.hasAttribute('data-rp-noprop')) { prop = null; pintar(); return; }
        if (b.hasAttribute('data-rp-aplicar')) {
          if (!prop || aplicando) return;
          // Primero los que salen o bajan (dejan sitio), después los que entran: así ninguna liga se pasa de sus plazas por el camino.
          var orden = prop.asignar.slice().sort(function (a, c) { return (a.antes ? 0 : 1) - (c.antes ? 0 : 1); });
          var lista = orden.map(function (a) { return [a.ID, a.liga]; }), antes = {}, n0 = lista.length;
          orden.forEach(function (a) { antes[a.ID] = a.antes; });
          aplicando = true; prop = null; avisar('Aplicando ' + pl(n0, 'cambio', 'cambios') + '…');
          moverVarios(lista).then(function (ids) {
            aplicando = false;
            avisar('Hechos ' + pl(ids.length, 'cambio', 'cambios') + (ids.length < n0 ? ' (' + (n0 - ids.length) + ' no se han podido hacer)' : '') + '.', ids.map(function (id) { return [id, antes[id]]; }).reverse());
          });
          return;
        }
        if (b.hasAttribute('data-rp-deshacer')) {
          if (!aviso || !aviso.deshacer || aplicando) return;
          var vuelta = aviso.deshacer; aplicando = true; avisar('Deshaciendo…');
          moverVarios(vuelta).then(function (hechos) { aplicando = false; avisar('Deshecho: ' + pl(hechos.length, 'equipo vuelve', 'equipos vuelven') + ' a donde estaba' + (hechos.length === 1 ? '' : 'n') + '.'); });
          return;
        }
        if (b.hasAttribute('data-rp-liga-ficha')) { A.ficha('LIGAS', b.getAttribute('data-rp-liga-ficha')); return; }
        if (b.hasAttribute('data-rp-comp-ficha')) { A.ficha('COMPETICIONES', b.getAttribute('data-rp-comp-ficha')); return; }
        if (b.hasAttribute('data-rp-comp')) { comp = b.getAttribute('data-rp-comp'); guardado('comp', comp); pide = ''; dia = null; aviso = null; pintar(); return; }
        if (b.hasAttribute('data-rp-dia')) { dia = b.getAttribute('data-rp-dia'); guardado('dia_' + comp, dia); abiertaEq = ''; pide = ''; prop = null; pintar(); return; }
        if (b.hasAttribute('data-rp-pide')) { pide = b.getAttribute('data-rp-pide'); pintar(); return; }
        if (b.hasAttribute('data-rp-no')) { pide = ''; pintar(); return; }
        // El generador abre en esta liga (recuerda la elegida en el dispositivo: kon_cal_liga, de calendario.js).
        if (b.hasAttribute('data-rp-cal')) { try { localStorage.setItem('kon_cal_liga', JSON.stringify(b.getAttribute('data-rp-cal'))); } catch (x) {} A.abrir('CALENDARIO'); return; }
        var cerrar = b.hasAttribute('data-rp-cerrar'), id = b.getAttribute(cerrar ? 'data-rp-cerrar' : 'data-rp-abrir'), l = ligaDe(id);
        if (!l || cerrando) return;
        cerrando = id; pintar();
        var hoy = new Date(), dd = function (n) { return (n < 10 ? '0' : '') + n; };
        T.actualizar('LIGAS', id, { FECHA_CIERRE: cerrar ? hoy.getFullYear() + '-' + dd(hoy.getMonth() + 1) + '-' + dd(hoy.getDate()) : '' }, { fn: 'ligasCerrar', args: cerrar ? [id] : [id, { abrir: true }] })
          .then(function () {
            cerrando = ''; pide = '';
            if (!vivo) return;
            avisar(cerrar ? 'Liga ' + l.NOMBRE + ' cerrada con ' + pl(l.ocupadas, 'equipo', 'equipos') + '. Ya puedes generar su calendario.' : 'Liga ' + l.NOMBRE + ' abierta otra vez.');
            if (cerrar) mirarPartidos();
            pintar();
          }, function () { cerrando = ''; pide = ''; if (vivo) pintar(); });
      });

      T.leer(TABLAS).then(function () { mirarPartidos(); pintar(); }, function (e) { if (vivo) el.innerHTML = '<p class="u-error">No se han podido leer las ligas: ' + texto(sinPrefijo(e)) + '</p>'; });
    },
    cerrar: function () { if (fin) fin(); fin = null; }
  });
})();
