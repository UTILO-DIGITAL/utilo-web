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
 * - El entorno: DEV si la página está en utilo-web/dev-rama/ o, T0441, en dev-ramas/<rama>/ (la banda dice la rama); si no,
 *   producción. Cada uno con su proyecto (montaje.supabase). Todas las ramas comparten la sesión de DEV de este dispositivo.
 * - T0391 · Entrar con un código al correo (montaje.entrar con 'codigo'): pedirCodigo(correo) pide a Auth que lo envíe y
 *   entrarConCodigo(correo, codigo) lo cambia por la sesión. En local y DEV el correo no sale: buzon(correo) lo lee del
 *   buzón de pruebas. correos.* son los de quien ha entrado (Perfil: añadir otro, confirmado con su código).
 * - T0432 · avisos.* (solo si montaje.avisos trae la clave pública de este entorno): los avisos al móvil (Web Push) de este
 *   dispositivo, con el service worker sw.js de la carpeta de la página. Perfil: activar, probar, quitar y los últimos.
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
  var ENTORNO = C.supabaseLocal ? 'local' : /\/dev-ramas?\//.test(location.pathname) ? 'dev' : 'prod';
  var RAMA = (/\/dev-ramas\/([^/]+)\//.exec(location.pathname) || [])[1] || '';     // T0441: la rama de dev-ramas/<rama>/
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

  /* ---------- T0391 · entrar con un código al correo ---------- */

  function correoValido(c) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c); }
  function motivoAuth(j) { return String((j && (j.msg || j.error_description || j.message || j.error)) || '').trim(); }
  function demasiados(j) { return !!j && (/^over_.*rate_limit$/.test(j.error_code || '') || j.code === 429 || /rate limit|too many/i.test(motivoAuth(j))); }

  /**
   * Pide a Auth que envíe un código a ese correo. Se resuelve igual si el correo no tiene acceso (el hook no deja crear su
   * usuario): así la página no dice qué correos son de alguien. Solo falla si el correo no tiene forma de correo, si se han
   * pedido demasiados o si no hay conexión.
   */
  function pedirCodigo(correo) {
    var c = bajo(correo);
    if (!correoValido(c)) return Promise.reject(new Error('Escribe tu correo entero (nombre@dominio.com).'));
    return auth('otp', { email: c, create_user: true }).then(function (r) {
      if (r.ok) return c;
      if (demasiados(r.j)) throw new Error('Has pedido muchos códigos seguidos: espera unos minutos y vuelve a pedirlo.');
      if (r.j && r.j.error_code === 'validation_failed') throw new Error('Escribe tu correo entero (nombre@dominio.com).');
      return c; // sin acceso (el hook) u otro «no»: lo mismo que si se hubiera enviado
    }, function () { throw new Error('No hay conexión: revisa internet y vuelve a pedir el código.'); });
  }

  /** Cambia el código por la sesión. Un código equivocado y uno caducado, Auth los dice igual. */
  function entrarConCodigo(correo, codigo) {
    var c = bajo(correo), k = String(codigo == null ? '' : codigo).replace(/\s+/g, '');
    // Auth manda 6 u 8 cifras según el proyecto (Email OTP Length en el panel): vale el largo que llegue.
    if (!/^\d{6,10}$/.test(k)) return Promise.reject(new Error('El código son las cifras que te han llegado al correo.'));
    return auth('verify', { type: 'email', email: c, token: k }).then(function (r) {
      if (!r.ok || !r.j.access_token) {
        if (demasiados(r.j)) throw new Error('Has probado demasiadas veces: espera unos minutos y pide otro código.');
        throw new Error('El código no es ese o ha caducado. Revísalo o pide otro.');
      }
      guardar(sesionDe(r.j));
      return true;
    }, function () { throw new Error('No hay conexión: revisa internet y vuelve a probar.'); });
  }

  /** Local y DEV: los últimos correos del buzón de pruebas a ese correo (sin entrar), o null si aquí no hay buzón. */
  function buzon(correo) {
    if (ENTORNO === 'prod' || !URL_SB) return Promise.resolve(null);
    return fetch(URL_SB + '/rest/v1/rpc/buzon_de_pruebas', { method: 'POST', headers: { apikey: P.clave, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ correo: bajo(correo) }) })
      .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; });
  }

  /** Los correos de quien ha entrado (Perfil): leer, añadir con su código, confirmar y quitar. */
  var correos = {
    mios: function () { return capa().rpc('mis_correos', {}); },
    anadir: function (c) {
      c = bajo(c);
      if (!correoValido(c)) return Promise.reject(new Error('Escribe el correo entero (nombre@dominio.com).'));
      return capa().rpc('anadir_correo', { correo: c });
    },
    confirmar: function (c, k) { return capa().rpc('confirmar_correo', { correo: bajo(c), codigo: String(k == null ? '' : k).replace(/\s+/g, '') }); },
    quitar: function (c) { return capa().rpc('quitar_correo', { correo: bajo(c) }); }
  };

  /* ---------- T0432 · avisos al móvil (Web Push) ---------- */

  // La clave pública VAPID de este entorno (montaje.avisos, de config.json · supabase.avisos). Sin ella, sin avisos.
  var VAPID = (M.avisos || {})[ENTORNO] || '';
  var SW = 'sw.js'; // en la carpeta de la página: solo así atiende la plataforma (su «scope»)

  function deB64url(t) {
    t = String(t || '').replace(/-/g, '+').replace(/_/g, '/');
    var bin = atob(t + '==='.slice((t.length + 3) % 4)), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function instalada() {
    if (typeof navigator === 'undefined') return false;
    return !!((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone);
  }
  /** Un nombre para este dispositivo, para la lista del Perfil: «iPhone · app», «Mac · Chrome»… */
  function dispositivo() {
    var ua = navigator.userAgent || '', que = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' :
      /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Ordenador';
    var nav = instalada() ? 'app' : /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
    return que + ' · ' + nav;
  }
  function soportado() { return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function registro() {
    var ic = document.querySelector('link[rel="apple-touch-icon"]') || document.querySelector('link[rel="icon"]');
    var icono = ic && /^https?:/.test(ic.href) ? ic.href : '';
    return navigator.serviceWorker.register(SW + '?sb=' + encodeURIComponent(URL_SB) + '&k=' + encodeURIComponent(P.clave || '') + '&i=' + encodeURIComponent(icono), { scope: './' })
      .then(function () { return navigator.serviceWorker.ready; });
  }
  /** La suscripción de este dispositivo, si la hay (sin pedir nada). */
  function suscripcion() {
    if (!soportado()) return Promise.resolve(null);
    return navigator.serviceWorker.getRegistration('./').then(function (r) { return r ? r.pushManager.getSubscription() : null; }, function () { return null; });
  }
  function guardarSus(sus) {
    var j = sus.toJSON(), k = j.keys || {};
    return capa().rpc('avisos_guardar', { endpoint: j.endpoint, p256dh: k.p256dh, auth: k.auth, dispositivo: dispositivo() }).then(function () { return sus; });
  }
  /** ¿Es de esta clave? Una suscripción hecha con otra clave (otro entorno, claves nuevas) no recibe nada: se rehace. */
  function deEstaClave(sus) {
    var k = sus && sus.options && sus.options.applicationServerKey;
    if (!k) return true;
    var a = new Uint8Array(k), b = deB64url(VAPID);
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  var avisos = !VAPID ? null : {
    /** Cómo está este dispositivo: { soportado, instalada, ios, permiso, activo }. */
    estado: function () {
      var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '', o = { soportado: soportado(), instalada: instalada(), ios: /iPhone|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1),
        permiso: 'Notification' in window ? Notification.permission : 'default', activo: false };
      if (!o.soportado) return Promise.resolve(o);
      return suscripcion().then(function (s) { o.activo = !!s && o.permiso === 'granted' && deEstaClave(s); return o; });
    },
    /** Pide permiso (tiene que ser desde un clic), suscribe este dispositivo y lo guarda en la base. */
    activar: function () {
      if (!soportado()) return Promise.reject(new Error('Este navegador no puede recibir avisos.'));
      return Promise.resolve(Notification.requestPermission()).then(function (p) {
        if (p !== 'granted') throw new Error(p === 'denied' ? 'Has dicho que no a los avisos: se cambia en los ajustes del móvil (Notificaciones › Utilo).' : 'Sin permiso no llegan los avisos.');
        return registro();
      }).then(function (reg) {
        return reg.pushManager.getSubscription().then(function (s) {
          if (s && deEstaClave(s)) return s;
          return (s ? s.unsubscribe() : Promise.resolve()).then(function () {
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deB64url(VAPID) });
          });
        });
      }).then(guardarSus);
    },
    /** Este dispositivo deja de recibir avisos. */
    desactivar: function () {
      return suscripcion().then(function (s) {
        if (!s) return false;
        var e = s.endpoint;
        return s.unsubscribe().then(function () { return capa().rpc('avisos_quitar', { endpoint: e }); });
      });
    },
    /** Al entrar: si este dispositivo ya los recibe, la base lo sabe al día (y si el móvil ha cambiado la suscripción, la nueva). */
    refrescar: function () {
      if (!soportado() || Notification.permission !== 'granted') return Promise.resolve(false);
      return suscripcion().then(function (s) { return s && deEstaClave(s) ? guardarSus(s).then(function () { return true; }) : false; }).catch(function () { return false; });
    },
    /** Un aviso de prueba a mis dispositivos (la función del servidor «avisar», con mi sesión). */
    prueba: function () {
      return capa().rpc('avisar', { titulo: 'Aviso de prueba', texto: 'Toca para abrir la plataforma.', origen: 'Prueba' }, true);
    },
    /** Mis dispositivos y mis últimos avisos (mis_avisos de la base). */
    mios: function () { return capa().rpc('mis_avisos', {}); }
  };

  /* ---------- las tablas y las funciones ---------- */

  var funciones = [], servidor = [];
  (M.secciones || []).forEach(function (s) {
    (s.api || []).forEach(function (f) { if (funciones.indexOf(f) < 0) funciones.push(f); });
    (s.servidor || []).forEach(function (f) { if (servidor.indexOf(f) < 0) servidor.push(f); }); // T0394: las Edge Functions de su api
  });
  var sb = null;
  function capa() {
    if (!sb) sb = window.US.crear({ url: URL_SB, clave: P.clave, token: token, esquema: M.esquema, funciones: funciones.concat(['mi_acceso']), servidor: servidor,
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
        if (s.cifra) o.cifra = s.cifra; // T0412: el número del menú (nucleo.js · cifras)
        return o;
      }).filter(function (s) { return s.menu !== false; });
      if (avisos) avisos.refrescar(); // T0432: sin esperar
      return {
        persona: yo.nombre, correo: bajo(yo.correo || correo), perfil: alto.nombre + (alto.ambito !== 'todo' && alto.ambito_id ? ' en ' + alto.ambito_id : ''),
        admin: admin, negocio: M.negocio || '', dev: ENTORNO === 'prod' ? '' : (ENTORNO === 'dev' ? 'DEV' : 'Local') + (RAMA ? ' · ' + decodeURIComponent(RAMA) : '') + ' · Supabase ' + (P.nombre || 'de pruebas') + (M.commit ? ' · ' + M.commit : ''),
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
      return Promise.resolve({ negocio: M.negocio || '', titulo: C.nombreApp || M.nombreApp || M.negocio || '', nucleo: { dev: ENTORNO === 'prod' ? '' : (ENTORNO === 'dev' ? 'DEV' : 'Local') + (RAMA ? ' · ' + decodeURIComponent(RAMA) : '') + ' · Supabase ' + (P.nombre || 'de pruebas') } });
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
    /** T0391 · Cómo se entra en esta web (montaje.js: nucleo.entrar): 'google' y/o 'codigo', en ese orden en la pantalla. */
    formas: function () { var f = [].concat(M.entrar || ['google']).filter(function (x) { return x === 'google' || x === 'codigo'; }); return f.length ? f : ['google']; },
    pedirCodigo: pedirCodigo,
    entrarConCodigo: entrarConCodigo,
    buzon: buzon,
    correos: correos,
    avisos: avisos,
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
