/*
 * Entrar por Supabase · UTILO_CORE 5.0 (T0386) · el marco del núcleo sin Apps Script
 *
 * El marco (nucleo/nucleo.js) habla con «UG»: entrar, llamar al motor y la sesión. En una web cuyos datos están en Supabase
 * y no tiene motor (la plataforma de Utilo, clientes/utilo/plataforma), este archivo hace de UG en lugar de kanban4/google.js:
 * - Entrar con Google lo hace Supabase Auth (PKCE): la página va a Google y vuelve con un código, que se cambia por la
 *   sesión. La sesión (access_token y refresh_token) queda en el dispositivo y se renueva sola antes de caducar.
 * - «entrar» del marco: quién eres y tus roles salen de mi_acceso() de la base. El perfil es tu rol más alto (en el orden de
 *   nucleo.perfiles de su config.json) y las secciones, las del montaje (montaje.js, de montar.js) que tus roles ven.
 * - Lo que pide una sección (las tablas y las funciones de su «api») va a Supabase con la capa de tablas (nucleo/supabase.js),
 *   con la sesión de quien ha entrado. Quién puede qué lo dicen las reglas por fila: aquí no se comprueba nada que importe.
 * - Sin «entrar como otra persona» (sinComo): con Supabase, cada uno entra con su sesión.
 * - El entorno: DEV si la página está en utilo-web/dev-rama/; si no, producción. Cada uno con su proyecto (montaje.supabase).
 *
 * window.KANBAN = { clave, marca, nombreApp, supabase: true } y window.NUCLEO_MONTAJE (montaje.js) van antes; después,
 * kanban4/tablas.js, nucleo/supabase.js, este archivo y nucleo/nucleo.js. En el modo local, local-navegador.js cambia
 * cómo se entra (un selector con las personas del seed.sql) y de dónde sale la sesión.
 */
