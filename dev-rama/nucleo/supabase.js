/*
 * Las tablas en Supabase · UTILO_CORE (T0382) · la capa de tablas cuando el dato está en Supabase y no en un Sheet
 *
 * Las secciones leen y escriben con ctx.tablas (kanban4/tablas.js), por el nombre de la tabla y el de sus columnas, y
 * tablas.js pide lo que le falta con llamar(fn, args): tablasLeer, tablasFila, tablasCrear, tablasActualizar y tablasBorrar.
 * Con un Sheet, eso lo contesta el motor (motor/core/TABLAS_API.js). Esto lo contesta igual desde Supabase, por su API
 * (PostgREST), con la sesión de quien ha entrado: la sección no cambia, solo lo que hay debajo.
 *
 *   var sb = US.crear({ url, clave (la publishable), token: function () { return promesa del access_token },
 *                       esquema (el de esquema.js --web: { zona, tablas }), otro: llamar del motor (opcional) });
 *   var T = UT.crear({ llamar: sb.llamar, clave: 'utilo', persona: correo, aviso: … });
 *
 * - Cada tabla va a Supabase si está en el esquema (las que ya tienen migración); las demás, a otro (el motor, con su Sheet).
 *   Una misma tablasLeer puede pedir de los dos: se juntan. Sin otro, una tabla que no está en el esquema es un error.
 * - Nombres: en la base, en minúsculas (ENTREGAS.FECHA_PREVISTA → entregas.fecha_prevista); a la sección, como en el YAML.
 * - Valores, los mismos que con un Sheet: texto; números; true/false; fecha 'aaaa-mm-dd'; fecha y hora 'aaaa-mm-ddThh:mm'
 *   (la hora de la zona del esquema; en la base, timestamptz); hora 'hh:mm'; vacío ''. Una persona (tipo persona) es su id
 *   de acceso.personas (en un Sheet, su nombre).
 * - Antes de escribir se valida contra el YAML como en el motor (columna que existe, tipo, obligatoria que se vacía, valores
 *   de lista; el ID y el LOG no se cambian desde fuera). Lo demás lo dice la base (lo obligatorio que no viene en un alta,
 *   que muchas veces pone ella; claves ajenas, únicas, reglas por fila) y aquí se
 *   traduce a un aviso en castellano con el mismo prefijo que el motor: VALIDAR:, SECCION: (no tienes permiso), CAMBIADO:,
 *   ACCESO: (sin sesión).
 * - Quién puede qué lo dicen las reglas por fila (RLS) y los permisos de la base, no la web: lo que no deja, aquí es un error.
 * - Leer: toda la tabla en páginas de 1000 filas (lo que da la API como mucho), en el orden de su clave. v es una huella de
 *   lo leído: si no ha cambiado desde lo que tiene la web (desde), va { igual: true } y no se vuelve a pintar.
 * - En directo (T0386): US.directo({ url, clave, token, tablas, alCambiar }) avisa de cada cambio en esas tablas (Realtime).
 * - Partes (T0256): { col, valores } → col=in.(…), de 100 en 100 valores.
 * - Actualizar con antes (lo que había en la pantalla): solo cambia la fila si sigue así; si otra persona la ha cambiado,
 *   CAMBIADO (tablas.js la vuelve a leer). Una fila que no se puede cambiar no da error en la API (las reglas por fila la
 *   esconden): se mira la fila para decir por qué.
 * - Borrar: si su ESTADO tiene «Eliminada», se marca así (como el motor); si no, se borra.
 * - Sin LOG, despues, refrescar ni otras: lo que pasa después de escribir lo hace la base (disparadores).
 * - T0386 · Vistas (TABLERO, de supabase/vistas.json): se leen como una tabla y no se escriben (SECCION:); se cambia su tabla.
 * - T0386 · Funciones de la base (o.funciones: las de la «api» de la sección, como mover_tarea): llamar(fn, [{ args }]) va a
 *   rpc/<fn>; sb.rpc(fn, args) también (mi_acceso). Sus errores, con el prefijo y la frase de la base.
 * Vale también en node (las pruebas y las herramientas): module.exports, con fetch de node 18+ o el que se pase.
 */
