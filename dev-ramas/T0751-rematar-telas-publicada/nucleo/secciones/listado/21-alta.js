      function mezclar(x, y) { var r = {}; [x, y].forEach(function (o) { Object.keys(o || {}).forEach(function (k) { if (k !== '__crudo') r[k] = o[k]; }); }); return r; }
      /** T0643 · Un campo del alta: «con quién» (un «primero» de varias columnas) es una sola lista agrupada por cada una; una
       *  fecha lleva sus días de un toque (hoy, mañana, una semana, sin fecha); lo que se pone solo, su nota. */
      function opcionesUno(gs, sel) {
        return '<option value="">Nadie en concreto</option>' + gs.map(function (g) {
          return '<optgroup label="' + texto(g.titulo) + '">' + g.opciones.map(function (o) {
            var v = g.col + '|' + o.valor;
            return '<option value="' + texto(v) + '"' + (v === sel ? ' selected' : '') + '>' + texto(o.nombre) + '</option>';
          }).join('') + '</optgroup>';
        }).join('');
      }
      /**
       * T0714 · El campo de ALTA.nuevo en el alta (el diseño de una tela): «Uno que ya tengo» (su desplegable) o «Diseño nuevo»
       * (lo de ALTA.nuevo.campos, con data-nc: no va a esta fila, va a la nueva de su tabla; y, si no se saben, las letras
       * de su código). Se cambia con los dos botones; de entrada, el que ya tiene si hay alguno.
       */
      function altaConNuevo(a, c, crudo, ed, hoy) {
        var nv = a.alta.nuevo, cp = campo(a, c), hay = cp.ids && Object.keys(cp.ids).length > 0, nuevoYa = !hay;
        var bot = function (k, t) { return '<button type="button" class="li-dia" data-nuevo-modo="' + k + '" aria-pressed="' + ((k === 'nuevo') === nuevoYa) + '">' + texto(t) + '</button>'; };
        // Con su unidad en la etiqueta («Ancho (cm)»): aquí no hay un valor al lado que la diga.
        var nc = function (r) { var u = campo(a, r).unidad; return entrada(a, r, {}).replace(/(id|for)="li-c-/g, '$1="li-n-').replace(/ data-c="/g, ' data-nc="').replace(/(<label class="u-etiqueta"[^>]*>)([^<]*)</, function (m, l, t) { return l + t + (u ? ' (' + texto(u) + ')' : '') + '<'; }); };
        return '<div class="u-campo u-ancho li-nuevo" data-nuevo="' + texto(c) + '"><span class="u-etiqueta">' + texto(cp.titulo) + '</span>' +
          (hay ? '<div class="li-dias" role="group" aria-label="' + texto(cp.titulo) + '">' + bot('ya', nv.ya) + bot('nuevo', nv.titulo) + '</div>' : '') +
          '<div data-nuevo-ya' + (nuevoYa ? ' hidden' : '') + '>' + entradaAlta(a, c, crudo, ed, hoy).replace('<label class="u-etiqueta"', '<label class="u-etiqueta u-oculto"') + '</div>' +
          '<div class="u-campos" data-nuevo-bloque' + (nuevoYa ? '' : ' hidden') + '>' + nv.campos.map(nc).join('') +
            '<div class="u-campo" data-nuevo-letras hidden><label class="u-etiqueta" for="li-n-letras">' + texto(nv.codigo.titulo) + '</label><input id="li-n-letras" type="text" autocomplete="off" autocapitalize="characters" maxlength="5" data-letras placeholder="JAQ"><span class="u-nota">Es la primera de esa técnica: escribe las letras de su código.</span></div>' +
          '</div></div>';
      }
      /** T0714 · ¿El alta está con «Diseño nuevo»? */
      function enNuevo(form) { var b = form && form.querySelector('[data-nuevo-bloque]'); return !!b && !b.hidden; }
      /** T0714 · Lo escrito para la fila nueva de ALTA.nuevo, por columna de su tabla (sin la ruta), sin lo vacío. */
      function valoresNuevo(a, form) {
        var v = {}, pre = a.alta.nuevo.campo + '.';
        [].forEach.call(form.querySelectorAll('[data-nc]'), function (i) {
          var r = i.getAttribute('data-nc'), x = i.value.trim(), cp = campo(a, r);
          if (x !== '') v[r.slice(pre.length)] = deEscrito(cp, x);
        });
        return v;
      }
      function entradaAlta(a, c, crudo, ed, hoy) {
        var cp = campo(a, c), id = 'li-c-' + c;
        if (cp.primero) {
          // T0677: agrupada (Marcas, Proveedores, Otros), por orden alfabético y, si es larga, con un buscador encima.
          var gs = gruposConQuien(a, c, ed), n = gs.reduce(function (k, g) { return k + g.opciones.length; }, 0), sel = '';
          gs.forEach(function (g) { if (!vacio(crudo[g.col])) sel = g.col + '|' + crudo[g.col]; });
          return '<div class="u-campo u-ancho"><label class="u-etiqueta" for="' + id + '">' + texto(cp.titulo) + '</label>' +
            (n > 12 && !(typeof window !== 'undefined' && window.UElegir) ? '<input type="search" class="li-cq-buscar" data-buscar-uno="' + texto(c) + '" placeholder="Busca por el nombre" aria-label="Buscar en ' + texto(cp.titulo.toLowerCase()) + '" autocomplete="off">' : '') +
            '<select id="' + id + '" data-uno="' + texto(c) + '" data-elegir="con-quien">' + opcionesUno(gs, sel) + '</select></div>';
        }
        var h = entrada(a, c, crudo), fin = h.lastIndexOf('</div>');
        if (cp.tipo === 'fecha') {
          var v = String(crudo[c] || ''), ds = [{ fecha: hoy, titulo: 'Hoy' }].concat(opcionesPasar(hoy)).concat([{ fecha: '', titulo: 'Sin fecha' }]);
          return h.slice(0, fin) + '<div class="li-dias" data-col-dias="' + texto(c) + '" role="group" aria-label="' + texto(cp.titulo) + ' en un toque">' + ds.map(function (o) {
            return '<button type="button" class="li-dia" data-col="' + texto(c) + '" data-poner-fecha="' + o.fecha + '" aria-pressed="' + (v === o.fecha) + '">' + texto(o.titulo) + '</button>';
          }).join('') + '</div>' + h.slice(fin);
        }
        if (c in a.deducir) return h.slice(0, fin) + '<span class="u-nota" data-deducido="' + texto(c) + '"></span>' + h.slice(fin);
        return h;
      }
      function copiarClaude() {
        var a = ap(), f = abierta && filaVista(a, abierta.id);
        if (!f) return;
        var t = paraClaude(a, f, VAL, PROHIB, '');
        var hecho = function () { ctx.aviso('Copiado: pégalo en Claude al empezar la sesión.'); };
        var aMano = function () {
          var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
          document.body.removeChild(ta);
          if (ok) hecho(); else ctx.aviso('No se ha podido copiar: selecciona el texto de la ficha y cópialo.');
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(hecho, aMano); else aMano();
      }

