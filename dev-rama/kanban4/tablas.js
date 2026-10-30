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
 * T0254: actualizar y crear aceptan op = { fn, args }: la pantalla cambia igual al momento, pero el cambio va a una
 * función de la sección (su «api») en lugar de tablasActualizar o tablasCrear, para lo que toca más de una cosa (un
 * cambio de estado con su HISTORIAL y su registro). Esa función devuelve lo mismo ({ fila } o { id, fila }) y, si ha
 * cambiado otras filas de paso, otras: { TABLA: [filas] }, que se ponen al día en la copia sin volver a leer.
 * T0256 · Partes de una tabla grande: leer(['INSCRIPCIONES_JUGADORAS'], { partes: { INSCRIPCIONES_JUGADORAS: { clave: 'T:TEM-2026',
 * col: 'ID_INSCRIPCION_EQUIPO', valores: ['IE00001', …] } } }) trae solo las filas cuya col es uno de esos valores. Las
 * partes que se van leyendo se juntan en la misma copia (filas, fila, actualizar… funcionan igual) y cada una se refresca
 * por su cuenta. Así no se baja entera una tabla de miles de filas para ver una temporada o una jugadora.
 * Valores: texto; números; true/false; fecha 'aaaa-mm-dd'; fecha y hora 'aaaa-mm-ddThh:mm'; hora 'hh:mm'; vacío ''.
 * T0275 · La copia del dispositivo es de cada persona: UT.crear({ …, persona: correo }) guarda y lee con la clave
 * 'ut:<negocio>:<correo>:<tabla>', así quien entra en un dispositivo compartido empieza con su copia o vacía, nunca con
 * la de otra persona. Con persona vacía, solo memoria. Al crearla se borra la copia del negocio de antes de T0275 (sin
 * persona). T.cerrar() la deja de usar (otra persona entra en la misma página: lo que aún llegue no se guarda ni se pinta)
 * y UT.olvidar(negocio, correo) borra del dispositivo la copia de esa persona (al cerrar sesión). Sin persona, como antes.
 * T0273: persona puede ser '<correo>><correo>' (quien administra viendo como otra persona); olvidar a quien administra
 * borra también esas.
 */
