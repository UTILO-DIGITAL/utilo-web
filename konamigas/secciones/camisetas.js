/*
 * Sección Camisetas de Konamigas · núcleo 5.0 (T0258) · clientes/konamigas/modulos/camisetas5 de utilo-apps
 *
 * Pensada para el móvil, de pie en el campo, con el Excel CAMISETAS nuevo. Cuatro pestañas:
 * - Entregas: por competición y equipo, cada jugadora con su camiseta y el paso siguiente a un toque (Preparada, Entregada).
 *   La pantalla cambia al tocar y el Excel se escribe por detrás (capa de tablas); si el motor dice que no, se deshace y
 *   avisa. No llegó y Defectuosa apuntan además su −1 en el stock. Las camisetas de una inscripción dada de baja salen
 *   en «Para hacer»: las preparadas o entregadas, para recuperarlas (T0248); las demás, para quitarlas.
 * - Stock: por modelo, color, dorsal y talla, calculado aquí con las tablas (las mismas cuentas que el motor,
 *   CAMISETAS5_CUENTAS.js). «Sacar del local» apunta una regalada, donada, perdida… (T0247).
 * - Pedidos: lo que falta de un modelo, dar las libres del local, preparar el pedido con el resto (proveedor de
 *   CONTRAPARTES, con su contacto), el extracto para enviárselo, confirmado y ha llegado, lo pagado (la factura del
 *   pedido, de FACTURAS) y el precio por camiseta, los modelos (alta, proveedor habitual y en qué competiciones va cada
 *   uno, con sus camisetas incluidas) y la lista de proveedores (alta, contacto y su último precio).
 * - Recuento: lo que debería haber suelto en el local (en la caja, sin bolsa); se cambia lo que no cuadra y se aplica. Lo contado se guarda en
 *   este dispositivo hasta aplicarlo.
 * Los nombres de jugadoras, equipos y competiciones los da el motor (camisetas5Nombres), solo de las inscripciones con
 * camiseta; se guardan en el dispositivo y se ponen al día por detrás.
 */
