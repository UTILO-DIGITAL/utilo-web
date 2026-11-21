      function abrirVentana(html, corta) {
        partir(null);
        velo.classList.toggle('li-v-corta', !!corta); // T0679: una ventana corta, en el móvil, sale desde abajo (no a pantalla completa)
        alCerrar = null; escDato = null; S.menu = ''; fichaVent = '';
        vent.innerHTML = html;
        velo.classList.add('abierto');
        var h = vent.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      }
      var alCerrar = null; // T0643: lo que se hace si la ventana se cierra sin terminar (el siguiente paso: volver atrás)
      var relAps = {}, relAbiertas = {}, relDeFicha = ''; // T0651: lo de dentro de la ficha abierta (cada uno, como apartado) y las filas abiertas
      var escDato = null; // T0651: Esc en un campo abierto de la ficha (o en lo de dentro): lo cierra sin cerrar la ficha
      /* T0732 (R50) · Atrás, o deslizar desde el borde, cierra la ficha: abrirla desde la lista añade una entrada al historial
       * (fichaLi, con ?ficha=…) y cerrarla vuelve atrás. Otra ficha con una ya abierta (la vista partida) cambia esa entrada, y
       * la ficha que trae la dirección al llegar no añade nada (atrás vuelve a donde se estaba). */
      var fichaVent = '', saltarPop = 0, tras = ''; // la ficha que se ve; los «atrás» propios aún sin llegar; la que se abre al llegar
      function apuntarFicha(id) {
        if (saltarPop) { tras = id; return; } // aún no ha llegado el atrás de la que se ha cerrado: se apunta cuando llegue
        var st = history.state || {};
        if (st.fichaLi === id) return;
        var nuevo = Object.assign({}, st, { fichaLi: id }), dir = location.pathname + dirFicha(location.search, id, editables(BASE)) + location.hash;
        try {
          if (st.fichaLi) { history.replaceState(nuevo, '', dir); return; }
          // La de debajo se queda en la lista: sin la ficha que traía la dirección al llegar (si no, atrás la volvería a abrir).
          var abajo = location.pathname + dirFicha(location.search, '+', editables(BASE)) + location.hash;
          if (abajo !== location.pathname + location.search + location.hash) history.replaceState(st, '', abajo);
          history.pushState(nuevo, '', dir);
        } catch (e) {}
      }
      atrasDe = function (st) {
        if (saltarPop) { saltarPop--; if (!saltarPop && tras) { var t = tras; tras = ''; apuntarFicha(t); } return true; }
        var q = queHacerAtras(st, velo.classList.contains('abierto') ? fichaVent : '');
        if (!q) return false;
        if (q.hacer === 'cerrar') cerrarVentana(true);
        else if (q.hacer === 'abrir') { if (velo.classList.contains('abierto')) cerrarVentana(true); if (q.id === '+') ficha(null, true); else ficha(q.id); }
        return true;
      };
      /** Cierra la ventana; si es una ficha abierta desde la lista, también su entrada del historial (salvo con «seguir»: la
       *  cierra atrás, o se abre otra en su lugar). */
      function cerrarVentana(seguir) {
        var al = alCerrar; alCerrar = null;
        if (al) al();
        var eraFicha = fichaVent; fichaVent = '';
        velo.classList.remove('abierto'); vent.innerHTML = ''; partir(null);
        if (eraFicha && seguir !== true && (history.state || {}).fichaLi === eraFicha) { saltarPop++; history.back(); return; }
        // Si se llegó con ?ficha=…, se quita de la dirección para que al volver no se abra otra vez.
        var us = new URLSearchParams(location.search);
        if (us.get('ficha') || us.get('nueva')) { var u = new URL(location.href); ['ficha', 'nueva'].concat(editables(BASE)).forEach(function (k) { u.searchParams.delete(k); }); history.replaceState(history.state, '', u.pathname + u.search + u.hash); }
      }
      /** Una fila nueva con lo que pone NUEVA (por el nombre en una columna que apunta a otra tabla; «hoy» en una fecha). */
      function nuevaFila(a) {
        var r = {};
        Object.keys(a.nueva || {}).forEach(function (c) {
          var v = a.nueva[c], cp = campo(a, c);
          if (v === 'hoy' && cp.tipo === 'fecha') v = hoyIso();
          r[c] = cp.ids && v in cp.ids ? cp.ids[v] : v;
        });
        if (MIAS && vacio(r[MIAS.campo])) r[MIAS.campo] = YO.correo; // T0689: una nueva es, de entrada, de quien la crea
        return r;
      }
      /** T0689: sin nadie más en el equipo, «Para quién» no se enseña ni se edita (todo es de quien entra). */
      function sinMias(c) { return !(BASE.mias && !MIAS && c === BASE.mias.campo); }
      function editables(a) {
        if (a.editar === true) {
          var t = [a.nombre].concat(a.columnas); a.ficha.forEach(function (g) { t = t.concat(g.campos || []); });
          return t.filter(function (c, i) { return c && t.indexOf(c) === i && c !== a.clave && c !== a.codigo && !esRuta(c) && !campo(a, c).calculo && !campo(a, c).de && sinMias(c); });
        }
        return lista(a.editar).filter(function (c) { return !campo(a, c).calculo && sinMias(c); });
      }
      /** T0651 · Un campo que se edita, leído como texto (con sus enlaces: la web, el correo): al tocarlo, su campo en su sitio. */
      function datoTocar(a, c, f, cli) {
        var cp = campo(a, c);
        if (c === a.nombre) return '<span class="li-ed li-ed-tit" data-tocar="' + texto(c) + '" tabindex="0" role="button" aria-label="' + texto('Cambiar: ' + cp.titulo) + '"><span class="u-etiqueta" aria-hidden="true">' + texto(cp.titulo) + '</span>' +
          '<span class="li-valor">' + celda(a, c, f, false, cli) + '</span><span class="li-guardado" aria-live="polite"></span></span>';
        return '<div class="li-dato li-ed' + (cp.tipo === 'nota' || cp.tipo === 'foto' ? ' u-ancho' : '') + '" data-tocar="' + texto(c) + '" tabindex="0" role="button" aria-label="' + texto('Cambiar: ' + cp.titulo) + '">' +
          '<span class="u-etiqueta">' + texto(cp.titulo) + '</span><span class="li-valor">' + celda(a, c, f, true, cli) + '</span><span class="li-guardado" aria-live="polite"></span></div>';
      }
      /** T0651 · Un dato de lo de dentro de una ficha (ri: cuál de RELACIONADOS), leído y tocándolo. */
      function datoRel(ri, k, c, x) {
        var ra = relAps[ri], cp = campo(ra, c);
        return '<div class="li-dato li-ed' + (cp.tipo === 'nota' ? ' u-ancho' : '') + '" data-rel-tocar="' + texto(c) + '" tabindex="0" role="button" aria-label="' + texto('Cambiar: ' + cp.titulo) + '">' +
          '<span class="u-etiqueta">' + texto(cp.titulo) + '</span><span class="li-valor">' + celda(ra, c, x, true) + '</span><span class="li-guardado" aria-live="polite"></span></div>';
      }
      /** T0651 · Un campo para lo de dentro: como los de la ficha, con otros id (no chocan con los suyos) y fuera de su formulario. */
      function entradaRel(ra, c, x, pre) {
        return entrada(ra, c, x).replace(/(id|for)="li-c-/g, '$1="' + pre).replace(/ data-c="/g, ' data-rc="');
      }
      /** T0746 · Los dos botones, como su desplegable escondido (el que guarda): el elegido, marcado y con su color. */
      function pintarDos(sel) {
        var g = sel.parentNode.querySelector('.li-dos'); if (!g) return;
        [].forEach.call(g.querySelectorAll('[data-dos-v]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-dos-v') === sel.value)); });
      }
      function entrada(a, c, f) {
        var cp = campo(a, c), v = f ? f[c] : '', id = 'li-c-' + c;
        var et = '<label class="u-etiqueta" for="' + id + '">' + texto(cp.titulo) + '</label>';
        var dos = dosOpciones(cp, v);
        if (dos) {
          // T0746: dos opciones (Sí | No), dos botones juntos; tocar el elegido lo deja vacío. Guarda su desplegable, escondido.
          return '<div class="u-campo"><span class="u-etiqueta">' + texto(cp.titulo) + '</span><div class="li-dos" role="group" aria-label="' + texto(cp.titulo) + '">' + dos.map(function (o) {
            return '<button type="button" class="li-dos-b' + (o.color ? ' li-' + texto(o.color) : '') + '" data-dos-v="' + texto(o.valor) + '" aria-pressed="' + (o.valor === String(v)) + '">' + texto(mostrar(cp, o.nombre)) + '</button>';
          }).join('') + '</div><select id="' + id + '" hidden data-dos data-c="' + texto(c) + '"><option value=""></option>' + dos.map(function (o) {
            return '<option value="' + texto(o.valor) + '"' + (o.valor === String(v) ? ' selected' : '') + '>' + texto(mostrar(cp, o.nombre)) + '</option>';
          }).join('') + '</select></div>';
        }
        if (cp.ids) {
          // Una columna que apunta a otra tabla: se elige por el nombre y se guarda el código.
          var ns = Object.keys(cp.ids);
          // T0679: un campo con colores (la fase, el estado) se elige en una pastilla de su color, no en un desplegable gris.
          var nv = ns.filter(function (n) { return String(cp.ids[n]) === String(v); })[0];
          var mp = {}; if (cp.colores) ns.forEach(function (n) { if (cp.colores[n]) mp[cp.ids[n]] = cp.colores[n]; });
          var pil = cp.colores ? ' class="li-sel-pil li-estado li-' + texto(cp.colores[nv] || 'gris') + '" data-pil="' + texto(JSON.stringify(mp)) + '"' : ' data-elegir="' + texto(c) + '"'; // T0684
          return '<div class="u-campo">' + et + '<select id="' + id + '"' + pil + ' data-c="' + texto(c) + '"><option value=""></option>' +
            ns.map(function (n) { return '<option value="' + texto(cp.ids[n]) + '"' + (String(v) === String(cp.ids[n]) ? ' selected' : '') + '>' + texto(mostrar(cp, n)) + '</option>'; }).join('') +
            (!vacio(v) && !ns.some(function (n) { return String(cp.ids[n]) === String(v); }) ? '<option value="' + texto(v) + '" selected>' + texto(v) + '</option>' : '') + '</select></div>';
        }
        if (cp.opciones) {
          var ops = cp.opciones.slice(); if (!vacio(v) && ops.indexOf(String(v)) < 0) ops.unshift(String(v));
          return '<div class="u-campo">' + et + '<select id="' + id + '"' + (cp.colores ? ' class="li-sel-pil li-estado li-' + texto(cp.colores[String(v)] || 'gris') + '" data-pil="' + texto(JSON.stringify(cp.colores)) + '"' : ' data-elegir="' + texto(c) + '"') + ' data-c="' + texto(c) + '"><option value=""></option>' +
            ops.map(function (o) { return '<option value="' + texto(o) + '"' + (String(v) === o ? ' selected' : '') + '>' + texto(mostrar(cp, o)) + '</option>'; }).join('') + '</select></div>';
        }
        // Lo que no se guarda (una cuenta, un DNI) tampoco se enseña al editar: sale tapado y, si se guarda, se quita.
        var tapado = !vacio(v) && prohibido(v, PROHIB).length ? tapar(v, PROHIB) : null;
        var nota = tapado !== null ? '<span class="u-nota">Hemos tapado un dato que aquí no se guarda. Si guardas este campo, se quita.</span>' : '';
        if (tapado !== null) v = tapado;
        if (cp.tipo === 'nota') return '<div class="u-campo u-ancho">' + et + '<textarea id="' + id + '" rows="3" data-c="' + texto(c) + '">' + texto(v) + '</textarea>' + nota + '</div>';
        var tipo = cp.tipo === 'fecha' ? 'date' : (cp.tipo === 'email' ? 'email' : (cp.tipo === 'telefono' ? 'tel' : (cp.tipo === 'enlace' || cp.tipo === 'foto' ? 'url' : 'text')));
        var d = cp.tipo === 'fecha' ? aFecha(v) : null;
        // T0714: un porcentaje se escribe en % (48, no 0,48).
        var val = d ? d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()) : (vacio(v) ? '' : cp.tipo === 'porcentaje' && !isNaN(pctVer(v)) ? String(pctVer(v)).replace('.', ',') : String(v));
        return '<div class="u-campo">' + et + '<input id="' + id + '" type="' + tipo + '"' + (/importe|numero|porcentaje/.test(cp.tipo) ? ' inputmode="decimal"' : '') + ' data-c="' + texto(c) + '" value="' + texto(val) + '">' + nota + '</div>';
      }
      /** El valor con el que se abrió un campo de la ficha (para guardar solo lo que se ha cambiado). */
      function inicial(i) {
        if (i.tagName === 'SELECT') { var o = [].filter.call(i.options, function (x) { return x.defaultSelected; })[0]; return o ? o.value : ''; }
        return i.defaultValue;
      }
