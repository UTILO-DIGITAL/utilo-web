      /* ---------- personalizar ---------- */
      function guardarPref(clave, valor, otraVez) {
        var txt = JSON.stringify(valor);
        guardado('li_pref_' + clave, txt);
        if (!PREF) { if (otraVez) otraVez(); return Promise.resolve('en este dispositivo'); }
        var hay = filaDe(PREF, clave);
        var p = hay ? T.actualizar(PREF, clave, { VALOR: txt }) : T.crear(PREF, { ID: clave, VALOR: txt });
        if (otraVez) otraVez();
        return Promise.resolve(p).then(function () { return 'para todos'; });
      }
      /** Las secciones del menú, en el orden de ahora (sin Perfil ni las de dentro de Perfil). */
      function delMenu() {
        var ss = (ctx.secciones || []).filter(function (s) { return !s.enPerfil && s.id !== 'PERFIL'; });
        // ctx.secciones es el orden de cuando se abrió la sección: el de ahora es el que guarda el marco.
        var o = window.UN.ordenMenu ? window.UN.ordenMenu() || [] : [];
        return o.length ? ss.filter(function (s) { return o.indexOf(s.id) >= 0; }).sort(function (x, y) { return o.indexOf(x.id) - o.indexOf(y.id); }).concat(ss.filter(function (s) { return o.indexOf(s.id) < 0; })) : ss;
      }
      function personalizar() {
        var base = BASE, p = prefDe(ctx.id) || {}, conPref = ap();
        var ordenV = (base.vistas || []).slice().sort(function (x, y) { var o = lista(p.vistas); var ia = o.indexOf(x.id), ib = o.indexOf(y.id); return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib); });
        var fuera = ocultasDe(base, p), menu = delMenu();
        function fila(id, tit, extra, i, n, grupo) {
          return '<li class="li-p-fila" data-g="' + grupo + '" data-id="' + texto(id) + '">' + extra + '<span class="li-p-t">' + texto(tit) + '</span>' +
            '<button type="button" class="u-btn u-btn-icono" data-sube aria-label="Subir ' + texto(tit) + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button type="button" class="u-btn u-btn-icono" data-baja aria-label="Bajar ' + texto(tit) + '"' + (i === n - 1 ? ' disabled' : '') + '>↓</button></li>';
        }
        var h = '<div class="li-ficha-cab"><h2 id="li-vt">Personalizar</h2><button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Cerrar">' + ICONO_X + '</button></div>' +
          '<p class="u-nota">' + (PREF ? 'Vale para todos los que usan la app.' : 'Se guarda en este dispositivo.') + '</p>';
        if (menu.length > 1 && window.UN.ordenMenu) h += '<section class="li-fgrupo"><h3 class="li-fg-t">Orden del menú</h3><ul class="li-p-lista">' +
          menu.map(function (s, i) { return fila(s.id, s.titulo, '', i, menu.length, 'menu'); }).join('') + '</ul></section>';
        if (ordenV.length > 1) h += '<section class="li-fgrupo"><h3 class="li-fg-t">Vistas de ' + texto(ctx.titulo) + '</h3><p class="u-nota">La primera se abre al entrar. Quita las que no uses.</p><ul class="li-p-lista">' +
          ordenV.map(function (v, i) { return fila(v.id, v.titulo, '<input type="checkbox" data-ver aria-label="Ver ' + texto(v.titulo) + '"' + (fuera.indexOf(v.id) < 0 ? ' checked' : '') + '>', i, ordenV.length, 'vi'); }).join('') + '</ul></section>';
        if ((conPref.avisos || []).length) h += '<section class="li-fgrupo"><h3 class="li-fg-t">Avisos de ' + texto(ctx.titulo) + '</h3><ul class="li-p-lista">' +
          conPref.avisos.map(function (x) {
            var usaDias = JSON.stringify(x.si || []).indexOf('dias"') >= 0;
            return '<li class="li-p-fila" data-g="av" data-id="' + texto(x.id) + '"><input type="checkbox" data-on aria-label="Avisar: ' + texto(x.titulo) + '"' + (x.activo !== false ? ' checked' : '') + '>' +
              '<span class="li-p-t">' + texto(x.titulo) + (x.texto ? '<small class="u-nota">' + texto(x.texto) + '</small>' : '') + '</span>' +
              (usaDias ? '<label class="li-p-dias">con <input type="number" min="0" max="365" inputmode="numeric" data-dias value="' + (x.dias === undefined ? 7 : x.dias) + '"> días</label>' : '') + '</li>';
          }).join('') + '</ul></section>';
        h += '<div class="n-botones"><button type="button" class="u-btn u-btn-accion" data-guardar>Guardar</button><button type="button" class="u-btn u-btn-texto" data-defecto>Volver a como venía</button></div>';
        abrirVentana(h);
        var fin = function (donde) { ctx.aviso('Guardado ' + donde + '.'); }, mal = function (e) { ctx.aviso('No se ha guardado: ' + ((e && e.message) || e)); };
        vent.querySelector('[data-defecto]').addEventListener('click', function () {
          cerrarVentana();
          if (window.UN.ordenMenu) window.UN.ordenMenu([]);
          Promise.all([guardarPref(ctx.id, {}, pintar), menu.length > 1 ? guardarPref(MENU, []) : null]).then(function (r) { fin(r[0]); }, mal);
        });
        vent.querySelector('[data-guardar]').addEventListener('click', function () {
          var n = { vistas: [], ocultas: [], avisos: {} };
          var vis = vent.querySelectorAll('[data-g=vi]');
          if (vis.length) {
            n.vistas = [].map.call(vis, function (li) { return li.getAttribute('data-id'); });
            n.ocultas = [].filter.call(vis, function (li) { return !li.querySelector('[data-ver]').checked; }).map(function (li) { return li.getAttribute('data-id'); });
            if (n.ocultas.length === n.vistas.length) { ctx.aviso('Deja al menos una vista.'); return; }
          }
          [].forEach.call(vent.querySelectorAll('[data-g=av]'), function (li) {
            var d = li.querySelector('[data-dias]'), o = { activo: li.querySelector('[data-on]').checked };
            if (d && d.value !== '' && isFinite(+d.value)) o.dias = Math.max(0, Math.min(365, Math.round(+d.value)));
            n.avisos[li.getAttribute('data-id')] = o;
          });
          var orden = [].map.call(vent.querySelectorAll('[data-g=menu]'), function (li) { return li.getAttribute('data-id'); });
          cerrarVentana();
          var ps = [guardarPref(ctx.id, n, pintar)];
          if (orden.length && JSON.stringify(orden) !== JSON.stringify(menu.map(function (s) { return s.id; }))) { ps.push(guardarPref(MENU, orden)); window.UN.ordenMenu(orden); }
          Promise.all(ps).then(function (r) { fin(r[0]); }, mal);
        });
      }

