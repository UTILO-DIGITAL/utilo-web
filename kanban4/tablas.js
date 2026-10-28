/*
 * Tablas al momento · UTILO_CORE (T0252) · la parte del navegador de la capa de tablas (motor/core/TABLAS_API.js de utilo-apps)
 *
 * Para las secciones nuevas: leen y escriben las tablas de los Excel por su nombre y el de sus columnas, y la pantalla
 * no espera nunca a Google.
 * - Lectura: lo último que se vio se guarda en este dispositivo (IndexedDB) y se pinta al momento; por detrás se pide al
 *   motor (tablasLeer) y, si ha cambiado algo, se avisa con «cambio» para volver a pintar. El motor solo manda la tabla
 *   si su versión es otra (desde). Al volver a la pestaña se refresca solo.
 * - Escritura optimista: actualizar, crear y borrar cambian la copia y avisan con «cambio» en el acto; el cambio va al
 *   motor por detrás, en orden para cada fila. Si el motor dice que no (validación, permiso, otra persona lo ha cambiado,
 *   sin conexión), se deshace en la pantalla, se avisa con «error» y se llama a aviso(texto).
 *
 * Uso (una sección):
 *   var T = UT.crear({ llamar: function (fn, args) { return UG.seccion(api, { fn: fn, args: args }, clave); },
 *                      clave: 'konamigas', aviso: function (t) { … } });
 *   T.en('cambio', function (tabla, info) { pintar(); });
 *   T.leer(['CAMISETAS', 'MODELOS']).then(function () { pintar(); });   // al momento si ya se había abierto
 *   T.filas('CAMISETAS')                                                 // [{ ID, ESTADO, … }] (la copia)
 *   T.actualizar('CAMISETAS', 'CMS000123', { ESTADO: 'Entregada', FECHA_ENTREGA: '2026-10-28' });
 * Cada fila es un objeto { COLUMNA: valor }; mientras tiene un cambio sin confirmar lleva _pendiente (cuántos) y una
 * fila nueva lleva _nueva hasta que el motor le da su ID.
 * Valores: texto; números; true/false; fecha 'aaaa-mm-dd'; fecha y hora 'aaaa-mm-ddThh:mm'; hora 'hh:mm'; vacío ''.
 */
