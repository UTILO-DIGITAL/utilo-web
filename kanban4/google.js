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
 * T0207: lo mismo con cada Excel de un módulo (ECONOMIA, GESTION) y con las carpetas de facturas: UG.conectar acepta
 * un Excel o una carpeta, y UG.seccion (la llamada de los módulos de sección) pide conectarlo dentro de la sección y
 * vuelve a probar. UG.elegir abre la ventana de Google en una carpeta para escoger un archivo que ya está en Drive.
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
    /**
     * T0201: ventana de Google para conectar con la web el Excel del negocio (id). Hay que llamarla desde un clic.
     * T0207: también el Excel de un módulo o, con carpeta, una carpeta (la de facturas o la de tickets).
     */
    conectar: function (id, carpeta) {
      return picker(function (P) {
        var v = carpeta ? new P.DocsView(P.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true) : new P.DocsView(P.ViewId.SPREADSHEETS);
        return v.setFileIds(id).setMode(P.DocsViewMode.LIST);
      }, carpeta ? 'Elige la carpeta' : 'Elige el Excel del negocio',
      carpeta ? 'Has cerrado la ventana sin elegir la carpeta.' : 'Has cerrado la ventana sin elegir el Excel.').then(function () {});
    },
    /** T0207: ventana de Google abierta en una carpeta para elegir una imagen o un PDF que ya está en Drive: { id, nombre }. */
    elegir: function (carpeta, titulo) {
      return picker(function (P) {
        return new P.DocsView().setParent(carpeta).setMimeTypes('image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf').setMode(P.DocsViewMode.LIST);
      }, titulo || 'Elige el archivo', 'Has cerrado la ventana sin elegir ningún archivo.').then(function (d) {
        return { id: d.id, nombre: d.name };
      });
    },
    /**
     * T0207: llamada de un módulo de sección (economia.js, gestion.js). Si falta conectar un Excel o una carpeta
     * («CONECTAR:id: …»), lo pide con un aviso dentro de la página, lo conecta y vuelve a llamar. Si se acaba la sesión,
     * borra la de este dispositivo (clave) y recarga para volver a entrar.
     */
    seccion: function (api, cuerpo, clave) {
      return UG.llamar(api, cuerpo).catch(function (e) {
        var m = /^CONECTAR:([^:]+):\s*(.*)$/.exec(e.message);
        if (m) return avisoConectar(m[1], m[2]).then(function () { return UG.seccion(api, cuerpo, clave); });
        if (e.acceso) { try { localStorage.removeItem(clave); } catch (x) {} location.reload(); }
        throw new Error(String(e.message || 'Error').replace(/^(SECCION|ACCESO):\s*/, ''));
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
        capa().appendChild(v); // T0208: dentro de una sección, en #sx-panel (lo demás está oculto)
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
  /**
   * T0208: la ventana de Google se coloca sola con medidas de la página, que dentro de una sección (todo lo demás oculto)
   * salen mal: queda descentrada y sin fondo. Su fondo pasa a cubrir la pantalla y, cuando ya está pintada, se mide y se
   * centra (la caja exterior no tiene ancho propio, así que no vale centrarla solo con CSS).
   */
  function estiloPicker() {
    if (document.getElementById('ug-picker')) return;
    var st = document.createElement('style');
    st.id = 'ug-picker';
    st.textContent = '.picker-dialog-bg{position:fixed!important;top:0!important;left:0!important;width:100%!important;height:100%!important;z-index:100001!important}' +
      'div.picker-dialog-bg{background:#000!important;opacity:.45!important}' +
      '.picker-dialog{position:fixed!important;z-index:100002!important}';
    document.head.appendChild(st);
  }
  function centrarPicker(n) {
    var d = document.querySelector('.picker-dialog'), c = d && d.querySelector('.picker-dialog-content');
    var r = c && c.getBoundingClientRect();
    if (!r || !r.width) { if ((n || 0) < 40) setTimeout(function () { centrarPicker((n || 0) + 1); }, 100); return; }
    var alto = d.getBoundingClientRect().height || r.height;
    d.style.setProperty('left', Math.max(8, Math.round((window.innerWidth - r.width) / 2)) + 'px', 'important');
    d.style.setProperty('top', Math.max(8, Math.round((window.innerHeight - alto) / 2)) + 'px', 'important');
  }

  /** T0208: dónde se pintan los avisos: en una sección, kanban4 oculta todo lo que cuelga de la página salvo #sx-panel. */
  function capa() { return document.getElementById('sx-panel') || document.body; }

  /** Carga la ventana de Google para elegir archivos y la abre con la vista que da hacerVista(P): el archivo elegido. */
  function picker(hacerVista, titulo, cancelado) {
    estiloPicker();
    var t = UG.llave();
    if (!t) return Promise.reject(new Error('Tu sesión de Google ha caducado. Vuelve a entrar.'));
    return new Promise(function (ok, ko) {
      var listo = function () {
        window.gapi.load('picker', function () {
          var P = window.google.picker;
          // T0208: dentro de una sección, kanban4 oculta lo que cuelga de la página (body.sx-otra) salvo la ventana de Google
          // (.picker-dialog, en base.css y app.js). Si Google la pinta con otra clase y no se ve, se quita la ocultación mientras está abierta.
          var b = document.body, otra = false;
          var vuelve = function () { if (otra) b.classList.add('sx-otra'); otra = false; };
          setTimeout(function () {
            var d = document.querySelector('.picker-dialog');
            if (b.classList.contains('sx-otra') && (!d || getComputedStyle(d).display === 'none')) { otra = true; b.classList.remove('sx-otra'); }
          }, 600);
          setTimeout(centrarPicker, 50);
          new P.PickerBuilder().addView(hacerVista(P)).setOAuthToken(t).setDeveloperKey(C.clavePicker).setAppId(C.proyecto)
            .setTitle(titulo).setCallback(function (d) {
              if (d.action === P.Action.PICKED) { vuelve(); ok((d.docs || [])[0] || {}); }
              else if (d.action === P.Action.CANCEL) { vuelve(); ko(new Error(cancelado)); }
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
  }

  /**
   * T0207: aviso dentro de la página para conectar un Excel o una carpeta (Google pide un clic). Se cumple al conectarlo.
   * T0208: un solo aviso por archivo aunque lo pidan varias llamadas a la vez (Gestión pide opciones y datos juntos), y
   * dentro de #sx-panel cuando lo hay: en una sección, kanban4 oculta todo lo demás que cuelga de la página.
   */
  var conectando = {};
  function avisoConectar(id, msg) {
    if (conectando[id]) return conectando[id];
    var p = conectando[id] = avisoConectarUno(id, msg);
    var fin = function () { delete conectando[id]; };
    p.then(fin, fin);
    return p;
  }
  function avisoConectarUno(id, msg) {
    return new Promise(function (ok, ko) {
      var v = document.createElement('div');
      v.setAttribute('role', 'alertdialog');
      v.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px';
      v.innerHTML = '<div style="background:#fff;color:#1C2B26;border-radius:14px;padding:20px;max-width:380px;width:100%;font:15px/1.45 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)">' +
        '<p style="margin:0 0 14px"></p><p data-e style="margin:0 0 12px;color:#B3261E" hidden></p>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" data-no style="border:1px solid #ccc;background:#fff;color:#1C2B26;border-radius:8px;padding:9px 14px;font:600 15px system-ui,sans-serif;cursor:pointer">Ahora no</button>' +
        '<button type="button" data-si style="border:0;background:#1C2B26;color:#fff;border-radius:8px;padding:9px 14px;font:600 15px system-ui,sans-serif;cursor:pointer">Conectar</button></div></div>';
      v.querySelector('p').textContent = String(msg || 'Para seguir, conecta este archivo con la web (solo hace falta una vez).').replace(/^\w/, function (c) { return c.toUpperCase(); });
      var si = v.querySelector('[data-si]');
      v.querySelector('[data-no]').onclick = function () { v.remove(); ko(new Error('Sin conectar no se puede seguir. Vuelve a probar cuando quieras.')); };
      si.onclick = function () {
        si.disabled = true;
        v.style.display = 'none'; // T0208: el aviso no tapa la ventana de Google; vuelve si se cierra sin elegir
        UG.conectar(id, /carpeta/i.test(msg)).then(function () { v.remove(); ok(); }, function (e) {
          v.style.display = 'flex'; si.disabled = false; var x = v.querySelector('[data-e]'); x.textContent = e.message; x.hidden = false;
        });
      };
      capa().appendChild(v);
      si.focus();
    });
  }

  window.UG = UG;
})();
