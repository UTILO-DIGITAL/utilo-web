/*
 * Sección de ejemplo del núcleo · UTILO_CORE 5.0 (T0253) · motor/modulos/ejemplo de utilo-apps
 *
 * Solo para probar el contrato de una sección de punta a punta (docs/CONTRATO_SECCION.md de utilo-apps). Enseña las épicas
 * del DAILY (tabla EPICAS), agrupadas por la columna de su configuración (config.AGRUPAR), y deja cambiar qué entra en cada
 * una. Lee y escribe con las tablas al momento (ctx.tablas): la lista sale al momento de lo guardado en el dispositivo y el
 * cambio se ve al tocar «Guardar»; el Excel se escribe por detrás y, si falla, vuelve a como estaba y avisa.
 * El resumen de abajo viene de su función del motor (ctx.llamar('ejemploResumen')), para probar también esa parte.
 * T0382 · La tabla y sus columnas salen de su configuración (TABLA, TITULO, TEXTO, AGRUPAR y las palabras de TEXTOS): la misma
 * sección enseña ENTREGAS con un Sheet o con Supabase en npm run local (/_local/tablas). No sabe de dónde viene el dato.
 */
(function () {
  'use strict';

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  window.UN.registrar('EJEMPLO', {
    abrir: function (el, ctx) {
      var grupo = String(ctx.config.AGRUPAR || ''), TABLA = String(ctx.config.TABLA || 'EPICAS');
      var TIT = String(ctx.config.TITULO || 'EPICA'), TXT = String(ctx.config.TEXTO || 'QUE_ENTRA'), P = ctx.config.TEXTOS || {};
      el.innerHTML = (ctx.config.AYUDA ? '<p class="u-nota n-ayuda">' + texto(ctx.config.AYUDA) + '</p>' : '') +
        '<div id="ej-lista"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div>' +
        '<p class="u-nota" id="ej-resumen"></p>' +
        '<div class="u-velo" id="ej-velo"><div class="u-ventana" role="dialog" aria-modal="true" aria-labelledby="ej-titulo">' +
        '<div class="n-ventana"><h2 id="ej-titulo"></h2>' +
        '<label class="u-campo"><span class="u-etiqueta">' + texto(P.texto || 'Qué entra') + '</span><textarea id="ej-que" rows="5"></textarea></label>' +
        '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" id="ej-guardar">Guardar</button>' +
        '<button type="button" class="u-btn" id="ej-cancelar">Cancelar</button></div></div></div></div>';
      var lista = el.querySelector('#ej-lista'), velo = el.querySelector('#ej-velo'), editando = '';

      function pintar() {
        var filas = ctx.tablas.filas(TABLA); // en el orden del Excel, que es el que ha elegido el negocio
        if (!filas.length) { lista.innerHTML = '<p class="u-vacio">' + texto(P.vacio || 'Todavía no hay filas en ' + TABLA + '.') + '</p>'; return; }
        var grupos = {}, orden = [];
        filas.forEach(function (f) {
          var g = grupo ? String(f[grupo] || 'Sin ' + grupo.toLowerCase()) : '';
          if (!grupos[g]) { grupos[g] = []; orden.push(g); }
          grupos[g].push(f);
        });
        lista.innerHTML = orden.map(function (g) {
          return (g ? '<h2 class="n-grupo">' + texto(g) + ' <span class="u-cifra">' + grupos[g].length + '</span></h2>' : '') +
            '<table class="u-tabla n-tabla-2"><thead><tr><th>' + texto(P.titulo || TIT) + '</th><th>' + texto(P.texto || TXT) + '</th></tr></thead><tbody>' +
            grupos[g].map(function (f) {
              return '<tr tabindex="0" data-id="' + texto(f.ID) + '"><td class="u-tabla-t">' + texto(f[TIT]) + '<div class="u-nota">' + texto(f.ID) + '</div></td>' +
                '<td>' + (String(f[TXT] == null ? '' : f[TXT]).trim() ? texto(f[TXT]) : '<span class="u-tabla-s">Sin decir</span>') +
                (f._pendiente ? ' <span class="u-chip">Guardando</span>' : '') + '</td></tr>';
            }).join('') + '</tbody></table>';
        }).join('');
      }

      function editar(id) {
        var f = ctx.tablas.fila(TABLA, id);
        if (!f) return;
        editando = id;
        velo.querySelector('#ej-titulo').textContent = f[TIT];
        velo.querySelector('#ej-que').value = f[TXT] == null ? '' : f[TXT];
        velo.classList.add('abierto');
        velo.querySelector('#ej-que').focus();
      }
      function cerrar() { velo.classList.remove('abierto'); editando = ''; }

      lista.addEventListener('click', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr) editar(tr.getAttribute('data-id')); });
      lista.addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); editar(tr.getAttribute('data-id')); } });
      velo.querySelector('#ej-cancelar').onclick = cerrar;
      velo.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
      velo.querySelector('#ej-guardar').onclick = function () {
        var id = editando, v = velo.querySelector('#ej-que').value.trim();
        cerrar();
        // Al momento en la pantalla; el Excel (o Supabase), por detrás. Si dice que no, tablas.js lo deshace y avisa.
        var cambio = {}; cambio[TXT] = v;
        ctx.tablas.actualizar(TABLA, id, cambio).then(function () { if (ctx.abierta()) ctx.aviso(P.guardado || 'Guardado.'); }, function () {});
      };

      ctx.alCambiar(function (t) { if (t === TABLA) pintar(); });
      ctx.tablas.leer([TABLA]).then(pintar, function (e) {
        lista.innerHTML = '<p class="u-error">No se ha podido leer ' + texto(TABLA) + '.</p><p class="u-nota">' + texto(String(e.message).replace(/^\w+:\s*/, '')) + ' Vuelve a abrir la sección para probar otra vez.</p>';
      });
      ctx.llamar('ejemploResumen').then(function (r) {
        if (!ctx.abierta()) return;
        el.querySelector('#ej-resumen').textContent = 'Según el motor: ' + r.total + ' filas' + (r.sinQueEntra ? ', ' + r.sinQueEntra + ' sin «' + (P.texto || TXT).toLowerCase() + '».' : '.');
      }, function () {});
    }
  });
})();
