        var form = vent.querySelector('#li-form');
        [].forEach.call(vent.querySelectorAll('[data-accion]'), function (b) {
          b.addEventListener('click', function () {
            var x = acc[+b.getAttribute('data-accion')], cambios = {};
            Object.keys(x.poner || {}).forEach(function (c) { var cp = campo(a, c), v = x.poner[c]; cambios[c] = cp.ids && v in cp.ids ? cp.ids[v] : v; });
            cerrarVentana();
            Promise.resolve(T.actualizar(a.tabla, id, cambios)).then(function () { ctx.aviso(x.hecho || 'Hecho.'); }, function (e) { ctx.aviso('No se ha cambiado: ' + ((e && e.message) || e)); });
          });
        });
        /* T0689 · La ficha guarda sola: cada campo, al cambiarlo (un desplegable o una fecha, al momento; un texto, al salir de él
         * o tras 1,5 s sin escribir), con «Guardando…» y «Guardado» a su lado y el aviso con «Deshacer». Lo que no vale (algo
         * que aquí no se guarda, una obligatoria vacía) se dice al lado y no se guarda; si falla al guardar, vuelve a como estaba. */
        var actual = solo ? mezclar(crudoEd, {}) : null;
        /** T0651 · El dato leído de c (si no está abierto) o el campo abierto. */
        function datoDe(c) { return [].filter.call(vent.querySelectorAll('[data-tocar]'), function (x) { return x.getAttribute('data-tocar') === c; })[0] || null; }
        function entradaDe(c) { return [].filter.call(vent.querySelectorAll('[data-c]'), function (x) { return x.getAttribute('data-c') === c; })[0] || null; }
        // T0651: lo que se edita tocando está en el formulario y, el nombre, en el título (fuera de él): los dos escuchan igual.
        var cabF = vent.querySelector('.li-ficha-cab'), zonas = nomTit && cabF ? [form, cabF] : [form];
        function en(tipo, fn) { zonas.forEach(function (z) { z.addEventListener(tipo, fn); }); }
        function marcaCampo(i, txt, mal) {
          var c = i.getAttribute && i.getAttribute('data-c'), d = c ? datoDe(c) : null;
          var u = d || (vent.contains(i) ? i.closest('.u-campo') || i.parentNode : null);
          if (!u) return;
          var sp = u.querySelector('.li-guardado');
          if (!sp) { sp = document.createElement('span'); sp.className = 'li-guardado'; sp.setAttribute('aria-live', 'polite'); u.appendChild(sp); }
          sp.textContent = txt; sp.classList.toggle('li-guardado-mal', !!mal); sp.classList.toggle('li-guardado-ok', txt === 'Guardado');
        }
        function ponerInicial(i, v) {
          if (i.tagName === 'SELECT') [].forEach.call(i.options, function (o) { o.defaultSelected = o.value === String(v); });
          else i.defaultValue = String(v);
        }
        function ponerValor(c, v) {
          var i = entradaDe(c);
          if (!i) { if (datoDe(c)) pintarDato(c); return; } // T0651: leído como texto, se vuelve a pintar con lo de ahora
          i.value = vacio(v) ? '' : String(v); ponerInicial(i, i.value);
          if (i.hasAttribute('data-pil')) i.dispatchEvent(new Event('change')); // su color
          if (i.hasAttribute('data-dos')) pintarDos(i); // T0746: sus dos botones
        }
        /** T0651 · Lo de ahora de c, como se ve (el nombre de lo que apunta a otra tabla), para pintarlo leído. */
        function filaAhora(c) {
          var cp = campo(a, c), v = actual[c], r = mezclar(f, {});
          if (cp.ids) { var n = Object.keys(cp.ids).filter(function (k) { return String(cp.ids[k]) === String(v); })[0]; r[c] = n !== undefined ? n : v; }
          else r[c] = v;
          return r;
        }
        function pintarDato(c) {
          var d = datoDe(c) || (entradaDe(c) && entradaDe(c).closest('[data-abierto]')); if (!d) return;
          var g = d.querySelector('.li-guardado'), t = document.createElement('div');
          t.innerHTML = datoTocar(a, c, filaAhora(c), cli);
          var n = t.firstChild;
          if (g && g.textContent) { var g2 = n.querySelector('.li-guardado'); g2.textContent = g.textContent; g2.className = g.className; }
          d.parentNode.replaceChild(n, d);
          return n;
        }
        /** T0651 · Tocar un dato: su campo en su sitio, con lo de ahora; uno de una ruta dice dónde se guarda. Al salir, se guarda y se vuelve a leer. */
        function abrirDato(c) {
          var d = datoDe(c); if (!d || !actual) return;
          var t = document.createElement('div');
          t.innerHTML = entrada(a, c, actual);
          var u = t.firstChild, av = avisoRuta(a, D, c, crudo);
          u.setAttribute('data-abierto', c); u.classList.add('li-ed-abierto');
          if (av) { var nt = document.createElement('span'); nt.className = 'u-nota li-ed-aviso'; nt.textContent = av; u.appendChild(nt); }
          d.parentNode.replaceChild(u, d);
          var i = u.querySelector('input,select,textarea'); if (!i) return;
          i.focus();
          if (i.tagName === 'SELECT') { try { if (i.showPicker) i.showPicker(); } catch (e) {} }
          else if (i.select && i.type !== 'date') i.select();
        }
        /** Cerrar el campo abierto de c: con «sin», vuelve a lo de antes sin guardar. */
        function cerrarDato(c, sin) {
          var i = entradaDe(c), u = i && i.closest('[data-abierto]'); if (!u) return;
          if (!sin) { var r = guardarCampo(i); if (r === 'mal') return; }
          else G.olvidar(c);
          var g = u.querySelector('.li-guardado'), t = document.createElement('div');
          t.innerHTML = datoTocar(a, c, filaAhora(c), cli);
          var n = t.firstChild;
          if (g && g.textContent && !sin) { var g2 = n.querySelector('.li-guardado'); g2.textContent = g.textContent; g2.className = g.className; }
          u.parentNode.replaceChild(n, u);
        }
        /* T0736 (R99): lo que decide (la cola por campo, la espera, los estados y el deshacer) es guardadoSolo, probado sin
         * pantalla; aquí, solo cómo se ve. «que» es el campo (input, select o textarea). */
        var G = guardadoSolo({
          apartado: a, prohib: PROHIB, actual: actual, espera: 1500,
          reloj: { poner: function (fn, ms) { return setTimeout(fn, ms); }, quitar: function (t) { clearTimeout(t); } },
          // T0651: una ruta («ID_DISENO.ANCHO») se guarda en la fila a la que llega (su diseño), con su columna.
          escritor: function (c) {
            var dest = esRuta(c) ? destinoDe(a, D, c, crudo) : null;
            if (esRuta(c) && !dest) return 'No se puede: le falta ' + campo(a, c.split('.')[0]).titulo.toLowerCase() + '.';
            return function (cs) {
              if (!dest) return T.actualizar(a.tabla, id, cs);
              var o = {}; Object.keys(cs).forEach(function (k) { o[k === c ? dest.columna : k] = cs[k]; });
              return T.actualizar(dest.tabla, dest.id, o);
            };
          },
          invalido: function (i, si) { if (si) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); },
          igual: function (i) { var sp = (i.closest('.u-campo') || i.parentNode).querySelector('.li-guardado'); if (sp && sp.classList.contains('li-guardado-mal')) sp.textContent = ''; },
          empieza: function (i, c, cambios) {
            ponerInicial(i, i.value);
            Object.keys(cambios).forEach(function (k) { if (k !== c) ponerValor(k, cambios[k]); }); // lo que se pone solo (el área), también en pantalla
            return textoCambio(a, c, i.tagName === 'SELECT' && i.selectedIndex >= 0 ? i.options[i.selectedIndex].text : i.value, VAL, PROHIB);
          },
          estado: function (i, txt, mal) { marcaCampo(i, txt, mal); },
          hecho: function (i, txt, deshacer) { deshacible(txt, deshacer); },
          volver: function (i, k, v) { if (vent.contains(i) || datoDe(k)) ponerValor(k, v); },
          fallo: function (i, c, e) { ctx.aviso('No se ha guardado ' + campo(a, c).titulo.toLowerCase() + ': ' + ((e && e.message) || e)); }
        });
        function guardarCampo(i) { return G.guardar(i.getAttribute('data-c'), i.value, i); }
        if (solo) {
          en('change', function (ev) {
            var i = ev.target, c = i.getAttribute && i.getAttribute('data-c'); if (!c) return;
            // T0651: un desplegable que se abrió tocando el dato se cierra al elegir (y se guarda al cerrarse).
            if (tocar && i.tagName === 'SELECT' && i.closest('[data-abierto]')) { cerrarDato(c); return; }
            guardarCampo(i);
          });
          en('input', function (ev) {
            var i = ev.target, c = i.getAttribute && i.getAttribute('data-c');
            if (!c || i.tagName === 'SELECT' || /^(date|checkbox|radio)$/.test(i.type)) return;
            G.esperar(c, function () { return vent.contains(i) ? i.value : undefined; }, i);
          });
          // Al cerrar la ficha con algo escrito y sin guardar aún, se guarda.
          alCerrar = function () { G.cerrar(entradaDe, function (i) { return i.value; }); };
        }
        if (tocar) {
          // T0651: tocar un dato (no un enlace de dentro: la web, el correo) lo abre; Intro o espacio, también.
          en('click', function (ev) {
            var d = ev.target.closest('[data-tocar]'); if (!d || ev.target.closest('a')) return;
            abrirDato(d.getAttribute('data-tocar'));
          });
          en('keydown', function (ev) {
            var d = ev.target.closest && ev.target.closest('[data-tocar]');
            if (d && ev.target === d && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); abrirDato(d.getAttribute('data-tocar')); return; }
            // Intro en un campo abierto (no en una nota, que lleva varias líneas): se guarda y vuelve a leerse.
            var c = ev.target.getAttribute && ev.target.getAttribute('data-c');
            if (ev.key === 'Enter' && c && ev.target.tagName === 'INPUT' && ev.target.closest('[data-abierto]')) { ev.preventDefault(); cerrarDato(c); var dd = datoDe(c); if (dd) dd.focus(); }
          });
          // Al salir de un campo abierto (o de uno de «Sin rellenar» ya escrito), se guarda y se vuelve a leer como texto.
          en('focusout', function (ev) {
            var i = ev.target, c = i.getAttribute && i.getAttribute('data-c'); if (!c) return;
            var u = i.closest('[data-abierto],[data-hueco]'); if (!u) return;
            setTimeout(function () {
              if (!vent.contains(i) || u.contains(document.activeElement)) return;
              if (u.hasAttribute('data-hueco')) { if (vacio(i.value) || guardarCampo(i) === 'mal') return; u.setAttribute('data-abierto', c); u.removeAttribute('data-hueco'); }
              cerrarDato(c);
            }, 0);
          });
          // Esc en un campo abierto: vuelve a como estaba y lo cierra (la ficha sigue abierta).
          escDato = function () {
            var ae = document.activeElement, u = ae && ae.closest && ae.closest('[data-abierto]');
            if (!u || !vent.contains(u)) return false;
            var c = u.getAttribute('data-abierto'), i = entradaDe(c);
            if (i) { i.value = vacio(actual[c]) ? '' : String(actual[c]); }
            cerrarDato(c, true);
            var d = datoDe(c); if (d) d.focus();
            return true;
          };
        }
