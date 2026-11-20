/*
 * Calcular precio · Telas (T0653) · clientes/telas/modulos/precio de utilo-apps
 *
 * La calculadora de Marta: lo que le cuesta una tela (de Mis telas o escribiendo el coste) con el envío y el precio para un
 * cliente, poniendo lo que quiere ganar o el precio, al lado de lo que ese cliente paga hoy (su Comparativa). Avisa si el
 * precio no cubre lo que le cuesta. Solo guarda, si Marta quiere, el precio propuesto a una marca (PROPUESTAS, T0687). Lo que le cuesta es el mismo cálculo que «Te cuesta puesta en España» de
 * Mis telas. T0657: lo que gana va en euros por metro, sin porcentajes ni mínimo (Marta, 19/11/2026: «Mi margen es precio de
 * venta − (precio de coste + transporte). Por eso no quiero definir un %»).
 * T0659: junto a «Ganas», lo que suele ganar por metro con esa tela o esa marca, de sus facturas (solo para quien ve Economía).
 */
(function () {
  'use strict';
  var TABLAS = ['TELAS', 'DISENOS', 'TECNICAS', 'ESTADOS_TELA', 'AJUSTES', 'MARCAS', 'COMPARATIVA', 'COMPETIDORES', 'PROPUESTAS'];

  /* ======================= cálculo (también para las pruebas en node) ======================= */

  /** Un número escrito como lo escribe Marta: «1.020», «1,020» (mil veinte, como su Excel), «28,50», «28.5», «25 %», «1.020 ₹». */
  function aNum(v) {
    if (typeof v === 'number') return v;
    var s = String(v == null ? '' : v).trim(); if (!s) return NaN;
    s = s.replace(/[€₹%\s]/g, '').replace(/^[\u2212\u2013]/, '-'); // T0657: «−2,27» (como lo pinta cifra) se lee como -2,27
    if (/^-?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  }
  function r2(n) { return Math.round(n * 100) / 100; }
  /** 1.020,50 · con d decimales (2 por defecto). */
  function cifra(n, d) {
    if (d == null) d = 2;
    var s = Math.abs(n).toFixed(d).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '−' : '') + s.join(',');
  }

  /** Las tablas en un objeto { filas(t), fila(t, id) } (el de ctx.tablas, o uno de prueba). */
  function nombre(D, t, id) { var f = id ? D.fila(t, id) : null; return f ? String(f.NOMBRE || id) : ''; }
  function ajustes(D) {
    var a = D.fila('AJUSTES', 'AJUSTES') || {};
    // T0678: un envío a 0 es que falta (en su Excel, una celda sin rellenar), como «Falta el envío» en Mis telas.
    var e = aNum(a.ENVIO_ARANCEL);
    return { rupias: aNum(a.RUPIAS_POR_EURO), envio: e > 0 ? e : NaN };
  }
  /** Las telas que se pueden elegir (sin las descartadas), por código: { id, nombre, tec (su técnica), diseno, inr, ancho }. */
  function telas(D) {
    return (D.filas('TELAS') || []).filter(function (t) { return t.ID && nombre(D, 'ESTADOS_TELA', t.ID_ESTADO) !== 'Descartada'; }).map(function (t) {
      var d = D.fila('DISENOS', t.ID_DISENO) || {}, inr = aNum(t.COSTE_INR);
      if (isNaN(inr)) inr = aNum(d.COSTE_INR); // el del color si cuesta distinto; si no, el de su diseño (como Mis telas)
      var tec = nombre(D, 'TECNICAS', d.ID_TECNICA);
      return { id: String(t.ID), nombre: [tec, t.COLOR].filter(Boolean).join(' · ') || String(t.ID), tec: tec, diseno: String(t.ID_DISENO || ''), inr: inr, ancho: aNum(d.ANCHO), gsm: aNum(d.GSM) };
    }).sort(function (a, b) { return a.id.localeCompare(b.id, 'es'); });
  }
  /** Lo que cuesta en euros, sin envío: las rupias entre el cambio (redondeado a céntimos, como Mis telas) o los euros escritos. NaN si falta. */
  function costeEur(t, rupias) {
    if (!t) return NaN;
    if (!isNaN(t.eur)) return r2(t.eur);
    if (isNaN(t.inr) || !(rupias > 0)) return NaN;
    return r2(t.inr / rupias);
  }
  /** El envío por metro: el escrito o, del pedido entero, repartido entre los metros. NaN si falta (también a 0: T0678). */
  function envioMetro(e) {
    if (e.modo === 'pedido') { var tot = aNum(e.total), m = aNum(e.metros); return tot > 0 && m > 0 ? tot / m : NaN; }
    var n = aNum(e.metro); return n > 0 ? n : NaN;
  }
  /** Lo que gana, en euros por metro: precio = lo que le cuesta + lo que gana (12 € + 6 € = 18 €). */
  function precioDe(coste, gana) { return r2(coste + gana); }
  function ganaDe(coste, precio) { return r2(precio - coste); }

  /**
   * Lo que paga hoy la marca, de su Comparativa: { misma: [la que compara con este diseño], otras: [las demás] }, cada una
   * { id, tela, precio, ancho, de, su (su precio por tu metro), porM2 }. Por m² cuando están los dos anchos (su precio
   * pasado a tu ancho), como la ficha de la marca; si falta uno, por metro.
   */
  function comparativa(D, marca, diseno, anchoTela) {
    var r = { misma: [], otras: [] };
    if (!marca) return r;
    (D.filas('COMPARATIVA') || []).filter(function (c) { return String(c.ID_MARCA) === String(marca) && !isNaN(aNum(c.PRECIO_A_BATIR)); }).forEach(function (c) {
      var p = aNum(c.PRECIO_A_BATIR), a = aNum(c.ANCHO), porM2 = a > 0 && anchoTela > 0;
      var x = { id: String(c.ID), tela: String(c.SU_TELA || 'Su tela'), precio: p, ancho: a, de: nombre(D, 'COMPETIDORES', c.ID_COMPETIDOR), porM2: porM2, su: r2(porM2 ? p / a * anchoTela : p) };
      (diseno && String(c.ID_DISENO) === String(diseno) ? r.misma : r.otras).push(x);
    });
    return r;
  }

  /**
   * Todo lo que enseña la pantalla, de lo que hay escrito: s = { tela (la de la lista, con eur si es «otra»), envio, gana
   * (euros por metro) o precio y modo (el último que se ha escrito: 'gana' o 'precio') }, a = ajustes(D).
   * → { coste (con envío), base (sin envío), envio, precio, gana (negativo: pierde), perdida }
   */
  function calcular(s, a) {
    var base = costeEur(s.tela, a.rupias), envio = envioMetro(s.envio), r = { base: base, envio: envio, coste: NaN, precio: NaN, gana: NaN };
    if (isNaN(base) || isNaN(envio)) return r;
    r.coste = r2(base + envio);
    if (s.modo === 'gana') {
      var g = aNum(s.gana);
      if (!isNaN(g)) { r.precio = precioDe(r.coste, g); r.gana = ganaDe(r.coste, r.precio); }
    } else {
      var p = aNum(s.precio);
      if (!isNaN(p)) { r.precio = r2(p); r.gana = ganaDe(r.coste, r.precio); }
    }
    if (isNaN(r.precio)) return r;
    r.perdida = r.gana < 0;
    return r;
  }
  /** Diez por ciento menos de lo que paga, si cubre lo que te cuesta; si no, NaN. */
  function ofrecer(su, coste) { var p = r2(su * 0.9); return p > coste ? p : NaN; }

  /**
   * T0687 · Lo que Marta pega en WhatsApp: la tela, su ancho y peso y el precio, sin IVA y con el envío a España incluido (nunca
   * un precio sin el envío). Nunca el proveedor, la referencia del proveedor ni lo que le cuesta.
   */
  function whatsapp(t, precio) {
    var l = [t.nombre + (t.id ? ' (' + t.id + ')' : '')], med = [];
    if (t.ancho > 0) med.push(cifra(t.ancho, 0) + ' cm de ancho');
    if (t.gsm > 0) med.push(cifra(t.gsm, 0) + ' g/m²');
    if (med.length) l.push(med.join(' · '));
    l.push('Precio: ' + cifra(precio) + ' €/m + IVA, con el envío a España incluido.');
    return l.join('\n');
  }
  /** T0687 · La fila de PROPUESTAS que guarda «Guardar en su ficha»: hace falta la marca, una tela de Mis telas y el precio. */
  function propuesta(marca, t, r, hoy) {
    if (!marca || !t || !t.id || isNaN(r.precio)) return null;
    var p = { ID_MARCA: marca, ID_TELA: t.id, PRECIO: r.precio, FECHA: hoy };
    if (!isNaN(r.coste)) p.COSTE = r.coste;
    return p;
  }

  /* ---------- T0659 · Lo que suele ganar por metro, de sus facturas ---------- */

  /** Con menos líneas de factura con tela que estas, no se propone nada; y cada propuesta pide estas ventas parecidas. */
  var SUELES = { lineas: 10, ventas: 3, ambas: 2 };

  /**
   * Lo que ganó en cada venta de una tela de Mis telas: las líneas de sus facturas emitidas (sin las anuladas) cuyo concepto
   * acaba en el código de la tela (como las escribe Economía). Lo ganado es su precio por metro menos lo que esa tela le
   * cuesta HOY (el cambio y el envío de sus ajustes, como la calculadora): los de aquel día no se guardan. Sin el coste de la
   * tela o sin el envío, esa línea no cuenta; el envío escrito a mano tampoco (no es una tela).
   * F = { lineas: FACTURA_LINEAS, facturas: FACTURAS, contrapartes: CONTRAPARTES } →
   * [{ numero, fecha, marca (ID_MARCA de su contraparte), tela, tec, m (metros), precio, gana }], de la más nueva a la más vieja.
   */
  function vendido(D, F, a) {
    var ts = {}, fac = {}, ctr = {};
    telas(D).forEach(function (t) { ts[t.id] = t; });
    (F.facturas || []).forEach(function (f) { if (f.ID) fac[String(f.ID)] = f; });
    (F.contrapartes || []).forEach(function (c) { if (c.ID) ctr[String(c.ID)] = c; });
    var r = [];
    (F.lineas || []).forEach(function (l) {
      var f = fac[String(l.ID_FACTURA)];
      if (!f || String(f.TIPO) !== 'Emitida' || String(f.ESTADO) === 'Anulada') return;
      var cod = String(l.CONCEPTO || '').split(' · ').pop().trim(), t = ts[cod];
      if (!t || (l.UNIDAD && String(l.UNIDAD) !== 'm')) return;
      var coste = r2(costeEur(t, a.rupias) + a.envio), precio = aNum(l.PRECIO), m = aNum(l.CANTIDAD);
      if (isNaN(coste) || isNaN(precio) || !(m > 0)) return;
      var c = ctr[String(f.ID_CONTRAPARTE)] || {};
      r.push({ numero: String(f.NUMERO || ''), fecha: String(f.FECHA || '').slice(0, 10), marca: String(c.ID_MARCA || ''), tela: t.id, tec: t.tec, m: m, precio: precio, gana: r2(precio - coste) });
    });
    return r.sort(function (x, y) { return y.fecha.localeCompare(x.fecha) || y.numero.localeCompare(x.numero, 'es', { numeric: true }); });
  }

  /** Lo que suele ganar: lo de en medio de las ventas, pesando cada una por sus metros, redondeado a 0,50 €. */
  function deEnMedio(vs) {
    var s = vs.slice().sort(function (x, y) { return x.gana - y.gana; }), tot = 0, acc = 0, i;
    for (i = 0; i < s.length; i++) tot += s[i].m;
    for (i = 0; i < s.length; i++) { acc += s[i].m; if (acc >= tot / 2) return Math.round(s[i].gana * 2) / 2; }
    return NaN;
  }

  /** «los bordados», «los lisos»; «las telas de ikat». */
  function deLaTecnica(tec) {
    var t = String(tec || '').toLowerCase();
    return /[aeiou]$/.test(t) && t.indexOf(' ') < 0 ? 'los ' + t + 's' : 'las telas de ' + t;
  }

  /**
   * T0659 · La propuesta de «Ganas» (la más parecida que haya), o null: esa tela a esa marca (2 ventas), esa tela (3) o, si no,
   * su técnica (3), y esa marca (3). Nada si en total hay menos de 10 ventas con tela. vs = vendido(…), marca = { id, nombre }
   * o null, t = la tela elegida o null. → { gana, que: 'ambas' | 'tela' | 'tecnica' | 'marca', texto, ventas }
   */
  function sueles(vs, marca, t) {
    if (!vs || vs.length < SUELES.lineas) return null;
    var de = function (f) { return vs.filter(f); }, id = t && t.id, m = marca && marca.id;
    var hay = function (que, ventas, min, txt) { return ventas.length >= min ? { gana: deEnMedio(ventas), que: que, texto: txt, ventas: ventas } : null; };
    var p = null;
    if (id && m) p = hay('ambas', de(function (v) { return v.tela === id && v.marca === m; }), SUELES.ambas, 'A ' + marca.nombre + ' esta tela se la vendes ganando unos');
    if (!p && id) p = hay('tela', de(function (v) { return v.tela === id; }), SUELES.ventas, 'Con esta tela sueles ganar unos');
    if (!p && t && t.tec) p = hay('tecnica', de(function (v) { return v.tec === t.tec; }), SUELES.ventas, 'Con ' + deLaTecnica(t.tec) + ' sueles ganar unos');
    if (!p && m) p = hay('marca', de(function (v) { return v.marca === m; }), SUELES.ventas, 'Con ' + marca.nombre + ' sueles ganar unos');
    return p && !isNaN(p.gana) ? p : null;
  }

  var CALC = { vendido: vendido, sueles: sueles, SUELES: SUELES, whatsapp: whatsapp, propuesta: propuesta, aNum: aNum, cifra: cifra, ajustes: ajustes, telas: telas, costeEur: costeEur, envioMetro: envioMetro,
    precioDe: precioDe, ganaDe: ganaDe, comparativa: comparativa, calcular: calcular, ofrecer: ofrecer };
  if (typeof window === 'undefined' || !window.UN) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(n, u) { return cifra(n) + ' €' + (u === false ? '' : '/m'); }

  window.UN.registrar('PRECIO', {
    abrir: function (el, ctx) {
      var T = ctx.tablas;
      var D = { filas: function (t) { return T.filas(t) || []; }, fila: function (t, id) { return id === '' || id == null ? null : T.fila(t, id); } };
      var factura = (ctx.secciones || []).some(function (x) { return x.id === 'ECONOMIA'; });
      // T0659: lo que suele ganar sale de sus facturas, que solo ve quien ve Economía (Marta); a Equipo ni se le piden.
      var FACTURAS = factura ? ['FACTURAS', 'FACTURA_LINEAS', 'CONTRAPARTES'] : [], facturasLeidas = false;
      // T0687: desde la ficha de una tela o de una marca llega ya puesta (?s=precio&tela=BOR-004-01 o &marca=M-002).
      var url = new URLSearchParams(location.search);
      var S = { marca: url.get('marca') || '', tela: url.get('tela') || '', modo: 'precio', envioModo: 'metro', envioTocado: false };

      el.innerHTML = '<p class="u-nota n-ayuda">Lo que te cuesta una tela y lo que le cobras a un cliente. Si quieres, lo guardas en su ficha o lo copias para WhatsApp.</p>' +
        '<div class="pr-barra" id="pr-barra" aria-hidden="true"></div>' +
        '<div class="pr-calc">' +
        '<section class="pr-caja u-campos" aria-label="Datos">' +
          '<label class="u-campo"><span class="u-etiqueta">Para</span><select id="pr-marca" data-elegir="marca"></select></label>' +
          '<label class="u-campo"><span class="u-etiqueta">Tela</span><select id="pr-tela" data-elegir="tela"></select></label>' +
          '<div class="u-bloque pr-manual" id="pr-manual" hidden><p class="u-nota" id="pr-manual-t"></p><div class="pr-dos">' +
            '<label class="u-campo"><span class="u-etiqueta">Coste del proveedor</span><span class="pr-ud"><input id="pr-mcoste" inputmode="decimal" autocomplete="off"><i id="pr-mud-t">₹/m</i></span></label>' +
            '<label class="u-campo"><span class="u-etiqueta">En</span><select id="pr-mud"><option value="inr">Rupias</option><option value="eur">Euros</option></select></label></div>' +
            '<label class="u-campo" id="pr-c-ancho"><span class="u-etiqueta">Ancho (si lo sabes)</span><span class="pr-ud"><input id="pr-mancho" inputmode="numeric" autocomplete="off"><i>cm</i></span>' +
            '<span class="u-nota">Para comparar por m² con lo que paga la marca.</span></label></div>' +
          '<div class="u-campo"><span class="u-etiqueta" id="pr-env-et">Envío y arancel</span>' +
            '<div class="pr-seg" role="group" aria-labelledby="pr-env-et"><button type="button" data-envio="metro" aria-pressed="true">Por metro</button><button type="button" data-envio="pedido" aria-pressed="false">Del pedido</button></div>' +
            '<div id="pr-env-m"><span class="pr-ud"><input id="pr-envio" inputmode="decimal" autocomplete="off" aria-label="Envío y arancel por metro"><i>€/m</i></span></div>' +
            '<div class="pr-dos" id="pr-env-p" hidden><span class="pr-ud"><input id="pr-etotal" inputmode="decimal" autocomplete="off" aria-label="Envío del pedido entero"><i>€</i></span>' +
              '<span class="pr-ud"><input id="pr-metros" inputmode="decimal" autocomplete="off" aria-label="Metros del pedido"><i>m</i></span></div>' +
            '<span class="u-nota" id="pr-env-nota"></span></div>' +
          '<div class="pr-par"><label class="u-campo" id="pr-c-gana"><span class="u-etiqueta">Ganas</span><span class="pr-ud"><input id="pr-gana" inputmode="decimal" autocomplete="off"><i>€/m</i></span></label>' +
            '<span class="pr-o">o</span>' +
            '<label class="u-campo" id="pr-c-precio"><span class="u-etiqueta">Precio</span><span class="pr-ud"><input id="pr-precio" inputmode="decimal" autocomplete="off"><i>€/m</i></span></label></div>' +
          '<div class="pr-sueles" id="pr-sueles" hidden></div>' +
          '<p class="u-nota">Pon lo que quieres ganar por metro o el precio, y sale el otro.</p>' +
        '</section>' +
        '<div class="pr-lado"><section class="pr-caja" id="pr-res" aria-live="polite"></section><section class="pr-caja" id="pr-comp"></section></div>' +
        '</div>';
      var $ = function (id) { return el.querySelector('#' + id); };

      function listas() {
        var ms = D.filas('MARCAS').filter(function (m) { return m.ID; }), grupo = function (l) { return ms.filter(function (m) { return (m.LISTA === 'Cliente') === l; }); };
        var op = function (m) { return '<option value="' + texto(m.ID) + '">' + texto(m.NOMBRE || m.ID) + '</option>'; };
        var orden = function (a, b) { return String(a.NOMBRE || '').localeCompare(String(b.NOMBRE || ''), 'es'); };
        $('pr-marca').innerHTML = '<option value="">Sin elegir</option>' +
          '<optgroup label="Clientes">' + grupo(true).sort(orden).map(op).join('') + '</optgroup>' +
          '<optgroup label="Prospección">' + grupo(false).sort(orden).map(op).join('') + '</optgroup>';
        $('pr-marca').value = S.marca;
        $('pr-tela').innerHTML = '<option value="">Elige una tela</option>' + telas(D).map(function (t) {
          return '<option value="' + texto(t.id) + '">' + texto(t.id + ' · ' + t.nombre) + (isNaN(t.inr) ? ' (sin coste)' : '') + '</option>';
        }).join('') + '<option value="otra" data-siempre>Otra: escribo el coste</option>';
        $('pr-tela').value = S.tela;
        if (S.tela && $('pr-tela').value !== S.tela) S.tela = ''; // una tela que ya no está (descartada) no se queda puesta
        if (S.marca && $('pr-marca').value !== S.marca) S.marca = '';
        if (!S.envioTocado) { var e = ajustes(D).envio; $('pr-envio').value = isNaN(e) ? '' : cifra(e); }
      }

      function telaAhora() {
        if (S.tela === 'otra') {
          var c = aNum($('pr-mcoste').value), eurs = $('pr-mud').value === 'eur';
          return { id: '', nombre: 'Otra tela', diseno: '', inr: eurs ? NaN : c, eur: eurs ? c : NaN, ancho: aNum($('pr-mancho').value), otra: true };
        }
        var t = telas(D).filter(function (x) { return x.id === S.tela; })[0] || null;
        // T0687: una tela de Mis telas sin coste del proveedor: se escribe aquí mismo (solo para esta cuenta, no se guarda en la tela).
        if (t && isNaN(t.inr)) { var c2 = aNum($('pr-mcoste').value), e2 = $('pr-mud').value === 'eur'; t.inr = e2 ? NaN : c2; t.eur = e2 ? c2 : NaN; t.escrito = true; }
        return t;
      }
      function sinCoste() { var t = telas(D).filter(function (x) { return x.id === S.tela; })[0]; return !!t && isNaN(t.inr); }

      function pintar(desde) {
        if (!ctx.abierta()) return;
        var a = ajustes(D), t = telaAhora();
        var escribir = S.tela === 'otra' || sinCoste();
        $('pr-manual').hidden = !escribir;
        $('pr-c-ancho').hidden = S.tela !== 'otra';
        $('pr-manual-t').textContent = S.tela === 'otra' ? '' : 'Esta tela no tiene el coste del proveedor en Mis telas. Escríbelo aquí: solo cuenta para este precio.';
        $('pr-manual-t').hidden = S.tela === 'otra';
        $('pr-mud-t').textContent = $('pr-mud').value === 'eur' ? '€/m' : '₹/m';
        $('pr-env-m').hidden = S.envioModo !== 'metro';
        $('pr-env-p').hidden = S.envioModo !== 'pedido';
        var env = { modo: S.envioModo, metro: $('pr-envio').value, total: $('pr-etotal').value, metros: $('pr-metros').value }, em = envioMetro(env);
        $('pr-env-nota').textContent = S.envioModo === 'pedido'
          ? (isNaN(em) ? 'El envío de todo el pedido y cuántos metros lleva: sale por metro.' : 'Sale a ' + eur(em) + '.')
          : (!isNaN(a.envio) && Math.abs(aNum(env.metro) - a.envio) < 0.005 ? 'El de tus ajustes. Cámbialo si este envío sale distinto.'
            : isNaN(a.envio) ? 'En tus ajustes no hay envío: ponlo aquí.' : 'En tus ajustes es ' + eur(a.envio) + '. Solo cambia para esta cuenta.');
        $('pr-c-gana').classList.toggle('pr-activo', S.modo === 'gana');
        $('pr-c-precio').classList.toggle('pr-activo', S.modo === 'precio');

        var r = calcular({ tela: t, envio: env, gana: $('pr-gana').value, precio: $('pr-precio').value, modo: S.modo }, a);
        // El otro de los dos, al momento (sin tocar el que se está escribiendo).
        if (desde !== 'gana' && S.modo === 'precio') $('pr-gana').value = isNaN(r.gana) ? '' : cifra(r.gana);
        if (desde !== 'precio' && S.modo === 'gana') $('pr-precio').value = isNaN(r.precio) ? '' : cifra(r.precio);

        var marca = S.marca ? D.fila('MARCAS', S.marca) : null, para = marca ? String(marca.NOMBRE || marca.ID) : 'el cliente', h = '';
        h += '<span class="u-etiqueta">Precio para ' + texto(para) + '</span>';
        if (!t) h += '<p class="u-vacio">Elige una tela de Mis telas o «Otra: escribo el coste».</p>';
        else if (isNaN(r.base)) h += '<p class="u-vacio">' + (t.otra || t.escrito ? 'Escribe el coste del proveedor.' : 'Falta el cambio de rupias en tus ajustes.') + '</p>';
        else if (isNaN(r.envio)) h += '<p class="u-vacio">Falta el envío: escríbelo arriba. Sin él no se sabe lo que te cuesta.</p>';
        else {
          if (isNaN(r.precio)) h += '<p class="pr-grande pr-nada">— <small>pon lo que quieres ganar o un precio</small></p>';
          else {
            h += '<p class="pr-grande u-cifra">' + cifra(r.precio) + ' <small>€/m sin IVA</small></p>';
            h += r.perdida ? '<p class="u-mal">Pierdes ' + eur(-r.gana) + '</p>' : '<p class="u-cifra">Ganas <b>' + eur(r.gana) + '</b></p>';
            if (r.perdida) h += '<p class="pr-aviso pr-mal">Por debajo de lo que te cuesta (' + eur(r.coste) + ').</p>';
          }
          var origen = !isNaN(t.inr) && isNaN(t.eur) ? cifra(t.inr, 0) + ' ₹ → ' + eur(r.base, false) : eur(r.base, false);
          // T0678: lo que cuesta y lo que gana, cada uno en su línea (en una, «+ ganas» parecía parte del coste).
          h += '<p class="pr-cuentas u-cifra">Te cuesta <b>' + eur(r.coste) + '</b>: ' + origen + ' + envío ' + eur(r.envio, false) + '</p>' +
            (!isNaN(r.precio) && !r.perdida ? '<p class="pr-cuentas u-cifra">' + eur(r.coste, false) + ' + ganas ' + eur(r.gana, false) + ' = ' + eur(r.precio) + '</p>' : '');
          if (factura && !isNaN(r.precio) && t.id) {
            var href = '?s=economia&factura=nueva&articulo=' + encodeURIComponent(t.id) + '&precio=' + encodeURIComponent(r.precio) + (S.marca ? '&cliente=' + encodeURIComponent('ID_MARCA:' + S.marca) : '');
            h += '<a class="u-btn pr-fac" href="' + texto(href) + '" data-sx="ECONOMIA">Llevar a una factura</a>';
          }
        }
        // T0687: guardar en la ficha de la marca (necesita marca y una tela de Mis telas) o copiarlo para WhatsApp.
        if (t && !isNaN(r.precio)) {
          var prop = propuesta(S.marca, t, r, ''), ultima = prop ? ultimaPropuesta(S.marca, t.id) : null;
          h += '<div class="pr-acciones">' +
            (prop ? '<button type="button" class="u-btn u-btn-accion" data-guardar>Guardar en la ficha de ' + texto(para) + '</button>' : '') +
            '<button type="button" class="u-btn" data-whatsapp>Copiar para WhatsApp</button></div>' +
            (!S.marca ? '<p class="u-nota">Elige para quién y podrás guardarlo en su ficha.</p>' : !t.id ? '<p class="u-nota">Una tela que no está en Mis telas no se guarda: cópialo.</p>' : '') +
            (ultima ? '<p class="u-nota u-cifra">' + (String(ultima.FECHA).slice(0, 10) === hoyISO() && Math.abs(aNum(ultima.PRECIO) - r.precio) < 0.005 ? 'Guardado hoy en su ficha.'
              : 'La última vez le propusiste ' + eur(aNum(ultima.PRECIO)) + ' (' + texto(fechaCorta(ultima.FECHA)) + ').') + '</p>' : '');
        }
        $('pr-res').innerHTML = h;
        pintarSueles(t, marca);
        pintarBarra(t, r);
        pintarComp(t, r, para);
        ultimo = { t: t, r: r, para: para };
      }

      var ultimo = null;

      /** T0659 · «Sueles ganar unos 9 €/m» bajo Ganas, con «Ponerlo» y de dónde sale. Nunca lo pone sola. */
      function pintarSueles(t, marca) {
        var caja = $('pr-sueles'), p = null;
        if (facturasLeidas) {
          var F = { lineas: D.filas('FACTURA_LINEAS'), facturas: D.filas('FACTURAS'), contrapartes: D.filas('CONTRAPARTES') };
          p = sueles(vendido(D, F, ajustes(D)), marca ? { id: S.marca, nombre: String(marca.NOMBRE || marca.ID) } : null, t && t.id ? t : null);
        }
        caja.hidden = !p;
        if (!p) { caja.innerHTML = ''; return; }
        var abierto = !!caja.querySelector('details[open]'), nm = function (id) { var m = D.fila('MARCAS', id); return m ? String(m.NOMBRE || id) : 'sin marca'; };
        var MAX = 8, vs = p.ventas.slice(0, MAX);
        caja.innerHTML = '<p>' + texto(p.texto) + ' <b class="u-cifra">' + cifra(p.gana, p.gana % 1 ? 2 : 0) + ' €/m</b>. ' +
          '<button type="button" class="u-btn-texto" data-sueles="' + p.gana + '">Ponerlo</button></p>' +
          '<details class="pr-origen"' + (abierto ? ' open' : '') + '><summary>De dónde sale</summary><ul>' + vs.map(function (v) {
            return '<li class="u-cifra">' + texto(v.numero) + ' · ' + texto(nm(v.marca)) + (p.que === 'tela' || p.que === 'ambas' ? '' : ' · ' + texto(v.tela)) +
              ': a ' + eur(v.precio) + ', ' + (v.gana < 0 ? 'perdiste ' + eur(-v.gana) : 'ganaste ' + eur(v.gana)) + ' (' + cifra(v.m, v.m % 1 ? 2 : 0) + ' m)</li>';
          }).join('') + (p.ventas.length > MAX ? '<li>y ' + (p.ventas.length - MAX) + ' más</li>' : '') + '</ul>' +
          '<p class="u-nota">Con lo que te cuesta hoy esa tela; el cambio o el envío de aquel día pudo ser otro.</p></details>';
      }
      function ultimaPropuesta(marca, tela) {
        return D.filas('PROPUESTAS').filter(function (p) { return String(p.ID_MARCA) === String(marca) && String(p.ID_TELA) === String(tela); })
          .sort(function (a, b) { return String(b.FECHA || '').localeCompare(String(a.FECHA || '')); })[0] || null;
      }
      function fechaCorta(f) {
        var d = f instanceof Date ? f : new Date(String(f || '').slice(0, 10) + 'T12:00:00');
        return isNaN(d) ? String(f || '') : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
      }
      function hoyISO() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
      /** T0687 · En el móvil, el precio arriba y fijo mientras se escribe (abajo lo tapa el teclado). */
      function pintarBarra(t, r) {
        var b = $('pr-barra');
        if (!t || isNaN(r.coste)) { b.innerHTML = '<span class="u-nota">Te cuesta —</span>'; return; }
        b.innerHTML = '<span class="u-nota u-cifra">Te cuesta ' + eur(r.coste) + '</span>' + (isNaN(r.precio) ? '' :
          '<span class="pr-barra-p u-cifra">' + cifra(r.precio) + ' €/m</span>' +
          (r.perdida ? '<span class="u-mal u-cifra">Pierdes ' + eur(-r.gana, false) + '</span>' : '<span class="u-cifra">Ganas ' + eur(r.gana, false) + '</span>'));
      }
      function copiar(txt, hecho) {
        var aMano = function () {
          var ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
          document.body.removeChild(ta);
          ctx.aviso(ok ? hecho : 'No se ha podido copiar.');
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { ctx.aviso(hecho); }, aMano); else aMano();
      }

      function linea(c, t, r, pista) {
        var h = '<div class="pr-cmp"><span class="pr-cmp-t">' + texto(c.tela) + (pista ? ' <span class="u-chip">' + pista + '</span>' : '') + '</span>';
        h += '<span class="u-nota u-cifra">Hoy paga ' + eur(c.precio) + (c.ancho > 0 ? ' (' + cifra(c.ancho, 0) + ' cm)' : '') + (c.de ? ' · ' + texto(c.de) : '') +
          (c.porM2 && Math.abs(c.ancho - t.ancho) > 0.001 ? ' → a tu ancho, ' + eur(c.su) : '') + (!c.porM2 ? ' (sin el ancho, comparado por metro)' : '') + '</span>';
        if (!isNaN(r.precio)) {
          var dif = r2(c.su - r.precio);
          h += dif > 0 ? '<span class="pr-bien u-cifra">Tu precio queda ' + eur(dif, false) + ' por debajo</span>'
            : dif < 0 ? '<span class="u-mal u-cifra">Tu precio pasa el suyo en ' + eur(-dif, false) + '</span>' : '<span class="u-cifra">Tu precio es el suyo</span>';
        }
        if (!isNaN(r.coste)) {
          var of = ofrecer(c.su, r.coste);
          h += !isNaN(of) ? '<span><button type="button" class="u-btn u-btn-texto" data-poner="' + of + '">Ofrecerle un 10 % menos (' + eur(of) + ')</button></span>'
            : c.su < r.coste ? '<span class="u-mal">Lo que paga no cubre lo que te cuesta (' + eur(r.coste) + ').</span>' : '';
        }
        return h + '</div>';
      }
      function pintarComp(t, r, para) {
        var caja = $('pr-comp');
        if (!S.marca) { caja.innerHTML = '<h3 class="pr-h">Lo que paga hoy</h3><p class="u-vacio">Elige para quién y verás lo que paga hoy por sus telas.</p>'; return; }
        var tt = t || { ancho: NaN, diseno: '' }, c = comparativa(D, S.marca, tt.diseno, tt.ancho), n = c.misma.length + c.otras.length;
        var h = '<h3 class="pr-h">Lo que paga hoy ' + texto(para) + '</h3>';
        if (!n) { caja.innerHTML = h + '<p class="u-vacio">Aún no sabes lo que paga por sus telas. Se apunta en su Comparativa.</p>'; return; }
        c.misma.forEach(function (x) { h += linea(x, tt, r, 'La comparas con esta'); });
        if (c.misma.length && c.otras.length) h += '<details class="pr-otras"><summary>' + (c.otras.length === 1 ? 'Su otra tela' : 'Sus otras ' + c.otras.length + ' telas') + '</summary>' + c.otras.map(function (x) { return linea(x, tt, r); }).join('') + '</details>';
        else {
          if (t && !c.misma.length) h += '<p class="u-nota">Esta marca no te compra ninguna tela igual. La más parecida:</p>';
          h += c.otras.map(function (x) { return linea(x, tt, r); }).join('');
        }
        caja.innerHTML = h;
      }

      el.addEventListener('change', function (e) {
        var id = e.target.id;
        if (id === 'pr-marca') S.marca = e.target.value;
        else if (id === 'pr-tela') { S.tela = e.target.value; $('pr-mcoste').value = ''; }
        else if (id !== 'pr-mud') return;
        pintar();
      });
      el.addEventListener('input', function (e) {
        var id = e.target.id;
        if (id === 'pr-gana') { S.modo = 'gana'; pintar('gana'); }
        else if (id === 'pr-precio') { S.modo = 'precio'; pintar('precio'); }
        else if (id === 'pr-envio') { S.envioTocado = true; pintar(); }
        else if (['pr-etotal', 'pr-metros', 'pr-mcoste', 'pr-mancho'].indexOf(id) >= 0) pintar();
      });
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-whatsapp]') && ultimo) { copiar(whatsapp(ultimo.t, ultimo.r.precio), 'Copiado: pégalo en WhatsApp.'); return; }
        var g = e.target.closest('[data-guardar]');
        if (g && ultimo) {
          var fila = propuesta(S.marca, ultimo.t, ultimo.r, hoyISO()), para = ultimo.para;
          if (!fila) return;
          g.disabled = true;
          Promise.resolve(T.crear('PROPUESTAS', fila)).then(function () { ctx.aviso('Guardado en la ficha de ' + para + ': ' + eur(fila.PRECIO) + '.'); if (ctx.abierta()) pintar(); },
            function (er) { g.disabled = false; ctx.aviso('No se ha guardado: ' + ((er && er.message) || er)); });
          return;
        }
        var su = e.target.closest('[data-sueles]');
        if (su) { S.modo = 'gana'; $('pr-gana').value = cifra(Number(su.getAttribute('data-sueles'))); pintar('gana'); return; }
        var b = e.target.closest('[data-poner]');
        if (b) { S.modo = 'precio'; $('pr-precio').value = cifra(Number(b.getAttribute('data-poner'))); pintar(); return; }
        var v = e.target.closest('[data-envio]');
        if (v) {
          S.envioModo = v.getAttribute('data-envio');
          Array.prototype.forEach.call(el.querySelectorAll('[data-envio]'), function (x) { x.setAttribute('aria-pressed', x === v ? 'true' : 'false'); });
          pintar();
        }
      });

      ctx.alCambiar(function (t) { if (TABLAS.indexOf(t) >= 0) { listas(); pintar(); } else if (FACTURAS.indexOf(t) >= 0) pintar(); });
      var hay = TABLAS.every(function (t) { return (T.filas(t) || []).length || t === 'COMPARATIVA' || t === 'PROPUESTAS'; });
      if (hay) { listas(); pintar(); } else $('pr-res').innerHTML = '<div class="kz-centro" role="status"><div class="u-carga"></div></div>';
      T.leer(TABLAS).then(function () {
        listas(); pintar();
        // T0659: después, sin hacer esperar a la calculadora; si no se pueden leer, la calculadora sigue igual, sin propuesta.
        if (FACTURAS.length) T.leer(FACTURAS).then(function () { facturasLeidas = true; pintar(); }, function () {});
      }, function (e) {
        if (ctx.abierta()) $('pr-res').innerHTML = '<p class="u-error">No se han podido leer tus telas.</p><p class="u-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + '</p>';
      });
    }
  });
})();
