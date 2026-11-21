/*
 * Catálogo para marcas · Telas (T0686) · clientes/telas/modulos/catalogo de utilo-apps
 *
 * El botón al final de Perfil (sección «enPerfil») que lleva a la página del catálogo (telas/catalogo/), la que Marta
 * enseña a una marca. El catálogo va aparte de la app a propósito: sin menú y sin nada
 * confidencial. Aquí solo se explica qué es y se abre en otra pestaña.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.UN) return;
  window.UN.registrar('CATALOGO', {
    abrir: function (el) {
      // La página está junto a la app (telas/index.html → telas/catalogo/), también en DEV y en local.
      var url = new URL('catalogo/', location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '')).href;
      el.innerHTML = '<p class="u-nota n-ayuda">Tus telas para enseñar a una marca: foto, composición, ancho y peso. Sin costes, proveedores, precios ni otras marcas, y sin el menú de la app.</p>' +
        '<p><a class="u-btn" href="' + url + '" target="_blank" rel="noopener">Abrir el catálogo</a></p>' +
        '<p class="u-nota">Para tenerlo a mano en una reunión, ábrelo en el móvil o la tablet y guárdalo en la pantalla de inicio.</p>';
    },
    cerrar: function () {}
  });
})();
