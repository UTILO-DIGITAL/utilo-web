      // Tablero: arrastrar una tarjeta a otra columna cambia ese campo (con la capa de tablas: al momento y por detrás).
      // Con el ratón, a mano (pointer events), no con el arrastre del navegador: así va igual en todos los navegadores y
      // con las pruebas automáticas. En el móvil (dedo), el tablero se desliza de lado y el estado se cambia en la ficha.
      var arr = null, sinClic = false;
      function columnaEn(x, y) { var e = document.elementFromPoint(x, y); return e && e.closest ? e.closest('[data-soltar]') : null; }
      function soltarArrastre() {
        if (arr && arr.fantasma) arr.fantasma.remove();
        [].forEach.call(cont.querySelectorAll('.li-cogida,.li-encima'), function (x) { x.classList.remove('li-cogida', 'li-encima'); });
        arr = null;
      }
      cont.addEventListener('pointerdown', function (ev) {
        if (ev.pointerType === 'touch' || ev.button !== 0) return;
        var b = ev.target.closest && ev.target.closest('.li-tarjeta[data-mover]'); if (!b) return;
        arr = { id: b.getAttribute('data-id'), b: b, x: ev.clientX, y: ev.clientY, moviendo: false, fantasma: null };
      });
      document.addEventListener('pointermove', alMover = function (ev) {
        if (!arr) return;
        if (!arr.moviendo) {
          if (Math.abs(ev.clientX - arr.x) + Math.abs(ev.clientY - arr.y) < 6) return; // un clic no es arrastrar
          arr.moviendo = true; arr.b.classList.add('li-cogida');
          var r = arr.b.getBoundingClientRect(), g = arr.b.cloneNode(true);
          g.className += ' li-fantasma'; g.style.width = r.width + 'px'; g.setAttribute('aria-hidden', 'true');
          arr.dx = arr.x - r.left; arr.dy = arr.y - r.top; arr.fantasma = g; cont.appendChild(g);
        }
        ev.preventDefault();
        arr.fantasma.style.left = (ev.clientX - arr.dx) + 'px'; arr.fantasma.style.top = (ev.clientY - arr.dy) + 'px';
        var col = columnaEn(ev.clientX, ev.clientY);
        [].forEach.call(cont.querySelectorAll('.li-encima'), function (x) { if (x !== col) x.classList.remove('li-encima'); });
        if (col) col.classList.add('li-encima');
        // Cerca del borde del tablero, se desplaza solo: la última columna puede no caber (Hecha, en un portátil).
        var tb = cont.querySelector('.li-tablero');
        if (tb) { var rc = tb.getBoundingClientRect(); if (ev.clientX > rc.right - 60) tb.scrollLeft += 24; else if (ev.clientX < rc.left + 60) tb.scrollLeft -= 24; }
      });
      document.addEventListener('pointerup', alSoltar = function (ev) {
        if (!arr) return;
        var era = arr, col = era.moviendo ? columnaEn(ev.clientX, ev.clientY) : null;
        soltarArrastre();
        if (!era.moviendo) return; // fue un clic: abre la ficha
        sinClic = true; setTimeout(function () { sinClic = false; }, 0);
        if (!col) return;
        var a = ap(), c = cont.querySelector('.li-tablero').getAttribute('data-campo'), v = col.getAttribute('data-valor');
        var f = filaVista(a, era.id), cp = campo(a, c);
        if (!f || norm(f[c]) === norm(v)) return;
        var cambios = {}; cambios[c] = cp.ids && v in cp.ids ? cp.ids[v] : v; // una columna que apunta a otra tabla guarda el código
        Promise.resolve(T.actualizar(a.tabla, era.id, cambios)).then(function () { ctx.aviso('Movida a «' + (v ? mostrar(cp, v) : 'sin ' + campo(a, c).titulo.toLowerCase()) + '».'); }, function (e) { ctx.aviso('No se ha movido: ' + ((e && e.message) || e)); });
      });
      document.addEventListener('pointercancel', alCancelar = function () { soltarArrastre(); });
      // Después de arrastrar no se abre la ficha (el navegador manda un clic al soltar).
      cont.addEventListener('click', function (ev) { if (sinClic) { ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
