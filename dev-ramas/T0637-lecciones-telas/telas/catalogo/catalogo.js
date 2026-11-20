/*
 * Catálogo de Marta para enseñar a una marca · T0686 · clientes/telas/modulos/catalogo de utilo-apps
 *
 * Página aparte de su app (decidido con Javi, 20/11/2026): sin menú, sin otras marcas ni nada
 * confidencial. Lo que pinta es lo que manda el motor (catalogoTelas), que ya escoge campo a campo lo que puede ver una
 * marca: aquí no se quita nada porque no llega nada que quitar.
 * - Entra con su Google como en la app: la misma clave («telas»), así que si ya ha entrado en la app de este navegador no
 *   pide nada. Si no, un botón «Entrar con Google».
 * - Filtros por técnica, buscador (color, código, composición, uso) y, al tocar una tela, su ficha con los otros colores
 *   del mismo diseño.
 * Las funciones de cálculo (filtrar, grupos, filasFicha) se exportan para las pruebas en node (probar-catalogo.js).
 */
(function () {
  'use strict';

  function sinAcentos(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** «1120» → «1.120»; lo que no es un número, tal cual. */
  function miles(v) {
    var s = String(v == null ? '' : v).trim();
    return /^\d{4,}$/.test(s) ? s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : s;
  }

  /** Las telas de esa técnica («Todas»: todas) que tienen lo buscado en su color, código, técnica, composición o uso. */
  function filtrar(telas, tecnica, buscado) {
    var q = sinAcentos(String(buscado || '').trim());
    return (telas || []).filter(function (t) {
      if (tecnica && tecnica !== 'Todas' && t.tecnica !== tecnica) return false;
      return !q || sinAcentos([t.id, t.color, t.tecnica, t.composicion, t.uso].join(' ')).indexOf(q) >= 0;
    });
  }

  /** Las telas agrupadas por técnica, en el orden de sus técnicas; las que no tienen técnica, al final en «Otras». */
  function grupos(tecnicas, telas) {
    var out = (tecnicas || []).map(function (n) { return { tecnica: n, telas: telas.filter(function (t) { return t.tecnica === n; }) }; });
    var otras = telas.filter(function (t) { return (tecnicas || []).indexOf(t.tecnica) < 0; });
    if (otras.length) out.push({ tecnica: 'Otras', telas: otras });
    return out.filter(function (g) { return g.telas.length; });
  }

  /** Las filas de la ficha: [[título, valor]], solo las que tienen algo. */
  function filasFicha(t) {
    var peso = [t.gsm ? miles(t.gsm) + ' g/m²' : '', t.glm ? miles(t.glm) + ' g por metro' : ''].filter(Boolean).join(' · ');
    return [
      ['Composición', t.composicion],
      ['Hilo del bordado', t.hilo],
      ['Ancho', t.ancho ? String(t.ancho).replace(/\s*cm$/i, '') + ' cm' : ''],
      ['Peso', peso],
      ['Rapport', t.rapport],
      ['Resistencia', t.martindale ? miles(t.martindale) + ' ciclos Martindale' : ''],
      ['Para', t.uso],
      ['Cuidado', t.cuidado],
      ['Certificado', t.oekoTex ? 'OEKO-TEX' : '']
    ].filter(function (f) { return f[1]; });
  }

  /** Lo de debajo del color en la tarjeta: «52 % poliéster · 48 % algodón · 137 cm». */
  function lineaTarjeta(t) {
    return [t.composicion, t.ancho ? String(t.ancho).replace(/\s*cm$/i, '') + ' cm' : ''].filter(Boolean).join(' · ');
  }

  var CAT = { filtrar: filtrar, grupos: grupos, filasFicha: filasFicha, lineaTarjeta: lineaTarjeta };
  if (typeof window === 'undefined' || typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = CAT; return; }

  /* ======================= la página ======================= */

  var C = window.KANBAN || {};
  var $ = function (id) { return document.getElementById(id); };
  var datos = null, tecnica = 'Todas', buscado = '';

  function foto(t, alt) {
    // Si la foto no carga (borrada en Drive, sin permiso, sin conexión), «Sin foto» en lugar del hueco.
    return t.foto ? '<img src="' + texto(t.foto) + '" alt="' + texto(alt || '') + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML=\'<span class=&quot;ca-sin&quot;>Sin foto</span>\'">' : '<span class="ca-sin">Sin foto</span>';
  }

  function pintarFiltros() {
    $('ca-filtros').innerHTML = ['Todas'].concat(datos.tecnicas).map(function (n) {
      return '<button class="ca-filtro" type="button" data-t="' + texto(n) + '" aria-pressed="' + (n === tecnica) + '">' + texto(n) + '</button>';
    }).join('');
  }

  function tarjeta(t) {
    return '<button class="ca-tarjeta" type="button" data-id="' + texto(t.id) + '" aria-label="' + texto(t.color + ', ' + t.id) + '">' +
      '<div class="ca-foto">' + foto(t, '') + '</div><div>' +
      '<p class="ca-color">' + texto(t.color || t.id) + '</p>' +
      (lineaTarjeta(t) ? '<p class="ca-datos">' + texto(lineaTarjeta(t)) + '</p>' : '') +
      '<p class="ca-datos ca-codigo">' + texto(t.id) + '</p></div></button>';
  }

  function pintar() {
    var p = $('ca-principal');
    if (!datos.telas.length) { p.innerHTML = '<p class="ca-nota">Todavía no hay telas en el catálogo.</p>'; return; }
    var vistas = filtrar(datos.telas, tecnica, buscado);
    if (!vistas.length) {
      p.innerHTML = '<p class="ca-nota">' + (buscado.trim() ? 'Ninguna tela con «' + texto(buscado.trim()) + '». Prueba con otra palabra o elige «Todas».' : 'Ninguna tela de ' + texto(tecnica) + '.') + '</p>';
      return;
    }
    p.innerHTML = '<p class="ca-nota">' + (vistas.length === 1 ? '1 tela' : vistas.length + ' telas') + '</p>' +
      grupos(datos.tecnicas, vistas).map(function (g) {
        return '<section class="ca-grupo"><h2>' + texto(g.tecnica) + '</h2><div class="ca-rejilla">' + g.telas.map(tarjeta).join('') + '</div></section>';
      }).join('');
  }

  function abrir(id) {
    var t = datos.telas.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    var hermanas = datos.telas.filter(function (x) { return x.diseno && x.diseno === t.diseno; });
    var f = $('ca-ficha');
    f.innerHTML = '<div class="ca-arriba"><span class="ca-tecnica">' + texto(t.tecnica) + '</span><button class="ca-boton" type="button" data-cerrar>Cerrar</button></div>' +
      '<div class="ca-foto">' + foto(t, t.color) + '</div>' +
      '<h3 id="ca-ficha-titulo">' + texto(t.color || t.id) + '</h3><div class="ca-codigo">' + texto(t.id) + '</div>' +
      (hermanas.length > 1 ? '<div class="ca-colores"><p>' + hermanas.length + ' colores de este diseño</p><div class="ca-muestras">' + hermanas.map(function (h) {
        return '<button class="ca-muestra" type="button" data-id="' + texto(h.id) + '" aria-label="' + texto(h.color || h.id) + '" aria-current="' + (h.id === t.id) + '">' +
          (h.foto ? '<img src="' + texto(h.foto) + '" alt="" referrerpolicy="no-referrer" onerror="this.outerHTML=\'' + texto(h.id.slice(-2)) + '\'">' : texto(h.id.slice(-2))) + '</button>';
      }).join('') + '</div></div>' : '') +
      '<dl class="ca-tecnico">' + filasFicha(t).map(function (x) { return '<dt>' + texto(x[0]) + '</dt><dd>' + texto(x[1]) + '</dd>'; }).join('') + '</dl>';
    f.hidden = false; $('ca-velo').hidden = false;
    f.querySelector('[data-cerrar]').focus();
  }
  function cerrar() { $('ca-ficha').hidden = true; $('ca-velo').hidden = true; }

  function entrar(error) {
    $('ca-barra').hidden = true;
    $('ca-principal').innerHTML = '<div class="ca-entrar">' + (error ? '<p class="ca-error">' + texto(error) + '</p>' : '') +
      '<p>Entra con tu cuenta de Google para ver el catálogo.</p><button class="ca-boton ca-principal-b" type="button" id="ca-entrar">Entrar con Google</button></div>';
    $('ca-entrar').onclick = function () {
      this.disabled = true;
      window.UG.entrar().then(cargar, function (e) { entrar(e.message); });
    };
  }

  function cargar() {
    $('ca-principal').innerHTML = '<p class="ca-nota">Cargando el catálogo…</p>';
    return window.UG.seccion(C.api, { fn: 'catalogoTelas', args: [] }, 'nucleo_' + (C.clave || 'telas')).then(function (r) {
      datos = { tecnicas: (r && r.tecnicas) || [], telas: (r && r.telas) || [] };
      $('ca-barra').hidden = !datos.telas.length;
      pintarFiltros(); pintar();
    }, function (e) {
      var m = String(e.message || '');
      if (/caducad|google/i.test(m)) return entrar(m);
      $('ca-barra').hidden = true;
      $('ca-principal').innerHTML = '<p class="ca-error">No se ha podido abrir el catálogo.</p><p class="ca-nota">' + texto(m) + '</p>';
    });
  }

  $('ca-filtros').addEventListener('click', function (e) { var b = e.target.closest('.ca-filtro'); if (!b) return; tecnica = b.getAttribute('data-t'); pintarFiltros(); pintar(); });
  $('ca-buscar').addEventListener('input', function (e) { buscado = e.target.value; pintar(); });
  $('ca-principal').addEventListener('click', function (e) { var b = e.target.closest('.ca-tarjeta'); if (b) abrir(b.getAttribute('data-id')); });
  $('ca-ficha').addEventListener('click', function (e) { if (e.target.closest('[data-cerrar]')) return cerrar(); var m = e.target.closest('.ca-muestra'); if (m) abrir(m.getAttribute('data-id')); });
  $('ca-velo').addEventListener('click', cerrar);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('ca-ficha').hidden) cerrar(); });

  if (window.UG && (window.UG.llave() || window.UG.tieneSesion())) cargar(); else entrar('');
})();
