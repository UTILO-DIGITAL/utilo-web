/*
 * web/dev/listado/motor-falso.js · T0599 · Un motor de mentira, en memoria, para ver la app de ejemplo de la sección Listado
 * con el marco de verdad (nucleo/nucleo.js, con su menú a la izquierda) y la capa de tablas de verdad (kanban4/tablas.js),
 * sin Google, sin Apps Script y sin Supabase. Lo usan web/dev/listado/index.html y la vista previa.
 *
 * - Hace de window.UG (kanban4/google.js) en el modo con motor: entrar, la llave y las llamadas (tablasLeer, tablasActualizar,
 *   tablasCrear, tablasBorrar) contra las tablas de ejemplo-telas.js, que viven en esta página (al recargar, vuelven).
 * - Quién entra: #duena (Marta, Dueña, personaliza; por defecto), #ayudante (sin Proveedores ni Mis telas) o #admin (quien
 *   administra, que ve los errores de configuración). El selector de abajo a la derecha cambia el # y recarga.
 * - Las secciones salen de E.nucleo como las daría montar.js: cada una la sección Listado (base LISTADO) con su config.
 */
(function () {
  'use strict';
  var E = window.LISTADO_EJEMPLO, C = window.KANBAN;
  var GENTE = {
    duena: { persona: 'Marta Canela', correo: 'marta@ejemplo.com', perfil: 'Dueña', admin: false },
    ayudante: { persona: 'Ayudante', correo: 'ayudante@ejemplo.com', perfil: 'Ayudante', admin: false },
    admin: { persona: 'Javi Canela', correo: 'admin@ejemplo.com', perfil: '', admin: true }
  };
  var quien = GENTE[(location.hash || '').slice(1)] ? (location.hash || '').slice(1) : 'duena', yo = GENTE[quien];

  function secciones() {
    return Object.keys(E.nucleo.secciones).map(function (n) {
      var s = E.nucleo.secciones[n];
      return { id: n.toUpperCase(), base: 'LISTADO', modulo: 'listado', titulo: s.titulo, icono: s.icono || '', web: 'nucleo/secciones/listado.js', version: 'ejemplo',
        perfiles: s.perfiles || 'todos', config: s.config, api: [] };
    }).filter(function (s) { return yo.admin || s.perfiles === 'todos' || s.perfiles.indexOf(yo.perfil) >= 0; });
  }
  function cred() {
    return { persona: yo.persona, correo: yo.correo, perfil: yo.perfil, admin: yo.admin, negocio: 'Telas Marta Canela', dev: '', secciones: secciones(), version: '', versiones: [] };
  }
  // Se entra ya: la sesión de esta persona, guardada como la guarda el marco (si el navegador deja guardar).
  try { localStorage.setItem('nucleo_' + C.clave, JSON.stringify(cred())); } catch (e) {}

  /* ---------- las tablas, en memoria ---------- */
  var D = JSON.parse(JSON.stringify(E.tablas)), v = 1;
  function aMotor(t) { var d = D[t]; return { cols: d.columnas, filas: d.filas.map(function (f) { return d.columnas.map(function (c) { return f[c] === undefined ? '' : f[c]; }); }), v: String(v) }; }
  function buscar(t, id) { var d = D[t]; return d.filas.filter(function (f) { return String(f[d.clave]) === String(id); })[0] || null; }
  var FN = {
    tablasLeer: function (ns) { var r = { tablas: {} }; [].concat(ns).forEach(function (n) { if (D[n]) r.tablas[n] = aMotor(n); }); return r; },
    tablasActualizar: function (t, id, c) { var f = buscar(t, id); if (!f) throw new Error('Esa fila ya no está.'); Object.keys(c).forEach(function (k) { f[k] = c[k]; }); v++; return { fila: f, v: String(v) }; },
    tablasCrear: function (t, x) {
      var d = D[t], f = {};
      d.columnas.forEach(function (c) { f[c] = x[c] === undefined ? '' : x[c]; });
      if (f[d.clave] === '' || f[d.clave] === undefined) {
        // Como haría la base: el siguiente código (T0020 después de T0019).
        var nums = d.filas.map(function (y) { var m = /(\d+)$/.exec(String(y[d.clave])); return m ? +m[1] : 0; }), n = Math.max.apply(null, [0].concat(nums)) + 1;
        var muestra = String((d.filas[0] || {})[d.clave] || ''), pre = (/^(\D*)/.exec(muestra) || ['', ''])[1], ancho = muestra.length - pre.length;
        f[d.clave] = pre + (ancho > 0 ? ('0000000' + n).slice(-ancho) : n);
      }
      d.filas.push(f); v++;
      return { id: f[d.clave], fila: f, v: String(v) };
    },
    tablasBorrar: function (t, id) { var d = D[t]; d.filas = d.filas.filter(function (f) { return String(f[d.clave]) !== String(id); }); v++; return { v: String(v) }; }
  };
  function responder(fn, args) {
    return new Promise(function (ok, ko) {
      setTimeout(function () {
        try {
          if (fn === 'entrar') return ok(cred());
          if (!FN[fn]) throw new Error('El motor de ejemplo no tiene ' + fn + '.');
          ok(FN[fn].apply(null, args || []));
        } catch (e) { ko(e); }
      }, 120);
    });
  }

  window.UG = {
    llave: function () { return 'llave-de-ejemplo'; },
    correo: function () { return yo.correo; },
    recordarCorreo: function () {},
    salir: function () {},
    sinComo: true,
    inicio: function () { return Promise.resolve({ nucleo: { secciones: [] }, titulo: C.nombreApp, negocio: 'Telas Marta Canela' }); },
    entrar: function () { return Promise.resolve(); },
    llamar: function (api, b) { return responder(b.fn, b.args); },
    seccion: function (api, b) { return responder(b.fn, b.args); }
  };

  /* ---------- quién entra (fuera del marco, que rehace el body) ---------- */
  function selector() {
    if (document.getElementById('mf-quien')) return;
    var d = document.createElement('div');
    d.id = 'mf-quien';
    d.innerHTML = '<label for="mf-sel">Ver como</label><select id="mf-sel">' + Object.keys(GENTE).map(function (k) {
      var g = GENTE[k];
      return '<option value="' + k + '"' + (k === quien ? ' selected' : '') + '>' + g.persona + (g.admin ? ' (administra)' : ' (' + g.perfil + ')') + '</option>';
    }).join('') + '</select>';
    document.documentElement.appendChild(d);
    d.querySelector('select').addEventListener('change', function () {
      var k = this.value;
      try { localStorage.removeItem('nucleo_' + C.clave); } catch (e) {}
      location.hash = k; location.reload();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', selector); else selector();
})();
