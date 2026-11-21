/*
 * Buscar en toda la app · T0685 · la lupa del marco del núcleo
 *
 * En el ordenador, «Buscar» arriba del menú (y ⌘K o Ctrl+K); en el móvil, la lupa de la cabecera. Abre un buscador que mira
 * a la vez en varias tablas (config.json · nucleo.buscar: marcas, proveedores, telas, pedidos, seguimiento…) y enseña los
 * resultados agrupados, cada uno con su enlace a la ficha en su sección. Lo abre nucleo.js, que carga este archivo la
 * primera vez: window.UBuscar.abrir({ grupos, tablas, secciones, ocultar, mac }).
 *
 * - Cada grupo (montar.js · montarBuscar) dice su tabla, su nombre (una o varias rutas), su código, dónde más buscar (otras
 *   columnas, o una tabla que apunta a esta: las personas de una marca, con «titulo»: «Contacto»), lo que sale debajo y en
 *   qué sección se abre cada fila: la primera de «secciones» cuyo «si» cumple. Si quien busca no ve esa sección, la fila no sale.
 * - Lee con las tablas de quien ha entrado (las de las secciones: los mismos permisos y filtros; lo que su perfil no ve, ni se
 *   pide). Lo ya leído sale al momento.
 * - Sin tildes ni mayúsculas, cada palabra por su lado («casa gij» encuentra «Casa Alba Gijón»). Arriba lo que se llama así
 *   (y el código exacto, lo primero); después lo que sale por otra cosa, que lo dice («Contacto: Lucía»).
 * - 4 por grupo y «Ver las otras N»; el grupo con lo que más se parece, primero.
 * Pruebas: herramientas/probar-buscar.js.
 */