(function () {
  'use strict';

  /* ======================= cuentas · las mismas que CAMISETAS5_CUENTAS.js del motor ======================= */

  // --- inicio de las cuentas (copiadas de CAMISETAS5_CUENTAS.js; probar-camisetas5.js comprueba que son iguales) ---
  var CAM5_TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  /** Estados de una camiseta que todavía hay que pedir o dar del local. */
  var CAM5_A_PEDIR = ['Por pedir', 'No llegó', 'Defectuosa'];

  function cam5Txt_(v) { return String(v === undefined || v === null ? '' : v).trim(); }
  function cam5Num_(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  /** Color, dorsal y talla de una fila (camiseta, línea de pedido o ajuste): la clave del stock. */
  function cam5Clave_(f) { return cam5Txt_(f.ID_COLOR) + '|' + cam5Txt_(f.DORSAL) + '|' + cam5Txt_(f.TALLA); }
  /** Orden por dorsal (número) y después por talla (XS a XXL). */
  function cam5Orden_(a, b) {
    var na = parseInt(a.DORSAL, 10), nb = parseInt(b.DORSAL, 10);
    na = isNaN(na) ? 9999 : na; nb = isNaN(nb) ? 9999 : nb;
    if (na !== nb) return na - nb;
    if (cam5Txt_(a.DORSAL) !== cam5Txt_(b.DORSAL)) return cam5Txt_(a.DORSAL) < cam5Txt_(b.DORSAL) ? -1 : 1;
    return CAM5_TALLAS.indexOf(cam5Txt_(a.TALLA)) - CAM5_TALLAS.indexOf(cam5Txt_(b.TALLA));
  }
  function cam5Filas_(D, t) { return (D[t] || []).filter(function (f) { return f && cam5Txt_(f.ID); }); }

  /** Los pedidos por ID: { ID: { modelo, recibido } }. */
  function cam5Pedidos_(D) {
    var P = {};
    cam5Filas_(D, 'PEDIDOS').forEach(function (p) { P[cam5Txt_(p.ID)] = { modelo: cam5Txt_(p.ID_MODELO), recibido: !!cam5Txt_(p.FECHA_RECIBIDO) }; });
    return P;
  }

  /**
   * Stock de un modelo: [{ ID_COLOR, DORSAL, TALLA, entradas, salidas, ajuste, local, reservadas, libres }], por color y
   * después por dorsal y talla. Solo las combinaciones que han tenido algún movimiento.
   */
  function cam5Stock_(D, modelo) {
    modelo = cam5Txt_(modelo);
    var P = cam5Pedidos_(D), S = {}, orden = [];
    var fila = function (f) {
      var k = cam5Clave_(f);
      if (!S[k]) { S[k] = { ID_COLOR: cam5Txt_(f.ID_COLOR), DORSAL: cam5Txt_(f.DORSAL), TALLA: cam5Txt_(f.TALLA), entradas: 0, salidas: 0, ajuste: 0, reservadas: 0 }; orden.push(k); }
      return S[k];
    };
    cam5Filas_(D, 'PEDIDOS_LINEAS').forEach(function (l) {
      var p = P[cam5Txt_(l.ID_PEDIDO)];
      if (p && p.modelo === modelo && p.recibido && cam5Txt_(l.ID_COLOR)) fila(l).entradas += cam5Num_(l.CANTIDAD);
    });
    cam5Filas_(D, 'CAMISETAS').forEach(function (c) {
      if (cam5Txt_(c.ID_MODELO) !== modelo || !cam5Txt_(c.ID_COLOR)) return;
      var e = cam5Txt_(c.ESTADO);
      if (e === 'Preparada' || e === 'Entregada') fila(c).salidas++;
      else if (e === 'Por preparar') fila(c).reservadas++;
    });
    cam5Filas_(D, 'AJUSTES_STOCK').forEach(function (a) {
      if (cam5Txt_(a.ID_MODELO) === modelo && cam5Txt_(a.ID_COLOR)) fila(a).ajuste += cam5Num_(a.CANTIDAD);
    });
    return orden.map(function (k) {
      var f = S[k];
      f.local = f.entradas - f.salidas + f.ajuste;
      f.libres = f.local - f.reservadas;
      return f;
    }).sort(function (a, b) { return (a.ID_COLOR < b.ID_COLOR ? -1 : a.ID_COLOR > b.ID_COLOR ? 1 : 0) || cam5Orden_(a, b); });
  }

  /**
   * Qué hacer con las camisetas de un modelo que faltan (Por pedir, No llegó, Defectuosa), de la más antigua a la más
   * reciente (por ID): las que tienen una libre igual en el local, a «local»; las demás, a «pedir». bajas: { ID_INSCRIPCION: true }
   * de las inscripciones dadas de baja, que no se piden ni se llevan una del local.
   * { local: [ID], pedir: [ID] }
   */
  function cam5Plan_(D, modelo, bajas) {
    modelo = cam5Txt_(modelo); bajas = bajas || {};
    var libres = {};
    cam5Stock_(D, modelo).forEach(function (f) { if (f.libres > 0) libres[cam5Clave_(f)] = f.libres; });
    var plan = { local: [], pedir: [] };
    cam5Filas_(D, 'CAMISETAS').filter(function (c) {
      return cam5Txt_(c.ID_MODELO) === modelo && CAM5_A_PEDIR.indexOf(cam5Txt_(c.ESTADO)) >= 0 && !bajas[cam5Txt_(c.ID_INSCRIPCION_JUGADORA)] &&
        cam5Txt_(c.ID_COLOR) && cam5Txt_(c.TALLA);
    }).sort(function (a, b) { return cam5Txt_(a.ID) < cam5Txt_(b.ID) ? -1 : 1; }).forEach(function (c) {
      var k = cam5Clave_(c);
      if (libres[k] > 0) { libres[k]--; plan.local.push(cam5Txt_(c.ID)); } else plan.pedir.push(cam5Txt_(c.ID));
    });
    return plan;
  }

  /** Las líneas de un pedido con esas camisetas: [{ ID_COLOR, DORSAL, TALLA, CANTIDAD }], por color, dorsal y talla. */
  function cam5Lineas_(camisetas) {
    var L = {}, orden = [];
    camisetas.forEach(function (c) {
      var k = cam5Clave_(c);
      if (!L[k]) { L[k] = { ID_COLOR: cam5Txt_(c.ID_COLOR), DORSAL: cam5Txt_(c.DORSAL), TALLA: cam5Txt_(c.TALLA), CANTIDAD: 0 }; orden.push(k); }
      L[k].CANTIDAD++;
    });
    return orden.map(function (k) { return L[k]; })
      .sort(function (a, b) { return (a.ID_COLOR < b.ID_COLOR ? -1 : a.ID_COLOR > b.ID_COLOR ? 1 : 0) || cam5Orden_(a, b); });
  }

  /**
   * Paso de un pedido: se prepara (sin confirmar), se confirma al proveedor (esperando que llegue) y llega (sus camisetas
   * pasan a Por preparar y cuentan en el local).
   */
  function cam5Paso_(p) {
    if (cam5Txt_(p.FECHA_RECIBIDO)) return 'recibido';
    return p.CONFIRMADO === true || cam5Txt_(p.CONFIRMADO).toUpperCase() === 'TRUE' ? 'confirmado' : 'sinConfirmar';
  }

  /** EN EL LOCAL de un modelo por color|dorsal|talla, solo lo que no es 0 (lo que el recuento espera encontrar). */
  function cam5Local_(D, modelo) {
    var L = {};
    cam5Stock_(D, modelo).forEach(function (f) { if (f.local) L[cam5Clave_(f)] = f.local; });
    return L;
  }
  // --- fin de las cuentas ---

  var CALC = { stock: cam5Stock_, plan: cam5Plan_, lineas: cam5Lineas_, paso: cam5Paso_, local: cam5Local_, clave: cam5Clave_, orden: cam5Orden_ };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  var TABLAS = ['CAMISETAS', 'MODELOS', 'COLORES', 'PEDIDOS', 'PEDIDOS_LINEAS', 'AJUSTES_STOCK', 'CONTRAPARTES', 'FACTURAS', 'MODELOS_COMPETICION'];
  var VISTAS = [['entregas', 'Entregas'], ['stock', 'Stock'], ['pedidos', 'Pedidos'], ['recuento', 'Recuento']];
  // [estado, en plural para los filtros, color de base.css]
  var ESTADOS = [['Por pedir', 'Por pedir', 'bl'], ['Pedida', 'Pedidas', 'x'], ['Por preparar', 'Por preparar', 'pr'], ['Preparada', 'Preparadas', 'ec'],
    ['Entregada', 'Entregadas', 'co'], ['No llegó', 'No llegaron', 'bl'], ['Defectuosa', 'Defectuosas', 'bl'], ['Sin camiseta', 'Sin camiseta', 'x']];
  var SALIDAS = ['Regalada', 'Donada', 'Perdida', 'Defectuosa', 'Otro'];
  var FALTA = ['Recuento', 'Regalada', 'Donada', 'Perdida', 'Defectuosa', 'Otro'];
  var ANCHO = window.matchMedia ? window.matchMedia('(min-width: 900px)') : { matches: false };

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function hoy() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function fecha(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(v || ''); }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
  function colorEstado(e) { var x = ESTADOS.filter(function (s) { return s[0] === e; })[0]; return x ? x[2] : 'x'; }
  function chipEstado(e) { return '<span class="n-estado n-e-' + colorEstado(e) + '">' + texto(e || 'Sin estado') + '</span>'; }

  var S = null; // estado de la sección abierta

  window.UN.registrar('CAMISETAS', {
    abrir: function (el, ctx) {
      var pref = leerLocal(ctx, 'pref') || {};
      S = { el: el, ctx: ctx, T: ctx.tablas, vista: pref.vista || 'entregas', modelo: pref.modelo || '', comp: pref.comp || '',
        filtro: 'pendientes', q: '', todo: {}, verStock: 'libres', N: leerLocal(ctx, 'nombres'), cargado: false, error: '' };
      el.innerHTML = '<nav class="u-pestanas cm-pest" role="tablist" aria-label="Camisetas">' + VISTAS.map(function (v) {
        return '<button type="button" role="tab" data-cm-vista="' + v[0] + '" aria-selected="' + (S.vista === v[0]) + '">' + v[1] + '</button>';
      }).join('') + '</nav><div id="cm-cuerpo" class="cm"></div>';
      el.querySelector('.cm-pest').onclick = function (e) {
        var b = e.target.closest('[data-cm-vista]'); if (!b) return;
        S.vista = b.getAttribute('data-cm-vista');
        [].forEach.call(el.querySelectorAll('[data-cm-vista]'), function (x) { x.setAttribute('aria-selected', x === b); });
        guardarPref(); window.scrollTo(0, 0); document.body.scrollTop = 0; pintar(true);
      };
      var yo = S;
      ctx.alCambiar(function (t) { if (S === yo && TABLAS.indexOf(t) >= 0) pintar(false); });
      pintar(true);
      ctx.tablas.leer(TABLAS).then(function () { if (S !== yo) return; S.cargado = true; pintar(true); }, function (e) {
        if (S !== yo) return; S.error = e.message; pintar(true);
      });
      // Los nombres: al momento con lo guardado y, por detrás, del motor.
      ctx.llamar('camisetas5Nombres', []).then(function (n) { guardarLocal(ctx, 'nombres', n); if (S !== yo) return; S.N = n; pintar(false); }, function (e) {
        if (S === yo && !S.N) { S.errorN = e.message; pintar(false); }
      });
    },
    cerrar: function () {
      // T0258: la lista de cada árbitro para su Perfil, con lo último (el árbitro no lee los Excel de Camisetas).
      if (S) S.ctx.llamar('camisetas5ArbitroGuardar', []).catch(function () {});
      cerrarVentana(); S = null;
    }
  });
  if (ANCHO.addEventListener) ANCHO.addEventListener('change', function () { if (S && S.vista === 'stock') pintar(false); });

  /* ---------- lo guardado en este dispositivo ---------- */

  function claveLocal(ctx, k) { return 'cam5_' + String(ctx.correo || ctx.persona || '').toLowerCase() + '_' + k; }
  function leerLocal(ctx, k) { try { return JSON.parse(localStorage.getItem(claveLocal(ctx, k)) || 'null'); } catch (e) { return null; } }
  function guardarLocal(ctx, k, v) { try { if (v === null) localStorage.removeItem(claveLocal(ctx, k)); else localStorage.setItem(claveLocal(ctx, k), JSON.stringify(v)); } catch (e) {} }
  function guardarPref() { guardarLocal(S.ctx, 'pref', { vista: S.vista, modelo: S.modelo, comp: S.comp }); }

  /* ---------- datos ---------- */

  function D() { return { CAMISETAS: S.T.filas('CAMISETAS'), PEDIDOS: S.T.filas('PEDIDOS'), PEDIDOS_LINEAS: S.T.filas('PEDIDOS_LINEAS'), AJUSTES_STOCK: S.T.filas('AJUSTES_STOCK') }; }
  function porId(t) { var m = {}; S.T.filas(t).forEach(function (f) { m[String(f.ID)] = f; }); return m; }
  function color(id) { return S.T.fila('COLORES', id) || { ID: id, NOMBRE: id || '—' }; }
  function nombreColor(id) { return color(id).NOMBRE || id; }
  function punto(id) {
    var h = String(color(id).COLOR_HEX || '');
    // El color de la camiseta es un dato del Excel (COLORES.COLOR_HEX), no un color de la marca.
    return /^#[0-9a-f]{6}$/i.test(h) ? '<i class="cm-color" style="background:' + h + '" aria-hidden="true"></i>' : '';
  }
  /**
   * La camiseta dibujada: rellena de su color (COLORES.COLOR_HEX, un dato del Excel) y con el dorsal encima, en blanco o
   * en oscuro según lo claro que sea el color. Es lo que se reconoce de un vistazo en el campo.
   */
  function camiseta(c, peq) {
    var h = String(color(c.ID_COLOR).COLOR_HEX || ''), ok = /^#[0-9a-f]{6}$/i.test(h), claro = true;
    if (ok) { var r = parseInt(h.substr(1, 2), 16), g = parseInt(h.substr(3, 2), 16), b = parseInt(h.substr(5, 2), 16); claro = (r * 299 + g * 587 + b * 114) / 1000 > 150; }
    return '<span class="cm-cami' + (peq ? ' cm-cami-p' : '') + (claro ? ' cm-cami-clara' : '') + '" aria-hidden="true"' + (ok ? ' style="--cm-c:' + h + '"' : '') + '>' +
      '<svg viewBox="0 0 24 24"><path d="M6.5 3 1.5 6.2l2.1 4.2 2.9-1.1V21.5h11V9.3l2.9 1.1 2.1-4.2L17.5 3c-.7 1.7-2.8 2.8-5.5 2.8S7.2 4.7 6.5 3z"/></svg>' +
      '<b' + (String(c.DORSAL || '').length > 1 ? ' class="cm-cami-2"' : '') + '>' + texto(c.DORSAL || '–') + '</b></span>';
  }
  function nombreModelo(id) { var m = S.T.fila('MODELOS', id); return m ? m.NOMBRE || id : id; }
  function talla(c) { return [c.DORSAL ? 'Dorsal ' + c.DORSAL : 'Sin dorsal', c.TALLA].filter(String).join(' · '); }
  function cami(f) { return (f.DORSAL || '—') + ' · ' + (f.TALLA || '?'); }

  /** Quién lleva cada camiseta: { jugadora, equipo, ie, comp, compNombre, temp, liga, colorEq, baja } (de camisetas5Nombres). */
  function quien(c) {
    var N = S.N || { insc: {}, eq: {}, comp: {} };
    var i = N.insc[c.ID_INSCRIPCION_JUGADORA] || ['', '', '', ''], e = N.eq[i[1]] || ['', '', '', '', ''], k = N.comp[e[1]] || ['', ''];
    return { jugadora: i[0], dorsalJuego: i[2], ie: i[1], equipo: e[0], comp: e[1], compNombre: k[0], temp: k[1], liga: e[2], colorEq: e[3],
      baja: i[3] === 'Baja' || e[4] === 'Baja' };
  }
  function bajas() {
    var b = {};
    S.T.filas('CAMISETAS').forEach(function (c) { if (quien(c).baja) b[c.ID_INSCRIPCION_JUGADORA] = true; });
    return b;
  }
  /** Lo que toca con una camiseta: recuperar (baja con la camiseta dada o en un pack), quitar (baja sin ella) o su estado. */
  function situacion(c, q) {
    var e = c.ESTADO;
    if (q.baja && (e === 'Preparada' || e === 'Entregada')) return 'recuperar';
    if (q.baja && e !== 'Sin camiseta') return 'quitar';
    return e;
  }
  function hecha(s) { return s === 'Entregada' || s === 'Sin camiseta'; }

  /* ---------- pintar ---------- */

  function pintar(todo) {
    if (!S) return;
    var c = S.el.querySelector('#cm-cuerpo');
    if (!c) return;
    if (!S.cargado && !S.T.filas('CAMISETAS').length) {
      c.innerHTML = S.error ? '<p class="u-error">No se han podido leer las camisetas.</p><p class="u-nota">' + texto(S.error) + ' Vuelve a abrir Camisetas para probar otra vez.</p>' :
        '<div class="kz-centro cm-carga" role="status"><div class="u-carga"></div><span class="u-nota">Leyendo el Excel CAMISETAS…</span></div>';
      return;
    }
    c.onclick = c.onchange = null; // los pone Recuento
    var p = { entregas: pEntregas, stock: pStock, pedidos: pPedidos, recuento: pRecuento }[S.vista] || pEntregas;
    p(c, !!todo);
  }

  /** Modelos con camisetas (de más a menos jugadoras) y los del catálogo; elige el recordado o el primero. */
  function modelos() {
    var n = {};
    S.T.filas('CAMISETAS').forEach(function (c) { if (c.ESTADO !== 'Sin camiseta') n[c.ID_MODELO] = (n[c.ID_MODELO] || 0) + 1; });
    var l = S.T.filas('MODELOS').map(function (m) { return { id: String(m.ID), nombre: m.NOMBRE || m.ID, n: n[m.ID] || 0 }; });
    l.sort(function (a, b) { return b.n - a.n || (a.nombre < b.nombre ? -1 : 1); });
    if (!S.modelo || !l.some(function (m) { return m.id === S.modelo; })) S.modelo = l.length ? l[0].id : '';
    return l;
  }
  function selModelo() {
    var l = modelos();
    return '<label class="u-campo cm-modelo"><span class="u-etiqueta">Modelo</span><select id="cm-mod">' + l.map(function (m) {
      return '<option value="' + texto(m.id) + '"' + (m.id === S.modelo ? ' selected' : '') + '>' + texto(m.nombre) + '</option>';
    }).join('') + '</select></label>';
  }
  function engancharModelo(c) {
    var s = c.querySelector('#cm-mod');
    if (s) s.onchange = function () { S.modelo = s.value; guardarPref(); pintar(true); };
  }

  /* ======================= Entregas ======================= */

  /** Competiciones con camisetas, por temporada (la más reciente primero): [{ id, nombre, comps: [{ id, nombre }] }]. */
  function temporadas() {
    var N = S.N || { temp: [], comp: {} }, usadas = {}, porT = {};
    S.T.filas('CAMISETAS').forEach(function (c) { var q = quien(c); if (q.comp) usadas[q.comp] = q.temp; });
    Object.keys(usadas).forEach(function (k) { (porT[usadas[k]] = porT[usadas[k]] || []).push({ id: k, nombre: (N.comp[k] || [k])[0] }); });
    var orden = (N.temp || []).map(function (t) { return t[0]; });
    return Object.keys(porT).sort(function (a, b) { return (orden.indexOf(a) < 0 ? 999 : orden.indexOf(a)) - (orden.indexOf(b) < 0 ? 999 : orden.indexOf(b)); }).map(function (t) {
      var nt = (N.temp || []).filter(function (x) { return x[0] === t; })[0];
      return { id: t, nombre: nt ? nt[1] : t || 'Sin temporada', comps: porT[t].sort(function (a, b) { return a.nombre < b.nombre ? -1 : 1; }) };
    });
  }

  function pEntregas(c, todo) {
    if (!S.N) {
      c.innerHTML = S.errorN ? '<p class="u-error">No se han podido leer las jugadoras.</p><p class="u-nota">' + texto(S.errorN) + ' Comprueba que tienes conectados los Excel JUGADORAS Y EQUIPOS y COMPETICION y vuelve a abrir Camisetas.</p>' :
        '<div class="kz-centro cm-carga" role="status"><div class="u-carga"></div><span class="u-nota">Buscando las jugadoras de cada camiseta… La primera vez tarda un poco; después sale al momento.</span></div>';
      return;
    }
    var ts = temporadas();
    var vale = ts.some(function (t) { return S.comp === 'T:' + t.id || t.comps.some(function (k) { return S.comp === 'C:' + k.id; }); });
    if (!vale) S.comp = ts.length ? 'T:' + ts[0].id : '';
    if (todo || !c.querySelector('#cm-lista')) {
      c.innerHTML = '<div class="u-filtros cm-filtros"><label class="u-campo"><span class="u-etiqueta">Competición</span><select id="cm-comp">' + ts.map(function (t) {
        return '<optgroup label="' + texto(t.nombre) + '"><option value="T:' + texto(t.id) + '"' + (S.comp === 'T:' + t.id ? ' selected' : '') + '>Toda la temporada ' + texto(t.nombre) + '</option>' +
          t.comps.map(function (k) { return '<option value="C:' + texto(k.id) + '"' + (S.comp === 'C:' + k.id ? ' selected' : '') + '>' + texto(k.nombre) + '</option>'; }).join('') + '</optgroup>';
      }).join('') + '</select></label>' +
        '<label class="u-campo"><span class="u-etiqueta">Juegan</span><select id="cm-dia">' + opciones(DIAS_JUEGAN.map(function (d) { return [d[0], d[1]()]; }), S.dia || '') + '</select></label>' +
        '<label class="u-campo"><span class="u-etiqueta">Buscar</span><input type="search" id="cm-q" placeholder="Equipo, jugadora, dorsal, color o talla" value="' + texto(S.q) + '" autocomplete="off"></label></div>' +
        '<div id="cm-chips" class="cm-chips" role="group" aria-label="Qué camisetas"></div><div id="cm-lista"></div>';
      c.querySelector('#cm-comp').onchange = function () { S.comp = this.value; S.todo = {}; guardarPref(); pintar(false); };
      c.querySelector('#cm-q').oninput = function () { S.q = this.value; pintar(false); };
      c.querySelector('#cm-dia').onchange = function () { S.dia = this.value; S.todo = {}; pintar(false); };
      c.querySelector('#cm-chips').onclick = function (e) { var b = e.target.closest('[data-cm-f]'); if (b) { S.filtro = b.getAttribute('data-cm-f'); S.todo = {}; pintar(false); } };
      c.querySelector('#cm-lista').onclick = clicLista;
    }
    // Las camisetas de la competición elegida, con quién las lleva y qué toca.
    var base = [];
    S.T.filas('CAMISETAS').forEach(function (cm) {
      var q = quien(cm);
      if (S.comp === 'T:' + q.temp || S.comp === 'C:' + q.comp) base.push({ c: cm, q: q, s: situacion(cm, q) });
    });
    base = base.filter(function (x) { return !(x.q.baja && x.s === 'Sin camiseta'); });
    // «Juegan»: solo los equipos cuyo próximo partido cae ese día (camisetas5Nombres · prox).
    var rango = diaRango(S.dia), juega = function (ie) { var p = S.N.prox && S.N.prox[ie]; return p && p[0] >= rango[0] && p[0] <= rango[1]; };
    if (S.dia) base = base.filter(function (x) { return juega(x.q.ie); });
    var es = function (k) { return function (x) {
      return k === 'todas' ? true : k === 'hacer' ? x.s === 'recuperar' || x.s === 'quitar' : k === 'pendientes' ? !x.q.baja && !hecha(x.s) : x.s === k;
    }; };
    var qn = norm(S.q).trim();
    var busca = function (x) { return !qn || norm([x.q.equipo, x.q.jugadora, x.c.DORSAL, x.q.liga, nombreColor(x.c.ID_COLOR), x.c.TALLA].join(' ')).indexOf(qn) >= 0; };
    // Los contadores y el resumen cuentan solo lo que encaja con la búsqueda.
    var cuenta = function (k) { return base.filter(function (x) { return es(k)(x) && busca(x); }).length; };
    var chips = [['hacer', 'Para hacer'], ['pendientes', 'Por entregar']].concat(ESTADOS.map(function (e) { return [e[0], e[1]]; })).concat([['todas', 'Todas']])
      .map(function (x) { return [x[0], x[1], cuenta(x[0])]; })
      .filter(function (x) { return x[2] || x[0] === S.filtro || x[0] === 'pendientes' || x[0] === 'todas'; });
    c.querySelector('#cm-chips').innerHTML = chips.map(function (x) {
      return '<button type="button" class="cm-chip" data-cm-f="' + texto(x[0]) + '" aria-pressed="' + (S.filtro === x[0]) + '">' + texto(x[1]) + ' <span class="u-cifra">' + x[2] + '</span></button>';
    }).join('');

    var grupos = {}, orden = [];
    base.forEach(function (x) { var k = x.q.ie || '—'; if (!grupos[k]) { grupos[k] = []; orden.push(k); } grupos[k].push(x); });
    var eqs = orden.filter(function (k) { return grupos[k].some(function (x) { return es(S.filtro)(x) && busca(x); }); });
    var cuando = function (k) { var p = S.N.prox && S.N.prox[k]; return p ? p[0] + ' ' + (p[1] || '') : '9'; };
    eqs.sort(function (a, b) {
      // Con «Juegan», por la hora del partido: lo primero, lo que toca antes.
      if (S.dia && cuando(a) !== cuando(b)) return cuando(a) < cuando(b) ? -1 : 1;
      return norm(grupos[a][0].q.equipo) < norm(grupos[b][0].q.equipo) ? -1 : 1;
    });
    var faltan = cuenta('pendientes'), hacer = cuenta('hacer');
    var h = S.dia ? '<p class="cm-resumen">' + texto(DIAS_JUEGAN.filter(function (d) { return d[0] === S.dia; })[0][1]()) + ': juegan <b>' + plural(orden.length, 'equipo', 'equipos') + '</b>' +
        ' · <b class="cm-pintada">' + cuenta('Preparada') + '</b> para entregar · <b>' + cuenta('Por preparar') + '</b> para preparar' +
        (cuenta('Por pedir') + cuenta('Pedida') ? ' · ' + (cuenta('Por pedir') + cuenta('Pedida')) + ' sin camiseta todavía' : '') + '</p>' :
      '<p class="cm-resumen">' + (faltan ? 'Quedan <b class="cm-pintada">' + faltan + '</b> por entregar' : 'Todo entregado') +
      (hacer ? ' · <span class="u-mal">' + plural(hacer, 'camiseta de una baja', 'camisetas de bajas') + '</span>' : '') + '</p>';
    if (!eqs.length) {
      h += '<p class="u-vacio">' + (base.length ? (qn ? 'Ninguna camiseta de esta competición encaja con «' + texto(S.q) + '».' : 'No hay camisetas con este filtro. Prueba con «Todas».') :
        'Esta competición no tiene camisetas. Salen aquí en cuanto se apuntan las de sus jugadoras.') + '</p>';
    }
    h += '<div class="cm-eqs">' + eqs.map(function (k) {
      var todas = grupos[k].slice().sort(function (a, b) { return cam5Orden_(a.c, b.c) || (a.q.jugadora < b.q.jugadora ? -1 : 1); });
      var ver = S.todo[k] || S.filtro === 'todas' ? todas : todas.filter(function (x) { return es(S.filtro)(x) && busca(x); });
      var aDar = todas.filter(function (x) { return !x.q.baja && x.s !== 'Sin camiseta'; }), ent = aDar.filter(function (x) { return x.s === 'Entregada'; }).length;
      var prep = todas.filter(function (x) { return x.s === 'Preparada'; });
      var x0 = todas[0].q;
      return '<section class="cm-eq"><div class="cm-eq-cab"><h2 class="n-grupo">' + punto(x0.colorEq) + texto(x0.equipo || 'Sin equipo') +
        (x0.colorEq ? ' <span class="cm-eq-color">' + texto(nombreColor(x0.colorEq)) + '</span>' : '') + '</h2>' +
        '<span class="u-cifra' + (aDar.length && ent === aDar.length ? ' cm-ok' : '') + '">' + ent + ' de ' + aDar.length + '</span></div>' +
        '<div class="cm-barra" aria-hidden="true"><i style="width:' + (aDar.length ? Math.round(100 * ent / aDar.length) : 100) + '%"></i></div>' +
        '<p class="u-nota cm-eq-sub">' + texto([S.comp.charAt(0) === 'T' ? x0.compNombre : '', x0.liga].filter(String).join(' · ')) + '</p>' +
        htmlProximo(k, ent < aDar.length) +
        '<ul class="cm-jugs">' + ver.map(htmlJugadora).join('') + '</ul>' +
        '<div class="n-botones cm-eq-pie">' +
        (prep.length > 1 ? '<button type="button" class="u-btn" data-cm-todas="' + texto(k) + '">Entregar las ' + prep.length + ' preparadas</button>' : '') +
        (S.filtro !== 'todas' && (todas.length > ver.length || S.todo[k]) ? '<button type="button" class="u-btn u-btn-texto" data-cm-todo="' + texto(k) + '">' +
          (S.todo[k] ? 'Ver solo el filtro' : 'Ver todo el equipo (' + todas.length + ')') + '</button>' : '') + '</div></section>';
    }).join('') + '</div>';
    c.querySelector('#cm-lista').innerHTML = h;
  }

  var DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  /** 'aaaa-mm-dd' de hoy más n días. */
  function enDias(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  /** Opciones de «Juegan»: [valor, texto]. */
  var DIAS_JUEGAN = [['', function () { return 'Cualquier día'; }], ['hoy', function () { return 'Hoy (' + diaCorto(enDias(0)) + ')'; }],
    ['manana', function () { return 'Mañana (' + diaCorto(enDias(1)) + ')'; }], ['semana', function () { return 'Próximos 7 días'; }]];
  function diaRango(d) { return d === 'hoy' ? [enDias(0), enDias(0)] : d === 'manana' ? [enDias(1), enDias(1)] : d === 'semana' ? [enDias(0), enDias(6)] : ['', '9']; }
  /** «jue 30/10» de 'aaaa-mm-dd'. */
  function diaCorto(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); if (!m) return String(v || '');
    return DIAS[new Date(+m[1], +m[2] - 1, +m[3]).getDay()] + ' ' + m[3] + '/' + m[2];
  }
  /** El próximo partido del equipo (camisetas5Nombres · prox), si le quedan camisetas por entregar: cuándo y quién arbitra. */
  function htmlProximo(ie, faltan) {
    var p = faltan && S.N && S.N.prox && S.N.prox[ie];
    if (!p) return '';
    return '<p class="cm-prox">Próximo partido: <b>' + texto(diaCorto(p[0]) + (p[1] ? ' · ' + p[1] : '')) + '</b>' + (p[2] ? ' · ' + texto(p[2]) : '') +
      (p[3] ? ' · arbitra <b>' + texto(p[3]) + '</b>' : '') + '</p>';
  }

  function htmlJugadora(x) {
    var c = x.c, s = x.s, sig = siguiente(s);
    var est = s === 'recuperar' ? '<span class="n-estado n-e-bl">Por recuperar</span>' : s === 'quitar' ? '<span class="n-estado n-e-bl">Baja: quitar la camiseta</span>' : chipEstado(c.ESTADO);
    // Lo primero, la camiseta (color, dorsal y talla); la jugadora, debajo.
    return '<li class="cm-jug' + (c._pendiente ? ' cm-guardando' : '') + '"><button type="button" class="cm-jug-n" data-cm-cam="' + texto(c.ID) + '"' +
      ' aria-label="' + texto([c.DORSAL ? 'Dorsal ' + c.DORSAL : 'Sin dorsal', c.TALLA, nombreColor(c.ID_COLOR), x.q.jugadora].filter(String).join(', ')) + '">' +
      camiseta(c) + '<span class="cm-jug-t"><span class="cm-jug-c">' + texto((c.DORSAL || '–') + (c.TALLA || '?')) + '</span>' +
      '<span class="cm-jug-p">' + texto(x.q.jugadora || c.ID_INSCRIPCION_JUGADORA) + '</span>' +
      '<span class="cm-jug-e">' + est + (c._pendiente ? ' <span class="u-nota">Guardando…</span>' : c.ESTADO === 'Entregada' && c.FECHA_ENTREGA ? ' <span class="u-nota">' + fecha(c.FECHA_ENTREGA) + '</span>' : '') + '</span></span></button>' +
      (sig ? '<button type="button" class="u-btn cm-sig' + (sig[2] ? ' cm-sig-' + sig[2] : '') + '" data-cm-sig="' + texto(c.ID) + '"' +
        (sig[2] ? ' aria-label="' + texto(sig[1] + ' la camiseta de ' + (x.q.jugadora || c.ID)) + '"' : '') + '>' + texto(sig[1]) + '</button>' : '') + '</li>';
  }
  /**
   * El paso siguiente desde la lista: [estado al que pasa, verbo del botón, color de ese estado]. El botón dice lo que va a
   * hacer (Preparar, Entregar) y lleva el color del estado al que lleva, el mismo que el cuadrado de la jugadora cuando ya
   * está así. Recuperar y Quitar abren la ficha: no se hacen de un toque.
   */
  function siguiente(s) {
    return s === 'Por preparar' ? ['Preparada', 'Preparar', 'ec'] : s === 'Preparada' ? ['Entregada', 'Entregar', 'co'] :
      s === 'recuperar' ? ['ficha', 'Recuperar'] : s === 'quitar' ? ['ficha', 'Quitar'] : null;
  }

  function clicLista(e) {
    var b = e.target.closest('button');
    if (!b) return;
    var id;
    if ((id = b.getAttribute('data-cm-sig'))) {
      var c = S.T.fila('CAMISETAS', id); if (!c) return;
      var sig = siguiente(situacion(c, quien(c)));
      if (!sig) return;
      if (sig[0] === 'ficha') ventanaCamiseta(c); else marcar(c, sig[0], true);
    } else if ((id = b.getAttribute('data-cm-cam'))) {
      var f = S.T.fila('CAMISETAS', id); if (f) ventanaCamiseta(f);
    } else if ((id = b.getAttribute('data-cm-todo'))) {
      S.todo[id] = !S.todo[id]; pintar(false);
    } else if ((id = b.getAttribute('data-cm-todas'))) {
      ventanaEntregarEquipo(id);
    }
  }

  /** Preparada, Entregada, Por preparar o Sin camiseta: directo a la tabla, al momento. Con aviso, se puede deshacer. */
  function marcar(c, estado, conAviso) {
    var antes = { ESTADO: c.ESTADO, FECHA_ENTREGA: c.FECHA_ENTREGA || '' };
    var cambios = { ESTADO: estado, FECHA_ENTREGA: estado === 'Entregada' ? (c.ESTADO === 'Entregada' && c.FECHA_ENTREGA ? c.FECHA_ENTREGA : hoy()) : '' };
    if (conAviso) avisoDeshacer((quien(c).jugadora || c.ID) + ': ' + estado.toLowerCase() + '.', [[c.ID, cambios, antes]]);
    return S.T.actualizar('CAMISETAS', c.ID, cambios).catch(function () {});
  }

  /**
   * Un toque sin querer no puede perder una camiseta: cada marca deja abajo, unos segundos, «Deshacer», que la vuelve a
   * dejar como estaba (si nadie la ha cambiado mientras). l: [[ID, cambios hechos, como estaba]].
   */
  var tDeshacer = 0;
  function avisoDeshacer(t, l) {
    var d = S.el.querySelector('.cm-deshacer');
    if (!d) { d = document.createElement('div'); d.className = 'cm-deshacer'; d.setAttribute('role', 'status'); S.el.appendChild(d); }
    d.innerHTML = '<span>' + texto(t) + '</span><button type="button" class="u-btn u-btn-texto">Deshacer</button>';
    d.hidden = false;
    clearTimeout(tDeshacer);
    tDeshacer = setTimeout(function () { d.hidden = true; }, 15000);
    d.querySelector('button').onclick = function () {
      clearTimeout(tDeshacer); d.hidden = true;
      l.forEach(function (x) {
        var f = S.T.fila('CAMISETAS', x[0]);
        // Solo si sigue como la dejó este toque: no se pisa lo que haya cambiado otra persona.
        if (f && f.ESTADO === x[1].ESTADO) S.T.actualizar('CAMISETAS', x[0], x[2]).catch(function () {});
      });
      S.ctx.aviso(l.length === 1 ? 'Deshecho: vuelve a estar ' + l[0][2].ESTADO.toLowerCase() + '.' : 'Deshecho: ' + plural(l.length, 'camiseta vuelve', 'camisetas vuelven') + ' a como estaban.');
    };
  }

  /** Entregar las preparadas de un equipo: antes, la lista para revisarla (se puede quitar alguna). */
  function ventanaEntregarEquipo(ie) {
    var l = S.T.filas('CAMISETAS').filter(function (x) { var q = quien(x); return x.ESTADO === 'Preparada' && q.ie === ie && !q.baja; })
      .sort(function (a, b) { return cam5Orden_(a, b); });
    if (!l.length) return;
    var eq = quien(l[0]).equipo;
    var v = ventana('<h2>Entregar a ' + texto(eq) + '</h2><p class="u-nota">Marca como entregadas las camisetas preparadas de este equipo. Quita las que no estés entregando ahora.</p>' +
      '<ul class="cm-lista-ok">' + l.map(function (c) {
        return '<li><label class="u-check cm-ok-c"><input type="checkbox" checked data-cm-id="' + texto(c.ID) + '"> ' + camiseta(c, true) +
          '<span><b>' + texto((c.DORSAL || '–') + (c.TALLA || '?')) + '</b> <span class="u-nota">' + texto(quien(c).jugadora || c.ID) + '</span></span></label></li>';
      }).join('') + '</ul>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="ce-ok"></button><button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cancelar</button></div>');
    var ok = v.querySelector('#ce-ok');
    var marcadas = function () { return [].filter.call(v.querySelectorAll('[data-cm-id]'), function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-cm-id'); }); };
    var cuenta = function () { var n = marcadas().length; ok.disabled = !n; ok.textContent = n ? 'Entregar ' + plural(n, 'camiseta', 'camisetas') : 'Elige alguna camiseta'; };
    v.onchange = cuenta; cuenta();
    ok.onclick = function () {
      var ids = marcadas(), f = hoy(), hechos = [];
      cerrarVentana();
      ids.forEach(function (id) {
        var c = S.T.fila('CAMISETAS', id);
        if (!c || c.ESTADO !== 'Preparada') return;
        hechos.push([id, { ESTADO: 'Entregada', FECHA_ENTREGA: f }, { ESTADO: c.ESTADO, FECHA_ENTREGA: c.FECHA_ENTREGA || '' }]);
        S.T.actualizar('CAMISETAS', id, { ESTADO: 'Entregada', FECHA_ENTREGA: f }).catch(function () {});
      });
      if (hechos.length) avisoDeshacer(eq + ': ' + plural(hechos.length, 'camiseta entregada', 'camisetas entregadas') + '.', hechos);
    };
  }
  /** No llegó o Defectuosa: con su −1 en el stock (camisetas5Marcar). */
  function marcarMotor(c, estado) {
    return S.T.actualizar('CAMISETAS', c.ID, { ESTADO: estado, ID_PEDIDO: '', FECHA_ENTREGA: '' }, { fn: 'camisetas5Marcar', args: [c.ID, estado, c.ESTADO] }).catch(function () {});
  }
  /** T0248: vuelve al local (Sin camiseta) y, si vuelve rota, su −1 (camisetas5Recuperar). */
  function recuperar(c, rota) {
    return S.T.actualizar('CAMISETAS', c.ID, { ESTADO: 'Sin camiseta', FECHA_ENTREGA: '' }, { fn: 'camisetas5Recuperar', args: [c.ID, !!rota, c.ESTADO] }).catch(function () {});
  }

  /* ---------- ventanas ---------- */

  var velo = null;
  function ventana(html, alAbrir) {
    if (!velo) {
      velo = document.createElement('div');
      velo.className = 'u-velo';
      velo.innerHTML = '<div class="u-ventana n-ventana" role="dialog" aria-modal="true"></div>';
      velo.addEventListener('click', function (e) { if (e.target === velo || e.target.closest('[data-cm-cerrar]')) cerrarVentana(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && velo.classList.contains('abierto')) cerrarVentana(); });
      document.body.appendChild(velo);
    }
    var v = velo.firstChild;
    v.innerHTML = html;
    velo.classList.add('abierto');
    if (alAbrir) alAbrir(v);
    var p = v.querySelector('select, input:not([type=checkbox]):not([type=radio]), button');
    if (p) p.focus();
    return v;
  }
  function cerrarVentana() { if (velo) { velo.classList.remove('abierto'); velo.firstChild.innerHTML = ''; } }
  function campo(et, html) { return '<label class="u-campo"><span class="u-etiqueta">' + et + '</span>' + html + '</label>'; }
  function opciones(l, v) { return l.map(function (o) { o = [].concat(o); return '<option value="' + texto(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + texto(o.length > 1 ? o[1] : o[0]) + '</option>'; }).join(''); }
  function dl(pares) { return '<dl class="cm-dl">' + pares.filter(function (p) { return p[1]; }).map(function (p) { return '<dt>' + p[0] + '</dt><dd>' + p[1] + '</dd>'; }).join('') + '</dl>'; }

  /** Una camiseta: sus datos y lo que se puede hacer con ella. */
  /**
   * El historial de una camiseta, del más antiguo al último, para contestar «¿cuándo me la disteis?»: cuándo se pidió y
   * llegó su pedido (PEDIDOS) y cada cambio de su fila con fecha, hora y quién (CAMISETAS · LOG, «dd/mm/aaaa hh:mm ·
   * persona · qué»). La fecha de entrega sale aunque no esté en el LOG (las de antes de la web nueva).
   * [{ f: 'aaaa-mm-dd hh:mm', dia: 'dd/mm/aaaa', hora, que, quien, estado }]
   */
  function historial(c) {
    var ev = [], ped = c.ID_PEDIDO ? S.T.fila('PEDIDOS', c.ID_PEDIDO) : null, entregaEnLog = false;
    var iso = function (d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; };
    var mas = function (f, hora, que, quien, estado) { if (f) ev.push({ f: f + ' ' + (hora || '00:00'), dia: fecha(f), hora: hora || '', que: que, quien: quien || '', estado: estado || '' }); };
    if (ped) {
      mas(iso(ped.FECHA_PEDIDO), '', 'al proveedor' + (ped.ID_PROVEEDOR ? ' ' + nombreProveedor(ped.ID_PROVEEDOR) : '') + ' en el pedido ' + ped.ID, '', 'Pedida');
      mas(iso(ped.FECHA_RECIBIDO), '', 'llegó el pedido ' + ped.ID + ' al local', '', 'Por preparar');
    }
    String(c.LOG || '').split('\n').forEach(function (l) {
      var m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}:\d{2})\s+·\s+([^·]+?)\s+·\s+(.*)$/.exec(l.trim());
      if (!m) return;
      var f = m[3] + '-' + m[2] + '-' + m[1], quien = m[5], que = m[6], est = /ESTADO:\s*([^→;]*?)\s*→\s*([^;]+)/.exec(que);
      if (/^Migración/i.test(quien)) { mas(f, m[4], 'Pasada de los Excel antiguos a la web nueva', '', ''); return; }
      if (est) {
        var a = est[2].trim();
        if (a === 'Entregada') entregaEnLog = true;
        mas(f, m[4], (est[1].trim() && est[1].trim() !== '—' ? 'antes ' + est[1].trim() : '') +
          (/árbitro/i.test(que) ? ' · ' + que.split(' · ')[0] : ''), quien, a);
      } else if (!/^FECHA_ENTREGA/.test(que)) mas(f, m[4], que.replace(/\s*·\s*$/, ''), quien, '');
    });
    if (c.FECHA_ENTREGA && !entregaEnLog) mas(iso(c.FECHA_ENTREGA) || '', '', '', '', 'Entregada');
    return ev.sort(function (a, b) { return a.f < b.f ? -1 : a.f > b.f ? 1 : 0; });
  }
  function htmlHistorial(c) {
    var h = historial(c);
    return '<h3 class="cm-sub">Historial</h3>' + (h.length ? '<ol class="cm-hist">' + h.map(function (e) {
      return '<li' + (e.estado === 'Entregada' ? ' class="cm-hist-ent"' : '') + '><span class="cm-hist-f">' + texto(e.dia) + (e.hora ? ' · ' + texto(e.hora) : '') + '</span>' +
        '<span>' + (e.estado ? chipEstado(e.estado) + ' ' : '') + texto(e.que) + (e.quien ? ' <span class="u-nota">· ' + texto(e.quien) + '</span>' : '') + '</span></li>';
    }).join('') + '</ol>' : '<p class="u-nota">Sin cambios apuntados todavía.</p>');
  }

  function ventanaCamiseta(c) {
    var q = quien(c), s = situacion(c, q), e = c.ESTADO;
    var botones = [];
    if (s === 'recuperar') {
      botones.push(['recuperar', e === 'Entregada' ? 'La han devuelto' : 'Quitada del pack', true]);
    } else if (s === 'quitar') {
      botones.push(['Sin camiseta', 'Quitar la camiseta', true]);
    } else {
      if (e === 'Por preparar' || e === 'Entregada') botones.push(['Preparada', 'Marcar preparada']);
      if (e === 'Por preparar' || e === 'Preparada') botones.push(['Entregada', 'Marcar entregada']);
      if (e === 'Preparada' || e === 'Entregada') botones.push(['Por preparar', 'Volver a Por preparar']);
      if (e !== 'No llegó' && e !== 'Sin camiseta') botones.push(['No llegó', 'Marcar no llegó']);
      if (e !== 'Defectuosa' && e !== 'Sin camiseta') botones.push(['Defectuosa', 'Marcar defectuosa']);
      if (e !== 'Sin camiseta') botones.push(['Sin camiseta', 'Marcar sin camiseta']);
    }
    var ped = c.ID_PEDIDO ? S.T.fila('PEDIDOS', c.ID_PEDIDO) : null;
    var v = ventana('<h2>' + texto(q.jugadora || c.ID_INSCRIPCION_JUGADORA) + '</h2>' +
      dl([['Equipo', texto([q.equipo, q.compNombre].filter(String).join(' · '))], ['Camiseta', punto(c.ID_COLOR) + texto(nombreColor(c.ID_COLOR) + ' · ' + talla(c))],
        ['Modelo', texto(nombreModelo(c.ID_MODELO))], ['Estado', s === 'recuperar' ? '<span class="n-estado n-e-bl">Por recuperar</span> ' + texto('(' + e + ')') : chipEstado(e)],
        ['Pedido', ped ? texto(c.ID_PEDIDO + (ped.FECHA_RECIBIDO ? ' · llegó el ' + fecha(ped.FECHA_RECIBIDO) : ' · aún no ha llegado')) : ''],
        ['Entregada', c.FECHA_ENTREGA ? '<b>' + texto(fecha(c.FECHA_ENTREGA)) + '</b>' : ''], ['Inscripción', q.baja ? '<span class="u-mal">De baja</span>' : '']]) +
      htmlHistorial(c) +
      (s === 'recuperar' ? '<p class="u-nota">La inscripción está de baja y su camiseta está ' + (e === 'Entregada' ? 'entregada: hay que pedírsela al equipo.' : 'en un pack: hay que sacarla.') +
        ' Al recuperarla vuelve al local como libre.</p><label class="u-check"><input type="checkbox" id="cm-rota"> Vuelve rota (cuenta como defectuosa)</label>' :
        s === 'quitar' ? '<p class="u-nota">La inscripción está de baja: a esta jugadora ya no se le dará camiseta. Al quitarla deja de contar como pendiente y, si estaba asignada en el local, vuelve a quedar libre.</p>' :
        '<p class="u-nota">No llegó y Defectuosa la vuelven a dejar por pedir y, si estaba en el local, apuntan su −1 en el stock. Sin camiseta: a esta jugadora no se le hará.</p>') +
      '<div class="n-botones cm-marcas">' + botones.map(function (b) {
        return '<button type="button" class="u-btn' + (b[2] ? ' u-btn-accion' : '') + '" data-cm-m="' + texto(b[0]) + '">' + texto(b[1]) + '</button>';
      }).join('') + '<button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cerrar</button></div>');
    v.querySelector('.cm-marcas').onclick = function (ev) {
      var b = ev.target.closest('[data-cm-m]'); if (!b) return;
      var m = b.getAttribute('data-cm-m'), f = S.T.fila('CAMISETAS', c.ID) || c, rota = v.querySelector('#cm-rota');
      cerrarVentana();
      if (m === 'recuperar') recuperar(f, rota && rota.checked);
      else if (m === 'No llegó' || m === 'Defectuosa') marcarMotor(f, m);
      else marcar(f, m, true);
    };
  }

  /* ======================= Stock ======================= */

  function pStock(c) {
    var st = cam5Stock_(D(), S.modelo || (modelos()[0] || {}).id), k = S.verStock;
    var val = function (f) { return k === 'libres' ? f.libres : f.local; };
    var fm = st.filter(function (f) { return val(f) !== 0; });
    var neg = st.filter(function (f) { return f.local < 0; }).length;
    var total = fm.reduce(function (s, f) { return s + val(f); }, 0);
    var h = '<div class="u-filtros cm-filtros">' + selModelo() + '<div class="cm-sw" role="group" aria-label="Qué camisetas">' +
      [['libres', 'Libres'], ['local', 'Sueltas']].map(function (x) { return '<button type="button" class="cm-chip" data-cm-ver="' + x[0] + '" aria-pressed="' + (k === x[0]) + '">' + x[1] + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="n-botones cm-acciones"><button type="button" class="u-btn u-btn-accion" id="cm-sacar">Sacar del local</button><button type="button" class="u-btn" id="cm-arec">Hacer recuento</button></div>' +
      '<p class="u-nota">' + (k === 'libres' ? '<b>Libres</b>: las sueltas que no son de nadie; se pueden dar a cualquier jugadora.' :
        '<b>Sueltas</b>: las que hay en la caja del local, sin bolsa. Incluye las <b>asignadas</b> a una jugadora (Por preparar): ya son suyas, pero aún hay que meterlas en su bolsa. Las Preparadas ya están en su bolsa y no cuentan aquí.') +
      ' Sueltas = las de los pedidos que han llegado, menos las preparadas y entregadas, más o menos los ajustes (recuentos y sacadas).</p>' +
      (neg ? '<p class="u-mal">' + plural(neg, 'combinación no cuadra', 'combinaciones no cuadran') + ' (en negativo): consta que han salido más camisetas de las que han llegado. ' +
        'Pasa con una camiseta que ya estaba antes de la web, un pedido sin marcar «Ha llegado» o una marcada por error. El recuento lo corrige con lo que haya de verdad.</p>' : '');
    if (!fm.length) h += '<p class="u-vacio">' + (k === 'libres' ? 'No hay camisetas libres de ' : 'No hay camisetas sueltas de ') + texto(nombreModelo(S.modelo)) + '. Cuando llegue un pedido, sus camisetas salen aquí.</p>';
    else {
      h += '<h2 class="n-grupo">' + texto(nombreModelo(S.modelo)) + ' <span class="u-cifra">' + total + '</span></h2>';
      var cols = [], camis = [];
      fm.forEach(function (f) { if (cols.indexOf(f.ID_COLOR) < 0) cols.push(f.ID_COLOR); var x = cami(f); if (camis.indexOf(x) < 0) camis.push(x); });
      var porCami = {}; fm.forEach(function (f) { porCami[cami(f)] = f; });
      camis.sort(function (a, b) { return cam5Orden_(porCami[a], porCami[b]); });
      var celda = function (col, ca) { var f = fm.filter(function (x) { return x.ID_COLOR === col && cami(x) === ca; })[0]; return f ? val(f) : 0; };
      if (ANCHO.matches) {
        h += '<div class="u-tabla-caja"><table class="u-tabla cm-cuadro"><thead><tr><th>Color</th>' + camis.map(function (ca) { return '<th class="num">' + texto(ca) + '</th>'; }).join('') +
          '<th class="num">Total</th></tr></thead><tbody>' + cols.map(function (col) {
            var t = 0;
            return '<tr><td class="u-tabla-t">' + punto(col) + texto(nombreColor(col)) + '</td>' + camis.map(function (ca) { var n = celda(col, ca); t += n; return '<td class="num' + (n < 0 ? ' u-mal' : '') + '">' + (n || '') + '</td>'; }).join('') +
              '<td class="num"><b>' + t + '</b></td></tr>';
          }).join('') + '</tbody></table></div>';
      } else {
        h += cols.map(function (col) {
          var l = fm.filter(function (f) { return f.ID_COLOR === col; }).sort(cam5Orden_);
          return '<section class="cm-color-b"><h3>' + punto(col) + texto(nombreColor(col)) + ' <span class="u-cifra">' + l.reduce(function (s, f) { return s + val(f); }, 0) + '</span></h3>' +
            '<ul class="cm-celdas">' + l.map(function (f) { return '<li' + (val(f) < 0 ? ' class="u-mal"' : '') + '><span>' + texto(cami(f)) + '</span><b class="u-cifra">' + val(f) + '</b></li>'; }).join('') + '</ul></section>';
        }).join('');
      }
    }
    c.innerHTML = h;
    engancharModelo(c);
    c.querySelector('.cm-sw').onclick = function (e) { var b = e.target.closest('[data-cm-ver]'); if (b) { S.verStock = b.getAttribute('data-cm-ver'); pintar(false); } };
    c.querySelector('#cm-sacar').onclick = function () { ventanaSacar(st); };
    c.querySelector('#cm-arec').onclick = function () { irA('recuento'); };
  }
  function irA(v) {
    S.vista = v; guardarPref();
    [].forEach.call(S.el.querySelectorAll('[data-cm-vista]'), function (x) { x.setAttribute('aria-selected', x.getAttribute('data-cm-vista') === v); });
    window.scrollTo(0, 0); document.body.scrollTop = 0; pintar(true);
  }

  /** T0247 · Sacar del local: una regalada, donada, perdida o defectuosa, en el momento. */
  function ventanaSacar(st) {
    var enLocal = st.filter(function (f) { return f.local > 0; });
    var cols = []; enLocal.forEach(function (f) { if (cols.indexOf(f.ID_COLOR) < 0) cols.push(f.ID_COLOR); });
    if (!cols.length) cols = S.T.filas('COLORES').map(function (x) { return String(x.ID); });
    var v = ventana('<h2>Sacar del local</h2><p class="u-nota">' + texto(nombreModelo(S.modelo)) + '. Para las camisetas que salen sin ir a una jugadora: se apuntan en el stock con tu nombre.</p>' +
      '<div class="u-campos">' + campo('Color', '<select id="sc-col">' + opciones(cols.map(function (x) { return [x, nombreColor(x)]; }), cols[0]) + '</select>') +
      campo('Dorsal y talla', '<select id="sc-cami"></select>') +
      '<div class="cm-dos" id="sc-otra" hidden>' + campo('Dorsal', '<input type="text" id="sc-dor" inputmode="numeric" maxlength="4">') + campo('Talla', '<select id="sc-tal">' + opciones(CAM5_TALLAS, 'M') + '</select>') + '</div>' +
      campo('Cuántas', '<input type="number" id="sc-n" min="1" step="1" value="1" inputmode="numeric">') +
      '<fieldset class="cm-tipos"><legend class="u-etiqueta">Por qué sale</legend>' + SALIDAS.map(function (t, i) {
        return '<label class="u-check"><input type="radio" name="sc-tipo" value="' + t + '"' + (i ? '' : ' checked') + '> ' + t + '</label>';
      }).join('') + '</fieldset>' +
      campo('Nota (opcional)', '<input type="text" id="sc-nota" maxlength="120" placeholder="A quién o qué ha pasado">') + '</div>' +
      '<p class="u-error" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="sc-ok">Sacar del local</button><button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cancelar</button></div>');
    var col = v.querySelector('#sc-col'), ca = v.querySelector('#sc-cami');
    var llenar = function () {
      var l = enLocal.filter(function (f) { return f.ID_COLOR === col.value; });
      ca.innerHTML = l.map(function (f) { return '<option value="' + texto(f.DORSAL + '|' + f.TALLA) + '">' + texto(cami(f) + ' · hay ' + f.local) + '</option>'; }).join('') + '<option value="">Otra (no sale en el stock)</option>';
      v.querySelector('#sc-otra').hidden = !!ca.value;
    };
    col.onchange = llenar; ca.onchange = function () { v.querySelector('#sc-otra').hidden = !!ca.value; };
    llenar();
    v.querySelector('#sc-ok').onclick = function () {
      var n = Number(v.querySelector('#sc-n').value), p = ca.value ? ca.value.split('|') : [v.querySelector('#sc-dor').value.trim(), v.querySelector('#sc-tal').value];
      var tipo = (v.querySelector('input[name=sc-tipo]:checked') || {}).value || 'Otro', nota = v.querySelector('#sc-nota').value.trim(), err = v.querySelector('.u-error');
      if (!(n >= 1 && n === Math.round(n))) { err.textContent = 'Cuántas: un número entero, 1 o más.'; err.hidden = false; return; }
      if (!p[1]) { err.textContent = 'Falta la talla.'; err.hidden = false; return; }
      cerrarVentana();
      S.T.crear('AJUSTES_STOCK', { FECHA: hoy(), ID_MODELO: S.modelo, ID_COLOR: col.value, DORSAL: p[0], TALLA: p[1], CANTIDAD: -n, TIPO: tipo,
        MOTIVO: (nota ? tipo + ': ' + nota : tipo) + ' · ' + S.ctx.persona }).then(function () {
        S.ctx.aviso(plural(n, 'camiseta sacada', 'camisetas sacadas') + ' del local (' + tipo.toLowerCase() + ').');
      }, function () {});
    };
  }

  /* ======================= Pedidos ======================= */

  function pPedidos(c) {
    var m = S.modelo || (modelos()[0] || {}).id, Dd = D();
    var h = '<div class="u-filtros cm-filtros">' + selModelo() + '</div>';
    // Lo que falta de este modelo: con una libre en el local, o a pedir.
    var plan = S.N ? cam5Plan_(Dd, m, bajas()) : null;
    h += '<section class="u-bloque cm-pedir"><h2 class="n-grupo">Lo que falta</h2>';
    if (!plan) h += '<p class="u-nota">Buscando qué jugadoras están de baja para no pedirles camiseta…</p>';
    else if (!plan.local.length && !plan.pedir.length) h += '<p class="u-vacio">No falta ninguna camiseta de ' + texto(nombreModelo(m)) + ': todas están pedidas, en el local o entregadas.</p>';
    else {
      h += '<p>' + [plan.local.length ? plural(plan.local.length, 'tiene una libre igual en el local', 'tienen una libre igual en el local') : '',
        plan.pedir.length ? plural(plan.pedir.length, 'hay que pedirla', 'hay que pedirlas') : ''].filter(String).join(' · ') + '.</p>' +
        '<div class="n-botones">' + (plan.local.length ? '<button type="button" class="u-btn" id="cm-libres">Dar ' + plural(plan.local.length, 'libre', 'libres') + ' del local</button>' : '') +
        (plan.pedir.length ? '<button type="button" class="u-btn u-btn-accion" id="cm-pedir">Preparar pedido de ' + plan.pedir.length + '</button>' : '') + '</div>';
    }
    h += '</section>';
    var lineas = {}, jug = {};
    Dd.PEDIDOS_LINEAS.forEach(function (l) { (lineas[l.ID_PEDIDO] = lineas[l.ID_PEDIDO] || []).push(l); });
    Dd.CAMISETAS.forEach(function (x) { if (x.ID_PEDIDO) { var j = jug[x.ID_PEDIDO] = jug[x.ID_PEDIDO] || {}; j[x.ESTADO] = (j[x.ESTADO] || 0) + 1; } });
    var peds = Dd.PEDIDOS.filter(function (p) { return String(p.ID_MODELO) === String(m); })
      .sort(function (a, b) { return String(b.FECHA_PEDIDO || '') < String(a.FECHA_PEDIDO || '') ? -1 : String(b.FECHA_PEDIDO || '') > String(a.FECHA_PEDIDO || '') ? 1 : String(b.ID) < String(a.ID) ? -1 : 1; });
    h += '<h2 class="n-grupo">Pedidos de ' + texto(nombreModelo(m)) + ' <span class="u-cifra">' + peds.length + '</span></h2>';
    if (!peds.length) h += '<p class="u-vacio">Este modelo no tiene pedidos' + (plan && plan.pedir.length ? '. Con «Preparar pedido» se hace el primero con lo que falta.' : ' todavía.') + '</p>';
    h += '<ul class="cm-peds">' + peds.map(function (p) { return htmlPedido(p, lineas[p.ID] || [], jug[p.ID] || {}); }).join('') + '</ul>';
    h += htmlModelos() + htmlProveedores();
    c.innerHTML = h;
    engancharModelo(c);
    var bl = c.querySelector('#cm-libres'), bp = c.querySelector('#cm-pedir');
    if (bl) bl.onclick = function () { darLibres(bl, m); };
    if (bp) bp.onclick = function () { ventanaPedir(m, plan); };
    c.querySelector('.cm-mods').onclick = function (e) {
      var b = e.target.closest('[data-cm-mod]'); if (b) ventanaModelo(b.getAttribute('data-cm-mod'));
    };
    c.querySelector('.cm-provs').onclick = function (e) {
      var b = e.target.closest('[data-cm-prov]'); if (b) ventanaProveedor(b.getAttribute('data-cm-prov'));
    };
    c.querySelector('.cm-peds').onclick = function (e) {
      var b = e.target.closest('[data-cm-p]'); if (!b) return;
      var id = b.getAttribute('data-cm-p'), acc = b.getAttribute('data-cm-acc');
      if (acc === 'extracto') ventanaExtracto(id);
      else if (acc === 'factura') ventanaFactura(id);
      else if (acc === 'confirmar') S.T.actualizar('PEDIDOS', id, { CONFIRMADO: true }).catch(function () {});
      else if (acc === 'llegado') {
        var f = hoy();
        S.T.actualizar('PEDIDOS', id, { FECHA_RECIBIDO: f }, { fn: 'camisetas5Recibir', args: [id, f] }).then(function (r) {
          var n = ((r.otras || {}).CAMISETAS || []).length;
          S.ctx.aviso('Pedido ' + id + ' en el local' + (n ? ': ' + plural(n, 'camiseta pasa', 'camisetas pasan') + ' a Por preparar.' : '.'));
        }, function () {});
      }
    };
  }

  var PASOS = { sinConfirmar: ['Sin confirmar', 'pr'], confirmado: ['Esperando al proveedor', 'ec'], recibido: ['En el local', 'co'] };
  function htmlPedido(p, lineas, jug) {
    var paso = cam5Paso_(p), unidades = lineas.reduce(function (s, l) { return s + (Number(l.CANTIDAD) || 0); }, 0);
    var porColor = {}, orden = [];
    lineas.slice().sort(cam5Orden_).forEach(function (l) {
      if (!porColor[l.ID_COLOR]) { porColor[l.ID_COLOR] = { n: 0, t: {} }; orden.push(l.ID_COLOR); }
      porColor[l.ID_COLOR].n += Number(l.CANTIDAD) || 0;
      porColor[l.ID_COLOR].t[l.TALLA] = (porColor[l.ID_COLOR].t[l.TALLA] || 0) + (Number(l.CANTIDAD) || 0);
    });
    var nuevo = !!p._nueva;
    return '<li class="cm-ped' + (p._pendiente ? ' cm-guardando' : '') + '"><div class="cm-ped-cab"><b>' + texto(nuevo ? 'Pedido nuevo' : p.ID) + '</b>' +
      '<span class="n-estado n-e-' + PASOS[paso][1] + '">' + PASOS[paso][0] + '</span></div>' +
      '<p class="u-nota">' + texto([p.FECHA_PEDIDO ? 'Pedido el ' + fecha(p.FECHA_PEDIDO) : '', unidades ? plural(unidades, 'camiseta', 'camisetas') : '',
        p.FECHA_ESTIMADA && paso !== 'recibido' ? 'Llega hacia el ' + fecha(p.FECHA_ESTIMADA) : '', p.FECHA_RECIBIDO ? 'Llegó el ' + fecha(p.FECHA_RECIBIDO) : ''].filter(String).join(' · ')) + '</p>' +
      (orden.length ? '<ul class="cm-ped-l">' + orden.map(function (col) {
        var x = porColor[col];
        return '<li>' + punto(col) + '<b>' + texto(nombreColor(col)) + '</b> <span class="u-cifra">' + x.n + '</span> <span class="u-nota">' +
          CAM5_TALLAS.concat(Object.keys(x.t).filter(function (t) { return CAM5_TALLAS.indexOf(t) < 0; })).filter(function (t) { return x.t[t]; }).map(function (t) { return t + ' ' + x.t[t]; }).join(' · ') + '</span></li>';
      }).join('') + '</ul>' : '') +
      (Object.keys(jug).length ? '<p class="u-nota">Jugadoras: ' + Object.keys(jug).map(function (e) {
        var x = ESTADOS.filter(function (y) { return y[0] === e; })[0];
        return jug[e] + ' ' + (jug[e] === 1 || !x ? e : x[1]).toLowerCase();
      }).join(' · ') + '</p>' : '') +
      (p.ID_PROVEEDOR ? '<p class="u-nota">Proveedor: ' + texto(nombreProveedor(p.ID_PROVEEDOR)) + '</p>' : '') +
      htmlCoste(p) +
      (paso !== 'recibido' && !p._nueva && (jug['Por preparar'] || jug['Preparada'] || jug['Entregada']) ?
        '<p class="u-mal">Tiene camisetas ya en el local (por preparar, preparadas o entregadas) y el pedido no consta como llegado: si ya llegó, márcalo con «Ha llegado»' + (paso === 'sinConfirmar' ? ' (antes, «Marcar confirmado»)' : '') + '. Mientras, las cuentas del stock no cuadran.</p>' : '') +
      (p.NOTAS ? '<p class="u-nota">' + texto(p.NOTAS) + '</p>' : '') +
      (/^https?:\/\//.test(String(p.ARCHIVO_URL || '')) ? '<p><a href="' + texto(p.ARCHIVO_URL) + '" target="_blank" rel="noopener">Ver el documento del pedido</a></p>' : '') +
      (nuevo ? '<p class="u-nota">Creando el pedido, sus líneas y las camisetas en el Excel…</p>' : '<div class="n-botones">' +
        (paso === 'sinConfirmar' ? '<button type="button" class="u-btn" data-cm-p="' + texto(p.ID) + '" data-cm-acc="confirmar">Marcar confirmado</button>' :
          paso === 'confirmado' ? '<button type="button" class="u-btn" data-cm-p="' + texto(p.ID) + '" data-cm-acc="llegado">Ha llegado</button>' : '') +
        '<button type="button" class="u-btn u-btn-texto" data-cm-p="' + texto(p.ID) + '" data-cm-acc="extracto">Extracto para el proveedor</button>' +
        '<button type="button" class="u-btn u-btn-texto" data-cm-p="' + texto(p.ID) + '" data-cm-acc="factura">' + (p.ID_FACTURA ? 'Cambiar factura' : 'Enlazar factura') + '</button></div>') + '</li>';
  }

  function darLibres(b, m) {
    b.disabled = true; b.textContent = 'Dando las libres…';
    S.ctx.llamar('camisetas5DarLibres', [m]).then(function (r) {
      S.ctx.aviso(r.dadas ? plural(r.dadas, 'camiseta pasa', 'camisetas pasan') + ' a Por preparar con una libre del local.' : 'Ya no quedaba ninguna libre que dar.');
      return S.T.refrescar(['CAMISETAS']);
    }).catch(function (e) { S.ctx.aviso('No se han podido dar: ' + String(e.message).replace(/^\w+:\s*/, '')); pintar(false); });
  }

  /** Proveedores (CONTRAPARTES de ECONOMIA con TIPO Proveedor), por nombre. */
  function proveedores() {
    return S.T.filas('CONTRAPARTES').filter(function (x) { return x.TIPO === 'Proveedor'; })
      .sort(function (a, b) { return norm(a.NOMBRE) < norm(b.NOMBRE) ? -1 : 1; });
  }
  function nombreProveedor(id) { var x = S.T.fila('CONTRAPARTES', id); return x ? x.NOMBRE || id : id; }
  /*
   * El contacto de un proveedor va en una sola columna (CONTRAPARTES · CONTACTO), con cada dato con su etiqueta:
   * «Persona: Marc · Teléfono: 612… · Correo: … · Prefiere: WhatsApp · Otros: …». Lo que no lleva etiqueta (lo escrito a
   * mano en el Excel) se reparte: lo que parece un correo, a Correo; un teléfono, a Teléfono; lo primero que queda, a
   * Persona, y el resto, a Otros.
   */
  var CONTACTO = [['persona', 'Persona'], ['tel', 'Teléfono'], ['correo', 'Correo'], ['prefiere', 'Prefiere'], ['otros', 'Otros']];
  var PREFIERE = ['WhatsApp', 'Correo', 'Teléfono', 'Web', 'En persona'];
  function leerContacto(t) {
    var o = {};
    String(t || '').split(' · ').forEach(function (parte) {
      parte = parte.trim(); if (!parte) return;
      var e = CONTACTO.filter(function (c) { return parte.indexOf(c[1] + ':') === 0; })[0];
      if (e) { o[e[0]] = parte.slice(e[1].length + 1).trim(); return; }
      var k = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parte) ? 'correo' : /^\+?[\d\s().-]{7,}$/.test(parte) ? 'tel' : 'persona';
      if (o[k] && k !== 'otros') k = 'otros';
      o[k] = (o[k] ? o[k] + ' · ' : '') + parte;
    });
    return o;
  }
  function escribirContacto(o) {
    return CONTACTO.filter(function (c) { return o[c[0]]; }).map(function (c) { return c[1] + ': ' + String(o[c[0]]).replace(/\s+·\s+/g, ', '); }).join(' · ');
  }
  /** El contacto en líneas, con el teléfono y el correo como enlace. */
  function htmlContacto(t) {
    var o = leerContacto(t);
    var l = CONTACTO.filter(function (c) { return o[c[0]]; }).map(function (c) {
      var v = texto(o[c[0]]);
      if (c[0] === 'tel') v = '<a href="tel:' + texto(String(o.tel).replace(/[^\d+]/g, '')) + '">' + v + '</a>';
      if (c[0] === 'correo' && /@/.test(o.correo)) v = '<a href="mailto:' + texto(o.correo) + '">' + v + '</a>';
      return '<span><span class="u-etiqueta">' + c[1] + '</span> ' + v + '</span>';
    });
    return l.length ? '<span class="cm-contacto">' + l.join('') + '</span>' : '<span class="u-nota">Sin contacto</span>';
  }
  function contactoProveedor(id) {
    var x = S.T.fila('CONTRAPARTES', id);
    return x && x.CONTACTO ? '<div class="cm-contacto-b">' + htmlContacto(x.CONTACTO) + '</div>' :
      '<p class="u-nota">Este proveedor no tiene contacto apuntado: se pone en «Proveedores», abajo en la pestaña Pedidos.</p>';
  }
  function codigoColor(id) { return color(id).CODIGO || ''; }

  function ventanaPedir(m, plan) {
    var Dd = D(), porId = {}; Dd.CAMISETAS.forEach(function (x) { porId[x.ID] = x; });
    var lin = cam5Lineas_(plan.pedir.map(function (id) { return porId[id]; }));
    var temps = (S.N && S.N.temp) || [], provs = proveedores();
    var habitual = String((S.T.fila('MODELOS', m) || {}).ID_PROVEEDOR || '');
    if (!provs.some(function (x) { return String(x.ID) === habitual; })) habitual = '';
    var v = ventana('<h2>Preparar pedido</h2><p class="u-nota">' + texto(nombreModelo(m)) + ': ' + plural(plan.pedir.length, 'camiseta', 'camisetas') +
      (plan.local.length === 1 ? '. Antes se da la que tiene una libre en el local.' : plan.local.length ? '. Antes se dan las ' + plan.local.length + ' que tienen una libre en el local.' : '.') + ' El pedido queda sin confirmar hasta que lo confirme el proveedor.</p>' +
      (provs.length ? '<div class="u-campos">' + campo('Proveedor', '<select id="pp-prov">' + (habitual ? '' : '<option value="">Elige el proveedor</option>') +
        opciones(provs.map(function (x) {
          var u = ultimoPrecio(x.ID, m) || ultimoPrecio(x.ID);
          return [x.ID, x.NOMBRE + (String(x.ID) === habitual ? ' · habitual' : '') + (u ? ' · ' + eur(u.unidad) : '')];
        }), habitual) + '</select>') + '</div><div id="pp-contacto"></div>' :
        '<p class="u-mal">No hay ningún proveedor apuntado. Añádelo en «Proveedores», abajo en la pestaña Pedidos, y después prepara el pedido.</p>') +
      '<div class="u-tabla-caja"><table class="u-tabla"><thead><tr><th>Color (código)</th><th>Dorsal</th><th>Talla</th><th class="num">Cuántas</th></tr></thead><tbody>' +
      lin.map(function (l) { return '<tr><td>' + punto(l.ID_COLOR) + texto(nombreColor(l.ID_COLOR)) + (codigoColor(l.ID_COLOR) ? ' <span class="u-nota">' + texto(codigoColor(l.ID_COLOR)) + '</span>' : '') + '</td><td>' + texto(l.DORSAL || '—') + '</td><td>' + texto(l.TALLA) + '</td><td class="num">' + l.CANTIDAD + '</td></tr>'; }).join('') +
      '</tbody></table></div><div class="u-campos">' +
      campo('Temporada', '<select id="pp-temp">' + opciones(temps.map(function (t) { return [t[0], t[1]]; }), (temps[0] || [])[0]) + '</select>') +
      campo('Llega hacia el (opcional)', '<input type="date" id="pp-est">') +
      campo('Notas (opcional)', '<input type="text" id="pp-notas" maxlength="200">') + '</div>' +
      '<p class="u-error" hidden></p>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="pp-ok"' + (provs.length ? '' : ' disabled') + '>Crear pedido</button><button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cancelar</button></div>');
    var sp = v.querySelector('#pp-prov'), pc = v.querySelector('#pp-contacto');
    var verContacto = function () {
      if (!pc) return;
      var u = sp && sp.value ? ultimoPrecio(sp.value, m) || ultimoPrecio(sp.value) : null;
      pc.innerHTML = sp && sp.value ? contactoProveedor(sp.value) + '<p class="u-nota">' + (u ? 'Último precio: <b>' + eur(u.unidad) + '/camiseta</b> sin IVA (' + texto(nombreModelo(u.p.ID_MODELO)) + ', ' + texto(u.p.ID) + ').' : 'Sin precio todavía: ningún pedido suyo tiene factura.') + '</p>' : '';
    };
    if (sp) sp.onchange = verContacto;
    verContacto();
    v.querySelector('#pp-ok').onclick = function () {
      var prov = sp ? sp.value : '';
      if (!prov) { var e = v.querySelector('.u-error'); e.textContent = 'Elige a qué proveedor va el pedido.'; e.hidden = false; sp.focus(); return; }
      var d = { ID_TEMPORADA: v.querySelector('#pp-temp').value, ID_PROVEEDOR: prov, FECHA_ESTIMADA: v.querySelector('#pp-est').value, NOTAS: v.querySelector('#pp-notas').value.trim() };
      cerrarVentana();
      S.T.crear('PEDIDOS', { ID_MODELO: m, ID_TEMPORADA: d.ID_TEMPORADA, ID_PROVEEDOR: prov, FECHA_PEDIDO: hoy(), FECHA_ESTIMADA: d.FECHA_ESTIMADA, CONFIRMADO: false, NOTAS: d.NOTAS },
        { fn: 'camisetas5Pedir', args: [m, d] }).then(function (r) {
        S.ctx.aviso('Pedido ' + r.id + ' preparado' + (r.dadas ? '; ' + plural(r.dadas, 'camiseta sale', 'camisetas salen') + ' del local' : '') + '. El extracto para el proveedor, en su tarjeta.');
      }, function () { S.T.refrescar(['CAMISETAS']).catch(function () {}); });
    };
  }

  /* ---------- lo pagado: la factura del pedido (PEDIDOS · ID_FACTURA → FACTURAS) ---------- */

  /** Importe → céntimos (acepta número, «1.234,56», «1234.56» o «12 €»), como Economía. */
  function cts(v) {
    var n = typeof v === 'number' ? v : Number(String(v == null ? '' : v).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return isFinite(n) ? Math.round(n * 100) : 0;
  }
  function pct(t) { var n = parseFloat(String(t == null ? '' : t).replace(',', '.')); return isFinite(n) ? n : 0; }
  function eur(c) {
    c = Math.round(c || 0);
    var s = c < 0 ? '−' : '', a = Math.abs(c), e = Math.floor(a / 100), d = a % 100;
    return s + String(e).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + (d < 10 ? '0' : '') + d + ' €';
  }
  function unidadesPedido(id) {
    return S.T.filas('PEDIDOS_LINEAS').reduce(function (n, l) { return n + (String(l.ID_PEDIDO) === String(id) ? Number(l.CANTIDAD) || 0 : 0); }, 0);
  }
  /**
   * Lo pagado por un pedido y a cuánto sale la camiseta, sin IVA (para comparar proveedores) y con IVA. Si una factura
   * paga varios pedidos, se reparte por camisetas. null si el pedido no tiene factura (o no tiene camisetas).
   */
  function costePedido(p) {
    var f = p && p.ID_FACTURA ? S.T.fila('FACTURAS', p.ID_FACTURA) : null; if (!f) return null;
    var juntos = S.T.filas('PEDIDOS').filter(function (x) { return String(x.ID_FACTURA) === String(p.ID_FACTURA); });
    var total = juntos.reduce(function (n, x) { return n + unidadesPedido(x.ID); }, 0), u = unidadesPedido(p.ID);
    if (!total || !u) return null;
    var base = cts(f.BASE), iva = pct(f.TIPO_IVA), mia = Math.round(base * u / total);
    return { f: f, base: mia, total: Math.round(mia * (1 + iva / 100)), unidad: base / total, unidadIva: base * (1 + iva / 100) / total, juntos: juntos.length };
  }
  /** El precio por camiseta del último pedido con factura de un proveedor (de un modelo, si se dice). */
  function ultimoPrecio(prov, modelo) {
    var l = S.T.filas('PEDIDOS').filter(function (p) { return String(p.ID_PROVEEDOR) === String(prov) && (!modelo || String(p.ID_MODELO) === String(modelo)) && p.ID_FACTURA; })
      .sort(function (a, b) { return String(b.FECHA_PEDIDO || '') < String(a.FECHA_PEDIDO || '') ? -1 : 1; });
    for (var i = 0; i < l.length; i++) { var c = costePedido(l[i]); if (c) return { unidad: c.unidad, p: l[i] }; }
    return null;
  }
  function htmlCoste(p) {
    if (p._nueva) return '';
    var c = costePedido(p);
    if (!c) return p.ID_FACTURA ? '<p class="u-nota">Factura ' + texto(p.ID_FACTURA) + ' (no la encuentro en Economía)</p>' : '<p class="u-nota">Sin factura: enlázala para ver lo pagado y el precio por camiseta.</p>';
    return '<p class="cm-coste">Pagado <b>' + eur(c.base) + '</b> sin IVA (' + eur(c.total) + ' con IVA) · <b>' + eur(c.unidad) + '/camiseta</b> (' + eur(c.unidadIva) + ' con IVA)' +
      '<span class="u-nota"> · Factura ' + texto(c.f.NUMERO || c.f.ID) + (c.juntos > 1 ? ', repartida entre ' + c.juntos + ' pedidos' : '') + '</span></p>';
  }

  function ventanaFactura(id) {
    var p = S.T.fila('PEDIDOS', id); if (!p) return;
    var fs = S.T.filas('FACTURAS').filter(function (f) { return f.TIPO !== 'Emitida'; })
      .sort(function (a, b) { return String(b.FECHA || '') < String(a.FECHA || '') ? -1 : 1; });
    var suyas = fs.filter(function (f) { return String(f.ID_CONTRAPARTE) === String(p.ID_PROVEEDOR); }), otras = fs.filter(function (f) { return suyas.indexOf(f) < 0; });
    var op = function (f) { return [f.ID, [f.NUMERO || f.ID, fecha(f.FECHA), eur(cts(f.BASE)) + ' sin IVA', f.ID_CONTRAPARTE && String(f.ID_CONTRAPARTE) !== String(p.ID_PROVEEDOR) ? nombreProveedor(f.ID_CONTRAPARTE) : ''].filter(String).join(' · ')]; };
    var v = ventana('<h2>Factura del pedido ' + texto(p.ID) + '</h2>' +
      '<p class="u-nota">' + plural(unidadesPedido(p.ID), 'camiseta', 'camisetas') + ' de ' + texto(nombreProveedor(p.ID_PROVEEDOR)) + '. Con su factura se ve lo pagado y a cuánto sale cada camiseta. Si la factura todavía no está, se da de alta en Economía › Facturas.</p>' +
      '<div class="u-campos cm-una">' + campo('Factura', '<select id="pf-f"><option value="">Sin factura</option>' +
        (suyas.length ? '<optgroup label="De ' + texto(nombreProveedor(p.ID_PROVEEDOR)) + '">' + opciones(suyas.map(op), p.ID_FACTURA) + '</optgroup>' : '') +
        (otras.length ? '<optgroup label="Otras facturas recibidas">' + opciones(otras.map(op), p.ID_FACTURA) + '</optgroup>' : '') + '</select>') + '</div>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="pf-ok">Guardar</button><button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cancelar</button></div>');
    v.querySelector('#pf-ok').onclick = function () {
      var f = v.querySelector('#pf-f').value;
      cerrarVentana();
      if (f !== String(p.ID_FACTURA || '')) S.T.actualizar('PEDIDOS', p.ID, { ID_FACTURA: f }).then(function () { S.ctx.aviso(f ? 'Factura enlazada al pedido ' + p.ID + '.' : 'El pedido ' + p.ID + ' ya no tiene factura.'); }, function () {});
    };
  }

  /* ---------- modelos: qué se encarga y en qué competiciones va (MODELOS y MODELOS_COMPETICION) ---------- */

  /** Las competiciones se llaman igual cada año (LIGA, SENIOR…): siempre con su temporada. */
  function nombreTemp(t) { var x = ((S.N && S.N.temp) || []).filter(function (y) { return y[0] === t; })[0]; return x ? x[1] : t; }
  function nombreComp(id) { var x = S.N && S.N.comp && S.N.comp[id]; return x ? x[0] + ' ' + nombreTemp(x[1]) : id; }
  function compsDeModelo(m) {
    return S.T.filas('MODELOS_COMPETICION').filter(function (x) { return String(x.ID_MODELO) === String(m); })
      .sort(function (a, b) { return norm(nombreComp(a.ID_COMPETICION)) < norm(nombreComp(b.ID_COMPETICION)) ? -1 : 1; });
  }
  function htmlModelos() {
    var n = {};
    S.T.filas('CAMISETAS').forEach(function (c) { if (c.ESTADO !== 'Sin camiseta') n[c.ID_MODELO] = (n[c.ID_MODELO] || 0) + 1; });
    var l = S.T.filas('MODELOS').slice().sort(function (a, b) { return norm(a.NOMBRE) < norm(b.NOMBRE) ? -1 : 1; });
    return '<section class="u-bloque cm-mods"><div class="cm-eq-cab"><h2 class="n-grupo">Modelos <span class="u-cifra">' + l.length + '</span></h2>' +
      '<button type="button" class="u-btn" data-cm-mod="">Añadir modelo</button></div>' +
      '<p class="u-nota">Cada modelo es una camiseta distinta que se encarga (p. ej. la combinación de sponsors de una temporada), con su proveedor habitual y las competiciones que la llevan.</p>' +
      (l.length ? '<ul class="cm-prov-l">' + l.map(function (m) {
        var cs = compsDeModelo(m.ID);
        return '<li><div class="cm-rec-c"><b>' + texto(m.NOMBRE || m.ID) + '</b>' +
          '<span class="u-nota">' + texto([m.PRENDA, m.ID_PROVEEDOR ? 'Proveedor habitual: ' + nombreProveedor(m.ID_PROVEEDOR) : 'Sin proveedor habitual', plural(n[m.ID] || 0, 'camiseta', 'camisetas')].filter(String).join(' · ')) + '</span>' +
          '<span class="u-nota">' + (cs.length ? 'Va en: ' + texto(cs.map(function (x) { return nombreComp(x.ID_COMPETICION) + ' (' + plural(Number(x.CAMISETAS_INCLUIDAS) || 0, 'camiseta', 'camisetas') + ' por jugadora)'; }).join(', ')) : 'No está en ninguna competición') + '</span>' +
          (m.NOTAS ? '<span class="u-nota">' + texto(m.NOTAS) + '</span>' : '') + '</div>' +
          '<button type="button" class="u-btn u-btn-texto" data-cm-mod="' + texto(m.ID) + '">Cambiar</button></li>';
      }).join('') + '</ul>' : '<p class="u-vacio">Todavía no hay ningún modelo.</p>') + '</section>';
  }

  function ventanaModelo(id) {
    var m = id ? S.T.fila('MODELOS', id) : null, provs = proveedores();
    var ya = {}; if (m) compsDeModelo(m.ID).forEach(function (x) { ya[x.ID_COMPETICION] = x; });
    // Las competiciones de las dos temporadas más recientes y, además, las que ya lleva el modelo.
    var temps = ((S.N && S.N.temp) || []).slice(0, 2).map(function (t) { return t[0]; });
    var comps = Object.keys((S.N && S.N.comp) || {}).filter(function (k) { return temps.indexOf(S.N.comp[k][1]) >= 0 || ya[k]; })
      .sort(function (a, b) { return (temps.indexOf(S.N.comp[a][1]) - temps.indexOf(S.N.comp[b][1])) || (norm(S.N.comp[a][0]) < norm(S.N.comp[b][0]) ? -1 : 1); });
    var v = ventana('<h2>' + (m ? 'Cambiar modelo' : 'Añadir modelo') + '</h2><div class="u-campos cm-una">' +
      campo('Nombre (p. ej. VAPIANO-SALERM 25-26)', '<input type="text" id="md-nom" maxlength="120" value="' + texto(m ? m.NOMBRE : '') + '">') +
      campo('Prenda', '<input type="text" id="md-pre" maxlength="60" list="md-prendas" value="' + texto(m ? m.PRENDA : 'Camiseta') + '"><datalist id="md-prendas"><option value="Camiseta"><option value="Peto"><option value="Sudadera"></datalist>') +
      campo('Proveedor habitual', '<select id="md-prov"><option value="">Sin proveedor habitual</option>' + opciones(provs.map(function (x) { return [x.ID, x.NOMBRE]; }), m ? m.ID_PROVEEDOR : '') + '</select>') +
      campo('Notas (opcional)', '<input type="text" id="md-not" maxlength="200" value="' + texto(m ? m.NOTAS : '') + '">') + '</div>' +
      '<h3 class="cm-sub">Competiciones que lo llevan</h3><p class="u-nota">Cada competición es de una temporada: marca solo las del año en que se usa este modelo. Al lado, cuántas camisetas tiene cada jugadora con la inscripción (normalmente 1). El pack de tallas y dorsales que se ofrece (1S, 2S, 3S, 4M…) todavía no se define aquí.</p>' +
      (S.N ? (comps.length ? '<ul class="cm-lista-ok cm-md-comps">' + comps.map(function (k, i) {
        var x = ya[k], t = S.N.comp[k][1];
        return (i === 0 || S.N.comp[comps[i - 1]][1] !== t ? '<li class="cm-md-temp">Temporada ' + texto(nombreTemp(t)) + '</li>' : '') + '<li><label class="u-check"><input type="checkbox" data-md-comp="' + texto(k) + '"' + (x ? ' checked' : '') + '> ' + texto(S.N.comp[k][0]) + '</label>' +
          '<label class="cm-md-n"><input type="number" min="0" step="1" inputmode="numeric" data-md-n="' + texto(k) + '" value="' + texto(x ? Number(x.CAMISETAS_INCLUIDAS) || 0 : 1) + '" aria-label="Camisetas por jugadora en ' + texto(S.N.comp[k][0]) + '"> por jugadora</label></li>';
      }).join('') + '</ul>' : '<p class="u-nota">No hay competiciones en las últimas temporadas.</p>') : '<p class="u-nota">Cargando las competiciones…</p>') +
      '<p class="u-error" hidden></p>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="md-ok">' + (m ? 'Guardar' : 'Añadir') + '</button><button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cancelar</button></div>');
    v.querySelector('#md-ok').onclick = function () {
      var val = function (k) { return v.querySelector('#md-' + k).value.trim(); };
      var d = { NOMBRE: val('nom'), PRENDA: val('pre'), ID_PROVEEDOR: val('prov'), NOTAS: val('not') };
      var err = v.querySelector('.u-error'), mal = function (t) { err.textContent = t; err.hidden = false; };
      if (!d.NOMBRE) return mal('Falta el nombre.');
      if (!d.PRENDA) return mal('Falta la prenda (Camiseta, Peto…).');
      if (S.T.filas('MODELOS').some(function (y) { return norm(y.NOMBRE) === norm(d.NOMBRE) && (!m || String(y.ID) !== String(m.ID)); })) return mal('Ya hay un modelo con ese nombre.');
      var quiero = {}, malN = false;
      [].forEach.call(v.querySelectorAll('[data-md-comp]'), function (b) {
        if (!b.checked) return;
        var k = b.getAttribute('data-md-comp'), n = Number(v.querySelector('[data-md-n="' + k + '"]').value);
        if (!(n >= 0 && n === Math.round(n))) malN = true;
        quiero[k] = n;
      });
      if (malN) return mal('Las camisetas por jugadora son un número entero, 0 o más.');
      cerrarVentana();
      var comps = function (mid) {
        var p = [];
        Object.keys(quiero).forEach(function (k) {
          if (!ya[k]) p.push(S.T.crear('MODELOS_COMPETICION', { ID_COMPETICION: k, ID_MODELO: mid, CAMISETAS_INCLUIDAS: quiero[k] }));
          else if (Number(ya[k].CAMISETAS_INCLUIDAS) !== quiero[k]) p.push(S.T.actualizar('MODELOS_COMPETICION', ya[k].ID, { CAMISETAS_INCLUIDAS: quiero[k] }));
        });
        Object.keys(ya).forEach(function (k) { if (!(k in quiero)) p.push(S.T.borrar('MODELOS_COMPETICION', ya[k].ID)); });
        return Promise.all(p);
      };
      if (m) {
        var cambios = {}; Object.keys(d).forEach(function (k) { if (String(m[k] || '') !== d[k]) cambios[k] = d[k]; });
        (Object.keys(cambios).length ? S.T.actualizar('MODELOS', m.ID, cambios) : Promise.resolve()).then(function () { return comps(m.ID); })
          .then(function () { S.ctx.aviso('Modelo guardado.'); }, function () {});
      } else {
        S.T.crear('MODELOS', d).then(function (r) { return comps(r.id); }).then(function () { S.ctx.aviso(d.NOMBRE + ' añadido a los modelos.'); }, function () {});
      }
    };
  }

  /** Proveedores: la lista, con su contacto, para verlos, darlos de alta y cambiarlos sin ir al Excel. */
  function htmlProveedores() {
    var l = proveedores();
    return '<section class="u-bloque cm-provs"><div class="cm-eq-cab"><h2 class="n-grupo">Proveedores <span class="u-cifra">' + l.length + '</span></h2>' +
      '<button type="button" class="u-btn" data-cm-prov="">Añadir proveedor</button></div>' +
      '<p class="u-nota">A quién se le hacen los pedidos. Se guardan con los demás proveedores de Konamigas (Excel ECONOMIA), así que también los ve Economía.</p>' +
      (l.length ? '<ul class="cm-prov-l">' + l.map(function (x) {
        var usos = S.T.filas('MODELOS').filter(function (m) { return String(m.ID_PROVEEDOR) === String(x.ID); }).map(function (m) { return m.NOMBRE || m.ID; });
        return '<li><div class="cm-rec-c"><b>' + texto(x.NOMBRE) + '</b>' +
          htmlContacto(x.CONTACTO) +
          (usos.length ? '<span class="u-nota">Habitual de ' + texto(usos.join(', ')) + '</span>' : '') +
          (function () { var u = ultimoPrecio(x.ID); return u ? '<span class="u-nota">Último precio: ' + eur(u.unidad) + '/camiseta sin IVA (' + texto(nombreModelo(u.p.ID_MODELO)) + ', ' + texto(u.p.ID) + ')</span>' : ''; })() +
          (x.NOTAS ? '<span class="u-nota">' + texto(x.NOTAS) + '</span>' : '') + '</div>' +
          '<button type="button" class="u-btn u-btn-texto" data-cm-prov="' + texto(x.ID) + '">Cambiar</button></li>';
      }).join('') + '</ul>' : '<p class="u-vacio">Todavía no hay ningún proveedor.</p>') + '</section>';
  }

  function ventanaProveedor(id) {
    var x = id ? S.T.fila('CONTRAPARTES', id) : null;
    var o = leerContacto(x ? x.CONTACTO : '');
    var v = ventana('<h2>' + (x ? 'Cambiar proveedor' : 'Añadir proveedor') + '</h2><div class="u-campos cm-una">' +
      campo('Nombre', '<input type="text" id="pv-nom" maxlength="120" value="' + texto(x ? x.NOMBRE : '') + '">') +
      campo('Persona de contacto', '<input type="text" id="pv-persona" maxlength="80" autocomplete="off" value="' + texto(o.persona || '') + '">') +
      campo('Teléfono', '<input type="tel" id="pv-tel" maxlength="40" autocomplete="off" value="' + texto(o.tel || '') + '">') +
      campo('Correo', '<input type="email" id="pv-correo" maxlength="120" autocomplete="off" value="' + texto(o.correo || '') + '">') +
      campo('Cómo prefiere los pedidos', '<select id="pv-prefiere"><option value="">Sin decir</option>' + opciones(PREFIERE.concat(o.prefiere && PREFIERE.indexOf(o.prefiere) < 0 ? [o.prefiere] : []), o.prefiere) + '</select>') +
      campo('Otros datos (web, horario, dirección…)', '<input type="text" id="pv-otros" maxlength="200" value="' + texto(o.otros || '') + '">') +
      campo('Notas (opcional)', '<input type="text" id="pv-not" maxlength="200" value="' + texto(x ? x.NOTAS : '') + '">') + '</div>' +
      '<p class="u-nota">Sin datos bancarios: esos van en Economía.</p><p class="u-error" hidden></p>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="pv-ok">' + (x ? 'Guardar' : 'Añadir') + '</button><button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cancelar</button></div>');
    v.querySelector('#pv-ok').onclick = function () {
      var val = function (k) { return v.querySelector('#pv-' + k).value.trim(); };
      var d = { NOMBRE: val('nom'), CONTACTO: escribirContacto({ persona: val('persona'), tel: val('tel'), correo: val('correo'), prefiere: val('prefiere'), otros: val('otros') }), NOTAS: val('not') };
      var err = v.querySelector('.u-error'), mal = function (t) { err.textContent = t; err.hidden = false; };
      if (!d.NOMBRE) return mal('Falta el nombre.');
      if (val('correo') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('correo'))) return mal('El correo no parece bien escrito.');
      if (d.CONTACTO.length > 500) return mal('El contacto es demasiado largo: acorta «Otros datos».');
      // El nombre es único entre todas las contrapartes (también las que no son proveedores).
      if (S.T.filas('CONTRAPARTES').some(function (y) { return norm(y.NOMBRE) === norm(d.NOMBRE) && (!x || String(y.ID) !== String(x.ID)); })) return mal('Ya hay alguien con ese nombre en Economía.');
      cerrarVentana();
      if (x) S.T.actualizar('CONTRAPARTES', x.ID, d).then(function () { S.ctx.aviso('Proveedor guardado.'); }, function () {});
      else S.T.crear('CONTRAPARTES', { NOMBRE: d.NOMBRE, TIPO: 'Proveedor', CONTACTO: d.CONTACTO, NOTAS: d.NOTAS }).then(function () { S.ctx.aviso(d.NOMBRE + ' añadido a los proveedores.'); }, function () {});
    };
  }

  /** El pedido en texto, para enviarlo al proveedor por WhatsApp o correo: por color (con su código), dorsal y talla. */
  function textoExtracto(p) {
    var l = S.T.filas('PEDIDOS_LINEAS').filter(function (x) { return String(x.ID_PEDIDO) === String(p.ID); }).sort(cam5Orden_);
    var porColor = {}, orden = [], total = 0;
    l.forEach(function (x) {
      if (!porColor[x.ID_COLOR]) { porColor[x.ID_COLOR] = []; orden.push(x.ID_COLOR); }
      porColor[x.ID_COLOR].push(x); total += Number(x.CANTIDAD) || 0;
    });
    orden.sort(function (a, b) { return nombreColor(a) < nombreColor(b) ? -1 : 1; });
    var t = ['Pedido ' + p.ID + ' · Konamigas', 'Modelo: ' + nombreModelo(p.ID_MODELO), p.ID_PROVEEDOR ? 'Proveedor: ' + nombreProveedor(p.ID_PROVEEDOR) : '',
      p.FECHA_PEDIDO ? 'Fecha del pedido: ' + fecha(p.FECHA_PEDIDO) : '', p.FECHA_ESTIMADA ? 'Lo necesitamos hacia el: ' + fecha(p.FECHA_ESTIMADA) : ''].filter(String);
    orden.forEach(function (col) {
      var n = porColor[col].reduce(function (s, x) { return s + (Number(x.CANTIDAD) || 0); }, 0), cod = codigoColor(col);
      t.push('', nombreColor(col) + (cod ? ' (código ' + cod + ')' : '') + ': ' + n);
      porColor[col].forEach(function (x) { t.push('- ' + (x.DORSAL ? 'Dorsal ' + x.DORSAL : 'Sin dorsal') + ' · talla ' + x.TALLA + ': ' + x.CANTIDAD); });
    });
    t.push('', 'Total: ' + plural(total, 'camiseta', 'camisetas'));
    if (p.NOTAS) t.push('Notas: ' + p.NOTAS);
    return t.join('\n');
  }

  function ventanaExtracto(id) {
    var p = S.T.fila('PEDIDOS', id); if (!p) return;
    var txt = textoExtracto(p), comparte = typeof navigator.share === 'function';
    var v = ventana('<h2>Extracto del pedido ' + texto(p.ID) + '</h2>' +
      (p.ID_PROVEEDOR ? '<p><b>' + texto(nombreProveedor(p.ID_PROVEEDOR)) + '</b></p>' + contactoProveedor(p.ID_PROVEEDOR) : '<p class="u-nota">Este pedido no tiene proveedor apuntado.</p>') +
      '<pre class="cm-extracto" tabindex="0">' + texto(txt) + '</pre>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="ex-copiar">Copiar</button>' +
      (comparte ? '<button type="button" class="u-btn" id="ex-compartir">Compartir</button>' : '') +
      '<button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cerrar</button></div>');
    var pre = v.querySelector('.cm-extracto'), bc = v.querySelector('#ex-copiar');
    var seleccionar = function () { var r = document.createRange(); r.selectNodeContents(pre); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); };
    bc.onclick = function () {
      var hecho = function () { bc.textContent = 'Copiado'; S.ctx.aviso('Extracto copiado: pégalo en el WhatsApp o el correo del proveedor.'); };
      var mano = function () { seleccionar(); S.ctx.aviso('No se ha podido copiar solo: está seleccionado, cópialo tú.'); };
      try { navigator.clipboard.writeText(txt).then(hecho, mano); } catch (e) { mano(); }
    };
    if (comparte) v.querySelector('#ex-compartir').onclick = function () { navigator.share({ title: 'Pedido ' + p.ID, text: txt }).catch(function () {}); };
  }

  /* ======================= Recuento ======================= */

  /** Lo contado de un modelo, guardado en este dispositivo hasta aplicarlo: { cont: { clave: n }, tipo: { clave }, otras: [], rev: { color } }. */
  function recLeer(m) { return leerLocal(S.ctx, 'rec_' + m) || { cont: {}, tipo: {}, otras: [], rev: {} }; }
  function recGuardar(m, r) { guardarLocal(S.ctx, 'rec_' + m, r); }

  function pRecuento(c) {
    var m = S.modelo || (modelos()[0] || {}).id, R = recLeer(m), L = cam5Local_(D(), m);
    var filas = Object.keys(L).map(function (k) { var p = k.split('|'); return { k: k, ID_COLOR: p[0], DORSAL: p[1], TALLA: p[2], debe: L[k] }; });
    var cols = []; filas.forEach(function (f) { if (cols.indexOf(f.ID_COLOR) < 0) cols.push(f.ID_COLOR); });
    cols.sort(function (a, b) { return nombreColor(a) < nombreColor(b) ? -1 : 1; });
    var contado = function (f) { return f.k in R.cont ? R.cont[f.k] : Math.max(f.debe, 0); };
    var revisados = cols.filter(function (x) { return R.rev[x]; }).length;
    var h = '<div class="u-filtros cm-filtros">' + selModelo() + '</div>' +
      '<p class="u-nota">Cuenta las camisetas sueltas de ' + texto(nombreModelo(m)) + ': las de la caja, también las asignadas a una jugadora (Por preparar); las de las bolsas (Preparadas), no. Cambia solo lo que no coincida y marca cada color como contado. Lo que cuentes se guarda en este móvil hasta aplicarlo.</p>' +
      (filas.some(function (f) { return f.debe < 0; }) ? '<p class="u-nota">Donde pone «no cuadra», las cuentas salen en negativo: consta que han salido más de las que llegaron. Pon lo que cuentes y, al aplicar, se corrige.</p>' : '');
    if (!cols.length) h += '<p class="u-vacio">No consta ninguna camiseta en el local de este modelo. Si encuentras alguna, añádela abajo.</p>';
    h += cols.map(function (col) {
      var l = filas.filter(function (f) { return f.ID_COLOR === col; }).sort(cam5Orden_);
      return '<section class="cm-rec' + (R.rev[col] ? ' cm-rec-ok' : '') + '"><div class="cm-eq-cab"><h2 class="n-grupo">' + punto(col) + texto(nombreColor(col)) + '</h2>' +
        '<label class="u-check"><input type="checkbox" data-cm-rev="' + texto(col) + '"' + (R.rev[col] ? ' checked' : '') + '> Contado</label></div>' +
        '<ul class="cm-rec-l">' + l.map(function (f) {
          var n = contado(f), d = n - f.debe;
          return '<li class="' + (d ? 'cm-dif' : '') + '"><span class="cm-rec-c"><b>' + texto(cami(f)) + '</b><span class="u-nota">' + (f.debe < 0 ? 'no cuadra: las cuentas dan −' + (-f.debe) : 'debería haber ' + f.debe) + '</span></span>' +
            '<span class="cm-paso"><button type="button" class="u-btn u-btn-icono" data-cm-menos="' + texto(f.k) + '" aria-label="Una menos de ' + texto(cami(f)) + '">−</button>' +
            '<b class="u-cifra">' + n + '</b><button type="button" class="u-btn u-btn-icono" data-cm-mas="' + texto(f.k) + '" aria-label="Una más de ' + texto(cami(f)) + '">+</button></span>' +
            (d < 0 ? '<label class="u-campo cm-falta"><span class="u-etiqueta">Por qué faltan ' + (-d) + '</span><select data-cm-tipo="' + texto(f.k) + '">' + opciones(FALTA.map(function (t) { return [t, t === 'Recuento' ? 'No lo sé' : t]; }), R.tipo[f.k] || 'Recuento') + '</select></label>' : '') +
            '</li>';
        }).join('') + '</ul></section>';
    }).join('');
    h += '<section class="cm-rec"><h2 class="n-grupo">Encontradas que no salen</h2>' +
      (R.otras.length ? '<ul class="cm-rec-l">' + R.otras.map(function (o, i) {
        return '<li><span class="cm-rec-c"><b>' + punto(o.ID_COLOR) + texto(nombreColor(o.ID_COLOR) + ' · ' + cami(o)) + '</b></span><b class="u-cifra">' + o.n + '</b>' +
          '<button type="button" class="u-btn u-btn-texto" data-cm-quitar="' + i + '">Quitar</button></li>';
      }).join('') + '</ul>' : '') +
      '<div class="cm-otra">' + campo('Color', '<select id="ro-col">' + opciones(S.T.filas('COLORES').map(function (x) { return [x.ID, x.NOMBRE]; }), cols[0]) + '</select>') +
      campo('Dorsal', '<input type="text" id="ro-dor" inputmode="numeric" maxlength="4">') + campo('Talla', '<select id="ro-tal">' + opciones(CAM5_TALLAS, 'M') + '</select>') +
      campo('Cuántas', '<input type="number" id="ro-n" min="1" value="1" inputmode="numeric">') + '<button type="button" class="u-btn" id="ro-add">Añadir</button></div></section>';
    var difs = filas.filter(function (f) { return contado(f) !== f.debe; });
    var tuyos = difs.filter(function (f) { return f.k in R.cont; }).length + R.otras.length, noCuadran = difs.length - difs.filter(function (f) { return f.k in R.cont; }).length;
    h += '<div class="cm-rec-pie"><p class="u-nota">' + revisados + ' de ' + cols.length + ' colores contados · ' + plural(tuyos, 'cambio tuyo', 'cambios tuyos') +
      (noCuadran ? ' · ' + plural(noCuadran, 'que no cuadra se corrige', 'que no cuadran se corrigen') + ' al aplicar' : '') + '</p>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="cm-aplicar"' + (revisados < cols.length || !(difs.length + R.otras.length) ? ' disabled' : '') + '>Aplicar recuento</button>' +
      (Object.keys(R.cont).length || R.otras.length || revisados ? '<button type="button" class="u-btn u-btn-texto" id="cm-borrar">Empezar de cero</button>' : '') + '</div></div>';
    c.innerHTML = h;
    engancharModelo(c);
    var guarda = function () { recGuardar(m, R); pintar(false); };
    c.onclick = function (e) {
      var b = e.target.closest('button'); if (!b || !c.contains(b)) return;
      var k;
      if ((k = b.getAttribute('data-cm-mas')) || (k = b.getAttribute('data-cm-menos'))) {
        var f = filas.filter(function (x) { return x.k === k; })[0];
        R.cont[k] = Math.max(0, contado(f) + (b.hasAttribute('data-cm-mas') ? 1 : -1));
        if (R.cont[k] === f.debe) delete R.cont[k];
        guarda();
      } else if (b.hasAttribute('data-cm-quitar')) { R.otras.splice(Number(b.getAttribute('data-cm-quitar')), 1); guarda(); }
      else if (b.id === 'ro-add') {
        var dor = c.querySelector('#ro-dor').value.trim(), n = Number(c.querySelector('#ro-n').value);
        if (!(n >= 1 && n === Math.round(n))) { S.ctx.aviso('Cuántas: un número entero, 1 o más.'); return; }
        R.otras.push({ ID_COLOR: c.querySelector('#ro-col').value, DORSAL: dor, TALLA: c.querySelector('#ro-tal').value, n: n }); guarda();
      } else if (b.id === 'cm-borrar') { recGuardar(m, null); pintar(false); }
      else if (b.id === 'cm-aplicar') ventanaAplicar(m, L, filas, contado, R);
    };
    c.onchange = function (e) {
      var t = e.target, k;
      if ((k = t.getAttribute('data-cm-rev'))) { if (t.checked) R.rev[k] = true; else delete R.rev[k]; guarda(); }
      else if ((k = t.getAttribute('data-cm-tipo'))) { R.tipo[k] = t.value; recGuardar(m, R); }
    };
  }

  function ventanaAplicar(m, L, filas, contado, R) {
    var difs = filas.filter(function (f) { return contado(f) !== f.debe; });
    var v = ventana('<h2>Aplicar recuento</h2><p class="u-nota">' + texto(nombreModelo(m)) + '. Cada diferencia se apunta en el stock con tu nombre y la fecha de hoy.</p>' +
      '<ul class="cm-rec-l">' + difs.map(function (f) {
        var d = contado(f) - f.debe, t = R.tipo[f.k] || 'Recuento';
        return '<li><span class="cm-rec-c"><b>' + punto(f.ID_COLOR) + texto(nombreColor(f.ID_COLOR) + ' · ' + cami(f)) + '</b><span class="u-nota">' + (d < 0 && t !== 'Recuento' ? texto(t) : 'Recuento') + '</span></span><b class="u-cifra' + (d < 0 ? ' u-mal' : '') + '">' + (d > 0 ? '+' : '') + d + '</b></li>';
      }).concat(R.otras.map(function (o) {
        return '<li><span class="cm-rec-c"><b>' + punto(o.ID_COLOR) + texto(nombreColor(o.ID_COLOR) + ' · ' + cami(o)) + '</b><span class="u-nota">No estaba en el cuadro</span></span><b class="u-cifra">+' + o.n + '</b></li>';
      })).join('') + '</ul><p class="u-error" hidden></p>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="ap-ok">Apuntar ' + plural(difs.length + R.otras.length, 'cambio', 'cambios') + '</button><button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Seguir contando</button></div>');
    var ok = v.querySelector('#ap-ok');
    ok.onclick = function () {
      ok.disabled = true; ok.textContent = 'Apuntando…';
      var base = {}; Object.keys(L).forEach(function (k) { base[k] = L[k]; });
      var cont = difs.map(function (f) { return { ID_COLOR: f.ID_COLOR, DORSAL: f.DORSAL, TALLA: f.TALLA, n: contado(f), tipo: R.tipo[f.k] || 'Recuento' }; });
      S.ctx.llamar('camisetas5Recuento', [m, base, cont, R.otras]).then(function (r) {
        if (r.cambiado) {
          var e = v.querySelector('.u-error');
          e.textContent = 'Mientras contabas ha cambiado el stock de ' + plural(r.cambiado.length, 'combinación', 'combinaciones') + ' (' + r.cambiado.map(function (x) { var p = x.clave.split('|'); return nombreColor(p[0]) + ' ' + p[1] + '·' + p[2]; }).join(', ') +
            '). No se ha apuntado nada: revisa esas y vuelve a aplicar.';
          e.hidden = false; ok.hidden = true;
          S.T.refrescar(['CAMISETAS', 'PEDIDOS', 'PEDIDOS_LINEAS', 'AJUSTES_STOCK'], true).catch(function () {});
          return;
        }
        recGuardar(m, null);
        cerrarVentana();
        S.ctx.aviso('Recuento apuntado: ' + plural(r.aplicado, 'ajuste', 'ajustes') + ' en el stock.');
        return S.T.refrescar(['AJUSTES_STOCK']);
      }).catch(function (e) {
        ok.disabled = false; ok.textContent = 'Volver a probar';
        var x = v.querySelector('.u-error'); x.textContent = 'No se ha apuntado: ' + String(e.message).replace(/^\w+:\s*/, '') + ' Lo contado sigue guardado en este móvil.'; x.hidden = false;
      });
    };
  }
})();
