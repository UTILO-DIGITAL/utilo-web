        // Borrar la fila (dentro de «Más»): lo que no deja borrarla y qué hacer en su lugar, o la confirmación con lo que se va con ella.
        var bb = vent.querySelector('[data-borrar]');
        if (bb) bb.addEventListener('click', function () {
          var sitio = vent.querySelector('[data-borrar-sitio]'), qb = queBorra(a, D, crudo), nom = '«' + textoCorto(String(f[a.nombre] || id), 40) + '»';
          var sino = a.borrar.sino;
          if (qb.paran.length) {
            sitio.innerHTML = '<div class="li-confirma li-no-borrar" role="alert"><p><b>No se puede borrar ' + texto(nom) + ':</b> tiene ' + texto(yJuntos(qb.paran.map(function (x) { return x.texto; }))) + '.' + (a.borrar.texto ? ' ' + texto(a.borrar.texto) : '') + '</p>' +
              '<div class="n-botones">' + (sino ? '<button type="button" class="u-btn" data-borrar-sino>' + texto(sino.titulo) + '</button>' : '') + '<button type="button" class="u-btn u-btn-texto" data-no>Cancelar</button></div></div>';
          } else {
            sitio.innerHTML = '<div class="li-confirma" role="alert"><p>¿Borrar ' + texto(nom) + '?' + (qb.van.length ? ' Se borra también: ' + texto(yJuntos(qb.van.map(function (x) { return x.texto; }))) + '.' : '') + ' No se puede deshacer.</p>' +
              '<div class="n-botones"><button type="button" class="u-btn li-btn-peligro" data-borrar-si>Sí, borrar</button><button type="button" class="u-btn u-btn-texto" data-no>No</button></div></div>';
          }
          bb.hidden = true;
          var pri = sitio.querySelector('button'); if (pri) pri.focus();
          sitio.onclick = function (ev) {
            if (ev.target.closest('[data-no]')) { sitio.innerHTML = ''; bb.hidden = false; bb.focus(); return; }
            if (ev.target.closest('[data-borrar-sino]')) {
              var cs = {}; Object.keys(sino.poner).forEach(function (c) { var cp = campo(a, c), v = sino.poner[c]; cs[c] = cp.ids && v in cp.ids ? cp.ids[v] : v; });
              Promise.resolve(T.actualizar(a.tabla, id, cs)).then(function () { ctx.aviso(sino.hecho || 'Hecho.'); rehacer(); }, function (e2) { ctx.aviso('No se ha cambiado: ' + sinPrefijo(e2)); });
              return;
            }
            if (!ev.target.closest('[data-borrar-si]')) return;
            [].forEach.call(sitio.querySelectorAll('button'), function (x) { x.disabled = true; });
            // T0724 (R07): ella y lo que se va con ella, en una sola llamada (la de T0722). El motor mira antes todos sus usos,
            // también en las tablas que aquí no se ven, y si algo bloquea no borra nada (y lo dice).
            Promise.resolve(T.borrar(a.tabla, id, { con: borrarCon(a) })).then(function () {
              cerrarVentana(); ctx.aviso('Se ha borrado ' + nom + '.');
            }, function () { rehacer(); });
          };
        });
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          // T0689: sin «Guardar», Intro en un campo lo guarda y la ficha sigue abierta.
          if (solo) {
            var ae = document.activeElement, ca = ae && form.contains(ae) && ae.getAttribute('data-c');
            if (ca) { if (tocar && ae.closest('[data-abierto]')) { cerrarDato(ca); var dd = datoDe(ca); if (dd) dd.focus(); } else guardarCampo(ae); }
            return;
          }
          var err = vent.querySelector('#li-err'), cambios = {}, malos = [], faltan = [];
          // T0714: con «Diseño nuevo», el diseño no se elige: se crea antes que la tela, con su código.
          var nvo = nueva && a.alta && a.alta.nuevo && enNuevo(form) ? a.alta.nuevo : null, tNueva = '', filaNueva = null;
          [].forEach.call(form.querySelectorAll('[data-c]'), function (i) {
            var c = i.getAttribute('data-c'), v = i.value.trim(), cp = campo(a, c);
            if (nvo && c === nvo.campo) return;
            var p = prohibido(v, PROHIB); if (p.length) { malos = malos.concat(p); i.setAttribute('aria-invalid', 'true'); } else i.removeAttribute('aria-invalid');
            if (v === '' && a.obligatorias.indexOf(c) >= 0) { faltan.push(cp.titulo); i.setAttribute('aria-invalid', 'true'); }
            // Al añadir, todo lo que tiene valor (también lo que viene puesto); al editar, solo lo que ha cambiado.
            if (nueva ? v !== '' : v !== String(inicial(i)).trim()) cambios[c] = deEscrito(cp, v);
          });
          if (nvo) {
            tNueva = refDe(a, a.tabla, nvo.campo); filaNueva = valoresNuevo(a, form);
            [].forEach.call(form.querySelectorAll('[data-nc]'), function (i) {
              var r = i.getAttribute('data-nc'), v = i.value.trim(), p = prohibido(v, PROHIB), mal = p.length > 0 || (v === '' && nvo.obligatorias.indexOf(r) >= 0);
              if (p.length) malos = malos.concat(p);
              if (v === '' && nvo.obligatorias.indexOf(r) >= 0) faltan.push(campo(a, r).titulo);
              if (mal) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
            });
            var le = form.querySelector('[data-letras]'), cd = codigoAltaNuevo(nvo, filas(tNueva), filaNueva, le ? le.value : '');
            // Sin código: si no ha elegido técnica, que la elija; si es la primera de su técnica, las letras.
            var segV = nvo.codigo.segun ? filaNueva[nvo.codigo.segun] : '';
            if (cd.codigo) { filaNueva.ID = cd.codigo; cambios[nvo.campo] = cd.codigo; } else faltan.push(nvo.codigo.segun && vacio(segV) ? campo(a, nvo.campo + '.' + nvo.codigo.segun).titulo : nvo.codigo.titulo);
          }
          if (nueva) {
            // T0643: «Con quién» del alta (una lista para varias columnas) guarda en la que toca.
            [].forEach.call(form.querySelectorAll('[data-uno]'), function (s) { var v = s.value, k = v.indexOf('|'); if (k > 0) cambios[v.slice(0, k)] = v.slice(k + 1); });
            // Lo que NUEVA pone y el alta no pregunta (el estado: nace Pendiente), también.
            var base = nuevaFila(a), enForm = function (c) { return [].some.call(form.querySelectorAll('[data-c]'), function (i) { return i.getAttribute('data-c') === c; }); };
            Object.keys(base).forEach(function (c) { if (!enForm(c) && !(c in cambios) && !vacio(base[c])) cambios[c] = base[c]; });
            a.obligatorias.forEach(function (c) { if (!enForm(c) && vacio(cambios[c])) faltan.push(campo(a, c).titulo); });
            // T0651: el código de la fila nueva con NUEVO_ID (BOR-004-04, según su diseño); si falta lo que usa, se dice.
            if (a.nuevoId) {
              var cn = nuevoId(a.nuevoId, cambios, filas(a.tabla).map(function (x) { return x[a.clave]; }));
              if (cn) cambios[a.clave] = cn;
              else enPlantilla(a.nuevoId).filter(function (c) { return /^[A-Z0-9_]+$/.test(c) && vacio(cambios[c]) && faltan.indexOf(campo(a, c).titulo) < 0; }).forEach(function (c) { faltan.push(campo(a, c).titulo); });
            }
          }
          // T0643: lo que se pone solo (el área por con quién es), si está vacío y no se ha tocado.
          var ded = deducidos(a, nueva ? cambios : mezclar(crudo, cambios));
          Object.keys(ded).forEach(function (c) { if (nueva ? vacio(cambios[c]) : vacio(crudo[c]) && !(c in cambios)) cambios[c] = ded[c]; });
          if (malos.length) { err.textContent = textoProhibido(malos.filter(function (k, i) { return malos.indexOf(k) === i; })); err.hidden = false; return; }
          if (faltan.length) { err.textContent = 'Falta ' + faltan.join(', ').replace(/, ([^,]*)$/, ' y $1') + '.'; err.hidden = false; return; }
          if (!Object.keys(cambios).length) { cerrarVentana(); return; }
          // T0714: primero el diseño nuevo y, cuando está, la tela con su código.
          var p = filaNueva ? Promise.resolve(T.crear(tNueva, filaNueva)).then(function () { return T.crear(a.tabla, cambios); })
            : nueva ? T.crear(a.tabla, cambios) : T.actualizar(a.tabla, id, cambios);
          cerrarVentana();
          Promise.resolve(p).then(function (out) {
            ctx.aviso(nueva ? 'Añadido.' : 'Guardado.');
            // T0651: una fila nueva (sin ALTA, o con «abrir») abre su ficha, para seguir con lo demás (sus personas…); una tarea, no.
            var nid = nueva && (!a.alta || a.alta.abrir) && out && (out.id || (out.fila && out.fila[a.clave]));
            if (nid && !velo.classList.contains('abierto') && filaVista(ap(), nid)) ficha(nid);
          }, function (e) { ctx.aviso('No se ha guardado: ' + ((e && e.message) || e)); });
        });
        if (nueva && vent.querySelector('[data-cod-nuevo]')) {
          // T0651: «Tendrá el código M-220» (con NUEVO_ID, según lo elegido: el diseño de una tela nueva).
          var ponerCodigo = function () {
            var el = vent.querySelector('[data-cod-nuevo]'), v = mezclar(crudo, {});
            [].forEach.call(form.querySelectorAll('[data-c]'), function (i) { v[i.getAttribute('data-c')] = i.value; });
            // T0714: con «Diseño nuevo», el código del diseño (BOR-005) y el de la tela, su primer color (BOR-005-01).
            var nv = a.alta && a.alta.nuevo, cd = null;
            if (nv && enNuevo(form)) {
              var le = form.querySelector('[data-letras]');
              var vn = valoresNuevo(a, form);
              cd = codigoAltaNuevo(nv, filas(refDe(a, a.tabla, nv.campo)), vn, le ? le.value : '');
              // Las letras, solo si hacen falta: la primera de una técnica ya elegida (sin técnica, primero la técnica).
              form.querySelector('[data-nuevo-letras]').hidden = !cd.pedir || (!!nv.codigo.segun && vacio(vn[nv.codigo.segun]));
              v[nv.campo] = cd.codigo;
            }
            var cn = codigoNuevo(a.nuevoId, a.prefijos, a.tabla, v, filas(a.tabla).map(function (x) { return x[a.clave]; }));
            el.innerHTML = cn ? 'Tendrá el código <b>' + texto(cn) + '</b>' + (cd && cd.codigo ? ', con el ' + texto(campo(a, nv.campo).titulo.toLowerCase()) + ' nuevo <b>' + texto(cd.codigo) + '</b>' : '') + '.' : ''; el.hidden = !cn;
          };
          // T0714: «Uno que ya tengo» o «Diseño nuevo» (ALTA.nuevo), con sus dos botones.
          form.addEventListener('click', function (ev) {
            var b = ev.target.closest && ev.target.closest('[data-nuevo-modo]'); if (!b) return;
            var nuevo = b.getAttribute('data-nuevo-modo') === 'nuevo', caja = b.closest('[data-nuevo]');
            caja.querySelector('[data-nuevo-ya]').hidden = nuevo; caja.querySelector('[data-nuevo-bloque]').hidden = !nuevo;
            [].forEach.call(caja.querySelectorAll('[data-nuevo-modo]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            var pri = caja.querySelector(nuevo ? '[data-nc]' : '[data-c]'); if (pri) pri.focus();
            ponerCodigo();
          });
          form.addEventListener('input', ponerCodigo); form.addEventListener('change', ponerCodigo); ponerCodigo();
        }
        if (alta) {
          // El área (lo de DEDUCIR) se pone sola al elegir con quién, mientras no se toque a mano.
          var ponerDeducidos = function () {
            var fl = {};
            [].forEach.call(form.querySelectorAll('[data-c]'), function (i) { fl[i.getAttribute('data-c')] = i.value; });
            [].forEach.call(form.querySelectorAll('[data-uno]'), function (s) { var v = s.value, k = v.indexOf('|'); if (k > 0) fl[v.slice(0, k)] = v.slice(k + 1); });
            Object.keys(a.deducir).forEach(function (c) {
              var s = [].filter.call(form.querySelectorAll('[data-c]'), function (i) { return i.getAttribute('data-c') === c; })[0];
              if (!s || s.hasAttribute('data-tocado')) return;
              var tmp = mezclar(fl, {}); tmp[c] = '';
              var d = deducidos(a, tmp);
              s.value = d[c] || '';
              var nota = form.querySelector('[data-deducido="' + c + '"]');
              if (nota) nota.textContent = d[c] ? 'Puesta sola según con quién es. Puedes cambiarla.' : '';
            });
          };
          // T0677: el buscador de «con quién» deja en la lista solo lo que lleva lo escrito (y elige lo primero que lo lleva).
          form.addEventListener('input', function (ev) {
            var c = ev.target.getAttribute && ev.target.getAttribute('data-buscar-uno'); if (!c) return;
            var sl = form.querySelector('select[data-uno="' + c + '"]'), antes = sl.value;
            var gs = gruposConQuien(a, c, editables(a), ev.target.value), vale = gs.some(function (g) { return g.opciones.some(function (o) { return g.col + '|' + o.valor === antes; }); });
            var sel = vale || !ev.target.value.trim() ? antes : (gs[0] ? gs[0].col + '|' + gs[0].opciones[0].valor : '');
            sl.innerHTML = opcionesUno(gs, sel);
            if (sl.value !== antes) ponerDeducidos();
          });
          form.addEventListener('change', function (ev) {
            var c = ev.target.getAttribute && ev.target.getAttribute('data-c');
            if (c && c in a.deducir) { ev.target.setAttribute('data-tocado', ''); var n = form.querySelector('[data-deducido="' + c + '"]'); if (n) n.textContent = ''; return; }
            ponerDeducidos();
          });
          form.addEventListener('click', function (ev) {
            var b = ev.target.closest('[data-poner-fecha]'); if (!b) return;
            var c = b.getAttribute('data-col'), i = [].filter.call(form.querySelectorAll('[data-c]'), function (x) { return x.getAttribute('data-c') === c; })[0];
            if (i) i.value = b.getAttribute('data-poner-fecha');
            [].forEach.call(b.parentNode.querySelectorAll('[data-poner-fecha]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          });
          form.addEventListener('input', function (ev) {
            var c = ev.target.getAttribute && ev.target.getAttribute('data-c'), ch = c && form.querySelector('.li-dias[data-col-dias="' + c + '"]');
            if (ch) [].forEach.call(ch.querySelectorAll('[data-poner-fecha]'), function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-poner-fecha') === ev.target.value)); });
          });
          ponerDeducidos();
          var pri = form.querySelector('textarea,input,select'); if (pri) pri.focus();
        }
      }
