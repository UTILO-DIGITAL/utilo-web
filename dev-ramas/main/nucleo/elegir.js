/*
 * Elegir escribiendo · T0684 · una sola pieza para los desplegables largos del núcleo
 *
 * Un <select> con data-elegir se ve como un botón con lo elegido; al tocarlo se abre una lista con un buscador encima:
 * lo que se escribe la va acortando («tapi» deja «Tapizados Ejemplo», sin mirar tildes ni mayúsculas, y cada palabra por
 * su lado: «casa gij» encuentra «Casa Alba Gijón»), con lo usado hace poco arriba. En el ordenador sale debajo del campo;
 * en el móvil, desde abajo, como las demás ventanas cortas (T0679).
 *
 * - El <select> sigue debajo, oculto, con su id y su valor: la sección lo lee y lo escucha igual que antes (al elegir, «input»
 *   y «change»). Si la sección cambia sus opciones o su valor (s.value = …, s.innerHTML = …), el botón lo enseña solo.
 * - data-elegir="<clave>": dónde se guardan los usados hace poco (en este dispositivo, solo los 5 últimos de esa clave); vacío,
 *   el id del select. Una opción con data-siempre («Otra: escribo el coste») sale siempre, al final, aunque no case.
 * - Las opciones de valor vacío («Cualquiera», «Sin elegir») salen arriba mientras no se escribe nada.
 * - Con 8 opciones o menos no hay buscador: es la misma lista, sin más.
 * - Sin este archivo (otra app), el <select> se queda como siempre: nada se rompe.
 * Se engancha solo: mira la página y mejora cada select[data-elegir] que aparece (window.UElegir.mejorar, a mano).
 * Lo carga el index.html de cada app que lo quiera, después de nucleo.js (hoy, Telas). Pruebas: herramientas/probar-elegir.js.
 */
