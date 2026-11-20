/*
 * nucleo/uso.js · T0682 · El uso de la app: quién entra, qué secciones abre, qué avisos y errores ve y cuánto espera
 *
 * Lo carga el marco (nucleo/nucleo.js) solo si el motor dice a dónde mandarlo (config.json · nucleo.uso → «entrar» trae
 * uso: { app, url, clave }) y no se está viendo como otra persona. Lo manda al Supabase de Utilo (apuntar_uso, docs/USO.md)
 * y lo lee la sección Uso de la plataforma y herramientas/uso.js.
 *
 * No hace esperar a nadie: los eventos se juntan en memoria y salen de golpe (como mucho 50) a los 30 segundos del primero
 * o al dejar la página (keepalive), sin esperar la respuesta; si no llegan, se vuelven a probar una vez y después se dejan.
 * En el ordenador de quien programa (localhost) no sale nada: se queda en NUCLEO_USO.local para verlo y para las pruebas.
 *
 * Qué apunta (tipo · seccion · que · ms):
 * - entrar: al abrir la app, y al volver a ella tras más de 30 minutos fuera (otra visita) · que: la versión que se ve.
 * - seccion: cada sección que abre (no la misma dos veces seguidas) · que: su título.
 * - aviso: lo que una sección dice en rojo (un .u-error que se enseña: «Falta el CIF del cliente»), una vez por texto en 10 s.
 * - error: una llamada al motor que falla (que: el mensaje y la función) y los fallos de la página (como mucho 5 por visita).
 * - espera: una llamada al motor de más de 3 segundos · que: la función · ms: lo que tardó.
 * - salir: al dejar la página o pasarla a segundo plano · ms: lo que lleva la visita (la última de cada visita, lo que duró).
 * Cada evento lleva la visita (sesion), quién (correo, persona, perfil), el aparato (movil u ordenador) y la sección en la
 * que estaba. Nada de lo que hay en las tablas: ni lo que escribe ni lo que lee.
 */
