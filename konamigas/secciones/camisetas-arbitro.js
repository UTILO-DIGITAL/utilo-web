/*
 * Sección «Entregar camisetas» de Konamigas · núcleo 5.0 (T0258) · clientes/konamigas/modulos/camisetas5arbitro de utilo-apps
 *
 * Para el árbitro, en el móvil y en el campo: sus partidos de los próximos 14 días y, de cada equipo, las camisetas ya
 * Preparadas, con la camiseta dibujada (su color y el dorsal), la talla y la jugadora. «Entregar» la marca al momento y
 * deja «Deshacer» unos segundos. No lee tablas: todo lo da y lo escribe el motor (camisetas5ArbitroPendientes y
 * camisetas5ArbitroEntregar), que comprueba que la camiseta es de un equipo de sus partidos. Los estilos son los cm- de
 * Camisetas (estilos/base.css).
 */
(function () {
  if (typeof window === 'undefined' || !window.UN) return;

  function texto(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  /** «jueves 30/10» de 'aaaa-mm-dd'. */
  function dia(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); if (!m) return String(v || '');
    return DIAS[new Date(+m[1], +m[2] - 1, +m[3]).getDay()] + ' ' + m[3] + '/' + m[2];
  }
  /** La camiseta dibujada, como en Camisetas: su color (COLORES.COLOR_HEX, dato del Excel) y el dorsal encima. */
  function camiseta(c) {
    var h = String(c.hex || ''), ok = /^#[0-9a-f]{6}$/i.test(h), claro = true;
    if (ok) { var r = parseInt(h.substr(1, 2), 16), g = parseInt(h.substr(3, 2), 16), b = parseInt(h.substr(5, 2), 16); claro = (r * 299 + g * 587 + b * 114) / 1000 > 150; }
    return '<span class="cm-cami' + (claro ? ' cm-cami-clara' : '') + '" aria-hidden="true"' + (ok ? ' style="--cm-c:' + h + '"' : '') + '>' +
      '<svg viewBox="0 0 24 24"><path d="M6.5 3 1.5 6.2l2.1 4.2 2.9-1.1V21.5h11V9.3l2.9 1.1 2.1-4.2L17.5 3c-.7 1.7-2.8 2.8-5.5 2.8S7.2 4.7 6.5 3z"/></svg>' +
      '<b' + (String(c.DORSAL || '').length > 1 ? ' class="cm-cami-2"' : '') + '>' + texto(c.DORSAL || '–') + '</b></span>';
  }

  var S = null;

  window.UN.registrar('CAMISETAS_ARBITRO', {
    abrir: function (el, ctx) {
      var yo = S = { el: el, ctx: ctx, R: null, hechas: {}, error: '' };
      el.innerHTML = '<div class="cm cma"><p class="u-nota">Cargando tus partidos…</p></div>';
      ctx.llamar('camisetas5ArbitroPendientes', []).then(function (r) { if (S !== yo) return; S.R = r; pintar(); }, function (e) {
        if (S !== yo) return; S.error = String(e.message).replace(/^\w+:\s*/, ''); pintar();
      });
    },
    cerrar: function () { S = null; }
  });

  function pintar() {
    var c = S.el.querySelector('.cma'), R = S.R;
    if (S.error) { c.innerHTML = '<p class="u-error">No se han podido cargar tus partidos: ' + texto(S.error) + '</p>'; return; }
    if (!R.staff) { c.innerHTML = '<p class="u-vacio">Tu acceso no tiene ficha de árbitro (ID_STAFF). Si arbitras, pide a quien administra que te la ponga.</p>'; return; }
    var total = 0;
    R.partidos.forEach(function (p) { p.equipos.forEach(function (e) { total += e.camisetas.filter(function (x) { return !S.hechas[x.ID]; }).length; }); });
    var h = '<p class="cm-resumen">' + (total ? 'Tienes <b class="cm-pintada">' + total + '</b> ' + (total === 1 ? 'camiseta' : 'camisetas') + ' para entregar' :
      'No tienes camisetas para entregar') + ' en tus partidos de los próximos ' + R.dias + ' días.</p>';
    if (!R.partidos.length) h += '<p class="u-vacio">No arbitras ningún partido en los próximos ' + R.dias + ' días.</p>';
    h += R.partidos.map(function (p) {
      return '<section class="cm-eq"><div class="cm-eq-cab"><h2 class="n-grupo">' + texto(dia(p.FECHA)) + (p.HORA ? ' · ' + texto(p.HORA) : '') + '</h2></div>' +
        '<p class="u-nota cm-eq-sub">' + texto([p.campo, p.equipos.map(function (e) { return e.nombre; }).join(' – ')].filter(String).join(' · ')) + '</p>' +
        p.equipos.map(function (e) {
          return '<h3 class="cm-sub">' + texto(e.nombre) + (e.color ? ' <span class="cm-eq-color">' + texto(e.color) + '</span>' : '') + '</h3>' +
            (e.camisetas.length ? '<ul class="cm-jugs">' + e.camisetas.map(function (x) {
              var hecha = S.hechas[x.ID];
              return '<li class="cm-jug"><div class="cm-jug-n">' + camiseta(x) + '<span class="cm-jug-t"><span class="cm-jug-c">' + texto((x.DORSAL || '–') + (x.TALLA || '')) + '</span>' +
                '<span class="cm-jug-p">' + texto(x.jugadora) + '</span>' +
                '<span class="cm-jug-e"><span class="n-estado n-e-' + (hecha ? 'co' : 'ec') + '">' + (hecha ? 'Entregada' : 'Preparada') + '</span></span></span></div>' +
                (hecha ? '' : '<button type="button" class="u-btn cm-sig cm-sig-co" data-cma="' + texto(x.ID) + '" aria-label="' + texto('Entregar la camiseta ' + (x.DORSAL || '') + (x.TALLA || '') + ' de ' + x.jugadora) + '">Entregar</button>') + '</li>';
            }).join('') + '</ul>' : '<p class="u-nota">Ninguna camiseta preparada.</p>');
        }).join('') + '</section>';
    }).join('');
    h += '<div class="cm-deshacer" role="status" hidden><span></span><button type="button" class="u-btn u-btn-texto">Deshacer</button></div>';
    c.innerHTML = h;
    c.onclick = function (ev) {
      var b = ev.target.closest('[data-cma]'); if (b) entregar(b.getAttribute('data-cma'));
    };
  }

  var tDeshacer = null;
  /** Al momento en la pantalla; el motor lo escribe por detrás. Si dice que no, vuelve atrás y avisa. */
  function entregar(id) {
    var yo = S, x = buscar(id);
    S.hechas[id] = true; pintar();
    S.ctx.llamar('camisetas5ArbitroEntregar', [id]).catch(function (e) {
      if (S !== yo) return; delete S.hechas[id]; pintar();
      S.ctx.aviso('No se ha podido entregar: ' + String(e.message).replace(/^\w+:\s*/, ''));
    });
    var d = S.el.querySelector('.cm-deshacer');
    d.querySelector('span').textContent = (x ? (x.DORSAL || '') + (x.TALLA || '') + ' de ' + x.jugadora : 'Camiseta') + ': entregada.';
    d.hidden = false;
    clearTimeout(tDeshacer);
    tDeshacer = setTimeout(function () { d.hidden = true; }, 15000);
    d.querySelector('button').onclick = function () {
      clearTimeout(tDeshacer); d.hidden = true;
      delete S.hechas[id]; pintar();
      S.ctx.llamar('camisetas5ArbitroEntregar', [id, true]).then(function () { S.ctx.aviso('Deshecho: la camiseta vuelve a Preparada.'); }, function (e) {
        S.ctx.aviso('No se ha podido deshacer: ' + String(e.message).replace(/^\w+:\s*/, ''));
      });
    };
  }
  function buscar(id) {
    var r = null;
    S.R.partidos.forEach(function (p) { p.equipos.forEach(function (e) { e.camisetas.forEach(function (x) { if (x.ID === id) r = x; }); }); });
    return r;
  }
})();
