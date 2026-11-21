      velo.addEventListener('click', function (ev) {
        if (ev.target === velo || ev.target.closest('[data-cerrar]')) { cerrarVentana(); return; }
        if (ev.target.closest('[data-volver]')) { velo.classList.remove('abierto'); partir(null); fichaVent = ''; ctx.volver(); return; }
        // T0642: al saltar de esta ficha a otra (lo relacionado, «+ Nueva tarea»), la dirección de ahora se queda con la ficha
        // abierta, para que «Volver» o el atrás del móvil la vuelvan a abrir, y la siguiente dice «‹ Volver a <esta>».
        var sx = ev.target.closest('a[data-sx]');
        if (sx && abierta && !(ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button)) {
          var h2 = vent.querySelector('#li-vt'), nom = '';
          if (h2) { var cp2 = h2.cloneNode(true); [].forEach.call(cp2.querySelectorAll(QUITAR_DE_VUELTA), function (x) { x.parentNode.removeChild(x); }); nom = cp2.textContent.replace(/\s+/g, ' ').trim(); }
          try { history.replaceState(history.state, '', location.pathname + conFicha(location.search, abierta.id, editables(BASE)) + location.hash); } catch (e) {}
          // T0692: a Pedidos (otra sección, no un Listado) no se le dice: lo recogería esta ficha al volver («‹ Volver a» sí misma).
          if (!(venSec && String(sx.getAttribute('data-sx')).toUpperCase() === venSec)) vueltaPendiente = nom;
          return; // el marco hace el salto
        }
        if (ev.target.closest('[data-claude]')) { copiarClaude(); return; }
        // T0690: «Ver todo» de lo relacionado (el seguimiento de un cliente): salen las que estaban escondidas.
        var vt = ev.target.closest('[data-ver-todo]');
        if (vt) { var sc = vt.closest('.li-fgrupo'); [].forEach.call(sc.querySelectorAll('[data-resto]'), function (x) { x.hidden = false; }); vt.remove(); return; }
        // T0652: una tarea del resumen de la ficha abre la suya.
        var cf = ev.target.closest('[data-ctx-fila]');
        if (cf) { var idf = cf.getAttribute('data-ctx-fila'); cerrarVentana(true); ficha(idf); return; }
        // T0643: cerrar o pasar desde la ficha (se cierra la ficha y se hace como en la lista).
        var rh = ev.target.closest('[data-r-hecha],[data-r-pasar]');
        if (rh && abierta) {
          var idr = abierta.id; cerrarVentana();
          if (rh.hasAttribute('data-r-hecha')) marcarHecha(idr); else pasar(idr, rh.getAttribute('data-r-pasar'));
          return;
        }
        // T0630: un campo vacío de la ficha se abre al tocar su nombre en «Sin rellenar».
        var rl = ev.target.closest('[data-rellenar]');
        if (rl) {
          var c = rl.getAttribute('data-rellenar'), hu = [].filter.call(vent.querySelectorAll('[data-hueco]'), function (x) { return x.getAttribute('data-hueco') === c; })[0];
          if (!hu) return;
          var linea = rl.parentNode;
          hu.hidden = false;
          rl.remove();
          if (!linea.querySelector('.li-rellenar,.li-vacio')) linea.remove();
          var i = hu.querySelector('input,select,textarea'); if (i) i.focus();
          return;
        }
        // Personalizar: subir y bajar una sección del menú o una vista.
        var b = ev.target.closest('[data-sube],[data-baja]');
        if (b) {
          var li = b.closest('li'), ul = li.parentNode;
          if (b.hasAttribute('data-sube') && li.previousElementSibling) ul.insertBefore(li, li.previousElementSibling);
          else if (b.hasAttribute('data-baja') && li.nextElementSibling) ul.insertBefore(li.nextElementSibling, li);
          [].forEach.call(ul.children, function (x, i) { x.querySelector('[data-sube]').disabled = i === 0; x.querySelector('[data-baja]').disabled = i === ul.children.length - 1; });
          b.focus();
          return;
        }
        // Un enlace a otra sección (lo relacionado): el marco lo abre; aquí solo se cierra la ventana.
        if (ev.target.closest('a[data-sx]')) { velo.classList.remove('abierto'); partir(null); }
      });
      // T0652: el resumen. Una tarea de la lista abre su ficha; «Abrir en Clientes», la otra sección (la abre el marco).
      pCtx.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-ctx-cerrar]')) { cerrarCtx(); return; }
        var e = ev.target.closest('[data-ctx-fila]');
        if (e) { cerrarCtx(true); ficha(e.getAttribute('data-ctx-fila')); return; }
        if (ev.target.closest('a[data-sx]')) cerrarCtx(true);
      });
      // Tocar fuera del resumen solo lo cierra (no abre lo que había debajo); fuera de la sección (el menú), lo cierra y sigue.
      alTocarFuera = function (ev) {
        if (!S.ctx || pCtx.contains(ev.target) || (ev.target.closest && ev.target.closest('[data-ctx]'))) return;
        var dentro = el.contains(ev.target);
        cerrarCtx(!dentro);
        if (dentro) { ev.stopPropagation(); ev.preventDefault(); }
      };
      document.addEventListener('click', alTocarFuera, true);
      teclaEsc = function (ev) {
        if (ev.key !== 'Escape' || !ctx.abierta()) return;
        if (velo.classList.contains('abierto')) { if (escDato && escDato()) return; cerrarVentana(); return; }
        if (S.ctx) { cerrarCtx(); return; }
        if (S.menu) { var b = S.menu; S.menu = ''; pintar(); var bb = cont.querySelector('[data-pasar-menu="' + b.replace(/"/g, '') + '"]'); if (bb && bb.offsetParent) bb.focus(); }
      };
      document.addEventListener('keydown', teclaEsc);
      // T0643: el menú de «Pasar» va fijo junto a su botón: al desplazar, se cierra (no se queda flotando en otro sitio).
      alDesplazar = function () { if (S.menu) { S.menu = ''; pintar(); } };
      window.addEventListener('scroll', alDesplazar, true);
      avDes.querySelector('[data-deshacer]').addEventListener('click', function () {
        var d = avDes._deshacer; sinDeshacer();
        if (d) deshacerYDecir(d);
      });

      ctx.alCambiar(function (t, info) {
        // T0724 (R16): una tabla de la sección que llega del motor trae sus columnas de ahora: la configuración se vuelve a comprobar.
        if (info && info.refresco && tablas.indexOf(t) >= 0) errores = null;
        if (t === PREF && window.UN.ordenMenu) { var m = prefDe(MENU); if (Array.isArray(m)) window.UN.ordenMenu(m); }
        if (tablas.indexOf(t) >= 0) pintar();
      });
      T.leer(tablas).then(function () {
        S.leido = true;
        // El orden del menú que ha guardado quien personaliza (para todos), por si este dispositivo aún no lo tiene.
        if (PREF && window.UN.ordenMenu) { var m = prefDe(MENU); if (Array.isArray(m)) window.UN.ordenMenu(m); }
        pintar();
        leerVentas(); // T0692
        // T0644: desde el Perfil («Personalizar»), ?personalizar=1 abre aquí su ventana.
        if (url.get('personalizar') && puedePersonalizar) personalizar();
        else if (pedida) {
          // T0688: si la fila pedida no está en la vista que se ve, la de su vista (sin recordarla: la próxima vez, la de siempre).
          var aP = ap(), fP = filaVista(aP, pedida), vP = fP ? vistaDeFila(aP, fP, vistaActual(aP).id, hoyIso()) : '';
          if (vP && vP !== vistaActual(aP).id) { S.vista = vP; pintar(); }
          ficha(pedida);
        }
        else if (url.get('nueva') && BASE.crear) {
          // T0642: «+ Nueva tarea» desde la ficha de una marca: ?nueva=1&ID_MARCA=M-001 (solo columnas que se editan).
          var puesto = {}, edn = editables(ap());
          url.forEach(function (v, k) { if (edn.indexOf(k) >= 0 && v) puesto[k] = v; });
          ficha(null, true, puesto);
        }
      }, function (e) {
        cont.innerHTML = '<p class="u-error">No se han podido leer los datos: ' + texto((e && e.message) || e) + '</p>';
      });
    },
    cerrar: function () {
      atrasDe = null;
      document.body.classList.remove('li-partida');
      if (teclaEsc) document.removeEventListener('keydown', teclaEsc); teclaEsc = null;
      if (alMover) document.removeEventListener('pointermove', alMover);
      if (alSoltar) document.removeEventListener('pointerup', alSoltar);
      if (alCancelar) document.removeEventListener('pointercancel', alCancelar);
      if (alDesplazar) window.removeEventListener('scroll', alDesplazar, true);
      if (alTocarFuera) document.removeEventListener('click', alTocarFuera, true);
      alMover = alSoltar = alCancelar = alDesplazar = alTocarFuera = null;
    }
  });
})();
