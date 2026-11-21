      function pintar() {
        if (!S.leido) return;
        VAL = valoresDe(cfg.VALORES, filaDe);
        // T0724 (R16): se comprueba con las columnas que hay; al llegar las del motor (la copia del dispositivo puede ser de antes
        // de una publicación que añade columnas), otra vez (ver alCambiar). Lo ven quien administra y soporte, cada uno a su manera.
        if (errores === null) {
          errores = ctx.admin || SOPORTE_YO ? comprobar(cfg, function (t) { var c = T.columnas && T.columnas(t); return c && c.length ? c : null; }, '') : [];
          if (errores.length && window.console) console.warn('Listado ' + ctx.id + ': la configuración tiene cosas que no cuadran.\n' + errores.join('\n'));
        }
        var a = ap(), vista = vistaActual(a), hoy = hoyIso(), todas = vistas(a);
        if (MIAS && S.mias === 'mias') todas = todas.filter(function (f) { return esMia(MIAS, f, YO); }); // T0689
        S.vista = vista.id;
        var html = '';
        html += htmlErrores(errores, SOPORTE_YO);
        var vs = vistasDe(a);
        // T0752: sin vistas para elegir (Hoy), Mías / Todas van arriba, como las pestañas de las demás secciones.
        var miasArriba = MIAS && vs.length <= 1;
        html += '<div class="li-arriba">' + (vs.length > 1 ? '<div class="u-pestanas li-vistas" role="tablist" aria-label="Vistas">' + vs.map(function (v) {
          return '<button type="button" role="tab" data-vista="' + texto(v.id) + '" aria-selected="' + (v.id === vista.id) + '">' + texto(v.titulo) + (v.cliente ? ' <span class="li-cli">para clientes</span>' : '') + '</button>';
        }).join('') + '</div>' : miasArriba ? '<div class="u-pestanas li-vistas" role="tablist" aria-label="De quién">' + [['mias', 'Mías'], ['todas', 'Todas']].map(function (o) {
          return '<button type="button" role="tab" data-mias="' + o[0] + '" aria-selected="' + (S.mias === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' : '<div class="li-vistas"></div>');
        // T0644: Personalizar va al Perfil; lo que es la vista, a mano en el ordenador y tras «i» en el móvil. T0752: sin AYUDA, nada.
        var ayuda = a.ayuda ? textoDe(a, vista) : '';
        html += '<span class="u-nota li-cuenta">@@CUENTA@@</span>';
        if (cfg._soloMirar) html += '<span class="u-nota li-solo">Solo para mirar</span>'; // T0717
        if (ayuda) html += '<button type="button" class="u-btn u-btn-icono li-qes" data-qes aria-expanded="' + !!S.qes + '" aria-controls="li-texto" aria-label="Qué es esta vista">' + ICONO_INFO + '</button>';
        html += '</div>';
        if (ayuda) html += '<p class="u-nota li-texto' + (S.qes ? ' li-abierto' : '') + '" id="li-texto">' + texto(ayuda) + '</p>';
        // T0708: el resumen de todo lo que hay (no solo lo de la vista): «203 telas · 39 diseños», con su frase.
        var cifras = vista.cliente ? [] : cifrasResumen(a, D);
        if (cifras.length) html += '<div class="li-resumen" role="group" aria-label="Resumen">' + cifras.map(function (x) {
          return '<span class="li-cifra"><b>' + texto(num(x.n, 0)) + '</b> ' + texto(x.nombre) + '</span>';
        }).join('') + (a.resumen.texto ? '<span class="li-resumen-t">' + texto(a.resumen.texto) + '</span>' : '') + '</div>';
        if (vista.cliente) {
          var nombres = []; ocultas(a, vista).forEach(function (c) { var t = campo(a, c).titulo; if (nombres.indexOf(t) < 0) nombres.push(t); });
          html += '<p class="li-cliente">Vista para enseñar a un cliente: sin avisos y sin ' + (nombres.length ? nombres.map(function (t) { return t.toLowerCase(); }).join(', ').replace(/, ([^,]*)$/, ' ni $1') : 'los datos privados') + '.</p>';
        }
        var deVista = filtrar(a, vista, todas, { hoy: hoy });
        var avs = vista.cliente ? [] : avisosBarra(a, vista).map(function (x) { return { a: x, n: filtrar(a, vista, todas, { hoy: hoy, aviso: x.id }).length }; }).filter(function (x) { return x.n; });
        if (S.aviso && !avs.some(function (x) { return x.a.id === S.aviso; })) S.aviso = '';
        // T0625: los filtros que no valen en esta vista (una columna que no se ve, lo privado en la de clientes) se quitan.
        var disp = filtrables(a, vista, deVista, VAL);
        S.filtros = filtrosQueValen(S.filtros, disp);
        var nf = Object.keys(S.filtros).length;
        // T0690: el orden puesto tocando el título de una columna, el de esta vista en este dispositivo (si la columna sigue).
        S.orden = guardado(K + 'orden_' + vista.id);
        if (S.orden && columnasDe(a, vista).indexOf(S.orden.replace(/^-/, '')) < 0) S.orden = '';
        // Buscando, filtrando o con un aviso elegido no se pliega nada: lo que sale es lo que se busca.
        S.todo = !!(S.q || nf || S.aviso);
        var fs = filtrar(a, vista, todas, { hoy: hoy, q: S.q, aviso: S.aviso, filtros: S.filtros, valores: VAL, orden: S.orden });
        html = html.replace('@@CUENTA@@', texto(cuenta(a, vista, fs.length, deVista.length)));
        html += '<div class="li-barra">' + (MIAS && !miasArriba ? '<div class="li-mias" role="group" aria-label="De quién">' + [['mias', 'Mías'], ['todas', 'Todas']].map(function (o) {
          return '<button type="button" data-mias="' + o[0] + '" aria-pressed="' + (S.mias === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' : '') + '<div class="li-buscar"><label class="u-oculto" for="li-q">Buscar</label><input id="li-q" type="search" placeholder="Buscar en ' + texto((a.titulo || '').toLowerCase()) + '" value="' + texto(S.q) + '" autocomplete="off"></div>' +
          (disp.length ? '<button type="button" class="u-btn li-filtrar" data-filtrar aria-haspopup="dialog"' + (nf ? ' aria-pressed="true"' : '') + '>' + ICONO_FILTRO + '<span class="li-bt">Filtrar</span>' + (nf ? ' <span class="li-nf" aria-label="' + nf + (nf === 1 ? ' puesto' : ' puestos') + '">' + nf + '</span>' : '') + '</button>' : '') +
          (a.crear && editables(a).length && !vista.cliente ? '<button type="button" class="u-btn u-btn-accion li-nueva" data-nueva aria-label="Añadir">' + ICONO_MAS + '<span class="li-bt">Añadir</span></button>' : '') + '</div>';
        // T0679: el primer filtro de pocas opciones (hasta 5), a la vista sobre la lista: «Todas» y cada opción, en pastillas.
        var rap = a.rapido ? disp.filter(function (d) { return d.tipo === 'lista' && d.opciones.length >= 2 && d.opciones.length <= 5; })[0] : null;
        if (rap) {
          var xr = S.filtros[rap.campo] || {};
          html += '<div class="li-rapido" role="group" aria-label="' + texto(rap.titulo) + '"><span class="li-rapido-t">' + texto(rap.titulo) + '</span>' +
            '<button type="button" class="li-fop" data-rapido="' + texto(rap.campo) + '" data-v="" aria-pressed="' + (!xr.es && !xr.vacio) + '">' + palabraTodos(rap.cp) + '</button>' + rap.opciones.map(function (o) {
              return '<button type="button" class="li-fop" data-rapido="' + texto(rap.campo) + '" data-v="' + texto(o) + '" aria-pressed="' + (xr.es !== undefined && norm(xr.es) === norm(o)) + '">' + texto(mostrar(rap.cp, o)) + '</button>';
            }).join('') + (rap.vacios ? (function () { // T0730 (R42): las que no lo tienen («Sin proveedor · 21»), con cuántas son
              var n = deVista.filter(function (f) { return nada(valorDe(a, rap.campo, f, VAL)); }).length;
              return '<button type="button" class="li-fop" data-rapido="' + texto(rap.campo) + '" data-v="!" aria-pressed="' + !!xr.vacio + '">Sin ' + texto(rap.titulo.toLowerCase()) + ' · ' + n + '</button>';
            })() : '') + '</div>';
        }
        // Los filtros puestos, a la vista: cada uno se quita con su ✕, o todos a la vez. El del filtro rápido ya se ve en sus
        // pastillas (li-fchip-rap, escondido); T0691: en el móvil, con cuatro opciones o más las pastillas no salen y sí él.
        if (nf) html += '<div class="li-filtros" role="group" aria-label="Filtros puestos">' + disp.filter(function (d) { return S.filtros[d.campo]; }).map(function (d) {
          var t = textoFiltro(d, S.filtros[d.campo]);
          return '<button type="button" class="li-fchip' + (rap && d.campo === rap.campo ? ' li-fchip-rap' : '') + '" data-quitar="' + texto(d.campo) + '" aria-label="Quitar el filtro ' + texto(t) + '">' + texto(t) + ICONO_X + '</button>';
        }).join('') + '<button type="button" class="u-btn u-btn-texto li-fquitar" data-quitar="">Quitar filtros</button></div>';
        if (avs.length) html += '<div class="li-avisos" role="group" aria-label="Avisos">' + avs.map(function (x) {
          return '<button type="button" class="li-av li-' + texto(x.a.nivel || 'medio') + '" data-aviso="' + texto(x.a.id) + '" aria-pressed="' + (S.aviso === x.a.id) + '"><b>' + x.n + '</b> ' + texto(x.a.titulo) + '</button>';
        }).join('') + (S.aviso ? '<button type="button" class="u-btn u-btn-texto" data-aviso="">Ver todas</button>' : '') + '</div>';
        // T0710: lo de otra tabla que pide una decisión (la feria a 45 días sin decidir), arriba, con sus botones. T0752: debajo
        // de la cabecera (vistas, buscar y avisos), justo encima de la lista: la cabecera es igual en todas las secciones.
        if (!vista.cliente) a.arriba.forEach(function (x, ix) {
          filasArriba(x, filas(x.tabla), hoy).forEach(function (f) {
            var l = lineaArriba(x, f, hoy), id = f[x.clave];
            html += '<div class="li-arriba-av" role="group" aria-label="' + texto(l.titulo) + '">' +
              '<div class="li-arriba-tx">' + (l.etiqueta ? '<span class="li-arriba-et">' + texto(l.etiqueta) + '</span>' : '') +
              '<strong>' + texto(l.titulo) + '</strong>' + (l.debajo ? '<span class="u-nota">' + texto(l.debajo) + '</span>' : '') + '</div>' +
              '<div class="li-arriba-bt">' + x.botones.map(function (b, ib) {
                return '<button type="button" class="u-btn' + (ib ? '' : ' u-btn-accion') + '" data-arriba="' + ix + '" data-arriba-b="' + ib + '" data-arriba-id="' + texto(id) + '">' + texto(b.titulo) + '</button>';
              }).join('') + (x.ver && x.seccion && veo[x.seccion.toUpperCase()] ? '<a class="u-btn" href="?s=' + encodeURIComponent(x.seccion) + '&ficha=' + encodeURIComponent(id) + '" data-sx="' + texto(x.seccion.toUpperCase()) + '">' + texto(x.ver) + '</a>' : '') + '</div></div>';
          });
        });
        if (!todas.length) html += '<p class="u-vacio">' + texto(a.vacio || 'Todavía no hay nada en ' + (a.titulo || '').toLowerCase() + '.') + '</p>';
        else if (!fs.length) html += '<p class="u-vacio">' + (S.q ? 'Nada con «' + texto(S.q) + '»' + (nf ? ' y estos filtros.' : '.') : (nf ? 'Nada con estos filtros.' : 'Nada en esta vista.')) + '</p>';
        else if (vista.tablero) html += pintarTablero(a, vista, fs, hoy);
        else if (vista.galeria) html += pintarGaleria(a, vista, agrupar(a, vista, fs, hoy), hoy);
        else html += pintarGrupos(a, vista, agrupar(a, vista, fs, hoy), hoy);
        html += botonAntiguo(a, vista);
        if (vista.tablero || !conRapidas(a, vista)) S.menu = '';
        html += menuPasar(hoy);
        if (S.ctx) pintarCtx(); // T0652: el resumen abierto, con lo nuevo
        // Si no ha cambiado nada (un refresco por detrás con lo mismo), no se rehace: un toque a medias en una fila no se pierde.
        if (html === pintado) return;
        pintado = html;
        var foco = document.activeElement && document.activeElement.id === 'li-q' ? document.activeElement.selectionStart : null;
        cont.innerHTML = html;
        if (abierta && velo.classList.contains('li-v-ficha')) marcarAbierta(abierta.id); // T0679: la fila de la ficha abierta, marcada
        if (foco !== null) { var q = cont.querySelector('#li-q'); q.focus(); try { q.setSelectionRange(foco, foco); } catch (e) {} }
        colocarMenu();
      }

