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
 * T0268: el pack de camisetas incluidas de cada competición (PACKS): en Entregas, cada camiseta dice si es personalizada y
 * cada equipo, los dorsales del pack que le quedan libres y los repetidos, con un mensaje para mandarle; en Pedidos,
 * definir el pack, pedirlo antes de la temporada, lo cobrado por las personalizadas (tarifa «Camiseta» de TARIFAS) y el
 * catálogo de cada proveedor (CATALOGO): el pedido solo ofrece los proveedores que hacen el modelo en esos colores y el
 * extracto lleva su código.
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

  /* ---------- T0268 · pack de camisetas incluidas, catálogo de cada proveedor y tarifa de las personalizadas ---------- */

  /** «4M»: dorsal y talla juntos, como se dicen en el campo y en el pack. */
  function cam5Corto_(f) { return cam5Txt_(f.DORSAL) + cam5Txt_(f.TALLA); }
  /** El pack de una competición (filas de PACKS): [{ DORSAL, TALLA }] por dorsal. */
  function cam5Pack_(packs, comp) {
    comp = cam5Txt_(comp);
    return (packs || []).filter(function (p) { return p && cam5Txt_(p.ID) && cam5Txt_(p.ID_COMPETICION) === comp && cam5Txt_(p.DORSAL); })
      .map(function (p) { return { DORSAL: cam5Txt_(p.DORSAL), TALLA: cam5Txt_(p.TALLA) }; }).sort(cam5Orden_);
  }
  /**
   * El pack escrito a mano («1S, 2S, 3S, 4M» o «1 - S, 2 - S…», como en el Excel antiguo): { pack: [{ DORSAL, TALLA }], mal: [trozos] }.
   * Un dorsal repetido cuenta como mal: en un equipo cada dorsal es de una sola jugadora.
   */
  function cam5LeerPack_(t) {
    var pack = [], mal = [], ya = {};
    String(t || '').split(/[,;\n]+/).forEach(function (x) {
      x = x.trim(); if (!x) return;
      var m = /^(\d{1,3})\s*[-·\s]?\s*(XXL|XL|XS|S|M|L)$/i.exec(x);
      if (!m || ya[m[1]]) { mal.push(x); return; }
      ya[m[1]] = 1; pack.push({ DORSAL: m[1], TALLA: m[2].toUpperCase() });
    });
    return { pack: pack.sort(cam5Orden_), mal: mal };
  }
  /**
   * Lo incluido de un equipo según el pack de su competición. camisetas: las del equipo; pack: cam5Pack_; porJugadora:
   * camisetas incluidas por jugadora (MODELOS_COMPETICION · CAMISETAS_INCLUIDAS, 1 si no se dice); bajas: { ID_INSCRIPCION: true }.
   * No cuentan las «Sin camiseta» ni las de las bajas. De la más antigua a la más reciente (por ID), cada camiseta con un dorsal
   * y una talla del pack que nadie del equipo ha cogido antes va incluida, si su jugadora no ha gastado ya las suyas; las demás
   * son personalizadas.
   * { incluida: { ID: true|false }, libres: [{ DORSAL, TALLA }] (del pack, con el dorsal sin usar en el equipo),
   *   repetidos: [{ DORSAL, ids: [ID] }] (dorsales que llevan dos o más jugadoras), personalizadas: n, incluidas: n }
   */
  function cam5Incluidas_(camisetas, pack, porJugadora, bajas) {
    bajas = bajas || {};
    var maxJ = porJugadora === undefined || porJugadora === null || porJugadora === '' ? 1 : cam5Num_(porJugadora);
    var hueco = {}, usado = {}, porJug = {}, dorsales = {}, r = { incluida: {}, libres: [], repetidos: [], personalizadas: 0, incluidas: 0 };
    (pack || []).forEach(function (p) { hueco[cam5Txt_(p.DORSAL)] = cam5Txt_(p.TALLA); });
    (camisetas || []).filter(function (c) {
      return c && cam5Txt_(c.ID) && cam5Txt_(c.ESTADO) !== 'Sin camiseta' && !bajas[cam5Txt_(c.ID_INSCRIPCION_JUGADORA)];
    }).sort(function (a, b) { return cam5Txt_(a.ID) < cam5Txt_(b.ID) ? -1 : 1; }).forEach(function (c) {
      var d = cam5Txt_(c.DORSAL), j = cam5Txt_(c.ID_INSCRIPCION_JUGADORA);
      if (d) {
        (dorsales[d] = dorsales[d] || { j: {}, ids: [] }).ids.push(cam5Txt_(c.ID));
        dorsales[d].j[j] = 1;
      }
      var si = !!d && hueco[d] === cam5Txt_(c.TALLA) && !usado[d] && (porJug[j] || 0) < maxJ;
      if (si) { usado[d] = 1; porJug[j] = (porJug[j] || 0) + 1; r.incluidas++; } else r.personalizadas++;
      r.incluida[cam5Txt_(c.ID)] = si;
    });
    r.libres = (pack || []).filter(function (p) { return !dorsales[cam5Txt_(p.DORSAL)]; });
    r.repetidos = Object.keys(dorsales).filter(function (d) { return Object.keys(dorsales[d].j).length > 1; })
      .map(function (d) { return { DORSAL: d, ids: dorsales[d].ids }; }).sort(cam5Orden_);
    return r;
  }

  /** Sí de un booleano del Excel (true, 'TRUE', 'Sí'…). */
  function cam5Si_(v) { return v === true || /^(true|s[ií]|1)$/i.test(cam5Txt_(v)); }
  /** Importe del Excel → euros, sin redondear (acepta 10, '10,50', '1.234,56 €' o '1234.56'); null si está vacío. */
  function cam5Eur_(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = cam5Txt_(v).replace(/\s|€/g, '');
    if (!s) return null;
    var n = Number(s.indexOf(',') >= 0 ? s.replace(/\./g, '').replace(',', '.') : s);
    return isFinite(n) ? n : null;
  }
  /** Importe del Excel → céntimos; null si está vacío. */
  function cam5Cts_(v) { var n = cam5Eur_(v); return n === null ? null : Math.round(n * 100); }
  /**
   * Lo que hace un proveedor de un modelo (filas de CATALOGO), solo lo que sigue haciendo (ACTIVO no es «no»):
   * { ID_COLOR: { CODIGO, precio (céntimos sin IVA, o null), ID } }.
   */
  function cam5Catalogo_(catalogo, prov, modelo) {
    var m = {};
    (catalogo || []).forEach(function (f) {
      if (!f || !cam5Txt_(f.ID) || cam5Txt_(f.ID_PROVEEDOR) !== cam5Txt_(prov) || cam5Txt_(f.ID_MODELO) !== cam5Txt_(modelo)) return;
      if (f.ACTIVO === false || /^(false|no|0)$/i.test(cam5Txt_(f.ACTIVO))) return;
      m[cam5Txt_(f.ID_COLOR)] = { CODIGO: cam5Txt_(f.CODIGO), precio: cam5Cts_(f.PRECIO), ID: cam5Txt_(f.ID) };
    });
    return m;
  }
  /**
   * Los proveedores que hacen un modelo y, de los colores que se quieren pedir, cuáles no hacen:
   * [{ ID_PROVEEDOR, faltan: [ID_COLOR], colores: n }], primero los que lo tienen todo y después los que tienen más colores.
   */
  function cam5Proveedores_(catalogo, modelo, colores) {
    var provs = [];
    (catalogo || []).forEach(function (f) {
      var p = cam5Txt_(f && f.ID_PROVEEDOR);
      if (p && cam5Txt_(f.ID) && cam5Txt_(f.ID_MODELO) === cam5Txt_(modelo) && provs.indexOf(p) < 0) provs.push(p);
    });
    return provs.map(function (p) {
      var cat = cam5Catalogo_(catalogo, p, modelo);
      return { ID_PROVEEDOR: p, colores: Object.keys(cat).length, faltan: (colores || []).filter(function (c, i, a) { return a.indexOf(c) === i && !cat[cam5Txt_(c)]; }) };
    }).filter(function (x) { return x.colores; }).sort(function (a, b) { return a.faltan.length - b.faltan.length || b.colores - a.colores; });
  }
  /**
   * La tarifa «Camiseta» (lo que se cobra por una personalizada con la inscripción) de una competición: la de TARIFAS con
   * CONCEPTO Camiseta de su temporada, de esa competición o sin REF_ID, vigente ese día ('aaaa-mm-dd'; FECHA_DESDE y
   * FECHA_HASTA). { precio: céntimos sin IVA, iva: %, total: céntimos con IVA (del precio exacto: 8,2645 € + 21 % = 10 €) } o null.
   */
  function cam5Tarifa_(tarifas, comp, temp, dia) {
    var f = function (v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(cam5Txt_(v)) || /^(\d{2})\/(\d{2})\/(\d{4})/.exec(cam5Txt_(v)); return !m ? '' : m[1].length === 4 ? m[1] + '-' + m[2] + '-' + m[3] : m[3] + '-' + m[2] + '-' + m[1]; };
    var l = (tarifas || []).filter(function (t) {
      if (!t || cam5Txt_(t.CONCEPTO) !== 'Camiseta' || cam5Txt_(t.ID_TEMPORADA) !== cam5Txt_(temp)) return false;
      if (cam5Txt_(t.REF_ID) && cam5Txt_(t.REF_ID) !== cam5Txt_(comp)) return false;
      return (!f(t.FECHA_DESDE) || !dia || f(t.FECHA_DESDE) <= dia) && (!f(t.FECHA_HASTA) || !dia || f(t.FECHA_HASTA) >= dia);
    }).sort(function (a, b) { return (cam5Txt_(b.REF_ID) ? 1 : 0) - (cam5Txt_(a.REF_ID) ? 1 : 0) || (f(b.FECHA_DESDE) < f(a.FECHA_DESDE) ? -1 : 1); });
    if (!l.length || cam5Eur_(l[0].PRECIO) === null) return null;
    var iva = parseFloat(cam5Txt_(l[0].TIPO_IVA).replace(',', '.')) || 0;
    return { precio: cam5Cts_(l[0].PRECIO), iva: iva, total: Math.round(cam5Eur_(l[0].PRECIO) * (100 + iva)) };
  }
  // --- fin de las cuentas ---

  var CALC = { stock: cam5Stock_, plan: cam5Plan_, lineas: cam5Lineas_, paso: cam5Paso_, local: cam5Local_, clave: cam5Clave_, orden: cam5Orden_,
    pack: cam5Pack_, leerPack: cam5LeerPack_, incluidas: cam5Incluidas_, catalogo: cam5Catalogo_, proveedores: cam5Proveedores_, tarifa: cam5Tarifa_ };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  var TABLAS = ['CAMISETAS', 'MODELOS', 'COLORES', 'PEDIDOS', 'PEDIDOS_LINEAS', 'AJUSTES_STOCK', 'CONTRAPARTES', 'FACTURAS', 'MODELOS_COMPETICION', 'PACKS', 'CATALOGO', 'TARIFAS'];
  var VISTAS = [['entregas', 'Entregas'], ['stock', 'Stock'], ['pedidos', 'Pedidos'], ['recuento', 'Recuento'], ['temporada', 'Temporada']];
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
    var p = { entregas: pEntregas, stock: pStock, pedidos: pPedidos, recuento: pRecuento, temporada: pTemporada }[S.vista] || pEntregas;
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
      var pk = packEquipo(todas);
      var ver = S.todo[k] || S.filtro === 'todas' ? todas : todas.filter(function (x) { return es(S.filtro)(x) && busca(x); });
      var aDar = todas.filter(function (x) { return !x.q.baja && x.s !== 'Sin camiseta'; }), ent = aDar.filter(function (x) { return x.s === 'Entregada'; }).length;
      var prep = todas.filter(function (x) { return x.s === 'Preparada'; });
      var x0 = todas[0].q;
      return '<section class="cm-eq"><div class="cm-eq-cab"><h2 class="n-grupo">' + punto(x0.colorEq) + texto(x0.equipo || 'Sin equipo') +
        (x0.colorEq ? ' <span class="cm-eq-color">' + texto(nombreColor(x0.colorEq)) + '</span>' : '') + '</h2>' +
        '<span class="u-cifra' + (aDar.length && ent === aDar.length ? ' cm-ok' : '') + '">' + ent + ' de ' + aDar.length + '</span></div>' +
        '<div class="cm-barra" aria-hidden="true"><i style="width:' + (aDar.length ? Math.round(100 * ent / aDar.length) : 100) + '%"></i></div>' +
        '<p class="u-nota cm-eq-sub">' + texto([S.comp.charAt(0) === 'T' ? x0.compNombre : '', x0.liga].filter(String).join(' · ')) + '</p>' +
        htmlProximo(k, ent < aDar.length) + htmlPackEquipo(pk) +
        '<ul class="cm-jugs">' + ver.map(function (x) { return htmlJugadora(x, pk); }).join('') + '</ul>' +
        '<div class="n-botones cm-eq-pie">' +
        (pk ? '<button type="button" class="u-btn u-btn-texto" data-cm-msg="' + texto(k) + '">Mensaje al equipo</button>' : '') +
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

  function htmlJugadora(x, pk) {
    var c = x.c, s = x.s, sig = siguiente(s);
    // T0268: con pack, la que no entra en él es personalizada (se cobra con la inscripción).
    var pers = pk && c.ID in pk.incluida && !pk.incluida[c.ID];
    var est = s === 'recuperar' ? '<span class="n-estado n-e-bl">Por recuperar</span>' : s === 'quitar' ? '<span class="n-estado n-e-bl">Baja: quitar la camiseta</span>' : chipEstado(c.ESTADO);
    // Lo primero, la camiseta (color, dorsal y talla); la jugadora, debajo.
    return '<li class="cm-jug' + (c._pendiente ? ' cm-guardando' : '') + '"><button type="button" class="cm-jug-n" data-cm-cam="' + texto(c.ID) + '"' +
      ' aria-label="' + texto([c.DORSAL ? 'Dorsal ' + c.DORSAL : 'Sin dorsal', c.TALLA, nombreColor(c.ID_COLOR), x.q.jugadora].filter(String).join(', ')) + '">' +
      camiseta(c) + '<span class="cm-jug-t"><span class="cm-jug-c">' + texto((c.DORSAL || '–') + (c.TALLA || '?')) + '</span>' +
      '<span class="cm-jug-p">' + texto(x.q.jugadora || c.ID_INSCRIPCION_JUGADORA) + '</span>' +
      '<span class="cm-jug-e">' + est + (pers ? ' <span class="cm-pers">Personalizada</span>' : '') + (c._pendiente ? ' <span class="u-nota">Guardando…</span>' : c.ESTADO === 'Entregada' && c.FECHA_ENTREGA ? ' <span class="u-nota">' + fecha(c.FECHA_ENTREGA) + '</span>' : '') + '</span></span></button>' +
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
    } else if ((id = b.getAttribute('data-cm-msg'))) {
      ventanaMensaje(id);
    }
  }

  /* ---------- T0268 · pack de camisetas incluidas de un equipo ---------- */

  function packDe(comp) { return cam5Pack_(S.T.filas('PACKS'), comp); }
  function porJugadora(comp) { var x = S.T.filas('MODELOS_COMPETICION').filter(function (m) { return String(m.ID_COMPETICION) === String(comp); })[0]; return x ? x.CAMISETAS_INCLUIDAS : 1; }
  /** Lo incluido de un equipo ([{ c, q }] de Entregas) según el pack de su competición; null si no tiene pack. */
  function packEquipo(todas) {
    var comp = todas[0] && todas[0].q.comp, pack = comp ? packDe(comp) : [];
    if (!pack.length) return null;
    var b = {}; todas.forEach(function (x) { if (x.q.baja) b[x.c.ID_INSCRIPCION_JUGADORA] = true; });
    var r = cam5Incluidas_(todas.map(function (x) { return x.c; }), pack, porJugadora(comp), b);
    r.pack = pack; r.comp = comp;
    return r;
  }
  function cortos(l) { return l.map(cam5Corto_).join(' '); }
  function htmlPackEquipo(pk) {
    if (!pk) return '';
    var N = S.N || { insc: {} }, nom = function (id) { var c = S.T.fila('CAMISETAS', id); return c ? (N.insc[c.ID_INSCRIPCION_JUGADORA] || [''])[0] || id : id; };
    return '<p class="cm-pack-l">' + pk.incluidas + ' incluidas de ' + pk.pack.length + (pk.personalizadas ? ' · <b>' + plural(pk.personalizadas, 'personalizada', 'personalizadas') + '</b>' : '') +
      (pk.libres.length ? ' · le quedan de la lista: <span class="cm-pack-c">' + texto(cortos(pk.libres)) + '</span>' : ' · lista completa') + '</p>' +
      pk.repetidos.map(function (r) { return '<p class="u-mal cm-pack-l">El ' + texto(r.DORSAL) + ' lo llevan ' + texto(r.ids.map(nom).join(' y ')) + ': solo una puede ir incluida.</p>'; }).join('');
  }
  /** Euros con IVA de una tarifa ({ precio, iva }): lo que paga el equipo por cada personalizada. */
  function conIva(t) { return t ? t.total : 0; }
  /**
   * El mensaje para el equipo: las camisetas que tiene gratis con la inscripción (el pack), las que lleva cada jugadora,
   * las personalizadas (con lo que cuestan), los dorsales del pack que le quedan libres y los repetidos.
   */
  function textoMensaje(ie) {
    var todas = S.T.filas('CAMISETAS').map(function (c) { return { c: c, q: quien(c) }; }).filter(function (x) { return x.q.ie === ie; })
      .sort(function (a, b) { return cam5Orden_(a.c, b.c); });
    var pk = packEquipo(todas); if (!pk) return '';
    var q0 = todas[0].q, vivas = todas.filter(function (x) { return x.c.ID in pk.incluida; });
    var tar = cam5Tarifa_(S.T.filas('TARIFAS'), pk.comp, q0.temp, hoy());
    var inc = vivas.filter(function (x) { return pk.incluida[x.c.ID]; }), per = vivas.filter(function (x) { return !pk.incluida[x.c.ID]; });
    var una = function (x) { return cam5Corto_(x.c) + ' ' + (x.q.jugadora || '').split(' ')[0]; };
    var t = ['Camisetas de ' + (q0.equipo || 'vuestro equipo') + (q0.compNombre ? ' · ' + q0.compNombre : ''), '',
      'Con la inscripción tenéis ' + plural(pk.pack.length, 'camiseta gratis', 'camisetas gratis') + ', con estos dorsales y tallas: ' + cortos(pk.pack) + '.'];
    if (inc.length) t.push('', 'Gratis (' + inc.length + '): ' + inc.map(una).join(', ') + '.');
    if (per.length) t.push('', 'Personalizadas (' + per.length + '): ' + per.map(una).join(', ') + '.' +
      (tar ? ' Cada una cuesta ' + eur(conIva(tar)) + ' y va con la inscripción.' : ' Se pagan aparte con la inscripción.'));
    t.push('', pk.libres.length ? 'Dorsales del pack que os quedan libres: ' + cortos(pk.libres) + '. Si alguna elige uno de estos con su talla, le sale gratis.' : 'Ya habéis usado todas las gratis.');
    pk.repetidos.forEach(function (r) {
      t.push('', 'Ojo: el ' + r.DORSAL + ' lo lleváis ' + r.ids.map(function (id) { var x = vivas.filter(function (y) { return y.c.ID === id; })[0]; return x ? (x.q.jugadora || '').split(' ')[0] : id; }).join(' y ') +
        '. Solo una puede ser gratis; la otra es personalizada o tiene que cambiar de dorsal.');
    });
    return t.join('\n');
  }
  function ventanaMensaje(ie) {
    var txt = textoMensaje(ie); if (!txt) return;
    var x = S.T.filas('CAMISETAS').filter(function (c) { return quien(c).ie === ie; })[0];
    ventanaTexto('Mensaje para ' + (x ? quien(x).equipo : 'el equipo'), '<p class="u-nota">Para las capitanas: lo que tienen gratis y los dorsales que les quedan. Cópialo y pégalo en su WhatsApp.</p>', txt, 'Camisetas del equipo');
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
    // Como en la 4.1: los que están en marcha (sin llegar al local) y, aparte, los cerrados.
    var pend = peds.filter(function (p) { return cam5Paso_(p) !== 'recibido'; }), cerr = peds.filter(function (p) { return cam5Paso_(p) === 'recibido'; });
    if (S.ped !== 'cerr') S.ped = 'pend';
    var ver = S.ped === 'cerr' ? cerr : pend;
    h += '<div class="cm-eq-cab"><h2 class="n-grupo">Pedidos de ' + texto(nombreModelo(m)) + '</h2></div>' +
      '<div class="cm-chips cm-ped-f" role="group" aria-label="Qué pedidos">' + [['pend', 'Pendientes', pend.length], ['cerr', 'Cerrados', cerr.length]].map(function (x) {
        return '<button type="button" class="cm-chip" data-cm-ped="' + x[0] + '" aria-pressed="' + (S.ped === x[0]) + '">' + x[1] + ' <span class="u-cifra">' + x[2] + '</span></button>';
      }).join('') + '</div>';
    if (!ver.length) h += '<p class="u-vacio">' + (S.ped === 'cerr' ? 'Ningún pedido de este modelo ha llegado todavía.' : peds.length ? 'No hay pedidos pendientes: todos han llegado al local.' : 'Este modelo no tiene pedidos' + (plan && plan.pedir.length ? '. Con «Preparar pedido» se hace el primero con lo que falta.' : ' todavía.')) + '</p>';
    h += '<ul class="cm-peds">' + ver.map(function (p) { return htmlPedido(p, lineas[p.ID] || [], jug[p.ID] || {}); }).join('') + '</ul>';
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
      var b = e.target.closest('[data-cm-prov]'), k = e.target.closest('[data-cm-cat]');
      if (b) ventanaProveedor(b.getAttribute('data-cm-prov'));
      else if (k) ventanaCatalogo(k.getAttribute('data-cm-cat'));
    };
    c.querySelector('.cm-ped-f').onclick = function (e) { var b = e.target.closest('[data-cm-ped]'); if (b) { S.ped = b.getAttribute('data-cm-ped'); pintar(false); } };
    c.querySelector('.cm-peds').onclick = function (e) {
      var b = e.target.closest('[data-cm-p]'); if (!b) return;
      var id = b.getAttribute('data-cm-p'), acc = b.getAttribute('data-cm-acc');
      if (acc === 'extracto') ventanaExtracto(id);
      else if (acc === 'pdf') pdfPedido(id);
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
  /**
   * Un pedido, en pocas líneas (Javi: minimalista): número y estado, proveedor y fechas, lo que falta para el siguiente
   * paso y cómo van sus camisetas con las jugadoras. Lo demás (colores y tallas, lo pagado, notas, extracto y factura),
   * plegado en «Detalle». A la vista, solo el botón del paso siguiente y el PDF.
   */
  function htmlPedido(p, lineas, jug) {
    var paso = cam5Paso_(p), unidades = lineas.reduce(function (s, l) { return s + (Number(l.CANTIDAD) || 0); }, 0);
    var porColor = {}, orden = [];
    lineas.slice().sort(cam5Orden_).forEach(function (l) {
      if (!porColor[l.ID_COLOR]) { porColor[l.ID_COLOR] = { n: 0, t: {} }; orden.push(l.ID_COLOR); }
      porColor[l.ID_COLOR].n += Number(l.CANTIDAD) || 0;
      porColor[l.ID_COLOR].t[l.TALLA] = (porColor[l.ID_COLOR].t[l.TALLA] || 0) + (Number(l.CANTIDAD) || 0);
    });
    var nuevo = !!p._nueva, id = texto(p.ID);
    var conJug = Object.keys(jug).filter(function (e) { return e !== 'Sin camiseta'; }).reduce(function (n, e) { return n + jug[e]; }, 0), ent = jug['Entregada'] || 0;
    var falta = paso === 'sinConfirmar' ? 'Falta mandarlo al proveedor y marcarlo confirmado.' :
      paso === 'confirmado' ? 'Esperando a que llegue' + (p.FECHA_ESTIMADA ? ' (hacia el ' + fecha(p.FECHA_ESTIMADA) + ')' : '') + '.' : 'Llegó el ' + fecha(p.FECHA_RECIBIDO) + '.';
    var raro = paso !== 'recibido' && !nuevo && (jug['Por preparar'] || jug['Preparada'] || jug['Entregada']);
    return '<li class="cm-ped' + (p._pendiente ? ' cm-guardando' : '') + '"><div class="cm-ped-cab"><b>' + texto(nuevo ? 'Pedido nuevo' : p.ID) + '</b>' +
      '<span class="n-estado n-e-' + PASOS[paso][1] + '">' + PASOS[paso][0] + '</span></div>' +
      '<p class="u-nota">' + texto([p.ID_PROVEEDOR ? nombreProveedor(p.ID_PROVEEDOR) : '', unidades ? plural(unidades, 'camiseta', 'camisetas') : '', p.FECHA_PEDIDO ? 'pedido el ' + fecha(p.FECHA_PEDIDO) : ''].filter(String).join(' · ')) + '</p>' +
      (nuevo ? '<p class="u-nota">Creando el pedido, sus líneas y las camisetas en el Excel…</p>' :
        '<p class="cm-ped-l1">' + texto(falta) + (conJug ? ' Jugadoras: <b>' + ent + ' de ' + conJug + '</b> entregadas.' : unidades ? ' Para el local.' : '') + '</p>' +
        (raro ? '<p class="u-mal">Ya hay camisetas suyas en el local y no consta como llegado: márcalo con «Ha llegado».</p>' : '') +
        '<details class="cm-ped-det"><summary>Detalle</summary>' +
        (orden.length ? '<ul class="cm-ped-l">' + orden.map(function (col) {
          var x = porColor[col];
          return '<li>' + punto(col) + '<b>' + texto(nombreColor(col)) + '</b> <span class="u-cifra">' + x.n + '</span> <span class="u-nota">' +
            CAM5_TALLAS.concat(Object.keys(x.t).filter(function (t) { return CAM5_TALLAS.indexOf(t) < 0; })).filter(function (t) { return x.t[t]; }).map(function (t) { return t + ' ' + x.t[t]; }).join(' · ') + '</span></li>';
        }).join('') + '</ul>' : '') +
        (conJug > ent ? '<p class="u-nota">Por entregar: ' + Object.keys(jug).filter(function (e) { return e !== 'Entregada' && e !== 'Sin camiseta'; }).map(function (e) {
          var x = ESTADOS.filter(function (y) { return y[0] === e; })[0]; return jug[e] + ' ' + (jug[e] === 1 || !x ? e : x[1]).toLowerCase();
        }).join(' · ') + '</p>' : '') +
        htmlCoste(p) + (p.NOTAS ? '<p class="u-nota">' + texto(p.NOTAS) + '</p>' : '') +
        (/^https?:\/\//.test(String(p.ARCHIVO_URL || '')) ? '<p><a href="' + texto(p.ARCHIVO_URL) + '" target="_blank" rel="noopener">Ver el documento del pedido</a></p>' : '') +
        '<div class="n-botones"><button type="button" class="u-btn u-btn-texto" data-cm-p="' + id + '" data-cm-acc="extracto">Extracto en texto</button>' +
        '<button type="button" class="u-btn u-btn-texto" data-cm-p="' + id + '" data-cm-acc="factura">' + (p.ID_FACTURA ? 'Cambiar factura' : 'Enlazar factura') + '</button></div></details>' +
        '<div class="n-botones">' + (paso === 'sinConfirmar' ? '<button type="button" class="u-btn" data-cm-p="' + id + '" data-cm-acc="confirmar">Marcar confirmado</button>' :
          paso === 'confirmado' ? '<button type="button" class="u-btn" data-cm-p="' + id + '" data-cm-acc="llegado">Ha llegado</button>' : '') +
        '<button type="button" class="u-btn' + (paso === 'recibido' ? '' : ' u-btn-texto') + '" data-cm-p="' + id + '" data-cm-acc="pdf">PDF para el proveedor</button></div>') + '</li>';
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
  /** El código del color: el del proveedor en su catálogo (T0268) o, si no lo tiene, el de COLORES. */
  function codigoColor(id, prov, modelo) {
    var c = prov && modelo ? cam5Catalogo_(S.T.filas('CATALOGO'), prov, modelo)[id] : null;
    return (c && c.CODIGO) || color(id).CODIGO || '';
  }

  function ventanaPedir(m, plan) {
    var Dd = D(), porId = {}; Dd.CAMISETAS.forEach(function (x) { porId[x.ID] = x; });
    var lin = cam5Lineas_(plan.pedir.map(function (id) { return porId[id]; }));
    var temps = (S.N && S.N.temp) || [];
    var v = ventana('<h2>Preparar pedido</h2><p class="u-nota">' + texto(nombreModelo(m)) + ': ' + plural(plan.pedir.length, 'camiseta', 'camisetas') +
      (plan.local.length === 1 ? '. Antes se da la que tiene una libre en el local.' : plan.local.length ? '. Antes se dan las ' + plan.local.length + ' que tienen una libre en el local.' : '.') + ' El pedido queda sin confirmar hasta que lo confirme el proveedor.</p>' +
      selProveedor(m, lin, 'pp') + '<div id="pp-lineas"></div><div class="u-campos">' +
      campo('Temporada', '<select id="pp-temp">' + opciones(temps.map(function (t) { return [t[0], t[1]]; }), (temps[0] || [])[0]) + '</select>') +
      campo('Llega hacia el (opcional)', '<input type="date" id="pp-est">') +
      campo('Notas (opcional)', '<input type="text" id="pp-notas" maxlength="200">') + '</div>' +
      '<p class="u-error" hidden></p>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="pp-ok">Crear pedido</button><button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cancelar</button></div>');
    var sp = v.querySelector('#pp-prov');
    engancharProveedor(v, m, lin, 'pp');
    v.querySelector('#pp-ok').disabled = !sp;
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

  /* ---------- T0268 · proveedor del pedido según su catálogo ---------- */

  /**
   * El desplegable de proveedor de un pedido de un modelo con esas líneas: solo los que hacen el modelo (CATALOGO); los que
   * no hacen alguno de sus colores salen sin poder elegirse, con lo que les falta. Primero el habitual, si puede.
   */
  function selProveedor(m, lin, pre) {
    var cols = lin.map(function (l) { return String(l.ID_COLOR); });
    var cand = cam5Proveedores_(S.T.filas('CATALOGO'), m, cols).filter(function (x) { return S.T.fila('CONTRAPARTES', x.ID_PROVEEDOR); });
    var habitual = String((S.T.fila('MODELOS', m) || {}).ID_PROVEEDOR || ''), valen = cand.filter(function (x) { return !x.faltan.length; });
    if (!valen.some(function (x) { return x.ID_PROVEEDOR === habitual; })) habitual = valen.length ? valen[0].ID_PROVEEDOR : '';
    if (!cand.length) return '<p class="u-mal">Ningún proveedor tiene ' + texto(nombreModelo(m)) + ' en su catálogo. Añádelo en «Proveedores › Catálogo», abajo en esta pestaña, y después prepara el pedido.</p>';
    if (!valen.length) {
      return '<p class="u-mal">Ningún proveedor hace ' + texto(nombreModelo(m)) + ' en todos estos colores: ' + texto(cand.map(function (x) {
        return nombreProveedor(x.ID_PROVEEDOR) + ' no hace ' + x.faltan.map(nombreColor).join(', ');
      }).join('; ')) + '. Completa su catálogo en «Proveedores › Catálogo».</p>';
    }
    return '<div class="u-campos">' + campo('Proveedor', '<select id="' + pre + '-prov">' + cand.map(function (x) {
      var u = ultimoPrecio(x.ID_PROVEEDOR, m), nom = nombreProveedor(x.ID_PROVEEDOR);
      return '<option value="' + texto(x.ID_PROVEEDOR) + '"' + (x.ID_PROVEEDOR === habitual ? ' selected' : '') + (x.faltan.length ? ' disabled' : '') + '>' +
        texto(nom + (x.ID_PROVEEDOR === String((S.T.fila('MODELOS', m) || {}).ID_PROVEEDOR || '') ? ' · habitual' : '') +
          (x.faltan.length ? ' · no hace ' + x.faltan.map(nombreColor).join(', ') : u ? ' · último ' + eur(u.unidad) : '')) + '</option>';
    }).join('') + '</select>') + '</div><div id="' + pre + '-contacto"></div>';
  }
  /** Al elegir proveedor: su contacto, su último precio y las líneas con su código y su precio de catálogo. */
  function engancharProveedor(v, m, lin, pre) {
    var sp = v.querySelector('#' + pre + '-prov'), pc = v.querySelector('#' + pre + '-contacto'), pl = v.querySelector('#' + pre + '-lineas');
    var ver = function () {
      var prov = sp ? sp.value : '', cat = prov ? cam5Catalogo_(S.T.filas('CATALOGO'), prov, m) : {};
      if (pc) {
        var u = prov ? ultimoPrecio(prov, m) : null;
        pc.innerHTML = prov ? contactoProveedor(prov) + '<p class="u-nota">' + (u ? 'Último precio pagado: <b>' + eur(u.unidad) + '/camiseta</b> sin IVA (' + texto(u.p.ID) + ').' : 'Ningún pedido suyo de este modelo tiene factura todavía.') + '</p>' : '';
      }
      if (!pl) return;
      // Con data-resumen (el pack: muchas líneas iguales), solo el total; si no, la tabla con el código de ese proveedor.
      var total = 0, sinPrecio = 0, n = 0, filas = lin.map(function (l) {
        var c = cat[l.ID_COLOR], cod = (c && c.CODIGO) || color(l.ID_COLOR).CODIGO || '';
        n += l.CANTIDAD;
        if (c && c.precio !== null) total += c.precio * l.CANTIDAD; else sinPrecio += l.CANTIDAD;
        return '<tr><td>' + punto(l.ID_COLOR) + texto(nombreColor(l.ID_COLOR)) + (cod ? ' <span class="u-nota">' + texto(cod) + '</span>' : '') + '</td><td>' + texto(l.DORSAL || '—') + '</td><td>' + texto(l.TALLA) + '</td><td class="num">' + l.CANTIDAD + '</td></tr>';
      });
      pl.innerHTML = (pl.hasAttribute('data-resumen') ? '' : '<div class="u-tabla-caja"><table class="u-tabla"><thead><tr><th>Color (código)</th><th>Dorsal</th><th>Talla</th><th class="num">Cuántas</th></tr></thead><tbody>' +
        filas.join('') + '</tbody></table></div>') +
        (prov ? '<p class="u-nota">' + plural(n, 'camiseta', 'camisetas') + (total ? ' · según su tarifa, <b>' + eur(total) + '</b> sin IVA' : '') +
          (sinPrecio ? ' · ' + plural(sinPrecio, 'sin precio en su catálogo', 'sin precio en su catálogo') : '') + '</p>' : '');
    };
    if (sp) sp.onchange = ver;
    ver();
  }
  /** Lo que hace un proveedor, por modelo: «VAPIANO-SALERM 25-26: 15 colores · 4,50 €». */
  function htmlHace(prov) {
    var mods = {};
    S.T.filas('CATALOGO').forEach(function (f) { if (String(f.ID_PROVEEDOR) === String(prov)) mods[f.ID_MODELO] = 1; });
    var l = Object.keys(mods).map(function (m) {
      var cat = cam5Catalogo_(S.T.filas('CATALOGO'), prov, m), cs = Object.keys(cat), pr = cs.map(function (k) { return cat[k].precio; }).filter(function (x) { return x !== null; });
      if (!cs.length) return '';
      var min = pr.length ? Math.min.apply(null, pr) : null, max = pr.length ? Math.max.apply(null, pr) : null;
      return nombreModelo(m) + ': ' + plural(cs.length, 'color', 'colores') + (min === null ? '' : ' · ' + eur(min) + (max !== min ? ' a ' + eur(max) : ''));
    }).filter(String);
    return '<span class="u-nota">' + (l.length ? 'Hace ' + texto(l.join(' · ')) : 'Sin catálogo: no se le puede hacer ningún pedido') + '</span>';
  }

  /** El catálogo de un proveedor: de un modelo, qué colores hace, con su código y su precio. */
  function ventanaCatalogo(prov) {
    var mods = S.T.filas('MODELOS').slice().sort(function (a, b) { return norm(a.NOMBRE) < norm(b.NOMBRE) ? -1 : 1; });
    if (!mods.length) { S.ctx.aviso('Primero da de alta algún modelo en «Modelos».'); return; }
    var hace = mods.filter(function (m) { return S.T.filas('CATALOGO').some(function (f) { return String(f.ID_PROVEEDOR) === String(prov) && String(f.ID_MODELO) === String(m.ID); }); });
    var m0 = String((hace[0] || mods.filter(function (m) { return m.ID === S.modelo; })[0] || mods[0]).ID);
    var v = ventana('<h2>Catálogo de ' + texto(nombreProveedor(prov)) + '</h2>' +
      '<p class="u-nota">Marca los colores en que hace el modelo, con su código de color (el que va en el extracto) y su precio por camiseta sin IVA, según su tarifa. El modelo es el mismo para todos los proveedores.</p>' +
      '<div class="u-campos cm-una">' + campo('Modelo', '<select id="ct-mod">' + opciones(mods.map(function (m) { return [m.ID, m.NOMBRE + (hace.indexOf(m) >= 0 ? '' : ' · no lo hace')]; }), m0) + '</select>') + '</div>' +
      '<div class="cm-ct-todos">' + campo('Mismo precio para todos', '<input type="text" id="ct-todos" inputmode="decimal" placeholder="4,50">') + '<button type="button" class="u-btn" id="ct-pon">Poner</button></div>' +
      '<div id="ct-cols"></div><p class="u-error" hidden></p>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="ct-ok">Guardar</button><button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cancelar</button></div>');
    var sm = v.querySelector('#ct-mod'), cols = v.querySelector('#ct-cols');
    var filas = function () { return S.T.filas('CATALOGO').filter(function (f) { return String(f.ID_PROVEEDOR) === String(prov) && String(f.ID_MODELO) === sm.value; }); };
    var pintarCols = function () {
      var ya = {}; filas().forEach(function (f) { ya[f.ID_COLOR] = f; });
      cols.innerHTML = '<ul class="cm-lista-ok cm-ct">' + S.T.filas('COLORES').map(function (c) {
        var f = ya[c.ID], si = f && !(f.ACTIVO === false || /^(false|no)$/i.test(String(f.ACTIVO))), pr = f ? cam5Cts_(f.PRECIO) : null;
        return '<li><label class="u-check"><input type="checkbox" data-ct-si="' + texto(c.ID) + '"' + (si ? ' checked' : '') + '> ' + punto(c.ID) + texto(c.NOMBRE) + '</label>' +
          '<input type="text" class="cm-ct-cod" data-ct-cod="' + texto(c.ID) + '" maxlength="30" placeholder="' + texto(c.CODIGO || 'Código') + '" value="' + texto(f ? f.CODIGO : '') + '" aria-label="Código de ' + texto(c.NOMBRE) + '">' +
          '<input type="text" class="cm-ct-pre" data-ct-pre="' + texto(c.ID) + '" inputmode="decimal" placeholder="€" value="' + texto(pr === null ? '' : (pr / 100).toFixed(2).replace('.', ',')) + '" aria-label="Precio de ' + texto(c.NOMBRE) + '"></li>';
      }).join('') + '</ul>';
    };
    sm.onchange = pintarCols; pintarCols();
    v.querySelector('#ct-pon').onclick = function () {
      var t = v.querySelector('#ct-todos').value.trim();
      [].forEach.call(v.querySelectorAll('[data-ct-pre]'), function (x) { if (v.querySelector('[data-ct-si="' + x.getAttribute('data-ct-pre') + '"]').checked) x.value = t; });
    };
    v.querySelector('#ct-ok').onclick = function () {
      var err = v.querySelector('.u-error'), ya = {}, p = [], mal = '';
      filas().forEach(function (f) { ya[f.ID_COLOR] = f; });
      S.T.filas('COLORES').forEach(function (c) {
        var si = v.querySelector('[data-ct-si="' + c.ID + '"]').checked, cod = v.querySelector('[data-ct-cod="' + c.ID + '"]').value.trim();
        var tp = v.querySelector('[data-ct-pre="' + c.ID + '"]').value.trim(), pr = tp ? cam5Cts_(tp) : null, f = ya[c.ID];
        if (tp && (pr === null || pr < 0)) mal = 'El precio de ' + c.NOMBRE + ' no es un importe (p. ej. 4,50).';
        var d = { CODIGO: cod, PRECIO: pr === null ? '' : pr / 100, ACTIVO: si };
        if (f) {
          var cambios = {};
          if (String(f.CODIGO || '') !== cod) cambios.CODIGO = cod;
          if (cam5Cts_(f.PRECIO) !== pr) cambios.PRECIO = d.PRECIO;
          if (cam5Si_(f.ACTIVO === '' || f.ACTIVO === undefined ? true : f.ACTIVO) !== si) cambios.ACTIVO = si;
          if (Object.keys(cambios).length) p.push(['a', f.ID, cambios]);
        } else if (si) p.push(['c', null, { ID_PROVEEDOR: prov, ID_MODELO: sm.value, ID_COLOR: c.ID, CODIGO: cod, PRECIO: d.PRECIO, ACTIVO: true }]);
      });
      if (mal) { err.textContent = mal; err.hidden = false; return; }
      cerrarVentana();
      if (!p.length) return;
      Promise.all(p.map(function (x) { return x[0] === 'a' ? S.T.actualizar('CATALOGO', x[1], x[2]) : S.T.crear('CATALOGO', x[2]); }))
        .then(function () { S.ctx.aviso('Catálogo de ' + nombreProveedor(prov) + ' guardado.'); }, function () {});
    };
  }

  /* ---------- T0268 · packs de camisetas incluidas y lo cobrado por las personalizadas ---------- */

  /** Las competiciones de un modelo (MODELOS_COMPETICION), de la temporada más reciente a la más antigua. */
  function compsPack(m) {
    var orden = ((S.N && S.N.temp) || []).map(function (t) { return t[0]; });
    var tDe = function (k) { var x = S.N && S.N.comp && S.N.comp[k]; return x ? orden.indexOf(x[1]) : 999; };
    return compsDeModelo(m).map(function (x) { return String(x.ID_COMPETICION); }).sort(function (a, b) { return (tDe(a) < 0 ? 999 : tDe(a)) - (tDe(b) < 0 ? 999 : tDe(b)) || (nombreComp(a) < nombreComp(b) ? -1 : 1); });
  }
  /**
   * Lo de una competición: equipo a equipo, sus camisetas y cuáles son gratis o personalizadas. La cuenta es una sola, la
   * del pack (cam5Incluidas_); el Excel (CAMISETAS · INCLUIDA) solo sale como aviso si no está apuntado igual.
   * { pack, equipos: [{ ie, nombre, color, baja, pk, n, gratis, pers }], tar, camisetas, gratis, pers, distintas }.
   * Sin pack, todas las camisetas cuentan como personalizadas.
   */
  function datosPack(comp) {
    var N = S.N || { eq: {}, comp: {} }, pack = packDe(comp), porEq = {}, temp = (N.comp[comp] || ['', ''])[1];
    Object.keys(N.eq).forEach(function (ie) { if (N.eq[ie][1] === comp) porEq[ie] = []; });
    S.T.filas('CAMISETAS').forEach(function (c) { var q = quien(c); if (q.comp === comp && q.ie) (porEq[q.ie] = porEq[q.ie] || []).push({ c: c, q: q }); });
    var r = { pack: pack, equipos: [], tar: cam5Tarifa_(S.T.filas('TARIFAS'), comp, temp, hoy()), camisetas: 0, gratis: 0, pers: 0, distintas: 0 };
    Object.keys(porEq).forEach(function (ie) {
      var l = porEq[ie], e = N.eq[ie] || ['', '', '', '', ''];
      var vivas = l.filter(function (x) { return x.c.ESTADO !== 'Sin camiseta' && !x.q.baja; });
      var pk = pack.length && l.length ? packEquipo(l) : null;
      var gratis = pk ? pk.incluidas : 0, pers = pk ? pk.personalizadas : vivas.length;
      if (pk) l.forEach(function (x) { if (x.c.ID in pk.incluida && pk.incluida[x.c.ID] !== cam5Si_(x.c.INCLUIDA)) r.distintas++; });
      r.camisetas += vivas.length; r.gratis += gratis; r.pers += pers;
      r.equipos.push({ ie: ie, nombre: e[0] || ie, color: e[3], baja: e[4] === 'Baja', pk: pk, n: vivas.length, gratis: gratis, pers: pers });
    });
    r.equipos.sort(function (a, b) { return norm(a.nombre) < norm(b.nombre) ? -1 : 1; });
    return r;
  }
  /* ======================= Temporada: preparar las camisetas de cada competición ======================= */

  /** La competición de la temporada anterior que se llama igual (LIGA, SENIOR…), si la hay: para copiar su lista. */
  function compAnterior(comp) {
    var N = S.N, t = (N.temp || []).map(function (x) { return x[0]; }), yo = N.comp[comp]; if (!yo) return '';
    var ant = t[t.indexOf(yo[1]) + 1]; if (!ant) return '';
    return Object.keys(N.comp).filter(function (k) { return N.comp[k][1] === ant && norm(N.comp[k][0]).trim() === norm(yo[0]).trim(); })[0] || '';
  }
  function modeloDe(comp) { var x = S.T.filas('MODELOS_COMPETICION').filter(function (m) { return String(m.ID_COMPETICION) === String(comp); })[0]; return x || null; }
  function pTemporada(c) {
    if (!S.N) { c.innerHTML = '<div class="kz-centro cm-carga" role="status"><div class="u-carga"></div><span class="u-nota">Cargando las temporadas y sus competiciones…</span></div>'; return; }
    var temps = S.N.temp || [];
    if (!temps.some(function (t) { return t[0] === S.temp; })) S.temp = (temps[0] || [''])[0];
    var comps = Object.keys(S.N.comp).filter(function (k) { return S.N.comp[k][1] === S.temp; }).sort(function (a, b) { return norm(S.N.comp[a][0]) < norm(S.N.comp[b][0]) ? -1 : 1; });
    var mods = S.T.filas('MODELOS').slice().sort(function (a, b) { return norm(a.NOMBRE) < norm(b.NOMBRE) ? -1 : 1; });
    var copiables = comps.filter(function (k) { var a = compAnterior(k); return !packDe(k).length && a && packDe(a).length; });
    var h = '<div class="u-filtros cm-filtros">' + campo('Temporada', '<select id="cm-temp">' + opciones(temps.map(function (t) { return [t[0], t[1]]; }), S.temp) + '</select>') + '</div>' +
      '<details class="cm-temp-intro"><summary>Cómo se prepara una temporada</summary><ol>' +
      '<li><b>Modelo</b> de cada competición (la camiseta de este año; los modelos se dan de alta en Pedidos › Modelos).</li>' +
      '<li><b>Camisetas que incluye la inscripción</b>: los dorsales con su talla que entran en el precio de cada equipo. Cualquier otra es <b>personalizada</b> y se paga con la inscripción.</li>' +
      '<li><b>Pedido para el local</b>, si quieres camisetas antes de que las jugadoras elijan.</li></ol>' +
      '<p class="u-nota">Las competiciones son las del Excel COMPETICION; aquí solo se preparan sus camisetas.</p></details>' +
      (copiables.length ? '<p><button type="button" class="u-btn u-btn-texto cm-en-linea" id="cm-copiar-todas">Copiar las listas de la temporada anterior (' + copiables.length + ')</button></p>' : '');
    if (!comps.length) h += '<p class="u-vacio">Esta temporada todavía no tiene competiciones.</p>';
    h += '<ul class="cm-peds cm-temp">' + comps.map(function (k) {
      var d = datosPack(k), mc = modeloDe(k), ant = compAnterior(k), pa = ant ? packDe(ant) : [];
      var conCamisetas = S.T.filas('CAMISETAS').some(function (x) { return quien(x).comp === k; });
      var b = function (acc, t) { return '<button type="button" class="u-btn u-btn-texto cm-en-linea" data-cm-tc="' + texto(k) + '" data-cm-acc="' + acc + '">' + t + '</button>'; };
      var vivos = d.equipos.filter(function (e) { return !e.baja; }).length, u = conIva(d.tar);
      return '<li class="cm-ped"><div class="cm-ped-cab"><b>' + texto(S.N.comp[k][0]) + '</b><span class="u-nota">' + plural(vivos, 'equipo', 'equipos') + '</span></div>' +
        dl([
          ['Modelo', conCamisetas && mc ? texto(nombreModelo(mc.ID_MODELO)) :
            '<select data-cm-tmod="' + texto(k) + '" aria-label="Modelo de ' + texto(S.N.comp[k][0]) + '"><option value="">Elige el modelo</option>' + opciones(mods.map(function (m) { return [m.ID, m.NOMBRE]; }), mc ? mc.ID_MODELO : '') + '</select>'],
          ['Incluye', (d.pack.length ? '<span class="cm-pack-c">' + texto(cortos(d.pack)) + '</span> ' + b('editar', 'Cambiar') : '<span class="u-mal">Sin lista</span> ' + b('editar', 'Poner la lista')) +
            (pa.length && cortos(pa) !== cortos(d.pack) ? ' · ' + b('copiar', 'Copiar la del año pasado') : '')],
          ['Personalizadas', d.camisetas ? '<b>' + d.pers + '</b> de ' + d.camisetas + ' camisetas' + (d.pers ? (d.tar ? ' · ' + eur(u * d.pers) : ' · <span class="u-mal">sin tarifa</span>') : '') +
            ' · ' + b('cobro', 'Equipo a equipo') : '<span class="u-nota">Sin camisetas todavía</span>'],
          ['Pedido local', mc ? b('pedir', 'Hacer pedido para el local') : '<span class="u-nota">Primero, el modelo</span>']
        ]) + '</li>';
    }).join('') + '</ul>';
    c.innerHTML = h;
    c.querySelector('#cm-temp').onchange = function () { S.temp = this.value; pintar(true); };
    var todas = c.querySelector('#cm-copiar-todas');
    if (todas) todas.onclick = function () {
      todas.disabled = true; todas.textContent = 'Copiando…';
      copiables.reduce(function (pr, k) { return pr.then(function () { return S.ctx.llamar('camisetas5Pack', [k, packDe(compAnterior(k))]); }); }, Promise.resolve())
        .then(function () { S.ctx.aviso(plural(copiables.length, 'lista copiada', 'listas copiadas') + ' de la temporada anterior.'); return S.T.refrescar(['PACKS', 'CAMISETAS'], true); })
        .catch(function (e) { S.ctx.aviso('No se ha podido copiar: ' + String(e.message).replace(/^\w+:\s*/, '')); pintar(false); });
    };
    c.onchange = function (e) {
      var k = e.target.getAttribute('data-cm-tmod'); if (!k) return;
      var mc = modeloDe(k), nuevo = e.target.value;
      (mc ? S.T.borrar('MODELOS_COMPETICION', mc.ID) : Promise.resolve())
        .then(function () { return nuevo ? S.T.crear('MODELOS_COMPETICION', { ID_COMPETICION: k, ID_MODELO: nuevo, CAMISETAS_INCLUIDAS: mc ? Number(mc.CAMISETAS_INCLUIDAS) || 1 : 1 }) : null; })
        .then(function () { S.ctx.aviso(nuevo ? nombreComp(k) + ' lleva ' + nombreModelo(nuevo) + '.' : nombreComp(k) + ' ya no tiene modelo.'); }, function () {});
    };
    c.onclick = function (e) {
      var b = e.target.closest('[data-cm-tc]'); if (!b) return;
      var k = b.getAttribute('data-cm-tc'), acc = b.getAttribute('data-cm-acc');
      if (acc === 'editar') ventanaPack(k);
      else if (acc === 'pedir') ventanaPedirPack(k);
      else if (acc === 'cobro') ventanaCobro(k);
      else if (acc === 'copiar') {
        b.disabled = true; b.textContent = 'Copiando…';
        S.ctx.llamar('camisetas5Pack', [k, packDe(compAnterior(k))]).then(function () { S.ctx.aviso('Lista copiada.'); return S.T.refrescar(['PACKS', 'CAMISETAS'], true); })
          .catch(function (er) { S.ctx.aviso('No se ha podido copiar: ' + String(er.message).replace(/^\w+:\s*/, '')); pintar(false); });
      }
    };
  }
  function ventanaPack(comp) {
    var pack = packDe(comp), otras = Object.keys((S.N && S.N.comp) || {}).filter(function (k) { return k !== comp && packDe(k).length; });
    var v = ventana('<h2>Camisetas que incluye la inscripción · ' + texto(nombreComp(comp)) + '</h2>' +
      '<p class="u-nota">Los dorsales que entran con la inscripción, cada uno con su talla, separados por comas: 1S, 2S, 3S, 4M… Cada dorsal, una sola vez. Vale para todos los equipos de la competición.</p>' +
      (otras.length ? '<div class="u-campos cm-una">' + campo('Copiar la de otra competición', '<select id="pk-de"><option value="">—</option>' + opciones(otras.map(function (k) { return [k, nombreComp(k)]; }), '') + '</select>') + '</div>' : '') +
      '<div class="u-campos cm-una">' + campo('Dorsal y talla', '<textarea id="pk-t" rows="3" autocomplete="off">' + texto(cortos(pack).split(' ').filter(String).join(', ')) + '</textarea>') + '</div>' +
      '<p class="cm-pack-c" id="pk-ver"></p><p class="u-error" hidden></p>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="pk-ok">Guardar</button><button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cancelar</button></div>');
    var t = v.querySelector('#pk-t'), ver = v.querySelector('#pk-ver'), err = v.querySelector('.u-error'), de = v.querySelector('#pk-de');
    var leer = function () { var l = cam5LeerPack_(t.value); ver.textContent = l.pack.length ? plural(l.pack.length, 'camiseta incluida', 'camisetas incluidas') + ' por equipo: ' + cortos(l.pack) : ''; err.hidden = !l.mal.length; err.textContent = l.mal.length ? 'No entiendo: ' + l.mal.join(', ') + ' (cada una es un dorsal y una talla, sin repetir dorsal).' : ''; return l; };
    t.oninput = leer; leer();
    if (de) de.onchange = function () { if (de.value) { t.value = cortos(packDe(de.value)).split(' ').join(', '); leer(); } };
    v.querySelector('#pk-ok').onclick = function () {
      var l = leer(); if (l.mal.length) return;
      var ok = this; ok.disabled = true; ok.textContent = 'Guardando…';
      S.ctx.llamar('camisetas5Pack', [comp, l.pack]).then(function (r) {
        cerrarVentana();
        S.ctx.aviso(nombreComp(comp) + ': ' + plural(r.pack, 'camiseta incluida', 'camisetas incluidas') + ' por equipo.');
        return S.T.refrescar(['PACKS', 'CAMISETAS'], true);
      }).catch(function (e) { ok.disabled = false; ok.textContent = 'Volver a probar'; err.textContent = 'No se ha guardado: ' + String(e.message).replace(/^\w+:\s*/, ''); err.hidden = false; });
    };
  }
  /** Equipo a equipo: gratis, personalizadas, lo que se cobra y los dorsales gratis que le quedan. */
  function ventanaCobro(comp) {
    var d = datosPack(comp), u = conIva(d.tar), tg = 0, tp = 0;
    ventana('<h2>' + texto(nombreComp(comp)) + ' · equipo a equipo</h2>' +
      '<p class="u-nota">' + (d.tar ? 'Cada personalizada paga ' + eur(u) + ' con la inscripción.' : 'Falta la tarifa «Camiseta» de esta temporada en Economía.') + ' Debajo de cada equipo, los dorsales de la lista que todavía puede elegir.</p>' +
      '<div class="u-tabla-caja"><table class="u-tabla cm-cobro"><thead><tr><th>Equipo</th><th class="num">Incluidas</th><th class="num">Personalizadas</th><th class="num">A cobrar</th></tr></thead><tbody>' +
      d.equipos.map(function (e) {
        tg += e.gratis; tp += e.pers;
        return '<tr><td class="u-tabla-t">' + punto(e.color) + texto(e.nombre) + (e.baja ? ' <span class="u-nota">(baja)</span>' : '') +
          (e.pk ? '<span class="u-nota cm-cobro-l">Dorsales de la lista que le quedan: ' + (texto(cortos(e.pk.libres)) || 'ninguna') + '</span>' : '') +
          (e.pk && e.pk.repetidos.length ? '<span class="u-mal cm-cobro-l">Dorsal repetido: ' + texto(e.pk.repetidos.map(function (r) { return r.DORSAL; }).join(', ')) + '</span>' : '') + '</td>' +
          '<td class="num">' + (d.pack.length ? e.gratis : '—') + '</td><td class="num">' + e.pers + '</td><td class="num">' + (e.pers && d.tar ? eur(u * e.pers) : '') + '</td></tr>';
      }).join('') + '<tr><td><b>Total</b></td><td class="num"><b>' + (d.pack.length ? tg : '—') + '</b></td><td class="num"><b>' + tp + '</b></td><td class="num"><b>' + (d.tar ? eur(u * tp) : '') + '</b></td></tr></tbody></table></div>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cerrar</button></div>');
  }
  /**
   * Pedido para el local de una competición, a medida: una tabla con los dorsales y tallas (de entrada, la lista que incluye
   * la inscripción) y una columna por color, con cuántas pedir de cada uno. Arriba, cuántos equipos hay de cada color: es lo
   * que se pone de entrada en cada casilla (una por equipo) mientras no se cambie a mano. Se pueden añadir dorsales que no
   * están en la lista. Al llegar, quedan libres en el local.
   */
  function ventanaPedirPack(comp) {
    var d = datosPack(comp), mc = S.T.filas('MODELOS_COMPETICION').filter(function (x) { return String(x.ID_COMPETICION) === comp; })[0], m = mc ? String(mc.ID_MODELO) : '';
    var eqs = {}; d.equipos.forEach(function (e) { if (!e.baja && e.color) eqs[e.color] = (eqs[e.color] || 0) + 1; });
    var filas = d.pack.map(function (x) { return { DORSAL: x.DORSAL, TALLA: x.TALLA }; }), mano = {};
    var temps = (S.N && S.N.temp) || [], tComp = ((S.N && S.N.comp[comp]) || ['', ''])[1];
    var v = ventana('<h2>Pedido para el local · ' + texto(nombreComp(comp)) + '</h2>' +
      '<p class="u-nota">Camisetas para tener en el local antes de que las jugadoras elijan; al llegar quedan libres y se dan como cualquier libre. ' +
      'Pon cuántas quieres de cada dorsal y talla en cada color: de entrada, una por equipo de ese color. Si los dorsales bajos se acaban antes, súbelos; los que suelen sobrar, bájalos a 0.</p>' +
      '<h3 class="cm-sub">Equipos de cada color</h3><ul class="cm-lista-ok cm-pp-cols">' + S.T.filas('COLORES').map(function (c) {
        return '<li><span>' + punto(c.ID) + texto(c.NOMBRE) + '</span><label class="cm-md-n"><input type="number" min="0" step="1" inputmode="numeric" data-pp-col="' + texto(c.ID) + '" value="' + (eqs[c.ID] || 0) + '" aria-label="Equipos de ' + texto(c.NOMBRE) + '"> equipos</label></li>';
      }).join('') + '</ul>' +
      '<h3 class="cm-sub">Cuántas de cada dorsal y talla</h3><div id="pk-tabla"></div>' +
      '<div class="cm-pp-add">' + campo('Dorsal', '<input type="text" id="pk-dor" inputmode="numeric" maxlength="4">') + campo('Talla', '<select id="pk-tal">' + opciones(CAM5_TALLAS, 'M') + '</select>') +
      '<button type="button" class="u-btn" id="pk-add">Añadir dorsal</button></div>' +
      '<p class="cm-coste" id="pk-tot"></p><div id="pk-prov"></div><div class="u-campos">' +
      campo('Temporada', '<select id="pk-temp">' + opciones(temps.map(function (t) { return [t[0], t[1]]; }), tComp || (temps[0] || [])[0]) + '</select>') +
      campo('Llega hacia el (opcional)', '<input type="date" id="pk-est">') + campo('Notas (opcional)', '<input type="text" id="pk-notas" maxlength="200">') + '</div><p class="u-error" hidden></p>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="pk-ok">Crear pedido</button><button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cancelar</button></div>');
    var tabla = v.querySelector('#pk-tabla'), prov = v.querySelector('#pk-prov'), ok = v.querySelector('#pk-ok');
    var equipos = function () { var o = {}; [].forEach.call(v.querySelectorAll('[data-pp-col]'), function (x) { var n = Number(x.value); if (n > 0) o[x.getAttribute('data-pp-col')] = n; }); return o; };
    var clave = function (f, c) { return c + '|' + f.DORSAL + '|' + f.TALLA; };
    var cuantas = function (f, c, o) { var k = clave(f, c); return k in mano ? mano[k] : (o[c] || 0); };
    var lineas = function () {
      var o = equipos(), l = [];
      Object.keys(o).forEach(function (c) { filas.forEach(function (f) { var n = cuantas(f, c, o); if (n > 0) l.push({ ID_COLOR: c, DORSAL: f.DORSAL, TALLA: f.TALLA, CANTIDAD: n }); }); });
      return l;
    };
    var resumen = function () {
      var o = equipos(), l = lineas(), n = l.reduce(function (s2, x) { return s2 + x.CANTIDAD; }, 0);
      Object.keys(o).forEach(function (c) {
        var t = filas.reduce(function (s2, f) { return s2 + cuantas(f, c, o); }, 0), el = tabla.querySelector('[data-pp-tot="' + c + '"]');
        if (el) el.textContent = t;
      });
      v.querySelector('#pk-tot').innerHTML = n ? '<b>' + plural(n, 'camiseta', 'camisetas') + '</b> en ' + plural(Object.keys(o).length, 'color', 'colores') : 'Todavía no hay ninguna camiseta en el pedido.';
      var antes = (v.querySelector('#pk-prov-prov') || {}).value;
      prov.innerHTML = n ? selProveedor(m, l, 'pk-prov') : '';
      var sp = v.querySelector('#pk-prov-prov');
      if (sp && antes && [].some.call(sp.options, function (x) { return x.value === antes && !x.disabled; })) sp.value = antes;
      if (sp) { prov.insertAdjacentHTML('beforeend', '<div id="pk-prov-lineas" data-resumen></div>'); engancharProveedor(v, m, l, 'pk-prov'); }
      ok.disabled = !sp || !n;
    };
    var pintarTabla = function () {
      var o = equipos(), cols = Object.keys(o);
      filas.sort(cam5Orden_);
      tabla.innerHTML = !cols.length ? '<p class="u-nota">Pon arriba cuántos equipos hay de cada color.</p>' : !filas.length ? '<p class="u-nota">Añade abajo los dorsales que quieres pedir.</p>' :
        '<div class="u-tabla-caja"><table class="u-tabla cm-pp-t"><thead><tr><th>Dorsal</th>' + cols.map(function (c) { return '<th class="num">' + punto(c) + texto(nombreColor(c)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        filas.map(function (f) {
          return '<tr><td class="u-tabla-t">' + texto(cam5Corto_(f)) + '</td>' + cols.map(function (c) {
            var k = clave(f, c);
            return '<td class="num"><input type="number" min="0" step="1" inputmode="numeric" class="cm-pp-n' + (k in mano ? ' cm-pp-mano' : '') + '" data-pp-k="' + texto(k) + '" value="' + cuantas(f, c, o) + '" aria-label="' + texto(cam5Corto_(f) + ' en ' + nombreColor(c)) + '"></td>';
          }).join('') + '</tr>';
        }).join('') + '<tr class="u-tabla-total"><td>Total</td>' + cols.map(function (c) { return '<td class="num" data-pp-tot="' + texto(c) + '"></td>'; }).join('') + '</tr></tbody></table></div>';
      resumen();
    };
    v.querySelector('.cm-pp-cols').oninput = pintarTabla;
    tabla.oninput = function (e) {
      var k = e.target.getAttribute('data-pp-k'); if (!k) return;
      var n = Number(e.target.value); mano[k] = n >= 0 && n === Math.round(n) ? n : 0;
      e.target.classList.add('cm-pp-mano'); resumen();
    };
    v.querySelector('#pk-add').onclick = function () {
      var dor = v.querySelector('#pk-dor').value.trim(), tal = v.querySelector('#pk-tal').value;
      if (!/^\d{1,3}$/.test(dor)) { S.ctx.aviso('El dorsal es un número.'); return; }
      if (!filas.some(function (f) { return f.DORSAL === dor && f.TALLA === tal; })) filas.push({ DORSAL: dor, TALLA: tal });
      v.querySelector('#pk-dor').value = ''; pintarTabla();
    };
    pintarTabla();
    ok.onclick = function () {
      var sp = v.querySelector('#pk-prov-prov'), err = v.querySelector('.u-error');
      var dd = { ID_PROVEEDOR: sp ? sp.value : '', ID_TEMPORADA: v.querySelector('#pk-temp').value, FECHA_ESTIMADA: v.querySelector('#pk-est').value, NOTAS: v.querySelector('#pk-notas').value.trim(), lineas: lineas() };
      ok.disabled = true; ok.textContent = 'Creando el pedido…';
      S.ctx.llamar('camisetas5PedirPack', [comp, dd]).then(function (r) {
        cerrarVentana();
        S.ctx.aviso('Pedido ' + r.id + ' para el local preparado. El PDF para el proveedor, en su tarjeta.');
        return S.T.refrescar(['PEDIDOS', 'PEDIDOS_LINEAS'], true);
      }).catch(function (e) { ok.disabled = false; ok.textContent = 'Volver a probar'; err.textContent = 'No se ha creado: ' + String(e.message).replace(/^\w+:\s*/, ''); err.hidden = false; });
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
      '<h3 class="cm-sub">Competiciones que lo llevan</h3><p class="u-nota">Cada competición es de una temporada: marca solo las del año en que se usa este modelo. Al lado, cuántas camisetas tiene cada jugadora con la inscripción (normalmente 1). Las camisetas que incluye la inscripción (1S, 2S, 3S, 4M…) se ponen en la pestaña Temporada.</p>' +
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
      '<p class="u-nota">A quién se le hacen los pedidos. Se guardan con los demás proveedores de Konamigas (Excel ECONOMIA), así que también los ve Economía. En «Catálogo», qué modelos hace cada uno y en qué colores, con su código y su precio: un pedido solo puede ir a quien hace el modelo en todos sus colores.</p>' +
      (l.length ? '<ul class="cm-prov-l">' + l.map(function (x) {
        var usos = S.T.filas('MODELOS').filter(function (m) { return String(m.ID_PROVEEDOR) === String(x.ID); }).map(function (m) { return m.NOMBRE || m.ID; });
        return '<li><div class="cm-rec-c"><b>' + texto(x.NOMBRE) + '</b>' +
          htmlContacto(x.CONTACTO) +
          (usos.length ? '<span class="u-nota">Habitual de ' + texto(usos.join(', ')) + '</span>' : '') + htmlHace(x.ID) +
          (function () { var u = ultimoPrecio(x.ID); return u ? '<span class="u-nota">Último precio: ' + eur(u.unidad) + '/camiseta sin IVA (' + texto(nombreModelo(u.p.ID_MODELO)) + ', ' + texto(u.p.ID) + ')</span>' : ''; })() +
          (x.NOTAS ? '<span class="u-nota">' + texto(x.NOTAS) + '</span>' : '') + '</div>' +
          '<span class="cm-prov-b"><button type="button" class="u-btn u-btn-texto" data-cm-cat="' + texto(x.ID) + '">Catálogo</button>' +
          '<button type="button" class="u-btn u-btn-texto" data-cm-prov="' + texto(x.ID) + '">Cambiar</button></span></li>';
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
      var n = porColor[col].reduce(function (s, x) { return s + (Number(x.CANTIDAD) || 0); }, 0), cod = codigoColor(col, p.ID_PROVEEDOR, p.ID_MODELO);
      t.push('', nombreColor(col) + (cod ? ' (código ' + cod + ')' : '') + ': ' + n);
      porColor[col].forEach(function (x) { t.push('- ' + (x.DORSAL ? 'Dorsal ' + x.DORSAL : 'Sin dorsal') + ' · talla ' + x.TALLA + ': ' + x.CANTIDAD); });
    });
    t.push('', 'Total: ' + plural(total, 'camiseta', 'camisetas'));
    if (p.NOTAS) t.push('Notas: ' + p.NOTAS);
    return t.join('\n');
  }

  function ventanaExtracto(id) {
    var p = S.T.fila('PEDIDOS', id); if (!p) return;
    ventanaTexto('Extracto del pedido ' + p.ID,
      p.ID_PROVEEDOR ? '<p><b>' + texto(nombreProveedor(p.ID_PROVEEDOR)) + '</b></p>' + contactoProveedor(p.ID_PROVEEDOR) : '<p class="u-nota">Este pedido no tiene proveedor apuntado.</p>',
      textoExtracto(p), 'Pedido ' + p.ID);
  }
  /** Un texto para copiar o compartir (el extracto de un pedido, el mensaje a un equipo). */
  function ventanaTexto(titulo, cabecera, txt, titShare) {
    var comparte = typeof navigator.share === 'function';
    var v = ventana('<h2>' + texto(titulo) + '</h2>' + cabecera +
      '<pre class="cm-extracto" tabindex="0">' + texto(txt) + '</pre>' +
      '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="ex-copiar">Copiar</button>' +
      (comparte ? '<button type="button" class="u-btn" id="ex-compartir">Compartir</button>' : '') +
      '<button type="button" class="u-btn u-btn-texto" data-cm-cerrar>Cerrar</button></div>');
    var pre = v.querySelector('.cm-extracto'), bc = v.querySelector('#ex-copiar');
    var seleccionar = function () { var r = document.createRange(); r.selectNodeContents(pre); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); };
    bc.onclick = function () {
      var hecho = function () { bc.textContent = 'Copiado'; S.ctx.aviso('Copiado: pégalo en el WhatsApp o el correo.'); };
      var mano = function () { seleccionar(); S.ctx.aviso('No se ha podido copiar solo: está seleccionado, cópialo tú.'); };
      try { navigator.clipboard.writeText(txt).then(hecho, mano); } catch (e) { mano(); }
    };
    if (comparte) v.querySelector('#ex-compartir').onclick = function () { navigator.share({ title: titShare, text: txt }).catch(function () {}); };
  }

  /* ---------- T0268 · el pedido en PDF, con la plantilla de Konamigas ---------- */

  /** Nombre del color del estampado (COLORES · ESTAMPADO, un #rrggbb): «Blanco (#FFFFFF)». */
  function estampado(v) {
    var h = String(v || '').trim().toUpperCase();
    if (!h) return '';
    var n = { '#FFFFFF': 'Blanco', '#000000': 'Negro' }[h];
    return n ? n + ' (' + h + ')' : h;
  }
  /**
   * El pedido como documento para el proveedor (como el PDF de Javi, 16/10/2026): cabecera de Konamigas con las unidades,
   * los datos del pedido y del proveedor, el resumen por color y talla (con el código de color de ese proveedor, el color
   * de la camiseta y del estampado, y su precio de catálogo) y el detalle de cada color con dorsal, talla y cantidad.
   * Sin nombres de jugadoras: al proveedor solo le hace falta lo que estampa. Los colores y las letras salen de marca.css.
   */
  function htmlPdf(p) {
    var css = getComputedStyle(document.documentElement), v = function (k, d) { return (css.getPropertyValue(k) || '').trim() || d; };
    var azul = v('--color-principal', 'navy'), rosa = v('--color-accion', 'deeppink'), suave = v('--color-tarjeta-cab', '#eee'), linea = v('--color-linea', '#ccc');
    var mod = S.T.fila('MODELOS', p.ID_MODELO) || {}, prov = S.T.fila('CONTRAPARTES', p.ID_PROVEEDOR) || {}, con = leerContacto(prov.CONTACTO);
    var cat = cam5Catalogo_(S.T.filas('CATALOGO'), p.ID_PROVEEDOR, p.ID_MODELO);
    var l = S.T.filas('PEDIDOS_LINEAS').filter(function (x) { return String(x.ID_PEDIDO) === String(p.ID); }).sort(cam5Orden_);
    var porColor = {}, cols = [], tallas = [], total = 0, importe = 0, sinPrecio = 0;
    l.forEach(function (x) {
      var n = Number(x.CANTIDAD) || 0, c = String(x.ID_COLOR);
      if (!porColor[c]) { porColor[c] = { n: 0, t: {}, l: [] }; cols.push(c); }
      porColor[c].n += n; porColor[c].t[x.TALLA] = (porColor[c].t[x.TALLA] || 0) + n; porColor[c].l.push(x);
      if (tallas.indexOf(x.TALLA) < 0) tallas.push(x.TALLA);
      total += n;
      var pu = cam5Cts_(x.PRECIO_UNIDAD) !== null ? cam5Cts_(x.PRECIO_UNIDAD) : cat[c] ? cat[c].precio : null;
      if (pu === null) sinPrecio += n; else importe += pu * n;
    });
    tallas.sort(function (a, b) { return CAM5_TALLAS.indexOf(a) - CAM5_TALLAS.indexOf(b); });
    cols.sort(function (a, b) { var x = codigoColor(a, p.ID_PROVEEDOR, p.ID_MODELO), y = codigoColor(b, p.ID_PROVEEDOR, p.ID_MODELO); return x < y ? -1 : x > y ? 1 : 0; });
    var nomCol = function (c) { var cod = codigoColor(c, p.ID_PROVEEDOR, p.ID_MODELO); return (cod ? cod + ' - ' : '') + String(nombreColor(c)).toUpperCase(); };
    var hex = function (c) { var h = String(color(c).COLOR_HEX || ''); return /^#[0-9a-f]{6}$/i.test(h) ? h.toUpperCase() : ''; };
    var mues = function (h) { return h ? '<i class="m" style="background:' + h + '"></i>' : ''; };
    var precio = function (c) { var pu = cat[c] ? cat[c].precio : null; return pu === null ? '' : eur(pu); };
    var temp = nombreTemp(p.ID_TEMPORADA), paso = PASOS[cam5Paso_(p)][0];
    var fila = function (k, val) { return val ? '<tr><th>' + k + '</th><td>' + val + '</td></tr>' : ''; };
    var ahora = new Date(), cuando = fecha(hoy()) + ' ' + dos(ahora.getHours()) + ':' + dos(ahora.getMinutes());
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Konamigas · Pedido ' + texto(p.ID) + ' · ' + texto(prov.NOMBRE || '') + '</title>' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Poppins:wght@400;600&display=swap">' +
      '<style>@page{size:A4;margin:14mm 12mm}*{box-sizing:border-box}body{margin:0;font:10pt/1.35 Poppins,Arial,sans-serif;color:' + azul + ';-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      'h1,h2,h3{font-family:Montserrat,Arial,sans-serif;font-weight:800;margin:0}' +
      '.cab{display:flex;justify-content:space-between;align-items:baseline;border-bottom:3px solid ' + rosa + ';padding-bottom:6px;margin-bottom:12px}' +
      '.cab h1{font-size:17pt;color:' + rosa + '}.cab b{font:800 19pt Montserrat,Arial,sans-serif;color:' + rosa + '}' +
      'table{width:100%;border-collapse:collapse;margin:0 0 12px}th,td{border:1px solid ' + linea + ';padding:4px 7px;text-align:left;vertical-align:middle}' +
      '.datos th{width:28%;font-weight:600;background:' + suave + '}h2{font-size:11pt;margin:14px 0 6px;letter-spacing:.02em}' +
      '.res thead th,.det thead th{font:700 8.5pt Montserrat,Arial,sans-serif;text-transform:uppercase;border-bottom:2px solid ' + azul + '}' +
      '.num{text-align:center}.der{text-align:right}.tot td{font-weight:700;border-top:2px solid ' + azul + '}.res td:first-child{font-weight:700;border-left:6px solid var(--c)}' +
      '.m{display:inline-block;width:2.4em;height:1.05em;border:1px solid ' + azul + ';vertical-align:-2px;margin-right:5px}' +
      '.color{break-inside:avoid;margin-bottom:10px;border:1px solid ' + linea + ';border-left:6px solid var(--c)}.color h3{font-size:10.5pt;padding:5px 8px;border-bottom:1px solid ' + linea + '}' +
      '.color p{margin:0;padding:4px 8px;font-size:9pt;border-bottom:1px solid ' + linea + '}.color table{margin:0}.color table th,.color table td{border-left:0;border-right:0;text-align:center}' +
      '.pie{margin-top:14px;font-size:8pt;opacity:.8}.nota{font-size:8.5pt;opacity:.85}</style></head><body>' +
      '<div class="cab"><h1>KONAMIGAS · PEDIDO DE CAMISETAS</h1><b>' + total + ' uds</b></div>' +
      '<table class="datos">' + fila('Pedido', texto(p.ID + (prov.NOMBRE ? ' · ' + prov.NOMBRE : '') + (p.FECHA_PEDIDO ? ' · ' + fecha(p.FECHA_PEDIDO) : ''))) +
      fila('Proveedor', texto(prov.NOMBRE || p.ID_PROVEEDOR || '')) +
      fila('Contacto', texto([con.persona, con.tel, con.correo].filter(Boolean).join(' · '))) +
      fila('Fecha del pedido', texto(fecha(p.FECHA_PEDIDO))) + fila('Lo necesitamos hacia el', texto(fecha(p.FECHA_ESTIMADA))) +
      fila('Temporada', texto(temp)) + fila('Modelo', texto([mod.NOMBRE, mod.PRENDA].filter(Boolean).join(' · '))) +
      fila('Total camisetas', texto(total + ' (' + plural(cols.length, 'color', 'colores') + ')')) +
      fila('Importe según tarifa', importe ? texto(eur(importe) + ' sin IVA' + (sinPrecio ? ' (sin precio: ' + sinPrecio + ' camisetas)' : '')) : '') +
      fila('Estado', texto(paso)) + fila('Notas', texto(p.NOTAS || '')) + '</table>' +
      '<h2>RESUMEN POR COLOR Y TALLA</h2><table class="res"><thead><tr><th>Color camiseta</th><th>Hex</th><th>Color estampado</th>' +
      tallas.map(function (t) { return '<th class="num">' + texto(t) + '</th>'; }).join('') + '<th class="num">Total</th>' + (importe ? '<th class="der">Precio</th>' : '') + '</tr></thead><tbody>' +
      cols.map(function (c) {
        var x = porColor[c], e = color(c).ESTAMPADO;
        return '<tr style="--c:' + (hex(c) || linea) + '"><td>' + texto(nomCol(c)) + '</td><td>' + texto(hex(c)) + '</td><td>' + (e ? mues(String(e)) + texto(estampado(e)) : '') + '</td>' +
          tallas.map(function (t) { return '<td class="num">' + (x.t[t] || '') + '</td>'; }).join('') + '<td class="num"><b>' + x.n + '</b></td>' + (importe ? '<td class="der">' + precio(c) + '</td>' : '') + '</tr>';
      }).join('') + '<tr class="tot"><td colspan="3">TOTAL</td>' + tallas.map(function (t) {
        return '<td class="num">' + cols.reduce(function (s, c) { return s + (porColor[c].t[t] || 0); }, 0) + '</td>';
      }).join('') + '<td class="num">' + total + '</td>' + (importe ? '<td class="der">' + eur(importe) + '</td>' : '') + '</tr></tbody></table>' +
      '<h2>DETALLE POR COLOR (DORSAL Y TALLA)</h2>' + cols.map(function (c) {
        var x = porColor[c], e = color(c).ESTAMPADO;
        return '<section class="color" style="--c:' + (hex(c) || linea) + '"><h3>' + texto(nomCol(c)) + ' · ' + plural(x.n, 'camiseta', 'camisetas') + '</h3>' +
          '<p><b>Color camiseta:</b> ' + mues(hex(c)) + texto(hex(c)) + (e ? ' · <b>Color estampado (dorsal):</b> ' + mues(String(e)) + texto(estampado(e)) : '') + (mod.PRENDA ? ' · <b>Modelo:</b> ' + texto(mod.PRENDA) : '') + '</p>' +
          '<table><thead><tr><th>Dorsal</th><th>Talla</th><th>Cantidad</th></tr></thead><tbody>' + x.l.map(function (y) {
            return '<tr><td><b>' + texto(y.DORSAL || '—') + '</b></td><td>' + texto(y.TALLA) + '</td><td>' + texto(y.CANTIDAD) + '</td></tr>';
          }).join('') + '</tbody></table></section>';
      }).join('') +
      '<p class="pie">Generado el ' + texto(cuando) + ' desde la web de Konamigas · ' + texto(p.ID) + ' · ' + plural(total, 'camiseta', 'camisetas') + '</p>' +
      '<script>window.onload=function(){(document.fonts&&document.fonts.ready||Promise.resolve()).then(function(){setTimeout(function(){window.print();},300);});};<\/script></body></html>';
  }
  /** Abre el PDF del pedido para guardarlo o compartirlo («Guardar como PDF» del navegador). */
  function pdfPedido(id) {
    var p = S.T.fila('PEDIDOS', id); if (!p) return;
    var h = htmlPdf(p), w = null;
    try { w = window.open('', '_blank'); } catch (e) { w = null; }
    if (w && w.document) { w.document.open(); w.document.write(h); w.document.close(); return; }
    // Si el navegador no deja abrir otra pestaña, se imprime desde un marco escondido.
    var f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    document.body.appendChild(f);
    f.contentWindow.document.open(); f.contentWindow.document.write(h); f.contentWindow.document.close();
    setTimeout(function () { f.remove(); }, 60000);
    S.ctx.aviso('Elige «Guardar como PDF» para mandarlo al proveedor.');
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