(function () {
  'use strict';
  var POR_GRUPO = 4, MAX_GRUPO = 50, ESPERA = 120; // T0722: ms tras la última tecla

  /** Sin tildes ni mayúsculas, con la misma longitud (para resaltar donde toca): «Ébano» → «ebano». La del núcleo (T0736: UN.plano). */
  var UNT = null;
  function plano(s) { return (UNT || (UNT = typeof module !== 'undefined' && module.exports ? require('./nucleo.js') : window.UN)).plano(s); }
  function palabras(q) { return plano(q).split(/\s+/).filter(Boolean); }
  function vacio(v) { return v === null || v === undefined || String(v).trim() === ''; }
  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /** El nombre de una fila de otra tabla (NOMBRE, TITULO o DETALLE, como Listado); sin ella, el código. */
  function nombreDe(D, t, id) {
    if (vacio(id)) return '';
    var f = D.fila(t, id);
    if (!f) return String(id);
    var n = ['NOMBRE', 'TITULO', 'DETALLE'].filter(function (k) { return !vacio(f[k]); })[0];
    return n ? String(f[n]) : String(id);
  }
  /** Las tablas que recorre una ruta desde t («ID_DISENO.ID_TECNICA»: DISENOS y TECNICAS). */
  function tablasDeRuta(refs, t, ruta) {
    var ts = [], tt = t;
    String(ruta).split('.').forEach(function (p) { var r = ((refs || {})[tt] || {})[p]; if (r) { ts.push(r); tt = r; } });
    return ts;
  }
  /** El valor de una ruta desde una fila de t, con el nombre al final si apunta a otra tabla. '' si pasa por una tabla oculta. */
  function ver(refs, D, t, f, ruta, ocultas) {
    var ps = String(ruta).split('.'), fila = f, tt = t;
    for (var i = 0; i < ps.length; i++) {
      var r = ((refs || {})[tt] || {})[ps[i]];
      if (!fila) return '';
      if (!r) return i === ps.length - 1 ? (fila[ps[i]] == null ? '' : fila[ps[i]]) : '';
      if ((ocultas || []).indexOf(r) >= 0) return '';
      if (i === ps.length - 1) return nombreDe(D, r, fila[ps[i]]);
      fila = vacio(fila[ps[i]]) ? null : D.fila(r, fila[ps[i]]); tt = r;
    }
    return '';
  }
  /** Las condiciones de «si» (como las de Listado, con los valores como se ven): { campo, es | no | vacio }; todas. */
  function cumple(valor, conds) {
    return (conds || []).every(function (c) {
      var v = plano(valor(c.campo));
      if (c.es !== undefined && [].concat(c.es).map(plano).indexOf(v) < 0) return false;
      if (c.no !== undefined && [].concat(c.no).map(plano).indexOf(v) >= 0) return false;
      if (c.vacio !== undefined && (v === '') !== !!c.vacio) return false;
      return true;
    });
  }

  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
  /** Lo de debajo del nombre: una fecha, «16 feb 2026»; con euros, «1.249 €»; con sinNumero, la fase sin su número. */
  function textoDetalle(d, v) {
    if (vacio(v)) return '';
    if (v instanceof Date && !isNaN(v)) return v.getDate() + ' ' + MESES[v.getMonth()] + ' ' + v.getFullYear();
    var s = String(v).trim(), m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return (+m[3]) + ' ' + MESES[+m[2] - 1] + ' ' + m[1];
    if (d.euros) { var n = Number(String(s).replace(',', '.')); if (!isNaN(n)) return n.toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' €'; }
    if (d.sinNumero) return s.replace(/^\d+\s*[.·-]?\s*/, '');
    return s;
  }

  /**
   * Lo que se busca de un grupo: cada fila que quien busca vería, con su sección, su nombre, su código, sus otros textos y
   * lo de debajo. D: { filas(t), fila(t, id) }; ocultar: el de quien ha entrado (sus tablas no se usan); secciones: { ID:
   * { titulo, icono } } de las que ve.
   */
  function indice(g, D, ocultar, secciones) {
    var ocultas = (ocultar && ocultar.tablas) || [], refs = g._refs || {}, out = [];
    var deOtra = {};
    (g.buscar || []).forEach(function (b, k) {
      if (!b.tabla || ocultas.indexOf(b.tabla) >= 0) return;
      var m = deOtra[k] = {};
      (D.filas(b.tabla) || []).forEach(function (x) {
        var id = x[b.campo];
        if (vacio(id)) return;
        var v = ver(refs, D, b.tabla, x, b.columna, ocultas);
        if (!vacio(v)) (m[id] = m[id] || []).push(String(v));
      });
    });
    (D.filas(g.tabla) || []).forEach(function (f) {
      var valor = function (r) { return ver(refs, D, g.tabla, f, r, ocultas); };
      var sec = (g.secciones || []).filter(function (s) { return cumple(valor, s.si); })[0];
      if (!sec || sec.ve === false || !secciones[sec.id]) return;
      var nombre = g.nombre.map(valor).filter(function (v) { return !vacio(v); }).join(' · ');
      var codigo = vacio(f[g.codigo]) ? '' : String(f[g.codigo]);
      if (!codigo) return; // sin código no se puede abrir
      var textos = [];
      (g.buscar || []).forEach(function (b, k) {
        // T0730: con «con», se cruza por esa columna de la fila (la composición de una tela, por su diseño).
        if (b.tabla) (deOtra[k] && deOtra[k][b.con ? String(f[b.con]) : codigo] || []).forEach(function (v) { textos.push({ t: v, titulo: b.titulo }); });
        else { var v = valor(b.campo); if (!vacio(v)) textos.push({ t: String(v), titulo: b.titulo }); }
      });
      var detalle = (g.detalle || []).map(function (d) { return textoDetalle(d, valor(d.campo)); }).filter(Boolean);
      out.push({ seccion: sec.id, nombre: nombre || codigo, codigo: codigo, textos: textos, detalle: detalle,
        pNombre: plano(nombre), pCodigo: plano(codigo), pTodo: plano([nombre, codigo].concat(textos.map(function (x) { return x.t; })).join(' \u0001 ')) });
    });
    return out;
  }

  /** Lo que se parece cada fila a lo buscado: 5 el código exacto, 3-4 el nombre (4 si empieza así), 1 por otra cosa. */
  function puntos(x, ps) {
    if (!ps.every(function (p) { return x.pTodo.indexOf(p) >= 0; })) return 0;
    if (ps.length === 1 && x.pCodigo === ps[0]) return 5;
    if (ps.every(function (p) { return x.pNombre.indexOf(p) >= 0; })) {
      return x.pNombre.indexOf(ps[0]) === 0 || (' ' + x.pNombre).indexOf(' ' + ps[0]) >= 0 ? 4 : 3;
    }
    if (ps.every(function (p) { return x.pNombre.indexOf(p) >= 0 || x.pCodigo.indexOf(p) >= 0; })) return 2;
    return 1;
  }
  /** Por qué sale una fila que no se llama así: el primer texto con título que casa («Contacto: Lucía Ejemplo»). */
  function porque(x, ps) {
    if (ps.every(function (p) { return x.pNombre.indexOf(p) >= 0; })) return null;
    return x.textos.filter(function (t) { var pt = plano(t.t); return t.titulo && ps.some(function (p) { return pt.indexOf(p) >= 0; }); })[0] || null;
  }
  /**
   * Busca en los índices ([{ g, filas }]): [{ g, filas: [{ x, puntos, porque }] }] con algo, el grupo con lo que más se parece
   * primero (a igualdad, en su orden); dentro, por puntos y por nombre. null si no hay nada escrito.
   */
  function buscar(indices, q) {
    var ps = palabras(q);
    if (!ps.length) return null;
    return indices.map(function (ix, orden) {
      var fs = [];
      ix.filas.forEach(function (x) { var n = puntos(x, ps); if (n) fs.push({ x: x, puntos: n, porque: n < 3 ? porque(x, ps) : null }); });
      // A igualdad, por nombre; lo que sale por su código (BOR-004 → BOR-004-01, -02…), por código.
      fs.sort(function (a, b) { return b.puntos - a.puntos || (a.puntos === 2 ? a.x.codigo.localeCompare(b.x.codigo, 'es', { numeric: true }) : 0) || a.x.nombre.localeCompare(b.x.nombre, 'es', { numeric: true }); });
      return { g: ix.g, filas: fs, mejor: fs.length ? fs[0].puntos : 0, orden: orden };
    }).filter(function (r) { return r.filas.length; }).sort(function (a, b) { return b.mejor - a.mejor || a.orden - b.orden; });
  }
  /** El texto con lo que casa en <mark> (escapado: nada de HTML de los datos pasa). */
  function resaltar(t, ps) {
    t = String(t == null ? '' : t);
    var p = plano(t), marcas = [];
    ps.forEach(function (w) { var i = 0; while (w && (i = p.indexOf(w, i)) >= 0) { marcas.push([i, i + w.length]); i += w.length; } });
    if (!marcas.length) return texto(t);
    marcas.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    var out = '', k = 0;
    marcas.forEach(function (m) { if (m[1] <= k) return; var a = Math.max(m[0], k); out += texto(t.slice(k, a)) + '<mark>' + texto(t.slice(a, m[1])) + '</mark>'; k = m[1]; });
    return out + texto(t.slice(k));
  }
  /** Las tablas que hay que leer para un grupo (sin las que su perfil no ve). */
  function tablasDe(g, ocultar) {
    var ocultas = (ocultar && ocultar.tablas) || [], ts = [g.tabla], refs = g._refs || {};
    var rutas = g.nombre.concat((g.detalle || []).map(function (d) { return d.campo; }))
      .concat((g.secciones || []).reduce(function (a, s) { return a.concat((s.si || []).map(function (c) { return c.campo; })); }, []));
    rutas.forEach(function (r) { ts = ts.concat(tablasDeRuta(refs, g.tabla, r)); });
    (g.buscar || []).forEach(function (b) {
      if (b.tabla) ts = ts.concat([b.tabla], tablasDeRuta(refs, b.tabla, b.columna));
      else ts = ts.concat(tablasDeRuta(refs, g.tabla, b.campo));
    });
    return ts.filter(function (t, i) { return ts.indexOf(t) === i && ocultas.indexOf(t) < 0; });
  }
  /** El enlace de una fila: ?s=clientes&ficha=M-001. */
  function enlace(g, x) { return '?s=' + encodeURIComponent(x.seccion.toLowerCase()) + '&' + g.abrir + '=' + encodeURIComponent(x.codigo); }

  var CALC = { plano: plano, palabras: palabras, ver: ver, cumple: cumple, textoDetalle: textoDetalle, indice: indice, puntos: puntos, buscar: buscar,
    resaltar: resaltar, tablasDe: tablasDe, enlace: enlace, POR_GRUPO: POR_GRUPO, MAX_GRUPO: MAX_GRUPO };
  if (typeof window === 'undefined') { if (typeof module !== 'undefined') module.exports = CALC; return; }
  if (window.UBuscar) return;

  /* ======================= la ventana ======================= */

  var LUPA = '<svg class="u-icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
  var A = null; // lo abierto: { o, velo, q, res, indices, cargando, abiertos, activa, antes }

  function lista(o) {
    var vis = {};
    (o.secciones || []).forEach(function (s) { vis[s.id] = s; });
    return vis;
  }
  function nombresGrupos(o) {
    var ns = (o.grupos || []).map(function (g) { return g.titulo.toLowerCase(); });
    return ns.length > 1 ? ns.slice(0, -1).join(', ') + ' y ' + ns[ns.length - 1] : ns[0] || '';
  }

  function abrir(o) {
    if (A) { A.q.focus(); return; }
    var velo = document.createElement('div');
    velo.className = 'bu-velo';
    velo.innerHTML = '<div class="bu-panel" role="dialog" aria-modal="true" aria-label="Buscar en toda la app">' +
      '<div class="bu-campo">' + LUPA + '<input type="search" id="bu-q" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" ' +
      'placeholder="' + texto(o.placeholder || 'Busca un nombre, una persona o un código') + '" aria-label="Buscar en toda la app" aria-controls="bu-res">' +
      '<button type="button" class="bu-cerrar" id="bu-cerrar"><span class="bu-movil">Cancelar</span><span class="bu-ancho">Cerrar</span></button></div>' +
      '<div class="bu-res" id="bu-res" aria-live="polite"></div>' +
      '<div class="bu-pie" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> para moverte</span><span><kbd>↵</kbd> para abrir</span><span><kbd>Esc</kbd> para cerrar</span></div></div>';
    document.body.appendChild(velo);
    A = { o: o, velo: velo, q: velo.querySelector('#bu-q'), res: velo.querySelector('#bu-res'), indices: null, cargando: true, abiertos: {}, activa: 0,
      antes: document.activeElement, bloqueo: document.body.style.overflow };
    document.body.style.overflow = 'hidden';
    A.q.focus();
    // T0722 (R76): busca cuando se deja de escribir (ESPERA ms), no en cada tecla; vacía, al momento.
    A.q.addEventListener('input', function () {
      var a = A; a.abiertos = {}; a.activa = 0; clearTimeout(a.espera); a.espera = 0;
      if (!palabras(a.q.value).length) { pintar(); return; }
      a.espera = setTimeout(function () { a.espera = 0; if (A === a) pintar(); }, ESPERA);
    });
    A.q.addEventListener('keydown', teclas);
    velo.addEventListener('click', function (e) {
      if (e.target === velo || (e.target.closest && e.target.closest('#bu-cerrar'))) { cerrar(); return; }
      var mas = e.target.closest && e.target.closest('[data-bu-mas]');
      if (mas) { A.abiertos[mas.getAttribute('data-bu-mas')] = true; pintar(); A.q.focus(); return; }
      // Una fila es un enlace de sección (data-sx): lo abre el marco; aquí solo se cierra la ventana.
      if (e.target.closest && e.target.closest('a[data-sx]')) cerrar(true);
    });
    pintar();
    leer();
  }

  /** Lee las tablas de cada grupo (lo ya leído, al momento) y rehace los índices; un grupo que no se puede leer no sale. */
  function leer() {
    var a = A, o = a.o, vis = lista(o);
    var ps = (o.grupos || []).map(function (g) {
      return o.tablas.leer(tablasDe(g, o.ocultar)).then(function () {
        return { g: g, filas: indice(g, o.tablas, o.ocultar, vis) };
      }, function (e) { if (window.console) console.warn('Buscar: no se ha podido leer ' + g.titulo + ': ' + (e && e.message)); return null; });
    });
    Promise.all(ps).then(function (ix) {
      if (A !== a) return;
      a.indices = ix.filter(Boolean); a.cargando = false;
      pintar();
    });
  }
  /**
   * T0742 · De las tablas que se leen por partes (nucleo.partes: SEGUIMIENTO), al escribir algo también lo antiguo: se busca ya en
   * lo que hay y, cuando llega lo de antes, se rehacen sus índices (una nota de hace años también se encuentra).
   */
  function antiguo(a) {
    var o = a.o, T = o.tablas, vis = lista(o);
    if (!T.faltaAntiguo) return;
    var ts = [];
    (o.grupos || []).forEach(function (g) { if (T.faltaAntiguo(g.tabla) && ts.indexOf(g.tabla) < 0) ts.push(g.tabla); });
    ts.forEach(function (t) {
      T.leerAntiguo(t).then(function () {
        if (A !== a || !a.indices) return;
        a.indices = a.indices.map(function (x) { return x.g.tabla === t ? { g: x.g, filas: indice(x.g, T, o.ocultar, vis) } : x; });
        pintar();
      }, function () {});
    });
  }

  function pintar() {
    var a = A, q = a.q.value, ps = palabras(q), o = a.o, vis = lista(o);
    if (!ps.length) {
      a.res.innerHTML = '<div class="bu-vacio"><p>Busca a la vez en ' + texto(nombresGrupos(o)) + '.</p>' + (o.texto ? '<p>' + texto(o.texto) + '</p>' : '') + '</div>';
      return;
    }
    if (!a.indices) { a.res.innerHTML = '<div class="bu-vacio" role="status"><div class="u-carga"></div></div>'; return; }
    if (!a.antiguo) { a.antiguo = true; antiguo(a); } // T0742: lo de antes, al buscar algo (no solo por abrir)
    var rs = buscar(a.indices, q);
    if (!rs.length) {
      a.res.innerHTML = '<div class="bu-vacio"><p>Nada con «' + texto(q.trim()) + '».</p><p>Prueba con una parte del nombre o con otra palabra (no hace falta poner tildes).</p></div>';
      return;
    }
    var total = rs.reduce(function (s, r) { return s + r.filas.length; }, 0), n = 0;
    var h = '<p class="bu-cuenta">' + total + (total === 1 ? ' resultado' : ' resultados') + '</p>';
    rs.forEach(function (r) {
      var g = r.g, max = a.abiertos[g.titulo] ? MAX_GRUPO : POR_GRUPO, varias = g.secciones.filter(function (s) { return s.ve !== false && vis[s.id]; }).length > 1;
      h += '<section class="bu-grupo"><h2>' + texto(g.titulo) + ' <span>' + r.filas.length + '</span></h2>';
      r.filas.slice(0, max).forEach(function (y) {
        var x = y.x, s = vis[x.seccion] || {};
        var debajo = y.porque ? (y.porque.titulo ? texto(y.porque.titulo) + ': ' : '') + resaltar(y.porque.t, ps) : x.detalle.map(function (d) { return resaltar(d, ps); }).join(' · ');
        h += '<a class="bu-fila' + (n === a.activa ? ' bu-activa' : '') + '" id="bu-f' + n + '" data-n="' + n + '" href="' + texto(enlace(g, x)) + '" data-sx="' + texto(x.seccion) + '">' +
          '<span class="bu-ic"><svg viewBox="0 0 24 24" aria-hidden="true">' + (s.icono || '') + '</svg></span>' +
          '<span class="bu-tx"><span class="bu-t">' + resaltar(x.nombre, ps) + '</span>' +
          '<span class="bu-d">' + (debajo || resaltar(x.codigo, ps)) + '</span></span>' +
          (varias ? '<span class="bu-chip">' + texto(s.titulo || '') + '</span>' : '') + '</a>';
        n++;
      });
      if (r.filas.length > max) h += '<button type="button" class="bu-mas" data-bu-mas="' + texto(g.titulo) + '">Ver ' + (r.filas.length - max === 1 ? 'la otra' : 'las otras ' + (r.filas.length - max)) + '</button>';
      else if (r.filas.length > MAX_GRUPO) h += '<p class="bu-cuenta bu-mas-nota">Y ' + (r.filas.length - MAX_GRUPO) + ' más: escribe algo más para afinar.</p>';
      h += '</section>';
    });
    a.res.innerHTML = h;
    a.total = n;
    if (a.activa >= n) a.activa = 0;
    a.q.setAttribute('aria-activedescendant', n ? 'bu-f' + a.activa : '');
  }

  function teclas(e) {
    var a = A;
    // Con una búsqueda a la espera, las flechas e Intro van sobre lo último escrito.
    if (a.espera && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) { clearTimeout(a.espera); a.espera = 0; pintar(); }
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!a.total) return;
      e.preventDefault();
      a.activa = (a.activa + (e.key === 'ArrowDown' ? 1 : -1) + a.total) % a.total;
      [].forEach.call(a.res.querySelectorAll('.bu-fila'), function (f) { f.classList.toggle('bu-activa', +f.getAttribute('data-n') === a.activa); });
      var f = a.res.querySelector('#bu-f' + a.activa);
      if (f) { f.scrollIntoView({ block: 'nearest' }); a.q.setAttribute('aria-activedescendant', f.id); }
      return;
    }
    if (e.key === 'Enter') { var x = a.res.querySelector('#bu-f' + a.activa); if (x) { e.preventDefault(); x.click(); } }
  }

  /** Cierra la ventana; sin «yendo» (no se ha abierto nada), el foco vuelve a donde estaba. */
  function cerrar(yendo) {
    var a = A;
    if (!a) return;
    clearTimeout(a.espera);
    A = null;
    a.velo.remove();
    document.body.style.overflow = a.bloqueo || '';
    if (!yendo && a.antes && a.antes.focus) try { a.antes.focus(); } catch (e) {}
  }

  window.UBuscar = { abrir: abrir, cerrar: cerrar, abierta: function () { return !!A; } };
})();
