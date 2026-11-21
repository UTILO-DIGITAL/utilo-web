      /* ---------- T0625 · Filtrar ----------
       * Un campo por cada columna que se puede filtrar en la vista: una lista, «de … a …» o «desde … hasta …» (fechas). El
       * botón dice cuántas filas quedan mientras se elige; nada cambia en la lista hasta que se pulsa. */
      function panelFiltros() {
        var a = ap(), vista = vistaActual(a), hoy = hoyIso(), todas = vistas(a);
        var disp = filtrables(a, vista, filtrar(a, vista, todas, { hoy: hoy }), VAL), F = S.filtros;
        var h = '<div class="li-ficha-cab"><h2 id="li-vt">Filtrar · ' + texto(a.titulo || '') + '</h2><button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Cerrar">' + ICONO_X + '</button></div>' +
          '<form id="li-ff" class="li-form" novalidate><div class="u-campos">' + disp.map(function (d, i) {
            var x = F[d.campo] || {}, id = 'li-f' + i, et = function (para) { return '<label class="u-etiqueta" for="' + para + '">' + texto(d.titulo) + '</label>'; };
            if (d.tipo === 'lista' && d.opciones.length + (d.vacios ? 1 : 0) <= 6) { // T0679: hasta 6, pastillas; con más (con quién, ciudad), un desplegable
              // T0679: pocas opciones, en pastillas que se tocan (una a la vez; tocar la elegida la quita). Lo elegido va en el oculto.
              var val = x.vacio ? '!' : (x.es !== undefined ? '=' + (d.opciones.filter(function (o) { return norm(o) === norm(x.es); })[0] || x.es) : '');
              var pil = function (v, t) { return '<button type="button" class="li-fop" data-fop="' + texto(v) + '" aria-pressed="' + (val === v) + '">' + texto(t) + '</button>'; };
              return '<fieldset class="u-campo u-ancho li-fops"><legend class="u-etiqueta">' + texto(d.titulo) + '</legend><input type="hidden" id="' + id + '" data-f="' + texto(d.campo) + '" value="' + texto(val) + '">' +
                '<div>' + d.opciones.map(function (o) { return pil('=' + o, mostrar(d.cp, o)); }).join('') + (d.vacios ? pil('!', 'Sin ' + d.titulo.toLowerCase()) : '') + '</div></fieldset>';
            }
            if (d.tipo === 'lista') {
              return '<div class="u-campo u-ancho">' + et(id) + '<select class="li-fsel" id="' + id + '" data-f="' + texto(d.campo) + '" data-elegir="filtro-' + texto(d.campo) + '"><option value="">Cualquiera</option>' +
                d.opciones.map(function (o) { return '<option value="=' + texto(o) + '"' + (x.es !== undefined && norm(x.es) === norm(o) ? ' selected' : '') + '>' + texto(mostrar(d.cp, o)) + '</option>'; }).join('') +
                (d.vacios ? '<option value="!"' + (x.vacio ? ' selected' : '') + '>Sin ' + texto(d.titulo.toLowerCase()) + '</option>' : '') + '</select></div>';
            }
            var fecha = d.tipo === 'fecha', t = fecha ? 'date' : 'text', k1 = fecha ? 'desde' : 'min', k2 = fecha ? 'hasta' : 'max';
            var v1 = x[k1] === undefined ? '' : (fecha ? x[k1] : String(x[k1]).replace('.', ',')), v2 = x[k2] === undefined ? '' : (fecha ? x[k2] : String(x[k2]).replace('.', ','));
            var extra = fecha ? '' : ' inputmode="decimal" autocomplete="off"', u = d.unidad ? '<span class="u-nota">' + texto(d.unidad) + '</span>' : '';
            return '<fieldset class="u-campo li-rango"><legend class="u-etiqueta">' + texto(d.titulo) + '</legend><div class="li-rango-c">' +
              '<label class="u-oculto" for="' + id + 'a">' + texto(d.titulo) + (fecha ? ' desde' : ' desde (mínimo)') + '</label><span class="u-nota">' + (fecha ? 'Desde' : 'De') + '</span>' +
              '<input id="' + id + 'a" type="' + t + '"' + extra + ' data-f="' + texto(d.campo) + '" data-k="' + k1 + '" value="' + texto(v1) + '">' +
              '<label class="u-oculto" for="' + id + 'b">' + texto(d.titulo) + (fecha ? ' hasta' : ' hasta (máximo)') + '</label><span class="u-nota">' + (fecha ? 'hasta' : 'a') + '</span>' +
              '<input id="' + id + 'b" type="' + t + '"' + extra + ' data-f="' + texto(d.campo) + '" data-k="' + k2 + '" value="' + texto(v2) + '">' + u + '</div></fieldset>';
          }).join('') + '</div><p class="u-error" id="li-ferr" role="alert" hidden></p>' +
          '<div class="n-botones li-ff-pie"><button type="submit" class="u-btn u-btn-accion" data-ver></button><button type="button" class="u-btn u-btn-texto" data-fquitar>Quitar filtros</button></div></form>';
        abrirVentana(h, true);
        var form = vent.querySelector('#li-ff'), boton = form.querySelector('[data-ver]'), err = vent.querySelector('#li-ferr');
        form.addEventListener('click', function (ev) {
          var b = ev.target.closest('[data-fop]'); if (!b) return;
          var g = b.closest('.li-fops'), inp = g.querySelector('[data-f]'), v = b.getAttribute('data-fop'), quita = b.getAttribute('aria-pressed') === 'true';
          inp.value = quita ? '' : v;
          [].forEach.call(g.querySelectorAll('[data-fop]'), function (x) { x.setAttribute('aria-pressed', String(!quita && x === b)); });
          contar();
        });
        /** Lo elegido en el panel: { filtros } o { error } (un número que no lo es). */
        function leer() {
          var r = {}, mal = '';
          [].forEach.call(form.querySelectorAll('[data-f]'), function (i) {
            var c = i.getAttribute('data-f'), k = i.getAttribute('data-k'), v = i.value.trim();
            i.removeAttribute('aria-invalid');
            if (!v) return;
            if (!k) { r[c] = v === '!' ? { vacio: true } : { es: v.slice(1) }; return; }
            if (k === 'min' || k === 'max') {
              var n = aNumero(v);
              if (isNaN(n)) { i.setAttribute('aria-invalid', 'true'); mal = mal || 'Escribe solo un número en ' + campo(a, c).titulo.toLowerCase() + '.'; return; }
              v = /%$/.test(v) ? n * 100 : n; // «30 %» es 30, como se ve
            }
            (r[c] = r[c] || {})[k] = v;
          });
          // Al revés («de 300 a 100», «del 15 al 1»): se entiende y se da la vuelta.
          Object.keys(r).forEach(function (c) {
            var x = r[c];
            if (typeof x.min === 'number' && typeof x.max === 'number' && x.min > x.max) { var t1 = x.min; x.min = x.max; x.max = t1; }
            if (x.desde && x.hasta && x.desde > x.hasta) { var t2 = x.desde; x.desde = x.hasta; x.hasta = t2; }
          });
          return { filtros: r, error: mal };
        }
        function contar() {
          var l = leer(), n = filtrar(a, vista, todas, { hoy: hoy, q: S.q, aviso: S.aviso, filtros: l.filtros, valores: VAL }).length;
          err.textContent = l.error; err.hidden = !l.error;
          boton.textContent = n ? 'Ver ' + cuenta(a, vista, n) : 'Nada con estos filtros';
          return l;
        }
        contar();
        form.addEventListener('input', contar);
        form.addEventListener('change', contar);
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var l = contar();
          if (l.error) return;
          S.filtros = l.filtros;
          cerrarVentana(); pintar();
        });
        vent.querySelector('[data-fquitar]').addEventListener('click', function () { S.filtros = {}; cerrarVentana(); pintar(); });
      }