(function (raiz) {
  'use strict';

  var PAGINA = 1000; // filas por petición: lo más que da la API de Supabase (max_rows)
  var LOTE = 100;    // valores de una parte por petición (la dirección no puede ser infinita)
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function vacio(v) { return v === '' || v === null || v === undefined; }
  function txt(v) { return vacio(v) ? '' : String(v); }
  function igual(a, b) { return txt(a) === txt(b); }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function hay(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /* ---------- fechas y horas con zona ---------- */

  function partesEn(ms, zona) {
    var o = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return o;
  }
  /** Minutos que la zona va por delante de UTC en ese instante. */
  function desfase(ms, zona) {
    var o = partesEn(ms, zona);
    return (Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second) - Math.floor(ms / 1000) * 1000) / 60000;
  }
  /** Un instante de la base ('2026-11-06T09:30:00+00:00') → la hora de pared de la zona ('2026-11-06T10:30'). */
  function aPared(iso, zona) {
    var ms = Date.parse(iso);
    if (isNaN(ms)) return String(iso);
    var o = partesEn(ms, zona);
    return o.year + '-' + o.month + '-' + o.day + 'T' + o.hour + ':' + o.minute;
  }
  /** La hora de pared de la zona ('2026-11-06T10:30') → el instante, en ISO. En el cambio de hora, la primera que existe. */
  function dePared(s, zona) {
    var m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(s);
    var utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    var d = desfase(utc - desfase(utc, zona) * 60000, zona);
    return new Date(utc - d * 60000).toISOString();
  }

  /** Lo que escribe la sección → el formato de la web ('aaaa-mm-dd', 'aaaa-mm-ddThh:mm', 'hh:mm'), o '' si no vale. Como kcTablaFechaWeb_. */
  function fechaWeb(v, t, zona) {
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return '';
      var w = aPared(v.toISOString(), zona);
      return t === 'fecha' ? w.slice(0, 10) : t === 'hora' ? w.slice(11) : w;
    }
    var s = String(v).trim(), m;
    if (t === 'hora') { m = /^(\d{1,2}):(\d\d)(?::\d\d)?$/.exec(s); return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? dos(Number(m[1])) + ':' + m[2] : ''; }
    var a, me, di, h, mi;
    m = /^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d{1,2}):(\d\d)(?::\d\d)?)?$/.exec(s);
    if (m) { a = +m[1]; me = +m[2]; di = +m[3]; h = m[4]; mi = m[5]; }
    else {
      m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d\d)(?::\d\d)?)?$/.exec(s);
      if (!m) return '';
      a = +m[3]; me = +m[2]; di = +m[1]; h = m[4]; mi = m[5];
    }
    var d = new Date(Date.UTC(a, me - 1, di));
    if (d.getUTCFullYear() !== a || d.getUTCMonth() !== me - 1 || d.getUTCDate() !== di) return '';
    if (h !== undefined && (Number(h) > 23 || Number(mi) > 59)) return '';
    var f = a + '-' + dos(me) + '-' + dos(di);
    return t === 'fecha' ? f : f + 'T' + dos(Number(h || 0)) + ':' + (mi || '00');
  }

  /* ---------- valores: de la base a la web y de la web a la base ---------- */

  /** Lo que da la API → el valor de la web, según el tipo de la columna. */
  function deBase(x, col, zona) {
    if (x === null || x === undefined) return '';
    var t = col.tipo;
    if (t === 'numero' || t === 'importe') return typeof x === 'number' ? x : Number(x);
    if (t === 'booleano') return x === true || x === 'true';
    if (t === 'fecha') return String(x).slice(0, 10);
    if (t === 'hora') return String(x).slice(0, 5);
    if (t === 'fecha_hora') return aPared(x, zona);
    return String(x);
  }
  /** Valor de la web ya validado → lo que va a la API. Vacío: null (un booleano vacío es false, como la casilla del Excel). */
  function aBase(v, col, zona) {
    if (vacio(v)) return col.tipo === 'booleano' ? false : null;
    if (col.tipo === 'fecha_hora') return dePared(v, zona);
    return v;
  }

  /**
   * Comprueba y normaliza lo que se va a escribir, como kcTablaValidar_ del motor. Lo que no viene en un alta y es
   * obligatorio, y las refs, los dice la base: muchas columnas obligatorias las pone ella (la hora de una línea de la
   * bitácora, el ID de una dependencia) y una que falte da su aviso igual (23502). modo: 'crear' o 'actualizar'.
   * Devuelve { COLUMNA: valor de la web }.
   */
  function validar(T, valores, modo, zona) {
    var out = {}, mal = [];
    Object.keys(valores || {}).forEach(function (n) {
      var col = T.pos[n], v = valores[n];
      if (!col) { mal.push(n + ': no es una columna de ' + T.nombre + '.'); return; }
      if (col.tipo === 'log') { mal.push(n + ': el LOG no se escribe desde la web.'); return; }
      if (n === T.clave && modo !== 'crear') { mal.push(n + ': el ID no se cambia.'); return; }
      if (v === null || v === undefined) v = '';
      if (typeof v === 'string') v = v.trim();
      if (v === '') {
        if (col.obligatoria && !(modo === 'crear' && n === T.clave && T.prefijo)) mal.push(n + ': es obligatoria.');
        out[n] = ''; return;
      }
      var t = col.tipo, x = v;
      if (t === 'numero' || t === 'importe') {
        x = typeof v === 'number' ? v : Number(String(v).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
        if (typeof x !== 'number' || !isFinite(x)) { mal.push(n + ': «' + v + '» no es un número.'); return; }
      } else if (t === 'booleano') {
        x = v === true || /^(true|sí|si|1|x)$/i.test(String(v)) ? true : v === false || /^(false|no|0)$/i.test(String(v)) ? false : null;
        if (x === null) { mal.push(n + ': «' + v + '» no es sí o no.'); return; }
      } else if (t === 'fecha' || t === 'fecha_hora' || t === 'hora') {
        x = fechaWeb(v, t, zona);
        if (!x) { mal.push(n + ': «' + v + '» no es ' + (t === 'hora' ? 'una hora (hh:mm)' : t === 'fecha' ? 'una fecha (aaaa-mm-dd)' : 'una fecha y hora (aaaa-mm-ddThh:mm)') + '.'); return; }
      } else if (t === 'lista' && !col.de) {
        x = String(v);
        if ((col.valores || []).indexOf(x) < 0) { mal.push(n + ': «' + x + '» no está en la lista (' + (col.valores || []).join(', ') + ').'); return; }
      } else if (t === 'persona') {
        x = String(v);
        if (!UUID.test(x)) { mal.push(n + ': «' + x + '» no es una persona (su id de acceso).'); return; }
      } else {
        x = String(v);
      }
      out[n] = x;
    });
    if (mal.length) throw new Error('VALIDAR: ' + mal.join(' '));
    return out;
  }

  /* ---------- el esquema ---------- */

  /** El esquema de esquema.js (--web) → { NOMBRE: { nombre, db, clave, prefijo, columnas, pos: { COL: col } } }. */
  function preparar(esq) {
    var out = {};
    Object.keys((esq && esq.tablas) || {}).forEach(function (n) {
      var t = esq.tablas[n], T = { nombre: n, db: t.db || n.toLowerCase(), clave: t.clave, prefijo: t.prefijo || '', columnas: t.columnas, restricciones: t.restricciones || {}, pos: {},
        soloLeer: !!t.soloLeer, de: t.de || '' }; // T0386: una vista (TABLERO), solo para leer
      t.columnas.forEach(function (c) { T.pos[c.nombre] = c; c.db = c.db || c.nombre.toLowerCase(); });
      out[n] = T;
    });
    return out;
  }

  /** Huella corta de lo leído (FNV-1a): la versión de la tabla para la web. */
  function huella(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return 'sb' + s.length.toString(36) + h.toString(36);
  }

  /* ---------- errores de la API, en castellano ---------- */

  function nombreTabla(TS, db) {
    for (var n in TS) if (TS[n].db === db) return n;
    return String(db || '').toUpperCase();
  }
  /** «Key (iniciativa, numero)=(UTILO, 19)» → { cols: ['INICIATIVA', 'NUMERO'], vals: 'UTILO, 19' }. */
  function claveDe(detalle) {
    var m = /Key \(([^)]*)\)=\((.*)\)/.exec(String(detalle || ''));
    return m ? { cols: m[1].split(/,\s*/).map(function (c) { return c.replace(/"/g, '').toUpperCase(); }), vals: m[2] } : null;
  }
  /** La restricción por su nombre (esquema.js --web): { T (su tabla), cols }. */
  function restriccion(TS, nombre) {
    for (var n in TS) if (TS[n].restricciones && hay(TS[n].restricciones, nombre)) return { T: TS[n], cols: TS[n].restricciones[nombre] };
    return null;
  }
  /**
   * Error de la API (j: { code, message, details, hint }) → Error con el aviso para la sección. Con reglas por fila, Postgres
   * no da el detalle («Key (…)=(…)»): las columnas salen del nombre de la restricción y el valor, de valores (lo que se
   * intentaba escribir; al borrar, { clave: id }).
   */
  function traducir(j, status, T, accion, TS, valores) {
    j = j || {};
    valores = valores || {};
    var c = String(j.code || ''), msg = String(j.message || ''), det = String(j.details || ''), e;
    var verbo = { leer: 'leer', crear: 'crear filas', actualizar: 'cambiar', borrar: 'borrar' }[accion] || accion;
    var rn = (/constraint "([^"]+)"/.exec(msg) || [])[1] || '', R = rn ? restriccion(TS, rn) : null;
    var k = claveDe(det);
    if (!k && R && R.T === T && R.cols.every(function (x) { return !vacio(valores[x]); })) k = { cols: R.cols, vals: R.cols.map(function (x) { return txt(valores[x]); }).join(', ') };
    var cols = k ? k.cols : R ? R.cols : null;
    if (c === '23505') e = 'VALIDAR: ' + (cols ? cols.join(' y ') + ': ya hay una fila con ' + (k ? '«' + k.vals + '»' : 'ese valor') + ' en ' + T.nombre + '.' : 'ese valor ya está en ' + T.nombre + ' y no se puede repetir.');
    else if (c === '23503' && (/still referenced/.test(det) || /update or delete on table/.test(msg))) {
      var usa = (/from table "?([^"\s]+)"?/.exec(det) || /on table "([^"]+)"\s*$/.exec(msg) || [])[1];
      var id = k && !R ? k.vals : txt(valores[T.clave]);
      e = 'VALIDAR: no se puede borrar ' + (id || 'esa fila') + ': lo usa ' + (R && R.T !== T ? R.T.nombre : usa ? nombreTabla(TS, usa) : 'otra tabla') + '.';
    } else if (c === '23503') {
      var en = (/in table "?([^"\s]+)"?/.exec(det) || [])[1], col = cols && cols.length === 1 ? T.pos[cols[0]] : null;
      var destino = en ? nombreTabla(TS, en) : col && col.ref ? col.ref : '';
      if (col && col.tipo === 'persona') e = 'VALIDAR: ' + col.nombre + ': ' + (k ? k.vals : 'esa persona') + ' no es una persona con acceso.';
      else e = 'VALIDAR: ' + (cols ? cols.join(', ') + ': no hay ningún ' + (k ? k.vals : 'valor así') + (destino ? ' en ' + destino : '') + '.' : 'apunta a una fila que no existe.');
    } else if (c === '23502') {
      var cn = /column "([^"]+)"/.exec(msg);
      e = 'VALIDAR: ' + (cn ? cn[1].toUpperCase() + ': es obligatoria.' : 'falta un valor obligatorio.');
    } else if (c === '23514') {
      var c2 = R && R.T === T && R.cols.length === 1 ? R.cols[0] : '';
      e = 'VALIDAR: ' + (c2 ? c2 + ': el valor no cumple su regla (' + (T.pos[c2] && T.pos[c2].valores ? 'tiene que ser uno de ' + T.pos[c2].valores.join(', ') : 'su formato') + ').' : 'un valor no cumple las reglas de ' + T.nombre + (rn ? ' (' + rn + ')' : '') + '.');
    } else if (c === '42501') e = 'SECCION: no tienes permiso para ' + verbo + ' en ' + T.nombre + '.';
    else if (c === 'P0001' || c === 'P0002' || /^22/.test(c)) e = 'VALIDAR: ' + msg;
    else if (/^PGRST30/.test(c) || status === 401) e = 'ACCESO: la sesión ha caducado: vuelve a entrar.';
    else if (c === 'PGRST204' || c === '42703') e = 'La tabla ' + T.nombre + ' de Supabase no tiene las columnas de su YAML: falta aplicar su migración (' + msg + ').';
    else if (c === '42P01' || c === 'PGRST205') e = 'Supabase no tiene la tabla ' + T.nombre + ': falta aplicar su migración.';
    else e = 'Supabase no ha podido ' + verbo + ' en ' + T.nombre + ': ' + (msg || ('responde ' + status)) + '.';
    var err = new Error(e);
    err.supabase = { code: c, status: status };
    return err;
  }

  /* ---------- la capa ---------- */

  function crear(o) {
    o = o || {};
    if (!o.url || !o.clave) throw new Error('US.crear: faltan url y clave (la publishable) del Supabase.');
    var TS = preparar(o.esquema), zona = o.zona || (o.esquema && o.esquema.zona) || 'Europe/Madrid';
    var base = String(o.url).replace(/\/+$/, '') + '/rest/v1/';
    var traer = o.fetch || (typeof fetch === 'function' ? function (u, x) { return fetch(u, x); } : null);
    var pagina = o.pagina || PAGINA;

    function es(n) { return hay(TS, String(n)); }
    function tabla(n) { if (!es(n)) throw new Error('No conozco la tabla ' + n + ' en Supabase (no está en su esquema).'); return TS[n]; }

    /** Una petición a la API. Devuelve el JSON (o null) y, si falla, el error ya traducido. */
    function pedir(T, accion, metodo, ruta, cuerpo, prefer, valores) {
      var sesion = '';
      return Promise.resolve(o.token ? o.token() : '').then(function (tok) {
        sesion = tok || '';
        var h = { apikey: o.clave, Accept: 'application/json' };
        if (tok) h.Authorization = 'Bearer ' + tok;
        if (cuerpo !== undefined) h['Content-Type'] = 'application/json';
        if (prefer) h.Prefer = prefer;
        return traer(base + ruta, { method: metodo, headers: h, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
      }).then(function (r) {
        return r.text().then(function (s) {
          var j = null;
          try { j = s ? JSON.parse(s) : null; } catch (e) { j = { message: s }; }
          if (!r.ok) {
            var e = traducir(j, r.status, T, accion, TS, valores);
            // Sin sesión, «no tienes permiso» es que falta entrar.
            if (!sesion && /^SECCION:/.test(e.message)) e.message = 'ACCESO: entra con tu cuenta para ' + ({ leer: 'ver', crear: 'crear filas en', actualizar: 'cambiar', borrar: 'borrar' }[accion] || accion) + ' ' + T.nombre + '.';
            throw e;
          }
          return j;
        });
      }, function (e) {
        if (e && /^(VALIDAR|SECCION|ACCESO|CAMBIADO):/.test(e.message)) throw e;
        throw new Error('No hay conexión con Supabase (' + ((e && e.message) || e) + ').');
      });
    }

    function sel(T) { return 'select=' + T.columnas.map(function (c) { return c.db; }).join(','); }
    function q(T, col, v) { return encodeURIComponent(T.pos[col].db) + '=eq.' + encodeURIComponent(aBase(v, T.pos[col], zona)); }
    /** col=in.("a","b") con cada valor entre comillas (pueden llevar comas o paréntesis). */
    function enLista(T, col, vals) {
      return encodeURIComponent(T.pos[col].db) + '=in.(' + vals.map(function (v) { return encodeURIComponent('"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'); }).join(',') + ')';
    }
    /** Una fila de la API → lista de valores de la web en el orden del YAML. */
    function lista(T, f) { return T.columnas.map(function (c) { return deBase(f[c.db], c, zona); }); }
    function objeto(T, f) { var r = {}; T.columnas.forEach(function (c) { r[c.nombre] = deBase(f[c.db], c, zona); }); return r; }

    /** Todas las filas (o las de esa condición), página a página, en el orden de la clave. */
    function todas(T, cond) {
      var out = [];
      function una(desde) {
        var ruta = T.db + '?' + sel(T) + (cond ? '&' + cond : '') + '&order=' + encodeURIComponent(T.pos[T.clave].db) + '.asc&limit=' + pagina + '&offset=' + desde;
        return pedir(T, 'leer', 'GET', ruta).then(function (fs) {
          fs = fs || [];
          out = out.concat(fs);
          return fs.length < pagina ? out : una(desde + pagina);
        });
      }
      return una(0);
    }
    function leerUna(T, p) {
      var hecho;
      if (!p) hecho = todas(T);
      else {
        if (!T.pos[p.col]) return Promise.reject(new Error('VALIDAR: ' + p.col + ' no es una columna de ' + T.nombre + ' (parte).'));
        var vs = [].concat(p.valores || []).map(String), lotes = [];
        for (var i = 0; i < vs.length; i += LOTE) lotes.push(vs.slice(i, i + LOTE));
        // Sin valores, ninguna fila (como el motor): no se pregunta.
        hecho = Promise.all(lotes.map(function (l) { return todas(T, enLista(T, p.col, l)); })).then(function (rs) {
          var vistos = {}, out = [];
          [].concat.apply([], rs).forEach(function (f) { var k = String(f[T.pos[T.clave].db]); if (!vistos[k]) { vistos[k] = 1; out.push(f); } });
          return out;
        });
      }
      return hecho.then(function (fs) {
        var filas = fs.map(function (f) { return lista(T, f); });
        return { cols: T.columnas.map(function (c) { return c.nombre; }), filas: filas, v: huella(JSON.stringify(filas)), leido: Date.now() };
      });
    }

    function filaDe(T, id) {
      return pedir(T, 'leer', 'GET', T.db + '?' + sel(T) + '&' + q(T, T.clave, id) + '&limit=1').then(function (fs) {
        if (!fs || !fs.length) throw new Error('No encuentro ' + id + ' en ' + T.nombre + ' (puede que la hayan borrado o que no la puedas ver). Actualiza y vuelve a probar.');
        return objeto(T, fs[0]);
      });
    }

    /* --- lo que pide tablas.js --- */

    function tablasLeer(nombres, op) {
      op = op || {};
      nombres = [].concat(nombres).map(String);
      var desde = op.desde || {}, partes = op.partes || {}, out = {};
      var aqui = nombres.filter(es), fuera = nombres.filter(function (n) { return !es(n); });
      var ps = aqui.map(function (n) {
        return leerUna(tabla(n), partes[n] || null).then(function (t) {
          if (desde[n] && desde[n] === t.v) { out[n] = { v: t.v, igual: true }; return; }
          if (partes[n]) t.parte = true;
          out[n] = t;
        });
      });
      if (fuera.length) {
        if (!o.otro) ps.push(Promise.reject(new Error('No conozco la tabla ' + fuera.join(', ') + ' en Supabase (no está en su esquema).')));
        else {
          var po = {}, pp = {};
          fuera.forEach(function (n) { if (desde[n]) po[n] = desde[n]; if (partes[n]) pp[n] = partes[n]; });
          ps.push(Promise.resolve(o.otro('tablasLeer', [fuera, { desde: po, fresco: !!op.fresco, partes: pp }])).then(function (r) {
            Object.keys((r && r.tablas) || {}).forEach(function (n) { out[n] = r.tablas[n]; });
          }));
        }
      }
      return Promise.all(ps).then(function () { return { tablas: out }; });
    }

    function tablasFila(n, id) { return filaDe(tabla(n), String(id)); }

    function tablasCrear(n, valores) {
      var T = tabla(n), v = {};
      for (var k in valores || {}) if (hay(valores, k) && !/^_/.test(k)) v[k] = valores[k];
      if (T.prefijo) delete v[T.clave]; // el ID lo pone la base (el siguiente)
      var nuevo = validar(T, v, 'crear', zona), cuerpo = {};
      Object.keys(nuevo).forEach(function (c) { if (!(c === T.clave && nuevo[c] === '')) cuerpo[T.pos[c].db] = aBase(nuevo[c], T.pos[c], zona); });
      return pedir(T, 'crear', 'POST', T.db + '?' + sel(T), cuerpo, 'return=representation', nuevo).then(function (fs) {
        if (!fs || !fs.length) throw new Error('SECCION: la fila se ha creado, pero no la puedes ver.');
        var fila = objeto(T, fs[0]);
        return { id: String(fila[T.clave]), fila: fila, v: '' };
      });
    }

    function tablasActualizar(n, id, cambios, op) {
      var T = tabla(n);
      id = String(id);
      var nuevo = validar(T, cambios, 'actualizar', zona), cuerpo = {}, antes = (op && op.antes) || {};
      Object.keys(nuevo).forEach(function (c) { cuerpo[T.pos[c].db] = aBase(nuevo[c], T.pos[c], zona); });
      if (!Object.keys(cuerpo).length) return filaDe(T, id).then(function (f) { return { fila: f, cambios: 0, v: '' }; });
      var cuenta = Object.keys(nuevo).filter(function (c) { return !hay(antes, c) || !igual(antes[c], nuevo[c]); }).length || Object.keys(nuevo).length;
      // Solo si sigue como estaba en la pantalla (lo que no está vacío; lo vacío se mira después, si hace falta).
      var cond = Object.keys(antes).filter(function (c) { return T.pos[c] && T.pos[c].tipo !== 'log'; }).map(function (c) {
        return vacio(antes[c]) ? encodeURIComponent(T.pos[c].db) + '=is.null' : q(T, c, antes[c]);
      });
      var conId = Object.assign({}, nuevo); conId[T.clave] = id; // para los avisos de la base (traducir)
      function cambiar(conCond) {
        return pedir(T, 'actualizar', 'PATCH', T.db + '?' + sel(T) + '&' + q(T, T.clave, id) + (conCond && cond.length ? '&' + cond.join('&') : ''), cuerpo, 'return=representation', conId);
      }
      return cambiar(true).then(function (fs) {
        if (fs && fs.length) return fs;
        // No ha cambiado nada: o no existe, o la ha cambiado otra persona, o no la puedes cambiar.
        return filaDe(T, id).then(function (ahora) {
          Object.keys(antes).forEach(function (c) {
            if (T.pos[c] && T.pos[c].tipo !== 'log' && !igual(ahora[c], antes[c]))
              throw new Error('CAMBIADO: alguien ha cambiado ' + c + ' de ' + id + ' mientras tanto (ahora es «' + (ahora[c] === true ? 'sí' : ahora[c] === false ? 'no' : txt(ahora[c])) + '»). Se ha puesto al día.');
          });
          // Sigue igual (un vacío guardado como '' y no como null): otra vez, sin condiciones.
          return cond.length ? cambiar(false) : [];
        }).then(function (fs2) {
          if (fs2 && fs2.length) return fs2;
          throw new Error('SECCION: no tienes permiso para cambiar ' + id + ' en ' + T.nombre + '.');
        });
      }).then(function (fs) { return { fila: objeto(T, fs[0]), cambios: cuenta, v: '' }; });
    }

    function tablasBorrar(n, id) {
      var T = tabla(n), est = T.pos.ESTADO;
      id = String(id);
      if (est && est.tipo === 'lista' && (est.valores || []).indexOf('Eliminada') >= 0) {
        return tablasActualizar(n, id, { ESTADO: 'Eliminada' }).then(function (r) { return { eliminada: true, fila: r.fila, v: '' }; });
      }
      var cl = {}; cl[T.clave] = id;
      return pedir(T, 'borrar', 'DELETE', T.db + '?' + sel(T) + '&' + q(T, T.clave, id), undefined, 'return=representation', cl).then(function (fs) {
        if (fs && fs.length) return { borrada: true, v: '' };
        return filaDe(T, id).then(function () { throw new Error('SECCION: no tienes permiso para borrar ' + id + ' en ' + T.nombre + '.'); });
      });
    }

    var FN = { tablasLeer: tablasLeer, tablasFila: tablasFila, tablasCrear: tablasCrear, tablasActualizar: tablasActualizar, tablasBorrar: tablasBorrar };

    /**
     * T0386 · Una función de la base por la API (POST rpc/<fn>), con la sesión de quien ha entrado. args: el objeto con sus
     * argumentos por nombre ({ tarea, estado, … }). Lo que la base dice que no llega con el prefijo de siempre y su frase,
     * que ya está en castellano (las funciones de la gestión la escriben pensando en quien la lee).
     */
    function rpc(fn, args) {
      var sesion = '';
      return Promise.resolve(o.token ? o.token() : '').then(function (tok) {
        sesion = tok || '';
        var h = { apikey: o.clave, Accept: 'application/json', 'Content-Type': 'application/json' };
        if (tok) h.Authorization = 'Bearer ' + tok;
        return traer(base + 'rpc/' + encodeURIComponent(fn), { method: 'POST', headers: h, body: JSON.stringify(args || {}) });
      }).then(function (r) {
        return r.text().then(function (s) {
          var j = null;
          try { j = s ? JSON.parse(s) : null; } catch (e) { j = { message: s }; }
          if (r.ok) return j;
          throw errorFuncion(fn, j || {}, r.status, !!sesion);
        });
      }, function (e) {
        if (e && /^(VALIDAR|SECCION|ACCESO|CAMBIADO):/.test(e.message)) throw e;
        throw new Error('No hay conexión con Supabase (' + ((e && e.message) || e) + ').');
      });
    }

    var funciones = {};
    [].concat(o.funciones || []).forEach(function (f) { funciones[String(f)] = 1; });

    /** llamar(fn, args) para tablas.js: lo de las tablas de Supabase, aquí; lo demás (y las tablas de un Sheet), a otro. */
    function llamar(fn, args) {
      args = Array.isArray(args) ? args : [];
      return Promise.resolve().then(function () {
        if (fn === 'tablasLeer') return tablasLeer(args[0], args[1]);
        if (hay(FN, fn) && es(args[0])) {
          if (fn !== 'tablasFila' && TS[args[0]].soloLeer) throw new Error('SECCION: ' + args[0] + ' solo se lee' + (TS[args[0]].de ? ': se cambia en ' + TS[args[0]].de : '') + '.');
          return FN[fn].apply(null, args);
        }
        // T0386: las funciones de la base que puede llamar la sección (su «api»), con sus argumentos en un objeto.
        if (hay(funciones, fn)) return rpc(fn, args[0] || {});
        if (o.otro) return o.otro(fn, args);
        if (hay(FN, fn)) tabla(args[0]);
        throw new Error('Función no permitida: ' + fn + ' (aquí solo están las tablas de Supabase).');
      });
    }

    return { llamar: llamar, rpc: rpc, tiene: es, tablas: function () { return Object.keys(TS); } };
  }

  /** T0386 · El error de una función de la base → Error con el prefijo para la sección y la frase de la base. */
  function errorFuncion(fn, j, status, conSesion) {
    var c = String(j.code || ''), msg = String(j.message || '').trim(), e;
    if (/^PGRST30/.test(c) || status === 401) e = conSesion ? 'ACCESO: la sesión ha caducado: vuelve a entrar.' : 'ACCESO: entra con tu cuenta.';
    else if (c === '42501') e = 'SECCION: ' + (msg && !/^permission denied/i.test(msg) ? msg : 'no tienes permiso para ' + fn + '.');
    else if (c === 'PGRST202' || c === '42883') e = 'Supabase no tiene la función ' + fn + ' (o con esos argumentos): falta aplicar su migración.';
    else if (/^(P0001|P0002|23|22)/.test(c)) e = 'VALIDAR: ' + msg;
    else e = 'Supabase no ha podido hacer ' + fn + ': ' + (msg || ('responde ' + status)) + '.';
    var err = new Error(e);
    err.supabase = { code: c, status: status };
    return err;
  }

  /* ---------- en directo (T0386): Supabase Realtime ---------- */

  /**
   * Avisa cuando cambian filas de unas tablas de la base, en el momento, por la conexión de Realtime de Supabase (un WebSocket;
   * los avisos respetan las reglas por fila: cada uno recibe solo los de lo que puede ver). Las tablas tienen que estar en la
   * publicación supabase_realtime (su migración).
   *
   *   var d = US.directo({ url, clave (la publishable), token: function () { return promesa del access_token },
   *                        tablas: ['tareas', …] (nombres de la base), alCambiar: function (tabla) {}, WebSocket (opcional) });
   *   d.cerrar();
   *
   * alCambiar(tabla) va por cada cambio (insert, update o delete), con el nombre de la tabla de la base; y alCambiar('*') al volver
   * a conectar tras un corte (pudo cambiar algo mientras tanto). Se reconecta sola, cada vez esperando más (hasta 30 s), y cada
   * 25 s da señales de vida; la sesión renovada se le pasa sola. Sin WebSocket o sin sesión no hace nada (la web sigue con ↻).
   */
  function directo(o) {
    o = o || {};
    var WS = o.WebSocket || (typeof WebSocket === 'function' ? WebSocket : null);
    var nada = { cerrar: function () {}, activo: function () { return false; } };
    if (!WS || !o.url || !o.clave || !(o.tablas || []).length) return nada;
    var dir = String(o.url).replace(/\/+$/, '').replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(o.clave) + '&vsn=1.0.0';
    var TEMA = 'realtime:utilo-' + o.tablas.join('-'), ref = 0, ws = null, vivo = null, espera = 1000, cerrado = false, unida = false, ultimo = '', otra = false;
    var avisar = o.alCambiar || function () {};
    var poner = o.setTimeout || setTimeout, quitar = o.clearTimeout || clearTimeout, cada = o.setInterval || setInterval, parar = o.clearInterval || clearInterval;
    function enviar(tema, ev, carga) { try { ws.send(JSON.stringify({ topic: tema, event: ev, payload: carga || {}, ref: String(++ref) })); } catch (e) {} }
    function sesion() { return Promise.resolve(o.token ? o.token() : '').catch(function () { return ''; }); }
    function abrir() {
      if (cerrado) return;
      sesion().then(function (tok) {
        if (cerrado) return;
        try { ws = new WS(dir); } catch (e) { reintentar(); return; }
        ws.onopen = function () {
          ultimo = tok || '';
          enviar(TEMA, 'phx_join', {
            config: { broadcast: { self: false }, presence: { key: '' }, private: false,
              postgres_changes: o.tablas.map(function (t) { return { event: '*', schema: 'public', table: t }; }) },
            access_token: tok || o.clave
          });
          vivo = cada(function () {
            enviar('phoenix', 'heartbeat', {});
            sesion().then(function (n) { if (n && n !== ultimo && unida) { ultimo = n; enviar(TEMA, 'access_token', { access_token: n }); } });
          }, 25000);
        };
        ws.onmessage = function (m) {
          var x; try { x = JSON.parse(m.data); } catch (e) { return; }
          if (x.topic !== TEMA) return;
          if (x.event === 'phx_reply' && x.payload && x.payload.status === 'ok' && !unida) {
            unida = true; espera = 1000;
            if (otra) avisar('*'); // tras un corte, lo que cambió mientras tanto
            otra = true;
          } else if (x.event === 'postgres_changes') {
            var d = x.payload && x.payload.data;
            avisar(String((d && d.table) || '*'));
          } else if (x.event === 'phx_error' || x.event === 'phx_close') {
            try { ws.close(); } catch (e) {}
          }
        };
        ws.onclose = function () { unida = false; if (vivo) { parar(vivo); vivo = null; } reintentar(); };
        ws.onerror = function () {};
      });
    }
    var t = null;
    function reintentar() {
      if (cerrado || t) return;
      t = poner(function () { t = null; abrir(); }, espera);
      espera = Math.min(espera * 2, 30000);
    }
    abrir();
    return {
      cerrar: function () { cerrado = true; if (t) quitar(t); if (vivo) parar(vivo); try { if (ws) ws.close(); } catch (e) {} },
      activo: function () { return unida; }
    };
  }

  var US = { crear: crear, directo: directo, _: { aPared: aPared, dePared: dePared, fechaWeb: fechaWeb, deBase: deBase, aBase: aBase, validar: validar, preparar: preparar, traducir: traducir, huella: huella, errorFuncion: errorFuncion } };
  if (typeof module === 'object' && module.exports) module.exports = US;
  else raiz.US = US;
})(typeof window !== 'undefined' ? window : this);