(function () {
  'use strict';
  var MAX_RECIENTES = 5, CON_BUSCADOR = 8, MOVIL = '(max-width: 639px)';
  // En Node (las pruebas, probar-elegir.js), solo lo de buscar.
  if (typeof window === 'undefined') { if (typeof module !== 'undefined') module.exports = { plano: plano, filtrar: filtrar, resaltar: resaltar, CON_BUSCADOR: CON_BUSCADOR }; return; }
  if (window.UElegir) return;
  var abierto = null; // { sel, boton, caja, buscar, lista, items, activo }
  var desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  var descIdx = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** Sin tildes ni mayúsculas, para comparar («Ébano» → «ebano»). Mantiene la longitud (para resaltar lo que casa). La del
   *  núcleo (T0736: UN.plano). */
  var UNT = null;
  function plano(s) { return (UNT || (UNT = typeof module !== 'undefined' && module.exports ? require('./nucleo.js') : window.UN)).plano(s); }
  function clave(sel) { return 'u-elegir:' + (sel.getAttribute('data-elegir') || sel.id || 'x'); }
  function recientes(sel) { try { var r = JSON.parse(localStorage.getItem(clave(sel)) || '[]'); return Array.isArray(r) ? r.map(String) : []; } catch (e) { return []; } }
  function apuntar(sel, v) {
    if (v === '') return;
    var r = recientes(sel).filter(function (x) { return x !== v; }); r.unshift(v);
    try { localStorage.setItem(clave(sel), JSON.stringify(r.slice(0, MAX_RECIENTES))); } catch (e) {}
  }
  function etiquetaDe(sel) {
    var l = sel.id && document.querySelector('label[for="' + sel.id + '"]'), w = sel.closest('label');
    var e = l || w; if (!e) return sel.getAttribute('aria-label') || '';
    var t = e.querySelector('.u-etiqueta'); return ((t || e).textContent || '').trim();
  }

  /* ---------- El botón: lo que se ve en lugar del select ---------- */
  function pintarBoton(sel) {
    var b = sel._elegir; if (!b) return;
    var o = sel.options[descIdx.get.call(sel)], vacio = !o || o.value === '';
    b.querySelector('.u-elegir-t').textContent = o ? o.textContent : '';
    b.classList.toggle('u-elegir-vacio', vacio);
    b.disabled = sel.disabled;
  }
  function mejorar(sel) {
    if (!sel || sel._elegir || sel.multiple) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'u-elegir-boton' + (sel.className ? ' ' + sel.className.replace(/\bli-fsel\b/, '') : '');
    b.setAttribute('aria-haspopup', 'listbox'); b.setAttribute('aria-expanded', 'false');
    b.innerHTML = '<span class="u-elegir-t"></span>';
    var et = etiquetaDe(sel); if (et) b.setAttribute('aria-label', et);
    sel.parentNode.insertBefore(b, sel);
    sel.classList.add('u-elegir-nativo'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    sel._elegir = b; b._sel = sel;
    // Lo que la sección le hace al select (valor u opciones nuevas) se ve en el botón.
    Object.defineProperty(sel, 'value', { configurable: true, get: function () { return desc.get.call(sel); }, set: function (v) { desc.set.call(sel, v); pintarBoton(sel); } });
    Object.defineProperty(sel, 'selectedIndex', { configurable: true, get: function () { return descIdx.get.call(sel); }, set: function (v) { descIdx.set.call(sel, v); pintarBoton(sel); } });
    new MutationObserver(function () { pintarBoton(sel); }).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected'] });
    sel.addEventListener('change', function () { pintarBoton(sel); });
    b.addEventListener('click', function () { if (abierto && abierto.sel === sel) cerrar(true); else abrir(sel, ''); });
    b.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(sel, ''); return; }
      // Empezar a escribir sobre el campo lo abre ya buscando esa letra.
      if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); abrir(sel, ev.key); }
    });
    // Una etiqueta <label for> (o la que lo envuelve) abre la lista, como haría con el select.
    if (sel.id) { var l = document.querySelector('label[for="' + sel.id + '"]'); if (l) l.addEventListener('click', function (ev) { ev.preventDefault(); b.focus(); }); }
    pintarBoton(sel);
  }

  /* ---------- Las opciones ---------- */
  function opciones(sel) {
    return [].map.call(sel.options, function (o, i) {
      var g = o.parentNode && o.parentNode.tagName === 'OPTGROUP' ? o.parentNode.label : '';
      return { i: i, valor: o.value, t: o.textContent, p: plano(o.textContent), grupo: g, siempre: o.hasAttribute('data-siempre'), off: o.disabled };
    });
  }
  /** Lo que casa con lo escrito: cada palabra en el nombre; primero lo que empieza por la primera palabra. */
  function filtrar(ops, q) {
    var ps = plano(q).trim().split(/\s+/).filter(Boolean);
    if (!ps.length) return null;
    var r = ops.filter(function (o) { return o.valor !== '' && !o.siempre && ps.every(function (p) { return o.p.indexOf(p) >= 0; }); });
    var pos = function (o) { var k = o.p.indexOf(ps[0]); return k === 0 ? 0 : (/\s/.test(o.p.charAt(k - 1)) ? 1 : 2); };
    return r.map(function (o, n) { return { o: o, n: n, k: pos(o) }; }).sort(function (a, b) { return a.k - b.k || a.n - b.n; }).map(function (x) { return x.o; });
  }
  function resaltar(o, q) {
    var ps = plano(q).trim().split(/\s+/).filter(Boolean), marca = [];
    ps.forEach(function (p) { var k = o.p.indexOf(p); if (k >= 0) for (var j = k; j < k + p.length; j++) marca[j] = true; });
    var h = '', dentro = false;
    for (var i = 0; i < o.t.length; i++) {
      if (marca[i] && !dentro) { h += '<mark>'; dentro = true; } else if (!marca[i] && dentro) { h += '</mark>'; dentro = false; }
      h += texto(o.t.charAt(i));
    }
    return h + (dentro ? '</mark>' : '');
  }
  function pintarLista() {
    var A = abierto, q = A.buscar ? A.buscar.value : '', ops = opciones(A.sel), sel = A.sel.value, h = '', items = [];
    var fila = function (o, extra) {
      items.push(o);
      return '<li role="option" id="u-elegir-o' + (items.length - 1) + '" data-n="' + (items.length - 1) + '" class="u-elegir-op' + (o.valor === '' ? ' u-elegir-nada' : '') + (extra || '') +
        '" aria-selected="' + (o.valor === sel) + '"' + (o.off ? ' aria-disabled="true"' : '') + '>' + (q ? resaltar(o, q) : texto(o.t)) + '</li>';
    };
    var grupo = function (t) { return t ? '<li class="u-elegir-grupo" role="presentation">' + texto(t) + '</li>' : ''; };
    var f = filtrar(ops, q);
    if (f === null) {
      ops.filter(function (o) { return o.valor === ''; }).forEach(function (o) { h += fila(o); });
      var rec = recientes(A.sel).map(function (v) { return ops.filter(function (o) { return o.valor === v && o.valor !== ''; })[0]; }).filter(Boolean);
      if (rec.length && ops.length > CON_BUSCADOR) { h += grupo('Usados hace poco'); rec.forEach(function (o) { h += fila(o, ' u-elegir-rec'); }); }
      var g = null, hayGrupos = ops.some(function (o) { return o.grupo; });
      if (rec.length && ops.length > CON_BUSCADOR && !hayGrupos) h += grupo('Todos');
      ops.forEach(function (o) {
        if (o.valor === '' || o.siempre) return;
        if (o.grupo !== g) { g = o.grupo; h += grupo(g); }
        h += fila(o);
      });
    } else {
      var g2 = null, varios = f.some(function (o) { return o.grupo !== (f[0] && f[0].grupo); });
      f.forEach(function (o) { if (varios && o.grupo !== g2) { g2 = o.grupo; h += grupo(g2); } h += fila(o); });
      if (!f.length) h += '<li class="u-elegir-vacia" role="presentation">Nada lleva «' + texto(q.trim()) + '»</li>';
    }
    ops.filter(function (o) { return o.siempre; }).forEach(function (o) { h += fila(o, ' u-elegir-siempre'); });
    A.lista.innerHTML = h; A.items = items;
    // Lo elegido marcado; al escribir, lo primero que casa.
    var ini = q ? items.findIndex(function (o) { return o.valor !== '' && !o.off; }) : items.findIndex(function (o) { return o.valor === sel; });
    activar(ini < 0 ? 0 : ini, !q);
  }
  function activar(n, centrar) {
    var A = abierto; if (!A || !A.items.length) return;
    n = Math.max(0, Math.min(A.items.length - 1, n)); A.activo = n;
    [].forEach.call(A.lista.querySelectorAll('.u-elegir-activa'), function (x) { x.classList.remove('u-elegir-activa'); });
    var li = A.lista.querySelector('[data-n="' + n + '"]'); if (!li) return;
    li.classList.add('u-elegir-activa');
    (A.buscar || A.boton).setAttribute('aria-activedescendant', li.id);
    var lt = A.lista.getBoundingClientRect(), r = li.getBoundingClientRect();
    if (centrar) A.lista.scrollTop += r.top - lt.top - (lt.height - r.height) / 2;
    else if (r.top < lt.top) A.lista.scrollTop -= lt.top - r.top; else if (r.bottom > lt.bottom) A.lista.scrollTop += r.bottom - lt.bottom;
  }
  function elegir(n) {
    var A = abierto, o = A && A.items[n]; if (!o || o.off) return;
    var sel = A.sel, antes = sel.value;
    cerrar(true);
    sel.value = o.valor; apuntar(sel, o.valor);
    if (sel.value !== antes) { sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  /* ---------- Abrir y cerrar ---------- */
  function abrir(sel, letra) {
    if (abierto) cerrar(false);
    var b = sel._elegir, movil = window.matchMedia && window.matchMedia(MOVIL).matches, n = sel.options.length, conBuscar = n > CON_BUSCADOR;
    var caja = document.createElement('div');
    caja.className = 'u-elegir-caja' + (movil ? ' u-elegir-hoja' : '');
    var et = etiquetaDe(sel);
    caja.innerHTML = (movil ? '<div class="u-elegir-cab"><h2>' + texto(et || 'Elige') + '</h2><button type="button" class="u-btn u-btn-texto" data-elegir-cerrar>Cerrar</button></div>' : '') +
      (conBuscar ? '<div class="u-elegir-buscar"><svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
        '<input type="search" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Escribe para buscar" aria-label="Buscar ' + texto(et ? 'en ' + et.toLowerCase() : '') + '" role="combobox" aria-expanded="true" aria-controls="u-elegir-lista"></div>' : '') +
      '<ul class="u-elegir-lista" id="u-elegir-lista" role="listbox"' + (et ? ' aria-label="' + texto(et) + '"' : '') + '></ul>';
    var velo = null;
    if (movil) { velo = document.createElement('div'); velo.className = 'u-elegir-velo'; velo.addEventListener('click', function () { cerrar(true); }); document.body.appendChild(velo); }
    document.body.appendChild(caja);
    abierto = { sel: sel, boton: b, caja: caja, velo: velo, movil: movil, buscar: caja.querySelector('input'), lista: caja.querySelector('ul'), items: [], activo: 0 };
    b.setAttribute('aria-expanded', 'true'); b.classList.add('u-elegir-abierto');
    if (abierto.buscar) { abierto.buscar.value = letra || ''; abierto.buscar.addEventListener('input', pintarLista); }
    pintarLista();
    colocar();
    (abierto.buscar || abierto.lista).focus({ preventScroll: true });
    if (!abierto.buscar) abierto.lista.tabIndex = -1;
    caja.addEventListener('keydown', teclas);
    caja.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-elegir-cerrar]')) { cerrar(true); return; }
      var li = ev.target.closest('.u-elegir-op'); if (li) elegir(+li.getAttribute('data-n'));
    });
    caja.addEventListener('mousemove', function (ev) { var li = ev.target.closest('.u-elegir-op'); if (li && +li.getAttribute('data-n') !== abierto.activo) activar(+li.getAttribute('data-n')); });
  }
  function colocar() {
    var A = abierto; if (!A) return;
    if (A.movil) {
      // En el móvil, por encima del teclado: la hoja acaba donde empieza y no cambia de alto al acortarse la lista.
      var vv = window.visualViewport, vis = vv ? vv.height : window.innerHeight, baja = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      A.caja.style.bottom = baja + 'px';
      A.caja.style.height = A.buscar ? Math.round(Math.min(vis - 24, window.innerHeight * 0.82)) + 'px' : '';
      A.caja.style.maxHeight = (vis - 24) + 'px';
      return;
    }
    var r = A.boton.getBoundingClientRect(), w = Math.max(r.width, 320), alto = window.innerHeight;
    // Debajo si caben unas 6 filas o hay más sitio que arriba; si no, encima. Nunca más alta que el sitio de su lado.
    var abajo = alto - r.bottom - 12, arriba = r.top - 12, baja = abajo >= 260 || abajo >= arriba, max = Math.min(360, baja ? abajo : arriba);
    A.caja.style.width = Math.min(w, window.innerWidth - 16) + 'px';
    A.caja.style.left = Math.max(8, Math.min(r.left, window.innerWidth - Math.min(w, window.innerWidth - 16) - 8)) + 'px';
    A.lista.style.maxHeight = Math.max(120, max - (A.buscar ? 50 : 10)) + 'px';
    if (baja) { A.caja.style.top = (r.bottom + 4) + 'px'; A.caja.style.bottom = ''; }
    else { A.caja.style.top = ''; A.caja.style.bottom = (alto - r.top + 4) + 'px'; }
  }
  function cerrar(volver) {
    var A = abierto; if (!A) return;
    abierto = null;
    A.caja.remove(); if (A.velo) A.velo.remove();
    A.boton.setAttribute('aria-expanded', 'false'); A.boton.classList.remove('u-elegir-abierto');
    if (volver) A.boton.focus({ preventScroll: true });
  }
  function teclas(ev) {
    var A = abierto; if (!A) return;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); activar(A.activo + 1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); activar(A.activo - 1); }
    else if (ev.key === 'PageDown') { ev.preventDefault(); activar(A.activo + 8); }
    else if (ev.key === 'PageUp') { ev.preventDefault(); activar(A.activo - 8); }
    else if (ev.key === 'Enter') { ev.preventDefault(); elegir(A.activo); }
    else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); cerrar(true); }
    else if (ev.key === 'Tab') { cerrar(false); }
  }
  // Fuera de la lista, se cierra (sin elegir); al mover la página en el ordenador, se recoloca.
  document.addEventListener('pointerdown', function (ev) {
    if (abierto && !abierto.caja.contains(ev.target) && !abierto.boton.contains(ev.target) && !(abierto.velo && abierto.velo.contains(ev.target))) cerrar(false);
  }, true);
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', function () { colocar(); }); window.visualViewport.addEventListener('scroll', function () { colocar(); }); }
  window.addEventListener('resize', function () { if (abierto && abierto.movil !== window.matchMedia(MOVIL).matches) cerrar(false); else colocar(); });
  document.addEventListener('scroll', function (ev) { if (abierto && !abierto.caja.contains(ev.target)) colocar(); }, true);

  /* ---------- Engancharse solo ---------- */
  function buscar(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    if (raiz.matches && raiz.matches('select[data-elegir]')) mejorar(raiz);
    [].forEach.call(raiz.querySelectorAll('select[data-elegir]'), mejorar);
  }
  function arrancar() {
    buscar(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) buscar(n); }); });
      // Si quitan el campo con la lista abierta (se cierra la ventana), la lista se va con él.
      if (abierto && !document.body.contains(abierto.boton)) cerrar(false);
    }).observe(document.body, { childList: true, subtree: true });
  }
  window.UElegir = { mejorar: mejorar, cerrar: function () { cerrar(false); }, filtrar: filtrar, plano: plano };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
