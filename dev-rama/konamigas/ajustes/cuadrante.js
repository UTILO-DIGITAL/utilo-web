/*
 * Cuadrante de campos · Konamigas · vistas de Ajustes (T0292): «Lo alquilado» en Franjas alquiladas y «Reparto» en Horarios de las ligas
 *
 * Lo alquilado: lo de cada día, vacío, partido en partidos, y si llega para los partidos de las ligas de ese día.
 * Reparto: lo que sigue.
 *
 * La semana de una temporada, día a día: cada campo una columna y el tiempo hacia abajo, a escala (un partido de 45
 * minutos mide 45). De fondo, lo alquilado (las franjas de DISPONIBILIDAD_CAMPOS de su campo en esa temporada); encima,
 * cada partido de los horarios (HUECOS) con lo que dura su liga (LIGAS · MINUTOS_PARTIDO). Avisa de dos partidos en el
 * mismo campo a la vez (si sus competiciones se juegan a la vez: la copa va después de su liga; la «Fase» de arriba
 * enseña solo lo de una) y de los que caen fuera de lo alquilado (si ese campo tiene franjas ese día; sin franjas, no se
 * sabe y no avisa).
 *
 * Debajo, «Partidos por meter»: las ligas de ese día con los partidos que necesitan cada semana (la mitad de sus equipos,
 * sin contar las bajas: 9 equipos, 4 partidos) y los que ya tienen sitio. Los que faltan se arrastran al hueco que encaje;
 * un partido puesto se arrastra a otro campo u hora, o de vuelta a la caja para quitarlo. Si una liga tiene más sitios que
 * partidos, lo dice. Arriba, las alertas del día: dos partidos a la vez, fuera de lo alquilado, partidos que faltan o sitios
 * que sobran, y lo alquilado sin usar (campos de más). Tocar un partido abre su horario; un hueco libre, un horario nuevo ahí; un campo, su ficha. Guarda con
 * ctx.ajustes, que comprueba lo mismo que la ficha (no se pisan). Lee las tablas que ya tiene Ajustes: no llama al motor.
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  // Lo que dura un partido sin dato de su liga; también, lo que se usa para buscar huecos libres en un campo sin partidos.
  var DURA_SIN_DATO = 45;

  function min(h, fin) {
    var m = /^(\d\d):(\d\d)$/.exec(String(h == null ? '' : h));
    if (!m) return null;
    var x = Number(m[1]) * 60 + Number(m[2]);
    return fin && x === 0 ? 1440 : x;
  }
  function hhmm(m) { m = m % 1440; var h = Math.floor(m / 60), x = m % 60; return (h < 10 ? '0' : '') + h + ':' + (x < 10 ? '0' : '') + x; }
  function porId(fs) { var o = {}; (fs || []).forEach(function (f) { o[String(f.ID)] = f; }); return o; }
  function pisan(a, b) { return a[0] < b[1] && b[0] < a[1]; }

  /** El nivel de una competición: 0 si no sale de ninguna (una liga), 1 si sale de una de nivel 0 (su copa)… */
  function nivel(id, origen) {
    var n = 0, hoy = [String(id)], vistos = {};
    for (var paso = 0; paso <= origen.length; paso++) {
      var antes = [];
      origen.forEach(function (o) { var de = String(o.ID_COMPETICION_ORIGEN); if (hoy.indexOf(String(o.ID_COMPETICION)) >= 0 && !vistos[de]) { vistos[de] = 1; antes.push(de); } });
      if (!antes.length) return n;
      n++; hoy = antes;
    }
    return n;
  }
  /**
   * ¿Se juegan a la vez dos competiciones? Solo las del mismo nivel (las copas, que salen de una liga, van después de las
   * ligas aunque las fechas se toquen un par de días) y con fechas que se tocan (la KDM de junio, no).
   */
  function aLaVez(a, b, origen) {
    if (!a || !b || String(a.ID) === String(b.ID)) return true;
    if (nivel(a.ID, origen || []) !== nivel(b.ID, origen || [])) return false;
    var ai = String(a.FECHA_INICIO || ''), af = String(a.FECHA_FIN || ''), bi = String(b.FECHA_INICIO || ''), bf = String(b.FECHA_FIN || '');
    return !((af && bi && af < bi) || (bf && ai && bf < ai));
  }

  /**
   * Las fases de una temporada: grupos de competiciones con ligas que se juegan a la vez (la LIGA con la SENIOR; después,
   * sus copas). [{ ids: [competición], nombre: 'LIGA · SENIOR', desde, hasta }], por fecha de inicio.
   */
  function fases(d, per) {
    var cs = (d.comps || []).filter(function (c) { return String(c.ID_TEMPORADA) === per && (d.ligas || []).some(function (l) { return l.ID_COMPETICION === c.ID; }); })
      .sort(function (a, b) { return String(a.FECHA_INICIO || '').localeCompare(String(b.FECHA_INICIO || '')) || String(a.NOMBRE).localeCompare(String(b.NOMBRE), 'es'); });
    var sg = d.origen || [], out = [];
    cs.sort(function (a, b) { return nivel(a.ID, sg) - nivel(b.ID, sg); }); // primero las ligas, luego sus copas (estable: por fecha dentro)
    cs.forEach(function (c) {
      // Entra en la primera fase con la que se juega a la vez; si no, abre otra.
      var g = out.filter(function (x) { return x.cs.some(function (y) { return aLaVez(y, c, sg); }); })[0];
      if (!g) out.push(g = { cs: [] });
      g.cs.push(c);
    });
    return out.map(function (g) {
      var ini = g.cs.map(function (c) { return String(c.FECHA_INICIO || ''); }).filter(String).sort()[0] || '';
      var fin = g.cs.map(function (c) { return String(c.FECHA_FIN || ''); }).filter(String).sort().pop() || '';
      return { ids: g.cs.map(function (c) { return String(c.ID); }), nombre: g.cs.map(function (c) { return c.NOMBRE; }).join(' · '), desde: ini, hasta: fin };
    }).sort(function (a, b) { return a.desde.localeCompare(b.desde); });
  }

  /** Lo de una temporada que usan el cuadrante y el reparto: sus ligas, sus horarios y lo que dura cada uno. fase: solo esas competiciones. */
  function base(d, per, dura, fase) {
    var ligas = porId(d.ligas), comps = porId(d.comps);
    var perLiga = function (id) {
      var l = ligas[id], c = l && comps[l.ID_COMPETICION];
      return c && (!fase || fase.ids.indexOf(String(c.ID)) >= 0) ? String(c.ID_TEMPORADA) : '';
    };
    var durH = function (h) { var x = dura ? Number(dura(h)) : 0; return x > 0 ? x : DURA_SIN_DATO; };
    var sg = d.origen || [];
    return {
      ligas: ligas, durH: durH,
      // Dos horarios solo chocan si sus competiciones se juegan a la vez.
      juntos: function (h, g) { var a = ligas[h.ID_LIGA], b = ligas[g.ID_LIGA]; return aLaVez(a && comps[a.ID_COMPETICION], b && comps[b.ID_COMPETICION], sg); },
      deTem: (d.ligas || []).filter(function (l) { return perLiga(l.ID) === per; }),
      huecos: (d.huecos || []).filter(function (h) { return perLiga(h.ID_LIGA) === per && min(h.HORA) !== null && h.ID_CAMPO && h.DIA_SEMANA; })
    };
  }

  /**
   * El cuadrante de una temporada (per). d: las filas de CAMPOS, INSTALACIONES, CAMPOS_TEMPORADA, DISPONIBILIDAD_CAMPOS,
   * HUECOS, LIGAS y COMPETICIONES. dura(hueco): lo que dura un partido de ese horario (el de su liga; sin dato, 45).
   * Devuelve { campos: [{ id, nombre, inst, estado }], dias, rango: { día: [desde, hasta] } (en minutos, a horas enteras),
   * de(campo, día) → { franjas: [[a, b, fila]], partidos: [{ h, a, b, choque, fuera, carril, carriles }], libres: [[a, b]],
   * trozos: [{ a, b, f (fila de la franja), suelto }] } }. Libres: dentro de lo alquilado, cada sitio donde cabe un partido (el
   * más corto de ese campo y día), pegado al anterior. Trozos: los huecos de lo alquilado sin mirar los partidos.
   */
  /**
   * ¿Vale la franja f (FECHA_DESDE y FECHA_HASTA; vacías, toda la temporada) ese día (fecha) o, sin fecha, en algún
   * momento de la fase?
   */
  function vale(f, fecha, fase) {
    var a = String(f.FECHA_DESDE || ''), b = String(f.FECHA_HASTA || '');
    if (fecha) return (!a || a <= fecha) && (!b || fecha <= b);
    if (fase) return !((b && fase.desde && b < fase.desde) || (a && fase.hasta && fase.hasta < a));
    return true;
  }
  /** Los días en que cambian las franjas dentro de la fase (cuando empieza una o el día después de que acabe otra). */
  function cambios(d, per, fase) {
    var ctp = {}; (d.ctps || []).forEach(function (c) { if (String(c.ID_TEMPORADA) === per) ctp[c.ID] = 1; });
    var out = {};
    (d.franjas || []).forEach(function (f) {
      if (!ctp[f.ID_CAMPO_TEMPORADA]) return;
      if (f.FECHA_DESDE) out[String(f.FECHA_DESDE)] = 1;
      if (f.FECHA_HASTA) { var x = new Date(String(f.FECHA_HASTA) + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); out[x.toISOString().slice(0, 10)] = 1; }
    });
    return Object.keys(out).filter(function (x) { return !fase || ((!fase.desde || x > fase.desde) && (!fase.hasta || x <= fase.hasta)); }).sort();
  }

  function cuadrante(d, per, dura, fase, fecha) {
    var B = base(d, per, dura, fase), campos = porId(d.campos), insts = porId(d.insts);
    var ctps = (d.ctps || []).filter(function (c) { return String(c.ID_TEMPORADA) === per && c.ESTADO !== 'Descartado'; });
    var ctpCampo = {}; ctps.forEach(function (c) { ctpCampo[c.ID] = c; });
    var franjas = {}; // 'campo|día' → [[desde, hasta]]
    (d.franjas || []).forEach(function (f) {
      var c = ctpCampo[f.ID_CAMPO_TEMPORADA], a = min(f.HORA_DESDE), b = min(f.HORA_HASTA, true);
      if (!c || a === null || b === null || b <= a || !vale(f, fecha, fase)) return;
      (franjas[c.ID_CAMPO + '|' + f.DIA_SEMANA] = franjas[c.ID_CAMPO + '|' + f.DIA_SEMANA] || []).push([a, b, f]);
    });
    // Campos: los contratados (o en negociación) de esa temporada y los que tienen algún partido; por instalación y nombre.
    var ids = {};
    ctps.forEach(function (c) { ids[c.ID_CAMPO] = c.ESTADO || ''; });
    B.huecos.forEach(function (h) { if (!(h.ID_CAMPO in ids)) ids[h.ID_CAMPO] = ''; });
    var lista = Object.keys(ids).filter(function (id) { return campos[id]; }).map(function (id) {
      var c = campos[id], i = insts[c.ID_INSTALACION];
      return { id: id, nombre: String(c.NOMBRE || id), inst: i ? String(i.NOMBRE || '') : '', estado: ids[id] };
    }).sort(function (a, b) { return (a.inst + ' ' + a.nombre).localeCompare(b.inst + ' ' + b.nombre, 'es'); });
    // Días: los que tienen partidos, franjas o alguna liga (para empezar a repartir la de un día vacío).
    var hay = {};
    B.huecos.forEach(function (h) { hay[h.DIA_SEMANA] = 1; });
    Object.keys(franjas).forEach(function (k) { hay[k.split('|')[1]] = 1; });
    B.deTem.forEach(function (l) { if (l.DIA_SEMANA) hay[l.DIA_SEMANA] = 1; });
    var dias = DIAS.filter(function (x) { return hay[x]; });
    // Lo más corto que dura un partido de las ligas de cada día (para los libres de un campo sin partidos).
    var corto = {};
    B.deTem.forEach(function (l) { var x = B.durH({ ID_LIGA: l.ID }); if (l.DIA_SEMANA) corto[l.DIA_SEMANA] = Math.min(corto[l.DIA_SEMANA] || Infinity, x); });
    var cache = {};
    function de(campo, dia) {
      var k = campo + '|' + dia;
      if (cache[k]) return cache[k];
      var fr = franjas[k] || [];
      var ps = B.huecos.filter(function (h) { return h.ID_CAMPO === campo && h.DIA_SEMANA === dia; }).map(function (h) {
        var a = min(h.HORA); return { h: h, a: a, b: a + B.durH(h) };
      }).sort(function (x, y) { return x.a - y.a || String(x.h.ID).localeCompare(String(y.h.ID)); });
      // Carriles: dos que se pisan van uno al lado del otro (y los dos en rojo).
      var fines = [];
      ps.forEach(function (p) {
        p.choque = ps.some(function (q) { return q !== p && pisan([p.a, p.b], [q.a, q.b]) && B.juntos(p.h, q.h); });
        // Sin franja que lo cubra (ni ninguna ese día en ese campo): se juega donde no hay nada reservado.
        p.fuera = !fr.some(function (r) { return p.a >= r[0] && p.b <= r[1]; });
        var i = 0; while (i < fines.length && fines[i] > p.a) i++;
        p.carril = i; fines[i] = p.b;
      });
      ps.forEach(function (p) { p.carriles = p.choque ? fines.length : 1; if (!p.choque) p.carril = 0; });
      var paso = ps.length ? Math.min.apply(null, ps.map(function (p) { return p.b - p.a; })) : (corto[dia] || DURA_SIN_DATO);
      var libres = [];
      fr.forEach(function (r) {
        var m = r[0];
        while (m + paso <= r[1]) {
          var tapa = ps.filter(function (p) { return pisan([m, m + paso], [p.a, p.b]); });
          if (tapa.length) { m = Math.max.apply(null, tapa.map(function (p) { return p.b; })); continue; }
          libres.push([m, m + paso]); m += paso;
        }
      });
      // Los huecos de lo alquilado, sin mirar los partidos: cada franja partida en partidos de la liga más corta de ese día
      // (Lunes de 21:00 a 23:15 con ligas de 45: 21:00, 21:45 y 22:30). Lo que no llega a un partido, suelto.
      var P = corto[dia] || DURA_SIN_DATO, trozos = [];
      fr.forEach(function (r) {
        var m = r[0];
        for (; m + P <= r[1]; m += P) trozos.push({ a: m, b: m + P, f: r[2] });
        if (m < r[1]) trozos.push({ a: m, b: r[1], f: r[2], suelto: true });
      });
      return (cache[k] = { franjas: fr, partidos: ps, libres: libres, paso: paso, trozos: trozos });
    }
    var rango = {};
    dias.forEach(function (x) {
      var a = Infinity, b = -Infinity;
      lista.forEach(function (c) {
        var y = de(c.id, x);
        y.franjas.forEach(function (r) { a = Math.min(a, r[0]); b = Math.max(b, r[1]); });
        y.partidos.forEach(function (p) { a = Math.min(a, p.a); b = Math.max(b, p.b); });
      });
      if (a === Infinity) { a = 20 * 60; b = 24 * 60; }
      rango[x] = [Math.floor(a / 60) * 60, Math.min(Math.ceil(b / 60) * 60, 25 * 60)];
    });
    return { campos: lista, dias: dias, rango: rango, de: de };
  }

  /**
   * Los partidos por meter de un día: [{ l (liga), equipos, partidos, puestos, faltan, sobran }]. Partidos por semana: la
   * mitad de sus equipos (sin las bajas), redondeando hacia abajo (9 equipos, 4: una descansa); sin equipos, null (no se
   * sabe todavía). Puestos: sus horarios de ese día. Entran las ligas de ese día y las que tienen algún horario ese día.
   */
  function reparto(d, per, dia, fase) {
    var B = base(d, per, null, fase), eq = {}, pu = {};
    (d.inscripciones || []).forEach(function (i) { if (i.ESTADO !== 'Baja') eq[i.ID_LIGA] = (eq[i.ID_LIGA] || 0) + 1; });
    B.huecos.forEach(function (h) { if (h.DIA_SEMANA === dia) pu[h.ID_LIGA] = (pu[h.ID_LIGA] || 0) + 1; });
    return B.deTem.filter(function (l) { return l.DIA_SEMANA === dia || pu[l.ID]; }).map(function (l) {
      var e = eq[l.ID] || 0, n = e ? Math.floor(e / 2) : null, p = pu[l.ID] || 0;
      return { l: l, equipos: e, partidos: n, puestos: p, faltan: n === null ? 0 : Math.max(n - p, 0), sobran: n === null ? 0 : Math.max(p - n, 0) };
    }).sort(function (a, b) {
      return (Number(a.l.NIVEL) || 9) - (Number(b.l.NIVEL) || 9) || String(a.l.NOMBRE).localeCompare(String(b.l.NOMBRE), 'es', { numeric: true });
    });
  }

  /**
   * Lo que no cuadra un día, de lo más grave a lo menos: [{ tipo, ... }]. 'choque' (dos partidos a la vez en un campo:
   * { campo, a, huecos }), 'fuera' (los partidos de un campo fuera de lo alquilado: { campo, partidos, sinFranjas }), 'faltan' y 'sobran' (una liga
   * con menos o más sitios que partidos: { liga, n }) y 'sinUsar' (un campo alquilado con sitios sin partido: { campo, libres }).
   * c: el cuadrante; rep: el reparto de ese día.
   */
  function alertas(c, rep, dia) {
    var out = [];
    c.campos.forEach(function (k) {
      var vistos = {};
      c.de(k.id, dia).partidos.forEach(function (p) {
        if (!p.choque || vistos[p.h.ID]) return;
        var con = c.de(k.id, dia).partidos.filter(function (q) { return q === p || (q.choque && pisan([p.a, p.b], [q.a, q.b])); });
        con.forEach(function (q) { vistos[q.h.ID] = 1; });
        out.push({ tipo: 'choque', campo: k, a: p.a, huecos: con.map(function (q) { return q.h; }) });
      });
    });
    c.campos.forEach(function (k) {
      var x = c.de(k.id, dia), fs = x.partidos.filter(function (p) { return p.fuera; });
      if (fs.length) out.push({ tipo: 'fuera', campo: k, partidos: fs, sinFranjas: !x.franjas.length });
    });
    rep.forEach(function (r) { if (r.faltan) out.push({ tipo: 'faltan', liga: r.l, n: r.faltan }); });
    rep.forEach(function (r) { if (r.sobran) out.push({ tipo: 'sobran', liga: r.l, n: r.sobran }); });
    c.campos.forEach(function (k) { var l = c.de(k.id, dia).libres; if (l.length) out.push({ tipo: 'sinUsar', campo: k, libres: l }); });
    return out;
  }

  /**
   * Cuántos huecos hay alquilados un día frente a los partidos que necesitan sus ligas: { huecos, partidos, sinEquipos,
   * campos }. Partidos: la suma de los de las ligas con equipos; sinEquipos: cuántas ligas no los tienen todavía.
   */
  function cuenta(c, rep, dia) {
    var h = 0, n = 0;
    c.campos.forEach(function (k) { var t = c.de(k.id, dia).trozos.filter(function (x) { return !x.suelto; }).length; h += t; if (t) n++; });
    return { huecos: h, campos: n, partidos: rep.reduce(function (s, r) { return s + (r.partidos || 0); }, 0),
      sinEquipos: rep.filter(function (r) { return r.partidos === null; }).length };
  }

  /**
   * Las franjas que faltan, sacadas de los horarios de las ligas de la temporada: una por campo y día sin ninguna, de la
   * primera hora al final del último partido. Necesita su fila de CAMPOS_TEMPORADA (no descartada). Devuelve
   * { nuevas: [{ ID_CAMPO_TEMPORADA, DIA_SEMANA, HORA_DESDE, HORA_HASTA, campo }], sinContrato: [ID_CAMPO] }.
   */
  function rellenar(d, per, dura) {
    var B = base(d, per, dura), ctp = {}, ya = {}, gr = {}, out = { nuevas: [], sinContrato: [] };
    (d.ctps || []).forEach(function (c) { if (String(c.ID_TEMPORADA) === per && c.ESTADO !== 'Descartado') ctp[c.ID_CAMPO] = c; });
    var deCtp = {}; Object.keys(ctp).forEach(function (k) { deCtp[ctp[k].ID] = k; });
    (d.franjas || []).forEach(function (f) { if (deCtp[f.ID_CAMPO_TEMPORADA]) ya[deCtp[f.ID_CAMPO_TEMPORADA] + '|' + f.DIA_SEMANA] = 1; });
    B.huecos.forEach(function (h) {
      var k = h.ID_CAMPO + '|' + h.DIA_SEMANA, a = min(h.HORA), b = a + B.durH(h);
      if (ya[k]) return;
      var g = gr[k] = gr[k] || { campo: h.ID_CAMPO, dia: h.DIA_SEMANA, a: a, b: b };
      g.a = Math.min(g.a, a); g.b = Math.max(g.b, b);
    });
    Object.keys(gr).sort().forEach(function (k) {
      var g = gr[k];
      if (!ctp[g.campo]) { if (out.sinContrato.indexOf(g.campo) < 0) out.sinContrato.push(g.campo); return; }
      out.nuevas.push({ ID_CAMPO_TEMPORADA: ctp[g.campo].ID, DIA_SEMANA: g.dia, HORA_DESDE: hhmm(g.a), HORA_HASTA: hhmm(Math.min(g.b, 1440)), campo: g.campo });
    });
    return out;
  }

  /** Cuántos días de la semana dia (Lunes…) hay de a a b, los dos incluidos (fechas aaaa-mm-dd). */
  function cuantos(dia, a, b) {
    if (!a || !b || b < a) return 0;
    var x = new Date(a + 'T12:00:00Z'), fin = new Date(b + 'T12:00:00Z'), n = 0, ds = DIAS.indexOf(dia);
    while (x <= fin) { if ((x.getUTCDay() + 6) % 7 === ds) n++; x.setUTCDate(x.getUTCDate() + 1); }
    return n;
  }
  function antesDe(f) { var x = new Date(f + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); }
  function despuesDe(f) { var x = new Date(f + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); }

  /**
   * Si las fechas de cada franja cuadran con cuándo se juega en ese campo y día: desde que empieza la primera liga que lo
   * usa (su FECHA_INICIO o la de su competición) hasta que acaba la última competición (también la copa). Sin fechas, la
   * franja vale toda la temporada (tem: FECHA_INICIO y FECHA_FIN). Devuelve [{ f, campo, dia, alq: [desde, hasta], juego:
   * [desde, hasta] | null, sinFechas, deMas: [antes, después] (cuántos días de ese día alquilados sin partidos), faltan:
   * [antes, después] (cuántos con partidos sin franja) }], solo las que no cuadran.
   */
  function fechasFranjas(d, per, tem) {
    var ligas = porId(d.ligas), comps = porId(d.comps), ctp = {};
    (d.ctps || []).forEach(function (c) { if (String(c.ID_TEMPORADA) === per) ctp[c.ID] = c; });
    var juego = {};
    (d.huecos || []).forEach(function (h) {
      var l = ligas[h.ID_LIGA], c = l && comps[l.ID_COMPETICION];
      if (!c || String(c.ID_TEMPORADA) !== per) return;
      var a = String(l.FECHA_INICIO || c.FECHA_INICIO || ''), b = String(c.FECHA_FIN || '');
      if (!a || !b) return;
      var k = h.ID_CAMPO + '|' + h.DIA_SEMANA, j = juego[k];
      juego[k] = j ? [a < j[0] ? a : j[0], b > j[1] ? b : j[1]] : [a, b];
    });
    var t0 = String((tem && tem.FECHA_INICIO) || ''), t1 = String((tem && tem.FECHA_FIN) || '');
    var out = [];
    (d.franjas || []).forEach(function (f) {
      var c = ctp[f.ID_CAMPO_TEMPORADA];
      if (!c) return;
      var a = String(f.FECHA_DESDE || t0), b = String(f.FECHA_HASTA || t1), j = juego[c.ID_CAMPO + '|' + f.DIA_SEMANA] || null, dia = f.DIA_SEMANA;
      if (!a || !b) return;
      var x = { f: f, campo: c.ID_CAMPO, dia: dia, alq: [a, b], juego: j, sinFechas: !f.FECHA_DESDE && !f.FECHA_HASTA, deMas: [0, 0], faltan: [0, 0] };
      if (!j) x.deMas = [cuantos(dia, a, b), 0];
      else {
        x.deMas = [a < j[0] ? cuantos(dia, a, antesDe(j[0])) : 0, b > j[1] ? cuantos(dia, despuesDe(j[1]), b) : 0];
        x.faltan = [a > j[0] ? cuantos(dia, j[0], antesDe(a)) : 0, b < j[1] ? cuantos(dia, despuesDe(b), j[1]) : 0];
      }
      if (x.deMas[0] || x.deMas[1] || x.faltan[0] || x.faltan[1]) out.push(x);
    });
    return out;
  }

  var CALC = { fechasFranjas: fechasFranjas, cuantos: cuantos, vale: vale, cambios: cambios, rellenar: rellenar, cuadrante: cuadrante, reparto: reparto, alertas: alertas, cuenta: cuenta, fases: fases, aLaVez: aLaVez, min: min, hhmm: hhmm };
  if (typeof window === 'undefined' || !window.UN || !window.UN.ajustes) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function guardado(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) {} return ''; }
  var TABLAS = ['CAMPOS', 'INSTALACIONES', 'CAMPOS_TEMPORADA', 'DISPONIBILIDAD_CAMPOS', 'HUECOS', 'LIGAS', 'COMPETICIONES', 'INSCRIPCIONES_EQUIPOS', 'COMPETICIONES_ORIGEN', 'TEMPORADAS'];
  function fecha(s) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || '')); return m ? m[3] + '/' + m[2] : ''; }
  var PX = 1.6;   // píxeles por minuto: un partido de 45 minutos, 72
  var IMAN = 15;  // al soltar, la hora va de 15 en 15 minutos

  window.UN.ajustes('CUADRANTE', {
    abrir: function (el, ctx) {
      var A = ctx.ajustes, T = ctx.tablas, S = { dia: guardado('aj_cu_dia'), todos: false }, c = null, arr = null, sinClic = false;
      var dura = function (h) { return A.dura('HUECOS', h); };
      // Dos vistas con el mismo cuadrante: «Lo alquilado» (en Franjas alquiladas: lo alquilado, vacío, y si llega para los
      // partidos) y «Reparto» (en Horarios de las ligas: los partidos en los huecos, arrastrando).
      var reparte = ctx.tabla === 'HUECOS';
      var puede = reparte && A.puede('HUECOS'), puedeAlq = A.puede('DISPONIBILIDAD_CAMPOS');
      function datos() {
        return { campos: T.filas('CAMPOS'), insts: T.filas('INSTALACIONES'), ctps: T.filas('CAMPOS_TEMPORADA'), franjas: T.filas('DISPONIBILIDAD_CAMPOS'),
          huecos: T.filas('HUECOS'), ligas: T.filas('LIGAS'), comps: T.filas('COMPETICIONES'), inscripciones: T.filas('INSCRIPCIONES_EQUIPOS'), origen: T.filas('COMPETICIONES_ORIGEN'),
          temporadas: T.filas('TEMPORADAS') };
      }
      function y(m) { return Math.round((m - c.rango[S.dia][0]) * PX); }
      function pintar() {
        if (!el.isConnected || arr) return;
        var per = A.periodo(), lista = A.periodos(), d = datos();
        // La fase (la liga, y después la copa): solo lo que se juega a la vez. Por defecto, la de hoy o la primera.
        var fs = fases(d, per), hoy = new Date().toISOString().slice(0, 10);
        var fase = fs.filter(function (f) { return f.ids.join() === S.fase; })[0] ||
          fs.filter(function (f) { return (!f.desde || f.desde <= hoy) && (!f.hasta || hoy <= f.hasta); })[0] || fs[0] || null;
        S.fase = fase ? fase.ids.join() : ''; S.faseObj = fase;
        // La semana: las franjas pueden cambiar dentro de la fase (el Cemento hasta enero). Solo si alguna tiene fechas.
        var cs0 = cambios(d, per, fase), conFechas = (d.franjas || []).some(function (f) { return f.FECHA_DESDE || f.FECHA_HASTA; });
        if (!conFechas) S.fecha = '';
        else if (!S.fecha || (fase && ((fase.desde && S.fecha < fase.desde) || (fase.hasta && S.fecha > fase.hasta)))) {
          S.fecha = fase && fase.desde && hoy < fase.desde ? fase.desde : fase && fase.hasta && hoy > fase.hasta ? fase.hasta : hoy;
        }
        c = cuadrante(d, per, dura, fase, S.fecha);
        var rep = function (x) { return reparto(d, per, x, fase); };
        if (c.dias.indexOf(S.dia) < 0) S.dia = c.dias[0] || '';
        var html = '<p class="u-nota n-ayuda">' + (reparte ? 'La semana de cada campo, a escala: lo alquilado de fondo y cada partido con lo que dura su liga.' +
          (puede ? ' Arrastra los partidos para cambiarlos de campo u hora, o desde la caja de abajo para ponerlos.' : '') :
          'Lo que tienes alquilado cada día, vacío: las franjas de cada campo partidas en huecos de un partido (de lo que dura la liga más corta de ese día). ' +
          'Arriba, si llegan para los partidos de las ligas de ese día. Los partidos se ponen en «Horarios de las ligas».' +
          (puedeAlq ? ' Toca un hueco para cambiar su franja.' : '')) + '</p>' +
          '<div class="u-filtros"><label class="u-campo"><span class="u-etiqueta">Temporada</span><select id="cu-per">' + lista.map(function (p) {
            return '<option value="' + texto(p.id) + '"' + (p.id === per ? ' selected' : '') + '>' + texto(p.nombre) + '</option>';
          }).join('') + '</select></label>' + (fs.length > 1 ? '<label class="u-campo"><span class="u-etiqueta">Fase</span><select id="cu-fase">' + fs.map(function (f) {
            return '<option value="' + texto(f.ids.join()) + '"' + (f.ids.join() === S.fase ? ' selected' : '') + '>' + texto(f.nombre) + (f.desde ? ' · ' + fecha(f.desde) + '–' + fecha(f.hasta) : '') + '</option>';
          }).join('') + '</select></label>' : '') +
          (S.fecha ? '<label class="u-campo"><span class="u-etiqueta">Semana del</span><input type="date" id="cu-fecha" value="' + texto(S.fecha) + '"' +
            (fase && fase.desde ? ' min="' + texto(fase.desde) + '"' : '') + (fase && fase.hasta ? ' max="' + texto(fase.hasta) + '"' : '') + '></label>' : '') + '</div>' +
          (S.fecha && cs0.length ? '<p class="aj-cu-cambios">Las franjas cambian el ' + cs0.map(function (x) {
            return '<button type="button" class="u-btn u-btn-texto" data-fecha="' + texto(x) + '"' + (x === S.fecha ? ' aria-current="true"' : '') + '>' + fecha(x) + '</button>';
          }).join(', ') + '. Lo alquilado es lo de la semana elegida.</p>' : '');
        html += cajaRellenar(d, per);
        if (!c.dias.length) {
          el.innerHTML = html + '<p class="u-vacio">Esta temporada todavía no tiene ligas, horarios ni campos alquilados. Se ponen en «Ligas», en «Franjas alquiladas de los campos» y en «Horarios de las ligas».</p>';
          oir(); return;
        }
        html += '<div class="u-pestanas" role="tablist">' + c.dias.map(function (x) {
          var rp = rep(x), q = cuenta(c, rp, x);
          var n = reparte ? alertas(c, rp, x).filter(function (a) { return a.tipo !== 'sinUsar'; }).length : (q.huecos < q.partidos ? 1 : 0);
          return '<button type="button" role="tab" data-dia="' + texto(x) + '" aria-selected="' + (x === S.dia) + '">' + texto(x) +
            (!reparte ? ' <span class="u-cifra">' + q.huecos + '</span>' : '') + (n ? ' <span class="u-chip aj-cu-n">⚠' + (reparte ? ' ' + n : '') + '</span>' : '') + '</button>';
        }).join('') + '</div>';
        // Los campos de ese día (con franjas o partidos); con «Todos los campos», también los demás de la temporada.
        var cs = c.campos.filter(function (k) { var x = c.de(k.id, S.dia); return S.todos || x.franjas.length || (reparte && x.partidos.length); });
        if (!cs.length) cs = c.campos;
        var R = c.rango[S.dia], alto = y(R[1]);
        var horas = '';
        for (var m = R[0]; m <= R[1]; m += 15) horas += '<span class="' + (m % 60 ? '' : 'aj-cu-en') + '" style="top:' + y(m) + 'px">' + (m % 30 ? '' : hhmm(m)) + '</span>';
        html += reparte ? avisos(alertas(c, rep(S.dia), S.dia)) : resumen(cuenta(c, rep(S.dia), S.dia));
        if (!reparte) html += cajaFechas(d, per);
        html += '<label class="u-check aj-cu-todos"><input type="checkbox" id="cu-todos"' + (S.todos ? ' checked' : '') + '> Todos los campos de la temporada</label>' +
          '<div class="aj-cu-caja"><div class="aj-cu" style="grid-template-columns: 52px repeat(' + cs.length + ', minmax(140px, 1fr))">' +
          '<div></div>' + cs.map(function (k) {
            return '<div class="aj-cu-cab"><button type="button" class="u-btn u-btn-texto" data-campo="' + texto(k.id) + '">' + texto((k.inst ? k.inst + ' · ' : '') + k.nombre) + '</button>' +
              (k.estado && k.estado !== 'Contratado' ? ' <span class="u-chip">' + texto(k.estado) + '</span>' : '') + '</div>';
          }).join('') +
          '<div class="aj-cu-horas" style="height:' + alto + 'px">' + horas + '</div>' + cs.map(function (k) { return reparte ? columna(k, R, alto) : columnaAlq(k, alto); }).join('') +
          '</div></div>' +
          (reparte ? '<p class="aj-cu-ley"><span class="aj-cu-alq">Alquilado</span><span class="aj-cu-no">Sin alquilar</span><span class="aj-cu-choque">⚠ Dos partidos a la vez</span><span class="aj-cu-fuera">Fuera de lo alquilado</span></p>' +
            '<p class="u-nota">Lo que no tiene franja alquilada sale en gris: un partido ahí no tiene campo reservado.</p>' + bandeja(d, per) :
            (puedeAlq ? '<p><button type="button" class="u-btn" data-alq-nueva>Añadir una franja el ' + texto(S.dia.toLowerCase()) + '</button></p>' : ''));
        el.innerHTML = html;
        oir();
      }
      /** Las alertas del día, arriba del cuadrante: cada una se toca para ir a lo que la causa. */
      function avisos(as) {
        if (!as.length) return '<p class="aj-cu-ok">✓ Este día cuadra: ningún partido a la vez, todos dentro de lo alquilado y cada liga con sus partidos.</p>';
        var campo = function (k) { return texto((k.inst ? k.inst + ' · ' : '') + k.nombre); }, liga = function (id) { return texto(A.nombre('LIGAS', id)); };
        var graves = as.filter(function (a) { return a.tipo !== 'sinUsar'; }), leves = as.filter(function (a) { return a.tipo === 'sinUsar'; });
        var li = function (a) {
          if (a.tipo === 'choque') return '<li><button type="button" class="u-btn u-btn-texto" data-hueco="' + texto(a.huecos[0].ID) + '">Dos partidos a la vez</button> en ' + campo(a.campo) + ' a las ' + hhmm(a.a) + ': ' +
            a.huecos.map(function (h) { return liga(h.ID_LIGA); }).join(' y ') + '.</li>';
          if (a.tipo === 'fuera') return '<li><button type="button" class="u-btn u-btn-texto" data-hueco="' + texto(a.partidos[0].h.ID) + '">' + (a.sinFranjas ? 'Sin alquilar' : 'Fuera de lo alquilado') + '</button>: ' +
            campo(a.campo) + (a.sinFranjas ? ' no tiene ninguna franja alquilada este día y juegan ' : ', ') + a.partidos.length + (a.partidos.length === 1 ? ' partido' : ' partidos') +
            ' (' + a.partidos.map(function (p) { return hhmm(p.a); }).join(', ') + ').</li>';
          if (a.tipo === 'faltan') return '<li><button type="button" class="u-btn u-btn-texto" data-liga-ficha="' + texto(a.liga.ID) + '">' + liga(a.liga.ID) + '</button>: ' + (a.n === 1 ? 'falta 1 partido' : 'faltan ' + a.n + ' partidos') + ' por meter.</li>';
          if (a.tipo === 'sobran') return '<li><button type="button" class="u-btn u-btn-texto" data-liga-ficha="' + texto(a.liga.ID) + '">' + liga(a.liga.ID) + '</button>: ' + (a.n === 1 ? 'sobra 1 sitio' : 'sobran ' + a.n + ' sitios') + ' (tiene más horarios que partidos).</li>';
          return '<li>Alquilado sin usar: ' + campo(a.campo) + ', ' + a.libres.length + (a.libres.length === 1 ? ' sitio' : ' sitios') + ' (' + a.libres.map(function (r) { return hhmm(r[0]); }).join(', ') + ').</li>';
        };
        return (graves.length ? '<section class="aj-cu-alertas" role="alert"><h3 class="n-grupo">⚠ Revisa <span class="u-cifra">' + graves.length + '</span></h3><ul>' + graves.map(li).join('') + '</ul></section>' : '') +
          (leves.length ? '<section class="aj-cu-alertas aj-cu-leve"><h3 class="n-grupo">Campos alquilados de más <span class="u-cifra">' + leves.length + '</span></h3><ul>' + leves.map(li).join('') + '</ul></section>' : '');
      }
      /**
       * Si hay campos y días con partidos y sin ninguna franja: un botón para crearlas desde los horarios de las ligas (de la
       * primera hora al final del último partido). Se crean con Ajustes (A.crear), una a una, con su LOG; luego se ajustan.
       */
      function cajaRellenar(d, per) {
        if (!puedeAlq) return '';
        // Mientras se crean, ni se recalcula ni se ofrece otra vez (un segundo clic las repetía).
        if (S.creando) return '<section class="aj-cu-alertas aj-cu-leve"><h3 class="n-grupo">Creando las franjas…</h3><p id="cu-rellenar-estado">' + texto(S.creando) + '</p></section>';
        var r = rellenar(d, per, dura);
        S.rellenar = r;
        if (!r.nuevas.length && !r.sinContrato.length) return '';
        var nom = function (id) { return A.nombre('CAMPOS', id); };
        return '<section class="aj-cu-alertas aj-cu-leve"><h3 class="n-grupo">Faltan franjas alquiladas</h3>' +
          (r.nuevas.length ? '<p>' + r.nuevas.length + (r.nuevas.length === 1 ? ' campo y día tiene' : ' campos y días tienen') + ' partidos pero ninguna franja: ' +
            texto(r.nuevas.slice(0, 6).map(function (x) { return nom(x.campo) + ' ' + x.DIA_SEMANA.toLowerCase() + ' ' + x.HORA_DESDE + '–' + x.HORA_HASTA; }).join(', ') + (r.nuevas.length > 6 ? '…' : '')) + '.</p>' +
            '<p><button type="button" class="u-btn" id="cu-rellenar">Crear ' + r.nuevas.length + (r.nuevas.length === 1 ? ' franja' : ' franjas') + ' desde los horarios de las ligas</button> ' +
            '<span class="u-nota" id="cu-rellenar-estado">De la primera hora al final del último partido; después ajústalas si no es así.</span></p>' : '') +
          (r.sinContrato.length ? '<p>Sin campo de la temporada (añádelo en «Campos de la temporada»): ' + texto(r.sinContrato.map(nom).join(', ')) + '.</p>' : '') + '</section>';
      }
      function crearFranjas(b) {
        var r = S.rellenar, est = el.querySelector('#cu-rellenar-estado');
        if (!r || !r.nuevas.length) return;
        if (!b.getAttribute('data-ok')) { b.setAttribute('data-ok', '1'); b.textContent = 'Sí, crear ' + r.nuevas.length + (r.nuevas.length === 1 ? ' franja' : ' franjas'); return; }
        b.disabled = true;
        var hechas = 0, mal = [];
        S.creando = 'Empezando…';
        r.nuevas.reduce(function (p, x) {
          return p.then(function () {
            S.creando = 'Creando ' + (hechas + mal.length + 1) + ' de ' + r.nuevas.length + '…';
            est = el.querySelector('#cu-rellenar-estado');
            if (est) est.textContent = S.creando;
            var v = { ID_CAMPO_TEMPORADA: x.ID_CAMPO_TEMPORADA, DIA_SEMANA: x.DIA_SEMANA, HORA_DESDE: x.HORA_DESDE, HORA_HASTA: x.HORA_HASTA, NOTAS: 'Sacada de los horarios de las ligas: revisa que sea lo alquilado.' };
            return A.crear('DISPONIBILIDAD_CAMPOS', v).then(function () { hechas++; }, function (e) { mal.push(A.nombre('CAMPOS', x.campo) + ' ' + x.DIA_SEMANA.toLowerCase() + ': ' + String((e && e.message) || e)); });
          });
        }, Promise.resolve()).then(function () {
          S.creando = '';
          ctx.aviso(hechas + (hechas === 1 ? ' franja creada' : ' franjas creadas') + (mal.length ? '; ' + mal.length + ' no: ' + mal.join(' · ') : '.'));
          pintar();
        });
      }
      /**
       * Las franjas cuyas fechas no cuadran con las de las ligas que juegan en ese campo y día: alquilado de más (antes de
       * que empiecen o después de que acaben) o falta alquilar. «Cuadrar con las ligas» recorta las de más; no alarga nada.
       */
      function cajaFechas(d, per) {
        var tem = (d.temporadas || []).filter(function (t) { return String(t.ID) === per; })[0];
        var xs = fechasFranjas(d, per, tem);
        S.cuadrar = xs;
        if (!xs.length) return '';
        var dd = function (f) { return String(f).split('-').reverse().join('/'); }, pl = function (n, dia) { return n + ' ' + dia.toLowerCase() + (n === 1 ? '' : (/s$/.test(dia) ? '' : 's')); };
        var recortables = xs.filter(function (x) { return x.juego && (x.deMas[0] || x.deMas[1]); });
        var li = function (x) {
          var nom = texto(A.nombre('CAMPOS', x.campo)) + ' · ' + texto(x.dia.toLowerCase()) + ' ' + texto(x.f.HORA_DESDE) + '–' + texto(x.f.HORA_HASTA), t = [];
          if (!x.juego) t.push('no juega ninguna liga ahí en toda la temporada: ' + pl(x.deMas[0], x.dia) + ' alquilados sin partidos');
          else {
            if (x.deMas[0]) t.push(pl(x.deMas[0], x.dia) + ' de más antes de que empiece la liga (' + dd(x.juego[0]) + ')');
            if (x.deMas[1]) t.push(pl(x.deMas[1], x.dia) + ' de más después de que acabe (' + dd(x.juego[1]) + ')');
            if (x.faltan[0]) t.push('<strong>faltan ' + pl(x.faltan[0], x.dia) + '</strong>: la liga empieza el ' + dd(x.juego[0]) + ' y la franja, el ' + dd(x.alq[0]));
            if (x.faltan[1]) t.push('<strong>faltan ' + pl(x.faltan[1], x.dia) + '</strong>: se juega hasta el ' + dd(x.juego[1]) + ' y la franja acaba el ' + dd(x.alq[1]));
          }
          return '<li><button type="button" class="u-btn u-btn-texto" data-alq="' + texto(x.f.ID) + '">' + nom + '</button>' + (x.sinFechas ? ' (sin fechas: toda la temporada)' : ' (' + dd(x.alq[0]) + '–' + dd(x.alq[1]) + ')') + ': ' + t.join('; ') + '.</li>';
        };
        return '<section class="aj-cu-alertas aj-cu-leve"><h3 class="n-grupo">Fechas que no cuadran con las ligas <span class="u-cifra">' + xs.length + '</span></h3><ul>' + xs.map(li).join('') + '</ul>' +
          (recortables.length && puedeAlq ? '<p><button type="button" class="u-btn" id="cu-cuadrar">Cuadrar ' + recortables.length + (recortables.length === 1 ? ' franja' : ' franjas') + ' con las ligas</button> ' +
            '<span class="u-nota" id="cu-cuadrar-estado">Pone sus fechas de la primera a la última fecha en que se juega ahí. Solo recorta lo de más; lo que falta, lo alquilas tú.</span></p>' : '') + '</section>';
      }
      function cuadrarFechas(b) {
        var xs = (S.cuadrar || []).filter(function (x) { return x.juego && (x.deMas[0] || x.deMas[1]); });
        if (!xs.length) return;
        if (!b.getAttribute('data-ok')) { b.setAttribute('data-ok', '1'); b.textContent = 'Sí, cuadrar ' + xs.length + (xs.length === 1 ? ' franja' : ' franjas'); return; }
        b.disabled = true;
        var hechas = 0, mal = [];
        xs.reduce(function (p, x) {
          return p.then(function () {
            // Solo recorta: la fecha nueva es la más tardía de inicio y la más temprana de fin.
            var c = { FECHA_DESDE: x.alq[0] < x.juego[0] ? x.juego[0] : x.alq[0], FECHA_HASTA: x.alq[1] > x.juego[1] ? x.juego[1] : x.alq[1] };
            return A.cambiar('DISPONIBILIDAD_CAMPOS', x.f.ID, c).then(function () { hechas++; }, function (e) { mal.push(String((e && e.message) || e)); });
          });
        }, Promise.resolve()).then(function () {
          ctx.aviso(hechas + (hechas === 1 ? ' franja cuadrada' : ' franjas cuadradas') + ' con las ligas' + (mal.length ? '; ' + mal.length + ' no: ' + mal.join(' · ') : '.'));
          pintar();
        });
      }
      /** Huecos alquilados del día frente a los partidos que necesitan sus ligas. */
      function resumen(q) {
        var pl = function (n, a, b) { return n + ' ' + (n === 1 ? a : b); };
        var txt = pl(q.huecos, 'hueco alquilado', 'huecos alquilados') + ' en ' + pl(q.campos, 'campo', 'campos') + '. Las ligas de este día necesitan ' +
          pl(q.partidos, 'partido', 'partidos') + ' por semana' + (q.sinEquipos ? ' (y ' + pl(q.sinEquipos, 'liga todavía sin equipos', 'ligas todavía sin equipos') + ')' : '') + '.';
        if (q.huecos < q.partidos) return '<section class="aj-cu-alertas" role="alert"><h3 class="n-grupo">⚠ Faltan ' + pl(q.partidos - q.huecos, 'hueco', 'huecos') + ': alquila más</h3><p>' + texto(txt) + '</p></section>';
        if (q.huecos > q.partidos) return '<section class="aj-cu-alertas aj-cu-leve"><h3 class="n-grupo">Sobran ' + pl(q.huecos - q.partidos, 'hueco', 'huecos') + ' (alquilados de más)</h3><p>' + texto(txt) + '</p></section>';
        return '<p class="aj-cu-ok">✓ ' + texto(txt) + ' Justo.</p>';
      }
      /** Una columna de la vista Lo alquilado: lo alquilado de fondo y sus huecos, vacíos. */
      function columnaAlq(k, alto) {
        var x = c.de(k.id, S.dia), h = '';
        x.franjas.forEach(function (r) { h += '<div class="aj-cu-alq aj-cu-fr" style="top:' + y(r[0]) + 'px;height:' + (y(r[1]) - y(r[0])) + 'px"></div>'; });
        if (!x.franjas.length) h += '<p class="aj-cu-nada">Sin franjas este día</p>';
        x.trozos.forEach(function (t) {
          var dentro = hhmm(t.a) + (t.suelto ? '–' + hhmm(t.b) + ' · suelto' : '');
          h += '<button type="button" class="aj-cu-hueco' + (t.suelto ? ' aj-cu-suelto' : '') + '"' + (puedeAlq ? ' data-alq="' + texto(t.f.ID) + '"' : ' disabled') +
            ' style="top:' + (y(t.a) + 2) + 'px;height:' + (y(t.b) - y(t.a) - 4) + 'px"' + (t.suelto ? ' title="No llega a un partido entero"' : '') + '>' + dentro + '</button>';
        });
        return '<div class="aj-cu-col aj-cu-no" data-col="' + texto(k.id) + '" style="height:' + alto + 'px">' + h + '</div>';
      }
      function columna(k, R, alto) {
        var x = c.de(k.id, S.dia), h = '';
        x.franjas.forEach(function (r) { h += '<div class="aj-cu-alq aj-cu-fr" style="top:' + y(r[0]) + 'px;height:' + (y(r[1]) - y(r[0])) + 'px"></div>'; });
        if (puede) x.libres.forEach(function (r) {
          h += '<button type="button" class="aj-cu-libre" data-nuevo="' + texto(k.id) + '|' + hhmm(r[0]) + '" style="top:' + (y(r[0]) + 2) + 'px;height:' + (y(r[1]) - y(r[0]) - 4) + 'px">' + hhmm(r[0]) + ' · libre</button>';
        });
        x.partidos.forEach(function (p) {
          var aviso = p.choque ? ' aj-cu-choque' : p.fuera ? ' aj-cu-fuera' : '', w = 100 / p.carriles;
          var mueve = puede && !p.h._nueva;
          h += '<button type="button" class="aj-cu-liga' + aviso + '" data-hueco="' + texto(p.h.ID) + '"' + (mueve ? ' data-arr="hueco"' : '') +
            ' style="top:' + (y(p.a) + 1) + 'px;height:' + (y(p.b) - y(p.a) - 2) + 'px;left:calc(' + (p.carril * w) + '% + 2px);width:calc(' + w + '% - 4px)"' +
            (p.choque ? ' title="Dos partidos a la vez en este campo"' : p.fuera ? ' title="Fuera de lo alquilado"' : '') + '>' +
            '<span class="aj-cu-hora">' + hhmm(p.a) + '–' + hhmm(p.b) + '</span>' + (p.choque ? '⚠ ' : '') + texto(A.nombre('LIGAS', p.h.ID_LIGA)) +
            (p.h.ID_ARBITRO ? '<small>' + texto(A.nombre('STAFF', p.h.ID_ARBITRO)) + '</small>' : '') + '</button>';
        });
        return '<div class="aj-cu-col aj-cu-no" data-col="' + texto(k.id) + '" style="height:' + alto + 'px">' + h + '</div>';
      }
      function bandeja(d, per) {
        var rs = reparto(d, per, S.dia, S.faseObj);
        if (!rs.length) return '';
        return '<section class="aj-cu-bandeja" data-bandeja><h3 class="n-grupo">Partidos por meter</h3>' +
          '<p class="u-nota">Cada semana, una liga juega la mitad de sus equipos en partidos (con 9 equipos, 4: uno descansa).' + (puede ? ' Arrastra un partido al cuadrante para ponerlo, o uno del cuadrante aquí para quitarlo.' : '') + '</p>' +
          rs.map(function (r) {
            var l = r.l, nom = texto(A.nombre('LIGAS', l.ID)), fichas = '';
            if (puede) {
              for (var i = 0; i < Math.min(r.faltan, 12); i++) fichas += '<button type="button" class="aj-cu-ficha" data-arr="liga" data-liga="' + texto(l.ID) + '">' + nom + '</button>';
              if (!r.faltan) fichas += '<button type="button" class="aj-cu-ficha aj-cu-mas" data-arr="liga" data-liga="' + texto(l.ID) + '" title="Arrástralo para poner uno más">+ uno más</button>';
            }
            var estado = r.partidos === null ? 'sin equipos todavía' : r.equipos + (r.equipos === 1 ? ' equipo' : ' equipos') + ' · ' + r.partidos + (r.partidos === 1 ? ' partido' : ' partidos');
            var cuenta = r.partidos === null ? r.puestos + ' puestos' : r.faltan ? '<strong>faltan ' + r.faltan + '</strong>' :
              r.sobran ? '<span class="aj-cu-sobra">sobran ' + r.sobran + (r.sobran === 1 ? ' sitio' : ' sitios') + '</span>' : '✓ todos puestos';
            var comp = (T.fila('COMPETICIONES', l.ID_COMPETICION) || {}).NOMBRE;
            return '<div class="aj-cu-rep"><div class="aj-cu-rep-n"><button type="button" class="u-btn u-btn-texto" data-liga-ficha="' + texto(l.ID) + '">' + nom + '</button>' +
              (comp ? '<small>' + texto(comp) + '</small>' : '') +
              '<small>' + texto(estado) + ' · ' + cuenta + '</small></div><div class="aj-cu-fichas">' + fichas + '</div></div>';
          }).join('') + '</section>';
      }
      function oir() {
        var sp = el.querySelector('#cu-per');
        if (sp) sp.onchange = function () { A.ponerPeriodo(sp.value); S.fase = ''; pintar(); };
        var bq = el.querySelector('#cu-cuadrar');
        if (bq) bq.onclick = function () { cuadrarFechas(bq); };
        var br = el.querySelector('#cu-rellenar');
        if (br) br.onclick = function () { crearFranjas(br); };
        var sf = el.querySelector('#cu-fase');
        if (sf) sf.onchange = function () { S.fase = sf.value; S.fecha = ''; pintar(); };
        var sd = el.querySelector('#cu-fecha');
        if (sd) sd.onchange = function () { if (sd.value) { S.fecha = sd.value; pintar(); } };
        var st = el.querySelector('#cu-todos');
        if (st) st.onchange = function () { S.todos = st.checked; pintar(); };
      }

      /* ---------- arrastrar (con el ratón o el dedo) ---------- */

      function abajo(e) {
        if (e.button !== 0 || !puede || !c) return;
        var b = e.target.closest('[data-arr]');
        if (!b || !el.contains(b)) return;
        var r = b.getBoundingClientRect(), es = b.getAttribute('data-arr') === 'hueco';
        var h = es ? T.fila('HUECOS', b.getAttribute('data-hueco')) : { ID_LIGA: b.getAttribute('data-liga') };
        if (!h) return;
        arr = { b: b, h: h, es: es, x0: e.clientX, y0: e.clientY, dy: es ? e.clientY - r.top : 8, dura: Number(dura(h)) || 45, activo: false };
      }
      function mover(e) {
        if (!arr) return;
        if (!el.isConnected) { soltar(null); return; }
        if (!arr.activo) {
          if (Math.abs(e.clientX - arr.x0) + Math.abs(e.clientY - arr.y0) < 6) return;
          arr.activo = true;
          arr.f = document.createElement('div');
          arr.f.className = 'aj-cu-fantasma';
          arr.f.style.height = Math.round(arr.dura * PX) + 'px';
          arr.f.textContent = A.nombre('LIGAS', arr.h.ID_LIGA);
          el.appendChild(arr.f);
          arr.b.classList.add('aj-cu-cogido');
          document.body.classList.add('aj-cu-arrastrando');
        }
        e.preventDefault();
        arr.f.style.left = (e.clientX - 20) + 'px';
        arr.f.style.top = (e.clientY - arr.dy) + 'px';
        var bajo = document.elementFromPoint(e.clientX, e.clientY), col = bajo && bajo.closest('[data-col]'), caja = bajo && bajo.closest('[data-bandeja]');
        marca(null);
        arr.a = null;
        if (col && el.contains(col)) {
          var R = c.rango[S.dia], top = col.getBoundingClientRect().top;
          var m = R[0] + Math.round((e.clientY - arr.dy - top) / PX / IMAN) * IMAN;
          m = Math.max(R[0], Math.min(m, R[1] - arr.dura));
          var campo = col.getAttribute('data-col'), x = c.de(campo, S.dia), tr = [m, m + arr.dura];
          var mal = x.partidos.filter(function (p) { return p.h !== arr.h && pisan(tr, [p.a, p.b]); });
          var fuera = x.franjas.length > 0 && !x.franjas.some(function (r) { return m >= r[0] && m + arr.dura <= r[1]; });
          arr.a = { campo: campo, m: m, mal: mal };
          marca(col, m, mal.length ? 'mal' : fuera ? 'fuera' : 'bien',
            hhmm(m) + '–' + hhmm(m + arr.dura) + (mal.length ? ' · se pisa con ' + A.nombre('LIGAS', mal[0].h.ID_LIGA) : fuera ? ' · fuera de lo alquilado' : ''));
        } else if (caja && el.contains(caja) && arr.es) {
          arr.a = { quitar: true };
          caja.classList.add('aj-cu-quitar');
        }
      }
      function marca(col, m, tipo, t) {
        var v = el.querySelector('.aj-cu-marca');
        if (v) v.parentNode.removeChild(v);
        var q = el.querySelector('.aj-cu-quitar');
        if (q) q.classList.remove('aj-cu-quitar');
        if (!col) return;
        v = document.createElement('div');
        v.className = 'aj-cu-marca aj-cu-marca-' + tipo;
        v.style.top = y(m) + 'px'; v.style.height = Math.round(arr.dura * PX) + 'px';
        v.textContent = t;
        col.appendChild(v);
      }
      function soltar(e) {
        if (!arr) return;
        var a = arr;
        arr = null;
        document.body.classList.remove('aj-cu-arrastrando');
        if (!a.activo) return;
        sinClic = true; setTimeout(function () { sinClic = false; }, 0);
        if (a.f && a.f.parentNode) a.f.parentNode.removeChild(a.f);
        a.b.classList.remove('aj-cu-cogido');
        marca(null);
        var fin = a.a;
        if (!e || !fin) { pintar(); return; }
        var mal = function (err) { ctx.aviso(err && err.message ? err.message : 'No se ha guardado.'); pintar(); };
        if (fin.quitar) { A.quitar('HUECOS', a.h.ID).then(function () { ctx.aviso('Quitado del cuadrante.'); }, mal); pintar(); return; }
        if (fin.mal.length) { ctx.aviso('Ahí se pisa con ' + A.nombre('LIGAS', fin.mal[0].h.ID_LIGA) + ' (' + hhmm(fin.mal[0].a) + '). Prueba en otro sitio.'); pintar(); return; }
        var hora = hhmm(fin.m);
        if (a.es) {
          if (a.h.ID_CAMPO === fin.campo && a.h.HORA === hora) { pintar(); return; }
          A.cambiar('HUECOS', a.h.ID, { ID_CAMPO: fin.campo, HORA: hora }).then(null, mal);
        } else {
          A.crear('HUECOS', { ID_LIGA: a.h.ID_LIGA, DIA_SEMANA: S.dia, HORA: hora, ID_CAMPO: fin.campo }).then(null, mal);
        }
        pintar();
      }
      function tecla(e) { if (e.key === 'Escape' && arr) { e.stopPropagation(); soltar(null); } }
      el.addEventListener('pointerdown', abajo);
      document.addEventListener('pointermove', mover, { passive: false });
      document.addEventListener('pointerup', soltar);
      function cancelar() { soltar(null); }
      document.addEventListener('pointercancel', cancelar);
      document.addEventListener('keydown', tecla, true);
      this.cerrar = function () {
        document.removeEventListener('pointermove', mover);
        document.removeEventListener('pointerup', soltar);
        document.removeEventListener('pointercancel', cancelar);
        document.removeEventListener('keydown', tecla, true);
      };

      el.addEventListener('click', function (e) {
        if (sinClic) { e.preventDefault(); return; }
        var b = e.target.closest('[data-fecha], [data-dia], [data-hueco], [data-nuevo], [data-campo], [data-liga-ficha], [data-alq], [data-alq-nueva]');
        if (!b) return;
        if (b.hasAttribute('data-fecha')) { S.fecha = b.getAttribute('data-fecha'); pintar(); return; }
        if (b.hasAttribute('data-dia')) { S.dia = b.getAttribute('data-dia'); guardado('aj_cu_dia', S.dia); pintar(); return; }
        if (b.hasAttribute('data-hueco')) { A.ficha('HUECOS', b.getAttribute('data-hueco')); return; }
        if (b.hasAttribute('data-campo')) { A.ficha('CAMPOS', b.getAttribute('data-campo')); return; }
        if (b.hasAttribute('data-liga-ficha')) { A.ficha('LIGAS', b.getAttribute('data-liga-ficha')); return; }
        if (b.hasAttribute('data-alq')) { A.ficha('DISPONIBILIDAD_CAMPOS', b.getAttribute('data-alq')); return; }
        if (b.hasAttribute('data-alq-nueva')) { A.nueva('DISPONIBILIDAD_CAMPOS', { DIA_SEMANA: S.dia }); return; }
        var p = b.getAttribute('data-nuevo').split('|');
        A.nueva('HUECOS', { ID_CAMPO: p[0], DIA_SEMANA: S.dia, HORA: p[1] });
      });
      ctx.alCambiar(function (t) { if (TABLAS.indexOf(t) >= 0) pintar(); });
      T.leer(TABLAS.concat(['STAFF'])).then(pintar, pintar);
      pintar();
    }
  });
})();