(function () {
  'use strict';
  var C = window.KANBAN || {};
  var M = window.NUCLEO_MONTAJE || {};
  // En el modo local, local.js pone C.supabaseLocal ({ url, clave, nombre }): el Supabase de npm run local.
  var ENTORNO = C.supabaseLocal ? 'local' : /\/dev-rama\//.test(location.pathname) ? 'dev' : 'prod';
  var P = C.supabaseLocal || (M.supabase || {})[ENTORNO] || {};
  var URL_SB = String(P.url || '').replace(/\/+$/, '');
  var K = 'sb_' + (C.clave || 'negocio') + '_' + ENTORNO;      // la sesión de este dispositivo
  var KV = K + '_verificador';                                  // PKCE: lo que se guarda mientras se va a Google

  function leer() { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { return null; } }
  function guardar(s) { try { localStorage.setItem(K, JSON.stringify(s)); } catch (e) {} }
  function borrar() { try { localStorage.removeItem(K); } catch (e) {} }
  function ahora() { return Math.floor(Date.now() / 1000); }
  function bajo(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  /** La sesión que da Auth → lo que se guarda. */
  function sesionDe(j, antes) {
    return { access_token: j.access_token, refresh_token: j.refresh_token || (antes && antes.refresh_token) || '',
      expires_at: j.expires_at || ahora() + (Number(j.expires_in) || 3600), correo: bajo((j.user && j.user.email) || (antes && antes.correo) || '') };
  }

  function auth(ruta, cuerpo) {
    return fetch(URL_SB + '/auth/v1/' + ruta, { method: 'POST', headers: { apikey: P.clave, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); });
  }

  /* ---------- PKCE ---------- */

  function b64url(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function verificador() { var a = new Uint8Array(48); crypto.getRandomValues(a); return b64url(a); }
  function reto(v) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)).then(function (h) { return b64url(new Uint8Array(h)); }); }
  /** Donde vuelve Google: esta misma página, sin lo que lleve detrás. */
  function vuelta() { return location.origin + location.pathname; }

  /* ---------- la sesión ---------- */

  var renovando = null;
  /** El access_token vigente (con un minuto de margen); si ha caducado, se renueva con el refresh_token. */
  function token() {
    if (S.sesionLocal) return S.sesionLocal(); // modo local
    var s = leer();
    if (!s || !s.refresh_token) return Promise.reject(accesoError('ACCESO: entra con tu cuenta de Google.'));
    if (s.access_token && s.expires_at - 60 > ahora()) return Promise.resolve(s.access_token);
    if (renovando) return renovando;
    renovando = auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token }).then(function (r) {
      renovando = null;
      if (!r.ok || !r.j.access_token) { borrar(); throw accesoError('ACCESO: tu sesión ha caducado: vuelve a entrar.'); }
      var n = sesionDe(r.j, s);
      guardar(n);
      return n.access_token;
    }, function (e) { renovando = null; throw e; });
    return renovando;
  }
  function accesoError(m) { var e = new Error(m); e.acceso = true; return e; }

  /**
   * Si la página vuelve de Google con ?code=…, se cambia por la sesión y se limpia la dirección. Devuelve una promesa:
   * true si ha entrado, false si no venía de Google; si Google o Supabase dicen que no, falla con su motivo.
   */
  function alVolver() {
    var q = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
    var codigo = q.get('code'), error = q.get('error_description') || q.get('error');
    if (!codigo && !error) return Promise.resolve(false);
    var limpia = location.pathname + (q.get('s') ? '?s=' + encodeURIComponent(q.get('s')) : '');
    history.replaceState(null, '', limpia);
    var v = null;
    try { v = sessionStorage.getItem(KV); sessionStorage.removeItem(KV); } catch (e) {}
    if (error) return Promise.reject(accesoError('ACCESO: ' + String(error).replace(/\+/g, ' ')));
    if (!v) return Promise.reject(accesoError('ACCESO: la vuelta de Google no es de esta pestaña: vuelve a entrar.'));
    return auth('token?grant_type=pkce', { auth_code: codigo, code_verifier: v }).then(function (r) {
      if (!r.ok || !r.j.access_token) throw accesoError('ACCESO: Supabase no da la entrada (' + (r.j.msg || r.j.error_description || r.j.message || 'sin sesión') + ').');
      guardar(sesionDe(r.j));
      return true;
    });
  }

  /* ---------- las tablas y las funciones ---------- */

  var funciones = [];
  (M.secciones || []).forEach(function (s) { (s.api || []).forEach(function (f) { if (funciones.indexOf(f) < 0) funciones.push(f); }); });
  var sb = null;
  function capa() {
    if (!sb) sb = window.US.crear({ url: URL_SB, clave: P.clave, token: token, esquema: M.esquema, funciones: funciones.concat(['mi_acceso']),
      fetch: function (u, x) { return fetch(u, x); } }); // el de la página (en las pruebas, el del navegador falso)
    return sb;
  }

  /** Quién eres y qué ves, como lo da «entrar» del motor (lo que lee credDe de nucleo.js). */
  /** T0386: la versión publicada y sus novedades (versiones.json, que deja «Publicar» junto a la página). Sin él (local, DEV), ninguna. */
  function versiones() {
    try {
      return fetch(new URL('versiones.json', location.href).href, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return j && Array.isArray(j.versiones) ? j : null; }, function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function entrar() {
    var vs = versiones();
    return capa().rpc('mi_acceso', {}).then(function (yo) { return vs.then(function (v) { return [yo, v]; }); }).then(function (x) {
      var yo = x[0], ver = x[1];
      var correo = bajo((leer() || {}).correo || S.correoLocal || '');
      if (!yo) throw accesoError('ACCESO: ' + (correo ? 'la cuenta ' + correo : 'tu cuenta') + ' no tiene acceso a ' + (M.negocio || 'esta web') + '. Pide que te lo den.');
      var roles = yo.roles || [], orden = M.perfiles || [];
      if (!roles.length) throw accesoError('ACCESO: ' + yo.nombre + ', todavía no tienes ningún rol en ' + (M.negocio || 'esta web') + '. Pide que te lo den.');
      var mios = roles.map(function (r) { return r.rol; });
      var alto = roles.slice().sort(function (a, b) { return pos(orden, a.rol) - pos(orden, b.rol); })[0];
      var admin = mios.indexOf('admin') >= 0;
      var secciones = (M.secciones || []).filter(function (s) {
        return admin || s.perfiles === 'todos' || (Array.isArray(s.perfiles) && s.perfiles.some(function (p) { return mios.indexOf(p) >= 0; }));
      }).map(function (s) {
        var o = { id: s.id, titulo: s.titulo, icono: s.icono, web: s.web, version: s.version, config: s.config || {} };
        if (s.enPerfil) o.enPerfil = true;
        if (s.menu === false) o.menu = false;
        return o;
      }).filter(function (s) { return s.menu !== false; });
      return {
        persona: yo.nombre, correo: bajo(yo.correo || correo), perfil: alto.nombre + (alto.ambito !== 'todo' && alto.ambito_id ? ' en ' + alto.ambito_id : ''),
        admin: admin, negocio: M.negocio || '', dev: ENTORNO === 'prod' ? '' : (ENTORNO === 'dev' ? 'DEV' : 'Local') + ' · Supabase ' + (P.nombre || 'de pruebas') + (M.commit ? ' · ' + M.commit : ''),
        secciones: secciones, version: (ver && ver.version) || M.version || '', versiones: (ver && ver.versiones) || [], persona_id: yo.persona, roles: roles,
        perfilEnMenu: M.perfilEnMenu !== false   // T0415: false, Perfil fuera del menú (con el nombre de la cabecera)
      };
    });
  }
  function pos(orden, rol) { var i = orden.indexOf(rol); return i < 0 ? 99 : i; }

  /** Lo que piden el marco y las secciones: { fn, args }. */
  function llamar(api, cuerpo) {
    var fn = cuerpo && cuerpo.fn;
    if (fn === 'nucleoPersonas' || (fn === 'entrar' && cuerpo.como)) return Promise.reject(new Error('COMO: con Supabase no se entra como otra persona.'));
    return (fn === 'entrar' ? entrar() : capa().llamar(fn, cuerpo.args || [])).catch(function (e) {
      if (/^ACCESO:/.test(e.message)) e.acceso = true;
      throw e;
    });
  }

  var S = {
    supabase: true,
    sinComo: true,
    entorno: ENTORNO,
    /** Lo que antes daba «inicio» del motor: el nombre y si es DEV. */
    inicio: function () {
      if (!URL_SB || !P.clave) return Promise.reject(new Error('Esta web no sabe a qué Supabase llamar (falta ' + ENTORNO + ' en su montaje.js).'));
      return Promise.resolve({ negocio: M.negocio || '', titulo: C.nombreApp || M.nombreApp || M.negocio || '', nucleo: { dev: ENTORNO === 'prod' ? '' : (ENTORNO === 'dev' ? 'DEV' : 'Local') + ' · Supabase ' + (P.nombre || 'de pruebas') } });
    },
    configurar: function () {},
    /** Lo que trae la vuelta de Google (o false si no se venía de allí). La espera nucleo.js antes de pintar. */
    volviendo: null,
    llave: function () { var s = leer(); return s && s.refresh_token ? s.access_token : null; },
    tieneSesion: function () { return S.sesionLocal ? !!S.correoLocal : !!(leer() || {}).refresh_token; },
    correo: function () { return S.correoLocal || (leer() || {}).correo || ''; },
    recordarCorreo: function (correo) { var s = leer(); if (s) { s.correo = bajo(correo); guardar(s); } },
    /** A Google por Supabase Auth: la página se va y vuelve con el código (alVolver). Hay que llamarla desde un clic. */
    entrar: function () {
      var v = verificador();
      try { sessionStorage.setItem(KV, v); } catch (e) {}
      return reto(v).then(function (r) {
        var antes = leer();
        location.assign(URL_SB + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(vuelta() + location.search) +
          '&code_challenge=' + r + '&code_challenge_method=s256' + (antes && antes.correo ? '&login_hint=' + encodeURIComponent(antes.correo) : ''));
        return new Promise(function () {}); // la página se va
      });
    },
    llamar: llamar,
    seccion: function (api, cuerpo, clave) {
      return llamar(api, cuerpo).catch(function (e) {
        if (e.acceso) { borrar(); try { localStorage.removeItem(clave); } catch (x) {} location.reload(); }
        throw new Error(String(e.message || 'Error').replace(/^(SECCION|ACCESO):\s*/, ''));
      });
    },
    conectar: function () { return Promise.resolve(); },
    elegir: function () { return Promise.reject(new Error('Esta web no elige archivos de Drive.')); },
    /** Cierra la sesión aquí y en Supabase. */
    salir: function () {
      var s = leer();
      borrar();
      if (s && s.access_token && URL_SB) fetch(URL_SB + '/auth/v1/logout', { method: 'POST', headers: { apikey: P.clave, Authorization: 'Bearer ' + s.access_token } }).catch(function () {});
    },
    /** T0386: la capa de Supabase (para las pruebas y el modo local). */
    capa: capa,
    /** T0386: avisos en directo de los cambios en unas tablas de la base (Realtime, con la sesión de quien ha entrado). */
    enDirecto: function (tablas, alCambiar) {
      return window.US.directo({ url: URL_SB, clave: P.clave, token: token, tablas: tablas, alCambiar: alCambiar });
    },
    _: { alVolver: alVolver, sesionDe: sesionDe, entrar: entrar, token: token }
  };
  window.UG = S;
  // Si se vuelve de Google, nucleo.js espera a que la sesión esté guardada.
  S.volviendo = alVolver();
  S.volviendo.catch(function () {});
})();
