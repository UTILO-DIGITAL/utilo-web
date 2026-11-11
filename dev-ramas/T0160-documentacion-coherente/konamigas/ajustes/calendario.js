/*
 * Konamigas · Ajustes › «Generar el calendario» (T0296) · acción del cliente en la sección Ajustes (T0292)
 *
 * No va en Ligas, que ven árbitros y gestores y es lo que ya funciona (Javi): va en Ajustes, con la configuración de la
 * temporada, para quien la ve (Socio y quien administra).
 * - Arriba se elige la temporada y la liga (cada una dice cuántos equipos confirmados y partidos tiene); por defecto, la
 *   primera sin partidos de la temporada más nueva.
 * - El motor propone el calendario (ligasCalendario, de clientes/konamigas/modulos/ligas/LIGAS_CALENDARIO.js): todos contra
 *   todos con los equipos confirmados, cada semana el día de la liga sin festivos ni descansos, en sus huecos.
 * - Los huecos salen por preferencia (1, 2, 3…; por defecto, cuanto antes mejor) y se ordenan arrastrando (en el móvil,
 *   desde el asa; con el teclado, con las flechas). Se usan los primeros que hacen falta cada jornada y los demás quedan
 *   libres. La preferencia se recuerda en el dispositivo para cada liga.
 * - «Otro sorteo» cambia el orden de los equipos; «Guardar» escribe todos los partidos de una vez, si no hay problemas y si
 *   nada ha cambiado desde que se vio. En una liga que ya tiene partidos se ve cómo saldría, pero no se guarda.
 * En solo lectura (SOLO_LEER de Ajustes) se ve, pero no se guarda.
 */
