  /* ---------- T0643 · Cerrar, pasar y apuntar en un toque ----------
   * RAPIDAS: { HECHA: { campo, valor }, PASAR: columna de fecha, SI: [condiciones], SIGUIENTE: { con, copia, pone } }.
   * Las filas que cumplen SI (y no tienen ya el valor de HECHA) llevan un círculo que las cierra y «Pasar» (mañana, una
   * semana u otro día); al cerrar una que es con alguien de SIGUIENTE.con, se pregunta el siguiente paso con él. */
  var DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function isoDe(d) { return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function masDias(hoy, n) { var d = aFecha(hoy); d.setDate(d.getDate() + n); return isoDe(d); }
  /** «jue 19»: el día de la semana y del mes, para que se vea a qué día va. */
  function diaCorto(iso) { var d = aFecha(iso); return d ? DIAS_SEMANA[d.getDay()].slice(0, 3) + ' ' + d.getDate() : ''; }
  /** A qué días se puede pasar algo, desde hoy (no desde la fecha que tenía). Si mañana es sábado o domingo, se ofrecen
   *  los dos, mañana y el lunes (Javi, 18/11/2026): que elija. titulo, para el menú; corto, para los botones de la ficha. */
  function opcionesPasar(hoy) {
    var m = masDias(hoy, 1), dm = aFecha(m).getDay(), r = [];
    if (dm === 6 || dm === 0) {
      r.push({ fecha: m, titulo: 'Mañana, ' + DIAS_SEMANA[dm], corto: 'Mañana' });
      r.push({ fecha: masDias(hoy, dm === 6 ? 3 : 2), titulo: 'El lunes', corto: 'El lunes' });
    } else r.push({ fecha: m, titulo: 'Mañana', corto: 'Mañana' });
    r.push({ fecha: masDias(hoy, 7), titulo: 'En una semana', corto: 'En una semana' });
    return r;
  }
  /** Para cuándo se apunta el siguiente paso: el primer día de trabajo, en 3 días o en una semana. «En 3 días» no cae en
   *  fin de semana (como Pasar, T0677): si cae, va al lunes; y si ese día ya es el primero (el viernes, «El lunes»), al
   *  siguiente de trabajo. Cuando no es justo dentro de 3 días, se dice el día («El lunes», «El martes»). */
  function fechasSiguiente(hoy) {
    var p = opcionesPasar(hoy), lab = p.length > 2 ? p[1] : p[0];
    var t = masDias(hoy, 3), dt = aFecha(t).getDay();
    if (dt === 6) t = masDias(t, 2); else if (dt === 0) t = masDias(t, 1);
    if (t <= lab.fecha) { t = masDias(lab.fecha, 1); dt = aFecha(t).getDay(); if (dt === 6) t = masDias(t, 2); else if (dt === 0) t = masDias(t, 1); }
    var tres = t === masDias(hoy, 3) ? 'En 3 días' : 'El ' + DIAS_SEMANA[aFecha(t).getDay()];
    return [{ fecha: lab.fecha, titulo: lab.titulo }, { fecha: t, titulo: tres }, { fecha: masDias(hoy, 7), titulo: 'En una semana' }];
  }
  /** T0677 · Un texto cortado para un aviso: hasta n letras, por la última palabra entera, con «…». */
  function textoCorto(t, n) {
    t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); n = n || 40;
    if (t.length <= n) return t;
    var c = t.slice(0, n - 1), e = c.lastIndexOf(' ');
    if (t.charAt(n - 1) !== ' ' && e > n / 2) c = c.slice(0, e); // si se corta a media palabra, hasta la anterior
    return c.replace(/[\s,.;:·–-]+$/, '') + '…';
  }
  /** T0677 · Cómo se nombra una fila en un aviso (««Mandar muestras» pasa al vie 20»): su texto, cortado y entre comillas;
   *  sin texto, su código. Lo que no se guarda sale tapado. */
  function nombreCorto(ap, f, prohib) {
    var v = f ? f[ap.nombre] : '', t = vacio(v) ? '' : (prohibido(v, prohib || []).length ? tapar(v, prohib) : String(v));
    t = textoCorto(t, 48);
    return t ? '«' + t + '»' : (f && !vacio(f[ap.codigo]) ? String(f[ap.codigo]) : '');
  }
  /** T0677 · Un cambio que se puede deshacer. «hecho»: la promesa del cambio. deshacer(): espera a que el cambio acabe (si
   *  aún se está guardando) y entonces vuelve atrás; si el cambio no llegó a guardarse, no hay nada que deshacer. Su promesa
   *  falla si falla el deshacer, para no decir «Deshecho» sin serlo. Una sola vez: la segunda no hace nada. */
  function deshacerEnOrden(cambio, volver) {
    var hecho = Promise.resolve().then(cambio), usado = null;
    return { hecho: hecho, deshacer: function () {
      if (!usado) usado = hecho.then(function () { return Promise.resolve().then(volver).then(function () { return true; }); }, function () { return false; });
      return usado;
    } };
  }
  /**
   * T0736 (R99) · El guardado de una ficha que guarda sola (T0689), sin pantalla, para probarlo de verdad. Cada campo: lo que
   * no vale se dice y no se guarda; el mismo valor, nada; un cambio, «Guardando…» y, al acabar, «Guardado» y el aviso con
   * «Deshacer» (si falla, vuelve a como estaba y lo dice). Dos cambios del mismo campo, en orden: el segundo espera al
   * primero (lo de antes se coge al cambiar, no al ejecutarse: si no, se esperaba a sí mismo). Un texto, tras «espera» ms sin
   * escribir; al cerrar, lo que quede pendiente.
   * o: { apartado, prohib (los de cambioCampo), actual (la fila como está; se cambia aquí),
   *      escritor(c) → function (cambios) → promesa (el motor) o un texto si no se puede, reloj: { poner(fn, ms), quitar(t) },
   *      espera (1500) y lo de la pantalla, con «que» (lo que dio quien llama: el campo): invalido(que, sí/no),
   *      igual(que), empieza(que, c, cambios) → info, estado(que, texto, mal), hecho(que, info, deshacer),
   *      volver(que, columna, valor), fallo(que, c, error) }.
   * → { guardar(c, valor, que) → 'mal' | 'igual' | 'guarda', esperar(c, valorDe, que) (valorDe() → el valor, o undefined si el
   *     campo ya no está), olvidar(c), cerrar(queDe, valorDe) (lo pendiente: queDe(c) → que, o null si ya no está;
   *     valorDe(que) → su valor), pendientes() }.
   */
  function guardadoSolo(o) {
    var esperas = {}, enCurso = {}, reloj = o.reloj, nada = function () {};
    var avisa = function (n) { return o[n] || nada; };
    function olvidar(c) { if (esperas[c]) { reloj.quitar(esperas[c].t); delete esperas[c]; } }
    function guardar(c, valor, que) {
      olvidar(c);
      var actual = o.actual, r = cambioCampo(o.apartado, c, valor, actual, o.prohib);
      if (r.error) { avisa('invalido')(que, true); avisa('estado')(que, r.error, true); return 'mal'; }
      avisa('invalido')(que, false);
      var ks = Object.keys(r.cambios);
      if (!ks.length) { avisa('igual')(que); return 'igual'; }
      var escribir = o.escritor(c);
      if (typeof escribir !== 'function') { avisa('estado')(que, escribir, true); return 'mal'; }
      var antes = {}; ks.forEach(function (k) { antes[k] = vacio(actual[k]) ? '' : actual[k]; actual[k] = r.cambios[k]; });
      var info = avisa('empieza')(que, c, r.cambios);
      avisa('estado')(que, 'Guardando…');
      function aAntes() { ks.forEach(function (k) { actual[k] = antes[k]; avisa('volver')(que, k, antes[k]); }); }
      var previo = (enCurso[c] || Promise.resolve()).then(null, nada);
      var ch = deshacerEnOrden(function () { return previo.then(function () { return escribir(r.cambios); }); },
        function () { return escribir(antes); });
      enCurso[c] = ch.hecho;
      ch.hecho.then(function () {
        avisa('estado')(que, 'Guardado');
        avisa('hecho')(que, info, function () {
          return Promise.resolve(ch.deshacer()).then(function () { aAntes(); avisa('estado')(que, ''); });
        });
      }, function (e) {
        aAntes();
        avisa('estado')(que, 'No se ha guardado', true);
        avisa('fallo')(que, c, e);
      });
      return 'guarda';
    }
    return {
      guardar: guardar,
      olvidar: olvidar,
      esperar: function (c, valorDe, que) {
        olvidar(c);
        esperas[c] = { que: que, t: reloj.poner(function () {
          delete esperas[c];
          var v = valorDe(); if (v !== undefined) guardar(c, v, que);
        }, o.espera || 1500) };
      },
      cerrar: function (queDe, valorDe) {
        Object.keys(esperas).forEach(function (c) { var q = queDe(c); if (q) guardar(c, valorDe(q), q); else olvidar(c); });
      },
      pendientes: function () { return Object.keys(esperas); }
    };
  }
  /** T0677 · La lista de «con quién» al añadir (un campo con «primero»): un grupo por columna, con el título de «grupos»
   *  («Marcas», «Proveedores», «Otros») o el del campo, en orden alfabético y, con q, solo lo que lo lleva (sin tildes ni
   *  mayúsculas). ed: las columnas que se pueden poner. [{ col, titulo, opciones: [{ nombre, valor }] }], sin grupos vacíos. */
  function gruposConQuien(ap, c, ed, q) {
    var cp = campo(ap, c), t = norm(q);
    return (cp.primero || []).filter(function (p) { return (!ed || ed.indexOf(p) >= 0) && campo(ap, p).ids; }).map(function (p) {
      var ids = campo(ap, p).ids;
      var ops = Object.keys(ids).filter(function (n) { return !t || norm(n).indexOf(t) >= 0; })
        .sort(function (x, y) { return x.localeCompare(y, 'es', { sensitivity: 'base' }); })
        .map(function (n) { return { nombre: n, valor: ids[n] }; });
      return { col: p, titulo: (cp.grupos && cp.grupos[p]) || campo(ap, p).titulo, opciones: ops };
    }).filter(function (g) { return g.opciones.length; });
  }
  /** T0677 · Lo que se enseña de una fila que ya dice un aviso: el estado «Esperando respuesta» junto al aviso «Esperando
   *  respuesta hace días» es lo mismo dos veces. true si algún aviso empieza por ese texto. */
  function loDiceUnAviso(txt, avs) {
    var t = norm(txt);
    return !!t && (avs || []).some(function (x) { return norm(x.titulo).indexOf(t) === 0; });
  }
  /** Si una fila (como se ve, con nombres) lleva el círculo y «Pasar». */
  function rapidaEn(ap, f, hoy) {
    var r = ap.rapidas;
    if (!r || !f) return false;
    if (r.hecha && norm(f[r.hecha.campo]) === norm(r.hecha.valor)) return false;
    return cumple(f, r.si, { hoy: hoy });
  }
  /** El código de un valor dicho por su nombre en una columna que apunta a otra tabla («Hecha» → EST04); si no, tal cual. */
  function codigoDe(ap, c, v) { var cp = campo(ap, c); return cp.ids && v in cp.ids ? cp.ids[v] : v; }
  /** Con quién se pregunta el siguiente paso al cerrar una fila (la de verdad, con códigos): la primera columna de
   *  SIGUIENTE.con que tiene algo, o '' (no se pregunta). */
  function siguienteCon(ap, crudo) {
    var s = ap.rapidas && ap.rapidas.siguiente;
    return s ? s.con.filter(function (c) { return !vacio((crudo || {})[c]); })[0] || '' : '';
  }
  /** T0732 (R23) · Lo que cambia al cerrar una fila (la de verdad, con códigos) en un toque: HECHA y, con CERRAR_HOY, si su
   *  fecha (PASAR) es de después de hoy, hoy (si no, se queda arriba del Historial con «En 6 días»). { cambios, antes }, para
   *  deshacerlo entero. Una fecha pasada, la de hoy o sin fecha, no se toca. */
  function cambiosHecha(ap, crudo, hoy) {
    var r = ap.rapidas, cambios = {}, antes = {}, c = r.hecha.campo, fc = r.pasar;
    crudo = crudo || {};
    antes[c] = vacio(crudo[c]) ? '' : crudo[c];
    cambios[c] = codigoDe(ap, c, r.hecha.valor);
    var d = r.hoy && fc && !vacio(crudo[fc]) ? aFecha(crudo[fc]) : null, h = aFecha(hoy);
    if (d && h && isoDe(d) > isoDe(h)) { antes[fc] = crudo[fc]; cambios[fc] = isoDe(h); }
    return { cambios: cambios, antes: antes };
  }
  /** T0732 (R74) · Lo hablado al cerrar una tarea, en su columna (HABLADO): detrás de lo que ya tenía, en otra línea. null si
   *  no hay nada escrito o la sección no lo pregunta. */
  function conHablado(ap, crudo, txt) {
    var c = ap.rapidas && ap.rapidas.hablado, t = String(txt == null ? '' : txt).trim();
    if (!c || !t) return null;
    var ya = vacio((crudo || {})[c]) ? '' : String(crudo[c]).trim(), r = {};
    r[c] = ya ? ya + '\n' + t : t;
    return r;
  }
  /** DEDUCIR: { DESTINO: { ORIGEN: nombre } }. Lo que se pone solo en una fila (con códigos) que tiene vacío el destino y
   *  algo en un origen: { ID_TEMA: 'TEM01' } (marca → Clientes). Lo que ya tiene algo no se toca. */
  function deducidos(ap, crudo) {
    var r = {};
    Object.keys(ap.deducir || {}).forEach(function (c) {
      if (!vacio((crudo || {})[c])) return;
      var o = Object.keys(ap.deducir[c] || {}).filter(function (x) { return !vacio((crudo || {})[x]); })[0];
      if (o) r[c] = codigoDe(ap, c, ap.deducir[c][o]);
    });
    return r;
  }
  /** La fila del siguiente paso, al cerrar crudo: lo de SIGUIENTE.copia de la que se cierra (con quién, el área), el texto
   *  en el nombre, la fecha en PASAR, lo de SIGUIENTE.pone (por nombre) y, si falta, lo que se deduce. */
  function filaSiguiente(ap, crudo, txt, fecha) {
    var s = ap.rapidas.siguiente, r = {};
    s.copia.forEach(function (c) { if (!vacio(crudo[c])) r[c] = crudo[c]; });
    Object.keys(s.pone).forEach(function (c) { r[c] = codigoDe(ap, c, s.pone[c]); });
    r[ap.nombre] = txt;
    if (ap.rapidas.pasar && fecha) r[ap.rapidas.pasar] = fecha;
    var d = deducidos(ap, r); Object.keys(d).forEach(function (c) { r[c] = d[c]; });
    return r;
  }

  /* ---------- T0652 · el resumen de con quién es una fila ----------
   * Desde una tarea con un cliente (o un proveedor), lo último que se hizo con él, lo que queda y unas líneas de su ficha,
   * sin salir de la lista. Lo junta de lo apuntado: no escribe nada. */
  /** La columna de CONTEXTO.de que tiene algo en la fila (la de verdad, con códigos): en el orden de «primero» del campo. */
  function contextoCol(ap, crudo) {
    var cx = ap.contexto;
    if (!cx || !crudo) return '';
    var orden = (campo(ap, cx.campo).primero || []).concat(Object.keys(cx.de));
    return orden.filter(function (c) { return cx.de[c] && !vacio(crudo[c]); })[0] || '';
  }
  /** Un trozo de una línea: una columna o { campo, antes, despues } («pagan hoy 14 €/m»). Lo que no se guarda sale tapado;
   *  «despues» solo va tras un número (una unidad no va detrás de «Ideal 8, aceptan 9»). */
  function pieza(ap, t, fila, p, prohib) {
    var q = typeof p === 'string' ? { campo: p } : (p || {}), v = fila[q.campo];
    if (vacio(v)) return '';
    var s = prohibido(v, prohib).length ? tapar(v, prohib) : String(v).trim();
    if (q.despues && !isNaN(aNumero(v))) s += q.despues;
    if (q.sinNumero) s = mostrar({ sinNumero: true }, s); // T0677: «6 Propuesta enviada» → «Propuesta enviada», como en las listas
    // «Prioridad alta»: el nombre de otra tabla, detrás de su «antes», en minúscula.
    if (q.antes) s = q.antes + ' ' + (refDe(ap, t, q.campo) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
    return s;
  }
  function piezas(ap, t, fila, ps, prohib) { return lista(ps).map(function (p) { return pieza(ap, t, fila, p, prohib); }).filter(String).join(' · '); }
