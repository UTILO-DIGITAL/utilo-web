/*
 * Konamigas · Ajustes › «Preparar la temporada» (T0294) · acción del cliente que va arriba del inicio de Ajustes (inicio)
 *
 * Va en la primera pestaña de Ajustes (la otra, «Todas las tablas»). Preparar una temporada no es rellenar una fila: es crear sus competiciones, sus ligas, los campos, los horarios, las
 * tarifas, las camisetas y los premios, y después apuntar a los equipos, repartirlos y sacar el calendario. Es un asistente
 * (Javi): se elige la temporada y se va pantalla a pantalla («‹ Anterior» y «Siguiente ›», o tocando la barra de pasos),
 * cada una con una pregunta, lo que hay (✓) y cada aviso con el botón que lo resuelve. Los pasos 1 a 4 se hacen aquí;
 * 5 a 8, juntos en «Y después». Salen todas las temporadas; las acabadas, aparte y con un aviso (son para revisar). El estado de cada uno sale de los datos (hecho, a medias, sin empezar):
 *   1 Temporada · 2 Competiciones y ligas · 3 Campos y horarios · 4 Tarifas, camisetas y premios · 5 Inscripciones ·
 *   6 Repartir los equipos y cerrar las ligas · 7 Calendario de cada liga · 8 Avisar a las capitanas.
 * La temporada anterior va plegada debajo, como referencia. Nada se copia
 * solo (Javi, T0296): cada «Añadir» abre la ficha de Ajustes con lo de partida (la temporada, la competición o la liga) y
 * lo guarda la capa de tablas, con su LOG. Sirve igual para una temporada entera y para una competición suelta a mitad.
 * Cada liga dice su tamaño ideal: con sus horarios y los partidos por equipo de su competición (PARTIDOS_EQUIPO), cuántos
 * equipos caben y a cuántas vueltas (4 horarios y 16 partidos: 9 equipos, dos vueltas, 18 jornadas), y avisa si no cuadra.
 * Repartir y cerrar las ligas y avisar a las capitanas llegan después (T0304): se ve su estado, sin botones.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var SIN_GENERAR = ['Copa', 'Supercopa']; // se juegan por eliminatorias: su calendario no se genera (LIGAS_CALENDARIO.js)

  function vacio(v) { return v === '' || v === null || v === undefined; }
  function s(v) { return String(v == null ? '' : v); }
  function fecha(f) { return /^\d{4}-\d\d-\d\d$/.test(s(f)) ? s(f).split('-').reverse().join('/') : s(f); }
  function euros(n) { var x = Number(n); return isFinite(x) && !vacio(n) ? x.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €' : ''; }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
  function entero(v) { var n = Number(v); return isFinite(n) && n > 0 && Math.floor(n) === n ? n : 0; }
  function diaDe(f) { var x = s(f).split('-').map(Number); return x.length === 3 ? DIAS[new Date(Date.UTC(x[0], x[1] - 1, x[2])).getUTCDay()] : ''; }
  /** El primer día de la semana dia ('Jueves') desde la fecha f, o ''. */
  function primerDia(f, dia) {
    var x = s(f).split('-').map(Number), i = DIAS.indexOf(dia);
    if (x.length !== 3 || i < 0) return '';
    var d = new Date(Date.UTC(x[0], x[1] - 1, x[2]));
    d.setUTCDate(d.getUTCDate() + (i - d.getUTCDay() + 7) % 7);
    return d.toISOString().slice(0, 10);
  }
  function vueltasTxt(v) { return v === 1 ? 'a una vuelta' : 'a dos vueltas'; }

  /**
   * El tamaño ideal de una liga: con h horarios por semana y p partidos por equipo, cuántos equipos (todos contra todos,
   * cada uno juega n-1 por vuelta), a cuántas vueltas y cuántas jornadas (n-1 por vuelta con n par; n con n impar, porque
   * cada jornada descansa uno). Se busca el mayor número de equipos que cabe: la primera vuelta que da un número entero de
   * equipos con como mucho h partidos por jornada, a una o dos vueltas (una liga no se juega a más). null si no cuadra
   * ninguno (o falta algo).
   */
  function ideal(h, p) {
    h = entero(h); p = entero(p);
    if (!h || !p) return null;
    for (var v = 1; v <= 2; v++) {
      if (p % v) continue;
      var n = p / v + 1;
      if (Math.floor(n / 2) <= h) return { equipos: n, vueltas: v, jornadas: v * (n % 2 ? n : n - 1) };
    }
    return null;
  }

  /** La temporada anterior a t (la de FECHA_INICIO más reciente antes de la suya), o null. */
  function anterior(temps, t) {
    if (!t || !t.FECHA_INICIO) return null;
    return temps.filter(function (x) { return x.FECHA_INICIO && s(x.FECHA_INICIO) < s(t.FECHA_INICIO) && s(x.ID) !== s(t.ID); })
      .sort(function (a, b) { return s(b.FECHA_INICIO).localeCompare(s(a.FECHA_INICIO)); })[0] || null;
  }

  /** Lo de una temporada que usan los pasos: sus competiciones, ligas, horarios, campos, tarifas… ya filtrado. */
  function deTemporada(d, tid) {
    var comps = (d.comps || []).filter(function (c) { return s(c.ID_TEMPORADA) === s(tid); })
      .sort(function (a, b) { return s(a.FECHA_INICIO).localeCompare(s(b.FECHA_INICIO)) || s(a.NOMBRE).localeCompare(s(b.NOMBRE), 'es'); });
    var ids = comps.map(function (c) { return s(c.ID); });
    var ligas = (d.ligas || []).filter(function (l) { return ids.indexOf(s(l.ID_COMPETICION)) >= 0; })
      .sort(function (a, b) { return DIAS.indexOf(a.DIA_SEMANA || 'x') - DIAS.indexOf(b.DIA_SEMANA || 'x') || s(a.NOMBRE).localeCompare(s(b.NOMBRE), 'es', { numeric: true }); });
    var lids = ligas.map(function (l) { return s(l.ID); });
    var ctps = (d.ctps || []).filter(function (c) { return s(c.ID_TEMPORADA) === s(tid); });
    return {
      comps: comps, ligas: ligas, ctps: ctps,
      huecos: (d.huecos || []).filter(function (h) { return lids.indexOf(s(h.ID_LIGA)) >= 0; }),
      tarifas: (d.tarifas || []).filter(function (x) { return s(x.ID_TEMPORADA) === s(tid); }),
      ins: (d.ins || []).filter(function (i) { return ids.indexOf(s(i.ID_COMPETICION)) >= 0 && i.ESTADO !== 'Baja' && i.ORIGEN !== 'Clasificación'; })
    };
  }
  /** Las competiciones de las que sale c (COMPETICIONES_ORIGEN): [{ id, criterio }]. */
  function origenes(d, c) {
    return (d.origen || []).filter(function (o) { return s(o.ID_COMPETICION) === s(c.ID); }).map(function (o) { return { id: s(o.ID_COMPETICION_ORIGEN), criterio: s(o.CRITERIO), fila: s(o.ID) }; });
  }
  /** ¿Se apuntan equipos a c? Las que van incluidas o salen de otra (copas) reciben los equipos de su origen. */
  function seApuntan(d, c) { return c.INCLUIDA !== true && !origenes(d, c).length; }

  /**
   * El estado de cada liga para los horarios: sus horarios, los campos sin contratar esa temporada, los que caen fuera de
   * lo alquilado (DISPONIBILIDAD_CAMPOS del campo ese día; sin franjas, no se mira), los de otro día y su tamaño ideal.
   */
  function horariosLiga(d, x, l, comp) {
    var hs = x.huecos.filter(function (h) { return s(h.ID_LIGA) === s(l.ID); });
    var ctp = {}; x.ctps.forEach(function (c) { ctp[s(c.ID_CAMPO)] = c; });
    var faltan = [];
    if (!hs.length) faltan.push('Sin horarios.');
    var sinContratar = {}, campos = {}; // campos: el texto de cada aviso de campo sin contratar → el campo
    hs.forEach(function (h) {
      var c = ctp[s(h.ID_CAMPO)];
      if (!c || c.ESTADO !== 'Contratado') sinContratar[s(h.ID_CAMPO)] = c ? s(c.ESTADO) : '';
    });
    Object.keys(sinContratar).forEach(function (id) {
      var t = 'Juega en ' + d.nombre('CAMPOS', id) + ', que ' + (sinContratar[id] ? 'está en ' + sinContratar[id].toLowerCase() : 'no está en los campos de la temporada') + '.';
      faltan.push(aviso(t)); campos[t] = id;
    });
    var otroDia = hs.filter(function (h) { return l.DIA_SEMANA && h.DIA_SEMANA && h.DIA_SEMANA !== l.DIA_SEMANA; }).length;
    if (otroDia) faltan.push(aviso(pl(otroDia, 'horario es', 'horarios son') + ' de otro día que el de la liga.'));
    // Lo de una temporada en marcha (horarios fuera de lo alquilado, más equipos de los que caben, jornadas que no
    // coinciden) no va aquí: lo dice Ligas › Semana (Javi). Aquí, solo lo que hay que preparar.
    var p = entero(comp && comp.PARTIDOS_EQUIPO), id = ideal(hs.length, p), cabe = '';
    if (hs.length && p) {
      if (!id) faltan.push(aviso('Con ' + pl(hs.length, 'horario', 'horarios') + ' no cuadran ' + p + ' partidos por equipo: cambia los horarios o los partidos por equipo de la competición.'));
      else {
        cabe = 'Caben ' + id.equipos + ' equipos ' + vueltasTxt(id.vueltas) + ': ' + id.jornadas + ' jornadas.';
      }
    }
    return { horarios: hs.length, ideal: id, cabe: cabe, faltan: faltan, campos: campos };
  }

  /** El mismo arreglo (el botón que lo resuelve) para todos los avisos de una lista: { 'aviso': boton }. */
  function todos(fa, b) { var o = {}; fa.forEach(function (t) { o[t] = b; }); return o; }
  /**
   * Para quitar lo que sobra (Javi): una competición sin ligas ni equipos, con lo que solo es suyo, o una liga sin equipos
   * ni partidos, con sus horarios. { tabla, id, tambien: [[tabla, id]] (se quita antes), pregunta } o null. El motor
   * vuelve a mirar al borrar que nada más la use (ajustesUsos y la capa de tablas).
   */
  function quitarComp(d, c, nom) {
    var id = s(c.ID), de = function (xs, col) { return (xs || []).filter(function (r) { return s(r[col]) === id; }); };
    if (de(d.ligas, 'ID_COMPETICION').length || de(d.ins, 'ID_COMPETICION').length) return null;
    var t = [], que = [];
    var junta = function (tabla, filas, uno, varios) { filas.forEach(function (r) { t.push([tabla, s(r.ID)]); }); if (filas.length) que.push(filas.length === 1 ? uno : varios.replace('#', filas.length)); };
    junta('TARIFAS', de(d.tarifas, 'REF_ID'), 'su precio de inscripción', 'sus # precios de inscripción');
    junta('COMPETICIONES_ORIGEN', de(d.origen, 'ID_COMPETICION'), 'de qué competición sale', 'de qué competiciones sale');
    junta('MODELOS_COMPETICION', de(d.modelosComp, 'ID_COMPETICION'), 'su modelo de camiseta', 'sus # modelos de camiseta');
    junta('PACKS', de(d.packs, 'ID_COMPETICION'), 'su pack', 'su pack');
    junta('PREMIOS', de(d.premios, 'ID_COMPETICION'), 'su premio', 'sus # premios');
    return { tabla: 'COMPETICIONES', id: id, tambien: t, pregunta: '¿Quitar ' + nom + (que.length ? ' con ' + lista(que) : '') + '?' };
  }
  function quitarLiga(d, l) {
    var id = s(l.ID);
    if ((d.ins || []).some(function (i) { return s(i.ID_LIGA) === id; })) return null;
    if (!d.partidos || d.partidos[id]) return null; // mientras no se sepa si tiene partidos, no se ofrece
    var hs = (d.huecos || []).filter(function (h) { return s(h.ID_LIGA) === id; });
    return { tabla: 'LIGAS', id: id, tambien: hs.map(function (h) { return ['HUECOS', s(h.ID)]; }),
      pregunta: '¿Quitar la liga ' + s(l.NOMBRE || id) + (hs.length ? ' con ' + (hs.length === 1 ? 'su horario' : 'sus ' + hs.length + ' horarios') : '') + '?' };
  }
  function sinTildes(x) { return s(x).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function aMin(h) { var m = /^(\d\d):(\d\d)$/.exec(s(h)); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
  /**
   * T0294 · La competición de la temporada anterior que se parece a c: la del mismo tipo y nombre; si no, la única de su
   * tipo. null si no hay o hay varias del mismo tipo con otro nombre.
   */
  function parecida(xa, c) {
    if (!xa) return null;
    var mismas = xa.comps.filter(function (o) { return s(o.TIPO) === s(c.TIPO); });
    return mismas.filter(function (o) { return sinTildes(o.NOMBRE) === sinTildes(c.NOMBRE); })[0] || (mismas.length === 1 ? mismas[0] : null);
  }
  /**
   * T0294 · Lo que se puede traer de la temporada anterior a la competición c: { de: { ID, nombre }, ligas: [{ NOMBRE,
   * DIA_SEMANA, NIVEL, MINUTOS_PARTIDO, huecos: [{ HORA, ID_CAMPO }] }] } (las ligas que c no tiene ya, por nombre), o null.
   * Sin gestor, árbitro ni fecha (Javi).
   */
  function paraTraer(d, xa, x, c) {
    var o = parecida(xa, c);
    if (!o) return null;
    var tiene = x.ligas.filter(function (l) { return s(l.ID_COMPETICION) === s(c.ID); }).map(function (l) { return sinTildes(l.NOMBRE); });
    var ls = xa.ligas.filter(function (l) { return s(l.ID_COMPETICION) === s(o.ID) && tiene.indexOf(sinTildes(l.NOMBRE)) < 0; }).map(function (l) {
      return { NOMBRE: s(l.NOMBRE), DIA_SEMANA: s(l.DIA_SEMANA), NIVEL: s(l.NIVEL), MINUTOS_PARTIDO: Number(l.MINUTOS_PARTIDO) || 45,
        huecos: xa.huecos.filter(function (h) { return s(h.ID_LIGA) === s(l.ID); }).map(function (h) { return { HORA: s(h.HORA), ID_CAMPO: s(h.ID_CAMPO) }; })
          .sort(function (a, b) { return a.HORA.localeCompare(b.HORA) || a.ID_CAMPO.localeCompare(b.ID_CAMPO); }) };
    });
    return ls.length ? { de: { ID: s(o.ID), nombre: s(o.NOMBRE_COMERCIAL || o.NOMBRE || o.ID) }, ligas: ls } : null;
  }
  /**
   * T0294 · El horario de la temporada con el que chocaría uno nuevo (h: { HORA, ID_CAMPO }) de una liga nueva de la
   * competición comp, el día dia y de min minutos: mismo campo y día, horas que se pisan y competiciones cuyas fechas se
   * tocan. null si no choca. x: lo de la temporada (deTemporada).
   */
  function choque(x, comp, dia, min, h) {
    var a = aMin(h.HORA);
    if (a === null) return null;
    var ligaDe = {}; x.ligas.forEach(function (l) { ligaDe[s(l.ID)] = l; });
    var compDe = {}; x.comps.forEach(function (c) { compDe[s(c.ID)] = c; });
    var tocan = function (c1, c2) { return !c1 || !c2 || !((c1.FECHA_FIN && c2.FECHA_INICIO && s(c1.FECHA_FIN) < s(c2.FECHA_INICIO)) || (c2.FECHA_FIN && c1.FECHA_INICIO && s(c2.FECHA_FIN) < s(c1.FECHA_INICIO))); };
    return x.huecos.filter(function (o) {
      if (s(o.ID_CAMPO) !== s(h.ID_CAMPO) || s(o.DIA_SEMANA) !== s(dia)) return false;
      var l = ligaDe[s(o.ID_LIGA)], b = aMin(o.HORA), m2 = (l && Number(l.MINUTOS_PARTIDO)) || 45;
      return b !== null && a < b + m2 && b < a + (Number(min) || 45) && tocan(comp, l && compDe[s(l.ID_COMPETICION)]);
    })[0] || null;
  }
  /**
   * T0294 · El cuadrante del día de una liga (Javi: para añadir horarios hay que ver qué está libre). x: lo de la temporada
   * (deTemporada), d: los datos (dispo), l: la liga, comp: su competición. Devuelve { dia, min (lo que dura un partido),
   * desde, hasta (minutos del día que se enseñan, de 15 en 15), campos: [{ id, franjas: [[a, b]] o null (sin datos de lo
   * alquilado ese día) }], ocupados: [{ id, campo, a, b, liga, nombre, propio }], tiene, necesita }. Campos: los contratados
   * esa temporada y los que ya usa alguna liga ese día. Ocupados: los horarios de ese día de ligas cuyas competiciones se
   * juegan a la vez que la suya. tiene: sus horarios; ideal: los equipos que caben con ellos; necesita: los horarios que
   * hacen falta para sus equipos confirmados (equipos), uno por partido de cada jornada.
   */
  function cuadranteDia(x, d, l, comp) {
    var dia = s(l.DIA_SEMANA), dur = Number(l.MINUTOS_PARTIDO) || 45;
    var ligaDe = {}; x.ligas.forEach(function (o) { ligaDe[s(o.ID)] = o; });
    var compDe = {}; x.comps.forEach(function (c) { compDe[s(c.ID)] = c; });
    var tocan = function (c1, c2) { return !c1 || !c2 || !((c1.FECHA_FIN && c2.FECHA_INICIO && s(c1.FECHA_FIN) < s(c2.FECHA_INICIO)) || (c2.FECHA_FIN && c1.FECHA_INICIO && s(c2.FECHA_FIN) < s(c1.FECHA_INICIO))); };
    var ocupados = x.huecos.filter(function (h) {
      var o = ligaDe[s(h.ID_LIGA)];
      return s(h.DIA_SEMANA) === dia && o && (s(o.ID) === s(l.ID) || tocan(comp, compDe[s(o.ID_COMPETICION)]));
    }).map(function (h) {
      var o = ligaDe[s(h.ID_LIGA)], a = aMin(h.HORA);
      return { id: s(h.ID), campo: s(h.ID_CAMPO), a: a, b: a + ((Number(o.MINUTOS_PARTIDO) || 45)), liga: s(o.ID), nombre: s(o.NOMBRE), propio: s(o.ID) === s(l.ID) };
    }).filter(function (o) { return o.a !== null; });
    var ids = [];
    x.ctps.forEach(function (c) { if (c.ESTADO === 'Contratado' && ids.indexOf(s(c.ID_CAMPO)) < 0) ids.push(s(c.ID_CAMPO)); });
    ocupados.forEach(function (o) { if (ids.indexOf(o.campo) < 0) ids.push(o.campo); });
    var campos = ids.map(function (id) {
      var c = x.ctps.filter(function (y) { return s(y.ID_CAMPO) === id; })[0];
      var fr = c ? (d.dispo || []).filter(function (f) { return s(f.ID_CAMPO_TEMPORADA) === s(c.ID) && s(f.DIA_SEMANA) === dia; }) : [];
      return { id: id, contratado: !!c && c.ESTADO === 'Contratado', franjas: fr.length ? fr.map(function (f) { var a = aMin(f.HORA_DESDE), b = aMin(f.HORA_HASTA); return [a, b === 0 ? 1440 : b]; }) : null };
    });
    var desde = 19 * 60, hasta = 24 * 60;
    ocupados.forEach(function (o) { desde = Math.min(desde, Math.floor(o.a / 15) * 15); hasta = Math.max(hasta, Math.ceil(o.b / 15) * 15); });
    var conf = x.ins.filter(function (i) { return s(i.ID_LIGA) === s(l.ID) && i.ESTADO === 'Confirmada'; }).length;
    var hs = ocupados.filter(function (o) { return o.propio; }).length;
    return { dia: dia, min: dur, desde: desde, hasta: hasta, campos: campos, ocupados: ocupados, tiene: hs,
      equipos: conf, necesita: conf >= 2 ? Math.floor(conf / 2) : 0, ideal: ideal(hs, comp && comp.PARTIDOS_EQUIPO) };
  }
  /** ¿Cabe un partido de la liga (min minutos) a las a en ese campo? libre y, si el campo tiene franjas ese día, dentro. */
  function cabeEn(cd, campo, a) {
    var b = a + cd.min, c = cd.campos.filter(function (x) { return x.id === campo; })[0];
    if (cd.ocupados.some(function (o) { return o.campo === campo && a < o.b && o.a < b; })) return 'ocupado';
    if (c && c.franjas && !c.franjas.some(function (f) { return f[0] <= a && b <= f[1]; })) return 'fuera';
    return '';
  }
  /** Una fecha 'aaaa-mm-dd' un año después (el 29 de febrero pasa al 28). '' si no es una fecha. */
  function masUnAno(f) {
    var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s(f));
    if (!m) return '';
    return (Number(m[1]) + 1) + '-' + m[2] + '-' + (m[2] === '02' && m[3] === '29' ? '28' : m[3]);
  }
  /** Los años de un nombre, uno más: «26-27: LIGAS» → «27-28: LIGAS»; «KOPA DI MONDO 2027» → «KOPA DI MONDO 2028». */
  function subirAnos(t) {
    return s(t).replace(/\b(20\d\d)\b/g, function (x) { return String(Number(x) + 1); })
      .replace(/(^|[^\d])(\d\d)-(\d\d)(?!\d)/g, function (x, a, b, c) { return Number(c) === Number(b) + 1 ? a + (Number(b) + 1) + '-' + (Number(c) + 1) : x; });
  }
  /**
   * T0294 · Las competiciones de la temporada anterior que la nueva aún no tiene (por nombre), para traerlas: [{ de (su ID),
   * NOMBRE, NOMBRE_COMERCIAL (con los años de uno más), TIPO, ID_FORMATO, INCLUIDA, FECHA_INICIO y FECHA_FIN (un año
   * después), PARTIDOS_EQUIPO, SENAL, ligas (cuántas tenía) }] y origen: [{ a, de, CRITERIO }] de qué sale cada una, cuando
   * los dos extremos son traídas o ya están en la nueva (por nombre). null si no hay nada que traer.
   */
  function paraTraerComps(d, xa, x) {
    if (!xa) return null;
    var tiene = {}; x.comps.forEach(function (c) { tiene[sinTildes(c.NOMBRE)] = s(c.ID); });
    var cs = xa.comps.filter(function (c) { return !(sinTildes(c.NOMBRE) in tiene); });
    if (!cs.length) return null;
    var lista = cs.map(function (c) {
      return { de: s(c.ID), NOMBRE: s(c.NOMBRE), NOMBRE_COMERCIAL: subirAnos(c.NOMBRE_COMERCIAL), TIPO: s(c.TIPO), ID_FORMATO: s(c.ID_FORMATO), INCLUIDA: c.INCLUIDA === true,
        FECHA_INICIO: masUnAno(c.FECHA_INICIO), FECHA_FIN: masUnAno(c.FECHA_FIN), PARTIDOS_EQUIPO: entero(c.PARTIDOS_EQUIPO) || '', SENAL: vacio(c.SENAL) ? '' : Number(c.SENAL),
        DESCANSO_CADA: entero(c.DESCANSO_CADA) || '',
        ligas: xa.ligas.filter(function (l) { return s(l.ID_COMPETICION) === s(c.ID); }).length };
    });
    var nomDe = {}; xa.comps.forEach(function (c) { nomDe[s(c.ID)] = sinTildes(c.NOMBRE); });
    var ref = function (id) { return cs.some(function (c) { return s(c.ID) === s(id); }) ? s(id) : tiene[nomDe[s(id)]] || ''; };
    var origen = (d.origen || []).filter(function (o) { return nomDe[s(o.ID_COMPETICION)] !== undefined; }).map(function (o) {
      return { a: ref(o.ID_COMPETICION), de: ref(o.ID_COMPETICION_ORIGEN), CRITERIO: s(o.CRITERIO) };
    }).filter(function (o) { return o.a && o.de && (cs.some(function (c) { return s(c.ID) === o.a; })); });
    return { comps: lista, origen: origen };
  }
  /**
   * T0294 · Los campos contratados la temporada anterior que la nueva aún no tiene, para traerlos: [{ ID_CAMPO, ESTADO
   * (Contratado), PRECIO_HORA, TIPO_IVA, franjas: lo que daba el colegio, con sus fechas un año después }], o null.
   */
  function paraTraerCampos(d, xa, x) {
    if (!xa) return null;
    var tiene = x.ctps.map(function (c) { return s(c.ID_CAMPO); });
    var cs = xa.ctps.filter(function (c) { return c.ESTADO === 'Contratado' && tiene.indexOf(s(c.ID_CAMPO)) < 0; }).map(function (c) {
      return { ID_CAMPO: s(c.ID_CAMPO), ESTADO: 'Contratado', PRECIO_HORA: vacio(c.PRECIO_HORA) ? '' : Number(c.PRECIO_HORA), TIPO_IVA: s(c.TIPO_IVA),
        franjas: (d.dispo || []).filter(function (f) { return s(f.ID_CAMPO_TEMPORADA) === s(c.ID); }).map(function (f) {
          return { DIA_SEMANA: s(f.DIA_SEMANA), HORA_DESDE: s(f.HORA_DESDE), HORA_HASTA: s(f.HORA_HASTA), FECHA_DESDE: masUnAno(f.FECHA_DESDE), FECHA_HASTA: masUnAno(f.FECHA_HASTA), NOTAS: s(f.NOTAS) };
        }) };
    });
    return cs.length ? cs : null;
  }
  /**
   * T0294 · El modelo de camiseta de una temporada (Javi: un modelo nuevo por los sponsors, para varias competiciones):
   * { comps: [{ ID, nombre }] (las que se cobran y no tienen modelo), prev: { PRENDA, CAMISETAS_INCLUIDAS, NOMBRE }
   * (el del año pasado, para proponer), sugerido (un nombre: «SPONSORS 27-28») }, o null si no le falta a ninguna.
   */
  function modeloTemporada(d, xa, x) {
    var tienen = (d.modelosComp || []).map(function (m) { return s(m.ID_COMPETICION); });
    var comps = x.comps.filter(function (c) { return c.INCLUIDA !== true && tienen.indexOf(s(c.ID)) < 0; })
      .map(function (c) { return { ID: s(c.ID), nombre: s(c.NOMBRE_COMERCIAL || c.NOMBRE || c.ID) }; });
    if (!comps.length) return null;
    var prev = null;
    if (xa) {
      var ids = xa.comps.map(function (c) { return s(c.ID); });
      var mc = (d.modelosComp || []).filter(function (m) { return ids.indexOf(s(m.ID_COMPETICION)) >= 0; })[0];
      var mo = mc && (d.modelos || []).filter(function (m) { return s(m.ID) === s(mc.ID_MODELO); })[0];
      if (mc) prev = { NOMBRE: mo ? s(mo.NOMBRE) : '', PRENDA: mo ? s(mo.PRENDA) : '', CAMISETAS_INCLUIDAS: Number(mc.CAMISETAS_INCLUIDAS) || 0 };
    }
    return { comps: comps, prev: prev };
  }
  /** La tarifa que valía al final de una lista (la de FECHA_DESDE más reciente; sin fechas, la última), o null. */
  function ultimaTarifa(ts) { return (ts || []).slice().sort(function (a, b) { return s(a.FECHA_DESDE).localeCompare(s(b.FECHA_DESDE)); }).pop() || null; }
  /**
   * T0294 · Los festivos y descansos de la temporada (CALENDARIO entre sus fechas), cada uno para abrirlo (Javi: todo desde
   * el asistente). Hacen falta para el calendario de las ligas. No es algo que falte: sin ninguno, se juega todas las semanas.
   */
  function festivos(d, tem) {
    var cal = (d.calendario || []).filter(function (x) { return x.FECHA && (!tem.FECHA_INICIO || s(x.FECHA) >= s(tem.FECHA_INICIO)) && (!tem.FECHA_FIN || s(x.FECHA) <= s(tem.FECHA_FIN)); })
      .sort(function (a, b) { return s(a.FECHA).localeCompare(s(b.FECHA)); });
    var per = periodosCal(cal), ct = calendarioTemporada(d, tem), fa = [], ar = {};
    if (ct.choques.length) {
      var tc = aviso('Hay partidos en ' + pl(ct.choques.length, 'día sin jugar', 'días sin jugar') + ': ' + ct.choques.slice(0, 6).map(function (x) { return fecha(x.fecha).slice(0, 5); }).join(', ') + (ct.choques.length > 6 ? '…' : '') + '.');
      fa.push(tc); ar[tc] = { texto: 'Verlos', dia: ct.choques[0].fecha };
    }
    return { titulo: 'Festivos y descansos', faltan: fa, arreglos: ar, sub: (cal.length ? pl(cal.length, 'día sin jugar', 'días sin jugar') + (per.length > 1 ? ' en ' + per.length + ' periodos' : '') : 'Ninguno todavía') +
        '. Toca un día para marcarlo o cambiarlo. El descanso para recuperar cada X jornadas va en cada competición.',
      traerFestivos: paraTraerFestivos(d, tem),
      // Javi: en un calendario de la temporada (como la vista «Calendario»), no en botones sueltos.
      calendario: ct,
      botones: [{ texto: 'Añadir unos días seguidos', tp: 'dias' }] };
  }
  /**
   * T0294 · Lo que no cuadra en las ligas de la temporada (Javi: lo pendiente, en el asistente): más equipos confirmados de los
   * que caben con sus horarios, jornadas que no son las del tamaño ideal y horarios fuera de lo que da el colegio. Cada uno,
   * con lo que lo resuelve: sus horarios, sus equipos (en Gestión) o la liga.
   */
  function enMarcha(d, x, compDe, tem) {
    var ctp = {}; x.ctps.forEach(function (c) { if (c.ESTADO === 'Contratado') ctp[s(c.ID_CAMPO)] = c; });
    var items = x.ligas.map(function (l) {
      var hs = x.huecos.filter(function (h) { return s(h.ID_LIGA) === s(l.ID); }), comp = compDe[s(l.ID_COMPETICION)] || {};
      var conf = x.ins.filter(function (i) { return s(i.ID_LIGA) === s(l.ID) && i.ESTADO === 'Confirmada'; }).length;
      var id = ideal(hs.length, comp.PARTIDOS_EQUIPO), nj = entero(l.NUM_JORNADAS), dura = entero(l.MINUTOS_PARTIDO) || 45, fa = [], ar = {};
      if (id && conf > id.equipos) {
        var t1 = aviso('Tiene ' + conf + ' equipos confirmados y caben ' + id.equipos + '.');
        fa.push(t1); ar[t1] = { texto: 'Ver sus equipos en Gestión', seccion: 'GESTION', href: '?s=gestion&tem=' + encodeURIComponent(s(tem.ID)) + '&comp=' + encodeURIComponent(s(comp.ID)) };
      }
      if (id && nj && nj !== id.jornadas) { var t2 = aviso('Tiene ' + nj + ' jornadas y le tocan ' + id.jornadas + '.'); fa.push(t2); ar[t2] = { texto: 'Cambiarlas', tabla: 'LIGAS', id: s(l.ID) }; }
      hs.forEach(function (h) {
        var c = ctp[s(h.ID_CAMPO)], fr = c ? (d.dispo || []).filter(function (f) { return s(f.ID_CAMPO_TEMPORADA) === s(c.ID) && f.DIA_SEMANA === h.DIA_SEMANA; }) : [];
        var a = aMin(h.HORA);
        if (!fr.length || a === null) return;
        if (!fr.some(function (f) { var i = aMin(f.HORA_DESDE), j = aMin(f.HORA_HASTA); if (j === 0) j = 1440; return i !== null && j !== null && i <= a && a + dura <= j; })) {
          var t3 = aviso('El de las ' + s(h.HORA) + ' en ' + d.nombre('CAMPOS', h.ID_CAMPO) + ' cae fuera de lo que da el colegio.');
          fa.push(t3); ar[t3] = { texto: 'Cambiar sus horarios', horarios: s(l.ID) };
        }
      });
      return { titulo: s(l.NOMBRE || l.ID), ficha: ['LIGAS', l.ID], faltan: fa, arreglos: ar, sub: '' };
    }).filter(function (it) { return it.faltan.length; });
    return { n: 9, id: 'MARCHA', titulo: 'Ligas en marcha', estado: items.length ? 'medias' : 'hecho',
      resumen: items.length ? pl(items.length, 'liga con algo que no cuadra', 'ligas con algo que no cuadra') : 'Todo cuadra', items: items, ref: [] };
  }
  /**
   * T0294 · Los festivos y descansos de la temporada anterior, un año después, para traerlos (Javi: casi todos se repiten).
   * Los que no caen en la misma fecha cada año (Semana Santa, Pascua, Corpus…) y los descansos salen con «revisar». Solo
   * los que caen dentro de la temporada y aún no están. [{ FECHA, MOTIVO, FESTIVO, DESCANSO, revisar }] o null.
   */
  function paraTraerFestivos(d, tem) {
    var ant = anterior(d.temporadas || [], tem);
    if (!ant) return null;
    var ya = (d.calendario || []).map(function (x) { return s(x.FECHA); });
    var dentro = function (f, t) { return f && (!t.FECHA_INICIO || f >= s(t.FECHA_INICIO)) && (!t.FECHA_FIN || f <= s(t.FECHA_FIN)); };
    var l = (d.calendario || []).filter(function (x) { return dentro(s(x.FECHA), ant); }).map(function (x) {
      return { FECHA: masUnAno(x.FECHA), MOTIVO: s(x.MOTIVO), FESTIVO: x.FESTIVO === true, DESCANSO: x.DESCANSO === true,
        revisar: /santa|santo|pascua|ramos|corpus|ascensi|carnaval/i.test(s(x.MOTIVO)) || (x.DESCANSO === true && x.FESTIVO !== true) };
    }).filter(function (x) { return dentro(x.FECHA, tem) && ya.indexOf(x.FECHA) < 0; }).sort(function (a, b) { return a.FECHA.localeCompare(b.FECHA); });
    return l.length ? l : null;
  }
  /**
   * T0294 · El calendario de una temporada, como la vista «Calendario» de Festivos (festivos.js): los meses de lunes a
   * domingo; cada día, { fecha, n, marca (su fila de CALENDARIO o null), ligas (las que juegan ese día por su día de la semana
   * y aún no tienen calendario), partidos (los de verdad, de d.partidosDia) }; perdidas, los festivos o descansos en un día
   * con ligas sin calendario (pasan a la semana siguiente); choques, los días sin jugar con partidos programados (Javi: no
   * cuadra; se mueven en Ligas). { meses: [{ titulo, semanas: [[día | null] × 7] }], perdidas, choques }.
   */
  var MESES_C = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var DIAS_L = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  function calendarioTemporada(d, tem) {
    if (!/^\d{4}-\d\d-\d\d$/.test(s(tem.FECHA_INICIO)) || !/^\d{4}-\d\d-\d\d$/.test(s(tem.FECHA_FIN)) || s(tem.FECHA_FIN) < s(tem.FECHA_INICIO)) return { meses: [], perdidas: [], choques: [] };
    var marcas = {}; (d.calendario || []).forEach(function (c) { marcas[s(c.FECHA)] = c; });
    var comps = {}; (d.comps || []).forEach(function (c) { if (s(c.ID_TEMPORADA) === s(tem.ID)) comps[s(c.ID)] = c; });
    var ligas = (d.ligas || []).filter(function (l) { return comps[s(l.ID_COMPETICION)] && DIAS_L.indexOf(l.DIA_SEMANA) >= 0; });
    var meses = [], perdidas = [], choques = [], mes = null, conCal = {};
    Object.keys(d.partidosDia || {}).forEach(function (f) { d.partidosDia[f].forEach(function (p) { conCal[s(p.ID_LIGA)] = true; }); });
    for (var f = s(tem.FECHA_INICIO), k = 0; f <= s(tem.FECHA_FIN) && k < 800; f = masDias(f, 1), k++) {
      var x = f.split('-').map(Number), ds = (new Date(Date.UTC(x[0], x[1] - 1, x[2])).getUTCDay() + 6) % 7;
      if (!mes || mes.m !== x[1]) { mes = { m: x[1], titulo: MESES_C[x[1] - 1] + ' ' + x[0], semanas: [[null, null, null, null, null, null, null]] }; meses.push(mes); }
      var sem = mes.semanas[mes.semanas.length - 1];
      if (ds === 0 && sem.some(Boolean)) { sem = [null, null, null, null, null, null, null]; mes.semanas.push(sem); }
      var juegan = ligas.filter(function (l) {
        var c = comps[s(l.ID_COMPETICION)];
        return l.DIA_SEMANA === DIAS_L[ds] && (!l.FECHA_INICIO || f >= s(l.FECHA_INICIO)) && (!c.FECHA_FIN || f <= s(c.FECHA_FIN)) && (!c.FECHA_INICIO || f >= s(c.FECHA_INICIO));
      });
      // Con los partidos de verdad (d.partidosDia): las ligas que ya tienen calendario, por sus partidos; las demás, por su día.
      var ps = d.partidosDia ? (d.partidosDia[f] || []) : [];
      var dia = { fecha: f, n: x[2], marca: marcas[f] || null, ligas: d.partidosDia ? juegan.filter(function (l) { return !conCal[s(l.ID)]; }) : juegan, partidos: ps };
      sem[ds] = dia;
      var sinJugar = dia.marca && (dia.marca.FESTIVO === true || dia.marca.DESCANSO === true);
      if (sinJugar && dia.ligas.length) perdidas.push(dia);
      if (sinJugar && ps.some(function (p) { return p.ESTADO !== 'Aplazado' && p.ESTADO !== 'Suspendido'; })) choques.push(dia);
    }
    return { meses: meses, perdidas: perdidas, choques: choques };
  }
  /** La fecha 'aaaa-mm-dd' n días después. */
  function masDias(f, n) { var x = s(f).split('-').map(Number), d = new Date(Date.UTC(x[0], x[1] - 1, x[2] + n)); return d.toISOString().slice(0, 10); }
  /**
   * T0294 · Los festivos y descansos agrupados en periodos (Javi: 51 botones era demasiado): los días seguidos van juntos, con
   * el motivo que más se repite y los demás que caen dentro. Un día suelto abre su ficha; un periodo lleva sus días (dias)
   * para desplegarlos. [{ texto, ficha } | { texto, clave, dias: [{ texto, ficha }] }].
   */
  function periodosCal(cal) {
    var grupos = [];
    cal.forEach(function (x) { var g = grupos[grupos.length - 1]; if (g && masDias(g[g.length - 1].FECHA, 1) === s(x.FECHA)) g.push(x); else grupos.push([x]); });
    return grupos.map(function (g) {
      var dia = function (x) { return { texto: fecha(x.FECHA).slice(0, 5) + ' ' + s(x.MOTIVO), ficha: ['CALENDARIO', s(x.FECHA)] }; };
      if (g.length === 1) return dia(g[0]);
      var cuenta = {}; g.forEach(function (x) { cuenta[s(x.MOTIVO)] = (cuenta[s(x.MOTIVO)] || 0) + 1; });
      var motivos = Object.keys(cuenta).sort(function (a, b) { return cuenta[b] - cuenta[a]; });
      return { texto: fecha(g[0].FECHA).slice(0, 5) + ' – ' + fecha(g[g.length - 1].FECHA).slice(0, 5) + ' · ' + motivos[0] + ' · ' + g.length + ' días' +
        (motivos.length > 1 ? ' (con ' + lista(motivos.slice(1)) + ')' : ''), clave: s(g[0].FECHA), dias: g.map(dia) };
    });
  }
  /** «a, b y c». */
  function lista(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]; }

  /**
   * ¿Es un aviso de verdad (algo que está mal) o solo algo por rellenar (Javi: tanto rojo es ruido)? Avisos: lo que se pisa,
   * no cuadra o no encaja; lo demás («Sin premios», «Falta la señal») es lo normal mientras se prepara.
   */
  // Se marcan donde nacen (aviso(texto)), no por cómo están escritos: cambiar una frase no cambia su color.
  var AVISOS = {};
  function aviso(t) { AVISOS[t] = true; return t; }
  function esAviso(t) { return AVISOS[String(t)] === true; }

  function estadoDe(hay, faltan) { return !hay ? 'pendiente' : faltan ? 'medias' : 'hecho'; }
  function nFaltan(items) { return items.reduce(function (n, it) { return n + (it.faltan || []).length + nFaltan(it.hijas || []); }, 0); }

  /**
   * Los ocho pasos de una temporada: { tem, ant, pasos: [{ n, id, titulo, estado ('hecho' | 'medias' | 'pendiente' |
   * 'luego' | 'mirando'), resumen, items: [{ titulo, sub, faltan, ficha: [tabla, id], hijas, botones }], botones:
   * [{ texto, tabla, valores } | { texto, accion }], nota, ref: ['texto'] }] }.
   * d: { temporadas, comps, origen, ligas, huecos, ctps, dispo, tarifas, modelosComp, modelos, packs, premios, ins,
   * partidos ({ ID_LIGA: n } o null si no se ha podido mirar; undefined mientras se mira), nombre(tabla, id) }.
   */
  function camino(d, tid) {
    d = Object.assign({ nombre: function (t, id) { return s(id); } }, d);
    var temps = d.temporadas || [], tem = temps.filter(function (t) { return s(t.ID) === s(tid); })[0] || null;
    if (!tem) return { tem: null, ant: null, pasos: [] };
    var ant = anterior(temps, tem), x = deTemporada(d, tem.ID), xa = ant ? deTemporada(d, ant.ID) : null;
    var nomC = function (c) { return s(c.NOMBRE_COMERCIAL || c.NOMBRE || c.ID); };
    var corto = function (c) { return s(c.NOMBRE || c.NOMBRE_COMERCIAL || c.ID); };
    var pasos = [];

    /* 1 · Temporada: nombre y fechas, sin pisarse con otra. */
    var f1 = [];
    if (!tem.FECHA_INICIO || !tem.FECHA_FIN) f1.push('Faltan las fechas.');
    else if (s(tem.FECHA_FIN) < s(tem.FECHA_INICIO)) f1.push(aviso('Acaba antes de empezar.'));
    temps.forEach(function (o) {
      if (s(o.ID) === s(tem.ID) || !o.FECHA_INICIO || !o.FECHA_FIN || !tem.FECHA_INICIO || !tem.FECHA_FIN) return;
      if (s(o.FECHA_INICIO) <= s(tem.FECHA_FIN) && s(tem.FECHA_INICIO) <= s(o.FECHA_FIN))
        f1.push(aviso('Se solapa con ' + s(o.NOMBRE || o.ID) + ' (del ' + fecha(o.FECHA_INICIO) + ' al ' + fecha(o.FECHA_FIN) + ').'));
    });
    var fest = festivos(d, tem);
    pasos.push({ n: 1, id: 'TEMPORADA', titulo: 'Temporada', estado: f1.length || fest.faltan.length ? 'medias' : 'hecho',
      resumen: tem.FECHA_INICIO && tem.FECHA_FIN ? 'Del ' + fecha(tem.FECHA_INICIO) + ' al ' + fecha(tem.FECHA_FIN) : 'Sin fechas',
      items: [{ titulo: s(tem.NOMBRE || tem.ID), sub: tem.FECHA_INICIO ? 'Del ' + fecha(tem.FECHA_INICIO) + ' al ' + fecha(tem.FECHA_FIN) : '', faltan: f1, ficha: ['TEMPORADAS', tem.ID],
        arreglos: todos(f1, { texto: 'Cambiar las fechas', tabla: 'TEMPORADAS', id: s(tem.ID) }) }, fest],
      ref: ant ? [s(ant.NOMBRE) + ': del ' + fecha(ant.FECHA_INICIO) + ' al ' + fecha(ant.FECHA_FIN) + '.'] : [],
      refCorto: ant ? 'del ' + fecha(ant.FECHA_INICIO) + ' al ' + fecha(ant.FECHA_FIN) : '' });

    /* 2 · Competiciones y ligas. */
    var items2 = x.comps.map(function (c) {
      var fa = [], ors = origenes(d, c), ls = x.ligas.filter(function (l) { return s(l.ID_COMPETICION) === s(c.ID); });
      if (c.FECHA_INICIO && tem.FECHA_INICIO && s(c.FECHA_INICIO) < s(tem.FECHA_INICIO)) fa.push(aviso('Empieza antes que la temporada.'));
      if (c.FECHA_FIN && tem.FECHA_FIN && s(c.FECHA_FIN) > s(tem.FECHA_FIN)) fa.push(aviso('Acaba después que la temporada.'));
      if (c.INCLUIDA === true && !ors.length) fa.push(aviso('Va incluida, pero no dice de qué competición salen sus equipos.'));
      if (seApuntan(d, c)) {
        if (!entero(c.PARTIDOS_EQUIPO)) fa.push('Faltan los partidos por equipo.');
        if (vacio(c.SENAL)) fa.push('Falta la señal.');
      }
      if (!ls.length) fa.push('Sin ligas.');
      var hijas = ls.map(function (l) {
        var fl = [];
        // Sin gestor no es algo que falte: se puede poner después (Javi). Sin fecha propia, empieza con su competición: el primer día de la liga desde que empieza (Javi).
        if (l.FECHA_INICIO) {
          if (l.DIA_SEMANA && diaDe(l.FECHA_INICIO) !== l.DIA_SEMANA) fl.push(aviso('Empieza el ' + fecha(l.FECHA_INICIO) + ', que no es ' + s(l.DIA_SEMANA).toLowerCase() + '.'));
          if (c.FECHA_INICIO && s(l.FECHA_INICIO) < s(c.FECHA_INICIO)) fl.push(aviso('Empieza antes que su competición.'));
        }
        var empieza = l.FECHA_INICIO || primerDia(c.FECHA_INICIO, l.DIA_SEMANA);
        return { titulo: s(l.NOMBRE || l.ID), ficha: ['LIGAS', l.ID], faltan: fl, arreglos: todos(fl, { texto: 'Ponerlo', tabla: 'LIGAS', id: s(l.ID) }), quitar: quitarLiga(d, l),
          sub: [s(l.DIA_SEMANA), l.NIVEL ? 'nivel ' + l.NIVEL : '', empieza ? 'empieza el ' + fecha(empieza) + (l.FECHA_INICIO ? '' : ' (con la competición)') : '', entero(l.NUM_JORNADAS) ? pl(entero(l.NUM_JORNADAS), 'jornada', 'jornadas') : '',
            l.ID_GESTOR ? d.nombre('STAFF', l.ID_GESTOR) : ''].filter(String).join(' · ') };
      });
      var ar = todos(fa, { texto: 'Ponerlo', tabla: 'COMPETICIONES', id: s(c.ID) }), pc = parecida(xa, c), nomAnt = ant ? s(ant.NOMBRE) : '';
      // Lo normal es que se mantenga lo del año pasado (Javi): se propone con un toque.
      if (pc && entero(pc.PARTIDOS_EQUIPO)) ar['Faltan los partidos por equipo.'] = { texto: 'Poner ' + pc.PARTIDOS_EQUIPO + ', como en ' + nomAnt, tabla: 'COMPETICIONES', id: s(c.ID), cambios: { PARTIDOS_EQUIPO: Number(pc.PARTIDOS_EQUIPO) } };
      if (pc && !vacio(pc.SENAL)) ar['Falta la señal.'] = { texto: 'Poner ' + euros(pc.SENAL) + ', como en ' + nomAnt, tabla: 'COMPETICIONES', id: s(c.ID), cambios: { SENAL: Number(pc.SENAL) } };
      ar['Va incluida, pero no dice de qué competición salen sus equipos.'] = { texto: 'Decir de cuál sale', tabla: 'COMPETICIONES_ORIGEN', valores: { ID_COMPETICION: s(c.ID) } };
      ar['Sin ligas.'] = { texto: 'Añadir una liga', tabla: 'LIGAS', valores: { ID_COMPETICION: s(c.ID) } };
      // Sin ligas pero con equipos apuntados (no se puede quitar): se dice por qué, en palabras (Javi).
      var q = quitarComp(d, c, nomC(c)), neq = (d.ins || []).filter(function (i) { return s(i.ID_COMPETICION) === s(c.ID); }).length;
      return { titulo: nomC(c), ficha: ['COMPETICIONES', c.ID], faltan: fa, hijas: hijas, arreglos: ar, quitar: q, traer: paraTraer(d, xa, x, c), comp: c,
        enlaces: ors.map(function (o) { return { texto: 'Sale de ' + d.nombre('COMPETICIONES', o.id) + ' (' + o.criterio.toLowerCase() + ')', ficha: ['COMPETICIONES_ORIGEN', o.fila] }; }),
        porQue: !q && !ls.length && neq ? 'No se puede quitar: tiene ' + pl(neq, 'equipo apuntado', 'equipos apuntados') + '.' : '',
        verEquipos: !q && !ls.length && neq ? { tem: s(tem.ID), comp: s(c.ID) } : null,
        sub: [s(c.TIPO), c.FECHA_INICIO ? fecha(c.FECHA_INICIO) + ' – ' + fecha(c.FECHA_FIN) : '', c.INCLUIDA === true ? 'incluida' : '',
          entero(c.PARTIDOS_EQUIPO) ? c.PARTIDOS_EQUIPO + ' partidos por equipo' : '', !vacio(c.SENAL) ? 'señal ' + euros(c.SENAL) : '',
          entero(c.DESCANSO_CADA) ? 'descanso para recuperar cada ' + entero(c.DESCANSO_CADA) + ' jornadas' : '',
          ''].filter(String).join(' · '),
        botones: ls.length ? [{ texto: 'Otra liga', tabla: 'LIGAS', valores: { ID_COMPETICION: s(c.ID) } }] : [] };
    });
    pasos.push({ n: 2, id: 'COMPETICIONES', titulo: 'Competiciones y ligas', estado: estadoDe(x.comps.length, nFaltan(items2)),
      resumen: x.comps.length ? pl(x.comps.length, 'competición', 'competiciones') + ' · ' + pl(x.ligas.length, 'liga', 'ligas') : 'Ninguna todavía',
      items: items2, botones: [{ texto: 'Añadir competición', tabla: 'COMPETICIONES', valores: { ID_TEMPORADA: s(tem.ID), SENAL: 100 } }], traerComps: paraTraerComps(d, xa, x),
      nota: 'Una copa o un torneo a mitad de temporada también se añade aquí. La señal propuesta es de 100 €: cámbiala si hace falta.',
      ref: xa ? xa.comps.map(function (c) {
        var ls = xa.ligas.filter(function (l) { return s(l.ID_COMPETICION) === s(c.ID); });
        return corto(c) + ' (' + s(c.TIPO).toLowerCase() + (c.INCLUIDA === true ? ', incluida' : '') + (entero(c.PARTIDOS_EQUIPO) ? ', ' + c.PARTIDOS_EQUIPO + ' partidos' : '') + ')' +
          (ls.length ? ': ' + ls.map(function (l) { return s(l.NOMBRE) + (l.DIA_SEMANA ? ' (' + s(l.DIA_SEMANA).toLowerCase() + ')' : ''); }).join(', ') : ': sin ligas');
      }) : [], refCorto: xa ? lista(xa.comps.map(corto)) : '' });

    /* 3 · Campos y horarios. */
    // El precio por hora de un campo el año pasado (para proponerlo, Javi), o null.
    var precioCampo = function (campo) { return xa ? xa.ctps.filter(function (y) { return s(y.ID_CAMPO) === s(campo) && !vacio(y.PRECIO_HORA); })[0] || null : null; };
    var items3 = x.ctps.map(function (c) {
      var fa = [], fr = (d.dispo || []).filter(function (f) { return s(f.ID_CAMPO_TEMPORADA) === s(c.ID); });
      // Contratado, con su precio y con lo que da el colegio (Javi: un campo sin disponibilidad no tiene sentido).
      if (c.ESTADO === 'Contratado') {
        if (vacio(c.PRECIO_HORA)) fa.push('Sin precio por hora.');
        if (!fr.length) fa.push('Sin los días y horas que da el colegio.');
      }
      var ar = {}, pa = precioCampo(c.ID_CAMPO);
      ar['Sin los días y horas que da el colegio.'] = { texto: 'Añadirlos', tabla: 'DISPONIBILIDAD_CAMPOS', valores: { ID_CAMPO_TEMPORADA: s(c.ID) } };
      ar['Sin precio por hora.'] = pa ? { texto: 'Poner ' + euros(pa.PRECIO_HORA) + '/hora, como en ' + s(ant.NOMBRE), tabla: 'CAMPOS_TEMPORADA', id: s(c.ID), cambios: { PRECIO_HORA: Number(pa.PRECIO_HORA), TIPO_IVA: s(pa.TIPO_IVA) } } :
        { texto: 'Ponerlo', tabla: 'CAMPOS_TEMPORADA', id: s(c.ID) };
      // Lo que da el colegio, cada franja para abrirla: «jue 20:00–23:00» (con sus fechas, si no es toda la temporada).
      var enl = fr.slice().sort(function (a, b) { return DIAS.indexOf(a.DIA_SEMANA) - DIAS.indexOf(b.DIA_SEMANA) || s(a.HORA_DESDE).localeCompare(s(b.HORA_DESDE)); }).map(function (f) {
        return { texto: s(f.DIA_SEMANA).slice(0, 3).toLowerCase() + ' ' + s(f.HORA_DESDE) + '–' + s(f.HORA_HASTA) + (f.FECHA_DESDE ? ' desde el ' + fecha(f.FECHA_DESDE).slice(0, 5) : '') + (f.FECHA_HASTA ? ' hasta el ' + fecha(f.FECHA_HASTA).slice(0, 5) : ''),
          ficha: ['DISPONIBILIDAD_CAMPOS', s(f.ID)] };
      });
      return { titulo: d.nombre('CAMPOS', c.ID_CAMPO), ficha: ['CAMPOS_TEMPORADA', c.ID], faltan: fa, arreglos: ar, enlaces: enl,
        sub: [s(c.ESTADO), !vacio(c.PRECIO_HORA) ? euros(c.PRECIO_HORA) + '/hora' : '', fr.length ? 'lo da el colegio:' : ''].filter(String).join(' · '),
        botones: c.ESTADO === 'Contratado' && fr.length ? [{ texto: 'Otro día u hora', tabla: 'DISPONIBILIDAD_CAMPOS', valores: { ID_CAMPO_TEMPORADA: s(c.ID) } }] : [] };
    });
    var compDe = {}; x.comps.forEach(function (c) { compDe[s(c.ID)] = c; });
    var repetida = function (l) { return x.ligas.filter(function (o) { return s(o.NOMBRE) === s(l.NOMBRE); }).length > 1; };
    var items3l = x.ligas.map(function (l) {
      // Los horarios se eligen en el cuadrante del día de la liga (Javi: hay que ver qué está libre).
      var e = horariosLiga(d, x, l, compDe[s(l.ID_COMPETICION)]), nuevo = { texto: 'Elegir horarios', horarios: s(l.ID) };
      var ar = todos(e.faltan, { texto: 'Revisar la liga', tabla: 'LIGAS', id: s(l.ID) });
      ar['Sin horarios.'] = nuevo;
      // Un campo que no está contratado esa temporada: se contrata (su fila de la temporada o una nueva).
      Object.keys(e.campos).forEach(function (k) {
        var c = x.ctps.filter(function (y) { return s(y.ID_CAMPO) === e.campos[k]; })[0];
        var pa = precioCampo(e.campos[k]);
        ar[k] = c ? { texto: 'Contratarlo', tabla: 'CAMPOS_TEMPORADA', id: s(c.ID) } : { texto: 'Contratarlo' + (pa ? ' a ' + euros(pa.PRECIO_HORA) + '/hora, como en ' + s(ant.NOMBRE) : ''), tabla: 'CAMPOS_TEMPORADA', ya: pa ? true : undefined,
          valores: Object.assign({ ID_TEMPORADA: s(tem.ID), ID_CAMPO: e.campos[k], ESTADO: 'Contratado' }, pa ? { PRECIO_HORA: Number(pa.PRECIO_HORA), TIPO_IVA: s(pa.TIPO_IVA) } : {}) };
      });
      return { titulo: s(l.NOMBRE || l.ID) + (repetida(l) && compDe[s(l.ID_COMPETICION)] ? ' · ' + corto(compDe[s(l.ID_COMPETICION)]) : ''), ficha: ['LIGAS', l.ID], faltan: e.faltan, ideal: e.ideal, arreglos: ar, quitar: quitarLiga(d, l),
        sub: [s(l.DIA_SEMANA), pl(e.horarios, 'horario', 'horarios'), e.cabe].filter(String).join(' · '),
        botones: e.horarios ? [Object.assign({}, nuevo, { texto: 'Cambiar sus horarios' })] : [], liga: l, comp: compDe[s(l.ID_COMPETICION)] };
    });
    var hayCampos = x.ctps.filter(function (c) { return c.ESTADO === 'Contratado'; }).length;
    pasos.push({ n: 3, id: 'CAMPOS', titulo: 'Campos y horarios', estado: estadoDe(x.ctps.length || x.huecos.length, nFaltan(items3) + nFaltan(items3l) + (x.ctps.length && !hayCampos ? 1 : 0)),
      resumen: x.ctps.length || x.huecos.length ? pl(hayCampos, 'campo contratado', 'campos contratados') + ' · ' + pl(x.huecos.length, 'horario', 'horarios') : 'Ninguno todavía',
      items: items3, grupos: [{ titulo: 'Horarios de cada liga', items: items3l }], traerCampos: paraTraerCampos(d, xa, x),
      botones: [{ texto: 'Añadir campo a la temporada', tabla: 'CAMPOS_TEMPORADA', valores: { ID_TEMPORADA: s(tem.ID) } }, { texto: 'Campo nuevo (que aún no existe)', tabla: 'CAMPOS', valores: {} }, { texto: 'Instalación nueva', tabla: 'INSTALACIONES', valores: {} }],
      nota: 'Cada liga dice cuántos equipos caben con sus horarios y los partidos por equipo de su competición.',
      ref: xa ? xa.ctps.filter(function (c) { return c.ESTADO === 'Contratado'; }).map(function (c) {
        var n = xa.huecos.filter(function (h) { return s(h.ID_CAMPO) === s(c.ID_CAMPO); }).length;
        return d.nombre('CAMPOS', c.ID_CAMPO) + (vacio(c.PRECIO_HORA) ? '' : ': ' + euros(c.PRECIO_HORA) + '/hora') + (n ? ' · ' + pl(n, 'horario', 'horarios') : '');
      }) : [], refCorto: xa ? lista(xa.ctps.filter(function (c) { return c.ESTADO === 'Contratado'; }).map(function (c) { return d.nombre('CAMPOS', c.ID_CAMPO); })) : '' });

    /* 4 · Tarifas, camisetas y premios. */
    var tarifa = function (lista, c) { return lista.filter(function (t) { return t.CONCEPTO === 'Inscripción equipo' && s(t.REF_ID) === s(c.ID); }); };
    var de = function (lista, c) { return (lista || []).filter(function (r) { return s(r.ID_COMPETICION) === s(c.ID); }); };
    var items4 = x.comps.map(function (c) {
      var fa = [], ta = tarifa(x.tarifas, c), mo = de(d.modelosComp, c), pk = de(d.packs, c), pr = de(d.premios, c);
      // Una incluida (una copa) no se cobra, usa las camisetas de la suya y no necesita premios propios (Javi).
      if (c.INCLUIDA !== true) {
        if (!ta.length) fa.push('Sin tarifa de inscripción.');
        if (!mo.length) fa.push('Sin modelo de camiseta.');
        if (!pk.length) fa.push('Sin pack de camisetas.');
        if (!pr.length) fa.push('Sin premios.');
      }
      var ar = {};
      var pt = ultimaTarifa(parecida(xa, c) ? tarifa(xa.tarifas, parecida(xa, c)) : []);
      // Con lo del año pasado, de un toque (con «Deshacer»); sin él, la ficha (Javi).
      ar['Sin tarifa de inscripción.'] = { texto: pt ? 'Poner ' + euros(pt.PRECIO) + ', como en ' + s(ant.NOMBRE) : 'Poner el precio', tabla: 'TARIFAS', ya: pt ? true : undefined,
        valores: Object.assign({ ID_TEMPORADA: s(tem.ID), CONCEPTO: 'Inscripción equipo', REF_ID: s(c.ID), FECHA_DESDE: s(tem.FECHA_INICIO) }, pt ? { PRECIO: Number(pt.PRECIO), TIPO_IVA: s(pt.TIPO_IVA) } : {}) };
      // El modelo cambia cada temporada (los sponsors) y suele ser uno para varias: se elige o se crea en un panel (Javi).
      ar['Sin modelo de camiseta.'] = { texto: 'Elegir o crear el modelo', tp: 'modelo', tabla: 'MODELOS_COMPETICION', valores: { ID_COMPETICION: s(c.ID) } };
      ar['Sin pack de camisetas.'] = { texto: 'Añadir un dorsal', tabla: 'PACKS', valores: { ID_COMPETICION: s(c.ID) } };
      // El pack, de un toque, el del año pasado; el modelo cambia (los sponsors), pero las camisetas incluidas suelen ser las mismas.
      var pc4 = parecida(xa, c), pk4 = pc4 ? de(d.packs, pc4) : [], mo4 = pc4 ? de(d.modelosComp, pc4)[0] : null;
      if (pk4.length) ar['Sin pack de camisetas.'] = { texto: 'Traer el pack de ' + s(ant.NOMBRE) + ' (' + pl(pk4.length, 'dorsal', 'dorsales') + ')', pack: { comp: s(c.ID), de: s(pc4.ID) } };
      ar['Sin premios.'] = { texto: 'Añadir un premio', tabla: 'PREMIOS', valores: { ID_COMPETICION: s(c.ID) } };
      var modDe = function (id) { return (d.modelos || []).filter(function (x) { return s(x.ID) === s(id); })[0] || {}; };
      var enl = ta.map(function (t) { return { texto: 'Inscripción ' + euros(t.PRECIO) + (ta.length > 1 && t.FECHA_DESDE ? ' desde el ' + fecha(t.FECHA_DESDE) : ''), ficha: ['TARIFAS', s(t.ID)] }; })
        .concat(mo.map(function (m) { var x = modDe(m.ID_MODELO); return { texto: 'Modelo ' + (x.NOMBRE || m.ID_MODELO) + (x.DISENO_URL ? '' : ' · sin diseño'), ficha: ['MODELOS', s(m.ID_MODELO)], falta: !x.DISENO_URL }; }))
        .concat(pk.length ? [{ texto: 'Pack: ' + pl(pk.length, 'dorsal', 'dorsales'), ficha: ['COMPETICIONES', s(c.ID)] }] : [])
        .concat(pr.map(function (p) { return { texto: 'Premio: ' + s(p.NOMBRE), ficha: ['PREMIOS', s(p.ID)] }; }));
      return { titulo: nomC(c), ficha: ['COMPETICIONES', c.ID], faltan: fa, arreglos: ar, enlaces: enl,
        sub: c.INCLUIDA === true ? 'incluida: no se cobra' : '' };
    });
    var cam = x.tarifas.filter(function (t) { return t.CONCEPTO === 'Camiseta'; });
    var camAnt = ultimaTarifa(xa ? xa.tarifas.filter(function (t) { return t.CONCEPTO === 'Camiseta'; }) : []);
    items4.push({ titulo: 'Camiseta personalizada', faltan: cam.length ? [] : ['Sin tarifa de camiseta personalizada.'], ficha: cam[0] ? ['TARIFAS', cam[0].ID] : null,
      sub: (cam.length ? cam.map(function (t) { return euros(t.PRECIO) + ' sin IVA'; }).join(' / ') + ' · ' : '') + 'la que no entra en el pack y se paga aparte',
      arreglos: { 'Sin tarifa de camiseta personalizada.': { texto: camAnt ? 'Poner ' + euros(camAnt.PRECIO) + ', como en ' + s(ant.NOMBRE) : 'Poner el precio', tabla: 'TARIFAS', ya: camAnt ? true : undefined,
        valores: Object.assign({ ID_TEMPORADA: s(tem.ID), CONCEPTO: 'Camiseta', FECHA_DESDE: s(tem.FECHA_INICIO) }, camAnt ? { PRECIO: Number(camAnt.PRECIO), TIPO_IVA: s(camAnt.TIPO_IVA) } : {}) } } });
    // Las tarifas del staff valen por sus fechas y no se revisan al preparar la temporada (Javi).
    pasos.push({ n: 4, id: 'TARIFAS', titulo: 'Tarifas, camisetas y premios', estado: estadoDe(x.comps.length, nFaltan(items4)),
      resumen: x.comps.length ? (nFaltan(items4) ? pl(nFaltan(items4), 'cosa por hacer', 'cosas por hacer') : 'Todo puesto') : 'Primero, las competiciones',
      items: x.comps.length ? items4 : [], botones: [], modelo: modeloTemporada(d, xa, x),
      nota: 'Un modelo nuevo por los sponsors de la temporada; después se pone en cada competición con «Añadir modelo».',
      ref: xa ? xa.comps.map(function (c) {
        var ta = tarifa(xa.tarifas, c), mo = de(d.modelosComp, c), pr = de(d.premios, c);
        return corto(c) + ': ' + [c.INCLUIDA === true ? 'incluida' : ta.length ? 'inscripción ' + ta.map(function (t) { return euros(t.PRECIO); }).join(' / ') : 'sin tarifa',
          mo.length ? mo.map(function (m) { return d.nombre('MODELOS', m.ID_MODELO); }).join(', ') : '', pr.length ? pr.map(function (p) { return s(p.NOMBRE); }).join(', ') : ''].filter(String).join(' · ');
      }).concat(xa.tarifas.filter(function (t) { return t.CONCEPTO === 'Camiseta'; }).map(function (t) { return 'Camiseta personalizada: ' + euros(t.PRECIO); })) : [],
      refCorto: xa ? lista(xa.comps.map(function (c) { var ta = tarifa(xa.tarifas, c); return ta.length ? corto(c) + ' ' + euros(ta[ta.length - 1].PRECIO) : ''; }).filter(String)) : '' });

    /* 5 · Inscripciones: las competiciones a las que se apuntan equipos (no las incluidas ni las que salen de otra). */
    var abiertas = x.comps.filter(function (c) { return seApuntan(d, c); });
    var cuenta = function (xx, c) {
      var is = xx.ins.filter(function (i) { return s(i.ID_COMPETICION) === s(c.ID); });
      return { conf: is.filter(function (i) { return i.ESTADO === 'Confirmada'; }).length, sol: is.filter(function (i) { return i.ESTADO !== 'Confirmada'; }).length, todas: is };
    };
    var items5 = abiertas.map(function (c) {
      var k = cuenta(x, c), fa = [], ar = {};
      if (!k.todas.length) fa.push('Sin equipos apuntados todavía.');
      else if (k.sol) {
        var t5 = pl(k.sol, 'equipo por confirmar', 'equipos por confirmar') + '.';
        fa.push(t5);
        // Se confirman en Gestión: el enlace la abre en esa competición, en los que faltan (Javi: «a medias» sin nada que tocar no sirve).
        ar[t5] = { texto: 'Verlos en Gestión', seccion: 'GESTION', href: '?s=gestion&tem=' + encodeURIComponent(s(tem.ID)) + '&comp=' + encodeURIComponent(s(c.ID)) + '&filtro=solicitadas' };
      }
      return { titulo: nomC(c), faltan: fa, arreglos: ar, sub: pl(k.conf, 'confirmado', 'confirmados') + (k.sol ? ' · ' + k.sol + ' por confirmar' : '') };
    });
    var nIns = x.ins.length;
    pasos.push({ n: 5, id: 'INSCRIPCIONES', titulo: 'Inscripciones', estado: estadoDe(nIns, nFaltan(items5)),
      resumen: nIns ? pl(x.ins.filter(function (i) { return i.ESTADO === 'Confirmada'; }).length, 'equipo confirmado', 'equipos confirmados') : 'Ningún equipo todavía',
      items: items5, nota: 'Los equipos se apuntan con los formularios y se confirman en Gestión, al pagar la señal.',
      ref: xa ? xa.comps.filter(function (c) { return seApuntan(d, c); }).map(function (c) { return corto(c) + ': ' + pl(cuenta(xa, c).conf, 'equipo', 'equipos'); }) : [] });

    /* 6 · Repartir los equipos y cerrar las ligas (T0304). */
    var conf = x.ins.filter(function (i) { return i.ESTADO === 'Confirmada' && abiertas.some(function (c) { return s(c.ID) === s(i.ID_COMPETICION); }); });
    var sinLiga = conf.filter(function (i) { return !i.ID_LIGA; });
    pasos.push({ n: 6, id: 'REPARTIR', titulo: 'Cada equipo en su liga', estado: estadoDe(conf.length, sinLiga.length),
      resumen: conf.length ? (sinLiga.length ? pl(sinLiga.length, 'equipo sin liga', 'equipos sin liga') : 'Todos los equipos tienen liga') : 'Sin equipos confirmados',
      items: abiertas.map(function (c) {
        var n = sinLiga.filter(function (i) { return s(i.ID_COMPETICION) === s(c.ID); }).length;
        var t6 = pl(n, 'equipo confirmado sin liga', 'equipos confirmados sin liga') + '.', ar6 = {};
        ar6[t6] = { texto: 'Verlos en Gestión', seccion: 'GESTION', href: '?s=gestion&tem=' + encodeURIComponent(s(tem.ID)) + '&comp=' + encodeURIComponent(s(c.ID)) + '&filtro=sinliga' };
        return { titulo: nomC(c), faltan: n ? [t6] : [], arreglos: ar6, sub: '' };
      }).filter(function (it) { return it.faltan.length; }),
      nota: 'Repartir los equipos entre las ligas y cerrarlas se hará aquí en una próxima versión.', ref: [] });

    /* 7 · Calendario de cada liga (las de eliminatorias no se generan). */
    var gen = x.ligas.filter(function (l) { var c = compDe[s(l.ID_COMPETICION)]; return c && SIN_GENERAR.indexOf(s(c.TIPO)) < 0; });
    var P = d.partidos, items7 = gen.map(function (l) {
      var n = P ? P[s(l.ID)] || 0 : 0;
      return { titulo: s(l.NOMBRE || l.ID), faltan: P && !n ? ['Sin calendario.'] : [], sub: P === undefined ? 'mirando…' : P === null ? 'no se ha podido mirar' : n ? pl(n, 'partido', 'partidos') : '' };
    });
    var conCal = P ? gen.filter(function (l) { return P[s(l.ID)]; }).length : 0;
    pasos.push({ n: 7, id: 'CALENDARIO', titulo: 'Calendario de cada liga', estado: P === undefined && gen.length ? 'mirando' : !gen.length || !conCal ? 'pendiente' : conCal < gen.length ? 'medias' : 'hecho',
      resumen: !gen.length ? 'Sin ligas' : P === undefined ? 'Mirando…' : P === null ? 'No se ha podido mirar' : conCal + ' de ' + pl(gen.length, 'liga', 'ligas') + ' con calendario',
      items: items7, botones: gen.length ? [{ texto: 'Generar el calendario de una liga', accion: 'CALENDARIO' }] : [],
      nota: 'Las copas y las supercopas no se generan: dependen de quién pasa.', ref: [] });

    /* 9 · Las ligas en marcha: lo que no cuadra en una liga que ya se juega (va en «Y después», Javi). */
    pasos.push(enMarcha(d, x, compDe, tem));

    /* 8 · Avisar a las capitanas (T0304). */
    pasos.push({ n: 8, id: 'AVISAR', titulo: 'Avisar a las capitanas', estado: 'luego', resumen: 'Su liga y su calendario', items: [],
      nota: 'Mandar a cada capitana su liga y su calendario se hará aquí en una próxima versión.', ref: [] });

    // Sin claves vacías en los botones (ya: undefined).
    pasos.forEach(function (p) { [].concat(p.items, [].concat.apply([], (p.grupos || []).map(function (g) { return g.items; }))).forEach(function limpia(it) {
      Object.keys(it.arreglos || {}).forEach(function (k) { var b = it.arreglos[k]; if (b && b.ya === undefined) delete b.ya; }); (it.hijas || []).forEach(limpia);
    }); });
    return { tem: tem, ant: ant, pasos: pasos, x: x };
  }

  /** Por defecto, la más nueva (la que se está preparando): lista, la de A.periodos(), de la más nueva a la más vieja. */
  function porDefecto(lista) { return lista[0] ? lista[0].id : ''; }
  /**
   * Las temporadas que se pueden preparar: las que no han acabado (la que está en curso y las que vienen), hoy 'aaaa-mm-dd'.
   * Las acabadas no salen (Javi): sus avisos no sirven de nada; quedan como referencia de la siguiente y en «Todas las tablas».
   */
  function porPreparar(lista, hoy) { return lista.filter(function (p) { return !p.hasta || p.hasta >= hoy; }); }

  var CALC = { ideal: ideal, anterior: anterior, camino: camino, horariosLiga: horariosLiga, porDefecto: porDefecto, porPreparar: porPreparar, primerDia: primerDia, calendarioTemporada: calendarioTemporada, periodosCal: periodosCal, masDias: masDias, paraTraerFestivos: paraTraerFestivos, enMarcha: enMarcha, modeloTemporada: modeloTemporada, masUnAno: masUnAno, subirAnos: subirAnos, paraTraerComps: paraTraerComps, paraTraerCampos: paraTraerCampos, cuadranteDia: cuadranteDia, cabeEn: cabeEn, parecida: parecida, paraTraer: paraTraer, choque: choque, esAviso: esAviso, quitarComp: quitarComp, quitarLiga: quitarLiga };
  if (typeof window === 'undefined' || !window.UN || !window.UN.ajustes) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  function texto(v) { return s(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem('kon_cam_' + k) || ''; localStorage.setItem('kon_cam_' + k, v); } catch (e) {} return ''; }
  var TABLAS = ['TEMPORADAS', 'COMPETICIONES', 'COMPETICIONES_ORIGEN', 'LIGAS', 'HUECOS', 'CAMPOS_TEMPORADA', 'DISPONIBILIDAD_CAMPOS', 'CAMPOS', 'TARIFAS',
    'MODELOS', 'MODELOS_COMPETICION', 'PACKS', 'PREMIOS', 'INSCRIPCIONES_EQUIPOS', 'STAFF', 'CALENDARIO'];
  var ESTADO = { hecho: ['Hecho', 'aj-as-hecho'], medias: ['A medias', 'aj-as-medias'], pendiente: ['Sin empezar', 'aj-as-pendiente'], luego: ['Próximamente', 'aj-as-luego'], mirando: ['Mirando…', 'aj-as-luego'] };
  // Las pantallas del asistente: los cuatro pasos que se hacen aquí y «Y después» con lo que va fuera (5 a 8).
  var PANTALLAS = [
    { id: 'TEMPORADA', corto: 'Temporada', pregunta: function () { return '¿Cuándo empieza y acaba la temporada?'; },
      ayuda: 'Del primer al último día. No puede pisarse con otra temporada.' },
    { id: 'COMPETICIONES', corto: 'Competiciones', pregunta: function (t) { return '¿Qué competiciones tendrá la ' + t + '?'; },
      ayuda: 'Cada competición con sus fechas y sus ligas (día, nivel y gestor). Las ligas empiezan con su competición, cada una su día. Una copa o un torneo a mitad de temporada también va aquí.' },
    { id: 'CAMPOS', corto: 'Campos y horarios', pregunta: function () { return '¿Dónde y a qué hora se juega?'; },
      ayuda: 'Los campos contratados, lo que da cada uno y los horarios de cada liga. Cada liga dice cuántos equipos le caben.' },
    { id: 'TARIFAS', corto: 'Precios y camisetas', pregunta: function () { return '¿Cuánto cuesta y qué incluye?'; },
      ayuda: 'El precio de la inscripción y los premios de cada competición; el modelo de camiseta (los sponsors) y el pack (las camisetas que entran con la inscripción: cada dorsal con su talla). La camiseta personalizada es la que se paga aparte.' },
    { id: 'DESPUES', corto: 'Y después', pregunta: function () { return 'Equipos, calendario y ligas en marcha'; },
      ayuda: 'Cuando la temporada está preparada: los equipos se apuntan y se confirman (en Gestión), cada uno va a su liga y se saca el calendario. Si una liga en marcha tiene algo que no cuadra, sale aquí.' }
  ];
  var DESPUES = { INSCRIPCIONES: 'Se apuntan con los formularios y se confirman en Gestión, al pagar la señal.', REPARTIR: 'La liga de cada equipo se pone en Gestión.',
    CALENDARIO: 'Las copas y las supercopas no se generan: dependen de quién pasa.', AVISAR: 'Llegará en una próxima versión.',
    MARCHA: 'Lo que no cuadra en una liga que ya se juega: equipos de más, jornadas o horarios fuera de lo que da el colegio.' };
  var fin = null;

  window.UN.ajustes('TEMPORADA', {
    abrir: function (el, ctx) {
      var A = ctx.ajustes, T = ctx.tablas, vivo = true, tid = guardado('temp'), paso = '', partidos, pidiendo = false, pend = null;
      fin = function () { vivo = false; if (pend) clearTimeout(pend); };

      function datos() {
        return { temporadas: T.filas('TEMPORADAS') || [], comps: T.filas('COMPETICIONES') || [], origen: T.filas('COMPETICIONES_ORIGEN') || [], ligas: T.filas('LIGAS') || [],
          huecos: T.filas('HUECOS') || [], calendario: T.filas('CALENDARIO') || [], ctps: T.filas('CAMPOS_TEMPORADA') || [], dispo: T.filas('DISPONIBILIDAD_CAMPOS') || [], tarifas: T.filas('TARIFAS') || [],
          modelosComp: T.filas('MODELOS_COMPETICION') || [], modelos: T.filas('MODELOS') || [], packs: T.filas('PACKS') || [], premios: T.filas('PREMIOS') || [], ins: T.filas('INSCRIPCIONES_EQUIPOS') || [],
          partidos: partidos, partidosDia: partidosDia[tid], nombre: A.nombre };
      }
      /** Los partidos de la temporada, por día (ligasPartidosTemporada), para el calendario del paso 1. Una vez por temporada. */
      var partidosDia = {}, pidiendoDia = {};
      function mirarPartidosDia(t) {
        if (!t || partidosDia[t] || pidiendoDia[t]) return;
        pidiendoDia[t] = true;
        ctx.llamar('ligasPartidosTemporada', [t]).then(function (r) { partidosDia[t] = r || {}; pidiendoDia[t] = false; if (vivo) pintar(); },
          function () { pidiendoDia[t] = false; });
      }
      /** Los partidos de cada liga los cuenta el motor (ligasCalendarioLigas, la misma del calendario): PARTIDOS no se baja. */
      function mirarPartidos() {
        if (pidiendo) return;
        pidiendo = true;
        ctx.llamar('ligasCalendarioLigas', []).then(function (r) {
          pidiendo = false;
          var o = {};
          ((r && r.temporadas) || []).forEach(function (t) { t.competiciones.forEach(function (c) { c.ligas.forEach(function (l) { o[l.ID] = l.partidos; }); }); });
          partidos = o; if (vivo) pintar();
        }, function () { pidiendo = false; partidos = null; if (vivo) pintar(); });
      }

      /** ¿Ve quien entra esa sección? (para enlazarla) */
      function ve(id) { return (ctx.secciones || []).some(function (x) { return x.id === id; }); }
      /** Un botón que abre una ficha (id), una nueva (valores) u otra acción. '' si no se puede (solo lectura). */
      function boton(b, clase) {
        if (!b) return '';
        if (b.accion) return '<button type="button" class="u-btn ' + (clase || '') + '" data-as-accion="' + texto(b.accion) + '">' + texto(b.texto) + ' ›</button>';
        if (b.horarios) return ctx.soloLeer ? '' : '<button type="button" class="u-btn ' + (clase || 'u-btn-texto') + '" data-as-horarios="' + texto(b.horarios) + '">' + texto(String(b.texto).replace(/^\+ /, '')) + '</button>';
        if (b.dia) return '<button type="button" class="u-btn ' + (clase || 'u-btn-texto') + '" data-as-cal="' + texto(b.dia) + '">' + texto(b.texto) + '</button>';
        if (b.tp) return ctx.soloLeer ? '' : '<button type="button" class="u-btn ' + (clase || 'u-btn-texto') + '" data-as-tp="' + texto(b.tp) + '">' + texto(b.texto) + '</button>';
        if (b.seccion) return ve(b.seccion) ? '<a class="u-btn ' + (clase || 'u-btn-texto') + '" href="' + texto(b.href) + '" data-sx="' + texto(b.seccion) + '">' + texto(b.texto) + ' ›</a>' : '';
        if (b.pack) return ctx.soloLeer ? '' : '<button type="button" class="u-btn ' + (clase || 'u-btn-texto') + '" data-as-pack="' + texto(b.pack.comp + '|' + b.pack.de) + '">' + texto(b.texto) + '</button>';
        if (b.ya && b.valores) return ctx.soloLeer || !A.puede(b.tabla) ? '' : '<button type="button" class="u-btn ' + (clase || 'u-btn-texto') + '" data-as-crearya="' + texto(b.tabla) +
          '" data-as-valores="' + texto(JSON.stringify(b.valores)) + '">' + texto(b.texto) + '</button>';
        if (b.cambios) return ctx.soloLeer ? '' : '<button type="button" class="u-btn ' + (clase || 'u-btn-texto') + '" data-as-cambiar="' + texto(b.tabla) + '" data-as-id="' + texto(b.id) +
          '" data-as-valores="' + texto(JSON.stringify(b.cambios)) + '">' + texto(b.texto) + '</button>';
        if (b.id) return '<button type="button" class="u-btn ' + (clase || 'u-btn-texto') + '" data-as-ficha="' + texto(b.tabla) + '" data-as-id="' + texto(b.id) + '">' + texto(b.texto) + '</button>';
        if (ctx.soloLeer || !A.puede(b.tabla)) return '';
        return '<button type="button" class="u-btn ' + (clase || 'u-btn-texto') + '" data-as-nueva="' + texto(b.tabla) + '" data-as-valores="' + texto(JSON.stringify(b.valores || {})) + '">' + texto(b.texto) + '</button>';
      }
      /** Una fila: su nombre (abre su ficha), lo que es, ✓ si está bien o cada aviso con el botón que lo resuelve. */
      function fila(it) {
        var fa = it.faltan || [], ok = !fa.length, mal = fa.some(esAviso);
        return '<li class="aj-as-f' + (ok ? ' aj-as-ok' : mal ? ' aj-as-mal' : ' aj-as-falta') + '"><span class="aj-as-i" aria-hidden="true">' + (ok ? '✓' : mal ? '!' : '') + '</span><div class="aj-as-c">' +
          '<div class="aj-as-t">' + (it.ficha ? '<button type="button" class="u-btn u-btn-texto aj-as-nom" data-as-ficha="' + texto(it.ficha[0]) + '" data-as-id="' + texto(it.ficha[1]) + '">' + texto(it.titulo) + '</button>' :
            '<b class="aj-as-nom">' + texto(it.titulo) + '</b>') + (it.sub ? '<small>' + texto(it.sub) + '</small>' : '') + '</div>' +
          (it.calendario ? calendarioHtml(it.calendario) + panelDia(it.calendario) + (tp && tp.tipo === 'dias' ? panelDias() : '') : '') +
          ((it.enlaces || []).length ? '<div class="aj-as-enl">' + it.enlaces.map(function (e) {
            if (e.dias) return '<button type="button" class="aj-as-chipe aj-as-chipp" data-as-periodo="' + texto(e.clave) + '" aria-expanded="' + (periodo === e.clave) + '">' + texto(e.texto) + (periodo === e.clave ? ' ▴' : ' ▾') + '</button>' +
              (periodo === e.clave ? '<div class="aj-as-enl aj-as-dias">' + e.dias.map(function (x) { return '<button type="button" class="aj-as-chipe" data-as-ficha="' + texto(x.ficha[0]) + '" data-as-id="' + texto(x.ficha[1]) + '">' + texto(x.texto) + ' ›</button>'; }).join('') + '</div>' : '');
            return '<button type="button" class="aj-as-chipe' + (e.falta ? ' aj-as-chipf' : '') + '" data-as-ficha="' + texto(e.ficha[0]) + '" data-as-id="' + texto(e.ficha[1]) + '">' + texto(e.texto) + ' ›</button>';
          }).join('') + '</div>' : '') +
          (fa.length ? '<ul class="aj-as-av">' + fa.map(function (f) { return '<li' + (esAviso(f) ? ' class="aj-as-aviso"' : '') + '><span>' + texto(f) + '</span>' + boton((it.arreglos || {})[f]) + '</li>'; }).join('') + '</ul>' : '') +
          (it.liga && hz === s(it.liga.ID) ? panelHorarios(it) : '') +
          (it.traer && !ctx.soloLeer ? (tr && tr.comp === s(it.comp.ID) ? panelTraer(it) : '<p class="aj-as-mas"><button type="button" class="u-btn aj-as-btn" data-as-traer="' + texto(it.comp.ID) + '">' +
            texto('Traer las ligas de la ' + (ultimo.ant ? ultimo.ant.NOMBRE : 'temporada anterior') + ' (' + it.traer.ligas.length + ')') + '</button></p>') : '') +
          (it.porQue ? '<p class="u-nota aj-as-dn">' + texto(it.porQue) + (it.verEquipos && ve('GESTION') ? ' <a href="?s=gestion&tem=' + encodeURIComponent(it.verEquipos.tem) + '&comp=' +
            encodeURIComponent(it.verEquipos.comp) + '" data-sx="GESTION">Ver sus equipos en Gestión ›</a>' : '') + '</p>' : '') +
          (it.hijas && it.hijas.length ? '<ul class="aj-as-lista aj-as-hijas">' + it.hijas.map(fila).join('') + '</ul>' : '') +
          ((it.botones || []).length || puedeQuitar(it) ? '<div class="aj-as-mas">' + (it.botones || []).map(function (b) { return boton(Object.assign({}, b, { texto: '+ ' + b.texto })); }).join('') +
            (puedeQuitar(it) ? botonQuitar(it.quitar) : '') + '</div>' : '') + '</div></li>';
      }
      /* ---------- lo que se acaba de hacer, con «Deshacer» (T0294) ---------- */

      var hecho = null; // { texto, deshacer: function () → promesa }
      function hacer(p, txt, deshacer) {
        hecho = null;
        return p.then(function (r) { if (vivo) { hecho = { texto: typeof txt === 'function' ? txt(r) : txt, deshacer: deshacer ? function () { return deshacer(r); } : null }; pintar(); } return r; },
          function (e) { if (vivo) { ctx.aviso(String((e && e.message) || e).replace(/^\w+:\s*/, '')); pintar(); } throw e; });
      }
      function lineaHecho() {
        return hecho ? '<p class="aj-as-hecho" role="status">✓ ' + texto(hecho.texto) + (hecho.deshacer && !ctx.soloLeer ? ' <button type="button" class="u-btn u-btn-texto" data-as-deshacer>Deshacer</button>' : '') + '</p>' : '';
      }
      /** Lo que se trae en bloque se deshace en el motor (ligasDeshacer: solo filas traídas). tablas: las que hay que volver a leer. */
      function deshacerTraido(ids, tablas) {
        return ctx.llamar('ligasDeshacer', [ids]).then(function (r) {
          return T.refrescar(tablas, true).then(function () { return r; }, function () { return r; });
        });
      }

      /**
       * El día elegido en el calendario (Javi: ver qué hay ese día y, si es festivo con partidos, moverlos): qué es, sus
       * partidos (cada uno, a Ligas para moverlo) y las ligas que juegan ese día sin calendario todavía.
       */
      var diaSel = '';
      function panelDia(c) {
        if (!diaSel) return '';
        var dd = null; c.meses.forEach(function (m) { m.semanas.forEach(function (sm) { sm.forEach(function (x) { if (x && x.fecha === diaSel) dd = x; }); }); });
        if (!dd) return '';
        var mk = dd.marca, sinJugar = mk && (mk.FESTIVO === true || mk.DESCANSO === true), DS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        var x = dd.fecha.split('-').map(Number), nomDia = DS[new Date(Date.UTC(x[0], x[1] - 1, x[2])).getUTCDay()];
        var h = '<div class="aj-as-traer aj-as-dia" id="as-dia"><h4>' + texto(nomDia.charAt(0).toUpperCase() + nomDia.slice(1) + ' ' + fecha(dd.fecha) + (mk ? ' · ' + (mk.FESTIVO === true ? 'Festivo' : 'Descanso') + (mk.MOTIVO ? ': ' + mk.MOTIVO : '') : '')) + '</h4>';
        var activos = dd.partidos.filter(function (p) { return p.ESTADO !== 'Aplazado' && p.ESTADO !== 'Suspendido'; });
        if (sinJugar && activos.length) h += '<p class="aj-as-choca">' + texto('Es un día sin jugar y tiene ' + pl(activos.length, 'partido programado', 'partidos programados') + ': muévelos en Ligas o quita el ' + (mk.FESTIVO === true ? 'festivo' : 'descanso') + '.') + '</p>';
        h += dd.partidos.length ? '<ul class="aj-as-lista aj-as-pdia">' + dd.partidos.map(function (p) {
          return '<li><b>' + texto(p.HORA) + '</b> · ' + texto(p.campo) + ' · ' + texto(p.local + ' – ' + p.visitante) + ' <small>' + texto(p.liga + (p.ESTADO && p.ESTADO !== 'Programado' ? ' · ' + p.ESTADO : '')) + '</small>' +
            (ve('LIGAS') ? ' <a class="u-btn u-btn-texto" href="?s=ligas&partido=' + encodeURIComponent(p.ID) + '" data-sx="LIGAS">Moverlo en Ligas ›</a>' : '') + '</li>';
        }).join('') + '</ul>' : '<p class="u-nota">' + (partidosDia[tid] ? 'No hay partidos este día.' : 'Mirando los partidos…') + '</p>';
        // Las ligas de ese día de la semana sin calendario todavía (Javi: «juegan» en un festivo parecía un solape): no son partidos.
        if (dd.ligas.length) h += '<p class="u-nota">' + texto(lista(dd.ligas.map(function (l) { return A.nombre('LIGAS', l.ID); })) + (dd.ligas.length > 1 ? ' aún no tienen' : ' aún no tiene') + ' calendario. ' +
          (sinJugar ? 'Cuando se haga, este día se salta.' : 'Cuando se haga, ' + (dd.ligas.length > 1 ? 'jugarán' : 'jugará') + ' este día.')) + '</p>';
        return h + '<div class="n-botones">' + (mk ? '<button type="button" class="u-btn" data-as-ficha="CALENDARIO" data-as-id="' + texto(dd.fecha) + '">Cambiar o quitar el ' + (mk.FESTIVO === true ? 'festivo' : 'descanso') + '</button>' :
          (ctx.soloLeer ? '' : '<button type="button" class="u-btn" data-as-nueva="CALENDARIO" data-as-valores="' + texto(JSON.stringify({ FECHA: dd.fecha, DESCANSO: true })) + '">Marcarlo como festivo o descanso</button>')) +
          '<button type="button" class="u-btn u-btn-texto" data-as-diano>Cerrar</button></div></div>';
      }
      /** El calendario de la temporada (como la vista «Calendario» de Festivos): tocar un día enseña lo que hay. */
      function calendarioHtml(c) {
        if (!c.meses.length) return '<p class="u-nota">La temporada no tiene fechas de inicio y fin.</p>';
        var nom = function (l) { return A.nombre('LIGAS', l.ID); };
        return '<p class="aj-cal-ley"><span class="aj-cal-fes">Festivo</span><span class="aj-cal-des">Descanso</span><span><i class="aj-cal-p"></i> hay partidos</span><span class="aj-as-calmal aj-as-calley">!</span><span>partidos en un día sin jugar</span></p>' +
          // Plegado: no es un problema (el calendario pasa esa jornada a la semana siguiente), solo para mirarlo.
          (c.perdidas.length ? '<details class="aj-cal-perdidas aj-as-ref"><summary>' + texto(pl(c.perdidas.length, 'día sin jugar cae', 'días sin jugar caen') + ' en días con ligas: esas jornadas pasan a la semana siguiente. Ver cuáles') + '</summary><ul>' + c.perdidas.map(function (dd) {
            return '<li><button type="button" class="u-btn u-btn-texto" data-as-cal="' + dd.fecha + '">' + dd.fecha.split('-').reverse().join('/') + '</button> ' +
              texto((dd.marca.MOTIVO || (dd.marca.FESTIVO === true ? 'Festivo' : 'Descanso')) + ' · ' + dd.ligas.map(nom).join(', ')) + '</li>';
          }).join('') + '</ul></details>' : '') +
          '<div class="aj-cal aj-as-cal">' + c.meses.map(function (m) {
            return '<section class="aj-cal-mes"><h4>' + texto(m.titulo) + '</h4><table class="aj-cal-t"><thead><tr>' + ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (x) { return '<th>' + x + '</th>'; }).join('') +
              '</tr></thead><tbody>' + m.semanas.map(function (sm) {
                return '<tr>' + sm.map(function (dd) {
                  if (!dd) return '<td></td>';
                  var mk = dd.marca, cl = mk && mk.FESTIVO === true ? 'aj-cal-fes' : mk && mk.DESCANSO === true ? 'aj-cal-des' : '';
                  var tit = mk ? (mk.MOTIVO || '') : '';
                  var np = dd.partidos.length, malo = mk && (mk.FESTIVO === true || mk.DESCANSO === true) && dd.partidos.some(function (p) { return p.ESTADO !== 'Aplazado' && p.ESTADO !== 'Suspendido'; });
                  tit = tit + (np ? (tit ? ' · ' : '') + pl(np, 'partido', 'partidos') : '');
                  return '<td><button type="button" class="aj-cal-d ' + cl + (malo ? ' aj-as-calmal' : '') + (diaSel === dd.fecha ? ' aj-as-calsel' : '') + '" data-as-cal="' + dd.fecha + '" aria-pressed="' + (diaSel === dd.fecha) + '"' + (tit ? ' title="' + texto(tit) + '"' : '') +
                    ' aria-label="' + texto(dd.fecha.split('-').reverse().join('/') + (tit ? ': ' + tit : '')) + '">' + dd.n + (np ? '<i class="aj-cal-p" aria-hidden="true"></i>' : '') + '</button></td>';
                }).join('') + '</tr>';
              }).join('') + '</tbody></table></section>';
          }).join('') + '</div>';
      }

      /* ---------- traer las ligas del año anterior (T0294) ---------- */

      var periodo = ''; // el periodo de festivos desplegado
      var tr = null, ultimo = null, guardandoTr = false; // tr: { comp, de, filas: [{ sel, conH, NOMBRE, DIA_SEMANA, NIVEL, MINUTOS_PARTIDO, huecos }] }
      var DIAS_L = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      function abrirTraer(it) {
        tr = { comp: s(it.comp.ID), de: it.traer.de, filas: it.traer.ligas.map(function (l) { return Object.assign({ sel: true, conH: true }, JSON.parse(JSON.stringify(l))); }) };
      }
      /** Los horarios que se crearían de una liga (los que no chocan) y los que chocan, con el de la temporada con que chocan. */
      function horariosTr(comp, f) {
        var ok = [], mal = [];
        if (f.conH) f.huecos.forEach(function (h) { var c = choque(ultimo.x, comp, f.DIA_SEMANA, f.MINUTOS_PARTIDO, h); (c ? mal : ok).push({ h: h, con: c }); });
        return { ok: ok, mal: mal };
      }
      function panelTraer(it) {
        var comp = it.comp, n = 0, nh = 0;
        var filas = tr.filas.map(function (f, i) {
          var hh = horariosTr(comp, f);
          if (f.sel) { n++; nh += hh.ok.length; }
          var sel = function (k, vals, v) { return '<select data-tr="' + k + '" data-i="' + i + '" aria-label="' + k + '">' + vals.map(function (x) { return '<option value="' + texto(x[0]) + '"' + (s(x[0]) === s(v) ? ' selected' : '') + '>' + texto(x[1]) + '</option>'; }).join('') + '</select>'; };
          return '<tr' + (f.sel ? '' : ' class="aj-as-tr-no"') + '><td><input type="checkbox" data-tr="sel" data-i="' + i + '"' + (f.sel ? ' checked' : '') + ' aria-label="' + texto('Traer ' + f.NOMBRE) + '"></td>' +
            '<td><input type="text" data-tr="NOMBRE" data-i="' + i + '" value="' + texto(f.NOMBRE) + '" aria-label="Nombre"></td>' +
            '<td>' + sel('DIA_SEMANA', DIAS_L.map(function (x) { return [x, x]; }), f.DIA_SEMANA) + '</td>' +
            '<td>' + sel('NIVEL', [['', '—'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']], f.NIVEL) + '</td>' +
            '<td><input type="text" inputmode="numeric" data-tr="MINUTOS_PARTIDO" data-i="' + i + '" value="' + texto(f.MINUTOS_PARTIDO) + '" size="3" aria-label="Minutos por partido"></td>' +
            '<td>' + (f.huecos.length ? '<label class="u-check"><input type="checkbox" data-tr="conH" data-i="' + i + '"' + (f.conH ? ' checked' : '') + '> ' +
              texto(f.huecos.map(function (h) { return h.HORA + ' ' + A.nombre('CAMPOS', h.ID_CAMPO); }).join(', ')) + '</label>' +
              (hh.mal.length ? '<small class="aj-as-choca">' + texto(hh.mal.map(function (m) { return m.h.HORA + ' en ' + A.nombre('CAMPOS', m.h.ID_CAMPO); }).join(', ') +
                (hh.mal.length === 1 ? ' choca' : ' chocan') + ' con otra liga de la temporada: no se crea' + (hh.mal.length === 1 ? '' : 'n') + '.') + '</small>' : '') : '<small>Sin horarios</small>') + '</td></tr>';
        }).join('');
        return '<div class="aj-as-traer"><h4>' + texto('Las ligas de ' + tr.de.nombre) + '</h4>' +
          '<p class="u-nota">Desmarca las que no siguen y cambia lo que haga falta. No se copia el gestor ni el árbitro de cada horario: se ponen después.</p>' +
          '<div class="u-tabla-caja"><table class="u-tabla aj-as-ttr"><thead><tr><th></th><th>Liga</th><th>Día</th><th>Nivel</th><th>Minutos</th><th>Horarios</th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-as-crear' + (n && !guardandoTr ? '' : ' disabled') + '>' +
          texto(guardandoTr ? 'Creando…' : 'Crear ' + pl(n, 'liga', 'ligas') + ' y ' + pl(nh, 'horario', 'horarios')) + '</button>' +
          '<button type="button" class="u-btn" data-as-notraer' + (guardandoTr ? ' disabled' : '') + '>Cancelar</button></div></div>';
      }
      /* ---------- traer las competiciones y los campos del año anterior (T0294) ---------- */

      var tp = null; // { tipo: 'comps' | 'campos', filas, origen }
      function panelTraerPaso(p) {
        if (p.id === 'TARIFAS') return tp && tp.tipo === 'modelo' && p.modelo ? panelModelo(p.modelo) : '';
        if (p.id === 'TEMPORADA') { var tf = (p.items[1] || {}).traerFestivos; return tf && !ctx.soloLeer ? (tp && tp.tipo === 'festivos' ? panelFestivos() : '<p class="aj-as-mas"><button type="button" class="u-btn aj-as-btn" data-as-tp="festivos">' +
          texto('Traer los festivos de la ' + (ultimo.ant ? ultimo.ant.NOMBRE : 'temporada anterior') + ' (' + tf.length + ')') + '</button></p>') : ''; }
        var lista = p.id === 'COMPETICIONES' ? p.traerComps : p.id === 'CAMPOS' ? p.traerCampos : null, tipo = p.id === 'COMPETICIONES' ? 'comps' : 'campos';
        if (!lista || ctx.soloLeer) return '';
        var antN = ultimo.ant ? ultimo.ant.NOMBRE : 'la temporada anterior', n0 = tipo === 'comps' ? lista.comps.length : lista.length;
        if (!tp || tp.tipo !== tipo) return '<p class="aj-as-mas"><button type="button" class="u-btn aj-as-btn" data-as-tp="' + tipo + '">' +
          texto((tipo === 'comps' ? 'Traer las competiciones de la ' : 'Traer los campos de la ') + antN + ' (' + n0 + ')') + '</button></p>';
        var n = tp.filas.filter(function (f) { return f.sel; }).length, cab, filas;
        if (tipo === 'comps') {
          // Una tarjeta por competición, cada dato con su nombre entero (Javi: «Señal» en una casilla estrecha no se entendía).
          cab = '';
          filas = tp.filas.map(function (f, i) {
            var campo = function (k, et, tipoI, extra, ayuda) {
              return '<label class="u-campo' + (k === 'NOMBRE_COMERCIAL' ? ' u-ancho' : '') + '"><span class="u-etiqueta">' + texto(et) + '</span><input type="' + tipoI + '" data-tp="' + k + '" data-i="' + i + '" value="' + texto(f[k]) + '"' + (extra || '') + '>' +
                (ayuda ? '<small class="aj-as-ayuda">' + texto(ayuda) + '</small>' : '') + '</label>';
            };
            return '<div class="aj-as-tc' + (f.sel ? '' : ' aj-as-tr-no') + '"><label class="u-check aj-as-tcc"><input type="checkbox" data-tp="sel" data-i="' + i + '"' + (f.sel ? ' checked' : '') + '> <b>' + texto('Traer ' + f.NOMBRE) + '</b>' +
              '<small>' + texto(f.TIPO + (f.INCLUIDA ? ' · incluida (no se cobra)' : '') + (f.ligas ? ' · ' + pl(f.ligas, 'liga', 'ligas') + ': se traen después, en ella' : '')) + '</small></label>' +
              '<div class="u-campos">' + campo('NOMBRE', 'Nombre', 'text') + campo('NOMBRE_COMERCIAL', 'Nombre comercial', 'text') +
              campo('FECHA_INICIO', 'Empieza', 'date') + campo('FECHA_FIN', 'Acaba', 'date') +
              (f.INCLUIDA ? '' : campo('PARTIDOS_EQUIPO', 'Partidos por equipo', 'text', ' inputmode="numeric"', 'Los que juega cada equipo en la liga.') +
                campo('SENAL', 'Señal para confirmar un equipo (€)', 'text', ' inputmode="decimal" placeholder="0,00"', 'Lo que paga un equipo para tener su plaza.') +
                campo('DESCANSO_CADA', 'Descanso para recuperar: cada cuántas jornadas', 'text', ' inputmode="numeric" placeholder="Ninguno"', 'Una semana sin partidos para recuperar los aplazados.')) + '</div></div>';
          }).join('');
        } else {
          cab = '<th></th><th>Campo</th><th>Estado</th><th>€/hora</th><th>Lo que da el colegio</th>';
          filas = tp.filas.map(function (f, i) {
            return '<tr' + (f.sel ? '' : ' class="aj-as-tr-no"') + '><td><input type="checkbox" data-tp="sel" data-i="' + i + '"' + (f.sel ? ' checked' : '') + ' aria-label="' + texto('Traer ' + A.nombre('CAMPOS', f.ID_CAMPO)) + '"></td>' +
              '<td><b>' + texto(A.nombre('CAMPOS', f.ID_CAMPO)) + '</b></td>' +
              '<td><select data-tp="ESTADO" data-i="' + i + '" aria-label="Estado">' + ['Contratado', 'Negociando', 'Candidato'].map(function (x) { return '<option' + (x === f.ESTADO ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></td>' +
              '<td><input type="text" inputmode="decimal" size="5" data-tp="PRECIO_HORA" data-i="' + i + '" value="' + texto(f.PRECIO_HORA) + '" aria-label="Precio por hora"></td>' +
              '<td>' + (f.franjas.length ? '<label class="u-check"><input type="checkbox" data-tp="conF" data-i="' + i + '"' + (f.conF ? ' checked' : '') + '> ' +
                texto(f.franjas.map(function (x) { return x.DIA_SEMANA.slice(0, 3).toLowerCase() + ' ' + x.HORA_DESDE + '–' + x.HORA_HASTA; }).join(', ')) + '</label>' : '<small>Sin datos</small>') + '</td></tr>';
          }).join('');
        }
        return '<div class="aj-as-traer"><h4>' + texto((tipo === 'comps' ? 'Las competiciones de la ' : 'Los campos de la ') + antN) + '</h4>' +
          '<p class="u-nota">' + texto(tipo === 'comps' ? 'Con sus fechas un año después. Desmarca las que no siguen y cambia lo que haga falta; de qué competición sale cada copa también se trae. Sus ligas, después, en cada una.' :
            'Con su precio por hora y lo que daba el colegio (sus fechas, un año después). Desmarca los que no siguen y cambia lo que haga falta.') + '</p>' +
          (cab ? '<div class="u-tabla-caja"><table class="u-tabla aj-as-ttr"><thead><tr>' + cab + '</tr></thead><tbody>' + filas + '</tbody></table></div>' : filas) +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-as-tpcrear' + (n && !guardandoTr ? '' : ' disabled') + '>' +
          texto(guardandoTr ? 'Creando…' : (tipo === 'comps' ? 'Crear ' + pl(n, 'competición', 'competiciones') : 'Añadir ' + pl(n, 'campo', 'campos'))) + '</button>' +
          '<button type="button" class="u-btn" data-as-tpno' + (guardandoTr ? ' disabled' : '') + '>Cancelar</button></div></div>';
      }
      /** Los festivos y descansos de la temporada anterior, un año después: se revisan (fecha, motivo) y se añaden. */
      function panelFestivos() {
        var n = tp.filas.filter(function (f) { return f.sel; }).length;
        return '<div class="aj-as-traer"><h4>' + texto('Los festivos y descansos de la ' + (ultimo.ant ? ultimo.ant.NOMBRE : 'temporada anterior')) + '</h4>' +
          '<p class="u-nota">Con la misma fecha un año después. Los que cambian de día cada año (Semana Santa, Pascua…) y los descansos salen con «revisar»: cambia la fecha si hace falta.</p>' +
          '<div class="u-tabla-caja"><table class="u-tabla aj-as-ttr"><thead><tr><th></th><th>Día</th><th>Motivo</th><th>Festivo</th><th>Descanso</th></tr></thead><tbody>' + tp.filas.map(function (f, i) {
            return '<tr' + (f.sel ? '' : ' class="aj-as-tr-no"') + '><td><input type="checkbox" data-tp="sel" data-i="' + i + '"' + (f.sel ? ' checked' : '') + ' aria-label="' + texto('Traer ' + f.MOTIVO) + '"></td>' +
              '<td><input type="date" data-tp="FECHA" data-i="' + i + '" value="' + texto(f.FECHA) + '" aria-label="Día">' + (f.revisar ? '<small class="aj-as-choca">revisar</small>' : '') + '</td>' +
              '<td><input type="text" data-tp="MOTIVO" data-i="' + i + '" value="' + texto(f.MOTIVO) + '" aria-label="Motivo"></td>' +
              '<td><input type="checkbox" data-tp="FESTIVO" data-i="' + i + '"' + (f.FESTIVO ? ' checked' : '') + ' aria-label="Festivo"></td>' +
              '<td><input type="checkbox" data-tp="DESCANSO" data-i="' + i + '"' + (f.DESCANSO ? ' checked' : '') + ' aria-label="Descanso"></td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-as-tpcrear' + (n && !guardandoTr ? '' : ' disabled') + '>' + texto(guardandoTr ? 'Añadiendo…' : 'Añadir ' + pl(n, 'día', 'días')) + '</button>' +
          '<button type="button" class="u-btn" data-as-tpno' + (guardandoTr ? ' disabled' : '') + '>Cancelar</button></div></div>';
      }
      /** Unos días seguidos (unas vacaciones, un puente): desde, hasta, motivo y si son festivos o descanso. Todos de una vez. */
      function panelDias() {
        var n = tp.desde && tp.hasta && tp.hasta >= tp.desde ? Math.round((new Date(tp.hasta) - new Date(tp.desde)) / 864e5) + 1 : 0;
        var ya = (T.filas('CALENDARIO') || []).map(function (x) { return s(x.FECHA); }), nuevos = 0;
        for (var i = 0; i < n && i < 120; i++) if (ya.indexOf(masDias(tp.desde, i)) < 0) nuevos++;
        var campo = function (k, et, html) { return '<label class="u-campo"><span class="u-etiqueta">' + texto(et) + '</span>' + html + '</label>'; };
        return '<div class="aj-as-traer"><h4>Unos días seguidos sin jugar</h4><p class="u-nota">Unas vacaciones o un puente: todos los días, del primero al último. Los que ya estén, no se repiten.</p>' +
          '<div class="u-campos">' + campo('desde', 'Desde', '<input type="date" data-tp="desde" value="' + texto(tp.desde) + '">') + campo('hasta', 'Hasta', '<input type="date" data-tp="hasta" value="' + texto(tp.hasta) + '">') +
          '<label class="u-campo u-ancho"><span class="u-etiqueta">Motivo</span><input type="text" data-tp="MOTIVO" value="' + texto(tp.MOTIVO) + '" placeholder="Vacaciones de Navidad"></label></div>' +
          '<div class="aj-as-modos"><label class="u-check"><input type="radio" name="as-dt" data-tp="tipoDia" value="DESCANSO"' + (tp.tipoDia !== 'FESTIVO' ? ' checked' : '') + '> Descanso (no se juega)</label>' +
          '<label class="u-check"><input type="radio" name="as-dt" data-tp="tipoDia" value="FESTIVO"' + (tp.tipoDia === 'FESTIVO' ? ' checked' : '') + '> Festivo</label></div>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-as-tpcrear' + (nuevos && s(tp.MOTIVO).trim() && !guardandoTr ? '' : ' disabled') + '>' + texto(guardandoTr ? 'Añadiendo…' : 'Añadir ' + pl(nuevos, 'día', 'días')) + '</button>' +
          '<button type="button" class="u-btn" data-as-tpno' + (guardandoTr ? ' disabled' : '') + '>Cancelar</button></div></div>';
      }
      function crearDias() {
        var ya = (T.filas('CALENDARIO') || []).map(function (x) { return s(x.FECHA); }), dias = [];
        var n = Math.round((new Date(tp.hasta) - new Date(tp.desde)) / 864e5) + 1;
        for (var i = 0; i < n && i < 120; i++) { var f = masDias(tp.desde, i); if (ya.indexOf(f) < 0) dias.push(f); }
        tp.filas = dias.map(function (f) { return { sel: true, FECHA: f, MOTIVO: s(tp.MOTIVO).trim(), FESTIVO: tp.tipoDia === 'FESTIVO', DESCANSO: tp.tipoDia !== 'FESTIVO' }; });
        crearFestivos();
      }
      function crearFestivos() {
        var sel = tp.filas.filter(function (f) { return f.sel && f.FECHA && s(f.MOTIVO).trim(); }), creados = [];
        guardandoTr = true; pintar();
        // Uno detrás de otro (la clave es el día: sin altas en bloque); para deshacer, se quitan los que se han añadido.
        var p = sel.reduce(function (pr, f) {
          return pr.then(function () { return A.crear('CALENDARIO', { FECHA: f.FECHA, MOTIVO: s(f.MOTIVO).trim(), FESTIVO: !!f.FESTIVO, DESCANSO: !!f.DESCANSO }).then(function () { creados.push(f.FECHA); }); });
        }, Promise.resolve());
        hacer(p, 'Añadidos ' + pl(sel.length, 'festivo o descanso', 'festivos y descansos') + '.', function () {
          return creados.slice().reduce(function (pr, x) { return pr.then(function () { return A.quitar('CALENDARIO', x); }); }, Promise.resolve());
        }).then(function () { guardandoTr = false; tp = null; if (vivo) pintar(); }, function () { guardandoTr = false; if (vivo) pintar(); });
      }
      /** El modelo de camiseta de la temporada: crear uno nuevo (o usar uno que ya existe) y ponerlo en las competiciones marcadas. */
      function panelModelo(m) {
        var n = tp.filas.filter(function (f) { return f.sel; }).length, nuevo = tp.modo !== 'usar';
        var mods = (T.filas('MODELOS') || []).slice().reverse();
        var campo = function (k, et, html) { return '<label class="u-campo"><span class="u-etiqueta">' + texto(et) + '</span>' + html + '</label>'; };
        return '<div class="aj-as-traer"><h4>' + texto('Modelo de camiseta de la ' + s(ultimo.tem.NOMBRE)) + '</h4>' +
          '<p class="u-nota">Lo normal es un modelo nuevo cada temporada, con sus sponsors, para todas las competiciones. Después, en su ficha, puedes subir el diseño con los logos.</p>' +
          '<div class="aj-as-modos"><label class="u-check"><input type="radio" name="as-mm" data-tp="modo" value="nuevo"' + (nuevo ? ' checked' : '') + '> Crear uno nuevo</label>' +
          '<label class="u-check"><input type="radio" name="as-mm" data-tp="modo" value="usar"' + (nuevo ? '' : ' checked') + '> Usar uno que ya existe</label></div>' +
          '<div class="u-campos">' + (nuevo ?
            // Sin «modelo de la prenda» (Javi: no se entiende): va el del año pasado o «Camiseta», y se cambia en la ficha si hace falta.
            campo('NOMBRE', 'Nombre (los sponsors y la temporada)', '<input type="text" data-tp="NOMBRE" value="' + texto(tp.NOMBRE) + '" placeholder="' + texto('p. ej. ' + (m.prev && m.prev.NOMBRE ? subirAnos(m.prev.NOMBRE) : 'SPONSOR-SPONSOR 27-28')) + '">') :
            campo('ID_MODELO', 'Modelo', '<select data-tp="ID_MODELO"><option value="">Elige</option>' + mods.map(function (x) { return '<option value="' + texto(x.ID) + '"' + (s(x.ID) === tp.ID_MODELO ? ' selected' : '') + '>' + texto(x.NOMBRE) + '</option>'; }).join('') + '</select>')) +
          campo('CAMISETAS_INCLUIDAS', 'Camisetas incluidas por jugadora', '<input type="text" inputmode="numeric" data-tp="CAMISETAS_INCLUIDAS" value="' + texto(tp.CAMISETAS_INCLUIDAS) + '">') + '</div>' +
          '<p class="u-etiqueta">Para</p><div class="aj-as-chips">' + tp.filas.map(function (f, i) {
            return '<label class="u-check"><input type="checkbox" data-tp="sel" data-i="' + i + '"' + (f.sel ? ' checked' : '') + '> ' + texto(f.nombre) + '</label>';
          }).join('') + '</div>' +
          '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-as-tpcrear' + (n && !guardandoTr && (nuevo ? s(tp.NOMBRE).trim() : tp.ID_MODELO) ? '' : ' disabled') + '>' +
          texto(guardandoTr ? 'Guardando…' : (nuevo ? 'Crear el modelo y ponerlo en ' : 'Ponerlo en ') + pl(n, 'competición', 'competiciones')) + '</button>' +
          '<button type="button" class="u-btn" data-as-tpno' + (guardandoTr ? ' disabled' : '') + '>Cancelar</button></div></div>';
      }
      function crearModelo() {
        var sel = tp.filas.filter(function (f) { return f.sel; }), nuevo = tp.modo !== 'usar', creados = [];
        var inc = Number(String(tp.CAMISETAS_INCLUIDAS).trim()) || 0;
        guardandoTr = true; pintar();
        // Uno detrás de otro: el modelo (si es nuevo) y después su fila en cada competición. Para deshacer, al revés.
        // Sin proveedor: un modelo es el diseño; quién lo fabrica va en el Catálogo (Javi).
        var p0 = nuevo ? A.crear('MODELOS', { NOMBRE: s(tp.NOMBRE).trim(), PRENDA: s(tp.PRENDA).trim() || 'Camiseta' }).then(function (r) { creados.push(['MODELOS', r.id]); return r.id; }) : Promise.resolve(tp.ID_MODELO);
        var p = p0.then(function (idM) {
          return sel.reduce(function (pr, f) {
            return pr.then(function () { return A.crear('MODELOS_COMPETICION', { ID_COMPETICION: f.ID, ID_MODELO: idM, CAMISETAS_INCLUIDAS: inc }).then(function (r) { creados.push(['MODELOS_COMPETICION', r.id]); }); });
          }, Promise.resolve());
        });
        hacer(p, (nuevo ? 'Creado el modelo ' + s(tp.NOMBRE).trim() + ' y puesto en ' : 'Modelo puesto en ') + pl(sel.length, 'competición', 'competiciones') + '.', function () {
          return creados.slice().reverse().reduce(function (pr, x) { return pr.then(function () { return A.quitar(x[0], x[1]); }); }, Promise.resolve());
        }).then(function () { guardandoTr = false; tp = null; if (vivo) pintar(); }, function () {
          guardandoTr = false; if (vivo) pintar();
        });
      }
      function abrirTp(tipo) {
        if (tipo === 'dias') { tp = { tipo: 'dias', filas: [], desde: '', hasta: '', MOTIVO: '', tipoDia: 'DESCANSO' }; return; }
        if (tipo === 'festivos') {
          var tf = ultimo.pasos[0].items[1].traerFestivos;
          if (tf) tp = { tipo: 'festivos', filas: tf.map(function (f) { return Object.assign({}, f, { sel: true }); }) };
          return;
        }
        if (tipo === 'modelo') {
          var pm = ultimo.pasos.filter(function (x) { return x.id === 'TARIFAS'; })[0].modelo;
          if (!pm) return;
          var pv = pm.prev || {};
          tp = { tipo: 'modelo', modo: 'nuevo', filas: pm.comps.map(function (c) { return Object.assign({}, c, { sel: true }); }), NOMBRE: '', PRENDA: pv.PRENDA || 'Camiseta',
            ID_MODELO: '', CAMISETAS_INCLUIDAS: pv.CAMISETAS_INCLUIDAS || 1 };
          return;
        }
        var p = ultimo.pasos.filter(function (x) { return x.id === (tipo === 'comps' ? 'COMPETICIONES' : 'CAMPOS'); })[0];
        var l = tipo === 'comps' ? p.traerComps : p.traerCampos;
        if (!l) return;
        // Los importes, con coma (como se escriben aquí); al crear, vuelven a ser números.
        var coma = function (v) { return v === '' || v == null ? '' : String(v).replace('.', ','); };
        tp = tipo === 'comps' ? { tipo: tipo, filas: l.comps.map(function (c) { return Object.assign({ sel: true }, c, { SENAL: coma(c.SENAL) }); }), origen: l.origen } :
          { tipo: tipo, filas: l.map(function (c) { return Object.assign({ sel: true, conF: true }, JSON.parse(JSON.stringify(c)), { PRECIO_HORA: coma(c.PRECIO_HORA) }); }) };
      }
      function crearTp() {
        var num = function (v) { var x = String(v == null ? '' : v).trim().replace(/\s|€/g, '').replace(',', '.'); return x === '' ? '' : Number(x); };
        var antN = ultimo.ant ? s(ultimo.ant.NOMBRE) : '', sel = tp.filas.filter(function (f) { return f.sel; }).map(function (f) {
          return Object.assign({}, f, 'SENAL' in f ? { SENAL: num(f.SENAL), PARTIDOS_EQUIPO: num(f.PARTIDOS_EQUIPO), DESCANSO_CADA: num(f.DESCANSO_CADA) } : {}, 'PRECIO_HORA' in f ? { PRECIO_HORA: num(f.PRECIO_HORA) } : {});
        });
        guardandoTr = true; pintar();
        var p;
        if (tp.tipo === 'comps') {
          var refs = sel.map(function (f) { return f.de; }), deTem = (datos().comps || []).filter(function (c) { return s(c.ID_TEMPORADA) === tid; }).map(function (c) { return s(c.ID); });
          // El origen, solo entre las que se traen o las que ya estaban en la temporada.
          var origen = tp.origen.filter(function (o) { return refs.indexOf(o.a) >= 0 && (refs.indexOf(o.de) >= 0 || deTem.indexOf(o.de) >= 0); });
          p = hacer(ctx.llamar('ligasTraerCompeticiones', [tid, sel, origen, { de: antN }]).then(function (r) { return T.refrescar(['COMPETICIONES', 'COMPETICIONES_ORIGEN'], true).then(function () { return r; }, function () { return r; }); }),
            function (r) { return 'Creadas ' + pl(r.competiciones, 'competición', 'competiciones') + '. Ahora, sus ligas: «Traer las ligas» en cada una.'; },
            function (r) { return deshacerTraido(r.ids, ['COMPETICIONES', 'COMPETICIONES_ORIGEN']); });
        } else {
          p = hacer(ctx.llamar('ligasTraerCampos', [tid, sel.map(function (f) { return Object.assign({}, f, { franjas: f.conF ? f.franjas : [] }); }), { de: antN }])
            .then(function (r) { return T.refrescar(['CAMPOS_TEMPORADA', 'DISPONIBILIDAD_CAMPOS'], true).then(function () { return r; }, function () { return r; }); }),
            function (r) { return 'Añadidos ' + pl(r.campos, 'campo', 'campos') + (r.franjas ? ' con ' + pl(r.franjas, 'franja', 'franjas') + ' de lo que da el colegio' : '') + '.'; },
            function (r) { return deshacerTraido(r.ids, ['CAMPOS_TEMPORADA', 'DISPONIBILIDAD_CAMPOS']); });
        }
        p.then(function () { guardandoTr = false; tp = null; if (vivo) pintar(); }, function () { guardandoTr = false; if (vivo) pintar(); });
      }

      function crearTraidas() {
        var comp = (datos().comps || []).filter(function (c) { return s(c.ID) === tr.comp; })[0];
        if (!comp) { tr = null; pintar(); return; }
        var ligas = tr.filas.filter(function (f) { return f.sel; }).map(function (f) {
          return { NOMBRE: f.NOMBRE, DIA_SEMANA: f.DIA_SEMANA, NIVEL: f.NIVEL, MINUTOS_PARTIDO: Number(String(f.MINUTOS_PARTIDO).trim()) || '', huecos: horariosTr(comp, f).ok.map(function (x) { return x.h; }) };
        });
        guardandoTr = true; pintar();
        hacer(ctx.llamar('ligasTraer', [tr.comp, ligas, { de: tr.de.nombre }]).then(function (r) { return T.refrescar(['LIGAS', 'HUECOS'], true).then(function () { return r; }, function () { return r; }); }),
          function (r) { return 'Creadas ' + pl(r.ligas, 'liga', 'ligas') + ' y ' + pl(r.horarios, 'horario', 'horarios') + '.'; },
          function (r) { return deshacerTraido(r.ids, ['LIGAS', 'HUECOS']); })
          .then(function () { guardandoTr = false; tr = null; if (vivo) pintar(); }, function () { guardandoTr = false; if (vivo) pintar(); });
      }

      /* ---------- elegir horarios en el cuadrante del día (T0294) ---------- */

      var hz = '', hzQuitar = '', hzGuardando = false;
      function hhmm(m) { m = m % 1440; return (m < 600 ? '0' : '') + Math.floor(m / 60) + ':' + (m % 60 < 10 ? '0' : '') + (m % 60); }
      function panelHorarios(it) {
        var cd = cuadranteDia(ultimo.x, datos(), it.liga, it.comp), filas = (cd.hasta - cd.desde) / 15, cols = cd.campos.length;
        var dice = 'Tiene ' + pl(cd.tiene, 'horario', 'horarios') + (cd.ideal ? ': caben ' + cd.ideal.equipos + ' equipos ' + (cd.ideal.vueltas === 1 ? 'a una vuelta' : 'a dos vueltas') : '') + '.' +
          (cd.necesita ? ' Con sus ' + cd.equipos + ' equipos confirmados hacen falta ' + cd.necesita + '.' : '');
        var h = '<div class="aj-as-cuad"><h4>' + texto('Los ' + cd.dia.toLowerCase() + ' · partidos de ' + cd.min + ' minutos') + '</h4>' +
          '<p class="aj-as-cdice">' + texto(dice) + '</p><p class="u-nota">Toca un hueco libre para añadir un horario a esta liga; toca uno suyo para quitarlo.</p>';
        if (!cols) return h + '<p class="u-vacio">No hay campos contratados esta temporada: contrátalos primero, arriba.</p><div class="n-botones"><button type="button" class="u-btn" data-as-hzcerrar>Cerrar</button></div></div>';
        // En el móvil la rejilla no se puede tocar (huecos de 14 px): cada campo, sus horarios y sus horas libres como botones.
        if (window.matchMedia && window.matchMedia('(max-width: 599px)').matches) {
          return h + cd.campos.map(function (c) {
            var mios = cd.ocupados.filter(function (o) { return o.propio && o.campo === c.id; }), libres = [];
            for (var m = cd.desde; m + cd.min <= cd.hasta; m += 15) if (!cabeEn(cd, c.id, m)) libres.push(m);
            return '<section class="aj-as-cm"><h5>' + texto(A.nombre('CAMPOS', c.id)) + (c.contratado ? '' : ' <small>sin contratar</small>') + '</h5>' +
              (mios.length ? '<div class="aj-as-chips">' + mios.map(function (o) {
                return '<button type="button" class="u-btn aj-as-chipm aj-as-cp" data-as-hzq="' + texto(o.id) + '"' + (hzGuardando ? ' disabled' : '') + '>' +
                  (hzQuitar === o.id ? '¿Quitar las ' + hhmm(o.a) + '? Toca otra vez' : hhmm(o.a) + ' · quitar') + '</button>';
              }).join('') + '</div>' : '') +
              (libres.length ? '<p class="u-nota">Libre' + (c.franjas ? ' (dentro de lo alquilado)' : '') + ':</p><div class="aj-as-chips">' + libres.map(function (m) {
                return '<button type="button" class="u-btn aj-as-chipm" data-as-hzadd="' + texto(c.id + '|' + hhmm(m)) + '"' + (hzGuardando ? ' disabled' : '') + '>' + hhmm(m) + '</button>';
              }).join('') + '</div>' : '<p class="u-nota">Sin horas libres ese día.</p>') + '</section>';
          }).join('') + '<div class="n-botones"><button type="button" class="u-btn" data-as-hzcerrar>Listo</button></div></div>';
        }
        var g = '<div class="aj-as-cg" style="grid-template-columns: 3.2em repeat(' + cols + ', minmax(64px, 1fr)); grid-template-rows: auto repeat(' + filas + ', 14px);">';
        cd.campos.forEach(function (c, j) { g += '<div class="aj-as-cc" style="grid-column:' + (j + 2) + ';grid-row:1">' + texto(A.nombre('CAMPOS', c.id)) + (c.contratado ? '' : '<small>sin contratar</small>') + '</div>'; });
        for (var r = 0; r < filas; r++) {
          var m = cd.desde + r * 15;
          if (m % 60 === 0) g += '<div class="aj-as-ch" style="grid-column:1;grid-row:' + (r + 2) + ' / span 4">' + hhmm(m) + '</div>';
          cd.campos.forEach(function (c, j) {
            var dentro = !c.franjas || c.franjas.some(function (f) { return f[0] <= m && m < f[1]; });
            var por = cabeEn(cd, c.id, m), libre = !por && m + cd.min <= cd.hasta;
            g += libre && !hzGuardando ? '<button type="button" class="aj-as-cl' + (dentro ? '' : ' aj-as-cfuera') + (m % 60 === 0 ? ' aj-as-chora' : '') + '" style="grid-column:' + (j + 2) + ';grid-row:' + (r + 2) +
              '" data-as-hzadd="' + texto(c.id + '|' + hhmm(m)) + '" title="' + texto('Añadir a las ' + hhmm(m) + ' en ' + A.nombre('CAMPOS', c.id)) + '" aria-label="' + texto('Añadir a las ' + hhmm(m) + ' en ' + A.nombre('CAMPOS', c.id)) + '"></button>' :
              '<span class="aj-as-cv' + (dentro ? '' : ' aj-as-cfuera') + (m % 60 === 0 ? ' aj-as-chora' : '') + '" style="grid-column:' + (j + 2) + ';grid-row:' + (r + 2) + '"' + (por === 'fuera' && !cd.ocupados.some(function (o) { return o.campo === c.id && o.a <= m && m < o.b; }) ? ' title="Fuera de lo alquilado"' : '') + '></span>';
          });
        }
        cd.ocupados.forEach(function (o) {
          var j = cd.campos.map(function (c) { return c.id; }).indexOf(o.campo), r0 = (o.a - cd.desde) / 15 + 2, n = Math.max(1, Math.round((o.b - o.a) / 15));
          if (j < 0) return;
          var est = 'grid-column:' + (j + 2) + ';grid-row:' + Math.floor(r0) + ' / span ' + n;
          g += o.propio ? '<button type="button" class="aj-as-co aj-as-cp" style="' + est + '" data-as-hzq="' + texto(o.id) + '"' + (hzGuardando ? ' disabled' : '') + '><b>' + hhmm(o.a) + '</b> ' +
            (hzQuitar === o.id ? '¿Quitar? Toca otra vez' : texto(o.nombre)) + '</button>' :
            '<span class="aj-as-co" style="' + est + '"><b>' + hhmm(o.a) + '</b> ' + texto(o.nombre) + '</span>';
        });
        return h + '<div class="u-tabla-caja">' + g + '</div></div>' +
          '<p class="u-nota aj-as-cley"><span class="aj-as-cl aj-as-cmuestra"></span> libre <span class="aj-as-cl aj-as-cfuera aj-as-cmuestra"></span> fuera de lo alquilado <span class="aj-as-co aj-as-cmuestra"></span> otra liga <span class="aj-as-co aj-as-cp aj-as-cmuestra"></span> esta liga</p>' +
          '<div class="n-botones"><button type="button" class="u-btn" data-as-hzcerrar>Listo</button></div></div>';
      }
      function anadirHorario(liga, campo, hora) {
        hzGuardando = true; hzQuitar = ''; pintar();
        A.crear('HUECOS', { ID_LIGA: s(liga.ID), DIA_SEMANA: s(liga.DIA_SEMANA), HORA: hora, ID_CAMPO: campo }).then(function () {
          hzGuardando = false; if (vivo) { ctx.aviso('Añadido: ' + hora + ' en ' + A.nombre('CAMPOS', campo) + '.'); pintar(); }
        }, function (e) { hzGuardando = false; if (vivo) { ctx.aviso(String((e && e.message) || e).replace(/^\w+:\s*/, '')); pintar(); } });
      }
      function quitarHorario(id) {
        if (hzQuitar !== id) { hzQuitar = id; pintar(); return; }
        hzGuardando = true; hzQuitar = ''; pintar();
        A.quitar('HUECOS', id).then(function () { hzGuardando = false; if (vivo) { ctx.aviso('Horario quitado.'); pintar(); } },
          function (e) { hzGuardando = false; if (vivo) { ctx.aviso(String((e && e.message) || e).replace(/^\w+:\s*/, '')); pintar(); } });
      }

      /** Quitar lo que sobra: el primer toque pregunta (con lo que se va con ella) y el segundo lo quita. */
      var quitando = {}, preguntando = '';
      function puedeQuitar(it) { var q = it.quitar; return !!q && !ctx.soloLeer && !quitando[q.id]; }
      function botonQuitar(q) {
        var k = q.tabla + '|' + q.id;
        return preguntando === k ? '<span class="aj-as-quitar"><span>' + texto(q.pregunta) + '</span><button type="button" class="u-btn u-btn-texto aj-as-si" data-as-quitar="' + texto(k) + '">Sí, quitar</button>' +
          '<button type="button" class="u-btn u-btn-texto" data-as-noquitar>No</button></span>' :
          '<button type="button" class="u-btn u-btn-texto aj-as-q" data-as-pregunta="' + texto(k) + '">Quitar</button>';
      }
      var porQuitar = {};
      function quitar(q) {
        quitando[q.id] = true; preguntando = ''; pintar();
        // Primero lo que cuelga de ella y después ella, uno detrás de otro (cada borrado lo confirma el motor).
        q.tambien.concat([[q.tabla, q.id]]).reduce(function (p, x) { return p.then(function () { return A.quitar(x[0], x[1]); }); }, Promise.resolve())
          .then(function () { delete quitando[q.id]; if (vivo) { ctx.aviso('Quitada.'); pintar(); } },
            function (e) { delete quitando[q.id]; if (vivo) { ctx.aviso(String((e && e.message) || e).replace(/^\w+:\s*/, '')); pintar(); } });
      }
      function referencia(p, c) {
        if (!c.ant || !p.ref || !p.ref.length) return '';
        return '<details class="aj-as-ref"><summary>' + texto('La ' + (c.ant.NOMBRE || c.ant.ID) + (p.refCorto ? ': ' + p.refCorto : '')) + '</summary><ul>' +
          p.ref.map(function (r) { return '<li>' + texto(r) + '</li>'; }).join('') + '</ul></details>';
      }
      function faltanTxt(n) { return n ? (n === 1 ? 'Falta 1 cosa' : 'Faltan ' + n + ' cosas') : ''; }
      /** Lo que falta de un paso: [todas, avisos]. */
      function cuantas(p) {
        var todas = [];
        [].concat(p.items, [].concat.apply([], (p.grupos || []).map(function (g) { return g.items; }))).forEach(function mira(it) { todas = todas.concat(it.faltan || []); (it.hijas || []).forEach(mira); });
        return [todas.length, todas.filter(esAviso).length];
      }

      function pantallaPaso(p, c) {
        var n = cuantas(p), vacia = !p.items.length && !(p.grupos || []).some(function (g) { return g.items.length; });
        var h = lineaHecho() + panelTraerPaso(p) + '<p class="aj-as-estado ' + ESTADO[p.estado][1] + '">' + (p.estado === 'hecho' ? '✓ Listo' : vacia ? 'Todavía no hay nada' : faltanTxt(n[0]) +
          (n[1] ? ' <span class="aj-as-navisos">· ' + (n[1] === 1 ? '1 aviso' : n[1] + ' avisos') + '</span>' : '')) + '</p>';
        if (p.items.length) h += '<ul class="aj-as-lista">' + p.items.map(fila).join('') + '</ul>';
        (p.grupos || []).forEach(function (g) { if (g.items.length) h += '<h3 class="aj-as-g">' + texto(g.titulo) + '</h3><ul class="aj-as-lista">' + g.items.map(fila).join('') + '</ul>'; });
        if ((p.botones || []).length) h += '<div class="aj-as-anadir">' + p.botones.map(function (b) { return boton(Object.assign({}, b, { texto: '+ ' + b.texto }), 'u-btn-texto aj-as-btn'); }).join('') + '</div>';
        return h + referencia(p, c);
      }
      function pantallaDespues(c) {
        // Avisar a las capitanas no sale hasta que exista (T0304): enseñar lo que no hay resta. Las ligas en marcha, solo si
        // alguna tiene algo (Javi: lo pendiente, aquí; nada en las tablas).
        return lineaHecho() + '<ul class="aj-as-lista aj-as-despues">' + c.pasos.slice(4).filter(function (p) { return p.id !== 'AVISAR' && !(p.id === 'MARCHA' && !p.items.length); }).map(function (p) {
          var e = ESTADO[p.estado], ok = p.estado === 'hecho';
          return '<li class="aj-as-f ' + e[1] + (ok ? ' aj-as-ok' : ' aj-as-falta') + '"><span class="aj-as-i" aria-hidden="true">' + (ok ? '✓' : '') + '</span><div class="aj-as-c"><div class="aj-as-t"><b class="aj-as-nom">' + texto(p.titulo) + '</b>' +
            '<small>' + texto(p.resumen) + '</small></div><p class="u-nota aj-as-dn">' + texto(DESPUES[p.id]) + '</p>' +
            // Qué le falta, competición por competición, con lo que lo resuelve (Gestión).
            (p.items.some(function (it) { return (it.faltan || []).length; }) && p.id !== 'CALENDARIO' ? '<ul class="aj-as-av">' + p.items.filter(function (it) { return (it.faltan || []).length; }).map(function (it) {
              return it.faltan.map(function (f) { return '<li><span>' + texto(it.titulo + ': ' + f.replace(/\.$/, '')) + '</span>' + boton((it.arreglos || {})[f]) + '</li>'; }).join('');
            }).join('') + '</ul>' : '') + ((p.botones || []).length ? '<div class="aj-as-mas">' + p.botones.map(function (b) { return boton(b, 'aj-as-btn'); }).join('') + '</div>' : '') +
            '</div><span class="u-chip aj-as-chip">' + e[0] + '</span></li>';
        }).join('') + '</ul>';
      }

      function pintar() {
        if (!vivo || !el.isConnected) return;
        var hoy = new Date(), dd = function (n) { return (n < 10 ? '0' : '') + n; };
        // Todas las temporadas (Javi: también las acabadas, para revisar y corregir), en dos grupos; por defecto, la más nueva.
        var todas = A.periodos(), lista = porPreparar(todas, hoy.getFullYear() + '-' + dd(hoy.getMonth() + 1) + '-' + dd(hoy.getDate()));
        var acabadas = todas.filter(function (p) { return lista.indexOf(p) < 0; });
        var puedeTemp = A.puede('TEMPORADAS') && !ctx.soloLeer;
        if (!todas.length) {
          el.innerHTML = '<section class="aj-as"><p class="u-vacio">Todavía no hay temporadas.</p>' +
            (puedeTemp ? boton({ texto: 'Añadir la primera temporada', tabla: 'TEMPORADAS', valores: {} }, 'u-btn-accion') : '') + '</section>';
          return;
        }
        if (!todas.some(function (p) { return p.id === tid; })) tid = porDefecto(lista.length ? lista : todas);
        var acabada = acabadas.some(function (p) { return p.id === tid; });
        mirarPartidosDia(tid);
        if (A.periodo() !== tid) A.ponerPeriodo(tid); // las fichas nuevas empiezan con esta temporada y sus desplegables, con lo de ella
        var c = camino(datos(), tid), de = {};
        ultimo = c;
        porQuitar = {};
        c.pasos.forEach(function (p) { [].concat(p.items, [].concat.apply([], (p.grupos || []).map(function (g) { return g.items; }))).forEach(function mira(it) { if (it.quitar) porQuitar[it.quitar.tabla + '|' + it.quitar.id] = it.quitar; (it.hijas || []).forEach(mira); }); });
        c.pasos.forEach(function (p) { de[p.id] = p; });
        // «Y después», en la barra: hecho si todo lo que enseña lo está; si no, a medias (y si no ha empezado nada, sin color).
        var despues = c.pasos.slice(4).filter(function (p) { return p.id !== 'AVISAR' && !(p.id === 'MARCHA' && !p.items.length); });
        var estD = despues.every(function (p) { return p.estado === 'hecho'; }) ? 'hecho' : despues.some(function (p) { return p.estado === 'hecho' || p.estado === 'medias'; }) ? 'medias' : '';
        var est = function (id) { return id === 'DESPUES' ? estD : de[id].estado; };
        // Al entrar (o al cambiar de temporada), el primer paso sin hacer; si están todos, «Y después».
        if (!PANTALLAS.some(function (x) { return x.id === paso; })) paso = (PANTALLAS.filter(function (x) { return x.id !== 'DESPUES' && est(x.id) !== 'hecho'; })[0] || PANTALLAS[4]).id;
        var i = PANTALLAS.map(function (x) { return x.id; }).indexOf(paso), P = PANTALLAS[i], nomT = s(c.tem.NOMBRE || c.tem.ID);
        el.innerHTML = '<section class="aj-as">' +
          '<div class="aj-as-cab"><label class="u-campo"><span class="u-etiqueta">Temporada</span><select id="as-temp">' + [['En curso y por venir', lista], ['Acabadas', acabadas]].filter(function (g) { return g[1].length; }).map(function (g) {
            return '<optgroup label="' + texto(g[0]) + '">' + g[1].map(function (p) { return '<option value="' + texto(p.id) + '"' + (p.id === tid ? ' selected' : '') + '>' + texto(p.nombre) + '</option>'; }).join('') + '</optgroup>';
          }).join('') + '</select></label>' + (puedeTemp ? boton({ texto: '+ Nueva temporada', tabla: 'TEMPORADAS', valores: {} }) : '') + '</div>' +
          (acabada ? '<p class="aj-as-acabada">' + texto('La ' + nomT + ' ya acabó: lo que sale es para revisar y corregir; no hace falta completarlo todo (lo que no existía entonces, como los partidos por equipo o la señal, puede quedarse vacío).') + '</p>' : '') +
          '<ol class="aj-as-barra">' + PANTALLAS.map(function (x, j) {
            var e = est(x.id), cl = e ? ESTADO[e][1] : '';
            return '<li><button type="button" class="aj-as-p ' + cl + (j === i ? ' aj-as-actual' : '') + '" data-as-paso="' + x.id + '"' + (j === i ? ' aria-current="step"' : '') + '>' +
              '<span class="aj-as-pn" aria-hidden="true">' + (e === 'hecho' ? '✓' : x.id === 'DESPUES' ? '…' : j + 1) + '</span><span class="aj-as-pt">' + texto(x.corto) + '</span>' +
              (e ? '<span class="u-oculto"> · ' + ESTADO[e][0] + '</span>' : '') + '</button></li>';
          }).join('') + '</ol>' +
          '<div class="aj-as-pant"><p class="aj-as-num-paso">' + (P.id === 'DESPUES' ? 'Y después' : 'Paso ' + (i + 1) + ' de 4 · ' + texto(P.corto)) + '</p>' +
          '<h2 class="aj-as-preg">' + texto(P.pregunta(nomT)) + '</h2><p class="u-nota">' + texto(P.ayuda) + '</p>' +
          (P.id === 'DESPUES' ? pantallaDespues(c) : pantallaPaso(de[P.id], c)) + '</div>' +
          '<div class="aj-as-nav">' + (i > 0 ? '<button type="button" class="u-btn" data-as-paso="' + PANTALLAS[i - 1].id + '">‹ Anterior</button>' : '<span></span>') +
          (i < PANTALLAS.length - 1 ? '<button type="button" class="u-btn u-btn-accion" data-as-paso="' + PANTALLAS[i + 1].id + '"><span class="aj-as-sig">' + texto('Siguiente: ' + PANTALLAS[i + 1].corto.toLowerCase()) + ' ›</span><span class="aj-as-sigc">Siguiente ›</span></button>' : '') + '</div></section>';
        var st = el.querySelector('#as-temp');
        st.onchange = function () { tid = st.value; guardado('temp', tid); paso = ''; tr = null; A.ponerPeriodo(tid); pintar(); };
      }

      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-as-paso], [data-as-nueva], [data-as-ficha], [data-as-accion], [data-as-pregunta], [data-as-quitar], [data-as-noquitar], [data-as-traer], [data-as-notraer], [data-as-crear], [data-as-horarios], [data-as-hzcerrar], [data-as-hzadd], [data-as-hzq], [data-as-cambiar], [data-as-cal], [data-as-diano], [data-as-periodo], [data-as-tp], [data-as-tpno], [data-as-tpcrear], [data-as-deshacer], [data-as-crearya], [data-as-pack]');
        if (!b || !el.contains(b)) return;
        if (b.hasAttribute('data-as-traer')) {
          var it = null;
          (ultimo.pasos[1].items || []).forEach(function (x) { if (x.comp && s(x.comp.ID) === b.getAttribute('data-as-traer')) it = x; });
          if (it && it.traer) { abrirTraer(it); pintar(); }
          return;
        }
        if (b.hasAttribute('data-as-notraer')) { tr = null; pintar(); return; }
        if (b.hasAttribute('data-as-cal')) {
          // Elige el día: debajo del calendario, lo que es y sus partidos (Javi), con los botones para marcarlo o cambiarlo.
          var fc = b.getAttribute('data-as-cal');
          diaSel = diaSel === fc && b.classList.contains('aj-cal-d') ? '' : fc; paso = 'TEMPORADA'; pintar();
          var pd = el.querySelector('#as-dia'); if (pd && pd.scrollIntoView) pd.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (b.hasAttribute('data-as-diano')) { diaSel = ''; pintar(); return; }
        if (b.hasAttribute('data-as-periodo')) { periodo = periodo === b.getAttribute('data-as-periodo') ? '' : b.getAttribute('data-as-periodo'); pintar(); return; }
        if (b.hasAttribute('data-as-tp')) {
          abrirTp(b.getAttribute('data-as-tp')); hecho = null; pintar();
          var pt = el.querySelector('.aj-as-traer'); if (pt && pt.scrollIntoView) pt.scrollIntoView({ block: 'nearest' }); // que no se pierda
          return;
        }
        if (b.hasAttribute('data-as-tpno')) { tp = null; pintar(); return; }
        if (b.hasAttribute('data-as-tpcrear')) { if (tp && !guardandoTr) { if (tp.tipo === 'modelo') crearModelo(); else if (tp.tipo === 'festivos') crearFestivos(); else if (tp.tipo === 'dias') crearDias(); else crearTp(); } return; }
        if (b.hasAttribute('data-as-deshacer') && hecho && hecho.deshacer) {
          var dh = hecho.deshacer; hecho = { texto: 'Deshaciendo…' }; pintar();
          dh().then(function (r) { hecho = null; if (vivo) { ctx.aviso(r && r.quedan ? 'Deshecho, menos ' + r.quedan + ' que ya se usan.' : 'Deshecho.'); pintar(); } },
            function (e) { hecho = null; if (vivo) { ctx.aviso(String((e && e.message) || e).replace(/^\w+:\s*/, '')); pintar(); } });
          return;
        }
        if (b.hasAttribute('data-as-crearya')) {
          var t1 = b.getAttribute('data-as-crearya'), v1 = {}; try { v1 = JSON.parse(b.getAttribute('data-as-valores') || '{}'); } catch (x4) {}
          b.disabled = true;
          hacer(A.crear(t1, v1), 'Puesto: ' + b.textContent.replace(/^Poner /, '').replace(/, como en .*$/, '') + '.', function (r) { return A.quitar(t1, r.id); }).catch(function () {});
          return;
        }
        if (b.hasAttribute('data-as-pack')) {
          var pp = b.getAttribute('data-as-pack').split('|');
          b.disabled = true;
          hacer(ctx.llamar('ligasTraerPack', [pp[0], pp[1], { de: ultimo.ant ? s(ultimo.ant.NOMBRE) : '' }]).then(function (r) { return T.refrescar(['PACKS'], true).then(function () { return r; }, function () { return r; }); }),
            function (r) { return 'Traído el pack: ' + pl(r.dorsales, 'dorsal', 'dorsales') + '.'; }, function (r) { return deshacerTraido(r.ids, ['PACKS']); }).catch(function () {});
          return;
        }
        if (b.hasAttribute('data-as-horarios')) {
          hz = hz === b.getAttribute('data-as-horarios') && paso === 'CAMPOS' ? '' : b.getAttribute('data-as-horarios'); hzQuitar = '';
          if (paso !== 'CAMPOS') { paso = 'CAMPOS'; hecho = null; } // desde «Y después»: al paso de los horarios, con su cuadrante abierto
          pintar();
          var cz = el.querySelector('.aj-as-cuad'); if (cz && cz.scrollIntoView) cz.scrollIntoView({ block: 'center' });
          return;
        }
        if (b.hasAttribute('data-as-hzcerrar')) { hz = ''; hzQuitar = ''; pintar(); return; }
        if (b.hasAttribute('data-as-hzadd') && !hzGuardando) {
          var lh = (datos().ligas || []).filter(function (l) { return s(l.ID) === hz; })[0], p2 = b.getAttribute('data-as-hzadd').split('|');
          if (lh) anadirHorario(lh, p2[0], p2[1]);
          return;
        }
        if (b.hasAttribute('data-as-hzq') && !hzGuardando) { quitarHorario(b.getAttribute('data-as-hzq')); return; }
        if (b.hasAttribute('data-as-crear')) { if (tr && !guardandoTr) crearTraidas(); return; }
        if (b.hasAttribute('data-as-pregunta')) { preguntando = b.getAttribute('data-as-pregunta'); pintar(); return; }
        if (b.hasAttribute('data-as-noquitar')) { preguntando = ''; pintar(); return; }
        if (b.hasAttribute('data-as-quitar')) { var q = porQuitar[b.getAttribute('data-as-quitar')]; if (q) quitar(q); return; }
        if (b.hasAttribute('data-as-paso')) { preguntando = ''; hz = ''; hecho = null; if (!guardandoTr) tp = null; if (!guardandoTr) tr = null; paso = b.getAttribute('data-as-paso'); pintar(); var x = el.querySelector('.aj-as'); if (x && x.scrollIntoView) x.scrollIntoView({ block: 'start' }); return; }
        if (b.hasAttribute('data-as-cambiar')) {
          var cv = {}; try { cv = JSON.parse(b.getAttribute('data-as-valores') || '{}'); } catch (x3) {}
          var t2 = b.getAttribute('data-as-cambiar'), id2 = b.getAttribute('data-as-id'), f2 = (T.filas(t2) || []).filter(function (f) { return s(f.ID) === id2; })[0] || {}, antes = {};
          Object.keys(cv).forEach(function (k) { antes[k] = f2[k] === undefined ? '' : f2[k]; });
          b.disabled = true;
          hacer(A.cambiar(t2, id2, cv), 'Puesto: ' + b.textContent.replace(/^Poner /, '').replace(/, como en .*$/, '') + '.', function () { return A.cambiar(t2, id2, antes); }).catch(function () {});
          return;
        }
        if (b.hasAttribute('data-as-ficha')) { A.ficha(b.getAttribute('data-as-ficha'), b.getAttribute('data-as-id')); return; }
        if (b.hasAttribute('data-as-accion')) { A.abrir(b.getAttribute('data-as-accion')); return; }
        var v = {}; try { v = JSON.parse(b.getAttribute('data-as-valores') || '{}'); } catch (x2) {}
        if (!A.nueva(b.getAttribute('data-as-nueva'), v)) ctx.aviso('Esa tabla no se puede añadir desde Ajustes.');
      });
      // Lo que se cambia en la tabla de traer: el texto se guarda sin repintar; las casillas y los desplegables repintan
      // (cambian los horarios que chocan y lo que dice el botón).
      function campoTr(e, repintar) {
        var x = e.target, k = x.getAttribute && x.getAttribute('data-tr');
        if (!k || !tr) return;
        var f = tr.filas[Number(x.getAttribute('data-i'))];
        if (!f) return;
        f[k] = x.type === 'checkbox' ? x.checked : x.value;
        if (repintar) pintar();
      }
      function campoTp(e, repintar) {
        var x = e.target, k = x.getAttribute && x.getAttribute('data-tp');
        if (!k || !tp) return;
        // Los del panel del modelo van en tp; los de cada fila, en su fila.
        if (!x.hasAttribute('data-i')) { tp[k] = x.value; if (repintar || k === 'modo' || k === 'tipoDia' || x.tagName === 'SELECT' || x.type === 'date') pintar(); else actualizarBotonTp(); return; }
        var f = tp.filas[Number(x.getAttribute('data-i'))];
        if (!f) return;
        f[k] = x.type === 'checkbox' ? x.checked : x.value;
        if (repintar) pintar();
      }
      /** El botón del panel del modelo se activa al escribir el nombre y la prenda, sin repintar (no se pierde lo escrito). */
      function actualizarBotonTp() {
        var bt = el.querySelector('[data-as-tpcrear]');
        if (bt && tp && tp.tipo === 'dias') { bt.disabled = !(s(tp.MOTIVO).trim() && tp.desde && tp.hasta && tp.hasta >= tp.desde && !guardandoTr); return; }
        if (!bt || !tp || tp.tipo !== 'modelo') return;
        var n = tp.filas.filter(function (f) { return f.sel; }).length;
        bt.disabled = !(n && !guardandoTr && (tp.modo !== 'usar' ? s(tp.NOMBRE).trim() : tp.ID_MODELO));
      }
      el.addEventListener('input', function (e) { campoTr(e, false); campoTp(e, false); });
      el.addEventListener('change', function (e) {
        campoTr(e, e.target.type === 'checkbox' || e.target.tagName === 'SELECT' || e.target.getAttribute('data-tr') === 'MINUTOS_PARTIDO');
        campoTp(e, e.target.type === 'checkbox');
      });
      // Cada cambio repinta; varios seguidos (un alta con su LOG), una sola vez.
      ctx.alCambiar(function (t) {
        if (TABLAS.indexOf(t) < 0 || !vivo) return;
        if (pend) clearTimeout(pend);
        pend = setTimeout(function () { pend = null; pintar(); }, 50);
      });
      T.leer(TABLAS).then(function () { pintar(); mirarPartidos(); }, function () { pintar(); mirarPartidos(); });
      pintar();
    },
    cerrar: function () { if (fin) fin(); fin = null; }
  });
})();
