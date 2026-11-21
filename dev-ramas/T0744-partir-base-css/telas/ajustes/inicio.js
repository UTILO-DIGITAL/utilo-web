/*
 * Ajustes de Telas · la pantalla de entrada (T0729, con el visto bueno de Javi a la maqueta de T0702)
 *
 * Solo Marta (quien administra). Arriba, lo que usa la app para calcular lo que le cuesta cada tela: las rupias por 1 € y
 * el envío y arancel por metro (la fila AJUSTES), que se guardan al cambiarlos. Debajo, «Tus listas»: las opciones de los
 * desplegables que ella amplía (las tablas del bloque «Tus listas»), como etiquetas; tocar una abre su ficha (cambiarle el
 * nombre o quitarla, si nada la usa) y «+ Añadir» apunta otra sin salir. Lee y escribe con lo que ya tiene Ajustes
 * (ctx.ajustes), con sus comprobaciones y su LOG. La sección va sin la pestaña «Todas las tablas» (TODAS: false).
 */
(function () {
  'use strict';

  /* ======================= cálculos (sin pantalla; se prueban en node) ======================= */

  /** «110», «5,00», «5 €», «1.020,5» → número; '' si está vacío; NaN si no es un número. */
  function leerNumero(s) {
    var t = String(s == null ? '' : s).replace(/[€₹\s]|\/m/g, '');
    if (!t) return '';
    if (/,/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
  }
  /**
   * Lo que se guarda de un ajuste escrito, o { mal } con el texto para la pantalla.
   * RUPIAS_POR_EURO: un número mayor que 0 (sin él no hay coste en euros). ENVIO_ARANCEL: vacío o 0 se deja (sin envío la
   * app dice «Falta el envío», T0678), pero no un número negativo.
   */
  function valorAjuste(campo, s) {
    var n = leerNumero(s);
    if (campo === 'RUPIAS_POR_EURO') {
      if (n === '' || isNaN(n) || n <= 0) return { mal: 'Escribe cuántas rupias dan por 1 €: un número mayor que 0, como 110.' };
      return { valor: n };
    }
    if (n === '') return { valor: '' };
    if (isNaN(n) || n < 0) return { mal: 'Escribe el envío y el arancel por metro en euros, como 5,00.' };
    return { valor: Math.round(n * 100) / 100 };
  }
  /** Cómo se enseña un ajuste guardado: las rupias tal cual (110), el envío con dos decimales (5,00). */
  function verAjuste(campo, v) {
    if (v === '' || v == null || isNaN(Number(v))) return '';
    return campo === 'ENVIO_ARANCEL' ? Number(v).toFixed(2).replace('.', ',') : String(v).replace('.', ',');
  }
  /** T0736 · Sin tildes ni mayúsculas: la del núcleo (UN.plano; en Node, las pruebas, la de nucleo.js). */
  var UNT = null;
  function plano(s) { return (UNT || (UNT = typeof module !== 'undefined' && module.exports ? require('../../nucleo/nucleo.js') : window.UN)).plano(s); }
  function norm(s) { return plano(s).trim(); }
  /** Las opciones de una lista, en su orden (ORDEN; si no tiene, por nombre). */
  function ordenadas(fs) {
    return (fs || []).filter(function (f) { return f && String(f.NOMBRE == null ? '' : f.NOMBRE).trim(); }).slice().sort(function (a, b) {
      var x = Number(a.ORDEN), y = Number(b.ORDEN);
      if (!isNaN(x) && !isNaN(y) && a.ORDEN !== '' && b.ORDEN !== '' && x !== y) return x - y;
      return String(a.NOMBRE).localeCompare(String(b.NOMBRE), 'es');
    });
  }
  /**
   * Lo que se da de alta al añadir una opción, o { mal }. Sin repetidos (sin mirar mayúsculas ni tildes: «algodon» es
   * Algodón) y, si la lista tiene ORDEN, al final. vistos: cómo se ve cada nombre ({ IG: 'Instagram' }), que también cuenta.
   */
  function nuevaOpcion(fs, nombre, conOrden, vistos) {
    var n = String(nombre == null ? '' : nombre).trim().replace(/\s+/g, ' ');
    if (!n) return { mal: 'Escribe cómo se llama.' };
    var igual = (fs || []).filter(function (f) { return norm(f.NOMBRE) === norm(n) || (vistos && norm(vistos[f.NOMBRE]) === norm(n)); })[0];
    if (igual) return { mal: '«' + ((vistos && vistos[igual.NOMBRE]) || igual.NOMBRE) + '» ya está en la lista.' };
    var v = { NOMBRE: n };
    if (conOrden) v.ORDEN = (fs || []).reduce(function (m, f) { var o = Number(f.ORDEN); return !isNaN(o) && f.ORDEN !== '' && o > m ? o : m; }, 0) + 1;
    return { valores: v };
  }

  var CALC = { leerNumero: leerNumero, valorAjuste: valorAjuste, verAjuste: verAjuste, ordenadas: ordenadas, nuevaOpcion: nuevaOpcion };
  if (typeof window === 'undefined' || !window.UN || !window.UN.ajustes) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  /* ======================= pantalla ======================= */

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // Como se ven en el resto de la app (Marcas y Proveedores): en GESTION sigue «IG» (T0642).
  var VISTOS = { VIAS: { IG: 'Instagram' } };
  var CAMPOS = [
    { c: 'RUPIAS_POR_EURO', t: 'Rupias por 1 €', tras: '₹' },
    { c: 'ENVIO_ARANCEL', t: 'Envío y arancel por metro', tras: '€/m' }
  ];
  var ESTILO = '.ta-aj{display:flex;flex-direction:column;gap:var(--e4);max-width:640px}' +
    '.ta-aj-caja{border:1px solid var(--color-linea);border-radius:8px;background:var(--color-superficie);padding:var(--e4);display:flex;flex-direction:column;gap:var(--e3)}' +
    '.ta-aj-caja h2{margin:0;font-size:16px;font-weight:600}' +
    '.ta-aj-cifra{display:flex;align-items:center;gap:var(--e2)}.ta-aj-cifra input{width:9em;font-size:16px}' +
    '.ta-aj-lista{display:flex;flex-direction:column;gap:var(--e1)}' +
    '.ta-aj-chips{display:flex;flex-wrap:wrap;gap:var(--e2)}' +
    '.ta-aj-chip{border:1px solid var(--color-borde-campo);border-radius:999px;background:var(--color-superficie);color:var(--color-texto);padding:6px 12px;min-height:36px;font:inherit;font-size:14px;cursor:pointer}' +
    '.ta-aj-chip:hover{border-color:var(--color-principal-oscuro)}' +
    '.ta-aj-mas{border-style:dashed;color:var(--color-principal-oscuro)}' +
    '.ta-aj-nueva{display:flex;gap:var(--e2);align-items:center;flex-wrap:wrap}.ta-aj-nueva input{font-size:16px;min-width:12em}';

  window.UN.ajustes('TUS_AJUSTES', {
    abrir: function (el, ctx) {
      var A = ctx.ajustes, T = ctx.tablas, cfg = ctx.config || {};
      if (!document.getElementById('ta-aj-estilo')) { var st = document.createElement('style'); st.id = 'ta-aj-estilo'; st.textContent = ESTILO; document.head.appendChild(st); }
      // Las listas: las tablas del bloque «Tus listas», con su título.
      var listas = [];
      (cfg.BLOQUES || []).forEach(function (b) { if (b.titulo === 'Tus listas') listas = b.tablas; });
      var estado = {}, abierta = '', aviso = {};
      function conOrden(t) { var e = (cfg._tablas || {})[t]; return !!(e && e.columnas.some(function (c) { return c.n === 'ORDEN'; })); }
      function fila() { return (T.filas('AJUSTES') || []).filter(function (f) { return String(f.ID) === 'AJUSTES'; })[0] || null; }

      function pintar() {
        if (!el.isConnected) return;
        var f = fila(), foco = document.activeElement && el.contains(document.activeElement) ? document.activeElement.id : '';
        var env = f ? valorAjuste('ENVIO_ARANCEL', f.ENVIO_ARANCEL).valor : '';
        el.innerHTML = '<div class="ta-aj">' +
          '<p class="u-nota">Solo tú. Lo que usa la app para calcular lo que te cuesta cada tela.</p>' +
          // La fila AJUSTES viene de la copia (T0716); sin ella no hay dónde guardar: que se vea, no que falle al escribir.
          (f ? '' : '<p class="u-aviso">No encuentro la fila de tus ajustes. Avisa a Javi para que la ponga.</p>') +
          '<section class="ta-aj-caja">' + CAMPOS.map(function (x) {
            var v = f ? verAjuste(x.c, f[x.c]) : '';
            return '<label class="u-campo"><span class="u-etiqueta">' + texto(x.t) + '</span><span class="ta-aj-cifra">' +
              '<input id="ta-' + x.c + '" data-ajuste="' + x.c + '" inputmode="decimal" autocomplete="off" value="' + texto(v) + '"' + (ctx.soloLeer || !f ? ' disabled' : '') + '>' +
              '<span>' + texto(x.tras) + '</span><span class="u-nota" role="status">' + texto(estado[x.c] || '') + '</span></span>' +
              (aviso[x.c] ? '<span class="u-mal">' + texto(aviso[x.c]) + '</span>' : '') + '</label>';
          }).join('') +
          (f && (env === '' || env === 0) ? '<p class="u-aviso">Sin el envío, Mis telas, la Comparativa y Calcular precio dicen «Falta el envío».</p>' : '') +
          '<p class="u-nota">Cambiarlo recalcula Mis telas, la Comparativa y Calcular precio.</p></section>' +
          (listas.length ? '<section class="ta-aj-caja"><h2>Tus listas</h2><p class="u-nota">Lo que te ofrece la app al elegir. Toca una para cambiarle el nombre o quitarla.</p>' +
            listas.map(function (sp) {
              var vs = VISTOS[sp.tabla] || {};
              return '<div class="ta-aj-lista"><span class="u-etiqueta">' + texto(sp.titulo || sp.tabla) + '</span><div class="ta-aj-chips">' +
                ordenadas(T.filas(sp.tabla)).map(function (o) {
                  return '<button type="button" class="ta-aj-chip" data-lista="' + texto(sp.tabla) + '" data-id="' + texto(o.ID) + '">' + texto(vs[o.NOMBRE] || o.NOMBRE) + '</button>';
                }).join('') +
                (ctx.soloLeer ? '' : abierta === sp.tabla ? '' : '<button type="button" class="ta-aj-chip ta-aj-mas" data-anadir="' + texto(sp.tabla) + '">+ Añadir</button>') + '</div>' +
                (abierta === sp.tabla ? '<div class="ta-aj-nueva"><input id="ta-nueva" aria-label="Nueva opción de ' + texto(sp.titulo || sp.tabla) + '" autocomplete="off" placeholder="Cómo se llama">' +
                  '<button type="button" class="u-btn u-btn-accion" data-guardar="' + texto(sp.tabla) + '">Añadir</button><button type="button" class="u-btn u-btn-texto" data-cancelar>Cancelar</button></div>' : '') +
                (aviso[sp.tabla] ? '<span class="u-mal">' + texto(aviso[sp.tabla]) + '</span>' : '') + '</div>';
            }).join('') + '</section>' : '') +
          '</div>';
        var fe = foco && el.querySelector('#' + foco);
        if (fe) fe.focus();
        if (abierta && !fe) { var n = el.querySelector('#ta-nueva'); if (n) n.focus(); }
      }

      function guardarAjuste(inp) {
        var c = inp.getAttribute('data-ajuste'), r = valorAjuste(c, inp.value), f = fila();
        aviso[c] = r.mal || '';
        if (r.mal || !f) { estado[c] = ''; pintar(); return; }
        if (f && String(f[c] == null ? '' : f[c]) === String(r.valor)) { pintar(); return; }
        estado[c] = 'Guardando…'; pintar();
        var cambio = {}; cambio[c] = r.valor;
        A.cambiar('AJUSTES', 'AJUSTES', cambio).then(function () { estado[c] = 'Guardado'; pintar(); }, function (e) { estado[c] = ''; aviso[c] = (e && e.message) || 'No se ha podido guardar.'; pintar(); });
      }
      function anadir(t) {
        var inp = el.querySelector('#ta-nueva');
        var r = nuevaOpcion(T.filas(t), inp ? inp.value : '', conOrden(t), VISTOS[t]);
        if (r.mal) { aviso[t] = r.mal; pintar(); var i2 = el.querySelector('#ta-nueva'); if (i2) { i2.value = inp ? inp.value : ''; i2.focus(); } return; }
        aviso[t] = ''; abierta = '';
        A.crear(t, r.valores).then(function () { pintar(); }, function (e) { aviso[t] = (e && e.message) || 'No se ha podido añadir.'; pintar(); });
        pintar();
      }

      el.addEventListener('change', function (e) { var i = e.target.closest('[data-ajuste]'); if (i) guardarAjuste(i); });
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== 'Escape') return;
        if (e.target.id === 'ta-nueva') { e.preventDefault(); if (e.key === 'Enter') anadir(abierta); else { abierta = ''; pintar(); } }
        else if (e.key === 'Enter' && e.target.hasAttribute('data-ajuste')) { e.preventDefault(); e.target.blur(); }
      });
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-lista], [data-anadir], [data-guardar], [data-cancelar]');
        if (!b) return;
        if (b.hasAttribute('data-lista')) A.ficha(b.getAttribute('data-lista'), b.getAttribute('data-id'));
        else if (b.hasAttribute('data-anadir')) { abierta = b.getAttribute('data-anadir'); aviso[abierta] = ''; pintar(); }
        else if (b.hasAttribute('data-guardar')) anadir(b.getAttribute('data-guardar'));
        else { abierta = ''; pintar(); }
      });
      ctx.alCambiar(function (t) { if (t === 'AJUSTES' || listas.some(function (s) { return s.tabla === t; })) pintar(); });
      pintar();
    }
  });
})();
