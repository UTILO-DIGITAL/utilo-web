/*
 * konamigas.com en la maqueta · T0364 · web/maquetas/konamigas/index.html de utilo-apps
 *
 * La web de todas, sin entrar con Google: pinta la sección de la maqueta (maqueta.js) con ctx.web, sin el marco del
 * núcleo. Lee con las funciones públicas de la maqueta (clientes/konamigas/modulos/maqueta/MAQUETA.js: maquetaWeb,
 * maquetaPersonas, maquetaEntrar) y la de inscripciones que ya existe (inscripcionesDatos), como la página de
 * inscripciones: sin token, con la llave del robot. Lo de la jugadora que entra se añade a lo público y se va al salir.
 * Quién ha entrado se recuerda en este navegador (si se puede), para volver de la página de inscripciones.
 * Competiciones es la sección Ligas de verdad (ligas.js), solo para ver, con lo que pide (maquetaLigas, sin datos).
 */
(function () {
  'use strict';
  var C = window.KANBAN || {};
  var K = 'maqueta_web_yo_' + (C.clave || '');
  var T = {}, PUB = {}, CFG_LIGAS = {}, version = 0, oyentes = [], seccion = null, LIGAS = null;

  function llamar(fn, args) {
    return fetch(C.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args || [] }) })
      .then(function (r) { return r.json(); })
      .then(function (r) { if (!r.ok) throw new Error(String(r.error || 'No se ha podido.').replace(/^(VALIDAR|PUBLICO|ACCESO):\s*/, '')); return r.r; });
  }
  function recordar(v) { try { if (v) localStorage.setItem(K, v); else localStorage.removeItem(K); } catch (e) {} }
  function recordado() { try { return localStorage.getItem(K) || ''; } catch (e) { return ''; } }

  /** Las filas de lo público y, encima, las de quien ha entrado (por ID: las suyas sustituyen a las públicas). */
  function poner(publico, suyo) {
    T = {};
    Object.keys(publico).forEach(function (t) { T[t] = publico[t].slice(); });
    Object.keys(suyo || {}).forEach(function (t) {
      var ix = {};
      (T[t] = T[t] || []).forEach(function (f, i) { ix[String(f.ID)] = i; });
      suyo[t].forEach(function (f) { var i = ix[String(f.ID)]; if (i === undefined) T[t].push(f); else T[t][i] = Object.assign({}, T[t][i], f); });
    });
    version++;
  }

  // Lo que usan la maqueta y la sección Ligas de las tablas. Aquí todo se lee: cambiar algo no se puede.
  var noSe = function () { return Promise.reject(new Error('En konamigas.com no se cambia nada.')); };
  var tablas = {
    leer: function () { return Promise.resolve(); },
    refrescar: function () { return Promise.resolve(); },
    filas: function (t) { return T[t] || []; },
    fila: function (t, id) {
      if (t === 'PARTIDOS') web.partido = String(id); // el que se acaba de abrir en Ligas (para «Reclamar», abajo)
      return (T[t] || []).filter(function (f) { return String(f.ID) === String(id) || (f.ID === undefined && String(f.FECHA) === String(id)); })[0] || null;
    },
    tiene: function () { return true; },
    version: function () { return version; },
    actualizar: noSe, crear: noSe, borrar: noSe
  };

  var caja = null;
  function aviso(m) {
    if (!caja) { caja = document.createElement('div'); caja.className = 'mqw-aviso'; caja.setAttribute('role', 'status'); document.body.appendChild(caja); }
    caja.textContent = m;
    caja.classList.add('abierto');
    clearTimeout(caja._t);
    caja._t = setTimeout(function () { caja.classList.remove('abierto'); }, 3200);
  }

  var web = {
    yo: '',
    app: C.app || 'app/',
    ins: C.ins || 'inscripciones/',
    icono: C.icono || '',
    personas: function () { return llamar('maquetaPersonas'); },
    inscripciones: function () { return llamar('inscripcionesDatos'); },
    entrar: function (id) {
      return llamar('maquetaEntrar', [id]).then(function (r) { poner(PUB, r.tablas); recordar(id); });
    },
    salir: function () { poner(PUB, null); recordar(''); },
    partido: '',
    /**
     * Competiciones: la sección Ligas de verdad, solo para ver (un perfil sin permisos: ni actas, ni mover, ni sanciones),
     * en el elemento el. comoLiga: { comp, liga } para abrirla en la de la jugadora. alFicha(idPartido, ventana), al abrir
     * la ficha de un partido. Devuelve con qué cerrarla.
     */
    ligas: function (el, comoLiga, alFicha) {
      if (!LIGAS) { el.innerHTML = '<p class="u-error">Falta la sección Ligas.</p>'; return function () {}; }
      try {
        if (comoLiga && comoLiga.liga) { localStorage.setItem('lig_web_comp', comoLiga.comp); localStorage.setItem('lig_web_liga', comoLiga.liga); }
        if (comoLiga && comoLiga.partidos) localStorage.setItem('lig_web_tab', 'PARTIDOS'); // recién entrada: a sus partidos
      } catch (e) {}
      var abierta = true;
      var c = { tablas: tablas, config: CFG_LIGAS, perfil: 'Pública', admin: false, persona: '', correo: '', id: 'web',
        llamar: function (fn, args) { return llamar('maquetaLigas', [fn, args || []]); },
        alCambiar: function () {}, aviso: aviso, abierta: function () { return abierta; }, ponerTitulo: function () {} };
      LIGAS.abrir(el, c);
      var visto = '';
      var mira = new MutationObserver(function () {
        var velo = el.querySelector('#lg-velo'), vent = el.querySelector('#lg-vent');
        var ficha = velo && velo.classList.contains('abierto') && vent && vent.querySelector('.lg-marcador, #lg-vt');
        if (!ficha) { visto = ''; return; }
        if (visto === web.partido && vent.querySelector('[data-mqficha]')) return;
        visto = web.partido;
        if (alFicha) alFicha(web.partido, vent);
      });
      mira.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
      return function () { abierta = false; mira.disconnect(); try { LIGAS.cerrar(); } catch (e) {} };
    }
  };

  var ctx = {
    tablas: tablas,
    alCambiar: function (f) { oyentes.push(f); },
    aviso: aviso,
    ponerTitulo: function (t) { document.title = (t === 'Konamigas' ? '' : t + ' · ') + 'Konamigas · maqueta'; },
    abierta: function () { return true; },
    web: web
  };

  function error(e) {
    document.getElementById('mqw').innerHTML = '<p class="u-error">No se ha podido abrir la web: ' + String(e && e.message || e) + '</p>';
  }

  function arrancar() {
    if (!seccion) return;
    // Primero, los goles de ejemplo de la maqueta (si GOLES está vacía); después, lo público.
    llamar('maquetaPreparar').catch(function () {}).then(function () { return llamar('maquetaWeb'); }).then(function (r) {
      PUB = r.tablas || {};
      CFG_LIGAS = r.ligas || {};
      poner(PUB, null);
      var yo = recordado();
      return (yo ? web.entrar(yo).then(function () { web.yo = yo; }, function () { recordar(''); }) : Promise.resolve()).then(function () {
        var el = document.getElementById('mqw');
        el.innerHTML = '';
        seccion.abrir(el, ctx);
      });
    }).catch(error);
  }

  // Para la copia del móvil, que va en una página: volver a pintar konamigas.com en un <main id="mqw"> nuevo, con lo leído.
  // recargar (simulador): la otra pantalla ha cambiado algo; se vuelve a leer lo público (y lo de quien ha entrado) y se
  // repinta donde se estaba.
  window.MQW = {
    // T0366: al volver (de la inscripción o del acta del árbitro), se vuelve a leer: lo de antes podía estar viejo.
    abrir: function (vista) { var el = document.getElementById('mqw'); if (el && seccion) { el.innerHTML = ''; web.volver = vista || true; seccion.abrir(el, ctx); window.MQW.recargar(); } },
    recargar: function () {
      return llamar('maquetaWeb').then(function (r) {
        PUB = r.tablas || {}; CFG_LIGAS = r.ligas || {};
        var yo = recordado();
        return yo ? web.entrar(yo) : poner(PUB, null);
      }).then(function () { window.dispatchEvent(new CustomEvent('mq-refrescar')); }, function () {});
    }
  };

  // maqueta.js se registra en window.UN, como en el núcleo; aquí no hay núcleo: se abre en esta página.
  // La sección Ligas (konamigas/secciones/ligas.js), si se carga antes, se queda para Competiciones.
  window.UN = { registrar: function (id, def) { if (id === 'LIGAS') LIGAS = def; if (id === 'MAQUETA') { seccion = def; arrancar(); } } };
})();
