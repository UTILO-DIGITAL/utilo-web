        /* ---------- T0651 · lo de dentro (personas de contacto, lo que buscan, las telas que le interesan) y borrar ---------- */
        function rehacer() {
          if (!abierta) return;
          var sc = velo.querySelector('.u-ventana'), t1 = sc ? sc.scrollTop : 0, t2 = velo.scrollTop;
          if (alCerrar) { var ac = alCerrar; alCerrar = null; ac(); }
          ficha(abierta.id);
          var sc2 = velo.querySelector('.u-ventana'); if (sc2) sc2.scrollTop = t1; velo.scrollTop = t2;
        }
        function sinPrefijo(e) { return String((e && e.message) || e).replace(/^[A-Z]+: /, ''); }
        function filaRel(r, k) { var cl = relEdicion(r).clave; return filas(r.tabla).filter(function (y) { return String(y[cl]) === String(k); })[0] || null; }
        function nombreRel(fe) { var n = fe.querySelector('.li-rel-n'); return n ? n.textContent.trim() : fe.getAttribute('data-rel-fila'); }
        function sinLog(x) { var o = {}; Object.keys(x || {}).forEach(function (k) { if (k !== 'LOG' && k.charAt(0) !== '_') o[k] = x[k]; }); return o; }
        function primeraMayuscula(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
        /** Lo escrito en un formulario de lo de dentro, como se guarda (un número, como número); con lo que no vale, en mal. */
        function leidos(ra, cont) {
          var v = {}, mal = [];
          [].forEach.call(cont.querySelectorAll('[data-rc]'), function (i) {
            var c = i.getAttribute('data-rc'), s = String(i.value || '').trim(), cp = campo(ra, c);
            if (prohibido(s, PROHIB).length) { mal = mal.concat(prohibido(s, PROHIB)); i.setAttribute('aria-invalid', 'true'); return; }
            v[c] = deEscrito(cp, s);
          });
          return { valores: v, mal: mal };
        }
        /** Tocar un dato de lo de dentro: su campo; al salir (o al elegir), se guarda en su fila, con «Deshacer». */
        function abrirRel(el) {
          var s = el.closest('[data-rel]'), ri = +s.getAttribute('data-rel'), r = a.relacionados[ri], ra = relAps[ri];
          var fe = el.closest('[data-rel-fila]'), k = fe.getAttribute('data-rel-fila'), c = el.getAttribute('data-rel-tocar'), fila0 = filaRel(r, k);
          if (!fila0) { rehacer(); return; }
          var t = document.createElement('div');
          t.innerHTML = entradaRel(ra, c, fila0, 'li-r' + ri + '-');
          var u = t.firstChild; u.classList.add('li-ed-abierto'); u.setAttribute('data-rel-abierto', c);
          var g = document.createElement('span'); g.className = 'li-guardado'; g.setAttribute('aria-live', 'polite'); u.appendChild(g);
          el.parentNode.replaceChild(u, el);
          var i = u.querySelector('input,select,textarea'); if (!i) return;
          var b2 = u.querySelector('[data-dos-v][aria-pressed=true]') || u.querySelector('[data-dos-v]'); // T0746: Sí | No, al primero
          if (b2) b2.focus(); else i.focus();
          if (b2) { /* sus botones */ } else if (i.tagName === 'SELECT') { try { if (i.showPicker) i.showPicker(); } catch (e) {} } else if (i.select && i.type !== 'date') i.select();
          var hecho = false;
          function cerrar(sin) {
            if (hecho) return;
            if (sin) { hecho = true; rehacer(); return; }
            var q = cambioCampo(ra, c, i.value, fila0, PROHIB);
            if (q.error) { g.textContent = q.error; g.className = 'li-guardado li-guardado-mal'; i.setAttribute('aria-invalid', 'true'); i.focus(); return; }
            hecho = true;
            if (!Object.keys(q.cambios).length) { rehacer(); return; }
            var antes = {}; Object.keys(q.cambios).forEach(function (kk) { antes[kk] = vacio(fila0[kk]) ? '' : fila0[kk]; });
            var txt = textoCambio(ra, c, i.tagName === 'SELECT' && i.selectedIndex >= 0 ? i.options[i.selectedIndex].text : i.value, VAL, PROHIB);
            g.textContent = 'Guardando…';
            Promise.resolve(T.actualizar(r.tabla, k, q.cambios)).then(function () {
              rehacer();
              deshacible(txt, function () { return Promise.resolve(T.actualizar(r.tabla, k, antes)).then(rehacer); });
            }, function (e2) { ctx.aviso('No se ha guardado ' + campo(ra, c).titulo.toLowerCase() + ': ' + sinPrefijo(e2)); rehacer(); });
          }
          if (i.tagName === 'SELECT') i.addEventListener('change', function () { cerrar(false); });
          i.addEventListener('keydown', function (ev) {
            if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); cerrar(true); }
            else if (ev.key === 'Enter' && i.tagName === 'INPUT') { ev.preventDefault(); cerrar(false); }
          });
          i.addEventListener('blur', function () { setTimeout(function () { if (!hecho && document.activeElement !== i) cerrar(false); }, 0); });
        }
        /** «+ Añadir …»: un formulario corto ahí mismo (o, con «elegir», un buscador de lo que se puede añadir). */
        function nuevaRel(b) {
          var s = b.closest('[data-rel]'), ri = +s.getAttribute('data-rel'), r = a.relacionados[ri], ra = relAps[ri], e = relEdicion(r, YO.admin);
          var existentes = function () { return filas(r.tabla).map(function (y) { return y[e.clave]; }); };
          // T0724 (R35): lo escrito sigue ahí hasta que el motor dice que sí; si dice que no, alFallar(lo que pasa, en palabras).
          var anadir = function (valores, nombre, alFallar) {
            // T0738: lo de «poner» que apunta a otra tabla, por su nombre («Buscando»): su código; si no está, no se pone.
            var q = altaRelacionada(r, crudo, valores, existentes(), a.prefijos, function (c, v) { var cp = campo(ra, c); return !cp.ids ? v : v in cp.ids ? cp.ids[v] : Object.keys(cp.ids).some(function (n) { return String(cp.ids[n]) === String(v); }) ? v : undefined; });
            if (q.faltan.length) return 'Falta ' + yJuntos(q.faltan.map(function (c) { return campo(ra, c).titulo.toLowerCase(); })) + '.';
            Promise.resolve(T.crear(r.tabla, q.valores, { callado: true })).then(function (out) {
              rehacer();
              var nid = (out && (out.id || (out.fila && out.fila[e.clave]))) || q.valores[e.clave];
              if (nid) deshacible(primeraMayuscula(e.filas[0]) + ': ' + textoCorto(nombre, 40), function () { return Promise.resolve(T.borrar(r.tabla, nid)).then(rehacer); });
            }, function (e2) {
              var m = yaEsta(e2, { escritos: valores, nombre: nombre, donde: r.titulo || '' });
              if (alFallar && caja.isConnected) alFallar('No se ha añadido: ' + m); else { ctx.aviso('No se ha añadido: ' + m); rehacer(); }
            });
            return '';
          };
          var caja = document.createElement('div');
          if (e.elegir) {
            caja.className = 'li-rel-elegir';
            caja.innerHTML = '<label class="u-etiqueta" for="li-re' + ri + '">Busca por el código o el nombre</label><input type="search" id="li-re' + ri + '" autocomplete="off">' +
              '<ul class="li-rel-opc" role="list"></ul><p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="button" class="u-btn u-btn-texto" data-no>Cancelar</button></div>';
            var inp = caja.querySelector('input'), ul = caja.querySelector('ul');
            var ya = relacionadas(r, f, filas(r.tabla)).map(function (y) { return (y.__crudo || y)[e.elegir]; });
            var pinta = function () {
              var os = paraElegir(a, D, r, ya, inp.value, 20);
              ul.innerHTML = os.length ? os.map(function (o) { return '<li><button type="button" class="li-rel-opc-b" data-elegido="' + texto(o.id) + '">' + texto(o.texto) + '</button></li>'; }).join('') : '<li class="u-nota">' + (inp.value ? 'Nada con eso.' : 'Ya están todas.') + '</li>';
            };
            inp.addEventListener('input', pinta);
            ul.addEventListener('click', function (ev) {
              var o = ev.target.closest('[data-elegido]'); if (!o) return;
              var v = {}; v[e.elegir] = o.getAttribute('data-elegido');
              [].forEach.call(ul.querySelectorAll('button'), function (x) { x.disabled = true; });
              var nomE = o.textContent;
              anadir(v, nomE, function (m) {
                [].forEach.call(ul.querySelectorAll('button'), function (x) { x.disabled = false; });
                var er = caja.querySelector('.u-error'); er.textContent = m; er.hidden = false;
              });
            });
            pinta();
          } else {
            caja.innerHTML = '<form class="li-rel-alta" novalidate><div class="u-campos">' + e.alta.map(function (c) { return entradaRel(ra, c, {}, 'li-ra' + ri + '-'); }).join('') + '</div>' +
              '<p class="u-error" role="alert" hidden></p><div class="n-botones"><button type="submit" class="u-btn u-btn-accion">Añadir ' + texto(e.filas[0]) + '</button><button type="button" class="u-btn u-btn-texto" data-no>Cancelar</button></div></form>';
            caja = caja.firstChild;
            // T0724 (R35): lo que ya está (la fibra que ya tiene este diseño) no se vuelve a ofrecer.
            var yp = yaPuestos(r, relacionadas(r, f, filas(r.tabla)));
            Object.keys(yp).forEach(function (c) {
              var sl = caja.querySelector('select[data-rc="' + c + '"]');
              if (sl) [].slice.call(sl.options).forEach(function (op) { if (op.value && yp[c].indexOf(op.value) >= 0) sl.removeChild(op); });
            });
            // El nombre para el aviso: lo que se ve del campo que da nombre a la fila (el de la fibra, no su código).
            var nombreAlta = function (l) {
              var cn = r.nombre && e.alta.indexOf(r.nombre) >= 0 ? r.nombre : e.alta[0], i = caja.querySelector('[data-rc="' + cn + '"]');
              if (i && i.tagName === 'SELECT' && i.selectedIndex > 0) return i.options[i.selectedIndex].text;
              return l.valores[cn] || e.filas[0];
            };
            caja.addEventListener('submit', function (ev) {
              ev.preventDefault();
              var l = leidos(ra, caja), er = caja.querySelector('.u-error'), bt = caja.querySelector('[type=submit]');
              if (bt.disabled) return;
              var msg = l.mal.length ? textoProhibido(l.mal) : anadir(l.valores, nombreAlta(l), function (m) { bt.disabled = false; bt.textContent = 'Añadir ' + e.filas[0]; er.textContent = m; er.hidden = false; });
              if (msg) { er.textContent = msg; er.hidden = false; }
              else if (!l.mal.length) { er.hidden = true; bt.disabled = true; bt.textContent = 'Añadiendo…'; }
            });
          }
          caja.addEventListener('click', function (ev) { if (ev.target.closest('[data-no]')) rehacer(); });
          caja.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); rehacer(); } });
          b.parentNode.replaceChild(caja, b);
          var pri = caja.querySelector('input,select,textarea'); if (pri) pri.focus();
        }
        /** Quitar una fila de lo de dentro: se pregunta ahí mismo; después, «Deshacer» la vuelve a poner. */
        function quitarRel(b) {
          var s = b.closest('[data-rel]'), ri = +s.getAttribute('data-rel'), r = a.relacionados[ri], fe = b.closest('[data-rel-fila]'), k = fe.getAttribute('data-rel-fila');
          var nom = r.datos ? String(r.titulo || '').toLowerCase() : nombreRel(fe), donde = String(r.titulo || '').toLowerCase();
          var cf = document.createElement('div');
          cf.className = 'li-confirma'; cf.setAttribute('role', 'alert');
          cf.innerHTML = '<p>' + (r.datos ? '¿Quitar ' + texto(nom) + '?' : '¿Quitar «' + texto(nom) + '» de ' + texto(donde) + '?') + '</p><div class="n-botones"><button type="button" class="u-btn li-btn-peligro" data-si>Sí, quitar</button><button type="button" class="u-btn u-btn-texto" data-no>No</button></div>';
          fe.appendChild(cf); b.hidden = true;
          cf.querySelector('[data-si]').focus();
          cf.addEventListener('click', function (ev) {
            if (ev.target.closest('[data-no]')) { cf.remove(); b.hidden = false; b.focus(); return; }
            if (!ev.target.closest('[data-si]')) return;
            var copia = sinLog(filaRel(r, k));
            Promise.resolve(T.borrar(r.tabla, k)).then(function () {
              delete relAbiertas[ri + '|' + k];
              rehacer();
              deshacible(r.datos ? primeraMayuscula(nom) + ': quitado' : '«' + textoCorto(nom, 30) + '» ya no está en ' + donde, function () { return Promise.resolve(T.crear(r.tabla, copia)).then(rehacer); });
            }, function () { rehacer(); });
          });
        }
        Array.prototype.forEach.call(vent.querySelectorAll('section[data-rel]'), function (s) {
          s.addEventListener('click', function (ev) {
            var t = ev.target;
            var ab = t.closest('[data-rel-abre]');
            if (ab) {
              var li = ab.closest('[data-rel-fila]'), d = li.querySelector('.li-rel-d'), ri = s.getAttribute('data-rel');
              d.hidden = !d.hidden; ab.setAttribute('aria-expanded', String(!d.hidden));
              relAbiertas[ri + '|' + li.getAttribute('data-rel-fila')] = !d.hidden;
              return;
            }
            var rl = t.closest('[data-rel-rellenar]');
            if (rl) {
              var fe = rl.closest('[data-rel-fila]'), c = rl.getAttribute('data-rel-rellenar');
              var hu = [].filter.call(fe.querySelectorAll('[data-rel-hueco]'), function (x) { return x.getAttribute('data-rel-tocar') === c; })[0];
              var linea = rl.parentNode; rl.remove(); if (!linea.querySelector('.li-rellenar')) linea.remove();
              if (hu) { hu.hidden = false; hu.removeAttribute('data-rel-hueco'); abrirRel(hu); }
              return;
            }
            var dt = t.closest('[data-rel-tocar]');
            if (dt && !t.closest('a') && !dt.classList.contains('li-ed-abierto')) { abrirRel(dt); return; }
            var nq = t.closest('[data-rel-nueva]'); if (nq) { nuevaRel(nq); return; }
            var qq = t.closest('[data-rel-quitar]'); if (qq) { quitarRel(qq); return; }
          });
          s.addEventListener('keydown', function (ev) {
            var dt = ev.target.closest && ev.target.closest('[data-rel-tocar]');
            if (dt && ev.target === dt && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); abrirRel(dt); }
          });
        });