(function () {
  'use strict';

  /**
   * T0367 · Qué hace un evento del puntero con el arrastre de un hueco (arr: { id } del que arrastra, o null): 'nada',
   * 'mover' o 'soltar'. Solo cuenta el puntero que empezó el arrastre, y un ratón que se mueve sin el botón pulsado lo
   * suelta: si el «soltar» se pierde (se suelta fuera de la ventana o del marco, un menú del botón derecho), el hueco ya no
   * se queda enganchado al cursor. Antes, enganchado, el primer clic en «Guardar» solo lo soltaba (y volvía a preparar el
   * calendario con el orden nuevo): parecía que no hacía nada.
   */
  function arrastre(arr, e) {
    if (!arr || !e || e.pointerId !== arr.id) return 'nada';
    if (e.type === 'pointermove') return e.pointerType === 'mouse' && !(e.buttons & 1) ? 'soltar' : 'mover';
    return e.type === 'pointerup' || e.type === 'pointercancel' || e.type === 'lostpointercapture' ? 'soltar' : 'nada';
  }

  var CALC = { arrastre: arrastre };
  if (typeof window === 'undefined' || !window.UN || !window.UN.ajustes) { if (typeof module !== 'undefined') module.exports = CALC; return; }

  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var K = 'kon_cal_'; // lo que se recuerda en el dispositivo: la liga elegida y la preferencia de huecos de cada liga

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function deIso(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function fechaDia(s) { var d = deIso(s); return d ? DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()] : String(s || ''); }
  function guardado(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(K + k) || 'null'); localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} return null; }
  function semillaNueva() { return 1 + Math.floor(Math.random() * 2000000000); }
  function sinPrefijo(e) { return String((e && e.message) || e).replace(/^\w+:\s*/, ''); }

  var fin = null; // lo que hay que soltar al salir

  window.UN.ajustes('CALENDARIO', {
    abrir: function (el, ctx) {
      var L = null, c = null, temp = '', liga = guardado('liga') || '', semilla = semillaNueva(), orden = [], guardando = false, vivo = true, foco = '';
      fin = function () { vivo = false; };
      el.innerHTML = '<p class="u-nota">Todos contra todos con los equipos confirmados de la liga, cada semana su día, en sus huecos y sin los festivos ni los descansos. ' +
        'Primero lo revisas y después lo guardas; luego cada partido se mueve en Ligas como siempre.</p>' +
        '<div id="cal-elige"><div class="kz-centro" role="status"><div class="u-carga"></div></div></div><div id="cal-plan" class="cal-plan"></div>';
      var elige = el.querySelector('#cal-elige'), plan = el.querySelector('#cal-plan');

      function nombre(id) { return (c && c.nombres && c.nombres[id]) || String(id || ''); }
      function ligasDe(tid) { var t = (L.temporadas || []).filter(function (x) { return x.ID === tid; })[0]; return t ? t.competiciones : []; }
      function buscar(id) {
        var r = null;
        (L.temporadas || []).forEach(function (t) { t.competiciones.forEach(function (co) { co.ligas.forEach(function (l) { if (l.ID === id) r = { t: t, co: co, l: l }; }); }); });
        return r;
      }

      /* ---------- elegir la liga ---------- */

      function cargarLigas() {
        ctx.llamar('ligasCalendarioLigas', []).then(function (r) {
          if (!vivo) return;
          L = r || { temporadas: [] };
          var x = liga && buscar(liga);
          if (!x) {
            // Por defecto, la primera liga sin partidos de la temporada más nueva (la que se está preparando).
            liga = '';
            var t0 = (L.temporadas || [])[0];
            if (t0) t0.competiciones.forEach(function (co) { co.ligas.forEach(function (l) { if (!liga && !l.partidos) liga = l.ID; }); });
            x = liga && buscar(liga);
          }
          temp = x ? x.t.ID : ((L.temporadas || [])[0] || {}).ID || '';
          pintarElige();
          if (liga) cargar(); else plan.innerHTML = '';
        }, function (e) { if (vivo) elige.innerHTML = '<p class="u-error">No se han podido leer las ligas: ' + texto(sinPrefijo(e)) + '</p>'; });
      }
      function pintarElige() {
        if (!(L.temporadas || []).length) { elige.innerHTML = '<p class="u-vacio">Todavía no hay temporadas: añade una en Temporadas.</p>'; return; }
        var comps = ligasDe(temp);
        elige.innerHTML = '<label class="u-campo cal-temp"><span class="u-etiqueta">Temporada</span><select id="cal-temp">' + L.temporadas.map(function (t) {
          return '<option value="' + texto(t.ID) + '"' + (t.ID === temp ? ' selected' : '') + '>' + texto(t.NOMBRE) + '</option>';
        }).join('') + '</select></label>' +
          (comps.some(function (co) { return co.ligas.length; }) ? comps.filter(function (co) { return co.ligas.length; }).map(function (co) {
            return '<h3 class="lg-sub">' + texto(co.NOMBRE) + '</h3><div class="lg-huecos" role="radiogroup" aria-label="' + texto('Ligas de ' + co.NOMBRE) + '">' + co.ligas.map(function (l) {
              return '<button type="button" role="radio" class="lg-h" data-liga="' + texto(l.ID) + '" aria-checked="' + (l.ID === liga) + '"><b>' + texto(l.NOMBRE) + '</b>' +
                '<span>' + texto([l.DIA_SEMANA, l.equipos + (l.equipos === 1 ? ' equipo' : ' equipos')].filter(String).join(' · ')) + '</span>' +
                '<small>' + texto(l.partidos ? l.partidos + ' partidos: ya tiene calendario' : 'Sin partidos') + '</small></button>';
            }).join('') + '</div>';
          }).join('') : '<p class="u-vacio">Esta temporada todavía no tiene ligas: añádelas en Competiciones o en Ligas.</p>');
      }

      /* ---------- la propuesta ---------- */

      function cargar() {
        c = null; orden = guardado('huecos_' + liga) || [];
        plan.innerHTML = '<div class="kz-centro" role="status"><div class="u-carga"></div><p>Preparando el calendario…</p></div>';
        var pedida = liga;
        ctx.llamar('ligasCalendario', [liga, { semilla: semilla, orden: orden }]).then(function (r) {
          if (!vivo || pedida !== liga) return;
          c = r; pintarPlan();
        }, function (e) { if (vivo && pedida === liga) plan.innerHTML = '<p class="u-error">No se ha podido preparar: ' + texto(sinPrefijo(e)) + '</p>'; });
      }
      function partido(p) {
        var eq = function (id, lado) { return '<span class="lg-p' + lado + '"><span class="lg-nom">' + texto(nombre(id)) + '</span></span>'; };
        return '<div class="lg-p cal-p"><span class="lg-pi"><b class="u-cifra">' + texto(p.HORA) + '</b><small>' + texto(nombre(p.ID_CAMPO)) + '</small>' +
          '<small class="lg-parb" title="Árbitro">' + texto(p.ID_ARBITRO ? nombre(p.ID_ARBITRO) : 'Sin árbitro') + '</small></span>' +
          eq(p.ID_INSCRIPCION_LOCAL, 'l') + '<span class="lg-pc lg-pvs">vs</span>' + eq(p.ID_INSCRIPCION_VISITANTE, 'v') + '</div>';
      }
      function hueco(h, i) {
        return '<li data-h="' + texto(h.ID) + '"' + (h.USA ? '' : ' class="cal-libre"') + '>' +
          '<button type="button" class="cal-asa" aria-label="' + texto('Mover el hueco de las ' + h.HORA + ' en ' + nombre(h.ID_CAMPO) + ': arrástralo o usa las flechas arriba y abajo') + '"' +
          (c.huecos.length < 2 ? ' disabled' : '') + '><span aria-hidden="true">⠿</span></button><b class="u-cifra cal-num">' + (i + 1) + '</b>' +
          '<span><b>' + texto(h.HORA) + '</b> · ' + texto(nombre(h.ID_CAMPO)) + '<small>' + texto((h.ID_ARBITRO ? nombre(h.ID_ARBITRO) : 'Sin árbitro') + ' · ') +
          '<span class="cal-uso">' + (h.USA ? 'se usa' : 'libre') + '</span></small></span></li>';
      }
      function pintarPlan() {
        var x = buscar(liga), js = c.jornadas, n = js.reduce(function (t, j) { return t + j.partidos.length; }, 0);
        var puede = !ctx.soloLeer && !c.problemas.length && n > 0;
        var h = '<h2 class="n-grupo">' + texto((x ? x.co.NOMBRE + ' · ' : '') + c.liga.NOMBRE) + '</h2>' +
          '<p><b>' + c.equipos.length + ' equipos · ' + js.length + (js.length === 1 ? ' jornada' : ' jornadas') + ' · ' + n + ' partidos</b>' +
          (js.length ? '<br><span class="u-nota">' + texto('Del ' + fechaDia(js[0].fecha).toLowerCase() + ' de ' + deIso(js[0].fecha).getFullYear() + ' al ' +
            fechaDia(js[js.length - 1].fecha).toLowerCase() + ' de ' + deIso(js[js.length - 1].fecha).getFullYear() +
            (c.formato ? ' · ' + c.formato : '') + (c.vueltas === 2 && !/vuelta/i.test(c.formato) ? ' (a dos vueltas)' : '')) + '</span>' : '') + '</p>';
        if (c.huecos.length) h += '<h3 class="lg-sub">Huecos, por preferencia</h3>' +
          '<p class="u-nota">Arrastra para ordenarlos: cada jornada se usan los primeros que hacen falta' + (c.libres.length ? ' y los demás quedan libres para recuperar aplazados' : '') + '.</p>' +
          '<ol class="cal-pref" id="cal-pref">' + c.huecos.map(hueco).join('') + '</ol>';
        h += c.problemas.map(function (t) { return '<p class="lg-pav lg-pav-ficha lg-av-no" role="alert">' + texto(t) + '</p>'; }).join('');
        h += c.avisos.map(function (t) { return '<p class="lg-pav lg-pav-ficha lg-av-si">' + texto(t) + '</p>'; }).join('');
        if (c.saltados.length) h += '<p class="u-nota">Sin jornada por el calendario: ' + texto(c.saltados.map(function (s) { return fechaDia(s.fecha).toLowerCase() + ' (' + s.motivo + ')'; }).join(', ')) + '.</p>';
        h += '<p class="u-error" role="alert" hidden id="cal-error"></p><div class="n-botones">' +
          (ctx.soloLeer ? '<p class="u-nota">Puedes verlo, pero no guardarlo.</p>' :
            '<button type="button" class="u-btn u-btn-accion" id="cal-guardar"' + (puede && !guardando ? '' : ' disabled') + '>' +
            (guardando ? 'Guardando…' : c.problemas.length ? 'No se puede guardar' : 'Guardar los ' + n + ' partidos') + '</button>') +
          '<button type="button" class="u-btn" id="cal-sorteo"' + (guardando || c.equipos.length < 3 ? ' disabled' : '') + '>Otro sorteo</button></div>';
        h += js.map(function (j) {
          return '<h3 class="lg-sub cal-jt">' + texto('Jornada ' + j.n + ' · ' + fechaDia(j.fecha)) + '</h3><div class="lg-lista">' +
            j.partidos.map(partido).join('') +
            j.descansa.map(function (e) { return '<div class="lg-p lg-p-descansa"><span class="lg-pi"><b>Descansa</b></span><span class="lg-pdes"><span class="lg-nom">' + texto(nombre(e)) + '</span></span></div>'; }).join('') + '</div>';
        }).join('');
        plan.innerHTML = h;
        if (foco) { var a = plan.querySelector('[data-h="' + foco + '"] .cal-asa'); if (a) a.focus(); foco = ''; }
      }

      /* ---------- ordenar los huecos arrastrando ---------- */

      var arr = null; // { li, ol, a, id (el puntero) }
      function renumerar(ol) {
        var usa = c.huecos.filter(function (x) { return x.USA; }).length;
        [].forEach.call(ol.children, function (li, i) {
          li.querySelector('.cal-num').textContent = i + 1;
          li.classList.toggle('cal-libre', i >= usa);
          li.querySelector('.cal-uso').textContent = i < usa ? 'se usa' : 'libre';
        });
      }
      function aplicar(ol) {
        var nuevo = [].map.call(ol.children, function (li) { return li.getAttribute('data-h'); });
        if (nuevo.join() === c.huecos.map(function (x) { return x.ID; }).join()) return;
        orden = nuevo; guardado('huecos_' + liga, orden); cargar();
      }
      el.addEventListener('pointerdown', function (e) {
        var a = e.target.closest('.cal-asa');
        if (!a || a.disabled || guardando || !c || arr || (e.pointerType === 'mouse' && e.button !== 0)) return; // solo el botón principal
        e.preventDefault();
        var li = a.closest('li');
        arr = { li: li, ol: li.parentNode, a: a, id: e.pointerId };
        try { a.setPointerCapture(e.pointerId); } catch (x) {}
        li.classList.add('cal-mueve');
      });
      el.addEventListener('pointermove', function (e) {
        var que = arrastre(arr, e);
        if (que === 'soltar') { soltar(e); return; }
        if (que !== 'mover') return;
        var y = e.clientY, li = arr.li, prev = li.previousElementSibling, next = li.nextElementSibling;
        if (prev) { var rp = prev.getBoundingClientRect(); if (y < rp.top + rp.height / 2) { arr.ol.insertBefore(li, prev); renumerar(arr.ol); return; } }
        if (next) { var rn = next.getBoundingClientRect(); if (y > rn.top + rn.height / 2) { arr.ol.insertBefore(next, li); renumerar(arr.ol); } }
      });
      function soltar(e) {
        if (arrastre(arr, e) !== 'soltar') return;
        var x = arr; arr = null;
        x.li.classList.remove('cal-mueve');
        foco = x.li.getAttribute('data-h');
        aplicar(x.ol);
      }
      el.addEventListener('pointerup', soltar);
      el.addEventListener('pointercancel', soltar);
      el.addEventListener('lostpointercapture', soltar);
      el.addEventListener('keydown', function (e) {
        var a = e.target.closest && e.target.closest('.cal-asa');
        if (!a || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || guardando) return;
        e.preventDefault();
        var li = a.closest('li'), ol = li.parentNode, otro = e.key === 'ArrowUp' ? li.previousElementSibling : li.nextElementSibling;
        if (!otro) return;
        if (e.key === 'ArrowUp') ol.insertBefore(li, otro); else ol.insertBefore(otro, li);
        renumerar(ol); foco = li.getAttribute('data-h'); a.focus(); aplicar(ol);
      });

      /* ---------- botones ---------- */

      el.addEventListener('change', function (e) {
        if (e.target.id !== 'cal-temp') return;
        temp = e.target.value; liga = '';
        ligasDe(temp).forEach(function (co) { co.ligas.forEach(function (l) { if (!liga && !l.partidos) liga = l.ID; }); });
        pintarElige();
        if (liga) { semilla = semillaNueva(); cargar(); } else plan.innerHTML = '';
      });
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-liga]');
        if (b && !guardando) {
          liga = b.getAttribute('data-liga'); guardado('liga', liga); semilla = semillaNueva();
          [].forEach.call(elige.querySelectorAll('[data-liga]'), function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
          cargar(); return;
        }
        if (e.target.closest('#cal-sorteo') && c && !guardando) { semilla = semillaNueva(); cargar(); return; }
        if (!e.target.closest('#cal-guardar') || !c || guardando) return;
        guardando = true; pintarPlan();
        ctx.llamar('ligasCalendario', [liga, { semilla: semilla, orden: orden, guardar: c.huella }]).then(function (r) {
          guardando = false;
          if (!vivo) return;
          ctx.aviso('Calendario guardado: ' + r.guardados + ' partidos. Ya está en Ligas.');
          // T0366: se pasa a la siguiente liga sin partidos (volver a enseñar esta decía en rojo que ya los tiene).
          liga = ''; plan.innerHTML = '';
          cargarLigas();
        }, function (err) {
          guardando = false;
          if (!vivo) return;
          pintarPlan();
          var m = plan.querySelector('#cal-error'); m.textContent = 'No se ha guardado: ' + sinPrefijo(err); m.hidden = false;
        });
      });

      cargarLigas();
    },
    cerrar: function () { if (fin) fin(); fin = null; }
  });
})();
