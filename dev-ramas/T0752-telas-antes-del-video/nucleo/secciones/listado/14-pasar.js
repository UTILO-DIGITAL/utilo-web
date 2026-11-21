      /* ---------- T0643 · cerrar, pasar y apuntar en un toque ---------- */
      var tDes = 0;
      /** Un aviso con «Deshacer» (8 segundos): lo que se acaba de hacer se puede volver atrás. */
      function deshacible(txt, deshacer) {
        avDes.querySelector('span').textContent = txt;
        avDes.hidden = false; avDes._deshacer = deshacer;
        clearTimeout(tDes);
        tDes = setTimeout(function () { avDes.hidden = true; avDes._deshacer = null; }, 8000);
      }
      function sinDeshacer() { clearTimeout(tDes); avDes.hidden = true; avDes._deshacer = null; }
      function mal(que) { return function (e) { ctx.aviso('No se ha ' + que + ': ' + ((e && e.message) || e)); }; }
      /** El nombre de una fila para un aviso: su texto, cortado (T0677: no su código, que no dice nada a quien la usa). */
      function quien(a, f) { return nombreCorto(a, f, PROHIB); }
      /** T0677 · Guarda un cambio de la fila id y da cómo deshacerlo: el deshacer espera al cambio y falla si falla. */
      function cambioDeshacible(a, id, cambios, antes) {
        var c = deshacerEnOrden(function () { return T.actualizar(a.tabla, id, cambios); }, function () { return T.actualizar(a.tabla, id, antes); });
        c.hecho.then(null, mal('guardado'));
        return c.deshacer;
      }
      /** Deshace y lo dice: «Deshecho.» solo si de verdad se ha deshecho. */
      function deshacerYDecir(d) {
        return Promise.resolve().then(d).then(function () { ctx.aviso('Deshecho.'); }, mal('deshecho'));
      }
      function marcarHecha(id) {
        var a = ap(), r = a.rapidas, f = filaVista(a, id);
        if (!f || !r || !r.hecha) return;
        var crudo = f.__crudo || f, ch = cambiosHecha(a, crudo, hoyIso()); // T0732 (R23): antes de tiempo, con la fecha de hoy
        var volver = cambioDeshacible(a, id, ch.cambios, ch.antes);
        var con = siguienteCon(a, crudo);
        if (con) { sinDeshacer(); siguientePaso(a, f, con, volver); }
        else deshacible(r.hecha.valor + ': ' + quien(a, f), volver);
      }
      function pasar(id, fecha) {
        var a = ap(), c = a.rapidas && a.rapidas.pasar, f = filaVista(a, id);
        if (!f || !c || !fecha) return;
        var crudo = f.__crudo || f, antes = {}, cambios = {};
        antes[c] = vacio(crudo[c]) ? '' : crudo[c]; cambios[c] = fecha;
        deshacible(quien(a, f) + ' pasa al ' + diaCorto(fecha), cambioDeshacible(a, id, cambios, antes));
      }
      /** «Otro día…»: una ventana con el calendario. */
      function pasarOtroDia(id) {
        var a = ap(), f = filaVista(a, id); if (!f) return;
        abrirVentana('<div class="li-ficha-cab"><h2 id="li-vt">Pasar a otro día</h2><button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Cerrar">' + ICONO_X + '</button></div>' +
          '<p class="u-nota">' + texto(quien(a, f)) + '</p><form id="li-fotro" class="li-form" novalidate><div class="u-campo"><label class="u-etiqueta" for="li-otro">Día</label>' +
          '<input id="li-otro" type="date" value="' + texto(masDias(hoyIso(), 1)) + '"></div><div class="n-botones"><button type="submit" class="u-btn u-btn-accion">Pasar</button></div></form>', true);
        vent.querySelector('#li-fotro').addEventListener('submit', function (ev) {
          ev.preventDefault();
          var v = vent.querySelector('#li-otro').value; if (!v) return;
          cerrarVentana(); pasar(id, v);
        });
      }
      /** Al cerrar una fila que es con alguien (una marca, un proveedor): ¿cuál es el siguiente paso con él? La ✕, tocar fuera
       *  o Esc vuelven atrás (la fila sigue sin cerrar); «No hay siguiente paso» la deja cerrada sin apuntar nada. */
      /** T0679 · Al cerrar una tarea, lo que hace falta para decidir el siguiente paso: la tarea entera, con quién y para cuándo
       *  era, y lo que ya hay pendiente con ellos (para no apuntar dos veces lo mismo). */
      function ctxSiguiente(a, f, con) {
        var crudo = f.__crudo || f, fc = a.rapidas && a.rapidas.pasar, dia = fc && !vacio(crudo[fc]) ? fechaDia(crudo[fc], hoyIso()) : '';
        var h = '<div class="li-sig-ctx"><p class="li-sig-t">' + texto(verTexto(campo(a, a.nombre), f, VAL, PROHIB) || quien(a, f)) + '</p>' +
          '<p class="u-nota">' + [f[con] ? 'Con ' + texto(f[con]) : '', dia ? 'era para el ' + texto(dia) : ''].filter(String).join(' · ') + '</p>';
        var rc = null;
        try { rc = a.contexto ? resumenDe(a, D, crudo, vistas(a), { hoy: hoyIso(), prohib: PROHIB, sin: f[a.clave] }) : null; } catch (e) { rc = null; }
        if (rc && rc.pendientes && rc.pendientes.length) h += '<p class="u-etiqueta li-sig-pt">Ya tienes pendiente con ' + texto(rc.nombre || f[con] || '') + '</p><ul class="li-sig-pend">' + rc.pendientes.slice(0, 3).map(function (e) {
          return '<li>' + texto(e.titulo) + (e.cuando ? ' <small class="' + (e.tarde ? 'li-ctx-tarde' : '') + '">' + texto(e.cuando) + '</small>' : '') + '</li>';
        }).join('') + '</ul>';
        return h + '</div>';
      }
      function siguientePaso(a, f, con, volver) {
        var hoy = hoyIso(), fs = fechasSiguiente(hoy), crudo = f.__crudo || f;
        // Viene marcado «En 3 días»; si cae en fin de semana, el primer día de trabajo.
        var d3 = aFecha(fs[1].fecha).getDay(), marcado = d3 === 0 || d3 === 6 ? 0 : 1;
        var h = '<div class="li-ficha-cab"><p class="li-sig-ok">' + ICONO_OK + texto(a.rapidas.hecha.valor) + ': ' + texto(quien(a, f)) + '</p>' +
          '<button type="button" class="u-btn u-btn-icono" data-cerrar aria-label="Volver sin cerrarla" title="Volver sin cerrarla">' + ICONO_X + '</button></div>' +
          ctxSiguiente(a, f, con) +
          '<h2 id="li-vt">¿Cuál es el próximo paso con ' + texto(f[con] || '') + '?</h2>' +
          '<form id="li-fsig" class="li-form" novalidate>' +
          // T0732 (R74): lo hablado en la llamada, si quiere, en las notas de la tarea que se cierra.
          (a.rapidas.hablado ? '<div class="u-campo u-ancho"><label class="u-etiqueta" for="li-hab">¿Qué habéis hablado? <span class="u-nota">(si quieres)</span></label>' +
            '<textarea id="li-hab" rows="2" aria-describedby="li-sig-err"></textarea></div>' : '') +
          '<div class="u-campo u-ancho"><label class="u-etiqueta" for="li-sig">Próximo paso</label>' +
          '<input id="li-sig" type="text" autocomplete="off" aria-describedby="li-sig-err"></div>' +
          (a.rapidas.pasar ? '<fieldset class="u-campo li-dias"><legend class="u-etiqueta">Cuándo</legend><div>' + fs.map(function (o, i) {
            return '<button type="button" class="li-dia" data-dia="' + o.fecha + '" aria-pressed="' + (i === marcado) + '">' + texto(o.titulo) + ' <small>' + texto(diaCorto(o.fecha)) + '</small></button>';
          }).join('') + '</div></fieldset>' : '') +
          '<p class="u-error" id="li-sig-err" role="alert" hidden></p>' +
          '<div class="n-botones"><button type="submit" class="u-btn u-btn-accion">Guardar próximo paso</button><button type="button" class="u-btn u-btn-texto" data-sig-no>No hay próximo paso</button></div>' +
          '<p class="u-nota">¿Te has equivocado? Cierra esta ventana y la tarea seguirá pendiente.</p></form>';
        abrirVentana(h, true);
        // Volver atrás (la ✕, fuera o Esc): sin «Deshecho», pero con su aviso si falla (T0677).
        alCerrar = function () { return Promise.resolve().then(volver).then(null, mal('deshecho')); };
        var form = vent.querySelector('#li-fsig'), inp = vent.querySelector('#li-sig'), hab = vent.querySelector('#li-hab');
        (hab || inp).focus();
        /** T0732 (R74): guarda lo hablado (si hay) y da cómo deshacerlo junto con el cierre; false si lleva algo que no se guarda. */
        function guardarHablado() {
          var t = hab ? hab.value.trim() : '', p = prohibido(t, PROHIB), err = vent.querySelector('#li-sig-err');
          if (p.length) { err.textContent = textoProhibido(p); err.hidden = false; hab.setAttribute('aria-invalid', 'true'); hab.focus(); return false; }
          var ch = conHablado(a, crudo, t);
          if (!ch) return volver;
          var antes = {}; antes[a.rapidas.hablado] = vacio(crudo[a.rapidas.hablado]) ? '' : crudo[a.rapidas.hablado];
          var dh = cambioDeshacible(a, f[a.clave], ch, antes);
          return function () { return Promise.all([dh(), volver()]); };
        }
        form.addEventListener('click', function (ev) {
          var d = ev.target.closest('[data-dia]');
          if (d) { [].forEach.call(form.querySelectorAll('[data-dia]'), function (x) { x.setAttribute('aria-pressed', String(x === d)); }); return; }
          if (ev.target.closest('[data-sig-no]')) {
            var todo = guardarHablado(); if (!todo) return;
            alCerrar = null; cerrarVentana();
            deshacible(a.rapidas.hecha.valor + ': ' + quien(a, f), todo);
          }
        });
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var t = inp.value.trim(), err = vent.querySelector('#li-sig-err'), p = prohibido(t, PROHIB);
          if (!t) { err.textContent = 'Escribe el próximo paso, o pulsa «No hay próximo paso».'; err.hidden = false; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
          if (p.length) { err.textContent = textoProhibido(p); err.hidden = false; inp.setAttribute('aria-invalid', 'true'); return; }
          var d = form.querySelector('[data-dia][aria-pressed="true"]');
          if (!guardarHablado()) return;
          alCerrar = null; cerrarVentana();
          Promise.resolve(T.crear(a.tabla, filaSiguiente(a, crudo, t, d ? d.getAttribute('data-dia') : ''))).then(function () {
            ctx.aviso('Guardado el próximo paso con ' + (f[con] || '') + '.');
          }, mal('guardado el próximo paso'));
        });
      }
      /** T0643 · Si la sección cierra y pasa en un toque en esta vista (no en la de clientes; su columna se edita). */
      function conRapidas(a, vista) {
        var r = a.rapidas, ed = editables(a);
        return !!r && !vista.cliente && ((r.hecha && ed.indexOf(r.hecha.campo) >= 0) || (r.pasar && ed.indexOf(r.pasar) >= 0));
      }
      function circulo(a, f) {
        var r = a.rapidas, id = f[a.clave], cod = quien(a, f); // T0677: lo que dice el lector de pantalla, el texto de la tarea
        if (!r.hecha || editables(a).indexOf(r.hecha.campo) < 0) return '';
        return '<button type="button" class="li-circ" data-hecha="' + texto(id) + '" aria-label="Marcar como ' + texto(String(r.hecha.valor).toLowerCase()) + ': ' + texto(cod) + '" title="Marcar como ' + texto(String(r.hecha.valor).toLowerCase()) + '">' + ICONO_OK + '</button>';
      }
      function botonPasar(a, f) {
        if (!a.rapidas.pasar || editables(a).indexOf(a.rapidas.pasar) < 0) return '';
        var id = String(f[a.clave]);
        return '<button type="button" class="u-btn li-pasar" data-pasar-menu="' + texto(id) + '" aria-haspopup="menu" aria-expanded="' + (S.menu === id) + '" aria-label="Pasar a otro día: ' + texto(quien(a, f)) + '" title="Pasar a otro día">' + ICONO_MOVER + '<span class="li-pasar-t" aria-hidden="true">Pasar</span></button>';
      }
      /* ---------- T0652 · el resumen de con quién es una fila ---------- */
      /** El nombre de con quién es (h, ya pintado) como botón que abre su resumen; sin nadie de CONTEXTO.de, tal cual. */
      function botonCtx(a, f, h) {
        if (!contextoCol(a, f.__crudo) || h.indexOf('class="li-nada"') >= 0) return h;
        var n = h.replace(/<[^>]*>/g, '');
        return '<button type="button" class="li-ctx-b" data-ctx="' + texto(f[a.clave]) + '" aria-haspopup="dialog" aria-expanded="' + (S.ctx === String(f[a.clave])) + '" title="Lo último con ' + texto(n) + '">' + h + '<span aria-hidden="true"> ›</span></button>';
      }
      function resumenFila(a, id, sin) {
        var f = filaVista(a, id);
        return f ? resumenDe(a, D, f.__crudo, vistas(a), { hoy: hoyIso(), prohib: PROHIB, sin: sin }) : null;
      }
      /** El resumen en HTML: en el panel (con su cabecera y la ✕) o dentro de la ficha. */
      function htmlResumen(r, enFicha) {
        var ev = function (e, hecha) {
          return '<li><button type="button" class="li-ctx-ev" data-ctx-fila="' + texto(e.id) + '"><span class="li-ctx-f">' + texto(e.fecha || 'Sin fecha') + '</span><span class="li-ctx-q">' +
            (hecha ? '<span class="li-ctx-ok" aria-hidden="true">' + ICONO_OK + '</span>' : '') + texto(e.titulo) +
            (!hecha && e.cuando ? '<small class="' + (e.tarde ? 'li-ctx-tarde' : '') + '">' + texto(e.cuando) + '</small>' : '') +
            (e.nota ? '<small>' + texto(e.nota) + '</small>' : '') + '</span></button></li>';
        };
        var sec = r.seccion ? String(r.seccion).toUpperCase() : '', va = sec && veo[sec];
        var h = enFicha ? '<h3 class="li-fg-t">Con ' + texto(r.nombre) + '</h3>' + (r.sub ? '<p class="li-ctx-sub">' + texto(r.sub) + '</p>' : '')
          : '<div class="li-ctx-cab"><div><h2 id="li-ctx-t" tabindex="-1">' + texto(r.nombre) + '</h2>' + (r.sub ? '<p class="li-ctx-sub">' + texto(r.sub) + '</p>' : '') + '</div>' +
            '<button type="button" class="u-btn u-btn-icono" data-ctx-cerrar aria-label="Cerrar">' + ICONO_X + '</button></div>';
        if (r.chips.length) h += '<p class="li-ctx-chips">' + r.chips.map(function (c) { return '<span class="u-chip">' + texto(c) + '</span>'; }).join('') + '</p>';
        if (r.nota) h += '<p class="li-ctx-nota">' + texto(r.nota) + '</p>';
        h += '<section class="li-ctx-bl"><h4 class="u-etiqueta">Lo último que has hecho</h4>' + (r.ultimas.length ? '<ul class="li-ctx-l">' + r.ultimas.map(function (e) { return ev(e, true); }).join('') + '</ul>' : '<p class="u-nota">Aún no has hecho nada con él.</p>') + '</section>';
        h += '<section class="li-ctx-bl"><h4 class="u-etiqueta">' + (enFicha ? 'Lo demás pendiente' : 'Lo que tienes pendiente') + '</h4>' + (r.pendientes.length ? '<ul class="li-ctx-l">' + r.pendientes.map(function (e) { return ev(e, false); }).join('') + '</ul>' +
          (r.masPendientes ? '<p class="u-nota">Y ' + r.masPendientes + ' más.</p>' : '') : '<p class="u-nota">Nada ' + (enFicha ? 'más ' : '') + 'pendiente con ellos.</p>') + '</section>';
        r.lineas.forEach(function (l) { h += '<p class="li-ctx-lin"><span class="u-etiqueta">' + texto(l.titulo) + '</span> ' + texto(l.texto) + '</p>'; });
        if (va) h += '<p><a class="u-btn li-ctx-ir" href="?s=' + encodeURIComponent(sec.toLowerCase()) + '&ficha=' + encodeURIComponent(r.id) + '" data-sx="' + texto(sec) + '">Abrir en ' + texto(va) + ' ›</a></p>';
        return enFicha ? '<section class="li-fgrupo li-ctx-ficha">' + h + '</section>' : h;
      }
      /** El panel: al lado en el ordenador, desde abajo en el móvil. Se pinta otra vez si cambian los datos. */
      function pintarCtx(foco) {
        var r = S.ctx ? resumenFila(ap(), S.ctx) : null;
        if (!r) { pCtx.hidden = true; pCtx.innerHTML = ''; pCtx._html = ''; S.ctx = ''; return; }
        var h = htmlResumen(r, false);
        if (h !== pCtx._html) { pCtx.innerHTML = h; pCtx._html = h; } // un refresco con lo mismo no le quita el foco
        pCtx.hidden = false;
        if (foco) { var t = pCtx.querySelector('#li-ctx-t'); if (t) t.focus(); }
      }
      function abrirCtx(id) {
        S.ctx = String(id); S.menu = ''; pintar(); pintarCtx(true);
        // T0742: lo antiguo con quien es esta fila, si su tabla se lee por partes; al llegar, el resumen se rehace.
        var a = ap(), f = filaVista(a, id);
        if (f) historiaDe(a, f.__crudo, true).then(function (nuevo) { if (nuevo && S.ctx === String(id)) pintarCtx(); });
      }
      /**
       * T0742 · La historia entera de una fila en las tablas que se leen por partes (nucleo.partes): las de su seguimiento
       * (RELACIONADOS) y, con CONTEXTO, lo de su tabla con quien es. Devuelve una promesa con true si ha pedido algo que
       * la copia aún no tenía (para rehacer la ficha), false si ya estaba todo.
       */
      function historiaDe(a, crudo, soloCtx) {
        if (!crudo || !T.porPartes) return Promise.resolve(false);
        var pide = [];
        var de = function (t, col, v) {
          if (!T.porPartes(t) || vacio(v) || esRuta(col)) return;
          if (pide.some(function (x) { return x.t === t && x.col === col && x.v === String(v); })) return;
          pide.push({ t: t, col: col, v: String(v), ya: T.tiene(t, { clave: col + ':' + v }) });
        };
        if (!soloCtx) a.relacionados.forEach(function (r) { if (r.tabla && r.campo && r.con && !r.contiene && !r.juntar) de(r.tabla, r.campo, crudo[r.con]); });
        var cc = contextoCol(a, crudo);
        if (cc) de(a.tabla, cc, crudo[cc]);
        if (!pide.length) return Promise.resolve(false);
        return Promise.all(pide.map(function (x) { return T.leerDe(x.t, x.col, x.v); })).then(function () {
          return pide.some(function (x) { return !x.ya; });
        }, function () { return false; });
      }
      function cerrarCtx(sinFoco) {
        if (!S.ctx) return;
        var id = S.ctx; S.ctx = ''; pintarCtx(); pintar();
        if (sinFoco) return;
        var b = [].filter.call(cont.querySelectorAll('[data-ctx]'), function (x) { return x.getAttribute('data-ctx') === id && x.offsetParent; })[0];
        if (b) b.focus();
      }
      /** El menú de «Pasar», fuera de la tabla (no lo corta su desplazamiento); se coloca junto a su botón al pintar. */
      function menuPasar(hoy) {
        if (!S.menu) return '';
        return '<div class="li-menu" role="menu" aria-label="Pasar a otro día"><p class="li-menu-t" aria-hidden="true">Pasar a…</p>' + opcionesPasar(hoy).map(function (o) {
          return '<button type="button" role="menuitem" data-pasar-a="' + o.fecha + '" data-fila="' + texto(S.menu) + '">' + texto(o.titulo) + ' <small>' + texto(diaCorto(o.fecha)) + '</small></button>';
        }).join('') + '<button type="button" role="menuitem" data-pasar-otro="' + texto(S.menu) + '">Otro día…</button></div>';
      }
      function colocarMenu() {
        var m = cont.querySelector('.li-menu'); if (!m) return;
        var b = [].filter.call(cont.querySelectorAll('[data-pasar-menu]'), function (x) { return x.getAttribute('data-pasar-menu') === S.menu && x.offsetParent; })[0];
        if (!b) { S.menu = ''; m.remove(); pintado = ''; return; }
        var r = b.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
        m.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
        m.style.top = (r.bottom + 4 + h > window.innerHeight - 8 ? r.top - h - 4 : r.bottom + 4) + 'px';
      }
