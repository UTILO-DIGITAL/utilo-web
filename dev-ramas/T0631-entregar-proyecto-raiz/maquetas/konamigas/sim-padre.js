/*
 * El simulador de la maqueta de Konamigas · T0364 · web/maquetas/konamigas/sim-padre.js de utilo-apps
 *
 * Dos pantallas a la vez: konamigas.com en un móvil (lo de las jugadoras y las capitanas) y la plataforma (lo de
 * Konamigas). Cada una lleva sim.js, que dice aquí lo que cambia; esto se lo cuenta a la otra con un aviso (un equipo
 * inscrito le llega a Gestión, una incidencia al gestor, un partido aplazado a las jugadoras) y le pide que se refresque.
 * En una pantalla estrecha, las dos van en pestañas y el aviso marca la otra.
 * La usan simulador.html (modo local) y la copia del móvil, que le da sus dos <iframe> en SIM.marcos.
 */
(function () {
  'use strict';
  var SIM = window.SIM = window.SIM || {};

  function marco(lado) { return document.getElementById('sim-' + lado); }
  function ventanaDe(lado) { var f = marco(lado); return f && f.contentWindow; }
  function otro(lado) { return lado === 'web' ? 'app' : 'web'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /** Un aviso encima de una de las pantallas; ir: lo que se abre en ella al tocarlo; delGuion: lo pide un botón de «Qué probar». */
  function aviso(lado, titulo, texto, ir, delGuion) {
    var caja = document.getElementById('sim-avisos-' + lado);
    if (!caja) return;
    var a = document.createElement('div');
    a.className = 'sim-aviso';
    a.setAttribute('role', 'status');
    a.innerHTML = '<span class="sim-aviso-ico" aria-hidden="true">' + (lado === 'app' ? '🔔' : '📲') + '</span><div><b>' + esc(titulo) + '</b>' + (texto ? '<p>' + esc(texto) + '</p>' : '') + '</div>' +
      (ir ? '<button type="button" class="sim-aviso-ir">Ver</button>' : '') + '<button type="button" class="sim-aviso-x" aria-label="Cerrar">×</button>';
    a.onclick = function (e) {
      if (e.target.closest('.sim-aviso-ir')) { mostrar(lado); var w = ventanaDe(lado); if (w) w.postMessage({ mq: 'ir', a: ir.a, q: ir.q || '' }, '*'); }
      if (e.target.closest('button')) a.remove();
    };
    caja.insertBefore(a, caja.firstChild);
    while (caja.children.length > 4) caja.lastChild.remove();
    // T0366: más tiempo (y quieto mientras se pasa por encima); uno con «Ver» cierra «Qué probar», que lo tapaba.
    var quitar = function () { a.classList.add('sim-viejo'); setTimeout(function () { a.remove(); }, 500); }, t = setTimeout(quitar, ir ? 20000 : 10000);
    a.onmouseenter = function () { clearTimeout(t); };
    a.onmouseleave = function () { t = setTimeout(quitar, 6000); };
    var g = document.getElementById('sim-guion');
    if (ir && !delGuion && g && !g.hidden) { g.hidden = true; [].forEach.call(document.querySelectorAll('.sim-guion-btn'), function (b) { b.setAttribute('aria-expanded', 'false'); }); }
    var p = document.querySelector('[data-sim-pest="' + lado + '"]');
    if (p && document.body.getAttribute('data-sim-ver') !== lado) p.classList.add('sim-nuevo');
  }

  /** Qué le cuenta un cambio a la otra pantalla: { titulo, texto, ir } o null (solo se refresca). */
  function queAvisa(m) {
    var v = (m.args && m.args[0]) || {};
    if (m.fn === 'inscripcionesEquipo') return { titulo: 'Nuevo equipo inscrito: ' + (v.NOMBRE_EQUIPO || ''), texto: 'Llega a Gestión como Solicitada, con su capitana y sus días.', ir: { a: 'Gestión' } };
    if (m.fn === 'inscripcionesJugadora') return v.SIN_EQUIPO ? { titulo: 'Una jugadora busca equipo: ' + [v.NOMBRE, v.APELLIDO_1].filter(Boolean).join(' '), texto: 'Está en la bolsa de jugadoras y en Gestión.', ir: { a: 'Gestión' } }
      : { titulo: 'Nueva jugadora inscrita: ' + [v.NOMBRE, v.APELLIDO_1].filter(Boolean).join(' '), texto: 'Llega a Gestión, en la plantilla de su equipo.', ir: { a: 'Gestión' } };
    if (m.fn === 'inscripcionesSalirBanco') return { titulo: 'Una jugadora sale de la bolsa de jugadoras', texto: '' };
    if (/^ligas(Partido|Mover|Jornadas|Recuperar)$/.test(m.fn)) return { titulo: 'Konamigas ha cambiado un partido', texto: 'Lo ven todas al momento en Competiciones.' };
    if (m.fn === 'ligasActa') return { titulo: 'Resultado nuevo en Competiciones', texto: 'El acta del partido ya está cerrada.' };
    // T0366: montar la Kopa, la señal, el reparto, el calendario y las camisetas.
    var t = m.args && m.args[0], f = (m.args && m.args[1]) || {};
    if (m.fn === 'ligasTraerCompeticiones' || m.fn === 'maquetaKopaCrear' || (m.fn === 'tablasCrear' && t === 'COMPETICIONES')) return { titulo: 'Inscripciones abiertas en una competición nueva', texto: 'Ya sale en Inscripciones, con sus días y su señal.' };
    if (m.fn === 'tablasCrear' && t === 'MOVIMIENTOS' && /^inscripci/i.test(String(f.REF_TIPO || ''))) return { titulo: 'Señal pagada: ' + String(f.CONCEPTO || '').replace(/^Paga y señal\s*/, ''), texto: 'Plaza confirmada: su capitana lo ve en Mi área.' };
    if (m.fn === 'ligasCerrar' && m.args.length === 1) return { titulo: 'Konamigas ha cerrado una liga', texto: 'Cada equipo ya tiene su liga y su día.' };
    if (m.fn === 'ligasCalendario' && f.guardar) return { titulo: 'Calendario nuevo en Competiciones', texto: 'Cada equipo ve sus partidos en Mi área, con día, hora y campo.' };
    if (m.fn === 'tablasActualizar' && t === 'CAMISETAS' && (m.args[2] || {}).ESTADO === 'Entregada') return { titulo: 'Camiseta entregada', texto: 'La jugadora la ve en Mi área → Mis datos.' };
    return null;
  }

  /* ---------- el guion: los pasos de la historia, que se marcan solos al hacerlos ---------- */
  // T0366: la demo, desde cero y con la Kopa di Mondo: cinco casos de pocos pasos. Un paso con botón (p[4]) hace por
  // la plataforma lo que en la demo no aporta teclear: crear la Kopa como la del año pasado o inscribir el resto en masa.
  var BOTONES = {
    kopa: { fn: 'maquetaKopaCrear', texto: 'Crear la Kopa 2027', haciendo: 'Creando…', ir: 'Ajustes',
      hecho: function (r) { return r.ya ? ['Ya estaba creada: ' + r.nombre, ''] : [r.nombre + ' creada', 'Temporada ' + '2026-2027 · ' + r.ligas + ' ligas · ' + r.horarios + ' horarios. Ya sale en Inscripciones.']; } },
    resto: { fn: 'maquetaKopaEjemplo', texto: 'Inscribir el resto', haciendo: 'Inscribiendo…', ir: 'Gestión',
      hecho: function (r) { return [r.equipos ? r.equipos + ' equipos y ' + r.jugadoras + ' jugadoras inscritos' : 'Ya estaban todos inscritos', r.equipos ? 'Confirmados con la señal pagada (el resto de la inscripción, por pagar) y sus camisetas preparadas.' : '']; } }
  };
  var CASOS = [
    ['1', 'Crear la temporada con la Kopa', [
      ['kopa', '💻', 'Crea la Kopa 2027, como la del año pasado', 'La temporada, la Kopa, sus dos ligas, horarios, precio y señal. En Ajustes, cada paso sale hecho.', 'kopa']]],
    ['2', 'Inscripciones y señal', [
      ['equipo', '📱', 'Inscribe tu equipo', 'Inscripciones → KOPA DI MONDO 2027 → Inscribir a mi equipo.'],
      ['jugadora', '📱', 'Inscribe a una jugadora en él', 'Inscripciones → «Mi equipo ya está inscrito».'],
      ['resto', '💻', 'El resto, en masa', 'Las 17 selecciones de 2026 con sus jugadoras.', 'resto'],
      ['senal', '💻', 'Apunta la señal de tu equipo', 'Gestión → su aviso → Apuntar la señal → Apuntar el cobro. Su capitana lo ve en Mi área.']]],
    ['3', 'Repartir y calendario', [
      ['reparto', '💻', 'Reparte y cierra las ligas', 'Ajustes → Y después → Repartir… → KOPA DI MONDO 2027 → Proponer el reparto → Aplicar → Cerrar la liga (las dos).'],
      ['calendario', '💻', 'Genera los calendarios', '«Generar calendario ›» → Guardar; luego la otra liga. Tu jugadora ve sus partidos.']]],
    ['4', 'Árbitro y reclamación', [
      ['directo', '📱', 'El árbitro, en directo', 'Entrar → «Entrar como árbitro» → su partido de hoy (el de tu equipo) → Empezar → goles → Terminar y cerrar el acta.'],
      ['reclama', '📱', 'La capitana reclama el resultado', 'Entra como tu capitana → Mi área → Mis partidos → ese partido → Reclamar → «Un gol lo marcó otra jugadora» → Enviar al árbitro.'],
      ['responde', '💻', 'El árbitro corrige el acta', 'Le llega a él: Futuro → Árbitro → Reclamaciones → Revisar el acta → cambia el gol → Guardar el acta. Las jugadoras lo ven en Novedades.'],
      // T0419: lo de un partido que viene sigue siendo del gestor, que propone la solución desde el aviso.
      ['aplaza', '💻', 'El gestor aplaza un partido que viene', 'La capitana: Incidencias → Avisar de algo → «No podremos venir». La plataforma, como gestor: Futuro → Incidencias → Proponer una solución → aplazarlo a otro día. Las de los dos equipos lo ven en Novedades, con la nueva fecha.']]],
    ['5', 'Camisetas y pagos', [
      ['camisetas', '💻', 'Entrega su camiseta a tu jugadora', 'Camisetas → Entregas → tu equipo → Entregar (a tu jugadora o a la capitana). Ella lo ve en Mi área → Mis datos.'],
      ['debe', '💻', 'Mira lo que debe cada equipo', 'Gestión → Pagos pendientes → la ficha de un equipo → Pagos.'],
      ['pagos', '📱', 'La capitana ve lo que lleva pagado', 'Entra como tu capitana → Mi área → Mi equipo: la inscripción, la señal, las camisetas y lo que falta.']]]
  ];
  var hechos = {};
  try { hechos = JSON.parse(sessionStorage.getItem('sim_pasos') || '{}') || {}; } catch (e) { hechos = {}; }
  function pintarPasos() {
    var ol = document.getElementById('sim-pasos');
    if (!ol) return;
    ol.innerHTML = CASOS.map(function (c) {
      var todos = c[2].every(function (p) { return hechos[p[0]]; });
      return '<li class="sim-caso' + (todos ? ' sim-hecho' : '') + '"><h3><span class="sim-num">' + c[0] + '</span>' + esc(c[1]) + '</h3><ul>' + c[2].map(function (p) {
        return '<li class="' + (hechos[p[0]] ? 'sim-hecho' : '') + '"><label><input type="checkbox" data-sim-paso="' + p[0] + '"' + (hechos[p[0]] ? ' checked' : '') + '><span><b>' + p[1] + ' ' + esc(p[2]) + '</b><small>' + esc(p[3]) + '</small></span></label>' +
          (p[4] && !hechos[p[0]] ? '<button type="button" class="sim-ejemplo" data-sim-boton="' + p[4] + '"' + (haciendo[p[4]] ? ' disabled' : '') + '>' + esc(haciendo[p[4]] ? BOTONES[p[4]].haciendo : BOTONES[p[4]].texto) + '</button>' : '') + '</li>';
      }).join('') + '</ul></li>';
    }).join('');
  }
  function hecho(id) {
    if (!id || hechos[id]) return;
    hechos[id] = 1;
    try { sessionStorage.setItem('sim_pasos', JSON.stringify(hechos)); } catch (e) {}
    pintarPasos();
  }
  function pasoDe(m) {
    var t = m.args && m.args[0], f = (m.args && m.args[1]) || {};
    if (m.mq === 'cambio') {
      if (m.fn === 'tablasCrear') return t === 'COMPETICIONES' ? 'kopa' : t === 'MOVIMIENTOS' && /^inscripci/i.test(String(f.REF_TIPO || '')) ? 'senal' : '';
      if (m.fn === 'tablasActualizar') return t === 'CAMISETAS' && (m.args[2] || {}).ESTADO === 'Entregada' ? 'camisetas' : '';
      if (m.fn === 'ligasCalendario') return f.guardar ? 'calendario' : '';
      if (m.fn === 'ligasCerrar') return m.args.length === 1 ? 'reparto' : '';
      return { ligasTraerCompeticiones: 'kopa', maquetaKopaCrear: 'kopa', inscripcionesEquipo: 'equipo', inscripcionesJugadora: 'jugadora', maquetaKopaEjemplo: 'resto', ligasActa: 'directo' }[m.fn];
    }
    // El directo, al cerrar el acta (ligasActa); la reclamación, al enviarla al árbitro; aplazar, lo dice la plataforma (paso).
    if (m.mq === 'aviso') return /^Incidencia .* para el árbitro/.test(m.titulo || '') ? 'reclama' : /^Respuesta del árbitro/.test(m.titulo || '') ? 'responde' : '';
    if (m.mq === 'paso') return m.id;
    return '';
  }

  document.addEventListener('change', function (e) {
    var c = e.target.closest && e.target.closest('[data-sim-paso]');
    if (!c) return;
    if (c.checked) hecho(c.getAttribute('data-sim-paso'));
    else { delete hechos[c.getAttribute('data-sim-paso')]; try { sessionStorage.setItem('sim_pasos', JSON.stringify(hechos)); } catch (x) {} pintarPasos(); }
  });
  document.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-sim-guion]');
    if (g) {
      var a = document.getElementById('sim-guion'), abrir = a.hidden;
      a.hidden = !abrir;
      [].forEach.call(document.querySelectorAll('.sim-guion-btn'), function (b) { b.setAttribute('aria-expanded', String(abrir)); });
      try { sessionStorage.setItem('sim_guion', abrir ? '1' : '0'); } catch (x) {}
    }
    if (e.target.closest && e.target.closest('[data-sim-reiniciar]')) reiniciar();
    var bo = e.target.closest && e.target.closest('[data-sim-boton]');
    if (bo) boton(bo.getAttribute('data-sim-boton'));
  });
  /** T0366: lo que hace un botón del guion, por la plataforma, que llama al motor como siempre (sim.js: { mq: 'llamar' }). */
  var haciendo = {}, llamadas = {}, nLlamada = 0;
  function llamar(fn, args) {
    return new Promise(function (ok, ko) {
      var w = ventanaDe('app'), id = ++nLlamada;
      if (!w) return ko(new Error('La plataforma aún no está abierta.'));
      llamadas[id] = function (d) { if (d.ok) ok(d.r); else ko(new Error(d.error || 'No se ha podido.')); };
      w.postMessage({ mq: 'llamar', id: id, fn: fn, args: args || [] }, '*');
    });
  }
  function boton(k) {
    var b = BOTONES[k];
    if (!b || haciendo[k]) return;
    haciendo[k] = true; pintarPasos();
    llamar(b.fn).then(function (r) {
      var t = b.hecho(r || {});
      aviso('app', t[0], t[1], { a: b.ir }, true);
      ['app', 'web'].forEach(function (l) { var w = ventanaDe(l); if (w) w.postMessage({ mq: 'refrescar' }, '*'); });
    }, function (er) { aviso('app', 'No se ha podido', er.message); })
      .then(function () { haciendo[k] = false; pintarPasos(); });
  }
  /** Empezar de cero: en la copia del móvil, el motor vuelve a los datos de partida (SIM.reiniciar, de padre.js); en el
      modo local se borra lo compartido y se recarga (lo inscrito sigue hasta volver a lanzar npm run local). */
  function reiniciar() {
    hechos = {};
    try {
      sessionStorage.removeItem('sim_pasos');
      Object.keys(localStorage).forEach(function (k) { if (/^(maqueta_|lig_web_|ins_)/.test(k)) localStorage.removeItem(k); });
    } catch (e) {}
    pintarPasos();
    [].forEach.call(document.querySelectorAll('.sim-aviso'), function (a) { a.remove(); });
    if (typeof SIM.reiniciar === 'function') return SIM.reiniciar();
    var api = document.body.getAttribute('data-api');
    fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: 'maquetaComunGuardar', args: [null] }) })
      .catch(function () {}).then(function () { location.reload(); });
  }
  pintarPasos();
  /* Entrar en la plataforma con una persona de un toque (en la copia del móvil, con las de ACCESOS: MOTOR_PERSONAS).
     El árbitro va directo a su portal. En el modo local se cambia con «Cambiar de persona». */
  (function () {
    var caja = document.getElementById('sim-como'), ps = window.MOTOR_PERSONAS || [];
    if (!caja || !ps.length) return;
    caja.hidden = false;
    caja.innerHTML = '<span>Entrar como:</span>' + ps.map(function (p, i) {
      return '<button type="button" data-sim-como="' + i + '">' + esc(String(p.persona).replace(' (lo ve todo)', '')) + ' <small>' + esc(p.perfil === 'Administración' ? 'todo' : p.perfil.toLowerCase()) + '</small></button>';
    }).join('');
    caja.onclick = function (e) {
      var b = e.target.closest('[data-sim-como]');
      if (!b) return;
      var p = ps[Number(b.getAttribute('data-sim-como'))], w = ventanaDe('app');
      [].forEach.call(caja.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      mostrar('app');
      if (!w) return;
      w.postMessage({ mq: 'como', correo: p.correo }, '*');
      if (/Árbitro/.test(p.perfil)) setTimeout(function () { var w2 = ventanaDe('app'); if (w2) w2.postMessage({ mq: 'ir', a: 'arbitro' }, '*'); }, 3500);
    };
  })();
  // En el modo local (sin SIM.reiniciar), lo inscrito vive en el servidor: se queda hasta volver a lanzarlo.
  window.addEventListener('load', function () { // padre.js (la copia del móvil) se carga después que esto
    var n = document.getElementById('sim-reiniciar-nota');
    if (n && typeof SIM.reiniciar !== 'function') n.textContent = 'Borra los avisos, las incidencias y los pasos, y vuelve a abrir las dos pantallas. Lo inscrito y lo cambiado en las tablas sigue hasta volver a lanzar npm run local.';
  });
  try { if (sessionStorage.getItem('sim_guion') === '1') { document.getElementById('sim-guion').hidden = false; } } catch (e) {}

  var espera = {};
  window.addEventListener('message', function (e) {
    var m = e.data || {}, p = pasoDe(m);
    hecho(p);
    // Con el calendario hecho, el primer partido de tu equipo pasa a hoy, con el árbitro: para el acta en directo (caso 4).
    if (p === 'calendario') llamar('maquetaPreparar').then(function () { var w = ventanaDe('web'); if (w) w.postMessage({ mq: 'refrescar' }, '*'); }, function () {});
    if (m.mq === 'cambio' && (m.lado === 'web' || m.lado === 'app')) {
      var o = otro(m.lado), q = queAvisa(m);
      if (q) aviso(o, q.titulo, q.texto, q.ir);
      clearTimeout(espera[o]);
      espera[o] = setTimeout(function () { var w = ventanaDe(o); if (w) w.postMessage({ mq: 'refrescar' }, '*'); }, 250);
    }
    if (m.mq === 'aviso' && (m.a === 'web' || m.a === 'app')) aviso(m.a, m.titulo, m.texto, m.ir ? { a: m.ir } : null);
    if (m.mq === 'mostrar' && (m.a === 'web' || m.a === 'app')) mostrar(m.a);
    if (m.mq === 'llamado' && llamadas[m.id]) { llamadas[m.id](m); delete llamadas[m.id]; }
  });

  /** En una pantalla estrecha, qué pestaña se ve. */
  function mostrar(lado) {
    document.body.setAttribute('data-sim-ver', lado);
    var p = document.querySelector('[data-sim-pest="' + lado + '"]');
    if (p) p.classList.remove('sim-nuevo');
    [].forEach.call(document.querySelectorAll('[data-sim-pest]'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-sim-pest') === lado)); });
    var f = marco(lado);
    if (f && document.body.getAttribute('data-sim-ancho') === 'no') f.classList.add('sim-destella'), setTimeout(function () { f.classList.remove('sim-destella'); }, 900);
  }
  SIM.mostrar = mostrar;
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-sim-pest]'); if (b) mostrar(b.getAttribute('data-sim-pest')); });
  function ancho() {
    document.body.setAttribute('data-sim-ancho', window.matchMedia('(max-width: 999px)').matches ? 'si' : 'no');
    // El móvil, a su tamaño de verdad si cabe de alto; si no, entero más pequeño.
    var t = document.querySelector('.sim-telefono'), arriba = t ? t.getBoundingClientRect().top + window.scrollY : 120;
    document.documentElement.style.setProperty('--sim-e', String(Math.max(0.55, Math.min(1, (window.innerHeight - arriba - 36) / 864))));
  }
  window.addEventListener('resize', ancho);
  ancho();
  if (!document.body.getAttribute('data-sim-ver')) mostrar('web');
})();
