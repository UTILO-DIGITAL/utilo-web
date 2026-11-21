      /* ---------- eventos ---------- */
      // T0746: Sí | No en la ficha (y en lo de dentro): el botón pone su valor en el desplegable escondido, que guarda como
      // siempre; tocar el que ya está elegido lo deja vacío.
      vent.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-dos-v]'), sel = b && b.parentNode.parentNode.querySelector('select[data-dos]');
        if (!sel) return;
        sel.value = b.getAttribute('aria-pressed') === 'true' ? '' : b.getAttribute('data-dos-v');
        pintarDos(sel);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
      cont.addEventListener('click', function (ev) {
        // T0724 (R44): un enlace de la tabla (la web, el correo) se abre él, sin abrir la ficha de su fila.
        if (ev.target.closest('a.li-enl')) return;
        // T0710: un botón de lo de arriba (Voy / No voy): cambia esa fila de su tabla y lo dice; deja de salir sola.
        var ab = ev.target.closest('[data-arriba]');
        if (ab) {
          var xa = ap().arriba[+ab.getAttribute('data-arriba')], bb = xa && xa.botones[+ab.getAttribute('data-arriba-b')], ida = ab.getAttribute('data-arriba-id');
          if (!bb) return;
          var fa = filaDe(xa.tabla, ida) || {}, nom = xa.titulo.map(function (c) { return fa[c]; }).filter(Boolean)[0] || ida;
          ab.disabled = true;
          Promise.resolve(T.actualizar(xa.tabla, ida, bb.poner)).then(function () {
            ctx.aviso(String(bb.hecho || 'Apuntado.').replace(/\{nombre\}/g, nom)); pintar();
          }, function (e) { ab.disabled = false; ctx.aviso('No se ha apuntado: ' + ((e && e.message) || e)); });
          return;
        }
        var rp = ev.target.closest('[data-rapido]');
        if (rp) { // T0679: el filtro rápido de encima de la lista
          var c = rp.getAttribute('data-rapido'), v = rp.getAttribute('data-v');
          if (v && rp.getAttribute('aria-pressed') !== 'true') S.filtros[c] = v === '!' ? { vacio: true } : { es: v }; else delete S.filtros[c];
          pintar(); return;
        }
        // T0643: el círculo, «Pasar» y su menú. Con el menú abierto, tocar fuera solo lo cierra.
        var r = ev.target.closest('[data-hecha],[data-pasar-menu],[data-pasar-a],[data-pasar-otro]');
        if (r) {
          var abierto = S.menu; S.menu = '';
          if (r.hasAttribute('data-hecha')) { pintar(); marcarHecha(r.getAttribute('data-hecha')); return; }
          if (r.hasAttribute('data-pasar-menu')) { var pm = r.getAttribute('data-pasar-menu'); S.menu = abierto === pm ? '' : pm; pintar(); var p1 = cont.querySelector('.li-menu [role=menuitem]'); if (p1) p1.focus(); return; }
          if (r.hasAttribute('data-pasar-a')) { pintar(); pasar(r.getAttribute('data-fila'), r.getAttribute('data-pasar-a')); return; }
          pintar(); pasarOtroDia(r.getAttribute('data-pasar-otro')); return;
        }
        if (S.menu && !ev.target.closest('.li-menu')) { S.menu = ''; pintar(); return; }
        // T0652: el nombre de con quién es abre su resumen (otra vez, lo cierra).
        var bx = ev.target.closest('[data-ctx]');
        if (bx) { var ix = bx.getAttribute('data-ctx'); if (S.ctx === ix) cerrarCtx(); else abrirCtx(ix); return; }
        // T0742: «Ver más» al final de la lista: lo antiguo de su tabla (nucleo.partes), una vez.
        var ba = ev.target.closest('[data-antiguo]');
        if (ba) {
          if (S.antiguo) return;
          S.antiguo = true; pintar();
          T.leerAntiguo(ap().tabla).then(function () { S.antiguo = false; pintar(); }, function (e) {
            S.antiguo = false; pintar();
            ctx.aviso('No se ha podido traer lo de antes: ' + ((e && e.message) || e));
          });
          return;
        }
        // T0690: ordenar por una columna (se recuerda por vista en este dispositivo), «Ver más», lo hecho y lo de antes.
        var lg = ev.target.closest('[data-orden],[data-mas],[data-plegar],[data-antes]');
        if (lg) {
          if (lg.hasAttribute('data-orden')) { var vo = vistaActual(ap()).id; guardado(K + 'orden_' + vo, siguienteOrden(ap(), guardado(K + 'orden_' + vo), lg.getAttribute('data-orden'))); }
          else if (lg.hasAttribute('data-mas')) { var km = lg.getAttribute('data-mas'), pm = +lg.getAttribute('data-paso') || POR_GRUPO; S.mas[km] = (S.mas[km] || pm) + pm; }
          else if (lg.hasAttribute('data-plegar')) { var kp = lg.getAttribute('data-plegar'); S.abre[kp] = !S.abre[kp]; }
          else S.antes[lg.getAttribute('data-antes')] = true;
          var sel = lg.hasAttribute('data-orden') ? '[data-orden="' + lg.getAttribute('data-orden') + '"]' : (lg.hasAttribute('data-plegar') ? '[data-plegar="' + lg.getAttribute('data-plegar') + '"]' : '');
          pintar();
          // El foco no se pierde: vuelve al mismo botón (ordenar, plegar), el que se ve (la tabla o las tarjetas).
          var vuelta = sel ? [].filter.call(cont.querySelectorAll(sel), function (x) { return x.offsetParent !== null; })[0] : null;
          if (vuelta) vuelta.focus();
          return;
        }
        // T0689: Mías / Todas (se recuerda para esta persona en este dispositivo).
        var bm = ev.target.closest('[data-mias]');
        if (bm) { S.mias = bm.getAttribute('data-mias') === 'todas' ? 'todas' : 'mias'; guardado(KM, S.mias); pintar(); var bv = cont.querySelector('[data-mias="' + S.mias + '"]'); if (bv) bv.focus(); return; }
        var t = ev.target.closest('[data-vista],[data-aviso],[data-id],[data-pers],[data-qes],[data-nueva],[data-filtrar],[data-quitar]');
        if (!t) return;
        if (t.hasAttribute('data-filtrar')) { panelFiltros(); return; }
        if (t.hasAttribute('data-quitar')) {
          var qc = t.getAttribute('data-quitar');
          if (qc) delete S.filtros[qc]; else S.filtros = {};
          pintar();
          // El foco no se pierde: a la siguiente etiqueta o, si ya no queda ninguna, al botón Filtrar.
          var sig = cont.querySelector('.li-fchip') || cont.querySelector('[data-filtrar]'); if (sig) sig.focus();
          return;
        }
        if (t.hasAttribute('data-vista')) { S.vista = t.getAttribute('data-vista'); S.aviso = ''; S.mas = {}; S.abre = {}; S.antes = {}; guardado(K + 'vista', S.vista); pintar(); return; }
        if (t.hasAttribute('data-aviso')) { var x = t.getAttribute('data-aviso'); S.aviso = S.aviso === x ? '' : x; pintar(); return; }
        if (t.hasAttribute('data-pers')) { personalizar(); return; }
        if (t.hasAttribute('data-qes')) { S.qes = !S.qes; pintar(); return; }
        if (t.hasAttribute('data-nueva')) { ficha(null, true); return; }
        ficha(t.getAttribute('data-id'));
      });
      cont.addEventListener('keydown', function (ev) {
        if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('tr[data-id]')) { ev.preventDefault(); ficha(ev.target.getAttribute('data-id')); }
      });
      cont.addEventListener('input', function (ev) { if (ev.target.id === 'li-q') { S.q = ev.target.value; pintar(); } });