(function () {
  'use strict';

  /* ---------- IndexedDB (si no se puede, solo memoria) ---------- */

  var BD = null;
  var PARTES = 6; // T0256: partes de una tabla que se refrescan solas (las últimas leídas)
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
  /** T0275 · Borra del dispositivo las copias cuya clave cumple si(clave). */
  function bdBorrarSi(si) {
    return bd().then(function (db) {
      if (!db) return;
      return new Promise(function (ok) {
        try {
          var tx = db.transaction('tablas', 'readwrite'), q = tx.objectStore('tablas').openCursor();
          q.onsuccess = function () { var c = q.result; if (!c) return; if (si(String(c.key))) c.delete(); c.continue(); };
          tx.oncomplete = tx.onerror = tx.onabort = function () { ok(); };
        } catch (e) { ok(); }
      });
    });
  }
  /** T0275 · El correo, tal cual va en la clave de la copia. */
  function deCorreo(c) { return String(c == null ? '' : c).trim().toLowerCase(); }
  /** T0275 · Borra del dispositivo la copia de una persona en un negocio (al cerrar sesión); T0273: y las de «como» suyas. */
  function olvidar(negocio, correo) {
    var p = 'ut:' + (negocio || 'negocio') + ':' + deCorreo(correo);
    if (!deCorreo(correo)) return Promise.resolve();
    return bdBorrarSi(function (k) { return k.indexOf(p + ':') === 0 || k.indexOf(p + '>') === 0; });
  }

  function copia(o) { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function igual(a, b) { return String(a == null ? '' : a) === String(b == null ? '' : b); }
  function limpio(m) { return String(m || 'Error').replace(/^(VALIDAR|CAMBIADO|SECCION|ACCESO):\s*/, ''); }

  function crear(o) {
    o = o || {};
    var negocio = 'ut:' + (o.clave || 'negocio') + ':';
    // T0275: con persona, la copia es suya ('ut:<negocio>:<correo>:'); con persona vacía, solo memoria; sin ella, la del negocio.
    var porPersona = Object.prototype.hasOwnProperty.call(o, 'persona'), persona = deCorreo(o.persona);
    var clave = porPersona ? (persona ? negocio + persona + ':' : '') : negocio;
    var cerrada = false;
    // La copia del negocio de antes de T0275 ('ut:<negocio>:<tabla>', sin persona) era de quien entró la última vez: fuera.
    if (porPersona) bdBorrarSi(function (k) { return k.indexOf(negocio) === 0 && k.slice(negocio.length).indexOf(':') < 0; });
    function guardaLocal() { return !!clave && !cerrada; }
    var mem = {};       // tabla → { cols, filas: [objetos], ids: { ID: objeto }, v, leido, clave }
    var colas = {};     // 'tabla|id' → promesa de lo último enviado de esa fila (los cambios de una fila van en orden)
    var enVuelo = {};   // 'tabla|id' → [cambios aún sin confirmar], para no perderlos si llega un refresco
    var oyentes = { cambio: [], error: [] };
    var nuevos = 0, pendientes = 0;

    function emitir(ev, a, b) { if (cerrada) return; (oyentes[ev] || []).forEach(function (f) { try { f(a, b); } catch (e) { if (window.console) console.error(e); } }); }
    function llamar(fn, args) { return Promise.resolve().then(function () { return o.llamar(fn, args); }); }
    function avisar(t) { if (o.aviso) try { o.aviso(t); } catch (e) {} }

    function claveDe(cols) { var ki = cols.indexOf('ID'); return cols[ki >= 0 ? ki : 0]; }
    /** Filas del motor (listas) → objetos, con los cambios aún en vuelo puestos encima. */
    function filasDe(nombre, t, k) {
      return t.filas.map(function (r) {
        var f = {};
        t.cols.forEach(function (c, j) { f[c] = r[j]; });
        (enVuelo[nombre + '|' + String(f[k])] || []).forEach(function (x) { for (var c in x) f[c] = x[c]; f._pendiente = (f._pendiente || 0) + 1; });
        return f;
      });
    }
    /**
     * Lo que manda el motor (cols + filas en listas) → la copia de la tabla entera. T0256: lo guardado en el dispositivo
     * puede ser solo partes (entera: false, con sus partes), y se recupera así.
     */
    function deMotor(nombre, t) {
      var m = { cols: t.cols, filas: [], ids: {}, v: t.v, leido: t.leido, clave: claveDe(t.cols), entera: t.entera !== false, partes: t.partes || {} };
      filasDe(nombre, t, m.clave).forEach(function (f) { m.filas.push(f); m.ids[String(f[m.clave])] = f; });
      // Las altas que aún no ha confirmado el motor siguen en la lista.
      var ant = mem[nombre];
      if (ant) ant.filas.forEach(function (f) { if (f._nueva) { m.filas.push(f); m.ids[String(f[m.clave])] = f; } });
      return m;
    }
    /**
     * T0256 · Una parte que manda el motor (p = { clave, col, valores }) → a la copia: se quitan las filas que eran de esa
     * parte (su col es uno de los valores) y se ponen las que llegan. Lo de otras partes y las altas sin confirmar se quedan.
     */
    function deParte(nombre, t, p) {
      var m = mem[nombre];
      if (!m) m = mem[nombre] = { cols: t.cols, filas: [], ids: {}, v: '', leido: t.leido, clave: claveDe(t.cols), entera: false, partes: {} };
      var de = {}, nuevas = filasDe(nombre, t, m.clave), llegan = {};
      [].concat(p.valores || []).forEach(function (x) { de[String(x)] = 1; });
      nuevas.forEach(function (f) { llegan[String(f[m.clave])] = 1; });
      m.filas = m.filas.filter(function (f) { return f._nueva || (!de[String(f[p.col] == null ? '' : f[p.col])] && !llegan[String(f[m.clave])]); }).concat(nuevas);
      m.ids = {};
      m.filas.forEach(function (f) { m.ids[String(f[m.clave])] = f; });
      m.cols = t.cols;
      if (!m.entera) {
        delete m.partes[p.clave];
        m.partes[p.clave] = { col: p.col, valores: [].concat(p.valores || []), v: t.v };
        // Se recuerdan las últimas PARTES: las filas de las más viejas se quedan, pero ya no se refrescan solas (se vuelven
        // a pedir al leerlas otra vez). Así abrir muchas fichas no multiplica las llamadas de cada refresco.
        var ks = Object.keys(m.partes);
        while (ks.length > PARTES) delete m.partes[ks.shift()];
      }
      return m;
    }
    /** Copia del dispositivo, en listas (ocupa menos), sin lo que está en vuelo. */
    function guardarLocal(nombre) {
      var m = mem[nombre];
      if (!m || !guardaLocal()) return;
      var filas = m.filas.filter(function (f) { return !f._nueva; }).map(function (f) { return m.cols.map(function (c) { return f[c]; }); });
      bdGuardar(clave + nombre, { cols: m.cols, filas: filas, v: m.v, leido: m.leido, entera: m.entera !== false, partes: m.partes || {} });
    }
    /** ¿Tiene ya la copia esa tabla (entera, o la parte que se pide)? */
    function tiene(n, p) { var m = mem[n]; return !!m && (m.entera !== false || (!!p && !!(m.partes || {})[p.clave])); }

    /** T0254: filas que el motor ha cambiado de paso (r.otras = { TABLA: [filas] }) → a la copia, salvo lo que sigue en vuelo. */
    function otras(r) {
      var o = (r && r.otras) || {};
      Object.keys(o).forEach(function (n) {
        var m = mem[n];
        if (!m || !Array.isArray(o[n])) return;
        o[n].forEach(function (x) {
          var id = String(x[m.clave]), f = m.ids[id], kq = n + '|' + id;
          if (!f) { f = {}; m.filas.push(f); m.ids[id] = f; }
          for (var c in x) if (!(enVuelo[kq] || []).some(function (y) { return c in y; })) f[c] = x[c];
        });
        guardarLocal(n);
        emitir('cambio', n, { otras: true });
      });
    }

    /**
     * Pide al motor las tablas (solo las que han cambiado vienen enteras) y avisa de las que han cambiado.
     * T0256 · partes: { TABLA: { clave, col, valores } } para traer solo esa parte de esas tablas.
     */
    function refrescar(nombres, fresco, partes) {
      partes = partes || {};
      var desde = {}, pm = {};
      nombres.forEach(function (n) {
        var m = mem[n], p = partes[n];
        if (p) { pm[n] = { col: p.col, valores: p.valores }; if (m && m.entera === false && m.partes[p.clave] && m.partes[p.clave].v) desde[n] = m.partes[p.clave].v; }
        else if (m && m.entera !== false && m.v) desde[n] = m.v;
      });
      return llamar('tablasLeer', [nombres, { desde: desde, fresco: !!fresco, partes: pm }]).then(function (r) {
        var cambiadas = [];
        if (cerrada) return cambiadas;  // T0275: llega tarde, para una copia que ya no se usa
        nombres.forEach(function (n) {
          var t = (r.tablas || {})[n];
          if (!t || t.igual) return;
          if (partes[n] && t.parte) mem[n] = deParte(n, t, partes[n]);
          else mem[n] = deMotor(n, t);
          guardarLocal(n);
          cambiadas.push(n);
        });
        cambiadas.forEach(function (n) { emitir('cambio', n, { refresco: true }); });
        return cambiadas;
      });
    }
    /** Refresca lo que hay en la copia: las tablas enteras de una vez y, de las que solo tienen partes, cada parte. */
    function refrescarTodo(nombres, fresco) {
      var enteras = [], ps = [];
      nombres.forEach(function (n) {
        var m = mem[n];
        if (!m || m.entera !== false) { enteras.push(n); return; }
        Object.keys(m.partes || {}).forEach(function (k) { var o = {}; o[n] = { clave: k, col: m.partes[k].col, valores: m.partes[k].valores }; ps.push(refrescar([n], fresco, o)); });
      });
      if (enteras.length) ps.unshift(refrescar(enteras, fresco));
      return Promise.all(ps).then(function (rs) { return [].concat.apply([], rs); });
    }

    var api = {
      /** Avisos: 'cambio' (tabla, info) cada vez que cambia la copia; 'error' (error, info) si el motor dice que no. */
      en: function (ev, f) { (oyentes[ev] = oyentes[ev] || []).push(f); return api; },

      /**
       * Las tablas para pintar: al momento si están en memoria o en el dispositivo (y se refrescan por detrás), o
       * esperando al motor la primera vez. op: { fresco } para ir al Excel aunque el motor lo tenga guardado; { local }
       * para no refrescar por detrás (quien llama lo hará con refrescar). T0256 · op.partes: { TABLA: { clave, col,
       * valores } } para leer solo esa parte de una tabla grande (clave: un nombre para esa parte, p. ej. 'T:TEM-2026').
       * Devuelve { TABLA: [filas] } (de una tabla con partes, todas las que ya hay en la copia).
       */
      leer: function (nombres, op) {
        op = op || {};
        nombres = [].concat(nombres);
        var partes = op.partes || {};
        return Promise.all(nombres.map(function (n) {
          if (tiene(n, partes[n])) return true;
          if (mem[n] || !guardaLocal()) return false;
          return bdLeer(clave + n).then(function (g) {
            if (g && !mem[n]) mem[n] = deMotor(n, g);
            return tiene(n, partes[n]);
          });
        })).then(function (hay) {
          var faltan = nombres.filter(function (n, i) { return !hay[i]; });
          var fuera = function () { var r = {}; nombres.forEach(function (n) { r[n] = mem[n] ? mem[n].filas : []; }); return r; };
          var pedir = function (ns) {
            var sin = ns.filter(function (n) { return !partes[n]; });
            var ps = sin.length ? [refrescar(sin, op.fresco)] : [];
            ns.forEach(function (n) { if (partes[n]) { var o = {}; o[n] = partes[n]; ps.push(refrescar([n], op.fresco, o)); } });
            return Promise.all(ps);
          };
          if (!faltan.length && !op.fresco) {
            if (!op.local) pedir(nombres).catch(function (e) { emitir('error', e, { leer: nombres }); });
            return fuera();
          }
          return pedir(op.fresco ? nombres : faltan).then(function () {
            // Lo que ya estaba se refresca por detrás, como siempre.
            var resto = nombres.filter(function (n) { return faltan.indexOf(n) < 0; });
            if (!op.fresco && resto.length && !op.local) pedir(resto).catch(function (e) { emitir('error', e, { leer: resto }); });
          }).then(fuera);
        });
      },
      /** Vuelve a pedir al motor (p. ej. con el botón ↻). fresco: además, que lo lea del Excel. T0256: de una tabla con partes, cada parte. */
      refrescar: function (nombres, fresco) { return refrescarTodo([].concat(nombres), fresco); },
      /** T0256 · ¿Tiene ya la copia esa tabla, o esa parte ({ clave })? Para pintar al momento sin esperar. */
      tiene: function (n, p) { return tiene(n, p); },
      /** Filas de la copia (las que ya se han leído). */
      filas: function (n) { return mem[n] ? mem[n].filas : []; },
      fila: function (n, id) { return mem[n] ? mem[n].ids[String(id)] || null : null; },
      /** T0257: columnas de una tabla ya leída, en su orden (también si todavía no tiene filas). */
      columnas: function (n) { return mem[n] ? mem[n].cols.slice() : []; },
      /** Cambios sin confirmar todavía (para avisar antes de cerrar la página). */
      pendientes: function () { return pendientes; },
      /** T0275 · De quién es la copia (su correo; '' si es solo memoria o la del negocio). */
      persona: function () { return persona; },
      /**
       * T0275 · Deja de usar esta copia (entra otra persona en la misma página): lo que aún llegue del motor ya no se guarda
       * en el dispositivo ni avisa, y no se refresca al volver a la pestaña.
       */
      cerrar: function () { cerrada = true; mem = {}; document.removeEventListener('visibilitychange', alVolver); },

      /**
       * Cambia columnas de una fila: la pantalla, al momento; el Excel, por detrás. Devuelve la promesa del motor.
       * op (T0254): { fn, args } para que el cambio lo haga una función de la sección en lugar de tablasActualizar.
       */
      actualizar: function (n, id, cambios, op) {
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
          return op && op.fn ? llamar(op.fn, op.args || []) : llamar('tablasActualizar', [n, id, cambios, { antes: antes }]);
        }).then(function (r) {
          var g = fin();
          // Lo que ha quedado en el Excel (puede traer columnas que ha cambiado otra persona), salvo lo que sigue en vuelo.
          for (var c in r.fila) if (!(enVuelo[kq] || []).some(function (x) { return c in x; })) g[c] = r.fila[c];
          guardarLocal(n);
          emitir('cambio', n, { id: id, confirmado: true });
          otras(r);
          return r;
        }, function (e) {
          var g = fin();
          // Se deshace lo que puso este cambio, si nadie lo ha vuelto a cambiar en la pantalla mientras.
          for (var c in cambios) if (igual(g[c], cambios[c])) g[c] = antes[c];
          emitir('cambio', n, { id: id, deshecho: true });
          emitir('error', e, { tabla: n, id: id, cambios: cambios });
          avisar('No se ha guardado: ' + limpio(e.message));
          if (/^CAMBIADO:/.test(e.message)) refrescarTodo([n], true).catch(function () {});
          throw e;
        });
        colas[kq] = p;
        p.catch(function () {});
        return p;
      },

      /**
       * Alta: la fila sale al momento (con _nueva y un ID provisional) y toma su ID cuando lo da el motor.
       * op.fn (opcional): una función de la sección que hace el alta en el motor y devuelve lo mismo que tablasCrear
       * ({ id, fila, v }), con otras si ha cambiado más filas. Recibe op.args (T0254) o, si no hay, [valores] (T0257:
       * economiaEmitir, que pone el número de la factura).
       */
      crear: function (n, valores, op) {
        op = op || {};
        var m = mem[n] || (mem[n] = { cols: Object.keys(valores), filas: [], ids: {}, v: '', clave: 'ID', entera: true, partes: {} });
        var tmp = 'nueva-' + (++nuevos), f = copia(valores);
        f[m.clave] = tmp; f._nueva = true; f._pendiente = 1;
        m.filas.push(f); m.ids[tmp] = f;
        pendientes++;
        emitir('cambio', n, { id: tmp, optimista: true });
        return (op.fn ? llamar(op.fn, op.args || [valores]) : llamar('tablasCrear', [n, valores])).then(function (r) {
          pendientes--;
          delete m.ids[tmp];
          delete f._nueva; delete f._pendiente;
          for (var c in r.fila) f[c] = r.fila[c];
          var mm = mem[n];
          if (mm !== m) { if (!mm.ids[r.id]) { mm.filas.push(f); mm.ids[r.id] = f; } else { mm.filas.splice(mm.filas.indexOf(f), 1); } }
          else m.ids[r.id] = f;
          guardarLocal(n);
          emitir('cambio', n, { id: r.id, antes: tmp, confirmado: true });
          otras(r);
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
    function alVolver() {
      if (document.visibilityState !== 'visible' || cerrada) return;
      var ns = Object.keys(mem);
      if (ns.length) refrescarTodo(ns).catch(function () {});
    }
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('beforeunload', function (e) { if (pendientes && !cerrada) { e.preventDefault(); e.returnValue = ''; } });
    return api;
  }

  window.UT = { crear: crear, olvidar: olvidar };
})();