(function () {
  'use strict';

  /* ---------- IndexedDB (si no se puede, solo memoria) ---------- */

  var BD = null;
  function bd() {
    if (BD) return BD;
    BD = new Promise(function (ok) {
      try {
        var r = indexedDB.open('utilo_tablas', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('tablas'); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = r.onblocked = function () { ok(null); };
      } catch (e) { ok(null); }
    });
    return BD;
  }
  function bdLeer(k) {
    return bd().then(function (db) {
      if (!db) return null;
      return new Promise(function (ok) {
        try { var q = db.transaction('tablas').objectStore('tablas').get(k); q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { ok(null); }; }
        catch (e) { ok(null); }
      });
    });
  }
  function bdGuardar(k, v) {
    return bd().then(function (db) {
      if (!db) return;
      try { db.transaction('tablas', 'readwrite').objectStore('tablas').put(v, k); } catch (e) {}
    });
  }

  function copia(o) { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function igual(a, b) { return String(a == null ? '' : a) === String(b == null ? '' : b); }
  function limpio(m) { return String(m || 'Error').replace(/^(VALIDAR|CAMBIADO|SECCION|ACCESO):\s*/, ''); }

  function crear(o) {
    o = o || {};
    var clave = 'ut:' + (o.clave || 'negocio') + ':';
    var mem = {};       // tabla → { cols, filas: [objetos], ids: { ID: objeto }, v, leido, clave }
    var colas = {};     // 'tabla|id' → promesa de lo último enviado de esa fila (los cambios de una fila van en orden)
    var enVuelo = {};   // 'tabla|id' → [cambios aún sin confirmar], para no perderlos si llega un refresco
    var oyentes = { cambio: [], error: [] };
    var nuevos = 0, pendientes = 0;

    function emitir(ev, a, b) { (oyentes[ev] || []).forEach(function (f) { try { f(a, b); } catch (e) { if (window.console) console.error(e); } }); }
    function llamar(fn, args) { return Promise.resolve().then(function () { return o.llamar(fn, args); }); }
    function avisar(t) { if (o.aviso) try { o.aviso(t); } catch (e) {} }

    /** Lo que manda el motor (cols + filas en listas) → objetos, con los cambios aún en vuelo puestos encima. */
    function deMotor(nombre, t) {
      var ki = t.cols.indexOf('ID'), m = { cols: t.cols, filas: [], ids: {}, v: t.v, leido: t.leido, clave: t.cols[ki >= 0 ? ki : 0] };
      t.filas.forEach(function (r) {
        var f = {};
        t.cols.forEach(function (c, j) { f[c] = r[j]; });
        var id = String(f[m.clave]);
        (enVuelo[nombre + '|' + id] || []).forEach(function (x) { for (var k in x) f[k] = x[k]; f._pendiente = (f._pendiente || 0) + 1; });
        m.filas.push(f); m.ids[id] = f;
      });
      // Las altas que aún no ha confirmado el motor siguen en la lista.
      var ant = mem[nombre];
      if (ant) ant.filas.forEach(function (f) { if (f._nueva) m.filas.push(f); });
      return m;
    }
    /** Copia del dispositivo, en listas (ocupa menos), sin lo que está en vuelo. */
    function guardarLocal(nombre) {
      var m = mem[nombre];
      if (!m) return;
      var filas = m.filas.filter(function (f) { return !f._nueva; }).map(function (f) { return m.cols.map(function (c) { return f[c]; }); });
      bdGuardar(clave + nombre, { cols: m.cols, filas: filas, v: m.v, leido: m.leido });
    }

    /** Pide al motor las tablas (solo las que han cambiado vienen enteras) y avisa de las que han cambiado. */
    function refrescar(nombres, fresco) {
      var desde = {};
      nombres.forEach(function (n) { if (mem[n] && mem[n].v) desde[n] = mem[n].v; });
      return llamar('tablasLeer', [nombres, { desde: desde, fresco: !!fresco }]).then(function (r) {
        var cambiadas = [];
        nombres.forEach(function (n) {
          var t = (r.tablas || {})[n];
          if (!t || t.igual) return;
          mem[n] = deMotor(n, t);
          guardarLocal(n);
          cambiadas.push(n);
        });
        cambiadas.forEach(function (n) { emitir('cambio', n, { refresco: true }); });
        return cambiadas;
      });
    }

    var api = {
      /** Avisos: 'cambio' (tabla, info) cada vez que cambia la copia; 'error' (error, info) si el motor dice que no. */
      en: function (ev, f) { (oyentes[ev] = oyentes[ev] || []).push(f); return api; },

      /**
       * Las tablas para pintar: al momento si están en memoria o en el dispositivo (y se refrescan por detrás), o
       * esperando al motor la primera vez. op: { fresco } para ir al Excel aunque el motor lo tenga guardado; { local }
       * para no refrescar por detrás (quien llama lo hará con refrescar).
       * Devuelve { TABLA: [filas] }.
       */
      leer: function (nombres, op) {
        op = op || {};
        nombres = [].concat(nombres);
        return Promise.all(nombres.map(function (n) {
          if (mem[n]) return true;
          return bdLeer(clave + n).then(function (g) {
            if (g && !mem[n]) mem[n] = deMotor(n, g);
            return !!mem[n];
          });
        })).then(function (hay) {
          var faltan = nombres.filter(function (n, i) { return !hay[i]; });
          var fuera = function () { var r = {}; nombres.forEach(function (n) { r[n] = mem[n] ? mem[n].filas : []; }); return r; };
          if (!faltan.length && !op.fresco) {
            if (!op.local) refrescar(nombres).catch(function (e) { emitir('error', e, { leer: nombres }); });
            return fuera();
          }
          return refrescar(nombres, op.fresco).then(fuera);
        });
      },
      /** Vuelve a pedir al motor (p. ej. con el botón ↻). fresco: además, que lo lea del Excel. */
      refrescar: function (nombres, fresco) { return refrescar([].concat(nombres), fresco); },
      /** Filas de la copia (las que ya se han leído). */
      filas: function (n) { return mem[n] ? mem[n].filas : []; },
      fila: function (n, id) { return mem[n] ? mem[n].ids[String(id)] || null : null; },
      /** Cambios sin confirmar todavía (para avisar antes de cerrar la página). */
      pendientes: function () { return pendientes; },

      /** Cambia columnas de una fila: la pantalla, al momento; el Excel, por detrás. Devuelve la promesa del motor. */
      actualizar: function (n, id, cambios) {
        id = String(id);
        var f = api.fila(n, id);
        if (!f) return Promise.reject(new Error('No tengo ' + id + ' en ' + n + ': actualiza la página.'));
        var antes = {}, cuenta = 0;
        for (var k in cambios) { if (!igual(f[k], cambios[k])) cuenta++; antes[k] = f[k]; }
        if (!cuenta) return Promise.resolve({ fila: f, cambios: 0 });
        for (k in cambios) f[k] = cambios[k];
        f._pendiente = (f._pendiente || 0) + 1;
        var kq = n + '|' + id;
        (enVuelo[kq] = enVuelo[kq] || []).push(cambios);
        pendientes++;
        emitir('cambio', n, { id: id, optimista: true });
        var fin = function () {
          pendientes--;
          var l = enVuelo[kq] || [], i = l.indexOf(cambios);
          if (i >= 0) l.splice(i, 1);
          if (!l.length) delete enVuelo[kq];
          var g = api.fila(n, id) || f;
          g._pendiente = Math.max((g._pendiente || 1) - 1, 0);
          if (!g._pendiente) delete g._pendiente;
          return g;
        };
        var p = (colas[kq] || Promise.resolve()).catch(function () {}).then(function () {
          return llamar('tablasActualizar', [n, id, cambios, { antes: antes }]);
        }).then(function (r) {
          var g = fin();
          // Lo que ha quedado en el Excel (puede traer columnas que ha cambiado otra persona), salvo lo que sigue en vuelo.
          for (var c in r.fila) if (!(enVuelo[kq] || []).some(function (x) { return c in x; })) g[c] = r.fila[c];
          guardarLocal(n);
          emitir('cambio', n, { id: id, confirmado: true });
          return r;
        }, function (e) {
          var g = fin();
          // Se deshace lo que puso este cambio, si nadie lo ha vuelto a cambiar en la pantalla mientras.
          for (var c in cambios) if (igual(g[c], cambios[c])) g[c] = antes[c];
          emitir('cambio', n, { id: id, deshecho: true });
          emitir('error', e, { tabla: n, id: id, cambios: cambios });
          avisar('No se ha guardado: ' + limpio(e.message));
          if (/^CAMBIADO:/.test(e.message)) refrescar([n], true).catch(function () {});
          throw e;
        });
        colas[kq] = p;
        p.catch(function () {});
        return p;
      },

      /** Alta: la fila sale al momento (con _nueva y un ID provisional) y toma su ID cuando lo da el motor. */
      crear: function (n, valores) {
        var m = mem[n] || (mem[n] = { cols: Object.keys(valores), filas: [], ids: {}, v: '', clave: 'ID' });
        var tmp = 'nueva-' + (++nuevos), f = copia(valores);
        f[m.clave] = tmp; f._nueva = true; f._pendiente = 1;
        m.filas.push(f); m.ids[tmp] = f;
        pendientes++;
        emitir('cambio', n, { id: tmp, optimista: true });
        return llamar('tablasCrear', [n, valores]).then(function (r) {
          pendientes--;
          delete m.ids[tmp];
          delete f._nueva; delete f._pendiente;
          for (var c in r.fila) f[c] = r.fila[c];
          var mm = mem[n];
          if (mm !== m) { if (!mm.ids[r.id]) { mm.filas.push(f); mm.ids[r.id] = f; } else { mm.filas.splice(mm.filas.indexOf(f), 1); } }
          else m.ids[r.id] = f;
          guardarLocal(n);
          emitir('cambio', n, { id: r.id, antes: tmp, confirmado: true });
          return r;
        }, function (e) {
          pendientes--;
          var mm = mem[n] || m, i = mm.filas.indexOf(f);
          if (i >= 0) mm.filas.splice(i, 1);
          delete mm.ids[tmp];
          emitir('cambio', n, { id: tmp, deshecho: true });
          emitir('error', e, { tabla: n, valores: valores });
          avisar('No se ha creado: ' + limpio(e.message));
          throw e;
        });
      },

      /**
       * Borrar: la fila se quita de la pantalla al momento. El motor la marca «Eliminada» si su tabla tiene ese estado
       * (entonces vuelve, con ESTADO Eliminada) o la borra del Excel. Si dice que no, vuelve a su sitio.
       */
      borrar: function (n, id) {
        id = String(id);
        var m = mem[n], f = api.fila(n, id);
        if (!f) return Promise.reject(new Error('No tengo ' + id + ' en ' + n + ': actualiza la página.'));
        var i = m.filas.indexOf(f);
        m.filas.splice(i, 1); delete m.ids[id];
        pendientes++;
        emitir('cambio', n, { id: id, optimista: true, borrada: true });
        var kq = n + '|' + id;
        var p = (colas[kq] || Promise.resolve()).catch(function () {}).then(function () { return llamar('tablasBorrar', [n, id]); }).then(function (r) {
          pendientes--;
          if (r.eliminada && r.fila) { var mm = mem[n]; for (var c in r.fila) f[c] = r.fila[c]; if (!mm.ids[id]) { mm.filas.splice(Math.min(i, mm.filas.length), 0, f); mm.ids[id] = f; } }
          guardarLocal(n);
          emitir('cambio', n, { id: id, confirmado: true });
          return r;
        }, function (e) {
          pendientes--;
          var mm = mem[n];
          if (!mm.ids[id]) { mm.filas.splice(Math.min(i, mm.filas.length), 0, f); mm.ids[id] = f; }
          emitir('cambio', n, { id: id, deshecho: true });
          emitir('error', e, { tabla: n, id: id });
          avisar('No se ha borrado: ' + limpio(e.message));
          throw e;
        });
        colas[kq] = p;
        p.catch(function () {});
        return p;
      }
    };

    // Al volver a la pestaña, se refresca lo que se ha leído; al cerrarla con cambios en vuelo, se avisa.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      var ns = Object.keys(mem);
      if (ns.length) refrescar(ns).catch(function () {});
    });
    window.addEventListener('beforeunload', function (e) { if (pendientes) { e.preventDefault(); e.returnValue = ''; } });
    return api;
  }

  window.UT = { crear: crear };
})();
