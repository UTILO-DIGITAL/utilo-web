/*
 * Entrar con Google · UTILO_CORE 4.0 (T0190)
 * La web ya no pide PIN: cada persona entra con su cuenta de Google y la web manda su llave (token de acceso) en
 * cada llamada al motor del negocio, que comprueba con Google de quién es (API_WEB.gs de utilo-apps).
 * La llave se guarda en este dispositivo hasta que caduca (una hora). Para pedir otra, Google exige un clic de
 * la persona: si caduca, sale un aviso con el botón «Continuar» y la llamada sigue sola después.
 * Lo usa kanban4/app.js, en la página principal y dentro del tablero (el «puente» de google.script.run).
 * T0201: la llave lleva también el permiso «solo los archivos que crea o abre esta web» (drive.file): con él, el motor
 * lee y escribe el Excel del negocio en nombre de la persona. La primera vez, la persona conecta ese Excel con la
 * ventana de Google para elegir archivos (UG.conectar); Utilo no tiene acceso propio a los Excel.
 */
(function () {
  'use strict';
  var C = window.KANBAN || {};
  var K = 'kanban_' + (C.clave || 'negocio') + '_google';
  var ALCANCE = 'openid email https://www.googleapis.com/auth/drive.file';

  function leer() { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { return null; } }
  function guardar(o) { try { localStorage.setItem(K, JSON.stringify(o)); } catch (e) {} }
  function borrar() { try { localStorage.removeItem(K); } catch (e) {} }

  /** Carga la librería de Google la primera vez que hace falta. */
  function cargarGoogle() {
    return new Promise(function (ok, ko) {
      if (window.google && google.accounts && google.accounts.oauth2) return ok();
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = function () { ok(); };
      s.onerror = function () { ko(new Error('No se ha podido cargar Google. Comprueba la conexión.')); };
      document.head.appendChild(s);
    });
  }

  var UG = {
    /** Llave válida (con dos minutos de margen) o null. */
    llave: function () {
      var o = leer();
      return o && o.token && o.exp - Date.now() > 120000 ? o.token : null;
    },
    correo: function () { return (leer() || {}).correo || ''; },
    /** Abre la ventana de Google. Hay que llamarla desde un clic de la persona. */
    entrar: function () {
      var antes = leer();
      return cargarGoogle().then(function () {
        return new Promise(function (ok, ko) {
          google.accounts.oauth2.initTokenClient({
            client_id: C.google,
            scope: ALCANCE,
            hint: (antes && antes.correo) || '',
            callback: function (r) {
              if (r.error) return ko(new Error('Google no ha dado permiso (' + r.error + ').'));
              guardar({ token: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000, correo: (antes && antes.correo) || '' });
              ok(r.access_token);
            },
            error_callback: function (e) {
              ko(new Error(e && e.type === 'popup_closed' ? 'Has cerrado la ventana de Google sin entrar.' : 'No se ha podido abrir la ventana de Google. Revisa que el navegador no bloquee ventanas.'));
            }
          }).requestAccessToken({ prompt: antes && antes.correo ? '' : 'select_account' });
        });
      });
    },
    /** Apunta el correo de la persona (lo devuelve el motor al entrar) para no preguntar la cuenta la próxima vez. */
    recordarCorreo: function (correo) { var o = leer(); if (o) { o.correo = correo || ''; guardar(o); } },
    /** T0201: ventana de Google para conectar el Excel del negocio (id) con la web. Hay que llamarla desde un clic. */
    conectar: function (id) {
      var t = UG.llave();
      if (!t) return Promise.reject(new Error('Tu sesión de Google ha caducado. Vuelve a entrar.'));
      return new Promise(function (ok, ko) {
        var listo = function () {
          window.gapi.load('picker', function () {
            var P = window.google.picker;
            var vista = new P.DocsView(P.ViewId.SPREADSHEETS).setFileIds(id).setMode(P.DocsViewMode.LIST);
            new P.PickerBuilder().addView(vista).setOAuthToken(t).setDeveloperKey(C.clavePicker).setAppId(C.proyecto)
              .setTitle('Elige el Excel del negocio').setCallback(function (d) {
                if (d.action === P.Action.PICKED) ok();
                else if (d.action === P.Action.CANCEL) ko(new Error('Has cerrado la ventana sin elegir el Excel.'));
              }).build().setVisible(true);
          });
        };
        if (window.gapi) return listo();
        var s = document.createElement('script');
        s.src = 'https://apis.google.com/js/api.js';
        s.onload = listo;
        s.onerror = function () { ko(new Error('No se ha podido cargar la ventana de Google. Comprueba la conexión.')); };
        document.head.appendChild(s);
      });
    },
    /** Cierra la sesión y quita el permiso de la llave. */
    salir: function () {
      var o = leer();
      borrar();
      if (o && o.token && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(o.token, function () {});
    },
    /** Aviso con un botón para pedir otra llave cuando ha caducado (Google necesita el clic). */
    pedirClic: function () {
      return new Promise(function (ok, ko) {
        var v = document.createElement('div');
        v.setAttribute('role', 'alertdialog');
        v.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100000;background:#1C2B26;color:#fff;' +
          'padding:12px 14px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25);display:flex;gap:12px;align-items:center;' +
          'font:15px/1.35 system-ui,sans-serif;max-width:calc(100vw - 32px)';
        v.innerHTML = '<span>Tu sesión de Google ha caducado.</span>';
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'Continuar';
        b.style.cssText = 'border:0;border-radius:8px;padding:8px 14px;font:600 15px system-ui,sans-serif;background:#fff;color:#1C2B26;cursor:pointer';
        b.onclick = function () {
          b.disabled = true;
          UG.entrar().then(function (t) { v.remove(); ok(t); }, function (e) { v.remove(); ko(e); });
        };
        v.appendChild(b);
        document.body.appendChild(v);
        b.focus();
      });
    },
    /** Llamada al motor con la llave de la persona. Si ha caducado, pide el clic y lo intenta otra vez. */
    llamar: function (api, cuerpo, otraVez) {
      var t = UG.llave();
      return (t ? Promise.resolve(t) : UG.pedirClic()).then(function (tok) {
        var c = {};
        for (var k in cuerpo) if (Object.prototype.hasOwnProperty.call(cuerpo, k)) c[k] = cuerpo[k];
        c.token = tok;
        return fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(c) });
      }).then(function (r) {
        if (!r.ok) throw new Error('No hay conexión con el DAILY (' + r.status + ').');
        return r.json();
      }).then(function (o) {
        if (o.ok) return o.r;
        var e = new Error(String(o.error || 'Error'));
        e.acceso = /^ACCESO:/.test(e.message);
        if (e.acceso && /caducado/.test(e.message) && !otraVez) {
          var g = leer(); if (g) { g.exp = 0; guardar(g); }
          return UG.llamar(api, cuerpo, true);
        }
        throw e;
      });
    }
  };
  window.UG = UG;
})();