(function (raiz) {
  'use strict';

  var CADA = 30000;          // a los 30 s del primer evento pendiente, salen
  var LOTE = 50;             // los que acepta apuntar_uso de una vez
  var COLA_MAX = 200;        // si no hay conexión, como mucho estos en memoria (los más antiguos se dejan)
  var LENTO = 3000;          // una llamada más lenta que esto es una «espera»
  var OTRA_VISITA = 30 * 60000;
  var REPETIDO = 10000;      // el mismo aviso dentro de 10 s cuenta una vez
  var FALLOS_PAGINA = 5;

  function aparato(nav, ancho) {
    var ua = String((nav && nav.userAgent) || '');
    if (/iPhone|iPod|Android.+Mobile|Mobile Safari|IEMobile|Opera Mini/i.test(ua)) return 'movil';
    if (/iPad|Android/i.test(ua)) return 'movil';
    return ancho && ancho < 700 ? 'movil' : 'ordenador';
  }
  function azar() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function limpio(m) { return String((m && m.message) || m || '').replace(/^[A-Z]+:\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 280); }

  /**
   * o: { app, url, clave, correo, persona, perfil, version, local (no manda: lo deja en local), aparato,
   *      fetch, ahora, programar(f, ms), cancelar(id), documento } (los cuatro últimos, para las pruebas).
   */
  function crear(o) {
    var ahora = o.ahora || function () { return Date.now(); };
    var programar = o.programar || function (f, ms) { return setTimeout(f, ms); };
    var cancelar = o.cancelar || function (id) { clearTimeout(id); };
    var traer = o.fetch || (typeof fetch === 'function' ? function (u, x) { return fetch(u, x); } : null);
    var cola = [], reintento = [], temporizador = null, actual = '', ultimaSeccion = { id: '', t: 0 };
    var sesion = azar(), inicio = ahora(), fuera = 0, salido = false, fallosPagina = 0, parado = false;
    var avisos = {};
    var local = o.local ? (raiz.NUCLEO_USO && raiz.NUCLEO_USO.local) || [] : null;

    function evento(tipo, x) {
      if (parado) return;
      x = x || {};
      cola.push({
        cuando: new Date(ahora()).toISOString(), sesion: sesion, correo: o.correo || '', persona: o.persona || '', perfil: o.perfil || '',
        aparato: o.aparato || 'ordenador', tipo: tipo, seccion: x.seccion !== undefined ? x.seccion : actual,
        que: x.que ? String(x.que).slice(0, 300) : '', ms: typeof x.ms === 'number' && x.ms >= 0 ? Math.round(x.ms) : null
      });
      if (cola.length > COLA_MAX) cola.splice(0, cola.length - COLA_MAX);
      if (!temporizador) temporizador = programar(function () { temporizador = null; enviar(false); }, CADA);
    }

    /** Manda lo pendiente (de 50 en 50). final: al dejar la página (keepalive, sin esperar nada). */
    function enviar(final) {
      if (temporizador) { cancelar(temporizador); temporizador = null; }
      while (cola.length) {
        var lote = cola.splice(0, LOTE);
        if (local) { Array.prototype.push.apply(local, lote); continue; }
        if (!traer || !o.url) continue;
        mandar(lote, final);
      }
    }
    function mandar(lote, final) {
      var p;
      try {
        p = traer(o.url.replace(/\/$/, '') + '/rest/v1/rpc/apuntar_uso', {
          method: 'POST', keepalive: !!final,
          headers: { apikey: o.clave, 'Content-Type': 'application/json' },
          body: JSON.stringify({ app: o.app, eventos: lote })
        });
      } catch (e) { p = null; }
      if (!p || typeof p.then !== 'function') return;
      p.then(function (r) { if (r && r.ok === false && r.status >= 500) otraVez(lote); }, function () { otraVez(lote); });
    }
    /** Una sola vez más: si tampoco llega, se deja (mejor perder un evento que cargar la app). */
    function otraVez(lote) {
      var nuevos = lote.filter(function (e) { return reintento.indexOf(e) < 0; });
      if (!nuevos.length || parado) return;
      reintento = reintento.concat(nuevos).slice(-COLA_MAX);
      cola = nuevos.concat(cola).slice(-COLA_MAX);
      if (!temporizador) temporizador = programar(function () { temporizador = null; enviar(false); }, CADA);
    }

    function seccion(id, titulo) {
      var t = ahora();
      actual = id || '';
      if (ultimaSeccion.id === actual && t - ultimaSeccion.t < 5000) return; // el marco se repinta: la misma, una vez
      ultimaSeccion = { id: actual, t: t };
      evento('seccion', { seccion: actual, que: titulo || id });
    }
    function aviso(texto) {
      var q = limpio(texto), t = ahora();
      if (!q || (avisos[q] && t - avisos[q] < REPETIDO)) return;
      avisos[q] = t;
      evento('aviso', { que: q });
    }
    /** Una llamada al motor: lo que tardó y, si falló, el error. */
    function medido(fn, ms, error) {
      if (error) evento('error', { que: limpio(error) + (fn ? ' (' + fn + ')' : '') });
      if (ms > LENTO) evento('espera', { que: fn || '', ms: ms });
    }
    function falloPagina(m) {
      if (++fallosPagina > FALLOS_PAGINA) return;
      evento('error', { que: 'Fallo de la página: ' + limpio(m) });
    }
    /** Deja la página o la pasa a segundo plano: lo que lleva la visita, y todo sale ya. */
    function salir() {
      if (salido) return;
      salido = true; fuera = ahora();
      evento('salir', { ms: ahora() - inicio });
      enviar(true);
    }
    /** Vuelve a la página: si ha estado fuera más de 30 minutos, es otra visita. */
    function volver() {
      if (!salido) return;
      salido = false;
      if (ahora() - fuera > OTRA_VISITA) {
        sesion = azar(); inicio = ahora(); ultimaSeccion = { id: '', t: 0 };
        evento('entrar', { que: o.version || '' });
        if (actual) seccion(actual, '');
      }
    }
    /** Cerrar sesión u otra persona: lo pendiente sale y no se apunta nada más. */
    function parar() { if (!parado) { if (!salido) salir(); parado = true; } }

    evento('entrar', { que: o.version || '', seccion: '' });
    return {
      correo: o.correo || '', evento: evento, seccion: seccion, aviso: aviso, medido: medido, falloPagina: falloPagina,
      salir: salir, volver: volver, parar: parar, enviar: enviar,
      pendientes: function () { return cola.slice(); }, sesion: function () { return sesion; }
    };
  }

  /** Mide las llamadas al motor de UG (kanban4/google.js: seccion y llamar), una vez, para el uso que diga u(). */
  function envolver(UG, u) {
    ['seccion', 'llamar'].forEach(function (k) {
      var f = UG && UG[k];
      if (typeof f !== 'function' || f.usoMedida) return;
      var g = function (api, c) {
        var x = u(), t0 = Date.now(), p = f.apply(this, arguments), fn = (c && c.fn) || k;
        if (!x || !p || typeof p.then !== 'function') return p;
        return p.then(function (r) { x.medido(fn, Date.now() - t0); return r; },
          function (e) { x.medido(fn, Date.now() - t0, e); throw e; });
      };
      g.usoMedida = true;
      UG[k] = g;
    });
  }

  /** Los avisos en rojo de las secciones (.u-error que se enseña con texto), sin tocar ninguna. */
  function vigilarAvisos(doc, u) {
    if (!doc || !doc.body || typeof MutationObserver !== 'function') return null;
    var visto = typeof WeakMap === 'function' ? new WeakMap() : null, pendiente = null;
    function mirar() {
      pendiente = null;
      var x = u();
      if (!x || !visto) return;
      var els = doc.querySelectorAll('.u-error');
      for (var i = 0; i < els.length; i++) {
        var el = els[i], t = (el.textContent || '').trim();
        var ve = t && !el.closest('[hidden]');
        if (ve && visto.get(el) !== t) x.aviso(t);
        visto.set(el, ve ? t : '');
      }
    }
    var ob = new MutationObserver(function () { if (!pendiente) pendiente = setTimeout(mirar, 300); });
    ob.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
    return ob;
  }

  raiz.NUCLEO_USO = { crear: crear, envolver: envolver, vigilarAvisos: vigilarAvisos, aparato: aparato, local: (raiz.NUCLEO_USO && raiz.NUCLEO_USO.local) || [],
    LENTO: LENTO, CADA: CADA, OTRA_VISITA: OTRA_VISITA };
})(typeof window !== 'undefined' ? window : globalThis);
